
export type SoilType = 'Clay' | 'Sandy' | 'Loam'
export type WaterAvailability = 'Low' | 'Medium' | 'High'

export interface Recommendation {
  nextBestCrop: string
  fertilizerStrategy: string
  rationale: string
}

export function getPrecisionRecommendation(
  soil: SoilType,
  water: WaterAvailability,
  currentCrop: string
): Recommendation {
  // Simple heuristic engine
  if (soil === 'Sandy' && water === 'Low') {
    return {
      nextBestCrop: 'Millet / Pearl Millet',
      fertilizerStrategy: 'Organic Compost + Bio-fertilizers (Azotobacter)',
      rationale: 'Sandy soil with low water retention requires drought-hardy crops and organic matter to build soil structure.'
    }
  }

  if (soil === 'Clay' && water === 'High') {
    return {
      nextBestCrop: 'Rice / Paddy',
      fertilizerStrategy: 'Split Urea Application + Zinc Sulfate',
      rationale: 'Clay soil holds water well, ideal for rice. Zinc is often limited in waterlogged clay soils.'
    }
  }

  if (soil === 'Loam' && water === 'Medium') {
    return {
      nextBestCrop: 'Maize or Legumes',
      fertilizerStrategy: 'Balanced NPK (120:60:40) + Micronutrients',
      rationale: 'Loam is the "gold standard" for crops. Maize thrives here with standard fertilization.'
    }
  }

  // Fallbacks
  if (water === 'Low') {
    return {
      nextBestCrop: 'Sorghum or Chickpea',
      fertilizerStrategy: 'Deep placement of P&K + Foliar Spray',
      rationale: 'Conserving moisture by selecting deep-rooted or short-duration crops.'
    }
  }

  return {
    nextBestCrop: 'Mustard or Wheat',
    fertilizerStrategy: 'Standard NPK + Sulphur',
    rationale: `Based on your previous crop of ${currentCrop} and moderate conditions, these are the best rotational fits.`
  }
}
