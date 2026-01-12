import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env.local for local development (won't override existing env vars)
config({ path: '.env.local' });

// DATABASE_URL can come from:
// 1. Environment variable (Docker, CI, production)
// 2. .env.local file (local development)
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is required.\n' +
    'Set it in .env.local for local development, or pass it via environment variable.'
  );
}

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
