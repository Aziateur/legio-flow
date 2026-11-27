import React, { useState } from 'react';
import {
  useStorage,
  getPriorityItemsForEntry,
  formatPriorityItemsToPlanNotes
} from '../../context/StorageContext';
import { DailyPriorityItem, ScheduledRestBlock } from '../../types/schema';
import { getLastNormalLevel } from '../../lib/levelFeatures';
import { shiftDateString } from '../../lib/energyAnalytics';
import { DailySpiritCard } from './DailySpiritCard';
import {
  ArrowRight,
  BatteryLow,
  CheckCircle2,
  Circle,
  Clock,
  HeartPulse,
  Moon,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp
} from 'lucide-react';

const REST_PRESETS: Array<{ timeWindow: string; activity: string; shortLabel: string }> = [
  {
    timeWindow: 'Afternoon',
    activity: '30m NSDR / Nap (eyes closed, zero screens)',
    shortLabel: '+ 30m NSDR / Nap'
  },
  {
    timeWindow: 'Daytime',
    activity: '20m Slow Walk Outside (no phone / no audio)',
    shortLabel: '+ 20m Walk (No Phone)'
  },
  {
    timeWindow: 'Evening',
    activity: '45m Screen-Off Nervous System Decompress',
    shortLabel: '+ Screen-Off Block'
  },
  {
    timeWindow: '22:00',
    activity: 'Early Lights-Out (protect 8.5h+ sleep window)',
    shortLabel: '+ Early Sleep Window'
  }
];

export const LowEnergyDayView: React.FC<{ selectedDate: string }> = ({ selectedDate }) => {
  const {
    getEntryForDate,
    saveDailyEntry,
    setSystemLevel,
    setActiveTab,
    setReviewSubTab,
    setSelectedDate
  } = useStorage();

  const currentEntry = getEntryForDate(selectedDate);
  const existingPriorities = getPriorityItemsForEntry(currentEntry);
  const restBlocks = currentEntry.restBlocks || [];
  const lastNormalLevel = getLastNormalLevel();
  const nextDate = shiftDateString(selectedDate, 1);

  const [essentialDraft, setEssentialDraft] = useState('');
  const [restTimeDraft, setRestTimeDraft] = useState('');
  const [restActivityDraft, setRestActivityDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const activeEssentialsCount = existingPriorities.filter(p => !p.pushedToDate).length;
  const doneEssentialsCount = existingPriorities.filter(p => p.completed).length;
  const doneRestCount = restBlocks.filter(r => r.completed).length;

  const commitEssentials = (nextItems: DailyPriorityItem[]) => {
    const clean = nextItems.filter(i => i.text.trim().length > 0);
    saveDailyEntry(selectedDate, {
      priorityItems: clean,
      planNotes: formatPriorityItemsToPlanNotes(clean),
      mainTasksCompleted: clean.filter(i => i.completed).length,
      mainTasksTotal: Math.max(1, clean.length)
    });
  };

  const handleAddEssential = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = essentialDraft.trim();
    if (!trimmed) return;
    if (activeEssentialsCount >= 2) return;
    const next: DailyPriorityItem[] = [
      ...existingPriorities,
      {
        id: `prio_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: trimmed,
        completed: false
      }
    ];
    commitEssentials(next);
    setEssentialDraft('');
  };

  const handleToggleEssential = (id: string) => {
    const next = existingPriorities.map(item =>
      item.id === id
        ? {
            ...item,
            completed: !item.completed,
            ...(!item.completed ? { pushedToDate: undefined } : {})
          }
        : item
    );
    commitEssentials(next);
  };

  const handleEditEssential = (id: string, text: string) => {
    const next = existingPriorities.map(item => (item.id === id ? { ...item, text } : item));
    commitEssentials(next);
  };

  const handleRemoveEssential = (id: string) => {
    commitEssentials(existingPriorities.filter(item => item.id !== id));
  };

  const handlePushEssentialTomorrow = (item: DailyPriorityItem) => {
    const cleanText = item.text.trim();
    if (!cleanText) return;
    const tomorrowEntry = getEntryForDate(nextDate);
    const tomorrowExisting = getPriorityItemsForEntry(tomorrowEntry);
    const alreadyInTomorrow = tomorrowExisting.some(
      p =>
        (item.subTaskId && p.subTaskId === item.subTaskId) ||
        (item.weeklyTaskId && !item.subTaskId && p.weeklyTaskId === item.weeklyTaskId && !p.subTaskId) ||
        (item.checklistItemId && p.checklistItemId === item.checklistItemId) ||
        p.text.trim().toLowerCase() === cleanText.toLowerCase()
    );
    if (!alreadyInTomorrow) {
      const nextTomorrow = [
        ...tomorrowExisting,
        {
          id: `prio_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: cleanText,
          completed: false,
          ...(item.weeklyTaskId ? { weeklyTaskId: item.weeklyTaskId } : {}),
          ...(item.subTaskId ? { subTaskId: item.subTaskId } : {}),
          ...(item.checklistItemId ? { checklistItemId: item.checklistItemId } : {}),
          pushedFromDate: selectedDate
        }
      ];
      saveDailyEntry(nextDate, {
        priorityItems: nextTomorrow,
        planNotes: formatPriorityItemsToPlanNotes(nextTomorrow),
        mainTasksCompleted: nextTomorrow.filter(i => i.completed).length,
        mainTasksTotal: Math.max(1, nextTomorrow.length)
      });
    }

    const updatedToday = existingPriorities.map(p =>
      p.id === item.id ? { ...p, completed: false, pushedToDate: nextDate } : p
    );
    commitEssentials(updatedToday);
    setNotice(`Moved "${cleanText.slice(0, 28)}${cleanText.length > 28 ? '…' : ''}" to ${nextDate.slice(5)} (kept Not Done today)`);
    setTimeout(() => setNotice(null), 3000);
  };

  const commitRestBlocks = (nextBlocks: ScheduledRestBlock[]) => {
    saveDailyEntry(selectedDate, { restBlocks: nextBlocks });
  };

  const handleAddRestBlock = (timeWindow: string, activity: string) => {
    const cleanActivity = activity.trim();
    if (!cleanActivity) return;
    const nextBlock: ScheduledRestBlock = {
      id: `rest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timeWindow: timeWindow.trim() || 'Scheduled',
      activity: cleanActivity,
      completed: false
    };
    commitRestBlocks([...restBlocks, nextBlock]);
  };

  const handleSubmitCustomRest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restActivityDraft.trim()) return;
    handleAddRestBlock(restTimeDraft, restActivityDraft);
    setRestTimeDraft('');
    setRestActivityDraft('');
  };

  const handleToggleRestBlock = (id: string) => {
    commitRestBlocks(
      restBlocks.map(r => (r.id === id ? { ...r, completed: !r.completed } : r))
    );
  };

  const handleDeleteRestBlock = (id: string) => {
    commitRestBlocks(restBlocks.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-5">
      {/* Calm LVL 0 Emergency Protocol Banner */}
      <div className="rounded-3xl border border-teal-500/35 bg-gradient-to-r from-slate-900 via-teal-950/30 to-slate-900 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-teal-500/15 border border-teal-500/35 text-[11px] font-extrabold uppercase tracking-wider text-teal-300">
              <BatteryLow className="w-3.5 h-3.5" />
              <span>LVL 0 · Low-Energy Emergency Mode</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-100">
              Protect Fuel First. Low Ambition + Scheduled Rest.
            </h2>
            <p className="text-xs text-slate-300/90 max-w-2xl leading-relaxed">
              Macro roadmaps, weekly point pressure, and allowances are paused from view. Pick{' '}
              <strong className="text-teal-300">1 minimum essential</strong> (at most 2 light items),
              schedule deliberate <strong className="text-teal-300">rest blocks</strong>, and close tonight in 60 seconds.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setReviewSubTab('daily');
                setActiveTab('review');
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-extrabold shadow-md transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>60-Sec Fast Review</span>
            </button>
            <button
              type="button"
              onClick={() => setSystemLevel(lastNormalLevel)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-950/90 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold transition-colors"
              title={`Exit Low-Energy Mode and return to Level ${lastNormalLevel}`}
            >
              <span>Exit → LVL {lastNormalLevel}</span>
            </button>
          </div>
        </div>

        {notice && (
          <div className="mt-3 flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-slate-950/90 border border-teal-500/30 text-xs text-teal-200">
            <span>✓ {notice}</span>
            <button
              type="button"
              onClick={() => setSelectedDate(nextDate)}
              className="underline font-bold text-teal-300 hover:text-white shrink-0"
            >
              View {nextDate.slice(5)} →
            </button>
          </div>
        )}
      </div>

      <DailySpiritCard selectedDate={selectedDate} />

      {/* Main 2-Card Calm Grid: 1) Low-Ambition Essentials  2) Scheduled Rest */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* CARD 1: LOW-AMBITION MINIMUM VIABLE DAY */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 block">
                Low-Ambition Minimum (Cap: 1–2 Items)
              </span>
              <h3 className="text-base font-extrabold text-slate-100 mt-0.5">
                Today&apos;s Bare Minimum Essential
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                What is the single smallest thing that keeps life/work safe today? Completing 1 = full win.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-xs font-bold shrink-0">
              {doneEssentialsCount}/{Math.max(1, existingPriorities.length)} Done
            </span>
          </div>

          {activeEssentialsCount > 2 && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
              You have <strong>{activeEssentialsCount}</strong> tasks from earlier planning. Use{' '}
              <strong>Next Day →</strong> on anything non-urgent so today drops to 1–2 essentials.
            </div>
          )}

          {existingPriorities.length === 0 ? (
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-dashed border-slate-800 text-center text-xs text-slate-400">
              No essential set yet — add 1 small, doable task below (or leave today pure rest).
            </div>
          ) : (
            <div className="space-y-2.5">
              {existingPriorities.map((item, idx) => (
                <div
                  key={item.id}
                  className={`group flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
                    item.completed
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : item.pushedToDate
                      ? 'bg-slate-950/60 border-rose-500/25 opacity-80'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleEssential(item.id)}
                    className="shrink-0"
                    title={item.completed ? 'Mark incomplete' : 'Mark essential done'}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 hover:text-amber-400" />
                    )}
                  </button>

                  <span className="font-mono text-xs font-extrabold text-amber-400 shrink-0">
                    #{idx + 1}
                  </span>

                  <input
                    type="text"
                    value={item.text}
                    onChange={e => handleEditEssential(item.id, e.target.value)}
                    className={`flex-1 min-w-0 bg-transparent text-xs sm:text-sm focus:outline-none ${
                      item.completed ? 'line-through text-slate-400' : 'text-slate-100 font-medium'
                    }`}
                  />

                  {!item.completed && (
                    item.pushedToDate ? (
                      <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-bold shrink-0">
                        Not Done · → {item.pushedToDate.slice(5)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePushEssentialTomorrow(item)}
                        className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-500/15 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/35 text-[10px] font-bold transition-colors shrink-0"
                        title={`Push to ${nextDate} & mark Not Done today`}
                      >
                        <span>Next Day</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveEssential(item.id)}
                    className="p-1 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeEssentialsCount < 2 ? (
            <form onSubmit={handleAddEssential} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={essentialDraft}
                onChange={e => setEssentialDraft(e.target.value)}
                placeholder={
                  activeEssentialsCount === 0
                    ? 'Add your #1 minimum viable task for today...'
                    : 'Optional: 1 tiny secondary task (cap is 2 in LVL 0)...'
                }
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!essentialDraft.trim()}
                className="inline-flex items-center space-x-1 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-extrabold shrink-0 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>
          ) : (
            <div className="text-[11px] text-teal-300/90 font-medium px-1">
              ✓ Low-ambition cap reached (2 active items max in LVL 0). Protect the rest of your bandwidth for recovery.
            </div>
          )}
        </div>

        {/* CARD 2: SCHEDULED REST & RECOVERY BLOCKS */}
        <div className="bg-slate-900/90 border border-teal-500/25 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold uppercase tracking-widest text-teal-400">
                <Moon className="w-3 h-3" />
                <span>Scheduled Rest Protocol</span>
              </span>
              <h3 className="text-base font-extrabold text-slate-100 mt-0.5">
                Deliberate Recovery Blocks
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Unscheduled rest turns into guilty scrolling. Put real recovery on the clock and check it off like deep work.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30 font-mono text-xs font-bold shrink-0">
              {doneRestCount}/{restBlocks.length} Rested
            </span>
          </div>

          {/* 1-Click Presets */}
          <div className="flex flex-wrap gap-1.5">
            {REST_PRESETS.map((preset, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleAddRestBlock(preset.timeWindow, preset.activity)}
                className="px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-teal-500/15 text-teal-300 border border-slate-800 hover:border-teal-500/40 text-[11px] font-bold transition-colors"
              >
                {preset.shortLabel}
              </button>
            ))}
          </div>

          {/* Scheduled Rest List */}
          {restBlocks.length === 0 ? (
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-dashed border-slate-800 text-center space-y-1">
              <HeartPulse className="w-5 h-5 text-teal-400/70 mx-auto" />
              <p className="text-xs text-slate-400">
                Tap a preset above or schedule a specific rest window below.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {restBlocks.map(block => (
                <div
                  key={block.id}
                  className={`group flex items-center justify-between gap-2.5 p-3 rounded-2xl border transition-all ${
                    block.completed
                      ? 'bg-teal-500/10 border-teal-500/35 text-teal-200'
                      : 'bg-slate-950 border-slate-800 hover:border-teal-500/30 text-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleRestBlock(block.id)}
                    className="flex items-center space-x-2.5 text-left min-w-0 flex-1"
                  >
                    {block.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 hover:text-teal-400 shrink-0" />
                    )}
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[10px] font-bold text-teal-300 shrink-0">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{block.timeWindow}</span>
                    </span>
                    <span
                      className={`text-xs sm:text-sm truncate ${
                        block.completed ? 'line-through text-teal-300/70' : 'font-medium'
                      }`}
                    >
                      {block.activity}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteRestBlock(block.id)}
                    className="p-1 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="Remove rest block"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Custom Rest Block Adder */}
          <form onSubmit={handleSubmitCustomRest} className="flex flex-col sm:flex-row gap-2 pt-1">
            <input
              type="text"
              value={restTimeDraft}
              onChange={e => setRestTimeDraft(e.target.value)}
              placeholder="When? (e.g. 15:00–15:45)"
              className="sm:w-40 bg-slate-950 border border-slate-800 focus:border-teal-500/50 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
            />
            <input
              type="text"
              value={restActivityDraft}
              onChange={e => setRestActivityDraft(e.target.value)}
              placeholder="Rest block (e.g. Lie down, stretch, sauna, read fiction)..."
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-teal-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!restActivityDraft.trim()}
              className="inline-flex items-center justify-center space-x-1 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-slate-950 text-xs font-extrabold shrink-0 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Schedule</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
