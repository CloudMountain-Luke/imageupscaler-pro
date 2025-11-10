import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

const UNCONFIGURED_MESSAGE =
  'Supabase client is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

function createUnconfiguredClient(): SupabaseClient<any, 'public', any> {
  const thrower = () => {
    throw new Error(UNCONFIGURED_MESSAGE);
  };

  const methodProxy = new Proxy(thrower, {
    apply: () => thrower(),
    get: () => methodProxy,
  });

  return new Proxy({} as SupabaseClient<any, 'public', any>, {
    get: (_target, _prop) => methodProxy,
  });
}

export const supabase: SupabaseClient<any, 'public', any> = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : createUnconfiguredClient();