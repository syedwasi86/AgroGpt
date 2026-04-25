import { useCallback, useEffect, useMemo, useState } from 'react'
import { GlassCard } from '../../components/GlassCard'
import { SkeletonRow } from '../../components/Skeleton'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Trash2, Wallet, RefreshCw } from 'lucide-react'
import { cn } from '../../core/utils/cn'
import { useTranslation } from 'react-i18next'
import { addExpense, addIncome, getLedgerEntries, initDatabase, deleteLedgerEntry } from '../../lib/repository'
import { syncData } from '../../core/api/syncEngine'
import type { LedgerRecord } from '../../lib/db'

function inr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)
}

function formatLedgerDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
}

export function DigitalLedgerPage() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<LedgerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  // Form State
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const reload = useCallback(async () => {
    await initDatabase()
    const list = await getLedgerEntries()
    setRows(list)
  }, [])

  const chartData = useMemo(() => {
    if (rows.length === 0) return []
    const now = Date.now()
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const weekBuckets: Record<number, number> = {}
    
    for (const row of rows) {
      const age = now - new Date(row.date).getTime()
      const weekIdx = Math.max(0, Math.min(5, Math.floor(age / weekMs)))
      const sign = row.type === 'income' ? 1 : -1
      weekBuckets[weekIdx] = (weekBuckets[weekIdx] ?? 0) + sign * row.amount
    }
    
    return Array.from({ length: 6 }, (_, i) => ({
      w: `W${6 - i}`,
      profit: weekBuckets[5 - i] ?? 0,
    }))
  }, [rows])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await reload()
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [reload])

  const { income, expense, profit } = useMemo(() => {
    let inc = 0
    let exp = 0
    for (const e of rows) {
      if (e.type === 'income') inc += e.amount
      else exp += e.amount
    }
    return { income: inc, expense: exp, profit: inc - exp }
  }, [rows])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !category || !date) return

    const numAmount = Number(amount)
    if (Number.isNaN(numAmount) || numAmount <= 0) return

    if (type === 'income') {
      await addIncome({ amount: numAmount, category, date: new Date(date).toISOString() })
    } else {
      await addExpense({ amount: numAmount, category, date: new Date(date).toISOString() })
    }

    // Clear form
    setAmount('')
    setCategory('')
    setDate(new Date().toISOString().slice(0, 10))
    setType('expense')

    await reload()
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this transaction?')) return
    await deleteLedgerEntry(id)
    await reload()
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const { synced, failed } = await syncData()
      setSyncMsg(
        failed
          ? t('ledger.syncPartial', { synced, failed, defaultValue: `Synced ${synced}, failed ${failed}` })
          : t('ledger.syncOk', { synced, defaultValue: `Synced ${synced} row(s)` }),
      )
      await reload()
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="agro-h1">{t('ledger.title', 'Digital Khata')}</div>
          <p className="subtle mt-2 max-w-2xl">
            {t('ledger.desc', 'Track your farm income and expenses locally.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing || loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={18} className={cn(syncing && 'animate-spin')} />
            {t('ledger.syncNow', { defaultValue: 'Sync' })}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="rounded-2xl border border-stroke-2 bg-primary-700/10 px-4 py-2 text-sm text-white/80 animate-in fade-in slide-in-from-top-1">
          {syncMsg}
        </div>
      )}

      {/* Summary Banner */}
      <GlassCard className="p-5" variant="strong">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5">
            <Wallet size={18} className="text-white/80" />
          </div>
          <div>
            <div className="agro-h2">{t('ledger.summary', 'Summary')}</div>
            <div className="subtle mt-0.5">{t('ledger.incomeVsExpense', 'Income vs Expenses')}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/55">{t('ledger.income', 'Total Income')}</div>
            <div className="mt-1 text-sm font-bold text-green-400">{inr(income)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/55">{t('ledger.expense', 'Total Expense')}</div>
            <div className="mt-1 text-sm font-bold text-red-400">{inr(expense)}</div>
          </div>
          <div className="rounded-2xl border border-stroke-2 bg-primary-700/15 p-3">
            <div className="text-xs text-white/55">{t('ledger.profit', 'Net Profit')}</div>
            <div className={cn("mt-1 text-sm font-bold", profit >= 0 ? "text-green-400" : "text-red-400")}>
              {inr(profit)}
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* Input Form */}
        <GlassCard className="p-5 h-fit">
          <div className="agro-h2 mb-4">Add Transaction</div>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-white/60">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'income' | 'expense')}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-stroke-2"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Amount (₹)</label>
              <input
                type="number"
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-stroke-2"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Category / Note</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Seeds, Labor"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-stroke-2"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-stroke-2"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl border border-stroke-3 bg-secondary/12 py-2.5 text-sm font-semibold text-white shadow-glowSecondary hover:border-stroke-2 transition-colors"
            >
              Add Transaction
            </button>
          </form>
        </GlassCard>

        {/* Transaction List */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="agro-h2">Transaction List</div>
          </div>
          
          <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            {loading ? (
              <>
                <SkeletonRow /><SkeletonRow /><SkeletonRow />
              </>
            ) : rows.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-white/60">
                No entries yet. Add your first transaction to the left.
              </div>
            ) : (
              rows.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{e.category}</div>
                    <div className="mt-0.5 text-xs text-white/55">{formatLedgerDate(e.date)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'shrink-0 font-bold',
                        e.type === 'income' ? 'text-green-400' : 'text-red-400',
                      )}
                    >
                      {e.type === 'income' ? '+' : '-'}
                      {inr(e.amount)}
                    </div>
                    <button 
                      onClick={() => e.id && void handleDelete(e.id)}
                      className="p-1.5 text-white/40 hover:text-red-400 hover:bg-white/5 rounded-md transition-colors"
                      title="Delete Transaction"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="agro-h2">{t('ledger.profitProjection', 'Profit Projection')}</div>
            <div className="subtle mt-1">{t('ledger.weeklyProfitActivity', 'Weekly profit activity')}</div>
          </div>
          <span className="glass-chip border-stroke-2 bg-primary-700/12">
            {t('ledger.baseline', 'Baseline')}: <span className="font-semibold text-white">{inr(profit)}</span>
          </span>
        </div>
        <div className="mt-4 h-[260px] w-full min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-3">
          <ResponsiveContainer width="99%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <XAxis dataKey="w" stroke="rgba(255,255,255,0.35)" tickLine={false} axisLine={false} />
              <YAxis
                stroke="rgba(255,255,255,0.35)"
                tickLine={false}
                axisLine={false}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(10, 14, 12, 0.85)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 16,
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                itemStyle={{ color: 'rgba(255,255,255,0.9)' }}
                formatter={(v) => inr(Number(v))}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#FFA000"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  )
}
