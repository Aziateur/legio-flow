import React, { useState } from 'react';
import { useStorage, getCurrentWeekRange } from '../../context/StorageContext';
import { 
  Table, 
  Calendar, 
  CheckCircle2, 
  Flame, 
  Timer, 
  ArrowRight,
  TrendingUp,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const SpreadsheetMatrixView: React.FC = () => {
  const { 
    todayDate,
    dailyEntries, 
    weeklyPlans, 
    gwsSessions, 
    setSelectedDate, 
    setActiveTab, 
    setPlanningSubTab
  } = useStorage();

  // Days of week standard
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Helper to generate 7 days from a Monday startDate
  const getDaysFromStart = (startDateStr: string): string[] => {
    const start = new Date(`${startDateStr}T12:00:00`);
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      days.push(`${yyyy}-${mm}-${dd}`);
    }
    return days;
  };

  // Build dynamic weeks list from all continuous weeklyPlans (including empty weeks)
  const buildWeeksList = () => {
    const sortedPlans = Object.values(weeklyPlans).sort((a, b) => a.weekNumber - b.weekNumber);
    return sortedPlans.map(wp => {
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
  };

  const weeksList = buildWeeksList();

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
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Table className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
              Macro Spreadsheet Matrix
            </span>
            <h2 className="text-xl font-extrabold text-slate-100">
              Calendar Grid: Weeks & Days Overview
            </h2>
            <p className="text-xs text-slate-400">
              Full spreadsheet matrix with empty slot indicators for unrecorded days. Click any cell to jump or edit.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-mono">Legend:</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">Recorded</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-500 border border-slate-800 font-bold">Empty Spot</span>
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
                  <th key={dayName} className="py-4 px-3 min-w-[130px] text-center border-l border-slate-800/80">
                    <div>{dayName}</div>
                    <div className="text-[10px] font-mono text-slate-500 font-normal">Day {idx + 1}</div>
                  </th>
                ))}
                <th className="py-4 px-4 min-w-[110px] text-right border-l border-slate-800">
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

                return (
                  <tr key={week.id} className="hover:bg-slate-850/40 transition-colors">
                    
                    {/* Week Focus & Number Cell */}
                    <td className="py-4 px-4 bg-slate-950/40">
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
                      const hasData = entry && (entry.executionScore > 0 || (entry.planNotes && entry.planNotes.trim().length > 0) || dayGws.length > 0 || (entry.reviewNotes && entry.reviewNotes.trim().length > 0));

                      const isTodayCell = dateStr === todayDate;

                      return (
                        <td 
                          key={dateStr}
                          onClick={() => handleDayClick(dateStr)}
                          className={`py-3 px-2 border-l border-slate-800/80 cursor-pointer transition-all hover:bg-slate-800/60 ${
                            isTodayCell
                              ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/40'
                              : !hasData
                              ? 'bg-slate-950/20'
                              : 'bg-slate-900/50'
                          }`}
                        >
                          <div className="flex flex-col h-full min-h-[90px] justify-between p-2 rounded-2xl border border-transparent hover:border-amber-500/30">
                            
                            {/* Date + Status */}
                            <div className="flex items-center justify-between text-[11px]">
                              <span className={`font-mono font-bold ${isTodayCell ? 'text-amber-400' : 'text-slate-300'}`}>
                                {dateStr.slice(5)} {isTodayCell ? '• TODAY' : ''}
                              </span>
                              {hasData ? (
                                <span className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded border ${getScoreColor(entry?.executionScore || 0)}`}>
                                  {entry?.executionScore ? `${entry.executionScore}/10` : 'Log'}
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-slate-600 bg-slate-950 px-1 py-0.5 rounded border border-slate-800/80">
                                  Empty
                                </span>
                              )}
                            </div>

                            {/* Content Snippet or Empty Spot */}
                            <div className="my-1.5">
                              {hasData ? (
                                <div className="space-y-1">
                                  {entry?.planNotes ? (
                                    <div className="text-[11px] text-slate-300 line-clamp-2 font-medium leading-tight">
                                      {entry.planNotes}
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-slate-500 italic">
                                      No written plan
                                    </div>
                                  )}
                                  {dayGws.length > 0 && (
                                    <div className="flex items-center space-x-1 text-[10px] font-mono text-amber-400">
                                      <Timer className="w-3 h-3" />
                                      <span>{dayGws.length} GWS ({dayGws.reduce((a, b) => a + b.actualMinutes, 0)}m)</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center py-2 text-[11px] text-slate-600 italic">
                                  — No record —
                                </div>
                              )}
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

                    {/* Week Total Column */}
                    <td className="py-4 px-4 text-right border-l border-slate-800 bg-slate-950/40">
                      <div className="text-sm font-extrabold font-mono text-amber-400">
                        {achievedScore} <span className="text-slate-500 text-xs">/ {totalPoints} Pts</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {Math.round((achievedScore / Math.max(1, totalPoints)) * 100)}% achieved
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
