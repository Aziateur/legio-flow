import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ProblemCategory,
  ProblemDispatchTarget,
  ProblemSeverity,
  ProblemSourceType
} from '../../types/schema';
import {
  DISPATCH_TARGET_LABELS,
  PROBLEM_SEVERITIES,
  SEVERITY_META,
  SEVERITY_VISUAL,
  getAbsorbableProblems,
  getClusterOccurrenceTimeline,
  getDirectChildren,
  getEligibleClusterTargets,
  getProblemActionText,
  getProblemCheckInForDate,
  getProblemReminderText,
  getProblemSeverity,
  getSolutionTestingSummary,
  hasActiveAction,
  hasActiveReminder,
  isProblemClassified,
  isProblemWatching,
  normalizeTag,
  resolveCategoryMeta,
  resolveProblemLinkedActions,
  resolveProblemRoadmapPlanId,
  severityToImpact,
  shouldPromptNoteOnHit,
  tagsMatch
} from '../../lib/problems';
import {
  getWeeklyGoalsAssignedToRoadmap,
  isActiveStrategyPlan,
  sortStrategyPlansByPriority
} from '../../lib/planHierarchy';
import { useStorage } from '../../context/StorageContext';
import { ProblemPulseBar } from './ProblemPulseBar';
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Crosshair,
  Eye,
  History,
  Layers,
  Map as MapIcon,
  MessageSquarePlus,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Tag,
  Trash2,
  Unlink,
  Wrench,
  X
} from 'lucide-react';

export type WorkbenchTab = 'classify' | 'observations' | 'solution';

interface ProblemWorkbenchModalProps {
  problemId: string;
  initialTab?: WorkbenchTab;
  contextDate: string;
  contextSourceType?: ProblemSourceType;
  contextSourceRef?: string;
  targetWeekId?: string;
  onClose: () => void;
}

const PROOF_TARGETS = [3, 5, 10];

const ACTION_DESTINATIONS: Array<{
  target: ProblemDispatchTarget;
  label: string;
  hint: string;
}> = [
  { target: 'weekly_plan', label: 'Weekly Plan', hint: 'One-time work or setup (routes inside Roadmap goal)' },
  { target: 'checklist_oneoff', label: 'One-Off Task', hint: 'Simple checklist action' },
  { target: 'checklist_daily', label: 'Daily Habit', hint: 'Daily routine / rewire' },
  { target: 'checklist_weekly', label: 'Weekly Habit', hint: 'Weekly maintenance routine' },
  { target: 'reps_board', label: 'Reps Board', hint: 'Skill volume / practice reps' }
];

const SOURCE_LABELS: Record<ProblemSourceType, string> = {
  gws: 'GWS',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  roadmap: 'Roadmap'
};

export const ProblemWorkbenchModal: React.FC<ProblemWorkbenchModalProps> = ({
  problemId,
  contextDate,
  contextSourceType = 'daily',
  contextSourceRef,
  targetWeekId,
  onClose
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
    recordProblemCheckIn,
    noteProblemTweak,
    reviseProblemSolution,
    clusterIntoNewParent,
    deleteProblem,
    deleteProblemOccurrence,
    deleteProblemCheckIn,
    deleteProblemFixAttempt,
    dispatchProblemFix
  } = useStorage();

  const problem = problems.find(p => p.id === problemId);

  const [titleDraft, setTitleDraft] = useState(problem?.title || '');
  const [watchQuestionDraft, setWatchQuestionDraft] = useState(problem?.watchQuestion || '');
  const [triggerDraft, setTriggerDraft] = useState(problem?.trigger || '');
  const [rootCauseDraft, setRootCauseDraft] = useState(problem?.rootCause || '');
  const [reminderDraft, setReminderDraft] = useState(problem ? getProblemReminderText(problem) : '');
  const [actionDraft, setActionDraft] = useState(problem ? getProblemActionText(problem) : '');
  const [clueDraft, setClueDraft] = useState('');
  const [tweakMode, setTweakMode] = useState<'closed' | 'idea' | 'revise'>('closed');
  const [tweakIdeaDraft, setTweakIdeaDraft] = useState('');
  const [reviseRemDraft, setReviseRemDraft] = useState('');
  const [reviseActDraft, setReviseActDraft] = useState('');
  const [reviseNoteDraft, setReviseNoteDraft] = useState('');
  const [reviseRestartTest, setReviseRestartTest] = useState(false);
  const [observingExpanded, setObservingExpanded] = useState<boolean>(() =>
    problem ? !hasActiveReminder(problem) && !hasActiveAction(problem) && problem.status !== 'testing' : true
  );
  const [tagInput, setTagInput] = useState('');
  const [newParentTitle, setNewParentTitle] = useState('');
  const [severityPickerOpen, setSeverityPickerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showAttempts, setShowAttempts] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!problem) return;
    setTitleDraft(problem.title);
    setWatchQuestionDraft(problem.watchQuestion || '');
    setTriggerDraft(problem.trigger || '');
    setRootCauseDraft(problem.rootCause || '');
    setReminderDraft(getProblemReminderText(problem));
    setActionDraft(getProblemActionText(problem));
    setSeverityPickerOpen(false);
    setTweakMode('closed');
    setTweakIdeaDraft('');
    setReviseRemDraft('');
    setReviseActDraft('');
    setReviseNoteDraft('');
    setReviseRestartTest(false);
    setObservingExpanded(!hasActiveReminder(problem) && !hasActiveAction(problem) && problem.status !== 'testing');
  }, [problem?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activeRoadmaps = useMemo(
    () => sortStrategyPlansByPriority(strategyPlans.filter(isActiveStrategyPlan)),
    [strategyPlans]
  );

  if (!problem) return null;

  const isClassified = isProblemClassified(problems, problem);
  const severity = getProblemSeverity(problem);
  const severityMeta = SEVERITY_META[severity];
  const severityVisual = SEVERITY_VISUAL[severity];
  const catMeta = resolveCategoryMeta(problem.category, problemCategories);
  const maxTop = problemSettings.maxTopConstraints || 3;
  const defaultVerifyTarget = problemSettings.defaultVerifyTarget || 5;
  const currentTopCount = problems.filter(p => p.isTopConstraint && p.status !== 'solved').length;

  const watchingActive = isProblemWatching(problem);
  const promptNoteActive = shouldPromptNoteOnHit(problem);
  const reminderActive = hasActiveReminder(problem);
  const actionActive = hasActiveAction(problem);
  const testingSummary = getSolutionTestingSummary(problem, defaultVerifyTarget);
  const timeline = getClusterOccurrenceTimeline(problems, problem);
  const directChildren = getDirectChildren(problems, problem.id);
  const parentProblem = problem.parentProblemId
    ? problems.find(p => p.id === problem.parentProblemId)
    : undefined;
  const clusterTargets = getEligibleClusterTargets(problems, problem.id);
  const absorbable = getAbsorbableProblems(problems, problem.id);
  const resolvedRoadmapId = resolveProblemRoadmapPlanId(problem, strategyPlans);
  const linkedRoadmap = resolvedRoadmapId
    ? strategyPlans.find(sp => sp.id === resolvedRoadmapId)
    : undefined;
  const roadmapTitles = activeRoadmaps.map(p => p.title.trim()).filter(Boolean);
  const isRoadmapTag = (tag: string) => roadmapTitles.some(rt => tagsMatch(rt, tag));
  const checkInVerdict = getProblemCheckInForDate(problem, contextDate);
  const allAttempts = problem.fixAttempts || [];
  const failedAttempts = allAttempts.filter(a => a.outcome === 'failed');

  const linkedActions = resolveProblemLinkedActions(
    problem.id,
    weeklyPlans,
    checklistItems,
    todayDate,
    selectedWeekId
  );

  // Merge dated clues + checkIns (plus legacy heldDates) into a single chronological log
  const checkInDateSet = new Set((problem.checkIns || []).map(c => c.date));
  const legacyHeldCheckIns = (problem.heldDates || [])
    .filter(d => !checkInDateSet.has(d))
    .map((d, idx) => ({
      kind: 'effective' as const,
      key: `held_${d}_${idx}`,
      date: d,
      sourceLabel: 'Check-In',
      note: undefined as string | undefined,
      tweakNote: undefined as string | undefined,
      tweakApplied: false,
      fromSlipTitle: undefined as string | undefined,
      problemId: problem.id,
      occurrenceIndex: -1
    }));

  const combinedTimeline = [
    ...timeline.map((item, idx) => ({
      kind: 'hit' as const,
      key: `hit_${item.problemId}_${item.occurrenceIndex}_${item.date}_${idx}`,
      date: item.date,
      sourceLabel: SOURCE_LABELS[item.sourceType] || item.sourceType,
      note: item.note,
      tweakNote: undefined as string | undefined,
      tweakApplied: false,
      fromSlipTitle: item.fromSlipTitle,
      problemId: item.problemId,
      occurrenceIndex: item.occurrenceIndex
    })),
    ...(problem.checkIns || [])
      .filter(c => c.outcome !== 'failed')
      .map((c, idx) => ({
        kind: c.outcome,
        key: `chk_${c.date}_${idx}`,
        date: c.date,
        sourceLabel: 'Check-In',
        note: c.note,
        tweakNote: c.tweakNote,
        tweakApplied: Boolean(c.tweakApplied),
        fromSlipTitle: undefined as string | undefined,
        problemId: problem.id,
        occurrenceIndex: -1
      })),
    ...legacyHeldCheckIns
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2400);
  };

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== problem.title) {
      updateProblem(problem.id, { title: trimmed });
    }
  };

  const handleSelectSeverity = (grade: ProblemSeverity) => {
    updateProblem(problem.id, {
      classified: true,
      severity: grade,
      impact: severityToImpact(grade),
      scale: grade >= 5 ? 'blocker' : grade >= 3 ? 'bottleneck' : 'friction'
    });
    setSeverityPickerOpen(false);
  };

  const handleSelectCategory = (catId: ProblemCategory) => {
    updateProblem(problem.id, {
      classified: true,
      category: catId
    });
  };

  const handleToggleRoadmap = (planId: string, planTitle: string) => {
    const cleanTitle = normalizeTag(planTitle);
    if (resolvedRoadmapId === planId) {
      updateProblem(problem.id, {
        roadmapPlanId: undefined,
        tags: cleanTitle ? problem.tags.filter(t => !tagsMatch(t, cleanTitle)) : problem.tags
      });
    } else {
      const prevTitle = linkedRoadmap?.title ? normalizeTag(linkedRoadmap.title) : '';
      const baseTags = prevTitle
        ? problem.tags.filter(t => !tagsMatch(t, prevTitle))
        : problem.tags;
      const nextTags =
        cleanTitle && !baseTags.some(t => tagsMatch(t, cleanTitle))
          ? [cleanTitle, ...baseTags]
          : baseTags;
      updateProblem(problem.id, {
        classified: true,
        roadmapPlanId: planId,
        tags: nextTags
      });
    }
  };

  const handleAddTag = () => {
    const cleaned = normalizeTag(tagInput);
    if (!cleaned) return;
    if (!problem.tags.some(t => tagsMatch(t, cleaned))) {
      updateProblem(problem.id, { tags: [...problem.tags, cleaned] });
    }
    setTagInput('');
  };

  const handleToggleTopFocus = () => {
    if (problem.isTopConstraint) {
      updateProblem(problem.id, { isTopConstraint: false });
      showToast('Moved back to Backlog');
      return;
    }
    if (currentTopCount >= maxTop) {
      showToast(`Top ${maxTop} Focus is full — unpin one first`);
      return;
    }
    updateProblem(problem.id, {
      classified: true,
      isTopConstraint: true,
      scale: problem.scale === 'blocker' ? 'blocker' : 'bottleneck',
      ...(problem.status === 'solved' ? { status: 'open' } : {})
    });
    showToast('Pinned to Top 3 Focus');
  };

  const handleToggleWatching = () => {
    const nextVal = !watchingActive;
    updateProblem(problem.id, {
      classified: true,
      watching: nextVal,
      ...(nextVal ? { promptNoteOnHit: true } : {}),
      ...(watchQuestionDraft.trim() ? { watchQuestion: watchQuestionDraft.trim() } : {})
    });
    showToast(
      nextVal
        ? 'Now Watching across Daily, GWS, Weekly & Reviews'
        : 'Stopped active Watching'
    );
  };

  const handleSaveReminder = (overrideActive?: boolean) => {
    const trimmed = reminderDraft.trim();
    const nextActive = overrideActive !== undefined ? overrideActive : Boolean(trimmed);
    const trimmedTrigger = triggerDraft.trim();
    const existingRem = getProblemReminderText(problem);

    if (nextActive && reminderActive && existingRem && (trimmed || problem.title) !== existingRem) {
      const finalRem = trimmed || problem.title;
      reviseProblemSolution(problem.id, {
        reminderText: finalRem,
        ...(trimmedTrigger !== (problem.trigger || '').trim() ? { trigger: trimmedTrigger } : {}),
        date: todayDate
      });
      showToast('Reminder revised cleanly');
      return;
    }

    updateProblem(problem.id, {
      classified: true,
      isGuardrail: nextActive,
      reminderText: nextActive ? trimmed || problem.title : '',
      ...(trimmedTrigger ? { trigger: trimmedTrigger } : {}),
      ...(nextActive && problem.status === 'open'
        ? { status: 'testing', fixStartedAt: todayDate }
        : {})
    });
    showToast(
      nextActive
        ? 'Reminder active across Daily Plan, GWS Studio & Weekly Plan'
        : 'Reminder turned off'
    );
  };

  const handleSaveActionNote = () => {
    const trimmed = actionDraft.trim();
    const existingAct = getProblemActionText(problem);
    if (trimmed === existingAct) return;
    if (actionActive && existingAct && trimmed) {
      reviseProblemSolution(problem.id, {
        fixNote: trimmed,
        date: todayDate
      });
      showToast('Action revised & synced');
      return;
    }
    updateProblem(problem.id, {
      classified: true,
      fixNote: trimmed,
      ...(trimmed && problem.status === 'open'
        ? { status: 'testing', fixStartedAt: todayDate }
        : {})
    });
    if (trimmed) showToast('Action saved');
  };

  const handleDispatchAction = (target: ProblemDispatchTarget) => {
    const textToSend = actionDraft.trim() || getProblemActionText(problem) || problem.title;
    if (actionDraft.trim() && actionDraft.trim() !== getProblemActionText(problem)) {
      updateProblem(problem.id, { classified: true, fixNote: actionDraft.trim() });
    } else if (!isClassified) {
      updateProblem(problem.id, { classified: true });
    }
    const ok = dispatchProblemFix(problem.id, target, textToSend, targetWeekId);
    if (ok) {
      let msg = `Linked to ${DISPATCH_TARGET_LABELS[target]}`;
      if (target === 'weekly_plan' && resolvedRoadmapId) {
        const wPlan = weeklyPlans[targetWeekId || selectedWeekId];
        const container = getWeeklyGoalsAssignedToRoadmap(wPlan, resolvedRoadmapId)[0];
        if (container) {
          msg = `Linked inside "${container.text.slice(0, 26)}${container.text.length > 26 ? '…' : ''}"`;
        }
      }
      showToast(msg);
    }
  };

  const handleAddClue = (withNote: boolean) => {
    const note = withNote ? clueDraft.trim() : '';
    recordProblemRecurrence(problem.id, {
      date: contextDate,
      sourceType: contextSourceType,
      ...(contextSourceRef ? { sourceRef: contextSourceRef } : {}),
      ...(note ? { note } : {})
    });
    setClueDraft('');
    showToast(note ? 'Clue saved to Case File' : 'Occurrence logged');
  };

  const handleFinishClassification = (enableWatch: boolean) => {
    updateProblem(problem.id, {
      classified: true,
      severity,
      impact: severityToImpact(severity),
      scale: severity >= 5 ? 'blocker' : severity >= 3 ? 'bottleneck' : 'friction',
      ...(enableWatch ? { watching: true, promptNoteOnHit: true } : {})
    });
    showToast(enableWatch ? 'Classified & Watching ON' : 'Classified');
  };

  const renderClassificationControls = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-extrabold uppercase tracking-wider text-slate-300 block">
          How bad is this problem?
        </label>
        <div className="grid grid-cols-5 gap-2">
          {PROBLEM_SEVERITIES.map(sv => {
            const vis = SEVERITY_VISUAL[sv.grade];
            const selected = severity === sv.grade;
            return (
              <button
                key={sv.grade}
                type="button"
                onClick={() => handleSelectSeverity(sv.grade)}
                className={`px-2 py-2.5 rounded-xl border text-center transition-all ${
                  selected
                    ? sv.activeChipClass + ' shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-extrabold">{vis.word}</div>
                <div className={`text-[10px] font-mono mt-0.5 ${selected ? 'opacity-80' : 'text-slate-600'}`}>
                  {sv.grade}/5
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 pl-0.5">{severityMeta.hint}</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-extrabold uppercase tracking-wider text-slate-300 block">
          Category
        </label>
        <div className="flex flex-wrap gap-2">
          {problemCategories.map(c => {
            const meta = resolveCategoryMeta(c.id, problemCategories);
            const active = problem.category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectCategory(c.id as ProblemCategory)}
                title={c.hint}
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  active
                    ? meta.activeChipClass
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${active ? 'bg-slate-950' : meta.dotClass}`} />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-extrabold uppercase tracking-wider text-slate-300 block">
          Roadmap &amp; Tags <span className="text-slate-500 font-normal normal-case">(optional)</span>
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {activeRoadmaps.map(sp => {
            const active = resolvedRoadmapId === sp.id;
            return (
              <button
                key={sp.id}
                type="button"
                onClick={() => handleToggleRoadmap(sp.id, sp.title)}
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  active
                    ? 'bg-amber-500/20 text-amber-200 border-amber-500/50'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <MapIcon className="w-3 h-3" />
                <span>{sp.title}</span>
              </button>
            );
          })}
          {problem.tags
            .filter(t => !isRoadmapTag(t))
            .map(tag => (
              <span
                key={tag}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold"
              >
                <span>#{tag}</span>
                <button
                  type="button"
                  onClick={() => updateProblem(problem.id, { tags: problem.tags.filter(t => !tagsMatch(t, tag)) })}
                  className="text-slate-400 hover:text-rose-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          <div className="inline-flex items-center bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
            <Tag className="w-3 h-3 text-slate-500 mr-1.5" />
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="+ tag"
              className="bg-transparent text-xs text-slate-200 placeholder-slate-600 focus:outline-none w-20"
            />
            {tagInput.trim() && (
              <button type="button" onClick={handleAddTag} className="text-amber-400 ml-1">
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Group / Cluster */}
      <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
        <div className="flex items-center space-x-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>Group Related Notes</span>
        </div>

        {parentProblem && (
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
            <span className="text-amber-200 font-semibold">
              Inside: <strong>{parentProblem.title}</strong>
            </span>
            <button
              type="button"
              onClick={() => updateProblem(problem.id, { parentProblemId: undefined })}
              className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-900 text-slate-300 hover:text-amber-300 text-[11px] font-bold"
            >
              <Unlink className="w-3 h-3" />
              <span>Separate</span>
            </button>
          </div>
        )}

        {directChildren.length > 0 && (
          <div className="space-y-1">
            {directChildren.map(child => (
              <div
                key={child.id}
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
              >
                <span className="inline-flex items-center space-x-1.5 text-slate-200 truncate">
                  <CornerDownRight className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">{child.title}</span>
                </span>
                <button
                  type="button"
                  onClick={() => updateProblem(child.id, { parentProblemId: undefined })}
                  className="text-[11px] text-slate-400 hover:text-amber-300 font-bold shrink-0"
                >
                  Unlink
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {clusterTargets.roots.length + clusterTargets.frictions.length > 0 && (
            <select
              value={problem.parentProblemId || ''}
              onChange={e => {
                if (!e.target.value) {
                  updateProblem(problem.id, { parentProblemId: undefined });
                  return;
                }
                updateProblem(e.target.value, { classified: true });
                updateProblem(problem.id, { parentProblemId: e.target.value, classified: true });
                onClose();
              }}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
            >
              <option value="">This is a symptom of...</option>
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
                <optgroup label="Raw Captures">
                  {clusterTargets.frictions.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )}

          {!parentProblem && absorbable.frictions.length + absorbable.others.length > 0 && (
            <select
              value=""
              onChange={e => {
                if (!e.target.value) return;
                updateProblem(problem.id, { classified: true });
                updateProblem(e.target.value, { parentProblemId: problem.id, classified: true });
                showToast('Absorbed slip');
              }}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-200 focus:outline-none"
            >
              <option value="">+ Absorb another note...</option>
              {absorbable.frictions.map(f => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
              {absorbable.others.map(o => (
                <option key={o.id} value={o.id}>
                  [{SEVERITY_VISUAL[getProblemSeverity(o)].word}] {o.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {!parentProblem && directChildren.length === 0 && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newParentTitle}
              onChange={e => setNewParentTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newParentTitle.trim()) {
                  e.preventDefault();
                  clusterIntoNewParent(
                    problem.id,
                    newParentTitle.trim(),
                    severity >= 5 ? 'blocker' : 'bottleneck'
                  );
                  setNewParentTitle('');
                  onClose();
                }
              }}
              placeholder="Or create umbrella problem above this..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-700/90 shadow-2xl overflow-hidden ${severityVisual.leftBarClass}`}
        onClick={e => e.stopPropagation()}
      >
        {/* CASE FILE HEADER */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 space-y-2.5 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {isClassified ? (
                  <button
                    type="button"
                    onClick={() => setSeverityPickerOpen(v => !v)}
                    className={`px-2 py-0.5 rounded-full border font-bold transition-transform hover:scale-105 ${severityVisual.pillClass}`}
                    title="Click to adjust severity"
                  >
                    {severityVisual.word} ({severity}/5)
                  </button>
                ) : (
                  <span className="px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-300 font-bold">
                    Step 1: Classify
                  </span>
                )}

                {isClassified && (
                  <span className="inline-flex items-center space-x-1 text-slate-300 font-medium">
                    <span className={`w-2 h-2 rounded-full ${catMeta.dotClass}`} />
                    <span>{catMeta.shortLabel}</span>
                  </span>
                )}

                {linkedRoadmap && (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
                    <MapIcon className="w-3 h-3" />
                    <span>{linkedRoadmap.title}</span>
                  </span>
                )}

                {problem.status === 'solved' ? (
                  <span className="px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-bold">
                    Resolved
                  </span>
                ) : (
                  testingSummary.hasSolution && (
                    <span className={`px-2 py-0.5 rounded-full border font-bold ${testingSummary.badgeClass}`}>
                      {testingSummary.label}
                    </span>
                  )
                )}
              </div>

              {severityPickerOpen && (
                <div className="flex flex-wrap gap-1.5 py-1">
                  {PROBLEM_SEVERITIES.map(sv => (
                    <button
                      key={sv.grade}
                      type="button"
                      onClick={() => handleSelectSeverity(sv.grade)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                        severity === sv.grade
                          ? sv.activeChipClass
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {SEVERITY_VISUAL[sv.grade].word} ({sv.grade})
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitTitle();
                  }
                }}
                className="w-full bg-transparent hover:bg-slate-900/80 focus:bg-slate-950 border border-transparent focus:border-amber-500/50 rounded-xl px-2 -mx-2 py-1 text-base sm:text-lg font-extrabold text-slate-100 focus:outline-none transition-colors"
                placeholder="Describe the problem..."
              />

              {isClassified && (
                <ProblemPulseBar problem={problem} allProblems={problems} todayDate={todayDate} showLegend />
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {problem.status !== 'solved' && !parentProblem && (
                <button
                  type="button"
                  onClick={handleToggleTopFocus}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    problem.isTopConstraint
                      ? 'bg-rose-500/20 text-rose-200 border-rose-500/50'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>{problem.isTopConstraint ? 'Top 3 Focus' : 'Pin Top 3'}</span>
                </button>
              )}
              {confirmDelete ? (
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      deleteProblem(problem.id);
                      onClose();
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-extrabold"
                  >
                    Delete?
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 border border-slate-800 transition-colors"
                  title="Delete problem"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100 border border-slate-800"
                aria-label="Close Case File"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {feedback && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs font-bold text-emerald-300">
              ✓ {feedback}
            </div>
          )}
        </div>

        {/* SINGLE SCROLLABLE CANVAS */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!isClassified ? (
            /* FOCUSED CLASSIFY-FIRST STEP FOR RAW CAPTURES */
            <div className="space-y-5">
              {renderClassificationControls()}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleFinishClassification(true)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-xs font-extrabold"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Classify &amp; Watch (Observe)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFinishClassification(false)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold"
                >
                  <span>Save &amp; Open Case File</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* CLASSIFIED SINGLE-CANVAS CASE FILE (Dynamic Solution-First Ordering!) */
            (() => {
              const observingCard = (collapsible: boolean) => {
                const isExpanded = !collapsible || observingExpanded;
                return (
                  <div
                    className={`p-3.5 sm:p-4 rounded-2xl border space-y-2.5 transition-colors ${
                      watchingActive
                        ? 'bg-sky-500/5 border-sky-500/35'
                        : 'bg-slate-950/75 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => collapsible && setObservingExpanded(v => !v)}
                        className={`flex items-center space-x-2 text-left min-w-0 flex-1 ${
                          collapsible ? 'cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        <Eye className={`w-4 h-4 shrink-0 ${watchingActive ? 'text-sky-400' : 'text-slate-500'}`} />
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-extrabold text-slate-100 flex items-center gap-2">
                            <span>Actively Observing</span>
                            {collapsible && (
                              <span className="text-[10px] font-semibold text-slate-400">
                                {isExpanded ? 'Hide' : watchingActive ? 'ON · Show question' : 'OFF'}
                              </span>
                            )}
                          </div>
                          {(!collapsible || isExpanded) && (
                            <p className="text-[11px] text-slate-400">
                              {watchingActive
                                ? 'Shows in Daily Plan, GWS, Weekly & Reviews with 1-click + Log clue'
                                : 'Turn ON if you don’t fully understand this yet — keeps it visible until you crack it'}
                            </p>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={watchingActive}
                        onClick={() => {
                          handleToggleWatching();
                          if (!watchingActive) setObservingExpanded(true);
                        }}
                        className="flex items-center gap-2 shrink-0"
                      >
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                            watchingActive
                              ? 'bg-sky-500/15 text-sky-300 border-sky-500/35'
                              : 'bg-slate-900 text-slate-500 border-slate-800'
                          }`}
                        >
                          {watchingActive ? 'Watching' : 'Off'}
                        </span>
                        <span
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            watchingActive ? 'bg-sky-500' : 'bg-slate-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              watchingActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </span>
                      </button>
                    </div>

                    {isExpanded && (
                      <>
                        {watchingActive && (
                          <div className="space-y-2.5 pt-1">
                            <input
                              type="text"
                              value={watchQuestionDraft}
                              onChange={e => setWatchQuestionDraft(e.target.value)}
                              onBlur={() => {
                                if (watchQuestionDraft.trim() !== (problem.watchQuestion || '').trim()) {
                                  updateProblem(problem.id, { watchQuestion: watchQuestionDraft.trim() });
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  updateProblem(problem.id, { watchQuestion: watchQuestionDraft.trim() });
                                  showToast('Watch question saved');
                                }
                              }}
                              placeholder="What are you looking out for? (e.g. Notice what I was doing 5m before avoiding this)..."
                              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/70 text-[11px]">
                          <span className="inline-flex items-center space-x-1.5 text-slate-400">
                            <MessageSquarePlus className="w-3.5 h-3.5 text-sky-400" />
                            <span>Ask for a 1-line note whenever this fires</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => updateProblem(problem.id, { promptNoteOnHit: !promptNoteActive })}
                            className={`px-2.5 py-0.5 rounded-lg border font-bold text-[10px] ${
                              promptNoteActive
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                            }`}
                          >
                            {promptNoteActive ? 'ON' : 'OFF'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              };

              const reminderCard = (
                <div
                  className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                    reminderActive
                      ? 'bg-amber-500/5 border-amber-500/35'
                      : 'bg-slate-950/75 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <Bell className={`w-4 h-4 ${reminderActive ? 'text-amber-400' : 'text-slate-500'}`} />
                      <div>
                        <div className="text-xs sm:text-sm font-extrabold text-slate-100">
                          Reminder / Mental Shift
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Leads with your cue before you act (Daily Plan, GWS Studio &amp; Weekly Plan).
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={reminderActive}
                      onClick={() => handleSaveReminder(!reminderActive)}
                      className="flex items-center gap-2 shrink-0"
                    >
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                          reminderActive
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                            : 'bg-slate-900 text-slate-500 border-slate-800'
                        }`}
                      >
                        {reminderActive ? 'Live in Pre-Flight' : 'Off'}
                      </span>
                      <span
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          reminderActive ? 'bg-amber-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            reminderActive ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    <input
                      type="text"
                      value={triggerDraft}
                      onChange={e => setTriggerDraft(e.target.value)}
                      onBlur={() => {
                        if (triggerDraft.trim() !== (problem.trigger || '').trim()) {
                          updateProblem(problem.id, { trigger: triggerDraft.trim() });
                        }
                      }}
                      placeholder="When / Cue (optional)..."
                      className="sm:col-span-2 bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                    />
                    <div className="sm:col-span-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={reminderDraft}
                        onChange={e => setReminderDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && reminderDraft.trim()) {
                            e.preventDefault();
                            handleSaveReminder(true);
                          }
                        }}
                        placeholder="What to remember or expect..."
                        className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveReminder(true)}
                        disabled={!reminderDraft.trim()}
                        className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              );

              const actionCard = (
                <div
                  className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                    actionActive || linkedActions.length > 0
                      ? 'bg-emerald-500/5 border-emerald-500/25'
                      : 'bg-slate-950/75 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <Wrench className={`w-4 h-4 ${actionActive ? 'text-sky-400' : 'text-slate-500'}`} />
                      <div>
                        <div className="text-xs sm:text-sm font-extrabold text-slate-100">
                          Concrete Action / Habit / Reps
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Two-way linked — live progress updates right back onto this problem.
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${
                        linkedActions.length > 0
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                          : actionActive
                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/35'
                          : 'bg-slate-900 text-slate-500 border-slate-800'
                      }`}
                    >
                      {linkedActions.length > 0
                        ? `Linked (${linkedActions.length})`
                        : actionActive
                        ? 'Active'
                        : 'None yet'}
                    </span>
                  </div>

                  {linkedActions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {linkedActions.map(act => (
                        <div
                          key={`${act.kind}_${act.id}`}
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold ${
                            act.completed
                              ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/35'
                              : 'bg-slate-900 text-slate-200 border-slate-700'
                          }`}
                        >
                          <Wrench className="w-3 h-3 text-sky-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{act.label}</span>
                          <span className="font-mono text-[10px] text-amber-300 shrink-0">
                            · {act.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {problem.fixTaskCompletedAt && problem.status !== 'solved' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs">
                      <span className="font-bold text-emerald-200">
                        ✓ Dispatched task finished ({problem.fixTaskCompletedAt.slice(5)}) — did it solve this?
                      </span>
                      <button
                        type="button"
                        onClick={() => updateProblem(problem.id, { status: 'solved' })}
                        className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  )}

                  <input
                    type="text"
                    value={actionDraft}
                    onChange={e => setActionDraft(e.target.value)}
                    onBlur={handleSaveActionNote}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveActionNote();
                      }
                    }}
                    placeholder="Concrete action, setup change, habit, or reps target..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500/50 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
                  />

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Send this action to:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ACTION_DESTINATIONS.map(dest => {
                        const alreadySent = (problem.dispatchedTo || []).includes(dest.target);
                        return (
                          <button
                            key={dest.target}
                            type="button"
                            onClick={() => handleDispatchAction(dest.target)}
                            title={dest.hint}
                            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                              alreadySent
                                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200'
                                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-sky-500/40 text-slate-200'
                            }`}
                          >
                            {alreadySent ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Send className="w-3 h-3 text-sky-400" />
                            )}
                            <span>{alreadySent ? `In ${dest.label}` : dest.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );

              const proofBar = testingSummary.hasSolution && (
                <div className="px-3.5 py-2.5 rounded-2xl bg-slate-950/75 border border-slate-800 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11px] text-slate-400">Proof target:</span>
                      {PROOF_TARGETS.map(target => {
                        const active = (problem.verifyTarget || defaultVerifyTarget) === target;
                        return (
                          <button
                            key={target}
                            type="button"
                            onClick={() => updateProblem(problem.id, { verifyTarget: target })}
                            className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold border ${
                              active
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                            }`}
                          >
                            {target}×
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold ${testingSummary.badgeClass}`}>
                        {testingSummary.label}
                      </span>
                      {testingSummary.readyToResolve && (
                        <button
                          type="button"
                          onClick={() => {
                            updateProblem(problem.id, { status: 'solved', classified: true });
                            onClose();
                          }}
                          className="px-2.5 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[11px]"
                        >
                          ✓ Resolve
                        </button>
                      )}
                    </div>
                  </div>
                  {testingSummary.effectiveCount > 0 && testingSummary.state !== 'failed' && (
                    <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          testingSummary.readyToResolve ? 'bg-emerald-400' : 'bg-sky-400'
                        }`}
                        style={{ width: `${testingSummary.pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );

              return (
                <>
                  {/* SECTION 1: ACTIVE STANCE (Active solution leads when present!) */}
                  <div className="space-y-3">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                      {testingSummary.hasSolution
                        ? `Active Solution · v${testingSummary.version}`
                        : 'Your Active Response'}
                    </div>

                    {testingSummary.hasSolution && testingSummary.state === 'failed' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/35 text-xs">
                        <span className="text-rose-200 font-medium">
                          Previous fix failed on {problem.lastFixFailedAt?.slice(5)}. Adjust your Reminder, Trigger, or Action below, then restart testing.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            reviseProblemSolution(problem.id, { restartTest: true, date: todayDate });
                            showToast(`Started testing v${testingSummary.version + 1}`);
                          }}
                          className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shrink-0"
                        >
                          Start testing v{testingSummary.version + 1}
                        </button>
                      </div>
                    )}

                    {testingSummary.hasSolution && testingSummary.latestPendingTweak && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-violet-500/10 border border-violet-500/35 text-xs">
                        <span className="text-violet-200 min-w-0 flex-1">
                          <strong>Pending tweak ({testingSummary.latestPendingTweak.date.slice(5)}):</strong>{' '}
                          &ldquo;{testingSummary.latestPendingTweak.note}&rdquo;
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setReviseRemDraft(getProblemReminderText(problem));
                              setReviseActDraft(getProblemActionText(problem));
                              setReviseNoteDraft(testingSummary.latestPendingTweak?.note || '');
                              setReviseRestartTest(testingSummary.state === 'failed');
                              setTweakMode('revise');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold text-[11px]"
                          >
                            Apply tweak
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              reviseProblemSolution(problem.id, { markTweaksAppliedOnly: true });
                              showToast('Marked tweak as applied');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold text-[11px]"
                          >
                            Mark applied
                          </button>
                        </div>
                      </div>
                    )}

                    {testingSummary.hasSolution ? (
                      <>
                        {reminderCard}
                        {actionCard}
                        {proofBar}
                        {observingCard(true)}
                      </>
                    ) : (
                      <>
                        {observingCard(false)}
                        {reminderCard}
                        {actionCard}
                      </>
                    )}
                  </div>

              {/* SECTION 2: CLUES & EVIDENCE (Always visible right below while designing solutions!) */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                    Clues &amp; Timeline ({combinedTimeline.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddClue(false)}
                    className="text-[11px] font-bold text-orange-300 hover:text-orange-200"
                  >
                    + Quick hit (no note)
                  </button>
                </div>

                {/* Add Clue Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={clueDraft}
                    onChange={e => setClueDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && clueDraft.trim()) {
                        e.preventDefault();
                        handleAddClue(true);
                      }
                    }}
                    placeholder="Add a dated clue or observation (Enter to save)..."
                    className="flex-1 bg-slate-900 border border-slate-800 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddClue(true)}
                    disabled={!clueDraft.trim()}
                    className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0"
                  >
                    + Clue
                  </button>
                </div>

                {/* Suspected Root Cause */}
                <input
                  type="text"
                  value={rootCauseDraft}
                  onChange={e => setRootCauseDraft(e.target.value)}
                  onBlur={() => {
                    if (rootCauseDraft.trim() !== (problem.rootCause || '').trim()) {
                      updateProblem(problem.id, { rootCause: rootCauseDraft.trim() });
                    }
                  }}
                  placeholder="Suspected root cause (why does this keep happening?)..."
                  className="w-full bg-slate-900/70 border border-slate-800/80 focus:border-amber-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                />

                {/* Combined Evidence Timeline */}
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {combinedTimeline.map(entry => (
                    <div
                      key={entry.key}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs ${
                        entry.kind === 'effective'
                          ? 'bg-emerald-500/5 border-emerald-500/25'
                          : entry.kind === 'tweaked'
                          ? 'bg-violet-500/5 border-violet-500/25'
                          : entry.kind === 'not_triggered'
                          ? 'bg-slate-900/60 border-slate-800/80'
                          : 'bg-slate-900/90 border-slate-800'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-slate-500 shrink-0 pt-0.5">
                        {entry.date}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          entry.kind === 'effective'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : entry.kind === 'tweaked'
                            ? 'bg-violet-500/15 text-violet-300'
                            : entry.kind === 'not_triggered'
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-orange-500/10 text-orange-300'
                        }`}
                      >
                        {entry.kind === 'effective'
                          ? 'Fix worked'
                          : entry.kind === 'tweaked'
                          ? 'Tweak / Improve'
                          : entry.kind === 'not_triggered'
                          ? "Didn't come up"
                          : entry.sourceLabel}
                      </span>
                      <div className="min-w-0 flex-1">
                        {entry.fromSlipTitle && (
                          <div className="text-[10px] font-semibold text-amber-300/80 mb-0.5">
                            Slip: {entry.fromSlipTitle}
                          </div>
                        )}
                        {entry.note?.trim() ? (
                          <p className="text-slate-200 leading-snug">{entry.note}</p>
                        ) : (
                          <p className="text-slate-500 italic">
                            {entry.kind === 'effective'
                              ? 'Confirmed fix held during review'
                              : entry.kind === 'tweaked'
                              ? 'Noted an improvement to test'
                              : entry.kind === 'not_triggered'
                              ? 'Situation did not come up'
                              : 'Logged occurrence'}
                          </p>
                        )}
                        {entry.tweakNote?.trim() && entry.kind !== 'tweaked' && (
                          <p
                            className={`text-[11px] mt-1 leading-snug ${
                              entry.tweakApplied ? 'text-slate-400' : 'text-violet-300'
                            }`}
                          >
                            {entry.tweakApplied ? 'Tweak applied: ' : 'Tweak idea: '}
                            &ldquo;{entry.tweakNote}&rdquo;
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (entry.kind === 'hit') {
                            deleteProblemOccurrence(entry.problemId, entry.occurrenceIndex);
                            showToast('Entry deleted');
                          } else {
                            deleteProblemCheckIn(problem.id, entry.date);
                            showToast('Check-in deleted');
                          }
                        }}
                        title="Delete entry"
                        className="p-1 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {allAttempts.length > 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAttempts(v => !v)}
                      className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-400 hover:text-slate-200"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>
                        Past Attempts ({allAttempts.length}
                        {failedAttempts.length > 0 ? ` · ${failedAttempts.length} failed` : ''})
                      </span>
                      {showAttempts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {showAttempts && (
                      <div className="mt-2 space-y-1.5 pl-3 border-l border-slate-800">
                        {allAttempts.map((att, idx) => (
                          <div
                            key={att.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-xs p-2 rounded-xl bg-slate-900 border border-slate-800"
                          >
                            <div className="min-w-0">
                              <span
                                className={`font-extrabold mr-1.5 ${
                                  att.outcome === 'failed'
                                    ? 'text-rose-400'
                                    : att.outcome === 'verified'
                                    ? 'text-emerald-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                {att.outcome === 'failed' ? '✗ Broke' : att.outcome === 'verified' ? '✓ Worked' : '↺ Changed'} #{idx + 1}:
                              </span>
                              <span className="text-slate-200">&ldquo;{att.fixText}&rdquo;</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-[10px] text-slate-500">
                                held {att.daysHeld}d · {att.endedAt}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  deleteProblemFixAttempt(problem.id, att.id);
                                  showToast('Attempt deleted');
                                }}
                                title="Delete attempt"
                                className="p-1 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* COLLAPSIBLE CLASSIFICATION & CLUSTERING DETAILS */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDetailsOpen(v => !v)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-400 hover:text-slate-200"
                >
                  <span>Classification, Roadmap &amp; Grouping</span>
                  {detailsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {detailsOpen && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-800/80">
                    {renderClassificationControls()}
                  </div>
                )}
              </div>
                </>
              );
            })()
          )}
        </div>

        {/* STICKY FOOTER: TWEAK / REVISE DRAWER + 3-VERDICT TOGGLEABLE CHECK-IN + RESOLVE */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/75 space-y-2.5 shrink-0">
          {tweakMode !== 'closed' && problem.status !== 'solved' && (
            <div className="p-3 rounded-xl bg-slate-900 border border-violet-500/35 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setTweakMode('idea')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      tweakMode === 'idea'
                        ? 'bg-violet-500 text-slate-950'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Jot tweak idea
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReviseRemDraft(getProblemReminderText(problem));
                      setReviseActDraft(getProblemActionText(problem));
                      setReviseRestartTest(testingSummary.state === 'failed');
                      setTweakMode('revise');
                    }}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      tweakMode === 'revise'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Edit &amp; apply fix
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setTweakMode('closed')}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200"
                >
                  Close
                </button>
              </div>

              {tweakMode === 'idea' ? (
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={tweakIdeaDraft}
                    onChange={e => setTweakIdeaDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && tweakIdeaDraft.trim()) {
                        e.preventDefault();
                        noteProblemTweak(problem.id, tweakIdeaDraft, { date: contextDate });
                        setTweakIdeaDraft('');
                        setTweakMode('closed');
                        showToast('Tweak idea saved (kept your day verdict intact)');
                      }
                      if (e.key === 'Escape') setTweakMode('closed');
                    }}
                    placeholder="What tweak would sharpen this solution? (keeps today's verdict)..."
                    className="flex-1 min-w-[180px] bg-slate-950 border border-violet-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={!tweakIdeaDraft.trim()}
                    onClick={() => {
                      noteProblemTweak(problem.id, tweakIdeaDraft, { date: contextDate });
                      setTweakIdeaDraft('');
                      setTweakMode('closed');
                      showToast('Tweak idea saved (kept your day verdict intact)');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0"
                  >
                    Save idea
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {(reminderActive || reviseRemDraft.trim() || (!actionActive && !reviseActDraft.trim())) && (
                    <input
                      type="text"
                      value={reviseRemDraft}
                      onChange={e => setReviseRemDraft(e.target.value)}
                      placeholder="Active Reminder / Mental Shift text..."
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                    />
                  )}
                  {(actionActive || reviseActDraft.trim()) && (
                    <input
                      type="text"
                      value={reviseActDraft}
                      onChange={e => setReviseActDraft(e.target.value)}
                      placeholder="Active Concrete Action / Habit text..."
                      className="w-full bg-slate-950 border border-sky-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={reviseNoteDraft}
                      onChange={e => setReviseNoteDraft(e.target.value)}
                      placeholder="What changed / why? (optional)..."
                      className="flex-1 min-w-[160px] bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                    />
                    {testingSummary.state !== 'failed' && (
                      <label className="inline-flex items-center space-x-1.5 text-[11px] text-slate-300 cursor-pointer select-none px-1">
                        <input
                          type="checkbox"
                          checked={reviseRestartTest}
                          onChange={e => setReviseRestartTest(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
                        />
                        <span>Start fresh (v{testingSummary.version + 1})</span>
                      </label>
                    )}
                    <button
                      type="button"
                      disabled={!reviseRemDraft.trim() && !reviseActDraft.trim()}
                      onClick={() => {
                        reviseProblemSolution(problem.id, {
                          ...(reminderActive || reviseRemDraft.trim()
                            ? { reminderText: reviseRemDraft.trim() }
                            : {}),
                          ...(actionActive || reviseActDraft.trim()
                            ? { fixNote: reviseActDraft.trim() }
                            : {}),
                          ...(reviseNoteDraft.trim() ? { note: reviseNoteDraft.trim() } : {}),
                          restartTest: reviseRestartTest,
                          date: todayDate
                        });
                        if (reminderActive || reviseRemDraft.trim()) {
                          setReminderDraft(reviseRemDraft.trim());
                        }
                        if (actionActive || reviseActDraft.trim()) {
                          setActionDraft(reviseActDraft.trim());
                        }
                        setTweakMode('closed');
                        setReviseNoteDraft('');
                        showToast('Saved revised solution cleanly');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0"
                    >
                      Save revised fix
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {problem.status !== 'solved' ? (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {contextDate.slice(5)}:
                  </span>
                  {testingSummary.hasSolution ? (
                    <>
                      <div className="inline-flex items-center rounded-xl bg-slate-900 border border-slate-800 p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const nextOutcome = checkInVerdict === 'effective' ? null : 'effective';
                            recordProblemCheckIn(problem.id, nextOutcome, {
                              date: contextDate,
                              sourceType: contextSourceType,
                              sourceRef: contextSourceRef
                            });
                            showToast(
                              nextOutcome
                                ? 'Marked Worked for ' + contextDate.slice(5)
                                : 'Cleared check-in for ' + contextDate.slice(5)
                            );
                          }}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                            checkInVerdict === 'effective'
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
                              checkInVerdict === 'not_triggered' ? null : 'not_triggered';
                            recordProblemCheckIn(problem.id, nextOutcome, {
                              date: contextDate,
                              sourceType: contextSourceType,
                              sourceRef: contextSourceRef
                            });
                            showToast(
                              nextOutcome
                                ? "Logged Didn't come up on " + contextDate.slice(5)
                                : 'Cleared check-in for ' + contextDate.slice(5)
                            );
                          }}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                            checkInVerdict === 'not_triggered'
                              ? 'bg-slate-200 text-slate-950'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <Minus className="w-3 h-3" />
                          <span>Didn&apos;t come up</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextOutcome = checkInVerdict === 'failed' ? null : 'failed';
                            recordProblemCheckIn(problem.id, nextOutcome, {
                              date: contextDate,
                              sourceType: contextSourceType,
                              sourceRef: contextSourceRef,
                              note: nextOutcome ? clueDraft.trim() || undefined : undefined
                            });
                            if (nextOutcome) setClueDraft('');
                            showToast(
                              nextOutcome
                                ? 'Logged Failed on ' + contextDate.slice(5)
                                : 'Undid Failed on ' + contextDate.slice(5)
                            );
                          }}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                            checkInVerdict === 'failed'
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
                          if (tweakMode === 'closed') {
                            setReviseRemDraft(getProblemReminderText(problem));
                            setReviseActDraft(getProblemActionText(problem));
                            setTweakMode('idea');
                          } else {
                            setTweakMode('closed');
                          }
                        }}
                        className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                          tweakMode !== 'closed'
                            ? 'bg-violet-500 text-slate-950 border-violet-400'
                            : 'bg-slate-900 hover:bg-violet-500/15 text-violet-300 border-slate-800'
                        }`}
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Tweak</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const nextOutcome =
                            checkInVerdict === 'not_triggered' ? null : 'not_triggered';
                          recordProblemCheckIn(problem.id, nextOutcome, {
                            date: contextDate,
                            sourceType: contextSourceType,
                            sourceRef: contextSourceRef
                          });
                          showToast(
                            nextOutcome
                              ? "Logged Didn't come up on " + contextDate.slice(5)
                              : 'Cleared check-in'
                          );
                        }}
                        className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                          checkInVerdict === 'not_triggered'
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
                          const trimmed = clueDraft.trim();
                          recordProblemRecurrence(problem.id, {
                            date: contextDate,
                            sourceType: contextSourceType,
                            ...(contextSourceRef ? { sourceRef: contextSourceRef } : {}),
                            ...(trimmed ? { note: trimmed } : {})
                          });
                          setClueDraft('');
                          showToast('Logged occurrence on ' + contextDate.slice(5));
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold bg-slate-900 hover:bg-orange-500/15 text-orange-300 border-slate-800 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Happened again</span>
                      </button>
                    </>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    updateProblem(problem.id, { status: 'open' });
                    showToast('Reopened problem');
                  }}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reopen Problem</span>
                </button>
              )}
            </div>

            {problem.status !== 'solved' && (
              <button
                type="button"
                onClick={() => {
                  updateProblem(problem.id, { status: 'solved', classified: true });
                  onClose();
                }}
                className={`inline-flex items-center space-x-1 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${
                  testingSummary.readyToResolve
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Resolved</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
