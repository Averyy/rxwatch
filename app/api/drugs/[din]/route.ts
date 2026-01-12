import { NextResponse } from 'next/server';
import { db, drugs, reports } from '@/db';
import { eq, desc } from 'drizzle-orm';
import { getFromCache, setInCache } from '@/lib/api-cache';

const CACHE_NAMESPACE = 'drug-detail';

/**
 * GET /api/drugs/[din]
 * Returns drug details + its report history
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ din: string }> }
) {
  try {
    const { din } = await params;

    // Validate DIN format (8 digits)
    if (!/^\d{8}$/.test(din)) {
      return NextResponse.json(
        { error: 'Invalid DIN format. Must be 8 digits.' },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = getFromCache<{ drug: unknown; reports: unknown[]; reportCount: number }>(CACHE_NAMESPACE, din);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, max-age=900, stale-while-revalidate=60',
          'X-Cache': 'HIT',
        },
      });
    }

    // Get drug details
    const [drug] = await db
      .select()
      .from(drugs)
      .where(eq(drugs.din, din))
      .limit(1);

    if (!drug) {
      return NextResponse.json(
        { error: 'Drug not found', din },
        { status: 404 }
      );
    }

    // Get all reports for this drug
    const drugReports = await db
      .select({
        id: reports.id,
        reportId: reports.reportId,
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
      .where(eq(reports.din, din))
      .orderBy(desc(reports.apiUpdatedDate));

    const responseData = {
      drug,
      reports: drugReports,
      reportCount: drugReports.length,
    };

    // Store in cache
    setInCache(CACHE_NAMESPACE, din, responseData);

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=60',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Error fetching drug:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drug' },
      { status: 500 }
    );
  }
}
