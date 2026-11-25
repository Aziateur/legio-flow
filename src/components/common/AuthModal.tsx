import React, { useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { SUPABASE_SCHEMA_SQL } from '../../lib/supabase';
import { LEVEL_META } from '../../lib/levelFeatures';
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
  Download,
  Upload,
  Sliders,
  Database,
  Settings,
  Bell
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdminConsole?: () => void;
  onOpenTemplates?: () => void;
  onExportBackup?: () => void;
  onOpenImportBackup?: () => void;
  onOpenSupabaseSettings?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onOpenAdminConsole,
  onOpenTemplates,
  onExportBackup,
  onOpenImportBackup,
  onOpenSupabaseSettings
}) => {
  const {
    authUser,
    isAdmin,
    todayDate,
    systemLevel,
    setSystemLevel,
    browserNotificationsEnabled,
    enableBrowserNotifications,
    rememberDevice,
    setRememberDevice,
    syncStatus,
    syncError,
    signIn,
    signUp,
    signOut,
    syncNow,
    localSnapshots,
    restoreLocalSnapshot,
    exportData,
    startFreshWorkspace
  } = useStorage();

  const [profileTab, setProfileTab] = useState<'account' | 'parameters'>('account');
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshotRestoredMsg, setSnapshotRestoredMsg] = useState<string | null>(null);
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

        {/* Logged-in View with Profile / Parameters Tabs */}
        {authUser ? (
          <div className="space-y-4">
            {/* Profile vs Parameters Tab Bar */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setProfileTab('account')}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                  profileTab === 'account'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Profile</span>
              </button>
              <button
                type="button"
                onClick={() => setProfileTab('parameters')}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                  profileTab === 'parameters'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Parameters</span>
                {isAdmin && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                      profileTab === 'parameters'
                        ? 'bg-slate-950/20 text-slate-950'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    Admin
                  </span>
                )}
              </button>
            </div>

            {profileTab === 'account' ? (
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
              </div>
            ) : (
              /* PARAMETERS TAB */
              <div className="space-y-4">
                {/* General Workspace Parameters */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    Workspace Preferences
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-semibold">App Complexity / Fuel Level</span>
                      <span
                        className={`font-mono font-bold ${
                          systemLevel === 0 ? 'text-teal-400' : 'text-amber-400'
                        }`}
                      >
                        LVL {systemLevel}
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {([0, 1, 2, 3, 4, 5] as const).map(lvl => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setSystemLevel(lvl)}
                          title={LEVEL_META[lvl].desc}
                          className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                            systemLevel === lvl
                              ? lvl === 0
                                ? 'bg-teal-500 text-slate-950 shadow-sm'
                                : 'bg-amber-500 text-slate-950 shadow-sm'
                              : lvl === 0
                              ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20'
                              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          L{lvl}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug pt-0.5">
                      <strong className="text-slate-200">{LEVEL_META[systemLevel].name}:</strong>{' '}
                      {LEVEL_META[systemLevel].desc}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs text-slate-300">
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      <span>Browser Plan Reminders</span>
                    </div>
                    <button
                      type="button"
                      onClick={enableBrowserNotifications}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                        browserNotificationsEnabled
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-700'
                      }`}
                    >
                      {browserNotificationsEnabled ? 'ON' : 'Enable'}
                    </button>
                  </div>
                </div>

                {/* Admin-Only Tools & Backup Parameters (moved off Navbar so top bar stays clean) */}
                {isAdmin && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/25 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 flex items-center space-x-1.5">
                        <Shield className="w-3.5 h-3.5" />
                        <span>Admin Parameters & Tools</span>
                      </span>
                    </div>

                    {onOpenAdminConsole && (
                      <button
                        type="button"
                        onClick={onOpenAdminConsole}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 text-xs font-extrabold transition-colors"
                      >
                        <span className="flex items-center space-x-2">
                          <Shield className="w-4 h-4 shrink-0" />
                          <span>Admin Console (All-Users Backups)</span>
                        </span>
                        <span className="text-[10px] opacity-80">Open →</span>
                      </button>
                    )}

                    {onOpenTemplates && (
                      <button
                        type="button"
                        onClick={onOpenTemplates}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-800 text-xs font-bold transition-colors"
                      >
                        <span className="flex items-center space-x-2">
                          <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Template & Layout Customizer</span>
                        </span>
                        <span className="text-[10px] text-slate-400">Open →</span>
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      {onExportBackup && (
                        <button
                          type="button"
                          onClick={onExportBackup}
                          className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-bold transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Download .json</span>
                        </button>
                      )}
                      {onOpenImportBackup && (
                        <button
                          type="button"
                          onClick={onOpenImportBackup}
                          className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-bold transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Upload .json</span>
                        </button>
                      )}
                    </div>

                    {onOpenSupabaseSettings && (
                      <button
                        type="button"
                        onClick={onOpenSupabaseSettings}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-800 text-xs font-bold transition-colors"
                      >
                        <span className="flex items-center space-x-2">
                          <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Supabase Cloud Sync Config</span>
                        </span>
                        <span className="text-[10px] text-slate-400">Configure →</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Local Auto-Recovery Snapshots (Safety Net on This Device) */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowSnapshots(prev => !prev)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 text-[11px] font-bold text-slate-300 transition-colors"
                  >
                    <span className="flex items-center space-x-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Local Auto-Recovery Snapshots ({localSnapshots.length})</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {showSnapshots ? 'Hide' : 'Show'}
                    </span>
                  </button>

                  {snapshotRestoredMsg && (
                    <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-[11px] font-bold text-emerald-300">
                      ✓ {snapshotRestoredMsg}
                    </div>
                  )}

                  {showSnapshots && (
                    <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 max-h-56 overflow-y-auto">
                      {localSnapshots.length === 0 ? (
                        <p className="text-[11px] text-slate-500">
                          Automatic snapshots are captured on this device before every cloud merge or import.
                        </p>
                      ) : (
                        localSnapshots.map(snap => (
                          <div
                            key={snap.id}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px]"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-200 truncate">
                                {snap.reason}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {new Date(snap.savedAt).toLocaleString()}
                              </div>
                              <div className="text-[10px] text-amber-300/80 truncate">
                                {snap.summary}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Restore snapshot from ${new Date(snap.savedAt).toLocaleString()}? (Your current state will be saved as a new snapshot first.)`
                                  )
                                ) {
                                  const ok = restoreLocalSnapshot(snap.id);
                                  if (ok) {
                                    setSnapshotRestoredMsg('Snapshot restored and synced to cloud.');
                                    setTimeout(() => setSnapshotRestoredMsg(null), 3000);
                                  }
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 font-bold shrink-0"
                            >
                              Restore
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

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
