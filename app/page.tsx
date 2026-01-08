'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, TrendingDown, CheckCircle, ArrowRight, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DrugSearch } from '@/components/drug-search';

// Skeleton loading component for homepage
function HomeSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero skeleton */}
      <div className="space-y-6 py-6">
        <div className="space-y-3 text-center">
          <Skeleton className="h-10 w-96 mx-auto" />
          <Skeleton className="h-5 w-[500px] mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
        <Skeleton className="h-14 max-w-2xl mx-auto rounded-xl" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent reports skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-8 w-20" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="flex items-start justify-between gap-3 py-2">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Skeleton className="h-5 w-16 rounded" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Types for API response
interface RecentReport {
  reportId: number;
  din: string | null;
  brandName: string | null;
  commonName: string | null;
  status: string;
  company: string | null;
  reasonEn: string | null;
  tier3: boolean | null;
  apiUpdatedDate: string | null;
  // Shortage dates
  actualStartDate?: string | null;
  anticipatedStartDate?: string | null;
  // Discontinuation dates
  discontinuationDate?: string | null;
  anticipatedDiscontinuationDate?: string | null;
}

interface StatsData {
  reportsByStatus: Record<string, number>;
  resolvedLast30Days: number;
  recentTier3Shortages: RecentReport[];
  recentDiscontinuations: RecentReport[];
  lastSyncedAt: string | null;
  totals: {
    drugs: number;
    reports: number;
  };
}

// Status configuration for badges - matches reports page colors
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active_confirmed: {
    label: 'Active',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  anticipated_shortage: {
    label: 'Anticipated',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  avoided_shortage: {
    label: 'Avoided',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
  to_be_discontinued: {
    label: 'To Be Discontinued',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
  discontinued: {
    label: 'Discontinued',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
  reversed: {
    label: 'Reversed',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
};

// Format date as short date with year (e.g., "Jan 6, 2026")
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Format sync time
function formatSyncTime(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Unknown';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return 'Yesterday';
}


export default function Home() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch stats on mount
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return <HomeSkeleton />;
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">{error || 'Failed to load data'}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const { reportsByStatus, resolvedLast30Days, recentTier3Shortages, recentDiscontinuations, lastSyncedAt } = stats;

  return (
    <div className="space-y-8">
      {/* Hero Section with Search */}
      <div className="space-y-6 py-6">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Canadian Drug Shortage Intelligence
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Check if your medication is in shortage, find alternatives, and stay informed with real-time updates from Drug Shortages Canada.
          </p>
          {/* Sync Status */}
          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span>Data synced {formatSyncTime(lastSyncedAt)}</span>
          </div>
        </div>

        {/* Search Bar */}
        <DrugSearch
          variant="hero"
          placeholder="Search by drug name, DIN, or ingredient..."
          className="max-w-2xl mx-auto"
        />
      </div>

      {/* Stats Cards with Colors */}
      <motion.div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: 0.1
            }
          }
        }}
      >
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
          }}
          whileHover={{ scale: 1.03, y: -4 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link href="/reports?status=active_confirmed" className="block h-full">
            <Card className="h-full cursor-pointer bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-red-200/50 dark:border-red-800/30 shadow-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-900 dark:text-red-100">
                Active Shortages
              </CardTitle>
              <div className="rounded-full bg-red-500/20 p-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-900 dark:text-red-100">
                {(reportsByStatus.active_confirmed || 0).toLocaleString()}
              </div>
              <p className="text-xs text-red-700/80 dark:text-red-300/80 flex items-center gap-1 mt-1">
                Currently in shortage
                <ArrowRight className="h-3 w-3" />
              </p>
            </CardContent>
          </Card>
          </Link>
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
          }}
          whileHover={{ scale: 1.03, y: -4 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link href="/reports?status=anticipated_shortage" className="block h-full">
            <Card className="h-full cursor-pointer bg-gradient-to-br from-amber-50 to-yellow-100/50 dark:from-amber-950/30 dark:to-yellow-900/20 border-amber-200/50 dark:border-amber-800/30 shadow-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Anticipated
              </CardTitle>
              <div className="rounded-full bg-amber-500/20 p-2">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                {(reportsByStatus.anticipated_shortage || 0).toLocaleString()}
              </div>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80 flex items-center gap-1 mt-1">
                Expected shortages
                <ArrowRight className="h-3 w-3" />
              </p>
            </CardContent>
          </Card>
          </Link>
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
          }}
          whileHover={{ scale: 1.03, y: -4 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link href="/reports?status=to_be_discontinued" className="block h-full">
            <Card className="h-full cursor-pointer bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200/50 dark:border-orange-800/30 shadow-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-900 dark:text-orange-100">
                To Be Discontinued
              </CardTitle>
              <div className="rounded-full bg-orange-500/20 p-2">
                <TrendingDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">
                {(reportsByStatus.to_be_discontinued || 0).toLocaleString()}
              </div>
              <p className="text-xs text-orange-700/80 dark:text-orange-300/80 flex items-center gap-1 mt-1">
                Pending discontinuation
                <ArrowRight className="h-3 w-3" />
              </p>
            </CardContent>
          </Card>
          </Link>
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
          }}
          whileHover={{ scale: 1.03, y: -4 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link href="/reports?status=resolved" className="block h-full">
            <Card className="h-full cursor-pointer bg-gradient-to-br from-emerald-50 to-green-100/50 dark:from-emerald-950/30 dark:to-green-900/20 border-emerald-200/50 dark:border-emerald-800/30 shadow-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Resolved (30d)
              </CardTitle>
              <div className="rounded-full bg-emerald-500/20 p-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
                {(resolvedLast30Days || 0).toLocaleString()}
              </div>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 flex items-center gap-1 mt-1">
                Recently resolved
                <ArrowRight className="h-3 w-3" />
              </p>
            </CardContent>
          </Card>
          </Link>
        </motion.div>
      </motion.div>

      {/* Recent Reports Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Critical Tier 3 Shortages */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <div>
                <CardTitle>Critical Shortages</CardTitle>
                <CardDescription>
                  Tier 3 shortages affecting essential medications
                </CardDescription>
              </div>
            </div>
            <Link href="/reports?tier3=true">
              <Button variant="ghost" size="sm" className="gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-0.5">
              {recentTier3Shortages.map((report) => (
                <Link
                  key={report.reportId}
                  href={`/reports/${report.reportId}`}
                  className="flex items-start justify-between gap-3 py-3 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-sm font-medium leading-none truncate group-hover:text-primary transition-colors">
                      {report.commonName || report.brandName || `DIN ${report.din}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      <span className="font-mono">{report.din}</span>
                      <span className="mx-1.5">•</span>
                      <span>{report.reasonEn || report.company}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_CONFIG[report.status]?.className || 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_CONFIG[report.status]?.label || report.status}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      {report.status === 'anticipated_shortage'
                        ? `Starting ${formatDate(report.anticipatedStartDate ?? null)}`
                        : report.actualStartDate
                          ? `Since ${formatDate(report.actualStartDate)}`
                          : `Updated ${formatDate(report.apiUpdatedDate ?? null)}`}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Discontinuation Reports */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Recent Discontinuations</CardTitle>
              <CardDescription>
                Drugs being permanently removed from market
              </CardDescription>
            </div>
            <Link href="/reports?type=discontinuation">
              <Button variant="ghost" size="sm" className="gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-0.5">
              {recentDiscontinuations.map((report) => (
                <Link
                  key={report.reportId}
                  href={`/reports/${report.reportId}`}
                  className="flex items-start justify-between gap-3 py-3 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium leading-none truncate group-hover:text-primary transition-colors">
                        {report.commonName || report.brandName || `DIN ${report.din}`}
                      </p>
                      {report.tier3 && (
                        <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      <span className="font-mono">{report.din}</span>
                      <span className="mx-1.5">•</span>
                      <span>{report.reasonEn || report.company}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_CONFIG[report.status]?.className || 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_CONFIG[report.status]?.label || report.status}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      {(report.discontinuationDate || report.anticipatedDiscontinuationDate)
                        ? `On ${formatDate((report.discontinuationDate ?? report.anticipatedDiscontinuationDate) ?? null)}`
                        : `Updated ${formatDate(report.apiUpdatedDate ?? null)}`}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-3 justify-center pt-4 pb-8">
        <Link href="/drugs">
          <Button variant="outline" size="lg" className="gap-2">
            Browse All Drugs
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/reports?tier3=true">
          <Button variant="outline" size="lg" className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
            <ShieldAlert className="h-4 w-4" />
            Tier 3 Critical Shortages
          </Button>
        </Link>
      </div>
    </div>
  );
}
