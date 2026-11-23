import {
  CustomProblemCategory,
  ProblemCategory,
  ProblemColorKey,
  ProblemDispatchTarget,
  ProblemEntry,
  ProblemFixType,
  ProblemImpact,
  ProblemScale,
  ProblemSeverity,
  ProblemSourceType,
  ProblemStatus
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
  Boolean(problem.isGuardrail || problem.fixType === 'rule_guardrail');

// A Root Problem (Constraint) vs an unprocessed Slip sitting in Inbox
export const isRootProblem = (allProblems: ProblemEntry[], problem: ProblemEntry): boolean => {
  if (hasExistingParent(allProblems, problem)) return false;
  if (problem.isTopConstraint) return true;
  if (getProblemScale(problem) !== 'friction') return true;
  if (problem.severity !== undefined && problem.severity >= 4) return true;
  if (problem.status === 'testing' || problem.status === 'solved') return true;
  if (problem.fixNote?.trim() || problem.rootCause?.trim() || problem.trigger?.trim()) return true;
  if (isProblemGuardrail(problem)) return true;
  if (getDirectChildren(allProblems, problem.id).length > 0) return true;
  return false;
};

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
