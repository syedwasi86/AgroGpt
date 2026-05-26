export interface WeatherSensitivity {
  maxTempThreshold: number
  minTempThreshold: number
  windSpeedThreshold: number
  humidityThreshold: number
  rainThreshold: number
}

export interface CropTaskTemplate {
  task_template_id: string
  title: string
  description?: string
  taskType: 'irrigation' | 'fertilization' | 'pesticide' | 'weeding' | 'harvesting' | 'inspection' | 'other'
  relativeDay: number
  priority: 'low' | 'medium' | 'high'
  is_recurring: boolean
  recurrence_interval_days?: number
}

export interface CropStageTemplate {
  name: string
  durationDays: number
  description?: string
  icon: 'sprout' | 'leaf' | 'flower' | 'wheat' | 'scissors'
}

export interface CropTemplate {
  cropName: string
  variety: string
  lifecycleDuration: number
  stages: CropStageTemplate[]
  tasks: CropTaskTemplate[]
  weatherSensitivity: WeatherSensitivity
}
