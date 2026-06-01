import { Loader2 } from 'lucide-react'
import { cn } from '../../../../core/utils/cn'

interface ProgressIndicatorProps {
  className?: string
  size?: number
}

export function ProgressIndicator({ className, size = 18 }: ProgressIndicatorProps) {
  return (
    <div className={cn("flex items-center justify-center p-4", className)}>
      <Loader2 size={size} className="animate-spin text-[#87A96B]" />
    </div>
  )
}
