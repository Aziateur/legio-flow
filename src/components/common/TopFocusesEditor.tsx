import React from 'react';
import { Crosshair, Plus, X } from 'lucide-react';

interface TopFocusesEditorProps {
  focuses?: string[];
  onChange: (next: string[]) => void;
  accent?: 'purple' | 'cyan' | 'rose' | 'amber';
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export const TopFocusesEditor: React.FC<TopFocusesEditorProps> = ({
  focuses,
  onChange,
  accent = 'amber',
  title = 'Top 3 Focuses',
  subtitle = 'The 3 highest-leverage pillars that define victory for this period — mirrored against your Top 3 Constraints.',
  compact = false
}) => {
  // Always display at least 3 clean slots by default, while allowing user to add/remove custom slots
  const slots = Array.isArray(focuses) && focuses.length > 0 ? focuses : ['', '', ''];

  const accentText =
    accent === 'purple'
      ? 'text-purple-400'
      : accent === 'cyan'
      ? 'text-cyan-400'
      : accent === 'rose'
      ? 'text-rose-400'
      : 'text-amber-400';

  const accentBadge =
    accent === 'purple'
      ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
      : accent === 'cyan'
      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
      : accent === 'rose'
      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
      : 'bg-amber-500/15 text-amber-300 border-amber-500/30';

  const accentFocusBorder =
    accent === 'purple'
      ? 'focus-within:border-purple-500/50'
      : accent === 'cyan'
      ? 'focus-within:border-cyan-500/50'
      : accent === 'rose'
      ? 'focus-within:border-rose-500/50'
      : 'focus-within:border-amber-500/50';

  const handleSlotChange = (index: number, value: string) => {
    const next = [...slots];
    next[index] = value;
    onChange(next);
  };

  const handleAddSlot = () => {
    if (slots.length >= 6) return;
    onChange([...slots, '']);
  };

  const handleRemoveSlot = (index: number) => {
    if (slots.length <= 1) return;
    onChange(slots.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className={`text-xs font-extrabold uppercase tracking-wider flex items-center space-x-1.5 ${accentText}`}>
            <Crosshair className="w-3.5 h-3.5" />
            <span>{title}</span>
          </span>
          {!compact && subtitle && (
            <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        {slots.length < 6 && (
          <button
            type="button"
            onClick={handleAddSlot}
            className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors"
            title="Add focus slot"
          >
            <Plus className="w-3 h-3" />
            <span>Slot</span>
          </button>
        )}
      </div>

      <div className={`grid grid-cols-1 ${compact ? 'gap-2' : 'md:grid-cols-3 gap-3'}`}>
        {slots.map((val, idx) => (
          <div
            key={idx}
            className={`group flex items-center space-x-2.5 ${
              compact ? 'p-2.5' : 'p-3.5'
            } rounded-2xl bg-slate-950 border border-slate-800 transition-colors ${accentFocusBorder}`}
          >
            <span
              className={`w-6 h-6 rounded-lg border flex items-center justify-center font-mono text-xs font-extrabold shrink-0 ${accentBadge}`}
            >
              {idx + 1}
            </span>
            <input
              type="text"
              value={val}
              onChange={e => handleSlotChange(idx, e.target.value)}
              placeholder={`Focus #${idx + 1}...`}
              className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-semibold text-slate-100 placeholder-slate-600 focus:outline-none"
            />
            {slots.length > 3 && (
              <button
                type="button"
                onClick={() => handleRemoveSlot(idx)}
                className="p-1 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove slot"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
