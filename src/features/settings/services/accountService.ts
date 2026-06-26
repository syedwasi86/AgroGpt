import { db, type ProfileRecord, type UserSettingsRecord } from '@/lib/db'
import { profileRepository } from '@/lib/profileRepository'
import { supabase } from '@/core/auth/supabaseClient'

export async function saveProfile(data: Partial<ProfileRecord>) {
  const existing = await profileRepository.getCurrentProfile()
  if (existing) {
    return profileRepository.updateProfile(existing.id, data)
  } else {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) throw new Error('No user session')
    const now = new Date().toISOString()
    return db.profiles.put({
      id: session.user.id,
      phone: '',
      city: '',
      soil_type: '',
      primary_crop: '',
      total_acreage: 0,
      ...data,
      created_at: now,
      updated_at: now
    })
  }
}

export async function saveSettings(data: Partial<UserSettingsRecord>) {
  const existing = await db.user_settings.toArray().then(a => a[0])
  const cleanData = { ...data } as any
  delete cleanData.language

  if (existing) {
    return db.user_settings.update(existing.id, {
      ...cleanData,
      updated_at: new Date().toISOString()
    })
  } else {
    const now = new Date().toISOString()
    return db.user_settings.put({
      id: crypto.randomUUID(),
      notifications_enabled: false,
      last_sync: new Date(0).toISOString(),
      font_size: 'medium',
      theme: 'dark',
      voice_enabled: false,
      ...cleanData,
      created_at: now,
      updated_at: now
    })
  }
}
