import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Template,
  DailyEntry,
  DailyPriorityItem,
  GWSSession,
  ActiveGWSTimer,
  WeeklyPlan,
  MonthlyPlan,
  YearlyPlan,
  TaskItem,
  ReviewEntry,
  SystemLevel,
  ChecklistCategory,
  ChecklistItem
} from '../types/schema';
import {
  DEFAULT_TEMPLATES,
  INITIAL_DAILY_ENTRIES,
  INITIAL_GWS_SESSIONS,
  INITIAL_WEEKLY_PLANS,
  INITIAL_MONTHLY_PLANS,
  INITIAL_YEARLY_PLANS,
  INITIAL_CHECKLIST_CATEGORIES,
  INITIAL_CHECKLIST_ITEMS
} from '../types/defaults';
import {
  getSupabaseClient,
  getSupabaseCredentials,
  getRememberDevicePreference,
  setRememberDevicePreference,
  REMEMBERED_USER_CACHE_KEY,
  isAdminEmail,
  AdminUserStateRow
} from '../lib/supabase';

export type MainTab = 'planning' | 'checklist' | 'matrix' | 'gws' | 'review' | 'templates';
export type PlanningSubTab = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'matrix';
export type ReviewSubTab = 'vault' | 'daily' | 'gws' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

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
const LAST_ACTIVE_TODAY_KEY = 'legio_last_active_today_v1';
const LAST_MUTATION_AT_KEY = 'legio_last_mutation_at_v1';
const PENDING_CLOUD_PUSH_KEY = 'legio_pending_cloud_push_v1';
const LAST_CLOUD_USER_ID_KEY = 'legio_last_cloud_user_id_v1';
const SELECTED_WEEK_ID_KEY = 'legio_selected_week_id';
const EMPTY_WEEK_TIMESTAMP = '1970-01-01T00:00:00.000Z';

const readStorageSafe = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorageSafe = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to persist ${key}`, e);
  }
};

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
export const getWeekRangeForWeekNumber = (
  weekNumber: number,
  epochStartStr?: string
): { startDate: string; endDate: string; days: string[] } => {
  const baseEpoch = epochStartStr || getEffectiveEpochMonday();
  const epochMonday = new Date(`${baseEpoch}T12:00:00`);
  epochMonday.setDate(epochMonday.getDate() + (Math.max(1, weekNumber) - 1) * 7);
  const yyyy = epochMonday.getFullYear();
  const mm = String(epochMonday.getMonth() + 1).padStart(2, '0');
  const dd = String(epochMonday.getDate()).padStart(2, '0');
  return getCurrentWeekRange(`${yyyy}-${mm}-${dd}`);
};

const hasWeeklyPlanContent = (plan?: WeeklyPlan): boolean =>
  !!(
    plan &&
    ((plan.tasks && plan.tasks.length > 0) ||
      (plan.focusTheme && plan.focusTheme.trim().length > 0) ||
      (plan.winsNotes && plan.winsNotes.trim().length > 0) ||
      (plan.problemsEncountered && plan.problemsEncountered.trim().length > 0) ||
      (plan.courseCorrectionNotes && plan.courseCorrectionNotes.trim().length > 0) ||
      (plan.reviewNotes && plan.reviewNotes.trim().length > 0) ||
      (plan.rewards && plan.rewards.length > 0))
  );

// Resolve the best WeeklyPlan whose Mon–Sun range covers dateStr (preferring populated plans)
export const findBestWeeklyPlanForDate = (
  dateStr: string,
  plans: Record<string, WeeklyPlan>,
  preferredWeekId?: string
): WeeklyPlan | undefined => {
  const candidates = Object.values(plans).filter(
    p => p.startDate <= dateStr && dateStr <= p.endDate
  );
  if (candidates.length === 0) return undefined;

  const populated = candidates.filter(hasWeeklyPlanContent);
  const pool = populated.length > 0 ? populated : candidates;

  if (preferredWeekId) {
    const preferred = pool.find(p => p.id === preferredWeekId);
    if (preferred) return preferred;
  }

  return [...pool].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
};

// Parse numbered/checkbox lines from planNotes into structured DailyPriorityItem rows, preserving ID links
export const parsePlanNotesToPriorityItems = (
  date: string,
  planNotes: string,
  existingItems?: DailyPriorityItem[]
): DailyPriorityItem[] => {
  if (!planNotes || !planNotes.trim()) return [];
  const pool = (existingItems || []).filter(i => i && typeof i.text === 'string' && i.text.trim().length > 0);
  const usedIndices = new Set<number>();

  return planNotes
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
      if (!cleaned) return null;

      const norm = cleaned.toLowerCase();
      let matchIdx = pool.findIndex(
        (item, pIdx) => !usedIndices.has(pIdx) && item.text.trim().toLowerCase() === norm
      );
      if (matchIdx === -1 && idx < pool.length && !usedIndices.has(idx)) {
        matchIdx = idx;
      }
      const matched = matchIdx >= 0 ? pool[matchIdx] : undefined;
      if (matchIdx >= 0) usedIndices.add(matchIdx);

      return {
        id: matched?.id || `prio_${date}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        text: cleaned,
        completed,
        ...(matched?.weeklyTaskId ? { weeklyTaskId: matched.weeklyTaskId } : {}),
        ...(matched?.subTaskId ? { subTaskId: matched.subTaskId } : {})
      } as DailyPriorityItem;
    })
    .filter((item): item is DailyPriorityItem => item !== null);
};

// Structured Daily Priority helpers (filters empty placeholder slots + full planNotes compatibility)
export const getPriorityItemsForEntry = (entry?: DailyEntry): DailyPriorityItem[] => {
  if (!entry) return [];
  if (Array.isArray(entry.priorityItems)) {
    const clean = entry.priorityItems.filter(
      item => item && typeof item.text === 'string' && item.text.trim().length > 0
    );
    if (clean.length > 0) return clean;
  }
  if (!entry.planNotes || !entry.planNotes.trim()) {
    return [];
  }
  return parsePlanNotesToPriorityItems(entry.date, entry.planNotes);
};

export const formatPriorityItemsToPlanNotes = (items: DailyPriorityItem[]): string => {
  return items
    .filter(item => item && typeof item.text === 'string' && item.text.trim().length > 0)
    .map((item, idx) => `${idx + 1} ${item.completed ? '[x] ' : ''}${item.text.trim()}`)
    .join('\n');
};

export const computeWeeklyAchievedScore = (tasks: TaskItem[]): number => {
  const raw = tasks.reduce((acc, t) => {
    const pts = t.score || 0;
    if (t.completed) return acc + pts;
    if (t.subTasks && t.subTasks.length > 0) {
      const doneSubs = t.subTasks.filter(s => s.completed).length;
      return acc + (doneSubs / t.subTasks.length) * pts;
    }
    return acc;
  }, 0);
  return Math.round(raw * 10) / 10;
};

// Ensure all weeks from Week 1 up to the highest week / target date exist without any gaps
export const ensureContinuousWeeks = (
  plans: Record<string, WeeklyPlan>,
  targetDateStr: string = getTodayDateString(),
  epochOverride?: string
): Record<string, WeeklyPlan> => {
  const epochMonday = epochOverride || getEffectiveEpochMonday(plans);
  const targetWeekNum = getWeekNumberForDate(targetDateStr, epochMonday);
  const existingNums = Object.values(plans).map(p => p.weekNumber);
  const maxWeekNum = Math.max(targetWeekNum, ...(existingNums.length > 0 ? existingNums : [1]));

  let changed = false;
  const next = { ...plans };

  for (let w = 1; w <= maxWeekNum; w++) {
    const weekId = `week_${w}`;
    if (!next[weekId]) {
      changed = true;
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
        updatedAt: EMPTY_WEEK_TIMESTAMP
      };
    }
  }
  return changed ? next : plans;
};

const normalizeDailyEntryFields = (date: string, entry: DailyEntry): DailyEntry => {
  const cleanItems = getPriorityItemsForEntry({ ...entry, date });
  if (cleanItems.length > 0) {
    return {
      ...entry,
      date,
      priorityItems: cleanItems,
      planNotes: formatPriorityItemsToPlanNotes(cleanItems),
      mainTasksCompleted: cleanItems.filter(i => i.completed).length,
      mainTasksTotal: Math.max(entry.mainTasksTotal || 3, cleanItems.length)
    };
  }
  return {
    ...entry,
    date,
    priorityItems: [],
    planNotes: '',
    mainTasksCompleted: entry.mainTasksCompleted || 0,
    mainTasksTotal: Math.max(3, entry.mainTasksTotal || 3)
  };
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
  monthlyPlans: Record<string, MonthlyPlan>;
  yearlyPlans: Record<string, YearlyPlan>;
  reviews: ReviewEntry[];
  checklistCategories: ChecklistCategory[];
  checklistItems: ChecklistItem[];
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
  isAdmin: boolean;
  rememberDevice: boolean;
  setRememberDevice: (remember: boolean) => void;
  syncStatus: SyncStatus;
  syncError: string | null;
  signIn: (email: string, password: string, remember?: boolean) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string, displayName?: string, keepLocalData?: boolean, remember?: boolean) => Promise<{ ok: boolean; error?: string; needsEmailConfirm?: boolean }>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  startFreshWorkspace: () => void;

  // Admin-only cloud backup & restore
  adminListAllUsers: () => Promise<{
    ok: boolean;
    users: AdminUserStateRow[];
    error?: string;
    needsSqlSetup?: boolean;
  }>;
  adminRestoreUserState: (params: {
    userId?: string;
    email?: string;
    displayName?: string;
    state: Record<string, any>;
  }) => Promise<{
    ok: boolean;
    restoredUserId?: string;
    restoredEmail?: string;
    error?: string;
    needsSqlSetup?: boolean;
  }>;

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
  activeGwsTimer: ActiveGWSTimer | null;
  updateActiveGwsTimer: (
    updater: ActiveGWSTimer | null | ((prev: ActiveGWSTimer | null) => ActiveGWSTimer | null)
  ) => void;
  clearActiveGwsTimer: () => void;
  addGWSSession: (session: Omit<GWSSession, 'id' | 'createdAt'>) => GWSSession;
  updateGWSSession: (id: string, updates: Partial<GWSSession>) => void;
  deleteGWSSession: (id: string) => void;

  // Weekly operations
  getWeeklyPlan: (weekId: string) => WeeklyPlan;
  saveWeeklyPlan: (plan: WeeklyPlan) => void;

  // Monthly operations
  getMonthlyPlan: (monthKey: string) => MonthlyPlan;
  saveMonthlyPlan: (plan: MonthlyPlan) => void;

  // Yearly operations
  getYearlyPlan: (yearKey: string) => YearlyPlan;
  saveYearlyPlan: (plan: YearlyPlan) => void;

  // Template operations (Modularity)
  saveTemplate: (template: Template) => void;
  deleteTemplate: (id: string) => void;
  resetTemplatesToDefault: () => void;

  // Review operations
  saveReview: (review: ReviewEntry) => void;
  deleteReview: (id: string) => void;

  // Checklist operations
  saveChecklistCategories: (cats: ChecklistCategory[]) => void;
  saveChecklistItems: (items: ChecklistItem[]) => void;

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
  MONTHLY: 'legio_monthly_plans_v1',
  YEARLY: 'legio_yearly_plans_v1',
  REVIEWS: 'legio_reviews_v1',
  CHECKLIST_CATEGORIES: 'legio_checklist_cats_v1',
  CHECKLIST_ITEMS: 'legio_checklist_items_v1',
  SELECTED_DATE: 'legio_selected_date_v1',
  SYSTEM_LEVEL: 'legio_system_level_v3',
  ACTIVE_GWS_TIMER: 'legio_active_gws_timer_v1'
};

const StorageContext = createContext<StorageContextType | undefined>(undefined);

const readStoredAccessToken = (): string | null => {
  try {
    const raw =
      localStorage.getItem('legio_flow_auth_token_v1') ||
      sessionStorage.getItem('legio_flow_auth_token_v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || parsed?.currentSession?.access_token || null;
  } catch {
    return null;
  }
};

export const StorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial states from localStorage with fallbacks
  const [templates, setTemplates] = useState<Template[]>(() =>
    readStorageSafe(STORAGE_KEYS.TEMPLATES, DEFAULT_TEMPLATES)
  );

  const [dailyEntries, setDailyEntries] = useState<Record<string, DailyEntry>>(() => {
    const raw = readStorageSafe<Record<string, DailyEntry>>(STORAGE_KEYS.DAILY, INITIAL_DAILY_ENTRIES);
    const cleaned: Record<string, DailyEntry> = {};
    Object.entries(raw).forEach(([d, entry]) => {
      cleaned[d] = normalizeDailyEntryFields(d, entry);
    });
    return cleaned;
  });

  const [gwsSessions, setGwsSessions] = useState<GWSSession[]>(() =>
    readStorageSafe(STORAGE_KEYS.GWS, INITIAL_GWS_SESSIONS)
  );

  const [activeGwsTimer, setActiveGwsTimerState] = useState<ActiveGWSTimer | null>(() =>
    readStorageSafe<ActiveGWSTimer | null>(STORAGE_KEYS.ACTIVE_GWS_TIMER, null)
  );
  const activeGwsTimerRef = useRef<ActiveGWSTimer | null>(activeGwsTimer);

  const updateActiveGwsTimer = (
    updater: ActiveGWSTimer | null | ((prev: ActiveGWSTimer | null) => ActiveGWSTimer | null)
  ) => {
    const next = typeof updater === 'function' ? updater(activeGwsTimerRef.current) : updater;
    activeGwsTimerRef.current = next;
    try {
      if (next) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_GWS_TIMER, JSON.stringify(next));
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_GWS_TIMER);
      }
    } catch {
      // ignore
    }
    setActiveGwsTimerState(next);
  };

  const clearActiveGwsTimer = () => {
    updateActiveGwsTimer(null);
  };

  const [weeklyPlans, setWeeklyPlans] = useState<Record<string, WeeklyPlan>>(() => {
    const base = readStorageSafe<Record<string, WeeklyPlan>>(STORAGE_KEYS.WEEKLY, INITIAL_WEEKLY_PLANS);
    return ensureContinuousWeeks(base, getTodayDateString());
  });

  const [monthlyPlans, setMonthlyPlans] = useState<Record<string, MonthlyPlan>>(() => {
    const raw = readStorageSafe<Record<string, MonthlyPlan>>(STORAGE_KEYS.MONTHLY, INITIAL_MONTHLY_PLANS);
    const cleaned: Record<string, MonthlyPlan> = {};
    Object.entries(raw || {}).forEach(([k, p]) => {
      cleaned[k] = {
        id: p?.id || k,
        monthKey: p?.monthKey || k,
        focusTheme: p?.focusTheme || '',
        notes: p?.notes || '',
        tasks: Array.isArray(p?.tasks) ? p.tasks : [],
        updatedAt: p?.updatedAt || EMPTY_WEEK_TIMESTAMP
      };
    });
    return cleaned;
  });

  const [yearlyPlans, setYearlyPlans] = useState<Record<string, YearlyPlan>>(() => {
    const raw = readStorageSafe<Record<string, YearlyPlan>>(STORAGE_KEYS.YEARLY, INITIAL_YEARLY_PLANS);
    const cleaned: Record<string, YearlyPlan> = {};
    Object.entries(raw || {}).forEach(([k, p]) => {
      cleaned[k] = {
        id: p?.id || k,
        yearKey: p?.yearKey || k,
        focusTheme: p?.focusTheme || '',
        notes: p?.notes || '',
        tasks: Array.isArray(p?.tasks) ? p.tasks : [],
        updatedAt: p?.updatedAt || EMPTY_WEEK_TIMESTAMP
      };
    });
    return cleaned;
  });

  const [reviews, setReviews] = useState<ReviewEntry[]>(() =>
    readStorageSafe<ReviewEntry[]>(STORAGE_KEYS.REVIEWS, [])
  );

  const [checklistCategories, setChecklistCategories] = useState<ChecklistCategory[]>(() =>
    readStorageSafe(STORAGE_KEYS.CHECKLIST_CATEGORIES, INITIAL_CHECKLIST_CATEGORIES)
  );

  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(() =>
    readStorageSafe(STORAGE_KEYS.CHECKLIST_ITEMS, INITIAL_CHECKLIST_ITEMS)
  );

  const [todayDate, setTodayDate] = useState<string>(() => getTodayDateString());

  // Preserve selectedDate across same-day reloads; jump to real today when a new day starts
  const [selectedDate, setSelectedDateState] = useState<string>(() => {
    const realToday = getTodayDateString();
    try {
      const lastActiveToday = localStorage.getItem(LAST_ACTIVE_TODAY_KEY);
      const savedSelected = localStorage.getItem(STORAGE_KEYS.SELECTED_DATE);
      if (lastActiveToday === realToday && savedSelected && /^\d{4}-\d{2}-\d{2}$/.test(savedSelected)) {
        return savedSelected;
      }
    } catch {
      // ignore
    }
    return realToday;
  });

  const [selectedWeekId, setSelectedWeekIdState] = useState<string>(() => {
    const realToday = getTodayDateString();
    try {
      const lastActiveToday = localStorage.getItem(LAST_ACTIVE_TODAY_KEY);
      const savedWeek = localStorage.getItem(SELECTED_WEEK_ID_KEY);
      if (lastActiveToday === realToday && savedWeek && weeklyPlans[savedWeek]) {
        return savedWeek;
      }
    } catch {
      // ignore
    }
    const matched = findBestWeeklyPlanForDate(selectedDate, weeklyPlans);
    if (matched) return matched.id;
    return `week_${getWeekNumberForDate(selectedDate, getEffectiveEpochMonday(weeklyPlans))}`;
  });

  // Progressive System Level (1 to 5)
  const [systemLevel, setSystemLevelState] = useState<SystemLevel>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SYSTEM_LEVEL);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 1 && parsed <= 5) return parsed as SystemLevel;
      }
      return 5;
    } catch {
      return 5;
    }
  });

  // Authoritative synchronous state refs (prevents stale closures & ensures immediate local/cloud saves)
  const templatesRef = useRef(templates);
  const dailyEntriesRef = useRef(dailyEntries);
  const gwsSessionsRef = useRef(gwsSessions);
  const weeklyPlansRef = useRef(weeklyPlans);
  const monthlyPlansRef = useRef(monthlyPlans);
  const yearlyPlansRef = useRef(yearlyPlans);
  const reviewsRef = useRef(reviews);
  const checklistCategoriesRef = useRef(checklistCategories);
  const checklistItemsRef = useRef(checklistItems);
  const systemLevelRef = useRef(systemLevel);
  const selectedDateRef = useRef(selectedDate);
  const selectedWeekIdRef = useRef(selectedWeekId);

  selectedDateRef.current = selectedDate;
  selectedWeekIdRef.current = selectedWeekId;

  // --- SUPABASE AUTH & SYNC STATE ---
  const [rememberDevice, setRememberDeviceState] = useState<boolean>(() => getRememberDevicePreference());
  const setRememberDevice = (remember: boolean) => {
    setRememberDeviceState(remember);
    setRememberDevicePreference(remember);
  };

  const [authUser, setAuthUserState] = useState<AuthUser | null>(() => {
    if (!getRememberDevicePreference()) return null;
    try {
      const cached = localStorage.getItem(REMEMBERED_USER_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const authUserRef = useRef<AuthUser | null>(authUser);
  const isAdmin = Boolean(authUser?.email && isAdminEmail(authUser.email));
  const accessTokenRef = useRef<string | null>(readStoredAccessToken());
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPushingRef = useRef(false);
  const queuedPushRef = useRef(false);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const setAuthUser = (user: AuthUser | null) => {
    const prev = authUserRef.current;
    const isSame =
      prev === user ||
      (prev && user && prev.id === user.id && prev.email === user.email && prev.displayName === user.displayName);

    try {
      if (user && getRememberDevicePreference()) {
        localStorage.setItem(REMEMBERED_USER_CACHE_KEY, JSON.stringify(user));
      } else if (!user) {
        localStorage.removeItem(REMEMBERED_USER_CACHE_KEY);
      }
    } catch {
      // ignore
    }

    if (isSame) return;
    authUserRef.current = user;
    setAuthUserState(user);
  };

  // --- SYNCHRONOUS COMMIT HELPERS ---
  const commitTemplates = (next: Template[]) => {
    templatesRef.current = next;
    writeStorageSafe(STORAGE_KEYS.TEMPLATES, next);
    setTemplates(next);
  };

  const commitDailyEntries = (next: Record<string, DailyEntry>) => {
    dailyEntriesRef.current = next;
    writeStorageSafe(STORAGE_KEYS.DAILY, next);
    setDailyEntries(next);
  };

  const commitGwsSessions = (next: GWSSession[]) => {
    gwsSessionsRef.current = next;
    writeStorageSafe(STORAGE_KEYS.GWS, next);
    setGwsSessions(next);
  };

  const commitWeeklyPlans = (next: Record<string, WeeklyPlan>) => {
    weeklyPlansRef.current = next;
    writeStorageSafe(STORAGE_KEYS.WEEKLY, next);
    setWeeklyPlans(next);
  };

  const commitMonthlyPlans = (next: Record<string, MonthlyPlan>) => {
    monthlyPlansRef.current = next;
    writeStorageSafe(STORAGE_KEYS.MONTHLY, next);
    setMonthlyPlans(next);
  };

  const commitYearlyPlans = (next: Record<string, YearlyPlan>) => {
    yearlyPlansRef.current = next;
    writeStorageSafe(STORAGE_KEYS.YEARLY, next);
    setYearlyPlans(next);
  };

  const commitReviews = (next: ReviewEntry[]) => {
    reviewsRef.current = next;
    writeStorageSafe(STORAGE_KEYS.REVIEWS, next);
    setReviews(next);
  };

  const commitChecklistCategories = (next: ChecklistCategory[]) => {
    checklistCategoriesRef.current = next;
    writeStorageSafe(STORAGE_KEYS.CHECKLIST_CATEGORIES, next);
    setChecklistCategories(next);
  };

  const commitChecklistItems = (next: ChecklistItem[]) => {
    checklistItemsRef.current = next;
    writeStorageSafe(STORAGE_KEYS.CHECKLIST_ITEMS, next);
    setChecklistItems(next);
  };

  const commitSystemLevel = (lvl: SystemLevel) => {
    systemLevelRef.current = lvl;
    try {
      localStorage.setItem(STORAGE_KEYS.SYSTEM_LEVEL, String(lvl));
    } catch (e) {
      console.error(e);
    }
    setSystemLevelState(lvl);
  };

  const buildCloudPayloadFromRefs = (clientUpdatedAtOverride?: string) => {
    let clientUpdatedAt = clientUpdatedAtOverride || '';
    if (!clientUpdatedAt) {
      try {
        clientUpdatedAt = localStorage.getItem(LAST_MUTATION_AT_KEY) || '';
      } catch {
        // ignore
      }
    }
    if (!clientUpdatedAt) {
      clientUpdatedAt = new Date().toISOString();
    }
    return {
      onboardingStartDate: getEffectiveEpochMonday(weeklyPlansRef.current),
      templates: templatesRef.current,
      dailyEntries: dailyEntriesRef.current,
      gwsSessions: gwsSessionsRef.current,
      weeklyPlans: weeklyPlansRef.current,
      monthlyPlans: monthlyPlansRef.current,
      yearlyPlans: yearlyPlansRef.current,
      reviews: reviewsRef.current,
      checklistCategories: checklistCategoriesRef.current,
      checklistItems: checklistItemsRef.current,
      systemLevel: systemLevelRef.current,
      clientUpdatedAt
    };
  };

  const flushCloudPushNow = async () => {
    const user = authUserRef.current;
    if (!user) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    if (isPushingRef.current) {
      queuedPushRef.current = true;
      return;
    }

    isPushingRef.current = true;
    queuedPushRef.current = false;
    setSyncStatus('syncing');

    let snapshotMutationAt = '';
    try {
      snapshotMutationAt = localStorage.getItem(LAST_MUTATION_AT_KEY) || '';
    } catch {
      // ignore
    }
    if (!snapshotMutationAt) {
      snapshotMutationAt = new Date().toISOString();
    }

    try {
      const payload = buildCloudPayloadFromRefs(snapshotMutationAt);
      const { error } = await supabase
        .from('legio_user_state')
        .upsert({
          user_id: user.id,
          display_name: user.displayName || user.email,
          state: payload,
          updated_at: new Date().toISOString()
        });

      if (error) {
        setSyncStatus('error');
        setSyncError(error.message);
      } else {
        setSyncStatus('synced');
        setSyncError(null);
        try {
          const latestMutation = localStorage.getItem(LAST_MUTATION_AT_KEY) || '';
          if (!queuedPushRef.current && (!latestMutation || latestMutation === snapshotMutationAt)) {
            localStorage.setItem(PENDING_CLOUD_PUSH_KEY, 'false');
          }
          localStorage.setItem(LAST_CLOUD_USER_ID_KEY, user.id);
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      setSyncStatus('error');
      setSyncError(err?.message || 'Sync failed');
    } finally {
      isPushingRef.current = false;
      if (queuedPushRef.current) {
        queuedPushRef.current = false;
        void flushCloudPushNow();
      }
    }
  };

  const scheduleImmediateCloudPush = () => {
    if (!authUserRef.current) return;
    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
    }
    // 50ms micro-coalesce so rapid updates batch into one push and persist virtually instantaneously
    pushTimerRef.current = setTimeout(() => {
      pushTimerRef.current = null;
      void flushCloudPushNow();
    }, 50);
  };

  const markLocalMutation = (triggerCloudPush = true) => {
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem(LAST_MUTATION_AT_KEY, nowIso);
      if (authUserRef.current) {
        localStorage.setItem(PENDING_CLOUD_PUSH_KEY, 'true');
      }
    } catch {
      // ignore
    }
    if (triggerCloudPush && authUserRef.current) {
      scheduleImmediateCloudPush();
    }
  };

  const flushCloudPushKeepalive = () => {
    const user = authUserRef.current;
    if (!user) return;

    let hasPending = false;
    try {
      hasPending = localStorage.getItem(PENDING_CLOUD_PUSH_KEY) === 'true' || !!pushTimerRef.current;
    } catch {
      hasPending = !!pushTimerRef.current;
    }
    if (!hasPending) return;

    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }

    const { url, anonKey } = getSupabaseCredentials();
    const token = accessTokenRef.current || readStoredAccessToken();
    if (!url || !anonKey || !token) return;

    try {
      const payload = buildCloudPayloadFromRefs();
      fetch(`${url}/rest/v1/legio_user_state?on_conflict=user_id`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({
          user_id: user.id,
          display_name: user.displayName || user.email,
          state: payload,
          updated_at: new Date().toISOString()
        }),
        keepalive: true
      }).catch(() => {
        // Pending flag stays 'true' in localStorage so next reload recovers and pushes
      });
    } catch {
      // ignore
    }
  };

  // Track active calendar day for same-day vs new-day reload detection
  useEffect(() => {
    try {
      localStorage.setItem(LAST_ACTIVE_TODAY_KEY, todayDate);
    } catch {
      // ignore
    }
  }, [todayDate]);

  // Keep local selectedDate / selectedWeekId persisted
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SELECTED_DATE, selectedDate);
    } catch (e) {
      console.error('Failed to save selected date', e);
    }
  }, [selectedDate]);

  // Flush pending cloud mutations immediately on tab hide / reload / unload
  useEffect(() => {
    const handleVisibilityHide = () => {
      if (document.visibilityState === 'hidden') {
        flushCloudPushKeepalive();
      }
    };
    const handleUnload = () => {
      flushCloudPushKeepalive();
    };
    document.addEventListener('visibilitychange', handleVisibilityHide);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityHide);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  // Resolve or auto-create a WeeklyPlan matching any given date
  const resolveWeekForDate = (
    dateStr: string,
    currentPlans: Record<string, WeeklyPlan>,
    preferredWeekId?: string
  ): { weekId: string; createdPlan?: WeeklyPlan } => {
    const existingByRange = findBestWeeklyPlanForDate(dateStr, currentPlans, preferredWeekId);
    if (existingByRange) {
      return { weekId: existingByRange.id };
    }

    const weekNum = getWeekNumberForDate(dateStr, getEffectiveEpochMonday(currentPlans));
    const weekId = `week_${weekNum}`;
    if (currentPlans[weekId]) {
      return { weekId };
    }

    const range = getCurrentWeekRange(dateStr);
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
      updatedAt: EMPTY_WEEK_TIMESTAMP
    };
    return { weekId, createdPlan: newPlan };
  };

  // Ensure all weeks up to selectedDate exist continuously and selectedWeekId stays synced
  useEffect(() => {
    const currentPlans = weeklyPlansRef.current;
    const { weekId, createdPlan } = resolveWeekForDate(selectedDate, currentPlans, selectedWeekIdRef.current);
    const withTarget = createdPlan ? { ...currentPlans, [weekId]: createdPlan } : currentPlans;
    const nextPlans = ensureContinuousWeeks(withTarget, selectedDate);
    if (nextPlans !== currentPlans) {
      commitWeeklyPlans(nextPlans);
    }
    if (selectedWeekIdRef.current !== weekId) {
      selectedWeekIdRef.current = weekId;
      setSelectedWeekIdState(weekId);
      try {
        localStorage.setItem(SELECTED_WEEK_ID_KEY, weekId);
      } catch (e) {
        console.error(e);
      }
    }
  }, [selectedDate]);

  // Setting selectedDate automatically syncs selectedWeekId via the effect above
  const setSelectedDate = (date: string) => {
    selectedDateRef.current = date;
    try {
      localStorage.setItem(STORAGE_KEYS.SELECTED_DATE, date);
    } catch {
      // ignore
    }
    setSelectedDateState(date);
  };

  // Setting selectedWeekId also aligns selectedDate into that week if outside its Mon-Sun range
  const setSelectedWeekId = (weekId: string) => {
    selectedWeekIdRef.current = weekId;
    setSelectedWeekIdState(weekId);
    try {
      localStorage.setItem(SELECTED_WEEK_ID_KEY, weekId);
    } catch (e) {
      console.error(e);
    }
    const targetPlan = weeklyPlansRef.current[weekId];
    if (targetPlan && targetPlan.startDate && targetPlan.endDate) {
      const curDate = selectedDateRef.current;
      if (curDate < targetPlan.startDate || curDate > targetPlan.endDate) {
        const nextDate =
          todayDate >= targetPlan.startDate && todayDate <= targetPlan.endDate
            ? todayDate
            : targetPlan.startDate;
        selectedDateRef.current = nextDate;
        try {
          localStorage.setItem(STORAGE_KEYS.SELECTED_DATE, nextDate);
        } catch {
          // ignore
        }
        setSelectedDateState(nextDate);
      }
    }
  };

  useEffect(() => {
    const syncCurrentDate = () => {
      const currentRealDate = getTodayDateString();
      setTodayDate(prevToday => {
        if (prevToday !== currentRealDate) {
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
    const ensured = ensureContinuousWeeks(weeklyPlansRef.current, todayDate);
    if (ensured !== weeklyPlansRef.current) {
      commitWeeklyPlans(ensured);
    }
  }, [todayDate]);

  const setSystemLevel = (lvl: SystemLevel) => {
    commitSystemLevel(lvl);
    markLocalMutation();
  };

  // Parse initial route from hash
  const parseHash = (): { main: MainTab; planningSub: PlanningSubTab; reviewSub: ReviewSubTab } => {
    const raw = window.location.hash.replace('#', '');
    const parts = raw.split('/');
    const p1 = parts[0];
    const p2 = parts[1];

    if (p1 === 'planning') {
      const sub: PlanningSubTab =
        p2 === 'weekly' || p2 === 'monthly' || p2 === 'yearly' || p2 === 'matrix'
          ? (p2 as PlanningSubTab)
          : p2 === 'three_year' || p2 === '3year'
          ? 'yearly'
          : 'daily';
      return { main: 'planning', planningSub: sub, reviewSub: 'daily' };
    }
    if (p1 === 'matrix' || p1 === 'spreadsheet') {
      return { main: 'planning', planningSub: 'matrix', reviewSub: 'daily' };
    }
    if (p1 === 'review') {
      const sub = (p2 === 'daily' || p2 === 'gws' || p2 === 'weekly' || p2 === 'monthly' || p2 === 'quarterly' || p2 === 'yearly')
        ? (p2 as ReviewSubTab)
        : 'vault';
      return { main: 'review', planningSub: 'daily', reviewSub: sub };
    }
    if (p1 === 'checklist') return { main: 'checklist', planningSub: 'daily', reviewSub: 'daily' };
    if (p1 === 'gws') return { main: 'gws', planningSub: 'daily', reviewSub: 'daily' };
    if (p1 === 'templates') return { main: 'templates', planningSub: 'daily', reviewSub: 'daily' };

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

  // Helper date calculations (using noon local time to avoid DST/UTC offset bugs)
  const shiftDate = (days: number) => {
    const current = new Date(`${selectedDateRef.current}T12:00:00`);
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

  const makeBlankDailyEntry = (date: string): DailyEntry => ({
    date,
    templateId: 'tpl_daily_default',
    mainTasksCompleted: 0,
    mainTasksTotal: 3,
    executionScore: 0,
    automaticTasksCompleted: false,
    planNotes: '',
    priorityItems: [],
    gwsSessionIds: [],
    reviewNotes: '',
    customFieldValues: {},
    updatedAt: EMPTY_WEEK_TIMESTAMP
  });

  const getEntryForDate = (date: string): DailyEntry => {
    if (dailyEntries[date]) {
      return dailyEntries[date];
    }
    return makeBlankDailyEntry(date);
  };

  const applyDailyEntryUpdate = (
    date: string,
    updates: Partial<DailyEntry>
  ): { prevEntry: DailyEntry; nextEntry: DailyEntry } => {
    const currentMap = dailyEntriesRef.current;
    const prevEntry = currentMap[date] || makeBlankDailyEntry(date);
    const prevItems = getPriorityItemsForEntry(prevEntry);

    let normalizedUpdates = { ...updates };
    if (Array.isArray(updates.priorityItems)) {
      const cleanItems = updates.priorityItems
        .filter(i => i && typeof i.text === 'string' && i.text.trim().length > 0)
        .map(i => ({ ...i, text: i.text.trim() }));
      normalizedUpdates = {
        ...normalizedUpdates,
        priorityItems: cleanItems,
        planNotes: formatPriorityItemsToPlanNotes(cleanItems),
        mainTasksCompleted: cleanItems.filter(i => i.completed).length,
        mainTasksTotal: Math.max(3, cleanItems.length)
      };
    } else if (updates.planNotes !== undefined) {
      const cleanItems = parsePlanNotesToPriorityItems(date, updates.planNotes, prevItems);
      normalizedUpdates = {
        ...normalizedUpdates,
        priorityItems: cleanItems,
        planNotes: updates.planNotes.trim().length === 0 ? '' : formatPriorityItemsToPlanNotes(cleanItems),
        mainTasksCompleted: cleanItems.filter(i => i.completed).length,
        mainTasksTotal: Math.max(3, cleanItems.length)
      };
    }

    const nextEntry: DailyEntry = {
      ...prevEntry,
      ...normalizedUpdates,
      date,
      updatedAt: new Date().toISOString()
    };

    commitDailyEntries({
      ...currentMap,
      [date]: nextEntry
    });

    return { prevEntry, nextEntry };
  };

  const syncLinkedYearlyTasks = (toggled: Array<{ yearlyTaskId: string; completed: boolean }>) => {
    if (toggled.length === 0) return;
    const curYears = yearlyPlansRef.current;
    let changed = false;
    const nextYears: Record<string, YearlyPlan> = { ...curYears };
    Object.entries(curYears).forEach(([yKey, yPlan]) => {
      let yChanged = false;
      const nextTasks = (yPlan.tasks || []).map(yt => {
        const hit = toggled.find(t => t.yearlyTaskId === yt.id);
        if (hit && yt.completed !== hit.completed) {
          yChanged = true;
          changed = true;
          return { ...yt, completed: hit.completed };
        }
        return yt;
      });
      if (yChanged) {
        nextYears[yKey] = {
          ...yPlan,
          tasks: nextTasks,
          updatedAt: new Date().toISOString()
        };
      }
    });
    if (changed) {
      commitYearlyPlans(nextYears);
    }
  };

  const propagateWeeklyTaskCompletionUpward = (prevPlan: WeeklyPlan | undefined, savedPlan: WeeklyPlan) => {
    const prevMap = new Map<string, boolean>();
    (prevPlan?.tasks || []).forEach(t => prevMap.set(t.id, t.completed));

    const monthlyToggles: Array<{ monthlyTaskId: string; completed: boolean }> = [];
    const yearlyToggles: Array<{ yearlyTaskId: string; completed: boolean }> = [];

    (savedPlan.tasks || []).forEach(t => {
      const wasDone = prevMap.get(t.id);
      const changed = wasDone !== undefined ? wasDone !== t.completed : t.completed;
      if (!changed) return;
      if (t.monthlyTaskId) {
        monthlyToggles.push({ monthlyTaskId: t.monthlyTaskId, completed: t.completed });
      }
      if (t.yearlyTaskId) {
        yearlyToggles.push({ yearlyTaskId: t.yearlyTaskId, completed: t.completed });
      }
    });

    if (monthlyToggles.length > 0) {
      const curMonths = monthlyPlansRef.current;
      let mAnyChanged = false;
      const nextMonths: Record<string, MonthlyPlan> = { ...curMonths };
      Object.entries(curMonths).forEach(([mKey, mPlan]) => {
        let mChanged = false;
        const nextTasks = (mPlan.tasks || []).map(mt => {
          const hit = monthlyToggles.find(t => t.monthlyTaskId === mt.id);
          if (hit && mt.completed !== hit.completed) {
            mChanged = true;
            mAnyChanged = true;
            if (mt.yearlyTaskId) {
              yearlyToggles.push({ yearlyTaskId: mt.yearlyTaskId, completed: hit.completed });
            }
            return { ...mt, completed: hit.completed };
          }
          return mt;
        });
        if (mChanged) {
          nextMonths[mKey] = {
            ...mPlan,
            tasks: nextTasks,
            updatedAt: new Date().toISOString()
          };
        }
      });
      if (mAnyChanged) {
        commitMonthlyPlans(nextMonths);
      }
    }

    if (yearlyToggles.length > 0) {
      syncLinkedYearlyTasks(yearlyToggles);
    }
  };

  const applyWeeklyPlanUpdate = (plan: WeeklyPlan): WeeklyPlan => {
    const computedScore = computeWeeklyAchievedScore(plan.tasks || []);
    const nextPlan: WeeklyPlan = {
      ...plan,
      achievedScore: computedScore,
      updatedAt: new Date().toISOString()
    };
    commitWeeklyPlans({
      ...weeklyPlansRef.current,
      [plan.id]: nextPlan
    });
    return nextPlan;
  };

  const saveDailyEntry = (date: string, updates: Partial<DailyEntry>) => {
    const { prevEntry, nextEntry } = applyDailyEntryUpdate(date, updates);

    // Two-way sync: if any priority's completion status changed, update linked Weekly Goal / Sub-Goal automatically
    if (updates.priorityItems !== undefined || updates.planNotes !== undefined) {
      const prevItems = getPriorityItemsForEntry(prevEntry);
      const nextItems = getPriorityItemsForEntry(nextEntry);

      const toggledItems = nextItems.filter(nextItem => {
        const prevMatch =
          prevItems.find(p => p.id === nextItem.id) ||
          (nextItem.subTaskId ? prevItems.find(p => p.subTaskId === nextItem.subTaskId) : undefined) ||
          (nextItem.weeklyTaskId && !nextItem.subTaskId
            ? prevItems.find(p => p.weeklyTaskId === nextItem.weeklyTaskId && !p.subTaskId)
            : undefined) ||
          prevItems.find(p => p.text.trim().toLowerCase() === nextItem.text.trim().toLowerCase());

        return prevMatch ? prevMatch.completed !== nextItem.completed : nextItem.completed;
      });

      if (toggledItems.length > 0) {
        const targetPlan = findBestWeeklyPlanForDate(date, weeklyPlansRef.current, selectedWeekIdRef.current);
        if (targetPlan && targetPlan.tasks.length > 0) {
          let planChanged = false;
          const updatedTasks = targetPlan.tasks.map(t => {
            let nextTask = t;

            const matchingDirect = toggledItems.find(
              item =>
                (item.weeklyTaskId && !item.subTaskId && item.weeklyTaskId === t.id) ||
                (!item.weeklyTaskId && !item.subTaskId && item.text.trim().toLowerCase() === t.text.trim().toLowerCase())
            );
            if (matchingDirect && nextTask.completed !== matchingDirect.completed) {
              planChanged = true;
              nextTask = { ...nextTask, completed: matchingDirect.completed };
            }

            if (t.subTasks && t.subTasks.length > 0) {
              let subChanged = false;
              const updatedSubs = t.subTasks.map(sub => {
                const matchingSub = toggledItems.find(
                  item =>
                    (item.subTaskId && item.subTaskId === sub.id) ||
                    (!item.subTaskId && item.text.trim().toLowerCase() === sub.text.trim().toLowerCase())
                );
                if (matchingSub && sub.completed !== matchingSub.completed) {
                  subChanged = true;
                  planChanged = true;
                  return { ...sub, completed: matchingSub.completed };
                }
                return sub;
              });

              if (subChanged) {
                nextTask = {
                  ...nextTask,
                  subTasks: updatedSubs,
                  completed: updatedSubs.length > 0 && updatedSubs.every(s => s.completed)
                };
              }
            }

            return nextTask;
          });

          if (planChanged) {
            const savedW = applyWeeklyPlanUpdate({
              ...targetPlan,
              tasks: updatedTasks
            });
            propagateWeeklyTaskCompletionUpward(targetPlan, savedW);
          }
        }
      }
    }

    markLocalMutation();
  };

  const addGWSSession = (sessionData: Omit<GWSSession, 'id' | 'createdAt'>): GWSSession => {
    const newSession: GWSSession = {
      ...sessionData,
      id: `gws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString()
    };

    commitGwsSessions([newSession, ...gwsSessionsRef.current]);

    const currentDay = dailyEntriesRef.current[sessionData.date] || makeBlankDailyEntry(sessionData.date);
    const updatedIds = Array.from(new Set([...(currentDay.gwsSessionIds || []), newSession.id]));
    applyDailyEntryUpdate(sessionData.date, { gwsSessionIds: updatedIds });

    markLocalMutation();
    return newSession;
  };

  const updateGWSSession = (id: string, updates: Partial<GWSSession>) => {
    commitGwsSessions(gwsSessionsRef.current.map(s => (s.id === id ? { ...s, ...updates } : s)));
    markLocalMutation();
  };

  const deleteGWSSession = (id: string) => {
    commitGwsSessions(gwsSessionsRef.current.filter(s => s.id !== id));

    const currentDaily = dailyEntriesRef.current;
    let dailyChanged = false;
    const nextDaily: Record<string, DailyEntry> = { ...currentDaily };
    Object.keys(nextDaily).forEach(date => {
      if (nextDaily[date].gwsSessionIds?.includes(id)) {
        dailyChanged = true;
        nextDaily[date] = {
          ...nextDaily[date],
          gwsSessionIds: nextDaily[date].gwsSessionIds.filter(sessionId => sessionId !== id),
          updatedAt: new Date().toISOString()
        };
      }
    });
    if (dailyChanged) {
      commitDailyEntries(nextDaily);
    }

    markLocalMutation();
  };

  const getWeeklyPlan = (weekId: string): WeeklyPlan => {
    if (weeklyPlans[weekId]) return weeklyPlans[weekId];
    return {
      id: weekId,
      weekNumber: parseInt(weekId.replace('week_', ''), 10) || 1,
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
      updatedAt: EMPTY_WEEK_TIMESTAMP
    };
  };

  const saveWeeklyPlan = (plan: WeeklyPlan) => {
    const prevPlan = weeklyPlansRef.current[plan.id];
    const savedPlan = applyWeeklyPlanUpdate(plan);

    // Two-way sync: propagate weekly goal / sub-goal completions and ID-linked renames to days in that week
    if (savedPlan.tasks && savedPlan.tasks.length > 0) {
      const prevTaskCompletion = new Map<string, boolean>();
      const prevSubCompletion = new Map<string, boolean>();
      if (prevPlan) {
        prevPlan.tasks.forEach(t => {
          prevTaskCompletion.set(t.id, t.completed);
          (t.subTasks || []).forEach(s => prevSubCompletion.set(s.id, s.completed));
        });
      }

      const weekRange = getCurrentWeekRange(savedPlan.startDate);
      weekRange.days.forEach(dayStr => {
        const entry = dailyEntriesRef.current[dayStr];
        if (!entry) return;
        const existingItems = getPriorityItemsForEntry(entry);
        if (existingItems.length === 0) return;

        let entryChanged = false;
        const nextItems = existingItems.map(item => {
          // 1. Sub-task match (by subTaskId, or text fallback when completion toggled)
          for (const t of savedPlan.tasks) {
            const subById = item.subTaskId ? (t.subTasks || []).find(s => s.id === item.subTaskId) : undefined;
            if (subById) {
              const nextText = subById.text.trim() || item.text;
              if (item.completed !== subById.completed || item.text !== nextText) {
                entryChanged = true;
                return { ...item, completed: subById.completed, text: nextText };
              }
              return item;
            }
          }

          // 2. Direct weekly goal match (by weeklyTaskId without subTaskId)
          if (item.weeklyTaskId && !item.subTaskId) {
            const taskById = savedPlan.tasks.find(t => t.id === item.weeklyTaskId);
            if (taskById) {
              const nextText = taskById.text.trim() || item.text;
              if (item.completed !== taskById.completed || item.text !== nextText) {
                entryChanged = true;
                return { ...item, completed: taskById.completed, text: nextText };
              }
              return item;
            }
          }

          // 3. Fallback text match ONLY if that weekly task/sub-task's completion toggled
          if (!item.weeklyTaskId && !item.subTaskId) {
            const norm = item.text.trim().toLowerCase();
            for (const t of savedPlan.tasks) {
              if (
                t.text.trim().toLowerCase() === norm &&
                prevTaskCompletion.has(t.id) &&
                prevTaskCompletion.get(t.id) !== t.completed &&
                item.completed !== t.completed
              ) {
                entryChanged = true;
                return { ...item, completed: t.completed };
              }
              for (const s of t.subTasks || []) {
                if (
                  s.text.trim().toLowerCase() === norm &&
                  prevSubCompletion.has(s.id) &&
                  prevSubCompletion.get(s.id) !== s.completed &&
                  item.completed !== s.completed
                ) {
                  entryChanged = true;
                  return { ...item, completed: s.completed };
                }
              }
            }
          }

          return item;
        });

        if (entryChanged) {
          applyDailyEntryUpdate(dayStr, { priorityItems: nextItems });
        }
      });
    }

    propagateWeeklyTaskCompletionUpward(prevPlan, savedPlan);
    markLocalMutation();
  };

  const normalizeMonthlyPlanEntry = (monthKey: string, p?: Partial<MonthlyPlan>): MonthlyPlan => ({
    id: p?.id || monthKey,
    monthKey: p?.monthKey || monthKey,
    focusTheme: p?.focusTheme || '',
    notes: p?.notes || '',
    tasks: Array.isArray(p?.tasks) ? p.tasks : [],
    updatedAt: p?.updatedAt || EMPTY_WEEK_TIMESTAMP
  });

  const normalizeYearlyPlanEntry = (yearKey: string, p?: Partial<YearlyPlan>): YearlyPlan => ({
    id: p?.id || yearKey,
    yearKey: p?.yearKey || yearKey,
    focusTheme: p?.focusTheme || '',
    notes: p?.notes || '',
    tasks: Array.isArray(p?.tasks) ? p.tasks : [],
    updatedAt: p?.updatedAt || EMPTY_WEEK_TIMESTAMP
  });

  const getMonthlyPlan = (monthKey: string): MonthlyPlan => {
    if (monthlyPlans[monthKey]) {
      return normalizeMonthlyPlanEntry(monthKey, monthlyPlans[monthKey]);
    }
    return normalizeMonthlyPlanEntry(monthKey);
  };

  const saveMonthlyPlan = (plan: MonthlyPlan) => {
    const key = plan.monthKey || plan.id;
    const prevPlan = monthlyPlansRef.current[key];
    const saved = {
      ...normalizeMonthlyPlanEntry(key, plan),
      updatedAt: new Date().toISOString()
    };
    commitMonthlyPlans({
      ...monthlyPlansRef.current,
      [key]: saved
    });

    // Upward ID-linked sync: propagate completed monthly goal to linked yearly goal
    const prevMap = new Map<string, boolean>();
    (prevPlan?.tasks || []).forEach(t => prevMap.set(t.id, t.completed));
    const yearlyToggles: Array<{ yearlyTaskId: string; completed: boolean }> = [];
    saved.tasks.forEach(t => {
      const wasDone = prevMap.get(t.id);
      const changed = wasDone !== undefined ? wasDone !== t.completed : t.completed;
      if (changed && t.yearlyTaskId) {
        yearlyToggles.push({ yearlyTaskId: t.yearlyTaskId, completed: t.completed });
      }
    });
    if (yearlyToggles.length > 0) {
      syncLinkedYearlyTasks(yearlyToggles);
    }

    markLocalMutation();
  };

  const getYearlyPlan = (yearKey: string): YearlyPlan => {
    if (yearlyPlans[yearKey]) {
      return normalizeYearlyPlanEntry(yearKey, yearlyPlans[yearKey]);
    }
    return normalizeYearlyPlanEntry(yearKey);
  };

  const saveYearlyPlan = (plan: YearlyPlan) => {
    const key = plan.yearKey || plan.id;
    const saved = {
      ...normalizeYearlyPlanEntry(key, plan),
      updatedAt: new Date().toISOString()
    };
    commitYearlyPlans({
      ...yearlyPlansRef.current,
      [key]: saved
    });
    markLocalMutation();
  };

  const saveTemplate = (template: Template) => {
    const prev = templatesRef.current;
    const idx = prev.findIndex(t => t.id === template.id);
    const updatedTpl = { ...template, updatedAt: new Date().toISOString() };
    const next = idx >= 0 ? prev.map((t, i) => (i === idx ? updatedTpl : t)) : [...prev, updatedTpl];
    commitTemplates(next);
    markLocalMutation();
  };

  const deleteTemplate = (id: string) => {
    commitTemplates(templatesRef.current.filter(t => t.id !== id));
    markLocalMutation();
  };

  const resetTemplatesToDefault = () => {
    commitTemplates(DEFAULT_TEMPLATES);
    markLocalMutation();
  };

  const saveReview = (review: ReviewEntry) => {
    const prev = reviewsRef.current;
    const idx = prev.findIndex(r => r.id === review.id);
    const stamped = { ...review, updatedAt: review.updatedAt || new Date().toISOString() };
    const next = idx >= 0 ? prev.map((r, i) => (i === idx ? stamped : r)) : [stamped, ...prev];
    commitReviews(next);
    markLocalMutation();
  };

  const deleteReview = (id: string) => {
    commitReviews(reviewsRef.current.filter(r => r.id !== id));
    markLocalMutation();
  };

  const saveChecklistCategories = (cats: ChecklistCategory[]) => {
    commitChecklistCategories(cats);
    markLocalMutation();
  };

  const saveChecklistItems = (items: ChecklistItem[]) => {
    commitChecklistItems(items);

    const dailyItems = items.filter(i => i.recurrence === 'daily');
    if (dailyItems.length > 0) {
      const curDate = selectedDateRef.current;
      const allDailyDone = dailyItems.every(i => (i.completedPeriods || []).includes(curDate));
      const existing = dailyEntriesRef.current[curDate];
      if (!existing || existing.automaticTasksCompleted !== allDailyDone) {
        applyDailyEntryUpdate(curDate, { automaticTasksCompleted: allDailyDone });
      }
    }

    markLocalMutation();
  };

  const exportData = (): string => {
    const user = authUserRef.current;
    const data = {
      backupType: 'single_account' as const,
      version: 2,
      exportedAt: new Date().toISOString(),
      accountEmail: user?.email || '',
      displayName: user?.displayName || '',
      userId: user?.id || '',
      onboardingStartDate: getEffectiveEpochMonday(weeklyPlansRef.current),
      systemLevel: systemLevelRef.current,
      templates: templatesRef.current,
      dailyEntries: dailyEntriesRef.current,
      gwsSessions: gwsSessionsRef.current,
      weeklyPlans: weeklyPlansRef.current,
      monthlyPlans: monthlyPlansRef.current,
      yearlyPlans: yearlyPlansRef.current,
      reviews: reviewsRef.current,
      checklistCategories: checklistCategoriesRef.current,
      checklistItems: checklistItemsRef.current
    };
    return JSON.stringify(data, null, 2);
  };

  const importData = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== 'object') return false;
      if (parsed.backupType === 'all_users' && Array.isArray(parsed.users)) {
        return false;
      }

      // Support both flat single-account backups and wrapped { state: {...} } user backups
      const src =
        parsed.state && typeof parsed.state === 'object' && !Array.isArray(parsed.state)
          ? parsed.state
          : parsed;

      const hasRecognizedField =
        Array.isArray(src.templates) ||
        (src.dailyEntries && typeof src.dailyEntries === 'object') ||
        Array.isArray(src.gwsSessions) ||
        (src.weeklyPlans && typeof src.weeklyPlans === 'object') ||
        (src.monthlyPlans && typeof src.monthlyPlans === 'object') ||
        (src.yearlyPlans && typeof src.yearlyPlans === 'object') ||
        Array.isArray(src.reviews) ||
        Array.isArray(src.checklistItems);

      if (!hasRecognizedField) return false;

      const epoch = src.onboardingStartDate || src.weeklyPlans?.['week_1']?.startDate;
      if (epoch && typeof epoch === 'string') {
        try {
          localStorage.setItem(ONBOARDING_EPOCH_KEY, epoch);
        } catch {
          // ignore
        }
      }

      if (Array.isArray(src.templates)) commitTemplates(src.templates);
      if (src.dailyEntries && typeof src.dailyEntries === 'object') {
        const cleaned: Record<string, DailyEntry> = {};
        Object.entries(src.dailyEntries).forEach(([d, entry]) => {
          cleaned[d] = normalizeDailyEntryFields(d, entry as DailyEntry);
        });
        commitDailyEntries(cleaned);
      }
      if (Array.isArray(src.gwsSessions)) commitGwsSessions(src.gwsSessions);
      if (src.weeklyPlans && typeof src.weeklyPlans === 'object') {
        commitWeeklyPlans(ensureContinuousWeeks(src.weeklyPlans, getTodayDateString(), epoch));
      }
      if (src.monthlyPlans && typeof src.monthlyPlans === 'object') {
        const cleanedM: Record<string, MonthlyPlan> = {};
        Object.entries(src.monthlyPlans).forEach(([k, p]) => {
          cleanedM[k] = normalizeMonthlyPlanEntry(k, p as MonthlyPlan);
        });
        commitMonthlyPlans(cleanedM);
      }
      if (src.yearlyPlans && typeof src.yearlyPlans === 'object') {
        const cleanedY: Record<string, YearlyPlan> = {};
        Object.entries(src.yearlyPlans).forEach(([k, p]) => {
          cleanedY[k] = normalizeYearlyPlanEntry(k, p as YearlyPlan);
        });
        commitYearlyPlans(cleanedY);
      }
      if (Array.isArray(src.reviews)) commitReviews(src.reviews);
      if (Array.isArray(src.checklistCategories)) commitChecklistCategories(src.checklistCategories);
      if (Array.isArray(src.checklistItems)) commitChecklistItems(src.checklistItems);
      if (src.systemLevel >= 1 && src.systemLevel <= 5) {
        commitSystemLevel(src.systemLevel as SystemLevel);
      }
      markLocalMutation();
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
    commitTemplates(DEFAULT_TEMPLATES);
    const cleanedInitial: Record<string, DailyEntry> = {};
    Object.entries(INITIAL_DAILY_ENTRIES).forEach(([d, entry]) => {
      cleanedInitial[d] = normalizeDailyEntryFields(d, entry);
    });
    commitDailyEntries(cleanedInitial);
    commitGwsSessions(INITIAL_GWS_SESSIONS);
    commitWeeklyPlans(ensureContinuousWeeks(INITIAL_WEEKLY_PLANS, nowStr, '2026-10-12'));
    commitMonthlyPlans(INITIAL_MONTHLY_PLANS);
    commitYearlyPlans(INITIAL_YEARLY_PLANS);
    commitReviews([]);
    commitChecklistCategories(INITIAL_CHECKLIST_CATEGORIES);
    commitChecklistItems(INITIAL_CHECKLIST_ITEMS);
    setTodayDate(nowStr);
    setSelectedDate(nowStr);
    markLocalMutation();
  };

  const buildFreshPayload = () => {
    const nowStr = getTodayDateString();
    const currentRange = getCurrentWeekRange(nowStr);
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
          updatedAt: EMPTY_WEEK_TIMESTAMP
        }
      } as Record<string, WeeklyPlan>,
      monthlyPlans: {} as Record<string, MonthlyPlan>,
      yearlyPlans: {} as Record<string, YearlyPlan>,
      reviews: [] as ReviewEntry[],
      checklistCategories: [{ id: 'cat_general', name: 'General' }] as ChecklistCategory[],
      checklistItems: [] as ChecklistItem[],
      systemLevel: 5 as SystemLevel
    };
  };

  const applyFreshWorkspaceState = () => {
    const nowStr = getTodayDateString();
    const fresh = buildFreshPayload();
    const freshWeekId = Object.keys(fresh.weeklyPlans)[0];
    commitTemplates(fresh.templates);
    commitDailyEntries(fresh.dailyEntries);
    commitGwsSessions(fresh.gwsSessions);
    commitWeeklyPlans(fresh.weeklyPlans);
    commitMonthlyPlans(fresh.monthlyPlans);
    commitYearlyPlans(fresh.yearlyPlans);
    commitReviews(fresh.reviews);
    commitChecklistCategories(fresh.checklistCategories);
    commitChecklistItems(fresh.checklistItems);
    setTodayDate(nowStr);
    setSelectedDate(nowStr);
    selectedWeekIdRef.current = freshWeekId;
    setSelectedWeekIdState(freshWeekId);
    try {
      localStorage.setItem(SELECTED_WEEK_ID_KEY, freshWeekId);
    } catch {
      // ignore
    }
  };

  // Start a clean blank workspace (used for new friend accounts or explicit fresh start)
  const startFreshWorkspace = () => {
    applyFreshWorkspaceState();
    if (authUserRef.current) {
      markLocalMutation();
    }
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
    findBestWeeklyPlanForDate(todayDate, weeklyPlans, selectedWeekId) ||
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

  const applyCloudPayload = (state: any) => {
    if (!state || typeof state !== 'object') return;
    const cloudEpoch = state.onboardingStartDate || state.weeklyPlans?.['week_1']?.startDate || '2026-10-12';
    try {
      localStorage.setItem(ONBOARDING_EPOCH_KEY, cloudEpoch);
    } catch {
      // ignore
    }
    if (Array.isArray(state.templates)) commitTemplates(state.templates);
    if (state.dailyEntries) {
      const cleanedDaily: Record<string, DailyEntry> = {};
      Object.entries(state.dailyEntries).forEach(([d, entry]) => {
        cleanedDaily[d] = normalizeDailyEntryFields(d, entry as DailyEntry);
      });
      commitDailyEntries(cleanedDaily);
    }
    if (Array.isArray(state.gwsSessions)) commitGwsSessions(state.gwsSessions);
    if (state.weeklyPlans) {
      commitWeeklyPlans(ensureContinuousWeeks(state.weeklyPlans, getTodayDateString(), cloudEpoch));
    }
    if (state.monthlyPlans && typeof state.monthlyPlans === 'object') {
      const cleanedM: Record<string, MonthlyPlan> = {};
      Object.entries(state.monthlyPlans).forEach(([k, p]) => {
        cleanedM[k] = normalizeMonthlyPlanEntry(k, p as MonthlyPlan);
      });
      commitMonthlyPlans(cleanedM);
    }
    if (state.yearlyPlans && typeof state.yearlyPlans === 'object') {
      const cleanedY: Record<string, YearlyPlan> = {};
      Object.entries(state.yearlyPlans).forEach(([k, p]) => {
        cleanedY[k] = normalizeYearlyPlanEntry(k, p as YearlyPlan);
      });
      commitYearlyPlans(cleanedY);
    }
    if (Array.isArray(state.reviews)) commitReviews(state.reviews);
    if (Array.isArray(state.checklistCategories)) commitChecklistCategories(state.checklistCategories);
    if (Array.isArray(state.checklistItems)) commitChecklistItems(state.checklistItems);
    if (state.systemLevel >= 1 && state.systemLevel <= 5) {
      const nextLvl =
        (state.systemLevel === 3 || state.systemLevel === 4) && !localStorage.getItem(STORAGE_KEYS.SYSTEM_LEVEL)
          ? 5
          : state.systemLevel;
      commitSystemLevel(nextLvl as SystemLevel);
    }
  };

  const mergeLocalAndCloudState = (
    cloudState: any,
    cloudRowUpdatedAt?: string
  ): { mergedState: any; needsCloudPush: boolean } => {
    const local = buildCloudPayloadFromRefs();
    let localMutationAt = '';
    let hasPendingPush = false;
    try {
      localMutationAt = localStorage.getItem(LAST_MUTATION_AT_KEY) || '';
      hasPendingPush = localStorage.getItem(PENDING_CLOUD_PUSH_KEY) === 'true';
    } catch {
      // ignore
    }

    const cloudUpdatedAt = cloudState?.clientUpdatedAt || cloudRowUpdatedAt || '';
    const localMs = Date.parse(localMutationAt) || 0;
    const cloudMs = Date.parse(cloudUpdatedAt) || 0;
    const localIsNewer = hasPendingPush || localMs > cloudMs;

    let needsCloudPush = hasPendingPush || localMs > cloudMs;

    // 1. Merge dailyEntries per date by newer updatedAt
    const mergedDailyEntries: Record<string, DailyEntry> = {};
    const cloudDaily = (cloudState?.dailyEntries || {}) as Record<string, DailyEntry>;
    const allDates = new Set([...Object.keys(local.dailyEntries), ...Object.keys(cloudDaily)]);

    allDates.forEach(date => {
      const lRaw = local.dailyEntries[date];
      const cRaw = cloudDaily[date];
      if (lRaw && !cRaw) {
        mergedDailyEntries[date] = normalizeDailyEntryFields(date, lRaw);
        needsCloudPush = true;
      } else if (cRaw && !lRaw) {
        mergedDailyEntries[date] = normalizeDailyEntryFields(date, cRaw);
      } else if (lRaw && cRaw) {
        const l = normalizeDailyEntryFields(date, lRaw);
        const c = normalizeDailyEntryFields(date, cRaw);
        const lTime = Date.parse(l.updatedAt || '') || 0;
        const cTime = Date.parse(c.updatedAt || '') || 0;
        const lHasPlan = l.priorityItems && l.priorityItems.length > 0;
        const cHasPlan = c.priorityItems && c.priorityItems.length > 0;

        if (lTime > cTime) {
          mergedDailyEntries[date] = l;
          needsCloudPush = true;
        } else if (cTime > lTime) {
          if (hasPendingPush && lHasPlan && !cHasPlan) {
            mergedDailyEntries[date] = l;
            needsCloudPush = true;
          } else {
            mergedDailyEntries[date] = c;
          }
        } else {
          mergedDailyEntries[date] = hasPendingPush || (lHasPlan && !cHasPlan) ? l : c;
        }
      }
    });

    // 2. Merge weeklyPlans per weekId (prefer content over empty auto-created placeholders, otherwise newer updatedAt)
    const mergedWeeklyPlans: Record<string, WeeklyPlan> = {};
    const cloudWeekly = (cloudState?.weeklyPlans || {}) as Record<string, WeeklyPlan>;
    const allWeekIds = new Set([...Object.keys(local.weeklyPlans), ...Object.keys(cloudWeekly)]);

    allWeekIds.forEach(weekId => {
      const l = local.weeklyPlans[weekId];
      const c = cloudWeekly[weekId];
      if (l && !c) {
        mergedWeeklyPlans[weekId] = l;
        if (hasWeeklyPlanContent(l)) needsCloudPush = true;
      } else if (c && !l) {
        mergedWeeklyPlans[weekId] = c;
      } else if (l && c) {
        const lHasContent = hasWeeklyPlanContent(l);
        const cHasContent = hasWeeklyPlanContent(c);
        const lTime = Date.parse(l.updatedAt || '') || 0;
        const cTime = Date.parse(c.updatedAt || '') || 0;

        if (lHasContent && !cHasContent) {
          // Prefer populated local unless cloud had an explicit deletion timestamp strictly after local
          if (cTime > lTime && c.updatedAt !== EMPTY_WEEK_TIMESTAMP && !hasPendingPush && cloudMs > localMs) {
            mergedWeeklyPlans[weekId] = c;
          } else {
            mergedWeeklyPlans[weekId] = l;
            needsCloudPush = true;
          }
        } else if (cHasContent && !lHasContent) {
          // Prefer populated cloud unless user explicitly cleared/deleted tasks locally while pending push
          if (hasPendingPush && lTime > cTime && l.updatedAt !== EMPTY_WEEK_TIMESTAMP) {
            mergedWeeklyPlans[weekId] = l;
            needsCloudPush = true;
          } else {
            mergedWeeklyPlans[weekId] = c;
          }
        } else if (lTime > cTime) {
          mergedWeeklyPlans[weekId] = l;
          needsCloudPush = true;
        } else if (cTime > lTime) {
          mergedWeeklyPlans[weekId] = c;
        } else {
          mergedWeeklyPlans[weekId] = hasPendingPush ? l : c;
        }
      }
    });

    // 3. Merge monthlyPlans & yearlyPlans per periodKey (prefer content over empty placeholders, otherwise newer updatedAt)
    const mergePeriodPlanMap = <T extends MonthlyPlan | YearlyPlan>(
      localMap: Record<string, T>,
      cloudMapRaw: any,
      normalizeFn: (k: string, p?: Partial<T>) => T
    ): Record<string, T> => {
      const merged: Record<string, T> = {};
      const cloudMap = (cloudMapRaw && typeof cloudMapRaw === 'object' ? cloudMapRaw : {}) as Record<string, T>;
      const allKeys = new Set([...Object.keys(localMap), ...Object.keys(cloudMap)]);
      const hasContent = (p?: T) =>
        !!(p && (p.tasks.length > 0 || p.focusTheme.trim().length > 0 || p.notes.trim().length > 0));

      allKeys.forEach(k => {
        const lRaw = localMap[k];
        const cRaw = cloudMap[k];
        if (lRaw && !cRaw) {
          const l = normalizeFn(k, lRaw);
          merged[k] = l;
          if (hasContent(l)) needsCloudPush = true;
        } else if (cRaw && !lRaw) {
          merged[k] = normalizeFn(k, cRaw);
        } else if (lRaw && cRaw) {
          const l = normalizeFn(k, lRaw);
          const c = normalizeFn(k, cRaw);
          const lHasContent = hasContent(l);
          const cHasContent = hasContent(c);
          const lTime = Date.parse(l.updatedAt || '') || 0;
          const cTime = Date.parse(c.updatedAt || '') || 0;

          if (lHasContent && !cHasContent) {
            if (cTime > lTime && c.updatedAt !== EMPTY_WEEK_TIMESTAMP && !hasPendingPush && cloudMs > localMs) {
              merged[k] = c;
            } else {
              merged[k] = l;
              needsCloudPush = true;
            }
          } else if (cHasContent && !lHasContent) {
            if (hasPendingPush && lTime > cTime && l.updatedAt !== EMPTY_WEEK_TIMESTAMP) {
              merged[k] = l;
              needsCloudPush = true;
            } else {
              merged[k] = c;
            }
          } else if (lTime > cTime) {
            merged[k] = l;
            needsCloudPush = true;
          } else if (cTime > lTime) {
            merged[k] = c;
          } else {
            merged[k] = hasPendingPush ? l : c;
          }
        }
      });

      return merged;
    };

    const mergedMonthlyPlans = mergePeriodPlanMap(
      local.monthlyPlans,
      cloudState?.monthlyPlans,
      normalizeMonthlyPlanEntry
    );
    const mergedYearlyPlans = mergePeriodPlanMap(
      local.yearlyPlans,
      cloudState?.yearlyPlans,
      normalizeYearlyPlanEntry
    );

    // 4. Merge reviews per id (respecting local deletions if localIsNewer)
    const mergedReviews = localIsNewer || !Array.isArray(cloudState?.reviews)
      ? local.reviews
      : (() => {
          const map = new Map<string, ReviewEntry>();
          (cloudState.reviews as ReviewEntry[]).forEach(r => map.set(r.id, r));
          local.reviews.forEach(r => {
            const c = map.get(r.id);
            const rMs = Date.parse(r.updatedAt || r.createdAt || '') || 0;
            const cMs = c ? Date.parse(c.updatedAt || c.createdAt || '') || 0 : 0;
            if (!c && localMs > cloudMs) {
              map.set(r.id, r);
              needsCloudPush = true;
            } else if (c && rMs > cMs) {
              map.set(r.id, r);
              needsCloudPush = true;
            }
          });
          return Array.from(map.values());
        })();

    const onboardingStartDate =
      mergedWeeklyPlans['week_1']?.startDate ||
      cloudState?.onboardingStartDate ||
      local.onboardingStartDate;

    const mergedState = {
      onboardingStartDate,
      templates: localIsNewer || !Array.isArray(cloudState?.templates) ? local.templates : cloudState.templates,
      dailyEntries: mergedDailyEntries,
      gwsSessions: localIsNewer || !Array.isArray(cloudState?.gwsSessions) ? local.gwsSessions : cloudState.gwsSessions,
      weeklyPlans: mergedWeeklyPlans,
      monthlyPlans: mergedMonthlyPlans,
      yearlyPlans: mergedYearlyPlans,
      reviews: mergedReviews,
      checklistCategories:
        localIsNewer || !Array.isArray(cloudState?.checklistCategories)
          ? local.checklistCategories
          : cloudState.checklistCategories,
      checklistItems:
        localIsNewer || !Array.isArray(cloudState?.checklistItems)
          ? local.checklistItems
          : cloudState.checklistItems,
      systemLevel: localIsNewer || !cloudState?.systemLevel ? local.systemLevel : cloudState.systemLevel,
      clientUpdatedAt: new Date(Math.max(localMs, cloudMs, Date.now())).toISOString()
    };

    return { mergedState, needsCloudPush };
  };

  const loadUserCloudState = async (
    userId: string,
    options?: { initialPayloadOverride?: any; preferCloudDirectly?: boolean }
  ) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const { data, error } = await supabase
        .from('legio_user_state')
        .select('state, display_name, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        setSyncStatus('error');
        setSyncError(error.message);
        return;
      }

      try {
        localStorage.setItem(LAST_CLOUD_USER_ID_KEY, userId);
      } catch {
        // ignore
      }

      if (options?.initialPayloadOverride) {
        applyCloudPayload(options.initialPayloadOverride);
        await flushCloudPushNow();
        return;
      }

      if (data && data.state) {
        if (options?.preferCloudDirectly) {
          applyCloudPayload(data.state);
          try {
            localStorage.setItem(PENDING_CLOUD_PUSH_KEY, 'false');
          } catch {
            // ignore
          }
          setSyncStatus('synced');
        } else {
          const { mergedState, needsCloudPush } = mergeLocalAndCloudState(data.state, data.updated_at);
          applyCloudPayload(mergedState);
          if (needsCloudPush) {
            await flushCloudPushNow();
          } else {
            try {
              localStorage.setItem(PENDING_CLOUD_PUSH_KEY, 'false');
            } catch {
              // ignore
            }
            setSyncStatus('synced');
          }
        }
      } else {
        // First time this user has no cloud row yet -> push current local workspace immediately
        await flushCloudPushNow();
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

    supabase.auth
      .getSession()
      .then(({ data }) => {
        const session = data?.session;
        const u = session?.user;
        if (u) {
          accessTokenRef.current = session?.access_token || null;
          let prevCloudUser: string | null = null;
          try {
            prevCloudUser = localStorage.getItem(LAST_CLOUD_USER_ID_KEY);
          } catch {
            // ignore
          }
          const cachedId = authUserRef.current?.id;
          const isDifferentAccount = !!(prevCloudUser && prevCloudUser !== u.id && cachedId !== u.id);

          setAuthUser({
            id: u.id,
            email: u.email || '',
            displayName: u.user_metadata?.display_name
          });
          void loadUserCloudState(u.id, { preferCloudDirectly: isDifferentAccount });
        }
      })
      .catch(() => {
        setSyncStatus('offline');
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      if (u) {
        accessTokenRef.current = session?.access_token || null;
        setAuthUser({
          id: u.id,
          email: u.email || '',
          displayName: u.user_metadata?.display_name
        });
      } else {
        accessTokenRef.current = null;
        setAuthUser(null);
        setSyncStatus('idle');
      }
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, []);

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
      let prevCloudUser: string | null = null;
      let hasLocalMutation = false;
      try {
        prevCloudUser = localStorage.getItem(LAST_CLOUD_USER_ID_KEY);
        hasLocalMutation = !!localStorage.getItem(LAST_MUTATION_AT_KEY);
      } catch {
        // ignore
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { ok: false, error: formatSupabaseError(error.message) };
      if (data.user) {
        accessTokenRef.current = data.session?.access_token || null;
        setAuthUser({
          id: data.user.id,
          email: data.user.email || email,
          displayName: data.user.user_metadata?.display_name
        });
        const isSwitchingUser = !!(prevCloudUser && prevCloudUser !== data.user.id);
        const shouldPreferCloudDirectly = isSwitchingUser || (!prevCloudUser && !hasLocalMutation);
        await loadUserCloudState(data.user.id, { preferCloudDirectly: shouldPreferCloudDirectly });
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: formatSupabaseError(err?.message) };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
    keepLocalData = false,
    remember = true
  ) => {
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
        accessTokenRef.current = data.session.access_token || null;
        setAuthUser({
          id: data.user.id,
          email: data.user.email || email,
          displayName: displayName?.trim() || email.split('@')[0]
        });
        await loadUserCloudState(data.user.id, { initialPayloadOverride: freshOverride });
        return { ok: true };
      }
      return { ok: true, needsEmailConfirm: true };
    } catch (err: any) {
      return { ok: false, error: formatSupabaseError(err?.message) };
    }
  };

  const signOut = async () => {
    flushCloudPushKeepalive();
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    accessTokenRef.current = null;
    setAuthUser(null);
    setSyncStatus('idle');
    setSyncError(null);
    applyFreshWorkspaceState();
    try {
      localStorage.removeItem(LAST_CLOUD_USER_ID_KEY);
      localStorage.removeItem(LAST_MUTATION_AT_KEY);
      localStorage.removeItem(PENDING_CLOUD_PUSH_KEY);
    } catch {
      // ignore
    }
  };

  const syncNow = async () => {
    const user = authUserRef.current;
    if (!user) return;
    await loadUserCloudState(user.id);
  };

  const isMissingAdminRpcError = (err: any): boolean => {
    const msg = String(err?.message || '').toLowerCase();
    const code = String(err?.code || '');
    return (
      code === '42883' ||
      code === 'PGRST202' ||
      msg.includes('could not find the function') ||
      (msg.includes('function') && msg.includes('does not exist'))
    );
  };

  const adminListAllUsers = async (): Promise<{
    ok: boolean;
    users: AdminUserStateRow[];
    error?: string;
    needsSqlSetup?: boolean;
  }> => {
    const user = authUserRef.current;
    if (!user || !isAdminEmail(user.email)) {
      return { ok: false, users: [], error: 'Admin privileges required.' };
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, users: [], error: 'Supabase client is not configured.' };
    }
    try {
      const { data, error } = await supabase.rpc('admin_list_all_user_states');
      if (error) {
        if (isMissingAdminRpcError(error)) {
          return {
            ok: false,
            users: [],
            needsSqlSetup: true,
            error: 'Admin database functions are not installed on Supabase yet. Run the Admin SQL setup once in Supabase SQL Editor.'
          };
        }
        return { ok: false, users: [], error: formatSupabaseError(error.message) };
      }
      const rows: AdminUserStateRow[] = Array.isArray(data)
        ? data.map((row: any) => ({
            user_id: String(row.user_id || ''),
            email: String(row.email || ''),
            display_name: String(row.display_name || row.email || ''),
            created_at: row.created_at || null,
            last_sign_in_at: row.last_sign_in_at || null,
            updated_at: row.updated_at || null,
            state: row.state && typeof row.state === 'object' ? row.state : {}
          }))
        : [];
      return { ok: true, users: rows };
    } catch (err: any) {
      return { ok: false, users: [], error: formatSupabaseError(err?.message) };
    }
  };

  const adminRestoreUserState = async (params: {
    userId?: string;
    email?: string;
    displayName?: string;
    state: Record<string, any>;
  }): Promise<{
    ok: boolean;
    restoredUserId?: string;
    restoredEmail?: string;
    error?: string;
    needsSqlSetup?: boolean;
  }> => {
    const user = authUserRef.current;
    if (!user || !isAdminEmail(user.email)) {
      return { ok: false, error: 'Admin privileges required.' };
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'Supabase client is not configured.' };
    }

    // Unwrap if caller passed a single_account export object or a wrapped { state } object
    const raw = params.state || {};
    const statePayload =
      raw.state && typeof raw.state === 'object' && !Array.isArray(raw.state)
        ? raw.state
        : {
            onboardingStartDate: raw.onboardingStartDate,
            templates: raw.templates,
            dailyEntries: raw.dailyEntries,
            gwsSessions: raw.gwsSessions,
            weeklyPlans: raw.weeklyPlans,
            monthlyPlans: raw.monthlyPlans,
            yearlyPlans: raw.yearlyPlans,
            reviews: raw.reviews,
            checklistCategories: raw.checklistCategories,
            checklistItems: raw.checklistItems,
            systemLevel: raw.systemLevel
          };

    try {
      const { data, error } = await supabase.rpc('admin_restore_user_state', {
        target_user_id: params.userId || null,
        target_email: params.email || null,
        new_state: statePayload,
        new_display_name: params.displayName || null
      });
      if (error) {
        if (isMissingAdminRpcError(error)) {
          return {
            ok: false,
            needsSqlSetup: true,
            error: 'Admin database functions are not installed on Supabase yet. Run the Admin SQL setup once in Supabase SQL Editor.'
          };
        }
        return { ok: false, error: formatSupabaseError(error.message) };
      }

      const row = Array.isArray(data) ? data[0] : data;
      const restoredUid = row?.restored_user_id || params.userId;
      const restoredEmail = row?.restored_email || params.email;

      // If admin restored their own currently active account, immediately hydrate local state too
      if (restoredUid && authUserRef.current?.id === restoredUid) {
        applyCloudPayload(statePayload);
        try {
          localStorage.setItem(LAST_MUTATION_AT_KEY, new Date().toISOString());
          localStorage.setItem(PENDING_CLOUD_PUSH_KEY, 'false');
        } catch {
          // ignore
        }
      }

      return {
        ok: true,
        restoredUserId: restoredUid,
        restoredEmail
      };
    } catch (err: any) {
      return { ok: false, error: formatSupabaseError(err?.message) };
    }
  };

  return (
    <StorageContext.Provider
      value={{
        templates,
        dailyEntries,
        gwsSessions,
        weeklyPlans,
        monthlyPlans,
        yearlyPlans,
        reviews,
        checklistCategories,
        checklistItems,
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
        isAdmin,
        rememberDevice,
        setRememberDevice,
        syncStatus,
        syncError,
        signIn,
        signUp,
        signOut,
        syncNow,
        startFreshWorkspace,
        adminListAllUsers,
        adminRestoreUserState,
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
        activeGwsTimer,
        updateActiveGwsTimer,
        clearActiveGwsTimer,
        addGWSSession,
        updateGWSSession,
        deleteGWSSession,
        getWeeklyPlan,
        saveWeeklyPlan,
        getMonthlyPlan,
        saveMonthlyPlan,
        getYearlyPlan,
        saveYearlyPlan,
        saveTemplate,
        deleteTemplate,
        resetTemplatesToDefault,
        saveReview,
        deleteReview,
        saveChecklistCategories,
        saveChecklistItems,
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
