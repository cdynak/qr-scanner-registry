import { DatabaseError, AuthenticationError, ValidationError } from '../types';

/**
 * Error handling utilities with custom error types
 */

/**
 * Additional custom error types
 */
export class NetworkError extends Error {
  constructor(message: string = 'Network request failed', public statusCode?: number) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class CameraError extends Error {
  constructor(message: string = 'Camera access failed', public code?: string) {
    super(message);
    this.name = 'CameraError';
  }
}

export class ScanError extends Error {
  constructor(message: string = 'Scan processing failed', public scanType?: string) {
    super(message);
    this.name = 'ScanError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded', public retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Structured error information
 */
export interface ErrorInfo {
  name: string;
  message: string;
  severity: ErrorSeverity;
  code?: string;
  field?: string;
  statusCode?: number;
  timestamp: string;
  userMessage: string;
}

/**
 * Maps error types to user-friendly messages
 */
const ERROR_USER_MESSAGES: Record<string, string> = {
  DatabaseError: 'We\'re having trouble accessing your data. Please try again.',
  AuthenticationError: 'Please log in to continue.',
  ValidationError: 'Please check your input and try again.',
  NetworkError: 'Connection failed. Please check your internet and try again.',
  CameraError: 'Camera access is required for scanning. Please allow camera permissions.',
  ScanError: 'Unable to scan the code. Please try again with better lighting.',
  RateLimitError: 'Too many requests. Please wait a moment and try again.',
};

/**
 * Maps error types to severity levels
 */
const ERROR_SEVERITIES: Record<string, ErrorSeverity> = {
  DatabaseError: ErrorSeverity.HIGH,
  AuthenticationError: ErrorSeverity.MEDIUM,
  ValidationError: ErrorSeverity.LOW,
  NetworkError: ErrorSeverity.MEDIUM,
  CameraError: ErrorSeverity.MEDIUM,
  ScanError: ErrorSeverity.LOW,
  RateLimitError: ErrorSeverity.MEDIUM,
};

/**
 * Converts any error to structured error information
 */
export function createErrorInfo(error: unknown): ErrorInfo {
  const timestamp = new Date().toISOString();
  
  if (error instanceof Error) {
    const severity = ERROR_SEVERITIES[error.name] || ErrorSeverity.MEDIUM;
    const userMessage = ERROR_USER_MESSAGES[error.name] || 'An unexpected error occurred. Please try again.';
    
    const errorInfo: ErrorInfo = {
      name: error.name,
      message: error.message,
      severity,
      timestamp,
      userMessage,
    };
    
    // Add specific properties based on error type
    if (error instanceof ValidationError && error.field) {
      errorInfo.field = error.field;
    }
    
    if (error instanceof NetworkError && error.statusCode) {
      errorInfo.statusCode = error.statusCode;
    }
    
    if (error instanceof CameraError && error.code) {
      errorInfo.code = error.code;
    }
    
    if (error instanceof RateLimitError && error.retryAfter) {
      errorInfo.statusCode = 429;
    }
    
    return errorInfo;
  }
  
  // Handle non-Error objects
  return {
    name: 'UnknownError',
    message: String(error),
    severity: ErrorSeverity.MEDIUM,
    timestamp,
    userMessage: 'An unexpected error occurred. Please try again.',
  };
}

/**
 * Logs error information to console (in development) or external service (in production)
 */
export function logError(error: unknown, context?: Record<string, any>, isDev?: boolean): void {
  const errorInfo = createErrorInfo(error);
  
  const logData = {
    ...errorInfo,
    context,
    stack: error instanceof Error ? error.stack : undefined,
  };
  
  // In development, log to console
  // Check for DEV environment variable or NODE_ENV, or use provided isDev parameter
  const shouldLog = isDev !== undefined ? isDev : 
    ((typeof import.meta !== 'undefined' && import.meta.env?.DEV) || 
     process.env.NODE_ENV === 'development');
  
  if (shouldLog) {
    console.error('Error logged:', logData);
  }
  
  // In production, you would send to an external logging service
  // Example: sendToLoggingService(logData);
}

/**
 * Handles errors in async functions with proper logging
 */
export function handleAsyncError<T>(
  promise: Promise<T>,
  context?: Record<string, any>,
  isDev?: boolean
): Promise<T> {
  return promise.catch((error) => {
    logError(error, context, isDev);
    throw error;
  });
}

/**
 * Wraps a function to catch and handle errors
 */
export function withErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  context?: Record<string, any>,
  isDev?: boolean
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);
      
      // Handle async functions
      if (result instanceof Promise) {
        return handleAsyncError(result, context, isDev);
      }
      
      return result;
    } catch (error) {
      logError(error, context, isDev);
      throw error;
    }
  }) as T;
}

/**
 * Creates a standardized API error response
 */
export function createApiErrorResponse(error: unknown, statusCode?: number) {
  const errorInfo = createErrorInfo(error);
  
  return {
    error: errorInfo.userMessage,
    message: errorInfo.message,
    code: errorInfo.code,
    field: errorInfo.field,
    timestamp: errorInfo.timestamp,
    statusCode: statusCode || errorInfo.statusCode || 500,
  };
}

/**
 * Determines if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof NetworkError) {
    return true;
  }
  
  if (error instanceof DatabaseError) {
    return true;
  }
  
  if (error instanceof ScanError) {
    return true;
  }
  
  return false;
}

/**
 * Gets retry delay in milliseconds with exponential backoff
 */
export function getRetryDelay(attempt: number, baseDelay: number = 1000): number {
  const maxDelay = 30000; // 30 seconds max
  const delay = baseDelay * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Retries a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000,
  context?: Record<string, any>,
  isDev?: boolean
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts || !isRetryableError(error)) {
        logError(error, { ...context, attempt, maxAttempts }, isDev);
        throw error;
      }
      
      const delay = getRetryDelay(attempt, baseDelay);
      logError(error, { ...context, attempt, maxAttempts, retryDelay: delay }, isDev);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Safely executes a function and returns result or error
 */
export function safeExecute<T>(fn: () => T): { result?: T; error?: ErrorInfo } {
  try {
    const result = fn();
    return { result };
  } catch (error) {
    return { error: createErrorInfo(error) };
  }
}

/**
 * Safely executes an async function and returns result or error
 */
export async function safeExecuteAsync<T>(
  fn: () => Promise<T>
): Promise<{ result?: T; error?: ErrorInfo }> {
  try {
    const result = await fn();
    return { result };
  } catch (error) {
    return { error: createErrorInfo(error) };
  }
}