// Persistencia de la selección de cotización — puro, testeable en node.
// STANDALONE de CartContext (sin JSX) para poder probar migración/quota/corrupto.
import { migrateItem } from '../shared/quote-contract.mjs';

export const STORAGE_KEY = 'airo_cart_b2b';
export const REVIEW_KEY = 'airo_cart_b2b_review';
export const BACKUP_PREFIX = 'airo_cart_b2b_unparseable_';
let backupSeq = 0; // garantiza unicidad aun en el mismo milisegundo
const backupKey = () => `${BACKUP_PREFIX}${Date.now()}-${backupSeq++}`;

const backup = (storage, raw) => {
  try { storage.setItem(backupKey(), raw); return true; }
  catch { return false; } // sin espacio — se informa, no se miente
};

// Carga + migra la selección persistida. JSON inválido NO se borra: se
// preserva en un backup ÚNICO y se avisa. Nada se sobrescribe salvo que el
// usuario elija "Nuevo proyecto" (explicito). persistAllowed=false indica al
// contexto que NO escriba efectos de persistencia — preserva el original
// hasta recuperación explícita.
export function loadItems(catalog, storage) {
  // el getter de localStorage puede lanzar (sandbox/privacy) — dentro del guard
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  if (!storage) return { items: [], review: [], warning: 'storage-unavailable', persistAllowed: false };
  let raw, rawR;
  try {
    raw = storage.getItem(STORAGE_KEY);
    rawR = storage.getItem(REVIEW_KEY);
  } catch {
    return { items: [], review: [], warning: 'storage-unavailable', persistAllowed: false };
  }
  let items = [], review = [], warning;
  let storageFailed = false, corrupt = false, backedUp = false;
  // Intenta SIEMPRE el backup (ambos payloads corruptos se respaldan en keys
  // únicas). Un solo fracaso → persistAllowed=false: el original no se pisa.
  const saveCorrupt = (r) => {
    corrupt = true;
    if (backup(storage, r)) backedUp = true;
    else storageFailed = true;
  };

  if (raw) {
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { saveCorrupt(raw); }
    if (parsed !== undefined) {
      if (!Array.isArray(parsed)) {
        saveCorrupt(raw);
      } else {
        for (const it of parsed) {
          const r = migrateItem(it, catalog);
          if (r.ok) items.push(r.item);
          else review.push({ ...it, review_reason: r.reason || r.error });
        }
      }
    }
  }
  if (rawR) {
    try {
      const pr = JSON.parse(rawR);
      if (Array.isArray(pr)) review.push(...pr);
      else saveCorrupt(rawR);
    } catch {
      // review corrupto: backup propio — nunca ignorado/limpiado
      saveCorrupt(rawR);
    }
  }
  // warning distingue: backup completo / backup parcial-o-fallido / storage caído.
  if (corrupt) warning = storageFailed ? 'corrupt-unbacked' : 'corrupt-backed-up';
  else if (review.length) warning = 'review-needed';
  return { items, review, warning, persistAllowed: !storageFailed };
}
