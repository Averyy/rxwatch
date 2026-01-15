import { NextResponse } from 'next/server';
import { db, drugs, reports, syncMetadata } from '@/db';
import { sql, eq } from 'drizzle-orm';

// DSC sync is stale if no updates in 30 minutes (syncs every 15 min)
const DSC_STALE_THRESHOLD_MS = 30 * 60 * 1000;
// DPD sync is stale if no updates in 36 hours (syncs daily at 4am)
const DPD_STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000;

/**
 * GET /api/health
 * Health check endpoint - verifies database connection and returns stats
 */
export async function GET() {
  try {
    // Test database connection and get counts
    const [drugCount] = await db.select({ count: sql<number>`count(*)` }).from(drugs);
    const [reportCount] = await db.select({ count: sql<number>`count(*)` }).from(reports);

    // Get sync metadata (tracks when cron jobs actually run)
    const [dscMeta] = await db
      .select()
      .from(syncMetadata)
      .where(eq(syncMetadata.id, 'dsc'));

    const [dpdMeta] = await db
      .select()
      .from(syncMetadata)
      .where(eq(syncMetadata.id, 'dpd'));

    const now = new Date();

    // Calculate DSC sync status from metadata
    let dscStatus: 'current' | 'stale' | 'never' = 'never';
    let dscSyncedAt: Date | null = null;

    if (dscMeta?.lastSuccessAt) {
      dscSyncedAt = dscMeta.lastSuccessAt;
      const syncAge = now.getTime() - dscSyncedAt.getTime();
      dscStatus = syncAge > DSC_STALE_THRESHOLD_MS ? 'stale' : 'current';
    }

    // Calculate DPD sync status from metadata
    let dpdStatus: 'current' | 'stale' | 'never' = 'never';
    let dpdSyncedAt: Date | null = null;

    if (dpdMeta?.lastSuccessAt) {
      dpdSyncedAt = dpdMeta.lastSuccessAt;
      const syncAge = now.getTime() - dpdSyncedAt.getTime();
      dpdStatus = syncAge > DPD_STALE_THRESHOLD_MS ? 'stale' : 'current';
    }

    // Use most recent sync for display (usually DSC since it runs more often)
    const lastSyncedAt = dscSyncedAt && dpdSyncedAt
      ? (dscSyncedAt > dpdSyncedAt ? dscSyncedAt : dpdSyncedAt)
      : dscSyncedAt || dpdSyncedAt;

    // Overall status
    const isHealthy = dscStatus === 'current' || dscStatus === 'never';
    const syncWarning = dscStatus === 'stale'
      ? `Reports sync is stale. Last success: ${Math.round((now.getTime() - (dscSyncedAt?.getTime() || 0)) / 60000)} minutes ago.`
      : dscMeta?.lastError
        ? `Last sync error: ${dscMeta.lastError}`
        : null;

    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'degraded',
      database: 'connected',
      stats: {
        drugs: Number(drugCount.count),
        reports: Number(reportCount.count),
      },
      sync: {
        lastSyncedAt: lastSyncedAt?.toISOString() || null,
        dsc: {
          lastSyncedAt: dscSyncedAt?.toISOString() || null,
          lastRunAt: dscMeta?.lastRunAt?.toISOString() || null,
          status: dscStatus,
          consecutiveFailures: dscMeta?.consecutiveFailures || 0,
          lastError: dscMeta?.lastError || null,
        },
        dpd: {
          lastSyncedAt: dpdSyncedAt?.toISOString() || null,
          lastRunAt: dpdMeta?.lastRunAt?.toISOString() || null,
          status: dpdStatus,
          consecutiveFailures: dpdMeta?.consecutiveFailures || 0,
          lastError: dpdMeta?.lastError || null,
        },
        status: dscStatus === 'never' ? 'current' : dscStatus,
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
