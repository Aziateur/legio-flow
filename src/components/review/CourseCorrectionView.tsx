import React, { useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { ReviewEntry } from '../../types/schema';
import { 
  TrendingUp, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Flame, 
  Calendar, 
  FileText, 
  Plus, 
  Trash2, 
  Clock, 
  Sliders,
  Filter,
  BarChart3
} from 'lucide-react';

export const CourseCorrectionView: React.FC = () => {
  const { 
    dailyEntries, 
    gwsSessions, 
    weeklyPlans, 
    reviews, 
    saveReview, 
    deleteReview 
  } = useStorage();

  const [activeSubTab, setActiveSubTab] = useState<'insights' | 'write'>('insights');

  // New review form state
  const [reviewTitle, setReviewTitle] = useState('Week 3 Execution & Course Correction');
  const [periodType, setPeriodType] = useState<'weekly' | 'daily' | 'custom'>('weekly');
  const [startDate, setStartDate] = useState('2026-10-25');
  const [endDate, setEndDate] = useState('2026-10-28');
  const [wins, setWins] = useState('');
  const [blockers, setBlockers] = useState('');
  const [courseCorrections, setCourseCorrections] = useState('');
  const [clarityRating, setClarityRating] = useState(4);
  const [consistencyRating, setConsistencyRating] = useState(4);
  const [overallRating, setOverallRating] = useState(4);

  // Compute analytics
  const recordedDays = Object.values(dailyEntries).sort((a, b) => a.date.localeCompare(b.date));
  const avgExecutionScore = (
    recordedDays.reduce((acc, d) => acc + (d.executionScore || 0), 0) /
    Math.max(1, recordedDays.filter(d => d.executionScore > 0).length)
  ).toFixed(1);

  const avgGwsScore = (
    gwsSessions.reduce((acc, s) => acc + s.ratings.total, 0) /
    Math.max(1, gwsSessions.length)
  ).toFixed(1);

  const avgFocus = (
    gwsSessions.reduce((acc, s) => acc + s.ratings.focus, 0) /
    Math.max(1, gwsSessions.length)
  ).toFixed(1);

  const avgExecution = (
    gwsSessions.reduce((acc, s) => acc + s.ratings.execution, 0) /
    Math.max(1, gwsSessions.length)
  ).toFixed(1);

  const avgOutput = (
    gwsSessions.reduce((acc, s) => acc + s.ratings.output, 0) /
    Math.max(1, gwsSessions.length)
  ).toFixed(1);

  // Extract all blockers ("What held me back?")
  const allBlockers = gwsSessions
    .filter(s => s.reflexions.heldBack.trim().length > 0)
    .map(s => ({
      date: s.date,
      task: s.taskName,
      text: s.reflexions.heldBack
    }));

  // Extract all improvement commitments ("What will I improve next session?")
  const allImprovements = gwsSessions
    .filter(s => s.reflexions.improveNext.trim().length > 0)
    .map(s => ({
      date: s.date,
      task: s.taskName,
      text: s.reflexions.improveNext
    }));

  // Extract all accomplishments
  const allAccomplishments = gwsSessions
    .filter(s => s.reflexions.accomplished.trim().length > 0)
    .map(s => ({
      date: s.date,
      task: s.taskName,
      text: s.reflexions.accomplished
    }));

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTitle.trim()) return;

    const newRev: ReviewEntry = {
      id: `rev_${Date.now()}`,
      title: reviewTitle.trim(),
      periodType,
      startDate,
      endDate,
      wins: wins.trim(),
      blockers: blockers.trim(),
      courseCorrections: courseCorrections.trim(),
      ratings: {
        clarity: clarityRating,
        consistency: consistencyRating,
        overall: overallRating
      },
      createdAt: new Date().toISOString()
    };

    saveReview(newRev);
    alert('Course correction review saved successfully!');
    setActiveSubTab('insights');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-amber-400">
            <TrendingUp className="w-4 h-4" />
            <span>Progress & Retrospective Intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 mt-1">
            Course Correction & Review Hub
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review recorded patterns • Identify recurring friction • Calibrate upcoming trajectory
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center space-x-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => setActiveSubTab('insights')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'insights'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Review Recorded Data</span>
          </button>

          <button
            onClick={() => setActiveSubTab('write')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'write'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Write Course Correction</span>
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: INSIGHTS & REVIEWING WHAT WAS RECORDED */}
      {activeSubTab === 'insights' && (
        <div className="space-y-8">
          
          {/* Top Key Metrics Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-medium">Avg Execution Score</span>
              <div className="text-3xl font-extrabold text-amber-400 font-mono mt-1">
                {avgExecutionScore} <span className="text-xs text-slate-500">/ 10</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">From daily ratings</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-medium">Avg GWS Session</span>
              <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-1">
                {avgGwsScore} <span className="text-xs text-slate-500">/ 15</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Performance index</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-medium">GWS Score Distribution</span>
              <div className="text-sm font-bold text-slate-200 mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Focus:</span>
                  <span className="font-mono text-amber-400">{avgFocus} / 5</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Execution:</span>
                  <span className="font-mono text-amber-400">{avgExecution} / 5</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Output:</span>
                  <span className="font-mono text-amber-400">{avgOutput} / 5</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-medium">Logged Sprints</span>
              <div className="text-3xl font-extrabold text-sky-400 font-mono mt-1">
                {gwsSessions.length}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Total deep work sprints</span>
            </div>
          </div>

          {/* Execution History Timeline (Day-by-Day) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Day-by-Day Execution Trajectory</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">Recorded Days</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              {recordedDays.map((entry) => (
                <div
                  key={entry.date}
                  className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-400">{entry.date}</span>
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                      Score: {entry.executionScore}/10
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1">
                    <div>Tasks: <strong className="text-slate-200">{entry.mainTasksCompleted}/{entry.mainTasksTotal}</strong></div>
                    <div>Automatic Tasks: <strong className={entry.automaticTasksCompleted ? 'text-emerald-400' : 'text-slate-500'}>{entry.automaticTasksCompleted ? 'Yes' : 'No'}</strong></div>
                    <div>GWS: <strong className="text-slate-200">{entry.gwsSessionIds.length} sprint(s)</strong></div>
                  </div>

                  {entry.planNotes && (
                    <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 line-clamp-2">
                      {entry.planNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Deep Reflection Aggregator: Blockers vs Improvements */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left: What Held Me Back? (Friction & Bottlenecks) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                    Recurring Bottlenecks ("What held me back?")
                  </h3>
                  <p className="text-xs text-slate-400">Aggregated friction from recorded GWS sessions</p>
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {allBlockers.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    No blockers recorded yet.
                  </p>
                ) : (
                  allBlockers.map((b, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-mono text-orange-400">{b.date}</span>
                        <span className="truncate max-w-[200px]">{b.task}</span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">{b.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: What Will I Improve Next? (Actionable Commitments) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                    Corrective Commitments ("What will I improve next?")
                  </h3>
                  <p className="text-xs text-slate-400">Action items pledged in recent sessions</p>
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {allImprovements.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    No improvement commitments recorded yet.
                  </p>
                ) : (
                  allImprovements.map((imp, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-mono text-amber-400">{imp.date}</span>
                        <span className="truncate max-w-[200px]">{imp.task}</span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">{imp.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Past Course Correction Reviews List */}
          {reviews.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Saved Retrospective & Course Correction Reviews ({reviews.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-100">{rev.title}</h4>
                        <span className="text-[11px] font-mono text-amber-400">
                          {rev.startDate} → {rev.endDate}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteReview(rev.id)}
                        className="text-slate-600 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2 text-xs text-slate-300">
                      {rev.wins && (
                        <div>
                          <strong className="text-emerald-400 block mb-0.5">Wins:</strong>
                          <p>{rev.wins}</p>
                        </div>
                      )}
                      {rev.blockers && (
                        <div>
                          <strong className="text-orange-400 block mb-0.5">Blockers:</strong>
                          <p>{rev.blockers}</p>
                        </div>
                      )}
                      {rev.courseCorrections && (
                        <div>
                          <strong className="text-amber-400 block mb-0.5">Course Corrections:</strong>
                          <p>{rev.courseCorrections}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* SUB-VIEW 2: WRITE WHAT IS BEING REVIEWED & COURSE CORRECT */}
      {activeSubTab === 'write' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left 5 cols: Reference Telemetry while writing */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Telemetry Reference
              </span>
              <h3 className="text-sm font-bold text-slate-100">
                Recent Daily Execution Overview
              </h3>

              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {recordedDays.map((d) => (
                  <div key={d.date} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs space-y-1">
                    <div className="flex justify-between font-mono font-bold">
                      <span className="text-amber-400">{d.date}</span>
                      <span className="text-slate-300">Score: {d.executionScore}/10</span>
                    </div>
                    {d.planNotes && (
                      <p className="text-slate-400 text-[11px] line-clamp-2">{d.planNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 7 cols: The Course Correction Review Form */}
          <div className="lg:col-span-7">
            <form onSubmit={handleSaveReview} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              
              <div>
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Retrospective Protocol
                </span>
                <h2 className="text-xl font-extrabold text-slate-100 mt-2">
                  Write Retrospective & Course Correction
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Synthesize what you learned, isolate deviations, and set explicit corrections.
                </p>
              </div>

              {/* Title & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Review Title</label>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-sm text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* 1. Wins & Accomplishments */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  1. Wins & What Shipped
                </label>
                <textarea
                  value={wins}
                  onChange={(e) => setWins(e.target.value)}
                  placeholder="What worked exceptionally well? What deliverables were finalized?"
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-none"
                />
              </div>

              {/* 2. Bottlenecks & Friction */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-orange-400">
                  2. Bottlenecks & Breakdown Points
                </label>
                <textarea
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  placeholder="Where did discipline lapse? What held you back? What systems broke down?"
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500/50 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-none"
                />
              </div>

              {/* 3. Actionable Course Corrections */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  3. Specific Course Corrections (What changes now?)
                </label>
                <textarea
                  value={courseCorrections}
                  onChange={(e) => setCourseCorrections(e.target.value)}
                  placeholder="What needs to happen? What needs to be learned? What systems do I need now and what needs to be bought?"
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl p-4 text-xs text-slate-100 placeholder-slate-600 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Self Assessment Ratings */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 block font-medium">Clarity (1-5):</span>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        type="button"
                        key={v}
                        onClick={() => setClarityRating(v)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold ${
                          clarityRating === v ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 block font-medium">Consistency (1-5):</span>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        type="button"
                        key={v}
                        onClick={() => setConsistencyRating(v)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold ${
                          consistencyRating === v ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 block font-medium">Overall (1-5):</span>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        type="button"
                        key={v}
                        onClick={() => setOverallRating(v)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold ${
                          overallRating === v ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20 transition-all active:scale-98"
              >
                Save Course Correction Review
              </button>

            </form>
          </div>

        </div>
      )}

    </div>
  );
};
