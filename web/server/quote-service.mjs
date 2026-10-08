// Servicio de cotización — validación + dispatch al adapter de persistencia.
// Usado por api/quote.mjs (Vercel) y por el middleware demo de vite.config.
// No hace I/O por sí mismo: el adapter se inyecta.

import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateQuote, MAX_PAYLOAD_BYTES } from '../src/shared/quote-contract.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
let _catalog = null;
export function loadCatalog() {
  if (!_catalog) {
    _catalog = JSON.parse(
      readFileSync(path.join(DIR, '..', 'src', 'data', 'catalogo.json'), 'utf8')
    ).productos;
  }
  return _catalog;
}

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const newRequestId = () => crypto.randomUUID();

// Punto único de entrada: body ya parseado (o string crudo).
// adapter.save(requestId, payload, hash) → {accepted:true, request_id, duplicate}
export async function handleQuotePost(rawBody, { adapter, catalog } = {}) {
  let raw;
  if (typeof rawBody === 'string') {
    if (Buffer.byteLength(rawBody) > MAX_PAYLOAD_BYTES)
      return { status: 413, body: { error: 'payload supera el límite' } };
    try { raw = JSON.parse(rawBody); }
    catch { return { status: 400, body: { error: 'json inválido' } }; }
  } else raw = rawBody;

  const v = validateQuote(raw, catalog ?? loadCatalog());
  if (v.error) return { status: v.status || 400, body: { error: v.error } };

  // Canonical = normalizePayload(validado) — MISMO shape que el cliente hashea.
  const canonical = JSON.stringify(v.payload);
  const hash = sha256(canonical);
  // El cliente siempre provee UUID estable por draft; el server lo reusa.
  // Si viene ausente (documentado), se mintea uno; si viene malformado → 400 en validateQuote.
  const request_id = raw.request_id ?? newRequestId();
  // el adapter se requiere solo DESPUÉS de validar el request — un input
  // inválido siempre recibe su 4xx, nunca un 503 de backend ausente.
  if (!adapter) return { status: 503, body: { error: 'backend no configurado', fallback: 'whatsapp' } };

  try {
    const r = await adapter.save(request_id, v.payload, hash);
    if (r?.conflict) return { status: 409, body: { error: 'request_id en conflicto', request_id } };
    if (r?.invalid)
      return { status: 422, body: { error: r.invalid === 'variant' ? 'variante inválida' : 'producto o cantidad inválida' } };
    if (!r || r.accepted !== true || r.request_id !== request_id)
      return { status: 502, body: { error: 'ack inválido del backend' } };
    return { status: 200, body: { accepted: true, request_id, duplicate: !!r.duplicate, ...(r.demo ? { demo: true } : {}) } };
  } catch (e) {
    if (String(e?.message || e).includes('IDEMPOTENCY_CONFLICT'))
      return { status: 409, body: { error: 'request_id en conflicto', request_id } };
    if (String(e?.message || e) === 'submit_quote_ack_invalid')
      return { status: 502, body: { error: 'ack inválido del backend' } };
    // sin paths internos ni secretos
    return { status: 503, body: { error: 'backend no disponible, reintentar', fallback: 'whatsapp' } };
  }
}
