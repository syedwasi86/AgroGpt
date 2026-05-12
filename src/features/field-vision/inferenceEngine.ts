import * as tf from '@tensorflow/tfjs'
import { loadCropModel } from './tfModelLoader'
import { preprocessImage } from './imagePreprocessor'
import { CROP_DISEASES } from './diseaseRecommendations'

export interface PredictionResult {
  crop: string
  disease: string
  confidence: number
}

export async function runInference(crop: string, img: HTMLImageElement): Promise<PredictionResult | null> {
  const model = await loadCropModel(crop)
  if (!model) {
    return null // model missing
  }

  // Force CPU backend. WebGL often lacks support for MobileNetV3's _fusedhardswish 
  // operation on many devices. CPU is stable and fast enough for this lightweight model.
  await tf.setBackend('cpu')
  await tf.ready()

  const tensor = preprocessImage(img)
  
  let prediction: tf.Tensor
  try {
    const result = model.predict(tensor)
    prediction = Array.isArray(result) ? result[0] : result as tf.Tensor
  } catch (err) {
    console.error("Inference failed", err)
    tensor.dispose()
    return null
  }

  const data = await prediction.data()
  tensor.dispose()
  prediction.dispose()

  let maxIdx = 0
  let maxConfidence = data[0]
  for (let i = 1; i < data.length; i++) {
    if (data[i] > maxConfidence) {
      maxConfidence = data[i]
      maxIdx = i
    }
  }

  const diseases = CROP_DISEASES[crop.toLowerCase()] || ['Unknown']
  const disease = diseases[maxIdx] || 'Unknown'

  return {
    crop,
    disease,
    confidence: Math.round(maxConfidence * 100)
  }
}
