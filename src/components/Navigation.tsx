import React, { useState, useEffect } from "react";
import { Menu, X, Camera, History, Home, Activity } from "lucide-react";
import { Button } from "./ui/button";
import { UserProfile } from "./UserProfile";
import { LoginButton } from "./LoginButton";
import { LogoutButton } from "./LogoutButton";
import { parseSessionFromCookie, getUserFromSession } from "../lib/auth";
import type { User } from "../types";

interface NavigationProps {
  className?: string;
}

const Navigation: React.FC<NavigationProps> = ({ className = "" }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const loadUser = () => {
      try {
        // Get session from cookie
        const cookies = document.cookie.split(";").reduce(
          (acc, cookie) => {
            const [key, value] = cookie.trim().split("=");
            acc[key] = value;
            return acc;
          },
          {} as Record<string, string>
        );

        const sessionCookie = cookies.session;

        if (!sessionCookie) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        // Parse and validate session
        const session = parseSessionFromCookie(decodeURIComponent(sessionCookie));
        const user = getUserFromSession(session);

        setUser(user);
      } catch (error) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const navigationItems = [
    { href: "/", label: "Home", icon: Home },
    ...(user
      ? [
          { href: "/scanner", label: "Scanner", icon: Camera },
          { href: "/history", label: "History", icon: History },
        ]
      : []),
    { href: "/status", label: "Status", icon: Activity },
  ];

  return (
    <nav className={`border-b bg-background ${className}`}>
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <a href="/" className="flex items-center space-x-2">
              <Camera className="h-6 w-6" />
              <span className="font-bold text-lg">QR Scanner</span>
            </a>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-6">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center space-x-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  onClick={closeMobileMenu}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>

          {/* Desktop Auth Section */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {isLoading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : user ? (
              <div className="flex items-center space-x-4">
                <UserProfile user={user} />
                <LogoutButton onLogout={() => setUser(null)} />
              </div>
            ) : (
              <LoginButton onLogin={setUser} />
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button variant="ghost" size="sm" onClick={toggleMobileMenu} aria-label="Toggle mobile menu">
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="space-y-1 pb-3 pt-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={closeMobileMenu}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </a>
                );
              })}

              {/* Mobile Auth Section */}
              <div className="border-t pt-4">
                {isLoading ? (
                  <div className="flex justify-center py-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : user ? (
                  <div className="space-y-2">
                    <div className="px-3 py-2">
                      <UserProfile user={user} />
                    </div>
                    <div className="px-3">
                      <LogoutButton
                        onLogout={() => {
                          setUser(null);
                          closeMobileMenu();
                        }}
                        className="w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="px-3">
                    <LoginButton
                      onLogin={(user) => {
                        setUser(user);
                        closeMobileMenu();
                      }}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
