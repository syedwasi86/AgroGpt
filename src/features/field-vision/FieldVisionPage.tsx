import { useState } from 'react'
import { GlassCard } from '../../components/GlassCard'
import { Upload, Camera, Search, ShieldAlert, CheckCircle, Activity, ChevronRight, Leaf } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../core/utils/cn'

const MOCK_OUTCOMES = [
  {
    diagnosis: 'Healthy Crop',
    confidence: 98,
    action: 'Continue current irrigation schedule. No action needed.',
    type: 'success' as const
  },
  {
    diagnosis: 'Aphid Infestation Detected',
    confidence: 92,
    action: 'Apply Neem oil spray (5ml/L) in the late evening.',
    type: 'warning' as const
  },
  {
    diagnosis: 'Nitrogen Deficiency',
    confidence: 88,
    action: 'Apply 20kg Urea per acre as a top dressing.',
    type: 'danger' as const
  }
]

export function FieldVisionPage() {
  const { t } = useTranslation()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<typeof MOCK_OUTCOMES[0] | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setSelectedImage(ev.target?.result as string)
        setResult(null) // Reset result if new image is uploaded
      }
      reader.readAsDataURL(e.target.files[0])
    }
  }

  function handleAnalyze() {
    if (!selectedImage) return
    setAnalyzing(true)
    setResult(null)

    // Simulate 3-second AI analysis
    setTimeout(() => {
      const randomOutcome = MOCK_OUTCOMES[Math.floor(Math.random() * MOCK_OUTCOMES.length)]
      setResult(randomOutcome)
      setAnalyzing(false)
    }, 3000)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="agro-h1">{t('fieldVision.title', 'Field Vision')}</div>
          <p className="subtle mt-2 max-w-2xl">
            {t('fieldVision.desc', 'Upload an image of your crop for instant AI-powered disease and nutrient analysis.')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Upload / Preview Area */}
        <GlassCard className="p-6 flex flex-col items-center justify-center min-h-[400px]" variant="strong">
          {!selectedImage ? (
            <div className="flex flex-col items-center justify-center text-center w-full">
              <div className="mb-6 grid h-20 w-20 place-items-center rounded-full border border-white/10 bg-white/5">
                <Camera size={32} className="text-white/60" />
              </div>
              <div className="agro-h2 mb-2">Upload Crop Image</div>
              <p className="subtle mb-6 max-w-sm">
                Take a clear photo of the affected leaf or crop area. Good lighting yields better AI results.
              </p>
              
              <div className="relative overflow-hidden">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 z-50 h-full w-full cursor-pointer opacity-0"
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl border border-stroke-2 bg-primary-700/20 px-6 py-3 font-semibold text-white shadow-glowPrimary transition-all hover:border-stroke-3 hover:bg-primary-700/30"
                >
                  <Upload size={18} />
                  Choose File / Take Photo
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col h-full">
              <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/40 flex items-center justify-center">
                <img 
                  src={selectedImage} 
                  alt="Crop Scan" 
                  className={cn("max-h-[300px] object-contain rounded-xl", analyzing && "opacity-50")}
                />
                
                {/* Simulated Scanning Animation */}
                {analyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="relative mb-4">
                      {/* Pulse effect */}
                      <div className="absolute inset-0 rounded-full bg-primary-500/30 animate-ping"></div>
                      <div className="relative grid h-16 w-16 place-items-center rounded-full bg-primary-500/20 border border-primary-500/50">
                        <Search size={28} className="text-primary-300 animate-pulse" />
                      </div>
                    </div>
                    <div className="text-lg font-bold text-white tracking-wide animate-pulse">
                      Analyzing Crop...
                    </div>
                    <div className="mt-2 text-sm text-primary-300">
                      Running neural network models
                    </div>
                    {/* Scanner line animation */}
                    <div className="absolute left-0 right-0 h-1 bg-primary-400/80 shadow-[0_0_15px_rgba(76,175,80,0.8)] animate-scan-line"></div>
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex gap-3">
                <div className="relative overflow-hidden flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 z-50 h-full w-full cursor-pointer opacity-0"
                    disabled={analyzing}
                  />
                  <button
                    type="button"
                    disabled={analyzing}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/80 transition-all hover:bg-white/10 disabled:opacity-50"
                  >
                    Retake
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analyzing || !!result}
                  className="flex-1 rounded-xl border border-stroke-2 bg-primary-700/20 py-3 text-sm font-bold text-white shadow-glowPrimary transition-all hover:border-stroke-3 hover:bg-primary-700/30 disabled:opacity-50"
                >
                  {result ? 'Analysis Complete' : 'Analyze Image'}
                </button>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Right Column: AI Result Interface */}
        <div className="flex flex-col gap-4">
          <GlassCard className="p-6 flex-1 flex flex-col justify-center">
            {!result ? (
              <div className="flex flex-col items-center justify-center text-center text-white/40 h-full">
                <Leaf size={48} className="mb-4 opacity-20" />
                <p>Upload an image and run analysis<br/>to see AI results here.</p>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "grid h-12 w-12 place-items-center rounded-2xl border shadow-lg",
                      result.type === 'success' ? "border-green-500/30 bg-green-500/10 text-green-400" :
                      result.type === 'warning' ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" :
                      "border-red-500/30 bg-red-500/10 text-red-400"
                    )}>
                      {result.type === 'success' ? <CheckCircle size={24} /> :
                       result.type === 'warning' ? <ShieldAlert size={24} /> :
                       <Activity size={24} />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Diagnosis Result</div>
                      <div className="text-xl font-bold text-white">{result.diagnosis}</div>
                    </div>
                  </div>
                </div>

                <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-medium text-white/70">AI Confidence Score</div>
                    <div className="text-sm font-bold text-white">{result.confidence}%</div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000 ease-out",
                        result.confidence > 90 ? "bg-primary-500" : "bg-yellow-500"
                      )}
                      style={{ width: `${result.confidence}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-stroke-3 bg-secondary/10 p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <CheckCircle size={64} />
                  </div>
                  <div className="text-sm font-semibold text-secondary mb-2 flex items-center gap-2">
                    <ChevronRight size={16} /> Recommended Remedial Action
                  </div>
                  <p className="text-white/90 font-medium leading-relaxed">
                    {result.action}
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    setSelectedImage(null)
                    setResult(null)
                  }}
                  className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/80 transition-all hover:bg-white/10"
                >
                  Scan Another Crop
                </button>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
