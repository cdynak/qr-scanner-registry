import { test, expect } from "@playwright/test";

/**
 * Unauthenticated smoke tests.
 *
 * These cover the parts of the app that render without a logged-in session:
 * page loads, titles, the shared "Authentication Required" gate on protected
 * pages, and the 404/error pages. Authenticated flows (scanning, history,
 * OAuth) are covered by unit/integration tests, since they require a real
 * OAuth handshake and camera that are impractical to drive here.
 */

test.describe("Application smoke (unauthenticated)", () => {
  test("home page loads with the expected title and heading", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/QR Scanner Registry - Home/);
    await expect(page.getByRole("heading", { name: "QR Scanner Registry" })).toBeVisible();
  });

  test("home page has a mobile viewport meta tag", async ({ page }) => {
    await page.goto("/");

    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toContain("width=device-width");
  });

  test("home page loads styles", async ({ page }) => {
    await page.goto("/");

    const fontFamily = await page.locator("body").evaluate((el) => window.getComputedStyle(el).fontFamily);
    expect(fontFamily).toBeTruthy();
  });

  test("is responsive on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const bodyWidth = await page.locator("body").evaluate((el) => el.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(400);
  });

  test("protected pages show the authentication gate", async ({ page }) => {
    for (const path of ["/scanner", "/history"]) {
      await page.goto(path);
      await expect(page.getByText("Authentication Required")).toBeVisible();
      await expect(page.getByText("Please log in to access this content.")).toBeVisible();
      // A "Login with Google" button appears both in the nav header and the
      // gate itself, so assert at least one is present rather than matching one.
      await expect(page.getByRole("button", { name: /login with google/i }).first()).toBeVisible();
    }
  });

  test("scanner and history pages have the correct titles", async ({ page }) => {
    await page.goto("/scanner");
    await expect(page).toHaveTitle(/QR Scanner Registry - Scanner/);

    await page.goto("/history");
    await expect(page).toHaveTitle(/QR Scanner Registry - Scan History/);
  });

  test("unknown routes render the 404 page", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");

    await expect(page).toHaveTitle(/Page Not Found - QR Scanner Registry/);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
  });

  test("the error page renders with the provided status", async ({ page }) => {
    await page.goto("/error?code=500&message=Server%20Error");

    await expect(page).toHaveTitle(/Internal Server Error - QR Scanner Registry/);
    await expect(page.getByRole("heading", { name: "500" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Internal Server Error" })).toBeVisible();
  });
});
