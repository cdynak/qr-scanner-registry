import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../../../pages/api/auth/logout';

describe('Logout API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/logout', () => {
    it('should clear session cookie and redirect to home', async () => {
      const mockResponse = {
        headers: new Map(),
      };
      const mockRedirect = vi.fn().mockReturnValue(mockResponse);
      
      const context = {
        redirect: mockRedirect,
      };

      const response = await POST(context as any);

      expect(mockRedirect).toHaveBeenCalledWith('/?logout=success');
      expect(mockResponse.headers.get('Set-Cookie')).toBe(
        'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
      );
    });

    it('should handle errors gracefully and still clear cookie', async () => {
      const mockResponse = {
        headers: new Map(),
      };
      const mockRedirect = vi.fn()
        .mockImplementationOnce(() => {
          throw new Error('Redirect failed');
        })
        .mockReturnValue(mockResponse);
      
      const context = {
        redirect: mockRedirect,
      };

      // Mock console.error to avoid test output noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await POST(context as any);

      expect(consoleSpy).toHaveBeenCalledWith('Logout error:', expect.any(Error));
      expect(mockRedirect).toHaveBeenCalledWith('/?error=logout_failed');
      expect(mockResponse.headers.get('Set-Cookie')).toBe(
        'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
      );

      consoleSpy.mockRestore();
    });

    it('should set correct cookie expiration format', async () => {
      const mockResponse = {
        headers: new Map(),
      };
      const mockRedirect = vi.fn().mockReturnValue(mockResponse);
      
      const context = {
        redirect: mockRedirect,
      };

      await POST(context as any);

      const setCookieHeader = mockResponse.headers.get('Set-Cookie');
      expect(setCookieHeader).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('SameSite=Lax');
      expect(setCookieHeader).toContain('Path=/');
    });
  });

  describe('GET /api/auth/logout', () => {
    it('should redirect to home page', async () => {
      const mockRedirect = vi.fn().mockReturnValue(new Response('', { status: 302 }));
      
      const context = {
        redirect: mockRedirect,
      };

      const response = await GET(context as any);

      expect(mockRedirect).toHaveBeenCalledWith('/', 302);
      expect(response.status).toBe(302);
    });
  });
});