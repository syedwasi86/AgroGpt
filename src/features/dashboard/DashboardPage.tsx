import { useEffect, useState, lazy, Suspense, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Compass,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Sparkles,
  Sprout,
  Wifi,
  WifiOff
} from 'lucide-react'
import { cn } from '../../core/utils/cn'
import { GlassCard } from '../../components/GlassCard'
import { SkeletonCard } from '../../components/Skeleton'
import { dashboardRepository, type DashboardSnapshot } from './dashboardRepository'
import { askAgroGPT } from '../../ai/provider'
import { saveAiQuery } from '../../lib/repository'

// Lazy-load the heavy Leaflet bundle
const FarmMap = lazy(() => import('./FarmMap').then(m => ({ default: m.FarmMap })))

// ─── Scroll-visibility/Intersection Observer Wrapper ──────────────────────────

function LazyVisible({ children, placeholderHeight = 280 }: { children: React.ReactNode; placeholderHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '100px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ minHeight: isVisible ? undefined : `${placeholderHeight}px` }}>
      {isVisible ? children : (
        <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-white/5 bg-black/20 text-sm text-white/30">
          Scroll near to load map assets...
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard Page ───────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate()

  // State Management
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Local Ask Center State
  const [askInput, setAskInput] = useState('')
  const [askAnswer, setAskAnswer] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)

  // Selected prompt chip details (locally expanded advice)
  const [selectedAdviceKey, setSelectedAdviceKey] = useState<
    'todayAdvice' | 'waterAdvice' | 'pestAdvice' | 'fertilizerAdvice' | null
  >(null)

  // Fetch Snapshot DTO from repository
  const loadSnapshot = async (force = false) => {
    if (force) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const data = await dashboardRepository.fetchDashboardSnapshot(undefined, force)
      setSnapshot(data)
    } catch (err: any) {
      console.error('Failed to load dashboard snapshot:', err)
      setError('Could not aggregate farm data. Showing offline fallbacks.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadSnapshot()
  }, [])

  // Manual Trigger to re-fetch weather/AI insights
  const handleManualRefresh = () => {
    loadSnapshot(true)
    setAskAnswer(null)
    setAskError(null)
  }

  // Ask AgroGPT Inline form submit
  const handleAskAgroGPT = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!askInput.trim()) return

    setAsking(true)
    setAskAnswer(null)
    setAskError(null)

    try {
      const res = await askAgroGPT(askInput)
      setAskAnswer(res.text)
    } catch (err) {
      console.warn('AI offline response trigger, adding to offline queue:', err)
      setAskError('Offline: Your question has been queued in your Digital Ledger sync pipeline.')
      await saveAiQuery(askInput)
    } finally {
      setAsking(false)
    }
  }

  // Quick Action triggers
  const toggleAdviceKey = (key: 'todayAdvice' | 'waterAdvice' | 'pestAdvice' | 'fertilizerAdvice') => {
    setSelectedAdviceKey(prev => (prev === key ? null : key))
  }

  // Loading skeleton state
  if (loading) {
    return (
      <div className="space-y-8 py-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <SkeletonCard className="h-8 w-48" />
          <SkeletonCard className="h-8 w-24" />
        </div>
        <SkeletonCard className="h-44" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <SkeletonCard className="h-80 lg:col-span-2" />
          <SkeletonCard className="h-80" />
        </div>
      </div>
    )
  }

  const isCropActive = snapshot?.crop?.active ?? false

  return (
    <div className="space-y-8 py-6">
      
      {/* 1. Header Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white flex items-center gap-2">
            <LayoutDashboard className="text-primary-400" size={24} />
            Command Center
          </h1>
          <p className="subtle mt-1">Operational snapshot & system telemetry</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Online/Offline Status Indicator */}
          {dashboardRepository.isOnline() ? (
            <span className="glass-chip border-green-500/30 bg-green-500/10 text-green-400">
              <Wifi size={13} className="animate-pulse" />
              Online
            </span>
          ) : (
            <span className="glass-chip border-amber-500/30 bg-amber-500/10 text-amber-400">
              <WifiOff size={13} />
              Offline Mode
            </span>
          )}

          {/* Sync status / Cache notice */}
          {snapshot?.weather?.isCached && (
            <span className="text-xs text-white/40">
              Cached: {new Date(snapshot.weather.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {/* Refresh Action */}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:border-stroke-2 hover:bg-glass-2 transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={cn("text-white/70", refreshing && "animate-spin")} />
            {refreshing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* 2. Empty State Trigger */}
      {!isCropActive ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <GlassCard className="p-8 max-w-lg w-full flex flex-col items-center space-y-6" variant="strong">
            <div className="grid h-16 w-16 place-items-center rounded-3xl border border-stroke-2 bg-glass-2 shadow-glowPrimary">
              <Sprout className="text-primary-300" size={28} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white">Add your first crop to activate farm intelligence</h2>
              <p className="subtle text-xs px-4">
                The Farm Command Center is waiting for your seeding dates. Create a plan to enable readiness scores, weather adjustments, and customized recommendations.
              </p>
            </div>
            <button
              onClick={() => navigate('/crop-calendar')}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white font-semibold py-3 px-6 rounded-2xl text-xs uppercase tracking-wider transition shadow-glowPrimary"
            >
              Open Precision Planning
              <ArrowUpRight size={14} />
            </button>
          </GlassCard>
        </div>
      ) : (
        /* Active Farm Workspace View */
        <>
          {/* 3. Hero Command Center */}
          <GlassCard className="p-6 md:p-8 relative overflow-hidden" variant="strong">
            {/* Background Glow */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-700/10 via-transparent to-secondary/5" />
            
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
              
              {/* Left Column: Farm & Crop Metadata */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs uppercase font-bold tracking-widest text-primary-400">
                    Live Diagnostics
                  </span>
                  <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    Good morning, {snapshot?.farm?.name.split("'")[0] || 'Farmer'}
                  </h2>
                  <p className="subtle">
                    {snapshot?.farm?.city} · {snapshot?.farm?.soilType}
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <span className="glass-chip border-stroke-2">
                    <Sprout size={13} className="text-primary-300" />
                    {snapshot?.crop?.name} ({snapshot?.crop?.variety})
                  </span>
                  <span className="glass-chip flex items-center gap-1">
                    <Compass size={13} className="text-white/60" />
                    <span>{snapshot?.crop?.currentStage} stage</span>
                    {snapshot?.crop?.isFarmerSelectedStage && (
                      <span className="text-[9px] text-[#87A96B] font-bold bg-[#87A96B]/10 px-1.5 py-0.5 rounded-full border border-[#87A96B]/20">
                        Farmer Selected
                      </span>
                    )}
                  </span>
                  <span className="glass-chip">
                    <Activity size={13} className="text-white/60" />
                    {snapshot?.crop?.lifecycleProgress}% through cycle
                  </span>
                </div>
              </div>

              {/* Right Column: Circular Farm Readiness Score & Single AI Insight Card */}
              <div className="flex flex-col sm:flex-row items-center gap-6 shrink-0 md:border-l border-white/5 md:pl-6">
                
                {/* SVG Radial Gauge */}
                <div className="relative flex items-center justify-center h-28 w-28 shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="56"
                      cy="56"
                      r="45"
                      className="stroke-white/5"
                      strokeWidth="6"
                      fill="transparent"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r="45"
                      className={cn(
                        "transition-all duration-700 ease-out",
                        snapshot?.readiness?.status === 'Excellent' && "stroke-primary-500",
                        snapshot?.readiness?.status === 'Good' && "stroke-primary-300",
                        snapshot?.readiness?.status === 'Attention Needed' && "stroke-secondary-500",
                        snapshot?.readiness?.status === 'Critical' && "stroke-red-500"
                      )}
                      strokeWidth="7"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 45}
                      strokeDashoffset={
                        2 * Math.PI * 45 -
                        ((snapshot?.readiness?.score ?? 85) / 100) * 2 * Math.PI * 45
                      }
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold tracking-tight text-white">
                      {snapshot?.readiness?.score}
                    </span>
                    <span className="text-[9px] uppercase font-bold tracking-widest text-white/40">
                      Readiness
                    </span>
                  </div>
                </div>

                {/* Score Tagline & Dynamic AI summary card */}
                <div className="space-y-2 text-center sm:text-left max-w-xs">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Readiness: {' '}
                      <span className={cn(
                        snapshot?.readiness?.status === 'Excellent' && "text-primary-400",
                        snapshot?.readiness?.status === 'Good' && "text-primary-300",
                        snapshot?.readiness?.status === 'Attention Needed' && "text-secondary-400",
                        snapshot?.readiness?.status === 'Critical' && "text-red-400"
                      )}>
                        {snapshot?.readiness?.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50 mt-0.5">
                      Updated weather & soil metrics verified
                    </p>
                  </div>
                  
                  {/* Single AI Insight card */}
                  {snapshot?.aiInsights && (
                    <div className="rounded-2xl border border-white/5 bg-white/5 p-3 text-xs leading-relaxed text-white/70 flex items-start gap-2">
                      <Sparkles size={14} className="text-primary-300 shrink-0 mt-0.5" />
                      <p className="line-clamp-3">
                        {snapshot.aiInsights.dailyInsight}
                      </p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          </GlassCard>

          {/* 4. Farm Snapshot Grid (5 Cards) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Card 1: Active Crop */}
            <div className="rounded-3xl border border-white/5 bg-black/20 p-4 transition hover:bg-black/30">
              <div className="text-xs font-semibold text-white/40">Active Crop</div>
              <div className="mt-2 text-base font-semibold text-white">
                {snapshot?.crop?.name}
              </div>
              <div className="mt-1 text-[11px] text-white/60">
                Variety: {snapshot?.crop?.variety}
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50 w-fit">
                  <span className="h-1 w-1 rounded-full bg-primary-400" />
                  {snapshot?.crop?.currentStage}
                </div>
                {snapshot?.crop?.condition && (
                  <div className="text-[10px] text-white/40 font-bold uppercase flex items-center gap-1">
                    Condition: <span className={cn(
                      "font-black text-[11px]",
                      snapshot.crop.condition === 'Healthy' && "text-green-400",
                      snapshot.crop.condition === 'Average' && "text-yellow-400",
                      snapshot.crop.condition === 'Not Growing Well' && "text-orange-400",
                      snapshot.crop.condition === 'Pest/Disease Problem' && "text-red-400",
                      snapshot.crop.condition === 'Not Sure' && "text-white/60"
                    )}>{snapshot.crop.condition}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Soil Health */}
            <div className="rounded-3xl border border-white/5 bg-black/20 p-4 transition hover:bg-black/30">
              <div className="text-xs font-semibold text-white/40">Soil Health</div>
              <div className="mt-2 text-base font-semibold text-white">
                NPK Balanced
              </div>
              <div className="mt-1 text-[11px] text-white/60">
                N={snapshot?.readiness?.breakdown?.soil === 20 ? 'Optimal' : 'Adjust Dose'}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                <span className="h-1 w-1 rounded-full bg-primary-400" />
                Profile complete
              </div>
            </div>

            {/* Card 3: Water Source */}
            <div className="rounded-3xl border border-white/5 bg-black/20 p-4 transition hover:bg-black/30">
              <div className="text-xs font-semibold text-white/40">Water Source</div>
              <div className="mt-2 text-sm font-bold text-white truncate" title={snapshot?.farm?.irrigationSources?.join(', ') || 'Rainfed'}>
                {snapshot?.farm?.irrigationSources && snapshot.farm.irrigationSources.length > 0 
                  ? snapshot.farm.irrigationSources.join(', ') 
                  : 'Rainfed'}
              </div>
              <div className="mt-1 text-[11px] text-white/60">
                ~4,200 L/ac ET rate
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                <span className="h-1 w-1 rounded-full bg-primary-400" />
                Irrigation aligned
              </div>
            </div>

            {/* Card 4: Pest Risk */}
            <div className="rounded-3xl border border-white/5 bg-black/20 p-4 transition hover:bg-black/30">
              <div className="text-xs font-semibold text-white/40">Pest Risk</div>
              <div className="mt-2 text-base font-semibold text-white">
                {snapshot?.readiness?.breakdown?.pest && snapshot.readiness.breakdown.pest >= 12 ? 'Low Risk' : 'Attention'}
              </div>
              <div className="mt-1 text-[11px] text-white/60">
                Recent: {snapshot?.exploreMetrics?.fieldVision?.lastDiagnosis}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                <span className="h-1 w-1 rounded-full bg-primary-400" />
                Scans analyzed
              </div>
            </div>

            {/* Card 5: Operational Status */}
            <div className="rounded-3xl border border-white/5 bg-black/20 p-4 transition hover:bg-black/30 cursor-pointer" onClick={() => navigate('/crop-calendar')}>
              <div className="text-xs font-semibold text-white/40">Operational Status</div>
              <div className="mt-2 text-base font-semibold text-white flex items-center justify-between">
                <span>{snapshot?.exploreMetrics?.precisionPlanning?.activeTasks} Pending</span>
                <ArrowUpRight size={14} className="text-white/45" />
              </div>
              <div className="mt-1 text-[11px] text-white/60">
                Delays check: {snapshot?.alerts?.filter(a => a.type === 'info').length || 0} adjustments
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                <span className="h-1 w-1 rounded-full bg-primary-400" />
                Sync active
              </div>
            </div>
          </div>

          {/* 5. Main Content Grid: Operations Feed & Farm Intelligence */}
          <div className="grid gap-8 lg:grid-cols-3">
            
            {/* Left/Middle Column (lg:col-span-2) */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Operations feed: Today's Focus */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Today's Focus</h3>
                  <span className="text-xs text-white/40">Priority Ranked feed</span>
                </div>
                
                <div className="space-y-3">
                  {snapshot?.focusItems && snapshot.focusItems.length > 0 ? (
                    snapshot.focusItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => navigate(item.link)}
                        className="group flex items-start justify-between gap-4 rounded-2xl border border-white/5 bg-white/5 p-4 cursor-pointer hover:border-stroke-2 hover:bg-glass-2 transition shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "mt-0.5 rounded-xl border p-2 shrink-0",
                            item.priority === 'high' ? "border-red-500/20 bg-red-500/10 text-red-400" :
                            item.priority === 'medium' ? "border-secondary-500/20 bg-secondary-500/10 text-secondary-300" :
                            "border-white/10 bg-white/5 text-white/60"
                          )}>
                            {item.type === 'task' ? <Sprout size={16} /> :
                             item.type === 'alert' ? <AlertTriangle size={16} /> :
                             <Activity size={16} />}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white group-hover:text-primary-300 transition">
                              {item.title}
                            </div>
                            <div className="text-xs text-white/50 mt-1">
                              {item.subtitle}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-center shrink-0">
                          {item.priority === 'high' && (
                            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-400 border border-red-500/20">
                              Critical
                            </span>
                          )}
                          <ChevronRight size={16} className="text-white/30 group-hover:text-white/80 transition" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-8 text-center text-xs text-white/40">
                      No operational actions require focus today. All schedules are up-to-date!
                    </div>
                  )}
                </div>
              </div>

              {/* Farm Map Overview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Geospatial Field Overview</h3>
                  <span className="text-xs text-white/40">Live positioning</span>
                </div>
                <LazyVisible placeholderHeight={240}>
                  <div className="h-72 overflow-hidden rounded-3xl border border-white/5 bg-black/20">
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center text-sm text-white/30">
                          Lazy loading map modules...
                        </div>
                      }
                    >
                      <FarmMap
                        initialCenter={snapshot ? [snapshot.mapData.latitude, snapshot.mapData.longitude] : undefined}
                        farmName={snapshot?.farm?.name}
                      />
                    </Suspense>
                  </div>
                </LazyVisible>
              </div>

            </div>

            {/* Right Column: AI Action Center & Farm Intelligence */}
            <div className="space-y-8">
              
              {/* AI Action Center */}
              <GlassCard className="p-5 flex flex-col space-y-4" variant="strong">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-primary-300" />
                  <h3 className="text-sm font-semibold text-white">AI Action Center</h3>
                </div>

                {/* Quick Prompts Chips */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'todayAdvice', label: 'What should I do today?' },
                    { key: 'waterAdvice', label: 'Water requirement?' },
                    { key: 'pestAdvice', label: 'Pest risk?' },
                    { key: 'fertilizerAdvice', label: 'Fertilizer advice?' }
                  ].map(chip => (
                    <button
                      key={chip.key}
                      onClick={() => toggleAdviceKey(chip.key as any)}
                      className={cn(
                        "rounded-xl border px-3 py-1.5 text-xs font-semibold transition text-left",
                        selectedAdviceKey === chip.key
                          ? "border-primary-500/40 bg-primary-500/10 text-white"
                          : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                      )}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Local advice panel (revealing pre-fetched information) */}
                {selectedAdviceKey && snapshot?.aiInsights && (
                  <div className="rounded-2xl border border-primary-500/20 bg-primary-500/5 p-3.5 text-xs text-white/80 leading-relaxed transition-all">
                    <div className="font-bold text-primary-300 uppercase tracking-wider text-[9px] mb-1">
                      {selectedAdviceKey === 'todayAdvice' && 'Today Focus Advice'}
                      {selectedAdviceKey === 'waterAdvice' && 'Hydration Forecast'}
                      {selectedAdviceKey === 'pestAdvice' && 'IPM early warnings'}
                      {selectedAdviceKey === 'fertilizerAdvice' && 'Stage-specific NPK dosages'}
                    </div>
                    {snapshot.aiInsights[selectedAdviceKey]}
                  </div>
                )}

                {/* Compact ask bar */}
                <form onSubmit={handleAskAgroGPT} className="relative mt-2">
                  <input
                    type="text"
                    placeholder="Ask AgroGPT about soil NPK, pests..."
                    value={askInput}
                    onChange={(e) => setAskInput(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 py-2.5 pl-4 pr-10 text-xs text-white placeholder-white/30 focus:border-stroke-2 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={asking}
                    className="absolute right-2.5 top-2.5 text-white/40 hover:text-white transition disabled:opacity-50"
                  >
                    {asking ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
                  </button>
                </form>

                {/* Inline response container */}
                {(askAnswer || askError) && (
                  <div className="rounded-2xl border border-white/5 bg-white/5 p-3 text-xs leading-relaxed text-white/70 space-y-1">
                    <div className="font-bold text-white/40 uppercase tracking-widest text-[9px]">
                      Answer Feed
                    </div>
                    {askError ? (
                      <p className="text-amber-400/90">{askError}</p>
                    ) : (
                      <p>{askAnswer}</p>
                    )}
                  </div>
                )}
              </GlassCard>

              {/* Farm Intelligence Grid */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Farm Intelligence</h3>
                <div className="space-y-4">
                  
                  {/* Weather Intelligence Card */}
                  <div className="rounded-3xl border border-white/5 bg-black/20 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/40">
                      <span>Weather Forecast</span>
                      <span>Open-Meteo</span>
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {Math.round(snapshot?.weather?.temperature ?? 31)}°C · {snapshot?.weather?.condition}
                    </div>
                    <p className="text-[11px] text-white/60 leading-relaxed">
                      {snapshot?.weather?.weatherCode && snapshot.weather.weatherCode >= 51 ? (
                        'High precipitation code. Suspend foliar insecticide spray passes. Inspect drainage lines.'
                      ) : (
                        'Optimal temperature values. Safe spray window: early morning (6–8 AM) with minimal wind drift.'
                      )}
                    </p>
                  </div>

                  {/* Irrigation Intelligence Card */}
                  <div className="rounded-3xl border border-white/5 bg-black/20 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/40">
                      <span>Irrigation Analysis</span>
                      <span>Hydration index</span>
                    </div>
                    <div className="text-sm font-semibold text-white">
                      ~4,200 Liters/ac·day
                    </div>
                    <p className="text-[11px] text-white/60 leading-relaxed">
                      Based on current {snapshot?.weather?.humidity}% humidity. Root moisture is sufficient. Maintain split daily schedules to avoid root waterlogging.
                    </p>
                  </div>

                  {/* Pest Intelligence Card */}
                  <div className="rounded-3xl border border-white/5 bg-black/20 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/40">
                      <span>Pest Intelligence</span>
                      <span>Early warning</span>
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {snapshot?.readiness?.breakdown?.pest && snapshot.readiness.breakdown.pest >= 12 ? 'No Active Pest Thresholds' : 'Scouting Alert'}
                    </div>
                    <p className="text-[11px] text-white/60 leading-relaxed">
                      Night temperature above 24°C favors thrip spore spreads. Install yellow sticky cards and scout lower foliage weekly.
                    </p>
                  </div>

                  {/* Market Signal Card */}
                  <div className="rounded-3xl border border-white/5 bg-black/20 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/40">
                      <span>Market & Soil Signal</span>
                      <span>Mandi trend</span>
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {snapshot?.exploreMetrics?.marketInsights?.marketTrend}
                    </div>
                    <p className="text-[11px] text-white/60 leading-relaxed">
                      Crop rotation: seed {snapshot?.exploreMetrics?.marketInsights?.recommendedCrop} next to replenish soil nutrients and save fertilization costs.
                    </p>
                  </div>

                </div>
              </div>

            </div>

          </div>
        </>
      )}

      {/* 6. Explore AgroGPT Gateway */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Compass size={18} className="text-primary-400" />
          Explore AgroGPT
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Card 1: Precision Planning */}
          <div
            onClick={() => navigate('/crop-calendar')}
            className="group flex flex-col justify-between rounded-3xl border border-white/5 bg-black/20 p-5 cursor-pointer hover:border-stroke-2 hover:bg-glass-2 transition shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white group-hover:text-primary-300 transition">
                  Crop Calendar
                </div>
                <ArrowUpRight size={14} className="text-white/40 group-hover:text-white transition" />
              </div>
              <p className="text-xs text-white/50 mt-1">
                Precision calendars, milestones, and weather adjustment workflows.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/65">
              <span>Active Tasks:</span>
              <span className="font-semibold text-white">
                {snapshot?.exploreMetrics?.precisionPlanning?.activeTasks}
              </span>
            </div>
          </div>

          {/* Card 2: Field Vision */}
          <div
            onClick={() => navigate('/field-vision')}
            className="group flex flex-col justify-between rounded-3xl border border-white/5 bg-black/20 p-5 cursor-pointer hover:border-stroke-2 hover:bg-glass-2 transition shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white group-hover:text-primary-300 transition">
                  Field Vision
                </div>
                <ArrowUpRight size={14} className="text-white/40 group-hover:text-white transition" />
              </div>
              <p className="text-xs text-white/50 mt-1">
                Disease detection scans, camera analytics, and organic treatments.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/65">
              <span className="truncate max-w-[100px]">
                {snapshot?.exploreMetrics?.fieldVision?.lastDiagnosis}
              </span>
              <span className="font-semibold text-white">
                {snapshot?.exploreMetrics?.fieldVision?.confidence ? (
                  `${Math.round(snapshot.exploreMetrics.fieldVision.confidence * 100)}%`
                ) : 'N/A'}
              </span>
            </div>
          </div>

          {/* Card 3: Market Insights */}
          <div
            onClick={() => navigate('/market')}
            className="group flex flex-col justify-between rounded-3xl border border-white/5 bg-black/20 p-5 cursor-pointer hover:border-stroke-2 hover:bg-glass-2 transition shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white group-hover:text-primary-300 transition">
                  Market & Mandi
                </div>
                <ArrowUpRight size={14} className="text-white/40 group-hover:text-white transition" />
              </div>
              <p className="text-xs text-white/50 mt-1">
                Harvest quality grading advice, price predictions, and rotations.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/65">
              <span>Rec Next:</span>
              <span className="font-semibold text-white truncate max-w-[90px]">
                {snapshot?.exploreMetrics?.marketInsights?.recommendedCrop}
              </span>
            </div>
          </div>

          {/* Card 4: Digital Ledger */}
          <div
            onClick={() => navigate('/digital-khata')}
            className="group flex flex-col justify-between rounded-3xl border border-white/5 bg-black/20 p-5 cursor-pointer hover:border-stroke-2 hover:bg-glass-2 transition shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white group-hover:text-primary-300 transition">
                  Digital Khata
                </div>
                <ArrowUpRight size={14} className="text-white/40 group-hover:text-white transition" />
              </div>
              <p className="text-xs text-white/50 mt-1">
                Voice bookkeeping logs, categorizations, and profit summaries.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/65">
              <span>Net Profit:</span>
              <span className={cn(
                "font-semibold",
                (snapshot?.exploreMetrics?.digitalLedger?.netProfit ?? 0) >= 0 ? "text-green-400" : "text-red-400"
              )}>
                ₹{(snapshot?.exploreMetrics?.digitalLedger?.netProfit ?? 0).toLocaleString()}
              </span>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}


function ChevronRight({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
