import { DailyEntry, NervousSystemState, ParkReasonTag } from '../types/schema';

export const NERVOUS_SYSTEM_STATES: Array<{
  id: NervousSystemState;
  label: string;
  shortLabel: string;
  badgeCls: string;
  activeCls: string;
}> = [
  {
    id: 'calm',
    label: 'Calm & Regulated',
    shortLabel: 'Calm',
    badgeCls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
    activeCls: 'bg-emerald-500 text-slate-950 border-emerald-400'
  },
  {
    id: 'sharp',
    label: 'Sharp & Grounded',
    shortLabel: 'Sharp',
    badgeCls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
    activeCls: 'bg-cyan-500 text-slate-950 border-cyan-400'
  },
  {
    id: 'wired',
    label: 'Wired / Tense',
    shortLabel: 'Wired',
    badgeCls: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    activeCls: 'bg-amber-500 text-slate-950 border-amber-400'
  },
  {
    id: 'foggy',
    label: 'Heavy / Foggy',
    shortLabel: 'Foggy',
    badgeCls: 'bg-orange-500/15 text-orange-300 border-orange-500/35',
    activeCls: 'bg-orange-500 text-slate-950 border-orange-400'
  },
  {
    id: 'drained',
    label: 'Drained / Overwhelmed',
    shortLabel: 'Drained',
    badgeCls: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
    activeCls: 'bg-rose-500 text-slate-950 border-rose-400'
  }
];

export const PARK_REASON_META: Record<
  ParkReasonTag,
  { label: string; shortLabel: string; hint: string; badgeCls: string; activeCls: string }
> = {
  reality_shift: {
    label: 'Reality Shift',
    shortLabel: 'Reality Shift',
    hint: 'Money, schedule, or external constraint changed',
    badgeCls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    activeCls: 'bg-amber-500 text-slate-950 border-amber-400'
  },
  disproved: {
    label: 'Disproved',
    shortLabel: 'Disproved',
    hint: 'Tested it — evidence says wrong path',
    badgeCls: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    activeCls: 'bg-rose-500 text-slate-950 border-rose-400'
  },
  deferred: {
    label: 'Deferred',
    shortLabel: 'Deferred',
    hint: 'Still valid, just wrong season / capacity',
    badgeCls: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    activeCls: 'bg-sky-500 text-slate-950 border-sky-400'
  }
};

export const computeDailyEnergyAvg = (entry?: DailyEntry): number | null => {
  const ec = entry?.energyCheck;
  if (!ec) return null;
  const vals = [ec.wakeUp, ec.midday, ec.night].filter(
    (v): v is number => typeof v === 'number' && v >= 1 && v <= 10
  );
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
};

export const getDailyNervousSystemScore = (entry?: DailyEntry): number | null => {
  const score = entry?.energyCheck?.nervousSystemScore;
  return typeof score === 'number' && score >= 1 && score <= 10 ? score : null;
};

export interface DiminishingTrendWarning {
  severity: 'warn' | 'critical';
  headline: string;
  detail: string;
}

export const detectDiminishingEnergyTrend = (
  dailyEntries: Record<string, DailyEntry>,
  upToDate: string
): DiminishingTrendWarning | null => {
  const recent = Object.values(dailyEntries)
    .filter(e => e.date <= upToDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => ({
      date: e.date,
      energy: computeDailyEnergyAvg(e),
      ns: getDailyNervousSystemScore(e)
    }))
    .filter(r => r.energy !== null || r.ns !== null);

  if (recent.length === 0) return null;

  const energyPoints = recent.filter((r): r is { date: string; energy: number; ns: number | null } => r.energy !== null);
  const nsPoints = recent.filter((r): r is { date: string; energy: number | null; ns: number } => r.ns !== null);

  const lastEnergy = energyPoints[energyPoints.length - 1];
  const lastNs = nsPoints[nsPoints.length - 1];

  // Check 3-day consecutive decline in Energy
  if (energyPoints.length >= 3) {
    const [a, b, c] = energyPoints.slice(-3);
    if (a.energy > b.energy && b.energy > c.energy) {
      return {
        severity: c.energy < 6 ? 'critical' : 'warn',
        headline: `Diminishing Energy Trend (${a.energy} → ${b.energy} → ${c.energy}/10)`,
        detail:
          c.energy < 6
            ? '3 straight declines & now below 6 — early burnout/recovery warning. Protect sleep and cut non-essential load before pushing harder.'
            : '3 consecutive days of dropping energy. Check sleep, nutrition, stress load, or over-commitment before it dips below 6.'
      };
    }
  }

  // Check 3-day consecutive decline in Nervous System
  if (nsPoints.length >= 3) {
    const [a, b, c] = nsPoints.slice(-3);
    if (a.ns > b.ns && b.ns > c.ns) {
      return {
        severity: c.ns < 6 ? 'critical' : 'warn',
        headline: `Diminishing Nervous System Trend (${a.ns} → ${b.ns} → ${c.ns}/10)`,
        detail:
          c.ns < 6
            ? '3 consecutive drops & below 6 — nervous system strain detected. Decompress, downshift to LVL 1 if needed, and resolve the stressor.'
            : 'Nervous system score is sliding across 3 logged days. Watch for accumulating tension or hidden friction.'
      };
    }
  }

  // Check sharp single-step drop (>= 2 pts) or current reading < 6 on selected date
  if (lastEnergy && lastEnergy.date === upToDate && lastEnergy.energy < 6) {
    return {
      severity: 'critical',
      headline: `Low Energy Warning (${lastEnergy.energy}/10)`,
      detail: 'Daily energy dropped below 6. Treat low output today as a fuel/recovery signal — not a willpower failure.'
    };
  }
  if (lastNs && lastNs.date === upToDate && lastNs.ns < 6) {
    return {
      severity: 'critical',
      headline: `Nervous System Warning (${lastNs.ns}/10)`,
      detail: 'Nervous system score is below 6. Prioritize regulation, rest, or clearing the active stressor before adding pressure.'
    };
  }
  if (energyPoints.length >= 2) {
    const [prev, curr] = energyPoints.slice(-2);
    if (curr.date === upToDate && prev.energy - curr.energy >= 2) {
      return {
        severity: 'warn',
        headline: `Sharp Energy Drop (${prev.energy} → ${curr.energy}/10)`,
        detail: `Dropped ${(prev.energy - curr.energy).toFixed(1)} points from ${prev.date}. Notice what drained fuel today.`
      };
    }
  }

  return null;
};

export interface PeriodEnergySummary {
  daysLogged: number;
  avgEnergy: number | null;
  avgWakeUp: number | null;
  avgMidday: number | null;
  avgNight: number | null;
  avgNervousSystem: number | null;
  lowEnergyDays: number;
  lowNervousDays: number;
  topFeelState: NervousSystemState | null;
}

export const computePeriodEnergySummary = (entries: DailyEntry[]): PeriodEnergySummary => {
  const energyAvgs: number[] = [];
  const wakeUps: number[] = [];
  const middays: number[] = [];
  const nights: number[] = [];
  const nsScores: number[] = [];
  const stateCounts: Record<string, number> = {};
  let daysLogged = 0;

  entries.forEach(e => {
    const ec = e.energyCheck;
    if (!ec) return;
    const avg = computeDailyEnergyAvg(e);
    const ns = getDailyNervousSystemScore(e);
    if (avg === null && ns === null && !ec.nervousSystemState) return;
    daysLogged++;
    if (avg !== null) energyAvgs.push(avg);
    if (typeof ec.wakeUp === 'number' && ec.wakeUp >= 1) wakeUps.push(ec.wakeUp);
    if (typeof ec.midday === 'number' && ec.midday >= 1) middays.push(ec.midday);
    if (typeof ec.night === 'number' && ec.night >= 1) nights.push(ec.night);
    if (ns !== null) nsScores.push(ns);
    if (ec.nervousSystemState) {
      stateCounts[ec.nervousSystemState] = (stateCounts[ec.nervousSystemState] || 0) + 1;
    }
  });

  const avgOf = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  let topFeelState: NervousSystemState | null = null;
  let topCount = 0;
  Object.entries(stateCounts).forEach(([k, v]) => {
    if (v > topCount) {
      topCount = v;
      topFeelState = k as NervousSystemState;
    }
  });

  return {
    daysLogged,
    avgEnergy: avgOf(energyAvgs),
    avgWakeUp: avgOf(wakeUps),
    avgMidday: avgOf(middays),
    avgNight: avgOf(nights),
    avgNervousSystem: avgOf(nsScores),
    lowEnergyDays: energyAvgs.filter(v => v < 6).length,
    lowNervousDays: nsScores.filter(v => v < 6).length,
    topFeelState
  };
};

export interface LowScoreFlag {
  label: string;
  value: number;
  max: number;
  hint: string;
}

export const collectLowScoreWarnings = (
  items: Array<{ label: string; value: number | null | undefined; max?: number; hint?: string }>
): LowScoreFlag[] => {
  const flags: LowScoreFlag[] = [];
  items.forEach(item => {
    if (typeof item.value !== 'number' || Number.isNaN(item.value) || item.value <= 0) return;
    if (item.value < 6) {
      flags.push({
        label: item.label,
        value: Math.round(item.value * 10) / 10,
        max: item.max || 10,
        hint: item.hint || 'Below 6/10 threshold — diagnose recovery, load, or constraint before pushing harder.'
      });
    }
  });
  return flags;
};
