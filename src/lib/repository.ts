import { db, type CropRecord, type TransactionRecord, type ScanRecord, type AiQueryRecord, initializeUserPreferences, initializeUserProfile } from './db'

let initPromise: Promise<void> | null = null

export function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await db.open()
      await seedDefaultsIfEmpty()
      await initializeUserPreferences()
      await initializeUserProfile()
    })()
  }
  return initPromise
}

async function seedDefaultsIfEmpty(): Promise<void> {

  const actualCropCount = await db.crops.count()

  if (actualCropCount === 0) {
    const now = new Date().toISOString()
    await db.crops.add({
      id: crypto.randomUUID(),
      name: 'Cotton',
      variety: 'G. hirsutum',
      planted_date: now.slice(0, 10),
      area: 2,
      status: 'active',
      created_at: now,
      updated_at: now,
      deleted_at: null
    })
  }

  const txCount = await db.transactions.count()
  if (txCount === 0) {
    const now = new Date().toISOString()
    const samples: Omit<TransactionRecord, 'id' | 'created_at' | 'updated_at'>[] = [
      { type: 'income', category: 'Cotton sale (advance)', amount: 18000, transaction_date: now, note: 'Cotton', deleted_at: null },
      { type: 'expense', category: 'Fertilizer (DAP + urea)', amount: 5400, transaction_date: now, note: 'Cotton', deleted_at: null },
      { type: 'expense', category: 'Diesel', amount: 1900, transaction_date: now, note: 'Cotton', deleted_at: null },
      { type: 'income', category: 'Subsidy credit', amount: 2200, transaction_date: now, note: 'Cotton', deleted_at: null },
      { type: 'expense', category: 'Labor (weeding)', amount: 3200, transaction_date: now, note: 'Cotton', deleted_at: null },
    ]
    await db.transaction('rw', db.transactions, async () => {
      for (const row of samples) {
        await db.transactions.add({
          ...row,
          id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
        })
      }
    })
  }
}

/** Active crops = status active and not deleted */
export async function getActiveCrops(): Promise<CropRecord[]> {
  await initDatabase()
  const crops = await db.crops.where('status').equals('active').toArray()
  return crops.filter(c => !c.deleted_at)
}

export async function getAllCrops(): Promise<CropRecord[]> {
  await initDatabase()
  const crops = await db.crops.orderBy('planted_date').reverse().toArray()
  return crops.filter(c => !c.deleted_at)
}

export async function addCrop(input: Omit<CropRecord, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<string> {
  await initDatabase()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.crops.add({
    ...input,
    id,
    created_at: now,
    updated_at: now,
    deleted_at: null
  })
  return id
}

export async function getTransactions(): Promise<TransactionRecord[]> {
  await initDatabase()
  const txs = await db.transactions.orderBy('transaction_date').reverse().toArray()
  return txs.filter(t => !t.deleted_at)
}

export async function deleteTransaction(id: string): Promise<void> {
  await initDatabase()
  await db.transactions.update(id, {
    deleted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
}

export async function addExpense(input: {
  amount: number
  category: string
  crop_id?: string | null
  note?: string
  transaction_date?: string
}): Promise<string> {
  await initDatabase()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.transactions.add({
    id,
    crop_id: input.crop_id ?? null,
    type: 'expense',
    category: input.category,
    amount: input.amount,
    transaction_date: input.transaction_date ?? now,
    note: input.note ?? '',
    created_at: now,
    updated_at: now,
    deleted_at: null
  })
  return id
}

export async function addIncome(input: {
  amount: number
  category: string
  crop_id?: string | null
  note?: string
  transaction_date?: string
}): Promise<string> {
  await initDatabase()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.transactions.add({
    id,
    crop_id: input.crop_id ?? null,
    type: 'income',
    category: input.category,
    amount: input.amount,
    transaction_date: input.transaction_date ?? now,
    note: input.note ?? '',
    created_at: now,
    updated_at: now,
    deleted_at: null
  })
  return id
}

export async function getLedgerSummary(): Promise<{
  income: number
  expense: number
  profit: number
}> {
  await initDatabase()
  const rows = await getTransactions()
  let income = 0
  let expense = 0
  for (const r of rows) {
    if (r.type === 'income') income += r.amount
    else expense += r.amount
  }
  return { income, expense, profit: income - expense }
}

export async function addScan(input: {
  image_url: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any
  scanned_at?: string
}): Promise<string> {
  await initDatabase()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.scans.add({
    id,
    scanned_at: input.scanned_at ?? now,
    created_at: now,
    updated_at: now,
    result: input.result,
    image_url: input.image_url,
    deleted_at: null
  })
  return id
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveScan(image_url: string, result: any): Promise<string> {
  return addScan({ image_url, result })
}

export async function getRecentScans(limit = 24): Promise<ScanRecord[]> {
  await initDatabase()
  const scans = await db.scans.orderBy('scanned_at').reverse().toArray()
  return scans.filter(s => !s.deleted_at).slice(0, limit)
}

export async function clearAllScans(): Promise<void> {
  await initDatabase()
  const scans = await getRecentScans(1000)
  const now = new Date().toISOString()
  for (const s of scans) {
    await db.scans.update(s.id, { deleted_at: now, updated_at: now })
  }
}

export async function addTransaction(data: { amount: number, category: string, type: 'income' | 'expense', transaction_date: string, note?: string }): Promise<string> {
  await initDatabase()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.transactions.add({
    id,
    amount: data.amount,
    category: data.category,
    type: data.type,
    transaction_date: data.transaction_date,
    crop_id: null,
    note: data.note ?? '',
    created_at: now,
    updated_at: now,
    deleted_at: null
  })
  return id
}

export async function updateSoilProfile(soilData: { id: string, nitrogen?: number, phosphorus?: number, potassium?: number }): Promise<void> {
  await initDatabase()
  await db.profiles.update(soilData.id, {
    nitrogen: soilData.nitrogen,
    phosphorus: soilData.phosphorus,
    potassium: soilData.potassium,
    updated_at: new Date().toISOString()
  })
}

// ─── Pending Query Queue (offline AI questions) ────────────────────────────

export async function saveAiQuery(
  question: string,
  context?: Record<string, string | undefined>,
): Promise<string> {
  await initDatabase()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.ai_queries.add({
    id,
    question,
    context: context ?? {},
    answer: null,
    status: 'pending',
    created_at: now,
    updated_at: now,
    deleted_at: null
  })
  return id
}

export async function getPendingAiQueries(): Promise<AiQueryRecord[]> {
  await initDatabase()
  const queries = await db.ai_queries
    .where('status')
    .equals('pending')
    .toArray()

  return queries
    .filter(q => !q.deleted_at)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

export async function getPendingAiQueryCount(): Promise<number> {
  const queries = await getPendingAiQueries()
  return queries.length
}

export async function markAiQueryProcessing(id: string): Promise<void> {
  await initDatabase()
  await db.ai_queries.update(id, {
    status: 'processing',
    updated_at: new Date().toISOString()
  })
}

export async function markAiQueryAnswered(id: string, answer: string): Promise<void> {
  await initDatabase()
  await db.ai_queries.update(id, {
    status: 'completed',
    answer,
    updated_at: new Date().toISOString()
  })
}
