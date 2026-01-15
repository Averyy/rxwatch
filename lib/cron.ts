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
  } catch {
    // Ignore metadata update errors
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
    return { success: false, output: 'Job already running' };
  }

  runningJobs.add(scriptName);
  const startTime = Date.now();

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
    });

    child.stderr?.on('data', (data) => {
      const line = data.toString();
      if (output.length < MAX_OUTPUT_LINES) {
        output.push(`[stderr] ${line}`);
      }
    });

    child.on('close', async (code) => {
      runningJobs.delete(scriptName);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const outputStr = output.join('');

      if (code === 0) {
        await updateSyncMetadata(jobId, true);
        resolve({ success: true, output: outputStr });
      } else {
        const errorMsg = `Exit code ${code} after ${duration}s`;
        await updateSyncMetadata(jobId, false, errorMsg);

        // Retry once after delay if this wasn't already a retry
        if (!isRetry) {
          setTimeout(() => {
            runSyncScript(scriptName, true).catch(() => {});
          }, RETRY_DELAY_MS);
        }

        resolve({ success: false, output: outputStr });
      }
    });

    child.on('error', async (err) => {
      runningJobs.delete(scriptName);
      const errorMsg = `Spawn error: ${err.message}`;
      await updateSyncMetadata(jobId, false, errorMsg);

      // Retry once after delay if this wasn't already a retry
      if (!isRetry) {
        setTimeout(() => {
          runSyncScript(scriptName, true).catch(() => {});
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
    return;
  }

  // Only run in production
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  // Schedule DSC sync (every 15 min)
  cron.schedule(SCHEDULES.dsc, () => {
    runSyncScript('sync-dsc').catch(() => {});
  });

  // Schedule DPD sync (daily at 4am)
  cron.schedule(SCHEDULES.dpd, () => {
    runSyncScript('sync-dpd').catch(() => {});
  });

  initialized = true;
}
