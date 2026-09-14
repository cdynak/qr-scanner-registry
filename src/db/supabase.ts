import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { createMockSupabaseClient } from "./mock-supabase";

// Environment variables validation - handle both server and client side
const supabaseUrl = import.meta.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Local/offline mode: when USE_MOCK_DB is "true", the app uses an in-memory
 * store instead of a real Supabase project. This is an explicit opt-in for
 * local development, not a silent fallback — real failures still surface when
 * the flag is off.
 */
// Astro coerces "true"/"false" env values to booleans, so accept both forms.
// process.env is the fallback for a flag passed on the shell (Playwright, CI).
const mockDbFlag: unknown =
  import.meta.env.USE_MOCK_DB ??
  import.meta.env.PUBLIC_USE_MOCK_DB ??
  (typeof process !== "undefined" ? process.env.USE_MOCK_DB : undefined);
export const useMockDb = mockDbFlag === true || mockDbFlag === "true";

// Only validate on server side or when actually needed (skip in mock mode).
const isServer = typeof window === "undefined";

if (isServer && !useMockDb && !supabaseUrl) {
  throw new Error("Missing SUPABASE_URL environment variable");
}

if (isServer && !useMockDb && !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_ANON_KEY environment variable");
}

// Client-side Supabase client (uses anon key)
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createSupabaseJsClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;

// Server-side Supabase client (uses service role key for admin operations).
// In local/offline mode this returns an in-memory mock client instead.
export const createServerSupabaseClient = () => {
  if (useMockDb) {
    return createMockSupabaseClient() as unknown as ReturnType<typeof createSupabaseJsClient<Database>>;
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL environment variable");
  }

  return createSupabaseJsClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Alias used by API routes that need an admin (service-role) client.
export { createServerSupabaseClient as createClient };

/**
 * Creates a request-scoped client that acts *as the given user*, so Postgres
 * Row Level Security enforces per-user access at the database layer.
 *
 * It uses the public anon key plus the user's Supabase JWT (Authorization
 * header). When mock mode is on, or no JWT / anon key is available, it falls
 * back to the appropriate client so the app keeps working.
 */
/**
 * Returns true if the token looks like a Supabase user JWT (3 segments with a
 * decodable payload carrying a `sub` claim). Guards against sending a
 * non-Supabase token (e.g. a Google OAuth access token from an older session),
 * which PostgREST would treat as anon and cause RLS to filter out all rows.
 */
const looksLikeSupabaseJwt = (token: string): boolean => {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    return typeof payload?.sub === "string" && payload.sub.length > 0;
  } catch {
    return false;
  }
};

export const createUserScopedClient = (userJwt?: string | null) => {
  if (useMockDb) {
    return createMockSupabaseClient() as unknown as ReturnType<typeof createSupabaseJsClient<Database>>;
  }

  // Without a usable Supabase user JWT (or anon key) we cannot scope by user;
  // fall back to the service-role client. Ownership is still enforced in the
  // route handlers as defense in depth.
  if (!userJwt || !looksLikeSupabaseJwt(userJwt) || !supabaseUrl || !supabaseAnonKey) {
    return createServerSupabaseClient();
  }

  return createSupabaseJsClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  });
};

// Coalesces concurrent /api/auth/me calls so multiple components mounting at
// once (e.g. Navigation + AuthGuard) share a single request, and briefly
// caches the result to avoid redundant fetches on the same page load.
let inFlightCurrentUser: Promise<unknown> | null = null;
let cachedCurrentUser: { value: unknown; expiresAt: number } | null = null;
const CURRENT_USER_TTL_MS = 5000;

async function fetchCurrentUser() {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to get current user: ${response.status}`);
  }

  const body = await response.json();
  return body.data ?? null;
}

/**
 * Gets the currently authenticated user for client-side components. Reads auth
 * state from the server (/api/auth/me), which parses the HttpOnly session
 * cookie. The session token is never exposed to JavaScript.
 *
 * Concurrent callers share one request; results are cached briefly. Call
 * `clearCurrentUserCache()` after login/logout to force a refresh.
 */
export const getCurrentUser = async () => {
  const now = Date.now();

  if (cachedCurrentUser && cachedCurrentUser.expiresAt > now) {
    return cachedCurrentUser.value;
  }

  if (inFlightCurrentUser) {
    return inFlightCurrentUser;
  }

  inFlightCurrentUser = fetchCurrentUser()
    .then((value) => {
      cachedCurrentUser = { value, expiresAt: Date.now() + CURRENT_USER_TTL_MS };
      return value;
    })
    .finally(() => {
      inFlightCurrentUser = null;
    });

  return inFlightCurrentUser;
};

/** Clears the cached current user (call after login/logout). */
export const clearCurrentUserCache = () => {
  cachedCurrentUser = null;
  inFlightCurrentUser = null;
};

// Helper function to check if the current user is authenticated (client-side).
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    return !!user;
  } catch {
    return false;
  }
};
// Helper function to test Supabase connectivity
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("users").select("count").limit(1);
    return !error;
  } catch (error) {
    console.warn("Supabase connectivity test failed:", error.message);
    return false;
  }
};
