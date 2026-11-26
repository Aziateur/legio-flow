import React, { useMemo, useState } from 'react';
import { ProblemEntry, ProblemSourceType } from '../../types/schema';
import {
  SEVERITY_VISUAL,
  getClusterOccurrenceTimeline,
  getClusterTotalHits,
  getDirectChildren,
  getEligibleClusterTargets,
  getFixVerificationProgress,
  getLastOccurrenceDate,
  getProblemActionText,
  getProblemReminderText,
  getProblemSeverity,
  getSolutionTestingSummary,
  hasActiveAction,
  hasActiveReminder,
  isProblemClassified,
  isProblemWatching,
  resolveCategoryMeta,
  resolveProblemLinkedActions,
  resolveProblemRoadmapPlanId,
  shouldPromptNoteOnHit
} from '../../lib/problems';
import { useStorage } from '../../context/StorageContext';
import { ProblemPulseBar } from './ProblemPulseBar';
import { ProblemWorkbenchModal, WorkbenchTab } from './ProblemWorkbenchModal';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Crosshair,
  Eye,
  Layers,
  Map as MapIcon,
  MessageSquarePlus,
  RotateCcw,
  Wrench
} from 'lucide-react';

interface ProblemItemRowProps {
  problem: ProblemEntry;
  contextDate: string;
  contextSourceType: ProblemSourceType;
  contextSourceRef?: string;
  targetWeekId?: string;
  periodOccurrenceCount?: number;
  compact?: boolean;
  showParentBreadcrumb?: boolean;
  nested?: boolean;
  inboxMode?: boolean;
  onOpenWorkbench?: (problemId: string, initialTab?: WorkbenchTab) => void;
}

export const ProblemItemRow: React.FC<ProblemItemRowProps> = ({
  problem,
  contextDate,
  contextSourceType,
  contextSourceRef,
  targetWeekId,
  periodOccurrenceCount,
  compact = false,
  showParentBreadcrumb = false,
  nested = false,
  inboxMode = false,
  onOpenWorkbench
}) => {
  const {
    todayDate,
    problems,
    problemCategories,
    problemSettings,
    strategyPlans,
    weeklyPlans,
    checklistItems,
    selectedWeekId,
    updateProblem,
    recordProblemRecurrence,
    deleteProblem
  } = useStorage();

  const [childrenOpen, setChildrenOpen] = useState(false);
  const [localWorkbenchTab, setLocalWorkbenchTab] = useState<WorkbenchTab | null>(null);
  const [notePromptOpen, setNotePromptOpen] = useState(false);
  const [hitNoteDraft, setHitNoteDraft] = useState('');
  const [justLogged, setJustLogged] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isClassified = isProblemClassified(problems, problem);
  const watchingActive = isProblemWatching(problem);
  const severity = getProblemSeverity(problem);
  const severityVisual = SEVERITY_VISUAL[severity];
  const catMeta = resolveCategoryMeta(problem.category, problemCategories);
  const promptNoteActive = shouldPromptNoteOnHit(problem);
  const reminderText = getProblemReminderText(problem);
  const actionText = getProblemActionText(problem);
  const reminderActive = hasActiveReminder(problem);
  const actionActive = hasActiveAction(problem);
  const lastDate = getLastOccurrenceDate(problem);
  const maxTop = problemSettings.maxTopConstraints || 3;
  const defaultVerifyDays = problemSettings.defaultVerifyDays || 14;
  const verification = getFixVerificationProgress(problem, todayDate, defaultVerifyDays);

  const directChildren = useMemo(
    () => getDirectChildren(problems, problem.id),
    [problems, problem.id]
  );
  const clusterHits = useMemo(
    () => getClusterTotalHits(problems, problem),
    [problems, problem]
  );
  const latestClues = useMemo(
    () => getClusterOccurrenceTimeline(problems, problem).filter(o => o.note?.trim()).slice(0, 2),
    [problems, problem]
  );
  const linkedActions = useMemo(
    () =>
      problem.status === 'solved'
        ? []
        : resolveProblemLinkedActions(problem.id, weeklyPlans, checklistItems, todayDate, selectedWeekId),
    [problem.id, problem.status, weeklyPlans, checklistItems, todayDate, selectedWeekId]
  );
  const parentProblem = useMemo(
    () => (problem.parentProblemId ? problems.find(p => p.id === problem.parentProblemId) : undefined),
    [problems, problem.parentProblemId]
  );
  const clusterTargets = useMemo(
    () => (inboxMode ? getEligibleClusterTargets(problems, problem.id) : { roots: [], frictions: [] }),
    [problems, problem.id, inboxMode]
  );
  const resolvedRoadmapId = resolveProblemRoadmapPlanId(problem, strategyPlans);
  const linkedRoadmap = resolvedRoadmapId
    ? strategyPlans.find(sp => sp.id === resolvedRoadmapId)
    : undefined;
  const currentTopCount = useMemo(
    () => problems.filter(p => p.isTopConstraint && p.status !== 'solved').length,
    [problems]
  );
  const testingSummary = getSolutionTestingSummary(problem);

  const openWorkbench = (tab?: WorkbenchTab) => {
    const resolvedTab: WorkbenchTab =
      tab || (!isClassified ? 'classify' : reminderActive || actionActive ? 'solution' : 'observations');
    if (onOpenWorkbench) {
      onOpenWorkbench(problem.id, resolvedTab);
    } else {
      setLocalWorkbenchTab(resolvedTab);
    }
  };

  const commitHit = (note?: string) => {
    recordProblemRecurrence(problem.id, {
      date: contextDate,
      sourceType: contextSourceType,
      ...(contextSourceRef ? { sourceRef: contextSourceRef } : {}),
      ...(note?.trim() ? { note: note.trim() } : {})
    });
    setHitNoteDraft('');
    setNotePromptOpen(false);
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 1400);
  };

  const handleHappenedAgain = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (promptNoteActive) {
      setNotePromptOpen(v => !v);
    } else {
      commitHit();
    }
  };

  const handleFocusTop3 = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (problem.isTopConstraint) {
      updateProblem(problem.id, { isTopConstraint: false });
      return;
    }
    if (currentTopCount >= maxTop) {
      setFeedback(`Top ${maxTop} Focus is full — unpin one first`);
      setTimeout(() => setFeedback(null), 2200);
      return;
    }
    updateProblem(problem.id, {
      classified: true,
      isTopConstraint: true,
      scale: problem.scale === 'blocker' ? 'blocker' : 'bottleneck',
      ...(problem.status === 'solved' ? { status: 'open' } : {})
    });
  };

  const handleMergeFromInbox = (targetId: string) => {
    if (!targetId) return;
    updateProblem(targetId, { classified: true });
    updateProblem(problem.id, { parentProblemId: targetId, classified: true });
  };

  const cardClass = nested
    ? 'bg-slate-900/70 border-slate-800/80'
    : problem.status === 'solved'
    ? 'bg-slate-950/60 border-emerald-500/20 border-l-4 border-l-emerald-500/50'
    : !isClassified
    ? 'bg-slate-950/90 border-slate-800 border-l-4 border-l-amber-400/70 hover:border-slate-700'
    : `${severityVisual.cardTintClass} ${severityVisual.leftBarClass} hover:border-slate-700`;

  return (
    <>
      <div className={`rounded-2xl border transition-all ${cardClass}`}>
        <div className={`${compact || nested ? 'p-3' : 'p-3.5 sm:p-4'} space-y-2`}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
            {/* LEFT: CLEAR SEVERITY + TITLE + STANCE + PULSE + CLUES */}
            <div
              className="flex-1 min-w-0 space-y-1.5 cursor-pointer"
              onClick={() => openWorkbench()}
            >
              {showParentBreadcrumb && parentProblem && (
                <div className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-300/80">
                  <CornerDownRight className="w-3 h-3 shrink-0" />
                  <span className="truncate max-w-[260px]">Inside: {parentProblem.title}</span>
                </div>
              )}

              {/* Title + Plain Severity Word */}
              <div className="flex flex-wrap items-center gap-2">
                {problem.status === 'solved' ? (
                  <span className="px-2 py-0.5 rounded-md border border-emerald-500/35 bg-emerald-500/15 text-emerald-300 text-[10px] font-extrabold shrink-0">
                    Resolved
                  </span>
                ) : !isClassified ? (
                  <span className="px-2 py-0.5 rounded-md border border-amber-500/35 bg-amber-500/15 text-amber-300 text-[10px] font-extrabold shrink-0">
                    Unclassified
                  </span>
                ) : (
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold shrink-0 ${severityVisual.pillClass}`}
                  >
                    {severityVisual.word}
                  </span>
                )}

                <span
                  className={`text-xs sm:text-sm font-bold leading-snug break-words ${
                    problem.status === 'solved' ? 'text-slate-400 line-through' : 'text-slate-100'
                  }`}
                >
                  {problem.title}
                </span>
              </div>

              {/* 14-Day Pulse (on classified active cards) */}
              {isClassified && problem.status !== 'solved' && !nested && (
                <ProblemPulseBar
                  problem={problem}
                  allProblems={problems}
                  todayDate={todayDate}
                  compact
                />
              )}

              {/* Active Stance Summary (Watching / Reminder / Live Linked Action Telemetry / Idle) */}
              {problem.status !== 'solved' && isClassified && (
                <div className="space-y-1.5 text-xs">
                  {watchingActive && (
                    <div className="space-y-1">
                      <div className="flex items-start space-x-1.5 text-sky-200/95">
                        <Eye className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <span className="leading-snug font-medium">
                          {problem.watchQuestion?.trim()
                            ? `Watching: ${problem.watchQuestion.trim()}`
                            : 'Actively Observing'}
                        </span>
                      </div>
                      {latestClues.length > 0 && (
                        <div className="pl-5 space-y-0.5">
                          {latestClues.map((clue, idx) => (
                            <div key={idx} className="text-[11px] text-slate-300 truncate">
                              <span className="font-mono text-[10px] text-slate-500 mr-1.5">
                                {clue.date.slice(5)}
                              </span>
                              <span>&ldquo;{clue.note}&rdquo;</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {reminderActive && (
                    <div className="flex items-start space-x-1.5 text-amber-200/95">
                      <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">
                        {problem.trigger?.trim() && (
                          <span className="text-slate-400 mr-1">
                            When {problem.trigger.trim()} →
                          </span>
                        )}
                        <span className="font-medium">{reminderText || 'Reminder active'}</span>
                      </span>
                    </div>
                  )}

                  {(actionActive || linkedActions.length > 0) && (
                    <div className="space-y-1">
                      {actionText && (
                        <div className="flex items-start space-x-1.5 text-sky-200/95">
                          <Wrench className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                          <span className="leading-snug">{actionText}</span>
                        </div>
                      )}
                      {linkedActions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-5">
                          {linkedActions.map(act => (
                            <span
                              key={`${act.kind}_${act.id}`}
                              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${
                                act.completed
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                                  : 'bg-slate-900 text-slate-300 border-slate-800'
                              }`}
                            >
                              <span>{act.detail}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!watchingActive && !reminderActive && !actionActive && linkedActions.length === 0 && (
                    <div className="text-[11px] text-slate-500">
                      Waiting in Backlog — click Open to observe or design a solution
                    </div>
                  )}
                </div>
              )}

              {/* Solved summary */}
              {problem.status === 'solved' && (reminderText || actionText) && (
                <div className="text-[11px] text-emerald-300/85 leading-snug">
                  What worked: {reminderText || actionText}
                </div>
              )}

              {/* Quiet Single-Line Context Metadata */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500">
                {isClassified && (
                  <span className="inline-flex items-center space-x-1 text-slate-400 font-medium">
                    <span className={`w-1.5 h-1.5 rounded-full ${catMeta.dotClass}`} />
                    <span>{catMeta.shortLabel}</span>
                  </span>
                )}

                {linkedRoadmap && (
                  <span className="inline-flex items-center space-x-1 text-amber-300/90 font-semibold">
                    <MapIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[140px]">{linkedRoadmap.title}</span>
                  </span>
                )}

                <span className="font-mono text-[10px] text-slate-400">
                  {clusterHits} total {clusterHits === 1 ? 'hit' : 'hits'}
                  {periodOccurrenceCount !== undefined &&
                  periodOccurrenceCount !== clusterHits &&
                  periodOccurrenceCount > 0
                    ? ` (${periodOccurrenceCount} here)`
                    : ''}
                  {' · '}
                  {lastDate.slice(5)}
                </span>

                {testingSummary.hasSolution && problem.status !== 'solved' && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${testingSummary.badgeClass}`}
                  >
                    {testingSummary.label}
                    {verification.readyToVerify &&
                    testingSummary.effectiveCount > 0 &&
                    testingSummary.state !== 'failed'
                      ? ' · Ready to resolve'
                      : ''}
                  </span>
                )}

                {problem.fixTaskCompletedAt && problem.status !== 'solved' && (
                  <span className="inline-flex items-center space-x-1 text-emerald-300 font-bold text-[10px]">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Task done ({problem.fixTaskCompletedAt.slice(5)})</span>
                  </span>
                )}

                {directChildren.length > 0 && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setChildrenOpen(v => !v);
                    }}
                    className="inline-flex items-center space-x-1 text-amber-300 hover:text-amber-200 font-bold text-[10px]"
                  >
                    <Layers className="w-3 h-3" />
                    <span>{directChildren.length} grouped</span>
                    {childrenOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {feedback && (
                <div className="text-[11px] font-bold text-amber-300">{feedback}</div>
              )}
            </div>

            {/* RIGHT: PLAIN-ENGLISH STAGE ACTIONS */}
            <div className="flex flex-wrap items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
              {inboxMode || !isClassified ? (
                <>
                  <button
                    type="button"
                    onClick={() => openWorkbench('classify')}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-colors"
                  >
                    <span>Classify</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {inboxMode && clusterTargets.roots.length + clusterTargets.frictions.length > 0 && (
                    <select
                      value=""
                      onChange={e => handleMergeFromInbox(e.target.value)}
                      className="bg-slate-900 border border-slate-700 hover:border-amber-500/40 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-300 focus:outline-none max-w-[155px]"
                      title="Merge this raw note into an existing problem"
                    >
                      <option value="">Merge into...</option>
                      {clusterTargets.roots.length > 0 && (
                        <optgroup label="Classified Problems">
                          {clusterTargets.roots.map(r => (
                            <option key={r.id} value={r.id}>
                              [{SEVERITY_VISUAL[getProblemSeverity(r)].word}] {r.title}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {clusterTargets.frictions.length > 0 && (
                        <optgroup label="Other Raw Captures">
                          {clusterTargets.frictions.map(f => (
                            <option key={f.id} value={f.id}>
                              {f.title}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={() => deleteProblem(problem.id)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-500/15 text-slate-400 hover:text-rose-300 border border-slate-800 text-xs font-bold transition-colors"
                  >
                    Discard
                  </button>
                </>
              ) : problem.status === 'solved' ? (
                <>
                  <button
                    type="button"
                    onClick={() => updateProblem(problem.id, { status: 'open' })}
                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reopen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openWorkbench('observations')}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold"
                  >
                    Open
                  </button>
                </>
              ) : (
                <>
                  {!nested && !compact && (
                    <button
                      type="button"
                      onClick={() => updateProblem(problem.id, { promptNoteOnHit: !promptNoteActive })}
                      title={
                        promptNoteActive
                          ? 'Detail notes ON (asks for a 1-line note on hit) — click to turn OFF'
                          : 'Detail notes OFF (silent hit count) — click to turn ON'
                      }
                      className={`inline-flex items-center space-x-1 px-2 py-1.5 rounded-xl border text-[10px] font-bold transition-colors ${
                        promptNoteActive
                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/35'
                          : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      <MessageSquarePlus className="w-3 h-3" />
                      <span>{promptNoteActive ? 'Note: ON' : 'Note: OFF'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleHappenedAgain}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                      justLogged
                        ? 'bg-orange-500 text-slate-950 border-orange-400'
                        : 'bg-slate-900 hover:bg-orange-500/15 text-orange-300 border-slate-800 hover:border-orange-500/40'
                    }`}
                  >
                    {justLogged ? 'Logged ✓' : watchingActive ? '+ Log clue' : 'Happened again'}
                  </button>

                  {!nested && !compact && !problem.isTopConstraint && (
                    <button
                      type="button"
                      onClick={handleFocusTop3}
                      title={`Move into Top ${maxTop} Active Focus`}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-500/15 text-slate-300 hover:text-rose-200 border border-slate-800 hover:border-rose-500/35 text-xs font-bold transition-colors"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Focus</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openWorkbench()}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-bold transition-colors"
                  >
                    Open
                  </button>
                </>
              )}
            </div>
          </div>

          {/* INLINE 1-LINE NOTE PROMPT */}
          {notePromptOpen && (
            <div
              className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 border-t border-slate-800/80"
              onClick={e => e.stopPropagation()}
            >
              <input
                type="text"
                autoFocus
                value={hitNoteDraft}
                onChange={e => setHitNoteDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitHit(hitNoteDraft);
                  }
                  if (e.key === 'Escape') {
                    setNotePromptOpen(false);
                    setHitNoteDraft('');
                  }
                }}
                placeholder="What triggered it or happened this time? (Enter to save)..."
                className="flex-1 min-w-[200px] bg-slate-950 border border-sky-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => commitHit(hitNoteDraft)}
                className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs shrink-0"
              >
                Save Note
              </button>
              <button
                type="button"
                onClick={() => commitHit()}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-bold shrink-0"
              >
                Skip note
              </button>
            </div>
          )}
        </div>

        {/* NESTED GROUPED SLIPS */}
        {childrenOpen && directChildren.length > 0 && (
          <div className="px-4 pb-3 pt-2 border-t border-slate-800/70 bg-slate-950/50 space-y-1.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              Grouped Slips ({directChildren.length})
            </div>
            <div className="space-y-1.5 pl-2 border-l border-amber-500/25">
              {directChildren.map(child => (
                <ProblemItemRow
                  key={child.id}
                  problem={child}
                  contextDate={contextDate}
                  contextSourceType={contextSourceType}
                  contextSourceRef={contextSourceRef}
                  targetWeekId={targetWeekId}
                  compact
                  nested
                  onOpenWorkbench={onOpenWorkbench}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {localWorkbenchTab && (
        <ProblemWorkbenchModal
          problemId={problem.id}
          initialTab={localWorkbenchTab}
          contextDate={contextDate}
          contextSourceType={contextSourceType}
          contextSourceRef={contextSourceRef}
          targetWeekId={targetWeekId}
          onClose={() => setLocalWorkbenchTab(null)}
        />
      )}
    </>
  );
};
