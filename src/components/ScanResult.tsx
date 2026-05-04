import React, { useState } from "react";
import { Check, Copy, ExternalLink, RotateCcw, Save, X, AlertCircle, RefreshCw } from "lucide-react";
import type { ScanCreateRequest } from "../types";
import { logError, retryWithBackoff, NetworkError } from "../lib/errors";

interface ScanResultProps {
  content: string;
  scanType: "qr" | "barcode";
  format?: string;
  onSave: (scanData: ScanCreateRequest) => Promise<void>;
  onRescan: () => void;
  onClose: () => void;
}

export const ScanResult: React.FC<ScanResultProps> = ({ content, scanType, format, onSave, onRescan, onClose }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleSave = async () => {
    if (isSaved || isSaving) return;

    try {
      setIsSaving(true);
      setSaveError(null);

      await onSave({
        content,
        scanType,
        format,
      });

      setIsSaved(true);
      setRetryCount(0);
    } catch (error) {
      logError(error, {
        component: "ScanResult",
        step: "save_scan",
        scanData: { content, scanType, format },
        retryCount: retryCount + 1,
      });

      let errorMessage = "Failed to save scan";

      if (error instanceof NetworkError) {
        if (error.statusCode === 429) {
          errorMessage = "Too many requests. Please wait a moment and try again.";
        } else if (error.statusCode && error.statusCode >= 500) {
          errorMessage = "Server error. Please try again later.";
        } else {
          errorMessage = "Network error. Please check your connection and try again.";
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setSaveError(errorMessage);
      setRetryCount((prev) => prev + 1);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      setCopyError(null);

      // Check if clipboard API is available
      if (!navigator.clipboard) {
        throw new Error("Clipboard API not supported");
      }

      await retryWithBackoff(
        async () => {
          await navigator.clipboard.writeText(content);
        },
        2,
        500,
        {
          component: "ScanResult",
          step: "copy_to_clipboard",
          contentLength: content.length,
        }
      );

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logError(error, {
        component: "ScanResult",
        step: "copy_failed",
        contentLength: content.length,
      });

      let errorMessage = "Failed to copy to clipboard";

      if (error instanceof Error) {
        if (error.message.includes("not supported")) {
          errorMessage = "Clipboard access not supported in this browser";
        } else if (error.message.includes("permission")) {
          errorMessage = "Clipboard permission denied";
        }
      }

      setCopyError(errorMessage);

      // Fallback: try to select text for manual copy
      try {
        const textArea = document.createElement("textarea");
        textArea.value = content;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);

        setCopied(true);
        setCopyError(null);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackError) {
        logError(fallbackError, {
          component: "ScanResult",
          step: "copy_fallback_failed",
        });
      }
    }
  };

  const isUrl = (text: string): boolean => {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleOpenUrl = () => {
    if (isUrl(content)) {
      try {
        window.open(content, "_blank", "noopener,noreferrer");
      } catch (error) {
        logError(error, {
          component: "ScanResult",
          step: "open_url_failed",
          url: content,
        });
      }
    }
  };

  const formatScanType = (type: "qr" | "barcode"): string => {
    return type === "qr" ? "QR Code" : "Barcode";
  };

  const handleRetrySave = () => {
    setSaveError(null);
    handleSave();
  };

  const dismissCopyError = () => {
    setCopyError(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{formatScanType(scanType)} Scanned</h3>
          {format && <p className="text-sm text-gray-500">Format: {format}</p>}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6">
        <div className="bg-gray-50 rounded-lg p-4 border">
          <p className="text-sm font-medium text-gray-700 mb-2">Content:</p>
          <div className="bg-white rounded border p-3 max-h-32 overflow-y-auto">
            <p className="text-gray-900 break-all text-sm font-mono">{content}</p>
          </div>
        </div>
      </div>

      {/* Copy Error */}
      {copyError && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-orange-700 text-sm">{copyError}</p>
            <button
              onClick={dismissCopyError}
              className="text-orange-600 hover:text-orange-800 text-xs font-medium mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy</span>
              </>
            )}
          </button>

          {isUrl(content) && (
            <button
              onClick={handleOpenUrl}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open</span>
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onRescan}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Scan Again</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || isSaved}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isSaved
                ? "bg-green-600 text-white cursor-default"
                : isSaving
                  ? "bg-blue-400 text-white cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : isSaved ? (
              <>
                <Check className="h-4 w-4" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save</span>
              </>
            )}
          </button>
        </div>

        {/* Save Error */}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-700 text-sm">{saveError}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleRetrySave}
                    disabled={isSaving}
                    className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Try again
                  </button>
                  <button
                    onClick={() => setSaveError(null)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Dismiss
                  </button>
                </div>
                {retryCount > 0 && <p className="text-red-500 text-xs mt-1">Retry attempt: {retryCount}/3</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
