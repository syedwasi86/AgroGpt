import { runInference } from '../lib/engine'
import * as tf from '@tensorflow/tfjs'

export type AIMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type AIReply = {
  text: string
  source: 'mock' | 'endpoint' | 'local_tfjs'
}

let localModel: tf.GraphModel | null = null

async function loadLocalModel() {
  if (!localModel) {
    // In production, load from cached PWA asset: tf.loadGraphModel('/models/agro-offline/model.json')
    await new Promise(resolve => setTimeout(resolve, 500))
    localModel = {} as unknown as tf.GraphModel // Stub until real model is provided
  }
  return localModel
}

async function localInference(prompt: string): Promise<string> {
  await loadLocalModel()
  const s = prompt.toLowerCase()
  if (s.includes('today') || s.includes('action')) {
    return '[Offline] Daily action: Scout 10 plants at sunrise for early thrips/leaf curl. If threshold crossed, apply neem oil spray in the 6–8 AM window; otherwise delay pesticide and maintain steady irrigation.'
  }
  if (s.includes('water') || s.includes('irrig')) {
    return '[Offline] Irrigation: For red sandy loam, use shorter intervals with moderate volume. Prefer early morning; avoid waterlogging and check moisture 5–7 cm below surface before the next cycle.'
  }
  if (s.includes('fertil') || s.includes('npk')) {
    return '[Offline] Nutrition: Split fertilizer into smaller doses aligned with crop stage. Over-nitrogen can increase pest pressure; adjust gradually and prefer soil-moisture-aware application.'
  }
  if (s.includes('pest') || s.includes('risk')) {
    return '[Offline] Pest risk: Warm nights + humidity increase thrips/aphid risk. Use sticky traps and inspect undersides of young leaves. Escalate to IPM spray only if 2-day risk stays medium/high.'
  }
  return '[Offline] I can help with pests, irrigation, fertilizer, and finance. You are currently offline. Basic model loaded.'
}

export async function askAgroGPT(prompt: string, context?: { page?: string; location?: string; soil?: string }) {
  if (!navigator.onLine) {
    try {
      const text = await localInference(prompt)
      return { text, source: 'local_tfjs' } satisfies AIReply
    } catch (e) {
      console.error("Local model failed", e)
      return { text: "You are offline and the local AI model could not be loaded.", source: 'local_tfjs' } satisfies AIReply
    }
  }

  const endpoint = import.meta.env.VITE_AI_ENDPOINT as string | undefined
  if (endpoint) {
    // Placeholder for real backend API call
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt,
        context,
      }),
    })
    if (!res.ok) {
      throw new Error(`AI endpoint error (${res.status})`)
    }
    const data = (await res.json()) as { text?: string }
    return { text: data.text ?? 'No response text returned.', source: 'endpoint' } satisfies AIReply
  }

  // Fallback for online but no endpoint configured (e.g., dev mode)
  try {
    await runInference({ prompt, context })
  } catch (err) {
    console.error("Inference engine error:", err)
  }

  const s = prompt.toLowerCase()
  let text = 'I can help with pests, irrigation liters, fertilizer kg, finance entries, and market grading. Configure `VITE_AI_ENDPOINT` to connect a real AI backend.'
  if (s.includes('today') || s.includes('action')) {
    text = 'Daily action: Scout 10 plants at sunrise for early thrips/leaf curl. If threshold crossed, apply neem oil spray in the 6–8 AM window; otherwise delay pesticide and maintain steady irrigation.'
  } else if (s.includes('water') || s.includes('irrig')) {
    text = 'Irrigation: For red sandy loam, use shorter intervals with moderate volume. Prefer early morning; avoid waterlogging and check moisture 5–7 cm below surface before the next cycle.'
  } else if (s.includes('fertil') || s.includes('npk')) {
    text = 'Nutrition: Split fertilizer into smaller doses aligned with crop stage. Over-nitrogen can increase pest pressure; adjust gradually and prefer soil-moisture-aware application.'
  } else if (s.includes('pest') || s.includes('risk')) {
    text = 'Pest risk: Warm nights + humidity increase thrips/aphid risk. Use sticky traps and inspect undersides of young leaves. Escalate to IPM spray only if 2-day risk stays medium/high.'
  }

  return { text, source: 'mock' } satisfies AIReply
}

