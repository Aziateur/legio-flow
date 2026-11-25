import React from 'react';
import {
  useStorage,
  getPriorityItemsForEntry,
  formatPriorityItemsToPlanNotes
} from '../../context/StorageContext';
import {
  AlignmentVerdict,
  DailyEntry,
  NervousSystemState,
  OutcomeRootCause
} from '../../types/schema';
import {
  ALIGNMENT_VERDICTS,
  MISS_CAUSE_OPTIONS,
  NERVOUS_SYSTEM_STATES,
  shiftDateString
} from '../../lib/energyAnalytics';
import { getLastNormalLevel } from '../../lib/levelFeatures';
import {
  ArrowRight,
  BatteryLow,
  CheckCircle2,
  Circle,
  Clock,
  HeartPulse,
  Moon,
  Sparkles,
  Sun,
  Sunrise,
  Zap
} from 'lucide-react';

interface FastDailyReviewCardProps {
  selectedDate: string;
  entry: DailyEntry;
  isLowEnergyLevel: boolean;
  onSwitchToFullReview?: () => void;
}

export const FastDailyReviewCard: React.FC<FastDailyReviewCardProps> = ({
  selectedDate,
  entry,
  isLowEnergyLevel,
  onSwitchToFullReview
}) => {
  const { getEntryForDate, saveDailyEntry, setSystemLevel } = useStorage();

  const priorities = getPriorityItemsForEntry(entry);
  const restBlocks = entry.restBlocks || [];
  const ec = entry.energyCheck || {};
  const nextDate = shiftDateString(selectedDate, 1);
  const lastNormalLevel = getLastNormalLevel();

  const doneTasks = priorities.filter(p => p.completed).length;
  const doneRest = restBlocks.filter(r => r.completed).length;

  // Recovery-friendly suggested score: honors BOTH your essential(s) AND completing scheduled rest
  const taskRatio = priorities.length > 0 ? doneTasks / priorities.length : 1;
  const restRatio = restBlocks.length > 0 ? doneRest / restBlocks.length : 0.8;
  const suggestedFastScore = Math.max(
    1,
    Math.min(10, Math.round(taskRatio * 5 + restRatio * 5))
  );

  const handleTogglePriority = (idx: number) => {
    const updated = priorities.map((item, i) =>
      i === idx
        ? {
            ...item,
            completed: !item.completed,
            ...(!item.completed ? { pushedToDate: undefined } : {})
          }
        : item
    );
    saveDailyEntry(selectedDate, {
      priorityItems: updated,
      planNotes: formatPriorityItemsToPlanNotes(updated),
      mainTasksCompleted: updated.filter(i => i.completed).length,
      mainTasksTotal: Math.max(isLowEnergyLevel ? 1 : 3, updated.length)
    });
  };

  const handlePushPriorityNextDay = (prio: typeof priorities[number]) => {
    const cleanText = prio.text.trim();
    if (!cleanText) return;
    const nextEntry = getEntryForDate(nextDate);
    const nextExisting = getPriorityItemsForEntry(nextEntry);
    const alreadyInNext = nextExisting.some(
      p =>
        (prio.subTaskId && p.subTaskId === prio.subTaskId) ||
        (prio.weeklyTaskId && !prio.subTaskId && p.weeklyTaskId === prio.weeklyTaskId && !p.subTaskId) ||
        (prio.checklistItemId && p.checklistItemId === prio.checklistItemId) ||
        p.text.trim().toLowerCase() === cleanText.toLowerCase()
    );
    if (!alreadyInNext) {
      const nextItems = [
        ...nextExisting,
        {
          id: `prio_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: cleanText,
          completed: false,
          ...(prio.weeklyTaskId ? { weeklyTaskId: prio.weeklyTaskId } : {}),
          ...(prio.subTaskId ? { subTaskId: prio.subTaskId } : {}),
          ...(prio.checklistItemId ? { checklistItemId: prio.checklistItemId } : {}),
          pushedFromDate: selectedDate
        }
      ];
      saveDailyEntry(nextDate, {
        priorityItems: nextItems,
        planNotes: formatPriorityItemsToPlanNotes(nextItems),
        mainTasksCompleted: nextItems.filter(i => i.completed).length,
        mainTasksTotal: Math.max(1, nextItems.length)
      });
    }
    const updatedToday = priorities.map(item =>
      item.id === prio.id ? { ...item, completed: false, pushedToDate: nextDate } : item
    );
    saveDailyEntry(selectedDate, {
      priorityItems: updatedToday,
      planNotes: formatPriorityItemsToPlanNotes(updatedToday),
      mainTasksCompleted: updatedToday.filter(i => i.completed).length,
      mainTasksTotal: Math.max(isLowEnergyLevel ? 1 : 3, updatedToday.length)
    });
  };

  const handleSetMissCause = (prioId: string, rootCause?: OutcomeRootCause) => {
    const prev = entry.priorityAudits || {};
    saveDailyEntry(selectedDate, {
      priorityAudits: {
        ...prev,
        [prioId]: { ...(prev[prioId] || {}), rootCause }
      }
    });
  };

  const handleToggleRest = (id: string) => {
    saveDailyEntry(selectedDate, {
      restBlocks: restBlocks.map(r => (r.id === id ? { ...r, completed: !r.completed } : r))
    });
  };

  const updateEnergy = (patch: Partial<NonNullable<DailyEntry['energyCheck']>>) => {
    saveDailyEntry(selectedDate, {
      energyCheck: { ...(entry.energyCheck || {}), ...patch }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="bg-slate-900/95 border border-teal-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 text-[10px] font-extrabold uppercase tracking-widest text-teal-400">
              {isLowEnergyLevel ? <BatteryLow className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
              <span>{isLowEnergyLevel ? 'LVL 0 · Emergency Fast Review' : '60-Second Fast Review'}</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-100">
              Close {selectedDate} in 60 Seconds
            </h2>
            <p className="text-xs text-slate-400">
              Check off your essential &amp; scheduled rest, log your energy/nervous system, and go rest.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToFullReview && (
              <button
                type="button"
                onClick={onSwitchToFullReview}
                className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold transition-colors"
              >
                Open Full Review
              </button>
            )}
            {isLowEnergyLevel && (
              <button
                type="button"
                onClick={() => setSystemLevel(lastNormalLevel)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-teal-300 border border-teal-500/30 text-xs font-bold transition-colors"
              >
                Exit → LVL {lastNormalLevel}
              </button>
            )}
          </div>
        </div>

        {/* 1. Essentials & Scheduled Rest */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Essentials */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold uppercase tracking-wider text-amber-400 text-[10px]">
                1. Today&apos;s Essential(s)
              </span>
              <span className="font-mono font-bold text-slate-300">
                {doneTasks}/{priorities.length}
              </span>
            </div>

            {priorities.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">Pure recovery day — no tasks were scheduled.</p>
            ) : (
              <div className="space-y-2">
                {priorities.map((p, idx) => {
                  const cause = entry.priorityAudits?.[p.id]?.rootCause || '';
                  return (
                    <div
                      key={p.id || idx}
                      className={`p-2.5 rounded-xl border space-y-1.5 text-xs ${
                        p.completed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                          : 'bg-slate-900/90 border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePriority(idx)}
                          className="flex items-center space-x-2 text-left min-w-0 flex-1"
                        >
                          {p.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-rose-400/80 shrink-0" />
                          )}
                          <span className={p.completed ? 'line-through text-slate-400 truncate' : 'font-medium truncate'}>
                            {p.text}
                          </span>
                        </button>

                        {!p.completed && (
                          p.pushedToDate ? (
                            <span className="text-[10px] font-bold text-rose-300 shrink-0">
                              → {p.pushedToDate.slice(5)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePushPriorityNextDay(p)}
                              className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-slate-950 hover:bg-rose-500/15 text-slate-400 hover:text-rose-300 border border-slate-800 text-[10px] font-bold shrink-0"
                            >
                              <span>Next Day</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )
                        )}
                      </div>

                      {!p.completed && (
                        <select
                          value={cause}
                          onChange={e =>
                            handleSetMissCause(
                              p.id,
                              (e.target.value || undefined) as OutcomeRootCause | undefined
                            )
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-semibold text-amber-300 focus:outline-none"
                        >
                          <option value="">Why not done? (e.g. Lacked Energy / Time...)</option>
                          {MISS_CAUSE_OPTIONS.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scheduled Rest */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-teal-500/20 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold uppercase tracking-wider text-teal-400 text-[10px]">
                2. Scheduled Rest Blocks
              </span>
              <span className="font-mono font-bold text-teal-300">
                {doneRest}/{restBlocks.length}
              </span>
            </div>

            {restBlocks.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                No rest blocks scheduled yet — schedule one in your Daily Plan to protect recovery.
              </p>
            ) : (
              <div className="space-y-1.5">
                {restBlocks.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleToggleRest(r.id)}
                    className={`w-full flex items-center space-x-2 p-2.5 rounded-xl border text-left text-xs transition-all ${
                      r.completed
                        ? 'bg-teal-500/10 border-teal-500/35 text-teal-200'
                        : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-teal-500/30'
                    }`}
                  >
                    {r.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span className="inline-flex items-center space-x-1 font-mono text-[10px] text-teal-300 shrink-0">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{r.timeWindow}</span>
                    </span>
                    <span className={r.completed ? 'line-through opacity-75 truncate' : 'truncate'}>
                      {r.activity}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. Fast Energy & Nervous System Tap */}
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
          <div className="flex items-center space-x-1.5 text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
            <HeartPulse className="w-3.5 h-3.5" />
            <span>3. Energy &amp; Nervous System Pulse</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                { key: 'wakeUp', label: 'Wake', icon: Sunrise, val: ec.wakeUp },
                { key: 'midday', label: 'Day', icon: Sun, val: ec.midday },
                { key: 'night', label: 'Night', icon: Moon, val: ec.night }
              ] as const
            ).map(slot => {
              const Icon = slot.icon;
              return (
                <div key={slot.key} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-300 font-bold">
                    <span className="inline-flex items-center space-x-1">
                      <Icon className="w-3 h-3 text-amber-400" />
                      <span>{slot.label}</span>
                    </span>
                    <span className="font-mono text-cyan-300">{slot.val ? `${slot.val}/10` : '—'}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {[2, 4, 6, 8, 10].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => updateEnergy({ [slot.key]: slot.val === n ? undefined : n })}
                        className={`py-1 rounded-lg font-mono text-[11px] font-bold transition-colors ${
                          slot.val === n
                            ? n < 6
                              ? 'bg-rose-500 text-slate-950 font-extrabold'
                              : 'bg-teal-500 text-slate-950 font-extrabold'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 mr-1">Nervous System:</span>
              {NERVOUS_SYSTEM_STATES.map(st => {
                const active = ec.nervousSystemState === st.id;
                const defaultScoreForState: Record<NervousSystemState, number> = {
                  calm: 8,
                  sharp: 9,
                  wired: 5,
                  foggy: 4,
                  drained: 3
                };
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() =>
                      updateEnergy({
                        nervousSystemState: active ? undefined : st.id,
                        nervousSystemScore: active
                          ? ec.nervousSystemScore
                          : ec.nervousSystemScore ?? defaultScoreForState[st.id]
                      })
                    }
                    className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all ${
                      active
                        ? st.activeCls
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {st.shortLabel}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center space-x-1.5 text-[11px]">
              <span className="text-slate-500 font-bold">NS Score:</span>
              <select
                value={ec.nervousSystemScore || ''}
                onChange={e =>
                  updateEnergy({
                    nervousSystemScore: e.target.value ? parseInt(e.target.value, 10) : undefined
                  })
                }
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 font-mono font-bold text-cyan-300 focus:outline-none"
              >
                <option value="">—/10</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <option key={n} value={n}>
                    {n}/10
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 4. Gentle Alignment & Day Score */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400 block">
              4. Plan Alignment (Downshifting Wisely = Better Pivot)
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {ALIGNMENT_VERDICTS.map((v: { id: AlignmentVerdict; shortLabel: string; activeCls: string }) => {
                const active = entry.alignmentVerdict === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() =>
                      saveDailyEntry(selectedDate, {
                        alignmentVerdict: active ? undefined : v.id
                      })
                    }
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      active
                        ? v.activeCls
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {v.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                5. Gentle Day Score
              </span>
              <button
                type="button"
                onClick={() => saveDailyEntry(selectedDate, { executionScore: suggestedFastScore })}
                className="text-[10px] font-mono font-bold text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-2 py-0.5 rounded border border-teal-500/30"
              >
                Suggested (Tasks + Rest): {suggestedFastScore}/10
              </button>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(sc => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => saveDailyEntry(selectedDate, { executionScore: sc })}
                  className={`py-1.5 rounded-lg font-mono text-[11px] font-bold transition-all ${
                    entry.executionScore === sc
                      ? 'bg-teal-500 text-slate-950 font-extrabold shadow'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {sc}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5. 1-Line Gentle Note for Tomorrow */}
        <div className="space-y-1.5">
          <label className="flex items-center space-x-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>6. One Gentle Note / Boundary for Tomorrow (Optional)</span>
          </label>
          <textarea
            rows={2}
            value={entry.reviewNotes || ''}
            onChange={e => saveDailyEntry(selectedDate, { reviewNotes: e.target.value })}
            placeholder="e.g. Sleep until 7:30, keep morning quiet, only touch #1 essential..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500/50 rounded-2xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none resize-none"
          />
        </div>
      </div>
    </div>
  );
};
