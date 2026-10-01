# AIRO Color Lab — Matriz de seguridad y cumplimiento

Documento de postura de seguridad del sistema. Mapea los controles
implementados contra ISO/IEC 27001:2022, NIST CSF 2.0 y MITRE ATT&CK,
y declara el alcance de MITRE ATLAS.

---

## 1. Alcance e inventario de activos

| Activo | Clasificación | Ubicación | Dueño |
| --- | --- | --- | --- |
| Código fuente (SPA React/Vite) | Interno / público (repo) | GitHub `emasan400/airocolorlab` | Estudio |
| Catálogo de productos | Público | Postgres (Supabase) + `catalogo.json` | Estudio |
| Leads (nombre, empresa, WhatsApp, email, ciudad) | **PII — Confidencial** | Tabla `leads` (Supabase) | Estudio |
| Sesión admin (JWT Supabase Auth) | Secreto | Browser del admin (memoria + storage de Supabase) | Supabase Auth |
| `VITE_SUPABASE_ANON_KEY` (publishable) | Público por diseño | Bundle del navegador | — |
| `SUPABASE_SECRET_KEY` | **Secreto crítico** | Nunca en el repo ni en el frontend | Supabase dashboard |
| Imágenes de productos | Público | `web/public/imagenes/` | Estudio |

**Arquitectura de confianza:**

```
Browser pública ──(publishable key → rol anon)──► Supabase
   │                                              ├─ SELECT productos (RLS público)
   │                                              └─ INSERT leads (RLS público)
   │
Admin (login) ────(JWT → rol authenticated)─────► Supabase
                                                  ├─ CRUD catálogo (RLS autenticado)
                                                  └─ SELECT leads
```

---

## 2. ISO/IEC 27001:2022 — Annex A (controles relevantes)

| Control | Estado | Implementación |
| --- | --- | --- |
| A.5.19 Relaciones con proveedores | ✅ | Supabase (DB/Auth) y Vercel (hosting) como proveedores gestionados; SLA y postura de seguridad delegada a plataformas con SOC 2 |
| A.5.23 Seguridad en servicios cloud | ✅ | RLS en Postgres, sin superficie de servidor propio |
| A.8.2 Gestión de acceso privilegiado | ✅ | Escritura restringida a rol `authenticated`; `secret key` rotada tras exposición y excluida del repo |
| A.8.3 Restricción de acceso a la información | ✅ | RLS: `leads` insert-público / lectura solo autenticados; catálogo lectura pública / escritura autenticada |
| A.8.9 Gestión de configuración | ✅ | Headers de seguridad en `web/vercel.json`; `.env` excluido de versionado (`.gitignore` verificado en commit) |
| A.8.11 Enmascaramiento de datos | ⚠️ Parcial | Teléfono/email ofuscados en Base64 (anti-scraping, **no** es cifrado — se declara como control de divulgación mínima, no confidencialidad) |
| A.8.12 Prevención de fuga de datos | ✅ | `leads` sin policy de SELECT para `anon`: el contenido PII no es enumerable vía API |
| A.8.24 Uso de criptografía | ✅ | TLS 1.3 + HSTS preload (Vercel); contraseñas gestionadas por Supabase Auth (bcrypt) |
| A.8.25 Ciclo de vida de desarrollo seguro | ✅ | Separación dev/prod (`localhost` vs dominio), builds reproducibles, secretos fuera del código |
| A.8.26 Requisitos de seguridad en aplicaciones | ✅ | Validación de formularios client-side; límites de payload por esquema de tabla |
| A.8.27 Arquitectura segura | ✅ | SPA estática sin backend propio → superficie de ataque reducida a CDN + API gestionada |
| A.8.28 Codificación segura | ✅ | Sin `dangerouslySetInnerHTML`; React escapa contenido por defecto (anti-XSS); queries parametrizadas vía PostgREST |
| A.5.31 Requisitos legales (PII) | ✅ | Consentimiento explícito (Ley 25.326) obligatorio en formularios; PII de leads solo legible por admin autenticado |

---

## 3. NIST CSF 2.0

| Función | Implementación |
| --- | --- |
| **Govern** | Roles definidos: único admin autenticado; políticas de datos en `GESTION-DE-DATOS.md`; este documento como baseline |
| **Identify** | Inventario de activos §1; modelo de amenazas en §4; superficie = SPA + PostgREST + Auth |
| **Protect** | RLS en todas las tablas; least-privilege por rol (`anon`/`authenticated`); CSP estricta sin `unsafe-inline` en scripts; secrets fuera del repo; MFA disponible en Supabase Auth (recomendado activar) |
| **Detect** | Supabase Auth logs (intentos de login); advisors de seguridad del dashboard; GTM para anomalías de tráfico. ⚠️ Sin alertas activas — revisión manual |
| **Respond** | Rotación de secret key ya ejercida (procedimiento validado); rollback por Git (`git revert` + push → redeploy); ban de usuarios en Supabase Auth |
| **Recover** | Backup de catálogo vía "Backup JSON" en admin; `db/seed.sql` reconstruye el catálogo; código en GitHub |

---

## 4. MITRE ATT&CK — técnicas relevantes y mitigaciones

| Técnica | Vector | Mitigación aplicada |
| --- | --- | --- |
| T1190 Exploit Public-Facing Application | La SPA no ejecuta código de servidor propio | Sin endpoints custom: PostgREST + RLS gestionado; sin uploads públicos de archivos |
| T1552 / T1539 Robo de credenciales | Keys en el bundle del navegador | Solo publishable key (privilegio `anon` limitado por RLS); secret key nunca en cliente; rotada tras exposición |
| T1189 Drive-by Compromise | XSS via contenido inyectado | CSP con `script-src 'self'`; React escapa strings; `X-Content-Type-Options: nosniff` |
| T1535 Unused/unsupported regions / embedding | Clickjacking del sitio | `frame-ancestors 'none'` + `X-Frame-Options: DENY` |
| T1056 Input Capture | Formularios de leads | Datos viajan por TLS directo a Supabase; sin trackers de terceros además de GTM |
| T1565 Data Manipulation | Escritura maliciosa al catálogo | RLS: writes solo `authenticated`; JWT con expiración corta (Supabase default 1h) |
| T1498/T1499 DoS / abuso del insert público | Spam a `leads` | PostgREST rate limiting de Supabase; ⚠️ recomendado: honeypot en formularios (ver §6) |
| T1602 / datos de configuración | `.env` en repo | `.gitignore` verificado; `.env` nunca commiteado; `sb_secret` nunca en disco del proyecto |

## 5. MITRE ATLAS

**No aplica.** El sistema no contiene componentes de IA/ML: no hay
modelos, inferencia, embeddings, prompts ni pipelines de datos de
entrenamiento. Si se agregara una función con IA (p.ej. asistente de
cotización), este documento debe revisarse contra ATLAS.

---

## 6. Riesgos residuales y recomendaciones

| Prioridad | Ítem | Acción sugerida |
| --- | --- | --- |
| ~~Alta~~ | ~~Spam al insert público de `leads`~~ | ✅ Implementado: honeypot `website` oculto en ambos formularios — los bots lo completan y el submit se descarta silenciosamente |
| ~~Alta~~ | ~~Aviso de privacidad~~ | ✅ Implementado: checkbox de consentimiento (Ley 25.326) obligatorio en Contacto y Carrito antes de enviar |
| Media | MFA del admin | Activar MFA en Supabase Auth para el usuario admin |
| Media | Base64 ≠ cifrado | El teléfono/email son públicos por diseño del negocio; la ofuscación solo frena scraping — no tratar como control de confidencialidad |
| Media | Monitoreo | Revisión mensual de Security Advisors en Supabase + logs de Auth |
| Baja | JSON-LD / rich results | Diferido: requeriría hash CSP adicional o `unsafe-inline` para `application/ld+json` |
| Baja | Imágenes externas en `img-src https:` | Deliberadamente permisivo (el admin puede registrar URLs externas); endurecer a dominios propios si se migra todo a Supabase Storage |

## 7. Procedimientos operativos

- **Rotar secret key**: Dashboard → Settings → API Keys → crear nueva → eliminar la vieja (no la usa el frontend).
- **Revocar acceso admin**: Authentication → Users → ban/delete. La sesión JWT expira sola en ~1h.
- **Rollback de deploy**: `git revert <commit> && git push` (Vercel redeploya) o "Instant Rollback" en el dashboard.
- **Backup de catálogo**: Admin → "Backup JSON" (snapshot descargable); `db/seed.sql` reconstruye.
- **Incidente de fuga de credencial**: rotar key → revisar logs de Auth/DB en Supabase → `git log` para verificar qué se versionó.
