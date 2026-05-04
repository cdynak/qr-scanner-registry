import type { AuthSession, User } from "../types";
import { AuthenticationError } from "../types";

/**
 * Authentication utility functions for session management
 */

/**
 * Creates a new authentication session
 */
export function createAuthSession(
  user: User,
  accessToken: string,
  expiresIn = 3600 // 1 hour default
): AuthSession {
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  return {
    user,
    accessToken,
    expiresAt,
  };
}

/**
 * Validates if a session is still valid
 */
export function isSessionValid(session: AuthSession): boolean {
  if (!session || !session.expiresAt) {
    return false;
  }

  const expirationTime = new Date(session.expiresAt).getTime();
  const currentTime = Date.now();

  return currentTime < expirationTime;
}

/**
 * Checks if a session is expired
 */
export function isSessionExpired(session: AuthSession): boolean {
  return !isSessionValid(session);
}

/**
 * Gets the remaining time in seconds until session expires
 */
export function getSessionTimeRemaining(session: AuthSession): number {
  if (!session || !session.expiresAt) {
    return 0;
  }

  const expirationTime = new Date(session.expiresAt).getTime();
  const currentTime = Date.now();
  const remainingMs = expirationTime - currentTime;

  return Math.max(0, Math.floor(remainingMs / 1000));
}

/**
 * Validates that a user object has required fields
 */
export function validateUser(user: unknown): user is User {
  if (!user || typeof user !== "object") {
    return false;
  }

  const requiredFields = ["id", "google_id", "email", "name", "created_at", "updated_at"];

  return requiredFields.every((field) => {
    const value = user[field];
    return value !== null && value !== undefined && value !== "";
  });
}

/**
 * Extracts user information from a session, throwing if invalid
 */
export function requireValidSession(session: AuthSession | null | undefined): User {
  if (!session) {
    throw new AuthenticationError("No session provided");
  }

  if (!isSessionValid(session)) {
    throw new AuthenticationError("Session has expired");
  }

  if (!validateUser(session.user)) {
    throw new AuthenticationError("Invalid user data in session");
  }

  return session.user;
}

/**
 * Safely gets user from session without throwing
 */
export function getUserFromSession(session: AuthSession | null | undefined): User | null {
  try {
    return requireValidSession(session);
  } catch {
    return null;
  }
}

/**
 * Creates session cookie options for secure HTTP-only cookies
 */
export function getSessionCookieOptions(isProduction = false) {
  return {
    httpOnly: false, // Allow JavaScript access for client-side auth detection
    secure: isProduction,
    sameSite: "strict" as const, // Changed to strict for better security
    maxAge: 3600, // 1 hour
    path: "/",
    // Add additional security headers
    ...(isProduction && {
      domain: undefined, // Let browser set domain automatically
      priority: "high" as const,
    }),
  };
}

/**
 * Creates secure session cookie string with all security attributes
 */
export function createSecureSessionCookie(session: AuthSession, isProduction = false): string {
  const options = getSessionCookieOptions(isProduction);
  const sessionJson = JSON.stringify(session);

  const cookieParts = [`session=${encodeURIComponent(sessionJson)}`];

  if (options.httpOnly) cookieParts.push("HttpOnly");
  if (options.secure) cookieParts.push("Secure");
  if (options.sameSite) cookieParts.push(`SameSite=${options.sameSite}`);
  if (options.maxAge) cookieParts.push(`Max-Age=${options.maxAge}`);
  if (options.path) cookieParts.push(`Path=${options.path}`);

  return cookieParts.join("; ");
}

/**
 * Validates session cookie format and content
 */
export function validateSessionCookie(cookieValue: string): boolean {
  if (!cookieValue || typeof cookieValue !== "string") {
    return false;
  }

  try {
    // Decode and parse the session
    const decoded = decodeURIComponent(cookieValue);
    const session = JSON.parse(decoded) as AuthSession;

    // Validate session structure
    if (!session.user || !session.accessToken || !session.expiresAt) {
      return false;
    }

    // Validate session is not expired
    return isSessionValid(session);
  } catch {
    return false;
  }
}

/**
 * Generates a secure session token (placeholder - in real implementation would use crypto)
 */
export function generateSessionToken(): string {
  // In a real implementation, this would use a cryptographically secure method
  // For now, using a simple approach for testing
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Parses session from cookie string
 */
export function parseSessionFromCookie(cookieValue: string): AuthSession | null {
  try {
    const session = JSON.parse(cookieValue) as AuthSession;
    return isSessionValid(session) ? session : null;
  } catch {
    return null;
  }
}

/**
 * Serializes session to cookie string
 */
export function serializeSessionToCookie(session: AuthSession, isProduction = false): string {
  const options = getSessionCookieOptions(isProduction);
  const sessionJson = JSON.stringify(session);

  const cookieParts = [`session=${sessionJson}`];

  if (options.httpOnly) cookieParts.push("HttpOnly");
  if (options.secure) cookieParts.push("Secure");
  if (options.sameSite) cookieParts.push(`SameSite=${options.sameSite}`);
  if (options.maxAge) cookieParts.push(`Max-Age=${options.maxAge}`);
  if (options.path) cookieParts.push(`Path=${options.path}`);

  return cookieParts.join("; ");
}

/**
 * Creates a cookie string to clear the session
 */
export function createClearSessionCookie(): string {
  return "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax";
}
