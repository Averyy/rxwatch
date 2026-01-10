/**
 * Simple in-memory cache for API responses
 * Keys are based on sorted query params to ensure consistent cache hits
 * TTL is 15 minutes (matches data sync interval)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_ENTRIES = 50; // Limit memory usage

// Separate caches for different endpoints
const caches = new Map<string, Map<string, CacheEntry<unknown>>>();

function getCache(namespace: string): Map<string, CacheEntry<unknown>> {
  if (!caches.has(namespace)) {
    caches.set(namespace, new Map());
  }
  return caches.get(namespace)!;
}

/**
 * Generate a cache key from URL search params
 * Sorts params for consistent keys regardless of param order
 */
export function getCacheKey(searchParams: URLSearchParams): string {
  const params = Array.from(searchParams.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return params || '__default__';
}

/**
 * Get cached data if still valid
 */
export function getFromCache<T>(namespace: string, key: string): T | null {
  const cache = getCache(namespace);
  const entry = cache.get(key);

  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data as T;
  }

  // Clean up expired entry
  if (entry) {
    cache.delete(key);
  }

  return null;
}

/**
 * Store data in cache
 * Uses Map's insertion-order iteration for O(1) eviction of oldest entry
 */
export function setInCache<T>(namespace: string, key: string, data: T): void {
  const cache = getCache(namespace);

  // Delete existing key first to update insertion order on re-set
  if (cache.has(key)) {
    cache.delete(key);
  }

  // Evict oldest entry if cache is full (first key in Map iteration order)
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, { data, timestamp: Date.now() });
}

