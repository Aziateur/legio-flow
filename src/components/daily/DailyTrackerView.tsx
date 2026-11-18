import React, { useState } from 'react';
import { useStorage, getCurrentWeekRange, getWeekNumberForDate } from '../../context/StorageContext';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  CheckCircle2,
  Circle,
  Sliders, 
  Clock,
  Sparkles,
  Target,
  ArrowRight,
  Plus,
  ArrowDownToLine
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
    dailyEntries,
    gwsSessions,
    weeklyPlans,
    selectedWeekId,
    saveWeeklyPlan,
    setPlanningSubTab,
    systemLevel,
    templates
  } = useStorage();

  const [quickWeekGoalInput, setQuickWeekGoalInput] = useState('');

  // Resolve the exact calendar week for selectedDate so Daily & Weekly are always synchronized
  const currentWeekRange = getCurrentWeekRange(selectedDate);
  const currentWeekNum = getWeekNumberForDate(selectedDate);
  const activeWeeklyPlan =
    Object.values(weeklyPlans).find(
      p => p.startDate <= selectedDate && selectedDate <= p.endDate
    ) ||
    weeklyPlans[selectedWeekId] || {
      id: `week_${currentWeekNum}`,
      weekNumber: currentWeekNum,
      startDate: currentWeekRange.startDate,
      endDate: currentWeekRange.endDate,
      focusTheme: '',
      notes: '',
      tasks: [],
      totalPossibleScore: 10,
      achievedScore: 0,
      rewards: [],
      updatedAt: new Date().toISOString()
    };

  const currentEntry = getEntryForDate(selectedDate);
  // Find active template for daily category
  const dailyTemplate = templates.find(t => t.id === currentEntry.templateId) || 
                        templates.find(t => t.category === 'daily') || 
                        templates[0];

  const todaySessions = gwsSessions.filter(s => s.date === selectedDate);

  // 7-Day Ribbon always aligned to the Monday–Sunday of the active week
  const getDatesRibbon = () => {
    return currentWeekRange.days.map((dateStr) => {
      const d = new Date(`${dateStr}T12:00:00`);
      const dayEntry = dailyEntries[dateStr];
      const hasPlan = !!(dayEntry && dayEntry.planNotes && dayEntry.planNotes.trim().length > 0);
      const completedTasks = dayEntry?.mainTasksCompleted || 0;
      return {
        dateStr,
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isCurrent: dateStr === selectedDate,
        isToday: dateStr === todayDate,
        hasPlan,
        completedTasks
      };
    });
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

  const handleAction = (actionName: string, payload?: any) => {
    if (actionName === 'open_gws') {
      onOpenGWS();
    } else if (actionName === 'sync_daily_priorities' && payload) {
      // 1. Sync Main Tasks Completed & Total automatically from the Daily Mission checklist
      saveDailyEntry(selectedDate, {
        mainTasksCompleted: payload.completedCount,
        mainTasksTotal: payload.totalCount
      });

      // 2. Two-way sync: if the toggled daily priority matches a Weekly Goal OR Sub-Goal in the active week, sync its completion!
      if (payload.toggledText && activeWeeklyPlan && activeWeeklyPlan.tasks.length > 0) {
        const normalizedToggled = payload.toggledText.toLowerCase().trim();
        let matched = false;
        const updatedTasks = activeWeeklyPlan.tasks.map(t => {
          let nextTask = t;
          if (t.text.toLowerCase().trim() === normalizedToggled) {
            matched = true;
            nextTask = { ...nextTask, completed: !!payload.isCompleted };
          }
          if (t.subTasks && t.subTasks.length > 0) {
            const updatedSubs = t.subTasks.map(sub => {
              if (sub.text.toLowerCase().trim() === normalizedToggled) {
                matched = true;
                return { ...sub, completed: !!payload.isCompleted };
              }
              return sub;
            });
            nextTask = { ...nextTask, subTasks: updatedSubs };
          }
          return nextTask;
        });

        if (matched) {
          const nextScore = updatedTasks
            .filter(t => t.completed)
            .reduce((acc, t) => acc + (t.score || 0), 0);
          saveWeeklyPlan({
            ...activeWeeklyPlan,
            tasks: updatedTasks,
            achievedScore: nextScore
          });
        }
      }
    }
  };

  // Helper to check if a weekly goal is already in today's planNotes
  const isGoalInTodayPlan = (goalText: string): boolean => {
    if (!currentEntry.planNotes) return false;
    return currentEntry.planNotes.toLowerCase().includes(goalText.toLowerCase().trim());
  };

  // Pull a weekly goal into the next available numbered priority slot for selectedDate
  const handlePullGoalToDay = (goalText: string, isCompleted = false) => {
    const cleanGoal = goalText.trim();
    if (!cleanGoal || isGoalInTodayPlan(cleanGoal)) return;

    const rawLines = (currentEntry.planNotes || '')
      .split('\n')
      .map(l => l.replace(/^[0-9]+[\.\)\s]+/, '').trim())
      .filter(Boolean);

    const newEntryLine = `${isCompleted ? '[x] ' : ''}${cleanGoal}`;
    const updatedLines = [...rawLines, newEntryLine];

    const formatted = updatedLines
      .map((line, idx) => `${idx + 1} ${line}`)
      .join('\n');

    const completedCount = updatedLines.filter(l => l.startsWith('[x] ') || l.startsWith('[X] ')).length;
    const totalCount = Math.max(3, updatedLines.length);

    saveDailyEntry(selectedDate, {
      planNotes: formatted,
      mainTasksCompleted: completedCount,
      mainTasksTotal: totalCount
    });
  };

  // Toggle a weekly goal directly from the Daily view and sync with today's planNotes if present
  const handleToggleWeeklyGoalDirect = (taskId: string) => {
    const targetTask = activeWeeklyPlan.tasks.find(t => t.id === taskId);
    if (!targetTask) return;
    const nextCompleted = !targetTask.completed;

    const updatedTasks = activeWeeklyPlan.tasks.map(t =>
      t.id === taskId ? { ...t, completed: nextCompleted } : t
    );
    const nextScore = updatedTasks
      .filter(t => t.completed)
      .reduce((acc, t) => acc + (t.score || 0), 0);

    saveWeeklyPlan({
      ...activeWeeklyPlan,
      tasks: updatedTasks,
      achievedScore: nextScore
    });

    // If this goal is also in today's planNotes, update its [x] state there too
    if (currentEntry.planNotes && isGoalInTodayPlan(targetTask.text)) {
      const lines = currentEntry.planNotes.split('\n');
      const updatedLines = lines.map(line => {
        const stripped = line.replace(/^[0-9]+[\.\)\s]+/, '').replace(/^\[[xX\s]\]\s*/, '').trim();
        if (stripped.toLowerCase() === targetTask.text.toLowerCase().trim()) {
          return `${nextCompleted ? '[x] ' : ''}${stripped}`;
        }
        return line.replace(/^[0-9]+[\.\)\s]+/, '').trim();
      }).filter(Boolean);

      const formatted = updatedLines.map((l, idx) => `${idx + 1} ${l}`).join('\n');
      const completedCount = updatedLines.filter(l => l.startsWith('[x] ') || l.startsWith('[X] ')).length;
      saveDailyEntry(selectedDate, {
        planNotes: formatted,
        mainTasksCompleted: completedCount,
        mainTasksTotal: Math.max(3, updatedLines.length)
      });
    }
  };

  const handleToggleSubGoalDirect = (goalId: string, subId: string) => {
    const parent = activeWeeklyPlan.tasks.find(t => t.id === goalId);
    const targetSub = parent?.subTasks?.find(s => s.id === subId);
    if (!targetSub) return;
    const nextCompleted = !targetSub.completed;

    const updatedTasks = activeWeeklyPlan.tasks.map(t =>
      t.id === goalId
        ? {
            ...t,
            subTasks: (t.subTasks || []).map(s =>
              s.id === subId ? { ...s, completed: nextCompleted } : s
            )
          }
        : t
    );
    saveWeeklyPlan({ ...activeWeeklyPlan, tasks: updatedTasks });

    if (currentEntry.planNotes && isGoalInTodayPlan(targetSub.text)) {
      const lines = currentEntry.planNotes.split('\n');
      const updatedLines = lines.map(line => {
        const stripped = line.replace(/^[0-9]+[\.\)\s]+/, '').replace(/^\[[xX\s]\]\s*/, '').trim();
        if (stripped.toLowerCase() === targetSub.text.toLowerCase().trim()) {
          return `${nextCompleted ? '[x] ' : ''}${stripped}`;
        }
        return line.replace(/^[0-9]+[\.\)\s]+/, '').trim();
      }).filter(Boolean);

      const formatted = updatedLines.map((l, idx) => `${idx + 1} ${l}`).join('\n');
      const completedCount = updatedLines.filter(l => l.startsWith('[x] ') || l.startsWith('[X] ')).length;
      saveDailyEntry(selectedDate, {
        planNotes: formatted,
        mainTasksCompleted: completedCount,
        mainTasksTotal: Math.max(3, updatedLines.length)
      });
    }
  };

  // Quick-add a weekly goal directly from the Daily view
  const handleQuickAddWeeklyGoal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && quickWeekGoalInput.trim()) {
      e.preventDefault();
      const newTask = {
        id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text: quickWeekGoalInput.trim(),
        score: 2,
        completed: false
      };
      saveWeeklyPlan({
        ...activeWeeklyPlan,
        tasks: [...activeWeeklyPlan.tasks, newTask]
      });
      setQuickWeekGoalInput('');
    }
  };

  const handleApplyParsedPlan = (tasksText: string) => {
    handlePullGoalToDay(tasksText);
  };

  const isSelectedToday = selectedDate === todayDate;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-5">
      
      {/* Compact Top Date & Monday–Sunday Week Strip */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          
          {/* Date Selector with previous/today/next */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={goToPreviousDay}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800">
              <CalendarIcon className="w-4 h-4 text-amber-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-100 font-bold font-mono text-xs sm:text-sm focus:outline-none cursor-pointer"
              />
              {isSelectedToday && (
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Today
                </span>
              )}
            </div>

            <button
              onClick={goToNextDay}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {!isSelectedToday && (
              <button
                onClick={goToToday}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 transition-all"
              >
                Jump to Today
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <span className="hidden md:inline text-[11px] font-mono font-bold text-amber-400">
              Week {activeWeeklyPlan.weekNumber} ({activeWeeklyPlan.startDate.slice(5)} → {activeWeeklyPlan.endDate.slice(5)})
            </span>
            <button
              onClick={onCustomizeTemplate}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
              title="Change cards, order, size and shape"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Customize Cards</span>
            </button>
          </div>
        </div>

        {/* Slim 7-Day Monday–Sunday Strip */}
        <div className="flex items-center justify-between gap-1 sm:gap-1.5 overflow-x-auto">
          {getDatesRibbon().map((item) => (
            <button
              key={item.dateStr}
              onClick={() => setSelectedDate(item.dateStr)}
              className={`flex-1 min-w-[52px] py-1.5 px-1 rounded-xl flex items-center justify-center space-x-1.5 transition-all ${
                item.isCurrent
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm ring-1 ring-amber-400'
                  : item.isToday
                  ? 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-950/60 hover:bg-slate-800 text-slate-400 border border-slate-800/80'
              }`}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider">
                {item.isToday ? 'TODAY' : item.dayName}
              </span>
              <span className="text-xs font-extrabold font-mono">{item.dayNum}</span>
              {item.hasPlan && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    item.isCurrent ? 'bg-slate-950' : item.completedTasks > 0 ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 1. FIRST THING YOU SEE: DAY MISSION & PRIORITIES + DAILY CARDS */}
      {dailyTemplate && (
        <ModularCardGrid
          template={dailyTemplate}
          values={dynamicValues}
          onChange={handleFieldChange}
          onAction={handleAction}
        />
      )}

      {/* 2. Synchronized Week Goals Bridge (Two-Way Sync with Weekly Plan) */}
      {systemLevel >= 3 && activeWeeklyPlan && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="font-extrabold text-slate-100 flex items-center space-x-1.5">
                <Target className="w-4 h-4 text-amber-400" />
                <span>
                  Week {activeWeeklyPlan.weekNumber} Goals ({activeWeeklyPlan.startDate.slice(5)} → {activeWeeklyPlan.endDate.slice(5)})
                </span>
              </span>
              {activeWeeklyPlan.focusTheme && (
                <span className="text-amber-400 font-semibold">
                  • "{activeWeeklyPlan.focusTheme}"
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono font-bold text-[11px]">
                {activeWeeklyPlan.achievedScore} / 10 pts
              </span>
            </div>

            <button
              type="button"
              onClick={() => setPlanningSubTab('weekly')}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center space-x-1 self-start sm:self-auto"
            >
              <span>Open Week {activeWeeklyPlan.weekNumber} Plan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeWeeklyPlan.tasks.length > 0 ? (
            <div className="space-y-2.5 pt-1">
              {activeWeeklyPlan.tasks.map((task) => {
                const inToday = isGoalInTodayPlan(task.text);
                const subTasks = task.subTasks || [];
                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl border p-2.5 space-y-2 transition-all ${
                      task.completed
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : inToday
                        ? 'bg-amber-500/10 border-amber-500/40 text-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center space-x-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleWeeklyGoalDirect(task.id)}
                          title={task.completed ? 'Mark weekly goal incomplete' : 'Mark weekly goal completed'}
                          className="shrink-0"
                        >
                          {task.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-500 hover:text-amber-400" />
                          )}
                        </button>

                        <span className={`font-medium truncate ${task.completed ? 'line-through text-slate-400' : ''}`}>
                          {task.text}
                        </span>

                        <span className="text-[10px] text-amber-400 font-mono font-bold shrink-0">
                          +{task.score}p
                        </span>
                      </div>

                      {inToday ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                          ✓ In Day
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePullGoalToDay(task.text, task.completed)}
                          className="text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 px-2 py-0.5 rounded border border-amber-500/30 flex items-center space-x-0.5 transition-colors shrink-0"
                          title={`Pull into ${selectedDate}'s priorities`}
                        >
                          <ArrowDownToLine className="w-2.5 h-2.5" />
                          <span>Pull Goal</span>
                        </button>
                      )}
                    </div>

                    {/* Sub-goals pills under this weekly goal */}
                    {subTasks.length > 0 && (
                      <div className="pl-6 flex items-center gap-1.5 flex-wrap">
                        {subTasks.map((sub) => {
                          const subInToday = isGoalInTodayPlan(sub.text);
                          return (
                            <div
                              key={sub.id}
                              className={`text-[11px] px-2.5 py-1 rounded-xl border flex items-center space-x-1.5 ${
                                sub.completed
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                  : subInToday
                                  ? 'bg-amber-500/10 border-amber-500/40 text-slate-100'
                                  : 'bg-slate-900 border-slate-800 text-slate-300'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleSubGoalDirect(task.id, sub.id)}
                                className="shrink-0"
                              >
                                {sub.completed ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Circle className="w-3.5 h-3.5 text-slate-500 hover:text-amber-400" />
                                )}
                              </button>
                              <span className={sub.completed ? 'line-through text-slate-400' : ''}>
                                {sub.text}
                              </span>
                              {subInToday ? (
                                <span className="text-[9px] font-bold text-emerald-400">✓ In Day</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handlePullGoalToDay(sub.text, sub.completed)}
                                  className="text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded flex items-center space-x-0.5"
                                >
                                  <ArrowDownToLine className="w-2.5 h-2.5" />
                                  <span>Pull</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              No weekly deliverables set for Week {activeWeeklyPlan.weekNumber} ({activeWeeklyPlan.startDate.slice(5)} → {activeWeeklyPlan.endDate.slice(5)}) yet. Add one below or open the Weekly Plan:
            </p>
          )}

          {/* Quick Inline Weekly Goal Adder right inside Daily View */}
          <div className="flex items-center space-x-2 pt-1">
            <Plus className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="text"
              value={quickWeekGoalInput}
              onChange={(e) => setQuickWeekGoalInput(e.target.value)}
              onKeyDown={handleQuickAddWeeklyGoal}
              placeholder={`Quick-add a goal for Week ${activeWeeklyPlan.weekNumber} and press Enter...`}
              className="w-full bg-slate-950/70 border border-slate-800/80 focus:border-amber-500/50 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* 3. Quick Copy / Paste Bar (Discord / Notion export) */}
      <QuickCopyPasteBar
        currentEntry={currentEntry}
        gwsSessions={gwsSessions}
        onApplyParsedPlan={handleApplyParsedPlan}
      />

    </div>
  );
};
