import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createAuthSession,
  isSessionValid,
  isSessionExpired,
  getSessionTimeRemaining,
  validateUser,
  requireValidSession,
  getUserFromSession,
  getSessionCookieOptions,
  generateSessionToken,
} from '../../lib/auth';
import type { User, AuthSession } from '../../types';
import { AuthenticationError } from '../../types';

describe('Auth Utilities', () => {
  const mockUser: User = {
    id: 'user-123',
    google_id: '123456789',
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createAuthSession', () => {
    it('should create a valid auth session with default expiration', () => {
      const session = createAuthSession(mockUser, 'token123');
      
      expect(session.user).toEqual(mockUser);
      expect(session.accessToken).toBe('token123');
      expect(session.expiresAt).toBe('2024-01-01T13:00:00.000Z'); // 1 hour later
    });

    it('should create a session with custom expiration time', () => {
      const session = createAuthSession(mockUser, 'token123', 7200); // 2 hours
      
      expect(session.expiresAt).toBe('2024-01-01T14:00:00.000Z'); // 2 hours later
    });
  });

  describe('isSessionValid', () => {
    it('should return true for valid session', () => {
      const session = createAuthSession(mockUser, 'token123');
      expect(isSessionValid(session)).toBe(true);
    });

    it('should return false for expired session', () => {
      const session = createAuthSession(mockUser, 'token123', -3600); // Expired 1 hour ago
      expect(isSessionValid(session)).toBe(false);
    });

    it('should return false for session without expiresAt', () => {
      const session = { user: mockUser, accessToken: 'token123' } as AuthSession;
      expect(isSessionValid(session)).toBe(false);
    });

    it('should return false for null session', () => {
      expect(isSessionValid(null as any)).toBe(false);
    });
  });

  describe('isSessionExpired', () => {
    it('should return false for valid session', () => {
      const session = createAuthSession(mockUser, 'token123');
      expect(isSessionExpired(session)).toBe(false);
    });

    it('should return true for expired session', () => {
      const session = createAuthSession(mockUser, 'token123', -3600);
      expect(isSessionExpired(session)).toBe(true);
    });
  });

  describe('getSessionTimeRemaining', () => {
    it('should return correct remaining time for valid session', () => {
      const session = createAuthSession(mockUser, 'token123', 1800); // 30 minutes
      expect(getSessionTimeRemaining(session)).toBe(1800);
    });

    it('should return 0 for expired session', () => {
      const session = createAuthSession(mockUser, 'token123', -3600);
      expect(getSessionTimeRemaining(session)).toBe(0);
    });

    it('should return 0 for session without expiresAt', () => {
      const session = { user: mockUser, accessToken: 'token123' } as AuthSession;
      expect(getSessionTimeRemaining(session)).toBe(0);
    });
  });

  describe('validateUser', () => {
    it('should return true for valid user', () => {
      expect(validateUser(mockUser)).toBe(true);
    });

    it('should return false for null user', () => {
      expect(validateUser(null)).toBe(false);
    });

    it('should return false for user missing required fields', () => {
      const invalidUser = { ...mockUser };
      delete (invalidUser as any).email;
      expect(validateUser(invalidUser)).toBe(false);
    });

    it('should return false for user with empty required fields', () => {
      const invalidUser = { ...mockUser, name: '' };
      expect(validateUser(invalidUser)).toBe(false);
    });

    it('should return false for non-object input', () => {
      expect(validateUser('not an object')).toBe(false);
    });
  });

  describe('requireValidSession', () => {
    it('should return user for valid session', () => {
      const session = createAuthSession(mockUser, 'token123');
      const user = requireValidSession(session);
      expect(user).toEqual(mockUser);
    });

    it('should throw AuthenticationError for null session', () => {
      expect(() => requireValidSession(null)).toThrow(AuthenticationError);
      expect(() => requireValidSession(null)).toThrow('No session provided');
    });

    it('should throw AuthenticationError for expired session', () => {
      const session = createAuthSession(mockUser, 'token123', -3600);
      expect(() => requireValidSession(session)).toThrow(AuthenticationError);
      expect(() => requireValidSession(session)).toThrow('Session has expired');
    });

    it('should throw AuthenticationError for invalid user data', () => {
      const session = createAuthSession({ ...mockUser, email: '' }, 'token123');
      expect(() => requireValidSession(session)).toThrow(AuthenticationError);
      expect(() => requireValidSession(session)).toThrow('Invalid user data in session');
    });
  });

  describe('getUserFromSession', () => {
    it('should return user for valid session', () => {
      const session = createAuthSession(mockUser, 'token123');
      const user = getUserFromSession(session);
      expect(user).toEqual(mockUser);
    });

    it('should return null for invalid session', () => {
      const user = getUserFromSession(null);
      expect(user).toBeNull();
    });

    it('should return null for expired session', () => {
      const session = createAuthSession(mockUser, 'token123', -3600);
      const user = getUserFromSession(session);
      expect(user).toBeNull();
    });
  });

  describe('getSessionCookieOptions', () => {
    it('should return development cookie options', () => {
      const options = getSessionCookieOptions(false);
      expect(options).toEqual({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 3600,
        path: '/',
      });
    });

    it('should return production cookie options', () => {
      const options = getSessionCookieOptions(true);
      expect(options).toEqual({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 3600,
        path: '/',
      });
    });
  });

  describe('generateSessionToken', () => {
    it('should generate a non-empty token', () => {
      const token = generateSessionToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate unique tokens', () => {
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();
      expect(token1).not.toBe(token2);
    });
  });
});