'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Convert ALL CAPS to Title Case
function toTitleCase(str: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Types matching our API response
interface Drug {
  din: string;
  brandName: string | null;
  commonName: string | null;
  activeIngredient: string | null;
  strength: string | null;
  strengthUnit: string | null;
  form: string | null;
  atcCode: string | null;
  company: string | null;
  currentStatus: 'available' | 'in_shortage' | 'anticipated' | 'discontinued' | 'to_be_discontinued' | null;
  marketStatus: string | null;
}

// Status configuration - shared between filter and cell renderer
const STATUS_CONFIG: Record<string, { label: string; className: string; filterClass: string }> = {
  in_shortage: {
    label: 'In Shortage',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    filterClass: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800 dark:hover:bg-red-900',
  },
  anticipated: {
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
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    filterClass: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-800 dark:hover:bg-yellow-900',
  },
  available: {
    label: 'Available',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    filterClass: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-800 dark:hover:bg-green-900',
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

export default function DrugsPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const gridRef = useRef<AgGridReact<Drug>>(null);
  const [rowData, setRowData] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Filter state
  const [searchText, setSearchText] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [displayedRowCount, setDisplayedRowCount] = useState(0);

  // Pagination state
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Wait for client-side mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Column definitions
  const columnDefs = useMemo<ColDef<Drug>[]>(() => [
    {
      field: 'din',
      headerName: 'DIN',
      width: 100,
      pinned: 'left',
    },
    {
      field: 'commonName',
      headerName: 'Common Name',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'brandName',
      headerName: 'Brand Name',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'activeIngredient',
      headerName: 'Active Ingredient',
      flex: 1,
      minWidth: 180,
      valueFormatter: (params) => toTitleCase(params.value),
    },
    {
      field: 'strength',
      headerName: 'Strength',
      width: 100,
      valueGetter: (params) => {
        const strength = params.data?.strength;
        const unit = params.data?.strengthUnit;
        if (!strength) return '';
        return unit ? `${strength} ${unit}` : strength;
      },
    },
    {
      field: 'form',
      headerName: 'Form',
      width: 120,
    },
    {
      field: 'company',
      headerName: 'Company',
      flex: 1,
      minWidth: 150,
      valueFormatter: (params) => toTitleCase(params.value),
    },
    {
      field: 'currentStatus',
      headerName: 'Status',
      width: 140,
      cellRenderer: StatusCellRenderer,
    },
    {
      field: 'atcCode',
      headerName: 'ATC Code',
      width: 110,
    },
  ], []);

  // Default column properties
  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  // Fetch drugs on mount
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchDrugs() {
      try {
        setLoading(true);
        const response = await fetch('/api/drugs?hasReports=true', {
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch drugs: ${response.statusText}`);
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
        setError(err instanceof Error ? err.message : 'Failed to fetch drugs');
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }
    fetchDrugs();

    return () => {
      abortController.abort();
    };
  }, []);

  // Handle row click - navigate to drug detail page
  const onRowClicked = (event: { data: Drug | undefined }) => {
    if (event.data?.din) {
      router.push(`/drugs/${event.data.din}`);
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
  const isExternalFilterPresent = useCallback(() => {
    return statusFilters.length > 0;
  }, [statusFilters]);

  // External filter: check if row passes filter (AG Grid pattern)
  const doesExternalFilterPass = useCallback((node: IRowNode<Drug>) => {
    if (statusFilters.length === 0 || !node.data) return true;
    return node.data.currentStatus !== null && statusFilters.includes(node.data.currentStatus);
  }, [statusFilters]);


  // Notify grid when external filter changes
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.onFilterChanged();
    }
  }, [statusFilters]);

  // Check if any filters are active (for count text)
  const hasActiveFilters = searchText.length > 0 || statusFilters.length > 0;

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

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Error loading drugs</h2>
          <p className="text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    );
  }

  // Filtered count text - use displayedRowCount when filters active, otherwise rowData.length
  const countText = useMemo(() => {
    if (loading) return 'Loading...';
    // When filters are active and we have a valid displayed count, show filtered count
    if (hasActiveFilters && displayedRowCount > 0 && displayedRowCount !== rowData.length) {
      return `${displayedRowCount.toLocaleString()} of ${rowData.length.toLocaleString()} drugs`;
    }
    return `${rowData.length.toLocaleString()} drugs with shortage history`;
  }, [loading, hasActiveFilters, displayedRowCount, rowData.length]);

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-6rem)]">
      {/* Header - title and count on one line */}
      <div className="flex items-baseline justify-between flex-shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Drugs with shortages</h1>
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

          {/* Reset filters button (only when any filter is active) */}
          {(searchText || statusFilters.length > 0) && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setSearchText('');
                setStatusFilters([]);
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
          <AgGridReact<Drug>
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
            getRowId={(params) => params.data.din}
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
