import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL_KEY = 'legio_supabase_url';
const SUPABASE_ANON_KEY = 'legio_supabase_anon_key';
export const REMEMBER_DEVICE_KEY = 'legio_remember_device_v1';
export const REMEMBERED_USER_CACHE_KEY = 'legio_remembered_user_v1';

export function getRememberDevicePreference(): boolean {
  try {
    const val = localStorage.getItem(REMEMBER_DEVICE_KEY);
    // Default to true so user stays signed in on their computer unless unchecked
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setRememberDevicePreference(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_DEVICE_KEY, remember ? 'true' : 'false');
    if (!remember) {
      localStorage.removeItem(REMEMBERED_USER_CACHE_KEY);
    }
  } catch {
    // ignore
  }
}

// Default Supabase project config (safe public URL + publishable key; data is protected by Auth + RLS)
export const DEFAULT_PROJECT_REF = 'hdpqwpkktxzrcrprtyxq';
export const DEFAULT_SUPABASE_URL = `https://${DEFAULT_PROJECT_REF}.supabase.co`;
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_C4L4o3f-YXqoqrYhiIi7VA_wdJN1Bya';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const metaEnv = (import.meta as any).env || {};
  let savedUrl = localStorage.getItem(SUPABASE_URL_KEY) || '';
  let savedKey = localStorage.getItem(SUPABASE_ANON_KEY) || '';

  // Auto-clean stale paused project reference if previously cached in browser localStorage
  if (savedUrl.includes('qrksglxemydjzvpnyzzs')) {
    localStorage.removeItem(SUPABASE_URL_KEY);
    localStorage.removeItem(SUPABASE_ANON_KEY);
    savedUrl = '';
    savedKey = '';
  }

  const url = savedUrl || metaEnv.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = savedKey || metaEnv.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
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
  const remember = getRememberDevicePreference();
  const keyIdentifier = `${url}_${anonKey}_${remember ? 'local' : 'session'}`;
  if (cachedClient && lastUsedKey === keyIdentifier) {
    return cachedClient;
  }
  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'legio_flow_auth_token_v1',
        storage: typeof window !== 'undefined'
          ? (remember ? window.localStorage : window.sessionStorage)
          : undefined
      }
    });
    lastUsedKey = keyIdentifier;
    return cachedClient;
  } catch (err) {
    console.error('Failed to init Supabase client', err);
    return null;
  }
}

export const SUPABASE_SCHEMA_SQL = `-- Run this in Supabase SQL Editor to enable multi-user accounts & cloud sync for Legio Flow:

CREATE TABLE IF NOT EXISTS legio_user_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE legio_user_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own Legio Flow state"
    ON legio_user_state
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;
