import React, { useState } from 'react';
import {
  useStorage,
  getCurrentWeekRange,
  getWeekNumberForDate,
  findBestWeeklyPlanForDate,
  getPriorityItemsForEntry,
  formatPriorityItemsToPlanNotes,
  computeWeeklyAchievedScore
} from '../../context/StorageContext';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Sliders,
  Target,
  ArrowRight,
  Plus,
  ArrowDownToLine,
  ListChecks
} from 'lucide-react';
import { ChecklistItem } from '../../types/schema';
import {
  getChecklistDueStatus,
  getChecklistScheduleLabel,
  isChecklistItemDoneForPeriod
} from '../../lib/checklistSchedule';
import { ModularCardGrid } from '../modular/ModularCardGrid';
import { QuickCopyPasteBar } from '../common/QuickCopyPasteBar';
import { DailyContextBrief } from './DailyContextBrief';

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
    checklistItems,
    setActiveTab,
    setPlanningSubTab,
    systemLevel,
    templates,
    isAdmin
  } = useStorage();

  const [quickWeekGoalInput, setQuickWeekGoalInput] = useState('');
  const [showChecklistPuller, setShowChecklistPuller] = useState(false);

  // Resolve the exact calendar week for selectedDate so Daily & Weekly are always synchronized
  const currentWeekRange = getCurrentWeekRange(selectedDate);
  const currentWeekNum = getWeekNumberForDate(selectedDate, weeklyPlans['week_1']?.startDate);
  const activeWeeklyPlan =
    findBestWeeklyPlanForDate(selectedDate, weeklyPlans, selectedWeekId) ||
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
        return currentEntry.priorityItems && currentEntry.priorityItems.length > 0
          ? currentEntry.priorityItems
          : currentEntry.planNotes;
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
      const priorityItems = Array.isArray(payload.priorityItems) ? payload.priorityItems : [];
      const planNotes =
        typeof payload.formattedPlanNotes === 'string'
          ? payload.formattedPlanNotes
          : formatPriorityItemsToPlanNotes(priorityItems);
      saveDailyEntry(selectedDate, {
        planNotes,
        priorityItems,
        mainTasksCompleted: payload.completedCount,
        mainTasksTotal: payload.totalCount
      });
    }
  };

  // Helper to check if a weekly goal/sub-goal is already in today's priorities (by ID first, then exact normalized text)
  const isGoalInTodayPlan = (goalText: string, weeklyTaskId?: string, subTaskId?: string): boolean => {
    const items = getPriorityItemsForEntry(currentEntry);
    if (subTaskId && items.some(p => p.subTaskId === subTaskId)) return true;
    if (weeklyTaskId && !subTaskId && items.some(p => p.weeklyTaskId === weeklyTaskId && !p.subTaskId)) return true;
    const norm = goalText.toLowerCase().trim();
    if (!norm) return false;
    return items.some(p => p.text.toLowerCase().trim() === norm);
  };

  // Pull a weekly goal, sub-goal, or checklist item into the next available numbered priority slot with persistent ID linkage
  const handlePullGoalToDay = (
    goalText: string,
    isCompleted = false,
    weeklyTaskId?: string,
    subTaskId?: string,
    checklistItemId?: string
  ) => {
    const cleanGoal = goalText.trim();
    if (!cleanGoal) return;
    const existingItems = getPriorityItemsForEntry(currentEntry);
    if (
      (checklistItemId && existingItems.some(p => p.checklistItemId === checklistItemId)) ||
      isGoalInTodayPlan(cleanGoal, weeklyTaskId, subTaskId)
    ) {
      return;
    }

    const newItem = {
      id: `prio_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: cleanGoal,
      completed: isCompleted,
      ...(weeklyTaskId ? { weeklyTaskId } : {}),
      ...(subTaskId ? { subTaskId } : {}),
      ...(checklistItemId ? { checklistItemId } : {})
    };
    const updatedItems = [...existingItems, newItem];
    const formatted = formatPriorityItemsToPlanNotes(updatedItems);
    const completedCount = updatedItems.filter(i => i.completed).length;
    const totalCount = Math.max(3, updatedItems.length);

    saveDailyEntry(selectedDate, {
      planNotes: formatted,
      priorityItems: updatedItems,
      mainTasksCompleted: completedCount,
      mainTasksTotal: totalCount
    });
  };

  // Checklist pull helpers (Weekly, Monthly & One-Off + scheduled Due Today / Overdue auto-strip)
  const isChecklistItemInTodayPlan = (item: ChecklistItem): boolean => {
    const existingItems = getPriorityItemsForEntry(currentEntry);
    const norm = item.text.trim().toLowerCase();
    return existingItems.some(
      p => p.checklistItemId === item.id || (!!norm && p.text.trim().toLowerCase() === norm)
    );
  };

  const pullableChecklistItems = checklistItems.filter(
    item => item.recurrence === 'weekly' || item.recurrence === 'monthly' || item.recurrence === 'none'
  );

  const scheduledDueForDay = pullableChecklistItems.filter(item => {
    if (item.recurrence !== 'weekly' && item.recurrence !== 'monthly') return false;
    if (isChecklistItemInTodayPlan(item)) return false;
    const status = getChecklistDueStatus(item, selectedDate, activeWeeklyPlan.id);
    return status === 'due_today' || status === 'overdue';
  });

  const handlePullAllScheduledDue = () => {
    if (scheduledDueForDay.length === 0) return;
    const existingItems = getPriorityItemsForEntry(currentEntry);
    const additions = scheduledDueForDay
      .filter(item => !isChecklistItemInTodayPlan(item))
      .map(item => ({
        id: `prio_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text: item.text.trim(),
        completed: false,
        checklistItemId: item.id
      }));
    if (additions.length === 0) return;
    const updatedItems = [...existingItems, ...additions];
    saveDailyEntry(selectedDate, {
      planNotes: formatPriorityItemsToPlanNotes(updatedItems),
      priorityItems: updatedItems,
      mainTasksCompleted: updatedItems.filter(i => i.completed).length,
      mainTasksTotal: Math.max(3, updatedItems.length)
    });
  };

  const selectedDayShortName = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short'
  });

  // Toggle a weekly goal directly from the Daily view and sync with today's priorities
  const handleToggleWeeklyGoalDirect = (taskId: string) => {
    const targetTask = activeWeeklyPlan.tasks.find(t => t.id === taskId);
    if (!targetTask) return;
    const nextCompleted = !targetTask.completed;

    const updatedTasks = activeWeeklyPlan.tasks.map(t =>
      t.id === taskId ? { ...t, completed: nextCompleted } : t
    );
    const nextScore = computeWeeklyAchievedScore(updatedTasks);

    saveWeeklyPlan({
      ...activeWeeklyPlan,
      tasks: updatedTasks,
      achievedScore: nextScore
    });

    if (isGoalInTodayPlan(targetTask.text, taskId)) {
      const items = getPriorityItemsForEntry(currentEntry).map(item => {
        if (
          (item.weeklyTaskId === taskId && !item.subTaskId) ||
          item.text.toLowerCase().trim() === targetTask.text.toLowerCase().trim()
        ) {
          return { ...item, completed: nextCompleted };
        }
        return item;
      });
      saveDailyEntry(selectedDate, {
        planNotes: formatPriorityItemsToPlanNotes(items),
        priorityItems: items,
        mainTasksCompleted: items.filter(i => i.completed).length,
        mainTasksTotal: Math.max(3, items.length)
      });
    }
  };

  const handleToggleSubGoalDirect = (goalId: string, subId: string) => {
    const parent = activeWeeklyPlan.tasks.find(t => t.id === goalId);
    const targetSub = parent?.subTasks?.find(s => s.id === subId);
    if (!targetSub) return;
    const nextCompleted = !targetSub.completed;

    const updatedTasks = activeWeeklyPlan.tasks.map(t => {
      if (t.id !== goalId) return t;
      const updatedSubs = (t.subTasks || []).map(s =>
        s.id === subId ? { ...s, completed: nextCompleted } : s
      );
      const allSubsDone = updatedSubs.length > 0 && updatedSubs.every(s => s.completed);
      return {
        ...t,
        subTasks: updatedSubs,
        completed: allSubsDone
      };
    });
    const nextScore = computeWeeklyAchievedScore(updatedTasks);
    saveWeeklyPlan({
      ...activeWeeklyPlan,
      tasks: updatedTasks,
      achievedScore: nextScore
    });

    if (isGoalInTodayPlan(targetSub.text, goalId, subId)) {
      const items = getPriorityItemsForEntry(currentEntry).map(item => {
        if (
          item.subTaskId === subId ||
          item.text.toLowerCase().trim() === targetSub.text.toLowerCase().trim()
        ) {
          return { ...item, completed: nextCompleted };
        }
        return item;
      });
      saveDailyEntry(selectedDate, {
        planNotes: formatPriorityItemsToPlanNotes(items),
        priorityItems: items,
        mainTasksCompleted: items.filter(i => i.completed).length,
        mainTasksTotal: Math.max(3, items.length)
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
    const existingItems = getPriorityItemsForEntry(currentEntry);
    const seenTexts = new Set(existingItems.map(i => i.text.trim().toLowerCase()));
    const additions = tasksText
      .split('\n')
      .map(line => line.replace(/^[0-9]+[\.\)\s]+/, '').trim())
      .map(line => {
        let completed = false;
        let text = line;
        if (text.startsWith('[x] ') || text.startsWith('[X] ')) {
          completed = true;
          text = text.slice(4).trim();
        } else if (text.startsWith('[ ] ')) {
          text = text.slice(4).trim();
        }
        return { text, completed };
      })
      .filter(item => item.text.length > 0 && !seenTexts.has(item.text.toLowerCase()))
      .map((item, idx) => {
        seenTexts.add(item.text.toLowerCase());
        return {
          id: `prio_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          text: item.text,
          completed: item.completed
        };
      });

    if (additions.length === 0) return;
    const updatedItems = [...existingItems, ...additions];
    saveDailyEntry(selectedDate, {
      planNotes: formatPriorityItemsToPlanNotes(updatedItems),
      priorityItems: updatedItems,
      mainTasksCompleted: updatedItems.filter(i => i.completed).length,
      mainTasksTotal: Math.max(3, updatedItems.length)
    });
  };

  const isSelectedToday = selectedDate === todayDate;

  // Find the most recent Course Correction note from previous days + most recent GWS next-sprint commitment
  const latestPreviousReview = Object.values(dailyEntries)
    .filter(e => e.date < selectedDate && e.reviewNotes && e.reviewNotes.trim().length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const latestGwsCommitment = gwsSessions
    .filter(s => s.reflexions?.improveNext && s.reflexions.improveNext.trim().length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  // Find the most recent previous day before selectedDate that has unfinished priorities
  const prevDayWithUnfinished = Object.values(dailyEntries)
    .filter(e => e.date < selectedDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .find(e => getPriorityItemsForEntry(e).some(p => !p.completed));

  const unfinishedFromPrevDay = prevDayWithUnfinished
    ? getPriorityItemsForEntry(prevDayWithUnfinished).filter(
        p => !p.completed && !isGoalInTodayPlan(p.text, p.weeklyTaskId, p.subTaskId)
      )
    : [];

  const handleCarryAllPrevUnfinished = () => {
    if (unfinishedFromPrevDay.length === 0) return;
    const existingItems = getPriorityItemsForEntry(currentEntry);
    const additions = unfinishedFromPrevDay.map(p => ({
      id: `prio_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: p.text.trim(),
      completed: false,
      weeklyTaskId: p.weeklyTaskId,
      subTaskId: p.subTaskId
    }));
    const updatedItems = [...existingItems, ...additions];
    saveDailyEntry(selectedDate, {
      planNotes: formatPriorityItemsToPlanNotes(updatedItems),
      priorityItems: updatedItems,
      mainTasksCompleted: updatedItems.filter(i => i.completed).length,
      mainTasksTotal: Math.max(3, updatedItems.length)
    });
  };

  return (
    <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-5">
      
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
            {isAdmin && (
              <button
                onClick={onCustomizeTemplate}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
                title="Change cards, order, size and shape (Admin Only)"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Customize Cards</span>
              </button>
            )}
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

      {/* Unified Today's Context Brief (Macro Compass + Guardrails + Course Correction + Carry-Forward + Scheduled Due) */}
      <DailyContextBrief
        selectedDate={selectedDate}
        selectedDayShortName={selectedDayShortName}
        activeWeeklyPlanId={activeWeeklyPlan.id}
        latestPreviousReview={latestPreviousReview}
        latestGwsCommitment={latestGwsCommitment}
        unfinishedFromPrevDay={unfinishedFromPrevDay}
        prevDayWithUnfinished={prevDayWithUnfinished}
        scheduledDueForDay={scheduledDueForDay}
        onPullGoalToDay={handlePullGoalToDay}
        onCarryAllPrevUnfinished={handleCarryAllPrevUnfinished}
        onPullAllScheduledDue={handlePullAllScheduledDue}
      />

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
                {computeWeeklyAchievedScore(activeWeeklyPlan.tasks)} / 10 pts
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
                const inToday = isGoalInTodayPlan(task.text, task.id);
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
                          onClick={() => handlePullGoalToDay(task.text, task.completed, task.id)}
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
                          const subInToday = isGoalInTodayPlan(sub.text, task.id, sub.id);
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
                                  onClick={() => handlePullGoalToDay(sub.text, sub.completed, task.id, sub.id)}
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

      {/* 2.5 Pull from Checklist (Weekly, Monthly & One-Off Tasks) */}
      {pullableChecklistItems.length > 0 && (
        <div className="bg-slate-900/75 border border-slate-800 rounded-3xl overflow-hidden shadow-lg">
          <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-xs">
              <ListChecks className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-extrabold text-slate-200">
                Checklist Tasks (Weekly · Monthly · One-Off)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 font-mono text-[10px] font-bold text-slate-400">
                {
                  pullableChecklistItems.filter(
                    i => !isChecklistItemDoneForPeriod(i, selectedDate, activeWeeklyPlan.id)
                  ).length
                }{' '}
                open
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('checklist')}
                className="text-[11px] font-bold text-slate-400 hover:text-amber-300 transition-colors"
              >
                Open Checklist →
              </button>
              <button
                type="button"
                onClick={() => setShowChecklistPuller(prev => !prev)}
                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-colors ${
                  showChecklistPuller
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-950 hover:bg-slate-800 text-amber-300 border-amber-500/30'
                }`}
              >
                <ArrowDownToLine className="w-3 h-3" />
                <span>{showChecklistPuller ? 'Hide' : 'Pull to Day'}</span>
                {showChecklistPuller ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          {showChecklistPuller && (
            <div className="px-4 sm:px-5 pb-4 pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3">
              {(
                [
                  { rec: 'weekly', label: 'Weekly Recurring', accent: 'text-amber-400' },
                  { rec: 'monthly', label: 'Monthly Recurring', accent: 'text-purple-400' },
                  { rec: 'none', label: 'One-Off Tasks', accent: 'text-slate-300' }
                ] as const
              ).map(group => {
                const groupItems = pullableChecklistItems.filter(i => i.recurrence === group.rec);
                return (
                  <div
                    key={group.rec}
                    className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3 space-y-2"
                  >
                    <div className={`text-[10px] font-extrabold uppercase tracking-wider ${group.accent}`}>
                      {group.label} ({groupItems.length})
                    </div>
                    {groupItems.length === 0 ? (
                      <p className="text-[11px] text-slate-600 italic">None yet</p>
                    ) : (
                      <div className="space-y-1.5">
                        {groupItems.map(item => {
                          const done = isChecklistItemDoneForPeriod(item, selectedDate, activeWeeklyPlan.id);
                          const inDay = isChecklistItemInTodayPlan(item);
                          const schedLabel = getChecklistScheduleLabel(item);
                          const dueStatus =
                            item.recurrence === 'weekly' || item.recurrence === 'monthly'
                              ? getChecklistDueStatus(item, selectedDate, activeWeeklyPlan.id)
                              : 'anytime';

                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <span
                                  className={`block truncate ${
                                    done ? 'line-through text-slate-500' : 'text-slate-200'
                                  }`}
                                >
                                  {item.text}
                                </span>
                                {schedLabel && (
                                  <span
                                    className={`text-[9px] font-mono font-bold ${
                                      dueStatus === 'due_today'
                                        ? 'text-amber-400'
                                        : dueStatus === 'overdue'
                                        ? 'text-rose-400'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {schedLabel}
                                    {dueStatus === 'due_today'
                                      ? ' · Due Today'
                                      : dueStatus === 'overdue'
                                      ? ' · Overdue'
                                      : ''}
                                  </span>
                                )}
                              </div>
                              {inDay ? (
                                <span className="text-[10px] font-bold text-emerald-400 shrink-0">
                                  ✓ In Day
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handlePullGoalToDay(item.text, done, undefined, undefined, item.id)
                                  }
                                  className="inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold shrink-0"
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
          )}
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
