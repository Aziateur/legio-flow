import React, { useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { SUPABASE_SCHEMA_SQL } from '../../lib/supabase';
import {
  User,
  LogIn,
  UserPlus,
  LogOut,
  Check,
  AlertCircle,
  Cloud,
  RefreshCw,
  Copy,
  X,
  Sparkles,
  Shield,
  AlertTriangle,
  Download
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdminConsole?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onOpenAdminConsole }) => {
  const {
    authUser,
    isAdmin,
    todayDate,
    rememberDevice,
    setRememberDevice,
    syncStatus,
    syncError,
    signIn,
    signUp,
    signOut,
    syncNow,
    exportData,
    startFreshWorkspace
  } = useStorage();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [keepLocalData, setKeepLocalData] = useState(false);
  const [rememberMe, setRememberMe] = useState(rememberDevice);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  // 2-layer safety gate for Start Fresh (0 = closed, 1 = warning + backup prompt, 2 = typed confirmation)
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [wipeStep, setWipeStep] = useState<0 | 1 | 2>(0);
  const [wipeConfirmInput, setWipeConfirmInput] = useState('');
  const [backupDownloadedBeforeWipe, setBackupDownloadedBeforeWipe] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    if (mode === 'signin') {
      const res = await signIn(email, password, rememberMe);
      setLoading(false);
      if (res.ok) {
        onClose();
      } else {
        setErrorMsg(res.error || 'Could not sign in. Please check your credentials.');
      }
    } else {
      const res = await signUp(email, password, displayName, keepLocalData, rememberMe);
      setLoading(false);
      if (res.ok) {
        if (res.needsEmailConfirm) {
          setInfoMsg('Account created! Check your email inbox to confirm your address, then sign in.');
        } else {
          onClose();
        }
      } else {
        setErrorMsg(res.error || 'Could not create account.');
      }
    }
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl space-y-6 relative my-6">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-950 text-slate-400 hover:text-slate-100"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-100">
              {authUser ? 'Your Legio Account' : 'Legio Flow Accounts'}
            </h2>
            <p className="text-xs text-slate-400">
              {authUser
                ? 'Synced privately to your Supabase account'
                : 'Sign in or create an account so your plans sync across devices'}
            </p>
          </div>
        </div>

        {/* Logged-in View */}
        {authUser ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Signed in as</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center space-x-1 ${
                    syncStatus === 'synced'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : syncStatus === 'syncing'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}
                >
                  <Cloud className="w-3 h-3" />
                  <span>
                    {syncStatus === 'synced'
                      ? 'Cloud Synced'
                      : syncStatus === 'syncing'
                      ? 'Syncing...'
                      : syncStatus === 'error'
                      ? 'Sync Error'
                      : 'Ready'}
                  </span>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-sm font-bold text-slate-100">
                  {authUser.displayName || authUser.email}
                </div>
                {isAdmin && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </div>
              <div className="text-xs font-mono text-slate-400">{authUser.email}</div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <label className="flex items-center space-x-2 text-emerald-400 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Remember this computer & stay signed in</span>
                </label>
              </div>
            </div>

            {syncError && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-2">
                <div className="flex items-center space-x-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Cloud Sync Notice</span>
                </div>
                <p>{syncError}</p>
                {isAdmin && (
                  <p className="text-[11px] text-slate-400">
                    Make sure the Supabase project is active and the <code>legio_user_state</code> table SQL has been run in Supabase SQL Editor.
                  </p>
                )}
              </div>
            )}

            {isAdmin && onOpenAdminConsole && (
              <button
                type="button"
                onClick={onOpenAdminConsole}
                className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 text-xs font-extrabold transition-colors"
              >
                <Shield className="w-4 h-4" />
                <span>Open Admin Console (Templates & All-Users Backups)</span>
              </button>
            )}

            <button
              type="button"
              onClick={syncNow}
              className="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              <span>Sync Now</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await signOut();
                onClose();
              }}
              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-bold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>

            {/* Admin-Only Danger Zone with 2-Layer Confirmation for Start Fresh */}
            {isAdmin && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowDangerZone(!showDangerZone);
                    setWipeStep(0);
                    setWipeConfirmInput('');
                    setBackupDownloadedBeforeWipe(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 text-[11px] font-bold text-slate-400 hover:text-rose-400 transition-colors"
                >
                  <span className="flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400/80" />
                    <span>Danger Zone (Wipe / Start Fresh)</span>
                  </span>
                  <span className="font-mono text-[10px]">{showDangerZone ? 'Hide' : 'Show'}</span>
                </button>

                {showDangerZone && wipeStep === 0 && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/5 border border-rose-500/25 space-y-2.5">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      <strong>Start Fresh</strong> permanently wipes all daily plans, weekly/monthly/yearly plans, GWS sprints, reviews, and checklists on this account. Requires 2 confirmation steps.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setWipeStep(1);
                        setWipeConfirmInput('');
                        setBackupDownloadedBeforeWipe(false);
                      }}
                      className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/35 text-xs font-bold transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Start Fresh (Step 1 of 2)...</span>
                    </button>
                  </div>
                )}

                {showDangerZone && wipeStep === 1 && (
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 space-y-3">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="text-xs font-extrabold text-rose-300">
                          Are you sure? (Layer 1 of 2)
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          This will erase <strong>ALL data in {authUser.email}</strong> and overwrite your cloud save with a blank workspace. Download a safety backup first if you might ever want it back.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const json = exportData();
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `legio_SAFETY_backup_${todayDate}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        setBackupDownloadedBeforeWipe(true);
                      }}
                      className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 text-xs font-bold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {backupDownloadedBeforeWipe
                          ? 'Safety Backup Downloaded ✓'
                          : 'Download Safety Backup (.json) First'}
                      </span>
                    </button>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setWipeStep(0)}
                        className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setWipeStep(2)}
                        className="flex-1 py-2 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 text-rose-200 border border-rose-500/40 text-xs font-extrabold"
                      >
                        Continue to Layer 2 →
                      </button>
                    </div>
                  </div>
                )}

                {showDangerZone && wipeStep === 2 && (
                  <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/50 space-y-3">
                    <div className="text-xs font-extrabold text-rose-300">
                      Final Confirmation (Layer 2 of 2)
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Type <code className="px-1.5 py-0.5 rounded bg-slate-950 text-rose-300 font-bold">WIPE MY ACCOUNT</code> below to permanently erase this workspace:
                    </p>
                    <input
                      type="text"
                      value={wipeConfirmInput}
                      onChange={(e) => setWipeConfirmInput(e.target.value)}
                      placeholder="WIPE MY ACCOUNT"
                      className="w-full bg-slate-950 border border-rose-500/40 focus:border-rose-400 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none"
                    />
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setWipeStep(0);
                          setWipeConfirmInput('');
                        }}
                        className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={wipeConfirmInput.trim().toUpperCase() !== 'WIPE MY ACCOUNT'}
                        onClick={() => {
                          startFreshWorkspace();
                          setWipeStep(0);
                          setWipeConfirmInput('');
                          setShowDangerZone(false);
                          onClose();
                        }}
                        className="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-35 disabled:cursor-not-allowed text-slate-950 text-xs font-extrabold"
                      >
                        Permanently Wipe
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Logged-out Sign In / Sign Up Form */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg('');
                  setInfoMsg('');
                }}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                  mode === 'signin'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg('');
                  setInfoMsg('');
                }}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                  mode === 'signup'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create Account</span>
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1.5">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
                {errorMsg.toLowerCase().includes('paused') && (
                  <a
                    href="https://supabase.com/dashboard/project/hdpqwpkktxzrcrprtyxq"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block ml-6 text-amber-400 hover:text-amber-300 underline font-semibold"
                  >
                    Open Supabase Dashboard (Restore Project) →
                  </a>
                )}
              </div>
            )}

            {infoMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start space-x-2">
                <Check className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Ali"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-xs sm:text-sm text-slate-100 focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-xs sm:text-sm text-slate-100 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl p-3 text-xs sm:text-sm text-slate-100 focus:outline-none"
                  required
                />
              </div>

              <label className="flex items-center space-x-2 text-xs text-slate-300 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Remember this computer & keep me signed in</span>
              </label>

              {mode === 'signup' && (
                <label className="flex items-center space-x-2 text-xs text-slate-400 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepLocalData}
                    onChange={(e) => setKeepLocalData(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Keep my current local plans (leave unchecked for a clean new account)</span>
                </label>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {loading
                  ? 'Connecting...'
                  : mode === 'signin'
                  ? 'Sign In & Sync'
                  : 'Create Free Account'}
              </button>
            </form>
          </div>
        )}

        {/* Admin SQL helper (Admin Only) */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Protected by Supabase Auth + RLS</span>
          {isAdmin && (
            <button
              type="button"
              onClick={handleCopySQL}
              className="flex items-center space-x-1 text-slate-400 hover:text-amber-400 font-mono"
            >
              {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSql ? 'SQL Copied!' : 'Copy Setup SQL'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
