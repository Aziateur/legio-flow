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
  min?: number;
  max?: number;
  placeholder?: string;
  options?: string[]; // For checklists or predefined selections
  defaultValue?: any;
}

export type SystemLevel = 1 | 2 | 3 | 4;

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

export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  score?: number; // Weight in points (for weekly goal crusher)
  notes?: string;
  subTasks?: SubTaskItem[];
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
}

export interface DailyPriorityItem {
  id: string;
  text: string;
  completed: boolean;
  weeklyTaskId?: string;
  subTaskId?: string;
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
  reviewNotes?: string;
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
  reviewNotes?: string;
  updatedAt: string;
}

export interface StrategicPillar {
  id: string;
  title: string;
  subtitle: string;
  iconName: string;
  year1Milestones: TaskItem[];
  year2Milestones: TaskItem[];
  year3Milestones: TaskItem[];
  boundariesAndCheckpoints: string[];
}

export interface ThreeYearPlan {
  id: string;
  vision: string;
  targetHorizon: string; // e.g. "2026 — 2029"
  strategyCore: string;
  pillars: StrategicPillar[];
  reviewNotes?: string;
  updatedAt: string;
}

export interface ReviewEntry {
  id: string;
  title: string;
  periodType: 'daily' | 'weekly' | 'custom';
  startDate: string;
  endDate: string;
  wins: string;
  blockers: string;
  courseCorrections: string;
  ratings: {
    clarity: number;
    consistency: number;
    overall: number;
  };
  createdAt: string;
}
