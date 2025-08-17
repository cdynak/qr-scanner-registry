import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequest } from '../../middleware/index';
import type { AuthSession } from '../../types';

// Mock the auth utilities
vi.mock('../../lib/auth', () => ({
  isSessionValid: vi.fn(),
}));

describe('Authentication Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set session data when valid session cookie exists', async () => {
    const { isSessionValid } = await import('../../lib/auth');
    (isSessionValid as any).mockReturnValue(true);

    const mockSession: AuthSession = {
      user: {
        id: '1',
        google_id: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      accessToken: 'mock-token',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    const mockCookies = {
      get: vi.fn().mockReturnValue({
        value: JSON.stringify(mockSession),
      }),
      delete: vi.fn(),
    };

    const mockLocals = {};
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'));

    const context = {
      cookies: mockCookies,
      locals: mockLocals,
    };

    await onRequest(context as any, mockNext);

    expect(mockCookies.get).toHaveBeenCalledWith('session');
    expect(isSessionValid).toHaveBeenCalledWith(mockSession);
    expect(mockLocals).toEqual({
      session: mockSession,
      user: mockSession.user,
      isAuthenticated: true,
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should clear invalid session cookie and set null values', async () => {
    const { isSessionValid } = await import('../../lib/auth');
    (isSessionValid as any).mockReturnValue(false);

    const invalidSession = {
      user: { id: '1', name: 'Test' },
      accessToken: 'expired-token',
      expiresAt: '2020-01-01T00:00:00Z', // Expired
    };

    const mockCookies = {
      get: vi.fn().mockReturnValue({
        value: JSON.stringify(invalidSession),
      }),
      delete: vi.fn(),
    };

    const mockLocals = {};
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'));

    const context = {
      cookies: mockCookies,
      locals: mockLocals,
    };

    await onRequest(context as any, mockNext);

    expect(mockCookies.get).toHaveBeenCalledWith('session');
    expect(mockCookies.delete).toHaveBeenCalledWith('session', { path: '/' });
    expect(mockLocals).toEqual({
      session: null,
      user: null,
      isAuthenticated: false,
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle malformed session cookie', async () => {
    const mockCookies = {
      get: vi.fn().mockReturnValue({
        value: 'invalid-json',
      }),
      delete: vi.fn(),
    };

    const mockLocals = {};
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'));

    const context = {
      cookies: mockCookies,
      locals: mockLocals,
    };

    // Mock console.error to avoid test output noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await onRequest(context as any, mockNext);

    expect(mockCookies.get).toHaveBeenCalledWith('session');
    expect(mockCookies.delete).toHaveBeenCalledWith('session', { path: '/' });
    expect(consoleSpy).toHaveBeenCalledWith('Error parsing session cookie:', expect.any(Error));
    expect(mockLocals).toEqual({
      session: null,
      user: null,
      isAuthenticated: false,
    });
    expect(mockNext).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should handle missing session cookie', async () => {
    const mockCookies = {
      get: vi.fn().mockReturnValue(undefined),
      delete: vi.fn(),
    };

    const mockLocals = {};
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'));

    const context = {
      cookies: mockCookies,
      locals: mockLocals,
    };

    await onRequest(context as any, mockNext);

    expect(mockCookies.get).toHaveBeenCalledWith('session');
    expect(mockCookies.delete).not.toHaveBeenCalled();
    expect(mockLocals).toEqual({
      session: null,
      user: null,
      isAuthenticated: false,
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle null session cookie value', async () => {
    const mockCookies = {
      get: vi.fn().mockReturnValue(null),
      delete: vi.fn(),
    };

    const mockLocals = {};
    const mockNext = vi.fn().mockResolvedValue(new Response('OK'));

    const context = {
      cookies: mockCookies,
      locals: mockLocals,
    };

    await onRequest(context as any, mockNext);

    expect(mockCookies.get).toHaveBeenCalledWith('session');
    expect(mockLocals).toEqual({
      session: null,
      user: null,
      isAuthenticated: false,
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should pass through response from next middleware', async () => {
    const { isSessionValid } = await import('../../lib/auth');
    (isSessionValid as any).mockReturnValue(true);

    const mockResponse = new Response('Custom Response', { status: 201 });
    const mockNext = vi.fn().mockResolvedValue(mockResponse);

    const mockCookies = {
      get: vi.fn().mockReturnValue({
        value: JSON.stringify({
          user: { id: '1', name: 'Test' },
          accessToken: 'token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        }),
      }),
      delete: vi.fn(),
    };

    const context = {
      cookies: mockCookies,
      locals: {},
    };

    const result = await onRequest(context as any, mockNext);

    expect(result).toBe(mockResponse);
    expect(result.status).toBe(201);
  });
});