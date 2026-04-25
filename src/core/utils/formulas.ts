/**
 * Offline-first agricultural formulas (pure functions).
 * Simplified ET₀-style irrigation and stage-based NPK estimates.
 */

export type CropType = 'cereal' | 'pulse' | 'fiber' | 'vegetable' | 'oilseed' | 'default'

/** Map free-text crop names to a coarse type for coefficients */
export function inferCropType(cropName: string): CropType {
  const s = cropName.toLowerCase()
  if (/(rice|wheat|maize|millet|sorghum|bajra)/i.test(s)) return 'cereal'
  if (/(gram|moong|urad|tur|lentil|bean)/i.test(s)) return 'pulse'
  if (/(cotton|jute)/i.test(s)) return 'fiber'
  if (/(tomato|chilli|potato|onion|brinjal)/i.test(s)) return 'vegetable'
  if (/(sunflower|sesame|mustard|soy)/i.test(s)) return 'oilseed'
  return 'default'
}

export interface IrrigationResult {
  /** Liters per acre per day (reference evapotranspiration demand) */
  litersPerAcrePerDay: number
  /** Hargreaves-style ET proxy (mm/day) used internally */
  etMmPerDay: number
  notes: string
}

/**
 * Simplified daily crop water need from temperature, humidity, and crop type.
 * Uses a Hargreaves-like ET estimate scaled by humidity and crop coefficient.
 */
export function calculateIrrigation(
  tempC: number,
  humidityPct: number,
  cropType: CropType,
): IrrigationResult {
  const dayOfYear = ((Date.now() / 86400000) % 365) + 1
  const latRad = (17.385 * Math.PI) / 180 // Hyderabad proxy
  const solarDecl = 0.409 * Math.sin(((2 * Math.PI) / 365) * dayOfYear - 1.39)
  const sunsetAngle = Math.acos(-Math.tan(latRad) * Math.tan(solarDecl))
  const ra = (24 / Math.PI) * 0.082 * sunsetAngle * (Math.sin(latRad) * Math.sin(solarDecl) + Math.cos(latRad) * Math.cos(solarDecl) * Math.sin(sunsetAngle))
  const tRange = Math.max(5, 35 - tempC * 0.3)
  const et0Mm = Math.max(2, 0.0023 * (tempC + 17.8) * Math.sqrt(tRange) * ra)

  const vaporAdj = 1 + (50 - Math.min(100, Math.max(0, humidityPct))) / 200
  const kc: Record<CropType, number> = {
    cereal: 1.05,
    pulse: 0.9,
    fiber: 1.15,
    vegetable: 1.1,
    oilseed: 1.0,
    default: 1.0,
  }
  const etMmPerDay = et0Mm * vaporAdj * kc[cropType]

  // 1 mm over 1 acre ≈ 4047 L / 1000 ≈ 4.047 m³ → liters per mm per acre
  const L_PER_MM_PER_ACRE = 4046.86
  const litersPerAcrePerDay = Math.round(etMmPerDay * L_PER_MM_PER_ACRE)

  return {
    litersPerAcrePerDay,
    etMmPerDay: Math.round(etMmPerDay * 100) / 100,
    notes: `ET₀ proxy ${(et0Mm * kc[cropType]).toFixed(2)} mm/day equivalent (kc=${kc[cropType]}). Adjust for soil moisture and rainfall.`,
  }
}

export type CropStage = 'vegetative' | 'flowering' | 'fruiting' | 'maturity'

export interface FertilizerResult {
  /** kg per acre (reference range for the stage) */
  nKgPerAcre: number
  pKgPerAcre: number
  kKgPerAcre: number
  /** Total N+P+K kg for the whole plot (acreage × per-acre NPK) */
  totalKgForPlot: number
  notes: string
}

/** Rough NPK totals (kg/acre) by stage — educational baseline, not a prescription */
export function calculateFertilizer(acreage: number, cropStage: CropStage): FertilizerResult {
  const tables: Record<CropStage, { n: number; p: number; k: number }> = {
    vegetative: { n: 12, p: 6, k: 6 },
    flowering: { n: 10, p: 8, k: 12 },
    fruiting: { n: 8, p: 6, k: 14 },
    maturity: { n: 4, p: 4, k: 8 },
  }
  const { n, p, k } = tables[cropStage]
  const perAcreTotal = n + p + k
  return {
    nKgPerAcre: n,
    pKgPerAcre: p,
    kKgPerAcre: k,
    totalKgForPlot: Math.round(perAcreTotal * acreage * 10) / 10,
    notes: `Split NPK applications; totals are for ${acreage} acre(s) at ${cropStage} stage (reference ranges).`,
  }
}
