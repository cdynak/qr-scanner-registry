import { test, expect } from "@playwright/test";

test.describe("Application Smoke Tests", () => {
  test("homepage loads correctly", async ({ page }) => {
    await page.goto("/");

    // Basic smoke test to ensure the app loads
    await expect(page).toHaveTitle(/QR Scanner Registry/);
  });

  test("should have proper meta tags", async ({ page }) => {
    await page.goto("/");

    // Check for proper meta tags
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toContain("width=device-width");
  });

  test("should load CSS properly", async ({ page }) => {
    await page.goto("/");

    // Check that styles are loaded
    const bodyStyles = await page.locator("body").evaluate((el) => {
      return window.getComputedStyle(el).fontFamily;
    });
    expect(bodyStyles).toBeTruthy();
  });

  test("should be responsive on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Check that content is not overflowing
    const bodyWidth = await page.locator("body").evaluate((el) => el.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(400); // Allow some margin
  });
});
