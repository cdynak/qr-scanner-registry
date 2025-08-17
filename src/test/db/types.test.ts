import { describe, it, expect } from 'vitest';
import type { Database, User, Scan, ScanInsert, UserInsert } from '../../db/types';

describe('Database Types', () => {
  describe('User Types', () => {
    it('should have correct User type structure', () => {
      const mockUser: User = {
        id: 'user-123',
        google_id: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(mockUser.id).toBe('user-123');
      expect(mockUser.google_id).toBe('google-123');
      expect(mockUser.email).toBe('test@example.com');
      expect(mockUser.name).toBe('Test User');
      expect(mockUser.avatar_url).toBe('https://example.com/avatar.jpg');
      expect(mockUser.created_at).toBe('2024-01-01T00:00:00Z');
      expect(mockUser.updated_at).toBe('2024-01-01T00:00:00Z');
    });

    it('should allow null avatar_url in User type', () => {
      const mockUser: User = {
        id: 'user-123',
        google_id: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(mockUser.avatar_url).toBeNull();
    });

    it('should have correct UserInsert type structure', () => {
      const mockUserInsert: UserInsert = {
        google_id: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      expect(mockUserInsert.google_id).toBe('google-123');
      expect(mockUserInsert.email).toBe('test@example.com');
      expect(mockUserInsert.name).toBe('Test User');
    });

    it('should allow optional fields in UserInsert type', () => {
      const mockUserInsert: UserInsert = {
        id: 'custom-id',
        google_id: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(mockUserInsert.id).toBe('custom-id');
      expect(mockUserInsert.avatar_url).toBe('https://example.com/avatar.jpg');
    });
  });

  describe('Scan Types', () => {
    it('should have correct Scan type structure', () => {
      const mockScan: Scan = {
        id: 'scan-123',
        user_id: 'user-123',
        content: 'https://example.com',
        scan_type: 'qr',
        format: 'QR_CODE',
        scanned_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(mockScan.id).toBe('scan-123');
      expect(mockScan.user_id).toBe('user-123');
      expect(mockScan.content).toBe('https://example.com');
      expect(mockScan.scan_type).toBe('qr');
      expect(mockScan.format).toBe('QR_CODE');
      expect(mockScan.scanned_at).toBe('2024-01-01T00:00:00Z');
      expect(mockScan.created_at).toBe('2024-01-01T00:00:00Z');
    });

    it('should allow barcode scan_type', () => {
      const mockScan: Scan = {
        id: 'scan-123',
        user_id: 'user-123',
        content: '1234567890123',
        scan_type: 'barcode',
        format: 'EAN13',
        scanned_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(mockScan.scan_type).toBe('barcode');
      expect(mockScan.format).toBe('EAN13');
    });

    it('should allow null format in Scan type', () => {
      const mockScan: Scan = {
        id: 'scan-123',
        user_id: 'user-123',
        content: 'Some content',
        scan_type: 'qr',
        format: null,
        scanned_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(mockScan.format).toBeNull();
    });

    it('should have correct ScanInsert type structure', () => {
      const mockScanInsert: ScanInsert = {
        user_id: 'user-123',
        content: 'https://example.com',
        scan_type: 'qr',
      };

      expect(mockScanInsert.user_id).toBe('user-123');
      expect(mockScanInsert.content).toBe('https://example.com');
      expect(mockScanInsert.scan_type).toBe('qr');
    });

    it('should allow optional fields in ScanInsert type', () => {
      const mockScanInsert: ScanInsert = {
        id: 'custom-id',
        user_id: 'user-123',
        content: 'https://example.com',
        scan_type: 'qr',
        format: 'QR_CODE',
        scanned_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(mockScanInsert.id).toBe('custom-id');
      expect(mockScanInsert.format).toBe('QR_CODE');
      expect(mockScanInsert.scanned_at).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('Database Schema', () => {
    it('should have correct database structure', () => {
      // This test ensures the Database type has the expected structure
      const mockDatabase = {} as Database;
      
      // Check that the structure exists (TypeScript compilation will catch issues)
      expect(mockDatabase).toBeDefined();
      
      // Test that we can access the expected table types
      type UsersTable = Database['public']['Tables']['users'];
      type ScansTable = Database['public']['Tables']['scans'];
      type ScanTypeEnum = Database['public']['Enums']['scan_type'];
      
      // These should compile without errors
      const usersTable = {} as UsersTable;
      const scansTable = {} as ScansTable;
      const scanTypeEnum = 'qr' as ScanTypeEnum;
      
      expect(usersTable).toBeDefined();
      expect(scansTable).toBeDefined();
      expect(scanTypeEnum).toBe('qr');
    });
  });
});