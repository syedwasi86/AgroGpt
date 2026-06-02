import type { SeverityLevel } from '../features/field-vision/types';

/**
 * Interactive Severity Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Calculates the severity level based on user answers to disease-specific questions.
 * 
 * Rules:
 *   • Total score 0–2  → low
 *   • Total score 3–5  → medium
 *   • Total score 6+   → high
 */
export function calculateSeverity(scores: number[]): SeverityLevel {
  const totalScore = scores.reduce((sum, s) => sum + s, 0);
  if (totalScore <= 2) {
    return 'low';
  } else if (totalScore <= 5) {
    return 'medium';
  } else {
    return 'high';
  }
}
