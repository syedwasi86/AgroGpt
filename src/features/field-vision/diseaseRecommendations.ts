export const CROP_DISEASES: Record<string, string[]> = {
  chili: ['healthy', 'cercospora', 'murda_complex', 'nutritional', 'powdery_mildew'],
  cotton: ['healthy', 'bacterial_blight', 'curl_virus', 'fusarium_wilt'],
  maize: ['healthy', 'blight', 'gray_leaf_spot', 'rust'],
  rice: ['healthy', 'bacterial_blight', 'brown_spot', 'leaf_blast'],
  tomato: ['healthy', 'bacterial_spot', 'early_blight', 'late_blight', 'leaf_curl']
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
