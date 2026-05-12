import React, { useState } from 'react'
import { CheckCircle, ShieldAlert, Activity, ChevronRight } from 'lucide-react'
import { cn } from '../../core/utils/cn'
import { getDiseaseRecommendation } from './diseaseRecommendations'

interface Props {
  crop: string
  disease: string
  confidence: number
  isOffline: boolean
  onFeedback: (isCorrect: boolean) => void
  onGetAIRecommendations: () => void
}

export function PredictionResults({ crop, disease, confidence, isOffline, onFeedback, onGetAIRecommendations }: Props) {
  const [feedbackGiven, setFeedbackGiven] = useState(false)
  const isConfident = confidence >= 75
  const isHealthy = disease.toLowerCase() === 'healthy'
  
  const recommendation = getDiseaseRecommendation(crop, disease)

  const handleFeedback = (isCorrect: boolean) => {
    onFeedback(isCorrect)
    setFeedbackGiven(true)
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "grid h-12 w-12 place-items-center rounded-2xl border shadow-lg",
            isHealthy ? "border-green-500/30 bg-green-500/10 text-green-400" :
            (!isConfident) ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" :
            "border-red-500/30 bg-red-500/10 text-red-400"
          )}>
            {isHealthy ? <CheckCircle size={24} /> :
             (!isConfident) ? <ShieldAlert size={24} /> :
             <Activity size={24} />}
          </div>
          <div>
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Diagnosis Result</div>
            <div className="text-xl font-bold text-white capitalize">{disease.replace(/_/g, ' ')}</div>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-medium text-white/70">AI Confidence Score</div>
          <div className="text-sm font-bold text-white">{confidence}%</div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-1000 ease-out",
              confidence >= 75 ? "bg-primary-500" : "bg-yellow-500"
            )}
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {!isConfident && (
        <div className="mb-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-sm">
          Warning: Low confidence prediction. Please retake a clearer photo or {isOffline ? 'wait until online' : 'get AI recommendations'}.
        </div>
      )}

      <div className="space-y-4 mb-6">
        <div className="rounded-2xl border border-stroke-3 bg-secondary/10 p-5 relative overflow-hidden">
           <div className="text-sm font-semibold text-secondary mb-2 flex items-center gap-2">
             <ChevronRight size={16} /> Organic Treatment
           </div>
           <p className="text-white/90 font-medium text-sm leading-relaxed">{recommendation.organic}</p>
        </div>
        <div className="rounded-2xl border border-stroke-3 bg-red-500/10 p-5 relative overflow-hidden">
           <div className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
             <ChevronRight size={16} /> Chemical Treatment
           </div>
           <p className="text-white/90 font-medium text-sm leading-relaxed">{recommendation.chemical}</p>
        </div>
        <div className="rounded-2xl border border-stroke-3 bg-blue-500/10 p-5 relative overflow-hidden">
           <div className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
             <ChevronRight size={16} /> Prevention
           </div>
           <p className="text-white/90 font-medium text-sm leading-relaxed">{recommendation.prevention}</p>
        </div>
      </div>

      {(!isConfident && !isOffline) && (
        <button
          onClick={onGetAIRecommendations}
          className="w-full mb-6 rounded-xl border border-primary-500/50 bg-primary-600/20 py-3 text-sm font-bold text-primary-300 transition-all hover:bg-primary-600/30"
        >
          Get AI Recommendations
        </button>
      )}

      {!feedbackGiven ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-center text-sm text-white/70 mb-3">Was this diagnosis correct?</p>
          <div className="flex gap-4 justify-center">
            <button onClick={() => handleFeedback(true)} className="px-6 py-2 rounded-full bg-green-500/20 text-green-300 hover:bg-green-500/30 text-sm font-semibold">Yes</button>
            <button onClick={() => handleFeedback(false)} className="px-6 py-2 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 text-sm font-semibold">No</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 border-t border-white/10 pt-4 text-center text-sm text-primary-400">
          Thank you for your feedback!
        </div>
      )}
    </div>
  )
}
