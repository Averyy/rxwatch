'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  ShieldAlert,
  AlertCircle,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// ===========================================
// TYPES
// ===========================================

export interface Report {
  id: string;
  reportId: number;
  din: string | null;
  brandName: string | null;
  brandNameFr: string | null;
  commonName: string | null;
  commonNameFr: string | null;
  ingredients: string | null;
  ingredientsFr: string | null;
  drugStrength: string | null;
  drugDosageForm: string | null;
  drugDosageFormFr: string | null;
  drugRoute: string | null;
  drugRouteFr: string | null;
  packagingSize: string | null;
  type: 'shortage' | 'discontinuation';
  status: string;
  reasonEn: string | null;
  reasonFr: string | null;
  atcCode: string | null;
  atcDescription: string | null;
  anticipatedStartDate: string | null;
  actualStartDate: string | null;
  estimatedEndDate: string | null;
  actualEndDate: string | null;
  anticipatedDiscontinuationDate: string | null;
  discontinuationDate: string | null;
  company: string | null;
  tier3: boolean | null;
  lateSubmission: boolean | null;
  decisionReversal: boolean | null;
  apiCreatedDate: string | null;
  apiUpdatedDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  rawJson: unknown;
}

export interface Drug {
  din: string;
  drugCode: number | null;
  brandName: string | null;
  commonName: string | null;
  activeIngredient: string | null;
  strength: string | null;
  strengthUnit: string | null;
  form: string | null;
  route: string | null;
  atcCode: string | null;
  atcLevel3: string | null;
  company: string | null;
  currentStatus: string | null;
  hasReports: boolean | null;
}

export interface ReportData {
  report: Report;
  drug: Drug | null;
}

// ===========================================
// STATUS CONFIGURATION (matches reports page)
// ===========================================

const REPORT_STATUS_CONFIG: Record<string, {
  label: string;
  description: string;
  className: string;
  bgClassName: string;
  icon: typeof AlertTriangle;
}> = {
  active_confirmed: {
    label: 'Active Shortage',
    description: 'This drug is currently in shortage',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    bgClassName: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/50',
    icon: AlertTriangle,
  },
  anticipated_shortage: {
    label: 'Anticipated Shortage',
    description: 'A shortage is expected for this drug',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    bgClassName: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800/50',
    icon: Clock,
  },
  avoided_shortage: {
    label: 'Avoided',
    description: 'This shortage was anticipated but did not occur',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    bgClassName: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/50',
    icon: CheckCircle,
  },
  resolved: {
    label: 'Resolved',
    description: 'This shortage has been resolved',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    bgClassName: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800/50',
    icon: CheckCircle,
  },
  to_be_discontinued: {
    label: 'To Be Discontinued',
    description: 'This drug will be permanently removed from market',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    bgClassName: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800/50',
    icon: AlertCircle,
  },
  discontinued: {
    label: 'Discontinued',
    description: 'This drug has been permanently removed from market',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    bgClassName: 'bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50',
    icon: AlertCircle,
  },
  reversed: {
    label: 'Reversed',
    description: 'The discontinuation decision was reversed',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    bgClassName: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800/50',
    icon: CheckCircle,
  },
};

const DRUG_STATUS_CONFIG: Record<string, { label: string; className: string; dotColor: string }> = {
  available: {
    label: 'Available',
    className: 'text-emerald-700 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
  },
  in_shortage: {
    label: 'In Shortage',
    className: 'text-red-700 dark:text-red-400',
    dotColor: 'bg-red-500',
  },
  anticipated: {
    label: 'Anticipated',
    className: 'text-yellow-700 dark:text-yellow-400',
    dotColor: 'bg-yellow-500',
  },
  to_be_discontinued: {
    label: 'To Be Disc.',
    className: 'text-orange-700 dark:text-orange-400',
    dotColor: 'bg-orange-500',
  },
  discontinued: {
    label: 'Discontinued',
    className: 'text-gray-600 dark:text-gray-400',
    dotColor: 'bg-gray-400',
  },
};

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  // Use explicit format to avoid hydration mismatch between server/client
  const datePart = date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${datePart} at ${hour12}:${minutes} ${ampm}`;
}

function toTitleCase(str: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Clean up multi-line strings from API (e.g., "ORAL\r\nORAL" -> "ORAL")
function cleanMultiLine(str: string | null): string {
  if (!str) return '';
  const lines = str.split(/[\r\n]+/).filter(Boolean);
  // Remove duplicates and join
  return [...new Set(lines)].join(', ');
}

// ===========================================
// REPORT HEADER COMPONENT
// ===========================================

function ReportHeader({ report }: { report: Report }) {
  const config = REPORT_STATUS_CONFIG[report.status] || REPORT_STATUS_CONFIG.resolved;
  const StatusIcon = config.icon;

  const displayName = report.commonName || report.brandName || `DIN ${report.din}`;
  const typeLabel = report.type === 'shortage' ? 'Shortage Report' : 'Discontinuation Report';

  // Determine key dates based on report type
  const getKeyDates = () => {
    if (report.type === 'shortage') {
      const startDate = report.actualStartDate || report.anticipatedStartDate;
      const isResolved = report.status === 'resolved';
      const isAvoided = report.status === 'avoided_shortage';

      // Use status as source of truth for labels, not just date existence
      let endLabel: string;
      let endDate: string | null;

      if (isResolved) {
        endLabel = 'RESOLVED';
        endDate = report.actualEndDate || report.estimatedEndDate;
      } else if (isAvoided) {
        endLabel = 'AVOIDED';
        endDate = report.actualEndDate || report.apiUpdatedDate;
      } else {
        endLabel = 'EXPECTED RESOLUTION';
        endDate = report.estimatedEndDate;
      }

      return {
        startLabel: report.actualStartDate ? 'STARTED' : 'EXPECTED START',
        startDate: startDate,
        endLabel,
        endDate,
      };
    } else {
      // Discontinuation
      const discDate = report.discontinuationDate || report.anticipatedDiscontinuationDate;
      const isCompleted = report.status === 'discontinued';

      return {
        startLabel: isCompleted ? 'DISCONTINUED' : 'PLANNED DISCONTINUATION',
        startDate: discDate,
        endLabel: null,
        endDate: null,
      };
    }
  };

  const dates = getKeyDates();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-xl border-2 p-6 ${config.bgClassName}`}
    >
      {/* Top row: Drug name and type (left) and Status badge (right) */}
      <div className="flex items-start justify-between gap-4">
        {/* Drug Name - Top Left */}
        <div className="space-y-2 min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {typeLabel} #{report.reportId}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {toTitleCase(displayName)}
          </h1>
          {report.brandName && report.brandName !== report.commonName && (
            <p className="text-sm text-muted-foreground font-medium">{report.brandName}</p>
          )}
        </div>

        {/* Status Badge - Top Right */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${config.className}`}>
            <StatusIcon className="h-4 w-4 shrink-0" />
            {config.label}
          </span>
          {report.tier3 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-600 text-white">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              Tier 3 Critical
            </span>
          )}
          {report.lateSubmission && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              Late Submission
            </span>
          )}
          {report.decisionReversal && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Decision Reversed
            </span>
          )}
        </div>
      </div>

      {/* Key Dates Row - More prominent */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
        {/* Start/Discontinuation Date */}
        {dates.startDate && (
          <div className="rounded-lg bg-black/10 dark:bg-black/30 p-3.5 space-y-1.5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
              {dates.startLabel}
            </p>
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {formatDate(dates.startDate)}
            </p>
          </div>
        )}

        {/* End Date (shortage only) */}
        {dates.endDate && (
          <div className="rounded-lg bg-black/10 dark:bg-black/30 p-3.5 space-y-1.5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
              {dates.endLabel}
            </p>
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {formatDate(dates.endDate)}
            </p>
          </div>
        )}

        {/* Last Updated */}
        <div className="rounded-lg bg-black/10 dark:bg-black/30 p-3.5 space-y-1.5">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
            Last Updated
          </p>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {formatDate(report.apiUpdatedDate)}
          </p>
        </div>

        {/* Report Created */}
        <div className="rounded-lg bg-black/10 dark:bg-black/30 p-3.5 space-y-1.5">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
            Report Created
          </p>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {formatDate(report.apiCreatedDate)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ===========================================
// LINKED DRUG CARD COMPONENT
// ===========================================

function LinkedDrugCard({ drug }: { drug: Drug }) {
  const status = drug.currentStatus || 'available';
  const statusConfig = DRUG_STATUS_CONFIG[status] || DRUG_STATUS_CONFIG.available;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Drug Information</h2>
          <p className="text-sm text-muted-foreground">
            To learn more about the specific drug that is impacted and view possible alternatives, click below.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href={`/drugs/${drug.din}#alternatives`}>
            View alternatives
          </Link>
        </Button>
      </div>

      <Link
        href={`/drugs/${drug.din}`}
        className="block p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="font-medium text-base group-hover:text-primary transition-colors">
              {toTitleCase(drug.commonName || drug.brandName)}
            </p>
            {drug.brandName && drug.brandName !== drug.commonName && (
              <p className="text-sm text-muted-foreground">{drug.brandName}</p>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
              <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded">DIN {drug.din}</span>
              {drug.strength && (
                <span className="bg-muted/60 px-1.5 py-0.5 rounded">{drug.strength}{drug.strengthUnit}</span>
              )}
              {drug.form && (
                <span className="bg-muted/60 px-1.5 py-0.5 rounded">{drug.form}</span>
              )}
              {drug.company && (
                <span className="bg-muted/60 px-1.5 py-0.5 rounded">{toTitleCase(drug.company)}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className={`flex items-center gap-1.5 text-xs font-medium ${statusConfig.className}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusConfig.dotColor}`} />
              {statusConfig.label}
            </span>
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ===========================================
// REPORT DETAILS COMPONENT
// ===========================================

function ReportDetails({ report }: { report: Report }) {
  const details = [
    { section: 'Report Information' },
    { label: 'Report ID', value: `#${report.reportId}`, mono: true },
    { label: 'Report Type', value: report.type === 'shortage' ? 'Shortage' : 'Discontinuation' },
    { label: 'Status', value: REPORT_STATUS_CONFIG[report.status]?.label || report.status },
    { label: 'Company', value: toTitleCase(report.company) },
    { label: 'Tier 3 Critical', value: report.tier3 ? 'Yes' : 'No' },
    { label: 'Late Submission', value: report.lateSubmission ? 'Yes' : 'No' },
    { label: 'Decision Reversal', value: report.decisionReversal ? 'Yes' : 'No' },

    { section: 'Drug Details (at time of report)' },
    { label: 'DIN', value: report.din, mono: true },
    { label: 'Brand Name', value: report.brandName },
    { label: 'Common Name', value: toTitleCase(report.commonName) },
    { label: 'Active Ingredients', value: report.ingredients },
    { label: 'Strength', value: report.drugStrength },
    { label: 'Dosage Form', value: cleanMultiLine(report.drugDosageForm) },
    { label: 'Route', value: cleanMultiLine(report.drugRoute) },
    { label: 'Packaging Size', value: report.packagingSize },

    { section: 'Classification' },
    { label: 'ATC Code', value: report.atcCode, mono: true },
    { label: 'ATC Description', value: report.atcDescription },

    { section: 'Dates' },
    ...(report.type === 'shortage' ? [
      { label: 'Anticipated Start', value: formatDate(report.anticipatedStartDate) },
      { label: 'Actual Start', value: formatDate(report.actualStartDate) },
      { label: 'Estimated End', value: formatDate(report.estimatedEndDate) },
      { label: 'Actual End', value: formatDate(report.actualEndDate) },
    ] : [
      { label: 'Anticipated Discontinuation', value: formatDate(report.anticipatedDiscontinuationDate) },
      { label: 'Discontinuation Date', value: formatDate(report.discontinuationDate) },
    ]),

    { section: 'Reason' },
    { label: 'Reason (English)', value: report.reasonEn },
    { label: 'Reason (French)', value: report.reasonFr },

    { section: 'Timestamps' },
    { label: 'Report Created', value: formatDateTime(report.apiCreatedDate) },
    { label: 'Last Updated', value: formatDateTime(report.apiUpdatedDate) },
  ];

  let rowIndex = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="space-y-4"
    >
      <h2 className="text-lg font-semibold">Report Details</h2>
      <Card className="py-0 gap-0 overflow-hidden">
        <CardContent className="p-0">
          <div>
            {details.map((item, idx) => {
              if ('section' in item && item.section) {
                rowIndex = 0; // Reset row index for each section
                return (
                  <div
                    key={idx}
                    className="px-6 py-3 border-b border-border/50 bg-muted/30"
                  >
                    <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest">
                      {item.section}
                    </span>
                  </div>
                );
              }
              if (!item.value) return null;
              const isEven = rowIndex % 2 === 0;
              rowIndex++;
              return (
                <div
                  key={idx}
                  className={`flex justify-between items-baseline gap-4 px-6 py-2.5 ${isEven ? 'bg-muted/20' : ''}`}
                >
                  <span className="text-sm text-muted-foreground shrink-0">{item.label}</span>
                  <span className={`text-sm font-medium text-right max-w-[60%] ${'mono' in item && item.mono ? 'font-mono' : ''}`}>
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===========================================
// EXTERNAL LINK COMPONENT
// ===========================================

function ExternalReportLink({ report }: { report: Report }) {
  const baseUrl = report.type === 'shortage'
    ? 'https://www.drugshortagescanada.ca/shortage'
    : 'https://www.drugshortagescanada.ca/discontinuance';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
    >
      <a
        href={`${baseUrl}/${report.reportId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
        View on Drug Shortages Canada
      </a>
    </motion.div>
  );
}

// ===========================================
// MAIN CLIENT COMPONENT
// ===========================================

export default function ReportDetailClient({
  reportData,
}: {
  reportData: ReportData;
}) {
  const { report, drug } = reportData;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="default" className="gap-2" asChild>
        <Link href="/reports">
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Back to all reports
        </Link>
      </Button>

      {/* Report Header */}
      <ReportHeader report={report} />

      {/* Linked Drug Card */}
      {drug && <LinkedDrugCard drug={drug} />}

      {/* Report Details */}
      <ReportDetails report={report} />

      {/* External Link */}
      <ExternalReportLink report={report} />

      {/* Footer Disclaimer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="text-xs text-muted-foreground text-center py-10"
      >
        <p>
          Data from Drug Shortages Canada and Health Canada Drug Product Database.
        </p>
        <p className="mt-1">
          <strong>This is not medical advice.</strong> Always consult your pharmacist or doctor before making changes to your medication.
        </p>
      </motion.div>
    </div>
  );
}
