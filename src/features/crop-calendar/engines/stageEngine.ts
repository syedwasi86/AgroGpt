import { daysBetweenUtc } from '../utils/dateUtils'
import type { CropStageRecord } from '../../../lib/db'

/**
 * Calculates how many days have elapsed since sowing (starts from 0).
 */
export function calculateDaysElapsed(sowingDate: string, currentDate: string): number {
  const days = daysBetweenUtc(sowingDate, currentDate)
  return Math.max(0, days)
}

/**
 * Computes the lifecycle progress percentage based on sowing date, duration, and current date.
 */
export function calculateLifecycleProgress(
  sowingDate: string,
  lifecycleDuration: number,
  currentDate: string
): number {
  if (lifecycleDuration <= 0) return 0
  const elapsed = calculateDaysElapsed(sowingDate, currentDate)
  const pct = (elapsed / lifecycleDuration) * 100
  return Math.min(100, Math.max(0, Math.round(pct)))
}

/**
 * Finds the currently active stage from an array of stages based on the elapsed days since sowing.
 */
export function determineCurrentStage(
  stages: CropStageRecord[],
  sowingDate: string,
  currentDate: string
): CropStageRecord | undefined {
  const elapsed = calculateDaysElapsed(sowingDate, currentDate)
  return stages.find(s => elapsed >= s.start_day && elapsed < s.end_day) || stages[stages.length - 1]
}
