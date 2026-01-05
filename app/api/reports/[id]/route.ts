import { NextResponse } from 'next/server';
import { db, reports, drugs } from '@/db';
import { eq } from 'drizzle-orm';

/**
 * GET /api/reports/[id]
 * Returns report details by report ID (from DSC API)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reportId = parseInt(id);

    if (isNaN(reportId)) {
      return NextResponse.json(
        { error: 'Invalid report ID' },
        { status: 400 }
      );
    }

    // Get report details (exclude rawJson to reduce payload size)
    const [report] = await db
      .select({
        id: reports.id,
        reportId: reports.reportId,
        din: reports.din,
        brandName: reports.brandName,
        brandNameFr: reports.brandNameFr,
        commonName: reports.commonName,
        commonNameFr: reports.commonNameFr,
        ingredients: reports.ingredients,
        ingredientsFr: reports.ingredientsFr,
        drugStrength: reports.drugStrength,
        drugDosageForm: reports.drugDosageForm,
        drugDosageFormFr: reports.drugDosageFormFr,
        drugRoute: reports.drugRoute,
        drugRouteFr: reports.drugRouteFr,
        packagingSize: reports.packagingSize,
        type: reports.type,
        status: reports.status,
        reasonEn: reports.reasonEn,
        reasonFr: reports.reasonFr,
        atcCode: reports.atcCode,
        atcDescription: reports.atcDescription,
        anticipatedStartDate: reports.anticipatedStartDate,
        actualStartDate: reports.actualStartDate,
        estimatedEndDate: reports.estimatedEndDate,
        actualEndDate: reports.actualEndDate,
        anticipatedDiscontinuationDate: reports.anticipatedDiscontinuationDate,
        discontinuationDate: reports.discontinuationDate,
        company: reports.company,
        tier3: reports.tier3,
        lateSubmission: reports.lateSubmission,
        decisionReversal: reports.decisionReversal,
        apiCreatedDate: reports.apiCreatedDate,
        apiUpdatedDate: reports.apiUpdatedDate,
        createdAt: reports.createdAt,
        updatedAt: reports.updatedAt,
      })
      .from(reports)
      .where(eq(reports.reportId, reportId))
      .limit(1);

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found', reportId },
        { status: 404 }
      );
    }

    // Get linked drug info if DIN exists
    let drug = null;
    if (report.din) {
      const [drugResult] = await db
        .select({
          din: drugs.din,
          brandName: drugs.brandName,
          commonName: drugs.commonName,
          activeIngredient: drugs.activeIngredient,
          strength: drugs.strength,
          strengthUnit: drugs.strengthUnit,
          form: drugs.form,
          route: drugs.route,
          company: drugs.company,
          currentStatus: drugs.currentStatus,
          hasReports: drugs.hasReports,
        })
        .from(drugs)
        .where(eq(drugs.din, report.din))
        .limit(1);
      drug = drugResult || null;
    }

    return NextResponse.json({
      report,
      drug,
    }, {
      headers: { 'Cache-Control': 'public, max-age=900' }, // 15 min
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}
