import React, { useMemo, useState } from 'react';
import {
  useStorage,
  getActiveDailyChecklistItemsForDate,
  getChecklistTrackingStartDate,
  getPriorityItemsForEntry,
  formatPriorityItemsToPlanNotes
} from '../../context/StorageContext';
import { ChecklistItem, ChecklistRecurrence } from '../../types/schema';
import {
  WEEKDAY_OPTIONS,
  MONTHLY_DAY_OPTIONS,
  getChecklistDueStatus
} from '../../lib/checklistSchedule';
import { AllowancesBoard } from './AllowancesBoard';
import { getLevelCapabilities } from '../../lib/levelFeatures';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Circle,
  Flame,
  Hash,
  ListChecks,
  Minus,
  Plus,
  Repeat,
  Timer,
  Trash2
} from 'lucide-react';

type ViewFilter = 'all' | 'recurring' | 'none' | 'tally' | 'allowances';
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

function computeConsistency(
  item: ChecklistItem,
  selectedDate: string,
  selectedWeekId: string,
  trackingStartFloor: string
): { pct: number; done: number; windowSize: number; unit: StreakUnit; completedCurrent: boolean } {
  const unit: StreakUnit =
    item.recurrence === 'daily'
      ? 'd'
      : item.recurrence === 'weekly'
      ? 'w'
      : item.recurrence === 'monthly'
      ? 'm'
      : '';

  if (item.recurrence === 'none' || item.recurrence === 'tally') {
    return { pct: 0, done: 0, windowSize: 0, unit: '', completedCurrent: item.completed };
  }

  const maxWindow = item.recurrence === 'daily' ? 14 : 6;
  const periods = new Set(item.completedPeriods || []);
  const currentKey = getPeriodKey(item.recurrence, selectedDate, selectedWeekId);
  const completedCurrent = periods.has(currentKey);

  // Build rolling window of recent period keys ending at currentKey
  const windowKeys: string[] = [];
  let cursor: string | null = currentKey;
  for (let i = 0; i < maxWindow && cursor; i++) {
    windowKeys.push(cursor);
    cursor = stepPeriodKey(item.recurrence, cursor, -1);
  }

  // Bound denominator by item's history/creation OR workspace start so pre-app days are NEVER counted as missed
  let effectiveWindow = windowKeys.length;
  if (item.recurrence === 'daily') {
    const createdDate =
      item.createdAt && /^\d{4}-\d{2}-\d{2}/.test(item.createdAt) ? item.createdAt.slice(0, 10) : '';
    const earliestCompleted = Array.from(periods)
      .filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p) && p <= selectedDate)
      .sort()[0];
    const startBound =
      createdDate && earliestCompleted
        ? createdDate < earliestCompleted
          ? createdDate
          : earliestCompleted
        : earliestCompleted || createdDate || trackingStartFloor;
    if (startBound && startBound <= selectedDate) {
      const idx = windowKeys.findIndex(k => k <= startBound);
      if (idx >= 0) {
        effectiveWindow = Math.max(1, idx + 1);
      }
    }
  } else if (item.recurrence === 'weekly') {
    const earliestWeekNum = Array.from(periods)
      .map(p => {
        const m = /^week_(\d+)$/.exec(p);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b)[0];
    const curMatch = /^week_(\d+)$/.exec(currentKey);
    const curNum = curMatch ? parseInt(curMatch[1], 10) : 1;
    if (earliestWeekNum !== undefined && earliestWeekNum <= curNum) {
      effectiveWindow = Math.min(windowKeys.length, Math.max(1, curNum - earliestWeekNum + 1));
    } else {
      const createdDate =
        item.createdAt && /^\d{4}-\d{2}-\d{2}/.test(item.createdAt) ? item.createdAt.slice(0, 10) : '';
      const boundDate = createdDate || trackingStartFloor;
      if (boundDate && boundDate <= selectedDate) {
        const diffDays = Math.max(
          0,
          Math.round(
            (new Date(`${selectedDate}T12:00:00`).getTime() -
              new Date(`${boundDate}T12:00:00`).getTime()) /
              86400000
          )
        );
        effectiveWindow = Math.min(windowKeys.length, Math.max(1, Math.floor(diffDays / 7) + 1));
      } else {
        effectiveWindow = 1;
      }
    }
  } else if (item.recurrence === 'monthly') {
    const earliestMonth = Array.from(periods)
      .filter(p => /^\d{4}-\d{2}$/.test(p) && p <= currentKey)
      .sort()[0];
    const boundMonth = earliestMonth || trackingStartFloor.slice(0, 7);
    if (boundMonth) {
      const idx = windowKeys.findIndex(k => k <= boundMonth);
      if (idx >= 0) effectiveWindow = Math.max(1, idx + 1);
    } else if (periods.size === 0) {
      effectiveWindow = 1;
    }
  }

  const scopedKeys = windowKeys.slice(0, Math.max(1, effectiveWindow));
  const done = scopedKeys.filter(k => periods.has(k)).length;
  const pct = scopedKeys.length > 0 ? Math.round((done / scopedKeys.length) * 100) : 0;

  return { pct, done, windowSize: scopedKeys.length, unit, completedCurrent };
}

/** Auto-detects volume per rep from titles like "5 min guitar session", "500ml water", "20 pages" */
function parseVolumeFromTitle(text: string): { volumePerRep?: number; volumeUnit?: string } {
  const match = text.match(
    /\b(\d+(?:\.\d+)?)\s*(mins?|minutes?|m|hrs?|hours?|h|ml|l|liters?|pages?|km|reps?|sets?|pushups?|pullups?|calls?)\b/i
  );
  if (!match) return {};
  const val = parseFloat(match[1]);
  if (Number.isNaN(val) || val <= 0) return {};
  const rawUnit = match[2].toLowerCase();
  let unit = rawUnit;
  if (rawUnit === 'm' || rawUnit === 'min' || rawUnit === 'mins' || rawUnit === 'minute' || rawUnit === 'minutes') {
    unit = 'min';
  } else if (rawUnit === 'h' || rawUnit === 'hr' || rawUnit === 'hrs' || rawUnit === 'hour' || rawUnit === 'hours') {
    unit = 'h';
  } else if (rawUnit === 'l' || rawUnit === 'liter' || rawUnit === 'liters') {
    unit = 'L';
  }
  return { volumePerRep: val, volumeUnit: unit };
}

function formatTotalVolume(count: number, perRep?: number, unit?: string): string | null {
  if (!perRep || perRep <= 0 || !unit) return null;
  const total = Math.round(count * perRep * 100) / 100;
  const normUnit = unit.trim().toLowerCase();
  if (normUnit === 'min' || normUnit === 'mins') {
    if (total >= 60) {
      return `${total} min (${(total / 60).toFixed(1)}h)`;
    }
    return `${total} min`;
  }
  if (normUnit === 'ml' && total >= 1000) {
    return `${(total / 1000).toFixed(1)} L`;
  }
  return `${total} ${unit.trim()}`;
}

export const ChecklistView: React.FC = () => {
  const {
    systemLevel,
    checklistItems,
    saveChecklistItems,
    dailyEntries,
    gwsSessions,
    todayDate,
    selectedDate,
    selectedWeekId,
    getEntryForDate,
    saveDailyEntry,
    setActiveTab,
    setPlanningSubTab
  } = useStorage();

  const caps = getLevelCapabilities(systemLevel);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const effectiveViewFilter: ViewFilter = !caps.repsBoard && viewFilter === 'tally' ? 'all' : viewFilter;
  const [drafts, setDrafts] = useState<Record<ChecklistRecurrence, string>>({
    daily: '',
    weekly: '',
    monthly: '',
    tally: '',
    none: ''
  });
  const [draftWeeklyDay, setDraftWeeklyDay] = useState<string>('');
  const [draftMonthlyDay, setDraftMonthlyDay] = useState<string>('');
  const [draftTallyVolume, setDraftTallyVolume] = useState('');
  const [draftTallyUnit, setDraftTallyUnit] = useState('');
  const [pulledDailyNotice, setPulledDailyNotice] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingCountId, setEditingCountId] = useState<string | null>(null);
  const [editingCountText, setEditingCountText] = useState('');
  const [editingVolId, setEditingVolId] = useState<string | null>(null);
  const [editingVolNum, setEditingVolNum] = useState('');
  const [editingVolUnit, setEditingVolUnit] = useState('');
  const [recentlyIncrementedId, setRecentlyIncrementedId] = useState<string | null>(null);

  const monthKey = selectedDate.slice(0, 7);
  const weekLabel = selectedWeekId.replace('week_', 'Week ');

  const currentDayEntry = getEntryForDate(selectedDate);
  const todayPriorities = getPriorityItemsForEntry(currentDayEntry);

  const isChecklistItemInDailyPlan = (item: ChecklistItem): boolean => {
    const norm = item.text.trim().toLowerCase();
    return todayPriorities.some(
      (p) => p.checklistItemId === item.id || (!!norm && p.text.trim().toLowerCase() === norm)
    );
  };

  const handlePullToDailyPlan = (item: ChecklistItem) => {
    const cleanText = item.text.trim();
    if (!cleanText) return;
    if (isChecklistItemInDailyPlan(item)) {
      setPlanningSubTab('daily');
      setActiveTab('planning');
      return;
    }
    const existingItems = getPriorityItemsForEntry(currentDayEntry);
    const doneNow = isItemDone(item);
    const updatedItems = [
      ...existingItems,
      {
        id: `prio_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: cleanText,
        completed: doneNow,
        checklistItemId: item.id
      }
    ];
    saveDailyEntry(selectedDate, {
      planNotes: formatPriorityItemsToPlanNotes(updatedItems),
      priorityItems: updatedItems,
      mainTasksCompleted: updatedItems.filter((i) => i.completed).length,
      mainTasksTotal: Math.max(3, updatedItems.length)
    });
    setPulledDailyNotice(`Pulled "${cleanText.slice(0, 36)}${cleanText.length > 36 ? '…' : ''}" into ${selectedDate} Daily Plan`);
    setTimeout(() => setPulledDailyNotice(null), 2800);
  };

  const handleChangeWeeklySchedule = (itemId: string, rawVal: string) => {
    const updated = checklistItems.map((item) => {
      if (item.id !== itemId) return item;
      if (rawVal === '') {
        const { scheduleWeekday: _w, ...rest } = item;
        return rest;
      }
      return { ...item, scheduleWeekday: parseInt(rawVal, 10) };
    });
    saveChecklistItems(updated);
  };

  const handleChangeMonthlySchedule = (itemId: string, rawVal: string) => {
    const updated = checklistItems.map((item) => {
      if (item.id !== itemId) return item;
      if (rawVal === '') {
        const { scheduleDayOfMonth: _m, ...rest } = item;
        return rest;
      }
      return {
        ...item,
        scheduleDayOfMonth: rawVal === 'last' ? ('last' as const) : parseInt(rawVal, 10)
      };
    });
    saveChecklistItems(updated);
  };

  const getTallyTotal = (item: ChecklistItem): number => {
    if (typeof item.totalCount === 'number' && !Number.isNaN(item.totalCount)) {
      return Math.max(0, Math.floor(item.totalCount));
    }
    return (item.completedPeriods || []).length;
  };

  const getTallyCountForSelectedDate = (item: ChecklistItem): number => {
    return (item.completedPeriods || []).filter((p) => p === selectedDate).length;
  };

  const isItemDone = (item: ChecklistItem): boolean => {
    if (item.recurrence === 'none') return item.completed;
    if (item.recurrence === 'tally') return getTallyCountForSelectedDate(item) > 0;
    const key = getPeriodKey(item.recurrence, selectedDate, selectedWeekId);
    return (item.completedPeriods || []).includes(key);
  };

  const syncDailyAutomaticHabits = (items: ChecklistItem[]) => {
    const activeDailyItems = getActiveDailyChecklistItemsForDate(
      selectedDate,
      items,
      dailyEntries,
      todayDate
    );
    if (activeDailyItems.length > 0) {
      const allDailyDone = activeDailyItems.every((i) => (i.completedPeriods || []).includes(selectedDate));
      saveDailyEntry(selectedDate, { automaticTasksCompleted: allDailyDone });
    }
  };

  const handleAdjustTally = (itemId: string, delta: 1 | -1) => {
    const updated = checklistItems.map((item) => {
      if (item.id !== itemId) return item;
      const curTotal = getTallyTotal(item);
      const nextTotal = Math.max(0, curTotal + delta);
      const periods = [...(item.completedPeriods || [])];
      if (delta === 1) {
        periods.push(selectedDate);
      } else if (curTotal > 0) {
        const idx = periods.lastIndexOf(selectedDate);
        if (idx !== -1) {
          periods.splice(idx, 1);
        } else if (periods.length > 0) {
          periods.pop();
        }
      }
      return {
        ...item,
        totalCount: nextTotal,
        completedPeriods: periods
      };
    });

    saveChecklistItems(updated);
    if (delta === 1) {
      setRecentlyIncrementedId(itemId);
      setTimeout(() => {
        setRecentlyIncrementedId((prev) => (prev === itemId ? null : prev));
      }, 450);
    }
  };

  const startEditingCount = (item: ChecklistItem) => {
    setEditingCountId(item.id);
    setEditingCountText(String(getTallyTotal(item)));
  };

  const commitEditCount = () => {
    if (!editingCountId) return;
    const parsed = parseInt(editingCountText.trim(), 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      const updated = checklistItems.map((item) =>
        item.id === editingCountId ? { ...item, totalCount: parsed } : item
      );
      saveChecklistItems(updated);
    }
    setEditingCountId(null);
    setEditingCountText('');
  };

  const startEditingVolume = (item: ChecklistItem) => {
    setEditingVolId(item.id);
    setEditingVolNum(item.volumePerRep ? String(item.volumePerRep) : '');
    setEditingVolUnit(item.volumeUnit || '');
  };

  const commitEditVolume = () => {
    if (!editingVolId) return;
    const parsedNum = parseFloat(editingVolNum.trim());
    const cleanUnit = editingVolUnit.trim();
    const updated = checklistItems.map((item) => {
      if (item.id !== editingVolId) return item;
      if (!Number.isNaN(parsedNum) && parsedNum > 0 && cleanUnit) {
        return { ...item, volumePerRep: parsedNum, volumeUnit: cleanUnit };
      }
      const { volumePerRep: _v, volumeUnit: _u, ...rest } = item;
      return rest;
    });
    saveChecklistItems(updated);
    setEditingVolId(null);
    setEditingVolNum('');
    setEditingVolUnit('');
  };

  const handleToggleItem = (itemId: string) => {
    const target = checklistItems.find((i) => i.id === itemId);
    if (target?.recurrence === 'tally') {
      handleAdjustTally(itemId, 1);
      return;
    }

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

    let volProps: { volumePerRep?: number; volumeUnit?: string } = {};
    if (recurrence === 'tally') {
      const manualNum = parseFloat(draftTallyVolume.trim());
      const manualUnit = draftTallyUnit.trim();
      if (!Number.isNaN(manualNum) && manualNum > 0 && manualUnit) {
        volProps = { volumePerRep: manualNum, volumeUnit: manualUnit };
      } else {
        volProps = parseVolumeFromTitle(text);
      }
    }

    const scheduleProps: Pick<ChecklistItem, 'scheduleWeekday' | 'scheduleDayOfMonth'> = {};
    if (recurrence === 'weekly' && draftWeeklyDay !== '') {
      scheduleProps.scheduleWeekday = parseInt(draftWeeklyDay, 10);
    }
    if (recurrence === 'monthly' && draftMonthlyDay !== '') {
      scheduleProps.scheduleDayOfMonth =
        draftMonthlyDay === 'last' ? 'last' : parseInt(draftMonthlyDay, 10);
    }

    const newItem: ChecklistItem = {
      id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      categoryId:
        recurrence === 'none'
          ? 'cat_oneoff'
          : recurrence === 'tally'
          ? 'cat_tally'
          : 'cat_recurring',
      text,
      recurrence,
      completed: false,
      completedPeriods: [],
      ...(recurrence === 'tally' ? { totalCount: 0, ...volProps } : {}),
      ...scheduleProps,
      createdAt: todayDate
    };

    const updated = [...checklistItems, newItem];
    saveChecklistItems(updated);
    syncDailyAutomaticHabits(updated);
    setDrafts((prev) => ({ ...prev, [recurrence]: '' }));
    if (recurrence === 'weekly') setDraftWeeklyDay('');
    if (recurrence === 'monthly') setDraftMonthlyDay('');
    if (recurrence === 'tally') {
      setDraftTallyVolume('');
      setDraftTallyUnit('');
    }
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
            categoryId:
              recurrence === 'none'
                ? 'cat_oneoff'
                : recurrence === 'tally'
                ? 'cat_tally'
                : 'cat_recurring',
            ...(recurrence === 'tally'
              ? {
                  totalCount: Math.max(item.totalCount || 0, (item.completedPeriods || []).length),
                  ...(item.volumePerRep ? {} : parseVolumeFromTitle(item.text))
                }
              : {}),
            ...(recurrence === 'daily' && item.recurrence !== 'daily' ? { createdAt: todayDate } : {})
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

  const trackingStartFloor = useMemo(
    () => getChecklistTrackingStartDate(checklistItems, dailyEntries, todayDate),
    [checklistItems, dailyEntries, todayDate]
  );

  const consistencyById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeConsistency>>();
    for (const item of checklistItems) {
      map.set(item.id, computeConsistency(item, selectedDate, selectedWeekId, trackingStartFloor));
    }
    return map;
  }, [checklistItems, selectedDate, selectedWeekId, trackingStartFloor]);

  const avgConsistencyPct = useMemo(() => {
    const scores: number[] = [];
    for (const item of checklistItems) {
      if (item.recurrence === 'none' || item.recurrence === 'tally') continue;
      const c = consistencyById.get(item.id);
      if (c && c.windowSize > 0) scores.push(c.pct);
    }
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [checklistItems, consistencyById]);

  const standardChecklistItems = checklistItems.filter((i) => i.recurrence !== 'tally');
  const tallyItems = checklistItems.filter((i) => i.recurrence === 'tally');
  const recurringItems = checklistItems.filter(
    (i) => i.recurrence === 'daily' || i.recurrence === 'weekly' || i.recurrence === 'monthly'
  );

  const totalCount = standardChecklistItems.length;
  const doneCount = standardChecklistItems.filter(isItemDone).length;
  const completedOneOffCount = checklistItems.filter((i) => i.recurrence === 'none' && i.completed).length;

  // --- REPS BOARD TELEMETRY (GWS + Regular Recurring Reps + Custom Anytime Reps) ---
  const gwsTotalCount = gwsSessions.length;
  const gwsTotalMinutes = gwsSessions.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);
  const gwsTotalHours = (gwsTotalMinutes / 60).toFixed(1);
  const gwsTodaySessions = gwsSessions.filter((s) => s.date === selectedDate);
  const gwsTodayMinutes = gwsTodaySessions.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);
  const gwsAvgScore =
    gwsTotalCount > 0
      ? (gwsSessions.reduce((acc, s) => acc + (s.ratings?.total || 0), 0) / gwsTotalCount).toFixed(1)
      : '0.0';

  const recurringVolumeRows = useMemo(() => {
    return checklistItems
      .filter((i) => i.recurrence === 'daily' || i.recurrence === 'weekly' || i.recurrence === 'monthly')
      .map((item) => ({
        item,
        count: new Set(item.completedPeriods || []).size,
        doneCurrent: isItemDone(item)
      }))
      .sort((a, b) => b.count - a.count);
  }, [checklistItems, selectedDate, selectedWeekId]);

  const totalRecurringReps = recurringVolumeRows.reduce((acc, r) => acc + r.count, 0);
  const maxRecurringReps = Math.max(1, ...recurringVolumeRows.map((r) => r.count));

  const totalTallyReps = tallyItems.reduce((acc, i) => acc + getTallyTotal(i), 0);
  const todayTallyReps = tallyItems.reduce((acc, i) => acc + getTallyCountForSelectedDate(i), 0);
  const maxTallyReps = Math.max(1, ...tallyItems.map((i) => getTallyTotal(i)));

  // Total time-based volume across custom reps (min/h) + GWS
  const tallyMinutesTotal = tallyItems.reduce((acc, item) => {
    const unit = (item.volumeUnit || '').trim().toLowerCase();
    const perRep = item.volumePerRep || 0;
    const count = getTallyTotal(item);
    if (perRep <= 0 || count <= 0) return acc;
    if (unit === 'min' || unit === 'mins') return acc + count * perRep;
    if (unit === 'h' || unit === 'hr' || unit === 'hrs') return acc + count * perRep * 60;
    return acc;
  }, 0);

  const totalCombinedReps = gwsTotalCount + totalRecurringReps + totalTallyReps;

  const recurringSections = SECTIONS.filter(
    (s) => s.recurrence === 'daily' || s.recurrence === 'weekly' || s.recurrence === 'monthly'
  );
  const oneOffSection = SECTIONS.find((s) => s.recurrence === 'none')!;

  const renderSectionCard = (section: SectionConfig) => {
    const items = checklistItems.filter((i) => i.recurrence === section.recurrence);
    const sectionDone = items.filter(isItemDone).length;
    const sectionConsistencyValues =
      section.recurrence !== 'none'
        ? items
            .map(i => consistencyById.get(i.id))
            .filter((c): c is NonNullable<typeof c> => Boolean(c && c.windowSize > 0))
            .map(c => c.pct)
        : [];
    const sectionAvgPct =
      sectionConsistencyValues.length > 0
        ? Math.round(
            sectionConsistencyValues.reduce((a, b) => a + b, 0) / sectionConsistencyValues.length
          )
        : null;

    return (
      <div
        key={section.recurrence}
        className={`flex flex-col rounded-xl border ${section.accentBorder} bg-slate-900/70 p-4 shadow-sm`}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-100">{section.title}</h2>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${section.badgeClass}`}>
                {sectionDone}/{items.length}
              </span>
              {sectionAvgPct !== null && (
                <span
                  className={`rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold ${
                    sectionAvgPct >= 80
                      ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                      : sectionAvgPct >= 60
                      ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                      : 'border-rose-500/30 bg-rose-500/15 text-rose-300'
                  }`}
                  title={`Average rolling consistency across ${section.title}`}
                >
                  Avg {sectionAvgPct}%
                </span>
              )}
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
              const consistency = consistencyById.get(item.id);
              const isEditing = editingId === item.id;
              const canPullToDaily =
                item.recurrence === 'weekly' ||
                item.recurrence === 'monthly' ||
                item.recurrence === 'none';
              const inDaily = canPullToDaily ? isChecklistItemInDailyPlan(item) : false;
              const dueStatus =
                item.recurrence === 'weekly' || item.recurrence === 'monthly'
                  ? getChecklistDueStatus(item, selectedDate, selectedWeekId)
                  : 'anytime';

              return (
                <div
                  key={item.id}
                  className={`group flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                    done
                      ? 'border-slate-800/70 bg-slate-950/40'
                      : dueStatus === 'due_today'
                      ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60'
                      : dueStatus === 'overdue'
                      ? 'border-rose-500/35 bg-rose-500/5 hover:border-rose-500/50'
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
                      className={`min-w-[120px] flex-1 text-left text-sm ${
                        done ? 'text-slate-500 line-through' : 'text-slate-200'
                      }`}
                      title="Click to rename"
                    >
                      <span>{item.text}</span>
                      {dueStatus === 'due_today' && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 align-middle">
                          Due Today
                        </span>
                      )}
                      {dueStatus === 'overdue' && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 align-middle">
                          Overdue
                        </span>
                      )}
                    </button>
                  )}

                  {/* Schedule Picker for Weekly (Mon–Sun) and Monthly (1st–28th / Last day) */}
                  {item.recurrence === 'weekly' && (
                    <select
                      value={typeof item.scheduleWeekday === 'number' ? String(item.scheduleWeekday) : ''}
                      onChange={(e) => handleChangeWeeklySchedule(item.id, e.target.value)}
                      aria-label="Scheduled weekday"
                      title="Schedule day of week (auto-surfaces in Daily Plan on that day)"
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold outline-none transition-colors ${
                        typeof item.scheduleWeekday === 'number'
                          ? 'border-amber-500/35 bg-amber-500/10 text-amber-300'
                          : 'border-slate-800 bg-slate-900 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <option value="">Any day</option>
                      {WEEKDAY_OPTIONS.map((w) => (
                        <option key={w.value} value={String(w.value)}>
                          {w.short}
                        </option>
                      ))}
                    </select>
                  )}

                  {item.recurrence === 'monthly' && (
                    <select
                      value={item.scheduleDayOfMonth !== undefined ? String(item.scheduleDayOfMonth) : ''}
                      onChange={(e) => handleChangeMonthlySchedule(item.id, e.target.value)}
                      aria-label="Scheduled day of month"
                      title="Schedule day of month (auto-surfaces in Daily Plan on that day)"
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold outline-none transition-colors ${
                        item.scheduleDayOfMonth !== undefined
                          ? 'border-purple-500/35 bg-purple-500/10 text-purple-300'
                          : 'border-slate-800 bg-slate-900 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      <option value="">Any day</option>
                      {MONTHLY_DAY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* 1-Click Pull to Daily Plan Button (Weekly, Monthly & One-Off) */}
                  {canPullToDaily && (
                    <button
                      type="button"
                      onClick={() => handlePullToDailyPlan(item)}
                      title={
                        inDaily
                          ? `In ${selectedDate} Daily Plan — click to open Daily Plan`
                          : `Pull into ${selectedDate} Daily Plan`
                      }
                      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                        inDaily
                          ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                          : 'border-amber-500/30 bg-slate-900 text-amber-300 hover:bg-amber-500/15'
                      }`}
                    >
                      {!inDaily && <ArrowDownToLine className="h-2.5 w-2.5" />}
                      <span>{inDaily ? `✓ In ${selectedDate.slice(5)}` : `+ Day`}</span>
                    </button>
                  )}

                  {item.recurrence !== 'none' && consistency && consistency.windowSize > 0 && (
                    <span
                      title={`Rolling consistency: ${consistency.done}/${consistency.windowSize}${consistency.unit} (${consistency.pct}%) — missing 1 day dips % instead of resetting to 0`}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold ${
                        consistency.pct >= 80
                          ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                          : consistency.pct >= 60
                          ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                          : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                      }`}
                    >
                      <span>{consistency.pct}%</span>
                      <span className="text-[10px] opacity-75">
                        ({consistency.done}/{consistency.windowSize}{consistency.unit})
                      </span>
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
                    {caps.repsBoard && <option value="tally">Reps Board</option>}
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
          {section.recurrence === 'weekly' && (
            <select
              value={draftWeeklyDay}
              onChange={(e) => setDraftWeeklyDay(e.target.value)}
              aria-label="Default weekday for new weekly task"
              title="Optional: pick a weekday (e.g. Mon or Sun)"
              className="shrink-0 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs font-semibold text-slate-300 outline-none focus:border-amber-500/50"
            >
              <option value="">Any day</option>
              {WEEKDAY_OPTIONS.map((w) => (
                <option key={w.value} value={String(w.value)}>
                  {w.short}
                </option>
              ))}
            </select>
          )}
          {section.recurrence === 'monthly' && (
            <select
              value={draftMonthlyDay}
              onChange={(e) => setDraftMonthlyDay(e.target.value)}
              aria-label="Default day of month for new monthly task"
              title="Optional: pick a day of the month (e.g. 1st or Last day)"
              className="shrink-0 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs font-semibold text-slate-300 outline-none focus:border-purple-500/50"
            >
              <option value="">Any day</option>
              {MONTHLY_DAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
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
    <div className="w-full max-w-[1680px] mx-auto space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Bar */}
      {pulledDailyNotice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-300">
          <span className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>✓ {pulledDailyNotice}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setPlanningSubTab('daily');
              setActiveTab('planning');
            }}
            className="shrink-0 underline hover:text-emerald-200"
          >
            Open Daily Plan →
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <ListChecks className="h-5 w-5 text-amber-400" />
            <h1 className="text-lg font-bold tracking-tight text-slate-100">
              {caps.repsBoard ? 'Checklist & Reps Board' : 'Checklist & Allowances'}
            </h1>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
              {doneCount} / {totalCount} Done
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold font-mono ${
                avgConsistencyPct >= 80
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                  : avgConsistencyPct >= 60
                  ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                  : 'border-rose-500/30 bg-rose-500/15 text-rose-300'
              }`}
              title="Average rolling consistency across your recurring habits (replaces brittle reset-to-zero streaks)"
            >
              <Flame className="h-3.5 w-3.5" />
              Consistency: {avgConsistencyPct}%
            </span>
            {caps.repsBoard && (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2.5 py-0.5 text-xs font-semibold text-cyan-300 font-mono">
                <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
                {totalCombinedReps} Total Reps
              </span>
            )}
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
                { id: 'none', label: 'One-Off' },
                ...(caps.repsBoard ? [{ id: 'tally' as const, label: 'Reps Board' }] : []),
                { id: 'allowances', label: 'Allowances' }
              ] as { id: ViewFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewFilter(tab.id)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  effectiveViewFilter === tab.id
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

      {/* 1. Recurring Sections (Daily / Weekly / Monthly with Rolling Consistency %) */}
      {(effectiveViewFilter === 'all' || effectiveViewFilter === 'recurring') && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Repeat className="h-4 w-4 text-amber-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Recurring • Rolling Consistency %
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {recurringSections.map(renderSectionCard)}
          </div>
        </section>
      )}

      {/* 2. One-Off Section */}
      {(effectiveViewFilter === 'all' || effectiveViewFilter === 'none') && (
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

      {/* 3. REPS BOARD — Mini Volume Dashboard below Checklist (LVL 2+: GWS + Regular Habit Reps + Anytime Reps) */}
      {caps.repsBoard && (effectiveViewFilter === 'all' || effectiveViewFilter === 'tally') && (
        <section className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Reps Board • Lifetime Volume Dashboard
              </h2>
              <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                Hidden from Weeks Matrix
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
              <span>
                Combined: <strong className="text-slate-100">{totalCombinedReps}</strong> reps
              </span>
              {tallyMinutesTotal + gwsTotalMinutes > 0 && (
                <>
                  <span className="text-slate-700">•</span>
                  <span>
                    Timed Volume:{' '}
                    <strong className="text-amber-300">
                      {((tallyMinutesTotal + gwsTotalMinutes) / 60).toFixed(1)}h
                    </strong>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Dashboard Container */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5 shadow-lg space-y-5">

            {/* Top Row: GWS Deep Work Volume + Regular Recurring Habit Volumes */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

              {/* GWS Sprints Volume Card */}
              <div className="lg:col-span-5 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-slate-950 via-slate-950 to-amber-950/15 p-4 flex flex-col justify-between gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25">
                      <Timer className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        GWS Sprints Done
                      </div>
                      <div className="text-[11px] text-slate-400">Deep work sessions volume</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('gws')}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20 transition-colors"
                  >
                    <span>GWS Studio</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Sprints</div>
                    <div className="text-2xl font-extrabold font-mono text-amber-400 mt-0.5">
                      {gwsTotalCount}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {gwsTodaySessions.length > 0 ? `+${gwsTodaySessions.length} today` : '0 today'}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Volume</div>
                    <div className="text-2xl font-extrabold font-mono text-slate-100 mt-0.5">
                      {gwsTotalHours}h
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {gwsTotalMinutes} min total
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Avg Quality</div>
                    <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-0.5">
                      {gwsAvgScore}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      out of 15{gwsTodayMinutes > 0 ? ` • ${gwsTodayMinutes}m` : ''}
                    </div>
                  </div>
                </div>
              </div>

              {/* Regular Recurring Habit Volumes Card */}
              <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Regular Habit Volume
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Auto-counted from your Daily, Weekly & Monthly checklist items
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300">
                    {totalRecurringReps} reps
                  </span>
                </div>

                {recurringVolumeRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
                    Add recurring items above to track their lifetime volume here.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {recurringVolumeRows.map(({ item, count }) => {
                      const pct = Math.max(count > 0 ? 8 : 0, Math.round((count / maxRecurringReps) * 100));
                      const barColor =
                        item.recurrence === 'daily'
                          ? 'bg-emerald-400'
                          : item.recurrence === 'weekly'
                          ? 'bg-amber-400'
                          : 'bg-purple-400';
                      const tagColor =
                        item.recurrence === 'daily'
                          ? 'text-emerald-400'
                          : item.recurrence === 'weekly'
                          ? 'text-amber-400'
                          : 'text-purple-400';

                      return (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-2 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate font-medium text-slate-200" title={item.text}>
                              {item.text}
                            </span>
                            <span className={`shrink-0 font-mono font-bold ${tagColor}`}>
                              {count}×
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-950 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row: Custom Anytime Reps Bento Tiles (Volumes per Rep) */}
            <div className="space-y-3 pt-1 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Anytime Reps • Volumes per Rep ({tallyItems.length})
                  </h3>
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-200">
                    {totalTallyReps} total
                  </span>
                  {todayTallyReps > 0 && (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                      +{todayTallyReps} today
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500">
                  Click any count or unit to edit • Never resets
                </span>
              </div>

              {tallyItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-cyan-500/25 bg-slate-950/50 px-4 py-6 text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-300">
                    No anytime reps yet
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Add anything below like <span className="font-mono text-cyan-300">&quot;5 min guitar session&quot;</span>,{' '}
                    <span className="font-mono text-cyan-300">&quot;20 min guitar session&quot;</span>, or{' '}
                    <span className="font-mono text-cyan-300">&quot;Hydrate&quot;</span> — volumes per rep auto-calculate!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {tallyItems.map((item) => {
                    const tallyTotal = getTallyTotal(item);
                    const tallyToday = getTallyCountForSelectedDate(item);
                    const justBumped = recentlyIncrementedId === item.id;
                    const isEditing = editingId === item.id;
                    const barPct = Math.max(
                      tallyTotal > 0 ? 8 : 0,
                      Math.round((tallyTotal / maxTallyReps) * 100)
                    );
                    const totalVolLabel = formatTotalVolume(tallyTotal, item.volumePerRep, item.volumeUnit);

                    return (
                      <div
                        key={item.id}
                        className={`group rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition-all ${
                          justBumped
                            ? 'border-emerald-400/70 bg-emerald-500/10 shadow-md shadow-emerald-500/10'
                            : 'border-slate-800 bg-slate-950/90 hover:border-cyan-500/35'
                        }`}
                      >
                        {/* Tile Header: Name + Today pill + Delete */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
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
                                className="w-full rounded border border-cyan-500/50 bg-slate-900 px-2 py-0.5 text-sm font-semibold text-slate-100 outline-none"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditing(item)}
                                className="w-full text-left text-sm font-bold text-slate-100 hover:text-cyan-200 transition-colors leading-snug"
                                title="Click to rename"
                              >
                                {item.text}
                              </button>
                            )}

                            {/* Volume per Rep / Total Volume chip */}
                            {editingVolId === item.id ? (
                              <div className="mt-1.5 flex items-center gap-1">
                                <input
                                  type="number"
                                  step="any"
                                  min={0}
                                  value={editingVolNum}
                                  onChange={(e) => setEditingVolNum(e.target.value)}
                                  placeholder="5"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitEditVolume();
                                    if (e.key === 'Escape') setEditingVolId(null);
                                  }}
                                  className="w-14 rounded border border-cyan-500/50 bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-slate-100 outline-none"
                                />
                                <input
                                  type="text"
                                  value={editingVolUnit}
                                  onChange={(e) => setEditingVolUnit(e.target.value)}
                                  placeholder="min / ml"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitEditVolume();
                                    if (e.key === 'Escape') setEditingVolId(null);
                                  }}
                                  className="w-16 rounded border border-cyan-500/50 bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-slate-100 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={commitEditVolume}
                                  className="rounded bg-cyan-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-950"
                                >
                                  OK
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditingVolume(item)}
                                title="Click to set or edit volume per rep (e.g. 5 min, 500 ml)"
                                className="mt-1 inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-colors"
                              >
                                {item.volumePerRep && item.volumeUnit ? (
                                  <>
                                    <span className="text-slate-500">
                                      {item.volumePerRep} {item.volumeUnit}/rep
                                    </span>
                                    <span className="text-slate-700">→</span>
                                    <span className="font-bold text-cyan-300">{totalVolLabel}</span>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-slate-600 hover:text-cyan-400">
                                    + Set vol/rep
                                  </span>
                                )}
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {tallyToday > 0 && (
                              <span
                                className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300"
                                title={`Done ${tallyToday}× on ${selectedDate}`}
                              >
                                +{tallyToday}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1 text-slate-600 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                              aria-label="Delete rep"
                              title="Delete rep"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Center Volume Display + Proportional Bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-baseline justify-between">
                            {editingCountId === item.id ? (
                              <input
                                type="number"
                                min={0}
                                value={editingCountText}
                                autoFocus
                                onChange={(e) => setEditingCountText(e.target.value)}
                                onBlur={commitEditCount}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitEditCount();
                                  if (e.key === 'Escape') {
                                    setEditingCountId(null);
                                    setEditingCountText('');
                                  }
                                }}
                                className="w-20 rounded border border-cyan-500/60 bg-slate-900 px-2 py-0.5 font-mono text-xl font-extrabold text-cyan-200 outline-none"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditingCount(item)}
                                title="Click to edit starting/total count directly"
                                className="flex items-baseline gap-1.5 group/count"
                              >
                                <span className="font-mono text-3xl font-extrabold tracking-tight text-cyan-300 group-hover/count:text-cyan-200">
                                  {tallyTotal}
                                </span>
                                <span className="text-xs font-medium text-slate-400">
                                  {tallyTotal === 1 ? 'time' : 'times'}
                                </span>
                              </button>
                            )}

                            <select
                              value={item.recurrence}
                              onChange={(e) =>
                                handleChangeRecurrence(item.id, e.target.value as ChecklistRecurrence)
                              }
                              aria-label="Move category"
                              className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-500 outline-none hover:border-slate-700 hover:text-slate-300"
                            >
                              <option value="tally">Reps Board</option>
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="none">One-Off</option>
                            </select>
                          </div>

                          <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Bottom Tactile +1 / -1 Controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAdjustTally(item.id, 1)}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-extrabold transition-all active:scale-95 ${
                              justBumped
                                ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                                : 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+1 Rep</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAdjustTally(item.id, -1)}
                            disabled={tallyTotal === 0}
                            title="Undo (-1)"
                            className="rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-2 text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200 disabled:opacity-30"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Inline Add New Rep Bar */}
              <form
                onSubmit={(e) => handleAddItem('tally', e)}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1"
              >
                <input
                  type="text"
                  value={drafts.tally}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, tally: e.target.value }))}
                  placeholder="Add rep tracker (e.g. 5 min guitar session, 20 min guitar session, Hydrate)..."
                  className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500/50"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={draftTallyVolume}
                    onChange={(e) => setDraftTallyVolume(e.target.value)}
                    placeholder="Vol/rep"
                    title="Optional: volume per rep (auto-detected if in name, e.g. '5 min')"
                    className="w-24 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500/50"
                  />
                  <input
                    type="text"
                    value={draftTallyUnit}
                    onChange={(e) => setDraftTallyUnit(e.target.value)}
                    placeholder="Unit (min)"
                    title="Optional: unit label (min, ml, pages, km...)"
                    className="w-24 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500/50"
                  />
                  <button
                    type="submit"
                    disabled={!drafts.tally.trim()}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-4 py-2 text-xs font-extrabold text-slate-950 transition-colors disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Rep</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* 4. ALLOWANCES & QUOTAS BOARD — Daily / Weekly / Monthly Countdown Budgets (Available from LVL 1+) */}
      {(effectiveViewFilter === 'all' || effectiveViewFilter === 'allowances') && (
        <AllowancesBoard
          selectedDate={selectedDate}
          selectedWeekId={selectedWeekId}
          weekLabel={weekLabel}
          monthKey={monthKey}
        />
      )}
    </div>
  );
};
