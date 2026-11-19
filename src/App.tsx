import React, { useState } from 'react';
import { StorageProvider, useStorage } from './context/StorageContext';
import { Navbar } from './components/common/Navbar';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PlanningHub } from './components/planning/PlanningHub';
import { GWSStudio } from './components/gws/GWSStudio';
import { ReviewHub } from './components/review/ReviewHub';
import { TemplateManager } from './components/templates/TemplateManager';
import { SpreadsheetMatrixView } from './components/matrix/SpreadsheetMatrixView';
import { ChecklistView } from './components/checklist/ChecklistView';
import { X, Shield } from 'lucide-react';

const MainContent: React.FC = () => {
  const { activeTab, setActiveTab, setPlanningSubTab, isAdmin } = useStorage();
  const [isQuickGWSOpen, setIsQuickGWSOpen] = useState(false);

  const recoverToDaily = () => {
    setPlanningSubTab('daily');
    setActiveTab('planning');
  };

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">

      {/* Top Navbar */}
      <Navbar onOpenQuickGWS={() => setIsQuickGWSOpen(true)} />

      {/* Main View Area (isolated by ErrorBoundary per tab so one error never blanks the app) */}
      <main className="flex-1 pb-16">
        {activeTab === 'planning' && (
          <ErrorBoundary key="planning" label="Planning Hub" onReset={recoverToDaily}>
            <PlanningHub
              onOpenGWS={() => setIsQuickGWSOpen(true)}
              onCustomizeTemplate={() => setActiveTab('templates')}
            />
          </ErrorBoundary>
        )}
        {activeTab === 'checklist' && (
          <ErrorBoundary key="checklist" label="Checklist" onReset={recoverToDaily}>
            <ChecklistView />
          </ErrorBoundary>
        )}
        {activeTab === 'matrix' && (
          <ErrorBoundary key="matrix" label="Weeks Matrix" onReset={recoverToDaily}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <SpreadsheetMatrixView />
            </div>
          </ErrorBoundary>
        )}
        {activeTab === 'gws' && (
          <ErrorBoundary key="gws" label="GWS Studio" onReset={recoverToDaily}>
            <GWSStudio />
          </ErrorBoundary>
        )}
        {activeTab === 'review' && (
          <ErrorBoundary key="review" label="Review Hub" onReset={recoverToDaily}>
            <ReviewHub />
          </ErrorBoundary>
        )}
        {activeTab === 'templates' && (
          <ErrorBoundary key="templates" label="Template Manager" onReset={recoverToDaily}>
            {isAdmin ? (
              <TemplateManager />
            ) : (
              <div className="max-w-xl mx-auto px-4 py-16">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-100">Admin Access Required</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Template customization is restricted to the workspace administrator. Sign in with the admin account to edit card templates.
                  </p>
                  <button
                    type="button"
                    onClick={recoverToDaily}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-colors"
                  >
                    Return to Daily Plan
                  </button>
                </div>
              </div>
            )}
          </ErrorBoundary>
        )}
      </main>

      {/* Quick GWS Sprint Modal - Fixed against flexbox center clipping */}
      {isQuickGWSOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md p-3 sm:p-6 flex justify-center items-start">
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl p-5 sm:p-8 shadow-2xl my-4 sm:my-8 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setIsQuickGWSOpen(false)}
              className="sticky top-0 float-right z-20 p-2 rounded-xl bg-slate-950/90 hover:bg-slate-800 text-slate-400 hover:text-slate-100 border border-slate-800 shadow-md backdrop-blur-sm transition-colors mb-2"
              title="Close GWS Modal"
            >
              <X className="w-5 h-5" />
            </button>
            <ErrorBoundary label="Quick GWS Modal" onReset={() => setIsQuickGWSOpen(false)}>
              <GWSStudio isModal onClose={() => setIsQuickGWSOpen(false)} />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* Minimal Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-slate-400 uppercase tracking-widest text-[10px]">
              LEGIO
            </span>
            <span>•</span>
            <span>Unified Planning Hub • GWS Studio • Unified Review Hub</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Offline-first • Zero Latency • Complete Template Modularity
          </div>
        </div>
      </footer>

    </div>
  );
};

export const App: React.FC = () => {
  return (
    <StorageProvider>
      <MainContent />
    </StorageProvider>
  );
};

export default App;
