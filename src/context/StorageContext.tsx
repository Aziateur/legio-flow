import React, { createContext, startTransition, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  Template,
  DailyEntry,
  DailyPriorityItem,
  GWSSession,
  ActiveGWSTimer,
  WeeklyPlan,
  MonthlyPlan,
  QuarterlyPlan,
  YearlyPlan,
  ScoreboardMetric,
  LifePillar,
  CustomReviewPrompt,
  MacroReviewSettings,
  TargetGateRef,
  TaskItem,
  ReviewEntry,
  SystemLevel,
  ChecklistCategory,
  ChecklistItem,
  AllowanceItem,
  StrategyPlan,
  ProblemEntry,
  ProblemCategory,
  CustomProblemCategory,
  ProblemSettings,
  ProblemScale,
  ProblemImpact,
  ProblemSeverity,
  ProblemStatus,
  ProblemFixType,
  ProblemFixAttempt,
  ProblemCheckIn,
  ProblemCheckInOutcome,
  ProblemSourceType,
  ProblemOccurrence,
  ProblemDispatchTarget,
  PlaybookEntry,
  PlaybookKind,
  DailyEnergyCheck
} from '../types/schema';
import {
  daysBetweenDates,
  defaultScaleForSource,
  getDescendantProblems,
  getProblemActionText,
  getProblemReminderText,
  guessProblemCategory,
  normalizeTag,
  problemHasTag,
  resolveProblemRoadmapPlanId,
  severityToImpact,
  tagsMatch
} from '../lib/problems';
import { getWeeklyGoalsAssignedToRoadmap, isActiveStrategyPlan } from '../lib/planHierarchy';
import {
  coerceActiveTabForLevel,
  coercePlanningSubTabForLevel,
  coerceReviewSubTabForLevel,
  rememberNormalLevel
} from '../lib/levelFeatures';
import {
  DEFAULT_TEMPLATES,
  INITIAL_DAILY_ENTRIES,
  INITIAL_GWS_SESSIONS,
  INITIAL_WEEKLY_PLANS,
  INITIAL_MONTHLY_PLANS,
  INITIAL_QUARTERLY_PLANS,
  INITIAL_YEARLY_PLANS,
  INITIAL_LIFE_PILLARS,
  INITIAL_CUSTOM_REVIEW_PROMPTS,
  INITIAL_PROBLEM_CATEGORIES,
  DEFAULT_PROBLEM_SETTINGS,
  INITIAL_CHECKLIST_CATEGORIES,
  INITIAL_CHECKLIST_ITEMS,
  INITIAL_ALLOWANCE_ITEMS,
  INITIAL_STRATEGY_PLANS
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
export type PlanningSubTab = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'roadmaps' | 'matrix';
export type ReviewSubTab = 'vault' | 'problems' | 'playbook' | 'daily' | 'gws' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

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
const LAST_CLOUD_UPDATED_AT_KEY = 'legio_last_cloud_updated_at_v1';
const DELETED_IDS_KEY = 'legio_deleted_ids_v1';
const AUTO_SNAPSHOTS_KEY = 'legio_auto_snapshots_v1';
const SELECTED_WEEK_ID_KEY = 'legio_selected_week_id';
const EMPTY_WEEK_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const MAX_AUTO_SNAPSHOTS = 4;
const MAX_SNAPSHOTS_TOTAL_BYTES = 600 * 1024; // ~600KB cap so snapshots never threaten 5MB iOS Safari localStorage quota
const TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export interface LocalRecoverySnapshot {
  id: string;
  savedAt: string;
  reason: string;
  summary: string;
  state: Record<string, any>;
}

const pruneTombstones = (map: Record<string, string>): Record<string, string> => {
  const cutoff = Date.now() - TOMBSTONE_RETENTION_MS;
  const cleaned: Record<string, string> = {};
  Object.entries(map || {}).forEach(([id, ts]) => {
    const ms = Date.parse(ts || '');
    if (id && !Number.isNaN(ms) && ms >= cutoff) {
      cleaned[id] = ts;
    }
  });
  return cleaned;
};

const readStorageSafe = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorageSafe = (key: string, value: unknown): void => {
  const serialized = JSON.stringify(value);
  try {
    localStorage.setItem(key, serialized);
  } catch (e) {
    // If localStorage quota is tight (e.g. iOS Safari 5MB cap), evict auto-snapshots and retry critical data writes!
    if (key !== AUTO_SNAPSHOTS_KEY) {
      try {
        localStorage.removeItem(AUTO_SNAPSHOTS_KEY);
        localStorage.setItem(key, serialized);
        return;
      } catch (retryErr) {
        console.error(`Failed to persist ${key} even after freeing snapshots`, retryErr);
        return;
      }
    }
    console.error(`Failed to persist ${key}`, e);
  }
};

// Coalesce high-frequency localStorage writes (250ms per key) so typing bursts never block the main thread with repeated JSON.stringify calls.
// Always flushed synchronously on visibilitychange (hidden), pagehide, and beforeunload so zero edits are ever lost.
const pendingStorageWrites = new Map<string, unknown>();
const pendingStorageTimers = new Map<string, ReturnType<typeof setTimeout>>();

const writeStorageCoalesced = (key: string, value: unknown): void => {
  pendingStorageWrites.set(key, value);
  const existingTimer = pendingStorageTimers.get(key);
  if (existingTimer) clearTimeout(existingTimer);
  pendingStorageTimers.set(
    key,
    setTimeout(() => {
      pendingStorageTimers.delete(key);
      if (pendingStorageWrites.has(key)) {
        const latest = pendingStorageWrites.get(key);
        pendingStorageWrites.delete(key);
        writeStorageSafe(key, latest);
      }
    }, 250)
  );
};

const flushPendingStorageWrites = (): void => {
  pendingStorageTimers.forEach(timer => clearTimeout(timer));
  pendingStorageTimers.clear();
  pendingStorageWrites.forEach((value, key) => {
    writeStorageSafe(key, value);
  });
  pendingStorageWrites.clear();
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
        ...(matched?.subTaskId ? { subTaskId: matched.subTaskId } : {}),
        ...(matched?.checklistItemId ? { checklistItemId: matched.checklistItemId } : {}),
        ...(matched?.pushedToDate ? { pushedToDate: matched.pushedToDate } : {}),
        ...(matched?.pushedFromDate ? { pushedFromDate: matched.pushedFromDate } : {})
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
    mainTasksTotal: entry.mainTasksTotal && entry.mainTasksTotal >= 1 ? entry.mainTasksTotal : 3
  };
};

export type DailyChecklistDayState = 'done' | 'missed' | 'pending_today' | 'untracked' | 'upcoming';

const extractIsoDate = (raw?: string): string | undefined => {
  if (!raw || typeof raw !== 'string') return undefined;
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : undefined;
};

export function getChecklistTrackingStartDate(
  checklistItems: ChecklistItem[],
  dailyEntries: Record<string, DailyEntry>,
  todayDate: string
): string {
  const candidates: string[] = [];
  checklistItems
    .filter(i => i.recurrence === 'daily')
    .forEach(item => {
      const created = extractIsoDate(item.createdAt);
      if (created) candidates.push(created);
      (item.completedPeriods || []).forEach(p => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(p)) candidates.push(p);
      });
    });
  Object.values(dailyEntries).forEach(entry => {
    if (entry?.automaticTasksCompleted && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
      candidates.push(entry.date);
    }
  });
  if (candidates.length === 0) return todayDate;
  return candidates.sort()[0];
}

export function getEffectiveDailyItemStartDate(
  item: ChecklistItem,
  fallbackStartDate: string
): string {
  const dates: string[] = [];
  const created = extractIsoDate(item.createdAt);
  if (created) dates.push(created);
  (item.completedPeriods || []).forEach(p => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(p)) dates.push(p);
  });
  if (dates.length > 0) return dates.sort()[0];
  return fallbackStartDate;
}

export function getActiveDailyChecklistItemsForDate(
  dateStr: string,
  checklistItems: ChecklistItem[],
  dailyEntries: Record<string, DailyEntry>,
  todayDate: string
): ChecklistItem[] {
  const dailyItems = checklistItems.filter(i => i.recurrence === 'daily');
  const fallbackStart = getChecklistTrackingStartDate(checklistItems, dailyEntries, todayDate);
  return dailyItems.filter(item => {
    const start = getEffectiveDailyItemStartDate(item, fallbackStart);
    return start <= dateStr || (item.completedPeriods || []).includes(dateStr);
  });
}

export function getDailyChecklistStatusForDate(
  dateStr: string,
  checklistItems: ChecklistItem[],
  dailyEntries: Record<string, DailyEntry>,
  todayDate: string
): {
  state: DailyChecklistDayState;
  done: boolean;
  completedCount: number;
  activeTotal: number;
} {
  const activeItems = getActiveDailyChecklistItemsForDate(
    dateStr,
    checklistItems,
    dailyEntries,
    todayDate
  );
  const activeTotal = activeItems.length;
  const completedCount = activeItems.filter(i => (i.completedPeriods || []).includes(dateStr)).length;
  const allActiveDone = activeTotal > 0 && completedCount === activeTotal;
  const manualDone = Boolean(dailyEntries[dateStr]?.automaticTasksCompleted);
  const done = allActiveDone || manualDone;

  if (done) {
    return { state: 'done', done: true, completedCount, activeTotal };
  }
  if (dateStr > todayDate) {
    return { state: 'upcoming', done: false, completedCount, activeTotal };
  }
  if (activeTotal === 0) {
    return { state: 'untracked', done: false, completedCount: 0, activeTotal: 0 };
  }
  if (dateStr === todayDate) {
    return { state: 'pending_today', done: false, completedCount, activeTotal };
  }
  return { state: 'missed', done: false, completedCount, activeTotal };
}

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
  quarterlyPlans: Record<string, QuarterlyPlan>;
  yearlyPlans: Record<string, YearlyPlan>;
  lifePillars: LifePillar[];
  customReviewPrompts: CustomReviewPrompt[];
  macroReviewSettings: MacroReviewSettings;
  problemCategories: CustomProblemCategory[];
  problemSettings: ProblemSettings;
  strategyPlans: StrategyPlan[];
  problems: ProblemEntry[];
  reviews: ReviewEntry[];
  checklistCategories: ChecklistCategory[];
  checklistItems: ChecklistItem[];
  allowanceItems: AllowanceItem[];
  playbookItems: PlaybookEntry[];
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

  // Quarterly operations
  getQuarterlyPlan: (quarterKey: string) => QuarterlyPlan;
  saveQuarterlyPlan: (plan: QuarterlyPlan) => void;

  // Yearly operations
  getYearlyPlan: (yearKey: string) => YearlyPlan;
  saveYearlyPlan: (plan: YearlyPlan) => void;

  // Custom Life Pillars, Macro Review & Problem Customization
  saveLifePillars: (pillars: LifePillar[]) => void;
  saveCustomReviewPrompts: (prompts: CustomReviewPrompt[]) => void;
  saveMacroReviewSettings: (settings: MacroReviewSettings) => void;
  saveProblemCategories: (categories: CustomProblemCategory[]) => void;
  saveProblemSettings: (settings: ProblemSettings) => void;

  // Written Strategy Roadmap Plans
  saveStrategyPlan: (plan: StrategyPlan) => void;
  deleteStrategyPlan: (id: string) => void;

  // Problem Logging & Feedback Loop
  addProblem: (input: {
    title: string;
    category: ProblemCategory;
    classified?: boolean;
    scale?: ProblemScale;
    impact?: ProblemImpact;
    severity?: ProblemSeverity;
    isTopConstraint?: boolean;
    watching?: boolean;
    watchQuestion?: string;
    promptNoteOnHit?: boolean;
    trigger?: string;
    rootCause?: string;
    isGuardrail?: boolean;
    reminderText?: string;
    verifyDays?: number;
    parentProblemId?: string;
    roadmapPlanId?: string;
    tags?: string[];
    sourceType: ProblemSourceType;
    date: string;
    sourceRef?: string;
    note?: string;
    fixType?: ProblemFixType;
    fixNote?: string;
    status?: ProblemStatus;
  }) => ProblemEntry;
  updateProblem: (id: string, patch: Partial<ProblemEntry>) => void;
  recordProblemRecurrence: (id: string, occurrence: ProblemOccurrence) => void;
  recordProblemHeld: (id: string, date?: string) => void;
  recordProblemCheckIn: (
    id: string,
    outcome: ProblemCheckInOutcome | null,
    options?: {
      date?: string;
      sourceType?: ProblemSourceType;
      sourceRef?: string;
      note?: string;
    }
  ) => void;
  noteProblemTweak: (id: string, note: string, options?: { date?: string }) => void;
  reviseProblemSolution: (
    id: string,
    revision: {
      reminderText?: string;
      fixNote?: string;
      trigger?: string;
      note?: string;
      restartTest?: boolean;
      date?: string;
      markTweaksAppliedOnly?: boolean;
    }
  ) => void;
  clusterIntoNewParent: (
    childId: string,
    parentTitle: string,
    parentScale: 'bottleneck' | 'blocker'
  ) => ProblemEntry | null;
  deleteProblem: (id: string) => void;
  deleteProblemOccurrence: (problemId: string, occurrenceIndex: number) => void;
  deleteProblemCheckIn: (problemId: string, date: string) => void;
  deleteProblemFixAttempt: (problemId: string, attemptId: string) => void;
  dispatchProblemFix: (
    problemId: string,
    destination: ProblemDispatchTarget,
    customText?: string,
    targetWeekId?: string
  ) => boolean;

  // Template operations (Modularity)
  saveTemplate: (template: Template) => void;
  deleteTemplate: (id: string) => void;
  resetTemplatesToDefault: () => void;

  // Review operations
  saveReview: (review: ReviewEntry) => void;
  deleteReview: (id: string) => void;

  // Checklist, Allowances & What Works Playbook operations
  saveChecklistCategories: (cats: ChecklistCategory[]) => void;
  saveChecklistItems: (items: ChecklistItem[]) => void;
  saveAllowanceItems: (items: AllowanceItem[]) => void;
  addPlaybookItem: (input: { kind: PlaybookKind; title: string; note?: string; pinned?: boolean; tags?: string[] }) => PlaybookEntry;
  updatePlaybookItem: (id: string, patch: Partial<PlaybookEntry>) => void;
  deletePlaybookItem: (id: string) => void;

  // Data portability & local recovery safety net
  localSnapshots: LocalRecoverySnapshot[];
  restoreLocalSnapshot: (snapshotId: string) => boolean;
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
  QUARTERLY: 'legio_quarterly_plans_v1',
  YEARLY: 'legio_yearly_plans_v1',
  LIFE_PILLARS: 'legio_life_pillars_v1',
  CUSTOM_PROMPTS: 'legio_custom_review_prompts_v1',
  MACRO_SETTINGS: 'legio_macro_review_settings_v1',
  PROBLEM_CATEGORIES: 'legio_problem_categories_v1',
  PROBLEM_SETTINGS: 'legio_problem_settings_v1',
  STRATEGY_PLANS: 'legio_strategy_plans_v1',
  PROBLEMS: 'legio_problems_v1',
  REVIEWS: 'legio_reviews_v1',
  CHECKLIST_CATEGORIES: 'legio_checklist_cats_v1',
  CHECKLIST_ITEMS: 'legio_checklist_items_v1',
  ALLOWANCES: 'legio_allowances_v1',
  PLAYBOOK: 'legio_playbook_v1',
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
        topFocuses: Array.isArray(p?.topFocuses) ? p.topFocuses : undefined,
        notes: p?.notes || '',
        tasks: Array.isArray(p?.tasks) ? p.tasks : [],
        scoreboard: Array.isArray(p?.scoreboard) ? p.scoreboard : [],
        updatedAt: p?.updatedAt || EMPTY_WEEK_TIMESTAMP
      };
    });
    return cleaned;
  });

  const [quarterlyPlans, setQuarterlyPlans] = useState<Record<string, QuarterlyPlan>>(() => {
    const raw = readStorageSafe<Record<string, QuarterlyPlan>>(STORAGE_KEYS.QUARTERLY, INITIAL_QUARTERLY_PLANS);
    const cleaned: Record<string, QuarterlyPlan> = {};
    Object.entries(raw || {}).forEach(([k, p]) => {
      cleaned[k] = {
        id: p?.id || k,
        quarterKey: p?.quarterKey || k,
        focusTheme: p?.focusTheme || '',
        topFocuses: Array.isArray(p?.topFocuses) ? p.topFocuses : undefined,
        notes: p?.notes || '',
        tasks: Array.isArray(p?.tasks) ? p.tasks : [],
        targetGateRefs: Array.isArray(p?.targetGateRefs) ? p.targetGateRefs : [],
        scoreboard: Array.isArray(p?.scoreboard) ? p.scoreboard : [],
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
        topFocuses: Array.isArray(p?.topFocuses) ? p.topFocuses : undefined,
        notes: p?.notes || '',
        tasks: Array.isArray(p?.tasks) ? p.tasks : [],
        targetGateRefs: Array.isArray(p?.targetGateRefs) ? p.targetGateRefs : [],
        scoreboard: Array.isArray(p?.scoreboard) ? p.scoreboard : [],
        updatedAt: p?.updatedAt || EMPTY_WEEK_TIMESTAMP
      };
    });
    return cleaned;
  });

  const [lifePillars, setLifePillars] = useState<LifePillar[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LIFE_PILLARS);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_LIFE_PILLARS;
  });

  const [customReviewPrompts, setCustomReviewPrompts] = useState<CustomReviewPrompt[]>(() => {
    const raw = readStorageSafe<CustomReviewPrompt[]>(
      STORAGE_KEYS.CUSTOM_PROMPTS,
      INITIAL_CUSTOM_REVIEW_PROMPTS
    );
    return Array.isArray(raw) ? raw : INITIAL_CUSTOM_REVIEW_PROMPTS;
  });

  const [macroReviewSettings, setMacroReviewSettings] = useState<MacroReviewSettings>(() => {
    const raw = readStorageSafe<MacroReviewSettings>(STORAGE_KEYS.MACRO_SETTINGS, {});
    return raw && typeof raw === 'object' ? raw : {};
  });

  const [problemCategories, setProblemCategories] = useState<CustomProblemCategory[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROBLEM_CATEGORIES);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_PROBLEM_CATEGORIES;
  });

  const [problemSettings, setProblemSettings] = useState<ProblemSettings>(() => {
    const raw = readStorageSafe<ProblemSettings>(
      STORAGE_KEYS.PROBLEM_SETTINGS,
      DEFAULT_PROBLEM_SETTINGS
    );
    return {
      ...DEFAULT_PROBLEM_SETTINGS,
      ...(raw && typeof raw === 'object' ? raw : {})
    };
  });

  const [strategyPlans, setStrategyPlans] = useState<StrategyPlan[]>(() => {
    const raw = readStorageSafe<StrategyPlan[]>(STORAGE_KEYS.STRATEGY_PLANS, INITIAL_STRATEGY_PLANS);
    return Array.isArray(raw) ? raw : INITIAL_STRATEGY_PLANS;
  });

  const [problems, setProblems] = useState<ProblemEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROBLEMS);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      return [];
    }

    // One-time safe migration of existing free-text problems into structured ProblemEntry items
    const migrated: ProblemEntry[] = [];
    const seen = new Map<string, ProblemEntry>();
    const nowIso = new Date().toISOString();

    const pushLine = (
      rawLine: string,
      date: string,
      sourceType: ProblemSourceType,
      sourceRef?: string
    ) => {
      const cleaned = rawLine
        .replace(/^[•\-\*]\s*/, '')
        .replace(/^\[[^\]]+\]\s*/, '')
        .trim();
      if (!cleaned || cleaned.length < 3) return;
      const key = cleaned.toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        const dupOcc = existing.occurrences.some(
          o => o.date === date && o.sourceType === sourceType
        );
        if (!dupOcc) {
          existing.occurrences.push({ date, sourceType, ...(sourceRef ? { sourceRef } : {}) });
        }
        return;
      }
      const entry: ProblemEntry = {
        id: `prob_mig_${migrated.length + 1}_${date.replace(/-/g, '')}`,
        title: cleaned,
        category: guessProblemCategory(cleaned),
        tags: [],
        status: 'open',
        occurrences: [{ date, sourceType, ...(sourceRef ? { sourceRef } : {}) }],
        createdAt: `${date}T12:00:00.000Z`,
        updatedAt: nowIso
      };
      seen.set(key, entry);
      migrated.push(entry);
    };

    Object.entries(dailyEntries).forEach(([d, entry]) => {
      if (entry.problemsEncountered?.trim()) {
        entry.problemsEncountered
          .split('\n')
          .forEach(line => pushLine(line, d, 'daily', d));
      }
    });

    gwsSessions.forEach(s => {
      if (s.reflexions?.heldBack?.trim()) {
        s.reflexions.heldBack
          .split('\n')
          .forEach(line => pushLine(line, s.date, 'gws', s.taskName));
      }
    });

    Object.values(weeklyPlans).forEach(w => {
      if (w.problemsEncountered?.trim()) {
        w.problemsEncountered
          .split('\n')
          .forEach(line => pushLine(line, w.endDate || w.startDate, 'weekly', w.id));
      }
    });

    writeStorageSafe(STORAGE_KEYS.PROBLEMS, migrated);
    return migrated;
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

  const [allowanceItems, setAllowanceItems] = useState<AllowanceItem[]>(() => {
    const raw = readStorageSafe<AllowanceItem[]>(STORAGE_KEYS.ALLOWANCES, INITIAL_ALLOWANCE_ITEMS);
    return Array.isArray(raw) ? raw : INITIAL_ALLOWANCE_ITEMS;
  });

  const [playbookItems, setPlaybookItems] = useState<PlaybookEntry[]>(() => {
    const raw = readStorageSafe<PlaybookEntry[]>(STORAGE_KEYS.PLAYBOOK, []);
    return Array.isArray(raw) ? raw : [];
  });

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

  // Progressive System Level (0 to 5): preserve existing users, start brand-new blank browsers at LVL 1
  const [systemLevel, setSystemLevelState] = useState<SystemLevel>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SYSTEM_LEVEL);
      if (saved !== null && saved !== '') {
        const parsed = parseInt(saved, 10);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 5) {
          if (parsed >= 1) rememberNormalLevel(parsed as SystemLevel);
          return parsed as SystemLevel;
        }
      }
      const hasExistingLocalData = Boolean(
        localStorage.getItem(STORAGE_KEYS.DAILY) ||
          localStorage.getItem(STORAGE_KEYS.WEEKLY) ||
          localStorage.getItem(STORAGE_KEYS.GWS) ||
          localStorage.getItem(STORAGE_KEYS.STRATEGY_PLANS)
      );
      const fallback: SystemLevel = hasExistingLocalData ? 5 : 1;
      rememberNormalLevel(fallback);
      return fallback;
    } catch {
      return 1;
    }
  });

  // Authoritative synchronous state refs (prevents stale closures & ensures immediate local/cloud saves)
  const templatesRef = useRef(templates);
  const dailyEntriesRef = useRef(dailyEntries);
  const gwsSessionsRef = useRef(gwsSessions);
  const weeklyPlansRef = useRef(weeklyPlans);
  const monthlyPlansRef = useRef(monthlyPlans);
  const quarterlyPlansRef = useRef(quarterlyPlans);
  const yearlyPlansRef = useRef(yearlyPlans);
  const lifePillarsRef = useRef(lifePillars);
  const customReviewPromptsRef = useRef(customReviewPrompts);
  const macroReviewSettingsRef = useRef(macroReviewSettings);
  const problemCategoriesRef = useRef(problemCategories);
  const problemSettingsRef = useRef(problemSettings);
  const strategyPlansRef = useRef(strategyPlans);
  const problemsRef = useRef(problems);
  const reviewsRef = useRef(reviews);
  const checklistCategoriesRef = useRef(checklistCategories);
  const checklistItemsRef = useRef(checklistItems);
  const allowanceItemsRef = useRef(allowanceItems);
  const playbookItemsRef = useRef(playbookItems);
  const systemLevelRef = useRef(systemLevel);
  const todayDateRef = useRef(todayDate);
  const selectedDateRef = useRef(selectedDate);
  const selectedWeekIdRef = useRef(selectedWeekId);
  const deletedIdsRef = useRef<Record<string, string>>(
    pruneTombstones(readStorageSafe<Record<string, string>>(DELETED_IDS_KEY, {}))
  );
  const [localSnapshots, setLocalSnapshots] = useState<LocalRecoverySnapshot[]>(() => {
    const raw = readStorageSafe<LocalRecoverySnapshot[]>(AUTO_SNAPSHOTS_KEY, []);
    return Array.isArray(raw) ? raw : [];
  });
  const localSnapshotsRef = useRef<LocalRecoverySnapshot[]>(localSnapshots);

  todayDateRef.current = todayDate;
  selectedDateRef.current = selectedDate;
  selectedWeekIdRef.current = selectedWeekId;

  const commitDeletedIds = (next: Record<string, string>) => {
    const pruned = pruneTombstones(next);
    deletedIdsRef.current = pruned;
    writeStorageSafe(DELETED_IDS_KEY, pruned);
  };

  const recordDeletedIds = (ids: string[]) => {
    if (ids.length === 0) return;
    const nowIso = new Date().toISOString();
    const next = { ...deletedIdsRef.current };
    ids.forEach(id => {
      if (id) next[id] = nowIso;
    });
    commitDeletedIds(next);
  };

  const clearDeletedId = (id: string) => {
    if (!id || !deletedIdsRef.current[id]) return;
    const next = { ...deletedIdsRef.current };
    delete next[id];
    commitDeletedIds(next);
  };

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
  const isPullingRef = useRef(false);
  const lastResumeCheckAtRef = useRef(0);
  const hasCompletedInitialCloudSyncRef = useRef(false);
  const lastSyncedCloudUpdatedAtRef = useRef<string | null>((() => {
    try {
      return localStorage.getItem(LAST_CLOUD_UPDATED_AT_KEY);
    } catch {
      return null;
    }
  })());

  const setLastSyncedCloudUpdatedAt = (ts: string | null) => {
    lastSyncedCloudUpdatedAtRef.current = ts;
    try {
      if (ts) {
        localStorage.setItem(LAST_CLOUD_UPDATED_AT_KEY, ts);
      } else {
        localStorage.removeItem(LAST_CLOUD_UPDATED_AT_KEY);
      }
    } catch {
      // ignore
    }
  };

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

  // --- SYNCHRONOUS MEMORY + COALESCED LOCALSTORAGE COMMIT HELPERS ---
  const commitTemplates = (next: Template[]) => {
    templatesRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.TEMPLATES, next);
    setTemplates(next);
  };

  const commitDailyEntries = (next: Record<string, DailyEntry>) => {
    dailyEntriesRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.DAILY, next);
    setDailyEntries(next);
  };

  const commitGwsSessions = (next: GWSSession[]) => {
    gwsSessionsRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.GWS, next);
    setGwsSessions(next);
  };

  const commitWeeklyPlans = (next: Record<string, WeeklyPlan>) => {
    weeklyPlansRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.WEEKLY, next);
    setWeeklyPlans(next);
  };

  const commitMonthlyPlans = (next: Record<string, MonthlyPlan>) => {
    monthlyPlansRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.MONTHLY, next);
    setMonthlyPlans(next);
  };

  const commitQuarterlyPlans = (next: Record<string, QuarterlyPlan>) => {
    quarterlyPlansRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.QUARTERLY, next);
    setQuarterlyPlans(next);
  };

  const commitYearlyPlans = (next: Record<string, YearlyPlan>) => {
    yearlyPlansRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.YEARLY, next);
    setYearlyPlans(next);
  };

  const commitLifePillars = (next: LifePillar[]) => {
    lifePillarsRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.LIFE_PILLARS, next);
    setLifePillars(next);
  };

  const commitCustomReviewPrompts = (next: CustomReviewPrompt[]) => {
    customReviewPromptsRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.CUSTOM_PROMPTS, next);
    setCustomReviewPrompts(next);
  };

  const commitMacroReviewSettings = (next: MacroReviewSettings) => {
    macroReviewSettingsRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.MACRO_SETTINGS, next);
    setMacroReviewSettings(next);
  };

  const commitProblemCategories = (next: CustomProblemCategory[]) => {
    problemCategoriesRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.PROBLEM_CATEGORIES, next);
    setProblemCategories(next);
  };

  const commitProblemSettings = (next: ProblemSettings) => {
    const merged = { ...DEFAULT_PROBLEM_SETTINGS, ...next };
    problemSettingsRef.current = merged;
    writeStorageCoalesced(STORAGE_KEYS.PROBLEM_SETTINGS, merged);
    setProblemSettings(merged);
  };

  const commitStrategyPlans = (next: StrategyPlan[]) => {
    strategyPlansRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.STRATEGY_PLANS, next);
    setStrategyPlans(next);
  };

  const commitProblems = (next: ProblemEntry[]) => {
    problemsRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.PROBLEMS, next);
    setProblems(next);
  };

  const commitReviews = (next: ReviewEntry[]) => {
    reviewsRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.REVIEWS, next);
    setReviews(next);
  };

  const commitChecklistCategories = (next: ChecklistCategory[]) => {
    checklistCategoriesRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.CHECKLIST_CATEGORIES, next);
    setChecklistCategories(next);
  };

  const commitChecklistItems = (next: ChecklistItem[]) => {
    checklistItemsRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.CHECKLIST_ITEMS, next);
    setChecklistItems(next);
  };

  const commitAllowanceItems = (next: AllowanceItem[]) => {
    allowanceItemsRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.ALLOWANCES, next);
    setAllowanceItems(next);
  };

  const commitPlaybookItems = (next: PlaybookEntry[]) => {
    playbookItemsRef.current = next;
    writeStorageCoalesced(STORAGE_KEYS.PLAYBOOK, next);
    setPlaybookItems(next);
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
      schemaVersion: 2,
      onboardingStartDate: getEffectiveEpochMonday(weeklyPlansRef.current),
      templates: templatesRef.current,
      dailyEntries: dailyEntriesRef.current,
      gwsSessions: gwsSessionsRef.current,
      weeklyPlans: weeklyPlansRef.current,
      monthlyPlans: monthlyPlansRef.current,
      quarterlyPlans: quarterlyPlansRef.current,
      yearlyPlans: yearlyPlansRef.current,
      lifePillars: lifePillarsRef.current,
      customReviewPrompts: customReviewPromptsRef.current,
      macroReviewSettings: macroReviewSettingsRef.current,
      problemCategories: problemCategoriesRef.current,
      problemSettings: problemSettingsRef.current,
      strategyPlans: strategyPlansRef.current,
      problems: problemsRef.current,
      reviews: reviewsRef.current,
      checklistCategories: checklistCategoriesRef.current,
      checklistItems: checklistItemsRef.current,
      allowanceItems: allowanceItemsRef.current,
      playbookItems: playbookItemsRef.current,
      deletedIds: deletedIdsRef.current,
      systemLevel: systemLevelRef.current,
      clientUpdatedAt
    };
  };

  const summarizeStateSnapshot = (st: Record<string, any>): string => {
    const days = Object.keys(st.dailyEntries || {}).length;
    const gws = Array.isArray(st.gwsSessions) ? st.gwsSessions.length : 0;
    const plans = Array.isArray(st.strategyPlans) ? st.strategyPlans.length : 0;
    const probs = Array.isArray(st.problems) ? st.problems.length : 0;
    const checks = Array.isArray(st.checklistItems) ? st.checklistItems.length : 0;
    const revs = Array.isArray(st.reviews) ? st.reviews.length : 0;
    return `${days}d · ${gws} GWS · ${plans} plans · ${probs} probs · ${checks} habits · ${revs} revs`;
  };

  const saveAutoLocalSnapshot = (reason: string) => {
    try {
      const payload = buildCloudPayloadFromRefs();
      const summary = summarizeStateSnapshot(payload);
      // Avoid duplicate back-to-back identical snapshots across ALL state domains
      const latest = localSnapshotsRef.current[0];
      if (latest) {
        const makeSig = (st: Record<string, any>) =>
          JSON.stringify({
            d: st.dailyEntries,
            g: st.gwsSessions,
            w: st.weeklyPlans,
            m: st.monthlyPlans,
            q: st.quarterlyPlans,
            y: st.yearlyPlans,
            lp: st.lifePillars,
            crp: st.customReviewPrompts,
            mrs: st.macroReviewSettings,
            pc: st.problemCategories,
            ps: st.problemSettings,
            s: st.strategyPlans,
            p: st.problems,
            r: st.reviews,
            c: st.checklistItems,
            al: st.allowanceItems,
            pb: st.playbookItems
          });
        if (makeSig(latest.state) === makeSig(payload)) return;
      }
      const snap: LocalRecoverySnapshot = {
        id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        savedAt: new Date().toISOString(),
        reason,
        summary,
        state: payload
      };
      let next = [snap, ...localSnapshotsRef.current].slice(0, MAX_AUTO_SNAPSHOTS);
      while (next.length > 1 && JSON.stringify(next).length > MAX_SNAPSHOTS_TOTAL_BYTES) {
        next = next.slice(0, -1);
      }
      localSnapshotsRef.current = next;
      setLocalSnapshots(next);
      writeStorageSafe(AUTO_SNAPSHOTS_KEY, next);
    } catch {
      // Never fail main flow if localStorage quota is tight
    }
  };

  // Bridge ref so early-declared push/resume functions can call merge/apply safely without hoisting issues
  const syncHelpersRef = useRef<{
    applyCloudPayload: (state: any, options?: { skipSnapshot?: boolean; snapshotReason?: string }) => void;
    mergeLocalAndCloudState: (cloudState: any, cloudRowUpdatedAt?: string) => { mergedState: any; needsCloudPush: boolean };
    loadUserCloudState: (userId: string, options?: { initialPayloadOverride?: any; preferCloudDirectly?: boolean }) => Promise<void>;
  } | null>(null);

  const flushCloudPushNow = async (options?: { skipPrePullCheck?: boolean }) => {
    const user = authUserRef.current;
    if (!user) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    // BOOT SYNC GATE: Never push stale local cache before initial cloud hydration completes!
    if (!hasCompletedInitialCloudSyncRef.current && !options?.skipPrePullCheck) {
      queuedPushRef.current = true;
      return;
    }

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
      // PULL-BEFORE-PUSH CONCURRENCY GUARD:
      // Check if another device (e.g. desktop vs phone) wrote a newer row since our last sync.
      // If so, deep-merge per-item BEFORE pushing so a stale tab can NEVER overwrite newer data!
      if (!options?.skipPrePullCheck && syncHelpersRef.current) {
        const { data: headRow, error: headErr } = await supabase
          .from('legio_user_state')
          .select('updated_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!headErr && headRow?.updated_at && headRow.updated_at !== lastSyncedCloudUpdatedAtRef.current) {
          const { data: fullRow, error: fullErr } = await supabase
            .from('legio_user_state')
            .select('state, updated_at')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!fullErr && fullRow?.state) {
            const { mergedState } = syncHelpersRef.current.mergeLocalAndCloudState(
              fullRow.state,
              fullRow.updated_at
            );
            syncHelpersRef.current.applyCloudPayload(mergedState, {
              snapshotReason: 'Before multi-device merge'
            });
            setLastSyncedCloudUpdatedAt(fullRow.updated_at);
            snapshotMutationAt = new Date().toISOString();
            try {
              localStorage.setItem(LAST_MUTATION_AT_KEY, snapshotMutationAt);
            } catch {
              // ignore
            }
          }
        }
      }

      const payload = buildCloudPayloadFromRefs(snapshotMutationAt);
      const pushTimestamp = new Date().toISOString();
      const { data: savedRow, error } = await supabase
        .from('legio_user_state')
        .upsert(
          {
            user_id: user.id,
            display_name: user.displayName || user.email,
            state: payload,
            updated_at: pushTimestamp
          },
          { onConflict: 'user_id' }
        )
        .select('updated_at')
        .maybeSingle();

      if (error) {
        setSyncStatus('error');
        setSyncError(error.message);
      } else {
        setSyncStatus('synced');
        setSyncError(null);
        setLastSyncedCloudUpdatedAt(savedRow?.updated_at || pushTimestamp);
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
    // 1000ms coalesce so typing bursts upload once instead of per-word (localStorage is instant + tab unload flushes via keepalive)
    pushTimerRef.current = setTimeout(() => {
      pushTimerRef.current = null;
      void flushCloudPushNow();
    }, 1000);
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
    // Never fire an unguarded keepalive overwrite if initial cloud sync hasn't finished or no synced baseline exists!
    if (!hasCompletedInitialCloudSyncRef.current || !lastSyncedCloudUpdatedAtRef.current) return;

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
      const pushTimestamp = new Date().toISOString();
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
          updated_at: pushTimestamp
        }),
        keepalive: true
      }).catch(() => {
        // Pending flag stays 'true' in localStorage so next reload recovers and pushes
      });
    } catch {
      // ignore
    }
  };

  // Automatic wake-up sync when returning to a sleeping mobile/desktop tab or regaining connection
  const checkAndPullCloudOnResume = async () => {
    const realToday = getTodayDateString();
    if (realToday !== todayDateRef.current) {
      const prevToday = todayDateRef.current;
      setTodayDate(realToday);
      if (selectedDateRef.current === prevToday) {
        selectedDateRef.current = realToday;
        setSelectedDateState(realToday);
      }
    }

    const user = authUserRef.current;
    if (!user || isPullingRef.current || isPushingRef.current) return;
    const now = Date.now();
    if (now - lastResumeCheckAtRef.current < 4000) return;
    lastResumeCheckAtRef.current = now;

    const supabase = getSupabaseClient();
    if (!supabase || !syncHelpersRef.current) return;

    try {
      const { data: headRow, error } = await supabase
        .from('legio_user_state')
        .select('updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) return;
      if (
        !hasCompletedInitialCloudSyncRef.current ||
        (headRow?.updated_at && headRow.updated_at !== lastSyncedCloudUpdatedAtRef.current)
      ) {
        await syncHelpersRef.current.loadUserCloudState(user.id);
      }
    } catch {
      // Offline / transient network hiccup — ignore silently
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

  // Wake-up sync on mobile tab resume / focus / online + guarded flush on hide / unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkAndPullCloudOnResume();
      } else if (document.visibilityState === 'hidden') {
        flushPendingStorageWrites();
        // Use pull-before-push guarded flush if any mutation is pending
        let hasPending = false;
        try {
          hasPending = localStorage.getItem(PENDING_CLOUD_PUSH_KEY) === 'true' || !!pushTimerRef.current;
        } catch {
          hasPending = !!pushTimerRef.current;
        }
        if (hasPending && hasCompletedInitialCloudSyncRef.current) {
          void flushCloudPushNow();
        }
      }
    };
    const handleFocusOrOnline = () => {
      void checkAndPullCloudOnResume();
    };
    const handleUnload = () => {
      flushPendingStorageWrites();
      flushCloudPushKeepalive();
    };
    // Cross-tab live sync on the same browser so two open tabs never push stale in-memory refs over each other
    const handleStorageEvent = (e: StorageEvent) => {
      if (!e.key || e.newValue === null) return;
      try {
        if (e.key === STORAGE_KEYS.DAILY) {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            dailyEntriesRef.current = parsed;
            setDailyEntries(parsed);
          }
        } else if (e.key === STORAGE_KEYS.GWS) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            gwsSessionsRef.current = parsed;
            setGwsSessions(parsed);
          }
        } else if (e.key === STORAGE_KEYS.WEEKLY) {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            weeklyPlansRef.current = parsed;
            setWeeklyPlans(parsed);
          }
        } else if (e.key === STORAGE_KEYS.MONTHLY) {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            monthlyPlansRef.current = parsed;
            setMonthlyPlans(parsed);
          }
        } else if (e.key === STORAGE_KEYS.QUARTERLY) {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            quarterlyPlansRef.current = parsed;
            setQuarterlyPlans(parsed);
          }
        } else if (e.key === STORAGE_KEYS.YEARLY) {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            yearlyPlansRef.current = parsed;
            setYearlyPlans(parsed);
          }
        } else if (e.key === STORAGE_KEYS.LIFE_PILLARS) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            lifePillarsRef.current = parsed;
            setLifePillars(parsed);
          }
        } else if (e.key === STORAGE_KEYS.CUSTOM_PROMPTS) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            customReviewPromptsRef.current = parsed;
            setCustomReviewPrompts(parsed);
          }
        } else if (e.key === STORAGE_KEYS.MACRO_SETTINGS) {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            macroReviewSettingsRef.current = parsed;
            setMacroReviewSettings(parsed);
          }
        } else if (e.key === STORAGE_KEYS.PROBLEM_CATEGORIES) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            problemCategoriesRef.current = parsed;
            setProblemCategories(parsed);
          }
        } else if (e.key === STORAGE_KEYS.PROBLEM_SETTINGS) {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            const merged = { ...DEFAULT_PROBLEM_SETTINGS, ...parsed };
            problemSettingsRef.current = merged;
            setProblemSettings(merged);
          }
        } else if (e.key === STORAGE_KEYS.STRATEGY_PLANS) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            strategyPlansRef.current = parsed;
            setStrategyPlans(parsed);
          }
        } else if (e.key === STORAGE_KEYS.PROBLEMS) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            problemsRef.current = parsed;
            setProblems(parsed);
          }
        } else if (e.key === STORAGE_KEYS.REVIEWS) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            reviewsRef.current = parsed;
            setReviews(parsed);
          }
        } else if (e.key === STORAGE_KEYS.CHECKLIST_ITEMS) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            checklistItemsRef.current = parsed;
            setChecklistItems(parsed);
          }
        } else if (e.key === STORAGE_KEYS.ALLOWANCES) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            allowanceItemsRef.current = parsed;
            setAllowanceItems(parsed);
          }
        } else if (e.key === STORAGE_KEYS.PLAYBOOK) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            playbookItemsRef.current = parsed;
            setPlaybookItems(parsed);
          }
        } else if (e.key === STORAGE_KEYS.CHECKLIST_CATEGORIES) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            checklistCategoriesRef.current = parsed;
            setChecklistCategories(parsed);
          }
        } else if (e.key === STORAGE_KEYS.TEMPLATES) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            templatesRef.current = parsed;
            setTemplates(parsed);
          }
        } else if (e.key === DELETED_IDS_KEY) {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            deletedIdsRef.current = pruneTombstones(parsed);
          }
        } else if (e.key === STORAGE_KEYS.SYSTEM_LEVEL && e.newValue !== null) {
          const parsed = parseInt(e.newValue, 10);
          if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 5) {
            if (parsed >= 1) rememberNormalLevel(parsed as SystemLevel);
            systemLevelRef.current = parsed as SystemLevel;
            setSystemLevelState(parsed as SystemLevel);
          }
        } else if (e.key === LAST_CLOUD_UPDATED_AT_KEY) {
          lastSyncedCloudUpdatedAtRef.current = e.newValue;
        }
      } catch {
        // Ignore malformed cross-tab payloads
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocusOrOnline);
    window.addEventListener('online', handleFocusOrOnline);
    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocusOrOnline);
      window.removeEventListener('online', handleFocusOrOnline);
      window.removeEventListener('storage', handleStorageEvent);
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
    if (lvl >= 1) rememberNormalLevel(lvl);
    commitSystemLevel(lvl);
    markLocalMutation();
  };

  // Parse initial route from hash (coerced to currently unlocked systemLevel)
  const parseHash = (lvl: SystemLevel = systemLevelRef.current): { main: MainTab; planningSub: PlanningSubTab; reviewSub: ReviewSubTab } => {
    const raw = window.location.hash.replace('#', '');
    const parts = raw.split('/');
    const p1 = parts[0];
    const p2 = parts[1];

    const finalize = (main: MainTab, planningSub: PlanningSubTab, reviewSub: ReviewSubTab) => ({
      main: coerceActiveTabForLevel(main, lvl),
      planningSub: coercePlanningSubTabForLevel(planningSub, lvl),
      reviewSub: coerceReviewSubTabForLevel(reviewSub, lvl)
    });

    if (p1 === 'planning') {
      const sub: PlanningSubTab =
        p2 === 'weekly' ||
        p2 === 'monthly' ||
        p2 === 'quarterly' ||
        p2 === 'yearly' ||
        p2 === 'roadmaps' ||
        p2 === 'matrix'
          ? (p2 as PlanningSubTab)
          : p2 === 'three_year' || p2 === '3year'
          ? 'yearly'
          : 'daily';
      return finalize('planning', sub, 'daily');
    }
    if (p1 === 'roadmaps' || p1 === 'strategy') {
      return finalize('planning', 'roadmaps', 'daily');
    }
    if (p1 === 'matrix' || p1 === 'spreadsheet') {
      return finalize('planning', 'matrix', 'daily');
    }
    if (p1 === 'review') {
      const sub: ReviewSubTab =
        p2 === 'daily' ||
        p2 === 'gws' ||
        p2 === 'weekly' ||
        p2 === 'monthly' ||
        p2 === 'quarterly' ||
        p2 === 'yearly' ||
        p2 === 'problems' ||
        p2 === 'playbook' ||
        p2 === 'vault'
          ? (p2 as ReviewSubTab)
          : lvl >= 3
          ? 'vault'
          : 'daily';
      return finalize('review', 'daily', sub);
    }
    if (p1 === 'checklist') return finalize('checklist', 'daily', 'daily');
    if (p1 === 'gws') return finalize('gws', 'daily', 'daily');
    if (p1 === 'templates') return finalize('templates', 'daily', 'daily');

    if (p1 === 'daily') return finalize('planning', 'daily', 'daily');
    if (p1 === 'weekly') return finalize('planning', 'weekly', 'weekly');

    return finalize('planning', 'daily', 'daily');
  };

  const initialRoute = parseHash(systemLevel);
  const [activeTab, setActiveTabState] = useState<MainTab>(initialRoute.main);
  const [planningSubTab, setPlanningSubTabState] = useState<PlanningSubTab>(initialRoute.planningSub);
  const [reviewSubTab, setReviewSubTabState] = useState<ReviewSubTab>(initialRoute.reviewSub);

  // Automatic safe tab fallback whenever systemLevel lowers so user is never stranded on a hidden tab
  useEffect(() => {
    const safeMain = coerceActiveTabForLevel(activeTab, systemLevel);
    const safePlanning = coercePlanningSubTabForLevel(planningSubTab, systemLevel);
    const safeReview = coerceReviewSubTabForLevel(reviewSubTab, systemLevel);
    if (safeMain !== activeTab) setActiveTabState(safeMain);
    if (safePlanning !== planningSubTab) setPlanningSubTabState(safePlanning);
    if (safeReview !== reviewSubTab) setReviewSubTabState(safeReview);
  }, [systemLevel, activeTab, planningSubTab, reviewSubTab]);

  const setActiveTab = (tab: MainTab) => {
    const safeTab = coerceActiveTabForLevel(tab, systemLevelRef.current);
    const safePlan = coercePlanningSubTabForLevel(planningSubTab, systemLevelRef.current);
    const safeRev = coerceReviewSubTabForLevel(reviewSubTab, systemLevelRef.current);
    startTransition(() => {
      setActiveTabState(safeTab);
      if (safeTab === 'planning' && safePlan !== planningSubTab) {
        setPlanningSubTabState(safePlan);
      } else if (safeTab === 'review' && safeRev !== reviewSubTab) {
        setReviewSubTabState(safeRev);
      }
    });
    if (safeTab === 'planning') {
      window.location.hash = `planning/${safePlan}`;
    } else if (safeTab === 'matrix') {
      window.location.hash = 'matrix';
    } else if (safeTab === 'review') {
      window.location.hash = `review/${safeRev}`;
    } else {
      window.location.hash = safeTab;
    }
  };

  const setPlanningSubTab = (sub: PlanningSubTab) => {
    const safeSub = coercePlanningSubTabForLevel(sub, systemLevelRef.current);
    startTransition(() => {
      setPlanningSubTabState(safeSub);
      setActiveTabState('planning');
    });
    window.location.hash = `planning/${safeSub}`;
  };

  const setReviewSubTab = (sub: ReviewSubTab) => {
    const safeSub = coerceReviewSubTabForLevel(sub, systemLevelRef.current);
    startTransition(() => {
      setReviewSubTabState(safeSub);
      setActiveTabState('review');
    });
    window.location.hash = `review/${safeSub}`;
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
    if (Array.isArray(updates.restBlocks) && Array.isArray(prevEntry.restBlocks)) {
      const nextRestIds = new Set(updates.restBlocks.map(r => r.id));
      const removedRestIds = prevEntry.restBlocks
        .map(r => r.id)
        .filter(id => id && !nextRestIds.has(id));
      if (removedRestIds.length > 0) recordDeletedIds(removedRestIds);
    }
    const minDailyTarget = systemLevelRef.current === 0 ? 1 : 3;
    if (Array.isArray(updates.priorityItems)) {
      const cleanItems = updates.priorityItems
        .filter(i => i && typeof i.text === 'string' && i.text.trim().length > 0)
        .map(i => ({ ...i, text: i.text.trim() }));
      normalizedUpdates = {
        ...normalizedUpdates,
        priorityItems: cleanItems,
        planNotes: formatPriorityItemsToPlanNotes(cleanItems),
        mainTasksCompleted: cleanItems.filter(i => i.completed).length,
        mainTasksTotal: Math.max(minDailyTarget, cleanItems.length)
      };
    } else if (updates.planNotes !== undefined) {
      const cleanItems = parsePlanNotesToPriorityItems(date, updates.planNotes, prevItems);
      normalizedUpdates = {
        ...normalizedUpdates,
        priorityItems: cleanItems,
        planNotes: updates.planNotes.trim().length === 0 ? '' : formatPriorityItemsToPlanNotes(cleanItems),
        mainTasksCompleted: cleanItems.filter(i => i.completed).length,
        mainTasksTotal: Math.max(minDailyTarget, cleanItems.length)
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

  const syncLinkedQuarterlyTasks = (toggled: Array<{ quarterlyTaskId: string; completed: boolean }>) => {
    if (toggled.length === 0) return;
    const curQuarters = quarterlyPlansRef.current;
    let changed = false;
    const nextQuarters: Record<string, QuarterlyPlan> = { ...curQuarters };
    const cascadedYearly: Array<{ yearlyTaskId: string; completed: boolean }> = [];
    Object.entries(curQuarters).forEach(([qKey, qPlan]) => {
      let qChanged = false;
      const nextTasks = (qPlan.tasks || []).map(qt => {
        const hit = toggled.find(t => t.quarterlyTaskId === qt.id);
        if (hit && qt.completed !== hit.completed) {
          qChanged = true;
          changed = true;
          if (qt.yearlyTaskId) {
            cascadedYearly.push({ yearlyTaskId: qt.yearlyTaskId, completed: hit.completed });
          }
          return { ...qt, completed: hit.completed };
        }
        return qt;
      });
      if (qChanged) {
        nextQuarters[qKey] = {
          ...qPlan,
          tasks: nextTasks,
          updatedAt: new Date().toISOString()
        };
      }
    });
    if (changed) {
      commitQuarterlyPlans(nextQuarters);
    }
    if (cascadedYearly.length > 0) {
      syncLinkedYearlyTasks(cascadedYearly);
    }
  };

  const syncLinkedStrategyGoals = (
    toggles: Array<{
      strategyPlanId: string;
      strategyStageId: string;
      strategyGoalId: string;
      completed: boolean;
    }>
  ) => {
    if (toggles.length === 0) return;
    const curPlans = strategyPlansRef.current;
    let anyChanged = false;
    const nowIso = new Date().toISOString();
    const nextPlans = curPlans.map(sp => {
      const planHits = toggles.filter(g => g.strategyPlanId === sp.id);
      if (planHits.length === 0) return sp;
      let planChanged = false;
      const nextStages = sp.stages.map(st => {
        const stageHits = planHits.filter(g => g.strategyStageId === st.id);
        if (stageHits.length === 0) return st;
        let stageChanged = false;
        const nextGoals = st.proximalGoals.map(pg => {
          const hit = stageHits.find(g => g.strategyGoalId === pg.id);
          if (hit && pg.completed !== hit.completed) {
            stageChanged = true;
            planChanged = true;
            anyChanged = true;
            return { ...pg, completed: hit.completed };
          }
          return pg;
        });
        return stageChanged ? { ...st, proximalGoals: nextGoals } : st;
      });
      return planChanged ? { ...sp, stages: nextStages, updatedAt: nowIso } : sp;
    });
    if (anyChanged) {
      commitStrategyPlans(nextPlans);
    }
  };

  const propagateWeeklyTaskCompletionUpward = (prevPlan: WeeklyPlan | undefined, savedPlan: WeeklyPlan) => {
    const prevMap = new Map<string, boolean>();
    const prevSubMap = new Map<string, boolean>();
    (prevPlan?.tasks || []).forEach(t => {
      prevMap.set(t.id, t.completed);
      (t.subTasks || []).forEach(s => prevSubMap.set(s.id, s.completed));
    });

    const monthlyToggles: Array<{ monthlyTaskId: string; completed: boolean }> = [];
    const quarterlyToggles: Array<{ quarterlyTaskId: string; completed: boolean }> = [];
    const yearlyToggles: Array<{ yearlyTaskId: string; completed: boolean }> = [];
    const strategyGoalToggles: Array<{
      strategyPlanId: string;
      strategyStageId: string;
      strategyGoalId: string;
      completed: boolean;
    }> = [];
    const completedProblemFixIds: string[] = [];

    (savedPlan.tasks || []).forEach(t => {
      // Sub-goals pulled from a Roadmap Proximal Goal or Problem fix sync back automatically
      (t.subTasks || []).forEach(sub => {
        const subWasDone = prevSubMap.get(sub.id);
        const subChanged = subWasDone !== undefined ? subWasDone !== sub.completed : sub.completed;
        if (subChanged && sub.strategyPlanId && sub.strategyStageId && sub.strategyGoalId) {
          strategyGoalToggles.push({
            strategyPlanId: sub.strategyPlanId,
            strategyStageId: sub.strategyStageId,
            strategyGoalId: sub.strategyGoalId,
            completed: sub.completed
          });
        }
        if (subChanged && sub.completed && sub.problemId) {
          completedProblemFixIds.push(sub.problemId);
        }
      });

      const wasDone = prevMap.get(t.id);
      const changed = wasDone !== undefined ? wasDone !== t.completed : t.completed;
      if (changed && t.completed && t.problemId) {
        completedProblemFixIds.push(t.problemId);
      }

      // Decomposed child steps roll up progress without prematurely closing the whole parent outcome
      if (t.parentLinkMode === 'step') return;
      if (!changed) return;
      if (t.monthlyTaskId) {
        monthlyToggles.push({ monthlyTaskId: t.monthlyTaskId, completed: t.completed });
      }
      if (t.quarterlyTaskId) {
        quarterlyToggles.push({ quarterlyTaskId: t.quarterlyTaskId, completed: t.completed });
      }
      if (t.yearlyTaskId) {
        yearlyToggles.push({ yearlyTaskId: t.yearlyTaskId, completed: t.completed });
      }
      if (t.strategyPlanId && t.strategyStageId && t.strategyGoalId) {
        strategyGoalToggles.push({
          strategyPlanId: t.strategyPlanId,
          strategyStageId: t.strategyStageId,
          strategyGoalId: t.strategyGoalId,
          completed: t.completed
        });
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
            if (mt.quarterlyTaskId) {
              quarterlyToggles.push({ quarterlyTaskId: mt.quarterlyTaskId, completed: hit.completed });
            }
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

    if (quarterlyToggles.length > 0) {
      syncLinkedQuarterlyTasks(quarterlyToggles);
    }

    if (yearlyToggles.length > 0) {
      syncLinkedYearlyTasks(yearlyToggles);
    }

    if (strategyGoalToggles.length > 0) {
      syncLinkedStrategyGoals(strategyGoalToggles);
    }

    // When a dispatched Weekly fix task/sub-goal is checked off, signal on the Problem so user can Verify Solved
    if (completedProblemFixIds.length > 0) {
      const doneSet = new Set(completedProblemFixIds);
      const todayStr = getTodayDateString();
      const nowIso = new Date().toISOString();
      let probChanged = false;
      const nextProbs = problemsRef.current.map(p => {
        if (!doneSet.has(p.id) || p.status === 'solved') return p;
        probChanged = true;
        return {
          ...p,
          status: p.status === 'open' ? ('testing' as ProblemStatus) : p.status,
          fixStartedAt: p.fixStartedAt || todayStr,
          fixTaskCompletedAt: todayStr,
          updatedAt: nowIso
        };
      });
      if (probChanged) {
        commitProblems(nextProbs);
      }
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

  const isTextLinkedToWeeklyOrRoadmap = (
    normText: string,
    date: string,
    allWeeklyPlans: Record<string, WeeklyPlan>,
    allStrategyPlans: StrategyPlan[],
    fallbackWeekId: string
  ): boolean => {
    if (!normText) return false;
    const targetPlan = findBestWeeklyPlanForDate(date, allWeeklyPlans, fallbackWeekId);
    if (targetPlan) {
      for (const task of targetPlan.tasks || []) {
        if (task.text.trim().toLowerCase() === normText) return true;
        if (task.subTasks?.some(sub => sub.text.trim().toLowerCase() === normText)) return true;
      }
    }
    for (const sp of allStrategyPlans || []) {
      if (sp.status === 'not_pursuing') continue;
      for (const stage of sp.stages || []) {
        if (stage.proximalGoals?.some(pg => pg.text.trim().toLowerCase() === normText)) return true;
      }
    }
    return false;
  };

  const saveDailyEntry = (date: string, updates: Partial<DailyEntry>) => {
    const { prevEntry, nextEntry } = applyDailyEntryUpdate(date, updates);

    // Two-way sync: if any priority's completion status changed, update linked Weekly Goal / Sub-Goal automatically
    if (updates.priorityItems !== undefined || updates.planNotes !== undefined) {
      const prevItems = getPriorityItemsForEntry(prevEntry);
      const nextItems = getPriorityItemsForEntry(nextEntry);
      const nextIds = new Set(nextItems.map(i => i.id));
      const removedPrioIds = prevItems.filter(p => p.id && !nextIds.has(p.id)).map(p => p.id);
      if (removedPrioIds.length > 0) recordDeletedIds(removedPrioIds);

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

      // Identity-Driven Placement: Standalone Daily Mission tasks (not on Weekly Plan or Roadmap)
      // automatically appear in Checklist -> One-Off Tasks so unfinished ad-hoc tasks are never lost.
      // Deleting a task in One-Off Tasks tombstones its ID so it never resurrects.
      let workingChecklist = checklistItemsRef.current;
      let checklistMutated = false;
      let entryItemsMutated = false;

      const linkedNextItems: DailyPriorityItem[] = nextItems.map((item): DailyPriorityItem => {
        const trimmed = item.text.trim();
        const norm = trimmed.toLowerCase();
        if (trimmed.length < 2 || item.weeklyTaskId || item.subTaskId) return item;

        const derivedId = `chk_day_${date}_${item.id}`;

        if (item.checklistItemId) {
          const chkIdx = workingChecklist.findIndex(c => c.id === item.checklistItemId);
          if (chkIdx >= 0) {
            const existingChk = workingChecklist[chkIdx];
            const isAutoCreatedTodayStub =
              existingChk.id === derivedId && existingChk.recurrence === 'none' && existingChk.sourceDailyDate === date;

            // If user finished typing text that already belongs to Weekly Plan or Roadmap,
            // collapse the auto-created One-Off stub cleanly so it doesn't duplicate into Checklist.
            if (
              isAutoCreatedTodayStub &&
              isTextLinkedToWeeklyOrRoadmap(
                norm,
                date,
                weeklyPlansRef.current,
                strategyPlansRef.current,
                selectedWeekIdRef.current
              )
            ) {
              workingChecklist = workingChecklist.filter((_, idx) => idx !== chkIdx);
              checklistMutated = true;
              entryItemsMutated = true;
              const { checklistItemId: _drop, ...rest } = item;
              return rest;
            }

            // If user finished typing text that matches an ALREADY existing Checklist item (e.g. from a prior day),
            // collapse the new stub and re-bind directly to the existing Checklist item (zero duplicates!).
            if (isAutoCreatedTodayStub) {
              const duplicateTarget = workingChecklist.find(
                (c, idx) => idx !== chkIdx && c.text.trim().toLowerCase() === norm
              );
              if (duplicateTarget) {
                workingChecklist = workingChecklist.filter((_, idx) => idx !== chkIdx);
                checklistMutated = true;
                entryItemsMutated = true;
                return { ...item, checklistItemId: duplicateTarget.id };
              }
            }

            if (existingChk.recurrence === 'none' && existingChk.text !== trimmed) {
              workingChecklist = workingChecklist.map((c, idx) =>
                idx === chkIdx ? { ...c, text: trimmed } : c
              );
              checklistMutated = true;
            }
          }
          // If chkIdx === -1, user deleted/cleared it from One-Off Tasks -> never resurrect
          return item;
        }

        if (deletedIdsRef.current[derivedId]) {
          return item;
        }

        if (
          isTextLinkedToWeeklyOrRoadmap(
            norm,
            date,
            weeklyPlansRef.current,
            strategyPlansRef.current,
            selectedWeekIdRef.current
          )
        ) {
          return item;
        }

        const existingMatch = workingChecklist.find(c => c.text.trim().toLowerCase() === norm);
        if (existingMatch) {
          entryItemsMutated = true;
          return { ...item, checklistItemId: existingMatch.id };
        }

        const newOneOff: ChecklistItem = {
          id: derivedId,
          categoryId: 'cat_oneoff',
          text: trimmed,
          recurrence: 'none',
          completed: !!item.completed,
          completedPeriods: [],
          createdAt: date,
          sourceDailyDate: date
        };
        workingChecklist = [...workingChecklist, newOneOff];
        checklistMutated = true;
        entryItemsMutated = true;
        return { ...item, checklistItemId: derivedId };
      });

      // Clean up tiny abandoned 2-char typing stubs if the user immediately cleared the slot on the same day
      const activeIds = new Set(linkedNextItems.map(i => i.id));
      prevItems.forEach(prevItem => {
        if (activeIds.has(prevItem.id)) return;
        const prevTrimmed = prevItem.text.trim();
        const stubId = `chk_day_${date}_${prevItem.id}`;
        if (
          prevTrimmed.length <= 2 &&
          (prevItem.checklistItemId === stubId || workingChecklist.some(c => c.id === stubId))
        ) {
          const filtered = workingChecklist.filter(
            c =>
              !(
                c.id === stubId &&
                c.recurrence === 'none' &&
                !c.completed &&
                c.createdAt === date &&
                c.text.trim().length <= 2
              )
          );
          if (filtered.length !== workingChecklist.length) {
            workingChecklist = filtered;
            checklistMutated = true;
          }
        }
      });

      if (entryItemsMutated) {
        const curEntry = dailyEntriesRef.current[date];
        if (curEntry) {
          commitDailyEntries({
            ...dailyEntriesRef.current,
            [date]: {
              ...curEntry,
              priorityItems: linkedNextItems
            }
          });
        }
      }

      // Two-way sync: if any toggled priority is linked to Checklist (Weekly / Monthly / One-Off / Daily), sync its completion!
      if (toggledItems.length > 0) {
        const toggledIdSet = new Set(toggledItems.map(t => t.id));
        const checklistToggles = linkedNextItems.filter(i => i.checklistItemId && toggledIdSet.has(i.id));
        if (checklistToggles.length > 0) {
          const targetWeek = findBestWeeklyPlanForDate(date, weeklyPlansRef.current, selectedWeekIdRef.current);
          const weekIdForDate = targetWeek?.id || selectedWeekIdRef.current;
          const monthKeyForDate = date.slice(0, 7);
          const nextChecklist = workingChecklist.map(chk => {
            const hit = checklistToggles.find(t => t.checklistItemId === chk.id);
            if (!hit) return chk;
            if (chk.recurrence === 'none') {
              if (chk.completed === hit.completed) return chk;
              checklistMutated = true;
              return { ...chk, completed: hit.completed };
            }
            if (chk.recurrence === 'daily' || chk.recurrence === 'weekly' || chk.recurrence === 'monthly') {
              const pKey =
                chk.recurrence === 'daily'
                  ? date
                  : chk.recurrence === 'weekly'
                  ? weekIdForDate
                  : monthKeyForDate;
              const existing = chk.completedPeriods || [];
              const hasKey = existing.includes(pKey);
              if (hit.completed && !hasKey) {
                checklistMutated = true;
                return { ...chk, completedPeriods: [...existing, pKey] };
              }
              if (!hit.completed && hasKey) {
                checklistMutated = true;
                return { ...chk, completedPeriods: existing.filter(p => p !== pKey) };
              }
            }
            return chk;
          });
          workingChecklist = nextChecklist;
        }
      }

      if (checklistMutated) {
        commitChecklistItems(workingChecklist);
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
    const nowIso = new Date().toISOString();
    commitGwsSessions(
      gwsSessionsRef.current.map(s => (s.id === id ? { ...s, ...updates, updatedAt: nowIso } : s))
    );
    markLocalMutation();
  };

  const deleteGWSSession = (id: string) => {
    recordDeletedIds([id]);
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
    if (prevPlan) {
      const nextTaskIds = new Set((plan.tasks || []).map(t => t.id));
      const nextSubIds = new Set(
        (plan.tasks || []).flatMap(t => (t.subTasks || []).map(s => s.id))
      );
      const removedIds: string[] = [];
      (prevPlan.tasks || []).forEach(t => {
        if (t.id && !nextTaskIds.has(t.id)) removedIds.push(t.id);
        (t.subTasks || []).forEach(s => {
          if (s.id && !nextSubIds.has(s.id)) removedIds.push(s.id);
        });
      });
      if (removedIds.length > 0) recordDeletedIds(removedIds);
    }
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
    topFocuses: Array.isArray(p?.topFocuses) ? p.topFocuses : undefined,
    notes: p?.notes || '',
    tasks: Array.isArray(p?.tasks) ? p.tasks : [],
    scoreboard: Array.isArray(p?.scoreboard) ? p.scoreboard : [],
    updatedAt: p?.updatedAt || EMPTY_WEEK_TIMESTAMP
  });

  const normalizeQuarterlyPlanEntry = (quarterKey: string, p?: Partial<QuarterlyPlan>): QuarterlyPlan => ({
    id: p?.id || quarterKey,
    quarterKey: p?.quarterKey || quarterKey,
    focusTheme: p?.focusTheme || '',
    topFocuses: Array.isArray(p?.topFocuses) ? p.topFocuses : undefined,
    notes: p?.notes || '',
    tasks: Array.isArray(p?.tasks) ? p.tasks : [],
    targetGateRefs: Array.isArray(p?.targetGateRefs) ? p.targetGateRefs : [],
    scoreboard: Array.isArray(p?.scoreboard) ? p.scoreboard : [],
    updatedAt: p?.updatedAt || EMPTY_WEEK_TIMESTAMP
  });

  const normalizeYearlyPlanEntry = (yearKey: string, p?: Partial<YearlyPlan>): YearlyPlan => ({
    id: p?.id || yearKey,
    yearKey: p?.yearKey || yearKey,
    focusTheme: p?.focusTheme || '',
    topFocuses: Array.isArray(p?.topFocuses) ? p.topFocuses : undefined,
    notes: p?.notes || '',
    tasks: Array.isArray(p?.tasks) ? p.tasks : [],
    targetGateRefs: Array.isArray(p?.targetGateRefs) ? p.targetGateRefs : [],
    scoreboard: Array.isArray(p?.scoreboard) ? p.scoreboard : [],
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
    if (prevPlan) {
      const nextIds = new Set((plan.tasks || []).map(t => t.id));
      const nextSubIds = new Set((plan.tasks || []).flatMap(t => (t.subTasks || []).map(s => s.id)));
      const nextScoreIds = new Set((plan.scoreboard || []).map(s => s.id));
      const removed = [
        ...(prevPlan.tasks || []).filter(t => t.id && !nextIds.has(t.id)).map(t => t.id),
        ...(prevPlan.tasks || [])
          .flatMap(t => t.subTasks || [])
          .filter(s => s.id && !nextSubIds.has(s.id))
          .map(s => s.id),
        ...(prevPlan.scoreboard || []).filter(s => s.id && !nextScoreIds.has(s.id)).map(s => s.id)
      ];
      if (removed.length > 0) recordDeletedIds(removed);
    }
    const saved = {
      ...normalizeMonthlyPlanEntry(key, plan),
      updatedAt: new Date().toISOString()
    };
    commitMonthlyPlans({
      ...monthlyPlansRef.current,
      [key]: saved
    });

    // Upward ID-linked sync (sub-items linked to Roadmap proximal goals always sync 1:1)
    const prevMap = new Map<string, boolean>();
    const prevSubMap = new Map<string, boolean>();
    (prevPlan?.tasks || []).forEach(t => {
      prevMap.set(t.id, t.completed);
      (t.subTasks || []).forEach(s => prevSubMap.set(s.id, s.completed));
    });
    const quarterlyToggles: Array<{ quarterlyTaskId: string; completed: boolean }> = [];
    const yearlyToggles: Array<{ yearlyTaskId: string; completed: boolean }> = [];
    const strategyToggles: Array<{
      strategyPlanId: string;
      strategyStageId: string;
      strategyGoalId: string;
      completed: boolean;
    }> = [];
    saved.tasks.forEach(t => {
      (t.subTasks || []).forEach(sub => {
        if (!sub.strategyPlanId || !sub.strategyStageId || !sub.strategyGoalId) return;
        const subWasDone = prevSubMap.get(sub.id);
        const subChanged = subWasDone !== undefined ? subWasDone !== sub.completed : sub.completed;
        if (subChanged) {
          strategyToggles.push({
            strategyPlanId: sub.strategyPlanId,
            strategyStageId: sub.strategyStageId,
            strategyGoalId: sub.strategyGoalId,
            completed: sub.completed
          });
        }
      });
      if (t.parentLinkMode === 'step') return;
      const wasDone = prevMap.get(t.id);
      const changed = wasDone !== undefined ? wasDone !== t.completed : t.completed;
      if (changed && t.quarterlyTaskId) {
        quarterlyToggles.push({ quarterlyTaskId: t.quarterlyTaskId, completed: t.completed });
      }
      if (changed && t.yearlyTaskId) {
        yearlyToggles.push({ yearlyTaskId: t.yearlyTaskId, completed: t.completed });
      }
      if (changed && t.strategyPlanId && t.strategyStageId && t.strategyGoalId) {
        strategyToggles.push({
          strategyPlanId: t.strategyPlanId,
          strategyStageId: t.strategyStageId,
          strategyGoalId: t.strategyGoalId,
          completed: t.completed
        });
      }
    });
    if (quarterlyToggles.length > 0) {
      syncLinkedQuarterlyTasks(quarterlyToggles);
    }
    if (yearlyToggles.length > 0) {
      syncLinkedYearlyTasks(yearlyToggles);
    }
    if (strategyToggles.length > 0) {
      syncLinkedStrategyGoals(strategyToggles);
    }

    markLocalMutation();
  };

  const getQuarterlyPlan = (quarterKey: string): QuarterlyPlan => {
    if (quarterlyPlans[quarterKey]) {
      return normalizeQuarterlyPlanEntry(quarterKey, quarterlyPlans[quarterKey]);
    }
    return normalizeQuarterlyPlanEntry(quarterKey);
  };

  const saveQuarterlyPlan = (plan: QuarterlyPlan) => {
    const key = plan.quarterKey || plan.id;
    const prevPlan = quarterlyPlansRef.current[key];
    if (prevPlan) {
      const nextTaskIds = new Set((plan.tasks || []).map(t => t.id));
      const nextSubIds = new Set((plan.tasks || []).flatMap(t => (t.subTasks || []).map(s => s.id)));
      const nextScoreIds = new Set((plan.scoreboard || []).map(s => s.id));
      const removed = [
        ...(prevPlan.tasks || []).filter(t => t.id && !nextTaskIds.has(t.id)).map(t => t.id),
        ...(prevPlan.tasks || [])
          .flatMap(t => t.subTasks || [])
          .filter(s => s.id && !nextSubIds.has(s.id))
          .map(s => s.id),
        ...(prevPlan.scoreboard || []).filter(s => s.id && !nextScoreIds.has(s.id)).map(s => s.id)
      ];
      if (removed.length > 0) recordDeletedIds(removed);
    }
    const saved = {
      ...normalizeQuarterlyPlanEntry(key, plan),
      updatedAt: new Date().toISOString()
    };
    commitQuarterlyPlans({
      ...quarterlyPlansRef.current,
      [key]: saved
    });

    // Upward ID-linked sync: propagate completed quarterly outcomes & sub-items to linked yearly & roadmap goals
    const prevMap = new Map<string, boolean>();
    const prevSubMap = new Map<string, boolean>();
    (prevPlan?.tasks || []).forEach(t => {
      prevMap.set(t.id, t.completed);
      (t.subTasks || []).forEach(s => prevSubMap.set(s.id, s.completed));
    });
    const yearlyToggles: Array<{ yearlyTaskId: string; completed: boolean }> = [];
    const strategyToggles: Array<{
      strategyPlanId: string;
      strategyStageId: string;
      strategyGoalId: string;
      completed: boolean;
    }> = [];
    saved.tasks.forEach(t => {
      (t.subTasks || []).forEach(sub => {
        if (!sub.strategyPlanId || !sub.strategyStageId || !sub.strategyGoalId) return;
        const subWasDone = prevSubMap.get(sub.id);
        const subChanged = subWasDone !== undefined ? subWasDone !== sub.completed : sub.completed;
        if (subChanged) {
          strategyToggles.push({
            strategyPlanId: sub.strategyPlanId,
            strategyStageId: sub.strategyStageId,
            strategyGoalId: sub.strategyGoalId,
            completed: sub.completed
          });
        }
      });
      if (t.parentLinkMode === 'step') return;
      const wasDone = prevMap.get(t.id);
      const changed = wasDone !== undefined ? wasDone !== t.completed : t.completed;
      if (changed && t.yearlyTaskId) {
        yearlyToggles.push({ yearlyTaskId: t.yearlyTaskId, completed: t.completed });
      }
      if (changed && t.strategyPlanId && t.strategyStageId && t.strategyGoalId) {
        strategyToggles.push({
          strategyPlanId: t.strategyPlanId,
          strategyStageId: t.strategyStageId,
          strategyGoalId: t.strategyGoalId,
          completed: t.completed
        });
      }
    });
    if (yearlyToggles.length > 0) {
      syncLinkedYearlyTasks(yearlyToggles);
    }
    if (strategyToggles.length > 0) {
      syncLinkedStrategyGoals(strategyToggles);
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
    const prevPlan = yearlyPlansRef.current[key];
    if (prevPlan) {
      const nextIds = new Set((plan.tasks || []).map(t => t.id));
      const nextScoreIds = new Set((plan.scoreboard || []).map(s => s.id));
      const removed = [
        ...(prevPlan.tasks || []).filter(t => t.id && !nextIds.has(t.id)).map(t => t.id),
        ...(prevPlan.scoreboard || []).filter(s => s.id && !nextScoreIds.has(s.id)).map(s => s.id)
      ];
      if (removed.length > 0) recordDeletedIds(removed);
    }
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

  const saveLifePillars = (pillars: LifePillar[]) => {
    const prev = lifePillarsRef.current;
    const nextIds = new Set(pillars.map(p => p.id));
    const removed = prev.filter(p => p.id && !nextIds.has(p.id)).map(p => p.id);
    if (removed.length > 0) recordDeletedIds(removed);
    pillars.forEach(p => {
      if (p.id) clearDeletedId(p.id);
    });
    commitLifePillars(pillars);
    markLocalMutation();
  };

  const saveCustomReviewPrompts = (prompts: CustomReviewPrompt[]) => {
    const prev = customReviewPromptsRef.current;
    const nextIds = new Set(prompts.map(p => p.id));
    const removed = prev.filter(p => p.id && !nextIds.has(p.id)).map(p => p.id);
    if (removed.length > 0) recordDeletedIds(removed);
    prompts.forEach(p => {
      if (p.id) clearDeletedId(p.id);
    });
    commitCustomReviewPrompts(prompts);
    markLocalMutation();
  };

  const saveMacroReviewSettings = (settings: MacroReviewSettings) => {
    commitMacroReviewSettings(settings);
    markLocalMutation();
  };

  const saveProblemCategories = (categories: CustomProblemCategory[]) => {
    const prev = problemCategoriesRef.current;
    const nextIds = new Set(categories.map(c => c.id));
    const removed = prev.filter(c => c.id && !nextIds.has(c.id)).map(c => c.id);
    if (removed.length > 0) recordDeletedIds(removed);
    categories.forEach(c => {
      if (c.id) clearDeletedId(c.id);
    });
    commitProblemCategories(categories);
    markLocalMutation();
  };

  const saveProblemSettings = (settings: ProblemSettings) => {
    commitProblemSettings(settings);
    markLocalMutation();
  };

  const saveStrategyPlan = (plan: StrategyPlan) => {
    const prev = strategyPlansRef.current;
    const prevPlan = prev.find(p => p.id === plan.id);
    if (prevPlan) {
      const nextStageIds = new Set((plan.stages || []).map(s => s.id));
      const nextGoalIds = new Set(
        (plan.stages || []).flatMap(s => (s.proximalGoals || []).map(g => g.id))
      );
      const removedIds: string[] = [];
      (prevPlan.stages || []).forEach(s => {
        if (s.id && !nextStageIds.has(s.id)) removedIds.push(s.id);
        (s.proximalGoals || []).forEach(g => {
          if (g.id && !nextGoalIds.has(g.id)) removedIds.push(g.id);
        });
      });
      if (removedIds.length > 0) recordDeletedIds(removedIds);
    }
    const nowIso = new Date().toISOString();
    const updatedPlan: StrategyPlan = {
      ...plan,
      stages: Array.isArray(plan.stages) ? plan.stages : [],
      createdAt: plan.createdAt || nowIso,
      updatedAt: nowIso
    };
    const idx = prev.findIndex(p => p.id === updatedPlan.id);
    const next = idx >= 0 ? prev.map((p, i) => (i === idx ? updatedPlan : p)) : [...prev, updatedPlan];
    clearDeletedId(updatedPlan.id);
    commitStrategyPlans(next);

    // Two-way sync: if any proximal goal's completion toggled in the Roadmap, sync linked Weekly goals & sub-goals
    if (prevPlan) {
      const prevGoalDone = new Map<string, boolean>();
      (prevPlan.stages || []).forEach(st => {
        (st.proximalGoals || []).forEach(g => prevGoalDone.set(g.id, g.completed));
      });
      const toggledGoals = new Map<string, boolean>();
      (updatedPlan.stages || []).forEach(st => {
        (st.proximalGoals || []).forEach(g => {
          const prevVal = prevGoalDone.get(g.id);
          if (prevVal !== undefined && prevVal !== g.completed) {
            toggledGoals.set(g.id, g.completed);
          }
        });
      });

      if (toggledGoals.size > 0) {
        const curWeeks = weeklyPlansRef.current;
        let anyWeekChanged = false;
        const nextWeeks: Record<string, WeeklyPlan> = { ...curWeeks };
        const changedWeekDaySyncs: Array<{ week: WeeklyPlan; changedTaskIds: Map<string, boolean>; changedSubIds: Map<string, boolean> }> = [];

        Object.entries(curWeeks).forEach(([wKey, wp]) => {
          let wChanged = false;
          const changedTaskIds = new Map<string, boolean>();
          const changedSubIds = new Map<string, boolean>();

          const nextTasks = (wp.tasks || []).map(t => {
            let nextTask = t;
            if (t.strategyGoalId && toggledGoals.has(t.strategyGoalId)) {
              const targetDone = toggledGoals.get(t.strategyGoalId)!;
              if (nextTask.completed !== targetDone) {
                wChanged = true;
                changedTaskIds.set(t.id, targetDone);
                nextTask = { ...nextTask, completed: targetDone };
              }
            }
            if (nextTask.subTasks && nextTask.subTasks.length > 0) {
              let subChanged = false;
              const nextSubs = nextTask.subTasks.map(sub => {
                if (sub.strategyGoalId && toggledGoals.has(sub.strategyGoalId)) {
                  const targetDone = toggledGoals.get(sub.strategyGoalId)!;
                  if (sub.completed !== targetDone) {
                    subChanged = true;
                    wChanged = true;
                    changedSubIds.set(sub.id, targetDone);
                    return { ...sub, completed: targetDone };
                  }
                }
                return sub;
              });
              if (subChanged) {
                nextTask = {
                  ...nextTask,
                  subTasks: nextSubs,
                  completed: nextSubs.every(s => s.completed)
                };
              }
            }
            return nextTask;
          });

          if (wChanged) {
            anyWeekChanged = true;
            const updatedWeek: WeeklyPlan = {
              ...wp,
              tasks: nextTasks,
              achievedScore: computeWeeklyAchievedScore(nextTasks),
              updatedAt: nowIso
            };
            nextWeeks[wKey] = updatedWeek;
            changedWeekDaySyncs.push({ week: updatedWeek, changedTaskIds, changedSubIds });
          }
        });

        if (anyWeekChanged) {
          commitWeeklyPlans(nextWeeks);
          changedWeekDaySyncs.forEach(({ week, changedTaskIds, changedSubIds }) => {
            const weekRange = getCurrentWeekRange(week.startDate);
            weekRange.days.forEach(dayStr => {
              const entry = dailyEntriesRef.current[dayStr];
              if (!entry) return;
              const items = getPriorityItemsForEntry(entry);
              let dayChanged = false;
              const nextItems = items.map(item => {
                if (item.subTaskId && changedSubIds.has(item.subTaskId)) {
                  const targetDone = changedSubIds.get(item.subTaskId)!;
                  if (item.completed !== targetDone) {
                    dayChanged = true;
                    return { ...item, completed: targetDone };
                  }
                } else if (item.weeklyTaskId && !item.subTaskId && changedTaskIds.has(item.weeklyTaskId)) {
                  const targetDone = changedTaskIds.get(item.weeklyTaskId)!;
                  if (item.completed !== targetDone) {
                    dayChanged = true;
                    return { ...item, completed: targetDone };
                  }
                }
                return item;
              });
              if (dayChanged) {
                applyDailyEntryUpdate(dayStr, { priorityItems: nextItems });
              }
            });
          });
        }

        // Also sync down to Monthly & Quarterly plans (top-level and nested sub-items)
        const syncMacroPlansForGoals = <T extends { tasks: TaskItem[]; updatedAt: string }>(
          plansMap: Record<string, T>,
          commitFn: (next: Record<string, T>) => void
        ) => {
          let anyChanged = false;
          const nextMap: Record<string, T> = { ...plansMap };
          Object.entries(plansMap).forEach(([k, mp]) => {
            let pChanged = false;
            const nextTasks = (mp.tasks || []).map(t => {
              let nextTask = t;
              if (t.strategyGoalId && toggledGoals.has(t.strategyGoalId)) {
                const targetDone = toggledGoals.get(t.strategyGoalId)!;
                if (nextTask.completed !== targetDone) {
                  pChanged = true;
                  nextTask = { ...nextTask, completed: targetDone };
                }
              }
              if (nextTask.subTasks && nextTask.subTasks.length > 0) {
                let subChanged = false;
                const nextSubs = nextTask.subTasks.map(sub => {
                  if (sub.strategyGoalId && toggledGoals.has(sub.strategyGoalId)) {
                    const targetDone = toggledGoals.get(sub.strategyGoalId)!;
                    if (sub.completed !== targetDone) {
                      subChanged = true;
                      pChanged = true;
                      return { ...sub, completed: targetDone };
                    }
                  }
                  return sub;
                });
                if (subChanged) {
                  nextTask = { ...nextTask, subTasks: nextSubs };
                }
              }
              return nextTask;
            });
            if (pChanged) {
              anyChanged = true;
              nextMap[k] = { ...mp, tasks: nextTasks, updatedAt: nowIso };
            }
          });
          if (anyChanged) commitFn(nextMap);
        };

        syncMacroPlansForGoals(monthlyPlansRef.current, commitMonthlyPlans);
        syncMacroPlansForGoals(quarterlyPlansRef.current, commitQuarterlyPlans);
      }

      // Rename resilience: if Roadmap title changed, preserve Problem attachments by ID + update legacy tag text
      const oldTitle = prevPlan.title.trim();
      const newTitle = updatedPlan.title.trim();
      if (oldTitle && newTitle && oldTitle.toLowerCase() !== newTitle.toLowerCase()) {
        const cleanNewTag = normalizeTag(newTitle);
        let probsChanged = false;
        const nextProbs = problemsRef.current.map(p => {
          const matchedById = p.roadmapPlanId === updatedPlan.id;
          const matchedByOldTag = !p.roadmapPlanId && problemHasTag(p, oldTitle);
          if (!matchedById && !matchedByOldTag) return p;
          probsChanged = true;
          const nextTags = Array.from(
            new Set([
              ...(p.tags || []).filter(t => !tagsMatch(t, oldTitle)),
              ...(cleanNewTag ? [cleanNewTag] : [])
            ])
          );
          return {
            ...p,
            roadmapPlanId: updatedPlan.id,
            tags: nextTags,
            updatedAt: nowIso
          };
        });
        if (probsChanged) {
          commitProblems(nextProbs);
        }
      }
    }

    markLocalMutation();
  };

  const deleteStrategyPlan = (id: string) => {
    recordDeletedIds([id]);
    commitStrategyPlans(strategyPlansRef.current.filter(p => p.id !== id));
    markLocalMutation();
  };

  const addProblem: StorageContextType['addProblem'] = (input) => {
    const nowIso = new Date().toISOString();
    const cleanedTags = Array.from(
      new Set((input.tags || []).map(normalizeTag).filter(Boolean))
    );
    // Stable ID binding: prefer explicit roadmapPlanId, or auto-resolve from matching active Roadmap tag
    const activeRoadmaps = strategyPlansRef.current.filter(isActiveStrategyPlan);
    let resolvedRoadmapId = input.roadmapPlanId;
    if (!resolvedRoadmapId && cleanedTags.length > 0) {
      const hit = activeRoadmaps.find(sp =>
        sp.title.trim() && cleanedTags.some(t => tagsMatch(t, sp.title))
      );
      if (hit) resolvedRoadmapId = hit.id;
    }
    if (resolvedRoadmapId) {
      const linkedPlan = strategyPlansRef.current.find(sp => sp.id === resolvedRoadmapId);
      const planTag = linkedPlan?.title ? normalizeTag(linkedPlan.title) : '';
      if (planTag && !cleanedTags.some(t => tagsMatch(t, planTag))) {
        cleanedTags.unshift(planTag);
      }
    }
    const resolvedScale: ProblemScale =
      input.scale ||
      (input.severity && input.severity >= 5
        ? 'blocker'
        : input.severity && input.severity >= 4
        ? 'bottleneck'
        : defaultScaleForSource(input.sourceType));
    const resolvedSeverity: ProblemSeverity =
      input.severity ||
      (input.impact === 'critical' || resolvedScale === 'blocker'
        ? 5
        : input.impact === 'high' || resolvedScale === 'bottleneck'
        ? 3
        : 2);
    const resolvedImpact: ProblemImpact = input.impact || severityToImpact(resolvedSeverity);
    const resolvedStatus: ProblemStatus = input.status || 'open';
    const entry: ProblemEntry = {
      id: `prob_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: input.title.trim(),
      category: input.category,
      ...(typeof input.classified === 'boolean' ? { classified: input.classified } : {}),
      scale: resolvedScale,
      impact: resolvedImpact,
      severity: resolvedSeverity,
      ...(input.isTopConstraint ? { isTopConstraint: true } : {}),
      ...(typeof input.watching === 'boolean' ? { watching: input.watching } : {}),
      ...(input.watchQuestion?.trim() ? { watchQuestion: input.watchQuestion.trim() } : {}),
      ...(typeof input.promptNoteOnHit === 'boolean' ? { promptNoteOnHit: input.promptNoteOnHit } : {}),
      ...(input.trigger?.trim() ? { trigger: input.trigger.trim() } : {}),
      ...(input.rootCause?.trim() ? { rootCause: input.rootCause.trim() } : {}),
      ...(input.isGuardrail ? { isGuardrail: true } : {}),
      ...(input.reminderText?.trim() ? { reminderText: input.reminderText.trim() } : {}),
      ...(input.verifyDays ? { verifyDays: input.verifyDays } : {}),
      ...(input.parentProblemId ? { parentProblemId: input.parentProblemId } : {}),
      ...(resolvedRoadmapId ? { roadmapPlanId: resolvedRoadmapId } : {}),
      tags: cleanedTags,
      status: resolvedStatus,
      occurrences: [
        {
          date: input.date || getTodayDateString(),
          sourceType: input.sourceType,
          ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
          ...(input.note ? { note: input.note } : {})
        }
      ],
      ...(input.fixType ? { fixType: input.fixType } : {}),
      ...(input.fixNote?.trim() ? { fixNote: input.fixNote.trim() } : {}),
      ...(resolvedStatus === 'testing' ? { fixStartedAt: input.date || getTodayDateString() } : {}),
      createdAt: nowIso,
      updatedAt: nowIso
    };
    // If attached under a parent that was marked solved or testing, re-open honestly and log failed fix if testing!
    const occDate = input.date || getTodayDateString();
    const updatedPrev = input.parentProblemId
      ? problemsRef.current.map(p => {
          if (p.id !== input.parentProblemId) return p;
          if (p.status === 'solved') {
            const reopened: ProblemEntry = { ...p, status: 'open', updatedAt: nowIso };
            delete reopened.solvedAt;
            return reopened;
          }
          if (p.status === 'testing') {
            const startedAt = (p.fixStartedAt || p.updatedAt || p.createdAt || occDate).slice(0, 10);
            const failedAttempt: ProblemFixAttempt = {
              id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              fixText: p.fixNote?.trim() || 'Previous fix',
              startedAt,
              endedAt: occDate,
              outcome: 'failed',
              daysHeld: daysBetweenDates(startedAt, occDate),
              note: `Slip recurred: ${entry.title}`
            };
            const updatedParent: ProblemEntry = {
              ...p,
              status: 'open',
              lastFixFailedAt: occDate,
              fixAttempts: [...(p.fixAttempts || []), failedAttempt],
              updatedAt: nowIso
            };
            delete updatedParent.fixStartedAt;
            return updatedParent;
          }
          return p;
        })
      : problemsRef.current;

    commitProblems([entry, ...updatedPrev]);
    markLocalMutation();
    return entry;
  };

  const updateProblem: StorageContextType['updateProblem'] = (id, patch) => {
    const nowIso = new Date().toISOString();
    const todayStr = getTodayDateString();
    const cur = problemsRef.current;
    // If a parent cluster is verified solved, also close its open/testing children cleanly
    const childIdsToClose =
      patch.status === 'solved'
        ? new Set(getDescendantProblems(cur, id).map(d => d.id))
        : new Set<string>();

    const next = cur.map(p => {
      if (p.id === id) {
        const merged: ProblemEntry = {
          ...p,
          ...patch,
          tags: patch.tags
            ? Array.from(new Set(patch.tags.map(normalizeTag).filter(Boolean)))
            : p.tags,
          updatedAt: nowIso
        };
        if (patch.parentProblemId === undefined && 'parentProblemId' in patch) {
          delete merged.parentProblemId;
        }
        if (patch.roadmapPlanId === undefined && 'roadmapPlanId' in patch) {
          delete merged.roadmapPlanId;
        }
        if ('reminderText' in patch && !patch.reminderText?.trim()) {
          delete merged.reminderText;
        }
        if ('fixNote' in patch && !patch.fixNote?.trim()) {
          delete merged.fixNote;
        }
        if ('trigger' in patch && !patch.trigger?.trim()) {
          delete merged.trigger;
        }
        if ('rootCause' in patch && !patch.rootCause?.trim()) {
          delete merged.rootCause;
        }
        if ('watchQuestion' in patch && !patch.watchQuestion?.trim()) {
          delete merged.watchQuestion;
        }
        // Automatically activate Observation mode when pinning a Top 3 focus problem that has no active solution yet
        if (
          patch.isTopConstraint === true &&
          merged.watching === undefined &&
          !merged.isGuardrail &&
          !merged.reminderText?.trim() &&
          !merged.fixNote?.trim() &&
          !(merged.dispatchedTo && merged.dispatchedTo.length > 0)
        ) {
          merged.watching = true;
        }
        // Entering Testing Fix: start verification clock & clear prior failure flag
        if (patch.status === 'testing' && p.status !== 'testing') {
          merged.fixStartedAt = patch.fixStartedAt || todayStr;
          delete merged.lastFixFailedAt;
        }
        // Verifying Solved: stamp solvedAt, release Top Constraint slot, log verified attempt if fixNote exists
        if (patch.status === 'solved') {
          if (!merged.solvedAt) merged.solvedAt = nowIso;
          merged.isTopConstraint = false;
          delete merged.lastFixFailedAt;
          if ((merged.fixNote?.trim() || merged.reminderText?.trim()) && p.status !== 'solved') {
            const startedAt = (merged.fixStartedAt || p.updatedAt || p.createdAt || todayStr).slice(0, 10);
            const verifiedAttempt: ProblemFixAttempt = {
              id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              fixText: merged.fixNote?.trim() || merged.reminderText?.trim() || 'Previous fix',
              startedAt,
              endedAt: todayStr,
              outcome: 'verified',
              daysHeld: daysBetweenDates(startedAt, todayStr)
            };
            merged.fixAttempts = [...(merged.fixAttempts || []), verifiedAttempt];
          }
        } else if (patch.status) {
          delete merged.solvedAt;
        }
        return merged;
      }
      if (childIdsToClose.has(p.id) && p.status !== 'solved') {
        return {
          ...p,
          status: 'solved' as ProblemStatus,
          isTopConstraint: false,
          solvedAt: nowIso,
          updatedAt: nowIso
        };
      }
      return p;
    });
    commitProblems(next);
    markLocalMutation();
  };

  const recordProblemRecurrence: StorageContextType['recordProblemRecurrence'] = (id, occurrence) => {
    const nowIso = new Date().toISOString();
    const occDate = occurrence.date || getTodayDateString();
    const cur = problemsRef.current;
    const target = cur.find(p => p.id === id);
    const parentIdToCheck = target?.parentProblemId;

    const handleFailureIfTesting = (p: ProblemEntry, note?: string): ProblemEntry => {
      if (p.status !== 'testing') return p;
      const startedAt = (p.fixStartedAt || p.updatedAt || p.createdAt || occDate).slice(0, 10);
      const failedAttempt: ProblemFixAttempt = {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        fixText: p.fixNote?.trim() || p.reminderText?.trim() || 'Previous fix',
        startedAt,
        endedAt: occDate,
        outcome: 'failed',
        daysHeld: daysBetweenDates(startedAt, occDate),
        ...(note ? { note } : {})
      };
      const nextP: ProblemEntry = {
        ...p,
        status: 'open',
        lastFixFailedAt: occDate,
        fixAttempts: [...(p.fixAttempts || []), failedAttempt],
        updatedAt: nowIso
      };
      delete nextP.fixStartedAt;
      return nextP;
    };

    const next = cur.map(p => {
      if (p.id === id) {
        const base: ProblemEntry = {
          ...p,
          status: p.status === 'solved' ? 'open' : p.status,
          occurrences: [
            ...(p.occurrences || []),
            {
              date: occDate,
              sourceType: occurrence.sourceType,
              ...(occurrence.sourceRef ? { sourceRef: occurrence.sourceRef } : {}),
              ...(occurrence.note ? { note: occurrence.note } : {})
            }
          ],
          updatedAt: nowIso
        };
        delete base.solvedAt;
        return handleFailureIfTesting(base, occurrence.note);
      }
      if (parentIdToCheck && p.id === parentIdToCheck) {
        if (p.status === 'solved') {
          const reopened: ProblemEntry = { ...p, status: 'open', updatedAt: nowIso };
          delete reopened.solvedAt;
          return reopened;
        }
        if (p.status === 'testing') {
          return handleFailureIfTesting(p, target ? `Linked slip recurred: ${target.title}` : undefined);
        }
      }
      return p;
    });
    commitProblems(next);
    markLocalMutation();
  };

  // Reversible 3-verdict check-in ('effective' | 'not_triggered' | 'failed' | null to clear)
  // Preserves any tweakNote / tweakApplied on the same date, and undoes same-day misclicked failures cleanly.
  const recordProblemCheckIn: StorageContextType['recordProblemCheckIn'] = (id, outcome, options) => {
    const nowIso = new Date().toISOString();
    const checkDate = options?.date || getTodayDateString();
    const note = options?.note?.trim();
    const sourceType: ProblemSourceType = options?.sourceType || 'daily';
    const cur = problemsRef.current;
    const target = cur.find(p => p.id === id);
    const parentIdToCheck = target?.parentProblemId;

    const handleFailureIfTesting = (p: ProblemEntry, failNote?: string): ProblemEntry => {
      if (p.status !== 'testing') return p;
      const startedAt = (p.fixStartedAt || p.updatedAt || p.createdAt || checkDate).slice(0, 10);
      const failedAttempt: ProblemFixAttempt = {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        fixText: p.fixNote?.trim() || p.reminderText?.trim() || 'Previous fix',
        startedAt,
        endedAt: checkDate,
        outcome: 'failed',
        daysHeld: daysBetweenDates(startedAt, checkDate),
        ...(failNote ? { note: failNote } : {})
      };
      const nextP: ProblemEntry = {
        ...p,
        status: 'open',
        lastFixFailedAt: checkDate,
        fixAttempts: [...(p.fixAttempts || []), failedAttempt],
        updatedAt: nowIso
      };
      delete nextP.fixStartedAt;
      return nextP;
    };

    const next = cur.map(p => {
      if (p.id === id) {
        const existingOnDate = (p.checkIns || []).find(c => c.date === checkDate);
        const preservedTweakNote = existingOnDate?.tweakNote?.trim() || undefined;
        const preservedTweakApplied = existingOnDate?.tweakApplied;
        const filteredCheckIns = (p.checkIns || []).filter(c => c.date !== checkDate);

        let nextCheckIns: ProblemCheckIn[];
        if (outcome === null) {
          if (preservedTweakNote) {
            nextCheckIns = [
              ...filteredCheckIns,
              {
                date: checkDate,
                outcome: 'tweaked' as ProblemCheckInOutcome,
                note: preservedTweakNote,
                tweakNote: preservedTweakNote,
                ...(preservedTweakApplied ? { tweakApplied: true } : {})
              }
            ].sort((a, b) => a.date.localeCompare(b.date));
          } else {
            nextCheckIns = filteredCheckIns;
          }
        } else {
          const nextCheckIn: ProblemCheckIn = {
            date: checkDate,
            outcome,
            ...(note ? { note } : existingOnDate?.note ? { note: existingOnDate.note } : {}),
            ...(preservedTweakNote ? { tweakNote: preservedTweakNote } : {}),
            ...(preservedTweakApplied ? { tweakApplied: true } : {})
          };
          nextCheckIns = [...filteredCheckIns, nextCheckIn].sort((a, b) =>
            a.date.localeCompare(b.date)
          );
        }

        const prevHeld = p.heldDates || [];
        let nextHeldDates: string[];
        if (outcome === 'effective') {
          nextHeldDates = prevHeld.includes(checkDate) ? prevHeld : [...prevHeld, checkDate];
        } else {
          nextHeldDates = prevHeld.filter(d => d !== checkDate);
        }
        const sortedHeld = [...nextHeldDates].sort();
        const latestHeld = sortedHeld[sortedHeld.length - 1];

        let updated: ProblemEntry = {
          ...p,
          checkIns: nextCheckIns,
          heldDates: sortedHeld,
          ...(latestHeld ? { lastHeldDate: latestHeld } : {}),
          ...(outcome === null ? { prunedAt: nowIso } : {}),
          updatedAt: nowIso
        };
        if (!latestHeld) {
          delete updated.lastHeldDate;
        }

        // Undo same-day failure transition if switching away from or clearing a same-day 'failed' verdict
        if (existingOnDate?.outcome === 'failed' && outcome !== 'failed') {
          updated.prunedAt = nowIso;
          const occs = [...(updated.occurrences || [])];
          for (let i = occs.length - 1; i >= 0; i--) {
            if (occs[i].date === checkDate && occs[i].sourceType === sourceType) {
              occs.splice(i, 1);
              break;
            }
          }
          updated.occurrences = occs;

          const attempts = [...(updated.fixAttempts || [])];
          const lastAtt = attempts[attempts.length - 1];
          if (lastAtt && lastAtt.outcome === 'failed' && lastAtt.endedAt === checkDate) {
            attempts.pop();
            updated.fixAttempts = attempts;
            updated.status = 'testing';
            updated.fixStartedAt = lastAtt.startedAt;
            delete updated.lastFixFailedAt;
          } else if (updated.lastFixFailedAt === checkDate) {
            delete updated.lastFixFailedAt;
            const hasActiveSol = Boolean(
              updated.reminderText?.trim() ||
                updated.isGuardrail ||
                updated.fixType === 'rule_guardrail' ||
                updated.fixNote?.trim() ||
                (updated.dispatchedTo && updated.dispatchedTo.length > 0)
            );
            if (hasActiveSol && updated.status === 'open') {
              updated.status = 'testing';
            }
          }
        }

        if (outcome === 'failed') {
          const alreadyLoggedToday = (updated.occurrences || []).some(
            o => o.date === checkDate && o.sourceType === sourceType && (o.note || '') === (note || '')
          );
          const nextOccurrences = alreadyLoggedToday
            ? updated.occurrences || []
            : [
                ...(updated.occurrences || []),
                {
                  date: checkDate,
                  sourceType,
                  ...(options?.sourceRef ? { sourceRef: options.sourceRef } : {}),
                  ...(note ? { note } : {})
                }
              ];
          updated = {
            ...updated,
            status: updated.status === 'solved' ? 'open' : updated.status,
            occurrences: nextOccurrences
          };
          delete updated.solvedAt;
          updated = handleFailureIfTesting(updated, note);
          const hasActiveSolution = Boolean(
            updated.reminderText?.trim() ||
              updated.isGuardrail ||
              updated.fixType === 'rule_guardrail' ||
              updated.fixNote?.trim() ||
              (updated.dispatchedTo && updated.dispatchedTo.length > 0)
          );
          if (hasActiveSolution) {
            updated.lastFixFailedAt = checkDate;
          }
        }

        return updated;
      }

      if (outcome === 'failed' && parentIdToCheck && p.id === parentIdToCheck) {
        if (p.status === 'solved') {
          const reopened: ProblemEntry = { ...p, status: 'open', updatedAt: nowIso };
          delete reopened.solvedAt;
          return reopened;
        }
        if (p.status === 'testing') {
          return handleFailureIfTesting(p, target ? `Linked slip recurred: ${target.title}` : undefined);
        }
      }

      return p;
    });

    commitProblems(next);
    markLocalMutation();
  };

  // Jot a tweak idea onto checkDate WITHOUT altering or overwriting today's Worked/Quiet/Failed verdict
  const noteProblemTweak: StorageContextType['noteProblemTweak'] = (id, note, options) => {
    const trimmed = note.trim();
    if (!trimmed) return;
    const nowIso = new Date().toISOString();
    const checkDate = options?.date || getTodayDateString();
    const cur = problemsRef.current;

    const next = cur.map(p => {
      if (p.id !== id) return p;
      const existing = (p.checkIns || []).find(c => c.date === checkDate);
      const others = (p.checkIns || []).filter(c => c.date !== checkDate);
      const updatedEntry: ProblemCheckIn = existing
        ? {
            ...existing,
            tweakNote: trimmed,
            tweakApplied: false
          }
        : {
            date: checkDate,
            outcome: 'tweaked',
            note: trimmed,
            tweakNote: trimmed,
            tweakApplied: false
          };
      return {
        ...p,
        checkIns: [...others, updatedEntry].sort((a, b) => a.date.localeCompare(b.date)),
        updatedAt: nowIso
      };
    });

    commitProblems(next);
    markLocalMutation();
  };

  // Revise/rewrite an active Reminder or Action cleanly: archives v1 if active, clears pending tweak flags,
  // restarts or resumes testing when recovering from failure, and syncs linked tasks/habits.
  const reviseProblemSolution: StorageContextType['reviseProblemSolution'] = (id, revision) => {
    const cur = problemsRef.current;
    const problem = cur.find(p => p.id === id);
    if (!problem) return;

    const nowIso = new Date().toISOString();
    const revDate = revision.date || getTodayDateString();

    if (revision.markTweaksAppliedOnly) {
      const next = cur.map(p => {
        if (p.id !== id) return p;
        return {
          ...p,
          checkIns: (p.checkIns || []).map(c =>
            c.tweakNote?.trim() || c.outcome === 'tweaked' ? { ...c, tweakApplied: true } : c
          ),
          updatedAt: nowIso
        };
      });
      commitProblems(next);
      markLocalMutation();
      return;
    }

    const oldRem = getProblemReminderText(problem);
    const oldAct = getProblemActionText(problem);
    const nextRem = 'reminderText' in revision ? (revision.reminderText || '').trim() : oldRem;
    const nextAct = 'fixNote' in revision ? (revision.fixNote || '').trim() : oldAct;
    const revNote = revision.note?.trim();

    const remChanged = 'reminderText' in revision && Boolean(oldRem) && Boolean(nextRem) && nextRem !== oldRem;
    const actChanged = 'fixNote' in revision && Boolean(oldAct) && Boolean(nextAct) && nextAct !== oldAct;
    const oldSummary = [oldRem, oldAct].filter(Boolean).join(' + ');
    const newSummary = [nextRem, nextAct].filter(Boolean).join(' + ');

    const shouldArchiveReplaced =
      problem.status === 'testing' && (remChanged || actChanged) && Boolean(oldSummary) && oldSummary !== newSummary;

    const next = cur.map(p => {
      if (p.id !== id) return p;

      let updatedCheckIns = (p.checkIns || []).map(c =>
        c.tweakNote?.trim() || c.outcome === 'tweaked' ? { ...c, tweakApplied: true } : c
      );

      const shouldRestart = p.status === 'open' || Boolean(revision.restartTest);
      if (shouldRestart) {
        updatedCheckIns = updatedCheckIns.filter(c => !(c.date === revDate && c.outcome === 'failed'));
      }

      if (revNote) {
        const existingRev = updatedCheckIns.find(c => c.date === revDate);
        const others = updatedCheckIns.filter(c => c.date !== revDate);
        if (existingRev) {
          updatedCheckIns = [
            ...others,
            { ...existingRev, tweakNote: revNote, tweakApplied: true }
          ].sort((a, b) => a.date.localeCompare(b.date));
        } else {
          updatedCheckIns = [
            ...others,
            { date: revDate, outcome: 'tweaked' as ProblemCheckInOutcome, note: revNote, tweakNote: revNote, tweakApplied: true }
          ].sort((a, b) => a.date.localeCompare(b.date));
        }
      }

      const nextAttempts = [...(p.fixAttempts || [])];
      if (shouldArchiveReplaced) {
        const startedAt = (p.fixStartedAt || p.updatedAt || p.createdAt || revDate).slice(0, 10);
        nextAttempts.push({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          fixText: oldSummary,
          startedAt,
          endedAt: revDate,
          outcome: 'replaced',
          daysHeld: daysBetweenDates(startedAt, revDate),
          ...(revNote ? { note: revNote } : {})
        });
      }

      const nextP: ProblemEntry = {
        ...p,
        classified: true,
        ...('trigger' in revision ? { trigger: (revision.trigger || '').trim() } : {}),
        ...('reminderText' in revision
          ? {
              isGuardrail: Boolean(nextRem),
              reminderText: nextRem
            }
          : {}),
        ...('fixNote' in revision ? { fixNote: nextAct } : {}),
        ...(nextAttempts.length > 0 ? { fixAttempts: nextAttempts } : {}),
        ...(updatedCheckIns.length > 0 ? { checkIns: updatedCheckIns } : { checkIns: [] }),
        updatedAt: nowIso
      };

      if (!nextP.trigger?.trim()) delete nextP.trigger;
      if (!nextP.reminderText?.trim()) delete nextP.reminderText;
      if (!nextP.fixNote?.trim()) delete nextP.fixNote;

      if (shouldRestart) {
        nextP.status = 'testing';
        nextP.fixStartedAt = revDate;
        delete nextP.lastFixFailedAt;
        delete nextP.solvedAt;
      }

      return nextP;
    });

    commitProblems(next);
    markLocalMutation();

    // Sync linked Weekly Tasks & Checklist Items when Action text was revised
    if ('fixNote' in revision && oldAct && nextAct && oldAct.toLowerCase() !== nextAct.toLowerCase()) {
      const oldLower = oldAct.toLowerCase();
      const hasLinkedChecklist = checklistItemsRef.current.some(
        i => i.problemId === id && i.text.trim().toLowerCase() === oldLower
      );
      if (hasLinkedChecklist) {
        saveChecklistItems(
          checklistItemsRef.current.map(i =>
            i.problemId === id && i.text.trim().toLowerCase() === oldLower
              ? { ...i, text: nextAct }
              : i
          )
        );
      }

      Object.values(weeklyPlansRef.current).forEach(wp => {
        let changed = false;
        const updatedTasks = (wp.tasks || []).map(task => {
          let t = task;
          if (t.problemId === id && t.text.trim().toLowerCase() === oldLower) {
            t = { ...t, text: nextAct };
            changed = true;
          }
          if (t.subTasks && t.subTasks.length > 0) {
            const updatedSubs = t.subTasks.map(sub => {
              if (sub.problemId === id && sub.text.trim().toLowerCase() === oldLower) {
                changed = true;
                return { ...sub, text: nextAct };
              }
              return sub;
            });
            t = { ...t, subTasks: updatedSubs };
          }
          return t;
        });
        if (changed) {
          saveWeeklyPlan({ ...wp, tasks: updatedTasks });
        }
      });
    }
  };

  // Honest check-in ("Held today / Held this week"): logs that the reminder/fix held WITHOUT prematurely closing as Solved
  const recordProblemHeld: StorageContextType['recordProblemHeld'] = (id, date) => {
    recordProblemCheckIn(id, 'effective', { date });
  };

  const clusterIntoNewParent: StorageContextType['clusterIntoNewParent'] = (
    childId,
    parentTitle,
    parentScale
  ) => {
    const trimmed = parentTitle.trim();
    if (!trimmed) return null;
    const cur = problemsRef.current;
    const child = cur.find(p => p.id === childId);
    if (!child) return null;

    const nowIso = new Date().toISOString();
    const latestDate =
      child.occurrences?.[child.occurrences.length - 1]?.date || getTodayDateString();
    const newParent: ProblemEntry = {
      id: `prob_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: trimmed,
      category: child.category,
      scale: parentScale,
      tags: [...(child.tags || [])],
      status: child.status === 'solved' ? 'solved' : 'open',
      occurrences: [
        {
          date: latestDate,
          sourceType: parentScale === 'blocker' ? 'monthly' : 'weekly',
          note: `Clustered from: ${child.title}`
        }
      ],
      createdAt: nowIso,
      updatedAt: nowIso
    };
    const next = [
      newParent,
      ...cur.map(p =>
        p.id === childId ? { ...p, parentProblemId: newParent.id, updatedAt: nowIso } : p
      )
    ];
    commitProblems(next);
    markLocalMutation();
    return newParent;
  };

  const deleteProblem = (id: string) => {
    recordDeletedIds([id]);
    const nowIso = new Date().toISOString();
    const next = problemsRef.current
      .filter(p => p.id !== id)
      .map(p => {
        if (p.parentProblemId === id) {
          const unlinked = { ...p, updatedAt: nowIso };
          delete unlinked.parentProblemId;
          return unlinked;
        }
        return p;
      });
    commitProblems(next);
    markLocalMutation();
  };

  const deleteProblemOccurrence: StorageContextType['deleteProblemOccurrence'] = (
    problemId,
    occurrenceIndex
  ) => {
    const nowIso = new Date().toISOString();
    const next = problemsRef.current.map(p => {
      if (p.id !== problemId) return p;
      const occs = [...(p.occurrences || [])];
      if (occurrenceIndex < 0 || occurrenceIndex >= occs.length) return p;
      const [removed] = occs.splice(occurrenceIndex, 1);
      const removedDate = removed?.date;
      const hasSameDayOccLeft = Boolean(removedDate && occs.some(o => o.date === removedDate));

      let nextCheckIns = p.checkIns;
      let nextLastFailed = p.lastFixFailedAt;
      if (removedDate && !hasSameDayOccLeft) {
        if (nextCheckIns?.some(c => c.date === removedDate && c.outcome === 'failed')) {
          nextCheckIns = nextCheckIns.filter(c => !(c.date === removedDate && c.outcome === 'failed'));
        }
        if (nextLastFailed === removedDate) {
          nextLastFailed = undefined;
        }
      }

      const updated: ProblemEntry = {
        ...p,
        occurrences: occs,
        ...(nextCheckIns ? { checkIns: nextCheckIns } : {}),
        updatedAt: nowIso,
        prunedAt: nowIso
      };
      if (nextLastFailed) updated.lastFixFailedAt = nextLastFailed;
      else delete updated.lastFixFailedAt;
      return updated;
    });
    commitProblems(next);
    markLocalMutation();
  };

  const deleteProblemCheckIn: StorageContextType['deleteProblemCheckIn'] = (problemId, date) => {
    const nowIso = new Date().toISOString();
    const next = problemsRef.current.map(p => {
      if (p.id !== problemId) return p;
      const nextCheckIns = (p.checkIns || []).filter(c => c.date !== date);
      const nextHeldDates = (p.heldDates || []).filter(d => d !== date).sort();
      const latestHeld = nextHeldDates[nextHeldDates.length - 1];
      const updated: ProblemEntry = {
        ...p,
        checkIns: nextCheckIns,
        heldDates: nextHeldDates,
        updatedAt: nowIso,
        prunedAt: nowIso
      };
      if (latestHeld) updated.lastHeldDate = latestHeld;
      else delete updated.lastHeldDate;
      if (updated.lastFixFailedAt === date) {
        delete updated.lastFixFailedAt;
      }
      return updated;
    });
    commitProblems(next);
    markLocalMutation();
  };

  const deleteProblemFixAttempt: StorageContextType['deleteProblemFixAttempt'] = (
    problemId,
    attemptId
  ) => {
    const nowIso = new Date().toISOString();
    const next = problemsRef.current.map(p => {
      if (p.id !== problemId) return p;
      const attempts = p.fixAttempts || [];
      const removed = attempts.find(a => a.id === attemptId);
      const nextAttempts = attempts.filter(a => a.id !== attemptId);
      const updated: ProblemEntry = {
        ...p,
        fixAttempts: nextAttempts,
        updatedAt: nowIso,
        prunedAt: nowIso
      };
      if (removed?.outcome === 'failed' && updated.lastFixFailedAt === removed.endedAt) {
        delete updated.lastFixFailedAt;
      }
      return updated;
    });
    commitProblems(next);
    markLocalMutation();
  };

  const dispatchProblemFix: StorageContextType['dispatchProblemFix'] = (
    problemId,
    destination,
    customText,
    targetWeekId
  ) => {
    const problem = problemsRef.current.find(p => p.id === problemId);
    if (!problem) return false;

    const actionText = (customText || problem.fixNote || problem.title).trim();
    if (!actionText) return false;
    const normText = actionText.toLowerCase();

    if (destination === 'weekly_plan') {
      const targetPlan =
        (targetWeekId ? getWeeklyPlan(targetWeekId) : undefined) ||
        findBestWeeklyPlanForDate(selectedDateRef.current, weeklyPlansRef.current, selectedWeekIdRef.current) ||
        getWeeklyPlan(selectedWeekIdRef.current);

      const exists = targetPlan.tasks.some(
        t =>
          t.text.trim().toLowerCase() === normText ||
          (t.subTasks || []).some(s => s.text.trim().toLowerCase() === normText)
      );
      if (!exists) {
        const roadmapPlanId = resolveProblemRoadmapPlanId(problem, strategyPlansRef.current);
        const matchingWeeklyContainer = roadmapPlanId
          ? getWeeklyGoalsAssignedToRoadmap(targetPlan, roadmapPlanId)[0]
          : undefined;

        let nextTasks: TaskItem[];
        if (matchingWeeklyContainer) {
          // Identity-driven placement: route Problem fix straight inside the matching Roadmap Weekly Goal as a sub-goal!
          const newSub = {
            id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            text: actionText,
            completed: false,
            problemId: problem.id,
            ...(roadmapPlanId ? { strategyPlanId: roadmapPlanId } : {}),
            ...(matchingWeeklyContainer.strategyStageId
              ? { strategyStageId: matchingWeeklyContainer.strategyStageId }
              : {})
          };
          nextTasks = targetPlan.tasks.map(t => {
            if (t.id !== matchingWeeklyContainer.id) return t;
            const updatedSubs = [...(t.subTasks || []), newSub];
            return {
              ...t,
              subTasks: updatedSubs,
              completed: false
            };
          });
        } else {
          const linkedPlan = roadmapPlanId
            ? strategyPlansRef.current.find(sp => sp.id === roadmapPlanId)
            : undefined;
          nextTasks = [
            ...targetPlan.tasks,
            {
              id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              text: actionText,
              completed: false,
              score: 1,
              problemId: problem.id,
              ...(roadmapPlanId ? { strategyPlanId: roadmapPlanId } : {}),
              ...(linkedPlan ? { sourceLabel: linkedPlan.title } : {}),
              notes: `Fix for problem: ${problem.title}`
            }
          ];
        }
        saveWeeklyPlan({
          ...targetPlan,
          tasks: nextTasks,
          achievedScore: computeWeeklyAchievedScore(nextTasks)
        });
      }
    } else {
      const recMap: Record<Exclude<ProblemDispatchTarget, 'weekly_plan'>, ChecklistItem['recurrence']> = {
        checklist_oneoff: 'none',
        checklist_daily: 'daily',
        checklist_weekly: 'weekly',
        reps_board: 'tally'
      };
      const recurrence = recMap[destination];
      const existingItem = checklistItemsRef.current.find(
        i => i.recurrence === recurrence && i.text.trim().toLowerCase() === normText
      );
      if (existingItem) {
        if (!existingItem.problemId) {
          saveChecklistItems(
            checklistItemsRef.current.map(i =>
              i.id === existingItem.id ? { ...i, problemId: problem.id } : i
            )
          );
        }
      } else {
        let volumePerRep: number | undefined;
        let volumeUnit: string | undefined;
        if (recurrence === 'tally') {
          const m = actionText.match(/(\d+(?:\.\d+)?)\s*(min|mins|m|hr|hrs|h|ml|l|pages?|reps?|sets?|km|cards?|drills?)\b/i);
          if (m) {
            volumePerRep = parseFloat(m[1]);
            volumeUnit = m[2].toLowerCase();
          }
        }
        const newItem: ChecklistItem = {
          id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          categoryId: checklistCategoriesRef.current[0]?.id || 'cat_general',
          text: actionText,
          recurrence,
          completed: false,
          completedPeriods: [],
          problemId: problem.id,
          ...(recurrence === 'tally' ? { totalCount: 0 } : {}),
          ...(volumePerRep !== undefined ? { volumePerRep, volumeUnit } : {}),
          createdAt: getTodayDateString()
        };
        saveChecklistItems([...checklistItemsRef.current, newItem]);
      }
    }

    const prevTargets = problem.dispatchedTo || [];
    const nextTargets = prevTargets.includes(destination)
      ? prevTargets
      : [...prevTargets, destination];
    updateProblem(problemId, {
      dispatchedTo: nextTargets,
      ...(problem.status === 'open' ? { status: 'testing', fixStartedAt: getTodayDateString() } : {}),
      ...(customText?.trim() && !problem.fixNote?.trim() ? { fixNote: customText.trim() } : {})
    });
    return true;
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
    recordDeletedIds([id]);
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
    recordDeletedIds([id]);
    commitReviews(reviewsRef.current.filter(r => r.id !== id));
    markLocalMutation();
  };

  const saveChecklistCategories = (cats: ChecklistCategory[]) => {
    const nextIds = new Set(cats.map(c => c.id));
    const removed = checklistCategoriesRef.current
      .filter(c => !nextIds.has(c.id))
      .map(c => c.id);
    if (removed.length > 0) recordDeletedIds(removed);
    commitChecklistCategories(cats);
    markLocalMutation();
  };

  const saveAllowanceItems = (items: AllowanceItem[]) => {
    const nextIds = new Set(items.map(i => i.id));
    const removed = allowanceItemsRef.current
      .filter(i => !nextIds.has(i.id))
      .map(i => i.id);
    if (removed.length > 0) recordDeletedIds(removed);
    const nowIso = new Date().toISOString();
    const prevMap = new Map(allowanceItemsRef.current.map(i => [i.id, i]));
    const stamped = items.map(item => {
      const prev = prevMap.get(item.id);
      const changed = !prev || JSON.stringify(prev) !== JSON.stringify(item);
      return changed ? { ...item, updatedAt: nowIso } : item;
    });
    commitAllowanceItems(stamped);
    markLocalMutation();
  };

  const addPlaybookItem = (input: {
    kind: PlaybookKind;
    title: string;
    note?: string;
    pinned?: boolean;
    tags?: string[];
  }): PlaybookEntry => {
    const nowIso = new Date().toISOString();
    const item: PlaybookEntry = {
      id: `pb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      kind: input.kind,
      title: input.title.trim(),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      ...(input.pinned ? { pinned: true } : {}),
      ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
      createdAt: nowIso,
      updatedAt: nowIso
    };
    commitPlaybookItems([item, ...playbookItemsRef.current]);
    markLocalMutation();
    return item;
  };

  const updatePlaybookItem = (id: string, patch: Partial<PlaybookEntry>) => {
    const nowIso = new Date().toISOString();
    const next = playbookItemsRef.current.map(item =>
      item.id === id ? { ...item, ...patch, updatedAt: nowIso } : item
    );
    commitPlaybookItems(next);
    markLocalMutation();
  };

  const deletePlaybookItem = (id: string) => {
    recordDeletedIds([id]);
    commitPlaybookItems(playbookItemsRef.current.filter(item => item.id !== id));
    markLocalMutation();
  };

  const saveChecklistItems = (items: ChecklistItem[]) => {
    const prevList = checklistItemsRef.current;
    const prevById = new Map(prevList.map(i => [i.id, i]));
    const nextIds = new Set(items.map(i => i.id));
    const removed = prevList
      .filter(i => !nextIds.has(i.id))
      .map(i => i.id);
    if (removed.length > 0) recordDeletedIds(removed);
    commitChecklistItems(items);

    const curDate = selectedDateRef.current;
    const curWeekId = selectedWeekIdRef.current;
    const curMonthKey = curDate.slice(0, 7);
    const realToday = getTodayDateString();
    const activeDailyForDate = getActiveDailyChecklistItemsForDate(
      curDate,
      items,
      dailyEntriesRef.current,
      realToday
    );
    const existingDay = dailyEntriesRef.current[curDate];
    const dayPatch: Partial<DailyEntry> = {};

    if (activeDailyForDate.length > 0) {
      const allDailyDone = activeDailyForDate.every(i => (i.completedPeriods || []).includes(curDate));
      if (!existingDay || existingDay.automaticTasksCompleted !== allDailyDone) {
        dayPatch.automaticTasksCompleted = allDailyDone;
      }
    }

    // Detect renamed One-Off items so linked Daily Mission items stay synced in text
    const renamedOneOffs = new Map<string, string>();
    items.forEach(chk => {
      if (chk.recurrence !== 'none') return;
      const prev = prevById.get(chk.id);
      if (prev && prev.text.trim() !== chk.text.trim() && chk.text.trim().length > 0) {
        renamedOneOffs.set(chk.id, chk.text.trim());
      }
    });

    if (renamedOneOffs.size > 0) {
      const currentDailyMap = dailyEntriesRef.current;
      let anyRenameChanged = false;
      const nextDailyMap: Record<string, DailyEntry> = { ...currentDailyMap };
      Object.entries(currentDailyMap).forEach(([dKey, entry]) => {
        const pItems = getPriorityItemsForEntry(entry);
        let dChanged = false;
        const updatedPItems = pItems.map(p => {
          if (!p.checklistItemId) return p;
          const nextText = renamedOneOffs.get(p.checklistItemId);
          if (nextText && p.text.trim() !== nextText) {
            dChanged = true;
            anyRenameChanged = true;
            return { ...p, text: nextText };
          }
          return p;
        });
        if (dChanged) {
          nextDailyMap[dKey] = {
            ...entry,
            priorityItems: updatedPItems,
            planNotes: formatPriorityItemsToPlanNotes(updatedPItems),
            updatedAt: new Date().toISOString()
          };
        }
      });
      if (anyRenameChanged) {
        commitDailyEntries(nextDailyMap);
      }
    }

    // Two-way sync: propagate Weekly / Monthly / One-Off checklist toggles to any linked non-pushed priority on selectedDate
    const latestDay = dailyEntriesRef.current[curDate];
    if (latestDay) {
      const dayItems = getPriorityItemsForEntry(latestDay);
      let priosChanged = false;
      const nextDayItems = dayItems.map(pItem => {
        if (!pItem.checklistItemId || pItem.pushedToDate) return pItem;
        const chk = items.find(i => i.id === pItem.checklistItemId);
        if (!chk || chk.recurrence === 'tally') return pItem;
        const isDoneNow =
          chk.recurrence === 'none'
            ? chk.completed
            : (chk.completedPeriods || []).includes(
                chk.recurrence === 'daily'
                  ? curDate
                  : chk.recurrence === 'weekly'
                  ? curWeekId
                  : curMonthKey
              );
        if (pItem.completed !== isDoneNow) {
          priosChanged = true;
          return { ...pItem, completed: isDoneNow };
        }
        return pItem;
      });
      if (priosChanged) {
        dayPatch.priorityItems = nextDayItems;
      }
    }

    if (Object.keys(dayPatch).length > 0) {
      applyDailyEntryUpdate(curDate, dayPatch);
    }

    // Two-way sync: completing a dispatched One-Off checklist item linked to a Problem stamps fixTaskCompletedAt
    const completedChecklistProblemIds: string[] = [];
    items.forEach(chk => {
      if (chk.recurrence !== 'none' || !chk.problemId || !chk.completed) return;
      const prev = prevById.get(chk.id);
      if (!prev || !prev.completed) {
        completedChecklistProblemIds.push(chk.problemId);
      }
    });
    if (completedChecklistProblemIds.length > 0) {
      const fixSet = new Set(completedChecklistProblemIds);
      const nowIso = new Date().toISOString();
      let probChanged = false;
      const nextProbs = problemsRef.current.map(p => {
        if (!fixSet.has(p.id) || p.status === 'solved') return p;
        probChanged = true;
        return {
          ...p,
          fixTaskCompletedAt: realToday,
          updatedAt: nowIso
        };
      });
      if (probChanged) {
        commitProblems(nextProbs);
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
      schemaVersion: 2,
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
      quarterlyPlans: quarterlyPlansRef.current,
      yearlyPlans: yearlyPlansRef.current,
      lifePillars: lifePillarsRef.current,
      customReviewPrompts: customReviewPromptsRef.current,
      macroReviewSettings: macroReviewSettingsRef.current,
      problemCategories: problemCategoriesRef.current,
      problemSettings: problemSettingsRef.current,
      strategyPlans: strategyPlansRef.current,
      problems: problemsRef.current,
      reviews: reviewsRef.current,
      checklistCategories: checklistCategoriesRef.current,
      checklistItems: checklistItemsRef.current,
      allowanceItems: allowanceItemsRef.current,
      playbookItems: playbookItemsRef.current,
      deletedIds: deletedIdsRef.current
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
        (src.quarterlyPlans && typeof src.quarterlyPlans === 'object') ||
        (src.yearlyPlans && typeof src.yearlyPlans === 'object') ||
        Array.isArray(src.lifePillars) ||
        Array.isArray(src.customReviewPrompts) ||
        (src.macroReviewSettings && typeof src.macroReviewSettings === 'object') ||
        Array.isArray(src.problemCategories) ||
        (src.problemSettings && typeof src.problemSettings === 'object') ||
        Array.isArray(src.strategyPlans) ||
        Array.isArray(src.problems) ||
        Array.isArray(src.reviews) ||
        Array.isArray(src.checklistItems) ||
        Array.isArray(src.allowanceItems) ||
        Array.isArray(src.playbookItems);

      if (!hasRecognizedField) return false;
      saveAutoLocalSnapshot('Before JSON import');

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
      if (src.quarterlyPlans && typeof src.quarterlyPlans === 'object') {
        const cleanedQ: Record<string, QuarterlyPlan> = {};
        Object.entries(src.quarterlyPlans).forEach(([k, p]) => {
          cleanedQ[k] = normalizeQuarterlyPlanEntry(k, p as QuarterlyPlan);
        });
        commitQuarterlyPlans(cleanedQ);
      }
      if (src.yearlyPlans && typeof src.yearlyPlans === 'object') {
        const cleanedY: Record<string, YearlyPlan> = {};
        Object.entries(src.yearlyPlans).forEach(([k, p]) => {
          cleanedY[k] = normalizeYearlyPlanEntry(k, p as YearlyPlan);
        });
        commitYearlyPlans(cleanedY);
      }
      if (Array.isArray(src.lifePillars)) commitLifePillars(src.lifePillars);
      if (Array.isArray(src.customReviewPrompts)) commitCustomReviewPrompts(src.customReviewPrompts);
      if (src.macroReviewSettings && typeof src.macroReviewSettings === 'object') {
        commitMacroReviewSettings(src.macroReviewSettings);
      }
      if (Array.isArray(src.problemCategories) && src.problemCategories.length > 0) {
        commitProblemCategories(src.problemCategories);
      }
      if (src.problemSettings && typeof src.problemSettings === 'object') {
        commitProblemSettings(src.problemSettings);
      }
      if (Array.isArray(src.strategyPlans)) commitStrategyPlans(src.strategyPlans);
      if (Array.isArray(src.problems)) commitProblems(src.problems);
      if (Array.isArray(src.reviews)) commitReviews(src.reviews);
      if (Array.isArray(src.checklistCategories)) commitChecklistCategories(src.checklistCategories);
      if (Array.isArray(src.checklistItems)) commitChecklistItems(src.checklistItems);
      if (Array.isArray(src.allowanceItems)) commitAllowanceItems(src.allowanceItems);
      if (Array.isArray(src.playbookItems)) commitPlaybookItems(src.playbookItems);
      if (src.deletedIds && typeof src.deletedIds === 'object') {
        commitDeletedIds(src.deletedIds);
      }
      if (typeof src.systemLevel === 'number' && src.systemLevel >= 0 && src.systemLevel <= 5) {
        if (src.systemLevel >= 1) rememberNormalLevel(src.systemLevel as SystemLevel);
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
    saveAutoLocalSnapshot('Before reset sample data');
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
    commitQuarterlyPlans(INITIAL_QUARTERLY_PLANS);
    commitYearlyPlans(INITIAL_YEARLY_PLANS);
    commitLifePillars(INITIAL_LIFE_PILLARS);
    commitCustomReviewPrompts(INITIAL_CUSTOM_REVIEW_PROMPTS);
    commitMacroReviewSettings({});
    commitProblemCategories(INITIAL_PROBLEM_CATEGORIES);
    commitProblemSettings(DEFAULT_PROBLEM_SETTINGS);
    commitStrategyPlans(INITIAL_STRATEGY_PLANS);
    commitProblems([]);
    commitReviews([]);
    commitChecklistCategories(INITIAL_CHECKLIST_CATEGORIES);
    commitChecklistItems(INITIAL_CHECKLIST_ITEMS);
    commitAllowanceItems(INITIAL_ALLOWANCE_ITEMS);
    commitPlaybookItems([]);
    commitDeletedIds({});
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
      quarterlyPlans: {} as Record<string, QuarterlyPlan>,
      yearlyPlans: {} as Record<string, YearlyPlan>,
      lifePillars: INITIAL_LIFE_PILLARS,
      customReviewPrompts: [] as CustomReviewPrompt[],
      macroReviewSettings: {} as MacroReviewSettings,
      problemCategories: INITIAL_PROBLEM_CATEGORIES,
      problemSettings: DEFAULT_PROBLEM_SETTINGS,
      strategyPlans: [] as StrategyPlan[],
      problems: [] as ProblemEntry[],
      reviews: [] as ReviewEntry[],
      checklistCategories: [{ id: 'cat_general', name: 'General' }] as ChecklistCategory[],
      checklistItems: [] as ChecklistItem[],
      allowanceItems: [] as AllowanceItem[],
      playbookItems: [] as PlaybookEntry[],
      systemLevel: 1 as SystemLevel
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
    commitQuarterlyPlans(fresh.quarterlyPlans);
    commitYearlyPlans(fresh.yearlyPlans);
    commitLifePillars(fresh.lifePillars);
    commitCustomReviewPrompts(fresh.customReviewPrompts);
    commitMacroReviewSettings(fresh.macroReviewSettings);
    commitProblemCategories(fresh.problemCategories);
    commitProblemSettings(fresh.problemSettings);
    commitStrategyPlans(fresh.strategyPlans);
    commitProblems(fresh.problems);
    commitReviews(fresh.reviews);
    commitChecklistCategories(fresh.checklistCategories);
    commitChecklistItems(fresh.checklistItems);
    commitAllowanceItems(fresh.allowanceItems);
    commitPlaybookItems(fresh.playbookItems);
    commitSystemLevel(fresh.systemLevel);
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
    saveAutoLocalSnapshot('Before Start Fresh');
    commitDeletedIds({});
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

  const missingPlanAlerts = useMemo<MissingPlanAlert[]>(() => {
    const alerts: MissingPlanAlert[] = [];
    if (systemLevel >= 1 && !hasTodayPlan) {
      alerts.push({
        id: 'missing_daily',
        title: "Today's Plan Isn't Made",
        message: `No priorities set yet for today (${todayDate}). Lock in your Day Mission.`,
        actionLabel: 'Plan Today',
        targetSubTab: 'daily'
      });
    }
    if (systemLevel >= 3 && !hasCurrentWeekPlan) {
      alerts.push({
        id: 'missing_weekly',
        title: `Week ${currentWeekNumForAlerts} Plan Isn't Made`,
        message: `Set your weekly focus & deliverables for ${currentWeekRangeForAlerts.startDate} → ${currentWeekRangeForAlerts.endDate}.`,
        actionLabel: `Plan Week ${currentWeekNumForAlerts}`,
        targetSubTab: 'weekly'
      });
    }
    return alerts;
  }, [
    systemLevel,
    hasTodayPlan,
    todayDate,
    hasCurrentWeekPlan,
    currentWeekNumForAlerts,
    currentWeekRangeForAlerts.startDate,
    currentWeekRangeForAlerts.endDate
  ]);

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

  const applyCloudPayload = (
    state: any,
    options?: { skipSnapshot?: boolean; snapshotReason?: string }
  ) => {
    if (!state || typeof state !== 'object') return;
    const sliceDiffers = (cur: unknown, next: unknown): boolean => {
      if (cur === next) return false;
      try {
        return JSON.stringify(cur) !== JSON.stringify(next);
      } catch {
        return true;
      }
    };

    const cloudEpoch = state.onboardingStartDate || state.weeklyPlans?.['week_1']?.startDate || '2026-10-12';
    const nextDaily = state.dailyEntries
      ? Object.fromEntries(
          Object.entries(state.dailyEntries).map(([d, entry]) => [
            d,
            normalizeDailyEntryFields(d, entry as DailyEntry)
          ])
        )
      : null;
    const nextWeekly = state.weeklyPlans
      ? ensureContinuousWeeks(state.weeklyPlans, getTodayDateString(), cloudEpoch)
      : null;
    const nextMonthly =
      state.monthlyPlans && typeof state.monthlyPlans === 'object'
        ? Object.fromEntries(
            Object.entries(state.monthlyPlans).map(([k, p]) => [
              k,
              normalizeMonthlyPlanEntry(k, p as MonthlyPlan)
            ])
          )
        : null;
    const nextQuarterly =
      state.quarterlyPlans && typeof state.quarterlyPlans === 'object'
        ? Object.fromEntries(
            Object.entries(state.quarterlyPlans).map(([k, p]) => [
              k,
              normalizeQuarterlyPlanEntry(k, p as QuarterlyPlan)
            ])
          )
        : null;
    const nextYearly =
      state.yearlyPlans && typeof state.yearlyPlans === 'object'
        ? Object.fromEntries(
            Object.entries(state.yearlyPlans).map(([k, p]) => [
              k,
              normalizeYearlyPlanEntry(k, p as YearlyPlan)
            ])
          )
        : null;

    const changedTemplates = Array.isArray(state.templates) && sliceDiffers(templatesRef.current, state.templates);
    const changedDaily = nextDaily !== null && sliceDiffers(dailyEntriesRef.current, nextDaily);
    const changedGws = Array.isArray(state.gwsSessions) && sliceDiffers(gwsSessionsRef.current, state.gwsSessions);
    const changedWeekly = nextWeekly !== null && sliceDiffers(weeklyPlansRef.current, nextWeekly);
    const changedMonthly = nextMonthly !== null && sliceDiffers(monthlyPlansRef.current, nextMonthly);
    const changedQuarterly = nextQuarterly !== null && sliceDiffers(quarterlyPlansRef.current, nextQuarterly);
    const changedYearly = nextYearly !== null && sliceDiffers(yearlyPlansRef.current, nextYearly);
    const changedPillars = Array.isArray(state.lifePillars) && sliceDiffers(lifePillarsRef.current, state.lifePillars);
    const changedPrompts =
      Array.isArray(state.customReviewPrompts) &&
      sliceDiffers(customReviewPromptsRef.current, state.customReviewPrompts);
    const changedMacroSettings =
      state.macroReviewSettings &&
      typeof state.macroReviewSettings === 'object' &&
      sliceDiffers(macroReviewSettingsRef.current, state.macroReviewSettings);
    const changedProbCats =
      Array.isArray(state.problemCategories) &&
      state.problemCategories.length > 0 &&
      sliceDiffers(problemCategoriesRef.current, state.problemCategories);
    const changedProbSettings =
      state.problemSettings &&
      typeof state.problemSettings === 'object' &&
      sliceDiffers(problemSettingsRef.current, { ...DEFAULT_PROBLEM_SETTINGS, ...state.problemSettings });
    const changedStrategy =
      Array.isArray(state.strategyPlans) && sliceDiffers(strategyPlansRef.current, state.strategyPlans);
    const changedProblems = Array.isArray(state.problems) && sliceDiffers(problemsRef.current, state.problems);
    const changedReviews = Array.isArray(state.reviews) && sliceDiffers(reviewsRef.current, state.reviews);
    const changedCheckCats =
      Array.isArray(state.checklistCategories) &&
      sliceDiffers(checklistCategoriesRef.current, state.checklistCategories);
    const changedCheckItems =
      Array.isArray(state.checklistItems) && sliceDiffers(checklistItemsRef.current, state.checklistItems);
    const changedAllowances =
      Array.isArray(state.allowanceItems) && sliceDiffers(allowanceItemsRef.current, state.allowanceItems);
    const changedPlaybook =
      Array.isArray(state.playbookItems) && sliceDiffers(playbookItemsRef.current, state.playbookItems);
    const changedDeleted =
      state.deletedIds &&
      typeof state.deletedIds === 'object' &&
      sliceDiffers(deletedIdsRef.current, state.deletedIds);
    const changedLevel =
      typeof state.systemLevel === 'number' &&
      state.systemLevel >= 0 &&
      state.systemLevel <= 5 &&
      state.systemLevel !== systemLevelRef.current;

    const anySliceChanged =
      changedTemplates ||
      changedDaily ||
      changedGws ||
      changedWeekly ||
      changedMonthly ||
      changedQuarterly ||
      changedYearly ||
      changedPillars ||
      changedPrompts ||
      changedMacroSettings ||
      changedProbCats ||
      changedProbSettings ||
      changedStrategy ||
      changedProblems ||
      changedReviews ||
      changedCheckCats ||
      changedCheckItems ||
      changedAllowances ||
      changedPlaybook ||
      changedDeleted ||
      changedLevel;

    try {
      localStorage.setItem(ONBOARDING_EPOCH_KEY, cloudEpoch);
    } catch {
      // ignore
    }

    if (!anySliceChanged) return;

    if (!options?.skipSnapshot) {
      saveAutoLocalSnapshot(options?.snapshotReason || 'Before cloud sync');
    }
    if (changedTemplates) commitTemplates(state.templates);
    if (changedDaily && nextDaily) commitDailyEntries(nextDaily);
    if (changedGws) commitGwsSessions(state.gwsSessions);
    if (changedWeekly && nextWeekly) commitWeeklyPlans(nextWeekly);
    if (changedMonthly && nextMonthly) commitMonthlyPlans(nextMonthly);
    if (changedQuarterly && nextQuarterly) commitQuarterlyPlans(nextQuarterly);
    if (changedYearly && nextYearly) commitYearlyPlans(nextYearly);
    if (changedPillars) commitLifePillars(state.lifePillars);
    if (changedPrompts) commitCustomReviewPrompts(state.customReviewPrompts);
    if (changedMacroSettings) commitMacroReviewSettings(state.macroReviewSettings);
    if (changedProbCats) commitProblemCategories(state.problemCategories);
    if (changedProbSettings) commitProblemSettings(state.problemSettings);
    if (changedStrategy) commitStrategyPlans(state.strategyPlans);
    if (changedProblems) commitProblems(state.problems);
    if (changedReviews) commitReviews(state.reviews);
    if (changedCheckCats) commitChecklistCategories(state.checklistCategories);
    if (changedCheckItems) commitChecklistItems(state.checklistItems);
    if (changedAllowances) commitAllowanceItems(state.allowanceItems);
    if (changedPlaybook) commitPlaybookItems(state.playbookItems);
    if (changedDeleted) commitDeletedIds(state.deletedIds);
    if (changedLevel) {
      if (state.systemLevel >= 1) rememberNormalLevel(state.systemLevel as SystemLevel);
      commitSystemLevel(state.systemLevel as SystemLevel);
    }
  };

  const restoreLocalSnapshot = (snapshotId: string): boolean => {
    const snap = localSnapshotsRef.current.find(s => s.id === snapshotId);
    if (!snap || !snap.state) return false;
    saveAutoLocalSnapshot('Before restoring snapshot');
    applyCloudPayload(snap.state, { skipSnapshot: true });
    markLocalMutation();
    return true;
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

    let needsCloudPush = hasPendingPush;

    // 0. Merge deletion tombstones (id -> latest deletedAt ISO) so explicit deletions sync across devices without ever clobbering unrelated items
    const localDeleted: Record<string, string> = local.deletedIds || {};
    const cloudDeleted: Record<string, string> =
      cloudState?.deletedIds && typeof cloudState.deletedIds === 'object'
        ? cloudState.deletedIds
        : {};
    const mergedDeletedIds: Record<string, string> = pruneTombstones({ ...cloudDeleted });
    Object.entries(localDeleted).forEach(([id, ts]) => {
      const lDelMs = Date.parse(ts || '') || 0;
      const cDelMs = Date.parse(mergedDeletedIds[id] || '') || 0;
      if (lDelMs > cDelMs) {
        mergedDeletedIds[id] = ts;
        needsCloudPush = true;
      }
    });

    // Helper: True per-item union merge by ID with tombstone support (NEVER clobbers entire arrays across devices!)
    const mergeCollectionById = <T extends { id: string }>(
      localArr: T[],
      cloudArrRaw: any,
      getTimeMs: (item: T) => number,
      mergeBoth?: (lItem: T, cItem: T) => T
    ): T[] => {
      if (!Array.isArray(cloudArrRaw)) {
        if (localArr.length > 0) needsCloudPush = true;
        return localArr;
      }
      const cloudArr = cloudArrRaw as T[];
      const localMap = new Map<string, T>();
      const cloudMap = new Map<string, T>();
      localArr.forEach(item => {
        if (item?.id) localMap.set(item.id, item);
      });
      cloudArr.forEach(item => {
        if (item?.id) cloudMap.set(item.id, item);
      });

      const orderedIds: string[] = [];
      const seen = new Set<string>();
      const pushId = (id: string) => {
        if (!seen.has(id)) {
          seen.add(id);
          orderedIds.push(id);
        }
      };
      // Preserve order from newer device first, then append any items unique to the other device
      (localIsNewer ? localArr : cloudArr).forEach(i => i?.id && pushId(i.id));
      (localIsNewer ? cloudArr : localArr).forEach(i => i?.id && pushId(i.id));

      const result: T[] = [];
      orderedIds.forEach(id => {
        const lItem = localMap.get(id);
        const cItem = cloudMap.get(id);
        const delMs = Date.parse(mergedDeletedIds[id] || '') || 0;

        if (lItem && cItem) {
          if (mergeBoth) {
            const merged = mergeBoth(lItem, cItem);
            if (JSON.stringify(merged) !== JSON.stringify(cItem)) {
              needsCloudPush = true;
            }
            result.push(merged);
          } else {
            const lT = getTimeMs(lItem);
            const cT = getTimeMs(cItem);
            if (lT > cT || (lT === cT && localIsNewer)) {
              if (JSON.stringify(lItem) !== JSON.stringify(cItem)) needsCloudPush = true;
              result.push(lItem);
            } else {
              result.push(cItem);
            }
          }
        } else if (lItem && !cItem) {
          const lT = getTimeMs(lItem) || localMs;
          // Respect cloud deletion ONLY if tombstoned after this item was created/updated
          if (delMs > 0 && delMs >= lT) {
            return;
          }
          result.push(lItem);
          needsCloudPush = true;
        } else if (cItem && !lItem) {
          const cT = getTimeMs(cItem) || cloudMs;
          // Respect local deletion ONLY if tombstoned after this cloud item was created/updated
          if (delMs > 0 && delMs >= cT) {
            needsCloudPush = true;
            return;
          }
          result.push(cItem);
        }
      });

      return result;
    };

    // 1. Merge dailyEntries per date (prefer populated content + newer updatedAt + union gwsSessionIds)
    const mergedDailyEntries: Record<string, DailyEntry> = {};
    const cloudDaily = (cloudState?.dailyEntries || {}) as Record<string, DailyEntry>;
    const allDates = new Set([...Object.keys(local.dailyEntries), ...Object.keys(cloudDaily)]);

    const hasDailyContent = (d: DailyEntry) =>
      Boolean(
        (d.priorityItems && d.priorityItems.length > 0) ||
          Boolean(d.daySpirit && d.daySpirit.trim().length > 0) ||
          (d.planNotes && d.planNotes.trim().length > 0) ||
          (d.reviewNotes && d.reviewNotes.trim().length > 0) ||
          (d.problemsEncountered && d.problemsEncountered.trim().length > 0) ||
          d.executionScore > 0 ||
          d.automaticTasksCompleted ||
          (d.gwsSessionIds && d.gwsSessionIds.length > 0) ||
          (d.energyCheck &&
            (d.energyCheck.wakeUp ||
              d.energyCheck.midday ||
              d.energyCheck.night ||
              d.energyCheck.nervousSystemScore ||
              d.energyCheck.nervousSystemState ||
              d.energyCheck.nervousSystemNote?.trim())) ||
          Boolean(d.alignmentVerdict || d.alignmentNote?.trim()) ||
          Boolean(d.priorityAudits && Object.keys(d.priorityAudits).length > 0) ||
          Boolean(d.restBlocks && d.restBlocks.length > 0)
      );

    allDates.forEach(date => {
      const lRaw = local.dailyEntries[date];
      const cRaw = cloudDaily[date];
      if (lRaw && !cRaw) {
        mergedDailyEntries[date] = normalizeDailyEntryFields(date, lRaw);
        if (hasDailyContent(mergedDailyEntries[date])) needsCloudPush = true;
      } else if (cRaw && !lRaw) {
        mergedDailyEntries[date] = normalizeDailyEntryFields(date, cRaw);
      } else if (lRaw && cRaw) {
        const l = normalizeDailyEntryFields(date, lRaw);
        const c = normalizeDailyEntryFields(date, cRaw);
        const lTime = Date.parse(l.updatedAt || '') || 0;
        const cTime = Date.parse(c.updatedAt || '') || 0;
        const lHas = hasDailyContent(l);
        const cHas = hasDailyContent(c);
        const unionGwsIds = Array.from(new Set([...(c.gwsSessionIds || []), ...(l.gwsSessionIds || [])]));

        let chosen: DailyEntry;
        let other: DailyEntry;
        if (lHas && !cHas) {
          chosen = l;
          other = c;
          needsCloudPush = true;
        } else if (cHas && !lHas) {
          chosen = c;
          other = l;
        } else if (lTime > cTime) {
          chosen = l;
          other = c;
          needsCloudPush = true;
        } else if (cTime > lTime) {
          chosen = c;
          other = l;
        } else {
          chosen = hasPendingPush ? l : c;
          other = hasPendingPush ? c : l;
        }

        // Deep-merge priorities by ID (respecting deletedIds) + preserve non-empty review/notes/score + union GWS IDs
        const primaryItems = chosen.priorityItems || [];
        const secondaryItems = other.priorityItems || [];
        const mergedPrios: DailyPriorityItem[] = primaryItems.map(pItem => {
          const sMatch = secondaryItems.find(si => si.id === pItem.id);
          if (!sMatch) return pItem;
          return {
            ...pItem,
            weeklyTaskId: pItem.weeklyTaskId || sMatch.weeklyTaskId,
            subTaskId: pItem.subTaskId || sMatch.subTaskId,
            checklistItemId: pItem.checklistItemId || sMatch.checklistItemId,
            pushedToDate: pItem.pushedToDate !== undefined ? pItem.pushedToDate : sMatch.pushedToDate,
            pushedFromDate: pItem.pushedFromDate || sMatch.pushedFromDate,
            carriedDiagnosisCause: pItem.carriedDiagnosisCause || sMatch.carriedDiagnosisCause,
            carriedDiagnosisNote: pItem.carriedDiagnosisNote?.trim()
              ? pItem.carriedDiagnosisNote
              : sMatch.carriedDiagnosisNote
          };
        });
        const prioIds = new Set(primaryItems.map(i => i.id));
        const prioTexts = new Set(primaryItems.map(i => i.text.trim().toLowerCase()));
        secondaryItems.forEach(item => {
          const delMs = Date.parse(mergedDeletedIds[item.id] || '') || 0;
          const otherT = Date.parse(other.updatedAt || '') || 0;
          if (delMs > 0 && delMs >= otherT) return;
          if (!prioIds.has(item.id) && !prioTexts.has(item.text.trim().toLowerCase())) {
            mergedPrios.push(item);
            prioIds.add(item.id);
            prioTexts.add(item.text.trim().toLowerCase());
            needsCloudPush = true;
          }
        });

        const mergedPriorityAudits =
          chosen.priorityAudits || other.priorityAudits
            ? { ...(other.priorityAudits || {}), ...(chosen.priorityAudits || {}) }
            : undefined;

        const primaryRest = chosen.restBlocks || [];
        const secondaryRest = other.restBlocks || [];
        const mergedRestBlocks = [...primaryRest];
        const restIds = new Set(primaryRest.map(r => r.id));
        secondaryRest.forEach(rb => {
          const delMs = Date.parse(mergedDeletedIds[rb.id] || '') || 0;
          const otherT = Date.parse(other.updatedAt || '') || 0;
          if (delMs > 0 && delMs >= otherT) return;
          if (!restIds.has(rb.id)) {
            mergedRestBlocks.push(rb);
            restIds.add(rb.id);
            needsCloudPush = true;
          }
        });

        const mergedReviewNotes = chosen.reviewNotes?.trim() ? chosen.reviewNotes : other.reviewNotes || '';
        const mergedProblems = chosen.problemsEncountered?.trim()
          ? chosen.problemsEncountered
          : other.problemsEncountered || '';
        const mergedScore = chosen.executionScore > 0 ? chosen.executionScore : other.executionScore || 0;
        const mergedEnergyCheck: DailyEnergyCheck | undefined =
          chosen.energyCheck || other.energyCheck
            ? {
                wakeUp: chosen.energyCheck?.wakeUp ?? other.energyCheck?.wakeUp,
                midday: chosen.energyCheck?.midday ?? other.energyCheck?.midday,
                night: chosen.energyCheck?.night ?? other.energyCheck?.night,
                nervousSystemScore:
                  chosen.energyCheck?.nervousSystemScore ?? other.energyCheck?.nervousSystemScore,
                nervousSystemState:
                  chosen.energyCheck?.nervousSystemState ?? other.energyCheck?.nervousSystemState,
                nervousSystemNote: chosen.energyCheck?.nervousSystemNote?.trim()
                  ? chosen.energyCheck.nervousSystemNote
                  : other.energyCheck?.nervousSystemNote
              }
            : undefined;

        const mergedAlignmentVerdict = chosen.alignmentVerdict || other.alignmentVerdict;
        const mergedAlignmentNote = chosen.alignmentNote?.trim()
          ? chosen.alignmentNote
          : other.alignmentNote;
        const mergedDaySpirit = chosen.daySpirit?.trim() ? chosen.daySpirit : other.daySpirit;
        const mergedDaySpiritMode = chosen.daySpiritMode || other.daySpiritMode;
        const mergedDaySpiritHonored = chosen.daySpiritHonored ?? other.daySpiritHonored;

        if (
          unionGwsIds.length > (c.gwsSessionIds || []).length ||
          mergedPrios.length !== (c.priorityItems || []).length ||
          mergedReviewNotes !== (c.reviewNotes || '') ||
          (mergedDaySpirit || '') !== (c.daySpirit || '') ||
          mergedDaySpiritMode !== c.daySpiritMode ||
          mergedDaySpiritHonored !== c.daySpiritHonored ||
          JSON.stringify(mergedEnergyCheck || null) !== JSON.stringify(c.energyCheck || null) ||
          mergedAlignmentVerdict !== c.alignmentVerdict ||
          (mergedAlignmentNote || '') !== (c.alignmentNote || '') ||
          JSON.stringify(mergedPriorityAudits || null) !== JSON.stringify(c.priorityAudits || null) ||
          JSON.stringify(mergedRestBlocks) !== JSON.stringify(c.restBlocks || [])
        ) {
          needsCloudPush = true;
        }

        mergedDailyEntries[date] = normalizeDailyEntryFields(date, {
          ...chosen,
          priorityItems: mergedPrios,
          planNotes: formatPriorityItemsToPlanNotes(mergedPrios),
          gwsSessionIds: unionGwsIds,
          reviewNotes: mergedReviewNotes,
          problemsEncountered: mergedProblems,
          executionScore: mergedScore,
          ...(mergedDaySpirit?.trim() ? { daySpirit: mergedDaySpirit } : {}),
          ...(mergedDaySpiritMode ? { daySpiritMode: mergedDaySpiritMode } : {}),
          ...(mergedDaySpiritHonored !== undefined ? { daySpiritHonored: mergedDaySpiritHonored } : {}),
          ...(mergedEnergyCheck ? { energyCheck: mergedEnergyCheck } : {}),
          ...(mergedAlignmentVerdict ? { alignmentVerdict: mergedAlignmentVerdict } : {}),
          ...(mergedAlignmentNote?.trim() ? { alignmentNote: mergedAlignmentNote } : {}),
          ...(mergedPriorityAudits ? { priorityAudits: mergedPriorityAudits } : {}),
          ...(mergedRestBlocks.length > 0 ? { restBlocks: mergedRestBlocks } : {})
        });
      }
    });

    // Helper: deep-merge TaskItem lists (Weekly / Monthly / Yearly) by ID respecting tombstones
    const mergeTaskItemLists = (
      primaryTasks: TaskItem[],
      secondaryTasks: TaskItem[],
      secondaryUpdatedMs: number
    ): TaskItem[] => {
      const merged: TaskItem[] = primaryTasks.map(pt => {
        const match = secondaryTasks.find(st => st.id === pt.id);
        if (!match) return pt;
        const pSubs = pt.subTasks || [];
        const sSubs = match.subTasks || [];
        const mergedSubs = pSubs.map(ps => {
          const sMatch = sSubs.find(ss => ss.id === ps.id);
          if (!sMatch) return ps;
          return {
            ...ps,
            strategyPlanId: ps.strategyPlanId || sMatch.strategyPlanId,
            strategyStageId: ps.strategyStageId || sMatch.strategyStageId,
            strategyGoalId: ps.strategyGoalId || sMatch.strategyGoalId,
            problemId: ps.problemId || sMatch.problemId
          };
        });
        const pSubIds = new Set(pSubs.map(s => s.id));
        sSubs.forEach(ss => {
          const delMs = Date.parse(mergedDeletedIds[ss.id] || '') || 0;
          if (delMs > 0 && delMs >= secondaryUpdatedMs) return;
          if (!pSubIds.has(ss.id)) {
            mergedSubs.push(ss);
            pSubIds.add(ss.id);
            needsCloudPush = true;
          }
        });
        return {
          ...pt,
          kpiTarget: pt.kpiTarget?.trim() ? pt.kpiTarget : match.kpiTarget,
          kpiActual: pt.kpiActual?.trim() ? pt.kpiActual : match.kpiActual,
          status: pt.status || match.status,
          parkedReasonTag: pt.parkedReasonTag || match.parkedReasonTag,
          parkedReasonNote: pt.parkedReasonNote?.trim() ? pt.parkedReasonNote : match.parkedReasonNote,
          parkedAt: pt.parkedAt || match.parkedAt,
          parentLinkMode: pt.parentLinkMode || match.parentLinkMode,
          monthlyTaskId: pt.monthlyTaskId || match.monthlyTaskId,
          quarterlyTaskId: pt.quarterlyTaskId || match.quarterlyTaskId,
          yearlyTaskId: pt.yearlyTaskId || match.yearlyTaskId,
          strategyPlanId: pt.strategyPlanId || match.strategyPlanId,
          strategyStageId: pt.strategyStageId || match.strategyStageId,
          strategyGoalId: pt.strategyGoalId || match.strategyGoalId,
          problemId: pt.problemId || match.problemId,
          sourceLabel: pt.sourceLabel || match.sourceLabel,
          pushedToPeriod: pt.pushedToPeriod !== undefined ? pt.pushedToPeriod : match.pushedToPeriod,
          pushedFromPeriod: pt.pushedFromPeriod || match.pushedFromPeriod,
          carriedDiagnosisCause: pt.carriedDiagnosisCause || match.carriedDiagnosisCause,
          carriedDiagnosisNote: pt.carriedDiagnosisNote?.trim()
            ? pt.carriedDiagnosisNote
            : match.carriedDiagnosisNote,
          ...(mergedSubs.length > 0 ? { subTasks: mergedSubs } : {})
        };
      });
      const existingIds = new Set(primaryTasks.map(t => t.id));
      const existingTexts = new Set(primaryTasks.map(t => t.text.trim().toLowerCase()));
      secondaryTasks.forEach(st => {
        const delMs = Date.parse(mergedDeletedIds[st.id] || '') || 0;
        if (delMs > 0 && delMs >= secondaryUpdatedMs) return;
        if (!existingIds.has(st.id) && !existingTexts.has(st.text.trim().toLowerCase())) {
          merged.push(st);
          existingIds.add(st.id);
          existingTexts.add(st.text.trim().toLowerCase());
          needsCloudPush = true;
        }
      });
      return merged;
    };

    // 2. Merge weeklyPlans per weekId (deep-merging tasks + notes so concurrent edits on Phone & Desktop both survive!)
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

        let primary: WeeklyPlan;
        let secondary: WeeklyPlan;
        let secondaryTime: number;
        if (lHasContent && !cHasContent) {
          if (cTime > lTime && c.updatedAt !== EMPTY_WEEK_TIMESTAMP && !hasPendingPush && cloudMs > localMs) {
            primary = c;
            secondary = l;
            secondaryTime = lTime;
          } else {
            primary = l;
            secondary = c;
            secondaryTime = cTime;
            needsCloudPush = true;
          }
        } else if (cHasContent && !lHasContent) {
          if (hasPendingPush && lTime > cTime && l.updatedAt !== EMPTY_WEEK_TIMESTAMP) {
            primary = l;
            secondary = c;
            secondaryTime = cTime;
            needsCloudPush = true;
          } else {
            primary = c;
            secondary = l;
            secondaryTime = lTime;
          }
        } else if (lTime > cTime) {
          primary = l;
          secondary = c;
          secondaryTime = cTime;
          needsCloudPush = true;
        } else if (cTime > lTime) {
          primary = c;
          secondary = l;
          secondaryTime = lTime;
        } else {
          primary = hasPendingPush ? l : c;
          secondary = hasPendingPush ? c : l;
          secondaryTime = hasPendingPush ? cTime : lTime;
        }

        const mergedTasks = mergeTaskItemLists(primary.tasks || [], secondary.tasks || [], secondaryTime);
        const mergedWeekAudits =
          primary.outcomeAudits || secondary.outcomeAudits
            ? { ...(secondary.outcomeAudits || {}), ...(primary.outcomeAudits || {}) }
            : undefined;
        mergedWeeklyPlans[weekId] = {
          ...primary,
          focusTheme: primary.focusTheme?.trim() ? primary.focusTheme : secondary.focusTheme || '',
          notes: primary.notes?.trim() ? primary.notes : secondary.notes || '',
          winsNotes: primary.winsNotes?.trim() ? primary.winsNotes : secondary.winsNotes,
          courseCorrectionNotes: primary.courseCorrectionNotes?.trim()
            ? primary.courseCorrectionNotes
            : secondary.courseCorrectionNotes,
          reviewNotes: primary.reviewNotes?.trim() ? primary.reviewNotes : secondary.reviewNotes,
          prevPromiseVerdict: primary.prevPromiseVerdict || secondary.prevPromiseVerdict,
          prevPromiseNote: primary.prevPromiseNote?.trim()
            ? primary.prevPromiseNote
            : secondary.prevPromiseNote,
          alignmentVerdict: primary.alignmentVerdict || secondary.alignmentVerdict,
          alignmentNote: primary.alignmentNote?.trim()
            ? primary.alignmentNote
            : secondary.alignmentNote,
          ...(mergedWeekAudits ? { outcomeAudits: mergedWeekAudits } : {}),
          tasks: mergedTasks,
          achievedScore: computeWeeklyAchievedScore(mergedTasks)
        };
      }
    });

    // 3. Merge monthlyPlans, quarterlyPlans & yearlyPlans per periodKey (deep-merging tasks + scoreboard + notes)
    const mergeScoreboardLists = (
      primaryList: ScoreboardMetric[] | undefined,
      secondaryList: ScoreboardMetric[] | undefined,
      secondaryTime: number
    ): ScoreboardMetric[] => {
      const pList = Array.isArray(primaryList) ? primaryList : [];
      const sList = Array.isArray(secondaryList) ? secondaryList : [];
      const out = pList.map(item => ({ ...item }));
      const byId = new Map<string, number>();
      out.forEach((item, idx) => byId.set(item.id, idx));
      sList.forEach(sItem => {
        if (!sItem?.id) return;
        const idx = byId.get(sItem.id);
        if (idx !== undefined) {
          const cur = out[idx];
          out[idx] = {
            ...cur,
            name: cur.name?.trim() ? cur.name : sItem.name,
            domain: cur.domain?.trim() ? cur.domain : sItem.domain,
            startValue: cur.startValue?.trim() ? cur.startValue : sItem.startValue,
            targetValue: cur.targetValue?.trim() ? cur.targetValue : sItem.targetValue,
            actualValue: cur.actualValue?.trim() ? cur.actualValue : sItem.actualValue
          };
        } else {
          const delMs = Date.parse(mergedDeletedIds[sItem.id] || '') || 0;
          if (!(delMs > 0 && delMs >= secondaryTime)) {
            byId.set(sItem.id, out.length);
            out.push({ ...sItem });
            needsCloudPush = true;
          }
        }
      });
      return out;
    };

    const mergePeriodPlanMap = <T extends MonthlyPlan | QuarterlyPlan | YearlyPlan>(
      localMap: Record<string, T>,
      cloudMapRaw: any,
      normalizeFn: (k: string, p?: Partial<T>) => T
    ): Record<string, T> => {
      const merged: Record<string, T> = {};
      const cloudMap = (cloudMapRaw && typeof cloudMapRaw === 'object' ? cloudMapRaw : {}) as Record<string, T>;
      const allKeys = new Set([...Object.keys(localMap), ...Object.keys(cloudMap)]);
      const hasContent = (p?: T) => {
        if (!p) return false;
        const extraScore = 'scoreboard' in p && Array.isArray(p.scoreboard) && p.scoreboard.length > 0;
        const extraGates = 'targetGateRefs' in p && Array.isArray(p.targetGateRefs) && p.targetGateRefs.length > 0;
        const extraFocuses = Array.isArray(p.topFocuses) && p.topFocuses.some(f => f.trim().length > 0);
        return !!(p.tasks.length > 0 || p.focusTheme.trim().length > 0 || p.notes.trim().length > 0 || extraScore || extraGates || extraFocuses);
      };

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

          let primary: T;
          let secondary: T;
          let secondaryTime: number;
          if (lHasContent && !cHasContent) {
            if (cTime > lTime && c.updatedAt !== EMPTY_WEEK_TIMESTAMP && !hasPendingPush && cloudMs > localMs) {
              primary = c;
              secondary = l;
              secondaryTime = lTime;
            } else {
              primary = l;
              secondary = c;
              secondaryTime = cTime;
              needsCloudPush = true;
            }
          } else if (cHasContent && !lHasContent) {
            if (hasPendingPush && lTime > cTime && l.updatedAt !== EMPTY_WEEK_TIMESTAMP) {
              primary = l;
              secondary = c;
              secondaryTime = cTime;
              needsCloudPush = true;
            } else {
              primary = c;
              secondary = l;
              secondaryTime = lTime;
            }
          } else if (lTime > cTime) {
            primary = l;
            secondary = c;
            secondaryTime = cTime;
            needsCloudPush = true;
          } else if (cTime > lTime) {
            primary = c;
            secondary = l;
            secondaryTime = lTime;
          } else {
            primary = hasPendingPush ? l : c;
            secondary = hasPendingPush ? c : l;
            secondaryTime = hasPendingPush ? cTime : lTime;
          }

          // Slot-by-slot merge of topFocuses so concurrent focus edits on two devices never wipe each other
          const pFocuses = Array.isArray(primary.topFocuses) ? primary.topFocuses : [];
          const sFocuses = Array.isArray(secondary.topFocuses) ? secondary.topFocuses : [];
          const maxFocusSlots = Math.max(pFocuses.length, sFocuses.length);
          const mergedFocuses =
            maxFocusSlots > 0
              ? Array.from({ length: maxFocusSlots }, (_, i) =>
                  (pFocuses[i] || '').trim() ? pFocuses[i] : sFocuses[i] || ''
                )
              : undefined;
          const mergedBase: any = {
            ...primary,
            focusTheme: primary.focusTheme?.trim() ? primary.focusTheme : secondary.focusTheme || '',
            ...(mergedFocuses ? { topFocuses: mergedFocuses } : {}),
            notes: primary.notes?.trim() ? primary.notes : secondary.notes || '',
            tasks: mergeTaskItemLists(primary.tasks || [], secondary.tasks || [], secondaryTime)
          };
          if ('scoreboard' in primary || 'scoreboard' in secondary) {
            mergedBase.scoreboard = mergeScoreboardLists(
              (primary as QuarterlyPlan).scoreboard,
              (secondary as QuarterlyPlan).scoreboard,
              secondaryTime
            );
          }
          if ('targetGateRefs' in primary || 'targetGateRefs' in secondary) {
            const pGates = (primary as QuarterlyPlan).targetGateRefs || [];
            const sGates = (secondary as QuarterlyPlan).targetGateRefs || [];
            const gateSeen = new Set<string>();
            const unionGates: TargetGateRef[] = [];
            [...pGates, ...sGates].forEach(g => {
              const sig = `${g.planId}|${g.stageId}`;
              if (!gateSeen.has(sig)) {
                gateSeen.add(sig);
                unionGates.push(g);
              }
            });
            mergedBase.targetGateRefs = unionGates;
          }
          merged[k] = mergedBase as T;
        }
      });

      return merged;
    };

    const mergedMonthlyPlans = mergePeriodPlanMap(
      local.monthlyPlans,
      cloudState?.monthlyPlans,
      normalizeMonthlyPlanEntry
    );
    const mergedQuarterlyPlans = mergePeriodPlanMap(
      local.quarterlyPlans,
      cloudState?.quarterlyPlans,
      normalizeQuarterlyPlanEntry
    );
    const mergedYearlyPlans = mergePeriodPlanMap(
      local.yearlyPlans,
      cloudState?.yearlyPlans,
      normalizeYearlyPlanEntry
    );

    // 4. Per-item union merges for ALL collections (so Phone + Desktop edits NEVER wipe each other!)
    const mergedTemplates = mergeCollectionById<Template>(
      local.templates,
      cloudState?.templates,
      t => Date.parse(t.updatedAt || t.createdAt || '') || 0
    );

    const mergedGwsSessions = mergeCollectionById<GWSSession>(
      local.gwsSessions,
      cloudState?.gwsSessions,
      s => Date.parse(s.updatedAt || s.createdAt || '') || 0,
      (l, c) => {
        const lT = Date.parse(l.updatedAt || l.createdAt || '') || 0;
        const cT = Date.parse(c.updatedAt || c.createdAt || '') || 0;
        const primary = lT >= cT ? l : c;
        const secondary = lT >= cT ? c : l;
        return {
          ...primary,
          focusTag: primary.focusTag?.trim() ? primary.focusTag : secondary.focusTag,
          roadmapPlanId: primary.roadmapPlanId || secondary.roadmapPlanId,
          pillarId: primary.pillarId || secondary.pillarId,
          linkedWeeklyTaskId: primary.linkedWeeklyTaskId || secondary.linkedWeeklyTaskId,
          linkedSubTaskId: primary.linkedSubTaskId || secondary.linkedSubTaskId
        };
      }
    );

    const mergedStrategyPlans = mergeCollectionById<StrategyPlan>(
      local.strategyPlans,
      cloudState?.strategyPlans,
      p => Date.parse(p.updatedAt || p.createdAt || '') || 0,
      (l, c) => {
        const lT = Date.parse(l.updatedAt || l.createdAt || '') || 0;
        const cT = Date.parse(c.updatedAt || c.createdAt || '') || 0;
        const primary = lT >= cT ? l : c;
        const secondary = lT >= cT ? c : l;
        const secondaryTime = lT >= cT ? cT : lT;

        const mergedStages = (primary.stages || []).map(ps => {
          const match = (secondary.stages || []).find(ss => ss.id === ps.id);
          if (!match) return ps;
          const mergedGoals = [...(ps.proximalGoals || [])];
          const gIds = new Set(mergedGoals.map(g => g.id));
          (match.proximalGoals || []).forEach(sg => {
            const delMs = Date.parse(mergedDeletedIds[sg.id] || '') || 0;
            if (delMs > 0 && delMs >= secondaryTime) return;
            if (!gIds.has(sg.id)) {
              mergedGoals.push(sg);
              gIds.add(sg.id);
              needsCloudPush = true;
            }
          });
          return {
            ...ps,
            proximalGoals: mergedGoals,
            whatItLooksLike: ps.whatItLooksLike?.trim() ? ps.whatItLooksLike : match.whatItLooksLike || '',
            notPossibleUntil: ps.notPossibleUntil?.trim() ? ps.notPossibleUntil : match.notPossibleUntil || '',
            dayInALife: ps.dayInALife?.trim() ? ps.dayInALife : match.dayInALife || '',
            gateCriterion: ps.gateCriterion?.trim() ? ps.gateCriterion : match.gateCriterion || ''
          };
        });
        const stageIds = new Set(mergedStages.map(s => s.id));
        (secondary.stages || []).forEach(ss => {
          const delMs = Date.parse(mergedDeletedIds[ss.id] || '') || 0;
          if (delMs > 0 && delMs >= secondaryTime) return;
          if (!stageIds.has(ss.id)) {
            mergedStages.push(ss);
            stageIds.add(ss.id);
            needsCloudPush = true;
          }
        });
        const pivotMap = new Map<string, { id: string; date: string; tag: any; note: string }>();
        [...(primary.pivotHistory || []), ...(secondary.pivotHistory || [])].forEach(ev => {
          if (ev?.id && !pivotMap.has(ev.id)) pivotMap.set(ev.id, ev);
        });
        const mergedPivotHistory = Array.from(pivotMap.values()).sort((a, b) =>
          (b.date || '').localeCompare(a.date || '')
        );
        return {
          ...primary,
          description: primary.description !== undefined ? primary.description : secondary.description || '',
          activationCondition:
            primary.activationCondition !== undefined
              ? primary.activationCondition
              : secondary.activationCondition || '',
          priority: primary.priority !== undefined ? primary.priority : secondary.priority,
          status: primary.status || secondary.status,
          ...(mergedPivotHistory.length > 0 ? { pivotHistory: mergedPivotHistory } : {}),
          stages: mergedStages
        };
      }
    );

    const mergedProblems = mergeCollectionById<ProblemEntry>(
      local.problems,
      cloudState?.problems,
      p => Date.parse(p.updatedAt || p.createdAt || '') || 0,
      (l, c) => {
        const lT = Date.parse(l.updatedAt || l.createdAt || '') || 0;
        const cT = Date.parse(c.updatedAt || c.createdAt || '') || 0;
        const primary = lT >= cT ? l : c;
        const secondary = lT >= cT ? c : l;
        const lPruned = Date.parse(l.prunedAt || '') || 0;
        const cPruned = Date.parse(c.prunedAt || '') || 0;
        const mergedPrunedAt = lPruned >= cPruned ? l.prunedAt : c.prunedAt;
        const primaryPrunedAt = Date.parse(primary.prunedAt || '') || 0;
        const secondaryUpdatedAt = Date.parse(secondary.updatedAt || secondary.createdAt || '') || 0;
        const trustPrimaryLists = primaryPrunedAt > secondaryUpdatedAt;

        // Union occurrences (deduped by date|sourceType|sourceRef), unless primary explicitly pruned sub-entries more recently
        let mergedOccurrences: ProblemOccurrence[];
        if (trustPrimaryLists) {
          mergedOccurrences = [...(primary.occurrences || [])];
        } else {
          const occSeen = new Set<string>();
          mergedOccurrences = [];
          [...(c.occurrences || []), ...(l.occurrences || [])].forEach(occ => {
            const sig = `${occ.date}|${occ.sourceType}|${occ.sourceRef || ''}|${occ.note || ''}`;
            if (!occSeen.has(sig)) {
              occSeen.add(sig);
              mergedOccurrences.push(occ);
            }
          });
        }

        const mergedTags = Array.from(new Set([...(primary.tags || []), ...(secondary.tags || [])]));
        const mergedDispatched = Array.from(
          new Set([...(primary.dispatchedTo || []), ...(secondary.dispatchedTo || [])])
        );

        let mergedAttempts: ProblemFixAttempt[];
        if (trustPrimaryLists) {
          mergedAttempts = [...(primary.fixAttempts || [])];
        } else {
          const attSeen = new Set<string>();
          mergedAttempts = [];
          [...(secondary.fixAttempts || []), ...(primary.fixAttempts || [])].forEach(att => {
            if (!att?.id || attSeen.has(att.id)) return;
            attSeen.add(att.id);
            mergedAttempts.push(att);
          });
        }
        mergedAttempts.sort((a, b) => (a.endedAt || a.startedAt).localeCompare(b.endedAt || b.startedAt));

        const mergedHeldDates = trustPrimaryLists
          ? [...(primary.heldDates || [])].sort()
          : Array.from(new Set([...(secondary.heldDates || []), ...(primary.heldDates || [])])).sort();
        const latestHeld =
          mergedHeldDates[mergedHeldDates.length - 1] ||
          (trustPrimaryLists ? primary.lastHeldDate : primary.lastHeldDate || secondary.lastHeldDate);

        let mergedCheckIns: ProblemCheckIn[];
        if (trustPrimaryLists) {
          mergedCheckIns = [...(primary.checkIns || [])].sort((a, b) => a.date.localeCompare(b.date));
        } else {
          const checkInByDate = new Map<string, ProblemCheckIn>();
          const mergeCheckIn = (incoming: ProblemCheckIn) => {
            if (!incoming?.date) return;
            const prevC = checkInByDate.get(incoming.date);
            if (!prevC) {
              checkInByDate.set(incoming.date, incoming);
            } else {
              const mergedTweakNote = incoming.tweakNote?.trim() || prevC.tweakNote?.trim();
              const mergedTweakApplied = Boolean(incoming.tweakApplied || prevC.tweakApplied);
              checkInByDate.set(incoming.date, {
                ...prevC,
                ...incoming,
                ...(mergedTweakNote ? { tweakNote: mergedTweakNote } : {}),
                ...(mergedTweakApplied ? { tweakApplied: true } : {})
              });
            }
          };
          (secondary.checkIns || []).forEach(mergeCheckIn);
          (primary.checkIns || []).forEach(mergeCheckIn);
          mergedCheckIns = Array.from(checkInByDate.values()).sort((a, b) =>
            a.date.localeCompare(b.date)
          );
        }

        const resolvedLastFailed = trustPrimaryLists
          ? primary.lastFixFailedAt
          : primary.lastFixFailedAt || secondary.lastFixFailedAt;

        const merged: ProblemEntry = {
          ...primary,
          ...(primary.classified !== undefined || secondary.classified !== undefined
            ? { classified: primary.classified ?? secondary.classified }
            : {}),
          ...(primary.watching !== undefined || secondary.watching !== undefined
            ? { watching: primary.watching ?? secondary.watching }
            : {}),
          ...(primary.watchQuestion?.trim() || secondary.watchQuestion?.trim()
            ? {
                watchQuestion: primary.watchQuestion?.trim()
                  ? primary.watchQuestion
                  : secondary.watchQuestion
              }
            : {}),
          ...(primary.promptNoteOnHit !== undefined || secondary.promptNoteOnHit !== undefined
            ? { promptNoteOnHit: primary.promptNoteOnHit ?? secondary.promptNoteOnHit }
            : {}),
          severity: primary.severity ?? secondary.severity,
          roadmapPlanId: primary.roadmapPlanId || secondary.roadmapPlanId,
          trigger: primary.trigger?.trim() ? primary.trigger : secondary.trigger,
          rootCause: primary.rootCause?.trim() ? primary.rootCause : secondary.rootCause,
          reminderText: primary.reminderText?.trim() ? primary.reminderText : secondary.reminderText,
          fixNote: primary.fixNote?.trim() ? primary.fixNote : secondary.fixNote,
          fixStartedAt: primary.fixStartedAt || secondary.fixStartedAt,
          fixTaskCompletedAt: primary.fixTaskCompletedAt || secondary.fixTaskCompletedAt,
          verifyDays: primary.verifyDays ?? secondary.verifyDays,
          verifyTarget: primary.verifyTarget ?? secondary.verifyTarget,
          occurrences: mergedOccurrences,
          tags: mergedTags,
          ...(mergedPrunedAt ? { prunedAt: mergedPrunedAt } : {})
        };

        if (resolvedLastFailed) merged.lastFixFailedAt = resolvedLastFailed;
        else delete merged.lastFixFailedAt;

        if (mergedCheckIns.length > 0) merged.checkIns = mergedCheckIns;
        else delete merged.checkIns;

        if (mergedHeldDates.length > 0) merged.heldDates = mergedHeldDates;
        else delete merged.heldDates;

        if (latestHeld) merged.lastHeldDate = latestHeld;
        else delete merged.lastHeldDate;

        if (mergedAttempts.length > 0) merged.fixAttempts = mergedAttempts;
        else delete merged.fixAttempts;

        if (mergedDispatched.length > 0) merged.dispatchedTo = mergedDispatched;
        else delete merged.dispatchedTo;

        return merged;
      }
    );

    const mergedReviews = mergeCollectionById<ReviewEntry>(
      local.reviews,
      cloudState?.reviews,
      r => Date.parse(r.updatedAt || r.createdAt || '') || 0,
      (l, c) => {
        const lT = Date.parse(l.updatedAt || l.createdAt || '') || 0;
        const cT = Date.parse(c.updatedAt || c.createdAt || '') || 0;
        const primary = lT >= cT ? l : c;
        const secondary = lT >= cT ? c : l;
        return {
          ...primary,
          headline: primary.headline?.trim() ? primary.headline : secondary.headline,
          score: (primary.score || 0) > 0 ? primary.score : secondary.score,
          wins: primary.wins?.trim() ? primary.wins : secondary.wins || '',
          blockers: primary.blockers?.trim() ? primary.blockers : secondary.blockers || '',
          courseCorrections: primary.courseCorrections?.trim()
            ? primary.courseCorrections
            : secondary.courseCorrections || '',
          prevPromiseVerdict: primary.prevPromiseVerdict || secondary.prevPromiseVerdict,
          prevPromiseNote: primary.prevPromiseNote?.trim()
            ? primary.prevPromiseNote
            : secondary.prevPromiseNote,
          alignmentVerdict: primary.alignmentVerdict || secondary.alignmentVerdict,
          alignmentNote: primary.alignmentNote?.trim()
            ? primary.alignmentNote
            : secondary.alignmentNote,
          effortVsOutcomeNote: primary.effortVsOutcomeNote?.trim()
            ? primary.effortVsOutcomeNote
            : secondary.effortVsOutcomeNote,
          assumptionsDisproved: primary.assumptionsDisproved?.trim()
            ? primary.assumptionsDisproved
            : secondary.assumptionsDisproved,
          energyAndMountainNote: primary.energyAndMountainNote?.trim()
            ? primary.energyAndMountainNote
            : secondary.energyAndMountainNote,
          outcomeAudits:
            primary.outcomeAudits || secondary.outcomeAudits
              ? { ...(secondary.outcomeAudits || {}), ...(primary.outcomeAudits || {}) }
              : undefined,
          roadmapAudits:
            primary.roadmapAudits || secondary.roadmapAudits
              ? { ...(secondary.roadmapAudits || {}), ...(primary.roadmapAudits || {}) }
              : undefined,
          pillarAudits:
            primary.pillarAudits || secondary.pillarAudits
              ? { ...(secondary.pillarAudits || {}), ...(primary.pillarAudits || {}) }
              : undefined,
          customAnswers:
            primary.customAnswers || secondary.customAnswers
              ? { ...(secondary.customAnswers || {}), ...(primary.customAnswers || {}) }
              : undefined
        };
      }
    );

    const mergedChecklistCategories = mergeCollectionById<ChecklistCategory>(
      local.checklistCategories,
      cloudState?.checklistCategories,
      () => (localIsNewer ? localMs : cloudMs)
    );

    const realToday = getTodayDateString();
    const mergedChecklistItems = mergeCollectionById<ChecklistItem>(
      local.checklistItems,
      cloudState?.checklistItems,
      i => Date.parse(i.createdAt || '') || 0,
      (l, c) => {
        const primary = localIsNewer ? l : c;
        const secondary = localIsNewer ? c : l;
        // Union completedPeriods across different dates while letting the newer device control today's toggle
        const periodSet = new Set<string>([
          ...(primary.completedPeriods || []),
          ...(secondary.completedPeriods || []).filter(p => p !== realToday)
        ]);
        const mergedTotal =
          primary.recurrence === 'tally'
            ? Math.max(l.totalCount || 0, c.totalCount || 0)
            : primary.totalCount;
        return {
          ...primary,
          ...(primary.sourceDailyDate || secondary.sourceDailyDate
            ? { sourceDailyDate: primary.sourceDailyDate || secondary.sourceDailyDate }
            : {}),
          ...(primary.problemId || secondary.problemId
            ? { problemId: primary.problemId || secondary.problemId }
            : {}),
          completedPeriods: Array.from(periodSet),
          ...(mergedTotal !== undefined ? { totalCount: mergedTotal } : {})
        };
      }
    );

    const currentWeekKeyForMerge = selectedWeekIdRef.current;
    const currentMonthKeyForMerge = realToday.slice(0, 7);
    const mergedAllowanceItems = mergeCollectionById<AllowanceItem>(
      local.allowanceItems,
      cloudState?.allowanceItems,
      a => Date.parse(a.updatedAt || a.createdAt || '') || 0,
      (l, c) => {
        const lT = Date.parse(l.updatedAt || l.createdAt || '') || 0;
        const cT = Date.parse(c.updatedAt || c.createdAt || '') || 0;
        const primary = lT >= cT ? l : c;
        const secondary = lT >= cT ? c : l;
        const activePeriodKey =
          primary.period === 'daily'
            ? realToday
            : primary.period === 'weekly'
            ? currentWeekKeyForMerge
            : currentMonthKeyForMerge;
        const mergedUsage: Record<string, number> = { ...(secondary.usageByPeriod || {}) };
        Object.entries(primary.usageByPeriod || {}).forEach(([pk, val]) => {
          if (pk === activePeriodKey) {
            mergedUsage[pk] = val;
          } else {
            mergedUsage[pk] = Math.max(mergedUsage[pk] || 0, val || 0);
          }
        });
        return {
          ...primary,
          usageByPeriod: mergedUsage
        };
      }
    );

    const mergedPlaybookItems = mergeCollectionById<PlaybookEntry>(
      local.playbookItems,
      cloudState?.playbookItems,
      p => Date.parse(p.updatedAt || p.createdAt || '') || 0
    );

    const mergedLifePillars = mergeCollectionById<LifePillar>(
      local.lifePillars,
      cloudState?.lifePillars,
      () => (localIsNewer ? localMs : cloudMs)
    );

    const mergedCustomReviewPrompts = mergeCollectionById<CustomReviewPrompt>(
      local.customReviewPrompts,
      cloudState?.customReviewPrompts,
      () => (localIsNewer ? localMs : cloudMs)
    );

    const primaryMacroSettings =
      localIsNewer || !cloudState?.macroReviewSettings
        ? local.macroReviewSettings || {}
        : cloudState.macroReviewSettings || {};
    const secondaryMacroSettings =
      localIsNewer || !cloudState?.macroReviewSettings
        ? cloudState?.macroReviewSettings || {}
        : local.macroReviewSettings || {};
    const mergedMacroReviewSettings: MacroReviewSettings = {
      hiddenStages: {
        quarterly: primaryMacroSettings.hiddenStages?.quarterly ?? secondaryMacroSettings.hiddenStages?.quarterly,
        yearly: primaryMacroSettings.hiddenStages?.yearly ?? secondaryMacroSettings.hiddenStages?.yearly
      },
      customPromptLabels: {
        ...(secondaryMacroSettings.customPromptLabels || {}),
        ...(primaryMacroSettings.customPromptLabels || {})
      }
    };

    const mergedProblemCategories = mergeCollectionById<CustomProblemCategory>(
      local.problemCategories,
      cloudState?.problemCategories,
      () => (localIsNewer ? localMs : cloudMs)
    );

    const mergedProblemSettings: ProblemSettings = {
      ...DEFAULT_PROBLEM_SETTINGS,
      ...(localIsNewer ? cloudState?.problemSettings || {} : local.problemSettings || {}),
      ...(localIsNewer ? local.problemSettings || {} : cloudState?.problemSettings || {})
    };

    const onboardingStartDate =
      mergedWeeklyPlans['week_1']?.startDate ||
      cloudState?.onboardingStartDate ||
      local.onboardingStartDate;

    const mergedState = {
      onboardingStartDate,
      templates: mergedTemplates,
      dailyEntries: mergedDailyEntries,
      gwsSessions: mergedGwsSessions,
      weeklyPlans: mergedWeeklyPlans,
      monthlyPlans: mergedMonthlyPlans,
      quarterlyPlans: mergedQuarterlyPlans,
      yearlyPlans: mergedYearlyPlans,
      lifePillars: mergedLifePillars,
      customReviewPrompts: mergedCustomReviewPrompts,
      macroReviewSettings: mergedMacroReviewSettings,
      problemCategories: mergedProblemCategories.length > 0 ? mergedProblemCategories : INITIAL_PROBLEM_CATEGORIES,
      problemSettings: mergedProblemSettings,
      strategyPlans: mergedStrategyPlans,
      problems: mergedProblems,
      reviews: mergedReviews,
      checklistCategories: mergedChecklistCategories,
      checklistItems: mergedChecklistItems,
      allowanceItems: mergedAllowanceItems,
      playbookItems: mergedPlaybookItems,
      deletedIds: mergedDeletedIds,
      systemLevel:
        localIsNewer || typeof cloudState?.systemLevel !== 'number'
          ? local.systemLevel
          : cloudState.systemLevel,
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
    if (isPullingRef.current && !options?.initialPayloadOverride) return;
    isPullingRef.current = true;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      let prevCloudUserId: string | null = null;
      let hasPendingLocalPush = false;
      try {
        prevCloudUserId = localStorage.getItem(LAST_CLOUD_USER_ID_KEY);
        hasPendingLocalPush = localStorage.getItem(PENDING_CLOUD_PUSH_KEY) === 'true';
      } catch {
        // ignore
      }
      const sameUserCache = prevCloudUserId === userId;

      // Lightweight 60-byte head check before downloading the full JSONB state blob:
      // On normal page reloads when cloud updated_at already matches our local cache and no local push is pending,
      // skip downloading the full database blob + full merge + snapshot + 21-slice overwrite completely!
      if (
        !options?.initialPayloadOverride &&
        !options?.preferCloudDirectly &&
        sameUserCache &&
        !hasPendingLocalPush &&
        !queuedPushRef.current &&
        lastSyncedCloudUpdatedAtRef.current
      ) {
        const { data: headRow, error: headError } = await supabase
          .from('legio_user_state')
          .select('updated_at')
          .eq('user_id', userId)
          .maybeSingle();

        if (headError) {
          setSyncStatus('error');
          setSyncError(headError.message);
          return;
        }
        if (headRow?.updated_at && headRow.updated_at === lastSyncedCloudUpdatedAtRef.current) {
          hasCompletedInitialCloudSyncRef.current = true;
          setSyncStatus('synced');
          return;
        }
      }

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
        applyCloudPayload(options.initialPayloadOverride, { snapshotReason: 'Before new account setup' });
        hasCompletedInitialCloudSyncRef.current = true;
        await flushCloudPushNow({ skipPrePullCheck: true });
        return;
      }

      if (data && data.state) {
        // Secondary fast-path guard if full fetch returned an unchanged timestamp
        if (
          !options?.preferCloudDirectly &&
          sameUserCache &&
          !hasPendingLocalPush &&
          !queuedPushRef.current &&
          data.updated_at &&
          data.updated_at === lastSyncedCloudUpdatedAtRef.current
        ) {
          hasCompletedInitialCloudSyncRef.current = true;
          setSyncStatus('synced');
          return;
        }

        setLastSyncedCloudUpdatedAt(data.updated_at || null);
        if (options?.preferCloudDirectly) {
          applyCloudPayload(data.state, { snapshotReason: 'Before sign-in cloud load' });
          hasCompletedInitialCloudSyncRef.current = true;
          try {
            localStorage.setItem(PENDING_CLOUD_PUSH_KEY, 'false');
          } catch {
            // ignore
          }
          setSyncStatus('synced');
        } else {
          const { mergedState, needsCloudPush } = mergeLocalAndCloudState(data.state, data.updated_at);
          applyCloudPayload(mergedState, { snapshotReason: 'Before cloud merge' });
          hasCompletedInitialCloudSyncRef.current = true;
          if (needsCloudPush || queuedPushRef.current) {
            queuedPushRef.current = false;
            await flushCloudPushNow({ skipPrePullCheck: true });
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
        hasCompletedInitialCloudSyncRef.current = true;
        await flushCloudPushNow({ skipPrePullCheck: true });
      }
    } catch (err: any) {
      setSyncStatus('error');
      setSyncError(err?.message || 'Unable to reach Supabase');
    } finally {
      isPullingRef.current = false;
    }
  };

  // Keep synchronous bridge ref up to date for pull-before-push & resume-sync handlers
  syncHelpersRef.current = {
    applyCloudPayload,
    mergeLocalAndCloudState,
    loadUserCloudState
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
          // If local storage was cleared/evicted (!prevCloudUser) or belongs to a different account,
          // ALWAYS prefer authoritative cloud data instead of merging sample defaults into the cloud!
          const shouldPreferCloudDirectly = !prevCloudUser || (prevCloudUser !== u.id && cachedId !== u.id);

          setAuthUser({
            id: u.id,
            email: u.email || '',
            displayName: u.user_metadata?.display_name
          });
          void loadUserCloudState(u.id, { preferCloudDirectly: shouldPreferCloudDirectly });
        } else if (authUserRef.current) {
          // Cached remember-device profile existed, but the Supabase session actually expired — notify clearly!
          accessTokenRef.current = null;
          hasCompletedInitialCloudSyncRef.current = false;
          setAuthUser(null);
          setSyncStatus('error');
          setSyncError('Session expired — sign in again so your changes sync to cloud.');
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
      try {
        prevCloudUser = localStorage.getItem(LAST_CLOUD_USER_ID_KEY);
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
        // If signing in on a new/unlinked device (or switching accounts), ALWAYS load cloud account directly
        // so guest/sample data on a phone can never contaminate or overwrite the real account!
        const shouldPreferCloudDirectly = !prevCloudUser || prevCloudUser !== data.user.id;
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
    if (hasCompletedInitialCloudSyncRef.current) {
      await flushCloudPushNow();
    }
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    hasCompletedInitialCloudSyncRef.current = false;
    setLastSyncedCloudUpdatedAt(null);
    commitDeletedIds({});
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

  // Idempotent retroactive backfill: capture existing unfinished standalone Daily Mission items
  // (not on Weekly Plan or Roadmap, not already completed on a later day, and not dismissed in deletedIds)
  // into Checklist -> One-Off Tasks and bind their checklistItemId so they are remembered until done or dismissed.
  useEffect(() => {
    const runBackfill = () => {
      if (isPullingRef.current) return;
      if (authUserRef.current && !hasCompletedInitialCloudSyncRef.current) return;

      const curDaily = dailyEntriesRef.current;
      const curChecklist = checklistItemsRef.current;
      const curWeekly = weeklyPlansRef.current;
      const curRoadmaps = strategyPlansRef.current;
      const curDeleted = deletedIdsRef.current;
      const fallbackWeek = selectedWeekIdRef.current;

      const completedStandaloneTexts = new Set<string>();
      Object.values(curDaily).forEach(entry => {
        getPriorityItemsForEntry(entry).forEach(item => {
          if (item.completed && item.text.trim().length >= 2) {
            completedStandaloneTexts.add(item.text.trim().toLowerCase());
          }
        });
      });

      const checklistByNorm = new Map<string, ChecklistItem>();
      curChecklist.forEach(c => {
        const norm = c.text.trim().toLowerCase();
        if (norm && !checklistByNorm.has(norm)) {
          checklistByNorm.set(norm, c);
        }
      });

      const newOneOffs: ChecklistItem[] = [];
      let nextDaily: Record<string, DailyEntry> | null = null;

      const sortedDates = Object.keys(curDaily).sort((a, b) => a.localeCompare(b));
      sortedDates.forEach(date => {
        const entry = curDaily[date];
        if (!entry) return;
        const items = getPriorityItemsForEntry(entry);
        if (items.length === 0) return;

        let entryChanged = false;
        const updatedItems = items.map(item => {
          if (item.completed || item.weeklyTaskId || item.subTaskId || item.checklistItemId) {
            return item;
          }
          const trimmed = item.text.trim();
          const norm = trimmed.toLowerCase();
          if (trimmed.length < 2) return item;
          if (completedStandaloneTexts.has(norm)) return item;
          if (isTextLinkedToWeeklyOrRoadmap(norm, date, curWeekly, curRoadmaps, fallbackWeek)) {
            return item;
          }

          const derivedId = `chk_day_${date}_${item.id}`;
          if (curDeleted[derivedId]) return item;

          const existing = checklistByNorm.get(norm);
          if (existing) {
            entryChanged = true;
            return { ...item, checklistItemId: existing.id };
          }

          const created: ChecklistItem = {
            id: derivedId,
            categoryId: 'cat_oneoff',
            text: trimmed,
            recurrence: 'none',
            completed: false,
            completedPeriods: [],
            createdAt: date,
            sourceDailyDate: date
          };
          newOneOffs.push(created);
          checklistByNorm.set(norm, created);
          entryChanged = true;
          return { ...item, checklistItemId: derivedId };
        });

        if (entryChanged) {
          if (!nextDaily) nextDaily = { ...curDaily };
          nextDaily[date] = {
            ...entry,
            priorityItems: updatedItems,
            updatedAt: new Date().toISOString()
          };
        }
      });

      if (newOneOffs.length > 0) {
        commitChecklistItems([...curChecklist, ...newOneOffs]);
      }
      if (nextDaily) {
        commitDailyEntries(nextDaily);
      }
      if (newOneOffs.length > 0 || nextDaily) {
        markLocalMutation();
      }
    };

    if (authUser && syncStatus === 'synced' && hasCompletedInitialCloudSyncRef.current) {
      runBackfill();
      return;
    }
    if (!authUser) {
      const timer = setTimeout(runBackfill, getSupabaseClient() ? 900 : 0);
      return () => clearTimeout(timer);
    }
  }, [authUser?.id, syncStatus]);

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
            quarterlyPlans: raw.quarterlyPlans,
            yearlyPlans: raw.yearlyPlans,
            lifePillars: raw.lifePillars,
            customReviewPrompts: raw.customReviewPrompts,
            macroReviewSettings: raw.macroReviewSettings,
            problemCategories: raw.problemCategories,
            problemSettings: raw.problemSettings,
            strategyPlans: raw.strategyPlans,
            problems: raw.problems,
            reviews: raw.reviews,
            checklistCategories: raw.checklistCategories,
            checklistItems: raw.checklistItems,
            allowanceItems: raw.allowanceItems,
            playbookItems: raw.playbookItems,
            deletedIds: raw.deletedIds,
            schemaVersion: raw.schemaVersion || 2,
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

  const contextValue = useMemo<StorageContextType>(
    () => ({
      templates,
      dailyEntries,
      gwsSessions,
      weeklyPlans,
      monthlyPlans,
      quarterlyPlans,
      yearlyPlans,
      lifePillars,
      customReviewPrompts,
      macroReviewSettings,
      problemCategories,
      problemSettings,
      strategyPlans,
      problems,
      reviews,
      checklistCategories,
      checklistItems,
      allowanceItems,
      playbookItems,
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
      getQuarterlyPlan,
      saveQuarterlyPlan,
      getYearlyPlan,
      saveYearlyPlan,
      saveLifePillars,
      saveCustomReviewPrompts,
      saveMacroReviewSettings,
      saveProblemCategories,
      saveProblemSettings,
      saveStrategyPlan,
      deleteStrategyPlan,
      addProblem,
      updateProblem,
      recordProblemRecurrence,
      recordProblemHeld,
      recordProblemCheckIn,
      noteProblemTweak,
      reviseProblemSolution,
      clusterIntoNewParent,
      deleteProblem,
      deleteProblemOccurrence,
      deleteProblemCheckIn,
      deleteProblemFixAttempt,
      dispatchProblemFix,
      saveTemplate,
      deleteTemplate,
      resetTemplatesToDefault,
      saveReview,
      deleteReview,
      saveChecklistCategories,
      saveChecklistItems,
      saveAllowanceItems,
      addPlaybookItem,
      updatePlaybookItem,
      deletePlaybookItem,
      localSnapshots,
      restoreLocalSnapshot,
      exportData,
      importData,
      resetAllData
    }),
    [
      templates,
      dailyEntries,
      gwsSessions,
      weeklyPlans,
      monthlyPlans,
      quarterlyPlans,
      yearlyPlans,
      lifePillars,
      customReviewPrompts,
      macroReviewSettings,
      problemCategories,
      problemSettings,
      strategyPlans,
      problems,
      reviews,
      checklistCategories,
      checklistItems,
      allowanceItems,
      playbookItems,
      todayDate,
      selectedDate,
      selectedWeekId,
      activeTab,
      planningSubTab,
      reviewSubTab,
      systemLevel,
      missingPlanAlerts,
      browserNotificationsEnabled,
      authUser,
      isAdmin,
      rememberDevice,
      syncStatus,
      syncError,
      activeGwsTimer,
      localSnapshots
    ]
  );

  return (
    <StorageContext.Provider value={contextValue}>
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
