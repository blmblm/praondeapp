import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    let databaseUrl = (process.env.DATABASE_URL || '').trim();
    if (databaseUrl) {
      databaseUrl = databaseUrl
        .replace(/^DATABASE_URL\s*=\s*/i, '')
        .replace(/^psql\s+/i, '')
        .trim()
        .replace(/^['"]+|['"]+$/g, '');
      const useSsl =
        !databaseUrl.includes('localhost') &&
        !databaseUrl.includes('127.0.0.1') &&
        process.env.SQL_SSL !== 'false';
      global._postgresPool = new Pool({
        connectionString: databaseUrl,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else {
      const host = process.env.SQL_HOST;
      const needsSsl =
        process.env.SQL_SSL === 'true' ||
        (typeof host === 'string' && /neon\.tech|supabase|render\.com|amazonaws\.com/i.test(host));
      global._postgresPool = new Pool({
        host,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export const pool = createPool();
export const db = drizzle(pool, { schema });
