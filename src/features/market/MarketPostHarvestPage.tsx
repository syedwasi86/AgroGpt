import { useEffect, useState } from 'react'
import { supabase } from '../../core/auth/supabaseClient'
import { Banknote, ShoppingCart, TrendingUp, TrendingDown, RefreshCw, Beaker, Receipt, ArrowRightCircle, ExternalLink } from 'lucide-react'
import { GlassCard } from '../../components/GlassCard'
import { cn } from '../../core/utils/cn'

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
  const [ledger, setLedger] = useState<LedgerItem[]>([])
  const [soil, setSoil] = useState<SoilReport | null>(null)
  const [cropStandards, setCropStandards] = useState<CropRequirement[]>([])
  const [mandiPrices, setMandiPrices] = useState<MandiPrice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch Ledger
      const { data: ledgerData } = await supabase.from('financial_ledger').select('*').order('transaction_date', { ascending: false })
      if (ledgerData) setLedger(ledgerData)

      // Fetch latest soil report
      const { data: soilData } = await supabase.from('soil_reports').select('*').order('report_date', { ascending: false }).limit(1).single()
      if (soilData) setSoil(soilData)

      // Fetch crop standards
      const { data: reqData } = await supabase.from('crop_requirements').select('*')
      if (reqData) setCropStandards(reqData)

      // Mock Mandi Prices (Live simulation)
      setMandiPrices([
        { id: 1, crop: 'Wheat', market: 'Azadpur Mandi, Delhi', price_per_qtl: 2350, trend: 'up', arrival_tons: 120 },
        { id: 2, crop: 'Cotton', market: 'Kapas Mandi, Gujarat', price_per_qtl: 7200, trend: 'down', arrival_tons: 45 },
        { id: 3, crop: 'Rice', market: 'Karnal, Haryana', price_per_qtl: 3100, trend: 'stable', arrival_tons: 200 },
      ])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const addTransaction = async (type: 'Income' | 'Expense', amount: number, category: string, description: string) => {
    try {
      await supabase.from('financial_ledger').insert([
        { transaction_type: type, amount, category, description }
      ])
      fetchData() // Refresh
    } catch (err) {
      console.error(err)
    }
  }

  const getFertilizerNeeds = () => {
    if (!soil || cropStandards.length === 0) return []
    const needs = []
    // Assuming calculation against Wheat as default standard, or average
    const targetCrop = cropStandards.find(c => c.crop_name === 'Wheat') || cropStandards[0]
    
    if (soil.nitrogen < targetCrop.min_n) needs.push({ name: 'IFFCO Urea', cost: 1200, qty: 2, type: 'Nitrogen' })
    if (soil.phosphorus < targetCrop.min_p) needs.push({ name: 'DAP Fertilizer', cost: 2400, qty: 1, type: 'Phosphorus' })
    if (soil.potassium < targetCrop.min_k) needs.push({ name: 'MOP Fertilizer', cost: 1700, qty: 1, type: 'Potassium' })
    
    if (needs.length === 0) needs.push({ name: 'Organic Compost', cost: 500, qty: 5, type: 'General' })
    return needs
  }

  const generateShoppingUrl = (query: string) => `https://www.bighaat.com/search?q=${encodeURIComponent(query)}`

  const financeOverview = ledger.reduce((acc, curr) => {
    if (curr.transaction_type === 'Income') acc.income += Number(curr.amount)
    if (curr.transaction_type === 'Expense') acc.expense += Number(curr.amount)
    return acc
  }, { income: 0, expense: 0 })

  const profit = financeOverview.income - financeOverview.expense

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-white">
        <RefreshCw className="animate-spin text-green-500" size={40} />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto px-6 pb-20 pt-6">
      <div className="flex flex-col gap-6 h-full max-w-[1400px] mx-auto">
        
        {/* Header */}
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            Market & Mandi
          </h1>
          <p className="text-white/60 mt-2 font-medium">Live Mandi Rates, Automated Shopping List, and Financial Tracking</p>
        </div>

        {/* Dense Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
          
          {/* Column 1: Financial Overview & Recent Ledger */}
          <div className="flex flex-col gap-6">
            
            {/* Financial Overview Widget */}
            <GlassCard className="p-6 border-white/10 shadow-lg bg-gradient-to-br from-gray-900 to-black rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <Banknote className="text-emerald-400" size={20} />
                <h3 className="font-bold text-white/90">Net Profit/Loss</h3>
              </div>
              <div className={cn("text-4xl font-black", profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                ₹{Math.abs(profit).toLocaleString()}
                <span className="text-sm font-bold text-white/50 ml-2">{profit >= 0 ? "PROFIT" : "LOSS"}</span>
              </div>
              <div className="flex justify-between mt-4 text-xs font-semibold">
                <span className="text-green-400/80">In: ₹{financeOverview.income.toLocaleString()}</span>
                <span className="text-red-400/80">Out: ₹{financeOverview.expense.toLocaleString()}</span>
              </div>
            </GlassCard>

            {/* Recent Financial Ledger */}
            <GlassCard className="p-6 flex-1 border-white/10 shadow-lg bg-black/40 backdrop-blur-xl rounded-3xl" variant="strong">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 rounded-2xl border border-cyan-500/30">
                  <Receipt className="text-cyan-400" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white/90">Recent Ledger</h2>
                  <p className="text-xs text-white/50 uppercase tracking-widest font-semibold mt-1">Automated Tracking</p>
                </div>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
                {ledger.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", item.transaction_type === 'Income' ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
                        {item.transaction_type === 'Income' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white truncate max-w-[120px]">{item.description}</div>
                        <div className="text-[10px] text-white/50">{new Date(item.transaction_date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className={cn("font-bold", item.transaction_type === 'Income' ? "text-emerald-400" : "text-red-400")}>
                      {item.transaction_type === 'Income' ? '+' : '-'}₹{item.amount}
                    </div>
                  </div>
                ))}
                {ledger.length === 0 && <div className="text-white/40 text-sm text-center py-4">No transactions yet.</div>}
              </div>
            </GlassCard>
            
          </div>

          {/* Column 2: Live Mandi & Automated Shopping List */}
          <div className="flex flex-col gap-6">

            {/* Live Mandi Tracker with Purchase Links */}
            <GlassCard className="p-6 border-white/10 shadow-lg bg-black/40 backdrop-blur-xl rounded-3xl" variant="strong">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-2xl border border-emerald-500/30">
                  <TrendingUp className="text-emerald-400" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white/90">Live Mandi Tracker</h2>
                  <p className="text-xs text-white/50 uppercase tracking-widest font-semibold mt-1">Wholesale Rates</p>
                </div>
              </div>

              <div className="space-y-4">
                {mandiPrices.map(mandi => (
                  <div key={mandi.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-white text-lg">{mandi.crop}</div>
                        <div className="text-xs text-white/50">{mandi.market}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-xl text-emerald-400">₹{mandi.price_per_qtl}</div>
                        <div className="text-[10px] text-white/40 uppercase">per quintal</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs font-semibold bg-black/20 p-2 rounded-lg">
                      {mandi.trend === 'up' && <TrendingUp size={14} className="text-emerald-400"/>}
                      {mandi.trend === 'down' && <TrendingDown size={14} className="text-red-400"/>}
                      {mandi.trend === 'stable' && <ArrowRightCircle size={14} className="text-yellow-400"/>}
                      <span className="text-white/60 uppercase">Trend: {mandi.trend} • Arrivals: {mandi.arrival_tons}t</span>
                    </div>
                    
                    <div className="flex gap-2 mt-1">
                      <button 
                        onClick={() => addTransaction('Income', mandi.price_per_qtl * 10, 'Mandi Tracker', `Sold ${mandi.crop}`)}
                        className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                      >
                        Record Sale
                      </button>
                      <a 
                        href={generateShoppingUrl(`${mandi.crop} Seeds Fertilizer`)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                        title={`Buy suggested inputs for ${mandi.crop}`}
                      >
                        Inputs <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Automated Shopping List with Direct Checkout */}
            <GlassCard className="p-6 flex-1 border-white/10 shadow-lg bg-black/40 backdrop-blur-xl rounded-3xl" variant="strong">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-2xl border border-purple-500/30">
                  <ShoppingCart className="text-purple-400" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white/90">Automated Shopping List</h2>
                  <p className="text-xs text-white/50 uppercase tracking-widest font-semibold mt-1">Data-Driven Inputs</p>
                </div>
              </div>

              <div className="space-y-4">
                {getFertilizerNeeds().map((item, idx) => (
                  <div key={idx} className="flex flex-col bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                      <div>
                        <div className="font-bold text-lg text-white flex items-center gap-2">
                          <Beaker size={18} className="text-purple-400"/> {item.name}
                        </div>
                        <div className="text-sm text-white/60 mt-1">Deficiency: <span className="text-purple-300 font-semibold">{item.type}</span> • Est. ₹{item.cost * item.qty}</div>
                      </div>
                      <div className="text-sm font-bold bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-full">
                        Qty: {item.qty}
                      </div>
                    </div>
                    
                    {/* Price Comparison & Buy Now Section */}
                    <div className="p-4 flex flex-col gap-3">
                      <div className="text-xs font-bold text-white/50 uppercase tracking-wider">Price Comparison & Buy Now</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <a 
                          href={`https://www.bighaat.com/search?q=${encodeURIComponent(item.name)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-[#00A651]/20 hover:bg-[#00A651]/40 border border-[#00A651]/30 text-[#00A651] px-4 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                        >
                          <ShoppingCart size={18} /> View on BigHaat
                        </a>
                        <a 
                          href={`https://www.iffco.in/en/search?search_query=${encodeURIComponent(item.name)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-[#E4002B]/20 hover:bg-[#E4002B]/40 border border-[#E4002B]/30 text-[#E4002B] px-4 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                        >
                          <ShoppingCart size={18} /> View on IFFCO
                        </a>
                      </div>
                      
                      <button 
                        onClick={() => addTransaction('Expense', item.cost * item.qty, 'Shopping List', item.name)}
                        className="mt-1 w-full bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors text-center"
                      >
                        Log Expense
                      </button>
                    </div>
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
