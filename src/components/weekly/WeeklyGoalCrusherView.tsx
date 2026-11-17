import React, { useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { WeeklyPlan, TaskItem, RewardTier } from '../../types/schema';
import { 
  Target, 
  Gift, 
  Award, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Sparkles, 
  Flame, 
  Info,
  Calendar,
  ChevronRight,
  HelpCircle,
  TrendingUp
} from 'lucide-react';

export const WeeklyGoalCrusherView: React.FC = () => {
  const { 
    weeklyPlans, 
    selectedWeekId, 
    setSelectedWeekId, 
    saveWeeklyPlan,
    setActiveTab,
    setReviewSubTab
  } = useStorage();

  const plan = weeklyPlans[selectedWeekId] || weeklyPlans['week_3'] || Object.values(weeklyPlans)[0];

  // Local editing states
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskScore, setNewTaskScore] = useState(2);
  const [showInstructions, setShowInstructions] = useState(false);

  // Calculate sum of tasks total potential points and achieved points
  const totalPossible = plan.tasks.reduce((acc, t) => acc + (t.score || 0), 0);
  const achievedScore = plan.tasks
    .filter(t => t.completed)
    .reduce((acc, t) => acc + (t.score || 0), 0);

  // Task actions
  const handleTaskToggle = (taskId: string) => {
    const nextTasks = plan.tasks.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks,
      achievedScore: nextTasks.filter(t => t.completed).reduce((acc, t) => acc + (t.score || 0), 0)
    });
  };

  const handleTaskScoreChange = (taskId: string, score: number) => {
    const nextTasks = plan.tasks.map(t =>
      t.id === taskId ? { ...t, score: Math.max(1, score) } : t
    );
    saveWeeklyPlan({ ...plan, tasks: nextTasks });
  };

  const handleTaskTextChange = (taskId: string, text: string) => {
    const nextTasks = plan.tasks.map(t =>
      t.id === taskId ? { ...t, text } : t
    );
    saveWeeklyPlan({ ...plan, tasks: nextTasks });
  };

  const handleDeleteTask = (taskId: string) => {
    const nextTasks = plan.tasks.filter(t => t.id !== taskId);
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks,
      achievedScore: nextTasks.filter(t => t.completed).reduce((acc, t) => acc + (t.score || 0), 0)
    });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const newTask: TaskItem = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: newTaskText.trim(),
      score: newTaskScore,
      completed: false
    };

    saveWeeklyPlan({
      ...plan,
      tasks: [...plan.tasks, newTask]
    });

    setNewTaskText('');
    setNewTaskScore(2);
  };

  const handleFocusChange = (focusTheme: string) => {
    saveWeeklyPlan({ ...plan, focusTheme });
  };

  const handleRewardChange = (tierId: string, reward: string) => {
    const nextRewards = plan.rewards.map(r =>
      r.id === tierId ? { ...r, reward } : r
    );
    saveWeeklyPlan({ ...plan, rewards: nextRewards });
  };

  const handleCreateNewWeek = () => {
    const existingWeekNums = Object.values(weeklyPlans).map(p => p.weekNumber);
    const maxNum = existingWeekNums.length > 0 ? Math.max(...existingWeekNums) : 1;
    const nextNum = maxNum + 1;
    const nextId = `week_${nextNum}`;

    // Clean blank slate for new week
    const newPlan: WeeklyPlan = {
      id: nextId,
      weekNumber: nextNum,
      startDate: '2026-11-02',
      endDate: '2026-11-08',
      focusTheme: '',
      notes: '',
      tasks: [],
      totalPossibleScore: 10,
      achievedScore: 0,
      rewards: [
        { id: 'r1', minScore: 6, reward: 'Tier 1 Celebration' },
        { id: 'r2', minScore: 7, reward: 'Tier 2 Reward' },
        { id: 'r3', minScore: 8, reward: 'Tier 3 Celebration Day' },
        { id: 'r4', minScore: 9, reward: 'Tier 4 Milestone Splurge' },
        { id: 'r5', minScore: 10, reward: 'Ultimate Mastery Reward' }
      ],
      updatedAt: new Date().toISOString()
    };

    saveWeeklyPlan(newPlan);
    setSelectedWeekId(nextId);
  };

  const isCurrentActiveWeek = plan.id === 'week_3';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Week Selector Bar with Clear Status Badges */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Weekly Goal Crusher</span>
              {isCurrentActiveWeek ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  CURRENT ACTIVE SPRINT
                </span>
              ) : plan.weekNumber === 1 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  ARCHIVED REFERENCE (WEEK 1)
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-100 mt-0.5">
              Week {plan.weekNumber}: {plan.focusTheme || 'Set Weekly Focus Headline'}
            </h1>
          </div>
        </div>

        {/* Week Switcher Chips */}
        <div className="flex items-center space-x-2 flex-wrap">
          {Object.values(weeklyPlans).map((p) => {
            const isSelected = p.id === plan.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedWeekId(p.id)}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 ring-2 ring-amber-400'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>Week {p.weekNumber}</span>
                {p.id === 'week_3' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </button>
            );
          })}

          <button
            onClick={handleCreateNewWeek}
            className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            title="Create next week"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Week</span>
          </button>
        </div>
      </div>

      {/* Educational Banner (Dismissible / Toggleable) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>How Goal Crusher Works:</strong> Define 3–6 real tasks with scores totaling <strong>10 points</strong>. Tick tasks as you ship them to unlock reward tiers (6+ to 10).
          </span>
        </div>
      </div>

      {/* Main Execution Grid: Weekly Tasks Table (8 cols) + Reward Ladder (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Tasks Breakdown (Table Style) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            
            {/* Weekly Focus Box */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Weekly Strategic Focus Headline:
              </label>
              <input
                type="text"
                value={plan.focusTheme}
                onChange={(e) => handleFocusChange(e.target.value)}
                placeholder="e.g. Discord cohort launch & Miro trading roadmap"
                className="w-full bg-transparent text-sm sm:text-base font-extrabold text-amber-400 placeholder-amber-400/30 focus:outline-none"
              />
            </div>

            {/* Sub-header instruction */}
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 pb-2 border-b border-slate-800">
              <span>Break the goal down into real tasks (Sum should reach 10 pts):</span>
              <span className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded border ${
                totalPossible === 10
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}>
                Allocated: {totalPossible} / 10 Pts
              </span>
            </div>

            {/* Tasks Table */}
            <div className="space-y-3">
              {plan.tasks.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800/80 text-xs text-slate-500">
                  No tasks added to Week {plan.weekNumber} yet. Use the form below to add your first high-leverage task.
                </div>
              ) : (
                plan.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      task.completed
                        ? 'bg-emerald-500/5 border-emerald-500/30 shadow-sm'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Checkbox & Task Name */}
                    <div className="flex items-center space-x-3 flex-1 min-w-0 pr-3">
                      <button
                        type="button"
                        onClick={() => handleTaskToggle(task.id)}
                        className="shrink-0 transition-transform active:scale-90"
                        title={task.completed ? 'Mark pending' : 'Mark done'}
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-600 hover:text-slate-400" />
                        )}
                      </button>

                      <input
                        type="text"
                        value={task.text}
                        onChange={(e) => handleTaskTextChange(task.id, e.target.value)}
                        className={`w-full bg-transparent text-xs sm:text-sm font-medium focus:outline-none ${
                          task.completed ? 'line-through text-slate-500' : 'text-slate-200'
                        }`}
                      />
                    </div>

                    {/* Score Weight Pill & Delete */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1">
                        <span className="text-[10px] text-slate-500 font-mono">Weight:</span>
                        <select
                          value={task.score || 1}
                          onChange={(e) => handleTaskScoreChange(task.id, parseInt(e.target.value))}
                          className="bg-transparent text-amber-400 font-mono font-extrabold text-xs focus:outline-none cursor-pointer"
                        >
                          {[1, 2, 3, 4, 5].map((pts) => (
                            <option key={pts} value={pts}>{pts} pt{pts > 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 text-slate-600 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                ))
              )}
            </div>

            {/* Score Totals Bar */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              achievedScore >= 6
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}>
              <div className="flex items-center space-x-2">
                <Flame className={`w-5 h-5 ${achievedScore >= 6 ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Weekly Score Progress:
                </span>
              </div>
              <div className="font-mono font-extrabold text-base sm:text-lg">
                <span className={achievedScore >= 6 ? 'text-emerald-300' : 'text-amber-400'}>
                  {achievedScore}
                </span>
                <span className="text-slate-500 text-sm"> / {totalPossible || 10} pts</span>
              </div>
            </div>

            {/* Add Task Form */}
            <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-800">
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="Type a new high-leverage deliverable..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <div className="flex items-center space-x-1 text-xs text-slate-400 font-medium">
                  <span>Pts:</span>
                  <select
                    value={newTaskScore}
                    onChange={(e) => setNewTaskScore(parseInt(e.target.value))}
                    className="bg-slate-950 border border-slate-800 rounded-xl py-2 px-2 text-xs font-mono font-bold text-amber-400 focus:outline-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5].map((pts) => (
                      <option key={pts} value={pts}>{pts} pt{pts > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors shadow-md shadow-amber-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Task</span>
                </button>
              </div>
            </form>

          </div>
        </div>

        {/* Right Column: Reward Ladder Table */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wide">
                    Reward Ladder
                  </h3>
                  <p className="text-[11px] text-slate-400">Unlock incentives as you hit points</p>
                </div>
              </div>
            </div>

            {/* Ladder Rows */}
            <div className="space-y-3">
              {plan.rewards.map((tier) => {
                const isUnlocked = achievedScore >= tier.minScore;

                return (
                  <div
                    key={tier.id}
                    className={`rounded-2xl border p-3.5 transition-all ${
                      isUnlocked
                        ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-600/10 border-emerald-500/40 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950/60 border-slate-800/80 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-extrabold font-mono px-2 py-0.5 rounded-lg border ${
                        isUnlocked
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}>
                        {tier.minScore}+ Points
                      </span>

                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {isUnlocked ? (
                          <span className="text-emerald-400 flex items-center space-x-1">
                            <Sparkles className="w-3 h-3" />
                            <span>Unlocked!</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            {tier.minScore - achievedScore} pts needed
                          </span>
                        )}
                      </span>
                    </div>

                    <input
                      type="text"
                      value={tier.reward}
                      onChange={(e) => handleRewardChange(tier.id, e.target.value)}
                      placeholder="Enter custom reward..."
                      className={`w-full bg-transparent text-xs font-medium focus:outline-none ${
                        isUnlocked ? 'text-emerald-200' : 'text-slate-400'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Motivational note */}
            <p className="text-[11px] text-slate-500 leading-normal pt-2">
              💡 Tip: Rewarding yourself at 6+ builds self-trust. Don't skip celebrating when you cross tiers!
            </p>

          </div>
        </div>

      </div>

    </div>
  );
};
