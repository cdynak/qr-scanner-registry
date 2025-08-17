import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  NetworkError,
  CameraError,
  ScanError,
  RateLimitError,
  ErrorSeverity,
  createErrorInfo,
  logError,
  handleAsyncError,
  withErrorHandling,
  createApiErrorResponse,
  isRetryableError,
  getRetryDelay,
  retryWithBackoff,
  safeExecute,
  safeExecuteAsync,
} from '../../lib/errors';
import { DatabaseError, AuthenticationError, ValidationError } from '../../types';

describe('Error Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Custom Error Classes', () => {
    it('should create NetworkError with default message', () => {
      const error = new NetworkError();
      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Network request failed');
      expect(error.statusCode).toBeUndefined();
    });

    it('should create NetworkError with custom message and status code', () => {
      const error = new NetworkError('Custom network error', 404);
      expect(error.message).toBe('Custom network error');
      expect(error.statusCode).toBe(404);
    });

    it('should create CameraError with code', () => {
      const error = new CameraError('Camera not found', 'NotFoundError');
      expect(error.name).toBe('CameraError');
      expect(error.message).toBe('Camera not found');
      expect(error.code).toBe('NotFoundError');
    });

    it('should create ScanError with scan type', () => {
      const error = new ScanError('Failed to decode QR', 'qr');
      expect(error.name).toBe('ScanError');
      expect(error.scanType).toBe('qr');
    });

    it('should create RateLimitError with retry after', () => {
      const error = new RateLimitError('Too many requests', 60);
      expect(error.name).toBe('RateLimitError');
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('createErrorInfo', () => {
    it('should create error info for ValidationError', () => {
      const error = new ValidationError('Invalid input', 'email');
      const errorInfo = createErrorInfo(error);

      expect(errorInfo.name).toBe('ValidationError');
      expect(errorInfo.message).toBe('Invalid input');
      expect(errorInfo.severity).toBe(ErrorSeverity.LOW);
      expect(errorInfo.field).toBe('email');
      expect(errorInfo.userMessage).toBe('Please check your input and try again.');
      expect(errorInfo.timestamp).toBe('2024-01-01T12:00:00.000Z');
    });

    it('should create error info for NetworkError with status code', () => {
      const error = new NetworkError('Request failed', 500);
      const errorInfo = createErrorInfo(error);

      expect(errorInfo.name).toBe('NetworkError');
      expect(errorInfo.statusCode).toBe(500);
      expect(errorInfo.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should create error info for CameraError with code', () => {
      const error = new CameraError('Permission denied', 'PermissionDeniedError');
      const errorInfo = createErrorInfo(error);

      expect(errorInfo.name).toBe('CameraError');
      expect(errorInfo.code).toBe('PermissionDeniedError');
    });

    it('should create error info for RateLimitError', () => {
      const error = new RateLimitError('Rate limit exceeded', 30);
      const errorInfo = createErrorInfo(error);

      expect(errorInfo.name).toBe('RateLimitError');
      expect(errorInfo.statusCode).toBe(429);
    });

    it('should handle non-Error objects', () => {
      const errorInfo = createErrorInfo('String error');

      expect(errorInfo.name).toBe('UnknownError');
      expect(errorInfo.message).toBe('String error');
      expect(errorInfo.severity).toBe(ErrorSeverity.MEDIUM);
      expect(errorInfo.userMessage).toBe('An unexpected error occurred. Please try again.');
    });

    it('should handle null/undefined errors', () => {
      const errorInfo = createErrorInfo(null);

      expect(errorInfo.name).toBe('UnknownError');
      expect(errorInfo.message).toBe('null');
    });
  });

  describe('logError', () => {
    it('should log error to console in development', () => {
      const error = new ValidationError('Test error');
      const context = { userId: '123' };

      logError(error, context, true); // Explicitly set to development

      expect(console.error).toHaveBeenCalledWith('Error logged:', expect.objectContaining({
        name: 'ValidationError',
        message: 'Test error',
        context,
        stack: expect.any(String),
      }));
    });

    it('should not log to console in production', () => {
      const error = new ValidationError('Test error');

      logError(error, undefined, false); // Explicitly set to production

      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('handleAsyncError', () => {
    it('should resolve successful promise', async () => {
      const promise = Promise.resolve('success');
      const result = await handleAsyncError(promise);
      expect(result).toBe('success');
    });

    it('should log and re-throw error', async () => {
      const error = new Error('Test error');
      const promise = Promise.reject(error);
      const context = { test: true };

      await expect(handleAsyncError(promise, context, true)).rejects.toThrow('Test error');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('withErrorHandling', () => {
    it('should execute function successfully', () => {
      const fn = vi.fn().mockReturnValue('success');
      const wrappedFn = withErrorHandling(fn);

      const result = wrappedFn('arg1', 'arg2');

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should handle synchronous errors', () => {
      const error = new Error('Sync error');
      const fn = vi.fn().mockImplementation(() => { throw error; });
      const wrappedFn = withErrorHandling(fn, undefined, true);

      expect(() => wrappedFn()).toThrow('Sync error');
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle async function errors', async () => {
      const error = new Error('Async error');
      const fn = vi.fn().mockRejectedValue(error);
      const wrappedFn = withErrorHandling(fn, undefined, true);

      await expect(wrappedFn()).rejects.toThrow('Async error');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('createApiErrorResponse', () => {
    it('should create API error response', () => {
      const error = new ValidationError('Invalid input', 'email');
      const response = createApiErrorResponse(error, 400);

      expect(response).toEqual({
        error: 'Please check your input and try again.',
        message: 'Invalid input',
        code: undefined,
        field: 'email',
        timestamp: '2024-01-01T12:00:00.000Z',
        statusCode: 400,
      });
    });

    it('should use default status code', () => {
      const error = new Error('Generic error');
      const response = createApiErrorResponse(error);

      expect(response.statusCode).toBe(500);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable errors', () => {
      expect(isRetryableError(new NetworkError())).toBe(true);
      expect(isRetryableError(new DatabaseError('DB error'))).toBe(true);
      expect(isRetryableError(new ScanError())).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      expect(isRetryableError(new ValidationError('Invalid'))).toBe(false);
      expect(isRetryableError(new AuthenticationError())).toBe(false);
      expect(isRetryableError(new Error('Generic error'))).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should calculate exponential backoff delay', () => {
      expect(getRetryDelay(1, 1000)).toBe(1000);
      expect(getRetryDelay(2, 1000)).toBe(2000);
      expect(getRetryDelay(3, 1000)).toBe(4000);
      expect(getRetryDelay(4, 1000)).toBe(8000);
    });

    it('should cap delay at maximum', () => {
      expect(getRetryDelay(10, 1000)).toBe(30000); // Max 30 seconds
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn, 3);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry retryable errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new NetworkError())
        .mockRejectedValueOnce(new NetworkError())
        .mockResolvedValue('success');

      const resultPromise = retryWithBackoff(fn, 3, 100);
      
      // Fast-forward through the delays
      await vi.runAllTimersAsync();
      
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const error = new ValidationError('Invalid');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(retryWithBackoff(fn, 3)).rejects.toThrow('Invalid');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should fail after max attempts', async () => {
      const error = new NetworkError('Persistent error');
      const fn = vi.fn().mockRejectedValue(error);

      const resultPromise = retryWithBackoff(fn, 2, 100);
      
      // Fast-forward through the delays
      await vi.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow('Persistent error');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('safeExecute', () => {
    it('should return result for successful execution', () => {
      const fn = () => 'success';
      const { result, error } = safeExecute(fn);

      expect(result).toBe('success');
      expect(error).toBeUndefined();
    });

    it('should return error for failed execution', () => {
      const testError = new Error('Test error');
      const fn = () => { throw testError; };
      const { result, error } = safeExecute(fn);

      expect(result).toBeUndefined();
      expect(error).toBeDefined();
      expect(error?.name).toBe('Error');
      expect(error?.message).toBe('Test error');
    });
  });

  describe('safeExecuteAsync', () => {
    it('should return result for successful async execution', async () => {
      const fn = async () => 'success';
      const { result, error } = await safeExecuteAsync(fn);

      expect(result).toBe('success');
      expect(error).toBeUndefined();
    });

    it('should return error for failed async execution', async () => {
      const testError = new Error('Async error');
      const fn = async () => { throw testError; };
      const { result, error } = await safeExecuteAsync(fn);

      expect(result).toBeUndefined();
      expect(error).toBeDefined();
      expect(error?.name).toBe('Error');
      expect(error?.message).toBe('Async error');
    });
  });
});