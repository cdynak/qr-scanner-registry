import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../../../pages/api/scans/create";
import type { APIContext } from "astro";
import type { User, ScanCreateRequest } from "../../../types";

// Mock Supabase client
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

const mockSupabaseClient = {
  from: vi.fn(() => ({
    insert: mockInsert,
  })),
};

// Mock the Supabase module
vi.mock("../../../db/supabase", () => ({
  createServerSupabaseClient: () => mockSupabaseClient,
}));

// Mock validation functions
vi.mock("../../../lib/validation", () => ({
  validateScanCreateRequest: vi.fn(),
}));

describe("POST /api/scans/create", () => {
  const mockUser: User = {
    id: "user-123",
    google_id: "123456789",
    email: "test@example.com",
    name: "Test User",
    avatar_url: "https://example.com/avatar.jpg",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  const validScanRequest: ScanCreateRequest = {
    content: "https://example.com",
    scanType: "qr",
    format: "URL",
  };

  let mockContext: Partial<APIContext>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock chain
    mockInsert.mockReturnValue({
      select: mockSelect.mockReturnValue({
        single: mockSingle,
      }),
    });

    mockContext = {
      request: new Request("http://localhost/api/scans/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validScanRequest),
      }),
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

  it("should create a scan successfully for authenticated user", async () => {
    // Mock validation
    const { validateScanCreateRequest } = await import("../../../lib/validation");
    vi.mocked(validateScanCreateRequest).mockReturnValue(validScanRequest);

    // Mock successful database insert
    const mockScan = {
      id: "scan-123",
      user_id: mockUser.id,
      content: validScanRequest.content,
      scan_type: validScanRequest.scanType,
      format: validScanRequest.format,
      scanned_at: "2024-01-01T12:00:00Z",
      created_at: "2024-01-01T12:00:00Z",
    };

    mockSingle.mockResolvedValue({
      data: mockScan,
      error: null,
    });

    const response = await POST(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(201);
    expect(responseData.data).toEqual(mockScan);
    expect(responseData.message).toBe("Scan created successfully");
    expect(validateScanCreateRequest).toHaveBeenCalledWith(validScanRequest);
  });

  it("should return 401 for unauthenticated user", async () => {
    mockContext.locals = {
      isAuthenticated: false,
      user: null,
      session: null,
    };

    const response = await POST(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(401);
    expect(responseData.error).toBe("Authentication required");
    expect(responseData.message).toBe("You must be logged in to create scans");
  });

  it("should return 400 for invalid JSON", async () => {
    mockContext.request = new Request("http://localhost/api/scans/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });

    const response = await POST(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toBe("Invalid JSON");
    expect(responseData.message).toBe("Request body must be valid JSON");
  });

  it("should return 400 for validation errors", async () => {
    const { validateScanCreateRequest } = await import("../../../lib/validation");
    const { ValidationError } = await import("../../../types");

    vi.mocked(validateScanCreateRequest).mockImplementation(() => {
      throw new ValidationError("Content is required", "content");
    });

    const response = await POST(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toBe("Validation failed");
    expect(responseData.message).toBe("Content is required");
    expect(responseData.field).toBe("content");
  });

  it("should return 500 for database errors", async () => {
    const { validateScanCreateRequest } = await import("../../../lib/validation");
    vi.mocked(validateScanCreateRequest).mockReturnValue(validScanRequest);

    // Mock database error
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Database connection failed" },
    });

    const response = await POST(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe("Database error");
    expect(responseData.message).toBe("Failed to save scan record");
  });

  it("should handle unexpected errors gracefully", async () => {
    const { validateScanCreateRequest } = await import("../../../lib/validation");
    vi.mocked(validateScanCreateRequest).mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const response = await POST(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe("Internal server error");
    expect(responseData.message).toBe("An unexpected error occurred");
  });

  it("should pass correct data to database insert", async () => {
    const { validateScanCreateRequest } = await import("../../../lib/validation");
    vi.mocked(validateScanCreateRequest).mockReturnValue(validScanRequest);

    mockSingle.mockResolvedValue({
      data: { id: "scan-123" },
      error: null,
    });

    await POST(mockContext as APIContext);

    expect(mockSupabaseClient.from).toHaveBeenCalledWith("scans");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: mockUser.id,
      content: validScanRequest.content,
      scan_type: validScanRequest.scanType,
      format: validScanRequest.format,
      scanned_at: expect.any(String),
    });
  });

  it("should handle missing format field", async () => {
    const requestWithoutFormat = {
      content: "test content",
      scanType: "barcode" as const,
    };

    mockContext.request = new Request("http://localhost/api/scans/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestWithoutFormat),
    });

    const { validateScanCreateRequest } = await import("../../../lib/validation");
    vi.mocked(validateScanCreateRequest).mockReturnValue(requestWithoutFormat);

    mockSingle.mockResolvedValue({
      data: { id: "scan-123" },
      error: null,
    });

    await POST(mockContext as APIContext);

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: mockUser.id,
      content: requestWithoutFormat.content,
      scan_type: requestWithoutFormat.scanType,
      format: null,
      scanned_at: expect.any(String),
    });
  });
});
