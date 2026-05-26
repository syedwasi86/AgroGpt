import type { ReactNode } from 'react'
import { cn } from '../../../../core/utils/cn'

interface SectionContainerProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  actions?: ReactNode
}

export function SectionContainer({
  title,
  subtitle,
  children,
  className,
  actions
}: SectionContainerProps) {
  return (
    <section className={cn("mb-4 md:mb-6", className)}>
      <div className="flex justify-between items-end mb-3 md:mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-lg md:text-xl font-bold tracking-tight text-white/90">
            {title}
          </h3>
          {subtitle && (
            <p className="text-white/40 text-xs mt-0.5 md:mt-1 font-medium">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="w-full">{children}</div>
    </section>
  )
}
