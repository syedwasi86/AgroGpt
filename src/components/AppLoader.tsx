import { Loader2 } from 'lucide-react'
import { GlassCard } from './GlassCard'

type AppLoaderProps = {
  message?: string
  subMessage?: string
}

export function AppLoader({ message = 'Loading AgroGPT...', subMessage }: AppLoaderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0c0a] relative overflow-hidden px-4">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#87A96B]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#2E7D32]/10 rounded-full blur-[120px] pointer-events-none" />
      
      <GlassCard className="max-w-xs w-full p-8 border-white/5 bg-[#121412]/80 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] rounded-3xl flex flex-col items-center justify-center text-center">
        <Loader2 className="animate-spin text-primary-500 mb-4" size={40} />
        <h2 className="text-white font-bold text-lg mb-2">{message}</h2>
        {subMessage && (
          <p className="text-white/50 text-xs">{subMessage}</p>
        )}
      </GlassCard>
    </div>
  )
}
