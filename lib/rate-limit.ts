/**
 * Simple in-memory rate limiter compatible with Edge Runtime
 * 120 requests per minute per IP
 */

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 120;

// Store: IP -> array of request timestamps
const requests = new Map<string, number[]>();

// Cleanup old entries periodically
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - WINDOW_MS;
  for (const [ip, timestamps] of requests.entries()) {
    const valid = timestamps.filter(t => t > cutoff);
    if (valid.length === 0) {
      requests.delete(ip);
    } else {
      requests.set(ip, valid);
    }
  }
}

export async function rateLimit(ip: string): Promise<{ success: boolean }> {
  cleanup();

  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const timestamps = requests.get(ip) || [];

  // Filter to only recent requests
  const recent = timestamps.filter(t => t > cutoff);

  if (recent.length >= MAX_REQUESTS) {
    return { success: false };
  }

  // Add this request
  recent.push(now);
  requests.set(ip, recent);

  return { success: true };
}
