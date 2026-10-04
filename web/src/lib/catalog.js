import catalogoData from '../data/catalogo.json';

const DRAFT_KEY = 'airo_catalog_draft_v1';

// Lee el catálogo. Si existe un borrador del admin en este navegador, lo usa
// (preview local: invisible para el resto de los visitantes).
export function getTodosProductos() {
  try {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      const parsed = JSON.parse(draft);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* draft corrupto -> usar JSON base */ }
  return catalogoData.productos;
}

// Versión async: intenta Postgres vía Supabase; cae al JSON local
// (o al borrador del admin, que siempre tiene prioridad en este navegador).
export async function loadCatalogo() {
  const draft = (() => {
    try {
      const d = localStorage.getItem(DRAFT_KEY);
      const parsed = d && JSON.parse(d);
      return Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
  })();
  if (draft) return draft;
  // Supabase se descarga por demanda (chunk separado) solo si está configurado
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const { fetchProductosDb } = await import('./db');
    const db = await fetchProductosDb();
    if (db) return db;
  }
  return catalogoData.productos;
}

export function getProductos() {
  return getTodosProductos().filter((p) => p.activo);
}

export function saveDraft(productos) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(productos));
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

export function hasDraft() {
  return !!localStorage.getItem(DRAFT_KEY);
}

export function exportDraft(productos) {
  const blob = new Blob([JSON.stringify({ productos }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'catalogo.json';
  a.click();
  URL.revokeObjectURL(url);
}
