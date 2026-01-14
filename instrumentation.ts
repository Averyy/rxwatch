/**
 * Next.js instrumentation - runs once when the server starts
 *
 * Used to initialize background jobs (cron) in production.
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initCron } = await import('./lib/cron');
    initCron();
  }
}
