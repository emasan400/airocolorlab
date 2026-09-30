import { createClient } from '@supabase/supabase-js';

// Solo la publishable/anon key va en el frontend — NUNCA la secret key.
// La seguridad real la dan las policies RLS del schema (db/schema.sql).
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
export const supabaseEnabled = !!supabase;
