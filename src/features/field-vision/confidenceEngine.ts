export interface ConfidenceDecision {
  isConfident: boolean
  isOffline: boolean
  recommendationType: 'normal' | 'low_confidence_offline' | 'low_confidence_online'
}

export function evaluateConfidence(confidence: number, isOnline: boolean): ConfidenceDecision {
  const isConfident = confidence >= 75
  
  if (isConfident) {
    return {
      isConfident: true,
      isOffline: !isOnline,
      recommendationType: 'normal'
    }
  }

  if (!isConfident && !isOnline) {
    return {
      isConfident: false,
      isOffline: true,
      recommendationType: 'low_confidence_offline'
    }
  }

  return {
    isConfident: false,
    isOffline: false,
    recommendationType: 'low_confidence_online'
  }
}
