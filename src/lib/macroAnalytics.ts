import { ChecklistItem, ProblemEntry, WeeklyPlan } from '../types/schema';
import { hasExistingParent, normalizeTag, problemOccurredInRange } from './problems';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const getMonthInfo = (monthKey: string) => {
  const [yStr, mStr] = monthKey.split('-');
  const year = parseInt(yStr, 10) || 2026;
  const month = Math.min(12, Math.max(1, parseInt(mStr, 10) || 1));
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${year}-${mm}-01`;
  const endDate = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
  const label = `${MONTH_NAMES[month - 1]} ${year}`;
  const quarterNum = Math.ceil(month / 3);
  return {
    monthKey: `${year}-${mm}`,
    year,
    month,
    startDate,
    endDate,
    label,
    quarterKey: `${year}-Q${quarterNum}`
  };
};

export const shiftMonthKey = (monthKey: string, delta: number): string => {
  const { year, month } = getMonthInfo(monthKey);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const getQuarterKeyForDate = (dateStr: string): string => {
  const monthKey = dateStr.slice(0, 7);
  return getMonthInfo(monthKey).quarterKey;
};

export const getQuarterInfo = (quarterKey: string) => {
  const [yStr, qPart] = quarterKey.split('-Q');
  const year = parseInt(yStr, 10) || 2026;
  const qNum = Math.min(4, Math.max(1, parseInt(qPart, 10) || 4));
  const startMonth = (qNum - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const months = [
    `${year}-${String(startMonth).padStart(2, '0')}`,
    `${year}-${String(startMonth + 1).padStart(2, '0')}`,
    `${year}-${String(endMonth).padStart(2, '0')}`
  ];
  const firstMonthInfo = getMonthInfo(months[0]);
  const lastMonthInfo = getMonthInfo(months[2]);
  const shortMonths = `${MONTH_NAMES[startMonth - 1].slice(0, 3)} – ${MONTH_NAMES[endMonth - 1].slice(0, 3)} ${year}`;
  return {
    quarterKey: `${year}-Q${qNum}`,
    year,
    qNum,
    months,
    startDate: firstMonthInfo.startDate,
    endDate: lastMonthInfo.endDate,
    shortMonths,
    label: `Q${qNum} ${year} (${shortMonths})`
  };
};

export const shiftQuarterKey = (quarterKey: string, delta: number): string => {
  const { year, qNum } = getQuarterInfo(quarterKey);
  const totalQ = year * 4 + (qNum - 1) + delta;
  const nextYear = Math.floor(totalQ / 4);
  const nextQ = ((totalQ % 4) + 4) % 4 + 1;
  return `${nextYear}-Q${nextQ}`;
};

export const getYearInfo = (yearKey: string) => {
  const year = parseInt(yearKey, 10) || 2026;
  const quarters = [1, 2, 3, 4].map(q => `${year}-Q${q}`);
  const months = Array.from({ length: 12 }, (_, idx) => `${year}-${String(idx + 1).padStart(2, '0')}`);
  return {
    yearKey: String(year),
    year,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    quarters,
    months,
    label: String(year)
  };
};

export const shiftYearKey = (yearKey: string, delta: number): string => {
  const year = parseInt(yearKey, 10) || 2026;
  return String(year + delta);
};

export interface HabitDurabilityRow {
  id: string;
  text: string;
  recurrence: 'daily' | 'weekly' | 'monthly';
  done: number;
  expected: number;
  pct: number;
}

const daysBetweenInclusive = (startDate: string, endDate: string): number => {
  const s = Date.parse(`${startDate}T12:00:00Z`);
  const e = Date.parse(`${endDate}T12:00:00Z`);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.floor((e - s) / 86400000) + 1;
};

const listMonthsInRange = (startMonth: string, endMonth: string): string[] => {
  if (endMonth < startMonth) return [];
  const res: string[] = [];
  let cur = startMonth;
  let guard = 0;
  while (cur <= endMonth && guard < 36) {
    res.push(cur);
    cur = shiftMonthKey(cur, 1);
    guard++;
  }
  return res;
};

export const computeHabitDurabilityInRange = (
  checklistItems: ChecklistItem[],
  weeklyPlans: Record<string, WeeklyPlan>,
  startDate: string,
  endDate: string,
  todayDate: string
): HabitDurabilityRow[] => {
  const effectiveEnd = endDate > todayDate ? todayDate : endDate;
  if (effectiveEnd < startDate) return [];

  const allWeeks = Object.values(weeklyPlans).filter(
    w => w.startDate >= startDate && w.startDate <= effectiveEnd
  );
  const allMonths = listMonthsInRange(startDate.slice(0, 7), effectiveEnd.slice(0, 7));

  const rows: HabitDurabilityRow[] = [];

  checklistItems.forEach(item => {
    if (item.recurrence !== 'daily' && item.recurrence !== 'weekly' && item.recurrence !== 'monthly') {
      return;
    }
    const created = item.createdAt && /^\d{4}-\d{2}-\d{2}$/.test(item.createdAt) ? item.createdAt : undefined;
    const periods = item.completedPeriods || [];

    if (item.recurrence === 'daily') {
      const effStart = created && created > startDate ? created : startDate;
      if (effStart > effectiveEnd) return;
      const expected = daysBetweenInclusive(effStart, effectiveEnd);
      if (expected <= 0) return;
      const uniqueDone = new Set(periods.filter(p => p >= effStart && p <= effectiveEnd)).size;
      rows.push({
        id: item.id,
        text: item.text,
        recurrence: 'daily',
        done: uniqueDone,
        expected,
        pct: Math.min(100, Math.round((uniqueDone / expected) * 100))
      });
    } else if (item.recurrence === 'weekly') {
      const eligibleWeeks = allWeeks.filter(w => !created || w.endDate >= created);
      const expected = eligibleWeeks.length;
      if (expected <= 0) return;
      const periodSet = new Set(periods);
      const done = eligibleWeeks.filter(w => periodSet.has(w.id)).length;
      rows.push({
        id: item.id,
        text: item.text,
        recurrence: 'weekly',
        done,
        expected,
        pct: Math.min(100, Math.round((done / expected) * 100))
      });
    } else if (item.recurrence === 'monthly') {
      const createdMonth = created ? created.slice(0, 7) : undefined;
      const eligibleMonths = allMonths.filter(m => !createdMonth || m >= createdMonth);
      const expected = eligibleMonths.length;
      if (expected <= 0) return;
      const periodSet = new Set(periods);
      const done = eligibleMonths.filter(m => periodSet.has(m)).length;
      rows.push({
        id: item.id,
        text: item.text,
        recurrence: 'monthly',
        done,
        expected,
        pct: Math.min(100, Math.round((done / expected) * 100))
      });
    }
  });

  return rows.sort((a, b) => b.pct - a.pct || b.done - a.done);
};

export interface RepsVolumeRow {
  id: string;
  text: string;
  repsInPeriod: number;
  lifetimeReps: number;
  volumeInPeriod?: number;
  volumeUnit?: string;
}

export const computeRepsVolumeInRange = (
  checklistItems: ChecklistItem[],
  startDate: string,
  endDate: string
): RepsVolumeRow[] => {
  return checklistItems
    .filter(item => item.recurrence === 'tally')
    .map(item => {
      const periods = item.completedPeriods || [];
      const repsInPeriod = periods.filter(d => d >= startDate && d <= endDate).length;
      const lifetimeReps = Math.max(item.totalCount || 0, periods.length);
      const hasVol = typeof item.volumePerRep === 'number' && item.volumePerRep > 0;
      return {
        id: item.id,
        text: item.text,
        repsInPeriod,
        lifetimeReps,
        ...(hasVol
          ? {
              volumeInPeriod: Math.round(repsInPeriod * (item.volumePerRep || 0) * 10) / 10,
              volumeUnit: item.volumeUnit || 'units'
            }
          : {})
      };
    })
    .filter(r => r.repsInPeriod > 0 || r.lifetimeReps > 0)
    .sort((a, b) => b.repsInPeriod - a.repsInPeriod || b.lifetimeReps - a.lifetimeReps);
};

export const getProblemsForRoadmapInRange = (
  problems: ProblemEntry[],
  planTitle: string,
  startDate: string,
  endDate: string
): ProblemEntry[] => {
  const normPlan = normalizeTag(planTitle);
  if (!normPlan) return [];
  return problems.filter(p => {
    if (!problemOccurredInRange(p, startDate, endDate)) return false;
    const tagMatch = (p.tags || []).some(t => {
      const nt = normalizeTag(t);
      return nt === normPlan || nt.includes(normPlan) || normPlan.includes(nt);
    });
    const titleMatch = p.title.toLowerCase().includes(planTitle.trim().toLowerCase());
    return tagMatch || titleMatch;
  });
};

export interface MacroProblemSignal {
  problem: ProblemEntry;
  occurrencesInRange: number;
  distinctQuartersInRange: number;
}

export const getSystemicProblemsInRange = (
  problems: ProblemEntry[],
  startDate: string,
  endDate: string,
  mode: 'quarterly' | 'yearly'
): MacroProblemSignal[] => {
  const results: MacroProblemSignal[] = [];

  problems.forEach(p => {
    if (hasExistingParent(problems, p)) return;
    if (!problemOccurredInRange(p, startDate, endDate)) return;

    const inRangeOccs = (p.occurrences || []).filter(
      o => o.date >= startDate && o.date <= endDate
    );
    const occurrencesInRange = Math.max(1, inRangeOccs.length);
    const distinctQuarters = new Set(inRangeOccs.map(o => getQuarterKeyForDate(o.date))).size;

    const isSystemic =
      mode === 'quarterly'
        ? p.scale === 'blocker' || p.scale === 'bottleneck' || occurrencesInRange >= 2
        : p.scale === 'blocker' || distinctQuarters >= 2 || occurrencesInRange >= 3;

    if (isSystemic) {
      results.push({
        problem: p,
        occurrencesInRange,
        distinctQuartersInRange: distinctQuarters
      });
    }
  });

  const scaleRank = { blocker: 3, bottleneck: 2, friction: 1 };
  return results.sort((a, b) => {
    const aSolved = a.problem.status === 'solved' ? 0 : 1;
    const bSolved = b.problem.status === 'solved' ? 0 : 1;
    if (aSolved !== bSolved) return bSolved - aSolved;
    const rDiff =
      scaleRank[b.problem.scale || 'friction'] - scaleRank[a.problem.scale || 'friction'];
    if (rDiff !== 0) return rDiff;
    return b.occurrencesInRange - a.occurrencesInRange;
  });
};

export const computeTrajectoryTrend = (values: number[]): 'up' | 'down' | 'flat' | 'none' => {
  const nonZero = values.filter(v => v > 0);
  if (nonZero.length < 2) return 'none';
  const first = nonZero[0];
  const last = nonZero[nonZero.length - 1];
  const diff = last - first;
  if (diff >= 0.4) return 'up';
  if (diff <= -0.4) return 'down';
  return 'flat';
};
