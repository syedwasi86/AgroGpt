import { useState } from 'react'
import { Droplet, FlaskConical, Bug, Scissors, Wheat, Eye, ClipboardList, CheckCircle2, AlertTriangle, Calendar, Save } from 'lucide-react'
import { formatUtcToLocal } from '../utils/dateUtils'
import { cn } from '../../../core/utils/cn'
import type { FarmTaskRecord } from '../../../lib/db'
import { StatusBadge } from '../shared/ui/StatusBadge'
import { useTranslation } from 'react-i18next'

interface TaskCardProps {
  task: FarmTaskRecord
  onToggleCompletion: (task: FarmTaskRecord) => Promise<void>
  onSaveNotes: (task: FarmTaskRecord, notes: string) => Promise<void>
}

const typeIconMap = {
  irrigation: <Droplet size={16} className="text-blue-400" />,
  fertilization: <FlaskConical size={16} className="text-purple-400" />,
  pesticide: <Bug size={16} className="text-red-400" />,
  weeding: <Scissors size={16} className="text-emerald-400" />,
  harvesting: <Wheat size={16} className="text-amber-400" />,
  inspection: <Eye size={16} className="text-teal-400" />,
  other: <ClipboardList size={16} className="text-white/40" />
}

export function TaskCard({ task, onToggleCompletion, onSaveNotes }: TaskCardProps) {
  const { t } = useTranslation(['common', 'cropCalendar'])
  const [notes, setNotes] = useState(task.notes || '')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [saving, setSaving] = useState(false)

  const isCompleted = task.status === 'completed'
  const isRescheduled = task.status === 'rescheduled'
  
  const handleSaveNotes = async () => {
    setSaving(true)
    try {
      await onSaveNotes(task, notes)
      setIsEditingNotes(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn(
      "p-5 rounded-2xl border transition-all relative overflow-hidden group bg-white/5",
      isCompleted 
        ? "border-green-500/30 bg-green-500/5" 
        : isRescheduled 
          ? "border-orange-500/40 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.05)]" 
          : "border-white/10 hover:bg-white/10 hover:border-white/20"
    )}>
      {isRescheduled && (
        <div className="absolute top-0 right-0 px-3 py-1 bg-orange-500/20 text-orange-400 text-[9px] font-bold rounded-bl-xl border-b border-l border-orange-500/30 uppercase tracking-wider flex items-center gap-1">
          <AlertTriangle size={10} />
          {t('cropCalendar.weatherDelay', 'Weather Delay')}
        </div>
      )}

      {task.sync_status === 'pending' && (
        <div className="absolute top-0 left-0 w-2 h-2 rounded-full bg-yellow-500 m-2" title={t('common.pendingSync', 'Pending Sync')} />
      )}

      <div className="flex justify-between items-start gap-4 mb-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => onToggleCompletion(task)}
            className={cn(
              "w-6 h-6 rounded-full border flex items-center justify-center transition-all shrink-0 mt-0.5",
              isCompleted 
                ? "bg-green-500 border-green-500 text-white" 
                : "border-white/30 hover:border-white/60 text-transparent hover:text-white/25"
            )}
          >
            <CheckCircle2 size={16} />
          </button>
          
          <div>
            <h4 className={cn(
              "font-bold text-white text-base leading-tight transition-all",
              isCompleted && "line-through text-white/30"
            )}>
              {task.title}
            </h4>
            {task.description && (
              <p className="text-white/50 text-xs mt-1 leading-relaxed">{task.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mt-4 text-[10px] font-bold uppercase tracking-wider flex-wrap border-t border-white/5 pt-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-white/40">
            <Calendar size={12} />
            <span className={cn(
              "text-white/60",
              isRescheduled && "line-through text-white/30 mr-1"
            )}>
              {formatUtcToLocal(task.scheduled_date)}
            </span>
            {isRescheduled && (
              <span className="text-orange-400 font-extrabold">{formatUtcToLocal(task.effective_date)}</span>
            )}
          </div>

          <div className={cn("px-2 py-0.5 rounded-full border flex items-center gap-1 text-[9px] bg-white/5 border-white/10 text-white/50")}>
            {typeIconMap[task.task_type] || typeIconMap.other}
            <span>{t(`cropCalendar.taskType.${task.task_type}`, task.task_type)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge type="priority" value={task.priority} />
        </div>
      </div>

      {/* Dynamic Notes Section */}
      <div className="mt-3 border-t border-white/5 pt-3">
        {isEditingNotes ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={t('cropCalendar.notesPlaceholder', 'Add operation notes...')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/20 flex-1 focus:outline-none focus:border-[#87A96B]/50"
            />
            <button
              onClick={handleSaveNotes}
              disabled={saving}
              className="p-1.5 bg-[#87A96B]/20 text-[#87A96B] hover:bg-[#87A96B]/30 border border-[#87A96B]/40 rounded-xl transition-all"
            >
              <Save size={14} />
            </button>
          </div>
        ) : (
          <div 
            onClick={() => setIsEditingNotes(true)}
            className="text-[11px] text-white/40 italic cursor-pointer hover:text-white/60 flex items-center gap-1.5 transition-all"
          >
            {task.notes ? (
              <span className="text-white/60 font-semibold not-italic">
                {t('cropCalendar.notesLabel', 'Notes: ')}
                {task.notes}
              </span>
            ) : (
              <span>{t('cropCalendar.addNotesHint', '+ Add completion notes (e.g. fertilizer brand, dosage)')}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
