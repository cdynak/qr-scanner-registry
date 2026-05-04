import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Set NODE_ENV to development to enable TLS fix
process.env.NODE_ENV = "development";

// Configure TLS for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Load environment variables
config();

console.log("Testing Supabase connection with TLS fix...");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("NODE_TLS_REJECT_UNAUTHORIZED:", process.env.NODE_TLS_REJECT_UNAUTHORIZED);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Service key exists:", !!supabaseServiceKey);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

async function testConnection() {
  try {
    console.log("Creating Supabase client...");

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: (url, options = {}) => {
          // Add custom headers and options for better compatibility
          return fetch(url, {
            ...options,
            headers: {
              "User-Agent": "QR-Scanner-Registry/1.0",
              ...options.headers,
            },
          });
        },
      },
    });

    console.log("Attempting to query users table...");

    // Try a simple query to test connectivity
    const { data, error } = await supabase.from("users").select("count").limit(1);

    if (error) {
      console.error("❌ Supabase query error:", error);
    } else {
      console.log("✅ Supabase connection successful!");
      console.log("Query result:", data);
    }
  } catch (err) {
    console.error("❌ Supabase connection failed:", err.message);
    console.error("Full error:", err);
  }
}

testConnection();
