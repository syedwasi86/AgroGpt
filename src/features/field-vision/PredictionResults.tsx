import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  Activity, 
  ChevronRight, 
  HelpCircle, 
  RefreshCw, 
  Info,
  UserCheck
} from 'lucide-react';
import i18next from 'i18next';
import { cn } from '../../core/utils/cn';
import { getDiseaseKnowledge } from '../../knowledge-Base/diseaseLookup';
import { generateRecommendation } from '../../engine/recommendationEngine';
import { calculateSeverity } from '../../engine/severityEngine';
import { getSeverityQuestions } from './severityQuestions';
import type { DiseaseKnowledgeBaseEntry, SeverityLevel } from './types';

interface Props {
  crop: string;
  disease: string;
  confidence: number;
  isOffline: boolean;
  onFeedback: (isCorrect: boolean) => void;
  onGetAIRecommendations: (severity: SeverityLevel, kbData: DiseaseKnowledgeBaseEntry | null) => void;
}

export function PredictionResults({ 
  crop, 
  disease, 
  confidence, 
  isOffline, 
  onFeedback, 
  onGetAIRecommendations 
}: Props) {
  const [kbData, setKbData] = useState<DiseaseKnowledgeBaseEntry | null>(null);
  const [loadingKB, setLoadingKB] = useState(true);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSeverityAssessed, setIsSeverityAssessed] = useState(false);
  const [severity, setSeverity] = useState<SeverityLevel>('low');
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  // Synchronously reset state during render when crop or disease changes
  const [lastKey, setLastKey] = useState('');
  const currentKey = `${crop}_${disease}`;
  if (lastKey !== currentKey) {
    setLastKey(currentKey);
    setAnswers({});
    setIsSeverityAssessed(false);
    setSeverity('low');
    setFeedbackGiven(false);
    setLoadingKB(true);
  }

  const isHealthy = disease.toLowerCase() === 'healthy';
  const questions = getSeverityQuestions(crop, disease);
  const hasQuestions = questions.length > 0;

  // Load knowledge base data when crop or disease changes
  useEffect(() => {
    let active = true;

    getDiseaseKnowledge(crop, disease)
      .then(data => {
        if (!active) return;
        setKbData(data);
        setLoadingKB(false);

        const checkHealthy = disease.toLowerCase() === 'healthy' || data?.id.endsWith('_healthy');
        const qList = getSeverityQuestions(crop, disease);

        if (checkHealthy || qList.length === 0) {
          // Bypasses the severity questionnaire for healthy plants or when no questions exist
          setSeverity('low');
          setIsSeverityAssessed(true);
        }
      })
      .catch(err => {
        console.error('Failed to load disease KB:', err);
        if (active) setLoadingKB(false);
      });

    return () => {
      active = false;
    };
  }, [crop, disease]);

  const handleOptionChange = (questionId: string, score: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: score
    }));
  };

  const handleCalculateSeverity = () => {
    const scores = Object.values(answers);
    const calculated = calculateSeverity(scores);
    setSeverity(calculated);
    setIsSeverityAssessed(true);
  };

  const handleFeedback = (isCorrect: boolean) => {
    onFeedback(isCorrect);
    setFeedbackGiven(true);
  };

  // Compile recommendation response using local engine
  const recResponse = generateRecommendation(crop, disease, confidence, severity, kbData);

  // Resolve localized display name
  const langCode = i18next.resolvedLanguage ?? i18next.language ?? 'en';
  const resolvedLang = langCode.split('-')[0];
  const displayName = kbData?.displayName?.[resolvedLang] || kbData?.displayName?.en || disease.replace(/_/g, ' ');

  if (loadingKB) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-white/60 animate-pulse">
        <RefreshCw className="animate-spin mb-4" size={32} />
        <p className="text-sm">Loading agricultural knowledge base...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
      
      {/* Header Info */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "grid h-12 w-12 place-items-center rounded-2xl border shadow-lg",
            isHealthy ? "border-green-500/30 bg-green-500/10 text-green-400" :
            (confidence < 75) ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" :
            "border-red-500/30 bg-red-500/10 text-red-400"
          )}>
            {isHealthy ? <CheckCircle size={24} /> :
             (confidence < 75) ? <AlertTriangle size={24} /> :
             <Activity size={24} />}
          </div>
          <div>
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">
              Detected Condition
            </div>
            <h2 className="text-xl font-bold text-white capitalize">{displayName}</h2>
            {kbData?.scientificName && (
              <span className="text-xs italic text-white/40 block mt-0.5">{kbData.scientificName}</span>
            )}
          </div>
        </div>
      </div>

      {/* AI Confidence Meter */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-medium text-white/70">AI Confidence Score</div>
          <div className="text-sm font-bold text-white">{confidence}%</div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/40 mb-2">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-1000 ease-out",
              confidence >= 90 ? "bg-primary-500" : confidence >= 75 ? "bg-primary-600/70" : "bg-yellow-500"
            )}
            style={{ width: `${confidence}%` }}
          />
        </div>
        <p className="text-xs text-white/50">{recResponse.confidenceMessage}</p>
      </div>

      {/* IF NOT ASSESSED YET & HAS QUESTIONS: Show Quick Field Assessment */}
      {!isSeverityAssessed && hasQuestions ? (
        <div className="mb-6 rounded-2xl border border-stroke-2 bg-secondary/5 p-5">
          <div className="flex items-center gap-2 mb-3 text-secondary">
            <HelpCircle size={18} />
            <h3 className="text-sm font-bold uppercase tracking-wider">Quick Field Assessment</h3>
          </div>
          <p className="text-xs text-white/60 mb-5 leading-relaxed">
            Please answer these questions based on what you see in the field to help calculate the infection severity.
          </p>

          <div className="space-y-5 mb-5">
            {questions.map((q) => {
              const currentScore = answers[q.id];
              return (
                <div key={q.id} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
                  <p className="text-sm font-semibold text-white/90 mb-2">{q.question}</p>
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt, idx) => (
                      <label 
                        key={idx} 
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/5 bg-white/5 cursor-pointer text-xs transition-all hover:bg-white/10",
                          currentScore === opt.score && "border-primary-500/50 bg-primary-950/20 text-primary-300 font-medium"
                        )}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={currentScore === opt.score}
                          onChange={() => handleOptionChange(q.id, opt.score)}
                          className="accent-primary-500"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleCalculateSeverity}
            disabled={Object.keys(answers).length < questions.length}
            className="w-full rounded-xl bg-primary-600 py-3 text-sm font-bold text-white shadow-glowPrimary transition-all hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Calculate Severity & View Recommendations
          </button>
        </div>
      ) : (
        /* IF ASSESSED: Show calculated severity badge and recommendations */
        <div className="space-y-6">
          
          {/* Severity Banner */}
          {!isHealthy && (
            <div className="flex justify-between items-center p-4 rounded-xl border border-white/10 bg-white/5">
              <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Field Severity Level</div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold capitalize border",
                  severity === 'high' ? "bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]" :
                  severity === 'medium' ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
                  "bg-green-500/10 text-green-400 border-green-500/30"
                )}>
                  {severity} severity
                </span>
                
                {hasQuestions && (
                  <button 
                    onClick={() => setIsSeverityAssessed(false)} 
                    className="flex items-center gap-1 text-[11px] font-bold text-primary-300 hover:text-primary-200 transition-all uppercase tracking-wider"
                  >
                    <RefreshCw size={12} /> Re-assess
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Scientific Details / Quick Explanation */}
          {kbData && (
            <div className="p-4 rounded-xl border border-white/5 bg-white/5 text-xs">
              <div className="flex items-center gap-2 mb-2 text-white/60 font-semibold">
                <Info size={14} /> Explanation
              </div>
              <p className="text-white/80 leading-relaxed">{kbData.farmerFriendlyExplanation}</p>
            </div>
          )}

          {/* Warnings Section */}
          {recResponse.warnings.length > 0 && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs space-y-1">
              {recResponse.warnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="mt-0.5">•</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Expert Escalation Box */}
          {recResponse.requiresExpert && (
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-xs flex items-center gap-3">
              <UserCheck className="text-yellow-400 flex-shrink-0" size={18} />
              <div>
                <span className="font-semibold block mb-0.5">Agronomist Consultation Advised</span>
                <span>It is recommended to seek direct advice from a local crop specialist for verified treatment.</span>
              </div>
            </div>
          )}

          {/* Treatment Recommendations Stack */}
          <div className="space-y-4">
            
            {/* Immediate Actions */}
            <div className="rounded-2xl border border-stroke-3 bg-secondary/10 p-5 relative overflow-hidden">
               <div className="text-xs font-bold text-secondary mb-3 flex items-center gap-2 uppercase tracking-wider">
                 <ChevronRight size={14} /> Immediate Actions
               </div>
               <ul className="list-disc pl-5 space-y-2 text-white/90 text-sm leading-relaxed">
                 {recResponse.recommendations.immediateActions.map((action, idx) => (
                   <li key={idx}>{action}</li>
                 ))}
               </ul>
            </div>

            {/* Organic Treatments */}
            <div className="rounded-2xl border border-stroke-3 bg-white/5 p-5 relative overflow-hidden">
               <div className="text-xs font-bold text-primary-300 mb-3 flex items-center gap-2 uppercase tracking-wider">
                 <ChevronRight size={14} /> Organic Treatments
               </div>
               {recResponse.recommendations.organicTreatments.length > 0 ? (
                 <ul className="list-disc pl-5 space-y-2 text-white/90 text-sm leading-relaxed">
                   {recResponse.recommendations.organicTreatments.map((t, idx) => (
                     <li key={idx}>{t}</li>
                   ))}
                 </ul>
               ) : (
                 <p className="text-xs text-white/50 italic">No specific organic treatments listed.</p>
               )}
            </div>

            {/* Chemical Treatments (ONLY FOR DISEASES) */}
            {!isHealthy && recResponse.recommendations.chemicalTreatments.length > 0 && (
              <div className="rounded-2xl border border-stroke-3 bg-red-500/10 p-5 relative overflow-hidden">
                 <div className="text-xs font-bold text-red-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                   <ChevronRight size={14} /> Chemical Treatments
                 </div>
                 <div className="space-y-4">
                   {recResponse.recommendations.chemicalTreatments.map((chem, idx) => (
                     <div key={idx} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
                       <p className="text-sm font-bold text-white">{chem.activeIngredient}</p>
                       <div className="grid grid-cols-2 gap-2 mt-1.5 text-xs text-white/70">
                         <div><span className="text-white/40">Dosage:</span> {chem.dosage}</div>
                         {chem.sprayInterval && (
                           <div><span className="text-white/40">Interval:</span> {chem.sprayInterval}</div>
                         )}
                       </div>
                       {chem.notes && (
                         <p className="text-[11px] text-white/40 mt-1"><span className="font-semibold">Note:</span> {chem.notes}</p>
                       )}
                     </div>
                   ))}
                 </div>
              </div>
            )}

            {/* Preventive Best Practices */}
            <div className="rounded-2xl border border-stroke-3 bg-blue-500/10 p-5 relative overflow-hidden">
               <div className="text-xs font-bold text-blue-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                 <ChevronRight size={14} /> Prevention Guidelines
               </div>
               <ul className="list-disc pl-5 space-y-2 text-white/90 text-sm leading-relaxed">
                 {recResponse.recommendations.prevention.map((prev, idx) => (
                   <li key={idx}>{prev}</li>
                 ))}
               </ul>
            </div>

            {/* Monitoring Advice */}
            {recResponse.recommendations.monitoringAdvice.length > 0 && (
              <div className="rounded-2xl border border-stroke-3 bg-white/5 p-5 relative overflow-hidden">
                 <div className="text-xs font-bold text-white/60 mb-3 flex items-center gap-2 uppercase tracking-wider">
                   <ChevronRight size={14} /> Monitoring Advice
                 </div>
                 <ul className="list-disc pl-5 space-y-2 text-white/90 text-sm leading-relaxed">
                   {recResponse.recommendations.monitoringAdvice.map((m, idx) => (
                     <li key={idx}>{m}</li>
                   ))}
                 </ul>
              </div>
            )}
          </div>

          {/* Trigger Gemini AI Enhancement Layer */}
          <button
            onClick={() => onGetAIRecommendations(severity, kbData)}
            className="w-full rounded-xl border border-primary-500/50 bg-primary-600/20 py-3 text-sm font-bold text-primary-300 transition-all hover:bg-primary-600/30"
          >
            {isOffline ? 'Get Local AI Recommendations (Offline)' : 'Get AI Recommendations'}
          </button>
        </div>
      )}

      {/* Was this diagnosis correct? feedback */}
      {!feedbackGiven ? (
        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="text-center text-sm text-white/70 mb-3">Was this diagnosis correct?</p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => handleFeedback(true)} 
              className="px-6 py-2 rounded-full bg-green-500/20 text-green-300 hover:bg-green-500/30 text-sm font-semibold transition-all"
            >
              Yes
            </button>
            <button 
              onClick={() => handleFeedback(false)} 
              className="px-6 py-2 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 text-sm font-semibold transition-all"
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 border-t border-white/10 pt-4 text-center text-sm text-primary-400">
          Thank you for your feedback!
        </div>
      )}
    </div>
  );
}
