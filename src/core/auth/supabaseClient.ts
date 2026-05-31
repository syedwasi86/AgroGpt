// src/core/auth/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Supabase Environment Variables are missing! " +
    "Authentication, user profile loading, and cloud sync will not work. " +
    "Please make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file and restart your dev server."
  );
}

// Fallback to placeholder values to prevent the app from crashing during boot
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);