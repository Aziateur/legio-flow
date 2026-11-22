import { ChecklistItem } from '../types/schema';

export interface WeekdayOption {
  value: number; // JS getDay(): 1=Mon..6=Sat, 0=Sun
  short: string;
  label: string;
}

export const WEEKDAY_OPTIONS: WeekdayOption[] = [
  { value: 1, short: 'Mon', label: 'Every Monday' },
  { value: 2, short: 'Tue', label: 'Every Tuesday' },
  { value: 3, short: 'Wed', label: 'Every Wednesday' },
  { value: 4, short: 'Thu', label: 'Every Thursday' },
  { value: 5, short: 'Fri', label: 'Every Friday' },
  { value: 6, short: 'Sat', label: 'Every Saturday' },
  { value: 0, short: 'Sun', label: 'Every Sunday' }
];

export const formatOrdinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export const MONTHLY_DAY_OPTIONS: Array<{ value: string; label: string }> = [
  ...Array.from({ length: 28 }, (_, i) => ({
    value: String(i + 1),
    label: formatOrdinal(i + 1)
  })),
  { value: 'last', label: 'Last day' }
];

// Monday = 0, Tuesday = 1, ..., Sunday = 6
export const toMondayIndex = (jsWeekday: number): number => (jsWeekday === 0 ? 6 : jsWeekday - 1);

export const getWeekdayShort = (jsWeekday: number): string =>
  WEEKDAY_OPTIONS.find(w => w.value === jsWeekday)?.short || '';

export const getChecklistPeriodKey = (
  recurrence: ChecklistItem['recurrence'],
  dateStr: string,
  weekId: string
): string => {
  if (recurrence === 'daily') return dateStr;
  if (recurrence === 'weekly') return weekId;
  if (recurrence === 'monthly') return dateStr.slice(0, 7);
  return '';
};

export const isChecklistItemDoneForPeriod = (
  item: ChecklistItem,
  dateStr: string,
  weekId: string
): boolean => {
  if (item.recurrence === 'none') return item.completed;
  if (item.recurrence === 'tally') {
    return (item.completedPeriods || []).includes(dateStr);
  }
  const key = getChecklistPeriodKey(item.recurrence, dateStr, weekId);
  return (item.completedPeriods || []).includes(key);
};

export const getChecklistScheduleLabel = (item: ChecklistItem): string | null => {
  if (item.recurrence === 'weekly' && typeof item.scheduleWeekday === 'number') {
    return getWeekdayShort(item.scheduleWeekday);
  }
  if (item.recurrence === 'monthly' && item.scheduleDayOfMonth !== undefined) {
    if (item.scheduleDayOfMonth === 'last') return 'Last day';
    return formatOrdinal(item.scheduleDayOfMonth);
  }
  return null;
};

export type ChecklistDueStatus = 'done' | 'due_today' | 'overdue' | 'upcoming' | 'anytime';

export const getChecklistDueStatus = (
  item: ChecklistItem,
  dateStr: string,
  weekId: string
): ChecklistDueStatus => {
  if (isChecklistItemDoneForPeriod(item, dateStr, weekId)) return 'done';

  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'anytime';

  if (item.recurrence === 'weekly' && typeof item.scheduleWeekday === 'number') {
    const curMonIdx = toMondayIndex(d.getDay());
    const targetMonIdx = toMondayIndex(item.scheduleWeekday);
    if (curMonIdx === targetMonIdx) return 'due_today';
    if (curMonIdx > targetMonIdx) return 'overdue';
    return 'upcoming';
  }

  if (item.recurrence === 'monthly' && item.scheduleDayOfMonth !== undefined) {
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
    const curDay = d.getDate();
    const targetDay =
      item.scheduleDayOfMonth === 'last'
        ? lastDayOfMonth
        : Math.min(Math.max(1, item.scheduleDayOfMonth), lastDayOfMonth);

    if (curDay === targetDay) return 'due_today';
    if (curDay > targetDay) return 'overdue';
    return 'upcoming';
  }

  return 'anytime';
};
