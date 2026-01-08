import { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { db, drugs, reports } from '@/db';
import { eq, desc } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
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

  // Not found state
  if (!data) {
    return (
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" size="default" className="gap-2 mb-6" asChild>
          <Link href="/drugs">
            ← Back to all drugs
          </Link>
        </Button>

        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold">Drug Not Found</h2>
          <p className="text-muted-foreground text-center max-w-md">
            No drug found with DIN {din}. This may be an invalid DIN or the drug is not in our database.
          </p>
          <div className="flex gap-3">
            <Link href="/drugs">
              <Button variant="outline">Browse All Drugs</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <DrugDetailClient drugData={data} />;
}
