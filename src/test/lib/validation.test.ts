import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  validateScanContent,
  validateScanType,
  validateScanFormat,
  validateScanCreateRequest,
  validateUserName,
  validateGoogleId,
  validateAvatarUrl,
  validatePaginationParams,
  validateDateString,
  sanitizeString,
  validateSearchQuery,
} from '../../lib/validation';
import { ValidationError } from '../../types';

describe('Validation Utilities', () => {
  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('user123@test-domain.org')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test..test@example.com')).toBe(false);
      expect(isValidEmail(null as any)).toBe(false);
      expect(isValidEmail(undefined as any)).toBe(false);
    });

    it('should handle emails with whitespace', () => {
      expect(isValidEmail(' test@example.com ')).toBe(true);
    });
  });

  describe('validateScanContent', () => {
    it('should pass for valid content', () => {
      expect(() => validateScanContent('Valid QR content')).not.toThrow();
      expect(() => validateScanContent('https://example.com')).not.toThrow();
    });

    it('should throw ValidationError for empty content', () => {
      expect(() => validateScanContent('')).toThrow(ValidationError);
      expect(() => validateScanContent('   ')).toThrow(ValidationError);
      expect(() => validateScanContent(null as any)).toThrow(ValidationError);
      expect(() => validateScanContent(undefined as any)).toThrow(ValidationError);
    });

    it('should throw ValidationError for content that is too long', () => {
      const longContent = 'a'.repeat(10001);
      expect(() => validateScanContent(longContent)).toThrow(ValidationError);
      expect(() => validateScanContent(longContent)).toThrow('too long');
    });

    it('should throw ValidationError for non-string content', () => {
      expect(() => validateScanContent(123 as any)).toThrow(ValidationError);
      expect(() => validateScanContent({} as any)).toThrow(ValidationError);
    });
  });

  describe('validateScanType', () => {
    it('should return true for valid scan types', () => {
      expect(validateScanType('qr')).toBe(true);
      expect(validateScanType('barcode')).toBe(true);
    });

    it('should return false for invalid scan types', () => {
      expect(validateScanType('invalid')).toBe(false);
      expect(validateScanType('')).toBe(false);
      expect(validateScanType(null)).toBe(false);
      expect(validateScanType(undefined)).toBe(false);
      expect(validateScanType(123)).toBe(false);
    });
  });

  describe('validateScanFormat', () => {
    it('should pass for valid formats', () => {
      expect(() => validateScanFormat('QR_CODE')).not.toThrow();
      expect(() => validateScanFormat('CODE_128')).not.toThrow();
      expect(() => validateScanFormat(null)).not.toThrow();
      expect(() => validateScanFormat(undefined)).not.toThrow();
    });

    it('should throw ValidationError for invalid formats', () => {
      expect(() => validateScanFormat('')).toThrow(ValidationError);
      expect(() => validateScanFormat('   ')).toThrow(ValidationError);
      expect(() => validateScanFormat(123 as any)).toThrow(ValidationError);
    });

    it('should throw ValidationError for format that is too long', () => {
      const longFormat = 'a'.repeat(101);
      expect(() => validateScanFormat(longFormat)).toThrow(ValidationError);
    });
  });

  describe('validateScanCreateRequest', () => {
    const validRequest = {
      content: 'Valid content',
      scanType: 'qr' as const,
      format: 'QR_CODE',
    };

    it('should return validated request for valid input', () => {
      const result = validateScanCreateRequest(validRequest);
      expect(result).toEqual({
        content: 'Valid content',
        scanType: 'qr',
        format: 'QR_CODE',
      });
    });

    it('should trim whitespace from content and format', () => {
      const request = {
        content: '  Valid content  ',
        scanType: 'qr' as const,
        format: '  QR_CODE  ',
      };
      const result = validateScanCreateRequest(request);
      expect(result.content).toBe('Valid content');
      expect(result.format).toBe('QR_CODE');
    });

    it('should handle undefined format', () => {
      const request = {
        content: 'Valid content',
        scanType: 'qr' as const,
      };
      const result = validateScanCreateRequest(request);
      expect(result.format).toBeUndefined();
    });

    it('should throw ValidationError for invalid request format', () => {
      expect(() => validateScanCreateRequest(null)).toThrow(ValidationError);
      expect(() => validateScanCreateRequest('string')).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid content', () => {
      const request = { ...validRequest, content: '' };
      expect(() => validateScanCreateRequest(request)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid scan type', () => {
      const request = { ...validRequest, scanType: 'invalid' };
      expect(() => validateScanCreateRequest(request)).toThrow(ValidationError);
    });
  });

  describe('validateUserName', () => {
    it('should pass for valid names', () => {
      expect(() => validateUserName('John Doe')).not.toThrow();
      expect(() => validateUserName('Alice')).not.toThrow();
    });

    it('should throw ValidationError for invalid names', () => {
      expect(() => validateUserName('')).toThrow(ValidationError);
      expect(() => validateUserName('   ')).toThrow(ValidationError);
      expect(() => validateUserName(null as any)).toThrow(ValidationError);
      expect(() => validateUserName(undefined as any)).toThrow(ValidationError);
    });

    it('should throw ValidationError for name that is too long', () => {
      const longName = 'a'.repeat(256);
      expect(() => validateUserName(longName)).toThrow(ValidationError);
    });
  });

  describe('validateGoogleId', () => {
    it('should pass for valid Google IDs', () => {
      expect(() => validateGoogleId('123456789012345678901')).not.toThrow();
      expect(() => validateGoogleId('1')).not.toThrow();
    });

    it('should throw ValidationError for invalid Google IDs', () => {
      expect(() => validateGoogleId('')).toThrow(ValidationError);
      expect(() => validateGoogleId('   ')).toThrow(ValidationError);
      expect(() => validateGoogleId('abc123')).toThrow(ValidationError);
      expect(() => validateGoogleId('123-456')).toThrow(ValidationError);
      expect(() => validateGoogleId(null as any)).toThrow(ValidationError);
    });
  });

  describe('validateAvatarUrl', () => {
    it('should pass for valid URLs', () => {
      expect(() => validateAvatarUrl('https://example.com/avatar.jpg')).not.toThrow();
      expect(() => validateAvatarUrl('http://localhost:3000/image.png')).not.toThrow();
      expect(() => validateAvatarUrl(null)).not.toThrow();
      expect(() => validateAvatarUrl(undefined)).not.toThrow();
    });

    it('should throw ValidationError for invalid URLs', () => {
      expect(() => validateAvatarUrl('')).toThrow(ValidationError);
      expect(() => validateAvatarUrl('   ')).toThrow(ValidationError);
      expect(() => validateAvatarUrl('not-a-url')).toThrow(ValidationError);
      expect(() => validateAvatarUrl(123 as any)).toThrow(ValidationError);
    });
  });

  describe('validatePaginationParams', () => {
    it('should return default values for empty params', () => {
      const result = validatePaginationParams({});
      expect(result).toEqual({ limit: 20, offset: 0 });
    });

    it('should return provided valid values', () => {
      const result = validatePaginationParams({ limit: 50, offset: 100 });
      expect(result).toEqual({ limit: 50, offset: 100 });
    });

    it('should throw ValidationError for invalid limit', () => {
      expect(() => validatePaginationParams({ limit: 0 })).toThrow(ValidationError);
      expect(() => validatePaginationParams({ limit: 101 })).toThrow(ValidationError);
      expect(() => validatePaginationParams({ limit: -1 })).toThrow(ValidationError);
      expect(() => validatePaginationParams({ limit: 1.5 })).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid offset', () => {
      expect(() => validatePaginationParams({ offset: -1 })).toThrow(ValidationError);
      expect(() => validatePaginationParams({ offset: 1.5 })).toThrow(ValidationError);
    });
  });

  describe('validateDateString', () => {
    it('should pass for valid date strings', () => {
      expect(() => validateDateString('2024-01-01T00:00:00Z', 'date')).not.toThrow();
      expect(() => validateDateString('2024-12-31', 'date')).not.toThrow();
    });

    it('should throw ValidationError for invalid date strings', () => {
      expect(() => validateDateString('', 'date')).toThrow(ValidationError);
      expect(() => validateDateString('invalid-date', 'date')).toThrow(ValidationError);
      expect(() => validateDateString('2024-13-01', 'date')).toThrow(ValidationError);
      expect(() => validateDateString(null as any, 'date')).toThrow(ValidationError);
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello world  ')).toBe('hello world');
    });

    it('should remove control characters', () => {
      expect(sanitizeString('hello\x00\x1F\x7Fworld')).toBe('helloworld');
    });

    it('should normalize whitespace', () => {
      expect(sanitizeString('hello   \t\n  world')).toBe('hello world');
    });

    it('should handle non-string input', () => {
      expect(sanitizeString(123 as any)).toBe('');
      expect(sanitizeString(null as any)).toBe('');
    });
  });

  describe('validateSearchQuery', () => {
    it('should return sanitized query for valid input', () => {
      expect(validateSearchQuery('  hello world  ')).toBe('hello world');
    });

    it('should throw ValidationError for empty query', () => {
      expect(() => validateSearchQuery('')).toThrow(ValidationError);
      expect(() => validateSearchQuery('   ')).toThrow(ValidationError);
      expect(() => validateSearchQuery(null as any)).toThrow(ValidationError);
    });

    it('should throw ValidationError for query that is too long', () => {
      const longQuery = 'a'.repeat(501);
      expect(() => validateSearchQuery(longQuery)).toThrow(ValidationError);
    });
  });
});