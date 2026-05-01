import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { saveSettings } from './services/accountService'
import { GlassCard } from '../../components/GlassCard'
import { Save, RefreshCw, LogOut } from 'lucide-react'
import { syncData } from '../../core/api/syncEngine'
import { useAuth } from '../../core/auth/AuthProvider'

export function SettingsPage() {
  const settings = useLiveQuery(() => db.user_settings.toArray().then(a => a[0]))
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [loggingOut, setLoggingOut] = useState(false)
  const { signOut } = useAuth()
  
  const [formData, setFormData] = useState({
    notificationsEnabled: false,
    biometricEnabled: false,
    language: 'en'
  })

  useEffect(() => {
    if (settings) {
      setFormData({
        notificationsEnabled: settings.notifications_enabled,
        biometricEnabled: settings.biometric_enabled,
        language: settings.language
      })
    }
  }, [settings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveSettings({
      notifications_enabled: formData.notificationsEnabled,
      biometric_enabled: formData.biometricEnabled,
      language: formData.language
    })
    alert('Settings saved successfully!')
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
      const res = await syncData()
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
    : 'Never'

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await signOut()
      // Force a full page reload to flush all React memory and ensure a clean slate
      window.location.href = '/auth'
    } catch (error) {
      console.error('Logout error:', error)
      setLoggingOut(false)
    }
  }

  return (
    <div className={`space-y-6 transition-all duration-700 ${loggingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      <div>
        <div className="agro-h1">Settings</div>
        <p className="subtle mt-2">Control your app preferences and data.</p>
      </div>

      <GlassCard className="p-6" variant="strong">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <div className="text-sm font-semibold text-white">Enable Notifications</div>
              <div className="text-xs text-white/50 mt-1">Get alerts for weather and market prices.</div>
            </div>
            <input 
              type="checkbox" 
              checked={formData.notificationsEnabled}
              onChange={e => setFormData({...formData, notificationsEnabled: e.target.checked})}
              className="h-5 w-5 accent-[#2E7D32]" 
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <div className="text-sm font-semibold text-white">Enable Biometric Login</div>
              <div className="text-xs text-white/50 mt-1">Use Fingerprint or FaceID to secure the app.</div>
            </div>
            <input 
              type="checkbox" 
              checked={formData.biometricEnabled}
              onChange={e => setFormData({...formData, biometricEnabled: e.target.checked})}
              className="h-5 w-5 accent-[#2E7D32]" 
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="mb-2 block text-sm font-semibold text-white">Language</label>
            <select 
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-stroke-2"
              value={formData.language} 
              onChange={e => setFormData({...formData, language: e.target.value})}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="te">తెలుగు (Telugu)</option>
            </select>
          </div>

          <div className="pt-4 flex flex-col gap-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs">
               <div className="text-white/60">
                 Last synced: <span className="text-white">{lastSyncDate}</span>
               </div>
               {isOffline && <div className="text-yellow-400 font-semibold">Offline Mode</div>}
               {!isOffline && syncStatus === 'success' && <div className="text-green-400 font-semibold">Sync Successful!</div>}
               {!isOffline && syncStatus === 'error' && <div className="text-red-400 font-semibold">Sync Failed</div>}
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="flex items-center gap-2 rounded-2xl bg-[#2E7D32] px-6 py-3 text-sm font-semibold text-white shadow-glowPrimary hover:opacity-90 transition">
                <Save size={18} /> Save Settings
              </button>
              <button type="button" onClick={() => void handleSync()} disabled={syncing || isOffline} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition disabled:opacity-50">
                <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} /> 
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-red-500/20">
          <button 
            type="button" 
            onClick={() => void handleLogout()} 
            disabled={loggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/10 px-6 py-3 text-sm font-semibold text-red-500 hover:bg-red-500/20 transition border border-red-500/20 disabled:opacity-50"
          >
            <LogOut size={18} className={loggingOut ? 'animate-pulse' : ''} /> 
            {loggingOut ? 'Logging out securely...' : 'Log Out'}
          </button>
        </div>
      </GlassCard>
    </div>
  )
}
