/* eslint-disable @typescript-eslint/no-explicit-any */
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
function cleanRecordData(tableName: string, record: any, userId: string): any {
  const cleanRecord: any = { ...record }

  // 1. Ensure user_id is set
  const tablesWithUserId = ['transactions', 'scans', 'ai_queries', 'crop_plans']
  if (tablesWithUserId.includes(tableName)) {
    cleanRecord.user_id = cleanRecord.user_id || userId
  }

  // 1b. Fix crop_stages Column Mapping
  if (tableName === 'crop_stages') {
    if (cleanRecord.name && !cleanRecord.stage_name) {
      cleanRecord.stage_name = cleanRecord.name
    }
    delete cleanRecord.name
  }

  // 2. Cast numeric fields from strings to numbers
  const numericFields = [
    'amount', 'area', 'total_acreage', 'nitrogen', 'phosphorus', 'potassium',
    'version', 'start_day', 'end_day', 'recurrence_interval_days',
    'farm_area_value', 'farm_area_acres', 'latitude', 'longitude', 'crop_area_value', 'crop_area_acres'
  ]
  for (const field of numericFields) {
    if (cleanRecord[field] !== undefined && cleanRecord[field] !== null) {
      const parsed = Number(cleanRecord[field])
      cleanRecord[field] = isNaN(parsed) ? 0 : parsed
    }
  }

  // 3. Prevent empty strings in optional UUIDs
  const uuidFields = ['crop_id', 'stage_id', 'plan_id', 'task_id', 'active_crop_plan_id']
  for (const field of uuidFields) {
    if (cleanRecord[field] === '') {
      cleanRecord[field] = null
    }
  }

  // 4. Ensure valid ISO strings for dates
  const dateFields = [
    'created_at', 'updated_at', 'deleted_at', 'transaction_date', 'planted_date', 'scanned_at',
    'sowing_date', 'start_date', 'end_date', 'task_date', 'scheduled_date', 'effective_date',
    'original_date', 'adjusted_date', 'applied_at', 'profile_completed_at'
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

  // 5. Delete client-only metadata fields
  delete cleanRecord.sync_status
  delete cleanRecord.last_synced_at

  // 6. Strip undefined values completely
  for (const key of Object.keys(cleanRecord)) {
    if (cleanRecord[key] === undefined) {
      delete cleanRecord[key]
    }
  }

  return cleanRecord
}

/**
 * Pushes unsynced local records to Supabase.
 */
export async function pushChanges(
  providedSession?: Session | null,
  targetTables?: string[]
): Promise<{ synced: number; failed: number }> {
  console.log('[SyncEngine] pushChanges START', targetTables ? `for tables: ${targetTables.join(', ')}` : 'for all tables')
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

  const shouldPushProfiles = !targetTables || targetTables.includes('profiles')

  // ─── PHASE 1: Foundational Profile Push (Before the loop) ───
  if (shouldPushProfiles) {
    const pendingProfiles = await db.profiles.filter((record: any) =>
      record.sync_status === 'pending' ||
      record.sync_status === 'pending_delete' ||
      record.sync_status === 'pending_del'
    ).toArray()

    const poisonedProfiles = pendingProfiles.filter((record: any) =>
      record.id === 'dev-bypass-user' ||
      record.user_id === 'dev-bypass-user'
    )
    const validProfiles = pendingProfiles.filter((record: any) =>
      record.id !== 'dev-bypass-user' &&
      record.user_id !== 'dev-bypass-user'
    )

    if (poisonedProfiles.length > 0) {
      const poisonedIds = poisonedProfiles.map((r: any) => r.id)
      console.warn(`[SyncEngine] Wiping ${poisonedIds.length} legacy dev-bypass profiles from IndexedDB:`, poisonedIds)
      await db.profiles.bulkDelete(poisonedIds).catch((err: any) =>
        console.error('[SyncEngine] Failed to bulkDelete poisoned profiles:', err)
      )
    }

    if (validProfiles.length > 0) {
      const strippedProfiles = validProfiles.map((record: any) => {
        const cleanRecord = cleanRecordData('profiles', record, userId)
        cleanRecord.id = userId
        delete cleanRecord.active_crop_plan_id
        return cleanRecord
      })

      console.log('[SyncEngine] pushChanges Phase 1 - Upserting stripped profiles:', strippedProfiles)
      const { error } = await supabase.from('profiles').upsert(strippedProfiles)
      if (error) {
        console.error('[SyncEngine] Phase 1 profile upsert failed:', error)
        failed += validProfiles.length
        for (const record of validProfiles) {
          await db.profiles.update(record.id, { sync_status: 'failed' }).catch(() => {})
        }
      }
    }
  }

  // ─── PHASE 2: Standard relational tables push ───
  const allRelationalTables = [
    'crop_plans',          // Trunk: Must exist first
    'crop_stages',         // Branch: Depends on crop_plans
    'farm_tasks',          // Leaf: Depends on crop_plans and crop_stages
    'transactions',        // Leaf: Depends on crop_plans
    'scans',               // Independent / Depends on profiles
    'ai_queries',          // Independent / Depends on profiles
    'weather_adjustments'  // Independent / Depends on plans or tasks
  ] as const

  const tablesToProcess = targetTables
    ? allRelationalTables.filter(t => targetTables.includes(t))
    : allRelationalTables

  for (const tableName of tablesToProcess) {
    const table = db[tableName] as any
    const pending = await table.filter((record: any) =>
      record.sync_status === 'pending' ||
      record.sync_status === 'pending_delete' ||
      record.sync_status === 'pending_del'
    ).toArray()

    // ─── Enforce Single Active Plan Rule Locally ───
    if (tableName === 'crop_plans') {
      const activePendingPlans = pending.filter((p: any) => p.status === 'active')
      if (activePendingPlans.length > 1) {
        console.log(`[SyncEngine] Found ${activePendingPlans.length} active pending crop plans. Enforcing single active plan rule.`)
        
        // Sort activePendingPlans by updated_at descending (newest first)
        activePendingPlans.sort((a: any, b: any) => {
          const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0
          const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0
          return timeB - timeA
        })

        const newestPlan = activePendingPlans[0]
        const olderPlans = activePendingPlans.slice(1)

        for (const oldPlan of olderPlans) {
          oldPlan.status = 'completed'
          oldPlan.updated_at = oldPlan.updated_at || new Date().toISOString()
          await db.crop_plans.update(oldPlan.id, {
            status: 'completed',
            updated_at: oldPlan.updated_at
          }).catch((err: any) => console.error(`[SyncEngine] Failed to update older plan ${oldPlan.id} to completed:`, err))
        }
      }
    }

    console.log(`[SyncEngine] pushChanges - TABLE: ${tableName} | PENDING: ${pending.length}`)

    const poisonedRecords = pending.filter((record: any) =>
      record.id === 'dev-bypass-user' ||
      record.user_id === 'dev-bypass-user'
    )
    const validRecords = pending.filter((record: any) =>
      record.id !== 'dev-bypass-user' &&
      record.user_id !== 'dev-bypass-user'
    )

    if (poisonedRecords.length > 0) {
      const poisonedIds = poisonedRecords.map((r: any) => r.id)
      console.warn(`[SyncEngine] Wiping ${poisonedIds.length} legacy dev-bypass records from table ${tableName}:`, poisonedIds)
      await table.bulkDelete(poisonedIds).catch((err: any) =>
        console.error(`[SyncEngine] Failed to bulkDelete poisoned records from ${tableName}:`, err)
      )
    }

    let payload = validRecords

    if (tableName === 'scans') {
      payload = payload.filter((scan: any) => {
        if (scan.image_url && (scan.image_url.startsWith('data:') || scan.image_url.startsWith('blob:'))) {
          return false
        }
        return true
      })
    }

    if (payload.length === 0) {
      console.log(`[SyncEngine] pushChanges - TABLE: ${tableName} | No valid payload to upsert. Skipping.`)
      continue
    }

    payload = payload.map((record: any) => cleanRecordData(tableName, record, userId))

    console.log(`[SyncEngine] pushChanges - UPSERTING TO ${tableName}:`, payload)

    const { error } = await supabase.from(tableName).upsert(payload)
    console.log("UPSERT ERROR FULL:", JSON.stringify(error, null, 2))

    if (error) {
      console.error(`[SyncEngine] Failed to push ${tableName} to Supabase:`, error)
      failed += payload.length
      for (const record of payload) {
        if (table.update) {
          await table.update(record.id, { sync_status: 'failed' }).catch(() => {})
        }
      }
    } else {
      synced += payload.length
      for (const record of payload) {
        if (record.sync_status === 'pending_delete') {
          if (table.delete) {
            await table.delete(record.id).catch(() => {})
          }
        } else {
          if (table.update) {
            await table.update(record.id, { sync_status: 'synced' }).catch(() => {})
          }
        }
      }
    }
  }

  // ─── PHASE 3: Final Profile Push (To link active_crop_plan_id) ───
  if (shouldPushProfiles) {
    const pendingProfilesPhase3 = await db.profiles.filter((record: any) =>
      record.sync_status === 'pending' ||
      record.sync_status === 'pending_delete' ||
      record.sync_status === 'pending_del'
    ).toArray()

    const validProfilesPhase3 = pendingProfilesPhase3.filter((record: any) =>
      record.id !== 'dev-bypass-user' &&
      record.user_id !== 'dev-bypass-user'
    )

    if (validProfilesPhase3.length > 0) {
      const fullProfiles = validProfilesPhase3.map((record: any) => {
        const cleanRecord = cleanRecordData('profiles', record, userId)
        cleanRecord.id = userId
        return cleanRecord
      })

      console.log('[SyncEngine] pushChanges Phase 3 - Upserting full profiles:', fullProfiles)
      const { error } = await supabase.from('profiles').upsert(fullProfiles)

      if (error) {
        console.error('[SyncEngine] Phase 3 profile upsert failed:', error)
        failed += validProfilesPhase3.length
        for (const record of validProfilesPhase3) {
          await db.profiles.update(record.id, { sync_status: 'failed' }).catch(() => {})
        }
      } else {
        synced += validProfilesPhase3.length
        for (const record of validProfilesPhase3) {
          if (record.sync_status === 'pending_delete') {
            await db.profiles.delete(record.id).catch(() => {})
          } else {
            await db.profiles.update(record.id, { sync_status: 'synced' }).catch(() => {})
          }
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
        const recordToStore = { ...record }
        if (tableName === 'crop_stages') {
          if (recordToStore.stage_name && !recordToStore.name) {
            recordToStore.name = recordToStore.stage_name
          }
        }

        // Conflict Resolution using version-first comparison:
        const local = await table.get(recordToStore.id)
        if (!local) {
          await table.put({ ...recordToStore, sync_status: 'synced' })
        } else {
          const hasVersion = recordToStore.version !== undefined && local.version !== undefined
          const remoteIsNewerVersion = hasVersion && recordToStore.version > local.version
          const sameVersionRemoteNewerTimestamp = hasVersion && recordToStore.version === local.version && new Date(recordToStore.updated_at) > new Date(local.updated_at)
          const fallbackRemoteNewerTimestamp = !hasVersion && new Date(recordToStore.updated_at) > new Date(local.updated_at)

          if (remoteIsNewerVersion || sameVersionRemoteNewerTimestamp || fallbackRemoteNewerTimestamp) {
            await table.put({ ...recordToStore, sync_status: 'synced' })
          }
        }
      }
    }
  }
}

let isSyncing = false
let initialSyncDone = false

/**
 * Initial hydration pull: ONLY pulls remote updates and hydrates Dexie.
 * Does NOT push local records. Non-destructive.
 */
export async function initialSync(providedSession?: Session | null): Promise<void> {
  console.log('[SyncEngine] initialSync START')
  await initDatabase()

  const session = providedSession || (await supabase.auth.getSession()).data.session
  if (!session) {
    console.warn('[SyncEngine] initialSync ABORT: No active Supabase session.')
    return
  }

  // Pull remote changes down from Supabase
  await pullUpdates(session)
  initialSyncDone = true
  console.log('[SyncEngine] initialSync COMPLETE')
}

/**
 * Main synchronizer: Pushes local changes, then pulls remote updates, then updates last_sync.
 */
export async function backgroundSync(providedSession?: Session | null): Promise<{ synced: number; failed: number }> {
  if (isSyncing) {
    console.log('[SyncEngine] Sync already in progress, skipping duplicate call.')
    return { synced: 0, failed: 0 }
  }

  isSyncing = true
  try {
    console.log('[SyncEngine] backgroundSync START')
    await initDatabase()

    const session = providedSession || (await supabase.auth.getSession()).data.session
    if (!session) {
      console.warn('[SyncEngine] backgroundSync ABORT: No active Supabase session.')
      return { synced: 0, failed: 0 }
    }

    console.log('[SyncEngine] backgroundSync - Executing pushChanges...')
    // 1. Push local changes up to Supabase
    const pushResult = await pushChanges(session)

    console.log('[SyncEngine] backgroundSync - Executing pullUpdates...')
    // 2. Pull remote changes down from Supabase
    await pullUpdates(session)

    // 3. Update the sync watermark ONLY if push completely succeeded
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

// Keep syncData as an alias for backgroundSync for backwards compatibility, 
// though we will migrate direct usage in the app.
export const syncData = backgroundSync
