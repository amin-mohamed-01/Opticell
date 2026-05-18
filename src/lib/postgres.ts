/**
 * lib/postgres.ts — Neon-compatible per-request client
 *
 * Neon's direct endpoint terminates idle connections very aggressively,
 * which causes "connection terminated due to connection timeout" errors
 * when using a persistent Pool in a serverless / dev environment.
 *
 * Solution: create a fresh Client for every query, connect, run the
 * query, then end the client.  This matches exactly how Neon expects
 * its direct endpoint to be used outside of the @neondatabase/serverless
 * HTTP driver.
 *
 * Usage (same API as before):
 *   const db = getDb();
 *   const result = await db.query('SELECT …', [params]);
 */
import { Client, QueryResult, QueryResultRow } from 'pg';

/** Thin wrapper so callers can still do `db.query(sql, params)`. */
class NeonClient {
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async query<R extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<R>> {
    const client = new Client({
      connectionString: this.connectionString,
      ssl: { rejectUnauthorized: false },
      // Give each query up to 15 s to connect before failing fast
      connectionTimeoutMillis: 15_000,
      query_timeout: 30_000,
    });

    try {
      await client.connect();
      const result = await client.query<R>(sql, params);
      return result;
    } finally {
      // Always close — prevents Neon from keeping ghost connections open
      await client.end().catch(() => {});
    }
  }
}

// Singleton wrapper instance (stateless — safe to reuse across HMR)
let _neonClient: NeonClient | undefined;

export function getDb(): NeonClient {
  if (!process.env.POSTGRES_URI) {
    throw new Error(
      '❌ POSTGRES_URI is not defined. Add it to .env.local and to Vercel Environment Variables.'
    );
  }

  if (!_neonClient) {
    _neonClient = new NeonClient(process.env.POSTGRES_URI);
  }

  return _neonClient;
}

export default {
  query: (sql: string, params?: unknown[]) => getDb().query(sql, params),
};

