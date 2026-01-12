import { NextResponse } from 'next/server';
import { db, drugs, reports } from '@/db';
import { sql, desc } from 'drizzle-orm';

// Sync is considered stale if no updates in 30 minutes (DSC syncs every 15 min)
const STALE_THRESHOLD_MS = 30 * 60 * 1000;
// Sync is considered critical if no updates in 2 hours
const CRITICAL_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/**
 * GET /api/health
 * Health check endpoint - verifies database connection and returns stats
 */
export async function GET() {
  try {
    // Test database connection and get counts
    const [drugCount] = await db.select({ count: sql<number>`count(*)` }).from(drugs);
    const [reportCount] = await db.select({ count: sql<number>`count(*)` }).from(reports);

    // Get the most recent sync time (latest updatedAt from reports)
    const [lastSync] = await db
      .select({ updatedAt: reports.updatedAt })
      .from(reports)
      .orderBy(desc(reports.updatedAt))
      .limit(1);

    const lastSyncedAt = lastSync?.updatedAt || null;
    const now = new Date();

    // Calculate sync status
    let syncStatus: 'current' | 'stale' | 'critical' = 'current';
    let syncWarning: string | null = null;

    if (lastSyncedAt) {
      const syncAge = now.getTime() - lastSyncedAt.getTime();

      if (syncAge > CRITICAL_THRESHOLD_MS) {
        syncStatus = 'critical';
        const hours = Math.round(syncAge / (60 * 60 * 1000));
        syncWarning = `Last sync was ${hours} hours ago. Cron job may have failed.`;
      } else if (syncAge > STALE_THRESHOLD_MS) {
        syncStatus = 'stale';
        const minutes = Math.round(syncAge / (60 * 1000));
        syncWarning = `Last sync was ${minutes} minutes ago. Data may be outdated.`;
      }
    } else {
      syncStatus = 'critical';
      syncWarning = 'No sync data found. Database may not be seeded.';
    }

    // Determine overall health status
    const isHealthy = syncStatus !== 'critical';

    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'degraded',
      database: 'connected',
      stats: {
        drugs: Number(drugCount.count),
        reports: Number(reportCount.count),
      },
      sync: {
        lastSyncedAt: lastSyncedAt?.toISOString() || null,
        status: syncStatus,
        warning: syncWarning,
      },
      timestamp: now.toISOString(),
    }, {
      status: isHealthy ? 200 : 503,
      headers: { 'Cache-Control': 'public, max-age=60' }, // 1 min cache
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
