// Provider de leads: inserta en la tabla `leads` de Supabase vía REST
// con Prefer: return=minimal — IMPORTANTE: no pedir representación,
// porque RETURNING necesita policy de SELECT que `anon` no tiene
// (y no debe tener: nadie puede leer leads salvo el admin autenticado).
// Si Supabase no está configurado o falla, cae al Apps Script -> Sheets.
const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzfCUFD7v3507wU3b3Aw1EcgDWDHVF4RW10eSNO1wFkD_bjaB54nk0A8Utw5nydHubg/exec';

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function postLead(payload) {
  if (SB_URL && SB_KEY) {
    return fetch(`${SB_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`leads insert ${res.status}`);
      })
      .catch((err) => {
        console.warn('[leads] Supabase falló, usando fallback:', err);
        return postToScript(payload);
      });
  }
  return postToScript(payload);
}

function postToScript(payload) {
  return fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => console.log(err));
}
