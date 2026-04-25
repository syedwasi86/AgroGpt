import { useMemo } from 'react'
import { GlassCard } from '../../components/GlassCard'
import { ArrowRight, BadgeCheck, Sprout } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Crop = {
  name: string
  depletion: { n: number; p: number; k: number } // rough placeholder
}

function scoreNextCrop(soil: { n: number; p: number; k: number }, candidate: Crop) {
  // Simple “soil depletion logic” placeholder:
  // - prefer crops that demand less of the most depleted nutrient.
  const need = candidate.depletion
  const penalty = (1 / (soil.n + 1)) * need.n + (1 / (soil.p + 1)) * need.p + (1 / (soil.k + 1)) * need.k
  return 100 - penalty * 18
}

export function MarketPostHarvestPage() {
  const { t } = useTranslation()
  const soil = useMemo(() => ({ n: 48, p: 22, k: 36 }), [])

  const candidates: Crop[] = useMemo(
    () => [
      { name: t('data.crop.greengram', 'Green gram (Moong)'), depletion: { n: 8, p: 10, k: 10 } },
      { name: t('data.crop.sesame', 'Sesame'), depletion: { n: 10, p: 12, k: 14 } },
      { name: t('data.crop.sorghum', 'Sorghum'), depletion: { n: 14, p: 10, k: 16 } },
      { name: t('data.crop.sunflower', 'Sunflower'), depletion: { n: 16, p: 12, k: 18 } },
      { name: t('data.crop.maize', 'Maize'), depletion: { n: 22, p: 18, k: 20 } },
    ],
    [t],
  )

  const ranked = useMemo(
    () =>
      [...candidates]
        .map((c) => ({ ...c, score: scoreNextCrop(soil, c) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4),
    [candidates, soil],
  )

  return (
    <div className="space-y-6">
      <div>
        <div className="agro-h1">{t('market.title')}</div>
        <p className="subtle mt-2 max-w-2xl">
          {t('market.desc')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-6" variant="strong">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="agro-h2">{t('market.harvestQualityGrading')}</div>
              <div className="subtle mt-1">{t('market.gradePlaceholders')}</div>
            </div>
            <span className="glass-chip border-stroke-2 bg-primary-700/12">
              <BadgeCheck size={14} className="text-primary-300" /> {t('market.aiGrading')}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { grade: 'A', pct: 62, tone: 'border-stroke-2 bg-primary-700/15' },
              { grade: 'B', pct: 28, tone: 'border-white/10 bg-white/5' },
              { grade: 'C', pct: 10, tone: 'border-stroke-3 bg-secondary/10' },
            ].map((g) => (
              <div key={g.grade} className={`rounded-3xl border p-4 ${g.tone}`}>
                <div className="text-xs font-semibold text-white/70">{t('market.grade')}</div>
                <div className="mt-1 text-3xl font-semibold text-white">{g.grade}</div>
                <div className="mt-2 text-xs text-white/60">{g.pct}% {t('market.lots')}</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-white/15 to-white/5"
                    style={{ width: `${g.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
            {t('market.upgradePath')}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="agro-h2">{t('market.nextCrops')}</div>
              <div className="subtle mt-1">{t('market.soilDepletionBased')}</div>
            </div>
            <span className="glass-chip">
              {t('dashboard.soil')}: <span className="font-semibold text-white">N48 P22 K36</span>
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {ranked.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Sprout size={16} className="text-primary-300" />
                    <div className="truncate text-sm font-semibold text-white">{c.name}</div>
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    {t('market.suitabilityScore')}: <span className="font-semibold text-white/75">{Math.round(c.score)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
                >
                  {t('market.plan')} <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-3xl border border-stroke-2 bg-primary-700/10 p-4 text-xs text-white/65">
            {t('market.logicNote')}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

