import React, { useState } from "react";
import { Button } from "./ui/button";

interface LogoutButtonProps {
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  children?: React.ReactNode;
  onLogoutStart?: () => void;
  onLogoutComplete?: () => void;
  onLogoutError?: (error: Error) => void;
}

export function LogoutButton({
  className,
  variant = "outline",
  size = "default",
  children = "Logout",
  onLogoutStart,
  onLogoutComplete,
  onLogoutError,
}: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      onLogoutStart?.();

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Logout failed: ${response.status}`);
      }

      // The server clears the HttpOnly session cookie. Clear the non-sensitive
      // client-readable auth flag here so the UI updates immediately.
      document.cookie = "authenticated=; Path=/; Max-Age=0; SameSite=Lax";

      onLogoutComplete?.();

      // Redirect to home page or login page
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
      const logoutError = error instanceof Error ? error : new Error("Logout failed");
      onLogoutError?.(logoutError);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Button onClick={handleLogout} disabled={isLoggingOut} className={className} variant={variant} size={size}>
      {isLoggingOut ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
          Logging out...
        </>
      ) : (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          {children}
        </>
      )}
    </Button>
  );
}
