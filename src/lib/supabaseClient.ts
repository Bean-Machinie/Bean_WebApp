import { createClient } from '@supabase/supabase-js';

// Supabase client initialized once and reused across the app.
// Values are read from Vite environment variables so they stay out of source control.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and anonymous key must be provided in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
