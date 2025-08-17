import { defineMiddleware } from 'astro:middleware';
import type { AuthSession } from '../types';
import { isSessionValid } from '../lib/auth';

/**
 * Astro middleware for handling authentication sessions
 * Parses session cookie and makes user data available to pages
 */
export const onRequest = defineMiddleware(async (context, next) => {
  // Parse session from cookie
  const sessionCookie = context.cookies.get('session');
  let session: AuthSession | null = null;

  if (sessionCookie) {
    try {
      const parsedSession = JSON.parse(sessionCookie.value) as AuthSession;
      
      // Validate session
      if (isSessionValid(parsedSession)) {
        session = parsedSession;
      } else {
        // Clear invalid session cookie
        context.cookies.delete('session', { path: '/' });
      }
    } catch (error) {
      console.error('Error parsing session cookie:', error);
      // Clear malformed session cookie
      context.cookies.delete('session', { path: '/' });
    }
  }

  // Make session available to pages via context.locals
  context.locals.session = session;
  context.locals.user = session?.user || null;
  context.locals.isAuthenticated = !!session;

  return next();
});

// Extend Astro's locals type to include our session data
declare global {
  namespace App {
    interface Locals {
      session: AuthSession | null;
      user: AuthSession['user'] | null;
      isAuthenticated: boolean;
    }
  }
}