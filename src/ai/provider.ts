/**
 * AgroGPT AI Provider
 * ─────────────────────────────────────────────────────────────────────────────
 * Hybrid mode:
 *   • Online + VITE_GEMINI_API_KEY present  → Gemini 1.5 Flash (live)
 *   • Online + no key                        → keyword mock (dev fallback)
 *   • Offline                                → keyword mock + queue to Dexie
 *   • API error (429 / network fail)         → keyword mock + keep in queue
 *
 * SECURITY: API key is only ever accessed via import.meta.env.VITE_GEMINI_API_KEY.
 * It is never hard-coded anywhere in this file.
 */

import i18next from 'i18next'
import { db } from '../lib/db'

// ── Types ────────────────────────────────────────────────────────────────────

export type AIMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type AIReply = {
  text: string
  source: 'mock' | 'gemini' | 'local_tfjs' | 'error'
}

export type AIContext = {
  page?: string
  location?: string
  soil?: string
}

/** Thrown when the Gemini call fails so callers can keep the query queued. */
export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'GeminiError'
  }
}

// ── Language helpers ─────────────────────────────────────────────────────────

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi (हिंदी)',
  te: 'Telugu (తెలుగు)',
  ta: 'Tamil (தமிழ்)',
  kn: 'Kannada (ಕನ್ನಡ)',
  mr: 'Marathi (मराठी)',
  gu: 'Gujarati (ગુજરાતી)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
  bn: 'Bengali (বাংলা)',
  ur: 'Urdu (اردو)',
}

function resolveLanguageInstruction(): { code: string; name: string } {
  const code = i18next.resolvedLanguage ?? i18next.language ?? 'en'
  const base = code.split('-')[0]
  const name = LANGUAGE_NAMES[base] ?? 'English'
  return { code: base, name }
}

// ── Offline keyword mock ─────────────────────────────────────────────────────

export function localInference(prompt: string): string {
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

// ── RAG context fetch ────────────────────────────────────────────────────────

interface RAGContext {
  cropName: string
  soilType: string
  nitrogen: string
  phosphorus: string
  potassium: string
  tempC: string
}

async function fetchRAGContext(): Promise<RAGContext> {
  // 1. Active crop
  let cropName = 'N/A'
  try {
    const activeCrop = await db.crops.where('status').equals('active').first()
    if (activeCrop?.name) cropName = activeCrop.name
  } catch { /* ignore */ }

  // 2. Soil NPK from user profile
  let soilType = 'N/A'
  let nitrogen = 'N/A'
  let phosphorus = 'N/A'
  let potassium = 'N/A'
  try {
    const profile = await db.profiles.get(1)
    if (profile) {
      soilType = profile.soilType ?? 'N/A'
      nitrogen = profile.nitrogen != null ? String(profile.nitrogen) : 'N/A'
      phosphorus = profile.phosphorus != null ? String(profile.phosphorus) : 'N/A'
      potassium = profile.potassium != null ? String(profile.potassium) : 'N/A'
    }
  } catch { /* ignore */ }

  // 3. Latest weather from Dexie cache (offline-first)
  let tempC = 'N/A'
  try {
    const entries = await db.weatherCache.orderBy('timestamp').reverse().first()
    // Support both OpenWeatherMap and WeatherAPI response shapes
    const temp =
      entries?.data?.main?.temp ??
      entries?.data?.current?.temp_c ??
      entries?.data?.current?.temp ??
      null
    if (temp != null) tempC = String(Math.round(Number(temp)))
  } catch { /* ignore */ }

  return { cropName, soilType, nitrogen, phosphorus, potassium, tempC }
}

// ── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(rag: RAGContext, langCode: string, langName: string): string {
  const missingFields: string[] = []
  if (rag.cropName === 'N/A') missingFields.push('active crop')
  if (rag.nitrogen === 'N/A' || rag.phosphorus === 'N/A' || rag.potassium === 'N/A') {
    missingFields.push('soil NPK values')
  }
  if (rag.tempC === 'N/A') missingFields.push('current weather / temperature')

  // RAG safety guardrail — inserted only when data gaps exist
  const dataGuardrail =
    missingFields.length > 0
      ? `\n\nIMPORTANT DATA GUARDRAIL: The following farm data is currently unavailable: ${missingFields.join(', ')}. Do NOT guess or fabricate these values. Instead, politely inform the farmer that this information is missing and ask them to update their profile (Settings → Farm Profile) or provide the details directly in the chat, so you can give a more accurate and personalised answer.`
      : ''

  return (
    `You are an expert Agronomist specialising in farming conditions in India. ` +
    `You give concise, actionable advice tailored to the farmer's specific context.\n\n` +
    `Farmer Context:\n` +
    `• Active Crop   : ${rag.cropName}\n` +
    `• Soil Type     : ${rag.soilType}\n` +
    `• Soil NPK      : N=${rag.nitrogen} | P=${rag.phosphorus} | K=${rag.potassium}\n` +
    `• Temperature   : ${rag.tempC}°C\n\n` +
    `Language Instruction: Respond ENTIRELY in ${langName} (ISO code: ${langCode}). ` +
    `Do not switch to English unless the farmer writes to you in English first.` +
    dataGuardrail
  )
}

// ── Gemini 1.5 Flash API call ─────────────────────────────────────────────────

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Call Gemini 1.5 Flash with full RAG context.
 * Throws `GeminiError` on API/network failure so callers can fall back gracefully.
 */
export async function callGeminiAPI(prompt: string): Promise<AIReply> {
  // Security: key accessed only via import.meta.env — never hardcoded.
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  if (!apiKey) {
    throw new GeminiError('VITE_GEMINI_API_KEY is not configured.')
  }

  const rag = await fetchRAGContext()
  const { code: langCode, name: langName } = resolveLanguageInstruction()
  const systemText = buildSystemPrompt(rag, langCode, langName)

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            // Combine your system prompt and user prompt into one block
            text: `INSTRUCTIONS: ${systemText}\n\nUSER QUESTION: ${prompt}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      topK: 40,
      topP: 0.9,
      maxOutputTokens: 2048,
    },
  }

  let response: Response
  try {
    response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (networkErr) {
    throw new GeminiError(
      `Network error reaching Gemini API: ${networkErr instanceof Error ? networkErr.message : String(networkErr)}`,
    )
  }

  if (!response.ok) {
    throw new GeminiError(
      `Gemini API returned HTTP ${response.status}`,
      response.status,
    )
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
    'No response received from Gemini.'

  return { text, source: 'gemini' }
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Ask AgroGPT a question.
 *
 * Routing (caller has already confirmed connectivity via probeConnectivity):
 *   key present → Gemini 1.5 Flash
 *   no key      → keyword mock (dev fallback)
 *   API error   → throws GeminiError so caller can fall back + queue
 */
export async function askAgroGPT(
  prompt: string,
  _context?: AIContext,
): Promise<AIReply> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  // 1. If no key is found in .env at all
  if (!apiKey) {
    return { text: buildOnlineMockResponse(prompt), source: 'mock' };
  }

  try {
    // 2. Attempt the real API call
    return await callGeminiAPI(prompt);
  } catch (err: any) {
    // 3. CHECK THE ERROR TYPE
    // If it's a 403 or 401, the user IS online, but the key is the problem.
    if (err.status === 403 || err.status === 401) {
      return {
        text: `⚠️ API Key Error: Google rejected your request (403). Please ensure your key in .env.local has no quotes and is valid.`,
        source: 'error'
      };
    }

    // 4. If it's a real network failure (e.g., DNS error), THEN throw
    // so the UI can show the [Offline] message and queue the question.
    console.error('[AgroGPT] Gemini call failed:', err);
    throw err;
  }
}

// ── Online keyword mock (dev / no-key fallback) ───────────────────────────────

function buildOnlineMockResponse(prompt: string): string {
  const s = prompt.toLowerCase()
  if (s.includes('today') || s.includes('action')) {
    return 'Daily action: Scout 10 plants at sunrise for early thrips/leaf curl. If threshold crossed, apply neem oil spray in the 6–8 AM window; otherwise delay pesticide and maintain steady irrigation.'
  }
  if (s.includes('water') || s.includes('irrig')) {
    return 'Irrigation: For red sandy loam, use shorter intervals with moderate volume. Prefer early morning; avoid waterlogging and check moisture 5–7 cm below surface before the next cycle.'
  }
  if (s.includes('fertil') || s.includes('npk')) {
    return 'Nutrition: Split fertilizer into smaller doses aligned with crop stage. Over-nitrogen can increase pest pressure; adjust gradually and prefer soil-moisture-aware application.'
  }
  if (s.includes('pest') || s.includes('risk')) {
    return 'Pest risk: Warm nights + humidity increase thrips/aphid risk. Use sticky traps and inspect undersides of young leaves. Escalate to IPM spray only if 2-day risk stays medium/high.'
  }
  return 'I can help with pests, irrigation, fertilizer, and finance. Configure VITE_GEMINI_API_KEY in .env.local to connect Gemini 1.5 Flash.'
}
