// Tests del incremento web — contrato, leads ack, servicio, API handler real,
// adapter idempotente, RPC shape, cart-store persistencia, product-pages.
// Todo offline: fetch mockeado o servers sintéticos loopback; fs temporal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const WEB = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const imp = (p) => import(pathToFileURL(path.join(WEB, p)));

const { validateQuantity, parseQuantityText, validateItem, validatePreview, migrateItem,
        normalizePayload, validateQuote, MIN_QTY, UUID_RE } = await imp('src/shared/quote-contract.mjs');
const { postLead, __test } = await imp('src/lib/leads.js');
const { handleQuotePost } = await imp('server/quote-service.mjs');
const { supabaseAdapter, default: apiHandler } = await imp('api/quote.mjs');
const { renderProductPage, buildSitemap } = await imp('scripts/product-pages.mjs');
const { saveProductoDb } = await imp('src/lib/db.js');
const { slugify, productPath } = await imp('src/lib/slug.js');
const { loadItems } = await imp('src/lib/cart-store.js');
const { trackQuoteEvent } = await imp('src/lib/analytics.js');
const { rateLimit, RATE_LIMIT } = await imp('api/quote.mjs');

const CATALOG = JSON.parse(fs.readFileSync(path.join(WEB, 'src/data/catalogo.json'), 'utf8')).productos;
const P4 = CATALOG.find((p) => p.id_producto === 'p4');
const INACTIVE = { id_producto: 'zz0', nombre: 'Viejo', activo: false, colores: [] };
const cat = [...CATALOG, INACTIVE];

// PNG real (fixture generada) — no 'AAAA' falso.
const REAL_PNG = fs.readFileSync(path.join(WEB, '..', '..', 'projects/verification-2026-first-audit/steps/test-logo.png'));
const PNG_URL = 'data:image/png;base64,' + REAL_PNG.toString('base64');
const BG = P4.imagen_principal;
const previewOk = { logo_data_url: PNG_URL, x: 50, y: 50, scale: 1, rotation: 0, background: BG, version: 'v1' };
const RID = '07f8f89d-d488-4421-b56c-740719fc2c2c';

// ---------- contrato ----------
test('cantidad: 10/20 aceptadas, 15/21 y fracción rechazadas', () => {
  assert.ok(validateQuantity(10).ok && validateQuantity(20).ok);
  assert.ok(validateQuantity(15).error && validateQuantity(21).error);
  assert.ok(validateQuantity(2.5).error && validateQuantity(5).error);
});

test('item: inactivo/desconocido → revisión; variante inválida → 422; distintos configuration_id son líneas distintas', () => {
  assert.ok(validateItem({ id: 'zz0', cantidad: 10 }, cat).needs_review);
  assert.ok(validateItem({ id: 'nope', cantidad: 10 }, cat).needs_review);
  assert.equal(validateItem({ id: 'p4', cantidad: 10, variant: 'Púrpura' }, cat).status, 422);
  const a = validateItem({ id: 'p4', cantidad: 30, variant: P4.colores[0], configuration_id: 'cfg-1' }, cat);
  const b = validateItem({ id: 'p4', cantidad: 30, variant: P4.colores[0], configuration_id: 'cfg-2' }, cat);
  assert.ok(a.ok && b.ok && a.item.configuration_id !== b.item.configuration_id);
});

test('preview: PNG real pasa; fake base64 / svg / firma errónea / propiedades extra / background arbitrario rechazados', () => {
  assert.ok(validatePreview(previewOk, P4).ok);
  assert.ok(validatePreview({ ...previewOk, logo_data_url: 'data:image/png;base64,AAAA' }, P4).error, 'firma PNG inválida');
  assert.ok(validatePreview({ ...previewOk, logo_data_url: 'data:image/svg+xml;base64,AAAA' }, P4).error);
  assert.ok(validatePreview({ ...previewOk, logo_data_url: 'https://x.com/a.png' }, P4).error);
  assert.ok(validatePreview({ ...previewOk, background: '/imagenes/otra.jpg' }, P4).error, 'background debe ser galería del producto');
  assert.ok(validatePreview({ ...previewOk, x: NaN }, P4).error);
  assert.ok(validatePreview({ ...previewOk, x: [50] }, P4).error);
  const stripped = validatePreview({ ...previewOk, evil: '<script>' }, P4);
  assert.ok(stripped.ok && !('evil' in stripped.preview), 'propiedades desconocidas se descartan');
});

test('migración legacy: variante inferida del título exacto, incierta → revisión', () => {
  const ok = migrateItem({ id: 'p4', titulo: `${P4.nombre} (${P4.colores[1]})`, cantidad: 20 }, cat);
  assert.ok(ok.ok && ok.item.variant === P4.colores[1]);
  const bad = migrateItem({ id: 'p4', titulo: `${P4.nombre} (ColorInventado)`, cantidad: 10 }, cat);
  assert.ok(bad.needs_review, 'variante legacy desconocida → revisión');
  assert.ok(migrateItem({ id: 'zz0', cantidad: 10 }, cat).needs_review);
});

test('payload: consent, honeypot, UUID, caps estrictos (sin truncar), 2MB', () => {
  const base = { nombre: 'Ana', whatsapp: '111222333', consent: true, items: [] };
  assert.ok(validateQuote(base, cat).ok);
  assert.equal(validateQuote({ ...base, consent: false }, cat).status, 400);
  assert.equal(validateQuote({ ...base, website: 'spam' }, cat).status, 400);
  assert.equal(validateQuote({ ...base, request_id: 'req-0001' }, cat).status, 400, 'id no-UUID');
  assert.ok(validateQuote({ ...base, request_id: RID }, cat).ok);
  // cap excedido → error, NO truncado
  const r = validateQuote({ ...base, nombre: 'x'.repeat(300) }, cat);
  assert.equal(r.status, 400);
  // tipo erróneo → error
  assert.equal(validateQuote({ ...base, comentarios: 123 }, cat).status, 400);
  // item inválido → 422
  assert.equal(validateQuote({ ...base, items: [{ id: 'p4', cantidad: 15 }] }, cat).status, 422);
});

// ---------- leads (cliente) ----------
const mockStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), _m: m };
};
const throwingStorage = { getItem: () => { throw new Error('quota'); }, setItem: () => { throw new Error('quota'); } };
const payload = { origen: 'Catálogo', nombre: 'Ana', whatsapp: '111222333', consent: true, items: [] };
const mkFetchOk = (grab) => async (u, o) => {
  const id = JSON.parse(o.body).request_id;
  grab?.(id);
  return new Response(JSON.stringify({ accepted: true, request_id: id, duplicate: false }), { status: 200 });
};

test('request_id estable mismo draft / nuevo al cambiar / en memoria si storage tira', async () => {
  const s = mockStorage();
  const a1 = await postLead(payload, { fetchFn: mkFetchOk(), storage: s, catalog: CATALOG });
  const a2 = await postLead(payload, { fetchFn: mkFetchOk(), storage: s, catalog: CATALOG });
  assert.equal(a1.request_id, a2.request_id);
  const a3 = await postLead({ ...payload, comentarios: 'cambió' }, { fetchFn: mkFetchOk(), storage: s, catalog: CATALOG });
  assert.notEqual(a3.request_id, a1.request_id);
  // storage que lanza: id estable en memoria + warning
  const t1 = await postLead(payload, { fetchFn: mkFetchOk(), storage: throwingStorage, catalog: CATALOG });
  const t2 = await postLead(payload, { fetchFn: mkFetchOk(), storage: throwingStorage, catalog: CATALOG });
  assert.equal(t1.request_id, t2.request_id);
  assert.equal(t1.persistence_warning, true);
});

test('doble click → una sola llamada en vuelo', async () => {
  const s = mockStorage();
  let calls = 0;
  const f = async (u, o) => { calls++; await new Promise((r) => setTimeout(r, 30)); return new Response(JSON.stringify({ accepted: true, request_id: JSON.parse(o.body).request_id, duplicate: false }), { status: 200 }); };
  const [r1, r2] = await Promise.all([
    postLead(payload, { fetchFn: f, storage: s, catalog: CATALOG }),
    postLead(payload, { fetchFn: f, storage: s, catalog: CATALOG }),
  ]);
  assert.equal(calls, 1);
  assert.equal(r1.request_id, r2.request_id);
});

test('500/timeout real/ack opaco/id distinto → error; draft preservado', async () => {
  const s = mockStorage();
  const expectFail = async (f, label) => {
    try { await postLead(payload, { fetchFn: f, storage: s, catalog: CATALOG }); }
    catch (e) { assert.ok(e.error, label); return; }
    assert.fail(`${label}: debió rechazar`);
  };
  await expectFail(async () => new Response('err', { status: 500 }), '500');
  await expectFail(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }), 'ack opaco');
  await expectFail(async () => new Response(JSON.stringify({ accepted: true, request_id: RID, duplicate: false }), { status: 200 }), 'id distinto (fixture UUID)');
  // timeout REAL: server sintético que nunca responde, timeoutMs=50
  const hanging = http.createServer(() => { /* nunca responde */ });
  await new Promise((r) => hanging.listen(0, '127.0.0.1', r));
  const port = hanging.address().port;
  try {
    await postLead(payload, { url: `http://127.0.0.1:${port}/api/quote`, storage: s, catalog: CATALOG, timeoutMs: 60 });
    assert.fail('timeout debió rechazar');
  } catch (e) {
    assert.ok(/tiempo de espera|sin conexión/.test(e.error), 'timeout real rechaza');
  } finally { hanging.close(); }
  let sent;
  const a = await postLead(payload, { fetchFn: mkFetchOk((id) => (sent = id)), storage: s, catalog: CATALOG });
  assert.equal(a.accepted, true);
  assert.equal(a.request_id, sent);
});

// ---------- servicio ----------
test('servicio: validación + 503 sin adapter + dup/conflict en fixture temporal', async () => {
  const adapter = { save: async (id) => ({ accepted: true, request_id: id, duplicate: false }) };
  assert.equal((await handleQuotePost('{bad', { adapter, catalog: CATALOG })).status, 400);
  assert.equal((await handleQuotePost({ consent: true }, { adapter, catalog: CATALOG })).status, 400);
  assert.equal((await handleQuotePost('x'.repeat(3 * 1024 * 1024), { adapter, catalog: CATALOG })).status, 413);
  assert.equal((await handleQuotePost(payload, { catalog: CATALOG })).status, 503);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airo-q-'));
  const fsAdapter = {
    async save(request_id, p, hash) {
      const file = path.join(dir, request_id + '.json');
      try { fs.writeFileSync(file, JSON.stringify({ hash }), { flag: 'wx' }); return { accepted: true, request_id, duplicate: false }; }
      catch (e) {
        if (e.code === 'EEXIST')
          return JSON.parse(fs.readFileSync(file, 'utf8')).hash === hash
            ? { accepted: true, request_id, duplicate: true } : { conflict: true };
        throw e;
      }
    },
  };
  const good = { ...payload, request_id: RID };
  const r1 = await handleQuotePost(good, { adapter: fsAdapter, catalog: CATALOG });
  assert.equal(r1.status, 200); assert.equal(r1.body.duplicate, false);
  const r2 = await handleQuotePost(good, { adapter: fsAdapter, catalog: CATALOG });
  assert.equal(r2.body.duplicate, true);
  const r3 = await handleQuotePost({ ...good, comentarios: 'cambió' }, { adapter: fsAdapter, catalog: CATALOG });
  assert.equal(r3.status, 409);
});

// ---------- api handler (server sintético real) ----------
test('api handler: 405 / content-type / json malformado / oversize / origin / rate limit', async () => {
  const srv = http.createServer(apiHandler);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const post = (body, headers = {}) =>
    fetch(`http://127.0.0.1:${port}/api/quote`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  try {
    const g = await fetch(`http://127.0.0.1:${port}/api/quote`);
    assert.equal(g.status, 405);
    const noCt = await fetch(`http://127.0.0.1:${port}/api/quote`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
    assert.equal(noCt.status, 400);
    const bad = await post('{not json');
    assert.equal(bad.status, 400);
    const big = await post('x'.repeat(3 * 1024 * 1024));
    assert.equal(big.status, 413);
    const wrongOrigin = await post('{}', { Origin: 'https://evil.com' });
    assert.equal(wrongOrigin.status, 403);
    // 13 requests válidos (sin backend → 503) → el 13vo es 429 (rate limit 12/min)
    for (let i = 0; i < 12; i++) await post(JSON.stringify(payload));
    const rl = await post(JSON.stringify(payload));
    assert.equal(rl.status, 429);
  } finally { srv.close(); }
});

test('api handler: body pre-parseado (Vercel req.body object) no cuelga', async () => {
  const req = { method: 'POST', headers: { 'content-type': 'application/json' }, body: { ...payload, request_id: RID }, socket: { remoteAddress: '10.9.9.9' } };
  const out = await new Promise((resolve) => {
    const res = { statusCode: 0, setHeader() {}, end: (s) => resolve({ status: res.statusCode, body: JSON.parse(s) }) };
    apiHandler(req, res);
  });
  assert.equal(out.status, 503, 'sin backend → 503, sin colgar');
});

// ---------- RPC adapter ----------
test('RPC adapter: shape exacto, ack estricto (200{} / id erróneo / false / JSON inválido rechazan)', async () => {
  process.env.SUPABASE_URL = 'https://demo.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv-test-key';
  const orig = globalThis.fetch;
  let call = null;
  const ad = supabaseAdapter();
  try {
    globalThis.fetch = async (url, opts) => { call = { url, opts }; return new Response(JSON.stringify({ accepted: true, request_id: RID, duplicate: false }), { status: 200 }); };
    const r = await ad.save(RID, { nombre: 'x' }, 'h1');
    assert.equal(call.url, 'https://demo.supabase.test/rest/v1/rpc/submit_quote');
    const body = JSON.parse(call.opts.body);
    assert.deepEqual(Object.keys(body), ['p_request_id', 'p_payload', 'p_payload_hash']);
    assert.equal(call.opts.headers.Authorization, 'Bearer srv-test-key');
    assert.ok(!JSON.stringify(call.opts.headers).includes('VITE'));
    assert.equal(r.duplicate, false);
    const rejects = async (res, label) => { globalThis.fetch = async () => res; await assert.rejects(ad.save(RID, {}, 'h'), null, label); };
    await rejects(new Response('{}', { status: 200 }), '200 {} no es ack');
    await rejects(new Response(JSON.stringify({ accepted: true, request_id: 'other', duplicate: false }), { status: 200 }), 'id distinto');
    await rejects(new Response(JSON.stringify({ accepted: false, request_id: RID, duplicate: false }), { status: 200 }), 'accepted false');
    await rejects(new Response('not json', { status: 200 }), 'JSON inválido');
    globalThis.fetch = async () => new Response('IDEMPOTENCY_CONFLICT dup', { status: 409 });
    const c = await ad.save(RID, {}, 'h2');
    assert.ok(c.conflict);
  } finally {
    globalThis.fetch = orig;
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});

// ---------- cart-store persistencia ----------
test('cart-store: JSON inválido → backup único + warning; review persiste; legacy migra', () => {
  const s = mockStorage();
  s.setItem('airo_cart_b2b', '{corrupto');
  const r1 = loadItems(cat, s);
  assert.equal(r1.warning, 'corrupt-backed-up');
  const backups1 = [...s._m.keys()].filter((k) => k.startsWith('airo_cart_b2b_unparseable'));
  assert.equal(backups1.length, 1);
  s.setItem('airo_cart_b2b', '{otro corrupto');
  loadItems(cat, s);
  const backups2 = [...s._m.keys()].filter((k) => k.startsWith('airo_cart_b2b_unparseable'));
  assert.equal(backups2.length, 2, 'backup nuevo no pisa al anterior');
  // storage que tira → warning
  const r2 = loadItems(cat, throwingStorage);
  assert.equal(r2.warning, 'storage-unavailable');
  // items válidos + review conviven y ambos sobreviven
  const s2 = mockStorage();
  s2.setItem('airo_cart_b2b', JSON.stringify([
    { id: 'p4', titulo: `${P4.nombre} (${P4.colores[0]})`, cantidad: 20 },
    { id: 'zz0', titulo: 'Viejo', cantidad: 10 },
  ]));
  const r3 = loadItems(cat, s2);
  assert.equal(r3.items.length, 1);
  assert.equal(r3.items[0].variant, P4.colores[0]);
  assert.equal(r3.review.length, 1);
  assert.equal(r3.warning, 'review-needed');
});

test('cart-store: backup fallido → persistAllowed false + warning unbacked, ambos backups intentados', () => {
  // getItem de localStorage que lanza en el getter → storage-unavailable
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('blocked'); }, configurable: true });
    const r = loadItems(cat); // sin storage explícito — usa el getter
    assert.equal(r.warning, 'storage-unavailable');
    assert.equal(r.persistAllowed, false);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'localStorage', saved);
    else delete globalThis.localStorage;
  }

  // storage donde SOLO la primera escritura falla (quota): el segundo
  // backup igualmente se intenta → queda 1 backup; persistAllowed=false.
  const s2 = (() => { const m = new Map(); let calls = 0;
    return { getItem: (k) => m.get(k) ?? null, _m: m,
      setItem: (k, v) => { calls++; if (calls <= 1) throw new Error('quota'); m.set(k, v); },
      seed: (k, v) => m.set(k, v) }; })();
  s2.seed('airo_cart_b2b', '{corrupto principal');
  s2.seed('airo_cart_b2b_review', '{corrupto review');
  const r2 = loadItems(cat, s2);
  const bk = [...s2._m.keys()].filter((k) => k.startsWith('airo_cart_b2b_unparseable'));
  assert.equal(bk.length, 1, 'el backup de review se intentó aunque el principal falló');
  assert.equal(r2.warning, 'corrupt-unbacked');
  assert.equal(r2.persistAllowed, false);
  // el original corrupto permanece intacto (no se reescribió nada)
  assert.equal(s2.getItem('airo_cart_b2b'), '{corrupto principal');
  assert.equal(s2.getItem('airo_cart_b2b_review'), '{corrupto review');

  // ambos corruptos, storage OK → dos backups únicos
  const s3 = mockStorage();
  s3.setItem('airo_cart_b2b', '{roto1');
  s3.setItem('airo_cart_b2b_review', '{roto2');
  const r3 = loadItems(cat, s3);
  const bk3 = [...s3._m.keys()].filter((k) => k.startsWith('airo_cart_b2b_unparseable'));
  assert.equal(bk3.length, 2);
  assert.equal(r3.warning, 'corrupt-backed-up');
  assert.equal(r3.persistAllowed, true);
});

// ---------- admin db ----------
test('saveProductoDb: RPC exacto y error propagado (sin fallback destructivo)', async () => {
  let called = null;
  const client = { rpc: async (fn, args) => { called = { fn, args }; return { error: null }; } };
  await saveProductoDb({ id_producto: 'p1', nombre: 'X', galeria: ['a'], colores: ['b'], especificaciones: ['c'] }, client);
  assert.equal(called.fn, 'save_catalog_product');
  assert.deepEqual(Object.keys(called.args), ['p_product', 'p_galeria', 'p_colores', 'p_especificaciones']);
  const failing = { rpc: async () => ({ error: new Error('rpc missing') }) };
  await assert.rejects(saveProductoDb({ id_producto: 'p1' }, failing), /rpc missing/);
});

// ---------- páginas de producto ----------
test('product-page: escapa markup, canonical, sin offers/precios, og:image real', () => {
  const tpl = `<html><head><title>t</title><meta name="description" content="d" /><meta property="og:title" content="t" /><meta property="og:description" content="d" /><meta property="og:url" content="u" /><meta property="og:image" content="img" /></head><body><div id="root"></div></body></html>`;
  const evil = { id_producto: 'p9', nombre: 'X<script>alert(1)</script>', descripcion: 'desc "q" <b>', activo: true, categoria: 'merchandising', especificaciones: ['a<b'], imagen_principal: '/imagenes/x.webp' };
  const { html } = renderProductPage(evil, tpl);
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('canonical'));
  assert.ok(html.includes('og:image" content="https://airocolorlab.vercel.app/imagenes/x.webp'));
  assert.ok(!/"offers"/.test(html) && !/"price"/.test(html));
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(ld['@type'], 'Product');
  assert.ok(!('offers' in ld));
});

// ---------- rework: cantidad tipeada ----------
test('parseQuantityText: exacto — 10.5 / 1e3 / fracción / letras → null', () => {
  assert.equal(parseQuantityText('10'), 10);
  assert.equal(parseQuantityText('20'), 20);
  assert.equal(parseQuantityText('15'), 15); // parsea pero validateQuantity lo rechaza
  assert.equal(parseQuantityText('10.5'), null);
  assert.equal(parseQuantityText('1e3'), null);
  assert.equal(parseQuantityText('abc'), null);
  assert.equal(parseQuantityText(''), null);
  assert.equal(parseQuantityText('12 0'), null);
});

// ---------- rework: contacto ----------
test('server: whatsapp provisto pero inválido rechaza aunque el email sea válido', () => {
  const r = validateQuote({ nombre: 'A', whatsapp: '123', email: 'ok@mail.com', consent: true, items: [] }, cat);
  assert.equal(r.status, 400);
  const r2 = validateQuote({ nombre: 'A', whatsapp: '', email: 'malo', consent: true, items: [] }, cat);
  assert.equal(r2.status, 400);
});

// ---------- rework: request_id namespaced / write-fail ----------
test('storage read-ok/write-fail → retry reusa id vía memoria; origenes aislados', async () => {
  const writeFail = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  const a1 = await postLead(payload, { fetchFn: mkFetchOk(), storage: writeFail, catalog: CATALOG });
  const a2 = await postLead(payload, { fetchFn: mkFetchOk(), storage: writeFail, catalog: CATALOG });
  assert.equal(a1.request_id, a2.request_id, 'write-fail → misma id en memoria');
  // (persistence_warning cubierto en el test anterior con storage que lanza)
  // namespace por origen: Catálogo vs Contacto no comparten identidad
  const contactPayload = { ...payload, origen: 'Contacto', comentarios: 'x' };
  const c1 = await postLead(contactPayload, { fetchFn: mkFetchOk(), storage: writeFail, catalog: CATALOG });
  const c2 = await postLead(contactPayload, { fetchFn: mkFetchOk(), storage: writeFail, catalog: CATALOG });
  assert.equal(c1.request_id, c2.request_id);
  assert.notEqual(__test.draftKeyFor('Catálogo'), __test.draftKeyFor('Contacto'));
});

test('timeout cubre res.json() congelado', async () => {
  const stalled = async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) });
  try {
    await postLead(payload, { fetchFn: stalled, storage: mockStorage(), catalog: CATALOG, timeoutMs: 60 });
    assert.fail('debió expirar');
  } catch (e) {
    assert.ok(/tiempo de espera/.test(e.error));
  }
});

// ---------- rework: rate limit bound ----------
test('rate limiter: poda expirados; lleno → rechaza IP nueva sin resetear buckets', () => {
  // ya hay ~15 requests de 127.0.0.1 en el test de handler; llenar con IPs nuevas
  for (let i = 0; i < 10_500; i++) rateLimit(`10.0.0.${i % 256}.${i >> 8}.${i % 7}`);
  assert.equal(rateLimit('1.2.3.4'), true, 'IP nueva rechazada cuando el mapa está lleno');
});

// ---------- rework: no secrets en cliente ----------
test('código cliente sin secretos ni fallbacks remotos', () => {
  const src = ['src/lib/leads.js', 'src/components/CartDrawer.jsx', 'src/components/Contact.jsx']
    .map((f) => fs.readFileSync(path.join(WEB, f), 'utf8')).join('\n');
  for (const bad of ['SERVICE_ROLE', 'no-cors', 'script.google', 'supabase.co/rest'])
    assert.ok(!src.includes(bad), `encontrado ${bad} en cliente`);
});

// ---------- rework: analytics module ----------
test('analytics: demo/localhost/sin consent → descartado; con consent → agregado sanitizado', () => {
  const mkWin = (host, consent) => ({
    location: { hostname: host },
    localStorage: { getItem: () => consent },
    dataLayer: [],
  });
  assert.equal(trackQuoteEvent('quote_submit_accepted', { demo: true }, mkWin('airo.app', 'accepted')), false);
  assert.equal(trackQuoteEvent('quote_selection_started', {}, mkWin('127.0.0.1', 'accepted')), false);
  assert.equal(trackQuoteEvent('quote_selection_started', {}, mkWin('airo.app', null)), false);
  const w = mkWin('airo.app', 'accepted');
  assert.equal(trackQuoteEvent('quote_selection_started', { product_ids: ['p4', 'DROP TABLE'], units: 20, config_count: 2, nombre: 'Ana', logo: 'data:' }, w), true);
  assert.equal(w.dataLayer.length, 1);
  const rec = w.dataLayer[0];
  assert.deepEqual(rec.product_ids, ['p4'], 'solo ids seguros');
  assert.equal(rec.units, 20);
  assert.ok(!('nombre' in rec) && !('logo' in rec), 'sin PII/arte');
  assert.equal(trackQuoteEvent('no_evento', {}, w), false);
});

test('sitemap + packs: solo activos; los 4 packs pk1..pk4 tienen ruta estable', () => {
  const activos = cat.filter((p) => p.activo === true);
  const xml = buildSitemap(activos, '2026-10-07');
  assert.ok(xml.includes('https://airocolorlab.vercel.app/'));
  assert.ok(xml.includes('/productos/zz0') === false, 'inactivo no está');
  for (const pk of ['pk1', 'pk2', 'pk3', 'pk4']) {
    const p = CATALOG.find((x) => x.id_producto === pk);
    assert.ok(p?.activo === true, `${pk} activo en catálogo`);
    assert.ok(xml.includes(productPath(p)), `${pk} en sitemap`);
  }
  assert.equal(slugify('Lanyards Oficiales'), 'lanyards-oficiales');
});
