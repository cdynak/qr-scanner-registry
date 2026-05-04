import React, { useState, useCallback, useRef, useEffect } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner/dist/BarcodeScanner.js";
import { AlertCircle, Camera, Zap, ZapOff, RefreshCw } from "lucide-react";
import { CameraPermissions } from "./CameraPermissions";
import { ScanResult } from "./ScanResult";
import type { ScanCreateRequest } from "../types";
import { NetworkError, logError, retryWithBackoff } from "../lib/errors";

interface QRScannerProps {
  onScanSaved?: (scanData: ScanCreateRequest) => void;
  className?: string;
}

interface ScanData {
  content: string;
  scanType: "qr" | "barcode";
  format?: string;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanSaved, className = "" }) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const scannerRef = useRef<unknown>(null);

  // Check torch support when camera is ready
  useEffect(() => {
    if (hasPermission && isScanning) {
      checkTorchSupport();
    }
  }, [hasPermission, isScanning]);

  const checkTorchSupport = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();

      if ("torch" in capabilities) {
        setTorchSupported(true);
      }

      // Clean up the test stream
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      logError(err, { component: "QRScanner", step: "torch_support_check" });
      setTorchSupported(false);
    }
  };

  const handlePermissionGranted = useCallback(() => {
    setHasPermission(true);
    setError(null);
    setRetryCount(0);
  }, []);

  const handlePermissionDenied = useCallback(() => {
    setHasPermission(false);
    setError("Camera permission is required to scan QR codes and barcodes");
  }, []);

  const handleStartScanning = useCallback(() => {
    setIsScanning(true);
    setScanResult(null);
    setError(null);
    setRetryCount(0);
  }, []);

  const handleStopScanning = useCallback(() => {
    setIsScanning(false);
    setTorchEnabled(false);
  }, []);

  const handleScanSuccess = useCallback((result: string) => {
    if (!result || result.trim() === "") {
      return;
    }

    try {
      // Determine scan type based on content patterns
      const scanType = determineScanType(result);
      const format = determineScanFormat(result, scanType);

      setScanResult({
        content: result.trim(),
        scanType,
        format,
      });

      setIsScanning(false);
      setTorchEnabled(false);
      setError(null);
      setRetryCount(0);
    } catch (err) {
      logError(err, {
        component: "QRScanner",
        step: "scan_processing",
        result,
      });
      setError("Failed to process scan result. Please try again.");
    }
  }, []);

  const handleScanError = useCallback(
    (scanError: unknown) => {
      logError(scanError, {
        component: "QRScanner",
        step: "scan_error",
        retryCount,
      });

      // Don't show errors for common scanning issues that are expected
      if (
        scanError instanceof Error &&
        (scanError.name === "NotFoundError" || scanError.message?.includes("No QR code found"))
      ) {
        return;
      }

      // Handle different types of scan errors
      let errorMessage = "Scanning failed. Please try again.";

      if (scanError instanceof Error) {
        if (scanError.name === "NotAllowedError") {
          errorMessage = "Camera permission was revoked. Please allow camera access.";
          setHasPermission(false);
        } else if (scanError.name === "NotReadableError") {
          errorMessage = "Camera is busy. Please close other apps using the camera.";
        } else if (scanError.name === "OverconstrainedError") {
          errorMessage = "Camera settings are not supported. Please try a different device.";
        }
      }

      setError(errorMessage);
      setRetryCount((prev) => prev + 1);

      // Auto-retry up to 3 times for retryable errors
      if (retryCount < 3 && scanError instanceof Error && ["NotReadableError", "AbortError"].includes(scanError.name)) {
        setTimeout(() => {
          setError(null);
          // Scanner will automatically restart
        }, 2000);
      }
    },
    [retryCount]
  );

  const determineScanType = (content: string): "qr" | "barcode" => {
    // Simple heuristics to determine scan type
    // QR codes typically contain URLs, have longer content, or specific patterns
    if (
      content.startsWith("http") ||
      content.startsWith("https") ||
      content.startsWith("mailto:") ||
      content.startsWith("tel:") ||
      content.startsWith("wifi:") ||
      content.length > 50
    ) {
      return "qr";
    }

    // Check for common barcode patterns (UPC, EAN, etc.)
    if (/^\d{8,14}$/.test(content)) {
      return "barcode";
    }

    // Default to QR for mixed content
    return "qr";
  };

  const determineScanFormat = (content: string, scanType: "qr" | "barcode"): string | undefined => {
    if (scanType === "barcode") {
      if (/^\d{12}$/.test(content)) return "UPC-A";
      if (/^\d{13}$/.test(content)) return "EAN-13";
      if (/^\d{8}$/.test(content)) return "EAN-8";
      return "Code128"; // Default for other numeric barcodes
    }

    if (scanType === "qr") {
      if (content.startsWith("http")) return "URL";
      if (content.startsWith("mailto:")) return "Email";
      if (content.startsWith("tel:")) return "Phone";
      if (content.startsWith("wifi:")) return "WiFi";
      return "Text";
    }

    return undefined;
  };

  const handleSaveScan = async (scanData: ScanCreateRequest): Promise<void> => {
    try {
      await retryWithBackoff(
        async () => {
          // Get CSRF token from cookie
          const csrfToken = document.cookie
            .split("; ")
            .find((row) => row.startsWith("csrf-token="))
            ?.split("=")[1];

          const response = await fetch("/api/scans/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(csrfToken && { "X-CSRF-Token": csrfToken }),
            },
            body: JSON.stringify(scanData),
          });

          if (!response.ok) {
            const errorData = await response.json();

            if (response.status === 429) {
              throw new NetworkError("Rate limit exceeded", response.status);
            } else if (response.status >= 500) {
              throw new NetworkError("Server error", response.status);
            } else {
              throw new Error(errorData.error || "Failed to save scan");
            }
          }

          return await response.json();
        },
        3,
        1000,
        {
          component: "QRScanner",
          step: "save_scan",
          scanData,
        }
      );

      if (onScanSaved) {
        onScanSaved(scanData);
      }
    } catch (err) {
      logError(err, {
        component: "QRScanner",
        step: "save_scan_failed",
        scanData,
      });
      throw err;
    }
  };

  const handleRescan = useCallback(() => {
    setScanResult(null);
    setIsScanning(true);
    setError(null);
    setRetryCount(0);
  }, []);

  const handleCloseScanResult = useCallback(() => {
    setScanResult(null);
  }, []);

  const toggleTorch = useCallback(async () => {
    if (!torchSupported) return;

    try {
      setIsRetrying(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      const track = stream.getVideoTracks()[0];

      await track.applyConstraints({
        advanced: [{ torch: !torchEnabled } as MediaTrackConstraintSet],
      });

      setTorchEnabled(!torchEnabled);

      // Clean up the stream
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      logError(err, { component: "QRScanner", step: "torch_toggle" });
      setError("Failed to toggle flashlight");
    } finally {
      setIsRetrying(false);
    }
  }, [torchEnabled, torchSupported]);

  const handleRetryScanning = useCallback(() => {
    setError(null);
    setRetryCount(0);
    if (!isScanning) {
      setIsScanning(true);
    }
  }, [isScanning]);

  if (!hasPermission) {
    return (
      <div className={className}>
        <CameraPermissions onPermissionGranted={handlePermissionGranted} onPermissionDenied={handlePermissionDenied} />
      </div>
    );
  }

  if (scanResult) {
    return (
      <div className={className}>
        <ScanResult
          content={scanResult.content}
          scanType={scanResult.scanType}
          format={scanResult.format}
          onSave={handleSaveScan}
          onRescan={handleRescan}
          onClose={handleCloseScanResult}
        />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-700">{error}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 text-sm font-medium">
                Dismiss
              </button>
              {retryCount > 0 && retryCount < 3 && (
                <button
                  onClick={handleRetryScanning}
                  className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              )}
            </div>
            {retryCount > 0 && <p className="text-red-500 text-xs mt-1">Retry attempt: {retryCount}/3</p>}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">{isScanning ? "Scanning..." : "QR & Barcode Scanner"}</h3>

          {isScanning && torchSupported && (
            <button
              onClick={toggleTorch}
              disabled={isRetrying}
              className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                torchEnabled
                  ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              aria-label={torchEnabled ? "Turn off flashlight" : "Turn on flashlight"}
            >
              {torchEnabled ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
            </button>
          )}
        </div>

        <div className="relative">
          {isScanning ? (
            <div className="relative">
              <BarcodeScannerComponent
                ref={scannerRef}
                onUpdate={(err: unknown, result: { getText(): string } | null) => {
                  if (result) {
                    handleScanSuccess(result.getText());
                  } else if (err) {
                    handleScanError(err);
                  }
                }}
                facingMode="environment"
                torch={torchEnabled}
                className="w-full h-64 object-cover"
              />

              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-blue-500 bg-transparent w-48 h-48 rounded-lg relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                </div>
              </div>

              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <p className="bg-black bg-opacity-75 text-white px-3 py-1 rounded-full text-sm">
                  Position QR code or barcode within the frame
                </p>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Ready to scan QR codes and barcodes</p>
                <button
                  onClick={handleStartScanning}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  <Camera className="h-4 w-4" />
                  Start Scanning
                </button>
              </div>
            </div>
          )}
        </div>

        {isScanning && (
          <div className="p-4 bg-gray-50 border-t">
            <button
              onClick={handleStopScanning}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Stop Scanning
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
