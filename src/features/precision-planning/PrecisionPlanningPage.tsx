import { useEffect, useState } from 'react'
import { supabase } from '../../core/auth/supabaseClient'
import { CloudRain, Sun, Sprout, CheckCircle2, Calendar, FlaskConical, Target, CloudLightning, AlertCircle, Leaf, Wheat, Scissors, User } from 'lucide-react'
import { GlassCard } from '../../components/GlassCard'
import { cn } from '../../core/utils/cn'
import { getUserLocation } from '../../core/utils/geolocation'
import { fetchDailyWeather, type DailyWeatherData } from '../gis/services/weatherService'

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

export const CROP_CONFIG = {
  Rice: {
    totalDurationDays: 120,
    milestones: [
      { label: 'Seed Sowing', offsetDays: 0, icon: 'Sprout' },
      { label: 'Growing', offsetDays: 20, icon: 'Leaf' },
      { label: 'Flowering', offsetDays: 60, icon: 'Sprout' },
      { label: 'Grains Forming', offsetDays: 90, icon: 'Wheat' },
      { label: 'Cutting Time', offsetDays: 120, icon: 'Scissors' }
    ]
  },
  Wheat: {
    totalDurationDays: 130,
    milestones: [
      { label: 'Sowing', offsetDays: 0, icon: 'Sprout' },
      { label: 'Growing', offsetDays: 25, icon: 'Leaf' },
      { label: 'Flowering', offsetDays: 80, icon: 'Sprout' },
      { label: 'Grains Forming', offsetDays: 105, icon: 'Wheat' },
      { label: 'Cutting Time', offsetDays: 130, icon: 'Scissors' }
    ]
  },
  Cotton: {
    totalDurationDays: 180,
    milestones: [
      { label: 'Sowing', offsetDays: 0, icon: 'Sprout' },
      { label: 'Growing', offsetDays: 35, icon: 'Leaf' },
      { label: 'Flowering', offsetDays: 90, icon: 'Sprout' },
      { label: 'Bolls Opening', offsetDays: 140, icon: 'Wheat' },
      { label: 'Picking Time', offsetDays: 180, icon: 'Scissors' }
    ]
  },
  Maize: {
    totalDurationDays: 110,
    milestones: [
      { label: 'Sowing', offsetDays: 0, icon: 'Sprout' },
      { label: 'Growing', offsetDays: 25, icon: 'Leaf' },
      { label: 'Flowering', offsetDays: 55, icon: 'Sprout' },
      { label: 'Grains Forming', offsetDays: 80, icon: 'Wheat' },
      { label: 'Cutting Time', offsetDays: 110, icon: 'Scissors' }
    ]
  }
}

const getIcon = (name: string) => {
  switch (name) {
    case 'Sprout': return <Sprout size={18} />
    case 'Leaf': return <Leaf size={18} />
    case 'Wheat': return <Wheat size={18} />
    case 'Scissors': return <Scissors size={18} />
    default: return <Sprout size={18} />
  }
}

const TASK_TEMPLATES: Record<string, Array<{ dayOffset: number; title: string; type: string }>> = {
  Rice: [
    { dayOffset: 0, title: "Sow seeds in nursery beds", type: "Sowing" },
    { dayOffset: 5, title: "Ensure shallow flooding in nursery", type: "Irrigation" },
    { dayOffset: 15, title: "Apply primary fertilizer dose to nursery", type: "Fertilization" },
    { dayOffset: 25, title: "Transplant seedlings to main field", type: "Sowing" },
    { dayOffset: 30, title: "Maintain water depth in main field", type: "Irrigation" },
    { dayOffset: 45, title: "Apply top dressing of Urea (Nitrogen)", type: "Fertilization" },
    { dayOffset: 60, title: "Perform manual weeding or clean borders", type: "Weeding" },
    { dayOffset: 75, title: "Check soil moisture, irrigate if dry", type: "Irrigation" },
    { dayOffset: 90, title: "Inspect crop for stem borers/blast disease", type: "Inspection" },
    { dayOffset: 105, title: "Monitor grain maturity levels", type: "Inspection" },
    { dayOffset: 120, title: "Drain field and harvest crop", type: "Harvesting" }
  ],
  Wheat: [
    { dayOffset: 0, title: "Sow wheat seeds in warm moist soil", type: "Sowing" },
    { dayOffset: 21, title: "First irrigation at crown root stage", type: "Irrigation" },
    { dayOffset: 30, title: "Apply first nitrogen fertilizer dose", type: "Fertilization" },
    { dayOffset: 45, title: "Perform mechanical weeding", type: "Weeding" },
    { dayOffset: 60, title: "Second irrigation at tillering stage", type: "Irrigation" },
    { dayOffset: 85, title: "Apply second fertilizer dose (Urea)", type: "Fertilization" },
    { dayOffset: 100, title: "Third irrigation at jointing stage", type: "Irrigation" },
    { dayOffset: 115, title: "Inspect ears for rust infections", type: "Inspection" },
    { dayOffset: 130, title: "Harvest when ears turn golden brown", type: "Harvesting" }
  ],
  Cotton: [
    { dayOffset: 0, title: "Sow cotton seeds at 2-inch depth", type: "Sowing" },
    { dayOffset: 15, title: "Irrigate gently to help seedlings emerge", type: "Irrigation" },
    { dayOffset: 30, title: "Thin crop stand to optimize spacing", type: "Weeding" },
    { dayOffset: 45, title: "Apply fertilizer dose (NPK)", type: "Fertilization" },
    { dayOffset: 60, title: "Deep irrigation at flowering stage", type: "Irrigation" },
    { dayOffset: 80, title: "Inspect crop for pink bollworm", type: "Inspection" },
    { dayOffset: 100, title: "Apply nitrogen fertilizer", type: "Fertilization" },
    { dayOffset: 120, title: "Irrigate to support boll development", type: "Irrigation" },
    { dayOffset: 150, title: "Monitor boll opening and dry weather", type: "Inspection" },
    { dayOffset: 180, title: "First handpicking of cotton bolls", type: "Harvesting" }
  ],
  Maize: [
    { dayOffset: 0, title: "Plant maize seeds in well-prepared beds", type: "Sowing" },
    { dayOffset: 10, title: "Gently irrigate to support germination", type: "Irrigation" },
    { dayOffset: 25, title: "Apply first top-dressing of fertilizer", type: "Fertilization" },
    { dayOffset: 40, title: "Perform manual weeding or earthing up", type: "Weeding" },
    { dayOffset: 55, title: "Critical irrigation at silk stage", type: "Irrigation" },
    { dayOffset: 70, title: "Inspect cobs for fall armyworm pests", type: "Inspection" },
    { dayOffset: 90, title: "Check grain moisture level in field", type: "Inspection" },
    { dayOffset: 110, title: "Harvest cobs when husks turn dry", type: "Harvesting" }
  ]
}

interface ProgressBarProps {
  cropType: string
  sowingDate: string
}

function LifecycleProgressBar({ cropType, sowingDate }: ProgressBarProps) {
  const config = CROP_CONFIG[cropType as keyof typeof CROP_CONFIG] || CROP_CONFIG.Rice
  const totalDays = config.totalDurationDays
  
  const start = new Date(sowingDate).getTime()
  const today = new Date().getTime()
  const diffTime = today - start
  const currentDay = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
  
  const remainingDays = Math.max(0, totalDays - currentDay)
  const progress = Math.min(100, (currentDay / totalDays) * 100)

  const milestones = config.milestones.map((m) => {
    const pos = (m.offsetDays / totalDays) * 100
    const active = currentDay >= m.offsetDays
    return {
      label: m.label,
      day: m.offsetDays,
      icon: getIcon(m.icon),
      pos,
      active
    }
  })

  return (
    <div className="w-full mb-12">
      <GlassCard className="p-10 border-white/10 bg-[#121412]/90 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)]" variant="strong">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-black text-[#A3B899] tracking-widest uppercase">{cropType} LIFE CYCLE</h2>
          <div className="text-sm font-black text-white tracking-[0.2em] uppercase">
            REMAINING DAYS: <span className="text-[#87A96B] ml-2 font-black text-xl">{remainingDays}</span>
          </div>
        </div>

        <div className="relative pt-12 pb-14">
          {/* Walking Farmer Icon */}
          <div 
            className="absolute top-0 transition-all duration-1000 ease-out z-40"
            style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
          >
            <div className="flex flex-col items-center">
              <User size={32} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
              <div className="w-px h-10 bg-gradient-to-b from-white/40 to-transparent mt-1" />
            </div>
          </div>

          {/* Main Track */}
          <div className="h-14 w-full bg-[#1a1d1a] rounded-full border border-white/10 relative flex items-center p-1 overflow-hidden">
            {/* Green Progress Fill */}
            <div 
              className="h-full bg-gradient-to-r from-[#6A8E5C] to-[#87A96B] rounded-full relative transition-all duration-1000 ease-out shadow-[0_0_30px_rgba(135,169,107,0.6)]"
              style={{ width: `${progress}%` }}
            />
            
            {/* Milestone Circles inside the bar */}
            <div className="absolute inset-0 w-full flex items-center justify-between px-2">
              {milestones.map((m, idx) => (
                <div 
                  key={idx}
                  className="absolute"
                  style={{ left: `${m.pos}%`, transform: 'translateX(-50%)' }}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                    m.active 
                      ? "bg-[#87A96B] border-white text-white shadow-[0_0_20px_rgba(135,169,107,0.8)]" 
                      : "bg-[#252a25] border-white/10 text-white/30"
                  )}>
                    {m.icon}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dashed Lines and Labels Below */}
          <div className="absolute top-[104px] w-full flex justify-between px-1">
            {milestones.map((m, idx) => (
              <div 
                key={idx} 
                className="absolute flex flex-col items-center"
                style={{ left: `${m.pos}%`, transform: 'translateX(-50%)' }}
              >
                {/* Dashed vertical line */}
                <div className="w-px h-6 border-l border-dashed border-white/40 mb-3" />
                
                {/* Labels */}
                <div className="text-center whitespace-nowrap">
                  <div className="flex flex-col items-center">
                    {m.active && idx !== 0 && (
                      <span className="text-[#87A96B] text-[10px] font-black uppercase tracking-widest mb-1">COMPLETED</span>
                    )}
                    <span className={cn(
                      "text-[11px] font-black uppercase tracking-widest leading-tight",
                      m.active ? "text-white" : "text-white/40",
                      idx === milestones.length - 1 && "text-[#A67B5B]" 
                    )}>
                      {m.label}
                    </span>
                    <span className={cn(
                      "text-[10px] font-black mt-1",
                      m.active ? "text-white/80" : "text-white/20",
                      idx === milestones.length - 1 && "text-[#A67B5B]/80"
                    )}>
                      (Day {m.day})
                    </span>
                  </div>
                  {idx === 0 && (
                    <span className="text-[#87A96B] text-[10px] font-black mt-2 block italic uppercase tracking-tighter">Day 0</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

export function PrecisionPlanningPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [cycle, setCycle] = useState<CropCycle | null>(null)
  const [soil, setSoil] = useState<SoilReport | null>(null)
  const [weather, setWeather] = useState<DailyWeatherData | null>(null)
  const [recommendedCrop, setRecommendedCrop] = useState<string | null>(null)
  const [weatherAlert, setWeatherAlert] = useState<string | null>(null)
  const [requirements, setRequirements] = useState<CropRequirement[]>([])
  const [soilAlerts, setSoilAlerts] = useState<Array<{ id: string; title: string; task_type: string; status: string }>>([])

  // Crop Calendar Onboarding / Setup states
  const [newCropType, setNewCropType] = useState('Rice')
  const [newSowingDate, setNewSowingDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)

  const runAdaptiveRoutine = async (dailyWeather: DailyWeatherData, currentTasks: Task[]) => {
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
      const nDiff = Math.max(0, req.min_n - nitrogen) + Math.max(0, nitrogen - req.max_n)
      const pDiff = Math.max(0, req.min_p - phosphorus) + Math.max(0, phosphorus - req.max_p)
      const kDiff = Math.max(0, req.min_k - potassium) + Math.max(0, potassium - req.max_k)
      
      const totalDiff = nDiff + pDiff + kDiff
      if (totalDiff < minDiff) {
        minDiff = totalDiff
        bestMatch = req.crop_name
      }
    }
    // Display visually as Maize instead of Corn for UI consistency
    setRecommendedCrop(bestMatch === 'Corn' ? 'Maize' : bestMatch)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const coords = await getUserLocation()
        const weatherPromise = fetchDailyWeather(coords.latitude, coords.longitude)
        const soilPromise = supabase.from('soil_reports').select('*').order('report_date', { ascending: false }).limit(1)
        const reqPromise = supabase.from('crop_requirements').select('*')
        
        const fetchCycleAndTasks = async () => {
          const { data: cycles } = await supabase.from('crop_cycles').select('*').order('created_at', { ascending: false }).limit(1)
          if (cycles && cycles.length > 0) {
            const cycleData = cycles[0]
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

        if (soilRes.data && soilRes.data.length > 0) {
          setSoil(soilRes.data[0])
        }
        
        if (weatherData) {
          setWeather(weatherData)
        }
        
        const reqData = reqRes.data
        if (reqData) {
          setRequirements(reqData)
        }

        // Run Adaptive Logic
        if (weatherData && fetchedTasks.length > 0) {
          await runAdaptiveRoutine(weatherData, fetchedTasks)
        }

        // Run Succession Logic
        if (soilRes.data && soilRes.data.length > 0 && reqData && reqData.length > 0) {
          runSuccessionPlanner(soilRes.data[0], reqData)
        }

      } catch (err) {
        console.error("Error fetching data:", err)
      }
    }

    fetchData()
  }, [])

  // Hook to calculate soil health NPK advisories for active crop cycle
  useEffect(() => {
    if (!soil || !cycle || requirements.length === 0) {
      setSoilAlerts([])
      return
    }

    const cropReqName = cycle.crop_type === 'Maize' ? 'Corn' : cycle.crop_type
    const req = requirements.find(r => r.crop_name.toLowerCase() === cropReqName.toLowerCase())
    
    if (req) {
      const alerts = []
      if (soil.nitrogen < req.min_n) {
        alerts.push({
          id: 'soil-n',
          title: `Apply Nitrogen (Urea) - Soil has ${soil.nitrogen} ppm (Target: ${req.min_n}-${req.max_n} ppm)`,
          task_type: 'Fertilization',
          status: 'Advisory'
        })
      }
      if (soil.phosphorus < req.min_p) {
        alerts.push({
          id: 'soil-p',
          title: `Apply Phosphorus (DAP) - Soil has ${soil.phosphorus} ppm (Target: ${req.min_p}-${req.max_p} ppm)`,
          task_type: 'Fertilization',
          status: 'Advisory'
        })
      }
      if (soil.potassium < req.min_k) {
        alerts.push({
          id: 'soil-k',
          title: `Apply Potash (Potassium) - Soil has ${soil.potassium} ppm (Target: ${req.min_k}-${req.max_k} ppm)`,
          task_type: 'Fertilization',
          status: 'Advisory'
        })
      }
      setSoilAlerts(alerts)
    }
  }, [soil, cycle, requirements])

  const handleStartCalendar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSowingDate) return
    setSubmitting(true)
    try {
      // 1. Insert crop cycle
      const { data: cycleData, error: cycleErr } = await supabase
        .from('crop_cycles')
        .insert({
          sowing_date: newSowingDate,
          crop_type: newCropType
        })
        .select()
        .single()

      if (cycleErr || !cycleData) throw new Error(cycleErr?.message || "Failed to create crop cycle")

      // 2. Generate standard daily tasks based on crop template
      const templates = TASK_TEMPLATES[newCropType] || TASK_TEMPLATES.Rice
      const sowingTime = new Date(newSowingDate).getTime()
      const tasksToInsert = templates.map((t) => {
        const date = new Date(sowingTime + t.dayOffset * 24 * 60 * 60 * 1000)
        return {
          title: t.title,
          status: 'Pending',
          task_date: date.toISOString().split('T')[0],
          task_type: t.type,
          cycle_id: cycleData.id
        }
      })

      const { error: tasksErr } = await supabase
        .from('daily_tasks')
        .insert(tasksToInsert)

      if (tasksErr) throw tasksErr

      // Reload component state
      setCycle(cycleData)
      const { data: tasksData } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('cycle_id', cycleData.id)
        .order('task_date', { ascending: true })

      if (tasksData) setTasks(tasksData)

      if (weather && tasksData) {
        await runAdaptiveRoutine(weather, tasksData)
      }
    } catch (err) {
      console.error("Error starting calendar:", err)
      alert("Failed to initialize crop calendar. Please check your network connection.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteCycle = async () => {
    if (!cycle) return
    if (!window.confirm("Are you sure you want to reset your crop calendar? This will delete all current tasks.")) return
    
    try {
      const { error } = await supabase
        .from('crop_cycles')
        .delete()
        .eq('id', cycle.id)

      if (error) throw error

      setCycle(null)
      setTasks([])
      setWeatherAlert(null)
    } catch (err) {
      console.error("Error resetting calendar:", err)
      alert("Failed to reset calendar.")
    }
  }

  return (
    <div className="px-6 pb-20 pt-6">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#87A96B] to-[#A67B5B] tracking-tighter">
              Crop Calendar
            </h1>
            <p className="text-white/80 mt-2 font-bold text-lg uppercase tracking-wider">Your personalized daily farming guide</p>
          </div>
          {weatherAlert && (
            <div className="flex items-center gap-2 bg-red-600 text-white border-2 border-red-400 px-6 py-3 rounded-2xl animate-pulse shadow-lg">
              <AlertCircle size={20} />
              <span className="text-sm font-black uppercase tracking-widest">{weatherAlert}</span>
            </div>
          )}
        </div>
        
        {/* Life-Cycle Progress Bar */}
        {cycle ? (
          <LifecycleProgressBar cropType={cycle.crop_type} sowingDate={cycle.sowing_date} />
        ) : (
          <div className="w-full mb-12">
            <GlassCard className="p-8 border-white/10 bg-[#121412]/90 text-center py-12" variant="strong">
              <Sprout size={48} className="mx-auto mb-4 text-[#87A96B]/50 animate-bounce" />
              <h2 className="text-xl font-black text-white uppercase tracking-wider">No Active Crop Calendar</h2>
              <p className="text-sm text-white/50 mt-2">Initialize your crop cycle below to begin tracking daily farm work.</p>
            </GlassCard>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: Current Cycle & Weather */}
          <div className="flex flex-col gap-6 lg:col-span-1">
            
            {/* Active Cycle / Onboarding */}
            <GlassCard className="p-8 border-[#87A96B]/40 hover:border-[#87A96B] transition-all shadow-xl bg-black/60 backdrop-blur-2xl rounded-[2rem]" variant="strong">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-4 bg-gradient-to-br from-[#87A96B]/30 to-[#87A96B]/10 rounded-2xl border border-[#87A96B]/50 shadow-inner">
                  <Sprout className="text-[#87A96B]" size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight uppercase">Current Crop</h2>
                  <p className="text-xs text-[#87A96B] font-black uppercase tracking-[0.2em] mt-1">Status Overview</p>
                </div>
              </div>
              
              {cycle ? (
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex justify-between items-center group hover:bg-white/10 transition-all">
                    <span className="text-white/70 font-black uppercase text-xs tracking-widest">Crop Type</span>
                    <span className="text-xl font-black text-white group-hover:text-[#87A96B] transition-colors">{cycle.crop_type}</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex justify-between items-center group hover:bg-white/10 transition-all">
                    <span className="text-white/70 font-black uppercase text-xs tracking-widest">Sowing Date</span>
                    <span className="text-lg font-black text-white">{new Date(cycle.sowing_date).toLocaleDateString()}</span>
                  </div>
                  <button 
                    onClick={handleDeleteCycle}
                    className="w-full mt-4 py-3 bg-red-600/10 hover:bg-red-600/30 text-red-400 rounded-xl text-xs font-black uppercase tracking-wider border border-red-500/20 transition-all"
                  >
                    Reset Crop Calendar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleStartCalendar} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">Select Crop</label>
                    <select 
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white outline-none focus:border-[#87A96B] transition"
                      value={newCropType}
                      onChange={e => setNewCropType(e.target.value)}
                    >
                      <option value="Rice">Rice (Paddy)</option>
                      <option value="Wheat">Wheat</option>
                      <option value="Cotton">Cotton</option>
                      <option value="Maize">Maize</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">Sowing Date</label>
                    <input 
                      type="date" 
                      required
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white outline-none focus:border-[#87A96B] transition"
                      value={newSowingDate}
                      onChange={e => setNewSowingDate(e.target.value)}
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="w-full bg-[#87A96B] hover:bg-[#9dbf83] text-white py-4 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-[0_15px_30px_-10px_rgba(135,169,107,0.6)] uppercase tracking-widest disabled:opacity-50 mt-2"
                  >
                    {submitting ? 'Generating...' : "Generate Today's Work"}
                  </button>
                </form>
              )}
            </GlassCard>

            {/* Weather Integration */}
            <GlassCard className="p-8 border-[#3b82f6]/40 hover:border-[#3b82f6] transition-all shadow-xl bg-black/60 backdrop-blur-2xl rounded-[2rem] flex-1" variant="strong">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-4 bg-gradient-to-br from-[#3b82f6]/30 to-[#3b82f6]/10 rounded-2xl border border-[#3b82f6]/50 shadow-inner">
                  <CloudLightning className="text-[#3b82f6]" size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight uppercase">Weather</h2>
                  <p className="text-xs text-[#3b82f6] font-black uppercase tracking-[0.2em] mt-1">Live Forecast</p>
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
                        "flex items-center justify-between p-5 rounded-2xl border transition-all",
                        isRainy ? "bg-blue-600/20 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)]" : "bg-white/5 border-white/10"
                      )}>
                        <div className="flex items-center gap-4">
                          {isRainy ? <CloudRain size={24} className="text-blue-400" /> : <Sun size={24} className="text-yellow-400" />}
                          <span className="font-black text-white text-lg tracking-tight">
                            {idx === 0 ? 'Today' : new Date(date).toLocaleDateString(undefined, { weekday: 'short' })}
                          </span>
                        </div>
                        <div className="flex gap-6 items-center">
                          <span className="text-blue-300 font-black text-sm">{precip}mm</span>
                          <span className="text-white font-black text-lg">{maxT}°C</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-white/40 text-sm font-bold py-6 text-center italic">Loading weather data...</div>
              )}
            </GlassCard>
            
          </div>

          {/* Column 2: Today's Work / Task List */}
          <GlassCard className="p-8 border-white/20 lg:col-span-1 shadow-xl bg-black/60 backdrop-blur-2xl rounded-[2rem] flex flex-col" variant="strong">
            <div className="flex items-center gap-3 mb-8 shrink-0">
              <div className="p-4 bg-gradient-to-br from-purple-500/30 to-purple-500/10 rounded-2xl border border-purple-500/50 shadow-inner">
                <Target className="text-purple-400" size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">Today’s Work</h2>
                <p className="text-xs text-purple-400 font-black uppercase tracking-[0.2em] mt-1">Task List</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Dynamic Soil Advisories rendered at the top of the timeline */}
              {soilAlerts.map(alert => (
                <div key={alert.id} className="p-6 rounded-2xl border-2 border-amber-500/40 bg-amber-600/10 transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 px-4 py-1.5 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest rounded-bl-xl shadow-lg">
                    SOIL ADVISORY
                  </div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="font-black text-white text-xl tracking-tight group-hover:text-amber-400 transition-colors pr-16">{alert.title}</div>
                    <FlaskConical className="text-amber-400" size={24} />
                  </div>
                  <div className="flex items-center gap-6 text-xs font-black uppercase tracking-widest">
                    <div className="px-3 py-1 rounded-full border-2 border-amber-500/30 text-amber-400 bg-amber-500/10">
                      {alert.task_type}
                    </div>
                  </div>
                </div>
              ))}

              {/* Standard calendar tasks */}
              {tasks.length > 0 ? tasks.map(task => {
                const isRescheduled = task.status === 'Rescheduled'
                const isCompleted = task.status === 'Completed'
                
                return (
                  <div key={task.id} className={cn(
                    "p-6 rounded-2xl border-2 transition-all relative overflow-hidden group",
                    isRescheduled ? "border-orange-500 bg-orange-600/20" : 
                    isCompleted ? "border-[#87A96B]/50 bg-[#87A96B]/10" : 
                    "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30"
                  )}>
                    {isRescheduled && (
                      <div className="absolute top-0 right-0 px-4 py-1.5 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-xl shadow-lg">
                        WEATHER OVERRIDE
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-3">
                      <div className="font-black text-white text-xl tracking-tight group-hover:text-[#87A96B] transition-colors">{task.title}</div>
                      {isCompleted && <CheckCircle2 className="text-[#87A96B]" size={24} />}
                    </div>
                    <div className="flex items-center gap-6 text-xs font-black uppercase tracking-widest">
                      <div className="flex items-center gap-2 text-white/60">
                        <Calendar size={16} className="text-white/40" />
                        {new Date(task.task_date).toLocaleDateString()}
                      </div>
                      <div className={cn(
                        "px-3 py-1 rounded-full border-2",
                        task.task_type === 'Irrigation' ? "border-blue-500/50 text-blue-400 bg-blue-500/20" : 
                        task.task_type === 'Fertilization' ? "border-purple-500/50 text-purple-400 bg-purple-500/20" :
                        "border-white/20 text-white/80 bg-white/10"
                      )}>
                        {task.task_type}
                      </div>
                    </div>
                  </div>
                )
              }) : (
                soilAlerts.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-white/30 text-sm font-black uppercase tracking-[0.2em] py-20">
                    <Calendar size={60} className="mb-6 opacity-20" />
                    No tasks scheduled
                  </div>
                )
              )}
            </div>
          </GlassCard>

          {/* Column 3: Next Best Crop (Succession Planner) */}
          <GlassCard className="p-8 border-[#A67B5B]/40 hover:border-[#A67B5B] transition-all shadow-xl bg-black/60 backdrop-blur-2xl rounded-[2rem] lg:col-span-1 flex flex-col" variant="strong">
            <div className="flex items-center gap-3 mb-8 shrink-0">
              <div className="p-4 bg-gradient-to-br from-[#A67B5B]/30 to-[#A67B5B]/10 rounded-2xl border border-[#A67B5B]/50 shadow-inner">
                <FlaskConical className="text-[#A67B5B]" size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight uppercase">Next Best Crop</h2>
                <p className="text-xs text-[#A67B5B] font-black uppercase tracking-[0.2em] mt-1">AI Recommendation</p>
              </div>
            </div>

            <div className="flex flex-col flex-1 justify-between gap-10">
              
              {/* Current Soil Report */}
              <div>
                <h3 className="text-xs font-black text-white/40 mb-4 uppercase tracking-[0.3em]">Latest Soil Report</h3>
                {soil ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-black/40 border-2 border-blue-500/30 rounded-2xl p-5 text-center shadow-lg group hover:border-blue-400 transition-all">
                      <div className="text-3xl font-black text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">{soil.nitrogen}</div>
                      <div className="text-[10px] font-black text-white/60 mt-2 uppercase tracking-widest">Nitrogen</div>
                    </div>
                    <div className="bg-black/40 border-2 border-orange-500/30 rounded-2xl p-5 text-center shadow-lg group hover:border-orange-400 transition-all">
                      <div className="text-3xl font-black text-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]">{soil.phosphorus}</div>
                      <div className="text-[10px] font-black text-white/60 mt-2 uppercase tracking-widest">Phosphorus</div>
                    </div>
                    <div className="bg-black/40 border-2 border-purple-500/30 rounded-2xl p-5 text-center shadow-lg group hover:border-purple-400 transition-all">
                      <div className="text-3xl font-black text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.3)]">{soil.potassium}</div>
                      <div className="text-[10px] font-black text-white/60 mt-2 uppercase tracking-widest">Potassium</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-white/40 text-sm font-bold italic">No soil data available.</div>
                )}
              </div>

              {/* Recommendation */}
              <div className="relative overflow-hidden rounded-[2.5rem] border-2 border-[#87A96B]/50 bg-gradient-to-br from-[#87A96B]/40 via-black/80 to-black p-8 shadow-2xl group hover:border-[#87A96B] transition-all">
                <div className="absolute -right-10 -top-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                  <Sprout size={160} />
                </div>
                <div className="relative z-10">
                  <div className="text-xs font-black uppercase tracking-[0.4em] text-[#87A96B] mb-4">
                    AI AGENT ANALYSIS
                  </div>
                  {recommendedCrop ? (
                    <>
                      <div className="text-5xl font-black text-white mb-4 tracking-tighter">{recommendedCrop}</div>
                      <p className="text-base text-white/90 font-bold leading-relaxed">
                        Matches your current N-P-K soil profile. Optimized for yield based on seasonal trends.
                      </p>
                    </>
                  ) : (
                    <div className="text-xl text-white/50 font-black uppercase tracking-widest animate-pulse">Calculating...</div>
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
