import React, { createContext, useContext, useState, useEffect } from 'react';
import { Template, DailyEntry, GWSSession, WeeklyPlan, ReviewEntry, ThreeYearPlan, SystemLevel } from '../types/schema';
import { 
  DEFAULT_TEMPLATES, 
  INITIAL_DAILY_ENTRIES, 
  INITIAL_GWS_SESSIONS, 
  INITIAL_WEEKLY_PLANS,
  INITIAL_THREE_YEAR_PLAN
} from '../types/defaults';

export type MainTab = 'planning' | 'matrix' | 'gws' | 'review' | 'templates';
export type PlanningSubTab = 'daily' | 'weekly' | 'three_year';
export type ReviewSubTab = 'vault' | 'daily' | 'gws' | 'weekly';

interface StorageContextType {
  templates: Template[];
  dailyEntries: Record<string, DailyEntry>;
  gwsSessions: GWSSession[];
  weeklyPlans: Record<string, WeeklyPlan>;
  threeYearPlan: ThreeYearPlan;
  reviews: ReviewEntry[];
  selectedDate: string;
  selectedWeekId: string;
  activeTab: MainTab;
  planningSubTab: PlanningSubTab;
  reviewSubTab: ReviewSubTab;
  systemLevel: SystemLevel;
  setSystemLevel: (lvl: SystemLevel) => void;
  
  // Navigation
  setSelectedDate: (date: string) => void;
  setSelectedWeekId: (weekId: string) => void;
  setActiveTab: (tab: MainTab) => void;
  setPlanningSubTab: (subTab: PlanningSubTab) => void;
  setReviewSubTab: (subTab: ReviewSubTab) => void;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  goToToday: () => void;

  // Daily operations
  getEntryForDate: (date: string) => DailyEntry;
  saveDailyEntry: (date: string, updates: Partial<DailyEntry>) => void;
  
  // GWS operations
  addGWSSession: (session: Omit<GWSSession, 'id' | 'createdAt'>) => GWSSession;
  updateGWSSession: (id: string, updates: Partial<GWSSession>) => void;
  deleteGWSSession: (id: string) => void;
  
  // Weekly operations
  getWeeklyPlan: (weekId: string) => WeeklyPlan;
  saveWeeklyPlan: (plan: WeeklyPlan) => void;

  // 3-Year Plan operations
  saveThreeYearPlan: (plan: ThreeYearPlan) => void;
  
  // Template operations (Modularity)
  saveTemplate: (template: Template) => void;
  deleteTemplate: (id: string) => void;
  resetTemplatesToDefault: () => void;

  // Review operations
  saveReview: (review: ReviewEntry) => void;
  deleteReview: (id: string) => void;

  // Data portability
  exportData: () => string;
  importData: (jsonStr: string) => boolean;
  resetAllData: () => void;
}

const STORAGE_KEYS = {
  TEMPLATES: 'legio_templates_v1',
  DAILY: 'legio_daily_v1',
  GWS: 'legio_gws_v1',
  WEEKLY: 'legio_weekly_v1',
  THREE_YEAR: 'legio_three_year_v1',
  REVIEWS: 'legio_reviews_v1',
  SELECTED_DATE: 'legio_selected_date_v1',
  SYSTEM_LEVEL: 'legio_system_level_v1',
};

const StorageContext = createContext<StorageContextType | undefined>(undefined);

export const StorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial states from localStorage with fallbacks
  const [templates, setTemplates] = useState<Template[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
      return saved ? JSON.parse(saved) : DEFAULT_TEMPLATES;
    } catch {
      return DEFAULT_TEMPLATES;
    }
  });

  const [dailyEntries, setDailyEntries] = useState<Record<string, DailyEntry>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DAILY);
      return saved ? JSON.parse(saved) : INITIAL_DAILY_ENTRIES;
    } catch {
      return INITIAL_DAILY_ENTRIES;
    }
  });

  const [gwsSessions, setGwsSessions] = useState<GWSSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GWS);
      return saved ? JSON.parse(saved) : INITIAL_GWS_SESSIONS;
    } catch {
      return INITIAL_GWS_SESSIONS;
    }
  });

  const [weeklyPlans, setWeeklyPlans] = useState<Record<string, WeeklyPlan>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WEEKLY);
      return saved ? JSON.parse(saved) : INITIAL_WEEKLY_PLANS;
    } catch {
      return INITIAL_WEEKLY_PLANS;
    }
  });

  const [threeYearPlan, setThreeYearPlan] = useState<ThreeYearPlan>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THREE_YEAR);
      return saved ? JSON.parse(saved) : INITIAL_THREE_YEAR_PLAN;
    } catch {
      return INITIAL_THREE_YEAR_PLAN;
    }
  });

  const [reviews, setReviews] = useState<ReviewEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REVIEWS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_DATE);
      return saved || '2026-10-28';
    } catch {
      return '2026-10-28';
    }
  });

  const [selectedWeekId, setSelectedWeekIdState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('legio_selected_week_id');
      return saved || 'week_3';
    } catch {
      return 'week_3';
    }
  });

  const setSelectedWeekId = (weekId: string) => {
    setSelectedWeekIdState(weekId);
    try {
      localStorage.setItem('legio_selected_week_id', weekId);
    } catch (e) {
      console.error(e);
    }
  };

  // Progressive System Level (1 to 4)
  const [systemLevel, setSystemLevelState] = useState<SystemLevel>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SYSTEM_LEVEL);
      if (saved) {
        const parsed = parseInt(saved);
        if (parsed >= 1 && parsed <= 4) return parsed as SystemLevel;
      }
      return 3; // Default to Level 3 (includes Weekly Goal Crusher)
    } catch {
      return 3;
    }
  });

  const setSystemLevel = (lvl: SystemLevel) => {
    setSystemLevelState(lvl);
    try {
      localStorage.setItem(STORAGE_KEYS.SYSTEM_LEVEL, String(lvl));
    } catch (e) {
      console.error(e);
    }
  };

  // Parse initial route from hash
  const parseHash = (): { main: MainTab; planningSub: PlanningSubTab; reviewSub: ReviewSubTab } => {
    const raw = window.location.hash.replace('#', '');
    const parts = raw.split('/');
    const p1 = parts[0];
    const p2 = parts[1];

    if (p1 === 'planning') {
      const sub = (p2 === 'weekly' || p2 === 'three_year' || p2 === '3year') 
        ? (p2 === '3year' ? 'three_year' : p2 as PlanningSubTab) 
        : 'daily';
      return { main: 'planning', planningSub: sub, reviewSub: 'daily' };
    }
    if (p1 === 'matrix' || p1 === 'spreadsheet') {
      return { main: 'matrix', planningSub: 'daily', reviewSub: 'daily' };
    }
    if (p1 === 'review') {
      const sub = (p2 === 'daily' || p2 === 'gws' || p2 === 'weekly') ? p2 as ReviewSubTab : 'vault';
      return { main: 'review', planningSub: 'daily', reviewSub: sub };
    }
    if (p1 === 'gws') return { main: 'gws', planningSub: 'daily', reviewSub: 'daily' };
    if (p1 === 'templates') return { main: 'templates', planningSub: 'daily', reviewSub: 'daily' };
    
    // Legacy support
    if (p1 === 'daily') return { main: 'planning', planningSub: 'daily', reviewSub: 'daily' };
    if (p1 === 'weekly') return { main: 'planning', planningSub: 'weekly', reviewSub: 'weekly' };

    return { main: 'planning', planningSub: 'daily', reviewSub: 'daily' };
  };

  const initialRoute = parseHash();
  const [activeTab, setActiveTabState] = useState<MainTab>(initialRoute.main);
  const [planningSubTab, setPlanningSubTabState] = useState<PlanningSubTab>(initialRoute.planningSub);
  const [reviewSubTab, setReviewSubTabState] = useState<ReviewSubTab>(initialRoute.reviewSub);

  const setActiveTab = (tab: MainTab) => {
    setActiveTabState(tab);
    if (tab === 'planning') {
      window.location.hash = `planning/${planningSubTab}`;
    } else if (tab === 'matrix') {
      window.location.hash = 'matrix';
    } else if (tab === 'review') {
      window.location.hash = `review/${reviewSubTab}`;
    } else {
      window.location.hash = tab;
    }
  };

  const setPlanningSubTab = (sub: PlanningSubTab) => {
    setPlanningSubTabState(sub);
    setActiveTabState('planning');
    window.location.hash = `planning/${sub}`;
  };

  const setReviewSubTab = (sub: ReviewSubTab) => {
    setReviewSubTabState(sub);
    setActiveTabState('review');
    window.location.hash = `review/${sub}`;
  };

  useEffect(() => {
    const handleHash = () => {
      const parsed = parseHash();
      setActiveTabState(parsed.main);
      setPlanningSubTabState(parsed.planningSub);
      setReviewSubTabState(parsed.reviewSub);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
    } catch (e) {
      console.error('Failed to save templates', e);
    }
  }, [templates]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DAILY, JSON.stringify(dailyEntries));
    } catch (e) {
      console.error('Failed to save daily entries', e);
    }
  }, [dailyEntries]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GWS, JSON.stringify(gwsSessions));
    } catch (e) {
      console.error('Failed to save GWS sessions', e);
    }
  }, [gwsSessions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WEEKLY, JSON.stringify(weeklyPlans));
    } catch (e) {
      console.error('Failed to save weekly plans', e);
    }
  }, [weeklyPlans]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.THREE_YEAR, JSON.stringify(threeYearPlan));
    } catch (e) {
      console.error('Failed to save 3-year plan', e);
    }
  }, [threeYearPlan]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));
    } catch (e) {
      console.error('Failed to save reviews', e);
    }
  }, [reviews]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SELECTED_DATE, selectedDate);
    } catch (e) {
      console.error('Failed to save selected date', e);
    }
  }, [selectedDate]);

  // Helper date calculations
  const shiftDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const goToPreviousDay = () => shiftDate(-1);
  const goToNextDay = () => shiftDate(1);
  const goToToday = () => {
    setSelectedDate('2026-10-28');
  };

  const getEntryForDate = (date: string): DailyEntry => {
    if (dailyEntries[date]) {
      return dailyEntries[date];
    }
    return {
      date,
      templateId: 'tpl_daily_default',
      mainTasksCompleted: 0,
      mainTasksTotal: 3,
      executionScore: 0,
      automaticTasksCompleted: false,
      planNotes: '',
      gwsSessionIds: [],
      reviewNotes: '',
      customFieldValues: {},
      updatedAt: new Date().toISOString()
    };
  };

  const saveDailyEntry = (date: string, updates: Partial<DailyEntry>) => {
    setDailyEntries(prev => {
      const existing = prev[date] || getEntryForDate(date);
      const merged: DailyEntry = {
        ...existing,
        ...updates,
        date,
        updatedAt: new Date().toISOString()
      };
      return {
        ...prev,
        [date]: merged
      };
    });
  };

  const addGWSSession = (sessionData: Omit<GWSSession, 'id' | 'createdAt'>): GWSSession => {
    const newSession: GWSSession = {
      ...sessionData,
      id: `gws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString()
    };

    setGwsSessions(prev => [newSession, ...prev]);

    setDailyEntries(prev => {
      const existing = prev[sessionData.date] || getEntryForDate(sessionData.date);
      const updatedIds = Array.from(new Set([...existing.gwsSessionIds, newSession.id]));
      return {
        ...prev,
        [sessionData.date]: {
          ...existing,
          gwsSessionIds: updatedIds,
          updatedAt: new Date().toISOString()
        }
      };
    });

    return newSession;
  };

  const updateGWSSession = (id: string, updates: Partial<GWSSession>) => {
    setGwsSessions(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const deleteGWSSession = (id: string) => {
    setGwsSessions(prev => prev.filter(s => s.id !== id));
    setDailyEntries(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(date => {
        if (next[date].gwsSessionIds.includes(id)) {
          next[date] = {
            ...next[date],
            gwsSessionIds: next[date].gwsSessionIds.filter(sessionId => sessionId !== id)
          };
        }
      });
      return next;
    });
  };

  const getWeeklyPlan = (weekId: string): WeeklyPlan => {
    if (weeklyPlans[weekId]) return weeklyPlans[weekId];
    return {
      id: weekId,
      weekNumber: parseInt(weekId.replace('week_', '')) || 1,
      startDate: '2026-10-26',
      endDate: '2026-11-01',
      focusTheme: 'Weekly Execution Focus',
      notes: '',
      tasks: [],
      totalPossibleScore: 10,
      achievedScore: 0,
      rewards: [
        { id: 'r1', minScore: 6, reward: 'Tier 1 reward' },
        { id: 'r2', minScore: 7, reward: 'Tier 2 reward' },
        { id: 'r3', minScore: 8, reward: 'Tier 3 reward' },
        { id: 'r4', minScore: 9, reward: 'Tier 4 reward' },
        { id: 'r5', minScore: 10, reward: 'Tier 5 reward' }
      ],
      updatedAt: new Date().toISOString()
    };
  };

  const saveWeeklyPlan = (plan: WeeklyPlan) => {
    setWeeklyPlans(prev => ({
      ...prev,
      [plan.id]: {
        ...plan,
        updatedAt: new Date().toISOString()
      }
    }));
  };

  const saveThreeYearPlan = (plan: ThreeYearPlan) => {
    setThreeYearPlan({
      ...plan,
      updatedAt: new Date().toISOString()
    });
  };

  const saveTemplate = (template: Template) => {
    setTemplates(prev => {
      const idx = prev.findIndex(t => t.id === template.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...template, updatedAt: new Date().toISOString() };
        return next;
      }
      return [...prev, { ...template, updatedAt: new Date().toISOString() }];
    });
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const resetTemplatesToDefault = () => {
    setTemplates(DEFAULT_TEMPLATES);
  };

  const saveReview = (review: ReviewEntry) => {
    setReviews(prev => {
      const idx = prev.findIndex(r => r.id === review.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = review;
        return next;
      }
      return [review, ...prev];
    });
  };

  const deleteReview = (id: string) => {
    setReviews(prev => prev.filter(r => r.id !== id));
  };

  const exportData = (): string => {
    const data = {
      templates,
      dailyEntries,
      gwsSessions,
      weeklyPlans,
      threeYearPlan,
      reviews,
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  };

  const importData = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.templates) setTemplates(parsed.templates);
      if (parsed.dailyEntries) setDailyEntries(parsed.dailyEntries);
      if (parsed.gwsSessions) setGwsSessions(parsed.gwsSessions);
      if (parsed.weeklyPlans) setWeeklyPlans(parsed.weeklyPlans);
      if (parsed.threeYearPlan) setThreeYearPlan(parsed.threeYearPlan);
      if (parsed.reviews) setReviews(parsed.reviews);
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  };

  const resetAllData = () => {
    setTemplates(DEFAULT_TEMPLATES);
    setDailyEntries(INITIAL_DAILY_ENTRIES);
    setGwsSessions(INITIAL_GWS_SESSIONS);
    setWeeklyPlans(INITIAL_WEEKLY_PLANS);
    setThreeYearPlan(INITIAL_THREE_YEAR_PLAN);
    setReviews([]);
    setSelectedDate('2026-10-28');
  };

  return (
    <StorageContext.Provider
      value={{
        templates,
        dailyEntries,
        gwsSessions,
        weeklyPlans,
        threeYearPlan,
        reviews,
        selectedDate,
        selectedWeekId,
        activeTab,
        planningSubTab,
        reviewSubTab,
        systemLevel,
        setSystemLevel,
        setSelectedDate,
        setSelectedWeekId,
        setActiveTab,
        setPlanningSubTab,
        setReviewSubTab,
        goToPreviousDay,
        goToNextDay,
        goToToday,
        getEntryForDate,
        saveDailyEntry,
        addGWSSession,
        updateGWSSession,
        deleteGWSSession,
        getWeeklyPlan,
        saveWeeklyPlan,
        saveThreeYearPlan,
        saveTemplate,
        deleteTemplate,
        resetTemplatesToDefault,
        saveReview,
        deleteReview,
        exportData,
        importData,
        resetAllData
      }}
    >
      {children}
    </StorageContext.Provider>
  );
};

export const useStorage = () => {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  return context;
};
