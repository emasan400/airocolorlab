-- ============================================================
-- AIRO Color Lab — schema para Supabase/Postgres
-- Modelo relacional + RLS + GRANTs + índices.
-- Revisado con las agent-skills oficiales de Supabase:
--  · RLS habilitado en TODA tabla del schema public
--  · Policies con TO (auth.role() está deprecado)
--  · GRANTs explícitos para la Data API
--  · Índices en claves foráneas
-- ============================================================

create table productos (
  id_producto   text primary key,              -- 'p1', 'p2', ...
  categoria     text not null check (categoria in ('indumentaria', 'merchandising', 'packs')),
  badge         text,
  nombre        text not null,
  descripcion   text,
  precio        numeric,                       -- null mientras sea modo cotización
  cantidad      integer,                       -- null = sin stock gestionado
  imagen_principal text,                       -- ruta o URL
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table producto_imagenes (
  id            bigint generated always as identity primary key,
  id_producto   text not null references productos(id_producto) on delete cascade,
  ruta          text not null,
  orden         int not null default 0
);

create table producto_colores (
  id            bigint generated always as identity primary key,
  id_producto   text not null references productos(id_producto) on delete cascade,
  nombre        text not null,
  orden         int not null default 0
);

create table producto_especificaciones (
  id            bigint generated always as identity primary key,
  id_producto   text not null references productos(id_producto) on delete cascade,
  detalle       text not null,
  orden         int not null default 0
);

create table leads (
  id            bigint generated always as identity primary key,
  origen        text not null,                 -- 'Contacto' | 'Catálogo'
  nombre        text not null,
  empresa       text,
  whatsapp      text,
  email         text,
  ciudad        text,
  fecha_estimada text,
  objetivo      text,
  diseno        text,
  comentarios   text,
  carrito       text,
  created_at    timestamptz not null default now()
);

-- Índices en claves foráneas (joins del admin/modal) y orden de leads
create index producto_imagenes_prod_idx on producto_imagenes(id_producto);
create index producto_colores_prod_idx on producto_colores(id_producto);
create index producto_espec_prod_idx on producto_especificaciones(id_producto);
create index productos_categoria_idx on productos(categoria) where activo;
create index leads_created_idx on leads(created_at desc);

-- ============================================================
-- RLS — toda tabla expuesta lleva políticas explícitas.
-- Modelo de acceso: catálogo = lectura pública, escritura solo
-- usuarios autenticados (el admin del estudio). leads = insert
-- público (formularios), lectura solo autenticados.
-- ============================================================

alter table productos enable row level security;
alter table producto_imagenes enable row level security;
alter table producto_colores enable row level security;
alter table producto_especificaciones enable row level security;
alter table leads enable row level security;

create policy "catalogo_lectura_publica" on productos
  for select to anon, authenticated using (true);
create policy "catalogo_escritura_admin" on productos
  for all to authenticated using (true) with check (true);

create policy "imagenes_lectura_publica" on producto_imagenes
  for select to anon, authenticated using (true);
create policy "imagenes_escritura_admin" on producto_imagenes
  for all to authenticated using (true) with check (true);

create policy "colores_lectura_publica" on producto_colores
  for select to anon, authenticated using (true);
create policy "colores_escritura_admin" on producto_colores
  for all to authenticated using (true) with check (true);

create policy "espec_lectura_publica" on producto_especificaciones
  for select to anon, authenticated using (true);
create policy "espec_escritura_admin" on producto_especificaciones
  for all to authenticated using (true) with check (true);

create policy "leads_insert_publico" on leads
  for insert to anon, authenticated with check (true);
create policy "leads_lectura_admin" on leads
  for select to authenticated using (true);

-- ============================================================
-- GRANTs — la Data API no expone tablas nuevas por defecto.
-- ============================================================
grant select on productos, producto_imagenes, producto_colores,
  producto_especificaciones to anon, authenticated;
grant insert on leads to anon, authenticated;
grant select, insert, update, delete on productos, producto_imagenes,
  producto_colores, producto_especificaciones to authenticated;
grant select, delete on leads to authenticated;
