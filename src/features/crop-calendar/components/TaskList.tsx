import { TaskCard } from './TaskCard'
import { Calendar, ShieldAlert } from 'lucide-react'
import type { FarmTaskRecord } from '../../../lib/db'
import { useTranslation } from 'react-i18next'

interface TaskListProps {
  tasks: FarmTaskRecord[]
  overdueTasks: FarmTaskRecord[]
  onToggleCompletion: (task: FarmTaskRecord) => Promise<void>
  onSaveNotes: (task: FarmTaskRecord, notes: string) => Promise<void>
  title: string
}

export function TaskList({
  tasks,
  overdueTasks,
  onToggleCompletion,
  onSaveNotes,
  title
}: TaskListProps) {
  const { t } = useTranslation(['common', 'cropCalendar'])
  const hasOverdue = overdueTasks.length > 0
  const hasTasks = tasks.length > 0

  return (
    <div className="flex flex-col gap-6">
      {/* Overdue Section */}
      {hasOverdue && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-5">
          <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-wider text-xs mb-3">
            <ShieldAlert size={16} className="animate-bounce" />
            {t('cropCalendar.overdue', 'Overdue')}
          </div>
          <div className="space-y-3">
            {overdueTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggleCompletion={onToggleCompletion}
                onSaveNotes={onSaveNotes}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Task List */}
      <div className="flex-1 flex flex-col gap-3">
        <h3 className="text-lg font-black text-white/80 tracking-wider uppercase mb-1">{title}</h3>
        
        {hasTasks ? (
          <div className="max-h-[400px] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggleCompletion={onToggleCompletion}
                onSaveNotes={onSaveNotes}
              />
            ))}
          </div>
        ) : (
          !hasOverdue && (
            <div className="h-48 border border-white/5 bg-white/2 rounded-3xl flex flex-col items-center justify-center text-center p-6 text-white/30">
              <Calendar size={36} className="mb-3 opacity-30" />
              <p className="text-sm font-semibold">{t('cropCalendar.noTasksScheduled', 'No operations scheduled.')}</p>
              <p className="text-xs text-white/20 mt-1">{t('cropCalendar.calendarClean', 'Enjoy the day, your crop calendar is clean!')}</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
