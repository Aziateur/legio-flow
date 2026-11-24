import React, { useMemo, useState } from 'react';
import { PlaybookEntry, PlaybookKind } from '../../types/schema';
import { useStorage } from '../../context/StorageContext';
import {
  BookOpen,
  Compass,
  Plus,
  Repeat,
  Sparkles,
  Star,
  Trash2,
  Zap
} from 'lucide-react';

const KIND_META: Record<
  PlaybookKind,
  { label: string; shortLabel: string; hint: string; badgeCls: string; activeCls: string; icon: typeof Compass }
> = {
  principle: {
    label: 'Principles',
    shortLabel: 'Principle',
    hint: 'Operating rules & truths that consistently protect your best decisions',
    badgeCls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    activeCls: 'bg-amber-500 text-slate-950 border-amber-400',
    icon: Compass
  },
  routine: {
    label: 'Peak Routines',
    shortLabel: 'Routine',
    hint: 'Repeatable setups, warmups, or sequences that reliably create momentum',
    badgeCls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    activeCls: 'bg-cyan-500 text-slate-950 border-cyan-400',
    icon: Repeat
  },
  catalyst: {
    label: 'Catalysts',
    shortLabel: 'Catalyst',
    hint: 'Conditions that trigger your 13–15/15 GWS sprints & high-energy days',
    badgeCls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    activeCls: 'bg-emerald-500 text-slate-950 border-emerald-400',
    icon: Zap
  }
};

export const WhatWorksPlaybookView: React.FC = () => {
  const {
    playbookItems,
    addPlaybookItem,
    updatePlaybookItem,
    deletePlaybookItem
  } = useStorage();

  const [filterKind, setFilterKind] = useState<'all' | PlaybookKind>('all');
  const [newKind, setNewKind] = useState<PlaybookKind>('principle');
  const [newTitle, setNewTitle] = useState('');
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editKind, setEditKind] = useState<PlaybookKind>('principle');

  const pinnedItems = useMemo(
    () => playbookItems.filter(p => p.pinned),
    [playbookItems]
  );

  const displayedItems = useMemo(() => {
    const list =
      filterKind === 'all'
        ? playbookItems
        : playbookItems.filter(p => p.kind === filterKind);
    return [...list].sort((a, b) => {
      if (Boolean(b.pinned) !== Boolean(a.pinned)) return b.pinned ? 1 : -1;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
  }, [playbookItems, filterKind]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    addPlaybookItem({
      kind: newKind,
      title: trimmed,
      note: newNote.trim() || undefined
    });
    setNewTitle('');
    setNewNote('');
  };

  const startEdit = (item: PlaybookEntry) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditNote(item.note || '');
    setEditKind(item.kind);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const trimmed = editTitle.trim();
    if (trimmed) {
      updatePlaybookItem(editingId, {
        title: trimmed,
        note: editNote.trim() || undefined,
        kind: editKind
      });
    }
    setEditingId(null);
  };

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6">
      {/* Header & Pinned Spotlight */}
      <div className="bg-slate-900/90 border border-emerald-500/25 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>What Works · Success Pattern Playbook</span>
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-100 mt-0.5">
              Principles, Peak-State Routines &amp; Catalysts
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Mirror to the Problem Log: capture what reliably creates high-energy days and 13–15/15 deep work — so you reproduce peak conditions instead of only fixing mistakes.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold shrink-0">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {playbookItems.length} saved
            </span>
            {pinnedItems.length > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                ★ {pinnedItems.length} pinned
              </span>
            )}
          </div>
        </div>

        {/* Fast Capture Bar */}
        <form onSubmit={handleAdd} className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['principle', 'routine', 'catalyst'] as PlaybookKind[]).map(k => {
              const meta = KIND_META[k];
              const Icon = meta.icon;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setNewKind(k)}
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                    newKind === k
                      ? meta.activeCls
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{meta.shortLabel}</span>
                </button>
              );
            })}
            <span className="text-[11px] text-slate-500 ml-1 hidden sm:inline">
              {KIND_META[newKind].hint}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder={
                newKind === 'principle'
                  ? 'e.g. Never open messages before finishing Priority #1...'
                  : newKind === 'routine'
                  ? 'e.g. 20-min walk + espresso before first GWS sprint...'
                  : 'e.g. 7.5h+ sleep + phone in another room = 14/15 sprints...'
              }
              className="sm:col-span-6 bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none"
            />
            <input
              type="text"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Optional: exact cue, timing, or why it works..."
              className="sm:col-span-4 bg-slate-950 border border-slate-800 focus:border-emerald-500/40 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="sm:col-span-2 inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Save</span>
            </button>
          </div>
        </form>
      </div>

      {/* Filter Bar + Playbook Cards */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-slate-900 border border-slate-800">
            {(
              [
                { id: 'all', label: `All (${playbookItems.length})` },
                { id: 'principle', label: `Principles (${playbookItems.filter(p => p.kind === 'principle').length})` },
                { id: 'routine', label: `Routines (${playbookItems.filter(p => p.kind === 'routine').length})` },
                { id: 'catalyst', label: `Catalysts (${playbookItems.filter(p => p.kind === 'catalyst').length})` }
              ] as Array<{ id: 'all' | PlaybookKind; label: string }>
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterKind(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  filterKind === tab.id
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-slate-500">
            Tip: Pin (★) your top 2–3 catalysts to surface quietly in Today&apos;s Brief.
          </span>
        </div>

        {displayedItems.length === 0 ? (
          <div className="p-10 rounded-3xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-2">
            <BookOpen className="w-7 h-7 text-emerald-500/40 mx-auto" />
            <p className="text-sm font-bold text-slate-300">No entries saved yet</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Next time you have an effortless 9/10 day or a 14/15 deep work sprint, write down the principle, routine, or catalyst that triggered it.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {displayedItems.map(item => {
              const meta = KIND_META[item.kind];
              const Icon = meta.icon;
              const isEditing = editingId === item.id;
              return (
                <div
                  key={item.id}
                  className={`group p-4 rounded-2xl border transition-colors space-y-2.5 ${
                    item.pinned
                      ? 'bg-emerald-500/5 border-emerald-500/35 shadow-md'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        {(['principle', 'routine', 'catalyst'] as PlaybookKind[]).map(k => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setEditKind(k)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                              editKind === k
                                ? KIND_META[k].activeCls
                                : 'bg-slate-950 text-slate-400 border-slate-800'
                            }`}
                          >
                            {KIND_META[k].shortLabel}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-100 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={editNote}
                        onChange={e => setEditNote(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        placeholder="Why it works / exact trigger..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={commitEdit}
                          className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 text-xs font-extrabold"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg border text-[10px] font-extrabold uppercase tracking-wider ${meta.badgeCls}`}>
                            <Icon className="w-3 h-3" />
                            <span>{meta.shortLabel}</span>
                          </span>
                          {item.pinned && (
                            <span className="text-[10px] font-bold text-amber-300">
                              ★ Pinned in Brief
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => updatePlaybookItem(item.id, { pinned: !item.pinned })}
                            title={item.pinned ? 'Unpin from Daily Brief' : 'Pin to Today’s Brief'}
                            className={`p-1 rounded-lg transition-colors ${
                              item.pinned
                                ? 'text-amber-400 hover:text-amber-300'
                                : 'text-slate-600 hover:text-amber-400'
                            }`}
                          >
                            <Star className={`w-3.5 h-3.5 ${item.pinned ? 'fill-amber-400' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePlaybookItem(item.id)}
                            title="Delete"
                            className="p-1 text-slate-600 opacity-60 group-hover:opacity-100 hover:text-rose-400 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="w-full text-left space-y-1"
                        title="Click to edit"
                      >
                        <div className="text-sm font-bold text-slate-100 leading-snug hover:text-emerald-200 transition-colors">
                          {item.title}
                        </div>
                        {item.note?.trim() && (
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {item.note.trim()}
                          </p>
                        )}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
