import React, { useMemo, useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { ChecklistItem, DailyEntry, DailyPriorityItem, GWSSession } from '../../types/schema';
import { getQuarterKeyForDate, getMonthInfo } from '../../lib/macroAnalytics';
import { getChecklistDueStatus, getChecklistScheduleLabel } from '../../lib/checklistSchedule';
import { IMPACT_META, getProblemImpact, hasExistingParent, isProblemGuardrail } from '../../lib/problems';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Crosshair,
  ExternalLink,
  RotateCcw,
  Shield,
  Sparkles
} from 'lucide-react';

interface DailyContextBriefProps {
  selectedDate: string;
  selectedDayShortName: string;
  activeWeeklyPlanId: string;
  latestPreviousReview?: DailyEntry;
  latestGwsCommitment?: GWSSession;
  unfinishedFromPrevDay: DailyPriorityItem[];
  prevDayWithUnfinished?: DailyEntry;
  scheduledDueForDay: ChecklistItem[];
  onPullGoalToDay: (
    text: string,
    completed: boolean,
    weeklyTaskId?: string,
    subTaskId?: string,
    checklistItemId?: string
  ) => void;
  onCarryAllPrevUnfinished: () => void;
  onPullAllScheduledDue: () => void;
}

export const DailyContextBrief: React.FC<DailyContextBriefProps> = ({
  selectedDate,
  selectedDayShortName,
  activeWeeklyPlanId,
  latestPreviousReview,
  latestGwsCommitment,
  unfinishedFromPrevDay,
  prevDayWithUnfinished,
  scheduledDueForDay,
  onPullGoalToDay,
  onCarryAllPrevUnfinished,
  onPullAllScheduledDue
}) => {
  const {
    getMonthlyPlan,
    getQuarterlyPlan,
    problems,
    problemSettings,
    recordProblemRecurrence,
    setActiveTab,
    setPlanningSubTab,
    setReviewSubTab
  } = useStorage();

  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('legio_daily_brief_open_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [section, setSection] = useState<'compass' | 'inbox'>('compass');
  const [loggedId, setLoggedId] = useState<string | null>(null);

  const monthKey = selectedDate.slice(0, 7);
  const monthInfo = getMonthInfo(monthKey);
  const quarterKey = getQuarterKeyForDate(selectedDate);
  const monthPlan = getMonthlyPlan(monthKey);
  const quarterPlan = getQuarterlyPlan(quarterKey);

  const monthFocuses = (monthPlan.topFocuses || []).map(f => f.trim()).filter(Boolean);
  const quarterFocuses = (quarterPlan.topFocuses || []).map(f => f.trim()).filter(Boolean);
  const hasCompass =
    monthFocuses.length > 0 ||
    quarterFocuses.length > 0 ||
    Boolean(monthPlan.focusTheme?.trim()) ||
    Boolean(quarterPlan.focusTheme?.trim());

  const showGuardrails = problemSettings.showPreFlightInDaily !== false;
  const activeGuardrails = useMemo(() => {
    if (!showGuardrails) return [];
    const topLevel = problems.filter(
      p => p.status !== 'solved' && !hasExistingParent(problems, p)
    );
    return topLevel
      .filter(p => isProblemGuardrail(p) || Boolean(p.isTopConstraint))
      .sort((a, b) => {
        if (Boolean(b.isTopConstraint) !== Boolean(a.isTopConstraint)) {
          return b.isTopConstraint ? 1 : -1;
        }
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
  }, [problems, showGuardrails]);

  const hasCorrection = Boolean(latestPreviousReview || latestGwsCommitment);
  const pullCount = unfinishedFromPrevDay.length + scheduledDueForDay.length;
  const hasAnyContent = hasCompass || activeGuardrails.length > 0 || hasCorrection || pullCount > 0;

  if (!hasAnyContent) return null;

  const setOpenPersisted = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem('legio_daily_brief_open_v1', String(next));
    } catch {
      // ignore
    }
  };

  const openSection = (target: 'compass' | 'inbox') => {
    if (open && section === target) {
      setOpenPersisted(false);
    } else {
      setSection(target);
      setOpenPersisted(true);
    }
  };

  const handleLogFired = (id: string) => {
    recordProblemRecurrence(id, {
      date: selectedDate,
      sourceType: 'daily',
      sourceRef: selectedDate
    });
    setLoggedId(id);
    setTimeout(() => setLoggedId(null), 1500);
  };

  return (
    <div className="rounded-2xl bg-slate-900/85 border border-slate-800 shadow-lg overflow-hidden">
      {/* Compact Single-Line Status Strip (Replaces 4 stacked colored banners) */}
      <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => setOpenPersisted(!open)}
            className="inline-flex items-center space-x-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-300 hover:text-amber-300 mr-1 transition-colors"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Today&apos;s Brief</span>
          </button>

          {hasCompass && (
            <button
              type="button"
              onClick={() => openSection('compass')}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors ${
                open && section === 'compass'
                  ? 'bg-purple-500/20 text-purple-200 border-purple-500/40'
                  : 'bg-slate-950 text-purple-300 border-slate-800 hover:border-purple-500/40'
              }`}
            >
              <Crosshair className="w-3 h-3" />
              <span>
                Compass ({monthFocuses.length + quarterFocuses.length || 1})
              </span>
            </button>
          )}

          {activeGuardrails.length > 0 && (
            <button
              type="button"
              onClick={() => openSection('compass')}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors ${
                open && section === 'compass'
                  ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                  : 'bg-slate-950 text-amber-300 border-amber-500/25 hover:border-amber-500/45'
              }`}
            >
              <Shield className="w-3 h-3" />
              <span>{activeGuardrails.length} Guardrail{activeGuardrails.length === 1 ? '' : 's'}</span>
            </button>
          )}

          {hasCorrection && (
            <button
              type="button"
              onClick={() => openSection('compass')}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-950 text-emerald-300 border border-emerald-500/25 hover:border-emerald-500/45 transition-colors max-w-[260px]"
            >
              <Sparkles className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {latestPreviousReview?.reviewNotes?.trim() ||
                  latestGwsCommitment?.reflexions.improveNext?.trim()}
              </span>
            </button>
          )}

          {unfinishedFromPrevDay.length > 0 && (
            <button
              type="button"
              onClick={() => openSection('inbox')}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors ${
                open && section === 'inbox'
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>{unfinishedFromPrevDay.length} Unfinished</span>
            </button>
          )}

          {scheduledDueForDay.length > 0 && (
            <button
              type="button"
              onClick={() => openSection('inbox')}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors ${
                open && section === 'inbox'
                  ? 'bg-purple-500 text-slate-950 border-purple-400'
                  : 'bg-purple-500/10 text-purple-300 border-purple-500/35 hover:bg-purple-500/20'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>{scheduledDueForDay.length} Due ({selectedDayShortName})</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpenPersisted(!open)}
          className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-200 shrink-0"
        >
          <span className="hidden sm:inline">{open ? 'Collapse' : 'Open Brief'}</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Unified Drawer */}
      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-slate-800/80 space-y-4">
          {/* Sub-Tabs when both Compass/Guardrails AND Pull-Inbox have items */}
          {(hasCompass || activeGuardrails.length > 0 || hasCorrection) && pullCount > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSection('compass')}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors ${
                  section === 'compass'
                    ? 'bg-slate-100 text-slate-950 border-slate-100'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                Compass &amp; Guardrails
              </button>
              <button
                type="button"
                onClick={() => setSection('inbox')}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors ${
                  section === 'inbox'
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                Pull Into Today ({pullCount})
              </button>
            </div>
          )}

          {/* SECTION A: COMPASS + GUARDRAILS + COURSE CORRECTION */}
          {(section === 'compass' || pullCount === 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {/* Left: Monthly & Quarterly Top 3 Focuses + Active Course Correction */}
              <div className="space-y-3">
                {hasCompass && (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400 flex items-center space-x-1.5">
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>Active Macro Compass</span>
                      </span>
                      <div className="flex items-center space-x-2 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setPlanningSubTab('monthly')}
                          className="text-purple-300 hover:text-purple-200"
                        >
                          {monthInfo.monthKey} →
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlanningSubTab('quarterly')}
                          className="text-cyan-300 hover:text-cyan-200"
                        >
                          {quarterKey} →
                        </button>
                      </div>
                    </div>

                    {(monthFocuses.length > 0 || monthPlan.focusTheme?.trim()) && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {monthInfo.label}
                          {monthPlan.focusTheme?.trim() ? ` · ${monthPlan.focusTheme.trim()}` : ''}
                        </div>
                        {monthFocuses.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {monthFocuses.map((f, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/25 text-xs font-semibold text-purple-100"
                              >
                                <span className="font-mono text-[10px] font-extrabold text-purple-400">
                                  #{i + 1}
                                </span>
                                <span>{f}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {(quarterFocuses.length > 0 || quarterPlan.focusTheme?.trim()) && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/70">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {quarterKey}
                          {quarterPlan.focusTheme?.trim() ? ` · ${quarterPlan.focusTheme.trim()}` : ''}
                        </div>
                        {quarterFocuses.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {quarterFocuses.map((f, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-xs font-semibold text-cyan-100"
                              >
                                <span className="font-mono text-[10px] font-extrabold text-cyan-400">
                                  #{i + 1}
                                </span>
                                <span>{f}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {hasCorrection && (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/25 space-y-1.5 text-xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Active Course Correction</span>
                    </span>
                    {latestPreviousReview?.reviewNotes?.trim() && (
                      <p className="text-slate-200 leading-relaxed">
                        &ldquo;{latestPreviousReview.reviewNotes.trim()}&rdquo;{' '}
                        <span className="text-[10px] font-mono text-slate-500">
                          ({latestPreviousReview.date})
                        </span>
                      </p>
                    )}
                    {latestGwsCommitment?.reflexions.improveNext?.trim() && (
                      <p className="text-amber-300/90 text-[11px]">
                        Next Sprint Focus: &ldquo;{latestGwsCommitment.reflexions.improveNext.trim()}&rdquo;
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Pre-Flight Guardrails & Top Constraints */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/25 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Pre-Flight Guardrails &amp; Top Constraints ({activeGuardrails.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('review');
                      setReviewSubTab('problems');
                    }}
                    className="inline-flex items-center space-x-1 text-[10px] font-bold text-slate-400 hover:text-amber-300"
                  >
                    <span>Problem Log</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                {activeGuardrails.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Pin a Top 3 Constraint or Guardrail in Problem Log to see it here before executing.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeGuardrails.map(item => {
                      const imp = IMPACT_META[getProblemImpact(item)];
                      const isGuard = isProblemGuardrail(item);
                      return (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 text-xs"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center space-x-1.5">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${imp.dotClass}`} />
                              {item.isTopConstraint && (
                                <Crosshair className="w-3 h-3 text-rose-400 shrink-0" />
                              )}
                              {isGuard && <Shield className="w-3 h-3 text-amber-400 shrink-0" />}
                              <span className="font-bold text-slate-100 truncate">{item.title}</span>
                            </div>
                            <p className="text-[11px] text-slate-300 pl-3.5 leading-snug">
                              {item.trigger?.trim() && (
                                <span className="text-slate-400">
                                  <strong className="text-amber-400/90">IF</strong> {item.trigger.trim()}{' '}
                                  <strong className="text-emerald-400">→</strong>{' '}
                                </span>
                              )}
                              <span>{item.fixNote?.trim() || 'Stay alert to this constraint'}</span>
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleLogFired(item.id)}
                            className={`shrink-0 px-2 py-1 rounded-lg border text-[10px] font-bold transition-all ${
                              loggedId === item.id
                                ? 'bg-orange-500 text-slate-950 border-orange-400'
                                : 'bg-slate-950 hover:bg-orange-500/15 text-orange-300 border-slate-800 hover:border-orange-500/40'
                            }`}
                          >
                            {loggedId === item.id ? 'Logged!' : '+1 Fired'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION B: PULL INTO TODAY (UNFINISHED CARRY-FORWARD + SCHEDULED DUE) */}
          {(section === 'inbox' || (!hasCompass && activeGuardrails.length === 0 && !hasCorrection)) &&
            pullCount > 0 && (
              <div className="space-y-3">
                {unfinishedFromPrevDay.length > 0 && prevDayWithUnfinished && (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="font-extrabold uppercase tracking-wider text-[10px] text-amber-400 mr-1 shrink-0">
                        Unfinished ({prevDayWithUnfinished.date.slice(5)}):
                      </span>
                      {unfinishedFromPrevDay.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            onPullGoalToDay(item.text, false, item.weeklyTaskId, item.subTaskId)
                          }
                          className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-amber-500/15 text-slate-200 hover:text-amber-300 border border-slate-800 hover:border-amber-500/35 text-[11px] font-medium transition-colors"
                        >
                          + {item.text}
                        </button>
                      ))}
                    </div>
                    {unfinishedFromPrevDay.length > 1 && (
                      <button
                        type="button"
                        onClick={onCarryAllPrevUnfinished}
                        className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold shrink-0"
                      >
                        Carry All ({unfinishedFromPrevDay.length})
                      </button>
                    )}
                  </div>
                )}

                {scheduledDueForDay.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-purple-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="inline-flex items-center space-x-1 font-extrabold uppercase tracking-wider text-[10px] text-purple-300 mr-1 shrink-0">
                        <Clock className="w-3 h-3 text-purple-400" />
                        <span>Scheduled ({selectedDayShortName}):</span>
                      </span>
                      {scheduledDueForDay.map(item => {
                        const due = getChecklistDueStatus(item, selectedDate, activeWeeklyPlanId);
                        const schedLabel = getChecklistScheduleLabel(item);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              onPullGoalToDay(item.text, false, undefined, undefined, item.id)
                            }
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-medium transition-colors ${
                              due === 'overdue'
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 border-rose-500/35'
                                : 'bg-slate-900 hover:bg-purple-500/15 text-slate-200 hover:text-purple-200 border-slate-800 hover:border-purple-500/40'
                            }`}
                          >
                            <span className="font-bold text-amber-400">+</span>
                            <span>{item.text}</span>
                            {schedLabel && (
                              <span className="text-[9px] font-mono font-bold uppercase opacity-75">
                                {due === 'overdue' ? `Late · ${schedLabel}` : schedLabel}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {scheduledDueForDay.length > 1 && (
                      <button
                        type="button"
                        onClick={onPullAllScheduledDue}
                        className="px-2.5 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/35 text-[11px] font-bold shrink-0"
                      >
                        Pull All Due ({scheduledDueForDay.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
};
