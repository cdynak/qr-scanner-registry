import { config } from "dotenv";

// Load environment variables
config();

console.log("🚀 Database Setup Instructions");
console.log("");
console.log("Please run the following SQL commands in your Supabase SQL Editor:");
console.log("Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new");
console.log("");
console.log("-- 1. Create users table");
console.log(`CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id VARCHAR UNIQUE NOT NULL,
  email VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  avatar_url VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);
console.log("");
console.log("-- 2. Create scans table");
console.log(`CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type VARCHAR NOT NULL DEFAULT 'qr',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);
console.log("");
console.log("-- 3. Enable Row Level Security");
console.log(`ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON users
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Users can update own profile" ON users
  FOR UPDATE USING (true);

-- Scans policies  
CREATE POLICY IF NOT EXISTS "Users can view own scans" ON scans
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Users can insert own scans" ON scans
  FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Users can delete own scans" ON scans
  FOR DELETE USING (true);`);
console.log("");
console.log("After running these commands, your OAuth login should work!");
console.log("");
console.log("Your Supabase project URL:", process.env.SUPABASE_URL);
