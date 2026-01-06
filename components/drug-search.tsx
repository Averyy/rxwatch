'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SearchResult {
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

interface DrugSearchProps {
  variant?: 'hero' | 'header';
  placeholder?: string;
  className?: string;
  onSearch?: (query: string) => void;
}

export function DrugSearch({
  variant = 'header',
  placeholder = 'Search by drug name, DIN, or ingredient...',
  className,
}: DrugSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounced search with abort controller
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
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
          setSearchResults(data.drugs || []);
          setShowResults(true);
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

  // Handle search submit
  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowResults(false);
      if (/^\d{8}$/.test(searchQuery.trim())) {
        router.push(`/drugs/${searchQuery.trim()}`);
      } else {
        router.push(`/drugs?search=${encodeURIComponent(searchQuery.trim())}`);
      }
    }
  }, [searchQuery, router]);

  // Handle clicking a search result
  const handleResultClick = useCallback((din: string) => {
    setShowResults(false);
    setSearchQuery('');
    router.push(`/drugs/${din}`);
  }, [router]);

  const isHero = variant === 'hero';

  return (
    <div className={cn('relative', className)}>
      <form onSubmit={handleSearchSubmit}>
        <div className="relative">
          <Search className={cn(
            'absolute top-1/2 -translate-y-1/2 text-muted-foreground',
            isHero ? 'left-4 h-5 w-5' : 'left-2.5 h-4 w-4'
          )} />
          <Input
            ref={inputRef}
            type="search"
            placeholder={placeholder}
            className={cn(
              isHero ? 'pl-12 pr-4 h-14 text-lg rounded-xl shadow-sm' : 'pl-8 h-9'
            )}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
          />
          {isSearching && (
            <Loader2 className={cn(
              'absolute top-1/2 -translate-y-1/2 animate-spin text-muted-foreground',
              isHero ? 'right-4 h-5 w-5' : 'right-2.5 h-4 w-4'
            )} />
          )}
        </div>
      </form>

      {/* Search Results Dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className={cn(
          'absolute top-full left-0 right-0 mt-2 bg-background border shadow-lg z-50 overflow-hidden',
          isHero ? 'rounded-xl' : 'rounded-lg'
        )}>
          {searchResults.map((result) => (
            <button
              key={result.din}
              className={cn(
                'w-full text-left hover:bg-muted/50 transition-colors border-b last:border-b-0 flex items-center justify-between gap-4',
                isHero ? 'px-4 py-3' : 'px-3 py-2'
              )}
              onClick={() => handleResultClick(result.din)}
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
              {result.currentStatus && result.currentStatus !== 'available' && (
                <Badge
                  variant={result.currentStatus === 'in_shortage' ? 'destructive' : 'secondary'}
                  className={cn('shrink-0', !isHero && 'text-xs')}
                >
                  {result.currentStatus === 'in_shortage' ? 'Shortage' :
                   result.currentStatus === 'anticipated' ? 'Anticipated' :
                   result.currentStatus === 'to_be_discontinued' ? 'Pending' :
                   result.currentStatus === 'discontinued' ? 'Discontinued' : result.currentStatus}
                </Badge>
              )}
            </button>
          ))}
          <div className={cn(
            'bg-muted/30 text-muted-foreground',
            isHero ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'
          )}>
            Press Enter to see all results
          </div>
        </div>
      )}
    </div>
  );
}
