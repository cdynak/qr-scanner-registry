import { randomBytes, createHmac } from "crypto";

/**
 * CSRF (Cross-Site Request Forgery) protection utilities
 */

const CSRF_SECRET = process.env.CSRF_SECRET || "default-csrf-secret-change-in-production";
const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_COOKIE_NAME = "csrf-token";

/**
 * Generates a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  const randomToken = randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
  const timestamp = Date.now().toString();
  const payload = `${randomToken}.${timestamp}`;
  
  // Create HMAC signature
  const signature = createHmac("sha256", CSRF_SECRET)
    .update(payload)
    .digest("hex");
  
  return `${payload}.${signature}`;
}

/**
 * Validates a CSRF token
 */
export function validateCSRFToken(token: string): boolean {
  if (!token || typeof token !== "string") {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [randomToken, timestamp, signature] = parts;
  const payload = `${randomToken}.${timestamp}`;
  
  // Verify signature
  const expectedSignature = createHmac("sha256", CSRF_SECRET)
    .update(payload)
    .digest("hex");
  
  if (signature !== expectedSignature) {
    return false;
  }

  // Check token age (valid for 1 hour)
  const tokenTime = parseInt(timestamp, 10);
  const currentTime = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour in milliseconds
  
  if (currentTime - tokenTime > maxAge) {
    return false;
  }

  return true;
}

/**
 * Extracts CSRF token from request headers or body
 */
export function extractCSRFToken(request: Request): string | null {
  // First try header
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (headerToken) {
    return headerToken;
  }

  // For form submissions, token might be in body (not implemented here as we use JSON APIs)
  return null;
}

/**
 * Creates CSRF cookie options
 */
export function getCSRFCookieOptions(isProduction = false) {
  return {
    httpOnly: false, // Client needs to read this for AJAX requests
    secure: isProduction,
    sameSite: "strict" as const,
    maxAge: 3600, // 1 hour
    path: "/",
  };
}

/**
 * Validates CSRF token from request against cookie
 */
export function validateCSRFFromRequest(request: Request, cookieToken?: string): boolean {
  const requestToken = extractCSRFToken(request);
  
  if (!requestToken || !cookieToken) {
    return false;
  }

  // Both tokens must be valid and match
  return validateCSRFToken(requestToken) && 
         validateCSRFToken(cookieToken) && 
         requestToken === cookieToken;
}

/**
 * CSRF protection middleware for API routes
 */
export function requireCSRFProtection(request: Request, csrfCookie?: string): void {
  // Skip CSRF protection in test environment
  if (process.env.NODE_ENV === "test" || process.env.DISABLE_CSRF_IN_TESTS === "true") {
    return;
  }

  // Skip CSRF for GET, HEAD, OPTIONS requests (safe methods)
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(request.method)) {
    return;
  }

  if (!validateCSRFFromRequest(request, csrfCookie)) {
    throw new Error("CSRF token validation failed");
  }
}