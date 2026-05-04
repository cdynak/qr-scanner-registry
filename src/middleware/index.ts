import { defineMiddleware } from "astro:middleware";
import type { AuthSession } from "../types";
import { isSessionValid, validateSessionCookie } from "../lib/auth";
import { logError, createApiErrorResponse, setupGlobalErrorHandling } from "../lib/errors";
import { generateCSRFToken, getCSRFCookieOptions } from "../lib/csrf";
import { applySecurityHeaders, getClientIP } from "../lib/security";
import { createServerSupabaseClient } from "../db/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// Setup global error handling
setupGlobalErrorHandling();

/**
 * Astro middleware for handling authentication sessions, CSRF protection, and security headers
 * Parses session cookie and makes user data available to pages
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const isProduction = import.meta.env.PROD;

  try {
    // Add security context
    context.locals.clientIP = getClientIP(context.request);
    context.locals.requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    context.locals.requestStartTime = Date.now();

    // Add Supabase client to context
    context.locals.supabase = createServerSupabaseClient();

    // Parse session from cookie
    const sessionCookie = context.cookies.get("session");
    let session: AuthSession | null = null;

    if (sessionCookie) {
      try {
        // Enhanced session validation
        if (validateSessionCookie(sessionCookie.value)) {
          const parsedSession = JSON.parse(decodeURIComponent(sessionCookie.value)) as AuthSession;

          if (isSessionValid(parsedSession)) {
            session = parsedSession;
          } else {
            // Clear invalid session cookie
            context.cookies.delete("session", { path: "/" });
            logError(new Error("Invalid session detected"), {
              middleware: "auth",
              step: "session_validation",
              sessionExpired: true,
              clientIP: context.locals.clientIP,
            });
          }
        } else {
          // Clear malformed session cookie
          context.cookies.delete("session", { path: "/" });
          logError(new Error("Malformed session cookie"), {
            middleware: "auth",
            step: "session_validation",
            clientIP: context.locals.clientIP,
          });
        }
      } catch (parseError) {
        logError(parseError, {
          middleware: "auth",
          step: "session_parsing",
          cookieValue: sessionCookie.value.substring(0, 50) + "...", // Log partial value for debugging
          clientIP: context.locals.clientIP,
        });

        // Clear malformed session cookie
        context.cookies.delete("session", { path: "/" });
      }
    }

    // Make session available to pages via context.locals
    context.locals.session = session;
    context.locals.user = session?.user || null;
    context.locals.isAuthenticated = !!session;

    // Handle CSRF token for non-API routes
    let csrfToken: string | undefined;
    if (!context.url.pathname.startsWith("/api/")) {
      const existingCSRFCookie = context.cookies.get("csrf-token");

      if (!existingCSRFCookie) {
        // Generate new CSRF token
        csrfToken = generateCSRFToken();
        const cookieOptions = getCSRFCookieOptions(isProduction);

        context.cookies.set("csrf-token", csrfToken, cookieOptions);
      } else {
        csrfToken = existingCSRFCookie.value;
      }

      context.locals.csrfToken = csrfToken;
    } else {
      // For API routes, get CSRF token from cookie
      const csrfCookie = context.cookies.get("csrf-token");
      context.locals.csrfToken = csrfCookie?.value;
    }

    const response = await next();

    // Apply security headers to all responses
    const secureResponse = applySecurityHeaders(response, isProduction);

    // Log request completion and performance monitoring
    const duration = Date.now() - context.locals.requestStartTime;

    // Log slow requests
    if (duration > 5000) {
      logError(new Error("Slow request detected"), {
        middleware: "performance",
        requestId: context.locals.requestId,
        duration,
        url: context.url.pathname,
        method: context.request.method,
        clientIP: context.locals.clientIP,
        userAgent: context.request.headers.get("user-agent"),
      });
    }

    // Log suspicious activity
    const userAgent = context.request.headers.get("user-agent");
    if (!userAgent || userAgent.length < 10) {
      logError(new Error("Suspicious request - missing or short user agent"), {
        middleware: "security",
        requestId: context.locals.requestId,
        url: context.url.pathname,
        method: context.request.method,
        clientIP: context.locals.clientIP,
        userAgent,
      });
    }

    return secureResponse;
  } catch (error) {
    // Handle middleware errors
    logError(error, {
      middleware: "global",
      url: context.url.pathname,
      method: context.request.method,
      userAgent: context.request.headers.get("user-agent"),
      clientIP: context.locals?.clientIP,
      requestId: context.locals?.requestId,
    });

    // For API routes, return JSON error response with security headers
    if (context.url.pathname.startsWith("/api/")) {
      const errorResponse = createApiErrorResponse(error);
      const response = new Response(JSON.stringify(errorResponse), {
        status: errorResponse.statusCode,
        headers: { "Content-Type": "application/json" },
      });

      return applySecurityHeaders(response, isProduction);
    }

    // For regular pages, let Astro handle the error
    throw error;
  }
});

// Extend Astro's locals type to include our session data, security context, and error handling context
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace App {
    interface Locals {
      session: AuthSession | null;
      user: AuthSession["user"] | null;
      isAuthenticated: boolean;
      requestId: string;
      requestStartTime: number;
      clientIP: string;
      csrfToken?: string;
      supabase: SupabaseClient;
    }
  }
}
