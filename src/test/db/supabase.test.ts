import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
const mockAuthGetUser = vi.fn();
const mockSupabaseClient = {
  auth: {
    getUser: mockAuthGetUser,
  },
};

const mockCreateClient = vi.fn(() => mockSupabaseClient);

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

describe("Supabase Client Configuration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the shared current-user cache so tests don't leak state.
    const { clearCurrentUserCache } = await import("../../db/supabase");
    clearCurrentUserCache();
  });

  describe("Environment Variables", () => {
    it("should have required environment variables", () => {
      expect(process.env.SUPABASE_URL).toBeDefined();
      expect(process.env.SUPABASE_ANON_KEY).toBeDefined();
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
    });
  });

  describe("Client Creation", () => {
    it("should create and export supabase client", async () => {
      const { supabase } = await import("../../db/supabase");
      expect(supabase).toBeDefined();
      expect(supabase.auth).toBeDefined();
    });

    it("should create server-side Supabase client", async () => {
      const { createServerSupabaseClient } = await import("../../db/supabase");
      const serverClient = createServerSupabaseClient();
      expect(serverClient).toBeDefined();
      expect(serverClient.auth).toBeDefined();
    });

    it("should throw error when creating server client without service role key", async () => {
      // Temporarily remove the service role key
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // Reset modules to get fresh import
      vi.resetModules();

      const { createServerSupabaseClient } = await import("../../db/supabase");

      expect(() => createServerSupabaseClient()).toThrow("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");

      // Restore the key
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    });
  });

  describe("Authentication Helpers", () => {
    // getCurrentUser / isAuthenticated resolve the app session via the
    // server endpoint /api/auth/me (the session cookie is HttpOnly), so we
    // mock global fetch rather than the Supabase auth client.
    describe("getCurrentUser", () => {
      it("should return user when authentication is successful", async () => {
        const mockUser = {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
        };

        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ data: mockUser }),
          })
        );

        const { getCurrentUser } = await import("../../db/supabase");
        const user = await getCurrentUser();

        expect(user).toEqual(mockUser);
        expect(fetch).toHaveBeenCalledWith("/api/auth/me", expect.objectContaining({ credentials: "include" }));

        vi.unstubAllGlobals();
      });

      it("coalesces concurrent calls into a single request", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ data: { id: "user-123" } }),
        });
        vi.stubGlobal("fetch", fetchMock);

        const { getCurrentUser } = await import("../../db/supabase");

        // Two simultaneous callers (e.g. Navigation + AuthGuard) should share
        // one underlying /api/auth/me request.
        const [a, b] = await Promise.all([getCurrentUser(), getCurrentUser()]);

        expect(a).toEqual({ id: "user-123" });
        expect(b).toEqual({ id: "user-123" });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        vi.unstubAllGlobals();
      });

      it("should return null when not authenticated (401)", async () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: "Not authenticated", data: null }),
          })
        );

        const { getCurrentUser } = await import("../../db/supabase");

        await expect(getCurrentUser()).resolves.toBeNull();

        vi.unstubAllGlobals();
      });

      it("should throw error on unexpected server error", async () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({}),
          })
        );

        const { getCurrentUser } = await import("../../db/supabase");

        await expect(getCurrentUser()).rejects.toThrow("Failed to get current user: 500");

        vi.unstubAllGlobals();
      });
    });

    describe("isAuthenticated", () => {
      it("should return true when user is authenticated", async () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ data: { id: "user-123", email: "test@example.com" } }),
          })
        );

        const { isAuthenticated } = await import("../../db/supabase");
        const result = await isAuthenticated();

        expect(result).toBe(true);

        vi.unstubAllGlobals();
      });

      it("should return false when user is not authenticated", async () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ data: null }),
          })
        );

        const { isAuthenticated } = await import("../../db/supabase");
        const result = await isAuthenticated();

        expect(result).toBe(false);

        vi.unstubAllGlobals();
      });

      it("should return false when getCurrentUser throws an error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

        const { isAuthenticated } = await import("../../db/supabase");
        const result = await isAuthenticated();

        expect(result).toBe(false);

        vi.unstubAllGlobals();
      });
    });
  });

  describe("Client Configuration", () => {
    it("should call createClient with correct parameters for client-side client", async () => {
      // Clear previous calls
      mockCreateClient.mockClear();

      // Reset modules to ensure fresh import
      vi.resetModules();

      // Import the module to trigger client creation
      await import("../../db/supabase");

      expect(mockCreateClient).toHaveBeenCalledWith(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });
    });

    it("should call createClient with service role key for server client", async () => {
      mockCreateClient.mockClear();

      const { createServerSupabaseClient } = await import("../../db/supabase");
      createServerSupabaseClient();

      expect(mockCreateClient).toHaveBeenCalledWith(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    });
  });

  describe("createUserScopedClient", () => {
    it("falls back to the service-role client for a non-JWT sentinel token", async () => {
      mockCreateClient.mockClear();
      const { createUserScopedClient } = await import("../../db/supabase");

      createUserScopedClient("no-supabase-jwt");

      // Should use the service role key, with no Authorization header.
      expect(mockCreateClient).toHaveBeenCalledWith(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        expect.objectContaining({ auth: { autoRefreshToken: false, persistSession: false } })
      );
      const lastCall = mockCreateClient.mock.calls.at(-1);
      expect(lastCall?.[2]?.global?.headers?.Authorization).toBeUndefined();
    });

    it("falls back to the service-role client when no token is provided", async () => {
      mockCreateClient.mockClear();
      const { createUserScopedClient } = await import("../../db/supabase");

      createUserScopedClient(undefined);

      expect(mockCreateClient).toHaveBeenCalledWith(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        expect.anything()
      );
    });

    it("uses the anon key with an Authorization header for a valid user JWT", async () => {
      mockCreateClient.mockClear();
      const { createUserScopedClient } = await import("../../db/supabase");

      // Minimal JWT-shaped token with a `sub` claim.
      const payload = Buffer.from(JSON.stringify({ sub: "user-123", role: "authenticated" })).toString("base64");
      const jwt = `header.${payload}.signature`;

      createUserScopedClient(jwt);

      const lastCall = mockCreateClient.mock.calls.at(-1);
      expect(lastCall?.[1]).toBe(process.env.SUPABASE_ANON_KEY);
      expect(lastCall?.[2]?.global?.headers?.Authorization).toBe(`Bearer ${jwt}`);
    });
  });
});
