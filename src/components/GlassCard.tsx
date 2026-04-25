import type { ReactNode } from 'react'
import { cn } from '../core/utils/cn'

export function GlassCard({
  children,
  className,
  variant = 'default',
}: {
  children: ReactNode
  className?: string
  variant?: 'default' | 'strong'
}) {
  return (
    <div
      className={cn(
        variant === 'strong' ? 'glass-card-strong' : 'glass-card',
        className,
      )}
    >
      {children}
    </div>
  )
}

