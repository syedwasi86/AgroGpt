import { cropCalendarRepository } from '../repositories/cropCalendarRepository'
import { generateCropSchedule, type GenerationInput } from '../engines/scheduleGenerator'
import { processWeatherAdjustments, type WeatherAlert } from '../engines/weatherAdjustmentEngine'
import type { FarmTaskRecord } from '../../../lib/db'
import type { DailyWeatherData } from '../../gis/services/weatherService'
import type { WeatherSensitivity } from '../types'

export const cropCalendarService = {
  /**
   * Generates and persists a new crop calendar plan, including its stages and tasks.
   */
  async initializeCropPlan(input: GenerationInput): Promise<string> {
    const { plan, stages, tasks } = generateCropSchedule(input)
    await cropCalendarRepository.createCropPlanTransaction(plan, stages, tasks)
    return plan.id
  },

  /**
   * Toggles completion status of a task and increments its offline version.
   */
  async toggleTaskCompletion(task: FarmTaskRecord): Promise<void> {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
    const updated: FarmTaskRecord = {
      ...task,
      status: nextStatus
    }
    await cropCalendarRepository.updateTask(updated)
  },

  /**
   * Updates custom notes on a task.
   */
  async updateTaskNotes(task: FarmTaskRecord, notes: string): Promise<void> {
    const updated: FarmTaskRecord = {
      ...task,
      notes
    }
    await cropCalendarRepository.updateTask(updated)
  },

  /**
   * Applies the daily weather forecast to the crop calendar tasks, triggering rain delays
   * and saving adjustments in a single transaction. Returns transient weather alerts.
   */
  async applyWeatherForecast(
    planId: string,
    weather: DailyWeatherData,
    sensitivity: WeatherSensitivity
  ): Promise<WeatherAlert[]> {
    const tasks = await cropCalendarRepository.getTasksForPlan(planId)
    
    // Process weather forecast data against crop sensitivity parameters
    const { adjustedTasks, newAdjustments, alerts } = processWeatherAdjustments(
      planId,
      tasks,
      weather,
      sensitivity
    )

    // Save adjusted tasks and adjustments logs in a transaction
    if (adjustedTasks.length > 0) {
      // Loop over adjusted tasks and write adjustments logs
      for (let i = 0; i < adjustedTasks.length; i++) {
        const task = adjustedTasks[i]
        const adjLog = newAdjustments.find(a => a.task_id === task.id)
        if (adjLog) {
          await cropCalendarRepository.createWeatherAdjustmentTransaction(adjLog, [task])
        }
      }
    }

    return alerts
  },

  /**
   * Cleans up and soft-deletes a crop plan.
   */
  async deleteCropPlan(planId: string): Promise<void> {
    await cropCalendarRepository.softDeletePlan(planId)
  }
}
