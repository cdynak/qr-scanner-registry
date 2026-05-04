import { test as base, expect } from "@playwright/test";

// Extend the base test with custom fixtures
export const test = base.extend({
  // Custom fixture for authenticated user
  authenticatedPage: async ({ page }, use) => {
    // Mock Google OAuth for all authenticated tests
    await page.route("https://accounts.google.com/oauth/authorize**", async (route) => {
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

    // Login the user
    await page.goto("/");
    const loginButton = page.getByRole("button", { name: /login with google/i });
    await loginButton.click();
    await page.waitForURL("/");
    await expect(page.getByText(/test user/i)).toBeVisible();

    await use(page);
  },

  // Custom fixture for test database
  testDatabase: async ({}, use) => {
    // Setup test database state
    const testData = {
      users: [
        {
          id: "mock_user_id",
          googleId: "mock_google_id",
          email: "test@example.com",
          name: "Test User",
          avatarUrl: "https://example.com/avatar.jpg",
        },
      ],
      scans: [],
    };

    await use(testData);

    // Cleanup after test
    testData.scans = [];
  },
});

export { expect } from "@playwright/test";
