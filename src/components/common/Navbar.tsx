import React, { useState, useEffect, useRef } from 'react';
import { useStorage } from '../../context/StorageContext';
import { 
  Timer, 
  Target, 
  TrendingUp, 
  Compass,
  Download, 
  Upload, 
  Flame,
  CheckCircle2,
  Menu,
  X,
  Database,
  Bell,
  User,
  ArrowRight,
  Shield,
  Sliders,
  FileJson
} from 'lucide-react';
import { SupabaseSyncModal } from './SupabaseSyncModal';
import { AuthModal } from './AuthModal';
import { AdminModal } from './AdminModal';

export const Navbar: React.FC<{ onOpenQuickGWS: () => void }> = ({ onOpenQuickGWS }) => {
  const { 
    activeTab, 
    setActiveTab, 
    setPlanningSubTab,
    todayDate,
    setSelectedDate,
    selectedDate, 
    gwsSessions, 
    activeGwsTimer,
    dailyEntries,
    systemLevel,
    setSystemLevel,
    missingPlanAlerts,
    browserNotificationsEnabled,
    enableBrowserNotifications,
    authUser,
    isAdmin,
    syncStatus,
    syncNow,
    exportData, 
    importData
  } = useStorage();

  const [levelDropdownOpen, setLevelDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [timerNowMs, setTimerNowMs] = useState(() => Date.now());

  const isGwsRunning = Boolean(activeGwsTimer?.startedAt);
  const activeGwsSeconds = activeGwsTimer
    ? activeGwsTimer.accumulatedSeconds +
      (activeGwsTimer.startedAt ? Math.max(0, Math.floor((timerNowMs - activeGwsTimer.startedAt) / 1000)) : 0)
    : 0;
  const hasActiveGwsTimer = Boolean(activeGwsTimer && (isGwsRunning || activeGwsSeconds > 0));

  useEffect(() => {
    if (!isGwsRunning) return;
    setTimerNowMs(Date.now());
    const id = setInterval(() => setTimerNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isGwsRunning]);

  const formatShortTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Calculate quick stats
  const todayEntry = dailyEntries[selectedDate];
  const totalGwsHours = (
    gwsSessions.reduce((acc, s) => acc + (s.actualMinutes || 0), 0) / 60
  ).toFixed(1);

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeEmail = (authUser?.email || 'account')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '_')
      .slice(0, 40);
    a.href = url;
    a.download = `legio_account_${safeEmail}_${selectedDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFileSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      setImportFileName(file.name);
      setImportJsonText(content);
      setImportError('');
      try {
        const parsed = JSON.parse(content);
        if (parsed?.backupType === 'all_users' && Array.isArray(parsed.users)) {
          setImportError(
            'This is an All-Users Master Backup file. Open the Admin Console → "Upload ALL Users (.json)" to restore multiple accounts.'
          );
        }
      } catch {
        setImportError(`"${file.name}" does not contain valid JSON.`);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = () => {
    if (!importJsonText.trim()) return;
    try {
      const parsed = JSON.parse(importJsonText);
      if (parsed?.backupType === 'all_users' && Array.isArray(parsed.users)) {
        setImportError(
          'This is an All-Users Master Backup file. Open the Admin Console → "Upload ALL Users (.json)" to restore multiple accounts.'
        );
        return;
      }
    } catch {
      setImportError('Invalid JSON format. Please verify the backup file.');
      return;
    }

    const ok = importData(importJsonText);
    if (ok) {
      setShowImportModal(false);
      setImportJsonText('');
      setImportFileName('');
      setImportError('');
      alert('Account data restored and synced!');
    } else {
      setImportError('Unrecognized backup format. Please select a valid LEGIO .json backup file.');
    }
  };

  // Filter nav tabs according to selected progressive system level (1 to 5)
  const allNavItems = [
    { id: 'planning' as const, label: 'Planning Hub', icon: Compass, minLevel: 1 },
    { id: 'checklist' as const, label: 'Checklist', icon: CheckCircle2, minLevel: 1 },
    { id: 'gws' as const, label: 'GWS Studio', icon: Timer, minLevel: 2 },
    { id: 'review' as const, label: 'Review Hub', icon: TrendingUp, minLevel: 1 },
  ];

  const navItems = allNavItems.filter(item => systemLevel >= item.minLevel);

  const levelDescriptions = {
    1: { name: 'Level 1: Basic Flow', desc: 'Daily checklist, mission plan & daily review' },
    2: { name: 'Level 2: Deep Work', desc: 'Adds GWS cockpit, stopwatch & reflexions' },
    3: { name: 'Level 3: Goal Crusher', desc: 'Adds Weekly Goal Crusher (10 Pts) & Weeks Matrix' },
    4: { name: 'Level 4: Monthly & Macro', desc: 'Adds Monthly Plan plus Monthly & Quarterly Reviews' },
    5: { name: 'Level 5: Yearly Strategy', desc: 'Adds Yearly Plan & Yearly Review across all timeframes' }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-[64px] py-2 gap-3">
            
            {/* Brand Logo & Title */}
            <div className="flex items-center space-x-2.5 cursor-pointer shrink-0 group" onClick={() => setActiveTab('planning')}>
              <div className="h-9 w-9 rounded-xl bg-slate-950 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10 group-hover:border-amber-400 transition-colors">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2.5L20 6.5V12.5C20 17.2 16.6 20.6 12 22C7.4 20.6 4 17.2 4 12.5V6.5L12 2.5Z"
                    stroke="#F59E0B"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8.5 8.5V15.5H15.5"
                    stroke="#FBBF24"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="font-extrabold text-xl tracking-[0.18em] text-slate-100 uppercase whitespace-nowrap">
                LEGIO
              </span>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150 whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Quick Metrics & Actions */}
            <div className="hidden lg:flex items-center space-x-2.5 shrink-0">
              
              {/* Level Selector Dropdown Pill */}
              <div className="relative">
                <button
                  onClick={() => setLevelDropdownOpen(!levelDropdownOpen)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all shadow-sm whitespace-nowrap"
                  title="Switch Experience Level"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>LVL {systemLevel}</span>
                </button>

                {levelDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl z-50 space-y-1">
                    <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                      Select App Complexity Level
                    </div>
                    {([1, 2, 3, 4, 5] as const).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => {
                          setSystemLevel(lvl);
                          setLevelDropdownOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-xl text-xs transition-all flex flex-col ${
                          systemLevel === lvl
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="font-extrabold">{levelDescriptions[lvl].name}</span>
                        <span className={`text-[10px] mt-0.5 ${systemLevel === lvl ? 'text-slate-900' : 'text-slate-500'}`}>
                          {levelDescriptions[lvl].desc}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Today's live execution telemetry (only shows end-of-day grade once scored) */}
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300 whitespace-nowrap">
                <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Tasks:{' '}
                  <strong className="text-slate-100 font-mono">
                    {todayEntry ? `${todayEntry.mainTasksCompleted}/${todayEntry.mainTasksTotal}` : '0/3'}
                  </strong>
                  {todayEntry && todayEntry.executionScore > 0 && (
                    <>
                      {' '}• Grade: <strong className="text-amber-400 font-mono">{todayEntry.executionScore}/10</strong>
                    </>
                  )}
                </span>
                <span className="text-slate-600">|</span>
                <span>
                  GWS: <strong className="text-slate-100 font-mono">{totalGwsHours}h</strong>
                </span>
              </div>

              {/* Start GWS / Live Active Timer Button */}
              <button
                onClick={onOpenQuickGWS}
                title={
                  hasActiveGwsTimer
                    ? `${isGwsRunning ? 'Live Sprint' : 'Paused Sprint'}: ${activeGwsTimer?.taskName || 'Active GWS'} (click to open)`
                    : 'Start a GWS deep work sprint'
                }
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 whitespace-nowrap ${
                  isGwsRunning
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
                    : hasActiveGwsTimer
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 shadow-amber-500/10'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
                }`}
              >
                {isGwsRunning ? (
                  <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse shrink-0" />
                ) : (
                  <Timer className="w-3.5 h-3.5" />
                )}
                <span className={hasActiveGwsTimer ? 'font-mono' : ''}>
                  {isGwsRunning
                    ? `GWS ${formatShortTimer(activeGwsSeconds)}`
                    : hasActiveGwsTimer
                    ? `Paused ${formatShortTimer(activeGwsSeconds)}`
                    : '+ GWS Sprint'}
                </span>
              </button>

              {/* Notification Bell (Missing Day / Week Plan Alerts) */}
              <div className="relative">
                <button
                  onClick={() => {
                    setNotifDropdownOpen(!notifDropdownOpen);
                    setLevelDropdownOpen(false);
                  }}
                  title={missingPlanAlerts.length > 0 ? `${missingPlanAlerts.length} missing plan reminder(s)` : 'All plans set'}
                  className={`relative p-2 rounded-lg border transition-colors ${
                    missingPlanAlerts.length > 0
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  {missingPlanAlerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow">
                      {missingPlanAlerts.length}
                    </span>
                  )}
                </button>

                {notifDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-2xl z-50 space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                        Plan Reminders
                      </span>
                      <button
                        type="button"
                        onClick={enableBrowserNotifications}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                          browserNotificationsEnabled
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700'
                        }`}
                      >
                        {browserNotificationsEnabled ? 'Push Alerts: ON' : 'Enable Push Alerts'}
                      </button>
                    </div>

                    {missingPlanAlerts.length === 0 ? (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Today's plan and this week's plan are both locked in!</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {missingPlanAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2"
                          >
                            <div className="text-xs font-bold text-amber-400">{alert.title}</div>
                            <p className="text-[11px] text-slate-400 leading-snug">{alert.message}</p>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDate(todayDate);
                                setPlanningSubTab(alert.targetSubTab);
                                setNotifDropdownOpen(false);
                              }}
                              className="w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1"
                            >
                              <span>{alert.actionLabel}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Account / Supabase Auth Button */}
              <button
                onClick={() => setShowAuthModal(true)}
                title={authUser ? `Signed in as ${authUser.email}${isAdmin ? ' (Admin)' : ''}` : 'Sign In / Create Account'}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  authUser
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-slate-800/80 text-slate-200 border-slate-700 hover:border-amber-500/40'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span className="max-w-[140px] truncate">
                  {authUser
                    ? `Signed in (${authUser.displayName || authUser.email.split('@')[0]})`
                    : 'Sign In'}
                </span>
                {isAdmin && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-extrabold uppercase tracking-wider">
                    Admin
                  </span>
                )}
                {authUser && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      syncStatus === 'synced'
                        ? 'bg-emerald-400'
                        : syncStatus === 'syncing'
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-rose-400'
                    }`}
                  />
                )}
              </button>

              {/* Admin-Only Toolbar: Admin Console, Templates, Single-File Backup/Restore & Supabase DB */}
              {isAdmin && (
                <div className="flex items-center space-x-1 pl-2 border-l border-slate-800">
                  <button
                    onClick={() => setShowAdminModal(true)}
                    title="Admin Console (All-Users Backups, Restore, Templates & Reset)"
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 text-xs font-extrabold transition-colors whitespace-nowrap"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('templates')}
                    title="Template Manager (Admin Only)"
                    className={`p-2 rounded-lg transition-colors ${
                      activeTab === 'templates'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'
                    }`}
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleExport}
                    title="Download My Account Backup (.json File)"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    title="Upload / Restore Account Backup (.json File)"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowSupabaseModal(true)}
                    title="Supabase Cloud Sync (Admin Only)"
                    className="p-2 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                  >
                    <Database className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu trigger */}
            <div className="flex md:hidden items-center space-x-2">
              <button
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                className="relative p-1.5 rounded-lg bg-slate-800 text-amber-400"
                title="Plan Reminders"
              >
                <Bell className="w-4 h-4" />
                {missingPlanAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {missingPlanAlerts.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowAuthModal(true)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center space-x-1 ${
                  authUser
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-200'
                }`}
                title="Account"
              >
                <User className="w-3.5 h-3.5" />
                <span>{authUser ? 'Signed in' : 'Sign In'}</span>
              </button>
              <button
                onClick={onOpenQuickGWS}
                className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold text-xs"
              >
                + GWS
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-400 hover:text-slate-100"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 pt-2 pb-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isActive ? 'bg-amber-500/20 text-amber-400' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            {isAdmin && (
              <>
                <button
                  onClick={() => {
                    setActiveTab('templates');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    activeTab === 'templates' ? 'bg-amber-500/20 text-amber-400' : 'text-amber-300 hover:bg-slate-800'
                  }`}
                >
                  <Sliders className="w-5 h-5" />
                  <span>Template Manager (Admin)</span>
                </button>
                <button
                  onClick={() => {
                    setShowAdminModal(true);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-bold text-amber-300 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20"
                >
                  <Shield className="w-5 h-5" />
                  <span>Admin Console (All-Users Backups)</span>
                </button>
                <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-xs text-slate-400">
                  <button onClick={handleExport} className="flex items-center space-x-1 p-2 hover:text-slate-200">
                    <Download className="w-4 h-4" /> <span>Export .json</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowImportModal(true);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center space-x-1 p-2 hover:text-slate-200"
                  >
                    <Upload className="w-4 h-4" /> <span>Upload .json</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* Admin Console Modal */}
      {isAdmin && (
        <AdminModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          onOpenSupabaseSettings={() => setShowSupabaseModal(true)}
        />
      )}

      {/* Supabase Sync Modal (Admin Only) */}
      {isAdmin && (
        <SupabaseSyncModal
          isOpen={showSupabaseModal}
          onClose={() => setShowSupabaseModal(false)}
          onSyncNow={syncNow}
        />
      )}

      {/* Account Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onOpenAdminConsole={() => {
          setShowAuthModal(false);
          setShowAdminModal(true);
        }}
      />

      {/* Import Modal (Admin Only — supports single .json file upload or JSON paste) */}
      {isAdmin && showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-amber-400" />
                <span>Restore Account from Backup File</span>
              </h3>
              <p className="text-xs text-slate-400">
                Upload a single <code className="text-amber-300">.json</code> backup file from your computer (or paste JSON below) to restore this account. For restoring other users or an All-Users file, open the Admin Console.
              </p>
            </div>

            <input
              ref={importFileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) handleImportFileSelected(f);
              }}
            />

            <button
              type="button"
              onClick={() => importFileInputRef.current?.click()}
              className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-dashed border-amber-500/40 text-xs font-extrabold transition-colors"
            >
              <FileJson className="w-4 h-4 shrink-0" />
              <span>
                {importFileName
                  ? `Selected: ${importFileName} (click to change file)`
                  : 'Choose .json Backup File from Your Computer'}
              </span>
            </button>

            {importError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {importError}
              </div>
            )}

            <textarea
              value={importJsonText}
              onChange={(e) => {
                setImportJsonText(e.target.value);
                setImportFileName('');
                setImportError('');
              }}
              placeholder="Or paste backup JSON content here..."
              rows={6}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500/50 resize-none"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setShowAdminModal(true);
                }}
                className="text-xs font-bold text-purple-300 hover:text-purple-200"
              >
                Open All-Users Backup →
              </button>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFileName('');
                    setImportError('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportSubmit}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
                >
                  Restore Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
