import { useState, useEffect, useRef } from 'react'
import { GlassCard } from '../../components/GlassCard'
import { Upload, Camera, Search, Leaf } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../core/utils/cn'
import { db } from '../../lib/db'
import { CropSelector } from './CropSelector'
import { PredictionResults } from './PredictionResults'
import { runInference, type PredictionResult } from './inferenceEngine'
import { askAgroGPT } from '../../ai/provider'

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

function WebcamModal({ onClose, onCapture }: { onClose: () => void, onCapture: (dataUrl: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  
  useEffect(() => {
    let stream: MediaStream | null = null

    const startCamera = async () => {
      try {
        // Try to request rear camera first (if available)
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      } catch (err: any) {
        try {
          // Fallback to any available camera (fixes laptop "OverconstrainedError")
          stream = await navigator.mediaDevices.getUserMedia({ video: true })
        } catch (fallbackErr) {
          alert("Camera not available or permission denied. Please click 'Allow' when the browser asks for camera access.")
          onClose()
          return
        }
      }

      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream
      }
    }

    startCamera()
      
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [onClose])
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-black border border-white/20 rounded-2xl overflow-hidden max-w-lg w-full flex flex-col">
        <div className="relative w-full aspect-video bg-black flex items-center justify-center">
           <video ref={videoRef} autoPlay playsInline className="w-full h-auto max-h-[60vh] object-contain" />
           <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
             <div className="w-48 h-64 border-2 border-primary-500/50 rounded-full opacity-60 flex flex-col items-center justify-center relative shadow-[0_0_20px_rgba(76,175,80,0.3)]">
                <div className="w-1 h-full bg-primary-500/30 absolute left-1/2 -translate-x-1/2"></div>
                <span className="text-primary-300 text-xs font-bold bg-black/40 px-2 py-1 rounded absolute bottom-4">Align leaf here</span>
             </div>
           </div>
        </div>
        <div className="p-4 flex gap-4 justify-center bg-black/50">
          <button onClick={onClose} className="px-6 py-2 rounded-xl bg-white/10 text-white font-semibold transition-all hover:bg-white/20">Cancel</button>
          <button onClick={() => {
            if (videoRef.current) {
              const canvas = document.createElement('canvas')
              canvas.width = videoRef.current.videoWidth
              canvas.height = videoRef.current.videoHeight
              const ctx = canvas.getContext('2d')
              if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
                onCapture(canvas.toDataURL('image/jpeg', 0.9))
                onClose()
              }
            }
          }} className="px-6 py-2 rounded-xl bg-primary-600 text-white font-semibold flex items-center gap-2 transition-all hover:bg-primary-500">
             <Camera size={18} /> Capture
          </button>
        </div>
      </div>
    </div>
  )
}


export function FieldVisionPage() {
  const { t } = useTranslation()
  const [selectedCrop, setSelectedCrop] = useState<string>('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [aiRecommendation, setAiRecommendation] = useState<string>('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [showWebcam, setShowWebcam] = useState(false)

  const handleWebcamCapture = (dataUrl: string) => {
    setSelectedImage(dataUrl)
    setResult(null)
    setAiRecommendation('')
    
    const img = new Image()
    img.onload = () => {
      setImageElement(img)
    }
    img.src = dataUrl
  }

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    db.profiles.toArray().then(profiles => {
      if (profiles[0] && profiles[0].primary_crop) {
        setSelectedCrop(profiles[0].primary_crop)
      }
    }).catch(() => {})

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        setSelectedImage(dataUrl)
        setResult(null)
        setAiRecommendation('')
        
        const img = new Image()
        img.onload = () => {
          setImageElement(img)
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(e.target.files[0])
    }
  }

  async function handleAnalyze() {
    if (!selectedImage || !imageElement || !selectedCrop || selectedCrop === 'Other') return

    setAnalyzing(true)
    setResult(null)
    setAiRecommendation('')

    // Slight delay to allow UI to render the scanning animation
    await new Promise(r => setTimeout(r, 800))

    const prediction = await runInference(selectedCrop, imageElement)
    if (!prediction) {
      alert('Model not installed yet or inference failed.')
      setAnalyzing(false)
      return
    }

    setResult(prediction)
    setAnalyzing(false)

    // Save to scan history
    try {
      await db.scans.put({
        id: crypto.randomUUID(),
        crop_type: selectedCrop,
        image_url: selectedImage,
        prediction: prediction.disease,
        confidence: prediction.confidence,
        is_low_confidence: prediction.confidence < 75,
        scanned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    } catch (e) {
      console.error('Failed to save scan', e)
    }
  }

  const handleFeedback = async (isCorrect: boolean) => {
    if (!result) return
    try {
      const scans = await db.scans.orderBy('created_at').reverse().toArray()
      if (scans.length > 0) {
        const lastScan = scans[0]
        await db.scans.update(lastScan.id, { feedback: isCorrect ? 'yes' : 'no' })
      }
    } catch (e) {
      console.error('Failed to save feedback', e)
    }
  }

  const handleGetAIRecommendations = async () => {
    if (!result) return
    setLoadingAi(true)
    const prompt = `I just scanned my ${result.crop} crop using Field Vision and it detected ${result.disease} with ${result.confidence}% confidence. Why did this happen? What are the immediate next steps I should take? How can I prevent it? Please do not perform disease classification, just provide recommendations.`
    try {
      const reply = await askAgroGPT(prompt)
      setAiRecommendation(reply.text)
    } catch (err) {
      setAiRecommendation("Failed to get AI recommendations. Please check your connection.")
    } finally {
      setLoadingAi(false)
    }
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
          <div className="w-full max-w-sm">
            <CropSelector selectedCrop={selectedCrop} onChange={setSelectedCrop} />
          </div>

          {selectedCrop === 'Other' && (
            <div className="w-full max-w-sm mb-6 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 text-sm text-center font-medium">
              Field Vision currently supports only Chili, Cotton, Maize, Rice, and Tomato. More crops coming soon.
            </div>
          )}

          {!selectedImage ? (
            <div className="flex flex-col items-center justify-center text-center w-full">
              <div className="mb-6 grid h-20 w-20 place-items-center rounded-full border border-white/10 bg-white/5">
                <Camera size={32} className="text-white/60" />
              </div>
              <div className="agro-h2 mb-2">Upload Crop Image</div>
              <p className="subtle mb-6 max-w-sm">
                Take a clear photo of the affected leaf or crop area. Good lighting yields better AI results.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                <div className="relative overflow-hidden flex-1 max-w-[200px]">
                  {isMobile && (
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      disabled={!selectedCrop || selectedCrop === 'Other'}
                      className="absolute inset-0 z-50 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => !isMobile && setShowWebcam(true)}
                    disabled={!selectedCrop || selectedCrop === 'Other'}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-stroke-2 bg-primary-700/20 px-6 py-3 font-semibold text-white shadow-glowPrimary transition-all hover:border-stroke-3 hover:bg-primary-700/30 disabled:opacity-50 disabled:shadow-none"
                  >
                    <Camera size={18} />
                    Take Picture
                  </button>
                </div>
                <div className="relative overflow-hidden flex-1 max-w-[200px]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={!selectedCrop || selectedCrop === 'Other'}
                    className="absolute inset-0 z-50 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    disabled={!selectedCrop || selectedCrop === 'Other'}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white transition-all hover:bg-white/10 disabled:opacity-50 disabled:shadow-none"
                  >
                    <Upload size={18} />
                    Upload File
                  </button>
                </div>
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
              
              <div className="mt-4 flex gap-3 flex-wrap sm:flex-nowrap">
                <div className="relative overflow-hidden flex-1 min-w-[120px]">
                  {isMobile && (
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="absolute inset-0 z-50 h-full w-full cursor-pointer opacity-0"
                      disabled={analyzing}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => !isMobile && setShowWebcam(true)}
                    disabled={analyzing}
                    className="w-full inline-flex justify-center items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/80 transition-all hover:bg-white/10 disabled:opacity-50"
                  >
                    <Camera size={16} /> Retake
                  </button>
                </div>
                <div className="relative overflow-hidden flex-1 min-w-[120px]">
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
                    className="w-full inline-flex justify-center items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/80 transition-all hover:bg-white/10 disabled:opacity-50"
                  >
                    <Upload size={16} /> Upload
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analyzing || !!result || selectedCrop === 'Other'}
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
          <GlassCard className="p-6 flex-1 flex flex-col justify-center min-h-[400px]">
            {!result ? (
              <div className="flex flex-col items-center justify-center text-center text-white/40 h-full">
                <Leaf size={48} className="mb-4 opacity-20" />
                <p>Upload an image and run analysis<br/>to see AI results here.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <PredictionResults 
                  crop={result.crop}
                  disease={result.disease}
                  confidence={result.confidence}
                  isOffline={isOffline}
                  onFeedback={handleFeedback}
                  onGetAIRecommendations={handleGetAIRecommendations}
                />

                {loadingAi && (
                  <div className="mt-6 p-4 rounded-xl border border-primary-500/30 bg-primary-900/20 text-primary-300 text-sm animate-pulse">
                    Fetching AI recommendations...
                  </div>
                )}

                {aiRecommendation && (
                  <div className="mt-6 p-4 rounded-xl border border-stroke-3 bg-white/5">
                    <h3 className="text-sm font-bold text-white mb-2">AgroGPT AI Recommendations</h3>
                    <div className="text-sm text-white/80 whitespace-pre-wrap">{aiRecommendation}</div>
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
      
      {showWebcam && (
        <WebcamModal onClose={() => setShowWebcam(false)} onCapture={handleWebcamCapture} />
      )}
    </div>
  )
}

