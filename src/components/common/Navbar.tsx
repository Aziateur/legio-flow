import React, { useState } from 'react';
import { useStorage } from '../../context/StorageContext';
import { 
  Calendar, 
  Timer, 
  Target, 
  TrendingUp, 
  Sliders, 
  Compass,
  Download, 
  Upload, 
  RotateCcw, 
  Sparkles,
  Flame,
  CheckCircle2,
  Menu,
  X,
  Database,
  Copy,
  Check
} from 'lucide-react';
import { SupabaseSyncModal } from './SupabaseSyncModal';

export const Navbar: React.FC<{ onOpenQuickGWS: () => void }> = ({ onOpenQuickGWS }) => {
  const { 
    activeTab, 
    setActiveTab, 
    selectedDate, 
    gwsSessions, 
    dailyEntries,
    systemLevel,
    setSystemLevel,
    exportData, 
    importData, 
    resetAllData 
  } = useStorage();

  const [levelDropdownOpen, setLevelDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [copiedAllSuccess, setCopiedAllSuccess] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState('');

  const handleCopyAllToClipboard = () => {
    const json = exportData();
    navigator.clipboard.writeText(json);
    setCopiedAllSuccess(true);
    setTimeout(() => setCopiedAllSuccess(false), 2000);
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
    a.href = url;
    a.download = `legio_flow_backup_${selectedDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = () => {
    if (!importJsonText.trim()) return;
    const ok = importData(importJsonText);
    if (ok) {
      setShowImportModal(false);
      setImportJsonText('');
      setImportError('');
      alert('Data imported successfully!');
    } else {
      setImportError('Invalid JSON format. Please verify the backup file.');
    }
  };

  // Filter nav tabs according to selected progressive system level (1 to 4)
  const allNavItems = [
    { id: 'planning' as const, label: 'Planning Hub', icon: Compass, minLevel: 1 },
    { id: 'matrix' as const, label: 'Weeks Matrix', icon: Calendar, minLevel: 3 },
    { id: 'gws' as const, label: 'GWS Studio', icon: Timer, minLevel: 2 },
    { id: 'review' as const, label: 'Review Hub', icon: TrendingUp, minLevel: 1 },
    { id: 'templates' as const, label: 'Modular Templates', icon: Sliders, minLevel: 1 },
  ];

  const navItems = allNavItems.filter(item => systemLevel >= item.minLevel);

  const levelDescriptions = {
    1: { name: 'Level 1: Basic Flow', desc: 'Daily checklist, mission plan & daily review' },
    2: { name: 'Level 2: Deep Work', desc: 'Adds GWS cockpit, stopwatch & reflexions' },
    3: { name: 'Level 3: Goal Crusher', desc: 'Adds Weekly Goal Crusher (10 Pts) & Weeks Matrix' },
    4: { name: 'Level 4: Mastery 3-Year', desc: 'Adds 3-Year Strategic Roadmap & Macro Reviews' }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-[64px] py-2">
            
            {/* Brand Logo & Title */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('planning')}>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/40">
                <Sparkles className="w-5 h-5 text-slate-950 font-bold" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-lg tracking-wider text-slate-100 uppercase">
                    LEGIO <span className="text-amber-400">FLOW</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Modular OS
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">Daily Execution • GWS • Course Correction</p>
              </div>
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
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Quick Metrics & Actions */}
            <div className="hidden lg:flex items-center space-x-2.5">
              
              {/* Level Selector Dropdown Pill */}
              <div className="relative">
                <button
                  onClick={() => setLevelDropdownOpen(!levelDropdownOpen)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all shadow-sm"
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
                    {([1, 2, 3, 4] as const).map((lvl) => (
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
              {/* Today's quick execution badge */}
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Today: <strong className="text-slate-100">{todayEntry ? `${todayEntry.executionScore}/10` : '—'}</strong></span>
                <span className="text-slate-600">|</span>
                <span>GWS: <strong className="text-slate-100">{totalGwsHours}h</strong></span>
              </div>

              {/* Start GWS Button */}
              <button
                onClick={onOpenQuickGWS}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 active:scale-95"
              >
                <Timer className="w-3.5 h-3.5" />
                <span>+ GWS Sprint</span>
              </button>

              {/* Data Export / Import / Copy / Supabase Menu */}
              <div className="flex items-center space-x-1 pl-2 border-l border-slate-800">
                <button
                  onClick={() => setShowSupabaseModal(true)}
                  title="Supabase Cloud Sync"
                  className="p-2 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                >
                  <Database className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCopyAllToClipboard}
                  title="Copy Entire Backup to Clipboard"
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  {copiedAllSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleExport}
                  title="Export Backup (JSON)"
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  title="Import Backup"
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Reset to initial sample data from your prompt?')) {
                      resetAllData();
                    }
                  }}
                  title="Reset to Sample Data"
                  className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mobile menu trigger */}
            <div className="flex md:hidden items-center space-x-2">
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
            <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-xs text-slate-400">
              <button onClick={handleExport} className="flex items-center space-x-1 p-2 hover:text-slate-200">
                <Download className="w-4 h-4" /> <span>Export JSON</span>
              </button>
              <button onClick={() => { setShowImportModal(true); setMobileMenuOpen(false); }} className="flex items-center space-x-1 p-2 hover:text-slate-200">
                <Upload className="w-4 h-4" /> <span>Import JSON</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Supabase Sync Modal */}
      <SupabaseSyncModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
      />

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-2 flex items-center space-x-2">
              <Upload className="w-5 h-5 text-amber-400" />
              <span>Import Legio Flow Backup</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Paste JSON backup content below to restore your templates, daily records, GWS sessions, and weekly plans.
            </p>
            {importError && (
              <div className="mb-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {importError}
              </div>
            )}
            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste JSON content here..."
              rows={8}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500/50 resize-none mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowImportModal(false);
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
      )}
    </>
  );
};
