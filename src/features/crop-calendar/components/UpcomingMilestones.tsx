import { Calendar, Sprout, Wheat } from 'lucide-react'
import { formatUtcToLocal } from '../utils/dateUtils'
import { cn } from '../../../core/utils/cn'
import type { MilestoneItem } from '../selectors'
import { TimelineMarker } from '../shared/ui/TimelineMarker'

interface UpcomingMilestonesProps {
  milestones: MilestoneItem[]
}

export function UpcomingMilestones({ milestones }: UpcomingMilestonesProps) {
  if (milestones.length === 0) {
    return (
      <div className="p-5 border border-white/5 bg-white/2 rounded-2xl text-center text-white/30 text-xs font-semibold">
        No upcoming milestones. Crop lifecycle has reached maturity.
      </div>
    )
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-white/10">
      {milestones.slice(0, 4).map((milestone, idx) => {
        const isNext = idx === 0
        const relativeText = 
          milestone.relativeDays === 0 ? 'Starts today' :
          milestone.relativeDays === 1 ? 'Expected tomorrow' :
          `Expected in ${milestone.relativeDays} days`

        return (
          <div key={idx} className="relative group">
            <TimelineMarker
              active={isNext}
              isLast={idx === milestones.length - 1}
              className="absolute left-[-21px] top-1.5"
            />

            <div className={cn(
              "p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 bg-white/3",
              isNext ? "border-[#87A96B]/20 bg-[#87A96B]/5" : "border-white/5 hover:border-white/10 hover:bg-white/5"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-xl border flex items-center justify-center shrink-0",
                  milestone.isHarvest 
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                    : "bg-white/5 border-white/10 text-white/50"
                )}>
                  {milestone.isHarvest ? <Wheat size={14} /> : <Sprout size={14} />}
                </div>
                <div>
                  <h5 className="font-bold text-white text-xs leading-none">
                    {milestone.name}
                  </h5>
                  <p className={cn(
                    "text-[11px] font-semibold mt-1",
                    isNext ? "text-[#87A96B]" : "text-white/60"
                  )}>
                    {relativeText}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/30 whitespace-nowrap">
                <Calendar size={12} />
                {formatUtcToLocal(milestone.dateStr)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
