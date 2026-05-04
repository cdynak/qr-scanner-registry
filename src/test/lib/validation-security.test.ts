import { describe, it, expect } from "vitest";
import {
  sanitizeString,
  sanitizeHtml,
  sanitizeUrl,
  containsSQLInjection,
  containsXSS,
  sanitizeUserInput,
} from "../../lib/validation";
import { ValidationError } from "../../types";

describe("Security-focused Validation", () => {
  describe("sanitizeHtml", () => {
    it("should remove script tags", () => {
      const input = '<p>Hello</p><script>alert("xss")</script>';
      const result = sanitizeHtml(input);

      expect(result).toBe("<p>Hello</p>");
    });

    it("should remove event handlers", () => {
      const input = "<div onclick=\"alert('xss')\">Click me</div>";
      const result = sanitizeHtml(input);

      expect(result).not.toContain("onclick");
      expect(result).toContain("Click me");
    });

    it("should remove javascript: URLs", () => {
      const input = "<a href=\"javascript:alert('xss')\">Link</a>";
      const result = sanitizeHtml(input);

      expect(result).toBe("<a href=\"alert('xss')\">Link</a>");
    });

    it("should remove dangerous tags", () => {
      const input = '<iframe src="evil.com"></iframe><p>Safe content</p>';
      const result = sanitizeHtml(input);

      expect(result).toBe("<p>Safe content</p>");
    });

    it("should handle empty or non-string input", () => {
      expect(sanitizeHtml("")).toBe("");
      expect(sanitizeHtml(null as any)).toBe("");
      expect(sanitizeHtml(undefined as any)).toBe("");
    });
  });

  describe("sanitizeUrl", () => {
    it("should allow safe URLs", () => {
      expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
      expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
      expect(sanitizeUrl("mailto:test@example.com")).toBe("mailto:test@example.com");
    });

    it("should block dangerous protocols", () => {
      expect(sanitizeUrl("javascript:alert('xss')")).toBe("");
      expect(sanitizeUrl("data:text/html,<script>alert('xss')</script>")).toBe("");
      expect(sanitizeUrl("vbscript:msgbox('xss')")).toBe("");
      expect(sanitizeUrl("file:///etc/passwd")).toBe("");
    });

    it("should handle invalid input", () => {
      expect(sanitizeUrl("")).toBe("");
      expect(sanitizeUrl("not-a-url")).toBe("");
      expect(sanitizeUrl(null as any)).toBe("");
    });
  });

  describe("containsSQLInjection", () => {
    it("should detect SQL injection patterns", () => {
      expect(containsSQLInjection("'; DROP TABLE users; --")).toBe(true);
      expect(containsSQLInjection("1 OR 1=1")).toBe(true);
      expect(containsSQLInjection("UNION SELECT * FROM passwords")).toBe(true);
      expect(containsSQLInjection("/* comment */ SELECT")).toBe(true);
    });

    it("should allow safe content", () => {
      expect(containsSQLInjection("Hello world")).toBe(false);
      expect(containsSQLInjection("user@example.com")).toBe(false);
      expect(containsSQLInjection("Normal text content")).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(containsSQLInjection("")).toBe(false);
      expect(containsSQLInjection(null as any)).toBe(false);
      expect(containsSQLInjection(undefined as any)).toBe(false);
    });
  });

  describe("containsXSS", () => {
    it("should detect XSS patterns", () => {
      expect(containsXSS("<script>alert('xss')</script>")).toBe(true);
      expect(containsXSS("javascript:alert('xss')")).toBe(true);
      expect(containsXSS("<img onload=\"alert('xss')\">")).toBe(true);
      expect(containsXSS("<iframe src='evil.com'></iframe>")).toBe(true);
      expect(containsXSS("data:text/html,<script>alert('xss')</script>")).toBe(true);
    });

    it("should allow safe content", () => {
      expect(containsXSS("Hello world")).toBe(false);
      expect(containsXSS("<p>Safe HTML</p>")).toBe(false);
      expect(containsXSS("https://example.com")).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(containsXSS("")).toBe(false);
      expect(containsXSS(null as any)).toBe(false);
      expect(containsXSS(undefined as any)).toBe(false);
    });
  });

  describe("sanitizeUserInput", () => {
    it("should sanitize normal input", () => {
      const input = "  Hello World  ";
      const result = sanitizeUserInput(input);

      expect(result).toBe("Hello World");
    });

    it("should escape HTML by default", () => {
      const input = "<p>Hello world</p>";
      const result = sanitizeUserInput(input);

      expect(result).toContain("&lt;p&gt;");
    });

    it("should allow HTML when configured", () => {
      const input = "<p>Hello</p>";
      const result = sanitizeUserInput(input, { allowHtml: true });

      expect(result).toBe("<p>Hello</p>");
    });

    it("should enforce length limits", () => {
      const input = "x".repeat(1000);

      expect(() => sanitizeUserInput(input, { maxLength: 100 })).toThrow(ValidationError);
    });

    it("should detect malicious content", () => {
      expect(() => sanitizeUserInput("'; DROP TABLE users; --")).toThrow(ValidationError);
      expect(() => sanitizeUserInput("<script>alert('xss')</script>")).toThrow(ValidationError);
    });

    it("should handle URLs", () => {
      const input = "Check out https://example.com";
      const result = sanitizeUserInput(input, { allowUrls: true });

      expect(result).toContain("https://example.com");
    });

    it("should sanitize dangerous URLs", () => {
      const input = "Click https://safe-example.com";
      const result = sanitizeUserInput(input, { allowUrls: true });

      expect(result).toContain("https://safe-example.com");
    });

    it("should handle non-string input", () => {
      expect(sanitizeUserInput(null as any)).toBe("");
      expect(sanitizeUserInput(undefined as any)).toBe("");
      expect(sanitizeUserInput(123 as unknown)).toBe("");
    });
  });
});
