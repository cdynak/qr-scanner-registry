import { describe, it, expect, vi, beforeEach } from "vitest";
import { onRequest } from "../../middleware/index";
import type { AuthSession } from "../../types";

// Mock collaborators the middleware depends on so we can focus on session handling.
vi.mock("../../lib/auth", () => ({
  isSessionValid: vi.fn(),
  validateSessionCookie: vi.fn(),
}));

vi.mock("../../db/supabase", () => ({
  createServerSupabaseClient: vi.fn(() => ({})),
}));

vi.mock("../../lib/csrf", () => ({
  generateCSRFToken: vi.fn(() => "csrf-token"),
  getCSRFCookieOptions: vi.fn(() => ({ path: "/" })),
}));

vi.mock("../../lib/security", () => ({
  applySecurityHeaders: vi.fn((response: Response) => response),
  getClientIP: vi.fn(() => "127.0.0.1"),
}));

vi.mock("../../lib/errors", () => ({
  logError: vi.fn(),
  createApiErrorResponse: vi.fn(() => ({ error: "err", statusCode: 500 })),
  setupGlobalErrorHandling: vi.fn(),
}));

interface MockContextOptions {
  cookieValue?: string | null | undefined;
  pathname?: string;
}

/**
 * Builds a mock Astro middleware context with the fields the middleware reads.
 */
function createMockContext(options: MockContextOptions = {}) {
  const { cookieValue, pathname = "/" } = options;

  const cookieStore = new Map<string, { value: string }>();
  const cookies = {
    get: vi.fn((name: string) => (name === "session" ? cookieRecord : cookieStore.get(name))),
    set: vi.fn((name: string, value: string) => cookieStore.set(name, { value })),
    delete: vi.fn(),
  };
  const cookieRecord = cookieValue === undefined ? undefined : cookieValue === null ? null : { value: cookieValue };

  const context = {
    cookies,
    locals: {} as Record<string, unknown>,
    url: new URL(`https://localhost:3000${pathname}`),
    request: new Request(`https://localhost:3000${pathname}`, {
      headers: { "user-agent": "vitest-agent-string" },
    }),
  };

  return context;
}

describe("Authentication Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should set session data when a valid session cookie exists", async () => {
    const { isSessionValid, validateSessionCookie } = await import("../../lib/auth");
    (validateSessionCookie as any).mockReturnValue(true);
    (isSessionValid as any).mockReturnValue(true);

    const mockSession: AuthSession = {
      user: {
        id: "1",
        google_id: "google-123",
        email: "test@example.com",
        name: "Test User",
        avatar_url: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      accessToken: "mock-token",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    const context = createMockContext({ cookieValue: encodeURIComponent(JSON.stringify(mockSession)) });
    const next = vi.fn().mockResolvedValue(new Response("OK"));

    await onRequest(context as any, next);

    expect(context.cookies.get).toHaveBeenCalledWith("session");
    expect(context.locals.session).toEqual(mockSession);
    expect(context.locals.user).toEqual(mockSession.user);
    expect(context.locals.isAuthenticated).toBe(true);
    expect(next).toHaveBeenCalled();
  });

  it("should clear an invalid session cookie and set null values", async () => {
    const { isSessionValid, validateSessionCookie } = await import("../../lib/auth");
    (validateSessionCookie as any).mockReturnValue(true);
    (isSessionValid as any).mockReturnValue(false);

    const invalidSession = {
      user: { id: "1", name: "Test" },
      accessToken: "expired-token",
      expiresAt: "2020-01-01T00:00:00Z",
    };

    const context = createMockContext({ cookieValue: encodeURIComponent(JSON.stringify(invalidSession)) });
    const next = vi.fn().mockResolvedValue(new Response("OK"));

    await onRequest(context as any, next);

    expect(context.cookies.delete).toHaveBeenCalledWith("session", { path: "/" });
    expect(context.locals.session).toBeNull();
    expect(context.locals.user).toBeNull();
    expect(context.locals.isAuthenticated).toBe(false);
    expect(next).toHaveBeenCalled();
  });

  it("should handle a malformed session cookie", async () => {
    const { validateSessionCookie } = await import("../../lib/auth");
    // Malformed cookie fails format validation.
    (validateSessionCookie as any).mockReturnValue(false);

    const context = createMockContext({ cookieValue: "invalid-json" });
    const next = vi.fn().mockResolvedValue(new Response("OK"));

    await onRequest(context as any, next);

    expect(context.cookies.delete).toHaveBeenCalledWith("session", { path: "/" });
    expect(context.locals.session).toBeNull();
    expect(context.locals.user).toBeNull();
    expect(context.locals.isAuthenticated).toBe(false);
    expect(next).toHaveBeenCalled();
  });

  it("should handle a missing session cookie", async () => {
    const context = createMockContext({ cookieValue: undefined });
    const next = vi.fn().mockResolvedValue(new Response("OK"));

    await onRequest(context as any, next);

    expect(context.cookies.get).toHaveBeenCalledWith("session");
    expect(context.locals.session).toBeNull();
    expect(context.locals.user).toBeNull();
    expect(context.locals.isAuthenticated).toBe(false);
    expect(next).toHaveBeenCalled();
  });

  it("should handle a null session cookie value", async () => {
    const context = createMockContext({ cookieValue: null });
    const next = vi.fn().mockResolvedValue(new Response("OK"));

    await onRequest(context as any, next);

    expect(context.cookies.get).toHaveBeenCalledWith("session");
    expect(context.locals.session).toBeNull();
    expect(context.locals.user).toBeNull();
    expect(context.locals.isAuthenticated).toBe(false);
    expect(next).toHaveBeenCalled();
  });

  it("should pass through the response from the next middleware", async () => {
    const { isSessionValid, validateSessionCookie } = await import("../../lib/auth");
    (validateSessionCookie as any).mockReturnValue(true);
    (isSessionValid as any).mockReturnValue(true);

    const mockResponse = new Response("Custom Response", { status: 201 });
    const next = vi.fn().mockResolvedValue(mockResponse);

    const context = createMockContext({
      cookieValue: encodeURIComponent(
        JSON.stringify({
          user: { id: "1", name: "Test" },
          accessToken: "token",
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        })
      ),
    });

    const result = await onRequest(context as any, next);

    expect(result).toBe(mockResponse);
    expect(result.status).toBe(201);
  });
});
