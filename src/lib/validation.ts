import type { ScanCreateRequest, ScanType } from '../types';
import { ValidationError } from '../types';

/**
 * Data validation utilities for scan content and user input
 */

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const trimmedEmail = email.trim();
  
  // Basic email validation - no consecutive dots, proper format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Check for consecutive dots which are invalid
  if (trimmedEmail.includes('..')) {
    return false;
  }
  
  return emailRegex.test(trimmedEmail);
}

/**
 * Validates scan content is not empty and within reasonable limits
 */
export function validateScanContent(content: string): void {
  if (!content || typeof content !== 'string') {
    throw new ValidationError('Scan content is required', 'content');
  }
  
  const trimmedContent = content.trim();
  
  if (trimmedContent.length === 0) {
    throw new ValidationError('Scan content cannot be empty', 'content');
  }
  
  if (trimmedContent.length > 10000) {
    throw new ValidationError('Scan content is too long (max 10,000 characters)', 'content');
  }
}

/**
 * Validates scan type is one of the allowed values
 */
export function validateScanType(scanType: any): scanType is ScanType {
  return scanType === 'qr' || scanType === 'barcode';
}

/**
 * Validates scan format string
 */
export function validateScanFormat(format: string | null | undefined): void {
  if (format !== null && format !== undefined) {
    if (typeof format !== 'string') {
      throw new ValidationError('Scan format must be a string', 'format');
    }
    
    if (format.trim().length === 0) {
      throw new ValidationError('Scan format cannot be empty', 'format');
    }
    
    if (format.length > 100) {
      throw new ValidationError('Scan format is too long (max 100 characters)', 'format');
    }
  }
}

/**
 * Validates a complete scan create request
 */
export function validateScanCreateRequest(request: any): ScanCreateRequest {
  if (!request || typeof request !== 'object') {
    throw new ValidationError('Invalid request format');
  }
  
  // Validate content
  validateScanContent(request.content);
  
  // Validate scan type
  if (!validateScanType(request.scanType)) {
    throw new ValidationError('Invalid scan type. Must be "qr" or "barcode"', 'scanType');
  }
  
  // Validate format if provided
  validateScanFormat(request.format);
  
  return {
    content: request.content.trim(),
    scanType: request.scanType,
    format: request.format?.trim() || undefined,
  };
}

/**
 * Validates user name
 */
export function validateUserName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Name is required', 'name');
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length === 0) {
    throw new ValidationError('Name cannot be empty', 'name');
  }
  
  if (trimmedName.length > 255) {
    throw new ValidationError('Name is too long (max 255 characters)', 'name');
  }
}

/**
 * Validates Google ID format
 */
export function validateGoogleId(googleId: string): void {
  if (!googleId || typeof googleId !== 'string') {
    throw new ValidationError('Google ID is required', 'googleId');
  }
  
  const trimmedId = googleId.trim();
  
  if (trimmedId.length === 0) {
    throw new ValidationError('Google ID cannot be empty', 'googleId');
  }
  
  // Google IDs are typically numeric strings
  if (!/^\d+$/.test(trimmedId)) {
    throw new ValidationError('Invalid Google ID format', 'googleId');
  }
}

/**
 * Validates avatar URL format
 */
export function validateAvatarUrl(url: string | null | undefined): void {
  if (url !== null && url !== undefined) {
    if (typeof url !== 'string') {
      throw new ValidationError('Avatar URL must be a string', 'avatarUrl');
    }
    
    const trimmedUrl = url.trim();
    
    if (trimmedUrl.length === 0) {
      throw new ValidationError('Avatar URL cannot be empty', 'avatarUrl');
    }
    
    // Basic URL validation
    try {
      new URL(trimmedUrl);
    } catch {
      throw new ValidationError('Invalid avatar URL format', 'avatarUrl');
    }
  }
}

/**
 * Validates pagination parameters
 */
export function validatePaginationParams(params: {
  limit?: number;
  offset?: number;
}): { limit: number; offset: number } {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ValidationError('Limit must be an integer between 1 and 100', 'limit');
  }
  
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ValidationError('Offset must be a non-negative integer', 'offset');
  }
  
  return { limit, offset };
}

/**
 * Validates date string format (ISO 8601)
 */
export function validateDateString(dateString: string, fieldName: string): void {
  if (!dateString || typeof dateString !== 'string') {
    throw new ValidationError(`${fieldName} must be a valid date string`, fieldName);
  }
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid ISO date string`, fieldName);
  }
}

/**
 * Sanitizes string input by trimming and removing potentially harmful characters
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Validates and sanitizes search query
 */
export function validateSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    throw new ValidationError('Search query is required', 'query');
  }
  
  const sanitized = sanitizeString(query);
  
  if (sanitized.length === 0) {
    throw new ValidationError('Search query cannot be empty', 'query');
  }
  
  if (sanitized.length > 500) {
    throw new ValidationError('Search query is too long (max 500 characters)', 'query');
  }
  
  return sanitized;
}