import React, { useState, useMemo } from 'react';
import { useStorage, getCurrentWeekRange } from '../../context/StorageContext';
import {
  Table,
  Timer,
  ArrowRight,
  LayoutGrid,
  List
} from 'lucide-react';

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

  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('all');

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dailyChecklistItems = checklistItems.filter(i => i.recurrence === 'daily');

  const isDailyChecklistDone = (dateStr: string): { done: boolean; completedCount: number; totalDaily: number } => {
    const totalDaily = dailyChecklistItems.length;
    const completedCount = dailyChecklistItems.filter(i => (i.completedPeriods || []).includes(dateStr)).length;
    const allDailyItemsDone = totalDaily > 0 && completedCount === totalDaily;
    const done = Boolean(dailyEntries[dateStr]?.automaticTasksCompleted || allDailyItemsDone);
    return { done, completedCount, totalDaily };
  };

  // Build dynamic weeks list from all continuous weeklyPlans (including empty weeks)
  const weeksList = useMemo(() => {
    return Object.values(weeklyPlans)
      .sort((a, b) => a.weekNumber - b.weekNumber)
      .map(wp => {
        const range = getCurrentWeekRange(wp.startDate);
        const isEmpty = wp.tasks.length === 0 && !wp.focusTheme.trim();
        const isCurrentWeek = range.days.includes(todayDate);
        const years = Array.from(new Set(range.days.map(d => d.slice(0, 4))));
        return {
          id: wp.id,
          weekNumber: wp.weekNumber,
          title: `Week ${wp.weekNumber}${isCurrentWeek ? ' (Current)' : ''}`,
          focus: wp.focusTheme.trim() || (isEmpty ? '— Empty Week (No Plan) —' : 'Weekly Execution'),
          isEmpty,
          isCurrentWeek,
          score: wp.achievedScore || 0,
          startDate: range.startDate,
          endDate: range.endDate,
          days: range.days,
          years
        };
      });
  }, [weeklyPlans, todayDate]);

  const availableYears = useMemo(() => {
    const set = new Set<string>([todayDate.slice(0, 4)]);
    weeksList.forEach(w => w.years.forEach(y => set.add(y)));
    return Array.from(set).sort();
  }, [weeksList, todayDate]);

  const filteredWeeks = useMemo(() => {
    if (selectedYearFilter === 'all') return weeksList;
    return weeksList.filter(w => w.years.includes(selectedYearFilter));
  }, [weeksList, selectedYearFilter]);

  // Compute overall elapsed daily checklist consistency across the filtered matrix (<= todayDate)
  const elapsedDaysSet = new Set<string>();
  filteredWeeks.forEach(week => {
    week.days.forEach(dStr => {
      if (dStr <= todayDate && (selectedYearFilter === 'all' || dStr.startsWith(selectedYearFilter))) {
        elapsedDaysSet.add(dStr);
      }
    });
  });
  const elapsedDays = Array.from(elapsedDaysSet);
  const elapsedDaysCount = elapsedDays.length;
  const checklistDoneDaysCount = elapsedDays.filter(d => isDailyChecklistDone(d).done).length;
  const checklistMissedDaysCount = Math.max(0, elapsedDaysCount - checklistDoneDaysCount);
  const consistencyPct = elapsedDaysCount > 0 ? Math.round((checklistDoneDaysCount / elapsedDaysCount) * 100) : 0;

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setActiveTab('planning');
    setPlanningSubTab('daily');
  };

  const handleWeekClick = (weekId: string) => {
    setSelectedWeekId(weekId);
    setActiveTab('planning');
    setPlanningSubTab('weekly');
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
    if (score >= 6) return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    if (score > 0) return 'text-orange-400 bg-orange-500/15 border-orange-500/30';
    return 'text-slate-500 bg-slate-900 border-slate-800';
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
                Calendar Grid: Weeks, GWS & Daily Checklist Consistency
              </h2>
              <p className="text-xs text-slate-400">
                Every day displays a green or red dot so you can scan yearly checklist consistency at a glance. Click any cell to open that day.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Consistency Summary Pill */}
            <div className="flex items-center space-x-3 px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono">
              <span className="inline-flex items-center space-x-1.5 text-emerald-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                <span>{checklistDoneDaysCount} Done</span>
              </span>
              <span className="text-slate-700">|</span>
              <span className="inline-flex items-center space-x-1.5 text-rose-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]" />
                <span>{checklistMissedDaysCount} Missed</span>
              </span>
              <span className="text-slate-700">|</span>
              <span className="text-amber-400 font-extrabold">{consistencyPct}% Consistent</span>
            </div>

            {/* Dot Legend */}
            <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
              <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Checklist Done</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Not Done</span>
              </span>
            </div>
          </div>
        </div>

        {/* View Mode + Year Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          {/* Year Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mr-1">
              Year:
            </span>
            <button
              type="button"
              onClick={() => setSelectedYearFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold font-mono transition-all ${
                selectedYearFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              All ({weeksList.length}w)
            </button>
            {availableYears.map(yr => {
              const count = weeksList.filter(w => w.years.includes(yr)).length;
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYearFilter(yr)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold font-mono transition-all ${
                    selectedYearFilter === yr
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {yr} ({count}w)
                </button>
              );
            })}
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
              onClick={() => setViewMode('compact')}
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

      {/* Compact Year Map View (Scannable 52-Week Overview) */}
      {viewMode === 'compact' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] uppercase font-extrabold text-slate-400 tracking-wider">
                  <th className="py-2.5 px-3 min-w-[140px]">Week</th>
                  {daysOfWeek.map(dayName => (
                    <th key={dayName} className="py-2.5 px-1.5 min-w-[96px] text-center border-l border-slate-800/70">
                      {dayName}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 min-w-[125px] text-right border-l border-slate-800">
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-[11px]">
                {filteredWeeks.map(week => {
                  const plan = weeklyPlans[week.id];
                  const achievedScore = plan?.achievedScore || 0;
                  const totalPoints = plan?.totalPossibleScore || 10;
                  const weekChecklistDoneCount = week.days.filter(d => isDailyChecklistDone(d).done).length;
                  const weekGwsCount = gwsSessions.filter(
                    s => s.date >= week.startDate && s.date <= week.endDate
                  ).length;

                  return (
                    <tr
                      key={week.id}
                      className={`hover:bg-slate-800/35 transition-colors ${
                        week.isCurrentWeek ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Compact Week Label */}
                      <td
                        onClick={() => handleWeekClick(week.id)}
                        className="py-1.5 px-3 bg-slate-950/40 cursor-pointer hover:bg-slate-800/60 transition-colors"
                        title={`${week.title} — ${week.focus} (Click to open Weekly Plan)`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-extrabold text-amber-400">
                            W{week.weekNumber}
                            {week.isCurrentWeek ? ' •' : ''}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {week.startDate.slice(5)}
                          </span>
                        </div>
                      </td>

                      {/* 7 Compact Day Cells */}
                      {week.days.map(dateStr => {
                        const entry = dailyEntries[dateStr];
                        const dayGws = gwsSessions.filter(s => s.date === dateStr);
                        const checklistStatus = isDailyChecklistDone(dateStr);
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
                        const isFuture = dateStr > todayDate;

                        return (
                          <td
                            key={dateStr}
                            onClick={() => handleDayClick(dateStr)}
                            title={`${dateStr} • Checklist: ${
                              checklistStatus.done ? 'Done' : isFuture ? 'Upcoming' : 'Missed'
                            } • ${hasPlan ? 'Plan Made' : 'No Plan'} • ${
                              hasReview ? 'Review Made' : 'No Review'
                            } • ${dayGws.length} GWS • ${tasksDone}/${tasksPlanned} tasks`}
                            className={`py-1.5 px-1.5 border-l border-slate-800/70 cursor-pointer transition-colors hover:bg-slate-800/70 ${
                              isTodayCell
                                ? 'bg-amber-500/15 ring-1 ring-inset ring-amber-500/50'
                                : isFuture
                                ? 'opacity-50'
                                : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 font-mono text-[10px]">
                              <div className="flex items-center space-x-1.5 min-w-0">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    checklistStatus.done
                                      ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                                      : isFuture
                                      ? 'bg-rose-500/45'
                                      : 'bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.45)]'
                                  }`}
                                />
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
                          <span className="text-amber-400 font-bold">
                            {achievedScore}/{totalPoints}p
                          </span>
                          <span className={weekGwsCount > 0 ? 'text-slate-300' : 'text-slate-600'}>
                            {weekGwsCount}G
                          </span>
                          <span className={weekChecklistDoneCount >= 5 ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                            {weekChecklistDoneCount}/7
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
              {filteredWeeks.map((week) => {
                const plan = weeklyPlans[week.id];
                const achievedScore = plan?.achievedScore || 0;
                const totalPoints = plan?.totalPossibleScore || 10;
                const weekGwsSessions = gwsSessions.filter(
                  s => s.date >= week.startDate && s.date <= week.endDate
                );
                const weekGwsMinutes = weekGwsSessions.reduce((acc, s) => acc + (s.actualMinutes || 0), 0);
                const weekChecklistDoneCount = week.days.filter(d => isDailyChecklistDone(d).done).length;

                return (
                  <tr key={week.id} className="hover:bg-slate-850/40 transition-colors">

                    {/* Week Focus & Number Cell */}
                    <td
                      onClick={() => handleWeekClick(week.id)}
                      className="py-4 px-4 bg-slate-950/40 align-top cursor-pointer hover:bg-slate-800/60 transition-colors"
                      title="Click to open Weekly Plan"
                    >
                      <div className="font-extrabold text-slate-200 text-sm flex items-center space-x-1.5">
                        <span className="text-amber-400 font-mono">{week.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[160px] mt-0.5">
                        {week.focus}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-1">
                        {week.startDate.slice(5)} → {week.endDate.slice(5)}
                      </div>
                    </td>

                    {/* 7 Days Matrix Cells */}
                    {week.days.map((dateStr) => {
                      const entry = dailyEntries[dateStr];
                      const dayGws = gwsSessions.filter(s => s.date === dateStr);
                      const dayGwsMinutes = dayGws.reduce((a, b) => a + (b.actualMinutes || 0), 0);
                      const checklistStatus = isDailyChecklistDone(dateStr);
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
                      const isFuture = dateStr > todayDate;

                      return (
                        <td
                          key={dateStr}
                          onClick={() => handleDayClick(dateStr)}
                          className={`group py-3 px-2 border-l border-slate-800/80 cursor-pointer transition-all hover:bg-slate-800/60 align-top ${
                            isTodayCell
                              ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/40'
                              : !hasData
                              ? 'bg-slate-950/20'
                              : 'bg-slate-900/50'
                          }`}
                        >
                          <div className="flex flex-col h-full min-h-[112px] justify-between p-2 rounded-2xl border border-transparent hover:border-amber-500/30">

                            {/* Date + Green/Red Consistency Dot + Score/Tasks */}
                            <div className="flex items-center justify-between text-[11px] gap-1">
                              <div className="flex items-center space-x-1.5 min-w-0">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    checklistStatus.done
                                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]'
                                      : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]'
                                  }`}
                                  title={
                                    checklistStatus.done
                                      ? `Daily Checklist Done (${dateStr})`
                                      : isFuture
                                      ? `Daily Checklist Upcoming (${dateStr})`
                                      : `Daily Checklist Missed (${dateStr})`
                                  }
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

                            {/* Plan Made, Review Made, GWS & Checklist Dot Badges */}
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

                              {/* Daily Checklist Done/Not Done Indicator (always visible) */}
                              <div
                                className={`inline-flex items-center space-x-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                                  checklistStatus.done
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    checklistStatus.done ? 'bg-emerald-400' : 'bg-rose-500'
                                  }`}
                                />
                                <span>
                                  {checklistStatus.done
                                    ? 'Checklist Done'
                                    : isFuture
                                    ? 'Upcoming'
                                    : 'Not Done'}
                                </span>
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
                        <div className={weekChecklistDoneCount > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                          Checklist: {weekChecklistDoneCount}/7d
                        </div>
                        <div
                          className="flex items-center justify-end space-x-1 pt-0.5"
                          title="Mon–Sun Daily Checklist Consistency"
                        >
                          {week.days.map((dStr, idx) => {
                            const done = isDailyChecklistDone(dStr).done;
                            return (
                              <span
                                key={dStr}
                                className={`w-2 h-2 rounded-full ${done ? 'bg-emerald-400' : 'bg-rose-500'}`}
                                title={`${daysOfWeek[idx]} (${dStr}): ${done ? 'Daily Checklist Done' : 'Not Done'}`}
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
