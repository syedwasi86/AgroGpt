import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { saveSettings } from './services/accountService'
import { GlassCard } from '../../components/GlassCard'
import { Save, RefreshCw, LogOut } from 'lucide-react'
import { syncData } from '../../core/api/syncEngine'
import { supabase } from '../../core/auth/supabaseClient'
import { useNavigate } from 'react-router-dom'

export function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.get(1))
  const [syncing, setSyncing] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    notificationsEnabled: false,
    biometricEnabled: false,
    language: 'en'
  })

  useEffect(() => {
    if (settings) {
      setFormData({
        notificationsEnabled: settings.notificationsEnabled,
        biometricEnabled: settings.biometricEnabled,
        language: settings.language
      })
    }
  }, [settings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveSettings({
      notificationsEnabled: formData.notificationsEnabled,
      biometricEnabled: formData.biometricEnabled,
      language: formData.language
    })
    alert('Settings saved successfully!')
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncData()
      alert('Sync complete!')
    } catch {
      alert('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      // 1. Sign out from Supabase
      await supabase.auth.signOut()
      
      // 2. Wipe the local IndexedDB to prevent old data from bleeding to the next user
      // We use clear() instead of delete() to keep the Dexie instance open for the next login
      await Promise.all(db.tables.map(table => table.clear()))

      // 3. Clear the custom auth guard session state
      localStorage.removeItem('yield_user')

      // 4. Wait for the CSS fade-out animation to finish
      await new Promise(resolve => setTimeout(resolve, 600))

      // 5. Navigate smoothly to auth
      navigate('/auth', { replace: true })
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

          <div className="pt-4 flex flex-wrap gap-3 border-t border-white/10">
            <button type="submit" className="flex items-center gap-2 rounded-2xl bg-[#2E7D32] px-6 py-3 text-sm font-semibold text-white shadow-glowPrimary hover:opacity-90 transition">
              <Save size={18} /> Save Settings
            </button>
            <button type="button" onClick={() => void handleSync()} disabled={syncing} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition disabled:opacity-50">
              <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} /> Sync Now
            </button>
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
