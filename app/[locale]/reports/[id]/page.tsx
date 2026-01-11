import { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { db, reports, drugs } from '@/db';
import { eq } from 'drizzle-orm';
import ReportDetailClient, { ReportData } from './ReportDetailClient';

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function toTitleCase(str: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ===========================================
// STATUS LABELS FOR METADATA
// ===========================================

const STATUS_LABELS: Record<string, string> = {
  active_confirmed: 'Active Shortage',
  anticipated_shortage: 'Anticipated Shortage',
  avoided_shortage: 'Avoided Shortage',
  resolved: 'Resolved',
  to_be_discontinued: 'To Be Discontinued',
  discontinued: 'Discontinued',
  reversed: 'Reversed',
};

const TYPE_LABELS: Record<string, string> = {
  shortage: 'Shortage',
  discontinuation: 'Discontinuation',
};

// ===========================================
// DATA FETCHING (cached to avoid duplicate queries)
// ===========================================

const getReportData = cache(async (id: string): Promise<ReportData | null> => {
  const reportId = parseInt(id);

  if (isNaN(reportId)) {
    return null;
  }

  // Get report details
  const [report] = await db
    .select()
    .from(reports)
    .where(eq(reports.reportId, reportId))
    .limit(1);

  if (!report) {
    return null;
  }

  // Get linked drug info if DIN exists
  let drug = null;
  if (report.din) {
    const [drugResult] = await db
      .select({
        din: drugs.din,
        drugCode: drugs.drugCode,
        brandName: drugs.brandName,
        commonName: drugs.commonName,
        activeIngredient: drugs.activeIngredient,
        strength: drugs.strength,
        strengthUnit: drugs.strengthUnit,
        form: drugs.form,
        route: drugs.route,
        atcCode: drugs.atcCode,
        atcLevel3: drugs.atcLevel3,
        company: drugs.company,
        currentStatus: drugs.currentStatus,
        hasReports: drugs.hasReports,
      })
      .from(drugs)
      .where(eq(drugs.din, report.din))
      .limit(1);
    drug = drugResult || null;
  }

  return {
    report: report as ReportData['report'],
    drug: drug as ReportData['drug'],
  };
});

// ===========================================
// METADATA GENERATION (SEO)
// ===========================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getReportData(id);

  if (!data) {
    return {
      title: `Report #${id} - Not Found | RxWatch Canada`,
      description: `Report #${id} not found in our database.`,
    };
  }

  const { report } = data;
  const name = report.commonName || report.brandName;
  const status = STATUS_LABELS[report.status] || report.status;
  const type = TYPE_LABELS[report.type] || report.type;

  // Build title
  const title = name
    ? `Report #${report.reportId} - ${toTitleCase(name)} ${type} (${status}) | RxWatch Canada`
    : `Report #${report.reportId} - ${type} (${status}) | RxWatch Canada`;

  // Build description
  let description = `${type} report for `;
  description += name ? toTitleCase(name) : `DIN ${report.din}`;
  if (report.drugStrength) {
    description += ` ${report.drugStrength}`;
  }
  description += `. Status: ${status}.`;
  if (report.company) {
    description += ` Reported by ${toTitleCase(report.company)}.`;
  }
  if (report.reasonEn) {
    description += ` Reason: ${report.reasonEn}`;
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
  };
}

// ===========================================
// PAGE COMPONENT
// ===========================================

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getReportData(id);

  // Return 404 for invalid/missing reports
  if (!data) {
    return notFound();
  }

  return <ReportDetailClient reportData={data} />;
}
