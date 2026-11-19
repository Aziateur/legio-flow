import React, { useMemo, useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { ChecklistItem, ChecklistRecurrence } from '../../types/schema';
import { CheckCircle2, Circle, Flame, ListChecks, Plus, Repeat, Trash2 } from 'lucide-react';

type ViewFilter = 'all' | 'recurring' | 'none';
type StreakUnit = 'd' | 'w' | 'm' | '';

interface SectionConfig {
  recurrence: ChecklistRecurrence;
  title: string;
  subtitle: string;
  badgeClass: string;
  accentBorder: string;
  streakUnit: StreakUnit;
  placeholder: string;
}

const SECTIONS: SectionConfig[] = [
  {
    recurrence: 'daily',
    title: 'Daily Recurring',
    subtitle: 'Resets every day • Drives Daily Auto Habits',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    accentBorder: 'border-emerald-500/20',
    streakUnit: 'd',
    placeholder: 'Add daily recurring task...'
  },
  {
    recurrence: 'weekly',
    title: 'Weekly Recurring',
    subtitle: 'Resets every week',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    accentBorder: 'border-amber-500/20',
    streakUnit: 'w',
    placeholder: 'Add weekly recurring task...'
  },
  {
    recurrence: 'monthly',
    title: 'Monthly Recurring',
    subtitle: 'Resets every calendar month',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    accentBorder: 'border-purple-500/20',
    streakUnit: 'm',
    placeholder: 'Add monthly recurring task...'
  },
  {
    recurrence: 'none',
    title: 'One-Off Tasks',
    subtitle: 'Non-recurring • Stays checked once done',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    accentBorder: 'border-slate-800',
    streakUnit: '',
    placeholder: 'Add one-off task...'
  }
];

function shiftDateStr(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftMonthStr(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(y) || Number.isNaN(m)) return monthKey;
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftWeekId(weekId: string, deltaWeeks: number): string | null {
  const match = /^week_(\d+)$/.exec(weekId);
  if (!match) return null;
  const next = parseInt(match[1], 10) + deltaWeeks;
  return next >= 1 ? `week_${next}` : null;
}

function getPeriodKey(recurrence: ChecklistRecurrence, selectedDate: string, selectedWeekId: string): string {
  if (recurrence === 'daily') return selectedDate;
  if (recurrence === 'weekly') return selectedWeekId;
  if (recurrence === 'monthly') return selectedDate.slice(0, 7);
  return '';
}

function stepPeriodKey(recurrence: ChecklistRecurrence, periodKey: string, delta: number): string | null {
  if (recurrence === 'daily') return shiftDateStr(periodKey, delta);
  if (recurrence === 'weekly') return shiftWeekId(periodKey, delta);
  if (recurrence === 'monthly') return shiftMonthStr(periodKey, delta);
  return null;
}

function computeStreak(
  item: ChecklistItem,
  selectedDate: string,
  selectedWeekId: string
): { count: number; unit: StreakUnit; completedCurrent: boolean } {
  const unit: StreakUnit =
    item.recurrence === 'daily' ? 'd' : item.recurrence === 'weekly' ? 'w' : item.recurrence === 'monthly' ? 'm' : '';

  if (item.recurrence === 'none') {
    return { count: 0, unit: '', completedCurrent: item.completed };
  }

  const periods = new Set(item.completedPeriods || []);
  const currentKey = getPeriodKey(item.recurrence, selectedDate, selectedWeekId);
  const completedCurrent = periods.has(currentKey);

  // Start at current period if checked, otherwise preserve unbroken streak ending at previous period.
  let cursor: string | null = completedCurrent
    ? currentKey
    : stepPeriodKey(item.recurrence, currentKey, -1);

  let count = 0;
  let guard = 0;
  while (cursor && periods.has(cursor) && guard < 3650) {
    count += 1;
    cursor = stepPeriodKey(item.recurrence, cursor, -1);
    guard += 1;
  }

  return { count, unit, completedCurrent };
}

export const ChecklistView: React.FC = () => {
  const {
    checklistItems,
    saveChecklistItems,
    selectedDate,
    selectedWeekId,
    saveDailyEntry
  } = useStorage();

  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [drafts, setDrafts] = useState<Record<ChecklistRecurrence, string>>({
    daily: '',
    weekly: '',
    monthly: '',
    none: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const monthKey = selectedDate.slice(0, 7);
  const weekLabel = selectedWeekId.replace('week_', 'Week ');

  const isItemDone = (item: ChecklistItem): boolean => {
    if (item.recurrence === 'none') return item.completed;
    const key = getPeriodKey(item.recurrence, selectedDate, selectedWeekId);
    return (item.completedPeriods || []).includes(key);
  };

  const syncDailyAutomaticHabits = (items: ChecklistItem[]) => {
    const dailyItems = items.filter((i) => i.recurrence === 'daily');
    if (dailyItems.length > 0) {
      const allDailyDone = dailyItems.every((i) => (i.completedPeriods || []).includes(selectedDate));
      saveDailyEntry(selectedDate, { automaticTasksCompleted: allDailyDone });
    }
  };

  const handleToggleItem = (itemId: string) => {
    const updated = checklistItems.map((item) => {
      if (item.id !== itemId) return item;
      if (item.recurrence === 'none') {
        return { ...item, completed: !item.completed };
      }
      const key = getPeriodKey(item.recurrence, selectedDate, selectedWeekId);
      const existing = item.completedPeriods || [];
      const nextPeriods = existing.includes(key)
        ? existing.filter((p) => p !== key)
        : [...existing, key];
      return { ...item, completedPeriods: nextPeriods };
    });

    saveChecklistItems(updated);
    syncDailyAutomaticHabits(updated);
  };

  const handleAddItem = (recurrence: ChecklistRecurrence, e: React.FormEvent) => {
    e.preventDefault();
    const text = (drafts[recurrence] || '').trim();
    if (!text) return;

    const newItem: ChecklistItem = {
      id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      categoryId: recurrence === 'none' ? 'cat_oneoff' : 'cat_recurring',
      text,
      recurrence,
      completed: false,
      completedPeriods: []
    };

    const updated = [...checklistItems, newItem];
    saveChecklistItems(updated);
    syncDailyAutomaticHabits(updated);
    setDrafts((prev) => ({ ...prev, [recurrence]: '' }));
  };

  const handleDeleteItem = (itemId: string) => {
    const updated = checklistItems.filter((item) => item.id !== itemId);
    saveChecklistItems(updated);
    syncDailyAutomaticHabits(updated);
  };

  const handleChangeRecurrence = (itemId: string, recurrence: ChecklistRecurrence) => {
    const updated = checklistItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            recurrence,
            categoryId: recurrence === 'none' ? 'cat_oneoff' : 'cat_recurring'
          }
        : item
    );
    saveChecklistItems(updated);
    syncDailyAutomaticHabits(updated);
  };

  const startEditing = (item: ChecklistItem) => {
    setEditingId(item.id);
    setEditingText(item.text);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const trimmed = editingText.trim();
    if (trimmed) {
      const updated = checklistItems.map((item) =>
        item.id === editingId ? { ...item, text: trimmed } : item
      );
      saveChecklistItems(updated);
    }
    setEditingId(null);
    setEditingText('');
  };

  const handleClearCompletedOneOffs = () => {
    const updated = checklistItems.filter((i) => !(i.recurrence === 'none' && i.completed));
    saveChecklistItems(updated);
  };

  const streaksById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeStreak>>();
    for (const item of checklistItems) {
      map.set(item.id, computeStreak(item, selectedDate, selectedWeekId));
    }
    return map;
  }, [checklistItems, selectedDate, selectedWeekId]);

  const bestActiveStreak = useMemo(() => {
    let best: { count: number; unit: StreakUnit } = { count: 0, unit: 'd' };
    for (const item of checklistItems) {
      if (item.recurrence === 'none') continue;
      const streak = streaksById.get(item.id);
      if (streak && streak.count > best.count) {
        best = { count: streak.count, unit: streak.unit };
      }
    }
    return best;
  }, [checklistItems, streaksById]);

  const totalCount = checklistItems.length;
  const doneCount = checklistItems.filter(isItemDone).length;
  const completedOneOffCount = checklistItems.filter((i) => i.recurrence === 'none' && i.completed).length;

  const recurringSections = SECTIONS.filter((s) => s.recurrence !== 'none');
  const oneOffSection = SECTIONS.find((s) => s.recurrence === 'none')!;

  const renderSectionCard = (section: SectionConfig) => {
    const items = checklistItems.filter((i) => i.recurrence === section.recurrence);
    const sectionDone = items.filter(isItemDone).length;

    return (
      <div
        key={section.recurrence}
        className={`flex flex-col rounded-xl border ${section.accentBorder} bg-slate-900/70 p-4 shadow-sm`}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-100">{section.title}</h2>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${section.badgeClass}`}>
                {sectionDone}/{items.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{section.subtitle}</p>
          </div>
        </div>

        <div className="flex-1 space-y-1.5">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 px-3 py-4 text-center text-xs text-slate-500">
              No tasks yet
            </div>
          ) : (
            items.map((item) => {
              const done = isItemDone(item);
              const streak = streaksById.get(item.id);
              const isEditing = editingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                    done
                      ? 'border-slate-800/70 bg-slate-950/40'
                      : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleItem(item.id)}
                    className="shrink-0 text-slate-400 transition-colors hover:text-emerald-400"
                    aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </button>

                  {isEditing ? (
                    <input
                      type="text"
                      value={editingText}
                      autoFocus
                      onChange={(e) => setEditingText(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') {
                          setEditingId(null);
                          setEditingText('');
                        }
                      }}
                      className="min-w-0 flex-1 rounded border border-amber-500/50 bg-slate-900 px-2 py-0.5 text-sm text-slate-100 outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditing(item)}
                      className={`min-w-0 flex-1 text-left text-sm ${
                        done ? 'text-slate-500 line-through' : 'text-slate-200'
                      }`}
                      title="Click to rename"
                    >
                      {item.text}
                    </button>
                  )}

                  {item.recurrence !== 'none' && streak && (
                    <span
                      title={
                        streak.count > 0
                          ? `${streak.count}${streak.unit} consecutive streak`
                          : 'No active streak yet'
                      }
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        streak.count > 0
                          ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                          : 'border-slate-800 bg-slate-900 text-slate-500'
                      }`}
                    >
                      <Flame className={`h-3 w-3 ${streak.count > 0 ? 'fill-amber-400 text-amber-400' : ''}`} />
                      {streak.count}
                      {streak.unit}
                    </span>
                  )}

                  <select
                    value={item.recurrence}
                    onChange={(e) => handleChangeRecurrence(item.id, e.target.value as ChecklistRecurrence)}
                    aria-label="Task recurrence"
                    className="shrink-0 rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-400 outline-none hover:border-slate-700 hover:text-slate-200"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="none">One-Off</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="shrink-0 text-slate-600 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={(e) => handleAddItem(section.recurrence, e)} className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={drafts[section.recurrence]}
            onChange={(e) =>
              setDrafts((prev) => ({
                ...prev,
                [section.recurrence]: e.target.value
              }))
            }
            placeholder={section.placeholder}
            className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500/50"
          />
          <button
            type="submit"
            disabled={!drafts[section.recurrence].trim()}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-200 transition-colors hover:border-amber-500/40 hover:bg-amber-500/15 hover:text-amber-300 disabled:opacity-40"
            aria-label={`Add ${section.title} task`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <ListChecks className="h-5 w-5 text-amber-400" />
            <h1 className="text-lg font-bold tracking-tight text-slate-100">Checklist</h1>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
              {doneCount} / {totalCount} Done
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
              <Flame className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              Best Streak: {bestActiveStreak.count > 0 ? `${bestActiveStreak.count}${bestActiveStreak.unit}` : '0'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {selectedDate} • {weekLabel} • {monthKey}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'recurring', label: 'Recurring' },
                { id: 'none', label: 'One-Off' }
              ] as { id: ViewFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewFilter(tab.id)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  viewFilter === tab.id
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {completedOneOffCount > 0 && (
            <button
              type="button"
              onClick={handleClearCompletedOneOffs}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-rose-500/40 hover:text-rose-300"
            >
              Clear Done One-Offs ({completedOneOffCount})
            </button>
          )}
        </div>
      </div>

      {/* Recurring Sections */}
      {viewFilter !== 'none' && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Repeat className="h-4 w-4 text-amber-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Recurring • Streaks
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {recurringSections.map(renderSectionCard)}
          </div>
        </section>
      )}

      {/* One-Off Section */}
      {viewFilter !== 'recurring' && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <CheckCircle2 className="h-4 w-4 text-slate-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              One-Off
            </h2>
          </div>
          {renderSectionCard(oneOffSection)}
        </section>
      )}
    </div>
  );
};
