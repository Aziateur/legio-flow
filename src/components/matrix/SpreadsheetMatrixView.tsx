import React, { useState, useMemo, useRef } from 'react';
import {
  useStorage,
  getCurrentWeekRange,
  getChecklistTrackingStartDate,
  getDailyChecklistStatusForDate,
  DailyChecklistDayState
} from '../../context/StorageContext';
import { WeeklyPlan } from '../../types/schema';
import {
  Table,
  Timer,
  ArrowRight,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Crosshair
} from 'lucide-react';

const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const formatLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface MatrixWeekRow {
  rowKey: string;
  calendarWeekNum: number;
  plan?: WeeklyPlan;
  label: string;
  shortLabel: string;
  focus: string;
  monthBadge?: string;
  isCurrentWeek: boolean;
  startDate: string;
  endDate: string;
  days: string[];
}

function buildFullYearCalendarWeeks(
  year: number,
  plansByStartDate: Map<string, WeeklyPlan>,
  todayDate: string
): MatrixWeekRow[] {
  const jan1 = new Date(year, 0, 1, 12, 0, 0);
  const jan1Range = getCurrentWeekRange(formatLocalDate(jan1));
  const cursor = new Date(`${jan1Range.startDate}T12:00:00`);
  const yearEndStr = `${year}-12-31`;

  const rows: MatrixWeekRow[] = [];
  let lastMonthSeen = -1;
  let calWeekNum = 1;

  while (formatLocalDate(cursor) <= yearEndStr && calWeekNum <= 54) {
    const startStr = formatLocalDate(cursor);
    const range = getCurrentWeekRange(startStr);
    const matchedPlan = plansByStartDate.get(startStr);
    const isCurrentWeek = range.days.includes(todayDate);

    // Determine which month of the target year this week represents (using first day inside target year or Thursday)
    const anchorDay = range.days.find(d => d.startsWith(`${year}-`)) || range.days[3];
    const monthIdx = parseInt(anchorDay.slice(5, 7), 10) - 1;
    const monthBadge = monthIdx !== lastMonthSeen && monthIdx >= 0 && monthIdx < 12
      ? MONTH_SHORT[monthIdx]
      : undefined;
    if (monthBadge) {
      lastMonthSeen = monthIdx;
    }

    const isEmpty = !matchedPlan || (matchedPlan.tasks.length === 0 && !matchedPlan.focusTheme.trim());

    rows.push({
      rowKey: matchedPlan ? matchedPlan.id : `cal_${year}_w${calWeekNum}_${startStr}`,
      calendarWeekNum: calWeekNum,
      plan: matchedPlan,
      label: matchedPlan
        ? `Week ${matchedPlan.weekNumber}${isCurrentWeek ? ' (Current)' : ''}`
        : `Cal W${calWeekNum}${isCurrentWeek ? ' (Current)' : ''}`,
      shortLabel: matchedPlan ? `W${matchedPlan.weekNumber}` : `W${calWeekNum}`,
      focus: matchedPlan?.focusTheme?.trim() || (isEmpty ? '— No Weekly Plan —' : 'Weekly Execution'),
      monthBadge,
      isCurrentWeek,
      startDate: range.startDate,
      endDate: range.endDate,
      days: range.days
    });

    cursor.setDate(cursor.getDate() + 7);
    calWeekNum += 1;
  }

  return rows;
}

export const SpreadsheetMatrixView: React.FC = () => {
  const {
    todayDate,
    dailyEntries,
    weeklyPlans,
    gwsSessions,
    checklistItems,
    setSelectedDate,
    setSelectedWeekId,
    setActiveTab,
    setPlanningSubTab
  } = useStorage();

  const currentYearNum = parseInt(todayDate.slice(0, 4), 10) || 2026;
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed');
  const [scopeMode, setScopeMode] = useState<'full_year' | 'active_only'>('active_only');
  const [selectedYear, setSelectedYear] = useState<number>(currentYearNum);
  const currentWeekRowRef = useRef<HTMLTableRowElement | null>(null);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const trackingStartDate = useMemo(
    () => getChecklistTrackingStartDate(checklistItems, dailyEntries, todayDate),
    [checklistItems, dailyEntries, todayDate]
  );

  // Map weeklyPlans by Monday startDate for O(1) lookup across any full calendar year
  const plansByStartDate = useMemo(() => {
    const map = new Map<string, WeeklyPlan>();
    Object.values(weeklyPlans).forEach(wp => {
      const range = getCurrentWeekRange(wp.startDate);
      map.set(range.startDate, wp);
    });
    return map;
  }, [weeklyPlans]);

  // Full 52/53-week calendar year rows
  const fullYearWeeks = useMemo(
    () => buildFullYearCalendarWeeks(selectedYear, plansByStartDate, todayDate),
    [selectedYear, plansByStartDate, todayDate]
  );

  // Active-only weeks (weeks that have real data OR fall on/after tracking start)
  const activeOnlyWeeks = useMemo(() => {
    const hasActivityInWeek = (row: MatrixWeekRow) => {
      if (row.isCurrentWeek) return true;
      if (row.plan && (row.plan.tasks.length > 0 || row.plan.focusTheme.trim().length > 0)) {
        return true;
      }
      return row.days.some(d => {
        const entry = dailyEntries[d];
        const hasEntry = Boolean(
          entry &&
            (entry.executionScore > 0 ||
              entry.mainTasksCompleted > 0 ||
              entry.automaticTasksCompleted ||
              (entry.planNotes && entry.planNotes.trim().length > 0) ||
              (entry.priorityItems && entry.priorityItems.some(p => p.text.trim().length > 0)) ||
              (entry.reviewNotes && entry.reviewNotes.trim().length > 0))
        );
        const hasGws = gwsSessions.some(s => s.date === d);
        return hasEntry || hasGws || (d >= trackingStartDate && d <= todayDate);
      });
    };

    const filtered = fullYearWeeks.filter(hasActivityInWeek);
    return filtered.length > 0 ? filtered : fullYearWeeks.filter(w => w.isCurrentWeek);
  }, [fullYearWeeks, dailyEntries, gwsSessions, trackingStartDate, todayDate]);

  const displayedWeeks = scopeMode === 'full_year' ? fullYearWeeks : activeOnlyWeeks;

  // Compute coherent checklist consistency strictly over tracked days inside the selected year/scope
  const consistencyStats = useMemo(() => {
    const seen = new Set<string>();
    let done = 0;
    let missed = 0;
    let pendingToday = false;

    displayedWeeks.forEach(week => {
      week.days.forEach(dStr => {
        if (seen.has(dStr)) return;
        if (scopeMode === 'full_year' && !dStr.startsWith(`${selectedYear}-`)) return;
        seen.add(dStr);
        const st = getDailyChecklistStatusForDate(dStr, checklistItems, dailyEntries, todayDate);
        if (st.state === 'done') done += 1;
        else if (st.state === 'missed') missed += 1;
        else if (st.state === 'pending_today') pendingToday = true;
      });
    });

    const denominator = done + missed;
    const pct = denominator > 0 ? Math.round((done / denominator) * 100) : null;
    return { done, missed, pendingToday, pct };
  }, [displayedWeeks, scopeMode, selectedYear, checklistItems, dailyEntries, todayDate]);

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setActiveTab('planning');
    setPlanningSubTab('daily');
  };

  const handleWeekClick = (week: MatrixWeekRow) => {
    if (week.plan) {
      setSelectedWeekId(week.plan.id);
      setActiveTab('planning');
      setPlanningSubTab('weekly');
    } else {
      setSelectedDate(week.startDate);
      setActiveTab('planning');
      setPlanningSubTab('daily');
    }
  };

  const scrollToCurrentWeek = () => {
    if (selectedYear !== currentYearNum) {
      setSelectedYear(currentYearNum);
      setTimeout(() => {
        currentWeekRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    } else {
      currentWeekRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
    if (score >= 6) return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    if (score > 0) return 'text-orange-400 bg-orange-500/15 border-orange-500/30';
    return 'text-slate-500 bg-slate-900 border-slate-800';
  };

  const getDotClass = (state: DailyChecklistDayState, size: 'sm' | 'md' = 'md') => {
    const dim = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
    switch (state) {
      case 'done':
        return `${dim} rounded-full shrink-0 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]`;
      case 'missed':
        return `${dim} rounded-full shrink-0 bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]`;
      case 'pending_today':
        return `${dim} rounded-full shrink-0 bg-amber-400 ring-2 ring-amber-400/35`;
      case 'untracked':
        return `${dim} rounded-full shrink-0 bg-slate-700/80`;
      case 'upcoming':
        return `${dim} rounded-full shrink-0 border border-slate-700 bg-transparent`;
    }
  };

  const getStatusLabel = (state: DailyChecklistDayState) => {
    switch (state) {
      case 'done':
        return 'Checklist Done';
      case 'missed':
        return 'Missed';
      case 'pending_today':
        return 'Today Pending';
      case 'untracked':
        return 'Not Tracked';
      case 'upcoming':
        return 'Upcoming';
    }
  };

  return (
    <div className="space-y-6">

      {/* Spreadsheet Header Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                Macro Spreadsheet Matrix
              </span>
              <h2 className="text-xl font-extrabold text-slate-100">
                {selectedYear} Calendar Grid: Weeks, GWS & Daily Checklist Consistency
              </h2>
              <p className="text-xs text-slate-400">
                Checklist tracking starts on <span className="font-mono text-slate-200">{trackingStartDate}</span> — days before you started or before a habit was added are never marked missed.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Consistency Summary Pill */}
            <div className="flex items-center space-x-3 px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono">
              <span className="inline-flex items-center space-x-1.5 text-emerald-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                <span>{consistencyStats.done} Done</span>
              </span>
              <span className="text-slate-700">|</span>
              <span className="inline-flex items-center space-x-1.5 text-rose-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]" />
                <span>{consistencyStats.missed} Missed</span>
              </span>
              {consistencyStats.pendingToday && (
                <>
                  <span className="text-slate-700">|</span>
                  <span className="inline-flex items-center space-x-1 text-amber-300 font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Today</span>
                  </span>
                </>
              )}
              <span className="text-slate-700">|</span>
              <span className="text-amber-400 font-extrabold">
                {consistencyStats.pct !== null ? `${consistencyStats.pct}% Consistent` : 'Just Started'}
              </span>
            </div>

            {/* Coherent Dot Legend */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-400">
              <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Done</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Missed</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Today</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800 font-bold">
                <span className="w-2 h-2 rounded-full bg-slate-700" />
                <span>Not Tracked</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-950 text-slate-500 border border-slate-800 font-bold">
                <span className="w-2 h-2 rounded-full border border-slate-600" />
                <span>Upcoming</span>
              </span>
            </div>
          </div>
        </div>

        {/* Year Navigation, Scope & View Mode Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            {/* Year Stepper */}
            <div className="flex items-center space-x-1 p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedYear(y => y - 1)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                title="Previous Year"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2.5 text-xs font-mono font-extrabold text-amber-400">
                {selectedYear}
              </span>
              <button
                type="button"
                onClick={() => setSelectedYear(y => y + 1)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                title="Next Year"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Scope Toggle: Full Year (52-53w) vs Active Weeks Only */}
            <div className="flex items-center space-x-1 p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setScopeMode('full_year')}
                className={`px-3 py-1 rounded-xl text-xs font-bold font-mono transition-all ${
                  scopeMode === 'full_year'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Full Year ({fullYearWeeks.length}w)
              </button>
              <button
                type="button"
                onClick={() => setScopeMode('active_only')}
                className={`px-3 py-1 rounded-xl text-xs font-bold font-mono transition-all ${
                  scopeMode === 'active_only'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Active Only ({activeOnlyWeeks.length}w)
              </button>
            </div>

            <button
              type="button"
              onClick={scrollToCurrentWeek}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800 text-xs font-bold transition-colors"
              title="Scroll to current week"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Jump to Today</span>
            </button>
          </div>

          {/* Detailed vs Compact Year Map Toggle */}
          <div className="flex items-center space-x-1 p-1 rounded-2xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('detailed')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'detailed'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Detailed</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('compact');
                setScopeMode('full_year');
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'compact'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Year Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* Compact Year Map View (All 52–53 Weeks Scannable on One Screen) */}
      {viewMode === 'compact' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] uppercase font-extrabold text-slate-400 tracking-wider">
                  <th className="py-2.5 px-3 min-w-[165px]">Month & Week</th>
                  {daysOfWeek.map(dayName => (
                    <th key={dayName} className="py-2.5 px-1.5 min-w-[96px] text-center border-l border-slate-800/70">
                      {dayName}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 min-w-[130px] text-right border-l border-slate-800">
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-[11px]">
                {displayedWeeks.map(week => {
                  const achievedScore = week.plan?.achievedScore || 0;
                  const totalPoints = week.plan?.totalPossibleScore || 10;
                  const weekStatuses = week.days.map(d =>
                    getDailyChecklistStatusForDate(d, checklistItems, dailyEntries, todayDate)
                  );
                  const weekDoneCount = weekStatuses.filter(s => s.state === 'done').length;
                  const weekTrackedCount = weekStatuses.filter(
                    s => s.state === 'done' || s.state === 'missed'
                  ).length;
                  const weekGwsCount = gwsSessions.filter(
                    s => s.date >= week.startDate && s.date <= week.endDate
                  ).length;

                  return (
                    <tr
                      key={week.rowKey}
                      ref={week.isCurrentWeek ? currentWeekRowRef : undefined}
                      className={`hover:bg-slate-800/35 transition-colors ${
                        week.isCurrentWeek
                          ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/30'
                          : week.monthBadge
                          ? 'border-t border-slate-700/80'
                          : ''
                      }`}
                    >
                      {/* Compact Month + Week Label */}
                      <td
                        onClick={() => handleWeekClick(week)}
                        className="py-1.5 px-3 bg-slate-950/40 cursor-pointer hover:bg-slate-800/60 transition-colors"
                        title={`${week.label} (${week.startDate} → ${week.endDate}) — ${week.focus}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span
                              className={`w-8 text-[9px] font-mono font-extrabold tracking-wider shrink-0 ${
                                week.monthBadge ? 'text-amber-300' : 'text-transparent select-none'
                              }`}
                            >
                              {week.monthBadge || '---'}
                            </span>
                            <span
                              className={`font-mono font-extrabold ${
                                week.isCurrentWeek
                                  ? 'text-amber-400'
                                  : week.plan
                                  ? 'text-slate-200'
                                  : 'text-slate-500'
                              }`}
                            >
                              {week.shortLabel}
                              {week.isCurrentWeek ? ' •' : ''}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-500">
                            {week.startDate.slice(5)}
                          </span>
                        </div>
                      </td>

                      {/* 7 Compact Day Cells */}
                      {week.days.map((dateStr, idx) => {
                        const entry = dailyEntries[dateStr];
                        const dayGws = gwsSessions.filter(s => s.date === dateStr);
                        const checklistStatus = weekStatuses[idx];
                        const hasPlan = Boolean(
                          (entry?.planNotes && entry.planNotes.trim().length > 0) ||
                          (entry?.priorityItems && entry.priorityItems.some(p => p.text.trim().length > 0))
                        );
                        const hasReview = Boolean(
                          entry &&
                          (entry.executionScore > 0 ||
                            (entry.reviewNotes && entry.reviewNotes.trim().length > 0) ||
                            (entry.problemsEncountered && entry.problemsEncountered.trim().length > 0))
                        );
                        const tasksDone = entry?.mainTasksCompleted || 0;
                        const tasksPlanned = entry?.mainTasksTotal || 3;
                        const isTodayCell = dateStr === todayDate;
                        const isOutsideSelectedYear =
                          scopeMode === 'full_year' && !dateStr.startsWith(`${selectedYear}-`);
                        const isInactiveDay =
                          checklistStatus.state === 'untracked' || checklistStatus.state === 'upcoming';

                        return (
                          <td
                            key={dateStr}
                            onClick={() => handleDayClick(dateStr)}
                            title={`${dateStr} • Checklist: ${getStatusLabel(checklistStatus.state)}${
                              checklistStatus.activeTotal > 0
                                ? ` (${checklistStatus.completedCount}/${checklistStatus.activeTotal})`
                                : ''
                            } • ${hasPlan ? 'Plan Made' : 'No Plan'} • ${
                              hasReview ? 'Review Made' : 'No Review'
                            } • ${dayGws.length} GWS • ${tasksDone}/${tasksPlanned} tasks`}
                            className={`py-1.5 px-1.5 border-l border-slate-800/70 cursor-pointer transition-colors hover:bg-slate-800/70 ${
                              isTodayCell
                                ? 'bg-amber-500/15 ring-1 ring-inset ring-amber-500/50'
                                : isOutsideSelectedYear
                                ? 'opacity-25'
                                : isInactiveDay && !hasPlan && !hasReview && dayGws.length === 0
                                ? 'opacity-55'
                                : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 font-mono text-[10px]">
                              <div className="flex items-center space-x-1.5 min-w-0">
                                <span className={getDotClass(checklistStatus.state, 'md')} />
                                <span className={isTodayCell ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                                  {dateStr.slice(5)}
                                </span>
                              </div>

                              <div className="flex items-center space-x-0.5 shrink-0">
                                <span
                                  className={`px-1 rounded text-[9px] font-bold ${
                                    hasPlan
                                      ? 'bg-emerald-500/15 text-emerald-300'
                                      : 'text-slate-700'
                                  }`}
                                >
                                  P
                                </span>
                                <span
                                  className={`px-1 rounded text-[9px] font-bold ${
                                    hasReview
                                      ? 'bg-amber-500/15 text-amber-300'
                                      : 'text-slate-700'
                                  }`}
                                >
                                  R
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-1 mt-0.5 font-mono text-[9px]">
                              <span className={dayGws.length > 0 ? 'text-amber-400 font-bold' : 'text-slate-600'}>
                                {dayGws.length}G
                              </span>
                              <span
                                className={
                                  tasksPlanned > 0 && tasksDone >= tasksPlanned
                                    ? 'text-emerald-400 font-bold'
                                    : tasksDone > 0
                                    ? 'text-amber-300'
                                    : 'text-slate-600'
                                }
                              >
                                {tasksDone}/{tasksPlanned}
                              </span>
                            </div>
                          </td>
                        );
                      })}

                      {/* Compact Summary */}
                      <td className="py-1.5 px-3 text-right border-l border-slate-800 bg-slate-950/40 font-mono text-[10px]">
                        <div className="flex items-center justify-end space-x-2">
                          <span className={achievedScore > 0 ? 'text-amber-400 font-bold' : 'text-slate-600'}>
                            {achievedScore}/{totalPoints}p
                          </span>
                          <span className={weekGwsCount > 0 ? 'text-slate-300' : 'text-slate-600'}>
                            {weekGwsCount}G
                          </span>
                          <span
                            className={
                              weekTrackedCount === 0
                                ? 'text-slate-600'
                                : weekDoneCount === weekTrackedCount
                                ? 'text-emerald-400 font-bold'
                                : weekDoneCount > 0
                                ? 'text-amber-300 font-bold'
                                : 'text-rose-400'
                            }
                          >
                            {weekTrackedCount > 0 ? `${weekDoneCount}/${weekTrackedCount}` : '—'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Detailed Spreadsheet Table Container */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">

              {/* Table Header: Week info + Mon to Sun */}
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase font-extrabold text-slate-400 tracking-wider">
                  <th className="py-4 px-4 min-w-[180px]">Week & Target</th>
                  {daysOfWeek.map((dayName, idx) => (
                    <th key={dayName} className="py-4 px-3 min-w-[140px] text-center border-l border-slate-800/80">
                      <div>{dayName}</div>
                      <div className="text-[10px] font-mono text-slate-500 font-normal">Day {idx + 1}</div>
                    </th>
                  ))}
                  <th className="py-4 px-4 min-w-[135px] text-right border-l border-slate-800">
                    Week Total
                  </th>
                </tr>
              </thead>

              {/* Table Body: Weeks */}
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {displayedWeeks.map((week) => {
                  const achievedScore = week.plan?.achievedScore || 0;
                  const totalPoints = week.plan?.totalPossibleScore || 10;
                  const weekGwsSessions = gwsSessions.filter(
                    s => s.date >= week.startDate && s.date <= week.endDate
                  );
                  const weekGwsMinutes = weekGwsSessions.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);
                  const weekStatuses = week.days.map(d =>
                    getDailyChecklistStatusForDate(d, checklistItems, dailyEntries, todayDate)
                  );
                  const weekChecklistDoneCount = weekStatuses.filter(s => s.state === 'done').length;
                  const weekChecklistTrackedCount = weekStatuses.filter(
                    s => s.state === 'done' || s.state === 'missed'
                  ).length;

                  return (
                    <tr
                      key={week.rowKey}
                      ref={week.isCurrentWeek ? currentWeekRowRef : undefined}
                      className={`hover:bg-slate-850/40 transition-colors ${
                        week.isCurrentWeek ? 'bg-amber-500/5' : ''
                      }`}
                    >

                      {/* Week Focus & Number Cell */}
                      <td
                        onClick={() => handleWeekClick(week)}
                        className="py-4 px-4 bg-slate-950/40 align-top cursor-pointer hover:bg-slate-800/60 transition-colors"
                        title={week.plan ? 'Click to open Weekly Plan' : 'Click to open this week'}
                      >
                        {week.monthBadge && (
                          <span className="inline-block mb-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 text-[9px] font-mono font-extrabold tracking-widest">
                            {week.monthBadge} {selectedYear}
                          </span>
                        )}
                        <div className="font-extrabold text-slate-200 text-sm flex items-center space-x-1.5">
                          <span className="text-amber-400 font-mono">{week.label}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[160px] mt-0.5">
                          {week.focus}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-1">
                          {week.startDate.slice(5)} → {week.endDate.slice(5)}
                        </div>
                      </td>

                      {/* 7 Days Matrix Cells */}
                      {week.days.map((dateStr, idx) => {
                        const entry = dailyEntries[dateStr];
                        const dayGws = gwsSessions.filter(s => s.date === dateStr);
                        const dayGwsMinutes = dayGws.reduce((a, b) => a + (b.actualMinutes || 0), 0);
                        const checklistStatus = weekStatuses[idx];
                        const hasPlan = Boolean(
                          (entry?.planNotes && entry.planNotes.trim().length > 0) ||
                          (entry?.priorityItems && entry.priorityItems.some(p => p.text.trim().length > 0))
                        );
                        const hasReview = Boolean(
                          entry &&
                          (entry.executionScore > 0 ||
                            (entry.reviewNotes && entry.reviewNotes.trim().length > 0) ||
                            (entry.problemsEncountered && entry.problemsEncountered.trim().length > 0))
                        );
                        const hasData = Boolean(
                          hasPlan ||
                          hasReview ||
                          (entry && (entry.mainTasksCompleted > 0 || entry.automaticTasksCompleted)) ||
                          dayGws.length > 0 ||
                          checklistStatus.done
                        );

                        const isTodayCell = dateStr === todayDate;
                        const isOutsideSelectedYear =
                          scopeMode === 'full_year' && !dateStr.startsWith(`${selectedYear}-`);

                        return (
                          <td
                            key={dateStr}
                            onClick={() => handleDayClick(dateStr)}
                            className={`group py-3 px-2 border-l border-slate-800/80 cursor-pointer transition-all hover:bg-slate-800/60 align-top ${
                              isTodayCell
                                ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/40'
                                : isOutsideSelectedYear
                                ? 'bg-slate-950/30 opacity-35'
                                : !hasData
                                ? 'bg-slate-950/20'
                                : 'bg-slate-900/50'
                            }`}
                          >
                            <div className="flex flex-col h-full min-h-[112px] justify-between p-2 rounded-2xl border border-transparent hover:border-amber-500/30">

                              {/* Date + Coherent Checklist Dot + Score/Tasks */}
                              <div className="flex items-center justify-between text-[11px] gap-1">
                                <div className="flex items-center space-x-1.5 min-w-0">
                                  <span
                                    className={getDotClass(checklistStatus.state, 'md')}
                                    title={`${getStatusLabel(checklistStatus.state)} (${dateStr})`}
                                  />
                                  <span className={`font-mono font-bold truncate ${isTodayCell ? 'text-amber-400' : 'text-slate-300'}`}>
                                    {dateStr.slice(5)} {isTodayCell ? '• TODAY' : ''}
                                  </span>
                                </div>

                                {hasData ? (
                                  entry && entry.executionScore > 0 ? (
                                    <span className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded border shrink-0 ${getScoreColor(entry.executionScore)}`}>
                                      {entry.executionScore}/10
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-700 bg-slate-950 text-slate-300 shrink-0">
                                      {entry?.mainTasksCompleted || 0}/{entry?.mainTasksTotal || 3} tasks
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[10px] font-mono text-slate-600 bg-slate-950 px-1 py-0.5 rounded border border-slate-800/80 shrink-0">
                                    Empty
                                  </span>
                                )}
                              </div>

                              {/* Plan Made, Review Made, GWS & Checklist Status Badge */}
                              <div className="my-1.5 space-y-1.5">
                                <div className="flex flex-col space-y-1">
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                                      hasPlan
                                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                        : 'bg-slate-950/80 text-slate-500 border-slate-800'
                                    }`}
                                  >
                                    {hasPlan ? '✓ Plan Made' : '○ No Plan'}
                                  </span>

                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                                      hasReview
                                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                        : 'bg-slate-950/80 text-slate-500 border-slate-800'
                                    }`}
                                  >
                                    {hasReview ? '✓ Review Made' : '○ No Review'}
                                  </span>
                                </div>

                                {(() => {
                                  const tasksDone = entry?.mainTasksCompleted || 0;
                                  const tasksPlanned = entry?.mainTasksTotal || 3;
                                  return (
                                    <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono">
                                      <div className={`flex items-center space-x-1 min-w-0 ${dayGws.length > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
                                        <Timer className="w-3 h-3 shrink-0" />
                                        <span className="truncate">
                                          {dayGws.length > 0
                                            ? `${dayGws.length} GWS (${dayGwsMinutes}m)`
                                            : '0 GWS'}
                                        </span>
                                      </div>
                                      <span
                                        className={`shrink-0 font-bold ${
                                          tasksPlanned > 0 && tasksDone >= tasksPlanned
                                            ? 'text-emerald-400'
                                            : tasksDone > 0
                                            ? 'text-amber-300'
                                            : 'text-slate-500'
                                        }`}
                                        title="Tasks done out of planned target"
                                      >
                                        {tasksDone}/{tasksPlanned} tasks
                                      </span>
                                    </div>
                                  );
                                })()}

                                {/* Coherent Daily Checklist Badge */}
                                <div
                                  className={`inline-flex items-center space-x-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                                    checklistStatus.state === 'done'
                                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                      : checklistStatus.state === 'missed'
                                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                      : checklistStatus.state === 'pending_today'
                                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                      : 'bg-slate-950/80 text-slate-500 border-slate-800'
                                  }`}
                                >
                                  <span className={getDotClass(checklistStatus.state, 'sm')} />
                                  <span>{getStatusLabel(checklistStatus.state)}</span>
                                </div>
                              </div>

                              {/* Quick CTA */}
                              <div className="text-[10px] font-semibold text-slate-500 group-hover:text-amber-400 flex items-center justify-end">
                                <span>Open</span>
                                <ArrowRight className="w-3 h-3 ml-0.5" />
                              </div>

                            </div>
                          </td>
                        );
                      })}

                      {/* Week Total Column with 7-Dot Consistency Strip */}
                      <td className="py-4 px-4 text-right border-l border-slate-800 bg-slate-950/40 space-y-1.5 align-top">
                        <div className="text-sm font-extrabold font-mono text-amber-400">
                          {achievedScore} <span className="text-slate-500 text-xs">/ {totalPoints} Pts</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {Math.round((achievedScore / Math.max(1, totalPoints)) * 100)}% achieved
                        </div>
                        <div className="pt-1 border-t border-slate-800/80 space-y-1 text-[10px] font-mono">
                          <div className={weekGwsSessions.length > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                            GWS: {weekGwsSessions.length} ({(weekGwsMinutes / 60).toFixed(1)}h)
                          </div>
                          <div
                            className={
                              weekChecklistTrackedCount === 0
                                ? 'text-slate-500'
                                : weekChecklistDoneCount === weekChecklistTrackedCount
                                ? 'text-emerald-400 font-bold'
                                : weekChecklistDoneCount > 0
                                ? 'text-amber-300 font-bold'
                                : 'text-rose-400'
                            }
                          >
                            Checklist:{' '}
                            {weekChecklistTrackedCount > 0
                              ? `${weekChecklistDoneCount}/${weekChecklistTrackedCount}d`
                              : 'Not Tracked'}
                          </div>
                          <div
                            className="flex items-center justify-end space-x-1 pt-0.5"
                            title="Mon–Sun Daily Checklist Consistency"
                          >
                            {week.days.map((dStr, idx) => {
                              const st = weekStatuses[idx];
                              return (
                                <span
                                  key={dStr}
                                  className={getDotClass(st.state, 'sm')}
                                  title={`${daysOfWeek[idx]} (${dStr}): ${getStatusLabel(st.state)}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        </div>
      )}

    </div>
  );
};
