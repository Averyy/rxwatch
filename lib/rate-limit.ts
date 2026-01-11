import { RateLimiterMemory } from 'rate-limiter-flexible';

// 120 requests per minute per IP
// Generous for normal browsing, blocks scrapers/bots
const rateLimiter = new RateLimiterMemory({
  points: 120,
  duration: 60,
});

export async function rateLimit(ip: string): Promise<{ success: boolean }> {
  try {
    await rateLimiter.consume(ip);
    return { success: true };
  } catch {
    return { success: false };
  }
}
