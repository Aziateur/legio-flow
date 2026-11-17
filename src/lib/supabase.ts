import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL_KEY = 'legio_supabase_url';
const SUPABASE_ANON_KEY = 'legio_supabase_anon_key';

// Default project ref from user's CLI config if available
export const DEFAULT_PROJECT_REF = 'qrksglxemydjzvpnyzzs';
export const DEFAULT_SUPABASE_URL = `https://${DEFAULT_PROJECT_REF}.supabase.co`;

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const metaEnv = (import.meta as any).env || {};
  const url = localStorage.getItem(SUPABASE_URL_KEY) || metaEnv.VITE_SUPABASE_URL || '';
  const anonKey = localStorage.getItem(SUPABASE_ANON_KEY) || metaEnv.VITE_SUPABASE_ANON_KEY || '';
  return { url, anonKey };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  localStorage.setItem(SUPABASE_URL_KEY, url.trim());
  localStorage.setItem(SUPABASE_ANON_KEY, anonKey.trim());
}

let cachedClient: SupabaseClient | null = null;
let lastUsedKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey) {
    return null;
  }
  const keyIdentifier = `${url}_${anonKey}`;
  if (cachedClient && lastUsedKey === keyIdentifier) {
    return cachedClient;
  }
  try {
    cachedClient = createClient(url, anonKey, {
      auth: { persistSession: true }
    });
    lastUsedKey = keyIdentifier;
    return cachedClient;
  } catch (err) {
    console.error('Failed to init Supabase client', err);
    return null;
  }
}

export const SUPABASE_SCHEMA_SQL = `-- Run this in Supabase SQL Editor to set up Legio Flow tables:

CREATE TABLE IF NOT EXISTS legio_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  columns INT DEFAULT 2,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legio_daily_entries (
  date TEXT PRIMARY KEY,
  template_id TEXT,
  main_tasks_completed INT DEFAULT 0,
  main_tasks_total INT DEFAULT 3,
  execution_score INT DEFAULT 0,
  automatic_tasks_completed BOOLEAN DEFAULT false,
  plan_notes TEXT,
  review_notes TEXT,
  gws_session_ids JSONB DEFAULT '[]'::jsonb,
  custom_field_values JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legio_gws_sessions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  task_name TEXT NOT NULL,
  planned_minutes INT DEFAULT 45,
  actual_minutes INT DEFAULT 45,
  ratings JSONB NOT NULL,
  reflexions JSONB NOT NULL,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legio_weekly_plans (
  id TEXT PRIMARY KEY,
  week_number INT,
  start_date TEXT,
  end_date TEXT,
  focus_theme TEXT,
  notes TEXT,
  tasks JSONB DEFAULT '[]'::jsonb,
  total_possible_score INT DEFAULT 10,
  achieved_score INT DEFAULT 0,
  rewards JSONB DEFAULT '[]'::jsonb,
  review_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legio_three_year_plans (
  id TEXT PRIMARY KEY,
  vision TEXT,
  target_horizon TEXT,
  strategy_core TEXT,
  pillars JSONB DEFAULT '[]'::jsonb,
  review_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legio_reviews (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  period_type TEXT,
  start_date TEXT,
  end_date TEXT,
  wins TEXT,
  blockers TEXT,
  course_corrections TEXT,
  ratings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) with open anon access for simple personal tracker
ALTER TABLE legio_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE legio_daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE legio_gws_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE legio_weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE legio_three_year_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE legio_reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public access legio_templates" ON legio_templates FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public access legio_daily_entries" ON legio_daily_entries FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public access legio_gws_sessions" ON legio_gws_sessions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public access legio_weekly_plans" ON legio_weekly_plans FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public access legio_three_year_plans" ON legio_three_year_plans FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public access legio_reviews" ON legio_reviews FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;
