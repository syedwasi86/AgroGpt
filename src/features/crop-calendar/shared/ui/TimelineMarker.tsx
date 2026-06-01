import { cn } from '../../../../core/utils/cn'

interface TimelineMarkerProps {
  active?: boolean
  completed?: boolean
  isLast?: boolean
  className?: string
}

export function TimelineMarker({
  active,
  completed,
  isLast,
  className
}: TimelineMarkerProps) {
  return (
    <div className={cn("flex flex-col items-center relative", className)}>
      <span className={cn(
        "w-3.5 h-3.5 rounded-full border transition-all flex items-center justify-center z-10",
        active 
          ? "bg-[#87A96B] border-[#87A96B] shadow-[0_0_8px_rgba(135,169,107,0.5)] scale-110"
          : completed 
            ? "bg-[#6A8E5C] border-[#6A8E5C]"
            : "bg-[#121412] border-white/20"
      )}>
        {active && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
      </span>
      {!isLast && (
        <span className="w-px h-10 bg-white/10 absolute top-3.5 left-[6.5px]" />
      )}
    </div>
  )
}
