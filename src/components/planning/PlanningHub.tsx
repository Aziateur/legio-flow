import React, { Suspense, lazy, useState } from 'react';
import {
  useStorage,
  findBestWeeklyPlanForDate,
  getWeekRangeForWeekNumber,
  computeWeeklyAchievedScore
} from '../../context/StorageContext';
import { DailyTrackerView } from '../daily/DailyTrackerView';
import { ScoreboardEditor } from '../common/ScoreboardEditor';
import { TopFocusesEditor } from '../common/TopFocusesEditor';

const WeeklyGoalCrusherView = lazy(() =>
  import('../weekly/WeeklyGoalCrusherView').then(m => ({ default: m.WeeklyGoalCrusherView }))
);
const SpreadsheetMatrixView = lazy(() =>
  import('../matrix/SpreadsheetMatrixView').then(m => ({ default: m.SpreadsheetMatrixView }))
);
const StrategyRoadmapsView = lazy(() =>
  import('./StrategyRoadmapsView').then(m => ({ default: m.StrategyRoadmapsView }))
);
const QuarterlyPlanSection = lazy(() =>
  import('./QuarterlyPlanSection').then(m => ({ default: m.QuarterlyPlanSection }))
);

const SubViewFallback: React.FC = () => (
  <div className="max-w-3xl mx-auto px-6 py-16 flex flex-col items-center justify-center space-y-2.5 text-slate-500">
    <div className="w-6 h-6 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
    <span className="text-[11px] font-mono uppercase tracking-wider">Loading view...</span>
  </div>
);
import {
  HierarchyOutcomeCard,
  ParentLinkOption
} from './HierarchyOutcomeCard';
import { getMonthInfo, getQuarterKeyForDate, getQuarterInfo } from '../../lib/macroAnalytics';
import {
  getCommittedGatesForQuarter,
  getQuarterlyChildrenOfYearlyTask,
  getQuartersForYear,
  getWeeklyChildrenOfMonthlyTask,
  getWeeksForMonth
} from '../../lib/planHierarchy';
import { WeeklyPlan, TaskItem } from '../../types/schema';
import {
  Calendar,
  Target,
  Compass,
  Award,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Layers,
  X,
  FilePlus,
  Bell,
  Table,
  BookOpen,
  Gauge
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
    quarterlyPlans,
    getQuarterlyPlan,
    saveQuarterlyPlan,
    yearlyPlans,
    getYearlyPlan,
    saveYearlyPlan,
    strategyPlans,
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
  const [createPlanType, setCreatePlanType] = useState<'weekly' | 'daily' | 'monthly' | 'quarterly' | 'yearly'>('weekly');

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
  const [modalQuarterKey, setModalQuarterKey] = useState<string>(() => getQuarterKeyForDate(selectedDate));
  const [modalQuarterFocus, setModalQuarterFocus] = useState<string>('');
  const [modalYearKey, setModalYearKey] = useState<string>(selectedDate.slice(0, 4));
  const [modalYearFocus, setModalYearFocus] = useState<string>('');

  // Active Monthly, Quarterly & Yearly selection + quick-add inputs
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => selectedDate.slice(0, 7));
  const [selectedQuarterKey, setSelectedQuarterKey] = useState<string>(() => getQuarterKeyForDate(selectedDate));
  const [selectedYearKey, setSelectedYearKey] = useState<string>(() => selectedDate.slice(0, 4));
  const [newMonthlyGoalInput, setNewMonthlyGoalInput] = useState('');
  const [newMonthlyGoalKpi, setNewMonthlyGoalKpi] = useState('');
  const [newMonthlyGoalParent, setNewMonthlyGoalParent] = useState('');
  const [showParentQuarterInMonth, setShowParentQuarterInMonth] = useState(true);
  const [showMonthlyScoreboard, setShowMonthlyScoreboard] = useState(false);
  const [newYearlyGoalInput, setNewYearlyGoalInput] = useState('');
  const [newYearlyGoalKpi, setNewYearlyGoalKpi] = useState('');
  const [hierarchyNotice, setHierarchyNotice] = useState<string | null>(null);

  const activeWeeklyPlan =
    findBestWeeklyPlanForDate(selectedDate, weeklyPlans, selectedWeekId) ||
    weeklyPlans[selectedWeekId] ||
    Object.values(weeklyPlans)[0];

  const activeMonthPlan = getMonthlyPlan(selectedMonthKey);
  const activeYearPlan = getYearlyPlan(selectedYearKey);

  // Live parent Quarter for selected Monthly Plan
  const monthInfo = getMonthInfo(selectedMonthKey);
  const parentQuarterPlanForMonth = getQuarterlyPlan(monthInfo.quarterKey);
  const committedGatesForMonthQuarter = getCommittedGatesForQuarter(
    parentQuarterPlanForMonth,
    strategyPlans
  );
  const monthChildWeeks = getWeeksForMonth(selectedMonthKey, weeklyPlans);
  const monthChildWeekOptions = monthChildWeeks.map(w => ({
    key: w.id,
    label: `Week ${w.weekNumber} (${w.startDate.slice(5)} → ${w.endDate.slice(5)})`
  }));
  const defaultChildWeekForMonth =
    monthChildWeeks.find(w => w.id === activeWeeklyPlan?.id)?.id ||
    monthChildWeeks[0]?.id ||
    activeWeeklyPlan?.id ||
    '';

  const monthlyParentOptions: ParentLinkOption[] = [
    ...parentQuarterPlanForMonth.tasks
      .filter(t => t.status !== 'parked')
      .map(qt => ({
        value: `quarterly:${qt.id}`,
        label: qt.text,
        group: `${monthInfo.quarterKey} Quarterly Outcomes`
      })),
    ...committedGatesForMonthQuarter.map(cg => ({
      value: `gate:${cg.plan.id}|${cg.stage.id}`,
      label: `${cg.plan.title} · Stage ${cg.stageIndex}`,
      group: `${monthInfo.quarterKey} Target Roadmap Gates`
    }))
  ];

  const encodeMonthlyParent = (t: TaskItem): string => {
    if (t.quarterlyTaskId) return `quarterly:${t.quarterlyTaskId}`;
    if (t.strategyPlanId && t.strategyStageId) return `gate:${t.strategyPlanId}|${t.strategyStageId}`;
    return '';
  };

  const decodeMonthlyParentPatch = (encoded: string): Partial<TaskItem> => {
    if (!encoded) {
      return {
        quarterlyTaskId: undefined,
        strategyPlanId: undefined,
        strategyStageId: undefined,
        sourceLabel: undefined
      };
    }
    if (encoded.startsWith('quarterly:')) {
      const qId = encoded.slice(10);
      const qt = parentQuarterPlanForMonth.tasks.find(x => x.id === qId);
      return {
        quarterlyTaskId: qId,
        yearlyTaskId: qt?.yearlyTaskId,
        strategyPlanId: qt?.strategyPlanId,
        strategyStageId: qt?.strategyStageId,
        parentLinkMode: 'step'
      };
    }
    if (encoded.startsWith('gate:')) {
      const [planId, stageId] = encoded.slice(5).split('|');
      const sp = strategyPlans.find(p => p.id === planId);
      return {
        quarterlyTaskId: undefined,
        strategyPlanId: planId,
        strategyStageId: stageId,
        sourceLabel: sp ? sp.title : undefined,
        parentLinkMode: 'step'
      };
    }
    return {};
  };

  // Monthly Plan handlers
  const handleAddMonthlyGoal = () => {
    const trimmed = newMonthlyGoalInput.trim();
    if (!trimmed) return;
    const parentPatch = decodeMonthlyParentPatch(newMonthlyGoalParent);
    const nextTask: TaskItem = {
      id: `mgoal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: trimmed,
      completed: false,
      ...(newMonthlyGoalKpi.trim() ? { kpiTarget: newMonthlyGoalKpi.trim() } : {}),
      ...parentPatch
    };
    saveMonthlyPlan({
      ...activeMonthPlan,
      tasks: [...activeMonthPlan.tasks, nextTask]
    });
    setNewMonthlyGoalInput('');
    setNewMonthlyGoalKpi('');
    setNewMonthlyGoalParent('');
  };

  const handleUpdateMonthlyGoal = (id: string, patch: Partial<TaskItem>) => {
    saveMonthlyPlan({
      ...activeMonthPlan,
      tasks: activeMonthPlan.tasks.map(t => (t.id === id ? { ...t, ...patch } : t))
    });
  };

  const handleDeleteMonthlyGoal = (id: string) => {
    saveMonthlyPlan({
      ...activeMonthPlan,
      tasks: activeMonthPlan.tasks.filter(t => t.id !== id)
    });
  };

  const handleSpawnWeeklyStepFromMonth = (
    parentTask: TaskItem,
    weekId: string,
    text: string,
    kpiTarget?: string
  ) => {
    const targetWeek = weeklyPlans[weekId];
    if (!targetWeek) return;
    const nextTasks: TaskItem[] = [
      ...targetWeek.tasks,
      {
        id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text,
        score: 2,
        completed: false,
        parentLinkMode: 'step',
        monthlyTaskId: parentTask.id,
        ...(parentTask.quarterlyTaskId ? { quarterlyTaskId: parentTask.quarterlyTaskId } : {}),
        ...(parentTask.yearlyTaskId ? { yearlyTaskId: parentTask.yearlyTaskId } : {}),
        ...(parentTask.strategyPlanId ? { strategyPlanId: parentTask.strategyPlanId } : {}),
        ...(parentTask.strategyStageId ? { strategyStageId: parentTask.strategyStageId } : {}),
        sourceLabel: `${monthInfo.label.split(' ')[0]} · ${parentTask.text.slice(0, 28)}`,
        ...(kpiTarget ? { kpiTarget } : {})
      }
    ];
    saveWeeklyPlan({
      ...targetWeek,
      tasks: nextTasks,
      achievedScore: computeWeeklyAchievedScore(nextTasks)
    });
    setHierarchyNotice(`Added step to Week ${targetWeek.weekNumber}`);
    setTimeout(() => setHierarchyNotice(null), 2400);
  };

  // Yearly Plan handlers
  const yearChildQuarters = getQuartersForYear(selectedYearKey);
  const yearChildQuarterOptions = yearChildQuarters.map(qk => ({
    key: qk,
    label: getQuarterInfo(qk).label
  }));
  const defaultChildQuarterForYear = yearChildQuarters.includes(selectedQuarterKey)
    ? selectedQuarterKey
    : yearChildQuarters[0];

  const handleAddYearlyGoal = () => {
    const trimmed = newYearlyGoalInput.trim();
    if (!trimmed) return;
    const nextTask: TaskItem = {
      id: `ygoal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: trimmed,
      completed: false,
      ...(newYearlyGoalKpi.trim() ? { kpiTarget: newYearlyGoalKpi.trim() } : {})
    };
    saveYearlyPlan({
      ...activeYearPlan,
      tasks: [...activeYearPlan.tasks, nextTask]
    });
    setNewYearlyGoalInput('');
    setNewYearlyGoalKpi('');
  };

  const handleUpdateYearlyGoal = (id: string, patch: Partial<TaskItem>) => {
    saveYearlyPlan({
      ...activeYearPlan,
      tasks: activeYearPlan.tasks.map(t => (t.id === id ? { ...t, ...patch } : t))
    });
  };

  const handleDeleteYearlyGoal = (id: string) => {
    saveYearlyPlan({
      ...activeYearPlan,
      tasks: activeYearPlan.tasks.filter(t => t.id !== id)
    });
  };

  const handleSpawnQuarterlyStepFromYear = (
    parentTask: TaskItem,
    quarterKey: string,
    text: string,
    kpiTarget?: string
  ) => {
    const targetQuarter = getQuarterlyPlan(quarterKey);
    const nextTask: TaskItem = {
      id: `qgoal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text,
      completed: false,
      parentLinkMode: 'step',
      yearlyTaskId: parentTask.id,
      ...(kpiTarget ? { kpiTarget } : {})
    };
    saveQuarterlyPlan({
      ...targetQuarter,
      tasks: [...targetQuarter.tasks, nextTask]
    });
    setHierarchyNotice(`Added step to ${quarterKey}`);
    setTimeout(() => setHierarchyNotice(null), 2400);
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
    setModalQuarterKey(selectedQuarterKey);
    setModalYearKey(selectedYearKey);
    setCreatePlanType(
      planningSubTab === 'weekly'
        ? 'weekly'
        : planningSubTab === 'monthly'
        ? 'monthly'
        : planningSubTab === 'quarterly'
        ? 'quarterly'
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

  const handleCreateQuarterlyPlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const key = getQuarterInfo(modalQuarterKey || getQuarterKeyForDate(todayDate)).quarterKey;
    const existing = getQuarterlyPlan(key);
    saveQuarterlyPlan({
      ...existing,
      ...(modalQuarterFocus.trim() ? { focusTheme: modalQuarterFocus.trim() } : {})
    });
    setSelectedQuarterKey(key);
    setPlanningSubTab('quarterly');
    setShowCreatePlanModal(false);
    setModalQuarterFocus('');
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
                {planningSubTab === 'quarterly' && `Quarterly Plan (${selectedQuarterKey})`}
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

              {systemLevel >= 4 && (
                <button
                  type="button"
                  onClick={() => setPlanningSubTab('quarterly')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    planningSubTab === 'quarterly'
                      ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Quarterly</span>
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

            {/* Group 2: Strategy Roadmaps (LVL 4+) & Weeks Matrix (LVL 3+) */}
            {(systemLevel >= 4 || systemLevel >= 3) && (
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-950 border border-slate-800/80">
                {systemLevel >= 4 && (
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
                )}

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
            )}

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
        <Suspense fallback={<SubViewFallback />}>
          <WeeklyGoalCrusherView />
        </Suspense>
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
                const hasContent = !!(
                  mPlan &&
                  (mPlan.tasks.length > 0 ||
                    mPlan.focusTheme.trim() ||
                    (mPlan.topFocuses || []).some(f => f.trim()))
                );
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

          {/* LOOKING UP: Parent Quarter & Committed Roadmap Gates Bar */}
          {(parentQuarterPlanForMonth.focusTheme.trim() ||
            (parentQuarterPlanForMonth.topFocuses || []).some(f => f.trim()) ||
            parentQuarterPlanForMonth.tasks.length > 0 ||
            committedGatesForMonthQuarter.length > 0) && (
            <div className="rounded-2xl bg-slate-900/80 border border-cyan-500/25 overflow-hidden shadow-md">
              <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowParentQuarterInMonth(v => !v)}
                  className="flex items-center space-x-2 text-left min-w-0"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-400 shrink-0">
                    Serving {monthInfo.quarterKey} Quarterly Plan
                  </span>
                  {parentQuarterPlanForMonth.focusTheme.trim() && (
                    <span className="text-xs font-semibold text-slate-300 truncate">
                      · {parentQuarterPlanForMonth.focusTheme.trim()}
                    </span>
                  )}
                </button>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedQuarterKey(monthInfo.quarterKey);
                      setPlanningSubTab('quarterly');
                    }}
                    className="text-[11px] font-bold text-cyan-300 hover:text-cyan-200"
                  >
                    Open {monthInfo.quarterKey} →
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowParentQuarterInMonth(v => !v)}
                    className="p-1 text-slate-400 hover:text-slate-200"
                  >
                    {showParentQuarterInMonth ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {showParentQuarterInMonth && (
                <div className="px-4 pb-3.5 pt-2 border-t border-slate-800/80 space-y-2.5 text-xs">
                  {committedGatesForMonthQuarter.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 mr-1">
                        Q-Target Roadmap Gates:
                      </span>
                      {committedGatesForMonthQuarter.map(cg => {
                        const enc = `gate:${cg.plan.id}|${cg.stage.id}`;
                        return (
                          <button
                            key={enc}
                            type="button"
                            onClick={() => setNewMonthlyGoalParent(enc)}
                            title="Select as parent for your next Monthly deliverable below"
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-colors ${
                              newMonthlyGoalParent === enc
                                ? 'bg-purple-500/20 text-purple-200 border-purple-500/50'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
                            }`}
                          >
                            <Compass className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>
                              {cg.plan.title} · {cg.stage.title}
                            </span>
                            <span className="font-mono text-[10px] text-emerald-300/80">
                              ({cg.doneGoals}/{cg.totalGoals})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {parentQuarterPlanForMonth.tasks.filter(t => !t.completed && t.status !== 'parked')
                    .length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                        {monthInfo.quarterKey} Outcomes:
                      </span>
                      {parentQuarterPlanForMonth.tasks
                        .filter(t => !t.completed && t.status !== 'parked')
                        .map(qt => {
                          const enc = `quarterly:${qt.id}`;
                          const hasStepInMonth = activeMonthPlan.tasks.some(
                            mt => mt.quarterlyTaskId === qt.id
                          );
                          return (
                            <button
                              key={qt.id}
                              type="button"
                              onClick={() => setNewMonthlyGoalParent(enc)}
                              title="Select as parent for your next Monthly deliverable below"
                              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-colors ${
                                newMonthlyGoalParent === enc
                                  ? 'bg-purple-500/20 text-purple-200 border-purple-500/50'
                                  : hasStepInMonth
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                              }`}
                            >
                              <span>{hasStepInMonth ? '✓' : '○'}</span>
                              <span>{qt.text}</span>
                              {qt.kpiTarget?.trim() && (
                                <span className="text-[10px] font-mono text-slate-500">
                                  ({qt.kpiTarget.trim()})
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
                {monthlyDoneCount} / {activeMonthPlan.tasks.filter(t => t.status !== 'parked').length} goals
              </span>
            </div>

            {/* Monthly Top 3 Focuses */}
            <div className="pt-4 border-t border-slate-800/80">
              <TopFocusesEditor
                focuses={activeMonthPlan.topFocuses}
                onChange={next => saveMonthlyPlan({ ...activeMonthPlan, topFocuses: next })}
                accent="purple"
                title={`Top 3 Focuses • ${formatMonthLabel(selectedMonthKey)}`}
              />
            </div>

            {/* Monthly Deliverables (Model A: Parent Link + KPI Proof + Weekly Steps Roll-Up) */}
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-200">
                    Monthly Goals &amp; Deliverables ({activeMonthPlan.tasks.length})
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Link each deliverable to a {monthInfo.quarterKey} Outcome or Roadmap Gate, add an optional KPI proof check, and break it into Weekly steps.
                  </p>
                </div>
                {hierarchyNotice && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                    ✓ {hierarchyNotice}
                  </span>
                )}
              </div>

              {activeMonthPlan.tasks.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-xs text-slate-500 text-center">
                  No monthly deliverables set yet for {formatMonthLabel(selectedMonthKey)}. Add your first one below.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeMonthPlan.tasks.map(task => {
                    const weeklySteps = getWeeklyChildrenOfMonthlyTask(
                      task.id,
                      selectedMonthKey,
                      weeklyPlans
                    );
                    return (
                      <HierarchyOutcomeCard
                        key={task.id}
                        task={task}
                        accent="purple"
                        parentOptions={monthlyParentOptions}
                        selectedParentValue={encodeMonthlyParent(task)}
                        onChangeParent={val =>
                          handleUpdateMonthlyGoal(task.id, decodeMonthlyParentPatch(val))
                        }
                        childrenSteps={weeklySteps}
                        childUnitLabel="Weekly"
                        childPeriodOptions={monthChildWeekOptions}
                        defaultChildPeriodKey={defaultChildWeekForMonth}
                        onSpawnChildStep={(weekId, text, kpi) =>
                          handleSpawnWeeklyStepFromMonth(task, weekId, text, kpi)
                        }
                        onJumpToChildPeriod={weekId => {
                          setSelectedWeekId(weekId);
                          setPlanningSubTab('weekly');
                        }}
                        onToggleComplete={() =>
                          handleUpdateMonthlyGoal(task.id, { completed: !task.completed })
                        }
                        onEditText={text => handleUpdateMonthlyGoal(task.id, { text })}
                        onUpdateFields={patch => handleUpdateMonthlyGoal(task.id, patch)}
                        onDelete={() => handleDeleteMonthlyGoal(task.id)}
                      />
                    );
                  })}
                </div>
              )}

              {/* Quick Add Monthly Deliverable */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddMonthlyGoal();
                }}
                className="p-3 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 focus-within:border-purple-500/50 transition-colors space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Plus className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    value={newMonthlyGoalInput}
                    onChange={(e) => setNewMonthlyGoalInput(e.target.value)}
                    placeholder="Type a concrete monthly deliverable and press Enter..."
                    className="flex-1 min-w-[200px] bg-transparent text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
                  />
                  {monthlyParentOptions.length > 0 && (
                    <select
                      value={newMonthlyGoalParent}
                      onChange={e => setNewMonthlyGoalParent(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] font-semibold text-purple-300 focus:outline-none max-w-[200px]"
                    >
                      <option value="">Parent (optional)...</option>
                      {monthlyParentOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          ↑ {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="submit"
                    disabled={!newMonthlyGoalInput.trim()}
                    className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-40 text-purple-300 border border-purple-500/30 text-xs font-bold shrink-0"
                  >
                    + Add
                  </button>
                </div>
                <input
                  type="text"
                  value={newMonthlyGoalKpi}
                  onChange={e => setNewMonthlyGoalKpi(e.target.value)}
                  placeholder="Optional measurable KPI proof (e.g. 100 backtests done, 20 outreach calls)..."
                  className="w-full pl-6 bg-transparent text-[11px] text-emerald-300/90 placeholder-slate-600 focus:outline-none"
                />
              </form>
            </div>

            {/* LOOKING DOWN: Weeks Executing This Month */}
            {monthChildWeeks.length > 0 && (
              <div className="space-y-2.5 pt-4 border-t border-slate-800/80">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                    <Target className="w-3.5 h-3.5" />
                    <span>Weeks Executing {formatMonthLabel(selectedMonthKey)} ({monthChildWeeks.length})</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Click any week to zoom in</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {monthChildWeeks.map(wp => {
                    const livePts = computeWeeklyAchievedScore(wp.tasks);
                    const doneTasks = wp.tasks.filter(t => t.completed).length;
                    return (
                      <button
                        key={wp.id}
                        type="button"
                        onClick={() => {
                          setSelectedWeekId(wp.id);
                          setPlanningSubTab('weekly');
                        }}
                        className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-left transition-all space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-amber-300 font-mono">
                            Week {wp.weekNumber}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-emerald-400">
                            {livePts}/{wp.totalPossibleScore} pts
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {wp.startDate.slice(5)} → {wp.endDate.slice(5)} · {doneTasks}/{wp.tasks.length} tasks
                        </div>
                        <p className="text-xs text-slate-300 truncate">
                          {wp.focusTheme?.trim() || 'No weekly focus set'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Optional Monthly KPIs / Proof Check (Hidden behind toggle if empty — zero clutter!) */}
            <div className="pt-4 border-t border-slate-800/80">
              {(activeMonthPlan.scoreboard || []).length > 0 || showMonthlyScoreboard ? (
                <ScoreboardEditor
                  metrics={activeMonthPlan.scoreboard || []}
                  onChange={next => saveMonthlyPlan({ ...activeMonthPlan, scoreboard: next })}
                  showActual={false}
                  accent="purple"
                  title={`Monthly KPIs & Proof Checks (${formatMonthLabel(selectedMonthKey)})`}
                  subtitle="Checked once at month-end review — never tracked daily."
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowMonthlyScoreboard(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-400 hover:text-purple-300 transition-colors"
                >
                  <Gauge className="w-3.5 h-3.5 text-purple-400" />
                  <span>+ Add Monthly KPIs (Checked at Month-End Review)</span>
                </button>
              )}
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

      {/* VIEW 3B: QUARTERLY PLANNING (90-DAY STRATEGIC CONTRACT) */}
      {planningSubTab === 'quarterly' && (
        <Suspense fallback={<SubViewFallback />}>
          <QuarterlyPlanSection
            selectedQuarterKey={selectedQuarterKey}
            setSelectedQuarterKey={setSelectedQuarterKey}
            selectedMonthKey={selectedMonthKey}
            onOpenMonth={mKey => {
              setSelectedMonthKey(mKey);
              setPlanningSubTab('monthly');
            }}
            onOpenYear={yKey => {
              setSelectedYearKey(yKey);
              setPlanningSubTab('yearly');
            }}
          />
        </Suspense>
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
                const hasContent = !!(
                  yPlan &&
                  (yPlan.tasks.length > 0 ||
                    yPlan.focusTheme.trim() ||
                    (yPlan.topFocuses || []).some(f => f.trim()))
                );
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
                {yearlyDoneCount} / {activeYearPlan.tasks.filter(t => t.status !== 'parked').length} goals
              </span>
            </div>

            {/* Yearly Top 3 Focuses */}
            <div className="pt-4 border-t border-slate-800/80">
              <TopFocusesEditor
                focuses={activeYearPlan.topFocuses}
                onChange={next => saveYearlyPlan({ ...activeYearPlan, topFocuses: next })}
                accent="rose"
                title={`Top 3 Focuses • ${selectedYearKey}`}
              />
            </div>

            {/* Yearly Objectives (Model A: KPI Proof + Quarterly Steps Decomposition & Live Roll-Up) */}
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-200">
                    Yearly Objectives ({activeYearPlan.tasks.length})
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Attach a measurable KPI proof check to each annual outcome and break it down into Quarterly milestones.
                  </p>
                </div>
                {hierarchyNotice && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                    ✓ {hierarchyNotice}
                  </span>
                )}
              </div>

              {activeYearPlan.tasks.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-xs text-slate-500 text-center">
                  No yearly goals set yet for {selectedYearKey}. Add your first objective below.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeYearPlan.tasks.map(task => {
                    const qSteps = getQuarterlyChildrenOfYearlyTask(
                      task.id,
                      selectedYearKey,
                      quarterlyPlans
                    );
                    return (
                      <HierarchyOutcomeCard
                        key={task.id}
                        task={task}
                        accent="rose"
                        childrenSteps={qSteps}
                        childUnitLabel="Quarterly"
                        childPeriodOptions={yearChildQuarterOptions}
                        defaultChildPeriodKey={defaultChildQuarterForYear}
                        onSpawnChildStep={(qKey, text, kpi) =>
                          handleSpawnQuarterlyStepFromYear(task, qKey, text, kpi)
                        }
                        onJumpToChildPeriod={qKey => {
                          setSelectedQuarterKey(qKey);
                          setPlanningSubTab('quarterly');
                        }}
                        onToggleComplete={() =>
                          handleUpdateYearlyGoal(task.id, { completed: !task.completed })
                        }
                        onEditText={text => handleUpdateYearlyGoal(task.id, { text })}
                        onUpdateFields={patch => handleUpdateYearlyGoal(task.id, patch)}
                        onDelete={() => handleDeleteYearlyGoal(task.id)}
                      />
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
                className="p-3 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 focus-within:border-rose-500/50 transition-colors space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <Plus className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    value={newYearlyGoalInput}
                    onChange={(e) => setNewYearlyGoalInput(e.target.value)}
                    placeholder={`Type a ${selectedYearKey} objective and press Enter...`}
                    className="flex-1 bg-transparent text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newYearlyGoalInput.trim()}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 text-rose-300 border border-rose-500/30 text-xs font-bold"
                  >
                    + Add
                  </button>
                </div>
                <input
                  type="text"
                  value={newYearlyGoalKpi}
                  onChange={e => setNewYearlyGoalKpi(e.target.value)}
                  placeholder="Optional measurable KPI proof (e.g. $5k/mo consistent, 12% BF, pass Stage 2 Gate)..."
                  className="w-full pl-6 bg-transparent text-[11px] text-emerald-300/90 placeholder-slate-600 focus:outline-none"
                />
              </form>
            </div>

            {/* LOOKING DOWN: Live 4-Quarter Strip Executing This Year */}
            <div className="space-y-2.5 pt-4 border-t border-slate-800/80">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Quarters Executing {selectedYearKey}</span>
                </span>
                <span className="text-[11px] text-slate-500">Click any quarter to zoom in</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {yearChildQuarters.map(qKey => {
                  const qp = quarterlyPlans[qKey];
                  const activeQTasks = (qp?.tasks || []).filter(t => t.status !== 'parked');
                  const doneQ = activeQTasks.filter(t => t.completed).length;
                  const gateCount = (qp?.targetGateRefs || []).length;
                  return (
                    <button
                      key={qKey}
                      type="button"
                      onClick={() => {
                        setSelectedQuarterKey(qKey);
                        setPlanningSubTab('quarterly');
                      }}
                      className="p-3.5 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-left transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold font-mono text-cyan-300">{qKey}</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 font-mono text-[10px] font-bold text-slate-300">
                          {doneQ}/{activeQTasks.length} done
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 truncate">
                        {qp?.focusTheme?.trim() || 'No focus set yet'}
                      </p>
                      <div className="text-[10px] font-mono text-slate-500">
                        {gateCount > 0 ? `${gateCount} target roadmap gate${gateCount === 1 ? '' : 's'}` : 'Open Quarterly Plan →'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Yearly Real-World Scoreboard */}
            <div className="pt-4 border-t border-slate-800/80">
              <ScoreboardEditor
                metrics={activeYearPlan.scoreboard || []}
                onChange={next => saveYearlyPlan({ ...activeYearPlan, scoreboard: next })}
                showActual={false}
                accent="rose"
                title={`Annual Real-World Scoreboard (${selectedYearKey} Baseline → Target)`}
                subtitle="Define your starting numbers on Jan 1 and your 12-month real-world targets so your Yearly Review audits real outcomes."
              />
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
      {planningSubTab === 'roadmaps' && (
        <Suspense fallback={<SubViewFallback />}>
          <StrategyRoadmapsView />
        </Suspense>
      )}

      {/* VIEW 6: WEEKS MATRIX */}
      {planningSubTab === 'matrix' && (
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <Suspense fallback={<SubViewFallback />}>
            <SpreadsheetMatrixView />
          </Suspense>
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

            {/* Type selector (filtered by systemLevel) */}
            <div className="flex flex-wrap gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setCreatePlanType('daily')}
                className={`flex-1 min-w-[72px] py-2.5 rounded-xl text-xs font-bold transition-all ${
                  createPlanType === 'daily'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Daily
              </button>
              {systemLevel >= 3 && (
                <button
                  type="button"
                  onClick={() => setCreatePlanType('weekly')}
                  className={`flex-1 min-w-[72px] py-2.5 rounded-xl text-xs font-bold transition-all ${
                    createPlanType === 'weekly'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Weekly
                </button>
              )}
              {systemLevel >= 4 && (
                <button
                  type="button"
                  onClick={() => setCreatePlanType('monthly')}
                  className={`flex-1 min-w-[72px] py-2.5 rounded-xl text-xs font-bold transition-all ${
                    createPlanType === 'monthly'
                      ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Monthly
                </button>
              )}
              {systemLevel >= 4 && (
                <button
                  type="button"
                  onClick={() => setCreatePlanType('quarterly')}
                  className={`flex-1 min-w-[72px] py-2.5 rounded-xl text-xs font-bold transition-all ${
                    createPlanType === 'quarterly'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Quarterly
                </button>
              )}
              {systemLevel >= 5 && (
                <button
                  type="button"
                  onClick={() => setCreatePlanType('yearly')}
                  className={`flex-1 min-w-[72px] py-2.5 rounded-xl text-xs font-bold transition-all ${
                    createPlanType === 'yearly'
                      ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Yearly
                </button>
              )}
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

            {/* Quarterly Plan Creation Form */}
            {createPlanType === 'quarterly' && (
              <form onSubmit={handleCreateQuarterlyPlanSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Year</label>
                    <input
                      type="number"
                      min={2020}
                      max={2100}
                      value={modalQuarterKey.split('-Q')[0] || '2026'}
                      onChange={(e) => {
                        const y = e.target.value || '2026';
                        const q = modalQuarterKey.split('-Q')[1] || '1';
                        setModalQuarterKey(`${y}-Q${q}`);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-mono text-slate-100 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Quarter</label>
                    <select
                      value={modalQuarterKey.split('-Q')[1] || '1'}
                      onChange={(e) => {
                        const y = modalQuarterKey.split('-Q')[0] || '2026';
                        setModalQuarterKey(`${y}-Q${e.target.value}`);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-mono text-cyan-400 font-bold focus:outline-none"
                    >
                      <option value="1">Q1 (Jan – Mar)</option>
                      <option value="2">Q2 (Apr – Jun)</option>
                      <option value="3">Q3 (Jul – Sep)</option>
                      <option value="4">Q4 (Oct – Dec)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Quarterly Focus &amp; Core Thesis (Optional)</label>
                  <input
                    type="text"
                    value={modalQuarterFocus}
                    onChange={(e) => setModalQuarterFocus(e.target.value)}
                    placeholder="e.g. Pass Stage 1 Trading Gate & close first 5 Rewire clients"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded-xl p-3 text-sm text-slate-100 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/20"
                >
                  Open {getQuarterInfo(modalQuarterKey).label} Plan
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
