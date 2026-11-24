import React, { useMemo, useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { TaskItem, TargetGateRef } from '../../types/schema';
import { getMonthInfo, getQuarterInfo, shiftQuarterKey } from '../../lib/macroAnalytics';
import {
  STRATEGY_PRIORITY_META,
  getCommittedGatesForQuarter,
  getMonthlyChildrenOfQuarterlyTask,
  getMonthsForQuarter,
  isActiveStrategyPlan,
  sortStrategyPlansByPriority
} from '../../lib/planHierarchy';
import { getLevelCapabilities } from '../../lib/levelFeatures';
import { ScoreboardEditor } from '../common/ScoreboardEditor';
import { TopFocusesEditor } from '../common/TopFocusesEditor';
import {
  HierarchyOutcomeCard,
  ParentLinkOption
} from './HierarchyOutcomeCard';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Compass,
  ExternalLink,
  Lock,
  Unlock,
  ArrowUpRight,
  Calendar
} from 'lucide-react';

interface QuarterlyPlanSectionProps {
  selectedQuarterKey: string;
  setSelectedQuarterKey: (qKey: string) => void;
  selectedMonthKey: string;
  onOpenMonth?: (monthKey: string) => void;
  onOpenYear?: (yearKey: string) => void;
}

export const QuarterlyPlanSection: React.FC<QuarterlyPlanSectionProps> = ({
  selectedQuarterKey,
  setSelectedQuarterKey,
  selectedMonthKey,
  onOpenMonth,
  onOpenYear
}) => {
  const {
    systemLevel,
    quarterlyPlans,
    getQuarterlyPlan,
    saveQuarterlyPlan,
    monthlyPlans,
    getMonthlyPlan,
    saveMonthlyPlan,
    getYearlyPlan,
    strategyPlans,
    todayDate,
    selectedDate,
    setActiveTab,
    setPlanningSubTab,
    setReviewSubTab
  } = useStorage();

  const [newOutcomeInput, setNewOutcomeInput] = useState('');
  const [newOutcomeKpi, setNewOutcomeKpi] = useState('');
  const [newOutcomeParent, setNewOutcomeParent] = useState('');
  const [showParentYear, setShowParentYear] = useState(true);
  const [stepNotice, setStepNotice] = useState<string | null>(null);
  const [gateStepTargetId, setGateStepTargetId] = useState<string | null>(null);
  const [gateStepMonth, setGateStepMonth] = useState<string>('');
  const [gateStepDraft, setGateStepDraft] = useState('');

  const qInfo = getQuarterInfo(selectedQuarterKey);
  const activeQuarterPlan = getQuarterlyPlan(selectedQuarterKey);
  const linkedYearPlan = getYearlyPlan(String(qInfo.year));
  const quarterMonths = getMonthsForQuarter(qInfo.quarterKey);
  const defaultChildMonth = quarterMonths.includes(selectedMonthKey)
    ? selectedMonthKey
    : quarterMonths[0];

  const todayQKey = getQuarterInfo(
    `${todayDate.slice(0, 4)}-Q${Math.ceil((parseInt(todayDate.slice(5, 7), 10) || 1) / 3)}`
  ).quarterKey;
  const selectedDateQKey = getQuarterInfo(
    `${selectedDate.slice(0, 4)}-Q${Math.ceil((parseInt(selectedDate.slice(5, 7), 10) || 1) / 3)}`
  ).quarterKey;

  const knownQuarterKeys = Array.from(
    new Set([
      shiftQuarterKey(selectedQuarterKey, -1),
      todayQKey,
      selectedDateQKey,
      selectedQuarterKey,
      shiftQuarterKey(selectedQuarterKey, 1),
      ...Object.keys(quarterlyPlans)
    ])
  ).sort();

  const caps = getLevelCapabilities(systemLevel);
  const activeStrategyPlans = useMemo(
    () => sortStrategyPlansByPriority(strategyPlans.filter(isActiveStrategyPlan)),
    [strategyPlans]
  );
  const activeOutcomes = activeQuarterPlan.tasks.filter(t => t.status !== 'parked');
  const doneCount = activeOutcomes.filter(t => t.completed).length;
  const targetGateRefs = activeQuarterPlan.targetGateRefs || [];
  const committedGates = useMemo(
    () => getCommittedGatesForQuarter(activeQuarterPlan, strategyPlans),
    [activeQuarterPlan, strategyPlans]
  );

  // Parent link options for Quarterly Outcomes (Yearly Outcomes at LVL 5 + Committed Roadmap Gates at LVL 4+)
  const parentOptions = useMemo<ParentLinkOption[]>(() => {
    const opts: ParentLinkOption[] = [];
    if (caps.modelAQuarterToYear) {
      linkedYearPlan.tasks
        .filter(t => t.status !== 'parked')
        .forEach(yt => {
          opts.push({
            value: `yearly:${yt.id}`,
            label: yt.text,
            group: `${qInfo.year} Yearly Objectives`
          });
        });
    }
    if (caps.roadmaps) {
      committedGates.forEach(cg => {
        opts.push({
          value: `gate:${cg.plan.id}|${cg.stage.id}`,
          label: `${cg.plan.title} · Stage ${cg.stageIndex}`,
          group: 'Committed Roadmap Gates'
        });
      });
    }
    return opts;
  }, [linkedYearPlan.tasks, committedGates, qInfo.year, caps.modelAQuarterToYear, caps.roadmaps]);

  const encodeTaskParent = (t: TaskItem): string => {
    if (t.yearlyTaskId) return `yearly:${t.yearlyTaskId}`;
    if (t.strategyPlanId && t.strategyStageId) return `gate:${t.strategyPlanId}|${t.strategyStageId}`;
    return '';
  };

  const decodeParentPatch = (encoded: string): Partial<TaskItem> => {
    if (!encoded) {
      return {
        yearlyTaskId: undefined,
        strategyPlanId: undefined,
        strategyStageId: undefined,
        sourceLabel: undefined
      };
    }
    if (encoded.startsWith('yearly:')) {
      return {
        yearlyTaskId: encoded.slice(7),
        strategyPlanId: undefined,
        strategyStageId: undefined,
        parentLinkMode: 'step'
      };
    }
    if (encoded.startsWith('gate:')) {
      const [planId, stageId] = encoded.slice(5).split('|');
      const plan = strategyPlans.find(p => p.id === planId);
      return {
        yearlyTaskId: undefined,
        strategyPlanId: planId,
        strategyStageId: stageId,
        sourceLabel: plan ? `${plan.title}` : undefined,
        parentLinkMode: 'step'
      };
    }
    return {};
  };

  const childMonthOptions = useMemo(
    () =>
      quarterMonths.map(mk => ({
        key: mk,
        label: getMonthInfo(mk).label
      })),
    [quarterMonths]
  );

  const handleAddOutcome = () => {
    const trimmed = newOutcomeInput.trim();
    if (!trimmed) return;
    const parentPatch = decodeParentPatch(newOutcomeParent);
    const nextTask: TaskItem = {
      id: `qgoal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      completed: false,
      ...(newOutcomeKpi.trim() ? { kpiTarget: newOutcomeKpi.trim() } : {}),
      ...parentPatch
    };
    saveQuarterlyPlan({
      ...activeQuarterPlan,
      tasks: [...activeQuarterPlan.tasks, nextTask]
    });
    setNewOutcomeInput('');
    setNewOutcomeKpi('');
    setNewOutcomeParent('');
  };

  const handleUpdateOutcome = (id: string, patch: Partial<TaskItem>) => {
    saveQuarterlyPlan({
      ...activeQuarterPlan,
      tasks: activeQuarterPlan.tasks.map(t => (t.id === id ? { ...t, ...patch } : t))
    });
  };

  const handleDeleteOutcome = (id: string) => {
    saveQuarterlyPlan({
      ...activeQuarterPlan,
      tasks: activeQuarterPlan.tasks.filter(t => t.id !== id)
    });
  };

  const handleSpawnMonthlyStep = (
    parentTask: TaskItem,
    monthKey: string,
    text: string,
    kpiTarget?: string
  ) => {
    const targetMonth = getMonthlyPlan(monthKey);
    const newStep: TaskItem = {
      id: `mgoal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text,
      completed: false,
      parentLinkMode: 'step',
      quarterlyTaskId: parentTask.id,
      ...(parentTask.yearlyTaskId ? { yearlyTaskId: parentTask.yearlyTaskId } : {}),
      ...(parentTask.strategyPlanId ? { strategyPlanId: parentTask.strategyPlanId } : {}),
      ...(parentTask.strategyStageId ? { strategyStageId: parentTask.strategyStageId } : {}),
      ...(kpiTarget ? { kpiTarget } : {})
    };
    saveMonthlyPlan({
      ...targetMonth,
      tasks: [...targetMonth.tasks, newStep]
    });
    setStepNotice(`Added step to ${getMonthInfo(monthKey).label}`);
    setTimeout(() => setStepNotice(null), 2400);
  };

  const handleSpawnGateMonthlyStep = (planId: string, stageId: string, planTitle: string) => {
    const clean = gateStepDraft.trim();
    if (!clean) return;
    const mKey = gateStepMonth || defaultChildMonth;
    const targetMonth = getMonthlyPlan(mKey);
    saveMonthlyPlan({
      ...targetMonth,
      tasks: [
        ...targetMonth.tasks,
        {
          id: `mgoal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: clean,
          completed: false,
          parentLinkMode: 'step',
          strategyPlanId: planId,
          strategyStageId: stageId,
          sourceLabel: planTitle
        }
      ]
    });
    setGateStepDraft('');
    setGateStepTargetId(null);
    setStepNotice(`Scheduled Roadmap step in ${getMonthInfo(mKey).label}`);
    setTimeout(() => setStepNotice(null), 2400);
  };

  const toggleTargetGate = (ref: TargetGateRef) => {
    const exists = targetGateRefs.some(r => r.planId === ref.planId && r.stageId === ref.stageId);
    const nextRefs = exists
      ? targetGateRefs.filter(r => !(r.planId === ref.planId && r.stageId === ref.stageId))
      : [...targetGateRefs, ref];
    saveQuarterlyPlan({
      ...activeQuarterPlan,
      targetGateRefs: nextRefs
    });
  };

  const jumpToMonth = (mKey: string) => {
    if (onOpenMonth) {
      onOpenMonth(mKey);
    } else {
      setPlanningSubTab('monthly');
    }
  };

  const yearHasContext = Boolean(
    linkedYearPlan.focusTheme.trim() ||
      (linkedYearPlan.topFocuses || []).some(f => f.trim()) ||
      linkedYearPlan.tasks.length > 0
  );

  return (
    <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-5">
      {/* Quarter Selector & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setSelectedQuarterKey(shiftQuarterKey(selectedQuarterKey, -1))}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Previous Quarter"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 block">
              90-Day Strategic Contract ({qInfo.startDate} → {qInfo.endDate})
            </span>
            <div className="text-lg font-extrabold text-slate-100">{qInfo.label}</div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedQuarterKey(shiftQuarterKey(selectedQuarterKey, 1))}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Next Quarter"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {knownQuarterKeys.map(qKey => {
            const isSelected = qKey === selectedQuarterKey;
            const qp = quarterlyPlans[qKey];
            const hasContent = !!(
              qp &&
              (qp.tasks.length > 0 ||
                qp.focusTheme.trim() ||
                (qp.topFocuses || []).some(f => f.trim()) ||
                (qp.scoreboard && qp.scoreboard.length > 0))
            );
            return (
              <button
                key={qKey}
                type="button"
                onClick={() => setSelectedQuarterKey(qKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all shrink-0 ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : hasContent
                    ? 'bg-slate-950 text-slate-200 border border-slate-700 hover:border-cyan-500/40'
                    : 'bg-slate-950/60 text-slate-500 border border-slate-800 hover:text-slate-300'
                }`}
              >
                {qKey}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setActiveTab('review');
              setReviewSubTab('quarterly');
            }}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-colors"
          >
            <span>Quarterly Review</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* LOOKING UP: Parent Year Compass Bar (LVL 5 only, when Yearly Plan is unlocked) */}
      {caps.modelAQuarterToYear && yearHasContext && (
        <div className="rounded-2xl bg-slate-900/80 border border-rose-500/25 overflow-hidden shadow-md">
          <div className="px-4 py-2.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowParentYear(v => !v)}
              className="flex items-center space-x-2 text-left min-w-0"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-400 shrink-0">
                Serving {qInfo.year} Yearly Plan
              </span>
              {linkedYearPlan.focusTheme.trim() && (
                <span className="text-xs font-semibold text-slate-300 truncate">
                  · {linkedYearPlan.focusTheme.trim()}
                </span>
              )}
            </button>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onOpenYear ? onOpenYear(String(qInfo.year)) : setPlanningSubTab('yearly')
                }
                className="text-[11px] font-bold text-rose-300 hover:text-rose-200"
              >
                Open {qInfo.year} →
              </button>
              <button
                type="button"
                onClick={() => setShowParentYear(v => !v)}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                {showParentYear ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {showParentYear && (
            <div className="px-4 pb-3.5 pt-2 border-t border-slate-800/80 space-y-2.5 text-xs">
              {(linkedYearPlan.topFocuses || []).some(f => f.trim()) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                    {qInfo.year} Top Focuses:
                  </span>
                  {(linkedYearPlan.topFocuses || [])
                    .map(f => f.trim())
                    .filter(Boolean)
                    .map((f, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-200 border border-rose-500/25 text-[11px] font-semibold"
                      >
                        #{idx + 1} {f}
                      </span>
                    ))}
                </div>
              )}

              {linkedYearPlan.tasks.filter(t => !t.completed && t.status !== 'parked').length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                    Active {qInfo.year} Objectives:
                  </span>
                  {linkedYearPlan.tasks
                    .filter(t => !t.completed && t.status !== 'parked')
                    .map(yt => {
                      const hasQChild = activeQuarterPlan.tasks.some(qt => qt.yearlyTaskId === yt.id);
                      return (
                        <button
                          key={yt.id}
                          type="button"
                          onClick={() => setNewOutcomeParent(`yearly:${yt.id}`)}
                          title="Select as parent for your next Quarterly outcome below"
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-colors ${
                            newOutcomeParent === `yearly:${yt.id}`
                              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50'
                              : hasQChild
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                              : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                          }`}
                        >
                          <span>{hasQChild ? '✓' : '○'}</span>
                          <span>{yt.text}</span>
                          {yt.kpiTarget?.trim() && (
                            <span className="text-[10px] font-mono text-slate-500">
                              ({yt.kpiTarget.trim()})
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Quarterly Plan Sheet */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-7">
        {/* Focus Theme */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-1">
              Quarterly Strategic Focus &amp; Core Thesis • {qInfo.quarterKey}
            </span>
            <input
              type="text"
              value={activeQuarterPlan.focusTheme}
              onChange={e => saveQuarterlyPlan({ ...activeQuarterPlan, focusTheme: e.target.value })}
              placeholder="What single strategic shift makes these 90 days an undeniable victory?"
              className="w-full bg-transparent text-xl sm:text-2xl font-extrabold text-amber-400 placeholder-slate-700 focus:outline-none"
            />
          </div>

          <span className="self-start sm:self-center px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold shrink-0">
            {doneCount} / {activeOutcomes.length} outcomes
          </span>
        </div>

        {/* Quarterly Top 3 Focuses */}
        <div className="pt-4 border-t border-slate-800/80">
          <TopFocusesEditor
            focuses={activeQuarterPlan.topFocuses}
            onChange={next => saveQuarterlyPlan({ ...activeQuarterPlan, topFocuses: next })}
            accent="cyan"
            title={`Top 3 Focuses • ${qInfo.quarterKey}`}
          />
        </div>

        {/* Quarterly Outcomes (Model A: Parent Link + KPI Proof + Monthly Step Decomposition & Roll-up) */}
        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate-200">
                Quarterly Outcomes ({activeQuarterPlan.tasks.length})
              </span>
              <p className="text-[11px] text-slate-400">
                Give each outcome a measurable KPI proof check and break it into concrete Monthly steps — never tracked daily, verified at review.
              </p>
            </div>
            {stepNotice && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                ✓ {stepNotice}
              </span>
            )}
          </div>

          {activeQuarterPlan.tasks.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-xs text-slate-500 text-center">
              No quarterly outcomes defined yet for {qInfo.quarterKey}. Add 3–5 concrete outcomes below.
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeQuarterPlan.tasks.map(task => {
                const monthlySteps = getMonthlyChildrenOfQuarterlyTask(
                  task.id,
                  qInfo.quarterKey,
                  monthlyPlans
                );
                return (
                  <HierarchyOutcomeCard
                    key={task.id}
                    task={task}
                    accent="cyan"
                    parentOptions={parentOptions}
                    selectedParentValue={encodeTaskParent(task)}
                    onChangeParent={val => handleUpdateOutcome(task.id, decodeParentPatch(val))}
                    childrenSteps={monthlySteps}
                    childUnitLabel="Monthly"
                    childPeriodOptions={childMonthOptions}
                    defaultChildPeriodKey={defaultChildMonth}
                    onSpawnChildStep={(mKey, text, kpi) =>
                      handleSpawnMonthlyStep(task, mKey, text, kpi)
                    }
                    onJumpToChildPeriod={jumpToMonth}
                    onToggleComplete={() =>
                      handleUpdateOutcome(task.id, { completed: !task.completed })
                    }
                    onEditText={text => handleUpdateOutcome(task.id, { text })}
                    onUpdateFields={patch => handleUpdateOutcome(task.id, patch)}
                    onDelete={() => handleDeleteOutcome(task.id)}
                  />
                );
              })}
            </div>
          )}

          {/* Add Quarterly Outcome (with optional Parent Link + KPI Proof) */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleAddOutcome();
            }}
            className="p-3 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 focus-within:border-cyan-500/50 transition-colors space-y-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Plus className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                value={newOutcomeInput}
                onChange={e => setNewOutcomeInput(e.target.value)}
                placeholder="Add a concrete 90-day outcome and press Enter..."
                className="flex-1 min-w-[200px] bg-transparent text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
              />
              {parentOptions.length > 0 && (
                <select
                  value={newOutcomeParent}
                  onChange={e => setNewOutcomeParent(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] font-semibold text-cyan-300 focus:outline-none max-w-[200px]"
                >
                  <option value="">Parent (optional)...</option>
                  {parentOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      ↑ {opt.label}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                disabled={!newOutcomeInput.trim()}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-40 text-cyan-300 border border-cyan-500/30 text-xs font-bold shrink-0"
              >
                + Add
              </button>
            </div>
            <input
              type="text"
              value={newOutcomeKpi}
              onChange={e => setNewOutcomeKpi(e.target.value)}
              placeholder="Optional measurable KPI proof (e.g. 60 green demo days, 5 clients signed)..."
              className="w-full pl-6 bg-transparent text-[11px] text-emerald-300/90 placeholder-slate-600 focus:outline-none"
            />
          </form>
        </div>

        {/* Target Roadmap Gates for this Quarter */}
        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                <Compass className="w-3.5 h-3.5" />
                <span>Target Roadmap Gates ({targetGateRefs.length} committed)</span>
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Committed gates automatically appear inside {qInfo.quarterKey}&apos;s Monthly Plans and Weekly Plans so Roadmaps stay locked to your calendar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPlanningSubTab('roadmaps')}
              className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 shrink-0"
            >
              Open Roadmaps →
            </button>
          </div>

          {activeStrategyPlans.length === 0 ? (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-500">
              No active Written Roadmaps yet. Create or promote one in Planning Hub → Roadmaps to link gates here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeStrategyPlans.map(plan => {
                const activeStage = plan.stages.find(s => !s.gatePassed) || plan.stages[plan.stages.length - 1];
                if (!activeStage) return null;
                const isTargeted = targetGateRefs.some(
                  r => r.planId === plan.id && r.stageId === activeStage.id
                );
                const passedCount = plan.stages.filter(s => s.gatePassed).length;
                const doneProximal = activeStage.proximalGoals.filter(g => g.completed).length;
                const isSchedulingHere = gateStepTargetId === `${plan.id}|${activeStage.id}`;

                return (
                  <div
                    key={plan.id}
                    className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                      isTargeted
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {plan.priority && (
                          <span
                            className={`shrink-0 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${STRATEGY_PRIORITY_META[plan.priority].badgeCls}`}
                            title={`${STRATEGY_PRIORITY_META[plan.priority].code} · ${STRATEGY_PRIORITY_META[plan.priority].label}`}
                          >
                            {STRATEGY_PRIORITY_META[plan.priority].code}
                          </span>
                        )}
                        <span className="font-extrabold text-xs text-slate-100 truncate">
                          {plan.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isTargeted && (
                          <button
                            type="button"
                            onClick={() => {
                              setGateStepMonth(defaultChildMonth);
                              setGateStepTargetId(
                                isSchedulingHere ? null : `${plan.id}|${activeStage.id}`
                              );
                            }}
                            className="px-2 py-0.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/35 text-[10px] font-bold"
                          >
                            + Month Step
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleTargetGate({ planId: plan.id, stageId: activeStage.id })}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono transition-colors ${
                            isTargeted
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {isTargeted ? '✓ Target Gate' : `Commit (${passedCount}/${plan.stages.length})`}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-amber-300">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        {activeStage.gatePassed ? (
                          <Unlock className="w-3 h-3 text-emerald-400 shrink-0" />
                        ) : (
                          <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                        )}
                        <span className="truncate">{activeStage.title}</span>
                      </div>
                      {activeStage.proximalGoals.length > 0 && (
                        <span className="font-mono text-[10px] text-slate-400 shrink-0">
                          {doneProximal}/{activeStage.proximalGoals.length} proximal
                        </span>
                      )}
                    </div>

                    {activeStage.gateCriterion.trim() && (
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Gate Proof: {activeStage.gateCriterion.trim()}
                      </p>
                    )}

                    {isSchedulingHere && (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5">
                        <select
                          value={gateStepMonth || defaultChildMonth}
                          onChange={e => setGateStepMonth(e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono font-bold text-purple-300 focus:outline-none"
                        >
                          {childMonthOptions.map(m => (
                            <option key={m.key} value={m.key}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={gateStepDraft}
                          onChange={e => setGateStepDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSpawnGateMonthlyStep(plan.id, activeStage.id, plan.title);
                            }
                          }}
                          placeholder="Concrete step for this month..."
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-100 placeholder-slate-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSpawnGateMonthlyStep(plan.id, activeStage.id, plan.title)}
                          disabled={!gateStepDraft.trim()}
                          className="px-2.5 py-1 rounded-lg bg-purple-500 text-slate-950 disabled:opacity-40 text-[10px] font-extrabold"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LOOKING DOWN: Live 3-Month Strip Inside This Quarter */}
        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-purple-400 flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Months Executing {qInfo.quarterKey}</span>
            </span>
            <span className="text-[11px] text-slate-500">Click any month to zoom in</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {quarterMonths.map(mKey => {
              const mInfo = getMonthInfo(mKey);
              const mp = monthlyPlans[mKey];
              const tasks = (mp?.tasks || []).filter(t => t.status !== 'parked');
              const done = tasks.filter(t => t.completed).length;
              const linkedToQ = tasks.filter(t => Boolean(t.quarterlyTaskId || t.strategyPlanId)).length;
              return (
                <button
                  key={mKey}
                  type="button"
                  onClick={() => jumpToMonth(mKey)}
                  className="p-3.5 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/40 text-left transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-purple-300">{mInfo.label}</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 font-mono text-[10px] font-bold text-slate-300">
                      {done}/{tasks.length} done
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 truncate">
                    {mp?.focusTheme?.trim() || 'No focus theme set yet'}
                  </p>
                  <div className="text-[10px] font-mono text-slate-500">
                    {linkedToQ > 0 ? `${linkedToQ} linked to ${qInfo.quarterKey}/Roadmaps` : 'Open Monthly Plan →'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Real-World Scoreboard (Start Baseline -> 90-Day Target) */}
        <div className="pt-4 border-t border-slate-800/80">
          <ScoreboardEditor
            metrics={activeQuarterPlan.scoreboard || []}
            onChange={next => saveQuarterlyPlan({ ...activeQuarterPlan, scoreboard: next })}
            showActual={false}
            accent="cyan"
            title={`Real-World KPIs (${qInfo.quarterKey} Baseline → Target)`}
            subtitle="Period-level proof checks — set once at start, check Actual at end-of-quarter review (never measured daily)."
          />
        </div>

        {/* Quarterly Strategy & Notes */}
        <div className="space-y-1.5 pt-4 border-t border-slate-800/80">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Quarterly Strategy, Constraints &amp; Operating Rules
          </label>
          <textarea
            rows={4}
            value={activeQuarterPlan.notes}
            onChange={e => saveQuarterlyPlan({ ...activeQuarterPlan, notes: e.target.value })}
            placeholder="Key hypotheses you are testing this quarter, boundaries/what you won't do, and systems to build..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded-2xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed resize-y"
          />
        </div>
      </div>
    </div>
  );
};
