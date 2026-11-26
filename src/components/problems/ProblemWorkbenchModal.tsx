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
  getClusterTotalHits,
  getDescendantProblems,
  getDirectChildren,
  getEligibleClusterTargets,
  getFixVerificationProgress,
  getProblemActionText,
  getProblemReminderText,
  getProblemSeverity,
  hasActiveAction,
  hasActiveReminder,
  isProblemClassified,
  normalizeTag,
  resolveCategoryMeta,
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
import {
  AlertTriangle,
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

const VERIFY_DAY_OPTIONS = [7, 14, 30];

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
  initialTab,
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
    selectedWeekId,
    updateProblem,
    recordProblemRecurrence,
    recordProblemHeld,
    clusterIntoNewParent,
    deleteProblem,
    dispatchProblemFix
  } = useStorage();

  const problem = problems.find(p => p.id === problemId);

  const isClassified = problem ? isProblemClassified(problems, problem) : false;
  const [activeTab, setActiveTab] = useState<WorkbenchTab>(
    initialTab || (isClassified ? 'solution' : 'classify')
  );

  // Editable local drafts synced to problem
  const [titleDraft, setTitleDraft] = useState(problem?.title || '');
  const [triggerDraft, setTriggerDraft] = useState(problem?.trigger || '');
  const [rootCauseDraft, setRootCauseDraft] = useState(problem?.rootCause || '');
  const [reminderDraft, setReminderDraft] = useState(problem ? getProblemReminderText(problem) : '');
  const [actionDraft, setActionDraft] = useState(problem ? getProblemActionText(problem) : '');
  const [observationDraft, setObservationDraft] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [newParentTitle, setNewParentTitle] = useState('');
  const [showAttempts, setShowAttempts] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!problem) return;
    setTitleDraft(problem.title);
    setTriggerDraft(problem.trigger || '');
    setRootCauseDraft(problem.rootCause || '');
    setReminderDraft(getProblemReminderText(problem));
    setActionDraft(getProblemActionText(problem));
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

  const severity = getProblemSeverity(problem);
  const severityMeta = SEVERITY_META[severity];
  const severityVisual = SEVERITY_VISUAL[severity];
  const maxTop = problemSettings.maxTopConstraints || 3;
  const defaultVerifyDays = problemSettings.defaultVerifyDays || 14;
  const currentTopCount = problems.filter(p => p.isTopConstraint && p.status !== 'solved').length;
  const promptNoteActive = shouldPromptNoteOnHit(problem);
  const reminderActive = hasActiveReminder(problem);
  const actionActive = hasActiveAction(problem);
  const verification = getFixVerificationProgress(problem, todayDate, defaultVerifyDays);
  const timeline = getClusterOccurrenceTimeline(problems, problem);
  const totalHits = getClusterTotalHits(problems, problem);
  const directChildren = getDirectChildren(problems, problem.id);
  const allDescendants = getDescendantProblems(problems, problem.id);
  const activeDescendantCount = allDescendants.filter(d => d.status !== 'solved').length;
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
  const heldToday = (problem.heldDates || []).includes(todayDate);
  const heldCount = (problem.heldDates || []).length;
  const allAttempts = problem.fixAttempts || [];
  const failedAttempts = allAttempts.filter(a => a.outcome === 'failed');

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

  const handleRemoveTag = (tag: string) => {
    updateProblem(problem.id, { tags: problem.tags.filter(t => !tagsMatch(t, tag)) });
  };

  const handleToggleTopFocus = () => {
    if (problem.isTopConstraint) {
      updateProblem(problem.id, { isTopConstraint: false });
      showToast('Removed from Top 3 Focus');
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
    showToast('Pinned to Top 3 Focus (detail notes auto-ON)');
  };

  const handleTogglePromptNote = () => {
    const nextVal = !promptNoteActive;
    updateProblem(problem.id, { promptNoteOnHit: nextVal });
    showToast(
      nextVal
        ? 'Will ask for a 1-line note each time this happens'
        : 'Switched to silent 1-click hit counting'
    );
  };

  const handleLogObservation = (withNote: boolean) => {
    const note = withNote ? observationDraft.trim() : '';
    recordProblemRecurrence(problem.id, {
      date: contextDate,
      sourceType: contextSourceType,
      ...(contextSourceRef ? { sourceRef: contextSourceRef } : {}),
      ...(note ? { note } : {})
    });
    setObservationDraft('');
    showToast(note ? 'Observation added to timeline' : 'Occurrence logged');
  };

  const handleSaveReminder = (overrideActive?: boolean) => {
    const trimmed = reminderDraft.trim();
    const nextActive = overrideActive !== undefined ? overrideActive : Boolean(trimmed);
    const trimmedTrigger = triggerDraft.trim();
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
    if (trimmed === getProblemActionText(problem)) return;
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
      let msg = `Sent to ${DISPATCH_TARGET_LABELS[target]}`;
      if (target === 'weekly_plan' && resolvedRoadmapId) {
        const wPlan = weeklyPlans[targetWeekId || selectedWeekId];
        const container = getWeeklyGoalsAssignedToRoadmap(wPlan, resolvedRoadmapId)[0];
        if (container) {
          msg = `Added inside "${container.text.slice(0, 28)}${container.text.length > 28 ? '…' : ''}"`;
        }
      }
      showToast(msg);
    }
  };

  const handleFinishClassification = (nextStep: 'observe' | 'solution') => {
    updateProblem(problem.id, {
      classified: true,
      severity,
      impact: severityToImpact(severity),
      scale: severity >= 5 ? 'blocker' : severity >= 3 ? 'bottleneck' : 'friction'
    });
    if (nextStep === 'solution') {
      setActiveTab('solution');
    } else {
      showToast('Classified — watching in Backlog');
      onClose();
    }
  };

  const handleMergeUnder = (parentId: string) => {
    if (!parentId) {
      updateProblem(problem.id, { parentProblemId: undefined });
      return;
    }
    updateProblem(parentId, { classified: true });
    updateProblem(problem.id, { parentProblemId: parentId, classified: true });
    showToast('Grouped under selected problem');
    onClose();
  };

  const handleAbsorbChild = (childId: string) => {
    if (!childId) return;
    updateProblem(problem.id, { classified: true });
    updateProblem(childId, { parentProblemId: problem.id, classified: true });
    showToast('Absorbed slip into this problem');
  };

  const handleCreateUmbrella = () => {
    const trimmed = newParentTitle.trim();
    if (!trimmed) return;
    clusterIntoNewParent(problem.id, trimmed, severity >= 5 ? 'blocker' : 'bottleneck');
    setNewParentTitle('');
    showToast('Grouped under new umbrella problem');
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-700/90 shadow-2xl overflow-hidden ${severityVisual.leftBarClass}`}
        onClick={e => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 space-y-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {isClassified ? (
                  <span className={`px-2 py-0.5 rounded-full border font-bold ${severityVisual.pillClass}`}>
                    {severityVisual.word}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-300 font-bold">
                    Needs Classification
                  </span>
                )}
                {problem.status === 'solved' && (
                  <span className="px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-bold">
                    Resolved
                  </span>
                )}
                {linkedRoadmap && (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
                    <MapIcon className="w-3 h-3" />
                    <span>{linkedRoadmap.title}</span>
                  </span>
                )}
                <span className="text-slate-500 font-mono">
                  {totalHits} {totalHits === 1 ? 'hit' : 'hits'}
                </span>
              </div>

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
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100 border border-slate-800"
                aria-label="Close workbench"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3 CALM STAGE TABS */}
          <div className="flex items-center gap-1.5">
            {(
              [
                {
                  id: 'classify' as const,
                  label: '1. Classify',
                  badge: !isClassified ? 'To do' : undefined,
                  badgeCls: 'bg-amber-500/20 text-amber-300'
                },
                {
                  id: 'observations' as const,
                  label: `2. Observations (${timeline.length})`,
                  badge: promptNoteActive ? 'Notes ON' : undefined,
                  badgeCls: 'bg-sky-500/20 text-sky-300'
                },
                {
                  id: 'solution' as const,
                  label: '3. Solution',
                  badge:
                    reminderActive && actionActive
                      ? 'Reminder + Action'
                      : reminderActive
                      ? 'Reminder'
                      : actionActive
                      ? 'Action'
                      : 'Observing',
                  badgeCls:
                    reminderActive || actionActive
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  activeTab === tab.id
                    ? 'bg-slate-100 text-slate-950 border-slate-100'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      activeTab === tab.id ? 'bg-slate-900/15 text-slate-900' : tab.badgeCls
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {feedback && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs font-bold text-emerald-300">
              ✓ {feedback}
            </div>
          )}
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ========================================================== */}
          {/* TAB 1: CLASSIFY (Severity, Category, Roadmap, Grouping)     */}
          {/* ========================================================== */}
          {activeTab === 'classify' && (
            <div className="space-y-5">
              {/* How bad is it? */}
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

              {/* Category */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-300 block">
                  What kind of problem is it?
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

              {/* Roadmap & Optional Tags */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-300 block">
                  Which Roadmap does this affect? <span className="text-slate-500 font-normal normal-case">(optional)</span>
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
                          onClick={() => handleRemoveTag(tag)}
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
                      placeholder="+ custom tag"
                      className="bg-transparent text-xs text-slate-200 placeholder-slate-600 focus:outline-none w-24"
                    />
                    {tagInput.trim() && (
                      <button type="button" onClick={handleAddTag} className="text-amber-400 ml-1">
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Grouping / Clustering */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Group Related Problems</span>
                </div>

                {parentProblem && (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                    <span className="text-amber-200 font-semibold">
                      Grouped inside: <strong>{parentProblem.title}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMergeUnder('')}
                      className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-900 text-slate-300 hover:text-amber-300 text-[11px] font-bold"
                    >
                      <Unlink className="w-3 h-3" />
                      <span>Separate</span>
                    </button>
                  </div>
                )}

                {directChildren.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400">
                      Grouped inside this problem ({directChildren.length}):
                    </div>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {clusterTargets.roots.length + clusterTargets.frictions.length > 0 && (
                    <select
                      value={problem.parentProblemId || ''}
                      onChange={e => handleMergeUnder(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="">This is actually a symptom of...</option>
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
                        if (e.target.value) handleAbsorbChild(e.target.value);
                      }}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-200 focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="">+ Pull another note into this one...</option>
                      {absorbable.frictions.length > 0 && (
                        <optgroup label="Raw Captures">
                          {absorbable.frictions.map(f => (
                            <option key={f.id} value={f.id}>
                              {f.title}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {absorbable.others.length > 0 && (
                        <optgroup label="Other Problems">
                          {absorbable.others.map(o => (
                            <option key={o.id} value={o.id}>
                              [{SEVERITY_VISUAL[getProblemSeverity(o)].word}] {o.title}
                            </option>
                          ))}
                        </optgroup>
                      )}
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
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateUmbrella();
                        }
                      }}
                      placeholder="Or create a broader root problem above this one..."
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/40"
                    />
                    {newParentTitle.trim() && (
                      <button
                        type="button"
                        onClick={handleCreateUmbrella}
                        className="px-3 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/35 text-xs font-bold shrink-0"
                      >
                        Create Root
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Step 1 Progression Bar */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                {!isClassified ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleFinishClassification('observe')}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold transition-colors"
                    >
                      Save &amp; Keep Observing
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFinishClassification('solution')}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition-colors"
                    >
                      <span>Save &amp; Design Solution</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveTab('observations')}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                    >
                      Observations →
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('solution')}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold"
                    >
                      <span>Design Solution</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 2: OBSERVATIONS (Context-Note Toggle + Living Timeline) */}
          {/* ========================================================== */}
          {activeTab === 'observations' && (
            <div className="space-y-5">
              {/* Per-Problem Context-Note Toggle */}
              <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <MessageSquarePlus className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-slate-100">
                      Ask for a 1-line note whenever this happens
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-6">
                    {problem.isTopConstraint
                      ? 'Auto-ON for Top 3 Focus — tap to switch to silent counting.'
                      : 'Auto-OFF for Backlog — turn ON while investigating to capture context each time.'}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={promptNoteActive}
                  onClick={handleTogglePromptNote}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    promptNoteActive ? 'bg-sky-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      promptNoteActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Add Observation Now */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-300 block">
                  Record what happened
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={observationDraft}
                    onChange={e => setObservationDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && observationDraft.trim()) {
                        e.preventDefault();
                        handleLogObservation(true);
                      }
                    }}
                    placeholder="e.g. Opened phone right after getting stuck on the intro paragraph..."
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-sky-500/50 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleLogObservation(true)}
                    disabled={!observationDraft.trim()}
                    className="px-3.5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0"
                  >
                    + Add Note
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Adds a dated observation to your timeline below.</span>
                  <button
                    type="button"
                    onClick={() => handleLogObservation(false)}
                    className="text-orange-300 hover:text-orange-200 font-bold"
                  >
                    Or just log a quick hit (+1, no note)
                  </button>
                </div>
              </div>

              {/* Optional Pattern Understanding */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 block">
                    Common Trigger <span className="text-slate-600">(when does it show up?)</span>
                  </label>
                  <input
                    type="text"
                    value={triggerDraft}
                    onChange={e => setTriggerDraft(e.target.value)}
                    onBlur={() => {
                      if (triggerDraft.trim() !== (problem.trigger || '').trim()) {
                        updateProblem(problem.id, { trigger: triggerDraft.trim() });
                      }
                    }}
                    placeholder="e.g. Right after lunch, or starting a blank page..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 block">
                    Suspected Root Cause <span className="text-slate-600">(why is it happening?)</span>
                  </label>
                  <input
                    type="text"
                    value={rootCauseDraft}
                    onChange={e => setRootCauseDraft(e.target.value)}
                    onBlur={() => {
                      if (rootCauseDraft.trim() !== (problem.rootCause || '').trim()) {
                        updateProblem(problem.id, { rootCause: rootCauseDraft.trim() });
                      }
                    }}
                    placeholder="e.g. First step isn't concrete before I sit down..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Evidence Timeline */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                    Timeline ({timeline.length} {timeline.length === 1 ? 'occurrence' : 'occurrences'})
                  </span>
                  {heldCount > 0 && (
                    <span className="text-[11px] font-bold text-emerald-300">
                      Held {heldCount}× {problem.lastHeldDate ? `· last ${problem.lastHeldDate.slice(5)}` : ''}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {timeline.map((item, idx) => (
                    <div
                      key={`${item.date}_${idx}`}
                      className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-xs"
                    >
                      <span className="font-mono text-[11px] text-slate-500 shrink-0 pt-0.5">
                        {item.date}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-400 shrink-0">
                        {SOURCE_LABELS[item.sourceType] || item.sourceType}
                      </span>
                      <div className="min-w-0 flex-1">
                        {item.fromSlipTitle && (
                          <div className="text-[10px] font-semibold text-amber-300/80 mb-0.5">
                            Slip: {item.fromSlipTitle}
                          </div>
                        )}
                        {item.note?.trim() ? (
                          <p className="text-slate-200 leading-snug">{item.note}</p>
                        ) : (
                          <p className="text-slate-500 italic">Occurrence logged (no note)</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
                      Past Solution Attempts ({allAttempts.length}
                      {failedAttempts.length > 0 ? ` · ${failedAttempts.length} didn't hold` : ''})
                    </span>
                    {showAttempts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {showAttempts && (
                    <div className="mt-2 space-y-1.5 pl-3 border-l border-slate-800">
                      {allAttempts.map((att, idx) => (
                        <div
                          key={att.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800"
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
                          <span className="font-mono text-[10px] text-slate-500 shrink-0">
                            held {att.daysHeld}d · {att.endedAt}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 3: SOLUTION (Observing | Reminder | Concrete Action)    */}
          {/* ========================================================== */}
          {activeTab === 'solution' && (
            <div className="space-y-4">
              {/* Current Stance Summary */}
              {!reminderActive && !actionActive ? (
                <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start space-x-2.5">
                    <Eye className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-xs font-extrabold text-sky-200">
                        Currently Observing — No Solution Set Yet
                      </div>
                      <p className="text-[11px] text-slate-300">
                        That&apos;s completely fine if you don&apos;t know the real cause yet. Keep logging observations, or add a Reminder and/or Concrete Action below whenever you&apos;re ready.
                      </p>
                    </div>
                  </div>
                  {!promptNoteActive && (
                    <button
                      type="button"
                      onClick={handleTogglePromptNote}
                      className="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-[11px] font-bold shrink-0"
                    >
                      Turn ON hit notes
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {reminderActive && (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-200 font-bold">
                      <Bell className="w-3 h-3" />
                      <span>Reminder Active</span>
                    </span>
                  )}
                  {actionActive && (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/35 text-sky-200 font-bold">
                      <Wrench className="w-3 h-3" />
                      <span>Action Active</span>
                    </span>
                  )}
                  {problem.lastFixFailedAt && problem.status === 'open' && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/35 text-rose-300 font-bold">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Slipped on {problem.lastFixFailedAt.slice(5)} — adjust below</span>
                    </span>
                  )}
                </div>
              )}

              {/* CARD A: REMINDER / MENTAL SHIFT */}
              <div
                className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                  reminderActive
                    ? 'bg-amber-500/5 border-amber-500/35'
                    : 'bg-slate-950/80 border-slate-800'
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
                        Shows before you act — top of Daily Plan, before GWS sprints, and in Weekly Plan.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={reminderActive}
                    onClick={() => handleSaveReminder(!reminderActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      reminderActive ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        reminderActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={triggerDraft}
                    onChange={e => setTriggerDraft(e.target.value)}
                    onBlur={() => {
                      if (triggerDraft.trim() !== (problem.trigger || '').trim()) {
                        updateProblem(problem.id, { trigger: triggerDraft.trim() });
                      }
                    }}
                    placeholder="When / Cue (optional): e.g. Before starting deep work, or when I feel stuck..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
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
                      placeholder="What to remember or expect differently (e.g. Expect 5 min of friction — start ugly)..."
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveReminder(true)}
                      disabled={!reminderDraft.trim()}
                      className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0"
                    >
                      Save Reminder
                    </button>
                  </div>
                </div>
              </div>

              {/* CARD B: CONCRETE ACTION / ROUTINE FIX */}
              <div
                className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                  actionActive
                    ? 'bg-sky-500/5 border-sky-500/35'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Wrench className={`w-4 h-4 ${actionActive ? 'text-sky-400' : 'text-slate-500'}`} />
                  <div>
                    <div className="text-xs sm:text-sm font-extrabold text-slate-100">
                      Concrete Action / Routine Fix
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Literal work, routine change, habit rewire, or skill reps — can run alongside a Reminder.
                    </p>
                  </div>
                </div>

                {problem.fixTaskCompletedAt && problem.status !== 'solved' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs">
                    <span className="font-bold text-emerald-200">
                      ✓ Your dispatched task was completed on {problem.fixTaskCompletedAt.slice(5)} — did it solve this?
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
                  placeholder="Describe the concrete task, setup change, or habit (e.g. Put phone charger in living room)..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500/50 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
                />

                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400">
                    Send this action where you&apos;ll actually do it:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {ACTION_DESTINATIONS.map(dest => {
                      const alreadySent = (problem.dispatchedTo || []).includes(dest.target);
                      return (
                        <button
                          key={dest.target}
                          type="button"
                          onClick={() => handleDispatchAction(dest.target)}
                          className={`flex items-start justify-between gap-2 p-2.5 rounded-xl border text-left transition-all ${
                            alreadySent
                              ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200'
                              : 'bg-slate-950 hover:bg-slate-900 border-slate-800 hover:border-sky-500/40 text-slate-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold flex items-center space-x-1.5">
                              {alreadySent ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : (
                                <Send className="w-3 h-3 text-sky-400 shrink-0" />
                              )}
                              <span>{alreadySent ? `In ${dest.label}` : dest.label}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                              {dest.hint}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Verification Window */}
                {(reminderActive || actionActive) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-slate-400">Check if solved after:</span>
                      {VERIFY_DAY_OPTIONS.map(days => {
                        const active = (problem.verifyDays || defaultVerifyDays) === days;
                        return (
                          <button
                            key={days}
                            type="button"
                            onClick={() => updateProblem(problem.id, { verifyDays: days })}
                            className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold border ${
                              active
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                            }`}
                          >
                            {days}d clean
                          </button>
                        );
                      })}
                    </div>
                    {verification.isTesting && (
                      <span className="font-mono text-[11px] font-bold text-sky-300">
                        {verification.daysClean}/{verification.targetDays}d clean
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* STICKY FOOTER — HONEST, CLEAR LIFECYCLE ACTIONS */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {problem.status !== 'solved' ? (
              <>
                {(reminderActive || actionActive) && (
                  <button
                    type="button"
                    onClick={() => {
                      recordProblemHeld(problem.id, todayDate);
                      showToast('Logged "Held today" — problem stays open until you resolve it');
                    }}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                      heldToday
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                        : 'bg-slate-900 hover:bg-emerald-500/10 text-slate-200 hover:text-emerald-300 border-slate-700'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{heldToday ? 'Held Today ✓' : 'Held Today'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    updateProblem(problem.id, { status: 'solved', classified: true });
                    onClose();
                  }}
                  className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-extrabold transition-colors ${
                    verification.readyToVerify
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400'
                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/35'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {activeDescendantCount > 0
                      ? `Mark Resolved (+${activeDescendantCount} slips)`
                      : 'Mark Resolved'}
                  </span>
                </button>
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

          <div>
            {confirmDelete ? (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    deleteProblem(problem.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-extrabold"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
