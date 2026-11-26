import React, { useMemo, useState } from 'react';
import {
  ProblemCategory,
  ProblemEntry,
  ProblemSourceType
} from '../../types/schema';
import {
  clusterHasSourceType,
  clusterHasTag,
  clusterMatchesRoadmap,
  clusterOccurredInRange,
  clusterOccurredOnDate,
  computeProblemPriorityScore,
  countClusterOccurrencesInRange,
  getClusterOccurrenceTimeline,
  getClusterTotalHits,
  getLastOccurrenceDate,
  getProblemActionText,
  getProblemCheckInForDate,
  getProblemReminderText,
  getSolutionPeriodSummary,
  getSolutionTestingSummary,
  hasActiveAction,
  hasActiveReminder,
  hasExistingParent,
  isProblemClassified,
  isProblemWatching,
  normalizeTag,
  resolveProblemLinkedActions,
  severityToImpact,
  shouldPromptNoteOnHit,
  tagsMatch
} from '../../lib/problems';
import { useStorage } from '../../context/StorageContext';
import { getLevelCapabilities } from '../../lib/levelFeatures';
import { ProblemItemRow } from './ProblemItemRow';
import { ProblemWorkbenchModal, WorkbenchTab } from './ProblemWorkbenchModal';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Crosshair,
  ExternalLink,
  Eye,
  MessageSquarePlus,
  Minus,
  Pencil,
  Plus,
  Trash2,
  Wrench,
  X
} from 'lucide-react';

interface ProblemLoggerPanelProps {
  mode: 'review' | 'compact' | 'weekly_triage' | 'roadmap';
  title?: string;
  subtitle?: string;
  sourceType: ProblemSourceType;
  date: string;
  sourceRef?: string;
  dateRange?: { startDate: string; endDate: string };
  filterTag?: string;
  roadmapPlanId?: string;
  filterSourceType?: ProblemSourceType;
  targetWeekId?: string;
  showAuditStrip?: boolean;
  defaultCollapsed?: boolean;
  draftText?: string;
  onDraftTextChange?: (val: string) => void;
  draftCategory?: ProblemCategory;
  onDraftCategoryChange?: (cat: ProblemCategory) => void;
  draftTags?: string[];
  onDraftTagsChange?: (tags: string[]) => void;
}

export const ProblemLoggerPanel: React.FC<ProblemLoggerPanelProps> = ({
  mode,
  title,
  subtitle,
  sourceType,
  date,
  sourceRef,
  dateRange,
  filterTag,
  roadmapPlanId,
  filterSourceType,
  targetWeekId,
  showAuditStrip = false,
  defaultCollapsed = false,
  draftText,
  onDraftTextChange,
  draftCategory,
  onDraftCategoryChange,
  draftTags,
  onDraftTagsChange
}) => {
  const {
    systemLevel,
    todayDate,
    problems,
    problemCategories,
    problemSettings,
    weeklyPlans,
    checklistItems,
    selectedWeekId,
    addProblem,
    recordProblemRecurrence,
    recordProblemCheckIn,
    noteProblemTweak,
    reviseProblemSolution,
    updateProblem,
    deleteProblem,
    setActiveTab,
    setReviewSubTab
  } = useStorage();

  const caps = getLevelCapabilities(systemLevel);
  const fullEngine = caps.problemsConstraintEngine;
  const defaultVerifyTarget = problemSettings.defaultVerifyTarget || 5;
  const isWeeklyRollup = sourceType === 'weekly' && Boolean(dateRange);

  const isMacroReview =
    mode === 'review' &&
    (sourceType === 'monthly' || sourceType === 'quarterly' || sourceType === 'yearly');

  const [internalText, setInternalText] = useState('');
  const [internalCategory] = useState<ProblemCategory>(problemCategories[0]?.id || 'mindset');
  const [internalTags, setInternalTags] = useState<string[]>(
    filterTag ? [normalizeTag(filterTag)] : []
  );
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAllMacroSlips, setShowAllMacroSlips] = useState(false);

  // Per-problem prompt for quick-recur chips at the bottom
  const [notePromptTarget, setNotePromptTarget] = useState<{
    problem: ProblemEntry;
    kind: 'recur';
  } | null>(null);
  const [notePromptDraft, setNotePromptDraft] = useState('');

  // In-card inline drawer for Daily/Weekly check-ins (always renders inside its own card!)
  const [inlineDrawer, setInlineDrawer] = useState<{
    problemId: string;
    mode: 'tweak_idea' | 'revise' | 'failed_note' | 'clue';
  } | null>(null);
  const [inlineNoteDraft, setInlineNoteDraft] = useState('');
  const [inlineSolutionDraft, setInlineSolutionDraft] = useState('');
  const [inlineRestartTest, setInlineRestartTest] = useState(false);
  const [rowFlashById, setRowFlashById] = useState<Record<string, string>>({});

  const flashRow = (id: string, msg: string) => {
    setRowFlashById(prev => ({ ...prev, [id]: msg }));
    setTimeout(() => {
      setRowFlashById(prev => {
        if (prev[id] !== msg) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 1800);
  };

  const [workbenchState, setWorkbenchState] = useState<{
    problemId: string;
    initialTab?: WorkbenchTab;
  } | null>(null);

  const textValue = draftText !== undefined ? draftText : internalText;
  const setTextValue = (val: string) => {
    if (onDraftTextChange) onDraftTextChange(val);
    else setInternalText(val);
  };

  const categoryValue = draftCategory !== undefined ? draftCategory : internalCategory;
  const selectedTags = draftTags !== undefined ? draftTags : internalTags;
  const setSelectedTags = (next: string[]) => {
    if (onDraftTagsChange) onDraftTagsChange(next);
    else setInternalTags(next);
  };

  const topLevelProblems = useMemo(
    () => problems.filter(p => !hasExistingParent(problems, p)),
    [problems]
  );

  const { displayedProblems, hiddenSlipCount } = useMemo(() => {
    let list: ProblemEntry[] = [];

    if (mode === 'roadmap' && (roadmapPlanId || filterTag)) {
      list = topLevelProblems.filter(p =>
        roadmapPlanId
          ? clusterMatchesRoadmap(problems, p, roadmapPlanId, filterTag)
          : clusterHasTag(problems, p, filterTag!)
      );
    } else if (mode === 'weekly_triage') {
      list = topLevelProblems.filter(p => p.status !== 'solved');
    } else if (filterSourceType) {
      list = topLevelProblems.filter(p => clusterHasSourceType(problems, p, filterSourceType));
    } else if (dateRange) {
      list = topLevelProblems.filter(p =>
        clusterOccurredInRange(problems, p, dateRange.startDate, dateRange.endDate)
      );
    } else {
      list = topLevelProblems.filter(p => clusterOccurredOnDate(problems, p, date));
    }

    let hiddenSlips = 0;
    if (isMacroReview && !showAllMacroSlips) {
      const classifiedOnly = list.filter(p => isProblemClassified(problems, p));
      hiddenSlips = list.length - classifiedOnly.length;
      list = classifiedOnly;
    }

    const sorted = [...list].sort((a, b) => {
      const aSolved = a.status === 'solved' ? 1 : 0;
      const bSolved = b.status === 'solved' ? 1 : 0;
      if (aSolved !== bSolved) return aSolved - bSolved;
      const pDiff = computeProblemPriorityScore(problems, b) - computeProblemPriorityScore(problems, a);
      if (pDiff !== 0) return pDiff;
      return getLastOccurrenceDate(b).localeCompare(getLastOccurrenceDate(a));
    });

    return { displayedProblems: sorted, hiddenSlipCount: hiddenSlips };
  }, [
    mode,
    filterTag,
    roadmapPlanId,
    filterSourceType,
    topLevelProblems,
    problems,
    dateRange,
    date,
    isMacroReview,
    showAllMacroSlips
  ]);

  // Quick "Happened again" chips
  const quickRecurCandidates = useMemo(() => {
    if (mode === 'weekly_triage' || mode === 'roadmap') return [];
    const shownIds = new Set(displayedProblems.map(p => p.id));
    return topLevelProblems
      .filter(p => p.status !== 'solved' && !shownIds.has(p.id))
      .sort((a, b) => computeProblemPriorityScore(problems, b) - computeProblemPriorityScore(problems, a))
      .slice(0, 4);
  }, [mode, topLevelProblems, problems, displayedProblems]);

  // Review Check-Ins: ALL active fixes/reminders + ALL actively observed problems
  const { activeFixesToCheck, observingToCheck } = useMemo(() => {
    if (!showAuditStrip || !fullEngine) {
      return { activeFixesToCheck: [], observingToCheck: [] };
    }
    const sorter = (a: ProblemEntry, b: ProblemEntry) =>
      computeProblemPriorityScore(problems, b) - computeProblemPriorityScore(problems, a);

    const activeFixes = topLevelProblems
      .filter(
        p =>
          p.status !== 'solved' &&
          (hasActiveReminder(p) || hasActiveAction(p) || p.status === 'testing')
      )
      .sort(sorter);

    const fixIds = new Set(activeFixes.map(p => p.id));
    const observing = topLevelProblems
      .filter(p => p.status !== 'solved' && !fixIds.has(p.id) && isProblemWatching(p))
      .sort(sorter);

    return { activeFixesToCheck: activeFixes, observingToCheck: observing };
  }, [showAuditStrip, fullEngine, topLevelProblems, problems]);

  // Zero-friction raw capture (classify later)
  const handleLogProblem = () => {
    const trimmed = textValue.trim();
    if (!trimmed) return;

    const finalTags = [...selectedTags];
    if (filterTag && !finalTags.some(t => tagsMatch(t, filterTag))) {
      finalTags.unshift(normalizeTag(filterTag));
    }

    const existingMatch = problems.find(
      p => p.title.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existingMatch) {
      recordProblemRecurrence(existingMatch.id, {
        date,
        sourceType,
        ...(sourceRef ? { sourceRef } : {})
      });
      if (finalTags.length > 0 || (roadmapPlanId && !existingMatch.roadmapPlanId)) {
        const mergedTags = Array.from(new Set([...existingMatch.tags, ...finalTags]));
        updateProblem(existingMatch.id, {
          tags: mergedTags,
          ...(roadmapPlanId && !existingMatch.roadmapPlanId ? { roadmapPlanId } : {})
        });
      }
    } else {
      addProblem({
        title: trimmed,
        category: categoryValue || problemCategories[0]?.id || 'mindset',
        classified: false,
        scale: 'friction',
        severity: 2,
        impact: severityToImpact(2),
        ...(roadmapPlanId ? { roadmapPlanId } : {}),
        tags: finalTags,
        sourceType,
        date,
        ...(sourceRef ? { sourceRef } : {})
      });
    }

    setTextValue('');
    setSelectedTags(filterTag ? [normalizeTag(filterTag)] : []);
  };

  const handleQuickRecur = (prob: ProblemEntry) => {
    if (fullEngine && shouldPromptNoteOnHit(prob)) {
      setNotePromptTarget({ problem: prob, kind: 'recur' });
      setNotePromptDraft('');
      return;
    }
    recordProblemRecurrence(prob.id, {
      date,
      sourceType,
      ...(sourceRef ? { sourceRef } : {})
    });
  };

  const openReviseDrawer = (prob: ProblemEntry) => {
    const testing = getSolutionTestingSummary(prob, defaultVerifyTarget);
    const curSolution = getProblemReminderText(prob) || getProblemActionText(prob) || '';
    setInlineSolutionDraft(curSolution);
    setInlineNoteDraft('');
    setInlineRestartTest(testing.state === 'failed');
    setInlineDrawer({ problemId: prob.id, mode: 'revise' });
  };

  const closeInlineDrawer = () => {
    setInlineDrawer(null);
    setInlineNoteDraft('');
    setInlineSolutionDraft('');
    setInlineRestartTest(false);
  };

  const handleSaveTweakIdea = (prob: ProblemEntry) => {
    const trimmed = inlineNoteDraft.trim();
    if (!trimmed) return;
    noteProblemTweak(prob.id, trimmed, { date });
    flashRow(prob.id, '✓ Tweak idea saved');
    closeInlineDrawer();
  };

  const handleSaveRevisedFix = (prob: ProblemEntry) => {
    const nextText = inlineSolutionDraft.trim();
    if (!nextText) return;
    const isReminderFix = Boolean(hasActiveReminder(prob) || getProblemReminderText(prob));
    reviseProblemSolution(prob.id, {
      ...(isReminderFix ? { reminderText: nextText } : { fixNote: nextText }),
      ...(inlineNoteDraft.trim() ? { note: inlineNoteDraft.trim() } : {}),
      restartTest: inlineRestartTest,
      date: todayDate
    });
    flashRow(prob.id, '✓ Fix revised');
    closeInlineDrawer();
  };

  const handleCheckInFailed = (prob: ProblemEntry) => {
    if (getProblemCheckInForDate(prob, date) === 'failed') {
      recordProblemCheckIn(prob.id, null, { date, sourceType, sourceRef });
      flashRow(prob.id, '↺ Undone');
      if (inlineDrawer?.problemId === prob.id) closeInlineDrawer();
      return;
    }
    if (shouldPromptNoteOnHit(prob)) {
      if (inlineDrawer?.problemId === prob.id && inlineDrawer.mode === 'failed_note') {
        closeInlineDrawer();
      } else {
        setInlineNoteDraft('');
        setInlineDrawer({ problemId: prob.id, mode: 'failed_note' });
      }
      return;
    }
    recordProblemCheckIn(prob.id, 'failed', {
      date,
      sourceType,
      ...(sourceRef ? { sourceRef } : {})
    });
    flashRow(prob.id, 'Logged Failed');
  };

  const commitPromptedNote = (note?: string) => {
    if (!notePromptTarget) return;
    const { problem: target } = notePromptTarget;
    const trimmed = note?.trim();
    recordProblemRecurrence(target.id, {
      date,
      sourceType,
      ...(sourceRef ? { sourceRef } : {}),
      ...(trimmed ? { note: trimmed } : {})
    });
    setNotePromptTarget(null);
    setNotePromptDraft('');
  };

  const renderLiteRow = (p: ProblemEntry) => {
    const isSolved = p.status === 'solved';
    const hits = getClusterTotalHits(problems, p);
    return (
      <div
        key={p.id}
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs transition-colors ${
          isSolved
            ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-500'
            : 'bg-slate-900/70 border-slate-800 text-slate-200'
        }`}
      >
        <button
          type="button"
          onClick={() => updateProblem(p.id, { status: isSolved ? 'open' : 'solved' })}
          className="flex items-center space-x-2 min-w-0 flex-1 text-left"
          title={isSolved ? 'Reopen friction' : 'Mark resolved'}
        >
          {isSolved ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Circle className="w-4 h-4 text-slate-500 hover:text-emerald-400 shrink-0" />
          )}
          <span className={`truncate ${isSolved ? 'line-through text-slate-500' : 'font-medium text-slate-100'}`}>
            {p.title}
          </span>
        </button>

        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            type="button"
            onClick={() => handleQuickRecur(p)}
            className="px-2 py-0.5 rounded-lg bg-slate-950 hover:bg-orange-500/15 border border-slate-800 hover:border-orange-500/35 text-[10px] font-bold text-orange-300"
          >
            Happened again ({hits})
          </button>
          <button
            type="button"
            onClick={() => deleteProblem(p.id)}
            className="p-1 text-slate-600 hover:text-rose-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderNotePromptBanner = () => {
    if (!notePromptTarget) return null;
    return (
      <div className="p-3 rounded-xl border space-y-2 bg-sky-500/10 border-sky-500/35">
        <div className="text-[11px] font-bold text-sky-200">
          What happened with &ldquo;{notePromptTarget.problem.title}&rdquo;?
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <input
            type="text"
            autoFocus
            value={notePromptDraft}
            onChange={e => setNotePromptDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitPromptedNote(notePromptDraft);
              }
              if (e.key === 'Escape') {
                setNotePromptTarget(null);
                setNotePromptDraft('');
              }
            }}
            placeholder="1-line context note (Enter to save)..."
            className="flex-1 min-w-[180px] bg-slate-950 border border-sky-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => commitPromptedNote(notePromptDraft)}
            className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs shrink-0"
          >
            Save Note
          </button>
          <button
            type="button"
            onClick={() => commitPromptedNote()}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-slate-300 border border-slate-800 text-xs font-bold shrink-0"
          >
            Skip note
          </button>
        </div>
      </div>
    );
  };

  // ================================================================
  // MODE 1: ZERO-FRICTION COMPACT CAPTURE (GWS Studio & Modals)
  // ================================================================
  if (mode === 'compact') {
    return (
      <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-orange-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{title || 'What got in your way? (Quick Record)'}</span>
          </div>
          {displayedProblems.length > 0 && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30">
              {displayedProblems.length} recorded
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleLogProblem();
              }
            }}
            placeholder="Drop a 1-line note & press Enter (classify later at end of day/week)..."
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-orange-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleLogProblem}
            disabled={!textValue.trim()}
            className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0"
          >
            Record
          </button>
        </div>

        {quickRecurCandidates.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500">Happened again:</span>
            {quickRecurCandidates.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleQuickRecur(p)}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-orange-500/15 border border-slate-800 hover:border-orange-500/35 text-[10px] text-slate-300 hover:text-orange-200 transition-colors"
              >
                {fullEngine && p.isTopConstraint && <Crosshair className="w-2.5 h-2.5 text-rose-400" />}
                <span className="truncate max-w-[160px]">{p.title}</span>
              </button>
            ))}
          </div>
        )}

        {renderNotePromptBanner()}

        {displayedProblems.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {displayedProblems.map(p =>
              fullEngine ? (
                <ProblemItemRow
                  key={p.id}
                  problem={p}
                  contextDate={date}
                  contextSourceType={sourceType}
                  contextSourceRef={sourceRef}
                  targetWeekId={targetWeekId}
                  compact
                  onOpenWorkbench={(id, tab) => setWorkbenchState({ problemId: id, initialTab: tab })}
                />
              ) : (
                renderLiteRow(p)
              )
            )}
          </div>
        )}

        {workbenchState && (
          <ProblemWorkbenchModal
            problemId={workbenchState.problemId}
            initialTab={workbenchState.initialTab}
            contextDate={date}
            contextSourceType={sourceType}
            contextSourceRef={sourceRef}
            targetWeekId={targetWeekId}
            onClose={() => setWorkbenchState(null)}
          />
        )}
      </div>
    );
  }

  // ================================================================
  // MODE 2: REVIEW / WEEKLY TRIAGE / ROADMAP PANEL
  // ================================================================
  const activeCount = displayedProblems.filter(p => p.status !== 'solved').length;

  return (
    <div className="rounded-2xl bg-slate-950/80 border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-orange-400">
              {title || 'Problems & Check-In'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 font-mono text-[10px] font-bold text-slate-300">
              {activeCount} active
            </span>
          </div>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {caps.problemsInboxLite && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('review');
                setReviewSubTab('problems');
              }}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-300 transition-colors"
            >
              <span>{fullEngine ? 'Open Problem Log' : 'Friction Inbox'}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}

          {(mode === 'weekly_triage' || mode === 'roadmap') && (
            <button
              type="button"
              onClick={() => setCollapsed(v => !v)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800"
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-4">
          {/* SECTION A: ACTIVE SOLUTIONS — DAILY CHECK-IN OR WEEKLY ROLLUP */}
          {activeFixesToCheck.length > 0 && (() => {
            const checkedInCount = activeFixesToCheck.filter(p =>
              Boolean(getProblemCheckInForDate(p, date))
            ).length;
            const allCheckedIn = checkedInCount === activeFixesToCheck.length;
            return (
            <div className="p-3.5 rounded-2xl bg-slate-900/75 border border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center space-x-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {isWeeklyRollup
                      ? `Week in Review · Active Solutions (${activeFixesToCheck.length})`
                      : `Testing Active Solutions (${activeFixesToCheck.length})`}
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {!isWeeklyRollup && (
                    <span
                      className={`px-2 py-0.5 rounded-full border font-mono text-[10px] font-bold ${
                        allCheckedIn
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                          : 'bg-slate-950 text-slate-300 border-slate-700'
                      }`}
                    >
                      {allCheckedIn
                        ? `✓ All checked in (${checkedInCount}/${activeFixesToCheck.length})`
                        : `${checkedInCount} / ${activeFixesToCheck.length} checked in`}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500">
                    {isWeeklyRollup
                      ? 'Weekly rollup of your daily check-ins — decide what to keep, revise, or resolve.'
                      : "Mark today's outcome, or jot a tweak without losing your check-in."}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {activeFixesToCheck.map(p => {
                  const testing = getSolutionTestingSummary(p, defaultVerifyTarget);
                  const rem = getProblemReminderText(p);
                  const act = getProblemActionText(p);
                  const checkInEntry = (p.checkIns || []).find(c => c.date === date);
                  const verdict = getProblemCheckInForDate(p, date);
                  const rowFlash = rowFlashById[p.id];
                  const weekStats =
                    isWeeklyRollup && dateRange
                      ? getSolutionPeriodSummary(p, dateRange.startDate, dateRange.endDate)
                      : null;
                  const drawerMode =
                    inlineDrawer?.problemId === p.id ? inlineDrawer.mode : null;
                  const isDoneDimmed = !isWeeklyRollup && Boolean(verdict) && !drawerMode;
                  const linkedActs = resolveProblemLinkedActions(
                    p.id,
                    weeklyPlans,
                    checklistItems,
                    todayDate,
                    selectedWeekId
                  );

                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl bg-slate-950 border border-slate-800/90 hover:border-slate-700 text-xs space-y-2.5 transition-all ${
                        isDoneDimmed ? 'opacity-75 hover:opacity-100' : ''
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                        <button
                          type="button"
                          onClick={() => setWorkbenchState({ problemId: p.id, initialTab: 'solution' })}
                          className="min-w-0 flex-1 text-left space-y-1 group"
                        >
                          <div className="font-bold text-slate-100 group-hover:text-amber-200 flex items-center space-x-1.5">
                            {rem ? (
                              <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            ) : (
                              <Wrench className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            )}
                            <span className="truncate">{rem || act || p.title}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 pl-5">
                            {testing.hasSolution && (
                              <span
                                className={`px-1.5 py-0.5 rounded-md border font-bold ${testing.badgeClass}`}
                              >
                                {testing.label}
                              </span>
                            )}
                            <span>Problem: {p.title}</span>
                            {linkedActs.slice(0, 2).map(la => (
                              <span
                                key={`${la.kind}_${la.id}`}
                                className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-sky-300 font-semibold"
                              >
                                {la.detail}
                              </span>
                            ))}
                            {rowFlash ? (
                              <span className="text-emerald-300 font-bold">{rowFlash}</span>
                            ) : (
                              !isWeeklyRollup &&
                              verdict && (
                                <span className="text-slate-400 font-semibold">· ✓ Checked in</span>
                              )
                            )}
                          </div>
                          {weekStats && (
                            <div className="pl-5 text-[10px] font-mono text-slate-400">
                              {weekStats.totalCheckIns > 0
                                ? `This week: Worked ${weekStats.workedCount}× · Quiet ${weekStats.quietCount}× · Failed ${weekStats.failedCount}×`
                                : 'No daily check-ins logged this week yet'}
                            </div>
                          )}
                          {testing.latestPendingTweak && (
                            <div className="pl-5 flex items-center gap-2 text-[10px] text-violet-300">
                              <span className="truncate">
                                Tweak idea ({testing.latestPendingTweak.date.slice(5)}): &ldquo;{testing.latestPendingTweak.note}&rdquo;
                              </span>
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={e => {
                                  e.stopPropagation();
                                  openReviseDrawer(p);
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.stopPropagation();
                                    openReviseDrawer(p);
                                  }
                                }}
                                className="px-1.5 py-0.5 rounded bg-violet-500/20 hover:bg-violet-500/35 text-violet-200 border border-violet-500/40 font-bold shrink-0 cursor-pointer"
                              >
                                Apply
                              </span>
                            </div>
                          )}
                        </button>

                        {isWeeklyRollup ? (
                          /* WEEKLY ROLLUP DECISION CONTROLS */
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {testing.readyToResolve && (
                              <button
                                type="button"
                                onClick={() => updateProblem(p.id, { status: 'solved', classified: true })}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-extrabold"
                              >
                                <Check className="w-3 h-3" />
                                <span>Resolve</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                drawerMode === 'revise' ? closeInlineDrawer() : openReviseDrawer(p)
                              }
                              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                                drawerMode === 'revise'
                                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                                  : testing.state === 'failed' || testing.pendingTweakCount > 0
                                  ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border-rose-500/35'
                                  : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-slate-800'
                              }`}
                            >
                              <Pencil className="w-3 h-3" />
                              <span>
                                {testing.state === 'failed' || testing.pendingTweakCount > 0
                                  ? 'Revise fix'
                                  : 'Revise / Tweak'}
                              </span>
                            </button>
                            {!testing.readyToResolve && (
                              <button
                                type="button"
                                onClick={() => updateProblem(p.id, { status: 'solved', classified: true })}
                                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-emerald-500/15 text-emerald-300 border border-slate-800 text-[11px] font-bold"
                              >
                                Resolve
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setWorkbenchState({ problemId: p.id, initialTab: 'solution' })}
                              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-bold"
                            >
                              Case
                            </button>
                          </div>
                        ) : (
                          /* DAILY REVIEW: 3-VERDICT SEGMENTED PILL + TWEAK PENCIL + CONTEXTUAL CTA */
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <div className="inline-flex items-center rounded-xl bg-slate-900 border border-slate-800 p-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextOutcome = verdict === 'effective' ? null : 'effective';
                                  recordProblemCheckIn(p.id, nextOutcome, { date, sourceType, sourceRef });
                                  flashRow(
                                    p.id,
                                    nextOutcome
                                      ? `✓ ${testing.effectiveCount + 1}/${testing.targetCount}× worked`
                                      : '↺ Cleared'
                                  );
                                }}
                                title={
                                  verdict === 'effective'
                                    ? 'Click to clear today’s check-in'
                                    : 'Situation came up and solution held'
                                }
                                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                  verdict === 'effective'
                                    ? 'bg-emerald-500 text-slate-950'
                                    : 'text-emerald-300 hover:bg-emerald-500/15'
                                }`}
                              >
                                <Check className="w-3 h-3" />
                                <span>Worked</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const nextOutcome =
                                    verdict === 'not_triggered' ? null : 'not_triggered';
                                  recordProblemCheckIn(p.id, nextOutcome, { date, sourceType, sourceRef });
                                  flashRow(p.id, nextOutcome ? '✓ Logged quiet' : '↺ Cleared');
                                }}
                                title={
                                  verdict === 'not_triggered'
                                    ? 'Click to clear today’s check-in'
                                    : 'Trigger did not come up today'
                                }
                                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                  verdict === 'not_triggered'
                                    ? 'bg-slate-200 text-slate-950'
                                    : 'text-slate-300 hover:bg-slate-800'
                                }`}
                              >
                                <Minus className="w-3 h-3" />
                                <span>Didn&apos;t come up</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCheckInFailed(p)}
                                title={
                                  verdict === 'failed'
                                    ? 'Click to undo today’s Failed check-in'
                                    : 'Solution did not hold today'
                                }
                                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                  verdict === 'failed'
                                    ? 'bg-rose-500 text-slate-950'
                                    : 'text-rose-300 hover:bg-rose-500/15'
                                }`}
                              >
                                <X className="w-3 h-3" />
                                <span>Failed</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (drawerMode === 'tweak_idea' || drawerMode === 'revise') {
                                  closeInlineDrawer();
                                } else {
                                  setInlineNoteDraft('');
                                  setInlineDrawer({ problemId: p.id, mode: 'tweak_idea' });
                                }
                              }}
                              title="Jot a tweak idea or revise active solution"
                              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                                drawerMode === 'tweak_idea' || drawerMode === 'revise'
                                  ? 'bg-violet-500 text-slate-950 border-violet-400'
                                  : checkInEntry?.tweakNote
                                  ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
                                  : 'bg-slate-900 hover:bg-violet-500/15 text-violet-300 border-slate-800'
                              }`}
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Tweak</span>
                              {checkInEntry?.tweakNote && drawerMode !== 'tweak_idea' && drawerMode !== 'revise' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                              )}
                            </button>

                            {testing.state === 'failed' && (
                              <button
                                type="button"
                                onClick={() => openReviseDrawer(p)}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/35 text-[11px] font-bold transition-colors"
                              >
                                Revise fix
                              </button>
                            )}

                            {testing.readyToResolve && (
                              <button
                                type="button"
                                onClick={() => updateProblem(p.id, { status: 'solved', classified: true })}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-extrabold transition-colors"
                              >
                                Resolve ✓
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* IN-CARD INLINE DRAWERS (Always directly inside this card!) */}
                      {drawerMode === 'tweak_idea' && (
                        <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30 space-y-2">
                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                            <input
                              type="text"
                              autoFocus
                              value={inlineNoteDraft}
                              onChange={e => setInlineNoteDraft(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && inlineNoteDraft.trim()) {
                                  e.preventDefault();
                                  handleSaveTweakIdea(p);
                                }
                                if (e.key === 'Escape') closeInlineDrawer();
                              }}
                              placeholder="Jot a tweak idea (keeps today's verdict intact)..."
                              className="flex-1 min-w-[180px] bg-slate-950 border border-violet-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={!inlineNoteDraft.trim()}
                              onClick={() => handleSaveTweakIdea(p)}
                              className="px-3 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0"
                            >
                              Save idea
                            </button>
                            <button
                              type="button"
                              onClick={() => openReviseDrawer(p)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-extrabold text-xs shrink-0"
                            >
                              Edit fix now
                            </button>
                            <button
                              type="button"
                              onClick={closeInlineDrawer}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-slate-400 border border-slate-800 text-xs font-bold shrink-0"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {drawerMode === 'revise' && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-300">
                            <span>
                              {hasActiveReminder(p) || getProblemReminderText(p)
                                ? 'Edit active Reminder'
                                : 'Edit active Action'}
                            </span>
                            <span className="text-slate-400 normal-case font-normal">
                              Replaces v{testing.version} cleanly &amp; clears pending tweak
                            </span>
                          </div>
                          <input
                            type="text"
                            autoFocus
                            value={inlineSolutionDraft}
                            onChange={e => setInlineSolutionDraft(e.target.value)}
                            placeholder="Write the updated reminder or concrete fix..."
                            className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={inlineNoteDraft}
                              onChange={e => setInlineNoteDraft(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && inlineSolutionDraft.trim()) {
                                  e.preventDefault();
                                  handleSaveRevisedFix(p);
                                }
                                if (e.key === 'Escape') closeInlineDrawer();
                              }}
                              placeholder="What changed / why? (optional)..."
                              className="flex-1 min-w-[160px] bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                            />
                            {testing.state !== 'failed' && (
                              <label className="inline-flex items-center space-x-1.5 text-[11px] text-slate-300 cursor-pointer select-none px-1">
                                <input
                                  type="checkbox"
                                  checked={inlineRestartTest}
                                  onChange={e => setInlineRestartTest(e.target.checked)}
                                  className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
                                />
                                <span>Reset count (v{testing.version + 1})</span>
                              </label>
                            )}
                            <button
                              type="button"
                              disabled={!inlineSolutionDraft.trim()}
                              onClick={() => handleSaveRevisedFix(p)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0"
                            >
                              Save revised fix
                            </button>
                            <button
                              type="button"
                              onClick={closeInlineDrawer}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-slate-400 border border-slate-800 text-xs font-bold shrink-0"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {drawerMode === 'failed_note' && (
                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-wrap sm:flex-nowrap items-center gap-2">
                          <input
                            type="text"
                            autoFocus
                            value={inlineNoteDraft}
                            onChange={e => setInlineNoteDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                recordProblemCheckIn(p.id, 'failed', {
                                  date,
                                  sourceType,
                                  ...(sourceRef ? { sourceRef } : {}),
                                  ...(inlineNoteDraft.trim() ? { note: inlineNoteDraft.trim() } : {})
                                });
                                closeInlineDrawer();
                              }
                              if (e.key === 'Escape') closeInlineDrawer();
                            }}
                            placeholder="Why didn't it hold today? (Enter to save)..."
                            className="flex-1 min-w-[180px] bg-slate-950 border border-rose-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              recordProblemCheckIn(p.id, 'failed', {
                                date,
                                sourceType,
                                ...(sourceRef ? { sourceRef } : {}),
                                ...(inlineNoteDraft.trim() ? { note: inlineNoteDraft.trim() } : {})
                              });
                              closeInlineDrawer();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-extrabold text-xs shrink-0"
                          >
                            Save Failed
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              recordProblemCheckIn(p.id, 'failed', {
                                date,
                                sourceType,
                                ...(sourceRef ? { sourceRef } : {})
                              });
                              closeInlineDrawer();
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-slate-300 border border-slate-800 text-xs font-bold shrink-0"
                          >
                            Skip note
                          </button>
                          <button
                            type="button"
                            onClick={closeInlineDrawer}
                            className="px-2 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-bold shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })()}

          {/* SECTION B: CHECK IN ON ACTIVELY OBSERVED PROBLEMS */}
          {observingToCheck.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-900/75 border border-sky-500/25 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-300 flex items-center space-x-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    {isWeeklyRollup
                      ? `Observing This Week (${observingToCheck.length})`
                      : `Observing — Did You Learn Anything Today? (${observingToCheck.length})`}
                  </span>
                </span>
              </div>

              <div className="space-y-2">
                {observingToCheck.map(p => {
                  const timeline = getClusterOccurrenceTimeline(problems, p);
                  const latestClue = timeline.find(o => o.note?.trim());
                  const cluesInRange =
                    isWeeklyRollup && dateRange
                      ? timeline.filter(
                          o => o.note?.trim() && o.date >= dateRange.startDate && o.date <= dateRange.endDate
                        ).length
                      : 0;
                  const verdict = getProblemCheckInForDate(p, date);
                  const isClueDrawerOpen =
                    inlineDrawer?.problemId === p.id && inlineDrawer.mode === 'clue';
                  const isObsDimmed = !isWeeklyRollup && verdict === 'not_triggered' && !isClueDrawerOpen;
                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl bg-slate-950 border border-slate-800/90 hover:border-slate-700 text-xs space-y-2 transition-all ${
                        isObsDimmed ? 'opacity-75 hover:opacity-100' : ''
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setWorkbenchState({ problemId: p.id })}
                          className="min-w-0 flex-1 text-left space-y-0.5 group"
                        >
                          <div className="font-bold text-sky-100 group-hover:text-sky-200 truncate">
                            {p.watchQuestion?.trim() || p.title}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {p.watchQuestion?.trim() ? `Problem: ${p.title}` : 'Watching for patterns'}
                            {isWeeklyRollup && cluesInRange > 0 ? ` · ${cluesInRange} clue(s) this week` : ''}
                            {latestClue?.note ? ` · Last clue (${latestClue.date.slice(5)}): "${latestClue.note}"` : ''}
                          </div>
                        </button>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (isClueDrawerOpen) {
                                closeInlineDrawer();
                              } else {
                                setInlineNoteDraft('');
                                setInlineDrawer({ problemId: p.id, mode: 'clue' });
                              }
                            }}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                              isClueDrawerOpen
                                ? 'bg-sky-500 text-slate-950 border-sky-400'
                                : 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border-sky-500/35'
                            }`}
                          >
                            <MessageSquarePlus className="w-3 h-3" />
                            <span>+ Add clue</span>
                          </button>
                          {!isWeeklyRollup && (
                            <button
                              type="button"
                              onClick={() =>
                                recordProblemCheckIn(
                                  p.id,
                                  verdict === 'not_triggered' ? null : 'not_triggered',
                                  { date, sourceType, sourceRef }
                                )
                              }
                              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                                verdict === 'not_triggered'
                                  ? 'bg-slate-200 text-slate-950 border-slate-100'
                                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                              }`}
                            >
                              <Minus className="w-3 h-3" />
                              <span>Nothing happened</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setWorkbenchState({ problemId: p.id })}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 text-[11px] font-bold"
                          >
                            <span>Design solution</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {isClueDrawerOpen && (
                        <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 flex flex-wrap sm:flex-nowrap items-center gap-2">
                          <input
                            type="text"
                            autoFocus
                            value={inlineNoteDraft}
                            onChange={e => setInlineNoteDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && inlineNoteDraft.trim()) {
                                e.preventDefault();
                                recordProblemRecurrence(p.id, {
                                  date,
                                  sourceType,
                                  ...(sourceRef ? { sourceRef } : {}),
                                  note: inlineNoteDraft.trim()
                                });
                                closeInlineDrawer();
                              }
                              if (e.key === 'Escape') closeInlineDrawer();
                            }}
                            placeholder="What clue did you observe? (Enter to save)..."
                            className="flex-1 min-w-[180px] bg-slate-950 border border-sky-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={!inlineNoteDraft.trim()}
                            onClick={() => {
                              if (!inlineNoteDraft.trim()) return;
                              recordProblemRecurrence(p.id, {
                                date,
                                sourceType,
                                ...(sourceRef ? { sourceRef } : {}),
                                note: inlineNoteDraft.trim()
                              });
                              closeInlineDrawer();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0"
                          >
                            Save Clue
                          </button>
                          <button
                            type="button"
                            onClick={closeInlineDrawer}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-slate-400 border border-slate-800 text-xs font-bold shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {renderNotePromptBanner()}

          {/* Pure 1-Line Raw Capture Bar */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleLogProblem();
                }
              }}
              placeholder={
                sourceType === 'daily'
                  ? 'Record a new friction from today & press Enter (classify later)...'
                  : 'Record a problem or recurring pattern & press Enter...'
              }
              className="flex-1 bg-slate-900 border border-slate-800 focus:border-orange-500/50 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleLogProblem}
              disabled={!textValue.trim()}
              className="inline-flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record</span>
            </button>
          </div>

          {/* 1-Click "Happened again" Chips */}
          {quickRecurCandidates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Happened again:
              </span>
              {quickRecurCandidates.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleQuickRecur(p)}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-orange-500/15 border border-slate-800 hover:border-orange-500/35 text-[11px] text-slate-300 hover:text-orange-200 transition-colors"
                >
                  {fullEngine && p.isTopConstraint && <Crosshair className="w-3 h-3 text-rose-400 shrink-0" />}
                  <span className="truncate max-w-[200px]">{p.title}</span>
                  <span className="font-mono text-[10px] text-orange-400 font-bold">
                    ({getClusterTotalHits(problems, p)})
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Logged for this scope */}
          {displayedProblems.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-900/50 border border-dashed border-slate-800 text-xs text-slate-500 text-center">
              No {fullEngine ? 'problems' : 'frictions'} recorded specifically for this {sourceType} scope yet.
            </div>
          ) : (
            <div className="space-y-2">
              {displayedProblems.map(p =>
                fullEngine ? (
                  <ProblemItemRow
                    key={p.id}
                    problem={p}
                    contextDate={date}
                    contextSourceType={sourceType}
                    contextSourceRef={sourceRef}
                    targetWeekId={targetWeekId}
                    periodOccurrenceCount={
                      dateRange
                        ? countClusterOccurrencesInRange(problems, p, dateRange.startDate, dateRange.endDate)
                        : undefined
                    }
                    compact={mode === 'roadmap'}
                    onOpenWorkbench={(id, tab) => setWorkbenchState({ problemId: id, initialTab: tab })}
                  />
                ) : (
                  renderLiteRow(p)
                )
              )}
            </div>
          )}

          {isMacroReview && hiddenSlipCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllMacroSlips(v => !v)}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-200"
            >
              {showAllMacroSlips
                ? 'Hide unclassified raw notes ↑'
                : `+ Show ${hiddenSlipCount} unclassified raw note${hiddenSlipCount === 1 ? '' : 's'} from this period`}
            </button>
          )}
        </div>
      )}

      {workbenchState && (
        <ProblemWorkbenchModal
          problemId={workbenchState.problemId}
          initialTab={workbenchState.initialTab}
          contextDate={date}
          contextSourceType={sourceType}
          contextSourceRef={sourceRef}
          targetWeekId={targetWeekId}
          onClose={() => setWorkbenchState(null)}
        />
      )}
    </div>
  );
};
