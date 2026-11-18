import React, { useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  CheckCircle2,
  Sliders, 
  Clock,
  Sparkles,
  Target,
  ArrowRight
} from 'lucide-react';
import { ModularCardGrid } from '../modular/ModularCardGrid';
import { QuickCopyPasteBar } from '../common/QuickCopyPasteBar';

export const DailyTrackerView: React.FC<{ onOpenGWS: () => void; onCustomizeTemplate: () => void }> = ({
  onOpenGWS,
  onCustomizeTemplate
}) => {
  const { 
    todayDate,
    selectedDate, 
    setSelectedDate, 
    goToPreviousDay, 
    goToNextDay, 
    goToToday,
    getEntryForDate,
    saveDailyEntry,
    gwsSessions,
    weeklyPlans,
    selectedWeekId,
    templates
  } = useStorage();

  const activeWeeklyPlan = weeklyPlans[selectedWeekId] || weeklyPlans['week_3'];

  const currentEntry = getEntryForDate(selectedDate);
  // Find active template for daily category
  const dailyTemplate = templates.find(t => t.id === currentEntry.templateId) || 
                        templates.find(t => t.category === 'daily') || 
                        templates[0];

  const todaySessions = gwsSessions.filter(s => s.date === selectedDate);

  // Helper date ribbons
  const getDatesRibbon = () => {
    const list = [];
    const base = new Date(`${selectedDate}T12:00:00`);
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
        isCurrent: dateStr === selectedDate,
        isToday: dateStr === todayDate
      });
    }
    return list;
  };

  // Map template fields to actual values in currentEntry
  const getFieldValue = (fieldId: string) => {
    switch (fieldId) {
      case 'main_tasks_ratio':
        return {
          completed: currentEntry.mainTasksCompleted,
          total: currentEntry.mainTasksTotal
        };
      case 'execution_score':
        return currentEntry.executionScore;
      case 'automatic_tasks':
        return currentEntry.automaticTasksCompleted;
      case 'gws_sessions_done':
        return todaySessions;
      case 'plan_notes':
        return currentEntry.planNotes;
      case 'daily_reflexion':
        return currentEntry.reviewNotes || '';
      default:
        return currentEntry.customFieldValues?.[fieldId];
    }
  };

  // Universal handler for updating dynamic field values
  const handleFieldChange = (fieldId: string, value: any) => {
    switch (fieldId) {
      case 'main_tasks_ratio':
        saveDailyEntry(selectedDate, {
          mainTasksCompleted: value.completed,
          mainTasksTotal: value.total
        });
        break;
      case 'execution_score':
        saveDailyEntry(selectedDate, { executionScore: value });
        break;
      case 'automatic_tasks':
        saveDailyEntry(selectedDate, { automaticTasksCompleted: value });
        break;
      case 'plan_notes':
        saveDailyEntry(selectedDate, { planNotes: value });
        break;
      case 'daily_reflexion':
        saveDailyEntry(selectedDate, { reviewNotes: value });
        break;
      default:
        saveDailyEntry(selectedDate, {
          customFieldValues: {
            ...(currentEntry.customFieldValues || {}),
            [fieldId]: value
          }
        });
        break;
    }
  };

  // Build field value map for the dynamic grid
  const dynamicValues: Record<string, any> = {};
  if (dailyTemplate && dailyTemplate.fields) {
    dailyTemplate.fields.forEach(f => {
      dynamicValues[f.id] = getFieldValue(f.id);
    });
  }

  const handleAction = (actionName: string) => {
    if (actionName === 'open_gws') {
      onOpenGWS();
    }
  };

  const handleApplyParsedPlan = (tasksText: string) => {
    const existing = currentEntry.planNotes ? `${currentEntry.planNotes}\n` : '';
    saveDailyEntry(selectedDate, {
      planNotes: `${existing}${tasksText}`
    });
  };

  const isSelectedToday = selectedDate === todayDate;

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
              {isSelectedToday && (
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Today
                </span>
              )}
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
              title="Change cards, order, size and shape"
            >
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Customize Cards & Shapes</span>
            </button>
          </div>

        </div>

        {/* 7-Day Quick Selection Ribbon */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto pb-1">
          {getDatesRibbon().map((item) => (
            <button
              key={item.dateStr}
              onClick={() => setSelectedDate(item.dateStr)}
              className={`flex-1 min-w-[58px] py-2 px-1 rounded-2xl flex flex-col items-center justify-center transition-all relative ${
                item.isCurrent
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/20 ring-2 ring-amber-400'
                  : item.isToday
                  ? 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 border border-slate-800/80'
              }`}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider">
                {item.isToday ? 'TODAY' : item.dayName}
              </span>
              <span className="text-sm sm:text-base font-extrabold font-mono mt-0.5">{item.dayNum}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Copy / Paste Bar */}
      <QuickCopyPasteBar
        currentEntry={currentEntry}
        gwsSessions={gwsSessions}
        onApplyParsedPlan={handleApplyParsedPlan}
      />

      {/* Week Focus Quick Bridge (One-Click Pull into Day) */}
      {activeWeeklyPlan && activeWeeklyPlan.tasks.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center space-x-1.5">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span>Week {activeWeeklyPlan.weekNumber} Goals:</span>
              <span className="text-slate-500 font-normal">Click any goal to pull into today's mission</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1">
            {activeWeeklyPlan.tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => handleApplyParsedPlan(task.text)}
                className={`text-xs px-2.5 py-1.5 rounded-xl border transition-all flex items-center space-x-1.5 ${
                  task.completed
                    ? 'bg-slate-950/60 border-slate-800 text-slate-500 line-through'
                    : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 hover:border-amber-500/40 text-slate-200'
                }`}
                title="Click to add to today's priorities"
              >
                <span>{task.text}</span>
                <span className="text-[10px] text-amber-400 font-mono">+{task.score}p</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DYNAMIC TEMPLATE-DRIVEN CARDS GRID */}
      {dailyTemplate && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                Active Template:
              </span>
              <span className="text-xs font-extrabold text-slate-200 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                {dailyTemplate.name} ({dailyTemplate.fields.length} modular blocks)
              </span>
            </div>

            <button
              onClick={onCustomizeTemplate}
              className="text-[11px] font-semibold text-slate-400 hover:text-amber-400 transition-colors flex items-center space-x-1"
            >
              <span>Edit this layout</span>
              <span>→</span>
            </button>
          </div>

          <ModularCardGrid
            template={dailyTemplate}
            values={dynamicValues}
            onChange={handleFieldChange}
            onAction={handleAction}
          />
        </div>
      )}

    </div>
  );
};
