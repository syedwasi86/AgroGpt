import { useMemo, useState } from 'react'
import { Mic, Send, Sparkles, X } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { cn } from '../core/utils/cn'
import { askAgroGPT } from '../ai/provider'
import { useTranslation } from 'react-i18next'

type Message = { role: 'user' | 'assistant'; content: string }

export function AIAssistantPill() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [listening, setListening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      role: 'assistant',
      content: t('assistant.welcome'),
    },
  ])

  const quickChips = useMemo(
    () => [t('assistant.chipActionToday'), t('assistant.chipPestRisk'), t('assistant.chipWaterAcre'), t('assistant.chipFertilizerPlan')],
    [t],
  )

  async function send(text: string) {
    const prompt = text.trim()
    if (!prompt) return
    setMessages((m) => [...m, { role: 'user', content: prompt }])
    setQuery('')
    setLoading(true)
    try {
      const reply = await askAgroGPT(prompt, { location: 'Hyderabad', soil: 'Red Sandy Loam' })
      setMessages((m) => [...m, { role: 'assistant', content: reply.text }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown AI error'
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `${t('assistant.unavailableNow')} (${msg})` },
      ])
    } finally {
      setLoading(false)
    }
  }

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
            aria-label="Open AgroGPT assistant"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5">
              <Sparkles size={18} className="text-secondary" />
            </span>
            <div className="text-left leading-tight">
              <div className="text-sm font-semibold text-white">{t('assistant.pillTitle')}</div>
              <div className="text-xs text-white/60">{t('assistant.pillSubtitle')}</div>
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
                    <Sparkles size={18} className="text-secondary" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-sm font-semibold text-white">{t('assistant.title')}</div>
                    <div className="text-xs text-white/60">
                      {t('assistant.simulatedOverlay')}
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

              <div className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {quickChips.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="glass-chip hover:border-stroke-2"
                      onClick={() => send(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void send(query)
                    }}
                    placeholder={t('assistant.inputPlaceholder')}
                    className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 outline-none focus:border-stroke-2"
                  />
                  <button
                    type="button"
                    className="grid h-11 w-11 place-items-center rounded-2xl border border-stroke-2 bg-primary-700/20 text-white shadow-glowPrimary hover:border-stroke-3"
                    onClick={() => void send(query)}
                    aria-label={t('assistant.send')}
                    disabled={loading}
                  >
                    <Send size={18} />
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-white/50">
                  {loading
                    ? t('assistant.thinking')
                    : import.meta.env.VITE_AI_ENDPOINT
                      ? t('assistant.connected')
                      : t('assistant.mockEnabled')}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </>
  )
}

