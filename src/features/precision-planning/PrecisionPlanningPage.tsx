import { useState } from 'react'
import { 
  Sprout, 
  Droplets, 
  Mountain, 
  History, 
  Beaker, 
  CheckCircle2, 
  Calendar,
  Undo2,
  Calculator
} from 'lucide-react'
import { GlassCard } from '../../components/GlassCard'
import { cn } from '../../core/utils/cn'
import { useTranslation } from 'react-i18next'
import { getPrecisionRecommendation } from './planningLogic'
import type { SoilType, WaterAvailability, Recommendation } from './planningLogic'

interface HistoryItem extends Recommendation {
  id: string
  timestamp: string
  soil: string
  water: string
  current: string
}

export function PrecisionPlanningPage() {
  const { t } = useTranslation()
  
  // State
  const [soil, setSoil] = useState<SoilType>('Loam')
  const [water, setWater] = useState<WaterAvailability>('Medium')
  const [currentCrop, setCurrentCrop] = useState('Cotton')
  const [result, setResult] = useState<Recommendation | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showCalculator, setShowCalculator] = useState(false)

  // Options
  const soilOptions: SoilType[] = ['Clay', 'Sandy', 'Loam']
  const waterOptions: WaterAvailability[] = ['Low', 'Medium', 'High']
  const cropOptions = ['Cotton', 'Maize', 'Rice', 'Wheat', 'Millet', 'Sorghum']

  const handleGetRecommendation = () => {
    const rec = getPrecisionRecommendation(soil, water, currentCrop)
    setResult(rec)
    
    // Add to history
    const newItem: HistoryItem = {
      ...rec,
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      soil,
      water,
      current: currentCrop
    }
    setHistory(prev => [newItem, ...prev].slice(0, 5))
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="agro-h1 text-[#A67B5B]">{t('planning.title', 'Agronomy Planning')}</div>
          <p className="subtle mt-2 max-w-2xl">
            {t('planning.agronomyDesc', 'Precision crop rotation and fertilizer strategy based on your unique field profile.')}
          </p>
        </div>
        <button 
          onClick={() => setShowCalculator(!showCalculator)}
          className="glass-chip flex items-center gap-2 border-white/10 hover:border-[#87A96B] hover:bg-[#87A96B]/10 transition-all"
        >
          <Calculator size={14} />
          {showCalculator ? 'Hide Calculator' : 'Show Volume Calculator'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Input Card */}
        <GlassCard className="p-6 sm:p-8 border-[#A67B5B]/20" variant="strong">
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[#A67B5B]/30 bg-[#A67B5B]/10">
              <Beaker size={20} className="text-[#A67B5B]" />
            </div>
            <div>
              <div className="agro-h2 text-white/90">Environmental Profile</div>
              <div className="subtle text-white/40">Set your current field conditions</div>
            </div>
          </div>

          <div className="space-y-5">
            {/* Soil Type */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#A67B5B]">
                Soil Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {soilOptions.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSoil(opt)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all",
                      soil === opt 
                        ? "border-[#A67B5B] bg-[#A67B5B]/10 text-white shadow-[0_0_15px_rgba(166,123,91,0.15)]" 
                        : "border-white/5 bg-white/5 text-white/50 hover:bg-white/10"
                    )}
                  >
                    <Mountain size={18} className={soil === opt ? "text-[#A67B5B]" : "text-white/30"} />
                    <span className="text-sm font-semibold">{opt}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Water Availability */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#A67B5B]">
                Water Availability
              </label>
              <div className="grid grid-cols-3 gap-3">
                {waterOptions.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setWater(opt)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all",
                      water === opt 
                        ? "border-[#87A96B] bg-[#87A96B]/10 text-white shadow-[0_0_15px_rgba(135,169,107,0.15)]" 
                        : "border-white/5 bg-white/5 text-white/50 hover:bg-white/10"
                    )}
                  >
                    <Droplets size={18} className={water === opt ? "text-[#87A96B]" : "text-white/30"} />
                    <span className="text-sm font-semibold">{opt}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Current Crop */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#A67B5B]">
                Current Standing Crop
              </label>
              <select
                value={currentCrop}
                onChange={(e) => setCurrentCrop(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white outline-none focus:border-[#A67B5B]"
              >
                {cropOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGetRecommendation}
              className="mt-4 w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#A67B5B] to-[#87A96B] p-4 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sprout size={18} />
              Get Precision Recommendation
            </button>
          </div>
        </GlassCard>

        {/* Results Card */}
        <div className="space-y-6">
          {result ? (
            <GlassCard className="p-6 sm:p-8 animate-in fade-in slide-in-from-right-4 duration-500" variant="strong">
              <div className="flex items-center gap-3 mb-6">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[#87A96B]/30 bg-[#87A96B]/10">
                  <CheckCircle2 size={20} className="text-[#87A96B]" />
                </div>
                <div>
                  <div className="agro-h2 text-white/90">Strategic Result</div>
                  <div className="subtle text-white/40">AI-driven agronomy plan</div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl border border-[#87A96B]/20 bg-[#87A96B]/5 p-5">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#87A96B]">Recommended Next Crop</div>
                  <div className="mt-2 text-2xl font-bold text-white">{result.nextBestCrop}</div>
                </div>

                <div className="rounded-3xl border border-[#A67B5B]/20 bg-[#A67B5B]/5 p-5">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#A67B5B]">Fertilizer Strategy</div>
                  <div className="mt-2 text-lg font-semibold text-white/90 leading-relaxed">
                    {result.fertilizerStrategy}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/5 p-4 italic text-sm text-white/60 leading-relaxed">
                  "{result.rationale}"
                </div>
              </div>
            </GlassCard>
          ) : (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
              <div className="mb-4 rounded-full bg-white/5 p-5">
                <Sprout size={40} className="text-white/20" />
              </div>
              <div className="text-lg font-semibold text-white/30">Ready for Analysis</div>
              <p className="subtle mt-2">Enter your field parameters to generate a custom agronomy plan.</p>
            </div>
          )}
        </div>
      </div>

      {/* History Section */}
      {history.length > 0 && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-2 mb-4 px-2">
            <History size={16} className="text-[#A67B5B]" />
            <div className="text-sm font-bold uppercase tracking-widest text-[#A67B5B]">Recent Planning History</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {history.map(item => (
              <GlassCard key={item.id} className="p-4 border-white/5 group hover:border-[#A67B5B]/30 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-tighter">
                    <Calendar size={10} />
                    {item.timestamp}
                  </div>
                  <div className="text-[10px] font-bold text-[#87A96B] px-2 py-0.5 rounded-full bg-[#87A96B]/10 border border-[#87A96B]/20">
                    {item.soil} · {item.water}
                  </div>
                </div>
                <div className="text-sm font-bold text-white group-hover:text-[#A67B5B] transition-colors">{item.nextBestCrop}</div>
                <div className="mt-1 text-xs text-white/40 truncate">{item.fertilizerStrategy}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* Legacy Calculator (Optional Toggle) */}
      {showCalculator && (
        <div className="mt-12 pt-8 border-t border-white/5 animate-in zoom-in-95 duration-300">
          <div className="mb-6">
            <div className="agro-h2 text-white/60 flex items-center gap-2">
              <Calculator size={18} /> Volume Planning Utility
            </div>
            <p className="subtle text-xs mt-1">Adjust land size for precise water/fertilizer volume estimates.</p>
          </div>
          <LegacyCalculator />
        </div>
      )}
    </div>
  )
}

function LegacyCalculator() {
  const [acres, setAcres] = useState(2.0)
  
  const liters = Math.round(acres * 220)
  const fertKg = Math.round(acres * 25)

  return (
    <GlassCard className="p-6" variant="strong">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <div className="text-sm font-semibold text-white/70">Land Size (Acres)</div>
            <div className="text-2xl font-bold text-[#A67B5B]">{acres.toFixed(1)}</div>
          </div>
          <input
            type="range"
            min={0.5}
            max={25}
            step={0.1}
            value={acres}
            onChange={(e) => setAcres(parseFloat(e.target.value))}
            className="w-full accent-[#A67B5B]"
          />
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <div className="text-[10px] font-bold text-white/40 uppercase">Water Volume</div>
              <div className="text-xl font-bold text-white mt-1">{liters.toLocaleString()} L</div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <div className="text-[10px] font-bold text-white/40 uppercase">Fertilizer Mass</div>
              <div className="text-xl font-bold text-white mt-1">{fertKg.toLocaleString()} kg</div>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <div className="rounded-3xl border border-[#87A96B]/10 bg-[#87A96B]/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-[#87A96B]/20">
                <Undo2 size={16} className="text-[#87A96B]" />
              </div>
              <div className="text-sm font-bold text-white">Application Note</div>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              Based on a {acres} acre plot, ensure your application equipment is calibrated for even distribution. 
              Always test soil moisture 24 hours after application.
            </p>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}
