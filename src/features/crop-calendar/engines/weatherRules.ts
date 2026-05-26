import type { WeatherSensitivity } from '../types'

export interface WeatherRuleResult {
  hasAlert: boolean
  message: string | null
}

export const weatherRules = {
  evaluateIrrigationDelay(
    precipitationMm: number,
    sensitivity: WeatherSensitivity
  ): WeatherRuleResult {
    if (precipitationMm >= sensitivity.rainThreshold) {
      return {
        hasAlert: true,
        message: `Rain of ${precipitationMm}mm detected. Rescheduling irrigation to conserve water and prevent waterlogging.`
      }
    }
    return { hasAlert: false, message: null }
  },

  evaluateSprayWarning(
    windSpeedKmh: number,
    sensitivity: WeatherSensitivity
  ): WeatherRuleResult {
    if (windSpeedKmh >= sensitivity.windSpeedThreshold) {
      return {
        hasAlert: true,
        message: `High wind speed of ${windSpeedKmh} km/h detected. Avoid pesticide or fertilizer spray to prevent chemical drift.`
      }
    }
    return { hasAlert: false, message: null }
  },

  evaluateDiseaseRisk(
    humidityPct: number,
    sensitivity: WeatherSensitivity
  ): WeatherRuleResult {
    if (humidityPct >= sensitivity.humidityThreshold) {
      return {
        hasAlert: true,
        message: `High relative humidity of ${humidityPct}% detected. Elevates risk of fungal disease infections (e.g. leaf blight, blast). Inspect crops closely.`
      }
    }
    return { hasAlert: false, message: null }
  },

  evaluateHeatStress(
    maxTempC: number,
    sensitivity: WeatherSensitivity
  ): WeatherRuleResult {
    if (maxTempC >= sensitivity.maxTempThreshold) {
      return {
        hasAlert: true,
        message: `Extreme temperature of ${maxTempC}°C detected. Heat stress can cause crop damage. Consider light mulching or soil dampening.`
      }
    } else if (maxTempC <= sensitivity.minTempThreshold) {
      return {
        hasAlert: true,
        message: `Cold stress detected (${maxTempC}°C). Plant development may slow down.`
      }
    }
    return { hasAlert: false, message: null }
  }
}
