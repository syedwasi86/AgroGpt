import { useEffect, useState } from 'react'
import { supabase } from '../../core/auth/supabaseClient'
import { Banknote, ShoppingCart, TrendingUp, TrendingDown, RefreshCw, Beaker, Receipt, ArrowRightCircle, ExternalLink, Loader2 } from 'lucide-react'
import { GlassCard } from '../../components/GlassCard'
import { cn } from '../../core/utils/cn'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { addTransaction as repoAddTransaction } from '../../lib/repository'

interface LedgerItem {
  id: number
  transaction_type: string
  amount: number
  category: string
  description: string
  transaction_date: string
}

interface SoilReport {
  id: number
  nitrogen: number
  phosphorus: number
  potassium: number
}

interface CropRequirement {
  id: number
  crop_name: string
  min_n: number
  max_n: number
  min_p: number
  max_p: number
  min_k: number
  max_k: number
}

interface MandiPrice {
  id: number
  crop: string
  market: string
  price_per_qtl: number
  trend: 'up' | 'down' | 'stable'
  arrival_tons: number
}

export function MarketPostHarvestPage() {
  const mandiRates = [
    { id: 1, crop: 'Wheat (Gehu)', market: 'Hyderabad', price: 2350, trend: 'up' },
    { id: 2, crop: 'Rice (Chawal)', market: 'Warangal', price: 3100, trend: 'stable' },
    { id: 3, crop: 'Cotton (Kapas)', market: 'Nizamabad', price: 7200, trend: 'down' },
    { id: 4, crop: 'Maize (Makka)', market: 'Hyderabad', price: 1950, trend: 'up' },
    { id: 5, crop: 'Chilli (Mirch)', market: 'Warangal', price: 18500, trend: 'up' },
  ]

  const bazaarItems = [
    { name: 'Urea (IFFCO)', brand: 'IFFCO', price: '₹266.50', desc: 'Essential for growth' },
    { name: 'DAP Fertilizer', brand: 'Paras', price: '₹1,350', desc: 'Root development' },
    { name: 'Hybrid Tomato Seeds', brand: 'Seminis', price: '₹450', desc: 'High yield potential' },
    { name: 'Neem Oil (Bio)', brand: 'Multiplex', price: '₹320', desc: 'Natural pest control' },
  ]

  const generateShoppingUrl = (query: string) => `https://www.bighaat.com/search?q=${encodeURIComponent(query)}`

  // Removed blocking loader

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto px-6 pb-20 pt-6">
      <div className="flex flex-col gap-6 h-full max-w-[1400px] mx-auto">
        
        {/* Header */}
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#87A96B] to-[#A3B899]">
            Market & Mandi
          </h1>
          <p className="text-white/60 mt-2 font-medium italic">Check live market rates and shop for farm supplies</p>
        </div>

        {/* Dense Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
          
          {/* Column 1: Today's Mandi Rates */}
          <div className="flex flex-col h-full">
            <GlassCard className="p-8 flex-1 border-[#87A96B]/20 shadow-2xl bg-black/40 backdrop-blur-3xl rounded-[2rem] overflow-hidden flex flex-col" variant="strong">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-gradient-to-br from-[#87A96B]/20 to-[#87A96B]/5 rounded-2xl border border-[#87A96B]/30 shadow-inner">
                  <TrendingUp className="text-[#87A96B]" size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white/90 tracking-tight">Today's Mandi Rates</h2>
                  <p className="text-xs text-[#87A96B] uppercase tracking-[0.2em] font-black mt-1">Mandi Bhav</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <table className="w-full text-left border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-widest text-white/30 px-4">
                      <th className="pb-2 pl-4">Crop</th>
                      <th className="pb-2">Market</th>
                      <th className="pb-2">Price (Qtl)</th>
                      <th className="pb-2 text-right pr-4">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mandiRates.map((mandi) => (
                      <tr key={mandi.id} className="group">
                        <td className="py-4 pl-4 bg-white/5 border-y border-l border-white/10 rounded-l-2xl group-hover:bg-white/10 transition-colors">
                          <div className="font-bold text-white">{mandi.crop}</div>
                        </td>
                        <td className="py-4 bg-white/5 border-y border-white/10 group-hover:bg-white/10 transition-colors">
                          <div className="text-sm text-white/60">{mandi.market}</div>
                        </td>
                        <td className="py-4 bg-white/5 border-y border-white/10 group-hover:bg-white/10 transition-colors">
                          <div className="font-black text-white">₹{mandi.price.toLocaleString()}</div>
                        </td>
                        <td className="py-4 pr-4 bg-white/5 border-y border-r border-white/10 rounded-r-2xl group-hover:bg-white/10 transition-colors text-right">
                          {mandi.trend === 'up' ? (
                            <div className="flex items-center justify-end gap-1 text-[#87A96B]">
                              <TrendingUp size={16} /> <span className="text-[10px] font-bold">UP</span>
                            </div>
                          ) : mandi.trend === 'down' ? (
                            <div className="flex items-center justify-end gap-1 text-red-400">
                              <TrendingDown size={16} /> <span className="text-[10px] font-bold">DOWN</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1 text-yellow-400">
                              <RefreshCw size={14} className="animate-spin-slow" /> <span className="text-[10px] font-bold">STABLE</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>

          {/* Column 2: Bazaar List */}
          <div className="flex flex-col h-full">
            <GlassCard className="p-8 flex-1 border-purple-500/20 shadow-2xl bg-black/40 backdrop-blur-3xl rounded-[2rem] flex flex-col" variant="strong">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-2xl border border-purple-500/30 shadow-inner">
                  <ShoppingCart className="text-purple-400" size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white/90 tracking-tight">Bazaar List</h2>
                  <p className="text-xs text-purple-400 uppercase tracking-[0.2em] font-black mt-1">Recommended for You</p>
                </div>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
                {bazaarItems.map((item, idx) => (
                  <div key={idx} className="group relative overflow-hidden p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/30 transition-all duration-300">
                    <div className="flex justify-between items-start relative z-10">
                      <div className="flex flex-col gap-1">
                        <div className="text-lg font-black text-white group-hover:text-purple-400 transition-colors">{item.name}</div>
                        <div className="text-xs text-white/40 font-bold uppercase tracking-widest">{item.brand}</div>
                        <p className="text-xs text-white/60 mt-2 italic">{item.desc}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-white">{item.price}</div>
                        <div className="text-[10px] text-white/40 uppercase mt-1">Market Price</div>
                      </div>
                    </div>
                    
                    <a 
                      href={generateShoppingUrl(item.name)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-6 w-full bg-[#87A96B] hover:bg-[#9dbf83] text-white py-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-[0_10px_20px_-5px_rgba(135,169,107,0.4)] hover:shadow-[0_15px_30px_-5px_rgba(135,169,107,0.5)] active:scale-95"
                    >
                      <ShoppingCart size={18} /> BUY NOW
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
