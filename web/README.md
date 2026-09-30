# AIRO Color Lab — Web

Sitio de una página (sábana) en React + Vite. Diseño boutique: paleta AIRO, Rockwell + Inter, microinteracciones pulidas.

## Comandos

```bash
npm install     # instalar dependencias
npm run dev     # desarrollo → http://localhost:5173
npm run build   # producción → dist/
npm run preview # previsualizar el build
```

## Datos

- **Catálogo:** `src/data/catalogo.json` (12 productos reales del Excel `AIRO_DB_Productos`).
- **Imágenes:** `public/imagenes/productos/` (rutas tipo `/imagenes/productos/lanyard.jpg`).
- **Admin:** `http://localhost:5173/#/admin` — edita el catálogo en borrador local, exporta el JSON y reemplazá el archivo para publicar.
- **Leads:** `src/lib/leads.js`. Sin env vars → POST al Apps Script (Sheets). Con `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` → INSERT a tabla `leads` (DDL en `../db/schema.sql`).
- **Contacto ofuscado:** teléfono/email en Base64 en `src/lib/secure.js`.

## Hosting gratuito

| Servicio | Cómo |
| --- | --- |
| **Vercel** | `npm i -g vercel` → `vercel` en `web/` |
| **Netlify** | drag & drop de `dist/` en app.netlify.com |
| **Cloudflare Pages** | conectar repo, build `npm run build`, output `dist` |
| **GitHub Pages** | repo público + `base: '/repo/'` en vite.config |

## Estructura

```
src/
├─ data/catalogo.json     # "tabla" productos
├─ lib/ (catalog, leads, secure)
├─ context/CartContext.jsx # brief en localStorage 'airo_cart_b2b'
├─ hooks/useReveal.js      # reveals con stagger
├─ components/             # Nav, Hero, Marquee, ValueProps, Lifestyle,
│                          # Process, Catalog, QuickView, CartDrawer,
│                          # Contact, Faq, Footer
└─ admin/Admin.jsx         # CRUD del catálogo (borrador + export JSON)
```
