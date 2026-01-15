import { NextResponse } from 'next/server';
import { db, drugs, reports, syncMetadata } from '@/db';
import { sql, eq, desc } from 'drizzle-orm';
import { getFromCache, setInCache } from '@/lib/api-cache';

const CACHE_NAMESPACE = 'stats';
const CACHE_KEY = '__default__';

/**
 * GET /api/stats
 * Returns aggregate statistics for the homepage and stats page
 *
 * Homepage uses: reportsByStatus, resolvedLast30Days, recentShortages, recentDiscontinuations, lastSyncedAt
 * Stats page uses: all fields including accountability metrics for journalists/regulators
 *
 * Uses in-memory cache to avoid hitting the database on every request.
 * Cache is invalidated after 15 minutes.
 */

export async function GET() {
  // Return cached response if still valid
  const cached = getFromCache<Record<string, unknown>>(CACHE_NAMESPACE, CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=60',
        'X-Cache': 'HIT',
      },
    });
  }

  try {
    // Calculate date ranges
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

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
      // Accountability metrics
      shortageDurationStats,
      shortagesByDosageForm,
      shortagesByIngredient,
      shortagesByIngredientAllTime,
      shortagesByTherapeuticClass,
      _monthlyTrendOld, // old 12-month trend, replaced
      rootCauseBreakdown,
      repeatOffenders,
      tier3ActiveList,
      // Trend analysis
      yearToDateComparison,
      quarterlyTrend,
      durationTrendByYear,
      monthlyTrendFull,
      yearlyTotals,
      rootCausesByYear,
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
      // Order by discontinuation date (actual or anticipated), most recent first
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
        .where(sql`${reports.type} = 'discontinuation' AND ${reports.status} IN ('discontinued', 'to_be_discontinued')`)
        .orderBy(sql`COALESCE(${reports.discontinuationDate}, ${reports.anticipatedDiscontinuationDate}) DESC NULLS LAST`)
        .limit(10),

      // Last synced timestamp (for homepage header) - use sync_metadata for accurate tracking
      db.select({ lastSuccessAt: syncMetadata.lastSuccessAt })
        .from(syncMetadata)
        .where(eq(syncMetadata.id, 'dsc')),

      // === ACCOUNTABILITY METRICS (for stats page) ===

      // Shortage duration stats (for resolved shortages with valid dates)
      db.execute(sql`
        SELECT
          round(avg(duration_days)::numeric, 0) as avg_days,
          percentile_cont(0.5) within group (order by duration_days) as median_days,
          min(duration_days) as min_days,
          max(duration_days) as max_days,
          count(*) as sample_size
        FROM (
          SELECT
            EXTRACT(DAY FROM (
              COALESCE(actual_end_date, api_updated_date) - COALESCE(actual_start_date, anticipated_start_date)
            ))::int as duration_days
          FROM reports
          WHERE status = 'resolved'
            AND type = 'shortage'
            AND (actual_start_date IS NOT NULL OR anticipated_start_date IS NOT NULL)
            AND (actual_end_date IS NOT NULL OR api_updated_date IS NOT NULL)
            AND EXTRACT(DAY FROM (
              COALESCE(actual_end_date, api_updated_date) - COALESCE(actual_start_date, anticipated_start_date)
            )) > 0
            AND EXTRACT(DAY FROM (
              COALESCE(actual_end_date, api_updated_date) - COALESCE(actual_start_date, anticipated_start_date)
            )) < 3650
        ) durations
      `),

      // Active shortages by dosage form
      db.execute(sql`
        SELECT
          COALESCE(NULLIF(drug_dosage_form, ''), 'Unknown') as dosage_form,
          count(*) as active_reports
        FROM reports
        WHERE status NOT IN ('resolved', 'reversed', 'avoided_shortage')
          AND type = 'shortage'
        GROUP BY dosage_form
        ORDER BY active_reports DESC
        LIMIT 12
      `),

      // Active shortages by ingredient (using first ingredient from the list)
      db.execute(sql`
        SELECT
          TRIM(BOTH FROM REPLACE(
            COALESCE(
              NULLIF(split_part(ingredients, E'\n', 1), ''),
              'Unknown'
            ), E'\r', ''
          )) as ingredient,
          count(*) as active_reports
        FROM reports
        WHERE status NOT IN ('resolved', 'reversed', 'avoided_shortage')
          AND type = 'shortage'
          AND ingredients IS NOT NULL
          AND ingredients != ''
        GROUP BY ingredient
        HAVING TRIM(BOTH FROM REPLACE(
            COALESCE(
              NULLIF(split_part(ingredients, E'\n', 1), ''),
              'Unknown'
            ), E'\r', ''
          )) != 'Unknown'
          AND TRIM(BOTH FROM REPLACE(
            COALESCE(
              NULLIF(split_part(ingredients, E'\n', 1), ''),
              'Unknown'
            ), E'\r', ''
          )) != ''
        ORDER BY active_reports DESC
        LIMIT 15
      `),

      // All-time shortages by ingredient (for comparison chart)
      db.execute(sql`
        SELECT
          TRIM(BOTH FROM REPLACE(
            COALESCE(
              NULLIF(split_part(ingredients, E'\n', 1), ''),
              'Unknown'
            ), E'\r', ''
          )) as ingredient,
          count(*) as total_reports,
          sum(case when status NOT IN ('resolved', 'reversed', 'avoided_shortage') then 1 else 0 end) as active_reports
        FROM reports
        WHERE type = 'shortage'
          AND ingredients IS NOT NULL
          AND ingredients != ''
        GROUP BY ingredient
        HAVING TRIM(BOTH FROM REPLACE(
            COALESCE(
              NULLIF(split_part(ingredients, E'\n', 1), ''),
              'Unknown'
            ), E'\r', ''
          )) != 'Unknown'
          AND TRIM(BOTH FROM REPLACE(
            COALESCE(
              NULLIF(split_part(ingredients, E'\n', 1), ''),
              'Unknown'
            ), E'\r', ''
          )) != ''
        ORDER BY total_reports DESC
        LIMIT 15
      `),

      // Shortages by therapeutic class (ATC level 1 - first letter)
      db.execute(sql`
        SELECT
          CASE
            WHEN atc_code IS NULL OR atc_code = '' THEN 'Unknown'
            ELSE substring(atc_code from 1 for 1)
          END as atc_level1,
          CASE
            WHEN substring(atc_code from 1 for 1) = 'A' THEN 'Alimentary tract'
            WHEN substring(atc_code from 1 for 1) = 'B' THEN 'Blood'
            WHEN substring(atc_code from 1 for 1) = 'C' THEN 'Cardiovascular'
            WHEN substring(atc_code from 1 for 1) = 'D' THEN 'Dermatologicals'
            WHEN substring(atc_code from 1 for 1) = 'G' THEN 'Genitourinary'
            WHEN substring(atc_code from 1 for 1) = 'H' THEN 'Hormones'
            WHEN substring(atc_code from 1 for 1) = 'J' THEN 'Anti-infectives'
            WHEN substring(atc_code from 1 for 1) = 'L' THEN 'Antineoplastic'
            WHEN substring(atc_code from 1 for 1) = 'M' THEN 'Musculoskeletal'
            WHEN substring(atc_code from 1 for 1) = 'N' THEN 'Nervous system'
            WHEN substring(atc_code from 1 for 1) = 'P' THEN 'Antiparasitic'
            WHEN substring(atc_code from 1 for 1) = 'R' THEN 'Respiratory'
            WHEN substring(atc_code from 1 for 1) = 'S' THEN 'Sensory organs'
            WHEN substring(atc_code from 1 for 1) = 'V' THEN 'Various'
            ELSE 'Unknown'
          END as category_name,
          count(*) as total_reports,
          sum(case when status NOT IN ('resolved', 'reversed', 'avoided_shortage') then 1 else 0 end) as active_reports
        FROM reports
        WHERE type = 'shortage'
        GROUP BY atc_level1, category_name
        ORDER BY active_reports DESC
      `),

      // Monthly trend (new shortages per month, last 12 months)
      db.execute(sql`
        SELECT
          to_char(api_created_date, 'YYYY-MM') as month,
          count(*) as new_shortages,
          sum(case when type = 'discontinuation' then 1 else 0 end) as new_discontinuations
        FROM reports
        WHERE api_created_date >= ${oneYearAgo.toISOString()}::timestamp
        GROUP BY to_char(api_created_date, 'YYYY-MM')
        ORDER BY month ASC
      `),

      // Root cause breakdown (categorize shortage reasons)
      db.execute(sql`
        SELECT
          CASE
            WHEN lower(reason_en) LIKE '%manufactur%' THEN 'Manufacturing issues'
            WHEN lower(reason_en) LIKE '%demand%' OR lower(reason_en) LIKE '%increased%' THEN 'Increased demand'
            WHEN lower(reason_en) LIKE '%supply%' OR lower(reason_en) LIKE '%raw material%' OR lower(reason_en) LIKE '%ingredient%' THEN 'Supply chain'
            WHEN lower(reason_en) LIKE '%regulatory%' OR lower(reason_en) LIKE '%recall%' OR lower(reason_en) LIKE '%quality%' THEN 'Regulatory/Quality'
            WHEN lower(reason_en) LIKE '%discontinu%' OR lower(reason_en) LIKE '%business%' THEN 'Business decision'
            WHEN lower(reason_en) LIKE '%shipping%' OR lower(reason_en) LIKE '%transport%' OR lower(reason_en) LIKE '%logistics%' THEN 'Logistics'
            WHEN reason_en IS NULL OR reason_en = '' THEN 'Not specified'
            ELSE 'Other'
          END as reason_category,
          count(*) as count
        FROM reports
        WHERE type = 'shortage'
        GROUP BY reason_category
        ORDER BY count DESC
      `),

      // Repeat offenders - companies with most total shortages (not just active)
      db.execute(sql`
        SELECT
          company,
          count(*) as total_shortages,
          sum(case when status NOT IN ('resolved', 'reversed', 'avoided_shortage') then 1 else 0 end) as active_shortages,
          sum(case when late_submission = true then 1 else 0 end) as late_count,
          round(100.0 * sum(case when late_submission = true then 1 else 0 end) / count(*), 1) as late_rate_pct,
          min(api_created_date) as first_report,
          max(api_created_date) as latest_report
        FROM reports
        WHERE company IS NOT NULL AND type = 'shortage'
        GROUP BY company
        HAVING count(*) >= 20
        ORDER BY total_shortages DESC
        LIMIT 15
      `),

      // Tier 3 shortages list (active, for accountability)
      db.select({
        reportId: reports.reportId,
        din: reports.din,
        brandName: reports.brandName,
        commonName: reports.commonName,
        company: reports.company,
        status: reports.status,
        reasonEn: reports.reasonEn,
        actualStartDate: reports.actualStartDate,
        apiUpdatedDate: reports.apiUpdatedDate,
      })
        .from(reports)
        .where(sql`${reports.tier3} = true AND ${reports.status} NOT IN ('resolved', 'reversed', 'avoided_shortage')`)
        .orderBy(desc(reports.apiUpdatedDate))
        .limit(20),

      // === TREND ANALYSIS ===

      // Year-to-date comparison (same period this year vs last year)
      db.execute(sql`
        WITH current_ytd AS (
          SELECT
            count(*) as total_reports,
            sum(case when type = 'shortage' then 1 else 0 end) as shortages,
            sum(case when type = 'discontinuation' then 1 else 0 end) as discontinuations,
            sum(case when late_submission = true then 1 else 0 end) as late_reports,
            sum(case when tier_3 = true then 1 else 0 end) as tier3_reports
          FROM reports
          WHERE api_created_date >= date_trunc('year', CURRENT_DATE)
            AND api_created_date <= CURRENT_DATE
        ),
        previous_ytd AS (
          SELECT
            count(*) as total_reports,
            sum(case when type = 'shortage' then 1 else 0 end) as shortages,
            sum(case when type = 'discontinuation' then 1 else 0 end) as discontinuations,
            sum(case when late_submission = true then 1 else 0 end) as late_reports,
            sum(case when tier_3 = true then 1 else 0 end) as tier3_reports
          FROM reports
          WHERE api_created_date >= (date_trunc('year', CURRENT_DATE) - INTERVAL '1 year')
            AND api_created_date <= (CURRENT_DATE - INTERVAL '1 year')
        ),
        full_years AS (
          SELECT
            EXTRACT(YEAR FROM api_created_date)::int as year,
            count(*) as total_reports,
            sum(case when type = 'shortage' then 1 else 0 end) as shortages
          FROM reports
          WHERE api_created_date >= '2017-01-01'
          GROUP BY EXTRACT(YEAR FROM api_created_date)
          ORDER BY year
        )
        SELECT
          cy.total_reports as current_ytd_total,
          py.total_reports as previous_ytd_total,
          cy.shortages as current_ytd_shortages,
          py.shortages as previous_ytd_shortages,
          cy.late_reports as current_ytd_late,
          py.late_reports as previous_ytd_late,
          cy.tier3_reports as current_ytd_tier3,
          py.tier3_reports as previous_ytd_tier3,
          EXTRACT(YEAR FROM CURRENT_DATE)::int as current_year,
          (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::int as previous_year,
          to_char(CURRENT_DATE, 'Mon DD') as ytd_date,
          EXTRACT(DOY FROM CURRENT_DATE)::int as day_of_year
        FROM current_ytd cy, previous_ytd py
      `),

      // Quarterly trend (all available data)
      db.execute(sql`
        SELECT
          to_char(api_created_date, 'YYYY-"Q"Q') as quarter,
          EXTRACT(YEAR FROM api_created_date)::int as year,
          EXTRACT(QUARTER FROM api_created_date)::int as q,
          count(*) as new_reports,
          sum(case when type = 'shortage' then 1 else 0 end) as shortages,
          sum(case when type = 'discontinuation' then 1 else 0 end) as discontinuations,
          sum(case when late_submission = true then 1 else 0 end) as late_reports,
          round(100.0 * sum(case when late_submission = true then 1 else 0 end) / nullif(count(*), 0), 1) as late_rate_pct
        FROM reports
        WHERE api_created_date >= '2017-01-01'
        GROUP BY to_char(api_created_date, 'YYYY-"Q"Q'), EXTRACT(YEAR FROM api_created_date), EXTRACT(QUARTER FROM api_created_date)
        ORDER BY year, q
      `),

      // Average shortage duration trend by year (are shortages lasting longer?)
      db.execute(sql`
        SELECT
          EXTRACT(YEAR FROM COALESCE(actual_end_date, api_updated_date))::int as year,
          round(avg(EXTRACT(DAY FROM (
            COALESCE(actual_end_date, api_updated_date) - COALESCE(actual_start_date, anticipated_start_date)
          )))::numeric, 0) as avg_duration_days,
          percentile_cont(0.5) within group (order by EXTRACT(DAY FROM (
            COALESCE(actual_end_date, api_updated_date) - COALESCE(actual_start_date, anticipated_start_date)
          ))) as median_duration_days,
          count(*) as resolved_count
        FROM reports
        WHERE status = 'resolved'
          AND type = 'shortage'
          AND (actual_start_date IS NOT NULL OR anticipated_start_date IS NOT NULL)
          AND EXTRACT(DAY FROM (
            COALESCE(actual_end_date, api_updated_date) - COALESCE(actual_start_date, anticipated_start_date)
          )) BETWEEN 1 AND 3650
        GROUP BY EXTRACT(YEAR FROM COALESCE(actual_end_date, api_updated_date))
        HAVING count(*) >= 10
        ORDER BY year ASC
      `),

      // Monthly trend (ALL months since 2017)
      db.execute(sql`
        SELECT
          to_char(api_created_date, 'YYYY-MM') as month,
          to_char(api_created_date, 'Mon YYYY') as month_label,
          EXTRACT(YEAR FROM api_created_date)::int as year,
          count(*) as new_reports,
          sum(case when type = 'shortage' then 1 else 0 end) as shortages,
          sum(case when type = 'discontinuation' then 1 else 0 end) as discontinuations
        FROM reports
        WHERE api_created_date >= '2017-01-01'
        GROUP BY to_char(api_created_date, 'YYYY-MM'), to_char(api_created_date, 'Mon YYYY'), EXTRACT(YEAR FROM api_created_date)
        ORDER BY month ASC
      `),

      // Yearly totals by status for detailed breakdown
      db.execute(sql`
        SELECT
          EXTRACT(YEAR FROM api_created_date)::int as year,
          count(*) as total_reports,
          sum(case when type = 'shortage' then 1 else 0 end) as shortages,
          sum(case when type = 'discontinuation' then 1 else 0 end) as discontinuations,
          sum(case when status = 'active_confirmed' then 1 else 0 end) as active_confirmed,
          sum(case when status = 'anticipated_shortage' then 1 else 0 end) as anticipated,
          sum(case when status = 'resolved' then 1 else 0 end) as resolved,
          sum(case when status = 'avoided_shortage' then 1 else 0 end) as avoided,
          sum(case when status = 'to_be_discontinued' then 1 else 0 end) as to_be_discontinued,
          sum(case when status = 'discontinued' then 1 else 0 end) as discontinued,
          sum(case when tier_3 = true then 1 else 0 end) as tier3_reports
        FROM reports
        WHERE api_created_date >= '2017-01-01'
        GROUP BY EXTRACT(YEAR FROM api_created_date)
        ORDER BY year ASC
      `),

      // Root causes by year (for trend chart)
      db.execute(sql`
        SELECT
          EXTRACT(YEAR FROM api_created_date)::int as year,
          CASE
            WHEN lower(reason_en) LIKE '%manufactur%' THEN 'Manufacturing issues'
            WHEN lower(reason_en) LIKE '%demand%' OR lower(reason_en) LIKE '%increased%' THEN 'Increased demand'
            WHEN lower(reason_en) LIKE '%supply%' OR lower(reason_en) LIKE '%raw material%' OR lower(reason_en) LIKE '%ingredient%' THEN 'Supply chain'
            WHEN lower(reason_en) LIKE '%regulatory%' OR lower(reason_en) LIKE '%recall%' OR lower(reason_en) LIKE '%quality%' THEN 'Regulatory/Quality'
            WHEN lower(reason_en) LIKE '%discontinu%' OR lower(reason_en) LIKE '%business%' THEN 'Business decision'
            WHEN lower(reason_en) LIKE '%shipping%' OR lower(reason_en) LIKE '%transport%' OR lower(reason_en) LIKE '%logistics%' THEN 'Logistics'
            WHEN reason_en IS NULL OR reason_en = '' THEN 'Not specified'
            ELSE 'Other'
          END as reason_category,
          count(*) as count
        FROM reports
        WHERE type = 'shortage'
          AND api_created_date >= '2017-01-01'
        GROUP BY year, reason_category
        ORDER BY year ASC
      `),
    ]);

    // Build the result object
    const result = {
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
      lastSyncedAt: lastSync?.lastSuccessAt?.toISOString() || null,

      // === ACCOUNTABILITY METRICS (stats page) ===
      accountability: {
        shortageDuration: Array.isArray(shortageDurationStats) ? shortageDurationStats[0] : null,
        shortagesByDosageForm: Array.isArray(shortagesByDosageForm) ? shortagesByDosageForm : [],
        shortagesByIngredient: Array.isArray(shortagesByIngredient) ? shortagesByIngredient : [],
        shortagesByIngredientAllTime: Array.isArray(shortagesByIngredientAllTime) ? shortagesByIngredientAllTime : [],
        shortagesByTherapeuticClass: Array.isArray(shortagesByTherapeuticClass) ? shortagesByTherapeuticClass : [],
        rootCauseBreakdown: Array.isArray(rootCauseBreakdown) ? rootCauseBreakdown : [],
        rootCausesByYear: Array.isArray(rootCausesByYear) ? rootCausesByYear : [],
        repeatOffenders: Array.isArray(repeatOffenders) ? repeatOffenders : [],
        tier3ActiveList: tier3ActiveList,
      },

      // === TREND ANALYSIS (stats page) ===
      trends: {
        monthly: Array.isArray(monthlyTrendFull) ? monthlyTrendFull : [],
        quarterly: Array.isArray(quarterlyTrend) ? quarterlyTrend : [],
        yearly: Array.isArray(yearlyTotals) ? yearlyTotals : [],
        yearToDate: Array.isArray(yearToDateComparison) ? yearToDateComparison[0] : null,
        durationByYear: Array.isArray(durationTrendByYear) ? durationTrendByYear : [],
      },

      generatedAt: new Date().toISOString(),
    };

    // Cache the result in memory
    setInCache(CACHE_NAMESPACE, CACHE_KEY, result);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=60',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
