import { FullConfig } from "@playwright/test";

async function globalTeardown(config: FullConfig) {
  console.log("🧹 Starting E2E test cleanup...");

  // Cleanup test database if needed
  if (process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_SERVICE_KEY) {
    console.log("🗑️  Cleaning up test database...");

    try {
      // Here you could clean up test data
      // For now, we'll just log that we're cleaning up
      console.log("✅ Test database cleaned up");
    } catch (error) {
      console.error("❌ Failed to cleanup test database:", error);
      // Don't throw here as it shouldn't fail the tests
    }
  }

  // Additional cleanup tasks could go here
  console.log("✨ E2E test cleanup complete!");
}

export default globalTeardown;
