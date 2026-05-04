import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "../../../pages/api/scans/delete";
import type { APIContext } from "astro";
import type { User } from "../../../types";

// Mock Supabase client with proper chaining
const mockSingle = vi.fn();
const mockSelectEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockSelectEq }));

const mockDeleteEq2 = vi.fn();
const mockDeleteEq1 = vi.fn(() => ({ eq: mockDeleteEq2 }));
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq1 }));

const mockSupabaseClient = {
  from: vi.fn((table: string) => {
    if (table === "scans") {
      return {
        select: mockSelect,
        delete: mockDelete,
      };
    }
    return {};
  }),
};

// Mock the Supabase module
vi.mock("../../../db/supabase", () => ({
  createServerSupabaseClient: () => mockSupabaseClient,
}));

describe("DELETE /api/scans/delete", () => {
  const mockUser: User = {
    id: "user-123",
    google_id: "123456789",
    email: "test@example.com",
    name: "Test User",
    avatar_url: "https://example.com/avatar.jpg",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  const mockScanId = "scan-123";
  const deleteRequest = { id: mockScanId };

  let mockContext: Partial<APIContext>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      request: new Request("http://localhost/api/scans/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deleteRequest),
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

  it("should delete a scan successfully for authenticated user", async () => {
    // Mock successful scan fetch (ownership verification)
    mockSingle.mockResolvedValue({
      data: {
        id: mockScanId,
        user_id: mockUser.id,
      },
      error: null,
    });

    // Mock successful delete
    mockDeleteEq2.mockResolvedValue({
      error: null,
    });

    const response = await DELETE(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.message).toBe("Scan deleted successfully");

    // Verify ownership check
    expect(mockSupabaseClient.from).toHaveBeenCalledWith("scans");
    expect(mockSelect).toHaveBeenCalledWith("id, user_id");
    expect(mockSelectEq).toHaveBeenCalledWith("id", mockScanId);

    // Verify delete operation
    expect(mockDeleteEq1).toHaveBeenCalledWith("id", mockScanId);
    expect(mockDeleteEq2).toHaveBeenCalledWith("user_id", mockUser.id);
  });

  it("should return 401 for unauthenticated user", async () => {
    mockContext.locals = {
      isAuthenticated: false,
      user: null,
      session: null,
    };

    const response = await DELETE(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(401);
    expect(responseData.error).toBe("Authentication required");
    expect(responseData.message).toBe("You must be logged in to delete scans");
  });

  it("should return 400 for invalid JSON", async () => {
    mockContext.request = new Request("http://localhost/api/scans/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });

    const response = await DELETE(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toBe("Invalid JSON");
    expect(responseData.message).toBe("Request body must be valid JSON");
  });

  it("should return 400 for missing scan ID", async () => {
    mockContext.request = new Request("http://localhost/api/scans/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // Missing id field
    });

    const response = await DELETE(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toBe("Invalid scan ID");
    expect(responseData.message).toBe("Scan ID is required and must be a string");
    expect(responseData.field).toBe("id");
  });

  it("should return 400 for invalid scan ID type", async () => {
    mockContext.request = new Request("http://localhost/api/scans/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 123 }), // Number instead of string
    });

    const response = await DELETE(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData.error).toBe("Invalid scan ID");
    expect(responseData.message).toBe("Scan ID is required and must be a string");
    expect(responseData.field).toBe("id");
  });

  it("should return 404 for non-existent scan", async () => {
    // Mock scan not found (PGRST116 is Supabase's "no rows returned" error code)
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows returned" },
    });

    const response = await DELETE(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(404);
    expect(responseData.error).toBe("Scan not found");
    expect(responseData.message).toBe("The specified scan does not exist");
  });

  it("should return 403 for scan owned by different user", async () => {
    // Mock scan owned by different user
    mockSingle.mockResolvedValue({
      data: {
        id: mockScanId,
        user_id: "different-user-id",
      },
      error: null,
    });

    const response = await DELETE(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(403);
    expect(responseData.error).toBe("Access denied");
    expect(responseData.message).toBe("You can only delete your own scans");
  });

  it("should return 500 for database error during fetch", async () => {
    // Mock database error during ownership check
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "SOME_ERROR", message: "Database connection failed" },
    });

    const response = await DELETE(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe("Database error");
    expect(responseData.message).toBe("Failed to verify scan ownership");
  });

  it("should return 500 for database error during delete", async () => {
    // Mock successful ownership check
    mockSingle.mockResolvedValue({
      data: {
        id: mockScanId,
        user_id: mockUser.id,
      },
      error: null,
    });

    // Mock database error during delete
    mockDeleteEq2.mockResolvedValue({
      error: { message: "Delete operation failed" },
    });

    const response = await DELETE(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe("Database error");
    expect(responseData.message).toBe("Failed to delete scan record");
  });

  it("should handle unexpected errors gracefully", async () => {
    // Mock unexpected error by making the request parsing fail
    mockContext.request = {
      json: vi.fn().mockRejectedValue(new Error("Unexpected error")),
    } as any;

    const response = await DELETE(mockContext as APIContext);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe("Internal server error");
    expect(responseData.message).toBe("An unexpected error occurred");
  });

  it("should verify ownership with correct parameters", async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: mockScanId,
        user_id: mockUser.id,
      },
      error: null,
    });

    mockDeleteEq2.mockResolvedValue({
      error: null,
    });

    await DELETE(mockContext as APIContext);

    // Verify the ownership check query
    expect(mockSupabaseClient.from).toHaveBeenCalledWith("scans");
    expect(mockSelect).toHaveBeenCalledWith("id, user_id");
    expect(mockSelectEq).toHaveBeenCalledWith("id", mockScanId);
  });

  it("should perform delete with double ownership check", async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: mockScanId,
        user_id: mockUser.id,
      },
      error: null,
    });

    mockDeleteEq2.mockResolvedValue({
      error: null,
    });

    await DELETE(mockContext as APIContext);

    // Verify the delete operation includes both scan ID and user ID for security
    expect(mockDeleteEq1).toHaveBeenCalledWith("id", mockScanId);
    expect(mockDeleteEq2).toHaveBeenCalledWith("user_id", mockUser.id);
  });
});
