import React, { useState } from 'react';
import { useStorage, getCurrentWeekRange } from '../../context/StorageContext';
import { WeeklyPlan, TaskItem } from '../../types/schema';
import { 
  Target, 
  Gift, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Sparkles, 
  Flame, 
  ChevronRight,
  ArrowDownToLine,
  ChevronDown,
  Layers
} from 'lucide-react';

export const WeeklyGoalCrusherView: React.FC = () => {
  const { 
    todayDate,
    weeklyPlans, 
    selectedWeekId, 
    setSelectedWeekId, 
    saveWeeklyPlan,
    setSelectedDate,
    selectedDate,
    dailyEntries,
    saveDailyEntry,
    getEntryForDate,
    setPlanningSubTab
  } = useStorage();

  const plan = weeklyPlans[selectedWeekId] || weeklyPlans['week_3'] || Object.values(weeklyPlans)[0];
  const weekDaysRange = getCurrentWeekRange(plan.startDate || selectedDate);

  const [newGoalInput, setNewGoalInput] = useState('');
  const [showRewardLadder, setShowRewardLadder] = useState(false);
  const [pulledNotice, setPulledNotice] = useState<string | null>(null);

  // Score stats
  const totalPossible = plan.tasks.reduce((acc, t) => acc + (t.score || 0), 0);
  const achievedScore = plan.tasks
    .filter(t => t.completed)
    .reduce((acc, t) => acc + (t.score || 0), 0);

  // Check if a goal is already in a given day's plan
  const isGoalInDay = (dateStr: string, goalText: string): boolean => {
    const entry = dailyEntries[dateStr];
    if (!entry || !entry.planNotes) return false;
    return entry.planNotes.toLowerCase().includes(goalText.toLowerCase().trim());
  };

  // Toggle goal done + two-way sync with any day in this week that has this goal
  const handleToggleGoal = (id: string) => {
    const targetGoal = plan.tasks.find(t => t.id === id);
    if (!targetGoal) return;
    const nextCompleted = !targetGoal.completed;

    const nextTasks = plan.tasks.map(t =>
      t.id === id ? { ...t, completed: nextCompleted } : t
    );
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks,
      achievedScore: nextTasks.filter(t => t.completed).reduce((acc, t) => acc + (t.score || 0), 0)
    });

    // Sync completion state across any day in this week where the goal was pulled
    weekDaysRange.days.forEach(dStr => {
      const entry = dailyEntries[dStr];
      if (entry && entry.planNotes && isGoalInDay(dStr, targetGoal.text)) {
        const lines = entry.planNotes.split('\n');
        const updatedLines = lines.map(line => {
          const stripped = line.replace(/^[0-9]+[\.\)\s]+/, '').replace(/^\[[xX\s]\]\s*/, '').trim();
          if (stripped.toLowerCase() === targetGoal.text.toLowerCase().trim()) {
            return `${nextCompleted ? '[x] ' : ''}${stripped}`;
          }
          return line.replace(/^[0-9]+[\.\)\s]+/, '').trim();
        }).filter(Boolean);

        const formatted = updatedLines.map((l, idx) => `${idx + 1} ${l}`).join('\n');
        const completedCount = updatedLines.filter(l => l.startsWith('[x] ') || l.startsWith('[X] ')).length;
        saveDailyEntry(dStr, {
          planNotes: formatted,
          mainTasksCompleted: completedCount,
          mainTasksTotal: Math.max(3, updatedLines.length)
        });
      }
    });
  };

  // Inline goal edit
  const handleEditGoal = (id: string, text: string) => {
    saveWeeklyPlan({
      ...plan,
      tasks: plan.tasks.map(t => t.id === id ? { ...t, text } : t)
    });
  };

  // Inline score weight change
  const handleChangeScore = (id: string, score: number) => {
    const nextTasks = plan.tasks.map(t =>
      t.id === id ? { ...t, score: Math.max(1, score) } : t
    );
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks,
      achievedScore: nextTasks.filter(t => t.completed).reduce((acc, t) => acc + (t.score || 0), 0)
    });
  };

  const handleDeleteGoal = (id: string) => {
    const nextTasks = plan.tasks.filter(t => t.id !== id);
    saveWeeklyPlan({
      ...plan,
      tasks: nextTasks,
      achievedScore: nextTasks.filter(t => t.completed).reduce((acc, t) => acc + (t.score || 0), 0)
    });
  };

  // Effortless Enter-key goal addition (Notion / Linear style)
  const handleKeyDownNew = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newGoalInput.trim()) {
      e.preventDefault();
      const newTask: TaskItem = {
        id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text: newGoalInput.trim(),
        score: 2, // default 2 points
        completed: false
      };
      saveWeeklyPlan({
        ...plan,
        tasks: [...plan.tasks, newTask]
      });
      setNewGoalInput('');
    }
  };

  // Bridge: "Pull this Goal into Selected Day's Plan" (numbered & deduplicated)
  const handlePullToToday = (goalText: string, isCompleted = false) => {
    const cleanGoal = goalText.trim();
    if (!cleanGoal) return;
    if (isGoalInDay(selectedDate, cleanGoal)) {
      setPulledNotice(`Already in ${selectedDate}'s priorities!`);
      setTimeout(() => setPulledNotice(null), 2000);
      return;
    }

    const currentDaily = getEntryForDate(selectedDate);
    const rawLines = (currentDaily.planNotes || '')
      .split('\n')
      .map(l => l.replace(/^[0-9]+[\.\)\s]+/, '').trim())
      .filter(Boolean);

    const updatedLines = [...rawLines, `${isCompleted ? '[x] ' : ''}${cleanGoal}`];
    const formatted = updatedLines.map((l, idx) => `${idx + 1} ${l}`).join('\n');
    const completedCount = updatedLines.filter(l => l.startsWith('[x] ') || l.startsWith('[X] ')).length;

    saveDailyEntry(selectedDate, {
      planNotes: formatted,
      mainTasksCompleted: completedCount,
      mainTasksTotal: Math.max(3, updatedLines.length)
    });
    setPulledNotice(`Pulled "${cleanGoal.slice(0, 32)}..." into ${selectedDate}`);
    setTimeout(() => setPulledNotice(null), 2500);
  };

  const handleCreateNewWeek = () => {
    const existingWeekNums = Object.values(weeklyPlans).map(p => p.weekNumber);
    const maxNum = existingWeekNums.length > 0 ? Math.max(...existingWeekNums) : 1;
    const nextNum = maxNum + 1;
    const nextId = `week_${nextNum}`;
    const currentRange = getCurrentWeekRange(selectedDate);

    const newPlan: WeeklyPlan = {
      id: nextId,
      weekNumber: nextNum,
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
      focusTheme: '',
      notes: '',
      tasks: [],
      totalPossibleScore: 10,
      achievedScore: 0,
      rewards: [],
      updatedAt: new Date().toISOString()
    };

    saveWeeklyPlan(newPlan);
    setSelectedWeekId(nextId);
  };

  // Custom Rewards Add / Delete / Edit
  const handleAddCustomReward = () => {
    const existingScores = plan.rewards.map(r => r.minScore);
    // Find next available threshold (e.g. 6, 8, 10 or any score between 1 and 10)
    let nextThreshold = 6;
    for (let i = 1; i <= 10; i++) {
      if (!existingScores.includes(i)) {
        nextThreshold = i;
        break;
      }
    }
    const newReward = {
      id: `rew_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      minScore: nextThreshold,
      reward: ''
    };
    saveWeeklyPlan({
      ...plan,
      rewards: [...plan.rewards, newReward].sort((a, b) => a.minScore - b.minScore)
    });
  };

  const handleDeleteReward = (id: string) => {
    saveWeeklyPlan({
      ...plan,
      rewards: plan.rewards.filter(r => r.id !== id)
    });
  };

  const handleUpdateRewardThreshold = (id: string, minScore: number) => {
    const updated = plan.rewards.map(r =>
      r.id === id ? { ...r, minScore: Math.min(10, Math.max(1, minScore)) } : r
    ).sort((a, b) => a.minScore - b.minScore);
    saveWeeklyPlan({ ...plan, rewards: updated });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Toast Notice when pulling goal into today */}
      {pulledNotice && (
        <div className="fixed bottom-6 right-6 z-50 p-3.5 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center space-x-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{pulledNotice}</span>
        </div>
      )}

      {/* Week Switcher Minimal Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {Object.values(weeklyPlans)
            .sort((a, b) => a.weekNumber - b.weekNumber)
            .map((p) => {
              const isSelected = p.id === plan.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedWeekId(p.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Week {p.weekNumber}
                </button>
              );
            })}
          <button
            onClick={handleCreateNewWeek}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-200 hover:bg-slate-900 transition-colors"
          >
            + New Week
          </button>
        </div>

        {/* Custom Rewards Collapsible Toggle */}
        <button
          onClick={() => setShowRewardLadder(!showRewardLadder)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            showRewardLadder
              ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          <span>
            Custom Rewards ({plan.rewards.length}) • {achievedScore}/10 pts
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRewardLadder ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Collapsible Reward Ladder Drawer (Only visible when toggled) */}
      {showRewardLadder && (
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <Gift className="w-4 h-4 text-sky-400" />
                <span>Custom Milestone Rewards</span>
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Set as few or as many rewards as you want for this week (or just 1 celebration at 10 pts).
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono font-extrabold text-amber-400">
                Score: {achievedScore} Pts
              </span>
              <button
                type="button"
                onClick={handleAddCustomReward}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Reward</span>
              </button>
            </div>
          </div>

          {plan.rewards.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-500">
              No rewards set for this week. Click "+ Add Reward" if you want to set milestone incentives.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {plan.rewards.map((r) => {
                const isUnlocked = achievedScore >= r.minScore;
                return (
                  <div
                    key={r.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between space-y-2 ${
                      isUnlocked
                        ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-600/10 border-emerald-500/40 text-emerald-300 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Unlock at:</span>
                        <select
                          value={r.minScore}
                          onChange={(e) => handleUpdateRewardThreshold(r.id, parseInt(e.target.value) || 1)}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 font-mono font-extrabold text-xs text-amber-400 focus:outline-none cursor-pointer"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                            <option key={score} value={score}>{score}+ pts</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center space-x-1">
                        {isUnlocked ? (
                          <span className="text-[10px] font-bold text-emerald-400 flex items-center space-x-1 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                            <Sparkles className="w-3 h-3" />
                            <span>Unlocked!</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            {r.minScore - achievedScore} pts away
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteReward(r.id)}
                          className="p-1 text-slate-600 hover:text-rose-400 rounded transition-colors"
                          title="Remove reward"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={r.reward}
                      onChange={(e) => {
                        const updated = plan.rewards.map(rw => rw.id === r.id ? { ...rw, reward: e.target.value } : rw);
                        saveWeeklyPlan({ ...plan, rewards: updated });
                      }}
                      placeholder="e.g. Steak dinner, massage, weekend freedom..."
                      className="w-full bg-slate-900/60 border border-slate-800/80 focus:border-amber-500/50 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Clean Document View: Week Focus Headline */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block mb-1">
              Weekly Singular Mission • Week {plan.weekNumber} ({plan.startDate} → {plan.endDate})
            </span>
            <input
              type="text"
              value={plan.focusTheme}
              onChange={(e) => saveWeeklyPlan({ ...plan, focusTheme: e.target.value })}
              placeholder="What is the one big outcome that matters this week?"
              className="w-full bg-transparent text-xl sm:text-2xl font-extrabold text-amber-400 placeholder-slate-700 focus:outline-none"
            />
          </div>
        </div>

        {/* Synchronized 7-Day Week Strip (Mon–Sun) */}
        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-semibold">
              Target Day for Pulling Goals: <strong className="text-amber-400 font-mono">{selectedDate}</strong>
            </span>
            <button
              type="button"
              onClick={() => setPlanningSubTab('daily')}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center space-x-1"
            >
              <span>Open {selectedDate} Daily Plan</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {weekDaysRange.days.map((dStr) => {
              const dObj = new Date(`${dStr}T12:00:00`);
              const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short' });
              const dayNum = dObj.getDate();
              const isSelected = dStr === selectedDate;
              const isToday = dStr === todayDate;
              const entry = dailyEntries[dStr];
              const hasPlan = !!(entry && entry.planNotes && entry.planNotes.trim().length > 0);

              return (
                <button
                  key={dStr}
                  type="button"
                  onClick={() => setSelectedDate(dStr)}
                  className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all border ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-extrabold border-amber-400 shadow-sm'
                      : isToday
                      ? 'bg-slate-900 text-emerald-400 border-emerald-500/40'
                      : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 border-slate-800'
                  }`}
                >
                  <span className="text-[9px] uppercase font-bold">{isToday ? 'TODAY' : dayName}</span>
                  <span className="text-xs font-mono font-extrabold">{dayNum}</span>
                  {hasPlan && (
                    <span className={`text-[9px] font-mono mt-0.5 ${isSelected ? 'text-slate-900 font-bold' : 'text-amber-400'}`}>
                      {entry.mainTasksCompleted}/{entry.mainTasksTotal}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clean Goals Checklist */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 pb-1">
            <span>Weekly Deliverables ({plan.tasks.length})</span>
            <span className="font-mono text-slate-500 text-[11px]">
              Allocated: <strong className="text-amber-400">{totalPossible}</strong> / 10 Pts
            </span>
          </div>

          {plan.tasks.map((task) => {
            const inSelectedDay = isGoalInDay(selectedDate, task.text);
            return (
              <div
                key={task.id}
                className={`group flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  task.completed
                    ? 'bg-emerald-500/5 border-emerald-500/25'
                    : 'bg-slate-950 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                {/* Checkbox & Text */}
                <div className="flex items-center space-x-3 flex-1 min-w-0 pr-3">
                  <button
                    type="button"
                    onClick={() => handleToggleGoal(task.id)}
                    className="transition-transform active:scale-90 shrink-0"
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
                    onChange={(e) => handleEditGoal(task.id, e.target.value)}
                    className={`w-full bg-transparent text-xs sm:text-sm font-medium focus:outline-none ${
                      task.completed ? 'line-through text-slate-500' : 'text-slate-100'
                    }`}
                  />
                </div>

                {/* Actions & Point Weight */}
                <div className="flex items-center space-x-2 shrink-0">
                  {/* Bridge button: "Pull to Selected Day" */}
                  {inSelectedDay ? (
                    <span className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
                      <span>✓ In {selectedDate.slice(5)}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePullToToday(task.text, task.completed)}
                      className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 text-[11px] font-semibold border border-slate-800 transition-colors"
                      title={`Pull this goal into ${selectedDate}'s daily plan`}
                    >
                      <ArrowDownToLine className="w-3 h-3 text-amber-400" />
                      <span>Pull to {selectedDate.slice(5)}</span>
                    </button>
                  )}

                  {/* Score weight badge */}
                  <select
                    value={task.score || 2}
                    onChange={(e) => handleChangeScore(task.id, parseInt(e.target.value))}
                    className="bg-slate-900 text-amber-400 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono font-bold focus:outline-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5].map((pts) => (
                      <option key={pts} value={pts}>{pts} pt{pts > 1 ? 's' : ''}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleDeleteGoal(task.id)}
                    className="p-1 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Effortless Inline Goal Input (Like Notion - Type & hit Enter) */}
          <div className="flex items-center space-x-3 p-3.5 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 focus-within:border-amber-500/50 transition-colors">
            <Plus className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              value={newGoalInput}
              onChange={(e) => setNewGoalInput(e.target.value)}
              onKeyDown={handleKeyDownNew}
              placeholder="Type a goal and press Enter to add..."
              className="w-full bg-transparent text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
            />
            <span className="text-[10px] text-slate-600 font-mono hidden sm:inline shrink-0">
              Press Enter ↵
            </span>
          </div>

        </div>

        {/* Minimal Score Tracker Bar */}
        <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
          <span>Weekly progress</span>
          <span className="font-mono font-bold text-slate-200">
            <strong className="text-amber-400">{achievedScore}</strong> / {totalPossible || 10} pts completed ({Math.min(100, Math.round((achievedScore / Math.max(1, totalPossible || 10)) * 100))}%)
          </span>
        </div>

      </div>

    </div>
  );
};
