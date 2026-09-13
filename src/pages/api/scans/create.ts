import type { APIRoute } from "astro";
import { createUserScopedClient } from "../../../db/supabase";
import { validateScanCreateRequest } from "../../../lib/validation";
import type { ApiResponse, Scan } from "../../../types";
import { ValidationError } from "../../../types";
import { logError } from "../../../lib/errors";
import { getClientIP } from "../../../lib/security";

/**
 * Builds a JSON Response with the given status.
 */
function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/scans/create
 * Creates a new scan record for the authenticated user.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  // Require an authenticated user (guard clause).
  const userId = locals.user?.id;
  if (!userId) {
    return jsonResponse({ error: "Authentication required", message: "You must be logged in to create scans" }, 401);
  }

  // Parse and validate the request body.
  let validatedScan;
  try {
    let requestData: unknown;
    try {
      requestData = await request.json();
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        return jsonResponse({ error: "Invalid JSON", message: "Request body must be valid JSON" }, 400);
      }
      throw parseError;
    }

    validatedScan = validateScanCreateRequest(requestData);
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse({ error: "Validation failed", message: error.message, field: error.field }, 400);
    }

    logError(error, {
      route: "/api/scans/create",
      userId,
      method: "POST",
      clientIP: getClientIP(request),
    });
    return jsonResponse({ error: "Internal server error", message: "An unexpected error occurred" }, 500);
  }

  // Persist to the database as the current user (RLS enforces ownership).
  try {
    const supabase = createUserScopedClient(locals.session?.accessToken);

    const { data, error: insertError } = await supabase
      .from("scans")
      .insert({
        user_id: userId,
        content: validatedScan.content,
        scan_type: validatedScan.scanType,
        format: validatedScan.format || null,
        scanned_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      logError(new Error(`Database insert failed: ${insertError.message}`), {
        route: "/api/scans/create",
        userId,
        step: "database_operations",
      });
      return jsonResponse({ error: "Database error", message: "Failed to save scan record" }, 500);
    }

    return jsonResponse({ data, message: "Scan created successfully" } as ApiResponse<Scan>, 201);
  } catch (error) {
    logError(error, {
      route: "/api/scans/create",
      userId,
      method: "POST",
      clientIP: getClientIP(request),
    });
    return jsonResponse({ error: "Internal server error", message: "An unexpected error occurred" }, 500);
  }
};
