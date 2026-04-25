import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Determine if we have real Supabase credentials (not placeholder values)
const isConfigured =
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder');

// Create a real client if configured, otherwise a safe no-op client for demo/offline mode
export const supabase = isConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : createClient('https://demo.supabase.co', 'demo-anon-key-placeholder-offline-mode')