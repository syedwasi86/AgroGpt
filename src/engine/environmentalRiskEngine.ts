import type { WeatherData } from '../features/gis/services/weatherService';
import type { SpreadConditions, SeverityLevel } from '../features/field-vision/types';

/**
 * Calculates disease spread risk based on current weather details and disease spread conditions.
 * Separated from AI confidence and assessed field severity to explain favorable spread conditions.
 */
export function calculateEnvironmentalRisk(
  weather: WeatherData | null,
  spreadConditions?: SpreadConditions | null
): SeverityLevel {
  if (!weather) return 'low';
  
  let score = 0;
  
  // 1. Humidity evaluation
  const currentHumid = weather.humidity;
  if (currentHumid > 85) {
    score += 2.0;
    const humCond = spreadConditions?.humidity?.toLowerCase() || '';
    if (humCond.includes('high') || humCond.includes('humid') || humCond.includes('above') || humCond.includes('>') || humCond.includes('80') || humCond.includes('85') || humCond.includes('90')) {
      score += 1.0;
    }
  } else if (currentHumid > 70) {
    score += 1.0;
    const humCond = spreadConditions?.humidity?.toLowerCase() || '';
    if (humCond.includes('moderate') || humCond.includes('70') || humCond.includes('75')) {
      score += 0.5;
    }
  } else if (currentHumid < 50) {
    // Dry conditions suppress most fungal/bacterial diseases, but check if disease prefers dry mornings/conditions
    const humCond = spreadConditions?.humidity?.toLowerCase() || '';
    if (humCond.includes('dry') || humCond.includes('low') || humCond.includes('<')) {
      score += 1.0;
    } else {
      score -= 1.0; // Favorable dry conditions reduce spread risk
    }
  }

  // 2. Rainfall / Wet conditions evaluation (WMO codes: 51-67, 80-82, 95-99 are rain/drizzle/storm)
  const isWet = weather.weatherCode >= 51 || (weather.weatherCode >= 45 && weather.weatherCode <= 48);
  if (isWet) {
    score += 1.5;
    const rainCond = spreadConditions?.rainfall?.toLowerCase() || '';
    const seasonCond = spreadConditions?.season?.toLowerCase() || '';
    if (rainCond.includes('wet') || rainCond.includes('rain') || rainCond.includes('shower') || rainCond.includes('humid') ||
        seasonCond.includes('wet') || seasonCond.includes('rain') || seasonCond.includes('monsoon')) {
      score += 1.0;
    }
  }

  // 3. Temperature matching
  const currentTemp = weather.temperature;
  const tempCond = spreadConditions?.temperature?.toLowerCase() || '';
  
  if (tempCond) {
    if (currentTemp >= 15 && currentTemp <= 25) {
      if (tempCond.includes('cool') || tempCond.includes('moderate') || tempCond.includes('mild') || tempCond.includes('15') || tempCond.includes('20') || tempCond.includes('25')) {
        score += 1.0;
      }
    } else if (currentTemp > 25 && currentTemp <= 35) {
      if (tempCond.includes('warm') || tempCond.includes('hot') || tempCond.includes('25') || tempCond.includes('30') || tempCond.includes('35')) {
        score += 1.0;
      }
    } else if (currentTemp > 35) {
      if (tempCond.includes('hot') || tempCond.includes('high') || tempCond.includes('>')) {
        score += 1.0;
      }
    }
  } else {
    // Default temperature check
    if (currentTemp >= 18 && currentTemp <= 32) {
      score += 0.5;
    }
  }

  // Score mapping:
  // high: >= 3.5
  // medium: >= 1.5
  // low: < 1.5
  if (score >= 3.5) {
    return 'high';
  } else if (score >= 1.5) {
    return 'medium';
  }
  return 'low';
}
