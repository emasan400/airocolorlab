// Post-build: genera /productos/{id}-{slug}/index.html por producto ACTIVO
// con contenido semántico prerenderizado (nombre/desc/specs escapados),
// canonical + OG + JSON-LD Product SIN offers/prices/ratings, y reescribe
// sitemap.xml con home + URLs de producto solamente.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { productPath } from '../src/lib/slug.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(DIR, '..');
const DIST = path.join(WEB, 'dist');
const BASE = 'https://airocolorlab.vercel.app';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const catalogo = JSON.parse(readFileSync(path.join(WEB, 'src/data/catalogo.json'), 'utf8'));
const activos = (catalogo.productos || []).filter((p) => p.activo);

export function renderProductPage(p, template) {
  const pathRel = productPath(p); // /productos/{id}-{slug}/
  const url = BASE + pathRel;
  const title = `${p.nombre} — AIRO Color Lab`;
  const desc = `${p.descripcion || p.nombre} Producción a pedido, mínimo 10 unidades, cotización a medida.`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.nombre,
    description: p.descripcion || undefined,
    image: p.imagen_principal ? [BASE + p.imagen_principal] : undefined,
    brand: { '@type': 'Brand', name: 'AIRO Color Lab' },
    category: p.categoria || undefined,
    // sin offers/price/rating — los precios son por cotización, nunca inventados
  };
  const prerender = `
    <article class="product-prerender">
      <h1>${esc(p.nombre)}</h1>
      <p>${esc(desc)}</p>
      ${p.especificaciones?.length ? `<ul>${p.especificaciones.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      <p>Pedido mínimo 10 unidades · múltiplos de 10 · precios por cotización.</p>
    </article>`;

  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(desc)}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(desc)}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${esc(url)}" />`)
    .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${esc(p.imagen_principal ? BASE + p.imagen_principal : BASE + '/imagenes/hero/hero-1.jpg')}" />`)
    .replace('</head>', `  <link rel="canonical" href="${esc(url)}" />\n  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${prerender}</div>`);
  return { html, pathRel };
}

export function buildSitemap(activos, today = new Date().toISOString().slice(0, 10)) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${activos.map((p) => `  <url>
    <loc>${BASE}${productPath(p)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>
`;
}

function main() {
  const template = readFileSync(path.join(DIST, 'index.html'), 'utf8');
  let written = 0;
  for (const p of activos) {
    const { html, pathRel } = renderProductPage(p, template);
    const dir = path.join(DIST, pathRel);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), html);
    written++;
  }
  writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap(activos));
  console.log(`product-pages: ${written} páginas + sitemap (${activos.length} productos activos)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
