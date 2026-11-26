import React, { useState, useEffect, useRef } from 'react';
import {
  useStorage,
  getPriorityItemsForEntry,
  formatPriorityItemsToPlanNotes,
  findBestWeeklyPlanForDate,
  computeWeeklyAchievedScore
} from '../../context/StorageContext';
import { GWSSession, ProblemCategory } from '../../types/schema';
import { getQuarterKeyForDate } from '../../lib/macroAnalytics';
import {
  STRATEGY_PRIORITY_META,
  isActiveStrategyPlan,
  resolveDailyPriorityContext,
  resolveSessionRoadmapPlanId,
  sortStrategyPlansByPriority
} from '../../lib/planHierarchy';
import { getLevelCapabilities } from '../../lib/levelFeatures';
import { ProblemLoggerPanel } from '../problems/ProblemLoggerPanel';
import { PreFlightGuardrailsStrip } from '../problems/PreFlightGuardrailsStrip';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle, 
  Flame, 
  Clock, 
  Star, 
  Trash2, 
  Search, 
  Calendar,
  Sparkles,
  Award,
  ChevronDown,
  ChevronUp,
  X,
  Crosshair,
  Compass,
  Volume2,
  VolumeX,
  Zap
} from 'lucide-react';

const playSprintBellChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [523.25, 659.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + idx * 0.22;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.58);
    });
  } catch {
    // Ignore autoplay/WebAudio restrictions
  }
};

interface GWSStudioProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const GWSStudio: React.FC<GWSStudioProps> = ({ onClose, isModal = false }) => {
  const { 
    systemLevel,
    selectedDate, 
    gwsSessions, 
    activeGwsTimer,
    updateActiveGwsTimer,
    clearActiveGwsTimer,
    addGWSSession, 
    deleteGWSSession,
    getEntryForDate,
    saveDailyEntry,
    dailyEntries,
    weeklyPlans,
    selectedWeekId,
    saveWeeklyPlan,
    getMonthlyPlan,
    getQuarterlyPlan,
    strategyPlans,
    lifePillars,
    problems,
    addProblem,
    recordProblemRecurrence
  } = useStorage();

  const caps = getLevelCapabilities(systemLevel);
  const activeStrategyPlans = sortStrategyPlansByPriority(
    strategyPlans.filter(isActiveStrategyPlan)
  );
  const currentDailyEntry = getEntryForDate(selectedDate);
  const todayPriorities = getPriorityItemsForEntry(currentDailyEntry).filter(p => p.text.trim().length > 0);
  const activeWeeklyPlan =
    findBestWeeklyPlanForDate(selectedDate, weeklyPlans, selectedWeekId) ||
    weeklyPlans[selectedWeekId];
  const activeMonthPlan = getMonthlyPlan(selectedDate.slice(0, 7));
  const activeQuarterPlan = getQuarterlyPlan(getQuarterKeyForDate(selectedDate));
  const activeFocusOptions = Array.from(
    new Set(
      [...(activeMonthPlan.topFocuses || []), ...(activeQuarterPlan.topFocuses || [])]
        .map(f => f.trim())
        .filter(Boolean)
    )
  );

  // Active session state (hydrates from persistent activeGwsTimer so tab switches/reloads never lose a sprint)
  const [taskName, setTaskName] = useState(() => activeGwsTimer?.taskName || '');
  const [linkedPriorityId, setLinkedPriorityId] = useState<string | null>(() => activeGwsTimer?.linkedPriorityId || null);
  const [linkedWeeklyTaskId, setLinkedWeeklyTaskId] = useState<string | undefined>(() => activeGwsTimer?.linkedWeeklyTaskId);
  const [linkedSubTaskId, setLinkedSubTaskId] = useState<string | undefined>(() => activeGwsTimer?.linkedSubTaskId);
  const [focusTag, setFocusTag] = useState<string>(() => activeGwsTimer?.focusTag || '');
  const [roadmapPlanId, setRoadmapPlanId] = useState<string>(() => activeGwsTimer?.roadmapPlanId || '');
  const [pillarId, setPillarId] = useState<string>(() => activeGwsTimer?.pillarId || '');
  const [completePriorityOnSave, setCompletePriorityOnSave] = useState(true);
  const [plannedMinutes, setPlannedMinutes] = useState(() => activeGwsTimer?.plannedMinutes || 50);
  const [actualMinutes, setActualMinutes] = useState(() => {
    if (!activeGwsTimer) return 0;
    const secs =
      activeGwsTimer.accumulatedSeconds +
      (activeGwsTimer.startedAt ? Math.max(0, Math.floor((Date.now() - activeGwsTimer.startedAt) / 1000)) : 0);
    return secs > 0 ? Math.max(1, Math.round(secs / 60)) : 0;
  });

  // Live sprint ergonomics (audio bell toggle, end-of-block alert fired flag, mid-sprint slip logger)
  const [chimeEnabled, setChimeEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('legio_gws_chime_v1') !== 'false';
    } catch {
      return true;
    }
  });
  const chimeFiredRef = useRef(false);
  const [quickSlipText, setQuickSlipText] = useState('');
  const [quickSlipNotice, setQuickSlipNotice] = useState<string | null>(null);

  // Wall-clock driven live timer state
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isTimerRunning = Boolean(activeGwsTimer?.startedAt);
  const timerSeconds = activeGwsTimer
    ? activeGwsTimer.accumulatedSeconds +
      (activeGwsTimer.startedAt ? Math.max(0, Math.floor((nowMs - activeGwsTimer.startedAt) / 1000)) : 0)
    : 0;

  // Ratings
  const [focus, setFocus] = useState<number>(4);
  const [execution, setExecution] = useState<number>(4);
  const [output, setOutput] = useState<number>(4);

  // Reflexions
  const [accomplished, setAccomplished] = useState('');
  const [heldBackDraft, setHeldBackDraft] = useState('');
  const [heldBackCategory, setHeldBackCategory] = useState<ProblemCategory>('mindset');
  const [heldBackTags, setHeldBackTags] = useState<string[]>([]);
  const [improveNext, setImproveNext] = useState('');

  // History filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Auto total calculation
  const totalScore = focus + execution + output; // out of 15

  // Keep wall-clock timer ticking accurately (immune to background tab throttling & navigation unmounts)
  useEffect(() => {
    if (!isTimerRunning) return;
    setNowMs(Date.now());
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Keep actualMinutes synced with persistent timer whenever timer advances or is canceled
  useEffect(() => {
    if (timerSeconds > 0) {
      setActualMinutes(Math.max(1, Math.round(timerSeconds / 60)));
    } else if (!activeGwsTimer) {
      setActualMinutes(0);
    }
  }, [timerSeconds, activeGwsTimer]);

  // Live browser tab title while sprint timer is running + end-of-block chime when hitting plannedMinutes
  const hitPlannedBlock = plannedMinutes > 0 && timerSeconds >= plannedMinutes * 60;
  useEffect(() => {
    if (!isTimerRunning) {
      document.title = 'LEGIO — Operating System';
      return;
    }
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    const clock = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.title = `${clock}${hitPlannedBlock ? ' ✓' : ''} · GWS — LEGIO`;
    return () => {
      document.title = 'LEGIO — Operating System';
    };
  }, [isTimerRunning, timerSeconds, hitPlannedBlock]);

  useEffect(() => {
    if (!hitPlannedBlock) {
      chimeFiredRef.current = false;
      return;
    }
    if (isTimerRunning && chimeEnabled && !chimeFiredRef.current) {
      chimeFiredRef.current = true;
      playSprintBellChime();
    }
  }, [hitPlannedBlock, isTimerRunning, chimeEnabled]);

  const toggleChime = () => {
    const next = !chimeEnabled;
    setChimeEnabled(next);
    try {
      localStorage.setItem('legio_gws_chime_v1', String(next));
    } catch {
      // ignore
    }
  };

  const handleLogMidSprintSlip = () => {
    const trimmed = quickSlipText.trim();
    if (!trimmed) return;
    const existing = problems.find(p => p.title.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      recordProblemRecurrence(existing.id, {
        date: selectedDate,
        sourceType: 'gws',
        sourceRef: taskName.trim() || 'Live GWS Sprint'
      });
    } else {
      const autoTags: string[] = [];
      if (roadmapPlanId) {
        const sp = strategyPlans.find(p => p.id === roadmapPlanId);
        if (sp) autoTags.push(sp.title);
      }
      addProblem({
        title: trimmed,
        category: heldBackCategory,
        scale: 'friction',
        ...(roadmapPlanId ? { roadmapPlanId } : {}),
        tags: autoTags,
        sourceType: 'gws',
        date: selectedDate,
        sourceRef: taskName.trim() || 'Live GWS Sprint'
      });
    }
    setQuickSlipText('');
    setQuickSlipNotice(`Caught slip → Problem Inbox`);
    setTimeout(() => setQuickSlipNotice(null), 2200);
  };

  // Sync task/priority/plannedMinutes/strategic tags into active persistent timer if one is active
  useEffect(() => {
    if (!activeGwsTimer) return;
    if (
      activeGwsTimer.taskName !== taskName ||
      activeGwsTimer.linkedPriorityId !== linkedPriorityId ||
      activeGwsTimer.linkedWeeklyTaskId !== linkedWeeklyTaskId ||
      activeGwsTimer.linkedSubTaskId !== linkedSubTaskId ||
      activeGwsTimer.plannedMinutes !== plannedMinutes ||
      (activeGwsTimer.focusTag || '') !== focusTag ||
      (activeGwsTimer.roadmapPlanId || '') !== roadmapPlanId ||
      (activeGwsTimer.pillarId || '') !== pillarId
    ) {
      updateActiveGwsTimer(prev =>
        prev
          ? {
              ...prev,
              taskName,
              linkedPriorityId,
              linkedWeeklyTaskId,
              linkedSubTaskId,
              plannedMinutes,
              focusTag: focusTag || undefined,
              roadmapPlanId: roadmapPlanId || undefined,
              pillarId: pillarId || undefined
            }
          : prev
      );
    }
  }, [taskName, linkedPriorityId, linkedWeeklyTaskId, linkedSubTaskId, plannedMinutes, focusTag, roadmapPlanId, pillarId]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleStartTimer = () => {
    const startTs = Date.now();
    setNowMs(startTs);
    updateActiveGwsTimer(prev => ({
      taskName,
      linkedPriorityId,
      linkedWeeklyTaskId,
      linkedSubTaskId,
      plannedMinutes,
      focusTag: focusTag || undefined,
      roadmapPlanId: roadmapPlanId || undefined,
      pillarId: pillarId || undefined,
      startedAt: startTs,
      accumulatedSeconds: prev?.accumulatedSeconds || 0
    }));
  };

  const handlePauseTimer = () => {
    const pauseTs = Date.now();
    setNowMs(pauseTs);
    updateActiveGwsTimer(prev => {
      if (!prev) return null;
      const added = prev.startedAt ? Math.max(0, Math.floor((pauseTs - prev.startedAt) / 1000)) : 0;
      return {
        ...prev,
        taskName,
        linkedPriorityId,
        linkedWeeklyTaskId,
        linkedSubTaskId,
        plannedMinutes,
        focusTag: focusTag || undefined,
        roadmapPlanId: roadmapPlanId || undefined,
        pillarId: pillarId || undefined,
        startedAt: null,
        accumulatedSeconds: prev.accumulatedSeconds + added
      };
    });
  };

  const handleResetTimer = () => {
    clearActiveGwsTimer();
    chimeFiredRef.current = false;
    setActualMinutes(0);
  };

  const handleCancelSprint = () => {
    clearActiveGwsTimer();
    chimeFiredRef.current = false;
    setActualMinutes(0);
    setTaskName('');
    setLinkedPriorityId(null);
    setLinkedWeeklyTaskId(undefined);
    setLinkedSubTaskId(undefined);
    setFocusTag('');
    setRoadmapPlanId('');
    setPillarId('');
  };

  const getScoreBadge = (score: number) => {
    if (score >= 14) {
      return { label: 'Elite Execution', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    }
    if (score >= 11) {
      return { label: 'Strong Sprint', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    }
    if (score >= 8) {
      return { label: 'Moderate / Friction', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
    }
    return { label: 'Calibration Needed', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' };
  };

  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) {
      alert('Please enter a Task Name for this GWS session.');
      return;
    }

    const sessionActual = actualMinutes > 0 ? actualMinutes : (plannedMinutes || 45);
    const trimmedDraft = heldBackDraft.trim();

    if (trimmedDraft) {
      const existing = problems.find(
        p => p.title.trim().toLowerCase() === trimmedDraft.toLowerCase()
      );
      if (existing) {
        recordProblemRecurrence(existing.id, {
          date: selectedDate,
          sourceType: 'gws',
          sourceRef: taskName.trim()
        });
      } else {
        addProblem({
          title: trimmedDraft,
          category: heldBackCategory,
          classified: false,
          scale: 'friction',
          severity: 2,
          ...(roadmapPlanId ? { roadmapPlanId } : {}),
          tags: heldBackTags,
          sourceType: 'gws',
          date: selectedDate,
          sourceRef: taskName.trim()
        });
      }
    }

    addGWSSession({
      date: selectedDate,
      taskName: taskName.trim(),
      plannedMinutes,
      actualMinutes: sessionActual,
      ...(focusTag.trim() ? { focusTag: focusTag.trim() } : {}),
      ...(roadmapPlanId ? { roadmapPlanId } : {}),
      ...(pillarId ? { pillarId } : {}),
      ...(linkedWeeklyTaskId ? { linkedWeeklyTaskId } : {}),
      ...(linkedSubTaskId ? { linkedSubTaskId } : {}),
      ratings: {
        focus,
        execution,
        output,
        total: totalScore
      },
      reflexions: {
        accomplished: accomplished.trim(),
        heldBack: trimmedDraft,
        improveNext: improveNext.trim()
      }
    });

    // If linked to a Daily Priority and user checked "Mark priority completed", mark it Done & sync weekly goals!
    if (linkedPriorityId && completePriorityOnSave) {
      const targetPrio = todayPriorities.find(p => p.id === linkedPriorityId);
      const updatedItems = getPriorityItemsForEntry(currentDailyEntry).map(item =>
        item.id === linkedPriorityId ? { ...item, completed: true } : item
      );
      saveDailyEntry(selectedDate, {
        planNotes: formatPriorityItemsToPlanNotes(updatedItems),
        priorityItems: updatedItems,
        mainTasksCompleted: updatedItems.filter(i => i.completed).length,
        mainTasksTotal: Math.max(3, updatedItems.length)
      });

      if (targetPrio && activeWeeklyPlan && activeWeeklyPlan.tasks.length > 0) {
        let matched = false;
        const normalizedText = targetPrio.text.toLowerCase().trim();
        const updatedTasks = activeWeeklyPlan.tasks.map(t => {
          let nextTask = t;
          if (
            (targetPrio.weeklyTaskId && !targetPrio.subTaskId && t.id === targetPrio.weeklyTaskId) ||
            (!targetPrio.weeklyTaskId && t.text.toLowerCase().trim() === normalizedText)
          ) {
            matched = true;
            nextTask = { ...nextTask, completed: true };
          }
          if (t.subTasks && t.subTasks.length > 0) {
            let subMatched = false;
            const updatedSubs = t.subTasks.map(sub => {
              if (
                (targetPrio.subTaskId && sub.id === targetPrio.subTaskId) ||
                (!targetPrio.subTaskId && sub.text.toLowerCase().trim() === normalizedText)
              ) {
                matched = true;
                subMatched = true;
                return { ...sub, completed: true };
              }
              return sub;
            });
            if (subMatched) {
              nextTask = {
                ...nextTask,
                subTasks: updatedSubs,
                completed: updatedSubs.every(s => s.completed)
              };
            }
          }
          return nextTask;
        });

        if (matched) {
          saveWeeklyPlan({
            ...activeWeeklyPlan,
            tasks: updatedTasks,
            achievedScore: computeWeeklyAchievedScore(updatedTasks)
          });
        }
      }
    }

    // Reset form
    setTaskName('');
    setLinkedPriorityId(null);
    setLinkedWeeklyTaskId(undefined);
    setLinkedSubTaskId(undefined);
    setFocusTag('');
    setRoadmapPlanId('');
    setPillarId('');
    handleResetTimer();
    setAccomplished('');
    setHeldBackDraft('');
    setHeldBackTags([]);
    setImproveNext('');

    if (isModal && onClose) {
      onClose();
    }
  };

  // Filtered session history
  const filteredSessions = gwsSessions.filter(s => 
    s.taskName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.reflexions.accomplished.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.reflexions.heldBack.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.date.includes(searchQuery)
  );

  return (
    <div className={`space-y-8 ${isModal ? 'p-2' : 'w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
      
      {/* Header */}
      {!isModal && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-amber-400">
              <Clock className="w-4 h-4" />
              <span>Deep Work Protocol</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 mt-1">
              GWS (Goal Work Session) Studio
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Time: Planned vs. Actual • Focus, Execution & Output (/15) • Actionable Reflexions
            </p>
          </div>

          <div className="flex items-center space-x-4 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-2xl">
            <div className="text-right">
              <div className="text-xs text-slate-400">Target Session Date</div>
              <div className="text-sm font-bold text-amber-400 font-mono">{selectedDate}</div>
            </div>
            <Calendar className="w-5 h-5 text-slate-500" />
          </div>
        </div>
      )}

      {/* Pre-Flight Guardrails & Top Constraints (prevention before starting a deep sprint) */}
      <PreFlightGuardrailsStrip
        context="gws"
        date={selectedDate}
        sourceRef={taskName.trim() || 'GWS Sprint'}
      />

      {/* Main Grid: Live Session Form (Left) + Recent Log/Stats (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Interactive GWS Form */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSaveSession} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            {/* Subtle top accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center space-x-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Live GWS Cockpit</span>
              </span>

              {/* Total score pill */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium">Session Score:</span>
                <span className="text-lg font-extrabold text-amber-400 font-mono">{totalScore} <span className="text-xs text-slate-500">/ 15</span></span>
              </div>
            </div>

            {/* Task input + Quick Link to Today's Daily Priorities */}
            <div className="space-y-2.5 mb-6">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Task Description:
                </label>
                {todayPriorities.length > 0 && (
                  <span className="text-[11px] text-amber-400 font-semibold">
                    Click a priority below to lock in sprint target:
                  </span>
                )}
              </div>

              {todayPriorities.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {todayPriorities.map((prio, idx) => {
                    const isSelectedPrio = linkedPriorityId === prio.id;
                    return (
                      <button
                        key={prio.id}
                        type="button"
                        onClick={() => {
                          setTaskName(prio.text);
                          const nextId = isSelectedPrio ? null : prio.id;
                          setLinkedPriorityId(nextId);
                          if (nextId) {
                            setLinkedWeeklyTaskId(prio.weeklyTaskId);
                            setLinkedSubTaskId(prio.subTaskId);
                            const ctx = resolveDailyPriorityContext(
                              prio,
                              weeklyPlans,
                              strategyPlans,
                              activeWeeklyPlan?.id
                            );
                            if (ctx.roadmapPlan) {
                              setRoadmapPlanId(ctx.roadmapPlan.id);
                            }
                          } else {
                            setLinkedWeeklyTaskId(undefined);
                            setLinkedSubTaskId(undefined);
                          }
                        }}
                        className={`text-xs px-2.5 py-1.5 rounded-xl border transition-all flex items-center space-x-1.5 ${
                          isSelectedPrio
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
                            : prio.completed
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 line-through'
                            : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                        }`}
                      >
                        <span className="font-mono font-extrabold">#{idx + 1}</span>
                        <span className="truncate max-w-[220px]">{prio.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g. Finish Discord onboarding test run & verify commitment"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
                required
              />

              {linkedPriorityId && (
                <label className="flex items-center space-x-2 text-xs text-emerald-400 pt-0.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={completePriorityOnSave}
                    onChange={(e) => setCompletePriorityOnSave(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Mark linked Daily Priority as Completed when saving this GWS sprint</span>
                </label>
              )}

              {/* Strategic Alignment Tag (LVL 4+: powers Stated Priorities vs. Actual Hours in Reviews) */}
              {caps.gwsFocusAndRoadmapTagging &&
                (activeFocusOptions.length > 0 || activeStrategyPlans.length > 0 || lifePillars.length > 0) && (
                <div className="pt-2 space-y-2">
                  {activeFocusOptions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold uppercase tracking-wider text-purple-400 mr-1">
                        <Crosshair className="w-3 h-3" />
                        <span>Top Focus:</span>
                      </span>
                      {activeFocusOptions.map((f, idx) => {
                        const active = focusTag === f;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setFocusTag(active ? '' : f)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all ${
                              active
                                ? 'bg-purple-500 text-slate-950 border-purple-400 font-bold shadow-sm'
                                : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                            }`}
                          >
                            {f}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {(activeStrategyPlans.length > 0 || lifePillars.length > 0) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {activeStrategyPlans.length > 0 && (
                        <div className="flex items-center space-x-1.5">
                          <Compass className="w-3 h-3 text-cyan-400 shrink-0" />
                          <select
                            value={roadmapPlanId}
                            onChange={e => setRoadmapPlanId(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] font-semibold text-cyan-300 focus:outline-none focus:border-cyan-500/40"
                          >
                            <option value="">Roadmap (optional)...</option>
                            {activeStrategyPlans.map(sp => (
                              <option key={sp.id} value={sp.id}>
                                {sp.priority ? `[${STRATEGY_PRIORITY_META[sp.priority].code}] ` : ''}
                                {sp.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {lifePillars.length > 0 && (
                        <select
                          value={pillarId}
                          onChange={e => setPillarId(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] font-semibold text-emerald-300 focus:outline-none focus:border-emerald-500/40"
                        >
                          <option value="">Life Pillar (optional)...</option>
                          {lifePillars.map(lp => (
                            <option key={lp.id} value={lp.id}>
                              {lp.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Time: Planned vs Actual + Live Stopwatch */}
            <div className="mb-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Planned Minutes */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                  <span>Planned Duration:</span>
                  <span className="font-mono text-amber-400 font-bold">{plannedMinutes} min</span>
                </label>
                <div className="flex items-center space-x-1.5">
                  {[25, 45, 50, 60, 90].map(mins => (
                    <button
                      type="button"
                      key={mins}
                      onClick={() => setPlannedMinutes(mins)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        plannedMinutes === mins
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Actual Minutes / Live Timer */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <span>Actual Time Spent:</span>
                    {hitPlannedBlock && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 text-[10px] font-bold">
                        ✓ {plannedMinutes}m hit
                      </span>
                    )}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-mono text-slate-100 font-bold">{formatTimer(timerSeconds)} ({actualMinutes}m)</span>
                    <button
                      type="button"
                      onClick={toggleChime}
                      title={chimeEnabled ? 'End-of-block bell ON (click to mute)' : 'End-of-block bell muted (click to enable)'}
                      className="p-1 rounded-md text-slate-400 hover:text-amber-300 transition-colors"
                    >
                      {chimeEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-slate-600" />}
                    </button>
                  </div>
                </label>
                
                <div className="flex items-center space-x-2">
                  {!isTimerRunning ? (
                    <button
                      type="button"
                      onClick={handleStartTimer}
                      className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{timerSeconds > 0 ? 'Resume' : 'Start Timer'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePauseTimer}
                      className="flex-1 flex items-center justify-center space-x-1 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-xs font-bold transition-colors"
                    >
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause</span>
                    </button>
                  )}
                  {(isTimerRunning || timerSeconds > 0) ? (
                    <button
                      type="button"
                      onClick={handleCancelSprint}
                      title="Cancel & discard this GWS sprint"
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/35 text-xs font-bold transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResetTimer}
                      title="Reset Stopwatch"
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              </div>

              {/* 1-Tap Mid-Sprint Slip Catcher (logs straight to Problem Inbox without breaking flow) */}
              {(isTimerRunning || timerSeconds > 0) && (
                <div className="pt-2.5 border-t border-slate-800/80 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <input
                    type="text"
                    value={quickSlipText}
                    onChange={e => setQuickSlipText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLogMidSprintSlip();
                      }
                    }}
                    placeholder="Distraction or friction mid-sprint? Type & press Enter → logs to Problem Inbox..."
                    className="flex-1 bg-slate-900/90 border border-slate-800 focus:border-orange-500/50 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={!quickSlipText.trim()}
                    onClick={handleLogMidSprintSlip}
                    className="px-2.5 py-1.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 disabled:opacity-40 text-orange-300 border border-orange-500/30 text-[11px] font-bold shrink-0"
                  >
                    + Slip
                  </button>
                  {quickSlipNotice && (
                    <span className="text-[11px] font-bold text-emerald-400 shrink-0">{quickSlipNotice}</span>
                  )}
                </div>
              )}
            </div>

            {/* Performance Ratings (1-5): Focus, Execution, Output */}
            <div className="space-y-4 mb-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Performance (1–5):
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getScoreBadge(totalScore).color}`}>
                  {getScoreBadge(totalScore).label}
                </span>
              </div>

              {/* Focus (1-5) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">Focus:</span>
                  <span className="font-mono font-bold text-amber-400">{focus} / 5</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setFocus(val)}
                      className={`py-2 rounded-lg text-xs font-bold transition-all ${
                        focus === val
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Execution (1-5) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">Execution:</span>
                  <span className="font-mono font-bold text-amber-400">{execution} / 5</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setExecution(val)}
                      className={`py-2 rounded-lg text-xs font-bold transition-all ${
                        execution === val
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Output (1-5) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">Output:</span>
                  <span className="font-mono font-bold text-amber-400">{output} / 5</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setOutput(val)}
                      className={`py-2 rounded-lg text-xs font-bold transition-all ${
                        output === val
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total Display */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Performance:</span>
                <span className="text-base font-extrabold font-mono text-slate-100">
                  <strong className="text-amber-400">{totalScore}</strong> / 15
                </span>
              </div>
            </div>

            {/* Reflexions: 3 questions */}
            <div className="space-y-4 mb-6">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Reflexions:</span>
              </div>

              {/* 1. What did I accomplish? */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-400">
                  1. What did I accomplish?
                </label>
                <textarea
                  value={accomplished}
                  onChange={(e) => setAccomplished(e.target.value)}
                  placeholder="Concrete milestones, decisions, or code shipped..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-none transition-colors"
                />
              </div>

              {/* 2. What held me back? (Structured Problem Logger) */}
              <ProblemLoggerPanel
                mode="compact"
                title="2. What held me back? (Log Problem)"
                sourceType="gws"
                date={selectedDate}
                sourceRef={taskName.trim() || 'GWS Sprint'}
                roadmapPlanId={roadmapPlanId || undefined}
                targetWeekId={selectedWeekId}
                draftText={heldBackDraft}
                onDraftTextChange={setHeldBackDraft}
                draftCategory={heldBackCategory}
                onDraftCategoryChange={setHeldBackCategory}
                draftTags={heldBackTags}
                onDraftTagsChange={setHeldBackTags}
              />

              {/* 3. What will I improve next session? */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-400">
                  3. What will I improve next session?
                </label>
                <textarea
                  value={improveNext}
                  onChange={(e) => setImproveNext(e.target.value)}
                  placeholder="Single sharp actionable correction for the next sprint..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-none transition-colors"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center space-x-3">
              <button
                type="submit"
                className="flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
              >
                <CheckCircle className="w-4 h-4 fill-current" />
                <span>Save & Record GWS Session</span>
              </button>
              {isModal && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
              )}
            </div>

          </form>
        </div>

        {/* Right Column: GWS History & Performance Metrics */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Quick Metrics Header */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-xs text-slate-400 font-medium">Total Sprints Logged</div>
              <div className="text-2xl font-extrabold text-slate-100 font-mono mt-1">
                {gwsSessions.length}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-xs text-slate-400 font-medium">Avg Score</div>
              <div className="text-2xl font-extrabold text-amber-400 font-mono mt-1">
                {gwsSessions.length > 0 
                  ? (gwsSessions.reduce((acc, s) => acc + s.ratings.total, 0) / gwsSessions.length).toFixed(1) 
                  : '0'} <span className="text-xs text-slate-500">/ 15</span>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search session tasks, reflexions, or date..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/40"
            />
          </div>

          {/* Session Cards List */}
          <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Recorded Sessions ({filteredSessions.length})
            </h3>

            {filteredSessions.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
                No GWS sessions found. Start a sprint above to record!
              </div>
            ) : (
              filteredSessions.map((session) => {
                const isExpanded = expandedSessionId === session.id;
                const badge = getScoreBadge(session.ratings.total);

                return (
                  <div
                    key={session.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 cursor-pointer" onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-mono text-amber-400 font-semibold">{session.date}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {session.actualMinutes || session.plannedMinutes}m
                          </span>
                          {session.focusTag && (
                            <span className="px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                              {session.focusTag}
                            </span>
                          )}
                          {(() => {
                            const resolvedRmId = resolveSessionRoadmapPlanId(session, weeklyPlans, dailyEntries);
                            const resolvedRm = resolvedRmId
                              ? strategyPlans.find(sp => sp.id === resolvedRmId)
                              : undefined;
                            if (!resolvedRm) return null;
                            return (
                              <span
                                className="px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold"
                                title={session.roadmapPlanId ? 'Tagged Roadmap' : 'Inherited from linked Weekly Goal'}
                              >
                                {resolvedRm.title}
                              </span>
                            );
                          })()}
                          {session.pillarId &&
                            lifePillars.find(lp => lp.id === session.pillarId) && (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                {lifePillars.find(lp => lp.id === session.pillarId)?.name}
                              </span>
                            )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-100 mt-1 hover:text-amber-400 transition-colors">
                          {session.taskName}
                        </h4>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                          {session.ratings.total}/15
                        </span>
                        <button
                          onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                          className="p-1 text-slate-400 hover:text-slate-200"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete GWS session: "${session.taskName}"?`)) {
                              deleteGWSSession(session.id);
                            }
                          }}
                          className="p-1 text-slate-600 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Breakdown metrics */}
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Focus: <strong className="text-slate-200">{session.ratings.focus}/5</strong></span>
                      <span>Execution: <strong className="text-slate-200">{session.ratings.execution}/5</strong></span>
                      <span>Output: <strong className="text-slate-200">{session.ratings.output}/5</strong></span>
                    </div>

                    {/* Expanded reflexions */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                        {session.reflexions.accomplished && (
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                            <span className="font-semibold text-emerald-400 block mb-0.5">1. Accomplished:</span>
                            <p className="text-slate-300">{session.reflexions.accomplished}</p>
                          </div>
                        )}
                        {session.reflexions.heldBack && (
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                            <span className="font-semibold text-orange-400 block mb-0.5">2. Held Back:</span>
                            <p className="text-slate-300">{session.reflexions.heldBack}</p>
                          </div>
                        )}
                        {session.reflexions.improveNext && (
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                            <span className="font-semibold text-amber-400 block mb-0.5">3. Improve Next:</span>
                            <p className="text-slate-300">{session.reflexions.improveNext}</p>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })
            )}

          </div>

        </div>

      </div>

    </div>
  );
};
