import type { DiseaseKnowledgeBaseEntry } from '../features/field-vision/types';

// In-memory cache to store loaded crop knowledge base entries
const kbCache: Record<string, DiseaseKnowledgeBaseEntry[]> = {};

/**
 * Lazy loads and caches the crop-specific JSON knowledge base file.
 * Supports offline-first by utilizing bundled JSON files via dynamic imports.
 */
export async function loadCropKnowledgeBase(crop: string): Promise<DiseaseKnowledgeBaseEntry[]> {
  const normalizedCrop = crop.toLowerCase().trim();

  // Return cached version if already loaded
  if (kbCache[normalizedCrop]) {
    return kbCache[normalizedCrop];
  }

  let data: unknown;

  try {
    switch (normalizedCrop) {
      case 'chili':
        data = (await import('./chili.json')).default;
        break;
      case 'cotton':
        data = (await import('./cotton.json')).default;
        break;
      case 'maize':
        data = (await import('./maize.json')).default;
        break;
      case 'rice':
        data = (await import('./rice.json')).default;
        break;
      case 'tomato':
        data = (await import('./tomato.json')).default;
        break;
      default:
        throw new Error(`Unsupported crop: ${crop}`);
    }
  } catch (err) {
    console.error(`Failed to load knowledge base for crop: ${crop}`, err);
    throw err;
  }

  // Typecast and cache the loaded data
  const typedEntries = data as DiseaseKnowledgeBaseEntry[];
  kbCache[normalizedCrop] = typedEntries;
  
  return typedEntries;
}
