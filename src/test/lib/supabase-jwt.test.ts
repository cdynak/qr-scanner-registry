import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "crypto";
import { signSupabaseUserJwt } from "../../lib/supabase-jwt";

function decodeSegment(segment: string) {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

describe("signSupabaseUserJwt", () => {
  const originalSecret = process.env.SUPABASE_JWT_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.SUPABASE_JWT_SECRET;
    else process.env.SUPABASE_JWT_SECRET = originalSecret;
    vi.unstubAllEnvs();
  });

  it("returns null when no JWT secret is configured", () => {
    vi.stubEnv("SUPABASE_JWT_SECRET", "");
    delete process.env.SUPABASE_JWT_SECRET;
    expect(signSupabaseUserJwt("user-123")).toBeNull();
  });

  it("signs a valid HS256 JWT with sub and role claims", () => {
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-secret");
    process.env.SUPABASE_JWT_SECRET = "test-secret";

    const token = signSupabaseUserJwt("user-123", 3600);
    expect(token).toBeTruthy();

    const [header, payload, signature] = token!.split(".");
    expect(decodeSegment(header)).toMatchObject({ alg: "HS256", typ: "JWT" });

    const claims = decodeSegment(payload);
    expect(claims.sub).toBe("user-123");
    expect(claims.role).toBe("authenticated");
    expect(claims.aud).toBe("authenticated");
    expect(claims.exp - claims.iat).toBe(3600);

    // Signature must verify against the secret.
    const expected = createHmac("sha256", "test-secret")
      .update(`${header}.${payload}`)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    expect(signature).toBe(expected);
  });
});
