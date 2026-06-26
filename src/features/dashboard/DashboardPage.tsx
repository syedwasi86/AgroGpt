import { useEffect, useState, useRef, useCallback } from 'react'
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
import { useAuth } from '../../core/auth/AuthContext'
import { useTranslation } from 'react-i18next'
import { useEnumTranslation } from '../../hooks/useEnumTranslation'
import { sanitizeEnumKey } from '../../hooks/useEnumTranslation'


// ─── Main Dashboard Page ───────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, i18n } = useTranslation(['common', 'dashboard', 'enums', 'validation', 'profile', 'cropCalendar'])
  const { tEnum } = useEnumTranslation()

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

  // In-flight guard: prevents Strict Mode double-invoke from firing two Gemini requests
  const fetchInFlight = useRef(false)

  // Fetch Snapshot DTO from repository
  const loadSnapshot = useCallback(async (force = false) => {
    // Block concurrent fetches — only allow a force-refresh to bypass
    if (fetchInFlight.current && !force) return
    fetchInFlight.current = true

    if (force) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const data = await dashboardRepository.fetchDashboardSnapshot(user?.id, force)
      setSnapshot(data)
    } catch (err: any) {
      console.error('Failed to load dashboard snapshot:', err)
      setError(t('dashboard:loadError', 'Could not aggregate farm data. Showing offline fallbacks.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
      fetchInFlight.current = false
    }
  }, [user?.id, t]) // stable — no component-state deps except user.id

  useEffect(() => {
    if (user?.id) {
      loadSnapshot()
    }
  }, [loadSnapshot, user?.id])

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
      setAskError(t('validation:error', 'Offline: Your question has been queued in your Digital Ledger sync pipeline.'))
      await saveAiQuery(askInput)
    } finally {
      setAsking(false)
    }
  }

  // Quick Action triggers
  const toggleAdviceKey = (key: 'todayAdvice' | 'waterAdvice' | 'pestAdvice' | 'fertilizerAdvice') => {
    setSelectedAdviceKey(prev => (prev === key ? null : key))
  }

  // Helper to translate dynamically generated focus feed titles
  const translateFocusTitle = (title: string) => {
    if (title.startsWith('Overdue: ')) {
      const taskPart = title.substring(9)
      return t('dashboard:overdueTask', 'Overdue: {{task}}', { task: t(`enums:taskTitle.${sanitizeEnumKey(taskPart)}`, taskPart) })
    }
    if (title.startsWith('Weather Delayed: ')) {
      const taskPart = title.substring(17)
      return t('dashboard:weatherDelayedTask', 'Weather Delayed: {{task}}', { task: t(`enums:taskTitle.${sanitizeEnumKey(taskPart)}`, taskPart) })
    }
    if (title.startsWith('Pest Warning: ')) {
      const pestPart = title.substring(14)
      return t('dashboard:pestWarningTitle', 'Pest Warning: {{pest}}', { pest: t(`enums:pestDiagnosis.${sanitizeEnumKey(pestPart)}`, pestPart) })
    }
    if (title.startsWith('Upcoming Phase: ')) {
      const stagePart = title.substring(16)
      return t('dashboard:upcomingPhase', 'Upcoming Phase: {{stage}}', { stage: tEnum('cropStage', stagePart) })
    }
    return t(`enums:taskTitle.${sanitizeEnumKey(title)}`, title)
  }

  // Helper to translate dynamically generated focus feed subtitles
  const translateFocusSubtitle = (subtitle: string, id: string) => {
    if (id.startsWith('overdue-high-')) {
      const match = subtitle.match(/since\s+([0-9-]+)/)
      const dateStr = match ? match[1] : ''
      const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' }) : ''
      return t('dashboard:overdueSubtitle', 'Critical task due since {{date}}. Click to resolve.', { date: formattedDate })
    }
    if (id.startsWith('delayed-')) {
      const match = subtitle.match(/to\s+([0-9-]+)/)
      const dateStr = match ? match[1] : ''
      const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' }) : ''
      return t('dashboard:delayedSubtitle', 'Rescheduled to {{date}} due to weather.', { date: formattedDate })
    }
    if (id.startsWith('pest-warning-')) {
      const match = subtitle.match(/at\s+(\d+)%/)
      const conf = match ? match[1] : ''
      return t('dashboard:pestWarningSubtitle', 'Infection detected at {{conf}}% confidence. Review IPM actions.', { conf })
    }
    if (id.startsWith('transition-')) {
      const match = subtitle.match(/on\s+([0-9-]+)/)
      const dateStr = match ? match[1] : ''
      const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' }) : ''
      return t('dashboard:transitionSubtitle', 'Stage starts on {{date}}. Get inputs ready.', { date: formattedDate })
    }
    return subtitle
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
            {t('dashboard:title')}
          </h1>
          <p className="subtle mt-1">{t('dashboard:subtitle')}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Online/Offline Status Indicator */}
          {dashboardRepository.isOnline() ? (
            <span className="glass-chip border-green-500/30 bg-green-500/10 text-green-400">
              <Wifi size={13} className="animate-pulse" />
              {t('common:online')}
            </span>
          ) : (
            <span className="glass-chip border-amber-500/30 bg-amber-500/10 text-amber-400">
              <WifiOff size={13} />
              {t('common:offline')}
            </span>
          )}

          {/* Sync status / Cache notice */}
          {snapshot?.weather?.isCached && (
            <span className="text-xs text-white/40">
              {t('dashboard:cachedTime', { time: new Date(snapshot.weather.updatedAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' }) })}
            </span>
          )}

          {/* Refresh Action */}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:border-stroke-2 hover:bg-glass-2 transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={cn("text-white/70", refreshing && "animate-spin")} />
            {refreshing ? t('profile:syncing') : t('profile:syncDatabase')}
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
              <h2 className="text-xl font-semibold text-white">{t('dashboard:emptyStateTitle')}</h2>
              <p className="subtle text-xs px-4">
                {t('dashboard:emptyStateDesc')}
              </p>
            </div>
            <button
              onClick={() => navigate('/crop-calendar')}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white font-semibold py-3 px-6 rounded-2xl text-xs uppercase tracking-wider transition shadow-glowPrimary"
            >
              {t('dashboard:emptyStateBtn')}
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
                    {t('dashboard:liveDiagnostics')}
                  </span>
                  <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {t('dashboard:greeting', { name: snapshot?.farm?.name.split("'")[0] || t('common:farmer', 'Farmer') })}
                  </h2>
                  <p className="subtle">
                    {snapshot?.farm?.city} · {tEnum('soilType', snapshot?.farm?.soilType)}
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <span className="glass-chip border-stroke-2">
                    <Sprout size={13} className="text-primary-300" />
                    {tEnum('cropType', snapshot?.crop?.name)} ({snapshot?.crop?.variety === 'Local Variety' ? t('profile:customVariety') : snapshot?.crop?.variety})
                  </span>
                  <span className="glass-chip flex items-center gap-1">
                    <Compass size={13} className="text-white/60" />
                    <span>{tEnum('cropStage', snapshot?.crop?.currentStage)}</span>
                    {snapshot?.crop?.isFarmerSelectedStage && (
                      <span className="text-[9px] text-[#87A96B] font-bold bg-[#87A96B]/10 px-1.5 py-0.5 rounded-full border border-[#87A96B]/20">
                        {t('cropCalendar:farmerSelectedNotice', 'Farmer Selected')}
                      </span>
                    )}
                  </span>
                  <span className="glass-chip">
                    <Activity size={13} className="text-white/60" />
                    {t('dashboard:lifecycleProgress', '{{progress}}% through cycle', { progress: snapshot?.crop?.lifecycleProgress })}
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
                    <span className="text-2xl font-bold tracking-tight text-white font-mono">
                      {snapshot?.readiness?.score}
                    </span>
                    <span className="text-[9px] uppercase font-bold tracking-widest text-white/40">
                      {t('dashboard:readiness')}
                    </span>
                  </div>
                </div>

                {/* Score Tagline & Dynamic AI summary card */}
                <div className="space-y-2 text-center sm:text-left max-w-xs">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {t('dashboard:readiness')}: {' '}
                      <span className={cn(
                        snapshot?.readiness?.status === 'Excellent' && "text-primary-400",
                        snapshot?.readiness?.status === 'Good' && "text-primary-300",
                        snapshot?.readiness?.status === 'Attention Needed' && "text-secondary-400",
                        snapshot?.readiness?.status === 'Critical' && "text-red-400"
                      )}>
                        {snapshot?.readiness?.status === 'Excellent' && t('dashboard:excellent')}
                        {snapshot?.readiness?.status === 'Good' && t('dashboard:good')}
                        {snapshot?.readiness?.status === 'Attention Needed' && t('dashboard:attentionNeeded')}
                        {snapshot?.readiness?.status === 'Critical' && t('dashboard:critical')}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50 mt-0.5">
                      {t('dashboard:readinessSub')}
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
              <div className="text-xs font-semibold text-white/40">{t('profile:activeCropSummary')}</div>
              <div className="mt-2 text-base font-semibold text-white">
                {tEnum('cropType', snapshot?.crop?.name)}
              </div>
              <div className="mt-1 text-[11px] text-white/60">
                {t('profile:variety')}: {snapshot?.crop?.variety === 'Local Variety' ? t('profile:customVariety') : snapshot?.crop?.variety}
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50 w-fit">
                  <span className="h-1 w-1 rounded-full bg-primary-400" />
                  {tEnum('cropStage', snapshot?.crop?.currentStage)}
                </div>
                {snapshot?.crop?.condition && (
                  <div className="text-[10px] text-white/40 font-bold uppercase flex items-center gap-1">
                    {t('profile:cropCondition')}: <span className={cn(
                      "font-black text-[11px]",
                      snapshot.crop.condition === 'Healthy' && "text-green-400",
                      snapshot.crop.condition === 'Average' && "text-yellow-400",
                      snapshot.crop.condition === 'Not Growing Well' && "text-orange-400",
                      snapshot.crop.condition === 'Pest/Disease Problem' && "text-red-400",
                      snapshot.crop.condition === 'Not Sure' && "text-white/60"
                    )}>{tEnum('cropCondition', snapshot.crop.condition)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Soil Health */}
            <div className="rounded-3xl border border-white/5 bg-black/20 p-4 transition hover:bg-black/30">
              <div className="text-xs font-semibold text-white/40">{t('dashboard:soilHealth')}</div>
              <div className="mt-2 text-base font-semibold text-white">
                {t('dashboard:npkBalanced')}
              </div>
              <div className="mt-1 text-[11px] text-white/60">
                N={snapshot?.readiness?.breakdown?.soil === 20 ? t('dashboard:optimal') : t('dashboard:adjustDose')}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                <span className="h-1 w-1 rounded-full bg-primary-400" />
                {t('dashboard:profileComplete', 'Profile complete')}
              </div>
            </div>

            {/* Card 3: Water Source */}
            <div className="rounded-3xl border border-white/5 bg-black/20 p-4 transition hover:bg-black/30">
              <div className="text-xs font-semibold text-white/40">{t('dashboard:waterSource', 'Water Source')}</div>
              <div className="mt-2 text-sm font-bold text-white truncate" title={snapshot?.farm?.irrigationSources?.map(src => tEnum('waterSource', src)).join(', ') || t('enums:waterSource.rainfed', 'Rainfed')}>
                {snapshot?.farm?.irrigationSources && snapshot.farm.irrigationSources.length > 0 
                  ? snapshot.farm.irrigationSources.map(src => tEnum('waterSource', src)).join(', ') 
                  : t('enums:waterSource.rainfed', 'Rainfed')}
              </div>
              <div className="mt-1 text-[11px] text-white/60 font-mono">
                {t('dashboard:etRate', '~4,200 L/ac ET rate')}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                <span className="h-1 w-1 rounded-full bg-primary-400" />
                {t('dashboard:irrigationAligned', 'Irrigation aligned')}
              </div>
            </div>

            {/* Card 4: Pest Risk */}
            <div className="rounded-3xl border border-white/5 bg-black/20 p-4 transition hover:bg-black/30">
              <div className="text-xs font-semibold text-white/40">{t('dashboard:pestRisk')}</div>
              <div className="mt-2 text-base font-semibold text-white">
                {snapshot?.readiness?.breakdown?.pest && snapshot.readiness.breakdown.pest >= 12 ? t('dashboard:pestNoThresholds') : t('dashboard:pestScoutingAlert')}
              </div>
              <div className="mt-1 text-[11px] text-white/60">
                {t('dashboard:recent')}: {tEnum('pestDiagnosis', snapshot?.exploreMetrics?.fieldVision?.lastDiagnosis)}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                <span className="h-1 w-1 rounded-full bg-primary-400" />
                {t('dashboard:scansAnalyzed', 'Scans analyzed')}
              </div>
            </div>

            {/* Card 5: Operational Status */}
            <div className="rounded-3xl border border-white/5 bg-black/20 p-4 transition hover:bg-black/30 cursor-pointer" onClick={() => navigate('/crop-calendar')}>
              <div className="text-xs font-semibold text-white/40">{t('dashboard:operationalStatus')}</div>
              <div className="mt-2 text-base font-semibold text-white flex items-center justify-between">
                <span className="font-mono">{snapshot?.exploreMetrics?.precisionPlanning?.activeTasks} {t('cropCalendar:pending')}</span>
                <ArrowUpRight size={14} className="text-white/45" />
              </div>
              <div className="mt-1 text-[11px] text-white/60 font-mono">
                {t('dashboard:delaysCheck', 'Delays check')}: {snapshot?.alerts?.filter(a => a.type === 'info').length || 0}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                <span className="h-1 w-1 rounded-full bg-primary-400" />
                {t('dashboard:syncActive', 'Sync active')}
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
                  <h3 className="text-lg font-semibold text-white">{t('dashboard:todaysFocus')}</h3>
                  <span className="text-xs text-white/40">{t('dashboard:focusSub')}</span>
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
                              {translateFocusTitle(item.title)}
                            </div>
                            <div className="text-xs text-white/50 mt-1">
                              {translateFocusSubtitle(item.subtitle, item.id)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-center shrink-0">
                          {item.priority === 'high' && (
                            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-400 border border-red-500/20">
                              {t('cropCalendar:overdue')}
                            </span>
                          )}
                          <ChevronRight size={16} className="text-white/30 group-hover:text-white/80 transition" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-8 text-center text-xs text-white/40">
                      {t('dashboard:focusEmpty')}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Right Column: AI Action Center & Farm Intelligence */}
            <div className="space-y-8">
              
              {/* AI Action Center */}
              <GlassCard className="p-5 flex flex-col space-y-4" variant="strong">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-primary-300" />
                  <h3 className="text-sm font-semibold text-white">{t('dashboard:aiActionCenter')}</h3>
                </div>

                {/* Quick Prompts Chips */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'todayAdvice', label: t('dashboard:todayPrompt') },
                    { key: 'waterAdvice', label: t('dashboard:waterPrompt') },
                    { key: 'pestAdvice', label: t('dashboard:pestPrompt') },
                    { key: 'fertilizerAdvice', label: t('dashboard:fertilizerPrompt') }
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
                      {selectedAdviceKey === 'todayAdvice' && t('dashboard:todayAdvice')}
                      {selectedAdviceKey === 'waterAdvice' && t('dashboard:waterAdvice')}
                      {selectedAdviceKey === 'pestAdvice' && t('dashboard:pestAdvice')}
                      {selectedAdviceKey === 'fertilizerAdvice' && t('dashboard:fertilizerAdvice')}
                    </div>
                    {snapshot.aiInsights[selectedAdviceKey]}
                  </div>
                )}

                {/* Compact ask bar */}
                <form onSubmit={handleAskAgroGPT} className="relative mt-2">
                  <input
                    type="text"
                    placeholder={t('dashboard:askAgroPlaceholder')}
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
                      {t('dashboard:answerFeed')}
                    </div>
                    {askError ? (
                      <p className="text-amber-400/90">{askError}</p>
                    ) : (
                      <p>{askAnswer}</p>
                    )}
                  </div>
                )}
              </GlassCard>
            </div>

          </div>

          {/* 5.5 Farm Intelligence Section (horizontal on large screens, vertical on mobile) */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">{t('dashboard:farmIntelligence')}</h3>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              
              {/* Weather Intelligence Card */}
              <div className="rounded-3xl border border-white/5 bg-black/20 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-white/40">
                  <span>{t('dashboard:weatherForecast')}</span>
                  <span>{t('dashboard:weatherProvider')}</span>
                </div>
                <div className="text-sm font-semibold text-white font-mono">
                  {Math.round(snapshot?.weather?.temperature ?? 31)}°C · {snapshot?.weather?.condition}
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  {snapshot?.weather?.weatherCode && snapshot.weather.weatherCode >= 51 ? (
                    t('dashboard:weatherConditionHighRain')
                  ) : (
                    t('dashboard:weatherConditionOptimal')
                  )}
                </p>
              </div>

              {/* Irrigation Intelligence Card */}
              <div className="rounded-3xl border border-white/5 bg-black/20 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-white/40">
                  <span>{t('dashboard:irrigationAnalysis')}</span>
                  <span>{t('dashboard:hydrationIndex')}</span>
                </div>
                <div className="text-sm font-semibold text-white font-mono">
                  {t('dashboard:etRate')}
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  {t('dashboard:irrigationDesc', { humidity: snapshot?.weather?.humidity })}
                </p>
              </div>

              {/* Pest Intelligence Card */}
              <div className="rounded-3xl border border-white/5 bg-black/20 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-white/40">
                  <span>{t('dashboard:pestIntelligence')}</span>
                  <span>{t('dashboard:pestWarningSub')}</span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {snapshot?.readiness?.breakdown?.pest && snapshot.readiness.breakdown.pest >= 12 ? t('dashboard:pestNoThresholds') : t('dashboard:pestScoutingAlert')}
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  {t('dashboard:pestDesc')}
                </p>
              </div>

              {/* Market Signal Card */}
              <div className="rounded-3xl border border-white/5 bg-black/20 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-white/40">
                  <span>{t('dashboard:marketSignal')}</span>
                  <span>{t('dashboard:mandiTrend')}</span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {snapshot?.exploreMetrics?.marketInsights?.marketTrend}
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  {t('dashboard:rotationDesc', { recommendedCrop: tEnum('cropType', snapshot?.exploreMetrics?.marketInsights?.recommendedCrop) })}
                </p>
              </div>

            </div>

          </div>
        </>
      )}

      {/* 6. Explore AgroGPT Gateway */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Compass size={18} className="text-primary-400" />
          {t('dashboard:exploreAgro')}
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
                  {t('dashboard:cropCalendar')}
                </div>
                <ArrowUpRight size={14} className="text-white/40 group-hover:text-white transition" />
              </div>
              <p className="text-xs text-white/50 mt-1">
                {t('dashboard:cropCalendarDesc')}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/65 font-mono">
              <span>{t('dashboard:activeTasks')}</span>
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
                  {t('dashboard:fieldVision')}
                </div>
                <ArrowUpRight size={14} className="text-white/40 group-hover:text-white transition" />
              </div>
              <p className="text-xs text-white/50 mt-1">
                {t('dashboard:fieldVisionDesc')}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/65">
              <span className="truncate max-w-[100px]">
                {tEnum('pestDiagnosis', snapshot?.exploreMetrics?.fieldVision?.lastDiagnosis)}
              </span>
              <span className="font-semibold text-white font-mono">
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
                  {t('dashboard:marketMandi')}
                </div>
                <ArrowUpRight size={14} className="text-white/40 group-hover:text-white transition" />
              </div>
              <p className="text-xs text-white/50 mt-1">
                {t('dashboard:marketMandiDesc')}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/65">
              <span>{t('dashboard:recNext')}</span>
              <span className="font-semibold text-white truncate max-w-[90px]">
                {tEnum('cropType', snapshot?.exploreMetrics?.marketInsights?.recommendedCrop)}
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
                  {t('dashboard:digitalLedger')}
                </div>
                <ArrowUpRight size={14} className="text-white/40 group-hover:text-white transition" />
              </div>
              <p className="text-xs text-white/50 mt-1">
                {t('dashboard:digitalLedgerDesc')}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/65">
              <span>{t('dashboard:netProfit')}</span>
              <span className={cn(
                "font-semibold font-mono",
                (snapshot?.exploreMetrics?.digitalLedger?.netProfit ?? 0) >= 0 ? "text-green-400" : "text-red-400"
              )}>
                ₹{(snapshot?.exploreMetrics?.digitalLedger?.netProfit ?? 0).toLocaleString(i18n.language, { numberingSystem: 'latn' })}
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
