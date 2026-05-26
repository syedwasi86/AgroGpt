import { GlassCard } from '../../../components/GlassCard'
import { getOverdueTasks, getTodayTasks } from '../selectors'
import { AlertCircle, CheckCircle2, CloudRain, ShieldAlert, Sparkles, Wind } from 'lucide-react'
import type { FarmTaskRecord } from '../../../lib/db'
import type { WeatherAlert } from '../engines/weatherAdjustmentEngine'

interface TodayFocusCardProps {
  tasks: FarmTaskRecord[]
  weatherAlerts: WeatherAlert[]
  currentDateUtc: string
}

export function TodayFocusCard({ tasks, weatherAlerts, currentDateUtc }: TodayFocusCardProps) {
  const overdue = getOverdueTasks(tasks, currentDateUtc)
  const today = getTodayTasks(tasks, currentDateUtc)
  const pendingToday = today.filter(t => t.status !== 'completed')

  // 1. Determine Critical Action
  let criticalTitle = "All Operations on Track"
  let criticalIcon = <CheckCircle2 className="text-[#87A96B]" size={20} />
  let criticalColor = "text-[#87A96B]"

  if (overdue.length > 0) {
    criticalTitle = "Resolve Overdue Tasks"
    criticalIcon = <ShieldAlert className="text-orange-400" size={20} />
    criticalColor = "text-orange-400"
  } else if (pendingToday.length > 0) {
    const primaryTask = pendingToday.find(t => t.priority === 'high') || pendingToday[0]
    criticalTitle = `${primaryTask.title} Due Today`
    criticalIcon = <AlertCircle className="text-[#87A96B]" size={20} />
    criticalColor = "text-[#87A96B]"
  }

  // 2. Pending & Overdue Tasks Summary
  const overdueText = overdue.length > 0 ? `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}` : null
  const todayText = pendingToday.length > 0 ? `${pendingToday.length} pending task${pendingToday.length > 1 ? 's' : ''} today` : null

  // 3. Weather Impact (filter for today/tomorrow)
  const todayTomorrowAlerts = weatherAlerts.filter(a => a.date === currentDateUtc || a.date === new Date(new Date().getTime() + 86400000).toISOString().split('T')[0])
  const activeWeatherAlert = todayTomorrowAlerts[0]

  // 4. Recommendation Logic
  let recommendation = "Keep fields clear of weeds to ensure healthy root development."
  if (activeWeatherAlert) {
    if (activeWeatherAlert.type === 'irrigation_delay') {
      recommendation = "Delay scheduled irrigation. Heavy rain will replenish soil moisture naturally."
    } else if (activeWeatherAlert.type === 'spray_warning') {
      recommendation = "Avoid pesticide or chemical spray today to prevent chemical drift from high wind speeds."
    } else if (activeWeatherAlert.type === 'disease_warning') {
      recommendation = "Damp weather increases blast risk. Scout lower leaf canopies for spotting."
    } else if (activeWeatherAlert.type === 'heat_stress') {
      recommendation = "Extreme afternoon heat. Irrigate early in the morning or evening to cool the root zones."
    }
  } else if (pendingToday.some(t => t.task_type === 'fertilization')) {
    recommendation = "Apply fertilizers near the crop root zone in damp soil for maximum nutrient intake."
  }

  return (
    <GlassCard className="p-6 border-[#87A96B]/20 bg-gradient-to-br from-[#87A96B]/5 to-[#121412]/95 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] rounded-3xl" variant="strong">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold text-[#87A96B] tracking-[0.2em] uppercase">Today's Focus</span>
        <Sparkles size={14} className="text-[#87A96B] animate-pulse" />
      </div>

      <div className="space-y-4">
        {/* Critical Action Banner */}
        <div className="flex items-center gap-3 p-3 bg-white/2 border border-white/5 rounded-2xl">
          <div className="p-1.5 bg-white/5 rounded-xl">
            {criticalIcon}
          </div>
          <div>
            <span className="text-[9px] font-bold text-white/35 uppercase tracking-wider block">Critical Action</span>
            <span className={`font-black text-sm ${criticalColor}`}>{criticalTitle}</span>
          </div>
        </div>

        {/* Task Summaries & Weather details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 bg-white/2 border border-white/5 rounded-2xl flex flex-col justify-center">
            <span className="text-white/35 font-bold uppercase tracking-wider text-[9px] mb-1">Task Operations</span>
            {overdueText || todayText ? (
              <ul className="space-y-1 font-bold text-white/80">
                {overdueText && <li className="text-orange-400 flex items-center gap-1.5">• {overdueText}</li>}
                {todayText && <li className="flex items-center gap-1.5">• {todayText}</li>}
              </ul>
            ) : (
              <span className="text-white/60 font-semibold">No pending operations today.</span>
            )}
          </div>

          <div className="p-3.5 bg-white/2 border border-white/5 rounded-2xl flex flex-col justify-center">
            <span className="text-white/35 font-bold uppercase tracking-wider text-[9px] mb-1">Weather Context</span>
            {activeWeatherAlert ? (
              <div className="flex items-start gap-1 text-white/80 font-bold">
                {activeWeatherAlert.type === 'irrigation_delay' ? (
                  <CloudRain size={14} className="text-blue-400 mt-0.5 shrink-0" />
                ) : (
                  <Wind size={14} className="text-yellow-400 mt-0.5 shrink-0" />
                )}
                <span className="truncate">{activeWeatherAlert.message}</span>
              </div>
            ) : (
              <span className="text-[#87A96B] font-semibold flex items-center gap-1">
                ✓ Weather conditions stable.
              </span>
            )}
          </div>
        </div>

        {/* Recommendation details */}
        <div className="p-4 bg-[#87A96B]/5 border border-[#87A96B]/15 rounded-2xl text-xs">
          <span className="text-[#87A96B] font-black uppercase tracking-wider text-[9px] block mb-1">Agronomy Advisory</span>
          <p className="text-white/70 font-semibold leading-relaxed">{recommendation}</p>
        </div>
      </div>
    </GlassCard>
  )
}
