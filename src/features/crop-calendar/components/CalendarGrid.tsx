import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../../core/utils/cn'
import type { FarmTaskRecord } from '../../../lib/db'
import { useTranslation } from 'react-i18next'

interface CalendarGridProps {
  tasks: FarmTaskRecord[]
  selectedDate: string // YYYY-MM-DD
  onSelectDate: (date: string) => void
}

export function CalendarGrid({ tasks, selectedDate, onSelectDate }: CalendarGridProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language || 'en'

  const [currentYear, setCurrentYear] = useState(new Date().getUTCFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getUTCMonth()) // 0-indexed

  // Pre-group tasks by effective date string for O(1) rendering checks
  const groupedTasks = useMemo(() => {
    const groups: Record<string, FarmTaskRecord[]> = {}
    tasks.forEach(t => {
      if (t.deleted_at) return
      const date = t.effective_date
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(t)
    })
    return groups
  }, [tasks])

  // Generate days array for the grid
  const calendarDays = useMemo(() => {
    // Determine the day of week the month starts on
    const firstDayIndex = new Date(Date.UTC(currentYear, currentMonth, 1)).getUTCDay()
    // Days in current month
    const totalDays = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate()
    
    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = []

    // Add padding days from the previous month
    const prevMonthTotalDays = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate()
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i
      const m = currentMonth === 0 ? 12 : currentMonth
      const y = currentMonth === 0 ? currentYear - 1 : currentYear
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      days.push({ dateStr, dayNum, isCurrentMonth: false })
    }

    // Add current month days
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      days.push({ dateStr, dayNum, isCurrentMonth: true })
    }

    // Add padding days for next month to round to full grid rows of 7
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      const m = currentMonth === 11 ? 1 : currentMonth + 2
      const y = currentMonth === 11 ? currentYear + 1 : currentYear
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      days.push({ dateStr, dayNum: i, isCurrentMonth: false })
    }

    return days
  }, [currentMonth, currentYear])

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const getTaskDots = (dateStr: string) => {
    const dayTasks = groupedTasks[dateStr] || []
    if (dayTasks.length === 0) return null

    // Deduplicate types to draw one dot per category scheduled on that day
    const types = Array.from(new Set(dayTasks.map(t => t.task_type)))
    
    return (
      <div className="flex gap-0.5 justify-center mt-1">
        {types.slice(0, 4).map((type) => {
          const dotColor =
            type === 'irrigation' ? 'bg-blue-400' :
            type === 'fertilization' ? 'bg-purple-400' :
            type === 'pesticide' ? 'bg-red-400' :
            type === 'weeding' ? 'bg-emerald-400' :
            type === 'harvesting' ? 'bg-amber-400' :
            'bg-teal-400'

          return <span key={type} className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
        })}
      </div>
    )
  }

  const monthYearString = useMemo(() => {
    return new Intl.DateTimeFormat(lang, { 
      month: 'long', 
      year: 'numeric',
      numberingSystem: 'latn' 
    }).format(new Date(Date.UTC(currentYear, currentMonth, 1)))
  }, [currentMonth, currentYear, lang])

  const weekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(lang, { weekday: 'short', numberingSystem: 'latn' })
    return Array.from({ length: 7 }, (_, i) => {
      // 2026-06-14 is a Sunday
      const d = new Date(Date.UTC(2026, 5, 14 + i))
      return formatter.format(d)
    })
  }, [lang])

  return (
    <div className="border border-white/5 bg-[#121412]/80 backdrop-blur-xl p-5 rounded-3xl">
      {/* Calendar Header */}
      <div className="flex justify-between items-center mb-5">
        <h4 className="text-white font-extrabold text-lg">
          {monthYearString}
        </h4>
        <div className="flex gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 border border-white/10 hover:border-white/20 hover:bg-white/5 rounded-xl text-white/60 hover:text-white transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 border border-white/10 hover:border-white/20 hover:bg-white/5 rounded-xl text-white/60 hover:text-white transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekdays Labels */}
      <div className="grid grid-cols-7 gap-1 text-center text-white/30 text-[10px] font-black uppercase tracking-wider mb-2">
        {weekdays.map(d => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Grid Days */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          const isSelected = day.dateStr === selectedDate
          const dayTasks = groupedTasks[day.dateStr] || []
          const hasPending = dayTasks.some(t => t.status !== 'completed')
          const isToday = day.dateStr === new Date().toISOString().split('T')[0]

          return (
            <button
              key={idx}
              onClick={() => onSelectDate(day.dateStr)}
              className={cn(
                "h-14 rounded-2xl flex flex-col items-center justify-between py-1.5 border transition-all relative overflow-hidden",
                day.isCurrentMonth ? "text-white" : "text-white/20 border-transparent",
                isSelected
                  ? "bg-[#87A96B] border-white/30 text-white font-black shadow-[0_0_15px_rgba(135,169,107,0.4)]"
                  : day.isCurrentMonth
                    ? cn(
                        "bg-white/2 border-white/5 hover:bg-white/5 hover:border-white/10",
                        isToday && "border-[#87A96B]/50 bg-[#87A96B]/5"
                      )
                    : "bg-transparent border-transparent"
              )}
            >
              <span className={cn(
                "text-xs leading-none mt-0.5",
                isToday && !isSelected && "text-[#87A96B] font-bold"
              )}>
                {day.dayNum}
              </span>
              
              {/* Task Indicators */}
              <div className="w-full flex-grow flex items-end justify-center pb-1">
                {getTaskDots(day.dateStr)}
              </div>

              {/* Small dot for pending status */}
              {hasPending && !isSelected && (
                <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-yellow-500" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
