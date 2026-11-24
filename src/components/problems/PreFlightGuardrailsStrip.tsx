import React, { useMemo, useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import {
  IMPACT_META,
  getProblemImpact,
  hasExistingParent,
  isProblemGuardrail
} from '../../lib/problems';
import { ProblemSourceType } from '../../types/schema';
import { getLevelCapabilities } from '../../lib/levelFeatures';
import { ChevronDown, ChevronUp, Shield, Crosshair, ExternalLink } from 'lucide-react';

interface PreFlightGuardrailsStripProps {
  context: 'daily' | 'gws';
  date: string;
  sourceRef?: string;
}

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
    setActiveTab,
    setReviewSubTab
  } = useStorage();

  const caps = getLevelCapabilities(systemLevel);

  const storageKey = `legio_preflight_open_${context}_v1`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });
  const [loggedId, setLoggedId] = useState<string | null>(null);

  const enabled =
    caps.problemsConstraintEngine &&
    (context === 'daily'
      ? problemSettings.showPreFlightInDaily !== false
      : problemSettings.showPreFlightInGws !== false);

  const activeItems = useMemo(() => {
    const topLevel = problems.filter(
      p => p.status !== 'solved' && !hasExistingParent(problems, p)
    );
    const items = topLevel.filter(
      p => isProblemGuardrail(p) || Boolean(p.isTopConstraint)
    );
    return items.sort((a, b) => {
      if (Boolean(b.isTopConstraint) !== Boolean(a.isTopConstraint)) {
        return b.isTopConstraint ? 1 : -1;
      }
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
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

  const handleBroke = (id: string) => {
    const src: ProblemSourceType = context === 'gws' ? 'gws' : 'daily';
    recordProblemRecurrence(id, {
      date,
      sourceType: src,
      ...(sourceRef ? { sourceRef } : {})
    });
    setLoggedId(id);
    setTimeout(() => setLoggedId(null), 1500);
  };

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-amber-500/25 overflow-hidden shadow-md">
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-900 transition-colors"
      >
        <div className="flex items-center space-x-2 min-w-0">
          <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 truncate">
            Pre-Flight Guardrails &amp; Top Constraints ({activeItems.length})
          </span>
          {!open && activeItems[0] && (
            <span className="hidden md:inline text-[11px] text-slate-400 truncate max-w-md">
              · {activeItems[0].fixNote?.trim() || activeItems[0].title}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2 shrink-0 text-[11px] text-slate-400">
          <span className="hidden sm:inline">{open ? 'Hide' : 'Review before acting'}</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3.5 pt-2 border-t border-slate-800/80 space-y-2">
          {activeItems.map(item => {
            const imp = IMPACT_META[getProblemImpact(item)];
            const isGuardrail = isProblemGuardrail(item);
            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center space-x-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${imp.dotClass}`} />
                    {item.isTopConstraint && (
                      <Crosshair className="w-3 h-3 text-rose-400 shrink-0" />
                    )}
                    {isGuardrail && <Shield className="w-3 h-3 text-amber-400 shrink-0" />}
                    <span className="font-bold text-slate-100 truncate">{item.title}</span>
                  </div>
                  {(item.trigger?.trim() || item.fixNote?.trim()) && (
                    <p className="text-[11px] text-slate-300 pl-3.5 leading-snug">
                      {item.trigger?.trim() && (
                        <span className="text-slate-400">
                          <strong className="text-amber-400/90">IF</strong> {item.trigger.trim()}{' '}
                          <strong className="text-emerald-400">→</strong>{' '}
                        </span>
                      )}
                      <span>{item.fixNote?.trim() || 'Stay alert to this constraint'}</span>
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleBroke(item.id)}
                  className={`self-end sm:self-center shrink-0 px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all ${
                    loggedId === item.id
                      ? 'bg-orange-500 text-slate-950 border-orange-400'
                      : 'bg-slate-900 hover:bg-orange-500/15 text-orange-300 border-slate-800 hover:border-orange-500/40'
                  }`}
                  title="Log that this problem fired again (+1)"
                >
                  {loggedId === item.id ? 'Logged!' : '+1 Fired'}
                </button>
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
