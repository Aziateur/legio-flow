import React, { useMemo, useState } from 'react';
import {
  CustomProblemCategory,
  ProblemCategory,
  ProblemColorKey,
  ProblemEntry,
  ProblemSeverity
} from '../../types/schema';
import { INITIAL_PROBLEM_CATEGORIES } from '../../types/defaults';
import {
  PROBLEM_COLOR_STYLES,
  PROBLEM_SEVERITIES,
  SEVERITY_META,
  clusterHasTag,
  computeProblemPriorityScore,
  getClusterTotalHits,
  getFixVerificationProgress,
  getLastOccurrenceDate,
  getProblemSeverity,
  hasExistingParent,
  isProblemGuardrail,
  isRootProblem,
  normalizeTag,
  resolveCategoryMeta,
  severityToImpact,
  tagsMatch
} from '../../lib/problems';
import { useStorage } from '../../context/StorageContext';
import { getLevelCapabilities } from '../../lib/levelFeatures';
import { ProblemItemRow } from './ProblemItemRow';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  Crosshair,
  Filter,
  Inbox,
  Map as MapIcon,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sliders,
  Trash2,
  X
} from 'lucide-react';

type MainTabMode = 'constraints' | 'inbox' | 'solved';
type SubStatusFilter = 'all' | 'open' | 'testing' | 'guardrails';
type LedgerSort = 'priority' | 'frequency' | 'recent';

const COLOR_KEYS: ProblemColorKey[] = [
  'rose',
  'sky',
  'amber',
  'emerald',
  'violet',
  'cyan',
  'orange',
  'slate'
];

export const ProblemsLedgerView: React.FC = () => {
  const {
    systemLevel,
    setSystemLevel,
    todayDate,
    problems,
    problemCategories,
    saveProblemCategories,
    problemSettings,
    saveProblemSettings,
    strategyPlans,
    selectedDate,
    selectedWeekId,
    addProblem,
    recordProblemRecurrence,
    updateProblem,
    deleteProblem
  } = useStorage();

  const caps = getLevelCapabilities(systemLevel);

  const maxTop = problemSettings.maxTopConstraints || 3;
  const defaultVerifyDays = problemSettings.defaultVerifyDays || 14;
  const separateInbox = problemSettings.separateInboxTab !== false;
  const showBreakdownBar = problemSettings.showBreakdownBar !== false;

  const [activeTab, setActiveTab] = useState<MainTabMode>('constraints');
  const [subStatus, setSubStatus] = useState<SubStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<LedgerSort>('priority');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);

  // Clean 1-line quick capture
  const [quickTitle, setQuickTitle] = useState('');
  const [quickKind, setQuickKind] = useState<'constraint' | 'slip'>('constraint');
  const [quickSeverity, setQuickSeverity] = useState<ProblemSeverity>(3);
  const [quickCategory, setQuickCategory] = useState<ProblemCategory>(
    problemCategories[0]?.id || 'mindset'
  );
  const [composerExpanded, setComposerExpanded] = useState(false);

  // Customize Categories form
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatHint, setNewCatHint] = useState('');
  const [newCatColor, setNewCatColor] = useState<ProblemColorKey>('cyan');

  const roadmapTitles = useMemo(
    () => strategyPlans.map(p => p.title.trim()).filter(Boolean),
    [strategyPlans]
  );

  const allTags = useMemo(() => {
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

  const topLevelProblems = useMemo(
    () => problems.filter(p => !hasExistingParent(problems, p)),
    [problems]
  );

  // Top Constraints Spotlight (pinned active constraints, up to maxTop)
  const topConstraints = useMemo(
    () =>
      topLevelProblems
        .filter(p => p.isTopConstraint && p.status !== 'solved')
        .sort((a, b) => computeProblemPriorityScore(problems, b) - computeProblemPriorityScore(problems, a)),
    [topLevelProblems, problems]
  );

  // Unpinned active root problems available to pin directly from an empty Top 3 slot
  const pinnableCandidates = useMemo(
    () =>
      topLevelProblems
        .filter(p => !p.isTopConstraint && p.status !== 'solved')
        .sort((a, b) => computeProblemPriorityScore(problems, b) - computeProblemPriorityScore(problems, a)),
    [topLevelProblems, problems]
  );

  // Partition into 3 clean buckets: Active Constraints | Inbox Slips | Solved
  const buckets = useMemo(() => {
    const constraints: ProblemEntry[] = [];
    const inbox: ProblemEntry[] = [];
    const solved: ProblemEntry[] = [];

    topLevelProblems.forEach(p => {
      if (p.status === 'solved') {
        solved.push(p);
      } else if (separateInbox && !isRootProblem(problems, p)) {
        inbox.push(p);
      } else {
        constraints.push(p);
      }
    });

    return { constraints, inbox, solved };
  }, [topLevelProblems, problems, separateInbox]);

  // Root-cause breakdown weighted by recurrence across active problems
  const breakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    problems
      .filter(p => p.status !== 'solved')
      .forEach(p => {
        const w = Math.max(1, p.occurrences?.length || 1);
        counts[p.category] = (counts[p.category] || 0) + w;
        total += w;
      });
    return { counts, total };
  }, [problems]);

  // Ready-to-verify & failed-fix counters
  const alertCounts = useMemo(() => {
    let failed = 0;
    let ready = 0;
    buckets.constraints.forEach(p => {
      if (p.lastFixFailedAt && p.status === 'open') failed++;
      const v = getFixVerificationProgress(p, todayDate, defaultVerifyDays);
      if (v.readyToVerify) ready++;
    });
    return { failed, ready };
  }, [buckets.constraints, todayDate, defaultVerifyDays]);

  const effectiveTab: MainTabMode =
    !separateInbox && activeTab === 'inbox' ? 'constraints' : activeTab;

  const displayedList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const pool =
      q.length > 0
        ? problems.filter(p => (effectiveTab === 'solved' ? p.status === 'solved' : p.status !== 'solved'))
        : effectiveTab === 'constraints'
        ? buckets.constraints
        : effectiveTab === 'inbox'
        ? buckets.inbox
        : buckets.solved;

    const list = pool.filter(p => {
      if (effectiveTab === 'constraints') {
        if (subStatus === 'open' && p.status !== 'open') return false;
        if (subStatus === 'testing' && p.status !== 'testing') return false;
        if (subStatus === 'guardrails' && !isProblemGuardrail(p)) return false;
      }
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (severityFilter !== 'all') {
        const sev = getProblemSeverity(p);
        if (severityFilter === '4+' && sev < 4) return false;
        if (severityFilter === '5' && sev !== 5) return false;
        if (severityFilter === '3' && sev !== 3) return false;
        if (severityFilter === '1-2' && sev > 2) return false;
      }
      if (tagFilter !== 'all' && !clusterHasTag(problems, p, tagFilter)) return false;
      if (q) {
        const hitTitle = p.title.toLowerCase().includes(q);
        const hitFix = (p.fixNote || '').toLowerCase().includes(q);
        const hitCause = (p.rootCause || '').toLowerCase().includes(q);
        const hitTrigger = (p.trigger || '').toLowerCase().includes(q);
        const hitTag = (p.tags || []).some(t => t.toLowerCase().includes(q));
        if (!hitTitle && !hitFix && !hitCause && !hitTrigger && !hitTag) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'frequency') {
        const diff = getClusterTotalHits(problems, b) - getClusterTotalHits(problems, a);
        if (diff !== 0) return diff;
        return getLastOccurrenceDate(b).localeCompare(getLastOccurrenceDate(a));
      }
      if (sortBy === 'recent') {
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      }
      const pDiff = computeProblemPriorityScore(problems, b) - computeProblemPriorityScore(problems, a);
      if (pDiff !== 0) return pDiff;
      return getLastOccurrenceDate(b).localeCompare(getLastOccurrenceDate(a));
    });
  }, [
    problems,
    buckets,
    effectiveTab,
    subStatus,
    categoryFilter,
    severityFilter,
    tagFilter,
    searchQuery,
    sortBy
  ]);

  const handleQuickLog = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    const existing = problems.find(
      p => p.title.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      recordProblemRecurrence(existing.id, {
        date: selectedDate,
        sourceType: quickKind === 'constraint' ? 'weekly' : 'daily',
        sourceRef: selectedDate
      });
    } else {
      const sev: ProblemSeverity = quickSeverity;
      addProblem({
        title: trimmed,
        category: quickCategory || problemCategories[0]?.id || 'mindset',
        scale:
          quickKind === 'slip' && sev < 4
            ? 'friction'
            : sev >= 5
            ? 'blocker'
            : 'bottleneck',
        severity: sev,
        impact: severityToImpact(sev),
        sourceType: quickKind === 'constraint' ? 'weekly' : 'daily',
        date: selectedDate,
        sourceRef: selectedDate
      });
    }
    setQuickTitle('');
    setComposerExpanded(false);
  };

  // Custom Category CRUD
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newCatLabel.trim();
    if (!label) return;
    const id = `cat_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36).slice(-3)}`;
    const next: CustomProblemCategory = {
      id,
      label,
      hint: newCatHint.trim(),
      color: newCatColor
    };
    saveProblemCategories([...problemCategories, next]);
    setNewCatLabel('');
    setNewCatHint('');
  };

  const handleMoveCategory = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= problemCategories.length) return;
    const next = [...problemCategories];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    saveProblemCategories(next);
  };

  const activeFilterCount =
    (categoryFilter !== 'all' ? 1 : 0) +
    (severityFilter !== 'all' ? 1 : 0) +
    (tagFilter !== 'all' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  // ================================================================
  // LVL 2 LITE MODE: Simple Friction Inbox (Zero Overwhelm)
  // ================================================================
  if (!caps.problemsConstraintEngine) {
    const activeLite = topLevelProblems
      .filter(p => p.status !== 'solved')
      .sort((a, b) => getLastOccurrenceDate(b).localeCompare(getLastOccurrenceDate(a)));
    const solvedLite = topLevelProblems
      .filter(p => p.status === 'solved')
      .sort((a, b) => getLastOccurrenceDate(b).localeCompare(getLastOccurrenceDate(a)));
    const showSolvedLite = activeTab === 'solved';
    const liteList = showSolvedLite ? solvedLite : activeLite;

    const handleLiteCapture = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = quickTitle.trim();
      if (!trimmed) return;
      const existing = problems.find(p => p.title.trim().toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        recordProblemRecurrence(existing.id, { date: selectedDate, sourceType: 'daily' });
      } else {
        addProblem({
          title: trimmed,
          category: problemCategories[0]?.id || 'mindset',
          scale: 'friction',
          severity: 2,
          impact: severityToImpact(2),
          tags: [],
          sourceType: 'daily',
          date: selectedDate
        });
      }
      setQuickTitle('');
    };

    return (
      <div className="w-full max-w-[960px] mx-auto space-y-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-400 flex items-center space-x-1.5">
                <Inbox className="w-3.5 h-3.5" />
                <span>Friction Inbox · LVL 2 Lite</span>
              </span>
              <h2 className="text-lg font-extrabold text-slate-100 mt-0.5">
                Notice What Trips You Up
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Capture daily &amp; GWS sprint frictions in one flat list. Tap +1 when something repeats, or check it off when resolved.
              </p>
            </div>

            <div className="inline-flex rounded-xl bg-slate-950 border border-slate-800 p-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('constraints')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  !showSolvedLite
                    ? 'bg-orange-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Active ({activeLite.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('solved')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  showSolvedLite
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Solved ({solvedLite.length})
              </button>
            </div>
          </div>

          <form onSubmit={handleLiteCapture} className="flex items-center gap-2">
            <input
              type="text"
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              placeholder="Capture a friction or distraction & press Enter..."
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-orange-500/50 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!quickTitle.trim()}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Log</span>
            </button>
          </form>

          {liteList.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
              {showSolvedLite
                ? 'No resolved frictions yet.'
                : 'Inbox clean! Any mid-sprint GWS slips or daily frictions will show up here.'}
            </div>
          ) : (
            <div className="space-y-2">
              {liteList.map(p => {
                const isSolved = p.status === 'solved';
                const hits = getClusterTotalHits(problems, p);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition-colors ${
                      isSolved
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-500'
                        : 'bg-slate-950 border-slate-800 text-slate-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => updateProblem(p.id, { status: isSolved ? 'open' : 'solved' })}
                      className="flex items-center space-x-3 min-w-0 flex-1 text-left"
                    >
                      {isSolved ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-500 hover:text-emerald-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold truncate ${isSolved ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                          {p.title}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          Last hit: {getLastOccurrenceDate(p)}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          recordProblemRecurrence(p.id, { date: selectedDate, sourceType: 'daily' })
                        }
                        className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-orange-500/15 border border-slate-800 hover:border-orange-500/35 font-mono text-xs font-bold text-orange-300"
                        title="Happened again (+1)"
                      >
                        ×{hits} +1
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProblem(p.id)}
                        className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>
              Ready for Top 3 Root Constraints, S1–S5 severity grading, clustering &amp; fix experiments?
            </span>
            <button
              type="button"
              onClick={() => setSystemLevel(3)}
              className="px-3 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 font-bold transition-colors"
            >
              Upgrade to LVL 3 →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1280px] mx-auto space-y-6">
      {/* ================================================================ */}
      {/* 1. TOP 3 CONSTRAINTS SPOTLIGHT (Mirrors Top 3 Focuses in Plans)  */}
      {/* ================================================================ */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 flex items-center space-x-1.5">
              <Crosshair className="w-3.5 h-3.5" />
              <span>Theory of Constraints · Active Attack Focus</span>
            </span>
            <h2 className="text-lg font-extrabold text-slate-100 mt-0.5">
              Top {maxTop} Constraints ({topConstraints.length}/{maxTop})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            {alertCounts.failed > 0 && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/35">
                <AlertTriangle className="w-3 h-3" />
                <span>{alertCounts.failed} fix failed</span>
              </span>
            )}
            {alertCounts.ready > 0 && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
                <CheckCircle2 className="w-3 h-3" />
                <span>{alertCounts.ready} ready to verify solved</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {Array.from({ length: maxTop }).map((_, slotIdx) => {
            const prob = topConstraints[slotIdx];
            if (!prob) {
              return (
                <div
                  key={`slot_${slotIdx}`}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 flex flex-col justify-between space-y-3 min-h-[132px]"
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-mono text-xs font-extrabold text-slate-500">
                      #{slotIdx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Open Constraint Slot
                    </span>
                  </div>

                  {pinnableCandidates.length > 0 ? (
                    <select
                      value=""
                      onChange={e => {
                        if (e.target.value) {
                          updateProblem(e.target.value, {
                            isTopConstraint: true,
                            scale: 'bottleneck'
                          });
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-800 hover:border-rose-500/40 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                    >
                      <option value="">+ Pin a constraint here...</option>
                      {pinnableCandidates.map(c => (
                        <option key={c.id} value={c.id}>
                          [{SEVERITY_META[getProblemSeverity(c)].code}] {c.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[11px] text-slate-600">
                      Log a constraint below and click the crosshair icon to pin it here.
                    </p>
                  )}
                </div>
              );
            }

            const sev = SEVERITY_META[getProblemSeverity(prob)];
            const cat = resolveCategoryMeta(prob.category, problemCategories);
            const hits = getClusterTotalHits(problems, prob);
            const ver = getFixVerificationProgress(prob, todayDate, defaultVerifyDays);
            const failed = Boolean(prob.lastFixFailedAt && prob.status === 'open');

            return (
              <div
                key={prob.id}
                className={`p-4 rounded-2xl bg-slate-950 border flex flex-col justify-between space-y-3 ${
                  failed
                    ? 'border-rose-500/45'
                    : ver.readyToVerify
                    ? 'border-emerald-500/45'
                    : 'border-slate-800'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/35 flex items-center justify-center font-mono text-xs font-extrabold shrink-0">
                        #{slotIdx + 1}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded border font-mono text-[10px] font-extrabold ${sev.badgeClass}`}
                        title={`Severity ${sev.label}: ${sev.hint}`}
                      >
                        {sev.code}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">{cat.shortLabel}</span>
                      {hits > 1 && (
                        <span className="font-mono text-[10px] font-bold text-orange-300">×{hits}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => updateProblem(prob.id, { isTopConstraint: false })}
                      className="p-1 text-slate-600 hover:text-slate-300"
                      title="Unpin from Top Constraints"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm font-bold text-slate-100 leading-snug">
                    {prob.title}
                  </p>

                  {prob.fixNote?.trim() ? (
                    <p className="text-[11px] text-slate-300 leading-snug">
                      {prob.trigger?.trim() && (
                        <span className="text-slate-400">
                          <strong className="text-amber-400">IF</strong> {prob.trigger.trim()}{' '}
                          <strong className="text-emerald-400">→</strong>{' '}
                        </span>
                      )}
                      {prob.fixNote.trim()}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">
                      No countermeasure set yet — open below to diagnose &amp; install fix.
                    </p>
                  )}
                </div>

                {/* Experiment Status Bar + Quick Verify / +1 */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  {failed && (
                    <div className="text-[10px] font-bold text-rose-300 flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>Fix failed on {prob.lastFixFailedAt} — needs stronger fix</span>
                    </div>
                  )}

                  {ver.isTesting && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className={ver.readyToVerify ? 'text-emerald-300 font-bold' : 'text-sky-300'}>
                          {ver.readyToVerify ? '✓ Ready to verify solved' : `Testing · ${ver.daysClean}/${ver.targetDays}d clean`}
                        </span>
                        <span className="text-slate-500">{ver.pct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${ver.readyToVerify ? 'bg-emerald-400' : 'bg-sky-400'}`}
                          style={{ width: `${ver.pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        recordProblemRecurrence(prob.id, {
                          date: selectedDate,
                          sourceType: 'daily',
                          sourceRef: selectedDate
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-orange-500/15 text-orange-300 border border-slate-800 hover:border-orange-500/40 text-[10px] font-extrabold transition-colors"
                    >
                      +1 Fired
                    </button>

                    <button
                      type="button"
                      onClick={() => updateProblem(prob.id, { status: 'solved' })}
                      className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
                        ver.readyToVerify
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-900 hover:bg-emerald-500/15 text-emerald-300 border-slate-800 hover:border-emerald-500/35'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Verify Solved</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================================================================ */}
      {/* 2. CLEAN WORKSPACE: 1-LINE CAPTURE + 3 TABS + OPTIONAL DRAWERS   */}
      {/* ================================================================ */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
        {/* Clean 1-Line Quick Capture */}
        <form onSubmit={handleQuickLog} className="space-y-2.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={quickTitle}
              onFocus={() => setComposerExpanded(true)}
              onChange={e => setQuickTitle(e.target.value)}
              placeholder="Capture a constraint or quick slip (press Enter)..."
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!quickTitle.trim()}
              className="inline-flex items-center space-x-1 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Log</span>
            </button>
          </div>

          {(composerExpanded || quickTitle.trim().length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setQuickKind('constraint')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      quickKind === 'constraint'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Root Constraint
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickKind('slip')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      quickKind === 'slip'
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Quick Slip (Inbox)
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-0.5">
                    Severity:
                  </span>
                  {PROBLEM_SEVERITIES.map(sv => (
                    <button
                      key={sv.grade}
                      type="button"
                      onClick={() => setQuickSeverity(sv.grade)}
                      title={`${sv.label}: ${sv.hint}`}
                      className={`px-2 py-0.5 rounded-lg border font-mono text-[10px] font-extrabold transition-all ${
                        quickSeverity === sv.grade
                          ? sv.activeChipClass
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {sv.code}
                    </button>
                  ))}
                </div>

                <select
                  value={quickCategory}
                  onChange={e => setQuickCategory(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-300 focus:outline-none"
                >
                  {problemCategories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {!quickTitle.trim() && (
                <button
                  type="button"
                  onClick={() => setComposerExpanded(false)}
                  className="text-slate-500 hover:text-slate-300 font-bold"
                >
                  Hide options
                </button>
              )}
            </div>
          )}
        </form>

        {/* SINGLE CLEAN TAB BAR + FILTERS & CUSTOMIZE TOGGLES */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('constraints')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  effectiveTab === 'constraints'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Active Constraints ({buckets.constraints.length})
              </button>

              {separateInbox && (
                <button
                  type="button"
                  onClick={() => setActiveTab('inbox')}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    effectiveTab === 'inbox'
                      ? 'bg-slate-200 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Inbox className="w-3.5 h-3.5" />
                  <span>Inbox / Slips ({buckets.inbox.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('solved')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  effectiveTab === 'solved'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Solved ({buckets.solved.length})
              </button>
            </div>

            {effectiveTab === 'constraints' && (
              <div className="flex items-center gap-1 text-[11px]">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'open', label: 'Needs Fix' },
                    { id: 'testing', label: 'Testing' },
                    { id: 'guardrails', label: 'Guardrails' }
                  ] as const
                ).map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSubStatus(st.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                      subStatus === st.id
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                showFilters || activeFilterCount > 0
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCustomize(v => !v)}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                showCustomize
                  ? 'bg-slate-100 text-slate-950 border-slate-100'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Customize</span>
            </button>
          </div>
        </div>

        {/* SLIM ROOT-CAUSE BREAKDOWN BAR (Optional, clickable to filter) */}
        {showBreakdownBar && breakdown.total > 0 && (
          <div className="space-y-2">
            <div className="h-2 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex">
              {problemCategories.map(c => {
                const count = breakdown.counts[c.id] || 0;
                if (count === 0) return null;
                const pct = (count / breakdown.total) * 100;
                const style = PROBLEM_COLOR_STYLES[c.color] || PROBLEM_COLOR_STYLES.slate;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryFilter(prev => (prev === c.id ? 'all' : c.id))}
                    style={{ width: `${pct}%` }}
                    className={`${style.barClass} h-full transition-opacity ${
                      categoryFilter !== 'all' && categoryFilter !== c.id ? 'opacity-25' : 'opacity-90'
                    }`}
                    title={`${c.label}: ${Math.round(pct)}% (${count} hits)`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {problemCategories.map(c => {
                const count = breakdown.counts[c.id] || 0;
                if (count === 0) return null;
                const pct = Math.round((count / breakdown.total) * 100);
                const meta = resolveCategoryMeta(c.id, problemCategories);
                const active = categoryFilter === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryFilter(prev => (prev === c.id ? 'all' : c.id))}
                    className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-lg border font-bold transition-all ${
                      active
                        ? meta.activeChipClass
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-slate-950' : meta.dotClass}`} />
                    <span>{c.label}</span>
                    <span className="font-mono opacity-80">{pct}%</span>
                  </button>
                );
              })}
              {categoryFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className="text-amber-400 hover:text-amber-300 font-bold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* COLLAPSIBLE FILTERS BAR */}
        {showFilters && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search titles, root causes, triggers, fixes, tags..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500/40 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              </div>

              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 focus:outline-none"
              >
                <option value="all">Severity: All (S1–S5)</option>
                <option value="4+">Severe &amp; Critical (S4–S5)</option>
                <option value="5">Critical Only (S5)</option>
                <option value="3">Moderate (S3)</option>
                <option value="1-2">Minor &amp; Low (S1–S2)</option>
              </select>

              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as LedgerSort)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 focus:outline-none"
              >
                <option value="priority">Sort: Severity &amp; Priority</option>
                <option value="frequency">Sort: Most Frequent (×N)</option>
                <option value="recent">Sort: Most Recent</option>
              </select>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter('all');
                    setSeverityFilter('all');
                    setTagFilter('all');
                    setSearchQuery('');
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold"
                >
                  Reset
                </button>
              )}
            </div>

            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                  Roadmap / Tag:
                </span>
                <button
                  type="button"
                  onClick={() => setTagFilter('all')}
                  className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${
                    tagFilter === 'all'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  All
                </button>
                {allTags.map(t => {
                  const isPlan = roadmapTitles.some(rt => tagsMatch(rt, t));
                  const active = tagsMatch(tagFilter, t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTagFilter(active ? 'all' : t)}
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${
                        active
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {isPlan ? <MapIcon className="w-2.5 h-2.5" /> : <span>#</span>}
                      <span>{t}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* COLLAPSIBLE CUSTOMIZE PANEL (Custom Categories + Settings — Cloud Synced!) */}
        {showCustomize && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-700 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="font-extrabold text-sm text-slate-100">Customize Problem Log</div>
                <p className="text-[11px] text-slate-400">
                  Tailor your categories, Top Constraints limit, verification window, and pre-flight guardrail strips.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomize(false)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
              >
                Done
              </button>
            </div>

            {/* Behavior & View Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-300">Max Top Constraints</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => saveProblemSettings({ ...problemSettings, maxTopConstraints: n })}
                        className={`w-7 py-1 rounded-lg font-mono font-bold border ${
                          maxTop === n
                            ? 'bg-rose-500 text-slate-950 border-rose-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-300">Default Verification Window</span>
                  <div className="flex items-center gap-1">
                    {[7, 14, 30].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => saveProblemSettings({ ...problemSettings, defaultVerifyDays: d })}
                        className={`px-2.5 py-1 rounded-lg font-mono font-bold border ${
                          defaultVerifyDays === d
                            ? 'bg-sky-500 text-slate-950 border-sky-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  {
                    key: 'showBreakdownBar' as const,
                    label: 'Show Root-Cause Breakdown bar',
                    val: showBreakdownBar
                  },
                  {
                    key: 'separateInboxTab' as const,
                    label: 'Separate Inbox / Slips tab from Active Constraints',
                    val: separateInbox
                  },
                  {
                    key: 'showPreFlightInDaily' as const,
                    label: 'Show Pre-Flight Guardrails strip in Daily Plan',
                    val: problemSettings.showPreFlightInDaily !== false
                  },
                  {
                    key: 'showPreFlightInGws' as const,
                    label: 'Show Pre-Flight Guardrails strip in GWS Studio',
                    val: problemSettings.showPreFlightInGws !== false
                  }
                ].map(toggle => (
                  <label
                    key={toggle.key}
                    className="flex items-center space-x-2.5 cursor-pointer text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={toggle.val}
                      onChange={e =>
                        saveProblemSettings({ ...problemSettings, [toggle.key]: e.target.checked })
                      }
                      className="rounded accent-amber-500"
                    />
                    <span>{toggle.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Problem Categories CRUD */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                  Custom Problem Categories ({problemCategories.length})
                </span>
                <button
                  type="button"
                  onClick={() => saveProblemCategories(INITIAL_PROBLEM_CATEGORIES)}
                  className="inline-flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-200 font-semibold"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Defaults</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {problemCategories.map((cat, idx) => (
                  <div
                    key={cat.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800"
                  >
                    <input
                      type="text"
                      value={cat.label}
                      onChange={e =>
                        saveProblemCategories(
                          problemCategories.map(c =>
                            c.id === cat.id ? { ...c, label: e.target.value } : c
                          )
                        )
                      }
                      className="sm:w-40 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 font-bold text-slate-100 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={cat.hint || ''}
                      onChange={e =>
                        saveProblemCategories(
                          problemCategories.map(c =>
                            c.id === cat.id ? { ...c, hint: e.target.value } : c
                          )
                        )
                      }
                      placeholder="Short hint..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 placeholder-slate-600 focus:outline-none"
                    />
                    <select
                      value={cat.color}
                      onChange={e =>
                        saveProblemCategories(
                          problemCategories.map(c =>
                            c.id === cat.id ? { ...c, color: e.target.value as ProblemColorKey } : c
                          )
                        )
                      }
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
                    >
                      {COLOR_KEYS.map(ck => (
                        <option key={ck} value={ck}>
                          {PROBLEM_COLOR_STYLES[ck].label}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveCategory(idx, -1)}
                        className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === problemCategories.length - 1}
                        onClick={() => handleMoveCategory(idx, 1)}
                        className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={problemCategories.length <= 1}
                        onClick={() =>
                          saveProblemCategories(problemCategories.filter(c => c.id !== cat.id))
                        }
                        className="p-1.5 rounded-lg bg-slate-950 text-slate-500 hover:text-rose-400 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newCatLabel}
                  onChange={e => setNewCatLabel(e.target.value)}
                  placeholder="New category (e.g. Risk Rules, Environment, Sales)..."
                  className="sm:w-52 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={newCatHint}
                  onChange={e => setNewCatHint(e.target.value)}
                  placeholder="Description (optional)..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 placeholder-slate-600 focus:outline-none"
                />
                <select
                  value={newCatColor}
                  onChange={e => setNewCatColor(e.target.value as ProblemColorKey)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-slate-200 focus:outline-none"
                >
                  {COLOR_KEYS.map(ck => (
                    <option key={ck} value={ck}>
                      {PROBLEM_COLOR_STYLES[ck].label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!newCatLabel.trim()}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-300 border border-amber-500/30 font-bold"
                >
                  + Add
                </button>
              </form>
            </div>
          </div>
        )}

        {/* INBOX GUIDANCE LINE */}
        {effectiveTab === 'inbox' && buckets.inbox.length > 0 && (
          <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-center space-x-2">
            <Inbox className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Fast 10-second triage: <strong className="text-amber-300">Merge</strong> related slips into a Root Constraint,{' '}
              <strong className="text-slate-200">Promote</strong> a recurring slip to its own Root Constraint, or{' '}
              <strong className="text-slate-200">Dismiss</strong> one-off noise.
            </span>
          </div>
        )}

        {/* PROBLEM LIST */}
        {displayedList.length === 0 ? (
          <div className="p-10 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
            {effectiveTab === 'inbox' ? (
              <>
                <CheckCircle2 className="w-7 h-7 text-emerald-500/70 mx-auto" />
                <p className="text-sm font-bold text-slate-300">Inbox clear</p>
                <p className="text-xs text-slate-500">
                  Quick slips captured during GWS sprints and Daily Reviews land here for fast triage.
                </p>
              </>
            ) : effectiveTab === 'solved' ? (
              <>
                <Shield className="w-7 h-7 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-400">No verified solved problems yet</p>
                <p className="text-xs text-slate-500">
                  Once a countermeasure holds through its verification window, verify it solved to archive it here.
                </p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-7 h-7 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-400">No matching constraints</p>
                <p className="text-xs text-slate-500">
                  Log a constraint above, or promote a slip from Inbox.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedList.map(prob => (
              <ProblemItemRow
                key={prob.id}
                problem={prob}
                contextDate={selectedDate}
                contextSourceType="daily"
                targetWeekId={selectedWeekId}
                showParentBreadcrumb={searchQuery.trim().length > 0}
                inboxMode={effectiveTab === 'inbox'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
