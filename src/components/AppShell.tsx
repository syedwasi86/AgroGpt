import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BarChart3,
  BookOpenCheck,
  Calculator,
  Languages,
  Leaf,
  LayoutDashboard,
  ScanLine,
  Settings,
  User,
  X,
} from 'lucide-react'
import { cn } from '../core/utils/cn'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../core/auth/AuthContext'
import { profileRepository } from '../lib/profileRepository'


type NavItem = {
  to: string
  label: string
  icon: ReactNode
}

function useNavItems(): NavItem[] {
  const { t } = useTranslation()
  return useMemo(
    () => [
      { to: '/profile', label: t('nav.profile', 'Profile'), icon: <User size={18} /> },
      { to: '/dashboard', label: t('nav.dashboard', 'Dashboard'), icon: <LayoutDashboard size={18} /> },
      { to: '/field-vision', label: t('nav.fieldVision', 'Field Vision'), icon: <ScanLine size={18} /> },
      {
        to: '/crop-calendar',
        label: t('nav.precisionPlanning', 'Precision Planning'),
        icon: <Calculator size={18} />,
      },
      { to: '/digital-khata', label: t('nav.digitalLedger', 'Digital Khata'), icon: <BookOpenCheck size={18} /> },
      { to: '/market', label: t('nav.market', 'Market'), icon: <BarChart3 size={18} /> },
      { to: '/settings', label: t('nav.settings', 'Settings'), icon: <Settings size={18} /> },
    ],
    [t],
  )
}

function Brand() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="relative grid h-10 w-10 place-items-center rounded-2xl border border-stroke-2 bg-glass-2 shadow-glowPrimary">
        <Leaf className="text-primary-300" size={18} />
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary-500/20 to-secondary/10" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold tracking-tight text-white">AgroGPT</div>
        <div className="truncate text-xs text-white/50">{t('app.tagline', 'Offline-first Farm Intelligence')}</div>
      </div>
    </div>
  )
}

const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { i18n, t } = useTranslation()
  const { user } = useAuth()
  const items = useNavItems()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const handleLanguageChange = async (newLang: string) => {
    void i18n.changeLanguage(newLang)
    if (user?.id) {
      try {
        await profileRepository.updateProfile(user.id, {
          preferred_language: newLang
        })
      } catch (err) {
        console.warn('[AppShell] Failed to sync language to Dexie profile:', err)
      }
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false)
  }, [location.pathname])


  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:block lg:w-[300px] lg:p-4">
        <div className="glass-card flex h-full flex-col overflow-hidden">
          <Brand />
          <div className="px-3 pb-3">
            <div className="h-px w-full bg-white/10" />
          </div>
          <div className="px-3 pb-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
                  <Languages size={14} className="text-white/70" />
                  {t('ui.language', 'Language')}
                </div>
                <select
                  value={i18n.language}
                  onChange={(e) => void handleLanguageChange(e.target.value)}
                  className="h-8 rounded-xl border border-white/10 bg-black/20 px-2 text-xs font-semibold text-white/80 outline-none focus:border-stroke-2"
                  aria-label={t('ui.language', 'Language')}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <nav className="flex-1 px-2 pb-3">
            <div className="space-y-1">
              {items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition',
                      'border border-transparent bg-white/0 text-white/70 hover:border-stroke-1 hover:bg-glass-1 hover:text-white',
                      isActive && 'border-stroke-2 bg-glass-2 text-white shadow-glowPrimary',
                    )
                  }
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/80 group-hover:text-white">
                    {it.icon}
                  </span>
                  <span className="truncate">{it.label}</span>
                </NavLink>
              ))}
            </div>
          </nav>
          <div className="px-4 pb-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-semibold text-white/80">{t('ui.today', 'Today')}</div>
              <div className="mt-1 text-xs text-white/60">
                {t('ui.todayStrip', 'Hyderabad, India')}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 lg:hidden">
        <div className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-3xl border border-stroke-1 bg-glass-1 px-3 py-2 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-stroke-2 bg-glass-2 shadow-glowPrimary">
              <Leaf className="text-primary-300" size={18} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">AgroGPT</div>
              <div className="text-xs text-white/60">{t('ui.hyderabad', 'Hyderabad, India')}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="glass-chip border-stroke-1 bg-glass-2 px-4 py-2 text-xs font-semibold text-white hover:border-stroke-2"
            aria-label="Open navigation"
          >
            {t('ui.menu', 'Menu')}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[340px] p-4">
            <div className="glass-card flex h-full flex-col overflow-hidden">
              <div className="flex items-center justify-between pr-2">
                <Brand />
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="px-3 pb-3">
                <div className="h-px w-full bg-white/10" />
              </div>
              <div className="px-3 pb-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
                      <Languages size={14} className="text-white/70" />
                      {t('ui.language', 'Language')}
                    </div>
                    <select
                      value={i18n.language}
                      onChange={(e) => void handleLanguageChange(e.target.value)}
                      className="h-8 rounded-xl border border-white/10 bg-black/20 px-2 text-xs font-semibold text-white/80 outline-none focus:border-stroke-2"
                      aria-label={t('ui.language', 'Language')}
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <nav className="flex-1 px-2 pb-3">
                <div className="space-y-1">
                  {items.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition',
                          'border border-transparent bg-white/0 text-white/70 hover:border-stroke-1 hover:bg-glass-1 hover:text-white',
                          isActive && 'border-stroke-2 bg-glass-2 text-white shadow-glowPrimary',
                        )
                      }
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/80">
                        {it.icon}
                      </span>
                      <span className="truncate">{it.label}</span>
                    </NavLink>
                  ))}
                </div>
              </nav>
              <div className="px-4 pb-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold text-white/80">{t('ui.tip', 'Tip')}</div>
                  <div className="mt-1 text-xs text-white/60">
                    {t('ui.tipText', 'AgroGPT works offline. Any changes sync when you reconnect.')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="mx-auto max-w-[1400px] px-4 pb-36 pt-6 lg:pl-[320px]">
        {children}
      </main>
    </div>
  )
}

