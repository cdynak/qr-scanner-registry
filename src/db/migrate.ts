import { createServerSupabaseClient } from './supabase';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface Migration {
  id: string;
  filename: string;
  sql: string;
}

// List of migration files in order
const MIGRATION_FILES = [
  '001_create_users_table.sql',
  '002_create_scans_table.sql',
  '003_enable_rls_policies.sql',
];

/**
 * Load migration files from the migrations directory
 */
async function loadMigrations(): Promise<Migration[]> {
  const migrations: Migration[] = [];
  
  for (const filename of MIGRATION_FILES) {
    try {
      const filePath = join(process.cwd(), 'src', 'db', 'migrations', filename);
      const sql = await readFile(filePath, 'utf-8');
      
      migrations.push({
        id: filename.split('_')[0], // Extract migration ID (e.g., '001')
        filename,
        sql: sql.trim(),
      });
    } catch (error) {
      console.error(`Failed to load migration ${filename}:`, error);
      throw error;
    }
  }
  
  return migrations;
}

/**
 * Create migrations tracking table if it doesn't exist
 */
async function createMigrationsTable() {
  const supabase = createServerSupabaseClient();
  
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR PRIMARY KEY,
        filename VARCHAR NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  });
  
  if (error) {
    console.error('Failed to create migrations table:', error);
    throw error;
  }
}

/**
 * Get list of executed migrations
 */
async function getExecutedMigrations(): Promise<string[]> {
  const supabase = createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('migrations')
    .select('id')
    .order('id');
  
  if (error) {
    console.error('Failed to get executed migrations:', error);
    throw error;
  }
  
  return data?.map(row => row.id) || [];
}

/**
 * Execute a single migration
 */
async function executeMigration(migration: Migration): Promise<void> {
  const supabase = createServerSupabaseClient();
  
  console.log(`Executing migration ${migration.id}: ${migration.filename}`);
  
  // Execute the migration SQL
  const { error: sqlError } = await supabase.rpc('exec_sql', {
    sql: migration.sql
  });
  
  if (sqlError) {
    console.error(`Failed to execute migration ${migration.id}:`, sqlError);
    throw sqlError;
  }
  
  // Record the migration as executed
  const { error: recordError } = await supabase
    .from('migrations')
    .insert({
      id: migration.id,
      filename: migration.filename,
    });
  
  if (recordError) {
    console.error(`Failed to record migration ${migration.id}:`, recordError);
    throw recordError;
  }
  
  console.log(`✅ Migration ${migration.id} executed successfully`);
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    console.log('🚀 Starting database migrations...');
    
    // Create migrations tracking table
    await createMigrationsTable();
    
    // Load all migrations
    const migrations = await loadMigrations();
    console.log(`Found ${migrations.length} migration files`);
    
    // Get executed migrations
    const executedMigrations = await getExecutedMigrations();
    console.log(`${executedMigrations.length} migrations already executed`);
    
    // Filter pending migrations
    const pendingMigrations = migrations.filter(
      migration => !executedMigrations.includes(migration.id)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }
    
    console.log(`Running ${pendingMigrations.length} pending migrations...`);
    
    // Execute pending migrations
    for (const migration of pendingMigrations) {
      await executeMigration(migration);
    }
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// CLI runner
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}