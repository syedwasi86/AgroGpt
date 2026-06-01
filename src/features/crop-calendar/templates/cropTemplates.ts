import type { CropTemplate } from '../types'

export const cropTemplates: Record<string, CropTemplate> = {
  Cotton: {
    cropName: 'Cotton',
    variety: 'BT Cotton (Hybrid)',
    lifecycleDuration: 150,
    stages: [
      { name: 'Germination & Seedling', durationDays: 20, description: 'Establishment of young cotton shoots.', icon: 'sprout' },
      { name: 'Squaring', durationDays: 30, description: 'Formation of flower buds (squares).', icon: 'leaf' },
      { name: 'Flowering & Boll Development', durationDays: 60, description: 'Blossoming and formation of cotton bolls.', icon: 'flower' },
      { name: 'Maturity & Boll Opening', durationDays: 40, description: 'Bolls opening up for harvesting.', icon: 'scissors' }
    ],
    tasks: [
      { task_template_id: 'cotton_sow', title: 'Sowing seeds', description: 'Sow cotton seeds at a depth of 2-3 cm with proper spacing.', taskType: 'other', relativeDay: 0, priority: 'high', is_recurring: false },
      { task_template_id: 'cotton_irr_1', title: 'First Irrigation', description: 'Light irrigation to promote uniform germination.', taskType: 'irrigation', relativeDay: 15, priority: 'high', is_recurring: false },
      { task_template_id: 'cotton_weed_1', title: 'Manual weeding', description: 'Remove competitive weeds from seedling zone.', taskType: 'weeding', relativeDay: 20, priority: 'medium', is_recurring: false },
      { task_template_id: 'cotton_fert_1', title: 'Nitrogen top dressing', description: 'Apply Urea (first split dose) to fuel vegetative growth.', taskType: 'fertilization', relativeDay: 30, priority: 'medium', is_recurring: false },
      { task_template_id: 'cotton_scout_1', title: 'Sucking pest scouting', description: 'Check leaves for aphids, jassids, and thrips.', taskType: 'inspection', relativeDay: 40, priority: 'high', is_recurring: true, recurrence_interval_days: 10 },
      { task_template_id: 'cotton_irr_rec', title: 'Standard Irrigation', description: 'Routine irrigation to maintain soil moisture during squaring.', taskType: 'irrigation', relativeDay: 45, priority: 'medium', is_recurring: true, recurrence_interval_days: 14 },
      { task_template_id: 'cotton_weed_2', title: 'Secondary weeding', description: 'Ensure fields remain clean before canopy closure.', taskType: 'weeding', relativeDay: 50, priority: 'low', is_recurring: false },
      { task_template_id: 'cotton_fert_2', title: 'NPK secondary application', description: 'Apply balanced NPK to support bloom initiation.', taskType: 'fertilization', relativeDay: 60, priority: 'high', is_recurring: false },
      { task_template_id: 'cotton_pest_1', title: 'Bollworm spray protection', description: 'Apply bio-pesticides or target spray if bollworm thresholds are breached.', taskType: 'pesticide', relativeDay: 75, priority: 'high', is_recurring: false },
      { task_template_id: 'cotton_harvest_1', title: 'First pick harvesting', description: 'Handpick cotton from fully opened bolls.', taskType: 'harvesting', relativeDay: 130, priority: 'high', is_recurring: false },
      { task_template_id: 'cotton_harvest_2', title: 'Final pick harvesting', description: 'Perform final picking and clear crop residue.', taskType: 'harvesting', relativeDay: 150, priority: 'high', is_recurring: false }
    ],
    weatherSensitivity: {
      maxTempThreshold: 38,
      minTempThreshold: 15,
      windSpeedThreshold: 15,
      humidityThreshold: 85,
      rainThreshold: 5
    }
  },
  Rice: {
    cropName: 'Rice',
    variety: 'Basmati Paddy',
    lifecycleDuration: 120,
    stages: [
      { name: 'Nursery & Seedling', durationDays: 20, description: 'Raising young seedlings in a nursery bed.', icon: 'sprout' },
      { name: 'Transplanting & Tillering', durationDays: 35, description: 'Transplanting seedlings and root anchoring.', icon: 'leaf' },
      { name: 'Panicle Initiation & Flowering', durationDays: 35, description: 'Developing grain panicles and flowering.', icon: 'flower' },
      { name: 'Ripening & Harvest', durationDays: 30, description: 'Grain filling, drying, and harvesting.', icon: 'wheat' }
    ],
    tasks: [
      { task_template_id: 'rice_nursery', title: 'Nursery preparation', description: 'Prepare wet nursery bed and sow treated rice seeds.', taskType: 'other', relativeDay: 0, priority: 'high', is_recurring: false },
      { task_template_id: 'rice_transplant', title: 'Seedling transplanting', description: 'Transplant 20-day old seedlings into puddled main field.', taskType: 'other', relativeDay: 20, priority: 'high', is_recurring: false },
      { task_template_id: 'rice_herbicide', title: 'Pre-emergence weed control', description: 'Apply recommended herbicide within 5 days of transplanting.', taskType: 'weeding', relativeDay: 25, priority: 'medium', is_recurring: false },
      { task_template_id: 'rice_irr_standing', title: 'Maintain standing water', description: 'Check water level in paddies, maintaining 2-5 cm depth.', taskType: 'irrigation', relativeDay: 26, priority: 'high', is_recurring: true, recurrence_interval_days: 7 },
      { task_template_id: 'rice_fert_tillering', title: 'Urea application (tillering)', description: 'Broadcast urea (first split) to boost vegetative tillers.', taskType: 'fertilization', relativeDay: 40, priority: 'medium', is_recurring: false },
      { task_template_id: 'rice_scout_blast', title: 'Blast disease monitoring', description: 'Inspect leaves for spindle-shaped lesions indicating blast disease.', taskType: 'inspection', relativeDay: 55, priority: 'high', is_recurring: true, recurrence_interval_days: 10 },
      { task_template_id: 'rice_fert_panicle', title: 'NPK application (panicle)', description: 'Broadcast potash and urea at panicle initiation.', taskType: 'fertilization', relativeDay: 75, priority: 'high', is_recurring: false },
      { task_template_id: 'rice_drain', title: 'Drain field water', description: 'Drain standing water completely to accelerate ripening.', taskType: 'other', relativeDay: 105, priority: 'medium', is_recurring: false },
      { task_template_id: 'rice_harvest', title: 'Harvest paddy grains', description: 'Harvest when 80-85% grains turn golden-yellow.', taskType: 'harvesting', relativeDay: 120, priority: 'high', is_recurring: false }
    ],
    weatherSensitivity: {
      maxTempThreshold: 35,
      minTempThreshold: 18,
      windSpeedThreshold: 18,
      humidityThreshold: 85,
      rainThreshold: 10 // Rice can absorb more rain, so set a higher threshold
    }
  },
  Maize: {
    cropName: 'Maize',
    variety: 'Single Cross Hybrid',
    lifecycleDuration: 110,
    stages: [
      { name: 'Establishment & Seedling', durationDays: 15, description: 'Seed germination and early leaf development.', icon: 'sprout' },
      { name: 'Vegetative Growth', durationDays: 30, description: 'Rapid stalk elongation and leaf canopy development.', icon: 'leaf' },
      { name: 'Tasseling & Silking', durationDays: 30, description: 'Emergence of male tassels and female silks.', icon: 'flower' },
      { name: 'Grain Fill & Maturity', durationDays: 35, description: 'Grain development and dry down.', icon: 'wheat' }
    ],
    tasks: [
      { task_template_id: 'maize_sow', title: 'Sowing maize seeds', description: 'Sow seeds at 3-5 cm depth with row-to-row spacing.', taskType: 'other', relativeDay: 0, priority: 'high', is_recurring: false },
      { task_template_id: 'maize_weed_early', title: 'Early weeding', description: 'Pre-emergence weeding to protect young seedlings.', taskType: 'weeding', relativeDay: 5, priority: 'medium', is_recurring: false },
      { task_template_id: 'maize_irr_early', title: 'Seedling Irrigation', description: 'Apply light irrigation to support root establishment.', taskType: 'irrigation', relativeDay: 15, priority: 'medium', is_recurring: false },
      { task_template_id: 'maize_fert_veg', title: 'Nitrogen side-dressing', description: 'Apply Urea near root zones during knee-high stage.', taskType: 'fertilization', relativeDay: 30, priority: 'high', is_recurring: false },
      { task_template_id: 'maize_irr_rec', title: 'Vegetative Irrigation', description: 'Regular irrigation for fast growing stalks.', taskType: 'irrigation', relativeDay: 35, priority: 'medium', is_recurring: true, recurrence_interval_days: 12 },
      { task_template_id: 'maize_scout_borer', title: 'Stem borer monitoring', description: 'Inspect central leaf whorls for pinholes and frass.', taskType: 'inspection', relativeDay: 45, priority: 'high', is_recurring: true, recurrence_interval_days: 10 },
      { task_template_id: 'maize_irr_tassel', title: 'Tasseling Irrigation', description: 'Critical irrigation; water stress during pollination reduces yield.', taskType: 'irrigation', relativeDay: 55, priority: 'high', is_recurring: false },
      { task_template_id: 'maize_fert_tassel', title: 'Potash application', description: 'Add Potassium to aid starch accumulation in grains.', taskType: 'fertilization', relativeDay: 70, priority: 'medium', is_recurring: false },
      { task_template_id: 'maize_harvest', title: 'Harvest cob ears', description: 'Harvest when husks turn dry-papery and kernels are hard.', taskType: 'harvesting', relativeDay: 110, priority: 'high', is_recurring: false }
    ],
    weatherSensitivity: {
      maxTempThreshold: 36,
      minTempThreshold: 10,
      windSpeedThreshold: 20,
      humidityThreshold: 80,
      rainThreshold: 5
    }
  },
  Tomato: {
    cropName: 'Tomato',
    variety: 'Determinate / Roma',
    lifecycleDuration: 130,
    stages: [
      { name: 'Establishment', durationDays: 15, description: 'Seedlings root development after transplanting.', icon: 'sprout' },
      { name: 'Vegetative & Staking', durationDays: 25, description: 'Branch growth and vine staking setup.', icon: 'leaf' },
      { name: 'Flowering & Fruiting', durationDays: 40, description: 'Blossoming and development of green tomatoes.', icon: 'flower' },
      { name: 'Ripening & Harvest', durationDays: 50, description: 'Tomatoes turning red; progressive picking.', icon: 'scissors' }
    ],
    tasks: [
      { task_template_id: 'tomato_transplant', title: 'Transplant seedlings', description: 'Transplant healthy nursery seedlings into prepared ridges.', taskType: 'other', relativeDay: 0, priority: 'high', is_recurring: false },
      { task_template_id: 'tomato_irr_init', title: 'Initial Irrigation', description: 'Thorough irrigation to settle transplanted roots.', taskType: 'irrigation', relativeDay: 2, priority: 'high', is_recurring: false },
      { task_template_id: 'tomato_weed', title: 'Weed removal', description: 'Keep ridge channels free of weeds.', taskType: 'weeding', relativeDay: 10, priority: 'low', is_recurring: false },
      { task_template_id: 'tomato_irr_rec', title: 'Regular Irrigation', description: 'Maintain consistent moisture to prevent blossom end rot.', taskType: 'irrigation', relativeDay: 12, priority: 'medium', is_recurring: true, recurrence_interval_days: 8 },
      { task_template_id: 'tomato_stake', title: 'Staking & pruning', description: 'Erect bamboo stakes and support stems with twine.', taskType: 'other', relativeDay: 25, priority: 'high', is_recurring: false },
      { task_template_id: 'tomato_scout_blight', title: 'Early Blight inspection', description: 'Look for target-like concentric rings on lower leaves.', taskType: 'inspection', relativeDay: 35, priority: 'high', is_recurring: true, recurrence_interval_days: 7 },
      { task_template_id: 'tomato_fert_bloom', title: 'Calcium & NPK boost', description: 'Apply Calcium Nitrate and NPK to encourage setting.', taskType: 'fertilization', relativeDay: 45, priority: 'high', is_recurring: false },
      { task_template_id: 'tomato_spray_fungi', title: 'Preventative fungicide spray', description: 'Apply biological fungicide on high humidity windows.', taskType: 'pesticide', relativeDay: 75, priority: 'medium', is_recurring: false },
      { task_template_id: 'tomato_harvest_first', title: 'First harvest picking', description: 'Pick tomatoes when they reach breaker/pink stage.', taskType: 'harvesting', relativeDay: 90, priority: 'high', is_recurring: false },
      { task_template_id: 'tomato_harvest_pick', title: 'Regular picking', description: 'Progressive picking of ripe tomatoes.', taskType: 'harvesting', relativeDay: 98, priority: 'medium', is_recurring: true, recurrence_interval_days: 5 }
    ],
    weatherSensitivity: {
      maxTempThreshold: 35,
      minTempThreshold: 12,
      windSpeedThreshold: 15,
      humidityThreshold: 80,
      rainThreshold: 4
    }
  },
  Chilli: {
    cropName: 'Chilli',
    variety: 'Guntur Red Chilli',
    lifecycleDuration: 140,
    stages: [
      { name: 'Establishment', durationDays: 20, description: 'Transplanting shock recovery and root anchoring.', icon: 'sprout' },
      { name: 'Vegetative Growth', durationDays: 25, description: 'Stem development and branching.', icon: 'leaf' },
      { name: 'Flowering & Pod Set', durationDays: 45, description: 'Star-shaped white flowers and green pod growth.', icon: 'flower' },
      { name: 'Pod Ripening & Harvest', durationDays: 50, description: 'Chillies ripening to bright red; drying stage.', icon: 'scissors' }
    ],
    tasks: [
      { task_template_id: 'chilli_transplant', title: 'Transplant chilli seedlings', description: 'Transplant seedlings with root balls intact on raised beds.', taskType: 'other', relativeDay: 0, priority: 'high', is_recurring: false },
      { task_template_id: 'chilli_irr_init', title: 'Initial Irrigation', description: 'Irrigate immediately to ensure survival of roots.', taskType: 'irrigation', relativeDay: 3, priority: 'high', is_recurring: false },
      { task_template_id: 'chilli_fert_early', title: 'Micro-nutrient application', description: 'Apply Zn, Fe, and B foliar spray for root strength.', taskType: 'fertilization', relativeDay: 15, priority: 'medium', is_recurring: false },
      { task_template_id: 'chilli_weed', title: 'Weeding & earthing up', description: 'Perform manual weeding and loose soil wrapping around base.', taskType: 'weeding', relativeDay: 25, priority: 'medium', is_recurring: false },
      { task_template_id: 'chilli_irr_rec', title: 'Scheduled Irrigation', description: 'Maintain damp but not waterlogged soil conditions.', taskType: 'irrigation', relativeDay: 26, priority: 'medium', is_recurring: true, recurrence_interval_days: 10 },
      { task_template_id: 'chilli_scout_thrips', title: 'Thrips and mites inspection', description: 'Inspect leaf undersides for curling or webbing.', taskType: 'inspection', relativeDay: 40, priority: 'high', is_recurring: true, recurrence_interval_days: 8 },
      { task_template_id: 'chilli_fert_bloom', title: 'NPK bloom application', description: 'Side-dress NPK to sustain flowering and pods.', taskType: 'fertilization', relativeDay: 50, priority: 'high', is_recurring: false },
      { task_template_id: 'chilli_spray_neem', title: 'Organic neem oil spray', description: 'Prophylactic spray to ward off sucking insect vectors.', taskType: 'pesticide', relativeDay: 75, priority: 'medium', is_recurring: false },
      { task_template_id: 'chilli_harvest_green', title: 'Green chilli harvesting', description: 'Optional harvesting of green chillies for fresh market.', taskType: 'harvesting', relativeDay: 90, priority: 'medium', is_recurring: false },
      { task_template_id: 'chilli_harvest_red', title: 'Red chilli picking', description: 'Harvest fully ripe red pods for drying.', taskType: 'harvesting', relativeDay: 110, priority: 'high', is_recurring: true, recurrence_interval_days: 10 }
    ],
    weatherSensitivity: {
      maxTempThreshold: 37,
      minTempThreshold: 15,
      windSpeedThreshold: 16,
      humidityThreshold: 85,
      rainThreshold: 5
    }
  }
}
