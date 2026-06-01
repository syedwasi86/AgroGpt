export const CROP_DISEASES: Record<string, string[]> = {
  chili: ['healthy', 'cercospora', 'murda_complex', 'nutritional', 'powdery_mildew'],
  cotton: ['bacterial_blight', 'curl_virus', 'fusarium_wilt', 'healthy'],
  maize: ['blight', 'gray_leaf_spot', 'healthy', 'rust'],
  rice: ['bacterial_blight', 'brown_spot', 'healthy', 'leaf_blast'],
  tomato: ['tomato_bacterial_spot', 'tomato_blight', 'tomato_healthy', 'tomato_leaf_curl', 'tomato_leaf_mold', 'tomato_septoria_leaf_spot']
}

export interface DiseaseRecommendation {
  organic: string
  chemical: string
  prevention: string
}

export const DISEASE_RECOMMENDATIONS: Record<string, DiseaseRecommendation> = {
  tomato_late_blight: {
    organic: "Remove and destroy affected leaves. Apply copper-based fungicide.",
    chemical: "Apply chlorothalonil or mancozeb according to package instructions.",
    prevention: "Ensure good air circulation, avoid overhead watering, rotate crops."
  },
  tomato_early_blight: {
    organic: "Prune lower leaves, apply compost tea or baking soda spray.",
    chemical: "Use fungicides containing chlorothalonil, mancozeb, or copper.",
    prevention: "Use crop rotation, weed control, and avoid overhead irrigation."
  },
  rice_leaf_blast: {
    organic: "Avoid excessive nitrogen fertilizers. Improve silicon content in soil.",
    chemical: "Apply tricyclazole or isoprothiolane at the disease onset.",
    prevention: "Use resistant varieties, maintain proper field water level."
  },
  maize_rust: {
    organic: "Remove infected leaves early.",
    chemical: "Apply foliar fungicides like pyraclostrobin if rust appears early.",
    prevention: "Plant rust-resistant hybrids, avoid late planting."
  },
  cotton_fusarium_wilt: {
    organic: "Soil solarization and crop rotation.",
    chemical: "Seed treatments with appropriate systemic fungicides.",
    prevention: "Plant resistant varieties, control root-knot nematodes."
  },
  chili_murda_complex: {
    organic: "Use neem oil to control thrips and mites vectoring the virus.",
    chemical: "Apply appropriate insecticides/miticides to control vectors.",
    prevention: "Use virus-resistant varieties, maintain field sanitation."
  }
}

export function getDiseaseRecommendation(crop: string, disease: string): DiseaseRecommendation {
  if (disease.toLowerCase() === 'healthy') {
    return {
      organic: "Maintain current organic practices.",
      chemical: "No chemical action needed.",
      prevention: "Continue regular scouting and good agricultural practices."
    }
  }

  const key = `${crop.toLowerCase()}_${disease.toLowerCase()}`
  return DISEASE_RECOMMENDATIONS[key] || {
    organic: "Consult local agricultural extension for organic remedies.",
    chemical: "Consult a local agronomist for appropriate chemical treatments.",
    prevention: "Maintain good field hygiene, proper spacing, and balanced fertilization."
  }
}
