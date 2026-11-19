import React, { useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { ChecklistItem, ChecklistRecurrence } from '../../types/schema';
import { CheckCircle2, Circle, Plus, Trash2, ListChecks } from 'lucide-react';

const RECURRENCE_STYLES: Record<ChecklistRecurrence, string> = {
  daily: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  weekly: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  monthly: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  none: 'bg-slate-800/80 text-slate-300 border-slate-700'
};

export const ChecklistView: React.FC = () => {
  const {
    checklistCategories,
    checklistItems,
    saveChecklistCategories,
    saveChecklistItems,
    selectedDate,
    selectedWeekId,
    saveDailyEntry
  } = useStorage();

  const [recurrenceFilter, setRecurrenceFilter] = useState<'all' | ChecklistRecurrence>('all');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newTaskTextByCat, setNewTaskTextByCat] = useState<Record<string, string>>({});
  const [newTaskRecurrenceByCat, setNewTaskRecurrenceByCat] = useState<Record<string, ChecklistRecurrence>>({});

  const monthKey = selectedDate.slice(0, 7);

  const getPeriodKey = (recurrence: ChecklistRecurrence): string => {
    if (recurrence === 'daily') return selectedDate;
    if (recurrence === 'weekly') return selectedWeekId;
    if (recurrence === 'monthly') return monthKey;
    return 'none';
  };

  const isItemDone = (item: ChecklistItem): boolean => {
    if (item.recurrence === 'none') return !!item.completed;
    const pKey = getPeriodKey(item.recurrence);
    return Boolean(item.completedPeriods?.includes(pKey));
  };

  const syncDailyAutomaticHabits = (items: ChecklistItem[]) => {
    const dailyItems = items.filter(i => i.recurrence === 'daily');
    if (dailyItems.length > 0) {
      const allDailyDone = dailyItems.every(i => Boolean(i.completedPeriods?.includes(selectedDate)));
      saveDailyEntry(selectedDate, { automaticTasksCompleted: allDailyDone });
    }
  };

  const handleToggleItem = (item: ChecklistItem) => {
    const updated = checklistItems.map(it => {
      if (it.id !== item.id) return it;
      if (it.recurrence === 'none') {
        return { ...it, completed: !it.completed };
      }
      const pKey = getPeriodKey(it.recurrence);
      const currentPeriods = it.completedPeriods || [];
      const exists = currentPeriods.includes(pKey);
      return {
        ...it,
        completedPeriods: exists
          ? currentPeriods.filter(p => p !== pKey)
          : [...currentPeriods, pKey]
      };
    });
    saveChecklistItems(updated);
    syncDailyAutomaticHabits(updated);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    saveChecklistCategories([
      ...checklistCategories,
      { id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, name: trimmed }
    ]);
    setNewCategoryName('');
  };

  const handleRenameCategory = (catId: string, name: string) => {
    saveChecklistCategories(
      checklistCategories.map(c => (c.id === catId ? { ...c, name } : c))
    );
  };

  const handleDeleteCategory = (catId: string) => {
    saveChecklistCategories(checklistCategories.filter(c => c.id !== catId));
    saveChecklistItems(checklistItems.filter(i => i.categoryId !== catId));
  };

  const handleAddItem = (catId: string) => {
    const text = (newTaskTextByCat[catId] || '').trim();
    if (!text) return;
    const recurrence = newTaskRecurrenceByCat[catId] || 'none';
    const nextItem: ChecklistItem = {
      id: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      categoryId: catId,
      text,
      recurrence,
      completed: false,
      completedPeriods: []
    };
    const updated = [...checklistItems, nextItem];
    saveChecklistItems(updated);
    setNewTaskTextByCat(prev => ({ ...prev, [catId]: '' }));
    syncDailyAutomaticHabits(updated);
  };

  const handleEditItemText = (itemId: string, text: string) => {
    saveChecklistItems(
      checklistItems.map(it => (it.id === itemId ? { ...it, text } : it))
    );
  };

  const handleChangeItemRecurrence = (itemId: string, recurrence: ChecklistRecurrence) => {
    const updated = checklistItems.map(it =>
      it.id === itemId ? { ...it, recurrence } : it
    );
    saveChecklistItems(updated);
    syncDailyAutomaticHabits(updated);
  };

  const handleDeleteItem = (itemId: string) => {
    const updated = checklistItems.filter(it => it.id !== itemId);
    saveChecklistItems(updated);
    syncDailyAutomaticHabits(updated);
  };

  const handleClearCompletedOneOffs = () => {
    saveChecklistItems(
      checklistItems.filter(it => !(it.recurrence === 'none' && it.completed))
    );
  };

  const totalItems = checklistItems.length;
  const totalDone = checklistItems.filter(isItemDone).length;
  const completedOneOffCount = checklistItems.filter(it => it.recurrence === 'none' && it.completed).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Simple Top Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-extrabold text-slate-100">Checklist</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-mono font-bold">
                  {totalDone} / {totalItems} Done
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {selectedDate} • {selectedWeekId.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} • {monthKey}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Recurrence Filter Buttons */}
            <div className="flex items-center space-x-1 p-1 rounded-2xl bg-slate-950 border border-slate-800 overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                  { id: 'none', label: 'One-Off' }
                ] as const
              ).map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setRecurrenceFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    recurrenceFilter === f.id
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {completedOneOffCount > 0 && (
              <button
                type="button"
                onClick={handleClearCompletedOneOffs}
                className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold transition-colors"
              >
                Clear Done One-Offs ({completedOneOffCount})
              </button>
            )}
          </div>
        </div>

        {/* Simple Inline + New Category Form */}
        <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3 border-t border-slate-800/80">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="New category..."
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Category</span>
          </button>
        </form>
      </div>

      {/* Category Cards Grid */}
      {checklistCategories.length === 0 ? (
        <div className="p-10 text-center rounded-3xl bg-slate-900/70 border border-slate-800 text-xs text-slate-500">
          No categories yet. Add a category above to start building your checklist.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {checklistCategories.map(cat => {
            const catAllItems = checklistItems.filter(it => it.categoryId === cat.id);
            const catDoneCount = catAllItems.filter(isItemDone).length;
            const visibleItems = catAllItems.filter(
              it => recurrenceFilter === 'all' || it.recurrence === recurrenceFilter
            );

            return (
              <div
                key={cat.id}
                className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Category Card Header */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                    <input
                      type="text"
                      value={cat.name}
                      onChange={(e) => handleRenameCategory(cat.id, e.target.value)}
                      className="flex-1 bg-transparent text-sm font-extrabold text-slate-100 focus:outline-none focus:text-amber-300"
                    />
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono font-bold text-amber-400">
                        {catDoneCount} / {catAllItems.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete category "${cat.name}" and its tasks?`)) {
                            handleDeleteCategory(cat.id);
                          }
                        }}
                        className="p-1 text-slate-600 hover:text-rose-400 transition-colors"
                        title="Delete category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Checklist Items */}
                  {visibleItems.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70 text-[11px] text-slate-500 text-center">
                      No tasks here{recurrenceFilter !== 'all' ? ` matching ${recurrenceFilter}` : ''}.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {visibleItems.map(item => {
                        const done = isItemDone(item);
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between gap-2 p-2.5 rounded-2xl border transition-all ${
                              done
                                ? 'bg-emerald-500/5 border-emerald-500/25'
                                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleItem(item)}
                                className="shrink-0 transition-transform active:scale-90"
                              >
                                {done ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Circle className="w-4 h-4 text-slate-500 hover:text-amber-400" />
                                )}
                              </button>

                              <input
                                type="text"
                                value={item.text}
                                onChange={(e) => handleEditItemText(item.id, e.target.value)}
                                className={`w-full bg-transparent text-xs font-medium focus:outline-none ${
                                  done ? 'line-through text-slate-500' : 'text-slate-100'
                                }`}
                              />
                            </div>

                            <div className="flex items-center space-x-1.5 shrink-0">
                              <select
                                value={item.recurrence}
                                onChange={(e) =>
                                  handleChangeItemRecurrence(item.id, e.target.value as ChecklistRecurrence)
                                }
                                className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold focus:outline-none cursor-pointer ${RECURRENCE_STYLES[item.recurrence]}`}
                              >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="none">One-Off</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 text-slate-600 hover:text-rose-400 transition-colors"
                                title="Delete task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bottom Quick-Add Task Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddItem(cat.id);
                  }}
                  className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80"
                >
                  <input
                    type="text"
                    value={newTaskTextByCat[cat.id] || ''}
                    onChange={(e) =>
                      setNewTaskTextByCat(prev => ({ ...prev, [cat.id]: e.target.value }))
                    }
                    placeholder={`Add task to ${cat.name}...`}
                    className="flex-1 min-w-0 bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                  />
                  <select
                    value={newTaskRecurrenceByCat[cat.id] || 'none'}
                    onChange={(e) =>
                      setNewTaskRecurrenceByCat(prev => ({
                        ...prev,
                        [cat.id]: e.target.value as ChecklistRecurrence
                      }))
                    }
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-[11px] font-semibold text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="none">One-Off</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <button
                    type="submit"
                    className="p-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shrink-0"
                    title="Add task"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
