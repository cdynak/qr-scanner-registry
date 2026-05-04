import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NetworkError,
  CameraError,
  ScanError,
  RateLimitError,
  AuthenticationError,
  ErrorSeverity,
  createErrorInfo,
  logError,
  handleAsyncError,
  withErrorHandling,
  createApiErrorResponse,
  getRetryDelay,
  retryWithBackoff,
  safeExecute,
  safeExecuteAsync,
  CircuitBreaker,
  RateLimiter,
  setupGlobalErrorHandling,
} from "../../lib/errors";
import { ValidationError, DatabaseError } from "../../types";

// Mock console methods
const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

describe("Error Classes", () => {
  afterEach(() => {
    mockConsoleError.mockClear();
  });

  describe("NetworkError", () => {
    it("should create NetworkError with default message", () => {
      const error = new NetworkError();
      expect(error.name).toBe("NetworkError");
      expect(error.message).toBe("Network request failed");
      expect(error.statusCode).toBeUndefined();
    });

    it("should create NetworkError with custom message and status code", () => {
      const error = new NetworkError("Custom network error", 500);
      expect(error.name).toBe("NetworkError");
      expect(error.message).toBe("Custom network error");
      expect(error.statusCode).toBe(500);
    });
  });

  describe("CameraError", () => {
    it("should create CameraError with default message", () => {
      const error = new CameraError();
      expect(error.name).toBe("CameraError");
      expect(error.message).toBe("Camera access failed");
      expect(error.code).toBeUndefined();
    });

    it("should create CameraError with custom message and code", () => {
      const error = new CameraError("Permission denied", "NotAllowedError");
      expect(error.name).toBe("CameraError");
      expect(error.message).toBe("Permission denied");
      expect(error.code).toBe("NotAllowedError");
    });
  });

  describe("ScanError", () => {
    it("should create ScanError with default message", () => {
      const error = new ScanError();
      expect(error.name).toBe("ScanError");
      expect(error.message).toBe("Scan processing failed");
      expect(error.scanType).toBeUndefined();
    });

    it("should create ScanError with custom message and scan type", () => {
      const error = new ScanError("QR code invalid", "qr");
      expect(error.name).toBe("ScanError");
      expect(error.message).toBe("QR code invalid");
      expect(error.scanType).toBe("qr");
    });
  });

  describe("RateLimitError", () => {
    it("should create RateLimitError with default message", () => {
      const error = new RateLimitError();
      expect(error.name).toBe("RateLimitError");
      expect(error.message).toBe("Rate limit exceeded");
      expect(error.retryAfter).toBeUndefined();
    });

    it("should create RateLimitError with custom message and retry after", () => {
      const error = new RateLimitError("Too many requests", 60);
      expect(error.name).toBe("RateLimitError");
      expect(error.message).toBe("Too many requests");
      expect(error.retryAfter).toBe(60);
    });
  });

  describe("AuthenticationError", () => {
    it("should create AuthenticationError with default message", () => {
      const error = new AuthenticationError();
      expect(error.name).toBe("AuthenticationError");
      expect(error.message).toBe("Authentication failed");
      expect(error.code).toBeUndefined();
    });

    it("should create AuthenticationError with custom message and code", () => {
      const error = new AuthenticationError("Invalid token", "INVALID_TOKEN");
      expect(error.name).toBe("AuthenticationError");
      expect(error.message).toBe("Invalid token");
      expect(error.code).toBe("INVALID_TOKEN");
    });
  });
});

describe("createErrorInfo", () => {
  it("should create error info for Error objects", () => {
    const error = new NetworkError("Network failed", 500);
    const errorInfo = createErrorInfo(error);

    expect(errorInfo.name).toBe("NetworkError");
    expect(errorInfo.message).toBe("Network failed");
    expect(errorInfo.severity).toBe(ErrorSeverity.MEDIUM);
    expect(errorInfo.statusCode).toBe(500);
    expect(errorInfo.retryable).toBe(true);
    expect(errorInfo.userMessage).toBe("Connection failed. Please check your internet and try again.");
    expect(errorInfo.timestamp).toBeDefined();
  });

  it("should create error info for ValidationError with field", () => {
    const error = new ValidationError("Invalid email", "email");
    const errorInfo = createErrorInfo(error);

    expect(errorInfo.name).toBe("ValidationError");
    expect(errorInfo.field).toBe("email");
    expect(errorInfo.severity).toBe(ErrorSeverity.LOW);
    expect(errorInfo.retryable).toBe(false);
  });

  it("should create error info for non-Error objects", () => {
    const errorInfo = createErrorInfo("String error");

    expect(errorInfo.name).toBe("UnknownError");
    expect(errorInfo.message).toBe("String error");
    expect(errorInfo.severity).toBe(ErrorSeverity.MEDIUM);
    expect(errorInfo.retryable).toBe(false);
    expect(errorInfo.userMessage).toBe("An unexpected error occurred. Please try again.");
  });

  it("should include context in error info", () => {
    const error = new Error("Test error");
    const context = { component: "TestComponent", step: "test" };
    const errorInfo = createErrorInfo(error, context);

    expect(errorInfo.context).toEqual(context);
  });
});

describe("logError", () => {
  it("should log error in development mode", () => {
    const error = new Error("Test error");
    logError(error, { test: true }, true);

    expect(mockConsoleError).toHaveBeenCalledWith(
      "Error logged:",
      expect.objectContaining({
        name: "Error",
        message: "Test error",
        context: { test: true },
      })
    );
  });

  it("should not log error in production mode", () => {
    mockConsoleError.mockClear(); // Clear previous calls
    const error = new Error("Test error");
    logError(error, { test: true }, false);

    expect(mockConsoleError).not.toHaveBeenCalled();
  });
});

describe("handleAsyncError", () => {
  it("should resolve successful promises", async () => {
    const promise = Promise.resolve("success");
    const result = await handleAsyncError(promise);
    expect(result).toBe("success");
  });

  it("should log and rethrow errors", async () => {
    const error = new Error("Async error");
    const promise = Promise.reject(error);

    await expect(handleAsyncError(promise, { test: true }, true)).rejects.toThrow("Async error");
    expect(mockConsoleError).toHaveBeenCalled();
  });
});

describe("withErrorHandling", () => {
  it("should handle synchronous functions", () => {
    const fn = () => "success";
    const wrappedFn = withErrorHandling(fn);
    expect(wrappedFn()).toBe("success");
  });

  it("should handle synchronous errors", () => {
    const error = new Error("Sync error");
    const fn = () => {
      throw error;
    };
    const wrappedFn = withErrorHandling(fn, { test: true }, true);

    expect(() => wrappedFn()).toThrow("Sync error");
    expect(mockConsoleError).toHaveBeenCalled();
  });

  it("should handle asynchronous functions", async () => {
    const fn = async () => "async success";
    const wrappedFn = withErrorHandling(fn);
    const result = await wrappedFn();
    expect(result).toBe("async success");
  });
});

describe("createApiErrorResponse", () => {
  it("should create API error response", () => {
    const error = new NetworkError("Network failed", 500);
    const response = createApiErrorResponse(error);

    expect(response).toEqual({
      error: "Connection failed. Please check your internet and try again.",
      message: "Network failed",
      statusCode: 500,
      retryable: true,
      timestamp: expect.any(String),
    });
  });

  it("should use custom status code", () => {
    const error = new Error("Custom error");
    const response = createApiErrorResponse(error, 400);

    expect(response.statusCode).toBe(400);
  });
});

describe("getRetryDelay", () => {
  it("should calculate exponential backoff delay", () => {
    expect(getRetryDelay(1)).toBe(1000);
    expect(getRetryDelay(2)).toBe(2000);
    expect(getRetryDelay(3)).toBe(4000);
    expect(getRetryDelay(4)).toBe(8000);
  });

  it("should cap delay at maximum", () => {
    expect(getRetryDelay(10)).toBe(30000); // Max delay
  });

  it("should use custom base delay", () => {
    expect(getRetryDelay(1, 500)).toBe(500);
    expect(getRetryDelay(2, 500)).toBe(1000);
  });
});

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should succeed on first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await retryWithBackoff(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable errors", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new NetworkError("Network error")).mockResolvedValue("success");

    const promise = retryWithBackoff(fn, 3, 100);

    // Fast-forward timers
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should not retry non-retryable errors", async () => {
    const error = new ValidationError("Validation failed");
    const fn = vi.fn().mockRejectedValue(error);

    await expect(retryWithBackoff(fn)).rejects.toThrow("Validation failed");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should exhaust retries and throw last error", async () => {
    const error = new NetworkError("Network error");
    const fn = vi.fn().mockRejectedValue(error);

    const promise = retryWithBackoff(fn, 2, 100);

    // Fast-forward timers
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow("Network error");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("safeExecute", () => {
  it("should return result for successful execution", () => {
    const fn = () => "success";
    const result = safeExecute(fn);
    expect(result).toEqual({ result: "success" });
  });

  it("should return error for failed execution", () => {
    const fn = () => {
      throw new Error("Test error");
    };
    const result = safeExecute(fn);
    expect(result).toEqual({
      error: expect.objectContaining({
        name: "Error",
        message: "Test error",
      }),
    });
  });
});

describe("safeExecuteAsync", () => {
  it("should return result for successful async execution", async () => {
    const fn = async () => "async success";
    const result = await safeExecuteAsync(fn);
    expect(result).toEqual({ result: "async success" });
  });

  it("should return error for failed async execution", async () => {
    const fn = async () => {
      throw new Error("Async error");
    };
    const result = await safeExecuteAsync(fn);
    expect(result).toEqual({
      error: expect.objectContaining({
        name: "Error",
        message: "Async error",
      }),
    });
  });
});

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should execute function when circuit is closed", async () => {
    const circuitBreaker = new CircuitBreaker(3, 1000);
    const fn = vi.fn().mockResolvedValue("success");

    const result = await circuitBreaker.execute(fn);
    expect(result).toBe("success");
    expect(circuitBreaker.getState()).toBe("closed");
  });

  it("should open circuit after threshold failures", async () => {
    const circuitBreaker = new CircuitBreaker(2, 1000);
    const fn = vi.fn().mockRejectedValue(new Error("Test error"));

    // First failure
    await expect(circuitBreaker.execute(fn)).rejects.toThrow("Test error");
    expect(circuitBreaker.getState()).toBe("closed");

    // Second failure - should open circuit
    await expect(circuitBreaker.execute(fn)).rejects.toThrow("Test error");
    expect(circuitBreaker.getState()).toBe("open");

    // Third attempt should be rejected immediately
    await expect(circuitBreaker.execute(fn)).rejects.toThrow("Circuit breaker is open");
    expect(fn).toHaveBeenCalledTimes(2); // Function not called on third attempt
  });

  it("should transition to half-open after timeout", async () => {
    const circuitBreaker = new CircuitBreaker(1, 1000);
    const fn = vi.fn().mockRejectedValue(new Error("Test error"));

    // Trigger circuit open
    await expect(circuitBreaker.execute(fn)).rejects.toThrow("Test error");
    expect(circuitBreaker.getState()).toBe("open");

    // Fast-forward past timeout
    vi.advanceTimersByTime(1001);

    // Next execution should transition to half-open
    const successFn = vi.fn().mockResolvedValue("success");
    const result = await circuitBreaker.execute(successFn);
    expect(result).toBe("success");
    expect(circuitBreaker.getState()).toBe("closed");
  });

  it("should reset circuit breaker", () => {
    const circuitBreaker = new CircuitBreaker(1, 1000);

    // Manually set some state
    circuitBreaker["failures"] = 5;
    circuitBreaker["state"] = "open";

    circuitBreaker.reset();
    expect(circuitBreaker.getState()).toBe("closed");
  });
});

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should allow requests within limit", () => {
    const rateLimiter = new RateLimiter(3, 1000);

    expect(rateLimiter.canMakeRequest()).toBe(true);
    expect(rateLimiter.canMakeRequest()).toBe(true);
    expect(rateLimiter.canMakeRequest()).toBe(true);
    expect(rateLimiter.canMakeRequest()).toBe(false);
  });

  it("should reset after time window", () => {
    const rateLimiter = new RateLimiter(1, 1000);

    expect(rateLimiter.canMakeRequest()).toBe(true);
    expect(rateLimiter.canMakeRequest()).toBe(false);

    // Fast-forward past window
    vi.advanceTimersByTime(1001);

    expect(rateLimiter.canMakeRequest()).toBe(true);
  });

  it("should calculate time until reset", () => {
    const rateLimiter = new RateLimiter(1, 1000);

    rateLimiter.canMakeRequest(); // Use up the limit

    const timeUntilReset = rateLimiter.getTimeUntilReset();
    expect(timeUntilReset).toBeGreaterThan(0);
    expect(timeUntilReset).toBeLessThanOrEqual(1000);
  });
});

describe("setupGlobalErrorHandling", () => {
  it("should setup global error handlers", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    setupGlobalErrorHandling();

    expect(addEventListenerSpy).toHaveBeenCalledWith("error", expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));

    addEventListenerSpy.mockRestore();
  });
});
