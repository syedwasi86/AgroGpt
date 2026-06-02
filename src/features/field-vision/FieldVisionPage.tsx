import { useState, useEffect, useRef } from 'react'
import { GlassCard } from '../../components/GlassCard'
import { Upload, Camera, Search, Leaf, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../core/utils/cn'
import { db } from '../../lib/db'
import { CropSelector } from './CropSelector'
import { PredictionResults } from './PredictionResults'
import { runInference, type PredictionResult } from './inferenceEngine'
import { getAIEnhancedRecommendations } from '../../ai/geminiRecommendationService'
import type { DiseaseKnowledgeBaseEntry, SeverityLevel, AIRecommendationResponse } from './types'
import { getUserLocation } from '../../core/utils/geolocation'
import { fetchWeather, getWeatherCondition, type WeatherData } from '../gis/services/weatherService'
import { calculateEnvironmentalRisk } from '../../engine/environmentalRiskEngine'
import { getDiseaseKnowledge } from '../../knowledge-Base/diseaseLookup'

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

function WebcamModal({ onClose, onCapture }: { onClose: () => void, onCapture: (dataUrl: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let stream: MediaStream | null = null

    const startCamera = async () => {
      try {
        // Try to request rear camera first (if available)
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      } catch {
        try {
          // Fallback to any available camera (fixes laptop "OverconstrainedError")
          stream = await navigator.mediaDevices.getUserMedia({ video: true })
        } catch {
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
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendationResponse | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)
  const [showWebcam, setShowWebcam] = useState(false)

  // Weather Caching and Concept States
  const [cachedWeather, setCachedWeather] = useState<WeatherData | null>(null)
  const [environmentalRisk, setEnvironmentalRisk] = useState<SeverityLevel | null>(null)
  const [assessedSeverity, setAssessedSeverity] = useState<SeverityLevel>('low')

  const handleWebcamCapture = (dataUrl: string) => {
    setSelectedImage(dataUrl)
    setResult(null)
    setAiRecommendation(null)
    setCachedWeather(null)
    setEnvironmentalRisk(null)
    setAssessedSeverity('low')

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
    }).catch(() => { })

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
        setAiRecommendation(null)
        setCachedWeather(null)
        setEnvironmentalRisk(null)
        setAssessedSeverity('low')

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
    setAiRecommendation(null)
    setCachedWeather(null)
    setEnvironmentalRisk(null)
    setAssessedSeverity('low')

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

    // BACKGROUND WEATHER FETCH & RISK CALCULATION
    try {
      getUserLocation().then(async (coords) => {
        const weather = await fetchWeather(coords.latitude, coords.longitude)
        setCachedWeather(weather)

        const kbData = await getDiseaseKnowledge(prediction.crop, prediction.disease)
        const risk = calculateEnvironmentalRisk(weather, kbData?.spreadConditions)
        setEnvironmentalRisk(risk)
      }).catch(err => {
        console.warn('Background weather fetch failed:', err)
      })
    } catch (bgErr) {
      console.warn('Background weather sequence failed:', bgErr)
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

  const handleGetAIRecommendations = async (severity: SeverityLevel, kbData: DiseaseKnowledgeBaseEntry | null) => {
    if (!result) return
    setAssessedSeverity(severity)
    setLoadingAi(true)
    setAiRecommendation(null)
    try {
      const profile = await db.profiles.toArray().then(a => a[0])
      const soilType = profile?.soil_type || 'N/A'

      // Use cached weather if available, else fetch it on demand
      let tempC = 'N/A'
      let humidity = 'N/A'

      if (cachedWeather) {
        tempC = String(cachedWeather.temperature)
        humidity = String(cachedWeather.humidity)
      } else {
        try {
          const coords = await getUserLocation()
          const weather = await fetchWeather(coords.latitude, coords.longitude)
          setCachedWeather(weather)
          tempC = String(weather.temperature)
          humidity = String(weather.humidity)

          const risk = calculateEnvironmentalRisk(weather, kbData?.spreadConditions)
          setEnvironmentalRisk(risk)
        } catch (wErr) {
          console.warn('On-demand weather fetch failed:', wErr)
        }
      }

      const reply = await getAIEnhancedRecommendations(
        result.crop,
        result.disease,
        result.confidence,
        severity,
        kbData,
        { soilType, tempC, humidity }
      )
      setAiRecommendation(reply)

      // Update history in background
      try {
        const scans = await db.scans.orderBy('created_at').reverse().toArray()
        if (scans.length > 0) {
          const lastScan = scans[0]
          await db.scans.update(lastScan.id, {
            ai_enhanced: true,
            aiEnhanced: true,
            updated_at: new Date().toISOString()
          })
        }
      } catch (dbErr) {
        console.error('Failed to update IndexedDB Scan Record with AI flag:', dbErr)
      }
    } catch (err) {
      console.error('AI recommendation engine failed:', err)
    } finally {
      setLoadingAi(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="agro-h1">{t('fieldVision.title', 'Field Vision')}</div>
          <p className="subtle mt-2 max-w-2xl">
            {t('fieldVision.desc', 'Upload an image of your crop for instant AI-powered disease and nutrient analysis.')}
          </p>
        </div>
      </div>

      {/* Upload / Preview Area */}
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

      {/* AI Result & Recommendation Interface (Shown below upload box) */}
      {result && (
        <div className="space-y-6">
          <GlassCard className="p-6">
            <PredictionResults
              crop={result.crop}
              disease={result.disease}
              confidence={result.confidence}
              isOffline={isOffline}
              onFeedback={handleFeedback}
              onGetAIRecommendations={handleGetAIRecommendations}
            />
          </GlassCard>

          {/* AI Advisory Card (Presented separately to reinforce trust and explainability) */}
          {(loadingAi || aiRecommendation) && (
            <GlassCard className="p-6 border border-primary-500/30 bg-primary-950/10 shadow-[0_0_20px_rgba(76,175,80,0.15)] animate-in fade-in slide-in-from-bottom-4 duration-500">
              {loadingAi && (
                <div className="flex items-center gap-3 text-primary-300 text-sm justify-center py-6 animate-pulse">
                  <RefreshCw className="animate-spin text-primary-400" size={20} />
                  <span>Consulting AI Agricultural Field Advisor...</span>
                </div>
              )}

              {aiRecommendation && (
                <div className="text-left space-y-6">
                  {/* Title Bar */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <h3 className="text-lg font-bold text-primary-400 flex items-center gap-2">
                      🌱 AI Advisory & Field Insights
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-primary-500/20 text-primary-300 px-2 py-0.5 rounded border border-primary-500/30">
                      Advisory Layer Active
                    </span>
                  </div>

                  <div className="space-y-6 text-sm text-white/90">

                    {/* Concept Badges / Metrics Row (Three Separate Concepts) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
                      {/* 1. Model Confidence */}
                      <div className="flex flex-col items-center text-center p-2.5 rounded-lg bg-black/20 border border-white/5">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1">AI Confidence</span>
                        <span className="text-base font-bold text-primary-300">{result.confidence}%</span>
                      </div>

                      {/* 2. Assessed Field Severity */}
                      <div className="flex flex-col items-center text-center p-2.5 rounded-lg bg-black/20 border border-white/5">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1">Field Severity</span>
                        <span className={cn(
                          "text-base font-bold capitalize",
                          assessedSeverity === 'high' ? "text-red-400" :
                            assessedSeverity === 'medium' ? "text-yellow-400" :
                              "text-green-400"
                        )}>
                          {assessedSeverity}
                        </span>
                      </div>

                      {/* 3. Environmental Spread Risk */}
                      <div className="flex flex-col items-center text-center p-2.5 rounded-lg bg-black/20 border border-white/5">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1">Environmental Spread Risk</span>
                        <span className={cn(
                          "text-base font-bold capitalize",
                          environmentalRisk === 'high' ? "text-red-400" :
                            environmentalRisk === 'medium' ? "text-yellow-400" :
                              "text-green-400"
                        )}>
                          {environmentalRisk || 'Calculating...'}
                        </span>
                      </div>
                    </div>

                    {/* Next 48-Hour Spread Warning */}
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-xs text-red-200">
                      <span className="font-semibold block text-red-400 text-[10px] uppercase tracking-wider mb-1">Next 48-Hour Spread Warning</span>
                      <p className="leading-relaxed font-medium">
                        {aiRecommendation.next48HourRisk}
                      </p>
                    </div>

                    {/* Weather Context Details */}
                    {cachedWeather && (
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-xs text-white/70">
                        <span className="font-semibold block text-white/50 mb-2 uppercase tracking-wider text-[10px]">Weather Context Telemetry</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                          <div className="p-2 rounded bg-black/10">
                            <span className="block text-white/40 mb-0.5">Temp</span>
                            <span className="font-bold text-white text-sm">{cachedWeather.temperature}°C</span>
                          </div>
                          <div className="p-2 rounded bg-black/10">
                            <span className="block text-white/40 mb-0.5">Humidity</span>
                            <span className="font-bold text-white text-sm">{cachedWeather.humidity}%</span>
                          </div>
                          <div className="p-2 rounded bg-black/10">
                            <span className="block text-white/40 mb-0.5">Wind Speed</span>
                            <span className="font-bold text-white text-sm">{cachedWeather.windSpeed} km/h</span>
                          </div>
                          <div className="p-2 rounded bg-black/10">
                            <span className="block text-white/40 mb-0.5">Condition</span>
                            <span className="font-bold text-white text-sm">
                              {getWeatherCondition(cachedWeather.weatherCode)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Concise Advisory Summary */}
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 relative overflow-hidden">
                      <div className="absolute top-0 left-0 h-full w-1 bg-primary-500"></div>
                      <span className="text-xs text-white/40 uppercase tracking-wider font-semibold block mb-1">Advisory Summary</span>
                      <p className="leading-relaxed italic">
                        "{aiRecommendation.summary}"
                      </p>
                    </div>

                    {/* Priority Actions Checklist */}
                    {aiRecommendation.priorityActions && aiRecommendation.priorityActions.length > 0 && (
                      <div className="rounded-xl border border-primary-500/20 bg-primary-950/20 p-5">
                        <h4 className="font-bold text-primary-300 mb-3 text-xs uppercase tracking-wider">Priority Actions</h4>
                        <ul className="space-y-2.5">
                          {aiRecommendation.priorityActions.map((action, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-xs">
                              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-primary-500/30 bg-primary-950 text-[10px] font-bold text-primary-300 mt-0.5">
                                {idx + 1}
                              </span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Extended Details */}
                    <div className="space-y-4 pt-2">
                      {/* Prevention */}
                      {aiRecommendation.preventionTips.length > 0 && (
                        <div>
                          <h4 className="font-bold text-blue-400 mb-1.5 text-xs uppercase tracking-wider">Prevention Tips</h4>
                          <ul className="list-disc pl-5 space-y-1 text-xs leading-relaxed text-white/80">
                            {aiRecommendation.preventionTips.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Weather Risk Note */}
                      {aiRecommendation.weatherRiskNote && (
                        <div className="border-t border-white/5 pt-3 text-xs text-white/60">
                          <span className="font-semibold text-white/40 block mb-0.5 uppercase tracking-wider text-[9px]">Additional Weather-Spread Analysis</span>
                          {aiRecommendation.weatherRiskNote}
                        </div>
                      )}
                    </div>

                    {/* Expert Advice */}
                    {aiRecommendation.expertAdvice && (
                      <div className="border-t border-white/10 pt-4 text-xs text-white/40 italic">
                        {aiRecommendation.expertAdvice}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </GlassCard>
          )}
        </div>
      )}

      {showWebcam && (
        <WebcamModal onClose={() => setShowWebcam(false)} onCapture={handleWebcamCapture} />
      )}
    </div>
  )
}

