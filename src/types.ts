// Re-export database types for convenience
export type { User, UserInsert, UserUpdate, Scan, ScanInsert, ScanUpdate, ScanType } from './db/types';

// Re-export utility functions and error types
export * from './lib/auth';
export * from './lib/validation';
export * from './lib/errors';

// Additional application-specific types
export interface ScanCreateRequest {
  content: string;
  scanType: 'qr' | 'barcode';
  format?: string;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  expiresAt: string;
}

export interface ScanHistoryFilters {
  scanType?: 'qr' | 'barcode';
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

// Error types
export class DatabaseError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}