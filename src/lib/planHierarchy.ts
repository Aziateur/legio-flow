import {
  MonthlyPlan,
  QuarterlyPlan,
  StrategyPlan,
  StrategyStage,
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

export const getCommittedGatesForQuarter = (
  quarterPlan: QuarterlyPlan | undefined,
  strategyPlans: StrategyPlan[]
): CommittedGateDetail[] => {
  if (!quarterPlan?.targetGateRefs?.length) return [];
  const results: CommittedGateDetail[] = [];
  quarterPlan.targetGateRefs.forEach(ref => {
    const plan = strategyPlans.find(sp => sp.id === ref.planId);
    if (!plan) return;
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
        if (t.strategyPlanId === planId && t.strategyStageId === stageId) {
          weeklySteps.push({ periodKey: wp.id, periodLabel: `W${wp.weekNumber}`, task: t });
        }
      });
    });

  return { targetQuarters, quarterlySteps, monthlySteps, weeklySteps };
};
