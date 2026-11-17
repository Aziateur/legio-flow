import { Template, DailyEntry, GWSSession, WeeklyPlan, ReviewEntry, ThreeYearPlan } from './schema';

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'tpl_daily_default',
    name: 'Daily Execution & Review',
    description: 'Day-by-day task planning, execution score /10, automatic habits, GWS links, and reflexions.',
    category: 'daily',
    isDefault: true,
    columns: 2,
    createdAt: '2026-10-25T00:00:00.000Z',
    updatedAt: '2026-10-25T00:00:00.000Z',
    fields: [
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
        id: 'gws_sessions_done',
        label: 'GWS Sessions Done Today',
        description: 'Linked Goal Work Sessions completed today',
        type: 'gws_session_link',
        width: 'col-span-6',
        shape: 'compact',
        defaultValue: []
      },
      {
        id: 'plan_notes',
        label: 'Day Plan & Direct Priorities',
        description: 'Numbered daily mission objectives',
        type: 'numbered_list',
        width: 'col-span-12',
        shape: 'standard',
        placeholder: 'Enter priority...'
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
      { id: 'r1', minScore: 6, reward: 'Special dinner out' },
      { id: 'r2', minScore: 7, reward: 'New course/subscription purchase' },
      { id: 'r3', minScore: 8, reward: 'Full weekend celebration' },
      { id: 'r4', minScore: 9, reward: 'High value tech gear purchase' },
      { id: 'r5', minScore: 10, reward: 'Complete victory weekend' }
    ],
    reviewNotes: '',
    updatedAt: '2026-10-28T09:00:00.000Z'
  }
};

export const INITIAL_THREE_YEAR_PLAN: ThreeYearPlan = {
  id: 'plan_3yr_core',
  vision: 'Build an indomitable operational fortress: Master full-spectrum trading, scale the Online & IRL Legio ecosystem, and engineer automated software systems that ensure unrelenting compounding.',
  targetHorizon: '2026 — 2029',
  strategyCore: 'Execute daily GWS sprints with strict 1–15 ratings, enforce weekly 10-point Goal Crusher milestones with earned reward tiers, and maintain unambiguous Miro boundaries across trading and business.',
  updatedAt: '2026-10-28T10:00:00.000Z',
  pillars: [
    {
      id: 'pillar_trading',
      title: 'Trading Strategy & Mastery',
      subtitle: 'Miro-style strategic path, strict boundary checkpoints & capital growth',
      iconName: 'TrendingUp',
      boundariesAndCheckpoints: [
        'Boundary: Max 1.5% capital risk per trade; no emotional doubling down',
        'Checkpoint: Must complete pre-market checklist before entering any position',
        'Boundary: 2 consecutive losses trigger mandatory session pause & GWS review',
        'Checkpoint: Weekly Miro board review of all logged trade setups'
      ],
      year1Milestones: [
        { id: 't_y1_1', text: 'Devise comprehensive trading strategy on Miro with explicit boundaries and checkpoints', completed: true },
        { id: 't_y1_2', text: 'Achieve 3 consecutive months of disciplined rule-based execution', completed: false },
        { id: 't_y1_3', text: 'Build consistent trade journaling with post-market reflexions', completed: false }
      ],
      year2Milestones: [
        { id: 't_y2_1', text: 'Scale capital base through funded accounts and retained earnings', completed: false },
        { id: 't_y2_2', text: 'Integrate automated volatility and risk alert infrastructure', completed: false }
      ],
      year3Milestones: [
        { id: 't_y3_1', text: 'Full financial independence driven by algorithmic & discretionary mastery', completed: false },
        { id: 't_y3_2', text: 'Manage multi-asset portfolio with institutional-grade risk management', completed: false }
      ]
    },
    {
      id: 'pillar_legio',
      title: 'Legio Ecosystem (Online & IRL)',
      subtitle: 'Cohort community, individual onboarding pipelines & mastermind network',
      iconName: 'Users',
      boundariesAndCheckpoints: [
        'Boundary: High commitment barrier — zero tolerance for passive lurkers',
        'Checkpoint: Every new member undergoes 1-on-1 onboarding and commitment audit',
        'Checkpoint: Weekly group synchronizations with mandatory progress reporting',
        'Boundary: IRL Legio unit economics must remain strictly cash-flow positive'
      ],
      year1Milestones: [
        { id: 'l_y1_1', text: 'Finish Discord architecture, onboarding test run & secure cohort commitments', completed: true },
        { id: 'l_y1_2', text: 'Run Boot camp cohort 1 with 100% active attendance', completed: false },
        { id: 'l_y1_3', text: 'Complete recruiting math and physical logistics for IRL Legio launch', completed: false }
      ],
      year2Milestones: [
        { id: 'l_y2_1', text: 'Expand to 3 active cohort tiers with trained community mentors', completed: false },
        { id: 'l_y2_2', text: 'Host first high-impact IRL Legio flagship gathering', completed: false }
      ],
      year3Milestones: [
        { id: 'l_y3_1', text: 'Thriving global brotherhood with vetted IRL chapters in key cities', completed: false },
        { id: 'l_y3_2', text: 'Syndicate investments and high-leverage ventures inside the Legio network', completed: false }
      ]
    },
    {
      id: 'pillar_systems',
      title: 'Systems, Tooling & Infrastructure',
      subtitle: 'Monthly procurement budget, automated software & disciplined operations',
      iconName: 'Cpu',
      boundariesAndCheckpoints: [
        'Boundary: Every tool or software purchase must have an explicit ROI within 30 days',
        'Checkpoint: Maintain strict monthly hardware/software procurement budget',
        'Checkpoint: Weekly system backups and telemetry audit in Legio Flow',
        'Boundary: Minimize technical debt by keeping tools modular and local-first'
      ],
      year1Milestones: [
        { id: 's_y1_1', text: 'Take complete stock of all needed tools, costs, and procurement sequence', completed: true },
        { id: 's_y1_2', text: 'Deploy Legio Flow OS for frictionless daily input and retrospective reviews', completed: true },
        { id: 's_y1_3', text: 'Establish fixed monthly operating budget for tech stack', completed: false }
      ],
      year2Milestones: [
        { id: 's_y2_1', text: 'Automate content, member analytics, and daily performance dashboards', completed: false },
        { id: 's_y2_2', text: 'Hardware and dual-screen workspace setup completely finalized', completed: false }
      ],
      year3Milestones: [
        { id: 's_y3_1', text: 'Proprietary automated software stack operating with near-zero overhead', completed: false },
        { id: 's_y3_2', text: 'Full operational redundancy allowing location-independent lifestyle', completed: false }
      ]
    }
  ]
};

