import { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { useAuth } from '../../core/auth/AuthContext'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router-dom'
import { GlassCard } from '../../components/GlassCard'
import { cropTemplates } from '../crop-calendar/templates/cropTemplates'
import { cropCalendarService } from '../crop-calendar/services/cropCalendarService'
import { convertToAcres } from '../../core/utils/formulas'
import { backgroundSync } from '../../core/api/syncEngine'
import { useEnumTranslation } from '../../hooks/useEnumTranslation'
import {
  Languages,
  User,
  MapPin,
  Compass,
  Layers,
  FlaskConical,
  Droplets,
  Sprout,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Check,
  HelpCircle,
  TrendingUp
} from 'lucide-react'

const AREA_UNITS = ['Acre', 'Hectare', 'Guntha', 'Cent', 'Bigha', 'Square Meter']

export function OnboardingPage() {
  const { t, i18n } = useTranslation(['common', 'profile', 'enums', 'validation'])
  const { tEnum } = useEnumTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Step state (1 to 12)
  const [step, setStep] = useState(1)

  // DB Profile Check
  const profile = useLiveQuery(async () => {
    if (!user?.id) return null
    return (await db.profiles.get(user.id)) || null
  }, [user])

  // Profile fields state
  const [prefLang, setPrefLang] = useState('en')
  const [farmerName, setFarmerName] = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [latitude, setLatitude] = useState<number | undefined>(undefined)
  const [longitude, setLongitude] = useState<number | undefined>(undefined)
  const [stateName, setStateName] = useState('')
  const [districtName, setDistrictName] = useState('')
  const [villageName, setVillageName] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  
  const [farmName, setFarmName] = useState('')
  const [farmAreaValue, setFarmAreaValue] = useState('')
  const [farmAreaUnit, setFarmAreaUnit] = useState('Acre')
  const [soilType, setSoilType] = useState('')
  const [selectedWaterSources, setSelectedWaterSources] = useState<string[]>([])

  // Crop fields state
  const [selectedCrop, setSelectedCrop] = useState('Cotton')
  const [customCropName, setCustomCropName] = useState('')
  const [cropAreaValue, setCropAreaValue] = useState('')
  const [cropAreaUnit, setCropAreaUnit] = useState('Acre')
  const [sowingDate, setSowingDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedStage, setSelectedStage] = useState('')
  const [cropCondition, setCropCondition] = useState('Healthy')

  // Validation warning state
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Initialize fields from auth/Google metadata when loaded
  useEffect(() => {
    if (user) {
      const gName = user.user_metadata?.full_name || ''
      if (gName && !farmerName) {
        setFarmerName(gName)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Set default stage when crop type changes
  useEffect(() => {
    const template = cropTemplates[selectedCrop]
    if (template && template.stages.length > 0) {
      setSelectedStage(template.stages[0].name)
    } else {
      setSelectedStage('Germination')
    }
  }, [selectedCrop])

  // Normalized farm area calculation
  const farmAreaInAcres = useMemo(() => {
    const val = parseFloat(farmAreaValue)
    if (isNaN(val) || val <= 0) return 0
    return convertToAcres(val, farmAreaUnit)
  }, [farmAreaValue, farmAreaUnit])

  // Normalized crop area calculation
  const cropAreaInAcres = useMemo(() => {
    const val = parseFloat(cropAreaValue)
    if (isNaN(val) || val <= 0) return 0
    return convertToAcres(val, cropAreaUnit)
  }, [cropAreaValue, cropAreaUnit])

  // Dynanmic crop stages based on selected crop template
  const availableStages = useMemo(() => {
    const template = cropTemplates[selectedCrop]
    if (template) {
      return template.stages.map(s => s.name)
    }
    // Fallback standard crop stages
    return ['Germination', 'Vegetative', 'Flowering', 'Maturity', 'Harvest']
  }, [selectedCrop])

  // Handle GPS location lookup
  const handleGPSLocation = () => {
    setGpsLoading(true)
    setGpsError(null)

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.')
      setGpsLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setLatitude(lat)
        setLongitude(lng)
        setGpsLoading(false)
        setGpsError(null)

        // Form default label
        const label = `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
        setLocationLabel(label)

        // Attempt reverse geocoding if online
        if (navigator.onLine) {
          try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            const res = await fetch(url, { headers: { Accept: 'application/json' } })
            if (res.ok) {
              const data = await res.json()
              const state = data.address?.state || ''
              const district = data.address?.state_district || data.address?.county || ''
              const village = data.address?.village || data.address?.town || data.address?.city || ''
              
              if (state) setStateName(state)
              if (district) setDistrictName(district)
              if (village) setVillageName(village)

              const friendlyLabel = [village, district, state].filter(Boolean).join(', ')
              if (friendlyLabel) {
                setLocationLabel(friendlyLabel)
              }
            }
          } catch (e) {
            console.warn('Reverse geocoding failed, falling back to raw coordinates:', e)
          }
        }
      },
      (err) => {
        console.warn('GPS permission denied or timeout:', err)
        setGpsError('Unable to retrieve coordinates. Please select manually.')
        setGpsLoading(false)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    )
  }

  // Toggle water source selections
  const toggleWaterSource = (source: string) => {
    setSelectedWaterSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    )
  }

  // Validate current step before advancing
  const handleNextStep = () => {
    setValidationError(null)

    if (step === 1) {
      // Language Selection
      if (!prefLang) {
        setValidationError(t('validation:languageRequired'))
        return
      }
      // Apply i18n language change immediately
      void i18n.changeLanguage(prefLang)
      setStep(2)
    } 
    else if (step === 2) {
      // Farmer Name
      if (!farmerName.trim()) {
        setValidationError(t('validation:nameRequired'))
        return
      }
      setStep(3)
    } 
    else if (step === 3) {
      // Location
      const hasGPS = latitude !== undefined && longitude !== undefined
      const hasManual = stateName.trim() !== '' && districtName.trim() !== '' && villageName.trim() !== ''
      if (!hasGPS && !hasManual) {
        setValidationError(t('validation:gpsError'))
        return
      }
      // Construct location label if not already set or updated manually
      if (!locationLabel) {
        const manualLabel = [villageName, districtName, stateName].filter(Boolean).join(', ')
        setLocationLabel(manualLabel || 'My Farm Location')
      }
      setStep(4)
    } 
    else if (step === 4) {
      // Farm Name (Optional)
      setStep(5)
    } 
    else if (step === 5) {
      // Farm Size
      const val = parseFloat(farmAreaValue)
      if (isNaN(val) || val <= 0) {
        setValidationError(t('validation:farmSizeError'))
        return
      }
      setStep(6)
    } 
    else if (step === 6) {
      // Soil Type
      if (!soilType) {
        setValidationError(t('validation:soilRequired'))
        return
      }
      setStep(7)
    } 
    else if (step === 7) {
      // Water Source
      if (selectedWaterSources.length === 0) {
        setValidationError(t('validation:waterRequired'))
        return
      }
      // Profile completion write triggered after completing step 7
      void saveMandatoryProfile()
    } 
    else if (step === 8) {
      // Crop Selection
      if (selectedCrop === 'Custom' && !customCropName.trim()) {
        setValidationError(t('validation:cropNameRequired'))
        return
      }
      setStep(9)
    } 
    else if (step === 9) {
      // Crop Area
      const val = parseFloat(cropAreaValue)
      if (isNaN(val) || val <= 0) {
        setValidationError(t('validation:cropAreaRequired'))
        return
      }
      // Area validation: crop area must be <= farm area
      if (cropAreaInAcres > farmAreaInAcres) {
        setValidationError(
          t('validation:cropAreaExceeds', {
            cropAcres: cropAreaInAcres.toFixed(2),
            farmAcres: farmAreaInAcres.toFixed(2)
          })
        )
        return
      }
      setStep(10)
    } 
    else if (step === 10) {
      // Sowing Date
      if (!sowingDate) {
        setValidationError(t('validation:sowingDateRequired'))
        return
      }
      setStep(11)
    } 
    else if (step === 11) {
      // Stage
      if (!selectedStage) {
        setValidationError(t('validation:cropStageRequired', 'Please select a crop stage.'))
        return
      }
      setStep(12)
    } 
    else if (step === 12) {
      // Crop Condition
      void finishCropSetup()
    }
  }

  // Handle profile save (Mandatory Steps Complete)
  const saveMandatoryProfile = async () => {
    if (!user?.id) return
    setSaving(true)

    try {
      const nowStr = new Date().toISOString()
      const constructedLabel = locationLabel || [villageName, districtName, stateName].filter(Boolean).join(', ') || 'My Farm Location'

      const profileData = {
        id: user.id,
        name: farmerName,
        display_name: farmerName,
        preferred_language: prefLang,
        email: user.email || '',
        phone: user.phone || '',
        city: villageName || districtName || '',
        primary_crop: '',
        farm_name: farmName || 'My Farm',
        farm_area_value: parseFloat(farmAreaValue),
        farm_area_unit: farmAreaUnit,
        farm_area_acres: farmAreaInAcres,
        total_acreage: farmAreaInAcres, // Align for backward compatibility
        soil_type: soilType,
        irrigation_sources: selectedWaterSources,
        state: stateName || undefined,
        district: districtName || undefined,
        village: villageName || undefined,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        location_label: constructedLabel,
        onboarding_completed: true, // Mandatory setup is complete
        profile_completed_at: nowStr,
        created_at: nowStr,
        updated_at: nowStr,
        sync_status: 'pending' as const,
        version: 1
      }

      await db.profiles.put(profileData)
      
      // Advance to Crop Selection
      setStep(8)
    } catch (err) {
      console.error('Failed to save profile locally:', err)
      setValidationError('Failed to save profile. Please check your storage.')
    } finally {
      setSaving(false)
    }
  }

  // Handle crop setup completion
  const finishCropSetup = async () => {
    if (!user?.id) return
    setSaving(true)

    try {
      const cropName = selectedCrop === 'Custom' ? customCropName : selectedCrop

      // Active crop plan safety check
      const existingPlans = await db.crop_plans.filter(p => p.user_id === user.id && p.status === 'active').toArray()
      let cropPlanId = ''

      if (existingPlans.length > 0) {
        console.log('[Onboarding] Found existing active crop plan, reusing.')
        cropPlanId = existingPlans[0].id
      } else {
        // Create planning schedule locally
        cropPlanId = await cropCalendarService.initializeCropPlan({
          cropType: cropName,
          variety: cropTemplates[cropName]?.variety || 'Local Variety',
          sowingDate,
          area: cropAreaInAcres,
          userId: user.id,
          // Custom fields extension
          crop_area_value: parseFloat(cropAreaValue),
          crop_area_unit: cropAreaUnit,
          crop_area_acres: cropAreaInAcres,
          farmer_selected_stage: selectedStage,
          crop_condition: cropCondition,
          created_by_onboarding: true
        })
      }

      // Update profile with active crop plan link
      await db.profiles.update(user.id, {
        active_crop_plan_id: cropPlanId,
        primary_crop: cropName, // Compat fallback
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      })

      // Kick off background sync (silent)
      void backgroundSync().catch(e => console.warn('Background sync error post onboarding:', e))

      // Direct to dashboard
      navigate('/dashboard')
    } catch (err) {
      console.error('Failed to initialize crop schedule:', err)
      setValidationError('Error building crop calendar. Sowing date may be invalid.')
    } finally {
      setSaving(false)
    }
  }

  // Allow farmer to postpone crop setup and go to dashboard
  const handleCompleteCropLater = async () => {
    if (!user?.id) return
    // Trigger background sync (silent)
    void backgroundSync().catch(e => console.warn('Background sync error:', e))
    navigate('/dashboard')
  }

  // If already onboarded, redirect immediately to dashboard
  if (profile?.onboarding_completed && step < 8) {
    return <Navigate to="/dashboard" replace />
  }

  // Dynamic values helper classes
  const btnClass = "flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-bold transition-all active:scale-[0.98] w-full"
  const inputClass = "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm text-white placeholder:text-white/20 outline-none transition focus:border-primary-500"

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0c0a] relative overflow-hidden">
      {/* Immersive ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#87A96B]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#2E7D32]/10 rounded-full blur-[120px] pointer-events-none" />

      <GlassCard className="max-w-md w-full p-6 md:p-8 border-white/5 bg-[#121412]/80 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] rounded-3xl relative" variant="strong">
        
        {/* Step Indicator */}
        <div className="flex justify-between items-center mb-6">
          <span className="text-[10px] uppercase font-black tracking-widest text-[#87A96B]">
            {step <= 7 ? t('profile:profileSetup') : t('profile:cropSetup')}
          </span>
          <span className="text-white/40 text-xs font-bold">
            {t('profile:stepIndicator', { step })}
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="h-1.5 w-full bg-white/5 rounded-full mb-8 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#2E7D32] to-[#87A96B] transition-all duration-300 rounded-full" 
            style={{ width: `${(step / 12) * 100}%` }}
          />
        </div>

        {/* Error Alert Box */}
        {validationError && (
          <div className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400">
            {validationError}
          </div>
        )}

        {/* STEP VIEWS */}
        
        {/* STEP 1: LANGUAGE SELECTION */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Languages className="text-[#87A96B]" size={22} />
                {t('profile:chooseLanguage')}
              </h2>
              <p className="text-white/40 text-xs">{t('profile:selectLanguageDesc')}</p>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {[
                { code: 'en', native: 'English', desc: 'English' },
                { code: 'hi', native: 'हिन्दी', desc: 'Hindi' },
                { code: 'te', native: 'తెలుగు', desc: 'Telugu' }
              ].map(lng => (
                <button
                  key={lng.code}
                  onClick={() => setPrefLang(lng.code)}
                  className={`flex items-center justify-between p-4 rounded-2xl border text-left transition-all ${
                    prefLang === lng.code
                      ? 'bg-[#87A96B]/15 border-[#87A96B] text-white'
                      : 'bg-white/2 border-white/5 text-white/60 hover:bg-white/5 hover:border-white/10'
                  }`}
                >
                  <div>
                    <div className="font-extrabold text-sm">{lng.native}</div>
                    <div className="text-[10px] opacity-50 mt-0.5">{lng.desc}</div>
                  </div>
                  {prefLang === lng.code && <Check size={16} className="text-[#87A96B]" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: FARMER NAME */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <User className="text-[#87A96B]" size={22} />
                {t('profile:enterName')}
              </h2>
              <p className="text-white/40 text-xs">{t('profile:enterNameSub')}</p>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">{t('profile:name')}</label>
              <input
                type="text"
                placeholder={t('onboarding.namePlaceholder', 'Enter your full name')}
                value={farmerName}
                onChange={e => setFarmerName(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>
        )}

        {/* STEP 3: FARM LOCATION */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MapPin className="text-[#87A96B]" size={22} />
                {t('profile:farmLocation')}
              </h2>
              <p className="text-white/40 text-xs">{t('profile:gpsProgress')}</p>
            </div>

            <button
              type="button"
              onClick={handleGPSLocation}
              disabled={gpsLoading}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border text-xs font-bold transition-all ${
                latitude !== undefined 
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
              }`}
            >
              {gpsLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin text-white" />
                  {t('profile:locatingGps')}
                </>
              ) : latitude !== undefined ? (
                <>
                  <Check size={14} />
                  {t('profile:gpsCoordsAcquired')}
                </>
              ) : (
                <>
                  <Compass size={14} />
                  {t('profile:useCurrentGps')}
                </>
              )}
            </button>

            {gpsError && <p className="text-[10px] text-amber-400 italic text-center">{t('validation:gpsError')}</p>}

            <div className="pt-2 text-center text-white/30 text-[10px] font-bold uppercase tracking-widest">
              {t('onboarding.orEnterManually', '— OR ENTER MANUALLY —')}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">{t('profile:state')}</label>
                <input
                  type="text"
                  placeholder={t('profile:statePlaceholder', 'e.g. Telangana')}
                  value={stateName}
                  onChange={e => {
                    setStateName(e.target.value)
                    setLocationLabel('') // reset so it regenerates
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">{t('profile:district')}</label>
                <input
                  type="text"
                  placeholder={t('profile:districtPlaceholder', 'e.g. Warangal')}
                  value={districtName}
                  onChange={e => {
                    setDistrictName(e.target.value)
                    setLocationLabel('')
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">{t('profile:village')}</label>
                <input
                  type="text"
                  placeholder={t('profile:villagePlaceholder', 'e.g. Hasanparthy')}
                  value={villageName}
                  onChange={e => {
                    setVillageName(e.target.value)
                    setLocationLabel('')
                  }}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: FARM NAME */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sprout className="text-[#87A96B]" size={22} />
                {t('profile:farmName')}
              </h2>
              <p className="text-white/40 text-xs">{t('onboarding.farmNameProgress', 'optional name to distinguish fields during future multi-farm splits')}</p>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">{t('profile:farmName')}</label>
              <input
                type="text"
                placeholder={t('profile:farmNamePlaceholder', 'e.g. Ramesh Farm, Home Farm')}
                value={farmName}
                onChange={e => setFarmName(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* STEP 5: FARM SIZE */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Layers className="text-[#87A96B]" size={22} />
                {t('profile:farmSize')}
              </h2>
              <p className="text-white/40 text-xs">{t('profile:farmSizeProgress')}</p>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">{t('onboarding.landValue', 'Land Value')}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  placeholder={t('profile:areaValuePlaceholder', 'e.g. 5')}
                  value={farmAreaValue}
                  onChange={e => setFarmAreaValue(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="w-1/3">
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">{t('onboarding.unit', 'Unit')}</label>
                <select
                  value={farmAreaUnit}
                  onChange={e => setFarmAreaUnit(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-3 py-3.5 text-sm text-white focus:outline-none focus:border-primary-500 h-[50px] mt-0.5"
                >
                  {AREA_UNITS.map(u => (
                    <option key={u} value={u}>{tEnum('areaUnit', u)}</option>
                  ))}
                </select>
              </div>
            </div>

            {farmAreaValue && (
              <p className="text-[10px] text-[#87A96B] font-semibold italic">
                {t('onboarding.normalizedSize', 'Normalized size: {{size}} Acres', { size: farmAreaInAcres.toFixed(2) })}
              </p>
            )}
          </div>
        )}

        {/* STEP 6: SOIL TYPE */}
        {step === 6 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FlaskConical className="text-[#87A96B]" size={22} />
                {t('profile:soilType')}
              </h2>
              <p className="text-white/40 text-xs">{t('profile:soilProgress')}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                'Black Soil',
                'Red Soil',
                'Sandy Soil',
                'Clay Soil',
                'Loamy Soil',
                "Don't Know"
              ].map(soil => (
                <button
                  key={soil}
                  type="button"
                  onClick={() => setSoilType(soil)}
                  className={`p-3.5 rounded-2xl border text-xs font-bold text-center transition-all ${
                    soilType === soil
                      ? 'bg-[#87A96B]/15 border-[#87A96B] text-white shadow-glowPrimary'
                      : 'bg-white/2 border-white/5 text-white/70 hover:bg-white/5 hover:border-white/10'
                  }`}
                >
                  {tEnum('soilType', soil)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 7: WATER SOURCE */}
        {step === 7 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Droplets className="text-[#87A96B]" size={22} />
                {t('profile:waterSources')}
              </h2>
              <p className="text-white/40 text-xs">{t('profile:waterProgress')}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                'Borewell',
                'Canal',
                'Rainfed',
                'River',
                'Tank/Pond',
                'Drip Irrigation',
                'Sprinkler'
              ].map(src => {
                const selected = selectedWaterSources.includes(src)
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => toggleWaterSource(src)}
                    className={`p-3.5 rounded-2xl border text-xs font-bold text-center transition-all ${
                      selected
                        ? 'bg-[#87A96B]/15 border-[#87A96B] text-white shadow-glowPrimary'
                        : 'bg-white/2 border-white/5 text-white/70 hover:bg-white/5 hover:border-white/10'
                    }`}
                  >
                    {tEnum('waterSource', src)}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 8: CROP SELECTION */}
        {step === 8 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sprout className="text-[#87A96B]" size={22} />
                {t('profile:cropName')}
              </h2>
              <p className="text-white/40 text-xs">{t('profile:cropProgress')}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {['Cotton', 'Rice', 'Maize', 'Tomato', 'Chilli'].map(crop => (
                <button
                  key={crop}
                  type="button"
                  onClick={() => {
                    setSelectedCrop(crop)
                    setCustomCropName('')
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    selectedCrop === crop
                      ? 'bg-[#87A96B]/15 border-[#87A96B] text-white'
                      : 'bg-white/2 border-white/5 text-white/70 hover:bg-white/5'
                  }`}
                >
                  <span className="font-extrabold text-sm">{tEnum('cropType', crop)}</span>
                  <span className="text-[9px] opacity-40 mt-1">
                    {cropTemplates[crop]?.variety ? t('profile:customVariety') : t('onboarding.standardTemplate', 'Standard Template')}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedCrop('Custom')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  selectedCrop === 'Custom'
                    ? 'bg-[#87A96B]/15 border-[#87A96B] text-white'
                    : 'bg-white/2 border-white/5 text-white/70 hover:bg-white/5'
                }`}
              >
                <div className="font-extrabold text-sm">{t('profile:otherCrop')}</div>
                <div className="text-[9px] opacity-40 mt-1">{t('onboarding.customSchedule', 'Custom schedule')}</div>
              </button>
            </div>

            {selectedCrop === 'Custom' && (
              <div className="mt-3">
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">{t('profile:cropName')}</label>
                <input
                  type="text"
                  placeholder={t('profile:cropNamePlaceholder', 'e.g. Wheat, Green Gram')}
                  value={customCropName}
                  onChange={e => setCustomCropName(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}
          </div>
        )}

        {/* STEP 9: CROP AREA */}
        {step === 9 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Layers className="text-[#87A96B]" size={22} />
                {t('profile:cropArea')}
              </h2>
              <p className="text-white/40 text-xs">
                {t('onboarding.mustNotExceedFarm', 'must not exceed total farm size ({{value}} {{unit}})', {
                  value: farmAreaValue,
                  unit: tEnum('areaUnit', farmAreaUnit)
                })}
              </p>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">{t('onboarding.cropAreaValue', 'Crop Area Value')}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder={t('profile:areaValuePlaceholder', 'e.g. 5')}
                  value={cropAreaValue}
                  onChange={e => setCropAreaValue(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="w-1/3">
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">{t('onboarding.unit', 'Unit')}</label>
                <select
                  value={cropAreaUnit}
                  onChange={e => setCropAreaUnit(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-3 py-3.5 text-sm text-white focus:outline-none focus:border-primary-500 h-[50px] mt-0.5"
                >
                  {AREA_UNITS.map(u => (
                    <option key={u} value={u}>{tEnum('areaUnit', u)}</option>
                  ))}
                </select>
              </div>
            </div>

            {cropAreaValue && (
              <div className="space-y-1 text-[10px] italic">
                <p className="text-[#87A96B] font-semibold">
                  {t('onboarding.normalizedCropArea', 'Normalized crop area: {{size}} Acres', { size: cropAreaInAcres.toFixed(2) })}
                </p>
                <p className="text-white/30 font-medium">
                  {t('onboarding.farmLimitCheck', 'Farm limit check: {{crop}} / {{farm}} Acres utilized', {
                    crop: cropAreaInAcres.toFixed(2),
                    farm: farmAreaInAcres.toFixed(2)
                  })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 10: SOWING DATE */}
        {step === 10 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar className="text-[#87A96B]" size={22} />
                {t('profile:sowingDate')}
              </h2>
              <p className="text-white/40 text-xs">{t('profile:sowingProgress')}</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">{t('profile:sowingDate')}</label>
              <input
                type="date"
                required
                value={sowingDate}
                onChange={e => setSowingDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* STEP 11: CURRENT CROP STAGE */}
        {step === 11 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="text-[#87A96B]" size={22} />
                {t('profile:cropStage')}
              </h2>
              <p className="text-white/40 text-xs">{t('profile:stageProgress')}</p>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {availableStages.map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStage(st)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border text-left w-full transition-all ${
                    selectedStage === st
                      ? 'bg-[#87A96B]/15 border-[#87A96B] text-white font-bold'
                      : 'bg-white/2 border-white/5 text-white/60 hover:bg-white/5'
                  }`}
                >
                  <span className="text-xs">{tEnum('cropStage', st)}</span>
                  {selectedStage === st && <Check size={14} className="text-[#87A96B]" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 12: CURRENT CROP CONDITION */}
        {step === 12 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <HelpCircle className="text-[#87A96B]" size={22} />
                {t('profile:cropCondition')}
              </h2>
              <p className="text-white/40 text-xs">{t('profile:conditionProgress')}</p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {[
                { value: 'Healthy' },
                { value: 'Average' },
                { value: 'Not Growing Well' },
                { value: 'Pest/Disease Problem' },
                { value: 'Not Sure' }
              ].map(cond => (
                <button
                  key={cond.value}
                  type="button"
                  onClick={() => setCropCondition(cond.value)}
                  className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                    cropCondition === cond.value
                      ? 'bg-[#87A96B]/15 border-[#87A96B] text-white font-bold shadow-glowPrimary'
                      : 'bg-white/2 border-white/5 text-white/70 hover:bg-white/5'
                  }`}
                >
                  <span className="text-xs">{tEnum('cropCondition', cond.value)}</span>
                  {cropCondition === cond.value && <Check size={14} className="text-[#87A96B]" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BOTTOM NAVIGATION ACTIONS */}
        <div className="mt-8 pt-6 border-t border-white/5 flex gap-3 flex-wrap">
          {step > 1 && (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setValidationError(null)
                setStep(step - 1)
              }}
              className="flex items-center justify-center rounded-2xl border border-white/10 hover:border-white/20 bg-white/5 px-4 py-3.5 text-xs font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              {t('common:back')}
            </button>
          )}

          <div className="flex-1 flex gap-2">
            {step === 8 && (
              <button
                type="button"
                onClick={handleCompleteCropLater}
                className="flex-1 flex items-center justify-center rounded-2xl border border-white/10 hover:bg-white/5 py-3 text-xs font-bold text-white/60 hover:text-white transition active:scale-[0.98]"
              >
                {t('profile:completeLater')}
              </button>
            )}

            <button
              type="button"
              onClick={handleNextStep}
              disabled={saving}
              className={`${btnClass} flex-1 ${
                saving 
                  ? 'bg-white/10 text-white/50 cursor-not-allowed'
                  : 'bg-[#2E7D32] hover:bg-[#2E7D32]/90 text-white shadow-glowPrimary'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  {step === 7 ? t('onboarding.creatingProfile', 'Creating Profile...') : t('onboarding.initializingCrop', 'Initializing Crop...')}
                </>
              ) : step === 7 ? (
                <>
                  {t('common:next')}
                  <ChevronRight size={16} />
                </>
              ) : step === 12 ? (
                <>
                  <Check size={16} />
                  {t('profile:finishSetup')}
                </>
              ) : (
                <>
                  {t('common:next')}
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>

      </GlassCard>
    </div>
  )
}
