import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Template, DailyEntry, DailyPriorityItem, GWSSession, WeeklyPlan, ReviewEntry, ThreeYearPlan, SystemLevel } from '../types/schema';
import { 
  DEFAULT_TEMPLATES, 
  INITIAL_DAILY_ENTRIES, 
  INITIAL_GWS_SESSIONS, 
  INITIAL_WEEKLY_PLANS,
  INITIAL_THREE_YEAR_PLAN
} from '../types/defaults';
import {
  getSupabaseClient,
  getRememberDevicePreference,
  setRememberDevicePreference,
  REMEMBERED_USER_CACHE_KEY
} from '../lib/supabase';

export type MainTab = 'planning' | 'matrix' | 'gws' | 'review' | 'templates';
export type PlanningSubTab = 'daily' | 'weekly' | 'three_year';
export type ReviewSubTab = 'vault' | 'daily' | 'gws' | 'weekly' | 'monthly' | 'quarterly';

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

const ONBOARDING_EPOCH_KEY = 'legio_onboarding_start_v1';

export const getEffectiveEpochMonday = (plans?: Record<string, WeeklyPlan>): string => {
  if (plans && plans['week_1']?.startDate) {
    return plans['week_1'].startDate;
  }
  try {
    const saved = localStorage.getItem(ONBOARDING_EPOCH_KEY);
    if (saved) return saved;
  } catch {
    // ignore
  }
  return '2026-10-12';
};

// Calculate sequential week number anchored at the user's Week 1 Monday
export const getWeekNumberForDate = (dateStr: string, epochStartStr?: string): number => {
  const range = getCurrentWeekRange(dateStr);
  const baseEpoch = epochStartStr || getEffectiveEpochMonday();
  const epochMonday = new Date(`${baseEpoch}T12:00:00`);
  const targetMonday = new Date(`${range.startDate}T12:00:00`);
  const diffDays = Math.round((targetMonday.getTime() - epochMonday.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
};

// Get exact Monday–Sunday range for a given sequential week number
export const getWeekRangeForWeekNumber = (weekNumber: number, epochStartStr?: string): { startDate: string; endDate: string; days: string[] } => {
  const baseEpoch = epochStartStr || getEffectiveEpochMonday();
  const epochMonday = new Date(`${baseEpoch}T12:00:00`);
  epochMonday.setDate(epochMonday.getDate() + (Math.max(1, weekNumber) - 1) * 7);
  const yyyy = epochMonday.getFullYear();
  const mm = String(epochMonday.getMonth() + 1).padStart(2, '0');
  const dd = String(epochMonday.getDate()).padStart(2, '0');
  return getCurrentWeekRange(`${yyyy}-${mm}-${dd}`);
};

// Structured Daily Priority helpers (ID-based sync + full planNotes compatibility)
export const getPriorityItemsForEntry = (entry?: DailyEntry): DailyPriorityItem[] => {
  if (!entry) return [];
  if (Array.isArray(entry.priorityItems) && entry.priorityItems.length > 0) {
    return entry.priorityItems;
  }
  if (!entry.planNotes || !entry.planNotes.trim()) {
    return [];
  }
  return entry.planNotes
    .split('\n')
    .map((line, idx) => {
      let cleaned = line.replace(/^[0-9]+[\.\)\s]+/, '').trim();
      let completed = false;
      if (cleaned.startsWith('[x] ') || cleaned.startsWith('[X] ')) {
        completed = true;
        cleaned = cleaned.slice(4).trim();
      } else if (cleaned.startsWith('[ ] ')) {
        cleaned = cleaned.slice(4).trim();
      }
      return {
        id: `prio_${entry.date}_${idx}`,
        text: cleaned,
        completed
      };
    })
    .filter(item => item.text.length > 0);
};

export const formatPriorityItemsToPlanNotes = (items: DailyPriorityItem[]): string => {
  return items
    .filter(item => item.text.trim().length > 0)
    .map((item, idx) => `${idx + 1} ${item.completed ? '[x] ' : ''}${item.text.trim()}`)
    .join('\n');
};

// Ensure all weeks from Week 1 up to the highest week / target date exist without any gaps
export const ensureContinuousWeeks = (
  plans: Record<string, WeeklyPlan>,
  targetDateStr: string = getTodayDateString(),
  epochOverride?: string
): Record<string, WeeklyPlan> => {
  const next = { ...plans };
  const epochMonday = epochOverride || getEffectiveEpochMonday(next);
  const targetWeekNum = getWeekNumberForDate(targetDateStr, epochMonday);
  const existingNums = Object.values(next).map(p => p.weekNumber);
  const maxWeekNum = Math.max(targetWeekNum, ...(existingNums.length > 0 ? existingNums : [1]));

  for (let w = 1; w <= maxWeekNum; w++) {
    const weekId = `week_${w}`;
    if (!next[weekId]) {
      const range = getWeekRangeForWeekNumber(w, epochMonday);
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

export interface MissingPlanAlert {
  id: 'missing_daily' | 'missing_weekly';
  title: string;
  message: string;
  actionLabel: string;
  targetSubTab: 'daily' | 'weekly';
}

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

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

  // Notifications
  missingPlanAlerts: MissingPlanAlert[];
  browserNotificationsEnabled: boolean;
  enableBrowserNotifications: () => Promise<boolean>;

  // Auth & Cloud Sync (Supabase)
  authUser: AuthUser | null;
  rememberDevice: boolean;
  setRememberDevice: (remember: boolean) => void;
  syncStatus: SyncStatus;
  syncError: string | null;
  signIn: (email: string, password: string, remember?: boolean) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string, displayName?: string, keepLocalData?: boolean, remember?: boolean) => Promise<{ ok: boolean; error?: string; needsEmailConfirm?: boolean }>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  startFreshWorkspace: () => void;
  
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
  SYSTEM_LEVEL: 'legio_system_level_v2',
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

  // Automatically create a new week whenever todayDate enters a new calendar week
  useEffect(() => {
    setWeeklyPlans(prev => ensureContinuousWeeks(prev, todayDate));
  }, [todayDate]);

  // Progressive System Level (1 to 5)
  const [systemLevel, setSystemLevelState] = useState<SystemLevel>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SYSTEM_LEVEL);
      if (saved) {
        const parsed = parseInt(saved);
        if (parsed >= 1 && parsed <= 5) return parsed as SystemLevel;
      }
      return 4; // Default to Level 4 (includes Monthly & Quarterly Macro Reviews)
    } catch {
      return 4;
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
      const sub = (p2 === 'daily' || p2 === 'gws' || p2 === 'weekly' || p2 === 'monthly' || p2 === 'quarterly')
        ? (p2 as ReviewSubTab)
        : 'vault';
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
    try {
      localStorage.setItem(ONBOARDING_EPOCH_KEY, '2026-10-12');
    } catch {
      // ignore
    }
    setTemplates(DEFAULT_TEMPLATES);
    setDailyEntries(INITIAL_DAILY_ENTRIES);
    setGwsSessions(INITIAL_GWS_SESSIONS);
    setWeeklyPlans(ensureContinuousWeeks(INITIAL_WEEKLY_PLANS, nowStr, '2026-10-12'));
    setThreeYearPlan(INITIAL_THREE_YEAR_PLAN);
    setReviews([]);
    setTodayDate(nowStr);
    setSelectedDateState(nowStr);
  };

  const buildFreshPayload = () => {
    const nowStr = getTodayDateString();
    const currentRange = getCurrentWeekRange(nowStr);
    // New accounts start at THEIR own Week 1 on the current calendar week!
    const freshWeekId = 'week_1';
    try {
      localStorage.setItem(ONBOARDING_EPOCH_KEY, currentRange.startDate);
    } catch {
      // ignore
    }
    return {
      onboardingStartDate: currentRange.startDate,
      templates: DEFAULT_TEMPLATES,
      dailyEntries: {} as Record<string, DailyEntry>,
      gwsSessions: [] as GWSSession[],
      weeklyPlans: {
        [freshWeekId]: {
          id: freshWeekId,
          weekNumber: 1,
          startDate: currentRange.startDate,
          endDate: currentRange.endDate,
          focusTheme: '',
          notes: '',
          tasks: [],
          totalPossibleScore: 10,
          achievedScore: 0,
          rewards: [],
          updatedAt: new Date().toISOString()
        }
      } as Record<string, WeeklyPlan>,
      threeYearPlan: {
        id: 'plan_3yr_core',
        vision: '',
        targetHorizon: '2026 — 2029',
        strategyCore: '',
        pillars: [],
        updatedAt: new Date().toISOString()
      } as ThreeYearPlan,
      reviews: [] as ReviewEntry[],
      systemLevel: 4 as SystemLevel
    };
  };

  // Start a clean blank workspace (used for new friend accounts or fresh start)
  const startFreshWorkspace = () => {
    const nowStr = getTodayDateString();
    const fresh = buildFreshPayload();
    const freshWeekId = Object.keys(fresh.weeklyPlans)[0];
    setTemplates(fresh.templates);
    setDailyEntries(fresh.dailyEntries);
    setGwsSessions(fresh.gwsSessions);
    setWeeklyPlans(fresh.weeklyPlans);
    setThreeYearPlan(fresh.threeYearPlan);
    setReviews(fresh.reviews);
    setTodayDate(nowStr);
    setSelectedDateState(nowStr);
    setSelectedWeekIdState(freshWeekId);
  };

  // --- MISSING PLAN NOTIFICATIONS (Daily + Weekly) ---
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('legio_browser_notifs') === 'true';
    } catch {
      return false;
    }
  });

  const todayEntryForAlerts = dailyEntries[todayDate];
  const hasTodayPlan = !!(todayEntryForAlerts && todayEntryForAlerts.planNotes && todayEntryForAlerts.planNotes.trim().length > 0);

  const currentWeekNumForAlerts = getWeekNumberForDate(todayDate);
  const currentWeekRangeForAlerts = getCurrentWeekRange(todayDate);
  const currentWeekPlanForAlerts =
    Object.values(weeklyPlans).find(p => p.startDate <= todayDate && todayDate <= p.endDate) ||
    weeklyPlans[`week_${currentWeekNumForAlerts}`];
  const hasCurrentWeekPlan = !!(
    currentWeekPlanForAlerts &&
    (currentWeekPlanForAlerts.tasks.length > 0 || currentWeekPlanForAlerts.focusTheme.trim().length > 0)
  );

  const missingPlanAlerts: MissingPlanAlert[] = [];
  if (!hasTodayPlan) {
    missingPlanAlerts.push({
      id: 'missing_daily',
      title: "Today's Plan Isn't Made",
      message: `No priorities set yet for today (${todayDate}). Lock in your Day Mission.`,
      actionLabel: 'Plan Today',
      targetSubTab: 'daily'
    });
  }
  if (systemLevel >= 3 && !hasCurrentWeekPlan) {
    missingPlanAlerts.push({
      id: 'missing_weekly',
      title: `Week ${currentWeekNumForAlerts} Plan Isn't Made`,
      message: `Set your weekly focus & deliverables for ${currentWeekRangeForAlerts.startDate} → ${currentWeekRangeForAlerts.endDate}.`,
      actionLabel: `Plan Week ${currentWeekNumForAlerts}`,
      targetSubTab: 'weekly'
    });
  }

  const enableBrowserNotifications = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      setBrowserNotificationsEnabled(true);
      localStorage.setItem('legio_browser_notifs', 'true');
      return true;
    }
    const perm = await Notification.requestPermission();
    const granted = perm === 'granted';
    setBrowserNotificationsEnabled(granted);
    localStorage.setItem('legio_browser_notifs', granted ? 'true' : 'false');
    if (granted && missingPlanAlerts.length > 0) {
      new Notification('Legio Flow Reminder', {
        body: missingPlanAlerts.map(a => a.title).join(' • ')
      });
    }
    return granted;
  };

  // Fire native browser notification once per day if enabled & plans are missing
  useEffect(() => {
    if (!browserNotificationsEnabled || missingPlanAlerts.length === 0) return;
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
    const notifKey = `legio_notified_${todayDate}_${missingPlanAlerts.map(a => a.id).join('_')}`;
    if (localStorage.getItem(notifKey)) return;
    try {
      new Notification('Legio Flow — Plan Reminder', {
        body: missingPlanAlerts.map(a => a.message).join('\n')
      });
      localStorage.setItem(notifKey, '1');
    } catch {
      // Ignore browser notification restrictions
    }
  }, [browserNotificationsEnabled, todayDate, missingPlanAlerts.length]);

  // --- SUPABASE AUTH & MULTI-USER CLOUD SYNC ---
  const [rememberDevice, setRememberDeviceState] = useState<boolean>(() => getRememberDevicePreference());
  const setRememberDevice = (remember: boolean) => {
    setRememberDeviceState(remember);
    setRememberDevicePreference(remember);
  };

  const [authUser, setAuthUserState] = useState<AuthUser | null>(() => {
    // Immediately restore remembered user on startup so UI says "Signed in" with zero flash
    if (!getRememberDevicePreference()) return null;
    try {
      const cached = localStorage.getItem(REMEMBERED_USER_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const setAuthUser = (user: AuthUser | null) => {
    setAuthUserState(user);
    try {
      if (user && getRememberDevicePreference()) {
        localStorage.setItem(REMEMBERED_USER_CACHE_KEY, JSON.stringify(user));
      } else if (!user) {
        localStorage.removeItem(REMEMBERED_USER_CACHE_KEY);
      }
    } catch {
      // ignore
    }
  };

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const isHydratingFromCloudRef = useRef(false);

  const buildCloudPayload = () => ({
    onboardingStartDate: getEffectiveEpochMonday(weeklyPlans),
    templates,
    dailyEntries,
    gwsSessions,
    weeklyPlans,
    threeYearPlan,
    reviews,
    systemLevel
  });

  const applyCloudPayload = (state: any) => {
    if (!state || typeof state !== 'object') return;
    isHydratingFromCloudRef.current = true;
    const cloudEpoch = state.onboardingStartDate || state.weeklyPlans?.['week_1']?.startDate || '2026-10-12';
    try {
      localStorage.setItem(ONBOARDING_EPOCH_KEY, cloudEpoch);
    } catch {
      // ignore
    }
    if (Array.isArray(state.templates)) setTemplates(state.templates);
    if (state.dailyEntries) setDailyEntries(state.dailyEntries);
    if (Array.isArray(state.gwsSessions)) setGwsSessions(state.gwsSessions);
    if (state.weeklyPlans) setWeeklyPlans(ensureContinuousWeeks(state.weeklyPlans, getTodayDateString(), cloudEpoch));
    if (state.threeYearPlan) setThreeYearPlan(state.threeYearPlan);
    if (Array.isArray(state.reviews)) setReviews(state.reviews);
    if (state.systemLevel >= 1 && state.systemLevel <= 5) {
      // Auto-upgrade legacy default 3 to 4 so Monthly & Quarterly Reviews are unlocked automatically
      const nextLvl = state.systemLevel === 3 && !localStorage.getItem(STORAGE_KEYS.SYSTEM_LEVEL) ? 4 : state.systemLevel;
      setSystemLevelState(nextLvl as SystemLevel);
    }
    setTimeout(() => {
      isHydratingFromCloudRef.current = false;
    }, 300);
  };

  const loadUserCloudState = async (userId: string, initialPayloadOverride?: any) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const { data, error } = await supabase
        .from('legio_user_state')
        .select('state, display_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        setSyncStatus('error');
        setSyncError(error.message);
        return;
      }

      if (data && data.state) {
        applyCloudPayload(data.state);
        setSyncStatus('synced');
      } else {
        // First time this user has no cloud row yet -> push initial workspace (fresh or local)
        const payloadToPush = initialPayloadOverride || buildCloudPayload();
        if (initialPayloadOverride) {
          applyCloudPayload(initialPayloadOverride);
        }
        const { error: upsertErr } = await supabase
          .from('legio_user_state')
          .upsert({
            user_id: userId,
            state: payloadToPush,
            updated_at: new Date().toISOString()
          });
        if (upsertErr) {
          setSyncStatus('error');
          setSyncError(upsertErr.message);
        } else {
          setSyncStatus('synced');
        }
      }
    } catch (err: any) {
      setSyncStatus('error');
      setSyncError(err?.message || 'Unable to reach Supabase');
    }
  };

  // Subscribe to Supabase auth session on mount
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSyncStatus('offline');
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      const u = data?.session?.user;
      if (u) {
        setAuthUser({
          id: u.id,
          email: u.email || '',
          displayName: u.user_metadata?.display_name
        });
        loadUserCloudState(u.id);
      }
    }).catch(() => {
      setSyncStatus('offline');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      if (u) {
        setAuthUser({
          id: u.id,
          email: u.email || '',
          displayName: u.user_metadata?.display_name
        });
      } else {
        setAuthUser(null);
        setSyncStatus('idle');
      }
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Debounced auto-save to Supabase whenever workspace data changes while signed in
  useEffect(() => {
    if (!authUser || isHydratingFromCloudRef.current) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const timer = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        const { error } = await supabase
          .from('legio_user_state')
          .upsert({
            user_id: authUser.id,
            display_name: authUser.displayName || authUser.email,
            state: buildCloudPayload(),
            updated_at: new Date().toISOString()
          });
        if (error) {
          setSyncStatus('error');
          setSyncError(error.message);
        } else {
          setSyncStatus('synced');
          setSyncError(null);
        }
      } catch (err: any) {
        setSyncStatus('error');
        setSyncError(err?.message || 'Sync failed');
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [authUser, templates, dailyEntries, gwsSessions, weeklyPlans, threeYearPlan, reviews, systemLevel]);

  const formatSupabaseError = (msg?: string): string => {
    if (!msg) return 'Could not reach Supabase.';
    if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
      return 'Cannot reach Supabase server (Failed to fetch). Your Supabase project (hdpqwpkktxzrcrprtyxq) may be paused — open your Supabase Dashboard and click "Restore project".';
    }
    return msg;
  };

  const signIn = async (email: string, password: string, remember = true) => {
    setRememberDevice(remember);
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase client is not configured.' };
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { ok: false, error: formatSupabaseError(error.message) };
      if (data.user) {
        setAuthUser({
          id: data.user.id,
          email: data.user.email || email,
          displayName: data.user.user_metadata?.display_name
        });
        await loadUserCloudState(data.user.id);
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: formatSupabaseError(err?.message) };
    }
  };

  const signUp = async (email: string, password: string, displayName?: string, keepLocalData = false, remember = true) => {
    setRememberDevice(remember);
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase client is not configured.' };
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName?.trim() || email.split('@')[0] }
        }
      });
      if (error) return { ok: false, error: formatSupabaseError(error.message) };
      const freshOverride = !keepLocalData ? buildFreshPayload() : undefined;
      if (freshOverride) {
        applyCloudPayload(freshOverride);
      }
      if (data.user && data.session) {
        setAuthUser({
          id: data.user.id,
          email: data.user.email || email,
          displayName: displayName?.trim() || email.split('@')[0]
        });
        await loadUserCloudState(data.user.id, freshOverride);
        return { ok: true };
      }
      return { ok: true, needsEmailConfirm: true };
    } catch (err: any) {
      return { ok: false, error: formatSupabaseError(err?.message) };
    }
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setAuthUser(null);
    setSyncStatus('idle');
    setSyncError(null);
    startFreshWorkspace();
  };

  const syncNow = async () => {
    if (!authUser) return;
    await loadUserCloudState(authUser.id);
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
        missingPlanAlerts,
        browserNotificationsEnabled,
        enableBrowserNotifications,
        authUser,
        rememberDevice,
        setRememberDevice,
        syncStatus,
        syncError,
        signIn,
        signUp,
        signOut,
        syncNow,
        startFreshWorkspace,
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
