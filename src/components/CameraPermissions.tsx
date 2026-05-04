import React, { useState, useEffect, useCallback } from "react";
import { AlertCircle, Camera, Settings, RefreshCw } from "lucide-react";
import { CameraError, logError, retryWithBackoff } from "../lib/errors";

interface CameraPermissionsProps {
  onPermissionGranted: () => void;
  onPermissionDenied: () => void;
}

export const CameraPermissions: React.FC<CameraPermissionsProps> = ({ onPermissionGranted, onPermissionDenied }) => {
  const [permissionState, setPermissionState] = useState<"checking" | "granted" | "denied" | "prompt">("checking");
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const checkCameraPermission = useCallback(async () => {
    try {
      setError(null);

      // Check if navigator.mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new CameraError("Camera access is not supported in this browser", "NotSupportedError");
      }

      // Try to access camera directly first (more reliable than permissions API)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        // If we get here, permission is granted
        stream.getTracks().forEach((track) => track.stop()); // Clean up
        console.log("Camera permission: granted (direct access)");
        setPermissionState("granted");
        onPermissionGranted();
        return;
      } catch (directAccessError) {
        console.log("Direct camera access failed:", directAccessError);

        // If direct access fails, check permissions API
        if ("permissions" in navigator) {
          const permission = await navigator.permissions.query({
            name: "camera" as PermissionName,
          });

          console.log("Permission API state:", permission.state);

          switch (permission.state) {
            case "granted":
              setPermissionState("granted");
              onPermissionGranted();
              break;
            case "denied":
              setPermissionState("denied");
              onPermissionDenied();
              break;
            case "prompt":
              setPermissionState("prompt");
              break;
          }
        } else {
          // Fallback for browsers that don't support permissions API

          setPermissionState("prompt");
        }
      }
    } catch (err) {
      logError(err, { component: "CameraPermissions", step: "permission_check" });

      if (err instanceof CameraError) {
        setError(err.message);
      } else {
        setError("Failed to check camera permissions");
      }

      setPermissionState("denied");
      onPermissionDenied();
    }
  }, [onPermissionGranted, onPermissionDenied]);

  useEffect(() => {
    checkCameraPermission();
  }, [checkCameraPermission]);

  const requestCameraPermission = useCallback(async () => {
    try {
      setError(null);
      setIsRetrying(true);

      const stream = await retryWithBackoff(
        async () => {
          try {
            return await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: "environment", // Prefer back camera for scanning
              },
            });
          } catch (err) {
            if (err instanceof Error) {
              if (err.name === "NotAllowedError") {
                throw new CameraError(
                  "Camera access was denied. Please allow camera access to scan QR codes.",
                  "NotAllowedError"
                );
              } else if (err.name === "NotFoundError") {
                throw new CameraError("No camera found on this device.", "NotFoundError");
              } else if (err.name === "NotSupportedError") {
                throw new CameraError("Camera access is not supported in this browser.", "NotSupportedError");
              } else if (err.name === "NotReadableError") {
                throw new CameraError("Camera is already in use by another application.", "NotReadableError");
              } else if (err.name === "OverconstrainedError") {
                throw new CameraError("Camera constraints could not be satisfied.", "OverconstrainedError");
              } else {
                throw new CameraError("Failed to access camera. Please try again.");
              }
            } else {
              throw new CameraError("An unknown error occurred while accessing the camera.");
            }
          }
        },
        3,
        1000,
        { component: "CameraPermissions", step: "permission_request", attempt: retryCount + 1 }
      );

      // Stop the stream immediately as we just needed to request permission
      stream.getTracks().forEach((track) => track.stop());

      setPermissionState("granted");
      setRetryCount(0);
      onPermissionGranted();
    } catch (err) {
      logError(err, {
        component: "CameraPermissions",
        step: "permission_request_failed",
        retryCount: retryCount + 1,
      });

      if (err instanceof CameraError) {
        setError(err.message);
      } else {
        setError("Failed to access camera. Please try again.");
      }

      setPermissionState("denied");
      setRetryCount((prev) => prev + 1);
      onPermissionDenied();
    } finally {
      setIsRetrying(false);
    }
  }, [onPermissionGranted, onPermissionDenied, retryCount]);

  const handleRetry = useCallback(() => {
    if (retryCount < 3) {
      requestCameraPermission();
    } else {
      // After 3 retries, check permission state again
      setRetryCount(0);
      checkCameraPermission();
    }
  }, [retryCount, requestCameraPermission, checkCameraPermission]);

  if (permissionState === "checking") {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Checking camera permissions...</p>
      </div>
    );
  }

  if (permissionState === "granted") {
    return null; // Permission granted, let parent component handle camera
  }

  if (permissionState === "denied") {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Camera Access Required</h3>
        {error && <p className="text-red-600 mb-4">{error}</p>}
        <div className="space-y-4 max-w-md">
          <p className="text-gray-600">To scan QR codes and barcodes, this app needs access to your camera.</p>
          <div className="bg-gray-50 p-4 rounded-lg text-left">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              How to enable camera access:
            </h4>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Click the camera icon in your browser&apos;s address bar</li>
              <li>Select &quot;Allow&quot; for camera access</li>
              <li>Refresh this page</li>
            </ol>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isRetrying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Retrying...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Try Again</span>
                </>
              )}
            </button>
            {retryCount >= 3 && (
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Refresh Page
              </button>
            )}
          </div>
          {retryCount > 0 && <p className="text-sm text-gray-500">Retry attempt: {retryCount}/3</p>}
        </div>
      </div>
    );
  }

  // Permission state is 'prompt'
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <Camera className="h-12 w-12 text-blue-600 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Camera Access Needed</h3>
      <p className="text-gray-600 mb-6 max-w-md">
        To scan QR codes and barcodes, we need permission to access your camera. Your privacy is important - we only
        process the camera feed locally and don&apos;t store any images.
      </p>
      <button
        onClick={requestCameraPermission}
        disabled={isRetrying}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRetrying ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Requesting...</span>
          </>
        ) : (
          <>
            <Camera className="h-4 w-4" />
            <span>Allow Camera Access</span>
          </>
        )}
      </button>
    </div>
  );
};
