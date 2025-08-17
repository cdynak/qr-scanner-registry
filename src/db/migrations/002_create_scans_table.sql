-- Create scan_type enum
CREATE TYPE scan_type AS ENUM ('qr', 'barcode');

-- Create scans table
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  scan_type scan_type NOT NULL,
  format VARCHAR, -- QR format or barcode type (e.g., 'CODE128', 'EAN13', etc.)
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_scanned_at ON scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_scan_type ON scans(scan_type);
CREATE INDEX IF NOT EXISTS idx_scans_user_scanned_at ON scans(user_id, scanned_at DESC);

-- Add constraint to ensure content is not empty
ALTER TABLE scans ADD CONSTRAINT check_content_not_empty CHECK (length(trim(content)) > 0);