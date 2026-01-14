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
import path from 'path';

// Cron schedules (edit these to change timing)
const SCHEDULES = {
  // Every 15 minutes: sync shortage reports from DSC
  dsc: '*/15 * * * *',
  // Daily at 4am: sync drug catalog from DPD
  dpd: '0 4 * * *',
};

// Track running jobs to prevent overlap
const runningJobs = new Set<string>();

/**
 * Run a sync script as a child process
 */
async function runSyncScript(scriptName: 'sync-dsc' | 'sync-dpd'): Promise<{ success: boolean; output: string }> {
  const jobId = scriptName;

  // Prevent concurrent runs of same job
  if (runningJobs.has(jobId)) {
    console.log(`[cron] ${scriptName} already running, skipping`);
    return { success: false, output: 'Job already running' };
  }

  runningJobs.add(jobId);
  const startTime = Date.now();
  console.log(`[cron] Starting ${scriptName} at ${new Date().toISOString()}`);

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
      output.push(line);
      // Log important lines
      if (line.includes('===') || line.includes('Error') || line.includes('Complete')) {
        console.log(`[${scriptName}] ${line.trim()}`);
      }
    });

    child.stderr?.on('data', (data) => {
      const line = data.toString();
      output.push(`[stderr] ${line}`);
      console.error(`[${scriptName}] ${line.trim()}`);
    });

    child.on('close', (code) => {
      runningJobs.delete(jobId);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (code === 0) {
        console.log(`[cron] ${scriptName} completed successfully in ${duration}s`);
        resolve({ success: true, output: output.join('') });
      } else {
        console.error(`[cron] ${scriptName} failed with code ${code} after ${duration}s`);
        resolve({ success: false, output: output.join('') });
      }
    });

    child.on('error', (err) => {
      runningJobs.delete(jobId);
      console.error(`[cron] ${scriptName} spawn error:`, err);
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
