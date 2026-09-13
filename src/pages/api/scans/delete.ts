import type { APIRoute } from "astro";
import { createUserScopedClient } from "../../../db/supabase";
import type { ApiResponse } from "../../../types";
import { logError } from "../../../lib/errors";
import { getClientIP } from "../../../lib/security";

/**
 * Builds a JSON Response with the given status.
 */
function jsonResponse(body: ApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * DELETE /api/scans/delete
 * Deletes a scan record owned by the authenticated user.
 * Expects the scan ID in the request body: { id: string }.
 *
 * CSRF protection and rate limiting are enforced by the global middleware;
 * this handler focuses on authentication, input validation and ownership.
 */
export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    // Require an authenticated user (guard clause).
    if (!locals.isAuthenticated || !locals.user) {
      return jsonResponse({ error: "Authentication required", message: "You must be logged in to delete scans" }, 401);
    }

    // Parse the request body. A malformed JSON body is a client error (400);
    // any other failure bubbles up to the unexpected-error handler (500).
    let requestData: unknown;
    try {
      requestData = await request.json();
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        return jsonResponse({ error: "Invalid JSON", message: "Request body must be valid JSON" }, 400);
      }
      throw parseError;
    }

    // Validate the scan ID.
    const { id: scanId } = (requestData ?? {}) as { id?: unknown };
    if (!scanId || typeof scanId !== "string") {
      return jsonResponse(
        { error: "Invalid scan ID", message: "Scan ID is required and must be a string", field: "id" },
        400
      );
    }

    const supabase = createUserScopedClient(locals.session?.accessToken);

    // Verify the scan exists and belongs to the current user.
    const { data: existingScan, error: fetchError } = await supabase
      .from("scans")
      .select("id, user_id")
      .eq("id", scanId)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return jsonResponse({ error: "Scan not found", message: "The specified scan does not exist" }, 404);
      }

      logError(fetchError, {
        route: "/api/scans/delete",
        userId: locals.user.id,
        step: "scan_verification",
        scanId,
      });
      return jsonResponse({ error: "Database error", message: "Failed to verify scan ownership" }, 500);
    }

    if (existingScan.user_id !== locals.user.id) {
      return jsonResponse({ error: "Access denied", message: "You can only delete your own scans" }, 403);
    }

    // Delete the scan, double-checking ownership in the query itself.
    const { error: deleteError } = await supabase.from("scans").delete().eq("id", scanId).eq("user_id", locals.user.id);

    if (deleteError) {
      logError(deleteError, {
        route: "/api/scans/delete",
        userId: locals.user.id,
        step: "scan_deletion",
        scanId,
      });
      return jsonResponse({ error: "Database error", message: "Failed to delete scan record" }, 500);
    }

    return jsonResponse({ message: "Scan deleted successfully" }, 200);
  } catch (error) {
    logError(error, {
      route: "/api/scans/delete",
      userId: locals?.user?.id,
      method: "DELETE",
      clientIP: getClientIP(request),
    });

    return jsonResponse({ error: "Internal server error", message: "An unexpected error occurred" }, 500);
  }
};
