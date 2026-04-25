import { db, type CropRecord, type LedgerRecord, type ScanRecord } from './db'

let initPromise: Promise<void> | null = null

/** Single entry point: migrations + seed + one-time localStorage import */
export function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await db.open()
      await migrateLedgerFromLocalStorage()
      await migrateScansFromLocalStorage()
      await seedDefaultsIfEmpty()
    })()
  }
  return initPromise
}

const LEGACY_SCANS_KEY = 'agrogpt.scans.v1'

async function migrateScansFromLocalStorage(): Promise<void> {
  const raw = localStorage.getItem(LEGACY_SCANS_KEY)
  if (!raw) return
  const existing = await db.scans.count()
  if (existing > 0) {
    localStorage.removeItem(LEGACY_SCANS_KEY)
    return
  }
  try {
    const items = JSON.parse(raw) as Array<{
      thumbnailDataUrl: string
      createdAt: number
      mode: string
      title: string
      meta: string
    }>
    if (!Array.isArray(items) || items.length === 0) {
      localStorage.removeItem(LEGACY_SCANS_KEY)
      return
    }
    await db.transaction('rw', db.scans, async () => {
      for (const it of items) {
        const res = await fetch(it.thumbnailDataUrl)
        const imageBlob = await res.blob()
        await db.scans.add({
          timestamp: it.createdAt,
          resultJson: JSON.stringify({
            mode: it.mode,
            title: it.title,
            meta: it.meta,
          }),
          imageBlob,
          sync_status: 'pending',
        })
      }
    })
    localStorage.removeItem(LEGACY_SCANS_KEY)
  } catch {
    // ignore
  }
}

const LEGACY_LEDGER_KEY = 'agrogpt.ledger.v1'

async function migrateLedgerFromLocalStorage(): Promise<void> {
  const raw = localStorage.getItem(LEGACY_LEDGER_KEY)
  if (!raw) return
  try {
    const legacy = JSON.parse(raw) as Array<{
      id: string
      type: 'income' | 'expense'
      label: string
      amount: number
      date: string
    }>
    if (!Array.isArray(legacy) || legacy.length === 0) {
      localStorage.removeItem(LEGACY_LEDGER_KEY)
      return
    }
    const count = await db.ledger.count()
    if (count > 0) {
      localStorage.removeItem(LEGACY_LEDGER_KEY)
      return
    }
    await db.transaction('rw', db.ledger, async () => {
      for (const row of legacy) {
        await db.ledger.add({
          cropId: null,
          type: row.type,
          category: row.label,
          amount: row.amount,
          date: legacyDateToIso(row.date),
          notes: '',
          sync_status: 'pending',
        })
      }
    })
    localStorage.removeItem(LEGACY_LEDGER_KEY)
  } catch {
    // ignore corrupt legacy JSON
  }
}

function legacyDateToIso(display: string): string {
  const d = new Date(display)
  if (!Number.isNaN(d.getTime())) return d.toISOString()
  return new Date().toISOString()
}

async function seedDefaultsIfEmpty(): Promise<void> {
  const cropCount = await db.crops.count()
  if (cropCount === 0) {
    await db.crops.add({
      name: 'Cotton',
      variety: 'G. hirsutum',
      plantedDate: new Date().toISOString().slice(0, 10),
      area: 2,
      status: 'active',
      sync_status: 'pending',
    })
  }

  const ledgerCount = await db.ledger.count()
  if (ledgerCount === 0) {
    const now = new Date().toISOString()
    const samples: Omit<LedgerRecord, 'id'>[] = [
      { cropId: null, type: 'income', category: 'Cotton sale (advance)', amount: 18000, date: now, notes: '', sync_status: 'pending' },
      { cropId: null, type: 'expense', category: 'Fertilizer (DAP + urea)', amount: 5400, date: now, notes: '', sync_status: 'pending' },
      { cropId: null, type: 'expense', category: 'Diesel', amount: 1900, date: now, notes: '', sync_status: 'pending' },
      { cropId: null, type: 'income', category: 'Subsidy credit', amount: 2200, date: now, notes: '', sync_status: 'pending' },
      { cropId: null, type: 'expense', category: 'Labor (weeding)', amount: 3200, date: now, notes: '', sync_status: 'pending' },
    ]
    await db.transaction('rw', db.ledger, async () => {
      for (const row of samples) await db.ledger.add(row)
    })
  }
}

/** Active crops = status active */
export async function getActiveCrops(): Promise<CropRecord[]> {
  await initDatabase()
  return db.crops.where('status').equals('active').toArray()
}

export async function getAllCrops(): Promise<CropRecord[]> {
  await initDatabase()
  return db.crops.orderBy('plantedDate').reverse().toArray()
}

export async function addCrop(input: Omit<CropRecord, 'id' | 'sync_status'>): Promise<number> {
  await initDatabase()
  return db.crops.add({ ...input, sync_status: 'pending' } as CropRecord)
}

export async function getLedgerEntries(): Promise<LedgerRecord[]> {
  await initDatabase()
  return db.ledger.orderBy('date').reverse().toArray()
}

export async function deleteLedgerEntry(id: number): Promise<void> {
  await initDatabase()
  await db.ledger.delete(id)
}

export async function addExpense(input: {
  amount: number
  category: string
  cropId?: number | null
  notes?: string
  date?: string
}): Promise<number> {
  await initDatabase()
  return db.ledger.add({
    cropId: input.cropId ?? null,
    type: 'expense',
    category: input.category,
    amount: input.amount,
    date: input.date ?? new Date().toISOString(),
    notes: input.notes ?? '',
    sync_status: 'pending',
  })
}

export async function addIncome(input: {
  amount: number
  category: string
  cropId?: number | null
  notes?: string
  date?: string
}): Promise<number> {
  await initDatabase()
  return db.ledger.add({
    cropId: input.cropId ?? null,
    type: 'income',
    category: input.category,
    amount: input.amount,
    date: input.date ?? new Date().toISOString(),
    notes: input.notes ?? '',
    sync_status: 'pending',
  })
}

export async function getLedgerSummary(): Promise<{
  income: number
  expense: number
  profit: number
}> {
  await initDatabase()
  const rows = await db.ledger.toArray()
  let income = 0
  let expense = 0
  for (const r of rows) {
    if (r.type === 'income') income += r.amount
    else expense += r.amount
  }
  return { income, expense, profit: income - expense }
}

export async function addScan(input: {
  imageBlob: Blob
  resultJson: string
  timestamp?: number
}): Promise<number> {
  await initDatabase()
  return db.scans.add({
    timestamp: input.timestamp ?? Date.now(),
    resultJson: input.resultJson,
    imageBlob: input.imageBlob,
    sync_status: 'pending',
  })
}

export async function getRecentScans(limit = 24): Promise<ScanRecord[]> {
  await initDatabase()
  return db.scans.orderBy('timestamp').reverse().limit(limit).toArray()
}

export async function clearAllScans(): Promise<void> {
  await initDatabase()
  await db.scans.clear()
}

/** Unsynced ledger rows (for sync engine) */
export async function getPendingLedgerRows(): Promise<LedgerRecord[]> {
  await initDatabase()
  return db.ledger.where('sync_status').equals('pending').toArray()
}
