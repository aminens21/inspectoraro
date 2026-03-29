
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hvqlehgwmolavylwavmr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWxlaGd3bW9sYXZ5bHdhdm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NzYxNzYsImV4cCI6MjA4MzQ1MjE3Nn0.tE44Nv6CaLhiRexUanhOmsWAhvPfiRZvbQxUOPEzcj4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
