import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Re-export the SupabaseClient type for use throughout the app
export type { SupabaseClient } from "@supabase/supabase-js";

// Environment variables
const supabaseUrl = import.meta.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Client-side Supabase client with enhanced error handling
export const createClientSupabaseClient = (): SupabaseClient<Database> | null => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase credentials not available, running in offline mode");
    return null;
  }

  try {
    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            headers: {
              'User-Agent': 'QR-Scanner-Registry/1.0',
              ...options.headers,
            },
          });
        },
      },
    });
  } catch (error) {
    console.error("Failed to create Supabase client:", error);
    return null;
  }
};

// Singleton client instance
let clientInstance: SupabaseClient<Database> | null = null;

export const getSupabaseClient = (): SupabaseClient<Database> | null => {
  if (!clientInstance) {
    clientInstance = createClientSupabaseClient();
  }
  return clientInstance;
};