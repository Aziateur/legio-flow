import { SystemLevel } from '../types/schema';
import { AppMainTab, AppPlanningSubTab, AppReviewSubTab, getLevelCapabilities } from './levelFeatures';

// Singleton promise-cached dynamic loaders so React.lazy() & background prefetch share the exact same in-flight fetch.
const memoLoader = <T,>(loader: () => Promise<T>): (() => Promise<T>) => {
  let cached: Promise<T> | null = null;
  return () => {
    if (!cached) {
      cached = loader().catch(err => {
        cached = null;
        throw err;
      });
    }
    return cached;
  };
};

export const loadGWSStudio = memoLoader(() =>
  import('../components/gws/GWSStudio').then(m => ({ default: m.GWSStudio }))
);
export const loadReviewHub = memoLoader(() =>
  import('../components/review/ReviewHub').then(m => ({ default: m.ReviewHub }))
);
export const loadTemplateManager = memoLoader(() =>
  import('../components/templates/TemplateManager').then(m => ({ default: m.TemplateManager }))
);
export const loadSpreadsheetMatrixView = memoLoader(() =>
  import('../components/matrix/SpreadsheetMatrixView').then(m => ({ default: m.SpreadsheetMatrixView }))
);
export const loadChecklistView = memoLoader(() =>
  import('../components/checklist/ChecklistView').then(m => ({ default: m.ChecklistView }))
);
export const loadWeeklyGoalCrusherView = memoLoader(() =>
  import('../components/weekly/WeeklyGoalCrusherView').then(m => ({ default: m.WeeklyGoalCrusherView }))
);
export const loadStrategyRoadmapsView = memoLoader(() =>
  import('../components/planning/StrategyRoadmapsView').then(m => ({ default: m.StrategyRoadmapsView }))
);
export const loadQuarterlyPlanSection = memoLoader(() =>
  import('../components/planning/QuarterlyPlanSection').then(m => ({ default: m.QuarterlyPlanSection }))
);
export const loadMacroReviewView = memoLoader(() =>
  import('../components/review/MacroReviewView').then(m => ({ default: m.MacroReviewView }))
);
export const loadProblemsLedgerView = memoLoader(() =>
  import('../components/problems/ProblemsLedgerView').then(m => ({ default: m.ProblemsLedgerView }))
);
export const loadWhatWorksPlaybookView = memoLoader(() =>
  import('../components/problems/WhatWorksPlaybookView').then(m => ({ default: m.WhatWorksPlaybookView }))
);

const safePrefetch = (fn: () => Promise<unknown>) => {
  void fn().catch(() => {
    // Offline or transient failure: ignore silently, retry when user opens tab
  });
};

export const prefetchMainTab = (tab: AppMainTab) => {
  if (tab === 'checklist') safePrefetch(loadChecklistView);
  else if (tab === 'gws') safePrefetch(loadGWSStudio);
  else if (tab === 'review') safePrefetch(loadReviewHub);
  else if (tab === 'matrix') safePrefetch(loadSpreadsheetMatrixView);
  else if (tab === 'templates') safePrefetch(loadTemplateManager);
};

export const prefetchPlanningSubTab = (sub: AppPlanningSubTab) => {
  if (sub === 'weekly') safePrefetch(loadWeeklyGoalCrusherView);
  else if (sub === 'quarterly') safePrefetch(loadQuarterlyPlanSection);
  else if (sub === 'roadmaps') safePrefetch(loadStrategyRoadmapsView);
  else if (sub === 'matrix') safePrefetch(loadSpreadsheetMatrixView);
};

export const prefetchReviewSubTab = (sub: AppReviewSubTab) => {
  if (sub === 'quarterly' || sub === 'yearly') safePrefetch(loadMacroReviewView);
  else if (sub === 'problems') safePrefetch(loadProblemsLedgerView);
  else if (sub === 'playbook') safePrefetch(loadWhatWorksPlaybookView);
};

// Gently warm unlocked view chunks during browser idle time right after first paint so tab switches feel instant (0ms).
export const scheduleIdlePrefetchForLevel = (level: SystemLevel): (() => void) => {
  const caps = getLevelCapabilities(level);
  const queue: Array<() => Promise<unknown>> = [loadChecklistView, loadReviewHub];
  if (caps.gwsStudio) queue.push(loadGWSStudio);
  if (caps.weeklyPlan) queue.push(loadWeeklyGoalCrusherView);
  if (caps.weeksMatrix) queue.push(loadSpreadsheetMatrixView);
  if (caps.roadmaps) queue.push(loadStrategyRoadmapsView);
  if (caps.quarterlyPlan) queue.push(loadQuarterlyPlanSection);
  if (caps.problemsInboxLite) queue.push(loadProblemsLedgerView);
  if (caps.whatWorksPlaybook) queue.push(loadWhatWorksPlaybookView);
  if (caps.quarterlyReview || caps.yearlyReview) queue.push(loadMacroReviewView);

  let cancelled = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let idleId: number | null = null;

  const runNext = (idx: number) => {
    if (cancelled || idx >= queue.length) return;
    safePrefetch(queue[idx]);
    // Stagger slightly so prefetch never contends with early user interaction
    timerId = setTimeout(() => runNext(idx + 1), 90);
  };

  const kickOff = () => {
    if (cancelled) return;
    runNext(0);
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    idleId = (window as any).requestIdleCallback(kickOff, { timeout: 600 });
  } else {
    timerId = setTimeout(kickOff, 250);
  }

  return () => {
    cancelled = true;
    if (timerId !== null) clearTimeout(timerId);
    if (idleId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
      (window as any).cancelIdleCallback(idleId);
    }
  };
};
