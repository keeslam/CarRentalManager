#!/usr/bin/env node

import { Client } from 'pg';

async function migrateDatabase() {
  console.log('🚀 Starting database migration...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  console.log('✅ DATABASE_URL found');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Database connected successfully');
    console.log('🔄 Checking database schema...');

    // Check if production_date column exists
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vehicles' AND column_name = 'production_date'
    `);

    if (result.rows.length === 0) {
      console.log('➕ Adding missing production_date column...');
      await client.query('ALTER TABLE vehicles ADD COLUMN production_date TEXT');
      console.log('✅ production_date column added successfully');
    } else {
      console.log('✅ production_date column already exists');
    }

    // Check for other potentially missing columns that might be added in the future
    const missingColumns = [];
    
    // List of columns that should exist (add new ones here as needed)
    const expectedColumns = [
      'production_date',
      'imei', 
      'companyBy',
      'registeredToBy',
      'updatedBy'
    ];

    for (const columnName of expectedColumns) {
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = $1
      `, [columnName]);

      if (columnCheck.rows.length === 0) {
        missingColumns.push(columnName);
      }
    }

    // Add any missing columns
    for (const columnName of missingColumns) {
      console.log(`➕ Adding missing ${columnName} column...`);
      await client.query(`ALTER TABLE vehicles ADD COLUMN ${columnName} TEXT`);
      console.log(`✅ ${columnName} column added successfully`);
    }

    console.log('✅ Database migration completed successfully');
    
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrateDatabase();