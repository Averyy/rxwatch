'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Building2,
  ShieldAlert,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';

// ===========================================
// TYPES
// ===========================================

export interface Drug {
  id: string;
  din: string;
  drugCode: number | null;
  brandName: string | null;
  brandNameFr: string | null;
  commonName: string | null;
  commonNameFr: string | null;
  activeIngredient: string | null;
  activeIngredientFr: string | null;
  strength: string | null;
  strengthUnit: string | null;
  numberOfAis: number | null;
  aiGroupNo: string | null;
  form: string | null;
  formFr: string | null;
  route: string | null;
  routeFr: string | null;
  atcCode: string | null;
  atcLevel3: string | null;
  atcLevel5: string | null;
  company: string | null;
  marketStatus: string | null;
  currentStatus: 'available' | 'in_shortage' | 'anticipated' | 'discontinued' | 'to_be_discontinued' | null;
  hasReports: boolean | null;
  dpdLastUpdated: string | null;
}

export interface Report {
  id: string;
  reportId: number;
  type: 'shortage' | 'discontinuation';
  status: string;
  reasonEn: string | null;
  company: string | null;
  tier3: boolean | null;
  lateSubmission: boolean | null;
  actualStartDate: string | null;
  anticipatedStartDate: string | null;
  estimatedEndDate: string | null;
  actualEndDate: string | null;
  discontinuationDate: string | null;
  anticipatedDiscontinuationDate: string | null;
  apiCreatedDate: string | null;
  apiUpdatedDate: string | null;
}

interface Alternative {
  din: string;
  brandName: string | null;
  activeIngredient: string | null;
  strength: string | null;
  strengthUnit: string | null;
  form: string | null;
  route: string | null;
  atcCode: string | null;
  company: string | null;
  currentStatus: string | null;
}

export interface DrugData {
  drug: Drug;
  reports: Report[];
  reportCount: number;
}

interface AlternativesData {
  sourceDrug: Alternative;
  alternatives: {
    sameIngredient: Alternative[];
    sameTherapeuticClass: Alternative[];
  };
  counts: {
    sameIngredient: number;
    sameTherapeuticClass: number;
    total: number;
  };
  disclaimer: string;
}

// ===========================================
// STATUS CONFIGURATION
// ===========================================

const DRUG_STATUS_CONFIG: Record<string, {
  label: string;
  description: string;
  className: string;
  bgClassName: string;
  icon: typeof AlertTriangle;
}> = {
  in_shortage: {
    label: 'In Shortage',
    description: 'This drug is currently in shortage',
    className: 'bg-red-500 text-white dark:bg-red-600',
    bgClassName: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/50',
    icon: AlertTriangle,
  },
  anticipated: {
    label: 'Anticipated Shortage',
    description: 'A shortage is expected for this drug',
    className: 'bg-yellow-500 text-white dark:bg-yellow-600',
    bgClassName: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800/50',
    icon: AlertTriangle,
  },
  to_be_discontinued: {
    label: 'To Be Discontinued',
    description: 'This drug will be permanently removed from market',
    className: 'bg-orange-500 text-white dark:bg-orange-600',
    bgClassName: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800/50',
    icon: AlertCircle,
  },
  discontinued: {
    label: 'Discontinued',
    description: 'This drug has been permanently removed from market',
    className: 'bg-gray-500 text-white dark:bg-gray-600',
    bgClassName: 'bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50',
    icon: AlertCircle,
  },
  available: {
    label: 'Available',
    description: 'No active shortage or discontinuation reports',
    className: 'bg-emerald-500 text-white dark:bg-emerald-600',
    bgClassName: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/50',
    icon: CheckCircle,
  },
};

const REPORT_STATUS_CONFIG: Record<string, { label: string; className: string; dotColor: string }> = {
  active_confirmed: {
    label: 'Active',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    dotColor: 'bg-red-500 border-red-500',
  },
  anticipated_shortage: {
    label: 'Anticipated',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    dotColor: 'bg-yellow-500 border-yellow-500',
  },
  avoided_shortage: {
    label: 'Avoided',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    dotColor: 'bg-emerald-500 border-emerald-500',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    dotColor: 'bg-background border-muted-foreground/30',
  },
  to_be_discontinued: {
    label: 'To Be Discontinued',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    dotColor: 'bg-orange-500 border-orange-500',
  },
  discontinued: {
    label: 'Discontinued',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    dotColor: 'bg-background border-muted-foreground/30',
  },
  reversed: {
    label: 'Reversed',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    dotColor: 'bg-emerald-500 border-emerald-500',
  },
};

const ALT_STATUS_CONFIG: Record<string, { label: string; className: string; dotColor: string }> = {
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
    day: 'numeric'
  });
}

export function toTitleCase(str: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getActiveReport(reports: Report[]): Report | null {
  const activeStatuses = ['active_confirmed', 'anticipated_shortage', 'to_be_discontinued'];
  return reports.find(r => activeStatuses.includes(r.status)) || null;
}

function calculateDuration(startDate: string | null, endDate: string | null): string {
  if (!startDate) return '';
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  if (isNaN(start.getTime())) return '';

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return 'Less than a day';
  if (diffDays === 1) return '1 day';
  if (diffDays < 30) return `${diffDays} days`;
  if (diffDays < 60) return '1 month';
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
  return `${Math.floor(diffDays / 365)} years`;
}

// ===========================================
// DRUG HEADER COMPONENT
// ===========================================

function DrugHeader({
  drug,
  activeReport,
}: {
  drug: Drug;
  activeReport: Report | null;
}) {
  const status = drug.currentStatus || 'available';
  const config = DRUG_STATUS_CONFIG[status] || DRUG_STATUS_CONFIG.available;
  const StatusIcon = config.icon;

  const displayName = drug.commonName || drug.brandName || `DIN ${drug.din}`;
  const strengthDisplay = drug.strength
    ? `${drug.strength}${drug.strengthUnit ? ` ${drug.strengthUnit}` : ''}`
    : null;
  const formDisplay = [drug.form, drug.route].filter(Boolean).join(' / ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-xl border-2 p-6 ${config.bgClassName}`}
    >
      {/* Top row: Drug name (left) and Status badge (right) */}
      <div className="flex items-start justify-between gap-4">
        {/* Drug Name - Top Left */}
        <div className="space-y-2 min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {toTitleCase(displayName)}
          </h1>
          {drug.brandName && drug.brandName !== drug.commonName && (
            <p className="text-sm text-muted-foreground font-medium">{drug.brandName}</p>
          )}
          {/* Tags row - DIN, strength, form, company all as subtle tags */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="font-mono bg-muted/80 text-muted-foreground px-2 py-1 rounded">
              DIN {drug.din}
            </span>
            {strengthDisplay && (
              <span className="bg-muted/80 text-muted-foreground px-2 py-1 rounded">
                {strengthDisplay}
              </span>
            )}
            {formDisplay && (
              <span className="bg-muted/80 text-muted-foreground px-2 py-1 rounded">
                {formDisplay}
              </span>
            )}
            {drug.company && (
              <span className="bg-muted/80 text-muted-foreground px-2 py-1 rounded flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {toTitleCase(drug.company)}
              </span>
            )}
          </div>
        </div>

        {/* Status Badge - Top Right */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${config.className}`}>
            <StatusIcon className="h-4 w-4" />
            {config.label}
          </span>
          {activeReport?.tier3 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-600 text-white">
              <ShieldAlert className="h-3.5 w-3.5" />
              Tier 3 Critical
            </span>
          )}
          {activeReport?.lateSubmission && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              Late Submission
            </span>
          )}
        </div>
      </div>

      {/* Active Report Details */}
      {activeReport && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          {/* Start Date */}
          <div className="rounded-lg bg-black/10 dark:bg-black/30 p-3.5 space-y-1.5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
              {activeReport.type === 'discontinuation'
                ? (activeReport.status === 'to_be_discontinued' ? 'Planned Discontinuation' : 'Discontinued')
                : activeReport.status === 'anticipated_shortage'
                  ? 'Expected Start'
                  : 'Started'}
            </p>
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {formatDate(
                activeReport.type === 'discontinuation'
                  ? (activeReport.discontinuationDate || activeReport.anticipatedDiscontinuationDate)
                  : (activeReport.actualStartDate || activeReport.anticipatedStartDate)
              ) || 'Not specified'}
            </p>
          </div>

          {/* Estimated End / Duration - only show for shortages */}
          {activeReport.type === 'shortage' && (() => {
            const startDateStr = activeReport.actualStartDate || activeReport.anticipatedStartDate;
            const startDate = startDateStr ? new Date(startDateStr) : null;
            const hasStarted = startDate && startDate <= new Date();

            // If there's an estimated end date, show it
            if (activeReport.estimatedEndDate) {
              return (
                <div className="rounded-lg bg-black/10 dark:bg-black/30 p-3.5 space-y-1.5">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                    Expected Resolution
                  </p>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatDate(activeReport.estimatedEndDate)}
                  </p>
                </div>
              );
            }

            // If shortage has started (start date is in the past), show duration
            if (hasStarted) {
              return (
                <div className="rounded-lg bg-black/10 dark:bg-black/30 p-3.5 space-y-1.5">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                    Duration
                  </p>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {calculateDuration(startDateStr, null)}
                  </p>
                </div>
              );
            }

            // For anticipated shortages without end date, show "Unknown"
            return (
              <div className="rounded-lg bg-black/10 dark:bg-black/30 p-3.5 space-y-1.5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                  Expected Resolution
                </p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Unknown
                </p>
              </div>
            );
          })()}

          {/* Reason */}
          {activeReport.reasonEn && (
            <div className="rounded-lg bg-black/10 dark:bg-black/30 p-3.5 space-y-1.5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Reason</p>
              <p className="text-sm font-medium">{activeReport.reasonEn}</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ===========================================
// TIMELINE EVENT TYPES & HELPERS
// ===========================================

interface TimelineEvent {
  id: string;
  date: Date;
  dateStr: string;
  type: 'shortage_started' | 'shortage_resolved' | 'shortage_anticipated' | 'avoided' | 'discontinued' | 'to_be_discontinued' | 'reversed';
  label: string;
  reason: string | null;
  reportId: number;
  tier3: boolean | null;
  lateSubmission: boolean | null;
  estimatedEndDate: string | null;
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; className: string; dotColor: string }> = {
  shortage_started: {
    label: 'Shortage Started',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    dotColor: 'bg-red-500 border-red-500',
  },
  shortage_resolved: {
    label: 'Shortage Resolved',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    dotColor: 'bg-emerald-500 border-emerald-500',
  },
  shortage_anticipated: {
    label: 'Anticipated Shortage',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    dotColor: 'bg-yellow-500 border-yellow-500',
  },
  avoided: {
    label: 'Shortage Avoided',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    dotColor: 'bg-emerald-500 border-emerald-500',
  },
  discontinued: {
    label: 'Discontinued',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    dotColor: 'bg-gray-500 border-gray-500',
  },
  to_be_discontinued: {
    label: 'To Be Discontinued',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    dotColor: 'bg-orange-500 border-orange-500',
  },
  reversed: {
    label: 'Reversal',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    dotColor: 'bg-emerald-500 border-emerald-500',
  },
};

function buildTimelineEvents(reports: Report[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const report of reports) {
    if (report.type === 'shortage') {
      const startDate = report.actualStartDate || report.anticipatedStartDate;
      const endDate = report.actualEndDate;

      if (report.status === 'anticipated_shortage') {
        // Use apiUpdatedDate as fallback if no start date
        const eventDate = startDate || report.apiUpdatedDate;
        if (eventDate) {
          events.push({
            id: `${report.reportId}-anticipated`,
            date: new Date(eventDate),
            dateStr: eventDate,
            type: 'shortage_anticipated',
            label: 'Anticipated Shortage',
            reason: report.reasonEn,
            reportId: report.reportId,
            tier3: report.tier3,
            lateSubmission: report.lateSubmission,
            estimatedEndDate: report.estimatedEndDate,
          });
        }
      } else if (report.status === 'active_confirmed') {
        // Use apiUpdatedDate as fallback if no start date
        const eventDate = startDate || report.apiUpdatedDate;
        if (eventDate) {
          events.push({
            id: `${report.reportId}-started`,
            date: new Date(eventDate),
            dateStr: eventDate,
            type: 'shortage_started',
            label: 'Shortage Started',
            reason: report.reasonEn,
            reportId: report.reportId,
            tier3: report.tier3,
            lateSubmission: report.lateSubmission,
            estimatedEndDate: report.estimatedEndDate,
          });
        }
      } else if (report.status === 'resolved') {
        // Use apiCreatedDate as fallback for start, apiUpdatedDate for end
        const startEventDate = startDate || report.apiCreatedDate;
        if (startEventDate) {
          events.push({
            id: `${report.reportId}-started`,
            date: new Date(startEventDate),
            dateStr: startEventDate,
            type: 'shortage_started',
            label: 'Shortage Started',
            reason: report.reasonEn,
            reportId: report.reportId,
            tier3: report.tier3,
            lateSubmission: report.lateSubmission,
            estimatedEndDate: null,
          });
        }
        // Use apiUpdatedDate as fallback for resolved date
        const endEventDate = endDate || report.apiUpdatedDate;
        if (endEventDate) {
          events.push({
            id: `${report.reportId}-resolved`,
            date: new Date(endEventDate),
            dateStr: endEventDate,
            type: 'shortage_resolved',
            label: 'Shortage Resolved',
            reason: null,
            reportId: report.reportId,
            tier3: report.tier3,
            lateSubmission: null,
            estimatedEndDate: null,
          });
        }
      } else if (report.status === 'avoided_shortage') {
        const avoidedDate = startDate || report.apiUpdatedDate;
        if (avoidedDate) {
          events.push({
            id: `${report.reportId}-avoided`,
            date: new Date(avoidedDate),
            dateStr: avoidedDate,
            type: 'avoided',
            label: 'Shortage Avoided',
            reason: report.reasonEn,
            reportId: report.reportId,
            tier3: report.tier3,
            lateSubmission: report.lateSubmission,
            estimatedEndDate: null,
          });
        }
      }
    } else {
      // Discontinuation reports
      const discDate = report.discontinuationDate || report.anticipatedDiscontinuationDate;
      // Use apiUpdatedDate as fallback if no discontinuation date is set
      const eventDate = discDate || report.apiUpdatedDate;

      if (report.status === 'to_be_discontinued' && eventDate) {
        events.push({
          id: `${report.reportId}-to_be_discontinued`,
          date: new Date(eventDate),
          dateStr: eventDate,
          type: 'to_be_discontinued',
          label: 'To Be Discontinued',
          reason: report.reasonEn,
          reportId: report.reportId,
          tier3: report.tier3,
          lateSubmission: report.lateSubmission,
          estimatedEndDate: null,
        });
      } else if (report.status === 'discontinued' && eventDate) {
        events.push({
          id: `${report.reportId}-discontinued`,
          date: new Date(eventDate),
          dateStr: eventDate,
          type: 'discontinued',
          label: 'Discontinued',
          reason: report.reasonEn,
          reportId: report.reportId,
          tier3: report.tier3,
          lateSubmission: report.lateSubmission,
          estimatedEndDate: null,
        });
      } else if (report.status === 'reversed') {
        const reversedDate = discDate || report.apiUpdatedDate;
        if (reversedDate) {
          events.push({
            id: `${report.reportId}-reversed`,
            date: new Date(reversedDate),
            dateStr: reversedDate,
            type: 'reversed',
            label: 'Discontinuation Reversed',
            reason: report.reasonEn,
            reportId: report.reportId,
            tier3: report.tier3,
            lateSubmission: report.lateSubmission,
            estimatedEndDate: null,
          });
        }
      }
    }
  }

  // Sort by date descending (newest first)
  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  return events;
}

// ===========================================
// REPORT TIMELINE COMPONENT (Event-based)
// ===========================================

function ReportTimeline({ reports }: { reports: Report[] }) {
  const [showAll, setShowAll] = useState(false);
  const events = buildTimelineEvents(reports);
  const displayEvents = showAll ? events : events.slice(0, 8);
  const hasMore = events.length > 8;

  if (reports.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="rounded-lg border bg-card p-6"
      >
        <div className="text-center py-4 text-muted-foreground">
          <CheckCircle className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
          <p className="font-medium">No shortage or discontinuation reports</p>
          <p className="text-sm mt-1">This drug has no reported issues in our database.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="space-y-3"
    >
      <h2 className="text-lg font-semibold">Timeline ({events.length} events)</h2>

      <div className="relative">
        {/* Timeline events */}
        <div className="flex flex-col gap-3">
          {displayEvents.map((event, index) => {
            const config = EVENT_TYPE_CONFIG[event.type] || EVENT_TYPE_CONFIG.shortage_started;
            const isFirst = index === 0;
            const isLast = index === displayEvents.length - 1;

            return (
              <div key={event.id} className="relative pl-6">
                {/* Line above - from gap to center (dot covers overlap) */}
                {!isFirst && (
                  <div className="absolute left-[7px] -top-3 h-[calc(50%+12px)] w-0.5 bg-neutral-200 dark:bg-neutral-800" />
                )}
                {/* Line below - from center through gap (dot covers overlap) */}
                {!isLast && (
                  <div className="absolute left-[7px] top-1/2 h-[calc(50%+12px)] w-0.5 bg-neutral-200 dark:bg-neutral-800" />
                )}

                {/* Timeline dot - vertically centered, covers line overlap */}
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[15px] h-[15px] rounded-full border-2 z-10 ${config.dotColor}`} />

                {/* Event content */}
                <Link
                  href={`/reports/${event.reportId}`}
                  className="block p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Event type tag first */}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
                          {config.label}
                        </span>
                        {/* Date */}
                        <span className="text-sm font-medium">
                          {formatDate(event.dateStr)}
                        </span>
                        {event.tier3 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            <ShieldAlert className="h-2.5 w-2.5" />
                            Tier 3
                          </span>
                        )}
                        {event.lateSubmission && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            Late
                          </span>
                        )}
                      </div>

                      {event.reason && (
                        <p className="text-xs text-muted-foreground truncate">
                          {event.reason}
                        </p>
                      )}

                      {event.estimatedEndDate && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 leading-none">
                          <Clock className="h-3 w-3 shrink-0 -mt-px" />
                          <span>Est. resolution {formatDate(event.estimatedEndDate)}</span>
                        </p>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1.5 shrink-0 text-xs leading-none text-muted-foreground">
                      <span>#{event.reportId}</span>
                      <ExternalLink className="h-3 w-3 -mt-px" />
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {hasMore && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <>
              <ChevronUp className="h-4 w-4 mr-2" />
              Show fewer
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-2" />
              Show all {events.length} events
            </>
          )}
        </Button>
      )}
    </motion.div>
  );
}

// ===========================================
// DRUG DETAILS COMPONENT
// ===========================================

function DrugDetails({ drug }: { drug: Drug }) {
  const details = [
    { section: 'Basic Information' },
    { label: 'DIN', value: drug.din, mono: true },
    { label: 'Drug Code', value: drug.drugCode?.toString() },
    { label: 'Brand Name', value: drug.brandName },
    { label: 'Common Name', value: toTitleCase(drug.commonName) },
    { label: 'Company', value: toTitleCase(drug.company) },
    { label: 'Market Status', value: drug.marketStatus },
    { section: 'Composition' },
    { label: 'Active Ingredient', value: toTitleCase(drug.activeIngredient) },
    { label: 'Strength', value: drug.strength && drug.strengthUnit ? `${drug.strength} ${drug.strengthUnit}` : drug.strength },
    { label: 'Number of Ingredients', value: drug.numberOfAis?.toString() },
    { label: 'Form', value: drug.form },
    { label: 'Route', value: drug.route },
    { section: 'Classification' },
    { label: 'ATC Code', value: drug.atcCode, mono: true },
    { label: 'ATC Class (Level 3)', value: drug.atcLevel3 },
    { label: 'ATC Class (Level 5)', value: drug.atcLevel5 },
    { label: 'AI Group Number', value: drug.aiGroupNo, mono: true },
    { label: 'DPD Last Updated', value: formatDate(drug.dpdLastUpdated) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.25 }}
      className="space-y-4"
    >
      <h2 className="text-lg font-semibold">Drug Details</h2>
      <Card className="py-0 gap-0">
        <CardContent className="p-6">
          <div className="space-y-4">
            {details.map((item, idx) => {
              if ('section' in item) {
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.3 + idx * 0.02 }}
                    className="pt-4 first:pt-0 pb-2 border-b border-border/50"
                  >
                    <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest">
                      {item.section}
                    </span>
                  </motion.div>
                );
              }
              if (!item.value) return null;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: 0.3 + idx * 0.02 }}
                  className="flex justify-between items-baseline"
                >
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className={`text-sm font-medium text-right max-w-[60%] ${item.mono ? 'font-mono' : ''}`}>
                    {item.value}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===========================================
// ALTERNATIVES COMPONENT
// ===========================================

function AlternativesList({
  alternatives,
  sourceDrug,
  defaultExpanded = true,
}: {
  alternatives: AlternativesData | null;
  sourceDrug: Drug;
  defaultExpanded?: boolean;
}) {
  const [showSameIngredient, setShowSameIngredient] = useState(defaultExpanded);
  const [showAllSameIngredient, setShowAllSameIngredient] = useState(false);
  const [showTherapeutic, setShowTherapeutic] = useState(false);
  const [showAllTherapeutic, setShowAllTherapeutic] = useState(false);

  if (!alternatives) {
    return null;
  }

  const { sameIngredient, sameTherapeuticClass } = alternatives.alternatives;
  const hasAlternatives = sameIngredient.length > 0 || sameTherapeuticClass.length > 0;

  if (!hasAlternatives) {
    return null;
  }

  const visibleSameIngredient = showAllSameIngredient ? sameIngredient : sameIngredient.slice(0, 10);
  const visibleTherapeutic = showAllTherapeutic ? sameTherapeuticClass : sameTherapeuticClass.slice(0, 10);

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.15 }}
    >
      <h2 className="text-lg font-semibold">Possible Alternatives ({alternatives.counts.total})</h2>

      {/* Same Ingredient */}
      {sameIngredient.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="py-0 gap-0">
            <button
              type="button"
              className="w-full text-left px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl flex items-center justify-between"
              onClick={() => setShowSameIngredient(!showSameIngredient)}
            >
              <div>
                <div className="text-base font-medium">
                  Same Ingredient ({sameIngredient.length})
                </div>
                <div className="text-sm text-muted-foreground">
                  Generic equivalents containing {toTitleCase(sourceDrug.activeIngredient)}
                </div>
              </div>
              <motion.div
                animate={{ rotate: showSameIngredient ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </motion.div>
            </button>
            <AnimatePresence>
              {showSameIngredient && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardContent className="px-6 pt-0 pb-4">
                    <div className="grid gap-2">
                      {/* Disclaimer */}
                      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-200/50 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-950/20">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="text-xs leading-none text-amber-700 dark:text-amber-300">
                          Always consult a pharmacist or healthcare provider before substituting medications.
                        </span>
                      </div>
                      {visibleSameIngredient.map((alt, idx) => (
                        <motion.div
                          key={alt.din}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                        >
                          <AlternativeCard alternative={alt} />
                        </motion.div>
                      ))}
                      {sameIngredient.length > 10 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAllSameIngredient(!showAllSameIngredient);
                          }}
                        >
                          {showAllSameIngredient ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-1" />
                              Show fewer
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-1" />
                              Show all {sameIngredient.length} alternatives
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      )}

      {/* Same Therapeutic Class */}
      {sameTherapeuticClass.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="py-0 gap-0">
            <button
              type="button"
              className="w-full text-left px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl flex items-center justify-between"
              onClick={() => setShowTherapeutic(!showTherapeutic)}
            >
              <div>
                <div className="text-base font-medium">
                  Same Therapeutic Class ({sameTherapeuticClass.length})
                </div>
                <div className="text-sm text-muted-foreground">
                  Different ingredients, same drug class (ATC: {sourceDrug.atcCode?.slice(0, 5)})
                </div>
              </div>
              <motion.div
                animate={{ rotate: showTherapeutic ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </motion.div>
            </button>
            <AnimatePresence>
              {showTherapeutic && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardContent className="px-6 pt-0 pb-4">
                    <div className="grid gap-2">
                      {/* Disclaimer */}
                      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-200/50 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-950/20">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="text-xs leading-none text-amber-700 dark:text-amber-300">
                          Always consult a pharmacist or healthcare provider before substituting medications.
                        </span>
                      </div>
                      {visibleTherapeutic.map((alt, idx) => (
                        <motion.div
                          key={alt.din}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                        >
                          <AlternativeCard alternative={alt} showIngredient />
                        </motion.div>
                      ))}
                      {sameTherapeuticClass.length > 10 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAllTherapeutic(!showAllTherapeutic);
                          }}
                        >
                          {showAllTherapeutic ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-1" />
                              Show fewer
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-1" />
                              Show all {sameTherapeuticClass.length} alternatives
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

function AlternativeCard({
  alternative,
  showIngredient = false
}: {
  alternative: Alternative;
  showIngredient?: boolean;
}) {
  const status = alternative.currentStatus || 'available';
  const statusConfig = ALT_STATUS_CONFIG[status] || ALT_STATUS_CONFIG.available;
  const isMuted = status === 'discontinued';

  return (
    <Link
      href={`/drugs/${alternative.din}`}
      className={`flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group ${isMuted ? 'opacity-60' : ''}`}
    >
      <div className="space-y-0.5 min-w-0 flex-1">
        <p className={`font-medium text-sm transition-colors ${isMuted ? 'text-muted-foreground' : 'group-hover:text-primary'}`}>
          {alternative.brandName || `DIN ${alternative.din}`}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{alternative.din}</span>
          <span>•</span>
          {showIngredient && alternative.activeIngredient && (
            <>
              <span>{toTitleCase(alternative.activeIngredient)}</span>
              <span>•</span>
            </>
          )}
          <span>{alternative.strength}{alternative.strengthUnit}</span>
          {alternative.form && (
            <>
              <span>•</span>
              <span>{alternative.form}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`flex items-center gap-1.5 text-xs font-medium ${statusConfig.className}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
          {statusConfig.label}
        </span>
      </div>
    </Link>
  );
}

// ===========================================
// MAIN CLIENT COMPONENT
// ===========================================

export default function DrugDetailClient({
  drugData,
}: {
  drugData: DrugData;
}) {
  const [alternatives, setAlternatives] = useState<AlternativesData | null>(null);

  const { drug, reports } = drugData;
  const activeReport = getActiveReport(reports);

  // Fetch alternatives client-side (less critical for SEO)
  useEffect(() => {
    async function fetchAlternatives() {
      try {
        const res = await fetch(`/api/drugs/${drug.din}/alternatives`);
        if (res.ok) {
          const data = await res.json();
          setAlternatives(data);
        }
      } catch (err) {
        console.error('Failed to fetch alternatives:', err);
      }
    }
    fetchAlternatives();
  }, [drug.din]);

  // Determine if alternatives should be expanded by default
  const alternativesExpanded = drug.currentStatus !== 'available';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="default" className="gap-2" asChild>
        <Link href="/drugs">
          <ArrowLeft className="h-4 w-4" />
          Back to all drugs
        </Link>
      </Button>

      {/* Drug Header - Name top left, Status top right */}
      <DrugHeader drug={drug} activeReport={activeReport} />

      {/* Report History - Primary content */}
      <ReportTimeline reports={reports} />

      {/* Alternatives - collapsed by default for available drugs */}
      <AlternativesList
        alternatives={alternatives}
        sourceDrug={drug}
        defaultExpanded={alternativesExpanded}
      />

      {/* Drug Details - Collapsible */}
      <DrugDetails drug={drug} />

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
