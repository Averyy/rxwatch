import { Skeleton } from '@/components/ui/skeleton';

export default function DrugDetailLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Skeleton className="h-9 w-36" />

      {/* Hero skeleton */}
      <div className="rounded-xl border-2 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 flex-1">
            <Skeleton className="h-9 w-80" />
            <Skeleton className="h-5 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Report History skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-7 w-44" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="relative pl-6">
              <div className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full bg-muted" />
              <div className="p-4 rounded-lg border space-y-2">
                <div className="flex justify-between">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alternatives skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-36" />
        <div className="rounded-xl border p-4 space-y-2">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-5 w-5" />
          </div>
        </div>
        <div className="rounded-xl border p-4 space-y-2">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Drug Details skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-32" />
        <div className="rounded-xl border p-6 space-y-4">
          <Skeleton className="h-4 w-32" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
          <Skeleton className="h-4 w-24 mt-2" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
