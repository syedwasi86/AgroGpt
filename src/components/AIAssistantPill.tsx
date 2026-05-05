import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Mic, RefreshCw, Send, Sparkles, WifiOff, X, CloudOff } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { cn } from '../core/utils/cn'
import { askAgroGPT, callGeminiAPI, localInference } from '../ai/provider'
import { saveAiQuery, getPendingAiQueries, getPendingAiQueryCount, markAiQueryAnswered, markAiQueryProcessing } from '../lib/repository'
import { useTranslation } from 'react-i18next'
import { useConnectivity } from '../hooks/useConnectivity'

type Message = { role: 'user' | 'assistant'; content: string }

export function AIAssistantPill() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [listening, setListening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [shaky, setShaky] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => [
    { role: 'assistant', content: t('assistant.welcome') },
  ])

  // ── Connectivity Logic ──────────────────────────────────────────────────────
  const geminiProbe = useCallback(async () => {
    try {
      // 1. Check if the API key even exists first
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) return false;

      // 2. Instead of pinging the restricted Gemini API, 
      // ping a "Generate 204" endpoint (Standard Android/Chrome connectivity check).
      // This requires NO API key and NO specific method.
      await fetch('https://connectivitycheck.gstatic.com/generate_204', {
        method: 'HEAD', 
        mode: 'no-cors',
        signal: AbortSignal.timeout(2000)
      });

      // If we get here, the internet is working.
      return true; 
    } catch (err) {
      console.warn("Connectivity probe failed:", err);
      return false;
    }
  }, []);

  const connectivity = useConnectivity(geminiProbe)

  // Sync-modal state
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const isSyncModalOpenRef = useRef(false)

  // ── Reconnect Handler ──────────────────────────────────────────────────────
  const handleReconnect = useCallback(async () => {
    if (isSyncModalOpenRef.current) return
    try {
      const count = await getPendingAiQueryCount()
      if (count > 0) {
        isSyncModalOpenRef.current = true
        setPendingCount(count)
        setShowSyncModal(true)
      }
    } catch (err) {
      console.error('[AgroGPT] Failed to read pending query count:', err)
    }
  }, [])

  useEffect(() => {
    if (connectivity === 'online') {
      handleReconnect()
    }
  }, [connectivity, handleReconnect])

  // ── Dismiss sync modal ──────────────────────────────────────────────────────
  function dismissSyncModal() {
    isSyncModalOpenRef.current = false
    setShowSyncModal(false)
  }

  // ── Sync pending queries ────────────────────────────────────────────────────
  async function handleSyncYes() {
    dismissSyncModal()
    setSyncing(true)
    setOpen(true)

    let queued: any[] = []
    try {
      queued = await getPendingAiQueries()
    } catch (err) {
      setSyncing(false)
      return
    }

    for (const record of queued) {
      const questionMsg: Message = { role: 'user', content: record.question }
      setMessages(prev => [...prev, questionMsg])

      try {
        if (record.id != null) await markAiQueryProcessing(record.id)
        const reply = await callGeminiAPI(record.question)
        setMessages(prev => [...prev, { role: 'assistant', content: reply.text }])
        if (record.id != null) await markAiQueryAnswered(record.id, reply.text)
      } catch (err) {
        const fallback = localInference(record.question)
        setMessages(prev => [...prev, { role: 'assistant', content: fallback + ' (Retry queued)' }])
      }
    }
    setSyncing(false)
  }

  // ── Chat submission ─────────────────────────────────────────────────────────
  async function send(text: string) {
    const prompt = text.trim()
    if (!prompt) return
    setMessages(prev => [...prev, { role: 'user', content: prompt }])
    setQuery('')
    setLoading(true)
    setShaky(false)

    try {
      if (connectivity === 'offline') {
        const offlineReply = localInference(prompt)
        setMessages(prev => [...prev, { role: 'assistant', content: offlineReply }])
        await saveAiQuery(prompt)
        setMessages(prev => [...prev, { role: 'assistant', content: 'Saved question for later.' }])
      } else {
        try {
          const reply = await askAgroGPT(prompt)
          setMessages(prev => [...prev, { role: 'assistant', content: reply.text }])
        } catch (err) {
          // If it's a fetch error and we think we are online
          if (err instanceof TypeError) {
            setShaky(true)
            // Try one more time after a short delay
            await new Promise(r => setTimeout(r, 1500))
            try {
              const retryReply = await askAgroGPT(prompt)
              setMessages(prev => [...prev, { role: 'assistant', content: retryReply.text }])
              setShaky(false)
              return
            } catch {
              setShaky(false)
            }
          }

          const fallback = localInference(prompt)
          setMessages(prev => [...prev, { role: 'assistant', content: fallback + ' (Queued for retry)' }])
          await saveAiQuery(prompt)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const quickChips = useMemo(
    () => [t('assistant.chipActionToday'), t('assistant.chipPestRisk'), t('assistant.chipWaterAcre'), t('assistant.chipFertilizerPlan')],
    [t],
  )

  // ── Footer status UI ────────────────────────────────────────────────────────
  const statusInfo = useMemo(() => {
    if (syncing) return { label: 'Syncing...', color: 'text-secondary', icon: RefreshCw }
    if (shaky) return { label: 'Connection shaky. Retrying...', color: 'text-amber-400', icon: RefreshCw }
    if (loading) return { label: t('assistant.thinking'), color: 'text-white/50', icon: Sparkles }

    switch (connectivity) {
      case 'online':
        return { label: 'Online: Fully connected', color: 'text-emerald-400', icon: Sparkles }
      case 'local-only':
        return { label: 'Local Only: Cloud API unreachable', color: 'text-amber-400', icon: CloudOff }
      case 'offline':
      default:
        return { label: 'Offline: No network detected', color: 'text-rose-400', icon: WifiOff }
    }
  }, [connectivity, loading, shaky, syncing, t])

  return (
    <>
      <div className="fixed inset-x-0 bottom-4 z-40 mx-auto w-full max-w-[1400px] px-4 lg:pl-[320px]">
        <div className="flex justify-center lg:justify-end">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              'group flex items-center gap-3 rounded-full border border-stroke-2 bg-glass-2 px-4 py-3 backdrop-blur-xl',
              'shadow-glowPrimary transition hover:shadow-glowSecondary',
            )}
          >
            <span className="relative grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5">
              <Sparkles size={18} className={cn(connectivity === 'online' ? 'text-secondary' : 'text-white/40')} />
              {/* Status Dot */}
              <span className={cn(
                "absolute top-0 right-0 h-2.5 w-2.5 rounded-full border border-black",
                connectivity === 'online' ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : 
                connectivity === 'local-only' ? "bg-amber-500" : "bg-rose-500"
              )} />
            </span>
            <div className="text-left leading-tight">
              <div className="text-sm font-semibold text-white">{t('assistant.pillTitle')}</div>
              <div className="text-xs text-white/60">{statusInfo.label}</div>
            </div>
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[900px] px-4 pb-4">
            <GlassCard className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-stroke-3 bg-glass-2 shadow-glowSecondary">
                    <statusInfo.icon size={18} className={statusInfo.color} />
                  </div>
                  <div className="leading-tight">
                    <div className="text-sm font-semibold text-white">{t('assistant.title')}</div>
                    <div className={cn("text-xs", statusInfo.color)}>{statusInfo.label}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                  onClick={() => setOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {quickChips.map((c) => (
                    <button key={c} type="button" className="glass-chip hover:border-stroke-2" onClick={() => void send(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[46vh] overflow-auto px-4 pb-2">
                <div className="space-y-2 pb-2">
                  {messages.map((m, idx) => (
                    <div key={idx} className={cn(
                      'max-w-[92%] rounded-3xl border px-4 py-3 text-sm leading-relaxed',
                      m.role === 'assistant' ? 'border-white/10 bg-white/5 text-white/80' : 'ml-auto border-stroke-2 bg-primary-700/20 text-white'
                    )}>
                      {m.content}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={cn(
                      'grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/80',
                      listening && 'border-stroke-3 bg-secondary/15 text-white shadow-glowSecondary',
                    )}
                    onClick={() => setListening((v) => !v)}
                  >
                    <Mic size={18} />
                  </button>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void send(query) }}
                    placeholder={t('assistant.inputPlaceholder')}
                    className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-stroke-2"
                  />
                  <button
                    type="button"
                    className="grid h-11 w-11 place-items-center rounded-2xl border border-stroke-2 bg-primary-700/20 text-white shadow-glowPrimary disabled:opacity-50"
                    onClick={() => void send(query)}
                    disabled={loading || syncing}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {showSyncModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={dismissSyncModal} />
          <div className="relative w-full max-w-sm">
            <GlassCard variant="strong" className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <RefreshCw size={20} className="text-secondary animate-spin" />
                <h2 className="text-sm font-semibold text-white">Back Online!</h2>
              </div>
              <p className="mb-6 text-sm text-white/70">
                You have <span className="text-white font-bold">{pendingCount}</span> saved questions. Get answers now?
              </p>
              <div className="flex gap-3">
                <button onClick={handleSyncYes} className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-bold text-white">Yes</button>
                <button onClick={dismissSyncModal} className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm text-white">No</button>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </>
  )
}
