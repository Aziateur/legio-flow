import React, { useState, useEffect, useMemo } from 'react';
import {
  ProblemCategory,
  ProblemDispatchTarget,
  ProblemEntry,
  ProblemSeverity,
  ProblemSourceType
} from '../../types/schema';
import {
  DISPATCH_TARGET_LABELS,
  PROBLEM_SEVERITIES,
  SEVERITY_META,
  getAbsorbableProblems,
  getClusterTotalHits,
  getDescendantProblems,
  getDirectChildren,
  getEligibleClusterTargets,
  getFixVerificationProgress,
  getLastOccurrenceDate,
  getProblemSeverity,
  isProblemGuardrail,
  normalizeTag,
  resolveCategoryMeta,
  severityToImpact,
  tagsMatch
} from '../../lib/problems';
import { useStorage } from '../../context/StorageContext';
import { isActiveStrategyPlan } from '../../lib/planHierarchy';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Crosshair,
  History,
  Layers,
  Map as MapIcon,
  Plus,
  RotateCcw,
  Send,
  Shield,
  Tag,
  Trash2,
  Unlink,
  Wrench,
  X
} from 'lucide-react';

interface ProblemItemRowProps {
  problem: ProblemEntry;
  contextDate: string;
  contextSourceType: ProblemSourceType;
  contextSourceRef?: string;
  targetWeekId?: string;
  periodOccurrenceCount?: number;
  compact?: boolean;
  defaultExpanded?: boolean;
  showParentBreadcrumb?: boolean;
  nested?: boolean;
  inboxMode?: boolean;
}

const VERIFY_DAY_OPTIONS = [7, 14, 30];

const DIRECT_DISPATCH_BUTTONS: Array<{
  target: ProblemDispatchTarget;
  label: string;
}> = [
  { target: 'weekly_plan', label: 'Weekly Plan' },
  { target: 'checklist_daily', label: 'Daily Habit' },
  { target: 'checklist_weekly', label: 'Weekly Habit' },
  { target: 'checklist_oneoff', label: 'One-Off' },
  { target: 'reps_board', label: 'Reps Board' }
];

export const ProblemItemRow: React.FC<ProblemItemRowProps> = ({
  problem,
  contextDate,
  contextSourceType,
  contextSourceRef,
  targetWeekId,
  periodOccurrenceCount,
  compact = false,
  defaultExpanded = false,
  showParentBreadcrumb = false,
  nested = false,
  inboxMode = false
}) => {
  const {
    todayDate,
    problems,
    problemCategories,
    problemSettings,
    strategyPlans,
    updateProblem,
    recordProblemRecurrence,
    clusterIntoNewParent,
    deleteProblem,
    dispatchProblemFix
  } = useStorage();

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [childrenOpen, setChildrenOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(problem.title);
  const [triggerDraft, setTriggerDraft] = useState(problem.trigger || '');
  const [rootCauseDraft, setRootCauseDraft] = useState(problem.rootCause || '');
  const [fixNoteDraft, setFixNoteDraft] = useState(problem.fixNote || '');
  const [tagInput, setTagInput] = useState('');
  const [newParentTitle, setNewParentTitle] = useState('');
  const [justLoggedPlusOne, setJustLoggedPlusOne] = useState(false);
  const [dispatchFeedback, setDispatchFeedback] = useState<string | null>(null);
  const [showAttempts, setShowAttempts] = useState(false);
  const [severityPickerOpen, setSeverityPickerOpen] = useState(false);

  useEffect(() => {
    setTitleDraft(problem.title);
  }, [problem.title]);

  useEffect(() => {
    setTriggerDraft(problem.trigger || '');
  }, [problem.trigger]);

  useEffect(() => {
    setRootCauseDraft(problem.rootCause || '');
  }, [problem.rootCause]);

  useEffect(() => {
    setFixNoteDraft(problem.fixNote || '');
  }, [problem.fixNote]);

  const severity = getProblemSeverity(problem);
  const severityMeta = SEVERITY_META[severity];
  const catMeta = resolveCategoryMeta(problem.category, problemCategories);
  const isGuardrail = isProblemGuardrail(problem);
  const lastDate = getLastOccurrenceDate(problem);
  const roadmapTitles = strategyPlans
    .filter(isActiveStrategyPlan)
    .map(p => p.title.trim())
    .filter(Boolean);
  const maxTop = problemSettings.maxTopConstraints || 3;
  const defaultVerifyDays = problemSettings.defaultVerifyDays || 14;

  const verification = useMemo(
    () => getFixVerificationProgress(problem, todayDate, defaultVerifyDays),
    [problem, todayDate, defaultVerifyDays]
  );

  const directChildren = useMemo(
    () => getDirectChildren(problems, problem.id),
    [problems, problem.id]
  );
  const allDescendants = useMemo(
    () => getDescendantProblems(problems, problem.id),
    [problems, problem.id]
  );
  const clusterHits = useMemo(
    () => getClusterTotalHits(problems, problem),
    [problems, problem]
  );
  const parentProblem = useMemo(
    () => (problem.parentProblemId ? problems.find(p => p.id === problem.parentProblemId) : undefined),
    [problems, problem.parentProblemId]
  );
  const clusterTargets = useMemo(
    () => getEligibleClusterTargets(problems, problem.id),
    [problems, problem.id]
  );
  const totalClusterTargets = clusterTargets.roots.length + clusterTargets.frictions.length;
  const absorbable = useMemo(
    () => getAbsorbableProblems(problems, problem.id),
    [problems, problem.id]
  );
  const totalAbsorbable = absorbable.frictions.length + absorbable.others.length;

  const handleSetSeverity = (grade: ProblemSeverity) => {
    updateProblem(problem.id, {
      severity: grade,
      impact: severityToImpact(grade),
      scale:
        grade >= 5
          ? 'blocker'
          : grade >= 4
          ? 'bottleneck'
          : problem.scale || 'friction'
    });
    setSeverityPickerOpen(false);
  };

  const handleMergeUnderTarget = (targetId: string) => {
    if (!targetId) {
      updateProblem(problem.id, { parentProblemId: undefined });
      return;
    }
    const target = problems.find(p => p.id === targetId);
    if (target && (!target.scale || target.scale === 'friction')) {
      updateProblem(target.id, { scale: 'bottleneck' });
    }
    updateProblem(problem.id, { parentProblemId: targetId });
  };

  const handleAbsorbOther = (childId: string) => {
    if (!childId) return;
    updateProblem(childId, { parentProblemId: problem.id });
    if (!problem.scale || problem.scale === 'friction') {
      updateProblem(problem.id, { scale: 'bottleneck' });
    }
    setChildrenOpen(true);
  };
  const activeDescendantCount = allDescendants.filter(d => d.status !== 'solved').length;
  const currentTopCount = useMemo(
    () => problems.filter(p => p.isTopConstraint && p.status !== 'solved').length,
    [problems]
  );

  const failedAttempts = (problem.fixAttempts || []).filter(a => a.outcome === 'failed');
  const allAttempts = problem.fixAttempts || [];
  const justFailedFix = Boolean(problem.lastFixFailedAt && problem.status === 'open');

  const handlePlusOne = (e: React.MouseEvent) => {
    e.stopPropagation();
    recordProblemRecurrence(problem.id, {
      date: contextDate,
      sourceType: contextSourceType,
      ...(contextSourceRef ? { sourceRef: contextSourceRef } : {})
    });
    setJustLoggedPlusOne(true);
    setTimeout(() => setJustLoggedPlusOne(false), 1400);
  };

  const handleToggleTopConstraint = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (problem.isTopConstraint) {
      updateProblem(problem.id, { isTopConstraint: false });
      return;
    }
    if (currentTopCount >= maxTop) {
      setDispatchFeedback(`Top ${maxTop} full — unpin one first`);
      setTimeout(() => setDispatchFeedback(null), 2200);
      return;
    }
    updateProblem(problem.id, {
      isTopConstraint: true,
      scale: problem.scale === 'blocker' ? 'blocker' : 'bottleneck',
      ...(problem.status === 'solved' ? { status: 'open' } : {})
    });
  };

  const handleSaveDiagnosisField = (field: 'trigger' | 'rootCause', value: string) => {
    const trimmed = value.trim();
    const prev = (problem[field] || '').trim();
    if (trimmed !== prev) {
      updateProblem(problem.id, {
        [field]: trimmed,
        ...(trimmed && (!problem.scale || problem.scale === 'friction') ? { scale: 'bottleneck' } : {})
      });
    }
  };

  const handleSaveFixNote = () => {
    const trimmed = fixNoteDraft.trim();
    if (trimmed !== (problem.fixNote || '').trim()) {
      updateProblem(problem.id, {
        fixNote: trimmed,
        ...(trimmed && (!problem.scale || problem.scale === 'friction') ? { scale: 'bottleneck' } : {}),
        ...(trimmed && problem.status === 'open'
          ? { status: 'testing', fixStartedAt: todayDate }
          : {})
      });
    }
  };

  const handleToggleGuardrail = () => {
    const nextVal = !isGuardrail;
    const trimmedFix = fixNoteDraft.trim();
    updateProblem(problem.id, {
      isGuardrail: nextVal,
      fixType: nextVal ? 'rule_guardrail' : problem.fixType === 'rule_guardrail' ? undefined : problem.fixType,
      ...(trimmedFix ? { fixNote: trimmedFix } : {}),
      ...(nextVal && problem.status === 'open' ? { status: 'testing', fixStartedAt: todayDate } : {}),
      ...(nextVal && (!problem.scale || problem.scale === 'friction') ? { scale: 'bottleneck' } : {})
    });
    if (nextVal) {
      setDispatchFeedback('Pinned as Pre-Flight Guardrail');
      setTimeout(() => setDispatchFeedback(null), 2000);
    }
  };

  const handleDispatch = (target: ProblemDispatchTarget) => {
    const textToSend = fixNoteDraft.trim() || problem.fixNote?.trim() || problem.title;
    if (fixNoteDraft.trim() && fixNoteDraft.trim() !== (problem.fixNote || '').trim()) {
      updateProblem(problem.id, { fixNote: fixNoteDraft.trim() });
    }
    const ok = dispatchProblemFix(problem.id, target, textToSend, targetWeekId);
    if (ok) {
      setDispatchFeedback(`Sent → ${DISPATCH_TARGET_LABELS[target]}`);
      setTimeout(() => setDispatchFeedback(null), 2200);
    }
  };

  const handleToggleTag = (rawTag: string) => {
    const cleaned = normalizeTag(rawTag);
    if (!cleaned) return;
    const exists = problem.tags.some(t => tagsMatch(t, cleaned));
    const nextTags = exists
      ? problem.tags.filter(t => !tagsMatch(t, cleaned))
      : [...problem.tags, cleaned];
    updateProblem(problem.id, { tags: nextTags });
  };

  const handleAddCustomTag = () => {
    const cleaned = normalizeTag(tagInput);
    if (!cleaned) return;
    if (!problem.tags.some(t => tagsMatch(t, cleaned))) {
      updateProblem(problem.id, { tags: [...problem.tags, cleaned] });
    }
    setTagInput('');
  };

  const handlePromoteToRoot = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSev: ProblemSeverity = severity < 3 ? 3 : severity;
    updateProblem(problem.id, {
      scale: nextSev >= 5 ? 'blocker' : 'bottleneck',
      severity: nextSev,
      impact: severityToImpact(nextSev)
    });
  };

  const handleCreateAndCluster = () => {
    const trimmed = newParentTitle.trim();
    if (!trimmed) return;
    clusterIntoNewParent(problem.id, trimmed, 'bottleneck');
    setNewParentTitle('');
    setExpanded(false);
  };

  const isRoadmapTag = (tag: string) => roadmapTitles.some(rt => tagsMatch(rt, tag));

  const borderStyle = nested
    ? 'bg-slate-900/70 border-slate-800/80'
    : problem.status === 'solved'
    ? 'bg-slate-950/60 border-emerald-500/20'
    : justFailedFix
    ? 'bg-slate-950/95 border-rose-500/40'
    : verification.readyToVerify
    ? 'bg-slate-950/95 border-emerald-500/40'
    : problem.isTopConstraint
    ? 'bg-slate-950/95 border-amber-500/35'
    : 'bg-slate-950/90 border-slate-800 hover:border-slate-700';

  return (
    <div className={`rounded-2xl border transition-all ${borderStyle}`}>
      {/* QUIET, HIGH-SIGNAL COLLAPSED ROW */}
      <div className={`${compact || nested ? 'p-3' : 'p-4'} space-y-1.5`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            {/* Title Line (Clickable Severity Badge + Clean Title) */}
            <div className="flex items-start space-x-2.5">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setSeverityPickerOpen(v => !v);
                }}
                className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded-md border font-mono text-[10px] font-extrabold transition-all hover:scale-105 ${
                  problem.status === 'solved'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                    : severityMeta.badgeClass
                }`}
                title={`Severity ${severityMeta.label}: ${severityMeta.hint} — click to grade (1–5)`}
              >
                {severityMeta.code}
              </button>
              <div className="min-w-0 flex-1">
                {showParentBreadcrumb && parentProblem && (
                  <div className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-300/80 mb-0.5">
                    <CornerDownRight className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[260px]">Inside: {parentProblem.title}</span>
                  </div>
                )}

                <p
                  className={`text-xs sm:text-sm font-semibold leading-snug break-words ${
                    problem.status === 'solved' ? 'text-slate-400 line-through' : 'text-slate-100'
                  }`}
                >
                  {problem.title}
                </p>

                {/* Inline 1-Click Severity Grade Strip */}
                {severityPickerOpen && (
                  <div
                    className="mt-1.5 flex flex-wrap items-center gap-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-0.5">
                      Grade:
                    </span>
                    {PROBLEM_SEVERITIES.map(sv => (
                      <button
                        key={sv.grade}
                        type="button"
                        onClick={() => handleSetSeverity(sv.grade)}
                        title={sv.hint}
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold transition-all ${
                          severity === sv.grade
                            ? sv.activeChipClass
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {sv.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Single Quiet Metadata Line */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-8 text-[11px] text-slate-400">
              <span className="inline-flex items-center space-x-1 font-semibold text-slate-300">
                <span className={`w-1.5 h-1.5 rounded-full ${catMeta.dotClass}`} />
                <span>{catMeta.shortLabel}</span>
              </span>

              {severity >= 4 && problem.status !== 'solved' && (
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    severity === 5 ? 'text-rose-400' : 'text-orange-400'
                  }`}
                >
                  · {severityMeta.shortLabel}
                </span>
              )}

              {clusterHits > 1 && (
                <span className="font-mono text-[11px] font-bold text-orange-300">
                  · ×{clusterHits}
                  {periodOccurrenceCount !== undefined &&
                  periodOccurrenceCount !== clusterHits &&
                  periodOccurrenceCount > 0
                    ? ` (${periodOccurrenceCount} here)`
                    : ''}
                </span>
              )}

              {/* Live Experiment / Verification Signal */}
              {justFailedFix && (
                <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/35 text-rose-300 text-[10px] font-bold">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  <span>
                    Fix failed ({failedAttempts.length}×) — try deeper fix
                  </span>
                </span>
              )}

              {verification.isTesting && verification.readyToVerify && (
                <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-bold">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>
                    Clean {verification.daysClean}/{verification.targetDays}d — Verify Solved?
                  </span>
                </span>
              )}

              {verification.isTesting && !verification.readyToVerify && (
                <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 font-mono text-[10px] font-bold">
                  <span>
                    Testing · {verification.daysClean}/{verification.targetDays}d clean
                  </span>
                </span>
              )}

              {isGuardrail && problem.status !== 'solved' && (
                <span className="inline-flex items-center space-x-1 text-amber-300 text-[10px] font-bold">
                  <Shield className="w-2.5 h-2.5" />
                  <span>Guardrail</span>
                </span>
              )}

              {directChildren.length > 0 && (
                <button
                  type="button"
                  onClick={() => setChildrenOpen(prev => !prev)}
                  className="inline-flex items-center space-x-1 text-amber-300 hover:text-amber-200 font-bold text-[10px]"
                >
                  <Layers className="w-2.5 h-2.5" />
                  <span>
                    {directChildren.length} {directChildren.length === 1 ? 'slip' : 'slips'}
                  </span>
                  {childrenOpen ? (
                    <ChevronUp className="w-2.5 h-2.5" />
                  ) : (
                    <ChevronDown className="w-2.5 h-2.5" />
                  )}
                </button>
              )}

              {problem.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[10px] text-slate-500">
                  · {isRoadmapTag(tag) ? tag : `#${tag}`}
                </span>
              ))}

              <span className="text-[10px] font-mono text-slate-600">· {lastDate}</span>
            </div>

            {/* Compact Trigger -> Fix Preview (when collapsed) */}
            {!expanded && (problem.trigger?.trim() || problem.fixNote?.trim()) && (
              <div className="pl-5 pt-0.5 text-[11px] text-slate-300 leading-snug">
                {problem.trigger?.trim() && (
                  <span className="text-slate-400">
                    <strong className="text-amber-400/90">IF</strong> {problem.trigger.trim()}{' '}
                    <strong className="text-emerald-400">→</strong>{' '}
                  </span>
                )}
                {problem.fixNote?.trim() && <span>{problem.fixNote.trim()}</span>}
                {(problem.dispatchedTo || []).length > 0 && (
                  <span className="ml-2 text-[10px] text-emerald-400/80 font-semibold">
                    (✓ {(problem.dispatchedTo || []).map(d => DISPATCH_TARGET_LABELS[d]).join(', ')})
                  </span>
                )}
              </div>
            )}

            {dispatchFeedback && !expanded && (
              <div className="pl-5 text-[11px] font-bold text-amber-300">{dispatchFeedback}</div>
            )}
          </div>

          {/* RIGHT QUICK ACTIONS */}
          <div className="flex items-center gap-1.5 shrink-0">
            {inboxMode ? (
              <>
                {totalClusterTargets > 0 && (
                  <select
                    value=""
                    onChange={e => {
                      if (e.target.value) {
                        handleMergeUnderTarget(e.target.value);
                      }
                    }}
                    className="bg-slate-900 border border-slate-700 hover:border-amber-500/40 rounded-lg px-2 py-1 text-[11px] font-bold text-amber-300 focus:outline-none max-w-[165px]"
                    title="Cluster this slip under any existing Root Constraint or other Friction"
                  >
                    <option value="">Cluster with...</option>
                    {clusterTargets.roots.length > 0 && (
                      <optgroup label="Root Constraints">
                        {clusterTargets.roots.map(r => (
                          <option key={r.id} value={r.id}>
                            [{SEVERITY_META[getProblemSeverity(r)].code}] {r.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {clusterTargets.frictions.length > 0 && (
                      <optgroup label="Other Frictions / Slips">
                        {clusterTargets.frictions.map(f => (
                          <option key={f.id} value={f.id}>
                            [{SEVERITY_META[getProblemSeverity(f)].code}] {f.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}

                <button
                  type="button"
                  onClick={handlePromoteToRoot}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 text-[11px] font-bold transition-colors"
                  title="Promote slip into a Root Problem to diagnose & solve"
                >
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Promote</span>
                </button>

                <button
                  type="button"
                  onClick={() => deleteProblem(problem.id)}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-500/15 text-slate-400 hover:text-rose-300 border border-slate-800 text-[11px] font-bold transition-colors"
                  title="Dismiss one-off noise"
                >
                  Dismiss
                </button>
              </>
            ) : (
              <>
                {!nested && problem.status !== 'solved' && (
                  <button
                    type="button"
                    onClick={handleToggleTopConstraint}
                    title={
                      problem.isTopConstraint
                        ? `Unpin from Top ${maxTop} Constraints`
                        : `Pin to Top ${maxTop} Constraints`
                    }
                    className={`p-1.5 rounded-lg border transition-all ${
                      problem.isTopConstraint
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/45'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-amber-300 border-slate-800'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handlePlusOne}
                  title={
                    problem.status === 'testing'
                      ? 'Fired again — marks current fix attempt as Failed and re-opens'
                      : problem.status === 'solved'
                      ? 'Happened again — re-open and log recurrence'
                      : 'Happened again (+1 recurrence)'
                  }
                  className={`px-2 py-1 rounded-lg border text-[11px] font-extrabold transition-all active:scale-95 ${
                    justLoggedPlusOne
                      ? 'bg-orange-500 text-slate-950 border-orange-400'
                      : 'bg-slate-900 hover:bg-orange-500/15 text-orange-300 border-slate-800 hover:border-orange-500/40'
                  }`}
                >
                  {justLoggedPlusOne ? 'Logged!' : '+1'}
                </button>

                {nested && parentProblem && (
                  <button
                    type="button"
                    onClick={() => updateProblem(problem.id, { parentProblemId: undefined })}
                    title="Unlink slip from parent problem"
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                )}

                {problem.status === 'testing' && (
                  <button
                    type="button"
                    onClick={() => updateProblem(problem.id, { status: 'solved' })}
                    title={
                      activeDescendantCount > 0
                        ? `Fix held — mark Solved & close ${activeDescendantCount} linked slip(s)`
                        : 'Fix held — mark Verified Solved'
                    }
                    className={`p-1.5 rounded-lg border transition-colors ${
                      verification.readyToVerify
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm shadow-emerald-500/20'
                        : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/35'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {problem.status === 'solved' && (
                  <button
                    type="button"
                    onClick={() => updateProblem(problem.id, { status: 'open' })}
                    title="Re-open problem"
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setExpanded(prev => !prev)}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                    expanded
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  <Wrench className="w-3 h-3" />
                  <span className="hidden sm:inline">{problem.fixNote?.trim() ? 'Edit' : 'Solve'}</span>
                  {expanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* NESTED ABSORBED SLIPS */}
      {childrenOpen && directChildren.length > 0 && (
        <div className="px-4 pb-3 pt-2 border-t border-slate-800/70 bg-slate-950/50 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            <CornerDownRight className="w-3 h-3 text-amber-400" />
            <span>Absorbed Slips ({directChildren.length})</span>
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
              />
            ))}
          </div>
        </div>
      )}

      {/* CLEAN 3-STEP DEEP SOLVE DRAWER (Diagnose -> Countermeasure -> Verify) */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-slate-800/80 bg-slate-900/40 space-y-4 rounded-b-2xl text-xs">
          {/* STEP 1: DIAGNOSE (Cost, Category, Trigger, Root Cause, Clustering) */}
          <div className="space-y-3">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 block">
              1. Diagnose — Mechanism &amp; Cost
            </span>

            <input
              type="text"
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={() => {
                if (titleDraft.trim() && titleDraft.trim() !== problem.title) {
                  updateProblem(problem.id, { title: titleDraft.trim() });
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (titleDraft.trim() && titleDraft.trim() !== problem.title) {
                    updateProblem(problem.id, { title: titleDraft.trim() });
                  }
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-100 focus:outline-none"
              placeholder="Problem statement..."
            />

            {/* Severity Grade (1-5) + Custom Categories */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                  Severity (1–5):
                </span>
                {PROBLEM_SEVERITIES.map(sv => (
                  <button
                    key={sv.grade}
                    type="button"
                    onClick={() => handleSetSeverity(sv.grade)}
                    title={sv.hint}
                    className={`px-2 py-0.5 rounded-lg border text-[10px] font-extrabold transition-all ${
                      severity === sv.grade
                        ? sv.activeChipClass
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {sv.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                  Category:
                </span>
                {problemCategories.map(c => {
                  const meta = resolveCategoryMeta(c.id, problemCategories);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => updateProblem(problem.id, { category: c.id as ProblemCategory })}
                      title={c.hint}
                      className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all ${
                        problem.category === c.id
                          ? meta.activeChipClass
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trigger + Root Cause */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Trigger / Context (When does it fire?)
                </label>
                <input
                  type="text"
                  value={triggerDraft}
                  onChange={e => setTriggerDraft(e.target.value)}
                  onBlur={() => handleSaveDiagnosisField('trigger', triggerDraft)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveDiagnosisField('trigger', triggerDraft);
                    }
                  }}
                  placeholder="e.g. Right after a losing trade, or after 10pm with phone..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  True Root Cause (Why is it actually happening?)
                </label>
                <input
                  type="text"
                  value={rootCauseDraft}
                  onChange={e => setRootCauseDraft(e.target.value)}
                  onBlur={() => handleSaveDiagnosisField('rootCause', rootCauseDraft)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveDiagnosisField('rootCause', rootCauseDraft);
                    }
                  }}
                  placeholder="e.g. Task wasn't broken down before session, or ego wanting loss back..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Roadmap Link + Tags */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                <Tag className="w-3 h-3" />
                <span>Roadmap / Tags:</span>
              </span>
              {roadmapTitles.map(rt => {
                const active = problem.tags.some(t => tagsMatch(t, rt));
                return (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => handleToggleTag(rt)}
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[10px] font-bold transition-all ${
                      active
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                        : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    <MapIcon className="w-2.5 h-2.5" />
                    <span>{rt}</span>
                  </button>
                );
              })}
              {problem.tags
                .filter(t => !isRoadmapTag(t))
                .map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-bold"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className="text-slate-400 hover:text-rose-400"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              <div className="inline-flex items-center bg-slate-950 border border-slate-800 rounded-full px-2 py-0.5">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddCustomTag();
                    }
                  }}
                  placeholder="+ tag"
                  className="bg-transparent text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none w-16"
                />
                {tagInput.trim() && (
                  <button type="button" onClick={handleAddCustomTag} className="text-amber-400 ml-1">
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Clean Dropdown Clustering: See ALL other Frictions & Root Constraints directly */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2">
              <div className="flex items-center space-x-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                <Layers className="w-3 h-3" />
                <span>Cluster Frictions &amp; Related Issues</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {totalAbsorbable > 0 && !nested && (
                  <select
                    value=""
                    onChange={e => {
                      if (e.target.value) handleAbsorbOther(e.target.value);
                    }}
                    className="bg-slate-900 border border-slate-700 hover:border-amber-500/40 focus:border-amber-500/50 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 focus:outline-none max-w-xs"
                  >
                    <option value="">
                      + Pull another friction into this one ({totalAbsorbable})
                    </option>
                    {absorbable.frictions.length > 0 && (
                      <optgroup label="Other Frictions / Slips">
                        {absorbable.frictions.map(f => (
                          <option key={f.id} value={f.id}>
                            ↳ [{SEVERITY_META[getProblemSeverity(f)].code}] {f.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {absorbable.others.length > 0 && (
                      <optgroup label="Other Active Problems">
                        {absorbable.others.map(o => (
                          <option key={o.id} value={o.id}>
                            ↳ [{SEVERITY_META[getProblemSeverity(o)].code}] {o.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}

                {totalClusterTargets > 0 && (
                  <select
                    value={problem.parentProblemId || ''}
                    onChange={e => handleMergeUnderTarget(e.target.value)}
                    className="bg-slate-900 border border-slate-700 hover:border-amber-500/40 focus:border-amber-500/50 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 focus:outline-none max-w-xs"
                  >
                    <option value="">Merge this under another issue ({totalClusterTargets})...</option>
                    {clusterTargets.roots.length > 0 && (
                      <optgroup label="Root Constraints">
                        {clusterTargets.roots.map(r => (
                          <option key={r.id} value={r.id}>
                            ↑ [{SEVERITY_META[getProblemSeverity(r)].code}] {r.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {clusterTargets.frictions.length > 0 && (
                      <optgroup label="Other Frictions / Slips">
                        {clusterTargets.frictions.map(f => (
                          <option key={f.id} value={f.id}>
                            ↑ [{SEVERITY_META[getProblemSeverity(f)].code}] {f.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}

                {!parentProblem && directChildren.length === 0 && (
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={newParentTitle}
                      onChange={e => setNewParentTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateAndCluster();
                        }
                      }}
                      placeholder="Or create new parent constraint..."
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/40 w-52"
                    />
                    {newParentTitle.trim() && (
                      <button
                        type="button"
                        onClick={handleCreateAndCluster}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/35 text-[10px] font-bold"
                      >
                        + Cluster
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STEP 2: COUNTERMEASURE & EXPERIMENT (Direct Destination — NO Fix Type Bureaucracy!) */}
          <div className="space-y-2.5 pt-3 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-400">
                2. Countermeasure — Experiment &amp; Where It Lives
              </span>

              {/* Verification Window Picker */}
              <div className="flex items-center space-x-1">
                <span className="text-[10px] text-slate-500 font-bold">Verify after:</span>
                {VERIFY_DAY_OPTIONS.map(days => {
                  const active = (problem.verifyDays || defaultVerifyDays) === days;
                  return (
                    <button
                      key={days}
                      type="button"
                      onClick={() => updateProblem(problem.id, { verifyDays: days })}
                      className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border transition-all ${
                        active
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                          : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      {days}d
                    </button>
                  );
                })}
              </div>
            </div>

            <input
              type="text"
              value={fixNoteDraft}
              onChange={e => setFixNoteDraft(e.target.value)}
              onBlur={handleSaveFixNote}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSaveFixNote();
                }
              }}
              placeholder="Write the exact countermeasure or If-Then rule (e.g. Phone stays in living room at 10:30pm)..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
            />

            {/* Direct Action Destinations (1 click, zero intermediate dropdowns!) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-0.5">
                Install in:
              </span>
              {DIRECT_DISPATCH_BUTTONS.map(btn => {
                const alreadySent = (problem.dispatchedTo || []).includes(btn.target);
                return (
                  <button
                    key={btn.target}
                    type="button"
                    onClick={() => handleDispatch(btn.target)}
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all active:scale-95 ${
                      alreadySent
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                        : 'bg-slate-950 hover:bg-amber-500/15 text-slate-200 hover:text-amber-300 border-slate-800 hover:border-amber-500/35'
                    }`}
                  >
                    <Send className="w-2.5 h-2.5" />
                    <span>{alreadySent ? `✓ ${btn.label}` : btn.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleToggleGuardrail}
                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                  isGuardrail
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                    : 'bg-slate-950 hover:bg-amber-500/10 text-slate-300 border-slate-800 hover:border-amber-500/35'
                }`}
                title="Surfaces this rule in the Pre-Flight strip on Daily Plan & GWS Studio"
              >
                <Shield className="w-3 h-3" />
                <span>{isGuardrail ? '✓ Pre-Flight Guardrail' : 'Pin as Guardrail'}</span>
              </button>

              {dispatchFeedback && (
                <span className="text-[11px] font-bold text-emerald-400 ml-1">
                  {dispatchFeedback}
                </span>
              )}
            </div>

            {/* Experiment Attempt History (Never Repeat Failed Fixes!) */}
            {allAttempts.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAttempts(v => !v)}
                  className="inline-flex items-center space-x-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-200"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>
                    Experiment History ({allAttempts.length} attempt{allAttempts.length === 1 ? '' : 's'}
                    {failedAttempts.length > 0 ? ` · ${failedAttempts.length} failed` : ''})
                  </span>
                  {showAttempts ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showAttempts && (
                  <div className="mt-2 space-y-1.5 pl-3 border-l border-slate-800">
                    {allAttempts.map((att, idx) => (
                      <div
                        key={att.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-[11px] p-2 rounded-lg bg-slate-950/90 border border-slate-800/80"
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
                            {att.outcome === 'failed' ? '✗ Failed' : att.outcome === 'verified' ? '✓ Worked' : '↺ Replaced'} #{idx + 1}:
                          </span>
                          <span className="text-slate-200">"{att.fixText}"</span>
                          {att.note && <span className="text-slate-500 ml-1.5">({att.note})</span>}
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

          {/* STEP 3: VERIFY & LIFECYCLE */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => updateProblem(problem.id, { status: 'open' })}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                  problem.status === 'open'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSaveFixNote();
                  updateProblem(problem.id, { status: 'testing', fixStartedAt: todayDate });
                }}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                  problem.status === 'testing'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                Testing Fix
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSaveFixNote();
                  updateProblem(problem.id, { status: 'solved' });
                }}
                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                  problem.status === 'solved'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-950 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/15'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>
                  {activeDescendantCount > 0
                    ? `Verify Solved (Closes ${activeDescendantCount + 1})`
                    : 'Verify Solved'}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => deleteProblem(problem.id)}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
