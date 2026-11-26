import React from 'react';
import { ProblemEntry } from '../../types/schema';
import { getProblemPulse, getProblemSeverity } from '../../lib/problems';

interface ProblemPulseBarProps {
  problem: ProblemEntry;
  allProblems: ProblemEntry[];
  todayDate: string;
  compact?: boolean;
  showLegend?: boolean;
}

export const ProblemPulseBar: React.FC<ProblemPulseBarProps> = ({
  problem,
  allProblems,
  todayDate,
  compact = false,
  showLegend = false
}) => {
  const pulse = getProblemPulse(allProblems, problem, todayDate);
  const sev = getProblemSeverity(problem);

  const trendChipCls =
    pulse.trend === 'hot'
      ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
      : pulse.trend === 'active'
      ? 'bg-orange-500/15 text-orange-300 border-orange-500/35'
      : pulse.trend === 'cooling'
      ? 'bg-sky-500/15 text-sky-300 border-sky-500/35'
      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {showLegend && (
          <span className="text-[10px] font-mono text-slate-500">14d → today</span>
        )}
        <div
          className="inline-flex items-center gap-[3px]"
          title="Last 14 days (oldest → today): orange = fired, green = effective/held, purple = tweak noted, gray = nothing happened, dark = quiet"
        >
          {pulse.days.map(day => {
            const dotCls =
              day.state === 'hit'
                ? sev >= 4
                  ? 'bg-orange-400 ring-1 ring-rose-500/70'
                  : 'bg-orange-400'
                : day.state === 'tweaked'
                ? 'bg-violet-400'
                : day.state === 'effective'
                ? 'bg-emerald-400'
                : day.state === 'not_triggered'
                ? 'bg-slate-500/80'
                : 'bg-slate-800';
            const stateText =
              day.state === 'hit'
                ? 'Fired'
                : day.state === 'tweaked'
                ? 'Tweak / improvement noted'
                : day.state === 'effective'
                ? 'Fix effective / held'
                : day.state === 'not_triggered'
                ? 'Nothing happened'
                : 'Quiet';
            return (
              <span
                key={day.date}
                title={`${day.date} · ${stateText}`}
                className={`${compact ? 'w-1.5 h-2.5' : 'w-2 h-3'} rounded-sm transition-colors ${dotCls}`}
              />
            );
          })}
        </div>

        <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${trendChipCls}`}>
          {pulse.trendLabel}
        </span>
      </div>

      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-orange-400" />
            <span>Fired</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-emerald-400" />
            <span>Worked</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-violet-400" />
            <span>Tweak</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-slate-500/80" />
            <span>Didn&apos;t come up</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-slate-800 border border-slate-700" />
            <span>Quiet</span>
          </span>
        </div>
      )}
    </div>
  );
};
