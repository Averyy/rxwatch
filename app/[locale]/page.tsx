'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, TrendingDown, CheckCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

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
import { SyncStatus } from '@/components/sync-status';

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
const STATUS_STYLES: Record<string, string> = {
  active_confirmed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  anticipated_shortage: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  avoided_shortage: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  to_be_discontinued: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  discontinued: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  reversed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
};

// Format date as short date with year (e.g., "Jan 6, 2026")
function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  return date.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Home() {
  const locale = useLocale();
  const t = useTranslations('HomePage');
  const tStatus = useTranslations('Status');
  const tSearch = useTranslations('Search');

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
        <p className="text-muted-foreground">{error || t('failedToLoad')}</p>
        <Button onClick={() => window.location.reload()}>{t('retry')}</Button>
      </div>
    );
  }

  const { reportsByStatus, resolvedLast30Days, recentTier3Shortages, recentDiscontinuations } = stats;

  return (
    <div className="space-y-8">
      {/* Hero Section with Search */}
      <div className="space-y-6 py-6">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('description')}
          </p>
          {/* Sync Status */}
          <SyncStatus variant="homepage" />
        </div>

        {/* Search Bar */}
        <DrugSearch
          variant="hero"
          placeholder={tSearch('placeholder')}
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
          <Link href={`/${locale}/reports?status=active_confirmed`} className="block h-full">
            <Card className="h-full cursor-pointer bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-red-200/50 dark:border-red-800/30 shadow-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-900 dark:text-red-100">
                {t('activeShortages')}
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
                {t('currentlyInShortage')}
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
          <Link href={`/${locale}/reports?status=anticipated_shortage`} className="block h-full">
            <Card className="h-full cursor-pointer bg-gradient-to-br from-amber-50 to-yellow-100/50 dark:from-amber-950/30 dark:to-yellow-900/20 border-amber-200/50 dark:border-amber-800/30 shadow-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {t('anticipated')}
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
                {t('expectedShortages')}
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
          <Link href={`/${locale}/reports?status=to_be_discontinued`} className="block h-full">
            <Card className="h-full cursor-pointer bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200/50 dark:border-orange-800/30 shadow-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-900 dark:text-orange-100">
                {t('toBeDiscontinued')}
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
                {t('pendingDiscontinuation')}
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
          <Link href={`/${locale}/reports?status=resolved`} className="block h-full">
            <Card className="h-full cursor-pointer bg-gradient-to-br from-emerald-50 to-green-100/50 dark:from-emerald-950/30 dark:to-green-900/20 border-emerald-200/50 dark:border-emerald-800/30 shadow-sm hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                {t('resolved30d')}
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
                {t('recentlyResolved')}
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
                <CardTitle>{t('criticalShortages')}</CardTitle>
                <CardDescription>
                  {t('tier3Description')}
                </CardDescription>
              </div>
            </div>
            <Link href={`/${locale}/reports?tier3=true`}>
              <Button variant="ghost" size="sm" className="gap-1">
                {t('viewAll')} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-0.5">
              {recentTier3Shortages.map((report) => (
                <Link
                  key={report.reportId}
                  href={`/${locale}/reports/${report.reportId}`}
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
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[report.status] || 'bg-gray-100 text-gray-800'}`}>
                      {tStatus(report.status)}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      {report.status === 'anticipated_shortage'
                        ? t('starting', { date: formatDate(report.anticipatedStartDate ?? null, locale) })
                        : report.actualStartDate
                          ? t('since', { date: formatDate(report.actualStartDate, locale) })
                          : t('updated', { date: formatDate(report.apiUpdatedDate ?? null, locale) })}
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
              <CardTitle>{t('recentDiscontinuations')}</CardTitle>
              <CardDescription>
                {t('discontinuationsDescription')}
              </CardDescription>
            </div>
            <Link href={`/${locale}/reports?status=discontinued,to_be_discontinued`}>
              <Button variant="ghost" size="sm" className="gap-1">
                {t('viewAll')} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-0.5">
              {recentDiscontinuations.map((report) => (
                <Link
                  key={report.reportId}
                  href={`/${locale}/reports/${report.reportId}`}
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
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[report.status] || 'bg-gray-100 text-gray-800'}`}>
                      {tStatus(report.status)}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      {(report.discontinuationDate || report.anticipatedDiscontinuationDate)
                        ? t('on', { date: formatDate((report.discontinuationDate ?? report.anticipatedDiscontinuationDate) ?? null, locale) })
                        : t('updated', { date: formatDate(report.apiUpdatedDate ?? null, locale) })}
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
        <Link href={`/${locale}/drugs`}>
          <Button variant="outline" size="lg" className="gap-2">
            {t('browseAllDrugs')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href={`/${locale}/reports?tier3=true`}>
          <Button variant="outline" size="lg" className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
            <ShieldAlert className="h-4 w-4" />
            {t('tier3CriticalShortages')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
