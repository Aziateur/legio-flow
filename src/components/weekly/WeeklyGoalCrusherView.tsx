import React, { useState } from 'react';
import {
  useStorage,
  getCurrentWeekRange,
  getEffectiveEpochMonday,
  getWeekRangeForWeekNumber,
  getPriorityItemsForEntry,
  formatPriorityItemsToPlanNotes,
  computeWeeklyAchievedScore
} from '../../context/StorageContext';
import { WeeklyPlan, TaskItem } from '../../types/schema';
import {
  STRATEGY_PRIORITY_META,
  getActiveStageForPlan,
  getCommittedGatesForQuarter,
  getWeeklyGoalsAssignedToRoadmap,
  isActiveStrategyPlan,
  isRoadmapItemInWeeklyPlan,
  pullRoadmapItemIntoWeeklyPlan,
  sortStrategyPlansByPriority
} from '../../lib/planHierarchy';
import { getLevelCapabilities } from '../../lib/levelFeatures';
import { ProblemLoggerPanel } from '../problems/ProblemLoggerPanel';
import { 
  Target, 
  Gift, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Sparkles, 
  Flame, 
  ChevronRight,
  ArrowDownToLine,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Layers,
  Map as MapIcon,
  Crosshair,
  Eye,
  Lock,
  Calendar,
  Compass
} from 'lucide-react';

export const WeeklyGoalCrusherView: React.FC = () => {
  const { 
    systemLevel,
    todayDate,
    weeklyPlans, 
    selectedWeekId, 
    setSelectedWeekId, 
    saveWeeklyPlan,
    setSelectedDate,
    selectedDate,
    dailyEntries,
    saveDailyEntry,
    getEntryForDate,
    setPlanningSubTab,
    strategyPlans,
    monthlyPlans,
    quarterlyPlans,
    yearlyPlans
  } = useStorage();

  const caps = getLevelCapabilities(systemLevel);
  const plan = weeklyPlans[selectedWeekId] || weeklyPlans['week_3'] || Object.values(weeklyPlans)[0];
  const weekDaysRange = getCurrentWeekRange(plan.startDate || selectedDate);

  const [newGoalInput, setNewGoalInput] = useState('');
  const [newGoalParent, setNewGoalParent] = useState('');
  const [showParentMonthBar, setShowParentMonthBar] = useState(true);
  const [newSubGoalInputs, setNewSubGoalInputs] = useState<Record<string, string>>({});
  const [showRewardLadder, setShowRewardLadder] = useState(false);
  const [showPlanPuller, setShowPlanPuller] = useState(false);
  const [pullSourceTab, setPullSourceTab] = useState<'roadmaps' | 'monthly' | 'quarterly' | 'yearly'>('roadmaps');
  const [pullTargetByRoadmap, setPullTargetByRoadmap] = useState<Record<string, string>>({});
  const [pulledNotice, setPulledNotice] = useState<string | null>(null);

  // Pull-from-Plans helpers (Roadmaps active unlocked stage only + Monthly + Quarterly + Yearly)
  const planMonthKey = (plan.startDate || selectedDate).slice(0, 7);
  const planYearKey = (plan.startDate || selectedDate).slice(0, 4);
  const planQuarterNum = Math.ceil((parseInt(planMonthKey.slice(5, 7), 10) || 1) / 3);
  const planQuarterKey = `${planYearKey}-Q${planQuarterNum}`;
  const linkedMonthlyPlan = monthlyPlans[planMonthKey];
  const linkedQuarterlyPlan = quarterlyPlans[planQuarterKey];
  const linkedYearlyPlan = yearlyPlans[planYearKey];
  const activeStrategyPlans = sortStrategyPlansByPriority(
    strategyPlans.filter(isActiveStrategyPlan)
  );
  const committedQuarterGates = getCommittedGatesForQuarter(linkedQuarterlyPlan, strategyPlans);

  const roadmapParentOptions: Array<{ value: string; label: string }> = caps.roadmaps
    ? (() => {
        const opts: Array<{ value: string; label: string }> = [];
        const seen = new Set<string>();
        activeStrategyPlans.forEach(sp => {
          const activeStageInfo = getActiveStageForPlan(sp);
          const stageId = activeStageInfo?.stage.id || '';
          const value = `roadmap:${sp.id}|${stageId}`;
          if (seen.has(value)) return;
          seen.add(value);
          const pPrefix = sp.priority ? `[${STRATEGY_PRIORITY_META[sp.priority].code}] ` : '';
          const stageSuffix = activeStageInfo
            ? ` · Stage ${activeStageInfo.stageIndex}`
            : '';
          opts.push({
            value,
            label: `${pPrefix}${sp.title || 'Untitled Roadmap'}${stageSuffix}`
          });
        });
        committedQuarterGates.forEach(cg => {
          const value = `roadmap:${cg.plan.id}|${cg.stage.id}`;
          if (seen.has(value)) return;
          seen.add(value);
          opts.push({
            value,
            label: `${cg.plan.title} · Stage ${cg.stageIndex} (${planQuarterKey} Gate)`
          });
        });
        return opts;
      })()
    : [];

  const monthlyParentOptions: Array<{ value: string; label: string }> = caps.modelAWeekToMonth
    ? (linkedMonthlyPlan?.tasks || [])
        .filter(mt => mt.status !== 'parked')
        .map(mt => ({
          value: `monthly:${mt.id}`,
          label: mt.text
        }))
    : [];

  const hasParentOptions = roadmapParentOptions.length > 0 || monthlyParentOptions.length > 0;

  const encodeWeeklyParent = (t: TaskItem): string => {
    if (t.monthlyTaskId) return `monthly:${t.monthlyTaskId}`;
    if (t.strategyPlanId) return `roadmap:${t.strategyPlanId}|${t.strategyStageId || ''}`;
    return '';
  };

  const getFallbackParentLabel = (t: TaskItem): string | null => {
    const encoded = encodeWeeklyParent(t);
    if (!encoded) return null;
    const known =
      roadmapParentOptions.some(o => o.value === encoded) ||
      monthlyParentOptions.some(o => o.value === encoded);
    if (known) return null;
    if (t.strategyPlanId) {
      const sp = strategyPlans.find(p => p.id === t.strategyPlanId);
      if (sp) {
        const stIdx = t.strategyStageId
          ? sp.stages.findIndex(s => s.id === t.strategyStageId)
          : -1;
        return `${sp.title || 'Roadmap'}${stIdx >= 0 ? ` · Stage ${stIdx}` : ''}`;
      }
    }
    return t.sourceLabel || 'Linked Parent';
  };

  const decodeWeeklyParentPatch = (encoded: string): Partial<TaskItem> => {
    if (!encoded) {
      return {
        monthlyTaskId: undefined,
        quarterlyTaskId: undefined,
        yearlyTaskId: undefined,
        strategyPlanId: undefined,
        strategyStageId: undefined,
        strategyGoalId: undefined,
        sourceLabel: undefined,
        parentLinkMode: undefined
      };
    }
    if (encoded.startsWith('monthly:')) {
      const mId = encoded.slice(8);
      const mt = linkedMonthlyPlan?.tasks.find(x => x.id === mId);
      return {
        monthlyTaskId: mId,
        quarterlyTaskId: mt?.quarterlyTaskId,
        yearlyTaskId: mt?.yearlyTaskId,
        strategyPlanId: mt?.strategyPlanId,
        strategyStageId: mt?.strategyStageId,
        strategyGoalId: undefined,
        parentLinkMode: 'step',
        sourceLabel: mt ? `${planMonthKey} · ${mt.text.slice(0, 28)}` : `Monthly ${planMonthKey}`
      };
    }
    if (encoded.startsWith('roadmap:') || encoded.startsWith('gate:')) {
      const raw = encoded.startsWith('roadmap:') ? encoded.slice(8) : encoded.slice(5);
      const [planId, rawStageId] = raw.split('|');
      const sp = strategyPlans.find(p => p.id === planId);
      const activeStageInfo = sp ? getActiveStageForPlan(sp) : null;
      const stageId = rawStageId || activeStageInfo?.stage.id || undefined;
      const stageIdx = sp && stageId ? sp.stages.findIndex(s => s.id === stageId) : -1;
      return {
        monthlyTaskId: undefined,
        quarterlyTaskId: undefined,
        yearlyTaskId: undefined,
        strategyPlanId: planId,
        strategyStageId: stageId,
        strategyGoalId: undefined,
        parentLinkMode: 'step',
        sourceLabel: sp
          ? `${sp.title || 'Roadmap'}${stageIdx >= 0 ? ` · Stage ${stageIdx}` : ''}`
          : undefined
      };
    }
    return {};
  };

  const handleLinkWeeklyGoalParent = (taskId: string, encodedParent: string) => {
    const patch = decodeWeeklyParentPatch(encodedParent);
    saveWeeklyPlan({
      ...plan,
      tasks: plan.tasks.map(t => (t.id === taskId ? { ...t, ...patch } : t))
    });
  };

  const isInThisWeek = (
    text: string,
    links?: { strategyGoalId?: string; monthlyTaskId?: string; quarterlyTaskId?: string; yearlyTaskId?: string }
  ): boolean => {
    if (links?.monthlyTaskId && plan.tasks.some(t => t.monthlyTaskId === links.monthlyTaskId)) {
      return true;
    }
    if (links?.quarterlyTaskId && plan.tasks.some(t => t.quarterlyTaskId === links.quarterlyTaskId)) {
      return true;
    }
    if (links?.yearlyTaskId && plan.tasks.some(t => t.yearlyTaskId === links.yearlyTaskId)) {
      return true;
    }
    return isRoadmapItemInWeeklyPlan(plan, text, links?.strategyGoalId);
  };

  const handlePullItemIntoWeek = (params: {
    text: string;
    completed?: boolean;
    sourceLabel?: string;
    strategyPlanId?: string;
    strategyStageId?: string;
    strategyGoalId?: string;
    monthlyTaskId?: string;
    quarterlyTaskId?: string;
    yearlyTaskId?: string;
    targetWeeklyTaskId?: string | '__new__';
  }) => {
    const trimmed = params.text.trim();
    if (!trimmed) return;
    if (
      isInThisWeek(trimmed, {
        strategyGoalId: params.strategyGoalId,
        monthlyTaskId: params.monthlyTaskId,
        quarterlyTaskId: params.quarterlyTaskId,
        yearlyTaskId: params.yearlyTaskId
      })
    ) {
      setPulledNotice(`Already in Week ${plan.weekNumber}`);
      setTimeout(() => setPulledNotice(null), 1800);
      return;
    }

    if (params.strategyPlanId && !params.monthlyTaskId && !params.quarterlyTaskId && !params.yearlyTaskId) {
      const resolvedTarget =
        params.targetWeeklyTaskId ?? pullTargetByRoadmap[params.strategyPlanId];
      const { nextTasks, landedInsideTask } = pullRoadmapItemIntoWeeklyPlan(plan, {
        text: trimmed,
        completed: params.completed,
        sourceLabel: params.sourceLabel,
        strategyPlanId: params.strategyPlanId,
        strategyStageId: params.strategyStageId,
        strategyGoalId: params.strategyGoalId,
        targetWeeklyTaskId: resolvedTarget
      });
      saveWeeklyPlan({
        ...plan,
        tasks: nextTasks,
        achievedScore: computeWeeklyAchievedScore(nextTasks)
      });
      setPulledNotice(
        landedInsideTask
          ? `Added "${trimmed.slice(0, 28)}${trimmed.length > 28 ? '…' : ''}" inside "${landedInsideTask.text.slice(0, 26)}${landedInsideTask.text.length > 26 ? '…' : ''}"`
          : `Pulled "${trimmed.slice(0, 34)}${trimmed.length > 34 ? '…' : ''}" into Week ${plan.weekNumber}`
      );
      setTimeout(() => setPulledNotice(null), 2600);
      return;
    }

    const newTask: TaskItem = {
      id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: trimmed,
      score: 2,
      completed: Boolean(params.completed),
      ...(params.sourceLabel ? { sourceLabel: params.sourceLabel } : {}),
      ...(params.strategyPlanId ? { strategyPlanId: params.strategyPlanId } : {}),
      ...(params.strategyStageId ? { strategyStageId: params.strategyStageId } : {}),
      ...(params.strategyGoalId ? { strategyGoalId: params.strategyGoalId } : {}),
      ...(params.monthlyTaskId ? { monthlyTaskId: params.monthlyTaskId } : {}),
      ...(params.quarterlyTaskId ? { quarterlyTaskId: params.quarterlyTaskId } : {}),
      ...(params.yearlyTaskId ? { yearlyTaskId: params.yearlyTaskId } : {})
    };
    const nextTasks = [...plan.tasks, newTask];
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks,
      achievedScore: computeWeeklyAchievedScore(nextTasks)
    });
    setPulledNotice(`Pulled "${trimmed.slice(0, 34)}${trimmed.length > 34 ? '…' : ''}" into Week ${plan.weekNumber}`);
    setTimeout(() => setPulledNotice(null), 2200);
  };

  // One-click move an existing standalone weekly goal (e.g. a previously pulled proximal goal) inside a matching Roadmap weekly goal
  const handleMoveStandaloneGoalIntoParent = (standaloneTask: TaskItem, parentTask: TaskItem) => {
    const newSub = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: standaloneTask.text.trim(),
      completed: standaloneTask.completed,
      ...(standaloneTask.strategyPlanId ? { strategyPlanId: standaloneTask.strategyPlanId } : {}),
      ...(standaloneTask.strategyStageId ? { strategyStageId: standaloneTask.strategyStageId } : {}),
      ...(standaloneTask.strategyGoalId ? { strategyGoalId: standaloneTask.strategyGoalId } : {})
    };
    const nextTasks = plan.tasks
      .filter(t => t.id !== standaloneTask.id)
      .map(t => {
        if (t.id !== parentTask.id) return t;
        const updatedSubs = [...(t.subTasks || []), newSub];
        return {
          ...t,
          subTasks: updatedSubs,
          completed: updatedSubs.every(s => s.completed)
        };
      });
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks,
      achievedScore: computeWeeklyAchievedScore(nextTasks)
    });

    // Re-point any Daily priority items in this week that referenced the standalone weekly task so two-way sync stays intact
    weekDaysRange.days.forEach(dStr => {
      const entry = dailyEntries[dStr];
      if (!entry) return;
      const items = getPriorityItemsForEntry(entry);
      let changed = false;
      const nextItems = items.map(item => {
        if (item.weeklyTaskId === standaloneTask.id && !item.subTaskId) {
          changed = true;
          return { ...item, weeklyTaskId: parentTask.id, subTaskId: newSub.id };
        }
        return item;
      });
      if (changed) {
        saveDailyEntry(dStr, {
          planNotes: formatPriorityItemsToPlanNotes(nextItems),
          priorityItems: nextItems
        });
      }
    });

    setPulledNotice(
      `Moved "${standaloneTask.text.slice(0, 26)}${standaloneTask.text.length > 26 ? '…' : ''}" inside "${parentTask.text.slice(0, 26)}${parentTask.text.length > 26 ? '…' : ''}"`
    );
    setTimeout(() => setPulledNotice(null), 2600);
  };

  const parseBulletLines = (raw?: string): string[] =>
    (raw || '')
      .split('\n')
      .map(line => line.replace(/^[•\-\*\d\.\)\s]+/, '').trim())
      .filter(line => line.length >= 2);

  // Score stats (includes proportional partial credit for completed sub-goals)
  const totalPossible = plan.tasks.reduce((acc, t) => acc + (t.score || 0), 0);
  const achievedScore = computeWeeklyAchievedScore(plan.tasks);

  // Previous Week Course Correction & Unfinished Goals Carry-Over
  const prevWeekPlan = plan.weekNumber > 1 ? weeklyPlans[`week_${plan.weekNumber - 1}`] : undefined;
  const prevWeekCorrection = (prevWeekPlan?.courseCorrectionNotes || prevWeekPlan?.reviewNotes || '').trim();
  const prevWeekUnfinished = (prevWeekPlan?.tasks || []).filter(
    t => !t.completed && !plan.tasks.some(cur => cur.text.toLowerCase().trim() === t.text.toLowerCase().trim())
  );

  const handleCarryPrevWeekGoal = (task: TaskItem) => {
    const newTask: TaskItem = {
      id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: task.text,
      score: task.score || 2,
      completed: false,
      ...(task.parentLinkMode ? { parentLinkMode: task.parentLinkMode } : {}),
      ...(task.monthlyTaskId ? { monthlyTaskId: task.monthlyTaskId } : {}),
      ...(task.quarterlyTaskId ? { quarterlyTaskId: task.quarterlyTaskId } : {}),
      ...(task.yearlyTaskId ? { yearlyTaskId: task.yearlyTaskId } : {}),
      ...(task.strategyPlanId ? { strategyPlanId: task.strategyPlanId } : {}),
      ...(task.strategyStageId ? { strategyStageId: task.strategyStageId } : {}),
      ...(task.strategyGoalId ? { strategyGoalId: task.strategyGoalId } : {}),
      ...(task.sourceLabel ? { sourceLabel: task.sourceLabel } : {}),
      ...(task.subTasks && task.subTasks.length > 0
        ? {
            subTasks: task.subTasks
              .filter(s => !s.completed)
              .map(s => ({
                id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                text: s.text,
                completed: false,
                ...(s.strategyPlanId ? { strategyPlanId: s.strategyPlanId } : {}),
                ...(s.strategyStageId ? { strategyStageId: s.strategyStageId } : {}),
                ...(s.strategyGoalId ? { strategyGoalId: s.strategyGoalId } : {})
              }))
          }
        : {})
    };
    const nextTasks = [...plan.tasks, newTask];
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks,
      achievedScore: computeWeeklyAchievedScore(nextTasks)
    });
  };

  // Check if a goal or sub-goal is already in a given day's plan (by ID first, then exact normalized text)
  const isGoalInDay = (dateStr: string, goalText: string, weeklyTaskId?: string, subTaskId?: string): boolean => {
    const entry = dailyEntries[dateStr];
    if (!entry) return false;
    const items = getPriorityItemsForEntry(entry);
    if (subTaskId && items.some(p => p.subTaskId === subTaskId)) return true;
    if (weeklyTaskId && !subTaskId && items.some(p => p.weeklyTaskId === weeklyTaskId && !p.subTaskId)) return true;
    const norm = goalText.toLowerCase().trim();
    if (!norm) return false;
    return items.some(p => p.text.toLowerCase().trim() === norm);
  };

  // Toggle goal done + two-way sync with any day in this week that has this goal
  const handleToggleGoal = (id: string) => {
    const targetGoal = plan.tasks.find(t => t.id === id);
    if (!targetGoal) return;
    const nextCompleted = !targetGoal.completed;

    const nextTasks = plan.tasks.map(t =>
      t.id === id
        ? { ...t, completed: nextCompleted, ...(nextCompleted ? { pushedToPeriod: undefined } : {}) }
        : t
    );
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks,
      achievedScore: computeWeeklyAchievedScore(nextTasks)
    });

    // Sync completion state across any day in this week where the goal was pulled
    weekDaysRange.days.forEach(dStr => {
      const entry = dailyEntries[dStr];
      if (entry && isGoalInDay(dStr, targetGoal.text, id)) {
        const items = getPriorityItemsForEntry(entry).map(item => {
          if (
            (item.weeklyTaskId === id && !item.subTaskId) ||
            item.text.toLowerCase().trim() === targetGoal.text.toLowerCase().trim()
          ) {
            return { ...item, completed: nextCompleted };
          }
          return item;
        });
        saveDailyEntry(dStr, {
          planNotes: formatPriorityItemsToPlanNotes(items),
          priorityItems: items,
          mainTasksCompleted: items.filter(i => i.completed).length,
          mainTasksTotal: Math.max(3, items.length)
        });
      }
    });
  };

  // Inline goal edit
  const handleEditGoal = (id: string, text: string) => {
    saveWeeklyPlan({
      ...plan,
      tasks: plan.tasks.map(t => t.id === id ? { ...t, text } : t)
    });
  };

  // Inline score weight change
  const handleChangeScore = (id: string, score: number) => {
    const nextTasks = plan.tasks.map(t =>
      t.id === id ? { ...t, score: Math.max(1, score) } : t
    );
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks,
      achievedScore: computeWeeklyAchievedScore(nextTasks)
    });
  };

  const handleDeleteGoal = (id: string) => {
    const nextTasks = plan.tasks.filter(t => t.id !== id);
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks,
      achievedScore: computeWeeklyAchievedScore(nextTasks)
    });
  };

  // Sub-goals CRUD + two-way daily sync
  const handleAddSubGoal = (goalId: string) => {
    const raw = (newSubGoalInputs[goalId] || '').trim();
    if (!raw) return;
    const newSub = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: raw,
      completed: false
    };
    const nextTasks = plan.tasks.map(t =>
      t.id === goalId ? { ...t, subTasks: [...(t.subTasks || []), newSub], completed: false } : t
    );
    saveWeeklyPlan({ ...plan, tasks: nextTasks, achievedScore: computeWeeklyAchievedScore(nextTasks) });
    setNewSubGoalInputs(prev => ({ ...prev, [goalId]: '' }));
  };

  const handleToggleSubGoal = (goalId: string, subId: string) => {
    const parent = plan.tasks.find(t => t.id === goalId);
    const targetSub = parent?.subTasks?.find(s => s.id === subId);
    if (!targetSub) return;
    const nextCompleted = !targetSub.completed;

    const nextTasks = plan.tasks.map(t => {
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
    const nextScore = computeWeeklyAchievedScore(nextTasks);
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks,
      achievedScore: nextScore
    });

    // Sync sub-goal completion with any day in this week where it was pulled
    weekDaysRange.days.forEach(dStr => {
      const entry = dailyEntries[dStr];
      if (entry && isGoalInDay(dStr, targetSub.text, goalId, subId)) {
        const items = getPriorityItemsForEntry(entry).map(item => {
          if (
            item.subTaskId === subId ||
            item.text.toLowerCase().trim() === targetSub.text.toLowerCase().trim()
          ) {
            return { ...item, completed: nextCompleted };
          }
          return item;
        });
        saveDailyEntry(dStr, {
          planNotes: formatPriorityItemsToPlanNotes(items),
          priorityItems: items,
          mainTasksCompleted: items.filter(i => i.completed).length,
          mainTasksTotal: Math.max(3, items.length)
        });
      }
    });
  };

  const handleEditSubGoal = (goalId: string, subId: string, text: string) => {
    const nextTasks = plan.tasks.map(t =>
      t.id === goalId
        ? {
            ...t,
            subTasks: (t.subTasks || []).map(s => (s.id === subId ? { ...s, text } : s))
          }
        : t
    );
    saveWeeklyPlan({ ...plan, tasks: nextTasks });
  };

  const handleDeleteSubGoal = (goalId: string, subId: string) => {
    const nextTasks = plan.tasks.map(t => {
      if (t.id !== goalId) return t;
      const updatedSubs = (t.subTasks || []).filter(s => s.id !== subId);
      const allSubsDone = updatedSubs.length > 0 && updatedSubs.every(s => s.completed);
      return {
        ...t,
        subTasks: updatedSubs,
        completed: updatedSubs.length > 0 ? allSubsDone : t.completed
      };
    });
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks,
      achievedScore: computeWeeklyAchievedScore(nextTasks)
    });
  };

  // Effortless Enter-key goal addition (Notion / Linear style)
  const handleKeyDownNew = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newGoalInput.trim()) {
      e.preventDefault();
      const parentPatch = decodeWeeklyParentPatch(newGoalParent);
      const newTask: TaskItem = {
        id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text: newGoalInput.trim(),
        score: 2, // default 2 points
        completed: false,
        ...parentPatch
      };
      saveWeeklyPlan({
        ...plan,
        tasks: [...plan.tasks, newTask]
      });
      setNewGoalInput('');
    }
  };

  const nextWeekNum = plan.weekNumber + 1;
  const nextWeekId = `week_${nextWeekNum}`;

  const handlePushGoalToNextWeek = (task: TaskItem) => {
    const cleanText = task.text.trim();
    if (!cleanText) return;
    const epochMonday = getEffectiveEpochMonday(weeklyPlans);
    const nextRange = getWeekRangeForWeekNumber(nextWeekNum, epochMonday);
    const existingNext = weeklyPlans[nextWeekId] || {
      id: nextWeekId,
      weekNumber: nextWeekNum,
      startDate: nextRange.startDate,
      endDate: nextRange.endDate,
      focusTheme: '',
      notes: '',
      tasks: [],
      totalPossibleScore: 10,
      achievedScore: 0,
      rewards: [],
      updatedAt: new Date().toISOString()
    };

    const alreadyInNext = existingNext.tasks.some(
      t => t.text.trim().toLowerCase() === cleanText.toLowerCase()
    );
    if (!alreadyInNext) {
      const unfinishedSubs = (task.subTasks || [])
        .filter(s => !s.completed)
        .map(s => ({
          id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          text: s.text,
          completed: false,
          ...(s.strategyPlanId ? { strategyPlanId: s.strategyPlanId } : {}),
          ...(s.strategyStageId ? { strategyStageId: s.strategyStageId } : {}),
          ...(s.strategyGoalId ? { strategyGoalId: s.strategyGoalId } : {})
        }));
      const pushedCopy: TaskItem = {
        id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text: cleanText,
        score: task.score || 2,
        completed: false,
        pushedFromPeriod: `W${plan.weekNumber}`,
        ...(unfinishedSubs.length > 0 ? { subTasks: unfinishedSubs } : {}),
        ...(task.kpiTarget ? { kpiTarget: task.kpiTarget } : {}),
        ...(task.parentLinkMode ? { parentLinkMode: task.parentLinkMode } : {}),
        ...(task.monthlyTaskId ? { monthlyTaskId: task.monthlyTaskId } : {}),
        ...(task.quarterlyTaskId ? { quarterlyTaskId: task.quarterlyTaskId } : {}),
        ...(task.yearlyTaskId ? { yearlyTaskId: task.yearlyTaskId } : {}),
        ...(task.strategyPlanId ? { strategyPlanId: task.strategyPlanId } : {}),
        ...(task.strategyStageId ? { strategyStageId: task.strategyStageId } : {}),
        ...(task.strategyGoalId ? { strategyGoalId: task.strategyGoalId } : {}),
        ...(task.sourceLabel ? { sourceLabel: task.sourceLabel } : {})
      };
      const nextWeekTasks = [...existingNext.tasks, pushedCopy];
      saveWeeklyPlan({
        ...existingNext,
        tasks: nextWeekTasks,
        achievedScore: computeWeeklyAchievedScore(nextWeekTasks)
      });
    }

    // Keep original task in THIS week explicitly marked Not Done (completed: false) + stamped pushedToPeriod
    const updatedCurrentTasks = plan.tasks.map(t =>
      t.id === task.id ? { ...t, completed: false, pushedToPeriod: `W${nextWeekNum}` } : t
    );
    saveWeeklyPlan({
      ...plan,
      tasks: updatedCurrentTasks,
      achievedScore: computeWeeklyAchievedScore(updatedCurrentTasks)
    });

    setPulledNotice(
      `Pushed "${cleanText.slice(0, 30)}${cleanText.length > 30 ? '…' : ''}" → Week ${nextWeekNum} (kept Not Done in W${plan.weekNumber} for review)`
    );
    setTimeout(() => setPulledNotice(null), 3200);
  };

  // Bridge: "Pull this Goal / Sub-Goal into Selected Day's Plan" with persistent ID linkage
  const handlePullToToday = (
    goalText: string,
    isCompleted = false,
    weeklyTaskId?: string,
    subTaskId?: string
  ) => {
    const cleanGoal = goalText.trim();
    if (!cleanGoal) return;
    if (isGoalInDay(selectedDate, cleanGoal, weeklyTaskId, subTaskId)) {
      setPulledNotice(`Already in ${selectedDate}'s priorities!`);
      setTimeout(() => setPulledNotice(null), 2000);
      return;
    }

    const currentDaily = getEntryForDate(selectedDate);
    const existingItems = getPriorityItemsForEntry(currentDaily);
    const newItem = {
      id: `prio_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: cleanGoal,
      completed: isCompleted,
      weeklyTaskId,
      subTaskId
    };
    const updatedItems = [...existingItems, newItem];
    const formatted = formatPriorityItemsToPlanNotes(updatedItems);
    const completedCount = updatedItems.filter(i => i.completed).length;

    saveDailyEntry(selectedDate, {
      planNotes: formatted,
      priorityItems: updatedItems,
      mainTasksCompleted: completedCount,
      mainTasksTotal: Math.max(3, updatedItems.length)
    });
    setPulledNotice(`Pulled "${cleanGoal.slice(0, 32)}..." into ${selectedDate}`);
    setTimeout(() => setPulledNotice(null), 2500);
  };

  const handleCreateNewWeek = () => {
    const existingWeekNums = Object.values(weeklyPlans).map(p => p.weekNumber);
    const maxNum = existingWeekNums.length > 0 ? Math.max(...existingWeekNums) : 1;
    const nextNum = maxNum + 1;
    const nextId = `week_${nextNum}`;
    const nextRange = getWeekRangeForWeekNumber(nextNum);

    const newPlan: WeeklyPlan = {
      id: nextId,
      weekNumber: nextNum,
      startDate: nextRange.startDate,
      endDate: nextRange.endDate,
      focusTheme: '',
      notes: '',
      tasks: [],
      totalPossibleScore: 10,
      achievedScore: 0,
      rewards: [],
      updatedAt: new Date().toISOString()
    };

    saveWeeklyPlan(newPlan);
    setSelectedWeekId(nextId);
  };

  // Custom Rewards Add / Delete / Edit
  const handleAddCustomReward = () => {
    const existingScores = plan.rewards.map(r => r.minScore);
    // Find next available threshold (e.g. 6, 8, 10 or any score between 1 and 10)
    let nextThreshold = 6;
    for (let i = 1; i <= 10; i++) {
      if (!existingScores.includes(i)) {
        nextThreshold = i;
        break;
      }
    }
    const newReward = {
      id: `rew_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      minScore: nextThreshold,
      reward: ''
    };
    saveWeeklyPlan({
      ...plan,
      rewards: [...plan.rewards, newReward].sort((a, b) => a.minScore - b.minScore)
    });
  };

  const handleDeleteReward = (id: string) => {
    saveWeeklyPlan({
      ...plan,
      rewards: plan.rewards.filter(r => r.id !== id)
    });
  };

  const handleUpdateRewardThreshold = (id: string, minScore: number) => {
    const updated = plan.rewards.map(r =>
      r.id === id ? { ...r, minScore: Math.min(10, Math.max(1, minScore)) } : r
    ).sort((a, b) => a.minScore - b.minScore);
    saveWeeklyPlan({ ...plan, rewards: updated });
  };

  return (
    <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Toast Notice when pulling goal into today */}
      {pulledNotice && (
        <div className="fixed bottom-6 right-6 z-50 p-3.5 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center space-x-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{pulledNotice}</span>
        </div>
      )}

      {/* Week Switcher Minimal Bar (Shows all weeks sequentially, including empty weeks) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {Object.values(weeklyPlans)
            .sort((a, b) => a.weekNumber - b.weekNumber)
            .map((p) => {
              const isSelected = p.id === plan.id;
              const isEmptyWeek = p.tasks.length === 0 && !p.focusTheme.trim();
              const isCurrentCalendarWeek = p.startDate <= todayDate && todayDate <= p.endDate;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedWeekId(p.id)}
                  title={`Week ${p.weekNumber}: ${p.startDate} → ${p.endDate}${isEmptyWeek ? ' (Empty - No Plan)' : ` (${computeWeeklyAchievedScore(p.tasks)}/10 pts)`}`}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center space-x-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : isEmptyWeek
                      ? 'bg-slate-950/70 text-slate-500 hover:text-slate-300 border border-dashed border-slate-800'
                      : 'bg-slate-900 text-slate-300 hover:text-slate-100 border border-slate-800'
                  }`}
                >
                  <span>Week {p.weekNumber}</span>
                  {isCurrentCalendarWeek && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Current Calendar Week" />
                  )}
                  {!isEmptyWeek && !isSelected && (
                    <span className="text-[10px] text-amber-400">
                      {computeWeeklyAchievedScore(p.tasks)}p
                    </span>
                  )}
                  {isEmptyWeek && !isSelected && (
                    <span className="text-[9px] uppercase text-slate-600 font-normal">
                      Empty
                    </span>
                  )}
                </button>
              );
            })}
          <button
            onClick={handleCreateNewWeek}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-200 hover:bg-slate-900 transition-colors shrink-0"
          >
            + New Week
          </button>
        </div>

        {/* Custom Rewards Collapsible Toggle */}
        <button
          onClick={() => setShowRewardLadder(!showRewardLadder)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            showRewardLadder
              ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          <span>
            Custom Rewards ({plan.rewards.length}) • {achievedScore}/10 pts
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRewardLadder ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Collapsible Reward Ladder Drawer (Only visible when toggled) */}
      {showRewardLadder && (
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <Gift className="w-4 h-4 text-sky-400" />
                <span>Custom Milestone Rewards</span>
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Set as few or as many rewards as you want for this week (or just 1 celebration at 10 pts).
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono font-extrabold text-amber-400">
                Score: {achievedScore} Pts
              </span>
              <button
                type="button"
                onClick={handleAddCustomReward}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Reward</span>
              </button>
            </div>
          </div>

          {plan.rewards.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-500">
              No rewards set for this week. Click "+ Add Reward" if you want to set milestone incentives.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {plan.rewards.map((r) => {
                const isUnlocked = achievedScore >= r.minScore;
                return (
                  <div
                    key={r.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between space-y-2 ${
                      isUnlocked
                        ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-600/10 border-emerald-500/40 text-emerald-300 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Unlock at:</span>
                        <select
                          value={r.minScore}
                          onChange={(e) => handleUpdateRewardThreshold(r.id, parseInt(e.target.value) || 1)}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 font-mono font-extrabold text-xs text-amber-400 focus:outline-none cursor-pointer"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                            <option key={score} value={score}>{score}+ pts</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center space-x-1">
                        {isUnlocked ? (
                          <span className="text-[10px] font-bold text-emerald-400 flex items-center space-x-1 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                            <Sparkles className="w-3 h-3" />
                            <span>Unlocked!</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            {r.minScore - achievedScore} pts away
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteReward(r.id)}
                          className="p-1 text-slate-600 hover:text-rose-400 rounded transition-colors"
                          title="Remove reward"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={r.reward}
                      onChange={(e) => {
                        const updated = plan.rewards.map(rw => rw.id === r.id ? { ...rw, reward: e.target.value } : rw);
                        saveWeeklyPlan({ ...plan, rewards: updated });
                      }}
                      placeholder="e.g. Steak dinner, massage, weekend freedom..."
                      className="w-full bg-slate-900/60 border border-slate-800/80 focus:border-amber-500/50 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Previous Week Course Correction & Unfinished Goals Carry-Over */}
      {(prevWeekCorrection || prevWeekUnfinished.length > 0) && prevWeekPlan && (
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/25 space-y-2.5 text-xs shadow-lg">
          {prevWeekCorrection && (
            <div className="flex items-start space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold uppercase tracking-wider text-[10px] text-emerald-400 mr-2">
                  Week {prevWeekPlan.weekNumber} Course Correction:
                </span>
                <span className="text-slate-200">"{prevWeekCorrection}"</span>
              </div>
            </div>
          )}
          {prevWeekUnfinished.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
              <span className="font-extrabold uppercase tracking-wider text-[10px] text-amber-400 mr-1">
                Unfinished from Week {prevWeekPlan.weekNumber}:
              </span>
              {prevWeekUnfinished.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => handleCarryPrevWeekGoal(task)}
                  className="px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-amber-500/15 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-500/30 text-[11px] font-medium transition-colors"
                  title={`Carry "${task.text}" (${task.score || 2} pts) to Week ${plan.weekNumber}`}
                >
                  + Carry to Week {plan.weekNumber}: {task.text} ({task.score || 2}p)
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LOOKING UP: Serving Monthly Plan & Active Roadmaps (LVL 4+) */}
      {caps.modelAWeekToMonth &&
        (linkedMonthlyPlan?.focusTheme?.trim() ||
          (linkedMonthlyPlan?.tasks || []).some(t => !t.completed && t.status !== 'parked') ||
          committedQuarterGates.length > 0 ||
          activeStrategyPlans.length > 0) && (
        <div className="rounded-2xl bg-slate-900/80 border border-purple-500/25 overflow-hidden shadow-md">
          <div className="px-4 py-2.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowParentMonthBar(v => !v)}
              className="flex items-center space-x-2 text-left min-w-0"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-400 shrink-0">
                Serving {planMonthKey} Monthly Plan &amp; Roadmaps
              </span>
              {linkedMonthlyPlan?.focusTheme?.trim() && (
                <span className="text-xs font-semibold text-slate-300 truncate">
                  · {linkedMonthlyPlan.focusTheme.trim()}
                </span>
              )}
            </button>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setPlanningSubTab('monthly')}
                className="text-[11px] font-bold text-purple-300 hover:text-purple-200"
              >
                Open {planMonthKey} →
              </button>
              <button
                type="button"
                onClick={() => setShowParentMonthBar(v => !v)}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                {showParentMonthBar ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {showParentMonthBar && (
            <div className="px-4 pb-3.5 pt-2 border-t border-slate-800/80 space-y-2 text-xs">
              {(linkedMonthlyPlan?.tasks || []).filter(t => !t.completed && t.status !== 'parked')
                .length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                    Active {planMonthKey} Deliverables (click to link new task):
                  </span>
                  {(linkedMonthlyPlan?.tasks || [])
                    .filter(t => !t.completed && t.status !== 'parked')
                    .map(mt => {
                      const enc = `monthly:${mt.id}`;
                      const stepCount = plan.tasks.filter(wt => wt.monthlyTaskId === mt.id).length;
                      return (
                        <button
                          key={mt.id}
                          type="button"
                          onClick={() => setNewGoalParent(prev => (prev === enc ? '' : enc))}
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-colors ${
                            newGoalParent === enc
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                              : stepCount > 0
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                              : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                          }`}
                        >
                          <span>{stepCount > 0 ? `✓ ${stepCount}` : '○'}</span>
                          <span>{mt.text}</span>
                        </button>
                      );
                    })}
                </div>
              )}

              {activeStrategyPlans.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 mr-1">
                    Active Roadmaps (click to assign new goal):
                  </span>
                  {activeStrategyPlans.map(sp => {
                    const activeStageInfo = getActiveStageForPlan(sp);
                    const enc = `roadmap:${sp.id}|${activeStageInfo?.stage.id || ''}`;
                    const assignedCount = getWeeklyGoalsAssignedToRoadmap(
                      plan,
                      sp.id,
                      activeStageInfo?.stage.id
                    ).length;
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => setNewGoalParent(prev => (prev === enc ? '' : enc))}
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-colors ${
                          newGoalParent === enc
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                            : assignedCount > 0
                            ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/35'
                            : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                        }`}
                      >
                        <Compass className="w-3 h-3 shrink-0" />
                        <span>
                          {sp.title}
                          {activeStageInfo ? ` · Stage ${activeStageInfo.stageIndex}` : ''}
                          {assignedCount > 0 ? ` (${assignedCount})` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Clean Document View: Week Focus Headline */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-1">
              Weekly Singular Mission • Week {plan.weekNumber} ({plan.startDate} → {plan.endDate})
            </span>
            <input
              type="text"
              value={plan.focusTheme}
              onChange={(e) => saveWeeklyPlan({ ...plan, focusTheme: e.target.value })}
              placeholder="What is the one big outcome that matters this week?"
              className="w-full bg-transparent text-xl sm:text-2xl font-extrabold text-amber-400 placeholder-slate-700 focus:outline-none"
            />
          </div>
        </div>

        {/* Synchronized 7-Day Week Strip (Mon–Sun) */}
        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-semibold">
              Target Day for Pulling Goals: <strong className="text-amber-400 font-mono">{selectedDate}</strong>
            </span>
            <button
              type="button"
              onClick={() => setPlanningSubTab('daily')}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center space-x-1"
            >
              <span>Open {selectedDate} Daily Plan</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {weekDaysRange.days.map((dStr) => {
              const dObj = new Date(`${dStr}T12:00:00`);
              const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short' });
              const dayNum = dObj.getDate();
              const isSelected = dStr === selectedDate;
              const isToday = dStr === todayDate;
              const entry = dailyEntries[dStr];
              const hasPlan = !!(entry && entry.planNotes && entry.planNotes.trim().length > 0);

              return (
                <button
                  key={dStr}
                  type="button"
                  onClick={() => setSelectedDate(dStr)}
                  className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all border ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-extrabold border-amber-400 shadow-sm'
                      : isToday
                      ? 'bg-slate-900 text-emerald-400 border-emerald-500/40'
                      : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 border-slate-800'
                  }`}
                >
                  <span className="text-[9px] uppercase font-bold">{isToday ? 'TODAY' : dayName}</span>
                  <span className="text-xs font-mono font-extrabold">{dayNum}</span>
                  {hasPlan && (
                    <span className={`text-[9px] font-mono mt-0.5 ${isSelected ? 'text-slate-900 font-bold' : 'text-amber-400'}`}>
                      {entry.mainTasksCompleted}/{entry.mainTasksTotal}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clean Goals Checklist */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-400 pb-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span>Weekly Deliverables ({plan.tasks.length})</span>
              {caps.modelAWeekToMonth && (
                <button
                  type="button"
                  onClick={() => setShowPlanPuller(prev => !prev)}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl border text-[11px] font-extrabold transition-all active:scale-95 ${
                    showPlanPuller
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/35'
                  }`}
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>Pull from Plans</span>
                  {showPlanPuller ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-slate-500 text-[11px]">
                Allocated: <strong className="text-amber-400">{totalPossible}</strong> / 10 Pts
              </span>
              {plan.tasks.length > 0 && (
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    totalPossible === 10
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : totalPossible < 10
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {totalPossible === 10
                    ? '10/10 Balanced ✓'
                    : totalPossible < 10
                    ? `${10 - totalPossible} pts left to allocate`
                    : `${totalPossible - 10} pts over 10-pt budget`}
                </span>
              )}
            </div>
          </div>

          {/* Pull from Plans Drawer (LVL 4+: Written Roadmaps active unlocked stage + Monthly + Quarterly + Yearly) */}
          {caps.modelAWeekToMonth && showPlanPuller && (
            <div className="rounded-2xl bg-slate-950/90 border border-amber-500/30 p-4 sm:p-5 space-y-4 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPullSourceTab('roadmaps')}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      pullSourceTab === 'roadmaps'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                    <span>Written Plans ({activeStrategyPlans.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPullSourceTab('monthly')}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      pullSourceTab === 'monthly'
                        ? 'bg-purple-500 text-slate-950 border-purple-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Monthly ({linkedMonthlyPlan?.tasks.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPullSourceTab('quarterly')}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      pullSourceTab === 'quarterly'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Quarterly ({linkedQuarterlyPlan?.tasks.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPullSourceTab('yearly')}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      pullSourceTab === 'yearly'
                        ? 'bg-rose-500 text-slate-950 border-rose-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Yearly ({linkedYearlyPlan?.tasks.length || 0})</span>
                  </button>
                </div>

                <span className="text-[11px] text-slate-500">
                  Pull directly into <strong className="text-amber-400">Week {plan.weekNumber}</strong>
                </span>
              </div>

              {/* TAB 1: WRITTEN ROADMAPS (STRICTLY UNLOCKED ACTIVE STAGE ONLY) */}
              {pullSourceTab === 'roadmaps' && (
                <div className="space-y-3">
                  {activeStrategyPlans.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                      No active Written Plans yet. Create or promote one in Planning Hub → Roadmaps.
                    </div>
                  ) : (
                    activeStrategyPlans.map(sp => {
                      const activeStageIdx = sp.stages.findIndex(s => !s.gatePassed);
                      const activeStage = activeStageIdx >= 0 ? sp.stages[activeStageIdx] : null;
                      const lookLines = activeStage ? parseBulletLines(activeStage.whatItLooksLike) : [];
                      const gateText = activeStage?.gateCriterion?.trim() || '';
                      const assignedWeeklyGoals = getWeeklyGoalsAssignedToRoadmap(
                        plan,
                        sp.id,
                        activeStage?.id
                      );
                      const effectiveTargetId =
                        pullTargetByRoadmap[sp.id] &&
                        (pullTargetByRoadmap[sp.id] === '__new__' ||
                          assignedWeeklyGoals.some(wg => wg.id === pullTargetByRoadmap[sp.id]))
                          ? pullTargetByRoadmap[sp.id]
                          : assignedWeeklyGoals[0]?.id || '__new__';

                      return (
                        <div
                          key={sp.id}
                          className="rounded-2xl bg-slate-900/75 border border-slate-800 p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              {sp.priority && (
                                <span
                                  className={`shrink-0 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${STRATEGY_PRIORITY_META[sp.priority].badgeCls}`}
                                  title={`${STRATEGY_PRIORITY_META[sp.priority].code} · ${STRATEGY_PRIORITY_META[sp.priority].label}`}
                                >
                                  {STRATEGY_PRIORITY_META[sp.priority].code}
                                </span>
                              )}
                              <span className="text-sm font-extrabold text-amber-300 truncate">
                                {sp.title || 'Untitled Plan'}
                              </span>
                              {activeStage ? (
                                <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px] font-bold text-slate-300">
                                  Active: STAGE {activeStageIdx} — {activeStage.title}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                                  All Gates Passed ✓
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setPlanningSubTab('roadmaps')}
                              className="text-[11px] font-bold text-slate-400 hover:text-amber-300"
                            >
                              Open Plan →
                            </button>
                          </div>

                          {/* Destination Weekly Goal Picker for this Roadmap */}
                          {assignedWeeklyGoals.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px]">
                              <span className="font-bold text-amber-300 shrink-0">
                                ↳ Pull lands inside:
                              </span>
                              <select
                                value={effectiveTargetId}
                                onChange={e =>
                                  setPullTargetByRoadmap(prev => ({
                                    ...prev,
                                    [sp.id]: e.target.value
                                  }))
                                }
                                className="bg-slate-950 border border-amber-500/35 rounded-lg px-2 py-0.5 text-[11px] font-bold text-amber-200 focus:outline-none max-w-[320px] cursor-pointer"
                              >
                                {assignedWeeklyGoals.map(wg => (
                                  <option key={wg.id} value={wg.id} className="bg-slate-950 text-slate-200">
                                    {wg.text || 'Untitled weekly goal'} (as sub-goal)
                                  </option>
                                ))}
                                <option value="__new__" className="bg-slate-950 text-slate-400">
                                  + New standalone Week {plan.weekNumber} goal
                                </option>
                              </select>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 px-1">
                              Assign a Week {plan.weekNumber} goal to{' '}
                              <strong className="text-slate-300">{sp.title || 'this roadmap'}</strong>{' '}
                              below so pulled goals automatically land inside it as sub-goals.
                            </div>
                          )}

                          {activeStage && (
                            <div className="space-y-2.5">
                              {/* Proximal Goals */}
                              {activeStage.proximalGoals.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="inline-flex items-center space-x-1 text-[10px] font-extrabold uppercase tracking-wider text-rose-400">
                                    <Crosshair className="w-3 h-3" />
                                    <span>Proximal Goals</span>
                                  </div>
                                  <div className="space-y-1">
                                    {activeStage.proximalGoals.map(pg => {
                                      const already = isInThisWeek(pg.text, { strategyGoalId: pg.id });
                                      return (
                                        <div
                                          key={pg.id}
                                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800"
                                        >
                                          <span
                                            className={`text-xs min-w-0 break-words ${
                                              pg.completed ? 'line-through text-slate-500' : 'text-slate-200'
                                            }`}
                                          >
                                            {pg.text}
                                          </span>
                                          <button
                                            type="button"
                                            disabled={already}
                                            onClick={() =>
                                              handlePullItemIntoWeek({
                                                text: pg.text,
                                                completed: pg.completed,
                                                sourceLabel: `${sp.title} · Stage ${activeStageIdx}`,
                                                strategyPlanId: sp.id,
                                                strategyStageId: activeStage.id,
                                                strategyGoalId: pg.id
                                              })
                                            }
                                            className={`shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                              already
                                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 cursor-default'
                                                : 'bg-slate-900 hover:bg-amber-500/20 text-amber-300 border-amber-500/30 active:scale-95'
                                            }`}
                                          >
                                            {!already && <ArrowDownToLine className="w-3 h-3" />}
                                            <span>{already ? `✓ In W${plan.weekNumber}` : `+ Pull`}</span>
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* What It Looks Like bullets */}
                              {lookLines.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="inline-flex items-center space-x-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                                    <Eye className="w-3 h-3" />
                                    <span>What It Looks Like</span>
                                  </div>
                                  <div className="space-y-1">
                                    {lookLines.map((line, lIdx) => {
                                      const already = isInThisWeek(line);
                                      return (
                                        <div
                                          key={lIdx}
                                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800"
                                        >
                                          <span className="text-xs text-slate-300 min-w-0 break-words">
                                            {line}
                                          </span>
                                          <button
                                            type="button"
                                            disabled={already}
                                            onClick={() =>
                                              handlePullItemIntoWeek({
                                                text: line,
                                                sourceLabel: `${sp.title} · Stage ${activeStageIdx}`,
                                                strategyPlanId: sp.id,
                                                strategyStageId: activeStage.id
                                              })
                                            }
                                            className={`shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                              already
                                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 cursor-default'
                                                : 'bg-slate-900 hover:bg-amber-500/20 text-amber-300 border-amber-500/30 active:scale-95'
                                            }`}
                                          >
                                            {!already && <ArrowDownToLine className="w-3 h-3" />}
                                            <span>{already ? `✓ In W${plan.weekNumber}` : `+ Pull`}</span>
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Stage Gate Criterion */}
                              {gateText && (
                                <div className="space-y-1.5">
                                  <div className="inline-flex items-center space-x-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                                    <Lock className="w-3 h-3" />
                                    <span>Stage {activeStageIdx} Gate</span>
                                  </div>
                                  {(() => {
                                    const already = isInThisWeek(gateText);
                                    return (
                                      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/25">
                                        <span className="text-xs font-medium text-slate-200 min-w-0 break-words">
                                          {gateText}
                                        </span>
                                        <button
                                          type="button"
                                          disabled={already}
                                          onClick={() =>
                                            handlePullItemIntoWeek({
                                              text: gateText,
                                              sourceLabel: `${sp.title} · Stage ${activeStageIdx} Gate`,
                                              strategyPlanId: sp.id,
                                              strategyStageId: activeStage.id
                                            })
                                          }
                                          className={`shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                                            already
                                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 cursor-default'
                                              : 'bg-slate-900 hover:bg-amber-500/20 text-amber-300 border-amber-500/30 active:scale-95'
                                          }`}
                                        >
                                          {!already && <ArrowDownToLine className="w-3 h-3" />}
                                          <span>{already ? `✓ In W${plan.weekNumber}` : `+ Pull Gate`}</span>
                                        </button>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                              {activeStage.proximalGoals.length === 0 && lookLines.length === 0 && !gateText && (
                                <p className="text-[11px] text-slate-500 italic">
                                  Add Proximal Goals, What It Looks Like bullets, or a Gate inside this stage to pull them here.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 2: MONTHLY PLAN */}
              {pullSourceTab === 'monthly' && (
                <div className="space-y-2">
                  {!linkedMonthlyPlan || linkedMonthlyPlan.tasks.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                      No Monthly goals found for {planMonthKey}. Add them in Planning Hub → Monthly Plan.
                    </div>
                  ) : (
                    linkedMonthlyPlan.tasks.map(mt => {
                      const already = isInThisWeek(mt.text, { monthlyTaskId: mt.id });
                      return (
                        <div
                          key={mt.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800"
                        >
                          <span
                            className={`text-xs min-w-0 break-words ${
                              mt.completed ? 'line-through text-slate-500' : 'text-slate-200'
                            }`}
                          >
                            {mt.text}
                          </span>
                          <button
                            type="button"
                            disabled={already}
                            onClick={() =>
                              handlePullItemIntoWeek({
                                text: mt.text,
                                completed: mt.completed,
                                sourceLabel: `Monthly ${planMonthKey}`,
                                monthlyTaskId: mt.id,
                                ...(mt.quarterlyTaskId ? { quarterlyTaskId: mt.quarterlyTaskId } : {}),
                                ...(mt.yearlyTaskId ? { yearlyTaskId: mt.yearlyTaskId } : {})
                              })
                            }
                            className={`shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                              already
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 cursor-default'
                                : 'bg-slate-950 hover:bg-purple-500/20 text-purple-300 border-purple-500/30 active:scale-95'
                            }`}
                          >
                            {!already && <ArrowDownToLine className="w-3 h-3" />}
                            <span>{already ? `✓ In W${plan.weekNumber}` : `+ Pull`}</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 2B: QUARTERLY PLAN */}
              {pullSourceTab === 'quarterly' && (
                <div className="space-y-2">
                  {!linkedQuarterlyPlan || linkedQuarterlyPlan.tasks.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                      No Quarterly outcomes found for {planQuarterKey}. Add them in Planning Hub → Quarterly Plan.
                    </div>
                  ) : (
                    linkedQuarterlyPlan.tasks.map(qt => {
                      const already = isInThisWeek(qt.text, { quarterlyTaskId: qt.id });
                      return (
                        <div
                          key={qt.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800"
                        >
                          <span
                            className={`text-xs min-w-0 break-words ${
                              qt.completed ? 'line-through text-slate-500' : 'text-slate-200'
                            }`}
                          >
                            {qt.text}
                          </span>
                          <button
                            type="button"
                            disabled={already}
                            onClick={() =>
                              handlePullItemIntoWeek({
                                text: qt.text,
                                completed: qt.completed,
                                sourceLabel: `Quarterly ${planQuarterKey}`,
                                quarterlyTaskId: qt.id,
                                ...(qt.yearlyTaskId ? { yearlyTaskId: qt.yearlyTaskId } : {})
                              })
                            }
                            className={`shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                              already
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 cursor-default'
                                : 'bg-slate-950 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30 active:scale-95'
                            }`}
                          >
                            {!already && <ArrowDownToLine className="w-3 h-3" />}
                            <span>{already ? `✓ In W${plan.weekNumber}` : `+ Pull`}</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 3: YEARLY PLAN */}
              {pullSourceTab === 'yearly' && (
                <div className="space-y-2">
                  {!linkedYearlyPlan || linkedYearlyPlan.tasks.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                      No Yearly goals found for {planYearKey}. Add them in Planning Hub → Yearly Plan.
                    </div>
                  ) : (
                    linkedYearlyPlan.tasks.map(yt => {
                      const already = isInThisWeek(yt.text, { yearlyTaskId: yt.id });
                      return (
                        <div
                          key={yt.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800"
                        >
                          <span
                            className={`text-xs min-w-0 break-words ${
                              yt.completed ? 'line-through text-slate-500' : 'text-slate-200'
                            }`}
                          >
                            {yt.text}
                          </span>
                          <button
                            type="button"
                            disabled={already}
                            onClick={() =>
                              handlePullItemIntoWeek({
                                text: yt.text,
                                completed: yt.completed,
                                sourceLabel: `Yearly ${planYearKey}`,
                                yearlyTaskId: yt.id
                              })
                            }
                            className={`shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                              already
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 cursor-default'
                                : 'bg-slate-950 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30 active:scale-95'
                            }`}
                          >
                            {!already && <ArrowDownToLine className="w-3 h-3" />}
                            <span>{already ? `✓ In W${plan.weekNumber}` : `+ Pull`}</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {plan.tasks.map((task) => {
            const inSelectedDay = isGoalInDay(selectedDate, task.text, task.id);
            const subTasks = task.subTasks || [];
            const encodedParent = encodeWeeklyParent(task);
            const fallbackParentLabel = getFallbackParentLabel(task);
            const isRoadmapAssigned = !task.monthlyTaskId && Boolean(task.strategyPlanId);
            const matchingContainerForStandalone =
              task.strategyPlanId &&
              task.strategyGoalId &&
              subTasks.length === 0
                ? getWeeklyGoalsAssignedToRoadmap(
                    plan,
                    task.strategyPlanId,
                    task.strategyStageId
                  ).find(candidate => candidate.id !== task.id)
                : undefined;

            const assignedRoadmap =
              task.strategyPlanId && !task.strategyGoalId
                ? strategyPlans.find(sp => sp.id === task.strategyPlanId)
                : undefined;
            const assignedStageObj = assignedRoadmap
              ? (task.strategyStageId
                  ? assignedRoadmap.stages.find(st => st.id === task.strategyStageId)
                  : undefined) || getActiveStageForPlan(assignedRoadmap)?.stage
              : undefined;
            const assignedStageIndex =
              assignedRoadmap && assignedStageObj
                ? assignedRoadmap.stages.findIndex(st => st.id === assignedStageObj.id)
                : -1;
            const unpulledRoadmapGoals = assignedStageObj
              ? assignedStageObj.proximalGoals.filter(
                  pg => !isRoadmapItemInWeeklyPlan(plan, pg.text, pg.id)
                )
              : [];

            return (
              <div
                key={task.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  task.completed
                    ? 'bg-emerald-500/5 border-emerald-500/25'
                    : 'bg-slate-950 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                {/* Parent Weekly Goal Row */}
                <div className="group flex items-center justify-between p-3.5">
                  {/* Checkbox & Text */}
                  <div className="flex items-center space-x-3 flex-1 min-w-0 pr-3">
                    <button
                      type="button"
                      onClick={() => handleToggleGoal(task.id)}
                      className="transition-transform active:scale-90 shrink-0"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-600 hover:text-slate-400" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={task.text}
                        onChange={(e) => handleEditGoal(task.id, e.target.value)}
                        className={`w-full bg-transparent text-xs sm:text-sm font-medium focus:outline-none ${
                          task.completed ? 'line-through text-slate-500' : 'text-slate-100'
                        }`}
                      />
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {task.pushedFromPeriod && !task.completed && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold text-slate-400">
                            From {task.pushedFromPeriod}
                          </span>
                        )}
                        {hasParentOptions || encodedParent ? (
                          <select
                            value={encodedParent}
                            onChange={e => handleLinkWeeklyGoalParent(task.id, e.target.value)}
                            className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold focus:outline-none max-w-[270px] cursor-pointer ${
                              isRoadmapAssigned
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                                : encodedParent
                                ? 'bg-slate-900 text-purple-300 border-purple-500/30'
                                : 'bg-transparent text-slate-500 border-slate-800/80 hover:text-slate-300'
                            }`}
                            title="Assign this weekly goal to a Roadmap (pulled proximal goals will land inside it) or a Monthly deliverable"
                          >
                            <option value="" className="bg-slate-950 text-slate-400">
                              ↑ Assign Roadmap / Month (optional)
                            </option>
                            {fallbackParentLabel && encodedParent && (
                              <option value={encodedParent} className="bg-slate-950 text-amber-300">
                                🗺 {fallbackParentLabel}
                              </option>
                            )}
                            {roadmapParentOptions.length > 0 && (
                              <optgroup label="Active Roadmaps" className="bg-slate-950 text-amber-400">
                                {roadmapParentOptions.map(opt => (
                                  <option key={opt.value} value={opt.value} className="bg-slate-950 text-slate-200">
                                    🗺 {opt.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {monthlyParentOptions.length > 0 && (
                              <optgroup label={`${planMonthKey} Monthly Deliverables`} className="bg-slate-950 text-purple-400">
                                {monthlyParentOptions.map(opt => (
                                  <option key={opt.value} value={opt.value} className="bg-slate-950 text-slate-200">
                                    ↑ {opt.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        ) : (
                          task.sourceLabel && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-400/80">
                              <MapIcon className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{task.sourceLabel}</span>
                            </span>
                          )
                        )}
                        {matchingContainerForStandalone && (
                          <button
                            type="button"
                            onClick={() =>
                              handleMoveStandaloneGoalIntoParent(task, matchingContainerForStandalone)
                            }
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 text-[10px] font-bold transition-colors"
                            title={`Move this proximal goal inside "${matchingContainerForStandalone.text}" as a sub-goal`}
                          >
                            <span>
                              ↳ Move into &ldquo;{matchingContainerForStandalone.text.slice(0, 26)}
                              {matchingContainerForStandalone.text.length > 26 ? '…' : ''}&rdquo;
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Point Weight */}
                  <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                    {/* Push to Next Week button / Not Done Pushed Badge */}
                    {!task.completed && (
                      task.pushedToPeriod ? (
                        <button
                          type="button"
                          onClick={() => setSelectedWeekId(nextWeekId)}
                          className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[10px] sm:text-[11px] font-bold border border-rose-500/35 transition-colors"
                          title={`Marked Not Done in W${plan.weekNumber} & pushed to ${task.pushedToPeriod}. Click to view W${nextWeekNum}, or diagnose why in Weekly Review.`}
                        >
                          <span>Not Done · → {task.pushedToPeriod}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePushGoalToNextWeek(task)}
                          className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-500/15 text-slate-400 hover:text-rose-300 text-[10px] sm:text-[11px] font-bold border border-slate-800 hover:border-rose-500/35 transition-colors"
                          title={`Push to Week ${nextWeekNum} & keep marked Not Done in Week ${plan.weekNumber} for Weekly Review diagnosis`}
                        >
                          <span>W{nextWeekNum}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )
                    )}

                    {/* Bridge button: "Pull to Selected Day" */}
                    {inSelectedDay ? (
                      <span className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
                        <span>✓ In {selectedDate.slice(5)}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePullToToday(task.text, task.completed, task.id)}
                        className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 text-[11px] font-semibold border border-slate-800 transition-colors"
                        title={`Pull this goal into ${selectedDate}'s daily plan`}
                      >
                        <ArrowDownToLine className="w-3 h-3 text-amber-400" />
                        <span>Pull to {selectedDate.slice(5)}</span>
                      </button>
                    )}

                    {/* Score weight badge */}
                    <select
                      value={task.score || 2}
                      onChange={(e) => handleChangeScore(task.id, parseInt(e.target.value))}
                      className="bg-slate-900 text-amber-400 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono font-bold focus:outline-none cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5].map((pts) => (
                        <option key={pts} value={pts}>{pts} pt{pts > 1 ? 's' : ''}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleDeleteGoal(task.id)}
                      className="p-1 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sub-Goals List + Inline Sub-Goal Adder */}
                <div className="pl-10 pr-3.5 pb-3 pt-1 border-t border-slate-900/80 space-y-1.5">
                  {subTasks.map((sub) => {
                    const subInDay = isGoalInDay(selectedDate, sub.text, task.id, sub.id);
                    return (
                      <div
                        key={sub.id}
                        className="group/sub flex items-center justify-between py-1 px-2 rounded-xl bg-slate-900/50 border border-slate-800/60"
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0 pr-2">
                          <button
                            type="button"
                            onClick={() => handleToggleSubGoal(task.id, sub.id)}
                            className="shrink-0"
                          >
                            {sub.completed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-slate-600 hover:text-amber-400" />
                            )}
                          </button>
                          <input
                            type="text"
                            value={sub.text}
                            onChange={(e) => handleEditSubGoal(task.id, sub.id, e.target.value)}
                            className={`w-full bg-transparent text-xs focus:outline-none ${
                              sub.completed ? 'line-through text-slate-500' : 'text-slate-300'
                            }`}
                          />
                          {sub.strategyGoalId && (
                            <span
                              title="Synced with Roadmap Proximal Goal — completing here checks it off in your Roadmap too"
                              className="shrink-0 inline-flex items-center text-rose-400/80"
                            >
                              <Crosshair className="w-3 h-3" />
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {subInDay ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                              ✓ In {selectedDate.slice(5)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePullToToday(sub.text, sub.completed, task.id, sub.id)}
                              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-amber-400 text-[10px] font-semibold border border-slate-800 transition-colors"
                              title={`Pull sub-goal into ${selectedDate}'s daily plan`}
                            >
                              <ArrowDownToLine className="w-2.5 h-2.5 text-amber-400" />
                              <span>Pull to {selectedDate.slice(5)}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteSubGoal(task.id, sub.id)}
                            className="p-0.5 text-slate-600 hover:text-rose-400 opacity-0 group-hover/sub:opacity-100 transition-opacity"
                            title="Delete sub-goal"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add sub-goal inline */}
                  <div className="flex items-center space-x-2 px-2 py-1">
                    <Plus className="w-3 h-3 text-slate-600 shrink-0" />
                    <input
                      type="text"
                      value={newSubGoalInputs[task.id] || ''}
                      onChange={(e) => setNewSubGoalInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSubGoal(task.id);
                        }
                      }}
                      placeholder="Add sub-goal (Enter to save)..."
                      className="w-full bg-transparent text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  {/* Quick-pull unpulled proximal goals from this goal's assigned Roadmap directly as sub-goals */}
                  {assignedRoadmap && assignedStageObj && unpulledRoadmapGoals.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 px-2 pt-1 border-t border-slate-900/70">
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-400/80 shrink-0">
                        <Crosshair className="w-2.5 h-2.5 text-rose-400" />
                        <span>Pull from {assignedRoadmap.title}:</span>
                      </span>
                      {unpulledRoadmapGoals.map(pg => (
                        <button
                          key={pg.id}
                          type="button"
                          onClick={() =>
                            handlePullItemIntoWeek({
                              text: pg.text,
                              completed: pg.completed,
                              sourceLabel: `${assignedRoadmap.title}${assignedStageIndex >= 0 ? ` · Stage ${assignedStageIndex}` : ''}`,
                              strategyPlanId: assignedRoadmap.id,
                              strategyStageId: assignedStageObj.id,
                              strategyGoalId: pg.id,
                              targetWeeklyTaskId: task.id
                            })
                          }
                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-amber-500/15 text-slate-300 hover:text-amber-200 border border-slate-800 hover:border-amber-500/35 text-[10px] font-semibold transition-colors"
                          title={`Pull "${pg.text}" directly into "${task.text}" as a sub-goal`}
                        >
                          <ArrowDownToLine className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          <span className="truncate max-w-[240px]">{pg.text}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Effortless Inline Goal Input (Like Notion - Type & hit Enter) */}
          <div className="flex flex-wrap items-center gap-2 p-3.5 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 focus-within:border-amber-500/50 transition-colors">
            <Plus className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              value={newGoalInput}
              onChange={(e) => setNewGoalInput(e.target.value)}
              onKeyDown={handleKeyDownNew}
              placeholder="Type a weekly deliverable and press Enter to add..."
              className="flex-1 min-w-[200px] bg-transparent text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
            />
            {hasParentOptions && (
              <select
                value={newGoalParent}
                onChange={e => setNewGoalParent(e.target.value)}
                className={`bg-slate-900 border rounded-xl px-2.5 py-1 text-[11px] font-semibold focus:outline-none max-w-[240px] cursor-pointer ${
                  newGoalParent.startsWith('roadmap:')
                    ? 'border-amber-500/40 text-amber-300'
                    : 'border-slate-800 text-purple-300'
                }`}
              >
                <option value="" className="bg-slate-950 text-slate-400">
                  Assign Roadmap / Month...
                </option>
                {roadmapParentOptions.length > 0 && (
                  <optgroup label="Active Roadmaps" className="bg-slate-950 text-amber-400">
                    {roadmapParentOptions.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-slate-950 text-slate-200">
                        🗺 {opt.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {monthlyParentOptions.length > 0 && (
                  <optgroup label={`${planMonthKey} Monthly Deliverables`} className="bg-slate-950 text-purple-400">
                    {monthlyParentOptions.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-slate-950 text-slate-200">
                        ↑ {opt.label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
            <span className="text-[10px] text-slate-600 font-mono hidden sm:inline shrink-0">
              Press Enter ↵
            </span>
          </div>

        </div>

        {/* Minimal Score Tracker Bar */}
        <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
          <span>Weekly progress</span>
          <span className="font-mono font-bold text-slate-200">
            <strong className="text-amber-400">{achievedScore}</strong> / {totalPossible || 10} pts completed ({Math.min(100, Math.round((achievedScore / Math.max(1, totalPossible || 10)) * 100))}%)
          </span>
        </div>

      </div>

      {/* Weekly Problem Triage & Active Fixes (Only on Weekly Planning) */}
      <ProblemLoggerPanel
        mode="weekly_triage"
        title={`Week ${plan.weekNumber} Problem Triage & Active Fixes`}
        subtitle="Turn open review problems into concrete tasks, habit rewires, skill reps, rules, or plan changes — then push them straight into this week."
        sourceType="weekly"
        date={selectedDate}
        sourceRef={plan.id}
        targetWeekId={plan.id}
        defaultCollapsed={false}
      />

    </div>
  );
};
