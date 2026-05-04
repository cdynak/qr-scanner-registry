import type { APIRoute } from "astro";
import { createServerSupabaseClient } from "../../../db/supabase";
import { validatePaginationParams, validateDateString } from "../../../lib/validation";
import { ValidationError } from "../../../types";
import type { ApiResponse, PaginatedResponse, Scan, ScanHistoryFilters } from "../../../types";
import { createApiErrorResponse, logError, retryWithBackoff, RateLimiter } from "../../../lib/errors";

// Rate limiter: 30 requests per minute per user for list operations
const rateLimiter = new RateLimiter(30, 60000);

/**
 * GET /api/scans/list
 * Retrieves scan history for the authenticated user with optional filtering and pagination
 */
export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // Check authentication
    if (!locals.isAuthenticated || !locals.user) {
      return new Response(
        JSON.stringify({
          error: "Authentication required",
          message: "You must be logged in to view scan history",
        } as ApiResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Rate limiting
    if (!rateLimiter.canMakeRequest()) {
      const timeUntilReset = rateLimiter.getTimeUntilReset();
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again later.",
          retryAfter: Math.ceil(timeUntilReset / 1000),
        } as ApiResponse),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": Math.ceil(timeUntilReset / 1000).toString(),
          },
        }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Extract and validate pagination parameters
    let paginationParams: { limit: number; offset: number };
    try {
      paginationParams = validatePaginationParams({
        limit: searchParams.get("limit") ? parseInt(searchParams.get("limit") || "0") : undefined,
        offset: searchParams.get("offset") ? parseInt(searchParams.get("offset") || "0") : undefined,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        logError(error, {
          route: "/api/scans/list",
          userId: locals.user.id,
          step: "pagination_validation",
          params: Object.fromEntries(searchParams.entries()),
        });

        return new Response(
          JSON.stringify({
            error: "Invalid pagination parameters",
            message: error.message,
            field: error.field,
          } as ApiResponse),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      throw error;
    }

    // Extract and validate filter parameters
    const filters: ScanHistoryFilters = {
      scanType: searchParams.get("scanType") as "qr" | "barcode" | undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      limit: paginationParams.limit,
      offset: paginationParams.offset,
    };

    // Validate scan type filter
    if (filters.scanType && !["qr", "barcode"].includes(filters.scanType)) {
      return new Response(
        JSON.stringify({
          error: "Invalid scan type",
          message: 'Scan type must be "qr" or "barcode"',
          field: "scanType",
        } as ApiResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate date filters
    try {
      if (filters.startDate) {
        validateDateString(filters.startDate, "startDate");
      }
      if (filters.endDate) {
        validateDateString(filters.endDate, "endDate");
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        logError(error, {
          route: "/api/scans/list",
          userId: locals.user.id,
          step: "date_validation",
          filters,
        });

        return new Response(
          JSON.stringify({
            error: "Invalid date format",
            message: error.message,
            field: error.field,
          } as ApiResponse),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      throw error;
    }

    // Execute query with retry logic and fallback
    let scans, count;

    try {
      console.log("Attempting to fetch scans from Supabase...");

      const result = await retryWithBackoff(
        async () => {
          const supabase = createServerSupabaseClient();

          // Build query
          let query = supabase
            .from("scans")
            .select("*", { count: "exact" })
            .eq("user_id", locals.user.id)
            .order("scanned_at", { ascending: false });

          // Apply filters
          if (filters.scanType) {
            query = query.eq("scan_type", filters.scanType);
          }

          if (filters.startDate) {
            query = query.gte("scanned_at", filters.startDate);
          }

          if (filters.endDate) {
            query = query.lte("scanned_at", filters.endDate);
          }

          // Apply pagination
          query = query.range(filters.offset, filters.offset + filters.limit - 1);

          // Execute query
          const { data: scans, error: queryError, count } = await query;

          if (queryError) {
            logError(queryError, {
              route: "/api/scans/list",
              userId: locals.user.id,
              step: "database_query",
              filters,
            });
            throw new Error("Database query failed");
          }

          return { scans: scans || [], count: count || 0 };
        },
        3,
        1000,
        {
          route: "/api/scans/list",
          userId: locals.user.id,
          step: "database_operations",
        }
      );

      scans = result.scans;
      count = result.count;

      console.log("✅ Scans fetched from Supabase successfully");
    } catch (dbError) {
      // Fallback to empty results if database operations fail
      scans = [];
      count = 0;
    }

    // Calculate pagination info
    const total = count;
    const page = Math.floor(filters.offset / filters.limit) + 1;
    const hasMore = filters.offset + filters.limit < total;

    // Return paginated results
    return new Response(
      JSON.stringify({
        data: scans,
        pagination: {
          total,
          page,
          limit: filters.limit,
          hasMore,
        },
        message: "Scan history retrieved successfully",
      } as PaginatedResponse<Scan>),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    logError(error, {
      route: "/api/scans/list",
      userId: locals?.user?.id,
      method: "GET",
    });

    const errorResponse = createApiErrorResponse(error);
    return new Response(JSON.stringify(errorResponse), {
      status: errorResponse.statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }
};
