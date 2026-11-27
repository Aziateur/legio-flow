import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DailySpiritMode } from '../../types/schema';
import { useStorage } from '../../context/StorageContext';
import { hasExistingParent } from '../../lib/problems';
import {
  Check,
  HeartPulse,
  RotateCcw,
  Sparkles,
  Target,
  Wrench,
  X
} from 'lucide-react';

interface DailySpiritCardProps {
  selectedDate: string;
  weeklyFocusTheme?: string;
  defaultMode?: DailySpiritMode;
}

const SPIRIT_MODES: Array<{
  id: DailySpiritMode;
  label: string;
  cue: string;
  placeholder: string;
  cardCls: string;
  accentBarCls: string;
  iconCls: string;
  pillActiveCls: string;
  focusBorderCls: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  {
    id: 'spirit',
    label: 'Spirit',
    cue: 'Posture, mindset, or how you want to move through today',
    placeholder:
      "What's the goal, spirit, or posture of today? (vital systems, recovery, fix X, lock in Y)...",
    cardCls: 'border-violet-500/30 bg-gradient-to-br from-slate-900/95 via-violet-950/20 to-slate-900/95',
    accentBarCls: 'border-l-4 border-l-violet-400',
    iconCls: 'text-violet-400',
    pillActiveCls: 'bg-violet-500 text-slate-950 border-violet-400',
    focusBorderCls: 'focus:border-violet-400/60',
    Icon: Sparkles
  },
  {
    id: 'goal',
    label: 'Goal',
    cue: 'The one main outcome that makes today a win',
    placeholder: 'e.g. Lock in the driving school & send CAF papers...',
    cardCls: 'border-amber-500/30 bg-gradient-to-br from-slate-900/95 via-amber-950/20 to-slate-900/95',
    accentBarCls: 'border-l-4 border-l-amber-400',
    iconCls: 'text-amber-400',
    pillActiveCls: 'bg-amber-500 text-slate-950 border-amber-400',
    focusBorderCls: 'focus:border-amber-400/60',
    Icon: Target
  },
  {
    id: 'recovery',
    label: 'Recovery',
    cue: 'Protect vital systems & recover nervous system without rushing',
    placeholder:
      'e.g. Do every vital system while recovering from nervous system issue — calm pace, zero rushing...',
    cardCls: 'border-teal-500/30 bg-gradient-to-br from-slate-900/95 via-teal-950/25 to-slate-900/95',
    accentBarCls: 'border-l-4 border-l-teal-400',
    iconCls: 'text-teal-400',
    pillActiveCls: 'bg-teal-500 text-slate-950 border-teal-400',
    focusBorderCls: 'focus:border-teal-400/60',
    Icon: HeartPulse
  },
  {
    id: 'fix',
    label: 'Fix',
    cue: 'Debug one bottleneck or hold one key fix today',
    placeholder: 'e.g. Fix afternoon energy crash — phone in hallway at 13:00...',
    cardCls: 'border-orange-500/30 bg-gradient-to-br from-slate-900/95 via-orange-950/20 to-slate-900/95',
    accentBarCls: 'border-l-4 border-l-orange-400',
    iconCls: 'text-orange-400',
    pillActiveCls: 'bg-orange-500 text-slate-950 border-orange-400',
    focusBorderCls: 'focus:border-orange-400/60',
    Icon: Wrench
  }
];

export const DailySpiritCard: React.FC<DailySpiritCardProps> = ({
  selectedDate,
  weeklyFocusTheme,
  defaultMode = 'spirit'
}) => {
  const { getEntryForDate, saveDailyEntry, dailyEntries, problems } = useStorage();
  const entry = getEntryForDate(selectedDate);

  const activeMode: DailySpiritMode = entry.daySpiritMode || defaultMode;
  const modeMeta = SPIRIT_MODES.find(m => m.id === activeMode) || SPIRIT_MODES[0];
  const ModeIcon = modeMeta.Icon;

  const [draft, setDraft] = useState(entry.daySpirit || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(entry.daySpirit || '');
  }, [selectedDate, entry.daySpirit]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(46, el.scrollHeight)}px`;
  }, [draft, selectedDate]);

  const previousDaySpirit = useMemo(() => {
    return Object.values(dailyEntries)
      .filter(d => d.date < selectedDate && d.daySpirit && d.daySpirit.trim().length > 0)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [dailyEntries, selectedDate]);

  const topConstraintProblem = useMemo(() => {
    return problems.find(
      p => p.isTopConstraint && p.status !== 'solved' && !hasExistingParent(problems, p)
    );
  }, [problems]);

  const handleTextChange = (nextVal: string) => {
    setDraft(nextVal);
    saveDailyEntry(selectedDate, {
      daySpirit: nextVal,
      daySpiritMode: activeMode,
      ...(!nextVal.trim() ? { daySpiritHonored: undefined } : {})
    });
  };

  const handleSelectMode = (nextMode: DailySpiritMode) => {
    saveDailyEntry(selectedDate, {
      daySpiritMode: nextMode
    });
  };

  const handleApplyStarter = (text: string, mode: DailySpiritMode) => {
    setDraft(text);
    saveDailyEntry(selectedDate, {
      daySpirit: text,
      daySpiritMode: mode
    });
  };

  const hasText = draft.trim().length > 0;

  return (
    <div
      className={`rounded-3xl border p-4 sm:p-5 shadow-lg space-y-3 transition-colors ${modeMeta.cardCls} ${modeMeta.accentBarCls}`}
    >
      {/* Header Row: Title + Lens Pills + Optional Honored/Clear */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <ModeIcon className={`w-4 h-4 shrink-0 ${modeMeta.iconCls}`} />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-100">
              Goal / Spirit of the Day
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{modeMeta.cue}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <div className="inline-flex items-center rounded-xl bg-slate-950/90 border border-slate-800 p-0.5">
            {SPIRIT_MODES.map(m => {
              const Icon = m.Icon;
              const isActive = m.id === activeMode;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMode(m.id)}
                  className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    isActive
                      ? m.pillActiveCls
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {hasText && (
            <>
              <button
                type="button"
                onClick={() =>
                  saveDailyEntry(selectedDate, {
                    daySpiritHonored: entry.daySpiritHonored ? undefined : true
                  })
                }
                title="Mark whether you honored today's goal or spirit"
                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-colors ${
                  entry.daySpiritHonored === true
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-950/90 hover:bg-emerald-500/15 text-emerald-300 border-slate-800'
                }`}
              >
                <Check className="w-3 h-3" />
                <span>{entry.daySpiritHonored === true ? 'Honored' : 'Honored?'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleTextChange('')}
                title="Clear today's Goal / Spirit"
                className="p-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-800 text-slate-500 hover:text-slate-200 border border-slate-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Auto-Resizing Input */}
      <textarea
        ref={textareaRef}
        rows={1}
        value={draft}
        onChange={e => handleTextChange(e.target.value)}
        placeholder={modeMeta.placeholder}
        className={`w-full bg-slate-950/75 border border-slate-800/90 ${modeMeta.focusBorderCls} rounded-2xl px-4 py-3 text-sm sm:text-base font-bold text-slate-100 placeholder-slate-500 focus:outline-none resize-none overflow-hidden leading-snug transition-colors`}
      />

      {/* Smart Starter Chips (ONLY visible while empty) */}
      {!hasText && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-0.5">
            Quick set:
          </span>

          {previousDaySpirit?.daySpirit && (
            <button
              type="button"
              onClick={() =>
                handleApplyStarter(
                  previousDaySpirit.daySpirit!,
                  previousDaySpirit.daySpiritMode || 'spirit'
                )
              }
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-slate-800 text-violet-300 border border-violet-500/30 font-semibold transition-colors"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[240px]">
                Same as {previousDaySpirit.date.slice(5)}: &ldquo;{previousDaySpirit.daySpirit.trim()}&rdquo;
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              handleApplyStarter(
                'Do every vital system while recovering from nervous system fatigue — calm pace, no rushing',
                'recovery'
              )
            }
            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-teal-500/15 text-teal-300 border border-teal-500/30 font-semibold transition-colors"
          >
            <HeartPulse className="w-3 h-3 shrink-0" />
            <span>Vital systems &amp; nervous system recovery</span>
          </button>

          {topConstraintProblem && (
            <button
              type="button"
              onClick={() => handleApplyStarter(`Fix: ${topConstraintProblem.title}`, 'fix')}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-orange-500/15 text-orange-300 border border-orange-500/30 font-semibold transition-colors"
            >
              <Wrench className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[220px]">Fix: {topConstraintProblem.title}</span>
            </button>
          )}

          {weeklyFocusTheme?.trim() && (
            <button
              type="button"
              onClick={() => handleApplyStarter(weeklyFocusTheme.trim(), 'goal')}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold transition-colors"
            >
              <Target className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[220px]">Week focus: {weeklyFocusTheme.trim()}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
