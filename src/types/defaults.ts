import {
  Template,
  DailyEntry,
  GWSSession,
  WeeklyPlan,
  ReviewEntry,
  MonthlyPlan,
  YearlyPlan,
  ChecklistCategory,
  ChecklistItem
} from './schema';

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'tpl_daily_default',
    name: 'Daily Mission & Checklist',
    description: 'Day plan, numbered priorities, target delivery counter, and linked GWS blocks.',
    category: 'daily',
    isDefault: true,
    columns: 2,
    createdAt: '2026-10-25T00:00:00.000Z',
    updatedAt: '2026-10-25T00:00:00.000Z',
    fields: [
      {
        id: 'plan_notes',
        label: 'Day Mission & Priorities',
        description: 'Numbered daily execution targets',
        type: 'numbered_list',
        width: 'col-span-12',
        shape: 'standard',
        placeholder: 'Enter priority...'
      },
      {
        id: 'main_tasks_ratio',
        label: 'Main Tasks Completed',
        description: 'Target vs Completed tasks for today',
        type: 'score_target',
        width: 'col-span-6',
        shape: 'compact',
        min: 0,
        max: 10,
        defaultValue: { completed: 3, total: 3 }
      },
      {
        id: 'gws_sessions_done',
        label: 'GWS Sessions Done Today',
        description: 'Linked Goal Work Sessions completed today',
        type: 'gws_session_link',
        width: 'col-span-6',
        shape: 'compact',
        defaultValue: []
      }
    ]
  },
  {
    id: 'tpl_daily_review_default',
    name: 'Daily Execution Review & Reflexion',
    description: 'Execution score /10, automatic habits audit, and end-of-day course correction notes.',
    category: 'review',
    isDefault: true,
    columns: 2,
    createdAt: '2026-10-25T00:00:00.000Z',
    updatedAt: '2026-10-25T00:00:00.000Z',
    fields: [
      {
        id: 'execution_score',
        label: 'Daily Execution Score (out of 10)',
        description: 'Rate your total execution discipline for today',
        type: 'rating_10',
        width: 'col-span-6',
        shape: 'compact',
        min: 1,
        max: 10,
        defaultValue: 6
      },
      {
        id: 'automatic_tasks',
        label: 'Automatic Tasks Completed',
        description: 'Did you complete all daily automatic routines/habits?',
        type: 'checkbox',
        width: 'col-span-6',
        shape: 'compact',
        defaultValue: true
      },
      {
        id: 'daily_reflexion',
        label: 'Daily Reflexion & Course Correction',
        description: 'End-of-day review notes to adjust trajectory',
        type: 'textarea',
        width: 'col-span-12',
        shape: 'standard',
        placeholder: 'What moved the needle today? Where was time lost? What needs recalibration tomorrow?'
      }
    ]
  },
  {
    id: 'tpl_gws_default',
    name: 'GWS (Goal Work Session)',
    description: 'Deep work sprint with planned vs actual time, Focus/Execution/Output ratings, and 3-step reflexions.',
    category: 'gws',
    isDefault: true,
    columns: 2,
    createdAt: '2026-10-25T00:00:00.000Z',
    updatedAt: '2026-10-25T00:00:00.000Z',
    fields: [
      {
        id: 'task_name',
        label: 'Task Name',
        type: 'text',
        width: 'col-span-12',
        shape: 'compact',
        placeholder: 'e.g., Discord onboarding architecture & test run'
      },
      {
        id: 'time_tracking',
        label: 'Time: Planned vs Actual (minutes)',
        type: 'duration',
        width: 'col-span-12',
        shape: 'standard',
        defaultValue: { planned: 50, actual: 45 }
      },
      {
        id: 'performance_ratings',
        label: 'Performance Scorecard (1–5)',
        type: 'rating_5',
        width: 'col-span-12',
        shape: 'highlight',
        defaultValue: { focus: 4, execution: 4, output: 4, total: 12 }
      },
      {
        id: 'reflexion_accomplished',
        label: '1. What did I accomplish?',
        type: 'textarea',
        width: 'col-span-12',
        shape: 'standard',
        placeholder: 'Concrete results produced during this work session...'
      },
      {
        id: 'reflexion_held_back',
        label: '2. What held me back?',
        type: 'textarea',
        width: 'col-span-12',
        shape: 'standard',
        placeholder: 'Friction, distractions, ambiguity, or delays encountered...'
      },
      {
        id: 'reflexion_improve_next',
        label: '3. What will I improve next session?',
        type: 'textarea',
        width: 'col-span-12',
        shape: 'standard',
        placeholder: 'Specific corrective actions to take in the next session...'
      }
    ]
  },
  {
    id: 'tpl_weekly_default',
    name: 'Weekly Goal Crusher',
    description: 'Weekly focus headline, task breakdown with point weights summing to 10, and tiered reward ladder.',
    category: 'weekly',
    isDefault: true,
    columns: 2,
    createdAt: '2026-10-25T00:00:00.000Z',
    updatedAt: '2026-10-25T00:00:00.000Z',
    fields: [
      {
        id: 'weekly_focus_theme',
        label: 'Weekly Focus',
        type: 'text',
        width: 'col-span-12',
        shape: 'highlight',
        placeholder: 'This Weeks Focus: systems launched'
      },
      {
        id: 'weekly_tasks_table',
        label: 'Break the goal down into real tasks (Sum: 10 pts)',
        type: 'task_points_table',
        width: 'col-span-8',
        shape: 'standard'
      },
      {
        id: 'reward_ladder',
        label: 'Reward Ladder (6+ to 10)',
        type: 'reward_ladder',
        width: 'col-span-4',
        shape: 'highlight'
      },
      {
        id: 'weekly_note',
        label: 'Weekly Strategy Note',
        type: 'textarea',
        width: 'col-span-12',
        shape: 'standard'
      }
    ]
  }
];

export const INITIAL_DAILY_ENTRIES: Record<string, DailyEntry> = {
  '2026-10-25': {
    date: '2026-10-25',
    templateId: 'tpl_daily_default',
    mainTasksCompleted: 3,
    mainTasksTotal: 3,
    executionScore: 6,
    automaticTasksCompleted: true,
    planNotes: 'Wrap up preparation, calibrate systems, Sunday review',
    gwsSessionIds: ['gws_sample_1'],
    reviewNotes: 'Execution score 6/10. Solid foundation laid for Week 3.',
    customFieldValues: {},
    updatedAt: '2026-10-25T20:00:00.000Z'
  },
  '2026-10-26': {
    date: '2026-10-26',
    templateId: 'tpl_daily_default',
    mainTasksCompleted: 2,
    mainTasksTotal: 3,
    executionScore: 7,
    automaticTasksCompleted: true,
    planNotes: 'Boot camp\nPrep cohort\nFigure out what to do trading wise and overall',
    gwsSessionIds: [],
    reviewNotes: 'Boot camp session went strong. Cohort materials organized.',
    customFieldValues: {},
    updatedAt: '2026-10-26T21:00:00.000Z'
  },
  '2026-10-27': {
    date: '2026-10-27',
    templateId: 'tpl_daily_default',
    mainTasksCompleted: 0,
    mainTasksTotal: 0,
    executionScore: 5,
    automaticTasksCompleted: true,
    planNotes: 'No plan',
    gwsSessionIds: [],
    reviewNotes: 'Rest and reset day. Needed mental recovery.',
    customFieldValues: {},
    updatedAt: '2026-10-27T20:00:00.000Z'
  },
  '2026-10-28': {
    date: '2026-10-28',
    templateId: 'tpl_daily_default',
    mainTasksCompleted: 1,
    mainTasksTotal: 3,
    executionScore: 8,
    automaticTasksCompleted: true,
    planNotes: '1 finish the discord and do a test run + get the guy’s commitment to a first meeting plus plan individual onboarding\n2 boot camp plus plan a trading start on miro with basic checkpoints\n3 asses current situation and what needs to happen what needs to be learned what systems do I need now and what needs to be bought',
    gwsSessionIds: ['gws_sample_2'],
    reviewNotes: 'High focus day in progress. Legio software built to streamline execution tracking.',
    customFieldValues: {},
    updatedAt: '2026-10-28T10:00:00.000Z'
  },
  '2026-10-29': {
    date: '2026-10-29',
    templateId: 'tpl_daily_default',
    mainTasksCompleted: 0,
    mainTasksTotal: 3,
    executionScore: 0,
    automaticTasksCompleted: false,
    planNotes: '1 Review cohort commitments\n2 Refine Miro strategic trading plan\n3 Systems budget and procurement check',
    gwsSessionIds: [],
    reviewNotes: '',
    customFieldValues: {},
    updatedAt: '2026-10-28T10:00:00.000Z'
  }
};

export const INITIAL_GWS_SESSIONS: GWSSession[] = [
  {
    id: 'gws_sample_1',
    date: '2026-10-25',
    taskName: 'Weekly architecture & setup calibration',
    plannedMinutes: 60,
    actualMinutes: 55,
    ratings: {
      focus: 4,
      execution: 4,
      output: 3,
      total: 11
    },
    reflexions: {
      accomplished: 'Completed weekly framework draft and reviewed all open tasks.',
      heldBack: 'Some browser tab clutter caused slight hesitation early in the session.',
      improveNext: 'Close all non-essential tabs before starting the timer.'
    },
    createdAt: '2026-10-25T14:30:00.000Z'
  },
  {
    id: 'gws_sample_2',
    date: '2026-10-28',
    taskName: 'Discord setup & onboarding workflow design',
    plannedMinutes: 90,
    actualMinutes: 85,
    ratings: {
      focus: 5,
      execution: 4,
      output: 5,
      total: 14
    },
    reflexions: {
      accomplished: 'Created onboarding pipeline, mapped Miro board milestones, verified test run.',
      heldBack: 'Waited on one response for 10 minutes.',
      improveNext: 'Send asynchronous brief first, then enter deep work block.'
    },
    createdAt: '2026-10-28T09:15:00.000Z'
  }
];

export const INITIAL_WEEKLY_PLANS: Record<string, WeeklyPlan> = {
  'week_1': {
    id: 'week_1',
    weekNumber: 1,
    startDate: '2026-10-12',
    endDate: '2026-10-18',
    focusTheme: 'systems lauched',
    notes: 'This sheet is for you to mark down your goals with particular focus in the week. To make it easier, split those big goals into smaller ones, so you know what exactly to do.\n\nRewarding yourself is important! Give yourself one depending on which mark you got for each goal (from smaller to bigger of course)!',
    tasks: [
      {
        id: 'w1_t1',
        text: 'make theoretical framework and basic functions for the online legio get everyone to show up to the first meeting aftwards',
        score: 3,
        completed: true
      },
      {
        id: 'w1_t2',
        text: 'recrute and do the math for the IRL legio',
        score: 1,
        completed: true
      },
      {
        id: 'w1_t3',
        text: 'devise a trading strategy and a path tho mast trading (must be a MIRO like strategic plan with clear boundaries and checkpoints)',
        score: 3,
        completed: false
      },
      {
        id: 'w1_t4',
        text: 'take stock of all the tool I will need ho much they cost and in what order should they be purchased (make a monthly budget)',
        score: 2,
        completed: true
      },
      {
        id: 'w1_t5',
        text: 'make a startegic plan for business same standard as the trading plan REFINE THE 3 year plan',
        score: 1,
        completed: false
      }
    ],
    totalPossibleScore: 10,
    achievedScore: 6,
    rewards: [
      { id: 'r1', minScore: 6, reward: 'Nice dinner + evening relaxation break' },
      { id: 'r2', minScore: 7, reward: 'Buy specialized book / productivity tool upgrade' },
      { id: 'r3', minScore: 8, reward: 'Full celebration day + weekend freedom' },
      { id: 'r4', minScore: 9, reward: 'Major milestone splurge / tech upgrade' },
      { id: 'r5', minScore: 10, reward: 'Ultimate mastery victory reward' }
    ],
    reviewNotes: 'Achieved 6/10 points. Systems framework and budgeting locked in. Trading strategy and 3-year plan carried forward to Week 2 & 3.',
    updatedAt: '2026-10-18T22:00:00.000Z'
  },
  'week_3': {
    id: 'week_3',
    weekNumber: 3,
    startDate: '2026-10-26',
    endDate: '2026-11-01',
    focusTheme: 'Discord cohort launch & Miro trading roadmap',
    notes: 'Focus on high-leverage execution. Do not compromise on GWS ratings.',
    tasks: [
      {
        id: 'w3_t1',
        text: 'finish the discord, do test run, get commitment to first meeting + individual onboarding plan',
        score: 3,
        completed: false
      },
      {
        id: 'w3_t2',
        text: 'boot camp plus plan trading start on Miro with basic checkpoints',
        score: 3,
        completed: false
      },
      {
        id: 'w3_t3',
        text: 'assess current situation: what needs to happen, what to learn, what systems now & what to buy',
        score: 2,
        completed: false
      },
      {
        id: 'w3_t4',
        text: 'execute 5+ high-rated GWS sessions (average 12+/15)',
        score: 2,
        completed: false
      }
    ],
    totalPossibleScore: 10,
    achievedScore: 0,
    rewards: [
      { id: 'r1', minScore: 7, reward: 'Special dinner out' },
      { id: 'r2', minScore: 10, reward: 'Complete victory weekend' }
    ],
    reviewNotes: '',
    updatedAt: '2026-10-28T09:00:00.000Z'
  }
};

export const INITIAL_MONTHLY_PLANS: Record<string, MonthlyPlan> = {};

export const INITIAL_YEARLY_PLANS: Record<string, YearlyPlan> = {};

export const INITIAL_CHECKLIST_CATEGORIES: ChecklistCategory[] = [
  { id: 'cat_routine', name: 'Daily Routine & Habits' },
  { id: 'cat_trading', name: 'Trading' },
  { id: 'cat_business', name: 'Legio & Business' }
];

export const INITIAL_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'chk_1',
    categoryId: 'cat_routine',
    text: 'Morning Bootcamp / Workout',
    recurrence: 'daily',
    completed: false,
    completedPeriods: []
  },
  {
    id: 'chk_2',
    categoryId: 'cat_routine',
    text: 'Hydration + Sleep schedule check',
    recurrence: 'daily',
    completed: false,
    completedPeriods: []
  },
  {
    id: 'chk_3',
    categoryId: 'cat_trading',
    text: 'Pre-market Miro boundaries & checklist',
    recurrence: 'daily',
    completed: false,
    completedPeriods: []
  },
  {
    id: 'chk_4',
    categoryId: 'cat_trading',
    text: 'Weekly trade audit & setup review',
    recurrence: 'weekly',
    completed: false,
    completedPeriods: []
  },
  {
    id: 'chk_5',
    categoryId: 'cat_business',
    text: 'Monthly tools & software budget check',
    recurrence: 'monthly',
    completed: false,
    completedPeriods: []
  },
  {
    id: 'chk_6',
    categoryId: 'cat_business',
    text: 'Send Legio onboarding checklist to cohort',
    recurrence: 'none',
    completed: false
  }
];

