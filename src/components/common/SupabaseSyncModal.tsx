import React, { useState } from 'react';
import { Database, Key, Check, AlertCircle, Copy, CheckCircle2 } from 'lucide-react';
import { 
  getSupabaseCredentials, 
  saveSupabaseCredentials, 
  DEFAULT_SUPABASE_URL,
  SUPABASE_SCHEMA_SQL 
} from '../../lib/supabase';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncNow?: () => void;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({ isOpen, onClose, onSyncNow }) => {
  const current = getSupabaseCredentials();
  const [url, setUrl] = useState(current.url || DEFAULT_SUPABASE_URL);
  const [anonKey, setAnonKey] = useState(current.anonKey || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseCredentials(url, anonKey);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      if (onSyncNow) onSyncNow();
      onClose();
    }, 1500);
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl space-y-6 relative my-6 max-h-[92vh] overflow-y-auto">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Supabase Cloud Sync</h2>
              <p className="text-xs text-slate-400">Keep your tracking data safe & synchronized across all devices</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-950 text-slate-400 hover:text-slate-100">
            ✕
          </button>
        </div>

        {/* Benefits notice */}
        <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
          <div className="font-bold flex items-center space-x-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Schema-Agnostic JSONB Persistence:</span>
          </div>
          <p className="text-slate-400 pl-5">
            Every card, template change, and review metric you customize is safely preserved without breaking your database.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Supabase Project URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xyzcompany.supabase.co"
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-xs sm:text-sm text-slate-100 font-mono focus:outline-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Supabase anon / public API Key
            </label>
            <input
              type="password"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-xs sm:text-sm text-slate-100 font-mono focus:outline-none"
              required
            />
            <p className="text-[11px] text-slate-500">
              Found in your Supabase Dashboard → Project Settings → API
            </p>
          </div>

          {savedSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center space-x-2">
              <Check className="w-4 h-4" />
              <span>Credentials saved! Connected to Supabase.</span>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
            >
              Save & Connect
            </button>
          </div>
        </form>

        {/* SQL Schema helper */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Database Tables Setup (One-Click SQL)
            </span>
            <button
              type="button"
              onClick={handleCopySQL}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 font-mono"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Copied SQL!' : 'Copy Tables SQL'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Copy the SQL script and paste it into your <strong>Supabase SQL Editor</strong> to create the 6 modular tables with Row Level Security enabled.
          </p>
        </div>

      </div>
    </div>
  );
};
