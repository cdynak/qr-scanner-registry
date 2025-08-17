import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock environment variables first
vi.stubEnv('GOOGLE_CLIENT_ID', 'mock-client-id');
vi.stubEnv('GOOGLE_CLIENT_SECRET', 'mock-client-secret');
vi.stubEnv('NEXTAUTH_URL', 'http://localhost:4321');
vi.stubEnv('NODE_ENV', 'test');

// Mock dependencies
const mockOAuth2Instance = {
  generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/oauth/authorize?mock=true'),
  getToken: vi.fn().mockResolvedValue({
    tokens: { access_token: 'mock-access-token' },
  }),
  setCredentials: vi.fn(),
};

const mockOauth2 = {
  userinfo: {
    get: vi.fn().mockResolvedValue({
      data: {
        id: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      },
    }),
  },
};

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => mockOAuth2Instance),
    },
    oauth2: vi.fn().mockReturnValue(mockOauth2),
  },
}));

const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: '1',
            google_id: 'google-123',
            email: 'test@example.com',
            name: 'Test User',
            avatar_url: 'https://example.com/avatar.jpg',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          error: null,
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: '1',
              google_id: 'google-123',
              email: 'updated@example.com',
              name: 'Updated User',
              avatar_url: 'https://example.com/new-avatar.jpg',
              updated_at: '2024-01-01T00:00:00Z',
            },
            error: null,
          }),
        }),
      }),
    }),
  }),
};

vi.mock('../../../db/supabase', () => ({
  createClient: vi.fn().mockReturnValue(mockSupabase),
}));

vi.mock('../../../lib/auth', () => ({
  createAuthSession: vi.fn().mockReturnValue({
    user: { id: '1', name: 'Test User', email: 'test@example.com' },
    accessToken: 'mock-token',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  }),
  getSessionCookieOptions: vi.fn().mockReturnValue({
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 3600,
    path: '/',
  }),
}));

// Import after mocks are set up
const { GET, POST } = await import('../../../pages/api/auth/google');

describe('Google OAuth API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('GET /api/auth/google', () => {
    it('should redirect to Google OAuth URL', async () => {
      const mockRedirect = vi.fn().mockReturnValue(new Response('', { status: 302 }));
      const context = {
        url: new URL('http://localhost:4321/api/auth/google'),
        redirect: mockRedirect,
      };

      const response = await GET(context as any);

      expect(mockRedirect).toHaveBeenCalledWith('https://accounts.google.com/oauth/authorize?mock=true');
      expect(response.status).toBe(302);
    });

    it('should handle OAuth URL generation errors', async () => {
      // Mock the generateAuthUrl to throw an error
      mockOAuth2Instance.generateAuthUrl.mockImplementationOnce(() => {
        throw new Error('OAuth service unavailable');
      });

      const mockRedirect = vi.fn().mockReturnValue(new Response('', { status: 302 }));
      const context = {
        url: new URL('http://localhost:4321/api/auth/google'),
        redirect: mockRedirect,
      };

      const response = await GET(context as any);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Failed to initiate authentication');
    });
  });

  describe('POST /api/auth/google', () => {
    it('should handle successful OAuth callback for new user', async () => {
      const mockResponse = {
        headers: new Map(),
      };
      const mockRedirect = vi.fn().mockReturnValue(mockResponse);

      const request = new Request('http://localhost:4321/api/auth/google?code=mock-auth-code');
      const context = {
        request,
        redirect: mockRedirect,
      };

      const response = await POST(context as any);

      expect(mockOAuth2Instance.getToken).toHaveBeenCalledWith('mock-auth-code');
      expect(mockOauth2.userinfo.get).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(mockRedirect).toHaveBeenCalledWith('/?auth=success');
    });

    it('should handle successful OAuth callback for existing user', async () => {
      // Mock existing user found
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          id: '1',
          google_id: 'google-123',
          email: 'old@example.com',
          name: 'Old User',
        },
        error: null,
      });

      const mockResponse = {
        headers: new Map(),
      };
      const mockRedirect = vi.fn().mockReturnValue(mockResponse);

      const request = new Request('http://localhost:4321/api/auth/google?code=mock-auth-code');
      const context = {
        request,
        redirect: mockRedirect,
      };

      const response = await POST(context as any);

      expect(mockRedirect).toHaveBeenCalledWith('/?auth=success');
    });

    it('should handle OAuth error callback', async () => {
      const mockRedirect = vi.fn().mockReturnValue(new Response('', { status: 302 }));
      const request = new Request('http://localhost:4321/api/auth/google?error=access_denied');
      const context = {
        request,
        redirect: mockRedirect,
      };

      const response = await POST(context as any);

      expect(mockRedirect).toHaveBeenCalledWith('/?error=oauth_denied');
    });

    it('should handle missing authorization code', async () => {
      const mockRedirect = vi.fn().mockReturnValue(new Response('', { status: 302 }));
      const request = new Request('http://localhost:4321/api/auth/google');
      const context = {
        request,
        redirect: mockRedirect,
      };

      const response = await POST(context as any);

      expect(mockRedirect).toHaveBeenCalledWith('/?error=invalid_request');
    });

    it('should handle Google API errors', async () => {
      // Mock Google OAuth to throw error
      mockOAuth2Instance.getToken.mockRejectedValueOnce(new Error('Invalid authorization code'));

      const mockRedirect = vi.fn().mockReturnValue(new Response('', { status: 302 }));
      const request = new Request('http://localhost:4321/api/auth/google?code=invalid-code');
      const context = {
        request,
        redirect: mockRedirect,
      };

      const response = await POST(context as any);

      expect(mockRedirect).toHaveBeenCalledWith('/?error=server_error');
    });

    it('should handle incomplete user information from Google', async () => {
      // Mock incomplete user data
      mockOauth2.userinfo.get.mockResolvedValueOnce({
        data: {
          id: 'google-123',
          // Missing email and name
        },
      });

      const mockRedirect = vi.fn().mockReturnValue(new Response('', { status: 302 }));
      const request = new Request('http://localhost:4321/api/auth/google?code=mock-code');
      const context = {
        request,
        redirect: mockRedirect,
      };

      const response = await POST(context as any);

      expect(mockRedirect).toHaveBeenCalledWith('/?error=auth_failed');
    });

    it('should handle database errors', async () => {
      // Mock database error
      mockSupabase.from().insert().select().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const mockRedirect = vi.fn().mockReturnValue(new Response('', { status: 302 }));
      const request = new Request('http://localhost:4321/api/auth/google?code=mock-code');
      const context = {
        request,
        redirect: mockRedirect,
      };

      const response = await POST(context as any);

      expect(mockRedirect).toHaveBeenCalledWith('/?error=auth_failed');
    });
  });
});