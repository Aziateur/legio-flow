import React, { useState, useEffect, useRef } from 'react';
import { TemplateField } from '../../types/schema';
import { 
  CheckCircle2, 
  Circle,
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

interface PriorityRow {
  id: string;
  text: string;
  completed: boolean;
  weeklyTaskId?: string;
  subTaskId?: string;
}

const parsePriorityValueToNonEmptyRows = (rawVal: any): PriorityRow[] => {
  const parsed: PriorityRow[] = [];
  if (Array.isArray(rawVal)) {
    rawVal.forEach((item, idx) => {
      if (typeof item === 'string') {
        if (item.trim().length > 0) {
          parsed.push({ id: `prio_${idx}`, text: item, completed: false });
        }
      } else if (item && typeof item === 'object' && typeof item.text === 'string' && item.text.trim().length > 0) {
        parsed.push({
          id: item.id || `prio_${idx}`,
          text: item.text,
          completed: !!item.completed,
          weeklyTaskId: item.weeklyTaskId,
          subTaskId: item.subTaskId
        });
      }
    });
  } else if (typeof rawVal === 'string' && rawVal.trim().length > 0) {
    const lines = rawVal.split('\n');
    lines.forEach((line, idx) => {
      let cleaned = line.replace(/^[0-9]+[\.\)\s]+/, '').trim();
      let completed = false;
      if (cleaned.startsWith('[x] ') || cleaned.startsWith('[X] ')) {
        completed = true;
        cleaned = cleaned.slice(4).trim();
      } else if (cleaned.startsWith('[ ] ')) {
        cleaned = cleaned.slice(4).trim();
      }
      if (cleaned.length > 0) {
        parsed.push({ id: `prio_${idx}`, text: cleaned, completed });
      }
    });
  }
  return parsed;
};

const padPriorityRows = (nonEmptyRows: PriorityRow[], minSlots = 3): PriorityRow[] => {
  const rows = [...nonEmptyRows];
  while (rows.length < minSlots) {
    rows.push({
      id: `prio_slot_${rows.length}_${Math.random().toString(36).slice(2, 6)}`,
      text: '',
      completed: false
    });
  }
  return rows;
};

const getPriorityCanonicalSig = (rows: PriorityRow[]): string =>
  rows
    .filter(r => r.text.trim().length > 0)
    .map(r => `${r.text.trim()}|${r.completed ? 1 : 0}|${r.weeklyTaskId || ''}|${r.subTaskId || ''}`)
    .join('\n');

interface ModularCardProps {
  field: TemplateField;
  value: any;
  onChange: (val: any) => void;
  // Contextual actions
  onAction?: (actionName: string, payload?: any) => void;
}

export const ModularCard: React.FC<ModularCardProps> = ({ field, value, onChange, onAction }) => {
  const [localPriorityRows, setLocalPriorityRows] = useState<PriorityRow[]>(() =>
    field.type === 'numbered_list' ? padPriorityRows(parsePriorityValueToNonEmptyRows(value), 3) : []
  );
  const localPriorityRowsRef = useRef<PriorityRow[]>(localPriorityRows);
  localPriorityRowsRef.current = localPriorityRows;

  // Keep numbered_list rows synced when external actions occur (Pull Goal, Carry Over, Date switch, Cloud Sync)
  useEffect(() => {
    if (field.type !== 'numbered_list') return;
    const incomingNonEmpty = parsePriorityValueToNonEmptyRows(value);
    const incomingSig = getPriorityCanonicalSig(incomingNonEmpty);
    const currentSig = getPriorityCanonicalSig(localPriorityRowsRef.current);
    if (incomingSig !== currentSig) {
      const nextPadded = padPriorityRows(incomingNonEmpty, 3);
      localPriorityRowsRef.current = nextPadded;
      setLocalPriorityRows(nextPadded);
    }
  }, [field.type, value]);

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
        const textareaVal = Array.isArray(value)
          ? value
              .map((item: any, idx: number) =>
                typeof item === 'string'
                  ? item
                  : `${idx + 1} ${item?.completed ? '[x] ' : ''}${item?.text || ''}`.trim()
              )
              .filter(Boolean)
              .join('\n')
          : typeof value === 'string'
          ? value
          : '';
        return (
          <div className="space-y-2">
            <textarea
              rows={4}
              value={textareaVal}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || 'Type here...'}
              className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-all resize-y leading-relaxed"
            />
          </div>
        );
      }

      // 5b. Numbered List (1, 2, 3 discrete priority items with ID-linked weekly sync & completion checkboxes)
      case 'numbered_list': {
        const displayRows = localPriorityRows;

        const serializeAndSync = (nextRows: PriorityRow[], toggledRow?: PriorityRow) => {
          const filledRows = nextRows
            .filter(r => r.text.trim().length > 0)
            .map(r => ({ ...r, text: r.text.trim() }));

          const formatted = filledRows
            .map((r, idx) => `${idx + 1} ${r.completed ? '[x] ' : ''}${r.text}`)
            .join('\n');

          if (onAction) {
            const completedCount = filledRows.filter(r => r.completed).length;
            const totalCount = Math.max(3, filledRows.length);
            onAction('sync_daily_priorities', {
              completedCount,
              totalCount,
              priorityItems: filledRows,
              formattedPlanNotes: formatted,
              toggledItem: toggledRow,
              toggledText: toggledRow?.text?.trim(),
              isCompleted: toggledRow?.completed
            });
          } else {
            onChange(formatted);
          }
        };

        const handleItemChange = (index: number, text: string) => {
          const next = displayRows.map((r, i) =>
            i === index
              ? {
                  ...r,
                  text,
                  // Clear link & completed flag only when the user completely clears the row text
                  completed: text.trim() ? r.completed : false,
                  weeklyTaskId: text.trim() ? r.weeklyTaskId : undefined,
                  subTaskId: text.trim() ? r.subTaskId : undefined
                }
              : r
          );
          localPriorityRowsRef.current = next;
          setLocalPriorityRows(next);
          serializeAndSync(next);
        };

        const handleToggleItem = (index: number) => {
          const target = displayRows[index];
          if (!target || !target.text.trim()) return;
          const updatedRow = { ...target, completed: !target.completed };
          const next = displayRows.map((r, i) => (i === index ? updatedRow : r));
          localPriorityRowsRef.current = next;
          setLocalPriorityRows(next);
          serializeAndSync(next, updatedRow);
        };

        const handleAddItem = () => {
          const next = [
            ...displayRows,
            {
              id: `prio_slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              text: '',
              completed: false
            }
          ];
          localPriorityRowsRef.current = next;
          setLocalPriorityRows(next);
        };

        const handleRemoveItem = (index: number) => {
          const removed = displayRows[index];
          const next = displayRows.filter((_, i) => i !== index);
          localPriorityRowsRef.current = next;
          setLocalPriorityRows(next);
          if (removed && removed.text.trim().length > 0) {
            serializeAndSync(next);
          }
        };

        return (
          <div className="space-y-2.5">
            {displayRows.map((row, idx) => (
              <div key={idx} className="flex items-center space-x-2.5 group">
                {/* Checkable Priority Number Badge */}
                <button
                  type="button"
                  onClick={() => handleToggleItem(idx)}
                  title={row.text.trim() ? (row.completed ? 'Mark incomplete' : 'Mark completed (syncs with Daily & Weekly score)') : `Priority ${idx + 1}`}
                  className={`w-8 h-8 rounded-xl font-extrabold font-mono text-xs flex items-center justify-center shrink-0 transition-all ${
                    row.completed
                      ? 'bg-emerald-500 text-slate-950 border border-emerald-400 shadow-sm shadow-emerald-500/20'
                      : 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 shadow-sm shadow-amber-500/10'
                  }`}
                >
                  {row.completed ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </button>

                {/* Direct Text Input for that specific item */}
                <input
                  type="text"
                  value={row.text}
                  onChange={(e) => handleItemChange(idx, e.target.value)}
                  placeholder={`Priority ${idx + 1}...`}
                  className={`flex-1 bg-slate-950/90 border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm placeholder-slate-600 focus:outline-none transition-colors ${
                    row.completed
                      ? 'border-emerald-500/30 text-slate-400 line-through'
                      : 'border-slate-800 focus:border-amber-500/60 text-slate-100'
                  }`}
                />

                {/* Linked Weekly Goal Badge if connected by ID */}
                {(row.weeklyTaskId || row.subTaskId) && row.text.trim().length > 0 && (
                  <span
                    className="hidden sm:inline-flex items-center px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-400 shrink-0"
                    title="ID-linked to your Weekly Goal Crusher (survives rewording)"
                  >
                    🎯 Week Link
                  </span>
                )}

                {/* Quick check button on right side when filled */}
                {row.text.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleToggleItem(idx)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all shrink-0 ${
                      row.completed
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    {row.completed ? 'Done ✓' : 'Mark Done'}
                  </button>
                )}

                {/* Remove button if more than 3 */}
                {displayRows.length > 3 && (
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

            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Tip: Click a number badge or "Mark Done" to auto-update your Daily & Weekly score.</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center space-x-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>+ Add Priority #{displayRows.length + 1}</span>
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

  const getWidthClasses = () => {
    switch (field.width) {
      case 'col-span-3':
        return 'col-span-1 md:col-span-3';
      case 'col-span-4':
        return 'col-span-1 md:col-span-4';
      case 'col-span-6':
        return 'col-span-1 md:col-span-6';
      case 'col-span-8':
        return 'col-span-1 md:col-span-8';
      case 'col-span-12':
      default:
        return 'col-span-1 md:col-span-12';
    }
  };

  return (
    <div className={`${getWidthClasses()} ${getShapeClasses()} flex flex-col justify-between transition-all duration-200`}>
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
