import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgres://rxwatch:rxwatch_dev_password@localhost:5433/rxwatch';

// Configure connection pool
// - max: Allow enough connections for /api/stats (~27 parallel queries) + margin for concurrent requests
// - idle_timeout: Release idle connections after 20 seconds
// - connect_timeout: Wait up to 30 seconds for a connection (instead of failing)
const queryClient = postgres(connectionString, {
  max: 40,
  idle_timeout: 20,
  connect_timeout: 30,
});

export const db = drizzle(queryClient, { schema });

// Export schema for convenience
export * from './schema';
