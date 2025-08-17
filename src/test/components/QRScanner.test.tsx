import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QRScanner } from "../../components/QRScanner";

// Mock react-qr-barcode-scanner
vi.mock("react-qr-barcode-scanner", () => ({
  BarcodeScannerComponent: vi.fn(({ onUpdate, ...props }: any) => (
    <div data-testid="barcode-scanner" {...props}>
      <button data-testid="mock-scan-success" onClick={() => onUpdate(null, { getText: () => "https://example.com" })}>
        Mock Scan Success
      </button>
      <button data-testid="mock-scan-error" onClick={() => onUpdate(new Error("Scan failed"), null)}>
        Mock Scan Error
      </button>
    </div>
  )),
}));

// Mock CameraPermissions component
vi.mock("../../components/CameraPermissions", () => ({
  CameraPermissions: vi.fn(({ onPermissionGranted, onPermissionDenied }: any) => (
    <div data-testid="camera-permissions">
      <button onClick={onPermissionGranted}>Grant Permission</button>
      <button onClick={onPermissionDenied}>Deny Permission</button>
    </div>
  )),
}));

// Mock ScanResult component
vi.mock("../../components/ScanResult", () => ({
  ScanResult: vi.fn(({ content, scanType, format, onSave, onRescan, onClose }: unknown) => (
    <div data-testid="scan-result">
      <div>Content: {content}</div>
      <div>Type: {scanType}</div>
      <div>Format: {format}</div>
      <button onClick={onRescan}>Rescan</button>
      <button onClick={onClose}>Close</button>
      <button onClick={() => onSave({ content, scanType, format })}>Save</button>
    </div>
  )),
}));

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
Object.defineProperty(global.navigator, "mediaDevices", {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

// Mock fetch for API calls
global.fetch = vi.fn();

describe("QRScanner", () => {
  const mockOnScanSaved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserMedia.mockResolvedValue({
      getVideoTracks: () => [
        {
          getCapabilities: () => ({ torch: true }),
          applyConstraints: vi.fn(),
          stop: vi.fn(),
        },
      ],
      getTracks: () => [
        {
          stop: vi.fn(),
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders camera permissions component when permission not granted", () => {
    render(<QRScanner onScanSaved={mockOnScanSaved} />);
    expect(screen.getByTestId("camera-permissions")).toBeInTheDocument();
  });

  it("shows scanner interface after permission is granted", async () => {
    render(<QRScanner onScanSaved={mockOnScanSaved} />);
    fireEvent.click(screen.getByText("Grant Permission"));

    await waitFor(() => {
      expect(screen.getByText("QR & Barcode Scanner")).toBeInTheDocument();
      expect(screen.getByText("Start Scanning")).toBeInTheDocument();
    });
  });

  it("starts scanning when start button is clicked", async () => {
    render(<QRScanner onScanSaved={mockOnScanSaved} />);
    fireEvent.click(screen.getByText("Grant Permission"));

    await waitFor(() => {
      fireEvent.click(screen.getByText("Start Scanning"));
    });

    await waitFor(() => {
      expect(screen.getByText("Scanning...")).toBeInTheDocument();
      expect(screen.getByTestId("barcode-scanner")).toBeInTheDocument();
    });
  });

  it("handles successful scan and shows result", async () => {
    render(<QRScanner onScanSaved={mockOnScanSaved} />);
    fireEvent.click(screen.getByText("Grant Permission"));

    await waitFor(() => {
      fireEvent.click(screen.getByText("Start Scanning"));
    });

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("mock-scan-success"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("scan-result")).toBeInTheDocument();
      expect(screen.getByText("Content: https://example.com")).toBeInTheDocument();
    });
  });

  it("handles scan errors gracefully", async () => {
    render(<QRScanner onScanSaved={mockOnScanSaved} />);
    fireEvent.click(screen.getByText("Grant Permission"));

    await waitFor(() => {
      fireEvent.click(screen.getByText("Start Scanning"));
    });

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("mock-scan-error"));
    });

    await waitFor(() => {
      expect(screen.getByText("Scanning failed. Please try again or check your camera.")).toBeInTheDocument();
    });
  });

  it("saves scan data successfully", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "123", success: true }),
    } as Response);

    render(<QRScanner onScanSaved={mockOnScanSaved} />);
    fireEvent.click(screen.getByText("Grant Permission"));

    await waitFor(() => {
      fireEvent.click(screen.getByText("Start Scanning"));
    });

    await waitFor(() => {
      fireEvent.click(screen.getByTestId("mock-scan-success"));
    });

    await waitFor(() => {
      fireEvent.click(screen.getByText("Save"));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/scans/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "https://example.com",
          scanType: "qr",
          format: "URL",
        }),
      });
    });
  });
});
