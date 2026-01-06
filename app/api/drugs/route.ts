import { NextResponse } from 'next/server';
import { db, drugs } from '@/db';
import { asc, sql, type SQL } from 'drizzle-orm';

// Input validation constants
const MAX_PARAM_LENGTH = 100;
const ATC_PATTERN = /^[A-Z0-9]{1,7}$/i;

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
    const conditions: SQL[] = [];

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
      const safeCompany = company.slice(0, MAX_PARAM_LENGTH);
      conditions.push(sql`${drugs.company} ILIKE ${'%' + safeCompany + '%'}`);
    }

    if (atc) {
      const safeAtc = atc.slice(0, 7); // ATC codes are max 7 chars
      if (!ATC_PATTERN.test(safeAtc)) {
        return NextResponse.json(
          { error: 'Invalid ATC code format. Must be alphanumeric, max 7 characters.' },
          { status: 400 }
        );
      }
      conditions.push(sql`${drugs.atcCode} LIKE ${safeAtc + '%'}`);
    }

    if (ingredient) {
      const safeIngredient = ingredient.slice(0, MAX_PARAM_LENGTH);
      conditions.push(sql`${drugs.activeIngredient} ILIKE ${'%' + safeIngredient + '%'}`);
    }

    if (marketed === 'true') {
      conditions.push(sql`${drugs.marketStatus} = 'Marketed'`);
    }

    // Query drugs with filters
    // Only select fields needed for table display
    const result = await db
      .select({
        din: drugs.din,
        brandName: drugs.brandName,
        commonName: drugs.commonName,
        activeIngredient: drugs.activeIngredient,
        strength: drugs.strength,
        strengthUnit: drugs.strengthUnit,
        form: drugs.form,
        atcCode: drugs.atcCode,
        company: drugs.company,
        currentStatus: drugs.currentStatus,
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
    console.error('Error fetching drugs:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to fetch drugs' },
      { status: 500 }
    );
  }
}
