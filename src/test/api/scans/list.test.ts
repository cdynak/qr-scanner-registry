import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../../../pages/api/scans/list";
import type { APIContext } from "astro";
import type { User, Scan } from "../../../types";

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              range: vi.fn(),
            })),
          })),
          lte: vi.fn(() => ({
            range: vi.fn(),
          })),
          range: vi.fn(),
        })),
      })),
    })),
  })),
};

// Mock the Supabase module
vi.mock("../../../db/supabase", () => ({
  createServerSupabaseClient: () => mockSupabaseClient,
}));

// Mock validation functions
vi.mock("../../../lib/validation", () => ({
  validatePaginationParams: vi.fn(),
  validateDateString: vi.fn(),
}));

describe("GET /api/scans/list", () => {
  const mockUser: User = {
    id: "user-123",
    google_id: "123456789",
    email: "test@example.com",
    name: "Test User",
    avatar_url: "https://example.com/avatar.jpg",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  const mockScans: Scan[] = [
    {
      id: "scan-1",
      user_id: mockUser.id,
      content: "https://example.com",
      scan_type: "qr",
      format: "URL",
      scanned_at: "2024-01-01T12:00:00Z",
      created_at: "2024-01-01T12:00:00Z",
    },
    {
      id: "scan-2",
      user_id: mockUser.id,
      content: "1234567890",
      scan_type: "barcode",
      format: "EAN-13",
      scanned_at: "2024-01-01T11:00:00Z",
      created_at: "2024-01-01T11:00:00Z",
    },
  ];

  let mockContext: Partial<APIContext>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      request: new Request("http://localhost/api/scans/list"),
      locals: {
        isAuthenticated: true,
        user: mockUser,
        session: {
          user: mockUser,
          accessToken: "token",
          expiresAt: "2024-12-31T23:59:59Z",
        },
      },
    };
  });

  it("should return scan history with default pagination", async () => {
    const { validatePaginationParams } = await import("../../../lib/validation");
    vi.mocked(validatePaginationParams).mockReturnValue({ limit: 20, offset: 0 });

    // Mock successful database query
    const mockQueryChain = {
      range: vi.fn().mockResolvedValue({
        data: mockScans,
        error: null,
        count: 2,
      }),
    };

    mockSupabaseClient.from().select().eq().order.mockReturnValue(mockQueryChain);

    const response = await GET(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.data).toEqual(mockScans);
    expect(responseData.pagination).toEqual({
      total: 2,
      page: 1,
      limit: 20,
      hasMore: false,
    });
    expect(responseData.message).toBe("Scan history retrieved successfully");
  });

  it("should return 401 for unauthenticated user", async () => {
    mockContext.locals = {
      isAuthenticated: false,
      user: null,
      session: null,
    };

    const response = await GET(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(401);
    expect(responseData.error).toBe("Authentication required");
    expect(responseData.message).toBe("You must be logged in to view scan history");
  });

  it("should handle pagination parameters", async () => {
    mockContext.request = new Request("http://localhost/api/scans/list?limit=10&offset=20");

    const { validatePaginationParams } = await import("../../../lib/validation");
    vi.mocked(validatePaginationParams).mockReturnValue({ limit: 10, offset: 20 });

    const mockQueryChain = {
      range: vi.fn().mockResolvedValue({
        data: mockScans,
        error: null,
        count: 50,
      }),
    };

    mockSupabaseClient.from().select().eq().order.mockReturnValue(mockQueryChain);

    const response = await GET(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.pagination).toEqual({
      total: 50,
      page: 3, // (20 / 10) + 1
      limit: 10,
      hasMore: true, // 20 + 10 < 50
    });
    expect(mockQueryChain.range).toHaveBeenCalledWith(20, 29); // offset to offset + limit - 1
  });

  it("should handle scan type filter", async () => {
    mockContext.request = new Request("http://localhost/api/scans/list?scanType=qr");

    const { validatePaginationParams } = await import("../../../lib/validation");
    vi.mocked(validatePaginationParams).mockReturnValue({ limit: 20, offset: 0 });

    const mockQueryChain = {
      eq: vi.fn(() => ({
        range: vi.fn().mockResolvedValue({
          data: [mockScans[0]], // Only QR scans
          error: null,
          count: 1,
        }),
      })),
    };

    mockSupabaseClient.from().select().eq().order.mockReturnValue(mockQueryChain);

    const response = await GET(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.data).toEqual([mockScans[0]]);
    expect(mockQueryChain.eq).toHaveBeenCalledWith("scan_type", "qr");
  });

  it("should handle date range filters", async () => {
    mockContext.request = new Request("http://localhost/api/scans/list?startDate=2024-01-01&endDate=2024-01-31");

    const { validatePaginationParams, validateDateString } = await import("../../../lib/validation");
    vi.mocked(validatePaginationParams).mockReturnValue({ limit: 20, offset: 0 });
    vi.mocked(validateDateString).mockImplementation(() => {}); // No validation errors

    const mockQueryChain = {
      gte: vi.fn(() => ({
        lte: vi.fn(() => ({
          range: vi.fn().mockResolvedValue({
            data: mockScans,
            error: null,
            count: 2,
          }),
        })),
      })),
    };

    mockSupabaseClient.from().select().eq().order.mockReturnValue(mockQueryChain);

    const response = await GET(mockContext as APIContext);

    expect(response.status).toBe(200);
    expect(mockQueryChain.gte).toHaveBeenCalledWith("scanned_at", "2024-01-01");
    expect(mockQueryChain.gte().lte).toHaveBeenCalledWith("scanned_at", "2024-01-31");
    expect(validateDateString).toHaveBeenCalledWith("2024-01-01", "startDate");
    expect(validateDateString).toHaveBeenCalledWith("2024-01-31", "endDate");
  });

  it("should return 400 for invalid pagination parameters", async () => {
    mockContext.request = new Request("http://localhost/api/scans/list?limit=invalid");

    const { validatePaginationParams } = await import("../../../lib/validation");
    const { ValidationError } = await import("../../../types");

    vi.mocked(validatePaginationParams).mockImplementation(() => {
      throw new ValidationError("Limit must be an integer between 1 and 100", "limit");
    });

    const response = await GET(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toBe("Invalid pagination parameters");
    expect(responseData.message).toBe("Limit must be an integer between 1 and 100");
    expect(responseData.field).toBe("limit");
  });

  it("should return 400 for invalid scan type", async () => {
    mockContext.request = new Request("http://localhost/api/scans/list?scanType=invalid");

    const { validatePaginationParams } = await import("../../../lib/validation");
    vi.mocked(validatePaginationParams).mockReturnValue({ limit: 20, offset: 0 });

    const response = await GET(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toBe("Invalid scan type");
    expect(responseData.message).toBe('Scan type must be "qr" or "barcode"');
    expect(responseData.field).toBe("scanType");
  });

  it("should return 400 for invalid date format", async () => {
    mockContext.request = new Request("http://localhost/api/scans/list?startDate=invalid-date");

    const { validatePaginationParams, validateDateString } = await import("../../../lib/validation");
    const { ValidationError } = await import("../../../types");

    vi.mocked(validatePaginationParams).mockReturnValue({ limit: 20, offset: 0 });
    vi.mocked(validateDateString).mockImplementation(() => {
      throw new ValidationError("startDate must be a valid ISO date string", "startDate");
    });

    const response = await GET(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toBe("Invalid date format");
    expect(responseData.message).toBe("startDate must be a valid ISO date string");
    expect(responseData.field).toBe("startDate");
  });

  it("should return 500 for database errors", async () => {
    const { validatePaginationParams } = await import("../../../lib/validation");
    vi.mocked(validatePaginationParams).mockReturnValue({ limit: 20, offset: 0 });

    const mockQueryChain = {
      range: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
        count: null,
      }),
    };

    mockSupabaseClient.from().select().eq().order.mockReturnValue(mockQueryChain);

    const response = await GET(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe("Database error");
    expect(responseData.message).toBe("Failed to retrieve scan history");
  });

  it("should handle empty results", async () => {
    const { validatePaginationParams } = await import("../../../lib/validation");
    vi.mocked(validatePaginationParams).mockReturnValue({ limit: 20, offset: 0 });

    const mockQueryChain = {
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    };

    mockSupabaseClient.from().select().eq().order.mockReturnValue(mockQueryChain);

    const response = await GET(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.data).toEqual([]);
    expect(responseData.pagination).toEqual({
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    });
  });

  it("should handle unexpected errors gracefully", async () => {
    const { validatePaginationParams } = await import("../../../lib/validation");
    vi.mocked(validatePaginationParams).mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const response = await GET(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe("Internal server error");
    expect(responseData.message).toBe("An unexpected error occurred");
  });
});
