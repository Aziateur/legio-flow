import {
  DailyEntry,
  DailyPriorityItem,
  GWSSession,
  MonthlyPlan,
  OutcomeRootCause,
  QuarterlyPlan,
  ReviewEntry,
  StrategyPlan,
  StrategyPlanPriority,
  StrategyStage,
  SubTaskItem,
  TaskItem,
  WeeklyPlan,
  YearlyPlan
} from '../types/schema';
import { getMonthInfo, getQuarterInfo } from './macroAnalytics';

export interface LinkedChildStep {
  periodKey: string;
  periodLabel: string;
  task: TaskItem;
}

export const getQuartersForYear = (yearKey: string): string[] => {
  const y = parseInt(yearKey, 10) || 2026;
  return [`${y}-Q1`, `${y}-Q2`, `${y}-Q3`, `${y}-Q4`];
};

export const getMonthsForQuarter = (quarterKey: string): string[] => {
  return getQuarterInfo(quarterKey).months;
};

export const getWeeksForMonth = (
  monthKey: string,
  weeklyPlans: Record<string, WeeklyPlan>
): WeeklyPlan[] => {
  const mInfo = getMonthInfo(monthKey);
  return Object.values(weeklyPlans)
    .filter(w => w.startDate <= mInfo.endDate && w.endDate >= mInfo.startDate)
    .sort((a, b) => a.weekNumber - b.weekNumber);
};

export const getQuarterlyChildrenOfYearlyTask = (
  yearlyTaskId: string,
  yearKey: string,
  quarterlyPlans: Record<string, QuarterlyPlan>
): LinkedChildStep[] => {
  const out: LinkedChildStep[] = [];
  getQuartersForYear(yearKey).forEach(qKey => {
    const qp = quarterlyPlans[qKey];
    if (!qp) return;
    (qp.tasks || []).forEach(t => {
      if (t.yearlyTaskId === yearlyTaskId) {
        out.push({ periodKey: qKey, periodLabel: qKey.slice(5), task: t });
      }
    });
  });
  return out;
};

export const getMonthlyChildrenOfQuarterlyTask = (
  quarterlyTaskId: string,
  quarterKey: string,
  monthlyPlans: Record<string, MonthlyPlan>
): LinkedChildStep[] => {
  const out: LinkedChildStep[] = [];
  getMonthsForQuarter(quarterKey).forEach(mKey => {
    const mp = monthlyPlans[mKey];
    if (!mp) return;
    const shortMonth = getMonthInfo(mKey).label.split(' ')[0].slice(0, 3);
    (mp.tasks || []).forEach(t => {
      if (t.quarterlyTaskId === quarterlyTaskId) {
        out.push({ periodKey: mKey, periodLabel: shortMonth, task: t });
      }
    });
  });
  return out;
};

export const getWeeklyChildrenOfMonthlyTask = (
  monthlyTaskId: string,
  monthKey: string,
  weeklyPlans: Record<string, WeeklyPlan>
): LinkedChildStep[] => {
  const out: LinkedChildStep[] = [];
  getWeeksForMonth(monthKey, weeklyPlans).forEach(wp => {
    (wp.tasks || []).forEach(t => {
      if (t.monthlyTaskId === monthlyTaskId) {
        out.push({ periodKey: wp.id, periodLabel: `W${wp.weekNumber}`, task: t });
      }
    });
  });
  return out;
};

export interface CommittedGateDetail {
  plan: StrategyPlan;
  stage: StrategyStage;
  stageIndex: number;
  doneGoals: number;
  totalGoals: number;
}

export const STRATEGY_PRIORITIES: StrategyPlanPriority[] = [1, 2, 3, 4];

export const STRATEGY_PRIORITY_META: Record<
  StrategyPlanPriority,
  {
    code: string;
    label: string;
    badgeCls: string;
    activeCls: string;
  }
> = {
  1: {
    code: 'P1',
    label: 'Primary',
    badgeCls: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
    activeCls: 'bg-rose-500/25 text-rose-200 border-rose-500/50'
  },
  2: {
    code: 'P2',
    label: 'High',
    badgeCls: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    activeCls: 'bg-amber-500/25 text-amber-200 border-amber-500/50'
  },
  3: {
    code: 'P3',
    label: 'Medium',
    badgeCls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
    activeCls: 'bg-cyan-500/25 text-cyan-200 border-cyan-500/50'
  },
  4: {
    code: 'P4',
    label: 'Low',
    badgeCls: 'bg-slate-800/90 text-slate-400 border-slate-700',
    activeCls: 'bg-slate-700 text-slate-200 border-slate-500'
  }
};

export const sortStrategyPlansByPriority = (plans: StrategyPlan[]): StrategyPlan[] =>
  [...plans].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

export const isActiveStrategyPlan = (p: StrategyPlan): boolean =>
  p.status !== 'possible' && p.status !== 'not_pursuing';

export const isPossibleStrategyPlan = (p: StrategyPlan): boolean =>
  p.status === 'possible' || p.status === 'not_pursuing';

export const getCommittedGatesForQuarter = (
  quarterPlan: QuarterlyPlan | undefined,
  strategyPlans: StrategyPlan[]
): CommittedGateDetail[] => {
  if (!quarterPlan?.targetGateRefs?.length) return [];
  const results: CommittedGateDetail[] = [];
  quarterPlan.targetGateRefs.forEach(ref => {
    const plan = strategyPlans.find(sp => sp.id === ref.planId);
    if (!plan || !isActiveStrategyPlan(plan)) return;
    const stageIndex = plan.stages.findIndex(s => s.id === ref.stageId);
    if (stageIndex < 0) return;
    const stage = plan.stages[stageIndex];
    results.push({
      plan,
      stage,
      stageIndex,
      doneGoals: stage.proximalGoals.filter(g => g.completed).length,
      totalGoals: stage.proximalGoals.length
    });
  });
  return results;
};

export interface RoadmapStageBindings {
  targetQuarters: string[];
  quarterlySteps: LinkedChildStep[];
  monthlySteps: LinkedChildStep[];
  weeklySteps: LinkedChildStep[];
}

export const getRoadmapStageBindings = (
  planId: string,
  stageId: string,
  quarterlyPlans: Record<string, QuarterlyPlan>,
  monthlyPlans: Record<string, MonthlyPlan>,
  weeklyPlans: Record<string, WeeklyPlan>
): RoadmapStageBindings => {
  const targetQuarters: string[] = [];
  const quarterlySteps: LinkedChildStep[] = [];
  const monthlySteps: LinkedChildStep[] = [];
  const weeklySteps: LinkedChildStep[] = [];

  Object.entries(quarterlyPlans)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([qKey, qp]) => {
      if ((qp.targetGateRefs || []).some(r => r.planId === planId && r.stageId === stageId)) {
        targetQuarters.push(qKey);
      }
      (qp.tasks || []).forEach(t => {
        const linkedSubs = (t.subTasks || []).filter(
          s => s.strategyPlanId === planId && s.strategyStageId === stageId
        );
        if (linkedSubs.length > 0) {
          linkedSubs.forEach(s => {
            quarterlySteps.push({
              periodKey: qKey,
              periodLabel: qKey,
              task: {
                id: s.id,
                text: s.text,
                completed: s.completed,
                strategyPlanId: s.strategyPlanId,
                strategyStageId: s.strategyStageId,
                strategyGoalId: s.strategyGoalId
              }
            });
          });
        } else if (t.strategyPlanId === planId && t.strategyStageId === stageId) {
          quarterlySteps.push({ periodKey: qKey, periodLabel: qKey, task: t });
        }
      });
    });

  Object.entries(monthlyPlans)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([mKey, mp]) => {
      const shortMonth = getMonthInfo(mKey).label.split(' ')[0].slice(0, 3);
      (mp.tasks || []).forEach(t => {
        const linkedSubs = (t.subTasks || []).filter(
          s => s.strategyPlanId === planId && s.strategyStageId === stageId
        );
        if (linkedSubs.length > 0) {
          linkedSubs.forEach(s => {
            monthlySteps.push({
              periodKey: mKey,
              periodLabel: shortMonth,
              task: {
                id: s.id,
                text: s.text,
                completed: s.completed,
                strategyPlanId: s.strategyPlanId,
                strategyStageId: s.strategyStageId,
                strategyGoalId: s.strategyGoalId
              }
            });
          });
        } else if (t.strategyPlanId === planId && t.strategyStageId === stageId) {
          monthlySteps.push({ periodKey: mKey, periodLabel: shortMonth, task: t });
        }
      });
    });

  Object.values(weeklyPlans)
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .forEach(wp => {
      (wp.tasks || []).forEach(t => {
        const linkedSubs = (t.subTasks || []).filter(
          s => s.strategyPlanId === planId && s.strategyStageId === stageId
        );
        if (linkedSubs.length > 0) {
          linkedSubs.forEach(s => {
            weeklySteps.push({
              periodKey: wp.id,
              periodLabel: `W${wp.weekNumber}`,
              task: {
                id: s.id,
                text: s.text,
                completed: s.completed,
                strategyPlanId: s.strategyPlanId,
                strategyStageId: s.strategyStageId,
                strategyGoalId: s.strategyGoalId
              }
            });
          });
        } else if (t.strategyPlanId === planId && t.strategyStageId === stageId) {
          weeklySteps.push({ periodKey: wp.id, periodLabel: `W${wp.weekNumber}`, task: t });
        }
      });
    });

  return { targetQuarters, quarterlySteps, monthlySteps, weeklySteps };
};

export const getActiveStageForPlan = (
  plan: StrategyPlan
): { stage: StrategyStage; stageIndex: number } | null => {
  if (!plan.stages || plan.stages.length === 0) return null;
  const idx = plan.stages.findIndex(s => !s.gatePassed);
  const resolvedIdx = idx >= 0 ? idx : plan.stages.length - 1;
  return { stage: plan.stages[resolvedIdx], stageIndex: resolvedIdx };
};

export const isRoadmapItemInTaskList = (
  tasks: TaskItem[] | undefined,
  text: string,
  strategyGoalId?: string
): boolean => {
  if (!tasks || tasks.length === 0) return false;
  if (strategyGoalId) {
    const byId = tasks.some(
      t =>
        t.strategyGoalId === strategyGoalId ||
        (t.subTasks || []).some(s => s.strategyGoalId === strategyGoalId)
    );
    if (byId) return true;
  }
  const norm = text.trim().toLowerCase();
  if (!norm) return false;
  return tasks.some(
    t =>
      t.text.trim().toLowerCase() === norm ||
      (t.subTasks || []).some(s => s.text.trim().toLowerCase() === norm)
  );
};

export const isRoadmapItemInWeeklyPlan = (
  plan: WeeklyPlan | undefined,
  text: string,
  strategyGoalId?: string
): boolean => isRoadmapItemInTaskList(plan?.tasks, text, strategyGoalId);

// Goals explicitly assigned to a Roadmap (container goals without a single strategyGoalId) across Weekly, Monthly, or Quarterly plans
export const getGoalsAssignedToRoadmap = (
  tasks: TaskItem[] | undefined,
  strategyPlanId: string,
  strategyStageId?: string
): TaskItem[] => {
  if (!tasks || !strategyPlanId) return [];
  const indexed = tasks
    .map((task, idx) => ({ task, idx }))
    .filter(
      ({ task }) =>
        task.strategyPlanId === strategyPlanId &&
        !task.strategyGoalId &&
        task.status !== 'parked'
    );

  indexed.sort((a, b) => {
    const aStage = strategyStageId && a.task.strategyStageId === strategyStageId ? 0 : 1;
    const bStage = strategyStageId && b.task.strategyStageId === strategyStageId ? 0 : 1;
    if (aStage !== bStage) return aStage - bStage;
    const aDone = a.task.completed ? 1 : 0;
    const bDone = b.task.completed ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return a.idx - b.idx;
  });

  return indexed.map(x => x.task);
};

export const getWeeklyGoalsAssignedToRoadmap = (
  plan: WeeklyPlan | undefined,
  strategyPlanId: string,
  strategyStageId?: string
): TaskItem[] => getGoalsAssignedToRoadmap(plan?.tasks, strategyPlanId, strategyStageId);

export const pullRoadmapItemIntoTaskList = (
  tasks: TaskItem[],
  params: {
    idPrefix: string;
    defaultScore?: number;
    text: string;
    completed?: boolean;
    sourceLabel?: string;
    strategyPlanId?: string;
    strategyStageId?: string;
    strategyGoalId?: string;
    targetTaskId?: string | '__new__';
  }
): {
  nextTasks: TaskItem[];
  landedInsideTask?: TaskItem;
  alreadyExists: boolean;
} => {
  const trimmed = params.text.trim();
  if (!trimmed) {
    return { nextTasks: tasks, alreadyExists: false };
  }
  if (isRoadmapItemInTaskList(tasks, trimmed, params.strategyGoalId)) {
    return { nextTasks: tasks, alreadyExists: true };
  }

  let targetParent: TaskItem | undefined;
  if (params.targetTaskId === '__new__') {
    targetParent = undefined;
  } else if (params.targetTaskId) {
    targetParent = tasks.find(t => t.id === params.targetTaskId);
  } else if (params.strategyPlanId) {
    targetParent = getGoalsAssignedToRoadmap(
      tasks,
      params.strategyPlanId,
      params.strategyStageId
    )[0];
  }

  if (targetParent) {
    const newSub: SubTaskItem = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      completed: Boolean(params.completed),
      ...(params.strategyPlanId ? { strategyPlanId: params.strategyPlanId } : {}),
      ...(params.strategyStageId ? { strategyStageId: params.strategyStageId } : {}),
      ...(params.strategyGoalId ? { strategyGoalId: params.strategyGoalId } : {})
    };
    let updatedParent: TaskItem | undefined;
    const nextTasks = tasks.map(t => {
      if (t.id !== targetParent!.id) return t;
      const updatedSubs = [...(t.subTasks || []), newSub];
      updatedParent = {
        ...t,
        subTasks: updatedSubs,
        completed: params.defaultScore !== undefined ? updatedSubs.every(s => s.completed) : t.completed
      };
      return updatedParent;
    });
    return { nextTasks, landedInsideTask: updatedParent, alreadyExists: false };
  }

  const newTask: TaskItem = {
    id: `${params.idPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text: trimmed,
    ...(params.defaultScore !== undefined ? { score: params.defaultScore } : {}),
    completed: Boolean(params.completed),
    ...(params.targetTaskId === '__new__' ? { parentLinkMode: 'mirror' } : {}),
    ...(params.sourceLabel ? { sourceLabel: params.sourceLabel } : {}),
    ...(params.strategyPlanId ? { strategyPlanId: params.strategyPlanId } : {}),
    ...(params.strategyStageId ? { strategyStageId: params.strategyStageId } : {}),
    ...(params.strategyGoalId ? { strategyGoalId: params.strategyGoalId } : {})
  };
  return { nextTasks: [...tasks, newTask], alreadyExists: false };
};

export const pullRoadmapItemIntoWeeklyPlan = (
  weeklyPlan: WeeklyPlan,
  params: {
    text: string;
    completed?: boolean;
    sourceLabel?: string;
    strategyPlanId?: string;
    strategyStageId?: string;
    strategyGoalId?: string;
    targetWeeklyTaskId?: string | '__new__';
  }
): {
  nextTasks: TaskItem[];
  landedInsideTask?: TaskItem;
  alreadyExists: boolean;
} =>
  pullRoadmapItemIntoTaskList(weeklyPlan.tasks, {
    idPrefix: 'goal',
    defaultScore: 2,
    text: params.text,
    completed: params.completed,
    sourceLabel: params.sourceLabel,
    strategyPlanId: params.strategyPlanId,
    strategyStageId: params.strategyStageId,
    strategyGoalId: params.strategyGoalId,
    targetTaskId: params.targetWeeklyTaskId
  });

export interface MovedOrphanGoalRecord {
  oldTaskId: string;
  newParentId: string;
  newSubId: string;
  orphanText: string;
  parentText: string;
}

// Auto-fold standalone pulled Roadmap proximal goals into an assigned Weekly, Monthly, or Quarterly Goal for the same Roadmap
export const absorbOrphanedRoadmapGoals = (
  tasks: TaskItem[],
  focusPlanId?: string,
  focusParentTaskId?: string,
  options?: { autoCompleteParent?: boolean }
): { nextTasks: TaskItem[]; moved: MovedOrphanGoalRecord[] } => {
  const autoCompleteParent = options?.autoCompleteParent ?? true;
  const moved: MovedOrphanGoalRecord[] = [];
  const orphanIds = new Set<string>();
  const additionsByParent = new Map<string, SubTaskItem[]>();

  tasks.forEach((orphan, idx) => {
    if (!orphan.strategyPlanId || !orphan.strategyGoalId) return;
    if (orphan.parentLinkMode === 'mirror') return;
    if (orphan.subTasks && orphan.subTasks.length > 0) return;
    if (focusPlanId && orphan.strategyPlanId !== focusPlanId) return;

    let parent: TaskItem | undefined;
    if (focusParentTaskId) {
      const focused = tasks.find(
        t =>
          t.id === focusParentTaskId &&
          t.id !== orphan.id &&
          t.strategyPlanId === orphan.strategyPlanId &&
          !t.strategyGoalId &&
          t.status !== 'parked'
      );
      parent = focused;
    }
    if (!parent) {
      parent = getGoalsAssignedToRoadmap(
        tasks,
        orphan.strategyPlanId,
        orphan.strategyStageId
      ).find(t => t.id !== orphan.id);
    }
    if (!parent) return;

    const newSub: SubTaskItem = {
      id: `sub_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      text: orphan.text.trim(),
      completed: orphan.completed,
      strategyPlanId: orphan.strategyPlanId,
      ...(orphan.strategyStageId ? { strategyStageId: orphan.strategyStageId } : {}),
      strategyGoalId: orphan.strategyGoalId
    };
    orphanIds.add(orphan.id);
    const list = additionsByParent.get(parent.id) || [];
    list.push(newSub);
    additionsByParent.set(parent.id, list);
    moved.push({
      oldTaskId: orphan.id,
      newParentId: parent.id,
      newSubId: newSub.id,
      orphanText: orphan.text.trim(),
      parentText: parent.text.trim()
    });
  });

  if (moved.length === 0) {
    return { nextTasks: tasks, moved };
  }

  const nextTasks = tasks
    .filter(t => !orphanIds.has(t.id))
    .map(t => {
      const added = additionsByParent.get(t.id);
      if (!added || added.length === 0) return t;
      const existingSubs = t.subTasks || [];
      const existingGoalIds = new Set(existingSubs.map(s => s.strategyGoalId).filter(Boolean));
      const dedupedAdded = added.filter(
        s => !s.strategyGoalId || !existingGoalIds.has(s.strategyGoalId)
      );
      const updatedSubs = [...existingSubs, ...dedupedAdded];
      return {
        ...t,
        subTasks: updatedSubs,
        completed: autoCompleteParent && updatedSubs.length > 0 ? updatedSubs.every(s => s.completed) : t.completed
      };
    });

  return { nextTasks, moved };
};

// Dynamic GWS -> Roadmap inheritance (order-independent: works even when a Weekly Goal is assigned to a Roadmap AFTER logging sprints!)
export const resolveSessionRoadmapPlanId = (
  session: GWSSession,
  weeklyPlans: Record<string, WeeklyPlan>,
  dailyEntries?: Record<string, DailyEntry>
): string | undefined => {
  if (session.roadmapPlanId) return session.roadmapPlanId;

  const findOnWeeklyTask = (weeklyTaskId?: string, subTaskId?: string): string | undefined => {
    if (!weeklyTaskId && !subTaskId) return undefined;
    for (const wp of Object.values(weeklyPlans)) {
      for (const t of wp.tasks || []) {
        if (subTaskId) {
          const sub = (t.subTasks || []).find(s => s.id === subTaskId);
          if (sub) return sub.strategyPlanId || t.strategyPlanId;
        }
        if (weeklyTaskId && t.id === weeklyTaskId) {
          return t.strategyPlanId;
        }
      }
    }
    return undefined;
  };

  const direct = findOnWeeklyTask(session.linkedWeeklyTaskId, session.linkedSubTaskId);
  if (direct) return direct;

  // Fallback for historical sprints: match daily priority on session.date by taskName
  const dayEntry = dailyEntries?.[session.date];
  if (dayEntry?.priorityItems && session.taskName?.trim()) {
    const norm = session.taskName.trim().toLowerCase();
    const prio = dayEntry.priorityItems.find(p => p.text.trim().toLowerCase() === norm);
    if (prio && (prio.weeklyTaskId || prio.subTaskId)) {
      return findOnWeeklyTask(prio.weeklyTaskId, prio.subTaskId);
    }
  }
  return undefined;
};

// Resolve parent Weekly Goal + Roadmap context for any DailyPriorityItem
export interface DailyPriorityContext {
  weeklyTask?: TaskItem;
  subTask?: SubTaskItem;
  roadmapPlan?: StrategyPlan;
  stageIndex?: number;
}

export const resolveDailyPriorityContext = (
  item: DailyPriorityItem,
  weeklyPlans: Record<string, WeeklyPlan>,
  strategyPlans: StrategyPlan[],
  preferredWeekId?: string
): DailyPriorityContext => {
  let weeklyTask: TaskItem | undefined;
  let subTask: SubTaskItem | undefined;

  if (item.weeklyTaskId || item.subTaskId) {
    const orderedWeeks = [
      ...(preferredWeekId && weeklyPlans[preferredWeekId] ? [weeklyPlans[preferredWeekId]] : []),
      ...Object.values(weeklyPlans).filter(w => w.id !== preferredWeekId)
    ];
    for (const wp of orderedWeeks) {
      for (const t of wp.tasks || []) {
        if (item.subTaskId) {
          const sub = (t.subTasks || []).find(s => s.id === item.subTaskId);
          if (sub) {
            weeklyTask = t;
            subTask = sub;
            break;
          }
        }
        if (!weeklyTask && item.weeklyTaskId && t.id === item.weeklyTaskId) {
          weeklyTask = t;
        }
      }
      if (subTask || (weeklyTask && !item.subTaskId)) break;
    }
  }

  const planId = subTask?.strategyPlanId || weeklyTask?.strategyPlanId;
  const stageId = subTask?.strategyStageId || weeklyTask?.strategyStageId;
  const roadmapPlan = planId ? strategyPlans.find(sp => sp.id === planId) : undefined;
  const stageIndex =
    roadmapPlan && stageId
      ? roadmapPlan.stages.findIndex(s => s.id === stageId)
      : undefined;

  return {
    weeklyTask,
    subTask,
    roadmapPlan,
    stageIndex: stageIndex !== undefined && stageIndex >= 0 ? stageIndex : undefined
  };
};

// Order-independent Carried Miss Diagnosis resolver for Daily priorities (works whether diagnosed before OR after pushing!)
export const resolveDailyCarriedDiagnosis = (
  item: DailyPriorityItem,
  dailyEntries: Record<string, DailyEntry>
): { cause?: OutcomeRootCause; note?: string } | null => {
  if (item.carriedDiagnosisCause || item.carriedDiagnosisNote?.trim()) {
    return {
      cause: item.carriedDiagnosisCause,
      note: item.carriedDiagnosisNote?.trim() || undefined
    };
  }
  if (!item.pushedFromDate) return null;
  const originEntry = dailyEntries[item.pushedFromDate];
  if (!originEntry?.priorityAudits) return null;

  const norm = item.text.trim().toLowerCase();
  const originItems = originEntry.priorityItems || [];
  const originMatch = originItems.find(
    p =>
      (item.subTaskId && p.subTaskId === item.subTaskId) ||
      (item.weeklyTaskId && !item.subTaskId && p.weeklyTaskId === item.weeklyTaskId && !p.subTaskId) ||
      (item.checklistItemId && p.checklistItemId === item.checklistItemId) ||
      (norm && p.text.trim().toLowerCase() === norm)
  );
  if (!originMatch) return null;
  const audit = originEntry.priorityAudits[originMatch.id];
  if (!audit?.rootCause && !audit?.note?.trim()) return null;
  return {
    cause: audit.rootCause,
    note: audit.note?.trim() || undefined
  };
};

// Order-independent Carried Miss Diagnosis resolver for Weekly / Monthly / Quarterly / Yearly tasks
export const resolvePeriodTaskCarriedDiagnosis = (
  task: TaskItem,
  scope: 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  sources: {
    weeklyPlans?: Record<string, WeeklyPlan>;
    monthlyPlans?: Record<string, MonthlyPlan>;
    quarterlyPlans?: Record<string, QuarterlyPlan>;
    yearlyPlans?: Record<string, YearlyPlan>;
    reviews?: ReviewEntry[];
  }
): { cause?: OutcomeRootCause; note?: string } | null => {
  if (task.carriedDiagnosisCause || task.carriedDiagnosisNote?.trim()) {
    return {
      cause: task.carriedDiagnosisCause,
      note: task.carriedDiagnosisNote?.trim() || undefined
    };
  }
  const from = task.pushedFromPeriod;
  if (!from) return null;
  const norm = task.text.trim().toLowerCase();
  if (!norm) return null;

  if (scope === 'weekly' && sources.weeklyPlans) {
    const weekNumMatch = from.match(/(\d+)/);
    const originWeek = weekNumMatch ? sources.weeklyPlans[`week_${weekNumMatch[1]}`] : undefined;
    if (!originWeek?.outcomeAudits) return null;
    const originTask = (originWeek.tasks || []).find(t => t.text.trim().toLowerCase() === norm);
    if (!originTask) return null;
    const audit = originWeek.outcomeAudits[originTask.id];
    if (!audit?.rootCause && !audit?.note?.trim()) return null;
    return { cause: audit.rootCause, note: audit.note?.trim() || undefined };
  }

  const originTasks =
    scope === 'monthly'
      ? sources.monthlyPlans?.[from]?.tasks
      : scope === 'quarterly'
      ? sources.quarterlyPlans?.[from]?.tasks
      : scope === 'yearly'
      ? sources.yearlyPlans?.[from]?.tasks
      : undefined;
  const originTask = (originTasks || []).find(t => t.text.trim().toLowerCase() === norm);
  if (!originTask) return null;

  const review = (sources.reviews || []).find(
    r => r.periodType === scope && r.periodKey === from
  );
  const audit = review?.outcomeAudits?.[originTask.id];
  if (!audit?.rootCause && !audit?.note?.trim()) return null;
  return { cause: audit.rootCause, note: audit.note?.trim() || undefined };
};
