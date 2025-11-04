import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

declare global {
  var dbPool: Pool | undefined;
}

const isProduction = process.env.NODE_ENV === 'production';

const pool = global.dbPool || new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true,
  query_timeout: 30000,
});

if (!isProduction) {
  global.dbPool = pool;
}

pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
});

pool.on('connect', () => {
  console.log('✅ New database client connected to pool');
});

export { pool };

export const db = drizzle(pool, { schema });

export async function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}