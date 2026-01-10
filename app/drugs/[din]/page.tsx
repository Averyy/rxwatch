import { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { db, drugs, reports } from '@/db';
import { eq, desc } from 'drizzle-orm';
import DrugDetailClient, { DrugData } from './DrugDetailClient';

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
  in_shortage: 'In Shortage',
  anticipated: 'Anticipated Shortage',
  to_be_discontinued: 'To Be Discontinued',
  discontinued: 'Discontinued',
  available: 'Available',
};

// ===========================================
// DATA FETCHING (cached to avoid duplicate queries)
// ===========================================

const getDrugData = cache(async (din: string): Promise<DrugData | null> => {
  // Validate DIN format (8 digits)
  if (!/^\d{8}$/.test(din)) {
    return null;
  }

  // Get drug details
  const [drug] = await db
    .select()
    .from(drugs)
    .where(eq(drugs.din, din))
    .limit(1);

  if (!drug) {
    return null;
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
      anticipatedStartDate: reports.anticipatedStartDate,
      estimatedEndDate: reports.estimatedEndDate,
      actualEndDate: reports.actualEndDate,
      discontinuationDate: reports.discontinuationDate,
      anticipatedDiscontinuationDate: reports.anticipatedDiscontinuationDate,
      apiCreatedDate: reports.apiCreatedDate,
      apiUpdatedDate: reports.apiUpdatedDate,
    })
    .from(reports)
    .where(eq(reports.din, din))
    .orderBy(desc(reports.apiUpdatedDate));

  return {
    drug: drug as DrugData['drug'],
    reports: drugReports as DrugData['reports'],
    reportCount: drugReports.length,
  };
});

// ===========================================
// METADATA GENERATION (SEO)
// ===========================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ din: string }>;
}): Promise<Metadata> {
  const { din } = await params;
  const data = await getDrugData(din);

  if (!data) {
    return {
      title: `DIN ${din} - Not Found | RxWatch Canada`,
      description: `Drug with DIN ${din} not found in our database.`,
    };
  }

  const { drug } = data;
  const name = drug.commonName || drug.brandName;
  const status = STATUS_LABELS[drug.currentStatus || 'available'] || 'Available';

  // Build title - DIN first so it's not truncated for long drug names
  const title = name
    ? `DIN ${drug.din} (${status}) - ${toTitleCase(name)} | RxWatch Canada`
    : `DIN ${drug.din} - ${status} | RxWatch Canada`;

  // Build description
  let description = name ? toTitleCase(name) : `DIN ${drug.din}`;
  if (drug.strength) {
    description += ` ${drug.strength}${drug.strengthUnit || ''}`;
  }
  if (drug.form) {
    description += ` ${drug.form}`;
  }
  description += ` - Status: ${status}.`;
  if (drug.company) {
    description += ` Manufactured by ${toTitleCase(drug.company)}.`;
  }
  description += ` Check shortage status, alternatives, and report history on RxWatch Canada.`;

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

export default async function DrugDetailPage({
  params,
}: {
  params: Promise<{ din: string }>;
}) {
  const { din } = await params;
  const data = await getDrugData(din);

  // Return 404 for invalid/missing drugs
  if (!data) {
    return notFound();
  }

  return <DrugDetailClient drugData={data} />;
}
