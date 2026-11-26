import React, { useMemo, useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import {
  SEVERITY_VISUAL,
  getClusterOccurrenceTimeline,
  getProblemActionText,
  getProblemCheckInForDate,
  getProblemReminderText,
  getProblemSeverity,
  getSolutionTestingSummary,
  hasActiveAction,
  hasActiveReminder,
  hasExistingParent,
  isProblemWatching,
  shouldPromptNoteOnHit
} from '../../lib/problems';
import { ProblemSourceType } from '../../types/schema';
import { getLevelCapabilities } from '../../lib/levelFeatures';
import { ProblemWorkbenchModal } from './ProblemWorkbenchModal';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Eye,
  MessageSquarePlus,
  Pencil,
  Wrench,
  X
} from 'lucide-react';

interface PreFlightGuardrailsStripProps {
  context: 'daily' | 'gws' | 'weekly';
  date: string;
  sourceRef?: string;
}

// Pre-Flight Awareness Strip: shows Reminders (cue-first) AND Actively Observing items right where work happens.
export const PreFlightGuardrailsStrip: React.FC<PreFlightGuardrailsStripProps> = ({
  context,
  date,
  sourceRef
}) => {
  const {
    systemLevel,
    todayDate,
    problems,
    problemSettings,
    recordProblemRecurrence,
    recordProblemCheckIn,
    updateProblem,
    setActiveTab,
    setReviewSubTab
  } = useStorage();

  const caps = getLevelCapabilities(systemLevel);

  const storageKey = `legio_reminders_open_${context}_v2`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) !== 'false';
    } catch {
      return true;
    }
  });
  const [feedbackById, setFeedbackById] = useState<Record<string, string>>({});
  const [clueTargetId, setClueTargetId] = useState<string | null>(null);
  const [clueMode, setClueMode] = useState<'clue' | 'failed' | 'tweak'>('clue');
  const [clueDraft, setClueDraft] = useState('');
  const [activeCaseProblemId, setActiveCaseProblemId] = useState<string | null>(null);

  const enabled =
    caps.problemsConstraintEngine &&
    (context === 'daily'
      ? problemSettings.showPreFlightInDaily !== false
      : context === 'gws'
      ? problemSettings.showPreFlightInGws !== false
      : problemSettings.showPreFlightInWeekly !== false);

  const { reminderItems, watchingOnlyItems } = useMemo(() => {
    const topLevel = problems.filter(
      p => p.status !== 'solved' && !hasExistingParent(problems, p)
    );
    const sorter = (a: typeof topLevel[number], b: typeof topLevel[number]) => {
      if (Boolean(b.isTopConstraint) !== Boolean(a.isTopConstraint)) {
        return b.isTopConstraint ? 1 : -1;
      }
      return getProblemSeverity(b) - getProblemSeverity(a);
    };
    const rem = topLevel.filter(p => hasActiveReminder(p)).sort(sorter);
    const remIds = new Set(rem.map(p => p.id));
    const watch = topLevel.filter(p => !remIds.has(p.id) && isProblemWatching(p)).sort(sorter);
    return { reminderItems: rem, watchingOnlyItems: watch };
  }, [problems]);

  if (!enabled || (reminderItems.length === 0 && watchingOnlyItems.length === 0)) return null;

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {
      // ignore
    }
  };

  const src: ProblemSourceType =
    context === 'gws' ? 'gws' : context === 'weekly' ? 'weekly' : 'daily';

  const flash = (id: string, msg: string) => {
    setFeedbackById(prev => ({ ...prev, [id]: msg }));
    setTimeout(() => {
      setFeedbackById(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }, 1800);
  };

  const commitInlineNote = (
    id: string,
    mode: 'clue' | 'failed' | 'tweak',
    note?: string,
    applyToFix = false
  ) => {
    const trimmed = note?.trim();
    if (mode === 'tweak') {
      recordProblemCheckIn(id, 'tweaked', {
        date,
        sourceType: src,
        ...(sourceRef ? { sourceRef } : {}),
        ...(trimmed ? { note: trimmed } : {})
      });
      if (applyToFix && trimmed) {
        const prob = problems.find(p => p.id === id);
        if (prob) {
          const curRem = getProblemReminderText(prob);
          const curAct = getProblemActionText(prob);
          const patch: Record<string, unknown> = {};
          if (hasActiveReminder(prob) && curRem) {
            patch.isGuardrail = true;
            patch.reminderText = `${curRem} — ${trimmed}`;
          } else if (hasActiveAction(prob) && curAct) {
            patch.fixNote = `${curAct} — ${trimmed}`;
          } else if (curRem) {
            patch.isGuardrail = true;
            patch.reminderText = `${curRem} — ${trimmed}`;
          } else {
            patch.fixNote = trimmed;
          }
          if (prob.status === 'open') {
            patch.status = 'testing';
            patch.fixStartedAt = todayDate;
          }
          updateProblem(prob.id, patch);
        }
      }
      flash(id, applyToFix && trimmed ? 'Tweak saved & fix updated' : 'Tweak saved');
    } else if (mode === 'failed') {
      recordProblemCheckIn(id, 'failed', {
        date,
        sourceType: src,
        ...(sourceRef ? { sourceRef } : {}),
        ...(trimmed ? { note: trimmed } : {})
      });
      flash(id, 'Logged Failed');
    } else {
      recordProblemRecurrence(id, {
        date,
        sourceType: src,
        ...(sourceRef ? { sourceRef } : {}),
        ...(trimmed ? { note: trimmed } : {})
      });
      flash(id, trimmed ? 'Clue saved' : 'Logged');
    }
    setClueTargetId(null);
    setClueDraft('');
  };

  const handleFailedClick = (id: string) => {
    const prob = problems.find(p => p.id === id);
    if (prob && shouldPromptNoteOnHit(prob)) {
      if (clueTargetId === id && clueMode === 'failed') {
        setClueTargetId(null);
        setClueDraft('');
      } else {
        setClueTargetId(id);
        setClueMode('failed');
        setClueDraft('');
      }
    } else {
      commitInlineNote(id, 'failed');
    }
  };

  const handleTweakClick = (id: string) => {
    if (clueTargetId === id && clueMode === 'tweak') {
      setClueTargetId(null);
      setClueDraft('');
    } else {
      setClueTargetId(id);
      setClueMode('tweak');
      setClueDraft('');
    }
  };

  const handleOpenClueBox = (id: string) => {
    if (clueTargetId === id && clueMode === 'clue') {
      setClueTargetId(null);
      setClueDraft('');
    } else {
      setClueTargetId(id);
      setClueMode('clue');
      setClueDraft('');
    }
  };

  const contextPrefix =
    context === 'gws'
      ? 'Before this sprint'
      : context === 'weekly'
      ? 'This week'
      : 'Today';

  const summaryParts = [
    ...(reminderItems.length > 0
      ? [`${reminderItems.length} Reminder${reminderItems.length === 1 ? '' : 's'}`]
      : []),
    ...(watchingOnlyItems.length > 0
      ? [`${watchingOnlyItems.length} Watching`]
      : [])
  ];

  const previewText =
    reminderItems[0]
      ? getProblemReminderText(reminderItems[0])
      : watchingOnlyItems[0]
      ? watchingOnlyItems[0].watchQuestion?.trim() || watchingOnlyItems[0].title
      : '';

  return (
    <>
      <div className="rounded-2xl bg-slate-900/90 border border-amber-500/25 overflow-hidden shadow-md">
        <button
          type="button"
          onClick={toggleOpen}
          className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-900 transition-colors"
        >
          <div className="flex items-center space-x-2 min-w-0">
            {reminderItems.length > 0 ? (
              <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Eye className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            )}
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 truncate">
              {contextPrefix} · {summaryParts.join(' · ')}
            </span>
            {!open && previewText && (
              <span className="hidden md:inline text-[11px] text-slate-300 truncate max-w-md">
                · {previewText}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2 shrink-0 text-[11px] text-slate-400">
            <span className="hidden sm:inline">{open ? 'Hide' : 'Show'}</span>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {open && (
          <div className="px-4 pb-3.5 pt-2 border-t border-slate-800/80 space-y-3">
            {/* REMINDERS */}
            {reminderItems.length > 0 && (
              <div className="space-y-2">
                {watchingOnlyItems.length > 0 && (
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                    <Bell className="w-3 h-3" />
                    <span>Reminders ({reminderItems.length})</span>
                  </div>
                )}
                {reminderItems.map(item => {
                  const sevVis = SEVERITY_VISUAL[getProblemSeverity(item)];
                  const reminder = getProblemReminderText(item);
                  const action = getProblemActionText(item);
                  const verdict = getProblemCheckInForDate(item, date);
                  const testing = getSolutionTestingSummary(item);
                  const alsoWatching = isProblemWatching(item);
                  const flashMsg = feedbackById[item.id];
                  const isTweakOpenForThis = clueTargetId === item.id && clueMode === 'tweak';
                  return (
                    <div
                      key={item.id}
                      className={`space-y-2 p-3 rounded-xl bg-slate-950 border border-slate-800/90 ${sevVis.leftBarClass}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveCaseProblemId(item.id)}
                          className="min-w-0 flex-1 text-left space-y-1 group"
                          title="Click to open Case File"
                        >
                          <p className="text-sm font-bold text-amber-100 group-hover:text-amber-200 leading-snug">
                            {item.trigger?.trim() && (
                              <span className="text-slate-400 font-semibold mr-1">
                                When {item.trigger.trim()} →
                              </span>
                            )}
                            {reminder}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                            {testing.hasSolution && (
                              <span className={`px-1.5 py-0.5 rounded border font-bold ${testing.badgeClass}`}>
                                {testing.shortLabel}
                              </span>
                            )}
                            {item.isTopConstraint && (
                              <span className="inline-flex items-center space-x-1 text-rose-300 font-bold">
                                <Crosshair className="w-3 h-3" />
                                <span>Top focus</span>
                              </span>
                            )}
                            {alsoWatching && (
                              <span className="inline-flex items-center space-x-1 text-sky-300 font-bold">
                                <Eye className="w-3 h-3" />
                                <span>Watching</span>
                              </span>
                            )}
                            <span>For: {item.title}</span>
                            {action && (
                              <span className="inline-flex items-center space-x-1 text-sky-300">
                                <Wrench className="w-3 h-3" />
                                <span className="truncate max-w-[220px]">{action}</span>
                              </span>
                            )}
                            {flashMsg && <span className="text-emerald-300 font-bold">✓ {flashMsg}</span>}
                          </div>
                        </button>

                        <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-start shrink-0">
                          {alsoWatching && (
                            <button
                              type="button"
                              onClick={() => handleOpenClueBox(item.id)}
                              className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-sky-500/15 text-sky-300 border border-slate-800 text-[11px] font-bold"
                            >
                              <MessageSquarePlus className="w-3 h-3" />
                              <span>+ Clue</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              recordProblemCheckIn(item.id, 'effective', { date, sourceType: src, sourceRef });
                              flash(item.id, 'Worked');
                            }}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                              verdict === 'effective'
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                : 'bg-slate-900 hover:bg-emerald-500/15 text-emerald-300 border-slate-800'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            <span>Worked</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTweakClick(item.id)}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                              verdict === 'tweaked' || isTweakOpenForThis
                                ? 'bg-violet-500 text-slate-950 border-violet-400'
                                : 'bg-slate-900 hover:bg-violet-500/15 text-violet-300 border-slate-800'
                            }`}
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Tweak</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFailedClick(item.id)}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                              verdict === 'failed'
                                ? 'bg-rose-500 text-slate-950 border-rose-400'
                                : 'bg-slate-900 hover:bg-rose-500/15 text-rose-300 border-slate-800'
                            }`}
                          >
                            <X className="w-3 h-3" />
                            <span>Failed</span>
                          </button>
                        </div>
                      </div>

                      {clueTargetId === item.id && (
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 border-t border-slate-800/80">
                          <input
                            type="text"
                            autoFocus
                            value={clueDraft}
                            onChange={e => setClueDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitInlineNote(item.id, clueMode, clueDraft, false);
                              }
                              if (e.key === 'Escape') {
                                setClueTargetId(null);
                                setClueDraft('');
                              }
                            }}
                            placeholder={
                              clueMode === 'tweak'
                                ? 'What tweak would make this reminder/fix stronger? (Enter)...'
                                : clueMode === 'failed'
                                ? 'What happened / why didn’t the reminder hold? (Enter)...'
                                : 'What clue did you notice? (Enter)...'
                            }
                            className={`flex-1 min-w-[180px] bg-slate-900 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none border ${
                              clueMode === 'tweak' ? 'border-violet-500/40' : 'border-sky-500/40'
                            }`}
                          />
                          {clueMode === 'tweak' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => commitInlineNote(item.id, 'tweak', clueDraft, false)}
                                className="px-3 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-slate-950 font-extrabold text-xs shrink-0"
                              >
                                Save tweak
                              </button>
                              <button
                                type="button"
                                disabled={!clueDraft.trim()}
                                onClick={() => commitInlineNote(item.id, 'tweak', clueDraft, true)}
                                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-200 border border-amber-500/40 font-extrabold text-xs shrink-0"
                              >
                                Save &amp; update fix
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setClueTargetId(null);
                                  setClueDraft('');
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-slate-400 border border-slate-800 text-xs font-bold shrink-0"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => commitInlineNote(item.id, clueMode, clueDraft)}
                                className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs shrink-0"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => commitInlineNote(item.id, clueMode)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-slate-400 border border-slate-800 text-xs font-bold shrink-0"
                              >
                                Skip note
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ACTIVELY OBSERVING (So Observation actually shows up where life happens!) */}
            {watchingOnlyItems.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400 flex items-center space-x-1.5">
                  <Eye className="w-3 h-3" />
                  <span>Observing — Look Out For ({watchingOnlyItems.length})</span>
                </div>
                {watchingOnlyItems.map(item => {
                  const sevVis = SEVERITY_VISUAL[getProblemSeverity(item)];
                  const latestClue = getClusterOccurrenceTimeline(problems, item).find(o => o.note?.trim());
                  const flashMsg = feedbackById[item.id];
                  return (
                    <div
                      key={item.id}
                      className={`space-y-2 p-3 rounded-xl bg-slate-950 border border-sky-500/25 ${sevVis.leftBarClass}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveCaseProblemId(item.id)}
                          className="min-w-0 flex-1 text-left space-y-1 group"
                          title="Click to open Case File"
                        >
                          <p className="text-xs sm:text-sm font-bold text-sky-100 group-hover:text-sky-200 leading-snug">
                            {item.watchQuestion?.trim() || `Watch for: ${item.title}`}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                            {item.watchQuestion?.trim() && <span>For: {item.title}</span>}
                            {latestClue?.note && (
                              <span className="text-slate-400 italic truncate max-w-[300px]">
                                Last clue ({latestClue.date.slice(5)}): &ldquo;{latestClue.note}&rdquo;
                              </span>
                            )}
                            {flashMsg && <span className="text-emerald-300 font-bold">✓ {flashMsg}</span>}
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 self-end sm:self-start shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenClueBox(item.id)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-500/35 text-[11px] font-bold transition-colors"
                          >
                            <MessageSquarePlus className="w-3 h-3" />
                            <span>+ Log clue</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveCaseProblemId(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-bold"
                          >
                            Open
                          </button>
                        </div>
                      </div>

                      {clueTargetId === item.id && (
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 border-t border-slate-800/80">
                          <input
                            type="text"
                            autoFocus
                            value={clueDraft}
                            onChange={e => setClueDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitInlineNote(item.id, 'clue', clueDraft);
                              }
                              if (e.key === 'Escape') {
                                setClueTargetId(null);
                                setClueDraft('');
                              }
                            }}
                            placeholder="What happened right before or during this? (Enter)..."
                            className="flex-1 min-w-[180px] bg-slate-900 border border-sky-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => commitInlineNote(item.id, 'clue', clueDraft)}
                            className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs shrink-0"
                          >
                            Save Clue
                          </button>
                          <button
                            type="button"
                            onClick={() => commitInlineNote(item.id, 'clue')}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-slate-400 border border-slate-800 text-xs font-bold shrink-0"
                          >
                            Skip note
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('review');
                  setReviewSubTab('problems');
                }}
                className="text-[11px] font-bold text-slate-400 hover:text-amber-300"
              >
                Open Problem Log →
              </button>
            </div>
          </div>
        )}
      </div>

      {activeCaseProblemId && (
        <ProblemWorkbenchModal
          problemId={activeCaseProblemId}
          contextDate={date}
          contextSourceType={src}
          contextSourceRef={sourceRef}
          onClose={() => setActiveCaseProblemId(null)}
        />
      )}
    </>
  );
};
