import React, { useMemo, useState } from 'react';
import {
  CustomProblemCategory,
  ProblemColorKey,
  ProblemEntry
} from '../../types/schema';
import { INITIAL_PROBLEM_CATEGORIES } from '../../types/defaults';
import {
  PROBLEM_COLOR_STYLES,
  SEVERITY_VISUAL,
  clusterHasTag,
  computeProblemPriorityScore,
  getClusterOccurrenceTimeline,
  getClusterTotalHits,
  getLastOccurrenceDate,
  getProblemActionText,
  getProblemReminderText,
  getProblemSeverity,
  getSolutionTestingSummary,
  hasActiveAction,
  hasActiveReminder,
  hasExistingParent,
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
import { useStorage } from '../../context/StorageContext';
import { getLevelCapabilities } from '../../lib/levelFeatures';
import { isActiveStrategyPlan } from '../../lib/planHierarchy';
import { ProblemItemRow } from './ProblemItemRow';
import { ProblemPulseBar } from './ProblemPulseBar';
import { ProblemWorkbenchModal, WorkbenchTab } from './ProblemWorkbenchModal';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle2,
  Circle,
  Crosshair,
  Eye,
  Filter,
  Inbox,
  Map as MapIcon,
  MessageSquarePlus,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sliders,
  Trash2,
  Wrench,
  X
} from 'lucide-react';

type MainTabMode = 'classify' | 'backlog' | 'resolved';
type ResponseFilter = 'all' | 'watching' | 'reminder' | 'action' | 'waiting';
type LedgerSort = 'severity' | 'frequency' | 'recent';

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
    weeklyPlans,
    checklistItems,
    selectedDate,
    selectedWeekId,
    addProblem,
    recordProblemRecurrence,
    updateProblem,
    deleteProblem
  } = useStorage();

  const caps = getLevelCapabilities(systemLevel);

  const maxTop = problemSettings.maxTopConstraints || 3;
  const defaultVerifyTarget = problemSettings.defaultVerifyTarget || 5;
  const showBreakdownBar = problemSettings.showBreakdownBar !== false;

  const [activeTab, setActiveTab] = useState<MainTabMode>('backlog');
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<LedgerSort>('severity');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);

  // Zero-friction 1-line raw capture
  const [quickTitle, setQuickTitle] = useState('');
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);

  // Top 3 inline 1-line hit note state (keyed by problem.id)
  const [topNoteOpenId, setTopNoteOpenId] = useState<string | null>(null);
  const [topNoteDraft, setTopNoteDraft] = useState('');
  const [topLoggedId, setTopLoggedId] = useState<string | null>(null);

  // Focused Single-Problem Case File Drawer
  const [workbenchState, setWorkbenchState] = useState<{
    problemId: string;
    initialTab?: WorkbenchTab;
  } | null>(null);

  // Customize Categories form
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatHint, setNewCatHint] = useState('');
  const [newCatColor, setNewCatColor] = useState<ProblemColorKey>('cyan');

  const roadmapTitles = useMemo(
    () => strategyPlans.filter(isActiveStrategyPlan).map(p => p.title.trim()).filter(Boolean),
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

  // 1. Top 3 Active Focus (WIP Limit — NEVER duplicated in Backlog!)
  const topFocusProblems = useMemo(
    () =>
      topLevelProblems
        .filter(p => p.isTopConstraint && p.status !== 'solved')
        .sort((a, b) => computeProblemPriorityScore(problems, b) - computeProblemPriorityScore(problems, a)),
    [topLevelProblems, problems]
  );
  const topFocusIds = useMemo(() => new Set(topFocusProblems.map(p => p.id)), [topFocusProblems]);

  // 2. Partition remaining top-level problems cleanly with ZERO duplication:
  //    To Classify | Backlog (classified, non-Top-3) | Resolved
  const buckets = useMemo(() => {
    const toClassify: ProblemEntry[] = [];
    const backlog: ProblemEntry[] = [];
    const resolved: ProblemEntry[] = [];

    topLevelProblems.forEach(p => {
      if (p.status === 'solved') {
        resolved.push(p);
      } else if (topFocusIds.has(p.id)) {
        return;
      } else if (!isProblemClassified(problems, p)) {
        toClassify.push(p);
      } else {
        backlog.push(p);
      }
    });

    return { toClassify, backlog, resolved };
  }, [topLevelProblems, problems, topFocusIds]);

  const pinnableCandidates = useMemo(
    () =>
      [...buckets.backlog].sort(
        (a, b) => computeProblemPriorityScore(problems, b) - computeProblemPriorityScore(problems, a)
      ),
    [buckets.backlog, problems]
  );

  const breakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    problems
      .filter(p => p.status !== 'solved' && isProblemClassified(problems, p))
      .forEach(p => {
        const w = Math.max(1, p.occurrences?.length || 1);
        counts[p.category] = (counts[p.category] || 0) + w;
        total += w;
      });
    return { counts, total };
  }, [problems]);

  const displayedList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const pool =
      q.length > 0
        ? problems.filter(p => (activeTab === 'resolved' ? p.status === 'solved' : p.status !== 'solved'))
        : activeTab === 'classify'
        ? buckets.toClassify
        : activeTab === 'backlog'
        ? buckets.backlog
        : buckets.resolved;

    const list = pool.filter(p => {
      if (activeTab === 'backlog') {
        const isWatch = isProblemWatching(p);
        const hasRem = hasActiveReminder(p);
        const hasAct = hasActiveAction(p);
        if (responseFilter === 'watching' && !isWatch) return false;
        if (responseFilter === 'reminder' && !hasRem) return false;
        if (responseFilter === 'action' && !hasAct) return false;
        if (responseFilter === 'waiting' && (isWatch || hasRem || hasAct)) return false;
      }
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (severityFilter !== 'all') {
        const sev = getProblemSeverity(p);
        if (severityFilter === '4+' && sev < 4) return false;
        if (severityFilter === '3' && sev !== 3) return false;
        if (severityFilter === '1-2' && sev > 2) return false;
      }
      if (tagFilter !== 'all' && !clusterHasTag(problems, p, tagFilter)) return false;
      if (q) {
        const hitTitle = p.title.toLowerCase().includes(q);
        const hitWatch = (p.watchQuestion || '').toLowerCase().includes(q);
        const hitFix = (p.fixNote || '').toLowerCase().includes(q);
        const hitRem = (p.reminderText || '').toLowerCase().includes(q);
        const hitCause = (p.rootCause || '').toLowerCase().includes(q);
        const hitTrigger = (p.trigger || '').toLowerCase().includes(q);
        const hitTag = (p.tags || []).some(t => t.toLowerCase().includes(q));
        if (!hitTitle && !hitWatch && !hitFix && !hitRem && !hitCause && !hitTrigger && !hitTag) {
          return false;
        }
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (activeTab === 'classify') {
        return getLastOccurrenceDate(b).localeCompare(getLastOccurrenceDate(a));
      }
      if (sortBy === 'frequency') {
        const diff = getClusterTotalHits(problems, b) - getClusterTotalHits(problems, a);
        if (diff !== 0) return diff;
        return getLastOccurrenceDate(b).localeCompare(getLastOccurrenceDate(a));
      }
      if (sortBy === 'recent') {
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      }
      const sevDiff = getProblemSeverity(b) - getProblemSeverity(a);
      if (sevDiff !== 0) return sevDiff;
      return getClusterTotalHits(problems, b) - getClusterTotalHits(problems, a);
    });
  }, [
    problems,
    buckets,
    activeTab,
    responseFilter,
    categoryFilter,
    severityFilter,
    tagFilter,
    searchQuery,
    sortBy
  ]);

  const backlogTierGroups = useMemo(() => {
    if (activeTab !== 'backlog' || sortBy !== 'severity' || searchQuery.trim().length > 0) {
      return null;
    }
    const urgent = displayedList.filter(p => getProblemSeverity(p) >= 4);
    const moderate = displayedList.filter(p => getProblemSeverity(p) === 3);
    const minor = displayedList.filter(p => getProblemSeverity(p) <= 2);
    return [
      { id: 'urgent', label: 'Urgent · Critical & Severe', dotCls: 'bg-rose-500', textCls: 'text-rose-300', items: urgent },
      { id: 'moderate', label: 'Moderate Drag', dotCls: 'bg-amber-400', textCls: 'text-amber-300', items: moderate },
      { id: 'minor', label: 'Low & Minor Background', dotCls: 'bg-sky-400', textCls: 'text-slate-400', items: minor }
    ].filter(g => g.items.length > 0);
  }, [activeTab, sortBy, searchQuery, displayedList]);

  const handleQuickCapture = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    const existing = problems.find(
      p => p.title.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      recordProblemRecurrence(existing.id, {
        date: selectedDate,
        sourceType: 'daily',
        sourceRef: selectedDate
      });
      setCaptureNotice(`Already tracked — logged another occurrence on "${existing.title}"`);
    } else {
      addProblem({
        title: trimmed,
        category: problemCategories[0]?.id || 'mindset',
        classified: false,
        scale: 'friction',
        severity: 2,
        impact: severityToImpact(2),
        sourceType: 'daily',
        date: selectedDate,
        sourceRef: selectedDate
      });
      setCaptureNotice('Recorded to "To Classify" — classify calmly at end of day or week');
      setActiveTab('classify');
    }
    setQuickTitle('');
    setTimeout(() => setCaptureNotice(null), 3200);
  };

  const handleTopHit = (prob: ProblemEntry) => {
    if (shouldPromptNoteOnHit(prob)) {
      if (topNoteOpenId === prob.id) {
        setTopNoteOpenId(null);
        setTopNoteDraft('');
      } else {
        setTopNoteOpenId(prob.id);
        setTopNoteDraft('');
      }
    } else {
      recordProblemRecurrence(prob.id, {
        date: selectedDate,
        sourceType: 'daily',
        sourceRef: selectedDate
      });
      setTopLoggedId(prob.id);
      setTimeout(() => setTopLoggedId(null), 1400);
    }
  };

  const commitTopHitNote = (probId: string, note?: string) => {
    recordProblemRecurrence(probId, {
      date: selectedDate,
      sourceType: 'daily',
      sourceRef: selectedDate,
      ...(note?.trim() ? { note: note.trim() } : {})
    });
    setTopNoteOpenId(null);
    setTopNoteDraft('');
    setTopLoggedId(probId);
    setTimeout(() => setTopLoggedId(null), 1400);
  };

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
  // LVL 2 LITE MODE
  // ================================================================
  if (!caps.problemsConstraintEngine) {
    const activeLite = topLevelProblems
      .filter(p => p.status !== 'solved')
      .sort((a, b) => getLastOccurrenceDate(b).localeCompare(getLastOccurrenceDate(a)));
    const solvedLite = topLevelProblems
      .filter(p => p.status === 'solved')
      .sort((a, b) => getLastOccurrenceDate(b).localeCompare(getLastOccurrenceDate(a)));
    const showSolvedLite = activeTab === 'resolved';
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
          classified: false,
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
                Capture daily &amp; GWS sprint frictions in one flat list. Tap Happened again when something repeats, or check it off when resolved.
              </p>
            </div>

            <div className="inline-flex rounded-xl bg-slate-950 border border-slate-800 p-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setActiveTab('backlog')}
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
                onClick={() => setActiveTab('resolved')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  showSolvedLite
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Resolved ({solvedLite.length})
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
              <span>Record</span>
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
                        className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-orange-500/15 border border-slate-800 hover:border-orange-500/35 text-xs font-bold text-orange-300"
                      >
                        Happened again ({hits})
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
              Ready for Top 3 Active Focus, Observing mode, 14-day pulse, Reminders &amp; live task links?
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
      {/* 1. TOP 3 ACTIVE FOCUS (WIP Limit — Editable Directly, No Dupe!)  */}
      {/* ================================================================ */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 flex items-center space-x-1.5">
              <Crosshair className="w-3.5 h-3.5" />
              <span>Active Attack Focus · WIP Limit</span>
            </span>
            <h2 className="text-lg font-extrabold text-slate-100 mt-0.5">
              Top {maxTop} Focus ({topFocusProblems.length}/{maxTop})
            </h2>
            <p className="text-xs text-slate-400">
              Only solve these {maxTop} right now — everything else waits calmly in Backlog below. Detail notes on hit are ON by default here.
            </p>
          </div>

          {buckets.toClassify.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('classify')}
              className="self-start sm:self-center inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 text-xs font-extrabold transition-colors"
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>{buckets.toClassify.length} waiting to classify</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {Array.from({ length: maxTop }).map((_, slotIdx) => {
            const prob = topFocusProblems[slotIdx];
            if (!prob) {
              return (
                <div
                  key={`slot_${slotIdx}`}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 flex flex-col justify-between space-y-3 min-h-[180px]"
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-mono text-xs font-extrabold text-slate-500">
                      #{slotIdx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Open Focus Slot
                    </span>
                  </div>

                  {pinnableCandidates.length > 0 ? (
                    <select
                      value=""
                      onChange={e => {
                        if (e.target.value) {
                          updateProblem(e.target.value, {
                            classified: true,
                            isTopConstraint: true,
                            scale: 'bottleneck'
                          });
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-800 hover:border-rose-500/40 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none"
                    >
                      <option value="">+ Pick a problem from Backlog...</option>
                      {pinnableCandidates.map(c => (
                        <option key={c.id} value={c.id}>
                          [{SEVERITY_VISUAL[getProblemSeverity(c)].word}] {c.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[11px] text-slate-600">
                      Classify a problem below, then pin your top {maxTop} battles here.
                    </p>
                  )}
                </div>
              );
            }

            const sev = getProblemSeverity(prob);
            const sevVis = SEVERITY_VISUAL[sev];
            const cat = resolveCategoryMeta(prob.category, problemCategories);
            const hits = getClusterTotalHits(problems, prob);
            const testing = getSolutionTestingSummary(prob, defaultVerifyTarget);
            const reminderText = getProblemReminderText(prob);
            const actionText = getProblemActionText(prob);
            const remActive = hasActiveReminder(prob);
            const actActive = hasActiveAction(prob);
            const watchingActive = isProblemWatching(prob);
            const noteToggleOn = shouldPromptNoteOnHit(prob);
            const linkedRmId = resolveProblemRoadmapPlanId(prob, strategyPlans);
            const linkedRm = linkedRmId ? strategyPlans.find(sp => sp.id === linkedRmId) : undefined;
            const latestClue = getClusterOccurrenceTimeline(problems, prob).find(o => o.note?.trim());
            const linkedActs = resolveProblemLinkedActions(
              prob.id,
              weeklyPlans,
              checklistItems,
              todayDate,
              selectedWeekId
            );

            return (
              <div
                key={prob.id}
                className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all ${sevVis.cardTintClass} ${sevVis.leftBarClass}`}
              >
                {/* Header & Title (Click opens Case File!) */}
                <div
                  className="space-y-2.5 cursor-pointer"
                  onClick={() => setWorkbenchState({ problemId: prob.id })}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-rose-500/20 text-rose-200 border border-rose-500/40 flex items-center justify-center font-mono text-[10px] font-extrabold shrink-0">
                        #{slotIdx + 1}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${sevVis.pillClass}`}>
                        {sevVis.word}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">{cat.shortLabel}</span>
                      <span className="font-mono text-[10px] text-slate-500">· {hits}×</span>
                    </div>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        updateProblem(prob.id, { isTopConstraint: false });
                      }}
                      className="p-1 text-slate-600 hover:text-slate-300"
                      title="Move back to Backlog"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-sm font-extrabold text-slate-100 leading-snug">
                    {prob.title}
                  </p>

                  <ProblemPulseBar
                    problem={prob}
                    allProblems={problems}
                    todayDate={todayDate}
                    compact
                  />

                  {linkedRm && (
                    <div className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-300/90">
                      <MapIcon className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[180px]">{linkedRm.title}</span>
                    </div>
                  )}

                  {/* Active Response Summary */}
                  <div className="space-y-1.5 text-xs">
                    {watchingActive && (
                      <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-100 space-y-1">
                        <div className="flex items-start space-x-1.5 text-[11px] font-semibold">
                          <Eye className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                          <span>
                            {prob.watchQuestion?.trim() || 'Observing — logging clues across Daily & GWS'}
                          </span>
                        </div>
                        {latestClue?.note && (
                          <div className="pl-5 text-[10px] text-slate-300 truncate">
                            {latestClue.date.slice(5)}: &ldquo;{latestClue.note}&rdquo;
                          </div>
                        )}
                      </div>
                    )}

                    {remActive && (
                      <div className="flex items-start space-x-1.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-100">
                        <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span className="leading-snug text-[11px]">
                          {prob.trigger?.trim() && (
                            <span className="text-amber-300/80 mr-1">When {prob.trigger.trim()} →</span>
                          )}
                          {reminderText || 'Reminder active'}
                        </span>
                      </div>
                    )}

                    {(actActive || linkedActs.length > 0) && (
                      <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-100 space-y-1">
                        {actionText && (
                          <div className="flex items-start space-x-1.5 leading-snug text-[11px]">
                            <Wrench className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                            <span>{actionText}</span>
                          </div>
                        )}
                        {linkedActs.length > 0 && (
                          <div className="flex flex-wrap gap-1 pl-5">
                            {linkedActs.map(act => (
                              <span
                                key={`${act.kind}_${act.id}`}
                                className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                                  act.completed
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                                    : 'bg-slate-900/90 text-slate-300 border-slate-700'
                                }`}
                              >
                                {act.detail}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!watchingActive && !remActive && !actActive && linkedActs.length === 0 && (
                      <div className="text-[11px] text-slate-400 p-2 rounded-xl bg-slate-900/70 border border-slate-800">
                        Click to turn on Observing, set a Reminder, or link an Action
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Hit-Note Input */}
                {topNoteOpenId === prob.id && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                    <input
                      type="text"
                      autoFocus
                      value={topNoteDraft}
                      onChange={e => setTopNoteDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitTopHitNote(prob.id, topNoteDraft);
                        }
                        if (e.key === 'Escape') {
                          setTopNoteOpenId(null);
                          setTopNoteDraft('');
                        }
                      }}
                      placeholder="What triggered it or happened? (Enter)..."
                      className="w-full bg-slate-950 border border-sky-500/45 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => commitTopHitNote(prob.id)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-400 hover:text-slate-200"
                      >
                        Skip note
                      </button>
                      <button
                        type="button"
                        onClick={() => commitTopHitNote(prob.id, topNoteDraft)}
                        className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-[10px] font-extrabold"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                )}

                {/* Progress / Alerts + Plain Actions */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  {testing.hasSolution && (
                    <div className="space-y-1">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${testing.badgeClass}`}
                      >
                        {testing.label}
                      </span>
                      {testing.latestPendingTweak && (
                        <div className="text-[10px] text-violet-300 truncate">
                          Tweak idea: &ldquo;{testing.latestPendingTweak.note}&rdquo;
                        </div>
                      )}
                    </div>
                  )}

                  {prob.fixTaskCompletedAt && (
                    <div className="text-[10px] font-bold text-emerald-300 flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>Fix task completed ({prob.fixTaskCompletedAt.slice(5)})</span>
                    </div>
                  )}

                  {testing.hasSolution && testing.effectiveCount > 0 && testing.state !== 'failed' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className={testing.readyToResolve ? 'text-emerald-300 font-bold' : 'text-sky-300'}>
                          {testing.readyToResolve
                            ? `✓ Proven (${testing.effectiveCount}/${testing.targetCount}×)`
                            : `${testing.effectiveCount}/${testing.targetCount}× worked`}
                        </span>
                        <span className="text-slate-500">{testing.pct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${testing.readyToResolve ? 'bg-emerald-400' : 'bg-sky-400'}`}
                          style={{ width: `${testing.pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTopHit(prob)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                          topLoggedId === prob.id
                            ? 'bg-orange-500 text-slate-950 border-orange-400'
                            : 'bg-slate-900 hover:bg-orange-500/15 text-orange-300 border-slate-800 hover:border-orange-500/40'
                        }`}
                      >
                        {topLoggedId === prob.id ? 'Logged ✓' : watchingActive ? '+ Log clue' : 'Happened again'}
                      </button>

                      <button
                        type="button"
                        onClick={() => updateProblem(prob.id, { promptNoteOnHit: !noteToggleOn })}
                        title={
                          noteToggleOn
                            ? 'Detail notes ON (default for Top 3) — click to turn OFF'
                            : 'Detail notes OFF — click to ask for a 1-line note on each hit'
                        }
                        className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
                          noteToggleOn
                            ? 'bg-sky-500/15 text-sky-300 border-sky-500/35'
                            : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                        }`}
                      >
                        <MessageSquarePlus className="w-3 h-3" />
                        <span>{noteToggleOn ? 'ON' : 'OFF'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setWorkbenchState({ problemId: prob.id })}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-bold"
                      >
                        Open
                      </button>

                      {testing.readyToResolve && (
                        <button
                          type="button"
                          onClick={() => updateProblem(prob.id, { status: 'solved', classified: true })}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-extrabold"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================================================================ */}
      {/* 2. ZERO-FRICTION CAPTURE + 3 CLEAR TABS (NO DUPLICATES!)         */}
      {/* ================================================================ */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
        <form onSubmit={handleQuickCapture} className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              placeholder="Record something that got in your way (press Enter — classify later)..."
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!quickTitle.trim()}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Record</span>
            </button>
          </div>
          {captureNotice && (
            <p className="text-xs font-semibold text-emerald-300 pl-1">✓ {captureNotice}</p>
          )}
        </form>

        {/* Clean 3-Tab Bar: To Classify | Backlog | Resolved */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('classify')}
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'classify'
                    ? 'bg-amber-500 text-slate-950'
                    : buckets.toClassify.length > 0
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>To Classify ({buckets.toClassify.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('backlog')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'backlog'
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Backlog ({buckets.backlog.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('resolved')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'resolved'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Resolved ({buckets.resolved.length})
              </button>
            </div>

            {activeTab === 'backlog' && (
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'watching', label: 'Watching' },
                    { id: 'reminder', label: 'Reminders' },
                    { id: 'action', label: 'Actions' },
                    { id: 'waiting', label: 'Waiting' }
                  ] as const
                ).map(st => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setResponseFilter(st.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                      responseFilter === st.id
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

        {/* SLIM ROOT-CAUSE BREAKDOWN BAR */}
        {activeTab === 'backlog' && showBreakdownBar && breakdown.total > 0 && (
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
                  placeholder="Search problems, watch questions, reminders, actions, tags..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500/40 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              </div>

              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 focus:outline-none"
              >
                <option value="all">Severity: All</option>
                <option value="4+">Critical &amp; Severe</option>
                <option value="3">Moderate</option>
                <option value="1-2">Low &amp; Minor</option>
              </select>

              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as LedgerSort)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 focus:outline-none"
              >
                <option value="severity">Sort: Severity Tiers</option>
                <option value="frequency">Sort: Most Frequent</option>
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

        {/* COLLAPSIBLE CUSTOMIZE PANEL */}
        {showCustomize && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-700 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="font-extrabold text-sm text-slate-100">Customize Problem Log</div>
                <p className="text-[11px] text-slate-400">
                  Configure Top Focus limit, verification window, where Reminders &amp; Watching strips appear, and categories.
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-300">Max Top Focus Slots</span>
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
                  <span className="font-bold text-slate-300">Default Proof Target (Worked reps)</span>
                  <div className="flex items-center gap-1">
                    {[3, 5, 10].map(target => (
                      <button
                        key={target}
                        type="button"
                        onClick={() => saveProblemSettings({ ...problemSettings, defaultVerifyTarget: target })}
                        className={`px-2.5 py-1 rounded-lg font-mono font-bold border ${
                          defaultVerifyTarget === target
                            ? 'bg-sky-500 text-slate-950 border-sky-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        {target}×
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
                    key: 'showPreFlightInDaily' as const,
                    label: 'Show Reminders & Watching at top of Daily Plan',
                    val: problemSettings.showPreFlightInDaily !== false
                  },
                  {
                    key: 'showPreFlightInGws' as const,
                    label: 'Show Reminders & Watching before GWS sprints',
                    val: problemSettings.showPreFlightInGws !== false
                  },
                  {
                    key: 'showPreFlightInWeekly' as const,
                    label: 'Show Reminders & Watching at top of Weekly Plan',
                    val: problemSettings.showPreFlightInWeekly !== false
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
                  Custom Categories ({problemCategories.length})
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
                  placeholder="New category..."
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

        {/* TO CLASSIFY GUIDANCE */}
        {activeTab === 'classify' && buckets.toClassify.length > 0 && (
          <div className="px-3.5 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/25 text-xs text-slate-300 flex items-center space-x-2">
            <Inbox className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              End-of-day / weekly triage: click <strong className="text-amber-300">Classify</strong> to rate how bad it is &amp; choose whether to Watch or Solve, <strong className="text-slate-100">Merge into</strong> an existing problem, or <strong className="text-slate-100">Discard</strong> noise.
            </span>
          </div>
        )}

        {/* LIST CONTENT */}
        {displayedList.length === 0 ? (
          <div className="p-10 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
            {activeTab === 'classify' ? (
              <>
                <CheckCircle2 className="w-7 h-7 text-emerald-500/70 mx-auto" />
                <p className="text-sm font-bold text-slate-300">Nothing waiting to classify</p>
                <p className="text-xs text-slate-500">
                  Quick raw notes captured during Daily, GWS, or Reviews land here so you can classify them calmly later.
                </p>
              </>
            ) : activeTab === 'resolved' ? (
              <>
                <Shield className="w-7 h-7 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-400">No resolved problems yet</p>
                <p className="text-xs text-slate-500">
                  Once a solution holds and you mark a problem Resolved, it moves here as proof of what worked.
                </p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-7 h-7 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-400">Backlog clear</p>
                <p className="text-xs text-slate-500">
                  {topFocusProblems.length > 0
                    ? 'All your active classified problems are already in your Top Focus above.'
                    : 'Record a problem above or classify raw captures from "To Classify".'}
                </p>
              </>
            )}
          </div>
        ) : backlogTierGroups ? (
          <div className="space-y-5">
            {backlogTierGroups.map(tier => (
              <div key={tier.id} className="space-y-2">
                <div className="flex items-center space-x-2 px-1">
                  <span className={`w-2 h-2 rounded-full ${tier.dotCls}`} />
                  <span className={`text-[11px] font-extrabold uppercase tracking-wider ${tier.textCls}`}>
                    {tier.label} ({tier.items.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {tier.items.map(prob => (
                    <ProblemItemRow
                      key={prob.id}
                      problem={prob}
                      contextDate={selectedDate}
                      contextSourceType="daily"
                      targetWeekId={selectedWeekId}
                      onOpenWorkbench={(id, tab) => setWorkbenchState({ problemId: id, initialTab: tab })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {displayedList.map(prob => (
              <ProblemItemRow
                key={prob.id}
                problem={prob}
                contextDate={selectedDate}
                contextSourceType="daily"
                targetWeekId={selectedWeekId}
                showParentBreadcrumb={searchQuery.trim().length > 0}
                inboxMode={activeTab === 'classify'}
                onOpenWorkbench={(id, tab) => setWorkbenchState({ problemId: id, initialTab: tab })}
              />
            ))}
          </div>
        )}
      </div>

      {/* SINGLE-CANVAS CASE FILE DRAWER */}
      {workbenchState && (
        <ProblemWorkbenchModal
          problemId={workbenchState.problemId}
          initialTab={workbenchState.initialTab}
          contextDate={selectedDate}
          contextSourceType="daily"
          targetWeekId={selectedWeekId}
          onClose={() => setWorkbenchState(null)}
        />
      )}
    </div>
  );
};
