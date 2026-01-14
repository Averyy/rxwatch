'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  AlertTriangle,
  TrendingUp,
  Building2,
  Clock,
  ShieldAlert,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from '@/components/ui/chart';

// ===========================================
// TYPES
// ===========================================

interface StatsData {
  totals: {
    drugs: number;
    reports: number;
    drugsWithReports: number;
    activeReports: number;
    tier3Active: number;
    lateSubmissions: number;
  };
  reportsByStatus: Record<string, number>;
  reportsByType: Record<string, number>;
  lateRateByCompany: Array<{
    company: string;
    total_reports: string;
    late_reports: string;
    late_rate_pct: string;
  }>;
  accountability: {
    shortageDuration: {
      avg_days: string;
      median_days: number;
      min_days: number;
      max_days: number;
      sample_size: string;
    } | null;
    shortagesByDosageForm: Array<{
      dosage_form: string;
      active_reports: string;
    }>;
    shortagesByIngredient: Array<{
      ingredient: string;
      active_reports: string;
    }>;
    shortagesByIngredientAllTime: Array<{
      ingredient: string;
      total_reports: string;
      active_reports: string;
    }>;
    shortagesByTherapeuticClass: Array<{
      atc_level1: string;
      category_name: string;
      total_reports: string;
      active_reports: string;
    }>;
    rootCauseBreakdown: Array<{
      reason_category: string;
      count: string;
    }>;
    rootCausesByYear: Array<{
      year: number;
      reason_category: string;
      count: string;
    }>;
    repeatOffenders: Array<{
      company: string;
      total_shortages: string;
      active_shortages: string;
      late_count: string;
      late_rate_pct: string;
    }>;
    tier3ActiveList: Array<{
      reportId: number;
      din: string;
      brandName: string;
      commonName: string;
      company: string;
      status: string;
      reasonEn: string;
      actualStartDate: string;
    }>;
  };
  trends: {
    monthly: Array<{
      month: string;
      month_label: string;
      year: number;
      new_reports: string;
      shortages: string;
      discontinuations: string;
    }>;
    quarterly: Array<{
      quarter: string;
      year: number;
      q: number;
      new_reports: string;
      shortages: string;
      discontinuations: string;
      late_reports: string;
      late_rate_pct: string;
    }>;
    yearly: Array<{
      year: number;
      total_reports: string;
      shortages: string;
      discontinuations: string;
      active_confirmed: string;
      anticipated: string;
      resolved: string;
      avoided: string;
      to_be_discontinued: string;
      discontinued: string;
      tier3_reports: string;
    }>;
    yearToDate: {
      current_year: number;
      previous_year: number;
      current_ytd_total: string;
      previous_ytd_total: string;
      current_ytd_shortages: string;
      previous_ytd_shortages: string;
      current_ytd_late: string;
      previous_ytd_late: string;
      current_ytd_tier3: string;
      previous_ytd_tier3: string;
      ytd_date: string;
      day_of_year: number;
    } | null;
    durationByYear: Array<{
      year: number;
      avg_duration_days: string;
      median_duration_days: number;
      resolved_count: string;
    }>;
  };
  generatedAt: string;
}

// ===========================================
// CHART CONFIGS
// ===========================================

const yearlyChartConfig: ChartConfig = {
  active_confirmed: { label: 'Active Shortages', color: 'hsl(0, 84%, 60%)' },
  anticipated: { label: 'Anticipated', color: 'hsl(38, 92%, 50%)' },
  resolved: { label: 'Resolved', color: 'hsl(142, 76%, 36%)' },
  discontinued: { label: 'Discontinued', color: 'hsl(262, 83%, 58%)' },
};

const durationConfig: ChartConfig = {
  avg_duration_days: { label: 'Avg Duration', color: 'hsl(221, 83%, 53%)' },
  median_duration_days: { label: 'Median Duration', color: 'hsl(142, 76%, 36%)' },
};

const therapeuticConfig: ChartConfig = {
  active_reports: { label: 'Active Reports', color: 'hsl(0, 84%, 60%)' },
};

const rootCauseConfig: ChartConfig = {
  manufacturing: { label: 'Manufacturing issues', color: 'hsl(0, 84%, 60%)' },
  demand: { label: 'Increased demand', color: 'hsl(38, 92%, 50%)' },
  logistics: { label: 'Logistics', color: 'hsl(280, 65%, 60%)' },
  supply: { label: 'Supply chain', color: 'hsl(262, 83%, 58%)' },
  other: { label: 'Other', color: 'hsl(0, 0%, 60%)' },
};

// ===========================================
// HELPER COMPONENTS
// ===========================================

function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-20" /></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent><Skeleton className="h-64 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export default function StatsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('StatsPage');
  const tCommon = useTranslations('Common');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    async function fetchStats() {
      try {
        const res = await fetch('/api/stats', { signal: abortController.signal });
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        if (!abortController.signal.aborted) setStats(data);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!abortController.signal.aborted) setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (!abortController.signal.aborted) setLoading(false);
      }
    }
    fetchStats();
    return () => abortController.abort();
  }, []);

  if (loading) return <StatsSkeleton />;

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">{error || t('failedToLoad')}</p>
        <Button onClick={() => window.location.reload()}>{t('retry')}</Button>
      </div>
    );
  }

  const { accountability, trends } = stats;

  // Prepare chart data (all time)
  const yearlyChartData = trends.yearly.map(y => ({
    year: y.year.toString(),
    active_confirmed: Number(y.active_confirmed),
    anticipated: Number(y.anticipated),
    resolved: Number(y.resolved),
    avoided: Number(y.avoided),
    to_be_discontinued: Number(y.to_be_discontinued),
    discontinued: Number(y.discontinued),
    shortages: Number(y.shortages),
    discontinuations: Number(y.discontinuations),
    total: Number(y.total_reports),
    tier3: Number(y.tier3_reports),
  }));

  const durationTrendDataAll = trends.durationByYear.map(d => ({
    year: d.year.toString(),
    avg_duration_days: Number(d.avg_duration_days),
    resolved_count: Number(d.resolved_count),
  }));

  const therapeuticDataFull = accountability.shortagesByTherapeuticClass
    .filter(t => t.category_name !== 'Unknown')
    .slice(0, 10)
    .map(t => ({
      category: t.category_name,
      atc: t.atc_level1,
      active: Number(t.active_reports),
      total: Number(t.total_reports),
    }));

  // Same data but sorted by total reports instead of active
  const therapeuticDataByTotal = [...accountability.shortagesByTherapeuticClass]
    .filter(t => t.category_name !== 'Unknown')
    .sort((a, b) => Number(b.total_reports) - Number(a.total_reports))
    .slice(0, 10)
    .map(t => ({
      category: t.category_name,
      atc: t.atc_level1,
      active: Number(t.active_reports),
      total: Number(t.total_reports),
    }));

  const ingredientData = accountability.shortagesByIngredient
    .filter(i => i.ingredient !== 'Unknown' && i.ingredient.trim() !== '')
    .slice(0, 12)
    .map(i => ({
      ingredient: i.ingredient.length > 20 ? i.ingredient.slice(0, 20) + '...' : i.ingredient,
      fullName: i.ingredient,
      active: Number(i.active_reports),
    }));

  const ingredientDataAllTime = (accountability.shortagesByIngredientAllTime || [])
    .filter(i => i.ingredient !== 'Unknown' && i.ingredient.trim() !== '')
    .slice(0, 12)
    .map(i => ({
      ingredient: i.ingredient.length > 20 ? i.ingredient.slice(0, 20) + '...' : i.ingredient,
      fullName: i.ingredient,
      total: Number(i.total_reports),
      active: Number(i.active_reports),
    }));

  const rootCauseData = accountability.rootCauseBreakdown
    .filter(r => r.reason_category !== 'Not specified')
    .map(r => ({ reason: r.reason_category, count: Number(r.count) }))
    .sort((a, b) => {
      // Put "Other" last
      if (a.reason === 'Other') return 1;
      if (b.reason === 'Other') return -1;
      return b.count - a.count;
    });

  const repeatOffendersData = accountability.repeatOffenders.slice(0, 10).map(r => ({
    company: r.company.length > 25 ? r.company.slice(0, 25) + '...' : r.company,
    fullName: r.company,
    total: Number(r.total_shortages),
    active: Number(r.active_shortages),
    lateRate: Number(r.late_rate_pct),
    lateCount: Number(r.late_count),
  }));

  // Transform root causes by year data into chart format
  // Pivot from [{year, reason_category, count}] to [{year, manufacturing, demand, supply, ...}]
  const rootCausesByYearMap = new Map<number, Record<string, number>>();
  const reasonKeyMap: Record<string, string> = {
    'Manufacturing issues': 'manufacturing',
    'Increased demand': 'demand',
    'Supply chain': 'supply',
    'Logistics': 'logistics',
    'Other': 'other',
    'Not specified': 'other', // Group with other
  };

  (accountability.rootCausesByYear || []).forEach(item => {
    const year = item.year;
    const key = reasonKeyMap[item.reason_category] || 'other';
    if (!rootCausesByYearMap.has(year)) {
      rootCausesByYearMap.set(year, { year });
    }
    const entry = rootCausesByYearMap.get(year)!;
    entry[key] = Number(item.count);
  });

  const rootCausesByYearData = Array.from(rootCausesByYearMap.values())
    .sort((a, b) => (a.year as number) - (b.year as number))
    .map(d => ({ ...d, year: d.year.toString() }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('pageTitle')}</h1>
        <p className="text-muted-foreground">
          {t('pageDescription')}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href={`/${locale}/reports?status=active_confirmed,anticipated_shortage`}>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('activeShortages')}</CardTitle>
              <Activity className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.totals.activeReports.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{t('clickToViewAll')}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/${locale}/reports?tier3=true`}>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('tier3Critical')}</CardTitle>
              <ShieldAlert className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.totals.tier3Active.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{t('highestImpact')}</p>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('medianDuration')}</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {accountability.shortageDuration?.median_days || '—'}
              <span className="text-base font-normal text-muted-foreground ml-1">{t('days')}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t('avg')}: {accountability.shortageDuration?.avg_days || '—'} {t('days')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalReports')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totals.reports.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{t('since2017')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Annual Reports by Year */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('annualReportVolume')}
            </CardTitle>
            <CardDescription>
              {t('reportsCreatedEachYear')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={yearlyChartConfig} className="h-[300px] w-full aspect-auto">
              <LineChart data={yearlyChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="year" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                        <p className="font-medium">{label}</p>
                        <p className="text-sm" style={{ color: 'hsl(0, 84%, 60%)' }}>
                          Active Shortages: {data.active_confirmed.toLocaleString()}
                        </p>
                        <p className="text-sm" style={{ color: 'hsl(262, 83%, 58%)' }}>
                          Discontinued: {data.discontinued.toLocaleString()}
                        </p>
                        <p className="text-sm" style={{ color: 'hsl(38, 92%, 50%)' }}>
                          Anticipated: {data.anticipated.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 pt-1 border-t">
                          Total: {data.total.toLocaleString()} (incl. {data.resolved.toLocaleString()} resolved)
                        </p>
                      </div>
                    );
                  }}
                />
                <Legend />
                <Line type="linear" dataKey="active_confirmed" name="Active Shortages" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="linear" dataKey="discontinued" name="Discontinued" stroke="hsl(262, 83%, 58%)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="linear" dataKey="anticipated" name="Anticipated" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Tier 3 Critical Shortages by Year */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              {t('tier3ByYear')}
            </CardTitle>
            <CardDescription>
              {t('mostSevereShortages')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={therapeuticConfig} className="h-[280px] w-full aspect-auto">
              <BarChart data={yearlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="year" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                        <p className="font-medium">{label}</p>
                        <p className="text-sm text-destructive font-medium">{data.tier3} Tier 3 reports</p>
                        <p className="text-sm text-muted-foreground">{data.total.toLocaleString()} total reports</p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="tier3"
                  fill="hsl(0, 84%, 60%)"
                  radius={4}
                  className="cursor-pointer"
                  onClick={(data) => {
                    if (data?.year) {
                      router.push(`/${locale}/reports?tier3=true&created_since=${data.year}-01-01&created_until=${data.year}-12-31`);
                    }
                  }}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Shortage Duration Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('avgDurationByYear')}
            </CardTitle>
            <CardDescription>
              {t('areShortagesLasting')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={durationConfig} className="h-[280px] w-full aspect-auto">
              <BarChart data={durationTrendDataAll} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="year" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} label={{ value: 'Days', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                <ChartTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                        <p className="font-medium">{label}</p>
                        <p className="text-sm text-blue-600">Avg: {data.avg_duration_days} days</p>
                        <p className="text-sm text-muted-foreground">Based on {data.resolved_count.toLocaleString()} resolved</p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="avg_duration_days"
                  name="Average Duration"
                  fill="hsl(221, 83%, 53%)"
                  radius={4}
                  className="cursor-pointer"
                  onClick={(data) => {
                    if (data?.year) {
                      router.push(`/${locale}/reports?status=resolved&created_since=${data.year}-01-01&created_until=${data.year}-12-31`);
                    }
                  }}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

      </div>

      {/* Drugs in Shortage Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          {t('drugsInShortage')}
        </h2>

        <div className="grid gap-6 lg:grid-cols-2">
        {/* Shortages by Active Ingredient */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t('activeByIngredient')}
            </CardTitle>
            <CardDescription>
              {t('whichIngredients')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={therapeuticConfig} className="h-[300px] w-full aspect-auto">
              <BarChart data={ingredientData} layout="vertical" margin={{ left: 0, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <YAxis dataKey="ingredient" type="category" tickLine={false} axisLine={false} width={120} fontSize={10} />
                <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                        <p className="font-medium">{data.fullName}</p>
                        <p className="text-sm text-destructive font-medium">{data.active} active shortages</p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="active"
                  fill="hsl(262, 83%, 58%)"
                  radius={4}
                  className="cursor-pointer"
                  onClick={(data) => {
                    if (data?.fullName) {
                      router.push(`/${locale}/reports?search=${encodeURIComponent(data.fullName)}&status=active_confirmed,anticipated_shortage`);
                    }
                  }}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* All-Time Shortages by Ingredient */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t('allTimeByIngredient')}
            </CardTitle>
            <CardDescription>
              {t('historicalByIngredient')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={therapeuticConfig} className="h-[300px] w-full aspect-auto">
              <BarChart data={ingredientDataAllTime} layout="vertical" margin={{ left: 0, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <YAxis dataKey="ingredient" type="category" tickLine={false} axisLine={false} width={120} fontSize={10} />
                <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                        <p className="font-medium">{data.fullName}</p>
                        <p className="text-sm font-medium" style={{ color: 'hsl(221, 83%, 53%)' }}>{data.total.toLocaleString()} total reports</p>
                        <p className="text-sm text-muted-foreground">{data.active} currently active</p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="total"
                  fill="hsl(221, 83%, 53%)"
                  radius={4}
                  className="cursor-pointer"
                  onClick={(data) => {
                    if (data?.fullName) {
                      router.push(`/${locale}/reports?search=${encodeURIComponent(data.fullName)}`);
                    }
                  }}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Shortages by Therapeutic Class */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              {t('activeByCategory')}
            </CardTitle>
            <CardDescription>
              {t('whichCategories')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={therapeuticConfig} className="h-[300px] w-full aspect-auto">
              <BarChart data={therapeuticDataFull} layout="vertical" margin={{ left: 0, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <YAxis dataKey="category" type="category" tickLine={false} axisLine={false} width={120} fontSize={11} />
                <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                        <p className="font-medium">{data.category} ({data.atc})</p>
                        <p className="text-sm text-destructive font-medium">{data.active} active shortages</p>
                        <p className="text-sm text-muted-foreground">{data.total.toLocaleString()} total reports</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="active" fill="hsl(0, 84%, 60%)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* All-Time Shortages by Drug Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              {t('allTimeByCategory')}
            </CardTitle>
            <CardDescription>
              {t('historicalByCategory')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={therapeuticConfig} className="h-[300px] w-full aspect-auto">
              <BarChart data={therapeuticDataByTotal} layout="vertical" margin={{ left: 0, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <YAxis dataKey="category" type="category" tickLine={false} axisLine={false} width={120} fontSize={11} />
                <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                        <p className="font-medium">{data.category} ({data.atc})</p>
                        <p className="text-sm font-medium" style={{ color: 'hsl(221, 83%, 53%)' }}>{data.total.toLocaleString()} total reports</p>
                        <p className="text-sm text-muted-foreground">{data.active} currently active</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="total" fill="hsl(221, 83%, 53%)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Accountability Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {t('companyAccountability')}
        </h2>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Companies with Most Shortages */}
          <Card>
            <CardHeader>
              <CardTitle>{t('companiesWithMost')}</CardTitle>
              <CardDescription>{t('clickAnyRow')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {repeatOffendersData.map((company, i) => (
                  <Link key={company.fullName} href={`/${locale}/reports?search=${encodeURIComponent(company.fullName)}&type=shortage`}>
                    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-5">{i + 1}</span>
                        <div>
                          <p className="font-medium text-sm">{company.company}</p>
                          <p className="text-xs text-muted-foreground">{company.total.toLocaleString()} {t('totalShortages')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-destructive">
                          {company.active} {t('active')}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4 italic">
                {t('largeManufacturers')}
              </p>
            </CardContent>
          </Card>

          {/* Root Causes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {t('shortageRootCauses')}
              </CardTitle>
              <CardDescription>{t('whyShortages')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rootCauseData.map((cause) => (
                  <Link key={cause.reason} href={`/${locale}/reports?search=${encodeURIComponent(cause.reason)}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                      <span className="text-sm font-medium">{cause.reason}</span>
                      <span className="text-lg font-bold tabular-nums">{cause.count.toLocaleString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Root Causes Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('shortageRootCauses')}
          </CardTitle>
          <CardDescription>
            {t('whyShortages')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={rootCauseConfig} className="h-[350px] w-full aspect-auto">
            <LineChart data={rootCausesByYearData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="year" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <ChartTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload;
                  const total = (data.manufacturing || 0) + (data.demand || 0) + (data.supply || 0) +
                    (data.logistics || 0) + (data.other || 0);
                  return (
                    <div className="rounded-lg border bg-background px-3 py-2 shadow-md min-w-[180px]">
                      <p className="font-medium mb-2">{label}</p>
                      {data.manufacturing > 0 && (
                        <p className="text-sm" style={{ color: 'hsl(0, 84%, 60%)' }}>
                          Manufacturing: {data.manufacturing?.toLocaleString()}
                        </p>
                      )}
                      {data.demand > 0 && (
                        <p className="text-sm" style={{ color: 'hsl(38, 92%, 50%)' }}>
                          Demand: {data.demand?.toLocaleString()}
                        </p>
                      )}
                      {data.logistics > 0 && (
                        <p className="text-sm" style={{ color: 'hsl(280, 65%, 60%)' }}>
                          Logistics: {data.logistics?.toLocaleString()}
                        </p>
                      )}
                      {data.supply > 0 && (
                        <p className="text-sm" style={{ color: 'hsl(262, 83%, 58%)' }}>
                          Supply chain: {data.supply?.toLocaleString()}
                        </p>
                      )}
                      {data.other > 0 && (
                        <p className="text-sm" style={{ color: 'hsl(0, 0%, 60%)' }}>
                          Other: {data.other?.toLocaleString()}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                        Total: {total.toLocaleString()}
                      </p>
                    </div>
                  );
                }}
              />
              <Legend />
              <Line type="linear" dataKey="manufacturing" name="Manufacturing issues" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="linear" dataKey="demand" name="Increased demand" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="linear" dataKey="logistics" name="Logistics" stroke="hsl(280, 65%, 60%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="linear" dataKey="supply" name="Supply chain" stroke="hsl(262, 83%, 58%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="linear" dataKey="other" name="Other" stroke="hsl(0, 0%, 60%)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground pb-4 space-y-1">
        <p>
          {t('dataFrom')}{' '}
          <a href="https://www.drugshortagescanada.ca" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Drug Shortages Canada</a>
          {' '}{t('and')}{' '}
          <a href="https://www.canada.ca/en/health-canada.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Health Canada</a>
          . {t('updatedEvery15')}
        </p>
        <p>{tCommon('notMedicalAdvice')}. {tCommon('consultProfessional')}</p>
      </div>
    </div>
  );
}
