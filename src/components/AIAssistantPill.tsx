import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Mic, RefreshCw, Send, Sparkles, WifiOff, X } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { cn } from '../core/utils/cn'
import { askAgroGPT, callGeminiAPI, localInference, GeminiError } from '../ai/provider'
import { savePendingQuery, getPendingQueries, getPendingQueryCount, markQueryAnswered } from '../lib/repository'
import { useTranslation } from 'react-i18next'

type Message = { role: 'user' | 'assistant'; content: string }

export function AIAssistantPill() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [listening, setListening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => [
    { role: 'assistant', content: t('assistant.welcome') },
  ])

  // ── Reactive online status ──────────────────────────────────────────────────
  // navigator.onLine is unreliable on Windows / VPN — it only checks whether
  // a network adapter is connected, not whether the internet is reachable.
  // We track connectivity reactively AND probe with a real HTTP request.
  const [isOnline, setIsOnline] = useState(true) // optimistic default
  const isOnlineRef = useRef(true)               // always-current ref for async fns

  /** HEAD request to the Gemini host — reliable connectivity check. */
  async function probeConnectivity(): Promise<boolean> {
    // navigator.onLine=false is an immediate hard-offline signal we trust
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return false
    }
    try {
      await fetch('https://generativelanguage.googleapis.com/', {
        method: 'HEAD',
        cache: 'no-store',
        // Short timeout so we don't block the UI
        signal: AbortSignal.timeout(4000),
      })
      return true
    } catch {
      // Network error or timeout → treat as offline for this request
      return false
    }
  }

  function setOnline(val: boolean) {
    isOnlineRef.current = val
    setIsOnline(val)
  }

  // Sync-modal state
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  /**
   * Guard ref — prevents multiple modals when the network fluctuates rapidly
   * (common in rural areas). Using a ref instead of state avoids a stale
   * closure inside the 'online' event listener.
   */
  const isSyncModalOpenRef = useRef(false)

  // ── Connectivity listener ───────────────────────────────────────────────────
  const handleReconnect = useCallback(async () => {
    setOnline(true)
    // Anti-stacking guard: do nothing if the modal is already visible
    if (isSyncModalOpenRef.current) return

    try {
      const count = await getPendingQueryCount()
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
    // Probe actual connectivity on mount (fixes Vite dev / Windows false-negative)
    probeConnectivity().then(setOnline)

    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleReconnect)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleReconnect)
      window.removeEventListener('offline', handleOffline)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleReconnect])

  // ── Dismiss sync modal ──────────────────────────────────────────────────────
  function dismissSyncModal() {
    isSyncModalOpenRef.current = false
    setShowSyncModal(false)
  }

  // ── Sync pending queries (user said Yes) ────────────────────────────────────
  async function handleSyncYes() {
    dismissSyncModal()
    setSyncing(true)
    setOpen(true) // open the chat panel so the user sees answers arriving

    let queued: Awaited<ReturnType<typeof getPendingQueries>> = []
    try {
      queued = await getPendingQueries()
    } catch (err) {
      console.error('[AgroGPT] Could not load pending queries:', err)
      setSyncing(false)
      return
    }

    for (const record of queued) {
      const questionMsg: Message = { role: 'user', content: record.prompt }
      setMessages(prev => [...prev, questionMsg])

      try {
        // Use callGeminiAPI directly — we know we are online at this point
        const reply = await callGeminiAPI(record.prompt)
        setMessages(prev => [...prev, { role: 'assistant', content: reply.text }])
        if (record.id != null) await markQueryAnswered(record.id)
      } catch (err) {
        const isTooManyRequests =
          err instanceof GeminiError && err.status === 429
        const fallback = localInference(record.prompt)
        const errNote = isTooManyRequests
          ? ' (Rate-limited — will retry next time you reconnect.)'
          : ' (API error — kept in queue for next retry.)'
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: fallback + errNote },
        ])
        // Keep the record in the queue by NOT calling markQueryAnswered
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

    try {
      // Use ref for current online status (avoids stale closure) + probe for reliability
      const online = isOnlineRef.current ? await probeConnectivity() : false
      setOnline(online)

      if (!online) {
        // ── Offline path ──────────────────────────────────────────────────────
        const offlineReply = localInference(prompt)
        setMessages(prev => [...prev, { role: 'assistant', content: offlineReply }])

        // Queue the question for later Gemini resolution
        try {
          await savePendingQuery(prompt, { location: 'Hyderabad', soil: 'Red Sandy Loam' })
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content:
                '📵 Offline. I\'ve saved your question and will get a full answer from Gemini when you\'re back in range.',
            },
          ])
        } catch (queueErr) {
          console.error('[AgroGPT] Failed to queue offline question:', queueErr)
        }
      } else {
        // ── Online path ───────────────────────────────────────────────────────
        try {
          const reply = await askAgroGPT(prompt, { location: 'Hyderabad', soil: 'Red Sandy Loam' })
          setMessages(prev => [...prev, { role: 'assistant', content: reply.text }])
        } catch (err) {
          // API failed — fall back to local mock and keep in queue
          const fallback = localInference(prompt)
          const isTooManyRequests = err instanceof GeminiError && err.status === 429
          const note = isTooManyRequests
            ? ' (Gemini is rate-limited. Saved your question for retry.)'
            : ' (API error. Saved your question for retry.)'

          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: fallback + note },
          ])

          try {
            await savePendingQuery(prompt, { location: 'Hyderabad', soil: 'Red Sandy Loam' })
          } catch (queueErr) {
            console.error('[AgroGPT] Failed to queue failed question:', queueErr)
          }
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

  // ── Footer status label (reactive — driven by isOnline state) ───────────────
  const statusLabel = (() => {
    if (syncing) return '🔄 Syncing offline questions…'
    if (loading) return t('assistant.thinking')
    const hasKey = !!import.meta.env.VITE_GEMINI_API_KEY
    if (!isOnline) return '📵 Offline mode — using local AI'
    if (hasKey) return '🌐 Gemini 1.5 Flash connected'
    return t('assistant.mockEnabled')
  })()

  return (
    <>
      {/* ── Floating Pill ── */}
      <div className="fixed inset-x-0 bottom-4 z-40 mx-auto w-full max-w-[1400px] px-4 lg:pl-[320px]">
        <div className="flex justify-center lg:justify-end">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              'group flex items-center gap-3 rounded-full border border-stroke-2 bg-glass-2 px-4 py-3 backdrop-blur-xl',
              'shadow-glowPrimary transition hover:shadow-glowSecondary',
            )}
            aria-label="Open AgroGPT assistant"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5">
              {syncing ? (
                <RefreshCw size={18} className="animate-spin text-secondary" />
              ) : (
                <Sparkles size={18} className="text-secondary" />
              )}
            </span>
            <div className="text-left leading-tight">
              <div className="text-sm font-semibold text-white">{t('assistant.pillTitle')}</div>
              <div className="text-xs text-white/60">{t('assistant.pillSubtitle')}</div>
            </div>
            {!navigator.onLine && (
              <WifiOff size={14} className="ml-1 text-amber-400" aria-label="Offline" />
            )}
          </button>
        </div>
      </div>

      {/* ── Chat Panel ── */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[900px] px-4 pb-4">
            <GlassCard className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-stroke-3 bg-glass-2 shadow-glowSecondary">
                    <Sparkles size={18} className="text-secondary" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-sm font-semibold text-white">{t('assistant.title')}</div>
                    <div className="text-xs text-white/60">
                      {import.meta.env.VITE_GEMINI_API_KEY ? 'Gemini 1.5 Flash' : t('assistant.simulatedOverlay')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                  onClick={() => setOpen(false)}
                  aria-label={t('assistant.close')}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Quick chips */}
              <div className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {quickChips.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="glass-chip hover:border-stroke-2"
                      onClick={() => void send(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message thread */}
              <div className="max-h-[46vh] overflow-auto px-4 pb-2">
                <div className="space-y-2 pb-2">
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'max-w-[92%] rounded-3xl border px-4 py-3 text-sm leading-relaxed',
                        m.role === 'assistant'
                          ? 'border-white/10 bg-white/5 text-white/80'
                          : 'ml-auto border-stroke-2 bg-primary-700/20 text-white',
                      )}
                    >
                      {m.content}
                    </div>
                  ))}
                </div>
              </div>

              {/* Input row */}
              <div className="border-t border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={cn(
                      'grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/80',
                      listening && 'border-stroke-3 bg-secondary/15 text-white shadow-glowSecondary',
                    )}
                    onClick={() => setListening((v) => !v)}
                    aria-label={t('assistant.toggleVoice')}
                  >
                    <Mic size={18} />
                  </button>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void send(query) }}
                    placeholder={t('assistant.inputPlaceholder')}
                    className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 outline-none focus:border-stroke-2"
                  />
                  <button
                    type="button"
                    className="grid h-11 w-11 place-items-center rounded-2xl border border-stroke-2 bg-primary-700/20 text-white shadow-glowPrimary hover:border-stroke-3"
                    onClick={() => void send(query)}
                    aria-label={t('assistant.send')}
                    disabled={loading || syncing}
                  >
                    <Send size={18} />
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-white/50">{statusLabel}</div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* ── Sync Consent Modal ── */}
      {showSyncModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop — clicking it is a "No" (user agency preserved) */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={dismissSyncModal}
          />
          <div className="relative w-full max-w-sm">
            <GlassCard variant="strong" className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-stroke-2 bg-primary-700/30 shadow-glowPrimary">
                  <RefreshCw size={18} className="text-secondary" />
                </div>
                <h2 className="text-sm font-semibold text-white">Back Online!</h2>
              </div>

              <p className="mb-6 text-sm leading-relaxed text-white/70">
                You have{' '}
                <span className="font-semibold text-white">
                  {pendingCount} saved question{pendingCount !== 1 ? 's' : ''}
                </span>{' '}
                from when you were offline. Should I get answers from Gemini now?
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  id="sync-modal-yes"
                  onClick={handleSyncYes}
                  className="flex-1 rounded-2xl border border-stroke-2 bg-primary-700/30 py-2.5 text-sm font-semibold text-white shadow-glowPrimary transition hover:bg-primary-700/50"
                >
                  Yes, get answers
                </button>
                <button
                  type="button"
                  id="sync-modal-no"
                  onClick={dismissSyncModal}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-2.5 text-sm text-white/70 transition hover:bg-white/10"
                >
                  Not now
                </button>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </>
  )
}
