import React, { useState } from 'react';
import { Copy, Check, ArrowDownToLine, Sparkles, Send } from 'lucide-react';
import { DailyEntry, GWSSession } from '../../types/schema';

interface QuickCopyPasteBarProps {
  currentEntry: DailyEntry;
  gwsSessions: GWSSession[];
  onApplyParsedPlan: (tasksText: string) => void;
}

export const QuickCopyPasteBar: React.FC<QuickCopyPasteBarProps> = ({
  currentEntry,
  gwsSessions,
  onApplyParsedPlan
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [pasteInputOpen, setPasteInputOpen] = useState(false);
  const [pastedRawText, setPastedRawText] = useState('');

  // 1a. Copy ONLY the Daily Plan & Priorities for Discord / Notion
  const handleCopyPlanOnly = () => {
    let text = `📋 **Legio Flow — Daily Plan (${currentEntry.date})**\n\n`;
    if (currentEntry.planNotes && currentEntry.planNotes.trim()) {
      text += `${currentEntry.planNotes.trim()}\n`;
    } else {
      text += `_No priorities logged yet for ${currentEntry.date}._\n`;
    }
    text += `\n🎯 **Target Tasks:** ${currentEntry.mainTasksTotal}`;

    navigator.clipboard.writeText(text);
    setCopiedType('plan');
    setTimeout(() => setCopiedType(null), 2500);
  };

  // 1b. Copy ONLY the Daily Review & Telemetry for Discord / Notion
  const handleCopyReviewOnly = () => {
    const todaySessions = gwsSessions.filter(s => s.date === currentEntry.date);

    let text = `🔍 **Legio Flow — Daily Review (${currentEntry.date})**\n\n`;
    text += `🎯 **Main Tasks Completed:** ${currentEntry.mainTasksCompleted}/${currentEntry.mainTasksTotal}\n`;
    text += `⚡ **Execution Score:** ${currentEntry.executionScore > 0 ? `${currentEntry.executionScore}/10` : 'Unscored'}\n`;
    text += `🔁 **Automatic Habits:** ${currentEntry.automaticTasksCompleted ? '✅ Complete (Locked In)' : '❌ Pending'}\n`;

    if (todaySessions.length > 0) {
      text += `\n⏱️ **GWS Deep Work (${todaySessions.length} session${todaySessions.length > 1 ? 's' : ''}):**\n`;
      todaySessions.forEach((s) => {
        text += `• ${s.taskName} (${s.actualMinutes}m) — Score: ${s.ratings.total}/15\n`;
        if (s.reflexions.accomplished) text += `  └ Done: ${s.reflexions.accomplished}\n`;
        if (s.reflexions.heldBack) text += `  └ Blockers: ${s.reflexions.heldBack}\n`;
        if (s.reflexions.improveNext) text += `  └ Next Calibration: ${s.reflexions.improveNext}\n`;
      });
    }

    if (currentEntry.reviewNotes && currentEntry.reviewNotes.trim()) {
      text += `\n📝 **Daily Reflexion & Course Correction:**\n${currentEntry.reviewNotes.trim()}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopiedType('review');
    setTimeout(() => setCopiedType(null), 2500);
  };

  // 2. Copy Raw JSON for instant backup
  const handleCopyJSON = () => {
    const data = JSON.stringify(currentEntry, null, 2);
    navigator.clipboard.writeText(data);
    setCopiedType('json');
    setTimeout(() => setCopiedType(null), 2500);
  };

  // 3. Apply raw pasted text into plan
  const handleApplyPaste = () => {
    if (!pastedRawText.trim()) return;
    onApplyParsedPlan(pastedRawText.trim());
    setPastedRawText('');
    setPasteInputOpen(false);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
      <div className="flex items-center space-x-2 text-xs text-slate-300">
        <Sparkles className="w-4 h-4 text-amber-400" />
        <span className="font-bold">Fast Data I/O:</span>
        <span className="text-slate-400 hidden md:inline">Instantly copy/paste to and from Discord, Notion or notes</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
        {/* Quick Paste into Plan */}
        <button
          onClick={() => setPasteInputOpen(!pasteInputOpen)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors"
        >
          <ArrowDownToLine className="w-3.5 h-3.5 text-amber-400" />
          <span>Quick Paste to Plan</span>
        </button>

        {/* Copy Plan Only */}
        <button
          onClick={handleCopyPlanOnly}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-amber-500/20 active:scale-95"
          title="Copy only today's Mission Plan & Priorities for Discord/Notes"
        >
          {copiedType === 'plan' ? (
            <>
              <Check className="w-3.5 h-3.5 text-slate-950" />
              <span>Copied Plan!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Plan</span>
            </>
          )}
        </button>

        {/* Copy Review Only */}
        <button
          onClick={handleCopyReviewOnly}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all active:scale-95"
          title="Copy only today's Execution Review, Score & Reflexion for Discord/Notes"
        >
          {copiedType === 'review' ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copied Review!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Review</span>
            </>
          )}
        </button>

        {/* Copy JSON */}
        <button
          onClick={handleCopyJSON}
          className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs transition-colors"
          title="Copy Raw Day JSON"
        >
          {copiedType === 'json' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      {/* Paste Modal Dropdown */}
      {pasteInputOpen && (
        <div className="w-full pt-3 border-t border-slate-800 mt-2 space-y-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Paste anything (e.g. numbered list from Discord, chat, or voice notes):
          </label>
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={pastedRawText}
              onChange={(e) => setPastedRawText(e.target.value)}
              placeholder="e.g.:&#10;1. Finish discord test run&#10;2. Boot camp Miro checkpoints&#10;3. Procurement budget"
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none"
            />
            <button
              onClick={handleApplyPaste}
              className="px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center space-x-1 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Apply</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
