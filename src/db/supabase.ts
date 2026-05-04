import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Configure Node.js for better TLS compatibility
if (typeof process !== "undefined") {
  // Handle TLS issues in development
  if (process.env.NODE_ENV === "development") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  // Set additional Node.js options for better compatibility
  process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || "") + " --max-http-header-size=32768";
}

// Environment variables validation - handle both server and client side
const supabaseUrl = import.meta.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Only validate on server side or when actually needed
const isServer = typeof window === "undefined";

if (isServer && !supabaseUrl) {
  throw new Error("Missing SUPABASE_URL environment variable");
}

if (isServer && !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_ANON_KEY environment variable");
}

// Client-side Supabase client (uses anon key)
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;

// Server-side Supabase client (uses service role key for admin operations)
export const createServerSupabaseClient = () => {
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL environment variable");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: async (url, options = {}) => {
        try {
          // Add custom headers and options for better compatibility
          const response = await fetch(url, {
            ...options,
            headers: {
              "User-Agent": "QR-Scanner-Registry/1.0",
              Connection: "keep-alive",
              ...options.headers,
            },
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(10000),
          });
          return response;
        } catch (error) {
          console.error(`Supabase fetch failed for ${url}:`, error.message);
          throw error;
        }
      },
    },
  });
};

// Helper function to get authenticated user
export const getCurrentUser = async () => {
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Failed to get current user: ${error.message}`);
  }

  return user;
};

// Helper function to check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    if (!supabase) {
      return false;
    }
    const user = await getCurrentUser();
    return !!user;
  } catch {
    return false;
  }
};
// Helper function to test Supabase connectivity
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("users").select("count").limit(1);
    return !error;
  } catch (error) {
    console.warn("Supabase connectivity test failed:", error.message);
    return false;
  }
};
