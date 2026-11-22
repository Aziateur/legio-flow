import React, { useState } from 'react';
import {
  useStorage,
  computeWeeklyAchievedScore
} from '../../context/StorageContext';
import {
  ReviewEntry,
  OutcomeVerdict,
  OutcomeRootCause,
  RoadmapVerdict,
  PromiseVerdict,
  ScoreboardMetric,
  ChecklistRecurrence,
  TaskItem,
  WeeklyPlan,
  DailyEntry,
  GWSSession
} from '../../types/schema';
import { INITIAL_LIFE_PILLARS } from '../../types/defaults';
import {
  getQuarterInfo,
  shiftQuarterKey,
  getYearInfo,
  shiftYearKey,
  computeHabitDurabilityInRange,
  computeRepsVolumeInRange,
  getProblemsForRoadmapInRange,
  getSystemicProblemsInRange,
  computeTrajectoryTrend,
  computeGwsAllocationInRange
} from '../../lib/macroAnalytics';
import { formatProblemsForReviewText, problemOccurredInRange } from '../../lib/problems';
import { ScoreboardEditor } from '../common/ScoreboardEditor';
import { TopFocusesEditor } from '../common/TopFocusesEditor';
import { GwsAllocationCard } from '../common/GwsAllocationCard';
import { ProblemLoggerPanel } from '../problems/ProblemLoggerPanel';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle2,
  Circle,
  ExternalLink,
  Compass,
  Layers,
  Award,
  Target,
  Calendar as CalendarIcon,
  Timer,
  Sliders,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Flame,
  RotateCcw
} from 'lucide-react';

export interface CompiledMonthSummary {
  info: {
    monthKey: string;
    year: number;
    month: number;
    startDate: string;
    endDate: string;
    label: string;
    quarterKey: string;
  };
  saved?: ReviewEntry;
  completedMonthGoals: number;
  totalMonthGoals: number;
  weeks: WeeklyPlan[];
  weeklyPointsAchieved: number;
  weeklyPointsPossible: number;
  avgWeeklyScore: string;
  days: DailyEntry[];
  avgDailyScore: string;
  habitRatePct: number;
  gws: GWSSession[];
  gwsHours: string;
  avgGwsTotal: string;
}

export interface CompiledQuarterSummary {
  info: {
    quarterKey: string;
    year: number;
    qNum: number;
    months: string[];
    startDate: string;
    endDate: string;
    label: string;
  };
  saved?: ReviewEntry;
  monthsData: CompiledMonthSummary[];
  weeks: WeeklyPlan[];
  weeklyPointsAchieved: number;
  weeklyPointsPossible: number;
  avgWeeklyScore: string;
  weeklyTasksDone: number;
  weeklyTasksTotal: number;
  days: DailyEntry[];
  avgDailyScore: string;
  dailyTasksDone: number;
  dailyTasksTotal: number;
  habitRatePct: number;
  gws: GWSSession[];
  gwsHours: string;
  avgGwsTotal: string;
}

export interface CompiledYearSummary {
  info: {
    yearKey: string;
    year: number;
    startDate: string;
    endDate: string;
    quarters: string[];
    months: string[];
    label: string;
  };
  saved?: ReviewEntry;
  quartersData: CompiledQuarterSummary[];
  monthsData: CompiledMonthSummary[];
  weeks: WeeklyPlan[];
  weeklyPointsAchieved: number;
  weeklyPointsPossible: number;
  avgWeeklyScore: string;
  days: DailyEntry[];
  avgDailyScore: string;
  habitRatePct: number;
  gws: GWSSession[];
  gwsHours: string;
  avgGwsTotal: string;
}

interface MacroReviewViewProps {
  mode: 'quarterly' | 'yearly';
  periodKey: string;
  setPeriodKey: (key: string) => void;
  allKnownPeriods: string[];
  quarterData?: CompiledQuarterSummary;
  yearData?: CompiledYearSummary;
  prevSavedReview?: ReviewEntry;
  onUpsertReview: (periodKey: string, updates: Partial<ReviewEntry>) => void;
  onOpenMonth: (monthKey: string) => void;
  onOpenQuarter: (quarterKey: string) => void;
  onOpenWeek: (weekId: string) => void;
  onOpenVault: () => void;
}

const OUTCOME_VERDICTS: Array<{ id: OutcomeVerdict; label: string; activeCls: string }> = [
  { id: 'hit', label: 'Hit', activeCls: 'bg-emerald-500 text-slate-950 border-emerald-400' },
  { id: 'partial', label: 'Partial', activeCls: 'bg-amber-500 text-slate-950 border-amber-400' },
  { id: 'missed', label: 'Missed', activeCls: 'bg-rose-500 text-slate-950 border-rose-400' },
  { id: 'dropped', label: 'Dropped', activeCls: 'bg-slate-600 text-slate-100 border-slate-500' }
];

const OUTCOME_CAUSES: Array<{ id: OutcomeRootCause; label: string }> = [
  { id: 'execution', label: 'Execution' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'scope', label: 'Scope' },
  { id: 'shifted', label: 'Priority Shifted' }
];

const ROADMAP_VERDICTS: Array<{ id: RoadmapVerdict; label: string; activeCls: string }> = [
  { id: 'push_gate', label: 'Push Gate', activeCls: 'bg-emerald-500 text-slate-950 border-emerald-400' },
  { id: 'redesign', label: 'Redesign Stage', activeCls: 'bg-amber-500 text-slate-950 border-amber-400' },
  { id: 'maintain', label: 'Maintain', activeCls: 'bg-cyan-500 text-slate-950 border-cyan-400' },
  { id: 'pause', label: 'Pause / Cut', activeCls: 'bg-rose-500 text-slate-950 border-rose-400' }
];

const PROMISE_VERDICTS: Array<{ id: PromiseVerdict; label: string; activeCls: string }> = [
  { id: 'executed', label: 'Followed Through', activeCls: 'bg-emerald-500 text-slate-950 border-emerald-400' },
  { id: 'partial', label: 'Partially', activeCls: 'bg-amber-500 text-slate-950 border-amber-400' },
  { id: 'repeated', label: 'Repeated Old Loop', activeCls: 'bg-rose-500 text-slate-950 border-rose-400' }
];

const STAGE_META = [
  { id: 1, short: '1. Reality', full: 'Past Commitments & Real-World Reality' },
  { id: 2, short: '2. Trajectory', full: 'Effort, Trajectory & Habit Durability' },
  { id: 3, short: '3. Strategy', full: 'Roadmaps & Systemic Bottlenecks' },
  { id: 4, short: '4. Whole Life', full: 'Custom Life Pillars & Frame Check' },
  { id: 5, short: '5. Close Loop', full: 'Close the Loop — Design Next Period' }
];

export const MacroReviewView: React.FC<MacroReviewViewProps> = ({
  mode,
  periodKey,
  setPeriodKey,
  allKnownPeriods,
  quarterData,
  yearData,
  prevSavedReview,
  onUpsertReview,
  onOpenMonth,
  onOpenQuarter,
  onOpenWeek,
  onOpenVault
}) => {
  const {
    todayDate,
    weeklyPlans,
    selectedWeekId,
    quarterlyPlans,
    getQuarterlyPlan,
    saveQuarterlyPlan,
    getYearlyPlan,
    saveYearlyPlan,
    strategyPlans,
    saveStrategyPlan,
    gwsSessions,
    problems,
    checklistCategories,
    checklistItems,
    saveChecklistItems,
    lifePillars,
    saveLifePillars,
    customReviewPrompts,
    saveCustomReviewPrompts,
    macroReviewSettings,
    saveMacroReviewSettings,
    setActiveTab,
    setPlanningSubTab,
    setReviewSubTab
  } = useStorage();

  const isQuarterly = mode === 'quarterly';
  const accent = isQuarterly ? 'cyan' : 'rose';

  const startDate = isQuarterly
    ? quarterData?.info.startDate || getQuarterInfo(periodKey).startDate
    : yearData?.info.startDate || getYearInfo(periodKey).startDate;
  const endDate = isQuarterly
    ? quarterData?.info.endDate || getQuarterInfo(periodKey).endDate
    : yearData?.info.endDate || getYearInfo(periodKey).endDate;
  const periodLabel = isQuarterly
    ? quarterData?.info.label || getQuarterInfo(periodKey).label
    : yearData?.info.label || getYearInfo(periodKey).label;
  const prevPeriodKey = isQuarterly ? shiftQuarterKey(periodKey, -1) : shiftYearKey(periodKey, -1);
  const nextPeriodKey = isQuarterly ? shiftQuarterKey(periodKey, 1) : shiftYearKey(periodKey, 1);
  const nextPeriodLabel = isQuarterly ? getQuarterInfo(nextPeriodKey).quarterKey : nextPeriodKey;

  const saved = isQuarterly ? quarterData?.saved : yearData?.saved;

  // Live linked Plan (QuarterlyPlan or YearlyPlan) & Next Period Plan
  const currentPlan = isQuarterly ? getQuarterlyPlan(periodKey) : getYearlyPlan(periodKey);
  const nextPlan = isQuarterly ? getQuarterlyPlan(nextPeriodKey) : getYearlyPlan(nextPeriodKey);

  const saveCurrentPlan = (patch: Partial<typeof currentPlan>) => {
    if (isQuarterly) {
      saveQuarterlyPlan({ ...getQuarterlyPlan(periodKey), ...patch });
    } else {
      saveYearlyPlan({ ...getYearlyPlan(periodKey), ...patch });
    }
  };

  const saveNextPlan = (patch: Partial<typeof nextPlan>) => {
    if (isQuarterly) {
      saveQuarterlyPlan({ ...getQuarterlyPlan(nextPeriodKey), ...patch });
    } else {
      saveYearlyPlan({ ...getYearlyPlan(nextPeriodKey), ...patch });
    }
  };

  // UI local states (zero-clutter progressive disclosure)
  const [showCustomize, setShowCustomize] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [newOutcomeText, setNewOutcomeText] = useState('');
  const [nextOutcomeDraft, setNextOutcomeDraft] = useState('');
  const [carryNotice, setCarryNotice] = useState<string | null>(null);
  const [newHabitText, setNewHabitText] = useState('');
  const [newHabitRecurrence, setNewHabitRecurrence] = useState<ChecklistRecurrence>('daily');
  const [habitNotice, setHabitNotice] = useState<string | null>(null);
  const [newPillarName, setNewPillarName] = useState('');
  const [newPillarDesc, setNewPillarDesc] = useState('');
  const [newPromptTitle, setNewPromptTitle] = useState('');
  const [showReceipts, setShowReceipts] = useState(false);
  const [receiptTab, setReceiptTab] = useState<'quarters' | 'months' | 'weeks' | 'days' | 'gws'>(
    isQuarterly ? 'months' : 'quarters'
  );
  const [expandedOutcomeNotes, setExpandedOutcomeNotes] = useState<Record<string, boolean>>({});
  const [showAllHabits, setShowAllHabits] = useState(false);

  // Saved macro review fields
  const score = saved?.score || 0;
  const headline = saved?.headline || '';
  const wins = saved?.wins || '';
  const courseCorrections = saved?.courseCorrections || '';
  const prevPromiseVerdict = saved?.prevPromiseVerdict;
  const prevPromiseNote = saved?.prevPromiseNote || '';
  const outcomeAudits = saved?.outcomeAudits || {};
  const effortVsOutcomeNote = saved?.effortVsOutcomeNote || '';
  const roadmapAudits = saved?.roadmapAudits || {};
  const pillarAudits = saved?.pillarAudits || {};
  const assumptionsDisproved = saved?.assumptionsDisproved || '';
  const energyAndMountainNote = saved?.energyAndMountainNote || '';
  const customAnswers = saved?.customAnswers || {};

  // Visibility & Custom prompt labels
  const hiddenStages = macroReviewSettings.hiddenStages?.[mode] || [];
  const isStageVisible = (stageId: number) => !hiddenStages.includes(stageId);

  const toggleStageVisibility = (stageId: number) => {
    const nextHidden = hiddenStages.includes(stageId)
      ? hiddenStages.filter(id => id !== stageId)
      : [...hiddenStages, stageId];
    saveMacroReviewSettings({
      ...macroReviewSettings,
      hiddenStages: {
        ...macroReviewSettings.hiddenStages,
        [mode]: nextHidden
      }
    });
  };

  const getPromptLabel = (key: string, fallback: string) =>
    macroReviewSettings.customPromptLabels?.[`${mode}:${key}`]?.trim() || fallback;

  const setPromptLabel = (key: string, value: string) => {
    saveMacroReviewSettings({
      ...macroReviewSettings,
      customPromptLabels: {
        ...(macroReviewSettings.customPromptLabels || {}),
        [`${mode}:${key}`]: value
      }
    });
  };

  const modeCustomPrompts = customReviewPrompts.filter(p => p.scope === mode);

  // Analytics computed live from all 4 islands
  const habitRows = computeHabitDurabilityInRange(
    checklistItems,
    weeklyPlans,
    startDate,
    endDate,
    todayDate
  );
  const repsRows = computeRepsVolumeInRange(checklistItems, startDate, endDate);
  const systemicProblems = getSystemicProblemsInRange(problems, startDate, endDate, mode);
  const gwsAllocation = computeGwsAllocationInRange(
    gwsSessions,
    strategyPlans,
    lifePillars,
    startDate,
    endDate,
    currentPlan.topFocuses
  );

  const visibleHabitRows = showAllHabits ? habitRows : habitRows.slice(0, 8);
  const avgHabitDurability =
    habitRows.length > 0
      ? Math.round(habitRows.reduce((acc, h) => acc + h.pct, 0) / habitRows.length)
      : 0;

  // Trajectory Trend Calculation
  const trajectorySeries = isQuarterly
    ? (quarterData?.monthsData || []).map(m => parseFloat(m.avgWeeklyScore) || parseFloat(m.avgDailyScore) || 0)
    : (yearData?.quartersData || []).map(q => q.saved?.score || parseFloat(q.avgWeeklyScore) || parseFloat(q.avgDailyScore) || 0);
  const trajectoryTrend = computeTrajectoryTrend(trajectorySeries);

  // Stage completion indicators for jump strip
  const stageDone: Record<number, boolean> = {
    1:
      Object.keys(outcomeAudits).length > 0 ||
      (currentPlan.scoreboard || []).some(m => m.actualValue.trim().length > 0) ||
      Boolean(prevPromiseVerdict),
    2: effortVsOutcomeNote.trim().length > 0,
    3: Object.keys(roadmapAudits).length > 0,
    4:
      Object.values(pillarAudits).some(p => (p.score || 0) > 0) ||
      assumptionsDisproved.trim().length > 0 ||
      energyAndMountainNote.trim().length > 0,
    5: score > 0 || wins.trim().length > 0 || courseCorrections.trim().length > 0
  };

  const scrollToStage = (stageId: number) => {
    document.getElementById(`macro_stage_${mode}_${stageId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };

  // Stage 1 helpers: Outcome Audit + Add Outcome + Yearly Scoreboard Auto-Pull
  const handleAddOutcomeHere = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newOutcomeText.trim();
    if (!trimmed) return;
    const task: TaskItem = {
      id: `${isQuarterly ? 'qgoal' : 'ygoal'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      completed: false
    };
    saveCurrentPlan({ tasks: [...currentPlan.tasks, task] });
    setNewOutcomeText('');
  };

  const handleToggleOutcomeComplete = (taskId: string) => {
    const nextTasks = currentPlan.tasks.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    const toggled = nextTasks.find(t => t.id === taskId);
    saveCurrentPlan({ tasks: nextTasks });
    if (toggled?.completed && !outcomeAudits[taskId]?.verdict) {
      onUpsertReview(periodKey, {
        outcomeAudits: {
          ...outcomeAudits,
          [taskId]: { ...outcomeAudits[taskId], verdict: 'hit' }
        }
      });
    }
  };

  const updateOutcomeAudit = (
    taskId: string,
    patch: Partial<{ verdict: OutcomeVerdict; rootCause: OutcomeRootCause; note: string }>
  ) => {
    const current = outcomeAudits[taskId] || {};
    const nextEntry = { ...current, ...patch };
    onUpsertReview(periodKey, {
      outcomeAudits: {
        ...outcomeAudits,
        [taskId]: nextEntry
      }
    });
    // Sync completion checkbox if explicitly marked Hit
    if (patch.verdict === 'hit') {
      const target = currentPlan.tasks.find(t => t.id === taskId);
      if (target && !target.completed) {
        saveCurrentPlan({
          tasks: currentPlan.tasks.map(t => (t.id === taskId ? { ...t, completed: true } : t))
        });
      }
    }
  };

  const handlePullYearlyScoreboardFromQuarters = () => {
    if (isQuarterly) return;
    const yInfo = getYearInfo(periodKey);
    const byName = new Map<string, ScoreboardMetric>();
    yInfo.quarters.forEach(qKey => {
      const qp = quarterlyPlans[qKey];
      (qp?.scoreboard || []).forEach(m => {
        const key = m.name.trim().toLowerCase();
        if (!key) return;
        const existing = byName.get(key);
        if (!existing) {
          byName.set(key, {
            id: `sb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: m.name.trim(),
            domain: m.domain || '',
            startValue: m.startValue || '',
            targetValue: m.targetValue || '',
            actualValue: m.actualValue || ''
          });
        } else {
          byName.set(key, {
            ...existing,
            domain: existing.domain || m.domain || '',
            startValue: existing.startValue || m.startValue || '',
            targetValue: m.targetValue || existing.targetValue,
            actualValue: m.actualValue || existing.actualValue
          });
        }
      });
    });

    if (byName.size === 0) {
      setCarryNotice('No scoreboard metrics found in Q1–Q4 yet.');
      setTimeout(() => setCarryNotice(null), 2500);
      return;
    }

    const existingList = currentPlan.scoreboard || [];
    const existingNames = new Set(existingList.map(m => m.name.trim().toLowerCase()));
    const merged = existingList.map(m => {
      const hit = byName.get(m.name.trim().toLowerCase());
      if (!hit) return m;
      return {
        ...m,
        startValue: m.startValue.trim() ? m.startValue : hit.startValue,
        actualValue: hit.actualValue.trim() ? hit.actualValue : m.actualValue
      };
    });
    byName.forEach((metric, key) => {
      if (!existingNames.has(key)) merged.push(metric);
    });
    saveCurrentPlan({ scoreboard: merged });
    setCarryNotice(`Pulled ${byName.size} scoreboard metric${byName.size === 1 ? '' : 's'} from Q1–Q4!`);
    setTimeout(() => setCarryNotice(null), 2500);
  };

  // Stage 3 helpers: Live Roadmap Proximal Goal toggle & Gate Pass + Verdict
  const handleToggleProximalGoal = (planId: string, stageId: string, goalId: string) => {
    const targetPlan = strategyPlans.find(p => p.id === planId);
    if (!targetPlan) return;
    saveStrategyPlan({
      ...targetPlan,
      stages: targetPlan.stages.map(s =>
        s.id === stageId
          ? {
              ...s,
              proximalGoals: s.proximalGoals.map(g =>
                g.id === goalId ? { ...g, completed: !g.completed } : g
              )
            }
          : s
      )
    });
  };

  const handleToggleStageGate = (planId: string, stageId: string) => {
    const targetPlan = strategyPlans.find(p => p.id === planId);
    if (!targetPlan) return;
    saveStrategyPlan({
      ...targetPlan,
      stages: targetPlan.stages.map(s =>
        s.id === stageId
          ? {
              ...s,
              gatePassed: !s.gatePassed,
              gatePassedAt: !s.gatePassed ? todayDate : undefined
            }
          : s
      )
    });
  };

  // Stage 4 helpers: Custom Pillars & Custom Questions CRUD
  const handleAddPillar = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPillarName.trim();
    if (!name) return;
    saveLifePillars([
      ...lifePillars,
      {
        id: `pillar_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        description: newPillarDesc.trim()
      }
    ]);
    setNewPillarName('');
    setNewPillarDesc('');
  };

  const handleMovePillar = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= lifePillars.length) return;
    const next = [...lifePillars];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    saveLifePillars(next);
  };

  const handleAddCustomPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newPromptTitle.trim();
    if (!title) return;
    saveCustomReviewPrompts([
      ...customReviewPrompts,
      {
        id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        scope: mode,
        title,
        placeholder: 'Write your reflection...'
      }
    ]);
    setNewPromptTitle('');
  };

  // Stage 5 helpers: Close-the-Loop mutations
  const handleAddNextPeriodOutcome = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nextOutcomeDraft.trim();
    if (!trimmed) return;
    const nextTask: TaskItem = {
      id: `${isQuarterly ? 'qgoal' : 'ygoal'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      completed: false
    };
    saveNextPlan({ tasks: [...nextPlan.tasks, nextTask] });
    setNextOutcomeDraft('');
  };

  const handleCarryOverScoreboardToNext = () => {
    const source = currentPlan.scoreboard || [];
    if (source.length === 0) {
      setCarryNotice('Add at least one metric to your Real-World Scoreboard in Stage 1 first.');
      setTimeout(() => setCarryNotice(null), 2500);
      return;
    }
    const existingNext = nextPlan.scoreboard || [];
    const existingNames = new Set(existingNext.map(m => m.name.trim().toLowerCase()));
    const carried: ScoreboardMetric[] = source
      .filter(m => m.name.trim() && !existingNames.has(m.name.trim().toLowerCase()))
      .map(m => ({
        id: `sb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: m.name.trim(),
        domain: m.domain || '',
        startValue: m.actualValue.trim() || m.startValue.trim(),
        targetValue: '',
        actualValue: ''
      }));
    if (carried.length === 0) {
      setCarryNotice(`All scoreboard metrics are already in ${nextPeriodLabel}.`);
      setTimeout(() => setCarryNotice(null), 2500);
      return;
    }
    saveNextPlan({ scoreboard: [...existingNext, ...carried] });
    setCarryNotice(`Carried ${carried.length} metric${carried.length === 1 ? '' : 's'} into ${nextPeriodLabel} (Actual → Start)!`);
    setTimeout(() => setCarryNotice(null), 3000);
  };

  const handleDispatchHabitToChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newHabitText.trim();
    if (!trimmed) return;
    const defaultCat = checklistCategories[0]?.id || 'cat_routine';
    saveChecklistItems([
      ...checklistItems,
      {
        id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        categoryId: defaultCat,
        text: trimmed,
        recurrence: newHabitRecurrence,
        completed: false,
        completedPeriods: [],
        createdAt: todayDate
      }
    ]);
    setNewHabitText('');
    setHabitNotice(`Added "${trimmed}" (${newHabitRecurrence}) to Checklist!`);
    setTimeout(() => setHabitNotice(null), 2800);
  };

  // Copy Full Strategic Report
  const handleCopyFullReport = () => {
    const lines: string[] = [];
    lines.push(`${periodLabel} — ${isQuarterly ? 'Quarterly Strategic Review' : 'Yearly Executive Review'}`);
    if (headline.trim()) lines.push(`Verdict / Chapter: "${headline.trim()}"`);
    lines.push(`Overall Score: ${score > 0 ? `${score}/10` : 'Unscored'}`);
    lines.push('');

    if (prevSavedReview?.courseCorrections?.trim()) {
      lines.push(`--- 1. PAST COMMITMENTS & REAL-WORLD REALITY ---`);
      lines.push(
        `Last Period (${prevPeriodKey}) Commitment Verdict: ${prevPromiseVerdict || 'Not audited'}${
          prevPromiseNote.trim() ? ` — ${prevPromiseNote.trim()}` : ''
        }`
      );
    }

    const nonEmptyFocuses = (currentPlan.topFocuses || []).map(f => f.trim()).filter(Boolean);
    if (nonEmptyFocuses.length > 0) {
      lines.push(`Top 3 Focuses:`);
      nonEmptyFocuses.forEach((f, idx) => lines.push(`  #${idx + 1}: ${f}`));
    }

    if (currentPlan.tasks.length > 0) {
      lines.push(`Contract Outcomes (${currentPlan.tasks.filter(t => t.completed).length}/${currentPlan.tasks.length} done):`);
      currentPlan.tasks.forEach(t => {
        const a = outcomeAudits[t.id];
        const tag = a?.verdict ? `[${a.verdict.toUpperCase()}${a.rootCause ? ` · ${a.rootCause}` : ''}]` : t.completed ? '[DONE]' : '[OPEN]';
        lines.push(`  • ${tag} ${t.text}${a?.note?.trim() ? ` — ${a.note.trim()}` : ''}`);
      });
    }

    if ((currentPlan.scoreboard || []).length > 0) {
      lines.push(`Real-World Scoreboard:`);
      (currentPlan.scoreboard || []).forEach(m => {
        lines.push(
          `  • ${m.name}${m.domain ? ` (${m.domain})` : ''}: Start ${m.startValue || '—'} → Target ${m.targetValue || '—'} → Actual ${m.actualValue || '—'}`
        );
      });
    }

    lines.push('');
    lines.push(`--- 2. EFFORT, TRAJECTORY & HABIT DURABILITY ---`);
    if (isQuarterly && quarterData) {
      quarterData.monthsData.forEach(m => {
        lines.push(
          `  • ${m.info.label}: Weekly ${m.avgWeeklyScore}/10 · Daily ${m.avgDailyScore}/10 · Habits ${m.habitRatePct}% · GWS ${m.gwsHours}h · Month Score ${m.saved?.score ? `${m.saved.score}/10` : '—'}`
        );
      });
    } else if (!isQuarterly && yearData) {
      yearData.quartersData.forEach(q => {
        lines.push(
          `  • ${q.info.quarterKey}: Q Score ${q.saved?.score ? `${q.saved.score}/10` : '—'} · Weekly ${q.avgWeeklyScore}/10 · Daily ${q.avgDailyScore}/10 · Habits ${q.habitRatePct}% · GWS ${q.gwsHours}h`
        );
      });
    }
    if (habitRows.length > 0) {
      lines.push(`Habit Durability (Avg ${avgHabitDurability}%):`);
      habitRows.slice(0, 10).forEach(h => {
        lines.push(`  • ${h.text} (${h.recurrence}): ${h.pct}% (${h.done}/${h.expected})`);
      });
    }
    if (gwsAllocation.totalSessions > 0) {
      lines.push(`Deep Work Allocation (${gwsAllocation.totalHours}h across ${gwsAllocation.totalSessions} sprints):`);
      gwsAllocation.buckets.forEach(b => {
        lines.push(`  • ${b.label}: ${b.hours}h (${b.pct}%) · ${b.sessions}× · avg ${b.avgScore}/15`);
      });
      if (gwsAllocation.neglectedFocuses.length > 0) {
        lines.push(`  ! 0h Logged Against Top Focus: ${gwsAllocation.neglectedFocuses.join(', ')}`);
      }
    }
    if (effortVsOutcomeNote.trim()) {
      lines.push(`Effort vs. Outcome Diagnosis:\n${effortVsOutcomeNote.trim()}`);
    }

    lines.push('');
    lines.push(`--- 3. ROADMAPS & SYSTEMIC BOTTLENECKS ---`);
    strategyPlans.forEach(sp => {
      const passed = sp.stages.filter(s => s.gatePassed).length;
      const active = sp.stages.find(s => !s.gatePassed);
      const ra = roadmapAudits[sp.id];
      lines.push(
        `  • ${sp.title} (${passed}/${sp.stages.length} gates)${ra?.verdict ? ` [${ra.verdict.toUpperCase()}]` : ''} — ${
          active ? `Active: ${active.title}` : 'All Gates Passed'
        }${ra?.constraintNote?.trim() ? ` | Constraint: ${ra.constraintNote.trim()}` : ''}`
      );
    });
    const probText = formatProblemsForReviewText(
      problems.filter(p => problemOccurredInRange(p, startDate, endDate))
    );
    if (probText) {
      lines.push(`Systemic Problems:\n${probText}`);
    }

    lines.push('');
    lines.push(`--- 4. LIFE PILLARS & FRAME CHECK ---`);
    lifePillars.forEach(p => {
      const pa = pillarAudits[p.id];
      if (pa?.score || pa?.note?.trim()) {
        lines.push(`  • ${p.name}: ${pa.score ? `${pa.score}/10` : '—'}${pa.note?.trim() ? ` — ${pa.note.trim()}` : ''}`);
      }
    });
    if (assumptionsDisproved.trim()) lines.push(`Assumptions / Capacity Shift:\n${assumptionsDisproved.trim()}`);
    if (energyAndMountainNote.trim()) lines.push(`Energy & Mountains:\n${energyAndMountainNote.trim()}`);
    modeCustomPrompts.forEach(cp => {
      const ans = customAnswers[cp.id]?.trim();
      if (ans) lines.push(`${cp.title}:\n${ans}`);
    });

    lines.push('');
    lines.push(`--- 5. WINS & NEXT ${isQuarterly ? 'QUARTER' : 'YEAR'} THESIS ---`);
    if (wins.trim()) lines.push(`Wins:\n${wins.trim()}`);
    if (courseCorrections.trim()) lines.push(`Next ${nextPeriodLabel} Thesis:\n${courseCorrections.trim()}`);

    navigator.clipboard.writeText(lines.join('\n').trim());
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  // Derived receipt arrays for bottom expandable drawer
  const receiptQuarters = yearData?.quartersData || [];
  const receiptMonths = isQuarterly ? quarterData?.monthsData || [] : yearData?.monthsData || [];
  const receiptWeeks = isQuarterly ? quarterData?.weeks || [] : yearData?.weeks || [];
  const receiptDays = isQuarterly ? quarterData?.days || [] : yearData?.days || [];
  const receiptGws = isQuarterly ? quarterData?.gws || [] : yearData?.gws || [];

  const accentBadge = isQuarterly
    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
    : 'bg-rose-500/10 text-rose-400 border-rose-500/25';
  const accentPillActive = isQuarterly
    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
    : 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20';
  const accentText = isQuarterly ? 'text-cyan-400' : 'text-rose-400';

  return (
    <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-6">
      {/* ================================================================ */}
      {/* TOP BAR: PERIOD SWITCHER + CUSTOMIZE + COPY FULL REPORT          */}
      {/* ================================================================ */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setPeriodKey(prevPeriodKey)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              title={isQuarterly ? 'Previous Quarter' : 'Previous Year'}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <span className={`text-[10px] font-extrabold uppercase tracking-widest block ${accentText}`}>
                {isQuarterly ? '90-Day Strategic Control Loop' : '12-Month Executive Control Loop'} ({startDate} → {endDate})
              </span>
              <div className="text-xl font-extrabold text-slate-100">
                {headline.trim() ? `${periodLabel} — ${headline.trim()}` : periodLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPeriodKey(nextPeriodKey)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              title={isQuarterly ? 'Next Quarter' : 'Next Year'}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {allKnownPeriods.map(pk => (
              <button
                key={pk}
                type="button"
                onClick={() => setPeriodKey(pk)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                  pk === periodKey
                    ? accentPillActive
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {pk}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowCustomize(v => !v)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                showCustomize
                  ? 'bg-slate-100 text-slate-950 border-slate-100'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Customize</span>
            </button>

            <button
              type="button"
              onClick={handleCopyFullReport}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition-all"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedReport ? 'Copied Report!' : 'Copy Full Report'}</span>
            </button>
          </div>
        </div>

        {/* 5-Stage Linear Walkthrough Jump Strip */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-800/80">
          {STAGE_META.filter(st => isStageVisible(st.id)).map(st => (
            <button
              key={st.id}
              type="button"
              onClick={() => scrollToStage(st.id)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 hover:text-slate-100 transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  stageDone[st.id] ? 'bg-emerald-400' : 'bg-slate-700'
                }`}
              />
              <span>{st.short}</span>
            </button>
          ))}

          <div className="ml-auto flex items-center space-x-2 text-[11px] font-mono text-slate-400">
            <span>Score:</span>
            <span className={`font-bold ${accentText}`}>
              {score > 0 ? `${score}/10` : 'Unscored'}
            </span>
          </div>
        </div>

        {/* INLINE CUSTOMIZATION DRAWER (Progressive disclosure — zero clutter when closed) */}
        {showCustomize && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-700 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="font-extrabold text-sm text-slate-100">
                  Customize {isQuarterly ? 'Quarterly' : 'Yearly'} Review
                </div>
                <p className="text-[11px] text-slate-400">
                  Show/hide stages, customize your Life Pillars, rename questions, or add custom reflection prompts. Synced across devices.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomize(false)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
              >
                Done
              </button>
            </div>

            {/* 1. Toggle Stages */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Visible Stages
              </span>
              <div className="flex flex-wrap gap-2">
                {STAGE_META.map(st => {
                  const active = isStageVisible(st.id);
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => toggleStageVisibility(st.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                        active
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
                      }`}
                    >
                      {active ? '✓ ' : ''}{st.full}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Manage Custom Life Pillars */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                  Custom Life Pillars ({lifePillars.length}) — Shared across Quarterly &amp; Yearly
                </span>
                <button
                  type="button"
                  onClick={() => saveLifePillars(INITIAL_LIFE_PILLARS)}
                  className="inline-flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-200 font-semibold"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Defaults</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {lifePillars.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800"
                  >
                    <input
                      type="text"
                      value={p.name}
                      onChange={e =>
                        saveLifePillars(
                          lifePillars.map(item =>
                            item.id === p.id ? { ...item, name: e.target.value } : item
                          )
                        )
                      }
                      className="sm:w-52 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-bold text-slate-100 focus:outline-none focus:border-amber-500/50"
                      placeholder="Pillar name..."
                    />
                    <input
                      type="text"
                      value={p.description || ''}
                      onChange={e =>
                        saveLifePillars(
                          lifePillars.map(item =>
                            item.id === p.id ? { ...item, description: e.target.value } : item
                          )
                        )
                      }
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 placeholder-slate-600 focus:outline-none"
                      placeholder="Short description (optional)..."
                    />
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMovePillar(idx, -1)}
                        className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                        title="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === lifePillars.length - 1}
                        onClick={() => handleMovePillar(idx, 1)}
                        className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                        title="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => saveLifePillars(lifePillars.filter(item => item.id !== p.id))}
                        className="p-1.5 rounded-lg bg-slate-950 text-slate-500 hover:text-rose-400"
                        title="Delete pillar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddPillar} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newPillarName}
                  onChange={e => setNewPillarName(e.target.value)}
                  placeholder="New pillar name (e.g. Faith, Trading Psychology, Freedom)..."
                  className="sm:w-64 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
                <input
                  type="text"
                  value={newPillarDesc}
                  onChange={e => setNewPillarDesc(e.target.value)}
                  placeholder="Description (optional)..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 placeholder-slate-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newPillarName.trim()}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-300 border border-amber-500/30 font-bold"
                >
                  + Add Pillar
                </button>
              </form>
            </div>

            {/* 3. Custom Prompt Labels + Add Unlimited Custom Questions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Customize Core Question Titles
                </span>
                {[
                  { key: 'effortVsOutcome', def: 'Effort vs. Outcome Diagnosis' },
                  {
                    key: 'assumptions',
                    def: isQuarterly
                      ? 'What belief from 90 days ago did reality disprove?'
                      : 'Capacity & Identity Shift (What is permanently true now?)'
                  },
                  {
                    key: 'mountains',
                    def: isQuarterly
                      ? 'Energy & Mountains — What gave/drained energy? Still the right mountains?'
                      : 'Sunk Costs & Illusions — What are you leaving behind?'
                  },
                  { key: 'wins', def: 'Biggest Wins & Shipped Milestones' },
                  {
                    key: 'thesis',
                    def: isQuarterly
                      ? 'Next Quarter Core Thesis & Strategic Shift'
                      : 'Next Year Singular Focus & Operating Rules'
                  }
                ].map(item => (
                  <input
                    key={item.key}
                    type="text"
                    value={macroReviewSettings.customPromptLabels?.[`${mode}:${item.key}`] ?? item.def}
                    onChange={e => setPromptLabel(item.key, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500/50"
                  />
                ))}
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 block">
                  Extra Custom {isQuarterly ? 'Quarterly' : 'Yearly'} Questions ({modeCustomPrompts.length})
                </span>
                {modeCustomPrompts.map(cp => (
                  <div key={cp.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={cp.title}
                      onChange={e =>
                        saveCustomReviewPrompts(
                          customReviewPrompts.map(p =>
                            p.id === cp.id ? { ...p, title: e.target.value } : p
                          )
                        )
                      }
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        saveCustomReviewPrompts(customReviewPrompts.filter(p => p.id !== cp.id))
                      }
                      className="p-1.5 rounded-lg bg-slate-900 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <form onSubmit={handleAddCustomPrompt} className="flex gap-2">
                  <input
                    type="text"
                    value={newPromptTitle}
                    onChange={e => setNewPromptTitle(e.target.value)}
                    placeholder={`Add custom ${isQuarterly ? 'quarterly' : 'yearly'} question...`}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newPromptTitle.trim()}
                    className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-40 text-cyan-300 border border-cyan-500/30 font-bold"
                  >
                    + Add
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* STAGE 1: PAST COMMITMENTS & REAL-WORLD REALITY                   */}
      {/* ================================================================ */}
      {isStageVisible(1) && (
        <section
          id={`macro_stage_${mode}_1`}
          className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 scroll-mt-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border ${accentBadge}`}>
                Stage 1 of 5 · Reality vs. Plan
              </span>
              <h2 className="text-xl font-extrabold text-slate-100 mt-2">
                What Actually Changed in Real Life?
              </h2>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab('planning');
                setPlanningSubTab(isQuarterly ? 'quarterly' : 'yearly');
              }}
              className="self-start sm:self-center inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 transition-colors"
            >
              <span>Open {isQuarterly ? 'Quarterly' : 'Yearly'} Plan</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 1A. Accountability Check on Last Period's Promise */}
          {prevSavedReview?.courseCorrections?.trim() && (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Promise vs. Proof · Your Commitment from {prevPeriodKey}</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PROMISE_VERDICTS.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onUpsertReview(periodKey, { prevPromiseVerdict: v.id })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                        prevPromiseVerdict === v.id
                          ? v.activeCls
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap pl-3 border-l-2 border-amber-500/40">
                "{prevSavedReview.courseCorrections.trim()}"
              </p>
              <input
                type="text"
                value={prevPromiseNote}
                onChange={e => onUpsertReview(periodKey, { prevPromiseNote: e.target.value })}
                placeholder="Honest verdict: what actually happened with this commitment?"
                className="w-full bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/40"
              />
            </div>
          )}

          {/* 1A-bis. Current Period Top 3 Focuses (Mirrored from Plan) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <TopFocusesEditor
              focuses={currentPlan.topFocuses}
              onChange={next => saveCurrentPlan({ topFocuses: next })}
              accent={accent}
              title={`Top 3 Focuses • ${periodKey}`}
              subtitle="Mirrored directly from your Plan — audit your outcomes below against these 3 focuses."
            />
          </div>

          {/* 1B. Contract Outcomes Audit (Full untruncated list) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                  {isQuarterly ? 'Quarterly' : 'Yearly'} Contract Audit ({currentPlan.tasks.filter(t => t.completed).length}/{currentPlan.tasks.length} done)
                </span>
                {currentPlan.focusTheme.trim() && (
                  <p className="text-xs text-amber-400 font-semibold mt-0.5">
                    Focus: {currentPlan.focusTheme.trim()}
                  </p>
                )}
              </div>
            </div>

            {currentPlan.tasks.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-950 border border-dashed border-slate-800 text-xs text-slate-400">
                No {isQuarterly ? 'Quarterly' : 'Yearly'} outcomes were defined for {periodKey} yet. Add the core outcomes you were aiming for below so you can audit them honestly.
              </div>
            ) : (
              <div className="space-y-2.5">
                {currentPlan.tasks.map(task => {
                  const audit = outcomeAudits[task.id] || {};
                  const showNote = expandedOutcomeNotes[task.id] || Boolean(audit.note?.trim());
                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-2xl border space-y-2.5 transition-colors ${
                        audit.verdict === 'hit' || task.completed
                          ? 'bg-emerald-500/5 border-emerald-500/25'
                          : audit.verdict === 'missed'
                          ? 'bg-rose-500/5 border-rose-500/25'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="flex items-start space-x-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggleOutcomeComplete(task.id)}
                            className="shrink-0 mt-0.5"
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-500 hover:text-slate-300" />
                            )}
                          </button>
                          <span className={`text-xs sm:text-sm font-semibold leading-snug ${task.completed ? 'text-emerald-200' : 'text-slate-100'}`}>
                            {task.text}
                          </span>
                        </div>

                        {/* Verdict Pills + Root Cause Selector */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {OUTCOME_VERDICTS.map(v => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => updateOutcomeAudit(task.id, { verdict: v.id })}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                audit.verdict === v.id
                                  ? v.activeCls
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                              }`}
                            >
                              {v.label}
                            </button>
                          ))}

                          {audit.verdict && audit.verdict !== 'hit' && (
                            <select
                              value={audit.rootCause || ''}
                              onChange={e =>
                                updateOutcomeAudit(task.id, {
                                  rootCause: (e.target.value || undefined) as OutcomeRootCause | undefined
                                })
                              }
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-semibold text-amber-300 focus:outline-none"
                            >
                              <option value="">Why? (Cause)</option>
                              {OUTCOME_CAUSES.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          )}

                          {!showNote && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedOutcomeNotes(prev => ({ ...prev, [task.id]: true }))
                              }
                              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-400 border border-slate-800"
                            >
                              + Note
                            </button>
                          )}
                        </div>
                      </div>

                      {showNote && (
                        <input
                          type="text"
                          value={audit.note || ''}
                          onChange={e => updateOutcomeAudit(task.id, { note: e.target.value })}
                          placeholder="Why did this succeed, stall, or shift?"
                          className="w-full bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <form
              onSubmit={handleAddOutcomeHere}
              className="flex items-center space-x-2 p-2.5 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800"
            >
              <Plus className="w-4 h-4 text-slate-500 shrink-0 ml-1" />
              <input
                type="text"
                value={newOutcomeText}
                onChange={e => setNewOutcomeText(e.target.value)}
                placeholder={`Add an outcome to ${periodKey} Plan & audit it right here...`}
                className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newOutcomeText.trim()}
                className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 text-xs font-bold"
              >
                + Add
              </button>
            </form>
          </div>

          {/* 1C. Real-World Scoreboard (Start -> Target -> Actual) */}
          <div className="pt-4 border-t border-slate-800/80">
            <ScoreboardEditor
              metrics={currentPlan.scoreboard || []}
              onChange={next => saveCurrentPlan({ scoreboard: next })}
              showActual={true}
              accent={accent}
              headerAction={
                !isQuarterly ? (
                  <button
                    type="button"
                    onClick={handlePullYearlyScoreboardFromQuarters}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition-colors"
                  >
                    Pull Q1 Start → Q4 Actual
                  </button>
                ) : undefined
              }
            />
            {carryNotice && (
              <p className="text-xs font-semibold text-emerald-400 mt-2">{carryNotice}</p>
            )}
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* STAGE 2: EFFORT, TRAJECTORY & HABIT DURABILITY                   */}
      {/* ================================================================ */}
      {isStageVisible(2) && (
        <section
          id={`macro_stage_${mode}_2`}
          className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 scroll-mt-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border ${accentBadge}`}>
                Stage 2 of 5 · Inputs &amp; Trajectory
              </span>
              <h2 className="text-xl font-extrabold text-slate-100 mt-2">
                {isQuarterly ? 'Month-by-Month Trajectory (M1 → M2 → M3)' : '4-Quarter Arc (Q1 → Q2 → Q3 → Q4)'}
              </h2>
            </div>

            {trajectoryTrend !== 'none' && (
              <span
                className={`self-start sm:self-center inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  trajectoryTrend === 'up'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : trajectoryTrend === 'down'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {trajectoryTrend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
                {trajectoryTrend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
                {trajectoryTrend === 'flat' && <Minus className="w-3.5 h-3.5" />}
                <span>
                  {trajectoryTrend === 'up'
                    ? 'Accelerating'
                    : trajectoryTrend === 'down'
                    ? 'Slipping'
                    : 'Steady'}
                </span>
              </span>
            )}
          </div>

          {/* 2A. Trajectory Table (Full detail, direction visible at a glance) */}
          <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-x-auto">
            {isQuarterly && quarterData ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Metric</th>
                    {quarterData.monthsData.map(m => (
                      <th key={m.info.monthKey} className="py-3 px-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-purple-300">{m.info.label}</span>
                          <button
                            type="button"
                            onClick={() => onOpenMonth(m.info.monthKey)}
                            className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100"
                            title={`Open ${m.info.label} Review`}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="py-3 px-4 text-cyan-400 bg-slate-900/60">Quarter Total / Avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-300">Monthly Review Score</td>
                    {quarterData.monthsData.map(m => (
                      <td key={m.info.monthKey} className="py-2.5 px-4 text-purple-300 font-bold">
                        {m.saved?.score ? `${m.saved.score}/10` : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-cyan-300 font-bold bg-slate-900/60">
                      {score > 0 ? `${score}/10` : 'Unscored'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-300">Weekly Avg (Points)</td>
                    {quarterData.monthsData.map(m => (
                      <td key={m.info.monthKey} className="py-2.5 px-4 text-amber-300">
                        {m.weeks.length > 0 ? `${m.avgWeeklyScore}/10 (${m.weeks.length}w)` : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-amber-300 font-bold bg-slate-900/60">
                      {quarterData.avgWeeklyScore}/10 ({quarterData.weeklyPointsAchieved}/{quarterData.weeklyPointsPossible} pts)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-300">Daily Discipline</td>
                    {quarterData.monthsData.map(m => (
                      <td key={m.info.monthKey} className="py-2.5 px-4 text-blue-300">
                        {m.days.length > 0 ? `${m.avgDailyScore}/10 (${m.days.length}d)` : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-blue-300 font-bold bg-slate-900/60">
                      {quarterData.avgDailyScore}/10 ({quarterData.days.length}d)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-300">Daily Habits Locked</td>
                    {quarterData.monthsData.map(m => (
                      <td key={m.info.monthKey} className="py-2.5 px-4 text-slate-200">
                        {m.days.length > 0 ? `${m.habitRatePct}%` : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-slate-100 font-bold bg-slate-900/60">
                      {quarterData.habitRatePct}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-300">GWS Deep Work</td>
                    {quarterData.monthsData.map(m => (
                      <td key={m.info.monthKey} className="py-2.5 px-4 text-emerald-300">
                        {m.gws.length > 0 ? `${m.gwsHours}h (${m.gws.length})` : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-emerald-300 font-bold bg-slate-900/60">
                      {quarterData.gwsHours}h ({quarterData.gws.length} sprints · {quarterData.avgGwsTotal}/15)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-300">Monthly Plan Goals</td>
                    {quarterData.monthsData.map(m => (
                      <td key={m.info.monthKey} className="py-2.5 px-4 text-slate-300">
                        {m.totalMonthGoals > 0 ? `${m.completedMonthGoals}/${m.totalMonthGoals}` : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-slate-200 font-bold bg-slate-900/60">
                      {quarterData.monthsData.reduce((s, m) => s + m.completedMonthGoals, 0)}/
                      {quarterData.monthsData.reduce((s, m) => s + m.totalMonthGoals, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : yearData ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Metric</th>
                    {yearData.quartersData.map(q => (
                      <th key={q.info.quarterKey} className="py-3 px-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-cyan-300">Q{q.info.qNum}</span>
                          <button
                            type="button"
                            onClick={() => onOpenQuarter(q.info.quarterKey)}
                            className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100"
                            title={`Open ${q.info.quarterKey} Review`}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="py-3 px-4 text-rose-400 bg-slate-900/60">Full Year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-300">Quarter Score</td>
                    {yearData.quartersData.map(q => (
                      <td key={q.info.quarterKey} className="py-2.5 px-4 text-cyan-300 font-bold">
                        {q.saved?.score ? `${q.saved.score}/10` : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-rose-300 font-bold bg-slate-900/60">
                      {score > 0 ? `${score}/10` : 'Unscored'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-300">Weekly Avg</td>
                    {yearData.quartersData.map(q => (
                      <td key={q.info.quarterKey} className="py-2.5 px-4 text-amber-300">
                        {q.weeks.length > 0 ? `${q.avgWeeklyScore}/10 (${q.weeks.length}w)` : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-amber-300 font-bold bg-slate-900/60">
                      {yearData.avgWeeklyScore}/10 ({yearData.weeks.length}w)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-300">Daily Discipline</td>
                    {yearData.quartersData.map(q => (
                      <td key={q.info.quarterKey} className="py-2.5 px-4 text-blue-300">
                        {q.days.length > 0 ? `${q.avgDailyScore}/10 (${q.days.length}d)` : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-blue-300 font-bold bg-slate-900/60">
                      {yearData.avgDailyScore}/10 ({yearData.days.length}d)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-300">Habits Locked</td>
                    {yearData.quartersData.map(q => (
                      <td key={q.info.quarterKey} className="py-2.5 px-4 text-slate-200">
                        {q.days.length > 0 ? `${q.habitRatePct}%` : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-slate-100 font-bold bg-slate-900/60">
                      {yearData.habitRatePct}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-300">GWS Deep Work</td>
                    {yearData.quartersData.map(q => (
                      <td key={q.info.quarterKey} className="py-2.5 px-4 text-emerald-300">
                        {q.gws.length > 0 ? `${q.gwsHours}h (${q.gws.length})` : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-emerald-300 font-bold bg-slate-900/60">
                      {yearData.gwsHours}h ({yearData.gws.length} sprints)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-300">Quarter Verdict</td>
                    {yearData.quartersData.map(q => (
                      <td key={q.info.quarterKey} className="py-2.5 px-4 font-sans text-[11px] text-slate-300 max-w-[180px]">
                        {q.saved?.headline?.trim() || q.saved?.wins?.trim().slice(0, 60) || '—'}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 font-sans text-[11px] text-rose-200 bg-slate-900/60">
                      {headline.trim() || '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : null}
          </div>

          {/* 2B. Individual Habit Durability & Reps Volume */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Habit Durability ({habitRows.length})</span>
                </span>
                {habitRows.length > 0 && (
                  <span className="font-mono text-[11px] font-bold text-slate-300">
                    Avg {avgHabitDurability}%
                  </span>
                )}
              </div>

              {habitRows.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No daily, weekly, or monthly checklist habits tracked during this period yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {visibleHabitRows.map(h => {
                    const barCls =
                      h.pct >= 80
                        ? 'bg-emerald-500'
                        : h.pct >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500';
                    const txtCls =
                      h.pct >= 80
                        ? 'text-emerald-300'
                        : h.pct >= 50
                        ? 'text-amber-300'
                        : 'text-rose-300';
                    return (
                      <div key={h.id} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-slate-200 truncate">{h.text}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] uppercase font-bold text-slate-500 shrink-0">
                              {h.recurrence}
                            </span>
                          </div>
                          <span className={`font-mono text-[11px] font-bold shrink-0 ${txtCls}`}>
                            {h.pct}% <span className="text-slate-500 font-normal">({h.done}/{h.expected})</span>
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                          <div className={`h-full rounded-full ${barCls}`} style={{ width: `${h.pct}%` }} />
                        </div>
                      </div>
                    );
                  })}

                  {habitRows.length > 8 && (
                    <button
                      type="button"
                      onClick={() => setShowAllHabits(v => !v)}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-200 pt-1"
                    >
                      {showAllHabits ? 'Show Top 8 ↑' : `Show all ${habitRows.length} habits ↓`}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400 flex items-center space-x-1.5">
                  <Target className="w-3.5 h-3.5" />
                  <span>Reps Board Volume ({repsRows.length})</span>
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  {repsRows.reduce((s, r) => s + r.repsInPeriod, 0)} reps in period
                </span>
              </div>

              {repsRows.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No Reps Board volume logged yet. Reps from Checklist → Reps Board appear here automatically.
                </p>
              ) : (
                <div className="space-y-2">
                  {repsRows.map(r => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs"
                    >
                      <span className="text-slate-200 font-medium truncate">{r.text}</span>
                      <div className="flex items-center space-x-2 font-mono text-[11px] shrink-0">
                        <span className="text-cyan-300 font-bold">
                          +{r.repsInPeriod} reps
                          {r.volumeInPeriod !== undefined ? ` (${r.volumeInPeriod} ${r.volumeUnit})` : ''}
                        </span>
                        <span className="text-slate-500">· {r.lifetimeReps} total</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2B-bis. Deep Work Time Allocation vs. Top 3 Focuses */}
          <GwsAllocationCard
            allocation={gwsAllocation}
            title={`Deep Work Time Allocation vs. Top Focuses (${periodKey})`}
          />

          {/* 2C. Effort vs. Outcome Diagnosis */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
              {getPromptLabel('effortVsOutcome', 'Effort vs. Outcome Diagnosis')}
            </label>
            <textarea
              value={effortVsOutcomeNote}
              onChange={e => onUpsertReview(periodKey, { effortVsOutcomeNote: e.target.value })}
              rows={3}
              placeholder="Compare Stage 2 (inputs, habits, hours) against Stage 1 (real-world results). Where did high effort yield low outcome (wrong strategy/leverage) vs. low effort (discipline/friction)?"
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed"
            />
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* STAGE 3: ROADMAPS (DOMAIN-BY-DOMAIN) & SYSTEMIC BOTTLENECKS      */}
      {/* ================================================================ */}
      {isStageVisible(3) && (
        <section
          id={`macro_stage_${mode}_3`}
          className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 scroll-mt-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border ${accentBadge}`}>
                Stage 3 of 5 · Strategy &amp; Bottlenecks
              </span>
              <h2 className="text-xl font-extrabold text-slate-100 mt-2">
                Stage-Gate Roadmaps &amp; Systemic Problems
              </h2>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab('planning');
                setPlanningSubTab('roadmaps');
              }}
              className="self-start sm:self-center inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-emerald-300 transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Open Roadmaps</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* 3A. Domain-by-Domain Written Roadmaps Audit (Full width, interactive) */}
          {strategyPlans.length === 0 ? (
            <div className="p-5 rounded-2xl bg-slate-950 border border-dashed border-slate-800 text-xs text-slate-400">
              No Written Stage-Gate Roadmaps created yet. Create them in Planning Hub → Roadmaps to audit stage progression here.
            </div>
          ) : (
            <div className="space-y-4">
              {strategyPlans.map(sp => {
                const passedStages = sp.stages.filter(s => s.gatePassed);
                const passedInPeriod = passedStages.filter(
                  s => s.gatePassedAt && s.gatePassedAt >= startDate && s.gatePassedAt <= endDate
                );
                const activeIdx = sp.stages.findIndex(s => !s.gatePassed);
                const activeStage = activeIdx >= 0 ? sp.stages[activeIdx] : null;
                const lockedAhead = activeIdx >= 0 ? Math.max(0, sp.stages.length - activeIdx - 1) : 0;
                const pct = sp.stages.length > 0 ? Math.round((passedStages.length / sp.stages.length) * 100) : 0;
                const isTargetedThisPeriod = (currentPlan.targetGateRefs || []).some(
                  r => r.planId === sp.id
                );
                const domainProblems = getProblemsForRoadmapInRange(problems, sp.title, startDate, endDate);
                const audit = roadmapAudits[sp.id] || {};

                return (
                  <div
                    key={sp.id}
                    className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4"
                  >
                    {/* Roadmap Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-extrabold text-slate-100">{sp.title}</h3>
                          <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] font-bold text-amber-300">
                            {passedStages.length}/{sp.stages.length} gates passed
                          </span>
                          {passedInPeriod.length > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-bold">
                              +{passedInPeriod.length} passed this {isQuarterly ? 'quarter' : 'year'}
                            </span>
                          )}
                          {isTargetedThisPeriod && (
                            <span className="px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                              Target Gate
                            </span>
                          )}
                        </div>
                        <div className="w-64 max-w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Per-Roadmap Strategic Verdict */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {ROADMAP_VERDICTS.map(v => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() =>
                              onUpsertReview(periodKey, {
                                roadmapAudits: {
                                  ...roadmapAudits,
                                  [sp.id]: { ...audit, verdict: v.id }
                                }
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                              audit.verdict === v.id
                                ? v.activeCls
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                            }`}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Active Stage Full Proximal Goals + Gate Criterion */}
                    {activeStage ? (
                      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                            <span className="text-sm font-extrabold text-amber-300">
                              Active: {activeStage.title}
                            </span>
                            {activeStage.systemState && (
                              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-400">
                                {activeStage.systemState}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleStageGate(sp.id, activeStage.id)}
                            className="self-start sm:self-center inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 text-[11px] font-bold transition-colors"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Mark Gate Passed</span>
                          </button>
                        </div>

                        {activeStage.gateCriterion.trim() && (
                          <div className="text-xs text-slate-200 bg-slate-950/90 border border-amber-500/25 rounded-xl px-3 py-2">
                            <strong className="text-amber-400 uppercase text-[10px] tracking-wider mr-2">
                              Gate Proof:
                            </strong>
                            {activeStage.gateCriterion.trim()}
                          </div>
                        )}

                        {activeStage.proximalGoals.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              Proximal Goals ({activeStage.proximalGoals.filter(g => g.completed).length}/{activeStage.proximalGoals.length})
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                              {activeStage.proximalGoals.map(pg => (
                                <button
                                  key={pg.id}
                                  type="button"
                                  onClick={() => handleToggleProximalGoal(sp.id, activeStage.id, pg.id)}
                                  className={`flex items-start space-x-2 p-2 rounded-xl border text-left text-xs transition-colors ${
                                    pg.completed
                                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
                                      : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
                                  }`}
                                >
                                  {pg.completed ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                  ) : (
                                    <Circle className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                                  )}
                                  <span className={pg.completed ? 'line-through text-slate-400' : ''}>
                                    {pg.text}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {lockedAhead > 0 && (
                          <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                            <Lock className="w-3 h-3" />
                            <span>
                              +{lockedAhead} sealed {lockedAhead === 1 ? 'stage' : 'stages'} unlocked after this Gate
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-300">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>All stages unlocked &amp; gates passed in this Roadmap.</span>
                      </div>
                    )}

                    {/* Domain-Matched Problems Strip */}
                    {domainProblems.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="font-extrabold uppercase tracking-wider text-[10px] text-orange-400 mr-1">
                          Tagged Problems ({domainProblems.length}):
                        </span>
                        {domainProblems.slice(0, 5).map(dp => (
                          <span
                            key={dp.id}
                            className={`px-2 py-0.5 rounded-lg border ${
                              dp.status === 'solved'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 line-through'
                                : 'bg-orange-500/10 text-orange-200 border-orange-500/30'
                            }`}
                          >
                            {dp.title} ({dp.occurrences.length}×)
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Single True Constraint Diagnosis */}
                    <input
                      type="text"
                      value={audit.constraintNote || ''}
                      onChange={e =>
                        onUpsertReview(periodKey, {
                          roadmapAudits: {
                            ...roadmapAudits,
                            [sp.id]: { ...audit, constraintNote: e.target.value }
                          }
                        })
                      }
                      placeholder={`Single true constraint blocking "${sp.title}" right now — is the stage model still valid?`}
                      className="w-full bg-slate-900/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/40"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* 3B. Top 3 Constraints + Systemic Bottlenecks Highlight + Full ProblemLoggerPanel */}
          <div className="space-y-4 pt-3 border-t border-slate-800/80">
            {problems.some(p => p.isTopConstraint && p.status !== 'solved') && (
              <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/25 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-rose-400 flex items-center space-x-1.5">
                    <Flame className="w-3.5 h-3.5" />
                    <span>Active Top 3 Constraints (Pinned in Problem Log)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setReviewSubTab('problems')}
                    className="inline-flex items-center space-x-1 text-[11px] font-bold text-rose-300 hover:text-rose-200"
                  >
                    <span>Manage in Problem Log</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {problems
                    .filter(p => p.isTopConstraint && p.status !== 'solved')
                    .slice(0, 5)
                    .map((c, idx) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-extrabold text-rose-300">
                            #{idx + 1} · {c.occurrences.length}×
                          </span>
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            {c.status}
                          </span>
                        </div>
                        <div className="font-bold text-slate-100 leading-snug">{c.title}</div>
                        {c.fixNote?.trim() && (
                          <div className="text-[11px] text-emerald-300 truncate">
                            → {c.fixNote.trim()}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {systemicProblems.length > 0 && (
              <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-orange-400 flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      {isQuarterly
                        ? `Systemic & Recurring Bottlenecks (${systemicProblems.length} survived 2+ hits or escalated)`
                        : `Chronic Annual Patterns (${systemicProblems.length} persisted across multiple quarters)`}
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {systemicProblems.map(({ problem, occurrencesInRange, distinctQuartersInRange }) => (
                    <div
                      key={problem.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs"
                    >
                      <div className="min-w-0">
                        <span className={`font-semibold ${problem.status === 'solved' ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                          {problem.title}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {problem.scale || 'friction'} · {problem.category} · {occurrencesInRange}× in period
                          {!isQuarterly && distinctQuartersInRange > 1 ? ` across ${distinctQuartersInRange}Q` : ''}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase shrink-0 ${
                          problem.status === 'solved'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : problem.status === 'testing'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {problem.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ProblemLoggerPanel
              mode="review"
              title={`Full ${isQuarterly ? 'Quarter' : 'Year'} Problem Ledger (${startDate} → ${endDate})`}
              subtitle="Audit recurring bottlenecks, cluster related friction, or dispatch structural fixes straight to next week/checklist."
              sourceType={isQuarterly ? 'quarterly' : 'yearly'}
              date={endDate}
              sourceRef={periodKey}
              dateRange={{ startDate, endDate }}
              targetWeekId={selectedWeekId}
            />
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* STAGE 4: CUSTOM LIFE PILLARS & DOUBLE-LOOP FRAME CHECK           */}
      {/* ================================================================ */}
      {isStageVisible(4) && (
        <section
          id={`macro_stage_${mode}_4`}
          className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 scroll-mt-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border ${accentBadge}`}>
                Stage 4 of 5 · Whole-Life &amp; Frame Validity
              </span>
              <h2 className="text-xl font-extrabold text-slate-100 mt-2">
                Custom Life Pillars &amp; Are You Climbing the Right Mountains?
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setShowCustomize(true)}
              className="self-start sm:self-center inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-amber-300 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Edit Pillars &amp; Questions</span>
            </button>
          </div>

          {/* 4A. Custom Life Pillars Grid with Delta vs. Previous Period */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lifePillars.map(pillar => {
              const cur = pillarAudits[pillar.id] || {};
              const prevScore = prevSavedReview?.pillarAudits?.[pillar.id]?.score;
              const delta =
                cur.score && prevScore ? cur.score - prevScore : null;

              return (
                <div
                  key={pillar.id}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm text-slate-100">{pillar.name}</div>
                      {pillar.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{pillar.description}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0 font-mono text-xs">
                      <span className={`font-bold ${cur.score ? accentText : 'text-slate-500'}`}>
                        {cur.score ? `${cur.score}/10` : '—'}
                      </span>
                      {delta !== null && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            delta > 0
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : delta < 0
                              ? 'bg-rose-500/15 text-rose-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {delta > 0 ? `+${delta} ↗` : delta < 0 ? `${delta} ↘` : `= ${prevPeriodKey}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-10 gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(sc => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() =>
                          onUpsertReview(periodKey, {
                            pillarAudits: {
                              ...pillarAudits,
                              [pillar.id]: { ...cur, score: sc }
                            }
                          })
                        }
                        className={`py-1 rounded-lg text-[11px] font-bold font-mono transition-all ${
                          cur.score === sc
                            ? accentPillActive
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {sc}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={cur.note || ''}
                    onChange={e =>
                      onUpsertReview(periodKey, {
                        pillarAudits: {
                          ...pillarAudits,
                          [pillar.id]: { ...cur, note: e.target.value }
                        }
                      })
                    }
                    placeholder={`1-line reality check on ${pillar.name}...`}
                    className="w-full bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600"
                  />
                </div>
              );
            })}
          </div>

          {/* 4B. Double-Loop Frame Prompts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 block">
                {getPromptLabel(
                  'assumptions',
                  isQuarterly
                    ? 'What belief from 90 days ago did reality disprove?'
                    : 'Capacity & Identity Shift (What is permanently true now?)'
                )}
              </label>
              <textarea
                value={assumptionsDisproved}
                onChange={e => onUpsertReview(periodKey, { assumptionsDisproved: e.target.value })}
                rows={4}
                placeholder={
                  isQuarterly
                    ? 'Which assumption about your strategy, market, schedule, or habits turned out false?'
                    : 'What skills, assets, standards, or capabilities exist today that did not exist 12 months ago?'
                }
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                {getPromptLabel(
                  'mountains',
                  isQuarterly
                    ? 'Energy & Mountains — What gave/drained energy? Still the right mountains?'
                    : 'Sunk Costs & Illusions — What are you leaving behind?'
                )}
              </label>
              <textarea
                value={energyAndMountainNote}
                onChange={e => onUpsertReview(periodKey, { energyAndMountainNote: e.target.value })}
                rows={4}
                placeholder={
                  isQuarterly
                    ? 'What energized you vs. secretly drained you? Are you stalling anywhere because the goal itself no longer fits?'
                    : 'Which projects, habits, or beliefs consumed energy without real return and need to be dropped?'
                }
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed"
              />
            </div>
          </div>

          {/* 4C. User's Custom Reflection Questions */}
          {modeCustomPrompts.length > 0 && (
            <div className="space-y-4 pt-3 border-t border-slate-800/80">
              {modeCustomPrompts.map(cp => (
                <div key={cp.id} className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-purple-300 block">
                    {cp.title}
                  </label>
                  <textarea
                    value={customAnswers[cp.id] || ''}
                    onChange={e =>
                      onUpsertReview(periodKey, {
                        customAnswers: {
                          ...customAnswers,
                          [cp.id]: e.target.value
                        }
                      })
                    }
                    rows={3}
                    placeholder={cp.placeholder || 'Write your reflection...'}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500/50 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed"
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ================================================================ */}
      {/* STAGE 5: CLOSE THE LOOP — DESIGN NEXT PERIOD                     */}
      {/* ================================================================ */}
      {isStageVisible(5) && (
        <section
          id={`macro_stage_${mode}_5`}
          className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 scroll-mt-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <span className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border ${accentBadge}`}>
                Stage 5 of 5 · Close the Loop
              </span>
              <h2 className="text-xl font-extrabold text-slate-100 mt-2">
                Verdict &amp; Architect {nextPeriodLabel}
              </h2>
            </div>

            {/* Overall Period Score 1-10 */}
            <div className="space-y-1.5 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider ${accentText}`}>
                  Overall {isQuarterly ? 'Quarter' : 'Year'} Score
                </span>
                <span className={`text-xs font-mono font-bold ${accentText}`}>
                  {score > 0 ? `${score}/10` : 'Unscored'}
                </span>
              </div>
              <div className="grid grid-cols-10 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(sc => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => onUpsertReview(periodKey, { score: sc })}
                    className={`w-7 py-1 rounded-lg text-[11px] font-bold font-mono transition-all ${
                      score === sc
                        ? accentPillActive
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {sc}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5A. Headline / Verdict + Wins + Next Period Thesis */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={`text-xs font-bold uppercase tracking-wider block ${accentText}`}>
                {isQuarterly ? '1-Line Quarter Verdict / Headline' : 'Year Chapter Title / Headline'}
              </label>
              <input
                type="text"
                value={headline}
                onChange={e => onUpsertReview(periodKey, { headline: e.target.value })}
                placeholder={
                  isQuarterly
                    ? "Summarize these 90 days in one honest line (e.g. 'Built the engine, now ship distribution')..."
                    : "Name this chapter of your life (e.g. 'The Year Systems Replaced Willpower')..."
                }
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl px-4 py-3 text-sm font-bold text-slate-100 placeholder-slate-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                  {getPromptLabel('wins', 'Biggest Wins & Shipped Milestones')}
                </label>
                <textarea
                  value={wins}
                  onChange={e => onUpsertReview(periodKey, { wins: e.target.value })}
                  rows={4}
                  placeholder="Concrete deliverables, breakthroughs, and proudest executions..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                  {getPromptLabel(
                    'thesis',
                    isQuarterly
                      ? 'Next Quarter Core Thesis & Strategic Shift'
                      : 'Next Year Singular Focus & Operating Rules'
                  )}
                </label>
                <textarea
                  value={courseCorrections}
                  onChange={e => onUpsertReview(periodKey, { courseCorrections: e.target.value })}
                  rows={4}
                  placeholder={`What concrete shift defines ${nextPeriodLabel}? (This becomes your Promise vs. Proof check next review!)`}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* 5B. Direct Loop-Closing Mutations into Next Period Plan & Checklist */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-4 border-t border-slate-800/80">
            {/* Direct Write to Next Quarter / Next Year Plan */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-extrabold uppercase tracking-wider flex items-center space-x-1.5 ${accentText}`}>
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Direct Write → {nextPeriodLabel} Plan</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('planning');
                    setPlanningSubTab(isQuarterly ? 'quarterly' : 'yearly');
                  }}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-100"
                >
                  Open Plan →
                </button>
              </div>

              <input
                type="text"
                value={nextPlan.focusTheme}
                onChange={e => saveNextPlan({ focusTheme: e.target.value })}
                placeholder={`Set ${nextPeriodLabel} Focus Theme...`}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/40"
              />

              <TopFocusesEditor
                compact
                focuses={nextPlan.topFocuses}
                onChange={next => saveNextPlan({ topFocuses: next })}
                accent={accent}
                title={`Top 3 Focuses • ${nextPeriodLabel}`}
              />

              {nextPlan.tasks.length > 0 && (
                <div className="space-y-1">
                  {nextPlan.tasks.map(t => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-900/70 border border-slate-800/80 text-xs text-slate-200"
                    >
                      <span className="truncate">• {t.text}</span>
                      <button
                        type="button"
                        onClick={() =>
                          saveNextPlan({ tasks: nextPlan.tasks.filter(item => item.id !== t.id) })
                        }
                        className="text-slate-600 hover:text-rose-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddNextPeriodOutcome} className="flex gap-2">
                <input
                  type="text"
                  value={nextOutcomeDraft}
                  onChange={e => setNextOutcomeDraft(e.target.value)}
                  placeholder={`Commit an outcome to ${nextPeriodLabel}...`}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!nextOutcomeDraft.trim()}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 text-xs font-bold"
                >
                  + Commit
                </button>
              </form>

              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleCarryOverScoreboardToNext}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-colors"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Carry Over Scoreboard to {nextPeriodLabel} (Actual → Start)</span>
                </button>
              </div>
              {carryNotice && <p className="text-[11px] font-semibold text-emerald-400">{carryNotice}</p>}
            </div>

            {/* Dispatch Rule / Habit straight to Checklist */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Turn a Lesson into a Live Checklist Habit</span>
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Don&apos;t leave structural fixes as text — install a new daily, weekly, or monthly habit/guardrail directly into your Checklist.
                </p>

                <form onSubmit={handleDispatchHabitToChecklist} className="space-y-2.5">
                  <input
                    type="text"
                    value={newHabitText}
                    onChange={e => setNewHabitText(e.target.value)}
                    placeholder="e.g. Pre-market checklist before first trade, Sunday 90-min reset..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={newHabitRecurrence}
                      onChange={e => setNewHabitRecurrence(e.target.value as ChecklistRecurrence)}
                      className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none"
                    >
                      <option value="daily">Daily Habit</option>
                      <option value="weekly">Weekly Recurring</option>
                      <option value="monthly">Monthly Recurring</option>
                      <option value="none">One-Off Task</option>
                    </select>
                    <button
                      type="submit"
                      disabled={!newHabitText.trim()}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-40 text-emerald-300 border border-emerald-500/35 text-xs font-bold transition-colors"
                    >
                      + Install in Checklist
                    </button>
                  </div>
                </form>

                {habitNotice && <p className="text-[11px] font-semibold text-emerald-400">{habitNotice}</p>}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                <span>Autosaved to Review Vault &amp; Cloud Sync</span>
                <button
                  type="button"
                  onClick={onOpenVault}
                  className="text-amber-400 hover:text-amber-300 font-bold"
                >
                  Open Review Vault →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* EXPANDABLE FULL RECEIPTS DRAWER (Collapsed by default, 100% raw) */}
      {/* ================================================================ */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-lg">
        <button
          type="button"
          onClick={() => setShowReceipts(v => !v)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-900 transition-colors"
        >
          <div className="flex items-center space-x-2.5">
            <Layers className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-sm font-extrabold text-slate-200">
                Inspect Underlying Receipts (Full Untruncated Logs)
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                {!isQuarterly ? `${receiptQuarters.length} Quarters · ` : ''}
                {receiptMonths.length} Months · {receiptWeeks.length} Weeks · {receiptDays.length} Days · {receiptGws.length} GWS Sprints
              </div>
            </div>
          </div>
          {showReceipts ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showReceipts && (
          <div className="p-6 pt-2 border-t border-slate-800 space-y-5">
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800 w-fit">
              {!isQuarterly && (
                <button
                  type="button"
                  onClick={() => setReceiptTab('quarters')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    receiptTab === 'quarters' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Quarters ({receiptQuarters.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setReceiptTab('months')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  receiptTab === 'months' ? 'bg-purple-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Months ({receiptMonths.length})
              </button>
              <button
                type="button"
                onClick={() => setReceiptTab('weeks')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  receiptTab === 'weeks' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Weeks ({receiptWeeks.length})
              </button>
              <button
                type="button"
                onClick={() => setReceiptTab('days')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  receiptTab === 'days' ? 'bg-blue-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Days ({receiptDays.length})
              </button>
              <button
                type="button"
                onClick={() => setReceiptTab('gws')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  receiptTab === 'gws' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                GWS ({receiptGws.length})
              </button>
            </div>

            {/* Quarters tab (Yearly only) */}
            {receiptTab === 'quarters' && !isQuarterly && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {receiptQuarters.map(q => (
                  <div key={q.info.quarterKey} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Award className="w-4 h-4 text-cyan-400" />
                        <span className="font-extrabold text-slate-100">{q.info.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenQuarter(q.info.quarterKey)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 font-bold"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                    {q.saved?.headline?.trim() && (
                      <div className="font-semibold text-amber-300">"{q.saved.headline.trim()}"</div>
                    )}
                    {q.saved?.wins?.trim() && (
                      <p className="text-slate-300 whitespace-pre-wrap"><strong className="text-emerald-400">Wins:</strong> {q.saved.wins.trim()}</p>
                    )}
                    {q.saved?.courseCorrections?.trim() && (
                      <p className="text-slate-300 whitespace-pre-wrap"><strong className="text-amber-400">Next Thesis:</strong> {q.saved.courseCorrections.trim()}</p>
                    )}
                    {!q.saved?.wins?.trim() && !q.saved?.courseCorrections?.trim() && (
                      <p className="text-slate-500 italic">Quarter review not written yet.</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Months tab */}
            {receiptTab === 'months' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {receiptMonths.map(m => (
                  <div key={m.info.monthKey} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-purple-300">{m.info.label}</span>
                      <button
                        type="button"
                        onClick={() => onOpenMonth(m.info.monthKey)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {m.weeks.length}w ({m.avgWeeklyScore}/10) · {m.days.length}d · {m.gwsHours}h GWS
                    </div>
                    {m.saved?.wins?.trim() && (
                      <p className="text-slate-300 whitespace-pre-wrap"><strong className="text-emerald-400">Wins:</strong> {m.saved.wins.trim()}</p>
                    )}
                    {m.saved?.blockers?.trim() && (
                      <p className="text-slate-300 whitespace-pre-wrap"><strong className="text-orange-400">Problems:</strong> {m.saved.blockers.trim()}</p>
                    )}
                    {m.saved?.courseCorrections?.trim() && (
                      <p className="text-slate-300 whitespace-pre-wrap"><strong className="text-amber-400">Correction:</strong> {m.saved.courseCorrections.trim()}</p>
                    )}
                    {!m.saved?.wins?.trim() && !m.saved?.blockers?.trim() && !m.saved?.courseCorrections?.trim() && (
                      <p className="text-slate-500 italic">No monthly summary written yet.</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Weeks tab */}
            {receiptTab === 'weeks' && (
              receiptWeeks.length === 0 ? (
                <p className="text-xs text-slate-500">No weekly reviews in this period.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                  {receiptWeeks.map(w => (
                    <div key={w.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-amber-400">
                            Week {w.weekNumber} ({w.startDate} → {w.endDate})
                          </span>
                          <div className="font-bold text-slate-100">{w.focusTheme || 'No theme'}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono font-bold">
                            {computeWeeklyAchievedScore(w.tasks)}/{w.totalPossibleScore}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenWeek(w.id)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {w.winsNotes?.trim() && (
                        <p className="text-slate-300 whitespace-pre-wrap"><strong className="text-emerald-400">Wins:</strong> {w.winsNotes.trim()}</p>
                      )}
                      {(w.courseCorrectionNotes || w.reviewNotes)?.trim() && (
                        <p className="text-slate-300 whitespace-pre-wrap"><strong className="text-amber-400">Correction:</strong> {(w.courseCorrectionNotes || w.reviewNotes)!.trim()}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Days tab */}
            {receiptTab === 'days' && (
              receiptDays.length === 0 ? (
                <p className="text-xs text-slate-500">No daily logs in this period.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {receiptDays.map(d => (
                    <div key={d.date} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-blue-400 flex items-center space-x-1.5">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          <span>{d.date}</span>
                        </span>
                        <span className="font-mono text-[11px] text-amber-300">
                          Tasks {d.mainTasksCompleted}/{d.mainTasksTotal} · Score {d.executionScore}/10
                        </span>
                      </div>
                      {d.reviewNotes?.trim() && (
                        <p className="text-slate-300 whitespace-pre-wrap">{d.reviewNotes.trim()}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* GWS tab */}
            {receiptTab === 'gws' && (
              receiptGws.length === 0 ? (
                <p className="text-xs text-slate-500">No GWS sprints in this period.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {receiptGws.map(s => (
                    <div key={s.id} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-100 flex items-center space-x-1.5 truncate">
                          <Timer className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{s.taskName}</span>
                        </span>
                        <span className="font-mono text-[11px] text-amber-300 shrink-0">
                          {s.date} · {s.actualMinutes}m · {s.ratings.total}/15
                        </span>
                      </div>
                      {s.reflexions.accomplished && (
                        <p className="text-slate-300"><strong className="text-emerald-400">Done:</strong> {s.reflexions.accomplished}</p>
                      )}
                      {s.reflexions.heldBack && (
                        <p className="text-slate-300"><strong className="text-orange-400">Held Back:</strong> {s.reflexions.heldBack}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};
