import type { APIRoute } from "astro";
import { createUserScopedClient } from "../../../db/supabase";
import { validatePaginationParams, validateDateString } from "../../../lib/validation";
import { ValidationError } from "../../../types";
import type { ApiResponse, PaginatedResponse, Scan, ScanHistoryFilters } from "../../../types";
import { logError } from "../../../lib/errors";

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
 * GET /api/scans/list
 * Retrieves scan history for the authenticated user with optional filtering and pagination.
 * Rate limiting is enforced by the global middleware.
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // Require an authenticated user (guard clause).
    if (!locals.isAuthenticated || !locals.user) {
      return jsonResponse(
        { error: "Authentication required", message: "You must be logged in to view scan history" } as ApiResponse,
        401
      );
    }

    const searchParams = new URL(request.url).searchParams;

    // Validate pagination parameters.
    let paginationParams: { limit: number; offset: number };
    try {
      paginationParams = validatePaginationParams({
        limit: searchParams.get("limit") ? parseInt(searchParams.get("limit") || "0") : undefined,
        offset: searchParams.get("offset") ? parseInt(searchParams.get("offset") || "0") : undefined,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return jsonResponse(
          { error: "Invalid pagination parameters", message: error.message, field: error.field } as ApiResponse,
          400
        );
      }
      throw error;
    }

    const filters: ScanHistoryFilters = {
      scanType: searchParams.get("scanType") as "qr" | "barcode" | undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      limit: paginationParams.limit,
      offset: paginationParams.offset,
    };

    // Validate scan type filter.
    if (filters.scanType && !["qr", "barcode"].includes(filters.scanType)) {
      return jsonResponse(
        {
          error: "Invalid scan type",
          message: 'Scan type must be "qr" or "barcode"',
          field: "scanType",
        } as ApiResponse,
        400
      );
    }

    // Validate date filters.
    try {
      if (filters.startDate) {
        validateDateString(filters.startDate, "startDate");
      }
      if (filters.endDate) {
        validateDateString(filters.endDate, "endDate");
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        return jsonResponse(
          { error: "Invalid date format", message: error.message, field: error.field } as ApiResponse,
          400
        );
      }
      throw error;
    }

    // Build and execute the query as the current user (RLS enforces ownership).
    const supabase = createUserScopedClient(locals.session?.accessToken);

    let query = supabase
      .from("scans")
      .select("*", { count: "exact" })
      .eq("user_id", locals.user.id)
      .order("scanned_at", { ascending: false });

    if (filters.scanType) {
      query = query.eq("scan_type", filters.scanType);
    }
    if (filters.startDate) {
      query = query.gte("scanned_at", filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte("scanned_at", filters.endDate);
    }

    query = query.range(filters.offset, filters.offset + filters.limit - 1);

    const { data: scans, error: queryError, count } = await query;

    if (queryError) {
      logError(queryError, {
        route: "/api/scans/list",
        userId: locals.user.id,
        step: "database_query",
        filters,
      });
      return jsonResponse({ error: "Database error", message: "Failed to retrieve scan history" } as ApiResponse, 500);
    }

    const total = count || 0;
    const page = Math.floor(filters.offset / filters.limit) + 1;
    const hasMore = filters.offset + filters.limit < total;

    return jsonResponse(
      {
        data: scans || [],
        pagination: { total, page, limit: filters.limit, hasMore },
        message: "Scan history retrieved successfully",
      } as PaginatedResponse<Scan>,
      200
    );
  } catch (error) {
    logError(error, {
      route: "/api/scans/list",
      userId: locals?.user?.id,
      method: "GET",
    });
    return jsonResponse(
      { error: "Internal server error", message: "An unexpected error occurred" } as ApiResponse,
      500
    );
  }
};
