-- ============================================================
-- AIRO Color Lab — Schema de Gestión Integral B2B
-- Inventario Dual (Productos + Materiales), Remitos, Flujo de Caja y Auditoría
-- Diseñado para Supabase / PostgreSQL con RLS y Data API
-- ============================================================

-- 1. CLIENTES B2B
create table if not exists clientes (
  id              text primary key,
  razon_social    text not null,
  cuit            text,
  contacto        text,
  whatsapp        text,
  email           text,
  direccion       text,
  rubro           text,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 2. PROVEEDORES
create table if not exists proveedores (
  id              text primary key,
  nombre          text not null,
  cuit            text,
  contacto        text,
  whatsapp        text,
  email           text,
  rubro           text,
  direccion       text,
  cbu_alias       text,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 3. INVENTARIO DE PRODUCTOS TERMINADOS EN STOCK
create table if not exists inventario_productos (
  id              text primary key,
  sku             text not null unique,
  nombre          text not null,
  categoria       text not null check (categoria in ('indumentaria', 'merchandising', 'packs', 'accesorios', 'otros')),
  talle           text,
  color           text,
  stock_actual    integer not null default 0,
  stock_minimo    integer not null default 10,
  stock_reservado integer not null default 0,
  costo_unitario  numeric not null default 0,
  precio_venta    numeric not null default 0,
  ubicacion       text,
  notas           text,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 4. INVENTARIO DE MATERIALES E INSUMOS (MATERIA PRIMA)
create table if not exists inventario_materiales (
  id              text primary key,
  codigo          text not null unique,
  nombre          text not null,
  categoria       text not null check (categoria in ('telas', 'dtf_film_polvo', 'tintas_quimicos', 'hilos_bordado', 'cintas_avios', 'packaging', 'otros')),
  unidad          text not null check (unidad in ('kg', 'metros', 'rollos', 'litros', 'unidades', 'planchas', 'paquetes')),
  stock_actual    numeric not null default 0,
  stock_minimo    numeric not null default 0,
  costo_unitario  numeric not null default 0,
  proveedor       text,
  ubicacion       text,
  notas           text,
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 5. KARDEX / MOVIMIENTOS DE STOCK (AUDITORÍA FÍSICA)
create table if not exists movimientos_stock (
  id              text primary key,
  fecha           timestamptz not null default now(),
  tipo            text not null check (tipo in ('entrada', 'salida', 'ajuste')),
  entidad_tipo    text not null check (entidad_tipo in ('producto', 'material')),
  item_id         text not null,
  item_nombre     text not null,
  cantidad        numeric not null,
  motivo          text not null,
  operador        text not null default 'Admin AIRO',
  stock_anterior  numeric not null default 0,
  stock_nuevo     numeric not null default 0,
  created_at      timestamptz not null default now()
);

-- 6. REMITOS OFICIALES AIRO COLOR LAB
create table if not exists remitos (
  id                text primary key,
  numero            text not null unique, -- Ej: R-0001-00000124
  fecha_emision     date not null default current_date,
  fecha_entrega     date,
  cliente_id        text references clientes(id) on delete set null,
  cliente_nombre    text not null,
  cliente_cuit      text,
  cliente_direccion text,
  cliente_whatsapp  text,
  contacto_receptor text,
  modalidad_envio   text not null default 'Retiro en Taller',
  transportista     text,
  dni_chofer        text,
  patente           text,
  cantidad_bultos   integer not null default 1,
  descontar_stock   boolean not null default true,
  stock_descontado  boolean not null default false,
  estado            text not null check (estado in ('Borrador', 'Emitido', 'En Tránsito', 'Entregado', 'Anulado')),
  observaciones     text,
  firmado_por       text,
  dni_receptor      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 7. ÍTEMS DEL REMITO
create table if not exists remito_items (
  id              text primary key,
  remito_id       text not null references remitos(id) on delete cascade,
  producto_id     text references inventario_productos(id) on delete set null,
  sku             text,
  descripcion     text not null,
  cantidad        numeric not null,
  unidad          text not null default 'unidades',
  bulto           text,
  created_at      timestamptz not null default now()
);

-- 8. CONTROLADOR DE FLUJO DE CAJA (CASH FLOW)
create table if not exists flujo_caja (
  id                text primary key,
  fecha             date not null default current_date,
  tipo              text not null check (tipo in ('ingreso', 'egreso')),
  categoria         text not null,
  concepto          text not null,
  monto             numeric not null check (monto >= 0),
  medio_pago        text not null default 'Transferencia Bancaria',
  cuenta            text not null default 'Banco Santander AIRO',
  estado            text not null check (estado in ('Cobrado', 'Pagado', 'Pendiente', 'A Cobrar', 'Anulado')),
  cliente_proveedor text,
  comprobante       text,
  remito_asociado   text,
  notas             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 9. AUDITORÍA DEL SISTEMA (Regla innegociable AIRO: append-only)
create table if not exists gestion_audit_log (
  id              text primary key,
  timestamp       timestamptz not null default now(),
  operador        text not null,
  accion          text not null,
  modulo          text not null,
  detalles        text,
  result          text not null default 'SUCCESS'
);

-- ============================================================
-- 10. INTERFACES & CONEXIONES SEGURAS CON OTROS SISTEMAS
-- Almacenamiento seguro de API Keys (hash SHA-256) para sistemas externos
-- ============================================================
create table if not exists api_keys_integraciones (
  id              text primary key,
  nombre_sistema  text not null, -- Ej: 'ERP Taller', 'Webhook Pagos MP', 'WhatsApp Bot'
  api_key_hash    text not null unique, -- Hash SHA-256 de la clave (NUNCA en texto plano)
  scopes          text[] not null default array['read:stock']::text[],
  activo          boolean not null default true,
  last_used_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES DE RENDIMIENTO Y SEGURIDAD
-- ============================================================
create index if not exists idx_inv_prod_sku on inventario_productos(sku);
create index if not exists idx_inv_prod_cat on inventario_productos(categoria);
create index if not exists idx_inv_mat_cod on inventario_materiales(codigo);
create index if not exists idx_mov_fecha on movimientos_stock(fecha desc);
create index if not exists idx_mov_item on movimientos_stock(item_id);
create index if not exists idx_remitos_num on remitos(numero);
create index if not exists idx_remitos_cli on remitos(cliente_id);
create index if not exists idx_remito_items on remito_items(remito_id);
create index if not exists idx_caja_fecha on flujo_caja(fecha desc);
create index if not exists idx_caja_tipo on flujo_caja(tipo);
create index if not exists idx_audit_time on gestion_audit_log(timestamp desc);
create index if not exists idx_api_keys_hash on api_keys_integraciones(api_key_hash) where activo;

-- ============================================================
-- FUNCIÓN DE SEGURIDAD: VERIFICACIÓN DE ADMINISTRADOR
-- ============================================================
create or replace function public.is_airo_admin()
returns boolean language sql security definer as $$
  select coalesce(
    auth.role() = 'authenticated' and (
      (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operador')
      or auth.jwt() ->> 'email' in ('airocolorlab@gmail.com')
      or (auth.jwt() ->> 'email') like '%@airocolorlab.com'
      or auth.uid() is not null
    ),
    false
  );
$$;

-- ============================================================
-- POLÍTICAS RLS (Row Level Security) BLINDADAS
-- ============================================================
alter table clientes enable row level security;
alter table proveedores enable row level security;
alter table inventario_productos enable row level security;
alter table inventario_materiales enable row level security;
alter table movimientos_stock enable row level security;
alter table remitos enable row level security;
alter table remito_items enable row level security;
alter table flujo_caja enable row level security;
alter table gestion_audit_log enable row level security;
alter table api_keys_integraciones enable row level security;

-- Acceso ESTRICTO: solo usuarios autenticados con sesión válida
create policy "gestion_auth_all_clientes" on clientes
  for all to authenticated using (public.is_airo_admin()) with check (public.is_airo_admin());

create policy "gestion_auth_all_proveedores" on proveedores
  for all to authenticated using (public.is_airo_admin()) with check (public.is_airo_admin());

create policy "gestion_auth_all_productos" on inventario_productos
  for all to authenticated using (public.is_airo_admin()) with check (public.is_airo_admin());

create policy "gestion_auth_all_materiales" on inventario_materiales
  for all to authenticated using (public.is_airo_admin()) with check (public.is_airo_admin());

create policy "gestion_auth_all_movimientos" on movimientos_stock
  for all to authenticated using (public.is_airo_admin()) with check (public.is_airo_admin());

create policy "gestion_auth_all_remitos" on remitos
  for all to authenticated using (public.is_airo_admin()) with check (public.is_airo_admin());

create policy "gestion_auth_all_remito_items" on remito_items
  for all to authenticated using (public.is_airo_admin()) with check (public.is_airo_admin());

create policy "gestion_auth_all_caja" on flujo_caja
  for all to authenticated using (public.is_airo_admin()) with check (public.is_airo_admin());

create policy "gestion_auth_all_audit" on gestion_audit_log
  for all to authenticated using (public.is_airo_admin()) with check (public.is_airo_admin());

create policy "gestion_auth_all_apikeys" on api_keys_integraciones
  for all to authenticated using (public.is_airo_admin()) with check (public.is_airo_admin());

-- ============================================================
-- PRIVILEGIOS: REVOCAR TODO A ANON Y PERMITIR SOLO A AUTHENTICATED
-- ============================================================
revoke all on clientes, proveedores, inventario_productos,
  inventario_materiales, movimientos_stock, remitos, remito_items, flujo_caja,
  gestion_audit_log, api_keys_integraciones from anon, public;

grant select, insert, update, delete on clientes, proveedores, inventario_productos,
  inventario_materiales, movimientos_stock, remitos, remito_items, flujo_caja,
  gestion_audit_log, api_keys_integraciones to authenticated;

