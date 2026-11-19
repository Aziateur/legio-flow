import React from 'react';
import { useStorage, getCurrentWeekRange } from '../../context/StorageContext';
import {
  Table,
  Timer,
  ArrowRight
} from 'lucide-react';

export const SpreadsheetMatrixView: React.FC = () => {
  const {
    todayDate,
    dailyEntries,
    weeklyPlans,
    gwsSessions,
    checklistItems,
    setSelectedDate,
    setActiveTab,
    setPlanningSubTab
  } = useStorage();

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
  const weeksList = Object.values(weeklyPlans)
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map(wp => {
      const range = getCurrentWeekRange(wp.startDate);
      const isEmpty = wp.tasks.length === 0 && !wp.focusTheme.trim();
      const isCurrentWeek = range.days.includes(todayDate);
      return {
        id: wp.id,
        title: `Week ${wp.weekNumber}${isCurrentWeek ? ' (Current)' : ''}`,
        focus: wp.focusTheme.trim() || (isEmpty ? '— Empty Week (No Plan) —' : 'Weekly Execution'),
        isEmpty,
        score: wp.achievedScore || 0,
        startDate: range.startDate,
        endDate: range.endDate,
        days: range.days
      };
    });

  // Compute overall elapsed daily checklist consistency across the matrix (<= todayDate)
  const elapsedDaysSet = new Set<string>();
  weeksList.forEach(week => {
    week.days.forEach(dStr => {
      if (dStr <= todayDate) {
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

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
    if (score >= 6) return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    if (score > 0) return 'text-orange-400 bg-orange-500/15 border-orange-500/30';
    return 'text-slate-500 bg-slate-900 border-slate-800';
  };

  return (
    <div className="space-y-6">

      {/* Spreadsheet Header Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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

      {/* Spreadsheet Table Container */}
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
              {weeksList.map((week) => {
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
                    <td className="py-4 px-4 bg-slate-950/40 align-top">
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
                      const hasData = Boolean(
                        (entry &&
                          (entry.executionScore > 0 ||
                            (entry.planNotes && entry.planNotes.trim().length > 0) ||
                            entry.mainTasksCompleted > 0 ||
                            entry.automaticTasksCompleted ||
                            (entry.reviewNotes && entry.reviewNotes.trim().length > 0))) ||
                        dayGws.length > 0 ||
                        checklistStatus.done ||
                        checklistStatus.completedCount > 0
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

                            {/* Content Snippet, GWS & Checklist Dot Badge */}
                            <div className="my-1.5 space-y-1.5">
                              {hasData ? (
                                <>
                                  {entry?.planNotes ? (
                                    <div className="text-[11px] text-slate-300 line-clamp-2 font-medium leading-tight">
                                      {entry.planNotes}
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-slate-500 italic">
                                      No written plan
                                    </div>
                                  )}

                                  <div className={`flex items-center space-x-1 text-[10px] font-mono ${dayGws.length > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
                                    <Timer className="w-3 h-3 shrink-0" />
                                    <span className="truncate">
                                      {dayGws.length > 0
                                        ? `${dayGws.length} GWS (${dayGwsMinutes}m)${dayGws[0]?.taskName ? ` • ${dayGws[0].taskName}` : ''}`
                                        : '0 GWS'}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="py-1 text-[10px] text-slate-600 italic">
                                  No GWS / plan
                                </div>
                              )}

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
                                  {checklistStatus.totalDaily > 0
                                    ? ` (${checklistStatus.completedCount}/${checklistStatus.totalDaily})`
                                    : ''}
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

    </div>
  );
};
