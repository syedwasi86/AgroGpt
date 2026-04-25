import { AlertTriangle, Droplets, Flame, Map, MapPin, Sprout } from 'lucide-react'
import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { GlassCard } from '../../components/GlassCard'
import { SkeletonCard } from '../../components/Skeleton'
import { useTranslation } from 'react-i18next'
import { calculateFertilizer, calculateIrrigation, inferCropType } from '../../core/utils/formulas'
import { getActiveCrops, initDatabase } from '../../lib/repository'
import type { CropRecord } from '../../lib/db'
import { detectCityFromGeolocation, getSoilProfile } from '../../core/utils/geolocation'
import { WeatherCard } from './WeatherCard'
import type { WeatherData } from '../gis/services/weatherService'

// Lazy-load the heavy Leaflet bundle so it doesn't block initial render
const FarmMap = lazy(() => import('./FarmMap').then(m => ({ default: m.FarmMap })))

function WidgetHeader({
  icon,
  title,
  meta,
}: {
  icon: React.ReactNode
  title: string
  meta?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/80">
          {icon}
        </div>
        <div>
          <div className="agro-h2">{title}</div>
          {meta ? <div className="subtle mt-0.5">{meta}</div> : null}
        </div>
      </div>
    </div>
  )
}

/** Demo weather inputs (offline); could later come from a local sensor cache */
const DEMO_TEMP_C = 31
const DEMO_HUMIDITY_PCT = 62

export function DashboardPage() {
  const { t } = useTranslation()
  const [location, setLocation] = useState('Hyderabad')
  const [rawSoil, setSoil] = useState('Red Sandy Loam')
  const [mapCenter, setMapCenter] = useState<[number, number]>([17.385, 78.4867])
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const soil = t(`data.soil.${rawSoil.toLowerCase().replace(/[^a-z]/g, '')}`, rawSoil)

  const [crops, setCrops] = useState<CropRecord[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingCrops, setLoadingCrops] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const city = await detectCityFromGeolocation()
        if (alive) {
          setLocation(city)
          setSoil(getSoilProfile(city))
        }
      } catch {
        // Fallbacks
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await initDatabase()
        const active = await getActiveCrops()
        if (alive) setCrops(active)
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : t('data.error.loadFailed'))
      } finally {
        if (alive) setLoadingCrops(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [t])

  const primaryCrop = crops[0]
  const rawCropName = primaryCrop?.name ?? 'Cotton'
  const cropArea = primaryCrop?.area ?? 2
  
  // Dynamic translation strategy for DB values using a sanitized key fallback
  const cropKey = `data.crop.${rawCropName.toLowerCase().replace(/[^a-z]/g, '')}`
  const cropName = t(cropKey, rawCropName)

  const cropType = useMemo(() => inferCropType(cropName), [cropName])
  const activeTemp = weather?.temperature ?? DEMO_TEMP_C
  const activeHumidity = weather?.humidity ?? DEMO_HUMIDITY_PCT

  const irrigation = useMemo(
    () => calculateIrrigation(activeTemp, activeHumidity, cropType),
    [cropType, activeTemp, activeHumidity],
  )

  const fertilizer = useMemo(() => calculateFertilizer(cropArea, 'flowering'), [cropArea])

  return (
    <div className="space-y-6">
      {loadError ? (
        <div className="rounded-2xl border border-stroke-3 bg-secondary/10 px-4 py-2 text-sm text-white/80">
          {loadError}
        </div>
      ) : null}

      {/* Hero */}
      <GlassCard className="relative overflow-hidden p-6 sm:p-8" variant="strong">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-500/20 via-transparent to-secondary/10" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="glass-chip">
              <MapPin size={14} className="text-primary-300" /> {t('dashboard.autoDetected')}: {location}
            </span>
            <span className="glass-chip">
              <Sprout size={14} className="text-secondary" /> {t('dashboard.soil')}: {soil}
            </span>
            <span className="glass-chip">
              <Flame size={14} className="text-white/70" /> {t('dashboard.heatIndex')}: {t('dashboard.moderate')}
            </span>
            {primaryCrop ? (
              <span className="glass-chip border-stroke-2">
                {primaryCrop.name} · {primaryCrop.area} ac · {primaryCrop.status}
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div>
              <div className="agro-h1">{t('dashboard.title')}</div>
              <p className="subtle mt-2 max-w-2xl">
                {t('dashboard.heroDesc')}
              </p>
            </div>
            <div className="glass-card mt-2 p-4 lg:mt-0">
              <div className="text-xs font-semibold text-white/80">{t('dashboard.liveEnvironment', { defaultValue: 'Live Environment' })}</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-lg font-semibold text-white">{Math.round(activeTemp)}°C</div>
                  <div className="text-[11px] text-white/55">{t('dashboard.temp')}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-lg font-semibold text-white">{Math.round(activeHumidity)}%</div>
                  <div className="text-[11px] text-white/55">{t('dashboard.humidity')}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-lg font-semibold text-white">{weather ? `${Math.round(weather.windSpeed)}` : t('dashboard.low')}</div>
                  <div className="text-[11px] text-white/55">{t('dashboard.wind')} km/h</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Field Overview Map */}
      <GlassCard className="p-5" variant="strong">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/80">
              <Map size={18} />
            </div>
            <div>
              <div className="agro-h2">Field Overview</div>
              <div className="subtle mt-0.5">Live geospatial map · {location}</div>
            </div>
          </div>
          <span className="glass-chip border-stroke-2 bg-primary-700/15 text-xs">
            OpenStreetMap
          </span>
        </div>
        <div className="h-72 overflow-hidden rounded-2xl border border-white/10">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-white/40">
                Loading map...
              </div>
            }
          >
            <FarmMap 
              initialCenter={[17.385, 78.4867]} 
              farmName={`${location} Farm`} 
              onPositionChange={setMapCenter}
            />
          </Suspense>
        </div>
      </GlassCard>

      {/* Local-first formulas (IndexedDB crop → offline math) */}
      {loadingCrops ? (
        <SkeletonCard />
      ) : (
      <GlassCard className="p-5">
        <div className="agro-h2">
          {t('dashboard.offlineFormulasTitle', { defaultValue: 'Field Intelligence (local crops)' })}
        </div>
        <p className="subtle mt-1">
          {t('dashboard.offlineFormulasDesc', {
            defaultValue: 'Irrigation and NPK estimates use your active crop area from the local database.',
          })}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            <div className="text-xs font-semibold text-white/60">
              {t('dashboard.etIrrigation', { defaultValue: 'ET-based irrigation' })}
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              ~{irrigation.litersPerAcrePerDay.toLocaleString()} L/{t('dashboard.acrePerDay', { defaultValue: 'acre·day' })}
            </div>
            <div className="mt-2 text-xs text-white/55">{irrigation.notes}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            <div className="text-xs font-semibold text-white/60">
              {t('dashboard.stageFertilizer', { defaultValue: 'Stage fertilizer (flowering)' })}
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              N {fertilizer.nKgPerAcre} · P {fertilizer.pKgPerAcre} · K {fertilizer.kKgPerAcre}{' '}
              <span className="text-sm font-medium text-white/60">kg/ac</span>
            </div>
            <div className="mt-1 text-sm text-white/70">
              {t('dashboard.totalForPlot', { defaultValue: 'Total for plot' })}:{' '}
              <span className="font-semibold text-white">{fertilizer.totalKgForPlot} kg</span>
            </div>
            <div className="mt-2 text-xs text-white/55">{fertilizer.notes}</div>
          </div>
        </div>
      </GlassCard>
      )}

      {/* Widgets */}
      <div className="grid gap-4 lg:grid-cols-3">
        <WeatherCard lat={mapCenter[0]} lon={mapCenter[1]} onDataLoad={setWeather} />

        <GlassCard className="p-5">
          <WidgetHeader icon={<Droplets size={18} />} title={t('dashboard.soilHealth')} meta={t('dashboard.npkEstimation')} />
          <div className="mt-4 space-y-3">
            {[
              { k: 'N', v: 48, label: t('dashboard.nitrogen'), tone: 'from-primary-500/40 to-primary-500/10' },
              { k: 'P', v: 22, label: t('dashboard.phosphorus'), tone: 'from-secondary/40 to-secondary/10' },
              { k: 'K', v: 36, label: t('dashboard.potassium'), tone: 'from-white/25 to-white/5' },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">
                    {x.k}{' '}
                    <span className="text-xs font-medium text-white/55">· {x.label}</span>
                  </div>
                  <div className="text-sm font-semibold text-white">{x.v}</div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full bg-gradient-to-r ${x.tone}`}
                    style={{ width: `${Math.min(100, x.v * 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <WidgetHeader
            icon={<AlertTriangle size={18} className="text-secondary" />}
            title={t('dashboard.pestRisk')}
            meta={t('dashboard.earlyWarningSignals')}
          />
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-stroke-3 bg-secondary/10 p-3">
              <div className="text-sm font-semibold text-white">{t('dashboard.mediumRiskThrips')}</div>
              <div className="mt-1 text-xs text-white/65">
                {t('dashboard.mediumRiskThripsDesc')}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-semibold text-white">{t('dashboard.lowRiskBollworm')}</div>
              <div className="mt-1 text-xs text-white/65">
                {t('dashboard.lowRiskBollwormDesc')}
              </div>
            </div>
            <div className="rounded-2xl border border-stroke-2 bg-primary-700/10 p-3">
              <div className="text-xs font-semibold text-white/80">{t('dashboard.recommendedIpm')}</div>
              <div className="mt-1 text-xs text-white/60">
                {t('dashboard.recommendedIpmDesc')}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* AI suggestion */}
      <GlassCard className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="agro-h2">{t('dashboard.aiSuggestion')}</div>
            <div className="subtle mt-1">{t('dashboard.dailyCropAction')} · {cropName}</div>
          </div>
          <span className="glass-chip border-stroke-2 bg-primary-700/15">
            {t('dashboard.outcomeFocus')}: <span className="font-semibold text-white">{t('dashboard.yieldAndPest')}</span>
          </span>
        </div>
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white/80">
          {t('dashboard.aiSuggestionText')}
        </div>
      </GlassCard>
    </div>
  )
}
