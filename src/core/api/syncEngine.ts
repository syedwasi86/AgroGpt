/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { db } from '../../lib/db'
import { initDatabase } from '../../lib/repository'
import { supabase } from '../auth/supabaseClient'
import type { Session } from '@supabase/supabase-js'

/**
 * Helper to get the last sync timestamp from user_settings
 */
async function getLastSyncTimestamp(): Promise<string> {
  const settings = await db.user_settings.toArray().then(a => a[0])
  return settings?.last_sync || new Date(0).toISOString()
}

/**
 * Pushes unsynced local records to Supabase.
 */
export async function pushChanges(providedSession?: Session | null): Promise<{ synced: number; failed: number }> {
  console.log('[SyncEngine] pushChanges START')
  await initDatabase()

  const session = providedSession || (await supabase.auth.getSession()).data.session
  console.log('[SyncEngine] pushChanges - SYNC SESSION:', session?.user?.id || 'No session')
  if (!session) {
    console.warn('[SyncEngine] pushChanges ABORT: No active Supabase session.')
    return { synced: 0, failed: 0 }
  }

  const userId = session.user.id
  let synced = 0
  let failed = 0

  const lastSync = await getLastSyncTimestamp()
  console.log('[SyncEngine] pushChanges - LAST SYNC TIMESTAMP:', lastSync)
  const tables = [
    'profiles',
    'crops',
    'transactions',
    'scans',
    'ai_queries',
    'crop_plans',
    'crop_stages',
    'farm_tasks',
    'weather_adjustments'
  ] as const

  for (const tableName of tables) {
    const table = db[tableName] as any
    // Fetch all records modified since last sync or marked pending
    const pending = await table.filter((record: any) => record.sync_status === 'pending' || record.updated_at > lastSync).toArray()
    console.log(`[SyncEngine] pushChanges - TABLE: ${tableName} | PENDING: ${pending.length}`)

    // Filter out scans with local base64/blob URLs (Option A: skip pushing to prevent DB bloat)
    let payload = pending

    if (tableName === 'scans') {
      payload = payload.filter((scan: any) => {
        if (scan.image_url && (scan.image_url.startsWith('data:') || scan.image_url.startsWith('blob:'))) {
          // TODO: Implement proper Supabase Storage upload flow here
          return false
        }
        return true
      })
    }

    if (payload.length === 0) {
      console.log(`[SyncEngine] pushChanges - TABLE: ${tableName} | No payload to upsert. Skipping.`)
      continue
    }

    // Standard batch upsert for all tables
    payload = payload.map((record: any) => {
      const cleanRecord: any = { ...record }

      // 1. Ensure user_id is set
      if (tableName !== 'profiles') {
        cleanRecord.user_id = cleanRecord.user_id || userId
      }

      // 2. Cast numeric fields from strings to numbers
      const numericFields = [
        'amount', 'area', 'total_acreage', 'nitrogen', 'phosphorus', 'potassium',
        'version', 'start_day', 'end_day', 'recurrence_interval_days'
      ]
      for (const field of numericFields) {
        if (cleanRecord[field] !== undefined && cleanRecord[field] !== null) {
          const parsed = Number(cleanRecord[field])
          cleanRecord[field] = isNaN(parsed) ? 0 : parsed
        }
      }

      // 3. Prevent empty strings in optional UUIDs
      const uuidFields = ['crop_id', 'stage_id', 'plan_id', 'task_id']
      for (const field of uuidFields) {
        if (cleanRecord[field] === '') {
          cleanRecord[field] = null
        }
      }

      // 4. Ensure valid ISO strings for dates
      const dateFields = [
        'created_at', 'updated_at', 'deleted_at', 'transaction_date', 'planted_date', 'scanned_at',
        'sowing_date', 'start_date', 'end_date', 'task_date', 'scheduled_date', 'effective_date',
        'original_date', 'adjusted_date', 'applied_at'
      ]
      for (const field of dateFields) {
        if (cleanRecord[field] === '') {
          cleanRecord[field] = null
        } else if (cleanRecord[field]) {
          const d = new Date(cleanRecord[field])
          if (!isNaN(d.getTime())) {
            cleanRecord[field] = d.toISOString()
          } else {
            cleanRecord[field] = null
          }
        }
      }

      // 5. Strip undefined values completely
      for (const key of Object.keys(cleanRecord)) {
        if (cleanRecord[key] === undefined) {
          delete cleanRecord[key]
        }
      }

      return cleanRecord
    })

    console.log(`[SyncEngine] pushChanges - UPSERTING TO ${tableName}:`, payload)

    const { error } = await supabase.from(tableName).upsert(payload)
    console.log("UPSERT ERROR FULL:", JSON.stringify(error, null, 2))

    if (error) {
      console.error(`[SyncEngine] Failed to push ${tableName} to Supabase:`, error)
      failed += pending.length
      // Mark as failed in Dexie so it retries
      for (const record of payload) {
        if (table.update) {
          await table.update(record.id, { sync_status: 'failed' })
        }
      }
    } else {
      synced += pending.length
      // Mark as successfully synced in Dexie
      for (const record of payload) {
        if (table.update) {
          await table.update(record.id, { sync_status: 'synced' })
        }
      }
    }
  }

  return { synced, failed }
}

/**
 * Pulls newer records from Supabase and stores them locally.
 */
export async function pullUpdates(providedSession?: Session | null): Promise<void> {
  await initDatabase()

  const session = providedSession || (await supabase.auth.getSession()).data.session
  if (!session) return

  const lastSync = await getLastSyncTimestamp()
  const tables = [
    'profiles',
    'crops',
    'transactions',
    'scans',
    'ai_queries',
    'user_settings',
    'crop_plans',
    'crop_stages',
    'farm_tasks',
    'weather_adjustments'
  ] as const

  for (const tableName of tables) {
    const { data: cloudRecords, error } = await supabase
      .from(tableName)
      .select('*')
      .gt('updated_at', lastSync) // Pull only newer records

    if (error) {
      console.error(`Failed to pull ${tableName} from Supabase:`, error)
      continue
    }

    if (cloudRecords && cloudRecords.length > 0) {
      const table = db[tableName] as any

      for (const record of cloudRecords) {
        // Conflict Resolution using version-first comparison:
        const local = await table.get(record.id)
        if (!local) {
          await table.put({ ...record, sync_status: 'synced' })
        } else {
          const hasVersion = record.version !== undefined && local.version !== undefined
          const remoteIsNewerVersion = hasVersion && record.version > local.version
          const sameVersionRemoteNewerTimestamp = hasVersion && record.version === local.version && new Date(record.updated_at) > new Date(local.updated_at)
          const fallbackRemoteNewerTimestamp = !hasVersion && new Date(record.updated_at) > new Date(local.updated_at)

          if (remoteIsNewerVersion || sameVersionRemoteNewerTimestamp || fallbackRemoteNewerTimestamp) {
            await table.put({ ...record, sync_status: 'synced' })
          }
        }
      }
    }
  }
}

let isSyncing = false

/**
 * Main synchronizer: Pushes local changes, then pulls remote updates, then updates last_sync.
 */
export async function syncData(providedSession?: Session | null): Promise<{ synced: number; failed: number }> {
  if (isSyncing) {
    console.log('[SyncEngine] Sync already in progress, skipping duplicate call.')
    return { synced: 0, failed: 0 }
  }

  isSyncing = true
  try {
    console.log('[SyncEngine] syncData START')
    await initDatabase()

  const session = providedSession || (await supabase.auth.getSession()).data.session
  if (!session) {
    console.warn('[SyncEngine] syncData ABORT: No active Supabase session.')
    return { synced: 0, failed: 0 }
  }

  console.log('[SyncEngine] syncData - Executing pushChanges...')
  // 1. Push local changes up to Supabase
  const pushResult = await pushChanges(session)

  console.log('[SyncEngine] syncData - Executing pullUpdates...')
  // 2. Pull remote changes down from Supabase
  await pullUpdates(session)

  // 3. Update the sync watermark ONLY if push completely succeeded
  // This ensures failed pushes or offline creations are retried on the next sync
  if (pushResult.failed === 0) {
    const settings = await db.user_settings.toArray().then(a => a[0])
    if (settings) {
      await db.user_settings.update(settings.id, {
        last_sync: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  }

    return pushResult
  } finally {
    isSyncing = false
  }
}
