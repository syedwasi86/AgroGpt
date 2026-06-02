import { cropTemplates } from '../templates/cropTemplates'
import { validateCropTemplate } from '../validators/cropTemplateValidator'
import { addDaysUtc, normalizeToUtcDateString } from '../utils/dateUtils'
import type { CropPlanRecord, CropStageRecord, FarmTaskRecord } from '../../../lib/db'

export interface GenerationInput {
  cropType: string
  variety?: string
  sowingDate: string // YYYY-MM-DD
  area: number
  userId?: string
  crop_area_value?: number
  crop_area_unit?: string
  crop_area_acres?: number
  farmer_selected_stage?: string
  crop_condition?: string
  created_by_onboarding?: boolean
}

export interface GenerationOutput {
  plan: CropPlanRecord
  stages: CropStageRecord[]
  tasks: FarmTaskRecord[]
}

export function generateCropSchedule(input: GenerationInput): GenerationOutput {
  const template = cropTemplates[input.cropType]
  if (!template) {
    throw new Error(`Crop template for type "${input.cropType}" not found.`)
  }

  // Validate the template to ensure integrity
  const validationErrors = validateCropTemplate(template)
  if (validationErrors.length > 0) {
    throw new Error(`Malformed crop template: ${JSON.stringify(validationErrors)}`)
  }

  const now = new Date().toISOString()
  const planId = crypto.randomUUID()
  const sowingDateNormalized = normalizeToUtcDateString(input.sowingDate)

  // 1. Generate CropPlanRecord
  const plan: CropPlanRecord = {
    id: planId,
    user_id: input.userId,
    crop_type: input.cropType,
    variety: input.variety || template.variety,
    sowing_date: sowingDateNormalized,
    area: input.area,
    status: 'active',
    version: 1,
    sync_status: 'pending',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    crop_area_value: input.crop_area_value,
    crop_area_unit: input.crop_area_unit,
    crop_area_acres: input.crop_area_acres,
    farmer_selected_stage: input.farmer_selected_stage,
    crop_condition: input.crop_condition,
    created_by_onboarding: input.created_by_onboarding
  }

  // 2. Generate CropStageRecords
  const stages: CropStageRecord[] = []
  let elapsedDays = 0

  template.stages.forEach((st) => {
    const stageId = crypto.randomUUID()
    const startDay = elapsedDays
    const endDay = elapsedDays + st.durationDays

    const startDate = addDaysUtc(sowingDateNormalized, startDay)
    const endDate = addDaysUtc(sowingDateNormalized, endDay)

    stages.push({
      id: stageId,
      plan_id: planId,
      name: st.name,
      stage_name: st.name,
      start_day: startDay,
      end_day: endDay,
      days_from_sowing: startDay,
      start_date: startDate,
      end_date: endDate,
      status: startDay === 0 ? 'current' : 'upcoming',
      version: 1,
      sync_status: 'pending',
      created_at: now,
      updated_at: now,
      deleted_at: null
    })

    elapsedDays += st.durationDays
  })

  // Helper to find the stage ID for a given relative day
  const findStageIdForDay = (relativeDay: number): string | null => {
    const found = stages.find(s => relativeDay >= s.start_day && relativeDay < s.end_day)
    return found ? found.id : (stages[stages.length - 1]?.id || null)
  }

  // 3. Generate FarmTaskRecords (expanding recurring tasks)
  const tasks: FarmTaskRecord[] = []

  template.tasks.forEach((t) => {
    const relativeDaysToSchedule: number[] = []

    if (t.is_recurring && t.recurrence_interval_days) {
      // Repeat task from relativeDay until the end of crop lifecycle duration
      let currentDay = t.relativeDay
      while (currentDay <= template.lifecycleDuration) {
        relativeDaysToSchedule.push(currentDay)
        currentDay += t.recurrence_interval_days
      }
    } else {
      relativeDaysToSchedule.push(t.relativeDay)
    }

    relativeDaysToSchedule.forEach((relDay, idx) => {
      const taskDate = addDaysUtc(sowingDateNormalized, relDay)
      const stageId = findStageIdForDay(relDay)

      // Append suffix for repeating instances
      const title = t.is_recurring && idx > 0 ? `${t.title} (Cycle ${idx + 1})` : t.title

      tasks.push({
        id: crypto.randomUUID(),
        plan_id: planId,
        stage_id: stageId,
        title,
        description: t.description,
        status: 'pending',
        task_date: taskDate,
        scheduled_date: taskDate,
        effective_date: taskDate,
        task_type: t.taskType,
        priority: t.priority,
        notes: '',
        origin: 'template',
        task_template_id: t.task_template_id,
        is_recurring: t.is_recurring,
        recurrence_interval_days: t.recurrence_interval_days,
        version: 1,
        sync_status: 'pending',
        created_at: now,
        updated_at: now,
        deleted_at: null
      })
    })
  })

  return { plan, stages, tasks }
}
