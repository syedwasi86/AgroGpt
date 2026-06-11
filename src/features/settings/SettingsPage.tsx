import { useState, useEffect, lazy, Suspense, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { saveSettings } from './services/accountService'
import { GlassCard } from '../../components/GlassCard'
import { Save, RefreshCw, LogOut, MapPin, Globe, Loader2, User, Settings, Info } from 'lucide-react'
import { backgroundSync } from '../../core/api/syncEngine'
import { getUserLocation } from '../../core/utils/geolocation'

const FarmMap = lazy(() => import('../../components/maps/FarmMap').then(m => ({ default: m.FarmMap })))
import { useAuth } from '../../core/auth/AuthContext'
import { useTranslation } from 'react-i18next'
import { profileRepository } from '../../lib/profileRepository'

export function SettingsPage() {
  const { signOut, user } = useAuth()
  const settings = useLiveQuery(() => db.user_settings.toArray().then(a => a[0]))
  const profile = useLiveQuery(async () => {
    if (!user?.id) return null
    return (await db.profiles.get(user.id)) || null
  }, [user])
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [loggingOut, setLoggingOut] = useState(false)
  const { t, i18n } = useTranslation()
  
  const [formData, setFormData] = useState({
    notificationsEnabled: false,
    theme: 'dark',
    language: 'en',
    village: '',
    district: '',
    state: '',
    latitude: '',
    longitude: ''
  })

  const [showMap, setShowMap] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  const hasInitialized = useRef(false)

  useEffect(() => {
    if (settings && profile && !hasInitialized.current) {
      setFormData({
        notificationsEnabled: settings.notifications_enabled || false,
        theme: settings.theme || 'dark',
        language: profile.preferred_language || 'en',
        village: profile.village || '',
        district: profile.district || '',
        state: profile.state || '',
        latitude: profile.latitude !== undefined ? String(profile.latitude) : '',
        longitude: profile.longitude !== undefined ? String(profile.longitude) : ''
      })
      hasInitialized.current = true
    }
  }, [settings, profile])

  const handlePositionChange = (pos: [number, number]) => {
    setFormData(prev => ({
      ...prev,
      latitude: pos[0].toFixed(6),
      longitude: pos[1].toFixed(6)
    }))
  }

  const handleRefreshLocation = async () => {
    setLocating(true)
    setLocationError(null)
    try {
      const coords = await getUserLocation()
      const lat = coords.latitude
      const lon = coords.longitude
      
      setFormData(prev => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lon.toFixed(6)
      }))

      if (navigator.onLine) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
          if (res.ok) {
            const data = await res.json()
            const state = data.address?.state || ''
            const district = data.address?.state_district || data.address?.county || ''
            const village = data.address?.village || data.address?.town || data.address?.city || ''

            setFormData(prev => ({
              ...prev,
              state: state || prev.state,
              district: district || prev.district,
              village: village || prev.village
            }))
          }
        } catch (e) {
          console.warn('GPS geocode failed offline:', e)
        }
      }
    } catch (err) {
      console.warn(err)
      setLocationError(t('settings.locationError', 'Geolocation access denied or timed out.'))
    } finally {
      setLocating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    await saveSettings({
      notifications_enabled: formData.notificationsEnabled,
      theme: formData.theme
    })

    if (profile?.id) {
      const latVal = formData.latitude.trim() ? parseFloat(formData.latitude) : undefined
      const lonVal = formData.longitude.trim() ? parseFloat(formData.longitude) : undefined

      await profileRepository.updateProfile(profile.id, {
        preferred_language: formData.language,
        village: formData.village || undefined,
        district: formData.district || undefined,
        state: formData.state || undefined,
        latitude: latVal,
        longitude: lonVal,
        version: (profile.version || 1) + 1
      })
      void i18n.changeLanguage(formData.language)
    }

    alert(t('settings.savedSuccessfully', 'Settings saved successfully!'))
  }

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleSync = async () => {
    if (isOffline) return
    setSyncing(true)
    setSyncStatus('idle')
    try {
      const res = await backgroundSync()
      if (res.failed > 0) throw new Error('Partial failure')
      setSyncStatus('success')
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch {
      setSyncStatus('error')
    } finally {
      setSyncing(false)
    }
  }

  const lastSyncDate = settings?.last_sync && settings.last_sync !== '1970-01-01T00:00:00.000Z'
    ? new Date(settings.last_sync).toLocaleString() 
    : t('settings.neverSynced', 'Never')

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await signOut()
      window.location.href = '/auth'
    } catch (error) {
      console.error('Logout error:', error)
      setLoggingOut(false)
    }
  }

  return (
    <div className={`space-y-6 transition-all duration-700 ${loggingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      <div>
        <h1 className="agro-h1">{t('settings.title', 'Settings')}</h1>
        <p className="subtle mt-2">{t('settings.subtitle', 'Control your app preferences and data.')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CARD 1 — APP PREFERENCES */}
        <GlassCard className="p-6" variant="strong">
          <h2 className="agro-h2 mb-4 flex items-center gap-2.5 text-white">
            <Settings size={20} className="text-[#87A96B]" />
            {t('settings.appPreferences', 'App Preferences')}
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
              <div>
                <div className="text-sm font-semibold text-white">{t('settings.enableNotifications', 'Enable Notifications')}</div>
                <div className="text-xs text-white/50 mt-1">{t('settings.notificationsSub', 'Get alerts for weather and market updates.')}</div>
              </div>
              <input 
                type="checkbox" 
                checked={formData.notificationsEnabled}
                onChange={e => setFormData({ ...formData, notificationsEnabled: e.target.checked })}
                className="h-5 w-5 accent-[#87A96B] rounded border-white/10 bg-black/20" 
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="mb-2 block text-sm font-semibold text-white">{t('settings.theme', 'Theme')}</label>
              <select 
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[#87A96B] transition"
                value={formData.theme} 
                onChange={e => setFormData({ ...formData, theme: e.target.value })}
              >
                <option value="light">{t('settings.themeLight', 'Light')}</option>
                <option value="dark">{t('settings.themeDark', 'Dark')}</option>
                <option value="system">{t('settings.themeSystem', 'System')}</option>
              </select>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="mb-2 block text-sm font-semibold text-white">{t('settings.language', 'Language')}</label>
              <select 
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[#87A96B] transition"
                value={formData.language} 
                onChange={e => setFormData({ ...formData, language: e.target.value })}
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="te">తెలుగు (Telugu)</option>
              </select>
            </div>
          </div>
        </GlassCard>

        {/* CARD 2 — FARM LOCATION */}
        <GlassCard className="p-6" variant="strong">
          <h2 className="agro-h2 mb-4 flex items-center gap-2.5 text-white">
            <MapPin size={20} className="text-[#87A96B]" />
            {t('settings.farmLocation', 'Farm Location')}
          </h2>
          <p className="subtle mb-4">{t('settings.farmLocationSub', "Manage your farm's geographic details and coordinates.")}</p>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-semibold text-white/60">{t('settings.village', 'Village / Town')}</label>
                <input
                  type="text"
                  value={formData.village}
                  onChange={e => setFormData({ ...formData, village: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[#87A96B] transition"
                  placeholder={t('settings.villagePlaceholder', 'Village')}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold text-white/60">{t('settings.district', 'District')}</label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={e => setFormData({ ...formData, district: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[#87A96B] transition"
                  placeholder={t('settings.districtPlaceholder', 'District')}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold text-white/60">{t('settings.state', 'State')}</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={e => setFormData({ ...formData, state: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[#87A96B] transition"
                  placeholder={t('settings.statePlaceholder', 'State')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold text-white/60">{t('settings.latitude', 'Latitude')}</label>
                <input
                  type="text"
                  value={formData.latitude}
                  onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[#87A96B] transition font-mono"
                  placeholder={t('settings.latitudePlaceholder', 'Latitude (e.g. 17.3850)')}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold text-white/60">{t('settings.longitude', 'Longitude')}</label>
                <input
                  type="text"
                  value={formData.longitude}
                  onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[#87A96B] transition font-mono"
                  placeholder={t('settings.longitudePlaceholder', 'Longitude (e.g. 78.4867)')}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowMap(!showMap)}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 hover:border-white/20 transition"
              >
                <Globe size={18} className="text-blue-400" />
                {showMap ? t('settings.hideMap', 'Hide Map') : t('settings.viewMap', 'View Map')}
              </button>
              <button
                type="button"
                onClick={handleRefreshLocation}
                disabled={locating}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 hover:border-white/20 transition disabled:opacity-50"
              >
                <RefreshCw size={18} className={`text-green-400 ${locating ? 'animate-spin' : ''}`} />
                {locating ? t('settings.refreshing', 'Refreshing...') : t('settings.refreshLocation', 'Refresh Location')}
              </button>
            </div>

            {locationError && (
              <p className="mt-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-2 rounded-xl">
                {locationError}
              </p>
            )}

            {showMap && (
              <div className="h-72 overflow-hidden rounded-3xl border border-white/5 bg-black/20 mt-4 transition-all duration-300">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-sm text-white/30">
                      <Loader2 size={24} className="animate-spin text-green-400 mr-2" />
                      {t('settings.loadingMap', 'Loading map modules...')}
                    </div>
                  }
                >
                  <FarmMap
                    key={`${formData.latitude}-${formData.longitude}`}
                    initialCenter={[
                      formData.latitude ? parseFloat(formData.latitude) : 17.385,
                      formData.longitude ? parseFloat(formData.longitude) : 78.4867
                    ]}
                    farmName={profile?.farm_name}
                    onPositionChange={handlePositionChange}
                  />
                </Suspense>
              </div>
            )}
          </div>

          <div className="pt-6 mt-6 border-t border-white/10">
            <button type="submit" className="flex items-center gap-2 rounded-2xl bg-[#2E7D32] px-6 py-3 text-sm font-semibold text-white shadow-glowPrimary hover:opacity-90 transition">
              <Save size={18} /> {t('settings.saveSettings', 'Save Settings')}
            </button>
          </div>
        </GlassCard>
      </form>

      {/* CARD 3 — ACCOUNT */}
      <GlassCard className="p-6" variant="strong">
        <h2 className="agro-h2 mb-4 flex items-center gap-2.5 text-white">
          <User size={20} className="text-[#87A96B]" />
          {t('settings.account', 'Account')}
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <div className="text-sm font-semibold text-white">{t('settings.syncStatus', 'Sync Status')}</div>
              <div className="text-xs text-white/50 mt-1">
                {t('settings.lastSyncTime', 'Last synced')}: <span className="text-white font-mono">{lastSyncDate}</span>
              </div>
            </div>
            <div className="text-right">
              {isOffline && <span className="inline-flex items-center rounded-full bg-yellow-400/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400 border border-yellow-400/20">{t('settings.offlineMode', 'Offline Mode')}</span>}
              {!isOffline && syncStatus === 'success' && <span className="inline-flex items-center rounded-full bg-green-400/10 px-2.5 py-0.5 text-xs font-medium text-green-400 border border-green-400/20">{t('settings.syncSuccess', 'Sync Successful!')}</span>}
              {!isOffline && syncStatus === 'error' && <span className="inline-flex items-center rounded-full bg-red-400/10 px-2.5 py-0.5 text-xs font-medium text-red-400 border border-red-400/20">{t('settings.syncFailed', 'Sync Failed')}</span>}
              {!isOffline && syncStatus === 'idle' && !syncing && <span className="inline-flex items-center rounded-full bg-blue-400/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 border border-blue-400/20">Synced</span>}
              {syncing && <span className="inline-flex items-center rounded-full bg-blue-400/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 border border-blue-400/20">{t('settings.syncing', 'Syncing...')}</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button 
              type="button" 
              onClick={() => void handleSync()} 
              disabled={syncing || isOffline} 
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition disabled:opacity-50"
            >
              <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} /> 
              {syncing ? t('settings.syncing', 'Syncing...') : t('settings.syncNow', 'Sync Now')}
            </button>
            
            <button 
              type="button" 
              onClick={() => void handleLogout()} 
              disabled={loggingOut}
              className="flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 px-6 py-3 text-sm font-semibold text-red-500 hover:bg-red-500/20 transition disabled:opacity-50"
            >
              <LogOut size={18} className={loggingOut ? 'animate-pulse' : ''} /> 
              {loggingOut ? t('settings.loggingOut', 'Logging out securely...') : t('settings.logout', 'Log Out')}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* CARD 4 — ABOUT */}
      <GlassCard className="p-6" variant="strong">
        <h2 className="agro-h2 mb-4 flex items-center gap-2.5 text-white">
          <Info size={20} className="text-[#87A96B]" />
          {t('settings.about', 'About')}
        </h2>

        <div className="space-y-3.5 text-sm">
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-white/50">{t('settings.appVersion', 'App Version')}</span>
            <span className="font-semibold text-white font-mono">{__APP_VERSION__}</span>
          </div>
          <div className="flex justify-between pb-2">
            <span className="text-white/50">{t('settings.buildVersion', 'Build Version')}</span>
            <span className="font-semibold text-white font-mono">{__BUILD_VERSION__}</span>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
