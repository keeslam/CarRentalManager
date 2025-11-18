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
    
    // Add missing columns to vehicles table
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
    
    // Backfill unique contract numbers for existing reservations
    console.log('🔄 Backfilling contract numbers for existing reservations...');
    
    // Find all reservations with missing contract numbers
    const reservationsResult = await db.execute(sql`
      SELECT id FROM reservations 
      WHERE contract_number IS NULL OR contract_number = ''
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
    
    // Make contract_number NOT NULL to prevent future null insertions
    console.log('🔄 Checking if contract_number needs NOT NULL constraint...');
    const columnInfo = await db.execute(sql`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'reservations' 
      AND column_name = 'contract_number'
    `);
    
    if (columnInfo.rows.length > 0 && columnInfo.rows[0].is_nullable === 'YES') {
      console.log('📝 Setting contract_number to NOT NULL...');
      try {
        await db.execute(sql`
          ALTER TABLE reservations 
          ALTER COLUMN contract_number SET NOT NULL
        `);
        console.log('✅ Set contract_number to NOT NULL');
      } catch (error) {
        console.error('❌ CRITICAL: Failed to set contract_number to NOT NULL:', error.message);
        console.error('This likely means there are still NULL values in the contract_number column.');
        throw error; // Fail deployment if NOT NULL cannot be added
      }
    } else {
      console.log('✅ contract_number is already NOT NULL');
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