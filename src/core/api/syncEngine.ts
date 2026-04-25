/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { db } from '../../lib/db'
import { initDatabase } from '../../lib/repository'
import { supabase } from '../auth/supabaseClient'

/**
 * Pushes unsynced local records to Supabase.
 */
export async function pushChanges(): Promise<{ synced: number; failed: number }> {
  await initDatabase()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.warn('Cannot push changes: No active Supabase session.')
    return { synced: 0, failed: 0 }
  }

  let synced = 0
  let failed = 0
  const userId = session.user.id

  const tables = ['crops', 'ledger', 'scans'] as const

  for (const tableName of tables) {
    const table = db[tableName]
    const pending = await table.where('sync_status').equals('pending').toArray()

    if (pending.length === 0) continue

    if (tableName === 'scans') {
      // Process scans individually because of binary Blob uploads
      for (const record of pending as any[]) {
        let remoteUrl: string | undefined

        // 1. Upload Blob if present
        if (record.imageBlob) {
          const path = `${userId}/${Date.now()}_scan.jpg`
          const { error: uploadError } = await supabase.storage
            .from('pest-scans')
            .upload(path, record.imageBlob)

          if (uploadError) {
            console.error('Failed to upload image blob:', uploadError)
            failed++
            continue // Keep as pending, do not delete Blob, retry next sync
          }

          const { data } = supabase.storage.from('pest-scans').getPublicUrl(path)
          remoteUrl = data.publicUrl
        }

        // 2. Prepare Database payload
        const { imageBlob, sync_status, ...rest } = record
        const scanPayload: any = { ...rest, user_id: userId }
        if (remoteUrl) {
          scanPayload.remoteUrl = remoteUrl
        }

        // 3. Upsert into Supabase DB
        const { error } = await supabase.from('scans').upsert(scanPayload)

        if (error) {
          console.error(`Failed to push scan to Supabase:`, error)
          failed++
        } else if (record.id != null) {
          // 4. Update local Dexie record (drop heavy blob, attach remote url, set synced)
          const updatePayload: any = {
            sync_status: 'synced',
            remoteUrl: remoteUrl,
          }
          // Only clear the blob if we successfully uploaded it to storage
          if (remoteUrl) {
            updatePayload.imageBlob = undefined
          }

          await table.update(record.id, updatePayload)
          synced++
        }
      }
    } else {
      // Standard batch upsert for non-binary tables (crops, ledger)
      const payload = pending.map((record: any) => {
        const { sync_status, ...rest } = record
        return { ...rest, user_id: userId }
      })

      const { error } = await supabase.from(tableName).upsert(payload)

      if (error) {
        console.error(`Failed to push ${tableName} to Supabase:`, error)
        failed += pending.length
      } else {
        for (const record of pending) {
          if (record.id != null) {
            await table.update(record.id, { sync_status: 'synced' })
            synced++
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
export async function pullUpdates(lastSyncTimestamp: string): Promise<void> {
  await initDatabase()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const tables = ['crops', 'ledger', 'scans'] as const

  for (const tableName of tables) {
    const { data: cloudRecords, error } = await supabase
      .from(tableName)
      .select('*')
      .gt('updated_at', lastSyncTimestamp) // Pull only newer records

    if (error) {
      console.error(`Failed to pull ${tableName} from Supabase:`, error)
      continue
    }

    if (cloudRecords && cloudRecords.length > 0) {
      const table = db[tableName]
      
      for (const record of cloudRecords) {
        // Strip Supabase-specific tracking columns if needed, and force sync_status
        const { user_id, ...localData } = record
        
        // Conflict Resolution:
        // By pulling from the cloud using table.put(), Dexie overwrites any existing local
        // record with the same primary key (id). Because we only pull records where 
        // cloud 'updated_at' is newer, this fulfills the "prefer cloud" conflict strategy.
        await table.put({ ...localData, sync_status: 'synced' })
      }
    }
  }
}

/**
 * Main synchronizer: Pushes local changes, then pulls remote updates.
 */
export async function syncData(): Promise<{ synced: number; failed: number }> {
  // 1. Push local changes up to Supabase
  const pushResult = await pushChanges()

  // 2. Pull remote changes down from Supabase
  const lastSyncKey = 'agrogpt_last_sync'
  const lastSync = localStorage.getItem(lastSyncKey) || new Date(0).toISOString()
  
  await pullUpdates(lastSync)
  
  // 3. Update the sync watermark
  localStorage.setItem(lastSyncKey, new Date().toISOString())

  return pushResult
}
