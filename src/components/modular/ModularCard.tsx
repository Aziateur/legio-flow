import React from 'react';
import { TemplateField } from '../../types/schema';
import { 
  CheckCircle2, 
  Flame, 
  Sparkles, 
  Timer, 
  FileText, 
  ListChecks, 
  Award, 
  Clock,
  Plus,
  Trash2
} from 'lucide-react';

interface ModularCardProps {
  field: TemplateField;
  value: any;
  onChange: (val: any) => void;
  // Contextual actions
  onAction?: (actionName: string, payload?: any) => void;
}

export const ModularCard: React.FC<ModularCardProps> = ({ field, value, onChange, onAction }) => {
  // Shape container styling
  const getShapeClasses = () => {
    switch (field.shape) {
      case 'compact':
        return 'bg-slate-900/90 border border-slate-800 p-4 rounded-2xl';
      case 'highlight':
        return 'bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border-2 border-amber-500/40 p-6 rounded-3xl shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/20';
      case 'bordered':
        return 'bg-slate-950 border-2 border-slate-700 p-6 rounded-3xl';
      case 'minimal':
        return 'bg-transparent border border-slate-800/60 p-4 rounded-2xl';
      case 'standard':
      default:
        return 'bg-slate-900/90 border border-slate-800 hover:border-slate-700 p-6 rounded-3xl shadow-xl';
    }
  };

  // Render content according to field.type
  const renderFieldContent = () => {
    switch (field.type) {
      // 1. Rating 1-10
      case 'rating_10': {
        const currentScore = typeof value === 'number' ? value : 0;
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                const isSelected = currentScore === score;
                return (
                  <button
                    key={score}
                    type="button"
                    onClick={() => onChange(score)}
                    className={`py-2 rounded-xl text-xs font-bold font-mono transition-all ${
                      isSelected
                        ? score >= 8
                          ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400 font-extrabold shadow-md shadow-emerald-500/30'
                          : score >= 6
                          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 font-extrabold shadow-md shadow-amber-500/30'
                          : 'bg-orange-500 text-slate-950 ring-2 ring-orange-400 font-extrabold shadow-md shadow-orange-500/30'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono px-1">
              <span>1: Low</span>
              <span>6: Solid Baseline</span>
              <span>10: Flawless Beast</span>
            </div>
          </div>
        );
      }

      // 2. Rating 1-5 scorecard (e.g. Focus, Execution, Output)
      case 'rating_5': {
        const ratings = value || { focus: 4, execution: 4, output: 4, total: 12 };
        const updateRating = (category: 'focus' | 'execution' | 'output', score: number) => {
          const next = { ...ratings, [category]: score };
          next.total = next.focus + next.execution + next.output;
          onChange(next);
        };

        return (
          <div className="space-y-4">
            {(['focus', 'execution', 'output'] as const).map((cat) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                  {cat}:
                </span>
                <div className="flex space-x-1.5">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => updateRating(cat, score)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold font-mono transition-all ${
                        ratings[cat] === score
                          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-slate-800/80 text-xs">
              <span className="text-slate-400">Score Total:</span>
              <span className="text-base font-extrabold text-amber-400 font-mono">
                {ratings.total || 0} / 15
              </span>
            </div>
          </div>
        );
      }

      // 3. Score Target / Tasks Ratio Counter (e.g. 3/3)
      case 'score_target': {
        const completed = value?.completed ?? 0;
        const total = value?.total ?? 3;
        const pct = Math.min(100, Math.round((completed / Math.max(1, total)) * 100));

        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">{pct}% Fulfilled</span>
              <span className="text-2xl font-extrabold font-mono text-amber-400">
                {completed} <span className="text-slate-500 text-sm">/ {total}</span>
              </span>
            </div>

            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
              <span className="text-slate-400">Adjust counts:</span>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => onChange({ completed: Math.max(0, completed - 1), total })}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold font-mono"
                  title="Minus completed"
                >
                  -1
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ completed: completed + 1, total: Math.max(total, completed + 1) })}
                  className="px-2.5 h-7 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 font-bold"
                  title="Mark one completed"
                >
                  +1 Done
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ completed, total: total + 1 })}
                  className="px-2 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs"
                  title="Add target"
                >
                  + Target
                </button>
              </div>
            </div>
          </div>
        );
      }

      // 4. Boolean Checkbox / Switch
      case 'checkbox': {
        const isChecked = !!value;
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Status</span>
              <button
                type="button"
                onClick={() => onChange(!isChecked)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  isChecked
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <span>{isChecked ? 'Yes (Locked In)' : 'No (Pending)'}</span>
              </button>
            </div>
          </div>
        );
      }

      // 5. Textarea (Reflexions, Notes, Plans)
      case 'textarea': {
        return (
          <div className="space-y-2">
            <textarea
              rows={4}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || 'Type here...'}
              className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-all resize-y leading-relaxed"
            />
          </div>
        );
      }

      // 5b. Numbered List (1, 2, 3 discrete priority items)
      case 'numbered_list': {
        // Parse text with "1 ... 2 ... 3 ..." or newline items or array
        let items: string[] = [];
        if (Array.isArray(value)) {
          items = value;
        } else if (typeof value === 'string') {
          // Check if string contains numbered items like "1 abc\n2 def\n3 ghi" or "1 abc 2 def"
          const lines = value.split('\n').filter(l => l.trim().length > 0);
          if (lines.length > 0) {
            items = lines.map(line => line.replace(/^[0-9]+[\.\)\s]+/, '').trim());
          }
        }
        
        // Ensure at least 3 numbered items are available by default
        while (items.length < 3) {
          items.push('');
        }

        const handleItemChange = (index: number, text: string) => {
          const next = [...items];
          next[index] = text;
          // Format as numbered string for full backward-compatibility with planNotes string
          const formatted = next
            .map((txt, idx) => txt.trim() ? `${idx + 1} ${txt.trim()}` : '')
            .filter(Boolean)
            .join('\n');
          onChange(formatted);
        };

        const handleAddItem = () => {
          const next = [...items, ''];
          const formatted = next
            .map((txt, idx) => txt.trim() ? `${idx + 1} ${txt.trim()}` : '')
            .filter(Boolean)
            .join('\n');
          onChange(formatted);
        };

        const handleRemoveItem = (index: number) => {
          const next = items.filter((_, i) => i !== index);
          const formatted = next
            .map((txt, idx) => txt.trim() ? `${idx + 1} ${txt.trim()}` : '')
            .filter(Boolean)
            .join('\n');
          onChange(formatted);
        };

        return (
          <div className="space-y-2.5">
            {items.map((itemText, idx) => (
              <div key={idx} className="flex items-center space-x-2.5 group">
                {/* Visual Number Badge */}
                <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-extrabold font-mono text-xs flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/10">
                  {idx + 1}
                </div>

                {/* Direct Text Input for that specific item */}
                <input
                  type="text"
                  value={itemText}
                  onChange={(e) => handleItemChange(idx, e.target.value)}
                  placeholder={`Priority ${idx + 1}...`}
                  className="flex-1 bg-slate-950/90 border border-slate-800 focus:border-amber-500/60 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                />

                {/* Remove button if more than 3 */}
                {items.length > 3 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1.5 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center space-x-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>+ Add Priority #{items.length + 1}</span>
              </button>
            </div>
          </div>
        );
      }

      // 6. Single Line Text
      case 'text': {
        return (
          <div>
            <input
              type="text"
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || ''}
              className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500/50 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
            />
          </div>
        );
      }

      // 7. Duration (Planned vs Actual)
      case 'duration': {
        const duration = value || { planned: 50, actual: 45 };
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Planned (min)
              </label>
              <input
                type="number"
                value={duration.planned || 0}
                onChange={(e) => onChange({ ...duration, planned: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-sm text-amber-400 font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Actual (min)
              </label>
              <input
                type="number"
                value={duration.actual || 0}
                onChange={(e) => onChange({ ...duration, actual: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-sm text-slate-200 font-mono font-bold"
              />
            </div>
          </div>
        );
      }

      // 8. GWS Session Link Trigger
      case 'gws_session_link': {
        const sessions = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {sessions.length} sprint{sessions.length === 1 ? '' : 's'} logged
              </span>
              {onAction && (
                <button
                  type="button"
                  onClick={() => onAction('open_gws')}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Launch GWS</span>
                </button>
              )}
            </div>
            {sessions.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-500">
                No GWS sessions linked yet today.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {sessions.map((s: any, idx: number) => (
                  <div key={s.id || idx} className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex justify-between items-center text-xs">
                    <span className="text-slate-200 font-medium truncate max-w-[180px]">{s.taskName || 'Sprint'}</span>
                    <span className="text-amber-400 font-mono font-bold">{s.actualMinutes}m</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      // 9. Interactive Checklist
      case 'checklist': {
        const items: Array<{ id: string; text: string; completed: boolean }> = Array.isArray(value) ? value : [];
        const toggleItem = (index: number) => {
          const next = [...items];
          next[index].completed = !next[index].completed;
          onChange(next);
        };
        const removeItem = (index: number) => {
          const next = items.filter((_, i) => i !== index);
          onChange(next);
        };

        return (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id || idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => toggleItem(idx)}
                  className="flex items-center space-x-2 text-left text-slate-200 flex-1 truncate"
                >
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${item.completed ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span className={item.completed ? 'line-through text-slate-500' : ''}>{item.text}</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="p-1 text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        );
      }

      // 10. Task Points Table (Weekly Goal Crusher)
      case 'task_points_table': {
        const tasks: Array<{ id: string; text: string; score: number; completed: boolean }> = Array.isArray(value) ? value : [];
        const toggleTask = (id: string) => {
          onChange(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
        };
        const updateTaskScore = (id: string, score: number) => {
          onChange(tasks.map(t => t.id === id ? { ...t, score: Math.max(1, score) } : t));
        };
        const deleteTask = (id: string) => {
          onChange(tasks.filter(t => t.id !== id));
        };

        const totalPoints = tasks.reduce((acc, t) => acc + (t.score || 0), 0);
        const earned = tasks.filter(t => t.completed).reduce((acc, t) => acc + (t.score || 0), 0);

        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
              <span className="text-slate-400">Total Goal Breakdown:</span>
              <span className="font-mono font-bold text-amber-400">
                {earned} / {totalPoints} Pts Earned
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {tasks.map((t) => (
                <div key={t.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleTask(t.id)}
                    className="flex items-center space-x-2 text-left flex-1"
                  >
                    <CheckCircle2 className={`w-4 h-4 shrink-0 ${t.completed ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span className={`text-xs ${t.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                      {t.text}
                    </span>
                  </button>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {t.score} pt{t.score > 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteTask(t.id)}
                      className="text-slate-600 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // 11. Reward Ladder Tier Table
      case 'reward_ladder': {
        const rewards: Array<{ id: string; minScore: number; reward: string }> = Array.isArray(value) ? value : [];
        const updateReward = (id: string, text: string) => {
          onChange(rewards.map(r => r.id === id ? { ...r, reward: text } : r));
        };
        const updateThreshold = (id: string, minScore: number) => {
          onChange(
            rewards
              .map(r => r.id === id ? { ...r, minScore } : r)
              .sort((a, b) => a.minScore - b.minScore)
          );
        };
        const deleteReward = (id: string) => {
          onChange(rewards.filter(r => r.id !== id));
        };
        const addReward = () => {
          const used = rewards.map(r => r.minScore);
          let nextScore = 6;
          for (let i = 1; i <= 10; i++) {
            if (!used.includes(i)) {
              nextScore = i;
              break;
            }
          }
          onChange(
            [...rewards, { id: `rew_${Date.now()}`, minScore: nextScore, reward: '' }]
              .sort((a, b) => a.minScore - b.minScore)
          );
        };

        return (
          <div className="space-y-2.5">
            {rewards.map((r) => (
              <div key={r.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <select
                    value={r.minScore}
                    onChange={(e) => updateThreshold(r.id, parseInt(e.target.value) || 1)}
                    className="font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 focus:outline-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((pts) => (
                      <option key={pts} value={pts}>{pts}+ Pts</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => deleteReward(r.id)}
                    className="p-1 text-slate-600 hover:text-rose-400"
                    title="Delete reward"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={r.reward}
                  onChange={(e) => updateReward(r.id, e.target.value)}
                  placeholder="Custom reward details..."
                  className="w-full bg-transparent text-xs text-slate-200 focus:outline-none"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addReward}
              className="w-full py-2 rounded-xl border border-dashed border-slate-800 hover:border-amber-500/40 text-xs font-bold text-amber-400 flex items-center justify-center space-x-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Custom Reward</span>
            </button>
          </div>
        );
      }

      default:
        return (
          <div className="text-xs text-slate-500">
            Card type: {field.type}
          </div>
        );
    }
  };

  return (
    <div className={`${field.width || 'col-span-12'} ${getShapeClasses()} flex flex-col justify-between transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide flex items-center space-x-2">
            <span>{field.label}</span>
          </h3>
          {field.description && (
            <p className="text-xs text-slate-400 mt-0.5">{field.description}</p>
          )}
        </div>
      </div>

      {/* Dynamic Content */}
      <div className="mt-1 flex-1">
        {renderFieldContent()}
      </div>
    </div>
  );
};
