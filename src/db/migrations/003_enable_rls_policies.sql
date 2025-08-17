-- Enable Row Level Security on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Enable Row Level Security on scans table
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

-- Users table RLS policies
-- Users can only read their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = google_id OR auth.uid() = id);

-- Users can insert their own profile (during registration)
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid()::text = google_id OR auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = google_id OR auth.uid() = id);

-- Scans table RLS policies
-- Users can only view their own scans
CREATE POLICY "Users can view own scans" ON scans
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert scans for themselves
CREATE POLICY "Users can insert own scans" ON scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own scans
CREATE POLICY "Users can update own scans" ON scans
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own scans
CREATE POLICY "Users can delete own scans" ON scans
  FOR DELETE USING (auth.uid() = user_id);

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON users TO authenticated;
GRANT ALL ON scans TO authenticated;

-- Grant permissions to anon users (for registration)
GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT ON users TO anon;