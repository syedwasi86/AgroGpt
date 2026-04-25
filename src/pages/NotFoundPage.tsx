import { Link } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'
import { useTranslation } from 'react-i18next'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-3xl">
      <GlassCard className="p-6 sm:p-8">
        <div className="agro-h1">{t('notFound.title')}</div>
        <p className="subtle mt-2">
          {t('notFound.desc')}
        </p>
        <div className="mt-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-2xl border border-stroke-2 bg-primary-700/20 px-4 py-2 text-sm font-semibold text-white shadow-glowPrimary hover:border-stroke-3"
          >
            {t('notFound.goDashboard')}
          </Link>
        </div>
      </GlassCard>
    </div>
  )
}

