/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// Accessing environment variables via import.meta.env for Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('SUPABASE ERROR: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing in your environment variables.');
}

// Initialize with provided values or fallbacks
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
