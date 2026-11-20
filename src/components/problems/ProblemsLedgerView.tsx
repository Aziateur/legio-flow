import React, { useMemo, useState } from 'react';
import { ProblemCategory, ProblemEntry, ProblemScale } from '../../types/schema';
import {
  PROBLEM_CATEGORIES,
  PROBLEM_SCALES,
  SCALE_MAP,
  SCALE_RANK,
  clusterHasTag,
  getClusterTotalHits,
  getEligibleParentProblems,
  getLastOccurrenceDate,
  getProblemScale,
  hasExistingParent,
  normalizeTag,
  tagsMatch
} from '../../lib/problems';
import { useStorage } from '../../context/StorageContext';
import { ProblemItemRow } from './ProblemItemRow';
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  Map as MapIcon,
  Plus,
  Search,
  Shield,
  Tag
} from 'lucide-react';

type LedgerStatusFilter = 'all' | 'open' | 'testing' | 'rules' | 'solved';
type LedgerSort = 'triage' | 'frequency' | 'recent';

export const ProblemsLedgerView: React.FC = () => {
  const {
    problems,
    strategyPlans,
    selectedDate,
    selectedWeekId,
    addProblem,
    recordProblemRecurrence,
    updateProblem
  } = useStorage();

  const [statusFilter, setStatusFilter] = useState<LedgerStatusFilter>('all');
  const [scaleFilter, setScaleFilter] = useState<'all' | ProblemScale>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProblemCategory>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<LedgerSort>('triage');
  const [searchQuery, setSearchQuery] = useState('');

  // Progressive-disclosure quick-add state
  const [composerOpen, setComposerOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickScale, setQuickScale] = useState<ProblemScale>('bottleneck');
  const [quickCategory, setQuickCategory] = useState<ProblemCategory>('mindset');
  const [quickParentId, setQuickParentId] = useState<string>('');
  const [quickTags, setQuickTags] = useState<string[]>([]);
  const [quickTagInput, setQuickTagInput] = useState('');

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

  const eligibleParents = useMemo(
    () => getEligibleParentProblems(problems, quickScale).filter(p => p.status !== 'solved'),
    [problems, quickScale]
  );

  const stats = useMemo(() => {
    const open = topLevelProblems.filter(p => p.status === 'open').length;
    const testing = topLevelProblems.filter(p => p.status === 'testing').length;
    const rules = topLevelProblems.filter(
      p => p.fixType === 'rule_guardrail' && p.status !== 'solved'
    ).length;
    const solved = topLevelProblems.filter(p => p.status === 'solved').length;
    const totalOccurrences = problems.reduce(
      (sum, p) => sum + Math.max(1, p.occurrences?.length || 1),
      0
    );

    const byScale: Record<ProblemScale, number> = {
      blocker: 0,
      bottleneck: 0,
      friction: 0
    };
    problems.forEach(p => {
      byScale[getProblemScale(p)] += 1;
    });

    const byCategory: Record<ProblemCategory, number> = {
      mindset: 0,
      skill: 0,
      logistics: 0,
      energy: 0,
      strategy: 0
    };
    problems.forEach(p => {
      const weight = Math.max(1, p.occurrences?.length || 1);
      if (byCategory[p.category] !== undefined) {
        byCategory[p.category] += weight;
      }
    });

    return { open, testing, rules, solved, totalOccurrences, byCategory, byScale };
  }, [problems, topLevelProblems]);

  // Flat view only when explicitly filtering by a specific child scale or searching text
  const useFlatPool = scaleFilter === 'friction' || searchQuery.trim().length > 0;

  const filtered = useMemo<ProblemEntry[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const basePool = useFlatPool ? problems : topLevelProblems;

    const list = basePool.filter(p => {
      if (statusFilter === 'open' && p.status !== 'open') return false;
      if (statusFilter === 'testing' && p.status !== 'testing') return false;
      if (
        statusFilter === 'rules' &&
        !(p.fixType === 'rule_guardrail' && p.status !== 'solved')
      ) {
        return false;
      }
      if (statusFilter === 'solved' && p.status !== 'solved') return false;
      if (scaleFilter !== 'all' && getProblemScale(p) !== scaleFilter) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (tagFilter !== 'all') {
        if (useFlatPool) {
          if (!(p.tags || []).some(t => tagsMatch(t, tagFilter))) return false;
        } else if (!clusterHasTag(problems, p, tagFilter)) {
          return false;
        }
      }
      if (q) {
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchFix = (p.fixNote || '').toLowerCase().includes(q);
        const matchTag = (p.tags || []).some(t => t.toLowerCase().includes(q));
        if (!matchTitle && !matchFix && !matchTag) return false;
      }
      return true;
    });

    const statusWeight = (s: ProblemEntry['status']) =>
      s === 'open' ? 0 : s === 'testing' ? 1 : 2;

    return [...list].sort((a, b) => {
      if (sortBy === 'frequency') {
        const diff = getClusterTotalHits(problems, b) - getClusterTotalHits(problems, a);
        if (diff !== 0) return diff;
        return getLastOccurrenceDate(b).localeCompare(getLastOccurrenceDate(a));
      }
      if (sortBy === 'recent') {
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      }
      const sw = statusWeight(a.status) - statusWeight(b.status);
      if (sw !== 0) return sw;
      const scDiff = SCALE_RANK[getProblemScale(b)] - SCALE_RANK[getProblemScale(a)];
      if (scDiff !== 0) return scDiff;
      const diff = getClusterTotalHits(problems, b) - getClusterTotalHits(problems, a);
      if (diff !== 0) return diff;
      return getLastOccurrenceDate(b).localeCompare(getLastOccurrenceDate(a));
    });
  }, [
    problems,
    topLevelProblems,
    useFlatPool,
    statusFilter,
    scaleFilter,
    categoryFilter,
    tagFilter,
    sortBy,
    searchQuery
  ]);

  const handleToggleQuickTag = (tag: string) => {
    const clean = normalizeTag(tag);
    if (!clean) return;
    if (quickTags.some(t => tagsMatch(t, clean))) {
      setQuickTags(quickTags.filter(t => !tagsMatch(t, clean)));
    } else {
      setQuickTags([...quickTags, clean]);
    }
  };

  const handleAddQuickCustomTag = () => {
    const clean = normalizeTag(quickTagInput);
    if (!clean) return;
    if (!quickTags.some(t => tagsMatch(t, clean))) {
      setQuickTags([...quickTags, clean]);
    }
    setQuickTagInput('');
  };

  const handleQuickLog = () => {
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    const existing = problems.find(
      p => p.title.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      recordProblemRecurrence(existing.id, {
        date: selectedDate,
        sourceType: quickScale === 'blocker' ? 'monthly' : quickScale === 'bottleneck' ? 'weekly' : 'daily',
        sourceRef: selectedDate
      });
      if (quickTags.length > 0) {
        updateProblem(existing.id, {
          tags: Array.from(new Set([...existing.tags, ...quickTags]))
        });
      }
    } else {
      addProblem({
        title: trimmed,
        category: quickCategory,
        scale: quickScale,
        ...(quickParentId ? { parentProblemId: quickParentId } : {}),
        tags: quickTags,
        sourceType: quickScale === 'blocker' ? 'monthly' : quickScale === 'bottleneck' ? 'weekly' : 'daily',
        date: selectedDate,
        sourceRef: selectedDate
      });
    }
    setQuickTitle('');
    setQuickParentId('');
    setQuickTags([]);
    setComposerOpen(false);
  };

  const showOptions = composerOpen || quickTitle.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Top KPI + Root-Cause Breakdown Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => setStatusFilter('open')}
            className={`text-left p-3.5 rounded-2xl border transition-all ${
              statusFilter === 'open'
                ? 'bg-orange-500/15 border-orange-500/45'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-orange-400">
              Open
            </div>
            <div className="text-2xl font-mono font-extrabold text-slate-100 mt-0.5">
              {stats.open}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('testing')}
            className={`text-left p-3.5 rounded-2xl border transition-all ${
              statusFilter === 'testing'
                ? 'bg-sky-500/15 border-sky-500/45'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400">
              Testing Fix
            </div>
            <div className="text-2xl font-mono font-extrabold text-slate-100 mt-0.5">
              {stats.testing}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('rules')}
            className={`text-left p-3.5 rounded-2xl border transition-all ${
              statusFilter === 'rules'
                ? 'bg-rose-500/15 border-rose-500/45'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400 flex items-center space-x-1">
              <Shield className="w-3 h-3" />
              <span>Active Rules</span>
            </div>
            <div className="text-2xl font-mono font-extrabold text-slate-100 mt-0.5">
              {stats.rules}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('solved')}
            className={`text-left p-3.5 rounded-2xl border transition-all ${
              statusFilter === 'solved'
                ? 'bg-emerald-500/15 border-emerald-500/45'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Verified Solved</span>
            </div>
            <div className="text-2xl font-mono font-extrabold text-slate-100 mt-0.5">
              {stats.solved}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`col-span-2 sm:col-span-1 text-left p-3.5 rounded-2xl border transition-all ${
              statusFilter === 'all'
                ? 'bg-amber-500/15 border-amber-500/45'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
              Total Hits
            </div>
            <div className="text-2xl font-mono font-extrabold text-slate-100 mt-0.5">
              {stats.totalOccurrences}
            </div>
          </button>
        </div>

        {/* Visual Root-Cause Breakdown Bar */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold uppercase tracking-wider text-slate-400 text-[11px]">
              Root-Cause Breakdown (Weighted by Recurrence)
            </span>
            {categoryFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className="text-[11px] font-bold text-amber-400 hover:text-amber-300"
              >
                Clear category filter
              </button>
            )}
          </div>

          {stats.totalOccurrences > 0 ? (
            <>
              <div className="h-3 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex">
                {PROBLEM_CATEGORIES.map(c => {
                  const count = stats.byCategory[c.id];
                  if (count === 0) return null;
                  const pct = (count / stats.totalOccurrences) * 100;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setCategoryFilter(prev => (prev === c.id ? 'all' : c.id))
                      }
                      style={{ width: `${pct}%` }}
                      className={`${c.barClass} h-full transition-opacity ${
                        categoryFilter !== 'all' && categoryFilter !== c.id
                          ? 'opacity-30'
                          : 'opacity-90 hover:opacity-100'
                      }`}
                      title={`${c.label}: ${count} hit(s) (${Math.round(pct)}%)`}
                    />
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {PROBLEM_CATEGORIES.map(c => {
                  const count = stats.byCategory[c.id];
                  const pct =
                    stats.totalOccurrences > 0
                      ? Math.round((count / stats.totalOccurrences) * 100)
                      : 0;
                  const active = categoryFilter === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setCategoryFilter(prev => (prev === c.id ? 'all' : c.id))
                      }
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all ${
                        active
                          ? c.activeChipClass
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${active ? 'bg-slate-950' : c.dotClass}`} />
                      <span>{c.shortLabel}</span>
                      <span className="font-mono opacity-80">{pct}%</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500">
              Log problems in any review (or below) to reveal your primary bottleneck category.
            </div>
          )}
        </div>
      </div>

      {/* 1-Line Progressive-Disclosure Quick Log Strip */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
          <input
            type="text"
            value={quickTitle}
            onFocus={() => setComposerOpen(true)}
            onChange={e => setQuickTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleQuickLog();
              }
            }}
            placeholder="Log a new Blocker, Bottleneck, or Friction (Enter to add)..."
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-orange-500/50 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleQuickLog}
            disabled={!quickTitle.trim()}
            className="flex items-center space-x-1 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Log</span>
          </button>
        </div>

        {showOptions && (
          <div className="space-y-2.5 pt-2 border-t border-slate-800/70">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Scale:
                </span>
                {PROBLEM_SCALES.map(sc => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => {
                      setQuickScale(sc.id);
                      setQuickParentId('');
                    }}
                    title={sc.hint}
                    className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-extrabold transition-all ${
                      quickScale === sc.id
                        ? sc.activeChipClass
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {sc.shortLabel}
                  </button>
                ))}
              </div>
              {!quickTitle.trim() && (
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-300"
                >
                  Collapse
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Category:
              </span>
              {PROBLEM_CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setQuickCategory(c.id)}
                  className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-bold transition-all ${
                    quickCategory === c.id
                      ? c.activeChipClass
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {c.shortLabel}
                </button>
              ))}
            </div>

            {eligibleParents.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  <Layers className="w-3 h-3" />
                  <span>Group under:</span>
                </span>
                <select
                  value={quickParentId}
                  onChange={e => setQuickParentId(e.target.value)}
                  className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="">Standalone {SCALE_MAP[quickScale].shortLabel}</option>
                  {eligibleParents.map(ep => (
                    <option key={ep.id} value={ep.id}>
                      ↳ [{SCALE_MAP[getProblemScale(ep)].shortLabel}] {ep.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Tag className="w-3 h-3" />
                <span>Tie to Plan / Tag:</span>
              </span>
              {roadmapTitles.map(rt => {
                const active = quickTags.some(t => tagsMatch(t, rt));
                return (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => handleToggleQuickTag(rt)}
                    className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold transition-all ${
                      active
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <MapIcon className="w-3 h-3" />
                    <span>{rt}</span>
                  </button>
                );
              })}
              {quickTags
                .filter(t => !roadmapTitles.some(rt => tagsMatch(rt, t)))
                .map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleToggleQuickTag(t)}
                    className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-100 border border-slate-600 text-[11px] font-bold"
                  >
                    #{t} ×
                  </button>
                ))}
              <input
                type="text"
                value={quickTagInput}
                onChange={e => setQuickTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddQuickCustomTag();
                  }
                }}
                placeholder="+ tag"
                className="bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-full px-2.5 py-0.5 text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none w-20"
              />
            </div>
          </div>
        )}
      </div>

      {/* Filters + Search + Clustered Problem List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Status + Scale Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              {(
                [
                  { id: 'all', label: `All (${topLevelProblems.length})` },
                  { id: 'open', label: `Open (${stats.open})` },
                  { id: 'testing', label: `Testing (${stats.testing})` },
                  { id: 'rules', label: `Rules (${stats.rules})` },
                  { id: 'solved', label: `Solved (${stats.solved})` }
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    statusFilter === tab.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setScaleFilter('all')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  scaleFilter === 'all'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Scales
              </button>
              {(['blocker', 'bottleneck', 'friction'] as ProblemScale[]).map(sc => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setScaleFilter(sc)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    scaleFilter === sc
                      ? SCALE_MAP[sc].activeChipClass
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {SCALE_MAP[sc].shortLabel} ({stats.byScale[sc]})
                </button>
              ))}
            </div>
          </div>

          {/* Search + Sort */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-52">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search problems, fixes, tags..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
              />
            </div>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as LedgerSort)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="triage">Sort: Scale & Priority</option>
              <option value="frequency">Sort: Most Frequent (×N)</option>
              <option value="recent">Sort: Most Recent</option>
            </select>
          </div>
        </div>

        {/* Plan / Tag Filter Strip */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/70">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
              Plan / Tag:
            </span>
            <button
              type="button"
              onClick={() => setTagFilter('all')}
              className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${
                tagFilter === 'all'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
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
                  className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold transition-all ${
                    active
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {isPlan ? <MapIcon className="w-2.5 h-2.5" /> : <span>#</span>}
                  <span>{t}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Problem Cards */}
        {filtered.length === 0 ? (
          <div className="p-10 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
            <AlertTriangle className="w-7 h-7 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-400">No matching problems</p>
            <p className="text-xs text-slate-500">
              Try clearing filters or log a problem during any review.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map(prob => (
              <ProblemItemRow
                key={prob.id}
                problem={prob}
                contextDate={selectedDate}
                contextSourceType="daily"
                targetWeekId={selectedWeekId}
                showParentBreadcrumb={useFlatPool}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
