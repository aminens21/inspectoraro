import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hvqlehgwmolavylwavmr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWxlaGd3bW9sYXZ5bHdhdm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NzYxNzYsImV4cCI6MjA4MzQ1MjE3Nn0.tE44Nv6CaLhiRexUanhOmsWAhvPfiRZvbQxUOPEzcj4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('teachers').select('*').limit(1);
  console.log('teachers:', data, error);
  
  const { data: d2, error: e2 } = await supabase.from('profiles').select('*').limit(1);
  console.log('profiles:', d2, e2);
  
  const { data: d3, error: e3 } = await supabase.from('users').select('*').limit(1);
  console.log('users:', d3, e3);
}

check();
