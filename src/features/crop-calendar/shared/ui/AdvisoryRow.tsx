import type { ReactNode } from 'react'
import { cn } from '../../../../core/utils/cn'
import { theme } from '../theme'

interface AdvisoryRowProps {
  category: string
  message: string
  dateDetails?: string
  severity?: 'info' | 'warning' | 'danger' | 'success'
  icon?: ReactNode
}

export function AdvisoryRow({
  category,
  message,
  dateDetails,
  severity = 'info',
  icon
}: AdvisoryRowProps) {
  const severityStyle = theme.colors.advisory[severity]

  return (
    <div className={cn(
      "flex items-start gap-3 p-4 rounded-2xl border text-xs font-semibold leading-relaxed transition-all",
      severityStyle
    )}>
      {icon && (
        <div className="shrink-0 p-1.5 rounded-lg bg-white/5 flex items-center justify-center">
          {icon}
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className="font-extrabold uppercase text-[10px] tracking-wider opacity-45">
            {category}
          </span>
          {dateDetails && (
            <span className="text-[10px] opacity-35 font-medium">{dateDetails}</span>
          )}
        </div>
        <p className="mt-1 text-white/80 font-medium">{message}</p>
      </div>
    </div>
  )
}
