import React, { useState, useEffect } from 'react';
import {
  useStorage,
  PlanningSubTab,
  findBestWeeklyPlanForDate,
  getWeekRangeForWeekNumber,
  computeWeeklyAchievedScore
} from '../../context/StorageContext';
import { INITIAL_THREE_YEAR_PLAN } from '../../types/defaults';
import { DailyTrackerView } from '../daily/DailyTrackerView';
import { WeeklyGoalCrusherView } from '../weekly/WeeklyGoalCrusherView';
import { SpreadsheetMatrixView } from '../matrix/SpreadsheetMatrixView';
import { WeeklyPlan } from '../../types/schema';
import {
  Calendar,
  Target,
  Compass,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ShieldAlert,
  TrendingUp,
  Users,
  Cpu,
  X,
  FilePlus,
  Bell,
  Table,
  RotateCcw
} from 'lucide-react';

type MilestoneYearKey = 'year1Milestones' | 'year2Milestones' | 'year3Milestones';

export const PlanningHub: React.FC<{ onOpenGWS: () => void; onCustomizeTemplate: () => void }> = ({
  onOpenGWS,
  onCustomizeTemplate
}) => {
  const {
    planningSubTab,
    setPlanningSubTab,
    threeYearPlan,
    saveThreeYearPlan,
    weeklyPlans,
    saveWeeklyPlan,
    saveDailyEntry,
    selectedWeekId,
    setSelectedWeekId,
    todayDate,
    selectedDate,
    setSelectedDate,
    systemLevel,
    missingPlanAlerts
  } = useStorage();

  const [dismissedAlerts, setDismissedAlerts] = useState(false);

  // Create Plan Modal state
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [createPlanType, setCreatePlanType] = useState<'weekly' | 'daily'>('weekly');

  const existingWeekNums = Object.values(weeklyPlans).map(p => p.weekNumber);
  const maxWeekNum = existingWeekNums.length > 0 ? Math.max(...existingWeekNums) : 1;
  const nextDefaultWeekNum = maxWeekNum + 1;
  const defaultWeekRange = getWeekRangeForWeekNumber(nextDefaultWeekNum);

  const [newWeekNum, setNewWeekNum] = useState<number>(nextDefaultWeekNum);
  const [newWeekFocus, setNewWeekFocus] = useState<string>('');
  const [newWeekStart, setNewWeekStart] = useState<string>(defaultWeekRange.startDate);
  const [newWeekEnd, setNewWeekEnd] = useState<string>(defaultWeekRange.endDate);

  // New Daily Plan form state
  const [newPlanDate, setNewPlanDate] = useState<string>(selectedDate);
  const [newPlanNotes, setNewPlanNotes] = useState<string>('');

  // 3-Year Plan editing state
  const [activeYearPillar, setActiveYearPillar] = useState<string>(
    () => threeYearPlan.pillars[0]?.id || 'pillar_trading'
  );
  const [newMilestoneText, setNewMilestoneText] = useState('');
  const [selectedMilestoneYear, setSelectedMilestoneYear] = useState<'year1' | 'year2' | 'year3'>('year1');
  const [yearMilestoneDrafts, setYearMilestoneDrafts] = useState<Record<MilestoneYearKey, string>>({
    year1Milestones: '',
    year2Milestones: '',
    year3Milestones: ''
  });
  const [newBoundaryText, setNewBoundaryText] = useState('');

  // Keep activeYearPillar aligned whenever pillars change or get deleted
  useEffect(() => {
    if (
      threeYearPlan.pillars.length > 0 &&
      !threeYearPlan.pillars.some(p => p.id === activeYearPillar)
    ) {
      setActiveYearPillar(threeYearPlan.pillars[0].id);
    }
  }, [threeYearPlan.pillars, activeYearPillar]);

  const currentPillar =
    threeYearPlan.pillars.find(p => p.id === activeYearPillar) || threeYearPlan.pillars[0];

  // Overall 3-Year milestones stats
  const allMilestonesStats = threeYearPlan.pillars.reduce(
    (acc, p) => {
      const all = [
        ...(p.year1Milestones || []),
        ...(p.year2Milestones || []),
        ...(p.year3Milestones || [])
      ];
      return {
        done: acc.done + all.filter(m => m.completed).length,
        total: acc.total + all.length
      };
    },
    { done: 0, total: 0 }
  );

  // 3-Year Plan top-level & pillar CRUD handlers
  const handleVisionChange = (vision: string) => {
    saveThreeYearPlan({ ...threeYearPlan, vision });
  };

  const handleTargetHorizonChange = (targetHorizon: string) => {
    saveThreeYearPlan({ ...threeYearPlan, targetHorizon });
  };

  const handleStrategyCoreChange = (strategyCore: string) => {
    saveThreeYearPlan({ ...threeYearPlan, strategyCore });
  };

  const handleAddPillar = () => {
    const iconOptions = ['TrendingUp', 'Users', 'Cpu'];
    const newId = `pillar_${Date.now()}`;
    const nextNum = threeYearPlan.pillars.length + 1;
    const newPillar = {
      id: newId,
      title: `Strategic Pillar ${nextNum}`,
      subtitle: 'Core objectives, boundaries & annual checkpoints',
      iconName: iconOptions[threeYearPlan.pillars.length % iconOptions.length],
      year1Milestones: [],
      year2Milestones: [],
      year3Milestones: [],
      boundariesAndCheckpoints: []
    };
    saveThreeYearPlan({
      ...threeYearPlan,
      pillars: [...threeYearPlan.pillars, newPillar]
    });
    setActiveYearPillar(newId);
  };

  const handleUpdatePillarMeta = (
    pillarId: string,
    updates: { title?: string; subtitle?: string; iconName?: string }
  ) => {
    saveThreeYearPlan({
      ...threeYearPlan,
      pillars: threeYearPlan.pillars.map(p => (p.id === pillarId ? { ...p, ...updates } : p))
    });
  };

  const handleDeletePillar = (pillarId: string) => {
    const target = threeYearPlan.pillars.find(p => p.id === pillarId);
    if (target && !confirm(`Delete pillar "${target.title}" and all its milestones?`)) {
      return;
    }
    const remaining = threeYearPlan.pillars.filter(p => p.id !== pillarId);
    saveThreeYearPlan({
      ...threeYearPlan,
      pillars: remaining
    });
    setActiveYearPillar(remaining[0]?.id || '');
  };

  const handleRestoreDefaultPillars = () => {
    saveThreeYearPlan({
      ...threeYearPlan,
      targetHorizon: threeYearPlan.targetHorizon?.trim() || INITIAL_THREE_YEAR_PLAN.targetHorizon,
      vision: threeYearPlan.vision?.trim() || INITIAL_THREE_YEAR_PLAN.vision,
      strategyCore: threeYearPlan.strategyCore?.trim() || INITIAL_THREE_YEAR_PLAN.strategyCore,
      pillars: INITIAL_THREE_YEAR_PLAN.pillars
    });
    setActiveYearPillar(INITIAL_THREE_YEAR_PLAN.pillars[0].id);
  };

  // Boundaries CRUD
  const handleAddBoundary = (pillarId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoundaryText.trim()) return;

    const updatedPillars = threeYearPlan.pillars.map(p => {
      if (p.id !== pillarId) return p;
      return {
        ...p,
        boundariesAndCheckpoints: [...p.boundariesAndCheckpoints, newBoundaryText.trim()]
      };
    });

    saveThreeYearPlan({ ...threeYearPlan, pillars: updatedPillars });
    setNewBoundaryText('');
  };

  const handleEditBoundary = (pillarId: string, index: number, text: string) => {
    const updatedPillars = threeYearPlan.pillars.map(p => {
      if (p.id !== pillarId) return p;
      return {
        ...p,
        boundariesAndCheckpoints: p.boundariesAndCheckpoints.map((b, i) => (i === index ? text : b))
      };
    });
    saveThreeYearPlan({ ...threeYearPlan, pillars: updatedPillars });
  };

  const handleDeleteBoundary = (pillarId: string, index: number) => {
    const updatedPillars = threeYearPlan.pillars.map(p => {
      if (p.id !== pillarId) return p;
      return {
        ...p,
        boundariesAndCheckpoints: p.boundariesAndCheckpoints.filter((_, i) => i !== index)
      };
    });
    saveThreeYearPlan({ ...threeYearPlan, pillars: updatedPillars });
  };

  // Milestones CRUD
  const handleToggleMilestone = (
    pillarId: string,
    yearKey: MilestoneYearKey,
    milestoneId: string
  ) => {
    const updatedPillars = threeYearPlan.pillars.map(p => {
      if (p.id !== pillarId) return p;
      return {
        ...p,
        [yearKey]: p[yearKey].map(m => (m.id === milestoneId ? { ...m, completed: !m.completed } : m))
      };
    });
    saveThreeYearPlan({ ...threeYearPlan, pillars: updatedPillars });
  };

  const handleEditMilestone = (
    pillarId: string,
    yearKey: MilestoneYearKey,
    milestoneId: string,
    text: string
  ) => {
    const updatedPillars = threeYearPlan.pillars.map(p => {
      if (p.id !== pillarId) return p;
      return {
        ...p,
        [yearKey]: p[yearKey].map(m => (m.id === milestoneId ? { ...m, text } : m))
      };
    });
    saveThreeYearPlan({ ...threeYearPlan, pillars: updatedPillars });
  };

  const handleMoveMilestoneYear = (
    pillarId: string,
    fromKey: MilestoneYearKey,
    toKey: MilestoneYearKey,
    milestoneId: string
  ) => {
    if (fromKey === toKey) return;
    const updatedPillars = threeYearPlan.pillars.map(p => {
      if (p.id !== pillarId) return p;
      const item = p[fromKey].find(m => m.id === milestoneId);
      if (!item) return p;
      return {
        ...p,
        [fromKey]: p[fromKey].filter(m => m.id !== milestoneId),
        [toKey]: [...p[toKey], item]
      };
    });
    saveThreeYearPlan({ ...threeYearPlan, pillars: updatedPillars });
  };

  const handleAddMilestoneForYear = (
    pillarId: string,
    yearKey: MilestoneYearKey,
    rawText: string
  ) => {
    const text = rawText.trim();
    if (!text) return;

    const newM = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text,
      completed: false
    };

    const updatedPillars = threeYearPlan.pillars.map(p => {
      if (p.id !== pillarId) return p;
      return {
        ...p,
        [yearKey]: [...p[yearKey], newM]
      };
    });

    saveThreeYearPlan({ ...threeYearPlan, pillars: updatedPillars });
  };

  const handleAddMilestone = (pillarId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneText.trim()) return;

    const key: MilestoneYearKey =
      selectedMilestoneYear === 'year1'
        ? 'year1Milestones'
        : selectedMilestoneYear === 'year2'
        ? 'year2Milestones'
        : 'year3Milestones';

    handleAddMilestoneForYear(pillarId, key, newMilestoneText);
    setNewMilestoneText('');
  };

  const handleDeleteMilestone = (
    pillarId: string,
    yearKey: MilestoneYearKey,
    milestoneId: string
  ) => {
    const updatedPillars = threeYearPlan.pillars.map(p => {
      if (p.id !== pillarId) return p;
      return {
        ...p,
        [yearKey]: p[yearKey].filter(m => m.id !== milestoneId)
      };
    });
    saveThreeYearPlan({ ...threeYearPlan, pillars: updatedPillars });
  };

  const activeWeeklyPlan =
    findBestWeeklyPlanForDate(selectedDate, weeklyPlans, selectedWeekId) ||
    weeklyPlans[selectedWeekId] ||
    Object.values(weeklyPlans)[0];

  const isMilestoneInActiveWeek = (text: string): boolean => {
    if (!activeWeeklyPlan) return false;
    const norm = text.toLowerCase().trim();
    if (!norm) return false;
    return activeWeeklyPlan.tasks.some(t => t.text.toLowerCase().trim() === norm);
  };

  const handlePullMilestoneToActiveWeek = (text: string) => {
    if (!activeWeeklyPlan) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    if (isMilestoneInActiveWeek(trimmed)) {
      setSelectedWeekId(activeWeeklyPlan.id);
      setPlanningSubTab('weekly');
      return;
    }

    const nextTasks = [
      ...activeWeeklyPlan.tasks,
      {
        id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text: trimmed,
        score: 2,
        completed: false
      }
    ];
    saveWeeklyPlan({
      ...activeWeeklyPlan,
      tasks: nextTasks,
      achievedScore: computeWeeklyAchievedScore(nextTasks)
    });
  };

  // Open Create Plan modal with synced week number + range
  const openCreatePlanModal = () => {
    const nums = Object.values(weeklyPlans).map(p => p.weekNumber);
    const nextNum = (nums.length > 0 ? Math.max(...nums) : 1) + 1;
    const nextRange = getWeekRangeForWeekNumber(nextNum);
    setNewWeekNum(nextNum);
    setNewWeekStart(nextRange.startDate);
    setNewWeekEnd(nextRange.endDate);
    setNewPlanDate(selectedDate);
    setCreatePlanType(planningSubTab === 'weekly' ? 'weekly' : 'daily');
    setShowCreatePlanModal(true);
  };

  // Submit handler for creating a new weekly plan
  const handleCreateWeeklyPlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const safeWeekNum = Math.max(1, newWeekNum || 1);
    const weekId = `week_${safeWeekNum}`;

    const newPlan: WeeklyPlan = {
      id: weekId,
      weekNumber: safeWeekNum,
      startDate: newWeekStart,
      endDate: newWeekEnd,
      focusTheme: newWeekFocus.trim(),
      notes: '',
      tasks: [],
      totalPossibleScore: 10,
      achievedScore: 0,
      rewards: [],
      updatedAt: new Date().toISOString()
    };

    saveWeeklyPlan(newPlan);
    setSelectedWeekId(weekId);
    setPlanningSubTab('weekly');
    setShowCreatePlanModal(false);
    setNewWeekFocus('');
  };

  const handleCreateDailyPlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlanNotes.trim()) {
      saveDailyEntry(newPlanDate, { planNotes: newPlanNotes.trim() });
    }
    setSelectedDate(newPlanDate);
    setPlanningSubTab('daily');
    setShowCreatePlanModal(false);
    setNewPlanNotes('');
  };

  const getPillarIcon = (name: string) => {
    if (name === 'TrendingUp') return TrendingUp;
    if (name === 'Users') return Users;
    return Cpu;
  };

  const yearSections: Array<{
    key: MilestoneYearKey;
    badgeLabel: string;
    subtitle: string;
    badgeClass: string;
    activeCardClass: string;
    iconDoneClass: string;
  }> = [
    {
      key: 'year1Milestones',
      badgeLabel: 'Year 1',
      subtitle: 'Foundation & Strategy Execution',
      badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      activeCardClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
      iconDoneClass: 'text-emerald-400 fill-emerald-400/20'
    },
    {
      key: 'year2Milestones',
      badgeLabel: 'Year 2',
      subtitle: 'Scaling & Systematic Compounding',
      badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      activeCardClass: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
      iconDoneClass: 'text-amber-400 fill-amber-400/20'
    },
    {
      key: 'year3Milestones',
      badgeLabel: 'Year 3',
      subtitle: 'Apex Dominance & Autonomy',
      badgeClass: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      activeCardClass: 'bg-sky-500/10 border-sky-500/30 text-sky-200',
      iconDoneClass: 'text-sky-400 fill-sky-400/20'
    }
  ];

  return (
    <div className="space-y-6">

      {/* Top Unified Planning Window Switcher Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-2 sm:p-2.5 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl">

          <div className="flex items-center space-x-3 px-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                Planning Command
              </div>
              <div className="text-sm font-extrabold text-slate-100">
                {planningSubTab === 'daily' && 'Daily Mission & Priorities'}
                {planningSubTab === 'weekly' && 'Weekly Goal Crusher (10 Pts)'}
                {planningSubTab === 'matrix' && 'Weeks Matrix (GWS & Daily Checklist Consistency)'}
                {planningSubTab === 'three_year' && '3-Year Strategic Roadmap'}
              </div>
            </div>
          </div>

          {/* Switcher & Action Button */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">

            {/* Segmented Switcher Controls filtered by systemLevel */}
            <div className="flex items-center space-x-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800/80 overflow-x-auto">
              <button
                type="button"
                onClick={() => setPlanningSubTab('daily')}
                className={`flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  planningSubTab === 'daily'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Daily Plan</span>
              </button>

              {systemLevel >= 3 && (
                <button
                  type="button"
                  onClick={() => setPlanningSubTab('weekly')}
                  className={`flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    planningSubTab === 'weekly'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Weekly Plan</span>
                </button>
              )}

              {systemLevel >= 3 && (
                <button
                  type="button"
                  onClick={() => setPlanningSubTab('matrix')}
                  className={`flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    planningSubTab === 'matrix'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Weeks Matrix</span>
                </button>
              )}

              {systemLevel >= 5 && (
                <button
                  type="button"
                  onClick={() => setPlanningSubTab('three_year')}
                  className={`flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    planningSubTab === 'three_year'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>3-Year Plan</span>
                </button>
              )}
            </div>

            {/* Clear PROMINENT "Create Plan" button */}
            <button
              type="button"
              onClick={openCreatePlanModal}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create Plan</span>
            </button>

          </div>

        </div>
      </div>

      {/* Missing Plan Notification Banner (Day / Week Plan Reminder) */}
      {!dismissedAlerts && missingPlanAlerts.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                  {missingPlanAlerts.map(a => a.title).join(' • ')}
                </div>
                <div className="text-xs text-slate-300">
                  {missingPlanAlerts.map(a => a.message).join(' ')}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
              {missingPlanAlerts.map(alert => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => {
                    setSelectedDate(todayDate);
                    setPlanningSubTab(alert.targetSubTab);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
                >
                  {alert.actionLabel}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDismissedAlerts(true)}
                className="p-1.5 text-slate-400 hover:text-slate-200"
                title="Dismiss reminder"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: DAILY PLANNING */}
      {planningSubTab === 'daily' && (
        <DailyTrackerView
          onOpenGWS={onOpenGWS}
          onCustomizeTemplate={onCustomizeTemplate}
        />
      )}

      {/* VIEW 2: WEEKLY PLANNING */}
      {planningSubTab === 'weekly' && (
        <WeeklyGoalCrusherView />
      )}

      {/* VIEW 2B: WEEKS MATRIX */}
      {planningSubTab === 'matrix' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <SpreadsheetMatrixView />
        </div>
      )}

      {/* VIEW 3: 3-YEAR STRATEGIC PLAN */}
      {planningSubTab === 'three_year' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-8">

          {/* Executive Vision Banner */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Strategic Horizon
                </span>
                <input
                  type="text"
                  value={threeYearPlan.targetHorizon}
                  onChange={(e) => handleTargetHorizonChange(e.target.value)}
                  placeholder="2026 — 2029"
                  aria-label="Target Horizon"
                  className="bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-1 text-xs sm:text-sm font-mono font-bold text-slate-200 focus:outline-none w-36"
                />
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[11px] font-mono font-bold">
                  {allMilestonesStats.done} / {allMilestonesStats.total} milestones (
                  {allMilestonesStats.total > 0
                    ? Math.round((allMilestonesStats.done / allMilestonesStats.total) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <span className="text-xs text-slate-500 font-mono">Saved automatically</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Core 3-Year Vision & Destination
                </label>
                <textarea
                  value={threeYearPlan.vision}
                  onChange={(e) => handleVisionChange(e.target.value)}
                  placeholder="Define where you want to stand at the end of your 3-year horizon..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-sm font-medium text-amber-300 placeholder-slate-600 focus:outline-none transition-colors resize-y leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Strategy Core & Operating Thesis
                </label>
                <textarea
                  value={threeYearPlan.strategyCore}
                  onChange={(e) => handleStrategyCoreChange(e.target.value)}
                  placeholder="Define the core operating rules and weekly execution system driving this 3-year plan..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded-2xl p-4 text-sm font-medium text-cyan-300 placeholder-slate-600 focus:outline-none transition-colors resize-y leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Pillar Header Controls + Strategic Pillar Selector Tabs */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Strategic Pillars ({threeYearPlan.pillars.length})
              </div>
              <div className="flex items-center space-x-2">
                {threeYearPlan.pillars.length === 0 && (
                  <button
                    type="button"
                    onClick={handleRestoreDefaultPillars}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Restore Default Pillars</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddPillar}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Pillar</span>
                </button>
              </div>
            </div>

            {threeYearPlan.pillars.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {threeYearPlan.pillars.map((pillar) => {
                  const Icon = getPillarIcon(pillar.iconName);
                  const isSelected = currentPillar && pillar.id === currentPillar.id;
                  const all = [
                    ...(pillar.year1Milestones || []),
                    ...(pillar.year2Milestones || []),
                    ...(pillar.year3Milestones || [])
                  ];
                  const completedCount = all.filter(m => m.completed).length;
                  const totalCount = all.length;

                  return (
                    <button
                      type="button"
                      key={pillar.id}
                      onClick={() => setActiveYearPillar(pillar.id)}
                      className={`p-6 rounded-3xl text-left border transition-all ${
                        isSelected
                          ? 'bg-slate-900 border-amber-500/40 shadow-xl shadow-amber-500/10 ring-2 ring-amber-400/60'
                          : 'bg-slate-950/70 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className={`p-2.5 rounded-2xl ${
                          isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-400">
                          {completedCount} / {totalCount} done
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-100">{pillar.title || 'Untitled Pillar'}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{pillar.subtitle || 'Click to edit pillar details'}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Pillar Details or Clean Empty State */}
          {!currentPillar ? (
            <div className="bg-slate-900/90 border border-dashed border-slate-700 rounded-3xl p-10 text-center space-y-4">
              <Compass className="w-8 h-8 text-amber-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-100">No Strategic Pillars Yet</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Create your first strategic pillar to map Year 1, Year 2, and Year 3 milestones, or load the default 3 pillars.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleAddPillar}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Strategic Pillar</span>
                </button>
                <button
                  type="button"
                  onClick={handleRestoreDefaultPillars}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center space-x-1.5"
                >
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  <span>Restore Default Pillars</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* Left 4 cols: Miro-Style Strategic Boundaries & Checkpoints */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">

                  <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-orange-400">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Miro Boundaries & Rules</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Non-negotiable operational boundaries and risk rules for <strong>{currentPillar.title || 'this pillar'}</strong>:
                  </p>

                  {/* Boundaries list (inline editable) */}
                  <div className="space-y-2.5">
                    {currentPillar.boundariesAndCheckpoints.length === 0 ? (
                      <div className="p-3 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-xs text-slate-500 text-center">
                        No boundaries added yet.
                      </div>
                    ) : (
                      currentPillar.boundariesAndCheckpoints.map((b, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 gap-2"
                        >
                          <span className="text-amber-400 font-bold shrink-0 pl-1">•</span>
                          <input
                            type="text"
                            value={b}
                            onChange={(e) => handleEditBoundary(currentPillar.id, idx, e.target.value)}
                            className="flex-1 min-w-0 bg-transparent text-xs text-slate-200 focus:outline-none focus:text-amber-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteBoundary(currentPillar.id, idx)}
                            className="text-slate-600 hover:text-rose-400 p-1 shrink-0"
                            title="Delete boundary"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add boundary form */}
                  <form onSubmit={(e) => handleAddBoundary(currentPillar.id, e)} className="pt-2 flex items-center space-x-2">
                    <input
                      type="text"
                      value={newBoundaryText}
                      onChange={(e) => setNewBoundaryText(e.target.value)}
                      placeholder="Add rule or boundary..."
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newBoundaryText.trim()}
                      className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs"
                    >
                      + Add
                    </button>
                  </form>

                </div>
              </div>

              {/* Right 8 cols: Pillar Meta Editor + Year 1 -> Year 2 -> Year 3 Milestone Runway */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">

                  {/* Editable Active Pillar Title, Subtitle & Delete */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
                    <div className="flex-1 space-y-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 block">
                        Strategic Runway (Click title or subtitle to edit)
                      </span>
                      <input
                        type="text"
                        value={currentPillar.title}
                        onChange={(e) => handleUpdatePillarMeta(currentPillar.id, { title: e.target.value })}
                        placeholder="Pillar title..."
                        className="w-full bg-transparent text-lg font-bold text-slate-100 focus:outline-none focus:text-amber-300"
                      />
                      <input
                        type="text"
                        value={currentPillar.subtitle}
                        onChange={(e) => handleUpdatePillarMeta(currentPillar.id, { subtitle: e.target.value })}
                        placeholder="Pillar subtitle / scope..."
                        className="w-full bg-transparent text-xs text-slate-400 focus:outline-none focus:text-slate-200"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePillar(currentPillar.id)}
                      className="self-start flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 text-xs font-semibold transition-colors shrink-0"
                      title="Delete this pillar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Pillar</span>
                    </button>
                  </div>

                  {/* Unified Year 1, Year 2, Year 3 Sections */}
                  {yearSections.map((sec, secIdx) => {
                    const milestones = currentPillar[sec.key] || [];
                    const draft = yearMilestoneDrafts[sec.key] || '';

                    return (
                      <div
                        key={sec.key}
                        className={`space-y-3 ${secIdx > 0 ? 'pt-4 border-t border-slate-800/80' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider">
                            <span className={`px-2 py-0.5 rounded-md border ${sec.badgeClass}`}>
                              {sec.badgeLabel}
                            </span>
                            <span className="text-slate-300">{sec.subtitle}</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-500">
                            {milestones.filter(m => m.completed).length}/{milestones.length} done
                          </span>
                        </div>

                        <div className="space-y-2">
                          {milestones.length === 0 ? (
                            <div className="p-3 rounded-2xl bg-slate-950/50 border border-dashed border-slate-800 text-xs text-slate-500">
                              No {sec.badgeLabel} milestones yet.
                            </div>
                          ) : (
                            milestones.map((m) => {
                              const inActiveWeek = isMilestoneInActiveWeek(m.text);

                              return (
                                <div
                                  key={m.id}
                                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl border transition-all ${
                                    m.completed
                                      ? sec.activeCardClass
                                      : 'bg-slate-950 border-slate-800 text-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleMilestone(currentPillar.id, sec.key, m.id)}
                                      className="shrink-0"
                                      title={m.completed ? 'Mark milestone incomplete' : 'Mark milestone completed'}
                                    >
                                      {m.completed ? (
                                        <CheckCircle2 className={`w-4 h-4 ${sec.iconDoneClass}`} />
                                      ) : (
                                        <Circle className="w-4 h-4 text-slate-500 hover:text-amber-400" />
                                      )}
                                    </button>
                                    <input
                                      type="text"
                                      value={m.text}
                                      onChange={(e) =>
                                        handleEditMilestone(currentPillar.id, sec.key, m.id, e.target.value)
                                      }
                                      className={`w-full bg-transparent text-xs focus:outline-none ${
                                        m.completed ? 'line-through text-slate-400' : 'text-slate-100 font-medium'
                                      }`}
                                    />
                                  </div>

                                  <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                                    {activeWeeklyPlan && (
                                      <button
                                        type="button"
                                        onClick={() => handlePullMilestoneToActiveWeek(m.text)}
                                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                                          inActiveWeek
                                            ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/30'
                                            : 'bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-800'
                                        }`}
                                        title={
                                          inActiveWeek
                                            ? `Already in Week ${activeWeeklyPlan.weekNumber} — click to open Weekly Plan`
                                            : `Pull into Week ${activeWeeklyPlan.weekNumber} Goal Crusher`
                                        }
                                      >
                                        {inActiveWeek
                                          ? `✓ In Week ${activeWeeklyPlan.weekNumber}`
                                          : `+ Pull to Week ${activeWeeklyPlan.weekNumber}`}
                                      </button>
                                    )}

                                    <select
                                      value={sec.key}
                                      onChange={(e) =>
                                        handleMoveMilestoneYear(
                                          currentPillar.id,
                                          sec.key,
                                          e.target.value as MilestoneYearKey,
                                          m.id
                                        )
                                      }
                                      aria-label="Move milestone year"
                                      title="Move milestone between Year 1 / 2 / 3"
                                      className="bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg px-1.5 py-1 text-[10px] font-mono focus:outline-none cursor-pointer"
                                    >
                                      <option value="year1Milestones">Y1</option>
                                      <option value="year2Milestones">Y2</option>
                                      <option value="year3Milestones">Y3</option>
                                    </select>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMilestone(currentPillar.id, sec.key, m.id)}
                                      className="text-slate-600 hover:text-rose-400 p-1"
                                      title="Delete milestone"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Inline Quick-Add directly inside each Year section */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!draft.trim()) return;
                            handleAddMilestoneForYear(currentPillar.id, sec.key, draft);
                            setYearMilestoneDrafts(prev => ({ ...prev, [sec.key]: '' }));
                          }}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="text"
                            value={draft}
                            onChange={(e) =>
                              setYearMilestoneDrafts(prev => ({ ...prev, [sec.key]: e.target.value }))
                            }
                            placeholder={`Add ${sec.badgeLabel} milestone...`}
                            className="flex-1 bg-slate-950/70 border border-slate-800/90 focus:border-amber-500/50 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={!draft.trim()}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 disabled:opacity-40 text-slate-200 text-xs font-bold transition-colors"
                          >
                            + Add
                          </button>
                        </form>
                      </div>
                    );
                  })}

                  {/* Unified Bottom Add milestone form */}
                  <form
                    onSubmit={(e) => handleAddMilestone(currentPillar.id, e)}
                    className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-2"
                  >
                    <select
                      value={selectedMilestoneYear}
                      onChange={(e) => setSelectedMilestoneYear(e.target.value as 'year1' | 'year2' | 'year3')}
                      className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="year1">Year 1</option>
                      <option value="year2">Year 2</option>
                      <option value="year3">Year 3</option>
                    </select>
                    <input
                      type="text"
                      value={newMilestoneText}
                      onChange={(e) => setNewMilestoneText(e.target.value)}
                      placeholder="Add milestone checkpoint..."
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newMilestoneText.trim()}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs"
                    >
                      + Add Milestone
                    </button>
                  </form>

                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* CREATE PLAN MODAL (Clear, Obvious Creation for Weeks and Days) */}
      {showCreatePlanModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl space-y-6 relative my-4 sm:my-8">

            <button
              type="button"
              onClick={() => setShowCreatePlanModal(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-slate-950 text-slate-400 hover:text-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                <FilePlus className="w-4 h-4" />
                <span>Create New Plan</span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-100 mt-1">
                Where would you like to plan?
              </h2>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-2 gap-3 p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setCreatePlanType('weekly')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                  createPlanType === 'weekly'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🎯 New Weekly Plan
              </button>
              <button
                type="button"
                onClick={() => setCreatePlanType('daily')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                  createPlanType === 'daily'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📅 New Daily Plan
              </button>
            </div>

            {/* Weekly Plan Creation Form */}
            {createPlanType === 'weekly' && (
              <form onSubmit={handleCreateWeeklyPlanSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Week #</label>
                    <input
                      type="number"
                      min={1}
                      value={newWeekNum}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                        const range = getWeekRangeForWeekNumber(val);
                        setNewWeekNum(val);
                        setNewWeekStart(range.startDate);
                        setNewWeekEnd(range.endDate);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold font-mono text-amber-400 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Start Date</label>
                    <input
                      type="date"
                      value={newWeekStart}
                      onChange={(e) => setNewWeekStart(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">End Date</label>
                    <input
                      type="date"
                      value={newWeekEnd}
                      onChange={(e) => setNewWeekEnd(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Weekly Focus Headline (Optional)</label>
                  <input
                    type="text"
                    value={newWeekFocus}
                    onChange={(e) => setNewWeekFocus(e.target.value)}
                    placeholder="e.g. Discord cohort onboarding & Miro trading checkpoints"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-sm text-slate-100 focus:outline-none"
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-normal">
                  ⚡ Creates a clean blank Week {newWeekNum} sheet ({newWeekStart} → {newWeekEnd}) where you can add your own goals and custom rewards.
                </p>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20"
                >
                  Create Week {newWeekNum} Plan & Open
                </button>
              </form>
            )}

            {/* Daily Plan Creation Form */}
            {createPlanType === 'daily' && (
              <form onSubmit={handleCreateDailyPlanSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Target Date</label>
                  <input
                    type="date"
                    value={newPlanDate}
                    onChange={(e) => setNewPlanDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-mono text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Daily Priorities / Plan (Optional)</label>
                  <textarea
                    value={newPlanNotes}
                    onChange={(e) => setNewPlanNotes(e.target.value)}
                    placeholder="1 finish discord onboarding&#10;2 boot camp&#10;3 assess situation..."
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20"
                >
                  Open Plan for {newPlanDate}
                </button>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
