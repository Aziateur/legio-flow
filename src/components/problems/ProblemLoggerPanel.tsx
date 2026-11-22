import React, { useMemo, useState } from 'react';
import {
  ProblemCategory,
  ProblemEntry,
  ProblemSourceType
} from '../../types/schema';
import {
  clusterHasSourceType,
  clusterHasTag,
  clusterOccurredInRange,
  clusterOccurredOnDate,
  computeProblemPriorityScore,
  countClusterOccurrencesInRange,
  defaultScaleForSource,
  getClusterTotalHits,
  getFixVerificationProgress,
  getLastOccurrenceDate,
  getProblemScale,
  hasExistingParent,
  isProblemGuardrail,
  normalizeTag,
  tagsMatch
} from '../../lib/problems';
import { useStorage } from '../../context/StorageContext';
import { ProblemItemRow } from './ProblemItemRow';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  ExternalLink,
  Plus,
  Shield
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
  filterSourceType,
  targetWeekId,
  showAuditStrip = false,
  defaultCollapsed = false,
  draftText,
  onDraftTextChange,
  draftCategory,
  draftTags,
  onDraftTagsChange
}) => {
  const {
    todayDate,
    problems,
    problemCategories,
    problemSettings,
    addProblem,
    recordProblemRecurrence,
    updateProblem,
    setActiveTab,
    setReviewSubTab
  } = useStorage();

  const defaultScale = defaultScaleForSource(sourceType);
  const defaultVerifyDays = problemSettings.defaultVerifyDays || 14;
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

    if (mode === 'roadmap' && filterTag) {
      list = topLevelProblems.filter(p => clusterHasTag(problems, p, filterTag));
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
      const rootOnly = list.filter(
        p => getProblemScale(p) !== 'friction' || p.isTopConstraint || p.status === 'testing'
      );
      hiddenSlips = list.length - rootOnly.length;
      list = rootOnly;
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
    filterSourceType,
    topLevelProblems,
    problems,
    dateRange,
    date,
    isMacroReview,
    showAllMacroSlips
  ]);

  // Quick "+1 Happened Again" chips — prioritize Top Constraints first!
  const quickRecurCandidates = useMemo(() => {
    if (mode === 'weekly_triage' || mode === 'roadmap') return [];
    const shownIds = new Set(displayedProblems.map(p => p.id));
    return topLevelProblems
      .filter(p => p.status !== 'solved' && !shownIds.has(p.id))
      .sort((a, b) => computeProblemPriorityScore(problems, b) - computeProblemPriorityScore(problems, a))
      .slice(0, 4);
  }, [mode, topLevelProblems, problems, displayedProblems]);

  // Active fixes / rules to verify during Daily or Weekly reviews
  const activeFixesToAudit = useMemo(() => {
    if (!showAuditStrip) return [];
    const shownIds = new Set(displayedProblems.map(p => p.id));
    return topLevelProblems
      .filter(
        p =>
          (p.status === 'testing' || (isProblemGuardrail(p) && p.status !== 'solved')) &&
          !shownIds.has(p.id)
      )
      .slice(0, 5);
  }, [showAuditStrip, topLevelProblems, displayedProblems]);

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
      if (finalTags.length > 0) {
        const mergedTags = Array.from(new Set([...existingMatch.tags, ...finalTags]));
        updateProblem(existingMatch.id, { tags: mergedTags });
      }
    } else {
      addProblem({
        title: trimmed,
        category: categoryValue || problemCategories[0]?.id || 'mindset',
        scale: defaultScale,
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
    recordProblemRecurrence(prob.id, {
      date,
      sourceType,
      ...(sourceRef ? { sourceRef } : {})
    });
  };

  // ================================================================
  // MODE 1: ULTRA-FAST COMPACT CAPTURE (GWS Studio & Create Modal)
  // ================================================================
  if (mode === 'compact') {
    return (
      <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-orange-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{title || 'What held me back? (Fast Capture)'}</span>
          </div>
          {displayedProblems.length > 0 && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30">
              {displayedProblems.length} logged
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
            placeholder="1-line friction or blocker & press Enter (triage later in Problem Log)..."
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-orange-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleLogProblem}
            disabled={!textValue.trim()}
            className="px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0"
          >
            + Log
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
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-orange-500/15 border border-slate-800 hover:border-orange-500/35 text-[10px] text-slate-300 hover:text-orange-200 transition-colors"
              >
                {p.isTopConstraint && <Crosshair className="w-2.5 h-2.5 text-rose-400" />}
                <span className="truncate max-w-[160px]">{p.title}</span>
                <span className="font-mono text-orange-400 font-bold">+1</span>
              </button>
            ))}
          </div>
        )}

        {displayedProblems.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {displayedProblems.map(p => (
              <ProblemItemRow
                key={p.id}
                problem={p}
                contextDate={date}
                contextSourceType={sourceType}
                contextSourceRef={sourceRef}
                targetWeekId={targetWeekId}
                compact
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ================================================================
  // MODE 2: REVIEW / WEEKLY TRIAGE / ROADMAP PANEL (Clean & Calm)
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
              {title || 'Problems & Constraints'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 font-mono text-[10px] font-bold text-slate-300">
              {activeCount} active
            </span>
          </div>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('review');
              setReviewSubTab('problems');
            }}
            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-300 transition-colors"
          >
            <span>Problem Log</span>
            <ExternalLink className="w-3 h-3" />
          </button>

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
        <div className="p-4 space-y-3.5">
          {/* 1-Line Capture Bar */}
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
                  ? 'Capture today’s friction (press Enter — triage deeper in Problem Log)...'
                  : 'Log a recurring bottleneck or constraint & press Enter...'
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
              <span>Log</span>
            </button>
          </div>

          {/* 1-Click "+1 Happened Again" Chips (Top Constraints first) */}
          {quickRecurCandidates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Recurring (+1):
              </span>
              {quickRecurCandidates.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleQuickRecur(p)}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-orange-500/15 border border-slate-800 hover:border-orange-500/35 text-[11px] text-slate-300 hover:text-orange-200 transition-colors"
                >
                  {p.isTopConstraint && <Crosshair className="w-3 h-3 text-rose-400 shrink-0" />}
                  <span className="truncate max-w-[200px]">{p.title}</span>
                  <span className="font-mono text-[10px] text-orange-400 font-extrabold">
                    ×{getClusterTotalHits(problems, p)} +1
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Active Experiments / Guardrails Verification Strip (Daily & Weekly Review) */}
          {activeFixesToAudit.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400 flex items-center space-x-1.5">
                <Shield className="w-3 h-3" />
                <span>Verify Active Fixes &amp; Guardrails ({activeFixesToAudit.length})</span>
              </span>
              <div className="space-y-1.5">
                {activeFixesToAudit.map(p => {
                  const ver = getFixVerificationProgress(p, todayDate, defaultVerifyDays);
                  return (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs p-2 rounded-lg bg-slate-950 border border-slate-800/80"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-200">{p.title}</span>
                        {p.fixNote?.trim() && (
                          <span className="text-[11px] text-slate-400 ml-2">→ {p.fixNote.trim()}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {ver.isTesting && (
                          <span className="font-mono text-[10px] text-sky-300">
                            {ver.daysClean}/{ver.targetDays}d
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleQuickRecur(p)}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-rose-500/20 text-rose-300 border border-slate-800 text-[10px] font-bold"
                        >
                          Broke (+1)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateProblem(p.id, { status: 'solved' })}
                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 text-[10px] font-bold"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Held</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Problems List */}
          {displayedProblems.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-900/50 border border-dashed border-slate-800 text-xs text-slate-500 text-center">
              No problems logged for this {sourceType} scope yet.
            </div>
          ) : (
            <div className="space-y-2">
              {displayedProblems.map(p => (
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
                />
              ))}
            </div>
          )}

          {isMacroReview && hiddenSlipCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllMacroSlips(v => !v)}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-200"
            >
              {showAllMacroSlips
                ? 'Hide small ungrouped slips ↑'
                : `+ Show ${hiddenSlipCount} small ungrouped slip${hiddenSlipCount === 1 ? '' : 's'} from this period`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
