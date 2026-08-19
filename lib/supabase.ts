import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPABASE_URL = 'https://taszwfsiiqeodlbaqmfj.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhc3p3ZnNpaXFlb2RsYmFxbWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjAwNDgsImV4cCI6MjEwMjY5NjA0OH0.T9b6ME60WGUQx6QDHJmDa8PSzK7QQ5HlxkIOVZI7Agc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
