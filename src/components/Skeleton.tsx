/** Skeleton shimmer animation for loading states */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-white/8 ${className}`}
      aria-hidden="true"
    />
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/5 p-5 ${className}`}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-3 w-2/3" />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-3 bg-white/5 px-4 py-3">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2 w-1/4" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  )
}
