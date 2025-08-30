import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error('Missing Supabase environment variables');
  console.error('VITE_SUPABASE_URL:', url);
  console.error('VITE_SUPABASE_ANON_KEY:', anon ? 'Present' : 'Missing');
}

export const supabase = createClient(url, anon, {
  realtime: { params: { eventsPerSecond: 20 } },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});