import type { SeverityQuestion } from './types';

/**
 * Registry of disease-specific, simple farmer-friendly questions.
 * Maps crop_disease keys to sets of severity questions.
 * Avoids scientific jargon to make assessment easy for local farmers.
 */
export const DISEASE_QUESTIONS: Record<string, SeverityQuestion[]> = {
  // --- CHILI DISEASES ---
  chili_cercospora_leaf_spot: [
    {
      id: 'leaves_affected',
      question: 'How many leaves have spots?',
      options: [
        { label: 'Only a few lower leaves', score: 1 },
        { label: 'Many leaves across the plant', score: 2 },
        { label: 'Almost all leaves, some falling off', score: 3 }
      ]
    },
    {
      id: 'stem_spots',
      question: 'Are there spots on the stems or chili pods?',
      options: [
        { label: 'No, only on leaves', score: 0 },
        { label: 'Yes, on a few stems or pods', score: 2 },
        { label: 'Yes, widespread on stems and pods', score: 3 }
      ]
    },
    {
      id: 'sunscald',
      question: 'Are the chilies getting sunburned due to leaves falling off?',
      options: [
        { label: 'No sunburn seen on chilies', score: 0 },
        { label: 'Yes, some sunburn on chilies', score: 2 }
      ]
    }
  ],
  chili_murda_complex: [
    {
      id: 'leaf_curling',
      question: 'How severe is the leaf curling?',
      options: [
        { label: 'Slight curling on young top leaves', score: 1 },
        { label: 'Severe upward or downward curling and crinkling', score: 2 },
        { label: 'Leaves are leathery, brittle, and fully deformed', score: 3 }
      ]
    },
    {
      id: 'stunting',
      question: 'Is the plant growth stunted or bushy?',
      options: [
        { label: 'Normal height', score: 0 },
        { label: 'Slightly shorter than normal', score: 1 },
        { label: 'Very stunted, looks like a bushy broom', score: 3 }
      ]
    },
    {
      id: 'flowers_fruit',
      question: 'Are flowers and chilies falling off prematurely?',
      options: [
        { label: 'Normal flowers and fruiting', score: 0 },
        { label: 'Some flowers dropping', score: 1 },
        { label: 'Complete failure, no flowers or chilies forming', score: 3 }
      ]
    }
  ],
  chili_nutritional: [
    {
      id: 'yellowing_spread',
      question: 'How much of the field is turning pale green or yellow?',
      options: [
        { label: 'A few isolated plants', score: 1 },
        { label: 'Scattered patches across the field', score: 2 },
        { label: 'Whole field is turning pale green/yellow', score: 3 }
      ]
    },
    {
      id: 'waterlogging',
      question: 'Is there standing water or waterlogging in the field?',
      options: [
        { label: 'No, soil is well-drained', score: 0 },
        { label: 'Yes, field has been flooded recently', score: 2 }
      ]
    }
  ],
  chili_powdery_mildew: [
    {
      id: 'powder_coverage',
      question: 'How much white powder do you see on the underside of leaves?',
      options: [
        { label: 'Faint spots on a few leaves', score: 1 },
        { label: 'Thick white powder coating many leaves', score: 2 },
        { label: 'Heavy white coating on almost all leaves', score: 3 }
      ]
    },
    {
      id: 'leaf_drop',
      question: 'Are leaves turning yellow and falling off?',
      options: [
        { label: 'No leaf drop', score: 0 },
        { label: 'A few leaves falling', score: 1 },
        { label: 'Heavy leaf drop, bare stems appearing', score: 3 }
      ]
    }
  ],

  // --- COTTON DISEASES ---
  cotton_bacterial_blight: [
    {
      id: 'spots_type',
      question: 'What kind of spots do you see on the leaves?',
      options: [
        { label: 'Small dark green water-soaked spots', score: 1 },
        { label: 'Angular dark brown/black spots bordered by veins', score: 2 },
        { label: 'Veins turning completely black', score: 3 }
      ]
    },
    {
      id: 'stem_lesions',
      question: 'Are there black cracks or lesions on the stems?',
      options: [
        { label: 'No stem lesions', score: 0 },
        { label: 'Small dark lesions on branches', score: 2 },
        { label: 'Deep cracks, oozing, or broken branches', score: 3 }
      ]
    },
    {
      id: 'boll_rot',
      question: 'Are cotton bolls rotting or stained yellow?',
      options: [
        { label: 'Bolls look healthy', score: 0 },
        { label: 'Some bolls have sunken spots', score: 2 },
        { label: 'Bolls are rotting, bursting early, or stained yellow', score: 3 }
      ]
    }
  ],
  cotton_curl_virus: [
    {
      id: 'curling_extent',
      question: 'How are the leaves curling?',
      options: [
        { label: 'Slight upward or downward curling at edges', score: 1 },
        { label: 'Severe leaf curling and crinkling', score: 2 },
        { label: 'Leaves cup-shaped, thick, with small leaf outgrowths on back veins', score: 3 }
      ]
    },
    {
      id: 'stunting_extent',
      question: 'Is the cotton plant stunted?',
      options: [
        { label: 'Normal growth', score: 0 },
        { label: 'Slightly stunted', score: 1 },
        { label: 'Severely stunted and bushy', score: 3 }
      ]
    }
  ],
  cotton_fusarium_wilt: [
    {
      id: 'wilt_behavior',
      question: 'How is the plant wilting?',
      options: [
        { label: 'Wilts slightly during hot noon, recovers in evening', score: 1 },
        { label: 'Permanent wilting of leaves', score: 2 },
        { label: 'Plant is dead/drying up completely', score: 3 }
      ]
    },
    {
      id: 'stem_discoloration',
      question: 'If you cut a wilting stem open, is the inside wood stained brown?',
      options: [
        { label: 'No, it looks clean and white/green', score: 0 },
        { label: 'Yes, it has dark brown staining inside', score: 3 }
      ]
    }
  ],

  // --- MAIZE DISEASES ---
  maize_blight: [
    {
      id: 'blight_lesions',
      question: 'What shape and size are the leaf spots?',
      options: [
        { label: 'Small diamond-shaped spots', score: 1 },
        { label: 'Large grayish-green cigar-shaped spots', score: 2 },
        { label: 'Massive spots merging, making leaves look burned/crispy', score: 3 }
      ]
    },
    {
      id: 'canopy_spread',
      question: 'Is the blight spreading up the maize plant?',
      options: [
        { label: 'Only on lower leaves', score: 1 },
        { label: 'Spreading to middle leaves', score: 2 },
        { label: 'Reaching the upper leaves and corn ears', score: 3 }
      ]
    }
  ],
  maize_gray_leaf_spot: [
    {
      id: 'lesion_color',
      question: 'What do the spots on the leaves look like?',
      options: [
        { label: 'Small tan/brown spots', score: 1 },
        { label: 'Elongated rectangular blocky spots', score: 2 },
        { label: 'Rectangular spots turning gray and merging', score: 3 }
      ]
    },
    {
      id: 'flowering_state',
      question: 'Where is the disease located on the plant?',
      options: [
        { label: 'Only on the lowest leaves', score: 1 },
        { label: 'Spreading above the ear leaf (middle/upper)', score: 3 }
      ]
    }
  ],
  maize_rust: [
    {
      id: 'pustules_color',
      question: 'What color are the powdery spots (pustules) on the leaves?',
      options: [
        { label: 'Vibrant brick-red or golden-brown', score: 1 },
        { label: 'Pustules are turning dark black', score: 2 }
      ]
    },
    {
      id: 'leaf_sides',
      question: 'Are the rusty spots on both sides of the leaf?',
      options: [
        { label: 'Only on the upper side', score: 1 },
        { label: 'On both upper and lower sides', score: 2 }
      ]
    },
    {
      id: 'rust_coverage',
      question: 'How much of the leaves are covered in rust?',
      options: [
        { label: 'A few spots here and there', score: 1 },
        { label: 'Many spots covering large parts of the leaf', score: 2 },
        { label: 'Leaves are drying up and dying', score: 3 }
      ]
    }
  ],

  // --- RICE DISEASES ---
  rice_bacterial_blight: [
    {
      id: 'blight_phase',
      question: 'What symptoms are you seeing in the field?',
      options: [
        { label: 'Water-soaked streaks on leaf tips', score: 1 },
        { label: 'Yellow-white wavy-edged streaks drying up mature leaves', score: 2 },
        { label: 'Entire seedlings wilting and dying (Kresek phase)', score: 3 }
      ]
    },
    {
      id: 'ooze_presence',
      question: 'Do you see milky drops or dried amber beads on the leaves?',
      options: [
        { label: 'No ooze/beads seen', score: 0 },
        { label: 'Yes, milky ooze in morning or dried amber beads', score: 2 }
      ]
    }
  ],
  rice_brown_spot: [
    {
      id: 'spot_shape',
      question: 'What do the spots on the leaves look like?',
      options: [
        { label: 'Small oval brown spots', score: 1 },
        { label: 'Spots look like sesame seeds (brown with yellow halo)', score: 2 },
        { label: 'Spots merging, making whole leaves dry and look burned', score: 3 }
      ]
    },
    {
      id: 'grain_spots',
      question: 'Are there black spots on the rice grains?',
      options: [
        { label: 'No, grains look clean', score: 0 },
        { label: 'Yes, black spots seen on grains', score: 2 }
      ]
    }
  ],
  rice_leaf_blast: [
    {
      id: 'blast_symptoms',
      question: 'Where do you see the blast lesions?',
      options: [
        { label: 'Spindle/eye-shaped spots on leaves', score: 1 },
        { label: 'Black spots on stem joints (nodal blast)', score: 2 },
        { label: 'Stem neck below grain head is black/rotted (neck blast)', score: 3 }
      ]
    },
    {
      id: 'panicle_damage',
      question: 'What do the rice grain heads (panicles) look like?',
      options: [
        { label: 'Normal grain heads', score: 0 },
        { label: 'White, empty, erect grain heads (blanking)', score: 3 },
        { label: 'Grains are only partially filled or chalky', score: 2 }
      ]
    }
  ],

  // --- TOMATO DISEASES ---
  tomato_bacterial_spot: [
    {
      id: 'spot_appearance',
      question: 'Describe the spots on the leaves and fruit:',
      options: [
        { label: 'Small water-soaked dark spots on leaves', score: 1 },
        { label: 'Black raised spots without circular rings on leaves', score: 2 },
        { label: 'Fruit showing brown, raised, scabby, rough spots', score: 3 }
      ]
    },
    {
      id: 'sprinkler_use',
      question: 'Do you water the plants using overhead sprinkler irrigation?',
      options: [
        { label: 'No, drip irrigation or flood irrigation', score: 0 },
        { label: 'Yes, we water from above using sprinklers or hose', score: 2 }
      ]
    }
  ],
  tomato_blight: [
    {
      id: 'blight_spots',
      question: 'What do the spots on the leaves look like?',
      options: [
        { label: 'Small brown spots on lower leaves', score: 1 },
        { label: 'Circular spots with target-like rings', score: 2 },
        { label: 'Large water-soaked greasy spots with white fuzz underneath', score: 3 }
      ]
    },
    {
      id: 'canopy_spread_tomato',
      question: 'How quickly is the disease spreading?',
      options: [
        { label: 'Only on bottom leaves', score: 1 },
        { label: 'Spreading to stems and green/red tomatoes', score: 2 },
        { label: 'Rapidly killing whole plants or large patches of field', score: 3 }
      ]
    }
  ],
  tomato_leaf_curl: [
    {
      id: 'curl_severity',
      question: 'How are the leaves curled?',
      options: [
        { label: 'Slight curling on young top leaves', score: 1 },
        { label: 'Sharp downward rolling and crinkling of leaves', score: 2 },
        { label: 'Young leaves are very yellow and rolled tight', score: 3 }
      ]
    },
    {
      id: 'lateral_branches',
      question: 'Does the plant have an unusually bushy, stunted appearance?',
      options: [
        { label: 'No, normal height and shape', score: 0 },
        { label: 'Yes, stunted with many tiny branches (looks like a broom)', score: 3 }
      ]
    }
  ]
};

/**
 * Helper to fetch questions for a specific crop and disease.
 * Crop and disease names are normalized to match the keys.
 */
export function getSeverityQuestions(crop: string, disease: string): SeverityQuestion[] {
  const normCrop = crop.toLowerCase().trim();
  const normDisease = disease.toLowerCase().trim();

  // Try direct key mapping
  // Map common prediction classes to match severity questions keys
  let diseaseKey = normDisease;
  if (normDisease === 'cercospora') diseaseKey = 'cercospora_leaf_spot';
  if (normDisease === 'leaf_curl') diseaseKey = 'leaf_curl';
  if (normDisease === 'curl_virus') diseaseKey = 'curl_virus';
  if (normDisease === 'bacterial_blight') {
    diseaseKey = 'bacterial_blight';
  }
  if (normDisease === 'bacterial_spot') diseaseKey = 'bacterial_spot';
  if (normDisease === 'gray_leaf_spot') diseaseKey = 'gray_leaf_spot';
  if (normDisease === 'brown_spot') diseaseKey = 'brown_spot';
  if (normDisease === 'leaf_blast') diseaseKey = 'leaf_blast';

  const fullKey = `${normCrop}_${diseaseKey}`;
  
  // Search keys in case of small naming discrepancies
  if (DISEASE_QUESTIONS[fullKey]) {
    return DISEASE_QUESTIONS[fullKey];
  }

  // Fallback search
  const foundKey = Object.keys(DISEASE_QUESTIONS).find(k => 
    k.startsWith(normCrop) && (k.includes(normDisease) || normDisease.includes(k.replace(normCrop + '_', '')))
  );

  return foundKey ? DISEASE_QUESTIONS[foundKey] : [];
}
