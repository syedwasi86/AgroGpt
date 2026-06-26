import { CheckCircle2, AlertCircle, Droplets, Info } from 'lucide-react'
import { GlassCard } from '../../../components/GlassCard'
import type { FarmTaskRecord } from '../../../lib/db'
import type { WeatherAlert } from '../engines/weatherAdjustmentEngine'
import { useTranslation } from 'react-i18next'

interface QuickInsightsProps {
  tasks: FarmTaskRecord[]
  weatherAlerts: WeatherAlert[]
}

export function QuickInsights({ tasks, weatherAlerts }: QuickInsightsProps) {
  const { t } = useTranslation(['common', 'cropCalendar'])
  const pending = tasks.filter(tVal => tVal.status !== 'completed' && !tVal.deleted_at)
  const overdueCount = pending.filter(tVal => tVal.status === 'overdue' || new Date(tVal.effective_date) < new Date()).length
  
  const hasRain = weatherAlerts.some(a => a.type === 'irrigation_delay')
  const hasHumidity = weatherAlerts.some(a => a.type === 'disease_warning')

  // Generate lightweight observational agronomic chips
  const insights = [
    {
      text: overdueCount > 0 
        ? t('cropCalendar.insights.overdueAlert', 'Action required: Resolving overdue tasks will ensure growth yields stay on target.')
        : t('cropCalendar.insights.onTrack', 'Agronomic progress: Crop canopy development is currently on track.'),
      icon: overdueCount > 0 
        ? <AlertCircle size={14} className="text-yellow-400" />
        : <CheckCircle2 size={14} className="text-[#87A96B]" />
    },
    {
      text: hasRain 
        ? t('cropCalendar.insights.rainReducedIrrigation', 'Moisture balance: Natural precipitation has temporarily reduced irrigation demand.')
        : t('cropCalendar.insights.moistureOptimal', 'Moisture balance: Soil hydration levels are currently within target thresholds.'),
      icon: <Droplets size={14} className="text-blue-400" />
    },
    {
      text: hasHumidity
        ? t('cropCalendar.insights.highHumidityWarning', 'Microclimate: High relative humidity increases spore germination risks. Inspect fields daily.')
        : t('cropCalendar.insights.microclimateStable', 'Microclimate: Local transpiration and ambient ventilation indices are stable.'),
      icon: <Info size={14} className="text-white/30" />
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {insights.map((insight, idx) => (
        <GlassCard 
          key={idx} 
          className="p-4 border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/10 transition-all flex items-start gap-2.5 rounded-2xl"
        >
          <div className="mt-0.5 shrink-0">
            {insight.icon}
          </div>
          <p className="text-[11px] font-semibold text-white/70 leading-relaxed">
            {insight.text}
          </p>
        </GlassCard>
      ))}
    </div>
  )
}
