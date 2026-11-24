import React, { useState } from 'react';
import { ScoreboardMetric } from '../../types/schema';
import { Plus, Trash2, TrendingUp } from 'lucide-react';

interface ScoreboardEditorProps {
  metrics: ScoreboardMetric[];
  onChange: (next: ScoreboardMetric[]) => void;
  showActual?: boolean;
  accent?: 'cyan' | 'rose' | 'amber' | 'purple';
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
}

export const ScoreboardEditor: React.FC<ScoreboardEditorProps> = ({
  metrics,
  onChange,
  showActual = true,
  accent = 'cyan',
  title = 'Real-World Scoreboard (External Reality)',
  subtitle = 'Track actual external results (revenue, trading adherence, body/health, shipped assets) — not just activity points.',
  headerAction
}) => {
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newActual, setNewActual] = useState('');

  const accentText =
    accent === 'rose'
      ? 'text-rose-400'
      : accent === 'amber'
      ? 'text-amber-400'
      : accent === 'purple'
      ? 'text-purple-400'
      : 'text-cyan-400';

  const accentBorderFocus =
    accent === 'rose'
      ? 'focus:border-rose-500/50'
      : accent === 'amber'
      ? 'focus:border-amber-500/50'
      : accent === 'purple'
      ? 'focus:border-purple-500/50'
      : 'focus:border-cyan-500/50';

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    const item: ScoreboardMetric = {
      id: `sb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      domain: newDomain.trim(),
      startValue: newStart.trim(),
      targetValue: newTarget.trim(),
      actualValue: newActual.trim()
    };
    onChange([...metrics, item]);
    setNewName('');
    setNewDomain('');
    setNewStart('');
    setNewTarget('');
    setNewActual('');
  };

  const handleUpdate = (id: string, patch: Partial<ScoreboardMetric>) => {
    onChange(metrics.map(m => (m.id === id ? { ...m, ...patch } : m)));
  };

  const handleDelete = (id: string) => {
    onChange(metrics.filter(m => m.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className={`text-xs font-extrabold uppercase tracking-wider flex items-center space-x-1.5 ${accentText}`}>
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{title}</span>
          </span>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      {metrics.length > 0 && (
        <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3 min-w-[160px]">Metric</th>
                <th className="py-2.5 px-2.5 min-w-[100px]">Domain</th>
                <th className="py-2.5 px-2.5 min-w-[100px]">Start</th>
                <th className="py-2.5 px-2.5 min-w-[100px]">Target</th>
                {showActual && <th className="py-2.5 px-2.5 min-w-[110px] text-emerald-400">Actual End</th>}
                <th className="py-2.5 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {metrics.map(m => (
                <tr key={m.id} className="group hover:bg-slate-900/40">
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={m.name}
                      onChange={e => handleUpdate(m.id, { name: e.target.value })}
                      placeholder="Metric name..."
                      className="w-full bg-transparent text-slate-100 font-semibold focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-2.5">
                    <input
                      type="text"
                      value={m.domain || ''}
                      onChange={e => handleUpdate(m.id, { domain: e.target.value })}
                      placeholder="e.g. Trading"
                      className="w-full bg-transparent text-slate-400 text-[11px] focus:outline-none"
                    />
                  </td>
                  <td className="py-2 px-2.5">
                    <input
                      type="text"
                      value={m.startValue}
                      onChange={e => handleUpdate(m.id, { startValue: e.target.value })}
                      placeholder="Start..."
                      className="w-full bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-1 font-mono text-[11px] text-slate-300 focus:outline-none focus:border-slate-600"
                    />
                  </td>
                  <td className="py-2 px-2.5">
                    <input
                      type="text"
                      value={m.targetValue}
                      onChange={e => handleUpdate(m.id, { targetValue: e.target.value })}
                      placeholder="Target..."
                      className={`w-full bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-1 font-mono text-[11px] text-amber-300 focus:outline-none ${accentBorderFocus}`}
                    />
                  </td>
                  {showActual && (
                    <td className="py-2 px-2.5">
                      <input
                        type="text"
                        value={m.actualValue}
                        onChange={e => handleUpdate(m.id, { actualValue: e.target.value })}
                        placeholder="Actual..."
                        className="w-full bg-emerald-500/5 border border-emerald-500/30 rounded-lg px-2 py-1 font-mono text-[11px] font-bold text-emerald-300 placeholder-slate-600 focus:outline-none focus:border-emerald-400"
                      />
                    </td>
                  )}
                  <td className="py-2 px-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      className="p-1 text-slate-600 hover:text-rose-400 opacity-60 group-hover:opacity-100 transition-opacity"
                      title="Remove metric"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick-add custom scoreboard metric row */}
      <form
        onSubmit={handleAdd}
        className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 focus-within:border-slate-600 transition-colors"
      >
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Add custom metric (e.g. Monthly Revenue, Trading Rule Adherence)..."
          className={`${showActual ? 'sm:col-span-4' : 'sm:col-span-5'} bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none ${accentBorderFocus}`}
        />
        <input
          type="text"
          value={newDomain}
          onChange={e => setNewDomain(e.target.value)}
          placeholder="Domain"
          className="sm:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
        />
        <input
          type="text"
          value={newStart}
          onChange={e => setNewStart(e.target.value)}
          placeholder="Start"
          className="sm:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl px-2.5 py-2 font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
        />
        <input
          type="text"
          value={newTarget}
          onChange={e => setNewTarget(e.target.value)}
          placeholder="Target"
          className="sm:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl px-2.5 py-2 font-mono text-xs text-amber-300 placeholder-slate-600 focus:outline-none"
        />
        {showActual && (
          <input
            type="text"
            value={newActual}
            onChange={e => setNewActual(e.target.value)}
            placeholder="Actual"
            className="sm:col-span-1 bg-slate-900/70 border border-slate-800 rounded-xl px-2 py-2 font-mono text-xs text-emerald-300 placeholder-slate-600 focus:outline-none"
          />
        )}
        <button
          type="submit"
          disabled={!newName.trim()}
          className="sm:col-span-1 flex items-center justify-center space-x-1 px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 text-xs font-bold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </form>
    </div>
  );
};
