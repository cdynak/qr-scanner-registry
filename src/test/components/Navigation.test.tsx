import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import Navigation from "../../components/Navigation";
import * as supabaseLib from "../../db/supabase";

// Mock the supabase module
vi.mock("../../db/supabase", () => ({
  getCurrentUser: vi.fn(),
}));

// Mock child components
vi.mock("../../components/UserProfile", () => ({
  UserProfile: ({ user }: { user: any }) => <div data-testid="user-profile">{user.name}</div>,
}));

vi.mock("../../components/LoginButton", () => ({
  LoginButton: ({ onLogin, className }: { onLogin: (user: any) => void; className?: string }) => (
    <button
      data-testid="login-button"
      className={className}
      onClick={() => onLogin({ id: "1", name: "Test User", email: "test@example.com" })}
    >
      Login
    </button>
  ),
}));

vi.mock("../../components/LogoutButton", () => ({
  LogoutButton: ({ onLogout, className }: { onLogout: () => void; className?: string }) => (
    <button data-testid="logout-button" className={className} onClick={onLogout}>
      Logout
    </button>
  ),
}));

const mockUser = {
  id: "1",
  googleId: "google123",
  name: "Test User",
  email: "test@example.com",
  avatarUrl: "https://example.com/avatar.jpg",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders navigation with logo", () => {
    vi.mocked(supabaseLib.getCurrentUser).mockResolvedValue(null);

    render(<Navigation />);

    expect(screen.getByText("QR Scanner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /qr scanner/i })).toHaveAttribute("href", "/");
  });

  it("shows loading state initially", () => {
    vi.mocked(supabaseLib.getCurrentUser).mockImplementation(() => new Promise(() => {}));

    render(<Navigation />);

    expect(screen.getByRole("navigation").querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows login button when user is not authenticated", async () => {
    vi.mocked(supabaseLib.getCurrentUser).mockResolvedValue(null);

    render(<Navigation />);

    await waitFor(() => {
      expect(screen.getByTestId("login-button")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("user-profile")).not.toBeInTheDocument();
    expect(screen.queryByTestId("logout-button")).not.toBeInTheDocument();
  });

  it("shows user profile and logout button when user is authenticated", async () => {
    vi.mocked(supabaseLib.getCurrentUser).mockResolvedValue(mockUser);

    render(<Navigation />);

    await waitFor(() => {
      expect(screen.getByTestId("user-profile")).toBeInTheDocument();
      expect(screen.getByTestId("logout-button")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("login-button")).not.toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("shows authenticated navigation items when user is logged in", async () => {
    vi.mocked(supabaseLib.getCurrentUser).mockResolvedValue(mockUser);

    render(<Navigation />);

    await waitFor(() => {
      // Check desktop navigation specifically
      const desktopNav = screen.getByRole("navigation").querySelector(".hidden.md\\:flex");
      expect(desktopNav?.querySelector('a[href="/"]')).toBeInTheDocument();
      expect(desktopNav?.querySelector('a[href="/scanner"]')).toBeInTheDocument();
      expect(desktopNav?.querySelector('a[href="/history"]')).toBeInTheDocument();
    });
  });

  it("shows only home link when user is not authenticated", async () => {
    vi.mocked(supabaseLib.getCurrentUser).mockResolvedValue(null);

    render(<Navigation />);

    await waitFor(() => {
      // Check desktop navigation (should only show Home)
      const desktopNav = screen.getByRole("navigation").querySelector(".hidden.md\\:flex");
      expect(desktopNav?.querySelector('a[href="/"]')).toBeInTheDocument();
      expect(desktopNav?.querySelector('a[href="/scanner"]')).not.toBeInTheDocument();
      expect(desktopNav?.querySelector('a[href="/history"]')).not.toBeInTheDocument();
    });
  });

  it("toggles mobile menu when menu button is clicked", async () => {
    vi.mocked(supabaseLib.getCurrentUser).mockResolvedValue(null);

    render(<Navigation />);

    const menuButton = screen.getByRole("button", { name: /toggle mobile menu/i });

    // Mobile menu should not be visible initially (check for mobile-specific container)
    expect(screen.queryByRole("navigation")?.querySelector(".md\\:hidden .space-y-1")).not.toBeInTheDocument();

    // Click to open mobile menu
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByRole("navigation").querySelector(".md\\:hidden .space-y-1")).toBeInTheDocument();
    });

    // Click to close mobile menu
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.queryByRole("navigation")?.querySelector(".md\\:hidden .space-y-1")).not.toBeInTheDocument();
    });
  });

  it("closes mobile menu when navigation link is clicked", async () => {
    vi.mocked(supabaseLib.getCurrentUser).mockResolvedValue(mockUser);

    render(<Navigation />);

    const menuButton = screen.getByRole("button", { name: /toggle mobile menu/i });

    // Open mobile menu
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByRole("navigation").querySelector(".md\\:hidden .space-y-1")).toBeInTheDocument();
    });

    // Click on a navigation link in mobile menu
    const mobileMenu = screen.getByRole("navigation").querySelector(".md\\:hidden .space-y-1");
    const homeLink = mobileMenu?.querySelector('a[href="/"]');
    expect(homeLink).toBeInTheDocument();
    if (homeLink) {
      fireEvent.click(homeLink);
    }

    // Mobile menu should close
    await waitFor(() => {
      expect(screen.queryByRole("navigation")?.querySelector(".md\\:hidden .space-y-1")).not.toBeInTheDocument();
    });
  });

  it("handles login callback correctly", async () => {
    vi.mocked(supabaseLib.getCurrentUser).mockResolvedValue(null);

    render(<Navigation />);

    await waitFor(() => {
      expect(screen.getByTestId("login-button")).toBeInTheDocument();
    });

    // Click login button
    fireEvent.click(screen.getByTestId("login-button"));

    // Should show user profile after login
    await waitFor(() => {
      expect(screen.getByTestId("user-profile")).toBeInTheDocument();
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });
  });

  it("handles logout callback correctly", async () => {
    vi.mocked(supabaseLib.getCurrentUser).mockResolvedValue(mockUser);

    render(<Navigation />);

    await waitFor(() => {
      expect(screen.getByTestId("logout-button")).toBeInTheDocument();
    });

    // Click logout button
    fireEvent.click(screen.getByTestId("logout-button"));

    // Should show login button after logout
    await waitFor(() => {
      expect(screen.getByTestId("login-button")).toBeInTheDocument();
      expect(screen.queryByTestId("user-profile")).not.toBeInTheDocument();
    });
  });

  it("handles authentication error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(supabaseLib.getCurrentUser).mockRejectedValue(new Error("Auth failed"));

    render(<Navigation />);

    await waitFor(() => {
      expect(screen.getByTestId("login-button")).toBeInTheDocument();
    });

    expect(consoleSpy).toHaveBeenCalledWith("Failed to load user:", expect.any(Error));

    consoleSpy.mockRestore();
  });

  it("applies custom className", () => {
    vi.mocked(supabaseLib.getCurrentUser).mockResolvedValue(null);

    const { container } = render(<Navigation className="custom-class" />);

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
