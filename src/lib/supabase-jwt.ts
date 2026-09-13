import { createHmac } from "crypto";

/**
 * Signs a Supabase-compatible HS256 JWT for a given user so that Postgres
 * Row Level Security policies keyed on `auth.uid()` enforce per-user access.
 *
 * The token is signed with the project's JWT secret (SUPABASE_JWT_SECRET),
 * carries `sub = userId` and `role = authenticated`, matching what Supabase's
 * PostgREST expects. Returns null when no JWT secret is configured (in which
 * case the app falls back to the service-role client).
 */

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function getSupabaseJwtSecret(): string | undefined {
  return import.meta.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
}

/**
 * Creates a signed Supabase user JWT. `expiresInSeconds` defaults to 1 hour to
 * match the session lifetime.
 */
export function signSupabaseUserJwt(userId: string, expiresInSeconds = 3600): string | null {
  const secret = getSupabaseJwtSecret();
  if (!secret) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = base64url(createHmac("sha256", secret).update(data).digest());

  return `${data}.${signature}`;
}
