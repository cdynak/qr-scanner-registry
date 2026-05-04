import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useErrorHandler } from "../../lib/useErrorHandler";
import { NetworkError, ErrorSeverity } from "../../lib/errors";

// Mock the errors module
vi.mock("../../lib/errors", async () => {
  const actual = await vi.importActual("../../lib/errors");
  return {
    ...actual,
    logError: vi.fn(),
    createErrorInfo: vi.fn((error) => ({
      name: error.name || "UnknownError",
      message: error.message || String(error),
      severity: ErrorSeverity.MEDIUM,
      timestamp: new Date().toISOString(),
      userMessage: "An error occurred",
      retryable: error instanceof NetworkError,
      context: {},
    })),
    retryWithBackoff: vi.fn(),
  };
});

describe("useErrorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with no error", () => {
    const { result } = renderHook(() => useErrorHandler());

    expect(result.current.error).toBeNull();
    expect(result.current.isRetrying).toBe(false);
    expect(result.current.retryCount).toBe(0);
    expect(result.current.canRetry).toBe(false);
  });

  it("should handle errors", () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useErrorHandler({ component: "TestComponent", onError }));

    const testError = new Error("Test error");

    act(() => {
      result.current.handleError(testError, { step: "test" });
    });

    expect(result.current.error).toEqual(
      expect.objectContaining({
        name: "UnknownError",
        message: "Test error",
      })
    );
    expect(result.current.retryCount).toBe(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "UnknownError",
        message: "Test error",
      })
    );
  });

  it("should clear errors", () => {
    const { result } = renderHook(() => useErrorHandler());

    // First set an error
    act(() => {
      result.current.handleError(new Error("Test error"));
    });

    expect(result.current.error).not.toBeNull();

    // Then clear it
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.retryCount).toBe(0);
    expect(result.current.isRetrying).toBe(false);
  });

  it("should execute operations with error handling", async () => {
    const { result } = renderHook(() => useErrorHandler());

    const successOperation = vi.fn().mockResolvedValue("success");

    let operationResult: string | null = null;
    await act(async () => {
      operationResult = await result.current.executeWithErrorHandling(successOperation, { step: "test" });
    });

    expect(operationResult).toBe("success");
    expect(result.current.error).toBeNull();
  });

  it("should handle operation errors", async () => {
    const { result } = renderHook(() => useErrorHandler());

    const failingOperation = vi.fn().mockRejectedValue(new Error("Operation failed"));

    let operationResult: string | null = "initial";
    await act(async () => {
      operationResult = await result.current.executeWithErrorHandling(failingOperation, { step: "test" });
    });

    expect(operationResult).toBeNull();
    expect(result.current.error).toEqual(
      expect.objectContaining({
        name: "UnknownError",
        message: "Operation failed",
      })
    );
  });

  it("should retry retryable operations", async () => {
    const { retryWithBackoff } = await import("../../lib/errors");
    const mockRetryWithBackoff = retryWithBackoff as vi.MockedFunction<typeof retryWithBackoff>;
    mockRetryWithBackoff.mockResolvedValue("retry success");

    const { result } = renderHook(() => useErrorHandler({ maxRetries: 3 }));

    // First set a retryable error
    const retryableError = new NetworkError("Network error");
    act(() => {
      result.current.handleError(retryableError);
    });

    expect(result.current.canRetry).toBe(true);

    const retryOperation = vi.fn().mockResolvedValue("retry success");

    let retryResult: string | null = null;
    await act(async () => {
      retryResult = await result.current.retryOperation(retryOperation, { step: "retry" });
    });

    expect(retryResult).toBe("retry success");
    expect(mockRetryWithBackoff).toHaveBeenCalledWith(
      retryOperation,
      2, // maxRetries - retryCount
      1000, // default delay
      expect.objectContaining({ component: "Unknown", step: "retry" })
    );
  });

  it("should not retry non-retryable errors", async () => {
    const { result } = renderHook(() => useErrorHandler());

    // Set a non-retryable error
    const nonRetryableError = new Error("Validation error");
    act(() => {
      result.current.handleError(nonRetryableError);
    });

    expect(result.current.canRetry).toBe(false);

    const retryOperation = vi.fn();

    let retryResult: string | null = "initial";
    await act(async () => {
      retryResult = await result.current.retryOperation(retryOperation);
    });

    expect(retryResult).toBeNull();
    expect(retryOperation).not.toHaveBeenCalled();
  });

  it("should not retry after max attempts", async () => {
    const { result } = renderHook(() => useErrorHandler({ maxRetries: 2 }));

    // Set a retryable error and increment retry count to max
    const retryableError = new NetworkError("Network error");
    act(() => {
      result.current.handleError(retryableError);
    });
    act(() => {
      result.current.handleError(retryableError); // Second attempt
    });

    expect(result.current.retryCount).toBe(2);
    expect(result.current.canRetry).toBe(false);

    const retryOperation = vi.fn();

    let retryResult: string | null = "initial";
    await act(async () => {
      retryResult = await result.current.retryOperation(retryOperation);
    });

    expect(retryResult).toBeNull();
    expect(retryOperation).not.toHaveBeenCalled();
  });

  it("should handle retry failures", async () => {
    const { retryWithBackoff } = await import("../../lib/errors");
    const mockRetryWithBackoff = retryWithBackoff as vi.MockedFunction<typeof retryWithBackoff>;
    mockRetryWithBackoff.mockRejectedValue(new Error("Retry failed"));

    const { result } = renderHook(() => useErrorHandler());

    // Set a retryable error
    const retryableError = new NetworkError("Network error");
    act(() => {
      result.current.handleError(retryableError);
    });

    const retryOperation = vi.fn();

    let retryResult: string | null = "initial";
    await act(async () => {
      retryResult = await result.current.retryOperation(retryOperation);
    });

    expect(retryResult).toBeNull();
    expect(result.current.error).toEqual(
      expect.objectContaining({
        name: "UnknownError",
        message: "Retry failed",
      })
    );
  });

  it("should use custom component name in context", () => {
    const { logError } = vi.mocked(await import("../../lib/errors"));
    const { result } = renderHook(() => useErrorHandler({ component: "CustomComponent" }));

    const testError = new Error("Test error");

    act(() => {
      result.current.handleError(testError, { step: "test" });
    });

    expect(logError).toHaveBeenCalledWith(testError, {
      component: "CustomComponent",
      step: "test",
    });
  });

  it("should use custom retry settings", async () => {
    const { retryWithBackoff } = await import("../../lib/errors");
    const mockRetryWithBackoff = retryWithBackoff as vi.MockedFunction<typeof retryWithBackoff>;
    mockRetryWithBackoff.mockResolvedValue("success");

    const { result } = renderHook(() =>
      useErrorHandler({
        component: "TestComponent",
        maxRetries: 5,
        retryDelay: 2000,
      })
    );

    // Set a retryable error
    const retryableError = new NetworkError("Network error");
    act(() => {
      result.current.handleError(retryableError);
    });

    const retryOperation = vi.fn().mockResolvedValue("success");

    await act(async () => {
      await result.current.retryOperation(retryOperation);
    });

    expect(mockRetryWithBackoff).toHaveBeenCalledWith(
      retryOperation,
      4, // maxRetries - retryCount
      2000, // custom delay
      expect.objectContaining({ component: "TestComponent" })
    );
  });
});
