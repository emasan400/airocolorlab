-- ============================================================
-- Patch idempotente de RLS + GRANTs — AIRO Color Lab
-- Correr en el SQL Editor si el insert a leads devuelve 42501.
-- Seguro de ejecutar varias veces.
-- ============================================================

-- Asegurar RLS habilitado en todas las tablas
alter table productos enable row level security;
alter table producto_imagenes enable row level security;
alter table producto_colores enable row level security;
alter table producto_especificaciones enable row level security;
alter table leads enable row level security;

-- Catálogo: lectura pública, escritura solo autenticados
drop policy if exists catalogo_lectura_publica on productos;
drop policy if exists catalogo_escritura_admin on productos;
create policy "catalogo_lectura_publica" on productos
  for select to anon, authenticated using (true);
create policy "catalogo_escritura_admin" on productos
  for all to authenticated using (true) with check (true);

drop policy if exists imagenes_lectura_publica on producto_imagenes;
drop policy if exists imagenes_escritura_admin on producto_imagenes;
create policy "imagenes_lectura_publica" on producto_imagenes
  for select to anon, authenticated using (true);
create policy "imagenes_escritura_admin" on producto_imagenes
  for all to authenticated using (true) with check (true);

drop policy if exists colores_lectura_publica on producto_colores;
drop policy if exists colores_escritura_admin on producto_colores;
create policy "colores_lectura_publica" on producto_colores
  for select to anon, authenticated using (true);
create policy "colores_escritura_admin" on producto_colores
  for all to authenticated using (true) with check (true);

drop policy if exists espec_lectura_publica on producto_especificaciones;
drop policy if exists espec_escritura_admin on producto_especificaciones;
create policy "espec_lectura_publica" on producto_especificaciones
  for select to anon, authenticated using (true);
create policy "espec_escritura_admin" on producto_especificaciones
  for all to authenticated using (true) with check (true);

-- Leads: insert público (formularios del sitio), lectura solo autenticados
drop policy if exists leads_insert_publico on leads;
drop policy if exists leads_lectura_admin on leads;
create policy "leads_insert_publico" on leads
  for insert to anon, authenticated with check (true);
create policy "leads_lectura_admin" on leads
  for select to authenticated using (true);

-- GRANTs para la Data API
grant select on productos, producto_imagenes, producto_colores,
  producto_especificaciones to anon, authenticated;
grant insert on leads to anon, authenticated;
grant select, insert, update, delete on productos, producto_imagenes,
  producto_colores, producto_especificaciones to authenticated;
grant select, delete on leads to authenticated;
