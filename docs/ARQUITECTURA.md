# AIRO Color Lab — Arquitectura del sistema

Documento técnico. Última actualización: 2026-09-30.

---

## 1. Visión general

Aplicación web de una sola página (SPA) construida con **React 19 + Vite 7**.
Sin backend propio: es un sitio estático que consume un archivo de datos local
(`catalogo.json`) y servicios externos mínimos (WhatsApp, Apps Script/Supabase
para leads, GTM para analytics).

```
┌─────────────────────────────────────────────────────────────┐
│                      NAVEGADOR (cliente)                     │
│                                                             │
│   React SPA                                                 │
│   ├─ Sitio público (#/)                                     │
│   │   Nav · Hero · Marquee · ValueProps · Lifestyle ·       │
│   │   Process · Catalog · Contact · Faq · Footer            │
│   │   + CartDrawer (brief de 3 pasos) + Toast               │
│   └─ Panel Admin (#/admin)                                  │
│       CRUD de catálogo → borrador localStorage → export JSON│
│                                                             │
│   Estado persistente:                                       │
│   ├─ localStorage 'airo_cart_b2b'   (brief del visitante)   │
│   └─ localStorage 'airo_catalog_draft_v1' (borrador admin)  │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
   ┌──────────────────────┐        ┌──────────────────────────┐
   │  Datos estáticos     │        │  Servicios externos      │
   │  (versionados en Git)│        │                          │
   │  src/data/           │        │  wa.me (WhatsApp)        │
   │   catalogo.json      │        │  Apps Script → Sheets    │
   │  public/imagenes/    │        │     (CRM leads, legado)  │
   │   productos/ hero/   │        │  Supabase REST → leads   │
   │   lifestyle/         │        │     (opcional, env vars) │
   └──────────────────────┘        └──────────────────────────┘
```

---

## 2. Estructura de archivos

```
AiroColorLab/
├─ web/                          # la aplicación
│  ├─ index.html                 # entry + GTM + Google Fonts
│  ├─ vite.config.js
│  ├─ package.json
│  ├─ public/
│  │  └─ imagenes/
│  │     ├─ productos/           # fotos de catálogo (servidas como /imagenes/...)
│  │     ├─ hero/                # 5 fotos del crossfade del hero
│  │     └─ lifestyle/           # fotos de secciones editoriales
│  └─ src/
│     ├─ main.jsx                # Router por hash: #/ → App, #/admin → Admin (lazy),
│     │                          # #/privacidad, #/terminos, resto → 404
│     ├─ App.jsx                 # composición del sitio + CartProvider + Toast
│     ├─ styles.css              # design system completo (tokens + componentes)
│     ├─ data/catalogo.json      # "tabla" productos (fuente de verdad)
│     ├─ lib/
│     │  ├─ catalog.js           # lectura catálogo + borrador admin + export/import
│     │  ├─ leads.js             # provider de leads (Supabase | Apps Script)
│     │  └─ secure.js            # teléfono/email ofuscados en Base64 (atob)
│     ├─ context/
│     │  └─ CartContext.jsx      # estado global del brief (localStorage)
│     ├─ hooks/
│     │  └─ useReveal.jsx        # <Reveal>: entradas con IntersectionObserver
│     ├─ components/             # Nav, Hero, Marquee, ValueProps, Lifestyle,
│     │                          # Process, Catalog, QuickView, CartDrawer,
│     │                          # Contact, Faq, Footer
│     └─ admin/Admin.jsx         # panel de gestión del catálogo
├─ db/schema.sql                 # DDL para migrar a una DB real (Supabase/PG)
├─ docs/                         # esta documentación
└─ *.html, *.csv, *.jpg (raíz)   # archivos legacy de la versión Google Sites + insumos
```

---

## 3. Flujos de datos

### 3.1 Catálogo (lectura)

```
catalogo.json  ─┐
                ├─ getTodosProductos() ──► Catalog (grid + filtros + search)
draft localStorage                        QuickView (modal por producto)
(admin only) ──┘
```

- `getTodosProductos()` devuelve el **borrador del admin** si existe en ese
  navegador (`airo_catalog_draft_v1`); si no, el JSON compilado.
- El sitio público filtra `activo === true`.
- Sin requests: el catálogo viaja dentro del bundle (instantáneo).

### 3.2 Brief / carrito (no transaccional)

`CartContext` mantiene `items: [{id, titulo, cantidad}]`:

- `addItem(id, titulo)`: si `id+titulo` ya existe → `cantidad += 10`; si no →
  push `{cantidad: 10}`. Primer item abre el drawer; los siguientes muestran toast.
- Persistencia automática en `localStorage['airo_cart_b2b']` (misma key del sitio
  viejo → los visitantes conservan su brief).
- Drawer de 3 pasos: Selección → Datos (nombre obligatorio) → Detalles → envío.

### 3.3 Leads (escritura)

`postLead(payload)` en `lib/leads.js` con doble provider:

| Condición | Destino |
| --- | --- |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` definidas | `POST {url}/rest/v1/leads` |
| Sin env vars | `POST` Apps Script → Google Sheets (CRM actual) |

Después del POST siempre se abre `wa.me` con el mensaje armado. Teléfono y
email nunca aparecen en claro en el código: Base64 en `lib/secure.js`.

### 3.4 Admin (`#/admin`)

Edición del catálogo sobre un **borrador local**:

1. `Guardar` → escribe `airo_catalog_draft_v1` → el sitio muestra el borrador
   solo en ese navegador (preview real sin afectar visitantes).
2. `Exportar catalogo.json` → descarga el JSON → reemplazar
   `web/src/data/catalogo.json` → commit → deploy.
3. `Descartar borrador` → vuelve al JSON versionado.
4. `Importar JSON` → carga un catalogo.json existente para seguir editándolo.

Las imágenes nuevas se copian a mano a `public/imagenes/productos/` y se
referencian por ruta (`/imagenes/productos/archivo.webp`).

---

## 4. Routing

Hash router mínimo en `main.jsx` (sin react-router):

| URL | Vista |
| --- | --- |
| `#/` o vacío | Sitio público |
| `#/admin` | Panel de administración (chunk lazy: React.lazy + Suspense) |
| `#/privacidad` | Política de privacidad (Ley 25.326) |
| `#/terminos` | Términos y condiciones de servicio |
| cualquier otro `#/...` | Vista 404 (NotFound) |

Los anchors internos (`#coleccion`, `#contacto`...) hacen scroll nativo.
Además `public/404.html` es la página de error estática que sirve Vercel
para rutas inexistentes fuera de la SPA.

## 5. Build y deploy

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/ (estático)
```

Deploy: Vercel / Netlify / Cloudflare Pages / GitHub Pages. Output: `web/dist/`.
Sin server-side rendering ni variables de build obligatorias.

## 6. Decisiones técnicas

- **Sin dependencias de UI** (ni Tailwind ni librerías de componentes): todo el
  diseño vive en `styles.css` con tokens CSS → una sola fuente de verdad.
- **Hash routing** en vez de history routing: funciona en cualquier hosting
  estático sin reglas de rewrite.
- **Catálogo en repo** en vez de API: máxima integridad (producto + imagen se
  despliegan juntos), cero puntos de falla externos, cambios auditables en Git.
- **atob() para contacto**: ofuscación anti-scrapers (no es seguridad, es
  higiene anti-spam).
- **GTM-PSPJ7DSX** conservado del sitio anterior. Se carga **solo tras
  consentimiento**: `public/gtm-init.js` expone `window.__loadGTM()` y el
  banner `CookieConsent` (localStorage `airo_cookie_consent`) decide si
  invocarlo.
- **Code splitting**: el panel admin (`Admin.jsx`) y la capa Supabase
  (`lib/db.js`) son chunks separados que solo se descargan en `#/admin` o
  cuando `loadCatalogo()` detecta las env vars configuradas.
- **Imágenes WebP** en `public/imagenes/` (hero-1.jpg se conserva solo
  como `og:image` por compatibilidad de scrapers).
- **SEO/pública**: `public/robots.txt`, `public/sitemap.xml`,
  `public/favicon.svg`, `public/404.html`.
- **CI**: `.github/workflows/ci.yml` corre `npm run check`
  (`web/scripts/check.mjs`: anchors, rutas de imagen, alt text, secrets)
  + `npm run build` en cada push/PR.
