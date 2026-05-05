import { db, type ProfileRecord, type UserSettingsRecord } from '@/lib/db'

export async function saveProfile(data: Partial<ProfileRecord>) {
  const existing = await db.profiles.toArray().then(a => a[0])
  if (existing) {
    return db.profiles.update(existing.id, {
      ...data,
      updated_at: new Date().toISOString()
    })
  } else {
    const now = new Date().toISOString()
    return db.profiles.put({
      id: crypto.randomUUID(), // Or get auth user ID if available
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
  if (existing) {
    return db.user_settings.update(existing.id, {
      ...data,
      updated_at: new Date().toISOString()
    })
  } else {
    // If not exists, use defaults
    const now = new Date().toISOString()
    return db.user_settings.put({
      id: crypto.randomUUID(),
      language: 'en',
      font_size: 'medium',
      notifications_enabled: false,
      biometric_enabled: false,
      last_sync: new Date(0).toISOString(),
      ...data,
      created_at: now,
      updated_at: now
    })
  }
}
