import { config } from "dotenv";

// Load environment variables
config();

// Test the original supabase client
async function testOriginalClient() {
  try {
    // Set up environment variables for import.meta.env simulation
    global.import = {
      meta: {
        env: {
          SUPABASE_URL: process.env.SUPABASE_URL,
          SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
      },
    };

    const { createServerSupabaseClient } = await import("../src/db/supabase.js");

    console.log("Testing original Supabase client...");
    const supabase = createServerSupabaseClient();

    // Try a simple query
    const { data, error } = await supabase.from("users").select("count").limit(1);

    if (error) {
      console.error("❌ Original client failed:", error);
    } else {
      console.log("✅ Original client works!", data);
    }
  } catch (err) {
    console.error("❌ Error testing original client:", err.message);
  }
}

testOriginalClient();
