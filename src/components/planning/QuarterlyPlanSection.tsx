import React, { useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { TaskItem, TargetGateRef } from '../../types/schema';
import { getQuarterInfo, shiftQuarterKey } from '../../lib/macroAnalytics';
import { ScoreboardEditor } from '../common/ScoreboardEditor';
import { TopFocusesEditor } from '../common/TopFocusesEditor';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ArrowDownToLine,
  Compass,
  ExternalLink,
  Lock,
  Unlock
} from 'lucide-react';

interface QuarterlyPlanSectionProps {
  selectedQuarterKey: string;
  setSelectedQuarterKey: (qKey: string) => void;
  selectedMonthKey: string;
  activeWeeklyPlanId?: string;
  activeWeeklyPlanNumber?: number;
  isGoalInMonthlyPlan: (text: string, links?: { quarterlyTaskId?: string; yearlyTaskId?: string }) => boolean;
  isGoalInWeeklyPlan: (text: string, links?: { monthlyTaskId?: string; quarterlyTaskId?: string; yearlyTaskId?: string }) => boolean;
  onPullToMonth: (text: string, links?: { quarterlyTaskId?: string; yearlyTaskId?: string }) => void;
  onPullToWeek: (text: string, links?: { monthlyTaskId?: string; quarterlyTaskId?: string; yearlyTaskId?: string }) => void;
}

export const QuarterlyPlanSection: React.FC<QuarterlyPlanSectionProps> = ({
  selectedQuarterKey,
  setSelectedQuarterKey,
  selectedMonthKey,
  activeWeeklyPlanNumber,
  isGoalInMonthlyPlan,
  isGoalInWeeklyPlan,
  onPullToMonth,
  onPullToWeek
}) => {
  const {
    quarterlyPlans,
    getQuarterlyPlan,
    saveQuarterlyPlan,
    getYearlyPlan,
    strategyPlans,
    todayDate,
    selectedDate,
    setActiveTab,
    setPlanningSubTab,
    setReviewSubTab
  } = useStorage();

  const [newOutcomeInput, setNewOutcomeInput] = useState('');
  const [showPullFromYearly, setShowPullFromYearly] = useState(false);

  const qInfo = getQuarterInfo(selectedQuarterKey);
  const activeQuarterPlan = getQuarterlyPlan(selectedQuarterKey);
  const linkedYearPlan = getYearlyPlan(String(qInfo.year));

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

  const doneCount = activeQuarterPlan.tasks.filter(t => t.completed).length;
  const targetGateRefs = activeQuarterPlan.targetGateRefs || [];

  const handleAddOutcome = () => {
    const trimmed = newOutcomeInput.trim();
    if (!trimmed) return;
    const nextTask: TaskItem = {
      id: `qgoal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      completed: false
    };
    saveQuarterlyPlan({
      ...activeQuarterPlan,
      tasks: [...activeQuarterPlan.tasks, nextTask]
    });
    setNewOutcomeInput('');
  };

  const handleToggleOutcome = (id: string) => {
    saveQuarterlyPlan({
      ...activeQuarterPlan,
      tasks: activeQuarterPlan.tasks.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
    });
  };

  const handleEditOutcome = (id: string, text: string) => {
    saveQuarterlyPlan({
      ...activeQuarterPlan,
      tasks: activeQuarterPlan.tasks.map(t => (t.id === id ? { ...t, text } : t))
    });
  };

  const handleDeleteOutcome = (id: string) => {
    saveQuarterlyPlan({
      ...activeQuarterPlan,
      tasks: activeQuarterPlan.tasks.filter(t => t.id !== id)
    });
  };

  const isYearlyGoalInQuarter = (text: string, yearlyTaskId: string) => {
    if (activeQuarterPlan.tasks.some(t => t.yearlyTaskId === yearlyTaskId)) return true;
    const norm = text.trim().toLowerCase();
    return !!norm && activeQuarterPlan.tasks.some(t => t.text.trim().toLowerCase() === norm);
  };

  const handlePullFromYearly = (text: string, yearlyTaskId: string) => {
    if (isYearlyGoalInQuarter(text, yearlyTaskId)) return;
    saveQuarterlyPlan({
      ...activeQuarterPlan,
      tasks: [
        ...activeQuarterPlan.tasks,
        {
          id: `qgoal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: text.trim(),
          completed: false,
          yearlyTaskId
        }
      ]
    });
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

  return (
    <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6">
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
            {doneCount} / {activeQuarterPlan.tasks.length} outcomes
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

        {/* Quarterly Outcomes Checklist */}
        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-300">
              Quarterly Outcomes ({activeQuarterPlan.tasks.length})
            </span>

            <div className="flex items-center space-x-2">
              {linkedYearPlan.tasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPullFromYearly(v => !v)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition-colors"
                >
                  <ArrowDownToLine className="w-3 h-3" />
                  <span>
                    {showPullFromYearly
                      ? 'Hide Yearly Goals'
                      : `Pull from ${qInfo.year} Yearly Plan (${linkedYearPlan.tasks.length})`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {showPullFromYearly && linkedYearPlan.tasks.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-rose-500/25 space-y-2">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">
                {qInfo.year} Yearly Objectives — click to commit to {qInfo.quarterKey}
              </div>
              <div className="flex flex-wrap gap-2">
                {linkedYearPlan.tasks.map(yt => {
                  const alreadyIn = isYearlyGoalInQuarter(yt.text, yt.id);
                  return (
                    <button
                      key={yt.id}
                      type="button"
                      disabled={alreadyIn}
                      onClick={() => handlePullFromYearly(yt.text, yt.id)}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                        alreadyIn
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 cursor-default'
                          : 'bg-slate-900 hover:bg-rose-500/15 text-slate-200 border-slate-800 hover:border-rose-500/40'
                      }`}
                    >
                      <span>{alreadyIn ? '✓' : '+'}</span>
                      <span>{yt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeQuarterPlan.tasks.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-xs text-slate-500 text-center">
              No quarterly outcomes defined yet for {qInfo.quarterKey}. Add 3–5 concrete outcomes below so your end-of-quarter review has a real contract to audit against.
            </div>
          ) : (
            <div className="space-y-2">
              {activeQuarterPlan.tasks.map(task => {
                const inMonth = isGoalInMonthlyPlan(task.text, {
                  quarterlyTaskId: task.id,
                  yearlyTaskId: task.yearlyTaskId
                });
                const inWeek = isGoalInWeeklyPlan(task.text, {
                  quarterlyTaskId: task.id,
                  yearlyTaskId: task.yearlyTaskId
                });
                return (
                  <div
                    key={task.id}
                    className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl border transition-all ${
                      task.completed
                        ? 'bg-emerald-500/5 border-emerald-500/25'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleOutcome(task.id)}
                        className="shrink-0 transition-transform active:scale-90"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-600 hover:text-cyan-400" />
                        )}
                      </button>

                      <input
                        type="text"
                        value={task.text}
                        onChange={e => handleEditOutcome(task.id, e.target.value)}
                        className={`w-full bg-transparent text-xs sm:text-sm font-medium focus:outline-none ${
                          task.completed ? 'line-through text-slate-500' : 'text-slate-100'
                        }`}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() =>
                          onPullToMonth(task.text, {
                            quarterlyTaskId: task.id,
                            yearlyTaskId: task.yearlyTaskId
                          })
                        }
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                          inMonth
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/35 hover:bg-purple-500/30'
                            : 'bg-slate-900 hover:bg-slate-800 text-purple-300 border-slate-800'
                        }`}
                      >
                        {!inMonth && <ArrowDownToLine className="w-3 h-3" />}
                        <span>{inMonth ? `✓ In ${selectedMonthKey}` : `+ Month (${selectedMonthKey.slice(5)})`}</span>
                      </button>

                      {activeWeeklyPlanNumber !== undefined && (
                        <button
                          type="button"
                          onClick={() =>
                            onPullToWeek(task.text, {
                              quarterlyTaskId: task.id,
                              yearlyTaskId: task.yearlyTaskId
                            })
                          }
                          className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                            inWeek
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-800'
                          }`}
                        >
                          {!inWeek && <ArrowDownToLine className="w-3 h-3" />}
                          <span>{inWeek ? `✓ In W${activeWeeklyPlanNumber}` : `+ Week ${activeWeeklyPlanNumber}`}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteOutcome(task.id)}
                        className="p-1 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete outcome"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Quarterly Outcome */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleAddOutcome();
            }}
            className="flex items-center space-x-2 p-3 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 focus-within:border-cyan-500/50 transition-colors"
          >
            <Plus className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              value={newOutcomeInput}
              onChange={e => setNewOutcomeInput(e.target.value)}
              placeholder="Add a concrete 90-day outcome and press Enter..."
              className="flex-1 bg-transparent text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newOutcomeInput.trim()}
              className="px-3 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-40 text-cyan-300 border border-cyan-500/30 text-xs font-bold"
            >
              + Add
            </button>
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
                Select which active Stage-Gate(s) from your Written Roadmaps you intend to pass during {qInfo.quarterKey}.
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

          {strategyPlans.length === 0 ? (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-500">
              No Written Roadmaps created yet. Create one in Planning Hub → Roadmaps to link gates here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {strategyPlans.map(plan => {
                const activeStage = plan.stages.find(s => !s.gatePassed) || plan.stages[plan.stages.length - 1];
                if (!activeStage) return null;
                const isTargeted = targetGateRefs.some(
                  r => r.planId === plan.id && r.stageId === activeStage.id
                );
                const passedCount = plan.stages.filter(s => s.gatePassed).length;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => toggleTargetGate({ planId: plan.id, stageId: activeStage.id })}
                    className={`p-3.5 rounded-2xl border text-left transition-all space-y-1.5 ${
                      isTargeted
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-xs text-slate-100 truncate">
                        {plan.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono shrink-0 ${
                          isTargeted
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {isTargeted ? '✓ Target Gate' : `${passedCount}/${plan.stages.length} gates`}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-amber-300">
                      {activeStage.gatePassed ? (
                        <Unlock className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate">{activeStage.title}</span>
                    </div>
                    {activeStage.gateCriterion.trim() && (
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Gate: {activeStage.gateCriterion.trim()}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Real-World Scoreboard (Start Baseline -> 90-Day Target) */}
        <div className="pt-4 border-t border-slate-800/80">
          <ScoreboardEditor
            metrics={activeQuarterPlan.scoreboard || []}
            onChange={next => saveQuarterlyPlan({ ...activeQuarterPlan, scoreboard: next })}
            showActual={false}
            accent="cyan"
            title={`Real-World Scoreboard (${qInfo.quarterKey} Baseline → Target)`}
            subtitle="Set your starting numbers today so your end-of-quarter review compares effort against actual external reality."
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
