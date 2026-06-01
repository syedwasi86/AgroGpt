import { weatherRules } from './weatherRules'
import { addDaysUtc } from '../utils/dateUtils'
import type { WeatherSensitivity } from '../types'
import type { FarmTaskRecord, WeatherAdjustmentRecord } from '../../../lib/db'
import type { DailyWeatherData } from '../../gis/services/weatherService'

export interface WeatherAlert {
  date: string
  type: 'irrigation_delay' | 'spray_warning' | 'disease_warning' | 'heat_stress'
  severity: 'info' | 'warning' | 'danger'
  message: string
}

export interface WeatherAdjustmentResult {
  adjustedTasks: FarmTaskRecord[]
  newAdjustments: WeatherAdjustmentRecord[]
  alerts: WeatherAlert[]
}

export function processWeatherAdjustments(
  planId: string,
  tasks: FarmTaskRecord[],
  weather: DailyWeatherData,
  sensitivity: WeatherSensitivity
): WeatherAdjustmentResult {
  const adjustedTasks: FarmTaskRecord[] = []
  const newAdjustments: WeatherAdjustmentRecord[] = []
  const alerts: WeatherAlert[] = []
  const nowStr = new Date().toISOString()

  // Track task IDs that we have already modified during this run to avoid duplicate updates
  const modifiedTaskIds = new Set<string>()

  // Loop through all forecast days
  weather.time.forEach((dateStr, idx) => {
    const precip = weather.precipitation_sum[idx] ?? 0
    const tempMax = weather.temperature_2m_max[idx] ?? 0
    const windSpeed = weather.wind_speed_10m_max?.[idx] ?? 0
    const humidity = weather.relative_humidity_2m_max?.[idx] ?? 0

    // 1. Evaluate Rain-based Irrigation Delay
    const rainResult = weatherRules.evaluateIrrigationDelay(precip, sensitivity)
    if (rainResult.hasAlert) {
      alerts.push({
        date: dateStr,
        type: 'irrigation_delay',
        severity: 'warning',
        message: rainResult.message || ''
      })

      // Find irrigation tasks scheduled for this day
      const irrigationTasks = tasks.filter(t => 
        t.task_type === 'irrigation' && 
        t.status === 'pending' && 
        t.effective_date === dateStr &&
        !modifiedTaskIds.has(t.id)
      )

      irrigationTasks.forEach(task => {
        // Delay by 1 day if moderate rain, 2 days if heavy rain (> 10mm)
        const delayDays = precip > 10 ? 2 : 1
        const newEffectiveDate = addDaysUtc(task.effective_date, delayDays)

        // Update task effective fields
        const updatedTask: FarmTaskRecord = {
          ...task,
          effective_date: newEffectiveDate,
          task_date: newEffectiveDate, // keep task_date matching effective_date
          status: 'rescheduled',
          origin: 'weather_adjustment'
        }

        adjustedTasks.push(updatedTask)
        modifiedTaskIds.add(task.id)

        // Log the adjustment details
        newAdjustments.push({
          id: crypto.randomUUID(),
          plan_id: planId,
          task_id: task.id,
          adjustment_type: 'irrigation_delay',
          reason: `Rain of ${precip}mm predicted. Rescheduled from ${task.effective_date} to ${newEffectiveDate}.`,
          original_date: task.scheduled_date,
          adjusted_date: newEffectiveDate,
          weather_data: { precipitation: precip, temperature: tempMax, wind: windSpeed, humidity },
          applied_at: nowStr,
          version: 1,
          sync_status: 'pending',
          created_at: nowStr,
          updated_at: nowStr,
          deleted_at: null
        })
      })
    }

    // 2. Evaluate Wind-based Spray Warnings
    const windResult = weatherRules.evaluateSprayWarning(windSpeed, sensitivity)
    if (windResult.hasAlert) {
      alerts.push({
        date: dateStr,
        type: 'spray_warning',
        severity: 'danger',
        message: windResult.message || ''
      })
    }

    // 3. Evaluate Humidity Disease Warnings
    const humResult = weatherRules.evaluateDiseaseRisk(humidity, sensitivity)
    if (humResult.hasAlert) {
      alerts.push({
        date: dateStr,
        type: 'disease_warning',
        severity: 'warning',
        message: humResult.message || ''
      })
    }

    // 4. Evaluate Heat Stress Warnings
    const heatResult = weatherRules.evaluateHeatStress(tempMax, sensitivity)
    if (heatResult.hasAlert) {
      alerts.push({
        date: dateStr,
        type: 'heat_stress',
        severity: 'danger',
        message: heatResult.message || ''
      })
    }
  })

  return { adjustedTasks, newAdjustments, alerts }
}
