import React, { useEffect, useState } from 'react';
import type { AuthSession, User } from '../types';
import { LoginButton } from './LoginButton';
import { getUserFromSession, parseSessionFromCookie } from '../lib/auth';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
  requireAuth?: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function AuthGuard({ 
  children, 
  fallback,
  redirectTo,
  requireAuth = true 
}: AuthGuardProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get session from cookie
        const cookies = document.cookie.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>);

        const sessionCookie = cookies.session;
        
        if (!sessionCookie) {
          setAuthState({ user: null, loading: false, error: null });
          return;
        }

        // Parse and validate session
        const session = parseSessionFromCookie(decodeURIComponent(sessionCookie));
        const user = getUserFromSession(session);

        setAuthState({ user, loading: false, error: null });
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthState({ 
          user: null, 
          loading: false, 
          error: error instanceof Error ? error.message : 'Authentication failed' 
        });
      }
    };

    checkAuth();
  }, []);

  // Handle redirect if specified
  useEffect(() => {
    if (!authState.loading && !authState.user && requireAuth && redirectTo) {
      window.location.href = redirectTo;
    }
  }, [authState.loading, authState.user, requireAuth, redirectTo]);

  // Show loading state
  if (authState.loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show error state
  if (authState.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
        <div className="text-destructive text-center">
          <h3 className="font-medium">Authentication Error</h3>
          <p className="text-sm text-muted-foreground mt-1">{authState.error}</p>
        </div>
        <LoginButton>Try Again</LoginButton>
      </div>
    );
  }

  // If auth is required but user is not authenticated
  if (requireAuth && !authState.user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
        <div className="text-center">
          <h3 className="font-medium">Authentication Required</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Please log in to access this content.
          </p>
        </div>
        <LoginButton />
      </div>
    );
  }

  // If auth is not required or user is authenticated, render children
  return <>{children}</>;
}

// Hook to use auth state in other components
export function useAuth(): AuthState & { isAuthenticated: boolean } {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const cookies = document.cookie.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>);

        const sessionCookie = cookies.session;
        
        if (!sessionCookie) {
          setAuthState({ user: null, loading: false, error: null });
          return;
        }

        const session = parseSessionFromCookie(decodeURIComponent(sessionCookie));
        const user = getUserFromSession(session);

        setAuthState({ user, loading: false, error: null });
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthState({ 
          user: null, 
          loading: false, 
          error: error instanceof Error ? error.message : 'Authentication failed' 
        });
      }
    };

    checkAuth();
  }, []);

  return {
    ...authState,
    isAuthenticated: !!authState.user
  };
}