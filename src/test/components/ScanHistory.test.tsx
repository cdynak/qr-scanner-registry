import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScanHistory } from "../../components/ScanHistory";
import type { PaginatedResponse, Scan } from "../../types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock scan data
const mockScans: Scan[] = [
  {
    id: "1",
    user_id: "user1",
    content: "https://example.com",
    scan_type: "qr",
    format: "QR_CODE",
    scanned_at: "2024-01-15T10:30:00Z",
    created_at: "2024-01-15T10:30:00Z",
  },
  {
    id: "2",
    user_id: "user1",
    content: "1234567890123",
    scan_type: "barcode",
    format: "EAN_13",
    scanned_at: "2024-01-14T15:45:00Z",
    created_at: "2024-01-14T15:45:00Z",
  },
];

const mockPaginatedResponse: PaginatedResponse<Scan> = {
  data: mockScans,
  pagination: {
    total: 2,
    page: 1,
    limit: 10,
    hasMore: false,
  },
  message: "Scan history retrieved successfully",
};

describe("ScanHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<ScanHistory />);

    expect(screen.getByText("Loading scan history...")).toBeInTheDocument();
  });

  it("renders scan history successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    });

    render(<ScanHistory />);

    await waitFor(() => {
      expect(screen.getByText("https://example.com")).toBeInTheDocument();
    });

    // Check for scan type badges (not the filter options)
    const qrBadge = screen.getByText("QR Code", { selector: "span" });
    const barcodeBadge = screen.getByText("Barcode", { selector: "span" });
    expect(qrBadge).toBeInTheDocument();
    expect(barcodeBadge).toBeInTheDocument();
    expect(screen.getByText("1234567890123")).toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 2 scans")).toBeInTheDocument();
  });

  it("renders empty state when no scans", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        pagination: { total: 0, page: 1, limit: 10, hasMore: false },
        message: "No scans found",
      }),
    });

    render(<ScanHistory />);

    await waitFor(() => {
      expect(screen.getByText("No scans found")).toBeInTheDocument();
    });

    expect(screen.getByText("Start scanning to see your history here")).toBeInTheDocument();
  });

  it("handles API error gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "Failed to fetch scan history",
        message: "Database connection error",
      }),
    });

    render(<ScanHistory />);

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch scan history")).toBeInTheDocument();
    });
  });

  it("handles network error gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<ScanHistory />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("filters scans by type", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    });

    render(<ScanHistory />);

    await waitFor(() => {
      expect(screen.getByText("https://example.com")).toBeInTheDocument();
    });

    // Mock filtered response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [mockScans[0]], // Only QR code
        pagination: { total: 1, page: 1, limit: 10, hasMore: false },
        message: "Filtered results",
      }),
    });

    const typeFilter = screen.getByLabelText("Filter by type");
    fireEvent.change(typeFilter, { target: { value: "qr" } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("scanType=qr"));
    });
  });

  it("filters scans by date range", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    });

    render(<ScanHistory />);

    await waitFor(() => {
      expect(screen.getByText("https://example.com")).toBeInTheDocument();
    });

    // Mock filtered response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [mockScans[0]],
        pagination: { total: 1, page: 1, limit: 10, hasMore: false },
        message: "Filtered results",
      }),
    });

    const startDateFilter = screen.getByLabelText("From date");
    fireEvent.change(startDateFilter, { target: { value: "2024-01-15" } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("startDate=2024-01-15"));
    });
  });

  it("opens delete confirmation dialog", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    });

    render(<ScanHistory />);

    await waitFor(() => {
      expect(screen.getByText("https://example.com")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByText("Delete Scan")).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete this scan/)).toBeInTheDocument();
    // Check for the URL in the dialog message specifically
    expect(
      screen.getByText(/Are you sure you want to delete this scan\? "https:\/\/example\.com"/)
    ).toBeInTheDocument();
  });

  it("cancels delete operation", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    });

    render(<ScanHistory />);

    await waitFor(() => {
      expect(screen.getByText("https://example.com")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    expect(screen.queryByText("Delete Scan")).not.toBeInTheDocument();
  });

  it("deletes scan successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    });

    render(<ScanHistory />);

    await waitFor(() => {
      expect(screen.getByText("https://example.com")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

    // Mock successful delete response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: "Scan deleted successfully",
      }),
    });

    // Find the confirm button in the dialog (destructive variant)
    const allDeleteButtons = screen.getAllByRole("button", { name: "Delete" });
    const dialogDeleteButton = allDeleteButtons.find((button) => button.className.includes("bg-destructive"));
    fireEvent.click(dialogDeleteButton!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/scans/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: "1" }),
      });
    });

    // Dialog should close
    expect(screen.queryByText("Delete Scan")).not.toBeInTheDocument();
  });

  it("handles delete error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    });

    render(<ScanHistory />);

    await waitFor(() => {
      expect(screen.getByText("https://example.com")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

    // Mock delete error response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "Failed to delete scan",
        message: "Database error",
      }),
    });

    // Find the confirm button in the dialog (destructive variant)
    const allDeleteButtons = screen.getAllByRole("button", { name: "Delete" });
    const dialogDeleteButton = allDeleteButtons.find((button) => button.className.includes("bg-destructive"));
    fireEvent.click(dialogDeleteButton!);

    await waitFor(() => {
      expect(screen.getByText("Failed to delete scan")).toBeInTheDocument();
    });
  });

  it("loads more scans when pagination available", async () => {
    const initialResponse: PaginatedResponse<Scan> = {
      data: [mockScans[0]],
      pagination: {
        total: 2,
        page: 1,
        limit: 1,
        hasMore: true,
      },
      message: "Initial results",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => initialResponse,
    });

    render(<ScanHistory />);

    await waitFor(() => {
      expect(screen.getByText("https://example.com")).toBeInTheDocument();
    });

    expect(screen.getByText("Load More")).toBeInTheDocument();

    // Mock load more response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [mockScans[1]],
        pagination: {
          total: 2,
          page: 2,
          limit: 1,
          hasMore: false,
        },
        message: "More results",
      }),
    });

    const loadMoreButton = screen.getByText("Load More");
    fireEvent.click(loadMoreButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("offset=1"));
    });
  });

  it("formats long content with ellipsis", async () => {
    const longContentScan: Scan = {
      ...mockScans[0],
      content: "This is a very long content that should be truncated when displayed in the scan history list",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [longContentScan],
        pagination: { total: 1, page: 1, limit: 10, hasMore: false },
        message: "Long content scan",
      }),
    });

    render(<ScanHistory />);

    await waitFor(() => {
      expect(screen.getByText(/This is a very long content that should be trun.../)).toBeInTheDocument();
    });
  });

  it("displays scan format when available", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    });

    render(<ScanHistory />);

    await waitFor(() => {
      expect(screen.getByText("QR_CODE")).toBeInTheDocument();
      expect(screen.getByText("EAN_13")).toBeInTheDocument();
    });
  });

  it("formats dates correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    });

    render(<ScanHistory />);

    await waitFor(() => {
      // Check that dates are formatted (exact format depends on locale)
      const dateElements = screen.getAllByText(/Scanned.*2024/);
      expect(dateElements.length).toBeGreaterThan(0);
    });
  });

  it("applies custom className", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPaginatedResponse,
    });

    const { container } = render(<ScanHistory className="custom-class" />);

    await waitFor(() => {
      expect(screen.getByText("https://example.com")).toBeInTheDocument();
    });

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("shows empty state message when filters applied", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        pagination: { total: 0, page: 1, limit: 10, hasMore: false },
        message: "No scans found",
      }),
    });

    render(<ScanHistory />);

    await waitFor(() => {
      expect(screen.getByText("No scans found")).toBeInTheDocument();
    });

    // Apply a filter
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        pagination: { total: 0, page: 1, limit: 10, hasMore: false },
        message: "No scans found",
      }),
    });

    const typeFilter = screen.getByLabelText("Filter by type");
    fireEvent.change(typeFilter, { target: { value: "qr" } });

    await waitFor(() => {
      expect(screen.getByText("Try adjusting your filters")).toBeInTheDocument();
    });
  });
});
