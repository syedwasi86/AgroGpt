import { Sprout, Leaf, Flower, Wheat, Scissors, User, ArrowRight } from 'lucide-react'
import { GlassCard } from '../../../components/GlassCard'
import { formatUtcToLocal } from '../utils/dateUtils'
import { cn } from '../../../core/utils/cn'
import type { CropStageRecord } from '../../../lib/db'
import { useTranslation } from 'react-i18next'
import { useEnumTranslation } from '../../../hooks/useEnumTranslation'

interface StageTimelineProps {
  stages: CropStageRecord[]
  currentStage?: CropStageRecord
  progress: number
  daysInStage: number
  nextStageEstimate: { name: string; days: number } | null
  isFarmerSelectedStage?: boolean
}

const iconMap = {
  sprout: <Sprout size={16} />,
  leaf: <Leaf size={16} />,
  flower: <Flower size={16} />,
  wheat: <Wheat size={16} />,
  scissors: <Scissors size={16} />
}

export function StageTimeline({
  stages,
  currentStage,
  progress,
  daysInStage,
  nextStageEstimate,
  isFarmerSelectedStage
}: StageTimelineProps) {
  const { t } = useTranslation(['common', 'cropCalendar'])
  const { tEnum } = useEnumTranslation()

  if (stages.length === 0) return null

  const getStageIcon = (name: string, index: number) => {
    const lname = (name || '').toLowerCase()
    if (lname.includes('seed') || lname.includes('germ') || lname.includes('nur')) return iconMap.sprout
    if (lname.includes('veg') || lname.includes('till') || lname.includes('stake')) return iconMap.leaf
    if (lname.includes('flower') || lname.includes('bloom') || lname.includes('fruiting') || lname.includes('squar')) return iconMap.flower
    if (lname.includes('ripen') || lname.includes('grain') || lname.includes('panicle')) return iconMap.wheat
    if (lname.includes('harvest') || lname.includes('pick') || lname.includes('scissors')) return iconMap.scissors
    
    if (index === 0) return iconMap.sprout
    if (index === stages.length - 1) return iconMap.scissors
    if (index === 1) return iconMap.leaf
    return iconMap.flower
  }

  const activeIdx = currentStage ? stages.findIndex(s => s.id === currentStage.id) : -1

  return (
    <div className="w-full lg:sticky lg:top-0 lg:z-30 lg:py-2 transition-all duration-300">
      <GlassCard className="p-6 md:p-8 border-white/5 bg-[#121412]/80 lg:bg-[#121412]/90 backdrop-blur-xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] rounded-3xl" variant="strong">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
          <div>
            <span className="text-[10px] font-bold text-[#87A96B] tracking-[0.2em] uppercase">
              {t('cropCalendar.cropJourney', 'Crop Journey')}
            </span>
            <h2 className="text-xl md:text-2xl font-black text-white leading-tight mt-0.5 flex items-center flex-wrap gap-2">
              <span>
                {currentStage 
                  ? t('cropCalendar.stageTitle', '{{stage}} Stage', { stage: tEnum('cropStage', currentStage.name || currentStage.stage_name || '') })
                  : t('cropCalendar.cropLifecycle', 'Crop Lifecycle')}
              </span>
              {isFarmerSelectedStage && (
                <span className="text-[9px] text-[#87A96B] font-bold bg-[#87A96B]/10 px-2 py-0.5 rounded-full border border-[#87A96B]/20">
                  {t('cropCalendar.farmerSelectedNotice', 'Farmer Selected')}
                </span>
              )}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-white/50">
            <div className="bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-2xl flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#87A96B] rounded-full animate-pulse" />
              <span>
                {t('cropCalendar.daysInCurrentStage', 'Days in current stage: {{days}}', { days: daysInStage })}
              </span>
            </div>

            {nextStageEstimate && (
              <div className="bg-[#87A96B]/10 border border-[#87A96B]/20 text-[#87A96B] px-3.5 py-1.5 rounded-2xl flex items-center gap-1.5">
                <ArrowRight size={14} />
                <span>
                  {t('cropCalendar.nextStageEstimateText', 'Next: {{stage}} in {{days}} days', {
                    stage: tEnum('cropStage', nextStageEstimate.name),
                    days: nextStageEstimate.days
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Progress Timeline */}
        <div className="relative pt-6 pb-8">
          {/* Walking Farmer Position Indicator */}
          <div
            className="absolute top-[-8px] transition-all duration-1000 ease-out z-20 hidden md:block"
            style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
          >
            <div className="flex flex-col items-center">
              <User size={20} className="text-white drop-shadow-[0_0_8px_rgba(135,169,107,0.5)]" />
              <div className="w-px h-6 bg-gradient-to-b from-[#87A96B] to-transparent mt-0.5" />
            </div>
          </div>

          {/* Progress Bar Line */}
          <div className="h-8 w-full bg-[#1b1f1b] rounded-full border border-white/5 relative flex items-center p-1 overflow-visible">
            {/* Active Progress Fill */}
            <div
              className="h-full bg-gradient-to-r from-[#6A8E5C] to-[#87A96B] rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(135,169,107,0.2)]"
              style={{ width: `${progress}%` }}
            />

            {/* Nodes */}
            <div className="absolute inset-0 w-full flex items-center justify-between px-2">
              {stages.map((stage, idx) => {
                const isCompleted = activeIdx === -1 ? false : idx < activeIdx
                const isCurrent = currentStage && stage.id === currentStage.id
                const positionPct = (idx / (stages.length - 1)) * 100

                return (
                  <div
                    key={stage.id}
                    className="absolute"
                    style={{ left: `${positionPct}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-500",
                      isCurrent 
                        ? "bg-[#87A96B] border-white/40 text-white shadow-[0_0_15px_rgba(135,169,107,0.6)] scale-110" 
                        : isCompleted 
                          ? "bg-[#6A8E5C] border-white/10 text-white" 
                          : "bg-[#232723] border-white/5 text-white/30"
                    )}>
                      {getStageIcon(stage.name || stage.stage_name || '', idx)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Labels underneath */}
          <div className="mt-6 flex justify-between text-center relative h-12 w-full text-[9px] uppercase font-bold tracking-wider">
            {stages.map((stage, idx) => {
              const isCurrent = currentStage && stage.id === currentStage.id
              const positionPct = (idx / (stages.length - 1)) * 100

              return (
                <div
                  key={stage.id}
                  className="absolute flex flex-col items-center w-20"
                  style={{ left: `${positionPct}%`, transform: 'translateX(-50%)' }}
                >
                  <span className={cn(
                    "truncate w-full text-center",
                    isCurrent ? "text-[#87A96B] font-black" : "text-white/40"
                  )}>
                    {tEnum('cropStage', stage.name || stage.stage_name || '')}
                  </span>
                  <span className="text-white/20 mt-0.5 font-semibold block lowercase whitespace-nowrap">
                    {formatUtcToLocal(stage.start_date)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
