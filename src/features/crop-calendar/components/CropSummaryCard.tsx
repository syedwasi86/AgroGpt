import { GlassCard } from '../../../components/GlassCard'
import { formatUtcToLocal } from '../utils/dateUtils'
import { Calendar, Sprout, Layers, ShieldCheck } from 'lucide-react'
import type { CropPlanRecord } from '../../../lib/db'

interface CropSummaryCardProps {
  plan: CropPlanRecord
  estimatedHarvestDate: string
  progress: number
}

export function CropSummaryCard({
  plan,
  estimatedHarvestDate,
  progress
}: CropSummaryCardProps) {
  return (
    <GlassCard className="p-6 border-white/5 bg-[#121412]/80 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] rounded-3xl" variant="strong">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-[#87A96B]/25 to-[#87A96B]/5 rounded-2xl border border-[#87A96B]/20">
          <Sprout className="text-[#87A96B]" size={24} />
        </div>
        <div>
          <h4 className="text-lg font-bold text-white leading-tight">{plan.crop_type}</h4>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mt-0.5">{plan.variety}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Fields list */}
        <div className="flex justify-between items-center p-3 bg-white/2 border border-white/5 rounded-2xl">
          <div className="flex items-center gap-2 text-white/40 text-[11px] font-bold uppercase tracking-wider">
            <Calendar size={13} />
            Sowing Date
          </div>
          <span className="text-white font-bold text-xs">{formatUtcToLocal(plan.sowing_date)}</span>
        </div>

        <div className="flex justify-between items-center p-3 bg-white/2 border border-white/5 rounded-2xl">
          <div className="flex items-center gap-2 text-white/40 text-[11px] font-bold uppercase tracking-wider">
            <Layers size={13} />
            Field Acreage
          </div>
          <span className="text-white font-bold text-xs">{plan.area} Acres</span>
        </div>

        <div className="flex justify-between items-center p-3 bg-white/2 border border-white/5 rounded-2xl">
          <div className="flex items-center gap-2 text-white/40 text-[11px] font-bold uppercase tracking-wider">
            <ShieldCheck size={13} className="text-[#87A96B]" />
            Est. Harvest
          </div>
          <span className="text-[#87A96B] font-extrabold text-xs">{formatUtcToLocal(estimatedHarvestDate)}</span>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-white/5">
        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">
          <span>Lifecycle Completion</span>
          <span className="text-white">{progress}%</span>
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-[#6A8E5C] to-[#87A96B] rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(135,169,107,0.3)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </GlassCard>
  )
}
