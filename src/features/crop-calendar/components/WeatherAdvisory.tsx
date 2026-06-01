import { useState } from 'react'
import { GlassCard } from '../../../components/GlassCard'
import { AdvisoryRow } from '../shared/ui/AdvisoryRow'
import { EmptyState } from '../shared/ui/EmptyState'
import { formatUtcToLocal } from '../utils/dateUtils'
import { CloudRain, Wind, AlertTriangle, Sun, Thermometer, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react'
import type { WeatherAlert } from '../engines/weatherAdjustmentEngine'

interface WeatherAdvisoryProps {
  alerts: WeatherAlert[]
}

const typeConfig = {
  irrigation_delay: {
    category: 'Irrigation Advisory',
    icon: <CloudRain size={16} />,
    severity: 'warning' as const
  },
  spray_warning: {
    category: 'Spray Advisory',
    icon: <Wind size={16} />,
    severity: 'danger' as const
  },
  disease_warning: {
    category: 'Disease Advisory',
    icon: <AlertTriangle size={16} />,
    severity: 'warning' as const
  },
  heat_stress: {
    category: 'Heat Advisory',
    icon: <Sun size={16} />,
    severity: 'danger' as const
  }
}

export function WeatherAdvisory({ alerts }: WeatherAdvisoryProps) {
  const [showAll, setShowAll] = useState(false)
  const hasAlerts = alerts.length > 0

  const visibleAlerts = showAll ? alerts : alerts.slice(0, 2)

  return (
    <GlassCard className="p-6 border-white/5 bg-[#121412]/80 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] rounded-3xl" variant="strong">
      {!hasAlerts ? (
        <EmptyState
          message="Weather conditions are stable"
          description="Local forecast predicts optimal humidity, wind, and temperature conditions for all farming operations."
          icon={<ShieldCheck size={28} className="text-[#87A96B]" />}
        />
      ) : (
        <div className="space-y-4">
          <div className="max-h-[380px] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
            {visibleAlerts.map((alert, idx) => {
              const config = typeConfig[alert.type] || {
                category: 'Field Advisory',
                icon: <AlertTriangle size={16} />,
                severity: 'info' as const
              }

              return (
                <AdvisoryRow
                  key={idx}
                  category={config.category}
                  message={alert.message}
                  dateDetails={formatUtcToLocal(alert.date)}
                  severity={config.severity}
                  icon={config.icon}
                />
              )
            })}
          </div>

          {alerts.length > 2 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white/50 hover:text-white transition-all hover:bg-white/5 rounded-xl border border-white/10"
            >
              {showAll ? (
                <>
                  <ChevronUp size={14} />
                  Collapse Advisories
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  View More Advisories ({alerts.length - 2} hidden)
                </>
              )}
            </button>
          )}
        </div>
      )}
    </GlassCard>
  )
}
