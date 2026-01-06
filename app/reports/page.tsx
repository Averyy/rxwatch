'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  colorSchemeDark,
  colorSchemeLight,
} from 'ag-grid-community';
import type { ColDef, IRowNode } from 'ag-grid-community';
import { MagnifyingGlass, X, Funnel, CaretLeft, CaretRight, CaretDoubleLeft, CaretDoubleRight } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';

// Skeleton loading component for reports page
function ReportsPageSkeleton() {
  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-6rem)]">
      {/* Header skeleton */}
      <div className="flex items-baseline justify-between flex-shrink-0">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Filters skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-shrink-0">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-9 w-28" />
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-7 w-14" />
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-7 w-20" />
          ))}
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="flex-1 min-h-0 w-full rounded-lg border overflow-hidden bg-background flex flex-col">
        {/* Header row */}
        <div className="grid grid-cols-[80px_80px_1fr_1fr_100px_1.5fr_100px_100px_120px] border-b bg-muted/30 px-4 py-3 gap-4 flex-shrink-0">
          {['Report ID', 'DIN', 'Brand', 'Common', 'Status', 'Reason', 'Tier 3', 'Late', 'Updated'].map((_, i) => (
            <Skeleton key={i} className="h-4 w-3/4" />
          ))}
        </div>
        {/* Data rows - fill remaining space */}
        <div className="flex-1 overflow-hidden">
          {[...Array(25)].map((_, i) => (
            <div key={i} className="grid grid-cols-[80px_80px_1fr_1fr_100px_1.5fr_100px_100px_120px] border-b px-4 py-3 gap-4">
              {[...Array(9)].map((_, j) => (
                <Skeleton key={j} className="h-4 w-4/5" />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <Skeleton className="h-9 w-44" />
        <div className="flex items-center gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-8" />
          ))}
          <Skeleton className="h-4 w-24 mx-2" />
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-8" />
          ))}
        </div>
        <Skeleton className="h-4 w-36" />
      </div>
    </div>
  );
}

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Convert ALL CAPS to Title Case
function toTitleCase(str: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Format date for display
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Types matching our API response
interface Report {
  reportId: number;
  din: string | null;
  brandName: string | null;
  commonName: string | null;
  type: 'shortage' | 'discontinuation';
  status: string | null;
  reasonEn: string | null;
  company: string | null;
  tier3: boolean | null;
  lateSubmission: boolean | null;
  actualStartDate: string | null;
  estimatedEndDate: string | null;
  actualEndDate: string | null;
  anticipatedDiscontinuationDate: string | null;
  discontinuationDate: string | null;
  apiCreatedDate: string | null;
  apiUpdatedDate: string | null;
}

// Status configuration - shared between filter and cell renderer
const STATUS_CONFIG: Record<string, { label: string; className: string; filterClass: string }> = {
  active_confirmed: {
    label: 'Active',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    filterClass: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800 dark:hover:bg-red-900',
  },
  anticipated_shortage: {
    label: 'Anticipated',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    filterClass: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-800 dark:hover:bg-yellow-900',
  },
  to_be_discontinued: {
    label: 'To Be Discontinued',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    filterClass: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-800 dark:hover:bg-orange-900',
  },
  discontinued: {
    label: 'Discontinued',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    filterClass: 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200 dark:bg-gray-800/50 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    filterClass: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-800 dark:hover:bg-green-900',
  },
  avoided_shortage: {
    label: 'Avoided',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    filterClass: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-800 dark:hover:bg-blue-900',
  },
  reversed: {
    label: 'Reversed',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    filterClass: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-800 dark:hover:bg-purple-900',
  },
};

// Status badge component
function StatusCellRenderer(props: { value: string | null }) {
  const status = props.value;
  if (!status) return null;

  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-800' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

// Boolean badge component for Tier 3 / Late
function BooleanCellRenderer(props: { value: boolean | null; label: string }) {
  if (!props.value) return null;

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
      {props.label}
    </span>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();
  const gridRef = useRef<AgGridReact<Report>>(null);
  const [rowData, setRowData] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const initializedFromUrl = useRef(false);

  // Initialize filter state from URL params
  const getInitialStatusFilters = (): string[] => {
    const statusParam = searchParams.get('status');
    if (!statusParam) return [];
    // Support both single status and comma-separated statuses
    return statusParam.split(',').filter(s => STATUS_CONFIG[s]);
  };

  const getInitialTier3 = (): boolean => {
    return searchParams.get('tier3') === 'true';
  };

  const getInitialDateRange = (): string => {
    const range = searchParams.get('range');
    if (range && ['thisYear', 'lastYear', '3years', '5years', 'all'].includes(range)) {
      return range;
    }
    return '3years';
  };

  const getInitialSearch = (): string => {
    return searchParams.get('search') || '';
  };

  const getInitialType = (): 'shortage' | 'discontinuation' | 'all' => {
    const type = searchParams.get('type');
    if (type === 'shortage' || type === 'discontinuation') return type;
    return 'all';
  };

  // Filter state - initialized from URL params
  const [searchText, setSearchText] = useState(getInitialSearch);
  const [statusFilters, setStatusFilters] = useState<string[]>(getInitialStatusFilters);
  const [tier3Only, setTier3Only] = useState(getInitialTier3);
  const [typeFilter, setTypeFilter] = useState<'shortage' | 'discontinuation' | 'all'>(getInitialType);
  const [dateRange, setDateRange] = useState<string>(getInitialDateRange);
  const [displayedRowCount, setDisplayedRowCount] = useState(0);

  // Calculate the since date based on dateRange
  const getSinceDate = (range: string): string | null => {
    const now = new Date();
    switch (range) {
      case 'thisYear':
        return `${now.getFullYear()}-01-01`;
      case 'lastYear':
        return `${now.getFullYear() - 1}-01-01`;
      case '3years':
        return `${now.getFullYear() - 3}-01-01`;
      case '5years':
        return `${now.getFullYear() - 5}-01-01`;
      case 'all':
      default:
        return null;
    }
  };

  // Pagination state
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Wait for client-side mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    initializedFromUrl.current = true;
  }, []);

  // Sync filter state to URL (after initial mount)
  useEffect(() => {
    if (!initializedFromUrl.current) return;

    const params = new URLSearchParams();

    // Add status filters (comma-separated if multiple)
    if (statusFilters.length > 0) {
      params.set('status', statusFilters.join(','));
    }

    // Add tier3 filter
    if (tier3Only) {
      params.set('tier3', 'true');
    }

    // Add type filter
    if (typeFilter !== 'all') {
      params.set('type', typeFilter);
    }

    // Add date range (only if not default)
    if (dateRange !== '3years') {
      params.set('range', dateRange);
    }

    // Add search text
    if (searchText.trim()) {
      params.set('search', searchText.trim());
    }

    // Update URL without adding to history
    const newUrl = params.toString() ? `?${params.toString()}` : '/reports';
    router.replace(newUrl, { scroll: false });
  }, [statusFilters, tier3Only, typeFilter, dateRange, searchText, router]);

  // Column definitions
  const columnDefs = useMemo<ColDef<Report>[]>(() => [
    {
      field: 'reportId',
      headerName: 'Report ID',
      width: 110,
      pinned: 'left',
    },
    {
      field: 'din',
      headerName: 'DIN',
      width: 100,
    },
    {
      field: 'brandName',
      headerName: 'Brand Name',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'commonName',
      headerName: 'Common Name',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      cellRenderer: StatusCellRenderer,
    },
    {
      field: 'reasonEn',
      headerName: 'Reason',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'company',
      headerName: 'Company',
      flex: 1,
      minWidth: 150,
      valueFormatter: (params) => toTitleCase(params.value),
    },
    {
      field: 'tier3',
      headerName: 'Tier 3',
      width: 80,
      cellRenderer: (params: { value: boolean | null }) => <BooleanCellRenderer value={params.value} label="Tier 3" />,
    },
    {
      field: 'lateSubmission',
      headerName: 'Late',
      width: 70,
      cellRenderer: (params: { value: boolean | null }) => <BooleanCellRenderer value={params.value} label="Late" />,
    },
    {
      headerName: 'Start Date',
      width: 120,
      valueGetter: (params) => {
        const status = params.data?.status;
        const isDiscontinuation = ['to_be_discontinued', 'discontinued', 'reversed'].includes(status || '');
        if (isDiscontinuation) {
          // Try discontinuationDate first, then anticipatedDiscontinuationDate
          return params.data?.discontinuationDate || params.data?.anticipatedDiscontinuationDate || null;
        }
        return params.data?.actualStartDate;
      },
      cellRenderer: (params: { value: string | null }) => {
        if (!params.value) return <span className="text-muted-foreground">Unknown</span>;
        return formatDate(params.value);
      },
    },
    {
      headerName: 'Est. End',
      width: 120,
      valueGetter: (params) => {
        const status = params.data?.status;
        const isDiscontinuation = ['to_be_discontinued', 'discontinued', 'reversed'].includes(status || '');
        return isDiscontinuation ? 'N/A' : params.data?.estimatedEndDate;
      },
      cellRenderer: (params: { value: string | null }) => {
        if (params.value === 'N/A') return <span className="text-muted-foreground">N/A</span>;
        if (!params.value) return <span className="text-muted-foreground">Unknown</span>;
        return formatDate(params.value);
      },
    },
    {
      field: 'apiCreatedDate',
      headerName: 'Created',
      width: 120,
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      field: 'apiUpdatedDate',
      headerName: 'Updated',
      width: 120,
      valueFormatter: (params) => formatDate(params.value),
    },
  ], []);

  // Default column properties
  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  // Fetch reports when dateRange or typeFilter changes (server-side filtering)
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchReports() {
      try {
        setLoading(true);
        const sinceDate = getSinceDate(dateRange);
        const params = new URLSearchParams();
        if (sinceDate) params.set('since', sinceDate);
        if (typeFilter !== 'all') params.set('type', typeFilter);
        const url = `/api/reports${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url, {
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch reports: ${response.statusText}`);
        }
        const data = await response.json();
        // Validate response structure
        if (!data.rows || !Array.isArray(data.rows)) {
          throw new Error('Invalid API response: missing rows array');
        }
        setRowData(data.rows);
      } catch (err) {
        // Ignore abort errors (component unmounted)
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to fetch reports');
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }
    fetchReports();

    return () => {
      abortController.abort();
    };
  }, [dateRange, typeFilter]);

  // Handle row click - navigate to report detail page
  const onRowClicked = (event: { data: Report | undefined }) => {
    if (event.data?.reportId) {
      router.push(`/reports/${event.data.reportId}`);
    }
  };

  // Update displayed row count and pagination when filter changes
  const onFilterChanged = useCallback(() => {
    if (gridRef.current?.api) {
      setDisplayedRowCount(gridRef.current.api.getDisplayedRowCount());
      setCurrentPage(gridRef.current.api.paginationGetCurrentPage());
      setTotalPages(gridRef.current.api.paginationGetTotalPages());
    }
  }, []);

  // Update pagination state when page changes
  const onPaginationChanged = useCallback(() => {
    if (gridRef.current?.api) {
      setCurrentPage(gridRef.current.api.paginationGetCurrentPage());
      setTotalPages(gridRef.current.api.paginationGetTotalPages());
      setDisplayedRowCount(gridRef.current.api.getDisplayedRowCount());
    }
  }, []);

  // Handle page size change
  const handlePageSizeChange = useCallback((newSize: number | 'all') => {
    if (!gridRef.current?.api) return;
    if (newSize === 'all') {
      // Set to a very large number to show all rows
      gridRef.current.api.setGridOption('paginationPageSize', 999999);
      setPageSize(999999);
    } else {
      gridRef.current.api.setGridOption('paginationPageSize', newSize);
      setPageSize(newSize);
    }
  }, []);

  // External filter: check if filter is present (AG Grid pattern)
  // Note: typeFilter is handled server-side for better performance
  const isExternalFilterPresent = useCallback(() => {
    return statusFilters.length > 0 || tier3Only;
  }, [statusFilters, tier3Only]);

  // External filter: check if row passes filter (AG Grid pattern)
  const doesExternalFilterPass = useCallback((node: IRowNode<Report>) => {
    if (!node.data) return true;

    // Check tier3 filter
    if (tier3Only && !node.data.tier3) return false;

    // Check status filter
    if (statusFilters.length > 0) {
      if (node.data.status === null || !statusFilters.includes(node.data.status)) return false;
    }

    return true;
  }, [statusFilters, tier3Only]);


  // Notify grid when external filter changes
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.onFilterChanged();
    }
  }, [statusFilters, tier3Only]);

  // Check if any filters are active (for count text)
  const hasActiveFilters = searchText.length > 0 || statusFilters.length > 0 || tier3Only || typeFilter !== 'all';

  // Create theme with dark mode support and app branding
  const theme = useMemo(() => {
    const isDark = resolvedTheme === 'dark';
    const colorScheme = isDark ? colorSchemeDark : colorSchemeLight;

    return themeQuartz
      .withPart(colorScheme)
      .withParams({
        // Brand color - teal from app theme
        accentColor: isDark ? '#14b8a6' : '#0d9488',

        // Typography - use app font
        fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',

        // Borders - match app border radius
        borderRadius: 6,
        wrapperBorderRadius: 0,
        wrapperBorder: false,

        // Background - darker in dark mode
        backgroundColor: isDark ? '#0f1214' : '#ffffff',

        // Row hover - subtle teal tint
        rowHoverColor: isDark
          ? 'rgba(20, 184, 166, 0.08)'
          : 'rgba(13, 148, 136, 0.06)',

        // Selected row - teal highlight
        selectedRowBackgroundColor: isDark
          ? 'rgba(20, 184, 166, 0.15)'
          : 'rgba(13, 148, 136, 0.12)',

        // Header styling - slightly elevated
        headerBackgroundColor: isDark
          ? 'rgba(255, 255, 255, 0.03)'
          : 'rgba(0, 0, 0, 0.02)',
        headerFontWeight: 600,

        // Spacing - slightly more compact
        spacing: 6,
      });
  }, [resolvedTheme]);

  // Filtered count text - use displayedRowCount when filters active, otherwise rowData.length
  const countText = useMemo(() => {
    if (loading) return 'Loading...';
    // When filters are active and we have a valid displayed count, show filtered count
    if (hasActiveFilters && displayedRowCount > 0 && displayedRowCount !== rowData.length) {
      return `${displayedRowCount.toLocaleString()} of ${rowData.length.toLocaleString()} reports`;
    }
    return `${rowData.length.toLocaleString()} shortage reports`;
  }, [loading, hasActiveFilters, displayedRowCount, rowData.length]);

  // Early returns AFTER all hooks
  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Error loading reports</h2>
          <p className="text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    );
  }

  // Show skeleton while initially loading (before data arrives)
  if (loading && rowData.length === 0) {
    return <ReportsPageSkeleton />;
  }

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-6rem)]">
      {/* Header - title and count on one line */}
      <div className="flex items-baseline justify-between flex-shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Shortage reports</h1>
        <p className="text-sm text-muted-foreground">{countText}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-shrink-0">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
          />
          <input
            type="text"
            placeholder="Search anything to filter the table..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-10 pr-10 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-2">
          <NativeSelect
            size="sm"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <NativeSelectOption value="thisYear">This year</NativeSelectOption>
            <NativeSelectOption value="lastYear">Last year</NativeSelectOption>
            <NativeSelectOption value="3years">Last 3 years</NativeSelectOption>
            <NativeSelectOption value="5years">Last 5 years</NativeSelectOption>
            <NativeSelectOption value="all">All time</NativeSelectOption>
          </NativeSelect>
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Funnel size={14} />
            Status:
          </span>

          {/* All button - clears other selections */}
          <button
            onClick={() => setStatusFilters([])}
            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
              statusFilters.length === 0
                ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                : 'bg-secondary/50 text-secondary-foreground border-border hover:bg-secondary'
            }`}
          >
            All
          </button>

          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const isSelected = statusFilters.includes(status);
            return (
              <button
                key={status}
                onClick={() => {
                  if (isSelected) {
                    setStatusFilters(statusFilters.filter(s => s !== status));
                  } else {
                    setStatusFilters([...statusFilters, status]);
                  }
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                  isSelected
                    ? `${config.filterClass} ring-2 ring-offset-1 ring-offset-background ring-primary/50`
                    : 'bg-secondary/50 text-secondary-foreground border-border hover:bg-secondary'
                }`}
              >
                {config.label}
              </button>
            );
          })}

          {/* Tier 3 toggle */}
          <div className="h-4 w-px bg-border mx-1" />
          <button
            onClick={() => setTier3Only(!tier3Only)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
              tier3Only
                ? 'bg-red-600 text-white border-red-600 dark:bg-red-500 dark:border-red-500'
                : 'bg-secondary/50 text-secondary-foreground border-border hover:bg-secondary'
            }`}
          >
            Tier 3
          </button>

          {/* Type filter */}
          <div className="h-4 w-px bg-border mx-1" />
          <NativeSelect
            size="sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'shortage' | 'discontinuation' | 'all')}
          >
            <NativeSelectOption value="all">All types</NativeSelectOption>
            <NativeSelectOption value="shortage">Shortages only</NativeSelectOption>
            <NativeSelectOption value="discontinuation">Discontinuations only</NativeSelectOption>
          </NativeSelect>

          {/* Reset filters button (only when any filter is active) */}
          {(searchText || statusFilters.length > 0 || tier3Only || typeFilter !== 'all') && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setSearchText('');
                setStatusFilters([]);
                setTier3Only(false);
                setTypeFilter('all');
              }}
            >
              <X size={12} />
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 w-full rounded-lg border overflow-hidden">
        {mounted && (
          <AgGridReact<Report>
            key={resolvedTheme} // Force remount on theme change for proper styling
            ref={gridRef}
            theme={theme}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            loading={loading}
            onRowClicked={onRowClicked}
            onFilterChanged={onFilterChanged}
            onGridReady={onFilterChanged}
            onPaginationChanged={onPaginationChanged}
            // Quick filter (search) - AG Grid recommended approach
            quickFilterText={searchText}
            cacheQuickFilter={true}
            // External filter (status) - AG Grid recommended approach
            isExternalFilterPresent={isExternalFilterPresent}
            doesExternalFilterPass={doesExternalFilterPass}
            // Selection & pagination
            rowSelection={{ mode: 'singleRow', checkboxes: false }}
            pagination={true}
            paginationPageSize={pageSize}
            suppressPaginationPanel={true}
            getRowId={(params) => String(params.data.reportId)}
            suppressCellFocus={true}
          />
        )}
      </div>

      {/* Custom Pagination */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        {/* Page size selector - left (min-width to prevent layout shift) */}
        <div className="flex items-center gap-2 min-w-[180px]">
          <span className="text-sm text-muted-foreground">Show</span>
          <NativeSelect
            size="sm"
            value={pageSize >= 999999 ? 'all' : pageSize}
            onChange={(e) => handlePageSizeChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <NativeSelectOption value={25}>25</NativeSelectOption>
            <NativeSelectOption value={50}>50</NativeSelectOption>
            <NativeSelectOption value={100}>100</NativeSelectOption>
            <NativeSelectOption value={200}>200</NativeSelectOption>
            <NativeSelectOption value={1000}>1000</NativeSelectOption>
            <NativeSelectOption value="all">All</NativeSelectOption>
          </NativeSelect>
          <span className="text-sm text-muted-foreground">rows</span>
        </div>

        {/* Navigation controls - center */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => gridRef.current?.api?.paginationGoToFirstPage()}
            disabled={currentPage === 0}
            title="First page"
          >
            <CaretDoubleLeft size={16} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => gridRef.current?.api?.paginationGoToPreviousPage()}
            disabled={currentPage === 0}
            title="Previous page"
          >
            <CaretLeft size={16} />
            Prev
          </Button>
          <span className="px-3 text-sm text-muted-foreground tabular-nums">
            Page <span className="font-medium text-foreground">{currentPage + 1}</span> of <span className="font-medium text-foreground">{totalPages || 1}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => gridRef.current?.api?.paginationGoToNextPage()}
            disabled={currentPage >= totalPages - 1}
            title="Next page"
          >
            Next
            <CaretRight size={16} />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => gridRef.current?.api?.paginationGoToLastPage()}
            disabled={currentPage >= totalPages - 1}
            title="Last page"
          >
            <CaretDoubleRight size={16} />
          </Button>
        </div>

        {/* Row count - right (min-width to prevent layout shift) */}
        <div className="text-sm text-muted-foreground min-w-[180px] text-right tabular-nums">
          {(() => {
            const start = currentPage * pageSize + 1;
            const end = Math.min((currentPage + 1) * pageSize, displayedRowCount);
            if (pageSize >= 999999 || displayedRowCount <= pageSize) {
              return `${displayedRowCount.toLocaleString()} rows`;
            }
            return `${start.toLocaleString()} – ${end.toLocaleString()} of ${displayedRowCount.toLocaleString()}`;
          })()}
        </div>
      </div>
    </div>
  );
}
