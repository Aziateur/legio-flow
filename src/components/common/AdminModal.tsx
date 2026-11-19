import React, { useState, useEffect, useRef } from 'react';
import { useStorage } from '../../context/StorageContext';
import {
  AdminUserStateRow,
  DEFAULT_PROJECT_REF,
  SUPABASE_ADMIN_SQL,
  isAdminEmail
} from '../../lib/supabase';
import {
  Shield,
  Download,
  Upload,
  Users,
  RefreshCw,
  Sliders,
  Database,
  X,
  Check,
  Copy,
  AlertCircle,
  FileJson,
  CheckCircle2,
  Search,
  ExternalLink,
  RotateCcw,
  User
} from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSupabaseSettings: () => void;
}

interface BackupSummaryStats {
  days: number;
  weeks: number;
  months: number;
  years: number;
  gws: number;
  checklist: number;
  reviews: number;
  templates: number;
}

const getStateStats = (raw: any): BackupSummaryStats => {
  const src = raw?.state && typeof raw.state === 'object' && !Array.isArray(raw.state) ? raw.state : raw || {};
  const weeksObj = src.weeklyPlans && typeof src.weeklyPlans === 'object' ? src.weeklyPlans : {};
  const activeWeeks = Object.values(weeksObj).filter(
    (w: any) =>
      w &&
      ((Array.isArray(w.tasks) && w.tasks.length > 0) ||
        (typeof w.focusTheme === 'string' && w.focusTheme.trim().length > 0))
  ).length;
  return {
    days: src.dailyEntries && typeof src.dailyEntries === 'object' ? Object.keys(src.dailyEntries).length : 0,
    weeks: activeWeeks,
    months: src.monthlyPlans && typeof src.monthlyPlans === 'object' ? Object.keys(src.monthlyPlans).length : 0,
    years: src.yearlyPlans && typeof src.yearlyPlans === 'object' ? Object.keys(src.yearlyPlans).length : 0,
    gws: Array.isArray(src.gwsSessions) ? src.gwsSessions.length : 0,
    checklist: Array.isArray(src.checklistItems) ? src.checklistItems.length : 0,
    reviews: Array.isArray(src.reviews) ? src.reviews.length : 0,
    templates: Array.isArray(src.templates) ? src.templates.length : 0
  };
};

const safeFilenamePart = (val: string) =>
  val
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'account';

const triggerJsonDownload = (filename: string, payload: unknown) => {
  const json = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

interface PendingAllUsersUpload {
  filename: string;
  exportedAt: string;
  users: {
    user_id: string;
    email: string;
    display_name: string;
    state: Record<string, any>;
    selected: boolean;
  }[];
}

interface PendingSingleUpload {
  filename: string;
  targetType: 'self' | 'user';
  targetUserId?: string;
  targetEmail?: string;
  targetDisplayName?: string;
  sourceEmail?: string;
  exportedAt?: string;
  rawJson: string;
  parsedState: Record<string, any>;
  stats: BackupSummaryStats;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  onOpenSupabaseSettings
}) => {
  const {
    authUser,
    isAdmin,
    todayDate,
    setActiveTab,
    exportData,
    importData,
    resetAllData,
    adminListAllUsers,
    adminRestoreUserState
  } = useStorage();

  const [users, setUsers] = useState<AdminUserStateRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [needsSqlSetup, setNeedsSqlSetup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Pending upload confirmations
  const [pendingSingle, setPendingSingle] = useState<PendingSingleUpload | null>(null);
  const [pendingAllUsers, setPendingAllUsers] = useState<PendingAllUsersUpload | null>(null);

  // Hidden file inputs
  const selfFileInputRef = useRef<HTMLInputElement | null>(null);
  const allUsersFileInputRef = useRef<HTMLInputElement | null>(null);
  const perUserFileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetUserRef = useRef<AdminUserStateRow | null>(null);

  const loadAllUsers = async () => {
    setLoadingUsers(true);
    setUsersError(null);
    const res = await adminListAllUsers();
    setLoadingUsers(false);
    if (res.ok) {
      setUsers(res.users);
      setNeedsSqlSetup(false);
    } else {
      setUsersError(res.error || 'Could not load users.');
      setNeedsSqlSetup(Boolean(res.needsSqlSetup));
    }
  };

  useEffect(() => {
    if (isOpen && isAdmin) {
      setStatusMessage(null);
      setPendingSingle(null);
      setPendingAllUsers(null);
      void loadAllUsers();
    }
  }, [isOpen, isAdmin]);

  if (!isOpen || !isAdmin) return null;

  const handleCopyAdminSql = () => {
    navigator.clipboard.writeText(SUPABASE_ADMIN_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleDownloadSelfBackup = () => {
    const json = exportData();
    const label = safeFilenamePart(authUser?.email || 'my_account');
    triggerJsonDownload(`legio_account_${label}_${todayDate}.json`, json);
    setStatusMessage({ type: 'success', text: `Downloaded backup file for ${authUser?.email || 'your account'}.` });
  };

  const handleDownloadUserBackup = (u: AdminUserStateRow) => {
    const label = safeFilenamePart(u.email || u.display_name || u.user_id);
    const payload = {
      backupType: 'single_account' as const,
      version: 2,
      exportedAt: new Date().toISOString(),
      exportedByAdmin: authUser?.email || '',
      accountEmail: u.email,
      displayName: u.display_name,
      userId: u.user_id,
      ...(u.state || {})
    };
    triggerJsonDownload(`legio_account_${label}_${todayDate}.json`, payload);
    setStatusMessage({ type: 'success', text: `Downloaded backup file for ${u.email}.` });
  };

  const handleDownloadAllUsersBackup = () => {
    if (users.length === 0) {
      setStatusMessage({ type: 'error', text: 'No users loaded to export.' });
      return;
    }
    const bundle = {
      backupType: 'all_users' as const,
      version: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: authUser?.email || '',
      userCount: users.length,
      users: users.map(u => ({
        user_id: u.user_id,
        email: u.email,
        display_name: u.display_name,
        updated_at: u.updated_at,
        state: u.state || {}
      }))
    };
    triggerJsonDownload(`legio_ALL_USERS_backup_${todayDate}.json`, bundle);
    setStatusMessage({
      type: 'success',
      text: `Downloaded master backup containing ${users.length} account(s) in one file.`
    });
  };

  const parseSingleAccountFile = (
    file: File,
    targetType: 'self' | 'user',
    targetUser?: AdminUserStateRow
  ) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') {
          setStatusMessage({ type: 'error', text: 'Invalid JSON file.' });
          return;
        }
        if (parsed.backupType === 'all_users' && Array.isArray(parsed.users)) {
          setStatusMessage({
            type: 'error',
            text: 'This is a multi-user master backup file. Use "Upload ALL Users Backup (.json)" below instead.'
          });
          return;
        }
        const stateObj =
          parsed.state && typeof parsed.state === 'object' && !Array.isArray(parsed.state)
            ? parsed.state
            : parsed;
        const stats = getStateStats(stateObj);
        setPendingAllUsers(null);
        setPendingSingle({
          filename: file.name,
          targetType,
          targetUserId: targetUser?.user_id,
          targetEmail: targetUser?.email || authUser?.email,
          targetDisplayName: targetUser?.display_name || authUser?.displayName,
          sourceEmail: parsed.accountEmail || parsed.email || '',
          exportedAt: parsed.exportedAt || '',
          rawJson: text,
          parsedState: stateObj,
          stats
        });
        setStatusMessage(null);
      } catch {
        setStatusMessage({ type: 'error', text: `Could not parse "${file.name}" as valid JSON.` });
      }
    };
    reader.readAsText(file);
  };

  const parseAllUsersFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = JSON.parse(text);
        if (!parsed || parsed.backupType !== 'all_users' || !Array.isArray(parsed.users)) {
          setStatusMessage({
            type: 'error',
            text: 'Not a valid All-Users master backup file (expected backupType: "all_users"). For a single account file, use the single-account upload button.'
          });
          return;
        }
        setPendingSingle(null);
        setPendingAllUsers({
          filename: file.name,
          exportedAt: parsed.exportedAt || '',
          users: parsed.users.map((u: any) => ({
            user_id: String(u.user_id || u.userId || ''),
            email: String(u.email || u.accountEmail || ''),
            display_name: String(u.display_name || u.displayName || u.email || ''),
            state: u.state && typeof u.state === 'object' ? u.state : {},
            selected: true
          }))
        });
        setStatusMessage(null);
      } catch {
        setStatusMessage({ type: 'error', text: `Could not parse "${file.name}" as valid JSON.` });
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmSingleRestore = async () => {
    if (!pendingSingle) return;
    setRestoring(true);
    setStatusMessage(null);

    if (pendingSingle.targetType === 'self') {
      const ok = importData(pendingSingle.rawJson);
      setRestoring(false);
      if (ok) {
        setPendingSingle(null);
        setStatusMessage({
          type: 'success',
          text: `Restored "${pendingSingle.filename}" into your account and synced to cloud.`
        });
        void loadAllUsers();
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Backup file did not contain recognized Legio account data.'
        });
      }
      return;
    }

    const res = await adminRestoreUserState({
      userId: pendingSingle.targetUserId,
      email: pendingSingle.targetEmail,
      displayName: pendingSingle.targetDisplayName,
      state: pendingSingle.parsedState
    });
    setRestoring(false);
    if (res.ok) {
      setPendingSingle(null);
      setStatusMessage({
        type: 'success',
        text: `Restored "${pendingSingle.filename}" into ${res.restoredEmail || pendingSingle.targetEmail}'s cloud account.`
      });
      void loadAllUsers();
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to restore user account.' });
      if (res.needsSqlSetup) setNeedsSqlSetup(true);
    }
  };

  const handleConfirmAllUsersRestore = async () => {
    if (!pendingAllUsers) return;
    const selected = pendingAllUsers.users.filter(u => u.selected);
    if (selected.length === 0) {
      setStatusMessage({ type: 'error', text: 'Select at least one account to restore.' });
      return;
    }

    setRestoring(true);
    setStatusMessage(null);
    let successCount = 0;
    const failures: string[] = [];

    for (const u of selected) {
      const res = await adminRestoreUserState({
        userId: u.user_id || undefined,
        email: u.email || undefined,
        displayName: u.display_name || undefined,
        state: u.state
      });
      if (res.ok) {
        successCount += 1;
      } else {
        failures.push(`${u.email || u.user_id}: ${res.error || 'failed'}`);
        if (res.needsSqlSetup) {
          setNeedsSqlSetup(true);
          break;
        }
      }
    }

    setRestoring(false);
    if (failures.length === 0) {
      setPendingAllUsers(null);
      setStatusMessage({
        type: 'success',
        text: `Successfully restored ${successCount}/${selected.length} user account(s) from "${pendingAllUsers.filename}".`
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: `Restored ${successCount}/${selected.length}. Errors: ${failures.join(' • ')}`
      });
    }
    void loadAllUsers();
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      u.display_name.toLowerCase().includes(q) ||
      u.user_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-4xl p-6 sm:p-8 shadow-2xl space-y-6 relative my-6">
        {/* Hidden File Inputs */}
        <input
          ref={selfFileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) parseSingleAccountFile(file, 'self');
          }}
        />
        <input
          ref={allUsersFileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) parseAllUsersFile(file);
          }}
        />
        <input
          ref={perUserFileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = '';
            const target = uploadTargetUserRef.current;
            if (file && target) parseSingleAccountFile(file, 'user', target);
          }}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-extrabold text-slate-100">LEGIO Admin Console</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold uppercase tracking-wider">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Signed in as <span className="font-mono text-slate-200">{authUser?.email}</span> • Manage templates, single-file backups & all-user data
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="self-end sm:self-center p-2 rounded-xl bg-slate-950 text-slate-400 hover:text-slate-100 border border-slate-800"
            title="Close Admin Console"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Feedback Banner */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-start space-x-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Quick Admin Tools Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab('templates');
              onClose();
            }}
            className="flex items-center space-x-3 p-4 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 text-left transition-all"
          >
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25 shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-slate-100">Template Manager</div>
              <div className="text-[11px] text-slate-400">Edit card layouts, fields & shapes</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSupabaseSettings();
            }}
            className="flex items-center space-x-3 p-4 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 text-left transition-all"
          >
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-slate-100">Supabase Cloud Config</div>
              <div className="text-[11px] text-slate-400">API credentials & table SQL</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirm('Reset YOUR current account to initial sample data?')) {
                resetAllData();
                setStatusMessage({ type: 'success', text: 'Your local workspace was reset to sample data.' });
              }
            }}
            className="flex items-center space-x-3 p-4 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-rose-500/40 text-left transition-all"
          >
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/25 shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-slate-100">Reset Sample Data</div>
              <div className="text-[11px] text-slate-400">Restore demo dataset on this account</div>
            </div>
          </button>
        </div>

        {/* Pending Single-Account Upload Preview & Confirmation */}
        {pendingSingle && (
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/40 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <FileJson className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                    Confirm Single-Account Restore
                  </div>
                  <div className="text-xs text-slate-200 mt-0.5">
                    File: <span className="font-mono font-bold">{pendingSingle.filename}</span> → Target:{' '}
                    <span className="font-mono text-amber-300 font-bold">
                      {pendingSingle.targetEmail || 'My Account'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingSingle(null)}
                className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pendingSingle.sourceEmail && (
              <div className="text-[11px] text-slate-300 font-mono">
                Backup origin: {pendingSingle.sourceEmail}
                {pendingSingle.exportedAt ? ` • Exported ${new Date(pendingSingle.exportedAt).toLocaleString()}` : ''}
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-[11px] font-mono">
              <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                {pendingSingle.stats.days} days
              </span>
              <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                {pendingSingle.stats.weeks} active weeks
              </span>
              <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                {pendingSingle.stats.months} months
              </span>
              <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                {pendingSingle.stats.years} years
              </span>
              <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                {pendingSingle.stats.gws} GWS sprints
              </span>
              <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                {pendingSingle.stats.checklist} checklist items
              </span>
              <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                {pendingSingle.stats.reviews} reviews
              </span>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingSingle(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={restoring}
                onClick={handleConfirmSingleRestore}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 shadow-md"
              >
                {restoring ? 'Restoring...' : 'Confirm & Restore Account'}
              </button>
            </div>
          </div>
        )}

        {/* Pending All-Users Master Backup Preview & Confirmation */}
        {pendingAllUsers && (
          <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/40 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-purple-300 shrink-0" />
                <div>
                  <div className="text-xs font-extrabold text-purple-300 uppercase tracking-wider">
                    Confirm All-Users Master Restore
                  </div>
                  <div className="text-xs text-slate-200 mt-0.5">
                    File: <span className="font-mono font-bold">{pendingAllUsers.filename}</span> ({pendingAllUsers.users.length} accounts)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingAllUsers(null)}
                className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {pendingAllUsers.users.map((u, idx) => {
                const st = getStateStats(u.state);
                return (
                  <label
                    key={`${u.user_id}_${idx}`}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs cursor-pointer hover:border-purple-500/40"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={u.selected}
                        onChange={() =>
                          setPendingAllUsers(prev =>
                            prev
                              ? {
                                  ...prev,
                                  users: prev.users.map((item, i) =>
                                    i === idx ? { ...item, selected: !item.selected } : item
                                  )
                                }
                              : prev
                          )
                        }
                        className="rounded border-slate-700 bg-slate-900 text-purple-500 focus:ring-purple-500"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-100 truncate">{u.display_name || u.email}</div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">{u.email}</div>
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 shrink-0">
                      {st.days}d • {st.weeks}w • {st.gws} GWS • {st.checklist} chk
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">
                {pendingAllUsers.users.filter(u => u.selected).length} of {pendingAllUsers.users.length} selected
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setPendingAllUsers(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={restoring}
                  onClick={handleConfirmAllUsersRestore}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-slate-950 shadow-md"
                >
                  {restoring ? 'Restoring Users...' : 'Restore Selected Users to Cloud'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 1: My Account Single-File Desktop Backup */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <User className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-100">
                  My Account Single-File Backup
                </h3>
                <p className="text-[11px] text-slate-400">
                  Save your entire account into one <code className="text-amber-300">.json</code> file on your computer, or upload a file to restore it.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadSelfBackup}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download My Backup (.json)</span>
              </button>
              <button
                type="button"
                onClick={() => selfFileInputRef.current?.click()}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-bold transition-all"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Upload & Restore (.json)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(exportData());
                  setStatusMessage({ type: 'success', text: 'Copied your full account JSON backup to clipboard.' });
                }}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold transition-all"
                title="Copy full JSON backup to clipboard"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: All Users Cloud Backup & Restore */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2.5">
              <Users className="w-5 h-5 text-purple-400 shrink-0" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-100">
                  All Users Cloud Backup & Restore ({users.length})
                </h3>
                <p className="text-[11px] text-slate-400">
                  Back up every user in ONE file or download/restore any individual user account directly to Supabase.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadAllUsers}
                disabled={loadingUsers}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadAllUsersBackup}
                disabled={users.length === 0}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 disabled:opacity-40 text-slate-950 text-xs font-extrabold shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download ALL Users (1 File)</span>
              </button>

              <button
                type="button"
                onClick={() => allUsersFileInputRef.current?.click()}
                disabled={needsSqlSetup}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 border border-slate-700 text-xs font-bold"
              >
                <Upload className="w-3.5 h-3.5 text-purple-400" />
                <span>Upload ALL Users (.json)</span>
              </button>
            </div>
          </div>

          {/* One-Time Admin SQL Setup Helper if RPCs aren't installed yet */}
          {needsSqlSetup && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/35 space-y-3">
              <div className="flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-xs font-extrabold text-amber-300">
                    One-Time Supabase Admin SQL Setup Required
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    To securely allow <strong>{authUser?.email}</strong> to back up and restore other users&apos; accounts (while keeping regular users strictly isolated by Row Level Security), run this Admin SQL snippet once in your Supabase SQL Editor.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pl-6">
                <button
                  type="button"
                  onClick={handleCopyAdminSql}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Copied Admin SQL!' : 'Copy Admin SQL'}</span>
                </button>
                <a
                  href={`https://supabase.com/dashboard/project/${DEFAULT_PROJECT_REF}/sql/new`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-bold"
                >
                  <span>Open Supabase SQL Editor</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={loadAllUsers}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                >
                  I Ran It — Reload Users
                </button>
              </div>
            </div>
          )}

          {usersError && !needsSqlSetup && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{usersError}</span>
            </div>
          )}

          {/* Search & User List */}
          {!needsSqlSetup && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter accounts by name or email..."
                  className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500/40 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none"
                />
              </div>

              {loadingUsers ? (
                <div className="py-8 text-center text-xs text-slate-400 font-mono">
                  Loading accounts from Supabase...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No user accounts found.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {filteredUsers.map(u => {
                    const stats = getStateStats(u.state);
                    const userIsAdmin = isAdminEmail(u.email);
                    return (
                      <div
                        key={u.user_id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-extrabold text-slate-100 truncate">
                              {u.display_name || u.email}
                            </span>
                            {userIsAdmin && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-extrabold uppercase">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            {u.email}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-500">
                            <span>{stats.days}d</span>
                            <span>•</span>
                            <span>{stats.weeks}w</span>
                            <span>•</span>
                            <span>{stats.gws} GWS</span>
                            <span>•</span>
                            <span>{stats.checklist} chk</span>
                            <span>•</span>
                            <span>{stats.reviews} rev</span>
                            {u.updated_at && (
                              <>
                                <span>•</span>
                                <span>Synced {new Date(u.updated_at).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleDownloadUserBackup(u)}
                            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800 text-[11px] font-bold transition-colors"
                            title={`Download ${u.email}'s backup as a single .json file`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Backup (.json)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              uploadTargetUserRef.current = u;
                              perUserFileInputRef.current?.click();
                            }}
                            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-purple-300 border border-slate-800 text-[11px] font-bold transition-colors"
                            title={`Upload a .json backup file to restore ${u.email}'s account`}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Restore (.json)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
