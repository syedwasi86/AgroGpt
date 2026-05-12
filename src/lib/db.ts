import Dexie, { type Table } from 'dexie'
import { detectCityFromGeolocation, getSoilProfile, getSoilNPK } from '../core/utils/geolocation'

export type CropStatus = 'planned' | 'active' | 'harvested'
export type TransactionType = 'income' | 'expense'

export interface ProfileRecord {
  id: string // UUID from Supabase auth
  name?: string
  email?: string
  phone: string
  city: string
  soil_type: string
  primary_crop: string
  total_acreage: number
  nitrogen?: number
  phosphorus?: number
  potassium?: number
  created_at: string
  updated_at: string
}

export interface CropRecord {
  id: string // UUID
  user_id?: string
  name: string
  variety: string
  planted_date: string // ISO string
  area: number
  status: CropStatus
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface TransactionRecord {
  id: string // UUID
  user_id?: string
  crop_id?: string | null
  type: TransactionType
  category: string
  amount: number
  note?: string
  transaction_date: string // ISO string
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface ScanRecord {
  id: string // UUID
  user_id?: string
  crop_id?: string | null
  crop_type: string
  image_url: string // Base64 string for local offline preview
  prediction: string
  confidence: number
  is_low_confidence: boolean
  feedback?: 'yes' | 'no' | null
  scanned_at: string // ISO string
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface AiQueryRecord {
  id: string // UUID
  user_id?: string
  question: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
  answer: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface UserSettingsRecord {
  id: string // UUID
  user_id?: string
  language: string
  font_size: string
  notifications_enabled: boolean
  biometric_enabled: boolean
  last_sync: string // ISO string
  created_at: string
  updated_at: string
}

export class AgroGPTDatabase extends Dexie {
  profiles!: Table<ProfileRecord, string>
  crops!: Table<CropRecord, string>
  transactions!: Table<TransactionRecord, string>
  scans!: Table<ScanRecord, string>
  ai_queries!: Table<AiQueryRecord, string>
  user_settings!: Table<UserSettingsRecord, string>

  constructor() {
    super('AgroGPT_v2')
    this.version(1).stores({
      profiles: 'id',
      crops: 'id, user_id, status, planted_date, deleted_at',
      transactions: 'id, user_id, crop_id, type, transaction_date, deleted_at',
      scans: 'id, user_id, crop_id, scanned_at, deleted_at',
      ai_queries: 'id, user_id, status, deleted_at',
      user_settings: 'id, user_id'
    })
  }
}

export const db = new AgroGPTDatabase()

export async function initializeUserPreferences(userId?: string) {
  const existing = await db.user_settings.toArray().then(a => a[0])
  if (!existing) {
    const now = new Date().toISOString()
    await db.user_settings.put({
      id: crypto.randomUUID(),
      user_id: userId,
      language: 'en',
      font_size: 'medium',
      notifications_enabled: false,
      biometric_enabled: false,
      last_sync: new Date(0).toISOString(),
      created_at: now,
      updated_at: now,
    })
  } else if (userId && !existing.user_id) {
    await db.user_settings.update(existing.id, { user_id: userId, updated_at: new Date().toISOString() })
  }
}

export async function initializeUserProfile(userId?: string) {
  // Try to find a profile with this user ID, or the first one if we're not logged in
  const existing = userId 
    ? await db.profiles.get(userId)
    : await db.profiles.toArray().then(a => a[0])

  if (!existing) {
    const city = await detectCityFromGeolocation()
    const soilType = getSoilProfile(city)
    const npk = getSoilNPK(soilType)
    const now = new Date().toISOString()
    
    // We use the provided userId or a temporary un-synced ID that will be updated on login
    const id = userId || crypto.randomUUID()
    
    await db.profiles.put({
      id,
      phone: '',
      city,
      soil_type: soilType,
      primary_crop: '',
      total_acreage: 0,
      nitrogen: npk.nitrogen,
      phosphorus: npk.phosphorus,
      potassium: npk.potassium,
      created_at: now,
      updated_at: now,
    })
  }
}
