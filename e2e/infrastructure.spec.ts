import { test, expect } from "@playwright/test";

test.describe("E2E Infrastructure Tests", () => {
  test("should be able to create a page and navigate", async ({ page }) => {
    // Test basic Playwright functionality
    await page.goto("https://example.com");
    await expect(page).toHaveTitle(/Example Domain/);
  });

  test("should support multiple browsers", async ({ browserName }) => {
    // Test that we can detect different browsers
    expect(["chromium", "firefox", "webkit"]).toContain(browserName);
  });

  test("should support mobile viewports", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("https://example.com");

    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(375);
    expect(viewport?.height).toBe(667);
  });

  test("should support camera permissions mock", async ({ page, context, browserName }) => {
    // Grant camera permissions (only supported in Chromium)
    if (browserName === "chromium") {
      await context.grantPermissions(["camera"]);
    }

    // Mock getUserMedia
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        writable: true,
        value: {
          getUserMedia: async () => {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            return canvas.captureStream(30);
          },
        },
      });
    });

    await page.goto("https://example.com");

    // Test that camera mock is available
    const hasCamera = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        return stream instanceof MediaStream;
      } catch {
        return false;
      }
    });

    expect(hasCamera).toBe(true);
  });

  test("should support API mocking", async ({ page }) => {
    // Mock an API endpoint
    await page.route("**/api/test", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "mocked response" }),
      });
    });

    await page.goto("https://example.com");

    // Test the mock
    const response = await page.evaluate(async () => {
      const res = await fetch("/api/test");
      return res.json();
    });

    expect(response.message).toBe("mocked response");
  });

  test("should support screenshot and video recording", async ({ page }) => {
    await page.goto("https://example.com");

    // Take a screenshot
    const screenshot = await page.screenshot();
    expect(screenshot).toBeTruthy();
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test("should support network interception", async ({ page }) => {
    const responses: string[] = [];

    page.on("response", (response) => {
      responses.push(response.url());
    });

    await page.goto("https://example.com");

    expect(responses.length).toBeGreaterThan(0);
    expect(responses.some((url) => url.includes("example.com"))).toBe(true);
  });

  test("should support localStorage and sessionStorage", async ({ page }) => {
    await page.goto("https://example.com");

    // Test localStorage
    await page.evaluate(() => {
      localStorage.setItem("test", "value");
    });

    const localStorageValue = await page.evaluate(() => {
      return localStorage.getItem("test");
    });

    expect(localStorageValue).toBe("value");

    // Test sessionStorage
    await page.evaluate(() => {
      sessionStorage.setItem("session", "data");
    });

    const sessionStorageValue = await page.evaluate(() => {
      return sessionStorage.getItem("session");
    });

    expect(sessionStorageValue).toBe("data");
  });
});
