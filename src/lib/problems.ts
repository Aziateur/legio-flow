import {
  ProblemCategory,
  ProblemDispatchTarget,
  ProblemEntry,
  ProblemFixType,
  ProblemScale,
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
  allProblems?: ProblemEntry[]
): string => {
  if (list.length === 0) return '';
  const sourcePool = allProblems || list;
  // Format top-level items (folding clustered children under their parent if parent is in list)
  const listIds = new Set(list.map(p => p.id));
  const topLevel = list.filter(p => !p.parentProblemId || !listIds.has(p.parentProblemId));

  return topLevel
    .map(p => {
      const cat = CATEGORY_MAP[p.category]?.shortLabel || p.category;
      const scale = SCALE_MAP[getProblemScale(p)]?.shortLabel || 'Friction';
      const children = getDescendantProblems(sourcePool, p.id);
      const hits = getClusterTotalHits(sourcePool, p);
      const count = hits > 1 ? ` (×${hits})` : '';
      const childSummary =
        children.length > 0 ? ` [${children.length} linked]` : '';
      const tagStr = p.tags.length > 0 ? ` [${p.tags.map(t => `#${t}`).join(' ')}]` : '';
      const fixStr = p.fixNote?.trim()
        ? ` → ${p.fixType ? `${FIX_TYPE_MAP[p.fixType].shortLabel}: ` : ''}${p.fixNote.trim()}`
        : '';
      const statusStr = p.status === 'solved' ? ' ✓Solved' : p.status === 'testing' ? ' ⟳Testing' : '';
      return `• [${scale} · ${cat}]${statusStr} ${p.title}${count}${childSummary}${tagStr}${fixStr}`;
    })
    .join('\n');
};
