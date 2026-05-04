import { defineConfig, devices } from "@playwright/test";

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["junit", { outputFile: "playwright-report/results.xml" }],
  ],
  /* Global test timeout */
  timeout: 30 * 1000,
  /* Expect timeout for assertions */
  expect: {
    timeout: 10 * 1000,
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:4321",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Take screenshot on failure */
    screenshot: "only-on-failure",

    /* Record video on failure */
    video: "retain-on-failure",

    /* Navigation timeout */
    navigationTimeout: 15 * 1000,

    /* Action timeout */
    actionTimeout: 10 * 1000,

    /* Ignore HTTPS errors for test environment */
    ignoreHTTPSErrors: true,

    /* Extra HTTP headers */
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  },

  /* Configure projects for major browsers */
  projects: [
    // Desktop browsers
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Enable camera and microphone permissions for testing
        permissions: ["camera", "microphone"],
        // Set test environment variables
        contextOptions: {
          permissions: ["camera", "microphone"],
        },
      },
    },

    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        // Firefox doesn't support camera/microphone permissions in the same way
      },
    },

    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        // WebKit has different permission handling
      },
    },

    // Mobile browsers
    {
      name: "Mobile Chrome",
      use: {
        ...devices["Pixel 5"],
        permissions: ["camera", "microphone"],
        contextOptions: {
          permissions: ["camera", "microphone"],
        },
      },
    },
    {
      name: "Mobile Safari",
      use: {
        ...devices["iPhone 12"],
        // Mobile Safari has different permission handling
      },
    },

    // Tablet testing
    {
      name: "iPad",
      use: {
        ...devices["iPad Pro"],
        // iPad has different permission handling
      },
    },
  ],

  /* Global setup and teardown - disabled for now */
  // globalSetup: "./e2e/global-setup.ts",
  // globalTeardown: "./e2e/global-teardown.ts",

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:4321",
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  //   env: {
  //     // Use test environment variables
  //     NODE_ENV: "test",
  //     SUPABASE_URL: process.env.TEST_SUPABASE_URL || "https://test.supabase.co",
  //     SUPABASE_ANON_KEY: process.env.TEST_SUPABASE_ANON_KEY || "test-anon-key",
  //     GOOGLE_CLIENT_ID: process.env.TEST_GOOGLE_CLIENT_ID || "test-client-id",
  //     GOOGLE_CLIENT_SECRET: process.env.TEST_GOOGLE_CLIENT_SECRET || "test-client-secret",
  //   },
  // },
});
