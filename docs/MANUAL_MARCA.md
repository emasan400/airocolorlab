# AIRO Color Lab — Manual de Marca y Community Management

> Documento canónico para humanos y agentes que produzcan contenido de marca
> (redes sociales, SEO, email, ads). Toda la información proviene de las fuentes
> reales del proyecto; si algo acá contradice el sitio, gana el sitio y este
> manual debe actualizarse.

---

## 1. Identidad

| Campo | Valor |
|---|---|
| Nombre de marca | **AIRO Color Lab** (escrito "AIRO" en mayúsculas + "Color Lab") |
| Rubro | Estudio B2B de producción y personalización textil |
| Propuesta de valor | "Calidad de fábrica, sin los mínimos de fábrica" — producción flexible desde 10 unidades |
| Tagline del hero | "Hacé que tu marca no pase desapercibida." |
| Ubicación | Buenos Aires, Argentina — envíos a todo el país |
| Sitio | https://airocolorlab.vercel.app/ |
| Instagram | https://www.instagram.com/airocolorlab/ (@airocolorlab) |
| Canal comercial principal | **WhatsApp** (todas las conversiones cierran ahí) |
| Modelo de negocio | B2B puro: marcas, empresas, eventos, equipos. **No es ecommerce ni retail** |

### Conceptos centrales de marca

- **Objetos que se conservan**: el merchandising como pieza de diseño, no como descartable.
- **Estudio, no imprenta**: se habla de "proyectos" y "asesoramiento", no de "impresiones".
- **Accesible sin ser barato**: mínimos bajos (10 uds.) pero calidad premium.
- **In-house**: equipo de diseño propio que adapta o crea arte para el cliente.

---

## 2. Identidad visual

### Paleta (tokens exactos del CSS)

| Token | Hex | Uso |
|---|---|---|
| `--blue` | `#1A4295` | Color primario de marca, CTAs, enlaces, acentos |
| `--cyan` | `#00B4D8` | Acento brillante — **solo sobre fondos oscuros** o gráficos; nunca texto sobre claro (contraste insuficiente) |
| `--cyan-ink` | `#0E7490` | Variante del cyan con contraste AA (5.4:1) — usar para texto cyan sobre fondo claro |
| `--ink` | `#111111` | Texto principal |
| `--paper` | `#FFFFFF` | Fondo principal |
| `--neutral` | `#F4F6F8` | Fondos de sección alternados, inputs, cards |

### Tipografía

| Uso | Familia |
|---|---|
| Display / títulos | `Rockwell` → fallback `Zilla Slab` → `Georgia`, serif. Peso 500, tracking -0.015em |
| Cuerpo / UI | `Inter` → `system-ui`, sans-serif |

**En piezas para redes:** usar Zilla Slab (disponible en Google Fonts) para títulos e Inter para cuerpo — son los equivalentes accesibles de la stack web.

### Estilo visual

- Editorial / fashion-forward: tipografía masiva, mucho aire, hero full-bleed.
- Radios: 10 / 16 / 24px. Sombras suaves azuladas.
- Imágenes de producto sobre fondos neutros, nunca sobre colores saturados que compitan con la paleta.

---

## 3. Voz y tono

| Regla | Detalle |
|---|---|
| Idioma | Español rioplatense, **voseo** ("hacé", "contanos", "tu marca") |
| Registro | Profesional pero cercano. Segunda persona del singular ("vos/tu") |
| Léxico propio | "cotización" (nunca "carrito" ni "compra"), "proyecto", "producción a pedido", "pedido mínimo 10 unidades" |
| Promesa concreta | "Respuesta en menos de 24 hs hábiles" |
| Evitar | Jerga de ecommerce ("agregar al carrito", "checkout", "oferta flash"), exclamaciones excesivas, anglicismos innecesarios |

### Ejemplos de copy aprobado

- "Sumá productos del catálogo para arrancar tu cotización."
- "Un asesor de AIRO revisará tu proyecto."
- "Merchandising corporativo e indumentaria a medida para marcas, eventos y empresas."
- "Diseñamos objetos que la gente quiere conservar."

---

## 4. Audiencias

1. **Marcas y pymes** que necesitan merch propio sin volúmenes de fábrica.
2. **Empresas / RRHH**: packs de onboarding, uniformes, regalos corporativos.
3. **Eventos**: lanyards, pulseras, cintas para medallas, acreditación.
4. **Emprendedores textil**: etiquetas de composición, cintas, insumos para marca propia.

---

## 5. Catálogo (fuente de contenido de producto)

Categorías: `merchandising` · `indumentaria` · `packs`

Productos activos al momento de este manual (fuente: `web/src/data/catalogo.json`):

- **Merchandising**: Lanyards Oficiales (badge "Top"), Cintas para Medallas, Cintas Mochileras, Correas para Mascotas, Tote Bags, Etiquetas de Composición, Banderines de Argentina, Metros de Cinta Sublimada, Fundas para Libros.
- **Indumentaria**: Remeras Personalizadas (algodón peinado, DTF, S–XXL), Buzos Rústicos y Friza.
- **Packs**: Pack Bienvenida/Onboarding, Pack Evento, Pack Uniforme de Equipo, Pack Marca Propia.

Técnicas de personalización mencionadas en specs: sublimación 360°/full color, DTF, corte por calor. Materiales: poliéster premium, algodón peinado.

> El catálogo es administrable: los agentes deben leer `catalogo.json` (o la tabla `productos` de Supabase en producción) como fuente de verdad antes de generar contenido de producto.

---

## 6. Pilares de contenido para CM

| Pilar | % sugerido | Ideas |
|---|---|---|
| Producto en contexto | 30% | Packs armados, mockups con logo, antes/después de personalización |
| Proceso / detrás de escena | 20% | Sublimación en curso, control de calidad, armado de pedidos |
| Clientes y casos | 15% | Proyectos entregados, testimonios, marcas que confiaron |
| Educativo B2B | 20% | "Cuánto merch pedir para un evento de 200 personas", guías de técnicas (DTF vs sublimación), qué pedir para onboarding |
| Oferta comercial | 15% | Novedades de catálogo, mínimos flexibles, packs destacados |

### Convenciones de publicación

- CTA único por pieza, siempre hacia WhatsApp o al formulario de cotización.
- Hashtags sugeridos: #MerchandisingCorporativo #IndumentariaPersonalizada #MerchandisingArgentina #Branding #AIROColorLab
- Formato prioridad: carruseles (antes/después, procesos) y Reels cortos de producción.
- Nunca prometer precios en publicaciones — los precios son a medida por volumen; derivar a cotización.

---

## 7. SEO

| Ítem | Estado / regla |
|---|---|
| Title | "AIRO Color Lab \| Merchandising Corporativo e Indumentaria Personalizada" (verificar en `web/index.html`) |
| Meta description | Merchandising corporativo e indumentaria a medida para marcas, eventos y empresas. Desde 10 unidades. Buenos Aires. |
| Keywords naturales | merchandising corporativo, indumentaria personalizada, remeras personalizadas, lanyards personalizados, regalos empresariales, packs onboarding, Buenos Aires |
| Estructura | SPA con hash routing — el contenido indexable vive en una sola URL; priorizar Instagram/Google Business Profile para alcance orgánico |
| Reglas de copy | alt text descriptivo en toda imagen de producto; headings jerárquicos; nunca keyword stuffing |

---

## 8. Datos operativos para agentes

### Datos de contacto del negocio

- Email: reconstruido en runtime por `web/src/lib/secure.js` (anti-scraping). El agente puede leer la constante del footer/contacto en el sitio publicado.
- WhatsApp comercial: `+54 9 11 6355 3443` (formato wa.me: `5491163553443`). Todos los CTAs cierran acá.

### Reglas duras del sitio (no romper en contenido)

- Pedido mínimo: **10 unidades por producto**, cantidades en múltiplos de 10.
- Sin precios públicos: todo es "cotización a medida" hasta que exista tabla de precios.
- Lead time de respuesta prometido: 24 hs hábiles.
- Datos personales: consentimiento obligatorio (Ley 25.326), link a `#/privacidad`.
- El sitio es estático (Vercel); el catálogo puede vivir en `catalogo.json` o en Supabase según entorno.

### Stack técnico (contexto para agentes dev)

- React 19 + Vite 7, SPA con hash routing (`#/privacidad`, `#/admin`).
- Sin librerías de UI ni de animación: todo CSS propio en `web/src/styles.css`.
- Supabase (opcional): catálogo + leads. Admin en `#/admin`.
- CI: `npm run check` (anchors, imágenes, alt, secrets) + `npm run build` en cada push.
- Deploy: push a `main` → Vercel automático.

### Comandos útiles

```bash
cd web
npm run dev      # desarrollo local
npm run check    # verificaciones de calidad
npm run build    # build de producción
```

---

## 9. Checklist pre-publicación (para cualquier pieza de contenido)

- [ ] ¿Usa voseo y el tono del manual?
- [ ] ¿Respeta la paleta (cyan solo sobre oscuro / cyan-ink sobre claro)?
- [ ] ¿El CTA lleva a WhatsApp o a la cotización?
- [ ] ¿No promete precios ni plazos que el sitio no promete?
- [ ] ¿El producto mencionado existe y está activo en el catálogo?
- [ ] ¿Las imágenes usadas son del catálogo o material propio autorizado?
