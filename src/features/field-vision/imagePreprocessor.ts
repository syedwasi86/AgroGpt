import * as tf from '@tensorflow/tfjs'

export async function validateImage(img: HTMLImageElement): Promise<{ valid: boolean; reason?: string }> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return { valid: false, reason: "Canvas not supported" }

  canvas.width = img.width
  canvas.height = img.height
  ctx.drawImage(img, 0, 0)
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  let brightnessSum = 0
  for (let i = 0; i < data.length; i += 4) {
    brightnessSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  const avgBrightness = brightnessSum / (data.length / 4)

  if (avgBrightness < 20) return { valid: false, reason: "Image is too dark" }
  if (avgBrightness > 240) return { valid: false, reason: "Image is too bright" }

  return { valid: true }
}

export function preprocessImage(img: HTMLImageElement, crop?: string): tf.Tensor {
  return tf.tidy(() => {
    let tensor = tf.browser.fromPixels(img).toFloat()
    
    // MobileNetV2 models (Maize, Cotton, Chili, Rice, Tomato) expect inputs in [-1, 1]
    // MobileNetV3 models (others, for now) have a Rescaling layer built into the model
    if (crop && ['maize', 'cotton', 'chili', 'rice', 'tomato'].includes(crop.toLowerCase())) {
      tensor = tensor.div(127.5).sub(1)
    }

    const resized = tf.image.resizeBilinear(tensor, [224, 224])
    return resized.expandDims(0)
  })
}
