import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { useAuth } from '../../core/auth/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../core/auth/supabaseClient'
import { useTranslation } from 'react-i18next'
import { useEnumTranslation } from '../../hooks/useEnumTranslation'
import { convertToAcres } from '../../core/utils/formulas'
import { backgroundSync } from '../../core/api/syncEngine'
import { cropCalendarService } from '../crop-calendar/services/cropCalendarService'
import { cropTemplates } from '../crop-calendar/templates/cropTemplates'
import { cn } from '../../core/utils/cn'
import { GlassCard } from '../../components/GlassCard'
import Tesseract from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'
import {
  User,
  Languages,
  MapPin,
  Compass,
  Layers,
  Droplets,
  Sprout,
  Calendar,
  TrendingUp,
  CheckCircle,
  RefreshCw,
  LogOut,
  Download,
  AlertCircle,
  ChevronDown,
  Globe,
  Settings,
  PlusCircle,
  Loader2,
  FlaskConical,
  Upload,
  XCircle
} from 'lucide-react'

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

type ExtractionStatus = 'idle' | 'processing' | 'success' | 'partial' | 'failed'

const AREA_UNITS = ['Acre', 'Hectare', 'Guntha', 'Cent', 'Bigha', 'Square Meter']
const SOIL_TYPES = ['Red Sandy Loam', 'Black Soil', 'Clayey', 'Loamy', 'Sandy', 'Don\'t Know']
const WATER_SOURCES = ['Borewell', 'Canal', 'Rainfed', 'Open Well', 'Drip Irrigation', 'Sprinkler']
const CROP_CONDITIONS = ['Healthy', 'Average', 'Not Growing Well', 'Pest/Disease Problem', 'Not Sure']

export function ProfilePage() {
  const { t, i18n } = useTranslation(['common', 'profile', 'enums', 'validation'])
  const { tEnum } = useEnumTranslation()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [syncing, setSyncing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── LOCAL DB QUERY LAYERS ─────────────────────────────────────────────────
  const profile = useLiveQuery(async () => {
    if (!user?.id) return null
    return (await db.profiles.get(user.id)) || null
  }, [user])

  const settings = useLiveQuery(async () => {
    return (await db.user_settings.toArray())[0] || null
  })

  // Load corresponding crop plan or fall back to most recently active plan
  const activeCropPlan = useLiveQuery(async () => {
    if (!profile) return null
    if (profile.active_crop_plan_id) {
      const plan = await db.crop_plans.get(profile.active_crop_plan_id)
      if (plan && !plan.deleted_at) return plan
    }
    // Fallback query
    const plans = await db.crop_plans.toArray()
    const activePlans = plans
      .filter(p => !p.deleted_at && p.status === 'active')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return activePlans[0] || null
  }, [profile])

  // ─── UI STATE ─────────────────────────────────────────────────────────────
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [coordsExpanded, setCoordsExpanded] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Modal Visibility States
  const [farmerInfoModal, setFarmerInfoModal] = useState(false)
  const [farmDetailsModal, setFarmDetailsModal] = useState(false)
  const [waterSourcesModal, setWaterSourcesModal] = useState(false)
  const [cropPlanModal, setCropPlanModal] = useState(false)
  const [languageModal, setLanguageModal] = useState(false)
  const [soilNPKModal, setSoilNPKModal] = useState(false)

  // Modal Input Forms States
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')



  const [formFarmName, setFormFarmName] = useState('')
  const [formFarmAreaValue, setFormFarmAreaValue] = useState('')
  const [formFarmAreaUnit, setFormFarmAreaUnit] = useState('Acre')
  const [formSoilType, setFormSoilType] = useState('Red Sandy Loam')

  const [formWaterSources, setFormWaterSources] = useState<string[]>([])

  const [formCropType, setFormCropType] = useState('Cotton')
  const [formVariety, setFormVariety] = useState('Local Variety')
  const [formCropAreaValue, setFormCropAreaValue] = useState('')
  const [formCropAreaUnit, setFormCropAreaUnit] = useState('Acre')
  const [formSowingDate, setFormSowingDate] = useState('')
  const [formStage, setFormStage] = useState('')
  const [formCondition, setFormCondition] = useState('Healthy')

  // Soil NPK specific states
  const [soilTab, setSoilTab] = useState<'upload' | 'manual'>('upload')
  const [formNitrogen, setFormNitrogen] = useState('')
  const [formPhosphorus, setFormPhosphorus] = useState('')
  const [formPotassium, setFormPotassium] = useState('')
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>('idle')
  const [rawOcrText, setRawOcrText] = useState<string>('')
  const [ocrErrorMsg, setOcrErrorMsg] = useState<string | null>(null)



  // ─── INITIALIZE MODAL FORMS ──────────────────────────────────────────────
  const openFarmerInfo = () => {
    setFormName(profile?.display_name || profile?.name || '')
    setFormPhone(profile?.phone || '')
    setFormEmail(user?.email || profile?.email || '')
    setValidationError(null)
    setFarmerInfoModal(true)
  }



  const openFarmDetails = () => {
    setFormFarmName(profile?.farm_name || 'My Farm')
    setFormFarmAreaValue(profile?.farm_area_value !== undefined ? String(profile.farm_area_value) : '')
    setFormFarmAreaUnit(profile?.farm_area_unit || 'Acre')
    setFormSoilType(profile?.soil_type || 'Red Sandy Loam')
    setValidationError(null)
    setFarmDetailsModal(true)
  }

  const openWaterSources = () => {
    setFormWaterSources(profile?.irrigation_sources || [])
    setValidationError(null)
    setWaterSourcesModal(true)
  }

  const openSoilNPK = () => {
    setFormNitrogen(profile?.nitrogen !== undefined ? String(profile.nitrogen) : '0')
    setFormPhosphorus(profile?.phosphorus !== undefined ? String(profile.phosphorus) : '0')
    setFormPotassium(profile?.potassium !== undefined ? String(profile.potassium) : '0')
    setSoilTab('upload')
    setExtractionStatus('idle')
    setRawOcrText('')
    setOcrErrorMsg(null)
    setValidationError(null)
    setSoilNPKModal(true)
  }

  const openCropPlan = () => {
    if (activeCropPlan) {
      setFormCropType(activeCropPlan.crop_type)
      setFormVariety(activeCropPlan.variety)
      setFormCropAreaValue(activeCropPlan.crop_area_value !== undefined ? String(activeCropPlan.crop_area_value) : '')
      setFormCropAreaUnit(activeCropPlan.crop_area_unit || 'Acre')
      setFormSowingDate(activeCropPlan.sowing_date || '')
      setFormStage(activeCropPlan.farmer_selected_stage || '')
      setFormCondition(activeCropPlan.crop_condition || 'Healthy')
    } else {
      setFormCropType('Cotton')
      setFormVariety('Local Variety')
      setFormCropAreaValue('')
      setFormCropAreaUnit('Acre')
      setFormSowingDate(new Date().toISOString().split('T')[0])
      setFormStage('Germination')
      setFormCondition('Healthy')
    }
    setValidationError(null)
    setCropPlanModal(true)
  }

  // ─── WRITE & SAVE HANDLERS ────────────────────────────────────────────────
  const triggerSync = async () => {
    setSyncing(true)
    try {
      await backgroundSync()
    } catch (e) {
      console.warn('[ProfilePage] Silent sync failed:', e)
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveFarmerInfo = async () => {
    if (!profile?.id) return
    if (!formName.trim()) {
      setValidationError(t('validation:nameRequired'))
      return
    }

    try {
      await db.profiles.update(profile.id, {
        name: formName,
        display_name: formName,
        email: formEmail,
        phone: formPhone,
        version: (profile.version || 1) + 1,
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      })
      setFarmerInfoModal(false)
      void triggerSync()
    } catch (err) {
      console.error(err)
      setValidationError(t('validation:error', 'Failed to update farmer info.'))
    }
  }



  const handleSaveFarmDetails = async () => {
    if (!profile?.id) return
    const areaVal = parseFloat(formFarmAreaValue)
    if (isNaN(areaVal) || areaVal <= 0) {
      setValidationError(t('validation:farmSizeError'))
      return
    }

    const acres = convertToAcres(areaVal, formFarmAreaUnit)

    try {
      await db.profiles.update(profile.id, {
        farm_name: formFarmName || 'My Farm',
        farm_area_value: areaVal,
        farm_area_unit: formFarmAreaUnit,
        farm_area_acres: acres,
        total_acreage: acres,
        soil_type: formSoilType,
        version: (profile.version || 1) + 1,
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      })
      setFarmDetailsModal(false)
      void triggerSync()
    } catch (err) {
      console.error(err)
      setValidationError(t('validation:error', 'Failed to save farm details.'))
    }
  }

  const handleSaveWaterSources = async () => {
    if (!profile?.id) return
    if (formWaterSources.length === 0) {
      setValidationError(t('validation:waterRequired'))
      return
    }

    try {
      await db.profiles.update(profile.id, {
        irrigation_sources: formWaterSources,
        version: (profile.version || 1) + 1,
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      })
      setWaterSourcesModal(false)
      void triggerSync()
    } catch (err) {
      console.error(err)
      setValidationError(t('validation:error', 'Failed to update water sources.'))
    }
  }

  const handleSaveSoilNPKData = async () => {
    if (!profile?.id) return
    const n = parseFloat(formNitrogen)
    const p = parseFloat(formPhosphorus)
    const k = parseFloat(formPotassium)

    if (isNaN(n) || n < 0 || n > 1000 || isNaN(p) || p < 0 || p > 1000 || isNaN(k) || k < 0 || k > 1000) {
      setValidationError(t('validation:npkRangeError'))
      return
    }

    try {
      await db.profiles.update(profile.id, {
        nitrogen: n,
        phosphorus: p,
        potassium: k,
        version: (profile.version || 1) + 1,
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      })
      setSoilNPKModal(false)
      void triggerSync()
    } catch (err) {
      console.error(err)
      setValidationError(t('validation:error', 'Failed to save soil health NPK details.'))
    }
  }

  const handleSaveCropPlan = async () => {
    if (!profile?.id) return
    const cropArea = parseFloat(formCropAreaValue)
    if (isNaN(cropArea) || cropArea <= 0) {
      setValidationError(t('validation:cropAreaRequired'))
      return
    }
    if (!formSowingDate) {
      setValidationError(t('validation:sowingDateRequired'))
      return
    }

    const cropAcres = convertToAcres(cropArea, formCropAreaUnit)
    const farmAcres = profile.farm_area_acres || 0

    // Fetch other active plans to evaluate total sum
    const plans = await db.crop_plans.toArray()
    const otherActiveCropsAcres = plans
      .filter(p => !p.deleted_at && p.status === 'active' && p.id !== activeCropPlan?.id)
      .reduce((sum, p) => sum + (p.crop_area_acres || p.area || 0), 0)

    if (cropAcres + otherActiveCropsAcres > farmAcres) {
      setValidationError(
        t('validation:cropAreaExceeds', {
          cropAcres: (cropAcres + otherActiveCropsAcres).toFixed(2),
          farmAcres: farmAcres.toFixed(2)
        })
      )
      return
    }

    try {
      const sowingChanged = activeCropPlan?.sowing_date !== formSowingDate
      const typeChanged = activeCropPlan?.crop_type !== formCropType

      if (activeCropPlan && (sowingChanged || typeChanged)) {
        // Regeneration required: delete old active calendar plan
        await cropCalendarService.deleteCropPlan(activeCropPlan.id)

        // Create new crop plan and calendar schedule
        const newPlanId = await cropCalendarService.initializeCropPlan({
          cropType: formCropType,
          variety: formVariety || cropTemplates[formCropType]?.variety || 'Local Variety',
          sowingDate: formSowingDate,
          area: cropAcres,
          userId: profile.id,
          crop_area_value: cropArea,
          crop_area_unit: formCropAreaUnit,
          crop_area_acres: cropAcres,
          farmer_selected_stage: formStage || undefined,
          crop_condition: formCondition,
          created_by_onboarding: activeCropPlan.created_by_onboarding || false
        })

        await db.profiles.update(profile.id, {
          active_crop_plan_id: newPlanId,
          primary_crop: formCropType,
          updated_at: new Date().toISOString(),
          sync_status: 'pending'
        })
      } else if (activeCropPlan) {
        // Meta field edit only
        await db.crop_plans.update(activeCropPlan.id, {
          variety: formVariety,
          crop_area_value: cropArea,
          crop_area_unit: formCropAreaUnit,
          crop_area_acres: cropAcres,
          area: cropAcres,
          farmer_selected_stage: formStage || undefined,
          crop_condition: formCondition,
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
          version: (activeCropPlan.version || 1) + 1
        })
      } else {
        // Creating first active crop plan
        const newPlanId = await cropCalendarService.initializeCropPlan({
          cropType: formCropType,
          variety: formVariety || cropTemplates[formCropType]?.variety || 'Local Variety',
          sowingDate: formSowingDate,
          area: cropAcres,
          userId: profile.id,
          crop_area_value: cropArea,
          crop_area_unit: formCropAreaUnit,
          crop_area_acres: cropAcres,
          farmer_selected_stage: formStage || undefined,
          crop_condition: formCondition,
          created_by_onboarding: false
        })

        await db.profiles.update(profile.id, {
          active_crop_plan_id: newPlanId,
          primary_crop: formCropType,
          updated_at: new Date().toISOString(),
          sync_status: 'pending'
        })
      }

      setCropPlanModal(false)
      void triggerSync()
    } catch (err) {
      console.error(err)
      setValidationError(t('validation:error', 'Failed to update crop plan calendar.'))
    }
  }



  // ─── NPK OCR LAB EXTRACTION ────────────────────────────────────────────────
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
    setOcrErrorMsg(null)
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        if (extracted.nitrogen !== null) setFormNitrogen(String(extracted.nitrogen))
        if (extracted.phosphorus !== null) setFormPhosphorus(String(extracted.phosphorus))
        if (extracted.potassium !== null) setFormPotassium(String(extracted.potassium))

        setExtractionStatus(
          (extracted.nitrogen !== null && extracted.phosphorus !== null && extracted.potassium !== null) ? 'success' : 'partial'
        )
      } else {
        setExtractionStatus('failed')
        setOcrErrorMsg("Automatic extraction failed. No matching N-P-K patterns found in document text.")
      }
    } catch (err) {
      console.error('OCR Extraction Error:', err)
      setExtractionStatus('failed')
      setOcrErrorMsg("Error analyzing lab report. Please check if the file is clear or insert values manually.")
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void processFile(file)
  }

  // ─── UTILITY SETTINGS & EXPORTS ──────────────────────────────────────────
  const handleExportData = async () => {
    try {
      const exportPayload = {
        profiles: await db.profiles.toArray(),
        crop_plans: await db.crop_plans.toArray(),
        crop_stages: await db.crop_stages.toArray(),
        farm_tasks: await db.farm_tasks.toArray(),
        transactions: await db.transactions.toArray(),
        scans: await db.scans.toArray(),
        user_settings: await db.user_settings.toArray(),
        exported_at: new Date().toISOString()
      }
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `agrogpt_farm_data_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to compile export data file.')
    }
  }

  const changeLanguageDirect = async (lang: string) => {
    if (!profile?.id) return
    try {
      void i18n.changeLanguage(lang)
      await db.profiles.update(profile.id, {
        preferred_language: lang,
        version: (profile.version || 1) + 1,
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      })

      setLanguageModal(false)
      void triggerSync()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteData = async () => {
    if (!user?.id) return
    const confirmed = window.confirm(
      "WARNING: This will permanently delete your account profile, all crop plans, transactions, scans, and weather data from both the cloud database and this local device. This action CANNOT be undone.\n\nAre you sure you want to proceed?"
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id)

      if (error) {
        throw new Error(error.message || 'Database error occurred')
      }

      await Promise.all(db.tables.map(table => table.clear()))
      await signOut()
      navigate('/auth', { replace: true })
    } catch (err: any) {
      console.error('[ProfilePage] Delete account data failed:', err)
      alert(`Error deleting account data: ${err.message || String(err)}`)
      setDeleting(false)
    }
  }

  const inputClass = "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-stroke-2 transition"

  // Format Date cleanly
  const formatDate = (isoStr?: string) => {
    if (!isoStr) return ''
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return isoStr
    return d.toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      numberingSystem: 'latn'
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16 px-4">

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="agro-h1 flex items-center gap-2">
            <Settings size={28} className="text-[#87A96B]" />
            {t('profile:title')}
          </h1>
          <p className="subtle mt-1 text-white/60">
            {t('profile:subtitle')}
          </p>
        </div>
        <button
          onClick={() => triggerSync()}
          disabled={syncing}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10 transition active:scale-[0.98] disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(syncing && "animate-spin text-[#87A96B]")} />
          {syncing ? t('profile:syncing') : t('profile:syncDatabase')}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">

        {/* SECTION 1 — FARMER INFORMATION */}
        <GlassCard className="p-6 flex flex-col justify-between" variant="strong">
          <div>
            <h2 className="agro-h2 mb-4 flex items-center gap-2.5 text-white">
              <User size={20} className="text-[#87A96B]" />
              {t('profile:farmerInformation')}
            </h2>
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/50">{t('profile:name')}</span>
                <span className="font-semibold text-white">{profile?.display_name || profile?.name || t('common:notEntered', 'Not Entered')}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/50">{t('profile:preferredLanguage')}</span>
                <span className="font-semibold text-white">
                  {profile?.preferred_language === 'en' && 'English'}
                  {profile?.preferred_language === 'hi' && 'हिन्दी (Hindi)'}
                  {profile?.preferred_language === 'te' && 'తెలుగు (Telugu)'}
                  {!profile?.preferred_language && t('common:notConfigured', 'Not Configured')}
                </span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-white/50">{t('profile:accountEmail')}</span>
                <span className="font-semibold text-white/80">{user?.email || profile?.email || t('profile:noEmailAssociated', 'No email associated')}</span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={openFarmerInfo} className="flex-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 text-xs font-bold text-white transition active:scale-[0.97]">
              {t('profile:editName')}
            </button>
            <button onClick={() => setLanguageModal(true)} className="flex-1 rounded-xl bg-[#87A96B]/15 hover:bg-[#87A96B]/25 border border-[#87A96B]/20 py-2.5 text-xs font-bold text-[#A8C395] transition active:scale-[0.97]">
              {t('profile:changeLanguage')}
            </button>
          </div>
        </GlassCard>

        {/* SECTION 2 — FARM LOCATION */}
        <GlassCard className="p-6 flex flex-col justify-between" variant="strong">
          <div>
            <h2 className="agro-h2 mb-4 flex items-center gap-2.5 text-white">
              <MapPin size={20} className="text-[#87A96B]" />
              {t('profile:farmLocation')}
            </h2>
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/50">{t('profile:village')}</span>
                <span className="font-semibold text-white">{profile?.village || t('common:notEntered', 'Not Entered')}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/50">{t('profile:district')}</span>
                <span className="font-semibold text-white">{profile?.district || t('common:notEntered', 'Not Entered')}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/50">{t('profile:state')}</span>
                <span className="font-semibold text-white">{profile?.state || t('common:notEntered', 'Not Entered')}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/50">{t('profile:locationLabel')}</span>
                <span className="font-semibold text-white truncate max-w-[200px]" title={profile?.location_label}>{profile?.location_label || t('common:notSet', 'Not Set')}</span>
              </div>

              {/* Coordinates Expandable */}
              <div className="pt-1">
                <button
                  onClick={() => setCoordsExpanded(!coordsExpanded)}
                  className="flex items-center gap-1 text-xs text-[#87A96B] font-bold outline-none hover:opacity-85"
                >
                  <Compass size={13} />
                  {coordsExpanded ? t('profile:hideRawCoordinates') : t('profile:showRawCoordinates')}
                  <ChevronDown size={12} className={cn("transition-transform", coordsExpanded && "rotate-180")} />
                </button>
                {coordsExpanded && (
                  <div className="mt-2 grid grid-cols-2 gap-3 rounded-2xl bg-black/30 border border-white/5 p-3 text-xs text-white/70">
                    <div>
                      <div className="text-white/40 mb-0.5">{t('profile:latitude')}</div>
                      <div className="font-mono text-white">{profile?.latitude !== undefined ? profile.latitude.toFixed(6) : t('common:none', 'None')}</div>
                    </div>
                    <div>
                      <div className="text-white/40 mb-0.5">{t('profile:longitude')}</div>
                      <div className="font-mono text-white">{profile?.longitude !== undefined ? profile.longitude.toFixed(6) : t('common:none', 'None')}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* SECTION 3 — FARM DETAILS */}
        <GlassCard className="p-6 flex flex-col justify-between" variant="strong">
          <div>
            <h2 className="agro-h2 mb-4 flex items-center gap-2.5 text-white">
              <Layers size={20} className="text-[#87A96B]" />
              {t('profile:farmDetails')}
            </h2>
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/50">{t('profile:farmName')}</span>
                <span className="font-semibold text-white">{profile?.farm_name || 'Home Farm'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/50">{t('profile:farmSize')}</span>
                <span className="font-semibold text-white">
                  {profile?.farm_area_value !== undefined
                    ? `${profile.farm_area_value} ${tEnum('areaUnit', profile.farm_area_unit)}`
                    : t('common:notConfigured', 'Not Configured')}
                </span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-white/50">{t('profile:soilType')}</span>
                <span className="font-semibold text-white">{tEnum('soilType', profile?.soil_type || 'Red Sandy Loam')}</span>
              </div>
            </div>
          </div>
          <button onClick={openFarmDetails} className="mt-6 w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 text-xs font-bold text-white transition active:scale-[0.97]">
            {t('profile:editFarmDetails')}
          </button>
        </GlassCard>

        {/* SECTION 4 — WATER SOURCES */}
        <GlassCard className="p-6 flex flex-col justify-between" variant="strong">
          <div>
            <h2 className="agro-h2 mb-4 flex items-center gap-2.5 text-white">
              <Droplets size={20} className="text-[#87A96B]" />
              {t('profile:waterSources')}
            </h2>
            <div className="min-h-[90px]">
              {profile?.irrigation_sources && profile.irrigation_sources.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.irrigation_sources.map(source => (
                    <span
                      key={source}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#87A96B]/15 text-[#A8C395] border border-[#87A96B]/20"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#87A96B]" />
                      {tEnum('waterSource', source)}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/40 italic">{t('profile:noWaterSources', 'No water sources configured yet.')}</div>
              )}
            </div>
          </div>
          <button onClick={openWaterSources} className="mt-6 w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 text-xs font-bold text-white transition active:scale-[0.97]">
            Edit Water Sources
          </button>
        </GlassCard>

        {/* EXTRA SECTION — SOIL HEALTH & NPK DATA */}
        <GlassCard className="p-6 md:col-span-2 flex flex-col justify-between" variant="strong">
          <div>
            <h2 className="agro-h2 mb-4 flex items-center gap-2.5 text-white">
              <FlaskConical size={20} className="text-[#87A96B]" />
              {t('profile:soilNpk')}
            </h2>
            <div className="grid gap-6 sm:grid-cols-3 text-sm">
              <div className="rounded-2xl bg-black/20 border border-white/5 p-4 flex flex-col justify-center">
                <div className="text-xs text-white/40 mb-1 font-bold">{t('profile:nitrogen')} (N)</div>
                <div className="text-xl font-bold text-white">
                  {profile?.nitrogen !== undefined ? `${profile.nitrogen} ppm` : '0 ppm'}
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 border border-white/5 p-4 flex flex-col justify-center">
                <div className="text-xs text-white/40 mb-1 font-bold">{t('profile:phosphorus')} (P)</div>
                <div className="text-xl font-bold text-white">
                  {profile?.phosphorus !== undefined ? `${profile.phosphorus} ppm` : '0 ppm'}
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 border border-white/5 p-4 flex flex-col justify-center">
                <div className="text-xs text-white/40 mb-1 font-bold">{t('profile:potassium')} (K)</div>
                <div className="text-xl font-bold text-white">
                  {profile?.potassium !== undefined ? `${profile.potassium} ppm` : '0 ppm'}
                </div>
              </div>
            </div>
          </div>
          <button onClick={openSoilNPK} className="mt-6 w-full rounded-xl bg-[#87A96B]/15 hover:bg-[#87A96B]/25 border border-[#87A96B]/20 py-2.5 text-xs font-bold text-[#A8C395] transition active:scale-[0.97]">
            {t('profile:updateNPK')}
          </button>
        </GlassCard>

        {/* SECTION 5 — ACTIVE CROP */}
        <GlassCard className="p-6 md:col-span-2 flex flex-col justify-between" variant="strong">
          <div>
            <h2 className="agro-h2 mb-4 flex items-center gap-2.5 text-white">
              <Sprout size={20} className="text-[#87A96B]" />
              {t('profile:activeCropSummary')}
            </h2>

            {activeCropPlan ? (
              <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-5 text-sm">
                <div className="border-r border-white/5 pr-4 flex flex-col justify-center py-2 sm:py-0">
                  <div className="text-white/40 text-xs mb-1 flex items-center gap-1">
                    <Sprout size={13} /> {t('profile:cropName')}
                  </div>
                  <div className="text-base font-bold text-white">{tEnum('cropType', activeCropPlan.crop_type)}</div>
                  <div className="text-[11px] text-white/50 mt-0.5">{t('profile:variety')}: {activeCropPlan.variety === 'Local Variety' ? t('profile:customVariety') : activeCropPlan.variety}</div>
                </div>

                <div className="border-r border-white/5 pr-4 flex flex-col justify-center py-2 sm:py-0">
                  <div className="text-white/40 text-xs mb-1 flex items-center gap-1">
                    <Layers size={13} /> {t('profile:cropArea')}
                  </div>
                  <div className="text-base font-bold text-white">
                    {activeCropPlan.crop_area_value !== undefined
                      ? `${activeCropPlan.crop_area_value} ${tEnum('areaUnit', activeCropPlan.crop_area_unit)}`
                      : `${activeCropPlan.area} ${tEnum('areaUnit', 'Acre')}`}
                  </div>
                  {activeCropPlan.crop_area_acres !== undefined && (
                    <div className="text-[11px] text-white/50 mt-0.5">({activeCropPlan.crop_area_acres.toFixed(2)} {tEnum('areaUnit', 'Acres')})</div>
                  )}
                </div>

                <div className="border-r border-white/5 pr-4 flex flex-col justify-center py-2 sm:py-0">
                  <div className="text-white/40 text-xs mb-1 flex items-center gap-1">
                    <Calendar size={13} /> {t('profile:sowingDate')}
                  </div>
                  <div className="text-base font-bold text-white">{formatDate(activeCropPlan.sowing_date)}</div>
                </div>

                <div className="border-r border-white/5 pr-4 flex flex-col justify-center py-2 sm:py-0">
                  <div className="text-white/40 text-xs mb-1 flex items-center gap-1">
                    <TrendingUp size={13} /> {t('profile:cropStage')}
                  </div>
                  <div className="text-base font-bold text-white flex flex-wrap items-center gap-1.5">
                    <span>{activeCropPlan.farmer_selected_stage ? tEnum('cropStage', activeCropPlan.farmer_selected_stage) : t('cropCalendar:calculatedStage', 'Calculated Stage')}</span>
                    {activeCropPlan.farmer_selected_stage && (
                      <span className="text-[9px] font-black uppercase text-[#87A96B] bg-[#87A96B]/10 px-1.5 py-0.5 rounded border border-[#87A96B]/20">
                        {t('cropCalendar:farmerSelectedNotice', 'Farmer Selected')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-center py-2 sm:py-0">
                  <div className="text-white/40 text-xs mb-1 flex items-center gap-1">
                    <CheckCircle size={13} /> {t('profile:cropCondition')}
                  </div>
                  <span className={cn(
                    "text-base font-black uppercase",
                    activeCropPlan.crop_condition === 'Healthy' && "text-green-400",
                    activeCropPlan.crop_condition === 'Average' && "text-yellow-400",
                    activeCropPlan.crop_condition === 'Not Growing Well' && "text-orange-400",
                    activeCropPlan.crop_condition === 'Pest/Disease Problem' && "text-red-400",
                    activeCropPlan.crop_condition === 'Not Sure' && "text-white/60"
                  )}>
                    {tEnum('cropCondition', activeCropPlan.crop_condition || 'Healthy')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center border border-white/5 bg-black/20 rounded-2xl py-8 text-center">
                <AlertCircle size={28} className="text-white/30 mb-2" />
                <div className="text-sm font-semibold text-white/80">{t('profile:noCropAddedYet', 'No crop added yet.')}</div>
                <p className="text-xs text-white/40 mt-1 mb-4">{t('profile:noCropAddedYetDesc', 'Set up your first active crop schedule to track calendar guidelines.')}</p>
                <button
                  onClick={openCropPlan}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#87A96B] hover:bg-[#87A96B]/90 px-4 py-2 text-xs font-bold text-white transition active:scale-[0.98]"
                >
                  <PlusCircle size={14} /> {t('profile:addActiveCrop')}
                </button>
              </div>
            )}
          </div>
          {activeCropPlan && (
            <button onClick={openCropPlan} className="mt-6 w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 text-xs font-bold text-white transition active:scale-[0.97]">
              {t('profile:editActiveCrop')}
            </button>
          )}
        </GlassCard>

        {/* SECTION 6 — ACCOUNT STATUS */}
        <GlassCard className="p-6 md:col-span-2" variant="strong">
          <h2 className="agro-h2 mb-4 flex items-center gap-2.5 text-white">
            <CheckCircle size={20} className="text-[#87A96B]" />
            {t('profile:account')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-3 text-sm">

            <div className="rounded-2xl bg-black/20 border border-white/5 p-4 flex flex-col justify-center">
              <div className="text-xs text-white/40 mb-1">{t('profile:profileCompletionDate', 'Profile Completion Date')}</div>
              <div className="text-base font-bold text-white">
                {profile?.profile_completed_at ? formatDate(profile.profile_completed_at) : t('common:incomplete', 'Incomplete')}
              </div>
            </div>

            <div className="rounded-2xl bg-black/20 border border-white/5 p-4 flex flex-col justify-center">
              <div className="text-xs text-white/40 mb-1">{t('profile:lastSyncTime')}</div>
              <div className="text-base font-bold text-white">
                {settings?.last_sync && new Date(settings.last_sync).getTime() > 0
                  ? formatDate(settings.last_sync)
                  : t('profile:neverSynced')}
              </div>
            </div>

            <div className="rounded-2xl bg-black/20 border border-white/5 p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-white/40 mb-1">{t('profile:syncStatus')}</div>
                <div className="text-sm font-bold text-white capitalize">
                  {profile?.sync_status || 'Synced'}
                </div>
              </div>
              <span className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold border",
                (profile?.sync_status === 'synced' || !profile?.sync_status) && "bg-green-500/10 text-green-400 border-green-500/20",
                profile?.sync_status === 'pending' && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                profile?.sync_status === 'failed' && "bg-red-500/10 text-red-400 border-red-500/20"
              )}>
                {(profile?.sync_status === 'synced' || !profile?.sync_status) && t('profile:syncSuccess')}
                {profile?.sync_status === 'pending' && t('common:pending', 'Pending')}
                {profile?.sync_status === 'failed' && t('profile:syncFailed')}
              </span>
            </div>

          </div>
        </GlassCard>

        {/* SECTION 7 — QUICK ACTIONS */}
        <GlassCard className="p-6 md:col-span-2" variant="strong">
          <h2 className="agro-h2 mb-4 flex items-center gap-2.5 text-white">
            <Globe size={20} className="text-[#87A96B]" />
            {t('profile:quickActions', 'Quick Actions')}
          </h2>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">

            <button onClick={openFarmerInfo} className="group rounded-2xl bg-black/20 border border-white/5 p-4 flex flex-col items-center justify-center text-center transition hover:bg-black/30 hover:border-white/10 active:scale-[0.97]">
              <User size={20} className="text-[#87A96B] mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-white">{t('profile:editName')}</div>
            </button>

            <button onClick={openCropPlan} className="group rounded-2xl bg-black/20 border border-white/5 p-4 flex flex-col items-center justify-center text-center transition hover:bg-black/30 hover:border-white/10 active:scale-[0.97]">
              <Sprout size={20} className="text-[#87A96B] mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-white">{t('profile:editActiveCrop')}</div>
            </button>

            <button onClick={handleExportData} className="group rounded-2xl bg-black/20 border border-white/5 p-4 flex flex-col items-center justify-center text-center transition hover:bg-black/30 hover:border-white/10 active:scale-[0.97]">
              <Download size={20} className="text-[#87A96B] mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-white">{t('profile:exportFarmData', 'Export Farm Data')}</div>
            </button>

            <button onClick={() => setLanguageModal(true)} className="group rounded-2xl bg-black/20 border border-white/5 p-4 flex flex-col items-center justify-center text-center transition hover:bg-black/30 hover:border-white/10 active:scale-[0.97]">
              <Languages size={20} className="text-[#87A96B] mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-white">{t('profile:changeLanguage')}</div>
            </button>

            <button onClick={() => signOut()} className="col-span-2 sm:col-span-1 group rounded-2xl bg-red-500/10 border border-red-500/10 p-4 flex flex-col items-center justify-center text-center transition hover:bg-red-500/20 hover:border-red-500/20 active:scale-[0.97]">
              <LogOut size={20} className="text-red-400 mb-2 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-bold text-red-400">{t('common:logout')}</div>
            </button>

          </div>
        </GlassCard>

        {/* SECTION 8 — DANGER ZONE */}
        <GlassCard className="p-6 md:col-span-2 border border-red-500/20 bg-red-500/[0.02]" variant="strong">
          <h2 className="agro-h2 mb-4 flex items-center gap-2.5 text-red-400">
            <AlertCircle size={20} className="text-red-400" />
            {t('profile:dangerZone', 'Danger Zone')}
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{t('profile:deleteAllMyData', 'Delete All My Data')}</p>
              <p className="text-xs text-white/50 mt-1">
                {t('profile:deleteDataDesc', 'Permanently delete your profile, crop plans, transactions, scans, and all other data from our server and your local device. This action is irreversible.')}
              </p>
            </div>
            <button
              onClick={handleDeleteData}
              disabled={deleting}
              className="shrink-0 rounded-2xl bg-red-500/10 border border-red-500/10 px-5 py-2.5 text-xs font-bold text-red-400 transition hover:bg-red-500/20 active:scale-[0.97] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {deleting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> {t('common:deleting', 'Deleting...')}
                </>
              ) : (
                t('profile:deleteAllMyData', 'Delete All My Data')
              )}
            </button>
          </div>
        </GlassCard>

      </div>

      {/* ─── MODALS DIALOG LAYERS ─────────────────────────────────────────────── */}

      {/* 1. Farmer Info Modal */}
      {farmerInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <User size={18} className="text-[#87A96B]" /> {t('profile:editFarmerInfo', 'Edit Farmer Information')}
            </h3>
            {validationError && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                <AlertCircle size={14} className="shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">{t('profile:name')}</label>
                <input type="text" className={inputClass} value={formName} onChange={e => setFormName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">{t('profile:phoneLabel')}</label>
                <input type="tel" className={inputClass} value={formPhone} onChange={e => setFormPhone(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">{t('profile:accountEmail')}</label>
                <input type="email" className={inputClass} value={formEmail} onChange={e => setFormEmail(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setFarmerInfoModal(false)} className="rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]">
                {t('common:cancel')}
              </button>
              <button onClick={handleSaveFarmerInfo} className="rounded-2xl bg-[#87A96B] hover:bg-[#87A96B]/90 px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]">
                {t('common:saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* 3. Farm Details Modal */}
      {farmDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Layers size={18} className="text-[#87A96B]" /> {t('profile:editFarmDetails')}
            </h3>
            {validationError && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                <AlertCircle size={14} className="shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">{t('profile:farmName')}</label>
                <input type="text" className={inputClass} value={formFarmName} onChange={e => setFormFarmName(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">{t('profile:farmSize')}</label>
                  <input type="number" step="0.01" className={inputClass} value={formFarmAreaValue} onChange={e => setFormFarmAreaValue(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">{t('onboarding.unit', 'Unit')}</label>
                  <div className="relative">
                    <select className={inputClass} value={formFarmAreaUnit} onChange={e => setFormFarmAreaUnit(e.target.value)}>
                      {AREA_UNITS.map(u => (
                        <option key={u} className="bg-zinc-800" value={u}>{tEnum('areaUnit', u)}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-4 text-white/50 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">{t('profile:soilType')}</label>
                <div className="relative">
                  <select className={inputClass} value={formSoilType} onChange={e => setFormSoilType(e.target.value)}>
                    {SOIL_TYPES.map(s => (
                      <option key={s} className="bg-zinc-800" value={s}>{tEnum('soilType', s)}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-4 text-white/50 pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setFarmDetailsModal(false)} className="rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]">
                {t('common:cancel')}
              </button>
              <button onClick={handleSaveFarmDetails} className="rounded-2xl bg-[#87A96B] hover:bg-[#87A96B]/90 px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]">
                {t('common:saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Water Sources Modal */}
      {waterSourcesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Droplets size={18} className="text-[#87A96B]" /> {t('profile:editWaterSources')}
            </h3>
            {validationError && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                <AlertCircle size={14} className="shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {WATER_SOURCES.map(source => {
                const selected = formWaterSources.includes(source)
                return (
                  <button
                    key={source}
                    onClick={() => {
                      setFormWaterSources(prev =>
                        prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
                      )
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition text-left",
                      selected
                        ? "bg-[#87A96B]/15 border-[#87A96B]/50 text-white"
                        : "bg-black/20 border-white/5 text-white/50 hover:bg-black/35 hover:text-white/80"
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", selected ? "bg-[#87A96B]" : "bg-white/20")} />
                    {tEnum('waterSource', source)}
                  </button>
                )
              })}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setWaterSourcesModal(false)} className="rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]">
                {t('common:cancel')}
              </button>
              <button onClick={handleSaveWaterSources} className="rounded-2xl bg-[#87A96B] hover:bg-[#87A96B]/90 px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]">
                {t('common:saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOIL HEALTH & NPK UPDATE MODAL (Auto-Extract + Manual Entry) */}
      {soilNPKModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FlaskConical size={18} className="text-[#87A96B]" /> {t('profile:updateNPK')}
            </h3>

            {validationError && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                <AlertCircle size={14} className="shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Tab Switcher */}
            <div className="mb-6 flex rounded-2xl bg-white/5 p-1">
              <button
                onClick={() => setSoilTab('upload')}
                className={cn("flex-1 rounded-xl py-2 text-xs font-bold transition-all", soilTab === 'upload' ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white/70")}
              >
                {t('profile:autoExtract')}
              </button>
              <button
                onClick={() => setSoilTab('manual')}
                className={cn("flex-1 rounded-xl py-2 text-xs font-bold transition-all", soilTab === 'manual' ? "bg-white/10 text-white shadow-lg" : "text-white/40 hover:text-white/70")}
              >
                {t('profile:manualEntry')}
              </button>
            </div>

            {soilTab === 'upload' ? (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "relative flex h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-all",
                    extractionStatus === 'processing' ? "border-[#87A96B]/50 bg-[#87A96B]/5" : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  )}
                >
                  <input ref={fileInputRef} type="file" accept="image/*, application/pdf" onChange={handleFileUpload} className="hidden" />

                  {extractionStatus === 'processing' ? (
                    <div className="text-center">
                      <Loader2 size={32} className="mx-auto mb-3 animate-spin text-[#87A96B]" />
                      <p className="text-sm font-semibold text-white/80">{t('profile:runningOcr')}</p>
                      <p className="mt-1 text-[10px] text-white/40 font-mono">{t('profile:convertingOcr')}</p>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-white/60">
                        <Upload size={24} />
                      </div>
                      <p className="text-sm font-semibold text-white/80">{t('profile:uploadLabReport')}</p>
                      <p className="mt-1 text-xs text-white/40">{t('profile:supportedFormats')}</p>
                    </div>
                  )}
                </div>

                {extractionStatus === 'success' && (
                  <div className="flex items-center gap-2 rounded-2xl bg-green-500/10 p-3 text-xs text-green-400 border border-green-500/20">
                    <CheckCircle size={16} /> {t('profile:ocrSuccess')}
                  </div>
                )}
                {extractionStatus === 'partial' && (
                  <div className="flex items-center gap-2 rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-400 border border-amber-500/20">
                    <AlertCircle size={16} /> {t('profile:ocrPartial')}
                  </div>
                )}
                {extractionStatus === 'failed' && (
                  <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 p-3 text-xs text-red-400 border border-red-500/20">
                    <XCircle size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold">{t('profile:ocrFailed')}</p>
                      <p className="opacity-80 mt-0.5">{ocrErrorMsg}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Inputs Section */}
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-white/40 uppercase">{t('profile:nitrogen')} (N)</label>
                  <input type="number" className={inputClass} value={formNitrogen} onChange={e => setFormNitrogen(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-white/40 uppercase">{t('profile:phosphorus')} (P)</label>
                  <input type="number" className={inputClass} value={formPhosphorus} onChange={e => setFormPhosphorus(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-white/40 uppercase">{t('profile:potassium')} (K)</label>
                  <input type="number" className={inputClass} value={formPotassium} onChange={e => setFormPotassium(e.target.value)} />
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
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setSoilNPKModal(false)} className="rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]">
                {t('common:cancel')}
              </button>
              <button onClick={handleSaveSoilNPKData} className="rounded-2xl bg-[#87A96B] hover:bg-[#87A96B]/90 px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]">
                {t('profile:saveSoilData', 'Save Soil Data')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Crop Plan Modal (Add / Edit) */}
      {cropPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sprout size={18} className="text-[#87A96B]" />
              {activeCropPlan ? t('profile:editActiveCropDetails', 'Edit Active Crop Details') : t('profile:addActiveCrop', 'Add Active Crop')}
            </h3>
            {validationError && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                <AlertCircle size={14} className="shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">{t('profile:cropName', 'Crop')}</label>
                <div className="relative">
                  <select className={inputClass} value={formCropType} onChange={e => setFormCropType(e.target.value)}>
                    {Object.keys(cropTemplates).map(c => (
                      <option key={c} className="bg-zinc-800" value={c}>{tEnum('cropType', c)}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-4 text-white/50 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">{t('profile:variety', 'Variety')}</label>
                <input type="text" className={inputClass} value={formVariety} onChange={e => setFormVariety(e.target.value)} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">{t('profile:cropArea', 'Crop Area')}</label>
                  <input type="number" step="0.01" className={inputClass} value={formCropAreaValue} onChange={e => setFormCropAreaValue(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">{t('profile:unit', 'Unit')}</label>
                  <div className="relative">
                    <select className={inputClass} value={formCropAreaUnit} onChange={e => setFormCropAreaUnit(e.target.value)}>
                      {AREA_UNITS.map(u => (
                        <option key={u} className="bg-zinc-800" value={u}>{tEnum('areaUnit', u)}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-4 text-white/50 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">{t('profile:sowingDate', 'Sowing Date')}</label>
                <input type="date" className={inputClass} value={formSowingDate} onChange={e => setFormSowingDate(e.target.value)} />
                {activeCropPlan && (
                  <div className="mt-1 text-[10px] text-amber-400">
                    {t('profile:sowingDateWarning', '* Changing the sowing date or crop type will regenerate your calendar recommendations.')}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">{t('profile:cropStageFarmerSelected', 'Crop Stage (Farmer Selected)')}</label>
                <div className="relative">
                  <select className={inputClass} value={formStage} onChange={e => setFormStage(e.target.value)}>
                    <option value="" className="bg-zinc-800">{t('profile:clearOverride', 'Clear Override (Use System Calculation)')}</option>
                    {(
                      (cropTemplates[formCropType]?.stages || []).map(s => typeof s === 'object' ? s.name : s).length > 0
                        ? (cropTemplates[formCropType]?.stages || []).map(s => typeof s === 'object' ? s.name : s)
                        : ['Germination', 'Vegetative', 'Flowering', 'Harvesting']
                    ).map(name => (
                      <option key={name} className="bg-zinc-800" value={name}>{tEnum('cropStage', name)}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-4 text-white/50 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">{t('profile:cropCondition', 'Crop Condition')}</label>
                <div className="relative">
                  <select className={inputClass} value={formCondition} onChange={e => setFormCondition(e.target.value)}>
                    {CROP_CONDITIONS.map(cond => (
                      <option key={cond} className="bg-zinc-800" value={cond}>{tEnum('cropCondition', cond)}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-4 text-white/50 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setCropPlanModal(false)} className="rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]">
                {t('common:cancel')}
              </button>
              <button onClick={handleSaveCropPlan} className="rounded-2xl bg-[#87A96B] hover:bg-[#87A96B]/90 px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]">
                {t('profile:saveCropDetails', 'Save Crop details')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Change Language Modal */}
      {languageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Languages size={18} className="text-[#87A96B]" /> {t('profile:languageSettings', 'Language Settings')}
            </h3>

            <div className="space-y-2">
              <button
                onClick={() => changeLanguageDirect('en')}
                className={cn(
                  "w-full flex items-center justify-between rounded-2xl border p-4 text-sm font-semibold transition text-left",
                  i18n.language === 'en'
                    ? "bg-[#87A96B]/15 border-[#87A96B]/50 text-white"
                    : "bg-black/20 border-white/5 text-white/50 hover:bg-black/35 hover:text-white/80"
                )}
              >
                <span>English</span>
                {i18n.language === 'en' && <CheckCircle size={16} className="text-[#87A96B]" />}
              </button>

              <button
                onClick={() => changeLanguageDirect('hi')}
                className={cn(
                  "w-full flex items-center justify-between rounded-2xl border p-4 text-sm font-semibold transition text-left",
                  i18n.language === 'hi'
                    ? "bg-[#87A96B]/15 border-[#87A96B]/50 text-white"
                    : "bg-black/20 border-white/5 text-white/50 hover:bg-black/35 hover:text-white/80"
                )}
              >
                <span>हिन्दी (Hindi)</span>
                {i18n.language === 'hi' && <CheckCircle size={16} className="text-[#87A96B]" />}
              </button>

              <button
                onClick={() => changeLanguageDirect('te')}
                className={cn(
                  "w-full flex items-center justify-between rounded-2xl border p-4 text-sm font-semibold transition text-left",
                  i18n.language === 'te'
                    ? "bg-[#87A96B]/15 border-[#87A96B]/50 text-white"
                    : "bg-black/20 border-white/5 text-white/50 hover:bg-black/35 hover:text-white/80"
                )}
              >
                <span>తెలుగు (Telugu)</span>
                {i18n.language === 'te' && <CheckCircle size={16} className="text-[#87A96B]" />}
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setLanguageModal(false)} className="rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]">
                {t('common:close')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
