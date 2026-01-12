import { NextResponse } from 'next/server';
import { db, drugs, reports } from '@/db';
import { sql, or, eq, ilike } from 'drizzle-orm';

/**
 * GET /api/search?q=metformin
 * Global search across drugs and reports
 *
 * Uses pg_trgm for fuzzy matching on drug names
 * Returns exact DIN matches first, then fuzzy matches
 */
// Input validation constants
const MAX_QUERY_LENGTH = 200;
const MAX_LIMIT = 100;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim()?.slice(0, MAX_QUERY_LENGTH);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20') || 20, 1), MAX_LIMIT);

    if (!query || query.length < 2) {
      return NextResponse.json({
        drugs: [],
        reports: [],
        message: 'Query must be 2-200 characters',
      });
    }

    // Check if query looks like a DIN (all digits)
    const isFullDIN = /^\d{8}$/.test(query);
    const isPartialDIN = /^\d{2,7}$/.test(query);

    // Search drugs
    let drugResults;
    if (isFullDIN) {
      // Exact DIN match
      drugResults = await db
        .select({
          din: drugs.din,
          brandName: drugs.brandName,
          commonName: drugs.commonName,
          activeIngredient: drugs.activeIngredient,
          strength: drugs.strength,
          strengthUnit: drugs.strengthUnit,
          form: drugs.form,
          company: drugs.company,
          currentStatus: drugs.currentStatus,
          hasReports: drugs.hasReports,
        })
        .from(drugs)
        .where(eq(drugs.din, query))
        .limit(1);
    } else if (isPartialDIN) {
      // Partial DIN match - search DINs starting with the query
      drugResults = await db.execute(sql`
        SELECT
          din,
          brand_name as "brandName",
          common_name as "commonName",
          active_ingredient as "activeIngredient",
          strength,
          strength_unit as "strengthUnit",
          form,
          company,
          current_status as "currentStatus",
          has_reports as "hasReports"
        FROM drugs
        WHERE din LIKE ${query} || '%'
        ORDER BY has_reports DESC, din ASC
        LIMIT ${limit}
      `);
    } else {
      // Fuzzy search using pg_trgm
      // Lower similarity threshold for better matches on compound names
      drugResults = await db.execute(sql`
        SELECT
          din,
          brand_name as "brandName",
          common_name as "commonName",
          active_ingredient as "activeIngredient",
          strength,
          strength_unit as "strengthUnit",
          form,
          company,
          current_status as "currentStatus",
          has_reports as "hasReports",
          GREATEST(
            similarity(brand_name, ${query}),
            similarity(common_name, ${query}),
            similarity(active_ingredient, ${query})
          ) as sim
        FROM drugs
        WHERE
          brand_name % ${query}
          OR common_name % ${query}
          OR active_ingredient % ${query}
          OR brand_name ILIKE '%' || ${query} || '%'
          OR common_name ILIKE '%' || ${query} || '%'
          OR active_ingredient ILIKE '%' || ${query} || '%'
        ORDER BY sim DESC, has_reports DESC
        LIMIT ${limit}
      `);
    }

    // Search reports by report ID, DIN, or text
    let reportResults: {
      reportId: number;
      din: string | null;
      brandName: string | null;
      type: 'shortage' | 'discontinuation';
      status: string;
      company: string | null;
      apiUpdatedDate: Date | null;
    }[] = [];

    if (/^\d+$/.test(query)) {
      // Numeric query - search by report ID or DIN
      reportResults = await db
        .select({
          reportId: reports.reportId,
          din: reports.din,
          brandName: reports.brandName,
          type: reports.type,
          status: reports.status,
          company: reports.company,
          apiUpdatedDate: reports.apiUpdatedDate,
        })
        .from(reports)
        .where(
          or(
            eq(reports.reportId, parseInt(query)),
            eq(reports.din, query)
          )
        )
        .limit(limit);
    } else {
      // Text query - search by brand name, common name, or company
      reportResults = await db
        .select({
          reportId: reports.reportId,
          din: reports.din,
          brandName: reports.brandName,
          type: reports.type,
          status: reports.status,
          company: reports.company,
          apiUpdatedDate: reports.apiUpdatedDate,
        })
        .from(reports)
        .where(
          or(
            ilike(reports.brandName, `%${query}%`),
            ilike(reports.commonName, `%${query}%`),
            ilike(reports.company, `%${query}%`)
          )
        )
        .orderBy(sql`${reports.apiUpdatedDate} DESC`)
        .limit(limit);
    }

    return NextResponse.json({
      drugs: isFullDIN ? drugResults : (drugResults as any[]),
      reports: reportResults,
      query,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
