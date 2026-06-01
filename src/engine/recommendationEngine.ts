import type { 
  DiseaseKnowledgeBaseEntry, 
  RecommendationResponse, 
  SeverityLevel 
} from '../features/field-vision/types';

/**
 * Generates confidence safety messages.
 * Never presents low-confidence predictions as guaranteed diagnoses.
 */
export function getConfidenceMessage(confidence: number): string {
  const normConf = confidence <= 1.0 ? confidence * 100 : confidence;
  if (normConf >= 90) {
    return 'High confidence detection';
  } else if (normConf >= 75) {
    return 'Moderate confidence detection';
  } else {
    return 'Possible disease detected. Manual verification recommended.';
  }
}

/**
 * Returns a fallback structured recommendation if the knowledge base does not
 * have an entry for a specific disease or if loading fails.
 */
export function getFallbackRecommendation(
  crop: string,
  disease: string,
  confidence: number,
  severity: SeverityLevel
): RecommendationResponse {
  const isHealthy = disease.toLowerCase().includes('healthy');
  
  return {
    diagnosis: {
      crop,
      disease,
      confidence,
      severity: isHealthy ? 'low' : severity
    },
    kbData: null,
    recommendations: {
      immediateActions: isHealthy 
        ? ['Maintain current watering and monitoring practices.']
        : ['Inspect the affected leaves and stems closely.', 'Isolate or prune heavily infested branches to check spread.'],
      organicTreatments: isHealthy
        ? ['Continue applying well-decomposed organic manure regularly.']
        : ['Apply general neem oil sprays (1% concentration) to repel common sucking pests.', 'Maintain proper spacing to improve ventilation.'],
      chemicalTreatments: isHealthy
        ? []
        : [
            {
              activeIngredient: 'General protectant fungicide/insecticide (consult local advisor)',
              dosage: 'Refer to product instructions',
              sprayInterval: 'Once upon initial symptom sighting',
              notes: 'Consult a local agronomist before purchase or field application.'
            }
          ],
      prevention: [
        'Practice clean weeding and crop rotation.',
        'Procure healthy, certified seed stock.',
        'Avoid waterlogging and excessive nitrogen top-dressing.'
      ],
      monitoringAdvice: [
        'Perform morning field scouting twice a week.',
        'Inspect leaf undersides for signs of pests or spores.'
      ]
    },
    warnings: isHealthy 
      ? [] 
      : ['Detailed knowledge base details not found. Showing standard safety fallback recommendations.'],
    confidenceMessage: getConfidenceMessage(confidence),
    requiresExpert: !isHealthy && (severity === 'high' || confidence < 75)
  };
}

/**
 * Recommendation Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Combines ML inference inputs and user-driven field severity answers
 * to generate a structured recommendation response.
 */
export function generateRecommendation(
  crop: string,
  disease: string,
  confidence: number,
  severity: SeverityLevel,
  kbData: DiseaseKnowledgeBaseEntry | null
): RecommendationResponse {
  // If the KB entry is missing, return a clean safety fallback
  if (!kbData) {
    return getFallbackRecommendation(crop, disease, confidence, severity);
  }

  const isHealthy = disease.toLowerCase().includes('healthy') || kbData.id.endsWith('_healthy');
  const confidenceMsg = getConfidenceMessage(confidence);
  
  // High severity or low confidence triggers expert warning
  const requiresExpert = !isHealthy && (severity === 'high' || confidence < 75);

  // Compile warnings
  const warnings: string[] = [];
  if (!isHealthy) {
    if (confidence < 75) {
      warnings.push('Low confidence detection. Please take a clearer photo or consult an expert.');
    }
    if (severity === 'high') {
      warnings.push('High severity infection reported in field. Quick intervention is critical to save yield.');
    }
    if (kbData.dangerLevel === 'extreme') {
      warnings.push('This disease has an extreme danger level and spreads aggressively under wet conditions.');
    }
  }

  // Get immediate actions matching the selected severity level
  let immediateActions: string[] = [];
  if (!isHealthy && kbData.immediateActions) {
    immediateActions = kbData.immediateActions[severity] || [];
  }
  // Fallback for immediate actions if empty
  if (immediateActions.length === 0 && !isHealthy) {
    immediateActions = ['Carefully monitor the spread of symptoms.', 'Remove highly affected plant debris.'];
  }

  // Healthy plant indicator actions
  if (isHealthy) {
    immediateActions = ['No curative treatments needed.', 'Continue regular watering and field maintenance.'];
  }

  return {
    diagnosis: {
      crop: kbData.crop,
      disease: kbData.disease,
      confidence,
      severity: isHealthy ? 'low' : severity
    },
    kbData,
    recommendations: {
      immediateActions,
      organicTreatments: isHealthy ? ['No organic treatments required.'] : (kbData.organicTreatments || []),
      chemicalTreatments: isHealthy ? [] : (kbData.chemicalTreatments || []),
      prevention: kbData.prevention || [],
      monitoringAdvice: kbData.monitoringAdvice || []
    },
    warnings,
    confidenceMessage: confidenceMsg,
    requiresExpert
  };
}
