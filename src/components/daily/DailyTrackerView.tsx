import React, { useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Circle, 
  Flame, 
  Timer, 
  Sliders, 
  Plus, 
  Trash2, 
  Sparkles,
  ArrowRight,
  TrendingUp,
  Clock,
  RotateCcw
} from 'lucide-react';

export const DailyTrackerView: React.FC<{ onOpenGWS: () => void; onCustomizeTemplate: () => void }> = ({
  onOpenGWS,
  onCustomizeTemplate
}) => {
  const { 
    selectedDate, 
    setSelectedDate, 
    goToPreviousDay, 
    goToNextDay, 
    goToToday,
    getEntryForDate,
    saveDailyEntry,
    gwsSessions,
    templates
  } = useStorage();

  const currentEntry = getEntryForDate(selectedDate);
  const dailyTemplate = templates.find(t => t.id === currentEntry.templateId) || templates.find(t => t.category === 'daily');

  // Task list items parsed from plan notes or custom tasks
  const [newTaskInput, setNewTaskInput] = useState('');
  const [showRoutinesList, setShowRoutinesList] = useState(false);

  // Helper date ribbons
  const getDatesRibbon = () => {
    const list = [];
    const base = new Date(selectedDate);
    for (let i = -3; i <= 3; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      list.push({
        dateStr,
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isCurrent: dateStr === selectedDate
      });
    }
    return list;
  };

  const datesRibbon = getDatesRibbon();

  // Find GWS sessions belonging to this date
  const todaySessions = gwsSessions.filter(s => s.date === selectedDate);

  // Update handlers
  const handleScoreChange = (score: number) => {
    saveDailyEntry(selectedDate, { executionScore: score });
  };

  const handleAutomaticToggle = () => {
    saveDailyEntry(selectedDate, { automaticTasksCompleted: !currentEntry.automaticTasksCompleted });
  };

  const handleMainTasksCompletedChange = (delta: number) => {
    const nextCompleted = Math.max(0, Math.min(currentEntry.mainTasksTotal, currentEntry.mainTasksCompleted + delta));
    saveDailyEntry(selectedDate, { mainTasksCompleted: nextCompleted });
  };

  const handleMainTasksTotalChange = (delta: number) => {
    const nextTotal = Math.max(1, currentEntry.mainTasksTotal + delta);
    saveDailyEntry(selectedDate, { 
      mainTasksTotal: nextTotal,
      mainTasksCompleted: Math.min(currentEntry.mainTasksCompleted, nextTotal)
    });
  };

  const handlePlanNotesChange = (text: string) => {
    saveDailyEntry(selectedDate, { planNotes: text });
  };

  const handleReviewNotesChange = (text: string) => {
    saveDailyEntry(selectedDate, { reviewNotes: text });
  };

  // Helper score color
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
    if (score >= 6) return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
    if (score > 0) return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
    return 'text-slate-500 bg-slate-800/40 border-slate-700/40';
  };

  // Check if date is today (simulated 2026-10-28)
  const isSelectedToday = selectedDate === '2026-10-28';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Navigation & Date Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Date Selector with previous/today/next */}
          <div className="flex items-center space-x-2">
            <button
              onClick={goToPreviousDay}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 px-4 py-2 rounded-2xl bg-slate-950 border border-slate-800">
              <CalendarIcon className="w-5 h-5 text-amber-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-100 font-bold font-mono text-sm sm:text-base focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={goToNextDay}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {!isSelectedToday && (
              <button
                onClick={goToToday}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 transition-all"
              >
                Jump to Today
              </button>
            )}
          </div>

          {/* Action buttons on header */}
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <button
              onClick={onCustomizeTemplate}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
              title="Customize Card Sizes & Layout"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Customize Cards & Layout</span>
            </button>

            <button
              onClick={onOpenGWS}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 active:scale-95"
            >
              <Timer className="w-4 h-4" />
              <span>+ Record GWS</span>
            </button>
          </div>

        </div>

        {/* 7-Day Mini Date Ribbon */}
        <div className="grid grid-cols-7 gap-2 pt-2 border-t border-slate-800/80">
          {datesRibbon.map((item) => {
            const entry = getEntryForDate(item.dateStr);
            const hasGws = entry.gwsSessionIds.length > 0;
            const score = entry.executionScore;

            return (
              <button
                key={item.dateStr}
                onClick={() => setSelectedDate(item.dateStr)}
                className={`flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all ${
                  item.isCurrent
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 ring-2 ring-amber-400'
                    : 'bg-slate-950/60 hover:bg-slate-800/80 text-slate-400 border border-slate-800'
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider ${item.isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>
                  {item.dayName}
                </span>
                <span className={`text-base font-extrabold font-mono mt-0.5 ${item.isCurrent ? 'text-slate-950' : 'text-slate-100'}`}>
                  {item.dayNum}
                </span>

                {/* Score & GWS indicators */}
                <div className="flex items-center space-x-1 mt-1">
                  {score > 0 && (
                    <span className={`text-[9px] font-mono px-1 rounded font-bold ${
                      item.isCurrent ? 'bg-slate-900 text-amber-400' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {score}/10
                    </span>
                  )}
                  {hasGws && (
                    <span className={`w-1.5 h-1.5 rounded-full ${item.isCurrent ? 'bg-slate-900' : 'bg-amber-400'}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

      </div>

      {/* Modular Daily Layout Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* CARD 1: Main Tasks Completed (Modular Card) */}
        <div className="md:col-span-6 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 shadow-xl transition-all relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  Main Tasks Completed
                </h3>
                <p className="text-xs text-slate-400">Target daily task delivery</p>
              </div>
            </div>

            {/* Score Ratio Display */}
            <div className="text-right">
              <span className="text-2xl font-extrabold font-mono text-amber-400">
                {currentEntry.mainTasksCompleted}
              </span>
              <span className="text-slate-500 font-mono text-lg"> / {currentEntry.mainTasksTotal}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 mb-4">
            <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.round((currentEntry.mainTasksCompleted / Math.max(1, currentEntry.mainTasksTotal)) * 100))}%`
                }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>{Math.round((currentEntry.mainTasksCompleted / Math.max(1, currentEntry.mainTasksTotal)) * 100)}% Fulfilled</span>
              <span>Target: {currentEntry.mainTasksTotal} tasks</span>
            </div>
          </div>

          {/* Quick Counter Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">Quick adjustments:</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleMainTasksCompletedChange(-1)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold font-mono transition-colors"
                title="Decrease completed"
              >
                -1
              </button>
              <button
                onClick={() => handleMainTasksCompletedChange(1)}
                className="px-3 h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 font-bold text-xs transition-colors"
                title="Mark one completed"
              >
                +1 Done
              </button>
              <button
                onClick={() => handleMainTasksTotalChange(1)}
                className="px-2.5 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-semibold"
                title="Add to target"
              >
                + Goal
              </button>
            </div>
          </div>
        </div>

        {/* CARD 2: Daily Execution Score (1–10) */}
        <div className="md:col-span-6 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 shadow-xl transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  Execution Score (1–10)
                </h3>
                <p className="text-xs text-slate-400">Rate personal execution discipline</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getScoreColor(currentEntry.executionScore)}`}>
                {currentEntry.executionScore > 0 ? `${currentEntry.executionScore} / 10` : 'Not Rated'}
              </span>
            </div>
          </div>

          {/* 1-10 Pill Selector */}
          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                const isSelected = currentEntry.executionScore === score;
                return (
                  <button
                    key={score}
                    type="button"
                    onClick={() => handleScoreChange(score)}
                    className={`py-2 rounded-xl text-xs font-bold font-mono transition-all ${
                      isSelected
                        ? score >= 8
                          ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400 shadow-md shadow-emerald-500/30'
                          : score >= 6
                          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 shadow-md shadow-amber-500/30'
                          : 'bg-orange-500 text-slate-950 ring-2 ring-orange-400 shadow-md shadow-orange-500/30'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {score}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between text-[11px] text-slate-500 font-mono px-1">
              <span>1: Low Discipline</span>
              <span>6: Standard Solid</span>
              <span>10: Flawless Beast</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Status:</span>
            <span className="font-semibold text-slate-200">
              {currentEntry.executionScore >= 8 && '🔥 High Execution Momentum'}
              {currentEntry.executionScore >= 6 && currentEntry.executionScore < 8 && '⚡ Steady Execution Baseline'}
              {currentEntry.executionScore > 0 && currentEntry.executionScore < 6 && '⚠️ Needs Immediate Course Correction'}
              {currentEntry.executionScore === 0 && 'Unscored session'}
            </span>
          </div>
        </div>

        {/* CARD 3: Automatic Tasks (Routines / Habits) */}
        <div className="md:col-span-6 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  Automatic Tasks Completed
                </h3>
                <p className="text-xs text-slate-400">Non-negotiable daily protocols & routines</p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              onClick={handleAutomaticToggle}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                currentEntry.automaticTasksCompleted
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <span>{currentEntry.automaticTasksCompleted ? 'Yes (Locked In)' : 'No (Pending)'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-3">
            Automatic tasks represent your automated habits: morning protocol, physical training, cohort check-in, system backups.
          </p>

          <button
            onClick={() => setShowRoutinesList(!showRoutinesList)}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1"
          >
            <span>{showRoutinesList ? 'Hide Routine Checklist' : 'View Routine Checklist'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {showRoutinesList && (
            <div className="mt-4 space-y-2 p-3 bg-slate-950 rounded-2xl border border-slate-800/80 text-xs">
              {[
                'Morning Protocol & Hydration',
                'Boot camp / Training session',
                'Miro board & cohort review',
                'Trading prep & market checkpoints',
                'Evening shutdown & reflexion'
              ].map((routine, idx) => (
                <div key={idx} className="flex items-center space-x-2 text-slate-300">
                  <CheckCircle2 className={`w-4 h-4 ${currentEntry.automaticTasksCompleted ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span>{routine}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CARD 4: GWS Sessions Done Today */}
        <div className="md:col-span-6 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 shadow-xl transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  GWS Done Today
                </h3>
                <p className="text-xs text-slate-400">Deep work sprints completed</p>
              </div>
            </div>

            <button
              onClick={onOpenGWS}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New GWS</span>
            </button>
          </div>

          {/* Sessions List */}
          <div className="space-y-2 mb-4">
            {todaySessions.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-500">
                No GWS sessions recorded yet for {selectedDate}. Launch a sprint to build momentum!
              </div>
            ) : (
              todaySessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-100">{s.taskName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {s.actualMinutes}m actual • Focus: {s.ratings.focus}/5
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-extrabold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-lg border border-amber-500/20">
                      {s.ratings.total}/15
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Sessions count:</span>
            <span className="font-mono font-bold text-slate-200">
              {todaySessions.length} sprint{todaySessions.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* CARD 5: Day Plan & Direct Priorities (Full Width) */}
        <div className="md:col-span-12 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-xl transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Daily Mission Plan
              </span>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Day Plan & Priorities ({selectedDate})
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">Autosaved</span>
          </div>

          <p className="text-xs text-slate-400">
            Write your numbered priorities for the day (e.g. 1 finish discord, 2 boot camp, 3 assess current situation):
          </p>

          <textarea
            value={currentEntry.planNotes}
            onChange={(e) => handlePlanNotesChange(e.target.value)}
            placeholder="1 finish the discord and do a test run + get commitment to first meeting&#10;2 boot camp plus plan a trading start on miro with basic checkpoints&#10;3 assess current situation: what needs to happen, what to learn, what systems now and what to buy"
            rows={5}
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none transition-colors resize-y leading-relaxed"
          />
        </div>

        {/* CARD 6: Daily Reflexions & Evening Review */}
        <div className="md:col-span-12 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-xl transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                End-of-Day Review
              </span>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Daily Reflexion & Course Correction
              </h3>
            </div>
          </div>

          <textarea
            value={currentEntry.reviewNotes || ''}
            onChange={(e) => handleReviewNotesChange(e.target.value)}
            placeholder="Review how the day unfolded. What held you back? What will you adjust for tomorrow's session?"
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-2xl p-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-colors resize-y leading-relaxed"
          />
        </div>

      </div>

    </div>
  );
};
