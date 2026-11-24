import { SystemLevel } from '../types/schema';

export type AppMainTab = 'planning' | 'checklist' | 'gws' | 'review' | 'templates' | 'matrix';
export type AppPlanningSubTab = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'roadmaps' | 'matrix';
export type AppReviewSubTab = 'daily' | 'gws' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'problems' | 'vault';

export interface LevelCapabilities {
  level: SystemLevel;
  // LVL 1 — Daily Flow
  dailyPlan: boolean;
  dailyChecklist: boolean;
  allowances: boolean;
  dailyReview: boolean;
  // LVL 2 — Focus & Friction Awareness
  gwsStudio: boolean;
  gwsReview: boolean;
  repsBoard: boolean;
  problemsInboxLite: boolean;
  // LVL 3 — Weekly System & Root Constraints
  weeklyPlan: boolean;
  weeksMatrix: boolean;
  weeklyReview: boolean;
  vault: boolean;
  problemsConstraintEngine: boolean;
  // LVL 4 — Macro Execution, Roadmaps & KPIs
  monthlyPlan: boolean;
  quarterlyPlan: boolean;
  monthlyReview: boolean;
  quarterlyReview: boolean;
  roadmaps: boolean;
  modelAWeekToMonth: boolean;
  kpiProofChecks: boolean;
  gwsFocusAndRoadmapTagging: boolean;
  dailyMacroCompass: boolean;
  // LVL 5 — Yearly Master Strategy
  yearlyPlan: boolean;
  yearlyReview: boolean;
  modelAQuarterToYear: boolean;
}

export const getLevelCapabilities = (level: SystemLevel): LevelCapabilities => ({
  level,
  // LVL 1
  dailyPlan: true,
  dailyChecklist: true,
  allowances: true,
  dailyReview: true,
  // LVL 2
  gwsStudio: level >= 2,
  gwsReview: level >= 2,
  repsBoard: level >= 2,
  problemsInboxLite: level >= 2,
  // LVL 3
  weeklyPlan: level >= 3,
  weeksMatrix: level >= 3,
  weeklyReview: level >= 3,
  vault: level >= 3,
  problemsConstraintEngine: level >= 3,
  // LVL 4
  monthlyPlan: level >= 4,
  quarterlyPlan: level >= 4,
  monthlyReview: level >= 4,
  quarterlyReview: level >= 4,
  roadmaps: level >= 4,
  modelAWeekToMonth: level >= 4,
  kpiProofChecks: level >= 4,
  gwsFocusAndRoadmapTagging: level >= 4,
  dailyMacroCompass: level >= 4,
  // LVL 5
  yearlyPlan: level >= 5,
  yearlyReview: level >= 5,
  modelAQuarterToYear: level >= 5
});

export interface LevelMeta {
  name: string;
  shortName: string;
  desc: string;
}

export const LEVEL_META: Record<SystemLevel, LevelMeta> = {
  1: {
    name: 'Level 1: Daily Flow',
    shortName: 'Daily Flow',
    desc: 'Daily mission plan, routine checklist, allowances & daily review'
  },
  2: {
    name: 'Level 2: Focus & Limits',
    shortName: 'Focus & Limits',
    desc: 'Adds GWS deep work cockpit, Reps Board & simple Friction Inbox'
  },
  3: {
    name: 'Level 3: Weekly & Constraints',
    shortName: 'Weekly & Constraints',
    desc: 'Adds Weekly 10-pt Goal Crusher, Weeks Matrix, Vault & Root Constraint Engine'
  },
  4: {
    name: 'Level 4: Macro, Roadmaps & KPIs',
    shortName: 'Macro & Roadmaps',
    desc: 'Adds Monthly/Quarterly Plans & Reviews, Stage-Gate Roadmaps, Model A links & KPI proofs'
  },
  5: {
    name: 'Level 5: Yearly Strategy',
    shortName: 'Yearly Strategy',
    desc: 'Adds Yearly North Star Plan, Yearly Executive Review & full Year ↔ Quarter hierarchy'
  }
};

export const coerceActiveTabForLevel = (tab: AppMainTab, level: SystemLevel): AppMainTab => {
  const caps = getLevelCapabilities(level);
  if (tab === 'gws' && !caps.gwsStudio) return 'planning';
  if (tab === 'matrix' && !caps.weeksMatrix) return 'planning';
  return tab;
};

export const coercePlanningSubTabForLevel = (
  subTab: AppPlanningSubTab,
  level: SystemLevel
): AppPlanningSubTab => {
  const caps = getLevelCapabilities(level);
  if (subTab === 'weekly' && !caps.weeklyPlan) return 'daily';
  if (subTab === 'matrix' && !caps.weeksMatrix) return 'daily';
  if (subTab === 'monthly' && !caps.monthlyPlan) return caps.weeklyPlan ? 'weekly' : 'daily';
  if (subTab === 'quarterly' && !caps.quarterlyPlan) return caps.weeklyPlan ? 'weekly' : 'daily';
  if (subTab === 'roadmaps' && !caps.roadmaps) return caps.weeklyPlan ? 'weekly' : 'daily';
  if (subTab === 'yearly' && !caps.yearlyPlan) return caps.quarterlyPlan ? 'quarterly' : caps.weeklyPlan ? 'weekly' : 'daily';
  return subTab;
};

export const coerceReviewSubTabForLevel = (
  subTab: AppReviewSubTab,
  level: SystemLevel
): AppReviewSubTab => {
  const caps = getLevelCapabilities(level);
  if (subTab === 'gws' && !caps.gwsReview) return 'daily';
  if (subTab === 'problems' && !caps.problemsInboxLite) return 'daily';
  if (subTab === 'weekly' && !caps.weeklyReview) return 'daily';
  if (subTab === 'vault' && !caps.vault) return 'daily';
  if (subTab === 'monthly' && !caps.monthlyReview) return caps.weeklyReview ? 'weekly' : 'daily';
  if (subTab === 'quarterly' && !caps.quarterlyReview) return caps.weeklyReview ? 'weekly' : 'daily';
  if (subTab === 'yearly' && !caps.yearlyReview) return caps.quarterlyReview ? 'quarterly' : caps.weeklyReview ? 'weekly' : 'daily';
  return subTab;
};
