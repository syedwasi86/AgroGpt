import React, { useState, useEffect } from 'react';
import { Sprout, Leaf, Flower, Wheat, Scissors, AlertCircle, Calendar, CheckCircle2, ArrowRight } from 'lucide-react';
import { useCrop } from '@/core/context/CropContext';
import { cn } from '@/core/utils/cn';

// 1. Simplified Farmer-Friendly Crop Lifecycle Map
export const CROP_CONFIG: Record<string, { totalDurationDays: number; milestones: any[] }> = {
  Rice: {
    totalDurationDays: 120,
    milestones: [
      { label: 'Seed Sowing', offsetDays: 0, icon: Sprout },
      { label: 'Growing Stage', offsetDays: 20, icon: Leaf },
      { label: 'Flowering Stage', offsetDays: 60, icon: Flower },
      { label: 'Grains Forming', offsetDays: 90, icon: Wheat },
      { label: 'Cutting Time', offsetDays: 120, icon: Scissors }
    ]
  },
  Wheat: {
    totalDurationDays: 130,
    milestones: [
      { label: 'Seed Sowing', offsetDays: 0, icon: Sprout },
      { label: 'Root Growing', offsetDays: 21, icon: Leaf },
      { label: 'Flowering Stage', offsetDays: 85, icon: Flower },
      { label: 'Grains Forming', offsetDays: 110, icon: Wheat },
      { label: 'Cutting Time', offsetDays: 130, icon: Scissors }
    ]
  },
  Cotton: {
    totalDurationDays: 180,
    milestones: [
      { label: 'Seed Sowing', offsetDays: 0, icon: Sprout },
      { label: 'Growing Stage', offsetDays: 30, icon: Leaf },
      { label: 'Flowering Stage', offsetDays: 70, icon: Flower },
      { label: 'Boll Bursting', offsetDays: 120, icon: Wheat },
      { label: 'Picking Time', offsetDays: 180, icon: Scissors }
    ]
  },
  Maize: {
    totalDurationDays: 110,
    milestones: [
      { label: 'Seed Sowing', offsetDays: 0, icon: Sprout },
      { label: 'Growing Stage', offsetDays: 25, icon: Leaf },
      { label: 'Flowering Stage', offsetDays: 55, icon: Flower },
      { label: 'Cob Forming', offsetDays: 80, icon: Wheat },
      { label: 'Cutting Time', offsetDays: 110, icon: Scissors }
    ]
  }
};

interface TaskItem {
  title: string;
  desc: string;
  icon: React.ComponentType<any>;
  type?: 'success' | 'weather' | 'default';
}

const getTodayWorkTasks = (crop: string, displayDay: number, totalDays: number): TaskItem[] => {
  if (displayDay >= totalDays) {
    return [
      {
        title: "Harvesting Complete",
        desc: "Your crop cycle is fully complete! Keep storage units clean, airy, and entirely dry to protect your harvest yield.",
        icon: Scissors,
        type: 'success'
      }
    ];
  }

  const pct = (displayDay / totalDays) * 100;

  if (crop === 'Rice') {
    if (pct < 20) {
      return [
        { title: "Direct Seeding & Nursery Prep", desc: "Keep nursery bed soil consistently moist. Watch for early weed growth.", icon: Sprout },
        { title: "Water Management", desc: "Maintain a shallow water depth of 2-3 cm in seedbeds.", icon: Leaf }
      ];
    } else if (pct < 50) {
      return [
        { title: "Transplanting & Spacing", desc: "Ensure proper spacing of 15x20 cm when transplanting seedlings into the main puddle field.", icon: Sprout },
        { title: "Nitrogen Top Dressing", desc: "Apply the first split dose of Urea at tillering stage.", icon: AlertCircle, type: 'weather' }
      ];
    } else if (pct < 80) {
      return [
        { title: "Water Level Monitoring", desc: "Keep water standing at 5 cm during active flowering and panicle initiation phases.", icon: Flower },
        { title: "Pest Scouting", desc: "Inspect lower stem sections for Brown Planthopper (BPH) infestation.", icon: AlertCircle }
      ];
    } else {
      return [
        { title: "Field Drainage", desc: "Drain the water from the field 10-15 days before the expected harvest date to harden soil.", icon: Wheat },
        { title: "Maturity Check", desc: "Ensure grains in the panicle have turned golden yellow before harvesting.", icon: Scissors }
      ];
    }
  } else if (crop === 'Wheat') {
    if (pct < 20) {
      return [
        { title: "Sowing Depth Check", desc: "Sow at 4-5 cm depth under optimal moisture conditions to ensure robust rooting.", icon: Sprout },
        { title: "First Irrigation (CRI Stage)", desc: "Apply water at the Crown Root Initiation stage (approx. 21 days after sowing). Highly critical!", icon: Leaf, type: 'weather' }
      ];
    } else if (pct < 50) {
      return [
        { title: "Weed Control", desc: "Apply recommended post-emergence herbicide if weed populations are high.", icon: Leaf },
        { title: "Urea Application", desc: "Apply second dose of Urea just before the second irrigation cycle.", icon: AlertCircle }
      ];
    } else if (pct < 80) {
      return [
        { title: "Flowering Irrigation", desc: "Keep soil moisture optimal. Drought during flowering reduces grain count per spike.", icon: Flower },
        { title: "Yellow Rust Monitoring", desc: "Inspect leaves for yellow/orange powdery pustules. Treat instantly if found.", icon: AlertCircle }
      ];
    } else {
      return [
        { title: "Stop Irrigation", desc: "Cease all watering to allow grains to dry and mature properly.", icon: Wheat },
        { title: "Harvesting Prep", desc: "Check grain moisture content. Harvest when grains are hard and crack when bitten.", icon: Scissors }
      ];
    }
  } else if (crop === 'Cotton') {
    if (pct < 20) {
      return [
        { title: "Sowing Spacing Check", desc: "Verify sowing spacing is 90x60 cm. Gap fill within 10 days if needed.", icon: Sprout },
        { title: "Seedling Protection", desc: "Scout for early sucking pests like thrips and jassids on young leaves.", icon: Leaf }
      ];
    } else if (pct < 50) {
      return [
        { title: "Inter-cultivation", desc: "Run blade harrows to remove weeds and create soil mulch for moisture conservation.", icon: Leaf },
        { title: "Fertility Boost", desc: "Apply side dressing of Nitrogen and Potassium fertilizer at square initiation stage.", icon: AlertCircle }
      ];
    } else if (pct < 80) {
      return [
        { title: "Bollworm Scouting", desc: "Inspect square flowers and fresh bolls for pink bollworm entry holes.", icon: Flower },
        { title: "Magnesium Application", desc: "Spray Magnesium Sulfate to prevent premature leaf reddening (Lalya).", icon: AlertCircle }
      ];
    } else {
      return [
        { title: "Picking Cotton Bolls", desc: "Harvest only fully opened, clean, dry cotton bolls in morning hours.", icon: Scissors },
        { title: "Defoliant Spray", desc: "If needed, apply light defoliant to ease uniform mechanical or manual picking.", icon: Wheat }
      ];
    }
  } else {
    // Maize
    if (pct < 20) {
      return [
        { title: "Deep Sowing Placement", desc: "Verify maize seeds are placed at 5 cm depth in moist soil beds.", icon: Sprout },
        { title: "Seedling Vigor Scout", desc: "Monitor germination uniformness. Hand-weed around young emerging shoots.", icon: Leaf }
      ];
    } else if (pct < 50) {
      return [
        { title: "Stem Borer Treatment", desc: "Apply granular insecticide in the leaf whorl to prevent Stem Borer damage.", icon: AlertCircle },
        { title: "Earthing Up", desc: "Perform ridge earthing up to support root anchor and prevent lodging.", icon: Leaf }
      ];
    } else if (pct < 80) {
      return [
        { title: "Silk Stage Moisture", desc: "Ensure no water stress during tasseling and silking, which determines cob sizes.", icon: Flower },
        { title: "Potash Top Dressing", desc: "Apply potassium to support grain filling and cob weight enhancement.", icon: AlertCircle }
      ];
    } else {
      return [
        { title: "Cob Moisture Check", desc: "Wait for the black layer to form at grain bases, signaling physiological maturity.", icon: Wheat },
        { title: "Cob Harvesting", desc: "De-husk and harvest cobs under clear sunny skies. Sun dry immediately.", icon: Scissors }
      ];
    }
  }
};

export function PrecisionPlanningPage() {
  const { activeCrop, sowingDate, updateActiveCrop, updateSowingDate } = useCrop();
  const [loading, setLoading] = useState(false);
  const [currentDayNumber, setCurrentDayNumber] = useState(0);

  // Local state for onboarding selections
  const [onboardCrop, setOnboardCrop] = useState(activeCrop || 'Rice');
  const [onboardSowingDate, setOnboardSowingDate] = useState(sowingDate || '');

  // Local state for task completion tracking
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});

  // Sync sowing date and calculations
  useEffect(() => {
    if (sowingDate) {
      const sDate = new Date(sowingDate);
      const today = new Date();
      const diffTime = today.getTime() - sDate.getTime();
      const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      setCurrentDayNumber(diffDays);
    } else {
      setCurrentDayNumber(0);
    }
    // Reset completed tasks state on crop/date change
    setCompletedTasks({});
  }, [activeCrop, sowingDate]);

  const handleOnboardInitialize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardCrop) return alert('Please select a crop!');
    if (!onboardSowingDate) return alert('Please select your sowing date!');
    setLoading(true);

    setTimeout(() => {
      updateActiveCrop(onboardCrop);
      updateSowingDate(onboardSowingDate);
      setLoading(false);
    }, 600);
  };

  const toggleTaskComplete = (title: string) => {
    setCompletedTasks(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0e1611]">
        <div className="text-center text-[#4ade80] font-bold animate-pulse text-lg">
          Setting up Today's Work...
        </div>
      </div>
    );
  }

  // Determine if onboarding is needed
  const hasOnboarded = !!(activeCrop && sowingDate);

  if (!hasOnboarded) {
    return (
      <div className="w-full max-w-4xl mx-auto min-h-screen bg-transparent p-4 pb-24 font-sans selection:bg-[#4ade80]/20 flex items-center justify-center">
        <div className="bg-[#141e18] rounded-2xl p-8 shadow-2xl border border-[#223328] w-full max-w-md transition-all">
          <div className="w-12 h-12 rounded-full bg-emerald-950 flex items-center justify-center mb-4 mx-auto border border-[#223328]">
            <Sprout className="w-6 h-6 text-[#4ade80]" />
          </div>
          <h2 className="text-xl font-bold text-white text-center mb-1">Start Your Calendar</h2>
          <p className="text-xs text-gray-400 text-center mb-6">Input your planting metrics to populate your localized daily farm advisor timeline.</p>
          
          <form onSubmit={handleOnboardInitialize} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">What crop are you growing?</label>
              <select 
                value={onboardCrop} 
                onChange={(e) => setOnboardCrop(e.target.value)}
                className="w-full p-3 bg-[#0e1611] border border-[#223328] rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-white font-medium transition-all"
              >
                <option value="Rice">Rice (Paddy)</option>
                <option value="Wheat">Wheat</option>
                <option value="Cotton">Cotton</option>
                <option value="Maize">Maize</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">On what date did you sow your seeds?</label>
              <input 
                type="date" 
                value={onboardSowingDate}
                onChange={(e) => setOnboardSowingDate(e.target.value)}
                className="w-full p-3 bg-[#0e1611] border border-[#223328] rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-white font-medium transition-all [color-scheme:dark]"
              />
            </div>

            <button 
              type="submit" 
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md hover:shadow-xl transition-all active:scale-95 mt-2"
            >
              GENERATE TODAY'S WORK
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeConfig = CROP_CONFIG[activeCrop] || CROP_CONFIG.Rice;
  const totalDays = activeConfig.totalDurationDays;

  // Fix the overflow bug by capping the display day metrics
  const displayDay = Math.min(currentDayNumber, totalDays);
  const completionPercentage = (displayDay / totalDays) * 100;

  const todayTasks = getTodayWorkTasks(activeCrop, displayDay, totalDays);
  const allTasksComplete = todayTasks.length > 0 && todayTasks.every(task => completedTasks[task.title]);

  const tomorrowDay = displayDay + 1;
  const tomorrowTasks = tomorrowDay <= totalDays ? getTodayWorkTasks(activeCrop, tomorrowDay, totalDays) : [];

  return (
    <div className="w-full max-w-4xl mx-auto min-h-screen bg-transparent p-4 pb-24 font-sans selection:bg-[#4ade80]/20 space-y-6">
      
      {/* 1. Status Overview Header Card */}
      <div className="bg-[#141e18] border border-[#223328] text-white p-6 rounded-2xl shadow-xl">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs bg-[#0e1611] backdrop-blur-sm px-3 py-1 rounded-full font-bold border border-[#223328] tracking-wide uppercase">
            {activeCrop} Track
          </span>
          <span className="text-sm font-black tracking-tight text-[#4ade80]">
            Day {displayDay} / {totalDays}
          </span>
        </div>
        
        {/* 2. Interactive Horizontal Lifecycle Bar with Milestone Bubbles */}
        <div className="relative mt-8 mb-6 px-2">
          {/* The Base Track Line */}
          <div className="absolute top-3 left-2 right-2 h-1 bg-[#0e1611]/80 rounded-full z-0">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>

          {/* Dynamic Milestone Nodes Mapping */}
          <div className="flex justify-between relative z-10">
            {activeConfig.milestones.map((milestone: any, index: number) => {
              const MilestoneIcon = milestone.icon;
              const isPassed = displayDay >= milestone.offsetDays;
              
              return (
                <div key={index} className="flex flex-col items-center flex-1">
                  {/* Milestone Node Step Circle */}
                  <div 
                    className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                      isPassed 
                        ? 'bg-[#4ade80] border-[#4ade80] text-[#0e1611] shadow-md shadow-emerald-500/20' 
                        : 'bg-[#1d3526] border-[#223328] text-[#4ade80]/40'
                    }`}
                  >
                    <MilestoneIcon className="w-4 h-4" />
                  </div>
                  {/* Farmer-Friendly Stage Label */}
                  <span 
                    className={`text-[10px] font-bold mt-2 text-center max-w-[65px] leading-tight transition-colors ${
                      isPassed ? 'text-white' : 'text-gray-500'
                    }`}
                  >
                    {milestone.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. 1-Week Outlook Panel */}
      <div className="bg-[#141e18] border border-[#223328] rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#4ade80]" />
          1-Week Outlook
        </h3>
        <div className="space-y-2">
          {Array.from({ length: 7 }, (_, i) => {
            const targetDay = displayDay + i + 1;
            if (targetDay > totalDays) return null;
            
            const dayTasks = getTodayWorkTasks(activeCrop, targetDay, totalDays);
            return (
              <details key={i} className="group border border-[#223328] bg-[#0e1611]/50 rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex justify-between items-center p-4 cursor-pointer select-none text-sm font-bold text-gray-300 hover:text-white group-open:bg-white/5 transition-colors">
                  <span>Day {targetDay} Directive</span>
                  <span className="text-xs text-[#4ade80] font-bold">
                    {dayTasks.length} task{dayTasks.length === 1 ? '' : 's'}
                  </span>
                </summary>
                <div className="p-4 border-t border-[#223328] space-y-3 bg-[#141e18]/30">
                  {dayTasks.map((t, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80] mt-1.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-white">{t.title}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{t.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </div>

      {/* 3. Today's Work Timeline Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white tracking-tight px-0.5">Today's Work</h3>

        {allTasksComplete ? (
          /* Celebratory Success Panel */
          <div className="bg-[#141e18] border border-[#223328] p-8 rounded-2xl shadow-xl flex flex-col items-center text-center animate-in zoom-in duration-300">
            <div className="w-16 h-16 rounded-full bg-[#1d3526] border border-[#4ade80] flex items-center justify-center mb-4 text-[#4ade80] animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#4ade80] uppercase tracking-wider mb-2">All Tasks Done!</h3>
            <p className="text-base text-gray-200 font-semibold mb-6">Good job! Now be ready for tomorrow's tasks.</p>
            
            {tomorrowTasks.length > 0 && (
              <div className="w-full text-left bg-[#0e1611] rounded-xl p-5 border border-[#223328]">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <ArrowRight className="w-4 h-4 text-[#4ade80]" />
                  Tomorrow's Preview (Day {tomorrowDay})
                </h4>
                <div className="space-y-4">
                  {tomorrowTasks.map((t, idx) => {
                    const TomorrowIcon = t.icon;
                    return (
                      <div key={idx} className="flex gap-3 items-start">
                        <div className="w-8 h-8 rounded-full bg-[#141e18] border border-[#223328] flex items-center justify-center shrink-0">
                          <TomorrowIcon className="w-4 h-4 text-[#4ade80]" />
                        </div>
                        <div>
                          <h5 className="text-sm font-bold text-white">{t.title}</h5>
                          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{t.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : displayDay >= totalDays ? (
          /* Final Stage Action Card */
          <div className="bg-[#141e18] border border-[#223328] p-5 rounded-xl flex gap-4 items-start shadow-xl">
            <div className="w-10 h-10 rounded-full bg-emerald-950 flex items-center justify-center shrink-0 border border-[#223328]">
              <Scissors className="w-5 h-5 text-[#4ade80]" />
            </div>
            <div>
              <h4 className="font-bold text-[#4ade80] text-base">Harvesting Complete</h4>
              <p className="text-sm text-gray-300 mt-1 leading-relaxed">Your crop cycle is fully complete! Keep storage units clean, airy, and entirely dry to protect your harvest yield.</p>
            </div>
          </div>
        ) : (
          /* Today's Tasks List */
          <div className="space-y-4">
            {todayTasks.map((task, idx) => {
              const TaskIcon = task.icon;
              const isCompleted = completedTasks[task.title];
              return (
                <div 
                  key={idx}
                  className={cn(
                    "p-5 rounded-xl border shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all duration-300 hover:scale-[1.01] bg-[#141e18] border-[#223328]",
                    isCompleted && "opacity-60"
                  )}
                >
                  <div className="flex gap-4 items-start">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border",
                      isCompleted ? "bg-[#1d3526] border-[#4ade80] text-[#4ade80]" : "bg-emerald-950 border-[#223328]"
                    )}>
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <TaskIcon className="w-5 h-5 text-[#4ade80]" />}
                    </div>
                    <div>
                      <h4 className={cn("font-bold text-base flex items-center gap-2 text-white")}>
                        {task.title}
                        {isCompleted && <span className="text-xs text-[#4ade80] font-normal">(Completed)</span>}
                      </h4>
                      <p className="text-sm text-gray-300 mt-1 leading-relaxed">{task.desc}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleTaskComplete(task.title)}
                    className={cn(
                      "w-full md:w-auto px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all border shrink-0",
                      isCompleted
                        ? "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                        : "bg-[#4ade80] border-[#4ade80] text-[#0e1611] hover:bg-[#5aee90] shadow-md shadow-emerald-500/10"
                    )}
                  >
                    {isCompleted ? "Undo" : "Mark Task as Done"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default PrecisionPlanningPage;
