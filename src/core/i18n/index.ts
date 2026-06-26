import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { db } from '../../lib/db'
import { supabase } from '../auth/supabaseClient'

const locales = import.meta.glob('../../locales/**/*.json')

const CustomBackend = {
  type: 'backend' as const,
  init() {},
  read(language: string, namespace: string, callback: (err: Error | null, data: any) => void) {
    const path = `../../locales/${language}/${namespace}.json`
    const loadFn = locales[path]
    if (!loadFn) {
      callback(new Error(`Locale file not found: ${path}`), null)
      return
    }
    loadFn()
      .then((module: any) => {
        callback(null, module.default || module)
      })
      .catch((err: any) => {
        callback(err, null)
      })
  }
}

const saved = typeof window !== 'undefined' ? localStorage.getItem('agrogpt.lang') : null
const defaultLng = saved || 'en'

i18n
  .use(CustomBackend)
  .use(initReactI18next)
  .init({
    lng: defaultLng,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'enums', 'validation', 'dashboard', 'profile', 'fieldVision', 'cropCalendar', 'digitalKhata', 'market'],
    interpolation: { escapeValue: false },
    react: { useSuspense: true }
  })

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem('agrogpt.lang', lng)
  } catch {
    // ignore
  }
  document.documentElement.lang = lng

  // Immediately sync to the Dexie profile if authenticated
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user?.id) {
      db.profiles.get(session.user.id).then((profile) => {
        if (profile && profile.preferred_language !== lng) {
          db.profiles.update(session.user.id, {
            preferred_language: lng,
            updated_at: new Date().toISOString(),
            sync_status: 'pending'
          }).catch(err => {
            console.warn('[i18n] Failed to update language in Dexie profile:', err)
          })
        }
      }).catch(() => {})
    }
  }).catch(() => {})
})

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language
}

export default i18n
