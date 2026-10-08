-- Prepared migration. NOT applied automatically.
-- Requires a reviewed staging run and explicit approval before production.
-- Provision the owner's actual auth.users UUID in private.airo_admins separately.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table if not exists private.airo_admins (
  user_id uuid primary key references auth.users(id),
  active boolean not null default true
);
revoke all on private.airo_admins from public, anon, authenticated;
grant select, insert, update on private.airo_admins to service_role;

-- This narrow internal lookup is the only security-definer helper.
create or replace function private.is_airo_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from private.airo_admins a
    where a.user_id = auth.uid() and a.active
  );
$$;
revoke all on function private.is_airo_admin() from public, anon;
grant execute on function private.is_airo_admin() to authenticated, service_role;

alter table public.leads add column if not exists request_id uuid;
alter table public.leads add column if not exists request_payload_hash text;
alter table public.leads add column if not exists quote_items jsonb;
alter table public.leads add column if not exists consent_at timestamptz;
alter table public.leads add column if not exists consent_version text;
create unique index if not exists leads_request_id_unique on public.leads(request_id);

-- Keep existing rows; remove permissive policies, not customer data.
drop policy if exists "catalogo_lectura_publica" on public.productos;
drop policy if exists "catalogo_escritura_admin" on public.productos;
drop policy if exists "imagenes_lectura_publica" on public.producto_imagenes;
drop policy if exists "imagenes_escritura_admin" on public.producto_imagenes;
drop policy if exists "colores_lectura_publica" on public.producto_colores;
drop policy if exists "colores_escritura_admin" on public.producto_colores;
drop policy if exists "espec_lectura_publica" on public.producto_especificaciones;
drop policy if exists "espec_escritura_admin" on public.producto_especificaciones;
drop policy if exists "leads_insert_publico" on public.leads;
drop policy if exists "leads_lectura_admin" on public.leads;

do $$
declare t text;
begin
  foreach t in array array['productos','producto_imagenes','producto_colores','producto_especificaciones','leads']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists airo_admin_access on public.%I', t);
    execute format('create policy airo_admin_access on public.%I for all to authenticated using ((select private.is_airo_admin())) with check ((select private.is_airo_admin()))', t);
  end loop;
end;
$$;

drop policy if exists airo_active_products on public.productos;
create policy airo_active_products on public.productos
for select to anon, authenticated using (activo);

do $$
declare t text;
begin
  foreach t in array array['producto_imagenes','producto_colores','producto_especificaciones']
  loop
    execute format('drop policy if exists airo_active_children on public.%I', t);
    execute format('create policy airo_active_children on public.%I for select to anon, authenticated using (exists (select 1 from public.productos p where p.id_producto = %I.id_producto and p.activo))', t, t);
  end loop;
end;
$$;

revoke insert, update, delete on public.leads from anon;
revoke insert, update, delete on public.leads from authenticated;
revoke insert, update, delete on public.productos, public.producto_imagenes,
  public.producto_colores, public.producto_especificaciones from anon;
grant select on public.productos, public.producto_imagenes,
  public.producto_colores, public.producto_especificaciones to anon, authenticated;
grant select, insert, update, delete on public.productos, public.producto_imagenes,
  public.producto_colores, public.producto_especificaciones to authenticated;
grant select on public.leads to authenticated;
grant select, insert on public.leads to service_role;
do $$
declare seq_name text := pg_get_serial_sequence('public.leads', 'id');
begin
  if seq_name is not null then execute format('grant usage, select on sequence %s to service_role', seq_name); end if;
end;
$$;

-- Server-only intake. UUID + canonical payload hash make retries idempotent.
create or replace function public.submit_quote(
  p_request_id uuid, p_payload jsonb, p_payload_hash text
) returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  existing_hash text;
  item jsonb;
  inserted_id bigint;
begin
  if p_request_id is null or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_REQUEST';
  end if;
  select request_payload_hash into existing_hash from public.leads where request_id = p_request_id;
  if found then
    if existing_hash is distinct from p_payload_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('request_id', p_request_id, 'accepted', true, 'duplicate', true);
  end if;
  if p_payload->>'consent' is distinct from 'true'
     or coalesce(length(trim(p_payload->>'nombre')), 0) = 0
     or jsonb_typeof(p_payload->'items') is distinct from 'array' then
    raise exception 'INVALID_REQUEST';
  end if;
  for item in select value from jsonb_array_elements(p_payload->'items') loop
    if jsonb_typeof(item->'cantidad') is distinct from 'number'
       or (item->>'cantidad')::numeric < 10
       or mod((item->>'cantidad')::numeric, 10) <> 0
       or not exists (select 1 from public.productos p where p.id_producto = item->>'id' and p.activo) then
      raise exception 'INVALID_PRODUCT_OR_QUANTITY';
    end if;
    if nullif(item->>'variant', '') is not null and not exists (
      select 1 from public.producto_colores c
      where c.id_producto = item->>'id' and c.nombre = item->>'variant'
    ) then raise exception 'INVALID_VARIANT'; end if;
  end loop;
  insert into public.leads (
    request_id, request_payload_hash, origen, nombre, empresa, whatsapp, email,
    ciudad, fecha_estimada, objetivo, diseno, comentarios, carrito,
    quote_items, consent_at, consent_version
  ) values (
    p_request_id, p_payload_hash, p_payload->>'origen', p_payload->>'nombre',
    nullif(p_payload->>'empresa',''), nullif(p_payload->>'whatsapp',''),
    nullif(p_payload->>'email',''), nullif(p_payload->>'ciudad',''),
    nullif(p_payload->>'fecha_estimada',''), nullif(p_payload->>'objetivo',''),
    nullif(p_payload->>'diseno',''), nullif(p_payload->>'comentarios',''),
    p_payload->>'carrito', p_payload->'items', now(), p_payload->>'consent_version'
  ) on conflict (request_id) do nothing returning id into inserted_id;
  if inserted_id is null then
    select request_payload_hash into existing_hash from public.leads where request_id = p_request_id;
    if existing_hash is distinct from p_payload_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  end if;
  return jsonb_build_object('request_id', p_request_id, 'accepted', true, 'duplicate', inserted_id is null);
end;
$$;
revoke all on function public.submit_quote(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.submit_quote(uuid,jsonb,text) to service_role;

-- One transaction replaces a product and its children; any failure rolls back.
create or replace function public.save_catalog_product(
  p_product jsonb, p_galeria jsonb, p_colores jsonb, p_especificaciones jsonb
) returns void language plpgsql security invoker set search_path = ''
as $$
declare product_id text := p_product->>'id_producto';
begin
  if not private.is_airo_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if jsonb_typeof(p_galeria) is distinct from 'array' or jsonb_typeof(p_colores) is distinct from 'array'
     or jsonb_typeof(p_especificaciones) is distinct from 'array' then raise exception 'INVALID_CHILDREN'; end if;
  insert into public.productos (
    id_producto, categoria, badge, nombre, descripcion, precio, cantidad, imagen_principal, activo
  ) values (
    product_id, p_product->>'categoria', nullif(p_product->>'badge',''),
    p_product->>'nombre', nullif(p_product->>'descripcion',''),
    (p_product->>'precio')::numeric, (p_product->>'cantidad')::integer,
    p_product->>'imagen_principal', (p_product->>'activo')::boolean
  ) on conflict (id_producto) do update set
    categoria=excluded.categoria, badge=excluded.badge, nombre=excluded.nombre,
    descripcion=excluded.descripcion, precio=excluded.precio, cantidad=excluded.cantidad,
    imagen_principal=excluded.imagen_principal, activo=excluded.activo;
  delete from public.producto_imagenes where id_producto=product_id;
  delete from public.producto_colores where id_producto=product_id;
  delete from public.producto_especificaciones where id_producto=product_id;
  insert into public.producto_imagenes(id_producto,ruta,orden)
    select product_id, value, ordinality::integer-1 from jsonb_array_elements_text(p_galeria) with ordinality;
  insert into public.producto_colores(id_producto,nombre,orden)
    select product_id, value, ordinality::integer-1 from jsonb_array_elements_text(p_colores) with ordinality;
  insert into public.producto_especificaciones(id_producto,detalle,orden)
    select product_id, value, ordinality::integer-1 from jsonb_array_elements_text(p_especificaciones) with ordinality;
end;
$$;
revoke all on function public.save_catalog_product(jsonb,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.save_catalog_product(jsonb,jsonb,jsonb,jsonb) to authenticated;
commit;
