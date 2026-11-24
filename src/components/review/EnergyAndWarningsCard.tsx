import React from 'react';
import { AlignmentVerdict, DailyEnergyCheck, DailyEntry, NervousSystemState } from '../../types/schema';
import {
  ALIGNMENT_VERDICTS,
  LowScoreFlag,
  NERVOUS_SYSTEM_STATES,
  PeriodAlignmentSummary,
  PeriodEnergySummary,
  alignmentVerdictToScore,
  computeDailyEnergyAvg,
  detectDiminishingEnergyTrend
} from '../../lib/energyAnalytics';
import { Activity, AlertTriangle, Battery, Compass, HeartPulse, Moon, Sun, Sunrise } from 'lucide-react';

interface DailyEnergyReportCardProps {
  selectedDate: string;
  entry: DailyEntry;
  dailyEntries: Record<string, DailyEntry>;
  onChangeEnergyCheck: (patch: Partial<DailyEnergyCheck>) => void;
}

export const DailyEnergyReportCard: React.FC<DailyEnergyReportCardProps> = ({
  selectedDate,
  entry,
  dailyEntries,
  onChangeEnergyCheck
}) => {
  const ec = entry.energyCheck || {};
  const dailyEnergyAvg = computeDailyEnergyAvg(entry);
  const nsScore = ec.nervousSystemScore;
  const trendWarning = detectDiminishingEnergyTrend(dailyEntries, selectedDate);

  const slots: Array<{
    key: 'wakeUp' | 'midday' | 'night';
    label: string;
    icon: typeof Sunrise;
    value?: number;
  }> = [
    { key: 'wakeUp', label: 'Wake-Up', icon: Sunrise, value: ec.wakeUp },
    { key: 'midday', label: 'Midday', icon: Sun, value: ec.midday },
    { key: 'night', label: 'Night', icon: Moon, value: ec.night }
  ];

  const scoreTone = (val: number | null | undefined) => {
    if (!val) return 'text-slate-400';
    if (val < 6) return 'text-rose-400';
    if (val < 8) return 'text-amber-300';
    return 'text-emerald-400';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Battery className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400">
            Energy &amp; Nervous System Report
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-bold">
          {dailyEnergyAvg !== null && (
            <span
              className={`px-2.5 py-0.5 rounded-full border ${
                dailyEnergyAvg < 6
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                  : dailyEnergyAvg < 8
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
              }`}
            >
              Energy {dailyEnergyAvg}/10
            </span>
          )}
          {typeof nsScore === 'number' && nsScore > 0 && (
            <span
              className={`px-2.5 py-0.5 rounded-full border ${
                nsScore < 6
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                  : nsScore < 8
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
              }`}
            >
              NS {nsScore}/10
            </span>
          )}
        </div>
      </div>

      {/* Diminishing Trend / Below-6 Warning */}
      {trendWarning && (
        <div
          className={`p-3 rounded-2xl border flex items-start space-x-2.5 text-xs ${
            trendWarning.severity === 'critical'
              ? 'bg-rose-500/10 border-rose-500/35 text-rose-200'
              : 'bg-amber-500/10 border-amber-500/35 text-amber-200'
          }`}
        >
          <AlertTriangle
            className={`w-4 h-4 shrink-0 mt-0.5 ${
              trendWarning.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'
            }`}
          />
          <div className="space-y-0.5">
            <div className="font-extrabold">{trendWarning.headline}</div>
            <p className="text-[11px] opacity-90 leading-snug">{trendWarning.detail}</p>
          </div>
        </div>
      )}

      {/* 3-Point Daily Energy Check (Wake-Up / Midday / Night) */}
      <div className="space-y-2.5">
        {slots.map(slot => {
          const Icon = slot.icon;
          return (
            <div key={slot.key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center space-x-1.5 font-bold text-slate-300">
                  <Icon className="w-3.5 h-3.5 text-amber-400/80" />
                  <span>{slot.label} Energy</span>
                </span>
                <span className={`font-mono font-bold ${scoreTone(slot.value)}`}>
                  {slot.value ? `${slot.value}/10` : '—'}
                </span>
              </div>
              <div className="grid grid-cols-10 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => {
                  const active = slot.value === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() =>
                        onChangeEnergyCheck({ [slot.key]: active ? undefined : num })
                      }
                      className={`py-1 rounded-lg font-mono text-[11px] font-bold transition-all ${
                        active
                          ? num < 6
                            ? 'bg-rose-500 text-slate-950 font-extrabold shadow'
                            : num < 8
                            ? 'bg-amber-500 text-slate-950 font-extrabold shadow'
                            : 'bg-emerald-500 text-slate-950 font-extrabold shadow'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Nervous System Check (Score + How I Feel + Optional Note) */}
      <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center space-x-1.5 font-bold text-slate-200">
            <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
            <span>Nervous System (Regulation &amp; How I Feel)</span>
          </span>
          <span className={`font-mono font-bold ${scoreTone(nsScore)}`}>
            {nsScore ? `${nsScore}/10` : '—'}
          </span>
        </div>

        <div className="grid grid-cols-10 gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => {
            const active = nsScore === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() =>
                  onChangeEnergyCheck({ nervousSystemScore: active ? undefined : num })
                }
                className={`py-1 rounded-lg font-mono text-[11px] font-bold transition-all ${
                  active
                    ? num < 6
                      ? 'bg-rose-500 text-slate-950 font-extrabold shadow'
                      : num < 8
                      ? 'bg-amber-500 text-slate-950 font-extrabold shadow'
                      : 'bg-cyan-500 text-slate-950 font-extrabold shadow'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {NERVOUS_SYSTEM_STATES.map(st => {
            const active = ec.nervousSystemState === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() =>
                  onChangeEnergyCheck({
                    nervousSystemState: active ? undefined : (st.id as NervousSystemState)
                  })
                }
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all ${
                  active
                    ? st.activeCls
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={ec.nervousSystemNote || ''}
          onChange={e => onChangeEnergyCheck({ nervousSystemNote: e.target.value })}
          placeholder="Optional: how did your body/nervous system feel today? (sleep, stress, tension, peace...)"
          className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
        />
      </div>
    </div>
  );
};

interface LowScoreFlagsBannerProps {
  periodLabel: string;
  flags: LowScoreFlag[];
}

export const LowScoreFlagsBanner: React.FC<LowScoreFlagsBannerProps> = ({
  periodLabel,
  flags
}) => {
  if (flags.length === 0) return null;

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-rose-500/10 border border-rose-500/35 shadow-xl space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-rose-300">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Warning · Score Below 6 Flagged ({periodLabel})</span>
        </span>
        <span className="text-[11px] font-mono text-rose-300/80">
          {flags.length} alert{flags.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {flags.map((f, idx) => (
          <div
            key={idx}
            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-2xl bg-slate-950/90 border border-rose-500/35 text-xs"
          >
            <span className="font-bold text-slate-200">{f.label}:</span>
            <span className="font-mono font-extrabold text-rose-400">
              {f.value}/{f.max}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-rose-200/85 leading-relaxed">
        Any metric below <strong>6/10</strong> is an early warning — diagnose recovery debt, nervous system load, or root constraint before pushing harder.
      </p>
    </div>
  );
};

interface PeriodEnergySummaryStripProps {
  summary: PeriodEnergySummary;
  periodLabel: string;
}

export const PeriodEnergySummaryStrip: React.FC<PeriodEnergySummaryStripProps> = ({
  summary,
  periodLabel
}) => {
  if (summary.daysLogged === 0) return null;

  const feelMeta = summary.topFeelState
    ? NERVOUS_SYSTEM_STATES.find(s => s.id === summary.topFeelState)
    : null;

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="flex items-center space-x-2.5">
        <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-400">
            Energy &amp; Nervous System · {periodLabel} ({summary.daysLogged}d logged)
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
            Wake {summary.avgWakeUp ?? '—'} · Midday {summary.avgMidday ?? '—'} · Night {summary.avgNight ?? '—'}
            {(summary.lowEnergyDays > 0 || summary.lowNervousDays > 0) && (
              <span className="text-rose-400 font-bold ml-2">
                • {summary.lowEnergyDays} low-energy d · {summary.lowNervousDays} strained-NS d (&lt;6)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold">
        {summary.avgEnergy !== null && (
          <span
            className={`px-3 py-1 rounded-xl border ${
              summary.avgEnergy < 6
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                : summary.avgEnergy < 8
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
            }`}
          >
            Energy Avg: {summary.avgEnergy}/10
          </span>
        )}
        {summary.avgNervousSystem !== null && (
          <span
            className={`px-3 py-1 rounded-xl border ${
              summary.avgNervousSystem < 6
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                : summary.avgNervousSystem < 8
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35'
            }`}
          >
            NS Avg: {summary.avgNervousSystem}/10
          </span>
        )}
        {feelMeta && (
          <span className={`px-2.5 py-1 rounded-xl border font-sans text-[11px] font-bold ${feelMeta.badgeCls}`}>
            Mostly {feelMeta.shortLabel}
          </span>
        )}
      </div>
    </div>
  );
};

interface AlignmentVerdictSelectorProps {
  title: string;
  subtitle?: string;
  verdict?: AlignmentVerdict;
  note?: string;
  onChangeVerdict: (next?: AlignmentVerdict) => void;
  onChangeNote: (note: string) => void;
  compact?: boolean;
}

export const AlignmentVerdictSelector: React.FC<AlignmentVerdictSelectorProps> = ({
  title,
  subtitle,
  verdict,
  note,
  onChangeVerdict,
  onChangeNote,
  compact = false
}) => {
  const scoreVal = alignmentVerdictToScore(verdict);
  const showNoteInput =
    Boolean(note?.trim()) ||
    verdict === 'better_pivot' ||
    verdict === 'mixed' ||
    verdict === 'unwise_drift';

  return (
    <div
      className={`bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl space-y-3 ${
        compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-100">
              {title}
            </span>
          </div>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        {scoreVal !== null && (
          <span
            className={`px-2.5 py-0.5 rounded-full border font-mono text-xs font-extrabold ${
              scoreVal < 6
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                : verdict === 'better_pivot'
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
            }`}
          >
            {scoreVal}/10 Alignment
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {ALIGNMENT_VERDICTS.map(v => {
          const active = verdict === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onChangeVerdict(active ? undefined : v.id)}
              title={v.hint}
              className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all text-center ${
                active
                  ? `${v.activeCls} shadow-md`
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-slate-100'
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {showNoteInput && (
        <input
          type="text"
          value={note || ''}
          onChange={e => onChangeNote(e.target.value)}
          placeholder={
            verdict === 'better_pivot'
              ? 'What came up & why was it superior to the original plan?'
              : 'What pulled you off-plan? (distraction, avoidance, unrealistic plan...)'
          }
          className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
        />
      )}
    </div>
  );
};

interface PeriodAlignmentSummaryStripProps {
  summary: PeriodAlignmentSummary;
  periodLabel: string;
}

export const PeriodAlignmentSummaryStrip: React.FC<PeriodAlignmentSummaryStripProps> = ({
  summary,
  periodLabel
}) => {
  if (summary.daysLogged === 0) return null;

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-2.5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
              Plan Alignment &amp; Judgment · {periodLabel} ({summary.daysLogged}d checked)
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-emerald-300">{summary.onPlanCount} On Plan</span>
              <span>·</span>
              <span className="text-cyan-300">{summary.betterPivotCount} Better Pivot</span>
              <span>·</span>
              <span className="text-amber-300">{summary.mixedCount} Mixed</span>
              <span>·</span>
              <span className={summary.unwiseDriftCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                {summary.unwiseDriftCount} Drift
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold">
          {summary.avgScore !== null && (
            <span
              className={`px-3 py-1 rounded-xl border ${
                summary.avgScore < 6
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                  : summary.avgScore < 8
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
              }`}
              title="Both On Plan and Better Pivot earn full 10/10 — only Mixed (5) and Unwise Drift (1) lower Alignment"
            >
              Alignment: {summary.avgScore}/10
            </span>
          )}
          {summary.planFitPct !== null && (
            <span
              className="px-2.5 py-1 rounded-xl border bg-slate-950 text-slate-300 border-slate-800"
              title="Neutral diagnostic: how often the original plan survived contact with reality"
            >
              Plan Fit: {summary.planFitPct}%
            </span>
          )}
        </div>
      </div>

      {summary.highPivotSignal && (
        <div className="px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-[11px] text-cyan-200 leading-snug">
          <strong>Planning Calibration Signal:</strong> {summary.betterPivotCount}/{summary.daysLogged} days had a{' '}
          <strong>Better Pivot</strong> — your in-the-moment judgment is beating your plans. Not a discipline issue; try planning lighter or recalibrating daily priorities.
        </div>
      )}
    </div>
  );
};
