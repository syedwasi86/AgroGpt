import { db } from '../../../lib/db'
import type { CropPlanRecord, CropStageRecord, FarmTaskRecord, WeatherAdjustmentRecord } from '../../../lib/db'

export const cropCalendarRepository = {
  async getPlan(id: string): Promise<CropPlanRecord | undefined> {
    const plan = await db.crop_plans.get(id)
    if (plan?.deleted_at) return undefined
    return plan
  },

  async getActivePlan(userId?: string): Promise<CropPlanRecord | null> {
    const plans = await db.crop_plans
      .where('status')
      .equals('active')
      .toArray()
    
    // Filter out soft-deleted plans and filter by user_id if logged in
    const active = plans.filter(p => !p.deleted_at && (!userId || p.user_id === userId))
    return active[0] || null
  },

  async getAllPlans(userId?: string): Promise<CropPlanRecord[]> {
    const plans = await db.crop_plans.toArray()
    return plans.filter(p => !p.deleted_at && (!userId || p.user_id === userId))
  },

  async getStagesForPlan(planId: string): Promise<CropStageRecord[]> {
    const stages = await db.crop_stages
      .where('plan_id')
      .equals(planId)
      .toArray()
    return stages.filter(s => !s.deleted_at)
  },

  async getTasksForPlan(planId: string): Promise<FarmTaskRecord[]> {
    const tasks = await db.farm_tasks
      .where('plan_id')
      .equals(planId)
      .toArray()
    return tasks.filter(t => !t.deleted_at)
  },

  async getWeatherAdjustmentsForPlan(planId: string): Promise<WeatherAdjustmentRecord[]> {
    const adjustments = await db.weather_adjustments
      .where('plan_id')
      .equals(planId)
      .toArray()
    return adjustments.filter(a => !a.deleted_at)
  },

  /**
   * Save a newly generated crop plan, stages, and tasks in a single database transaction.
   */
  async createCropPlanTransaction(
    plan: CropPlanRecord,
    stages: CropStageRecord[],
    tasks: FarmTaskRecord[]
  ): Promise<void> {
    await db.transaction('rw', [db.crop_plans, db.crop_stages, db.farm_tasks], async () => {
      await db.crop_plans.add(plan)
      for (const stage of stages) {
        await db.crop_stages.add(stage)
      }
      for (const task of tasks) {
        await db.farm_tasks.add(task)
      }
    })
  },

  async updateTask(task: FarmTaskRecord): Promise<void> {
    const now = new Date().toISOString()
    const updatedTask: FarmTaskRecord = {
      ...task,
      version: (task.version || 0) + 1,
      sync_status: 'pending',
      updated_at: now
    }
    await db.farm_tasks.put(updatedTask)
  },

  async updateStage(stage: CropStageRecord): Promise<void> {
    const now = new Date().toISOString()
    const updatedStage: CropStageRecord = {
      ...stage,
      version: (stage.version || 0) + 1,
      sync_status: 'pending',
      updated_at: now
    }
    await db.crop_stages.put(updatedStage)
  },

  async updatePlan(plan: CropPlanRecord): Promise<void> {
    const now = new Date().toISOString()
    const updatedPlan: CropPlanRecord = {
      ...plan,
      version: (plan.version || 0) + 1,
      sync_status: 'pending',
      updated_at: now
    }
    await db.crop_plans.put(updatedPlan)
  },

  /**
   * Adds a weather adjustment log and bulk-updates delayed tasks.
   */
  async createWeatherAdjustmentTransaction(
    adjustment: WeatherAdjustmentRecord,
    updatedTasks: FarmTaskRecord[]
  ): Promise<void> {
    const now = new Date().toISOString()
    await db.transaction('rw', [db.weather_adjustments, db.farm_tasks], async () => {
      await db.weather_adjustments.add(adjustment)
      for (const task of updatedTasks) {
        const updatedTask: FarmTaskRecord = {
          ...task,
          version: (task.version || 0) + 1,
          sync_status: 'pending',
          updated_at: now
        }
        await db.farm_tasks.put(updatedTask)
      }
    })
  },

  /**
   * Soft-deletes a crop plan and all its associated stages and tasks.
   */
  async softDeletePlan(planId: string): Promise<void> {
    const now = new Date().toISOString()
    
    await db.transaction('rw', [db.crop_plans, db.crop_stages, db.farm_tasks, db.weather_adjustments], async () => {
      const plan = await db.crop_plans.get(planId)
      if (plan) {
        await db.crop_plans.put({
          ...plan,
          deleted_at: now,
          sync_status: 'pending',
          version: (plan.version || 0) + 1,
          updated_at: now
        })
      }

      const stages = await db.crop_stages.where('plan_id').equals(planId).toArray()
      for (const stage of stages) {
        await db.crop_stages.put({
          ...stage,
          deleted_at: now,
          sync_status: 'pending',
          version: (stage.version || 0) + 1,
          updated_at: now
        })
      }

      const tasks = await db.farm_tasks.where('plan_id').equals(planId).toArray()
      for (const task of tasks) {
        await db.farm_tasks.put({
          ...task,
          deleted_at: now,
          sync_status: 'pending',
          version: (task.version || 0) + 1,
          updated_at: now
        })
      }

      const adjustments = await db.weather_adjustments.where('plan_id').equals(planId).toArray()
      for (const adj of adjustments) {
        await db.weather_adjustments.put({
          ...adj,
          deleted_at: now,
          sync_status: 'pending',
          version: (adj.version || 0) + 1,
          updated_at: now
        })
      }
    })
  }
}
