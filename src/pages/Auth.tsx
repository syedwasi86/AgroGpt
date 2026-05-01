import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Loader2, FlaskConical } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { cn } from '../core/utils/cn'
import { useTranslation } from 'react-i18next'
import { supabase } from '../core/auth/supabaseClient'
import { useAuth } from '../core/auth/AuthProvider'

type AuthMode = 'google' | 'phone'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.7 3.9 14.6 3 12 3 6.9 3 2.7 7.2 2.7 12.3S6.9 21.5 12 21.5c6.2 0 8.6-4.4 8.6-8.3 0-.6-.1-1-.2-1.4H12z"
      />
      <path
        fill="#34A853"
        d="M3.5 7.1l3.1 2.3C7.5 7.3 9.5 5.7 12 5.7c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.7 3.9 14.6 3 12 3 8.3 3 5.2 5 3.5 7.1z"
      />
      <path
        fill="#4A90E2"
        d="M12 21.5c2.5 0 4.6-.8 6.1-2.2l-2.8-2.2c-.8.5-1.8.9-3.3.9-2.5 0-4.6-1.7-5.4-4l-3 2.3C5.2 19.5 8.3 21.5 12 21.5z"
      />
      <path
        fill="#FBBC05"
        d="M6.6 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9l-3-2.3C2.9 9.6 2.5 10.8 2.5 12s.4 2.4 1.1 3.4l3-2.5z"
      />
    </svg>
  )
}

export function Auth() {
  const { t } = useTranslation()
  const { devLogin, signInWithGoogle, signInWithPhone, verifyOtp, busy: authBusy, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<AuthMode>('google')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [error, setError] = useState<string | null>(null)

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      const from = (location.state as any)?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    }
  }, [user, navigate, location])

  const handleGoogleLogin = async () => {
    setError(null)
    const { error } = await signInWithGoogle()
    if (error) {
      setError(error.message)
    }
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const { error } = await signInWithPhone(phone)
    if (error) {
      setError(error.message)
    } else {
      setStep('otp')
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const { error } = await verifyOtp(phone, otp)
    if (error) {
      setError(error.message)
    } else {
      // On success, the useEffect will trigger and navigate, 
      // but we can also navigate here explicitly for immediate feedback
      navigate('/dashboard', { replace: true })
    }
  }

  const inputClass =
    'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30'

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <GlassCard variant="strong" className="p-8 shadow-glass">
          <div className="mb-8 text-center">
            <h1 className="agro-h1 text-2xl sm:text-3xl">{t('auth.title')}</h1>
            <p className="subtle mt-2">{t('auth.subtitle')}</p>
          </div>

          <div
            className="relative mb-8 flex rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'google'}
              onClick={() => { setMode('google'); setError(null); }}
              className={cn(
                'relative z-10 flex-1 rounded-xl py-2.5 text-sm font-semibold transition',
                mode === 'google' ? 'text-white' : 'text-white/50 hover:text-white/75'
              )}
            >
              Google
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'phone'}
              onClick={() => { setMode('phone'); setError(null); setStep('phone'); }}
              className={cn(
                'relative z-10 flex-1 rounded-xl py-2.5 text-sm font-semibold transition',
                mode === 'phone' ? 'text-white' : 'text-white/50 hover:text-white/75'
              )}
            >
              Phone
            </button>
            <div
              className={cn(
                'pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-xl border border-white/10 bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition-transform duration-300 ease-out',
                mode === 'phone' && 'translate-x-full'
              )}
              aria-hidden
            />
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200" role="alert">
              {error}
            </div>
          )}

          {mode === 'google' ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={authBusy}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/[0.1] disabled:opacity-50"
              >
                {authBusy ? <Loader2 className="animate-spin" size={20} /> : <GoogleIcon className="h-5 w-5" />}
                Sign in with Google
              </button>
            </div>
          ) : (
            step === 'phone' ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-xs font-semibold text-white/70">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. +919876543210"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full rounded-2xl py-3 text-sm font-semibold text-white shadow-glowPrimary transition hover:opacity-95 disabled:opacity-50"
                  style={{ backgroundColor: '#2E7D32' }}
                >
                  {authBusy ? <Loader2 className="animate-spin inline-block mr-2" size={16} /> : null}
                  Send OTP
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label htmlFor="otp" className="mb-1.5 block text-xs font-semibold text-white/70">
                    Enter OTP sent to {phone}
                  </label>
                  <input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className={inputClass}
                    placeholder="123456"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full rounded-2xl py-3 text-sm font-semibold text-white shadow-glowPrimary transition hover:opacity-95 disabled:opacity-50"
                  style={{ backgroundColor: '#2E7D32' }}
                >
                  {authBusy ? <Loader2 className="animate-spin inline-block mr-2" size={16} /> : null}
                  Verify & Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="w-full text-center text-xs font-medium text-white/60 hover:text-white mt-4 block"
                >
                  Change Phone Number
                </button>
              </form>
            )
          )}
        </GlassCard>

        {import.meta.env.DEV && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => { devLogin(); navigate('/dashboard', { replace: true }) }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 py-3 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/20"
            >
              <FlaskConical size={16} />
              Demo Mode (Bypass Login)
            </button>
            <p className="mt-2 text-center text-xs text-white/30">Dev only — not visible in production</p>
          </div>
        )}
      </div>
    </div>
  )
}
