import type { APIRoute } from "astro";
import { google } from "googleapis";
import { createClient, useMockDb } from "../../../db/supabase";
import { createAuthSession, createSecureSessionCookie } from "../../../lib/auth";
import { signSupabaseUserJwt } from "../../../lib/supabase-jwt";
import { ValidationError } from "../../../types";
import { AuthenticationError, NetworkError, logError, retryWithBackoff } from "../../../lib/errors";
import { getClientIP } from "../../../lib/security";
import { sanitizeUserInput } from "../../../lib/validation";

/**
 * Local/offline login: skips Google entirely and signs in a deterministic
 * development user backed by the in-memory store. Only used when USE_MOCK_DB
 * is enabled.
 */
async function mockLogin(redirect: (url: string) => Response): Promise<Response> {
  const googleUser = {
    id: "local-dev-google-id",
    email: "local.dev@example.com",
    name: "Local Dev User",
    picture: null as string | null,
  };

  const supabase = createClient();

  const { data: existingUser } = await supabase.from("users").select("*").eq("google_id", googleUser.id).single();

  let user = existingUser;
  if (!user) {
    const { data: newUser } = await supabase
      .from("users")
      .insert({
        google_id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        avatar_url: googleUser.picture,
      })
      .select()
      .single();
    user = newUser;
  }

  const session = createAuthSession(user, "mock-access-token", 3600);
  const response = redirect("/?auth=success");
  response.headers.append("Set-Cookie", createSecureSessionCookie(session, false));
  response.headers.append("Set-Cookie", "authenticated=true; Path=/; Max-Age=3600; SameSite=Lax;");
  return response;
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    import.meta.env.GOOGLE_CLIENT_ID,
    import.meta.env.GOOGLE_CLIENT_SECRET,
    `${import.meta.env.NEXTAUTH_URL}/api/auth/google`
  );
}

/**
 * Redirects the caller to Google's OAuth consent screen.
 */
function initiateOAuth(redirect: (url: string) => Response): Response | Promise<Response> {
  // Local/offline mode: sign in directly without contacting Google.
  if (useMockDb) {
    return mockLogin(redirect);
  }

  try {
    if (!import.meta.env.GOOGLE_CLIENT_ID || !import.meta.env.GOOGLE_CLIENT_SECRET) {
      throw new AuthenticationError("OAuth configuration missing");
    }

    const authUrl = getOAuthClient().generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email"],
      include_granted_scopes: true,
    });

    return redirect(authUrl);
  } catch (error) {
    logError(error, { route: "/api/auth/google", step: "initiate" });
    return new Response(JSON.stringify({ error: "Failed to initiate authentication" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Handles the OAuth callback: exchanges the code, fetches the Google profile,
 * upserts the user in Supabase and establishes a session.
 */
async function handleCallback(request: Request, redirect: (url: string) => Response): Promise<Response> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      logError(new AuthenticationError(`OAuth error: ${error}`), {
        route: "/api/auth/google",
        oauthError: error,
        clientIP: getClientIP(request),
      });
      return redirect("/?error=oauth_denied");
    }

    if (!code) {
      throw new ValidationError("Authorization code is required");
    }

    const oauth2Client = getOAuthClient();

    // Exchange the authorization code for tokens.
    const { tokens } = await retryWithBackoff(
      async () => {
        try {
          return await oauth2Client.getToken(code);
        } catch (err) {
          if (err instanceof Error && err.message.includes("network")) {
            throw new NetworkError("Failed to exchange OAuth code");
          }
          throw err;
        }
      },
      3,
      1000,
      { route: "/api/auth/google", step: "token_exchange" }
    );

    oauth2Client.setCredentials(tokens);

    // Fetch the user's Google profile.
    const googleUser = await retryWithBackoff(
      async () => {
        try {
          const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
          const { data } = await oauth2.userinfo.get();
          return data;
        } catch (err) {
          if (err instanceof Error && err.message.includes("network")) {
            throw new NetworkError("Failed to fetch user info from Google");
          }
          throw err;
        }
      },
      3,
      1000,
      { route: "/api/auth/google", step: "user_info" }
    );

    if (!googleUser.id || !googleUser.email || !googleUser.name) {
      throw new AuthenticationError("Incomplete user information from Google");
    }

    // Upsert the user in Supabase.
    const supabase = createClient();

    const { data: existingUser } = await supabase.from("users").select("*").eq("google_id", googleUser.id).single();

    let user;
    if (existingUser) {
      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update({
          email: googleUser.email,
          name: googleUser.name,
          avatar_url: googleUser.picture || null,
          updated_at: new Date().toISOString(),
        })
        .eq("google_id", googleUser.id)
        .select()
        .single();

      if (updateError || !updatedUser) {
        throw new AuthenticationError(`Failed to update user information: ${updateError?.message || "Unknown error"}`);
      }
      user = updatedUser;
    } else {
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          google_id: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          avatar_url: googleUser.picture || null,
        })
        .select()
        .single();

      if (createError || !newUser) {
        throw new AuthenticationError(`Failed to create user account: ${createError?.message || "Unknown error"}`);
      }
      user = newUser;
    }

    // Sanitize user-provided fields before storing them in the session.
    const sanitizedUser = {
      ...user,
      name: sanitizeUserInput(user.name, { maxLength: 255 }),
      email: sanitizeUserInput(user.email, { maxLength: 255 }),
      avatar_url: user.avatar_url ? sanitizeUserInput(user.avatar_url, { maxLength: 500, allowUrls: true }) : null,
    };

    // Mint a Supabase-compatible user JWT so DB queries run under RLS as this
    // user. If no JWT secret is configured, store a non-JWT sentinel: it keeps
    // the session valid but is ignored by createUserScopedClient (which then
    // falls back to the service-role client). We must NOT store the Google
    // access token here — sending it as a bearer would make Supabase treat the
    // request as anon and RLS would hide all of the user's rows.
    const supabaseToken = signSupabaseUserJwt(sanitizedUser.id, 3600) || "no-supabase-jwt";
    const session = createAuthSession(sanitizedUser, supabaseToken, 3600);
    const isProd = import.meta.env.NODE_ENV === "production";

    const response = redirect("/?auth=success");

    // HttpOnly session cookie (carries the token) + non-sensitive client flag.
    response.headers.append("Set-Cookie", createSecureSessionCookie(session, isProd));
    const secureAttr = isProd ? " Secure;" : "";
    response.headers.append("Set-Cookie", `authenticated=true; Path=/; Max-Age=3600; SameSite=Lax;${secureAttr}`);

    return response;
  } catch (error) {
    logError(error, {
      route: "/api/auth/google",
      step: "callback",
      clientIP: getClientIP(request),
    });

    if (error instanceof ValidationError) {
      return redirect("/?error=invalid_request");
    }
    if (error instanceof AuthenticationError) {
      return redirect("/?error=auth_failed");
    }
    if (error instanceof NetworkError) {
      return redirect("/?error=network_error");
    }
    return redirect("/?error=server_error");
  }
}

/**
 * GET /api/auth/google
 * - With no `code`/`error`: initiates the OAuth flow (redirect to Google).
 * - With `code`/`error` (Google redirects back via GET): handles the callback.
 */
export const GET: APIRoute = async ({ request, url, redirect }) => {
  const hasCallbackParams = url.searchParams.has("code") || url.searchParams.has("error");

  if (hasCallbackParams) {
    return handleCallback(request, redirect);
  }

  return initiateOAuth(redirect);
};

/**
 * POST /api/auth/google
 * Handles the OAuth callback programmatically.
 */
export const POST: APIRoute = async ({ request, redirect }) => {
  return handleCallback(request, redirect);
};
