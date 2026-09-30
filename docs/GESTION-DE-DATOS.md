# AIRO Color Lab — Gestión de datos: parámetros y estándares

Documento de uso. Define cómo se modelan, cargan y mantienen los datos del
sistema, y cómo se gestiona el acceso (identidades).

---

## 1. Modelo de datos: `productos`

Fuente de verdad: `web/src/data/catalogo.json` → array `productos[]`.

| Campo | Tipo | Oblig. | Reglas |
| --- | --- | --- | --- |
| `id_producto` | string | sí | Único, formato `p<n>` (`p1`…`p12`). No reutilizar IDs eliminados. |
| `categoria` | string | sí | Solo `indumentaria` o `merchandising` (controla los filtros del sitio). |
| `badge` | string \| "" | no | Etiqueta corta visible: `Top`, `Nuevo`, `Eco`, `Marca`, `Insumo`. Vacío = sin badge. |
| `nombre` | string | sí | Nombre comercial corto (≤ 40 chars recomendado). |
| `descripcion` | string | sí | 1–2 líneas; es lo que se ve en la card y el modal. |
| `precio` | number \| null | no | `null` mientras el sitio cotiza (no transaccional). |
| `cantidad` | number \| null | no | `null` = sin gestión de stock. |
| `imagen_principal` | string \| null | no | Ruta `/imagenes/productos/<archivo>` o URL. `null` → placeholder "Imagen próximamente". |
| `galeria` | string[] | no | Rutas extra para el carrusel del modal. Incluir la principal si hay galería. |
| `colores` | string[] | no | Variantes seleccionables en el modal (ej. `["Blanco","Negro"]`). |
| `especificaciones` | string[] | no | Bullets técnicos del modal (sin el `✓`, lo agrega el UI). |
| `activo` | boolean | sí | `false` = existe en el admin pero no se muestra en el sitio. |

### Estándares de imagen

| Regla | Valor |
| --- | --- |
| Ubicación | `web/public/imagenes/productos/` |
| Nombre | `kebab-case`, minúsculas, sin espacios ni acentos: `buzo-capucha.jpg` |
| Formato | `.webp` ideal; `.jpg` aceptable. Evitar `.png` salvo transparencia. |
| Peso máximo | ~300 KB por imagen |
| Dimensión recomendada | 1600 px lado largo |
| Referencia en JSON | Ruta absoluta de app: `/imagenes/productos/nombre.jpg` |

### Ejemplo completo

```json
{
  "id_producto": "p4",
  "categoria": "indumentaria",
  "badge": "Indumentaria",
  "nombre": "Remeras Personalizadas",
  "descripcion": "Remeras personalizadas para marcas, eventos y equipos.",
  "precio": null,
  "cantidad": null,
  "imagen_principal": "/imagenes/productos/remera.jpg",
  "galeria": ["/imagenes/productos/remera.jpg", "/imagenes/productos/buzo-capucha.jpg"],
  "colores": ["Blanco", "Negro", "Gris Melange", "Azul Marino"],
  "especificaciones": ["100% Algodón Peinado", "Moldería Clásica/Oversize", "Estampado DTF", "Talles S al XXL"],
  "activo": true
}
```

---

## 2. Flujo de trabajo del catálogo (modo repo)

```
Editar en #/admin  →  borrador local (preview solo en tu navegador)
                  →  Exportar catalogo.json
                  →  reemplazar web/src/data/catalogo.json
                  →  copiar imágenes nuevas a public/imagenes/productos/
                  →  commit + deploy
```

Reglas:

- **Nunca** editar `catalogo.json` a mano sin pasar por el admin (o validando el
  JSON); un JSON roto tumba el catálogo entero.
- Toda imagen referenciada debe existir en `public/imagenes/productos/` antes
  del deploy — el build no valida rutas.
- `activo: false` es la forma correcta de "pausar" un producto (no borrarlo).

---

## 3. Leads (contacto + brief)

Payload enviado por `postLead()`:

| Campo | Origen |
| --- | --- |
| `origen` | `"Contacto"` \| `"Catálogo"` |
| `nombre` | obligatorio |
| `empresa`, `whatsapp`, `email`, `ciudad`, `fecha_estimada`, `objetivo`, `diseno`, `comentarios` | formulario |
| `carrito` | resumen textual del brief (o `"No aplica"`) |
| `created_at` | se agrega solo en provider Supabase |

Destino según configuración (archivo `.env` en `web/`):

```bash
# Si existen → Supabase
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
# Si no existen → Apps Script → Google Sheets
```

> ⚠️ El Apps Script actual responde "No se encontró la página": el deployment
> está caído. Sin Supabase configurado, los leads no están llegando a ningún lado.

---

## 4. Gestión de identidades (admin)

Estado actual: **`#/admin` es una ruta abierta.** Edita solo un borrador local —
no puede romper datos de visitantes, pero cualquiera con la URL puede entrar.

| Nivel | Qué implica | Cuándo conviene |
| --- | --- | --- |
| **A. Sin login (hoy)** | El admin no es secreto porque solo produce un JSON local; publicar requiere acceso al repo. | Mientras el catálogo viva en el repo. |
| **B. Ocultación básica** | Quitar el link del footer + proteger con Basic Auth del hosting (Netlify/Vercel password protection). | Si querés que la ruta no sea pública. |
| **C. Supabase Auth (al migrar a DB)** | Login email/password en `#/admin`; escritura con sesión; RLS: `productos` read público / write autenticado; `leads` insert público / read autenticado. | Cuando el admin escriba directo a la base — **obligatorio ahí**. |

Para el nivel C se necesita: crear proyecto en supabase.com, correr
`db/schema.sql` y luego `db/seed.sql` (carga los 12 productos actuales) en el
SQL Editor, crear el usuario admin en Authentication → Users, y pasarme
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Con eso cableo login + CRUD
real contra la DB, y el admin deja de depender de exportar archivos.

---

## 5. Datos sensibles

| Dato | Manejo |
| --- | --- |
| Teléfono WhatsApp | Base64 en `src/lib/secure.js` (`atob` en runtime). Nunca en claro en HTML/JS. |
| Email institucional | Igual que teléfono. |
| Keys Supabase | La `anon key` es pública por diseño (la seguridad la dan las policies RLS). La `service key` **jamás** va al frontend. |
| `.env` | No commitear. Está en `.gitignore`. |
