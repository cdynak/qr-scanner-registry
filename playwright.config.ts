import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the unauthenticated smoke suite.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["junit", { outputFile: "playwright-report/results.xml" }],
  ],
  timeout: 30 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  use: {
    /* The dev server runs on HTTPS with a self-signed certificate. */
    baseURL: "https://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    navigationTimeout: 15 * 1000,
    actionTimeout: 10 * 1000,
    /* Accept the dev server's self-signed certificate. */
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
  ],

  /* Start the app (in offline/mock mode) before running the tests. */
  webServer: {
    command: "npm run dev",
    url: "https://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    ignoreHTTPSErrors: true,
    env: {
      // Run against the in-memory store so E2E needs no external services.
      // Astro only exposes shell-provided variables to `import.meta.env` when
      // they are PUBLIC_-prefixed, so set both spellings (the app reads either).
      USE_MOCK_DB: "true",
      PUBLIC_USE_MOCK_DB: "true",
      // Astro 7 detaches `astro dev` into a background daemon when it detects an
      // AI-agent environment, which makes Playwright think the server exited.
      // Setting this variable disables that auto-detection so the server stays
      // in the foreground (it has no effect in CI or a normal terminal).
      ASTRO_DEV_BACKGROUND: "1",
    },
  },
});
