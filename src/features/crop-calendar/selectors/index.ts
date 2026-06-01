import { determineCurrentStage, calculateLifecycleProgress } from '../engines/stageEngine'
import { isBeforeUtc, addDaysUtc, daysBetweenUtc } from '../utils/dateUtils'
import type { FarmTaskRecord, CropStageRecord } from '../../../lib/db'

/**
 * Filter tasks scheduled for today (or equal to the current UTC date).
 */
export function getTodayTasks(tasks: FarmTaskRecord[], currentDateUtc: string): FarmTaskRecord[] {
  return tasks.filter(t => t.effective_date === currentDateUtc && !t.deleted_at)
}

/**
 * Filter pending/rescheduled tasks whose date is prior to today.
 */
export function getOverdueTasks(tasks: FarmTaskRecord[], currentDateUtc: string): FarmTaskRecord[] {
  return tasks.filter(t => 
    t.status !== 'completed' && 
    isBeforeUtc(t.effective_date, currentDateUtc) && 
    !t.deleted_at
  )
}

/**
 * Filter tasks scheduled for future dates.
 */
export function getUpcomingTasks(tasks: FarmTaskRecord[], currentDateUtc: string): FarmTaskRecord[] {
  return tasks.filter(t => 
    isBeforeUtc(currentDateUtc, t.effective_date) && 
    !t.deleted_at
  )
}

/**
 * Returns the currently active crop stage.
 */
export function selectCurrentStage(
  stages: CropStageRecord[],
  sowingDate: string,
  currentDateUtc: string
): CropStageRecord | undefined {
  return determineCurrentStage(stages, sowingDate, currentDateUtc)
}

/**
 * Returns the current lifecycle completion percentage.
 */
export function selectLifecycleProgress(
  sowingDate: string,
  lifecycleDuration: number,
  currentDateUtc: string
): number {
  return calculateLifecycleProgress(sowingDate, lifecycleDuration, currentDateUtc)
}

/**
 * Pre-groups tasks by their effective date for calendar grid memoization.
 */
export function groupTasksByDate(tasks: FarmTaskRecord[]): Record<string, FarmTaskRecord[]> {
  const groups: Record<string, FarmTaskRecord[]> = {}
  tasks.forEach(t => {
    if (t.deleted_at) return
    const d = t.effective_date
    if (!groups[d]) {
      groups[d] = []
    }
    groups[d].push(t)
  })
  return groups
}

/**
 * Calculates the estimated harvest date based on sowing date and duration.
 */
export function selectEstimatedHarvestDate(sowingDate: string, lifecycleDuration: number): string {
  return addDaysUtc(sowingDate, lifecycleDuration)
}

/**
 * Calculates the number of days spent in the current active stage.
 */
export function selectDaysInCurrentStage(
  stages: CropStageRecord[],
  currentStageId: string | undefined,
  currentDateUtc: string
): number {
  if (!currentStageId) return 0
  const active = stages.find(s => s.id === currentStageId)
  if (!active) return 0
  const days = daysBetweenUtc(active.start_date, currentDateUtc)
  return Math.max(0, days)
}

/**
 * Calculates the days remaining until the next stage starts.
 */
export function selectDaysUntilNextStage(
  stages: CropStageRecord[],
  currentStageId: string | undefined,
  currentDateUtc: string
): { name: string; days: number } | null {
  if (!currentStageId || stages.length === 0) return null
  const currentIdx = stages.findIndex(s => s.id === currentStageId)
  if (currentIdx === -1 || currentIdx === stages.length - 1) return null

  const nextStage = stages[currentIdx + 1]
  const days = daysBetweenUtc(currentDateUtc, nextStage.start_date)
  return {
    name: nextStage.name,
    days: Math.max(0, days)
  }
}

export interface MilestoneItem {
  name: string
  relativeDays: number
  dateStr: string
  isHarvest: boolean
}

/**
 * Compiles a list of upcoming future milestones.
 */
export function selectUpcomingMilestones(
  stages: CropStageRecord[],
  sowingDate: string,
  lifecycleDuration: number,
  currentDateUtc: string
): MilestoneItem[] {
  const milestones: MilestoneItem[] = []
  
  // Find upcoming growth stages
  stages.forEach(stage => {
    if (stage.start_date > currentDateUtc) {
      milestones.push({
        name: `${stage.name} Stage`,
        relativeDays: Math.max(0, daysBetweenUtc(currentDateUtc, stage.start_date)),
        dateStr: stage.start_date,
        isHarvest: false
      })
    }
  })

  // Add estimated harvest milestone
  const harvestDate = selectEstimatedHarvestDate(sowingDate, lifecycleDuration)
  if (harvestDate > currentDateUtc) {
    milestones.push({
      name: 'Estimated Harvest Window',
      relativeDays: Math.max(0, daysBetweenUtc(currentDateUtc, harvestDate)),
      dateStr: harvestDate,
      isHarvest: true
    })
  }

  // Sort milestones chronologically
  return milestones.sort((a, b) => a.dateStr.localeCompare(b.dateStr))
}
