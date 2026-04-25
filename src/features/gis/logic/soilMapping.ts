export interface SoilProfile {
  district: string
  soilType: string
  npkBaseline: {
    n: number // Nitrogen
    p: number // Phosphorus
    k: number // Potassium
  }
  recommendedCrops: string[]
}

const REGIONS = [
  {
    lat: 17.6294, lon: 78.0908,
    profile: {
      district: 'Sangareddy',
      soilType: 'Red Chalka',
      npkBaseline: { n: 42, p: 18, k: 28 },
      recommendedCrops: ['Cotton', 'Maize', 'Sorghum', 'Red Gram']
    }
  },
  {
    lat: 17.0500, lon: 79.2667,
    profile: {
      district: 'Nalgonda',
      soilType: 'Black Regur',
      npkBaseline: { n: 55, p: 22, k: 40 },
      recommendedCrops: ['Cotton', 'Chilli', 'Rice', 'Groundnut']
    }
  },
  {
    lat: 17.3850, lon: 78.4867,
    profile: {
      district: 'Hyderabad',
      soilType: 'Red Sandy Loam',
      npkBaseline: { n: 45, p: 25, k: 35 },
      recommendedCrops: ['Vegetables', 'Flowers', 'Fruits']
    }
  },
  {
    lat: 18.4386, lon: 79.1288,
    profile: {
      district: 'Karimnagar',
      soilType: 'Laterite',
      npkBaseline: { n: 35, p: 15, k: 20 },
      recommendedCrops: ['Maize', 'Groundnut', 'Pulses']
    }
  },
  {
    lat: 16.5062, lon: 80.6480,
    profile: {
      district: 'Vijayawada',
      soilType: 'Alluvial',
      npkBaseline: { n: 70, p: 35, k: 50 },
      recommendedCrops: ['Rice', 'Sugarcane', 'Banana', 'Turmeric']
    }
  },
  {
    lat: 19.8762, lon: 75.3433,
    profile: {
      district: 'Aurangabad',
      soilType: 'Deep Black Cotton Soil',
      npkBaseline: { n: 60, p: 28, k: 45 },
      recommendedCrops: ['Cotton', 'Soybean', 'Pigeon Pea']
    }
  },
  {
    lat: 30.9010, lon: 75.8573,
    profile: {
      district: 'Ludhiana',
      soilType: 'Indo-Gangetic Alluvium',
      npkBaseline: { n: 65, p: 30, k: 40 },
      recommendedCrops: ['Wheat', 'Rice', 'Mustard']
    }
  }
];

/**
 * Calculates the great-circle distance between two points on a sphere
 * using the Haversine formula.
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const R = 6371 // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Identifies the soil type, baseline NPK, and recommended crops 
 * based on the closest known geo-coordinate (Zero-Input approach).
 */
export function getSoilType(lat: number, lon: number): SoilProfile {
  if (REGIONS.length === 0) {
    throw new Error('No regions defined in soil database.');
  }

  let closest = REGIONS[0];
  let minDistance = Infinity;

  for (const region of REGIONS) {
    const dist = haversineDistance(lat, lon, region.lat, region.lon);
    if (dist < minDistance) {
      minDistance = dist;
      closest = region;
    }
  }

  // If the user is further than 300km from any explicitly mapped district, 
  // we fallback to a generic soil profile to avoid wildly inaccurate local advice.
  if (minDistance > 300) {
    return {
      district: 'Generic Zone',
      soilType: 'Standard Loam',
      npkBaseline: { n: 48, p: 22, k: 36 },
      recommendedCrops: ['Sorghum', 'Pulses', 'Millets']
    };
  }

  return closest.profile;
}
