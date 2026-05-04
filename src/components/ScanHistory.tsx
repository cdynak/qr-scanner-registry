import { useState, useEffect } from "react";
import type { Scan, PaginatedResponse, ScanHistoryFilters } from "../types";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

interface ScanHistoryProps {
  className?: string;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>
            {cancelText}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ScanHistory({ className }: ScanHistoryProps) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ScanHistoryFilters>({
    limit: 10,
    offset: 0,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    hasMore: false,
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    scanId: string | null;
    scanContent: string;
  }>({
    isOpen: false,
    scanId: null,
    scanContent: "",
  });

  const fetchScans = async (newFilters?: Partial<ScanHistoryFilters>) => {
    try {
      setLoading(true);
      setError(null);

      const currentFilters = { ...filters, ...newFilters };
      const params = new URLSearchParams();

      if (currentFilters.limit) params.append("limit", currentFilters.limit.toString());
      if (currentFilters.offset) params.append("offset", currentFilters.offset.toString());
      if (currentFilters.scanType) params.append("scanType", currentFilters.scanType);
      if (currentFilters.startDate) params.append("startDate", currentFilters.startDate);
      if (currentFilters.endDate) params.append("endDate", currentFilters.endDate);

      const response = await fetch(`/api/scans/list?${params.toString()}`);
      const data: PaginatedResponse<Scan> = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch scan history");
      }

      if (data.data) {
        if (currentFilters.offset === 0) {
          setScans(data.data);
        } else {
          setScans((prev) => [...prev, ...data.data!]);
        }
      }

      if (data.pagination) {
        setPagination(data.pagination);
      }

      setFilters(currentFilters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (scanId: string) => {
    try {
      const response = await fetch("/api/scans/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: scanId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete scan");
      }

      // Remove the deleted scan from the list
      setScans((prev) => prev.filter((scan) => scan.id !== scanId));
      setPagination((prev) => ({ ...prev, total: prev.total - 1 }));

      setDeleteDialog({ isOpen: false, scanId: null, scanContent: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete scan");
    }
  };

  const handleFilterChange = (newFilters: Partial<ScanHistoryFilters>) => {
    fetchScans({ ...newFilters, offset: 0 });
  };

  const handleLoadMore = () => {
    if (pagination.hasMore && !loading) {
      fetchScans({ offset: filters.offset + filters.limit });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatContent = (content: string, maxLength = 50) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  useEffect(() => {
    fetchScans();
  }, []);

  if (loading && scans.length === 0) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <div className="text-muted-foreground">Loading scan history...</div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="scanType" className="block text-sm font-medium mb-2">
            Filter by type
          </label>
          <select
            id="scanType"
            className="w-full px-3 py-2 border rounded-md bg-background"
            value={filters.scanType || ""}
            onChange={(e) =>
              handleFilterChange({
                scanType: e.target.value as "qr" | "barcode" | undefined,
              })
            }
          >
            <option value="">All types</option>
            <option value="qr">QR Code</option>
            <option value="barcode">Barcode</option>
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="startDate" className="block text-sm font-medium mb-2">
            From date
          </label>
          <input
            id="startDate"
            type="date"
            className="w-full px-3 py-2 border rounded-md bg-background"
            value={filters.startDate || ""}
            onChange={(e) => handleFilterChange({ startDate: e.target.value || undefined })}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="endDate" className="block text-sm font-medium mb-2">
            To date
          </label>
          <input
            id="endDate"
            type="date"
            className="w-full px-3 py-2 border rounded-md bg-background"
            value={filters.endDate || ""}
            onChange={(e) => handleFilterChange({ endDate: e.target.value || undefined })}
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Scan list */}
      {scans.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-2">No scans found</div>
          <div className="text-sm text-muted-foreground">
            {filters.scanType || filters.startDate || filters.endDate
              ? "Try adjusting your filters"
              : "Start scanning to see your history here"}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {scans.map((scan) => (
            <div key={scan.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                        scan.scan_type === "qr"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                          : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                      )}
                    >
                      {scan.scan_type === "qr" ? "QR Code" : "Barcode"}
                    </span>
                    {scan.format && <span className="text-xs text-muted-foreground">{scan.format}</span>}
                  </div>
                  <div className="font-mono text-sm mb-2 break-all">{formatContent(scan.content)}</div>
                  <div className="text-xs text-muted-foreground">Scanned {formatDate(scan.scanned_at)}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDeleteDialog({
                      isOpen: true,
                      scanId: scan.id,
                      scanContent: scan.content,
                    })
                  }
                  className="text-destructive hover:text-destructive"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more button */}
      {pagination.hasMore && (
        <div className="text-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}

      {/* Pagination info */}
      {scans.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {scans.length} of {pagination.total} scans
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, scanId: null, scanContent: "" })}
        onConfirm={() => deleteDialog.scanId && handleDelete(deleteDialog.scanId)}
        title="Delete Scan"
        message={`Are you sure you want to delete this scan? "${formatContent(
          deleteDialog.scanContent,
          30
        )}" This action cannot be undone.`}
      />
    </div>
  );
}
