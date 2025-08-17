# Database Setup

This directory contains the Supabase database configuration, types, and migration scripts for the QR Scanner Registry application.

## Files Overview

- `supabase.ts` - Supabase client configuration and authentication helpers
- `types.ts` - TypeScript types for database entities
- `migrate.ts` - Database migration runner
- `migrations/` - SQL migration files

## Environment Variables

Make sure to set the following environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

## Database Schema

### Users Table
Stores user information from Google OAuth authentication:
- `id` - UUID primary key
- `google_id` - Google user ID (unique)
- `email` - User email address
- `name` - User display name
- `avatar_url` - User profile picture URL (optional)
- `created_at` - Account creation timestamp
- `updated_at` - Last update timestamp

### Scans Table
Stores QR/barcode scan results:
- `id` - UUID primary key
- `user_id` - Foreign key to users table
- `content` - Decoded scan content
- `scan_type` - Type of scan ('qr' or 'barcode')
- `format` - Specific format (e.g., 'QR_CODE', 'EAN13')
- `scanned_at` - When the scan was performed
- `created_at` - When the record was created

## Row Level Security (RLS)

The database uses Row Level Security to ensure users can only access their own data:

- Users can only view, insert, and update their own profile
- Users can only view, insert, update, and delete their own scans
- All policies are based on the authenticated user's ID

## Running Migrations

To set up the database schema, run the migrations:

```bash
npm run db:migrate
```

This will:
1. Create the migrations tracking table
2. Execute any pending migration files in order
3. Record which migrations have been run

## Migration Files

1. `001_create_users_table.sql` - Creates users table with indexes and triggers
2. `002_create_scans_table.sql` - Creates scans table with indexes and constraints
3. `003_enable_rls_policies.sql` - Enables RLS and creates security policies

## Usage Examples

### Client-side Usage
```typescript
import { supabase, getCurrentUser, isAuthenticated } from './db/supabase';

// Check if user is authenticated
const authenticated = await isAuthenticated();

// Get current user
const user = await getCurrentUser();

// Query scans
const { data: scans } = await supabase
  .from('scans')
  .select('*')
  .order('scanned_at', { ascending: false });
```

### Server-side Usage
```typescript
import { createServerSupabaseClient } from './db/supabase';

// Create server client with admin privileges
const supabase = createServerSupabaseClient();

// Perform admin operations
const { data: users } = await supabase
  .from('users')
  .select('*');
```

## Testing

The database configuration includes comprehensive unit tests:

```bash
npm run test src/test/db
```

Tests cover:
- Environment variable validation
- Client creation and configuration
- Authentication helper functions
- TypeScript type definitions
- Error handling scenarios