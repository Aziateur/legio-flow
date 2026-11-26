import React, { useState, useEffect, useRef } from 'react';
import {
  useStorage,
  findBestWeeklyPlanForDate,
  computeWeeklyAchievedScore
} from '../../context/StorageContext';
import {
  ParkReasonTag,
  StrategyPlan,
  StrategyPlanPriority,
  StrategyStage,
  TaskItem
} from '../../types/schema';
import { getQuarterKeyForDate } from '../../lib/macroAnalytics';
import {
  STRATEGY_PRIORITIES,
  STRATEGY_PRIORITY_META,
  getActiveStageForPlan,
  getRoadmapStageBindings,
  getWeeklyGoalsAssignedToRoadmap,
  isActiveStrategyPlan,
  isPossibleStrategyPlan,
  isRoadmapItemInWeeklyPlan,
  pullRoadmapItemIntoWeeklyPlan,
  sortStrategyPlansByPriority
} from '../../lib/planHierarchy';
import { PARK_REASON_META } from '../../lib/energyAnalytics';
import { daysBetweenDates, normalizeTag } from '../../lib/problems';
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
  Pencil,
  Sparkles,
  ArrowUpRight,
  Zap,
  Ban,
  Archive
} from 'lucide-react';

const POSSIBLE_BOARD_ID = '__possible_roadmaps__';

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

const createDefaultStages = (base: number): StrategyStage[] => [
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
];

const createNewPlanTemplate = (count: number): StrategyPlan => {
  const now = new Date().toISOString();
  const base = Date.now();
  return {
    id: `plan_${base}_${Math.random().toString(36).slice(2, 6)}`,
    title: count === 0 ? 'Master Strategy Plan' : `New Strategy Plan ${count + 1}`,
    description: 'Written stage-gate roadmap from setup to mastery.',
    priority: count === 0 ? 1 : 2,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    stages: createDefaultStages(base)
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
    monthlyPlans,
    getMonthlyPlan,
    saveMonthlyPlan,
    quarterlyPlans,
    getQuarterlyPlan,
    saveQuarterlyPlan,
    problems,
    setPlanningSubTab
  } = useStorage();

  const activePlans = sortStrategyPlansByPriority(strategyPlans.filter(isActiveStrategyPlan));
  const possiblePlans = sortStrategyPlansByPriority(strategyPlans.filter(isPossibleStrategyPlan));
  const promotablePlans = possiblePlans.filter(p => p.status === 'possible');
  const shelvedPlans = possiblePlans.filter(p => p.status === 'not_pursuing');

  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    const firstActive = sortStrategyPlansByPriority(strategyPlans.filter(isActiveStrategyPlan))[0];
    if (firstActive) return firstActive.id;
    if (strategyPlans.some(isPossibleStrategyPlan)) return POSSIBLE_BOARD_ID;
    return '';
  });
  const [possibleFilter, setPossibleFilter] = useState<'all' | 'possible' | 'not_pursuing'>('all');
  const [newPossibleTitle, setNewPossibleTitle] = useState('');
  const [newPossibleStatus, setNewPossibleStatus] = useState<'possible' | 'not_pursuing'>('possible');
  const [newPossiblePriority, setNewPossiblePriority] = useState<StrategyPlanPriority>(2);
  const [newPossibleActivation, setNewPossibleActivation] = useState('');
  const [newPossibleDescription, setNewPossibleDescription] = useState('');
  const [highlightedPossibleId, setHighlightedPossibleId] = useState<string | null>(null);
  const [copiedPossibleMd, setCopiedPossibleMd] = useState(false);
  const [editingActiveParam, setEditingActiveParam] = useState(false);
  const newPossibleInputRef = useRef<HTMLInputElement | null>(null);

  const [collapsedStageIds, setCollapsedStageIds] = useState<Record<string, boolean>>({});
  const [editLockedMode, setEditLockedMode] = useState<boolean>(false);
  const [goalDrafts, setGoalDrafts] = useState<Record<string, string>>({});
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [pullTargetWeekId, setPullTargetWeekId] = useState<string>('');
  const [pullTargetGoalByWeekPlan, setPullTargetGoalByWeekPlan] = useState<Record<string, string>>({});
  const [pullNotice, setPullNotice] = useState<string | null>(null);
  const [showPivotDrawer, setShowPivotDrawer] = useState(false);
  const [pivotTag, setPivotTag] = useState<ParkReasonTag>('reality_shift');
  const [pivotNote, setPivotNote] = useState('');
  const [pivotPauseStatus, setPivotPauseStatus] = useState(false);

  const isViewingPossibleBoard = selectedPlanId === POSSIBLE_BOARD_ID;

  useEffect(() => {
    if (selectedPlanId === POSSIBLE_BOARD_ID) return;
    if (activePlans.length === 0) {
      if (possiblePlans.length > 0) {
        setSelectedPlanId(POSSIBLE_BOARD_ID);
      } else {
        setSelectedPlanId('');
      }
    } else if (!activePlans.some(p => p.id === selectedPlanId)) {
      setSelectedPlanId(activePlans[0].id);
    }
  }, [strategyPlans, selectedPlanId]);

  const activePlan = isViewingPossibleBoard
    ? null
    : activePlans.find(p => p.id === selectedPlanId) || activePlans[0] || null;
  const sortedWeeklyPlans = Object.values(weeklyPlans).sort((a, b) => a.weekNumber - b.weekNumber);
  const defaultWeeklyPlan =
    findBestWeeklyPlanForDate(selectedDate, weeklyPlans, selectedWeekId) ||
    weeklyPlans[selectedWeekId] ||
    sortedWeeklyPlans[sortedWeeklyPlans.length - 1];
  const activeWeeklyPlan =
    (pullTargetWeekId && weeklyPlans[pullTargetWeekId]) || defaultWeeklyPlan;
  const activeMonthKey = selectedDate.slice(0, 7);
  const activeQuarterKey = getQuarterKeyForDate(selectedDate);
  const activeMonthPlan = getMonthlyPlan(activeMonthKey);
  const activeQuarterPlan = getQuarterlyPlan(activeQuarterKey);

  const handleCreatePlan = () => {
    const newPlan = createNewPlanTemplate(activePlans.length);
    saveStrategyPlan(newPlan);
    setSelectedPlanId(newPlan.id);
    setEditLockedMode(false);
  };

  const handleOpenPossibleBoard = (focusInput = false, presetStatus?: 'possible' | 'not_pursuing') => {
    setSelectedPlanId(POSSIBLE_BOARD_ID);
    if (presetStatus) setNewPossibleStatus(presetStatus);
    if (focusInput) {
      setTimeout(() => {
        newPossibleInputRef.current?.focus();
      }, 40);
    }
  };

  const handleJumpToPossibleCard = (planId: string) => {
    setSelectedPlanId(POSSIBLE_BOARD_ID);
    setPossibleFilter('all');
    setHighlightedPossibleId(planId);
    setTimeout(() => {
      document.getElementById(`possible_roadmap_${planId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 60);
    setTimeout(() => {
      setHighlightedPossibleId(prev => (prev === planId ? null : prev));
    }, 2200);
  };

  const handleAddPossiblePlan = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newPossibleTitle.trim();
    if (!title) return;
    const now = new Date().toISOString();
    const newPlan: StrategyPlan = {
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      description: newPossibleDescription.trim(),
      activationCondition: newPossibleActivation.trim(),
      priority: newPossiblePriority,
      status: newPossibleStatus,
      stages: [],
      createdAt: now,
      updatedAt: now
    };
    saveStrategyPlan(newPlan);
    setNewPossibleTitle('');
    setNewPossibleActivation('');
    setNewPossibleDescription('');
    setSelectedPlanId(POSSIBLE_BOARD_ID);
    setHighlightedPossibleId(newPlan.id);
    setTimeout(() => {
      setHighlightedPossibleId(prev => (prev === newPlan.id ? null : prev));
    }, 2000);
  };

  const handlePromoteToActive = (plan: StrategyPlan) => {
    const now = new Date().toISOString();
    const promoted: StrategyPlan = {
      ...plan,
      status: 'active',
      stages: plan.stages.length > 0 ? plan.stages : createDefaultStages(Date.now()),
      updatedAt: now
    };
    saveStrategyPlan(promoted);
    setSelectedPlanId(promoted.id);
    setEditLockedMode(false);
    setPullNotice(`Promoted "${promoted.title || 'Untitled Roadmap'}" to Active Roadmaps`);
    setTimeout(() => setPullNotice(null), 2800);
  };

  const handleDemoteActivePlan = (targetStatus: 'possible' | 'not_pursuing' = 'possible') => {
    if (!activePlan) return;
    saveStrategyPlan({
      ...activePlan,
      status: targetStatus,
      updatedAt: new Date().toISOString()
    });
    handleJumpToPossibleCard(activePlan.id);
  };

  const updatePlanById = (planId: string, patch: Partial<StrategyPlan>) => {
    const target = strategyPlans.find(p => p.id === planId);
    if (!target) return;
    saveStrategyPlan({ ...target, ...patch });
  };

  const handleDeletePlanById = (plan: StrategyPlan) => {
    if (!confirm(`Delete roadmap "${plan.title || 'Untitled Roadmap'}"? This cannot be undone.`)) {
      return;
    }
    deleteStrategyPlan(plan.id);
  };

  const handleCopyPossibleMarkdown = () => {
    const lines: string[] = ['# Possible Roadmaps', ''];
    if (promotablePlans.length > 0) {
      lines.push('## Can Promote to Active');
      promotablePlans.forEach(p => {
        const pTag = p.priority ? `[${STRATEGY_PRIORITY_META[p.priority].code}] ` : '';
        lines.push(`- ${pTag}**${p.title || 'Untitled'}**`);
        if (p.activationCondition?.trim()) {
          lines.push(`  - Activation Parameter: ${p.activationCondition.trim()}`);
        }
        if (p.description?.trim()) {
          lines.push(`  - Description: ${p.description.trim()}`);
        }
      });
      lines.push('');
    }
    if (shelvedPlans.length > 0) {
      lines.push("## Won't Activate (Shelved)");
      shelvedPlans.forEach(p => {
        const pTag = p.priority ? `[${STRATEGY_PRIORITY_META[p.priority].code}] ` : '';
        lines.push(`- ${pTag}**${p.title || 'Untitled'}**`);
        if (p.activationCondition?.trim()) {
          lines.push(`  - Activation Parameter: ${p.activationCondition.trim()}`);
        }
        if (p.description?.trim()) {
          lines.push(`  - Description: ${p.description.trim()}`);
        }
      });
      lines.push('');
    }
    navigator.clipboard.writeText(lines.join('\n').trim());
    setCopiedPossibleMd(true);
    setTimeout(() => setCopiedPossibleMd(false), 2200);
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
    const fallback = activePlans.find(p => p.id !== activePlan.id);
    deleteStrategyPlan(activePlan.id);
    setSelectedPlanId(fallback?.id || (possiblePlans.length > 0 ? POSSIBLE_BOARD_ID : ''));
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
    return isRoadmapItemInWeeklyPlan(activeWeeklyPlan, text, strategyGoalId);
  };

  const isGoalInActiveMonth = (text: string, strategyGoalId?: string): boolean => {
    if (strategyGoalId && activeMonthPlan.tasks.some(t => t.strategyGoalId === strategyGoalId)) {
      return true;
    }
    const norm = text.trim().toLowerCase();
    return !!norm && activeMonthPlan.tasks.some(t => t.text.trim().toLowerCase() === norm);
  };

  const isGoalInActiveQuarter = (text: string, strategyGoalId?: string): boolean => {
    if (strategyGoalId && activeQuarterPlan.tasks.some(t => t.strategyGoalId === strategyGoalId)) {
      return true;
    }
    const norm = text.trim().toLowerCase();
    return !!norm && activeQuarterPlan.tasks.some(t => t.text.trim().toLowerCase() === norm);
  };

  const handlePullGoalToMonth = (
    text: string,
    links?: {
      strategyPlanId?: string;
      strategyStageId?: string;
      strategyGoalId?: string;
      sourceLabel?: string;
      completed?: boolean;
    }
  ) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isGoalInActiveMonth(trimmed, links?.strategyGoalId)) {
      setPlanningSubTab('monthly');
      return;
    }
    saveMonthlyPlan({
      ...activeMonthPlan,
      tasks: [
        ...activeMonthPlan.tasks,
        {
          id: `mgoal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: trimmed,
          completed: Boolean(links?.completed),
          ...(links?.sourceLabel ? { sourceLabel: links.sourceLabel } : {}),
          ...(links?.strategyPlanId ? { strategyPlanId: links.strategyPlanId } : {}),
          ...(links?.strategyStageId ? { strategyStageId: links.strategyStageId } : {}),
          ...(links?.strategyGoalId ? { strategyGoalId: links.strategyGoalId } : {})
        }
      ]
    });
    setPullNotice(`Sent "${trimmed.slice(0, 32)}${trimmed.length > 32 ? '…' : ''}" to ${activeMonthKey} Monthly Plan`);
    setTimeout(() => setPullNotice(null), 2400);
  };

  const handlePullGoalToQuarter = (
    text: string,
    links?: {
      strategyPlanId?: string;
      strategyStageId?: string;
      strategyGoalId?: string;
      sourceLabel?: string;
      completed?: boolean;
    }
  ) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isGoalInActiveQuarter(trimmed, links?.strategyGoalId)) {
      setPlanningSubTab('quarterly');
      return;
    }
    saveQuarterlyPlan({
      ...activeQuarterPlan,
      tasks: [
        ...activeQuarterPlan.tasks,
        {
          id: `qgoal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: trimmed,
          completed: Boolean(links?.completed),
          ...(links?.sourceLabel ? { sourceLabel: links.sourceLabel } : {}),
          ...(links?.strategyPlanId ? { strategyPlanId: links.strategyPlanId } : {}),
          ...(links?.strategyStageId ? { strategyStageId: links.strategyStageId } : {}),
          ...(links?.strategyGoalId ? { strategyGoalId: links.strategyGoalId } : {})
        }
      ]
    });
    setPullNotice(`Sent "${trimmed.slice(0, 32)}${trimmed.length > 32 ? '…' : ''}" to ${activeQuarterKey} Quarterly Plan`);
    setTimeout(() => setPullNotice(null), 2400);
  };

  const resolveTargetWeeklyGoalId = (planId?: string, stageId?: string): string | '__new__' | undefined => {
    if (!activeWeeklyPlan || !planId) return undefined;
    const key = `${activeWeeklyPlan.id}:${planId}`;
    const explicit = pullTargetGoalByWeekPlan[key];
    if (explicit === '__new__') return '__new__';
    if (explicit && activeWeeklyPlan.tasks.some(t => t.id === explicit)) return explicit;
    const assigned = getWeeklyGoalsAssignedToRoadmap(activeWeeklyPlan, planId, stageId);
    return assigned[0]?.id;
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
    const targetWeeklyTaskId = resolveTargetWeeklyGoalId(
      links?.strategyPlanId,
      links?.strategyStageId
    );
    const { nextTasks, landedInsideTask } = pullRoadmapItemIntoWeeklyPlan(activeWeeklyPlan, {
      text: trimmed,
      completed: links?.completed,
      sourceLabel: links?.sourceLabel,
      strategyPlanId: links?.strategyPlanId,
      strategyStageId: links?.strategyStageId,
      strategyGoalId: links?.strategyGoalId,
      targetWeeklyTaskId
    });
    saveWeeklyPlan({
      ...activeWeeklyPlan,
      tasks: nextTasks,
      achievedScore: computeWeeklyAchievedScore(nextTasks)
    });
    setPullNotice(
      landedInsideTask
        ? `Added "${trimmed.slice(0, 28)}${trimmed.length > 28 ? '…' : ''}" inside "${landedInsideTask.text.slice(0, 26)}${landedInsideTask.text.length > 26 ? '…' : ''}" (Week ${activeWeeklyPlan.weekNumber})`
        : `Sent "${trimmed.slice(0, 32)}${trimmed.length > 32 ? '…' : ''}" to Week ${activeWeeklyPlan.weekNumber}`
    );
    setTimeout(() => setPullNotice(null), 2800);
  };

  const handleCopyMarkdown = () => {
    if (!activePlan) return;
    const lines: string[] = [];
    const pTag = activePlan.priority
      ? `[${STRATEGY_PRIORITY_META[activePlan.priority].code} ${STRATEGY_PRIORITY_META[activePlan.priority].label}] `
      : '';
    lines.push(`# ${pTag}${activePlan.title}`);
    if (activePlan.description?.trim()) {
      lines.push(activePlan.description.trim());
    }
    if (activePlan.activationCondition?.trim()) {
      lines.push(`Activation Parameter: ${activePlan.activationCondition.trim()}`);
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

  const renderPossibleRoadmapCard = (plan: StrategyPlan) => {
    const isPromotable = plan.status === 'possible';
    const isHighlighted = highlightedPossibleId === plan.id;

    return (
      <div
        key={plan.id}
        id={`possible_roadmap_${plan.id}`}
        className={`rounded-2xl border p-4 sm:p-5 space-y-3.5 transition-all ${
          isHighlighted
            ? 'border-cyan-400/70 bg-cyan-500/10 ring-1 ring-cyan-400/30 shadow-lg'
            : isPromotable
            ? 'bg-slate-950/90 border-cyan-500/25 hover:border-cyan-500/45'
            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Top Row: Name + Status Switcher + Delete */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isPromotable ? 'bg-cyan-400 shadow-sm shadow-cyan-400/50' : 'bg-slate-500'
              }`}
            />
            <input
              type="text"
              value={plan.title}
              onChange={e => updatePlanById(plan.id, { title: e.target.value })}
              placeholder="Roadmap name..."
              className="flex-1 min-w-0 bg-transparent hover:bg-slate-900/70 focus:bg-slate-900 text-base sm:text-lg font-extrabold text-slate-100 rounded-xl px-2 py-1 -mx-2 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 transition-colors"
            />
            {plan.stages.length > 0 && (
              <span
                className="shrink-0 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold text-slate-400"
                title="Previously written stages are preserved if you promote this back to Active"
              >
                {plan.stages.length} stages saved
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <div
              className="inline-flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800"
              title="Set priority level (P1 Primary → P4 Low)"
            >
              {STRATEGY_PRIORITIES.map(lvl => {
                const meta = STRATEGY_PRIORITY_META[lvl];
                const selected = plan.priority === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() =>
                      updatePlanById(plan.id, { priority: selected ? undefined : lvl })
                    }
                    title={`${meta.code} · ${meta.label}${selected ? ' (click to clear)' : ''}`}
                    className={`px-2 py-1 rounded-lg font-mono text-[10px] font-extrabold border transition-colors ${
                      selected
                        ? meta.activeCls
                        : 'text-slate-500 hover:text-slate-200 border-transparent'
                    }`}
                  >
                    {meta.code}
                  </button>
                );
              })}
            </div>

            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => updatePlanById(plan.id, { status: 'possible' })}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                  isPromotable
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/35'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Can Promote
              </button>
              <button
                type="button"
                onClick={() => updatePlanById(plan.id, { status: 'not_pursuing' })}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                  !isPromotable
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Won&apos;t Activate
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleDeletePlanById(plan)}
              title="Delete roadmap"
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Activation Parameter */}
        <div className="space-y-1">
          <label className="flex items-center space-x-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
            <Zap className="w-3 h-3" />
            <span>
              Activation Parameter{' '}
              <span className="font-normal normal-case text-slate-500">
                (exact condition required before activating)
              </span>
            </span>
          </label>
          <input
            type="text"
            value={plan.activationCondition || ''}
            onChange={e => updatePlanById(plan.id, { activationCondition: e.target.value })}
            placeholder="e.g. Only activate when main roadmap passes Stage 2 & monthly cash reserve > $10k..."
            className="w-full bg-slate-900/90 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
          />
        </div>

        {/* Description Text Box */}
        <div className="space-y-1">
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Description
          </label>
          <textarea
            rows={isPromotable ? 2 : 3}
            value={plan.description || ''}
            onChange={e => updatePlanById(plan.id, { description: e.target.value })}
            placeholder={
              isPromotable
                ? 'Describe this candidate roadmap, its upside, and why it is worth keeping on deck...'
                : 'Describe this roadmap and why you are NOT activating it right now...'
            }
            className="w-full bg-slate-900/90 border border-slate-800 focus:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-y transition-colors leading-relaxed"
          />
        </div>

        {/* Footer Action Row */}
        <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/70">
          {isPromotable ? (
            <>
              <span className="text-[11px] text-slate-500">
                Hidden from Active Plans, Weekly Puller &amp; Quarterly Gates until promoted.
              </span>
              <button
                type="button"
                onClick={() => handlePromoteToActive(plan)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-sm transition-colors"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Promote to Active</span>
              </button>
            </>
          ) : (
            <>
              <span className="inline-flex items-center space-x-1.5 text-[11px] text-rose-300/80">
                <Ban className="w-3.5 h-3.5 shrink-0" />
                <span>Won&apos;t activate right now — stays out of active execution</span>
              </span>
              <button
                type="button"
                onClick={() => updatePlanById(plan.id, { status: 'possible' })}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-cyan-500/15 text-slate-400 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/35 text-[11px] font-bold transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                <span>Move to Can Promote</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-2">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT SIDEBAR: ACTIVE ROADMAPS + POSSIBLE ROADMAPS */}
        <aside className="lg:col-span-3 space-y-3 lg:sticky lg:top-20">
          {/* ACTIVE ROADMAPS CARD */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-100">
                  Active Roadmaps ({activePlans.length})
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

            {activePlans.length === 0 ? (
              <div className="p-4 rounded-2xl border border-dashed border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-400">No active roadmaps yet.</p>
                <button
                  type="button"
                  onClick={handleCreatePlan}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold"
                >
                  Create Active Plan
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {activePlans.map(plan => {
                  const isSelected = !isViewingPossibleBoard && activePlan?.id === plan.id;
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
                        <div className="flex items-center gap-1.5 min-w-0">
                          {plan.priority && (
                            <span
                              className={`shrink-0 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${STRATEGY_PRIORITY_META[plan.priority].badgeCls}`}
                              title={`${STRATEGY_PRIORITY_META[plan.priority].code} · ${STRATEGY_PRIORITY_META[plan.priority].label}`}
                            >
                              {STRATEGY_PRIORITY_META[plan.priority].code}
                            </span>
                          )}
                          <span
                            className={`text-sm font-extrabold truncate ${
                              isSelected ? 'text-amber-300' : 'text-slate-100'
                            }`}
                          >
                            {plan.title || 'Untitled Plan'}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {passedGates}/{plan.stages.length} gates
                        </span>
                      </div>

                      {activeStage && (
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                          {plan.status === 'paused' && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[9px] font-extrabold uppercase">
                              Paused
                            </span>
                          )}
                          <span className="truncate">
                            Now: <span className="text-slate-300 font-medium">{activeStage.title}</span>
                          </span>
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

            {activePlan && !isViewingPossibleBoard && (
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
                  onClick={() => handleDemoteActivePlan('possible')}
                  className="col-span-2 flex items-center justify-center space-x-1 py-1.5 px-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/25 text-[11px] font-bold transition-colors"
                  title="Move this roadmap out of Active into Possible Roadmaps (all stages are safely kept)"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Move to Possible List</span>
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

          {/* POSSIBLE ROADMAPS SIDEBAR CARD */}
          <div
            className={`bg-slate-900/90 border rounded-3xl p-4 shadow-xl space-y-3 transition-colors ${
              isViewingPossibleBoard ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <button
                type="button"
                onClick={() => handleOpenPossibleBoard(false)}
                className="flex items-center space-x-2 text-left group min-w-0"
              >
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-100 group-hover:text-cyan-300 transition-colors truncate">
                  Possible ({possiblePlans.length})
                </h2>
              </button>
              <button
                type="button"
                onClick={() => handleOpenPossibleBoard(true)}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/35 text-[11px] font-extrabold transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                {promotablePlans.length} Can Promote
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-950 text-slate-400 border border-slate-800">
                {shelvedPlans.length} Won&apos;t Activate
              </span>
            </div>

            {possiblePlans.length === 0 ? (
              <button
                type="button"
                onClick={() => handleOpenPossibleBoard(true)}
                className="w-full p-3 rounded-2xl border border-dashed border-slate-800 hover:border-cyan-500/35 text-center space-y-1 transition-colors"
              >
                <p className="text-[11px] text-slate-400">
                  Capture possible &amp; parked roadmaps with activation parameters.
                </p>
                <span className="inline-block text-[11px] font-bold text-cyan-400">
                  Open Possible List →
                </span>
              </button>
            ) : (
              <div className="space-y-1.5">
                {possiblePlans.map(plan => {
                  const isPromotable = plan.status === 'possible';
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => handleJumpToPossibleCard(plan.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all space-y-1 ${
                        isViewingPossibleBoard && highlightedPossibleId === plan.id
                          ? 'bg-cyan-500/15 border-cyan-500/45'
                          : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center space-x-1.5 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isPromotable ? 'bg-cyan-400' : 'bg-slate-500'
                            }`}
                          />
                          {plan.priority && (
                            <span
                              className={`shrink-0 font-mono text-[9px] font-extrabold px-1 py-0.5 rounded border ${STRATEGY_PRIORITY_META[plan.priority].badgeCls}`}
                            >
                              {STRATEGY_PRIORITY_META[plan.priority].code}
                            </span>
                          )}
                          <span className="text-xs font-bold text-slate-200 truncate">
                            {plan.title || 'Untitled Roadmap'}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                            isPromotable
                              ? 'bg-cyan-500/15 text-cyan-300'
                              : 'bg-slate-900 text-slate-500'
                          }`}
                        >
                          {isPromotable ? 'Promote' : "Won't"}
                        </span>
                      </div>
                      {plan.activationCondition?.trim() && (
                        <div className="flex items-center space-x-1 text-[10px] text-amber-300/80 truncate">
                          <Zap className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{plan.activationCondition}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleOpenPossibleBoard(false)}
                  className={`w-full py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-colors ${
                    isViewingPossibleBoard
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40'
                      : 'bg-slate-950 hover:bg-slate-800 text-cyan-300 border-slate-800'
                  }`}
                >
                  {isViewingPossibleBoard ? 'Viewing Possible List' : 'Manage All Possible →'}
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT MAIN AREA: POSSIBLE ROADMAPS BOARD OR ACTIVE WRITTEN STAGE-GATE DOCUMENT */}
        <section className="lg:col-span-9 space-y-5">
          {isViewingPossibleBoard ? (
            <div className="space-y-5">
              {/* Possible Roadmaps Header */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="inline-flex items-center space-x-1.5 text-[10px] font-extrabold uppercase tracking-widest text-cyan-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Roadmap Pipeline &amp; Anti-Distraction Filter</span>
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
                      Possible Roadmaps
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                      List candidate roadmaps you might promote to Active, alongside ideas you intentionally won&apos;t activate right now — each with its Name, Description, and exact Activation Parameter.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {possiblePlans.length > 0 && (
                      <button
                        type="button"
                        onClick={handleCopyPossibleMarkdown}
                        className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold transition-colors"
                      >
                        {copiedPossibleMd ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        )}
                        <span>{copiedPossibleMd ? 'Copied!' : 'Copy List'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Add New Possible / Won't Activate Roadmap Form */}
                <form
                  onSubmit={handleAddPossiblePlan}
                  className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Add Possible Roadmap
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="px-2 text-[10px] font-bold text-slate-500">Priority:</span>
                        {STRATEGY_PRIORITIES.map(lvl => {
                          const meta = STRATEGY_PRIORITY_META[lvl];
                          const selected = newPossiblePriority === lvl;
                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setNewPossiblePriority(lvl)}
                              title={`${meta.code} · ${meta.label}`}
                              className={`px-2 py-1 rounded-lg font-mono text-[10px] font-extrabold border transition-colors ${
                                selected
                                  ? meta.activeCls
                                  : 'text-slate-500 hover:text-slate-200 border-transparent'
                              }`}
                            >
                              {meta.code}
                            </button>
                          );
                        })}
                      </div>

                      <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setNewPossibleStatus('possible')}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                            newPossibleStatus === 'possible'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/35'
                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          Can Promote to Active
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewPossibleStatus('not_pursuing')}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                            newPossibleStatus === 'not_pursuing'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          Won&apos;t Activate
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Roadmap Name *
                      </label>
                      <input
                        ref={newPossibleInputRef}
                        type="text"
                        value={newPossibleTitle}
                        onChange={e => setNewPossibleTitle(e.target.value)}
                        placeholder="e.g. YouTube Content Engine, Prop Firm Scaling..."
                        className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="flex items-center space-x-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                        <Zap className="w-3 h-3" />
                        <span>Activation Parameter</span>
                      </label>
                      <input
                        type="text"
                        value={newPossibleActivation}
                        onChange={e => setNewPossibleActivation(e.target.value)}
                        placeholder="e.g. Only activate after Trading Stage 2 + 6 months runway..."
                        className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={newPossibleDescription}
                      onChange={e => setNewPossibleDescription(e.target.value)}
                      placeholder={
                        newPossibleStatus === 'possible'
                          ? 'Describe this roadmap and why it is a strong candidate to promote later...'
                          : 'Describe this roadmap and why you are choosing NOT to activate it right now...'
                      }
                      className="w-full bg-slate-900 border border-slate-800 focus:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-y"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!newPossibleTitle.trim()}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-extrabold shadow-sm transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        {newPossibleStatus === 'possible'
                          ? 'Add to Can Promote'
                          : "Add to Won't Activate"}
                      </span>
                    </button>
                  </div>
                </form>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {(
                    [
                      { key: 'all', label: `All (${possiblePlans.length})` },
                      { key: 'possible', label: `Can Promote (${promotablePlans.length})` },
                      { key: 'not_pursuing', label: `Won't Activate (${shelvedPlans.length})` }
                    ] as const
                  ).map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setPossibleFilter(tab.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                        possibleFilter === tab.key
                          ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Possible Roadmaps Lists */}
              {possiblePlans.length === 0 ? (
                <div className="bg-slate-900/80 border border-dashed border-slate-800 rounded-3xl p-10 text-center space-y-2">
                  <Sparkles className="w-8 h-8 text-cyan-400/70 mx-auto" />
                  <h3 className="text-sm font-extrabold text-slate-200">
                    No possible roadmaps logged yet
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Use the form above to park future roadmap ideas or explicitly log ones you won&apos;t activate — along with the exact activation parameter required before touching them.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {(possibleFilter === 'all' || possibleFilter === 'possible') && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          <span>Can Promote to Active ({promotablePlans.length})</span>
                        </h3>
                      </div>
                      {promotablePlans.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-xs text-slate-500">
                          No promotable roadmaps in queue right now.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {promotablePlans.map(renderPossibleRoadmapCard)}
                        </div>
                      )}
                    </div>
                  )}

                  {(possibleFilter === 'all' || possibleFilter === 'not_pursuing') && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-300/90 flex items-center space-x-2">
                          <Ban className="w-3.5 h-3.5 text-rose-400" />
                          <span>Won&apos;t Activate — Shelved ({shelvedPlans.length})</span>
                        </h3>
                      </div>
                      {shelvedPlans.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-xs text-slate-500">
                          No shelved (&quot;Won&apos;t Activate&quot;) roadmaps logged yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {shelvedPlans.map(renderPossibleRoadmapCard)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : !activePlan ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-xl">
              <BookOpen className="w-10 h-10 text-amber-400 mx-auto" />
              <h2 className="text-xl font-extrabold text-slate-100">Create a Written Strategy Plan</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Map out sequential stages, system states, proximal goals, discipline boundaries, day-in-a-life stories, and the exact gates to unlock each next level — or list Possible Roadmaps with activation parameters.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCreatePlan}
                  className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Active Roadmap</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenPossibleBoard(true)}
                  className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/35 text-xs font-extrabold"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Add Possible Roadmap</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Plan Document Header + Linear Stage Table of Contents */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                        Active Stage-Gate Roadmap
                      </span>
                      <div
                        className="inline-flex items-center p-0.5 rounded-xl bg-slate-950 border border-slate-800"
                        title="Roadmap priority level (P1 Primary → P4 Low)"
                      >
                        <span className="px-1.5 text-[10px] font-bold text-slate-500">Priority:</span>
                        {STRATEGY_PRIORITIES.map(lvl => {
                          const meta = STRATEGY_PRIORITY_META[lvl];
                          const selected = activePlan.priority === lvl;
                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() =>
                                updateActivePlan({ priority: selected ? undefined : lvl })
                              }
                              title={`${meta.code} · ${meta.label}${selected ? ' (click to clear)' : ''}`}
                              className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-extrabold border transition-colors ${
                                selected
                                  ? meta.activeCls
                                  : 'text-slate-500 hover:text-slate-200 border-transparent'
                              }`}
                            >
                              {selected ? `${meta.code} · ${meta.label}` : meta.code}
                            </button>
                          );
                        })}
                      </div>
                    </div>
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
                    {(editingActiveParam || (activePlan.activationCondition && activePlan.activationCondition.trim() !== '')) && (
                      <div className="flex items-center space-x-1.5 pt-0.5 text-[11px] text-amber-300/90">
                        <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="font-bold text-slate-500 shrink-0">Activation Parameter:</span>
                        <input
                          type="text"
                          value={activePlan.activationCondition || ''}
                          onFocus={() => setEditingActiveParam(true)}
                          onBlur={() => setEditingActiveParam(false)}
                          onChange={e => updateActivePlan({ activationCondition: e.target.value })}
                          placeholder="Activation parameter..."
                          className="flex-1 min-w-0 bg-transparent focus:bg-slate-950/80 rounded px-1.5 py-0.5 text-amber-300 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {activeWeeklyPlan && sortedWeeklyPlans.length > 0 && (() => {
                      const activeStageInfo = getActiveStageForPlan(activePlan);
                      const assignedWeeklyGoals = getWeeklyGoalsAssignedToRoadmap(
                        activeWeeklyPlan,
                        activePlan.id,
                        activeStageInfo?.stage.id
                      );
                      const targetKey = `${activeWeeklyPlan.id}:${activePlan.id}`;
                      const selectedGoalVal =
                        pullTargetGoalByWeekPlan[targetKey] &&
                        (pullTargetGoalByWeekPlan[targetKey] === '__new__' ||
                          assignedWeeklyGoals.some(wg => wg.id === pullTargetGoalByWeekPlan[targetKey]))
                          ? pullTargetGoalByWeekPlan[targetKey]
                          : assignedWeeklyGoals[0]?.id || '__new__';

                      return (
                        <div className="flex flex-wrap items-center gap-1.5">
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
                          {assignedWeeklyGoals.length > 0 && (
                            <div
                              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs"
                              title="Pulled proximal goals automatically land inside this assigned Weekly Goal as sub-goals"
                            >
                              <span className="text-[11px] font-bold text-amber-400 shrink-0">↳ Goal:</span>
                              <select
                                value={selectedGoalVal}
                                onChange={e =>
                                  setPullTargetGoalByWeekPlan(prev => ({
                                    ...prev,
                                    [targetKey]: e.target.value
                                  }))
                                }
                                className="bg-transparent text-amber-200 font-bold text-xs focus:outline-none cursor-pointer max-w-[190px]"
                              >
                                {assignedWeeklyGoals.map(wg => (
                                  <option key={wg.id} value={wg.id} className="bg-slate-950 text-slate-200">
                                    {wg.text || 'Untitled weekly goal'}
                                  </option>
                                ))}
                                <option value="__new__" className="bg-slate-950 text-slate-400">
                                  + New standalone goal
                                </option>
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })()}
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
                      onClick={() => {
                        setPivotPauseStatus(activePlan.status === 'paused');
                        setShowPivotDrawer(v => !v);
                      }}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                        activePlan.status === 'paused'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : showPivotDrawer
                          ? 'bg-slate-800 text-amber-300 border-amber-500/40'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                      title="Log a strategy pivot or pause with a 1-line reason so you never forget why you changed direction"
                    >
                      {activePlan.status === 'paused' ? 'Paused · Pivot Log' : 'Log Pivot / Pause'}
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

                {/* Pivot / Pause Memory Drawer + Recent Pivot History */}
                {showPivotDrawer && (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                        Pivot / Pause Memory (Why did direction change?)
                      </span>
                      <label className="inline-flex items-center space-x-1.5 text-[11px] text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pivotPauseStatus}
                          onChange={e => setPivotPauseStatus(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-amber-500"
                        />
                        <span>Mark Roadmap Paused</span>
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(['reality_shift', 'disproved', 'deferred'] as ParkReasonTag[]).map(tag => {
                        const meta = PARK_REASON_META[tag];
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setPivotTag(tag)}
                            title={meta.hint}
                            className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-colors ${
                              pivotTag === tag
                                ? meta.activeCls
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                            }`}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={pivotNote}
                        onChange={e => setPivotNote(e.target.value)}
                        placeholder="1-line memory for future-you (e.g. 'Shifted from agency to SaaS after 3 client churns')..."
                        className="flex-1 min-w-[220px] bg-slate-900 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const entry = pivotNote.trim()
                            ? {
                                id: `piv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                                date: todayDate,
                                tag: pivotTag,
                                note: pivotNote.trim()
                              }
                            : null;
                          saveStrategyPlan({
                            ...activePlan,
                            status: pivotPauseStatus ? 'paused' : 'active',
                            pivotHistory: entry
                              ? [entry, ...(activePlan.pivotHistory || [])]
                              : activePlan.pivotHistory,
                            updatedAt: new Date().toISOString()
                          });
                          setPivotNote('');
                          setShowPivotDrawer(false);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}

                {(activePlan.pivotHistory || []).length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] pt-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Pivot Memory:
                    </span>
                    {(activePlan.pivotHistory || []).slice(0, 3).map(ev => (
                      <span
                        key={ev.id}
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-xl border ${
                          PARK_REASON_META[ev.tag]?.badgeCls || 'bg-slate-950 text-slate-300 border-slate-800'
                        }`}
                      >
                        <span className="font-mono text-[10px] opacity-80">{ev.date}</span>
                        <span className="font-bold">{PARK_REASON_META[ev.tag]?.shortLabel}:</span>
                        <span className="truncate max-w-[260px]">{ev.note}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Linear Written Stage Jump Strip */}
                {pullNotice && (
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs font-bold text-emerald-300">
                    <span>✓ {pullNotice}</span>
                    {activeWeeklyPlan && pullNotice.includes(`Week ${activeWeeklyPlan.weekNumber}`) && (
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
                              <>
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold uppercase tracking-wider">
                                  Active Stage
                                </span>
                                {(() => {
                                  const prevGateDate =
                                    idx > 0 ? activePlan.stages[idx - 1]?.gatePassedAt : undefined;
                                  const startRef =
                                    stage.startedAt ||
                                    prevGateDate ||
                                    (activePlan.createdAt || todayDate).slice(0, 10);
                                  const daysOnStage = daysBetweenDates(startRef, todayDate);
                                  const isStalled = daysOnStage >= 21 && completedGoals === 0;
                                  const normTitle = normalizeTag(activePlan.title);
                                  const activeTaggedProblems = normTitle
                                    ? problems.filter(
                                        p =>
                                          p.status !== 'solved' &&
                                          ((p.tags || []).some(t => normalizeTag(t) === normTitle) ||
                                            p.title.toLowerCase().includes(activePlan.title.trim().toLowerCase()))
                                      ).length
                                    : 0;
                                  return (
                                    <>
                                      <span
                                        className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
                                          isStalled
                                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                                            : 'bg-slate-900 text-slate-400 border-slate-800'
                                        }`}
                                        title={
                                          isStalled
                                            ? `Active for ${daysOnStage} days with 0 proximal goals checked — break down goals or diagnose constraints`
                                            : `Days in this active stage (since ${startRef})`
                                        }
                                      >
                                        {isStalled ? `⚠ Stalled ${daysOnStage}d` : `${daysOnStage}d active`}
                                      </span>
                                      {activeTaggedProblems > 0 && (
                                        <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30 font-mono text-[10px] font-bold">
                                          {activeTaggedProblems} open blocker{activeTaggedProblems === 1 ? '' : 's'}
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </>
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

                          {/* LIVE TIMEFRAME BINDINGS (Shows exactly where this Stage is committed & scheduled) */}
                          {isCurrent && (() => {
                            const bindings = getRoadmapStageBindings(
                              activePlan.id,
                              stage.id,
                              quarterlyPlans,
                              monthlyPlans,
                              weeklyPlans
                            );
                            const isCommittedCurrentQ = bindings.targetQuarters.includes(activeQuarterKey);
                            const toggleCommitCurrentQ = () => {
                              const refs = activeQuarterPlan.targetGateRefs || [];
                              const nextRefs = isCommittedCurrentQ
                                ? refs.filter(r => !(r.planId === activePlan.id && r.stageId === stage.id))
                                : [...refs, { planId: activePlan.id, stageId: stage.id }];
                              saveQuarterlyPlan({ ...activeQuarterPlan, targetGateRefs: nextRefs });
                            };
                            return (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                                <button
                                  type="button"
                                  onClick={toggleCommitCurrentQ}
                                  className={`px-2 py-0.5 rounded-lg border font-bold font-mono text-[10px] transition-colors ${
                                    isCommittedCurrentQ
                                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25'
                                      : 'bg-slate-900 hover:bg-cyan-500/15 text-cyan-300 border-slate-700 hover:border-cyan-500/40'
                                  }`}
                                  title={
                                    isCommittedCurrentQ
                                      ? `Committed as Target Gate in ${activeQuarterKey} (click to uncommit)`
                                      : `Commit this Stage Gate to ${activeQuarterKey} Quarterly Plan`
                                  }
                                >
                                  {isCommittedCurrentQ
                                    ? `✓ Committed to ${activeQuarterKey}`
                                    : `+ Commit Gate to ${activeQuarterKey}`}
                                </button>

                                {bindings.monthlySteps.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setPlanningSubTab('monthly')}
                                    className="px-2 py-0.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono text-[10px] font-bold"
                                  >
                                    {bindings.monthlySteps.filter(s => s.task.completed).length}/
                                    {bindings.monthlySteps.length} Monthly steps
                                  </button>
                                )}

                                {bindings.weeklySteps.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const latestWeekId =
                                        bindings.weeklySteps[bindings.weeklySteps.length - 1]?.periodKey;
                                      if (latestWeekId) setSelectedWeekId(latestWeekId);
                                      setPlanningSubTab('weekly');
                                    }}
                                    className="px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-bold"
                                  >
                                    {bindings.weeklySteps.filter(s => s.task.completed).length}/
                                    {bindings.weeklySteps.length} Weekly steps
                                  </button>
                                )}
                              </div>
                            );
                          })()}
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
                                {activeWeeklyPlan && (() => {
                                  const resolvedTargetId = resolveTargetWeeklyGoalId(activePlan.id, stage.id);
                                  const targetGoal =
                                    resolvedTargetId && resolvedTargetId !== '__new__'
                                      ? activeWeeklyPlan.tasks.find(t => t.id === resolvedTargetId)
                                      : undefined;
                                  if (!targetGoal) return null;
                                  return (
                                    <div className="text-[10px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1 flex items-center justify-between gap-2">
                                      <span className="truncate">
                                        ↳ <strong>+ W{activeWeeklyPlan.weekNumber}</strong> lands inside:{' '}
                                        <span className="text-amber-200 font-semibold">{targetGoal.text}</span>
                                      </span>
                                    </div>
                                  );
                                })()}

                                {stage.proximalGoals.length === 0 ? (
                                  <p className="text-[11px] text-slate-500 italic py-1">
                                    What proximal goals look like at this stage — add concrete milestones below.
                                  </p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {stage.proximalGoals.map(goal => {
                                      const inWeek = isGoalInActiveWeek(goal.text, goal.id);
                                      const inMonth = isGoalInActiveMonth(goal.text, goal.id);
                                      const inQuarter = isGoalInActiveQuarter(goal.text, goal.id);
                                      const goalLinks = {
                                        strategyPlanId: activePlan.id,
                                        strategyStageId: stage.id,
                                        strategyGoalId: goal.id,
                                        sourceLabel: `${activePlan.title} · Stage ${idx}`,
                                        completed: goal.completed
                                      };
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
                                          <div className="flex items-center space-x-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => handlePullGoalToQuarter(goal.text, goalLinks)}
                                              title={
                                                inQuarter
                                                  ? `In ${activeQuarterKey} — open Quarterly Plan`
                                                  : `Pull into ${activeQuarterKey} Quarterly Plan`
                                              }
                                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                                                inQuarter
                                                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/35'
                                                  : 'bg-slate-950 text-cyan-400 border-slate-800 hover:border-cyan-500/40'
                                              }`}
                                            >
                                              {inQuarter ? `✓ ${activeQuarterKey.slice(5)}` : `+ ${activeQuarterKey.slice(5)}`}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handlePullGoalToMonth(goal.text, goalLinks)}
                                              title={
                                                inMonth
                                                  ? `In ${activeMonthKey} — open Monthly Plan`
                                                  : `Pull into ${activeMonthKey} Monthly Plan`
                                              }
                                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                                                inMonth
                                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/35'
                                                  : 'bg-slate-950 text-purple-400 border-slate-800 hover:border-purple-500/40'
                                              }`}
                                            >
                                              {inMonth ? '✓ Mo' : '+ Mo'}
                                            </button>
                                            {activeWeeklyPlan && (
                                              <button
                                                type="button"
                                                onClick={() => handlePullGoalToWeek(goal.text, goalLinks)}
                                                title={
                                                  inWeek
                                                    ? `In Week ${activeWeeklyPlan.weekNumber} — open Weekly Plan`
                                                    : `Pull into Week ${activeWeeklyPlan.weekNumber}`
                                                }
                                                className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                                                  inWeek
                                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                    : 'bg-slate-950 text-amber-400 border-amber-500/30 hover:bg-amber-500/15'
                                              }`}
                                            >
                                              {!inWeek && <ArrowDownToLine className="w-2.5 h-2.5" />}
                                              <span>{inWeek ? `✓ W${activeWeeklyPlan.weekNumber}` : `+ W${activeWeeklyPlan.weekNumber}`}</span>
                                            </button>
                                            )}
                                          </div>
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
                                onClick={() => {
                                  const nextPassed = !stage.gatePassed;
                                  updateActivePlan({
                                    stages: activePlan.stages.map((s, sIdx) => {
                                      if (s.id === stage.id) {
                                        return {
                                          ...s,
                                          gatePassed: nextPassed,
                                          gatePassedAt: nextPassed ? todayDate : undefined
                                        };
                                      }
                                      if (nextPassed && sIdx === idx + 1 && !s.startedAt) {
                                        return { ...s, startedAt: todayDate };
                                      }
                                      return s;
                                    })
                                  });
                                }}
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
