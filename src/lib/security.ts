import { RateLimiter } from "./errors";
import { generateCSRFToken, validateCSRFFromRequest, getCSRFCookieOptions } from "./csrf";
import { sanitizeUserInput, containsSQLInjection, containsXSS } from "./validation";

/**
 * Security utilities and middleware for the application
 */

/**
 * Security headers for API responses
 */
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.supabase.co https://accounts.google.com;",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=()",
} as const;

/**
 * Rate limiters for different endpoints
 */
export const RATE_LIMITERS = {
  auth: new RateLimiter(5, 60000), // 5 requests per minute for auth
  scans: new RateLimiter(10, 60000), // 10 requests per minute for scans
  general: new RateLimiter(30, 60000), // 30 requests per minute for general API
} as const;

/**
 * IP-based rate limiting (simple in-memory implementation)
 */
class IPRateLimiter {
  private ipLimiters = new Map<string, RateLimiter>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private maxRequests: number,
    private windowMs: number,
    private cleanupIntervalMs = 300000 // 5 minutes
  ) {
    // Cleanup old entries periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  canMakeRequest(ip: string): boolean {
    if (!this.ipLimiters.has(ip)) {
      this.ipLimiters.set(ip, new RateLimiter(this.maxRequests, this.windowMs));
    }

    const limiter = this.ipLimiters.get(ip)!;
    return limiter.canMakeRequest();
  }

  getTimeUntilReset(ip: string): number {
    const limiter = this.ipLimiters.get(ip);
    return limiter ? limiter.getTimeUntilReset() : 0;
  }

  private cleanup(): void {
    // Remove limiters that haven't been used recently
    const now = Date.now();
    for (const [ip, limiter] of this.ipLimiters.entries()) {
      if (limiter.getTimeUntilReset() === 0) {
        this.ipLimiters.delete(ip);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.ipLimiters.clear();
  }
}

// Global IP rate limiters
export const IP_RATE_LIMITERS = {
  auth: new IPRateLimiter(10, 60000), // 10 auth requests per minute per IP
  api: new IPRateLimiter(100, 60000), // 100 API requests per minute per IP
  general: new IPRateLimiter(200, 60000), // 200 general requests per minute per IP
} as const;

/**
 * Extracts client IP from request
 */
export function getClientIP(request: Request): string {
  // Check various headers for the real IP
  const headers = [
    "x-forwarded-for",
    "x-real-ip",
    "x-client-ip",
    "cf-connecting-ip", // Cloudflare
    "x-forwarded",
    "forwarded-for",
    "forwarded",
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // Take the first IP if there are multiple
      const ip = value.split(",")[0].trim();
      if (ip && ip !== "unknown") {
        return ip;
      }
    }
  }

  // Fallback to a default value
  return "unknown";
}

/**
 * Validates request origin for CSRF protection
 */
export function validateRequestOrigin(request: Request, allowedOrigins: string[]): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // For same-origin requests, origin might be null
  if (!origin && !referer) {
    return false;
  }

  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  if (!requestOrigin) {
    return false;
  }

  return allowedOrigins.includes(requestOrigin);
}

/**
 * Security middleware for API routes
 */
export interface SecurityMiddlewareOptions {
  requireAuth?: boolean;
  requireCSRF?: boolean;
  rateLimitType?: keyof typeof RATE_LIMITERS;
  ipRateLimitType?: keyof typeof IP_RATE_LIMITERS;
  allowedOrigins?: string[];
  sanitizeInput?: boolean;
  maxRequestSize?: number;
}

export class SecurityMiddleware {
  constructor(private options: SecurityMiddlewareOptions = {}) {}

  async validate(
    request: Request,
    context: {
      isAuthenticated?: boolean;
      csrfToken?: string;
      locals?: unknown;
    }
  ): Promise<{
    success: boolean;
    error?: string;
    statusCode?: number;
    headers?: Record<string, string>;
  }> {
    const {
      requireAuth = false,
      requireCSRF = false,
      rateLimitType = "general",
      ipRateLimitType = "general",
      allowedOrigins = [],
      sanitizeInput = true,
      maxRequestSize = 1024 * 1024, // 1MB default
    } = this.options;

    // Check authentication
    if (requireAuth && !context.isAuthenticated) {
      return {
        success: false,
        error: "Authentication required",
        statusCode: 401,
      };
    }

    // Check request size
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > maxRequestSize) {
      return {
        success: false,
        error: "Request too large",
        statusCode: 413,
      };
    }

    // IP-based rate limiting
    const clientIP = getClientIP(request);
    const ipLimiter = IP_RATE_LIMITERS[ipRateLimitType];
    if (!ipLimiter.canMakeRequest(clientIP)) {
      const retryAfter = Math.ceil(ipLimiter.getTimeUntilReset(clientIP) / 1000);
      return {
        success: false,
        error: "Rate limit exceeded",
        statusCode: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
        },
      };
    }

    // User-based rate limiting
    const rateLimiter = RATE_LIMITERS[rateLimitType];
    if (!rateLimiter.canMakeRequest()) {
      const retryAfter = Math.ceil(rateLimiter.getTimeUntilReset() / 1000);
      return {
        success: false,
        error: "Rate limit exceeded",
        statusCode: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
        },
      };
    }

    // CSRF protection
    if (requireCSRF && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      if (!validateCSRFFromRequest(request, context.csrfToken)) {
        return {
          success: false,
          error: "CSRF token validation failed",
          statusCode: 403,
        };
      }
    }

    // Origin validation
    if (allowedOrigins.length > 0) {
      if (!validateRequestOrigin(request, allowedOrigins)) {
        return {
          success: false,
          error: "Invalid request origin",
          statusCode: 403,
        };
      }
    }

    // Input sanitization (for POST/PUT requests)
    if (sanitizeInput && ["POST", "PUT", "PATCH"].includes(request.method)) {
      try {
        const contentType = request.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const body = await request.text();

          // Check for malicious patterns
          if (containsSQLInjection(body) || containsXSS(body)) {
            return {
              success: false,
              error: "Malicious content detected",
              statusCode: 400,
            };
          }
        }
      } catch (error) {
        return {
          success: false,
          error: "Invalid request body",
          statusCode: 400,
        };
      }
    }

    return { success: true };
  }
}

/**
 * Creates security headers for responses
 */
export function createSecurityHeaders(isProduction = false): Record<string, string> {
  const headers = { ...SECURITY_HEADERS };

  if (isProduction) {
    // Add production-specific headers
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
  } else {
    // Remove HSTS in development
    delete headers["Strict-Transport-Security"];
  }

  return headers;
}

/**
 * Applies security headers to a response
 */
export function applySecurityHeaders(response: Response, isProduction = false): Response {
  const headers = createSecurityHeaders(isProduction);

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}

/**
 * Creates a CSRF token and sets it as a cookie
 */
export function setupCSRFProtection(response: Response, isProduction = false): string {
  const token = generateCSRFToken();
  const cookieOptions = getCSRFCookieOptions(isProduction);

  const cookieParts = [`csrf-token=${token}`];
  if (cookieOptions.secure) cookieParts.push("Secure");
  if (cookieOptions.sameSite) cookieParts.push(`SameSite=${cookieOptions.sameSite}`);
  if (cookieOptions.maxAge) cookieParts.push(`Max-Age=${cookieOptions.maxAge}`);
  if (cookieOptions.path) cookieParts.push(`Path=${cookieOptions.path}`);

  response.headers.set("Set-Cookie", cookieParts.join("; "));

  return token;
}

/**
 * Validates file upload security
 */
export function validateFileUpload(
  file: File,
  options: {
    maxSize?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): void {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"],
    allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  } = options;

  // Check file size
  if (file.size > maxSize) {
    throw new Error(`File too large. Maximum size is ${maxSize} bytes`);
  }

  // Check MIME type
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`File type not allowed. Allowed types: ${allowedTypes.join(", ")}`);
  }

  // Check file extension
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
  if (!allowedExtensions.includes(extension)) {
    throw new Error(`File extension not allowed. Allowed extensions: ${allowedExtensions.join(", ")}`);
  }

  // Check for potentially malicious filenames
  const dangerousPatterns = [
    /\.\./, // Directory traversal
    /[<>:"|?*]/, // Invalid filename characters
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
  ];

  if (dangerousPatterns.some((pattern) => pattern.test(file.name))) {
    throw new Error("Invalid filename");
  }
}
