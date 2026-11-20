import React, { useState, useEffect } from 'react';
import {
  ProblemCategory,
  ProblemDispatchTarget,
  ProblemEntry,
  ProblemFixType,
  ProblemSourceType
} from '../../types/schema';
import {
  CATEGORY_MAP,
  DISPATCH_TARGET_LABELS,
  FIX_TYPE_MAP,
  PROBLEM_CATEGORIES,
  PROBLEM_FIX_TYPES,
  STATUS_META,
  getLastOccurrenceDate,
  normalizeTag,
  tagsMatch
} from '../../lib/problems';
import { useStorage } from '../../context/StorageContext';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
  Plus,
  RotateCcw,
  Send,
  Shield,
  Tag,
  Trash2,
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
}

export const ProblemItemRow: React.FC<ProblemItemRowProps> = ({
  problem,
  contextDate,
  contextSourceType,
  contextSourceRef,
  targetWeekId,
  periodOccurrenceCount,
  compact = false,
  defaultExpanded = false
}) => {
  const {
    strategyPlans,
    updateProblem,
    recordProblemRecurrence,
    deleteProblem,
    dispatchProblemFix
  } = useStorage();

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [titleDraft, setTitleDraft] = useState(problem.title);
  const [fixNoteDraft, setFixNoteDraft] = useState(problem.fixNote || '');
  const [tagInput, setTagInput] = useState('');
  const [justLoggedPlusOne, setJustLoggedPlusOne] = useState(false);
  const [dispatchFeedback, setDispatchFeedback] = useState<string | null>(null);

  useEffect(() => {
    setTitleDraft(problem.title);
  }, [problem.title]);

  useEffect(() => {
    setFixNoteDraft(problem.fixNote || '');
  }, [problem.fixNote]);

  const catMeta = CATEGORY_MAP[problem.category] || CATEGORY_MAP.mindset;
  const statusMeta = STATUS_META[problem.status] || STATUS_META.open;
  const fixMeta = problem.fixType ? FIX_TYPE_MAP[problem.fixType] : null;
  const totalCount = Math.max(1, (problem.occurrences || []).length);
  const lastDate = getLastOccurrenceDate(problem);
  const roadmapTitles = strategyPlans.map(p => p.title.trim()).filter(Boolean);

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

  const handleSelectFixType = (fixType: ProblemFixType) => {
    const nextStatus =
      problem.status === 'open' && fixType !== 'watch' ? 'testing' : problem.status;
    updateProblem(problem.id, {
      fixType,
      status: nextStatus
    });
  };

  const handleSaveFixNote = () => {
    const trimmed = fixNoteDraft.trim();
    if (trimmed !== (problem.fixNote || '').trim()) {
      updateProblem(problem.id, {
        fixNote: trimmed,
        ...(trimmed && problem.status === 'open' && problem.fixType !== 'watch'
          ? { status: 'testing' }
          : {})
      });
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

  const handleDispatch = (target: ProblemDispatchTarget) => {
    const textToSend = fixNoteDraft.trim() || problem.fixNote?.trim() || problem.title;
    if (fixNoteDraft.trim() && fixNoteDraft.trim() !== (problem.fixNote || '').trim()) {
      updateProblem(problem.id, { fixNote: fixNoteDraft.trim() });
    }
    const ok = dispatchProblemFix(problem.id, target, textToSend, targetWeekId);
    if (ok) {
      setDispatchFeedback(`Sent to ${DISPATCH_TARGET_LABELS[target]}`);
      setTimeout(() => setDispatchFeedback(null), 2000);
    }
  };

  const isRoadmapTag = (tag: string) => roadmapTitles.some(rt => tagsMatch(rt, tag));

  return (
    <div
      className={`rounded-2xl border transition-all ${
        problem.status === 'solved'
          ? 'bg-slate-950/60 border-emerald-500/25'
          : problem.status === 'testing'
          ? 'bg-slate-950/90 border-sky-500/30'
          : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Main Row */}
      <div className={`${compact ? 'p-2.5' : 'p-3.5'} space-y-2`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Badges Line */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold uppercase tracking-wider ${statusMeta.badgeClass}`}
              >
                {statusMeta.label}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${catMeta.badgeClass}`}
              >
                {catMeta.shortLabel}
              </span>
              {totalCount > 1 && (
                <span
                  className="px-1.5 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-300 font-mono text-[10px] font-extrabold"
                  title={`Occurred ${totalCount} times total (last: ${lastDate})`}
                >
                  ×{totalCount}
                  {periodOccurrenceCount !== undefined &&
                  periodOccurrenceCount !== totalCount &&
                  periodOccurrenceCount > 0
                    ? ` (${periodOccurrenceCount} here)`
                    : ''}
                </span>
              )}
              {problem.fixType === 'rule_guardrail' && problem.status !== 'solved' && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-bold">
                  <Shield className="w-2.5 h-2.5" />
                  <span>Active Rule</span>
                </span>
              )}
              <span className="text-[10px] font-mono text-slate-500">{lastDate}</span>
            </div>

            {/* Problem Title */}
            <p
              className={`text-xs sm:text-sm font-semibold leading-snug break-words ${
                problem.status === 'solved' ? 'text-slate-400 line-through' : 'text-slate-100'
              }`}
            >
              {problem.title}
            </p>

            {/* Tags */}
            {problem.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {problem.tags.map(tag => (
                  <span
                    key={tag}
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      isRoadmapTag(tag)
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {isRoadmapTag(tag) ? (
                      <MapIcon className="w-2.5 h-2.5 shrink-0" />
                    ) : (
                      <span>#</span>
                    )}
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Compact Fix Summary when collapsed */}
            {!expanded && (fixMeta || problem.fixNote?.trim()) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] text-slate-300">
                {fixMeta && (
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${fixMeta.badgeClass}`}
                  >
                    {fixMeta.shortLabel}
                  </span>
                )}
                {problem.fixNote?.trim() && (
                  <span className="text-slate-300">{problem.fixNote.trim()}</span>
                )}
                {(problem.dispatchedTo || []).map(dest => (
                  <span
                    key={dest}
                    className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[9px] font-bold"
                  >
                    ✓ {DISPATCH_TARGET_LABELS[dest]}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right Quick Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handlePlusOne}
              title={
                problem.status === 'solved'
                  ? 'Happened again — re-open and log recurrence'
                  : 'Happened again (+1 recurrence)'
              }
              className={`px-2 py-1 rounded-lg border text-[10px] font-extrabold transition-all active:scale-95 ${
                justLoggedPlusOne
                  ? 'bg-orange-500 text-slate-950 border-orange-400'
                  : 'bg-slate-900 hover:bg-orange-500/15 text-orange-300 border-slate-800 hover:border-orange-500/40'
              }`}
            >
              {justLoggedPlusOne ? 'Logged!' : '+1'}
            </button>

            {problem.status === 'testing' && (
              <button
                type="button"
                onClick={() => updateProblem(problem.id, { status: 'solved' })}
                title="Fix worked — mark verified Solved"
                className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            )}

            {problem.status === 'solved' && (
              <button
                type="button"
                onClick={() => updateProblem(problem.id, { status: 'open' })}
                title="Re-open problem"
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setExpanded(prev => !prev)}
              className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
                expanded
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
              title="Assign fix, push to plan/checklist, or edit tags"
            >
              <Wrench className="w-3 h-3" />
              <span className="hidden sm:inline">{problem.fixType ? 'Fix' : 'Solve'}</span>
              {expanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            <button
              type="button"
              onClick={() => deleteProblem(problem.id)}
              title="Delete problem"
              className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Feedback Loop & Fix Drawer */}
      {expanded && (
        <div className="px-3.5 pb-3.5 pt-2.5 border-t border-slate-800/80 bg-slate-900/40 space-y-3 rounded-b-2xl">
          {/* Editable Title & Category */}
          <div className="space-y-2">
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
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-100 focus:outline-none"
              placeholder="Problem description..."
            />

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                Category:
              </span>
              {PROBLEM_CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => updateProblem(problem.id, { category: c.id as ProblemCategory })}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all ${
                    problem.category === c.id
                      ? c.activeChipClass
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {c.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Tags / Linked Plans */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Tag className="w-3 h-3" />
              <span>Linked Plans & Tags</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
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

              <div className="inline-flex items-center bg-slate-950 border border-slate-800 focus-within:border-amber-500/50 rounded-full px-2 py-0.5">
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
                  placeholder="+ custom tag"
                  className="bg-transparent text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none w-20"
                />
                {tagInput.trim() && (
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="text-amber-400 hover:text-amber-300 ml-1"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step 1: Fix Type */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/70">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400 block">
              How should this be solved? (Fix Type)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PROBLEM_FIX_TYPES.map(ft => {
                const selected = problem.fixType === ft.id;
                return (
                  <button
                    key={ft.id}
                    type="button"
                    onClick={() => handleSelectFixType(ft.id)}
                    title={ft.hint}
                    className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all ${
                      selected
                        ? `${ft.badgeClass} ring-1 ring-current`
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {ft.label}
                  </button>
                );
              })}
            </div>
            {fixMeta && (
              <p className="text-[11px] text-slate-400">{fixMeta.hint}</p>
            )}
          </div>

          {/* Step 2: 1-Line Fix / Rule / Adjustment */}
          <div className="space-y-1.5">
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
              placeholder={
                problem.fixType === 'rule_guardrail'
                  ? 'Write the exact boundary / If-Then rule (e.g. No phone in bedroom after 10:30pm)...'
                  : problem.fixType === 'habit_rewire'
                  ? 'Write the daily/weekly habit rewire (e.g. 10:30pm alarm + lights out)...'
                  : problem.fixType === 'skill_reps'
                  ? 'Write the rep protocol (e.g. 50 chart backtests, 10 min drill)...'
                  : problem.fixType === 'plan_change'
                  ? 'Write what changes in your Weekly Plan or Roadmap...'
                  : 'Write the concrete 1-line fix or intervention...'
              }
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
            />
          </div>

          {/* Step 3: 1-Click Dispatch into Legio (contextual by Fix Type) */}
          {fixMeta && fixMeta.dispatchTargets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Push action to:
              </span>
              {fixMeta.dispatchTargets.map(target => {
                const alreadySent = (problem.dispatchedTo || []).includes(target);
                return (
                  <button
                    key={target}
                    type="button"
                    onClick={() => handleDispatch(target)}
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all active:scale-95 ${
                      alreadySent
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25'
                        : 'bg-slate-950 hover:bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    <Send className="w-3 h-3" />
                    <span>
                      {alreadySent
                        ? `✓ Sent to ${DISPATCH_TARGET_LABELS[target]}`
                        : `→ ${DISPATCH_TARGET_LABELS[target]}`}
                    </span>
                  </button>
                );
              })}
              {dispatchFeedback && (
                <span className="text-[11px] font-bold text-emerald-400">{dispatchFeedback}</span>
              )}
            </div>
          )}

          {/* Step 4: Feedback Loop Status Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
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
                  updateProblem(problem.id, { status: 'testing' });
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
                    : 'bg-slate-950 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Verified Solved</span>
              </button>
            </div>

            {problem.occurrences.length > 0 && (
              <span className="text-[10px] text-slate-500 font-mono">
                {problem.occurrences.length} log{problem.occurrences.length === 1 ? '' : 's'} · last {lastDate}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
