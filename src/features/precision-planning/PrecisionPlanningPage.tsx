import { useEffect, useState } from 'react'
import { supabase } from '../../core/auth/supabaseClient'
import { CloudRain, Sun, Sprout, CheckCircle2, Calendar, FlaskConical, Target, CloudLightning, RefreshCw, AlertCircle } from 'lucide-react'
import { GlassCard } from '../../components/GlassCard'
import { cn } from '../../core/utils/cn'

interface Task {
  id: number
  title: string
  status: string
  task_date: string
  task_type: string
  cycle_id: number
}

interface CropCycle {
  id: number
  sowing_date: string
  crop_type: string
}

interface SoilReport {
  id: number
  nitrogen: number
  phosphorus: number
  potassium: number
  report_date: string
}

interface CropRequirement {
  id: number
  crop_name: string
  min_n: number
  max_n: number
  min_p: number
  max_p: number
  min_k: number
  max_k: number
}

interface Weather {
  time: string[]
  precipitation_sum: number[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
}

export function PrecisionPlanningPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [cycle, setCycle] = useState<CropCycle | null>(null)
  const [soil, setSoil] = useState<SoilReport | null>(null)
  const [weather, setWeather] = useState<Weather | null>(null)
  const [loading, setLoading] = useState(true)
  const [recommendedCrop, setRecommendedCrop] = useState<string | null>(null)
  const [weatherAlert, setWeatherAlert] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const weatherPromise = fetch(`https://api.open-meteo.com/v1/forecast?latitude=28.6139&longitude=77.2090&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=auto`).then(res => res.json())
        const soilPromise = supabase.from('soil_reports').select('*').order('report_date', { ascending: false }).limit(1).single()
        const reqPromise = supabase.from('crop_requirements').select('*')
        
        const fetchCycleAndTasks = async () => {
          const { data: cycleData } = await supabase.from('crop_cycles').select('*').order('created_at', { ascending: false }).limit(1).single()
          if (cycleData) {
            const { data: tasksData } = await supabase.from('daily_tasks').select('*').eq('cycle_id', cycleData.id).order('task_date', { ascending: true })
            return { cycleData, tasksData }
          }
          return { cycleData: null, tasksData: null }
        }

        const [weatherData, soilRes, reqRes, { cycleData, tasksData }] = await Promise.all([
          weatherPromise, soilPromise, reqPromise, fetchCycleAndTasks()
        ])

        if (cycleData) setCycle(cycleData)
        
        let fetchedTasks: Task[] = []
        if (tasksData) {
          fetchedTasks = tasksData
          setTasks(fetchedTasks)
        }

        if (soilRes.data) setSoil(soilRes.data)
        
        if (weatherData && weatherData.daily) {
          setWeather(weatherData.daily)
        }
        
        const reqData = reqRes.data

        // Run Adaptive Logic
        if (weatherData.daily && fetchedTasks.length > 0) {
          await runAdaptiveRoutine(weatherData.daily, fetchedTasks)
        }

        // Run Succession Logic
        if (soilRes.data && reqData && reqData.length > 0) {
          runSuccessionPlanner(soilRes.data, reqData)
        }

      } catch (err) {
        console.error("Error fetching data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const runAdaptiveRoutine = async (dailyWeather: Weather, currentTasks: Task[]) => {
    let tasksUpdated = false
    const newTasks = [...currentTasks]
    const todayStr = new Date().toISOString().split('T')[0]

    const todayIndex = dailyWeather.time.findIndex(t => t === todayStr)
    
    if (todayIndex >= 0) {
      const precip = dailyWeather.precipitation_sum[todayIndex]
      if (precip > 5) {
        setWeatherAlert(`Heavy rain predicted (${precip}mm). Rescheduling irrigation.`)
        for (let i = 0; i < newTasks.length; i++) {
          if (newTasks[i].task_type === 'Irrigation' && newTasks[i].status === 'Pending' && newTasks[i].task_date === todayStr) {
             await supabase.from('daily_tasks').update({ status: 'Rescheduled' }).eq('id', newTasks[i].id)
             newTasks[i].status = 'Rescheduled'
             tasksUpdated = true
          }
        }
      } else {
        setWeatherAlert(null)
      }
    }

    if (tasksUpdated) {
      setTasks(newTasks)
    }
  }

  const runSuccessionPlanner = (soilData: SoilReport, reqs: CropRequirement[]) => {
    const { nitrogen, phosphorus, potassium } = soilData
    let bestMatch = null
    let minDiff = Infinity

    for (const req of reqs) {
      // Calculate how far out of range the current soil is for this crop
      const nDiff = Math.max(0, req.min_n - nitrogen) + Math.max(0, nitrogen - req.max_n)
      const pDiff = Math.max(0, req.min_p - phosphorus) + Math.max(0, phosphorus - req.max_p)
      const kDiff = Math.max(0, req.min_k - potassium) + Math.max(0, potassium - req.max_k)
      
      const totalDiff = nDiff + pDiff + kDiff
      if (totalDiff < minDiff) {
        minDiff = totalDiff
        bestMatch = req.crop_name
      }
    }
    setRecommendedCrop(bestMatch)
  }

  // Removed blocking loader

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto px-6 pb-20 pt-6">
      <div className="flex flex-col gap-6 h-full max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#87A96B] to-[#A67B5B]">
              Crop Calendar
            </h1>
            <p className="text-white/60 mt-2 font-medium">Real-time adaptive routine & succession planner</p>
          </div>
          {weatherAlert && (
            <div className="flex items-center gap-2 bg-red-500/20 text-red-300 border border-red-500/50 px-4 py-2 rounded-2xl animate-pulse">
              <AlertCircle size={18} />
              <span className="text-sm font-semibold">{weatherAlert}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
          
          {/* Column 1: Current Cycle & Weather */}
          <div className="flex flex-col gap-6 lg:col-span-1">
            
            {/* Active Cycle */}
            <GlassCard className="p-6 border-[#87A96B]/30 hover:border-[#87A96B]/60 transition-colors shadow-lg bg-black/40 backdrop-blur-xl rounded-3xl" variant="strong">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-[#87A96B]/20 to-[#87A96B]/5 rounded-2xl border border-[#87A96B]/30">
                  <Sprout className="text-[#87A96B]" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white/90">Active Cycle</h2>
                  <p className="text-xs text-white/50 uppercase tracking-widest font-semibold mt-1">Status Overview</p>
                </div>
              </div>
              
              {cycle ? (
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center group hover:bg-white/10 transition-colors">
                    <span className="text-white/60 font-medium">Crop Type</span>
                    <span className="text-lg font-bold text-white group-hover:text-[#87A96B] transition-colors">{cycle.crop_type}</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center group hover:bg-white/10 transition-colors">
                    <span className="text-white/60 font-medium">Sowing Date</span>
                    <span className="text-white font-medium">{new Date(cycle.sowing_date).toLocaleDateString()}</span>
                  </div>
                </div>
              ) : (
                <div className="text-white/40 text-sm py-4 text-center">No active crop cycle found.</div>
              )}
            </GlassCard>

            {/* Weather Integration */}
            <GlassCard className="p-6 border-[#3b82f6]/30 hover:border-[#3b82f6]/60 transition-colors shadow-lg bg-black/40 backdrop-blur-xl rounded-3xl flex-1" variant="strong">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-[#3b82f6]/20 to-[#3b82f6]/5 rounded-2xl border border-[#3b82f6]/30">
                  <CloudLightning className="text-[#3b82f6]" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white/90">Local Forecast</h2>
                  <p className="text-xs text-white/50 uppercase tracking-widest font-semibold mt-1">Open-Meteo API</p>
                </div>
              </div>

              {weather ? (
                <div className="space-y-3">
                  {weather.time.slice(0, 4).map((date, idx) => {
                    const precip = weather.precipitation_sum[idx]
                    const maxT = weather.temperature_2m_max[idx]
                    const isRainy = precip > 0
                    
                    return (
                      <div key={date} className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-all",
                        isRainy ? "bg-blue-500/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]" : "bg-white/5 border-white/10"
                      )}>
                        <div className="flex items-center gap-3">
                          {isRainy ? <CloudRain size={20} className="text-blue-400" /> : <Sun size={20} className="text-yellow-400" />}
                          <span className="font-semibold text-white/90">
                            {idx === 0 ? 'Today' : new Date(date).toLocaleDateString(undefined, { weekday: 'short' })}
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span className="text-blue-300/80 font-medium">{precip}mm</span>
                          <span className="text-white/60 font-medium">{maxT}°C</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-white/40 text-sm py-4 text-center">Loading weather data...</div>
              )}
            </GlassCard>
            
          </div>

          {/* Column 2: Adaptive Routine (Tasks) */}
          <GlassCard className="p-6 border-white/10 lg:col-span-1 shadow-lg bg-black/40 backdrop-blur-xl rounded-3xl overflow-hidden flex flex-col" variant="strong">
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <div className="p-3 bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-2xl border border-purple-500/30">
                <Target className="text-purple-400" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white/90">Adaptive Routine</h2>
                <p className="text-xs text-white/50 uppercase tracking-widest font-semibold mt-1">Smart Task Engine</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {tasks.length > 0 ? tasks.map(task => {
                const isRescheduled = task.status === 'Rescheduled'
                const isCompleted = task.status === 'Completed'
                
                return (
                  <div key={task.id} className={cn(
                    "p-5 rounded-2xl border transition-all relative overflow-hidden group",
                    isRescheduled ? "border-orange-500/40 bg-orange-500/10" : 
                    isCompleted ? "border-green-500/30 bg-green-500/5" : 
                    "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                  )}>
                    {isRescheduled && (
                      <div className="absolute top-0 right-0 px-3 py-1 bg-orange-500/20 text-orange-400 text-[10px] font-bold rounded-bl-xl border-b border-l border-orange-500/30">
                        WEATHER OVERRIDE
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-white text-lg">{task.title}</div>
                      {isCompleted && <CheckCircle2 className="text-green-400" size={20} />}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <div className="flex items-center gap-1.5 text-white/50">
                        <Calendar size={14} />
                        {new Date(task.task_date).toLocaleDateString()}
                      </div>
                      <div className={cn(
                        "px-2 py-0.5 rounded-full border",
                        task.task_type === 'Irrigation' ? "border-blue-500/30 text-blue-400 bg-blue-500/10" : "border-white/20 text-white/60 bg-white/5"
                      )}>
                        {task.task_type}
                      </div>
                    </div>
                  </div>
                )
              }) : (
                <div className="h-full flex flex-col items-center justify-center text-white/30 text-sm">
                  <Calendar size={40} className="mb-4 opacity-50" />
                  No tasks found for this cycle.
                </div>
              )}
            </div>
          </GlassCard>

          {/* Column 3: Succession Planner */}
          <GlassCard className="p-6 border-[#A67B5B]/30 hover:border-[#A67B5B]/60 transition-colors shadow-lg bg-black/40 backdrop-blur-xl rounded-3xl lg:col-span-1 flex flex-col" variant="strong">
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <div className="p-3 bg-gradient-to-br from-[#A67B5B]/20 to-[#A67B5B]/5 rounded-2xl border border-[#A67B5B]/30">
                <FlaskConical className="text-[#A67B5B]" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white/90">Succession Planner</h2>
                <p className="text-xs text-white/50 uppercase tracking-widest font-semibold mt-1">Soil Intelligence</p>
              </div>
            </div>

            <div className="flex flex-col flex-1 justify-between">
              
              {/* Current Soil Report */}
              <div>
                <h3 className="text-sm font-bold text-white/60 mb-3 uppercase tracking-wider">Latest Soil Report</h3>
                {soil ? (
                  <div className="grid grid-cols-3 gap-3 mb-8">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                      <div className="text-2xl font-black text-blue-400">{soil.nitrogen}</div>
                      <div className="text-[10px] font-bold text-white/50 mt-1 uppercase tracking-widest">Nitrogen</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                      <div className="text-2xl font-black text-orange-400">{soil.phosphorus}</div>
                      <div className="text-[10px] font-bold text-white/50 mt-1 uppercase tracking-widest">Phosphorus</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                      <div className="text-2xl font-black text-purple-400">{soil.potassium}</div>
                      <div className="text-[10px] font-bold text-white/50 mt-1 uppercase tracking-widest">Potassium</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-white/40 text-sm mb-8">No soil data available.</div>
                )}
              </div>

              {/* Recommendation */}
              <div className="relative overflow-hidden rounded-3xl border border-[#87A96B]/40 bg-gradient-to-br from-[#87A96B]/20 to-black p-6">
                <div className="absolute -right-6 -top-6 opacity-10">
                  <Sprout size={120} />
                </div>
                <div className="relative z-10">
                  <div className="text-xs font-bold uppercase tracking-widest text-[#87A96B] mb-2">
                    AI Recommended Crop
                  </div>
                  {recommendedCrop ? (
                    <>
                      <div className="text-4xl font-extrabold text-white mb-2">{recommendedCrop}</div>
                      <p className="text-sm text-white/70 font-medium leading-relaxed">
                        Matches your current N-P-K soil profile seamlessly. Requires minimal fertilizer correction for optimal yield.
                      </p>
                    </>
                  ) : (
                    <div className="text-lg text-white/50 font-semibold">Analyzing...</div>
                  )}
                </div>
              </div>

            </div>
          </GlassCard>

        </div>
      </div>
    </div>
  )
}
