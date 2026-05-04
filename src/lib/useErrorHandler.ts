import { useState, useCallback } from "react";
import { logError, createErrorInfo, retryWithBackoff } from "./errors";
import type { ErrorInfo } from "./errors";

interface UseErrorHandlerOptions {
  component?: string;
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: ErrorInfo) => void;
}

interface ErrorState {
  error: ErrorInfo | null;
  isRetrying: boolean;
  retryCount: number;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { component = "Unknown", maxRetries = 3, retryDelay = 1000, onError } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isRetrying: false,
    retryCount: 0,
  });

  const handleError = useCallback(
    (error: unknown, context?: Record<string, unknown>) => {
      const errorInfo = createErrorInfo(error, { component, ...context });

      logError(error, { component, ...context });

      setErrorState((prev) => ({
        error: errorInfo,
        isRetrying: false,
        retryCount: prev.retryCount + 1,
      }));

      if (onError) {
        onError(errorInfo);
      }
    },
    [component, onError]
  );

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isRetrying: false,
      retryCount: 0,
    });
  }, []);

  const retryOperation = useCallback(
    async <T>(operation: () => Promise<T>, context?: Record<string, unknown>): Promise<T | null> => {
      if (!errorState.error?.retryable || errorState.retryCount >= maxRetries) {
        return null;
      }

      try {
        setErrorState((prev) => ({ ...prev, isRetrying: true }));

        const result = await retryWithBackoff(operation, maxRetries - errorState.retryCount, retryDelay, {
          component,
          ...context,
        });

        clearError();
        return result;
      } catch (error) {
        handleError(error, context);
        return null;
      } finally {
        setErrorState((prev) => ({ ...prev, isRetrying: false }));
      }
    },
    [errorState, maxRetries, retryDelay, component, handleError, clearError]
  );

  const executeWithErrorHandling = useCallback(
    async <T>(operation: () => Promise<T>, context?: Record<string, unknown>): Promise<T | null> => {
      try {
        clearError();
        return await operation();
      } catch (error) {
        handleError(error, context);
        return null;
      }
    },
    [handleError, clearError]
  );

  return {
    error: errorState.error,
    isRetrying: errorState.isRetrying,
    retryCount: errorState.retryCount,
    canRetry: errorState.error?.retryable && errorState.retryCount < maxRetries,
    handleError,
    clearError,
    retryOperation,
    executeWithErrorHandling,
  };
}
