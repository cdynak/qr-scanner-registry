import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as createScan } from "../../pages/api/scans/create";
import { DELETE as deleteScan } from "../../pages/api/scans/delete";
import { onRequest } from "../../middleware/index";
import { generateCSRFToken } from "../../lib/csrf";
import type { User } from "../../types";

// Mock the Supabase client used by the routes.
vi.mock("../../db/supabase", () => {
  const makeClient = () => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({ data: mockScan, error: null })),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: { id: mockScan.id, user_id: mockUser.id }, error: null })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
      })),
    })),
  });
  return {
    createServerSupabaseClient: vi.fn(makeClient),
    createUserScopedClient: vi.fn(makeClient),
  };
});

// Middleware collaborators.
vi.mock("../../lib/security", async () => {
  const actual = await vi.importActual<typeof import("../../lib/security")>("../../lib/security");
  return {
    ...actual,
    applySecurityHeaders: (response: Response) => response,
  };
});

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
  id: "550e8400-e29b-41d4-a716-446655440000",
  user_id: "user-123",
  content: "https://example.com",
  scan_type: "qr",
  format: "QR_CODE",
  scanned_at: "2023-01-01T00:00:00Z",
  created_at: "2023-01-01T00:00:00Z",
};

/** Minimal middleware context factory. */
function middlewareContext(
  method: string,
  pathname: string,
  headers: Record<string, string> = {},
  cookieMap: Record<string, string> = {}
) {
  return {
    url: new URL(`https://localhost:3000${pathname}`),
    request: new Request(`https://localhost:3000${pathname}`, {
      method,
      headers: { "user-agent": "vitest-agent", ...headers },
    }),
    cookies: {
      get: vi.fn((name: string) => (cookieMap[name] ? { value: cookieMap[name] } : undefined)),
      set: vi.fn(),
      delete: vi.fn(),
    },
    locals: {} as Record<string, unknown>,
  };
}

describe("API Security Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Scan route authorization (route layer)", () => {
    it("should reject unauthenticated create requests with 401", async () => {
      const request = new Request("http://localhost/api/scans/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "https://example.com", scanType: "qr" }),
      });
      const locals = { isAuthenticated: false, user: null };

      const response = await createScan({ request, locals } as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Authentication required");
    });

    it("should reject unauthenticated delete requests with 401", async () => {
      const request = new Request("http://localhost/api/scans/delete", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: mockScan.id }),
      });
      const locals = { isAuthenticated: false, user: null };

      const response = await deleteScan({ request, locals } as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Authentication required");
    });

    it("should create a scan for an authenticated user with valid input", async () => {
      const request = new Request("http://localhost/api/scans/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "https://example.com", scanType: "qr", format: "QR_CODE" }),
      });
      const locals = { isAuthenticated: true, user: mockUser };

      const response = await createScan({ request, locals } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toBeDefined();
    });
  });

  describe("CSRF protection (middleware layer)", () => {
    it("should reject unsafe API requests without a CSRF token", async () => {
      const context = middlewareContext("POST", "/api/scans/create");
      const next = vi.fn().mockResolvedValue(new Response("OK"));

      const response = await onRequest(context as any, next);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("CSRF token validation failed");
      expect(next).not.toHaveBeenCalled();
    });

    it("should allow unsafe API requests with a matching CSRF token", async () => {
      const token = generateCSRFToken();
      const context = middlewareContext(
        "POST",
        "/api/scans/create",
        { "x-csrf-token": token },
        { "csrf-token": token }
      );
      const next = vi.fn().mockResolvedValue(new Response("OK", { status: 201 }));

      const response = await onRequest(context as any, next);

      expect(next).toHaveBeenCalled();
      expect(response.status).toBe(201);
    });

    it("should not require CSRF for the OAuth callback (top-level redirect)", async () => {
      const context = middlewareContext("POST", "/api/auth/google");
      const next = vi.fn().mockResolvedValue(new Response("OK"));

      const response = await onRequest(context as any, next);

      expect(next).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("should not require CSRF for safe API methods", async () => {
      const context = middlewareContext("GET", "/api/scans/list");
      const next = vi.fn().mockResolvedValue(new Response("OK"));

      const response = await onRequest(context as any, next);

      expect(next).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe("Scan deletion validation (route layer)", () => {
    it("should reject a missing scan ID with 400", async () => {
      const request = new Request("http://localhost/api/scans/delete", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const locals = { isAuthenticated: true, user: mockUser };

      const response = await deleteScan({ request, locals } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid scan ID");
    });
  });
});
