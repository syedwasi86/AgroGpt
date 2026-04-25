import { db, type ProfileRecord, type SettingsRecord } from '../../../lib/db'

export async function saveProfile(data: Omit<ProfileRecord, 'id' | 'sync_status'>) {
  const existing = await db.profiles.get(1)
  return db.profiles.put({
    ...existing,
    ...data,
    id: 1,
    sync_status: 'pending'
  })
}

export async function saveSettings(data: Partial<Omit<SettingsRecord, 'id' | 'sync_status'>>) {
  const existing = await db.settings.get(1)
  if (existing) {
    return db.settings.put({
      ...existing,
      ...data,
      sync_status: 'pending'
    })
  } else {
    // If not exists, use defaults
    return db.settings.put({
      language: 'en',
      fontSize: 'medium',
      notificationsEnabled: false,
      biometricEnabled: false,
      lastSync: Date.now(),
      ...data,
      id: 1,
      sync_status: 'pending'
    })
  }
}
