/**
 * Simple notification system for cron job failures
 *
 * Supports:
 * - Webhook (Discord, Slack, etc.)
 * - Log file with rotation
 *
 * Set NOTIFY_WEBHOOK_URL in .env.local to enable webhook notifications.
 * Example for Discord: https://discord.com/api/webhooks/...
 */

import * as fs from 'fs';
import * as path from 'path';

const NOTIFY_WEBHOOK_URL = process.env.NOTIFY_WEBHOOK_URL;
const LOG_DIR = path.join(process.cwd(), 'logs');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'cron-errors.log');
const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_LOG_FILES = 3;

interface NotificationPayload {
  script: string;
  status: 'success' | 'error';
  message: string;
  details?: string;
  timestamp: string;
}

/**
 * Ensure log directory exists
 */
function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Rotate log files if current log exceeds max size
 */
function rotateLogsIfNeeded(): void {
  try {
    if (!fs.existsSync(ERROR_LOG_FILE)) return;

    const stats = fs.statSync(ERROR_LOG_FILE);
    if (stats.size < MAX_LOG_SIZE_BYTES) return;

    // Rotate existing files
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const oldFile = `${ERROR_LOG_FILE}.${i}`;
      const newFile = `${ERROR_LOG_FILE}.${i + 1}`;
      if (fs.existsSync(oldFile)) {
        if (i === MAX_LOG_FILES - 1) {
          // Delete the oldest file
          fs.unlinkSync(oldFile);
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    // Rotate current file to .1
    fs.renameSync(ERROR_LOG_FILE, `${ERROR_LOG_FILE}.1`);
    console.log(`Log rotated: ${ERROR_LOG_FILE}`);
  } catch (error) {
    console.error('Failed to rotate logs:', error);
  }
}

/**
 * Log to file with rotation
 */
function logToFile(payload: NotificationPayload): void {
  ensureLogDir();
  rotateLogsIfNeeded();

  const logLine = `[${payload.timestamp}] ${payload.script} ${payload.status.toUpperCase()}: ${payload.message}${payload.details ? '\n  ' + payload.details.slice(0, 2000) : ''}\n`;
  fs.appendFileSync(ERROR_LOG_FILE, logLine);
}

/**
 * Send webhook notification with retry
 */
async function sendWebhook(payload: NotificationPayload): Promise<boolean> {
  if (!NOTIFY_WEBHOOK_URL) return true; // No webhook configured, consider success

  const emoji = payload.status === 'error' ? '🚨' : '✅';
  const color = payload.status === 'error' ? 0xff0000 : 0x00ff00;

  // Truncate details if too long, add indicator
  let details = payload.details || '';
  const MAX_DETAILS_LENGTH = 1000;
  if (details.length > MAX_DETAILS_LENGTH) {
    details = details.slice(0, MAX_DETAILS_LENGTH) + '\n... (truncated)';
  }

  // Discord webhook format (also works with Slack-compatible webhooks)
  const body = {
    embeds: [{
      title: `${emoji} RxWatch Cron: ${payload.script}`,
      description: payload.message,
      color,
      fields: details ? [{
        name: 'Details',
        value: details,
      }] : [],
      timestamp: payload.timestamp,
    }],
  };

  // Retry up to 3 times with exponential backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(NOTIFY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return true;
      }

      // Log webhook failure but don't throw
      console.error(`Webhook notification failed (attempt ${attempt}/3): HTTP ${response.status}`);
    } catch (error) {
      console.error(`Webhook notification error (attempt ${attempt}/3):`, error);
    }

    if (attempt < 3) {
      // Exponential backoff
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }

  // Log webhook failure to file for debugging
  const failureLog = `[${new Date().toISOString()}] WEBHOOK_FAILURE: Failed to send notification for ${payload.script}\n`;
  try {
    ensureLogDir();
    fs.appendFileSync(ERROR_LOG_FILE, failureLog);
  } catch {
    // Ignore file write errors
  }

  return false;
}

/**
 * Notify about cron job result
 */
export async function notify(
  script: string,
  status: 'success' | 'error',
  message: string,
  details?: string
): Promise<void> {
  const payload: NotificationPayload = {
    script,
    status,
    message,
    details,
    timestamp: new Date().toISOString(),
  };

  // Always log errors to file
  if (status === 'error') {
    logToFile(payload);
  }

  // Send webhook for errors
  if (status === 'error') {
    const webhookSent = await sendWebhook(payload);
    if (!webhookSent && NOTIFY_WEBHOOK_URL) {
      console.error(`WARNING: Failed to send webhook notification for ${script} error`);
    }
  }
}

/**
 * Notify about successful completion with stats
 */
export async function notifySuccess(script: string, stats: Record<string, number | string>): Promise<void> {
  const statsStr = Object.entries(stats)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  // Log success to console only (not to file to avoid log bloat)
  console.log(`[${new Date().toISOString()}] ${script} SUCCESS: ${statsStr}`);
}

/**
 * Notify about failure
 */
export async function notifyError(script: string, error: Error | string): Promise<void> {
  const message = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;

  await notify(script, 'error', message, stack);
}
