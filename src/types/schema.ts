export type FieldType = 
  | 'rating_5'         // 1-5 score (Focus, Execution, Output)
  | 'rating_10'        // 1-10 execution score
  | 'text'             // Short string
  | 'textarea'         // Multiline reflexion or notes
  | 'numbered_list'    // Numbered 1, 2, 3 discrete priority items
  | 'duration'         // Planned vs Actual minutes
  | 'checkbox'         // Single toggle (Automatic tasks done?)
  | 'checklist'        // List of checkable tasks with status
  | 'score_target'     // Target score vs achieved (e.g. 3/3)
  | 'reward_ladder'    // Tiered rewards table
  | 'gws_session_link' // Interactive GWS session list for the day
  | 'task_points_table'; // Table with task + assigned score summing to target

export type CardWidth = 'col-span-12' | 'col-span-6' | 'col-span-4' | 'col-span-8' | 'col-span-3';
export type CardShape = 'standard' | 'compact' | 'highlight' | 'minimal' | 'bordered';

export interface TemplateField {
  id: string;
  label: string;
  description?: string;
  type: FieldType;
  width: CardWidth;
  shape: CardShape;
  required?: boolean;
  hidden?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  options?: string[]; // For checklists or predefined selections
  defaultValue?: any;
}

export type SystemLevel = 1 | 2 | 3 | 4 | 5;

export type TemplateCategory = 'daily' | 'gws' | 'weekly' | 'review' | 'custom';

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  isDefault?: boolean;
  columns: 1 | 2 | 3 | 4; // Overall container layout
  fields: TemplateField[];
  createdAt: string;
  updatedAt: string;
}

export interface SubTaskItem {
  id: string;
  text: string;
  completed: boolean;
}

export type ParkReasonTag = 'reality_shift' | 'disproved' | 'deferred';

export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  score?: number; // Weight in points (for weekly goal crusher)
  notes?: string;
  subTasks?: SubTaskItem[];
  kpiTarget?: string; // Optional measurable proof check ("What proves this is done?")
  kpiActual?: string; // Optional actual result verified at review time (never tracked daily)
  status?: 'active' | 'parked'; // Lightweight fluid-reality pause (does not delete or fail)
  parkedReasonTag?: ParkReasonTag; // Why it was parked (prevents disguised quitting & forgotten dead loops)
  parkedReasonNote?: string; // Optional 1-line memory for future-you
  parkedAt?: string; // YYYY-MM-DD when parked
  parentLinkMode?: 'step' | 'mirror'; // 'step' rolls up progress without auto-closing parent; 'mirror' syncs completion 1:1
  monthlyTaskId?: string;
  quarterlyTaskId?: string;
  yearlyTaskId?: string;
  strategyPlanId?: string;
  strategyStageId?: string;
  strategyGoalId?: string;
  sourceLabel?: string;
}

export interface ActiveGWSTimer {
  taskName: string;
  linkedPriorityId: string | null;
  plannedMinutes: number;
  startedAt: number | null; // Epoch ms while actively running; null while paused
  accumulatedSeconds: number;
  focusTag?: string; // Optional Top Focus label or custom focus tag
  roadmapPlanId?: string; // Optional linked StrategyPlan ID
  pillarId?: string; // Optional linked LifePillar ID
}

export interface RewardTier {
  id: string;
  minScore: number;
  reward: string;
}

export interface GWSSession {
  id: string;
  date: string; // YYYY-MM-DD
  taskName: string;
  plannedMinutes: number;
  actualMinutes: number;
  focusTag?: string; // Optional Top Focus label (from Monthly/Quarterly Top 3 Focuses)
  roadmapPlanId?: string; // Optional linked Strategy Roadmap ID
  pillarId?: string; // Optional linked Life Pillar ID
  ratings: {
    focus: number;     // 1-5
    execution: number; // 1-5
    output: number;    // 1-5
    total: number;     // /15
  };
  reflexions: {
    accomplished: string; // 1. What did I accomplish?
    heldBack: string;     // 2. What held me back?
    improveNext: string;  // 3. What will I improve next session?
  };
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

export interface DailyPriorityItem {
  id: string;
  text: string;
  completed: boolean;
  weeklyTaskId?: string;
  subTaskId?: string;
  checklistItemId?: string;
}

export type NervousSystemState = 'calm' | 'sharp' | 'wired' | 'foggy' | 'drained';
export type AlignmentVerdict = 'on_plan' | 'better_pivot' | 'mixed' | 'unwise_drift';

export interface DailyEnergyCheck {
  wakeUp?: number; // 1–10 energy at wake-up
  midday?: number; // 1–10 energy during the day
  night?: number;  // 1–10 energy at night
  nervousSystemScore?: number; // 1–10 (10 = grounded/regulated, <6 = warning)
  nervousSystemState?: NervousSystemState;
  nervousSystemNote?: string; // Optional brief note on how body/nervous system feels
}

export interface DailyEntry {
  date: string; // YYYY-MM-DD
  templateId: string;
  mainTasksCompleted: number;
  mainTasksTotal: number;
  executionScore: number; // e.g. 6 out of 10
  automaticTasksCompleted: boolean;
  automaticTaskList?: TaskItem[];
  planNotes: string; // e.g. Day priorities
  priorityItems?: DailyPriorityItem[];
  gwsSessionIds: string[];
  problemsEncountered?: string;
  reviewNotes?: string;
  energyCheck?: DailyEnergyCheck;
  alignmentVerdict?: AlignmentVerdict;
  alignmentNote?: string;
  customFieldValues: Record<string, any>;
  updatedAt: string;
}

export interface WeeklyPlan {
  id: string;
  weekNumber: number; // e.g. 1 or 3
  startDate: string; // YYYY-MM-DD
  endDate: string;
  focusTheme: string; // e.g. "systems launched"
  notes: string;
  tasks: TaskItem[]; // 5-10 tasks with scores totaling 10
  totalPossibleScore: number; // 10
  achievedScore: number;
  rewards: RewardTier[]; // 6+, 7+, 8+, 9+, 10
  winsNotes?: string;
  problemsEncountered?: string;
  courseCorrectionNotes?: string;
  reviewNotes?: string;
  prevPromiseVerdict?: PromiseVerdict;
  prevPromiseNote?: string;
  alignmentVerdict?: AlignmentVerdict;
  alignmentNote?: string;
  outcomeAudits?: Record<string, OutcomeAuditEntry>;
  updatedAt: string;
}

export interface ScoreboardMetric {
  id: string;
  name: string;        // e.g. "Monthly Revenue", "Trading Rule Adherence"
  domain?: string;     // Optional domain/roadmap label e.g. "Trading", "Business", "Health"
  startValue: string;  // Day-1 baseline e.g. "$0", "65%"
  targetValue: string; // Target e.g. "$3,000", "95%"
  actualValue: string; // Actual end-of-period result
}

export interface TargetGateRef {
  planId: string;
  stageId: string;
}

export interface LifePillar {
  id: string;
  name: string;
  description?: string;
}

export interface CustomReviewPrompt {
  id: string;
  scope: 'quarterly' | 'yearly';
  title: string;
  placeholder?: string;
}

export interface MacroReviewSettings {
  hiddenStages?: {
    quarterly?: number[];
    yearly?: number[];
  };
  customPromptLabels?: Record<string, string>; // key e.g. "quarterly:effortVsOutcome" -> custom label
}

export type OutcomeVerdict = 'hit' | 'partial' | 'missed' | 'dropped';
export type OutcomeRootCause = 'execution' | 'strategy' | 'scope' | 'shifted';
export type RoadmapVerdict = 'push_gate' | 'redesign' | 'maintain' | 'pause';
export type PromiseVerdict = 'executed' | 'partial' | 'repeated';

export interface OutcomeAuditEntry {
  verdict?: OutcomeVerdict;
  rootCause?: OutcomeRootCause;
  note?: string;
}

export interface RoadmapAuditEntry {
  verdict?: RoadmapVerdict;
  constraintNote?: string;
}

export interface PillarAuditEntry {
  score?: number; // 1-10
  note?: string;
}

export interface MonthlyPlan {
  id: string;        // e.g. '2026-11'
  monthKey: string;  // 'YYYY-MM'
  focusTheme: string;
  topFocuses?: string[]; // Mirrored Top 3 Focuses (customizable slot count)
  notes: string;
  tasks: TaskItem[];
  scoreboard?: ScoreboardMetric[]; // Optional Monthly KPI / Proof Checks (checked at review time)
  updatedAt: string;
}

export interface QuarterlyPlan {
  id: string;        // e.g. '2026-Q4'
  quarterKey: string; // 'YYYY-Q#'
  focusTheme: string;
  topFocuses?: string[]; // Mirrored Top 3 Focuses (customizable slot count)
  notes: string;
  tasks: TaskItem[];
  targetGateRefs?: TargetGateRef[];
  scoreboard?: ScoreboardMetric[];
  updatedAt: string;
}

export interface YearlyPlan {
  id: string;       // e.g. '2026'
  yearKey: string;  // 'YYYY'
  focusTheme: string;
  topFocuses?: string[]; // Mirrored Top 3 Focuses (customizable slot count)
  notes: string;
  tasks: TaskItem[];
  targetGateRefs?: TargetGateRef[];
  scoreboard?: ScoreboardMetric[];
  updatedAt: string;
}

export interface ReviewEntry {
  id: string;
  title: string;
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  periodKey?: string; // e.g. '2026-11' for monthly, '2026-Q4' for quarterly, '2026' for yearly
  startDate: string;
  endDate: string;
  score?: number; // 1-10 execution/discipline rating for the period
  wins: string;
  blockers: string;
  courseCorrections: string;
  headline?: string; // Quarter verdict headline or Yearly chapter title
  prevPromiseVerdict?: PromiseVerdict;
  prevPromiseNote?: string;
  alignmentVerdict?: AlignmentVerdict;
  alignmentNote?: string;
  outcomeAudits?: Record<string, OutcomeAuditEntry>;
  effortVsOutcomeNote?: string;
  roadmapAudits?: Record<string, RoadmapAuditEntry>;
  pillarAudits?: Record<string, PillarAuditEntry>;
  assumptionsDisproved?: string;
  energyAndMountainNote?: string;
  customAnswers?: Record<string, string>;
  ratings: {
    clarity: number;
    consistency: number;
    overall: number;
  };
  createdAt: string;
  updatedAt?: string;
}

export type ChecklistRecurrence = 'daily' | 'weekly' | 'monthly' | 'tally' | 'none';

export interface ChecklistCategory {
  id: string;
  name: string;
}

export interface ChecklistItem {
  id: string;
  categoryId: string;
  text: string;
  recurrence: ChecklistRecurrence;
  completed: boolean; // Used when recurrence === 'none'
  completedPeriods?: string[]; // Stores 'YYYY-MM-DD' for daily/tally logs, 'week_N' for weekly, 'YYYY-MM' for monthly
  totalCount?: number; // Used when recurrence === 'tally' (cumulative total done — never resets, excluded from weekly matrix)
  volumePerRep?: number; // Optional volume per single rep (e.g. 5 for "5 min guitar session", 500 for "500 ml hydrate")
  volumeUnit?: string; // Optional unit label (e.g. "min", "ml", "pages", "reps")
  scheduleWeekday?: number; // Optional weekly schedule day: 1=Mon..6=Sat, 0=Sun (undefined = Any day)
  scheduleDayOfMonth?: number | 'last'; // Optional monthly schedule day: 1..28 or 'last' (undefined = Any day)
  createdAt?: string; // YYYY-MM-DD when item was created (never retroactively marked missed before this date)
}

export type AllowancePeriod = 'daily' | 'weekly' | 'monthly';

export interface AllowanceItem {
  id: string;
  name: string;
  period: AllowancePeriod; // Resets automatically every day / week / month
  limit: number; // Total points allowed per period (e.g. 2 outings/week)
  step?: number; // Points deducted per click (default 1)
  unit?: string; // Optional unit label (e.g. "outings", "pts", "hrs", "€")
  usageByPeriod: Record<string, number>; // 'YYYY-MM-DD' | 'week_N' | 'YYYY-MM' -> points spent
  allowOverspend?: boolean; // Default true (negative = over budget); false caps spending at 0 remaining
  color?: ProblemColorKey;
  createdAt?: string;
  updatedAt?: string;
}

export interface StrategyProximalGoal {
  id: string;
  text: string;
  completed: boolean;
}

export interface StrategyStage {
  id: string;
  title: string;             // e.g. "Stage 0: Learn before you trade"
  systemState: string;       // e.g. "System set up"
  proximalGoals: StrategyProximalGoal[];
  whatItLooksLike: string;   // Observable reality bullets
  notPossibleUntil: string;  // Discipline boundary / off-limits until gate is passed
  dayInALife: string;        // Vivid story of how a typical day looks and feels
  gateCriterion: string;     // Exact gate proof required to unlock the next stage
  gatePassed: boolean;
  gatePassedAt?: string;     // YYYY-MM-DD when gate was marked passed
  startedAt?: string;        // YYYY-MM-DD when stage became active (for velocity tracking)
}

export interface StrategyPivotLog {
  id: string;
  date: string; // YYYY-MM-DD
  tag: ParkReasonTag;
  note: string;
}

export type StrategyPlanStatus = 'active' | 'paused' | 'pivoted' | 'possible' | 'not_pursuing';

export interface StrategyPlan {
  id: string;
  title: string;             // e.g. "Trading Strategy"
  description?: string;
  activationCondition?: string; // Trigger/gate parameter required before activating a possible/shelved roadmap
  status?: StrategyPlanStatus;
  pivotHistory?: StrategyPivotLog[];
  stages: StrategyStage[];
  createdAt: string;
  updatedAt: string;
}

export type ProblemCategory = string;

export type ProblemColorKey =
  | 'rose'
  | 'sky'
  | 'amber'
  | 'emerald'
  | 'violet'
  | 'cyan'
  | 'orange'
  | 'slate';

export interface CustomProblemCategory {
  id: string;
  label: string;
  hint?: string;
  color: ProblemColorKey;
}

export type ProblemStatus = 'open' | 'testing' | 'solved';

export type ProblemScale = 'friction' | 'bottleneck' | 'blocker';

export type ProblemImpact = 'low' | 'high' | 'critical';

export type ProblemSeverity = 1 | 2 | 3 | 4 | 5;

export type ProblemFixType =
  | 'task'
  | 'habit_rewire'
  | 'skill_reps'
  | 'rule_guardrail'
  | 'plan_change'
  | 'watch';

export type ProblemSourceType =
  | 'gws'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'roadmap';

export type ProblemDispatchTarget =
  | 'weekly_plan'
  | 'checklist_oneoff'
  | 'checklist_daily'
  | 'checklist_weekly'
  | 'reps_board';

export interface ProblemOccurrence {
  date: string; // YYYY-MM-DD
  sourceType: ProblemSourceType;
  sourceRef?: string;
  note?: string;
}

export interface ProblemFixAttempt {
  id: string;
  fixText: string;
  startedAt: string; // YYYY-MM-DD
  endedAt: string;   // YYYY-MM-DD
  outcome: 'failed' | 'replaced' | 'verified';
  daysHeld: number;
  note?: string;
}

export interface ProblemSettings {
  maxTopConstraints?: number;      // Default 3 (1-5)
  defaultVerifyDays?: number;      // Default 14 (7 / 14 / 30)
  showBreakdownBar?: boolean;      // Default true
  showPreFlightInDaily?: boolean;  // Default true
  showPreFlightInGws?: boolean;    // Default true
  separateInboxTab?: boolean;      // Default true
}

export interface ProblemEntry {
  id: string;
  title: string;
  category: ProblemCategory;
  scale?: ProblemScale; // 'friction' (Slip) | 'bottleneck' (Root Problem) | 'blocker' (Macro / Roadmap Blocker)
  impact?: ProblemImpact; // 'low' | 'high' | 'critical'
  severity?: ProblemSeverity; // Graded 1-5 severity (1 Minor, 2 Low, 3 Moderate, 4 Severe, 5 Critical)
  isTopConstraint?: boolean; // Pinned in the Top 3 Constraints focus spotlight
  trigger?: string; // When / in what context does this fire?
  rootCause?: string; // Why is this actually happening below the surface symptom?
  isGuardrail?: boolean; // Pinned as an active If-Then guardrail surfaced pre-flight
  parentProblemId?: string; // Clusters this slip under a Root Problem
  tags: string[]; // Plan names (e.g. "Trading Strategy") + custom tags
  status: ProblemStatus;
  occurrences: ProblemOccurrence[];
  fixType?: ProblemFixType;
  fixNote?: string;
  fixStartedAt?: string; // YYYY-MM-DD when the active fix experiment started
  verifyDays?: number; // Clean days required before prompting Verified Solved (default 14)
  fixAttempts?: ProblemFixAttempt[]; // Experiment history of failed/replaced/verified fixes
  lastFixFailedAt?: string; // Set automatically when +1 recurs while Testing Fix
  dispatchedTo?: ProblemDispatchTarget[];
  createdAt: string;
  updatedAt: string;
  solvedAt?: string;
}

export type PlaybookKind = 'principle' | 'routine' | 'catalyst';

export interface PlaybookEntry {
  id: string;
  kind: PlaybookKind;
  title: string;
  note?: string; // Concrete rule, timing, or why it works
  pinned?: boolean; // Pin key catalysts/principles to surface in Daily Brief
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
