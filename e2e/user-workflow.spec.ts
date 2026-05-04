import { test, expect } from "@playwright/test";

// Complete user workflow test
test.describe("Complete User Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock all necessary APIs
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

    // Mock camera
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        writable: true,
        value: {
          getUserMedia: async () => {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            const stream = canvas.captureStream(30);
            return stream;
          },
        },
      });
    });

    // Mock scan APIs
    const mockScans: any[] = [];

    await page.route("**/api/scans/create", async (route) => {
      const body = await route.request().postDataJSON();
      const newScan = {
        id: `scan-${Date.now()}`,
        userId: "mock_user_id",
        content: body.content,
        scanType: body.scanType,
        format: body.format,
        scannedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      mockScans.unshift(newScan);

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newScan),
      });
    });

    await page.route("**/api/scans/list**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          scans: mockScans,
          total: mockScans.length,
          page: 1,
          limit: 10,
          totalPages: Math.ceil(mockScans.length / 10),
        }),
      });
    });

    await page.route("**/api/scans/delete", async (route) => {
      const body = await route.request().postDataJSON();
      const scanIndex = mockScans.findIndex((scan) => scan.id === body.scanId);
      if (scanIndex > -1) {
        mockScans.splice(scanIndex, 1);
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });
  });

  test("complete user journey: login -> scan -> save -> view history -> delete", async ({ page }) => {
    // Step 1: Start at homepage (not authenticated)
    await page.goto("/");
    await expect(page.getByRole("button", { name: /login with google/i })).toBeVisible();

    // Step 2: Login with Google
    const loginButton = page.getByRole("button", { name: /login with google/i });
    await loginButton.click();

    await page.waitForURL("/");
    await expect(page.getByText(/test user/i)).toBeVisible();

    // Step 3: Navigate to scanner
    await page.goto("/scanner");
    await page.waitForTimeout(1000); // Wait for camera initialization

    // Step 4: Perform a scan
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("qr-scan-result", {
          detail: { text: "https://example.com/test", format: "QR_CODE" },
        })
      );
    });

    // Step 5: Verify scan result is displayed
    await expect(page.getByText("https://example.com/test")).toBeVisible();

    // Step 6: Save the scan
    const saveButton = page.getByRole("button", { name: /save/i });
    await saveButton.click();
    await expect(page.getByText(/saved/i)).toBeVisible();

    // Step 7: Navigate to scan history
    await page.goto("/history");

    // Step 8: Verify scan appears in history
    await expect(page.getByText("https://example.com/test")).toBeVisible();
    await expect(page.getByText(/qr/i)).toBeVisible();

    // Step 9: Delete the scan
    const deleteButton = page.getByRole("button", { name: /delete/i });
    await deleteButton.click();

    // Confirm deletion
    const confirmButton = page.getByRole("button", { name: /confirm|yes|delete/i });
    await confirmButton.click();

    // Step 10: Verify scan is removed
    await expect(page.getByText(/deleted/i)).toBeVisible();
    await expect(page.getByText("https://example.com/test")).not.toBeVisible();

    // Step 11: Logout
    const logoutButton = page.getByRole("button", { name: /logout/i });
    await logoutButton.click();

    // Step 12: Verify return to login state
    await expect(page.getByRole("button", { name: /login with google/i })).toBeVisible();
    await expect(page.getByText(/test user/i)).not.toBeVisible();
  });

  test("should handle multiple scans in one session", async ({ page }) => {
    // Login
    await page.goto("/");
    const loginButton = page.getByRole("button", { name: /login with google/i });
    await loginButton.click();
    await page.waitForURL("/");

    // Go to scanner
    await page.goto("/scanner");
    await page.waitForTimeout(1000);

    // First scan
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("qr-scan-result", {
          detail: { text: "First QR Code", format: "QR_CODE" },
        })
      );
    });

    await expect(page.getByText("First QR Code")).toBeVisible();
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/saved/i)).toBeVisible();

    // Second scan
    const newScanButton = page.getByRole("button", { name: /scan again|new scan/i });
    if (await newScanButton.isVisible()) {
      await newScanButton.click();
    }

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("qr-scan-result", {
          detail: { text: "1234567890123", format: "EAN_13" },
        })
      );
    });

    await expect(page.getByText("1234567890123")).toBeVisible();
    await page.getByRole("button", { name: /save/i }).click();

    // Check history shows both scans
    await page.goto("/history");
    await expect(page.getByText("First QR Code")).toBeVisible();
    await expect(page.getByText("1234567890123")).toBeVisible();
  });

  test("should maintain authentication across page refreshes", async ({ page }) => {
    // Login
    await page.goto("/");
    const loginButton = page.getByRole("button", { name: /login with google/i });
    await loginButton.click();
    await page.waitForURL("/");
    await expect(page.getByText(/test user/i)).toBeVisible();

    // Refresh page
    await page.reload();

    // Should still be authenticated
    await expect(page.getByText(/test user/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /logout/i })).toBeVisible();

    // Should be able to access protected routes
    await page.goto("/scanner");
    await expect(page.getByText(/camera|scanning/i)).toBeVisible();

    await page.goto("/history");
    await expect(page.getByText(/scan history/i)).toBeVisible();
  });

  test("should handle network errors gracefully", async ({ page }) => {
    // Login first
    await page.goto("/");
    const loginButton = page.getByRole("button", { name: /login with google/i });
    await loginButton.click();
    await page.waitForURL("/");

    // Mock network error for scan creation
    await page.route("**/api/scans/create", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Network error" }),
      });
    });

    // Try to scan and save
    await page.goto("/scanner");
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("qr-scan-result", {
          detail: { text: "Test scan", format: "QR_CODE" },
        })
      );
    });

    await page.getByRole("button", { name: /save/i }).click();

    // Should show error message
    await expect(page.getByText(/error.*saving/i)).toBeVisible();

    // Should show retry option
    const retryButton = page.getByRole("button", { name: /retry/i });
    await expect(retryButton).toBeVisible();
  });

  test("should work across different browser sizes", async ({ page }) => {
    // Test desktop size
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/");

    const loginButton = page.getByRole("button", { name: /login with google/i });
    await expect(loginButton).toBeVisible();
    await loginButton.click();
    await page.waitForURL("/");

    // Test tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/scanner");
    await expect(page.getByText(/camera|scanning/i)).toBeVisible();

    // Test mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/history");
    await expect(page.getByText(/scan history/i)).toBeVisible();

    // Navigation should still work on mobile
    const logoutButton = page.getByRole("button", { name: /logout/i });
    await expect(logoutButton).toBeVisible();
  });
});
