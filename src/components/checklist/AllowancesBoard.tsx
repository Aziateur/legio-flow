import React, { useMemo, useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { AllowanceItem, AllowancePeriod, ProblemColorKey } from '../../types/schema';
import { PROBLEM_COLOR_STYLES } from '../../lib/problems';
import {
  Minus,
  Plus,
  RotateCcw,
  Sliders,
  Trash2,
  Wallet
} from 'lucide-react';

interface AllowancesBoardProps {
  selectedDate: string;
  selectedWeekId: string;
  weekLabel: string;
  monthKey: string;
}

const PERIOD_META: Record<
  AllowancePeriod,
  { label: string; short: string; perLabel: string; badgeClass: string }
> = {
  daily: {
    label: 'Daily',
    short: 'Daily',
    perLabel: '/ day',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  },
  weekly: {
    label: 'Weekly',
    short: 'Weekly',
    perLabel: '/ week',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  },
  monthly: {
    label: 'Monthly',
    short: 'Monthly',
    perLabel: '/ month',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30'
  }
};

const COLOR_KEYS: ProblemColorKey[] = [
  'amber',
  'emerald',
  'cyan',
  'violet',
  'rose',
  'orange',
  'sky',
  'slate'
];

const formatCleanNum = (val: number): string => {
  const rounded = Math.round(val * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

export const AllowancesBoard: React.FC<AllowancesBoardProps> = ({
  selectedDate,
  selectedWeekId,
  weekLabel,
  monthKey
}) => {
  const { allowanceItems, saveAllowanceItems, todayDate } = useStorage();

  const [periodFilter, setPeriodFilter] = useState<'all' | AllowancePeriod>('all');
  const [recentlyUsedId, setRecentlyUsedId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameText, setEditingNameText] = useState('');
  const [editingLimitId, setEditingLimitId] = useState<string | null>(null);
  const [editingLimitText, setEditingLimitText] = useState('');
  const [settingsOpenId, setSettingsOpenId] = useState<string | null>(null);

  // Inline create form state
  const [draftName, setDraftName] = useState('');
  const [draftPeriod, setDraftPeriod] = useState<AllowancePeriod>('weekly');
  const [draftLimit, setDraftLimit] = useState('2');
  const [draftStep, setDraftStep] = useState('1');
  const [draftUnit, setDraftUnit] = useState('');

  const getActivePeriodKey = (period: AllowancePeriod): string => {
    if (period === 'daily') return selectedDate;
    if (period === 'weekly') return selectedWeekId;
    return monthKey;
  };

  const getUsedInPeriod = (item: AllowanceItem): number => {
    const key = getActivePeriodKey(item.period);
    return Number(item.usageByPeriod?.[key] || 0);
  };

  const filteredItems = useMemo(() => {
    const list =
      periodFilter === 'all'
        ? allowanceItems
        : allowanceItems.filter(a => a.period === periodFilter);
    const periodOrder: Record<AllowancePeriod, number> = { daily: 0, weekly: 1, monthly: 2 };
    return [...list].sort((a, b) => periodOrder[a.period] - periodOrder[b.period]);
  }, [allowanceItems, periodFilter]);

  const overBudgetCount = useMemo(
    () => allowanceItems.filter(a => a.limit - getUsedInPeriod(a) < 0).length,
    [allowanceItems, selectedDate, selectedWeekId, monthKey]
  );

  const exhaustedCount = useMemo(
    () => allowanceItems.filter(a => a.limit - getUsedInPeriod(a) <= 0).length,
    [allowanceItems, selectedDate, selectedWeekId, monthKey]
  );

  const updateItem = (id: string, patch: Partial<AllowanceItem>) => {
    saveAllowanceItems(allowanceItems.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleSpendOrRefund = (item: AllowanceItem, direction: 'use' | 'refund') => {
    const key = getActivePeriodKey(item.period);
    const step = item.step && item.step > 0 ? item.step : 1;
    const curUsed = Number(item.usageByPeriod?.[key] || 0);
    const allowOver = item.allowOverspend !== false;

    let nextUsed = curUsed;
    if (direction === 'use') {
      nextUsed = Math.round((curUsed + step) * 100) / 100;
      if (!allowOver && nextUsed > item.limit) {
        nextUsed = item.limit;
      }
    } else {
      nextUsed = Math.max(0, Math.round((curUsed - step) * 100) / 100);
    }

    updateItem(item.id, {
      usageByPeriod: {
        ...(item.usageByPeriod || {}),
        [key]: nextUsed
      }
    });

    if (direction === 'use') {
      setRecentlyUsedId(item.id);
      setTimeout(() => {
        setRecentlyUsedId(prev => (prev === item.id ? null : prev));
      }, 450);
    }
  };

  const handleResetPeriod = (item: AllowanceItem) => {
    const key = getActivePeriodKey(item.period);
    const nextUsage = { ...(item.usageByPeriod || {}) };
    delete nextUsage[key];
    updateItem(item.id, { usageByPeriod: nextUsage });
  };

  const handleDelete = (id: string) => {
    saveAllowanceItems(allowanceItems.filter(a => a.id !== id));
    if (settingsOpenId === id) setSettingsOpenId(null);
  };

  const handleAddAllowance = (
    e?: React.FormEvent,
    preset?: { name: string; period: AllowancePeriod; limit: number; unit?: string; color?: ProblemColorKey }
  ) => {
    if (e) e.preventDefault();
    const name = (preset ? preset.name : draftName).trim();
    if (!name) return;

    const period = preset ? preset.period : draftPeriod;
    const parsedLimit = preset ? preset.limit : parseFloat(draftLimit);
    const limit = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : 1;
    const parsedStep = preset ? 1 : parseFloat(draftStep);
    const step = !Number.isNaN(parsedStep) && parsedStep > 0 ? parsedStep : 1;
    const unit = (preset ? preset.unit || '' : draftUnit).trim();
    const color: ProblemColorKey =
      preset?.color || (period === 'daily' ? 'emerald' : period === 'weekly' ? 'amber' : 'violet');

    const nowIso = new Date().toISOString();
    const nextItem: AllowanceItem = {
      id: `alw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      period,
      limit,
      step,
      ...(unit ? { unit } : {}),
      usageByPeriod: {},
      allowOverspend: true,
      color,
      createdAt: todayDate,
      updatedAt: nowIso
    };

    saveAllowanceItems([...allowanceItems, nextItem]);
    if (!preset) {
      setDraftName('');
      setDraftUnit('');
      setDraftStep('1');
    }
  };

  const commitNameEdit = () => {
    if (!editingNameId) return;
    const clean = editingNameText.trim();
    if (clean) {
      updateItem(editingNameId, { name: clean });
    }
    setEditingNameId(null);
    setEditingNameText('');
  };

  const commitLimitEdit = () => {
    if (!editingLimitId) return;
    const parsed = parseFloat(editingLimitText.trim());
    if (!Number.isNaN(parsed) && parsed > 0) {
      updateItem(editingLimitId, { limit: parsed });
    }
    setEditingLimitId(null);
    setEditingLimitText('');
  };

  return (
    <section className="space-y-4 pt-2">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <Wallet className="h-4 w-4 text-amber-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Allowances &amp; Quotas • Daily / Weekly / Monthly Budgets
          </h2>
          <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] font-mono text-slate-400">
            Click to deduct points • Auto-resets per period
          </span>
          {overBudgetCount > 0 && (
            <span className="rounded-full border border-rose-500/35 bg-rose-500/15 px-2 py-0.5 text-[10px] font-mono font-bold text-rose-300">
              {overBudgetCount} over limit
            </span>
          )}
          {overBudgetCount === 0 && exhaustedCount > 0 && (
            <span className="rounded-full border border-orange-500/35 bg-orange-500/15 px-2 py-0.5 text-[10px] font-mono font-bold text-orange-300">
              {exhaustedCount} at 0 left
            </span>
          )}
        </div>

        <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
          {(
            [
              { id: 'all', label: `All (${allowanceItems.length})` },
              { id: 'daily', label: 'Daily' },
              { id: 'weekly', label: 'Weekly' },
              { id: 'monthly', label: 'Monthly' }
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPeriodFilter(tab.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                periodFilter === tab.id
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Board Container */}
      <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-amber-950/15 p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            Active cycles:{' '}
            <strong className="font-mono text-emerald-300">{selectedDate}</strong> ·{' '}
            <strong className="font-mono text-amber-300">{weekLabel}</strong> ·{' '}
            <strong className="font-mono text-purple-300">{monthKey}</strong>
          </span>
          <span className="text-slate-500">
            Click name or cap to edit • Use sliders to customize step, unit, color &amp; cap mode
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-amber-500/25 bg-slate-950/60 px-4 py-6 text-center space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-300">
                {allowanceItems.length === 0
                  ? 'No allowances set yet'
                  : `No ${periodFilter} allowances yet`}
              </p>
              <p className="text-[11px] text-slate-500">
                Set finite budgets that count <strong className="text-amber-300">down</strong> each time you click them (e.g. Outings / week, Cheat Meals / week, Screen Sessions / day, Impulse Buys / month).
              </p>
            </div>
            {allowanceItems.length === 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    handleAddAllowance(undefined, {
                      name: 'Outings',
                      period: 'weekly',
                      limit: 2,
                      unit: 'outings',
                      color: 'amber'
                    })
                  }
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 text-xs font-bold transition-colors"
                >
                  + Outings (2 / week)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAddAllowance(undefined, {
                      name: 'Cheat Meals',
                      period: 'weekly',
                      limit: 1,
                      unit: 'meals',
                      color: 'orange'
                    })
                  }
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition-colors"
                >
                  + Cheat Meals (1 / week)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAddAllowance(undefined, {
                      name: 'Leisure / Scroll',
                      period: 'daily',
                      limit: 2,
                      unit: 'pts',
                      color: 'emerald'
                    })
                  }
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition-colors"
                >
                  + Leisure (2 / day)
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredItems.map(item => {
              const used = getUsedInPeriod(item);
              const remaining = Math.round((item.limit - used) * 100) / 100;
              const step = item.step && item.step > 0 ? item.step : 1;
              const allowOver = item.allowOverspend !== false;
              const pMeta = PERIOD_META[item.period];
              const colorStyle = PROBLEM_COLOR_STYLES[item.color || 'amber'] || PROBLEM_COLOR_STYLES.amber;
              const isOver = remaining < 0;
              const isZero = remaining === 0;
              const isLow = remaining > 0 && remaining <= item.limit * 0.35;
              const pctRemaining =
                item.limit > 0 ? Math.max(0, Math.min(100, Math.round((remaining / item.limit) * 100))) : 0;
              const justClicked = recentlyUsedId === item.id;
              const isSettingsOpen = settingsOpenId === item.id;
              const isEditingName = editingNameId === item.id;
              const isEditingLimit = editingLimitId === item.id;

              const cardBorder = justClicked
                ? 'border-amber-400/75 bg-amber-500/10 shadow-md shadow-amber-500/10'
                : isOver
                ? 'border-rose-500/50 bg-rose-950/20'
                : isZero
                ? 'border-orange-500/40 bg-slate-950/90'
                : 'border-slate-800 bg-slate-950/90 hover:border-amber-500/35';

              const barColor = isOver
                ? 'bg-rose-500'
                : isZero
                ? 'bg-orange-500'
                : isLow
                ? 'bg-amber-400'
                : colorStyle.barClass;

              const numberColor = isOver
                ? 'text-rose-400'
                : isZero
                ? 'text-orange-400'
                : isLow
                ? 'text-amber-300'
                : 'text-emerald-300';

              const unitText = item.unit?.trim() || 'pts';

              return (
                <div
                  key={item.id}
                  className={`group rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition-all ${cardBorder}`}
                >
                  {/* Tile Top Row: Name + Period Switcher + Customize + Delete */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      {isEditingName ? (
                        <input
                          type="text"
                          value={editingNameText}
                          autoFocus
                          onChange={e => setEditingNameText(e.target.value)}
                          onBlur={commitNameEdit}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitNameEdit();
                            if (e.key === 'Escape') {
                              setEditingNameId(null);
                              setEditingNameText('');
                            }
                          }}
                          className="w-full rounded border border-amber-500/50 bg-slate-900 px-2 py-0.5 text-sm font-semibold text-slate-100 outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNameId(item.id);
                            setEditingNameText(item.name);
                          }}
                          className="w-full text-left text-sm font-bold text-slate-100 hover:text-amber-200 transition-colors leading-snug truncate"
                          title="Click to rename"
                        >
                          {item.name}
                        </button>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          value={item.period}
                          onChange={e =>
                            updateItem(item.id, { period: e.target.value as AllowancePeriod })
                          }
                          aria-label="Allowance period"
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold outline-none cursor-pointer ${pMeta.badgeClass}`}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>

                        {isOver && (
                          <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-rose-300">
                            {formatCleanNum(Math.abs(remaining))} OVER
                          </span>
                        )}
                        {isZero && (
                          <span className="rounded-full bg-orange-500/15 border border-orange-500/35 px-1.5 py-0.5 font-mono text-[10px] font-bold text-orange-300">
                            Limit reached
                          </span>
                        )}
                        {isLow && !isZero && !isOver && (
                          <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                            Low
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSettingsOpenId(isSettingsOpen ? null : item.id)}
                        className={`p-1 rounded-lg transition-colors ${
                          isSettingsOpen
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'text-slate-500 hover:text-slate-200'
                        }`}
                        title="Customize allowance (cap, step, unit, color)"
                      >
                        <Sliders className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1 text-slate-600 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                        title="Delete allowance"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Center Remaining Counter + Depleting Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`font-mono text-3xl font-extrabold tracking-tight ${numberColor}`}>
                          {formatCleanNum(remaining)}
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                          {unitText} left
                        </span>
                      </div>

                      {isEditingLimit ? (
                        <input
                          type="number"
                          step="any"
                          min={0.1}
                          value={editingLimitText}
                          autoFocus
                          onChange={e => setEditingLimitText(e.target.value)}
                          onBlur={commitLimitEdit}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitLimitEdit();
                            if (e.key === 'Escape') setEditingLimitId(null);
                          }}
                          className="w-16 rounded border border-amber-500/60 bg-slate-900 px-1.5 py-0.5 font-mono text-xs font-bold text-amber-300 outline-none text-right"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLimitId(item.id);
                            setEditingLimitText(String(item.limit));
                          }}
                          className="text-[11px] font-mono text-slate-400 hover:text-amber-300 transition-colors"
                          title="Click to edit allowance cap"
                        >
                          of {formatCleanNum(item.limit)} {pMeta.perLabel}
                        </button>
                      )}
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${isOver ? 100 : pctRemaining}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span>Used: {formatCleanNum(used)}</span>
                      <span>
                        {allowOver ? 'Tracks overspend' : 'Hard stop at 0'}
                      </span>
                    </div>
                  </div>

                  {/* Inline Customize Drawer */}
                  {isSettingsOpen && (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 text-[11px]">
                      <div className="grid grid-cols-3 gap-1.5">
                        <label className="space-y-0.5">
                          <span className="text-[9px] font-bold uppercase text-slate-500 block">Cap</span>
                          <input
                            type="number"
                            step="any"
                            min={0.1}
                            value={item.limit}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              if (!Number.isNaN(v) && v > 0) updateItem(item.id, { limit: v });
                            }}
                            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-1 font-mono text-slate-100 outline-none"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="text-[9px] font-bold uppercase text-slate-500 block">Step / click</span>
                          <input
                            type="number"
                            step="any"
                            min={0.1}
                            value={step}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              if (!Number.isNaN(v) && v > 0) updateItem(item.id, { step: v });
                            }}
                            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-1 font-mono text-slate-100 outline-none"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="text-[9px] font-bold uppercase text-slate-500 block">Unit</span>
                          <input
                            type="text"
                            value={item.unit || ''}
                            onChange={e => updateItem(item.id, { unit: e.target.value })}
                            placeholder="pts"
                            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-1 font-mono text-slate-100 outline-none"
                          />
                        </label>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          {COLOR_KEYS.map(ck => (
                            <button
                              key={ck}
                              type="button"
                              onClick={() => updateItem(item.id, { color: ck })}
                              className={`w-4 h-4 rounded-full ${PROBLEM_COLOR_STYLES[ck].dotClass} transition-transform ${
                                (item.color || 'amber') === ck
                                  ? 'ring-2 ring-white scale-110'
                                  : 'opacity-50 hover:opacity-100'
                              }`}
                              title={PROBLEM_COLOR_STYLES[ck].label}
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => updateItem(item.id, { allowOverspend: !allowOver })}
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                            allowOver
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-slate-950 text-slate-300 border-slate-700'
                          }`}
                        >
                          {allowOver ? 'Allow −' : 'Hard 0'}
                        </button>
                      </div>

                      {used > 0 && (
                        <button
                          type="button"
                          onClick={() => handleResetPeriod(item)}
                          className="w-full inline-flex items-center justify-center gap-1 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-bold text-slate-300"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset current {item.period} to {formatCleanNum(item.limit)}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Bottom Tactile Deduct (-1) / Refund (+1) Controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!allowOver && remaining <= 0}
                      onClick={() => handleSpendOrRefund(item, 'use')}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-extrabold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                        justClicked
                          ? 'border-amber-400 bg-amber-500 text-slate-950'
                          : isOver || isZero
                          ? 'border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
                          : 'border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                      }`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>
                        -{formatCleanNum(step)} Use
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSpendOrRefund(item, 'refund')}
                      disabled={used <= 0}
                      title={`Restore +${formatCleanNum(step)} point`}
                      className="rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-2 text-slate-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Inline Add New Allowance Form */}
        <form
          onSubmit={e => handleAddAllowance(e)}
          className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 pt-2 border-t border-slate-800/80"
        >
          <input
            type="text"
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            placeholder="Add allowance (e.g. Outings, Cheat Meals, Late Nights, Gaming)..."
            className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500/50"
          />

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={draftPeriod}
              onChange={e => setDraftPeriod(e.target.value as AllowancePeriod)}
              aria-label="Allowance reset period"
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-amber-500/50"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>

            <input
              type="number"
              step="any"
              min={0.1}
              value={draftLimit}
              onChange={e => setDraftLimit(e.target.value)}
              placeholder="Limit"
              title="Allowance cap per period (e.g. 2 outings)"
              className="w-20 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500/50"
            />

            <input
              type="text"
              value={draftUnit}
              onChange={e => setDraftUnit(e.target.value)}
              placeholder="Unit (outings)"
              title="Optional unit label (outings, pts, hrs, meals...)"
              className="w-28 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500/50"
            />

            <input
              type="number"
              step="any"
              min={0.1}
              value={draftStep}
              onChange={e => setDraftStep(e.target.value)}
              placeholder="Step"
              title="Points deducted per click (default 1)"
              className="w-16 rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-2 font-mono text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500/50"
            />

            <button
              type="submit"
              disabled={!draftName.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-extrabold text-slate-950 transition-colors disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              <span>Add Allowance</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
