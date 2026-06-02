import { useEffect, useMemo, useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { GlassCard } from '@/components/GlassCard'
import { SkeletonRow } from '@/components/Skeleton'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Trash2, Wallet, RefreshCw, Mic, MicOff, AlertCircle, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'
import { cn } from '@/core/utils/cn'
import { addTransaction, initDatabase, deleteTransaction } from '@/lib/repository'
import { backgroundSync } from '@/core/api/syncEngine'
import { useCrop } from '@/core/context/CropContext'

function inr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)
}

function formatLedgerDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
}

export function DigitalLedgerPage() {
  const { activeCrop } = useCrop()
  const [filterByCrop, setFilterByCrop] = useState(true)

  const rawTransactions = useLiveQuery(() => db.transactions.orderBy('transaction_date').reverse().toArray())
  const transactions = useMemo(() => rawTransactions || [], [rawTransactions])

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ text: string, type: 'info' | 'error' | 'success' } | null>(null)

  // Voice State
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  // Form State
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [category, setCategory] = useState('')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    void initDatabase().then(() => setLoading(false))

    // Cleanup recognition on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  // Filter transactions dynamically by the active crop
  const filteredTransactions = useMemo(() => {
    if (!filterByCrop) return transactions
    return transactions.filter(t => t.note?.toLowerCase() === activeCrop.toLowerCase())
  }, [transactions, activeCrop, filterByCrop])

  const { income, expense, profit } = useMemo(() => {
    let inc = 0
    let exp = 0
    for (const e of filteredTransactions) {
      if (e.type === 'income') inc += e.amount
      else exp += e.amount
    }
    return { income: inc, expense: exp, profit: inc - exp }
  }, [filteredTransactions])

  const chartData = useMemo(() => {
    if (filteredTransactions.length === 0) return []
    const now = Date.now()
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const weekBuckets: Record<number, { revenue: number, expense: number }> = {}

    // Initialize buckets
    for (let i = 0; i <= 5; i++) {
      weekBuckets[i] = { revenue: 0, expense: 0 }
    }

    filteredTransactions.forEach(row => {
      const age = now - new Date(row.transaction_date).getTime()
      const weekIdx = Math.max(0, Math.min(5, Math.floor(age / weekMs)))

      if (row.type === 'income') {
        weekBuckets[weekIdx].revenue += row.amount
      } else {
        weekBuckets[weekIdx].expense += row.amount
      }
    })

    return Array.from({ length: 6 }, (_, i) => ({
      w: `W${6 - i}`,
      revenue: weekBuckets[5 - i].revenue,
      expense: weekBuckets[5 - i].expense,
    }))
  }, [filteredTransactions])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return

    const numAmount = Number(amount)
    if (!amount || Number.isNaN(numAmount) || numAmount <= 0) {
      alert("Please enter a valid amount.")
      return
    }
    if (!category.trim()) {
      alert("Please enter a category or note.")
      return
    }

    setIsSubmitting(true)
    try {
      await addTransaction({
        amount: numAmount,
        category: category.trim(),
        type,
        transaction_date: new Date(transactionDate).toISOString(),
        note: activeCrop // Tag it with the active crop
      })

      // Reset form
      setAmount('')
      setCategory('')
      setTransactionDate(new Date().toISOString().slice(0, 10))
      setType('expense')
    } catch (_err) {
      console.error('Transaction failed:', _err)
      alert('Failed to save transaction. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this transaction?')) return
    try {
      await deleteTransaction(id)
    } catch {
      alert('Failed to delete entry.')
    }
  }

  const stopVoice = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const startVoiceCapture = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setVoiceError('Voice recognition not supported in this browser.')
      return
    }

    if (isListening) {
      stopVoice()
      return
    }

    setVoiceError(null)
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error('Speech Recognition Error:', event.error)
      if (event.error === 'not-allowed') {
        setVoiceError('Microphone permission denied.')
      } else {
        setVoiceError(`Voice error: ${event.error}`)
      }
      setIsListening(false)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase()
      console.log('Transcribed:', transcript)

      // Extraction Logic
      const amountMatch = transcript.match(/\d+/)
      if (amountMatch) setAmount(amountMatch[0])

      // Intent extraction
      const isIncome = /(earned|received|income|plus|add|credit|got)/i.test(transcript)
      const isExpense = /(spent|paid|expense|minus|debit|gave|lost|on)/i.test(transcript)

      if (isIncome && !isExpense) setType('income')
      if (isExpense) setType('expense')

      // Category extraction
      const prepositions = ['on', 'for', 'from', 'at', 'to']
      const words = transcript.split(' ')
      let categoryFound = ''

      for (const prep of prepositions) {
        const idx = words.indexOf(prep)
        if (idx !== -1 && idx < words.length - 1) {
          categoryFound = words.slice(idx + 1).join(' ')
          break
        }
      }

      if (categoryFound) {
        setCategory(categoryFound.charAt(0).toUpperCase() + categoryFound.slice(1))
      }

      if (!amountMatch && !categoryFound) {
        setVoiceError("I caught some text, but couldn't find an amount or category. Try saying 'Spent 500 on seeds'.")
      }
    }

    try {
      recognition.start()
    } catch (err) {
      console.error('Failed to start recognition:', err)
      setVoiceError('Recognition failed to start.')
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const { synced, failed } = await backgroundSync()
      if (failed > 0) {
        setSyncMsg({
          text: `Sync partially completed. ${synced} synced, ${failed} failed.`,
          type: 'info'
        })
      } else {
        setSyncMsg({
          text: `All transactions synced successfully (${synced} records).`,
          type: 'success'
        })
      }
    } catch (e) {
      setSyncMsg({
        text: e instanceof Error ? e.message : 'Global sync failed. Check network.',
        type: 'error'
      })
    } finally {
      setSyncing(false)
    }
  }

  const inputClass = "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-stroke-2 focus:ring-1 focus:ring-stroke-2/30 disabled:opacity-50"

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="agro-h1 flex items-center gap-3">
            <Wallet className="text-secondary" />
            Digital Khata
          </h1>
          <p className="subtle mt-1 text-sm">Offline-first ledger for your daily farm transactions.</p>
        </div>
        <button
          onClick={() => void handleSync()}
          disabled={syncing || loading}
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-bold text-white hover:bg-white/10 transition-all disabled:opacity-50"
        >
          <RefreshCw size={18} className={cn(syncing && 'animate-spin')} />
          Sync Ledger
        </button>
      </div>

      {syncMsg && (
        <div className={cn(
          "flex items-center gap-3 rounded-2xl px-5 py-3 border animate-in slide-in-from-top-2",
          syncMsg.type === 'success' ? "bg-green-500/10 border-green-500/20 text-green-400" :
            syncMsg.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-400" :
              "bg-blue-500/10 border-blue-500/20 text-blue-400"
        )}>
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{syncMsg.text}</span>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <GlassCard className="p-6 border-l-4 border-green-500" variant="strong">
          <div className="flex items-center gap-3 text-white/50 mb-2">
            <TrendingUp size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Income ({filterByCrop ? activeCrop : 'All'})</span>
          </div>
          <div className="text-2xl font-black text-green-400">{inr(income)}</div>
        </GlassCard>
        <GlassCard className="p-6 border-l-4 border-red-500" variant="strong">
          <div className="flex items-center gap-3 text-white/50 mb-2">
            <TrendingDown size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Expenses ({filterByCrop ? activeCrop : 'All'})</span>
          </div>
          <div className="text-2xl font-black text-red-400">{inr(expense)}</div>
        </GlassCard>
        <GlassCard className={cn("p-6 border-l-4", profit >= 0 ? "border-secondary" : "border-amber-500")} variant="strong">
          <div className="flex items-center gap-3 text-white/50 mb-2">
            <Wallet size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Net Profit ({filterByCrop ? activeCrop : 'All'})</span>
          </div>
          <div className={cn("text-2xl font-black", profit >= 0 ? "text-white" : "text-amber-500")}>
            {inr(profit)}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_2fr]">
        {/* Entry Form */}
        <div className="space-y-6">
          <GlassCard className="p-6" variant="strong">
            <div className="flex items-center justify-between mb-6">
              <h2 className="agro-h2">New Entry ({activeCrop})</h2>
              <div className="flex flex-col items-end">
                <button
                  type="button"
                  onClick={startVoiceCapture}
                  className={cn(
                    "group relative flex h-12 w-12 items-center justify-center rounded-full transition-all",
                    isListening ? "bg-red-500 shadow-glowPrimary" : "bg-white/5 hover:bg-white/10"
                  )}
                >
                  {isListening ? (
                    <MicOff size={22} className="text-white animate-pulse" />
                  ) : (
                    <Mic size={22} className="text-white/60 group-hover:text-white" />
                  )}
                  {isListening && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-white border-2 border-red-500" />
                  )}
                </button>
                {voiceError && <span className="mt-2 text-[10px] text-red-400 font-bold">{voiceError}</span>}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={cn("flex-1 py-2 text-xs font-bold rounded-xl transition-all", type === 'expense' ? "bg-red-500/20 text-red-400 shadow-sm" : "text-white/30")}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={cn("flex-1 py-2 text-xs font-bold rounded-xl transition-all", type === 'income' ? "bg-green-500/20 text-green-400 shadow-sm" : "text-white/30")}
                >
                  Income
                </button>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold text-white/40 uppercase tracking-wider">Amount (INR)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-white/30">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={cn(inputClass, "pl-10")}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold text-white/40 uppercase tracking-wider">Category / Details</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Fertilizer, Seeds, Sale of Wheat"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold text-white/40 uppercase tracking-wider">Transaction Date</label>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl bg-primary-600 text-sm font-black text-white shadow-glowPrimary hover:bg-primary-500 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="mx-auto animate-spin" size={20} /> : 'Post to Ledger'}
              </button>
            </form>
          </GlassCard>
        </div>

        {/* Ledger View */}
        <div className="space-y-6">
          <GlassCard className="p-0 overflow-hidden" variant="strong">
            <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <h2 className="agro-h2">Recent Transactions</h2>
              
              <button
                onClick={() => setFilterByCrop(!filterByCrop)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2",
                  filterByCrop
                    ? "bg-[#1d3526]/40 border-[#223328] text-[#4ade80]"
                    : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                )}
              >
                {filterByCrop ? `Crop Filter: ${activeCrop}` : 'Showing All Crops'}
                <span className="text-[10px] text-white/40 font-normal">
                  (Toggle)
                </span>
              </button>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-6 space-y-4">
                  <SkeletonRow /><SkeletonRow /><SkeletonRow />
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-white/20">
                    <Wallet size={32} />
                  </div>
                  <p className="text-sm font-medium text-white/40">No records found. Start adding your daily transactions.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-[10px] font-bold text-white/30 uppercase tracking-widest">
                      <th className="px-6 py-3 font-bold">Details</th>
                      <th className="px-6 py-3 font-bold">Date</th>
                      <th className="px-6 py-3 text-right font-bold">Amount</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredTransactions.filter(t => !t.deleted_at).map((e) => (
                      <tr key={e.id} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-white/90">{e.category}</div>
                          <div className="text-[10px] font-bold text-white/30 uppercase flex items-center gap-2">
                            {e.type}
                            {e.note && (
                              <span className="text-[9px] font-black tracking-widest text-[#4ade80] bg-[#1d3526] px-2 py-0.5 rounded border border-[#223328] uppercase">
                                {e.note}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-white/50">{formatLedgerDate(e.transaction_date)}</td>
                        <td className={cn(
                          "px-6 py-4 text-right text-sm font-black",
                          e.type === 'income' ? "text-green-400" : "text-red-400"
                        )}>
                          {e.type === 'income' ? '+' : '-'}{inr(e.amount)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => e.id && void handleDelete(e.id)}
                            className="p-2 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </GlassCard>

          {/* Chart Card */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-white/40">Profit Trend (6-Week View)</h3>
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="w" stroke="rgba(255,255,255,0.1)" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: '#141e18', border: '1px solid #223328', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                    cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                  />
                  <Line type="monotone" dataKey="revenue" name="Income" stroke="#4ade80" strokeWidth={3} dot={{ fill: '#4ade80', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="expense" name="Expense" stroke="#f87171" strokeWidth={3} dot={{ fill: '#f87171', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
