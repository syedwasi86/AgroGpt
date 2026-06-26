import { useEffect, useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { cn } from '../../../core/utils/cn'
import { db } from '../../../lib/db'
import { cropCalendarRepository } from '../repositories/cropCalendarRepository'
import { profileRepository } from '../../../lib/profileRepository'
import { cropCalendarService } from '../services/cropCalendarService'
import { cropTemplates } from '../templates/cropTemplates'
import { getTodayUtcString, formatUtcToLocal } from '../utils/dateUtils'
import { getUserLocation } from '../../../core/utils/geolocation'
import { fetchDailyWeather } from '../../gis/services/weatherService'
import { CropSummaryCard } from '../components/CropSummaryCard'
import { StageTimeline } from '../components/StageTimeline'
import { TaskList } from '../components/TaskList'
import { CalendarGrid } from '../components/CalendarGrid'
import { WeatherAdvisory } from '../components/WeatherAdvisory'
import { TodayFocusCard } from '../components/TodayFocusCard'
import { QuickInsights } from '../components/QuickInsights'
import { UpcomingMilestones } from '../components/UpcomingMilestones'
import { SectionContainer } from '../shared/ui/SectionContainer'
import { GlassCard } from '../../../components/GlassCard'
import { SkeletonCard } from '../../../components/Skeleton'
import { Trash2, Sprout, Plus, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEnumTranslation } from '../../../hooks/useEnumTranslation'
import {
  getTodayTasks,
  getOverdueTasks,
  selectCurrentStage,
  selectLifecycleProgress,
  selectEstimatedHarvestDate,
  selectDaysInCurrentStage,
  selectDaysUntilNextStage,
  selectUpcomingMilestones
} from '../selectors'
import type { WeatherAlert } from '../engines/weatherAdjustmentEngine'
import type { FarmTaskRecord } from '../../../lib/db'

export function PrecisionPlanningPage() {
  const { t } = useTranslation(['common', 'cropCalendar'])
  const { tEnum } = useEnumTranslation()

  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'calendar'>('today')
  const [selectedDate, setSelectedDate] = useState(getTodayUtcString())
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlert[]>([])
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Sowing setup form fields
  const [selectedCrop, setSelectedCrop] = useState('Cotton')
  const [variety, setVariety] = useState(cropTemplates['Cotton']?.variety || '')
  const [sowingDate, setSowingDate] = useState(getTodayUtcString())
  const [area, setArea] = useState('1.5')

  // Automatically update variety when selected crop changes
  useEffect(() => {
    const template = cropTemplates[selectedCrop]
    if (template) {
      setVariety(template.variety)
    }
  }, [selectedCrop])

  // Live queries observing local Dexie database
  const activePlan = useLiveQuery(() => cropCalendarRepository.getActivePlan())
  const stages = useLiveQuery(() => activePlan ? cropCalendarRepository.getStagesForPlan(activePlan.id) : Promise.resolve([]), [activePlan])
  const tasks = useLiveQuery(() => activePlan ? cropCalendarRepository.getTasksForPlan(activePlan.id) : Promise.resolve([]), [activePlan])

  // Fetch coordinates and apply weather forecasting adjustments
  useEffect(() => {
    if (!activePlan) return

    const checkWeatherAndAdjust = async () => {
      try {
        const profile = await profileRepository.getCurrentProfile()
        if (!profile) {
          throw new Error('Profile not found. Cannot evaluate weather adjustment.')
        }
        const coords = profile.latitude !== undefined && profile.longitude !== undefined
          ? { latitude: profile.latitude, longitude: profile.longitude }
          : await getUserLocation().catch(() => ({ latitude: 20.5937, longitude: 78.9629 }))
        const forecast = await fetchDailyWeather(coords.latitude, coords.longitude)
        const template = cropTemplates[activePlan.crop_type]

        if (forecast && template) {
          const alerts = await cropCalendarService.applyWeatherForecast(
            activePlan.id,
            forecast,
            template.weatherSensitivity
          )
          setWeatherAlerts(alerts)
        }
      } catch (err) {
        console.error('Weather sync adjustment failed offline:', err)
      }
    }

    checkWeatherAndAdjust()
  }, [activePlan])

  // Compute stats dynamically in selectors layer
  const todayStr = useMemo(() => getTodayUtcString(), [])

  const overdueTasks = useMemo(() => {
    if (!tasks) return []
    return getOverdueTasks(tasks, todayStr)
  }, [tasks, todayStr])

  const todayTasks = useMemo(() => {
    if (!tasks) return []
    return getTodayTasks(tasks, todayStr)
  }, [tasks, todayStr])

  const upcomingTasks = useMemo(() => {
    if (!tasks) return []
    // Get next 7 days tasks (excluding today's completed ones, show pending upcoming)
    const limitDate = new Date()
    limitDate.setUTCDate(limitDate.getUTCDate() + 7)
    const limitDateStr = limitDate.toISOString().split('T')[0]
    
    return tasks.filter(tVal => 
      !tVal.deleted_at &&
      tVal.status !== 'completed' &&
      tVal.effective_date > todayStr &&
      tVal.effective_date <= limitDateStr
    )
  }, [tasks, todayStr])

  const currentStage = useMemo(() => {
    if (!stages || !activePlan) return undefined
    if (activePlan.farmer_selected_stage) {
      const matched = stages.find(s => {
        const stageName = s.name || s.stage_name;
        return stageName && stageName.toLowerCase().includes(activePlan.farmer_selected_stage!.toLowerCase());
      })
      if (matched) return matched
    }
    return selectCurrentStage(stages, activePlan.sowing_date, todayStr)
  }, [stages, activePlan, todayStr])

  const lifecycleProgress = useMemo(() => {
    if (!activePlan) return 0
    const template = cropTemplates[activePlan.crop_type]
    if (!template) return 0
    return selectLifecycleProgress(activePlan.sowing_date, template.lifecycleDuration, todayStr)
  }, [activePlan, todayStr])

  // Call dynamic selectors for redesign requirements
  const estimatedHarvestDate = useMemo(() => {
    if (!activePlan) return ''
    const template = cropTemplates[activePlan.crop_type]
    return selectEstimatedHarvestDate(activePlan.sowing_date, template.lifecycleDuration)
  }, [activePlan])

  const daysInStage = useMemo(() => {
    if (!stages) return 0
    return selectDaysInCurrentStage(stages, currentStage?.id, todayStr)
  }, [stages, currentStage, todayStr])

  const nextStageEstimate = useMemo(() => {
    if (!stages) return null
    return selectDaysUntilNextStage(stages, currentStage?.id, todayStr)
  }, [stages, currentStage, todayStr])

  const milestones = useMemo(() => {
    if (!stages || !activePlan) return []
    const template = cropTemplates[activePlan.crop_type]
    return selectUpcomingMilestones(stages, activePlan.sowing_date, template.lifecycleDuration, todayStr)
  }, [stages, activePlan, todayStr])

  // Get tasks filtered for the selected calendar date
  const selectedDateTasks = useMemo(() => {
    if (!tasks) return []
    return tasks.filter(tVal => tVal.effective_date === selectedDate && !tVal.deleted_at)
  }, [tasks, selectedDate])

  const handleToggleCompletion = async (task: FarmTaskRecord) => {
    await cropCalendarService.toggleTaskCompletion(task)
  }

  const handleSaveNotes = async (task: FarmTaskRecord, notes: string) => {
    await cropCalendarService.updateTaskNotes(task, notes)
  }

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormSubmitting(true)
    try {
      await cropCalendarService.initializeCropPlan({
        cropType: selectedCrop,
        variety,
        sowingDate,
        area: Number(area) || 1
      })
    } catch (err) {
      console.error(err)
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDeletePlan = async () => {
    if (activePlan && window.confirm(t('cropCalendar.resetConfirm', 'Are you sure you want to delete and reset your current crop calendar?'))) {
      await cropCalendarService.deleteCropPlan(activePlan.id)
      setWeatherAlerts([])
    }
  }

  // Task counters for tabs
  const pendingTodayCount = useMemo(() => todayTasks.filter(tVal => tVal.status !== 'completed').length, [todayTasks])
  const pendingWeekCount = useMemo(() => upcomingTasks.length, [upcomingTasks])

  // Loading Skeleton State
  const isLoading = activePlan === undefined || (activePlan !== null && (stages === undefined || tasks === undefined))

  if (isLoading) {
    return (
      <div className="px-6 pb-20 pt-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-44" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SkeletonCard className="h-72" />
            <SkeletonCard className="h-72 md:col-span-2" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 pb-20 pt-6">
      <div className="flex flex-col gap-5 md:gap-6 h-full max-w-7xl mx-auto">
        
        {/* HEADER SECTION */}
        <header className="flex items-center justify-between flex-wrap gap-4 border-b border-white/5 pb-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white flex items-center gap-2">
              {t('cropCalendar.title', 'Precision Planning')}
            </h1>
            <p className="text-white/50 mt-1 font-medium text-xs md:text-sm">
              {t('cropCalendar.subtitle', 'Track crop growth, operations, and field activities')}
            </p>
          </div>
          {activePlan && (
            <button
              onClick={handleDeletePlan}
              className="flex items-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 px-4 py-2 rounded-2xl text-xs font-bold transition-all uppercase tracking-wider"
            >
              <Trash2 size={13} />
              {t('cropCalendar.resetPlan', 'Reset Plan')}
            </button>
          )}
        </header>

        {/* SETUP WIZARD (If no active plan is running) */}
        {!activePlan ? (
          <div className="flex-1 flex items-center justify-center py-10">
            <GlassCard className="p-6 md:p-8 max-w-xl w-full border-white/5 bg-[#121412]/90 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] rounded-3xl" variant="strong">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3.5 bg-[#87A96B]/20 text-[#87A96B] rounded-2xl border border-[#87A96B]/30">
                  <Sprout size={24} />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">
                    {t('cropCalendar.startCycle', 'Start New Crop Cycle')}
                  </h2>
                  <p className="text-white/40 text-xs mt-1">
                    {t('cropCalendar.sowSeedsDesc', 'Sow crop seeds to generate a daily operations schedule')}
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreatePlan} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                    {t('cropCalendar.cropType', 'Crop Type')}
                  </label>
                  <select
                    value={selectedCrop}
                    onChange={(e) => setSelectedCrop(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#87A96B]/50 transition-colors"
                  >
                    {Object.keys(cropTemplates).map(c => (
                      <option key={c} value={c}>{tEnum('cropType', c)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                    {t('cropCalendar.varietyBrand', 'Variety / Seed Brand')}
                  </label>
                  <input
                    type="text"
                    required
                    value={variety}
                    onChange={(e) => setVariety(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#87A96B]/50 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                      {t('cropCalendar.sowingDate', 'Sowing Date')}
                    </label>
                    <input
                      type="date"
                      required
                      value={sowingDate}
                      onChange={(e) => setSowingDate(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#87A96B]/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                      {t('cropCalendar.acreage', 'Acreage (Area)')}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      min="0.1"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#87A96B]/50 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-[#87A96B] hover:bg-[#87A96B]/90 text-white font-extrabold uppercase py-3.5 px-6 rounded-2xl text-xs tracking-wider transition-all duration-300 shadow-[0_10px_20px_-5px_rgba(135,169,107,0.4)]"
                >
                  {formSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={16} />
                      {t('cropCalendar.generatePlanning', 'Generate Planning Schedule')}
                    </>
                  )}
                </button>
              </form>
            </GlassCard>
          </div>
        ) : (
          /* ACTIVE AGRICULTURAL WORKSPACE VIEW */
          <div className="space-y-4 md:space-y-6">
            
            {/* 2. CROP LIFECYCLE SECTION (Page Anchor) */}
            <SectionContainer 
              title={t('cropCalendar.cropLifecycle', 'Crop Lifecycle')} 
              subtitle={t('cropCalendar.growthJourney', 'Dynamic growth journey and development stage tracker')}
            >
              <StageTimeline
                stages={stages || []}
                currentStage={currentStage}
                progress={lifecycleProgress}
                daysInStage={daysInStage}
                nextStageEstimate={nextStageEstimate}
                isFarmerSelectedStage={!!activePlan.farmer_selected_stage}
              />
            </SectionContainer>

            {/* 3. CROP SUMMARY + TODAY'S FOCUS SECTION (Responsive Mobile Ordering Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
              {/* Crop Summary (order-2 on mobile, order-1 on desktop) */}
              <div className="lg:col-span-2 order-2 lg:order-1">
                <CropSummaryCard
                  plan={activePlan}
                  estimatedHarvestDate={estimatedHarvestDate}
                  progress={lifecycleProgress}
                />
              </div>

              {/* Today's Focus Card (order-1 on mobile, order-2 on desktop) */}
              <div className="lg:col-span-3 order-1 lg:order-2">
                <TodayFocusCard
                  tasks={tasks || []}
                  weatherAlerts={weatherAlerts}
                  currentDateUtc={todayStr}
                />
              </div>
            </div>

            {/* 4. WEATHER ADVISORY SECTION */}
            <SectionContainer 
              title={t('cropCalendar.weatherAdvisory', 'Weather Advisory')} 
              subtitle={t('cropCalendar.supportiveForecasts', 'Supportive weather forecasts and spray/irrigation advisories')}
            >
              <WeatherAdvisory alerts={weatherAlerts} />
            </SectionContainer>

            {/* 5. FARM OPERATIONS SECTION */}
            <SectionContainer 
              title={t('cropCalendar.farmOperations', 'Farm Operations')} 
              subtitle={t('cropCalendar.manageActivities', 'Manage and complete scheduled farming activities')}
            >
              <div className="space-y-4">
                {/* Tabs */}
                <div className="flex bg-black/30 border border-white/5 p-1 rounded-2xl self-start gap-1">
                  <button
                    onClick={() => setActiveTab('today')}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                      activeTab === 'today'
                        ? "bg-[#87A96B] text-white shadow-md"
                        : "text-white/40 hover:text-white/70"
                    )}
                  >
                    <span>{t('cropCalendar.today', 'Today')}</span>
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-full font-extrabold",
                      activeTab === 'today' ? "bg-white/20 text-white" : "bg-white/5 text-white/40"
                    )}>
                      {pendingTodayCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('week')}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                      activeTab === 'week'
                        ? "bg-[#87A96B] text-white shadow-md"
                        : "text-white/40 hover:text-white/70"
                    )}
                  >
                    <span>{t('cropCalendar.thisWeek', 'This Week')}</span>
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-full font-extrabold",
                      activeTab === 'week' ? "bg-white/20 text-white" : "bg-white/5 text-white/40"
                    )}>
                      {pendingWeekCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('calendar')}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                      activeTab === 'calendar'
                        ? "bg-[#87A96B] text-white shadow-md"
                        : "text-white/40 hover:text-white/70"
                    )}
                  >
                    {t('cropCalendar.calendar', 'Calendar')}
                  </button>
                </div>

                {/* Day View */}
                {activeTab === 'today' && (
                  <TaskList
                    tasks={todayTasks}
                    overdueTasks={overdueTasks}
                    onToggleCompletion={handleToggleCompletion}
                    onSaveNotes={handleSaveNotes}
                    title={t('cropCalendar.operationsScheduledToday', 'Operations Scheduled for Today')}
                  />
                )}

                {/* Week View */}
                {activeTab === 'week' && (
                  <TaskList
                    tasks={upcomingTasks}
                    overdueTasks={overdueTasks}
                    onToggleCompletion={handleToggleCompletion}
                    onSaveNotes={handleSaveNotes}
                    title={t('cropCalendar.operationsScheduledWeek', 'Operations Scheduled for next 7 days')}
                  />
                )}

                {/* Calendar View */}
                {activeTab === 'calendar' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <CalendarGrid
                      tasks={tasks || []}
                      selectedDate={selectedDate}
                      onSelectDate={setSelectedDate}
                    />
                    <TaskList
                      tasks={selectedDateTasks}
                      overdueTasks={[]}
                      onToggleCompletion={handleToggleCompletion}
                      onSaveNotes={handleSaveNotes}
                      title={t('cropCalendar.operationsScheduledDate', 'Operations Scheduled: {{date}}', { date: formatUtcToLocal(selectedDate) })}
                    />
                  </div>
                )}
              </div>
            </SectionContainer>

            {/* 6. QUICK INSIGHTS SECTION */}
            <SectionContainer 
              title={t('cropCalendar.quickInsights', 'Quick Insights')} 
              subtitle={t('cropCalendar.intelligentObservations', 'Intelligent agronomic observations and observations')}
            >
              <QuickInsights tasks={tasks || []} weatherAlerts={weatherAlerts} />
            </SectionContainer>

            {/* 7. UPCOMING MILESTONES SECTION */}
            <SectionContainer 
              title={t('cropCalendar.upcomingMilestones', 'Upcoming Milestones')} 
              subtitle={t('cropCalendar.timelineOfGrowth', 'Timeline of next growth phase predictions and harvest expectations')}
            >
              <UpcomingMilestones milestones={milestones} />
            </SectionContainer>

          </div>
        )}
        
      </div>
    </div>
  )
}
