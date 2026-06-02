import Dexie, { type Table } from 'dexie'
import { detectCityFromGeolocation, getSoilProfile, getSoilNPK } from '../core/utils/geolocation'

export type CropStatus = 'planned' | 'active' | 'completed' | 'failed'
export type TransactionType = 'income' | 'expense'

export interface ProfileRecord {
  id: string // UUID from Supabase auth
  auth_user_id?: string // Phase 2 target
  full_name?: string // Phase 2 target
  name?: string
  display_name?: string
  preferred_language?: string
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
  farm_name?: string
  farm_area_value?: number
  farm_area_unit?: string
  farm_area_acres?: number
  irrigation_sources?: string[]
  state?: string
  district?: string
  village?: string
  latitude?: number
  longitude?: number
  location_label?: string
  onboarding_completed?: boolean
  profile_completed_at?: string
  active_crop_plan_id?: string
  sync_status?: 'pending' | 'synced' | 'failed' | 'pending_delete'
  version?: number
  deleted_at?: string | null
  last_synced_at?: string | null
}

export interface CropRecord {
  id: string // UUID
  user_id?: string
  name: string
  variety: string
  planted_date: string // ISO string
  area: number
  status: 'planned' | 'active' | 'harvested'
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface TransactionRecord {
  id: string // UUID
  user_id?: string
  plan_id?: string | null // Replace crop_id with plan_id
  type: TransactionType
  category: string
  amount: number
  note?: string
  notes?: string // Phase 2 target
  transaction_date: string // ISO string
  created_at: string
  updated_at: string
  deleted_at?: string | null
  version?: number
  sync_status?: 'pending' | 'synced' | 'failed' | 'pending_delete'
  last_synced_at?: string | null
}

export interface ScanRecord {
  id: string // UUID
  user_id?: string
  plan_id?: string | null // Replace crop_id with plan_id
  crop_type: string
  image_url: string // Base64 string for local offline preview
  prediction: string
  confidence: number
  confidence_score?: number // Phase 2 target
  is_low_confidence: boolean
  feedback?: 'yes' | 'no' | null
  ai_enhanced?: boolean
  aiEnhanced?: boolean
  scanned_at: string // ISO string
  created_at: string
  updated_at: string
  deleted_at?: string | null
  version?: number
  sync_status?: 'pending' | 'synced' | 'failed' | 'pending_delete'
  last_synced_at?: string | null
}

export interface AiQueryRecord {
  id: string // UUID
  user_id?: string
  plan_id?: string | null // Link to plan
  question: string
  query?: string // Phase 2 target
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
  answer: string | null
  response?: string | null // Phase 2 target
  status: 'pending' | 'processing' | 'completed' | 'failed'
  query_type?: string // Phase 2 target
  created_at: string
  updated_at: string
  deleted_at?: string | null
  version?: number
  sync_status?: 'pending' | 'synced' | 'failed' | 'pending_delete'
  last_synced_at?: string | null
}

export interface UserSettingsRecord {
  id: string // UUID
  user_id?: string
  theme?: string // Phase 2 target
  notifications_enabled: boolean
  biometric_enabled: boolean
  font_size: string
  last_sync: string // ISO string
  voice_enabled: boolean // Phase 2 target
  created_at: string
  updated_at: string
}

export interface CropPlanRecord {
  id: string
  user_id?: string
  crop_type: string
  variety: string
  sowing_date: string // YYYY-MM-DD (UTC)
  crop_area_value?: number
  crop_area_unit?: string
  crop_area_acres?: number
  area: number // codebase compatibility
  expected_harvest_date?: string
  status: 'planned' | 'active' | 'completed' | 'failed'
  farmer_reported_stage?: string
  farmer_selected_stage?: string // codebase compatibility
  crop_condition?: string
  created_by_onboarding?: boolean
  created_at: string
  updated_at: string
  version: number
  sync_status: 'pending' | 'synced' | 'failed' | 'pending_delete'
  deleted_at?: string | null
  last_synced_at?: string | null
}

export interface CropStageRecord {
  id: string
  plan_id: string
  stage_name: string
  name: string // codebase compatibility
  start_date: string // YYYY-MM-DD (UTC)
  end_date: string // YYYY-MM-DD (UTC)
  days_from_sowing: number
  start_day: number // codebase compatibility
  end_day: number // codebase compatibility
  stage_order?: number
  is_current?: boolean
  status: 'upcoming' | 'current' | 'completed'
  version: number
  sync_status: 'pending' | 'synced' | 'failed' | 'pending_delete'
  created_at: string
  updated_at: string
  deleted_at?: string | null
  last_synced_at?: string | null
}

export interface FarmTaskRecord {
  id: string
  plan_id: string
  stage_id?: string | null
  title: string
  description?: string
  task_type: 'irrigation' | 'fertilization' | 'pesticide' | 'weeding' | 'harvesting' | 'inspection' | 'other'
  task_date: string // YYYY-MM-DD (UTC)
  status: 'pending' | 'completed' | 'overdue' | 'rescheduled'
  priority: 'low' | 'medium' | 'high'
  notes?: string
  completed_at?: string | null
  scheduled_date: string // YYYY-MM-DD (UTC) - codebase compatibility
  effective_date: string // YYYY-MM-DD (UTC) - codebase compatibility
  origin: 'template' | 'manual' | 'weather_adjustment' | 'ai_generated'
  task_template_id?: string
  is_recurring: boolean
  recurrence_interval_days?: number
  version: number
  sync_status: 'pending' | 'synced' | 'failed' | 'pending_delete'
  created_at: string
  updated_at: string
  deleted_at?: string | null
  last_synced_at?: string | null
}

export interface WeatherAdjustmentRecord {
  id: string
  plan_id: string
  task_id: string // codebase compatibility
  weather_event?: string
  adjustment_type: 'irrigation_delay' | 'spray_warning' | 'disease_warning' | 'heat_stress'
  recommendation?: string
  effective_date?: string
  reason: string // codebase compatibility
  original_date: string // codebase compatibility
  adjusted_date: string // codebase compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weather_data: any
  applied_at: string // ISO UTC timestamp
  version: number
  sync_status: 'pending' | 'synced' | 'failed' | 'pending_delete'
  created_at: string
  updated_at: string
  deleted_at?: string | null
  last_synced_at?: string | null
}

export interface DashboardCacheRecord {
  key: string
  type: 'snapshot' | 'weather' | 'ai-insights' | 'market' | 'farm-status'
  payload: unknown
  created_at: string
  updated_at: string
  expires_at?: string
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
  dashboard_cache!: Table<DashboardCacheRecord, string>

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
    this.version(3).stores({
      profiles: 'id',
      crops: 'id, user_id, status, planted_date, deleted_at',
      transactions: 'id, user_id, crop_id, type, transaction_date, deleted_at',
      scans: 'id, user_id, crop_id, scanned_at, deleted_at',
      ai_queries: 'id, user_id, status, deleted_at',
      user_settings: 'id, user_id',
      crop_plans: 'id, user_id, status, sowing_date, deleted_at',
      crop_stages: 'id, plan_id, status, start_date, end_date, deleted_at',
      farm_tasks: 'id, plan_id, stage_id, status, task_date, task_type, deleted_at',
      weather_adjustments: 'id, plan_id, task_id, adjustment_type, deleted_at',
      dashboard_cache: 'key'
    })
    this.version(4).stores({
      profiles: 'id',
      crops: 'id, user_id, status, planted_date, deleted_at',
      transactions: 'id, user_id, crop_id, type, transaction_date, deleted_at',
      scans: 'id, user_id, crop_id, scanned_at, deleted_at',
      ai_queries: 'id, user_id, status, deleted_at',
      user_settings: 'id, user_id',
      crop_plans: 'id, user_id, status, sowing_date, deleted_at',
      crop_stages: 'id, plan_id, status, start_date, end_date, deleted_at',
      farm_tasks: 'id, plan_id, stage_id, status, task_date, task_type, deleted_at',
      weather_adjustments: 'id, plan_id, task_id, adjustment_type, deleted_at',
      dashboard_cache: 'key'
    })
    this.version(5).stores({
      profiles: 'id, active_crop_plan_id',
      transactions: 'id, user_id, plan_id, type, transaction_date, deleted_at',
      scans: 'id, user_id, plan_id, scanned_at, deleted_at',
      ai_queries: 'id, user_id, plan_id, status, deleted_at',
      user_settings: 'id, user_id',
      crop_plans: 'id, user_id, status, sowing_date, deleted_at',
      crop_stages: 'id, plan_id, status, start_date, end_date, deleted_at',
      farm_tasks: 'id, plan_id, stage_id, status, task_date, task_type, deleted_at',
      weather_adjustments: 'id, plan_id, task_id, adjustment_type, deleted_at',
      dashboard_cache: 'key',
      crops: null // Nuke crops table in schema v5
    }).upgrade(async tx => {
      // 1. Move crops to crop_plans if they don't already exist
      const cropsList = await tx.table('crops').toArray();
      const allCropPlans = await tx.table('crop_plans').toArray();
      const planMap = new Map<string, string>(); // crop_id -> plan_id
      
      for (const crop of cropsList) {
        const existingPlans = allCropPlans.filter((p) => p.user_id === crop.user_id);
        const matchingPlan = existingPlans.find((p) => p.crop_type === crop.name && p.sowing_date === crop.planted_date);
        
        if (matchingPlan) {
          planMap.set(crop.id, matchingPlan.id);
        } else {
          const planId = crypto.randomUUID();
          await tx.table('crop_plans').add({
            id: planId,
            user_id: crop.user_id,
            crop_type: crop.name,
            variety: crop.variety,
            sowing_date: crop.planted_date,
            crop_area_value: crop.area,
            crop_area_unit: 'Acre',
            crop_area_acres: crop.area,
            area: crop.area,
            status: crop.status === 'harvested' ? 'completed' : (crop.status === 'active' ? 'active' : 'planned'),
            created_at: crop.created_at,
            updated_at: crop.updated_at,
            deleted_at: crop.deleted_at,
            version: 1,
            sync_status: 'pending'
          });
          planMap.set(crop.id, planId);
        }
      }

      // 2. Update transactions: crop_id -> plan_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await tx.table('transactions').toCollection().modify((txRecord: any) => {
        if (txRecord.crop_id) {
          txRecord.plan_id = planMap.get(txRecord.crop_id) || txRecord.crop_id;
          txRecord.notes = txRecord.category;
          delete txRecord.crop_id;
        }
      });

      // 3. Update scans: crop_id -> plan_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await tx.table('scans').toCollection().modify((scanRecord: any) => {
        if (scanRecord.crop_id) {
          scanRecord.plan_id = planMap.get(scanRecord.crop_id) || scanRecord.crop_id;
          scanRecord.confidence_score = scanRecord.confidence;
          delete scanRecord.crop_id;
        }
      });

      // 4. Update ai_queries
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await tx.table('ai_queries').toCollection().modify((queryRecord: any) => {
        if (queryRecord.context) {
          if (queryRecord.context.crop_id) {
            queryRecord.plan_id = planMap.get(queryRecord.context.crop_id) || queryRecord.context.crop_id;
            queryRecord.context.plan_id = queryRecord.plan_id;
            delete queryRecord.context.crop_id;
          }
        }
        queryRecord.query = queryRecord.question;
        queryRecord.response = queryRecord.answer;
      });

      // 5. Update user_settings - remove language
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await tx.table('user_settings').toCollection().modify((settingRecord: any) => {
        delete settingRecord.language;
      });
    });

    this.version(6).stores({
      profiles: 'id, active_crop_plan_id',
      transactions: 'id, user_id, plan_id, type, transaction_date, deleted_at',
      scans: 'id, user_id, plan_id, scanned_at, created_at, deleted_at',
      ai_queries: 'id, user_id, plan_id, status, deleted_at',
      user_settings: 'id, user_id',
      crop_plans: 'id, user_id, status, sowing_date, deleted_at',
      crop_stages: 'id, plan_id, status, start_date, end_date, deleted_at',
      farm_tasks: 'id, plan_id, stage_id, status, task_date, task_type, deleted_at',
      weather_adjustments: 'id, plan_id, task_id, adjustment_type, deleted_at',
      dashboard_cache: 'key'
    });
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
      notifications_enabled: false,
      biometric_enabled: false,
      last_sync: new Date(0).toISOString(),
      font_size: 'medium',
      theme: 'dark',
      voice_enabled: false,
      created_at: now,
      updated_at: now,
    })
  } else if (userId && !existing.user_id) {
    await db.user_settings.update(existing.id, { user_id: userId, updated_at: new Date().toISOString() })
  }
}

export async function initializeUserProfile(userId?: string) {
  const existing = userId 
    ? await db.profiles.get(userId)
    : await db.profiles.toArray().then(a => a[0])

  if (!existing) {
    const city = await detectCityFromGeolocation()
    const soilType = getSoilProfile(city)
    const npk = getSoilNPK(soilType)
    const now = new Date().toISOString()
    
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
