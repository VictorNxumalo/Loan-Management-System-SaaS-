import { cn } from '@/lib/utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('lms-shimmer rounded-md', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="lms-surface space-y-4 p-6">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-full" />
      {Array.from({ length: rows - 1 }).map((_, index) => (
        <Skeleton key={index} className="h-4 w-5/6" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="lms-surface overflow-hidden">
      <div className="border-b bg-muted/40 px-4 py-3">
        <Skeleton className="h-4 w-1/4" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex gap-4 border-b px-4 py-3 last:border-0">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function KpiSkeletonGrid({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="lms-surface p-6 space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
