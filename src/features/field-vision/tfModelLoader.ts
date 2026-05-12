import * as tf from '@tensorflow/tfjs'

export const SUPPORTED_CROPS = ['Chili', 'Cotton', 'Maize', 'Rice', 'Tomato']
const MODEL_BASE_URL = '/models'
const modelCache: Record<string, tf.GraphModel | tf.LayersModel> = {}

export async function loadCropModel(crop: string): Promise<tf.GraphModel | tf.LayersModel | null> {
  const cropLower = crop.toLowerCase()
  if (modelCache[cropLower]) {
    return modelCache[cropLower]
  }

  try {
    const modelUrl = `${MODEL_BASE_URL}/${cropLower}/model.json`
    try {
      const model = await tf.loadLayersModel(modelUrl)
      modelCache[cropLower] = model
      return model
    } catch (e) {
      const model = await tf.loadGraphModel(modelUrl)
      modelCache[cropLower] = model
      return model
    }
  } catch (error) {
    console.warn(`Model not installed yet for ${cropLower}.`, error)
    return null
  }
}
