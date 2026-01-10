'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, AlertCircle, Pill, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DrugResult {
  din: string;
  brandName: string | null;
  commonName: string | null;
  activeIngredient: string | null;
  strength: string | null;
  strengthUnit: string | null;
  form: string | null;
  company: string | null;
  currentStatus: string | null;
  hasReports: boolean | null;
}

interface ReportResult {
  reportId: number;
  din: string | null;
  brandName: string | null;
  type: 'shortage' | 'discontinuation';
  status: string;
  company: string | null;
  apiUpdatedDate: string | null;
}

interface DrugSearchProps {
  variant?: 'hero' | 'header';
  placeholder?: string;
  className?: string;
  onSearch?: (query: string) => void;
}

// Status badge configuration for drugs
const drugStatusConfig: Record<string, { label: string; className: string }> = {
  in_shortage: {
    label: 'Shortage',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
  anticipated: {
    label: 'Anticipated',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  to_be_discontinued: {
    label: 'Pending',
    className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  },
  discontinued: {
    label: 'Discontinued',
    className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  },
};

// Status badge configuration for reports
const reportStatusConfig: Record<string, { label: string; className: string }> = {
  active_confirmed: {
    label: 'Active',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  },
  anticipated_shortage: {
    label: 'Anticipated',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  },
  avoided_shortage: {
    label: 'Avoided',
    className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  },
  to_be_discontinued: {
    label: 'Pending',
    className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  },
  discontinued: {
    label: 'Discontinued',
    className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  },
  reversed: {
    label: 'Reversed',
    className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  },
};

export function DrugSearch({
  variant = 'header',
  placeholder = 'Search by drug name, DIN, or ingredient...',
  className,
}: DrugSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [drugResults, setDrugResults] = useState<DrugResult[]>([]);
  const [reportResults, setReportResults] = useState<ReportResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);

  // Calculate total results for keyboard navigation
  const totalResults = drugResults.length + reportResults.length;

  // Global keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Debounced search with abort controller
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setDrugResults([]);
      setReportResults([]);
      setShowResults(false);
      setHasSearched(false);
      setSelectedIndex(-1);
      return;
    }

    const abortController = new AbortController();

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=8`, {
          signal: abortController.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setDrugResults(data.drugs || []);
          setReportResults(data.reports || []);
          setShowResults(true);
          setHasSearched(true);
          setSelectedIndex(-1);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Search error:', err);
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [searchQuery]);

  // Navigate to search results
  const navigateToResults = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setShowResults(false);
    setSearchQuery('');
    setSelectedIndex(-1);

    if (/^\d{8}$/.test(trimmed)) {
      // Exact DIN - go to drug detail page
      router.push(`/drugs/${trimmed}`);
    } else {
      // Text search - go to drugs list with filter
      router.push(`/drugs?search=${encodeURIComponent(trimmed)}`);
    }
  }, [router]);

  // Handle search submit
  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    if (selectedIndex >= 0 && selectedIndex < totalResults) {
      // Navigate to selected result
      setShowResults(false);
      setSearchQuery('');
      setSelectedIndex(-1);

      if (selectedIndex < drugResults.length) {
        // It's a drug result
        router.push(`/drugs/${drugResults[selectedIndex].din}`);
      } else {
        // It's a report result
        const reportIndex = selectedIndex - drugResults.length;
        router.push(`/reports/${reportResults[reportIndex].reportId}`);
      }
    } else if (searchQuery.trim()) {
      navigateToResults(searchQuery);
    }
  }, [searchQuery, router, selectedIndex, drugResults, reportResults, totalResults, navigateToResults]);

  // Handle clicking a drug result
  const handleDrugClick = useCallback((din: string) => {
    setShowResults(false);
    setSearchQuery('');
    setSelectedIndex(-1);
    router.push(`/drugs/${din}`);
  }, [router]);

  // Handle clicking a report result
  const handleReportClick = useCallback((reportId: number) => {
    setShowResults(false);
    setSearchQuery('');
    setSelectedIndex(-1);
    router.push(`/reports/${reportId}`);
  }, [router]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        if (showResults && totalResults > 0) {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < totalResults - 1 ? prev + 1 : prev
          );
        }
        break;
      case 'ArrowUp':
        if (showResults && totalResults > 0) {
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        }
        break;
      case 'Escape':
        if (showResults) {
          e.preventDefault();
          setShowResults(false);
          setSelectedIndex(-1);
        }
        break;
    }
  }, [showResults, totalResults]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const isHero = variant === 'hero';
  const hasResults = drugResults.length > 0 || reportResults.length > 0;

  return (
    <div className={cn('relative', className)}>
      <form onSubmit={handleSearchSubmit}>
        <div className="relative">
          <Search className={cn(
            'absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none',
            isHero ? 'left-4 h-5 w-5' : 'left-2.5 h-4 w-4'
          )} />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            className={cn(
              isHero
                ? 'pl-12 pr-14 h-14 text-lg rounded-xl shadow-sm'
                : 'pl-8 pr-14 h-9'
            )}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (hasResults || hasSearched) {
                setShowResults(true);
              }
            }}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            onKeyDown={handleKeyDown}
            aria-expanded={showResults}
            aria-haspopup="listbox"
            aria-controls="search-results"
            aria-activedescendant={selectedIndex >= 0 ? `result-${selectedIndex}` : undefined}
          />
          {/* Keyboard shortcut hint or loading spinner */}
          <div className={cn(
            'absolute top-1/2 -translate-y-1/2 pointer-events-none',
            isHero ? 'right-4' : 'right-2.5'
          )}>
            {isSearching ? (
              <Loader2 className={cn(
                'animate-spin text-muted-foreground',
                isHero ? 'h-5 w-5' : 'h-4 w-4'
              )} />
            ) : !searchQuery ? (
              <kbd className={cn(
                'font-mono bg-muted text-muted-foreground rounded border border-border select-none',
                isHero ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]'
              )}>
                ⌘ K
              </kbd>
            ) : null}
          </div>
        </div>
      </form>

      {/* Search Results Dropdown */}
      {showResults && (
        <div
          ref={dropdownRef}
          id="search-results"
          role="listbox"
          className={cn(
            'absolute top-full left-0 right-0 mt-2 bg-popover border shadow-lg z-50 overflow-hidden',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            isHero ? 'rounded-xl' : 'rounded-lg'
          )}
        >
          {hasResults ? (
            <>
              <div className={cn('max-h-80 overflow-y-auto', isHero ? 'max-h-96' : '')}>
                {/* Drug Results */}
                {drugResults.length > 0 && (
                  <>
                    <div className={cn(
                      'flex items-center gap-2 text-muted-foreground border-b bg-muted/30',
                      isHero ? 'px-4 py-2 text-xs' : 'px-3 py-1.5 text-[10px]'
                    )}>
                      <Pill className="h-3 w-3" />
                      <span className="font-medium uppercase tracking-wider">Drugs</span>
                    </div>
                    {drugResults.map((result, index) => (
                      <button
                        key={`drug-${result.din}`}
                        id={`result-${index}`}
                        data-index={index}
                        role="option"
                        aria-selected={selectedIndex === index}
                        className={cn(
                          'w-full text-left transition-colors border-b last:border-b-0 flex items-center justify-between gap-4',
                          'focus:outline-none',
                          isHero ? 'px-4 py-3' : 'px-3 py-2',
                          selectedIndex === index
                            ? 'bg-primary/10 text-foreground'
                            : 'hover:bg-muted'
                        )}
                        onClick={() => handleDrugClick(result.din)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className={cn('font-medium truncate', !isHero && 'text-sm')}>
                            {result.brandName || result.commonName || result.din}
                          </div>
                          <div className={cn('text-muted-foreground truncate', isHero ? 'text-sm' : 'text-xs')}>
                            DIN: {result.din} {result.activeIngredient && `• ${result.activeIngredient}`}
                            {result.strength && ` ${result.strength}${result.strengthUnit || ''}`}
                          </div>
                        </div>
                        {result.currentStatus && result.currentStatus !== 'available' && drugStatusConfig[result.currentStatus] && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'shrink-0 border',
                              drugStatusConfig[result.currentStatus].className,
                              !isHero && 'text-xs'
                            )}
                          >
                            {drugStatusConfig[result.currentStatus].label}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </>
                )}

                {/* Report Results */}
                {reportResults.length > 0 && (
                  <>
                    <div className={cn(
                      'flex items-center gap-2 text-muted-foreground border-b bg-muted/30',
                      isHero ? 'px-4 py-2 text-xs' : 'px-3 py-1.5 text-[10px]'
                    )}>
                      <FileText className="h-3 w-3" />
                      <span className="font-medium uppercase tracking-wider">Reports</span>
                    </div>
                    {reportResults.map((result, index) => {
                      const globalIndex = drugResults.length + index;
                      return (
                        <button
                          key={`report-${result.reportId}`}
                          id={`result-${globalIndex}`}
                          data-index={globalIndex}
                          role="option"
                          aria-selected={selectedIndex === globalIndex}
                          className={cn(
                            'w-full text-left transition-colors border-b last:border-b-0 flex items-center justify-between gap-4',
                            'focus:outline-none',
                            isHero ? 'px-4 py-3' : 'px-3 py-2',
                            selectedIndex === globalIndex
                              ? 'bg-primary/10 text-foreground'
                              : 'hover:bg-muted'
                          )}
                          onClick={() => handleReportClick(result.reportId)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className={cn('font-medium truncate', !isHero && 'text-sm')}>
                              {result.brandName || `Report #${result.reportId}`}
                            </div>
                            <div className={cn('text-muted-foreground truncate', isHero ? 'text-sm' : 'text-xs')}>
                              #{result.reportId} {result.din && `• DIN: ${result.din}`}
                              {result.type && ` • ${result.type === 'shortage' ? 'Shortage' : 'Discontinuation'}`}
                            </div>
                          </div>
                          {result.status && reportStatusConfig[result.status] && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'shrink-0 border',
                                reportStatusConfig[result.status].className,
                                !isHero && 'text-xs'
                              )}
                            >
                              {reportStatusConfig[result.status].label}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
              <div className={cn(
                'bg-muted/30 text-muted-foreground border-t',
                isHero ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'
              )}>
                <span className="opacity-70">Press</span>{' '}
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[0.7em] font-mono">Enter</kbd>{' '}
                <span className="opacity-70">to see all results</span>
              </div>
            </>
          ) : hasSearched && !isSearching ? (
            // Empty state
            <div className={cn(
              'flex flex-col items-center justify-center text-center text-muted-foreground',
              isHero ? 'px-6 py-8' : 'px-4 py-6'
            )}>
              <AlertCircle className={cn('mb-2', isHero ? 'h-8 w-8' : 'h-6 w-6')} />
              <p className={cn('font-medium', isHero ? 'text-base' : 'text-sm')}>
                No results found
              </p>
              <p className={cn('mt-1', isHero ? 'text-sm' : 'text-xs')}>
                Try a different drug name, DIN, or ingredient
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
