import { NextResponse } from 'next/server';
import { db, reports } from '@/db';
import { desc, asc, sql, eq } from 'drizzle-orm';

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
 * - limit=20                       Limit results (for homepage recent reports)
 */
const VALID_TYPES = ['shortage', 'discontinuation'];
const VALID_STATUSES = ['active_confirmed', 'anticipated_shortage', 'avoided_shortage', 'resolved', 'to_be_discontinued', 'discontinued', 'reversed'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const company = searchParams.get('company');
    const din = searchParams.get('din');
    const tier3 = searchParams.get('tier3');
    const late = searchParams.get('late');
    const since = searchParams.get('since');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : undefined;

    // Build query conditions
    const conditions = [];

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

    // Query all reports (or filtered subset)
    const result = await db
      .select({
        id: reports.id,
        reportId: reports.reportId,
        din: reports.din,
        brandName: reports.brandName,
        commonName: reports.commonName,
        drugStrength: reports.drugStrength,
        drugDosageForm: reports.drugDosageForm,
        type: reports.type,
        status: reports.status,
        reasonEn: reports.reasonEn,
        company: reports.company,
        tier3: reports.tier3,
        lateSubmission: reports.lateSubmission,
        actualStartDate: reports.actualStartDate,
        estimatedEndDate: reports.estimatedEndDate,
        actualEndDate: reports.actualEndDate,
        discontinuationDate: reports.discontinuationDate,
        apiCreatedDate: reports.apiCreatedDate,
        apiUpdatedDate: reports.apiUpdatedDate,
      })
      .from(reports)
      .where(conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined)
      .orderBy(desc(reports.apiUpdatedDate))
      .limit(limit || 100000); // Default to all if no limit specified

    return NextResponse.json({
      rows: result,
      totalRows: result.length,
    }, {
      headers: { 'Cache-Control': 'public, max-age=900' }, // 15 min
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
