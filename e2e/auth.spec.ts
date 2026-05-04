import { test, expect, Page } from "@playwright/test";

// Mock Google OAuth for testing
test.beforeEach(async ({ page }) => {
  // Mock Google OAuth endpoints
  await page.route("https://accounts.google.com/oauth/authorize**", async (route) => {
    // Simulate successful OAuth redirect
    const url = new URL(route.request().url());
    const redirectUri = url.searchParams.get("redirect_uri");
    const state = url.searchParams.get("state");

    if (redirectUri) {
      await route.fulfill({
        status: 302,
        headers: {
          Location: `${redirectUri}?code=mock_auth_code&state=${state}`,
        },
      });
    }
  });

  // Mock Google token exchange
  await page.route("https://oauth2.googleapis.com/token", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "mock_access_token",
        id_token: "mock_id_token",
        token_type: "Bearer",
        expires_in: 3600,
      }),
    });
  });

  // Mock Google user info
  await page.route("https://www.googleapis.com/oauth2/v2/userinfo", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "mock_google_id",
        email: "test@example.com",
        name: "Test User",
        picture: "https://example.com/avatar.jpg",
      }),
    });
  });

  // Mock Supabase auth endpoints
  await page.route("**/auth/v1/token**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "mock_supabase_token",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: "mock_user_id",
          email: "test@example.com",
        },
      }),
    });
  });
});

test.describe("Authentication Flow", () => {
  test("should display login button when not authenticated", async ({ page }) => {
    await page.goto("/");

    // Should show login button
    const loginButton = page.getByRole("button", { name: /login with google/i });
    await expect(loginButton).toBeVisible();

    // Should not show authenticated content
    await expect(page.getByText(/welcome/i)).not.toBeVisible();
  });

  test("should complete Google OAuth login flow", async ({ page }) => {
    await page.goto("/");

    // Click login button
    const loginButton = page.getByRole("button", { name: /login with google/i });
    await loginButton.click();

    // Should redirect to OAuth (mocked)
    await page.waitForURL(/.*code=mock_auth_code.*/);

    // Should process OAuth callback and redirect to authenticated state
    await page.waitForURL("/");

    // Should show authenticated content
    await expect(page.getByText(/test user/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible();
  });

  test("should maintain session across page reloads", async ({ page }) => {
    // First login
    await page.goto("/");
    const loginButton = page.getByRole("button", { name: /login with google/i });
    await loginButton.click();

    await page.waitForURL("/");
    await expect(page.getByText(/test user/i)).toBeVisible();

    // Reload page
    await page.reload();

    // Should still be authenticated
    await expect(page.getByText(/test user/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible();
  });

  test("should logout successfully", async ({ page }) => {
    // First login
    await page.goto("/");
    const loginButton = page.getByRole("button", { name: /login with google/i });
    await loginButton.click();

    await page.waitForURL("/");
    await expect(page.getByText(/test user/i)).toBeVisible();

    // Click logout
    const logoutButton = page.getByRole("button", { name: /logout/i });
    await logoutButton.click();

    // Should return to login state
    await expect(page.getByRole("button", { name: /login with google/i })).toBeVisible();
    await expect(page.getByText(/test user/i)).not.toBeVisible();
  });

  test("should protect scanner route when not authenticated", async ({ page }) => {
    await page.goto("/scanner");

    // Should redirect to login or show login prompt
    await expect(page.getByRole("button", { name: /login with google/i })).toBeVisible();
  });

  test("should allow access to scanner route when authenticated", async ({ page }) => {
    // First login
    await page.goto("/");
    const loginButton = page.getByRole("button", { name: /login with google/i });
    await loginButton.click();

    await page.waitForURL("/");

    // Navigate to scanner
    await page.goto("/scanner");

    // Should show scanner interface
    await expect(page.getByText(/camera/i)).toBeVisible();
  });

  test("should handle OAuth errors gracefully", async ({ page }) => {
    // Mock OAuth error
    await page.route("https://accounts.google.com/oauth/authorize**", async (route) => {
      const url = new URL(route.request().url());
      const redirectUri = url.searchParams.get("redirect_uri");

      if (redirectUri) {
        await route.fulfill({
          status: 302,
          headers: {
            Location: `${redirectUri}?error=access_denied&error_description=User%20denied%20access`,
          },
        });
      }
    });

    await page.goto("/");
    const loginButton = page.getByRole("button", { name: /login with google/i });
    await loginButton.click();

    // Should show error message
    await expect(page.getByText(/authentication failed/i)).toBeVisible();
  });
});
