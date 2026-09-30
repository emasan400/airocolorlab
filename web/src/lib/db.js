import { supabase } from './supabase';

// Capa de acceso a Postgres vía Supabase. Devuelve el mismo shape
// que catalogo.json para no tocar los componentes.
const EMBED =
  '*, producto_imagenes(ruta, orden), producto_colores(nombre, orden), ' +
  'producto_especificaciones(detalle, orden)';

const byOrden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0);
const byIdNum = (a, b) => {
  const na = parseInt(a.id_producto.replace(/\D/g, ''), 10);
  const nb = parseInt(b.id_producto.replace(/\D/g, ''), 10);
  return (isNaN(na) ? 0 : na) - (isNaN(nb) ? 0 : nb) ||
    a.id_producto.localeCompare(b.id_producto);
};

const fromDb = (r) => ({
  id_producto: r.id_producto,
  categoria: r.categoria,
  badge: r.badge || '',
  nombre: r.nombre,
  descripcion: r.descripcion || '',
  precio: r.precio,
  cantidad: r.cantidad,
  imagen_principal: r.imagen_principal,
  galeria: (r.producto_imagenes || []).sort(byOrden).map((i) => i.ruta),
  colores: (r.producto_colores || []).sort(byOrden).map((c) => c.nombre),
  especificaciones: (r.producto_especificaciones || [])
    .sort(byOrden)
    .map((e) => e.detalle),
  activo: r.activo,
});

// Lee todos los productos (activos e inactivos) desde la DB.
// Devuelve null si Supabase no está configurado o falla → caller usa fallback.
export async function fetchProductosDb() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('productos').select(EMBED);
    if (error || !data?.length) return null;
    return data.map(fromDb).sort(byIdNum);
  } catch {
    return null;
  }
}

// Upsert del padre + reemplazo de filas hijas (imágenes, colores, specs).
export async function saveProductoDb(p) {
  const { galeria, colores, especificaciones, ...row } = p;
  const { error } = await supabase.from('productos').upsert({
    ...row,
    badge: row.badge || null,
    descripcion: row.descripcion || null,
  });
  if (error) throw error;

  const id = p.id_producto;
  await Promise.all([
    supabase.from('producto_imagenes').delete().eq('id_producto', id),
    supabase.from('producto_colores').delete().eq('id_producto', id),
    supabase.from('producto_especificaciones').delete().eq('id_producto', id),
  ]);

  const inserts = [
    galeria?.length &&
      supabase.from('producto_imagenes').insert(
        galeria.map((ruta, orden) => ({ id_producto: id, ruta, orden }))
      ),
    colores?.length &&
      supabase.from('producto_colores').insert(
        colores.map((nombre, orden) => ({ id_producto: id, nombre, orden }))
      ),
    especificaciones?.length &&
      supabase.from('producto_especificaciones').insert(
        especificaciones.map((detalle, orden) => ({ id_producto: id, detalle, orden }))
      ),
  ].filter(Boolean);
  const results = await Promise.all(inserts);
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
}

export async function deleteProductoDb(id) {
  const { error } = await supabase.from('productos').delete().eq('id_producto', id);
  if (error) throw error;
}

export async function setActivoDb(id, activo) {
  const { error } = await supabase
    .from('productos')
    .update({ activo })
    .eq('id_producto', id);
  if (error) throw error;
}

// Últimos leads para la vista del admin (solo usuarios autenticados).
export async function fetchLeadsDb(limit = 100) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return error ? [] : data;
}
