import {
  MonthlyPlan,
  QuarterlyPlan,
  StrategyPlan,
  StrategyPlanPriority,
  StrategyStage,
  SubTaskItem,
  TaskItem,
  WeeklyPlan
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
        if (t.strategyPlanId === planId && t.strategyStageId === stageId) {
          quarterlySteps.push({ periodKey: qKey, periodLabel: qKey, task: t });
        }
      });
    });

  Object.entries(monthlyPlans)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([mKey, mp]) => {
      const shortMonth = getMonthInfo(mKey).label.split(' ')[0].slice(0, 3);
      (mp.tasks || []).forEach(t => {
        if (t.strategyPlanId === planId && t.strategyStageId === stageId) {
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

export const isRoadmapItemInWeeklyPlan = (
  plan: WeeklyPlan | undefined,
  text: string,
  strategyGoalId?: string
): boolean => {
  if (!plan) return false;
  if (strategyGoalId) {
    const byId = plan.tasks.some(
      t =>
        t.strategyGoalId === strategyGoalId ||
        (t.subTasks || []).some(s => s.strategyGoalId === strategyGoalId)
    );
    if (byId) return true;
  }
  const norm = text.trim().toLowerCase();
  if (!norm) return false;
  return plan.tasks.some(
    t =>
      t.text.trim().toLowerCase() === norm ||
      (t.subTasks || []).some(s => s.text.trim().toLowerCase() === norm)
  );
};

// Weekly goals explicitly assigned to a Roadmap (container goals without a single strategyGoalId)
export const getWeeklyGoalsAssignedToRoadmap = (
  plan: WeeklyPlan | undefined,
  strategyPlanId: string,
  strategyStageId?: string
): TaskItem[] => {
  if (!plan || !strategyPlanId) return [];
  const indexed = plan.tasks
    .map((task, idx) => ({ task, idx }))
    .filter(({ task }) => task.strategyPlanId === strategyPlanId && !task.strategyGoalId);

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
} => {
  const trimmed = params.text.trim();
  if (!trimmed) {
    return { nextTasks: weeklyPlan.tasks, alreadyExists: false };
  }
  if (isRoadmapItemInWeeklyPlan(weeklyPlan, trimmed, params.strategyGoalId)) {
    return { nextTasks: weeklyPlan.tasks, alreadyExists: true };
  }

  let targetParent: TaskItem | undefined;
  if (params.targetWeeklyTaskId === '__new__') {
    targetParent = undefined;
  } else if (params.targetWeeklyTaskId) {
    targetParent = weeklyPlan.tasks.find(t => t.id === params.targetWeeklyTaskId);
  } else if (params.strategyPlanId) {
    targetParent = getWeeklyGoalsAssignedToRoadmap(
      weeklyPlan,
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
    const nextTasks = weeklyPlan.tasks.map(t => {
      if (t.id !== targetParent!.id) return t;
      const updatedSubs = [...(t.subTasks || []), newSub];
      updatedParent = {
        ...t,
        subTasks: updatedSubs,
        completed: updatedSubs.every(s => s.completed)
      };
      return updatedParent;
    });
    return { nextTasks, landedInsideTask: updatedParent, alreadyExists: false };
  }

  const newTask: TaskItem = {
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text: trimmed,
    score: 2,
    completed: Boolean(params.completed),
    ...(params.sourceLabel ? { sourceLabel: params.sourceLabel } : {}),
    ...(params.strategyPlanId ? { strategyPlanId: params.strategyPlanId } : {}),
    ...(params.strategyStageId ? { strategyStageId: params.strategyStageId } : {}),
    ...(params.strategyGoalId ? { strategyGoalId: params.strategyGoalId } : {})
  };
  return { nextTasks: [...weeklyPlan.tasks, newTask], alreadyExists: false };
};
