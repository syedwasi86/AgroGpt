export interface IrrigationRecommendation {
  litersPerPlant: number
  litersPerAcre: number
  frequency: string
  actionableText: string
}

/**
 * Calculates the irrigation requirement using the rule-based formula:
 * (Base Water Needs * Temp Factor) - Humidity Adjustment
 */
export function calculateWaterRequirement(
  crop: string,
  soilType: string,
  temp: number,
  humidity: number
): IrrigationRecommendation {
  // 1. Determine Base Water Needs (Liters per plant per day approximation)
  let baseLiters = 10; // Default baseline
  const cropLower = crop.toLowerCase();
  
  if (cropLower.includes('cotton')) baseLiters = 12;
  else if (cropLower.includes('maize') || cropLower.includes('corn')) baseLiters = 8;
  else if (cropLower.includes('rice') || cropLower.includes('paddy')) baseLiters = 25;
  else if (cropLower.includes('wheat')) baseLiters = 9;
  else if (cropLower.includes('sugar')) baseLiters = 18;

  // 2. Adjust for Soil Type (Sandy soils need more water, clay/black soils retain water)
  const soilLower = soilType.toLowerCase();
  let soilMultiplier = 1.0;
  
  if (soilLower.includes('sand') || soilLower.includes('chalka') || soilLower.includes('laterite')) {
    soilMultiplier = 1.2; // Drains fast, needs more water
  } else if (soilLower.includes('black') || soilLower.includes('regur') || soilLower.includes('clay')) {
    soilMultiplier = 0.85; // Retains water, needs less
  }

  baseLiters = baseLiters * soilMultiplier;

  // 3. Calculate Temp Factor
  let tempFactor = 1.0;
  if (temp > 35) {
    tempFactor = 1.3; // High heat stress
  } else if (temp < 20) {
    tempFactor = 0.8; // Low evaporation
  } else {
    // Linear scaling between 20C and 35C
    tempFactor = 1.0 + ((temp - 25) * 0.02);
  }

  // 4. Calculate Humidity Adjustment
  // High humidity means less evaporation, so we subtract from the need.
  // Low humidity means more evaporation, so we add to the need (negative subtraction).
  let humidityAdjustment = 0;
  if (humidity > 70) {
    humidityAdjustment = 2.0; // High humidity: reduce by 2L
  } else if (humidity < 30) {
    humidityAdjustment = -2.0; // Dry air: increase by 2L
  } else {
    // Proportional adjustment between 30% and 70%
    humidityAdjustment = (humidity - 50) * 0.05; 
  }

  // 5. Final Formula Application
  let finalLiters = (baseLiters * tempFactor) - humidityAdjustment;
  
  // Enforce a sensible minimum
  if (finalLiters < 2) finalLiters = 2;
  
  finalLiters = Math.round(finalLiters * 10) / 10;

  // Approximation for total volume per acre (assuming 10,000 plants/acre as a baseline)
  const plantsPerAcre = 10000;
  const totalLitersPerAcre = Math.round(finalLiters * plantsPerAcre);

  // Determine optimal frequency based on soil and temp
  let frequency = 'Every 3 Days';
  if (temp > 35 && soilMultiplier > 1.0) {
    frequency = 'Daily';
  } else if (temp > 30) {
    frequency = 'Every 2 Days';
  } else if (soilMultiplier < 1.0 && temp < 25) {
    frequency = 'Once a Week';
  }

  return {
    litersPerPlant: finalLiters,
    litersPerAcre: totalLitersPerAcre,
    frequency,
    actionableText: `Irrigate ~${finalLiters} Liters per plant (${frequency}).`
  };
}
