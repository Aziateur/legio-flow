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
    weeklyPlans,
    checklistItems,
    selectedWeekId,
    addProblem,
    recordProblemRecurrence,
    recordProblemCheckIn,
    updateProblem,
    deleteProblem,
    setActiveTab,
    setReviewSubTab
  } = useStorage();

  const caps = getLevelCapabilities(systemLevel);
  const fullEngine = caps.problemsConstraintEngine;

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

  // Per-problem note-on-hit / clue / tweak prompt
  const [notePromptTarget, setNotePromptTarget] = useState<{
    problem: ProblemEntry;
    kind: 'recur' | 'failed_checkin' | 'clue' | 'tweak';
  } | null>(null);
  const [notePromptDraft, setNotePromptDraft] = useState('');
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

  const handleCheckInFailed = (prob: ProblemEntry) => {
    if (shouldPromptNoteOnHit(prob)) {
      setNotePromptTarget({ problem: prob, kind: 'failed_checkin' });
      setNotePromptDraft('');
      return;
    }
    recordProblemCheckIn(prob.id, 'failed', {
      date,
      sourceType,
      ...(sourceRef ? { sourceRef } : {})
    });
  };

  const commitPromptedNote = (note?: string, applyToFix = false) => {
    if (!notePromptTarget) return;
    const { problem: target, kind } = notePromptTarget;
    const trimmed = note?.trim();
    if (kind === 'tweak') {
      recordProblemCheckIn(target.id, 'tweaked', {
        date,
        sourceType,
        ...(sourceRef ? { sourceRef } : {}),
        ...(trimmed ? { note: trimmed } : {})
      });
      if (applyToFix && trimmed) {
        const curRem = getProblemReminderText(target);
        const curAct = getProblemActionText(target);
        const patch: Partial<ProblemEntry> = {};
        if (hasActiveReminder(target) && curRem) {
          patch.isGuardrail = true;
          patch.reminderText = `${curRem} — ${trimmed}`;
        } else if (hasActiveAction(target) && curAct) {
          patch.fixNote = `${curAct} — ${trimmed}`;
        } else if (curRem) {
          patch.isGuardrail = true;
          patch.reminderText = `${curRem} — ${trimmed}`;
        } else {
          patch.fixNote = trimmed;
        }
        if (target.status === 'open') {
          patch.status = 'testing';
          patch.fixStartedAt = todayDate;
        }
        updateProblem(target.id, patch);
      }
    } else if (kind === 'failed_checkin') {
      recordProblemCheckIn(target.id, 'failed', {
        date,
        sourceType,
        ...(sourceRef ? { sourceRef } : {}),
        ...(trimmed ? { note: trimmed } : {})
      });
    } else {
      recordProblemRecurrence(target.id, {
        date,
        sourceType,
        ...(sourceRef ? { sourceRef } : {}),
        ...(trimmed ? { note: trimmed } : {})
      });
    }
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
    const isTweak = notePromptTarget.kind === 'tweak';
    const currentSolution =
      getProblemReminderText(notePromptTarget.problem) ||
      getProblemActionText(notePromptTarget.problem);

    return (
      <div
        className={`p-3 rounded-xl border space-y-2 ${
          isTweak ? 'bg-violet-500/10 border-violet-500/35' : 'bg-sky-500/10 border-sky-500/35'
        }`}
      >
        <div className="space-y-0.5">
          <div className={`text-[11px] font-bold ${isTweak ? 'text-violet-200' : 'text-sky-200'}`}>
            {isTweak
              ? `Note a tweak to improve "${notePromptTarget.problem.title}":`
              : notePromptTarget.kind === 'failed_checkin'
              ? `Why didn’t it work for "${notePromptTarget.problem.title}"?`
              : notePromptTarget.kind === 'clue'
              ? `Log observation clue for "${notePromptTarget.problem.title}":`
              : `What happened with "${notePromptTarget.problem.title}"?`}
          </div>
          {isTweak && currentSolution && (
            <div className="text-[10px] text-slate-400 truncate">
              Current fix: {currentSolution}
            </div>
          )}
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
                commitPromptedNote(notePromptDraft, false);
              }
              if (e.key === 'Escape') {
                setNotePromptTarget(null);
                setNotePromptDraft('');
              }
            }}
            placeholder={
              isTweak
                ? 'What tweak would improve this solution? (Enter to save)...'
                : '1-line context note (Enter to save)...'
            }
            className={`flex-1 min-w-[180px] bg-slate-950 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none border ${
              isTweak ? 'border-violet-500/40' : 'border-sky-500/40'
            }`}
          />
          {isTweak ? (
            <>
              <button
                type="button"
                onClick={() => commitPromptedNote(notePromptDraft, false)}
                className="px-3 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-slate-950 font-extrabold text-xs shrink-0"
              >
                Save tweak
              </button>
              <button
                type="button"
                onClick={() => commitPromptedNote(notePromptDraft, true)}
                disabled={!notePromptDraft.trim()}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-200 border border-amber-500/40 font-extrabold text-xs shrink-0"
              >
                Save &amp; update fix
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotePromptTarget(null);
                  setNotePromptDraft('');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-slate-300 border border-slate-800 text-xs font-bold shrink-0"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
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
          {/* SECTION A: 4-WAY CHECK-IN ON ACTIVE SOLUTIONS (Review Step!) */}
          {activeFixesToCheck.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-900/75 border border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 flex items-center space-x-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-400" />
                  <span>Testing Active Solutions ({activeFixesToCheck.length})</span>
                </span>
                <span className="text-[10px] text-slate-500">
                  Did your solution work, not come up, need a tweak, or fail?
                </span>
              </div>

              <div className="space-y-2">
                {activeFixesToCheck.map(p => {
                  const testing = getSolutionTestingSummary(p);
                  const rem = getProblemReminderText(p);
                  const act = getProblemActionText(p);
                  const verdict = getProblemCheckInForDate(p, date);
                  const isTweakOpenForThis =
                    notePromptTarget?.problem.id === p.id && notePromptTarget.kind === 'tweak';
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
                      className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800/90 text-xs"
                    >
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
                        </div>
                        {testing.latestTweak && (
                          <div className="pl-5 text-[10px] text-violet-300 truncate">
                            Tweak ({testing.latestTweak.date.slice(5)}): &ldquo;{testing.latestTweak.note}&rdquo;
                          </div>
                        )}
                      </button>

                      {/* 4-WAY CHECK-IN BUTTONS */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            recordProblemCheckIn(p.id, 'effective', { date, sourceType, sourceRef })
                          }
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
                          onClick={() =>
                            recordProblemCheckIn(p.id, 'not_triggered', { date, sourceType, sourceRef })
                          }
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                            verdict === 'not_triggered'
                              ? 'bg-slate-200 text-slate-950 border-slate-100'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                          }`}
                        >
                          <Minus className="w-3 h-3" />
                          <span>Didn&apos;t come up</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (isTweakOpenForThis) {
                              setNotePromptTarget(null);
                              setNotePromptDraft('');
                            } else {
                              setNotePromptTarget({ problem: p, kind: 'tweak' });
                              setNotePromptDraft('');
                            }
                          }}
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
                          onClick={() => handleCheckInFailed(p)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                            verdict === 'failed'
                              ? 'bg-rose-500 text-slate-950 border-rose-400'
                              : 'bg-slate-900 hover:bg-rose-500/15 text-rose-300 border-slate-800'
                          }`}
                        >
                          <X className="w-3 h-3" />
                          <span>Failed</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setWorkbenchState({ problemId: p.id, initialTab: 'solution' })}
                          className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                            testing.state === 'failed'
                              ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border-rose-500/35'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                          }`}
                        >
                          {testing.state === 'failed' ? 'Rethink fix →' : 'Edit fix'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION B: CHECK IN ON ACTIVELY OBSERVED PROBLEMS */}
          {observingToCheck.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-900/75 border border-sky-500/25 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-300 flex items-center space-x-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span>Observing — Did You Learn Anything Today? ({observingToCheck.length})</span>
                </span>
              </div>

              <div className="space-y-2">
                {observingToCheck.map(p => {
                  const latestClue = getClusterOccurrenceTimeline(problems, p).find(o => o.note?.trim());
                  const verdict = getProblemCheckInForDate(p, date);
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800/90 text-xs"
                    >
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
                          {latestClue?.note ? ` · Last clue (${latestClue.date.slice(5)}): "${latestClue.note}"` : ''}
                        </div>
                      </button>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setNotePromptTarget({ problem: p, kind: 'clue' });
                            setNotePromptDraft('');
                          }}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-500/35 text-[11px] font-bold"
                        >
                          <MessageSquarePlus className="w-3 h-3" />
                          <span>+ Add clue</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            recordProblemCheckIn(p.id, 'not_triggered', { date, sourceType, sourceRef })
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
