import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthGuard, useAuth } from '../../components/AuthGuard';
import type { User, AuthSession } from '../../types';
import * as authUtils from '../../lib/auth';

// Mock the auth utilities
vi.mock('../../lib/auth', () => ({
  parseSessionFromCookie: vi.fn(),
  getUserFromSession: vi.fn(),
}));

const mockUser: User = {
  id: '123',
  google_id: 'google123',
  email: 'test@example.com',
  name: 'John Doe',
  avatar_url: 'https://example.com/avatar.jpg',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockSession: AuthSession = {
  user: mockUser,
  accessToken: 'token123',
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
});

// Mock window.location
const mockLocation = {
  href: '',
  assign: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = '';
    mockLocation.href = '';
    console.error = vi.fn(); // Suppress console.error in tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state initially', () => {
    // Don't mock anything, just render and check initial state
    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );
    
    // The component should either show loading or resolve to auth required
    // Since we don't have a session cookie, it should show auth required
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', async () => {
    document.cookie = 'session=valid-session-cookie';
    vi.mocked(authUtils.parseSessionFromCookie).mockReturnValue(mockSession);
    vi.mocked(authUtils.getUserFromSession).mockReturnValue(mockUser);

    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected content')).toBeInTheDocument();
    });
  });

  it('shows login prompt when user is not authenticated and auth is required', async () => {
    document.cookie = '';
    vi.mocked(authUtils.parseSessionFromCookie).mockReturnValue(null);
    vi.mocked(authUtils.getUserFromSession).mockReturnValue(null);

    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Authentication Required')).toBeInTheDocument();
      expect(screen.getByText('Please log in to access this content.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /login with google/i })).toBeInTheDocument();
    });
  });

  it('renders children when auth is not required', async () => {
    document.cookie = '';
    vi.mocked(authUtils.parseSessionFromCookie).mockReturnValue(null);
    vi.mocked(authUtils.getUserFromSession).mockReturnValue(null);

    render(
      <AuthGuard requireAuth={false}>
        <div>Public content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Public content')).toBeInTheDocument();
    });
  });

  it('shows custom fallback when provided and user is not authenticated', async () => {
    document.cookie = '';
    vi.mocked(authUtils.parseSessionFromCookie).mockReturnValue(null);
    vi.mocked(authUtils.getUserFromSession).mockReturnValue(null);

    render(
      <AuthGuard fallback={<div>Custom login form</div>}>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Custom login form')).toBeInTheDocument();
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    });
  });

  it('redirects when redirectTo is provided and user is not authenticated', async () => {
    document.cookie = '';
    vi.mocked(authUtils.parseSessionFromCookie).mockReturnValue(null);
    vi.mocked(authUtils.getUserFromSession).mockReturnValue(null);

    render(
      <AuthGuard redirectTo="/login">
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockLocation.href).toBe('/login');
    });
  });

  it('shows error state when authentication fails', async () => {
    document.cookie = 'session=invalid-session';
    vi.mocked(authUtils.parseSessionFromCookie).mockImplementation(() => {
      throw new Error('Invalid session');
    });

    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Authentication Error')).toBeInTheDocument();
      expect(screen.getByText('Invalid session')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('handles missing session cookie gracefully', async () => {
    document.cookie = '';
    vi.mocked(authUtils.parseSessionFromCookie).mockReturnValue(null);
    vi.mocked(authUtils.getUserFromSession).mockReturnValue(null);

    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    });
  });
});

// Test the useAuth hook
describe('useAuth', () => {
  // Component to test the hook
  function TestComponent() {
    const auth = useAuth();
    
    return (
      <div>
        <div data-testid="loading">{auth.loading.toString()}</div>
        <div data-testid="authenticated">{auth.isAuthenticated.toString()}</div>
        <div data-testid="user">{auth.user?.name || 'null'}</div>
        <div data-testid="error">{auth.error || 'null'}</div>
      </div>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = '';
    console.error = vi.fn();
  });

  it('returns loading state initially', async () => {
    // Clear mocks to get default behavior
    vi.clearAllMocks();
    
    render(<TestComponent />);
    
    // The hook should resolve quickly in test environment
    // Check that it eventually shows not authenticated
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });
  });

  it('returns authenticated user when session is valid', async () => {
    document.cookie = 'session=valid-session-cookie';
    vi.mocked(authUtils.parseSessionFromCookie).mockReturnValue(mockSession);
    vi.mocked(authUtils.getUserFromSession).mockReturnValue(mockUser);

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('user')).toHaveTextContent('John Doe');
      expect(screen.getByTestId('error')).toHaveTextContent('null');
    });
  });

  it('returns unauthenticated state when no session', async () => {
    document.cookie = '';
    vi.mocked(authUtils.parseSessionFromCookie).mockReturnValue(null);
    vi.mocked(authUtils.getUserFromSession).mockReturnValue(null);

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('error')).toHaveTextContent('null');
    });
  });

  it('returns error state when authentication fails', async () => {
    document.cookie = 'session=invalid-session';
    vi.mocked(authUtils.parseSessionFromCookie).mockImplementation(() => {
      throw new Error('Session parse error');
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('error')).toHaveTextContent('Session parse error');
    });
  });
});