import { db, type TransactionRecord, type ScanRecord, type AiQueryRecord, initializeUserPreferences, initializeUserProfile } from './db'
import { generateCropSchedule } from '../features/crop-calendar/engines/scheduleGenerator'

let initPromise: Promise<void> | null = null

export function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await db.open()
      await deduplicateActivePlans()
      await initializeUserPreferences()
      await initializeUserProfile()
    })()
  }
  return initPromise
}

export async function seedDefaultsIfEmpty(): Promise<void> {
  const plansCount = await db.crop_plans.count()

  if (plansCount === 0) {
    const now = new Date().toISOString()
    const sowingDate = now.slice(0, 10)
    try {
      const { plan, stages, tasks } = generateCropSchedule({
        cropType: 'Cotton',
        variety: 'G. hirsutum',
        sowingDate,
        area: 2,
        crop_area_value: 2,
        crop_area_unit: 'Acre',
        crop_area_acres: 2,
        crop_condition: 'Healthy',
        created_by_onboarding: false
      })

      await db.transaction('rw', [db.crop_plans, db.crop_stages, db.farm_tasks], async () => {
        await db.crop_plans.add(plan)
        for (const stage of stages) {
          await db.crop_stages.add(stage)
        }
        for (const task of tasks) {
          await db.farm_tasks.add(task)
        }
      })

      // Update profiles if exists
      const profile = await db.profiles.toArray().then(a => a[0])
      if (profile) {
        await db.profiles.update(profile.id, {
          active_crop_plan_id: plan.id,
          primary_crop: 'Cotton',
          updated_at: now
        })
      }
    } catch (e) {
      console.error('Failed to seed default crop plan:', e)
    }
  }

  const txCount = await db.transactions.count()
  if (txCount === 0) {
    const now = new Date().toISOString()
    const activePlan = await db.crop_plans.where('status').equals('active').first()
    const planId = activePlan?.id || null
    
    const samples: Omit<TransactionRecord, 'id' | 'created_at' | 'updated_at'>[] = [
      { type: 'income', category: 'Cotton sale (advance)', amount: 18000, transaction_date: now, note: 'Cotton', notes: 'Cotton sale (advance)', plan_id: planId, deleted_at: null },
      { type: 'expense', category: 'Fertilizer (DAP + urea)', amount: 5400, transaction_date: now, note: 'Cotton', notes: 'Fertilizer (DAP + urea)', plan_id: planId, deleted_at: null },
      { type: 'expense', category: 'Diesel', amount: 1900, transaction_date: now, note: 'Cotton', notes: 'Diesel', plan_id: planId, deleted_at: null },
      { type: 'income', category: 'Subsidy credit', amount: 2200, transaction_date: now, note: 'Cotton', notes: 'Subsidy credit', plan_id: planId, deleted_at: null },
      { type: 'expense', category: 'Labor (weeding)', amount: 3200, transaction_date: now, note: 'Cotton', notes: 'Labor (weeding)', plan_id: planId, deleted_at: null },
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

export async function getTransactions(): Promise<TransactionRecord[]> {
  await initDatabase()
  const txs = await db.transactions.orderBy('transaction_date').reverse().toArray()
  return txs.filter(t => !t.deleted_at)
}

export async function deleteTransaction(id: string): Promise<void> {
  await initDatabase()
  await db.transactions.update(id, {
    deleted_at: new Date().toISOString(),
    sync_status: 'pending_delete',
    updated_at: new Date().toISOString()
  })
}

export async function addExpense(input: {
  amount: number
  category: string
  crop_id?: string | null // Keep for codebase compatibility, maps to plan_id
  plan_id?: string | null
  note?: string
  transaction_date?: string
}): Promise<string> {
  await initDatabase()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  
  let planId = input.plan_id || input.crop_id
  if (!planId) {
    const activePlan = await db.crop_plans.where('status').equals('active').first()
    planId = activePlan?.id || null
  }

  await db.transactions.add({
    id,
    plan_id: planId ?? null,
    type: 'expense',
    category: input.category,
    amount: input.amount,
    transaction_date: input.transaction_date ?? now,
    note: input.note ?? '',
    notes: input.category,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version: 1,
    sync_status: 'pending'
  })
  return id
}

export async function addIncome(input: {
  amount: number
  category: string
  crop_id?: string | null // Keep for codebase compatibility, maps to plan_id
  plan_id?: string | null
  note?: string
  transaction_date?: string
}): Promise<string> {
  await initDatabase()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  
  let planId = input.plan_id || input.crop_id
  if (!planId) {
    const activePlan = await db.crop_plans.where('status').equals('active').first()
    planId = activePlan?.id || null
  }

  await db.transactions.add({
    id,
    plan_id: planId ?? null,
    type: 'income',
    category: input.category,
    amount: input.amount,
    transaction_date: input.transaction_date ?? now,
    note: input.note ?? '',
    notes: input.category,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version: 1,
    sync_status: 'pending'
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
  crop_type: string
  prediction: string
  confidence: number
  is_low_confidence: boolean
  scanned_at?: string
  plan_id?: string | null
}): Promise<string> {
  await initDatabase()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  
  let planId = input.plan_id
  if (!planId) {
    const activePlan = await db.crop_plans.where('status').equals('active').first()
    planId = activePlan?.id || null
  }

  await db.scans.add({
    id,
    scanned_at: input.scanned_at ?? now,
    created_at: now,
    updated_at: now,
    plan_id: planId,
    crop_type: input.crop_type,
    prediction: input.prediction,
    confidence: input.confidence,
    confidence_score: input.confidence,
    is_low_confidence: input.is_low_confidence,
    image_url: input.image_url,
    deleted_at: null,
    version: 1,
    sync_status: 'pending'
  })
  return id
}

export async function saveScan(input: {
  image_url: string
  crop_type: string
  prediction: string
  confidence: number
  is_low_confidence: boolean
  plan_id?: string | null
}): Promise<string> {
  return addScan(input)
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
    await db.scans.update(s.id, { 
      deleted_at: now, 
      sync_status: 'pending_delete',
      updated_at: now 
    })
  }
}

export async function addTransaction(data: { 
  amount: number
  category: string
  type: 'income' | 'expense'
  transaction_date: string
  note?: string
  plan_id?: string | null
}): Promise<string> {
  await initDatabase()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  
  let planId = data.plan_id
  if (!planId) {
    const activePlan = await db.crop_plans.where('status').equals('active').first()
    planId = activePlan?.id || null
  }

  await db.transactions.add({
    id,
    amount: data.amount,
    category: data.category,
    type: data.type,
    transaction_date: data.transaction_date,
    plan_id: planId,
    note: data.note ?? '',
    notes: data.category,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version: 1,
    sync_status: 'pending'
  })
  return id
}

export async function updateSoilProfile(soilData: { id: string, nitrogen?: number, phosphorus?: number, potassium?: number }): Promise<void> {
  await initDatabase()
  await db.profiles.update(soilData.id, {
    nitrogen: soilData.nitrogen,
    phosphorus: soilData.phosphorus,
    potassium: soilData.potassium,
    updated_at: new Date().toISOString(),
    sync_status: 'pending'
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

async function deduplicateActivePlans(): Promise<void> {
  const activePlans = await db.crop_plans.where('status').equals('active').toArray()
  const nonDeleted = activePlans.filter(p => !p.deleted_at)
  if (nonDeleted.length > 1) {
    console.warn('[Repository] Multiple active crop plans found locally. De-duplicating...', nonDeleted.length)
    // Sort by updated_at descending to keep the most recent active plan
    nonDeleted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    const [latest, ...older] = nonDeleted
    for (const plan of older) {
      await db.crop_plans.update(plan.id, {
        status: 'completed',
        sync_status: 'pending',
        updated_at: new Date().toISOString()
      })
      console.log(`[Repository] Deactivated older plan: ${plan.id} (${plan.crop_type})`)
    }
  }
}
