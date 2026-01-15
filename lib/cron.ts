/**
 * Background job scheduler using node-cron
 *
 * Runs sync jobs on schedule:
 * - DSC sync: every 15 minutes (shortage reports)
 * - DPD sync: daily at 4am (drug catalog)
 *
 * To change schedules, edit the SCHEDULES constant and push to main.
 */

import cron from 'node-cron';
import { spawn } from 'child_process';

// Cron schedules (edit these to change timing)
const SCHEDULES = {
  // Every 15 minutes: sync shortage reports from DSC
  dsc: '*/15 * * * *',
  // Daily at 4am: sync drug catalog from DPD
  dpd: '0 4 * * *',
};

// Track running jobs to prevent overlap
const runningJobs = new Set<string>();

// Retry config
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OUTPUT_LINES = 500; // Limit output buffer

/**
 * Update sync metadata in database
 */
async function updateSyncMetadata(jobId: 'dsc' | 'dpd', success: boolean, error?: string): Promise<void> {
  try {
    // Dynamic import to avoid circular dependencies
    const { db, syncMetadata } = await import('@/db');
    const { sql } = await import('drizzle-orm');

    const now = new Date();

    await db.insert(syncMetadata)
      .values({
        id: jobId,
        lastRunAt: now,
        lastSuccessAt: success ? now : undefined,
        lastError: error || null,
        consecutiveFailures: success ? 0 : 1,
      })
      .onConflictDoUpdate({
        target: syncMetadata.id,
        set: {
          lastRunAt: now,
          lastSuccessAt: success ? now : sql`${syncMetadata.lastSuccessAt}`,
          lastError: error || null,
          consecutiveFailures: success
            ? sql`0`
            : sql`${syncMetadata.consecutiveFailures} + 1`,
        },
      });
  } catch (err) {
    console.error(`[cron] Failed to update sync metadata for ${jobId}:`, err);
  }
}

/**
 * Run a sync script as a child process
 */
async function runSyncScript(
  scriptName: 'sync-dsc' | 'sync-dpd',
  isRetry = false
): Promise<{ success: boolean; output: string }> {
  const jobId = scriptName === 'sync-dsc' ? 'dsc' : 'dpd';

  // Prevent concurrent runs of same job
  if (runningJobs.has(scriptName)) {
    console.log(`[cron] ${scriptName} already running, skipping`);
    return { success: false, output: 'Job already running' };
  }

  runningJobs.add(scriptName);
  const startTime = Date.now();
  const retryLabel = isRetry ? ' (retry)' : '';
  console.log(`[cron] Starting ${scriptName}${retryLabel} at ${new Date().toISOString()}`);

  return new Promise((resolve) => {
    const output: string[] = [];

    // Use yarn to run the sync scripts
    const child = spawn('yarn', [scriptName], {
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    child.stdout?.on('data', (data) => {
      const line = data.toString();
      // Limit output buffer to prevent memory issues
      if (output.length < MAX_OUTPUT_LINES) {
        output.push(line);
      }
      // Log important lines
      if (line.includes('===') || line.includes('Error') || line.includes('Complete')) {
        console.log(`[${scriptName}] ${line.trim()}`);
      }
    });

    child.stderr?.on('data', (data) => {
      const line = data.toString();
      if (output.length < MAX_OUTPUT_LINES) {
        output.push(`[stderr] ${line}`);
      }
      console.error(`[${scriptName}] ${line.trim()}`);
    });

    child.on('close', async (code) => {
      runningJobs.delete(scriptName);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const outputStr = output.join('');

      if (code === 0) {
        console.log(`[cron] ${scriptName} completed successfully in ${duration}s`);
        await updateSyncMetadata(jobId, true);
        resolve({ success: true, output: outputStr });
      } else {
        const errorMsg = `Exit code ${code} after ${duration}s`;
        console.error(`[cron] ${scriptName} failed: ${errorMsg}`);
        await updateSyncMetadata(jobId, false, errorMsg);

        // Retry once after delay if this wasn't already a retry
        if (!isRetry) {
          console.log(`[cron] Will retry ${scriptName} in 5 minutes...`);
          setTimeout(() => {
            runSyncScript(scriptName, true).catch(console.error);
          }, RETRY_DELAY_MS);
        }

        resolve({ success: false, output: outputStr });
      }
    });

    child.on('error', async (err) => {
      runningJobs.delete(scriptName);
      const errorMsg = `Spawn error: ${err.message}`;
      console.error(`[cron] ${scriptName} ${errorMsg}`);
      await updateSyncMetadata(jobId, false, errorMsg);

      // Retry once after delay if this wasn't already a retry
      if (!isRetry) {
        console.log(`[cron] Will retry ${scriptName} in 5 minutes...`);
        setTimeout(() => {
          runSyncScript(scriptName, true).catch(console.error);
        }, RETRY_DELAY_MS);
      }

      resolve({ success: false, output: err.message });
    });
  });
}

/**
 * Manually trigger a sync job
 */
export async function triggerSync(job: 'dsc' | 'dpd'): Promise<{ success: boolean; output: string }> {
  const scriptName = job === 'dsc' ? 'sync-dsc' : 'sync-dpd';
  return runSyncScript(scriptName);
}

/**
 * Check if a job is currently running
 */
export function isJobRunning(job: 'dsc' | 'dpd'): boolean {
  return runningJobs.has(`sync-${job}`);
}

/**
 * Get current schedules
 */
export function getSchedules() {
  return { ...SCHEDULES };
}

let initialized = false;

/**
 * Initialize cron jobs - call once on app startup
 */
export function initCron() {
  // Prevent double initialization
  if (initialized) {
    console.log('[cron] Already initialized, skipping');
    return;
  }

  // Only run in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('[cron] Skipping cron init in development');
    return;
  }

  console.log('[cron] Initializing background jobs...');
  console.log(`[cron] DSC sync schedule: ${SCHEDULES.dsc}`);
  console.log(`[cron] DPD sync schedule: ${SCHEDULES.dpd}`);

  // Schedule DSC sync (every 15 min)
  cron.schedule(SCHEDULES.dsc, () => {
    runSyncScript('sync-dsc').catch(console.error);
  });

  // Schedule DPD sync (daily at 4am)
  cron.schedule(SCHEDULES.dpd, () => {
    runSyncScript('sync-dpd').catch(console.error);
  });

  initialized = true;
  console.log('[cron] Background jobs initialized');
}
