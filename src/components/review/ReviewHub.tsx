import React, { useState, useEffect } from 'react';
import {
  useStorage,
  ReviewSubTab,
  getCurrentWeekRange,
  getPriorityItemsForEntry,
  formatPriorityItemsToPlanNotes,
  computeWeeklyAchievedScore,
  getActiveDailyChecklistItemsForDate
} from '../../context/StorageContext';
import { WeeklyPlan, ReviewEntry, ProblemCategory } from '../../types/schema';
import { QuickCopyPasteBar } from '../common/QuickCopyPasteBar';
import { ProblemLoggerPanel } from '../problems/ProblemLoggerPanel';
import { ProblemsLedgerView } from '../problems/ProblemsLedgerView';
import {
  formatProblemsForReviewText,
  hasExistingParent,
  problemOccurredInRange,
  problemOccurredOnDate
} from '../../lib/problems';
import { 
  FileText, 
  Timer, 
  Target, 
  TrendingUp, 
  Calendar as CalendarIcon, 
  CheckCircle2,
  Circle, 
  AlertTriangle, 
  Sparkles, 
  Flame, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Gift, 
  Award, 
  BookOpen, 
  Filter, 
  Copy, 
  ExternalLink, 
  Layers, 
  Plus, 
  X, 
  FilePlus,
  Compass,
  Lock,
  Unlock
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const stripSourceTag = (line: string): string =>
  line
    .replace(/^[•\-\s]+/, '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .trim()
    .toLowerCase();

const mergeUniqueLines = (existing: string, incoming: string[]): string => {
  const currentLines = existing
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  const seen = new Set(currentLines.map(stripSourceTag));
  const toAdd: string[] = [];
  incoming.forEach(item => {
    item
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .forEach(sub => {
        const norm = stripSourceTag(sub);
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          toAdd.push(sub);
        }
      });
  });
  return [...currentLines, ...toAdd].join('\n');
};

const dedupeLines = (items: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  items.forEach(item => {
    item
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .forEach(sub => {
        const norm = stripSourceTag(sub);
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          result.push(sub);
        }
      });
  });
  return result;
};

const getMonthInfo = (monthKey: string) => {
  const [yStr, mStr] = monthKey.split('-');
  const year = parseInt(yStr) || 2026;
  const month = Math.min(12, Math.max(1, parseInt(mStr) || 1));
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${year}-${mm}-01`;
  const endDate = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
  const label = `${MONTH_NAMES[month - 1]} ${year}`;
  const quarterNum = Math.ceil(month / 3);
  return {
    monthKey: `${year}-${mm}`,
    year,
    month,
    startDate,
    endDate,
    label,
    quarterKey: `${year}-Q${quarterNum}`
  };
};

const shiftMonthKey = (monthKey: string, delta: number): string => {
  const { year, month } = getMonthInfo(monthKey);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getQuarterInfo = (quarterKey: string) => {
  const [yStr, qPart] = quarterKey.split('-Q');
  const year = parseInt(yStr) || 2026;
  const qNum = Math.min(4, Math.max(1, parseInt(qPart) || 4));
  const startMonth = (qNum - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const months = [
    `${year}-${String(startMonth).padStart(2, '0')}`,
    `${year}-${String(startMonth + 1).padStart(2, '0')}`,
    `${year}-${String(endMonth).padStart(2, '0')}`
  ];
  const firstMonthInfo = getMonthInfo(months[0]);
  const lastMonthInfo = getMonthInfo(months[2]);
  const shortMonths = `${MONTH_NAMES[startMonth - 1].slice(0, 3)} – ${MONTH_NAMES[endMonth - 1].slice(0, 3)} ${year}`;
  return {
    quarterKey: `${year}-Q${qNum}`,
    year,
    qNum,
    months,
    startDate: firstMonthInfo.startDate,
    endDate: lastMonthInfo.endDate,
    label: `Q${qNum} ${year} (${shortMonths})`
  };
};

const shiftQuarterKey = (quarterKey: string, delta: number): string => {
  const { year, qNum } = getQuarterInfo(quarterKey);
  const totalQ = year * 4 + (qNum - 1) + delta;
  const nextYear = Math.floor(totalQ / 4);
  const nextQ = (totalQ % 4) + 1;
  return `${nextYear}-Q${nextQ}`;
};

const getYearInfo = (yearKey: string) => {
  const year = parseInt(yearKey, 10) || 2026;
  const quarters = [1, 2, 3, 4].map(q => `${year}-Q${q}`);
  const months = Array.from({ length: 12 }, (_, idx) => `${year}-${String(idx + 1).padStart(2, '0')}`);
  return {
    yearKey: String(year),
    year,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    quarters,
    months,
    label: String(year)
  };
};

const shiftYearKey = (yearKey: string, delta: number): string => {
  const year = parseInt(yearKey) || 2026;
  return String(year + delta);
};

export const ReviewHub: React.FC = () => {
  const { 
    reviewSubTab, 
    setReviewSubTab,
    todayDate,
    selectedDate, 
    setSelectedDate, 
    goToPreviousDay, 
    goToNextDay, 
    getEntryForDate,
    saveDailyEntry,
    dailyEntries,
    gwsSessions,
    addGWSSession,
    deleteGWSSession,
    weeklyPlans,
    selectedWeekId,
    setSelectedWeekId,
    saveWeeklyPlan,
    monthlyPlans,
    getMonthlyPlan,
    saveMonthlyPlan,
    yearlyPlans,
    getYearlyPlan,
    saveYearlyPlan,
    strategyPlans,
    checklistItems,
    saveChecklistItems,
    problems,
    addProblem,
    recordProblemRecurrence,
    reviews,
    systemLevel,
    saveReview,
    deleteReview,
    setActiveTab,
    setPlanningSubTab,
    setSelectedDate: selectDateGlobal,
    setSelectedWeekId: selectWeekGlobal
  } = useStorage();

  const currentDailyEntry = getEntryForDate(selectedDate);
  const currentWeeklyPlan = weeklyPlans[selectedWeekId] || weeklyPlans['week_1'] || Object.values(weeklyPlans)[0];

  // Modal-specific draft state for compact ProblemLoggerPanel inside Create Review modal
  const [modalProblemCategory, setModalProblemCategory] = useState<ProblemCategory>('mindset');
  const [modalProblemTags, setModalProblemTags] = useState<string[]>([]);

  const activeProblemCount = problems.filter(
    p => p.status !== 'solved' && !hasExistingParent(problems, p)
  ).length;

  // Create Review Modal state
  const [showCreateReviewModal, setShowCreateReviewModal] = useState(false);
  const [createReviewType, setCreateReviewType] = useState<'yearly' | 'quarterly' | 'monthly' | 'weekly' | 'daily' | 'gws'>('weekly');

  // Vault states
  const [vaultFilter, setVaultFilter] = useState<'all' | 'yearly' | 'quarterly' | 'monthly' | 'weekly' | 'daily' | 'gws'>('all');
  const [vaultSearch, setVaultSearch] = useState('');
  const [copiedReviewId, setCopiedReviewId] = useState<string | null>(null);

  // Monthly, Quarterly & Yearly active period selection
  const [selectedMonth, setSelectedMonth] = useState<string>(() => selectedDate.slice(0, 7));
  const [selectedQuarter, setSelectedQuarter] = useState<string>(() => getMonthInfo(selectedDate.slice(0, 7)).quarterKey);
  const [selectedYear, setSelectedYear] = useState<string>(() => selectedDate.slice(0, 4));
  const [monthlyScaleFilter, setMonthlyScaleFilter] = useState<'all' | 'weekly' | 'daily' | 'gws'>('all');
  const [copiedMacroType, setCopiedMacroType] = useState<'monthly' | 'quarterly' | 'yearly' | null>(null);

  // GWS filter states
  const [gwsSearchQuery, setGwsSearchQuery] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Weekly review form states
  const [reviewTargetWeekId, setReviewTargetWeekId] = useState<string>(selectedWeekId);
  const targetPlanForReview = weeklyPlans[reviewTargetWeekId] || currentWeeklyPlan;

  const [reviewTitle, setReviewTitle] = useState(`Week ${targetPlanForReview.weekNumber} Retrospective & Course Correction`);
  const [winsText, setWinsText] = useState(targetPlanForReview.winsNotes || '');
  const [blockersText, setBlockersText] = useState('');
  const [courseCorrectionsText, setCourseCorrectionsText] = useState(
    targetPlanForReview.courseCorrectionNotes || targetPlanForReview.reviewNotes || ''
  );
  const [clarityRating, setClarityRating] = useState(4);
  const [consistencyRating, setConsistencyRating] = useState(4);
  const [overallRating, setOverallRating] = useState(4);

  // Create New Week in Review modal
  const [showNewWeekForm, setShowNewWeekForm] = useState(false);
  const existingWeekNums = Object.values(weeklyPlans).map(p => p.weekNumber);
  const maxWeekNum = existingWeekNums.length > 0 ? Math.max(...existingWeekNums) : 1;
  const [modalNewWeekNum, setModalNewWeekNum] = useState<number>(maxWeekNum + 1);
  const [modalNewWeekFocus, setModalNewWeekFocus] = useState<string>('');

  // Daily review modal states
  const [modalDailyDate, setModalDailyDate] = useState<string>(selectedDate);
  const [modalDailyScore, setModalDailyScore] = useState<number>(8);
  const [modalDailyProblems, setModalDailyProblems] = useState<string>('');
  const [modalDailyNotes, setModalDailyNotes] = useState<string>('');

  // GWS quick review modal states
  const [modalGwsTask, setModalGwsTask] = useState<string>('');
  const [modalGwsPlanned, setModalGwsPlanned] = useState<number>(50);
  const [modalGwsActual, setModalGwsActual] = useState<number>(50);
  const [modalGwsFocus, setModalGwsFocus] = useState<number>(4);
  const [modalGwsExecution, setModalGwsExecution] = useState<number>(4);
  const [modalGwsOutput, setModalGwsOutput] = useState<number>(4);
  const [modalGwsAccomplished, setModalGwsAccomplished] = useState<string>('');
  const [modalGwsHeldBack, setModalGwsHeldBack] = useState<string>('');
  const [modalGwsImproveNext, setModalGwsImproveNext] = useState<string>('');

  // Keep reviewTargetWeekId synchronized when global selectedWeekId changes
  useEffect(() => {
    setReviewTargetWeekId(selectedWeekId);
  }, [selectedWeekId]);

  // Auto-sync weekly review form when target plan changes OR updates from cloud sync
  useEffect(() => {
    const plan = weeklyPlans[reviewTargetWeekId] || currentWeeklyPlan;
    setReviewTitle(`Week ${plan.weekNumber} Retrospective${plan.focusTheme ? `: ${plan.focusTheme}` : ''}`);
    setWinsText(plan.winsNotes || '');
    setBlockersText('');
    setCourseCorrectionsText(plan.courseCorrectionNotes || plan.reviewNotes || '');
  }, [
    reviewTargetWeekId,
    currentWeeklyPlan.id,
    targetPlanForReview.updatedAt,
    targetPlanForReview.winsNotes,
    targetPlanForReview.courseCorrectionNotes,
    targetPlanForReview.reviewNotes
  ]);

  // Computed GWS metrics
  const totalGwsHours = (gwsSessions.reduce((acc, s) => acc + (s.actualMinutes || 0), 0) / 60).toFixed(1);
  const avgGwsScore = (gwsSessions.reduce((acc, s) => acc + s.ratings.total, 0) / Math.max(1, gwsSessions.length)).toFixed(1);
  const avgFocus = (gwsSessions.reduce((acc, s) => acc + s.ratings.focus, 0) / Math.max(1, gwsSessions.length)).toFixed(1);
  const avgExecution = (gwsSessions.reduce((acc, s) => acc + s.ratings.execution, 0) / Math.max(1, gwsSessions.length)).toFixed(1);
  const avgOutput = (gwsSessions.reduce((acc, s) => acc + s.ratings.output, 0) / Math.max(1, gwsSessions.length)).toFixed(1);

  // Filtered GWS
  const filteredGwsSessions = gwsSessions.filter(s =>
    s.taskName.toLowerCase().includes(gwsSearchQuery.toLowerCase()) ||
    s.reflexions.accomplished.toLowerCase().includes(gwsSearchQuery.toLowerCase()) ||
    s.reflexions.heldBack.toLowerCase().includes(gwsSearchQuery.toLowerCase()) ||
    s.date.includes(gwsSearchQuery)
  );

  // Extract all improvements
  const allImprovements = gwsSessions
    .filter(s => s.reflexions.improveNext.trim().length > 0)
    .map(s => ({ date: s.date, task: s.taskName, text: s.reflexions.improveNext }));

  // --- MACRO ROLLUP HELPERS (MONTHLY & QUARTERLY AGGREGATION OF SMALLER SCALES) ---
  const getSavedMonthlyReview = (monthKey: string): ReviewEntry | undefined => {
    return reviews.find(
      r => (r.periodType === 'monthly' && r.periodKey === monthKey) || r.id === `rev_monthly_${monthKey}`
    );
  };

  const getSavedQuarterlyReview = (quarterKey: string): ReviewEntry | undefined => {
    return reviews.find(
      r => (r.periodType === 'quarterly' && r.periodKey === quarterKey) || r.id === `rev_quarterly_${quarterKey}`
    );
  };

  const getSavedYearlyReview = (yearKey: string): ReviewEntry | undefined => {
    return reviews.find(
      r => (r.periodType === 'yearly' && r.periodKey === yearKey) || r.id === `rev_yearly_${yearKey}`
    );
  };

  const upsertMonthlyReview = (monthKey: string, updates: Partial<ReviewEntry>) => {
    const info = getMonthInfo(monthKey);
    const existing = getSavedMonthlyReview(monthKey);
    const entry: ReviewEntry = {
      id: existing?.id || `rev_monthly_${monthKey}`,
      title: updates.title ?? existing?.title ?? `${info.label} — Monthly Review & Course Correction`,
      periodType: 'monthly',
      periodKey: monthKey,
      startDate: info.startDate,
      endDate: info.endDate,
      score: updates.score ?? existing?.score ?? 0,
      wins: updates.wins ?? existing?.wins ?? '',
      blockers: updates.blockers ?? existing?.blockers ?? '',
      courseCorrections: updates.courseCorrections ?? existing?.courseCorrections ?? '',
      ratings: updates.ratings ?? existing?.ratings ?? { clarity: 4, consistency: 4, overall: 4 },
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveReview(entry);
  };

  const upsertQuarterlyReview = (quarterKey: string, updates: Partial<ReviewEntry>) => {
    const info = getQuarterInfo(quarterKey);
    const existing = getSavedQuarterlyReview(quarterKey);
    const entry: ReviewEntry = {
      id: existing?.id || `rev_quarterly_${quarterKey}`,
      title: updates.title ?? existing?.title ?? `${info.label} — Quarterly Strategic Review`,
      periodType: 'quarterly',
      periodKey: quarterKey,
      startDate: info.startDate,
      endDate: info.endDate,
      score: updates.score ?? existing?.score ?? 0,
      wins: updates.wins ?? existing?.wins ?? '',
      blockers: updates.blockers ?? existing?.blockers ?? '',
      courseCorrections: updates.courseCorrections ?? existing?.courseCorrections ?? '',
      stopDoing: updates.stopDoing ?? existing?.stopDoing ?? '',
      doubleDown: updates.doubleDown ?? existing?.doubleDown ?? '',
      ratings: updates.ratings ?? existing?.ratings ?? { clarity: 4, consistency: 4, overall: 4 },
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveReview(entry);
  };

  const upsertYearlyReview = (yearKey: string, updates: Partial<ReviewEntry>) => {
    const info = getYearInfo(yearKey);
    const existing = getSavedYearlyReview(yearKey);
    const entry: ReviewEntry = {
      id: existing?.id || `rev_yearly_${info.yearKey}`,
      title: updates.title ?? existing?.title ?? `${info.label} — Yearly Executive Review`,
      periodType: 'yearly',
      periodKey: info.yearKey,
      startDate: info.startDate,
      endDate: info.endDate,
      score: updates.score ?? existing?.score ?? 0,
      wins: updates.wins ?? existing?.wins ?? '',
      blockers: updates.blockers ?? existing?.blockers ?? '',
      courseCorrections: updates.courseCorrections ?? existing?.courseCorrections ?? '',
      headline: updates.headline ?? existing?.headline ?? '',
      ratings: updates.ratings ?? existing?.ratings ?? { clarity: 4, consistency: 4, overall: 4 },
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveReview(entry);
  };

  const compileMonthData = (monthKey: string) => {
    const info = getMonthInfo(monthKey);
    const saved = getSavedMonthlyReview(monthKey);
    const monthPlan = getMonthlyPlan(monthKey);
    const monthGoals = monthPlan.tasks || [];
    const completedMonthGoals = monthGoals.filter(g => g.completed).length;
    const totalMonthGoals = monthGoals.length;

    // 1. Anchor each week strictly to the single Month containing its Monday startDate (prevents boundary double-counting)
    const weeks = Object.values(weeklyPlans)
      .filter(
        w =>
          w.startDate >= info.startDate &&
          w.startDate <= info.endDate &&
          (w.tasks.length > 0 ||
            w.focusTheme.trim().length > 0 ||
            (w.winsNotes && w.winsNotes.trim().length > 0) ||
            (w.problemsEncountered && w.problemsEncountered.trim().length > 0) ||
            (w.courseCorrectionNotes && w.courseCorrectionNotes.trim().length > 0) ||
            (w.reviewNotes && w.reviewNotes.trim().length > 0))
      )
      .sort((a, b) => a.weekNumber - b.weekNumber);

    const weeklyPointsAchieved = Math.round(
      weeks.reduce((acc, w) => acc + computeWeeklyAchievedScore(w.tasks), 0) * 10
    ) / 10;
    const weeklyPointsPossible = weeks.reduce((acc, w) => acc + (w.totalPossibleScore || 10), 0);
    const avgWeeklyScore = weeks.length > 0 ? (weeklyPointsAchieved / weeks.length).toFixed(1) : '0.0';
    const weeklyTasksDone = weeks.reduce((acc, w) => acc + w.tasks.filter(t => t.completed).length, 0);
    const weeklyTasksTotal = weeks.reduce((acc, w) => acc + w.tasks.length, 0);

    // 2. All Daily Entries & Reviews in this month
    const days = Object.values(dailyEntries)
      .filter(
        d =>
          d.date >= info.startDate &&
          d.date <= info.endDate &&
          (d.executionScore > 0 ||
            (d.planNotes && d.planNotes.trim().length > 0) ||
            (d.problemsEncountered && d.problemsEncountered.trim().length > 0) ||
            (d.reviewNotes && d.reviewNotes.trim().length > 0) ||
            d.automaticTasksCompleted)
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    const scoredDays = days.filter(d => d.executionScore > 0);
    const avgDailyScore =
      scoredDays.length > 0
        ? (scoredDays.reduce((acc, d) => acc + d.executionScore, 0) / scoredDays.length).toFixed(1)
        : '0.0';
    const dailyTasksDone = days.reduce((acc, d) => acc + (d.mainTasksCompleted || 0), 0);
    const dailyTasksTotal = days.reduce((acc, d) => acc + (d.mainTasksTotal || 0), 0);
    const habitDaysLocked = days.filter(d => d.automaticTasksCompleted).length;
    const habitRatePct = days.length > 0 ? Math.round((habitDaysLocked / days.length) * 100) : 0;

    // 3. All GWS Sprints in this month
    const gws = gwsSessions
      .filter(s => s.date >= info.startDate && s.date <= info.endDate)
      .sort((a, b) => b.date.localeCompare(a.date));

    const gwsMinutes = gws.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);
    const gwsHours = (gwsMinutes / 60).toFixed(1);
    const avgGwsTotal =
      gws.length > 0 ? (gws.reduce((acc, s) => acc + s.ratings.total, 0) / gws.length).toFixed(1) : '0.0';

    // Hierarchical 1-level-below rollup (prevents duplicating blockers imported into Daily/Weekly notes)
    const weeksWithWins = weeks.filter(w => w.winsNotes && w.winsNotes.trim());
    const weeksWithProblems = weeks.filter(w => w.problemsEncountered && w.problemsEncountered.trim());
    const weeksWithCorrections = weeks.filter(w => (w.courseCorrectionNotes || w.reviewNotes)?.trim());
    const daysWithProblemsSet = new Set(
      days.filter(d => d.problemsEncountered && d.problemsEncountered.trim()).map(d => d.date)
    );
    const daysWithReviewSet = new Set(
      days.filter(d => d.reviewNotes && d.reviewNotes.trim()).map(d => d.date)
    );

    const rolledUpWins = dedupeLines([
      ...monthGoals.filter(g => g.completed).map(g => `• [${info.label} Monthly Goal] ${g.text}`),
      ...weeksWithWins.map(w => `• [Week ${w.weekNumber}] ${w.winsNotes!.trim()}`),
      ...weeks.flatMap(w =>
        w.tasks.filter(t => t.completed).map(t => `• [Week ${w.weekNumber} Goal] ${t.text} (${t.score}pts)`)
      ),
      ...gws
        .filter(
          s =>
            s.reflexions.accomplished?.trim() &&
            !weeksWithWins.some(w => w.startDate <= s.date && s.date <= w.endDate)
        )
        .map(s => `• [${s.date} GWS: ${s.taskName}] ${s.reflexions.accomplished.trim()}`)
    ]);

    const rolledUpProblems = dedupeLines([
      ...weeksWithProblems.map(w => `• [Week ${w.weekNumber}] ${w.problemsEncountered!.trim()}`),
      ...days
        .filter(
          d =>
            d.problemsEncountered?.trim() &&
            !weeksWithProblems.some(w => w.startDate <= d.date && d.date <= w.endDate)
        )
        .map(d => `• [${d.date} Daily] ${d.problemsEncountered!.trim()}`),
      ...gws
        .filter(
          s =>
            s.reflexions.heldBack?.trim() &&
            !daysWithProblemsSet.has(s.date) &&
            !weeksWithProblems.some(w => w.startDate <= s.date && s.date <= w.endDate)
        )
        .map(s => `• [${s.date} GWS: ${s.taskName}] ${s.reflexions.heldBack.trim()}`)
    ]);

    const rolledUpCorrections = dedupeLines([
      ...weeksWithCorrections.map(
        w => `• [Week ${w.weekNumber}] ${(w.courseCorrectionNotes || w.reviewNotes)!.trim()}`
      ),
      ...days
        .filter(
          d =>
            d.reviewNotes?.trim() &&
            !weeksWithCorrections.some(w => w.startDate <= d.date && d.date <= w.endDate)
        )
        .map(d => `• [${d.date} Daily] ${d.reviewNotes!.trim()}`),
      ...gws
        .filter(
          s =>
            s.reflexions.improveNext?.trim() &&
            !daysWithReviewSet.has(s.date) &&
            !weeksWithCorrections.some(w => w.startDate <= s.date && s.date <= w.endDate)
        )
        .map(s => `• [${s.date} GWS: ${s.taskName}] ${s.reflexions.improveNext.trim()}`)
    ]);

    return {
      info,
      saved,
      monthPlan,
      monthGoals,
      completedMonthGoals,
      totalMonthGoals,
      weeks,
      weeklyPointsAchieved,
      weeklyPointsPossible,
      avgWeeklyScore,
      weeklyTasksDone,
      weeklyTasksTotal,
      days,
      avgDailyScore,
      dailyTasksDone,
      dailyTasksTotal,
      habitDaysLocked,
      habitRatePct,
      gws,
      gwsMinutes,
      gwsHours,
      avgGwsTotal,
      rolledUpWins,
      rolledUpProblems,
      rolledUpCorrections
    };
  };

  const compileQuarterData = (quarterKey: string) => {
    const info = getQuarterInfo(quarterKey);
    const saved = getSavedQuarterlyReview(quarterKey);

    // 1. All 3 Monthly Reviews & Rollups in this Quarter
    const monthsData = info.months.map(mKey => compileMonthData(mKey));

    // 2. Anchor each week strictly to the Quarter containing its Monday startDate (no boundary double-counting)
    const weeks = Object.values(weeklyPlans)
      .filter(
        w =>
          w.startDate >= info.startDate &&
          w.startDate <= info.endDate &&
          (w.tasks.length > 0 ||
            w.focusTheme.trim().length > 0 ||
            (w.winsNotes && w.winsNotes.trim().length > 0) ||
            (w.problemsEncountered && w.problemsEncountered.trim().length > 0) ||
            (w.courseCorrectionNotes && w.courseCorrectionNotes.trim().length > 0) ||
            (w.reviewNotes && w.reviewNotes.trim().length > 0))
      )
      .sort((a, b) => a.weekNumber - b.weekNumber);

    const weeklyPointsAchieved = Math.round(
      weeks.reduce((acc, w) => acc + computeWeeklyAchievedScore(w.tasks), 0) * 10
    ) / 10;
    const weeklyPointsPossible = weeks.reduce((acc, w) => acc + (w.totalPossibleScore || 10), 0);
    const avgWeeklyScore = weeks.length > 0 ? (weeklyPointsAchieved / weeks.length).toFixed(1) : '0.0';
    const weeklyTasksDone = weeks.reduce((acc, w) => acc + w.tasks.filter(t => t.completed).length, 0);
    const weeklyTasksTotal = weeks.reduce((acc, w) => acc + w.tasks.length, 0);

    // 3. All Daily Entries & Reviews in this Quarter
    const days = Object.values(dailyEntries)
      .filter(
        d =>
          d.date >= info.startDate &&
          d.date <= info.endDate &&
          (d.executionScore > 0 ||
            (d.planNotes && d.planNotes.trim().length > 0) ||
            (d.problemsEncountered && d.problemsEncountered.trim().length > 0) ||
            (d.reviewNotes && d.reviewNotes.trim().length > 0) ||
            d.automaticTasksCompleted)
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    const scoredDays = days.filter(d => d.executionScore > 0);
    const avgDailyScore =
      scoredDays.length > 0
        ? (scoredDays.reduce((acc, d) => acc + d.executionScore, 0) / scoredDays.length).toFixed(1)
        : '0.0';
    const dailyTasksDone = days.reduce((acc, d) => acc + (d.mainTasksCompleted || 0), 0);
    const dailyTasksTotal = days.reduce((acc, d) => acc + (d.mainTasksTotal || 0), 0);
    const habitDaysLocked = days.filter(d => d.automaticTasksCompleted).length;
    const habitRatePct = days.length > 0 ? Math.round((habitDaysLocked / days.length) * 100) : 0;

    // 4. All GWS Sprints in this Quarter
    const gws = gwsSessions
      .filter(s => s.date >= info.startDate && s.date <= info.endDate)
      .sort((a, b) => b.date.localeCompare(a.date));

    const gwsMinutes = gws.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);
    const gwsHours = (gwsMinutes / 60).toFixed(1);
    const avgGwsTotal =
      gws.length > 0 ? (gws.reduce((acc, s) => acc + s.ratings.total, 0) / gws.length).toFixed(1) : '0.0';

    // Hierarchical 1-level-below rollup: Saved Monthly Reviews first, fallback to raw month rollups ONLY for months without that monthly field
    const rolledUpWins = dedupeLines([
      ...monthsData.flatMap(m =>
        m.saved?.wins?.trim()
          ? [`• [${m.info.label} Monthly] ${m.saved.wins.trim()}`]
          : m.rolledUpWins
      )
    ]);

    const rolledUpProblems = dedupeLines([
      ...monthsData.flatMap(m =>
        m.saved?.blockers?.trim()
          ? [`• [${m.info.label} Monthly] ${m.saved.blockers.trim()}`]
          : m.rolledUpProblems
      )
    ]);

    const rolledUpCorrections = dedupeLines([
      ...monthsData.flatMap(m =>
        m.saved?.courseCorrections?.trim()
          ? [`• [${m.info.label} Monthly] ${m.saved.courseCorrections.trim()}`]
          : m.rolledUpCorrections
      )
    ]);

    return {
      info,
      saved,
      monthsData,
      weeks,
      weeklyPointsAchieved,
      weeklyPointsPossible,
      avgWeeklyScore,
      weeklyTasksDone,
      weeklyTasksTotal,
      days,
      avgDailyScore,
      dailyTasksDone,
      dailyTasksTotal,
      habitDaysLocked,
      habitRatePct,
      gws,
      gwsMinutes,
      gwsHours,
      avgGwsTotal,
      rolledUpWins,
      rolledUpProblems,
      rolledUpCorrections
    };
  };

  // Discover all active months and quarters from existing data + current selectedMonth/selectedQuarter
  const allKnownMonths = Array.from(
    new Set([
      selectedDate.slice(0, 7),
      selectedMonth,
      ...Object.keys(monthlyPlans),
      ...Object.keys(dailyEntries).map(d => d.slice(0, 7)),
      ...gwsSessions.map(s => s.date.slice(0, 7)),
      ...Object.values(weeklyPlans)
        .filter(w => w.tasks.length > 0 || w.focusTheme.trim().length > 0)
        .map(w => w.startDate.slice(0, 7)),
      ...reviews.filter(r => r.periodType === 'monthly' && r.periodKey).map(r => r.periodKey!)
    ])
  ).sort();

  const allKnownQuarters = Array.from(
    new Set([
      getMonthInfo(selectedDate.slice(0, 7)).quarterKey,
      selectedQuarter,
      ...allKnownMonths.map(m => getMonthInfo(m).quarterKey),
      ...reviews.filter(r => r.periodType === 'quarterly' && r.periodKey).map(r => r.periodKey!)
    ])
  ).sort();

  const compileYearData = (yearKey: string) => {
    const info = getYearInfo(yearKey);
    const saved = getSavedYearlyReview(info.yearKey);

    // 1. All 4 Quarters in this Year
    const quartersData = info.quarters.map(qKey => compileQuarterData(qKey));

    // 2. All active Months in this Year
    const monthsData = info.months
      .map(mKey => compileMonthData(mKey))
      .filter(m => !!m.saved || m.weeks.length > 0 || m.days.length > 0 || m.gws.length > 0);

    // 3. Anchor each week strictly to the Year containing its Monday startDate
    const weeks = Object.values(weeklyPlans)
      .filter(
        w =>
          w.startDate >= info.startDate &&
          w.startDate <= info.endDate &&
          (w.tasks.length > 0 ||
            w.focusTheme.trim().length > 0 ||
            (w.winsNotes && w.winsNotes.trim().length > 0) ||
            (w.problemsEncountered && w.problemsEncountered.trim().length > 0) ||
            (w.courseCorrectionNotes && w.courseCorrectionNotes.trim().length > 0) ||
            (w.reviewNotes && w.reviewNotes.trim().length > 0))
      )
      .sort((a, b) => a.weekNumber - b.weekNumber);

    const weeklyPointsAchieved = Math.round(
      weeks.reduce((acc, w) => acc + computeWeeklyAchievedScore(w.tasks), 0) * 10
    ) / 10;
    const weeklyPointsPossible = weeks.reduce((acc, w) => acc + (w.totalPossibleScore || 10), 0);
    const avgWeeklyScore = weeks.length > 0 ? (weeklyPointsAchieved / weeks.length).toFixed(1) : '0.0';
    const weeklyTasksDone = weeks.reduce((acc, w) => acc + w.tasks.filter(t => t.completed).length, 0);
    const weeklyTasksTotal = weeks.reduce((acc, w) => acc + w.tasks.length, 0);

    // 4. All Daily Entries & Reviews in this Year
    const days = Object.values(dailyEntries)
      .filter(
        d =>
          d.date >= info.startDate &&
          d.date <= info.endDate &&
          (d.executionScore > 0 ||
            (d.planNotes && d.planNotes.trim().length > 0) ||
            (d.problemsEncountered && d.problemsEncountered.trim().length > 0) ||
            (d.reviewNotes && d.reviewNotes.trim().length > 0) ||
            d.automaticTasksCompleted)
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    const scoredDays = days.filter(d => d.executionScore > 0);
    const avgDailyScore =
      scoredDays.length > 0
        ? (scoredDays.reduce((acc, d) => acc + d.executionScore, 0) / scoredDays.length).toFixed(1)
        : '0.0';
    const dailyTasksDone = days.reduce((acc, d) => acc + (d.mainTasksCompleted || 0), 0);
    const dailyTasksTotal = days.reduce((acc, d) => acc + (d.mainTasksTotal || 0), 0);
    const habitDaysLocked = days.filter(d => d.automaticTasksCompleted).length;
    const habitRatePct = days.length > 0 ? Math.round((habitDaysLocked / days.length) * 100) : 0;

    // 5. All GWS Sprints in this Year
    const gws = gwsSessions
      .filter(s => s.date >= info.startDate && s.date <= info.endDate)
      .sort((a, b) => b.date.localeCompare(a.date));

    const gwsMinutes = gws.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);
    const gwsHours = (gwsMinutes / 60).toFixed(1);
    const avgGwsTotal =
      gws.length > 0 ? (gws.reduce((acc, s) => acc + s.ratings.total, 0) / gws.length).toFixed(1) : '0.0';

    // 6. Yearly Plan goals & focus for this Year
    const yearPlan = getYearlyPlan(info.yearKey);
    const yearGoals = yearPlan.tasks || [];
    const completedYearGoals = yearGoals.filter(g => g.completed).length;
    const totalYearGoals = yearGoals.length;

    // Hierarchical 1-level-below rollup: Yearly Plan Goals + Quarterly Reviews first, fallback to unreviewed lower scales
    const rolledUpWins = dedupeLines([
      ...yearGoals
        .filter(g => g.completed)
        .map(g => `• [${info.yearKey} Yearly Goal] ${g.text}`),
      ...quartersData.flatMap(q =>
        q.saved?.wins?.trim()
          ? [`• [${q.info.quarterKey} Quarterly] ${q.saved.wins.trim()}`]
          : q.rolledUpWins
      )
    ]);

    const rolledUpProblems = dedupeLines([
      ...quartersData.flatMap(q =>
        q.saved?.blockers?.trim()
          ? [`• [${q.info.quarterKey} Quarterly] ${q.saved.blockers.trim()}`]
          : q.rolledUpProblems
      )
    ]);

    const rolledUpCorrections = dedupeLines([
      ...quartersData.flatMap(q =>
        q.saved?.courseCorrections?.trim()
          ? [`• [${q.info.quarterKey} Quarterly] ${q.saved.courseCorrections.trim()}`]
          : q.rolledUpCorrections
      )
    ]);

    return {
      info,
      saved,
      yearPlan,
      yearGoals,
      completedYearGoals,
      totalYearGoals,
      quartersData,
      monthsData,
      weeks,
      weeklyPointsAchieved,
      weeklyPointsPossible,
      avgWeeklyScore,
      weeklyTasksDone,
      weeklyTasksTotal,
      days,
      avgDailyScore,
      dailyTasksDone,
      dailyTasksTotal,
      habitDaysLocked,
      habitRatePct,
      gws,
      gwsMinutes,
      gwsHours,
      avgGwsTotal,
      rolledUpWins,
      rolledUpProblems,
      rolledUpCorrections
    };
  };

  const allKnownYears = Array.from(
    new Set([
      '2026',
      '2027',
      '2028',
      selectedDate.slice(0, 4),
      selectedYear,
      ...Object.keys(yearlyPlans),
      ...allKnownQuarters.map(q => q.slice(0, 4)),
      ...reviews.filter(r => r.periodType === 'yearly' && r.periodKey).map(r => r.periodKey!)
    ])
  ).sort();

  // --- UNIFIED VAULT ITEMS AGGREGATION ---
  interface VaultItem {
    id: string;
    type: 'yearly' | 'quarterly' | 'monthly' | 'weekly' | 'daily' | 'gws';
    dateOrPeriod: string;
    title: string;
    scoreBadge?: string;
    scoreNumber?: number;
    plannedOrContext?: string;
    reviewContent: string;
    secondaryContent?: string;
    rawDate: string;
    jumpTarget?: () => void;
  }

  // 1. Gather all Daily reviews
  const dailyVaultItems: VaultItem[] = Object.values(dailyEntries)
    .filter(
      d =>
        (d.reviewNotes && d.reviewNotes.trim().length > 0) ||
        (d.problemsEncountered && d.problemsEncountered.trim().length > 0) ||
        d.executionScore > 0 ||
        (d.planNotes && d.planNotes.trim().length > 0)
    )
    .map(d => {
      const dayGws = gwsSessions.filter(s => s.date === d.date);
      const gwsSummary =
        dayGws.length > 0
          ? `\n\nGWS Sprints (${dayGws.length}):\n` +
            dayGws.map(s => `• ${s.taskName} (${s.actualMinutes}m, ${s.ratings.total}/15)`).join('\n')
          : '';
      const dayProblems = problems.filter(p => problemOccurredOnDate(p, d.date));
      const structuredProblemsText = formatProblemsForReviewText(dayProblems);
      const problemsPart = structuredProblemsText
        ? `⚠️ Problems Logged:\n${structuredProblemsText}\n\n`
        : d.problemsEncountered && d.problemsEncountered.trim()
        ? `⚠️ Problems Encountered:\n${d.problemsEncountered.trim()}\n\n`
        : '';
      const reflexionPart =
        d.reviewNotes && d.reviewNotes.trim()
          ? `⚡ Reflexion & Course Correction:\n${d.reviewNotes.trim()}`
          : 'No specific course correction note logged.';

      return {
        id: `vault_daily_${d.date}`,
        type: 'daily',
        dateOrPeriod: d.date,
        title: `Daily Review: ${d.date}`,
        scoreBadge: d.executionScore > 0 ? `Execution ${d.executionScore}/10` : undefined,
        scoreNumber: d.executionScore,
        plannedOrContext: (d.planNotes ? `Mission Plan:\n${d.planNotes}` : 'No written plan') + gwsSummary,
        reviewContent: `${problemsPart}${reflexionPart}`,
        secondaryContent: `Tasks Completed: ${d.mainTasksCompleted}/${d.mainTasksTotal} • Automatic Habits: ${d.automaticTasksCompleted ? 'Yes (Locked In)' : 'Pending'} • GWS Sessions: ${dayGws.length}`,
        rawDate: d.date,
        jumpTarget: () => {
          selectDateGlobal(d.date);
          setReviewSubTab('daily');
        }
      };
    });

  // 2. Gather all Weekly reviews (excluding completely blank auto-generated weeks)
  const weeklyVaultItems: VaultItem[] = Object.values(weeklyPlans)
    .filter(
      w =>
        w.tasks.length > 0 ||
        w.focusTheme.trim().length > 0 ||
        (w.reviewNotes && w.reviewNotes.trim().length > 0) ||
        (w.problemsEncountered && w.problemsEncountered.trim().length > 0) ||
        (w.winsNotes && w.winsNotes.trim().length > 0) ||
        (w.courseCorrectionNotes && w.courseCorrectionNotes.trim().length > 0)
    )
    .map(w => {
      const weekStructuredProblems = formatProblemsForReviewText(
        problems.filter(p => problemOccurredInRange(p, w.startDate, w.endDate))
      );
      const structuredReview = [
        w.winsNotes?.trim() ? `1. Wins & Shipped:\n${w.winsNotes.trim()}` : '',
        weekStructuredProblems
          ? `2. Problems Logged:\n${weekStructuredProblems}`
          : w.problemsEncountered?.trim()
          ? `2. Problems Encountered:\n${w.problemsEncountered.trim()}`
          : '',
        w.courseCorrectionNotes?.trim() ? `3. Course Corrections:\n${w.courseCorrectionNotes.trim()}` : ''
      ]
        .filter(Boolean)
        .join('\n\n');

      return {
        id: `vault_weekly_${w.id}`,
        type: 'weekly',
        dateOrPeriod: `Week ${w.weekNumber} (${w.startDate} → ${w.endDate})`,
        title: `Week ${w.weekNumber} Retrospective${w.focusTheme ? `: "${w.focusTheme}"` : ''}`,
        scoreBadge: `${w.achievedScore}/${w.totalPossibleScore} pts`,
        scoreNumber: w.achievedScore,
        plannedOrContext: `Focus: ${w.focusTheme || '—'}\nTasks:\n${
          w.tasks.length > 0
            ? w.tasks
                .map(
                  t =>
                    `${t.completed ? '[x]' : '[ ]'} ${t.text} (${t.score}pts)${
                      t.subTasks && t.subTasks.length > 0
                        ? '\n' + t.subTasks.map(s => `   └ ${s.completed ? '[x]' : '[ ]'} ${s.text}`).join('\n')
                        : ''
                    }`
                )
                .join('\n')
            : 'No deliverables logged'
        }`,
        reviewContent:
          structuredReview ||
          w.reviewNotes ||
          (w.achievedScore >= 6
            ? `Achieved ${w.achievedScore}/10 points. Unlocked rewards: ${w.rewards
                .filter(r => w.achievedScore >= r.minScore)
                .map(r => r.reward)
                .join(', ')}`
            : 'Weekly retrospective pending.'),
        secondaryContent: `Unlocked Tiers: ${
          w.rewards
            .filter(r => w.achievedScore >= r.minScore)
            .map(r => `${r.minScore}+ (${r.reward})`)
            .join(' • ') || 'None yet'
        }`,
        rawDate: w.endDate,
        jumpTarget: () => {
          selectWeekGlobal(w.id);
          setReviewSubTab('weekly');
        }
      };
    });

  // 3. Gather all GWS reflexions
  const gwsVaultItems: VaultItem[] = gwsSessions.map(s => ({
    id: `vault_gws_${s.id}`,
    type: 'gws',
    dateOrPeriod: s.date,
    title: `GWS Sprint: ${s.taskName}`,
    scoreBadge: `${s.ratings.total}/15 Score`,
    scoreNumber: s.ratings.total,
    plannedOrContext: `Duration: ${s.actualMinutes}m actual (Planned: ${s.plannedMinutes}m) • Focus: ${s.ratings.focus}/5 • Execution: ${s.ratings.execution}/5 • Output: ${s.ratings.output}/5`,
    reviewContent: `1. Accomplished:\n${s.reflexions.accomplished || 'N/A'}\n\n2. What Held Me Back:\n${s.reflexions.heldBack || 'None'}\n\n3. What Will I Improve Next:\n${s.reflexions.improveNext || 'N/A'}`,
    rawDate: s.date,
    jumpTarget: () => {
      setReviewSubTab('gws');
      setExpandedSessionId(s.id);
    }
  }));

  // 4. Gather all Monthly reviews (from saved monthly reviews OR months with active smaller-scale reviews)
  const monthlyVaultItems: VaultItem[] = allKnownMonths
    .map(mKey => {
      const mData = compileMonthData(mKey);
      const hasActivity =
        !!mData.saved ||
        mData.monthGoals.length > 0 ||
        mData.monthPlan.focusTheme.trim().length > 0 ||
        mData.weeks.length > 0 ||
        mData.days.length > 0 ||
        mData.gws.length > 0;
      if (!hasActivity) return null;

      const structuredMonthlyReview = [
        mData.saved?.wins?.trim() ? `1. Monthly Wins & Shipped:\n${mData.saved.wins.trim()}` : '',
        mData.saved?.blockers?.trim() ? `2. Problems Encountered & Bottlenecks:\n${mData.saved.blockers.trim()}` : '',
        mData.saved?.courseCorrections?.trim()
          ? `3. Monthly Course Corrections:\n${mData.saved.courseCorrections.trim()}`
          : ''
      ]
        .filter(Boolean)
        .join('\n\n');

      const autoRollupFallback = [
        mData.rolledUpWins.length > 0 ? `Rolled-Up Wins (${mData.rolledUpWins.length}):\n${mData.rolledUpWins.slice(0, 6).join('\n')}` : '',
        mData.rolledUpProblems.length > 0 ? `Rolled-Up Problems (${mData.rolledUpProblems.length}):\n${mData.rolledUpProblems.slice(0, 6).join('\n')}` : '',
        mData.rolledUpCorrections.length > 0 ? `Rolled-Up Course Corrections (${mData.rolledUpCorrections.length}):\n${mData.rolledUpCorrections.slice(0, 6).join('\n')}` : ''
      ]
        .filter(Boolean)
        .join('\n\n');

      return {
        id: `vault_monthly_${mKey}`,
        type: 'monthly' as const,
        dateOrPeriod: `${mData.info.label} (${mData.info.startDate} → ${mData.info.endDate})`,
        title: mData.saved?.title || `${mData.info.label} — Monthly Review & Multi-Scale Rollup`,
        scoreBadge:
          mData.saved?.score && mData.saved.score > 0
            ? `Month ${mData.saved.score}/10`
            : `Weeks ${mData.weeklyPointsAchieved}/${mData.weeklyPointsPossible} pts`,
        scoreNumber: mData.saved?.score || mData.weeklyPointsAchieved,
        plannedOrContext: `Monthly Focus (${mData.info.label}): ${mData.monthPlan.focusTheme || 'Not set'}\n• Monthly Goals: ${mData.completedMonthGoals}/${mData.totalMonthGoals} completed\n• Weekly Reviews: ${mData.weeks.length} weeks (${mData.weeklyPointsAchieved}/${mData.weeklyPointsPossible} pts, ${mData.weeklyTasksDone}/${mData.weeklyTasksTotal} goals done)\n• Daily Reviews: ${mData.days.length} days logged (Avg Discipline: ${mData.avgDailyScore}/10, Tasks: ${mData.dailyTasksDone}/${mData.dailyTasksTotal}, Habits: ${mData.habitRatePct}%)\n• GWS Sprints: ${mData.gws.length} sessions (${mData.gwsHours}h deep work, Avg Score: ${mData.avgGwsTotal}/15)`,
        reviewContent:
          structuredMonthlyReview ||
          autoRollupFallback ||
          'Click "Inspect / Edit" to synthesize your Monthly Review from all Weekly, Daily, and GWS data.',
        secondaryContent: `Contains: ${mData.weeks.length} Weekly Reviews • ${mData.days.length} Daily Reviews • ${mData.gws.length} GWS Sprints`,
        rawDate: mData.info.endDate,
        jumpTarget: () => {
          setSelectedMonth(mKey);
          setReviewSubTab('monthly');
        }
      };
    })
    .filter(Boolean) as VaultItem[];

  // 5. Gather all Quarterly reviews (from saved quarterly reviews OR quarters with active smaller-scale reviews)
  const quarterlyVaultItems: VaultItem[] = allKnownQuarters
    .map(qKey => {
      const qData = compileQuarterData(qKey);
      const hasActivity =
        !!qData.saved ||
        qData.weeks.length > 0 ||
        qData.days.length > 0 ||
        qData.gws.length > 0;
      if (!hasActivity) return null;

      const structuredQuarterlyReview = [
        qData.saved?.wins?.trim() ? `1. Biggest Wins & Breakthroughs:\n${qData.saved.wins.trim()}` : '',
        qData.saved?.blockers?.trim() ? `2. Top Constraints & Bottlenecks:\n${qData.saved.blockers.trim()}` : '',
        qData.saved?.stopDoing?.trim() ? `3. Stop Doing:\n${qData.saved.stopDoing.trim()}` : '',
        qData.saved?.doubleDown?.trim() ? `4. Double Down On:\n${qData.saved.doubleDown.trim()}` : '',
        qData.saved?.courseCorrections?.trim()
          ? `5. Next Quarter Thesis & Primary Focus:\n${qData.saved.courseCorrections.trim()}`
          : ''
      ]
        .filter(Boolean)
        .join('\n\n');

      const autoRollupFallback = [
        qData.rolledUpWins.length > 0 ? `Quarter Rolled-Up Wins (${qData.rolledUpWins.length}):\n${qData.rolledUpWins.slice(0, 6).join('\n')}` : '',
        qData.rolledUpProblems.length > 0 ? `Quarter Rolled-Up Problems (${qData.rolledUpProblems.length}):\n${qData.rolledUpProblems.slice(0, 6).join('\n')}` : '',
        qData.rolledUpCorrections.length > 0 ? `Quarter Rolled-Up Course Corrections (${qData.rolledUpCorrections.length}):\n${qData.rolledUpCorrections.slice(0, 6).join('\n')}` : ''
      ]
        .filter(Boolean)
        .join('\n\n');

      return {
        id: `vault_quarterly_${qKey}`,
        type: 'quarterly' as const,
        dateOrPeriod: `${qData.info.label} (${qData.info.startDate} → ${qData.info.endDate})`,
        title: qData.saved?.title || `${qData.info.label} — Quarterly Strategic Review`,
        scoreBadge:
          qData.saved?.score && qData.saved.score > 0
            ? `Quarter ${qData.saved.score}/10`
            : `${qData.weeklyPointsAchieved}/${qData.weeklyPointsPossible} wk pts`,
        scoreNumber: qData.saved?.score || qData.weeklyPointsAchieved,
        plannedOrContext: `Smaller-Scale Rollup (${qData.info.label}):\n• Monthly Reviews: 3 months (${qData.info.months.join(', ')})\n• Weekly Reviews: ${qData.weeks.length} weeks (${qData.weeklyPointsAchieved}/${qData.weeklyPointsPossible} pts, Avg: ${qData.avgWeeklyScore}/10)\n• Daily Reviews: ${qData.days.length} days logged (Avg Discipline: ${qData.avgDailyScore}/10, Tasks: ${qData.dailyTasksDone}/${qData.dailyTasksTotal}, Habits: ${qData.habitRatePct}%)\n• GWS Sprints: ${qData.gws.length} sessions (${qData.gwsHours}h deep work, Avg Score: ${qData.avgGwsTotal}/15)`,
        reviewContent:
          structuredQuarterlyReview ||
          autoRollupFallback ||
          'Click "Inspect / Edit" to synthesize your Quarterly Review from all Monthly, Weekly, Daily, and GWS data.',
        secondaryContent: `Contains: 3 Months • ${qData.weeks.length} Weekly Reviews • ${qData.days.length} Daily Reviews • ${qData.gws.length} GWS Sprints`,
        rawDate: qData.info.endDate,
        jumpTarget: () => {
          setSelectedQuarter(qKey);
          setReviewSubTab('quarterly');
        }
      };
    })
    .filter(Boolean) as VaultItem[];

  // 6. Gather all Yearly reviews (from saved yearly reviews OR active years with plans/data)
  const yearlyVaultItems: VaultItem[] = allKnownYears
    .map(yKey => {
      const yData = compileYearData(yKey);
      const hasActivity =
        !!yData.saved ||
        yData.weeks.length > 0 ||
        yData.days.length > 0 ||
        yData.gws.length > 0 ||
        yData.totalYearGoals > 0 ||
        yData.yearPlan.focusTheme.trim().length > 0;
      if (!hasActivity) return null;

      const structuredYearlyReview = [
        yData.saved?.headline?.trim() ? `Year Chapter: "${yData.saved.headline.trim()}"` : '',
        yData.saved?.wins?.trim() ? `1. Biggest Wins, Shipped Systems & Capacity Shift:\n${yData.saved.wins.trim()}` : '',
        yData.saved?.blockers?.trim() ? `2. Core Patterns & Annual Bottlenecks:\n${yData.saved.blockers.trim()}` : '',
        yData.saved?.courseCorrections?.trim()
          ? `3. Next Year Singular Focus & Operating Rules:\n${yData.saved.courseCorrections.trim()}`
          : ''
      ]
        .filter(Boolean)
        .join('\n\n');

      const autoRollupFallback = [
        yData.rolledUpWins.length > 0 ? `Year Rolled-Up Wins (${yData.rolledUpWins.length}):\n${yData.rolledUpWins.slice(0, 6).join('\n')}` : '',
        yData.rolledUpProblems.length > 0 ? `Year Rolled-Up Problems (${yData.rolledUpProblems.length}):\n${yData.rolledUpProblems.slice(0, 6).join('\n')}` : '',
        yData.rolledUpCorrections.length > 0 ? `Year Rolled-Up Corrections (${yData.rolledUpCorrections.length}):\n${yData.rolledUpCorrections.slice(0, 6).join('\n')}` : ''
      ]
        .filter(Boolean)
        .join('\n\n');

      return {
        id: `vault_yearly_${yKey}`,
        type: 'yearly' as const,
        dateOrPeriod: `${yData.info.label} (${yData.info.startDate} → ${yData.info.endDate})`,
        title: yData.saved?.headline?.trim()
          ? `${yData.info.label} — ${yData.saved.headline.trim()}`
          : yData.saved?.title || `${yData.info.label} — Yearly Executive Review`,
        scoreBadge:
          yData.saved?.score && yData.saved.score > 0
            ? `Year ${yData.saved.score}/10`
            : `${yData.completedYearGoals}/${yData.totalYearGoals} yearly goals`,
        scoreNumber: yData.saved?.score || yData.completedYearGoals,
        plannedOrContext: `Yearly Focus (${yData.info.yearKey}): ${yData.yearPlan.focusTheme || 'Not set'}\n• Yearly Goals: ${yData.completedYearGoals}/${yData.totalYearGoals} completed\n• Quarters: 4 (${yData.quartersData.filter(q => !!q.saved).length} reviewed) • Months: ${yData.monthsData.length} active\n• Weekly Points: ${yData.weeklyPointsAchieved}/${yData.weeklyPointsPossible} pts (${yData.weeks.length} wks) • Daily Avg: ${yData.avgDailyScore}/10 (${yData.days.length}d)\n• GWS Deep Work: ${yData.gwsHours}h (${yData.gws.length} sprints)`,
        reviewContent:
          structuredYearlyReview ||
          autoRollupFallback ||
          'Click "Inspect / Edit" to synthesize your Yearly Review from all Quarterly, Monthly, Weekly, Daily & GWS data.',
        secondaryContent: `Contains: ${yData.totalYearGoals} Yearly Goals • 4 Quarters • ${yData.monthsData.length} Months • ${yData.weeks.length} Weeks • ${yData.days.length} Days`,
        rawDate: yData.info.endDate,
        jumpTarget: () => {
          setSelectedYear(yKey);
          setReviewSubTab('yearly');
        }
      };
    })
    .filter(Boolean) as VaultItem[];

  // Combine and sort chronologically (most recent first)
  const allVaultItems: VaultItem[] = [
    ...yearlyVaultItems,
    ...quarterlyVaultItems,
    ...monthlyVaultItems,
    ...weeklyVaultItems,
    ...dailyVaultItems,
    ...gwsVaultItems
  ].sort((a, b) => b.rawDate.localeCompare(a.rawDate));

  // Filter vault items
  const filteredVaultItems = allVaultItems.filter(item => {
    if (vaultFilter !== 'all' && item.type !== vaultFilter) return false;
    if (!vaultSearch.trim()) return true;
    const q = vaultSearch.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.reviewContent.toLowerCase().includes(q) ||
      item.dateOrPeriod.toLowerCase().includes(q) ||
      (item.plannedOrContext && item.plannedOrContext.toLowerCase().includes(q))
    );
  });

  const handleCopyReview = (item: VaultItem) => {
    const markdown = `# ${item.title}\n**Date/Period:** ${item.dateOrPeriod}\n${item.scoreBadge ? `**Score:** ${item.scoreBadge}\n` : ''}\n${item.plannedOrContext ? `## Context\n${item.plannedOrContext}\n\n` : ''}## Review & Reflexions\n${item.reviewContent}\n\n${item.secondaryContent ? `## Telemetry\n${item.secondaryContent}\n` : ''}`;
    navigator.clipboard.writeText(markdown);
    setCopiedReviewId(item.id);
    setTimeout(() => setCopiedReviewId(null), 2000);
  };

  // Create new week helper
  const handleCreateNewWeekDirect = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `week_${modalNewWeekNum}`;
    const currentRange = getCurrentWeekRange(selectedDate);
    const newPlan: WeeklyPlan = {
      id: newId,
      weekNumber: modalNewWeekNum,
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
      focusTheme: modalNewWeekFocus.trim(),
      notes: '',
      tasks: [],
      totalPossibleScore: 10,
      achievedScore: 0,
      rewards: [],
      updatedAt: new Date().toISOString()
    };

    saveWeeklyPlan(newPlan);
    setSelectedWeekId(newId);
    setReviewTargetWeekId(newId);
    setShowNewWeekForm(false);
    setModalNewWeekFocus('');
  };

  const commitDraftProblemIfPresent = (
    draft: string,
    date: string,
    sourceType: 'weekly' | 'daily' | 'gws',
    sourceRef?: string
  ) => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const existing = problems.find(
      p => p.title.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      recordProblemRecurrence(existing.id, {
        date,
        sourceType,
        ...(sourceRef ? { sourceRef } : {})
      });
    } else {
      addProblem({
        title: trimmed,
        category: modalProblemCategory,
        tags: modalProblemTags,
        sourceType,
        date,
        ...(sourceRef ? { sourceRef } : {})
      });
    }
  };

  // Handlers for weekly save
  const handleSaveWeeklyReview = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPlan = weeklyPlans[reviewTargetWeekId] || currentWeeklyPlan;
    if (blockersText.trim()) {
      commitDraftProblemIfPresent(blockersText, targetPlan.endDate, 'weekly', targetPlan.id);
      setBlockersText('');
      setModalProblemTags([]);
    }
    const weekProbsText = formatProblemsForReviewText(
      problems.filter(p => problemOccurredInRange(p, targetPlan.startDate, targetPlan.endDate))
    );

    const fullReviewNotes = [
      winsText.trim() ? `1. Wins & Shipped:\n${winsText.trim()}` : '',
      weekProbsText ? `2. Problems Logged:\n${weekProbsText}` : '',
      courseCorrectionsText.trim() ? `3. Course Corrections:\n${courseCorrectionsText.trim()}` : ''
    ]
      .filter(Boolean)
      .join('\n\n');

    saveReview({
      id: `rev_${Date.now()}`,
      title: reviewTitle.trim() || `Week ${targetPlan.weekNumber} Retrospective`,
      periodType: 'weekly',
      startDate: targetPlan.startDate,
      endDate: targetPlan.endDate,
      wins: winsText.trim(),
      blockers: weekProbsText,
      courseCorrections: courseCorrectionsText.trim(),
      ratings: {
        clarity: clarityRating,
        consistency: consistencyRating,
        overall: overallRating
      },
      createdAt: new Date().toISOString()
    });

    saveWeeklyPlan({
      ...targetPlan,
      winsNotes: winsText.trim(),
      problemsEncountered: weekProbsText,
      courseCorrectionNotes: courseCorrectionsText.trim(),
      reviewNotes: fullReviewNotes.trim()
    });

    alert(`Week ${targetPlan.weekNumber} Retrospective saved to the Review Vault!`);
    setShowCreateReviewModal(false);
    setReviewSubTab('vault');
  };

  // Handlers for daily save in modal
  const handleSaveDailyReviewModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalDailyProblems.trim()) {
      commitDraftProblemIfPresent(modalDailyProblems, modalDailyDate, 'daily', modalDailyDate);
      setModalDailyProblems('');
      setModalProblemTags([]);
    }
    saveDailyEntry(modalDailyDate, {
      executionScore: modalDailyScore,
      reviewNotes: modalDailyNotes.trim()
    });
    alert(`Daily review for ${modalDailyDate} saved to the Review Vault!`);
    setShowCreateReviewModal(false);
    setReviewSubTab('vault');
  };

  // Handlers for GWS save in modal
  const handleSaveGwsModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalGwsTask.trim()) return;
    if (modalGwsHeldBack.trim()) {
      commitDraftProblemIfPresent(modalGwsHeldBack, selectedDate, 'gws', modalGwsTask.trim());
    }

    addGWSSession({
      date: selectedDate,
      taskName: modalGwsTask.trim(),
      plannedMinutes: modalGwsPlanned,
      actualMinutes: modalGwsActual,
      ratings: {
        focus: modalGwsFocus,
        execution: modalGwsExecution,
        output: modalGwsOutput,
        total: modalGwsFocus + modalGwsExecution + modalGwsOutput
      },
      reflexions: {
        accomplished: modalGwsAccomplished.trim(),
        heldBack: modalGwsHeldBack.trim(),
        improveNext: modalGwsImproveNext.trim()
      }
    });

    alert('GWS Session and Reflexions recorded in the Review Vault!');
    setShowCreateReviewModal(false);
    setModalGwsTask('');
    setModalGwsHeldBack('');
    setModalProblemTags([]);
    setReviewSubTab('vault');
  };

  const formatRoadmapsForReviewText = (periodStartDate: string, periodEndDate: string): string => {
    if (strategyPlans.length === 0) return '';
    return strategyPlans
      .map(plan => {
        const totalStages = plan.stages.length;
        const passedStages = plan.stages.filter(s => s.gatePassed);
        const passedInPeriod = passedStages.filter(
          s => s.gatePassedAt && s.gatePassedAt >= periodStartDate && s.gatePassedAt <= periodEndDate
        );
        const activeStage = plan.stages.find(s => !s.gatePassed);
        const periodTag = passedInPeriod.length > 0 ? ` · ${passedInPeriod.length} passed this period` : '';
        if (activeStage) {
          const gateTxt = activeStage.gateCriterion.trim()
            ? ` | Gate: ${activeStage.gateCriterion.trim()}`
            : '';
          return `• ${plan.title} (${passedStages.length}/${totalStages} gates${periodTag}) — Active: ${activeStage.title}${gateTxt}`;
        }
        return `• ${plan.title} (${passedStages.length}/${totalStages} gates${periodTag}) — All stages completed`;
      })
      .join('\n');
  };

  const renderRoadmapGatesCard = (
    periodStartDate: string,
    periodEndDate: string,
    periodLabel: 'quarter' | 'year'
  ) => {
    const totalStagesAll = strategyPlans.reduce((sum, p) => sum + p.stages.length, 0);
    const totalPassedAll = strategyPlans.reduce(
      (sum, p) => sum + p.stages.filter(s => s.gatePassed).length,
      0
    );
    const passedInPeriodAll = strategyPlans.reduce(
      (sum, p) =>
        sum +
        p.stages.filter(
          s =>
            s.gatePassed &&
            s.gatePassedAt &&
            s.gatePassedAt >= periodStartDate &&
            s.gatePassedAt <= periodEndDate
        ).length,
      0
    );

    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 flex items-center space-x-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>Written Strategy · Roadmap Gates</span>
            </span>
            <div className="flex items-center flex-wrap gap-2 mt-1">
              <h3 className="text-base font-extrabold text-slate-100">
                Stage-Gate Progress
              </h3>
              {strategyPlans.length > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[11px] font-bold">
                  {totalPassedAll}/{totalStagesAll} gates
                </span>
              )}
              {passedInPeriodAll > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono text-[10px] font-bold">
                  +{passedInPeriodAll} this {periodLabel}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveTab('planning');
              setPlanningSubTab('roadmaps');
            }}
            className="shrink-0 inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-300 transition-colors"
          >
            <span>Open Roadmaps</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {strategyPlans.length === 0 ? (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-2">
            <p>No Written Roadmaps created yet. Stage-Gate plans from Planning Hub appear here during macro reviews.</p>
            <button
              type="button"
              onClick={() => {
                setActiveTab('planning');
                setPlanningSubTab('roadmaps');
              }}
              className="text-emerald-400 hover:text-emerald-300 font-bold"
            >
              Create a Roadmap in Planning Hub →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {strategyPlans.map(plan => {
              const totalStages = plan.stages.length;
              const passedStages = plan.stages.filter(s => s.gatePassed);
              const activeStageIdx = plan.stages.findIndex(s => !s.gatePassed);
              const activeStage = activeStageIdx >= 0 ? plan.stages[activeStageIdx] : null;
              const lockedAheadCount =
                activeStageIdx >= 0 ? Math.max(0, totalStages - activeStageIdx - 1) : 0;
              const pct = totalStages > 0 ? Math.round((passedStages.length / totalStages) * 100) : 0;

              const activeGoalsTotal = activeStage?.proximalGoals.length || 0;
              const activeGoalsDone =
                activeStage?.proximalGoals.filter(g => g.completed).length || 0;

              return (
                <div
                  key={plan.id}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-extrabold text-slate-100 truncate">{plan.title}</div>
                    <span className="shrink-0 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] font-bold text-amber-300">
                      {passedStages.length}/{totalStages} gates
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {passedStages.length > 0 && (
                    <div className="space-y-1">
                      {passedStages.map(stage => {
                        const passedThisPeriod =
                          !!stage.gatePassedAt &&
                          stage.gatePassedAt >= periodStartDate &&
                          stage.gatePassedAt <= periodEndDate;
                        return (
                          <div
                            key={stage.id}
                            className="flex items-center justify-between gap-2 text-[11px] text-emerald-300/90"
                          >
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <Unlock className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="truncate">{stage.title}</span>
                            </div>
                            {passedThisPeriod ? (
                              <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 font-mono text-[10px] font-bold text-emerald-300">
                                Passed this {periodLabel} ({stage.gatePassedAt})
                              </span>
                            ) : (
                              <span className="shrink-0 font-mono text-[10px] text-emerald-500/80">
                                {stage.gatePassedAt ? `Passed ${stage.gatePassedAt}` : 'Passed'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeStage ? (
                    <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                          Current Gate
                        </span>
                        {activeGoalsTotal > 0 && (
                          <span className="font-mono text-[10px] font-bold text-slate-300">
                            {activeGoalsDone}/{activeGoalsTotal} goals
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-slate-100 text-xs">{activeStage.title}</div>
                      <div className="text-[11px] text-slate-300 leading-relaxed">
                        {activeStage.gateCriterion.trim() ? (
                          activeStage.gateCriterion.trim()
                        ) : (
                          <span className="text-slate-500 italic">No gate criterion defined yet.</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-bold text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>All stages unlocked &amp; passed</span>
                    </div>
                  )}

                  {lockedAheadCount > 0 && (
                    <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 pt-0.5">
                      <Lock className="w-3 h-3 shrink-0" />
                      <span>
                        +{lockedAheadCount} locked {lockedAheadCount === 1 ? 'stage' : 'stages'} ahead
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Top Unified Review Window Switcher Bar (Cleanly separated: Reviews by Scale vs. Ledgers) */}
      <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-2.5 sm:px-3.5 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl">

          <div className="flex items-center space-x-2.5 px-1.5 shrink-0">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                Review Hub
              </div>
              <div className="text-sm font-extrabold text-slate-100 whitespace-nowrap">
                {reviewSubTab === 'vault' && 'Review Vault'}
                {reviewSubTab === 'problems' && 'Problem Log'}
                {reviewSubTab === 'gws' && 'GWS Review'}
                {reviewSubTab === 'daily' && 'Daily Review'}
                {reviewSubTab === 'weekly' && 'Weekly Review'}
                {reviewSubTab === 'monthly' && 'Monthly Review'}
                {reviewSubTab === 'quarterly' && 'Quarterly Review'}
                {reviewSubTab === 'yearly' && 'Yearly Review'}
              </div>
            </div>
          </div>

          {/* Static Wrapping Controls: Group 1 (Reviews by Time Scale) + Group 2 (Ledgers) + Action */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">

            {/* Group 1: Time-Scale Reviews (Smallest -> Largest) */}
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-slate-950 border border-slate-800/80">
              {systemLevel >= 2 && (
                <button
                  type="button"
                  onClick={() => setReviewSubTab('gws')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    reviewSubTab === 'gws'
                      ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Timer className="w-3.5 h-3.5" />
                  <span>GWS</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setReviewSubTab('daily')}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  reviewSubTab === 'daily'
                    ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Daily</span>
              </button>

              {systemLevel >= 3 && (
                <button
                  type="button"
                  onClick={() => setReviewSubTab('weekly')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    reviewSubTab === 'weekly'
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
                  onClick={() => setReviewSubTab('monthly')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    reviewSubTab === 'monthly'
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
                  onClick={() => setReviewSubTab('quarterly')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    reviewSubTab === 'quarterly'
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
                  onClick={() => setReviewSubTab('yearly')}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    reviewSubTab === 'yearly'
                      ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Yearly</span>
                </button>
              )}
            </div>

            {/* Group 2: Cross-Cutting Ledgers (Problems & Vault) */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-950 border border-slate-800/80">
              <button
                type="button"
                onClick={() => setReviewSubTab('problems')}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  reviewSubTab === 'problems'
                    ? 'bg-orange-500 text-slate-950 shadow-sm shadow-orange-500/20'
                    : 'text-slate-300 hover:text-orange-300 hover:bg-slate-900'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Problems{activeProblemCount > 0 ? ` (${activeProblemCount})` : ''}</span>
              </button>

              <button
                type="button"
                onClick={() => setReviewSubTab('vault')}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  reviewSubTab === 'vault'
                    ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Vault ({allVaultItems.length})</span>
              </button>
            </div>

            {/* Compact Single-Plus Action Button */}
            <button
              type="button"
              onClick={() => {
                setCreateReviewType(
                  reviewSubTab === 'yearly'
                    ? 'yearly'
                    : reviewSubTab === 'quarterly'
                    ? 'quarterly'
                    : reviewSubTab === 'monthly'
                    ? 'monthly'
                    : reviewSubTab === 'weekly'
                    ? 'weekly'
                    : reviewSubTab === 'daily'
                    ? 'daily'
                    : 'weekly'
                );
                setShowCreateReviewModal(true);
              }}
              className="flex items-center space-x-1 px-3 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all active:scale-95 shrink-0"
              title="Quick-create a review entry"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>

          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 0.5: PROBLEM LOG & FEEDBACK LOOP LEDGER                           */}
      {/* ========================================================================= */}
      {reviewSubTab === 'problems' && (
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <ProblemsLedgerView />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 0: ALL REVIEWS VAULT (WHERE ALL REVIEWS LIVE)                     */}
      {/* ========================================================================= */}
      {reviewSubTab === 'vault' && (
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-6">
          
          {/* Header Banner & Filter Strip */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Master Review Archive
                </span>
                <h1 className="text-2xl font-extrabold text-slate-100 mt-2">
                  The Review Vault
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  The centralized archive where all your Daily Reviews, GWS Sprint Reflexions, and Weekly Retrospectives live.
                </p>
              </div>

              {/* Action + Total Counts Ticker */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setCreateReviewType('weekly');
                    setShowCreateReviewModal(true);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ New Review</span>
                </button>

                <div className="flex items-center space-x-2 text-xs font-mono">
                  <div className="px-3 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-slate-500 block text-[9px]">TOTAL</span>
                    <strong className="text-base text-amber-400 font-extrabold">{allVaultItems.length}</strong>
                  </div>
                  <div className="px-3 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-slate-500 block text-[9px]">YEARLY</span>
                    <strong className="text-base text-rose-400 font-extrabold">{yearlyVaultItems.length}</strong>
                  </div>
                  <div className="px-3 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-slate-500 block text-[9px]">QUARTERLY</span>
                    <strong className="text-base text-cyan-400 font-extrabold">{quarterlyVaultItems.length}</strong>
                  </div>
                  <div className="px-3 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-slate-500 block text-[9px]">MONTHLY</span>
                    <strong className="text-base text-purple-400 font-extrabold">{monthlyVaultItems.length}</strong>
                  </div>
                  <div className="px-3 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-slate-500 block text-[9px]">WEEKLY</span>
                    <strong className="text-base text-slate-200 font-extrabold">{weeklyVaultItems.length}</strong>
                  </div>
                  <div className="px-3 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-slate-500 block text-[9px]">DAILY</span>
                    <strong className="text-base text-slate-200 font-extrabold">{dailyVaultItems.length}</strong>
                  </div>
                  <div className="px-3 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-slate-500 block text-[9px]">GWS</span>
                    <strong className="text-base text-slate-200 font-extrabold">{gwsVaultItems.length}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Pills + Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
              
              {/* Type Filter Chips */}
              <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
                <button
                  onClick={() => setVaultFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    vaultFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  All ({allVaultItems.length})
                </button>

                <button
                  onClick={() => setVaultFilter('yearly')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    vaultFilter === 'yearly'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  Yearly ({yearlyVaultItems.length})
                </button>

                <button
                  onClick={() => setVaultFilter('quarterly')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    vaultFilter === 'quarterly'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  🏆 Quarterly ({quarterlyVaultItems.length})
                </button>

                <button
                  onClick={() => setVaultFilter('monthly')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    vaultFilter === 'monthly'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  📊 Monthly ({monthlyVaultItems.length})
                </button>

                <button
                  onClick={() => setVaultFilter('weekly')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    vaultFilter === 'weekly'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  🎯 Weekly ({weeklyVaultItems.length})
                </button>

                <button
                  onClick={() => setVaultFilter('daily')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    vaultFilter === 'daily'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  📅 Daily ({dailyVaultItems.length})
                </button>

                <button
                  onClick={() => setVaultFilter('gws')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    vaultFilter === 'gws'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  ⏱️ GWS ({gwsVaultItems.length})
                </button>
              </div>

              {/* Keyword Search */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  placeholder="Search all reviews, dates, blockers..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

            </div>

          </div>

          {/* Reviews Stream Feed */}
          <div className="space-y-4">
            {filteredVaultItems.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 text-slate-500 text-xs">
                No reviews found matching your search. Click "+ Create Review" above to write a review!
              </div>
            ) : (
              filteredVaultItems.map((item) => {
                const isCopied = copiedReviewId === item.id;

                const getTypeStyle = () => {
                  if (item.type === 'yearly') return {
                    label: 'Yearly Macro Review',
                    color: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                    icon: Compass
                  };
                  if (item.type === 'quarterly') return {
                    label: 'Quarterly Strategic Review',
                    color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
                    icon: Award
                  };
                  if (item.type === 'monthly') return {
                    label: 'Monthly Macro Review',
                    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                    icon: Layers
                  };
                  if (item.type === 'daily') return {
                    label: 'Daily Review',
                    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    icon: CalendarIcon
                  };
                  if (item.type === 'weekly') return {
                    label: 'Weekly Retrospective',
                    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    icon: Target
                  };
                  return {
                    label: 'GWS Sprint Reflexion',
                    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    icon: Timer
                  };
                };

                const typeStyle = getTypeStyle();
                const Icon = typeStyle.icon;

                return (
                  <div
                    key={item.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 sm:p-7 shadow-xl transition-all space-y-4"
                  >
                    {/* Top Row: Type, Title, Score, and Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      <div className="flex items-center space-x-3">
                        <span className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border ${typeStyle.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          <span>{typeStyle.label}</span>
                        </span>
                        
                        <span className="text-xs font-mono font-bold text-slate-400">
                          {item.dateOrPeriod}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 self-end sm:self-center">
                        {item.scoreBadge && (
                          <span className="text-xs font-mono font-extrabold px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-amber-400">
                            {item.scoreBadge}
                          </span>
                        )}

                        <button
                          onClick={() => handleCopyReview(item)}
                          className="flex items-center space-x-1 p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs transition-colors"
                          title="Copy Review as Markdown"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{isCopied ? 'Copied!' : 'Copy'}</span>
                        </button>

                        {item.jumpTarget && (
                          <button
                            onClick={item.jumpTarget}
                            className="flex items-center space-x-1 p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-400 hover:text-amber-300 border border-slate-800 text-xs transition-colors"
                            title="Jump to edit this review"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Inspect / Edit</span>
                          </button>
                        )}
                      </div>

                    </div>

                    <h3 className="text-base font-bold text-slate-100">
                      {item.title}
                    </h3>

                    {/* Context / Plan snippet if available */}
                    {item.plannedOrContext && (
                      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 whitespace-pre-wrap leading-relaxed">
                        {item.plannedOrContext}
                      </div>
                    )}

                    {/* Main Review Content Box */}
                    <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block">
                        Recorded Reflexions & Course Correction:
                      </span>
                      <p>{item.reviewContent}</p>
                    </div>

                    {/* Secondary Telemetry Details */}
                    {item.secondaryContent && (
                      <div className="text-[11px] text-slate-500 font-mono pt-2 border-t border-slate-800/80">
                        {item.secondaryContent}
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 1: DAILY REVIEW                                                  */}
      {/* ========================================================================= */}
      {reviewSubTab === 'daily' && (
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-8">
          
          {/* Day Navigation Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
            <div className="flex items-center space-x-3">
              <button
                onClick={goToPreviousDay}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center sm:text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reviewing Record for:</span>
                <div className="text-lg font-extrabold text-amber-400 font-mono">{selectedDate}</div>
              </div>
              <button
                onClick={goToNextDay}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics for the selected date */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-500">Tasks: </span>
                <strong className="text-slate-200 font-mono">{currentDailyEntry.mainTasksCompleted}/{currentDailyEntry.mainTasksTotal}</strong>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-500">Discipline: </span>
                <strong className="text-amber-400 font-mono">{currentDailyEntry.executionScore}/10</strong>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-500">Habits: </span>
                <strong className={currentDailyEntry.automaticTasksCompleted ? 'text-emerald-400' : 'text-slate-500'}>
                  {currentDailyEntry.automaticTasksCompleted ? 'Locked' : 'Pending'}
                </strong>
              </div>
            </div>
          </div>

          {/* Fast Data I/O Bar (Copy Plan / Copy Review separately) */}
          <QuickCopyPasteBar
            currentEntry={currentDailyEntry}
            gwsSessions={gwsSessions}
            onApplyParsedPlan={(tasksText) => {
              const existing = currentDailyEntry.planNotes ? `${currentDailyEntry.planNotes}\n` : '';
              saveDailyEntry(selectedDate, { planNotes: `${existing}${tasksText}` });
            }}
          />

          {/* Daily Review & Course Correction Editor */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left 5 cols: Telemetry & Day Plan Recap */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Daily Execution Score (1-10) Interactive Card */}
              {(() => {
                const todayGwsForScore = gwsSessions.filter(s => s.date === selectedDate);
                const todayGwsMinutesForScore = todayGwsForScore.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);
                const tasksPart =
                  (currentDailyEntry.mainTasksCompleted / Math.max(1, currentDailyEntry.mainTasksTotal)) * 6;
                const habitsPart = currentDailyEntry.automaticTasksCompleted ? 2 : 0;
                const gwsPart =
                  todayGwsForScore.length > 0 ? (todayGwsMinutesForScore >= 45 ? 2 : 1) : 0;
                const suggestedDailyScore = Math.max(
                  1,
                  Math.min(10, Math.round(tasksPart + habitsPart + gwsPart))
                );

                return (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Flame className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
                          Execution Discipline Score (1–10)
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => saveDailyEntry(selectedDate, { executionScore: suggestedDailyScore })}
                          className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-0.5 rounded-lg border border-emerald-500/30 transition-colors"
                          title={`Click to apply objective baseline from Tasks (${currentDailyEntry.mainTasksCompleted}/${currentDailyEntry.mainTasksTotal}), Auto Habits (${currentDailyEntry.automaticTasksCompleted ? 'Done' : 'No'}), and GWS (${todayGwsMinutesForScore}m)`}
                        >
                          Suggested from data: {suggestedDailyScore}/10
                        </button>
                        <span className="text-xs font-extrabold font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {currentDailyEntry.executionScore > 0 ? `${currentDailyEntry.executionScore}/10` : 'Not Rated'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-10 gap-1 pt-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => saveDailyEntry(selectedDate, { executionScore: score })}
                          className={`py-2 rounded-xl text-xs font-bold font-mono transition-all ${
                            currentDailyEntry.executionScore === score
                              ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 font-extrabold shadow-md shadow-amber-500/20'
                              : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
                      <span>1: Low Discipline</span>
                      <span>6: Solid Baseline</span>
                      <span>10: Flawless Beast</span>
                    </div>
                  </div>
                );
              })()}

              {/* Automatic Habits / Daily Checklist Card (Single Source of Truth) */}
              {(() => {
                const dailyChecklist = getActiveDailyChecklistItemsForDate(
                  selectedDate,
                  checklistItems,
                  dailyEntries,
                  todayDate
                );
                const activeIds = new Set(dailyChecklist.map(i => i.id));
                const dailyDoneCount = dailyChecklist.filter(i =>
                  (i.completedPeriods || []).includes(selectedDate)
                ).length;
                const allDailyChecklistDone =
                  dailyChecklist.length > 0 && dailyDoneCount === dailyChecklist.length;

                const toggleDailyChecklistItem = (itemId: string) => {
                  const updated = checklistItems.map(item => {
                    if (item.id !== itemId) return item;
                    const periods = item.completedPeriods || [];
                    const nextPeriods = periods.includes(selectedDate)
                      ? periods.filter(p => p !== selectedDate)
                      : [...periods, selectedDate];
                    return { ...item, completedPeriods: nextPeriods };
                  });
                  saveChecklistItems(updated);
                };

                const toggleAllDailyChecklistItems = () => {
                  const markDone = !allDailyChecklistDone;
                  const updated = checklistItems.map(item => {
                    if (!activeIds.has(item.id)) return item;
                    const periods = item.completedPeriods || [];
                    const hasDate = periods.includes(selectedDate);
                    if (markDone && !hasDate) {
                      return { ...item, completedPeriods: [...periods, selectedDate] };
                    }
                    if (!markDone && hasDate) {
                      return { ...item, completedPeriods: periods.filter(p => p !== selectedDate) };
                    }
                    return item;
                  });
                  saveChecklistItems(updated);
                };

                if (dailyChecklist.length === 0) {
                  return (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-100 block">
                          Daily Checklist ({selectedDate})
                        </span>
                        <span className="text-[11px] text-slate-400">
                          No daily checklist items were active on {selectedDate} (won&apos;t count as missed).
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          saveDailyEntry(selectedDate, {
                            automaticTasksCompleted: !currentDailyEntry.automaticTasksCompleted
                          })
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all shrink-0 ${
                          currentDailyEntry.automaticTasksCompleted
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {currentDailyEntry.automaticTasksCompleted ? 'Done' : 'Not Tracked'}
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              allDailyChecklistDone
                                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]'
                                : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]'
                            }`}
                          />
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
                            Daily Checklist ({selectedDate})
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Synced live with Checklist streaks & Weeks Matrix dot
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span
                          className={`text-xs font-mono font-bold ${
                            allDailyChecklistDone ? 'text-emerald-400' : 'text-slate-300'
                          }`}
                        >
                          {dailyDoneCount}/{dailyChecklist.length}
                        </span>
                        <button
                          type="button"
                          onClick={toggleAllDailyChecklistItems}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                            allDailyChecklistDone
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-emerald-500/40 hover:text-emerald-300'
                          }`}
                        >
                          {allDailyChecklistDone ? 'All Locked In' : 'Lock All'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {dailyChecklist.map(item => {
                        const checked = (item.completedPeriods || []).includes(selectedDate);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleDailyChecklistItem(item.id)}
                            className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl border text-left text-xs transition-all ${
                              checked
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                                : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            {checked ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                            <span className={checked ? 'line-through text-slate-400' : 'font-medium'}>
                              {item.text}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab('checklist')}
                        className="text-[11px] font-bold text-slate-400 hover:text-amber-400 transition-colors"
                      >
                        Edit routines in Checklist →
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Interactive Day Plan Recap */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    What Was Planned for {selectedDate}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-300">
                    {currentDailyEntry.mainTasksCompleted} / {currentDailyEntry.mainTasksTotal} Done
                  </span>
                </div>

                {getPriorityItemsForEntry(currentDailyEntry).length > 0 ? (
                  <div className="space-y-2">
                    {getPriorityItemsForEntry(currentDailyEntry).map((prio, idx) => (
                      <button
                        key={prio.id || idx}
                        type="button"
                        onClick={() => {
                          const updatedItems = getPriorityItemsForEntry(currentDailyEntry).map((item, i) =>
                            i === idx ? { ...item, completed: !item.completed } : item
                          );
                          saveDailyEntry(selectedDate, {
                            planNotes: formatPriorityItemsToPlanNotes(updatedItems),
                            priorityItems: updatedItems,
                            mainTasksCompleted: updatedItems.filter(i => i.completed).length,
                            mainTasksTotal: Math.max(3, updatedItems.length)
                          });
                        }}
                        className={`w-full flex items-center space-x-2.5 p-2.5 rounded-xl border text-left text-xs transition-all ${
                          prio.completed
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        {prio.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <span className="font-mono font-bold text-amber-400 shrink-0">#{idx + 1}</span>
                        <span className={prio.completed ? 'line-through text-slate-400' : ''}>{prio.text}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-mono text-slate-500">
                    No specific mission priorities logged for this date.
                  </div>
                )}
              </div>

              {/* GWS Sprints Logged Today (Data to Reflect On) */}
              {(() => {
                const todayGwsList = gwsSessions.filter(s => s.date === selectedDate);
                const todayGwsMinutes = todayGwsList.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);
                return (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Timer className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                          GWS Sprints Data to Reflect On ({todayGwsList.length})
                        </span>
                      </div>
                      {todayGwsList.length > 0 && (
                        <span className="text-xs font-mono font-bold text-amber-400">
                          {todayGwsMinutes}m total
                        </span>
                      )}
                    </div>

                    {todayGwsList.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-500">
                        No GWS sessions logged on {selectedDate}.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                        {todayGwsList.map((s) => (
                          <div key={s.id} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-100 truncate">{s.taskName}</span>
                              <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono font-bold shrink-0">
                                {s.actualMinutes}m • {s.ratings.total}/15
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
                              <span>Focus: <strong className="text-slate-200">{s.ratings.focus}/5</strong></span>
                              <span>Exec: <strong className="text-slate-200">{s.ratings.execution}/5</strong></span>
                              <span>Output: <strong className="text-slate-200">{s.ratings.output}/5</strong></span>
                            </div>
                            {s.reflexions.accomplished && (
                              <div className="text-[11px] text-slate-300">
                                <strong className="text-emerald-400">Done:</strong> {s.reflexions.accomplished}
                              </div>
                            )}
                            {s.reflexions.heldBack && (
                              <div className="text-[11px] text-slate-300">
                                <strong className="text-orange-400">Problem / Held Back:</strong> {s.reflexions.heldBack}
                              </div>
                            )}
                            {s.reflexions.improveNext && (
                              <div className="text-[11px] text-slate-300">
                                <strong className="text-amber-400">Improve Next:</strong> {s.reflexions.improveNext}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>

            {/* Right 7 cols: Structured Problems Logger + Daily Reflexion & Course Correction */}
            <div className="lg:col-span-7 space-y-6">
              {/* Section 1: Structured Problem Log & Feedback Loop */}
              <ProblemLoggerPanel
                mode="review"
                title="1. Problems Encountered & Bottlenecks"
                subtitle={`Log problems for ${selectedDate} (GWS sprint problems appear automatically) or tap +1 if an existing bottleneck recurred.`}
                sourceType="daily"
                date={selectedDate}
                sourceRef={selectedDate}
                targetWeekId={selectedWeekId}
                showAuditStrip={true}
              />

              {/* Section 2: Daily Reflexion & Course Correction */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
                <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                  <span>2. Daily Reflexion & Course Correction Note</span>
                </div>
                <p className="text-xs text-slate-400">
                  Specify concrete solutions and adjustments for tomorrow's work blocks (automatically surfaced on tomorrow's Daily Plan):
                </p>

                <textarea
                  value={currentDailyEntry.reviewNotes || ''}
                  onChange={(e) => saveDailyEntry(selectedDate, { reviewNotes: e.target.value })}
                  rows={5}
                  placeholder="Reflect on today's execution: What moved the needle? How will you solve today's problems tomorrow?"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-colors resize-y leading-relaxed"
                />

                <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-800">
                  <span>Autosaved to Review Vault & Tomorrow's Plan Carry-Over</span>
                  <span className="text-amber-400 font-mono">Updated</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: GWS SPRINT REVIEW                                             */}
      {/* ========================================================================= */}
      {reviewSubTab === 'gws' && (
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-8">
          
          {/* Key Sprint Stats Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-medium">Total Deep Work</span>
              <div className="text-3xl font-extrabold text-amber-400 font-mono mt-1">
                {totalGwsHours} <span className="text-xs text-slate-500">hours</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">From {gwsSessions.length} sprints</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-medium">Avg Sprint Score</span>
              <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-1">
                {avgGwsScore} <span className="text-xs text-slate-500">/ 15</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Performance index</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-medium">Score Breakdown</span>
              <div className="text-xs text-slate-200 mt-2 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Focus:</span>
                  <span className="text-amber-400 font-bold">{avgFocus} / 5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Execution:</span>
                  <span className="text-amber-400 font-bold">{avgExecution} / 5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Output:</span>
                  <span className="text-amber-400 font-bold">{avgOutput} / 5</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-medium">Logged Sprints</span>
              <div className="text-3xl font-extrabold text-sky-400 font-mono mt-1">
                {gwsSessions.length}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Recorded in database</span>
            </div>
          </div>

          {/* Deep Aggregators: Structured GWS Problem Log vs Improvement Commitments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* What held me back? (Structured GWS Problem Logger) */}
            <ProblemLoggerPanel
              mode="review"
              title='GWS Bottlenecks ("What held me back?")'
              subtitle="All structured problems logged during GWS sprints — assign fixes, push actions, or verify solved."
              sourceType="gws"
              filterSourceType="gws"
              date={selectedDate}
              sourceRef="GWS Review"
              targetWeekId={selectedWeekId}
            />

            {/* What will I improve next session? */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
              <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-amber-400">
                <Sparkles className="w-4 h-4" />
                <span>Actionable Commitments ("What will I improve next?")</span>
              </div>
              <p className="text-xs text-slate-400">
                Review whether you held yourself accountable to these pledged adjustments:
              </p>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {allImprovements.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    No improvement commitments recorded yet.
                  </p>
                ) : (
                  allImprovements.map((imp, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span className="text-amber-400">{imp.date}</span>
                        <span className="truncate max-w-[200px]">{imp.task}</span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">{imp.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Full GWS Sessions Search & Review List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Sprint Session History ({filteredGwsSessions.length})
                </h3>
                <p className="text-xs text-slate-400">Click to expand full reflexions and metrics</p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={gwsSearchQuery}
                  onChange={(e) => setGwsSearchQuery(e.target.value)}
                  placeholder="Search task, date, or reflexion..."
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {filteredGwsSessions.map((session) => {
                const isExpanded = expandedSessionId === session.id;

                return (
                  <div
                    key={session.id}
                    className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 cursor-pointer" onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}>
                        <div className="flex items-center space-x-2 text-[11px] font-mono">
                          <span className="text-amber-400 font-bold">{session.date}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">{session.actualMinutes}m actual</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-100 mt-1">{session.taskName}</h4>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/20">
                          {session.ratings.total}/15
                        </span>
                        <button
                          onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                          className="p-1 text-slate-400 hover:text-slate-200"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete GWS session: "${session.taskName}"?`)) {
                              deleteGWSSession(session.id);
                            }
                          }}
                          className="p-1 text-slate-600 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800/80 font-mono">
                          <span>Focus: <strong className="text-slate-100">{session.ratings.focus}/5</strong></span>
                          <span>Execution: <strong className="text-slate-100">{session.ratings.execution}/5</strong></span>
                          <span>Output: <strong className="text-slate-100">{session.ratings.output}/5</strong></span>
                        </div>
                        {session.reflexions.accomplished && (
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="font-semibold text-emerald-400 block mb-0.5">1. Accomplished:</span>
                            <p className="text-slate-300">{session.reflexions.accomplished}</p>
                          </div>
                        )}
                        {session.reflexions.heldBack && (
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="font-semibold text-orange-400 block mb-0.5">2. Held Back:</span>
                            <p className="text-slate-300">{session.reflexions.heldBack}</p>
                          </div>
                        )}
                        {session.reflexions.improveNext && (
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="font-semibold text-amber-400 block mb-0.5">3. Improve Next:</span>
                            <p className="text-slate-300">{session.reflexions.improveNext}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: WEEKLY REVIEW                                                 */}
      {/* ========================================================================= */}
      {reviewSubTab === 'weekly' && (
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-8">
          
          {/* Week Selector Bar with Clear "+ Create New Week to Review" button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-amber-500 text-slate-950 font-bold">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reviewing Cycle</span>
                <div className="text-lg font-extrabold text-slate-100">Week {targetPlanForReview.weekNumber}: {targetPlanForReview.focusTheme}</div>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1.5">
              {Object.values(weeklyPlans)
                .sort((a, b) => a.weekNumber - b.weekNumber)
                .map((p) => {
                  const isEmpty = p.tasks.length === 0 && !p.focusTheme.trim();
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedWeekId(p.id);
                        setReviewTargetWeekId(p.id);
                      }}
                      title={`Week ${p.weekNumber}: ${p.startDate} → ${p.endDate}`}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center space-x-1 ${
                        p.id === targetPlanForReview.id
                          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 shadow-md shadow-amber-500/20'
                          : isEmpty
                          ? 'bg-slate-950/60 text-slate-500 border border-dashed border-slate-800 hover:text-slate-300'
                          : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <span>Week {p.weekNumber}</span>
                      {isEmpty && p.id !== targetPlanForReview.id && (
                        <span className="text-[9px] uppercase text-slate-600 font-normal">Empty</span>
                      )}
                    </button>
                  );
                })}

              <button
                onClick={() => setShowNewWeekForm(true)}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-bold transition-colors"
                title="Create a new week to review"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Week</span>
              </button>
            </div>
          </div>

          {/* Inline Create New Week Form if open */}
          {showNewWeekForm && (
            <form onSubmit={handleCreateNewWeekDirect} className="p-6 rounded-3xl bg-slate-900 border border-amber-500/40 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Create Week {modalNewWeekNum} for Planning & Review</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewWeekForm(false)}
                  className="text-slate-400 hover:text-slate-100"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Week Number</label>
                  <input
                    type="number"
                    min={1}
                    value={modalNewWeekNum}
                    onChange={(e) => setModalNewWeekNum(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-mono font-bold text-amber-400 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Weekly Focus Theme</label>
                  <input
                    type="text"
                    value={modalNewWeekFocus}
                    onChange={(e) => setModalNewWeekFocus(e.target.value)}
                    placeholder="e.g. Scaling cohort & Miro trading roadmap"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewWeekForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                >
                  Create & Select Week {modalNewWeekNum}
                </button>
              </div>
            </form>
          )}

          {/* Goal Fulfillment & Unlocked Rewards Summary */}
          {(() => {
            const liveWeekAchieved = computeWeeklyAchievedScore(targetPlanForReview.tasks);
            return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Points Scored */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Points Fulfilled</span>
                <span className="text-2xl font-extrabold text-amber-400 font-mono">
                  {liveWeekAchieved} <span className="text-slate-500 text-sm">/ {targetPlanForReview.totalPossibleScore} pts</span>
                </span>
              </div>

              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((liveWeekAchieved / Math.max(1, targetPlanForReview.totalPossibleScore)) * 100))}%`
                  }}
                />
              </div>

              <div className="space-y-2 pt-2">
                {targetPlanForReview.tasks.length === 0 ? (
                  <p className="text-xs text-slate-500">No weekly deliverables logged for this week.</p>
                ) : (
                  targetPlanForReview.tasks.map((t) => (
                    <div key={t.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span className={t.completed ? 'line-through text-slate-500' : 'font-medium'}>
                          {t.completed ? '✓' : '•'} {t.text}
                        </span>
                        <span className="font-mono text-amber-400 shrink-0">{t.score} pts</span>
                      </div>
                      {t.subTasks && t.subTasks.length > 0 && (
                        <div className="pl-4 space-y-0.5">
                          {t.subTasks.map((sub) => (
                            <div key={sub.id} className="text-[11px] text-slate-400 flex items-center space-x-1.5">
                              <span>{sub.completed ? '☑' : '☐'}</span>
                              <span className={sub.completed ? 'line-through text-slate-500' : ''}>{sub.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Unlocked Reward Tiers */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-sky-400">
                  <Gift className="w-4 h-4" />
                  <span>Custom Weekly Rewards ({targetPlanForReview.rewards.length})</span>
                </div>
              </div>

              {targetPlanForReview.rewards.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-500 text-center">
                  No custom rewards configured for this week.
                </div>
              ) : (
                <div className="space-y-2">
                  {targetPlanForReview.rewards.map((r) => {
                    const unlocked = liveWeekAchieved >= r.minScore;
                    return (
                      <div
                        key={r.id}
                        className={`flex items-center justify-between p-3 rounded-2xl border text-xs ${
                          unlocked
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 font-medium'
                            : 'bg-slate-950/60 border-slate-800 text-slate-500'
                        }`}
                      >
                        <span>{r.minScore}+ Points: {r.reward || 'Unnamed reward'}</span>
                        <span className="font-bold uppercase text-[10px]">
                          {unlocked ? 'Unlocked 🎖️' : `${Math.round((r.minScore - liveWeekAchieved) * 10) / 10} pts needed`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
            );
          })()}

          {/* Week GWS Sprints & Daily Problems (Data to Reflect On) */}
          {(() => {
            const weekGwsList = gwsSessions.filter(
              s => s.date >= targetPlanForReview.startDate && s.date <= targetPlanForReview.endDate
            );
            const weekGwsMinutes = weekGwsList.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);

            return (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                    <Timer className="w-4 h-4" />
                    <span>Week GWS Sprints ({weekGwsList.length})</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {(weekGwsMinutes / 60).toFixed(1)}h deep work
                  </span>
                </div>
                {weekGwsList.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-500">
                    No GWS sprints logged between {targetPlanForReview.startDate} and {targetPlanForReview.endDate}.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                    {weekGwsList.map((s) => (
                      <div key={s.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-200 truncate">{s.taskName}</span>
                          <span className="font-mono text-amber-400 shrink-0">{s.date.slice(5)} • {s.actualMinutes}m • {s.ratings.total}/15</span>
                        </div>
                        {s.reflexions.accomplished && (
                          <p className="text-[11px] text-slate-400 truncate">Done: {s.reflexions.accomplished}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Write Weekly Course Correction Form */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Weekly Retrospective & Course Correction
              </span>
              <h2 className="text-xl font-extrabold text-slate-100 mt-2">
                Review Week {targetPlanForReview.weekNumber}{targetPlanForReview.focusTheme ? `: ${targetPlanForReview.focusTheme}` : ''}
              </h2>
            </div>

            <form onSubmit={handleSaveWeeklyReview} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">1. What went well & what shipped?</label>
                <textarea
                  value={winsText}
                  onChange={(e) => {
                    setWinsText(e.target.value);
                    saveWeeklyPlan({ ...targetPlanForReview, winsNotes: e.target.value });
                  }}
                  placeholder="Completed milestones, systems built, breakthrough insights..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl p-3 text-xs text-slate-200 focus:outline-none resize-none"
                />
              </div>

              <ProblemLoggerPanel
                mode="review"
                title={`2. Week ${targetPlanForReview.weekNumber} Problems & Active Fixes`}
                subtitle={`Automatically rolls up every GWS, Daily, and Weekly problem from ${targetPlanForReview.startDate} to ${targetPlanForReview.endDate}. Assign fixes or verify whether active fixes held.`}
                sourceType="weekly"
                date={targetPlanForReview.endDate}
                sourceRef={targetPlanForReview.id}
                dateRange={{
                  startDate: targetPlanForReview.startDate,
                  endDate: targetPlanForReview.endDate
                }}
                targetWeekId={targetPlanForReview.id}
                showAuditStrip={true}
              />

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400">3. Course corrections for next week</label>
                <textarea
                  value={courseCorrectionsText}
                  onChange={(e) => {
                    setCourseCorrectionsText(e.target.value);
                    saveWeeklyPlan({ ...targetPlanForReview, courseCorrectionNotes: e.target.value });
                  }}
                  placeholder="What needs to happen? What needs to be learned? What systems now and what to buy?"
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-xs text-slate-100 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20"
              >
                Save Week {targetPlanForReview.weekNumber} Retrospective & Send to Vault
              </button>
            </form>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: MONTHLY REVIEW (CONTAINS ALL WEEKLY, DAILY & GWS DATA)         */}
      {/* ========================================================================= */}
      {reviewSubTab === 'monthly' && (() => {
        const mData = compileMonthData(selectedMonth);
        const monthScore = mData.saved?.score || 0;
        const monthWins = mData.saved?.wins || '';
        const monthProblems = mData.saved?.blockers || '';
        const monthCorrections = mData.saved?.courseCorrections || '';

        const handleToggleMonthlyGoalInReview = (goalId: string) => {
          const updatedTasks = mData.monthGoals.map(g =>
            g.id === goalId ? { ...g, completed: !g.completed } : g
          );
          saveMonthlyPlan({ ...mData.monthPlan, tasks: updatedTasks });
        };

        const handleCopyMonthlyPlain = () => {
          let text = `${mData.info.label} (${mData.info.monthKey}) — Monthly Review\n\n`;
          text += `Monthly Focus: ${mData.monthPlan.focusTheme || 'Not set'}\n`;
          text += `Monthly Goals: ${mData.completedMonthGoals}/${mData.totalMonthGoals} completed\n`;
          text += `Monthly Score: ${monthScore > 0 ? `${monthScore}/10` : 'Unscored'}\n`;
          text += `Weekly Points: ${mData.weeklyPointsAchieved}/${mData.weeklyPointsPossible} pts across ${mData.weeks.length} weeks (Avg ${mData.avgWeeklyScore}/10)\n`;
          text += `Daily Execution: ${mData.days.length} days logged • Avg Discipline ${mData.avgDailyScore}/10 • Tasks ${mData.dailyTasksDone}/${mData.dailyTasksTotal} • Habits ${mData.habitRatePct}%\n`;
          text += `GWS Deep Work: ${mData.gwsHours}h across ${mData.gws.length} sprints (Avg ${mData.avgGwsTotal}/15)\n`;

          if (monthWins.trim()) {
            text += `\n1. Monthly Wins & Shipped:\n${monthWins.trim()}\n`;
          }
          const monthStructuredProblems = formatProblemsForReviewText(
            problems.filter(p => problemOccurredInRange(p, mData.info.startDate, mData.info.endDate))
          );
          if (monthStructuredProblems) {
            text += `\n2. Problems Encountered & Bottlenecks:\n${monthStructuredProblems}\n`;
          } else if (monthProblems.trim()) {
            text += `\n2. Problems Encountered & Bottlenecks:\n${monthProblems.trim()}\n`;
          }
          if (monthCorrections.trim()) {
            text += `\n3. Monthly Course Corrections:\n${monthCorrections.trim()}\n`;
          }

          navigator.clipboard.writeText(text.trim());
          setCopiedMacroType('monthly');
          setTimeout(() => setCopiedMacroType(null), 2500);
        };

        const prevMonthKey = shiftMonthKey(selectedMonth, -1);
        const prevMonthCorrection = getSavedMonthlyReview(prevMonthKey)?.courseCorrections?.trim();

        return (
          <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-8">
            {/* Month Navigation & Quick Switcher Bar */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, -1))}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-400 block">
                    Monthly Multi-Scale Review ({mData.info.startDate} → {mData.info.endDate})
                  </span>
                  <div className="text-xl font-extrabold text-slate-100">{mData.info.label}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, 1))}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Next Month"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-end">
                {allKnownMonths.map(mKey => (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => setSelectedMonth(mKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                      mKey === selectedMonth
                        ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/20'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {mKey}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleCopyMonthlyPlain}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedMacroType === 'monthly' ? 'Copied Monthly Review!' : 'Copy Monthly Review'}</span>
                </button>
              </div>
            </div>

            {prevMonthCorrection && (
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-purple-500/30 flex items-start space-x-2.5 text-xs">
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold uppercase tracking-wider text-[10px] text-purple-400 mr-2">
                    Target Focus from Last Month ({prevMonthKey} Course Correction):
                  </span>
                  <span className="text-slate-200">"{prevMonthCorrection}"</span>
                </div>
              </div>
            )}

            {/* Top 4 Aggregated Telemetry Cards from Smaller Scales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                  Weekly Reviews in Month ({mData.weeks.length})
                </span>
                <div className="text-2xl font-extrabold font-mono text-slate-100">
                  {mData.weeklyPointsAchieved} <span className="text-xs text-slate-500">/ {mData.weeklyPointsPossible} pts</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Avg {mData.avgWeeklyScore}/10 • {mData.weeklyTasksDone}/{mData.weeklyTasksTotal} weekly goals done
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-400">
                  Daily Reviews in Month ({mData.days.length})
                </span>
                <div className="text-2xl font-extrabold font-mono text-slate-100">
                  {mData.avgDailyScore} <span className="text-xs text-slate-500">/ 10 avg score</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Tasks: {mData.dailyTasksDone}/{mData.dailyTasksTotal} • Habits: {mData.habitRatePct}% locked
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                  GWS Sprints in Month ({mData.gws.length})
                </span>
                <div className="text-2xl font-extrabold font-mono text-slate-100">
                  {mData.gwsHours} <span className="text-xs text-slate-500">hours deep work</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Avg Sprint Score: {mData.avgGwsTotal} / 15
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-400">
                    Monthly Score (1–10)
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-300">
                    {monthScore > 0 ? `${monthScore}/10` : 'Unscored'}
                  </span>
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(sc => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => upsertMonthlyReview(selectedMonth, { score: sc })}
                      className={`py-1.5 rounded-lg text-[11px] font-bold font-mono transition-all ${
                        monthScore === sc
                          ? 'bg-purple-500 text-slate-950 font-extrabold shadow'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {sc}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Monthly Plan Alignment Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    Monthly Plan Alignment ({mData.info.label})
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-100 mt-2">
                    Monthly Focus, Notes & Deliverables Audit
                  </h2>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-mono text-purple-300 font-bold">
                    {mData.completedMonthGoals} / {mData.totalMonthGoals} goals done
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('planning');
                      setPlanningSubTab('monthly');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-purple-300 border border-slate-800 text-xs font-bold transition-colors"
                  >
                    Open Monthly Plan →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400 block">
                    Monthly Focus & Main Outcome
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {mData.monthPlan.focusTheme || 'Define your Monthly Focus in Planning Hub → Monthly Plan.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 block">
                    Monthly Strategy & Notes
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {mData.monthPlan.notes || 'Define your Monthly Notes in Planning Hub → Monthly Plan.'}
                  </p>
                </div>
              </div>

              {mData.monthGoals.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-500">
                  No Monthly goals logged for {mData.info.label} yet. Add them in Planning Hub → Monthly Plan.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {mData.monthGoals.map(goal => (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => handleToggleMonthlyGoalInReview(goal.id)}
                      className={`w-full flex items-start space-x-2.5 p-3 rounded-2xl border text-left text-xs transition-colors ${
                        goal.completed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                          : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-purple-500/40'
                      }`}
                    >
                      {goal.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      )}
                      <span className={goal.completed ? 'line-through text-slate-400' : ''}>
                        {goal.text}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Smaller Time-Scale Reviews Container (Weekly + Daily + GWS) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-400">
                    All Contained Smaller-Scale Reviews ({mData.info.label})
                  </span>
                  <h2 className="text-lg font-extrabold text-slate-100 mt-0.5">
                    Weekly Retrospectives, Daily Reviews & GWS Sprints in {mData.info.label}
                  </h2>
                </div>

                <div className="flex items-center space-x-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800 overflow-x-auto">
                  {(
                    [
                      { id: 'all', label: `All Scales (${mData.weeks.length + mData.days.length + mData.gws.length})` },
                      { id: 'weekly', label: `Weekly (${mData.weeks.length})` },
                      { id: 'daily', label: `Daily (${mData.days.length})` },
                      { id: 'gws', label: `GWS (${mData.gws.length})` }
                    ] as const
                  ).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMonthlyScaleFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        monthlyScaleFilter === tab.id
                          ? 'bg-purple-500 text-slate-950'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. Weekly Reviews in this Month */}
              {(monthlyScaleFilter === 'all' || monthlyScaleFilter === 'weekly') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                      <Target className="w-4 h-4" />
                      <span>1. Weekly Plans & Retrospectives in {mData.info.label} ({mData.weeks.length})</span>
                    </span>
                  </div>

                  {mData.weeks.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-500">
                      No weekly plans or retrospectives recorded during {mData.info.label}.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {mData.weeks.map(w => (
                        <div key={w.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="font-extrabold text-amber-400 font-mono">
                                Week {w.weekNumber} ({w.startDate} → {w.endDate})
                              </span>
                              <div className="font-bold text-slate-100 mt-0.5">{w.focusTheme || 'No theme set'}</div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono font-bold">
                                {w.achievedScore}/{w.totalPossibleScore} pts
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  selectWeekGlobal(w.id);
                                  setReviewSubTab('weekly');
                                }}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                                title="Inspect Week Review"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {w.tasks.length > 0 && (
                            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                Weekly Deliverables ({w.tasks.filter(t => t.completed).length}/{w.tasks.length} Done):
                              </span>
                              {w.tasks.map(t => (
                                <div key={t.id} className="text-[11px] flex items-center justify-between text-slate-300">
                                  <span className={t.completed ? 'line-through text-slate-500' : ''}>
                                    {t.completed ? '[x]' : '[ ]'} {t.text}
                                  </span>
                                  <span className="font-mono text-amber-400">{t.score}pts</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {w.winsNotes?.trim() && (
                            <div className="text-[11px] text-slate-300">
                              <strong className="text-emerald-400">Wins & Shipped:</strong> {w.winsNotes.trim()}
                            </div>
                          )}
                          {w.problemsEncountered?.trim() && (
                            <div className="text-[11px] text-slate-300">
                              <strong className="text-orange-400">Problems Encountered:</strong> {w.problemsEncountered.trim()}
                            </div>
                          )}
                          {(w.courseCorrectionNotes || w.reviewNotes)?.trim() && (
                            <div className="text-[11px] text-slate-300">
                              <strong className="text-amber-400">Course Correction:</strong>{' '}
                              {(w.courseCorrectionNotes || w.reviewNotes)!.trim()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 2. Daily Reviews in this Month */}
              {(monthlyScaleFilter === 'all' || monthlyScaleFilter === 'daily') && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-blue-400 flex items-center space-x-1.5">
                    <CalendarIcon className="w-4 h-4" />
                    <span>2. Daily Plans & Reviews in {mData.info.label} ({mData.days.length})</span>
                  </span>

                  {mData.days.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-500">
                      No daily entries or reviews recorded during {mData.info.label}.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                      {mData.days.map(d => (
                        <div key={d.date} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-extrabold text-blue-400">{d.date}</span>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-[11px] text-slate-300">
                                Tasks: {d.mainTasksCompleted}/{d.mainTasksTotal}
                              </span>
                              <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono font-bold text-[11px]">
                                {d.executionScore > 0 ? `${d.executionScore}/10` : 'Unscored'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  selectDateGlobal(d.date);
                                  setReviewSubTab('daily');
                                }}
                                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                                title="Inspect Daily Review"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {d.planNotes?.trim() && (
                            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 font-mono text-[11px] text-slate-400 whitespace-pre-wrap">
                              {d.planNotes.trim()}
                            </div>
                          )}
                          {d.problemsEncountered?.trim() && (
                            <div className="text-[11px] text-slate-300">
                              <strong className="text-orange-400">Problems:</strong> {d.problemsEncountered.trim()}
                            </div>
                          )}
                          {d.reviewNotes?.trim() && (
                            <div className="text-[11px] text-slate-300">
                              <strong className="text-emerald-400">Reflexion:</strong> {d.reviewNotes.trim()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. GWS Sprints in this Month */}
              {(monthlyScaleFilter === 'all' || monthlyScaleFilter === 'gws') && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                    <Timer className="w-4 h-4" />
                    <span>3. GWS Deep Work Sprints in {mData.info.label} ({mData.gws.length})</span>
                  </span>

                  {mData.gws.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-500">
                      No GWS deep work sprints logged during {mData.info.label}.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                      {mData.gws.map(s => (
                        <div key={s.id} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-100 truncate">{s.taskName}</span>
                            <span className="font-mono text-[11px] text-amber-400 shrink-0">
                              {s.date} • {s.actualMinutes}m • {s.ratings.total}/15
                            </span>
                          </div>
                          {s.reflexions.accomplished && (
                            <p className="text-[11px] text-slate-300">
                              <strong className="text-emerald-400">Done:</strong> {s.reflexions.accomplished}
                            </p>
                          )}
                          {s.reflexions.heldBack && (
                            <p className="text-[11px] text-slate-300">
                              <strong className="text-orange-400">Held Back:</strong> {s.reflexions.heldBack}
                            </p>
                          )}
                          {s.reflexions.improveNext && (
                            <p className="text-[11px] text-slate-300">
                              <strong className="text-amber-400">Improve Next:</strong> {s.reflexions.improveNext}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Monthly Synthesis & Course Correction Editor */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Monthly Retrospective & Course Correction
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-100 mt-2">
                    Synthesize {mData.info.label}
                  </h2>
                </div>

                {(mData.rolledUpWins.length > 0 || mData.rolledUpCorrections.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      upsertMonthlyReview(selectedMonth, {
                        wins: mergeUniqueLines(monthWins, mData.rolledUpWins),
                        courseCorrections: mergeUniqueLines(monthCorrections, mData.rolledUpCorrections)
                      });
                    }}
                    className="px-4 py-2 rounded-2xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all"
                  >
                    + Pull Weekly Wins & Corrections
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      1. Monthly Wins, Shipped Systems & Major Milestones
                    </label>
                    {mData.rolledUpWins.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          upsertMonthlyReview(selectedMonth, {
                            wins: mergeUniqueLines(monthWins, mData.rolledUpWins)
                          })
                        }
                        className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
                      >
                        + Pull Weekly & GWS Wins ({mData.rolledUpWins.length})
                      </button>
                    )}
                  </div>
                  <textarea
                    value={monthWins}
                    onChange={e => upsertMonthlyReview(selectedMonth, { wins: e.target.value })}
                    rows={4}
                    placeholder="What major deliverables, habits, and breakthroughs shipped this month?"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-2xl p-4 text-xs text-slate-200 focus:outline-none leading-relaxed"
                  />
                </div>

                <ProblemLoggerPanel
                  mode="review"
                  title="2. Problems Encountered & Systemic Bottlenecks"
                  subtitle={`All problems logged across GWS, Daily, Weekly, and Monthly reviews during ${mData.info.label} (${mData.info.startDate} → ${mData.info.endDate}).`}
                  sourceType="monthly"
                  date={mData.info.endDate}
                  sourceRef={selectedMonth}
                  dateRange={{ startDate: mData.info.startDate, endDate: mData.info.endDate }}
                  targetWeekId={selectedWeekId}
                />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      3. Monthly Course Correction & Next Month Focus
                    </label>
                    {mData.rolledUpCorrections.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          upsertMonthlyReview(selectedMonth, {
                            courseCorrections: mergeUniqueLines(monthCorrections, mData.rolledUpCorrections)
                          })
                        }
                        className="text-[11px] font-bold text-amber-400 hover:text-amber-300"
                      >
                        + Pull Weekly & Daily Course Corrections ({mData.rolledUpCorrections.length})
                      </button>
                    )}
                  </div>
                  <textarea
                    value={monthCorrections}
                    onChange={e => upsertMonthlyReview(selectedMonth, { courseCorrections: e.target.value })}
                    rows={4}
                    placeholder="What structural adjustments, systems, or rule changes will you lock in for next month?"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-xs text-slate-200 focus:outline-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                  <span>Autosaved to Review Vault & included in {mData.info.quarterKey} Quarterly Review</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedQuarter(mData.info.quarterKey);
                      setReviewSubTab('quarterly');
                    }}
                    className="text-cyan-400 hover:text-cyan-300 font-bold"
                  >
                    View in {mData.info.quarterKey} Quarterly Review →
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* SUB-TAB 5: QUARTERLY REVIEW (SYNTHESIS-FIRST, 1-LEVEL-DOWN + ROADMAPS)    */}
      {/* ========================================================================= */}
      {reviewSubTab === 'quarterly' && (() => {
        const qData = compileQuarterData(selectedQuarter);
        const quarterScore = qData.saved?.score || 0;
        const quarterWins = qData.saved?.wins || '';
        const quarterProblems = qData.saved?.blockers || '';
        const quarterStopDoing = qData.saved?.stopDoing || '';
        const quarterDoubleDown = qData.saved?.doubleDown || '';
        const quarterCorrections = qData.saved?.courseCorrections || '';
        const reviewedMonthsCount = qData.monthsData.filter(
          m =>
            !!m.saved?.wins?.trim() ||
            !!m.saved?.courseCorrections?.trim() ||
            (m.saved?.score ?? 0) > 0
        ).length;

        const handleCopyQuarterlyPlain = () => {
          let text = `${qData.info.label} — Quarterly Strategic Review\n\n`;
          text += `Quarterly Score: ${quarterScore > 0 ? `${quarterScore}/10` : 'Unscored'}\n`;
          text += `Months Reviewed: ${reviewedMonthsCount}/3 (${qData.info.months.join(', ')})\n`;
          text += `Weekly Execution: Avg ${qData.avgWeeklyScore}/10 (${qData.weeklyPointsAchieved}/${qData.weeklyPointsPossible} pts · ${qData.weeks.length} weeks)\n`;
          text += `Daily Discipline: Avg ${qData.avgDailyScore}/10 (${qData.days.length}d · Habits ${qData.habitRatePct}%)\n`;
          text += `GWS Deep Work: ${qData.gwsHours}h (${qData.gws.length} sprints · Avg ${qData.avgGwsTotal}/15)\n`;

          const roadmapsSummary = formatRoadmapsForReviewText(qData.info.startDate, qData.info.endDate);
          if (roadmapsSummary) {
            text += `\nRoadmap Gates Progress:\n${roadmapsSummary}\n`;
          }

          if (quarterWins.trim()) {
            text += `\n1. Biggest Wins & Breakthroughs:\n${quarterWins.trim()}\n`;
          }
          const quarterStructuredProblems = formatProblemsForReviewText(
            problems.filter(p => problemOccurredInRange(p, qData.info.startDate, qData.info.endDate))
          );
          if (quarterStructuredProblems) {
            text += `\n2. Top Constraints & Recurring Bottlenecks:\n${quarterStructuredProblems}\n`;
          } else if (quarterProblems.trim()) {
            text += `\n2. Top Constraints & Recurring Bottlenecks:\n${quarterProblems.trim()}\n`;
          }
          if (quarterStopDoing.trim()) {
            text += `\n3. Stop Doing / Cut:\n${quarterStopDoing.trim()}\n`;
          }
          if (quarterDoubleDown.trim()) {
            text += `\n4. Double Down On:\n${quarterDoubleDown.trim()}\n`;
          }
          if (quarterCorrections.trim()) {
            text += `\n5. Next Quarter Thesis & Primary Focus:\n${quarterCorrections.trim()}\n`;
          }

          navigator.clipboard.writeText(text.trim());
          setCopiedMacroType('quarterly');
          setTimeout(() => setCopiedMacroType(null), 2500);
        };

        const prevQuarterKey = shiftQuarterKey(selectedQuarter, -1);
        const prevQuarterCorrection = getSavedQuarterlyReview(prevQuarterKey)?.courseCorrections?.trim();

        return (
          <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-6">
            {/* Quarter Navigation & Quick Switcher Bar */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setSelectedQuarter(shiftQuarterKey(selectedQuarter, -1))}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Previous Quarter"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 block">
                    Quarterly Strategic Review ({qData.info.startDate} → {qData.info.endDate})
                  </span>
                  <div className="text-xl font-extrabold text-slate-100">{qData.info.label}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedQuarter(shiftQuarterKey(selectedQuarter, 1))}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Next Quarter"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-end">
                {allKnownQuarters.map(qKey => (
                  <button
                    key={qKey}
                    type="button"
                    onClick={() => setSelectedQuarter(qKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                      qKey === selectedQuarter
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {qKey}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleCopyQuarterlyPlain}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedMacroType === 'quarterly' ? 'Copied Quarterly Review!' : 'Copy Quarterly Review'}</span>
                </button>
              </div>
            </div>

            {prevQuarterCorrection && (
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-cyan-500/30 flex items-start space-x-2.5 text-xs">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold uppercase tracking-wider text-[10px] text-cyan-400 mr-2">
                    Target Thesis from Last Quarter ({prevQuarterKey}):
                  </span>
                  <span className="text-slate-200">"{prevQuarterCorrection}"</span>
                </div>
              </div>
            )}

            {/* Compact 1-Line Quarter Telemetry Strip */}
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400">Months Reviewed</span>
                <span className="font-mono font-bold text-slate-100">{reviewedMonthsCount}/3</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">Weekly Avg</span>
                <span className="font-mono font-bold text-slate-100">
                  {qData.avgWeeklyScore}/10
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  ({qData.weeklyPointsAchieved}/{qData.weeklyPointsPossible} pts · {qData.weeks.length}w)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">Daily Discipline</span>
                <span className="font-mono font-bold text-slate-100">{qData.avgDailyScore}/10</span>
                <span className="font-mono text-[11px] text-slate-400">
                  ({qData.days.length}d · {qData.habitRatePct}% habits)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Deep Work</span>
                <span className="font-mono font-bold text-slate-100">{qData.gwsHours}h</span>
                <span className="font-mono text-[11px] text-slate-400">
                  ({qData.gws.length} sprints · {qData.avgGwsTotal}/15)
                </span>
              </div>
            </div>

            {/* Synthesis-First 2-Column Strategic Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT (7 cols): Quarterly Strategic Synthesis FIRST */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Quarterly Strategic Synthesis
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-100 mt-2">
                      Synthesize {qData.info.label}
                    </h2>
                  </div>

                  {/* Integrated Quarter Score (1-10) */}
                  <div className="space-y-1.5 shrink-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                        Quarter Score
                      </span>
                      <span className="text-xs font-mono font-bold text-cyan-300">
                        {quarterScore > 0 ? `${quarterScore}/10` : 'Unscored'}
                      </span>
                    </div>
                    <div className="grid grid-cols-10 gap-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(sc => (
                        <button
                          key={sc}
                          type="button"
                          onClick={() => upsertQuarterlyReview(selectedQuarter, { score: sc })}
                          className={`w-7 py-1 rounded-lg text-[11px] font-bold font-mono transition-all ${
                            quarterScore === sc
                              ? 'bg-cyan-500 text-slate-950 font-extrabold shadow'
                              : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          {sc}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                      1. Biggest Wins &amp; Breakthroughs
                    </label>
                    <textarea
                      value={quarterWins}
                      onChange={e => upsertQuarterlyReview(selectedQuarter, { wins: e.target.value })}
                      rows={4}
                      placeholder="What major deliverables, systems, or capability leaps actually moved the needle this quarter?"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-2xl p-4 text-xs text-slate-200 focus:outline-none leading-relaxed"
                    />
                  </div>

                  <ProblemLoggerPanel
                    mode="review"
                    title="2. Top Constraints & Recurring Bottlenecks"
                    subtitle={`Core problems & bottlenecks surfaced during ${qData.info.label} (${qData.info.startDate} → ${qData.info.endDate}).`}
                    sourceType="quarterly"
                    date={qData.info.endDate}
                    sourceRef={selectedQuarter}
                    dateRange={{ startDate: qData.info.startDate, endDate: qData.info.endDate }}
                    targetWeekId={selectedWeekId}
                  />

                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                      3. Strategic Cuts vs. Bets
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-orange-400 block">
                          Stop Doing / Cut
                        </label>
                        <textarea
                          value={quarterStopDoing}
                          onChange={e => upsertQuarterlyReview(selectedQuarter, { stopDoing: e.target.value })}
                          rows={3}
                          placeholder="Low-ROI commitments, bad habits, or distractions to stop next quarter..."
                          className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500/50 rounded-2xl p-3.5 text-xs text-slate-200 focus:outline-none leading-relaxed"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                          Double Down On
                        </label>
                        <textarea
                          value={quarterDoubleDown}
                          onChange={e => upsertQuarterlyReview(selectedQuarter, { doubleDown: e.target.value })}
                          rows={3}
                          placeholder="High-leverage habits, strategies, or systems that worked and deserve more energy..."
                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-2xl p-3.5 text-xs text-slate-200 focus:outline-none leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                      4. Next Quarter Thesis &amp; Primary Focus
                    </label>
                    <textarea
                      value={quarterCorrections}
                      onChange={e => upsertQuarterlyReview(selectedQuarter, { courseCorrections: e.target.value })}
                      rows={4}
                      placeholder="What is your single core thesis and top 1–2 Roadmap Gate targets for next quarter?"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-xs text-slate-200 focus:outline-none leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                    <span>Autosaved to Review Vault &amp; Cloud Sync</span>
                    <button
                      type="button"
                      onClick={() => setReviewSubTab('vault')}
                      className="text-amber-400 hover:text-amber-300 font-bold"
                    >
                      Open Review Vault →
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT (5 cols): 1 Level Down Only — Roadmap Gates + 3 Months */}
              <div className="lg:col-span-5 space-y-6">
                {renderRoadmapGatesCard(qData.info.startDate, qData.info.endDate, 'quarter')}

                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-400 flex items-center space-x-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        <span>1 Level Down · 3 Months</span>
                      </span>
                      <h3 className="text-base font-extrabold text-slate-100 mt-1">
                        Monthly Reviews in {qData.info.quarterKey}
                      </h3>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 font-bold">
                      {reviewedMonthsCount}/3 written
                    </span>
                  </div>

                  <div className="space-y-3">
                    {qData.monthsData.map(m => (
                      <div
                        key={m.info.monthKey}
                        className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-mono text-[10px] text-purple-400 font-bold">
                              {m.info.monthKey}
                            </span>
                            <div className="font-extrabold text-slate-100 text-sm truncate">
                              {m.info.label}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono font-bold text-[11px]">
                              {m.saved?.score ? `${m.saved.score}/10` : `${m.weeklyPointsAchieved}/${m.weeklyPointsPossible} pts`}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMonth(m.info.monthKey);
                                setReviewSubTab('monthly');
                              }}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-[11px] font-bold"
                              title="Open Monthly Review"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="font-mono text-[11px] text-slate-400">
                          {m.weeks.length}w · {m.days.length}d · {m.gwsHours}h GWS · {m.completedMonthGoals}/{m.totalMonthGoals} goals
                        </div>

                        {m.saved?.wins?.trim() || m.saved?.courseCorrections?.trim() ? (
                          <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                            {m.saved?.wins?.trim() && (
                              <p className="text-[11px] text-slate-300 line-clamp-3 leading-relaxed">
                                <strong className="text-emerald-400">Wins:</strong> {m.saved.wins.trim()}
                              </p>
                            )}
                            {m.saved?.courseCorrections?.trim() && (
                              <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                                <strong className="text-amber-400">Correction:</strong>{' '}
                                {m.saved.courseCorrections.trim()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-800/80">
                            Monthly review not written yet — click Open to synthesize.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* SUB-TAB 6: YEARLY REVIEW (SYNTHESIS-FIRST, 1-LEVEL-DOWN + ROADMAPS)       */}
      {/* ========================================================================= */}
      {reviewSubTab === 'yearly' && (() => {
        const yData = compileYearData(selectedYear);
        const yearScore = yData.saved?.score || 0;
        const yearHeadline = yData.saved?.headline || '';
        const yearWins = yData.saved?.wins || '';
        const yearProblems = yData.saved?.blockers || '';
        const yearCorrections = yData.saved?.courseCorrections || '';
        const reviewedQuartersCount = yData.quartersData.filter(
          q =>
            !!q.saved?.wins?.trim() ||
            !!q.saved?.courseCorrections?.trim() ||
            !!q.saved?.stopDoing?.trim() ||
            !!q.saved?.doubleDown?.trim() ||
            (q.saved?.score ?? 0) > 0
        ).length;

        const handleToggleYearlyGoalInReview = (goalId: string) => {
          const updatedTasks = yData.yearGoals.map(g =>
            g.id === goalId ? { ...g, completed: !g.completed } : g
          );
          saveYearlyPlan({ ...yData.yearPlan, tasks: updatedTasks });
        };

        const handleCopyYearlyPlain = () => {
          let text = `${yData.info.label} — Yearly Executive Review\n\n`;
          if (yearHeadline.trim()) {
            text += `Year Chapter / Headline: "${yearHeadline.trim()}"\n`;
          }
          text += `Yearly Focus (${yData.info.yearKey}): ${yData.yearPlan.focusTheme || 'Not set'}\n`;
          text += `Yearly Score: ${yearScore > 0 ? `${yearScore}/10` : 'Unscored'}\n`;
          text += `Yearly Plan Goals: ${yData.completedYearGoals}/${yData.totalYearGoals} completed\n`;
          text += `Quarters Reviewed: ${reviewedQuartersCount}/4\n`;
          text += `Weekly Execution: Avg ${yData.avgWeeklyScore}/10 (${yData.weeklyPointsAchieved}/${yData.weeklyPointsPossible} pts · ${yData.weeks.length} weeks)\n`;
          text += `Daily Discipline: Avg ${yData.avgDailyScore}/10 (${yData.days.length}d · Habits ${yData.habitRatePct}%)\n`;
          text += `GWS Deep Work: ${yData.gwsHours}h (${yData.gws.length} sprints · Avg ${yData.avgGwsTotal}/15)\n`;

          const roadmapsSummary = formatRoadmapsForReviewText(yData.info.startDate, yData.info.endDate);
          if (roadmapsSummary) {
            text += `\nRoadmap Gates Progress:\n${roadmapsSummary}\n`;
          }

          if (yearWins.trim()) {
            text += `\n1. Biggest Wins, Shipped Systems & Capacity Shift:\n${yearWins.trim()}\n`;
          }
          const yearStructuredProblems = formatProblemsForReviewText(
            problems.filter(p => problemOccurredInRange(p, yData.info.startDate, yData.info.endDate))
          );
          if (yearStructuredProblems) {
            text += `\n2. Core Patterns & Annual Bottlenecks:\n${yearStructuredProblems}\n`;
          } else if (yearProblems.trim()) {
            text += `\n2. Core Patterns & Annual Bottlenecks:\n${yearProblems.trim()}\n`;
          }
          if (yearCorrections.trim()) {
            text += `\n3. Next Year Singular Focus & Operating Rules:\n${yearCorrections.trim()}\n`;
          }

          navigator.clipboard.writeText(text.trim());
          setCopiedMacroType('yearly');
          setTimeout(() => setCopiedMacroType(null), 2500);
        };

        const prevYearKey = shiftYearKey(selectedYear, -1);
        const prevYearCorrection = getSavedYearlyReview(prevYearKey)?.courseCorrections?.trim();

        return (
          <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-6">
            {/* Year Navigation & Switcher Bar */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setSelectedYear(shiftYearKey(selectedYear, -1))}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Previous Year"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 block">
                    Yearly Executive Review ({yData.info.startDate} → {yData.info.endDate})
                  </span>
                  <div className="text-xl font-extrabold text-slate-100">
                    {yearHeadline.trim()
                      ? `${yData.info.label} — ${yearHeadline.trim()}`
                      : `${yData.info.label} — Full-Year Executive Review`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedYear(shiftYearKey(selectedYear, 1))}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Next Year"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-end">
                {allKnownYears.map(yKey => {
                  const yMeta = getYearInfo(yKey);
                  return (
                    <button
                      key={yKey}
                      type="button"
                      onClick={() => setSelectedYear(yKey)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                        yKey === selectedYear
                          ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {yMeta.yearKey}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={handleCopyYearlyPlain}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition-all"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedMacroType === 'yearly' ? 'Copied Yearly Review!' : 'Copy Yearly Review'}</span>
                </button>
              </div>
            </div>

            {prevYearCorrection && (
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-rose-500/30 flex items-start space-x-2.5 text-xs">
                <Sparkles className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold uppercase tracking-wider text-[10px] text-rose-400 mr-2">
                    Target Thesis from Last Year ({prevYearKey}):
                  </span>
                  <span className="text-slate-200">"{prevYearCorrection}"</span>
                </div>
              </div>
            )}

            {/* Compact 1-Line Year Telemetry Strip */}
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">Yearly Goals</span>
                <span className="font-mono font-bold text-slate-100">
                  {yData.completedYearGoals}/{yData.totalYearGoals}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">Quarters Reviewed</span>
                <span className="font-mono font-bold text-slate-100">{reviewedQuartersCount}/4</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">Weekly Avg</span>
                <span className="font-mono font-bold text-slate-100">{yData.avgWeeklyScore}/10</span>
                <span className="font-mono text-[11px] text-slate-400">({yData.weeks.length}w)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">Daily Discipline</span>
                <span className="font-mono font-bold text-slate-100">{yData.avgDailyScore}/10</span>
                <span className="font-mono text-[11px] text-slate-400">
                  ({yData.days.length}d · {yData.habitRatePct}% habits)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Deep Work</span>
                <span className="font-mono font-bold text-slate-100">{yData.gwsHours}h</span>
                <span className="font-mono text-[11px] text-slate-400">({yData.gws.length} sprints)</span>
              </div>
            </div>

            {/* Synthesis-First 2-Column Executive Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT (7 cols): Annual Executive Synthesis FIRST */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Yearly Executive Synthesis
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-100 mt-2">
                      Synthesize {yData.info.label}
                    </h2>
                  </div>

                  {/* Integrated Year Score (1-10) */}
                  <div className="space-y-1.5 shrink-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">
                        Year Score
                      </span>
                      <span className="text-xs font-mono font-bold text-rose-300">
                        {yearScore > 0 ? `${yearScore}/10` : 'Unscored'}
                      </span>
                    </div>
                    <div className="grid grid-cols-10 gap-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(sc => (
                        <button
                          key={sc}
                          type="button"
                          onClick={() => upsertYearlyReview(selectedYear, { score: sc })}
                          className={`w-7 py-1 rounded-lg text-[11px] font-bold font-mono transition-all ${
                            yearScore === sc
                              ? 'bg-rose-500 text-slate-950 font-extrabold shadow'
                              : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          {sc}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-rose-400 block">
                      Year-in-Review Headline / Chapter Title
                    </label>
                    <input
                      type="text"
                      value={yearHeadline}
                      onChange={e => upsertYearlyReview(selectedYear, { headline: e.target.value })}
                      placeholder="Give this year a chapter title (e.g. 'Year of Building Systems & Trading Discipline')..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500/50 rounded-2xl px-4 py-3 text-xs sm:text-sm font-semibold text-slate-100 placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                      1. Biggest Wins, Shipped Systems &amp; Capacity Shift
                    </label>
                    <textarea
                      value={yearWins}
                      onChange={e => upsertYearlyReview(selectedYear, { wins: e.target.value })}
                      rows={5}
                      placeholder="What is true today that wasn't true a year ago? Major shipped systems, milestones, and capability shifts..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-2xl p-4 text-xs text-slate-200 focus:outline-none leading-relaxed"
                    />
                  </div>

                  <ProblemLoggerPanel
                    mode="review"
                    title="2. Core Patterns & Annual Bottlenecks"
                    subtitle={`Full-year problem patterns for ${yData.info.label} (${yData.info.startDate} → ${yData.info.endDate}) — see what persisted across quarters.`}
                    sourceType="yearly"
                    date={yData.info.endDate}
                    sourceRef={selectedYear}
                    dateRange={{ startDate: yData.info.startDate, endDate: yData.info.endDate }}
                    targetWeekId={selectedWeekId}
                  />

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                      3. Next Year Singular Focus &amp; Operating Rules
                    </label>
                    <textarea
                      value={yearCorrections}
                      onChange={e => upsertYearlyReview(selectedYear, { courseCorrections: e.target.value })}
                      rows={5}
                      placeholder="What is next year's singular focus, top Roadmap Gate target, and non-negotiable operating rules?"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-xs text-slate-200 focus:outline-none leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                    <span>Autosaved to Review Vault &amp; Cloud Sync</span>
                    <button
                      type="button"
                      onClick={() => setReviewSubTab('vault')}
                      className="text-amber-400 hover:text-amber-300 font-bold"
                    >
                      Open Review Vault →
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT (5 cols): 1 Level Down Only — Yearly Plan + 4 Quarters + Roadmap Gates */}
              <div className="lg:col-span-5 space-y-6">
                {/* Card A: Yearly Plan Alignment */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 block">
                        Yearly Plan ({yData.info.yearKey})
                      </span>
                      <div className="flex items-center space-x-2 mt-1">
                        <h3 className="text-base font-extrabold text-slate-100">
                          Annual Focus &amp; Goals
                        </h3>
                        <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 font-mono text-[11px] font-bold">
                          {yData.completedYearGoals}/{yData.totalYearGoals} done
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('planning');
                        setPlanningSubTab('yearly');
                      }}
                      className="shrink-0 inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-300 transition-colors"
                    >
                      <span>Edit Plan</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 block mb-0.5">
                        Focus Theme
                      </span>
                      <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {yData.yearPlan.focusTheme || 'Define your Yearly Focus in Planning Hub → Yearly Plan.'}
                      </p>
                    </div>
                    {yData.yearPlan.notes?.trim() && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 block mb-0.5">
                          Operating Rules / Strategy
                        </span>
                        <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                          {yData.yearPlan.notes.trim()}
                        </p>
                      </div>
                    )}
                  </div>

                  {yData.yearGoals.length === 0 ? (
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-500">
                      No Yearly goals logged for {yData.info.yearKey} yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {yData.yearGoals.map(goal => (
                        <button
                          key={goal.id}
                          type="button"
                          onClick={() => handleToggleYearlyGoalInReview(goal.id)}
                          className={`w-full flex items-start space-x-2.5 p-2.5 rounded-xl border text-left text-xs transition-colors ${
                            goal.completed
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                              : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-rose-500/40'
                          }`}
                        >
                          {goal.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                          )}
                          <span className={goal.completed ? 'line-through text-slate-400' : ''}>
                            {goal.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card B: 1 Level Down · 4 Quarters (Q1-Q4) */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 flex items-center space-x-1.5">
                        <Award className="w-3.5 h-3.5" />
                        <span>1 Level Down · 4 Quarters</span>
                      </span>
                      <h3 className="text-base font-extrabold text-slate-100 mt-1">
                        Quarterly Reviews in {yData.info.yearKey}
                      </h3>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 font-bold">
                      {reviewedQuartersCount}/4 written
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {yData.quartersData.map(q => {
                      const hasWins = !!q.saved?.wins?.trim();
                      const hasThesis = !!q.saved?.courseCorrections?.trim();
                      return (
                        <div
                          key={q.info.quarterKey}
                          className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs flex flex-col justify-between"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <span className="font-mono font-bold text-cyan-400">
                                  Q{q.info.qNum}
                                </span>
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] font-bold text-slate-200">
                                  {q.saved?.score ? `${q.saved.score}/10` : 'Unscored'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedQuarter(q.info.quarterKey);
                                  setReviewSubTab('quarterly');
                                }}
                                className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-[10px] font-bold"
                                title="Open Quarterly Review"
                              >
                                <span>Open</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="font-mono text-[10px] text-slate-400">
                              {q.weeks.length}w · {q.days.length}d · {q.gwsHours}h GWS
                            </div>

                            {hasWins || hasThesis ? (
                              <div className="space-y-1 pt-1 border-t border-slate-800/80">
                                {hasWins && (
                                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                                    <strong className="text-emerald-400">Wins:</strong> {q.saved!.wins.trim()}
                                  </p>
                                )}
                                {hasThesis && (
                                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                                    <strong className="text-amber-400">Thesis:</strong> {q.saved!.courseCorrections.trim()}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-800/80">
                                Quarter review pending.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Card C: Roadmap Gates Progress */}
                {renderRoadmapGatesCard(yData.info.startDate, yData.info.endDate, 'year')}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* GLOBAL CREATE REVIEW MODAL (Unambiguous, Prominent Creation Center)        */}
      {/* ========================================================================= */}
      {showCreateReviewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl space-y-6 relative my-4 sm:my-8 max-h-[92vh] overflow-y-auto">
            
            <button
              onClick={() => setShowCreateReviewModal(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-slate-950 text-slate-400 hover:text-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                <FilePlus className="w-4 h-4" />
                <span>Create New Review</span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-100 mt-1">
                What review would you like to create?
              </h2>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setCreateReviewType('yearly')}
                className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                  createReviewType === 'yearly'
                    ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Yearly
              </button>
              <button
                type="button"
                onClick={() => setCreateReviewType('quarterly')}
                className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                  createReviewType === 'quarterly'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Quarterly
              </button>
              <button
                type="button"
                onClick={() => setCreateReviewType('monthly')}
                className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                  createReviewType === 'monthly'
                    ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setCreateReviewType('weekly')}
                className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                  createReviewType === 'weekly'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => setCreateReviewType('daily')}
                className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                  createReviewType === 'daily'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setCreateReviewType('gws')}
                className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                  createReviewType === 'gws'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                GWS
              </button>
            </div>

            {/* FORM 00: YEARLY REVIEW CREATION */}
            {createReviewType === 'yearly' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none"
                  >
                    {allKnownYears.map(yKey => (
                      <option key={yKey} value={yKey}>
                        {getYearInfo(yKey).label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-slate-400">
                  Opens the Yearly Executive Review featuring Yearly Plan alignment, Q1–Q4 Quarterly summaries, and Roadmap Gates progress for {getYearInfo(selectedYear).label}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateReviewModal(false);
                    setReviewSubTab('yearly');
                  }}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-rose-500/20"
                >
                  Open {getYearInfo(selectedYear).label} Yearly Review →
                </button>
              </div>
            )}

            {/* FORM 0A: QUARTERLY REVIEW CREATION */}
            {createReviewType === 'quarterly' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Quarter</label>
                  <select
                    value={selectedQuarter}
                    onChange={(e) => setSelectedQuarter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none"
                  >
                    {allKnownQuarters.map(qKey => (
                      <option key={qKey} value={qKey}>
                        {getQuarterInfo(qKey).label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-slate-400">
                  Opens the Quarterly Strategic Review with its 3 Monthly summaries, Roadmap Gates audit, and Stop / Double Down synthesis for {getQuarterInfo(selectedQuarter).label}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateReviewModal(false);
                    setReviewSubTab('quarterly');
                  }}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/20"
                >
                  Open {getQuarterInfo(selectedQuarter).label} Quarterly Review →
                </button>
              </div>
            )}

            {/* FORM 0B: MONTHLY REVIEW CREATION */}
            {createReviewType === 'monthly' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Month</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none"
                  >
                    {allKnownMonths.map(mKey => (
                      <option key={mKey} value={mKey}>
                        {getMonthInfo(mKey).label} ({mKey})
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-slate-400">
                  Opens the full Monthly Multi-Scale Review containing all Weekly, Daily, and GWS data for {getMonthInfo(selectedMonth).label}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateReviewModal(false);
                    setReviewSubTab('monthly');
                  }}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-purple-500/20"
                >
                  Open {getMonthInfo(selectedMonth).label} Review & Rollup →
                </button>
              </div>
            )}

            {/* FORM 1: WEEKLY REVIEW CREATION */}
            {createReviewType === 'weekly' && (
              <form onSubmit={handleSaveWeeklyReview} className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Week to Review</label>
                    <button
                      type="button"
                      onClick={() => setShowNewWeekForm(true)}
                      className="text-amber-400 hover:text-amber-300 text-xs font-semibold"
                    >
                      + Create Brand New Week
                    </button>
                  </div>
                  <select
                    value={reviewTargetWeekId}
                    onChange={(e) => setReviewTargetWeekId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none"
                  >
                    {Object.values(weeklyPlans).map(p => (
                      <option key={p.id} value={p.id}>
                        Week {p.weekNumber}: {p.focusTheme} ({p.achievedScore}/{p.totalPossibleScore} pts)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Review Title</label>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">1. Wins & What Shipped</label>
                  <textarea
                    value={winsText}
                    onChange={(e) => setWinsText(e.target.value)}
                    placeholder="Milestones achieved, systems shipped..."
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none resize-none"
                  />
                </div>

                <ProblemLoggerPanel
                  mode="compact"
                  title="2. Problems Encountered & Bottlenecks"
                  sourceType="weekly"
                  date={targetPlanForReview.endDate}
                  sourceRef={targetPlanForReview.id}
                  dateRange={{
                    startDate: targetPlanForReview.startDate,
                    endDate: targetPlanForReview.endDate
                  }}
                  targetWeekId={targetPlanForReview.id}
                  draftText={blockersText}
                  onDraftTextChange={setBlockersText}
                  draftCategory={modalProblemCategory}
                  onDraftCategoryChange={setModalProblemCategory}
                  draftTags={modalProblemTags}
                  onDraftTagsChange={setModalProblemTags}
                />

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-400">3. Specific Course Corrections</label>
                  <textarea
                    value={courseCorrectionsText}
                    onChange={(e) => setCourseCorrectionsText(e.target.value)}
                    placeholder="What needs to happen? What to learn? What systems/tools to buy?"
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20"
                >
                  Save Weekly Review to Vault
                </button>
              </form>
            )}

            {/* FORM 2: DAILY REVIEW CREATION */}
            {createReviewType === 'daily' && (
              <form onSubmit={handleSaveDailyReviewModal} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Target Date</label>
                    <input
                      type="date"
                      value={modalDailyDate}
                      onChange={(e) => setModalDailyDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Execution Score (1–10)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={modalDailyScore}
                      onChange={(e) => setModalDailyScore(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-amber-400 font-bold focus:outline-none font-mono"
                      required
                    />
                  </div>
                </div>

                <ProblemLoggerPanel
                  mode="compact"
                  title="1. Problems Encountered & Bottlenecks"
                  sourceType="daily"
                  date={modalDailyDate}
                  sourceRef={modalDailyDate}
                  targetWeekId={selectedWeekId}
                  draftText={modalDailyProblems}
                  onDraftTextChange={setModalDailyProblems}
                  draftCategory={modalProblemCategory}
                  onDraftCategoryChange={setModalProblemCategory}
                  draftTags={modalProblemTags}
                  onDraftTagsChange={setModalProblemTags}
                />

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">2. Daily Reflexions & Course Correction</label>
                  <textarea
                    value={modalDailyNotes}
                    onChange={(e) => setModalDailyNotes(e.target.value)}
                    placeholder="Reflect on how today unfolded. What will you adjust tomorrow?"
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20"
                >
                  Save Daily Review to Vault
                </button>
              </form>
            )}

            {/* FORM 3: GWS SPRINT REFLEXION CREATION */}
            {createReviewType === 'gws' && (
              <form onSubmit={handleSaveGwsModal} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Sprint Task Name</label>
                  <input
                    type="text"
                    value={modalGwsTask}
                    onChange={(e) => setModalGwsTask(e.target.value)}
                    placeholder="e.g. Discord onboarding test run"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-medium">Planned Time (min)</label>
                    <input
                      type="number"
                      value={modalGwsPlanned}
                      onChange={(e) => setModalGwsPlanned(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-medium">Actual Time (min)</label>
                    <input
                      type="number"
                      value={modalGwsActual}
                      onChange={(e) => setModalGwsActual(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 block">Focus (1-5)</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={modalGwsFocus}
                      onChange={(e) => setModalGwsFocus(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-center text-xs font-bold text-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 block">Execution (1-5)</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={modalGwsExecution}
                      onChange={(e) => setModalGwsExecution(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-center text-xs font-bold text-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 block">Output (1-5)</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={modalGwsOutput}
                      onChange={(e) => setModalGwsOutput(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-center text-xs font-bold text-amber-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">1. What did I accomplish?</label>
                  <input
                    type="text"
                    value={modalGwsAccomplished}
                    onChange={(e) => setModalGwsAccomplished(e.target.value)}
                    placeholder="Milestones or code shipped..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                <ProblemLoggerPanel
                  mode="compact"
                  title="2. What held me back? (Log Problem)"
                  sourceType="gws"
                  date={selectedDate}
                  sourceRef={modalGwsTask.trim() || 'GWS Sprint'}
                  targetWeekId={selectedWeekId}
                  draftText={modalGwsHeldBack}
                  onDraftTextChange={setModalGwsHeldBack}
                  draftCategory={modalProblemCategory}
                  onDraftCategoryChange={setModalProblemCategory}
                  draftTags={modalProblemTags}
                  onDraftTagsChange={setModalProblemTags}
                />

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">3. What will I improve next session?</label>
                  <input
                    type="text"
                    value={modalGwsImproveNext}
                    onChange={(e) => setModalGwsImproveNext(e.target.value)}
                    placeholder="Actionable correction..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20"
                >
                  Record Sprint Reflexion to Vault
                </button>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
