import React, { useMemo, useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import {
  SEVERITY_VISUAL,
  getProblemActionText,
  getProblemReminderText,
  getProblemSeverity,
  hasActiveReminder,
  hasExistingParent,
  shouldPromptNoteOnHit
} from '../../lib/problems';
import { ProblemSourceType } from '../../types/schema';
import { getLevelCapabilities } from '../../lib/levelFeatures';
import { Bell, Check, ChevronDown, ChevronUp, Crosshair, ExternalLink, Wrench } from 'lucide-react';

interface PreFlightGuardrailsStripProps {
  context: 'daily' | 'gws' | 'weekly';
  date: string;
  sourceRef?: string;
}

// Reminder-first strip: leads with the cue/rule itself ("When X → do Y"), not the problem title.
export const PreFlightGuardrailsStrip: React.FC<PreFlightGuardrailsStripProps> = ({
  context,
  date,
  sourceRef
}) => {
  const {
    systemLevel,
    problems,
    problemSettings,
    recordProblemRecurrence,
    recordProblemHeld,
    setActiveTab,
    setReviewSubTab
  } = useStorage();

  const caps = getLevelCapabilities(systemLevel);

  const storageKey = `legio_reminders_open_${context}_v2`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) !== 'false';
    } catch {
      return true;
    }
  });
  const [loggedId, setLoggedId] = useState<string | null>(null);
  const [noteTargetId, setNoteTargetId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const enabled =
    caps.problemsConstraintEngine &&
    (context === 'daily'
      ? problemSettings.showPreFlightInDaily !== false
      : context === 'gws'
      ? problemSettings.showPreFlightInGws !== false
      : problemSettings.showPreFlightInWeekly !== false);

  const activeItems = useMemo(() => {
    const topLevel = problems.filter(
      p => p.status !== 'solved' && !hasExistingParent(problems, p)
    );
    return topLevel
      .filter(p => hasActiveReminder(p))
      .sort((a, b) => {
        if (Boolean(b.isTopConstraint) !== Boolean(a.isTopConstraint)) {
          return b.isTopConstraint ? 1 : -1;
        }
        return getProblemSeverity(b) - getProblemSeverity(a);
      });
  }, [problems]);

  if (!enabled || activeItems.length === 0) return null;

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {
      // ignore
    }
  };

  const src: ProblemSourceType =
    context === 'gws' ? 'gws' : context === 'weekly' ? 'weekly' : 'daily';

  const commitFired = (id: string, note?: string) => {
    recordProblemRecurrence(id, {
      date,
      sourceType: src,
      ...(sourceRef ? { sourceRef } : {}),
      ...(note?.trim() ? { note: note.trim() } : {})
    });
    setNoteTargetId(null);
    setNoteDraft('');
    setLoggedId(id);
    setTimeout(() => setLoggedId(null), 1500);
  };

  const handleFired = (id: string) => {
    const prob = problems.find(p => p.id === id);
    if (prob && shouldPromptNoteOnHit(prob)) {
      setNoteTargetId(noteTargetId === id ? null : id);
      setNoteDraft('');
    } else {
      commitFired(id);
    }
  };

  const headline =
    context === 'gws'
      ? 'Before you start this sprint'
      : context === 'weekly'
      ? 'Reminders for this week'
      : 'Reminders for today';

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-amber-500/30 overflow-hidden shadow-md">
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-900 transition-colors"
      >
        <div className="flex items-center space-x-2 min-w-0">
          <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 truncate">
            {headline} ({activeItems.length})
          </span>
          {!open && activeItems[0] && (
            <span className="hidden md:inline text-[11px] text-slate-300 truncate max-w-md">
              · {getProblemReminderText(activeItems[0])}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2 shrink-0 text-[11px] text-slate-400">
          <span className="hidden sm:inline">{open ? 'Hide' : 'Show'}</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3.5 pt-2 border-t border-slate-800/80 space-y-2">
          {activeItems.map(item => {
            const sevVis = SEVERITY_VISUAL[getProblemSeverity(item)];
            const reminder = getProblemReminderText(item);
            const action = getProblemActionText(item);
            const heldOnDate = (item.heldDates || []).includes(date);
            return (
              <div
                key={item.id}
                className={`space-y-2 p-3 rounded-xl bg-slate-950 border border-slate-800/90 ${sevVis.leftBarClass}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-bold text-amber-100 leading-snug">
                      {item.trigger?.trim() && (
                        <span className="text-slate-400 font-semibold mr-1">
                          When {item.trigger.trim()} →
                        </span>
                      )}
                      {reminder}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                      {item.isTopConstraint && (
                        <span className="inline-flex items-center space-x-1 text-rose-300 font-bold">
                          <Crosshair className="w-3 h-3" />
                          <span>Top focus</span>
                        </span>
                      )}
                      <span>For: {item.title}</span>
                      {action && (
                        <span className="inline-flex items-center space-x-1 text-sky-300">
                          <Wrench className="w-3 h-3" />
                          <span className="truncate max-w-[220px]">{action}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-start shrink-0">
                    <button
                      type="button"
                      onClick={() => handleFired(item.id)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                        loggedId === item.id
                          ? 'bg-orange-500 text-slate-950 border-orange-400'
                          : 'bg-slate-900 hover:bg-orange-500/15 text-orange-300 border-slate-800 hover:border-orange-500/40'
                      }`}
                    >
                      {loggedId === item.id ? 'Logged ✓' : 'Happened anyway'}
                    </button>
                    <button
                      type="button"
                      onClick={() => recordProblemHeld(item.id, date)}
                      className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                        heldOnDate
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-900 hover:bg-emerald-500/15 text-emerald-300 border-slate-800 hover:border-emerald-500/35'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      <span>{heldOnDate ? 'Held ✓' : 'Held'}</span>
                    </button>
                  </div>
                </div>

                {noteTargetId === item.id && (
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 border-t border-slate-800/80">
                    <input
                      type="text"
                      autoFocus
                      value={noteDraft}
                      onChange={e => setNoteDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitFired(item.id, noteDraft);
                        }
                        if (e.key === 'Escape') {
                          setNoteTargetId(null);
                          setNoteDraft('');
                        }
                      }}
                      placeholder="What happened this time? (Enter)..."
                      className="flex-1 min-w-[180px] bg-slate-900 border border-sky-500/40 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => commitFired(item.id, noteDraft)}
                      className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs shrink-0"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => commitFired(item.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-slate-400 border border-slate-800 text-xs font-bold shrink-0"
                    >
                      Skip note
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('review');
                setReviewSubTab('problems');
              }}
              className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-400 hover:text-amber-300"
            >
              <span>Manage in Problem Log</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
