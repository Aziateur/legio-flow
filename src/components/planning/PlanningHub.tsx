import React, { useState } from 'react';
import { useStorage, PlanningSubTab, getCurrentWeekRange } from '../../context/StorageContext';
import { DailyTrackerView } from '../daily/DailyTrackerView';
import { WeeklyGoalCrusherView } from '../weekly/WeeklyGoalCrusherView';
import { WeeklyPlan } from '../../types/schema';
import { 
  Calendar, 
  Target, 
  MapPin, 
  Compass, 
  Sparkles, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  ArrowRight,
  TrendingUp,
  Users,
  Cpu,
  Layers,
  ChevronRight,
  X,
  FilePlus
} from 'lucide-react';

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
    setSelectedWeekId,
    selectedDate,
    setSelectedDate,
    systemLevel
  } = useStorage();

  // Create Plan Modal state
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [createPlanType, setCreatePlanType] = useState<'weekly' | 'daily'>('weekly');
  
  // New Week form state
  const existingWeekNums = Object.values(weeklyPlans).map(p => p.weekNumber);
  const maxWeekNum = existingWeekNums.length > 0 ? Math.max(...existingWeekNums) : 1;
  const defaultWeekRange = getCurrentWeekRange(selectedDate);
  const [newWeekNum, setNewWeekNum] = useState<number>(maxWeekNum + 1);
  const [newWeekFocus, setNewWeekFocus] = useState<string>('');
  const [newWeekStart, setNewWeekStart] = useState<string>(defaultWeekRange.startDate);
  const [newWeekEnd, setNewWeekEnd] = useState<string>(defaultWeekRange.endDate);

  // New Daily Plan form state
  const [newPlanDate, setNewPlanDate] = useState<string>(selectedDate);
  const [newPlanNotes, setNewPlanNotes] = useState<string>('');

  // 3-Year Plan editing state
  const [activeYearPillar, setActiveYearPillar] = useState<string>('pillar_trading');
  const [newMilestoneText, setNewMilestoneText] = useState('');
  const [selectedMilestoneYear, setSelectedMilestoneYear] = useState<'year1' | 'year2' | 'year3'>('year1');
  const [newBoundaryText, setNewBoundaryText] = useState('');

  // 3-Year Plan handlers
  const handleToggleMilestone = (pillarId: string, yearKey: 'year1Milestones' | 'year2Milestones' | 'year3Milestones', milestoneId: string) => {
    const updatedPillars = threeYearPlan.pillars.map(p => {
      if (p.id !== pillarId) return p;
      return {
        ...p,
        [yearKey]: p[yearKey].map(m => m.id === milestoneId ? { ...m, completed: !m.completed } : m)
      };
    });
    saveThreeYearPlan({ ...threeYearPlan, pillars: updatedPillars });
  };

  const handleAddMilestone = (pillarId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneText.trim()) return;

    const key = selectedMilestoneYear === 'year1' 
      ? 'year1Milestones' 
      : selectedMilestoneYear === 'year2' 
      ? 'year2Milestones' 
      : 'year3Milestones';

    const updatedPillars = threeYearPlan.pillars.map(p => {
      if (p.id !== pillarId) return p;
      const newM = {
        id: `m_${Date.now()}`,
        text: newMilestoneText.trim(),
        completed: false
      };
      return {
        ...p,
        [key]: [...p[key], newM]
      };
    });

    saveThreeYearPlan({ ...threeYearPlan, pillars: updatedPillars });
    setNewMilestoneText('');
  };

  const handleDeleteMilestone = (pillarId: string, yearKey: 'year1Milestones' | 'year2Milestones' | 'year3Milestones', milestoneId: string) => {
    const updatedPillars = threeYearPlan.pillars.map(p => {
      if (p.id !== pillarId) return p;
      return {
        ...p,
        [yearKey]: p[yearKey].filter(m => m.id !== milestoneId)
      };
    });
    saveThreeYearPlan({ ...threeYearPlan, pillars: updatedPillars });
  };

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

  const handleVisionChange = (vision: string) => {
    saveThreeYearPlan({ ...threeYearPlan, vision });
  };

  // Submit handler for creating a new weekly plan
  const handleCreateWeeklyPlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const weekId = `week_${newWeekNum}`;
    
    const newPlan: WeeklyPlan = {
      id: weekId,
      weekNumber: newWeekNum,
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

  const { saveDailyEntry } = useStorage();

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

  const currentPillar = threeYearPlan.pillars.find(p => p.id === activeYearPillar) || threeYearPlan.pillars[0];

  const getPillarIcon = (name: string) => {
    if (name === 'TrendingUp') return TrendingUp;
    if (name === 'Users') return Users;
    return Cpu;
  };

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
                {planningSubTab === 'three_year' && '3-Year Strategic Roadmap'}
              </div>
            </div>
          </div>

          {/* Switcher & Action Button */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            
            {/* Segmented Switcher Controls filtered by systemLevel */}
            <div className="flex items-center space-x-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800/80">
              <button
                onClick={() => setPlanningSubTab('daily')}
                className={`flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
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
                  onClick={() => setPlanningSubTab('weekly')}
                  className={`flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    planningSubTab === 'weekly'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Weekly Plan</span>
                </button>
              )}

              {systemLevel >= 4 && (
                <button
                  onClick={() => setPlanningSubTab('three_year')}
                  className={`flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
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
              onClick={() => {
                setCreatePlanType(planningSubTab === 'weekly' ? 'weekly' : 'daily');
                setShowCreatePlanModal(true);
              }}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Plan</span>
            </button>

          </div>

        </div>
      </div>

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

      {/* VIEW 3: 3-YEAR STRATEGIC PLAN */}
      {planningSubTab === 'three_year' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-8">
          
          {/* Executive Vision Banner */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Strategic Horizon
                </span>
                <span className="text-sm font-mono font-bold text-slate-300">
                  {threeYearPlan.targetHorizon}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-mono">Autosaved</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Core 3-Year Vision & Destination
              </label>
              <textarea
                value={threeYearPlan.vision}
                onChange={(e) => handleVisionChange(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-sm font-medium text-amber-300 placeholder-slate-600 focus:outline-none transition-colors resize-y leading-relaxed"
              />
            </div>
          </div>

          {/* Strategic Pillar Selector Tabs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {threeYearPlan.pillars.map((pillar) => {
              const Icon = getPillarIcon(pillar.iconName);
              const isSelected = pillar.id === activeYearPillar;
              const completedCount = [
                ...pillar.year1Milestones,
                ...pillar.year2Milestones,
                ...pillar.year3Milestones
              ].filter(m => m.completed).length;
              const totalCount = [
                ...pillar.year1Milestones,
                ...pillar.year2Milestones,
                ...pillar.year3Milestones
              ].length;

              return (
                <button
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
                  <h3 className="text-base font-extrabold text-slate-100">{pillar.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{pillar.subtitle}</p>
                </button>
              );
            })}
          </div>

          {/* Active Pillar Details: Boundaries & Checkpoints + 3-Year Milestone Runway */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left 4 cols: Miro-Style Strategic Boundaries & Checkpoints */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                
                <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-orange-400">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Miro Boundaries & Rules</span>
                </div>
                <p className="text-xs text-slate-400">
                  Non-negotiable operational boundaries and risk rules for <strong>{currentPillar.title}</strong>:
                </p>

                {/* Boundaries list */}
                <div className="space-y-2.5">
                  {currentPillar.boundariesAndCheckpoints.map((b, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-normal gap-2"
                    >
                      <div className="flex items-start space-x-2">
                        <span className="text-amber-400 font-bold mt-0.5">•</span>
                        <span>{b}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteBoundary(currentPillar.id, idx)}
                        className="text-slate-600 hover:text-rose-400 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add boundary form */}
                <form onSubmit={(e) => handleAddBoundary(currentPillar.id, e)} className="pt-2 flex items-center space-x-2">
                  <input
                    type="text"
                    value={newBoundaryText}
                    onChange={(e) => setNewBoundaryText(e.target.value)}
                    placeholder="Add rule or boundary..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                  >
                    + Add
                  </button>
                </form>

              </div>
            </div>

            {/* Right 8 cols: Year 1 -> Year 2 -> Year 3 Milestone Runway */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                      Strategic Runway
                    </span>
                    <h2 className="text-lg font-bold text-slate-100">
                      {currentPillar.title} Milestones
                    </h2>
                  </div>
                </div>

                {/* YEAR 1 */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">Year 1</span>
                    <span>Foundation & Strategy Execution</span>
                  </div>

                  <div className="space-y-2">
                    {currentPillar.year1Milestones.map((m) => (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                          m.completed
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                            : 'bg-slate-950 border-slate-800 text-slate-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleMilestone(currentPillar.id, 'year1Milestones', m.id)}
                          className="flex items-center space-x-3 text-xs text-left"
                        >
                          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${
                            m.completed ? 'text-emerald-400 fill-emerald-400/20' : 'text-slate-600'
                          }`} />
                          <span className={m.completed ? 'line-through text-slate-400' : 'text-slate-100 font-medium'}>
                            {m.text}
                          </span>
                        </button>
                        <button
                          onClick={() => handleDeleteMilestone(currentPillar.id, 'year1Milestones', m.id)}
                          className="text-slate-600 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* YEAR 2 */}
                <div className="space-y-3 pt-4 border-t border-slate-800/80">
                  <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-amber-400">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">Year 2</span>
                    <span>Scaling & Systematic Compounding</span>
                  </div>

                  <div className="space-y-2">
                    {currentPillar.year2Milestones.map((m) => (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                          m.completed
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                            : 'bg-slate-950 border-slate-800 text-slate-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleMilestone(currentPillar.id, 'year2Milestones', m.id)}
                          className="flex items-center space-x-3 text-xs text-left"
                        >
                          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${
                            m.completed ? 'text-amber-400 fill-amber-400/20' : 'text-slate-600'
                          }`} />
                          <span className={m.completed ? 'line-through text-slate-400' : 'text-slate-100 font-medium'}>
                            {m.text}
                          </span>
                        </button>
                        <button
                          onClick={() => handleDeleteMilestone(currentPillar.id, 'year2Milestones', m.id)}
                          className="text-slate-600 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* YEAR 3 */}
                <div className="space-y-3 pt-4 border-t border-slate-800/80">
                  <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-sky-400">
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20">Year 3</span>
                    <span>Apex Dominance & Autonomy</span>
                  </div>

                  <div className="space-y-2">
                    {currentPillar.year3Milestones.map((m) => (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                          m.completed
                            ? 'bg-sky-500/10 border-sky-500/30 text-sky-200'
                            : 'bg-slate-950 border-slate-800 text-slate-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleMilestone(currentPillar.id, 'year3Milestones', m.id)}
                          className="flex items-center space-x-3 text-xs text-left"
                        >
                          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${
                            m.completed ? 'text-sky-400 fill-sky-400/20' : 'text-slate-600'
                          }`} />
                          <span className={m.completed ? 'line-through text-slate-400' : 'text-slate-100 font-medium'}>
                            {m.text}
                          </span>
                        </button>
                        <button
                          onClick={() => handleDeleteMilestone(currentPillar.id, 'year3Milestones', m.id)}
                          className="text-slate-600 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add milestone form */}
                <form onSubmit={(e) => handleAddMilestone(currentPillar.id, e)} className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-2">
                  <select
                    value={selectedMilestoneYear}
                    onChange={(e) => setSelectedMilestoneYear(e.target.value as any)}
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
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                  >
                    + Add Milestone
                  </button>
                </form>

              </div>
            </div>

          </div>

        </div>
      )}

      {/* CREATE PLAN MODAL (Clear, Obvious Creation for Weeks and Days) */}
      {showCreatePlanModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl space-y-6 relative my-4 sm:my-8">
            
            <button
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
                      onChange={(e) => setNewWeekNum(parseInt(e.target.value) || 1)}
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
                  ⚡ Creates a clean blank Week {newWeekNum} sheet where you can add your own goals and custom rewards.
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
