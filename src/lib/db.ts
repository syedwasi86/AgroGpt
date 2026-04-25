import Dexie, { type Table } from 'dexie'

export type SyncStatus = 'pending' | 'synced'

/** Crop status for rotation / harvest tracking */
export type CropStatus = 'active' | 'harvested' | 'planned'

export interface CropRecord {
  id?: number
  name: string
  variety: string
  /** ISO date string (YYYY-MM-DD) */
  plantedDate: string
  /** Area in acres */
  area: number
  status: CropStatus
  sync_status: SyncStatus
}

export interface LedgerRecord {
  id?: number
  cropId?: number | null
  type: 'income' | 'expense'
  /** Display category / label (e.g. Diesel, Fertilizer) */
  category: string
  amount: number
  /** ISO datetime string */
  date: string
  notes?: string
  sync_status: SyncStatus
}

export interface ScanRecord {
  id?: number
  timestamp: number
  /** JSON string: mode, title, meta, etc. */
  resultJson: string
  imageBlob: Blob
  sync_status: SyncStatus
}

export interface ProfileRecord {
  id?: number
  name?: string
  email?: string
  phone: string
  totalAcreage: number
  primaryCrop: string
  soilType: string
  city: string
  location: string
  sync_status?: SyncStatus
}

export interface SettingsRecord {
  id?: number
  language: string
  fontSize: string
  notificationsEnabled: boolean
  biometricEnabled: boolean
  lastSync: number
  sync_status?: SyncStatus
}

export interface WeatherCacheRecord {
  id: string
  timestamp: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
}

/** Single-device user profile synced from auth (id is always 1). */
export interface OfflineMetadataRecord {
  id: number
  name: string
  phone: string
  email?: string
  city?: string
  updatedAt: number
  sync_status: SyncStatus
}

export class AgroGPTDatabase extends Dexie {
  crops!: Table<CropRecord, number>
  ledger!: Table<LedgerRecord, number>
  scans!: Table<ScanRecord, number>
  offlineMetadata!: Table<OfflineMetadataRecord, number>
  profiles!: Table<ProfileRecord, number>
  settings!: Table<SettingsRecord, number>
  weatherCache!: Table<WeatherCacheRecord, string>

  constructor() {
    super('AgroGPT')
    this.version(1).stores({
      crops: '++id, name, status, plantedDate',
      ledger: '++id, cropId, type, date, synced',
      scans: '++id, timestamp',
    })
    this.version(2).stores({
      offlineMetadata: 'id',
    })
    this.version(3).stores({
      crops: '++id, name, status, plantedDate, sync_status',
      ledger: '++id, cropId, type, date, sync_status',
      scans: '++id, timestamp, sync_status',
      offlineMetadata: 'id, sync_status',
    }).upgrade(tx => {
      // Migrate old data to the new sync_status structure
      return Promise.all([
        tx.table('crops').toCollection().modify(c => { c.sync_status = 'pending' }),
        tx.table('ledger').toCollection().modify(l => { 
          l.sync_status = l.synced === 1 ? 'synced' : 'pending'
          delete l.synced
        }),
        tx.table('scans').toCollection().modify(s => { s.sync_status = 'pending' }),
        tx.table('offlineMetadata').toCollection().modify(m => { m.sync_status = 'pending' })
      ])
    })
    this.version(4).stores({
      profiles: '++id, phone',
      settings: '++id',
    })
    this.version(5).stores({
      weatherCache: 'id',
    })
  }
}

export const db = new AgroGPTDatabase()

const PROFILE_ID = 1

type UpsertOfflineInput = Pick<OfflineMetadataRecord, 'name' | 'phone'> & {
  email?: string | undefined
  city?: string | undefined
  /** When true, replace email/city with `data` values (including clearing when undefined). */
  replaceOptional?: boolean
}

export async function upsertOfflineMetadata(data: UpsertOfflineInput) {
  const existing = await db.offlineMetadata.get(PROFILE_ID)
  const email =
    data.replaceOptional
      ? data.email
      : (data.email ?? existing?.email)
  const city =
    data.replaceOptional
      ? data.city
      : (data.city ?? existing?.city)
  await db.offlineMetadata.put({
    id: PROFILE_ID,
    name: data.name || existing?.name || '',
    phone: data.phone,
    email: email || undefined,
    city: city || undefined,
    updatedAt: Date.now(),
    sync_status: existing?.sync_status ?? 'pending',
  })
}

export async function initializeUserPreferences() {
  const existing = await db.settings.get(1)
  if (!existing) {
    await db.settings.put({
      id: 1,
      language: 'en',
      fontSize: 'medium',
      notificationsEnabled: false,
      biometricEnabled: false,
      lastSync: 0,
      sync_status: 'pending',
    })
  }
}
