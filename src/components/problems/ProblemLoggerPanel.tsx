import React, { useMemo, useState } from 'react';
import {
  ProblemCategory,
  ProblemEntry,
  ProblemSourceType
} from '../../types/schema';
import {
  CATEGORY_MAP,
  PROBLEM_CATEGORIES,
  countOccurrencesInRange,
  getLastOccurrenceDate,
  normalizeTag,
  problemHasTag,
  problemOccurredInRange,
  problemOccurredOnDate,
  tagsMatch
} from '../../lib/problems';
import { useStorage } from '../../context/StorageContext';
import { ProblemItemRow } from './ProblemItemRow';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
  Plus,
  Shield,
  Tag,
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
  onDraftCategoryChange,
  draftTags,
  onDraftTagsChange
}) => {
  const {
    problems,
    strategyPlans,
    addProblem,
    recordProblemRecurrence,
    updateProblem,
    setActiveTab,
    setReviewSubTab
  } = useStorage();

  const [internalText, setInternalText] = useState('');
  const [internalCategory, setInternalCategory] = useState<ProblemCategory>('mindset');
  const [internalTags, setInternalTags] = useState<string[]>(
    filterTag ? [normalizeTag(filterTag)] : []
  );
  const [customTagInput, setCustomTagInput] = useState('');
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAudit, setShowAudit] = useState(true);
  const [triageTagFilter, setTriageTagFilter] = useState<string>('all');
  const [triageStatusFilter, setTriageStatusFilter] = useState<'active' | 'open' | 'testing' | 'all'>('active');

  const textValue = draftText !== undefined ? draftText : internalText;
  const setTextValue = (val: string) => {
    if (onDraftTextChange) onDraftTextChange(val);
    else setInternalText(val);
  };

  const categoryValue = draftCategory !== undefined ? draftCategory : internalCategory;
  const setCategoryValue = (cat: ProblemCategory) => {
    if (onDraftCategoryChange) onDraftCategoryChange(cat);
    else setInternalCategory(cat);
  };

  const selectedTags = draftTags !== undefined ? draftTags : internalTags;
  const setSelectedTags = (next: string[]) => {
    if (onDraftTagsChange) onDraftTagsChange(next);
    else setInternalTags(next);
  };

  const roadmapTitles = useMemo(
    () => strategyPlans.map(p => p.title.trim()).filter(Boolean),
    [strategyPlans]
  );

  const recentCustomTags = useMemo(() => {
    const map = new Map<string, string>();
    problems.forEach(p => {
      (p.tags || []).forEach(t => {
        const clean = normalizeTag(t);
        if (!clean) return;
        const isPlan = roadmapTitles.some(rt => tagsMatch(rt, clean));
        if (!isPlan && !map.has(clean.toLowerCase())) {
          map.set(clean.toLowerCase(), clean);
        }
      });
    });
    return Array.from(map.values()).slice(0, 8);
  }, [problems, roadmapTitles]);

  const allAvailableTags = useMemo(() => {
    const map = new Map<string, string>();
    roadmapTitles.forEach(t => map.set(t.toLowerCase(), t));
    problems.forEach(p => {
      (p.tags || []).forEach(t => {
        const clean = normalizeTag(t);
        if (clean && !map.has(clean.toLowerCase())) {
          map.set(clean.toLowerCase(), clean);
        }
      });
    });
    return Array.from(map.values());
  }, [roadmapTitles, problems]);

  // Compute displayed problems based on mode
  const displayedProblems = useMemo<ProblemEntry[]>(() => {
    let list: ProblemEntry[] = [];

    if (mode === 'roadmap' && filterTag) {
      list = problems.filter(p => problemHasTag(p, filterTag));
    } else if (mode === 'weekly_triage') {
      list = problems.filter(p => {
        if (triageStatusFilter === 'active') return p.status !== 'solved';
        if (triageStatusFilter === 'open') return p.status === 'open';
        if (triageStatusFilter === 'testing') return p.status === 'testing';
        return true;
      });
      if (triageTagFilter !== 'all') {
        list = list.filter(p => problemHasTag(p, triageTagFilter));
      }
    } else if (filterSourceType) {
      list = problems.filter(p =>
        (p.occurrences || []).some(o => o.sourceType === filterSourceType)
      );
    } else if (dateRange) {
      list = problems.filter(p =>
        problemOccurredInRange(p, dateRange.startDate, dateRange.endDate)
      );
    } else {
      list = problems.filter(p => problemOccurredOnDate(p, date));
    }

    const statusWeight = (s: ProblemEntry['status']) =>
      s === 'open' ? 0 : s === 'testing' ? 1 : 2;

    return [...list].sort((a, b) => {
      const sw = statusWeight(a.status) - statusWeight(b.status);
      if (sw !== 0) return sw;
      const occDiff = (b.occurrences?.length || 1) - (a.occurrences?.length || 1);
      if (occDiff !== 0) return occDiff;
      return getLastOccurrenceDate(b).localeCompare(getLastOccurrenceDate(a));
    });
  }, [mode, filterTag, filterSourceType, problems, dateRange, date, triageStatusFilter, triageTagFilter]);

  // Open/Testing problems NOT yet logged in this period — for 1-click "+1 Happened Again"
  const quickRecurCandidates = useMemo(() => {
    if (mode === 'weekly_triage' || mode === 'roadmap') return [];
    const shownIds = new Set(displayedProblems.map(p => p.id));
    return problems
      .filter(p => p.status !== 'solved' && !shownIds.has(p.id))
      .sort((a, b) => (b.occurrences?.length || 1) - (a.occurrences?.length || 1))
      .slice(0, 6);
  }, [mode, problems, displayedProblems]);

  // Active fixes / rules from earlier periods to verify during Daily/Weekly reviews
  const activeFixesToAudit = useMemo(() => {
    if (!showAuditStrip) return [];
    const shownIds = new Set(displayedProblems.map(p => p.id));
    return problems
      .filter(
        p =>
          (p.status === 'testing' || (p.fixType === 'rule_guardrail' && p.status !== 'solved')) &&
          !shownIds.has(p.id)
      )
      .slice(0, 8);
  }, [showAuditStrip, problems, displayedProblems]);

  // Category breakdown for displayed problems
  const categoryCounts = useMemo(() => {
    const counts: Record<ProblemCategory, number> = {
      mindset: 0,
      skill: 0,
      logistics: 0,
      energy: 0,
      strategy: 0
    };
    displayedProblems.forEach(p => {
      if (counts[p.category] !== undefined) counts[p.category] += 1;
    });
    return counts;
  }, [displayedProblems]);

  const toggleTagSelection = (tag: string) => {
    const clean = normalizeTag(tag);
    if (!clean) return;
    const exists = selectedTags.some(t => tagsMatch(t, clean));
    if (exists) {
      // Keep locked roadmap tag in roadmap mode
      if (mode === 'roadmap' && filterTag && tagsMatch(clean, filterTag)) return;
      setSelectedTags(selectedTags.filter(t => !tagsMatch(t, clean)));
    } else {
      setSelectedTags([...selectedTags, clean]);
    }
  };

  const handleAddCustomTagChip = () => {
    const clean = normalizeTag(customTagInput);
    if (!clean) return;
    if (!selectedTags.some(t => tagsMatch(t, clean))) {
      setSelectedTags([...selectedTags, clean]);
    }
    setCustomTagInput('');
  };

  const handleLogProblem = () => {
    const trimmed = textValue.trim();
    if (!trimmed) return;

    const finalTags = [...selectedTags];
    if (filterTag && !finalTags.some(t => tagsMatch(t, filterTag))) {
      finalTags.unshift(normalizeTag(filterTag));
    }

    // If an identical open/testing problem already exists, bump recurrence instead of duplicating!
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
        category: categoryValue,
        tags: finalTags,
        sourceType,
        date,
        ...(sourceRef ? { sourceRef } : {})
      });
    }

    setTextValue('');
    if (!filterTag) {
      setSelectedTags([]);
    } else {
      setSelectedTags([normalizeTag(filterTag)]);
    }
  };

  const handleQuickRecur = (prob: ProblemEntry) => {
    recordProblemRecurrence(prob.id, {
      date,
      sourceType,
      ...(sourceRef ? { sourceRef } : {})
    });
  };

  const openCount = problems.filter(p => p.status === 'open').length;
  const testingCount = problems.filter(p => p.status === 'testing').length;
  const activeRoadmapCount = displayedProblems.filter(p => p.status !== 'solved').length;

  // Compact inline mode (GWS Studio & Create Review modal)
  if (mode === 'compact') {
    return (
      <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-orange-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{title || '2. What held me back? (Problem Log)'}</span>
          </div>
          {displayedProblems.length > 0 && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30">
              {displayedProblems.length} logged
            </span>
          )}
        </div>

        {/* 1-line Quick Capture */}
        <div className="space-y-2">
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
              placeholder="Type blocker & press Enter (or click + Log)..."
              className="flex-1 bg-slate-900 border border-slate-800 focus:border-orange-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleLogProblem}
              disabled={!textValue.trim()}
              className="px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs transition-all shrink-0"
            >
              + Log
            </button>
          </div>

          {/* 5 Category Pills */}
          <div className="flex flex-wrap items-center gap-1">
            {PROBLEM_CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryValue(c.id)}
                title={c.hint}
                className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all ${
                  categoryValue === c.id
                    ? c.activeChipClass
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {c.shortLabel}
              </button>
            ))}
          </div>

          {/* Plan / Tag Chips */}
          {(roadmapTitles.length > 0 || recentCustomTags.length > 0 || selectedTags.length > 0) && (
            <div className="flex flex-wrap items-center gap-1">
              <Tag className="w-3 h-3 text-slate-500 shrink-0" />
              {roadmapTitles.map(rt => {
                const active = selectedTags.some(t => tagsMatch(t, rt));
                return (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => toggleTagSelection(rt)}
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[10px] font-bold transition-all ${
                      active
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                        : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    <MapIcon className="w-2.5 h-2.5" />
                    <span>{rt}</span>
                  </button>
                );
              })}
              {recentCustomTags.slice(0, 4).map(rt => {
                const active = selectedTags.some(t => tagsMatch(t, rt));
                return (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => toggleTagSelection(rt)}
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-bold transition-all ${
                      active
                        ? 'bg-slate-700 text-slate-100 border-slate-500'
                        : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    #{rt}
                  </button>
                );
              })}
              <input
                type="text"
                value={customTagInput}
                onChange={e => setCustomTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddCustomTagChip();
                  }
                }}
                placeholder="+ tag"
                className="bg-slate-900 border border-slate-800 focus:border-amber-500/50 rounded-full px-2 py-0.5 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none w-16"
              />
            </div>
          )}
        </div>

        {/* +1 Happened Again quick strip */}
        {quickRecurCandidates.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/70">
            <span className="text-[10px] font-bold text-slate-500">Happened again?</span>
            {quickRecurCandidates.slice(0, 4).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleQuickRecur(p)}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-orange-500/15 border border-slate-800 hover:border-orange-500/40 text-[10px] text-slate-300 hover:text-orange-300 transition-colors max-w-[200px]"
                title={`Tap to log +1 occurrence of "${p.title}"`}
              >
                <span className="font-mono font-extrabold text-orange-400 shrink-0">+1</span>
                <span className="truncate">{p.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Logged problems for this date */}
        {displayedProblems.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {displayedProblems.map(prob => (
              <ProblemItemRow
                key={prob.id}
                problem={prob}
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

  // Roadmap slim collapsible strip OR Weekly Planning Triage panel OR Full Review panel
  const isCollapsible = mode === 'roadmap' || mode === 'weekly_triage';

  return (
    <div
      className={`rounded-3xl border shadow-xl overflow-hidden ${
        mode === 'roadmap'
          ? 'bg-slate-900/70 border-slate-800'
          : 'bg-slate-900/90 border-slate-800'
      }`}
    >
      {/* Header */}
      <div
        className={`${
          mode === 'roadmap' ? 'px-5 py-3.5' : 'px-6 py-4 sm:px-7 sm:py-5'
        } flex flex-wrap items-center justify-between gap-3 ${
          !collapsed ? 'border-b border-slate-800/80' : ''
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/25 shrink-0">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-orange-400">
                {title ||
                  (mode === 'weekly_triage'
                    ? 'Open Problems & Active Fixes (Weekly Triage)'
                    : mode === 'roadmap'
                    ? `Plan Blockers (#${filterTag})`
                    : 'Problems Encountered & Bottlenecks')}
              </h3>

              {mode === 'weekly_triage' ? (
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 font-mono text-[10px] font-bold">
                    {openCount} Open
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono text-[10px] font-bold">
                    {testingCount} Testing
                  </span>
                </div>
              ) : mode === 'roadmap' ? (
                <span className="px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 font-mono text-[10px] font-bold">
                  {activeRoadmapCount} active · {displayedProblems.length} total
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[10px] font-bold">
                  {displayedProblems.length} in period
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {mode !== 'review' && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('review');
                setReviewSubTab('problems');
              }}
              className="px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 text-[11px] font-bold transition-colors"
            >
              All Problems →
            </button>
          )}
          {isCollapsible && (
            <button
              type="button"
              onClick={() => setCollapsed(prev => !prev)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold transition-colors"
            >
              <span>{collapsed ? 'Show' : 'Hide'}</span>
              {collapsed ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className={`${mode === 'roadmap' ? 'p-4 sm:p-5' : 'p-5 sm:p-6'} space-y-4`}>
          {/* Category Summary Pills when problems exist */}
          {displayedProblems.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {PROBLEM_CATEGORIES.map(c => {
                const count = categoryCounts[c.id];
                if (count === 0) return null;
                return (
                  <span
                    key={c.id}
                    className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${c.badgeClass}`}
                  >
                    <span>{c.shortLabel}</span>
                    <span className="font-mono font-extrabold">{count}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Weekly Triage Filters */}
          {mode === 'weekly_triage' && (
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(
                  [
                    { id: 'active', label: 'Open + Testing' },
                    { id: 'open', label: `Open (${openCount})` },
                    { id: 'testing', label: `Testing (${testingCount})` },
                    { id: 'all', label: 'All' }
                  ] as const
                ).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTriageStatusFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      triageStatusFilter === tab.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {allAvailableTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setTriageTagFilter('all')}
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                      triageTagFilter === 'all'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    All Plans/Tags
                  </button>
                  {allAvailableTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTriageTagFilter(tag)}
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                        tagsMatch(triageTagFilter, tag)
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3-Second Quick Log Strip */}
          {mode !== 'weekly_triage' && (
            <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-3.5 space-y-2.5">
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
                    mode === 'roadmap' && filterTag
                      ? `Log a blocker for ${filterTag} (Enter to log)...`
                      : 'Log a problem or bottleneck (1 crisp line, Enter to log)...'
                  }
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-orange-500/50 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleLogProblem}
                  disabled={!textValue.trim()}
                  className="flex items-center space-x-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs transition-all shrink-0 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log</span>
                </button>
              </div>

              {/* Category Picker */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-0.5">
                  Category:
                </span>
                {PROBLEM_CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryValue(c.id)}
                    title={c.hint}
                    className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all ${
                      categoryValue === c.id
                        ? c.activeChipClass
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Plan / Tag Picker */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-0.5">
                  <Tag className="w-3 h-3" />
                  <span>Plan / Tags:</span>
                </span>

                {roadmapTitles.map(rt => {
                  const active = selectedTags.some(t => tagsMatch(t, rt));
                  return (
                    <button
                      key={rt}
                      type="button"
                      onClick={() => toggleTagSelection(rt)}
                      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold transition-all ${
                        active
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <MapIcon className="w-3 h-3" />
                      <span>{rt}</span>
                    </button>
                  );
                })}

                {recentCustomTags.map(rt => {
                  const active = selectedTags.some(t => tagsMatch(t, rt));
                  return (
                    <button
                      key={rt}
                      type="button"
                      onClick={() => toggleTagSelection(rt)}
                      className={`px-2 py-0.5 rounded-full border text-[11px] font-bold transition-all ${
                        active
                          ? 'bg-slate-700 text-slate-100 border-slate-500'
                          : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      #{rt}
                    </button>
                  );
                })}

                {/* Newly typed custom tags not yet in recentCustomTags */}
                {selectedTags
                  .filter(
                    t =>
                      !roadmapTitles.some(rt => tagsMatch(rt, t)) &&
                      !recentCustomTags.some(rt => tagsMatch(rt, t))
                  )
                  .map(t => (
                    <span
                      key={t}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-100 border border-slate-600 text-[11px] font-bold"
                    >
                      <span>#{t}</span>
                      <button
                        type="button"
                        onClick={() => toggleTagSelection(t)}
                        className="text-slate-400 hover:text-rose-400"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}

                <div className="inline-flex items-center bg-slate-900 border border-slate-800 focus-within:border-amber-500/50 rounded-full px-2.5 py-0.5">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={e => setCustomTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAddCustomTagChip();
                      }
                    }}
                    placeholder="+ tag (Enter)"
                    className="bg-transparent text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none w-24"
                  />
                  {customTagInput.trim() && (
                    <button
                      type="button"
                      onClick={handleAddCustomTagChip}
                      className="text-amber-400 hover:text-amber-300 ml-1"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* +1 Happened Again Quick Recurrence Strip */}
              {quickRecurCandidates.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-slate-800/70">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Happened again?
                  </span>
                  {quickRecurCandidates.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleQuickRecur(p)}
                      title={`Log +1 occurrence for "${p.title}" (${CATEGORY_MAP[p.category]?.shortLabel})`}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-orange-500/15 border border-slate-800 hover:border-orange-500/40 text-[11px] text-slate-300 hover:text-orange-300 transition-colors max-w-[260px]"
                    >
                      <span className="font-mono font-extrabold text-orange-400 shrink-0">+1</span>
                      <span className="truncate">{p.title}</span>
                      {(p.occurrences?.length || 1) > 1 && (
                        <span className="font-mono text-[10px] text-slate-500 shrink-0">
                          ×{p.occurrences.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Problems List */}
          {displayedProblems.length === 0 ? (
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
              {mode === 'weekly_triage'
                ? 'No open or testing problems right now — clean execution slate.'
                : mode === 'roadmap'
                ? `No problems tagged #${filterTag} yet. Tag any review problem with "${filterTag}" to surface it here.`
                : 'No problems logged for this period yet. Log one above or tap +1 if an earlier problem recurred.'}
            </div>
          ) : (
            <div className="space-y-2.5">
              {displayedProblems.map(prob => (
                <ProblemItemRow
                  key={prob.id}
                  problem={prob}
                  contextDate={date}
                  contextSourceType={sourceType}
                  contextSourceRef={sourceRef}
                  targetWeekId={targetWeekId}
                  periodOccurrenceCount={
                    dateRange
                      ? countOccurrencesInRange(prob, dateRange.startDate, dateRange.endDate)
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {/* Active Fixes & Rules Audit Strip (Closes the Feedback Loop during Reviews!) */}
          {activeFixesToAudit.length > 0 && (
            <div className="rounded-2xl bg-sky-500/5 border border-sky-500/25 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2 text-[11px] font-extrabold uppercase tracking-wider text-sky-300">
                  <Shield className="w-3.5 h-3.5" />
                  <span>
                    Active Fixes & Rules to Verify ({activeFixesToAudit.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAudit(prev => !prev)}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-200"
                >
                  {showAudit ? 'Hide' : 'Show'}
                </button>
              </div>
              {showAudit && (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-400">
                    Did these fixes hold? Confirm <strong className="text-emerald-300">Solved</strong> if the problem stopped recurring, or tap <strong className="text-orange-300">+1</strong> if it slipped again.
                  </p>
                  {activeFixesToAudit.map(prob => (
                    <div
                      key={prob.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-950/90 border border-slate-800"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${
                              CATEGORY_MAP[prob.category]?.badgeClass
                            }`}
                          >
                            {CATEGORY_MAP[prob.category]?.shortLabel}
                          </span>
                          <span className="text-xs font-semibold text-slate-200 truncate">
                            {prob.title}
                          </span>
                        </div>
                        {prob.fixNote?.trim() && (
                          <p className="text-[11px] text-sky-300/90">
                            Fix: {prob.fixNote.trim()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQuickRecur(prob)}
                          className="px-2.5 py-1 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 border border-orange-500/35 text-[10px] font-extrabold"
                        >
                          +1 Slipped
                        </button>
                        <button
                          type="button"
                          onClick={() => updateProblem(prob.id, { status: 'solved' })}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 text-[10px] font-extrabold"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Solved</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
