import type {
  DiseaseKnowledgeBaseEntry,
  AIRecommendationResponse,
  SeverityLevel
} from '../features/field-vision/types';
import i18next from 'i18next';
import { sanitizeEnumKey } from '../hooks/useEnumTranslation';
import { sanitizeJsonString } from '../utils/jsonSanitizer';
import { db } from '../lib/db';
import { getUserLocation } from '../core/utils/geolocation';
import { fetchWeather } from '../features/gis/services/weatherService';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi (हिंदी)',
  te: 'Telugu (తెలుగు)',
  ta: 'Tamil (தமிழ்)',
  kn: 'Kannada (ಕನ್ನಡ)',
  mr: 'Marathi (మరాठी)',
  gu: 'Gujarati (ગુજરાતી)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
  bn: 'Bengali (বাংলা)',
  ur: 'Urdu (اردو)',
};

function resolveLanguage(): { code: string; name: string } {
  const code = i18next.resolvedLanguage ?? i18next.language ?? 'en';
  const base = code.split('-')[0];
  const name = LANGUAGE_NAMES[base] ?? 'English';
  return { code: base, name };
}

/**
 * Builds a local, safe fallback response in case the Gemini API call fails,
 * is offline, or returns malformed data. This keeps the application robust.
 */
export function getAIFallbackResponse(
  crop: string,
  disease: string,
  severity: SeverityLevel,
  kbData: DiseaseKnowledgeBaseEntry | null
): AIRecommendationResponse {
  const isHealthy = disease.toLowerCase().includes('healthy') || kbData?.id.endsWith('_healthy');

  const transCrop = i18next.t(`enums:cropType.${sanitizeEnumKey(crop)}`, { defaultValue: crop });
  const transDisease = i18next.t(`enums:diagnosis.${sanitizeEnumKey(disease)}`, { defaultValue: disease });

  if (isHealthy) {
    return {
      summary: i18next.t('fieldVision:fallbackHealthySummary', { defaultValue: 'Your {{crop}} crop is looking healthy! Continue maintaining proper field management.', crop: transCrop }),
      urgency: i18next.t('fieldVision:fallbackHealthyUrgency', { defaultValue: 'Routine monitoring only. No immediate treatment needed.' }),
      preventionTips: kbData?.prevention.slice(0, 2) || [
        i18next.t('fieldVision:fallbackHealthyPrev1', { defaultValue: 'Use certified disease-free seeds.' }),
        i18next.t('fieldVision:fallbackHealthyPrev2', { defaultValue: 'Ensure proper soil drainage.' })
      ],
      weatherRiskNote: i18next.t('fieldVision:fallbackHealthyWeather', { defaultValue: 'Keep checking soil moisture during dry and wet periods alike.' }),
      expertAdvice: i18next.t('fieldVision:fallbackHealthyExpert', { defaultValue: 'No expert guidance needed at this time.' }),
      priorityActions: [
        i18next.t('fieldVision:fallbackHealthyAction1', { defaultValue: 'Regularly inspect crop foliage for new changes.' }),
        i18next.t('fieldVision:fallbackHealthyAction2', { defaultValue: 'Ensure standard crop hydration.' })
      ],
      next48HourRisk: i18next.t('fieldVision:fallbackHealthyRisk', { defaultValue: 'Low weather risk. Weather is favorable for healthy growth.' })
    };
  }

  const baseSummary = kbData
    ? kbData.farmerFriendlyExplanation
    : i18next.t('fieldVision:fallbackDiseasedSummary', { defaultValue: 'Your {{crop}} crop has been diagnosed with {{disease}}.', crop: transCrop, disease: transDisease });

  const urgencyText = severity === 'high'
    ? i18next.t('fieldVision:fallbackUrgencyHigh', { defaultValue: 'High priority. Widespread crop damage could occur if not treated immediately.' })
    : severity === 'medium'
      ? i18next.t('fieldVision:fallbackUrgencyMedium', { defaultValue: 'Medium priority. Actions should be taken within the next few days.' })
      : i18next.t('fieldVision:fallbackUrgencyLow', { defaultValue: 'Low priority. Keep a close eye on the plant and perform preventive measures.' });

  const expertAdviceText = severity === 'high'
    ? i18next.t('fieldVision:fallbackDiseasedExpertHigh', { defaultValue: 'We recommend consulting a local agricultural extension officer to verify local spray effectiveness.' })
    : i18next.t('fieldVision:fallbackDiseasedExpertLow', { defaultValue: 'Standard local practices are sufficient.' });

  return {
    summary: baseSummary,
    urgency: urgencyText,
    preventionTips: kbData?.prevention.slice(0, 3) || [
      i18next.t('fieldVision:fallbackDiseasedPrev1', { defaultValue: 'Rotate crops.' }),
      i18next.t('fieldVision:fallbackDiseasedPrev2', { defaultValue: 'Use clean farm tools.' })
    ],
    weatherRiskNote: kbData?.spreadConditions
      ? `Spreads under: Humidity: ${kbData.spreadConditions.humidity || 'N/A'}, Temp: ${kbData.spreadConditions.temperature || 'N/A'}`
      : i18next.t('fieldVision:fallbackDiseasedWeather', { defaultValue: 'Monitor weather reports for high humidity conditions.' }),
    expertAdvice: expertAdviceText,
    priorityActions: kbData?.immediateActions[severity].slice(0, 3) || [
      i18next.t('fieldVision:fallbackDiseasedAction1', { defaultValue: 'Isolate infected areas.' }),
      i18next.t('fieldVision:fallbackDiseasedAction2', { defaultValue: 'Avoid high moisture conditions.' })
    ],
    next48HourRisk: i18next.t('fieldVision:fallbackDiseasedRisk', { defaultValue: 'Infection is active in the field. Favorable humidity levels could trigger rapid progression.' })
  };
}

/**
 * Cleans the Gemini response string and parses it into a JSON object.
 * Handles:
 *  - Markdown code blocks (e.g. ```json ... ```)
 *  - Literal raw newlines inside string values (converts to escaped \n)
 *  - Fallback field extraction using regex if the JSON remains malformed due to unescaped quotes.
 */
function cleanAndParseJSON(text: string): unknown {
  let cleaned = text.trim();

  try {
    const sanitized = sanitizeJsonString(cleaned);
    return JSON.parse(sanitized);
  } catch (firstErr) {
    console.warn('[AgroGPT AI] Direct JSON parse failed, attempting advanced sanitization:', firstErr);
    try {
      // 2. Escape actual raw literal newlines within string literals
      let inQuote = false;
      const chars = cleaned.split('');
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === '"' && chars[i - 1] !== '\\') {
          inQuote = !inQuote;
        }
        if (inQuote && chars[i] === '\n') {
          chars[i] = '\\n';
        }
        if (inQuote && chars[i] === '\r') {
          chars[i] = '';
        }
      }
      cleaned = chars.join('');
      const sanitized = sanitizeJsonString(cleaned);
      return JSON.parse(sanitized);
    } catch (secondErr) {
      // 3. Fallback regex extraction for fields to ensure we don't crash
      console.error('[AgroGPT AI] Advanced JSON sanitization failed. Raw text received:\n' + text + '\nError:', secondErr);

      const summaryMatch = cleaned.match(/"summary"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/);
      const urgencyMatch = cleaned.match(/"urgency"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/);
      const weatherRiskMatch = cleaned.match(/"weatherRiskNote"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/);
      const expertAdviceMatch = cleaned.match(/"expertAdvice"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/);
      const next48HourRiskMatch = cleaned.match(/"next48HourRisk"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/);

      const extractArray = (field: string): string[] => {
        const regex = new RegExp(`"${field}"\\s*:\\s*\\[([\\s\\S]*?)\\]`);
        const match = cleaned.match(regex);
        if (match && match[1]) {
          const items: string[] = [];
          const strRegex = /"([\s\S]*?)"/g;
          let strMatch;
          while ((strMatch = strRegex.exec(match[1])) !== null) {
            items.push(strMatch[1]);
          }
          return items;
        }
        return [];
      };

      if (summaryMatch) {
        return {
          summary: summaryMatch[1],
          urgency: urgencyMatch ? urgencyMatch[1] : '',
          preventionTips: extractArray('preventionTips'),
          weatherRiskNote: weatherRiskMatch ? weatherRiskMatch[1] : '',
          expertAdvice: expertAdviceMatch ? expertAdviceMatch[1] : '',
          priorityActions: extractArray('priorityActions'),
          next48HourRisk: next48HourRiskMatch ? next48HourRiskMatch[1] : ''
        };
      }
      throw secondErr; // Re-throw if extraction is completely impossible
    }
  }
}

/**
 * AI Recommendation Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Communicates with the Google Gemini API to personalize and explain the 
 * diagnosis using the crop disease knowledge base as the authoritative treatment reference.
 */
export async function getAIEnhancedRecommendations(
  crop: string,
  disease: string,
  confidence: number,
  severity: SeverityLevel,
  kbData: DiseaseKnowledgeBaseEntry | null,
  extraContext?: { soilType?: string; tempC?: string; humidity?: string }
): Promise<AIRecommendationResponse> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  let tempC = extraContext?.tempC || 'N/A';
  let humidity = extraContext?.humidity || 'N/A';
  const soilType = extraContext?.soilType || 'N/A';

  if (tempC === 'N/A' || humidity === 'N/A') {
    try {
      const cachedWeather = await db.dashboard_cache.get('weather');
      if (cachedWeather && cachedWeather.payload) {
        const weatherData = cachedWeather.payload as any;
        if (tempC === 'N/A' && typeof weatherData.temperature === 'number') {
          tempC = String(weatherData.temperature);
        }
        if (humidity === 'N/A' && typeof weatherData.humidity === 'number') {
          humidity = String(weatherData.humidity);
        }
      } else {
        // Fetch weather dynamically
        try {
          const coords = await getUserLocation().catch(() => ({ latitude: 17.385, longitude: 78.4867 }));
          const weather = await fetchWeather(coords.latitude, coords.longitude);
          if (weather) {
            if (tempC === 'N/A') tempC = String(weather.temperature);
            if (humidity === 'N/A') humidity = String(weather.humidity);
            // Cache the retrieved weather
            await db.dashboard_cache.put({
              key: 'weather',
              type: 'weather',
              payload: weather,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
            });
          }
        } catch (wErr) {
          console.warn('[AgroGPT AI] Dynamic weather fetch failed inside geminiRecommendationService:', wErr);
        }
      }
    } catch (dbErr) {
      console.warn('[AgroGPT AI] Failed to read cached weather inside geminiRecommendationService:', dbErr);
    }
  }

  // If no API key is present or we are offline, fall back immediately to local structured RAG advice
  if (!apiKey) {
    console.warn('[AgroGPT AI] No API key configured. Utilizing local RAG fallback.');
    return getAIFallbackResponse(crop, disease, severity, kbData);
  }

  const { code: langCode, name: langName } = resolveLanguage();

  // Chemical Safety Hardening: Format treatments into immutable concise text
  const approvedChemicals = kbData?.chemicalTreatments && kbData.chemicalTreatments.length > 0
    ? kbData.chemicalTreatments.map(c => `* ${c.activeIngredient} ${c.dosage}`).join('\n')
    : 'None';
  const approvedOrganic = kbData?.organicTreatments && kbData.organicTreatments.length > 0
    ? kbData.organicTreatments.map(o => `* ${o}`).join('\n')
    : 'None';

  const approvedTreatmentsText = `Approved Chemical Treatments:\n${approvedChemicals}\n\nApproved Organic Treatments:\n${approvedOrganic}`;

  // Curate context instead of sending the entire raw KB database structure to improve AI reasoning
  const curatedContext = {
    diseaseName: kbData?.disease || disease,
    scientificName: kbData?.scientificName || 'N/A',
    explanation: kbData?.farmerFriendlyExplanation || '',
    symptoms: kbData?.symptoms || [],
    environmentalSpreadFactors: kbData?.spreadConditions || {},
    approvedTreatments: approvedTreatmentsText,
    preventionGuidelines: kbData?.prevention || []
  };

  const systemInstructions = `You are AgroGPT, a supportive, expert agricultural companion. Your goal is to provide personalized, actionable, and warm advice to the farmer.

1. **EXPERT PERSONA:** Act as a local agricultural expert. Use your internal training to explain *why* a disease is occurring based on the provided local context. Be helpful, reassuring, and clear.
2. **SAFE CHEMICAL GUIDANCE:** You must remain safe. Do not invent chemical names, dosages, or brands. If no approved chemical treatments are listed in the provided knowledge base, clearly state: "No chemical treatments are recommended from our verified database." You may discuss biological or cultural control methods freely.
3. **PRACTICAL & STRATEGIC:** Explain disease progression and urgency in simple terms. Prioritize "Immediate Actions" (what the farmer can do right now to save the crop) and "Prevention Tips" (long-term habits). These must be distinct and non-repetitive.
4. **NO JARGON:** Avoid heavy scientific or academic terminology. Use farmer-friendly language. Do not use markdown tables.
5. **JSON FORMATTING:** Return pure raw JSON only. Ensure strings are properly escaped (especially newlines as \\n). Do not wrap in markdown code blocks. Ensure that all nested quotes inside string values are escaped or represented using single quotes (e.g. 'like this'). Do NOT write raw unescaped line breaks or control characters inside JSON string values. Do NOT include trailing commas.`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `SYSTEM INSTRUCTIONS:
${systemInstructions}

FARMER FIELD CONTEXT:
- Crop: ${crop}
- Disease: ${disease}
- AI Confidence: ${confidence}%
- Farmer Assessed Field Severity: ${severity.toUpperCase()}
- Soil Type: ${soilType}
- Current Temperature: ${tempC}°C
- Current Relative Humidity: ${humidity}%

CURATED KNOWLEDGE BASE CONTEXT (AUTHORITATIVE REFERENCE):
${JSON.stringify(curatedContext, null, 2)}

TASK:
Write an insightful, encouraging agricultural advisor analysis for the farmer in language: ${langName} (ISO code: ${langCode}).
Return a JSON object conforming exactly to this schema. Output *pure raw JSON string format only*, ensuring all nested quotes are escaped and newlines within strings are properly represented as \\n:
{
  "summary": "Explain WHY this disease is dangerous to the ${crop} plant, how it progresses in the field, and the likely crop impact/what happens to the harvest if ignored. Keep it warm, contextual, and field-oriented.",
  "urgency": "Explain WHY the current urgency is classified as ${severity} based on the severity and weather conditions, and how fast the disease is likely to spread in the field.",
  "next48HourRisk": "Predictive warning reasoning. Explain how current weather conditions (Temp: ${tempC}°C, Humidity: ${humidity}%) are likely to impact disease spread over the next 48 hours (e.g. accelerating spread or slowing it).",
  "priorityActions": ["List of 3-5 of the MOST important immediate actions as a checklist-style prioritized guide (incorporating the KB actions). MUST be different from prevention tips."],
  "preventionTips": ["List of 2-3 prevention methods explaining WHY they protect future crops (incorporating the KB prevention guidelines). MUST be different from priority actions."],
  "weatherRiskNote": "Explain WHY the current weather conditions increase or decrease the risk of spread.",
  "expertAdvice": "Provide reassuring expert guidance on when to consult an agronomist, prioritizing high severity or low AI confidence situations."
}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.6, // Configured to 0.6 as requested to allow natural reasoning and advisory variability while remaining stable
      responseMimeType: 'application/json',
      maxOutputTokens: 1500
    }
  };

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const resBody = await response.json();
    const responseText = resBody?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!responseText) {
      throw new Error('Empty response received from Gemini');
    }

    // Clean and Parse the JSON returned by Gemini
    const parsedData = cleanAndParseJSON(responseText) as AIRecommendationResponse;

    // Verify fields are present, if not fill with fallback values
    return {
      summary: parsedData.summary || '',
      urgency: parsedData.urgency || '',
      preventionTips: Array.isArray(parsedData.preventionTips) ? parsedData.preventionTips : [],
      weatherRiskNote: parsedData.weatherRiskNote || '',
      expertAdvice: parsedData.expertAdvice || '',
      priorityActions: Array.isArray(parsedData.priorityActions) ? parsedData.priorityActions : [],
      next48HourRisk: parsedData.next48HourRisk || ''
    };
  } catch (err) {
    console.error('[AgroGPT AI] Gemini request failed or returned malformed JSON, falling back:', err);
    return getAIFallbackResponse(crop, disease, severity, kbData);
  }
}

