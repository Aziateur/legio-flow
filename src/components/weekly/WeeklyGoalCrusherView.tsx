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
  Sliders, 
  Info,
  Calendar,
  ChevronRight
} from 'lucide-react';

export const WeeklyGoalCrusherView: React.FC = () => {
  const { 
    weeklyPlans, 
    selectedWeekId, 
    setSelectedWeekId, 
    saveWeeklyPlan 
  } = useStorage();

  const plan = weeklyPlans[selectedWeekId] || weeklyPlans['week_1'] || Object.values(weeklyPlans)[0];

  // Local editing states
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskScore, setNewTaskScore] = useState(2);

  // Calculate sum of tasks total potential points and achieved points
  const totalPossible = plan.tasks.reduce((acc, t) => acc + (t.score || 0), 0);
  const achievedScore = plan.tasks
    .filter(t => t.completed)
    .reduce((acc, t) => acc + (t.score || 0), 0);

  // Update handlers
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
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks
    });
  };

  const handleTaskTextChange = (taskId: string, text: string) => {
    const nextTasks = plan.tasks.map(t =>
      t.id === taskId ? { ...t, text } : t
    );
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks
    });
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

  const handleRewardChange = (tierId: string, rewardText: string) => {
    const nextRewards = plan.rewards.map(r =>
      r.id === tierId ? { ...r, reward: rewardText } : r
    );
    saveWeeklyPlan({
      ...plan,
      rewards: nextRewards
    });
  };

  const handleFocusThemeChange = (theme: string) => {
    saveWeeklyPlan({ ...plan, focusTheme: theme });
  };

  const handleNotesChange = (notes: string) => {
    saveWeeklyPlan({ ...plan, notes });
  };

  const handleReviewNotesChange = (reviewNotes: string) => {
    saveWeeklyPlan({ ...plan, reviewNotes });
  };

  const handleCreateNewWeek = () => {
    const existingWeekNums = Object.values(weeklyPlans).map(p => p.weekNumber);
    const maxNum = existingWeekNums.length > 0 ? Math.max(...existingWeekNums) : 1;
    const nextNum = maxNum + 1;
    const nextId = `week_${nextNum}`;

    const newPlan: WeeklyPlan = {
      id: nextId,
      weekNumber: nextNum,
      startDate: '2026-11-02',
      endDate: '2026-11-08',
      focusTheme: `Week ${nextNum} Core Focus`,
      notes: 'Break large strategic goals into prioritized deliverables summing to 10 points.',
      tasks: [
        { id: `w${nextNum}_t1`, text: 'Primary high-leverage objective', score: 3, completed: false },
        { id: `w${nextNum}_t2`, text: 'Secondary operational milestone', score: 3, completed: false },
        { id: `w${nextNum}_t3`, text: 'Infrastructure & tooling advancement', score: 2, completed: false },
        { id: `w${nextNum}_t4`, text: 'Execution consistency & review sprint', score: 2, completed: false }
      ],
      totalPossibleScore: 10,
      achievedScore: 0,
      rewards: [
        { id: 'r1', minScore: 6, reward: 'Tier 1 Celebration' },
        { id: 'r2', minScore: 7, reward: 'Tier 2 Reward' },
        { id: 'r3', minScore: 8, reward: 'Tier 3 Reward' },
        { id: 'r4', minScore: 9, reward: 'Tier 4 Splurge' },
        { id: 'r5', minScore: 10, reward: 'Ultimate Victory Reward' }
      ],
      updatedAt: new Date().toISOString()
    };

    saveWeeklyPlan(newPlan);
    setSelectedWeekId(nextId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Week Selector Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Tactical Sprint</span>
            <h1 className="text-2xl font-extrabold text-slate-100 flex items-center space-x-2">
              <span>Goal Crusher: Week {plan.weekNumber}</span>
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
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 ring-2 ring-amber-400'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                Week {p.weekNumber}
              </button>
            );
          })}

          <button
            onClick={handleCreateNewWeek}
            className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Week</span>
          </button>
        </div>
      </div>

      {/* Google Sheets Layout Header Replicas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Week Box (Left) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">Active Week:</div>
            <div className="text-4xl font-extrabold text-slate-100 font-mono mt-1">
              Week <span className="text-amber-400">{plan.weekNumber}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Score Target</div>
            <div className="text-2xl font-extrabold text-amber-400 font-mono">
              {achievedScore} <span className="text-slate-500 text-base">/ {totalPossible || 10}</span>
            </div>
          </div>
        </div>

        {/* Coaching Note Box (Right) */}
        <div className="lg:col-span-8 bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 shadow-lg relative overflow-hidden">
          <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
            <Info className="w-4 h-4" />
            <span>Protocol Strategy Note:</span>
          </div>
          <textarea
            value={plan.notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            rows={3}
            placeholder="This sheet is for you to mark down your goals with particular focus in the week..."
            className="w-full bg-transparent text-xs text-amber-200/90 leading-relaxed focus:outline-none resize-none placeholder-amber-400/50"
          />
        </div>

      </div>

      {/* Main Execution Grid: Weekly Tasks Table (Left 8 cols) + Reward Ladder (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Tasks Breakdown (Table Style) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            
            {/* Weekly Focus Box */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <label className="block text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                Weekly Focus
              </label>
              <input
                type="text"
                value={plan.focusTheme}
                onChange={(e) => handleFocusThemeChange(e.target.value)}
                placeholder="This Weeks Focus: systems launched"
                className="w-full bg-transparent text-base sm:text-lg font-bold text-amber-400 focus:outline-none"
              />
            </div>

            {/* Tasks Table Header */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-3 w-10">Done</th>
                    <th className="py-3 px-3">Break the goal down into real tasks</th>
                    <th className="py-3 px-3 text-center w-24">Score</th>
                    <th className="py-3 px-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {plan.tasks.map((task) => (
                    <tr
                      key={task.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        task.completed ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleTaskToggle(task.id)}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                            task.completed
                              ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 shadow-md shadow-amber-500/20'
                              : 'bg-slate-950 border border-slate-700 text-transparent hover:border-slate-500'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4 fill-current" />
                        </button>
                      </td>

                      {/* Task Text Input */}
                      <td className="py-3.5 px-3">
                        <input
                          type="text"
                          value={task.text}
                          onChange={(e) => handleTaskTextChange(task.id, e.target.value)}
                          className={`w-full bg-transparent text-xs sm:text-sm font-medium focus:outline-none transition-all ${
                            task.completed
                              ? 'line-through text-slate-500'
                              : 'text-slate-200'
                          }`}
                        />
                      </td>

                      {/* Weight Score (points) */}
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={task.score}
                          onChange={(e) => handleTaskScoreChange(task.id, parseInt(e.target.value) || 1)}
                          className="w-14 bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 text-center font-mono font-bold text-amber-400 text-sm focus:outline-none focus:border-amber-500"
                        />
                      </td>

                      {/* Delete */}
                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1 text-slate-600 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Row */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-red-600/90 to-red-700 text-white font-extrabold shadow-lg">
              <span className="text-base tracking-wider uppercase font-black">Total</span>
              <div className="flex items-center space-x-2 text-xl font-mono">
                <span>{achievedScore}</span>
                <span className="text-red-200 text-sm">/ {totalPossible} pts</span>
              </div>
            </div>

            {/* Quick Add Task Form */}
            <form onSubmit={handleAddTask} className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="Add another high-leverage task breakdown..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <div className="flex items-center space-x-1 text-xs text-slate-400 font-medium">
                  <span>Pts:</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newTaskScore}
                    onChange={(e) => setNewTaskScore(parseInt(e.target.value) || 1)}
                    className="w-12 bg-slate-950 border border-slate-800 rounded-xl py-2 px-2 text-center text-xs font-mono font-bold text-amber-400 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors shadow-md shadow-amber-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Task</span>
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
                    className={`rounded-2xl border p-4 transition-all ${
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

      {/* Bottom Section: Weekly Retrospective & Course Correction */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Weekly Retrospective
            </span>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Week {plan.weekNumber} Review & Course Correction
            </h3>
          </div>
        </div>

        <textarea
          value={plan.reviewNotes || ''}
          onChange={(e) => handleReviewNotesChange(e.target.value)}
          placeholder="Reflect on this week's goals: What went according to plan? Where was the divergence? What needs to be purchased, learned, or changed for next week?"
          rows={4}
          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-colors resize-y leading-relaxed"
        />
      </div>

    </div>
  );
};
