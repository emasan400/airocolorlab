// Envío de cotización al endpoint same-origin /api/quote con ack durable.
// Sin fallback de fetch opaco ni escritura directa a Supabase/Sheets desde el cliente:
// si el servidor no confirma, la UI informa "no confirmado" y ofrece
// reintentar o el canal manual de WhatsApp.
// Cliente y server hashean EL MISMO payload canonical (normalizePayload).
import { normalizePayload } from '../shared/quote-contract.mjs';

const DRAFT_KEY = 'airo_quote_request_v1';
const DEFAULT_TIMEOUT_MS = 15_000;
const inFlight = new Map(); // payloadHash → Promise — un envío por draft en vuelo
const memoryDrafts = new Map(); // draftKey → {hash, request_id} cuando storage no persiste

const sha256Hex = async (s) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

const uuid = () => crypto.randomUUID();

// El borrador se nombra por origen ('Catálogo'/'Contacto'/generic) para que el
// reintento de un formulario no pise la identidad del otro.
export function draftKeyFor(origen) {
  return `${DRAFT_KEY}__${String(origen || 'generic').toLowerCase().replace(/\s+/g, '_')}`;
}

// request_id estable para un draft sin cambios; un draft modificado → UUID nuevo.
// Persiste en localStorage; si la escritura falla, el id queda en memoria
// (estable durante la sesión; se regenera tras reload — se avisa). El cache de
// memoria se consulta SIEMPRE como respaldo del persistente.
function stableRequestId(draftKey, hash, storage) {
  let st = null, readOk = false;
  try {
    st = JSON.parse(storage?.getItem(draftKey) || 'null');
    readOk = true;
  } catch { readOk = false; }
  if (st?.hash === hash && st?.request_id) return { request_id: st.request_id, persisted: true };
  // cache de memoria — conserva el estado persisted REAL (no el readOk actual)
  const mem = memoryDrafts.get(draftKey);
  if (mem?.hash === hash) return { request_id: mem.request_id, persisted: mem.persisted };
  const request_id = uuid();
  let persisted = false;
  try {
    if (!storage) { persisted = false; }
    else { storage.setItem(draftKey, JSON.stringify({ hash, request_id })); persisted = true; }
  } catch { persisted = false; }
  memoryDrafts.set(draftKey, { hash, request_id, persisted });
  return { request_id, persisted };
}

// postLead(payload, opts) → Promise<ack>
// ack: {accepted:true, request_id, duplicate, demo?}
// Rechaza con {error, recoverable, status?} ante fallo — jamás éxito falso.
export async function postLead(payload, { fetchFn = fetch, url = '/api/quote', storage, catalog, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let store = storage;
  if (store === undefined) {
    // acceder al getter de localStorage puede lanzar (sandbox/privacy mode)
    try { store = globalThis.localStorage; } catch { store = undefined; }
  }
  const n = normalizePayload(payload, catalog);
  // El cliente valida ANTES de hashear: un payload inválido es error local,
  // no se envía al server.
  if (!n.ok) throw { error: n.errors.join('; '), recoverable: false };
  const badItem = n.payload.items.find((i) => i.invalid);
  if (badItem) throw { error: `item inválido: ${badItem.invalid}`, recoverable: false };
  const canonical = JSON.stringify(n.payload);
  const hash = await sha256Hex(canonical);
  // dedupe por hash del draft: doble click / llamadas concurrentes del mismo
  // payload comparten UNA sola request en vuelo (aunque aún no haya id persistido)
  if (inFlight.has(hash)) return inFlight.get(hash);

  const req = (async () => {
    const { request_id, persisted } = stableRequestId(draftKeyFor(payload.origen), hash, store);
    const ctrl = new AbortController();
    let timer;
    const deadline = new Promise((_, rej) => {
      timer = setTimeout(() => { ctrl.abort(); rej(Object.assign(new Error('timeout'), { name: 'AbortError' })); }, timeoutMs);
    });
    let res, data = null;
    try {
      // el timeout cubre TODA la respuesta: fetch + parse del body, aunque el
      // stream se congele (la race garantiza el corte aun sin signal honorado).
      res = await Promise.race([fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, request_id }),
        signal: ctrl.signal,
      }), deadline]);
      try { data = await Promise.race([res.json(), deadline]); } catch (e) { if (e?.name === 'AbortError') throw e; /* ack ilegible */ }
    } catch (e) {
      throw {
        error: e?.name === 'AbortError' ? 'tiempo de espera agotado — sin confirmación' : 'sin conexión con el servidor',
        recoverable: true, cause: e,
      };
    } finally { clearTimeout(timer); }
    if (!res.ok || data?.accepted !== true || data?.request_id !== request_id || typeof data?.duplicate !== 'boolean') {
      throw {
        error: data?.error || `el servidor no confirmó la solicitud (${res.status})`,
        recoverable: res.status >= 500 || res.status === 0,
        status: res.status,
      };
    }
    if (!persisted) data.persistence_warning = true;
    return data;
  })();

  inFlight.set(hash, req); // set inmediato — sin await entre check y set
  try { return await req; } finally { inFlight.delete(hash); }
}

export const __test = { stableRequestId, inFlight, DRAFT_KEY, draftKeyFor, memoryDrafts };
