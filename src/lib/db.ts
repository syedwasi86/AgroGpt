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
  ai_enhanced?: boolean
  aiEnhanced?: boolean
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

export interface CropPlanRecord {
  id: string
  user_id?: string
  crop_type: string
  variety: string
  sowing_date: string // YYYY-MM-DD (UTC)
  area: number
  status: 'planned' | 'active' | 'completed' | 'failed'
  version: number
  sync_status: 'pending' | 'synced' | 'failed'
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface CropStageRecord {
  id: string
  plan_id: string
  name: string
  start_day: number
  end_day: number
  start_date: string // YYYY-MM-DD (UTC)
  end_date: string // YYYY-MM-DD (UTC)
  status: 'upcoming' | 'current' | 'completed'
  version: number
  sync_status: 'pending' | 'synced' | 'failed'
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface FarmTaskRecord {
  id: string
  plan_id: string
  stage_id?: string | null
  title: string
  description?: string
  status: 'pending' | 'completed' | 'overdue' | 'rescheduled'
  task_date: string // YYYY-MM-DD (UTC) - equivalent to effective_date for backward compatibility
  scheduled_date: string // YYYY-MM-DD (UTC) - agronomy recommendation
  effective_date: string // YYYY-MM-DD (UTC) - weather-adjusted display date
  task_type: 'irrigation' | 'fertilization' | 'pesticide' | 'weeding' | 'harvesting' | 'inspection' | 'other'
  priority: 'low' | 'medium' | 'high'
  notes?: string
  origin: 'template' | 'manual' | 'weather_adjustment' | 'ai_generated'
  task_template_id?: string
  is_recurring: boolean
  recurrence_interval_days?: number
  version: number
  sync_status: 'pending' | 'synced' | 'failed'
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface WeatherAdjustmentRecord {
  id: string
  plan_id: string
  task_id: string
  adjustment_type: 'irrigation_delay' | 'spray_warning' | 'disease_warning' | 'heat_stress'
  reason: string
  original_date: string // YYYY-MM-DD (UTC)
  adjusted_date: string // YYYY-MM-DD (UTC)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weather_data: any
  applied_at: string // ISO UTC timestamp
  version: number
  sync_status: 'pending' | 'synced' | 'failed'
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export class AgroGPTDatabase extends Dexie {
  profiles!: Table<ProfileRecord, string>
  crops!: Table<CropRecord, string>
  transactions!: Table<TransactionRecord, string>
  scans!: Table<ScanRecord, string>
  ai_queries!: Table<AiQueryRecord, string>
  user_settings!: Table<UserSettingsRecord, string>
  crop_plans!: Table<CropPlanRecord, string>
  crop_stages!: Table<CropStageRecord, string>
  farm_tasks!: Table<FarmTaskRecord, string>
  weather_adjustments!: Table<WeatherAdjustmentRecord, string>

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
    this.version(2).stores({
      profiles: 'id',
      crops: 'id, user_id, status, planted_date, deleted_at',
      transactions: 'id, user_id, crop_id, type, transaction_date, deleted_at',
      scans: 'id, user_id, crop_id, scanned_at, deleted_at',
      ai_queries: 'id, user_id, status, deleted_at',
      user_settings: 'id, user_id',
      crop_plans: 'id, user_id, status, sowing_date, deleted_at',
      crop_stages: 'id, plan_id, status, start_date, end_date, deleted_at',
      farm_tasks: 'id, plan_id, stage_id, status, task_date, task_type, deleted_at',
      weather_adjustments: 'id, plan_id, task_id, adjustment_type, deleted_at'
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
