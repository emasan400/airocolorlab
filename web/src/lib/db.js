import { supabase } from './supabase.js';

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

// Guardado atómico de producto vía RPC save_catalog_product (padre + hijas
// en una sola transacción server-side). Requiere la migración aplicada —
// si el RPC no existe, el error se propaga: SIN fallback destructivo
// (upsert+delete+insert dejaba el producto roto a medias ante un fallo).
export async function saveProductoDb(p, client = supabase) {
  const { galeria, colores, especificaciones, ...row } = p;
  const { error } = await client.rpc('save_catalog_product', {
    p_product: { ...row, badge: row.badge || null, descripcion: row.descripcion || null },
    p_galeria: galeria || [],
    p_colores: colores || [],
    p_especificaciones: especificaciones || [],
  });
  if (error) throw error;
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

// Últimas solicitudes de cotización para la vista del admin (solo autenticados).
// Columnas explícitas — nunca select(*) sobre datos de contacto.
// 'carrito' se mantiene para compat con solicitudes legacy del flujo anterior.
// El error se PROPAGA: un [] ambiguo nunca simula un CRM vacío.
export async function fetchLeadsDb(limit = 100) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('leads')
    .select('id,request_id,origen,nombre,empresa,whatsapp,email,ciudad,fecha_estimada,objetivo,diseno,comentarios,carrito,quote_items,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
