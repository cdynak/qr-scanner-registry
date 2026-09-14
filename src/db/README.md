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
# Optional but recommended: enables true DB-level Row Level Security.
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
```

Set `USE_MOCK_DB=true` to run entirely against an in-memory store (no Supabase
needed for local development).

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

The database uses Row Level Security so users can only access their own data:

- Users can only view, insert, and update their own profile
- Users can only view, insert, update, and delete their own scans
- Policies are keyed on `auth.uid() = user_id`

### How RLS is enforced at the DB layer

This app authenticates with custom Google OAuth (not Supabase Auth). To make
the `auth.uid()`-based policies actually apply, the server mints a
Supabase-compatible per-user JWT (`sub = user.id`, `role = authenticated`)
signed with `SUPABASE_JWT_SECRET` (see `src/lib/supabase-jwt.ts`). Scan
routes then use `createUserScopedClient(session.accessToken)`, which sends
that JWT via the anon key so PostgREST evaluates RLS as the user.

- With `SUPABASE_JWT_SECRET` set: RLS is enforced at the database.
- Without it: the routes fall back to the service-role client (which bypasses
  RLS); ownership is still enforced in the route handlers as defense in depth.

The initial user upsert during OAuth uses the service-role client, because no
session exists yet at that point.

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
4. `004_fix_scans_schema.sql` - Recreates the scans table to match the app
   schema (scan_type / format / scanned_at) and re-applies its RLS policies

> Note: `migrate.ts` requires an `exec_sql` RPC in the database. If that is not
> available, run the migration SQL directly in the Supabase SQL editor.

## Usage Examples

### Client-side Usage

```typescript
import { supabase, getCurrentUser, isAuthenticated } from "./db/supabase";

// Check if user is authenticated
const authenticated = await isAuthenticated();

// Get current user
const user = await getCurrentUser();

// Query scans
const { data: scans } = await supabase.from("scans").select("*").order("scanned_at", { ascending: false });
```

### Server-side Usage

```typescript
import { createServerSupabaseClient } from "./db/supabase";

// Create server client with admin privileges
const supabase = createServerSupabaseClient();

// Perform admin operations
const { data: users } = await supabase.from("users").select("*");
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
