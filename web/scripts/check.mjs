// Checks de calidad del proyecto (corre en CI):
//  1. Anchors internos href="#x" → existe un id="x"
//  2. Rutas /imagenes/... referenciadas → el archivo existe en public/
//  3. Toda <img> tiene atributo alt
//  4. Sin secrets conocidos hardcodeados en src/
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const SRC = join(root, 'src');
const PUB = join(root, 'public');
const ROUTES = ['#/', '#/admin', '#/privacidad', '#/terminos'];

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (['.jsx', '.js', '.json', '.css'].includes(extname(p))) files.push(p);
  }
})(SRC);
files.push(join(root, 'index.html'));

let errors = 0;
const fail = (file, msg) => { console.error(`✗ ${file.replace(root, '')}: ${msg}`); errors++; };

// ids y anchors
const ids = new Set();
const anchors = [];
for (const f of files) {
  if (f.endsWith('.json') || f.endsWith('.css')) continue;
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bid="([^"]+)"/g)) ids.add(m[1]);
  for (const m of src.matchAll(/href=["'`]#([^"'`]+)["'`]/g)) anchors.push([f, '#' + m[1]]);
}
for (const [f, a] of anchors) {
  if (a === '#' || ROUTES.some((r) => a.startsWith(r))) continue;
  if (!ids.has(a.slice(1))) fail(f, `anchor "${a}" sin id destino`);
}

// rutas de imagen (ignorando placeholders y textos de ayuda <code>)
for (const f of files) {
  const src = readFileSync(f, 'utf8')
    .replace(/placeholder="[^"]*"/g, '')
    .replace(/<code>[^<]*<\/code>/g, '');
  for (const m of src.matchAll(/\/imagenes\/[\w\-/.]+\.(?:jpg|jpeg|png|webp|svg|avif)/g)) {
    if (!existsSync(join(PUB, m[0]))) fail(f, `imagen inexistente: ${m[0]}`);
  }
}

// alt en <img>
for (const f of files) {
  if (!f.endsWith('.jsx')) continue;
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt=/.test(m[0])) fail(f, `<img> sin alt: ${m[0].slice(0, 80)}`);
  }
}

// secrets conocidos
for (const f of files.filter((x) => x.endsWith('.js') || x.endsWith('.jsx'))) {
  const src = readFileSync(f, 'utf8');
  if (/sb_secret_|service_role|sk_live_|-----BEGIN (RSA |EC )?PRIVATE KEY/.test(src)) {
    fail(f, 'posible secret hardcodeado');
  }
}

if (errors) {
  console.error(`\n${errors} problema(s) encontrado(s)`);
  process.exit(1);
}
console.log('✓ checks OK: anchors, imágenes, alt text, secrets');
