import type { DiseaseKnowledgeBaseEntry } from '../features/field-vision/types';
import { loadCropKnowledgeBase } from './knowledgeBaseLoader';

// Map ML model output classes to the exact IDs in the JSON knowledge bases
const MODEL_TO_KB_ID_MAP: Record<string, Record<string, string>> = {
  chili: {
    healthy: 'chili_healthy',
    cercospora: 'chili_cercospora_leaf_spot',
    murda_complex: 'chili_murda_complex',
    nutritional: 'chili_nutritional',
    powdery_mildew: 'chili_powdery_mildew',
  },
  cotton: {
    healthy: 'cotton_healthy',
    bacterial_blight: 'cotton_bacterial_blight',
    curl_virus: 'cotton_curl_virus',
    fusarium_wilt: 'cotton_fusarium_wilt',
  },
  maize: {
    healthy: 'maize_healthy',
    blight: 'maize_blight',
    gray_leaf_spot: 'maize_gray_leaf_spot',
    rust: 'maize_rust',
  },
  rice: {
    healthy: 'rice_healthy',
    bacterial_blight: 'rice_bacterial_blight',
    brown_spot: 'rice_brown_spot',
    leaf_blast: 'rice_leaf_blast',
  },
  tomato: {
    healthy: 'tomato_healthy',
    bacterial_spot: 'tomato_bacterial_spot',
    blight: 'tomato_blight',
    leaf_curl: 'tomato_leaf_curl',
  }
};

/**
 * Looks up a disease entry in the loaded knowledge base.
 * Normalizes input names and maps model labels to precise database records.
 * Returns null if no match is found or on error.
 */
export async function getDiseaseKnowledge(
  crop: string,
  disease: string
): Promise<DiseaseKnowledgeBaseEntry | null> {
  try {
    const normCrop = crop.toLowerCase().trim();
    const normDisease = disease.toLowerCase().trim();

    // 1. Load the corresponding crop knowledge base file
    const kb = await loadCropKnowledgeBase(normCrop);
    if (!kb || kb.length === 0) {
      return null;
    }

    // 2. Check if there is an explicit mapping for this crop and label
    const mappedId = MODEL_TO_KB_ID_MAP[normCrop]?.[normDisease];
    if (mappedId) {
      const entry = kb.find(e => e.id.toLowerCase() === mappedId.toLowerCase());
      if (entry) return entry;
    }

    // 3. Fallback matching (case-insensitive checks on id, disease name, and display names)
    const fallbackEntry = kb.find(e => {
      const eId = e.id.toLowerCase();
      const eDisease = e.disease.toLowerCase();
      const eScientific = e.scientificName?.toLowerCase() || '';

      return (
        eId === normDisease ||
        eDisease === normDisease ||
        eId.includes(normDisease) ||
        normDisease.includes(eId) ||
        eDisease.includes(normDisease) ||
        normDisease.includes(eDisease) ||
        eScientific.includes(normDisease)
      );
    });

    return fallbackEntry || null;
  } catch (err) {
    console.error(`Error searching knowledge base for crop="${crop}" and disease="${disease}":`, err);
    return null;
  }
}
