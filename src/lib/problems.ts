import {
  ProblemCategory,
  ProblemDispatchTarget,
  ProblemEntry,
  ProblemFixType,
  ProblemStatus
} from '../types/schema';

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

export const formatProblemsForReviewText = (list: ProblemEntry[]): string => {
  if (list.length === 0) return '';
  return list
    .map(p => {
      const cat = CATEGORY_MAP[p.category]?.shortLabel || p.category;
      const count = p.occurrences.length > 1 ? ` (×${p.occurrences.length})` : '';
      const tagStr = p.tags.length > 0 ? ` [${p.tags.map(t => `#${t}`).join(' ')}]` : '';
      const fixStr = p.fixNote?.trim()
        ? ` → ${p.fixType ? `${FIX_TYPE_MAP[p.fixType].shortLabel}: ` : ''}${p.fixNote.trim()}`
        : '';
      const statusStr = p.status === 'solved' ? ' ✓Solved' : p.status === 'testing' ? ' ⟳Testing' : '';
      return `• [${cat}]${statusStr} ${p.title}${count}${tagStr}${fixStr}`;
    })
    .join('\n');
};
