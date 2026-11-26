import {
  ChecklistItem,
  CustomProblemCategory,
  OutcomeRootCause,
  ProblemCategory,
  ProblemCheckInOutcome,
  ProblemColorKey,
  ProblemDispatchTarget,
  ProblemEntry,
  ProblemFixType,
  ProblemImpact,
  ProblemScale,
  ProblemSeverity,
  ProblemSourceType,
  ProblemStatus,
  StrategyPlan,
  WeeklyPlan
} from '../types/schema';

export interface ProblemScaleMeta {
  id: ProblemScale;
  label: string;
  shortLabel: string;
  rank: 1 | 2 | 3;
  hint: string;
  badgeClass: string;
  activeChipClass: string;
}

export const PROBLEM_SCALES: ProblemScaleMeta[] = [
  {
    id: 'friction',
    label: 'Friction',
    shortLabel: 'Friction',
    rank: 1,
    hint: 'Small day-to-day symptom or slip (GWS / Daily). Can cluster into a Bottleneck or Blocker.',
    badgeClass: 'bg-slate-800/90 text-slate-400 border-slate-700',
    activeChipClass: 'bg-slate-200 text-slate-950 border-slate-100'
  },
  {
    id: 'bottleneck',
    label: 'Bottleneck',
    shortLabel: 'Bottleneck',
    rank: 2,
    hint: 'Recurring weekly pattern that clusters related Friction. Fix once at this level.',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    activeChipClass: 'bg-amber-400 text-slate-950 border-amber-300'
  },
  {
    id: 'blocker',
    label: 'Blocker',
    shortLabel: 'Blocker',
    rank: 3,
    hint: 'Major structural constraint blocking a Month, Quarter, or Roadmap Stage Gate.',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    activeChipClass: 'bg-rose-500 text-slate-950 border-rose-400'
  }
];

export const SCALE_MAP: Record<ProblemScale, ProblemScaleMeta> = PROBLEM_SCALES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<ProblemScale, ProblemScaleMeta>
);

export const SCALE_RANK: Record<ProblemScale, number> = {
  friction: 1,
  bottleneck: 2,
  blocker: 3
};

export const defaultScaleForSource = (sourceType?: ProblemSourceType): ProblemScale => {
  if (sourceType === 'weekly') return 'bottleneck';
  if (
    sourceType === 'monthly' ||
    sourceType === 'quarterly' ||
    sourceType === 'yearly' ||
    sourceType === 'roadmap'
  ) {
    return 'blocker';
  }
  return 'friction';
};

export const getProblemScale = (problem: ProblemEntry): ProblemScale =>
  problem.scale || 'friction';

export interface ProblemCategoryMeta {
  id: ProblemCategory;
  label: string;
  shortLabel: string;
  hint: string;
  badgeClass: string;
  activeChipClass: string;
  barClass: string;
  dotClass: string;
}

export const PROBLEM_CATEGORIES: ProblemCategoryMeta[] = [
  {
    id: 'mindset',
    label: 'Mindset',
    shortLabel: 'Mindset',
    hint: 'Hesitation, distraction, ego, emotional tilt, avoidance, discipline slip',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
    activeChipClass: 'bg-rose-500 text-slate-950 border-rose-400',
    barClass: 'bg-rose-500',
    dotClass: 'bg-rose-400'
  },
  {
    id: 'skill',
    label: 'Skill',
    shortLabel: 'Skill',
    hint: 'Knowledge gap, technical weakness, needs more reps or study',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
    activeChipClass: 'bg-sky-400 text-slate-950 border-sky-300',
    barClass: 'bg-sky-500',
    dotClass: 'bg-sky-400'
  },
  {
    id: 'logistics',
    label: 'Mechanical / Logistics',
    shortLabel: 'Logistics',
    hint: 'Workflow friction, missing tool/setup, environment, scheduling bottleneck',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    activeChipClass: 'bg-amber-400 text-slate-950 border-amber-300',
    barClass: 'bg-amber-500',
    dotClass: 'bg-amber-400'
  },
  {
    id: 'energy',
    label: 'Energy / Biology',
    shortLabel: 'Energy',
    hint: 'Sleep, fatigue, recovery, nutrition, brain fog, timing',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
    activeChipClass: 'bg-emerald-400 text-slate-950 border-emerald-300',
    barClass: 'bg-emerald-500',
    dotClass: 'bg-emerald-400'
  },
  {
    id: 'strategy',
    label: 'Strategy / Clarity',
    shortLabel: 'Strategy',
    hint: 'Unclear priority, over-scoped plan, wrong target, missing next step',
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/35',
    activeChipClass: 'bg-violet-400 text-slate-950 border-violet-300',
    barClass: 'bg-violet-500',
    dotClass: 'bg-violet-400'
  }
];

export const CATEGORY_MAP: Record<ProblemCategory, ProblemCategoryMeta> = PROBLEM_CATEGORIES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<ProblemCategory, ProblemCategoryMeta>
);

export interface ProblemFixTypeMeta {
  id: ProblemFixType;
  label: string;
  shortLabel: string;
  hint: string;
  badgeClass: string;
  dispatchTargets: ProblemDispatchTarget[];
}

export const PROBLEM_FIX_TYPES: ProblemFixTypeMeta[] = [
  {
    id: 'task',
    label: 'One-Off Task',
    shortLabel: 'Task',
    hint: 'Single concrete action removes the bottleneck once.',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dispatchTargets: ['weekly_plan', 'checklist_oneoff']
  },
  {
    id: 'habit_rewire',
    label: 'Habit Rewire',
    shortLabel: 'Habit Rewire',
    hint: 'Recurring daily/weekly routine prevents the problem automatically.',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dispatchTargets: ['checklist_daily', 'checklist_weekly']
  },
  {
    id: 'skill_reps',
    label: 'Skill Reps',
    shortLabel: 'Skill Reps',
    hint: 'Build accumulated volume until competence crosses the threshold.',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    dispatchTargets: ['reps_board', 'weekly_plan']
  },
  {
    id: 'rule_guardrail',
    label: 'Rule / Guardrail',
    shortLabel: 'Rule',
    hint: 'Stop-doing boundary or If-Then constraint audited during reviews.',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    dispatchTargets: []
  },
  {
    id: 'plan_change',
    label: 'Plan Change',
    shortLabel: 'Plan Change',
    hint: 'Adjust scope, sequence, weekly goals, or roadmap gates.',
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    dispatchTargets: ['weekly_plan']
  },
  {
    id: 'watch',
    label: 'Watch / Lagging',
    shortLabel: 'Watch',
    hint: 'Monitor recurrence before reacting — promote if it hits ×2–3.',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    dispatchTargets: []
  }
];

export const FIX_TYPE_MAP: Record<ProblemFixType, ProblemFixTypeMeta> = PROBLEM_FIX_TYPES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<ProblemFixType, ProblemFixTypeMeta>
);

export const DISPATCH_TARGET_LABELS: Record<ProblemDispatchTarget, string> = {
  weekly_plan: 'Weekly Plan',
  checklist_oneoff: 'One-Off Checklist',
  checklist_daily: 'Daily Checklist',
  checklist_weekly: 'Weekly Checklist',
  reps_board: 'Reps Board'
};

export const STATUS_META: Record<
  ProblemStatus,
  { label: string; badgeClass: string }
> = {
  open: {
    label: 'Open',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/35'
  },
  testing: {
    label: 'Testing Fix',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/35'
  },
  solved: {
    label: 'Solved',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
  }
};

export const normalizeTag = (raw: string): string =>
  raw.replace(/^#+/, '').trim().replace(/\s+/g, ' ');

export const tagsMatch = (a: string, b: string): boolean =>
  normalizeTag(a).toLowerCase() === normalizeTag(b).toLowerCase();

export const problemHasTag = (problem: ProblemEntry, tag: string): boolean =>
  (problem.tags || []).some(t => tagsMatch(t, tag));

export const problemOccurredOnDate = (problem: ProblemEntry, date: string): boolean =>
  (problem.occurrences || []).some(o => o.date === date);

export const problemOccurredInRange = (
  problem: ProblemEntry,
  startDate: string,
  endDate: string
): boolean =>
  (problem.occurrences || []).some(o => o.date >= startDate && o.date <= endDate);

export const countOccurrencesInRange = (
  problem: ProblemEntry,
  startDate: string,
  endDate: string
): number =>
  (problem.occurrences || []).filter(o => o.date >= startDate && o.date <= endDate).length;

export const getLastOccurrenceDate = (problem: ProblemEntry): string => {
  const dates = (problem.occurrences || []).map(o => o.date).filter(Boolean).sort();
  return dates[dates.length - 1] || problem.createdAt.slice(0, 10);
};

// --- CLUSTERING HELPERS (Friction -> Bottleneck -> Blocker) ---

export const getDirectChildren = (
  allProblems: ProblemEntry[],
  parentId: string
): ProblemEntry[] => allProblems.filter(p => p.parentProblemId === parentId);

export const getDescendantProblems = (
  allProblems: ProblemEntry[],
  parentId: string
): ProblemEntry[] => {
  const result: ProblemEntry[] = [];
  const visited = new Set<string>([parentId]);
  const queue = [parentId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const p of allProblems) {
      if (p.parentProblemId === cur && !visited.has(p.id)) {
        visited.add(p.id);
        result.push(p);
        queue.push(p.id);
      }
    }
  }
  return result;
};

export const getClusterTotalHits = (
  allProblems: ProblemEntry[],
  problem: ProblemEntry
): number => {
  const own = Math.max(1, problem.occurrences?.length || 1);
  const descendants = getDescendantProblems(allProblems, problem.id);
  return descendants.reduce((sum, d) => sum + Math.max(1, d.occurrences?.length || 1), own);
};

export const clusterOccurredOnDate = (
  allProblems: ProblemEntry[],
  problem: ProblemEntry,
  date: string
): boolean => {
  if (problemOccurredOnDate(problem, date)) return true;
  return getDescendantProblems(allProblems, problem.id).some(d =>
    problemOccurredOnDate(d, date)
  );
};

export const clusterOccurredInRange = (
  allProblems: ProblemEntry[],
  problem: ProblemEntry,
  startDate: string,
  endDate: string
): boolean => {
  if (problemOccurredInRange(problem, startDate, endDate)) return true;
  return getDescendantProblems(allProblems, problem.id).some(d =>
    problemOccurredInRange(d, startDate, endDate)
  );
};

export const countClusterOccurrencesInRange = (
  allProblems: ProblemEntry[],
  problem: ProblemEntry,
  startDate: string,
  endDate: string
): number => {
  const own = countOccurrencesInRange(problem, startDate, endDate);
  const descendants = getDescendantProblems(allProblems, problem.id);
  return descendants.reduce(
    (sum, d) => sum + countOccurrencesInRange(d, startDate, endDate),
    own
  );
};

export const clusterHasTag = (
  allProblems: ProblemEntry[],
  problem: ProblemEntry,
  tag: string
): boolean => {
  if (problemHasTag(problem, tag)) return true;
  return getDescendantProblems(allProblems, problem.id).some(d => problemHasTag(d, tag));
};

// Stable ID-first Roadmap matching (with safe legacy tag/title fallback so pre-existing problems still attach)
export const problemMatchesRoadmap = (
  problem: ProblemEntry,
  planId: string,
  planTitle?: string
): boolean => {
  if (problem.roadmapPlanId) {
    return problem.roadmapPlanId === planId;
  }
  const normPlan = planTitle ? normalizeTag(planTitle) : '';
  if (!normPlan) return false;
  if (problemHasTag(problem, normPlan)) return true;
  return problem.title.toLowerCase().includes(planTitle!.trim().toLowerCase());
};

export const clusterMatchesRoadmap = (
  allProblems: ProblemEntry[],
  problem: ProblemEntry,
  planId: string,
  planTitle?: string
): boolean => {
  if (problemMatchesRoadmap(problem, planId, planTitle)) return true;
  return getDescendantProblems(allProblems, problem.id).some(d =>
    problemMatchesRoadmap(d, planId, planTitle)
  );
};

export const resolveProblemRoadmapPlanId = (
  problem: ProblemEntry,
  strategyPlans: StrategyPlan[]
): string | undefined => {
  if (problem.roadmapPlanId && strategyPlans.some(p => p.id === problem.roadmapPlanId)) {
    return problem.roadmapPlanId;
  }
  const activePlans = strategyPlans.filter(
    p => p.status !== 'possible' && p.status !== 'not_pursuing'
  );
  const tagHit = activePlans.find(sp => {
    const clean = sp.title.trim();
    return clean && problemHasTag(problem, clean);
  });
  return tagHit?.id;
};

export const clusterHasSourceType = (
  allProblems: ProblemEntry[],
  problem: ProblemEntry,
  sourceType: ProblemSourceType
): boolean => {
  if ((problem.occurrences || []).some(o => o.sourceType === sourceType)) return true;
  return getDescendantProblems(allProblems, problem.id).some(d =>
    (d.occurrences || []).some(o => o.sourceType === sourceType)
  );
};

export const hasExistingParent = (
  allProblems: ProblemEntry[],
  problem: ProblemEntry
): boolean =>
  Boolean(problem.parentProblemId && allProblems.some(p => p.id === problem.parentProblemId));

export const getEligibleParentProblems = (
  allProblems: ProblemEntry[],
  childScale: ProblemScale,
  excludeId?: string
): ProblemEntry[] => {
  const childRank = SCALE_RANK[childScale];
  const descendants = excludeId
    ? new Set(getDescendantProblems(allProblems, excludeId).map(d => d.id))
    : new Set<string>();
  return allProblems
    .filter(p => {
      if (excludeId && (p.id === excludeId || descendants.has(p.id))) return false;
      return SCALE_RANK[getProblemScale(p)] > childRank;
    })
    .sort((a, b) => {
      // Active parents first, then higher scale, then most recent
      const sa = a.status === 'solved' ? 1 : 0;
      const sb = b.status === 'solved' ? 1 : 0;
      if (sa !== sb) return sa - sb;
      const rDiff = SCALE_RANK[getProblemScale(b)] - SCALE_RANK[getProblemScale(a)];
      if (rDiff !== 0) return rDiff;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
};

export const guessProblemCategory = (text: string): ProblemCategory => {
  const lower = text.toLowerCase();
  if (/(sleep|tired|fatigue|energy|exhaust|burnout|wake|night|bed|health|sick|headache)/.test(lower)) {
    return 'energy';
  }
  if (/(skill|learn|know|backtest|practice|study|technique|code|coding|grammar|guitar|chart)/.test(lower)) {
    return 'skill';
  }
  if (/(tool|setup|wifi|internet|bug|install|schedule|calendar|time|alarm|laptop|app|admin|phone|logis)/.test(lower)) {
    return 'logistics';
  }
  if (/(plan|scope|clarity|unclear|priority|too much|wrong goal|target|roadmap|stage|order)/.test(lower)) {
    return 'strategy';
  }
  return 'mindset';
};

export const formatProblemsForReviewText = (
  list: ProblemEntry[],
  allProblems?: ProblemEntry[],
  customCategories?: CustomProblemCategory[]
): string => {
  if (list.length === 0) return '';
  const sourcePool = allProblems || list;
  const listIds = new Set(list.map(p => p.id));
  const topLevel = list.filter(p => !p.parentProblemId || !listIds.has(p.parentProblemId));

  return topLevel
    .map(p => {
      const cat = resolveCategoryMeta(p.category, customCategories).shortLabel;
      const sevMeta = SEVERITY_META[getProblemSeverity(p)];
      const children = getDescendantProblems(sourcePool, p.id);
      const hits = getClusterTotalHits(sourcePool, p);
      const count = hits > 1 ? ` (×${hits})` : '';
      const childSummary = children.length > 0 ? ` [${children.length} slips]` : '';
      const tagStr = p.tags.length > 0 ? ` [${p.tags.map(t => `#${t}`).join(' ')}]` : '';
      const triggerStr = p.trigger?.trim() ? ` | When: ${p.trigger.trim()}` : '';
      const fixStr = p.fixNote?.trim() ? ` → Fix: ${p.fixNote.trim()}` : '';
      const statusStr = p.status === 'solved' ? ' ✓Solved' : p.status === 'testing' ? ' ⟳Testing' : '';
      const pinStr = p.isTopConstraint ? ' ★TOP ' : ' ';
      return `•${pinStr}[${sevMeta.code} ${sevMeta.shortLabel} · ${cat}]${statusStr} ${p.title}${count}${childSummary}${tagStr}${triggerStr}${fixStr}`;
    })
    .join('\n');
};

// --- CUSTOM CATEGORIES, IMPACT, EXPERIMENT VERIFICATION & ROOT-PROBLEM ENGINE ---

export const PROBLEM_COLOR_STYLES: Record<
  ProblemColorKey,
  { badgeClass: string; activeChipClass: string; barClass: string; dotClass: string; label: string }
> = {
  rose: {
    label: 'Rose',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
    activeChipClass: 'bg-rose-500 text-slate-950 border-rose-400',
    barClass: 'bg-rose-500',
    dotClass: 'bg-rose-400'
  },
  sky: {
    label: 'Sky',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
    activeChipClass: 'bg-sky-400 text-slate-950 border-sky-300',
    barClass: 'bg-sky-500',
    dotClass: 'bg-sky-400'
  },
  amber: {
    label: 'Amber',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    activeChipClass: 'bg-amber-400 text-slate-950 border-amber-300',
    barClass: 'bg-amber-500',
    dotClass: 'bg-amber-400'
  },
  emerald: {
    label: 'Emerald',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
    activeChipClass: 'bg-emerald-400 text-slate-950 border-emerald-300',
    barClass: 'bg-emerald-500',
    dotClass: 'bg-emerald-400'
  },
  violet: {
    label: 'Violet',
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/35',
    activeChipClass: 'bg-violet-400 text-slate-950 border-violet-300',
    barClass: 'bg-violet-500',
    dotClass: 'bg-violet-400'
  },
  cyan: {
    label: 'Cyan',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
    activeChipClass: 'bg-cyan-400 text-slate-950 border-cyan-300',
    barClass: 'bg-cyan-500',
    dotClass: 'bg-cyan-400'
  },
  orange: {
    label: 'Orange',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/35',
    activeChipClass: 'bg-orange-400 text-slate-950 border-orange-300',
    barClass: 'bg-orange-500',
    dotClass: 'bg-orange-400'
  },
  slate: {
    label: 'Slate',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    activeChipClass: 'bg-slate-200 text-slate-950 border-slate-100',
    barClass: 'bg-slate-500',
    dotClass: 'bg-slate-400'
  }
};

export const resolveCategoryMeta = (
  categoryId: ProblemCategory,
  customCategories?: CustomProblemCategory[]
): ProblemCategoryMeta => {
  const found = (customCategories || []).find(c => c.id === categoryId);
  if (found) {
    const style = PROBLEM_COLOR_STYLES[found.color] || PROBLEM_COLOR_STYLES.slate;
    return {
      ...style,
      id: found.id,
      label: found.label,
      shortLabel: found.label,
      hint: found.hint || ''
    };
  }
  if (CATEGORY_MAP[categoryId]) {
    return CATEGORY_MAP[categoryId];
  }
  return {
    ...PROBLEM_COLOR_STYLES.slate,
    id: categoryId || 'general',
    label: categoryId || 'General',
    shortLabel: categoryId || 'General',
    hint: ''
  };
};

export interface ProblemImpactMeta {
  id: ProblemImpact;
  label: string;
  shortLabel: string;
  hint: string;
  dotClass: string;
  badgeClass: string;
  activeChipClass: string;
}

export const PROBLEM_IMPACTS: ProblemImpactMeta[] = [
  {
    id: 'critical',
    label: 'Critical Cost',
    shortLabel: 'Critical',
    hint: 'High real-world damage or directly blocks a Roadmap Gate / major goal.',
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    activeChipClass: 'bg-rose-500 text-slate-950 border-rose-400'
  },
  {
    id: 'high',
    label: 'High Drag',
    shortLabel: 'High',
    hint: 'Repeatedly slows execution, energy, or weekly consistency.',
    dotClass: 'bg-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    activeChipClass: 'bg-amber-400 text-slate-950 border-amber-300'
  },
  {
    id: 'low',
    label: 'Low / Minor',
    shortLabel: 'Low',
    hint: 'Small annoyance or minor friction — monitor unless it compounds.',
    dotClass: 'bg-slate-500',
    badgeClass: 'bg-slate-800/90 text-slate-400 border-slate-700',
    activeChipClass: 'bg-slate-200 text-slate-950 border-slate-100'
  }
];

export const IMPACT_META: Record<ProblemImpact, ProblemImpactMeta> = {
  critical: PROBLEM_IMPACTS[0],
  high: PROBLEM_IMPACTS[1],
  low: PROBLEM_IMPACTS[2]
};

export const IMPACT_RANK: Record<ProblemImpact, number> = {
  critical: 3,
  high: 2,
  low: 1
};

export const getProblemImpact = (problem: ProblemEntry): ProblemImpact => {
  if (problem.impact) return problem.impact;
  if (problem.severity) return severityToImpact(problem.severity);
  const sc = getProblemScale(problem);
  if (sc === 'blocker') return 'critical';
  if (sc === 'bottleneck') return 'high';
  return 'low';
};

export interface ProblemSeverityMeta {
  grade: ProblemSeverity;
  code: string;
  label: string;
  shortLabel: string;
  hint: string;
  dotClass: string;
  badgeClass: string;
  activeChipClass: string;
}

export const PROBLEM_SEVERITIES: ProblemSeverityMeta[] = [
  {
    grade: 1,
    code: 'S1',
    label: '1 · Minor',
    shortLabel: 'Minor',
    hint: 'Tiny annoyance — barely affects daily execution.',
    dotClass: 'bg-slate-500',
    badgeClass: 'bg-slate-800/90 text-slate-400 border-slate-700',
    activeChipClass: 'bg-slate-200 text-slate-950 border-slate-100'
  },
  {
    grade: 2,
    code: 'S2',
    label: '2 · Low',
    shortLabel: 'Low',
    hint: 'Small friction — watch if it keeps repeating.',
    dotClass: 'bg-sky-400',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
    activeChipClass: 'bg-sky-400 text-slate-950 border-sky-300'
  },
  {
    grade: 3,
    code: 'S3',
    label: '3 · Moderate',
    shortLabel: 'Moderate',
    hint: 'Noticeable drag on focus, habits, or momentum.',
    dotClass: 'bg-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    activeChipClass: 'bg-amber-400 text-slate-950 border-amber-300'
  },
  {
    grade: 4,
    code: 'S4',
    label: '4 · Severe',
    shortLabel: 'Severe',
    hint: 'Major recurring bottleneck derailing weekly outcomes.',
    dotClass: 'bg-orange-500',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
    activeChipClass: 'bg-orange-500 text-slate-950 border-orange-400'
  },
  {
    grade: 5,
    code: 'S5',
    label: '5 · Critical',
    shortLabel: 'Critical',
    hint: 'System-breaking damage or directly blocks a major goal / Roadmap Gate.',
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/45',
    activeChipClass: 'bg-rose-500 text-slate-950 border-rose-400'
  }
];

export const SEVERITY_META: Record<ProblemSeverity, ProblemSeverityMeta> = {
  1: PROBLEM_SEVERITIES[0],
  2: PROBLEM_SEVERITIES[1],
  3: PROBLEM_SEVERITIES[2],
  4: PROBLEM_SEVERITIES[3],
  5: PROBLEM_SEVERITIES[4]
};

export const severityToImpact = (severity: ProblemSeverity): ProblemImpact => {
  if (severity >= 5) return 'critical';
  if (severity >= 3) return 'high';
  return 'low';
};

export const getProblemSeverity = (problem: ProblemEntry): ProblemSeverity => {
  if (typeof problem.severity === 'number' && problem.severity >= 1 && problem.severity <= 5) {
    return Math.round(problem.severity) as ProblemSeverity;
  }
  if (problem.impact === 'critical' || problem.scale === 'blocker') return 5;
  if (problem.impact === 'high' || problem.scale === 'bottleneck') return 3;
  return 2;
};

export const isProblemGuardrail = (problem: ProblemEntry): boolean =>
  Boolean(problem.isGuardrail || problem.fixType === 'rule_guardrail' || problem.reminderText?.trim());

// Dedicated Reminder / Mental Shift text (supports coexisting with a concrete action fixNote!)
export const getProblemReminderText = (problem: ProblemEntry): string => {
  if (problem.reminderText?.trim()) return problem.reminderText.trim();
  if (problem.isGuardrail || problem.fixType === 'rule_guardrail') {
    return problem.fixNote?.trim() || '';
  }
  return '';
};

export const hasActiveReminder = (problem: ProblemEntry): boolean =>
  Boolean(problem.reminderText?.trim() || problem.isGuardrail || problem.fixType === 'rule_guardrail');

// Concrete action / task / routine fix (distinct from a legacy reminder-only guardrail)
export const getProblemActionText = (problem: ProblemEntry): string => {
  const fix = problem.fixNote?.trim() || '';
  if (!fix) return '';
  if (!problem.reminderText?.trim() && (problem.isGuardrail || problem.fixType === 'rule_guardrail') && !(problem.dispatchedTo && problem.dispatchedTo.length > 0)) {
    return '';
  }
  return fix;
};

export const hasActiveAction = (problem: ProblemEntry): boolean =>
  Boolean((problem.dispatchedTo && problem.dispatchedTo.length > 0) || getProblemActionText(problem));

// Explicit active Observation mode (distinct from idle backlog waiting)
export const isProblemWatching = (problem: ProblemEntry): boolean => {
  if (problem.status === 'solved') return false;
  if (typeof problem.watching === 'boolean') return problem.watching;
  // Backward-compatible default: Top 3 focus items without an active solution default to Watching
  return Boolean(problem.isTopConstraint && !hasActiveReminder(problem) && !hasActiveAction(problem));
};

// Per-problem toggle: ask for a 1-line context sentence when logging a hit
// Defaults ON for Top 3 Focus constraints & actively Observed items, OFF for everything else!
export const shouldPromptNoteOnHit = (problem: ProblemEntry): boolean => {
  if (typeof problem.promptNoteOnHit === 'boolean') return problem.promptNoteOnHit;
  return Boolean(problem.isTopConstraint || isProblemWatching(problem));
};

export const getProblemCheckInForDate = (
  problem: ProblemEntry,
  date: string
): ProblemCheckInOutcome | null => {
  const hit = (problem.checkIns || []).find(c => c.date === date);
  if (hit) return hit.outcome;
  if ((problem.heldDates || []).includes(date)) return 'effective';
  return null;
};

export const missCauseToProblemCategory = (cause?: OutcomeRootCause): ProblemCategory => {
  if (cause === 'energy') return 'energy';
  if (cause === 'skill') return 'skill';
  if (cause === 'clarity' || cause === 'scope' || cause === 'strategy') return 'strategy';
  if (cause === 'time' || cause === 'external') return 'logistics';
  return 'mindset';
};

export type PulseDayState = 'hit' | 'effective' | 'tweaked' | 'not_triggered' | 'quiet';

export interface ProblemPulseDay {
  date: string;
  state: PulseDayState;
}

export interface ProblemPulseSummary {
  days: ProblemPulseDay[]; // 14 days oldest -> newest ending at todayDate
  hits7d: number;
  hits14d: number;
  effective14d: number;
  daysSinceLastHit: number;
  trend: 'hot' | 'active' | 'cooling' | 'quiet';
  trendLabel: string;
}

export type SolutionTestingState = 'none' | 'untested' | 'holding' | 'tweaked' | 'ready' | 'failed';

export interface SolutionTestingSummary {
  hasSolution: boolean;
  state: SolutionTestingState;
  version: number;
  targetCount: number;
  effectiveCount: number;
  pendingTweakCount: number;
  notTriggeredCount: number;
  failedCount: number;
  pct: number;
  readyToResolve: boolean;
  latestPendingTweak?: { date: string; note: string };
  label: string;
  shortLabel: string;
  badgeClass: string;
}

export interface SolutionPeriodSummary {
  workedCount: number;
  quietCount: number;
  failedCount: number;
  tweaks: Array<{ date: string; note: string; applied: boolean }>;
  totalCheckIns: number;
}

export const getSolutionTestingSummary = (
  problem: ProblemEntry,
  defaultVerifyTarget = 5
): SolutionTestingSummary => {
  const targetCount = Math.max(1, problem.verifyTarget || defaultVerifyTarget || 5);
  const version = 1 + (problem.fixAttempts?.length || 0);
  const hasSolution =
    hasActiveReminder(problem) || hasActiveAction(problem) || problem.status === 'testing';
  if (problem.status === 'solved' || !hasSolution) {
    return {
      hasSolution: false,
      state: 'none',
      version,
      targetCount,
      effectiveCount: 0,
      pendingTweakCount: 0,
      notTriggeredCount: 0,
      failedCount: 0,
      pct: 0,
      readyToResolve: false,
      label: '',
      shortLabel: '',
      badgeClass: ''
    };
  }

  const sinceDate = (problem.fixStartedAt || problem.createdAt || '').slice(0, 10);
  const byDate = new Map<string, ProblemCheckInOutcome>();

  (problem.heldDates || []).forEach(d => {
    const clean = (d || '').slice(0, 10);
    if (clean && (!sinceDate || clean >= sinceDate)) {
      byDate.set(clean, 'effective');
    }
  });

  let pendingTweakCount = 0;
  let latestPendingTweak: { date: string; note: string } | undefined;
  (problem.checkIns || []).forEach(c => {
    const clean = (c.date || '').slice(0, 10);
    if (clean && (!sinceDate || clean >= sinceDate)) {
      byDate.set(clean, c.outcome);
      const tNote = (c.tweakNote || (c.outcome === 'tweaked' ? c.note : '') || '').trim();
      if (!c.tweakApplied && (Boolean(tNote) || c.outcome === 'tweaked')) {
        pendingTweakCount += 1;
        if (tNote && (!latestPendingTweak || clean >= latestPendingTweak.date)) {
          latestPendingTweak = { date: clean, note: tNote };
        }
      }
    }
  });

  let effectiveCount = 0;
  let notTriggeredCount = 0;
  let failedCount = 0;
  byDate.forEach(outcome => {
    if (outcome === 'effective') effectiveCount += 1;
    else if (outcome === 'not_triggered') notTriggeredCount += 1;
    else if (outcome === 'failed') failedCount += 1;
  });

  const pct = Math.min(100, Math.round((effectiveCount / targetCount) * 100));
  const isFailed = Boolean(problem.lastFixFailedAt && problem.status === 'open');
  const readyToResolve = !isFailed && effectiveCount >= targetCount && pendingTweakCount === 0;

  if (isFailed) {
    return {
      hasSolution: true,
      state: 'failed',
      version,
      targetCount,
      effectiveCount,
      pendingTweakCount,
      notTriggeredCount,
      failedCount,
      pct,
      readyToResolve: false,
      ...(latestPendingTweak ? { latestPendingTweak } : {}),
      label: `v${version} · Failed (${problem.lastFixFailedAt!.slice(5)}) — Needs rethink`,
      shortLabel: 'Failed · Rethink',
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/35'
    };
  }

  if (effectiveCount === 0 && pendingTweakCount === 0) {
    return {
      hasSolution: true,
      state: 'untested',
      version,
      targetCount,
      effectiveCount,
      pendingTweakCount,
      notTriggeredCount,
      failedCount,
      pct: 0,
      readyToResolve: false,
      label:
        notTriggeredCount > 0
          ? `Not tested yet · ${notTriggeredCount}d quiet`
          : 'Testing · Not enough data yet',
      shortLabel: 'Not tested yet',
      badgeClass: 'bg-slate-800/90 text-slate-300 border-slate-700'
    };
  }

  if (pendingTweakCount > 0) {
    const ideaWord = pendingTweakCount === 1 ? 'tweak idea' : 'tweak ideas';
    return {
      hasSolution: true,
      state: 'tweaked',
      version,
      targetCount,
      effectiveCount,
      pendingTweakCount,
      notTriggeredCount,
      failedCount,
      pct,
      readyToResolve: false,
      ...(latestPendingTweak ? { latestPendingTweak } : {}),
      label:
        effectiveCount > 0
          ? `Worked ${effectiveCount}/${targetCount}× · ${pendingTweakCount} ${ideaWord}`
          : `${pendingTweakCount} ${ideaWord} to apply`,
      shortLabel: effectiveCount > 0 ? `${effectiveCount}/${targetCount}× · Tweak` : 'Tweak idea',
      badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/35'
    };
  }

  if (readyToResolve) {
    return {
      hasSolution: true,
      state: 'ready',
      version,
      targetCount,
      effectiveCount,
      pendingTweakCount: 0,
      notTriggeredCount,
      failedCount,
      pct: 100,
      readyToResolve: true,
      label: `✓ Proven (${effectiveCount}/${targetCount}× worked) — Ready to resolve`,
      shortLabel: `✓ Proven ${effectiveCount}/${targetCount}×`,
      badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50'
    };
  }

  return {
    hasSolution: true,
    state: 'holding',
    version,
    targetCount,
    effectiveCount,
    pendingTweakCount: 0,
    notTriggeredCount,
    failedCount,
    pct,
    readyToResolve: false,
    label: `Testing · Worked ${effectiveCount}/${targetCount}×${notTriggeredCount > 0 ? ` (${notTriggeredCount} quiet)` : ''}`,
    shortLabel: `Worked ${effectiveCount}/${targetCount}×`,
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
  };
};

export const getSolutionPeriodSummary = (
  problem: ProblemEntry,
  startDate: string,
  endDate: string
): SolutionPeriodSummary => {
  const byDate = new Map<string, ProblemCheckInOutcome>();
  const tweaks: Array<{ date: string; note: string; applied: boolean }> = [];

  (problem.heldDates || []).forEach(d => {
    const clean = (d || '').slice(0, 10);
    if (clean && clean >= startDate && clean <= endDate) {
      byDate.set(clean, 'effective');
    }
  });

  (problem.checkIns || []).forEach(c => {
    const clean = (c.date || '').slice(0, 10);
    if (clean && clean >= startDate && clean <= endDate) {
      byDate.set(clean, c.outcome);
      const tNote = (c.tweakNote || (c.outcome === 'tweaked' ? c.note : '') || '').trim();
      if (tNote) {
        tweaks.push({ date: clean, note: tNote, applied: Boolean(c.tweakApplied) });
      }
    }
  });

  let workedCount = 0;
  let quietCount = 0;
  let failedCount = 0;
  byDate.forEach(outcome => {
    if (outcome === 'effective') workedCount += 1;
    else if (outcome === 'not_triggered') quietCount += 1;
    else if (outcome === 'failed') failedCount += 1;
  });

  return {
    workedCount,
    quietCount,
    failedCount,
    tweaks: tweaks.sort((a, b) => b.date.localeCompare(a.date)),
    totalCheckIns: workedCount + quietCount + failedCount
  };
};

const shiftIsoDate = (dateStr: string, deltaDays: number): string => {
  const d = new Date(`${dateStr.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr.slice(0, 10);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getProblemPulse = (
  allProblems: ProblemEntry[],
  problem: ProblemEntry,
  todayDate: string
): ProblemPulseSummary => {
  const hitDateCounts = new Map<string, number>();
  const recordDate = (d: string) => {
    const clean = (d || '').slice(0, 10);
    if (!clean) return;
    hitDateCounts.set(clean, (hitDateCounts.get(clean) || 0) + 1);
  };
  (problem.occurrences || []).forEach(o => recordDate(o.date));
  getDescendantProblems(allProblems, problem.id).forEach(desc => {
    (desc.occurrences || []).forEach(o => recordDate(o.date));
  });

  const effectiveDates = new Set<string>(problem.heldDates || []);
  const tweakedDates = new Set<string>();
  const notTriggeredDates = new Set<string>();
  const failedCheckInDates = new Set<string>();
  (problem.checkIns || []).forEach(c => {
    if (c.outcome === 'effective') effectiveDates.add(c.date);
    else if (c.outcome === 'tweaked') tweakedDates.add(c.date);
    else if (c.outcome === 'not_triggered') notTriggeredDates.add(c.date);
    else if (c.outcome === 'failed') failedCheckInDates.add(c.date);
  });

  const days: ProblemPulseDay[] = [];
  let hits7d = 0;
  let hits14d = 0;
  let effective14d = 0;

  for (let offset = -13; offset <= 0; offset++) {
    const dStr = shiftIsoDate(todayDate, offset);
    const count = hitDateCounts.get(dStr) || 0;
    const isHit = count > 0 || failedCheckInDates.has(dStr);
    const isEffective = !isHit && effectiveDates.has(dStr);
    const isTweaked = !isHit && !isEffective && tweakedDates.has(dStr);
    const isNotTriggered = !isHit && !isEffective && !isTweaked && notTriggeredDates.has(dStr);

    if (isHit) {
      const addCount = Math.max(1, count);
      hits14d += addCount;
      if (offset >= -6) hits7d += addCount;
    } else if (isEffective) {
      effective14d += 1;
    }

    days.push({
      date: dStr,
      state: isHit
        ? 'hit'
        : isEffective
        ? 'effective'
        : isTweaked
        ? 'tweaked'
        : isNotTriggered
        ? 'not_triggered'
        : 'quiet'
    });
  }

  const lastHit = getLastOccurrenceDate(problem);
  const daysSinceLastHit = daysBetweenDates(lastHit, todayDate);

  let trend: ProblemPulseSummary['trend'] = 'quiet';
  let trendLabel = `Quiet ${daysSinceLastHit}d`;
  if (hits7d >= 2) {
    trend = 'hot';
    trendLabel = `Hot (${hits7d}× in 7d)`;
  } else if (hits7d === 1) {
    trend = 'active';
    trendLabel = 'Hit this week';
  } else if (daysSinceLastHit >= 14) {
    trend = 'quiet';
    trendLabel = `Quiet ${daysSinceLastHit}d`;
  } else if (hits14d > 0) {
    trend = 'cooling';
    trendLabel = 'Cooling (0× in 7d)';
  }

  return {
    days,
    hits7d,
    hits14d,
    effective14d,
    daysSinceLastHit,
    trend,
    trendLabel
  };
};

export interface LinkedProblemAction {
  kind: 'weekly' | 'oneoff' | 'daily_habit' | 'weekly_habit' | 'reps';
  id: string;
  label: string;
  detail: string;
  completed?: boolean;
  consistencyPct?: number;
  doneCount?: number;
  windowSize?: number;
  reps?: number;
}

export const resolveProblemLinkedActions = (
  problemId: string,
  weeklyPlans: Record<string, WeeklyPlan>,
  checklistItems: ChecklistItem[],
  todayDate: string,
  selectedWeekId: string
): LinkedProblemAction[] => {
  const results: LinkedProblemAction[] = [];

  const sortedWeeks = Object.values(weeklyPlans).sort((a, b) => b.weekNumber - a.weekNumber);
  sortedWeeks.forEach(wp => {
    (wp.tasks || []).forEach(task => {
      if (task.problemId === problemId) {
        results.push({
          kind: 'weekly',
          id: task.id,
          label: task.text,
          detail: `W${wp.weekNumber} · ${task.completed ? 'Done ✓' : 'Open'}`,
          completed: task.completed
        });
      }
      (task.subTasks || []).forEach(sub => {
        if (sub.problemId === problemId) {
          results.push({
            kind: 'weekly',
            id: sub.id,
            label: sub.text,
            detail: `W${wp.weekNumber} · ${sub.completed ? 'Done ✓' : 'Open'}`,
            completed: sub.completed
          });
        }
      });
    });
  });

  const curWeekNum = parseInt(selectedWeekId.replace('week_', ''), 10) || 1;

  checklistItems.forEach(item => {
    if (item.problemId !== problemId) return;
    if (item.recurrence === 'none') {
      results.push({
        kind: 'oneoff',
        id: item.id,
        label: item.text,
        detail: item.completed ? 'One-Off · Done ✓' : 'One-Off · Open',
        completed: item.completed
      });
    } else if (item.recurrence === 'daily') {
      const created = (item.createdAt || todayDate).slice(0, 10);
      const sinceCreated = Math.max(1, daysBetweenDates(created, todayDate) + 1);
      const windowSize = Math.min(14, sinceCreated);
      const periodSet = new Set(item.completedPeriods || []);
      let doneCount = 0;
      for (let i = 0; i < windowSize; i++) {
        if (periodSet.has(shiftIsoDate(todayDate, -i))) doneCount++;
      }
      const consistencyPct = Math.round((doneCount / windowSize) * 100);
      results.push({
        kind: 'daily_habit',
        id: item.id,
        label: item.text,
        detail: `Daily Habit · ${consistencyPct}% (${doneCount}/${windowSize}d)`,
        consistencyPct,
        doneCount,
        windowSize
      });
    } else if (item.recurrence === 'weekly') {
      const windowSize = Math.min(6, Math.max(1, curWeekNum));
      const periodSet = new Set(item.completedPeriods || []);
      let doneCount = 0;
      for (let i = 0; i < windowSize; i++) {
        const wk = curWeekNum - i;
        if (wk >= 1 && periodSet.has(`week_${wk}`)) doneCount++;
      }
      const consistencyPct = Math.round((doneCount / windowSize) * 100);
      results.push({
        kind: 'weekly_habit',
        id: item.id,
        label: item.text,
        detail: `Weekly Habit · ${consistencyPct}% (${doneCount}/${windowSize}w)`,
        consistencyPct,
        doneCount,
        windowSize
      });
    } else if (item.recurrence === 'tally') {
      const reps =
        typeof item.totalCount === 'number'
          ? Math.max(0, Math.floor(item.totalCount))
          : (item.completedPeriods || []).length;
      results.push({
        kind: 'reps',
        id: item.id,
        label: item.text,
        detail: `${reps} ${reps === 1 ? 'rep' : 'reps'}`,
        reps
      });
    }
  });

  return results;
};

// Explicit 4-stage classification helper (backward-compatible with legacy records)
export const isProblemClassified = (allProblems: ProblemEntry[], problem: ProblemEntry): boolean => {
  if (hasExistingParent(allProblems, problem)) return true;
  if (problem.status === 'solved' || problem.status === 'testing') return true;
  if (problem.isTopConstraint) return true;
  if (getDirectChildren(allProblems, problem.id).length > 0) return true;
  if (hasActiveReminder(problem) || hasActiveAction(problem)) return true;
  if (problem.rootCause?.trim() || problem.trigger?.trim()) return true;
  if (typeof problem.classified === 'boolean') return problem.classified;
  // Legacy items without explicit `classified` flag fall back to root-problem rules
  if (getProblemScale(problem) !== 'friction') return true;
  if (problem.severity !== undefined && problem.severity >= 4) return true;
  return false;
};

export type ProblemStage = 'unclassified' | 'observing' | 'active' | 'resolved';

export const getProblemStage = (allProblems: ProblemEntry[], problem: ProblemEntry): ProblemStage => {
  if (problem.status === 'solved') return 'resolved';
  if (!isProblemClassified(allProblems, problem)) return 'unclassified';
  if (hasActiveReminder(problem) || hasActiveAction(problem) || problem.status === 'testing') {
    return 'active';
  }
  return 'observing';
};

// Visual severity presentation so you immediately FEEL how serious a problem is at a glance
export const SEVERITY_VISUAL: Record<
  ProblemSeverity,
  {
    leftBarClass: string;
    cardTintClass: string;
    pillClass: string;
    word: string;
    tier: 'urgent' | 'moderate' | 'minor';
  }
> = {
  5: {
    leftBarClass: 'border-l-4 border-l-rose-500',
    cardTintClass: 'bg-rose-950/15 border-rose-500/35',
    pillClass: 'bg-rose-500/20 text-rose-200 border-rose-500/45',
    word: 'Critical',
    tier: 'urgent'
  },
  4: {
    leftBarClass: 'border-l-4 border-l-orange-500',
    cardTintClass: 'bg-orange-950/10 border-orange-500/30',
    pillClass: 'bg-orange-500/20 text-orange-200 border-orange-500/40',
    word: 'Severe',
    tier: 'urgent'
  },
  3: {
    leftBarClass: 'border-l-4 border-l-amber-400',
    cardTintClass: 'bg-slate-950/90 border-slate-800',
    pillClass: 'bg-amber-500/15 text-amber-200 border-amber-500/35',
    word: 'Moderate',
    tier: 'moderate'
  },
  2: {
    leftBarClass: 'border-l-4 border-l-sky-400/70',
    cardTintClass: 'bg-slate-950/80 border-slate-800/90',
    pillClass: 'bg-sky-500/15 text-sky-200 border-sky-500/30',
    word: 'Low',
    tier: 'minor'
  },
  1: {
    leftBarClass: 'border-l-4 border-l-slate-600',
    cardTintClass: 'bg-slate-950/70 border-slate-800/80',
    pillClass: 'bg-slate-800 text-slate-300 border-slate-700',
    word: 'Minor',
    tier: 'minor'
  }
};

export interface ClusterTimelineItem {
  date: string;
  sourceType: ProblemSourceType;
  sourceRef?: string;
  note?: string;
  fromSlipTitle?: string;
}

export const getClusterOccurrenceTimeline = (
  allProblems: ProblemEntry[],
  problem: ProblemEntry
): ClusterTimelineItem[] => {
  const items: ClusterTimelineItem[] = (problem.occurrences || []).map(o => ({
    date: o.date,
    sourceType: o.sourceType,
    sourceRef: o.sourceRef,
    note: o.note
  }));
  const descendants = getDescendantProblems(allProblems, problem.id);
  descendants.forEach(d => {
    (d.occurrences || []).forEach(o => {
      items.push({
        date: o.date,
        sourceType: o.sourceType,
        sourceRef: o.sourceRef,
        note: o.note,
        fromSlipTitle: d.title
      });
    });
  });
  return items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
};

export const countClusterNotes = (
  allProblems: ProblemEntry[],
  problem: ProblemEntry
): number =>
  getClusterOccurrenceTimeline(allProblems, problem).filter(i => Boolean(i.note?.trim())).length;

// A Root Problem (Constraint) vs an unprocessed Slip sitting in Inbox
export const isRootProblem = (allProblems: ProblemEntry[], problem: ProblemEntry): boolean =>
  isProblemClassified(allProblems, problem) && !hasExistingParent(allProblems, problem);

export const getEligibleRootTargets = (
  allProblems: ProblemEntry[],
  excludeId?: string
): ProblemEntry[] => {
  const descendants = excludeId
    ? new Set(getDescendantProblems(allProblems, excludeId).map(d => d.id))
    : new Set<string>();
  return allProblems
    .filter(p => {
      if (excludeId && (p.id === excludeId || descendants.has(p.id))) return false;
      if (p.status === 'solved') return false;
      return isRootProblem(allProblems, p);
    })
    .sort((a, b) => {
      if (Boolean(b.isTopConstraint) !== Boolean(a.isTopConstraint)) {
        return b.isTopConstraint ? 1 : -1;
      }
      const sevDiff = getProblemSeverity(b) - getProblemSeverity(a);
      if (sevDiff !== 0) return sevDiff;
      return getClusterTotalHits(allProblems, b) - getClusterTotalHits(allProblems, a);
    });
};

// Returns ALL other active top-level problems split into Root Constraints & Other Frictions/Slips
// so users can cluster ANY friction under ANY other problem/friction directly from a dropdown
export const getEligibleClusterTargets = (
  allProblems: ProblemEntry[],
  excludeId?: string
): { roots: ProblemEntry[]; frictions: ProblemEntry[] } => {
  const descendants = excludeId
    ? new Set(getDescendantProblems(allProblems, excludeId).map(d => d.id))
    : new Set<string>();

  const candidates = allProblems.filter(p => {
    if (excludeId && (p.id === excludeId || descendants.has(p.id))) return false;
    if (p.status === 'solved') return false;
    if (hasExistingParent(allProblems, p)) return false;
    return true;
  });

  const sorter = (a: ProblemEntry, b: ProblemEntry) => {
    if (Boolean(b.isTopConstraint) !== Boolean(a.isTopConstraint)) {
      return b.isTopConstraint ? 1 : -1;
    }
    const sevDiff = getProblemSeverity(b) - getProblemSeverity(a);
    if (sevDiff !== 0) return sevDiff;
    return getClusterTotalHits(allProblems, b) - getClusterTotalHits(allProblems, a);
  };

  const roots = candidates.filter(p => isRootProblem(allProblems, p)).sort(sorter);
  const frictions = candidates.filter(p => !isRootProblem(allProblems, p)).sort(sorter);
  return { roots, frictions };
};

// Returns ALL other active top-level problems/frictions that can be absorbed under `hostId`
export const getAbsorbableProblems = (
  allProblems: ProblemEntry[],
  hostId: string
): { frictions: ProblemEntry[]; others: ProblemEntry[] } => {
  // Exclude host itself, its existing children, and its ancestor chain to prevent cycles
  const blocked = new Set<string>([hostId]);
  let cursor = allProblems.find(p => p.id === hostId);
  let guard = 0;
  while (cursor?.parentProblemId && guard < 20) {
    blocked.add(cursor.parentProblemId);
    cursor = allProblems.find(p => p.id === cursor!.parentProblemId);
    guard += 1;
  }

  const candidates = allProblems.filter(p => {
    if (blocked.has(p.id)) return false;
    if (p.status === 'solved') return false;
    if (hasExistingParent(allProblems, p)) return false;
    return true;
  });

  const sorter = (a: ProblemEntry, b: ProblemEntry) => {
    const sevDiff = getProblemSeverity(b) - getProblemSeverity(a);
    if (sevDiff !== 0) return sevDiff;
    return getClusterTotalHits(allProblems, b) - getClusterTotalHits(allProblems, a);
  };

  const frictions = candidates.filter(p => !isRootProblem(allProblems, p)).sort(sorter);
  const others = candidates.filter(p => isRootProblem(allProblems, p)).sort(sorter);
  return { frictions, others };
};

export const daysBetweenDates = (startDate: string, endDate: string): number => {
  const s = Date.parse(`${startDate.slice(0, 10)}T12:00:00Z`);
  const e = Date.parse(`${endDate.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.max(0, Math.floor((e - s) / 86400000));
};

export interface FixVerificationProgress {
  isTesting: boolean;
  fixStartedAt?: string;
  targetDays: number;
  daysClean: number;
  pct: number;
  readyToVerify: boolean;
}

export const getFixVerificationProgress = (
  problem: ProblemEntry,
  todayDate: string,
  defaultVerifyDays = 14
): FixVerificationProgress => {
  const targetDays = Math.max(1, problem.verifyDays || defaultVerifyDays || 14);
  if (problem.status !== 'testing') {
    return {
      isTesting: false,
      targetDays,
      daysClean: 0,
      pct: 0,
      readyToVerify: false
    };
  }
  const started = (problem.fixStartedAt || problem.updatedAt || problem.createdAt || todayDate).slice(0, 10);
  const daysClean = daysBetweenDates(started, todayDate);
  const pct = Math.min(100, Math.round((daysClean / targetDays) * 100));
  return {
    isTesting: true,
    fixStartedAt: started,
    targetDays,
    daysClean,
    pct,
    readyToVerify: daysClean >= targetDays
  };
};

export const computeProblemPriorityScore = (
  allProblems: ProblemEntry[],
  problem: ProblemEntry
): number => {
  const severityWeight = getProblemSeverity(problem) * 100;
  const topBonus = problem.isTopConstraint ? 1000 : 0;
  const failedBonus = problem.lastFixFailedAt && problem.status === 'open' ? 60 : 0;
  const hits = Math.min(40, getClusterTotalHits(allProblems, problem));
  return topBonus + severityWeight + failedBonus + hits;
};
