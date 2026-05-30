import { db } from '../../lib/db'
import type { DashboardCacheRecord, CropPlanRecord, CropStageRecord, FarmTaskRecord, ScanRecord } from '../../lib/db'
import { cropCalendarRepository } from '../crop-calendar/repositories/cropCalendarRepository'
import { cropTemplates } from '../crop-calendar/templates/cropTemplates'
import { getTodayUtcString } from '../crop-calendar/utils/dateUtils'
import { fetchWeather, getWeatherCondition, type WeatherData } from '../gis/services/weatherService'
import { getUserLocation } from '../../core/utils/geolocation'

// ─── Interfaces & Types ────────────────────────────────────────────────────────

export interface FocusOperationItem {
  id: string
  type: 'task' | 'alert' | 'transition'
  title: string
  subtitle: string
  time?: string
  link: string
  priority: 'low' | 'medium' | 'high'
}

export interface DashboardSnapshot {
  farm: {
    name: string
    city: string
    soilType: string
    totalAcreage: number
  }
  crop: {
    active: boolean
    name?: string
    variety?: string
    sowingDate?: string
    currentStage?: string
    lifecycleProgress?: number
  } | null
  readiness: {
    score: number
    status: 'Excellent' | 'Good' | 'Attention Needed' | 'Critical'
    breakdown: {
      tasks: number
      soil: number
      irrigation: number
      pest: number
      weather: number
      progress: number
    }
  }
  weather: {
    temperature: number
    humidity: number
    windSpeed: number
    weatherCode: number
    condition: string
    isCached: boolean
    updatedAt: string
  }
  alerts: Array<{
    id: string
    type: 'warning' | 'info' | 'danger'
    message: string
    title: string
  }>
  focusItems: FocusOperationItem[]
  aiInsights: {
    dailyInsight: string
    todayAdvice: string
    waterAdvice: string
    pestAdvice: string
    fertilizerAdvice: string
    isCached: boolean
    updatedAt: string
  } | null
  exploreMetrics: {
    precisionPlanning: { activeTasks: number; currentStage: string }
    fieldVision: { lastDiagnosis: string; confidence: number }
    marketInsights: { recommendedCrop: string; marketTrend: string }
    digitalLedger: { netProfit: number; monthlyChange: number }
  }
  mapData: {
    latitude: number
    longitude: number
    zoom: number
    activeCrop?: string
    acreage?: number
    lastScanStatus?: string
  }
  // Future proof hooks:
  ndviMetrics?: any
  droneMetrics?: any
  yieldPredictions?: any
  diseaseForecasts?: any
}

// ─── Constants & Fallbacks ───────────────────────────────────────────────────

const CACHE_SNAPSHOT_KEY = 'snapshot'
const CACHE_WEATHER_KEY = 'weather'
const CACHE_AI_INSIGHTS_KEY = 'ai-insights'

const SNAPSHOT_EXPIRY_MS = 15 * 60 * 1000 // 15 mins
const WEATHER_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

const HYDERABAD_LAT_LON: [number, number] = [17.385, 78.4867]

const SOIL_NPK_DEFAULTS: Record<string, { n: number; p: number; k: number }> = {
  'Red Chalka': { n: 120, p: 40, k: 30 },
  'Black Regur': { n: 140, p: 60, k: 45 },
  'Red Sandy Loam': { n: 100, p: 50, k: 50 },
  'default': { n: 100, p: 50, k: 50 }
}

// ─── Dashboard Repository Implementation ──────────────────────────────────────

export const dashboardRepository = {
  /**
   * Checks online status of client.
   */
  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  },

  /**
   * Helper to fetch record from Dexie cache.
   */
  async getCacheRecord(key: string): Promise<DashboardCacheRecord | undefined> {
    try {
      return await db.dashboard_cache.get(key)
    } catch (e) {
      console.warn('[DashboardRepository] Error reading cache:', e)
      return undefined
    }
  },

  /**
   * Helper to write record to Dexie cache.
   */
  async setCacheRecord(
    key: string,
    type: DashboardCacheRecord['type'],
    payload: unknown,
    expiryMs?: number
  ): Promise<void> {
    try {
      const now = new Date()
      const record: DashboardCacheRecord = {
        key,
        type,
        payload,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        expires_at: expiryMs ? new Date(now.getTime() + expiryMs).toISOString() : undefined
      }
      await db.dashboard_cache.put(record)
    } catch (e) {
      console.warn('[DashboardRepository] Error writing cache:', e)
    }
  },

  /**
   * Main entry point: aggregates snapshot DTO, utilizing caching and refresh validation.
   */
  async fetchDashboardSnapshot(userId?: string, forceRefresh = false): Promise<DashboardSnapshot> {
    const todayStr = getTodayUtcString()
    
    // Compute current state fingerprint to check if cache is dirty
    const activePlan = await cropCalendarRepository.getActivePlan(userId)
    const plansCount = await db.crop_plans.count()
    const taskCount = activePlan ? await db.farm_tasks.where('plan_id').equals(activePlan.id).count() : 0
    const completedCount = activePlan ? await db.farm_tasks.where('plan_id').equals(activePlan.id).filter(t => t.status === 'completed').count() : 0
    const scansCount = await db.scans.count()
    const txCount = await db.transactions.count()
    
    const fingerprint = {
      activePlanId: activePlan?.id || 'none',
      plansCount,
      taskCount,
      completedCount,
      scansCount,
      txCount
    }

    // 1. Check Snapshot Cache with Fingerprint Match
    if (!forceRefresh) {
      const cached = await this.getCacheRecord(CACHE_SNAPSHOT_KEY)
      if (cached) {
        const cachedData = cached.payload as { fingerprint: typeof fingerprint; dto: DashboardSnapshot }
        const isFingerprintMatch = cachedData && cachedData.fingerprint &&
          cachedData.fingerprint.activePlanId === fingerprint.activePlanId &&
          cachedData.fingerprint.plansCount === fingerprint.plansCount &&
          cachedData.fingerprint.taskCount === fingerprint.taskCount &&
          cachedData.fingerprint.completedCount === fingerprint.completedCount &&
          cachedData.fingerprint.scansCount === fingerprint.scansCount &&
          cachedData.fingerprint.txCount === fingerprint.txCount

        if (isFingerprintMatch && cached.expires_at && new Date(cached.expires_at) > new Date()) {
          const dto = cachedData.dto
          // Mark as cached
          dto.weather.isCached = true
          if (dto.aiInsights) dto.aiInsights.isCached = true
          return dto
        }
      }
    }

    // 2. Fetch Base Aggregations (Dexie local tables)
    // Profile
    let profile: any = await db.profiles.toArray().then(a => a[0])
    if (!profile) {
      // Seed fallback profile to ensure no errors
      const nowStr = new Date().toISOString()
      const fallbackId = userId || crypto.randomUUID()
      await db.profiles.put({
        id: fallbackId,
        phone: '',
        city: 'Hyderabad',
        soil_type: 'Red Sandy Loam',
        primary_crop: 'Cotton',
        total_acreage: 2,
        nitrogen: 100,
        phosphorus: 50,
        potassium: 50,
        created_at: nowStr,
        updated_at: nowStr
      })
      profile = await db.profiles.get(fallbackId)
    }

    const farmName = profile?.name ? `${profile.name}'s Farm` : 'My Farm'
    const farmCity = profile?.city || 'Hyderabad'
    const farmSoilType = profile?.soil_type || 'Red Sandy Loam'
    const farmAcreage = profile?.total_acreage || 2.0

    // We already queried activePlan above. Let's fetch stages, tasks, adjustments
    let stages: CropStageRecord[] = []
    let tasks: FarmTaskRecord[] = []
    let adjustments: any[] = []

    if (activePlan) {
      stages = await cropCalendarRepository.getStagesForPlan(activePlan.id)
      tasks = await cropCalendarRepository.getTasksForPlan(activePlan.id)
      adjustments = await cropCalendarRepository.getWeatherAdjustmentsForPlan(activePlan.id)
    }

    // Recent scans (from Field Vision)
    const scans = await db.scans.orderBy('scanned_at').reverse().toArray()
    const activeScans = scans.filter(s => !s.deleted_at)
    const lastScan = activeScans[0] || null

    // Recent transactions (from Digital Khata)
    const transactions = await db.transactions.toArray()
    const activeTxs = transactions.filter(t => !t.deleted_at)

    // 3. User Location and Weather Fetch (with 1-hour cache)
    let weatherData: WeatherData | null = null
    let weatherIsCached = false
    let weatherUpdatedAt = new Date().toISOString()
    const coords = await getUserLocation().catch(() => ({ latitude: HYDERABAD_LAT_LON[0], longitude: HYDERABAD_LAT_LON[1] }))

    const cachedWeather = await this.getCacheRecord(CACHE_WEATHER_KEY)
    if (!forceRefresh && cachedWeather && cachedWeather.expires_at && new Date(cachedWeather.expires_at) > new Date()) {
      weatherData = cachedWeather.payload as WeatherData
      weatherIsCached = true
      weatherUpdatedAt = cachedWeather.updated_at
    } else if (this.isOnline()) {
      try {
        weatherData = await fetchWeather(coords.latitude, coords.longitude)
        await this.setCacheRecord(CACHE_WEATHER_KEY, 'weather', weatherData, WEATHER_EXPIRY_MS)
      } catch (err) {
        console.warn('[DashboardRepository] Live weather failed, falling back to cache:', err)
      }
    }

    // Fallback if no weather retrieved yet
    if (!weatherData) {
      if (cachedWeather) {
        weatherData = cachedWeather.payload as WeatherData
        weatherIsCached = true
        weatherUpdatedAt = cachedWeather.updated_at
      } else {
        weatherData = { temperature: 31, humidity: 62, windSpeed: 8, weatherCode: 0 }
      }
    }

    // 4. Calculate Farm Readiness Score & Breakdown
    const readiness = this.calculateFarmReadinessScore(
      profile,
      activePlan,
      stages,
      tasks,
      adjustments,
      lastScan,
      weatherData,
      todayStr
    )

    // 5. Construct Sorted Feed (Focus Operations Feed - up to 5 items)
    const focusItems = this.buildFocusFeed(activePlan, stages, tasks, adjustments, lastScan, todayStr)

    // 6. Gather Alerts
    const alerts = this.buildDashboardAlerts(adjustments, weatherData, lastScan)

    // 7. Calculate Explore AgroGPT Live Metrics
    const exploreMetrics = this.buildExploreMetrics(tasks, activeScans, activeTxs, activePlan)

    // 8. Construct DTO
    let cropDto: DashboardSnapshot['crop'] = null
    if (activePlan) {
      const template = cropTemplates[activePlan.crop_type]
      const currentStage = stages.find(s => s.status === 'current')?.name || 'Germination'
      
      let progress = 0
      if (template) {
        const sowing = new Date(activePlan.sowing_date).getTime()
        const today = new Date(todayStr).getTime()
        const elapsedDays = Math.max(0, Math.floor((today - sowing) / (24 * 60 * 60 * 1000)))
        progress = Math.min(100, Math.round((elapsedDays / template.lifecycleDuration) * 100))
      }

      cropDto = {
        active: true,
        name: activePlan.crop_type,
        variety: activePlan.variety,
        sowingDate: activePlan.sowing_date,
        currentStage,
        lifecycleProgress: progress
      }
    }

    // 9. AI Insights (Batched/Orchestrated cache retrieval or fallback generation)
    // Insights must be refreshed based on events: weather, stage, task status, scans
    const aiInsights = await this.getOrchestratedAIInsights(
      cropDto,
      readiness.score,
      weatherData,
      tasks,
      lastScan,
      profile,
      forceRefresh
    )

    const snapshot: DashboardSnapshot = {
      farm: {
        name: farmName,
        city: farmCity,
        soilType: farmSoilType,
        totalAcreage: farmAcreage
      },
      crop: cropDto,
      readiness,
      weather: {
        temperature: weatherData.temperature,
        humidity: weatherData.humidity,
        windSpeed: weatherData.windSpeed,
        weatherCode: weatherData.weatherCode,
        condition: getWeatherCondition(weatherData.weatherCode),
        isCached: weatherIsCached,
        updatedAt: weatherUpdatedAt
      },
      alerts,
      focusItems,
      aiInsights,
      exploreMetrics,
      mapData: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        zoom: 14,
        activeCrop: activePlan?.crop_type,
        acreage: farmAcreage,
        lastScanStatus: lastScan ? `${lastScan.prediction} (${Math.round(lastScan.confidence * 100)}%)` : 'No scans'
      }
    }

    // Save to Cache
    await this.setCacheRecord(CACHE_SNAPSHOT_KEY, 'snapshot', { fingerprint, dto: snapshot }, SNAPSHOT_EXPIRY_MS)

    return snapshot
  },

  /**
   * Computes Farm Readiness Score (0-100) based on approved weight distributions.
   */
  calculateFarmReadinessScore(
    profile: any,
    plan: CropPlanRecord | null,
    stages: CropStageRecord[],
    tasks: FarmTaskRecord[],
    adjustments: any[],
    lastScan: ScanRecord | null,
    weather: WeatherData,
    todayStr: string
  ): DashboardSnapshot['readiness'] {
    // Weight allocations:
    // 1. Task Status: 25%
    // 2. Soil Health: 20%
    // 3. Irrigation Readiness: 20%
    // 4. Pest Risk: 15%
    // 5. Weather Risk: 10%
    // 6. Crop Progress Health: 10%

    let tasksScore = 25
    let soilScore = 20
    let irrigationScore = 20
    let pestScore = 15
    let weatherScore = 10
    let progressScore = 10

    if (plan) {
      // 1. Task Status (25 points)
      // Percentage of completed tasks with effective_date <= today
      const pastOrTodayTasks = tasks.filter(t => t.effective_date <= todayStr && !t.deleted_at)
      if (pastOrTodayTasks.length > 0) {
        const completed = pastOrTodayTasks.filter(t => t.status === 'completed').length
        tasksScore = Math.round((completed / pastOrTodayTasks.length) * 25)
      }

      // 2. Soil Health (20 points)
      // Presence of NPK relative to standard default values for soil type
      const soilType = profile?.soil_type || 'Red Sandy Loam'
      const defaults = SOIL_NPK_DEFAULTS[soilType] || SOIL_NPK_DEFAULTS['default']
      const pN = profile?.nitrogen || 0
      const pP = profile?.phosphorus || 0
      const pK = profile?.potassium || 0

      if (pN === 0 || pP === 0 || pK === 0) {
        soilScore = 5 // Base points if values are unconfigured
      } else {
        // Evaluate deviations
        const devN = Math.abs(pN - defaults.n) / defaults.n
        const devP = Math.abs(pP - defaults.p) / defaults.p
        const devK = Math.abs(pK - defaults.k) / defaults.k

        let soilDeductions = 0
        if (devN > 0.4) soilDeductions += 5
        if (devP > 0.4) soilDeductions += 5
        if (devK > 0.4) soilDeductions += 5
        soilScore = Math.max(0, 20 - soilDeductions)
      }

      // 3. Irrigation Readiness (20 points)
      // irrigation tasks scheduled up to today completed ratio
      const irrTasks = tasks.filter(t => t.task_type === 'irrigation' && t.effective_date <= todayStr && !t.deleted_at)
      if (irrTasks.length > 0) {
        const completedIrr = irrTasks.filter(t => t.status === 'completed').length
        irrigationScore = Math.round((completedIrr / irrTasks.length) * 20)
      }
      // Deduct points for active weather-delayed irrigation adjust logs
      const activeDelays = adjustments.filter(a => a.adjustment_type === 'irrigation_delay')
      irrigationScore = Math.max(0, irrigationScore - activeDelays.length * 3)

      // 4. Pest Risk (15 points)
      // Check last scan results and warnings
      if (lastScan) {
        const isHealthy = lastScan.prediction.toLowerCase().includes('healthy')
        if (!isHealthy) {
          if (lastScan.confidence > 0.75) {
            pestScore = 3 // High risk disease diagnosed
          } else {
            pestScore = 8 // Moderate risk disease diagnosed
          }
        }
      }
      const activePestAlerts = adjustments.filter(a => a.adjustment_type === 'disease_warning' || a.adjustment_type === 'spray_warning')
      pestScore = Math.max(0, pestScore - activePestAlerts.length * 2)

      // 5. Weather Risk (10 points)
      // Temperature / weather code analysis
      if (weather) {
        let weatherDeductions = 0
        // Rain/heavy storm codes (>= 51)
        if (weather.weatherCode >= 80) weatherDeductions += 6 // Heavy storm
        else if (weather.weatherCode >= 51) weatherDeductions += 3 // Rain
        
        // Heat/cold stress
        if (weather.temperature > 38 || weather.temperature < 10) weatherDeductions += 4
        weatherScore = Math.max(0, 10 - weatherDeductions)
      }

      // 6. Crop Progress Health (10 points)
      // Duration in stage check + overdue high tasks + adjustment counts
      let progressDeductions = 0
      const currentStage = stages.find(s => s.status === 'current')
      if (currentStage) {
        const elapsedDays = Math.max(0, Math.floor((new Date(todayStr).getTime() - new Date(plan.sowing_date).getTime()) / (24 * 60 * 60 * 1000)))
        if (elapsedDays > currentStage.end_day + 5) progressDeductions += 3 // Stage delay
      }
      const overdueHighTasks = tasks.filter(t => t.status !== 'completed' && t.priority === 'high' && t.effective_date < todayStr && !t.deleted_at)
      progressDeductions += Math.min(5, overdueHighTasks.length * 2)
      progressDeductions += Math.min(2, adjustments.length * 0.5)
      progressScore = Math.max(0, 10 - progressDeductions)

    } else {
      // Empty State Defaults
      tasksScore = 25
      soilScore = 20
      irrigationScore = 20
      pestScore = 15
      weatherScore = 10
      progressScore = 10
    }

    const score = tasksScore + soilScore + irrigationScore + pestScore + weatherScore + progressScore
    
    let status: DashboardSnapshot['readiness']['status'] = 'Excellent'
    if (score < 50) status = 'Critical'
    else if (score < 70) status = 'Attention Needed'
    else if (score < 90) status = 'Good'

    return {
      score,
      status,
      breakdown: {
        tasks: tasksScore,
        soil: soilScore,
        irrigation: irrigationScore,
        pest: pestScore,
        weather: weatherScore,
        progress: progressScore
      }
    }
  },

  /**
   * Compiles the priority-ranked vertical Operations Feed (max 5 items).
   */
  buildFocusFeed(
    plan: CropPlanRecord | null,
    stages: CropStageRecord[],
    tasks: FarmTaskRecord[],
    adjustments: any[],
    lastScan: ScanRecord | null,
    todayStr: string
  ): FocusOperationItem[] {
    if (!plan) return []

    const feed: FocusOperationItem[] = []

    // 1. Overdue Critical Tasks (priority = high, effective_date < today, pending)
    const overdueHigh = tasks.filter(t => 
      !t.deleted_at && 
      t.status !== 'completed' && 
      t.priority === 'high' && 
      t.effective_date < todayStr
    )
    overdueHigh.forEach(t => {
      feed.push({
        id: `overdue-high-${t.id}`,
        type: 'task',
        title: `Overdue: ${t.title}`,
        subtitle: `Critical task due since ${t.effective_date}. Click to resolve.`,
        priority: 'high',
        link: '/crop-calendar'
      })
    })

    // 2. Weather-Adjusted / Delayed Tasks
    const delayed = tasks.filter(t => 
      !t.deleted_at && 
      t.status !== 'completed' && 
      (t.origin === 'weather_adjustment' || adjustments.some(a => a.task_id === t.id))
    )
    delayed.forEach(t => {
      feed.push({
        id: `delayed-${t.id}`,
        type: 'task',
        title: `Weather Delayed: ${t.title}`,
        subtitle: `Rescheduled to ${t.effective_date} due to weather.`,
        priority: 'medium',
        link: '/crop-calendar'
      })
    })

    // 3. High-Risk Pest Warning
    if (lastScan && !lastScan.prediction.toLowerCase().includes('healthy')) {
      feed.push({
        id: `pest-warning-${lastScan.id}`,
        type: 'alert',
        title: `Pest Warning: ${lastScan.prediction}`,
        subtitle: `Infection detected at ${Math.round(lastScan.confidence * 100)}% confidence. Review IPM actions.`,
        priority: 'high',
        link: '/field-vision'
      })
    }

    // 4. Tasks Due Today (effective_date === today, pending)
    const dueToday = tasks.filter(t => 
      !t.deleted_at && 
      t.status !== 'completed' && 
      t.effective_date === todayStr &&
      !overdueHigh.some(oh => oh.id === t.id) &&
      !delayed.some(d => d.id === t.id)
    )
    dueToday.forEach(t => {
      feed.push({
        id: `due-today-${t.id}`,
        type: 'task',
        title: t.title,
        subtitle: t.description || 'Farming operational activity.',
        priority: t.priority,
        link: '/crop-calendar'
      })
    })

    // 5. Upcoming Stage Transition (stages starting in the next 3 days)
    const upcomingStages = stages.filter(s => {
      if (s.status === 'upcoming') {
        const start = new Date(s.start_date).getTime()
        const today = new Date(todayStr).getTime()
        const diffDays = (start - today) / (24 * 60 * 60 * 1000)
        return diffDays >= 0 && diffDays <= 3
      }
      return false
    })
    upcomingStages.forEach(s => {
      feed.push({
        id: `transition-${s.id}`,
        type: 'transition',
        title: `Upcoming Phase: ${s.name}`,
        subtitle: `Stage starts on ${s.start_date}. Get inputs ready.`,
        priority: 'low',
        link: '/crop-calendar'
      })
    })

    // Filter/Sort logic (Strictly Rank Order of the categories):
    // Just keep the concatenated list order (Overdue high first, then delayed, warning, today, transitions)
    // Deduplicate items just in case:
    const uniqueFeed: FocusOperationItem[] = []
    const seenIds = new Set<string>()
    for (const item of feed) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id)
        uniqueFeed.push(item)
      }
    }

    return uniqueFeed.slice(0, 5)
  },

  /**
   * Compiles diagnostic alerts from scans, adjustments, and weather warnings.
   */
  buildDashboardAlerts(adjustments: any[], weather: WeatherData, lastScan: ScanRecord | null): DashboardSnapshot['alerts'] {
    const alerts: DashboardSnapshot['alerts'] = []

    // Pest warning from scans
    if (lastScan && !lastScan.prediction.toLowerCase().includes('healthy')) {
      alerts.push({
        id: `alert-scan-${lastScan.id}`,
        type: 'danger',
        title: 'Active Disease Detected',
        message: `${lastScan.prediction} detected in latest scans with ${Math.round(lastScan.confidence * 100)}% confidence.`
      })
    }

    // Weather warnings
    if (weather.weatherCode >= 80) {
      alerts.push({
        id: 'alert-weather-heavy-rain',
        type: 'danger',
        title: 'Heavy Rainfall Advisory',
        message: 'Extreme storms or heavy showers detected. Delay pesticide spraying and check drainage.'
      })
    } else if (weather.temperature > 38) {
      alerts.push({
        id: 'alert-weather-heat',
        type: 'warning',
        title: 'Heat Stress Warning',
        message: `High heat (${weather.temperature}°C) expected. Maintain high irrigation levels.`
      })
    }

    // General templates adjustments
    adjustments.forEach(a => {
      if (a.adjustment_type === 'irrigation_delay') {
        alerts.push({
          id: `alert-adjustment-${a.id}`,
          type: 'info',
          title: 'Irrigation Suspended',
          message: `Irrigation postponed: ${a.reason}`
        })
      } else if (a.adjustment_type === 'disease_warning') {
        alerts.push({
          id: `alert-adjustment-${a.id}`,
          type: 'warning',
          title: 'Pest/Disease Risk Favorable',
          message: `Disease risk increased: ${a.reason}`
        })
      }
    })

    return alerts
  },

  /**
   * Builds the gateway metrics from existing module data.
   */
  buildExploreMetrics(
    tasks: FarmTaskRecord[],
    scans: ScanRecord[],
    transactions: any[],
    plan: CropPlanRecord | null
  ): DashboardSnapshot['exploreMetrics'] {
    // 1. Precision Planning: Active Tasks & Current Stage
    const activeTasks = tasks.filter(t => t.status !== 'completed' && !t.deleted_at).length
    const currentStage = plan ? 'Active Calendar' : 'No active crop'

    // 2. Field Vision: Last Diagnosis & Confidence %
    const lastScan = scans[0]
    const lastDiagnosis = lastScan ? lastScan.prediction : 'No diagnoses'
    const confidence = lastScan ? lastScan.confidence : 0

    // 3. Market Insights: Recommended Crop (NPK based) & Market Trend
    let recommendedCrop = 'Rice'
    let marketTrend = 'Steady'
    // Simple mock logic for recommendation based on crop cycles/profiles
    if (plan?.crop_type === 'Cotton') {
      recommendedCrop = 'Green gram (Moong)' // Legume fits Cotton rotation
      marketTrend = 'Bullish (+4%)'
    } else if (plan?.crop_type === 'Rice') {
      recommendedCrop = 'Sunflower'
      marketTrend = 'High Demand'
    } else {
      recommendedCrop = 'Cotton'
      marketTrend = 'Favorable'
    }

    // 4. Digital Ledger: Net Profit & Monthly Change
    let netProfit = 0
    let incomeMonth = 0
    let expenseMonth = 0
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    transactions.forEach(t => {
      const amt = Number(t.amount) || 0
      const isRecent = new Date(t.transaction_date) >= thirtyDaysAgo
      
      if (t.type === 'income') {
        netProfit += amt
        if (isRecent) incomeMonth += amt
      } else {
        netProfit -= amt
        if (isRecent) expenseMonth += amt
      }
    })

    const monthlyChange = incomeMonth - expenseMonth

    return {
      precisionPlanning: { activeTasks, currentStage },
      fieldVision: { lastDiagnosis, confidence },
      marketInsights: { recommendedCrop, marketTrend },
      digitalLedger: { netProfit, monthlyChange }
    }
  },

  /**
   * Orchestrates the AI insights daily suggestions prompt, with caching and event validation.
   */
  async getOrchestratedAIInsights(
    cropDto: DashboardSnapshot['crop'],
    readinessScore: number,
    weather: WeatherData,
    tasks: FarmTaskRecord[],
    lastScan: ScanRecord | null,
    profile: any,
    forceRefresh: boolean
  ): Promise<DashboardSnapshot['aiInsights']> {
    const todayTasks = tasks.filter(t => t.effective_date === getTodayUtcString() && !t.deleted_at)
    
    // Create status state key fingerprint to check if cache is dirty
    const statusFingerprint = {
      crop: cropDto?.name || 'none',
      stage: cropDto?.currentStage || 'none',
      temp: Math.round(weather.temperature),
      humid: Math.round(weather.humidity),
      rain: weather.weatherCode >= 51 ? 'rain' : 'dry',
      tasksCount: tasks.filter(t => t.status !== 'completed' && !t.deleted_at).length,
      lastScanId: lastScan ? lastScan.id : 'none'
    }

    const cached = await this.getCacheRecord(CACHE_AI_INSIGHTS_KEY)
    const isCacheValid = cached && JSON.stringify(cached.payload) === JSON.stringify(statusFingerprint)

    if (!forceRefresh && isCacheValid) {
      // Re-read cached values
      const val = cached as any
      if (val.ai_data) {
        return {
          ...val.ai_data,
          isCached: true,
          updatedAt: val.updated_at
        }
      }
    }

    // Call Gemini API if online, otherwise generate local fallback
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
    if (this.isOnline() && apiKey) {
      try {
        const prompt = `
Generate a Farm Command Center dashboard advice block for the farmer.
Farmer Name: ${profile?.name || 'Farmer'}
Location: ${profile?.city || 'Hyderabad'}
Soil Type: ${profile?.soil_type || 'Red Sandy Loam'}
Acreage: ${profile?.total_acreage || 2.0} ac
Soil NPK values: N=${profile?.nitrogen || 100}, P=${profile?.phosphorus || 50}, K=${profile?.potassium || 50}

Crop Status:
Active Crop: ${cropDto?.name || 'None'}
Variety: ${cropDto?.variety || 'N/A'}
Sowing Date: ${cropDto?.sowingDate || 'N/A'}
Current Stage: ${cropDto?.currentStage || 'N/A'}
Farm Readiness Score: ${readinessScore}/100

Weather Condition:
Temperature: ${weather.temperature}°C
Humidity: ${weather.humidity}%
Wind Speed: ${weather.windSpeed} km/h
Weather Code: ${weather.weatherCode} (${getWeatherCondition(weather.weatherCode)})

Recent Scan Detections:
Last Diagnosis: ${lastScan ? lastScan.prediction : 'None'}
Confidence: ${lastScan ? `${Math.round(lastScan.confidence * 100)}%` : 'N/A'}

Today's Pending Tasks:
${todayTasks.map(t => `- ${t.title}: ${t.description}`).join('\n') || 'No pending tasks scheduled.'}

TASK:
Provide a structured agricultural review. Keep statements warm, concise, and focused on operational awareness.
Return EXACTLY a JSON object matching this schema (do NOT wrap in markdown backticks, return a raw JSON string):
{
  "dailyInsight": "A single compact dashboard summary of the farm's immediate state and what the farmer should look out for today.",
  "todayAdvice": "A checklist summary of exactly what the farmer should execute or focus on today.",
  "waterAdvice": "A crop water requirement estimate and advice (e.g. adjust watering due to current weather conditions).",
  "pestAdvice": "A forecast warning about pests or disease spreading factors based on current humidity/weather.",
  "fertilizerAdvice": "A nutrient/fertilizer dosage recommendation aligned with current crop stage and soil defaults."
}
`

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: prompt }]
                }
              ],
              generationConfig: {
                temperature: 0.4,
                responseMimeType: 'application/json',
                maxOutputTokens: 1024
              }
            })
          }
        )

        if (response.ok) {
          const resBody = await response.json()
          const text = resBody?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
          if (text) {
            const parsed = JSON.parse(text)
            // Cache both fingerprint and generated insights
            await db.dashboard_cache.put({
              key: CACHE_AI_INSIGHTS_KEY,
              type: 'ai-insights',
              payload: statusFingerprint,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              // Store computed insights inside the cache record custom parameters
              ...({ ai_data: parsed } as any)
            })

            return {
              dailyInsight: parsed.dailyInsight,
              todayAdvice: parsed.todayAdvice,
              waterAdvice: parsed.waterAdvice,
              pestAdvice: parsed.pestAdvice,
              fertilizerAdvice: parsed.fertilizerAdvice,
              isCached: false,
              updatedAt: new Date().toISOString()
            }
          }
        }
      } catch (err) {
        console.error('[DashboardRepository] Error calling Gemini for batched insights:', err)
      }
    }

    // Local Agronomic Fallback (Offline or error fallback)
    const localAdvice = this.generateLocalAgronomicFallback(cropDto, weather, todayTasks, lastScan, profile)
    
    // Store fingerprint and fallback insights
    await db.dashboard_cache.put({
      key: CACHE_AI_INSIGHTS_KEY,
      type: 'ai-insights',
      payload: statusFingerprint,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...({ ai_data: localAdvice } as any)
    })

    return {
      ...localAdvice,
      isCached: true,
      updatedAt: new Date().toISOString()
    }
  },

  /**
   * Generates localized agronomic fallback insights when offline.
   */
  generateLocalAgronomicFallback(
    cropDto: DashboardSnapshot['crop'],
    weather: WeatherData,
    todayTasks: FarmTaskRecord[],
    lastScan: ScanRecord | null,
    profile: any
  ) {
    const cropName = cropDto?.name || 'Cotton'
    const stage = cropDto?.currentStage || 'Seedling'

    let dailyInsight = `Your ${cropName} crop is in the ${stage} growth phase. Keep standard field monitoring.`
    let todayAdvice = 'Perform a routine morning walk. Check leaf curls and soil wetness.'
    let waterAdvice = 'Maintain standard watering schedule (irrigate during early morning or sunset).'
    let pestAdvice = 'Weather conditions are stable. Low disease risk factors.'
    let fertilizerAdvice = 'NPK applications are in balance. Apply fertilizer splits only as scheduled.'

    // Dynamic enhancements based on stage/weather
    if (cropName === 'Cotton') {
      if (stage.includes('Seedling')) {
        dailyInsight = 'Seedling establishment phase active. Check for early weed competition and soil crusting.'
        todayAdvice = 'Walk the rows to identify seedling density. Clear weeds near shoots manually.'
        fertilizerAdvice = 'Dose split Urea (20kg/ac) after crop anchors. Avoid heavy fertilizer at early root stages.'
      } else if (stage.includes('Squaring') || stage.includes('Flowering')) {
        dailyInsight = 'Squaring and bloom initiation started. Critical stage: ensure moisture consistency and scout for thrips.'
        todayAdvice = 'Examine flower buds for early square drop. Scout for sucking pests under leaves.'
        fertilizerAdvice = 'Squaring/flowering requires N: 48 kg/ac, K: 36 kg/ac. Side-dress Urea and Potash as planned.'
      }
    }

    if (weather.humidity > 80) {
      pestAdvice = `High relative humidity (${weather.humidity}%) triggers mold, blight, and fungal hazards. Spray neem prophylactic.`
      waterAdvice = 'High moisture. Delay any unnecessary irrigation to avoid soil waterlogging.'
    } else if (weather.temperature > 36) {
      waterAdvice = `Extreme temperature of ${weather.temperature}°C requires transpiration balance. Keep soil moist; avoid midday watering.`
      dailyInsight += ' Monitor for leaf heat wilting.'
    }

    if (lastScan && !lastScan.prediction.toLowerCase().includes('healthy')) {
      dailyInsight = `Disease alert: ${lastScan.prediction} detected recently. Prevent further spread in the field.`
      todayAdvice = `Immediately isolate infected plants. Apply organic spray or target treatment for ${lastScan.prediction}.`
      pestAdvice = `High disease pressure active (${lastScan.prediction}). Favorable weather could accelerate spread.`
    }

    if (todayTasks.length > 0) {
      todayAdvice = `Focus on scheduled operations: ${todayTasks.map(t => t.title).join(', ')}. Complete today to maintain scheduling.`
    }

    return {
      dailyInsight,
      todayAdvice,
      waterAdvice,
      pestAdvice,
      fertilizerAdvice
    }
  }
}
