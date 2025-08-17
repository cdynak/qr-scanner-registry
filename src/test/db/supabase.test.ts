import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockAuthGetUser = vi.fn();
const mockSupabaseClient = {
  auth: {
    getUser: mockAuthGetUser,
  },
};

const mockCreateClient = vi.fn(() => mockSupabaseClient);

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

describe('Supabase Client Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Environment Variables', () => {
    it('should have required environment variables', () => {
      expect(process.env.SUPABASE_URL).toBeDefined();
      expect(process.env.SUPABASE_ANON_KEY).toBeDefined();
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
    });
  });

  describe('Client Creation', () => {
    it('should create and export supabase client', async () => {
      const { supabase } = await import('../../db/supabase');
      expect(supabase).toBeDefined();
      expect(supabase.auth).toBeDefined();
    });

    it('should create server-side Supabase client', async () => {
      const { createServerSupabaseClient } = await import('../../db/supabase');
      const serverClient = createServerSupabaseClient();
      expect(serverClient).toBeDefined();
      expect(serverClient.auth).toBeDefined();
    });

    it('should throw error when creating server client without service role key', async () => {
      // Temporarily remove the service role key
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // Reset modules to get fresh import
      vi.resetModules();
      
      const { createServerSupabaseClient } = await import('../../db/supabase');

      expect(() => createServerSupabaseClient()).toThrow(
        'Missing SUPABASE_SERVICE_ROLE_KEY environment variable'
      );

      // Restore the key
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    });
  });

  describe('Authentication Helpers', () => {
    describe('getCurrentUser', () => {
      it('should return user when authentication is successful', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { name: 'Test User' },
        };

        mockAuthGetUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const { getCurrentUser } = await import('../../db/supabase');
        const user = await getCurrentUser();
        
        expect(user).toEqual(mockUser);
        expect(mockAuthGetUser).toHaveBeenCalledOnce();
      });

      it('should throw error when authentication fails', async () => {
        const mockError = { message: 'Invalid token' };

        mockAuthGetUser.mockResolvedValue({
          data: { user: null },
          error: mockError,
        });

        const { getCurrentUser } = await import('../../db/supabase');
        
        await expect(getCurrentUser()).rejects.toThrow(
          'Failed to get current user: Invalid token'
        );
      });
    });

    describe('isAuthenticated', () => {
      it('should return true when user is authenticated', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
        };

        mockAuthGetUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const { isAuthenticated } = await import('../../db/supabase');
        const result = await isAuthenticated();
        
        expect(result).toBe(true);
      });

      it('should return false when user is not authenticated', async () => {
        mockAuthGetUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'No user found' },
        });

        const { isAuthenticated } = await import('../../db/supabase');
        const result = await isAuthenticated();
        
        expect(result).toBe(false);
      });

      it('should return false when getCurrentUser throws an error', async () => {
        mockAuthGetUser.mockRejectedValue(new Error('Network error'));

        const { isAuthenticated } = await import('../../db/supabase');
        const result = await isAuthenticated();
        
        expect(result).toBe(false);
      });
    });
  });

  describe('Client Configuration', () => {
    it('should call createClient with correct parameters for client-side client', async () => {
      // Clear previous calls
      mockCreateClient.mockClear();
      
      // Reset modules to ensure fresh import
      vi.resetModules();
      
      // Import the module to trigger client creation
      await import('../../db/supabase');
      
      expect(mockCreateClient).toHaveBeenCalledWith(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
          },
        }
      );
    });

    it('should call createClient with service role key for server client', async () => {
      mockCreateClient.mockClear();
      
      const { createServerSupabaseClient } = await import('../../db/supabase');
      createServerSupabaseClient();
      
      expect(mockCreateClient).toHaveBeenCalledWith(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    });
  });
});