import { test, expect } from "@playwright/test";

test.describe("Simple Infrastructure Tests", () => {
  test("should support basic browser functionality", async ({ page, browserName }) => {
    // Test basic browser detection
    expect(["chromium", "firefox", "webkit"]).toContain(browserName);

    // Test page creation
    expect(page).toBeTruthy();
  });

  test("should support viewport changes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(375);
    expect(viewport?.height).toBe(667);
  });

  test("should support JavaScript evaluation", async ({ page }) => {
    // Create a simple HTML page
    await page.setContent("<html><body><h1>Test Page</h1></body></html>");

    // Test JavaScript evaluation
    const title = await page.evaluate(() => {
      return document.querySelector("h1")?.textContent;
    });

    expect(title).toBe("Test Page");
  });

  test("should support localStorage", async ({ page }) => {
    await page.setContent("<html><body></body></html>");

    // Test localStorage
    await page.evaluate(() => {
      localStorage.setItem("test", "value");
    });

    const value = await page.evaluate(() => {
      return localStorage.getItem("test");
    });

    expect(value).toBe("value");
  });

  test("should support camera mocking", async ({ page, context, browserName }) => {
    // Grant camera permissions (only supported in Chromium)
    if (browserName === "chromium") {
      try {
        await context.grantPermissions(["camera"]);
      } catch {
        // Ignore permission errors in other browsers
      }
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

    await page.setContent("<html><body></body></html>");

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

  test("should support API route mocking", async ({ page }) => {
    // Mock an API endpoint
    await page.route("**/api/test", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "mocked response" }),
      });
    });

    await page.setContent("<html><body></body></html>");

    // Test the mock
    const response = await page.evaluate(async () => {
      const res = await fetch("/api/test");
      return res.json();
    });

    expect(response.message).toBe("mocked response");
  });

  test("should support screenshots", async ({ page }) => {
    await page.setContent("<html><body><h1>Screenshot Test</h1></body></html>");

    // Take a screenshot
    const screenshot = await page.screenshot();
    expect(screenshot).toBeTruthy();
    expect(screenshot.length).toBeGreaterThan(0);
  });
});
