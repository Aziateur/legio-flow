import React from 'react';
import { GwsAllocationSummary } from '../../lib/macroAnalytics';
import { AlertTriangle, Crosshair, Compass, Layers, Clock } from 'lucide-react';

interface GwsAllocationCardProps {
  allocation: GwsAllocationSummary;
  title?: string;
  compact?: boolean;
}

export const GwsAllocationCard: React.FC<GwsAllocationCardProps> = ({
  allocation,
  title = 'Deep Work Allocation (Stated Priorities vs. Actual Hours)',
  compact = false
}) => {
  if (allocation.totalSessions === 0 && allocation.neglectedFocuses.length === 0) {
    return null;
  }

  return (
    <div
      className={`${
        compact ? 'p-3.5 rounded-2xl' : 'p-4 sm:p-5 rounded-2xl'
      } bg-slate-950 border border-slate-800 space-y-3`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>{title}</span>
        </span>
        <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
          <span className="font-bold text-slate-100">{allocation.totalHours}h</span>
          <span>· {allocation.totalSessions} sprints</span>
          {allocation.totalSessions > 0 && (
            <span
              className={
                allocation.taggedPct >= 70
                  ? 'text-emerald-400'
                  : allocation.taggedPct >= 30
                  ? 'text-amber-400'
                  : 'text-slate-500'
              }
            >
              · {allocation.taggedPct}% tagged
            </span>
          )}
        </div>
      </div>

      {allocation.buckets.length === 0 ? (
        <p className="text-xs text-slate-500">
          No GWS sprints logged in this period yet. Tag sprints in GWS Studio to track true time allocation.
        </p>
      ) : (
        <div className="space-y-2">
          {allocation.buckets.map(b => {
            const barCls =
              b.kind === 'focus'
                ? 'bg-purple-500'
                : b.kind === 'roadmap'
                ? 'bg-cyan-500'
                : b.kind === 'pillar'
                ? 'bg-emerald-500'
                : 'bg-slate-600';
            const badgeCls =
              b.kind === 'focus'
                ? 'text-purple-300'
                : b.kind === 'roadmap'
                ? 'text-cyan-300'
                : b.kind === 'pillar'
                ? 'text-emerald-300'
                : 'text-slate-400';

            return (
              <div key={b.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    {b.kind === 'focus' && <Crosshair className="w-3 h-3 text-purple-400 shrink-0" />}
                    {b.kind === 'roadmap' && <Compass className="w-3 h-3 text-cyan-400 shrink-0" />}
                    {b.kind === 'pillar' && <Layers className="w-3 h-3 text-emerald-400 shrink-0" />}
                    <span className={`font-semibold truncate ${badgeCls}`}>{b.label}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-300 shrink-0">
                    <strong className="text-slate-100">{b.hours}h</strong> ({b.pct}%) · {b.sessions}× · {b.avgScore}/15
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                  <div className={`h-full rounded-full ${barCls}`} style={{ width: `${Math.max(2, b.pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {allocation.neglectedFocuses.length > 0 && (
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="inline-flex items-center space-x-1 font-extrabold uppercase tracking-wider text-[10px] text-rose-400 mr-1">
            <AlertTriangle className="w-3 h-3" />
            <span>0h Logged Against Top Focus:</span>
          </span>
          {allocation.neglectedFocuses.map((nf, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-200 font-semibold"
            >
              {nf}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
