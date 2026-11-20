import React, { useState } from 'react';
import {
  useStorage,
  findBestWeeklyPlanForDate,
  getWeekRangeForWeekNumber,
  computeWeeklyAchievedScore
} from '../../context/StorageContext';
import { DailyTrackerView } from '../daily/DailyTrackerView';
import { WeeklyGoalCrusherView } from '../weekly/WeeklyGoalCrusherView';
import { SpreadsheetMatrixView } from '../matrix/SpreadsheetMatrixView';
import { StrategyRoadmapsView } from './StrategyRoadmapsView';
import { WeeklyPlan, TaskItem } from '../../types/schema';
import {
  Calendar,
  Target,
  Compass,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowDownToLine,
  Layers,
  X,
  FilePlus,
  Bell,
  Table,
  BookOpen
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const formatMonthLabel = (monthKey: string): string => {
  const [yStr, mStr] = monthKey.split('-');
  const year = parseInt(yStr, 10) || 2026;
  const month = Math.min(12, Math.max(1, parseInt(mStr, 10) || 1));
  return `${MONTH_NAMES[month - 1]} ${year}`;
};

const shiftMonthKey = (monthKey: string, delta: number): string => {
  const [yStr, mStr] = monthKey.split('-');
  const year = parseInt(yStr, 10) || 2026;
  const month = Math.min(12, Math.max(1, parseInt(mStr, 10) || 1));
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const shiftYearKey = (yearKey: string, delta: number): string => {
  const year = parseInt(yearKey, 10) || 2026;
  return String(year + delta);
};

export const PlanningHub: React.FC<{ onOpenGWS: () => void; onCustomizeTemplate: () => void }> = ({
  onOpenGWS,
  onCustomizeTemplate
}) => {
  const {
    planningSubTab,
    setPlanningSubTab,
    weeklyPlans,
    saveWeeklyPlan,
    monthlyPlans,
    getMonthlyPlan,
    saveMonthlyPlan,
    yearlyPlans,
    getYearlyPlan,
    saveYearlyPlan,
    saveDailyEntry,
    selectedWeekId,
    setSelectedWeekId,
    todayDate,
    selectedDate,
    setSelectedDate,
    systemLevel,
    missingPlanAlerts
  } = useStorage();

  const [dismissedAlerts, setDismissedAlerts] = useState(false);

  // Create Plan Modal state
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [createPlanType, setCreatePlanType] = useState<'weekly' | 'daily' | 'monthly' | 'yearly'>('weekly');

  const existingWeekNums = Object.values(weeklyPlans).map(p => p.weekNumber);
  const maxWeekNum = existingWeekNums.length > 0 ? Math.max(...existingWeekNums) : 1;
  const nextDefaultWeekNum = maxWeekNum + 1;
  const defaultWeekRange = getWeekRangeForWeekNumber(nextDefaultWeekNum);

  const [newWeekNum, setNewWeekNum] = useState<number>(nextDefaultWeekNum);
  const [newWeekFocus, setNewWeekFocus] = useState<string>('');
  const [newWeekStart, setNewWeekStart] = useState<string>(defaultWeekRange.startDate);
  const [newWeekEnd, setNewWeekEnd] = useState<string>(defaultWeekRange.endDate);

  const [newPlanDate, setNewPlanDate] = useState<string>(selectedDate);
  const [newPlanNotes, setNewPlanNotes] = useState<string>('');

  const [modalMonthKey, setModalMonthKey] = useState<string>(selectedDate.slice(0, 7));
  const [modalMonthFocus, setModalMonthFocus] = useState<string>('');
  const [modalYearKey, setModalYearKey] = useState<string>(selectedDate.slice(0, 4));
  const [modalYearFocus, setModalYearFocus] = useState<string>('');

  // Active Monthly & Yearly selection + quick-add inputs
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => selectedDate.slice(0, 7));
  const [selectedYearKey, setSelectedYearKey] = useState<string>(() => selectedDate.slice(0, 4));
  const [newMonthlyGoalInput, setNewMonthlyGoalInput] = useState('');
  const [newYearlyGoalInput, setNewYearlyGoalInput] = useState('');

  const activeWeeklyPlan =
    findBestWeeklyPlanForDate(selectedDate, weeklyPlans, selectedWeekId) ||
    weeklyPlans[selectedWeekId] ||
    Object.values(weeklyPlans)[0];

  const activeMonthPlan = getMonthlyPlan(selectedMonthKey);
  const activeYearPlan = getYearlyPlan(selectedYearKey);

  // Pull helpers (ID-linked first so completion cascades upward across Daily -> Weekly -> Monthly -> Yearly)
  const isGoalInWeeklyPlan = (
    text: string,
    links?: { monthlyTaskId?: string; yearlyTaskId?: string }
  ): boolean => {
    if (!activeWeeklyPlan) return false;
    if (links?.monthlyTaskId && activeWeeklyPlan.tasks.some(t => t.monthlyTaskId === links.monthlyTaskId)) {
      return true;
    }
    if (links?.yearlyTaskId && activeWeeklyPlan.tasks.some(t => t.yearlyTaskId === links.yearlyTaskId)) {
      return true;
    }
    const norm = text.toLowerCase().trim();
    return !!norm && activeWeeklyPlan.tasks.some(t => t.text.toLowerCase().trim() === norm);
  };

  const isGoalInMonthlyPlan = (text: string, yearlyTaskId?: string): boolean => {
    if (yearlyTaskId && activeMonthPlan.tasks.some(t => t.yearlyTaskId === yearlyTaskId)) {
      return true;
    }
    const norm = text.toLowerCase().trim();
    return !!norm && activeMonthPlan.tasks.some(t => t.text.toLowerCase().trim() === norm);
  };

  const handlePullGoalToActiveWeek = (
    text: string,
    links?: { monthlyTaskId?: string; yearlyTaskId?: string }
  ) => {
    if (!activeWeeklyPlan) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isGoalInWeeklyPlan(trimmed, links)) {
      // Backfill ID linkage if matched by text only
      const norm = trimmed.toLowerCase();
      let backfilled = false;
      const upgradedTasks = activeWeeklyPlan.tasks.map(t => {
        const matches =
          (links?.monthlyTaskId && t.monthlyTaskId === links.monthlyTaskId) ||
          (links?.yearlyTaskId && t.yearlyTaskId === links.yearlyTaskId) ||
          t.text.toLowerCase().trim() === norm;
        if (!matches) return t;
        const nextMonthlyId = t.monthlyTaskId || links?.monthlyTaskId;
        const nextYearlyId = t.yearlyTaskId || links?.yearlyTaskId;
        if (nextMonthlyId !== t.monthlyTaskId || nextYearlyId !== t.yearlyTaskId) {
          backfilled = true;
          return {
            ...t,
            ...(nextMonthlyId ? { monthlyTaskId: nextMonthlyId } : {}),
            ...(nextYearlyId ? { yearlyTaskId: nextYearlyId } : {})
          };
        }
        return t;
      });
      if (backfilled) {
        saveWeeklyPlan({
          ...activeWeeklyPlan,
          tasks: upgradedTasks,
          achievedScore: computeWeeklyAchievedScore(upgradedTasks)
        });
      }
      setSelectedWeekId(activeWeeklyPlan.id);
      setPlanningSubTab('weekly');
      return;
    }
    const nextTasks: TaskItem[] = [
      ...activeWeeklyPlan.tasks,
      {
        id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text: trimmed,
        score: 2,
        completed: false,
        ...(links?.monthlyTaskId ? { monthlyTaskId: links.monthlyTaskId } : {}),
        ...(links?.yearlyTaskId ? { yearlyTaskId: links.yearlyTaskId } : {})
      }
    ];
    saveWeeklyPlan({
      ...activeWeeklyPlan,
      tasks: nextTasks,
      achievedScore: computeWeeklyAchievedScore(nextTasks)
    });
  };

  const handlePullGoalToActiveMonth = (text: string, yearlyTaskId?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isGoalInMonthlyPlan(trimmed, yearlyTaskId)) {
      if (yearlyTaskId) {
        const norm = trimmed.toLowerCase();
        let backfilled = false;
        const upgradedTasks = activeMonthPlan.tasks.map(t => {
          if (
            !t.yearlyTaskId &&
            t.text.toLowerCase().trim() === norm
          ) {
            backfilled = true;
            return { ...t, yearlyTaskId };
          }
          return t;
        });
        if (backfilled) {
          saveMonthlyPlan({
            ...activeMonthPlan,
            tasks: upgradedTasks
          });
        }
      }
      setPlanningSubTab('monthly');
      return;
    }
    const nextTasks: TaskItem[] = [
      ...activeMonthPlan.tasks,
      {
        id: `mgoal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text: trimmed,
        completed: false,
        ...(yearlyTaskId ? { yearlyTaskId } : {})
      }
    ];
    saveMonthlyPlan({
      ...activeMonthPlan,
      tasks: nextTasks
    });
  };

  // Monthly Plan handlers
  const handleAddMonthlyGoal = () => {
    const trimmed = newMonthlyGoalInput.trim();
    if (!trimmed) return;
    const nextTask: TaskItem = {
      id: `mgoal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: trimmed,
      completed: false
    };
    saveMonthlyPlan({
      ...activeMonthPlan,
      tasks: [...activeMonthPlan.tasks, nextTask]
    });
    setNewMonthlyGoalInput('');
  };

  const handleToggleMonthlyGoal = (id: string) => {
    saveMonthlyPlan({
      ...activeMonthPlan,
      tasks: activeMonthPlan.tasks.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
    });
  };

  const handleEditMonthlyGoal = (id: string, text: string) => {
    saveMonthlyPlan({
      ...activeMonthPlan,
      tasks: activeMonthPlan.tasks.map(t => (t.id === id ? { ...t, text } : t))
    });
  };

  const handleDeleteMonthlyGoal = (id: string) => {
    saveMonthlyPlan({
      ...activeMonthPlan,
      tasks: activeMonthPlan.tasks.filter(t => t.id !== id)
    });
  };

  // Yearly Plan handlers
  const handleAddYearlyGoal = () => {
    const trimmed = newYearlyGoalInput.trim();
    if (!trimmed) return;
    const nextTask: TaskItem = {
      id: `ygoal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: trimmed,
      completed: false
    };
    saveYearlyPlan({
      ...activeYearPlan,
      tasks: [...activeYearPlan.tasks, nextTask]
    });
    setNewYearlyGoalInput('');
  };

  const handleToggleYearlyGoal = (id: string) => {
    saveYearlyPlan({
      ...activeYearPlan,
      tasks: activeYearPlan.tasks.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
    });
  };

  const handleEditYearlyGoal = (id: string, text: string) => {
    saveYearlyPlan({
      ...activeYearPlan,
      tasks: activeYearPlan.tasks.map(t => (t.id === id ? { ...t, text } : t))
    });
  };

  const handleDeleteYearlyGoal = (id: string) => {
    saveYearlyPlan({
      ...activeYearPlan,
      tasks: activeYearPlan.tasks.filter(t => t.id !== id)
    });
  };

  // Known month & year chips
  const knownMonthKeys = Array.from(
    new Set([
      shiftMonthKey(selectedMonthKey, -1),
      todayDate.slice(0, 7),
      selectedDate.slice(0, 7),
      selectedMonthKey,
      shiftMonthKey(selectedMonthKey, 1),
      ...Object.keys(monthlyPlans)
    ])
  ).sort();

  const knownYearKeys = Array.from(
    new Set([
      '2026',
      '2027',
      '2028',
      todayDate.slice(0, 4),
      selectedDate.slice(0, 4),
      selectedYearKey,
      ...Object.keys(yearlyPlans)
    ])
  ).sort();

  // Open Create Plan modal with synced week number + range
  const openCreatePlanModal = () => {
    const nums = Object.values(weeklyPlans).map(p => p.weekNumber);
    const nextNum = (nums.length > 0 ? Math.max(...nums) : 1) + 1;
    const nextRange = getWeekRangeForWeekNumber(nextNum);
    setNewWeekNum(nextNum);
    setNewWeekStart(nextRange.startDate);
    setNewWeekEnd(nextRange.endDate);
    setNewPlanDate(selectedDate);
    setModalMonthKey(selectedMonthKey);
    setModalYearKey(selectedYearKey);
    setCreatePlanType(
      planningSubTab === 'weekly'
        ? 'weekly'
        : planningSubTab === 'monthly'
        ? 'monthly'
        : planningSubTab === 'yearly'
        ? 'yearly'
        : 'daily'
    );
    setShowCreatePlanModal(true);
  };

  // Submit handlers in Create Plan modal
  const handleCreateWeeklyPlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const safeWeekNum = Math.max(1, newWeekNum || 1);
    const weekId = `week_${safeWeekNum}`;

    const newPlan: WeeklyPlan = {
      id: weekId,
      weekNumber: safeWeekNum,
      startDate: newWeekStart,
      endDate: newWeekEnd,
      focusTheme: newWeekFocus.trim(),
      notes: '',
      tasks: [],
      totalPossibleScore: 10,
      achievedScore: 0,
      rewards: [],
      updatedAt: new Date().toISOString()
    };

    saveWeeklyPlan(newPlan);
    setSelectedWeekId(weekId);
    setPlanningSubTab('weekly');
    setShowCreatePlanModal(false);
    setNewWeekFocus('');
  };

  const handleCreateDailyPlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlanNotes.trim()) {
      saveDailyEntry(newPlanDate, { planNotes: newPlanNotes.trim() });
    }
    setSelectedDate(newPlanDate);
    setPlanningSubTab('daily');
    setShowCreatePlanModal(false);
    setNewPlanNotes('');
  };

  const handleCreateMonthlyPlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const key = modalMonthKey || todayDate.slice(0, 7);
    const existing = getMonthlyPlan(key);
    saveMonthlyPlan({
      ...existing,
      ...(modalMonthFocus.trim() ? { focusTheme: modalMonthFocus.trim() } : {})
    });
    setSelectedMonthKey(key);
    setPlanningSubTab('monthly');
    setShowCreatePlanModal(false);
    setModalMonthFocus('');
  };

  const handleCreateYearlyPlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const key = String(parseInt(modalYearKey, 10) || parseInt(todayDate.slice(0, 4), 10) || 2026);
    const existing = getYearlyPlan(key);
    saveYearlyPlan({
      ...existing,
      ...(modalYearFocus.trim() ? { focusTheme: modalYearFocus.trim() } : {})
    });
    setSelectedYearKey(key);
    setPlanningSubTab('yearly');
    setShowCreatePlanModal(false);
    setModalYearFocus('');
  };

  const monthlyDoneCount = activeMonthPlan.tasks.filter(t => t.completed).length;
  const yearlyDoneCount = activeYearPlan.tasks.filter(t => t.completed).length;

  return (
    <div className="space-y-6">

      {/* Top Unified Planning Window Switcher Bar (Cleanly separated: Time-Scale Plans vs. Strategy & Matrix) */}
      <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-2.5 sm:px-3.5 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl">

          <div className="flex items-center space-x-2.5 px-1.5 shrink-0">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                Planning Hub
              </div>
              <div className="text-sm font-extrabold text-slate-100 whitespace-nowrap">
                {planningSubTab === 'daily' && 'Daily Plan'}
                {planningSubTab === 'weekly' && 'Weekly Goal Crusher'}
                {planningSubTab === 'monthly' && `Monthly Plan (${formatMonthLabel(selectedMonthKey)})`}
                {planningSubTab === 'yearly' && `Yearly Plan (${selectedYearKey})`}
                {planningSubTab === 'roadmaps' && 'Written Roadmaps'}
                {planningSubTab === 'matrix' && 'Weeks Matrix'}
              </div>
            </div>
          </div>

          {/* Static Wrapping Controls: Group 1 (Periodic Plans) + Group 2 (Roadmaps & Matrix) + Action */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">

            {/* Group 1: Time-Scale Plans */}
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-slate-950 border border-slate-800/80">
              <button
                type="button"
                onClick={() => setPlanningSubTab('daily')}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  planningSubTab === 'daily'
                    ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Daily</span>
              </button>

              {systemLevel >= 3 && (
                <button
                  type="button"
                  onClick={() => setPlanningSubTab('weekly')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    planningSubTab === 'weekly'
                      ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Weekly</span>
                </button>
              )}

              {systemLevel >= 4 && (
                <button
                  type="button"
                  onClick={() => setPlanningSubTab('monthly')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    planningSubTab === 'monthly'
                      ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Monthly</span>
                </button>
              )}

              {systemLevel >= 5 && (
                <button
                  type="button"
                  onClick={() => setPlanningSubTab('yearly')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    planningSubTab === 'yearly'
                      ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Yearly</span>
                </button>
              )}
            </div>

            {/* Group 2: Strategy Roadmaps & Matrix */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-950 border border-slate-800/80">
              <button
                type="button"
                onClick={() => setPlanningSubTab('roadmaps')}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  planningSubTab === 'roadmaps'
                    ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Roadmaps</span>
              </button>

              {systemLevel >= 3 && (
                <button
                  type="button"
                  onClick={() => setPlanningSubTab('matrix')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    planningSubTab === 'matrix'
                      ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Weeks Matrix</span>
                </button>
              )}
            </div>

            {/* Compact New Plan button */}
            <button
              type="button"
              onClick={openCreatePlanModal}
              className="flex items-center space-x-1 px-3 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Plan</span>
            </button>

          </div>

        </div>
      </div>

      {/* Missing Plan Notification Banner (Day / Week Plan Reminder) */}
      {!dismissedAlerts && missingPlanAlerts.length > 0 && (
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                  {missingPlanAlerts.map(a => a.title).join(' • ')}
                </div>
                <div className="text-xs text-slate-300">
                  {missingPlanAlerts.map(a => a.message).join(' ')}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
              {missingPlanAlerts.map(alert => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => {
                    setSelectedDate(todayDate);
                    setPlanningSubTab(alert.targetSubTab);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
                >
                  {alert.actionLabel}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDismissedAlerts(true)}
                className="p-1.5 text-slate-400 hover:text-slate-200"
                title="Dismiss reminder"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: DAILY PLANNING */}
      {planningSubTab === 'daily' && (
        <DailyTrackerView
          onOpenGWS={onOpenGWS}
          onCustomizeTemplate={onCustomizeTemplate}
        />
      )}

      {/* VIEW 2: WEEKLY PLANNING */}
      {planningSubTab === 'weekly' && (
        <WeeklyGoalCrusherView />
      )}

      {/* VIEW 3: MONTHLY PLANNING */}
      {planningSubTab === 'monthly' && (
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6">

          {/* Month Selector & Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setSelectedMonthKey(shiftMonthKey(selectedMonthKey, -1))}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-400 block">
                  Monthly Execution Plan
                </span>
                <div className="text-lg font-extrabold text-slate-100">
                  {formatMonthLabel(selectedMonthKey)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMonthKey(shiftMonthKey(selectedMonthKey, 1))}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
              {knownMonthKeys.map((mKey) => {
                const isSelected = mKey === selectedMonthKey;
                const mPlan = monthlyPlans[mKey];
                const hasContent = !!(mPlan && (mPlan.tasks.length > 0 || mPlan.focusTheme.trim()));
                return (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => setSelectedMonthKey(mKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all shrink-0 ${
                      isSelected
                        ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/20'
                        : hasContent
                        ? 'bg-slate-950 text-slate-200 border border-slate-700 hover:border-purple-500/40'
                        : 'bg-slate-950/60 text-slate-500 border border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    {mKey}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Monthly Plan Sheet */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-1">
                  Monthly Singular Outcome • {formatMonthLabel(selectedMonthKey)}
                </span>
                <input
                  type="text"
                  value={activeMonthPlan.focusTheme}
                  onChange={(e) => saveMonthlyPlan({ ...activeMonthPlan, focusTheme: e.target.value })}
                  placeholder="What is the #1 outcome that makes this month a victory?"
                  className="w-full bg-transparent text-xl sm:text-2xl font-extrabold text-amber-400 placeholder-slate-700 focus:outline-none"
                />
              </div>

              <span className="self-start sm:self-center px-3 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs font-mono font-bold shrink-0">
                {monthlyDoneCount} / {activeMonthPlan.tasks.length} goals
              </span>
            </div>

            {/* Monthly Deliverables Checklist */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>Monthly Goals & Deliverables ({activeMonthPlan.tasks.length})</span>
                {activeWeeklyPlan && (
                  <span className="text-[11px] font-mono text-slate-500">
                    Pull directly into Week {activeWeeklyPlan.weekNumber}
                  </span>
                )}
              </div>

              {activeMonthPlan.tasks.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-xs text-slate-500 text-center">
                  No monthly deliverables set yet for {formatMonthLabel(selectedMonthKey)}. Add your first one below.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeMonthPlan.tasks.map((task) => {
                    const inWeek = isGoalInWeeklyPlan(task.text, {
                      monthlyTaskId: task.id,
                      yearlyTaskId: task.yearlyTaskId
                    });
                    return (
                      <div
                        key={task.id}
                        className={`group flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                          task.completed
                            ? 'bg-emerald-500/5 border-emerald-500/25'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleMonthlyGoal(task.id)}
                            className="shrink-0 transition-transform active:scale-90"
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-600 hover:text-purple-400" />
                            )}
                          </button>

                          <input
                            type="text"
                            value={task.text}
                            onChange={(e) => handleEditMonthlyGoal(task.id, e.target.value)}
                            className={`w-full bg-transparent text-xs sm:text-sm font-medium focus:outline-none ${
                              task.completed ? 'line-through text-slate-500' : 'text-slate-100'
                            }`}
                          />
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {activeWeeklyPlan && (
                            <button
                              type="button"
                              onClick={() =>
                                handlePullGoalToActiveWeek(task.text, {
                                  monthlyTaskId: task.id,
                                  yearlyTaskId: task.yearlyTaskId
                                })
                              }
                              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                                inWeek
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                                  : 'bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-800'
                              }`}
                              title={
                                inWeek
                                  ? `Already in Week ${activeWeeklyPlan.weekNumber} — click to open Weekly Plan`
                                  : `Pull goal into Week ${activeWeeklyPlan.weekNumber}`
                              }
                            >
                              {!inWeek && <ArrowDownToLine className="w-3 h-3" />}
                              <span>
                                {inWeek ? `✓ In Week ${activeWeeklyPlan.weekNumber}` : `+ Pull to Week ${activeWeeklyPlan.weekNumber}`}
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteMonthlyGoal(task.id)}
                            className="p-1 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete goal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick Add Monthly Goal */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddMonthlyGoal();
                }}
                className="flex items-center space-x-2 p-3 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 focus-within:border-purple-500/50 transition-colors"
              >
                <Plus className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="text"
                  value={newMonthlyGoalInput}
                  onChange={(e) => setNewMonthlyGoalInput(e.target.value)}
                  placeholder="Type a monthly goal and press Enter..."
                  className="flex-1 bg-transparent text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newMonthlyGoalInput.trim()}
                  className="px-3 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-40 text-purple-300 border border-purple-500/30 text-xs font-bold"
                >
                  + Add
                </button>
              </form>
            </div>

            {/* Monthly Strategy & Notes */}
            <div className="space-y-1.5 pt-3 border-t border-slate-800/80">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Monthly Strategy, Focus Rules & Notes
              </label>
              <textarea
                rows={4}
                value={activeMonthPlan.notes}
                onChange={(e) => saveMonthlyPlan({ ...activeMonthPlan, notes: e.target.value })}
                placeholder="Key systems, bottlenecks to eliminate, budgets, or weekly milestones for this month..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500/50 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed resize-y"
              />
            </div>
          </div>

        </div>
      )}

      {/* VIEW 4: YEARLY PLANNING */}
      {planningSubTab === 'yearly' && (
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6">

          {/* Year Selector & Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setSelectedYearKey(shiftYearKey(selectedYearKey, -1))}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Previous Year"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 block">
                  Annual Execution Plan
                </span>
                <div className="text-lg font-extrabold text-slate-100">
                  {selectedYearKey} Yearly Plan
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedYearKey(shiftYearKey(selectedYearKey, 1))}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Next Year"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
              {knownYearKeys.map((yKey) => {
                const isSelected = yKey === selectedYearKey;
                const yPlan = yearlyPlans[yKey];
                const hasContent = !!(yPlan && (yPlan.tasks.length > 0 || yPlan.focusTheme.trim()));
                return (
                  <button
                    key={yKey}
                    type="button"
                    onClick={() => setSelectedYearKey(yKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all shrink-0 ${
                      isSelected
                        ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                        : hasContent
                        ? 'bg-slate-950 text-slate-200 border border-slate-700 hover:border-rose-500/40'
                        : 'bg-slate-950/60 text-slate-500 border border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    {yKey}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Yearly Plan Sheet */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-1">
                  Yearly Core Focus & Thesis • {selectedYearKey}
                </span>
                <input
                  type="text"
                  value={activeYearPlan.focusTheme}
                  onChange={(e) => saveYearlyPlan({ ...activeYearPlan, focusTheme: e.target.value })}
                  placeholder={`What is your defining objective for ${selectedYearKey}?`}
                  className="w-full bg-transparent text-xl sm:text-2xl font-extrabold text-amber-400 placeholder-slate-700 focus:outline-none"
                />
              </div>

              <span className="self-start sm:self-center px-3 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-mono font-bold shrink-0">
                {yearlyDoneCount} / {activeYearPlan.tasks.length} goals
              </span>
            </div>

            {/* Yearly Objectives Checklist */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-400">
                <span>Yearly Objectives ({activeYearPlan.tasks.length})</span>
                <span className="text-[11px] font-mono text-slate-500">
                  Pull down to {selectedMonthKey} or {activeWeeklyPlan ? `Week ${activeWeeklyPlan.weekNumber}` : 'Active Week'}
                </span>
              </div>

              {activeYearPlan.tasks.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-xs text-slate-500 text-center">
                  No yearly goals set yet for {selectedYearKey}. Add your first objective below.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeYearPlan.tasks.map((task) => {
                    const inMonth = isGoalInMonthlyPlan(task.text, task.id);
                    const inWeek = isGoalInWeeklyPlan(task.text, { yearlyTaskId: task.id });
                    return (
                      <div
                        key={task.id}
                        className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl border transition-all ${
                          task.completed
                            ? 'bg-emerald-500/5 border-emerald-500/25'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleYearlyGoal(task.id)}
                            className="shrink-0 transition-transform active:scale-90"
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-600 hover:text-rose-400" />
                            )}
                          </button>

                          <input
                            type="text"
                            value={task.text}
                            onChange={(e) => handleEditYearlyGoal(task.id, e.target.value)}
                            className={`w-full bg-transparent text-xs sm:text-sm font-medium focus:outline-none ${
                              task.completed ? 'line-through text-slate-500' : 'text-slate-100'
                            }`}
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handlePullGoalToActiveMonth(task.text, task.id)}
                            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                              inMonth
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/35 hover:bg-purple-500/30'
                                : 'bg-slate-900 hover:bg-slate-800 text-purple-300 border-slate-800'
                            }`}
                            title={
                              inMonth
                                ? `Already in ${selectedMonthKey} — click to open Monthly Plan`
                                : `Pull into ${selectedMonthKey} Monthly Plan`
                            }
                          >
                            {!inMonth && <ArrowDownToLine className="w-3 h-3" />}
                            <span>{inMonth ? `✓ In ${selectedMonthKey}` : `+ Month (${selectedMonthKey.slice(5)})`}</span>
                          </button>

                          {activeWeeklyPlan && (
                            <button
                              type="button"
                              onClick={() => handlePullGoalToActiveWeek(task.text, { yearlyTaskId: task.id })}
                              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                                inWeek
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                                  : 'bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-800'
                              }`}
                              title={
                                inWeek
                                  ? `Already in Week ${activeWeeklyPlan.weekNumber} — click to open Weekly Plan`
                                  : `Pull into Week ${activeWeeklyPlan.weekNumber}`
                              }
                            >
                              {!inWeek && <ArrowDownToLine className="w-3 h-3" />}
                              <span>{inWeek ? `✓ In Week ${activeWeeklyPlan.weekNumber}` : `+ Week ${activeWeeklyPlan.weekNumber}`}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteYearlyGoal(task.id)}
                            className="p-1 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete goal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick Add Yearly Goal */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddYearlyGoal();
                }}
                className="flex items-center space-x-2 p-3 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 focus-within:border-rose-500/50 transition-colors"
              >
                <Plus className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="text"
                  value={newYearlyGoalInput}
                  onChange={(e) => setNewYearlyGoalInput(e.target.value)}
                  placeholder={`Type a ${selectedYearKey} goal and press Enter...`}
                  className="flex-1 bg-transparent text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newYearlyGoalInput.trim()}
                  className="px-3 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 text-rose-300 border border-rose-500/30 text-xs font-bold"
                >
                  + Add
                </button>
              </form>
            </div>

            {/* Yearly Strategy & Rules */}
            <div className="space-y-1.5 pt-3 border-t border-slate-800/80">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Yearly Strategy, Boundaries & Operating Thesis
              </label>
              <textarea
                rows={5}
                value={activeYearPlan.notes}
                onChange={(e) => saveYearlyPlan({ ...activeYearPlan, notes: e.target.value })}
                placeholder={`Document key pillars, operating boundaries, and strategic shifts for ${selectedYearKey}...`}
                className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500/50 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed resize-y"
              />
            </div>
          </div>

        </div>
      )}

      {/* VIEW 5: WRITTEN STRATEGY ROADMAPS (STAGE-GATE PLANS) */}
      {planningSubTab === 'roadmaps' && <StrategyRoadmapsView />}

      {/* VIEW 6: WEEKS MATRIX */}
      {planningSubTab === 'matrix' && (
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <SpreadsheetMatrixView />
        </div>
      )}

      {/* CREATE PLAN MODAL (Weekly, Daily, Monthly & Yearly) */}
      {showCreatePlanModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl space-y-6 relative my-4 sm:my-8">

            <button
              type="button"
              onClick={() => setShowCreatePlanModal(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-slate-950 text-slate-400 hover:text-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                <FilePlus className="w-4 h-4" />
                <span>Create New Plan</span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-100 mt-1">
                Where would you like to plan?
              </h2>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setCreatePlanType('daily')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                  createPlanType === 'daily'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setCreatePlanType('weekly')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                  createPlanType === 'weekly'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => setCreatePlanType('monthly')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                  createPlanType === 'monthly'
                    ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setCreatePlanType('yearly')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                  createPlanType === 'yearly'
                    ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Yearly
              </button>
            </div>

            {/* Weekly Plan Creation Form */}
            {createPlanType === 'weekly' && (
              <form onSubmit={handleCreateWeeklyPlanSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Week #</label>
                    <input
                      type="number"
                      min={1}
                      value={newWeekNum}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                        const range = getWeekRangeForWeekNumber(val);
                        setNewWeekNum(val);
                        setNewWeekStart(range.startDate);
                        setNewWeekEnd(range.endDate);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold font-mono text-amber-400 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Start Date</label>
                    <input
                      type="date"
                      value={newWeekStart}
                      onChange={(e) => setNewWeekStart(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">End Date</label>
                    <input
                      type="date"
                      value={newWeekEnd}
                      onChange={(e) => setNewWeekEnd(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Weekly Focus Headline (Optional)</label>
                  <input
                    type="text"
                    value={newWeekFocus}
                    onChange={(e) => setNewWeekFocus(e.target.value)}
                    placeholder="e.g. Discord cohort onboarding & Miro trading checkpoints"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-sm text-slate-100 focus:outline-none"
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  Creates a clean blank Week {newWeekNum} sheet ({newWeekStart} → {newWeekEnd}) where you can add your own goals and custom rewards.
                </p>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20"
                >
                  Create Week {newWeekNum} Plan & Open
                </button>
              </form>
            )}

            {/* Daily Plan Creation Form */}
            {createPlanType === 'daily' && (
              <form onSubmit={handleCreateDailyPlanSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Target Date</label>
                  <input
                    type="date"
                    value={newPlanDate}
                    onChange={(e) => setNewPlanDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-mono text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Daily Priorities / Plan (Optional)</label>
                  <textarea
                    value={newPlanNotes}
                    onChange={(e) => setNewPlanNotes(e.target.value)}
                    placeholder="1 finish discord onboarding&#10;2 boot camp&#10;3 assess situation..."
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20"
                >
                  Open Plan for {newPlanDate}
                </button>
              </form>
            )}

            {/* Monthly Plan Creation Form */}
            {createPlanType === 'monthly' && (
              <form onSubmit={handleCreateMonthlyPlanSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Month</label>
                  <input
                    type="month"
                    value={modalMonthKey}
                    onChange={(e) => setModalMonthKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-mono text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Monthly Focus Outcome (Optional)</label>
                  <input
                    type="text"
                    value={modalMonthFocus}
                    onChange={(e) => setModalMonthFocus(e.target.value)}
                    placeholder="e.g. Reach 10 active cohort clients & lock daily discipline"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500/50 rounded-xl p-3 text-sm text-slate-100 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-purple-500/20"
                >
                  Open {formatMonthLabel(modalMonthKey)} Monthly Plan
                </button>
              </form>
            )}

            {/* Yearly Plan Creation Form */}
            {createPlanType === 'yearly' && (
              <form onSubmit={handleCreateYearlyPlanSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Target Year</label>
                  <input
                    type="number"
                    min={2020}
                    max={2100}
                    value={modalYearKey}
                    onChange={(e) => setModalYearKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-mono text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Yearly Core Thesis (Optional)</label>
                  <input
                    type="text"
                    value={modalYearFocus}
                    onChange={(e) => setModalYearFocus(e.target.value)}
                    placeholder="e.g. Profitable funded trading & full Legio automation"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500/50 rounded-xl p-3 text-sm text-slate-100 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-rose-500/20"
                >
                  Open {modalYearKey} Yearly Plan
                </button>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
