import { ShoppingCart, TrendingUp, Sparkles } from 'lucide-react'
import { MarketMandi } from './MarketMandi'
import { GlassCard } from '../../components/GlassCard'
import { useState, useEffect } from 'react'
import { useCrop } from '@/core/context/CropContext'
import { useTranslation } from 'react-i18next'
import { useEnumTranslation } from '@/hooks/useEnumTranslation'

const PRODUCT_LOOKUP: Record<string, { productKey: string; descriptionKey: string; price: string; link: string }> = {
  'Nitrogen Deficiency': {
    productKey: "nanoUrea",
    descriptionKey: "nanoUreaDesc",
    price: "₹240.00",
    link: "https://www.bighaat.com/products/iffco-nano-urea"
  },
  'Phosphorus Deficiency': {
    productKey: "pSol",
    descriptionKey: "pSolDesc",
    price: "₹380.00",
    link: "https://agribegri.com/"
  },
  'Fungal Blight / Leaf Spot': {
    productKey: "blitox",
    descriptionKey: "blitoxDesc",
    price: "₹420.00",
    link: "https://www.bighaat.com/products/blitox"
  },
  'Aphid Infestation Detected': {
    productKey: "neemOil",
    descriptionKey: "neemOilDesc",
    price: "₹320.00",
    link: "https://www.bighaat.com/search?q=Multiplex+Neem+Oil"
  }
}

export function MarketPostHarvestPage() {
  const { t } = useTranslation('market')
  const { tEnum } = useEnumTranslation()
  const { activeCrop } = useCrop()
  const [activeDiagnosis, setActiveDiagnosis] = useState<string | null>(null)

  useEffect(() => {
    const diagnosis = localStorage.getItem('active_diagnosis')
    if (diagnosis) {
      setActiveDiagnosis(diagnosis)
    }
  }, [])

  const BAZAAR_ITEMS_BY_CROP: Record<string, { nameKey: string; brand: string; price: string; descKey: string }[]> = {
    Rice: [
      { nameKey: 'hybridPaddy', brand: 'Seminis', price: '₹650', descKey: 'hybridPaddyDesc' },
      { nameKey: 'zincSulfate', brand: 'Multiplex', price: '₹480', descKey: 'zincSulfateDesc' },
      { nameKey: 'urea', brand: 'IFFCO', price: '₹266.50', descKey: 'ureaDesc' },
      { nameKey: 'neemOil', brand: 'neemOil', price: '₹320', descKey: 'neemOilDesc' }
    ],
    Wheat: [
      { nameKey: 'hd2967', brand: 'Nuziveedu', price: '₹850', descKey: 'hd2967Desc' },
      { nameKey: 'npk19', brand: 'Mahadhan', price: '₹350', descKey: 'npk19Desc' },
      { nameKey: 'dap', brand: 'Paras', price: '₹1,350', descKey: 'dapDesc' },
      { nameKey: 'neemOil', brand: 'Multiplex', price: '₹320', descKey: 'neemOilDesc' }
    ],
    Cotton: [
      { nameKey: 'btCotton', brand: 'Rasi Seeds', price: '₹864', descKey: 'btCottonDesc' },
      { nameKey: 'magnesiumSulfate', brand: 'Anand Agro', price: '₹320', descKey: 'magnesiumSulfateDesc' },
      { nameKey: 'neemOil', brand: 'Multiplex', price: '₹320', descKey: 'neemOilDesc' },
      { nameKey: 'dap', brand: 'Paras', price: '₹1,350', descKey: 'dapDesc' }
    ],
    Maize: [
      { nameKey: 'pioneerMaize', brand: 'Pioneer', price: '₹750', descKey: 'pioneerMaizeDesc' },
      { nameKey: 'atrazine', brand: 'Dhanuka', price: '₹420', descKey: 'atrazineDesc' },
      { nameKey: 'zincSolubilizing', brand: 'Multiplex', price: '₹290', descKey: 'zincSolubilizingDesc' },
      { nameKey: 'urea', brand: 'IFFCO', price: '₹266.50', descKey: 'ureaDesc' }
    ]
  }

  const bazaarItems = BAZAAR_ITEMS_BY_CROP[activeCrop] || BAZAAR_ITEMS_BY_CROP.Rice

  const generateShoppingUrl = (query: string) => `https://www.bighaat.com/search?q=${encodeURIComponent(query)}`
  const recommendedProduct = activeDiagnosis ? PRODUCT_LOOKUP[activeDiagnosis] : null

  return (
    <div className="px-6 pb-20 pt-6">
      <div className="flex flex-col gap-6 max-w-[1400px] mx-auto">
        
        {/* Header */}
        <div>
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#4ade80] to-teal-400 tracking-tighter">
            {t('title')}
          </h1>
          <p className="text-white/80 mt-2 font-bold text-lg uppercase tracking-wider">{t('subtitle')}</p>
        </div>

        {/* Dynamic AI Recommended Inputs Section */}
        {recommendedProduct && (
          <GlassCard className="p-8 border-[#223328] shadow-2xl bg-[#141e18] rounded-[2.5rem] flex flex-col animate-in fade-in duration-500" variant="strong">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-gradient-to-br from-[#4ade80]/30 to-[#4ade80]/10 rounded-2xl border border-[#223328] shadow-inner">
                <Sparkles className="text-[#4ade80]" size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight uppercase">{t('aiRecommendedInputs')}</h2>
                <p className="text-xs text-[#4ade80] uppercase tracking-[0.3em] font-black mt-1">
                  {t('basedOnDiagnosis', { diagnosis: activeDiagnosis ? tEnum('diagnosis', activeDiagnosis) : '' })}
                </p>
              </div>
            </div>

            <div className="p-6 rounded-[2rem] bg-[#0e1611] border-2 border-[#223328] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex flex-col gap-1.5 max-w-2xl">
                <div className="text-2xl font-black text-white tracking-tight">{t(recommendedProduct.productKey)}</div>
                <p className="text-sm text-gray-300 leading-relaxed font-semibold italic">{t(recommendedProduct.descriptionKey)}</p>
                <div className="text-xs text-[#4ade80] font-black uppercase tracking-wider mt-1">{t('statusPrescription')}</div>
              </div>
              <div className="text-right flex flex-col items-end shrink-0 w-full md:w-auto">
                <div className="text-3xl font-black text-[#4ade80] drop-shadow-md mb-2">{recommendedProduct.price}</div>
                <a 
                  href={recommendedProduct.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full md:w-auto bg-[#4ade80] hover:bg-[#5aee90] text-[#0e1611] py-4 px-8 rounded-2xl text-base font-black transition-all flex items-center justify-center gap-3 shadow-[0_15px_30px_-10px_rgba(74,222,128,0.4)] hover:shadow-[0_20px_40px_-10px_rgba(74,222,128,0.6)] active:scale-95 uppercase tracking-widest"
                >
                  <ShoppingCart size={22} /> {t('buyNow')}
                </a>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Dense Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Column 1: Today's Mandi Rates */}
          <div className="flex flex-col">
            <GlassCard className="p-8 border-[#223328] shadow-2xl bg-[#141e18] rounded-[2.5rem] flex flex-col" variant="strong">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-gradient-to-br from-[#4ade80]/30 to-[#4ade80]/10 rounded-2xl border border-[#223328] shadow-inner">
                  <TrendingUp className="text-[#4ade80]" size={32} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight uppercase">{t('todaysMandiRates')}</h2>
                  <p className="text-xs text-[#4ade80] uppercase tracking-[0.3em] font-black mt-1">{t('liveMarketPrices')}</p>
                </div>
              </div>

              <MarketMandi />
            </GlassCard>
          </div>

          {/* Column 2: Bazaar List */}
          <div className="flex flex-col">
            <GlassCard className="p-8 border-[#223328] shadow-2xl bg-[#141e18] rounded-[2.5rem] flex flex-col" variant="strong">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-gradient-to-br from-purple-500/30 to-purple-500/10 rounded-2xl border border-[#223328] shadow-inner">
                  <ShoppingCart className="text-purple-400" size={32} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight uppercase">{t('bazaarList')}</h2>
                  <p className="text-xs text-purple-400 uppercase tracking-[0.3em] font-black mt-1">{t('smartRecommendations')}</p>
                </div>
              </div>

              <div className="space-y-6">
                {bazaarItems.map((item, idx) => (
                  <div key={idx} className="group relative overflow-hidden p-6 rounded-[2rem] bg-white/5 border-2 border-white/10 hover:border-[#223328] hover:bg-white/10 transition-all duration-500 shadow-lg">
                    <div className="flex justify-between items-start relative z-10 mb-6">
                      <div className="flex flex-col gap-1">
                        <div className="text-2xl font-black text-white group-hover:text-[#4ade80] transition-colors tracking-tight">{t(item.nameKey)}</div>
                        <div className="text-xs text-gray-300 font-black uppercase tracking-[0.2em]">{item.brand}</div>
                        <p className="text-sm text-gray-400 mt-3 font-bold italic leading-relaxed">{t(item.descKey)}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-white drop-shadow-md">{item.price}</div>
                        <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">{t('marketPrice')}</div>
                      </div>
                    </div>
                    
                    <a 
                      href={generateShoppingUrl(t(item.nameKey))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-[#4ade80] hover:bg-[#5aee90] text-[#0e1611] py-5 rounded-2xl text-base font-black transition-all flex items-center justify-center gap-3 shadow-[0_15px_30px_-10px_rgba(74,222,128,0.4)] hover:shadow-[0_20px_40px_-10px_rgba(74,222,128,0.6)] active:scale-95 uppercase tracking-widest"
                    >
                      <ShoppingCart size={22} /> {t('buyNow')}
                    </a>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

        </div>

      </div>
    </div>
  )
}
