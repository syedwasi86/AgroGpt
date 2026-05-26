import { cn } from '../../../../core/utils/cn'

interface StatusBadgeProps {
  type: 'priority' | 'status'
  value: string
  className?: string
}

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  const normalizedValue = value.toLowerCase()

  let styles = 'bg-gray-500/10 text-gray-400 border-gray-500/20'

  if (type === 'priority') {
    if (normalizedValue === 'high') {
      styles = 'bg-red-500/10 text-red-400 border-red-500/20'
    } else if (normalizedValue === 'medium') {
      styles = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    } else if (normalizedValue === 'low') {
      styles = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    }
  } else if (type === 'status') {
    if (normalizedValue === 'completed') {
      styles = 'bg-green-500/10 text-green-400 border-green-500/20'
    } else if (normalizedValue === 'rescheduled') {
      styles = 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    } else if (normalizedValue === 'pending') {
      styles = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    } else if (normalizedValue === 'overdue') {
      styles = 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
    }
  }

  return (
    <span className={cn(
      "px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider",
      styles,
      className
    )}>
      {value}
    </span>
  )
}
