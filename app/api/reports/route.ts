import { NextResponse } from 'next/server';
import { db, reports } from '@/db';
import { desc, asc, sql, eq, type SQL } from 'drizzle-orm';
import { getCacheKey, getFromCache, setInCache } from '@/lib/api-cache';

const CACHE_NAMESPACE = 'reports';

/**
 * GET /api/reports
 * Returns reports for AG Grid (client-side row model)
 *
 * Query params (all optional, combine as needed):
 * - active=true                    Only active reports (~1,900) - excludes resolved/reversed/avoided
 * - type=shortage                  Filter by type (shortage|discontinuation)
 * - status=active_confirmed        Filter by exact status (validated enum)
 * - company=PFIZER                 Filter by company (partial match, case-insensitive)
 * - din=02345678                   Filter by DIN (exact match)
 * - tier3=true                     Only Tier 3 critical shortages
 * - late=true                      Only late submissions
 * - since=2024-01-01               Reports updated since date (ISO format)
 * - until=2024-12-31               Reports updated until date (ISO format)
 * - created_since=2024-01-01       Reports created since date (ISO format)
 * - created_until=2024-12-31       Reports created until date (ISO format)
 * - limit=20                       Limit results (for homepage recent reports)
 */
const VALID_TYPES = ['shortage', 'discontinuation'];
const VALID_STATUSES = ['active_confirmed', 'anticipated_shortage', 'avoided_shortage', 'resolved', 'to_be_discontinued', 'discontinued', 'reversed'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cacheKey = getCacheKey(searchParams);

    // Check cache first
    const cached = getFromCache<{ rows: unknown[]; totalRows: number }>(CACHE_NAMESPACE, cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, max-age=900, stale-while-revalidate=60',
          'X-Cache': 'HIT',
        },
      });
    }

    const active = searchParams.get('active');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const company = searchParams.get('company');
    const din = searchParams.get('din');
    const tier3 = searchParams.get('tier3');
    const late = searchParams.get('late');
    const since = searchParams.get('since');
    const until = searchParams.get('until');
    const createdSince = searchParams.get('created_since');
    const createdUntil = searchParams.get('created_until');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : undefined;

    // Build query conditions
    const conditions: SQL[] = [];

    // Active = not resolved, not reversed, not avoided
    if (active === 'true') {
      conditions.push(sql`${reports.status} NOT IN ('resolved', 'reversed', 'avoided_shortage')`);
    }

    if (type) {
      if (!VALID_TYPES.includes(type)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
          { status: 400 }
        );
      }
      conditions.push(sql`${reports.type} = ${type}`);
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      conditions.push(sql`${reports.status} = ${status}`);
    }

    if (company) {
      conditions.push(sql`${reports.company} ILIKE ${'%' + company + '%'}`);
    }

    if (din) {
      if (!/^\d{8}$/.test(din)) {
        return NextResponse.json(
          { error: 'Invalid DIN format. Must be 8 digits.' },
          { status: 400 }
        );
      }
      conditions.push(sql`${reports.din} = ${din}`);
    }

    if (tier3 === 'true') {
      conditions.push(sql`${reports.tier3} = true`);
    }

    if (late === 'true') {
      conditions.push(sql`${reports.lateSubmission} = true`);
    }

    if (since) {
      conditions.push(sql`${reports.apiUpdatedDate} >= ${since}::timestamp`);
    }

    if (until) {
      conditions.push(sql`${reports.apiUpdatedDate} <= ${until}::timestamp`);
    }

    if (createdSince) {
      conditions.push(sql`${reports.apiCreatedDate} >= ${createdSince}::timestamp`);
    }

    if (createdUntil) {
      conditions.push(sql`${reports.apiCreatedDate} <= ${createdUntil}::timestamp`);
    }

    // Query all reports (or filtered subset)
    const result = await db
      .select({
        reportId: reports.reportId,
        din: reports.din,
        brandName: reports.brandName,
        commonName: reports.commonName,
        type: reports.type,
        status: reports.status,
        reasonEn: reports.reasonEn,
        company: reports.company,
        tier3: reports.tier3,
        lateSubmission: reports.lateSubmission,
        actualStartDate: reports.actualStartDate,
        estimatedEndDate: reports.estimatedEndDate,
        actualEndDate: reports.actualEndDate,
        anticipatedDiscontinuationDate: reports.anticipatedDiscontinuationDate,
        discontinuationDate: reports.discontinuationDate,
        apiCreatedDate: reports.apiCreatedDate,
        apiUpdatedDate: reports.apiUpdatedDate,
      })
      .from(reports)
      .where(conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined)
      .orderBy(desc(reports.apiUpdatedDate))
      .limit(limit || 100000); // Default to all if no limit specified

    const responseData = {
      rows: result,
      totalRows: result.length,
    };

    // Store in cache
    setInCache(CACHE_NAMESPACE, cacheKey, responseData);

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=60',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
