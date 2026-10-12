// Generador one-off de máscaras de prenda para el teñido referencial del mockup.
// Uso (no es parte del build; requiere Playwright instalado FUERA del repo, p.ej. en C:/airo/.tmp-pw):
//   NODE_PATH=C:/airo/.tmp-pw/node_modules node scripts/garment-masks.mjs [nombre...]
// Lee public/imagenes/productos/{nombre}.jpg y escribe
// public/imagenes/productos/mascaras/{nombre}.png (+ overlays de control en OUT).
//
// Máscaras de prenda por textura: la prenda es lisa, el hormigón es granulado.
// garment0 = grain < G && Bs >= Bmin → K componentes más grandes → relleno de huecos
// → cierre r3 → apertura r2 → feather 1px. Salida: PNG RGBA (alfa = máscara) + overlay.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'x.js') : import.meta.url);
const { chromium } = require('playwright');
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(WEB, 'public/imagenes/productos');
const DEST = process.env.DEST || path.join(SRC, 'mascaras');
const OUT = process.env.OUT || path.join(WEB, '.mask-overlays');
mkdirSync(DEST, { recursive: true }); mkdirSync(OUT, { recursive: true });

const CFG = {
  'remera': { G: 2.5, Bmin: 130, K: 1 },
  'buzo-capucha': { G: 2.5, Bmin: 130, K: 1, include: [[712, 160, 95, 95]] },
  'buzo-sin-capucha': { G: 2.5, Bmin: 130, K: 1, G2: 5, include: [[382, 598, 94, 70]] },
  'totes': { G: 2.5, Bmin: 130, K: 1 },
};
const only = process.argv.slice(2);
const names = only.length ? only : Object.keys(CFG);

const b = await chromium.launch({ channel: 'chrome' });
for (const name of names) {
  const cfg = CFG[name];
  const p = await b.newPage();
  const b64 = readFileSync(`${SRC}/${name}.jpg`).toString('base64');
  await p.setContent(`<img id=s src="data:image/jpeg;base64,${b64}">`);
  await p.waitForFunction(() => document.querySelector('#s').complete);
  const r = await p.evaluate((cfg) => {
    const img = document.querySelector('#s'); const W = img.naturalWidth, H = img.naturalHeight, N = W * H;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, W, H).data;
    const B = new Float32Array(N); for (let i = 0; i < N; i++) B[i] = Math.max(d[i*4], d[i*4+1], d[i*4+2]);
    const blur = (src, r) => {
      const I = new Float64Array((W + 1) * (H + 1));
      for (let y = 1; y <= H; y++) { let row = 0; for (let x = 1; x <= W; x++) { row += src[(y-1)*W + x-1]; I[y*(W+1)+x] = I[(y-1)*(W+1)+x] + row; } }
      const out = new Float32Array(N);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x-r), x1 = Math.min(W, x+r+1), y0 = Math.max(0, y-r), y1 = Math.min(H, y+r+1);
        out[y*W+x] = (I[y1*(W+1)+x1] - I[y0*(W+1)+x1] - I[y1*(W+1)+x0] + I[y0*(W+1)+x0]) / ((x1-x0)*(y1-y0));
      }
      return out;
    };
    const Bs = blur(B, 4);
    const B1 = blur(B, 1); const hf = new Float32Array(N); for (let i = 0; i < N; i++) hf[i] = Math.abs(B[i] - B1[i]);
    const grain = blur(hf, 6);
    let m = new Uint8Array(N);
    // dentro de los rects de inclusión se tolera más textura (asas tejidas, forros)
    const inRect = new Uint8Array(N);
    for (const [rx, ry, rw, rh] of cfg.include || [])
      for (let y = ry; y < Math.min(H, ry + rh); y++) for (let x = rx; x < Math.min(W, rx + rw); x++) inRect[y*W+x] = 1;
    for (let i = 0; i < N; i++) m[i] = inRect[i]
      ? ((cfg.includeB != null ? Bs[i] >= cfg.includeB : grain[i] < (cfg.G2 ?? 4.5) && Bs[i] >= cfg.Bmin) ? 1 : 0)
      : ((grain[i] < cfg.G && Bs[i] >= cfg.Bmin) ? 1 : 0);

    const nb = (i, f) => { const x = i % W; if (x > 0) f(i-1); if (x+1 < W) f(i+1); if (i >= W) f(i-W); if (i+W < N) f(i+W); };
    const components = (mask, val) => { // devuelve labels + áreas
      const lab = new Int32Array(N).fill(-1); const areas = []; const q = new Int32Array(N);
      for (let s = 0; s < N; s++) {
        if (mask[s] !== val || lab[s] >= 0) continue;
        const id = areas.length; let h = 0, t = 0; q[t++] = s; lab[s] = id;
        while (h < t) { const i = q[h++]; nb(i, (j) => { if (mask[j] === val && lab[j] < 0) { lab[j] = id; q[t++] = j; } }); }
        areas.push(t);
      }
      return { lab, areas };
    };
    const morph = (mask, r, val) => { // dilata "val" con disco r
      const off = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx*dx + dy*dy <= r*r) off.push([dx, dy]);
      const out = new Uint8Array(mask);
      for (let i = 0; i < N; i++) { if (mask[i] !== val) continue; const x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of off) { const xx = x+dx, yy = y+dy; if (xx >= 0 && xx < W && yy >= 0 && yy < H) out[yy*W+xx] = val; } }
      return out;
    };
    const dilate = (mask, r) => morph(mask, r, 1);
    const erode = (mask, r) => morph(mask, r, 0);

    // apertura leve previa para cortar puentes finos con motas
    m = dilate(erode(m, 2), 2);
    // K componentes más grandes
    { const { lab, areas } = components(m, 1);
      const order = areas.map((a, i) => [a, i]).sort((a, b) => b[0] - a[0]).slice(0, cfg.K).map(([, i]) => i);
      const keep = new Set(order); const out = new Uint8Array(N);
      for (let i = 0; i < N; i++) if (lab[i] >= 0 && keep.has(lab[i])) out[i] = 1; m = out; }
    // recuperar el borde de la prenda (la ventana de grano lo excluye): dilatar y
    // quedarse solo con lo que sigue siendo claro (el hormigón bajo la sombra es oscuro)
    { const Bs1 = blur(B, 1); const dil = dilate(m, cfg.edge ?? 7);
      for (let i = 0; i < N; i++) m[i] = dil[i] && Bs1[i] >= (cfg.edgeB ?? 165) ? 1 : 0; }
    // relleno de huecos: fondo = componentes de 0 que tocan el borde
    { const { lab } = components(m, 0); const border = new Set();
      for (let x = 0; x < W; x++) { if (lab[x] >= 0) border.add(lab[x]); if (lab[(H-1)*W+x] >= 0) border.add(lab[(H-1)*W+x]); }
      for (let y = 0; y < H; y++) { if (lab[y*W] >= 0) border.add(lab[y*W]); if (lab[y*W+W-1] >= 0) border.add(lab[y*W+W-1]); }
      // solo se rellenan huecos chicos o claros (pliegues, costuras, forros); el hormigón
      // encerrado por un asa es grande y oscuro → queda afuera
      const { areas } = components(m, 0); const sumB = new Float64Array(areas.length);
      for (let i = 0; i < N; i++) if (m[i] === 0) sumB[lab[i]] += Bs[i];
      for (let i = 0; i < N; i++) if (m[i] === 0 && !border.has(lab[i])) {
        const id = lab[i]; if (areas[id] < N * 0.015 || sumB[id] / areas[id] >= 190) m[i] = 1; } }
    // cierre r3, apertura r2
    m = erode(dilate(m, 3), 3);
    m = dilate(erode(m, 2), 2);
    // feather 1px
    const A = new Float32Array(N); for (let i = 0; i < N; i++) A[i] = m[i] * 255;
    const Af = blur(A, 1);
    let area = 0; for (let i = 0; i < N; i++) area += m[i];

    const mk = () => { const o = ctx.createImageData(W, H); return o; };
    const mask = mk(); for (let i = 0; i < N; i++) { mask.data[i*4] = 255; mask.data[i*4+1] = 255; mask.data[i*4+2] = 255; mask.data[i*4+3] = Math.round(Af[i]); }
    const ov = mk(); for (let i = 0; i < N; i++) { const a = Af[i] / 255 * 0.45; ov.data[i*4] = Math.round(d[i*4]*(1-a) + 255*a); ov.data[i*4+1] = Math.round(d[i*4+1]*(1-a)); ov.data[i*4+2] = Math.round(d[i*4+2]*(1-a)); ov.data[i*4+3] = 255; }
    const toUrl = (im, type, q) => { const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; c2.getContext('2d').putImageData(im, 0, 0); return c2.toDataURL(type, q).split(',')[1]; };
    return { mask: toUrl(mask, 'image/png'), overlay: toUrl(ov, 'image/jpeg', 0.85), pct: (area / N * 100).toFixed(1) };
  }, cfg);
  writeFileSync(`${DEST}/${name}.png`, Buffer.from(r.mask, 'base64'));
  writeFileSync(`${OUT}/overlay-${name}.jpg`, Buffer.from(r.overlay, 'base64'));
  console.log(name, JSON.stringify(cfg), `prenda ${r.pct}%`, `${(Buffer.from(r.mask, 'base64').length / 1024).toFixed(1)} KB`);
  await p.close();
}
await b.close();
