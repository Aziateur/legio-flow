import React, { useState, useEffect } from 'react';
import { useStorage, ReviewSubTab, getCurrentWeekRange } from '../../context/StorageContext';
import { WeeklyPlan, ReviewEntry } from '../../types/schema';
import { QuickCopyPasteBar } from '../common/QuickCopyPasteBar';
import { 
  FileText, 
  Timer, 
  Target, 
  TrendingUp, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Flame, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Gift, 
  Award, 
  BookOpen, 
  Filter, 
  Copy, 
  ExternalLink, 
  Layers, 
  Plus, 
  X, 
  FilePlus 
} from 'lucide-react';

export const ReviewHub: React.FC = () => {
  const { 
    reviewSubTab, 
    setReviewSubTab,
    selectedDate, 
    setSelectedDate, 
    goToPreviousDay, 
    goToNextDay, 
    getEntryForDate,
    saveDailyEntry,
    dailyEntries,
    gwsSessions,
    addGWSSession,
    deleteGWSSession,
    weeklyPlans,
    selectedWeekId,
    setSelectedWeekId,
    saveWeeklyPlan,
    reviews,
    systemLevel,
    saveReview,
    deleteReview,
    setSelectedDate: selectDateGlobal,
    setSelectedWeekId: selectWeekGlobal
  } = useStorage();

  const currentDailyEntry = getEntryForDate(selectedDate);
  const currentWeeklyPlan = weeklyPlans[selectedWeekId] || weeklyPlans['week_1'] || Object.values(weeklyPlans)[0];

  // Create Review Modal state
  const [showCreateReviewModal, setShowCreateReviewModal] = useState(false);
  const [createReviewType, setCreateReviewType] = useState<'weekly' | 'daily' | 'gws'>('weekly');

  // Vault states
  const [vaultFilter, setVaultFilter] = useState<'all' | 'daily' | 'weekly' | 'gws'>('all');
  const [vaultSearch, setVaultSearch] = useState('');
  const [copiedReviewId, setCopiedReviewId] = useState<string | null>(null);

  // GWS filter states
  const [gwsSearchQuery, setGwsSearchQuery] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Weekly review form states
  const [reviewTargetWeekId, setReviewTargetWeekId] = useState<string>(selectedWeekId);
  const targetPlanForReview = weeklyPlans[reviewTargetWeekId] || currentWeeklyPlan;

  const [reviewTitle, setReviewTitle] = useState(`Week ${targetPlanForReview.weekNumber} Retrospective & Course Correction`);
  const [winsText, setWinsText] = useState('');
  const [blockersText, setBlockersText] = useState('');
  const [courseCorrectionsText, setCourseCorrectionsText] = useState(targetPlanForReview.reviewNotes || '');
  const [clarityRating, setClarityRating] = useState(4);
  const [consistencyRating, setConsistencyRating] = useState(4);
  const [overallRating, setOverallRating] = useState(4);

  // Create New Week in Review modal
  const [showNewWeekForm, setShowNewWeekForm] = useState(false);
  const existingWeekNums = Object.values(weeklyPlans).map(p => p.weekNumber);
  const maxWeekNum = existingWeekNums.length > 0 ? Math.max(...existingWeekNums) : 1;
  const [modalNewWeekNum, setModalNewWeekNum] = useState<number>(maxWeekNum + 1);
  const [modalNewWeekFocus, setModalNewWeekFocus] = useState<string>('');

  // Daily review modal states
  const [modalDailyDate, setModalDailyDate] = useState<string>(selectedDate);
  const [modalDailyScore, setModalDailyScore] = useState<number>(8);
  const [modalDailyNotes, setModalDailyNotes] = useState<string>('');

  // GWS quick review modal states
  const [modalGwsTask, setModalGwsTask] = useState<string>('');
  const [modalGwsPlanned, setModalGwsPlanned] = useState<number>(50);
  const [modalGwsActual, setModalGwsActual] = useState<number>(50);
  const [modalGwsFocus, setModalGwsFocus] = useState<number>(4);
  const [modalGwsExecution, setModalGwsExecution] = useState<number>(4);
  const [modalGwsOutput, setModalGwsOutput] = useState<number>(4);
  const [modalGwsAccomplished, setModalGwsAccomplished] = useState<string>('');
  const [modalGwsHeldBack, setModalGwsHeldBack] = useState<string>('');
  const [modalGwsImproveNext, setModalGwsImproveNext] = useState<string>('');

  // Auto-sync weekly review form when target plan changes
  useEffect(() => {
    const plan = weeklyPlans[reviewTargetWeekId] || currentWeeklyPlan;
    setReviewTitle(`Week ${plan.weekNumber} Retrospective: ${plan.focusTheme}`);
    if (plan.reviewNotes) {
      setCourseCorrectionsText(plan.reviewNotes);
    }
  }, [reviewTargetWeekId, currentWeeklyPlan]);

  // Computed GWS metrics
  const totalGwsHours = (gwsSessions.reduce((acc, s) => acc + (s.actualMinutes || 0), 0) / 60).toFixed(1);
  const avgGwsScore = (gwsSessions.reduce((acc, s) => acc + s.ratings.total, 0) / Math.max(1, gwsSessions.length)).toFixed(1);
  const avgFocus = (gwsSessions.reduce((acc, s) => acc + s.ratings.focus, 0) / Math.max(1, gwsSessions.length)).toFixed(1);
  const avgExecution = (gwsSessions.reduce((acc, s) => acc + s.ratings.execution, 0) / Math.max(1, gwsSessions.length)).toFixed(1);
  const avgOutput = (gwsSessions.reduce((acc, s) => acc + s.ratings.output, 0) / Math.max(1, gwsSessions.length)).toFixed(1);

  // Filtered GWS
  const filteredGwsSessions = gwsSessions.filter(s =>
    s.taskName.toLowerCase().includes(gwsSearchQuery.toLowerCase()) ||
    s.reflexions.accomplished.toLowerCase().includes(gwsSearchQuery.toLowerCase()) ||
    s.reflexions.heldBack.toLowerCase().includes(gwsSearchQuery.toLowerCase()) ||
    s.date.includes(gwsSearchQuery)
  );

  // Extract all blockers
  const allBlockers = gwsSessions
    .filter(s => s.reflexions.heldBack.trim().length > 0)
    .map(s => ({ date: s.date, task: s.taskName, text: s.reflexions.heldBack }));

  // Extract all improvements
  const allImprovements = gwsSessions
    .filter(s => s.reflexions.improveNext.trim().length > 0)
    .map(s => ({ date: s.date, task: s.taskName, text: s.reflexions.improveNext }));

  // --- UNIFIED VAULT ITEMS AGGREGATION ---
  interface VaultItem {
    id: string;
    type: 'daily' | 'weekly' | 'gws';
    dateOrPeriod: string;
    title: string;
    scoreBadge?: string;
    scoreNumber?: number;
    plannedOrContext?: string;
    reviewContent: string;
    secondaryContent?: string;
    rawDate: string;
    jumpTarget?: () => void;
  }

  // 1. Gather all Daily reviews
  const dailyVaultItems: VaultItem[] = Object.values(dailyEntries)
    .filter(d => (d.reviewNotes && d.reviewNotes.trim().length > 0) || d.executionScore > 0 || (d.planNotes && d.planNotes.trim().length > 0))
    .map(d => ({
      id: `vault_daily_${d.date}`,
      type: 'daily',
      dateOrPeriod: d.date,
      title: `Daily Review: ${d.date}`,
      scoreBadge: d.executionScore > 0 ? `Execution ${d.executionScore}/10` : undefined,
      scoreNumber: d.executionScore,
      plannedOrContext: d.planNotes ? `Mission Plan:\n${d.planNotes}` : undefined,
      reviewContent: d.reviewNotes || 'No specific course correction note logged.',
      secondaryContent: `Tasks Completed: ${d.mainTasksCompleted}/${d.mainTasksTotal} • Automatic Habits: ${d.automaticTasksCompleted ? 'Yes (Locked In)' : 'Pending'} • GWS Sessions: ${d.gwsSessionIds.length}`,
      rawDate: d.date,
      jumpTarget: () => {
        selectDateGlobal(d.date);
        setReviewSubTab('daily');
      }
    }));

  // 2. Gather all Weekly reviews
  const weeklyVaultItems: VaultItem[] = Object.values(weeklyPlans).map(w => ({
    id: `vault_weekly_${w.id}`,
    type: 'weekly',
    dateOrPeriod: `Week ${w.weekNumber} (${w.startDate} → ${w.endDate})`,
    title: `Week ${w.weekNumber} Retrospective: "${w.focusTheme}"`,
    scoreBadge: `${w.achievedScore}/${w.totalPossibleScore} pts`,
    scoreNumber: w.achievedScore,
    plannedOrContext: `Focus: ${w.focusTheme}\nTasks: ${w.tasks.map(t => `${t.completed ? '[x]' : '[ ]'} ${t.text} (${t.score}pts)`).join('\n')}`,
    reviewContent: w.reviewNotes || (w.achievedScore >= 6 ? `Achieved ${w.achievedScore}/10 points. Unlocked rewards: ${w.rewards.filter(r => w.achievedScore >= r.minScore).map(r => r.reward).join(', ')}` : 'Weekly retrospective pending.'),
    secondaryContent: `Unlocked Tiers: ${w.rewards.filter(r => w.achievedScore >= r.minScore).map(r => `${r.minScore}+ (${r.reward})`).join(' • ') || 'None yet'}`,
    rawDate: w.endDate,
    jumpTarget: () => {
      selectWeekGlobal(w.id);
      setReviewSubTab('weekly');
    }
  }));

  // 3. Gather all GWS reflexions
  const gwsVaultItems: VaultItem[] = gwsSessions.map(s => ({
    id: `vault_gws_${s.id}`,
    type: 'gws',
    dateOrPeriod: s.date,
    title: `GWS Sprint: ${s.taskName}`,
    scoreBadge: `${s.ratings.total}/15 Score`,
    scoreNumber: s.ratings.total,
    plannedOrContext: `Duration: ${s.actualMinutes}m actual (Planned: ${s.plannedMinutes}m) • Focus: ${s.ratings.focus}/5 • Execution: ${s.ratings.execution}/5 • Output: ${s.ratings.output}/5`,
    reviewContent: `1. Accomplished:\n${s.reflexions.accomplished || 'N/A'}\n\n2. What Held Me Back:\n${s.reflexions.heldBack || 'None'}\n\n3. What Will I Improve Next:\n${s.reflexions.improveNext || 'N/A'}`,
    rawDate: s.date,
    jumpTarget: () => {
      setReviewSubTab('gws');
      setExpandedSessionId(s.id);
    }
  }));

  // Combine and sort chronologically (most recent first)
  const allVaultItems: VaultItem[] = [...dailyVaultItems, ...weeklyVaultItems, ...gwsVaultItems]
    .sort((a, b) => b.rawDate.localeCompare(a.rawDate));

  // Filter vault items
  const filteredVaultItems = allVaultItems.filter(item => {
    if (vaultFilter !== 'all' && item.type !== vaultFilter) return false;
    if (!vaultSearch.trim()) return true;
    const q = vaultSearch.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.reviewContent.toLowerCase().includes(q) ||
      item.dateOrPeriod.toLowerCase().includes(q) ||
      (item.plannedOrContext && item.plannedOrContext.toLowerCase().includes(q))
    );
  });

  const handleCopyReview = (item: VaultItem) => {
    const markdown = `# ${item.title}\n**Date/Period:** ${item.dateOrPeriod}\n${item.scoreBadge ? `**Score:** ${item.scoreBadge}\n` : ''}\n${item.plannedOrContext ? `## Context\n${item.plannedOrContext}\n\n` : ''}## Review & Reflexions\n${item.reviewContent}\n\n${item.secondaryContent ? `## Telemetry\n${item.secondaryContent}\n` : ''}`;
    navigator.clipboard.writeText(markdown);
    setCopiedReviewId(item.id);
    setTimeout(() => setCopiedReviewId(null), 2000);
  };

  // Create new week helper
  const handleCreateNewWeekDirect = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `week_${modalNewWeekNum}`;
    const currentRange = getCurrentWeekRange(selectedDate);
    const newPlan: WeeklyPlan = {
      id: newId,
      weekNumber: modalNewWeekNum,
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
      focusTheme: modalNewWeekFocus.trim(),
      notes: '',
      tasks: [],
      totalPossibleScore: 10,
      achievedScore: 0,
      rewards: [],
      updatedAt: new Date().toISOString()
    };

    saveWeeklyPlan(newPlan);
    setSelectedWeekId(newId);
    setReviewTargetWeekId(newId);
    setShowNewWeekForm(false);
    setModalNewWeekFocus('');
  };

  // Handlers for weekly save
  const handleSaveWeeklyReview = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPlan = weeklyPlans[reviewTargetWeekId] || currentWeeklyPlan;

    const fullReviewNotes = `${winsText ? `Wins & Shipped:\n${winsText}\n\n` : ''}${blockersText ? `Divergence & Blockers:\n${blockersText}\n\n` : ''}${courseCorrectionsText ? `Course Corrections:\n${courseCorrectionsText}` : ''}`;

    saveReview({
      id: `rev_${Date.now()}`,
      title: reviewTitle.trim() || `Week ${targetPlan.weekNumber} Retrospective`,
      periodType: 'weekly',
      startDate: targetPlan.startDate,
      endDate: targetPlan.endDate,
      wins: winsText.trim(),
      blockers: blockersText.trim(),
      courseCorrections: courseCorrectionsText.trim(),
      ratings: {
        clarity: clarityRating,
        consistency: consistencyRating,
        overall: overallRating
      },
      createdAt: new Date().toISOString()
    });

    saveWeeklyPlan({
      ...targetPlan,
      reviewNotes: fullReviewNotes.trim()
    });

    alert(`Week ${targetPlan.weekNumber} Retrospective saved to the Review Vault!`);
    setShowCreateReviewModal(false);
    setReviewSubTab('vault');
  };

  // Handlers for daily save in modal
  const handleSaveDailyReviewModal = (e: React.FormEvent) => {
    e.preventDefault();
    saveDailyEntry(modalDailyDate, {
      executionScore: modalDailyScore,
      reviewNotes: modalDailyNotes.trim()
    });
    alert(`Daily review for ${modalDailyDate} saved to the Review Vault!`);
    setShowCreateReviewModal(false);
    setReviewSubTab('vault');
  };

  // Handlers for GWS save in modal
  const handleSaveGwsModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalGwsTask.trim()) return;

    addGWSSession({
      date: selectedDate,
      taskName: modalGwsTask.trim(),
      plannedMinutes: modalGwsPlanned,
      actualMinutes: modalGwsActual,
      ratings: {
        focus: modalGwsFocus,
        execution: modalGwsExecution,
        output: modalGwsOutput,
        total: modalGwsFocus + modalGwsExecution + modalGwsOutput
      },
      reflexions: {
        accomplished: modalGwsAccomplished.trim(),
        heldBack: modalGwsHeldBack.trim(),
        improveNext: modalGwsImproveNext.trim()
      }
    });

    alert('GWS Session and Reflexions recorded in the Review Vault!');
    setShowCreateReviewModal(false);
    setModalGwsTask('');
    setReviewSubTab('vault');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Unified Review Window Switcher Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-2 sm:p-2.5 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl">
          
          <div className="flex items-center space-x-3 px-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                Review Command & Vault
              </div>
              <div className="text-sm font-extrabold text-slate-100">
                {reviewSubTab === 'vault' && 'All Reviews Vault (Where All Reviews Live)'}
                {reviewSubTab === 'daily' && 'Daily Review & Reflexion'}
                {reviewSubTab === 'gws' && 'GWS Sprint Telemetry & Bottlenecks'}
                {reviewSubTab === 'weekly' && 'Weekly Retrospective & Milestones'}
              </div>
            </div>
          </div>

          {/* Switcher & Action Button */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            
            {/* Segmented Switcher Controls filtered by systemLevel */}
            <div className="flex items-center space-x-1 p-1 rounded-2xl bg-slate-950 border border-slate-800/80 overflow-x-auto">
              <button
                onClick={() => setReviewSubTab('vault')}
                className={`flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  reviewSubTab === 'vault'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Vault ({allVaultItems.length})</span>
              </button>

              <button
                onClick={() => setReviewSubTab('daily')}
                className={`flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  reviewSubTab === 'daily'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Daily Review</span>
              </button>

              {systemLevel >= 2 && (
                <button
                  onClick={() => setReviewSubTab('gws')}
                  className={`flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    reviewSubTab === 'gws'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Timer className="w-3.5 h-3.5" />
                  <span>GWS Review</span>
                </button>
              )}

              {systemLevel >= 3 && (
                <button
                  onClick={() => setReviewSubTab('weekly')}
                  className={`flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    reviewSubTab === 'weekly'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Weekly Review</span>
                </button>
              )}
            </div>

            {/* Clear PROMINENT "Create Review" Button */}
            <button
              onClick={() => {
                setCreateReviewType(reviewSubTab === 'weekly' ? 'weekly' : reviewSubTab === 'daily' ? 'daily' : 'weekly');
                setShowCreateReviewModal(true);
              }}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Review</span>
            </button>

          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 0: ALL REVIEWS VAULT (WHERE ALL REVIEWS LIVE)                     */}
      {/* ========================================================================= */}
      {reviewSubTab === 'vault' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-6">
          
          {/* Header Banner & Filter Strip */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Master Review Archive
                </span>
                <h1 className="text-2xl font-extrabold text-slate-100 mt-2">
                  The Review Vault
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  The centralized archive where all your Daily Reviews, GWS Sprint Reflexions, and Weekly Retrospectives live.
                </p>
              </div>

              {/* Action + Total Counts Ticker */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setCreateReviewType('weekly');
                    setShowCreateReviewModal(true);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ New Review</span>
                </button>

                <div className="flex items-center space-x-2 text-xs font-mono">
                  <div className="px-3 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-slate-500 block text-[9px]">TOTAL</span>
                    <strong className="text-base text-amber-400 font-extrabold">{allVaultItems.length}</strong>
                  </div>
                  <div className="px-3 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-slate-500 block text-[9px]">WEEKLY</span>
                    <strong className="text-base text-slate-200 font-extrabold">{weeklyVaultItems.length}</strong>
                  </div>
                  <div className="px-3 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-slate-500 block text-[9px]">DAILY</span>
                    <strong className="text-base text-slate-200 font-extrabold">{dailyVaultItems.length}</strong>
                  </div>
                  <div className="px-3 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-slate-500 block text-[9px]">GWS</span>
                    <strong className="text-base text-slate-200 font-extrabold">{gwsVaultItems.length}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Pills + Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
              
              {/* Type Filter Chips */}
              <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
                <button
                  onClick={() => setVaultFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    vaultFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  All ({allVaultItems.length})
                </button>

                <button
                  onClick={() => setVaultFilter('weekly')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    vaultFilter === 'weekly'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  🎯 Weekly Retrospectives ({weeklyVaultItems.length})
                </button>

                <button
                  onClick={() => setVaultFilter('daily')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    vaultFilter === 'daily'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  📅 Daily Reviews ({dailyVaultItems.length})
                </button>

                <button
                  onClick={() => setVaultFilter('gws')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    vaultFilter === 'gws'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  ⏱️ GWS Reflexions ({gwsVaultItems.length})
                </button>
              </div>

              {/* Keyword Search */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  placeholder="Search all reviews, dates, blockers..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

            </div>

          </div>

          {/* Reviews Stream Feed */}
          <div className="space-y-4">
            {filteredVaultItems.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 text-slate-500 text-xs">
                No reviews found matching your search. Click "+ Create Review" above to write a review!
              </div>
            ) : (
              filteredVaultItems.map((item) => {
                const isCopied = copiedReviewId === item.id;

                const getTypeStyle = () => {
                  if (item.type === 'daily') return {
                    label: 'Daily Review',
                    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    icon: CalendarIcon
                  };
                  if (item.type === 'weekly') return {
                    label: 'Weekly Retrospective',
                    color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    icon: Target
                  };
                  return {
                    label: 'GWS Sprint Reflexion',
                    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    icon: Timer
                  };
                };

                const typeStyle = getTypeStyle();
                const Icon = typeStyle.icon;

                return (
                  <div
                    key={item.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 sm:p-7 shadow-xl transition-all space-y-4"
                  >
                    {/* Top Row: Type, Title, Score, and Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      <div className="flex items-center space-x-3">
                        <span className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border ${typeStyle.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          <span>{typeStyle.label}</span>
                        </span>
                        
                        <span className="text-xs font-mono font-bold text-slate-400">
                          {item.dateOrPeriod}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 self-end sm:self-center">
                        {item.scoreBadge && (
                          <span className="text-xs font-mono font-extrabold px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-amber-400">
                            {item.scoreBadge}
                          </span>
                        )}

                        <button
                          onClick={() => handleCopyReview(item)}
                          className="flex items-center space-x-1 p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs transition-colors"
                          title="Copy Review as Markdown"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{isCopied ? 'Copied!' : 'Copy'}</span>
                        </button>

                        {item.jumpTarget && (
                          <button
                            onClick={item.jumpTarget}
                            className="flex items-center space-x-1 p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-400 hover:text-amber-300 border border-slate-800 text-xs transition-colors"
                            title="Jump to edit this review"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Inspect / Edit</span>
                          </button>
                        )}
                      </div>

                    </div>

                    <h3 className="text-base font-bold text-slate-100">
                      {item.title}
                    </h3>

                    {/* Context / Plan snippet if available */}
                    {item.plannedOrContext && (
                      <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 whitespace-pre-wrap leading-relaxed">
                        {item.plannedOrContext}
                      </div>
                    )}

                    {/* Main Review Content Box */}
                    <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block">
                        Recorded Reflexions & Course Correction:
                      </span>
                      <p>{item.reviewContent}</p>
                    </div>

                    {/* Secondary Telemetry Details */}
                    {item.secondaryContent && (
                      <div className="text-[11px] text-slate-500 font-mono pt-2 border-t border-slate-800/80">
                        {item.secondaryContent}
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 1: DAILY REVIEW                                                  */}
      {/* ========================================================================= */}
      {reviewSubTab === 'daily' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-8">
          
          {/* Day Navigation Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
            <div className="flex items-center space-x-3">
              <button
                onClick={goToPreviousDay}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center sm:text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reviewing Record for:</span>
                <div className="text-lg font-extrabold text-amber-400 font-mono">{selectedDate}</div>
              </div>
              <button
                onClick={goToNextDay}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics for the selected date */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-500">Tasks: </span>
                <strong className="text-slate-200 font-mono">{currentDailyEntry.mainTasksCompleted}/{currentDailyEntry.mainTasksTotal}</strong>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-500">Discipline: </span>
                <strong className="text-amber-400 font-mono">{currentDailyEntry.executionScore}/10</strong>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-500">Habits: </span>
                <strong className={currentDailyEntry.automaticTasksCompleted ? 'text-emerald-400' : 'text-slate-500'}>
                  {currentDailyEntry.automaticTasksCompleted ? 'Locked' : 'Pending'}
                </strong>
              </div>
            </div>
          </div>

          {/* Fast Data I/O Bar (Copy Plan / Copy Review separately) */}
          <QuickCopyPasteBar
            currentEntry={currentDailyEntry}
            gwsSessions={gwsSessions}
            onApplyParsedPlan={(tasksText) => {
              const existing = currentDailyEntry.planNotes ? `${currentDailyEntry.planNotes}\n` : '';
              saveDailyEntry(selectedDate, { planNotes: `${existing}${tasksText}` });
            }}
          />

          {/* Daily Review & Course Correction Editor */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left 5 cols: Telemetry & Day Plan Recap */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Daily Execution Score (1-10) Interactive Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Flame className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
                      Execution Discipline Score (1–10)
                    </span>
                  </div>
                  <span className="text-xs font-extrabold font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {currentDailyEntry.executionScore > 0 ? `${currentDailyEntry.executionScore}/10` : 'Not Rated'}
                  </span>
                </div>

                <div className="grid grid-cols-10 gap-1 pt-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => saveDailyEntry(selectedDate, { executionScore: score })}
                      className={`py-2 rounded-xl text-xs font-bold font-mono transition-all ${
                        currentDailyEntry.executionScore === score
                          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 font-extrabold shadow-md shadow-amber-500/20'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>

                <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
                  <span>1: Low Discipline</span>
                  <span>6: Solid Baseline</span>
                  <span>10: Flawless Beast</span>
                </div>
              </div>

              {/* Automatic Tasks Completed Toggle Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-100 block">
                    Automatic Habits Completed?
                  </span>
                  <span className="text-[11px] text-slate-400">Routines, hydration, boot camp, backups</span>
                </div>
                <button
                  type="button"
                  onClick={() => saveDailyEntry(selectedDate, { automaticTasksCompleted: !currentDailyEntry.automaticTasksCompleted })}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    currentDailyEntry.automaticTasksCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {currentDailyEntry.automaticTasksCompleted ? 'Yes (Locked In)' : 'No (Pending)'}
                </button>
              </div>

              {/* Day Plan Recap */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  What Was Planned for {selectedDate}
                </span>
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {currentDailyEntry.planNotes || 'No specific mission plan logged for this date.'}
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>GWS Sprints: <strong className="text-slate-200">{currentDailyEntry.gwsSessionIds.length}</strong></span>
                  <span>Autosaved</span>
                </div>
              </div>

            </div>

            {/* Right 7 cols: Write Course Correction */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
                <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                  <span>Daily Reflexion & Course Correction Note</span>
                </div>
                <p className="text-xs text-slate-400">
                  Write what held you back today and specify adjustments for tomorrow's work blocks:
                </p>

                <textarea
                  value={currentDailyEntry.reviewNotes || ''}
                  onChange={(e) => saveDailyEntry(selectedDate, { reviewNotes: e.target.value })}
                  rows={6}
                  placeholder="Reflect on today's execution: What moved the needle? What caused friction or distraction? What specific adjustment will you execute tomorrow?"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-colors resize-y leading-relaxed"
                />

                <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-800">
                  <span>Saved in Review Vault</span>
                  <span className="text-amber-400 font-mono">Updated</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: GWS SPRINT REVIEW                                             */}
      {/* ========================================================================= */}
      {reviewSubTab === 'gws' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-8">
          
          {/* Key Sprint Stats Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-medium">Total Deep Work</span>
              <div className="text-3xl font-extrabold text-amber-400 font-mono mt-1">
                {totalGwsHours} <span className="text-xs text-slate-500">hours</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">From {gwsSessions.length} sprints</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-medium">Avg Sprint Score</span>
              <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-1">
                {avgGwsScore} <span className="text-xs text-slate-500">/ 15</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Performance index</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-medium">Score Breakdown</span>
              <div className="text-xs text-slate-200 mt-2 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Focus:</span>
                  <span className="text-amber-400 font-bold">{avgFocus} / 5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Execution:</span>
                  <span className="text-amber-400 font-bold">{avgExecution} / 5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Output:</span>
                  <span className="text-amber-400 font-bold">{avgOutput} / 5</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-medium">Logged Sprints</span>
              <div className="text-3xl font-extrabold text-sky-400 font-mono mt-1">
                {gwsSessions.length}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Recorded in database</span>
            </div>
          </div>

          {/* Deep Aggregators: Blockers vs Improvement Commitments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* What held me back? */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
              <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-orange-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Recurring Bottlenecks ("What held me back?")</span>
              </div>
              <p className="text-xs text-slate-400">
                Aggregated obstacles extracted from every past sprint to identify systemic friction:
              </p>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {allBlockers.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    No blockers recorded yet.
                  </p>
                ) : (
                  allBlockers.map((b, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span className="text-orange-400">{b.date}</span>
                        <span className="truncate max-w-[200px]">{b.task}</span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">{b.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* What will I improve next session? */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
              <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-amber-400">
                <Sparkles className="w-4 h-4" />
                <span>Actionable Commitments ("What will I improve next?")</span>
              </div>
              <p className="text-xs text-slate-400">
                Review whether you held yourself accountable to these pledged adjustments:
              </p>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {allImprovements.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    No improvement commitments recorded yet.
                  </p>
                ) : (
                  allImprovements.map((imp, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span className="text-amber-400">{imp.date}</span>
                        <span className="truncate max-w-[200px]">{imp.task}</span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">{imp.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Full GWS Sessions Search & Review List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Sprint Session History ({filteredGwsSessions.length})
                </h3>
                <p className="text-xs text-slate-400">Click to expand full reflexions and metrics</p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={gwsSearchQuery}
                  onChange={(e) => setGwsSearchQuery(e.target.value)}
                  placeholder="Search task, date, or reflexion..."
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {filteredGwsSessions.map((session) => {
                const isExpanded = expandedSessionId === session.id;

                return (
                  <div
                    key={session.id}
                    className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 cursor-pointer" onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}>
                        <div className="flex items-center space-x-2 text-[11px] font-mono">
                          <span className="text-amber-400 font-bold">{session.date}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">{session.actualMinutes}m actual</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-100 mt-1">{session.taskName}</h4>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/20">
                          {session.ratings.total}/15
                        </span>
                        <button
                          onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                          className="p-1 text-slate-400 hover:text-slate-200"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete GWS session: "${session.taskName}"?`)) {
                              deleteGWSSession(session.id);
                            }
                          }}
                          className="p-1 text-slate-600 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800/80 font-mono">
                          <span>Focus: <strong className="text-slate-100">{session.ratings.focus}/5</strong></span>
                          <span>Execution: <strong className="text-slate-100">{session.ratings.execution}/5</strong></span>
                          <span>Output: <strong className="text-slate-100">{session.ratings.output}/5</strong></span>
                        </div>
                        {session.reflexions.accomplished && (
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="font-semibold text-emerald-400 block mb-0.5">1. Accomplished:</span>
                            <p className="text-slate-300">{session.reflexions.accomplished}</p>
                          </div>
                        )}
                        {session.reflexions.heldBack && (
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="font-semibold text-orange-400 block mb-0.5">2. Held Back:</span>
                            <p className="text-slate-300">{session.reflexions.heldBack}</p>
                          </div>
                        )}
                        {session.reflexions.improveNext && (
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="font-semibold text-amber-400 block mb-0.5">3. Improve Next:</span>
                            <p className="text-slate-300">{session.reflexions.improveNext}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: WEEKLY REVIEW                                                 */}
      {/* ========================================================================= */}
      {reviewSubTab === 'weekly' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-8">
          
          {/* Week Selector Bar with Clear "+ Create New Week to Review" button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-amber-500 text-slate-950 font-bold">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reviewing Cycle</span>
                <div className="text-lg font-extrabold text-slate-100">Week {targetPlanForReview.weekNumber}: {targetPlanForReview.focusTheme}</div>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1.5">
              {Object.values(weeklyPlans)
                .sort((a, b) => a.weekNumber - b.weekNumber)
                .map((p) => {
                  const isEmpty = p.tasks.length === 0 && !p.focusTheme.trim();
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedWeekId(p.id);
                        setReviewTargetWeekId(p.id);
                      }}
                      title={`Week ${p.weekNumber}: ${p.startDate} → ${p.endDate}`}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center space-x-1 ${
                        p.id === targetPlanForReview.id
                          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 shadow-md shadow-amber-500/20'
                          : isEmpty
                          ? 'bg-slate-950/60 text-slate-500 border border-dashed border-slate-800 hover:text-slate-300'
                          : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <span>Week {p.weekNumber}</span>
                      {isEmpty && p.id !== targetPlanForReview.id && (
                        <span className="text-[9px] uppercase text-slate-600 font-normal">Empty</span>
                      )}
                    </button>
                  );
                })}

              <button
                onClick={() => setShowNewWeekForm(true)}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-bold transition-colors"
                title="Create a new week to review"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Week</span>
              </button>
            </div>
          </div>

          {/* Inline Create New Week Form if open */}
          {showNewWeekForm && (
            <form onSubmit={handleCreateNewWeekDirect} className="p-6 rounded-3xl bg-slate-900 border border-amber-500/40 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Create Week {modalNewWeekNum} for Planning & Review</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewWeekForm(false)}
                  className="text-slate-400 hover:text-slate-100"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Week Number</label>
                  <input
                    type="number"
                    min={1}
                    value={modalNewWeekNum}
                    onChange={(e) => setModalNewWeekNum(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-mono font-bold text-amber-400 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Weekly Focus Theme</label>
                  <input
                    type="text"
                    value={modalNewWeekFocus}
                    onChange={(e) => setModalNewWeekFocus(e.target.value)}
                    placeholder="e.g. Scaling cohort & Miro trading roadmap"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewWeekForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                >
                  Create & Select Week {modalNewWeekNum}
                </button>
              </div>
            </form>
          )}

          {/* Goal Fulfillment & Unlocked Rewards Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Points Scored */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Points Fulfilled</span>
                <span className="text-2xl font-extrabold text-amber-400 font-mono">
                  {targetPlanForReview.achievedScore} <span className="text-slate-500 text-sm">/ {targetPlanForReview.totalPossibleScore} pts</span>
                </span>
              </div>

              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((targetPlanForReview.achievedScore / Math.max(1, targetPlanForReview.totalPossibleScore)) * 100))}%`
                  }}
                />
              </div>

              <div className="space-y-1.5 pt-2">
                {targetPlanForReview.tasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-xs text-slate-300">
                    <span className={t.completed ? 'line-through text-slate-500' : ''}>• {t.text}</span>
                    <span className="font-mono text-amber-400">{t.score} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Unlocked Reward Tiers */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-sky-400">
                  <Gift className="w-4 h-4" />
                  <span>Custom Weekly Rewards ({targetPlanForReview.rewards.length})</span>
                </div>
              </div>

              {targetPlanForReview.rewards.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-500 text-center">
                  No custom rewards configured for this week.
                </div>
              ) : (
                <div className="space-y-2">
                  {targetPlanForReview.rewards.map((r) => {
                    const unlocked = targetPlanForReview.achievedScore >= r.minScore;
                    return (
                      <div
                        key={r.id}
                        className={`flex items-center justify-between p-3 rounded-2xl border text-xs ${
                          unlocked
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 font-medium'
                            : 'bg-slate-950/60 border-slate-800 text-slate-500'
                        }`}
                      >
                        <span>{r.minScore}+ Points: {r.reward || 'Unnamed reward'}</span>
                        <span className="font-bold uppercase text-[10px]">
                          {unlocked ? 'Unlocked 🎖️' : `${r.minScore - targetPlanForReview.achievedScore} pts needed`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Write Weekly Course Correction Form */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Weekly Retrospective & Course Correction
              </span>
              <h2 className="text-xl font-extrabold text-slate-100 mt-2">
                Review Week {targetPlanForReview.weekNumber}: {targetPlanForReview.focusTheme}
              </h2>
            </div>

            <form onSubmit={handleSaveWeeklyReview} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">1. What went well & what shipped?</label>
                <textarea
                  value={winsText}
                  onChange={(e) => setWinsText(e.target.value)}
                  placeholder="Completed milestones, systems built, breakthrough insights..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl p-3 text-xs text-slate-200 focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-orange-400">2. Where did divergence or friction occur?</label>
                <textarea
                  value={blockersText}
                  onChange={(e) => setBlockersText(e.target.value)}
                  placeholder="Missed targets, unaddressed trading rules, delayed onboarding..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500/50 rounded-xl p-3 text-xs text-slate-200 focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400">3. Course corrections for next week</label>
                <textarea
                  value={courseCorrectionsText}
                  onChange={(e) => setCourseCorrectionsText(e.target.value)}
                  placeholder="What needs to happen? What needs to be learned? What systems now and what to buy?"
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-xs text-slate-100 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20"
              >
                Save Week {targetPlanForReview.weekNumber} Retrospective & Send to Vault
              </button>
            </form>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* GLOBAL CREATE REVIEW MODAL (Unambiguous, Prominent Creation Center)        */}
      {/* ========================================================================= */}
      {showCreateReviewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl space-y-6 relative my-4 sm:my-8 max-h-[92vh] overflow-y-auto">
            
            <button
              onClick={() => setShowCreateReviewModal(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-slate-950 text-slate-400 hover:text-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                <FilePlus className="w-4 h-4" />
                <span>Create New Review</span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-100 mt-1">
                What review would you like to create?
              </h2>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setCreateReviewType('weekly')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  createReviewType === 'weekly'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🎯 Weekly Review
              </button>
              <button
                type="button"
                onClick={() => setCreateReviewType('daily')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  createReviewType === 'daily'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📅 Daily Review
              </button>
              <button
                type="button"
                onClick={() => setCreateReviewType('gws')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  createReviewType === 'gws'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ⏱️ GWS Reflexion
              </button>
            </div>

            {/* FORM 1: WEEKLY REVIEW CREATION */}
            {createReviewType === 'weekly' && (
              <form onSubmit={handleSaveWeeklyReview} className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Week to Review</label>
                    <button
                      type="button"
                      onClick={() => setShowNewWeekForm(true)}
                      className="text-amber-400 hover:text-amber-300 text-xs font-semibold"
                    >
                      + Create Brand New Week
                    </button>
                  </div>
                  <select
                    value={reviewTargetWeekId}
                    onChange={(e) => setReviewTargetWeekId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none"
                  >
                    {Object.values(weeklyPlans).map(p => (
                      <option key={p.id} value={p.id}>
                        Week {p.weekNumber}: {p.focusTheme} ({p.achievedScore}/{p.totalPossibleScore} pts)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Review Title</label>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">1. Wins & What Shipped</label>
                  <textarea
                    value={winsText}
                    onChange={(e) => setWinsText(e.target.value)}
                    placeholder="Milestones achieved, systems shipped..."
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-orange-400">2. Where did divergence or friction occur?</label>
                  <textarea
                    value={blockersText}
                    onChange={(e) => setBlockersText(e.target.value)}
                    placeholder="Missed targets, unaddressed rules, delays..."
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-400">3. Specific Course Corrections</label>
                  <textarea
                    value={courseCorrectionsText}
                    onChange={(e) => setCourseCorrectionsText(e.target.value)}
                    placeholder="What needs to happen? What to learn? What systems/tools to buy?"
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20"
                >
                  Save Weekly Review to Vault
                </button>
              </form>
            )}

            {/* FORM 2: DAILY REVIEW CREATION */}
            {createReviewType === 'daily' && (
              <form onSubmit={handleSaveDailyReviewModal} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Target Date</label>
                    <input
                      type="date"
                      value={modalDailyDate}
                      onChange={(e) => setModalDailyDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Execution Score (1–10)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={modalDailyScore}
                      onChange={(e) => setModalDailyScore(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-amber-400 font-bold focus:outline-none font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Daily Reflexions & Course Correction</label>
                  <textarea
                    value={modalDailyNotes}
                    onChange={(e) => setModalDailyNotes(e.target.value)}
                    placeholder="Reflect on how today unfolded. What held you back? What will you adjust tomorrow?"
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20"
                >
                  Save Daily Review to Vault
                </button>
              </form>
            )}

            {/* FORM 3: GWS SPRINT REFLEXION CREATION */}
            {createReviewType === 'gws' && (
              <form onSubmit={handleSaveGwsModal} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Sprint Task Name</label>
                  <input
                    type="text"
                    value={modalGwsTask}
                    onChange={(e) => setModalGwsTask(e.target.value)}
                    placeholder="e.g. Discord onboarding test run"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-medium">Planned Time (min)</label>
                    <input
                      type="number"
                      value={modalGwsPlanned}
                      onChange={(e) => setModalGwsPlanned(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-medium">Actual Time (min)</label>
                    <input
                      type="number"
                      value={modalGwsActual}
                      onChange={(e) => setModalGwsActual(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 block">Focus (1-5)</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={modalGwsFocus}
                      onChange={(e) => setModalGwsFocus(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-center text-xs font-bold text-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 block">Execution (1-5)</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={modalGwsExecution}
                      onChange={(e) => setModalGwsExecution(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-center text-xs font-bold text-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 block">Output (1-5)</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={modalGwsOutput}
                      onChange={(e) => setModalGwsOutput(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-center text-xs font-bold text-amber-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">1. What did I accomplish?</label>
                  <input
                    type="text"
                    value={modalGwsAccomplished}
                    onChange={(e) => setModalGwsAccomplished(e.target.value)}
                    placeholder="Milestones or code shipped..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">2. What held me back?</label>
                  <input
                    type="text"
                    value={modalGwsHeldBack}
                    onChange={(e) => setModalGwsHeldBack(e.target.value)}
                    placeholder="Distractions or friction..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">3. What will I improve next session?</label>
                  <input
                    type="text"
                    value={modalGwsImproveNext}
                    onChange={(e) => setModalGwsImproveNext(e.target.value)}
                    placeholder="Actionable correction..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20"
                >
                  Record Sprint Reflexion to Vault
                </button>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
