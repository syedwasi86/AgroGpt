import { Skeleton } from '../../../../components/Skeleton'
import { cn } from '../../../../core/utils/cn'

interface SkeletonLoaderProps {
  className?: string
  rows?: number
}

export function SkeletonLoader({ className, rows = 3 }: SkeletonLoaderProps) {
  return (
    <div className={cn("animate-pulse space-y-3", className)}>
      {Array.from({ length: rows }).map((_, idx) => (
        <Skeleton key={idx} className={cn(
          "h-4 bg-white/5 rounded-xl",
          idx === 0 ? "w-1/3" : idx === 1 ? "w-2/3" : "w-1/2"
        )} />
      ))}
    </div>
  )
}

export function SkeletonAdvisoryCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
