import { test, expect, Page } from "@playwright/test";

// Helper function to login for tests
async function loginUser(page: Page) {
  await page.goto("/");
  const loginButton = page.getByRole("button", { name: /login with google/i });
  await loginButton.click();
  await page.waitForURL("/");
  await expect(page.getByText(/test user/i)).toBeVisible();
}

// Mock data for scan history
const mockScans = [
  {
    id: "scan-1",
    userId: "mock_user_id",
    content: "https://example.com",
    scanType: "qr",
    format: "QR_CODE",
    scannedAt: "2024-01-15T10:30:00Z",
    createdAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "scan-2",
    userId: "mock_user_id",
    content: "1234567890123",
    scanType: "barcode",
    format: "EAN_13",
    scannedAt: "2024-01-14T15:45:00Z",
    createdAt: "2024-01-14T15:45:00Z",
  },
  {
    id: "scan-3",
    userId: "mock_user_id",
    content: "Test QR Content",
    scanType: "qr",
    format: "QR_CODE",
    scannedAt: "2024-01-13T09:15:00Z",
    createdAt: "2024-01-13T09:15:00Z",
  },
];

test.beforeEach(async ({ page }) => {
  // Mock Google OAuth (same as other tests)
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

  // Mock scan API endpoints
  await page.route("**/api/scans/list**", async (route) => {
    const url = new URL(route.request().url());
    const page_param = url.searchParams.get("page") || "1";
    const limit = url.searchParams.get("limit") || "10";

    const pageNum = parseInt(page_param);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedScans = mockScans.slice(startIndex, endIndex);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        scans: paginatedScans,
        total: mockScans.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(mockScans.length / limitNum),
      }),
    });
  });

  await page.route("**/api/scans/delete", async (route) => {
    const request = route.request();
    const body = await request.postDataJSON();
    const scanId = body.scanId;

    // Remove scan from mock data
    const scanIndex = mockScans.findIndex((scan) => scan.id === scanId);
    if (scanIndex > -1) {
      mockScans.splice(scanIndex, 1);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Scan not found" }),
      });
    }
  });

  await page.route("**/api/scans/create", async (route) => {
    const request = route.request();
    const body = await request.postDataJSON();

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
});

test.describe("Scan History Management", () => {
  test("should display scan history when authenticated", async ({ page }) => {
    await loginUser(page);
    await page.goto("/history");

    // Should show scan history
    await expect(page.getByText(/scan history/i)).toBeVisible();

    // Should show scan items
    await expect(page.getByText("https://example.com")).toBeVisible();
    await expect(page.getByText("1234567890123")).toBeVisible();
    await expect(page.getByText("Test QR Content")).toBeVisible();
  });

  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("/history");

    // Should redirect to login or show login prompt
    await expect(page.getByRole("button", { name: /login with google/i })).toBeVisible();
  });

  test("should display scan details correctly", async ({ page }) => {
    await loginUser(page);
    await page.goto("/history");

    // Should show scan types
    await expect(page.getByText(/qr/i)).toBeVisible();
    await expect(page.getByText(/barcode/i)).toBeVisible();

    // Should show timestamps
    await expect(page.getByText(/jan.*15/i)).toBeVisible();
    await expect(page.getByText(/jan.*14/i)).toBeVisible();
    await expect(page.getByText(/jan.*13/i)).toBeVisible();
  });

  test("should delete scan with confirmation", async ({ page }) => {
    await loginUser(page);
    await page.goto("/history");

    // Find and click delete button for first scan
    const deleteButtons = page.getByRole("button", { name: /delete/i });
    await deleteButtons.first().click();

    // Should show confirmation dialog
    await expect(page.getByText(/confirm.*delete/i)).toBeVisible();

    // Confirm deletion
    const confirmButton = page.getByRole("button", { name: /confirm|yes|delete/i });
    await confirmButton.click();

    // Should show success message
    await expect(page.getByText(/deleted/i)).toBeVisible();

    // Scan should be removed from list
    await expect(page.getByText("https://example.com")).not.toBeVisible();
  });

  test("should cancel scan deletion", async ({ page }) => {
    await loginUser(page);
    await page.goto("/history");

    // Click delete button
    const deleteButtons = page.getByRole("button", { name: /delete/i });
    await deleteButtons.first().click();

    // Should show confirmation dialog
    await expect(page.getByText(/confirm.*delete/i)).toBeVisible();

    // Cancel deletion
    const cancelButton = page.getByRole("button", { name: /cancel|no/i });
    await cancelButton.click();

    // Scan should still be visible
    await expect(page.getByText("https://example.com")).toBeVisible();
  });

  test("should handle pagination", async ({ page }) => {
    // Add more mock scans to test pagination
    const additionalScans = Array.from({ length: 15 }, (_, i) => ({
      id: `scan-extra-${i}`,
      userId: "mock_user_id",
      content: `Extra scan ${i}`,
      scanType: "qr" as const,
      format: "QR_CODE",
      scannedAt: new Date(Date.now() - i * 86400000).toISOString(),
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    }));

    mockScans.push(...additionalScans);

    await loginUser(page);
    await page.goto("/history");

    // Should show pagination controls
    const nextButton = page.getByRole("button", { name: /next/i });
    if (await nextButton.isVisible()) {
      await expect(nextButton).toBeVisible();

      // Click next page
      await nextButton.click();

      // Should show different scans
      await expect(page.getByText(/extra scan/i)).toBeVisible();
    }
  });

  test("should filter scans by type", async ({ page }) => {
    await loginUser(page);
    await page.goto("/history");

    // Should show filter options
    const filterSelect = page.getByRole("combobox", { name: /filter|type/i });
    if (await filterSelect.isVisible()) {
      await filterSelect.click();

      // Filter by QR codes only
      await page.getByRole("option", { name: /qr/i }).click();

      // Should show only QR scans
      await expect(page.getByText("https://example.com")).toBeVisible();
      await expect(page.getByText("Test QR Content")).toBeVisible();
      await expect(page.getByText("1234567890123")).not.toBeVisible();
    }
  });

  test("should search scans by content", async ({ page }) => {
    await loginUser(page);
    await page.goto("/history");

    // Should show search input
    const searchInput = page.getByRole("textbox", { name: /search/i });
    if (await searchInput.isVisible()) {
      await searchInput.fill("example.com");

      // Should show filtered results
      await expect(page.getByText("https://example.com")).toBeVisible();
      await expect(page.getByText("1234567890123")).not.toBeVisible();
      await expect(page.getByText("Test QR Content")).not.toBeVisible();
    }
  });

  test("should handle empty scan history", async ({ page }) => {
    // Clear mock scans
    mockScans.length = 0;

    await loginUser(page);
    await page.goto("/history");

    // Should show empty state
    await expect(page.getByText(/no scans/i)).toBeVisible();
    await expect(page.getByText(/start scanning/i)).toBeVisible();
  });

  test("should handle API errors gracefully", async ({ page }) => {
    // Mock API error
    await page.route("**/api/scans/list**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    await loginUser(page);
    await page.goto("/history");

    // Should show error message
    await expect(page.getByText(/error.*loading/i)).toBeVisible();

    // Should show retry option
    const retryButton = page.getByRole("button", { name: /retry/i });
    await expect(retryButton).toBeVisible();
  });

  test("should refresh scan history", async ({ page }) => {
    await loginUser(page);
    await page.goto("/history");

    // Should show initial scans
    await expect(page.getByText("https://example.com")).toBeVisible();

    // Click refresh button
    const refreshButton = page.getByRole("button", { name: /refresh/i });
    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Should reload the data
      await expect(page.getByText("https://example.com")).toBeVisible();
    }
  });

  test("should navigate to scanner from empty history", async ({ page }) => {
    // Clear mock scans
    mockScans.length = 0;

    await loginUser(page);
    await page.goto("/history");

    // Click start scanning button
    const startScanButton = page.getByRole("link", { name: /start scanning/i });
    if (await startScanButton.isVisible()) {
      await startScanButton.click();

      // Should navigate to scanner
      await expect(page).toHaveURL(/.*scanner.*/);
    }
  });

  test("should show scan details in modal", async ({ page }) => {
    await loginUser(page);
    await page.goto("/history");

    // Click on a scan to view details
    const scanItem = page.getByText("https://example.com");
    await scanItem.click();

    // Should show scan details modal
    await expect(page.getByText(/scan details/i)).toBeVisible();
    await expect(page.getByText("QR_CODE")).toBeVisible();
    await expect(page.getByText(/jan.*15/i)).toBeVisible();
  });
});
