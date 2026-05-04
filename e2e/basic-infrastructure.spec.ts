import { test, expect } from "@playwright/test";

test.describe("Basic E2E Infrastructure", () => {
  test("should support browser detection", async ({ browserName }) => {
    expect(["chromium", "firefox", "webkit"]).toContain(browserName);
  });

  test("should support page creation", async ({ page }) => {
    expect(page).toBeTruthy();
  });

  test("should support viewport changes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(375);
    expect(viewport?.height).toBe(667);
  });

  test("should support screenshots", async ({ page }) => {
    await page.setContent("<html><body><h1>Test</h1></body></html>");

    const screenshot = await page.screenshot();
    expect(screenshot).toBeTruthy();
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test("should support JavaScript evaluation", async ({ page }) => {
    await page.setContent('<html><body><div id="test">Hello World</div></body></html>');

    const text = await page.evaluate(() => {
      return document.getElementById("test")?.textContent;
    });

    expect(text).toBe("Hello World");
  });

  test("should support element interactions", async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <button id="btn" onclick="this.textContent='Clicked'">Click Me</button>
        </body>
      </html>
    `);

    await page.click("#btn");

    const buttonText = await page.textContent("#btn");
    expect(buttonText).toBe("Clicked");
  });

  test("should support mobile device emulation", async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.setContent("<html><body><div>Mobile Test</div></body></html>");

    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(375);
    expect(viewport?.height).toBe(812);

    // Test that content is visible
    await expect(page.getByText("Mobile Test")).toBeVisible();
  });

  test("should support route setup (without calling)", async ({ page }) => {
    // Test that we can set up route interception
    await page.route("**/test-api", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.setContent("<html><body><div>Route setup test</div></body></html>");

    // Verify page loads normally with route setup
    await expect(page.getByText("Route setup test")).toBeVisible();
  });
});
