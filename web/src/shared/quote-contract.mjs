// Contrato compartido de cotización — puro (browser + Node, sin deps).
// Validación ESTRICTA: strings fuera de cap → error explícito (nunca truncar),
// tipos erróneos → error, preview raster con firma real verificada.
// La normalización canónica (sorted items) la usa idéntico el cliente para
// hashear el draft y el server para el payload — mismo shape, mismo hash.
// Nunca confía en título/precio/stock del cliente.

export const CONSENT_VERSION = '2026-10-07';
export const MIN_QTY = 10;
export const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_PREVIEW_BYTES = 300 * 1024;
export const MAX_LOGO_ORIGINAL_BYTES = 3 * 1024 * 1024;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateQuantity(q) {
  if (!Number.isSafeInteger(q)) return { error: 'cantidad debe ser un número entero' };
  if (q < MIN_QTY) return { error: `cantidad mínima ${MIN_QTY}` };
  if (q % MIN_QTY !== 0) return { error: `cantidad debe ser múltiplo de ${MIN_QTY}` };
  return { ok: true };
}

// Texto tipeado → entero EXACTO (solo dígitos; '10.5'/'1e3'/'010x' → null).
// Nunca coerciona ni redondea: lo inválido queda inválido.
export function parseQuantityText(s) {
  if (typeof s !== 'string' || !/^\d+$/.test(s.trim())) return null;
  const n = Number(s.trim());
  return Number.isSafeInteger(n) ? n : null;
}

// --- preview raster referencial ---
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const decodeB64 = (s) =>
  (typeof Buffer !== 'undefined' ? Buffer.from(s, 'base64') : Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
const MAGIC = {
  png: [0x89, 0x50, 0x4e, 0x47],
  jpeg: [0xff, 0xd8, 0xff],
  webp: null, // RIFF....WEBP
};
function checkSignature(sub, bytes) {
  if (sub === 'webp')
    return bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  const m = MAGIC[sub];
  return m.every((b, i) => bytes[i] === b);
}

export function validatePreview(p, producto) {
  if (p === null || p === undefined) return { ok: true, preview: null };
  if (typeof p !== 'object' || Array.isArray(p)) return { error: 'preview inválido' };
  // Whitelist estricta — nunca se persisten propiedades desconocidas.
  const { logo_data_url, x, y, scale, rotation, background, version } = p;
  if (version !== 'v1') return { error: 'preview.version debe ser "v1"' };
  if (logo_data_url != null) {
    if (typeof logo_data_url !== 'string') return { error: 'logo_data_url debe ser data URL' };
    const m = logo_data_url.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/i);
    if (!m) return { error: 'logo_data_url debe ser data URL PNG/JPEG/WebP' };
    if (!B64_RE.test(m[2])) return { error: 'logo_data_url base64 inválido' };
    let bytes;
    try { bytes = decodeB64(m[2]); } catch { return { error: 'logo_data_url no decodifica' }; }
    if (bytes.length > MAX_PREVIEW_BYTES)
      return { error: `logo excede ${Math.round(MAX_PREVIEW_BYTES / 1024)}KB — reducilo e intentá de nuevo` };
    if (!checkSignature(m[1].toLowerCase(), bytes))
      return { error: 'el contenido del logo no corresponde a un PNG/JPEG/WebP real' };
  }
  for (const [k, v, lo, hi] of [['x', x, 0, 100], ['y', y, 0, 100], ['scale', scale, 0.3, 2.5], ['rotation', rotation, -45, 45]]) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi)
      return { error: `preview.${k} fuera de rango ${lo}..${hi}` };
  }
  // background EXACTO: una de las URLs locales del propio producto — no arbitrarias.
  const allowed = new Set([producto?.imagen_principal, ...(producto?.galeria || [])].filter(Boolean));
  if (!allowed.has(background))
    return { error: 'preview.background debe ser una imagen de galería del producto' };
  return {
    ok: true,
    preview: { logo_data_url: logo_data_url ?? null, x, y, scale, rotation, background, version: 'v1' },
  };
}

const findProducto = (catalog, id) =>
  (catalog || []).find((p) => p.id_producto === id);

// {ok, item} | {error} — error incluye status 422 para item inválido
// | {needs_review, reason} para producto desconocido/inactivo (migración/storage)
export function validateItem(raw, catalog) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'item inválido', status: 422 };
  const p = findProducto(catalog, raw.id);
  if (!p) return { needs_review: true, reason: `producto desconocido: ${raw.id}` };
  if (p.activo !== true) return { needs_review: true, reason: `producto inactivo: ${raw.id}` };

  const q = validateQuantity(raw.cantidad);
  if (q.error) return { error: `${p.nombre}: ${q.error}`, status: 422 };

  const variant = raw.variant == null ? null : (typeof raw.variant === 'string' ? raw.variant.trim() : null);
  if (raw.variant != null && variant === null) return { error: `${p.nombre}: variante debe ser texto`, status: 422 };
  if (variant && !(p.colores || []).includes(variant))
    return { error: `${p.nombre}: variante no permitida "${variant}"`, status: 422 };

  const pv = validatePreview(raw.preview, p);
  if (pv.error) return { error: `${p.nombre}: ${pv.error}`, status: 422 };

  const cid = raw.configuration_id == null ? null : (typeof raw.configuration_id === 'string' ? raw.configuration_id : null);
  if (raw.configuration_id != null && cid === null) return { error: 'configuration_id debe ser texto', status: 422 };
  if (cid && cid.length > 80) return { error: 'configuration_id demasiado largo', status: 422 };

  return {
    ok: true,
    item: {
      id: p.id_producto,
      titulo: variant ? `${p.nombre} (${variant})` : p.nombre,
      cantidad: raw.cantidad,
      variant,
      configuration_id: cid,
      preview: pv.preview,
    },
  };
}

// Migra selección legacy {id,titulo,cantidad} conservando variante inferida del
// título exacto "Nombre (Color)" cuando el color existe en el producto;
// si no encaja con certeza → needs_review (nunca olvida el color original).
export function migrateItem(raw, catalog) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'item inválido' };
  const p = findProducto(catalog, raw.id);
  let variant = raw.variant ?? null;
  if (p && variant == null && typeof raw.titulo === 'string') {
    const m = raw.titulo.match(/^(.*)\s\(([^)]+)\)$/);
    if (m && m[1] === p.nombre) {
      variant = (p.colores || []).includes(m[2]) ? m[2] : null;
      if (variant === null)
        return { needs_review: true, reason: `${p.nombre}: variante legacy "${m[2]}" no reconocida` };
    }
  }
  return validateItem({ ...raw, variant }, catalog);
}

const CONTACT_FIELDS = [
  ['origen', 60], ['nombre', 120], ['empresa', 120], ['whatsapp', 40], ['email', 160],
  ['ciudad', 120], ['fecha_estimada', 40], ['objetivo', 120], ['diseno', 120],
  ['comentarios', 2000], ['carrito', 4000],
];
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

// Normaliza el payload a su forma canónica (items ORDENADOS — estable para hash).
// Rechaza caps/types explícitamente; no trunca silenciosamente.
export function normalizePayload(raw, catalog) {
  const errs = [];
  const contact = {};
  for (const [k, max] of CONTACT_FIELDS) {
    const v = raw?.[k];
    if (v == null) { contact[k] = ''; continue; }
    if (typeof v !== 'string') { errs.push(`${k}: debe ser texto`); continue; }
    const t = v.trim();
    if (t.length > max) { errs.push(`${k}: supera ${max} caracteres`); continue; }
    contact[k] = t;
  }
  const rawItems = raw?.items == null ? [] : raw.items;
  const items = [];
  if (!Array.isArray(rawItems)) errs.push('items: debe ser array');
  else for (const i of rawItems) {
    const r = validateItem(i, catalog);
    items.push(r.ok ? r.item : { invalid: r.error || r.reason });
  }
  items.sort((a, b) =>
    String(a.id ?? '').localeCompare(String(b.id ?? '')) ||
    String(a.configuration_id ?? '').localeCompare(String(b.configuration_id ?? '')));
  return {
    ok: errs.length === 0, errors: errs,
    payload: { ...contact, items, consent: raw?.consent === true, consent_version: CONSENT_VERSION },
  };
}

// Validación completa server-side del POST /api/quote.
export function validateQuote(raw, catalog) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { error: 'payload inválido', status: 400 };
  if (JSON.stringify(raw).length > MAX_PAYLOAD_BYTES)
    return { error: 'payload supera el límite de 2MB', status: 413 };
  if (raw.consent !== true) return { error: 'consent requerido', status: 400 };
  if (raw.website) return { error: 'rechazado', status: 400 }; // honeypot
  if (raw.request_id != null && !UUID_RE.test(raw.request_id))
    return { error: 'request_id debe ser UUID canónico', status: 400 };

  const n = normalizePayload(raw, catalog);
  if (!n.ok) return { error: n.errors.join('; '), status: 400 };
  if (!n.payload.nombre) return { error: 'nombre requerido', status: 400 };
  const phoneDigits = n.payload.whatsapp.replace(/\D/g, '');
  const hasPhone = phoneDigits.length >= 8;
  const hasEmail = EMAIL_RE.test(n.payload.email);
  // Campo provisto pero inválido → error aunque el otro sea válido.
  if (n.payload.whatsapp && !hasPhone) return { error: 'whatsapp debe tener al menos 8 dígitos', status: 400 };
  if (n.payload.email && !hasEmail) return { error: 'email inválido', status: 400 };
  if (!hasPhone && !hasEmail)
    return { error: 'se requiere WhatsApp (≥8 dígitos) o email válido', status: 400 };
  for (const it of n.payload.items)
    if (it.invalid) return { error: `item inválido: ${it.invalid}`, status: 422 };
  return { ok: true, payload: n.payload }; // canonical ya normalizado/ordenado
}
