import { Suspense } from 'react';
import ReportsPageClient from './ReportsPageClient';
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

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsPageSkeleton />}>
      <ReportsPageClient />
    </Suspense>
  );
}
