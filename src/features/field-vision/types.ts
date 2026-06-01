export type SeverityLevel = 'low' | 'medium' | 'high';

export interface SpreadConditions {
  humidity: string | null;
  temperature: string | null;
  rainfall: string | null;
  season: string | null;
}

export interface ChemicalTreatment {
  activeIngredient: string;
  dosage: string;
  sprayInterval: string | null;
  notes: string | null;
}

export interface ImmediateActions {
  low: string[];
  medium: string[];
  high: string[];
}

export interface DisplayName {
  en: string;
  hi: string;
  te: string;
  [key: string]: string; // Support dynamic lookups by language keys
}

export interface DiseaseKnowledgeBaseEntry {
  id: string;
  crop: string;
  disease: string;
  scientificName: string | null;
  dangerLevel: string | null;
  symptoms: string[];
  earlySymptoms: string[];
  advancedSymptoms: string[];
  causes: string[];
  spreadConditions: SpreadConditions;
  immediateActions: ImmediateActions;
  organicTreatments: string[];
  chemicalTreatments: ChemicalTreatment[];
  prevention: string[];
  monitoringAdvice: string[];
  farmerFriendlyExplanation: string;
  sourceAttribution: string[];
  displayName: DisplayName;
  diseaseType: 'fungal' | 'viral' | 'bacterial' | 'nutritional' | null;
}

export interface RecommendationResponse {
  diagnosis: {
    crop: string;
    disease: string;
    confidence: number;
    severity: SeverityLevel;
  };
  kbData: DiseaseKnowledgeBaseEntry | null;
  recommendations: {
    immediateActions: string[];
    organicTreatments: string[];
    chemicalTreatments: ChemicalTreatment[];
    prevention: string[];
    monitoringAdvice: string[];
  };
  warnings: string[];
  confidenceMessage: string;
  requiresExpert: boolean;
}

export interface AIRecommendationResponse {
  summary: string;
  urgency: string;
  preventionTips: string[];
  weatherRiskNote: string;
  expertAdvice: string;
  priorityActions: string[];
  next48HourRisk: string;
}

export interface SeverityOption {
  label: string;
  score: number;
}

export interface SeverityQuestion {
  id: string;
  question: string;
  options: SeverityOption[];
}
