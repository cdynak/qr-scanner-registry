import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserProfile } from '../../components/UserProfile';
import type { User } from '../../types';

const mockUser: User = {
  id: '123',
  google_id: 'google123',
  email: 'test@example.com',
  name: 'John Doe',
  avatar_url: 'https://example.com/avatar.jpg',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockUserWithoutAvatar: User = {
  ...mockUser,
  avatar_url: null,
};

describe('UserProfile', () => {
  it('renders user name and email by default', () => {
    render(<UserProfile user={mockUser} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('hides email when showEmail is false', () => {
    render(<UserProfile user={mockUser} showEmail={false} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
  });

  it('displays avatar image when avatar_url is provided', () => {
    render(<UserProfile user={mockUser} />);
    
    const avatar = screen.getByAltText("John Doe's avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('displays initials when no avatar_url is provided', () => {
    render(<UserProfile user={mockUserWithoutAvatar} />);
    
    expect(screen.getByText('J')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('falls back to initials when avatar image fails to load', () => {
    render(<UserProfile user={mockUser} />);
    
    const avatar = screen.getByAltText("John Doe's avatar");
    
    // Simulate image load error
    fireEvent.error(avatar);
    
    // The error handler should hide the image and show initials
    expect(avatar.style.display).toBe('none');
  });

  it('applies custom className', () => {
    render(<UserProfile user={mockUser} className="custom-class" />);
    
    const container = screen.getByText('John Doe').closest('div')?.parentElement?.parentElement;
    expect(container).toHaveClass('custom-class');
  });

  it('applies small size classes', () => {
    render(<UserProfile user={mockUserWithoutAvatar} size="sm" />);
    
    const initialsContainer = screen.getByText('J').parentElement;
    expect(initialsContainer).toHaveClass('w-8', 'h-8');
  });

  it('applies medium size classes (default)', () => {
    render(<UserProfile user={mockUserWithoutAvatar} size="md" />);
    
    const initialsContainer = screen.getByText('J').parentElement;
    expect(initialsContainer).toHaveClass('w-10', 'h-10');
  });

  it('applies large size classes', () => {
    render(<UserProfile user={mockUserWithoutAvatar} size="lg" />);
    
    const initialsContainer = screen.getByText('J').parentElement;
    expect(initialsContainer).toHaveClass('w-12', 'h-12');
  });

  it('handles empty name gracefully', () => {
    const userWithEmptyName = { ...mockUser, name: '' };
    render(<UserProfile user={userWithEmptyName} />);
    
    // Should still render the component without crashing
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('handles long names with truncation', () => {
    const userWithLongName = { 
      ...mockUser, 
      name: 'This is a very long name that should be truncated' 
    };
    render(<UserProfile user={userWithLongName} />);
    
    const nameElement = screen.getByText(userWithLongName.name);
    expect(nameElement).toHaveClass('truncate');
  });

  it('handles long emails with truncation', () => {
    const userWithLongEmail = { 
      ...mockUser, 
      email: 'this.is.a.very.long.email.address@example.com' 
    };
    render(<UserProfile user={userWithLongEmail} />);
    
    const emailElement = screen.getByText(userWithLongEmail.email);
    expect(emailElement).toHaveClass('truncate');
  });

  it('uses first character of name for initials', () => {
    const userWithLowerCaseName = { ...mockUser, name: 'alice', avatar_url: null };
    render(<UserProfile user={userWithLowerCaseName} />);
    
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('has proper accessibility attributes for avatar', () => {
    render(<UserProfile user={mockUser} />);
    
    const avatar = screen.getByAltText("John Doe's avatar");
    expect(avatar).toHaveAttribute('alt', "John Doe's avatar");
  });
});