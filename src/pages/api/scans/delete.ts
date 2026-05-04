import type { APIRoute } from "astro";
import { createServerSupabaseClient } from "../../../db/supabase";
import type { ApiResponse } from "../../../types";
import { createApiErrorResponse, logError, retryWithBackoff } from "../../../lib/errors";
import { SecurityMiddleware, getClientIP } from "../../../lib/security";
import { sanitizeUserInput } from "../../../lib/validation";

/**
 * DELETE /api/scans/delete
 * Deletes a scan record for the authenticated user
 * Expects scan ID in the request body
 */
export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    // Apply security middleware with CSRF protection
    const security = new SecurityMiddleware({
      requireAuth: true,
      requireCSRF: true,
      rateLimitType: "scans",
      ipRateLimitType: "api",
      sanitizeInput: true,
      maxRequestSize: 1024, // 1KB max for delete request
    });

    const securityResult = await security.validate(request, {
      isAuthenticated: locals.isAuthenticated,
      csrfToken: locals.csrfToken,
      locals,
    });

    if (!securityResult.success) {
      const response = new Response(
        JSON.stringify({
          error: securityResult.error,
          message: securityResult.error,
        } as ApiResponse),
        {
          status: securityResult.statusCode || 400,
          headers: { "Content-Type": "application/json" },
        }
      );

      if (securityResult.headers) {
        Object.entries(securityResult.headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }

      return response;
    }

    // Parse request body
    let requestData: unknown;
    try {
      requestData = await request.json();
    } catch (parseError) {
      logError(parseError, {
        route: "/api/scans/delete",
        userId: locals.user.id,
        step: "json_parse",
      });

      return new Response(
        JSON.stringify({
          error: "Invalid JSON",
          message: "Request body must be valid JSON",
        } as ApiResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate and sanitize scan ID
    const { id: rawScanId } = requestData as { id?: unknown };
    if (!rawScanId || typeof rawScanId !== "string") {
      return new Response(
        JSON.stringify({
          error: "Invalid scan ID",
          message: "Scan ID is required and must be a string",
          field: "id",
        } as ApiResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Sanitize the scan ID
    const scanId = sanitizeUserInput(rawScanId, {
      maxLength: 36,
      allowHtml: false,
      allowUrls: false,
    });

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(scanId)) {
      return new Response(
        JSON.stringify({
          error: "Invalid scan ID format",
          message: "Scan ID must be a valid UUID",
          field: "id",
        } as ApiResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Delete scan with retry logic and ownership verification
    const result = await retryWithBackoff(
      async () => {
        const supabase = createServerSupabaseClient();

        // First, verify the scan exists and belongs to the user
        const { data: existingScan, error: fetchError } = await supabase
          .from("scans")
          .select("id, user_id")
          .eq("id", scanId)
          .single();

        if (fetchError) {
          if (fetchError.code === "PGRST116") {
            // No rows returned - scan not found
            throw new Error("SCAN_NOT_FOUND");
          }

          logError(fetchError, {
            route: "/api/scans/delete",
            userId: locals.user.id,
            step: "scan_verification",
            scanId,
          });
          throw new Error("Database verification failed");
        }

        // Verify ownership
        if (existingScan.user_id !== locals.user.id) {
          throw new Error("ACCESS_DENIED");
        }

        // Delete the scan
        const { error: deleteError } = await supabase
          .from("scans")
          .delete()
          .eq("id", scanId)
          .eq("user_id", locals.user.id); // Double-check ownership in the delete query

        if (deleteError) {
          logError(deleteError, {
            route: "/api/scans/delete",
            userId: locals.user.id,
            step: "scan_deletion",
            scanId,
          });
          throw new Error("Database deletion failed");
        }

        return { success: true };
      },
      3,
      1000,
      {
        route: "/api/scans/delete",
        userId: locals.user.id,
        scanId,
        step: "database_operations",
      }
    );

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: "Database error",
          message: "Failed to delete scan record",
        } as ApiResponse),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({
        message: "Scan deleted successfully",
      } as ApiResponse),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message === "SCAN_NOT_FOUND") {
        return new Response(
          JSON.stringify({
            error: "Scan not found",
            message: "The specified scan does not exist",
          } as ApiResponse),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (error.message === "ACCESS_DENIED") {
        return new Response(
          JSON.stringify({
            error: "Access denied",
            message: "You can only delete your own scans",
          } as ApiResponse),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    logError(error, {
      route: "/api/scans/delete",
      userId: locals?.user?.id,
      method: "DELETE",
      clientIP: getClientIP(request),
    });

    const errorResponse = createApiErrorResponse(error);
    return new Response(JSON.stringify(errorResponse), {
      status: errorResponse.statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }
};
