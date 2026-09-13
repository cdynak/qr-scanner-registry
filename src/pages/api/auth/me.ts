import type { APIRoute } from "astro";
import type { ApiResponse, User } from "../../../types";

/**
 * GET /api/auth/me
 * Returns the currently authenticated user based on the HttpOnly session cookie
 * (parsed by the middleware into `locals`). Returns 401 when not authenticated.
 *
 * This endpoint lets client components learn the auth state without ever
 * reading the session token from JavaScript.
 */
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.isAuthenticated || !locals.user) {
    return new Response(JSON.stringify({ error: "Not authenticated", data: null } as ApiResponse), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data: locals.user as User } as ApiResponse<User>), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
