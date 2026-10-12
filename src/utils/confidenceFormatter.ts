/**
 * Normalizes a confidence score.
 * If the value is a fraction (<= 1), it is scaled to a percentage (multiplied by 100).
 * Capped at 100 and rounded to the nearest integer.
 */
export function formatConfidence(confidence: number): number {
  const score = confidence <= 1 ? confidence * 100 : confidence;
  return Math.min(100, Math.round(score));
}
