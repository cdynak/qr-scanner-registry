import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateCSRFToken,
  validateCSRFToken,
  extractCSRFToken,
  validateCSRFFromRequest,
  requireCSRFProtection,
} from "../../lib/csrf";

describe("CSRF Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateCSRFToken", () => {
    it("should generate a valid CSRF token", () => {
      const token = generateCSRFToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should generate unique tokens", () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe("validateCSRFToken", () => {
    it("should validate a valid token", () => {
      const token = generateCSRFToken();
      
      expect(validateCSRFToken(token)).toBe(true);
    });

    it("should reject invalid token format", () => {
      expect(validateCSRFToken("invalid")).toBe(false);
      expect(validateCSRFToken("")).toBe(false);
      expect(validateCSRFToken("a.b")).toBe(false);
    });

    it("should reject null or undefined tokens", () => {
      expect(validateCSRFToken(null as any)).toBe(false);
      expect(validateCSRFToken(undefined as any)).toBe(false);
    });

    it("should reject tokens with invalid signature", () => {
      const token = generateCSRFToken();
      const parts = token.split(".");
      const tamperedToken = `${parts[0]}.${parts[1]}.invalid_signature`;
      
      expect(validateCSRFToken(tamperedToken)).toBe(false);
    });

    it("should reject expired tokens", () => {
      // Mock Date.now to create an old token
      const originalNow = Date.now;
      const oldTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
      
      vi.spyOn(Date, "now").mockReturnValue(oldTime);
      const oldToken = generateCSRFToken();
      
      // Restore current time
      Date.now = originalNow;
      
      expect(validateCSRFToken(oldToken)).toBe(false);
    });
  });

  describe("extractCSRFToken", () => {
    it("should extract token from header", () => {
      const token = "test-token";
      const request = new Request("http://example.com", {
        headers: {
          "x-csrf-token": token,
        },
      });

      expect(extractCSRFToken(request)).toBe(token);
    });

    it("should return null if no token found", () => {
      const request = new Request("http://example.com");

      expect(extractCSRFToken(request)).toBeNull();
    });
  });

  describe("validateCSRFFromRequest", () => {
    it("should validate matching tokens", () => {
      const token = generateCSRFToken();
      const request = new Request("http://example.com", {
        method: "POST",
        headers: {
          "x-csrf-token": token,
        },
      });

      expect(validateCSRFFromRequest(request, token)).toBe(true);
    });

    it("should reject mismatched tokens", () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      const request = new Request("http://example.com", {
        method: "POST",
        headers: {
          "x-csrf-token": token1,
        },
      });

      expect(validateCSRFFromRequest(request, token2)).toBe(false);
    });

    it("should reject missing tokens", () => {
      const request = new Request("http://example.com", {
        method: "POST",
      });

      expect(validateCSRFFromRequest(request, undefined)).toBe(false);
    });
  });

  describe("requireCSRFProtection", () => {
    it("should pass for safe methods", () => {
      const request = new Request("http://example.com", { method: "GET" });
      
      expect(() => requireCSRFProtection(request)).not.toThrow();
    });

    it("should require CSRF for unsafe methods", () => {
      const request = new Request("http://example.com", { method: "POST" });
      
      expect(() => requireCSRFProtection(request)).toThrow("CSRF token validation failed");
    });

    it("should pass with valid CSRF token", () => {
      const token = generateCSRFToken();
      const request = new Request("http://example.com", {
        method: "POST",
        headers: {
          "x-csrf-token": token,
        },
      });
      
      expect(() => requireCSRFProtection(request, token)).not.toThrow();
    });
  });
});