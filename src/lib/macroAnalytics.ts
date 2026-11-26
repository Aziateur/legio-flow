import {
  ChecklistItem,
  DailyEntry,
  GWSSession,
  LifePillar,
  ProblemEntry,
  StrategyPlan,
  WeeklyPlan
} from '../types/schema';
import { hasExistingParent, normalizeTag, problemMatchesRoadmap, problemOccurredInRange } from './problems';
import { resolveSessionRoadmapPlanId } from './planHierarchy';

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

const normalizeDatePrefix = (raw?: string): string | undefined => {
  if (!raw || typeof raw !== 'string') return undefined;
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : undefined;
};

export const computeHabitDurabilityInRange = (
  checklistItems: ChecklistItem[],
  weeklyPlans: Record<string, WeeklyPlan>,
  startDate: string,
  endDate: string,
  todayDate: string,
  dailyEntries?: Record<string, DailyEntry>
): HabitDurabilityRow[] => {
  const effectiveEnd = endDate > todayDate ? todayDate : endDate;
  if (effectiveEnd < startDate) return [];

  // Determine the true earliest date the user actually tracked habits (never count pre-app or old seed-entry days!)
  const checklistCandidates: string[] = [];
  checklistItems.forEach(item => {
    const c = normalizeDatePrefix(item.createdAt);
    if (c && c <= effectiveEnd) checklistCandidates.push(c);
    (item.completedPeriods || []).forEach(p => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(p) && p <= effectiveEnd) {
        checklistCandidates.push(p);
      }
    });
  });
  const dailyCandidates: string[] = [];
  if (checklistCandidates.length === 0 && dailyEntries) {
    Object.values(dailyEntries).forEach(entry => {
      if (!entry || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || entry.date > effectiveEnd) return;
      const hasActivity = Boolean(
        entry.executionScore > 0 ||
          entry.automaticTasksCompleted ||
          entry.mainTasksCompleted > 0 ||
          entry.planNotes?.trim() ||
          entry.reviewNotes?.trim()
      );
      if (hasActivity) dailyCandidates.push(entry.date);
    });
  }
  const trackingStartFloor =
    checklistCandidates.length > 0
      ? checklistCandidates.sort()[0]
      : dailyCandidates.length > 0
      ? dailyCandidates.sort()[0]
      : effectiveEnd;

  const allWeeks = Object.values(weeklyPlans).filter(
    w => w.startDate <= effectiveEnd && w.endDate >= startDate
  );
  const allMonths = listMonthsInRange(startDate.slice(0, 7), effectiveEnd.slice(0, 7));

  const rows: HabitDurabilityRow[] = [];

  checklistItems.forEach(item => {
    if (item.recurrence !== 'daily' && item.recurrence !== 'weekly' && item.recurrence !== 'monthly') {
      return;
    }
    const created = normalizeDatePrefix(item.createdAt);
    const periods = item.completedPeriods || [];

    if (item.recurrence === 'daily') {
      const itemDates: string[] = [];
      if (created) itemDates.push(created);
      periods.forEach(p => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(p)) itemDates.push(p);
      });
      // For items with no createdAt, anchor to earliest completion or workspace tracking start — NEVER before the app existed!
      const itemStart = itemDates.length > 0 ? itemDates.sort()[0] : trackingStartFloor;
      const effStart = itemStart > startDate ? itemStart : startDate;
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
      const periodSet = new Set(periods);
      const completedWeekStarts = allWeeks
        .filter(w => periodSet.has(w.id))
        .map(w => w.startDate);
      const itemStartCandidates = [
        ...(created ? [created] : []),
        ...completedWeekStarts
      ];
      const itemFloor =
        itemStartCandidates.length > 0 ? itemStartCandidates.sort()[0] : trackingStartFloor;
      const eligibleWeeks = allWeeks.filter(w => w.endDate >= itemFloor);
      const expected = eligibleWeeks.length;
      if (expected <= 0) return;
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
      const periodSet = new Set(periods);
      const completedMonths = periods.filter(p => /^\d{4}-\d{2}$/.test(p));
      const itemMonthCandidates = [
        ...(created ? [created.slice(0, 7)] : []),
        ...completedMonths
      ];
      const floorMonth =
        itemMonthCandidates.length > 0
          ? itemMonthCandidates.sort()[0]
          : trackingStartFloor.slice(0, 7);
      const eligibleMonths = allMonths.filter(m => m >= floorMonth);
      const expected = eligibleMonths.length;
      if (expected <= 0) return;
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
  endDate: string,
  planId?: string
): ProblemEntry[] => {
  const normPlan = normalizeTag(planTitle);
  if (!normPlan && !planId) return [];
  return problems.filter(p => {
    if (!problemOccurredInRange(p, startDate, endDate)) return false;
    if (planId && problemMatchesRoadmap(p, planId, planTitle)) return true;
    if (!normPlan) return false;
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

export interface GwsAllocationBucket {
  key: string;
  label: string;
  kind: 'focus' | 'roadmap' | 'pillar' | 'untagged';
  minutes: number;
  hours: string;
  pct: number;
  sessions: number;
  avgScore: string;
}

export interface GwsAllocationSummary {
  totalMinutes: number;
  totalHours: string;
  totalSessions: number;
  taggedPct: number;
  buckets: GwsAllocationBucket[];
  neglectedFocuses: string[];
}

export const computeGwsAllocationInRange = (
  gwsSessions: GWSSession[],
  strategyPlans: StrategyPlan[],
  lifePillars: LifePillar[],
  startDate: string,
  endDate: string,
  activeTopFocuses?: string[],
  weeklyPlans?: Record<string, WeeklyPlan>,
  dailyEntries?: Record<string, DailyEntry>
): GwsAllocationSummary => {
  const inRange = gwsSessions.filter(s => s.date >= startDate && s.date <= endDate);
  const planMap = new Map(strategyPlans.map(sp => [sp.id, sp.title]));
  const pillarMap = new Map(lifePillars.map(lp => [lp.id, lp.name]));

  const bucketMap = new Map<
    string,
    { label: string; kind: GwsAllocationBucket['kind']; minutes: number; sessions: number; scoreSum: number }
  >();

  let totalMinutes = 0;
  let taggedMinutes = 0;

  inRange.forEach(s => {
    const mins = Math.max(0, s.actualMinutes || s.plannedMinutes || 0);
    totalMinutes += mins;

    let key = 'untagged';
    let label = 'Untagged / Ad-hoc';
    let kind: GwsAllocationBucket['kind'] = 'untagged';

    const effectiveRoadmapId =
      s.roadmapPlanId ||
      (weeklyPlans ? resolveSessionRoadmapPlanId(s, weeklyPlans, dailyEntries) : undefined);

    if (s.focusTag?.trim()) {
      const clean = s.focusTag.trim();
      key = `focus:${clean.toLowerCase()}`;
      label = clean;
      kind = 'focus';
      taggedMinutes += mins;
    } else if (effectiveRoadmapId && planMap.has(effectiveRoadmapId)) {
      key = `roadmap:${effectiveRoadmapId}`;
      label = planMap.get(effectiveRoadmapId)!;
      kind = 'roadmap';
      taggedMinutes += mins;
    } else if (s.pillarId && pillarMap.has(s.pillarId)) {
      key = `pillar:${s.pillarId}`;
      label = pillarMap.get(s.pillarId)!;
      kind = 'pillar';
      taggedMinutes += mins;
    }

    const cur = bucketMap.get(key) || { label, kind, minutes: 0, sessions: 0, scoreSum: 0 };
    cur.minutes += mins;
    cur.sessions += 1;
    cur.scoreSum += s.ratings?.total || 0;
    bucketMap.set(key, cur);
  });

  const buckets: GwsAllocationBucket[] = Array.from(bucketMap.entries())
    .map(([key, v]) => ({
      key,
      label: v.label,
      kind: v.kind,
      minutes: v.minutes,
      hours: (v.minutes / 60).toFixed(1),
      pct: totalMinutes > 0 ? Math.round((v.minutes / totalMinutes) * 100) : 0,
      sessions: v.sessions,
      avgScore: v.sessions > 0 ? (v.scoreSum / v.sessions).toFixed(1) : '0.0'
    }))
    .sort((a, b) => {
      if (a.kind === 'untagged' && b.kind !== 'untagged') return 1;
      if (b.kind === 'untagged' && a.kind !== 'untagged') return -1;
      return b.minutes - a.minutes;
    });

  // Detect any stated Top Focus that received 0 tagged deep work in this period
  const cleanFocuses = (activeTopFocuses || []).map(f => f.trim()).filter(Boolean);
  const neglectedFocuses = cleanFocuses.filter(focus => {
    const normFocus = focus.toLowerCase();
    return !buckets.some(
      b =>
        b.kind !== 'untagged' &&
        (b.label.toLowerCase() === normFocus ||
          b.label.toLowerCase().includes(normFocus) ||
          normFocus.includes(b.label.toLowerCase()))
    );
  });

  return {
    totalMinutes,
    totalHours: (totalMinutes / 60).toFixed(1),
    totalSessions: inRange.length,
    taggedPct: totalMinutes > 0 ? Math.round((taggedMinutes / totalMinutes) * 100) : 0,
    buckets,
    neglectedFocuses
  };
};
