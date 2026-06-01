import type { ReactNode } from 'react'

interface EmptyStateProps {
  message: string
  description?: string
  icon?: ReactNode
}

export function EmptyState({ message, description, icon }: EmptyStateProps) {
  return (
    <div className="h-36 border border-white/5 bg-white/2 rounded-2xl flex flex-col items-center justify-center text-center p-5 text-white/30">
      {icon && <div className="mb-2 opacity-40">{icon}</div>}
      <p className="text-xs font-bold text-white/60 tracking-wide">{message}</p>
      {description && (
        <p className="text-[10px] text-white/25 mt-1 font-medium max-w-sm px-4">
          {description}
        </p>
      )}
    </div>
  )
}
