import type { CropTemplate } from '../types'
import type { ValidationError } from '../schemas/cropTemplateSchema'

export function validateCropTemplate(template: CropTemplate): ValidationError[] {
  const errors: ValidationError[] = []

  // Check required fields
  if (!template.cropName || typeof template.cropName !== 'string') {
    errors.push({ field: 'cropName', message: 'Crop name is required and must be a string.' })
  }
  if (!template.variety || typeof template.variety !== 'string') {
    errors.push({ field: 'variety', message: 'Variety is required and must be a string.' })
  }
  if (!template.lifecycleDuration || typeof template.lifecycleDuration !== 'number' || template.lifecycleDuration <= 0) {
    errors.push({ field: 'lifecycleDuration', message: 'Lifecycle duration must be a positive number.' })
  }

  // Stages checks
  if (!Array.isArray(template.stages) || template.stages.length === 0) {
    errors.push({ field: 'stages', message: 'Stages must be a non-empty array.' })
  } else {
    let totalStageDuration = 0
    template.stages.forEach((stage, index) => {
      if (!stage.name) {
        errors.push({ field: `stages[${index}].name`, message: 'Stage name is required.' })
      }
      if (typeof stage.durationDays !== 'number' || stage.durationDays <= 0) {
        errors.push({ field: `stages[${index}].durationDays`, message: 'Stage duration must be a positive number.' })
      } else {
        totalStageDuration += stage.durationDays
      }
    })

    if (totalStageDuration !== template.lifecycleDuration && template.lifecycleDuration > 0) {
      errors.push({
        field: 'stages',
        message: `Sum of stage durations (${totalStageDuration}) must equal lifecycle duration (${template.lifecycleDuration}).`
      })
    }
  }

  // Tasks checks
  if (!Array.isArray(template.tasks)) {
    errors.push({ field: 'tasks', message: 'Tasks must be an array.' })
  } else {
    const taskIds = new Set<string>()
    template.tasks.forEach((task, index) => {
      if (!task.task_template_id) {
        errors.push({ field: `tasks[${index}].task_template_id`, message: 'Task template ID is required.' })
      } else {
        if (taskIds.has(task.task_template_id)) {
          errors.push({ field: `tasks[${index}].task_template_id`, message: `Duplicate task template ID: ${task.task_template_id}.` })
        }
        taskIds.add(task.task_template_id)
      }
      if (!task.title) {
        errors.push({ field: `tasks[${index}].title`, message: 'Task title is required.' })
      }
      if (typeof task.relativeDay !== 'number' || task.relativeDay < 0 || task.relativeDay > template.lifecycleDuration) {
        errors.push({
          field: `tasks[${index}].relativeDay`,
          message: `Relative day (${task.relativeDay}) must be between 0 and lifecycle duration (${template.lifecycleDuration}).`
        })
      }
      if (task.is_recurring && (!task.recurrence_interval_days || task.recurrence_interval_days <= 0)) {
        errors.push({
          field: `tasks[${index}].recurrence_interval_days`,
          message: 'Recurring tasks must define a positive recurrence interval.'
        })
      }
    })
  }

  // Weather sensitivity checks
  const ws = template.weatherSensitivity
  if (!ws) {
    errors.push({ field: 'weatherSensitivity', message: 'Weather sensitivity parameters are required.' })
  } else {
    const fields: (keyof typeof ws)[] = ['maxTempThreshold', 'minTempThreshold', 'windSpeedThreshold', 'humidityThreshold', 'rainThreshold']
    fields.forEach(f => {
      if (typeof ws[f] !== 'number') {
        errors.push({ field: `weatherSensitivity.${f}`, message: `${f} must be a number.` })
      }
    })
  }

  return errors
}
