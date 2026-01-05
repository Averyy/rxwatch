import { NextResponse } from 'next/server';
import { db, drugs } from '@/db';
import { desc, asc, sql } from 'drizzle-orm';

/**
 * GET /api/drugs
 * Returns drugs for AG Grid (client-side row model)
 *
 * Query params (all optional, combine as needed):
 * - hasReports=true       Only drugs with shortage history (~8,800)
 * - status=in_shortage    Filter by currentStatus (validated enum)
 * - company=PFIZER        Filter by company (partial match, case-insensitive)
 * - atc=N02               Filter by ATC code prefix
 * - ingredient=metformin  Filter by active ingredient (partial match)
 * - marketed=true         Only marketed drugs (excludes cancelled/dormant)
 */
// Valid status values
const VALID_STATUSES = ['available', 'in_shortage', 'anticipated', 'discontinued', 'to_be_discontinued'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hasReports = searchParams.get('hasReports');
    const status = searchParams.get('status');
    const company = searchParams.get('company');
    const atc = searchParams.get('atc');
    const ingredient = searchParams.get('ingredient');
    const marketed = searchParams.get('marketed');

    // Build query conditions
    const conditions = [];

    if (hasReports === 'true') {
      conditions.push(sql`${drugs.hasReports} = true`);
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      conditions.push(sql`${drugs.currentStatus} = ${status}`);
    }

    if (company) {
      conditions.push(sql`${drugs.company} ILIKE ${'%' + company + '%'}`);
    }

    if (atc) {
      conditions.push(sql`${drugs.atcCode} LIKE ${atc + '%'}`);
    }

    if (ingredient) {
      conditions.push(sql`${drugs.activeIngredient} ILIKE ${'%' + ingredient + '%'}`);
    }

    if (marketed === 'true') {
      conditions.push(sql`${drugs.marketStatus} = 'Marketed'`);
    }

    // Query drugs with filters
    const result = await db
      .select({
        id: drugs.id,
        din: drugs.din,
        brandName: drugs.brandName,
        commonName: drugs.commonName,
        activeIngredient: drugs.activeIngredient,
        strength: drugs.strength,
        strengthUnit: drugs.strengthUnit,
        form: drugs.form,
        route: drugs.route,
        atcCode: drugs.atcCode,
        company: drugs.company,
        currentStatus: drugs.currentStatus,
        hasReports: drugs.hasReports,
        marketStatus: drugs.marketStatus,
      })
      .from(drugs)
      .where(conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined)
      .orderBy(asc(drugs.brandName));

    return NextResponse.json({
      rows: result,
      totalRows: result.length,
    }, {
      headers: { 'Cache-Control': 'public, max-age=900' }, // 15 min
    });
  } catch (error) {
    console.error('Error fetching drugs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drugs' },
      { status: 500 }
    );
  }
}
