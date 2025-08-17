import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginButton } from '../../components/LoginButton';

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

describe('LoginButton', () => {
  beforeEach(() => {
    mockLocation.href = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with default text', () => {
    render(<LoginButton />);
    
    expect(screen.getByRole('button', { name: /login with google/i })).toBeInTheDocument();
  });

  it('renders with custom children', () => {
    render(<LoginButton>Sign In</LoginButton>);
    
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<LoginButton className="custom-class" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('can be disabled', () => {
    render(<LoginButton disabled />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('redirects to Google OAuth endpoint when clicked', () => {
    render(<LoginButton />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockLocation.href).toBe('/api/auth/google');
  });

  it('does not redirect when disabled', () => {
    render(<LoginButton disabled />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockLocation.href).toBe('');
  });

  it('displays Google icon', () => {
    render(<LoginButton />);
    
    const button = screen.getByRole('button');
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it('has proper accessibility attributes', () => {
    render(<LoginButton />);
    
    const button = screen.getByRole('button');
    const svg = button.querySelector('svg');
    
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('handles multiple clicks gracefully', () => {
    render(<LoginButton />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    
    // Should still only set href once (last value wins)
    expect(mockLocation.href).toBe('/api/auth/google');
  });
});