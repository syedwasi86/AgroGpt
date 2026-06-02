import { useEffect, useState } from 'react'
import { RefreshCw, Calendar, MapPin, Tag } from 'lucide-react'
import { useCrop } from '@/core/context/CropContext'

interface MandiRate {
  market_name: string
  commodity_name: string
  variety: string
  modal_price: string
  arrival_date: string
}

const mockMarketRates: MandiRate[] = [
  {
    market_name: "Bowenpally",
    commodity_name: "Tomato",
    variety: "Hybrid",
    modal_price: "2400",
    arrival_date: "31/05/2026"
  },
  {
    market_name: "Nizamabad",
    commodity_name: "Paddy (Dhan)",
    variety: "Grade A",
    modal_price: "2350",
    arrival_date: "31/05/2026"
  },
  {
    market_name: "Warangal",
    commodity_name: "Cotton",
    variety: "Bunny",
    modal_price: "7400",
    arrival_date: "31/05/2026"
  },
  {
    market_name: "Vikarabad",
    commodity_name: "Maize",
    variety: "Common",
    modal_price: "1980",
    arrival_date: "31/05/2026"
  },
  {
    market_name: "Bowenpally",
    commodity_name: "Onion",
    variety: "Nasik",
    modal_price: "1650",
    arrival_date: "31/05/2026"
  },
  {
    market_name: "Nizamabad",
    commodity_name: "Paddy (Dhan)",
    variety: "Common",
    modal_price: "2180",
    arrival_date: "31/05/2026"
  },
  {
    market_name: "Warangal",
    commodity_name: "Cotton",
    variety: "Hybrid",
    modal_price: "7150",
    arrival_date: "31/05/2026"
  },
  {
    market_name: "Bowenpally",
    commodity_name: "Tomato",
    variety: "Local",
    modal_price: "1800",
    arrival_date: "31/05/2026"
  },
  {
    market_name: "Vikarabad",
    commodity_name: "Tomato",
    variety: "Local",
    modal_price: "1750",
    arrival_date: "31/05/2026"
  },
  {
    market_name: "Bowenpally",
    commodity_name: "Onion",
    variety: "Local",
    modal_price: "1300",
    arrival_date: "31/05/2026"
  },
  {
    market_name: "Nizamabad",
    commodity_name: "Wheat",
    variety: "Lokwan",
    modal_price: "2450",
    arrival_date: "31/05/2026"
  },
  {
    market_name: "Bowenpally",
    commodity_name: "Wheat",
    variety: "Kalyan Sona",
    modal_price: "2600",
    arrival_date: "31/05/2026"
  }
]

const cropToCommodityMap: Record<string, string> = {
  Rice: 'Paddy (Dhan)',
  Wheat: 'Wheat',
  Cotton: 'Cotton',
  Maize: 'Maize'
}

export function MarketMandi() {
  const { activeCrop } = useCrop()
  const [rates, setRates] = useState<MandiRate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load mock data instantly with no external dependencies
    const timer = setTimeout(() => {
      setRates(mockMarketRates)
      setLoading(false)
    }, 150) // Subtle delay for responsive UI feel

    return () => clearTimeout(timer)
  }, [])

  const targetCommodity = cropToCommodityMap[activeCrop] || activeCrop
  const filteredRates = rates.filter(rate => 
    rate.commodity_name.toLowerCase() === targetCommodity.toLowerCase()
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <RefreshCw className="animate-spin text-[#4ade80]" size={32} />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <div className="bg-white/5 px-6 py-3 border-b border-white/5 flex justify-between items-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#4ade80]">
          Active Filter: {activeCrop}
        </span>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/5">
            <th className="py-4 pl-6 text-[11px] font-black uppercase tracking-widest text-white/50">Crop & Variety</th>
            <th className="py-4 text-[11px] font-black uppercase tracking-widest text-white/50">Market</th>
            <th className="py-4 text-[11px] font-black uppercase tracking-widest text-white/50">Price (Qtl)</th>
            <th className="py-4 pr-6 text-[11px] font-black uppercase tracking-widest text-white/50 text-right">Arrival Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {filteredRates.map((mandi, idx) => {
            const parsedPrice = parseFloat(mandi.modal_price)
            return (
              <tr key={idx} className="group hover:bg-white/5 transition-colors">
                <td className="py-5 pl-6">
                  <div className="flex flex-col">
                    <div className="font-black text-white text-lg flex items-center gap-1.5">
                      {mandi.commodity_name}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-[#4ade80] flex items-center gap-1 mt-0.5">
                      <Tag size={10} /> {mandi.variety}
                    </div>
                  </div>
                </td>
                <td className="py-5">
                  <div className="text-sm font-bold text-white/70 uppercase tracking-tight flex items-center gap-1">
                    <MapPin size={12} className="text-white/40" /> {mandi.market_name}
                  </div>
                </td>
                <td className="py-5">
                  <div className="font-black text-white text-xl">₹{isNaN(parsedPrice) ? mandi.modal_price : parsedPrice.toLocaleString()}</div>
                </td>
                <td className="py-5 pr-6 text-right">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-white/60 border border-white/10">
                    <Calendar size={12} /> <span className="text-[10px] font-black tracking-tight">{mandi.arrival_date}</span>
                  </div>
                </td>
              </tr>
            )
          })}
          {filteredRates.length === 0 && (
            <tr>
              <td colSpan={4} className="py-10 text-center text-white/40 font-bold">
                No rates available for {activeCrop}.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="p-4 border-t border-white/5 bg-white/5">
        <p className="text-[10px] text-white/30 font-black uppercase tracking-widest text-center">
          Offline Mode | Loaded Locally from Mock API Array
        </p>
      </div>
    </div>
  )
}
