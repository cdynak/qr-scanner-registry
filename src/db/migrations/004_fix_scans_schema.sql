-- 004_fix_scans_schema.sql
--
-- The live `scans` table was created from an older schema with columns
-- (type, metadata) that do not match what the application expects
-- (scan_type, format, scanned_at). This migration recreates the table with
-- the correct schema. The table is expected to be empty; if it contains data
-- you care about, back it up before running this.

-- Drop the mismatched table (CASCADE removes dependent policies/indexes).
DROP TABLE IF EXISTS scans CASCADE;

-- Ensure the scan_type enum exists.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scan_type') THEN
    CREATE TYPE scan_type AS ENUM ('qr', 'barcode');
  END IF;
END$$;

-- Recreate the scans table with the schema the application expects.
CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  scan_type scan_type NOT NULL,
  format VARCHAR, -- QR format or barcode type (e.g., 'CODE128', 'EAN13', etc.)
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for query performance.
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_scanned_at ON scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_scan_type ON scans(scan_type);
CREATE INDEX IF NOT EXISTS idx_scans_user_scanned_at ON scans(user_id, scanned_at DESC);

-- Ensure content is not empty.
ALTER TABLE scans ADD CONSTRAINT check_content_not_empty CHECK (length(trim(content)) > 0);

-- Re-enable Row Level Security and policies for the recreated table.
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scans" ON scans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scans" ON scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scans" ON scans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scans" ON scans
  FOR DELETE USING (auth.uid() = user_id);

GRANT ALL ON scans TO authenticated;
