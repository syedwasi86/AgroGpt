export interface ValidationError {
  field: string
  message: string
}

export const cropTemplateSchema = {
  cropName: { required: true, type: 'string' },
  variety: { required: true, type: 'string' },
  lifecycleDuration: { required: true, type: 'number', min: 1 },
  stages: { required: true, type: 'array' },
  tasks: { required: true, type: 'array' },
  weatherSensitivity: {
    required: true,
    fields: {
      maxTempThreshold: { required: true, type: 'number' },
      minTempThreshold: { required: true, type: 'number' },
      windSpeedThreshold: { required: true, type: 'number' },
      humidityThreshold: { required: true, type: 'number' },
      rainThreshold: { required: true, type: 'number' }
    }
  }
}
