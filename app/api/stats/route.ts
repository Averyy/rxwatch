import { NextResponse } from 'next/server';
import { db, drugs, reports } from '@/db';
import { sql, eq, desc } from 'drizzle-orm';

/**
 * GET /api/stats
 * Returns aggregate statistics for the homepage and stats page
 *
 * Homepage uses: reportsByStatus, resolvedLast30Days, recentShortages, recentDiscontinuations, lastSyncedAt
 * Stats page uses: all fields
 */
export async function GET() {
  try {
    // Calculate 30 days ago for resolved query
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Run all queries in parallel for better performance
    const [
      drugStatusCounts,
      reportStatusCounts,
      reportTypeCounts,
      [activeReportCount],
      [tier3Count],
      [lateCount],
      [drugsWithReports],
      [totalDrugs],
      [totalReports],
      topCompaniesByShortages,
      lateRateByCompany,
      [resolvedLast30Days],
      recentShortages,
      recentDiscontinuations,
      [lastSync],
    ] = await Promise.all([
      // Drug counts by status
      db.select({
        status: drugs.currentStatus,
        count: sql<number>`count(*)::int`,
      }).from(drugs).groupBy(drugs.currentStatus),

      // Report counts by status
      db.select({
        status: reports.status,
        count: sql<number>`count(*)::int`,
      }).from(reports).groupBy(reports.status),

      // Report counts by type
      db.select({
        type: reports.type,
        count: sql<number>`count(*)::int`,
      }).from(reports).groupBy(reports.type),

      // Active reports (not resolved/reversed/avoided)
      db.select({ count: sql<number>`count(*)::int` })
        .from(reports)
        .where(sql`${reports.status} NOT IN ('resolved', 'reversed', 'avoided_shortage')`),

      // Tier 3 critical shortages (active only)
      db.select({ count: sql<number>`count(*)::int` })
        .from(reports)
        .where(sql`${reports.tier3} = true AND ${reports.status} NOT IN ('resolved', 'reversed', 'avoided_shortage')`),

      // Late submissions count
      db.select({ count: sql<number>`count(*)::int` })
        .from(reports)
        .where(eq(reports.lateSubmission, true)),

      // Drugs with shortage history
      db.select({ count: sql<number>`count(*)::int` })
        .from(drugs)
        .where(eq(drugs.hasReports, true)),

      // Total drugs
      db.select({ count: sql<number>`count(*)::int` }).from(drugs),

      // Total reports
      db.select({ count: sql<number>`count(*)::int` }).from(reports),

      // Top companies by active shortage count
      db.select({
        company: reports.company,
        count: sql<number>`count(*)::int`,
      })
        .from(reports)
        .where(sql`${reports.status} NOT IN ('resolved', 'reversed', 'avoided_shortage')`)
        .groupBy(reports.company)
        .orderBy(sql`count(*) DESC`)
        .limit(10),

      // Late submission rate by company (top offenders)
      db.execute(sql`
        SELECT
          company,
          count(*) as total_reports,
          sum(case when late_submission = true then 1 else 0 end) as late_reports,
          round(100.0 * sum(case when late_submission = true then 1 else 0 end) / count(*), 1) as late_rate_pct
        FROM reports
        WHERE company IS NOT NULL
        GROUP BY company
        HAVING count(*) >= 10
        ORDER BY late_rate_pct DESC
        LIMIT 10
      `),

      // Resolved in last 30 days (for homepage)
      db.select({ count: sql<number>`count(*)::int` })
        .from(reports)
        .where(sql`${reports.status} = 'resolved' AND (
          ${reports.actualEndDate} >= ${thirtyDaysAgo.toISOString()}::timestamp
          OR ${reports.apiUpdatedDate} >= ${thirtyDaysAgo.toISOString()}::timestamp
        )`),

      // Recent Tier 3 critical shortages (for homepage)
      db.select({
        reportId: reports.reportId,
        din: reports.din,
        brandName: reports.brandName,
        commonName: reports.commonName,
        status: reports.status,
        company: reports.company,
        reasonEn: reports.reasonEn,
        tier3: reports.tier3,
        apiUpdatedDate: reports.apiUpdatedDate,
        actualStartDate: reports.actualStartDate,
        anticipatedStartDate: reports.anticipatedStartDate,
      })
        .from(reports)
        .where(sql`${reports.tier3} = true AND ${reports.status} NOT IN ('resolved', 'reversed', 'avoided_shortage')`)
        .orderBy(desc(reports.apiUpdatedDate))
        .limit(10),

      // Recent discontinuation reports (for homepage)
      db.select({
        reportId: reports.reportId,
        din: reports.din,
        brandName: reports.brandName,
        commonName: reports.commonName,
        status: reports.status,
        company: reports.company,
        reasonEn: reports.reasonEn,
        tier3: reports.tier3,
        apiUpdatedDate: reports.apiUpdatedDate,
        discontinuationDate: reports.discontinuationDate,
        anticipatedDiscontinuationDate: reports.anticipatedDiscontinuationDate,
      })
        .from(reports)
        .where(sql`${reports.type} = 'discontinuation'`)
        .orderBy(desc(reports.apiUpdatedDate))
        .limit(10),

      // Last synced timestamp (for homepage header)
      db.select({ updatedAt: reports.updatedAt })
        .from(reports)
        .orderBy(desc(reports.updatedAt))
        .limit(1),
    ]);

    // Cache for 5 min (homepage needs fresher data)
    return NextResponse.json({
      totals: {
        drugs: totalDrugs.count,
        reports: totalReports.count,
        drugsWithReports: drugsWithReports.count,
        activeReports: activeReportCount.count,
        tier3Active: tier3Count.count,
        lateSubmissions: lateCount.count,
      },
      drugsByStatus: drugStatusCounts.reduce((acc, { status, count }) => {
        acc[status || 'unknown'] = count;
        return acc;
      }, {} as Record<string, number>),
      reportsByStatus: reportStatusCounts.reduce((acc, { status, count }) => {
        acc[status || 'unknown'] = count;
        return acc;
      }, {} as Record<string, number>),
      reportsByType: reportTypeCounts.reduce((acc, { type, count }) => {
        acc[type] = count;
        return acc;
      }, {} as Record<string, number>),
      topCompaniesByShortages,
      lateRateByCompany,
      // Homepage-specific fields
      resolvedLast30Days: resolvedLast30Days.count,
      recentTier3Shortages: recentShortages,
      recentDiscontinuations,
      lastSyncedAt: lastSync?.updatedAt?.toISOString() || null,
      generatedAt: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, max-age=300' }, // 5 min
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
