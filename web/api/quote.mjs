// POST /api/quote — handler Vercel (Node runtime).
// Persiste vía RPC submit_quote con claves SERVER-ONLY
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — nunca VITE_*).
// Sin envs configuradas → 503 con fallback manual explícito.
import { handleQuotePost } from '../server/quote-service.mjs';
import { MAX_PAYLOAD_BYTES } from '../src/shared/quote-contract.mjs';

const FETCH_TIMEOUT_MS = 10_000;
const RATE_LIMIT = 12;         // solicitudes públicas por minuto por IP
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map(); // ip → [timestamps] — proceso-local (Vercel: por instancia)
const MAX_TRACKED_IPS = 10_000;

function rateLimit(ip) {
  const now = Date.now();
  const arr = (rateBuckets.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_LIMIT) { rateBuckets.set(ip, arr); return true; }
  if (rateBuckets.size >= MAX_TRACKED_IPS && !rateBuckets.has(ip)) {
    // nunca vaciar buckets válidos (eso resetearía la protección para todos):
    // primero podar expirados; si sigue lleno, rechazar la IP nueva.
    for (const [k, v] of rateBuckets) {
      const alive = v.filter((t) => now - t < RATE_WINDOW_MS);
      if (alive.length === 0) rateBuckets.delete(k);
      else rateBuckets.set(k, alive);
    }
    if (rateBuckets.size >= MAX_TRACKED_IPS) return true;
  }
  arr.push(now); rateBuckets.set(ip, arr);
  return false;
}

// Lee el body con límite duro ANTES de parsear; soporta Vercel req.body
// pre-parseado (object/string/Buffer) sin colgar un stream ya consumido.
function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body != null) {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8')
        : typeof req.body === 'string' ? req.body
        : typeof req.body === 'object' ? JSON.stringify(req.body) : null;
      if (raw === null) return reject(Object.assign(new Error('type'), { code: 400 }));
      if (Buffer.byteLength(raw) > MAX_PAYLOAD_BYTES)
        return reject(Object.assign(new Error('oversize'), { code: 413 }));
      return resolve(raw);
    }
    const chunks = [];
    let size = 0, done = false, oversize = false;
    // Al superar el límite se sigue drenando el body — si el server deja de
    // leer, el cliente recibe TCP reset antes que el 413.
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_PAYLOAD_BYTES) { oversize = true; return; }
      if (!oversize) chunks.push(c);
    });
    const fail = (code) => { if (!done) { done = true; reject(Object.assign(new Error('body'), { code })); } };
    req.on('end', () => {
      if (done) return;
      done = true;
      if (oversize) reject(Object.assign(new Error('oversize'), { code: 413 }));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', () => fail(400));
  });
}

// Adapter Supabase — UNA sola forma de query remota: RPC submit_quote.
function supabaseAdapter() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    async save(request_id, normalizedPayload, hash) {
      const r = await fetch(`${url}/rest/v1/rpc/submit_quote`, {
        method: 'POST',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_request_id: request_id,
          p_payload: normalizedPayload,
          p_payload_hash: hash,
        }),
      });
      if (r.status === 409) return { conflict: true };
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        if (t.includes('IDEMPOTENCY_CONFLICT')) return { conflict: true };
        // Códigos de validación del RPC → 422 con mensaje fijo y seguro;
        // nunca se reenvía el texto crudo del backend.
        if (t.includes('INVALID_VARIANT')) return { invalid: 'variant' };
        if (t.includes('INVALID_PRODUCT_OR_QUANTITY')) return { invalid: 'product' };
        throw new Error(`submit_quote_http_${r.status}`);
      }
      // Ack EXACTO: accepted===true, request_id===enviado, duplicate boolean.
      // Cualquier otra forma ({} , accepted false, id distinto, JSON inválido)
      // → throw → 503/502 upstream, nunca éxito fabricado.
      let data;
      try { data = await r.json(); }
      catch { throw new Error('submit_quote_ack_invalid'); }
      if (data?.accepted === true && data?.request_id === request_id && typeof data?.duplicate === 'boolean')
        return { accepted: true, request_id, duplicate: data.duplicate };
      throw new Error('submit_quote_ack_invalid');
    },
  };
}

export { supabaseAdapter, readBody, rateLimit, RATE_LIMIT };

export default async function handler(req, res) {
  const send = (code, body) => {
    try {
      res.statusCode = code;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(body));
    } catch { /* socket ya cerrado */ }
  };
  if (req.method !== 'POST') return send(405, { error: 'method not allowed' });
  const ct = req.headers?.['content-type'] || '';
  if (!ct.includes('application/json')) return send(400, { error: 'content-type debe ser application/json' });
  const origin = req.headers?.origin;
  if (origin) {
    try { if (new URL(origin).host !== req.headers.host) return send(403, { error: 'origin inválido' }); }
    catch { return send(403, { error: 'origin inválido' }); }
  }
  // IP real del socket; no se confía en X-Forwarded-For salvo forwarding conocido.
  const ip = req.socket?.remoteAddress || 'unknown';
  if (rateLimit(ip)) return send(429, { error: 'demasiadas solicitudes — reintentá en un minuto' });

  let raw;
  try { raw = await readBody(req); }
  catch (e) { return send(e.code === 413 ? 413 : 400, { error: e.code === 413 ? 'payload supera el límite' : 'body inválido' }); }

  const adapter = supabaseAdapter();
  const r = await handleQuotePost(raw, { adapter });
  return send(r.status, r.body);
}
