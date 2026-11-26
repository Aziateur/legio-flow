import React, { useState } from 'react';
import { OutcomeRootCause, ParkReasonTag, TaskItem } from '../../types/schema';
import { LinkedChildStep } from '../../lib/planHierarchy';
import { PARK_REASON_META, getMissCauseMeta } from '../../lib/energyAnalytics';
import {
  ArrowDownToLine,
  CheckCircle2,
  Circle,
  CornerDownRight,
  Crosshair,
  Gauge,
  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
  ArrowUpRight,
  ArrowRight
} from 'lucide-react';

export interface ParentLinkOption {
  value: string; // Encoded link key e.g. "yearly:id" | "quarterly:id" | "roadmap:planId|stageId"
  label: string;
  group: string;
}

export interface ChildPeriodOption {
  key: string;
  label: string;
}

interface HierarchyOutcomeCardProps {
  task: TaskItem;
  accent: 'rose' | 'cyan' | 'purple';
  parentOptions?: ParentLinkOption[];
  selectedParentValue?: string;
  fallbackParentLabel?: string | null;
  onChangeParent?: (encodedValue: string) => void;
  childrenSteps: LinkedChildStep[];
  childUnitLabel: string; // e.g. 'Quarterly', 'Monthly', 'Weekly'
  childPeriodOptions: ChildPeriodOption[];
  defaultChildPeriodKey: string;
  onSpawnChildStep: (childPeriodKey: string, text: string, kpiTarget?: string) => void;
  onJumpToChildPeriod?: (childPeriodKey: string) => void;
  onToggleComplete: () => void;
  onEditText: (nextText: string) => void;
  onUpdateFields: (patch: Partial<TaskItem>) => void;
  onDelete: () => void;
  nextPeriodLabel?: string;
  onPushToNextPeriod?: () => void;
  carriedDiagnosis?: { cause?: OutcomeRootCause; note?: string } | null;
  onToggleSubTask?: (subId: string) => void;
  onDeleteSubTask?: (subId: string) => void;
  assignedRoadmapTitle?: string;
  unpulledRoadmapGoals?: Array<{ id: string; text: string; completed: boolean }>;
  onPullRoadmapGoal?: (goal: { id: string; text: string; completed: boolean }) => void;
}

export const HierarchyOutcomeCard: React.FC<HierarchyOutcomeCardProps> = ({
  task,
  accent,
  parentOptions = [],
  selectedParentValue = '',
  fallbackParentLabel,
  onChangeParent,
  childrenSteps,
  childUnitLabel,
  childPeriodOptions,
  defaultChildPeriodKey,
  onSpawnChildStep,
  onJumpToChildPeriod,
  onToggleComplete,
  onEditText,
  onUpdateFields,
  onDelete,
  nextPeriodLabel,
  onPushToNextPeriod,
  carriedDiagnosis,
  onToggleSubTask,
  onDeleteSubTask,
  assignedRoadmapTitle,
  unpulledRoadmapGoals = [],
  onPullRoadmapGoal
}) => {
  const [showKpiEditor, setShowKpiEditor] = useState(Boolean(task.kpiTarget?.trim()));
  const [showDecompose, setShowDecompose] = useState(false);
  const [showParkReasonEditor, setShowParkReasonEditor] = useState(false);
  const [targetChildKey, setTargetChildKey] = useState(defaultChildPeriodKey);
  const [stepDraft, setStepDraft] = useState('');
  const [stepKpiDraft, setStepKpiDraft] = useState('');

  const isParked = task.status === 'parked';
  const activeChildren = childrenSteps.filter(c => c.task.status !== 'parked');
  const doneChildren = activeChildren.filter(c => c.task.completed).length;
  const totalChildren = activeChildren.length;
  const rollupPct = totalChildren > 0 ? Math.round((doneChildren / totalChildren) * 100) : 0;

  const accentHoverCheck =
    accent === 'rose'
      ? 'hover:text-rose-400'
      : accent === 'cyan'
      ? 'hover:text-cyan-400'
      : 'hover:text-purple-400';

  const accentBtn =
    accent === 'rose'
      ? 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
      : accent === 'cyan'
      ? 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/30'
      : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30';

  const accentBar =
    accent === 'rose'
      ? 'bg-cyan-400'
      : accent === 'cyan'
      ? 'bg-purple-400'
      : 'bg-amber-400';

  const handleCreateStep = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = stepDraft.trim();
    if (!clean) return;
    const periodKey = targetChildKey || defaultChildPeriodKey || childPeriodOptions[0]?.key;
    if (!periodKey) return;
    onSpawnChildStep(periodKey, clean, stepKpiDraft.trim() || undefined);
    setStepDraft('');
    setStepKpiDraft('');
    setShowDecompose(false);
  };

  // Group parent options cleanly for <optgroup>
  const groupedParents = parentOptions.reduce<Record<string, ParentLinkOption[]>>((acc, opt) => {
    if (!acc[opt.group]) acc[opt.group] = [];
    acc[opt.group].push(opt);
    return acc;
  }, {});

  return (
    <div
      className={`group rounded-2xl border p-3.5 sm:p-4 space-y-2.5 transition-all ${
        task.completed
          ? 'bg-emerald-500/5 border-emerald-500/25'
          : isParked
          ? 'bg-slate-950/40 border-slate-800/70 opacity-70'
          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Top Row: Complete + Title + Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onToggleComplete}
            className="shrink-0 transition-transform active:scale-90"
            title={task.completed ? 'Mark incomplete' : 'Verify outcome done'}
          >
            {task.completed ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <Circle className={`w-5 h-5 text-slate-600 ${accentHoverCheck}`} />
            )}
          </button>

          <input
            type="text"
            value={task.text}
            onChange={e => onEditText(e.target.value)}
            className={`w-full bg-transparent text-xs sm:text-sm font-semibold focus:outline-none ${
              task.completed
                ? 'line-through text-slate-500'
                : isParked
                ? 'italic text-slate-400'
                : 'text-slate-100'
            }`}
          />

          {isParked && (
            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold uppercase shrink-0">
              Parked
            </span>
          )}
          {task.pushedFromPeriod && !task.completed && (() => {
            const causeMeta = carriedDiagnosis?.cause
              ? getMissCauseMeta(carriedDiagnosis.cause)
              : undefined;
            const diagTitle = carriedDiagnosis?.note
              ? `Pushed from ${task.pushedFromPeriod} — ${causeMeta?.label || 'Note'}: ${carriedDiagnosis.note}`
              : causeMeta
              ? `Pushed from ${task.pushedFromPeriod} — Prior miss: ${causeMeta.label}`
              : `Pushed forward from ${task.pushedFromPeriod}`;
            return (
              <span
                className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${
                  causeMeta
                    ? causeMeta.badgeCls
                    : 'bg-slate-900 text-slate-400 border-slate-800 font-mono'
                }`}
                title={diagTitle}
              >
                From {task.pushedFromPeriod}
                {causeMeta ? ` · ${causeMeta.shortLabel}` : ''}
              </span>
            );
          })()}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end sm:self-center">
          {!task.completed && !isParked && (
            task.pushedToPeriod ? (
              <span
                className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/35 text-[10px] font-bold"
                title={`Marked Not Done here & pushed to ${task.pushedToPeriod}. Diagnose why in Review.`}
              >
                <span>Not Done · → {task.pushedToPeriod}</span>
              </span>
            ) : (
              onPushToNextPeriod && (
                <button
                  type="button"
                  onClick={onPushToNextPeriod}
                  className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-500/15 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/35 text-[11px] font-bold transition-colors"
                  title={`Push to ${nextPeriodLabel || 'next period'} & keep marked Not Done here for Review diagnosis`}
                >
                  <span>{nextPeriodLabel || 'Next'}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )
            )
          )}

          <button
            type="button"
            onClick={() => setShowKpiEditor(v => !v)}
            className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
              task.kpiTarget?.trim()
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
            title="Set measurable KPI / proof check (verified at review time — never tracked daily)"
          >
            <Gauge className="w-3 h-3" />
            <span>{task.kpiTarget?.trim() ? 'KPI' : '+ KPI'}</span>
          </button>

          {childPeriodOptions.length > 0 && !isParked && (
            <button
              type="button"
              onClick={() => {
                setTargetChildKey(defaultChildPeriodKey);
                setShowDecompose(v => !v);
              }}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${accentBtn}`}
              title={`Break this down into a smaller ${childUnitLabel.toLowerCase()} step`}
            >
              <Plus className="w-3 h-3" />
              <span>{childUnitLabel} Step</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (isParked) {
                onUpdateFields({ status: 'active' });
                setShowParkReasonEditor(false);
              } else {
                const now = new Date();
                const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
                  now.getDate()
                ).padStart(2, '0')}`;
                onUpdateFields({
                  status: 'parked',
                  parkedAt: task.parkedAt || localToday
                });
                setShowParkReasonEditor(true);
              }
            }}
            className={`p-1.5 rounded-lg border transition-colors ${
              isParked
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25'
                : 'bg-slate-900 text-slate-500 hover:text-amber-300 border-slate-800'
            }`}
            title={
              isParked
                ? 'Resume outcome'
                : 'Park outcome (logs why for future-you — stops gap warnings without deleting history)'
            }
          >
            {isParked ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete outcome"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pivot / Park Memory Strip (5-sec tag + 1-line why — kills disguised quitting & forgotten dead loops) */}
      {isParked && (showParkReasonEditor ? (
        <div className="pl-8 p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2 text-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
              Why parked? (5-sec memory for future-you)
            </span>
            <button
              type="button"
              onClick={() => setShowParkReasonEditor(false)}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-200"
            >
              Done
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['reality_shift', 'disproved', 'deferred'] as ParkReasonTag[]).map(tag => {
              const meta = PARK_REASON_META[tag];
              const active = task.parkedReasonTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onUpdateFields({ parkedReasonTag: tag })}
                  title={meta.hint}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-colors ${
                    active
                      ? meta.activeCls
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={task.parkedReasonNote || ''}
            onChange={e => onUpdateFields({ parkedReasonNote: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Enter') setShowParkReasonEditor(false);
            }}
            placeholder="Optional 1-line reason (e.g. 'Cold outreach <1% reply rate, switching to referrals')..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/40 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
          />
        </div>
      ) : (
        <div className="pl-8 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {task.parkedReasonTag && (
            <span
              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                PARK_REASON_META[task.parkedReasonTag].badgeCls
              }`}
            >
              {PARK_REASON_META[task.parkedReasonTag].label}
            </span>
          )}
          {task.parkedAt && (
            <span className="font-mono text-[10px] text-slate-500">{task.parkedAt}</span>
          )}
          {task.parkedReasonNote?.trim() ? (
            <span className="italic text-slate-300">&ldquo;{task.parkedReasonNote.trim()}&rdquo;</span>
          ) : (
            <span className="text-slate-500">No park reason logged</span>
          )}
          <button
            type="button"
            onClick={() => setShowParkReasonEditor(true)}
            className="text-[10px] font-bold text-amber-400/80 hover:text-amber-300 underline"
          >
            {task.parkedReasonTag || task.parkedReasonNote?.trim() ? 'Edit reason' : '+ Why parked?'}
          </button>
        </div>
      ))}

      {/* Carried-Forward Diagnosis Note (when user wrote why this missed last period) */}
      {!task.completed && carriedDiagnosis?.note && (
        <div className="pl-8 text-[11px] text-amber-300/90 italic">
          ↳ Last miss note: &ldquo;{carriedDiagnosis.note}&rdquo;
        </div>
      )}

      {/* Parent Alignment Selector + KPI Proof Check */}
      {(parentOptions.length > 0 || Boolean(selectedParentValue) || showKpiEditor || task.kpiTarget?.trim()) && (
        <div className="pl-8 flex flex-wrap items-center gap-2 text-[11px]">
          {(parentOptions.length > 0 || Boolean(selectedParentValue)) && onChangeParent && (
            <div className="inline-flex items-center space-x-1">
              <ArrowUpRight className="w-3 h-3 text-slate-500 shrink-0" />
              <select
                value={selectedParentValue}
                onChange={e => onChangeParent(e.target.value)}
                className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold focus:outline-none max-w-[280px] cursor-pointer ${
                  selectedParentValue.startsWith('roadmap:') || selectedParentValue.startsWith('gate:')
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                    : selectedParentValue
                    ? 'bg-slate-900 text-cyan-300 border-cyan-500/30'
                    : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
                title="Assign to an Active Roadmap (pulled proximal goals land inside) or parent outcome"
              >
                <option value="" className="bg-slate-950 text-slate-400">
                  Assign Roadmap / Parent (optional)
                </option>
                {fallbackParentLabel && selectedParentValue && (
                  <option value={selectedParentValue} className="bg-slate-950 text-amber-300">
                    🗺 {fallbackParentLabel}
                  </option>
                )}
                {Object.entries(groupedParents).map(([group, opts]) => (
                  <optgroup key={group} label={group} className="bg-slate-950 text-slate-300">
                    {opts.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-slate-950 text-slate-200">
                        {opt.value.startsWith('roadmap:') || opt.value.startsWith('gate:') ? '🗺 ' : '↑ '}
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {(showKpiEditor || task.kpiTarget?.trim()) && (
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-[220px]">
              <div className="inline-flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 focus-within:border-emerald-500/40 rounded-lg px-2 py-0.5 flex-1 min-w-[180px] max-w-md">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 shrink-0">
                  KPI Proof:
                </span>
                <input
                  type="text"
                  value={task.kpiTarget || ''}
                  onChange={e => onUpdateFields({ kpiTarget: e.target.value })}
                  placeholder="e.g. 100 backtests, 5 paying clients, 12% BF..."
                  className="flex-1 min-w-0 bg-transparent text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              </div>

              {(task.completed || task.kpiActual?.trim()) && (
                <div className="inline-flex items-center space-x-1.5 bg-slate-900/90 border border-emerald-500/30 rounded-lg px-2 py-0.5 min-w-[140px]">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 shrink-0">
                    Actual:
                  </span>
                  <input
                    type="text"
                    value={task.kpiActual || ''}
                    onChange={e => onUpdateFields({ kpiActual: e.target.value })}
                    placeholder="Verified result..."
                    className="w-28 bg-transparent text-[11px] font-mono text-emerald-200 placeholder-slate-600 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Nested Roadmap Proximal Milestones / Sub-Items inside this Outcome */}
      {((task.subTasks && task.subTasks.length > 0) ||
        (assignedRoadmapTitle && unpulledRoadmapGoals.length > 0 && onPullRoadmapGoal)) && (
        <div className="pl-8 space-y-1.5">
          {task.subTasks && task.subTasks.length > 0 && (
            <div className="space-y-1">
              {task.subTasks.map(sub => (
                <div
                  key={sub.id}
                  className="group/sub flex items-center justify-between gap-2 px-2.5 py-1 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onToggleSubTask && onToggleSubTask(sub.id)}
                      className="shrink-0"
                    >
                      {sub.completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-600 hover:text-amber-400" />
                      )}
                    </button>
                    <span
                      className={`truncate ${
                        sub.completed ? 'line-through text-slate-500' : 'text-slate-200'
                      }`}
                    >
                      {sub.text}
                    </span>
                    {sub.strategyGoalId && (
                      <span
                        title="Synced with Roadmap Proximal Goal"
                        className="shrink-0 text-rose-400/80"
                      >
                        <Crosshair className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  {onDeleteSubTask && (
                    <button
                      type="button"
                      onClick={() => onDeleteSubTask(sub.id)}
                      className="p-0.5 text-slate-600 hover:text-rose-400 opacity-0 group-hover/sub:opacity-100 transition-opacity shrink-0"
                      title="Remove milestone"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {assignedRoadmapTitle && unpulledRoadmapGoals.length > 0 && onPullRoadmapGoal && !isParked && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-400/80 shrink-0">
                <Crosshair className="w-2.5 h-2.5 text-rose-400" />
                <span>Pull from {assignedRoadmapTitle}:</span>
              </span>
              {unpulledRoadmapGoals.map(pg => (
                <button
                  key={pg.id}
                  type="button"
                  onClick={() => onPullRoadmapGoal(pg)}
                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-amber-500/15 text-slate-300 hover:text-amber-200 border border-slate-800 hover:border-amber-500/35 text-[10px] font-semibold transition-colors"
                  title={`Pull "${pg.text}" inside "${task.text}"`}
                >
                  <ArrowDownToLine className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  <span className="truncate max-w-[220px]">{pg.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live Child Steps Roll-Up (True Parent -> Child Progress, NEVER auto-closes parent) */}
      <div className="pl-8 space-y-1.5">
        {childrenSteps.length > 0 ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center space-x-1 font-mono font-bold text-slate-300">
                <CornerDownRight className="w-3 h-3 text-slate-500" />
                <span>
                  {doneChildren}/{totalChildren} {childUnitLabel.toLowerCase()} steps done ({rollupPct}%)
                </span>
              </span>
              <div className="w-24 h-1.5 rounded-full bg-slate-900 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    rollupPct === 100 ? 'bg-emerald-400' : accentBar
                  }`}
                  style={{ width: `${rollupPct}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {childrenSteps.map(ch => (
                <button
                  key={`${ch.periodKey}_${ch.task.id}`}
                  type="button"
                  onClick={() => onJumpToChildPeriod && onJumpToChildPeriod(ch.periodKey)}
                  className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg border text-[11px] transition-colors ${
                    ch.task.completed
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25 line-through'
                      : ch.task.status === 'parked'
                      ? 'bg-slate-900/50 text-slate-500 border-slate-800 italic'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
                  }`}
                  title={`Open ${ch.periodLabel}: ${ch.task.text}`}
                >
                  <span className="font-mono text-[10px] font-extrabold text-amber-400">
                    {ch.periodLabel}
                  </span>
                  <span className="truncate max-w-[200px]">{ch.task.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          !task.completed &&
          !isParked &&
          childPeriodOptions.length > 0 && (
            <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
              <CornerDownRight className="w-3 h-3 text-slate-600" />
              <span>No {childUnitLabel.toLowerCase()} steps planned yet</span>
            </div>
          )
        )}
      </div>

      {/* Inline Break-Down Composer (Creates a true smaller step in the child timeframe!) */}
      {showDecompose && childPeriodOptions.length > 0 && (
        <form
          onSubmit={handleCreateStep}
          className="ml-8 p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={targetChildKey}
              onChange={e => setTargetChildKey(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono text-amber-300 focus:outline-none"
            >
              {childPeriodOptions.map(opt => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              autoFocus
              value={stepDraft}
              onChange={e => setStepDraft(e.target.value)}
              placeholder={`Write concrete ${childUnitLabel.toLowerCase()} step that moves "${task.text.slice(0, 36)}" forward...`}
              className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!stepDraft.trim()}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-extrabold"
            >
              + Add Step
            </button>

            <button
              type="button"
              onClick={() => setShowDecompose(false)}
              className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>

          <input
            type="text"
            value={stepKpiDraft}
            onChange={e => setStepKpiDraft(e.target.value)}
            placeholder="Optional KPI proof for this step (e.g. 50 backtests, 10 demos booked)..."
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none"
          />
        </form>
      )}
    </div>
  );
};
