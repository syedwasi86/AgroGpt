import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { saveProfile } from '@/features/settings/services/accountService'
import { GlassCard } from '@/components/GlassCard'
import { Save, FlaskConical, Upload, FileText, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '@/core/auth/supabaseClient'
import { updateSoilProfile, initDatabase } from '@/lib/repository'
import { cn } from '@/core/utils/cn'
import Tesseract from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

type ExtractionStatus = 'idle' | 'processing' | 'success' | 'partial' | 'failed'

export function ProfilePage() {
  const profile = useLiveQuery(() => db.profiles.toArray().then(a => a[0]))
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    total_acreage: 0,
    primary_crop: 'Cotton',
    soil_type: 'Red Sandy Loam',
    city: ''
  })

  const [soilData, setSoilData] = useState({
    nitrogen: 0,
    phosphorus: 0,
    potassium: 0
  })

  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload')
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>('idle')
  const [rawOcrText, setRawOcrText] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    async function setup() {
      try {
        await initDatabase()
        const existing = await db.profiles.toArray().then(a => a[0])
        if (!existing) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            const user = session.user
            const isGoogle = user.app_metadata?.provider === 'google'
            const initialData = {
              name: isGoogle ? user.user_metadata?.full_name || '' : '',
              email: user.email || '',
              phone: isGoogle ? '' : user.phone || '',
              total_acreage: 0,
              primary_crop: 'Cotton',
              soil_type: 'Red Sandy Loam',
              city: ''
            }
            setFormData(initialData)
            await saveProfile(initialData)
          }
        }
      } catch (err) {
        console.error('Initialization error:', err)
      }
    }
    void setup()
  }, [])

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        total_acreage: profile.total_acreage || 0,
        primary_crop: profile.primary_crop || 'Cotton',
        soil_type: profile.soil_type || 'Red Sandy Loam',
        city: profile.city || ''
      })
      setSoilData({
        nitrogen: profile.nitrogen || 0,
        phosphorus: profile.phosphorus || 0,
        potassium: profile.potassium || 0
      })
    }
  }, [profile])

  const parseNpkFromText = (text: string) => {
    const nMatch = text.match(/(?:Nitrogen|N)[:\s]+(\d+(?:\.\d+)?)/i)
    const pMatch = text.match(/(?:Phosphorus|P)[:\s]+(\d+(?:\.\d+)?)/i)
    const kMatch = text.match(/(?:Potassium|K)[:\s]+(\d+(?:\.\d+)?)/i)

    return {
      nitrogen: nMatch ? parseFloat(nMatch[1]) : null,
      phosphorus: pMatch ? parseFloat(pMatch[1]) : null,
      potassium: kMatch ? parseFloat(kMatch[1]) : null
    }
  }

  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = error => reject(error)
      reader.readAsDataURL(file)
    })
  }

  const processFile = async (file: File) => {
    setExtractionStatus('processing')
    setErrorMsg(null)
    setRawOcrText('')

    try {
      let imageData: string | null = null

      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 2.0 })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        canvas.height = viewport.height
        canvas.width = viewport.width
        if (context) {
          await page.render({ canvasContext: context, viewport } as any).promise
          imageData = canvas.toDataURL('image/png')
        }
      } else {
        imageData = await fileToDataURL(file)
      }

      if (!imageData) throw new Error('Failed to load file data')

      const result = await Tesseract.recognize(imageData, 'eng')
      const text = result.data.text
      setRawOcrText(text)

      const extracted = parseNpkFromText(text)
      
      if (extracted.nitrogen !== null || extracted.phosphorus !== null || extracted.potassium !== null) {
        setSoilData(prev => ({
          nitrogen: extracted.nitrogen ?? prev.nitrogen,
          phosphorus: extracted.phosphorus ?? prev.phosphorus,
          potassium: extracted.potassium ?? prev.potassium
        }))
        setExtractionStatus(
          (extracted.nitrogen && extracted.phosphorus && extracted.potassium) ? 'success' : 'partial'
        )
      } else {
        setExtractionStatus('failed')
        setErrorMsg("Automatic extraction failed. We couldn't find N-P-K values in the text.")
      }
    } catch (err) {
      console.error('Extraction Error:', err)
      setExtractionStatus('failed')
      setErrorMsg("Error processing file. Please ensure it's a clear image or PDF.")
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void processFile(file)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await saveProfile(formData)
      alert('Profile updated successfully!')
    } catch {
      alert('Failed to save profile. Please check your connection.')
    }
  }

  const handleSaveSoilData = async () => {
    // Production-Grade Validation
    const { nitrogen, phosphorus, potassium } = soilData
    
    if (nitrogen < 0 || nitrogen > 1000 || phosphorus < 0 || phosphorus > 1000 || potassium < 0 || potassium > 1000) {
      alert('Validation Error: Soil nutrient values must be between 0 and 1000 ppm.')
      return
    }

    try {
      if (!profile?.id) {
        alert('No profile found. Please update general information first.')
        return
      }

      await updateSoilProfile({
        id: profile.id,
        nitrogen,
        phosphorus,
        potassium
      })
      alert('Soil N-P-K profile updated!')
      setExtractionStatus('idle')
    } catch {
      alert('Failed to update soil data. Please try again.')
    }
  }

  const inputClass = "w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-stroke-2 disabled:opacity-50"

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <div>
        <h1 className="agro-h1">Farm Profile</h1>
        <p className="subtle mt-2">Manage your identity and soil health data for precise AI recommendations.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Left Column: Personal Info */}
        <div className="lg:col-span-3 space-y-6">
          <GlassCard className="p-6" variant="strong">
            <h2 className="agro-h2 mb-6 flex items-center gap-2">
              <FileText size={20} className="text-secondary" />
              General Information
            </h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">Full Name</label>
                  <input type="text" className={inputClass} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">Email</label>
                  <input type="email" className={inputClass} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">Phone</label>
                  <input type="tel" className={inputClass} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">Total Acreage</label>
                  <input type="number" step="0.1" className={inputClass} value={formData.total_acreage} onChange={e => setFormData({...formData, total_acreage: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">Primary Crop</label>
                  <select className={inputClass} value={formData.primary_crop} onChange={e => setFormData({...formData, primary_crop: e.target.value})}>
                    <option value="Cotton">Cotton</option>
                    <option value="Wheat">Wheat</option>
                    <option value="Rice">Rice</option>
                    <option value="Maize">Maize</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 px-6 py-3.5 text-sm font-bold text-white shadow-glowPrimary hover:bg-primary-500 transition-all active:scale-[0.98]">
                <Save size={18} /> Update Profile
              </button>
            </form>
          </GlassCard>
        </div>

        {/* Right Column: Soil Data */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard className="p-6" variant="strong">
            <h2 className="agro-h2 mb-6 flex items-center gap-2">
              <FlaskConical size={20} className="text-secondary" />
              Soil Health Data
            </h2>

            {/* Tab Switcher */}
            <div className="mb-6 flex rounded-2xl bg-white/5 p-1">
              <button 
                onClick={() => setActiveTab('upload')}
                className={cn("flex-1 rounded-xl py-2 text-xs font-bold transition-all", activeTab === 'upload' ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white/70")}
              >
                Auto-Extract
              </button>
              <button 
                onClick={() => setActiveTab('manual')}
                className={cn("flex-1 rounded-xl py-2 text-xs font-bold transition-all", activeTab === 'manual' ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white/70")}
              >
                Manual Entry
              </button>
            </div>

            {activeTab === 'upload' ? (
              <div className="space-y-4">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "relative flex h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-all",
                    extractionStatus === 'processing' ? "border-secondary/50 bg-secondary/5" : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  )}
                >
                  <input ref={fileInputRef} type="file" accept="image/*, application/pdf" onChange={handleFileUpload} className="hidden" />
                  
                  {extractionStatus === 'processing' ? (
                    <div className="text-center">
                      <Loader2 size={32} className="mx-auto mb-3 animate-spin text-secondary" />
                      <p className="text-sm font-semibold text-white/80">Running AI OCR Analysis...</p>
                      <p className="mt-1 text-[10px] text-white/40">Converting document to digital data</p>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-white/60">
                        <Upload size={24} />
                      </div>
                      <p className="text-sm font-semibold text-white/80">Upload Lab Report</p>
                      <p className="mt-1 text-xs text-white/40">PDF, JPG, PNG supported</p>
                    </div>
                  )}
                </div>

                {extractionStatus === 'success' && (
                  <div className="flex items-center gap-2 rounded-2xl bg-green-500/10 p-3 text-xs text-green-400 border border-green-500/20">
                    <CheckCircle2 size={16} /> Extraction complete! Values updated below.
                  </div>
                )}
                {extractionStatus === 'partial' && (
                  <div className="flex items-center gap-2 rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-400 border border-amber-500/20">
                    <AlertCircle size={16} /> Some values were missing. Please verify.
                  </div>
                )}
                {extractionStatus === 'failed' && (
                  <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 p-3 text-xs text-red-400 border border-red-500/20">
                    <XCircle size={16} className="mt-0.5 shrink-0" /> 
                    <div>
                      <p className="font-bold">Extraction Failed</p>
                      <p className="opacity-80 mt-0.5">{errorMsg}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-white/40 uppercase">Nitrogen (N)</label>
                  <input type="number" className={inputClass} value={soilData.nitrogen} onChange={e => setSoilData({...soilData, nitrogen: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-white/40 uppercase">Phosphorus (P)</label>
                  <input type="number" className={inputClass} value={soilData.phosphorus} onChange={e => setSoilData({...soilData, phosphorus: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-white/40 uppercase">Potassium (K)</label>
                  <input type="number" className={inputClass} value={soilData.potassium} onChange={e => setSoilData({...soilData, potassium: parseFloat(e.target.value) || 0})} />
                </div>
              </div>

              {extractionStatus === 'failed' && rawOcrText && (
                <div className="mt-4 rounded-2xl bg-black/40 p-4 border border-white/5">
                  <p className="mb-2 text-[10px] font-bold text-white/30 uppercase">Raw Detected Text (OCR Fallback)</p>
                  <div className="max-h-32 overflow-y-auto text-[11px] leading-relaxed text-white/60 font-mono italic">
                    "{rawOcrText}"
                  </div>
                </div>
              )}

              <button 
                onClick={handleSaveSoilData}
                disabled={extractionStatus === 'processing'}
                className="w-full rounded-2xl bg-secondary py-3.5 text-sm font-bold text-white shadow-glowSecondary transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                Save Soil Health Data
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
