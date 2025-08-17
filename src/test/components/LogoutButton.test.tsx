import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LogoutButton } from '../../components/LogoutButton';

// Mock fetch
global.fetch = vi.fn();

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

describe('LogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
    console.error = vi.fn(); // Suppress console.error in tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with default text', () => {
    render(<LogoutButton />);
    
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('renders with custom children', () => {
    render(<LogoutButton>Sign Out</LogoutButton>);
    
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('applies custom className and variant', () => {
    render(<LogoutButton className="custom-class" variant="destructive" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('calls logout API when clicked', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<LogoutButton />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
    });
  });

  it('shows loading state during logout', async () => {
    // Create a promise that we can control
    let resolveLogout: (value: Response) => void;
    const logoutPromise = new Promise<Response>((resolve) => {
      resolveLogout = resolve;
    });
    
    vi.mocked(fetch).mockReturnValueOnce(logoutPromise);

    render(<LogoutButton />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Logging out...')).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    // Resolve the logout
    resolveLogout!(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Should return to normal state
    await waitFor(() => {
      expect(screen.queryByText('Logging out...')).not.toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });
  });

  it('redirects to home page after successful logout', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<LogoutButton />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockLocation.href).toBe('/');
    });
  });

  it('calls onLogoutStart callback', async () => {
    const onLogoutStart = vi.fn();
    
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<LogoutButton onLogoutStart={onLogoutStart} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(onLogoutStart).toHaveBeenCalledTimes(1);
  });

  it('calls onLogoutComplete callback on success', async () => {
    const onLogoutComplete = vi.fn();
    
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<LogoutButton onLogoutComplete={onLogoutComplete} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(onLogoutComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onLogoutError callback on failure', async () => {
    const onLogoutError = vi.fn();
    
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Logout failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<LogoutButton onLogoutError={onLogoutError} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(onLogoutError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Logout failed'
        })
      );
    });
  });

  it('handles network errors gracefully', async () => {
    const onLogoutError = vi.fn();
    
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    render(<LogoutButton onLogoutError={onLogoutError} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(onLogoutError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Network error'
        })
      );
    });
  });

  it('handles non-JSON error responses', async () => {
    const onLogoutError = vi.fn();
    
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    render(<LogoutButton onLogoutError={onLogoutError} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(onLogoutError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Logout failed: 500'
        })
      );
    });
  });

  it('prevents multiple simultaneous logout attempts', async () => {
    let resolveLogout: (value: Response) => void;
    const logoutPromise = new Promise<Response>((resolve) => {
      resolveLogout = resolve;
    });
    
    vi.mocked(fetch).mockReturnValueOnce(logoutPromise);

    render(<LogoutButton />);
    
    const button = screen.getByRole('button');
    
    // Click multiple times
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    // Should only call fetch once
    expect(fetch).toHaveBeenCalledTimes(1);

    // Resolve the logout
    resolveLogout!(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });

  it('displays logout icon', () => {
    render(<LogoutButton />);
    
    const button = screen.getByRole('button');
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it('has proper accessibility attributes', () => {
    render(<LogoutButton />);
    
    const button = screen.getByRole('button');
    const svg = button.querySelector('svg');
    
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});