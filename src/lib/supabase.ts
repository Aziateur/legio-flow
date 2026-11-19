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

// Admin accounts (enforced both in UI and in Supabase SECURITY DEFINER RPCs)
export const ADMIN_EMAILS = ['elhallaoui.mohamed1@gmail.com'];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export interface AdminUserStateRow {
  user_id: string;
  email: string;
  display_name: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  updated_at: string | null;
  state: Record<string, any>;
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

export const SUPABASE_ADMIN_SQL = `-- Admin-only RPCs for Legio Flow (only elhallaoui.mohamed1@gmail.com can invoke)

CREATE OR REPLACE FUNCTION public.legio_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email) IN ('elhallaoui.mohamed1@gmail.com')
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_list_all_user_states()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  state JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.legio_is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::TEXT AS email,
    COALESCE(s.display_name, u.raw_user_meta_data ->> 'display_name', u.email::TEXT) AS display_name,
    u.created_at,
    u.last_sign_in_at,
    s.updated_at,
    COALESCE(s.state, '{}'::jsonb) AS state
  FROM auth.users u
  LEFT JOIN public.legio_user_state s ON s.user_id = u.id
  ORDER BY COALESCE(s.updated_at, u.created_at) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_user_state(
  target_user_id UUID DEFAULT NULL,
  target_email TEXT DEFAULT NULL,
  new_state JSONB DEFAULT '{}'::jsonb,
  new_display_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  restored_user_id UUID,
  restored_email TEXT,
  restored_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID;
  v_email TEXT;
  v_name TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF NOT public.legio_is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin privileges required';
  END IF;

  IF target_user_id IS NOT NULL THEN
    SELECT u.id, u.email::TEXT, COALESCE(new_display_name, u.raw_user_meta_data ->> 'display_name', u.email::TEXT)
      INTO v_uid, v_email, v_name
      FROM auth.users u
      WHERE u.id = target_user_id
      LIMIT 1;
  END IF;

  IF v_uid IS NULL AND target_email IS NOT NULL AND length(trim(target_email)) > 0 THEN
    SELECT u.id, u.email::TEXT, COALESCE(new_display_name, u.raw_user_meta_data ->> 'display_name', u.email::TEXT)
      INTO v_uid, v_email, v_name
      FROM auth.users u
      WHERE lower(u.email) = lower(trim(target_email))
      LIMIT 1;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Target account not found in auth.users (id: %, email: %)', target_user_id, target_email;
  END IF;

  INSERT INTO public.legio_user_state (user_id, display_name, state, updated_at)
  VALUES (
    v_uid,
    v_name,
    jsonb_set(COALESCE(new_state, '{}'::jsonb), '{clientUpdatedAt}', to_jsonb(v_now::text), true),
    v_now
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    display_name = COALESCE(EXCLUDED.display_name, public.legio_user_state.display_name),
    state = EXCLUDED.state,
    updated_at = v_now;

  RETURN QUERY SELECT v_uid, v_email, v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.legio_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.legio_is_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_all_user_states() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_all_user_states() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_restore_user_state(UUID, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_restore_user_state(UUID, TEXT, JSONB, TEXT) TO authenticated;
`;

export const SUPABASE_SCHEMA_SQL = `-- Run this in Supabase SQL Editor to enable multi-user accounts, cloud sync & Admin backups for Legio Flow:

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

${SUPABASE_ADMIN_SQL}`;
