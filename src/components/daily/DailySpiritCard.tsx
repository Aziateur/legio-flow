import React, { useEffect, useRef } from 'react';
import { useStorage } from '../../context/StorageContext';

interface DailySpiritCardProps {
  selectedDate: string;
}

export const DailySpiritCard: React.FC<DailySpiritCardProps> = ({ selectedDate }) => {
  const { getEntryForDate, saveDailyEntry } = useStorage();
  const entry = getEntryForDate(selectedDate);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const value = entry.daySpirit || '';

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, selectedDate]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-2.5">
      <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
        GOAL / SPIRIT OF THE DAY
      </div>
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => saveDailyEntry(selectedDate, { daySpirit: e.target.value })}
        placeholder="What's today's goal or spirit? (e.g., do every vital system while recovering, fix sleep, finish one key task...)"
        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-2xl px-4 py-3 text-sm sm:text-base font-medium text-slate-100 placeholder-slate-600 focus:outline-none resize-none overflow-hidden transition-colors"
      />
    </div>
  );
};
