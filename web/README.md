# AIRO Color Lab — Web

Sitio de una página (sábana) en React + Vite. Diseño boutique: paleta AIRO, Rockwell + Inter, microinteracciones pulidas.

## Comandos

```bash
npm install     # instalar dependencias
npm run dev     # desarrollo → http://localhost:5173
npm run build   # producción → dist/ + páginas de producto + sitemap
npm run preview # previsualizar el build
node --test tests/quote.test.mjs   # regresión del flujo de cotización (24 tests)
npm run check   # checks de anchors, imágenes, alt text y secretos
```

## Cotización y leads

- **Flujo:** selección de productos → configuración con mockup de logo → cotización B2B → envío vía `POST /api/quote` (`api/quote.mjs`, función serverless de Vercel).
- **Persistencia:** el adaptador de `api/quote.mjs` llama a la RPC `submit_quote` de Supabase con `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (secretos **solo de servidor** — nunca `VITE_*` ni en el cliente). Idempotencia por `request_id`; `demo:true` solo en el adapter local.
- **Backend no configurado:** el endpoint responde 503 y el cliente ofrece fallback explícito a WhatsApp con el detalle de la selección — el pedido no se pierde.
- **Requisito previo de producción:** la RPC y columnas de `leads` necesitan la [migración preparada](../db/patch-professional-quote.sql) + provisión del admin UUID — se aplica **manualmente tras revisión/aprobación**, nada se aplica automáticamente.
- **Testing:** usar siempre datos ficticios y no enviar mensajes reales de WhatsApp mientras se prueba.
- **Catálogo:** `src/data/catalogo.json` (12 productos reales del Excel `AIRO_DB_Productos`).
- **Imágenes:** `public/imagenes/productos/` (rutas tipo `/imagenes/productos/lanyard.jpg`).
- **Admin:** `#/admin` — edita el catálogo en borrador local, exporta el JSON y reemplazá el archivo para publicar.
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
