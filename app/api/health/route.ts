import { NextResponse } from 'next/server';
import { db, drugs, reports } from '@/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/health
 * Health check endpoint - verifies database connection and returns stats
 */
export async function GET() {
  try {
    // Test database connection and get counts
    const [drugCount] = await db.select({ count: sql<number>`count(*)` }).from(drugs);
    const [reportCount] = await db.select({ count: sql<number>`count(*)` }).from(reports);

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      stats: {
        drugs: Number(drugCount.count),
        reports: Number(reportCount.count),
      },
      timestamp: new Date().toISOString(),
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
