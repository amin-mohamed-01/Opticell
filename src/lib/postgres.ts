/**
 * lib/postgres.ts — Production PostgreSQL pool for Neon (serverless-safe)
 *
 * Uses a global singleton to prevent exhausting connection limits on
 * Vercel serverless functions (which create a new module instance per request
 * if the global cache isn't used).
 */
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.POSTGRES_URI;

  if (!connectionString) {
    throw new Error(
      '❌ POSTGRES_URI is not defined. Add it to .env.local and to Vercel Environment Variables.'
    );
  }

  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Required for Neon (TLS, but self-signed cert ok)
    max: 5,                              // Keep pool small for serverless
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

// Reuse pool across hot reloads in dev; create once per cold start in production
const pool: Pool = global._pgPool ?? createPool();

if (process.env.NODE_ENV !== 'production') {
  global._pgPool = pool;
}

export function getDb(): Pool {
  return pool;
}

export default pool;
