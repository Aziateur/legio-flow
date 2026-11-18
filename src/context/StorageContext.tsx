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

export const getTodayDateString = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const getCurrentWeekRange = (baseDateStr?: string): { startDate: string; endDate: string; days: string[] } => {
  const base = baseDateStr ? new Date(`${baseDateStr}T12:00:00`) : new Date();
  const dayOfWeek = base.getDay(); // 0 (Sun) to 6 (Sat)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMonday);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    days.push(`${yyyy}-${mm}-${dd}`);
  }

  return {
    startDate: days[0],
    endDate: days[6],
    days
  };
};

// Calculate sequential week number anchored at Week 1 Monday (2026-10-12)
export const getWeekNumberForDate = (dateStr: string): number => {
  const range = getCurrentWeekRange(dateStr);
  const epochMonday = new Date('2026-10-12T12:00:00');
  const targetMonday = new Date(`${range.startDate}T12:00:00`);
  const diffDays = Math.round((targetMonday.getTime() - epochMonday.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
};

// Get exact Monday–Sunday range for a given sequential week number (Week 1 = 2026-10-12 → 2026-10-18)
export const getWeekRangeForWeekNumber = (weekNumber: number): { startDate: string; endDate: string; days: string[] } => {
  const epochMonday = new Date('2026-10-12T12:00:00');
  epochMonday.setDate(epochMonday.getDate() + (Math.max(1, weekNumber) - 1) * 7);
  const yyyy = epochMonday.getFullYear();
  const mm = String(epochMonday.getMonth() + 1).padStart(2, '0');
  const dd = String(epochMonday.getDate()).padStart(2, '0');
  return getCurrentWeekRange(`${yyyy}-${mm}-${dd}`);
};

// Ensure all weeks from Week 1 up to the highest week / target date exist without any gaps
export const ensureContinuousWeeks = (
  plans: Record<string, WeeklyPlan>,
  targetDateStr: string = getTodayDateString()
): Record<string, WeeklyPlan> => {
  const next = { ...plans };
  const targetWeekNum = getWeekNumberForDate(targetDateStr);
  const existingNums = Object.values(next).map(p => p.weekNumber);
  const maxWeekNum = Math.max(targetWeekNum, ...(existingNums.length > 0 ? existingNums : [1]));

  for (let w = 1; w <= maxWeekNum; w++) {
    const weekId = `week_${w}`;
    if (!next[weekId]) {
      const range = getWeekRangeForWeekNumber(w);
      next[weekId] = {
        id: weekId,
        weekNumber: w,
        startDate: range.startDate,
        endDate: range.endDate,
        focusTheme: '',
        notes: '',
        tasks: [],
        totalPossibleScore: 10,
        achievedScore: 0,
        rewards: [],
        updatedAt: new Date().toISOString()
      };
    }
  }
  return next;
};

interface StorageContextType {
  templates: Template[];
  dailyEntries: Record<string, DailyEntry>;
  gwsSessions: GWSSession[];
  weeklyPlans: Record<string, WeeklyPlan>;
  threeYearPlan: ThreeYearPlan;
  reviews: ReviewEntry[];
  todayDate: string;
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
      const base = saved ? JSON.parse(saved) : INITIAL_WEEKLY_PLANS;
      return ensureContinuousWeeks(base, getTodayDateString());
    } catch {
      return ensureContinuousWeeks(INITIAL_WEEKLY_PLANS, getTodayDateString());
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

  const [todayDate, setTodayDate] = useState<string>(() => getTodayDateString());

  // Always start on the real current date when opening the app, and follow calendar rollover
  const [selectedDate, setSelectedDateState] = useState<string>(() => getTodayDateString());

  // Resolve or auto-create a WeeklyPlan matching any given date
  const resolveWeekForDate = (dateStr: string, currentPlans: Record<string, WeeklyPlan>): { weekId: string; createdPlan?: WeeklyPlan } => {
    const range = getCurrentWeekRange(dateStr);
    // 1. Check if any existing plan covers this date range
    const existingByRange = Object.values(currentPlans).find(
      p => p.startDate <= dateStr && dateStr <= p.endDate
    );
    if (existingByRange) {
      return { weekId: existingByRange.id };
    }

    // 2. Otherwise compute sequential week number & ID
    const weekNum = getWeekNumberForDate(dateStr);
    const weekId = `week_${weekNum}`;
    if (currentPlans[weekId]) {
      return { weekId };
    }

    // 3. Create a clean blank WeeklyPlan for this calendar week
    const newPlan: WeeklyPlan = {
      id: weekId,
      weekNumber: weekNum,
      startDate: range.startDate,
      endDate: range.endDate,
      focusTheme: '',
      notes: '',
      tasks: [],
      totalPossibleScore: 10,
      achievedScore: 0,
      rewards: [],
      updatedAt: new Date().toISOString()
    };
    return { weekId, createdPlan: newPlan };
  };

  const [selectedWeekId, setSelectedWeekIdState] = useState<string>(() => {
    const initialDate = getTodayDateString();
    const weekNum = getWeekNumberForDate(initialDate);
    return `week_${weekNum}`;
  });

  // Ensure all weeks up to selectedDate exist continuously and selectedWeekId stays synced
  useEffect(() => {
    const { weekId, createdPlan } = resolveWeekForDate(selectedDate, weeklyPlans);
    setWeeklyPlans(prev => {
      const withTarget = createdPlan ? { ...prev, [weekId]: createdPlan } : prev;
      return ensureContinuousWeeks(withTarget, selectedDate);
    });
    if (selectedWeekId !== weekId) {
      setSelectedWeekIdState(weekId);
      try {
        localStorage.setItem('legio_selected_week_id', weekId);
      } catch (e) {
        console.error(e);
      }
    }
  }, [selectedDate]);

  // Setting selectedDate automatically syncs selectedWeekId via the effect above
  const setSelectedDate = (date: string) => {
    setSelectedDateState(date);
  };

  // Setting selectedWeekId also aligns selectedDate into that week if outside its Mon-Sun range
  const setSelectedWeekId = (weekId: string) => {
    setSelectedWeekIdState(weekId);
    try {
      localStorage.setItem('legio_selected_week_id', weekId);
    } catch (e) {
      console.error(e);
    }
    const targetPlan = weeklyPlans[weekId];
    if (targetPlan && targetPlan.startDate && targetPlan.endDate) {
      if (selectedDate < targetPlan.startDate || selectedDate > targetPlan.endDate) {
        if (todayDate >= targetPlan.startDate && todayDate <= targetPlan.endDate) {
          setSelectedDateState(todayDate);
        } else {
          setSelectedDateState(targetPlan.startDate);
        }
      }
    }
  };

  useEffect(() => {
    const syncCurrentDate = () => {
      const currentRealDate = getTodayDateString();
      setTodayDate(prevToday => {
        if (prevToday !== currentRealDate) {
          // If the user was viewing "today" and the clock rolled past midnight, advance selectedDate automatically
          setSelectedDateState(prevSelected => (prevSelected === prevToday ? currentRealDate : prevSelected));
          return currentRealDate;
        }
        return prevToday;
      });
    };

    const interval = setInterval(syncCurrentDate, 30000);
    window.addEventListener('focus', syncCurrentDate);
    document.addEventListener('visibilitychange', syncCurrentDate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncCurrentDate);
      document.removeEventListener('visibilitychange', syncCurrentDate);
    };
  }, []);

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

  // Helper date calculations (using noon local time to avoid DST/UTC offset bugs)
  const shiftDate = (days: number) => {
    const current = new Date(`${selectedDate}T12:00:00`);
    current.setDate(current.getDate() + days);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const goToPreviousDay = () => shiftDate(-1);
  const goToNextDay = () => shiftDate(1);
  const goToToday = () => {
    const nowStr = getTodayDateString();
    setTodayDate(nowStr);
    setSelectedDate(nowStr);
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
    const nowStr = getTodayDateString();
    setTemplates(DEFAULT_TEMPLATES);
    setDailyEntries(INITIAL_DAILY_ENTRIES);
    setGwsSessions(INITIAL_GWS_SESSIONS);
    setWeeklyPlans(ensureContinuousWeeks(INITIAL_WEEKLY_PLANS, nowStr));
    setThreeYearPlan(INITIAL_THREE_YEAR_PLAN);
    setReviews([]);
    setTodayDate(nowStr);
    setSelectedDateState(nowStr);
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
        todayDate,
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
