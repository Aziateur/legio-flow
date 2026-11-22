import React, { useState, useEffect } from 'react';
import {
  useStorage,
  findBestWeeklyPlanForDate,
  computeWeeklyAchievedScore
} from '../../context/StorageContext';
import { StrategyPlan, StrategyStage, TaskItem } from '../../types/schema';
import { ProblemLoggerPanel } from '../problems/ProblemLoggerPanel';
import {
  BookOpen,
  Plus,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  Circle,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  ArrowDownToLine,
  ShieldAlert,
  Sun,
  Eye,
  Crosshair,
  FileText,
  Pencil
} from 'lucide-react';

const createEmptyStage = (stageNum: number): StrategyStage => ({
  id: `stg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  title: `Stage ${stageNum}: Untitled Stage`,
  systemState: '',
  proximalGoals: [],
  whatItLooksLike: '',
  notPossibleUntil: '',
  dayInALife: '',
  gateCriterion: '',
  gatePassed: false
});

const createNewPlanTemplate = (count: number): StrategyPlan => {
  const now = new Date().toISOString();
  const base = Date.now();
  return {
    id: `plan_${base}_${Math.random().toString(36).slice(2, 6)}`,
    title: count === 0 ? 'Master Strategy Plan' : `New Strategy Plan ${count + 1}`,
    description: 'Written stage-gate roadmap from setup to mastery.',
    createdAt: now,
    updatedAt: now,
    stages: [
      {
        id: `stg_${base}_0`,
        title: 'Stage 0: Foundation & Setup',
        systemState: 'System set up',
        proximalGoals: [],
        whatItLooksLike: '',
        notPossibleUntil: '',
        dayInALife: '',
        gateCriterion: '',
        gatePassed: false
      },
      {
        id: `stg_${base}_1`,
        title: 'Stage 1: Functional Execution',
        systemState: 'System functional',
        proximalGoals: [],
        whatItLooksLike: '',
        notPossibleUntil: '',
        dayInALife: '',
        gateCriterion: '',
        gatePassed: false
      },
      {
        id: `stg_${base}_2`,
        title: 'Stage 2: Mastery & Scale',
        systemState: 'System scaled',
        proximalGoals: [],
        whatItLooksLike: '',
        notPossibleUntil: '',
        dayInALife: '',
        gateCriterion: '',
        gatePassed: false
      }
    ]
  };
};

export const StrategyRoadmapsView: React.FC = () => {
  const {
    strategyPlans,
    saveStrategyPlan,
    deleteStrategyPlan,
    todayDate,
    selectedDate,
    weeklyPlans,
    selectedWeekId,
    saveWeeklyPlan,
    setSelectedWeekId,
    setPlanningSubTab
  } = useStorage();

  const [selectedPlanId, setSelectedPlanId] = useState<string>(strategyPlans[0]?.id || '');
  const [collapsedStageIds, setCollapsedStageIds] = useState<Record<string, boolean>>({});
  const [editLockedMode, setEditLockedMode] = useState<boolean>(false);
  const [goalDrafts, setGoalDrafts] = useState<Record<string, string>>({});
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [pullTargetWeekId, setPullTargetWeekId] = useState<string>('');
  const [pullNotice, setPullNotice] = useState<string | null>(null);

  useEffect(() => {
    if (strategyPlans.length === 0) {
      setSelectedPlanId('');
    } else if (!strategyPlans.some(p => p.id === selectedPlanId)) {
      setSelectedPlanId(strategyPlans[0].id);
    }
  }, [strategyPlans, selectedPlanId]);

  const activePlan = strategyPlans.find(p => p.id === selectedPlanId) || strategyPlans[0] || null;
  const sortedWeeklyPlans = Object.values(weeklyPlans).sort((a, b) => a.weekNumber - b.weekNumber);
  const defaultWeeklyPlan =
    findBestWeeklyPlanForDate(selectedDate, weeklyPlans, selectedWeekId) ||
    weeklyPlans[selectedWeekId] ||
    sortedWeeklyPlans[sortedWeeklyPlans.length - 1];
  const activeWeeklyPlan =
    (pullTargetWeekId && weeklyPlans[pullTargetWeekId]) || defaultWeeklyPlan;

  const handleCreatePlan = () => {
    const newPlan = createNewPlanTemplate(strategyPlans.length);
    saveStrategyPlan(newPlan);
    setSelectedPlanId(newPlan.id);
  };

  const handleDuplicatePlan = () => {
    if (!activePlan) return;
    const now = new Date().toISOString();
    const copy: StrategyPlan = {
      ...activePlan,
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: `${activePlan.title} (Copy)`,
      createdAt: now,
      updatedAt: now,
      stages: activePlan.stages.map((s, idx) => ({
        ...s,
        id: `stg_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
        proximalGoals: s.proximalGoals.map((g, gi) => ({
          ...g,
          id: `pg_${Date.now()}_${idx}_${gi}`
        }))
      }))
    };
    saveStrategyPlan(copy);
    setSelectedPlanId(copy.id);
  };

  const handleDeletePlan = () => {
    if (!activePlan) return;
    if (!confirm(`Delete written plan "${activePlan.title}"? This cannot be undone.`)) return;
    const fallback = strategyPlans.find(p => p.id !== activePlan.id);
    deleteStrategyPlan(activePlan.id);
    setSelectedPlanId(fallback?.id || '');
  };

  const updateActivePlan = (patch: Partial<StrategyPlan>) => {
    if (!activePlan) return;
    saveStrategyPlan({ ...activePlan, ...patch });
  };

  const updateStage = (stageId: string, patch: Partial<StrategyStage>) => {
    if (!activePlan) return;
    updateActivePlan({
      stages: activePlan.stages.map(s => (s.id === stageId ? { ...s, ...patch } : s))
    });
  };

  const handleAddStage = () => {
    if (!activePlan) return;
    const nextStage = createEmptyStage(activePlan.stages.length);
    const willBeLocked = activePlan.stages.some(s => !s.gatePassed);
    if (willBeLocked) {
      setEditLockedMode(true);
    }
    updateActivePlan({
      stages: [...activePlan.stages, nextStage]
    });
    setTimeout(() => {
      document.getElementById(`strategy_stage_${nextStage.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 60);
  };

  const handleMoveStage = (index: number, delta: -1 | 1) => {
    if (!activePlan) return;
    const target = index + delta;
    if (target < 0 || target >= activePlan.stages.length) return;
    const next = [...activePlan.stages];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    updateActivePlan({ stages: next });
  };

  const handleDeleteStage = (stageId: string) => {
    if (!activePlan) return;
    if (activePlan.stages.length <= 1) {
      alert('A plan needs at least 1 stage.');
      return;
    }
    if (!confirm('Delete this stage from the plan?')) return;
    updateActivePlan({
      stages: activePlan.stages.filter(s => s.id !== stageId)
    });
  };

  const handleAddProximalGoal = (stageId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlan) return;
    const text = (goalDrafts[stageId] || '').trim();
    if (!text) return;
    const stage = activePlan.stages.find(s => s.id === stageId);
    if (!stage) return;
    updateStage(stageId, {
      proximalGoals: [
        ...stage.proximalGoals,
        {
          id: `pg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text,
          completed: false
        }
      ]
    });
    setGoalDrafts(prev => ({ ...prev, [stageId]: '' }));
  };

  const parseLookLines = (raw?: string): string[] =>
    (raw || '')
      .split('\n')
      .map(line => line.replace(/^[•\-\*\d\.\)\s]+/, '').trim())
      .filter(line => line.length >= 2);

  const isGoalInActiveWeek = (text: string, strategyGoalId?: string): boolean => {
    if (!activeWeeklyPlan) return false;
    if (strategyGoalId && activeWeeklyPlan.tasks.some(t => t.strategyGoalId === strategyGoalId)) {
      return true;
    }
    const norm = text.trim().toLowerCase();
    return !!norm && activeWeeklyPlan.tasks.some(t => t.text.trim().toLowerCase() === norm);
  };

  const handlePullGoalToWeek = (
    text: string,
    links?: {
      strategyPlanId?: string;
      strategyStageId?: string;
      strategyGoalId?: string;
      sourceLabel?: string;
      completed?: boolean;
    }
  ) => {
    if (!activeWeeklyPlan) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isGoalInActiveWeek(trimmed, links?.strategyGoalId)) {
      setSelectedWeekId(activeWeeklyPlan.id);
      setPlanningSubTab('weekly');
      return;
    }
    const nextTasks: TaskItem[] = [
      ...activeWeeklyPlan.tasks,
      {
        id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: trimmed,
        score: 2,
        completed: Boolean(links?.completed),
        ...(links?.sourceLabel ? { sourceLabel: links.sourceLabel } : {}),
        ...(links?.strategyPlanId ? { strategyPlanId: links.strategyPlanId } : {}),
        ...(links?.strategyStageId ? { strategyStageId: links.strategyStageId } : {}),
        ...(links?.strategyGoalId ? { strategyGoalId: links.strategyGoalId } : {})
      }
    ];
    saveWeeklyPlan({
      ...activeWeeklyPlan,
      tasks: nextTasks,
      achievedScore: computeWeeklyAchievedScore(nextTasks)
    });
    setPullNotice(`Sent "${trimmed.slice(0, 32)}${trimmed.length > 32 ? '…' : ''}" to Week ${activeWeeklyPlan.weekNumber}`);
    setTimeout(() => setPullNotice(null), 2400);
  };

  const handleCopyMarkdown = () => {
    if (!activePlan) return;
    const lines: string[] = [];
    lines.push(`# ${activePlan.title}`);
    if (activePlan.description?.trim()) {
      lines.push(activePlan.description.trim());
    }
    lines.push('');

    activePlan.stages.forEach((stage, idx) => {
      lines.push(`## ${stage.title}${stage.systemState ? ` — [${stage.systemState}]` : ''}`);
      lines.push(`Status: ${stage.gatePassed ? 'Gate Passed' : 'In Progress / Locked'}`);
      lines.push('');
      if (stage.proximalGoals.length > 0) {
        lines.push('### Proximal Goals');
        stage.proximalGoals.forEach(g => {
          lines.push(`- [${g.completed ? 'x' : ' '}] ${g.text}`);
        });
        lines.push('');
      }
      if (stage.whatItLooksLike.trim()) {
        lines.push('### What It Looks Like');
        lines.push(stage.whatItLooksLike.trim());
        lines.push('');
      }
      if (stage.notPossibleUntil.trim()) {
        lines.push("### What Isn't Possible Until Then");
        lines.push(stage.notPossibleUntil.trim());
        lines.push('');
      }
      if (stage.dayInALife.trim()) {
        lines.push('### Day in a Life');
        lines.push(stage.dayInALife.trim());
        lines.push('');
      }
      if (stage.gateCriterion.trim()) {
        lines.push(`### Gate (Stage ${idx} -> Stage ${idx + 1})`);
        lines.push(stage.gateCriterion.trim());
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    });

    navigator.clipboard.writeText(lines.join('\n').trim());
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2200);
  };

  const getActiveStageIndex = (plan: StrategyPlan): number => {
    const idx = plan.stages.findIndex(s => !s.gatePassed);
    return idx === -1 ? Math.max(0, plan.stages.length - 1) : idx;
  };

  const allCollapsed =
    activePlan !== null &&
    activePlan.stages.length > 0 &&
    activePlan.stages.every(s => Boolean(collapsedStageIds[s.id]));

  const toggleCollapseAll = () => {
    if (!activePlan) return;
    if (allCollapsed) {
      setCollapsedStageIds({});
    } else {
      const map: Record<string, boolean> = {};
      activePlan.stages.forEach(s => {
        map[s.id] = true;
      });
      setCollapsedStageIds(map);
    }
  };

  return (
    <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-2">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT SIDEBAR: MULTIPLE WRITTEN PLANS DIRECTORY */}
        <aside className="lg:col-span-3 space-y-3 lg:sticky lg:top-20">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-100">
                  Written Plans ({strategyPlans.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCreatePlan}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-extrabold shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Plan</span>
              </button>
            </div>

            {strategyPlans.length === 0 ? (
              <div className="p-4 rounded-2xl border border-dashed border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-400">No written roadmaps yet.</p>
                <button
                  type="button"
                  onClick={handleCreatePlan}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold"
                >
                  Create Your First Plan
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {strategyPlans.map(plan => {
                  const isSelected = activePlan?.id === plan.id;
                  const passedGates = plan.stages.filter(s => s.gatePassed).length;
                  const activeIdx = getActiveStageIndex(plan);
                  const activeStage = plan.stages[activeIdx];
                  const pct =
                    plan.stages.length > 0
                      ? Math.round((passedGates / plan.stages.length) * 100)
                      : 0;

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        setEditLockedMode(false);
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all space-y-2 ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/40 shadow-md shadow-amber-500/5'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-sm font-extrabold truncate ${
                            isSelected ? 'text-amber-300' : 'text-slate-100'
                          }`}
                        >
                          {plan.title || 'Untitled Plan'}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {passedGates}/{plan.stages.length} gates
                        </span>
                      </div>

                      {activeStage && (
                        <div className="text-[11px] text-slate-400 truncate">
                          Now: <span className="text-slate-300 font-medium">{activeStage.title}</span>
                        </div>
                      )}

                      <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {activePlan && (
              <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="flex items-center justify-center space-x-1 py-1.5 px-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-bold transition-colors"
                  title="Copy full written plan as Markdown"
                >
                  {copiedMarkdown ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{copiedMarkdown ? 'Copied!' : 'Copy Text'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDuplicatePlan}
                  className="flex items-center justify-center space-x-1 py-1.5 px-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-bold transition-colors"
                  title="Duplicate plan"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicate</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeletePlan}
                  className="col-span-2 flex items-center justify-center space-x-1 py-1.5 px-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 text-[11px] font-bold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Plan</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT MAIN AREA: WRITTEN STAGE-GATE DOCUMENT */}
        <section className="lg:col-span-9 space-y-5">
          {!activePlan ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-xl">
              <BookOpen className="w-10 h-10 text-amber-400 mx-auto" />
              <h2 className="text-xl font-extrabold text-slate-100">Create a Written Strategy Plan</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Map out sequential stages, system states, proximal goals, discipline boundaries, day-in-a-life stories, and the exact gates to unlock each next level — in clean written form.
              </p>
              <button
                type="button"
                onClick={handleCreatePlan}
                className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Written Plan</span>
              </button>
            </div>
          ) : (
            <>
              {/* Plan Document Header + Linear Stage Table of Contents */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                      Written Stage-Gate Roadmap
                    </span>
                    <input
                      type="text"
                      value={activePlan.title}
                      onChange={e => updateActivePlan({ title: e.target.value })}
                      placeholder="Plan title (e.g. Trading Strategy)..."
                      className="w-full bg-transparent text-2xl sm:text-3xl font-extrabold text-slate-100 focus:outline-none focus:bg-slate-950/80 rounded-xl px-2 -mx-2 py-0.5 transition-colors"
                    />
                    <input
                      type="text"
                      value={activePlan.description || ''}
                      onChange={e => updateActivePlan({ description: e.target.value })}
                      placeholder="Add a 1-line summary or core thesis for this plan..."
                      className="w-full bg-transparent text-xs sm:text-sm text-slate-400 focus:outline-none focus:text-slate-200 focus:bg-slate-950/80 rounded-lg px-2 -mx-2 py-0.5 transition-colors"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {activeWeeklyPlan && sortedWeeklyPlans.length > 0 && (
                      <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                        <ArrowDownToLine className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-[11px] text-slate-500 hidden sm:inline">Pull to:</span>
                        <select
                          value={activeWeeklyPlan.id}
                          onChange={e => setPullTargetWeekId(e.target.value)}
                          className="bg-transparent text-amber-300 font-bold text-xs focus:outline-none cursor-pointer"
                          title="Choose which Weekly Plan receives pulled items"
                        >
                          {sortedWeeklyPlans.map(wp => (
                            <option key={wp.id} value={wp.id} className="bg-slate-950 text-slate-200">
                              Week {wp.weekNumber} ({wp.startDate.slice(5)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditLockedMode(prev => !prev)}
                      title={
                        editLockedMode
                          ? 'Seal future stages behind their gates again'
                          : 'Temporarily unlock future stages so you can draft/edit them'
                      }
                      className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                        editLockedMode
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                    >
                      {editLockedMode ? (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Lock Future Stages</span>
                        </>
                      ) : (
                        <>
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          <span>Edit Future Stages</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={toggleCollapseAll}
                      className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold transition-colors"
                    >
                      {allCollapsed ? 'Expand All' : 'Collapse All'}
                    </button>
                    <button
                      type="button"
                      onClick={handleAddStage}
                      className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Stage</span>
                    </button>
                  </div>
                </div>

                {/* Linear Written Stage Jump Strip */}
                {pullNotice && (
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs font-bold text-emerald-300">
                    <span>✓ {pullNotice}</span>
                    {activeWeeklyPlan && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWeekId(activeWeeklyPlan.id);
                          setPlanningSubTab('weekly');
                        }}
                        className="underline hover:text-emerald-200 shrink-0"
                      >
                        Open Week {activeWeeklyPlan.weekNumber} →
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 overflow-x-auto pt-3 border-t border-slate-800/80 pb-1">
                  {activePlan.stages.map((stage, idx) => {
                    const activeStageIdx = getActiveStageIndex(activePlan);
                    const isLocked = idx > 0 && !activePlan.stages.slice(0, idx).every(s => s.gatePassed);
                    const isCurrent = idx === activeStageIdx && !stage.gatePassed && !isLocked;
                    return (
                      <React.Fragment key={stage.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isLocked || editLockedMode) {
                              setCollapsedStageIds(prev => ({ ...prev, [stage.id]: false }));
                            }
                            document.getElementById(`strategy_stage_${stage.id}`)?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start'
                            });
                          }}
                          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-all ${
                            stage.gatePassed
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                              : isCurrent
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                              : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                          }`}
                        >
                          {stage.gatePassed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : isLocked ? (
                            <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                          ) : (
                            <span className="font-mono text-[10px] opacity-80">#{idx}</span>
                          )}
                          <span className="max-w-[180px] truncate">{stage.title}</span>
                        </button>
                        {idx < activePlan.stages.length - 1 && (
                          <span className="text-slate-600 text-xs font-mono shrink-0">→</span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Linked Plan Blockers (Problems tagged with this Roadmap Plan) */}
              <ProblemLoggerPanel
                key={`roadmap_probs_${activePlan.id}_${activePlan.title}`}
                mode="roadmap"
                title={`Linked Problems (#${activePlan.title || 'Plan'})`}
                subtitle="Problems tagged with this plan from any review automatically surface here so you see what's blocking your next gate."
                sourceType="roadmap"
                date={selectedDate}
                sourceRef={activePlan.title}
                filterTag={activePlan.title}
                targetWeekId={activeWeeklyPlan?.id || selectedWeekId}
                defaultCollapsed={true}
              />

              {/* Sequential Written Stages */}
              <div className="space-y-5">
                {activePlan.stages.map((stage, idx) => {
                  const activeStageIdx = getActiveStageIndex(activePlan);
                  const isLocked = idx > 0 && !activePlan.stages.slice(0, idx).every(s => s.gatePassed);
                  const isSealed = isLocked && !editLockedMode;
                  const isCurrent = idx === activeStageIdx && !stage.gatePassed && !isLocked;
                  const isCollapsed = Boolean(collapsedStageIds[stage.id]);
                  const prevStage = idx > 0 ? activePlan.stages[idx - 1] : null;
                  const nextStage = activePlan.stages[idx + 1];
                  const completedGoals = stage.proximalGoals.filter(g => g.completed).length;

                  // SEALED LOCKED STAGE: Only show Stage Name + Gate (hide everything inside until previous gate is passed)
                  if (isSealed) {
                    return (
                      <article
                        id={`strategy_stage_${stage.id}`}
                        key={stage.id}
                        className="rounded-3xl border border-slate-800/90 bg-slate-900/50 shadow-lg overflow-hidden"
                      >
                        <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] font-extrabold text-slate-500">
                                STAGE {idx}
                              </span>
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800 text-[10px] font-extrabold uppercase tracking-wider">
                                <Lock className="w-3 h-3 text-slate-500" />
                                <span>Locked</span>
                              </span>
                              {prevStage && (
                                <span className="text-[11px] text-slate-500">
                                  Pass Stage {idx - 1}&apos;s gate to unlock
                                </span>
                              )}
                            </div>

                            <h3 className="text-lg font-extrabold text-slate-300">
                              {stage.title}
                            </h3>
                          </div>

                          {/* Gate Preview Only */}
                          <div className="md:max-w-md w-full rounded-2xl bg-slate-950/90 border border-slate-800 px-4 py-3 space-y-1">
                            <div className="flex items-center space-x-1.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-400/80">
                              <Lock className="w-3 h-3 shrink-0" />
                              <span>Gate</span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {stage.gateCriterion?.trim()
                                ? stage.gateCriterion.trim()
                                : 'No gate criterion written yet.'}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  }

                  return (
                    <article
                      id={`strategy_stage_${stage.id}`}
                      key={stage.id}
                      className={`rounded-3xl border shadow-xl overflow-hidden transition-all ${
                        stage.gatePassed
                          ? 'bg-slate-900/80 border-emerald-500/30'
                          : isCurrent
                          ? 'bg-slate-900/95 border-amber-500/40 ring-1 ring-amber-500/15'
                          : 'bg-slate-900/80 border-amber-500/20'
                      }`}
                    >
                      {/* Stage Chapter Header */}
                      <div className="p-5 sm:p-6 bg-slate-950/70 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] font-extrabold text-slate-300">
                              STAGE {idx}
                            </span>

                            {stage.gatePassed ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 text-[10px] font-extrabold uppercase tracking-wider">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Gate Passed</span>
                              </span>
                            ) : isCurrent ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold uppercase tracking-wider">
                                Active Stage
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wider">
                                <Pencil className="w-3 h-3" />
                                <span>Editing Locked Stage</span>
                              </span>
                            )}

                            {/* Editable System State Tag (e.g. "System set up", "System functional") */}
                            <input
                              type="text"
                              value={stage.systemState}
                              onChange={e => updateStage(stage.id, { systemState: e.target.value })}
                              placeholder="System state (e.g. System functional)..."
                              className="bg-rose-500/15 border border-rose-500/35 focus:border-rose-400 rounded-lg px-2.5 py-0.5 text-xs font-bold text-rose-300 placeholder-rose-300/40 focus:outline-none min-w-[160px]"
                            />
                          </div>

                          <input
                            type="text"
                            value={stage.title}
                            onChange={e => updateStage(stage.id, { title: e.target.value })}
                            placeholder="Stage title..."
                            className="w-full bg-transparent text-lg sm:text-xl font-extrabold text-slate-100 focus:outline-none focus:bg-slate-900 rounded-lg px-2 -mx-2 py-0.5 transition-colors"
                          />
                        </div>

                        {/* Stage Controls */}
                        <div className="flex items-center space-x-1.5 self-end md:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveStage(idx, -1)}
                            disabled={idx === 0}
                            title="Move stage up"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveStage(idx, 1)}
                            disabled={idx === activePlan.stages.length - 1}
                            title="Move stage down"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedStageIds(prev => ({ ...prev, [stage.id]: !isCollapsed }))
                            }
                            title={isCollapsed ? 'Expand stage' : 'Collapse stage'}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
                          >
                            {isCollapsed ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronUp className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStage(stage.id)}
                            title="Delete stage"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-slate-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Written Stage Body */}
                      {!isCollapsed && (
                        <div className="p-5 sm:p-6 space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            {/* 1. PROXIMAL GOALS ("what proximal goal looks like") */}
                            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 flex flex-col justify-between space-y-3">
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center space-x-1.5 text-[11px] font-extrabold uppercase tracking-wider text-rose-400">
                                    <Crosshair className="w-3.5 h-3.5" />
                                    <span>Proximal Goals</span>
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-500">
                                    {completedGoals}/{stage.proximalGoals.length} done
                                  </span>
                                </div>

                                {stage.proximalGoals.length === 0 ? (
                                  <p className="text-[11px] text-slate-500 italic py-1">
                                    What proximal goals look like at this stage — add concrete milestones below.
                                  </p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {stage.proximalGoals.map(goal => {
                                      const inWeek = isGoalInActiveWeek(goal.text, goal.id);
                                      return (
                                        <div
                                          key={goal.id}
                                          className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-colors ${
                                            goal.completed
                                              ? 'bg-emerald-500/5 border-emerald-500/20'
                                              : 'bg-slate-900/80 border-slate-800'
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateStage(stage.id, {
                                                proximalGoals: stage.proximalGoals.map(g =>
                                                  g.id === goal.id
                                                    ? { ...g, completed: !g.completed }
                                                    : g
                                                )
                                              })
                                            }
                                            className="shrink-0"
                                          >
                                            {goal.completed ? (
                                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            ) : (
                                              <Circle className="w-4 h-4 text-slate-500 hover:text-rose-400" />
                                            )}
                                          </button>
                                          <input
                                            type="text"
                                            value={goal.text}
                                            onChange={e =>
                                              updateStage(stage.id, {
                                                proximalGoals: stage.proximalGoals.map(g =>
                                                  g.id === goal.id ? { ...g, text: e.target.value } : g
                                                )
                                              })
                                            }
                                            className={`flex-1 min-w-0 bg-transparent text-xs focus:outline-none ${
                                              goal.completed
                                                ? 'line-through text-slate-500'
                                                : 'text-slate-200'
                                            }`}
                                          />
                                          {activeWeeklyPlan && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handlePullGoalToWeek(goal.text, {
                                                  strategyPlanId: activePlan.id,
                                                  strategyStageId: stage.id,
                                                  strategyGoalId: goal.id,
                                                  sourceLabel: `${activePlan.title} · Stage ${idx}`,
                                                  completed: goal.completed
                                                })
                                              }
                                              title={
                                                inWeek
                                                  ? `In Week ${activeWeeklyPlan.weekNumber} — open Weekly Plan`
                                                  : `Pull into Week ${activeWeeklyPlan.weekNumber}`
                                              }
                                              className={`shrink-0 inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                                                inWeek
                                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                  : 'bg-slate-950 text-amber-400 border-amber-500/30 hover:bg-amber-500/15'
                                              }`}
                                            >
                                              {!inWeek && <ArrowDownToLine className="w-2.5 h-2.5" />}
                                              <span>{inWeek ? `✓ W${activeWeeklyPlan.weekNumber}` : `+ W${activeWeeklyPlan.weekNumber}`}</span>
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateStage(stage.id, {
                                                proximalGoals: stage.proximalGoals.filter(
                                                  g => g.id !== goal.id
                                                )
                                              })
                                            }
                                            className="shrink-0 text-slate-600 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity"
                                            title="Remove proximal goal"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              <form
                                onSubmit={e => handleAddProximalGoal(stage.id, e)}
                                className="flex items-center gap-1.5 pt-1"
                              >
                                <input
                                  type="text"
                                  value={goalDrafts[stage.id] || ''}
                                  onChange={e =>
                                    setGoalDrafts(prev => ({ ...prev, [stage.id]: e.target.value }))
                                  }
                                  placeholder="Add proximal goal milestone..."
                                  className="flex-1 min-w-0 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500/40"
                                />
                                <button
                                  type="submit"
                                  disabled={!(goalDrafts[stage.id] || '').trim()}
                                  className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold disabled:opacity-40"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </form>
                            </div>

                            {/* 2. WHAT IT LOOKS LIKE */}
                            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 space-y-2.5">
                              <label className="inline-flex items-center space-x-1.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                                <Eye className="w-3.5 h-3.5" />
                                <span>What It Looks Like</span>
                              </label>
                              <textarea
                                rows={6}
                                value={stage.whatItLooksLike}
                                onChange={e =>
                                  updateStage(stage.id, { whatItLooksLike: e.target.value })
                                }
                                placeholder="- Clear entry and exit parameters&#10;- Repeatable tasks & obvious course correction&#10;- Concrete observable signals of this stage..."
                                className="w-full bg-slate-900/70 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed resize-y"
                              />
                              {activeWeeklyPlan && parseLookLines(stage.whatItLooksLike).length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/70">
                                  <span className="text-[10px] font-bold text-slate-500">
                                    Pull to W{activeWeeklyPlan.weekNumber}:
                                  </span>
                                  {parseLookLines(stage.whatItLooksLike).map((line, lIdx) => {
                                    const inWeek = isGoalInActiveWeek(line);
                                    return (
                                      <button
                                        key={lIdx}
                                        type="button"
                                        onClick={() =>
                                          handlePullGoalToWeek(line, {
                                            strategyPlanId: activePlan.id,
                                            strategyStageId: stage.id,
                                            sourceLabel: `${activePlan.title} · Stage ${idx}`
                                          })
                                        }
                                        title={inWeek ? `Already in Week ${activeWeeklyPlan.weekNumber}` : `Pull "${line}" into Week ${activeWeeklyPlan.weekNumber}`}
                                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold max-w-[220px] transition-colors ${
                                          inWeek
                                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                            : 'bg-slate-900 hover:bg-amber-500/15 text-slate-300 hover:text-amber-300 border-slate-800 hover:border-amber-500/30'
                                        }`}
                                      >
                                        <span className="shrink-0 font-bold">{inWeek ? '✓' : '+'}</span>
                                        <span className="truncate">{line}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* 3. WHAT ISN'T POSSIBLE UNTIL THEN (DISCIPLINE GUARDRAIL) */}
                            <div className="rounded-2xl bg-slate-950/80 border border-rose-500/20 p-4 space-y-2">
                              <label className="inline-flex items-center space-x-1.5 text-[11px] font-extrabold uppercase tracking-wider text-orange-400">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                <span>What Isn&apos;t Possible Until Then</span>
                              </label>
                              <textarea
                                rows={4}
                                value={stage.notPossibleUntil}
                                onChange={e =>
                                  updateStage(stage.id, { notPossibleUntil: e.target.value })
                                }
                                placeholder="Strict boundary: what you will NOT work on or unlock until this stage's gate is passed..."
                                className="w-full bg-slate-900/70 border border-slate-800 focus:border-orange-500/50 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed resize-y"
                              />
                            </div>

                            {/* 4. DAY IN A LIFE */}
                            <div className="rounded-2xl bg-slate-950/80 border border-emerald-500/20 p-4 space-y-2">
                              <label className="inline-flex items-center space-x-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                                <Sun className="w-3.5 h-3.5" />
                                <span>Day in a Life</span>
                              </label>
                              <textarea
                                rows={4}
                                value={stage.dayInALife}
                                onChange={e => updateStage(stage.id, { dayInALife: e.target.value })}
                                placeholder="Write a vivid story of what an ordinary day looks and feels like inside this stage..."
                                className="w-full bg-slate-900/70 border border-slate-800 focus:border-emerald-500/50 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed resize-y"
                              />
                            </div>
                          </div>

                          {/* 5. THE GATE BANNER (Unlocks Next Stage) */}
                          <div
                            className={`rounded-2xl border-2 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                              stage.gatePassed
                                ? 'bg-emerald-500/10 border-emerald-500/40'
                                : 'bg-slate-950 border-slate-700/90'
                            }`}
                          >
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center space-x-2">
                                {stage.gatePassed ? (
                                  <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                                ) : (
                                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                                )}
                                <span
                                  className={`text-[11px] font-extrabold uppercase tracking-widest ${
                                    stage.gatePassed ? 'text-emerald-300' : 'text-amber-400'
                                  }`}
                                >
                                  Gate{' '}
                                  {nextStage
                                    ? `→ Unlocks "${nextStage.title}"`
                                    : '(Final Stage Completion Criterion)'}
                                </span>
                              </div>
                              <textarea
                                rows={2}
                                value={stage.gateCriterion}
                                onChange={e =>
                                  updateStage(stage.id, { gateCriterion: e.target.value })
                                }
                                placeholder="Exact objective proof required to pass this Gate and move to the next stage..."
                                className="w-full bg-slate-900/80 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-100 placeholder-slate-600 focus:outline-none resize-y"
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {activeWeeklyPlan && stage.gateCriterion.trim().length > 0 && (() => {
                                const gateInWeek = isGoalInActiveWeek(stage.gateCriterion.trim());
                                return (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handlePullGoalToWeek(stage.gateCriterion.trim(), {
                                        strategyPlanId: activePlan.id,
                                        strategyStageId: stage.id,
                                        sourceLabel: `${activePlan.title} · Stage ${idx} Gate`
                                      })
                                    }
                                    className={`inline-flex items-center space-x-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                                      gateInWeek
                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                                        : 'bg-slate-900 hover:bg-amber-500/15 text-amber-300 border-amber-500/35'
                                    }`}
                                    title={
                                      gateInWeek
                                        ? `In Week ${activeWeeklyPlan.weekNumber} — click to open Weekly Plan`
                                        : `Pull this Gate criterion into Week ${activeWeeklyPlan.weekNumber} goals`
                                    }
                                  >
                                    {!gateInWeek && <ArrowDownToLine className="w-3.5 h-3.5" />}
                                    <span>{gateInWeek ? `✓ In W${activeWeeklyPlan.weekNumber}` : `+ Week ${activeWeeklyPlan.weekNumber}`}</span>
                                  </button>
                                );
                              })()}

                              <button
                                type="button"
                                disabled={isLocked && !stage.gatePassed}
                                onClick={() =>
                                  updateStage(stage.id, {
                                    gatePassed: !stage.gatePassed,
                                    gatePassedAt: !stage.gatePassed ? todayDate : undefined
                                  })
                                }
                                title={
                                  isLocked && !stage.gatePassed
                                    ? `Pass Stage ${idx - 1}'s gate first`
                                    : undefined
                                }
                                className={`shrink-0 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold border transition-all ${
                                  isLocked && !stage.gatePassed
                                    ? 'bg-slate-900/60 text-slate-600 border-slate-800 cursor-not-allowed'
                                    : stage.gatePassed
                                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20 active:scale-95'
                                    : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-500/40 active:scale-95'
                                }`}
                              >
                                {stage.gatePassed ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Gate Passed</span>
                                  </>
                                ) : isLocked ? (
                                  <>
                                    <Lock className="w-4 h-4" />
                                    <span>Locked</span>
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="w-4 h-4" />
                                    <span>Pass Gate</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {/* Bottom Add Next Stage Button */}
              <button
                type="button"
                onClick={handleAddStage}
                className="w-full py-3.5 rounded-2xl border-2 border-dashed border-slate-800 hover:border-amber-500/40 bg-slate-900/40 hover:bg-slate-900/80 text-xs font-extrabold text-slate-400 hover:text-amber-300 flex items-center justify-center space-x-2 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Stage {activePlan.stages.length} to &quot;{activePlan.title}&quot;</span>
              </button>
            </>
          )}
        </section>

      </div>
    </div>
  );
};
