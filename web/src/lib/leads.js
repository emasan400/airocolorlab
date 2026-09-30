// Provider de leads: si Supabase está configurado inserta en la tabla
// `leads` (RLS permite insert público); si falla o no hay credenciales,
// cae al Apps Script -> Google Sheets (CRM original).
import { supabase } from './supabase';

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzfCUFD7v3507wU3b3Aw1EcgDWDHVF4RW10eSNO1wFkD_bjaB54nk0A8Utw5nydHubg/exec';

export async function postLead(payload) {
  if (supabase) {
    try {
      const { error } = await supabase.from('leads').insert(payload);
      if (!error) return;
      console.warn('[leads] insert falló, usando fallback:', error.message);
    } catch (err) {
      console.warn('[leads] supabase inalcanzable, usando fallback:', err);
    }
  }
  return fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => console.log(err));
}
