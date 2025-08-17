import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScanResult } from "../../components/ScanResult";
import type { ScanCreateRequest } from "../../types";

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

// Mock window.open
Object.defineProperty(window, "open", {
  value: vi.fn(),
  writable: true,
});

describe("ScanResult", () => {
  const mockOnSave = vi.fn();
  const mockOnRescan = vi.fn();
  const mockOnClose = vi.fn();

  const defaultProps = {
    content: "https://example.com",
    scanType: "qr" as const,
    format: "URL",
    onSave: mockOnSave,
    onRescan: mockOnRescan,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders scan result with content and type", () => {
    render(<ScanResult {...defaultProps} />);

    expect(screen.getByText("QR Code Scanned")).toBeInTheDocument();
    expect(screen.getByText("Format: URL")).toBeInTheDocument();
    expect(screen.getByText("https://example.com")).toBeInTheDocument();
  });

  it("renders barcode scan result correctly", () => {
    render(<ScanResult {...defaultProps} content="1234567890123" scanType="barcode" format="EAN-13" />);

    expect(screen.getByText("Barcode Scanned")).toBeInTheDocument();
    expect(screen.getByText("Format: EAN-13")).toBeInTheDocument();
    expect(screen.getByText("1234567890123")).toBeInTheDocument();
  });

  it("renders without format when not provided", () => {
    render(<ScanResult {...defaultProps} format={undefined} />);

    expect(screen.getByText("QR Code Scanned")).toBeInTheDocument();
    expect(screen.queryByText(/Format:/)).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    render(<ScanResult {...defaultProps} />);

    const closeButton = screen.getByLabelText("Close");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onRescan when scan again button is clicked", () => {
    render(<ScanResult {...defaultProps} />);

    const rescanButton = screen.getByText("Scan Again");
    fireEvent.click(rescanButton);

    expect(mockOnRescan).toHaveBeenCalled();
  });

  it("copies content to clipboard when copy button is clicked", async () => {
    const mockWriteText = vi.mocked(navigator.clipboard.writeText);
    mockWriteText.mockResolvedValue();

    render(<ScanResult {...defaultProps} />);

    const copyButton = screen.getByText("Copy");
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("https://example.com");
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });

    // Check that the copied state resets after timeout
    await waitFor(
      () => {
        expect(screen.getByText("Copy")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("handles clipboard copy failure gracefully", async () => {
    const mockWriteText = vi.mocked(navigator.clipboard.writeText);
    mockWriteText.mockRejectedValue(new Error("Clipboard not available"));

    render(<ScanResult {...defaultProps} />);

    const copyButton = screen.getByText("Copy");
    fireEvent.click(copyButton);

    await waitFor(() => {
      // Should not show "Copied!" on failure
      expect(screen.queryByText("Copied!")).not.toBeInTheDocument();
      expect(screen.getByText("Copy")).toBeInTheDocument();
    });
  });

  it("shows open button for URL content", () => {
    render(<ScanResult {...defaultProps} />);

    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("does not show open button for non-URL content", () => {
    render(<ScanResult {...defaultProps} content="Some text content" format="Text" />);

    expect(screen.queryByText("Open")).not.toBeInTheDocument();
  });

  it("opens URL in new tab when open button is clicked", () => {
    const mockOpen = vi.mocked(window.open);

    render(<ScanResult {...defaultProps} />);

    const openButton = screen.getByText("Open");
    fireEvent.click(openButton);

    expect(mockOpen).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");
  });

  it("saves scan data when save button is clicked", async () => {
    mockOnSave.mockResolvedValue();

    render(<ScanResult {...defaultProps} />);

    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    expect(screen.getByText("Saving...")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        content: "https://example.com",
        scanType: "qr",
        format: "URL",
      });
      expect(screen.getByText("Saved")).toBeInTheDocument();
    });
  });

  it("handles save error and shows retry option", async () => {
    mockOnSave.mockRejectedValue(new Error("Network error"));

    render(<ScanResult {...defaultProps} />);

    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
      expect(screen.getByText("Try again")).toBeInTheDocument();
    });

    // Test retry functionality
    mockOnSave.mockResolvedValue();
    const retryButton = screen.getByText("Try again");
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(2);
    });
  });

  it("disables save button when already saved", async () => {
    mockOnSave.mockResolvedValue();

    render(<ScanResult {...defaultProps} />);

    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText("Saved")).toBeInTheDocument();
    });

    // Button should be disabled after saving
    const savedButton = screen.getByText("Saved").closest("button");
    expect(savedButton).toBeDisabled();
  });

  it("disables save button while saving", () => {
    mockOnSave.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<ScanResult {...defaultProps} />);

    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    expect(screen.getByText("Saving...")).toBeInTheDocument();
    const savingButton = screen.getByText("Saving...").closest("button");
    expect(savingButton).toBeDisabled();
  });

  it("handles long content with scrollable area", () => {
    const longContent = "A".repeat(1000);

    render(<ScanResult {...defaultProps} content={longContent} />);

    const contentElement = screen.getByText(longContent);
    expect(contentElement).toBeInTheDocument();

    // Check that the content is in a scrollable container
    const scrollableContainer = contentElement.closest(".overflow-y-auto");
    expect(scrollableContainer).toBeInTheDocument();
  });

  it("identifies URLs correctly", () => {
    const urlCases = ["https://example.com", "http://example.com", "https://subdomain.example.com/path?query=value"];

    urlCases.forEach((url) => {
      const { unmount } = render(<ScanResult {...defaultProps} content={url} />);

      expect(screen.getByText("Open")).toBeInTheDocument();
      unmount();
    });
  });

  it("does not identify non-URLs as URLs", () => {
    const nonUrlCases = ["just some text", "1234567890", "plain text content"];

    nonUrlCases.forEach((content) => {
      const { unmount } = render(<ScanResult {...defaultProps} content={content} />);

      expect(screen.queryByText("Open")).not.toBeInTheDocument();
      unmount();
    });
  });
});
