#!/usr/bin/env node

/**
 * Startup Migration Script for Production
 * Safely adds missing database columns before starting the application
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('🔄 Starting database migration...');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false  // Disable SSL for production database that doesn't support it
});

const db = drizzle(pool);

async function addColumnIfNotExists(tableName, columnName, columnDefinition) {
  try {
    // First check if table exists
    const tableCheck = await db.execute(sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = ${tableName}
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log(`⚠️ Table ${tableName} does not exist, skipping column ${columnName}`);
      return;
    }
    
    // Check if column exists
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = ${tableName} AND column_name = ${columnName}
    `);
    
    if (result.rows.length === 0) {
      console.log(`📝 Adding column ${columnName} to ${tableName}...`);
      await db.execute(sql.raw(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`));
      console.log(`✅ Added column ${columnName} to ${tableName}`);
    } else {
      console.log(`✅ Column ${columnName} already exists in ${tableName}`);
    }
  } catch (error) {
    console.error(`❌ Error adding column ${columnName} to ${tableName}:`, error.message);
    throw error;
  }
}

async function createTableIfNotExists(tableName, createTableSQL, insertDefaultSQL = null) {
  try {
    // Check if table exists
    const result = await db.execute(sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = ${tableName}
    `);
    
    if (result.rows.length === 0) {
      console.log(`📝 Creating table ${tableName}...`);
      await db.execute(sql.raw(createTableSQL));
      console.log(`✅ Created table ${tableName}`);
      
      // Insert default data if provided
      if (insertDefaultSQL) {
        console.log(`📝 Inserting default data into ${tableName}...`);
        await db.execute(sql.raw(insertDefaultSQL));
        console.log(`✅ Inserted default data into ${tableName}`);
      }
    } else {
      console.log(`✅ Table ${tableName} already exists`);
    }
  } catch (error) {
    console.error(`❌ Error creating table ${tableName}:`, error.message);
    throw error;
  }
}

async function runMigrations() {
  try {
    console.log('🔍 Checking database schema...');
    
    // Check if core tables exist - if not, database needs initialization
    const coreTables = ['users', 'vehicles', 'customers', 'reservations'];
    const missingTables = [];
    
    for (const tableName of coreTables) {
      const result = await db.execute(sql`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = ${tableName}
      `);
      
      if (result.rows.length === 0) {
        missingTables.push(tableName);
      }
    }
    
    if (missingTables.length > 0) {
      console.error('❌ Missing core tables:', missingTables.join(', '));
      console.error('');
      console.error('🚨 DATABASE NOT INITIALIZED!');
      console.error('');
      console.error('Your database is missing required tables. This migration script is designed');
      console.error('to UPDATE existing databases, not create new ones.');
      console.error('');
      console.error('To initialize a new database, run this ONCE:');
      console.error('  npm run db:push');
      console.error('');
      console.error('After initialization, this migration script will handle safe updates.');
      console.error('');
      process.exit(1);
    }
    
    console.log('✅ All core tables present');
    
    // Create settings table if it doesn't exist (safe to create even on existing DB)
    await createTableIfNotExists(
      'settings',
      `CREATE TABLE settings (
        id SERIAL PRIMARY KEY,
        contract_number_start INTEGER DEFAULT 1 NOT NULL
      )`,
      `INSERT INTO settings (contract_number_start) VALUES (1)`
    );
    
    // Add missing columns to vehicles table (only if vehicles table exists)
    await addColumnIfNotExists('vehicles', 'maintenance_status', 'text DEFAULT \'ok\' NOT NULL');
    await addColumnIfNotExists('vehicles', 'maintenance_note', 'text');
    await addColumnIfNotExists('vehicles', 'company_by', 'text');
    await addColumnIfNotExists('vehicles', 'registered_to_by', 'text');
    await addColumnIfNotExists('vehicles', 'production_date', 'text');
    await addColumnIfNotExists('vehicles', 'imei', 'text');
    await addColumnIfNotExists('vehicles', 'updated_by', 'text');
    await addColumnIfNotExists('vehicles', 'available_for_rental', 'boolean DEFAULT true NOT NULL');
    
    // Add missing columns to reservations table
    await addColumnIfNotExists('reservations', 'type', 'text DEFAULT \'standard\' NOT NULL');
    await addColumnIfNotExists('reservations', 'replacement_for_reservation_id', 'integer');
    await addColumnIfNotExists('reservations', 'placeholder_spare', 'boolean DEFAULT false NOT NULL');
    await addColumnIfNotExists('reservations', 'spare_vehicle_status', 'text DEFAULT \'assigned\'');
    await addColumnIfNotExists('reservations', 'contract_number', 'text');
    
    // Backfill unique contract numbers for picked up/returned/completed reservations only
    console.log('🔄 Backfilling contract numbers for picked-up reservations...');
    
    // Only backfill for reservations that have been picked up (have actual status progression)
    const reservationsResult = await db.execute(sql`
      SELECT id FROM reservations 
      WHERE (contract_number IS NULL OR contract_number = '')
      AND status IN ('picked_up', 'returned', 'completed')
      AND deleted_at IS NULL
      ORDER BY id
    `);
    
    if (reservationsResult.rows.length > 0) {
      console.log(`📝 Found ${reservationsResult.rows.length} reservations without contract numbers`);
      
      // Get all existing contract numbers to avoid collisions
      const existingNumbersResult = await db.execute(sql`
        SELECT contract_number FROM reservations 
        WHERE contract_number IS NOT NULL AND contract_number != ''
      `);
      
      // Parse all existing numeric contract numbers
      const existingNumbers = new Set();
      for (const row of existingNumbersResult.rows) {
        const num = parseInt(row.contract_number, 10);
        if (!isNaN(num)) {
          existingNumbers.add(num);
        }
      }
      
      // Get the starting number from settings
      const settingsResult = await db.execute(sql`SELECT contract_number_start FROM settings LIMIT 1`);
      let contractNumberStart = 1;
      
      if (settingsResult.rows.length > 0 && settingsResult.rows[0].contract_number_start) {
        contractNumberStart = settingsResult.rows[0].contract_number_start;
      }
      
      // Find the maximum existing number
      let nextNumber = contractNumberStart;
      if (existingNumbers.size > 0) {
        const maxExisting = Math.max(...Array.from(existingNumbers));
        nextNumber = Math.max(contractNumberStart, maxExisting + 1);
      }
      
      console.log(`📝 Starting backfill from contract number: ${nextNumber}`);
      
      // Backfill each reservation with a unique contract number
      for (let i = 0; i < reservationsResult.rows.length; i++) {
        const reservationId = reservationsResult.rows[i].id;
        
        // Find next available number
        while (existingNumbers.has(nextNumber)) {
          nextNumber++;
        }
        
        const contractNumber = String(nextNumber).padStart(4, '0');
        
        await db.execute(sql`
          UPDATE reservations 
          SET contract_number = ${contractNumber}
          WHERE id = ${reservationId}
        `);
        
        existingNumbers.add(nextNumber);
        nextNumber++;
      }
      
      console.log(`✅ Backfilled ${reservationsResult.rows.length} contract numbers`);
    } else {
      console.log('✅ All reservations already have contract numbers');
    }
    
    // Check for duplicate contract numbers before adding constraint
    const duplicateCheck = await db.execute(sql`
      SELECT contract_number, COUNT(*) as count
      FROM reservations
      WHERE contract_number IS NOT NULL
      GROUP BY contract_number
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateCheck.rows.length > 0) {
      console.error('❌ Found duplicate contract numbers:', duplicateCheck.rows);
      throw new Error(`Cannot add unique constraint: Found ${duplicateCheck.rows.length} duplicate contract numbers. Please resolve duplicates manually.`);
    }
    
    // Add unique constraint if it doesn't exist (this is now a critical operation)
    const constraintCheck = await db.execute(sql`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'reservations' 
      AND constraint_name = 'reservations_contract_number_unique'
    `);
    
    if (constraintCheck.rows.length === 0) {
      console.log('📝 Adding unique constraint to contract_number...');
      try {
        await db.execute(sql`
          ALTER TABLE reservations 
          ADD CONSTRAINT reservations_contract_number_unique 
          UNIQUE (contract_number)
        `);
        console.log('✅ Added unique constraint to contract_number');
      } catch (error) {
        console.error('❌ CRITICAL: Failed to add unique constraint on contract_number:', error.message);
        throw error; // Fail deployment if constraint cannot be added
      }
    } else {
      console.log('✅ Unique constraint already exists on contract_number');
    }
    
    // IMPORTANT: contract_number should remain NULLABLE
    // Contract numbers are assigned during pickup, not during reservation creation
    // Remove NOT NULL constraint if it exists
    console.log('🔄 Ensuring contract_number is nullable (assigned during pickup)...');
    const columnInfo = await db.execute(sql`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'reservations' 
      AND column_name = 'contract_number'
    `);
    
    if (columnInfo.rows.length > 0 && columnInfo.rows[0].is_nullable === 'NO') {
      console.log('📝 Removing NOT NULL constraint from contract_number...');
      try {
        await db.execute(sql`
          ALTER TABLE reservations 
          ALTER COLUMN contract_number DROP NOT NULL
        `);
        console.log('✅ Removed NOT NULL constraint from contract_number');
      } catch (error) {
        console.error('❌ Failed to remove NOT NULL constraint from contract_number:', error.message);
        throw error;
      }
    } else {
      console.log('✅ contract_number is already nullable');
    }
    
    // Add missing columns to customers table
    await addColumnIfNotExists('customers', 'created_by_user_id', 'integer');
    await addColumnIfNotExists('customers', 'updated_by_user_id', 'integer');
    
    // Create backup_settings table if it doesn't exist
    await createTableIfNotExists(
      'backup_settings',
      `CREATE TABLE backup_settings (
        id SERIAL PRIMARY KEY,
        storage_type TEXT NOT NULL DEFAULT 'object_storage',
        local_path TEXT,
        enable_auto_backup BOOLEAN NOT NULL DEFAULT true,
        backup_schedule TEXT NOT NULL DEFAULT '0 2 * * *',
        retention_days INTEGER NOT NULL DEFAULT 30,
        settings JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by TEXT,
        updated_by TEXT
      )`,
      `INSERT INTO backup_settings (
        storage_type, 
        local_path, 
        enable_auto_backup, 
        backup_schedule, 
        retention_days,
        created_by,
        updated_by
      ) VALUES (
        'local_filesystem',
        '/backups',
        true,
        '0 2 * * *',
        30,
        'admin',
        'admin'
      )`
    );
    
    // Create vehicle_customer_blacklist table if it doesn't exist
    await createTableIfNotExists(
      'vehicle_customer_blacklist',
      `CREATE TABLE vehicle_customer_blacklist (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`
    );
    
    // Add unique index if it doesn't exist
    const blacklistIndexCheck = await db.execute(sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'vehicle_customer_blacklist' 
      AND indexname = 'vehicle_customer_blacklist_unique'
    `);
    
    if (blacklistIndexCheck.rows.length === 0) {
      console.log('📝 Adding unique index to vehicle_customer_blacklist...');
      try {
        await db.execute(sql`
          CREATE UNIQUE INDEX vehicle_customer_blacklist_unique 
          ON vehicle_customer_blacklist(vehicle_id, customer_id)
        `);
        console.log('✅ Added unique index to vehicle_customer_blacklist');
      } catch (error) {
        console.log('⚠️ Unique index may already exist:', error.message);
      }
    } else {
      console.log('✅ Unique index already exists on vehicle_customer_blacklist');
    }
    
    // Update any NULL maintenance_status values
    console.log('🔄 Updating maintenance status defaults...');
    await db.execute(sql`UPDATE vehicles SET maintenance_status = 'ok' WHERE maintenance_status IS NULL`);
    
    console.log('✅ Database migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations();