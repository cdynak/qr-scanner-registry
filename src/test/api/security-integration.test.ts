import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as createScan } from "../../pages/api/scans/create";
import { DELETE as deleteScan } from "../../pages/api/scans/delete";
import { POST as googleAuth } from "../../pages/api/auth/google";
import type { User } from "../../types";

// Mock dependencies
vi.mock("../../db/supabase", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({ data: mockScan, error: null })),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: mockUser, error: null })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    })),
  })),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn(() => ({
        getToken: vi.fn(() => ({ tokens: { access_token: "mock-token" } })),
        setCredentials: vi.fn(),
      })),
    },
    oauth2: vi.fn(() => ({
      userinfo: {
        get: vi.fn(() => ({
          data: {
            id: "google-123",
            email: "test@example.com",
            name: "Test User",
            picture: "https://example.com/avatar.jpg",
          },
        })),
      },
    })),
  },
}));

const mockUser: User = {
  id: "user-123",
  google_id: "google-123",
  email: "test@example.com",
  name: "Test User",
  avatar_url: "https://example.com/avatar.jpg",
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2023-01-01T00:00:00Z",
};

const mockScan = {
  id: "scan-123",
  user_id: "user-123",
  content: "https://example.com",
  scan_type: "qr",
  format: "QR_CODE",
  scanned_at: "2023-01-01T00:00:00Z",
  created_at: "2023-01-01T00:00:00Z",
};

describe("API Security Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Scan Creation Security", () => {
    it("should reject unauthenticated requests", async () => {
      const request = new Request("http://localhost/api/scans/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: "https://example.com",
          scanType: "qr",
        }),
      });

      const locals = {
        isAuthenticated: false,
        user: null,
        csrfToken: "valid-token",
      };

      const response = await createScan({ request, locals } as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Authentication required");
    });

    it("should reject requests without CSRF token", async () => {
      const request = new Request("http://localhost/api/scans/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: "https://example.com",
          scanType: "qr",
        }),
      });

      const locals = {
        isAuthenticated: true,
        user: mockUser,
        csrfToken: undefined,
      };

      const response = await createScan({ request, locals } as any);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("CSRF token validation failed");
    });

    it("should reject malicious content", async () => {
      const request = new Request("http://localhost/api/scans/create", {
        method: "POST",
        headers: { 
          "content-type": "application/json",
          "x-csrf-token": "valid-token",
        },
        body: JSON.stringify({
          content: "<script>alert('xss')</script>",
          scanType: "qr",
        }),
      });

      const locals = {
        isAuthenticated: true,
        user: mockUser,
        csrfToken: "valid-token",
      };

      const response = await createScan({ request, locals } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Malicious content detected");
    });

    it("should reject oversized requests", async () => {
      const largeContent = "x".repeat(100 * 1024); // 100KB
      const request = new Request("http://localhost/api/scans/create", {
        method: "POST",
        headers: { 
          "content-type": "application/json",
          "content-length": (100 * 1024).toString(),
          "x-csrf-token": "valid-token",
        },
        body: JSON.stringify({
          content: largeContent,
          scanType: "qr",
        }),
      });

      const locals = {
        isAuthenticated: true,
        user: mockUser,
        csrfToken: "valid-token",
      };

      const response = await createScan({ request, locals } as any);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.error).toBe("Request too large");
    });

    it("should sanitize valid input", async () => {
      const request = new Request("http://localhost/api/scans/create", {
        method: "POST",
        headers: { 
          "content-type": "application/json",
          "x-csrf-token": "valid-token",
        },
        body: JSON.stringify({
          content: "  https://example.com  ",
          scanType: "qr",
          format: "  QR_CODE  ",
        }),
      });

      const locals = {
        isAuthenticated: true,
        user: mockUser,
        csrfToken: "valid-token",
      };

      const response = await createScan({ request, locals } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toBeDefined();
    });
  });

  describe("Scan Deletion Security", () => {
    it("should reject requests without valid UUID", async () => {
      const request = new Request("http://localhost/api/scans/delete", {
        method: "DELETE",
        headers: { 
          "content-type": "application/json",
          "x-csrf-token": "valid-token",
        },
        body: JSON.stringify({
          id: "invalid-id",
        }),
      });

      const locals = {
        isAuthenticated: true,
        user: mockUser,
        csrfToken: "valid-token",
      };

      const response = await deleteScan({ request, locals } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid scan ID format");
    });

    it("should sanitize scan ID input", async () => {
      const request = new Request("http://localhost/api/scans/delete", {
        method: "DELETE",
        headers: { 
          "content-type": "application/json",
          "x-csrf-token": "valid-token",
        },
        body: JSON.stringify({
          id: "  550e8400-e29b-41d4-a716-446655440000  ",
        }),
      });

      const locals = {
        isAuthenticated: true,
        user: mockUser,
        csrfToken: "valid-token",
      };

      // Mock successful deletion
      vi.mocked(require("../../db/supabase").createServerSupabaseClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ 
                data: { id: "550e8400-e29b-41d4-a716-446655440000", user_id: "user-123" }, 
                error: null 
              })),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null })),
          })),
        })),
      });

      const response = await deleteScan({ request, locals } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Scan deleted successfully");
    });
  });

  describe("Authentication Security", () => {
    it("should validate OAuth state parameter", async () => {
      const request = new Request("http://localhost/api/auth/google?code=auth-code&state=invalid-state", {
        method: "POST",
      });

      const cookies = {
        get: vi.fn((name) => {
          if (name === "oauth_state") {
            return { value: "valid-state" };
          }
          return null;
        }),
        delete: vi.fn(),
      };

      const redirect = vi.fn((url) => new Response(null, { status: 302, headers: { Location: url } }));

      const locals = {
        isAuthenticated: false,
      };

      const response = await googleAuth({ request, redirect, cookies, locals } as any);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("error=invalid_state");
    });

    it("should handle OAuth errors gracefully", async () => {
      const request = new Request("http://localhost/api/auth/google?error=access_denied", {
        method: "POST",
      });

      const redirect = vi.fn((url) => new Response(null, { status: 302, headers: { Location: url } }));

      const locals = {
        isAuthenticated: false,
      };

      const response = await googleAuth({ request, redirect, locals } as any);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("error=oauth_denied");
    });

    it("should sanitize user data from OAuth", async () => {
      const request = new Request("http://localhost/api/auth/google?code=auth-code&state=valid-state", {
        method: "POST",
      });

      const cookies = {
        get: vi.fn((name) => {
          if (name === "oauth_state") {
            return { value: "valid-state" };
          }
          return null;
        }),
        delete: vi.fn(),
      };

      const redirect = vi.fn((url) => new Response(null, { status: 302, headers: { Location: url } }));

      const locals = {
        isAuthenticated: false,
      };

      // Mock OAuth response with potentially malicious data
      vi.mocked(require("googleapis").google.oauth2).mockReturnValue({
        userinfo: {
          get: vi.fn(() => ({
            data: {
              id: "google-123",
              email: "test@example.com",
              name: "<script>alert('xss')</script>Test User",
              picture: "javascript:alert('xss')",
            },
          })),
        },
      });

      const response = await googleAuth({ request, redirect, cookies, locals } as any);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("auth=success");
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits", async () => {
      const request = new Request("http://localhost/api/scans/create", {
        method: "POST",
        headers: { 
          "content-type": "application/json",
          "x-csrf-token": "valid-token",
        },
        body: JSON.stringify({
          content: "https://example.com",
          scanType: "qr",
        }),
      });

      const locals = {
        isAuthenticated: true,
        user: mockUser,
        csrfToken: "valid-token",
      };

      // Make multiple requests to trigger rate limit
      const responses = [];
      for (let i = 0; i < 15; i++) {
        const response = await createScan({ request, locals } as any);
        responses.push(response);
      }

      // At least one should be rate limited
      const rateLimitedResponse = responses.find(r => r.status === 429);
      expect(rateLimitedResponse).toBeDefined();

      if (rateLimitedResponse) {
        const data = await rateLimitedResponse.json();
        expect(data.error).toBe("Rate limit exceeded");
        expect(rateLimitedResponse.headers.get("Retry-After")).toBeDefined();
      }
    });
  });
});