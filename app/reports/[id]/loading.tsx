import { Skeleton } from '@/components/ui/skeleton';

export default function ReportDetailLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Skeleton className="h-9 w-40" />

      {/* Report Header skeleton */}
      <div className="rounded-xl border-2 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 flex-1">
            {/* Type and ID */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
            {/* Drug name */}
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-5 w-48" />
            {/* Tags */}
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
          {/* Status badge */}
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>

        {/* Key dates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          <div className="rounded-lg bg-muted/50 p-3.5 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="rounded-lg bg-muted/50 p-3.5 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="rounded-lg bg-muted/50 p-3.5 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-full" />
          </div>
        </div>
      </div>

      {/* Linked Drug Card skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-36" />
        </div>
        <div className="p-4 rounded-lg border space-y-2">
          <div className="flex justify-between items-center">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-36" />
              <div className="flex gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Report Details skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="rounded-xl border p-6 space-y-4">
          {/* Section header */}
          <Skeleton className="h-3 w-32" />
          {/* Detail rows */}
          {[...Array(7)].map((_, i) => (
            <div key={`section1-${i}`} className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
          {/* Section header */}
          <Skeleton className="h-3 w-48 mt-2" />
          {/* Detail rows */}
          {[...Array(8)].map((_, i) => (
            <div key={`section2-${i}`} className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
          {/* Section header */}
          <Skeleton className="h-3 w-24 mt-2" />
          {/* Detail rows */}
          {[...Array(4)].map((_, i) => (
            <div key={`section3-${i}`} className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* External link skeleton */}
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}
