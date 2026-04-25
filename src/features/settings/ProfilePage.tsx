import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { saveProfile } from './services/accountService'
import { GlassCard } from '../../components/GlassCard'
import { Save } from 'lucide-react'
import { supabase } from '../../core/auth/supabaseClient'

export function ProfilePage() {
  const profile = useLiveQuery(() => db.profiles.get(1))
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    totalAcreage: 0,
    primaryCrop: 'Cotton',
    soilType: 'Red Sandy Loam',
    city: '',
    location: ''
  })

  useEffect(() => {
    async function autoFillFromAuth() {
      const existing = await db.profiles.get(1)
      if (existing) return // already set up

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const user = session.user
      const isGoogle = user.app_metadata?.provider === 'google'

      let newName = ''
      let newEmail = ''
      let newPhone = ''

      if (isGoogle) {
        newName = user.user_metadata?.full_name || ''
        newEmail = user.email || ''
      } else {
        newPhone = user.phone || ''
      }

      setFormData(prev => ({
        ...prev,
        name: newName,
        email: newEmail,
        phone: newPhone
      }))

      await saveProfile({
        name: newName,
        email: newEmail,
        phone: newPhone,
        totalAcreage: 0,
        primaryCrop: 'Cotton',
        soilType: 'Red Sandy Loam',
        city: '',
        location: ''
      })
    }

    void autoFillFromAuth()
  }, [])

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(prev => ({
        ...prev,
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        totalAcreage: profile.totalAcreage || 0,
        primaryCrop: profile.primaryCrop || 'Cotton',
        soilType: profile.soilType || 'Red Sandy Loam',
        city: profile.city || '',
        location: profile.location || ''
      }))
    }
  }, [profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveProfile({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      totalAcreage: formData.totalAcreage,
      primaryCrop: formData.primaryCrop,
      soilType: formData.soilType,
      city: formData.city,
      location: formData.location
    })
    alert('Profile saved successfully!')
  }

  const inputClass = "w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-stroke-2"

  return (
    <div className="space-y-6">
      <div>
        <div className="agro-h1">My Farm & Me</div>
        <p className="subtle mt-2">Manage your identity and farm details.</p>
      </div>

      <GlassCard className="p-6" variant="strong">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/70">Name</label>
              <input type="text" className={inputClass} placeholder="Your Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/70">Email</label>
              <input type="email" className={inputClass} placeholder="Your Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/70">Phone (OTP logic pending)</label>
              <input type="tel" className={inputClass} placeholder="Phone Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/70">Total Acreage</label>
              <input type="number" step="0.1" className={inputClass} placeholder="e.g. 2.5" value={formData.totalAcreage} onChange={e => setFormData({...formData, totalAcreage: parseFloat(e.target.value) || 0})} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/70">Primary Crop</label>
              <select className={inputClass} value={formData.primaryCrop} onChange={e => setFormData({...formData, primaryCrop: e.target.value})}>
                <option value="Cotton">Cotton</option>
                <option value="Wheat">Wheat</option>
                <option value="Rice">Rice</option>
                <option value="Maize">Maize</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/70">Soil Type</label>
              <input type="text" className={inputClass} placeholder="e.g. Red Sandy Loam" value={formData.soilType} onChange={e => setFormData({...formData, soilType: e.target.value})} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/70">Location / City</label>
              <input type="text" className={inputClass} placeholder="e.g. Hyderabad" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
            </div>
          </div>
          
          <div className="pt-4 mt-6 border-t border-white/10">
            <button type="submit" className="flex items-center justify-center gap-2 rounded-2xl bg-[#2E7D32] px-6 py-3 text-sm font-semibold text-white shadow-glowPrimary hover:opacity-90 transition">
              <Save size={18} /> Save Profile
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  )
}
