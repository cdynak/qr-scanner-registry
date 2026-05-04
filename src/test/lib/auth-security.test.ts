import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createAuthSession,
  isSessionValid,
  validateSessionCookie,
  createSecureSessionCookie,
  getSessionCookieOptions,
} from "../../lib/auth";
import type { User } from "../../types";

describe("Authentication Security", () => {
  const mockUser: User = {
    id: "user-123",
    google_id: "google-123",
    email: "test@example.com",
    name: "Test User",
    avatar_url: "https://example.com/avatar.jpg",
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAuthSession", () => {
    it("should create a valid session", () => {
      const session = createAuthSession(mockUser, "access-token", 3600);

      expect(session.user).toEqual(mockUser);
      expect(session.accessToken).toBe("access-token");
      expect(session.expiresAt).toBeDefined();
    });

    it("should set correct expiration time", () => {
      const now = Date.now();
      const session = createAuthSession(mockUser, "access-token", 3600);
      const expirationTime = new Date(session.expiresAt).getTime();

      expect(expirationTime).toBeGreaterThan(now);
      expect(expirationTime).toBeLessThan(now + 3700000); // 3600s + buffer
    });
  });

  describe("isSessionValid", () => {
    it("should validate non-expired session", () => {
      const session = createAuthSession(mockUser, "access-token", 3600);

      expect(isSessionValid(session)).toBe(true);
    });

    it("should reject expired session", () => {
      const session = createAuthSession(mockUser, "access-token", -1);

      expect(isSessionValid(session)).toBe(false);
    });

    it("should reject malformed session", () => {
      expect(isSessionValid(null as any)).toBe(false);
      expect(isSessionValid({} as any)).toBe(false);
      expect(isSessionValid({ expiresAt: "invalid" } as any)).toBe(false);
    });
  });

  describe("validateSessionCookie", () => {
    it("should validate properly encoded session cookie", () => {
      const session = createAuthSession(mockUser, "access-token", 3600);
      const cookieValue = encodeURIComponent(JSON.stringify(session));

      expect(validateSessionCookie(cookieValue)).toBe(true);
    });

    it("should reject malformed cookie", () => {
      expect(validateSessionCookie("invalid-json")).toBe(false);
      expect(validateSessionCookie("")).toBe(false);
      expect(validateSessionCookie(null as any)).toBe(false);
    });

    it("should reject expired session in cookie", () => {
      const expiredSession = createAuthSession(mockUser, "access-token", -1);
      const cookieValue = encodeURIComponent(JSON.stringify(expiredSession));

      expect(validateSessionCookie(cookieValue)).toBe(false);
    });

    it("should reject incomplete session data", () => {
      const incompleteSession = { user: mockUser }; // Missing accessToken and expiresAt
      const cookieValue = encodeURIComponent(JSON.stringify(incompleteSession));

      expect(validateSessionCookie(cookieValue)).toBe(false);
    });
  });

  describe("createSecureSessionCookie", () => {
    it("should create secure cookie string for production", () => {
      const session = createAuthSession(mockUser, "access-token", 3600);
      const cookieString = createSecureSessionCookie(session, true);

      expect(cookieString).toContain("HttpOnly");
      expect(cookieString).toContain("Secure");
      expect(cookieString).toContain("SameSite=strict");
      expect(cookieString).toContain("Max-Age=3600");
      expect(cookieString).toContain("Path=/");
    });

    it("should create cookie string for development", () => {
      const session = createAuthSession(mockUser, "access-token", 3600);
      const cookieString = createSecureSessionCookie(session, false);

      expect(cookieString).toContain("HttpOnly");
      expect(cookieString).not.toContain("Secure");
      expect(cookieString).toContain("SameSite=strict");
    });

    it("should properly encode session data", () => {
      const session = createAuthSession(mockUser, "access-token", 3600);
      const cookieString = createSecureSessionCookie(session, false);

      // Extract the session value from the cookie string
      const sessionMatch = cookieString.match(/session=([^;]+)/);
      expect(sessionMatch).toBeTruthy();

      const decodedSession = JSON.parse(decodeURIComponent(sessionMatch![1]));
      expect(decodedSession.user.email).toBe(mockUser.email);
    });
  });

  describe("getSessionCookieOptions", () => {
    it("should return secure options for production", () => {
      const options = getSessionCookieOptions(true);

      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe("strict");
      expect(options.maxAge).toBe(3600);
      expect(options.path).toBe("/");
    });

    it("should return development options", () => {
      const options = getSessionCookieOptions(false);

      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(false);
      expect(options.sameSite).toBe("strict");
    });
  });

  describe("Session Security Edge Cases", () => {
    it("should handle session with special characters in user data", () => {
      const userWithSpecialChars: User = {
        ...mockUser,
        name: "Test User <script>alert('xss')</script>",
        email: "test+special@example.com",
      };

      const session = createAuthSession(userWithSpecialChars, "access-token", 3600);
      const cookieString = createSecureSessionCookie(session, false);

      expect(cookieString).toBeDefined();
      expect(cookieString).toContain("session=");
    });

    it("should handle very long session data", () => {
      const userWithLongData: User = {
        ...mockUser,
        name: "x".repeat(1000),
      };

      const session = createAuthSession(userWithLongData, "access-token", 3600);
      const cookieString = createSecureSessionCookie(session, false);

      expect(cookieString).toBeDefined();
    });

    it("should validate session with missing user fields", () => {
      const incompleteUser = {
        id: "user-123",
        // Missing required fields
      } as User;

      const session = createAuthSession(incompleteUser, "access-token", 3600);
      const cookieValue = encodeURIComponent(JSON.stringify(session));

      // The session should still be considered valid structurally,
      // but user validation would happen at a higher level
      expect(validateSessionCookie(cookieValue)).toBe(true);
    });
  });
});
