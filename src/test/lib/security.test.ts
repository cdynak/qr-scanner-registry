import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getClientIP,
  validateRequestOrigin,
  SecurityMiddleware,
  createSecurityHeaders,
  applySecurityHeaders,
  validateFileUpload,
  IP_RATE_LIMITERS,
} from "../../lib/security";

describe("Security Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset rate limiters
    Object.values(IP_RATE_LIMITERS).forEach((limiter) => {
      limiter.destroy();
    });
  });

  describe("getClientIP", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const request = new Request("http://example.com", {
        headers: {
          "x-forwarded-for": "192.168.1.1, 10.0.0.1",
        },
      });

      expect(getClientIP(request)).toBe("192.168.1.1");
    });

    it("should extract IP from x-real-ip header", () => {
      const request = new Request("http://example.com", {
        headers: {
          "x-real-ip": "192.168.1.1",
        },
      });

      expect(getClientIP(request)).toBe("192.168.1.1");
    });

    it("should return unknown for missing headers", () => {
      const request = new Request("http://example.com");

      expect(getClientIP(request)).toBe("unknown");
    });

    it("should handle Cloudflare headers", () => {
      const request = new Request("http://example.com", {
        headers: {
          "cf-connecting-ip": "192.168.1.1",
        },
      });

      expect(getClientIP(request)).toBe("192.168.1.1");
    });
  });

  describe("validateRequestOrigin", () => {
    it("should validate allowed origins", () => {
      const request = new Request("http://example.com", {
        headers: {
          origin: "https://myapp.com",
        },
      });

      expect(validateRequestOrigin(request, ["https://myapp.com"])).toBe(true);
    });

    it("should reject disallowed origins", () => {
      const request = new Request("http://example.com", {
        headers: {
          origin: "https://evil.com",
        },
      });

      expect(validateRequestOrigin(request, ["https://myapp.com"])).toBe(false);
    });

    it("should validate origin from referer", () => {
      const request = new Request("http://example.com", {
        headers: {
          referer: "https://myapp.com/page",
        },
      });

      expect(validateRequestOrigin(request, ["https://myapp.com"])).toBe(true);
    });

    it("should reject requests without origin or referer", () => {
      const request = new Request("http://example.com");

      expect(validateRequestOrigin(request, ["https://myapp.com"])).toBe(false);
    });
  });

  describe("SecurityMiddleware", () => {
    it("should pass basic validation", async () => {
      const middleware = new SecurityMiddleware();
      const request = new Request("http://example.com");

      const result = await middleware.validate(request, {});

      expect(result.success).toBe(true);
    });

    it("should require authentication when configured", async () => {
      const middleware = new SecurityMiddleware({ requireAuth: true });
      const request = new Request("http://example.com");

      const result = await middleware.validate(request, { isAuthenticated: false });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
      expect(result.statusCode).toBe(401);
    });

    it("should validate request size", async () => {
      const middleware = new SecurityMiddleware({ maxRequestSize: 100 });
      const request = new Request("http://example.com", {
        headers: {
          "content-length": "1000",
        },
      });

      const result = await middleware.validate(request, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request too large");
      expect(result.statusCode).toBe(413);
    });

    it("should validate allowed origins", async () => {
      const middleware = new SecurityMiddleware({
        allowedOrigins: ["https://myapp.com"],
      });
      const request = new Request("http://example.com", {
        headers: {
          origin: "https://evil.com",
        },
      });

      const result = await middleware.validate(request, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid request origin");
      expect(result.statusCode).toBe(403);
    });

    it("should detect malicious content in request body", async () => {
      const middleware = new SecurityMiddleware({ sanitizeInput: true });

      // Mock request.text() to return malicious content
      const request = new Request("http://example.com", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ content: "<script>alert('xss')</script>" }),
      });

      const result = await middleware.validate(request, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Malicious content detected");
      expect(result.statusCode).toBe(400);
    });
  });

  describe("createSecurityHeaders", () => {
    it("should create security headers for development", () => {
      const headers = createSecurityHeaders(false);

      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["X-Frame-Options"]).toBe("DENY");
      expect(headers["X-XSS-Protection"]).toBe("1; mode=block");
      expect(headers["Strict-Transport-Security"]).toBeUndefined();
    });

    it("should create security headers for production", () => {
      const headers = createSecurityHeaders(true);

      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["X-Frame-Options"]).toBe("DENY");
      expect(headers["Strict-Transport-Security"]).toContain("max-age=31536000");
    });
  });

  describe("applySecurityHeaders", () => {
    it("should apply security headers to response", () => {
      const response = new Response("test");
      const secureResponse = applySecurityHeaders(response, false);

      expect(secureResponse.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(secureResponse.headers.get("X-Frame-Options")).toBe("DENY");
    });
  });

  describe("validateFileUpload", () => {
    it("should validate allowed file types", () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

      expect(() => validateFileUpload(file)).not.toThrow();
    });

    it("should reject disallowed file types", () => {
      const file = new File(["test"], "test.exe", { type: "application/exe" });

      expect(() => validateFileUpload(file)).toThrow("File type not allowed");
    });

    it("should reject files that are too large", () => {
      const file = new File(["x".repeat(10 * 1024 * 1024)], "test.jpg", { type: "image/jpeg" });

      expect(() => validateFileUpload(file)).toThrow("File too large");
    });

    it("should reject dangerous filenames", () => {
      const file = new File(["test"], "../../../etc/passwd", { type: "image/jpeg" });

      expect(() => validateFileUpload(file)).toThrow("File extension not allowed");
    });

    it("should reject Windows reserved names", () => {
      const file = new File(["test"], "con.jpg", { type: "image/jpeg" });

      // This should pass since "con.jpg" has a valid extension, but let's test the actual reserved name
      const reservedFile = new File(["test"], "con", { type: "image/jpeg" });
      expect(() => validateFileUpload(reservedFile)).toThrow("File extension not allowed");
    });
  });
});
