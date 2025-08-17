import React, { useState } from 'react';
import { Check, Copy, ExternalLink, RotateCcw, Save, X } from 'lucide-react';
import type { ScanCreateRequest } from '../types';

interface ScanResultProps {
  content: string;
  scanType: 'qr' | 'barcode';
  format?: string;
  onSave: (scanData: ScanCreateRequest) => Promise<void>;
  onRescan: () => void;
  onClose: () => void;
}

export const ScanResult: React.FC<ScanResultProps> = ({
  content,
  scanType,
  format,
  onSave,
  onRescan,
  onClose,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    } catch (error) {
      console.error('Failed to save scan:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save scan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
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
      window.open(content, '_blank', 'noopener,noreferrer');
    }
  };

  const formatScanType = (type: 'qr' | 'barcode'): string => {
    return type === 'qr' ? 'QR Code' : 'Barcode';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {formatScanType(scanType)} Scanned
          </h3>
          {format && (
            <p className="text-sm text-gray-500">Format: {format}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6">
        <div className="bg-gray-50 rounded-lg p-4 border">
          <p className="text-sm font-medium text-gray-700 mb-2">Content:</p>
          <div className="bg-white rounded border p-3 max-h-32 overflow-y-auto">
            <p className="text-gray-900 break-all text-sm font-mono">
              {content}
            </p>
          </div>
        </div>
      </div>

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
                ? 'bg-green-600 text-white cursor-default'
                : isSaving
                ? 'bg-blue-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
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

        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm">{saveError}</p>
            <button
              onClick={handleSave}
              className="text-red-600 hover:text-red-800 text-sm font-medium mt-1"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};