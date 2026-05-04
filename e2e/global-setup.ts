import { chromium, FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  console.log("🚀 Starting E2E test setup...");

  // Setup test database if needed
  if (process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_SERVICE_KEY) {
    console.log("📊 Setting up test database...");

    try {
      // Here you could run database migrations or seed data
      // For now, we'll just log that we're using test database
      console.log("✅ Test database configured");
    } catch (error) {
      console.error("❌ Failed to setup test database:", error);
      throw error;
    }
  } else {
    console.log("⚠️  Using mocked database for tests");
  }

  // Warm up the dev server
  console.log("🔥 Warming up dev server...");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(config.webServer?.url || "http://localhost:4321", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    console.log("✅ Dev server is ready");
  } catch (error) {
    console.error("❌ Failed to warm up dev server:", error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log("🎉 E2E test setup complete!");
}

export default globalSetup;
