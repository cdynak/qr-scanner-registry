import React, { useState, useEffect } from 'react';
import { AlertCircle, Camera, Settings } from 'lucide-react';

interface CameraPermissionsProps {
  onPermissionGranted: () => void;
  onPermissionDenied: () => void;
}

export const CameraPermissions: React.FC<CameraPermissionsProps> = ({
  onPermissionGranted,
  onPermissionDenied,
}) => {
  const [permissionState, setPermissionState] = useState<'checking' | 'granted' | 'denied' | 'prompt'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkCameraPermission();
  }, []);

  const checkCameraPermission = async () => {
    try {
      // Check if navigator.mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported in this browser');
        setPermissionState('denied');
        onPermissionDenied();
        return;
      }

      // Check current permission state
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        
        switch (permission.state) {
          case 'granted':
            setPermissionState('granted');
            onPermissionGranted();
            break;
          case 'denied':
            setPermissionState('denied');
            onPermissionDenied();
            break;
          case 'prompt':
            setPermissionState('prompt');
            break;
        }
      } else {
        // Fallback for browsers that don't support permissions API
        setPermissionState('prompt');
      }
    } catch (err) {
      console.error('Error checking camera permission:', err);
      setError('Failed to check camera permissions');
      setPermissionState('denied');
      onPermissionDenied();
    }
  };

  const requestCameraPermission = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment' // Prefer back camera for scanning
        } 
      });
      
      // Stop the stream immediately as we just needed to request permission
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionState('granted');
      onPermissionGranted();
    } catch (err) {
      console.error('Camera permission denied:', err);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera access was denied. Please allow camera access to scan QR codes.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found on this device.');
        } else if (err.name === 'NotSupportedError') {
          setError('Camera access is not supported in this browser.');
        } else {
          setError('Failed to access camera. Please try again.');
        }
      } else {
        setError('An unknown error occurred while accessing the camera.');
      }
      
      setPermissionState('denied');
      onPermissionDenied();
    }
  };

  if (permissionState === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Checking camera permissions...</p>
      </div>
    );
  }

  if (permissionState === 'granted') {
    return null; // Permission granted, let parent component handle camera
  }

  if (permissionState === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Camera Access Required</h3>
        {error && (
          <p className="text-red-600 mb-4">{error}</p>
        )}
        <div className="space-y-4 max-w-md">
          <p className="text-gray-600">
            To scan QR codes and barcodes, this app needs access to your camera.
          </p>
          <div className="bg-gray-50 p-4 rounded-lg text-left">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              How to enable camera access:
            </h4>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Click the camera icon in your browser's address bar</li>
              <li>Select "Allow" for camera access</li>
              <li>Refresh this page</li>
            </ol>
          </div>
          <button
            onClick={requestCameraPermission}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
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
        To scan QR codes and barcodes, we need permission to access your camera. 
        Your privacy is important - we only process the camera feed locally and don't store any images.
      </p>
      <button
        onClick={requestCameraPermission}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
      >
        <Camera className="h-4 w-4" />
        Allow Camera Access
      </button>
    </div>
  );
};