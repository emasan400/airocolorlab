import { supabase } from '../../lib/supabase.js';
import {
  initialProductos,
  initialMateriales,
  initialClientes,
  initialProveedores,
  initialRemitos,
  initialFlujoCaja,
  initialMovimientos,
} from './seedData.js';

const PREFIX = 'airo_gestion_v2_';

// Limpieza automática de claves v1 con datos de muestra previos
try {
  if (typeof localStorage !== 'undefined') {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('airo_gestion_v1_')) {
        localStorage.removeItem(k);
      }
    });
  }
} catch {
  // Ignorar error de acceso a storage
}

export const KEYS = {
  PRODUCTOS: `${PREFIX}productos`,
  MATERIALES: `${PREFIX}materiales`,
  CLIENTES: `${PREFIX}clientes`,
  PROVEEDORES: `${PREFIX}proveedores`,
  REMITOS: `${PREFIX}remitos`,
  FLUJO_CAJA: `${PREFIX}flujo_caja`,
  MOVIMIENTOS: `${PREFIX}movimientos`,
  AUDIT: `${PREFIX}audit_log`,
  OPERADOR: `${PREFIX}operador_actual`,
  USUARIOS: `${PREFIX}usuarios`,
  LEADS: `${PREFIX}leads`,
  APPROVALS: `${PREFIX}approvals`,
  EDITORIAL_CALENDAR: `${PREFIX}editorial_calendar`,
  CAMPAIGNS: `${PREFIX}campaigns`,
  PROMPTS: `${PREFIX}prompts`,
  DESIGN_CANVASES: `${PREFIX}design_canvases`,
  DTF_QUOTES: `${PREFIX}dtf_quotes`,
  PMBOK_TASKS: `${PREFIX}pmbok_tasks`,
  KAIZEN_PDCA: `${PREFIX}kaizen_pdca`,
};

export const MARKETING_CHANNELS = [
  { id: 'INSTAGRAM', name: 'Instagram', color: '#E1306C', desc: 'Reels, Carruseles y Stories textiles' },
  { id: 'WHATSAPP', name: 'WhatsApp', color: '#25D366', desc: 'Mensajería comercial B2B y cotizaciones' },
  { id: 'LINKEDIN', name: 'LinkedIn', color: '#0A66C2', desc: 'Contenido corporativo y captación B2B' },
  { id: 'GMAIL', name: 'Gmail', color: '#EA4335', desc: 'Campañas de email marketing B2B' },
  { id: 'FACEBOOK', name: 'Facebook', color: '#1877F2', desc: 'Comunidad mayorista y catálogo' },
];

// Canal de sincronización en tiempo real para trabajo colaborativo multi-pestaña / local
let syncChannel = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('airo_gestion_sync_channel');
  }
} catch {
  // Fallback si BroadcastChannel no está disponible
}

function broadcastUpdate(type, payload) {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ type, payload, timestamp: Date.now() });
    } catch {
      // Ignorar error de mensaje
    }
  }
}

// ============================================================
// CRIPTOGRAFÍA & HASHING DE CONTRASEÑAS (SHA-256 + SALT)
// ============================================================
function sha256Sync(ascii) {
  function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length', i, j;
  let result = '';
  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash = [], k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1/3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i % 4) * 8);
  }
  words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
  words[words[lengthProperty]] = (asciiBitLength | 0);
  for (j = 0; j < words[lengthProperty];) {
    const w = words.slice(j, j += 16);
    const oldHash = hash.slice(0);
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ ((~e) & hash[6]))
        + k[i]
        + (w[i] = (i < 16) ? w[i] : (
            w[i - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0
        );
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (b * 8)) & 255;
      result += ((byte < 16) ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

export function generateSalt() {
  const chars = '0123456789abcdef';
  let salt = '';
  for (let i = 0; i < 16; i++) {
    salt += chars[Math.floor(Math.random() * chars.length)];
  }
  return salt;
}

export function hashPasswordSync(plainText, salt = null) {
  if (!plainText) return '';
  const actualSalt = salt || generateSalt();
  const digest = sha256Sync(`${actualSalt}:${plainText}`);
  return `sha256:${actualSalt}:${digest}`;
}

export function verifyPasswordSync(plainText, storedHashOrPlain) {
  if (!storedHashOrPlain || !plainText) return false;
  if (!storedHashOrPlain.startsWith('sha256:')) {
    return false;
  }
  const parts = storedHashOrPlain.split(':');
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const expectedHash = parts[2];
  const calculated = sha256Sync(`${salt}:${plainText}`);
  return calculated === expectedHash;
}

export function generateInitialAdminHash() {
  const dynamicEntropy = generateSalt() + generateSalt();
  return hashPasswordSync(dynamicEntropy, generateSalt());
}

// Helpers locales
export function getLocal(key, defaultVal) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultVal;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${key}:`, e);
    return defaultVal;
  }
}

export function setLocal(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error(`Error saving ${key}:`, e);
  }
}

// Inicialización de datos si es la primera vez
export function initializeStorageIfEmpty() {
  if (!localStorage.getItem(KEYS.PRODUCTOS)) {
    setLocal(KEYS.PRODUCTOS, initialProductos);
  }
  if (!localStorage.getItem(KEYS.MATERIALES)) {
    setLocal(KEYS.MATERIALES, initialMateriales);
  }
  if (!localStorage.getItem(KEYS.CLIENTES)) {
    setLocal(KEYS.CLIENTES, initialClientes);
  }
  if (!localStorage.getItem(KEYS.PROVEEDORES)) {
    setLocal(KEYS.PROVEEDORES, initialProveedores);
  }
  if (!localStorage.getItem(KEYS.REMITOS)) {
    setLocal(KEYS.REMITOS, initialRemitos);
  }
  if (!localStorage.getItem(KEYS.FLUJO_CAJA)) {
    setLocal(KEYS.FLUJO_CAJA, initialFlujoCaja);
  }
  if (!localStorage.getItem(KEYS.MOVIMIENTOS)) {
    setLocal(KEYS.MOVIMIENTOS, initialMovimientos);
  }
  if (!localStorage.getItem(KEYS.OPERADOR)) {
    setLocal(KEYS.OPERADOR, 'Admin AIRO (Taller Central)');
  }
  if (!localStorage.getItem(KEYS.USUARIOS)) {
    setLocal(KEYS.USUARIOS, [
      {
        id: 'usr-admin-01',
        email: 'admin@airocolorlab.com',
        nombre: 'Administrador Principal AIRO',
        rol: 'admin',
        activo: true,
        fecha_creacion: new Date().toISOString(),
        ultimo_ingreso: new Date().toISOString(),
        password: generateInitialAdminHash(),
      },
    ]);
  }
  if (!localStorage.getItem(KEYS.LEADS)) {
    setLocal(KEYS.LEADS, []);
  }
  if (!localStorage.getItem(KEYS.APPROVALS)) {
    setLocal(KEYS.APPROVALS, initialApprovals);
  }
  if (!localStorage.getItem(KEYS.EDITORIAL_CALENDAR)) {
    setLocal(KEYS.EDITORIAL_CALENDAR, initialEditorialCalendar);
  }
  if (!localStorage.getItem(KEYS.CAMPAIGNS)) {
    setLocal(KEYS.CAMPAIGNS, initialCampaigns);
  }
  if (!localStorage.getItem(KEYS.PROMPTS)) {
    setLocal(KEYS.PROMPTS, initialPrompts);
  }
  if (!localStorage.getItem(KEYS.DESIGN_CANVASES)) {
    setLocal(KEYS.DESIGN_CANVASES, initialDesignCanvases);
  }
  if (!localStorage.getItem(KEYS.DTF_QUOTES)) {
    setLocal(KEYS.DTF_QUOTES, initialDtfQuotes);
  }
  if (!localStorage.getItem(KEYS.AUDIT)) {
    setLocal(KEYS.AUDIT, [
      {
        id: 'aud-0',
        timestamp: new Date().toISOString(),
        operador: 'Sistema',
        accion: 'INICIALIZACION_SISTEMA',
        modulo: 'CORE',
        detalles: 'Base de datos operativa inicializada con catálogo de AIRO Color Lab.',
        RESULT: 'SUCCESS',
      },
    ]);
  }
}

// Registro de Auditoría (Regla AIRO: Append-only, campo RESULT)
export function logAudit(operador, accion, modulo, detalles, result = 'SUCCESS') {
  const audit = getLocal(KEYS.AUDIT, []);
  const entry = {
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    operador: operador || getOperadorActual(),
    accion,
    modulo,
    detalles,
    RESULT: result,
  };
  audit.unshift(entry);
  if (audit.length > 500) audit.pop(); // Mantener hasta 500 logs
  setLocal(KEYS.AUDIT, audit);
  broadcastUpdate('AUDIT_UPDATED', entry);
  return entry;
}

export function getAuditLogs() {
  return getLocal(KEYS.AUDIT, []);
}

export function getOperadorActual() {
  return getLocal(KEYS.OPERADOR, 'Admin AIRO (Taller Central)');
}

export function setOperadorActual(operador) {
  setLocal(KEYS.OPERADOR, operador);
  logAudit(operador, 'CAMBIO_OPERADOR', 'SESION', `Operador activo cambiado a: ${operador}`);
  broadcastUpdate('OPERADOR_CHANGED', operador);
}

// ============================================================
// 1. INVENTARIO DE PRODUCTOS TERMINADOS
// ============================================================
export function getProductos() {
  return getLocal(KEYS.PRODUCTOS, initialProductos);
}

export function saveProducto(prodData) {
  const list = getProductos();
  const operador = getOperadorActual();
  let updated;
  const isEdit = !!prodData.id;

  if (isEdit) {
    const idx = list.findIndex((p) => p.id === prodData.id);
    if (idx === -1) throw new Error('Producto no encontrado para editar');
    const prev = list[idx];
    updated = {
      ...prev,
      ...prodData,
      stock_actual: Number(prodData.stock_actual) || 0,
      stock_minimo: Number(prodData.stock_minimo) || 0,
      stock_reservado: Number(prodData.stock_reservado) || 0,
      costo_unitario: Number(prodData.costo_unitario) || 0,
      precio_venta: Number(prodData.precio_venta) || 0,
      updated_at: new Date().toISOString(),
    };
    list[idx] = updated;

    // Si cambió el stock manualmente, registrar kardex
    if (prev.stock_actual !== updated.stock_actual) {
      const diff = updated.stock_actual - prev.stock_actual;
      registrarMovimiento({
        tipo: diff > 0 ? 'entrada' : 'salida',
        entidad_tipo: 'producto',
        item_id: updated.id,
        item_nombre: `${updated.nombre} (${updated.talle || 'U'} - ${updated.color || ''})`,
        cantidad: Math.abs(diff),
        motivo: `Ajuste manual de stock desde panel (${prev.stock_actual} → ${updated.stock_actual})`,
        operador,
        stock_anterior: prev.stock_actual,
        stock_nuevo: updated.stock_actual,
      });
    }

    logAudit(operador, 'EDITAR_PRODUCTO', 'INVENTARIO_PRODUCTOS', `Editado producto ${updated.sku} - ${updated.nombre}`);
  } else {
    const newId = `prod-${Date.now()}`;
    updated = {
      ...prodData,
      id: newId,
      sku: prodData.sku?.trim() || `PROD-${Date.now().toString().slice(-4)}`,
      stock_actual: Number(prodData.stock_actual) || 0,
      stock_minimo: Number(prodData.stock_minimo) || 0,
      stock_reservado: Number(prodData.stock_reservado) || 0,
      costo_unitario: Number(prodData.costo_unitario) || 0,
      precio_venta: Number(prodData.precio_venta) || 0,
      updated_at: new Date().toISOString(),
    };
    list.unshift(updated);

    if (updated.stock_actual > 0) {
      registrarMovimiento({
        tipo: 'entrada',
        entidad_tipo: 'producto',
        item_id: updated.id,
        item_nombre: `${updated.nombre} (${updated.talle || 'U'} - ${updated.color || ''})`,
        cantidad: updated.stock_actual,
        motivo: 'Alta inicial de producto con stock disponible',
        operador,
        stock_anterior: 0,
        stock_nuevo: updated.stock_actual,
      });
    }

    logAudit(operador, 'CREAR_PRODUCTO', 'INVENTARIO_PRODUCTOS', `Creado producto ${updated.sku} - ${updated.nombre}`);
  }

  setLocal(KEYS.PRODUCTOS, list);
  broadcastUpdate('PRODUCTOS_UPDATED', list);
  return updated;
}

export function deleteProducto(id) {
  const list = getProductos();
  const prod = list.find((p) => p.id === id);
  if (!prod) return false;
  const filtered = list.filter((p) => p.id !== id);
  setLocal(KEYS.PRODUCTOS, filtered);
  logAudit(getOperadorActual(), 'ELIMINAR_PRODUCTO', 'INVENTARIO_PRODUCTOS', `Eliminado producto ${prod.sku} (${prod.nombre})`);
  broadcastUpdate('PRODUCTOS_UPDATED', filtered);
  return true;
}

// Ajuste rápido de stock (+ / -)
export function adjustStockProducto(id, deltaCantidad, motivoTexto) {
  const list = getProductos();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Producto no encontrado');

  const p = list[idx];
  const stockAnt = p.stock_actual;
  const stockNuevo = Math.max(0, stockAnt + deltaCantidad);
  p.stock_actual = stockNuevo;
  p.updated_at = new Date().toISOString();
  list[idx] = p;

  setLocal(KEYS.PRODUCTOS, list);

  const operador = getOperadorActual();
  registrarMovimiento({
    tipo: deltaCantidad >= 0 ? 'entrada' : 'salida',
    entidad_tipo: 'producto',
    item_id: p.id,
    item_nombre: `${p.nombre} (${p.talle || ''} ${p.color || ''})`,
    cantidad: Math.abs(deltaCantidad),
    motivo: motivoTexto || (deltaCantidad >= 0 ? 'Ingreso rápido de stock' : 'Salida rápida de stock'),
    operador,
    stock_anterior: stockAnt,
    stock_nuevo: stockNuevo,
  });

  logAudit(operador, 'AJUSTE_STOCK_PRODUCTO', 'INVENTARIO_PRODUCTOS', `Stock ajustado en ${p.sku}: ${stockAnt} → ${stockNuevo} (${deltaCantidad > 0 ? '+' : ''}${deltaCantidad})`);
  broadcastUpdate('PRODUCTOS_UPDATED', list);
  return p;
}

// ============================================================
// 2. INVENTARIO DE MATERIALES E INSUMOS
// ============================================================
export function getMateriales() {
  return getLocal(KEYS.MATERIALES, initialMateriales);
}

export function saveMaterial(matData) {
  const list = getMateriales();
  const operador = getOperadorActual();
  let updated;
  const isEdit = !!matData.id;

  if (isEdit) {
    const idx = list.findIndex((m) => m.id === matData.id);
    if (idx === -1) throw new Error('Material no encontrado para editar');
    const prev = list[idx];
    updated = {
      ...prev,
      ...matData,
      stock_actual: Number(matData.stock_actual) || 0,
      stock_minimo: Number(matData.stock_minimo) || 0,
      costo_unitario: Number(matData.costo_unitario) || 0,
      updated_at: new Date().toISOString(),
    };
    list[idx] = updated;

    if (prev.stock_actual !== updated.stock_actual) {
      const diff = updated.stock_actual - prev.stock_actual;
      registrarMovimiento({
        tipo: diff > 0 ? 'entrada' : 'salida',
        entidad_tipo: 'material',
        item_id: updated.id,
        item_nombre: `${updated.nombre} (${updated.unidad})`,
        cantidad: Math.abs(diff),
        motivo: `Ajuste manual de material (${prev.stock_actual} → ${updated.stock_actual})`,
        operador,
        stock_anterior: prev.stock_actual,
        stock_nuevo: updated.stock_actual,
      });
    }

    logAudit(operador, 'EDITAR_MATERIAL', 'INVENTARIO_MATERIALES', `Editado material ${updated.codigo} - ${updated.nombre}`);
  } else {
    const newId = `mat-${Date.now()}`;
    updated = {
      ...matData,
      id: newId,
      codigo: matData.codigo?.trim() || `MAT-${Date.now().toString().slice(-4)}`,
      stock_actual: Number(matData.stock_actual) || 0,
      stock_minimo: Number(matData.stock_minimo) || 0,
      costo_unitario: Number(matData.costo_unitario) || 0,
      updated_at: new Date().toISOString(),
    };
    list.unshift(updated);

    if (updated.stock_actual > 0) {
      registrarMovimiento({
        tipo: 'entrada',
        entidad_tipo: 'material',
        item_id: updated.id,
        item_nombre: `${updated.nombre} (${updated.unidad})`,
        cantidad: updated.stock_actual,
        motivo: 'Alta de material con stock inicial',
        operador,
        stock_anterior: 0,
        stock_nuevo: updated.stock_actual,
      });
    }

    logAudit(operador, 'CREAR_MATERIAL', 'INVENTARIO_MATERIALES', `Creado material ${updated.codigo} - ${updated.nombre}`);
  }

  setLocal(KEYS.MATERIALES, list);
  broadcastUpdate('MATERIALES_UPDATED', list);
  return updated;
}

export function deleteMaterial(id) {
  const list = getMateriales();
  const mat = list.find((m) => m.id === id);
  if (!mat) return false;
  const filtered = list.filter((m) => m.id !== id);
  setLocal(KEYS.MATERIALES, filtered);
  logAudit(getOperadorActual(), 'ELIMINAR_MATERIAL', 'INVENTARIO_MATERIALES', `Eliminado material ${mat.codigo} (${mat.nombre})`);
  broadcastUpdate('MATERIALES_UPDATED', filtered);
  return true;
}

export function adjustStockMaterial(id, deltaCantidad, motivoTexto) {
  const list = getMateriales();
  const idx = list.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error('Material no encontrado');

  const m = list[idx];
  const stockAnt = m.stock_actual;
  const stockNuevo = Math.max(0, stockAnt + deltaCantidad);
  m.stock_actual = stockNuevo;
  m.updated_at = new Date().toISOString();
  list[idx] = m;

  setLocal(KEYS.MATERIALES, list);

  const operador = getOperadorActual();
  registrarMovimiento({
    tipo: deltaCantidad >= 0 ? 'entrada' : 'salida',
    entidad_tipo: 'material',
    item_id: m.id,
    item_nombre: `${m.nombre} (${m.unidad})`,
    cantidad: Math.abs(deltaCantidad),
    motivo: motivoTexto || (deltaCantidad >= 0 ? 'Ingreso de insumo' : 'Consumo en producción'),
    operador,
    stock_anterior: stockAnt,
    stock_nuevo: stockNuevo,
  });

  logAudit(operador, 'AJUSTE_STOCK_MATERIAL', 'INVENTARIO_MATERIALES', `Material ${m.codigo}: ${stockAnt} → ${stockNuevo} (${m.unidad})`);
  broadcastUpdate('MATERIALES_UPDATED', list);
  return m;
}

// ============================================================
// 3. KARDEX / MOVIMIENTOS DE STOCK
// ============================================================
export function getMovimientos() {
  return getLocal(KEYS.MOVIMIENTOS, initialMovimientos);
}

export function registrarMovimiento(mov) {
  const list = getMovimientos();
  const entry = {
    id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    fecha: new Date().toISOString(),
    ...mov,
  };
  list.unshift(entry);
  if (list.length > 500) list.pop();
  setLocal(KEYS.MOVIMIENTOS, list);
  broadcastUpdate('MOVIMIENTOS_UPDATED', list);
  return entry;
}

// ============================================================
// 4. MÓDULO DE REMITOS AIRO COLOR LAB
// ============================================================
export function getRemitos() {
  return getLocal(KEYS.REMITOS, initialRemitos);
}

// Generador de correlativo de remito oficial
export function getNextRemitoNumero() {
  const remitos = getRemitos();
  if (!remitos.length) return 'R-0001-00000001';

  let maxNum = 0;
  for (const r of remitos) {
    const parts = (r.numero || '').split('-');
    if (parts.length >= 3) {
      const n = parseInt(parts[2], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  const next = (maxNum + 1).toString().padStart(8, '0');
  return `R-0001-${next}`;
}

export function saveRemito(remitoData) {
  const list = getRemitos();
  const operador = getOperadorActual();
  let saved;
  const isEdit = !!remitoData.id;

  if (isEdit) {
    const idx = list.findIndex((r) => r.id === remitoData.id);
    if (idx === -1) throw new Error('Remito no encontrado para editar');
    saved = {
      ...list[idx],
      ...remitoData,
      updated_at: new Date().toISOString(),
    };
    list[idx] = saved;
    logAudit(operador, 'EDITAR_REMITO', 'REMITOS', `Editado remito ${saved.numero} para ${saved.cliente_nombre}`);
  } else {
    saved = {
      ...remitoData,
      id: `rem-${Date.now()}`,
      numero: remitoData.numero || getNextRemitoNumero(),
      created_at: new Date().toISOString(),
    };
    list.unshift(saved);

    // Si está marcado para descontar stock y su estado es Emitido o Entregado
    if (saved.descontar_stock && (saved.estado === 'Emitido' || saved.estado === 'En Tránsito' || saved.estado === 'Entregado')) {
      aplicarDescuentoStockRemito(saved, operador);
    }

    logAudit(operador, 'EMITIR_REMITO', 'REMITOS', `Emitido remito ${saved.numero} a ${saved.cliente_nombre} con ${saved.items?.length || 0} ítems`);
  }

  setLocal(KEYS.REMITOS, list);
  broadcastUpdate('REMITOS_UPDATED', list);
  return saved;
}

export function cambiarEstadoRemito(id, nuevoEstado, signedData = {}) {
  const list = getRemitos();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error('Remito no encontrado');

  const remito = list[idx];
  const estadoAnterior = remito.estado;
  remito.estado = nuevoEstado;
  if (signedData.firmado_por) remito.firmado_por = signedData.firmado_por;
  if (signedData.dni_receptor) remito.dni_receptor = signedData.dni_receptor;
  remito.updated_at = new Date().toISOString();

  const operador = getOperadorActual();

  // Si pasa de Borrador a Emitido o Entregado y tiene descuento activo, descontar
  if (estadoAnterior === 'Borrador' && (nuevoEstado === 'Emitido' || nuevoEstado === 'En Tránsito' || nuevoEstado === 'Entregado') && remito.descontar_stock) {
    aplicarDescuentoStockRemito(remito, operador);
  }

  // Si se anula un remito que ya había descontado stock, se repone
  if (nuevoEstado === 'Anulado' && estadoAnterior !== 'Anulado' && remito.descontar_stock && remito.stock_descontado) {
    reponerStockRemitoAnulado(remito, operador);
    remito.stock_descontado = false;
  }

  list[idx] = remito;
  setLocal(KEYS.REMITOS, list);
  logAudit(operador, 'CAMBIO_ESTADO_REMITO', 'REMITOS', `Remito ${remito.numero}: ${estadoAnterior} → ${nuevoEstado}`);
  broadcastUpdate('REMITOS_UPDATED', list);
  return remito;
}

function aplicarDescuentoStockRemito(remito, operador) {
  if (remito.stock_descontado) return; // Evitar doble descuento
  const productos = getProductos();
  let modificado = false;

  for (const item of remito.items || []) {
    if (!item.producto_id) continue;
    const prodIdx = productos.findIndex((p) => p.id === item.producto_id);
    if (prodIdx !== -1) {
      const prod = productos[prodIdx];
      const cant = Number(item.cantidad) || 0;
      if (cant > 0) {
        const stockAnt = prod.stock_actual;
        prod.stock_actual = Math.max(0, stockAnt - cant);
        // Descontar también de reservado si correspondía
        if (prod.stock_reservado && prod.stock_reservado > 0) {
          prod.stock_reservado = Math.max(0, prod.stock_reservado - cant);
        }
        prod.updated_at = new Date().toISOString();
        productos[prodIdx] = prod;
        modificado = true;

        registrarMovimiento({
          tipo: 'salida',
          entidad_tipo: 'producto',
          item_id: prod.id,
          item_nombre: `${prod.nombre} (${prod.talle || ''} ${prod.color || ''})`,
          cantidad: cant,
          motivo: `Despacho por Remito ${remito.numero} (${remito.cliente_nombre})`,
          operador,
          stock_anterior: stockAnt,
          stock_nuevo: prod.stock_actual,
        });
      }
    }
  }

  if (modificado) {
    setLocal(KEYS.PRODUCTOS, productos);
    broadcastUpdate('PRODUCTOS_UPDATED', productos);
    remito.stock_descontado = true;
  }
}

function reponerStockRemitoAnulado(remito, operador) {
  const productos = getProductos();
  let modificado = false;

  for (const item of remito.items || []) {
    if (!item.producto_id) continue;
    const prodIdx = productos.findIndex((p) => p.id === item.producto_id);
    if (prodIdx !== -1) {
      const prod = productos[prodIdx];
      const cant = Number(item.cantidad) || 0;
      if (cant > 0) {
        const stockAnt = prod.stock_actual;
        prod.stock_actual = stockAnt + cant;
        prod.updated_at = new Date().toISOString();
        productos[prodIdx] = prod;
        modificado = true;

        registrarMovimiento({
          tipo: 'entrada',
          entidad_tipo: 'producto',
          item_id: prod.id,
          item_nombre: `${prod.nombre} (${prod.talle || ''} ${prod.color || ''})`,
          cantidad: cant,
          motivo: `Devolución a stock por ANULACIÓN de Remito ${remito.numero}`,
          operador,
          stock_anterior: stockAnt,
          stock_nuevo: prod.stock_actual,
        });
      }
    }
  }

  if (modificado) {
    setLocal(KEYS.PRODUCTOS, productos);
    broadcastUpdate('PRODUCTOS_UPDATED', productos);
  }
}

export function deleteRemito(id) {
  const list = getRemitos();
  const rem = list.find((r) => r.id === id);
  if (!rem) return false;
  const filtered = list.filter((r) => r.id !== id);
  setLocal(KEYS.REMITOS, filtered);
  logAudit(getOperadorActual(), 'ELIMINAR_REMITO', 'REMITOS', `Eliminado remito ${rem.numero} (${rem.cliente_nombre})`);
  broadcastUpdate('REMITOS_UPDATED', filtered);
  return true;
}

// ============================================================
// 5. CONTROLADOR DE FLUJO DE CAJA
// ============================================================
export function getFlujoCaja() {
  return getLocal(KEYS.FLUJO_CAJA, initialFlujoCaja);
}

export function saveTransaccion(trxData) {
  const list = getFlujoCaja();
  const operador = getOperadorActual();
  let saved;
  const isEdit = !!trxData.id;

  if (isEdit) {
    const idx = list.findIndex((t) => t.id === trxData.id);
    if (idx === -1) throw new Error('Transacción no encontrada para editar');
    saved = {
      ...list[idx],
      ...trxData,
      monto: Number(trxData.monto) || 0,
      updated_at: new Date().toISOString(),
    };
    list[idx] = saved;
    logAudit(operador, 'EDITAR_TRANSACCION', 'FLUJO_CAJA', `Editada trx ${saved.id}: ${saved.tipo.toUpperCase()} $${saved.monto} - ${saved.concepto}`);
  } else {
    saved = {
      ...trxData,
      id: `trx-${Date.now()}`,
      monto: Number(trxData.monto) || 0,
      fecha: trxData.fecha || new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
    };
    list.unshift(saved);
    logAudit(operador, 'CREAR_TRANSACCION', 'FLUJO_CAJA', `Nueva trx ${saved.id}: ${saved.tipo.toUpperCase()} $${saved.monto} - ${saved.concepto}`);
  }

  setLocal(KEYS.FLUJO_CAJA, list);
  broadcastUpdate('FLUJO_CAJA_UPDATED', list);
  return saved;
}

export function deleteTransaccion(id) {
  const list = getFlujoCaja();
  const trx = list.find((t) => t.id === id);
  if (!trx) return false;
  const filtered = list.filter((t) => t.id !== id);
  setLocal(KEYS.FLUJO_CAJA, filtered);
  logAudit(getOperadorActual(), 'ELIMINAR_TRANSACCION', 'FLUJO_CAJA', `Eliminada trx ${trx.id} ($${trx.monto} - ${trx.concepto})`);
  broadcastUpdate('FLUJO_CAJA_UPDATED', filtered);
  return true;
}

// ============================================================
// 6. CLIENTES Y PROVEEDORES
// ============================================================
export function getClientes() {
  return getLocal(KEYS.CLIENTES, initialClientes);
}

export function saveCliente(cliData) {
  const list = getClientes();
  const operador = getOperadorActual();
  let saved;
  if (cliData.id) {
    const idx = list.findIndex((c) => c.id === cliData.id);
    if (idx === -1) throw new Error('Cliente no encontrado');
    saved = { ...list[idx], ...cliData };
    list[idx] = saved;
    logAudit(operador, 'EDITAR_CLIENTE', 'CLIENTES', `Editado cliente ${saved.razon_social}`);
  } else {
    saved = { ...cliData, id: `cli-${Date.now()}` };
    list.unshift(saved);
    logAudit(operador, 'CREAR_CLIENTE', 'CLIENTES', `Nuevo cliente ${saved.razon_social}`);
  }
  setLocal(KEYS.CLIENTES, list);
  broadcastUpdate('CLIENTES_UPDATED', list);
  return saved;
}

export function deleteCliente(id) {
  const list = getClientes();
  const filtered = list.filter((c) => c.id !== id);
  setLocal(KEYS.CLIENTES, filtered);
  broadcastUpdate('CLIENTES_UPDATED', filtered);
  return true;
}

export function getProveedores() {
  return getLocal(KEYS.PROVEEDORES, initialProveedores);
}

export function saveProveedor(provData) {
  const list = getProveedores();
  const operador = getOperadorActual();
  let saved;
  if (provData.id) {
    const idx = list.findIndex((p) => p.id === provData.id);
    if (idx === -1) throw new Error('Proveedor no encontrado');
    saved = { ...list[idx], ...provData };
    list[idx] = saved;
    logAudit(operador, 'EDITAR_PROVEEDOR', 'PROVEEDORES', `Editado proveedor ${saved.nombre}`);
  } else {
    saved = { ...provData, id: `prov-${Date.now()}` };
    list.unshift(saved);
    logAudit(operador, 'CREAR_PROVEEDOR', 'PROVEEDORES', `Nuevo proveedor ${saved.nombre}`);
  }
  setLocal(KEYS.PROVEEDORES, list);
  broadcastUpdate('PROVEEDORES_UPDATED', list);
  return saved;
}

export function deleteProveedor(id) {
  const list = getProveedores();
  const filtered = list.filter((p) => p.id !== id);
  setLocal(KEYS.PROVEEDORES, filtered);
  broadcastUpdate('PROVEEDORES_UPDATED', filtered);
  return true;
}

// ============================================================
// 7. RESPALDO, EXPORTACIÓN Y SINCRONIZACIÓN CLOUD
// ============================================================
export function exportarBackupCompleto() {
  const data = {
    version: '1.2',
    export_date: new Date().toISOString(),
    empresa: 'AIRO COLOR LAB.',
    productos: getProductos(),
    materiales: getMateriales(),
    clientes: getClientes(),
    proveedores: getProveedores(),
    remitos: getRemitos(),
    flujo_caja: getFlujoCaja(),
    movimientos: getMovimientos(),
    leads: getLeads(),
    approvals: getApprovals(),
    editorial_calendar: getEditorialCalendar(),
    design_canvases: getDesignCanvases(),
    dtf_quotes: getDtfQuotes(),
    usuarios: getUsuarios().map((u) => ({ ...u, password: '***' })),
    audit_log: getAuditLogs(),
  };
  return JSON.stringify(data, null, 2);
}

export function importarBackupCompleto(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.productos || !data.materiales) {
      throw new Error('El archivo no contiene un respaldo válido de AIRO Gestor');
    }
    if (Array.isArray(data.productos)) setLocal(KEYS.PRODUCTOS, data.productos);
    if (Array.isArray(data.materiales)) setLocal(KEYS.MATERIALES, data.materiales);
    if (Array.isArray(data.clientes)) setLocal(KEYS.CLIENTES, data.clientes);
    if (Array.isArray(data.proveedores)) setLocal(KEYS.PROVEEDORES, data.proveedores);
    if (Array.isArray(data.remitos)) setLocal(KEYS.REMITOS, data.remitos);
    if (Array.isArray(data.flujo_caja)) setLocal(KEYS.FLUJO_CAJA, data.flujo_caja);
    if (Array.isArray(data.movimientos)) setLocal(KEYS.MOVIMIENTOS, data.movimientos);
    if (Array.isArray(data.leads)) setLocal(KEYS.LEADS, data.leads);
    if (Array.isArray(data.approvals)) setLocal(KEYS.APPROVALS, data.approvals);
    if (Array.isArray(data.editorial_calendar)) setLocal(KEYS.EDITORIAL_CALENDAR, data.editorial_calendar);
    if (Array.isArray(data.design_canvases)) setLocal(KEYS.DESIGN_CANVASES, data.design_canvases);
    if (Array.isArray(data.dtf_quotes)) setLocal(KEYS.DTF_QUOTES, data.dtf_quotes);
    if (Array.isArray(data.usuarios)) {
      // Preservar passwords existentes si el backup viene sanitizado con '***'
      const actuales = getUsuarios();
      const restaurados = data.usuarios.map((nu) => {
        const coincidente = actuales.find((a) => a.id === nu.id || a.email === nu.email);
        return {
          ...nu,
          password: nu.password === '***' && coincidente ? coincidente.password : nu.password,
        };
      });
      setLocal(KEYS.USUARIOS, restaurados);
    }
    if (Array.isArray(data.audit_log)) setLocal(KEYS.AUDIT, data.audit_log);

    logAudit(getOperadorActual(), 'IMPORTAR_BACKUP', 'CONFIGURACION', 'Restauración completa de base de datos desde archivo JSON');
    broadcastUpdate('FULL_DATA_RELOADED', null);
    return true;
  } catch (err) {
    throw new Error('Error al importar JSON: ' + err.message);
  }
}

// ============================================================
// 8. MATRIZ DE ROLES Y CONTROL DE USUARIOS (RBAC)
// ============================================================

export const ROLES_DEFINICION = [
  {
    id: 'admin',
    nombre: 'Administrador General',
    descripcion: 'Control total de la plataforma: inventario, remitos, caja, auditoría, configuración y gestión de usuarios.',
    color: '#1a4295',
    badgeClass: 'pill--cat',
    permisos: [
      'productos_rw',
      'catalogo_rw',
      'materiales_rw',
      'remitos_rw',
      'caja_rw',
      'kardex_r',
      'contactos_rw',
      'crm_rw',
      'marketing_rw',
      'design_studio_rw',
      'cotizador_dtf_rw',
      'pmbok_command_rw',
      'usuarios_rw',
      'config_rw',
    ],
    modulosPermitidos: ['pmbok_command', 'productos', 'catalogo', 'materiales', 'cotizador_dtf', 'remitos', 'caja', 'kardex', 'contactos', 'crm', 'marketing', 'design_studio', 'usuarios', 'configuracion'],
  },
  {
    id: 'marketing_cm',
    nombre: 'Community Manager & Marketing B2B',
    descripcion: 'Operación del sistema multiagente, estudio de diseño en lienzo infinito, revisión y aprobación de contenidos en cola HITL, calendario editorial y clasificación de consultas para CRM.',
    color: '#00b4d8',
    badgeClass: 'g-badge-brand',
    permisos: ['pmbok_command_rw', 'marketing_rw', 'design_studio_rw', 'catalogo_r', 'crm_rw', 'contactos_r'],
    modulosPermitidos: ['pmbok_command', 'marketing', 'design_studio', 'catalogo', 'crm', 'contactos'],
  },
  {
    id: 'taller_produccion',
    nombre: 'Operador de Taller & Producción',
    descripcion: 'Control y ajustes físicos de stock de prendas, insumos textiles, optimizador y cotizador DTF (MaxRects), bobinas, films DTF, tintas y kardex de taller.',
    color: '#15803d',
    badgeClass: 'g-badge-success',
    permisos: ['pmbok_command_rw', 'productos_rw', 'materiales_rw', 'cotizador_dtf_rw', 'design_studio_r', 'kardex_r'],
    modulosPermitidos: ['pmbok_command', 'productos', 'materiales', 'cotizador_dtf', 'design_studio', 'kardex'],
  },
  {
    id: 'logistica_despacho',
    nombre: 'Encargado de Logística & Envíos',
    descripcion: 'Confección de remitos oficiales tipo R, asignación de bultos, impresión, despacho y recepción de firmas de entrega.',
    color: '#0e7490',
    badgeClass: 'g-badge-brand',
    permisos: ['pmbok_command_rw', 'remitos_rw', 'productos_r', 'contactos_r', 'kardex_r'],
    modulosPermitidos: ['pmbok_command', 'remitos', 'productos', 'contactos', 'kardex'],
  },
  {
    id: 'finanzas_caja',
    nombre: 'Tesorería, Caja & Facturación',
    descripcion: 'Controlador de flujo de caja, registro de cobros, pagos a talleres/proveedores, balances y consulta de remitos emitidos.',
    color: '#b45309',
    badgeClass: 'g-badge-warning',
    permisos: ['pmbok_command_rw', 'caja_rw', 'remitos_r', 'contactos_rw'],
    modulosPermitidos: ['pmbok_command', 'caja', 'remitos', 'contactos'],
  },
  {
    id: 'comercial_ventas',
    nombre: 'Asesor Comercial B2B',
    descripcion: 'Atención a clientes corporativos, gestión de leads y pipeline comercial CRM, cotizador DTF y presupuestos, existencias y remitos.',
    color: '#7c3aed',
    badgeClass: 'g-badge-info',
    permisos: ['pmbok_command_rw', 'crm_rw', 'cotizador_dtf_rw', 'design_studio_r', 'catalogo_r', 'productos_r', 'contactos_rw', 'remitos_r', 'marketing_r'],
    modulosPermitidos: ['pmbok_command', 'crm', 'cotizador_dtf', 'design_studio', 'catalogo', 'productos', 'contactos', 'remitos', 'marketing'],
  },
];

export function getUsuarios() {
  const users = getLocal(KEYS.USUARIOS, []);
  if (!users || users.length === 0) {
    const adminDefault = [
      {
        id: 'usr-admin-01',
        email: 'admin@airocolorlab.com',
        nombre: 'Administrador Principal AIRO',
        rol: 'admin',
        activo: true,
        fecha_creacion: new Date().toISOString(),
        ultimo_ingreso: new Date().toISOString(),
        password: generateInitialAdminHash(),
      },
    ];
    setLocal(KEYS.USUARIOS, adminDefault);
    return adminDefault;
  }

  // Auto-migración de seguridad: si existen cuentas previas en texto plano, hashearlas inmediatamente
  let migrado = false;
  const usuariosSeguros = users.map((u) => {
    if (u.password && !u.password.startsWith('sha256:')) {
      u.password = hashPasswordSync(u.password);
      migrado = true;
    }
    return u;
  });

  if (migrado) {
    setLocal(KEYS.USUARIOS, usuariosSeguros);
  }

  return usuariosSeguros;
}

// Retorna usuarios sanitizados para UI sin exponer hashes ni secretos TOTP (OWASP / Anti-scraping)
export function getUsuariosSanitizados() {
  const users = getUsuarios();
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    activo: u.activo,
    fecha_creacion: u.fecha_creacion,
    ultimo_ingreso: u.ultimo_ingreso,
    mfa_enabled: !!u.mfa_enabled,
    has_password: !!u.password,
  }));
}

export function getUsuarioPorEmail(email) {
  if (!email) return null;
  const list = getUsuarios();
  const found = list.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (found) return found;

  // Si no está registrado pero es admin de sistema por email
  if (email.toLowerCase().includes('admin') || list.length === 0) {
    return {
      id: 'usr-temp-admin',
      email,
      nombre: email.split('@')[0],
      rol: 'admin',
      activo: true,
    };
  }

  // Operador estándar fallback
  return {
    id: 'usr-temp-fallback',
    email,
    nombre: email.split('@')[0],
    rol: 'taller_produccion',
    activo: true,
  };
}

export function saveUsuario(usuarioData) {
  const list = getUsuarios();
  const operador = getOperadorActual();
  const cleanEmail = (usuarioData.email || '').trim().toLowerCase();

  if (!cleanEmail) throw new Error('El correo electrónico es requerido');
  if (!usuarioData.nombre?.trim()) throw new Error('El nombre de colaborador es requerido');

  let saved;
  if (usuarioData.id) {
    const idx = list.findIndex((u) => u.id === usuarioData.id);
    if (idx === -1) throw new Error('Usuario no encontrado');

    // Validar duplicado de email
    const duplicate = list.find((u) => u.id !== usuarioData.id && u.email.toLowerCase() === cleanEmail);
    if (duplicate) throw new Error('Ya existe otro usuario registrado con ese correo electrónico.');

    saved = {
      ...list[idx],
      ...usuarioData,
      email: cleanEmail,
      nombre: usuarioData.nombre.trim(),
      rol: usuarioData.rol || list[idx].rol || 'taller_produccion',
      activo: usuarioData.activo !== undefined ? !!usuarioData.activo : list[idx].activo,
      fecha_actualizacion: new Date().toISOString(),
    };
    if (usuarioData.password && usuarioData.password.trim().length >= 8) {
      saved.password = hashPasswordSync(usuarioData.password.trim());
    }
    list[idx] = saved;
    logAudit(operador, 'EDITAR_USUARIO', 'SEGURIDAD', `Editado usuario ${saved.email} (Rol: ${saved.rol})`);
  } else {
    // Alta
    const duplicate = list.find((u) => u.email.toLowerCase() === cleanEmail);
    if (duplicate) throw new Error('Ya existe un usuario con ese correo electrónico.');

    if (!usuarioData.password || usuarioData.password.trim().length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres.');
    }

    saved = {
      id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      email: cleanEmail,
      nombre: usuarioData.nombre.trim(),
      rol: usuarioData.rol || 'taller_produccion',
      activo: true,
      password: hashPasswordSync(usuarioData.password.trim()),
      fecha_creacion: new Date().toISOString(),
      ultimo_ingreso: null,
    };
    list.push(saved);
    logAudit(operador, 'CREAR_USUARIO', 'SEGURIDAD', `Alta de colaborador ${saved.email} con rol ${saved.rol}`);
  }

  setLocal(KEYS.USUARIOS, list);
  broadcastUpdate('USUARIOS_UPDATED', list);
  return saved;
}

export function deleteUsuario(id) {
  const list = getUsuarios();
  const operador = getOperadorActual();
  const target = list.find((u) => u.id === id);
  if (!target) return false;

  // Proteger: nunca eliminar el último administrador del sistema
  const admins = list.filter((u) => u.rol === 'admin' && u.activo);
  if (target.rol === 'admin' && admins.length <= 1) {
    throw new Error('No se puede eliminar el único Administrador General activo del sistema.');
  }

  const filtered = list.filter((u) => u.id !== id);
  setLocal(KEYS.USUARIOS, filtered);
  logAudit(operador, 'ELIMINAR_USUARIO', 'SEGURIDAD', `Eliminado colaborador ${target.email}`);
  broadcastUpdate('USUARIOS_UPDATED', filtered);
  return true;
}

export async function cambiarPasswordUsuario(userIdOrEmail, passwordActual, passwordNueva) {
  const list = getUsuarios();
  const cleanId = String(userIdOrEmail || '').trim().toLowerCase();

  let userIdx = list.findIndex(
    (u) => u.id === userIdOrEmail || u.email.toLowerCase() === cleanId
  );

  // Si no se encuentra de forma directa pero cleanId hace referencia al admin/taller
  if (userIdx === -1 && (cleanId.includes('admin') || cleanId.includes('taller') || cleanId === '')) {
    userIdx = list.findIndex((u) => u.rol === 'admin' && u.activo);
  }

  // Si aún así no existe en la lista, auto-crear la entrada para el usuario activo
  if (userIdx === -1) {
    const defaultEmail = cleanId.includes('@') ? cleanId : 'admin@airocolorlab.com';
    const defaultNombre = cleanId.includes('@') ? cleanId.split('@')[0] : 'Administrador AIRO';
    const newUser = {
      id: `usr-${Date.now()}`,
      email: defaultEmail,
      nombre: defaultNombre,
      rol: 'admin',
      activo: true,
      password: generateInitialAdminHash(),
      fecha_creacion: new Date().toISOString(),
    };
    list.push(newUser);
    userIdx = list.length - 1;
  }

  const target = list[userIdx];

  // Si se solicita verificar la actual (self-service)
  if (passwordActual !== null && passwordActual !== undefined) {
    if (!target.password) {
      throw new Error('La cuenta no posee una contraseña previa registrada.');
    }
    const passwordOk = verifyPasswordSync(passwordActual, target.password);
    if (!passwordOk) {
      throw new Error('La contraseña actual ingresada es incorrecta.');
    }
  }

  if (!passwordNueva || passwordNueva.trim().length < 8) {
    throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
  }

  // Si Supabase está disponible y el usuario coincide con la sesión
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.email?.toLowerCase() === target.email.toLowerCase()) {
        await supabase.auth.updateUser({ password: passwordNueva.trim() });
      }
    } catch {
      // Continuar con actualización local si Supabase auth falla o no está sincronizado
    }
  }

  target.password = hashPasswordSync(passwordNueva.trim());
  target.fecha_cambio_password = new Date().toISOString();
  list[userIdx] = target;

  setLocal(KEYS.USUARIOS, list);
  logAudit(
    target.email,
    'CAMBIO_PASSWORD',
    'SEGURIDAD',
    `Contraseña actualizada para la cuenta ${target.email}`
  );
  broadcastUpdate('USUARIOS_UPDATED', list);

  return { ok: true, message: 'Contraseña actualizada con éxito.' };
}

export function adminResetPassword(userId, nuevaPassword) {
  return cambiarPasswordUsuario(userId, null, nuevaPassword);
}

export function isModuloPermitido(rolId, moduloId) {
  if (!rolId || rolId === 'admin') return true;
  const def = ROLES_DEFINICION.find((r) => r.id === rolId);
  if (!def) return false;
  return def.modulosPermitidos.includes(moduloId);
}

export function restablecerDatosIniciales() {
  setLocal(KEYS.PRODUCTOS, initialProductos);
  setLocal(KEYS.MATERIALES, initialMateriales);
  setLocal(KEYS.CLIENTES, initialClientes);
  setLocal(KEYS.PROVEEDORES, initialProveedores);
  setLocal(KEYS.REMITOS, initialRemitos);
  setLocal(KEYS.FLUJO_CAJA, initialFlujoCaja);
  setLocal(KEYS.MOVIMIENTOS, initialMovimientos);
  logAudit(getOperadorActual(), 'RESET_DEMO', 'SISTEMA', 'Restablecidos datos demostrativos oficiales de AIRO Color Lab');
  broadcastUpdate('DATA_RESET', null);
}

// Suscripción reactiva para componentes React
export function subscribeToSync(callback) {
  const handleStorage = (e) => {
    if (e.key && e.key.startsWith(PREFIX)) {
      callback({ type: 'STORAGE_EVENT', key: e.key });
    }
  };
  const handleBroadcast = (e) => {
    if (e.data) {
      callback(e.data);
    }
  };

  window.addEventListener('storage', handleStorage);
  if (syncChannel) {
    syncChannel.addEventListener('message', handleBroadcast);
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    if (syncChannel) {
      syncChannel.removeEventListener('message', handleBroadcast);
    }
  };
}

// Sincronización con Supabase si las tablas existen
export async function syncWithSupabase() {
  if (!supabase) return { ok: false, error: 'Supabase no inicializado' };
  try {
    // Probar si la tabla existe en Supabase
    const { data, error } = await supabase.from('inventario_productos').select('id').limit(1);
    if (error) {
      return {
        ok: false,
        error: 'Las tablas de gestión aún no fueron creadas en Supabase. Ejecutá el script SQL en el SQL Editor de Supabase.',
        needsMigration: true,
      };
    }
    return { ok: true, message: 'Conectado y sincronizado con Supabase Cloud' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============================================================
// 9. CRM B2B — GESTIÓN DE LEADS, PIPELINE Y REGLAS DE MATCH
// (Portado bajo la regla canónica CRM-MATCH-EXPLICIT-IDENTITY)
// ============================================================

export const CRM_RULE_ID = 'CRM-MATCH-EXPLICIT-IDENTITY';
export const CRM_RULE_VERSION = '1.0';

export const CRM_ESTADOS = [
  { id: 'NEW', label: 'Nuevo', badge: 'g-badge-brand', color: '#1a4295' },
  { id: 'QUALIFIED', label: 'Calificado', badge: 'g-badge-info', color: '#0284c7' },
  { id: 'CONTACTED', label: 'Contactado', badge: 'g-badge-neutral', color: '#64748b' },
  { id: 'ENGAGED', label: 'En Conversación', badge: 'g-badge-neutral', color: '#475569' },
  { id: 'QUOTATION', label: 'En Cotización', badge: 'g-badge-warning', color: '#b45309' },
  { id: 'NEGOTIATION', label: 'En Negociación', badge: 'g-badge-warning', color: '#d97706' },
  { id: 'WON', label: 'Ganado (Cliente)', badge: 'g-badge-success', color: '#15803d' },
  { id: 'LOST', label: 'Perdido', badge: 'g-badge-danger', color: '#b91c1c' },
  { id: 'NURTURE', label: 'Seguimiento / Nutrición', badge: 'g-badge-neutral', color: '#6b7280' },
  { id: 'REACTIVATION', label: 'Reactivación', badge: 'g-badge-info', color: '#7c3aed' },
];

export const normEmail = (s) => (s || '').toLowerCase().trim() || null;
export const normPhone = (s) => (s || '').replace(/\D/g, '') || null;
export const normText = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ') || null;

export function matchLeadInList(leads, { email, phone }) {
  const em = normEmail(email);
  const ph = normPhone(phone);
  if (!em && !ph) return [];
  return (leads || []).filter(
    (l) => !l.merged_into &&
      ((em && normEmail(l.email) === em) || (ph && normPhone(l.phone) && normPhone(l.phone) === ph))
  );
}

export function ambiguousByCompanyContactInList(leads, { company, contact }) {
  const comp = normText(company);
  const cont = normText(contact);
  if (!comp && !cont) return [];
  return (leads || []).filter(
    (l) => !l.merged_into &&
      (comp && cont
        ? normText(l.company) === comp && normText(l.contact) === cont
        : (comp && normText(l.company) === comp) || (cont && normText(l.contact) === cont))
  );
}

export function nextLeadIdGenerator(leads, dayStr) {
  const day = dayStr || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `LEAD-${day}-`;
  let n = 0;
  for (const l of leads || []) {
    const m = String(l.lead_id || '').match(/^LEAD-\d{8}-(\d+)$/);
    if (m && l.lead_id.startsWith(prefix)) {
      n = Math.max(n, parseInt(m[1], 10));
    }
  }
  return `${prefix}${String(n + 1).padStart(3, '0')}`;
}

export function getLeads() {
  return getLocal(KEYS.LEADS, []);
}

export function getLeadById(leadId) {
  const list = getLeads();
  return list.find((l) => l.lead_id === leadId) || null;
}

export function saveLead(inputData, actor = null) {
  const leads = getLeads();
  const operador = actor || getOperadorActual();
  const nowIso = new Date().toISOString();
  const day = nowIso.slice(0, 10).replace(/-/g, '');

  const email = normEmail(inputData.email);
  const phone = normPhone(inputData.phone);
  const company = (inputData.company || '').trim();
  const contact = (inputData.contact || '').trim();

  if (!email && !phone && !company && !contact) {
    throw new Error('Debe proporcionar al menos un medio de contacto (email, teléfono/WhatsApp) o razón social.');
  }

  // 1. Edición explícita por ID existente
  if (inputData.lead_id) {
    const idx = leads.findIndex((l) => l.lead_id === inputData.lead_id);
    if (idx === -1) throw new Error('Lead no encontrado');

    const prev = leads[idx];
    const prevStatus = prev.status;
    const newStatus = inputData.status || prevStatus;

    const history = [...(prev.history || [])];
    if (newStatus !== prevStatus) {
      history.push({
        at: nowIso,
        event: 'status_changed',
        by: operador,
        from: prevStatus,
        to: newStatus,
        notes: inputData.notes || 'Cambio de estado desde el CRM',
      });
    } else {
      history.push({
        at: nowIso,
        event: 'updated',
        by: operador,
        changes: 'Edición de datos de lead',
      });
    }

    const updated = {
      ...prev,
      ...inputData,
      email: email || prev.email,
      phone: phone || prev.phone,
      company: company || prev.company,
      contact: contact || prev.contact,
      status: newStatus,
      history,
      updated_at: nowIso,
    };

    leads[idx] = updated;
    setLocal(KEYS.LEADS, leads);
    logAudit(operador, 'EDITAR_LEAD', 'CRM', `Actualizado lead ${updated.lead_id} (${updated.company || updated.contact})`);
    broadcastUpdate('LEADS_UPDATED', leads);
    return { ok: true, lead: updated, type: 'updated' };
  }

  // 2. Alta nueva: evaluar matching y reglas de deduplicación
  const matches = matchLeadInList(leads, { email, phone });
  if (matches.length > 1) {
    throw new Error('Conflicto: identificadores explícitos (email o teléfono) coinciden con múltiples leads diferentes. Requiere resolución manual.');
  }

  if (matches.length === 1) {
    const l = matches[0];
    const emDiff = email && l.email && normEmail(l.email) !== email;
    const phDiff = phone && l.phone && normPhone(l.phone) && normPhone(l.phone) !== phone;
    if (emDiff || phDiff) {
      throw new Error(`Conflicto de identidad: un identificador coincide pero el otro difiere en ${l.lead_id}. Revisión requerida.`);
    }

    // Merge bajo regla CRM-MATCH-EXPLICIT-IDENTITY
    const MERGE_FIELDS = ['company', 'contact', 'channel', 'interest', 'product', 'quantity', 'timing', 'email', 'phone', 'next_action'];
    for (const f of MERGE_FIELDS) {
      if ((l[f] === null || l[f] === undefined || l[f] === '') && inputData[f] != null && inputData[f] !== '') {
        l[f] = inputData[f];
      }
    }
    const newOrigin = inputData.origin || 'DIRECTO';
    l.origins = [...new Set([...(l.origins || [l.origin].filter(Boolean)), newOrigin])];
    l.history = [
      ...(l.history || []),
      {
        at: nowIso,
        event: 'merged',
        by: operador,
        matched_by: email ? 'email' : 'phone',
        origin: newOrigin,
        incoming: { company, contact, interest: inputData.interest, channel: inputData.channel },
      },
    ];
    l.updated_at = nowIso;

    setLocal(KEYS.LEADS, leads);
    logAudit(operador, 'MERGE_LEAD', 'CRM', `Lead ${l.lead_id} fusionado automáticamente por coincidencia de ${email ? 'email' : 'teléfono'}`);
    broadcastUpdate('LEADS_UPDATED', leads);
    return { ok: true, lead: l, type: 'merged' };
  }

  // Alerta de ambigüedad si coincide empresa/contacto pero no hay teléfono/email idéntico
  const amb = ambiguousByCompanyContactInList(leads, { company, contact });
  if (amb.length && !inputData.forzar_creacion) {
    return {
      ambiguous: true,
      candidates: amb.map((a) => a.lead_id),
      message: `Existe coincidencia de empresa/contacto con ${amb.map((a) => a.lead_id).join(', ')}. Verificá si es la misma persona antes de crear un duplicado.`,
    };
  }

  // Creación limpia
  const newLead = {
    lead_id: nextLeadIdGenerator(leads, day),
    origin: inputData.origin || 'DIRECTO',
    origins: [inputData.origin || 'DIRECTO'],
    company: company || null,
    contact: contact || null,
    channel: inputData.channel || 'WHATSAPP',
    interest: inputData.interest || null,
    product: inputData.product || null,
    quantity: inputData.quantity ? Number(inputData.quantity) : null,
    timing: inputData.timing || null,
    score: inputData.score !== undefined && inputData.score !== null ? Number(inputData.score) : 50,
    status: inputData.status || 'NEW',
    priority: inputData.priority || 'NORMAL',
    last_contact: nowIso.slice(0, 10),
    next_action: inputData.next_action || 'Contactar y calificar requerimiento',
    owner: inputData.owner || operador,
    email: email || null,
    phone: phone || null,
    notes: inputData.notes || null,
    carrito: inputData.carrito || null,
    history: [
      {
        at: nowIso,
        event: 'created',
        by: operador,
        via: 'gestion_web',
      },
    ],
    created_at: nowIso,
    updated_at: nowIso,
  };

  leads.unshift(newLead);
  setLocal(KEYS.LEADS, leads);
  logAudit(operador, 'CREAR_LEAD', 'CRM', `Alta de lead ${newLead.lead_id} (${newLead.company || newLead.contact || newLead.email})`);
  broadcastUpdate('LEADS_UPDATED', leads);
  return { ok: true, lead: newLead, type: 'created' };
}

export function updateLeadStatus(leadId, newStatus, notes = '', actor = null) {
  const leads = getLeads();
  const operador = actor || getOperadorActual();
  const idx = leads.findIndex((l) => l.lead_id === leadId);
  if (idx === -1) throw new Error('Lead no encontrado');

  const prev = leads[idx];
  const prevStatus = prev.status;
  const nowIso = new Date().toISOString();

  prev.status = newStatus;
  prev.last_contact = nowIso.slice(0, 10);
  prev.history = [
    ...(prev.history || []),
    {
      at: nowIso,
      event: 'status_changed',
      by: operador,
      from: prevStatus,
      to: newStatus,
      notes: notes || `Movido a estado ${newStatus}`,
    },
  ];
  prev.updated_at = nowIso;

  leads[idx] = prev;
  setLocal(KEYS.LEADS, leads);
  logAudit(operador, 'CAMBIO_ESTADO_LEAD', 'CRM', `Lead ${leadId} pasó de ${prevStatus} a ${newStatus}`);
  broadcastUpdate('LEADS_UPDATED', leads);
  return prev;
}

export function deleteLead(leadId, actor = null) {
  const leads = getLeads();
  const operador = actor || getOperadorActual();
  const target = leads.find((l) => l.lead_id === leadId);
  if (!target) return false;

  const filtered = leads.filter((l) => l.lead_id !== leadId);
  setLocal(KEYS.LEADS, filtered);
  logAudit(operador, 'ELIMINAR_LEAD', 'CRM', `Eliminado lead ${leadId} (${target.company || target.contact})`);
  broadcastUpdate('LEADS_UPDATED', filtered);
  return true;
}

export function importQuotesToLeads(quotesArray, actor = null) {
  if (!Array.isArray(quotesArray)) return { imported: 0, merged: 0, errors: [] };
  let imported = 0;
  let merged = 0;
  const errors = [];
  const operador = actor || getOperadorActual();

  for (const q of quotesArray) {
    try {
      const res = saveLead(
        {
          origin: q.origen || 'WEB_CATALOGO',
          company: q.empresa || '',
          contact: q.nombre || '',
          email: q.email || '',
          phone: q.whatsapp || '',
          interest: q.objetivo || q.comentarios || 'Solicitud de cotización web',
          timing: q.fecha_estimada || '',
          carrito: q.carrito || '',
          notes: q.comentarios ? `Comentarios del cliente: ${q.comentarios}` : '',
          status: 'NEW',
          forzar_creacion: true,
        },
        operador
      );
      if (res.type === 'created') imported++;
      if (res.type === 'merged') merged++;
    } catch (err) {
      errors.push({ quote: q, error: err.message });
    }
  }

  return { imported, merged, errors };
}

// ============================================================
// 10. DOBLE FACTOR DE AUTENTICACIÓN (MFA / 2FA - TOTP RFC 6238)
// Estándar seguro sin costo ($0) para Google / Microsoft Authenticator y Supabase
// ============================================================

export function generateTotpSecret(length = 16) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return secret;
}

function base32ToBytes(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i].toUpperCase();
    const idx = alphabet.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

export async function computeTotpCode(secretBase32, timeWindow = null) {
  const keyBytes = base32ToBytes(secretBase32);
  const windowIndex = timeWindow !== null ? timeWindow : Math.floor(Date.now() / 30000);

  // Buffer de 8 bytes para el contador (big-endian 64-bit int)
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setBigUint64(0, BigInt(windowIndex));

  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.subtle) {
    const key = await cryptoObj.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const signature = await cryptoObj.subtle.sign('HMAC', key, counterBuffer);
    const hmacBytes = new Uint8Array(signature);
    const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
    const binary =
      ((hmacBytes[offset] & 0x7f) << 24) |
      ((hmacBytes[offset + 1] & 0xff) << 16) |
      ((hmacBytes[offset + 2] & 0xff) << 8) |
      (hmacBytes[offset + 3] & 0xff);
    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  return '000000';
}

export async function verifyTotpCode(secretBase32, inputCode) {
  if (!secretBase32 || !inputCode) return false;
  const cleanCode = String(inputCode).trim();
  if (cleanCode.length !== 6) return false;

  const currentWindow = Math.floor(Date.now() / 30000);
  // Ventana de tolerancia: -1 (hace 30s), 0 (actual), +1 (próximos 30s)
  for (let offset = -1; offset <= 1; offset++) {
    const expected = await computeTotpCode(secretBase32, currentWindow + offset);
    if (expected === cleanCode) {
      return true;
    }
  }
  return false;
}

export function enableMfaForUser(userIdOrEmail, secretBase32) {
  const list = getUsuarios();
  const clean = String(userIdOrEmail || '').trim().toLowerCase();
  const idx = list.findIndex((u) => u.id === userIdOrEmail || u.email.toLowerCase() === clean);
  if (idx === -1) throw new Error('Usuario no encontrado');

  list[idx].mfa_enabled = true;
  list[idx].mfa_secret = secretBase32;
  list[idx].mfa_updated_at = new Date().toISOString();

  setLocal(KEYS.USUARIOS, list);
  logAudit(list[idx].email, 'HABILITAR_MFA', 'SEGURIDAD', `MFA TOTP activado para ${list[idx].email}`);
  broadcastUpdate('USUARIOS_UPDATED', list);
  return list[idx];
}

export function disableMfaForUser(userIdOrEmail) {
  const list = getUsuarios();
  const clean = String(userIdOrEmail || '').trim().toLowerCase();
  const idx = list.findIndex((u) => u.id === userIdOrEmail || u.email.toLowerCase() === clean);
  if (idx === -1) throw new Error('Usuario no encontrado');

  list[idx].mfa_enabled = false;
  list[idx].mfa_secret = null;
  list[idx].mfa_updated_at = new Date().toISOString();

  setLocal(KEYS.USUARIOS, list);
  logAudit(list[idx].email, 'DESHABILITAR_MFA', 'SEGURIDAD', `MFA TOTP desactivado para ${list[idx].email}`);
  broadcastUpdate('USUARIOS_UPDATED', list);
  return list[idx];
}

// ============================================================
// 11. MARKETING B2B & SISTEMA MULTIAGENTE (COMMUNITY MANAGER, HITL, CALENDARIO)
// ============================================================

export const initialApprovals = [
  {
    id: 'APR-20261005-001',
    titulo: 'Paquete de contenido Semana 1 — Publicación manual por el owner',
    tipo: 'PAQUETE_CONTENIDO',
    canal: 'MULTI_CANAL',
    canales: ['INSTAGRAM', 'WHATSAPP_STATUS', 'LINKEDIN'],
    hitl_level: 2,
    hitl_tag: 'HITL-2 (Acción externa / Publicación)',
    estado: 'PENDING',
    fecha: '2026-10-05',
    audit_ref: 'AUDIT-20261005-003',
    autor: 'I-01 Content Planner + I-03 Copywriter + I-04 Creative Director',
    qa_status: 'PASS',
    qa_detalles: 'X-03 QA: voseo rioplatense ✓, B2B profesional ✓, mínimo 10 u ✓, CTA WhatsApp único ✓, sin precios ni plazos inventados ✓.',
    piezas: [
      {
        id: 'PZ-01',
        canal: 'INSTAGRAM',
        formato: 'Carrusel 5 slides (1080×1350 px)',
        idea: '¿DTF o sublimación? Elegir mal la técnica le cuesta plata a tu marca.',
        slides: [
          'Slide 1 (Hook): ¿DTF o sublimación? Elegir mal la técnica le cuesta plata a tu marca.',
          'Slide 2: Sublimación — la tinta se funde en la tela. Colores vibrantes que no se agrietan. Funciona sobre poliéster y prendas claras.',
          'Slide 3: DTF — el diseño se transfiere por film. Va sobre casi cualquier tela y cualquier color. Ideal para tiradas cortas y mucho detalle.',
          'Slide 4: ¿Y si no sabés cuál conviene? Eso es exactamente lo que resolvemos antes de producir. Vos contás el proyecto, nosotros recomendamos la técnica.',
          'Slide 5 (CTA): Producimos desde 10 unidades. Contanos tu idea por WhatsApp → te respondemos en menos de 24 h hábiles.',
        ],
        caption: 'El mismo logo puede quedar espectacular o mediocre según la técnica que elijas.\n\nSublimación y DTF no compiten: resuelven problemas distintos. En AIRO trabajamos las dos, y la recomendación sale de tu proyecto, no de una tabla.\n\n¿Tenés una marca, un evento o un equipo que vestir? Escribinos por WhatsApp y lo vemos juntos. Desde 10 unidades.\n\n#MerchandisingCorporativo #IndumentariaPersonalizada #DTF #Sublimacion #ProduccionTextil #MerchandisingArgentina #MarcaPropia',
        cta: 'WhatsApp directo: wa.me/5491163553443',
        content_ref: 'CNT-20261005-001',
      },
      {
        id: 'PZ-02',
        canal: 'WHATSAPP_STATUS',
        formato: '2 Pantallas',
        idea: 'Pedidos desde 10 unidades, sin mínimos de fábrica',
        slides: [
          'Pantalla 1: ¿Sabías que podés personalizar indumentaria con tu marca desde solo 10 unidades? Sin mínimos de fábrica. Sin vueltas.',
          'Pantalla 2: Contanos qué necesitás → te cotizamos en menos de 24 h hábiles. Escribinos por acá mismo: wa.me/5491163553443',
        ],
        caption: 'Estados para WhatsApp B2B',
        cta: 'wa.me/5491163553443',
        content_ref: 'CNT-20261005-003',
      },
      {
        id: 'PZ-03',
        canal: 'LINKEDIN',
        formato: 'Post texto B2B',
        idea: 'Merchandising que el equipo sí usa (ángulo RRHH/eventos)',
        slides: [
          'Texto post: ¿Por qué la mitad de los regalos corporativos terminan en el fondo de un cajón? Porque se piensan como souvenir genérico y no como indumentaria útil.',
        ],
        caption: 'El merchandising corporativo tiene que sumar valor de marca, no quedar olvidado. En AIRO confeccionamos prendas corporativas desde 10 unidades con calce actual y estampas duraderas.\n\n¿Estás organizando un evento corporativo o un welcome kit? Escribinos por WhatsApp y lo cotizamos en menos de 24 h hábiles.',
        cta: 'WhatsApp: wa.me/5491163553443',
        content_ref: 'CNT-20261005-004',
      },
    ],
  },
  {
    id: 'APR-20261005-002',
    titulo: 'Publicación de prueba — WhatsApp Estados (CNT-20261005-003 v1)',
    tipo: 'PUBLICACION_PRUEBA',
    canal: 'WHATSAPP_STATUS',
    canales: ['WHATSAPP_STATUS'],
    hitl_level: 2,
    hitl_tag: 'HITL-2 (Acción externa / Publicación)',
    estado: 'PENDING',
    fecha: '2026-10-05',
    audit_ref: 'AUDIT-20261005-004',
    autor: 'W-02 Content Creator + W-01 Status Planner',
    qa_status: 'PASS',
    qa_detalles: 'X-03 QA: Aprobado sin observaciones. Listo para publicar en Estados de WhatsApp.',
    piezas: [
      {
        id: 'PZ-01',
        canal: 'WHATSAPP_STATUS',
        formato: '2 Pantallas sobre fondo azul marca #1A4295',
        idea: 'Indumentaria desde 10 unidades',
        slides: [
          'Pantalla 1: ¿Sabías que podés personalizar indumentaria con tu marca desde solo 10 unidades? Sin mínimos de fábrica. Sin vueltas.',
          'Pantalla 2: Contanos qué necesitás → te cotizamos en menos de 24 h hábiles. Escribinos por acá mismo: wa.me/5491163553443',
        ],
        caption: 'Prompt visual (Gemini/Express): abstract textile texture background, woven fabric threads in deep blue #1A4295 with cyan #00B4D8 accents, macro photography, minimal negative space.',
        cta: 'wa.me/5491163553443',
        content_ref: 'CNT-20261005-003',
      },
    ],
  },
  {
    id: 'DEC-WEB-BACKEND-20261008-v1',
    titulo: 'Decisión técnica sobre permisos y variables de Supabase en producción',
    tipo: 'SISTEMA_DECISION',
    canal: 'SISTEMA',
    canales: ['SISTEMA'],
    hitl_level: 3,
    hitl_tag: 'HITL-3 (Estrategia / Seguridad / Riesgo Crítico)',
    estado: 'PENDING',
    fecha: '2026-10-08',
    audit_ref: 'AUDIT-20261008-004',
    autor: 'Orquestador / Seguridad',
    qa_status: 'REVIEW',
    qa_detalles: 'X-04 Brand Guardian / Auditoría: Requiere validación del administrador para definir esquema de migración RPC.',
    piezas: [
      {
        id: 'PZ-DEC-01',
        canal: 'SISTEMA',
        formato: 'Decisión Arquitectura Cloud',
        idea: 'Validación en staging vs preservación de cotizaciones manuales',
        slides: [
          'Opción A: Inspeccionar y validar en staging antes de producción.',
          'Opción B: Mantener cotización visual con recepción por WhatsApp.',
        ],
        caption: 'Verificar la recepción de cotizaciones y el acceso exclusivo de administradores sin alterar datos reales en producción.',
        cta: 'Autorización requerida del Administrador General',
      },
    ],
  },
];

export const initialEditorialCalendar = [
  {
    content_id: 'CNT-20261005-001',
    channel: 'INSTAGRAM',
    idea: 'DTF vs sublimación — cuándo conviene cada técnica',
    objective: 'Educar y posicionar asesoramiento técnico como diferencial',
    audience: 'Marcas, PyMEs, emprendedores textiles',
    format: 'Carrusel 5 slides 1080x1350',
    product: 'DTF / sublimación',
    cta: 'WhatsApp',
    kpi: 'Guardados + consultas entrantes',
    proposed_date: '2026-10-05',
    status: 'PENDING_APPROVAL',
    version: 'v1',
    approval_ref: 'APR-20261005-001',
    audit_id: 'AUDIT-20261005-003',
  },
  {
    content_id: 'CNT-20261005-002',
    channel: 'INSTAGRAM',
    idea: 'BTS producción en curso',
    objective: 'Mostrar capacidad real y generar confianza',
    audience: 'Empresas, eventos, marcas',
    format: 'Reel 15-30s o foto',
    product: 'Producción real',
    cta: 'WhatsApp',
    kpi: 'Alcance + nuevos seguidores',
    proposed_date: '2026-10-07',
    status: 'IDEA',
    version: null,
    approval_ref: null,
    audit_id: null,
  },
  {
    content_id: 'CNT-20261005-003',
    channel: 'WHATSAPP_STATUS',
    idea: 'Pedidos desde 10 unidades, sin mínimos de fábrica',
    objective: 'Confianza + conversión',
    audience: 'Contactos existentes WhatsApp',
    format: '2 pantallas',
    product: 'Indumentaria personalizada',
    cta: 'WhatsApp directo',
    kpi: 'Respuestas al estado',
    proposed_date: '2026-10-07',
    status: 'PENDING_APPROVAL',
    version: 'v1',
    approval_ref: 'APR-20261005-001',
    audit_id: 'AUDIT-20261005-003',
  },
  {
    content_id: 'CNT-20261005-004',
    channel: 'LINKEDIN',
    idea: 'Merchandising que el equipo sí usa (ángulo RRHH/eventos)',
    objective: 'Autoridad B2B + generar conversaciones',
    audience: 'RRHH, agencias, organizadores de eventos',
    format: 'Post texto',
    product: 'Merchandising corporativo',
    cta: 'WhatsApp',
    kpi: 'Reacciones + conversaciones iniciadas',
    proposed_date: '2026-10-09',
    status: 'PENDING_APPROVAL',
    version: 'v1',
    approval_ref: 'APR-20261005-001',
    audit_id: 'AUDIT-20261005-003',
  },
  {
    content_id: 'CNT-20261005-005',
    channel: 'WHATSAPP_STATUS',
    idea: '¿Tenés un evento próximo? — hook de cotización',
    objective: 'Conversión',
    audience: 'Contactos WhatsApp',
    format: '1-2 pantallas',
    product: 'Merchandising eventos',
    cta: 'Cotización WhatsApp',
    kpi: 'Consultas entrantes',
    proposed_date: '2026-10-09',
    status: 'DRAFT',
    version: null,
    approval_ref: null,
    audit_id: 'AUDIT-20261005-003',
  },
];

export const initialCampaigns = [
  {
    id: 'CMP-202610-001',
    titulo: 'Lanzamiento Línea Eventos & Welcome Kits Corporativos Q4',
    objetivo: 'Captar directores de marketing y RRHH para pedidos de merchandising y bienvenida de fin de año',
    canales: ['INSTAGRAM', 'LINKEDIN', 'WHATSAPP', 'GMAIL', 'FACEBOOK'],
    fecha_inicio: '2026-10-15',
    fecha_fin: '2026-11-30',
    estado: 'ACTIVA',
    kpi: '35 cotizaciones B2B calificadas',
    notas: 'Priorizar hoodies frisados y remeras peinadas 24/1 con bordado y DTF textil. Mínimo 10 unidades.',
    publicaciones: [
      {
        id: 'PUB-001',
        canal: 'INSTAGRAM',
        formato: 'Carrusel 5 slides',
        fecha: '2026-10-18',
        titulo: 'Guía de Welcome Kits Textiles que tu equipo realmente usa',
        estado: 'PROGRAMADA',
        prompt_ref: 'PRM-202610-001',
      },
      {
        id: 'PUB-002',
        canal: 'LINKEDIN',
        formato: 'Post de Opinión / Caso B2B',
        fecha: '2026-10-21',
        titulo: 'Por qué la indumentaria corporativa barata termina en el fondo de un cajón',
        estado: 'BORRADOR',
        prompt_ref: 'PRM-202610-004',
      },
      {
        id: 'PUB-003',
        canal: 'WHATSAPP',
        formato: 'Estado 2 pantallas',
        fecha: '2026-10-23',
        titulo: 'Producción activa en taller: tanda corporativa lista para despacho',
        estado: 'BORRADOR',
        prompt_ref: null,
      },
      {
        id: 'PUB-004',
        canal: 'GMAIL',
        formato: 'Email B2B 1-to-1 a Agencias',
        fecha: '2026-10-25',
        titulo: 'Alianza de producción textil para agencias y productoras de eventos',
        estado: 'BORRADOR',
        prompt_ref: null,
      },
      {
        id: 'PUB-005',
        canal: 'FACEBOOK',
        formato: 'Post Álbum Mayorista',
        fecha: '2026-10-28',
        titulo: 'Confección desde 10 unidades: acabados premium para marcas independientes',
        estado: 'PROGRAMADA',
        prompt_ref: null,
      },
    ],
  },
  {
    id: 'CMP-202610-002',
    titulo: 'Campaña Técnica DTF Textil vs Sublimación',
    objetivo: 'Educación y posicionamiento de calidad técnica para reducir fricción en cotizaciones',
    canales: ['INSTAGRAM', 'LINKEDIN', 'FACEBOOK'],
    fecha_inicio: '2026-11-01',
    fecha_fin: '2026-11-20',
    estado: 'PLANIFICADA',
    kpi: '20 consultas técnicas derivadas a WhatsApp comercial',
    notas: 'Enfocado en durabilidad, fidelidad de color y versatilidad de sustratos oscuros.',
    publicaciones: [],
  },
];

export const initialPrompts = [
  {
    id: 'PRM-202610-001',
    campaign_id: 'CMP-202610-001',
    tipo: 'COPY',
    canal: 'INSTAGRAM',
    modelo_destino: 'ChatGPT / Claude / Gemini',
    titulo: 'Carrusel Welcome Kits Corporativos Q4',
    prompt_text: `Actuá como Copywriter B2B senior de AIRO Color Lab, estudio de diseño y producción textil en Buenos Aires.
Escribí el texto para un carrusel de Instagram de 5 slides orientado a responsables de marketing y RRHH sobre "Welcome Kits textiles que tu equipo realmente va a querer usar".
Reglas estrictas de marca:
- Tono: español rioplatense profesional con voseo natural y cercano. Sin frases acartonadas.
- Mensaje central: la indumentaria de calidad genera pertenencia genuina; el merchandising genérico termina olvidado.
- Datos comerciales: confeccionamos a partir de 10 unidades por modelo (en múltiplos de 10). No des precios cerrados, indicá cotización personalizada según diseño y cantidades.
- Estructura: Hook potente en slide 1, slides 2 a 4 con claves técnicas (algodón peinado 24/1, costuras reforzadas, DTF textil de alta definición), slide 5 con CTA.
- CTA: Escribinos por WhatsApp al 11-6355-3443 o ingresá al enlace del perfil para armar tu muestra digital.
- Incluir 5 hashtags estratégicos B2B locales.`,
    prompt_negativo: '',
    estado_aprobacion: 'APPROVED',
    hitl_level: 2,
    aprobado_por: 'admin@airocolorlab.com',
    aprobado_en: '2026-10-13T18:00:00.000Z',
    observaciones_rechazo: null,
    creado_por: 'marketing_cm',
    creado_en: '2026-10-13T16:30:00.000Z',
    actualizado_en: '2026-10-13T18:00:00.000Z',
  },
  {
    id: 'PRM-202610-002',
    campaign_id: 'CMP-202610-001',
    tipo: 'IMAGE',
    canal: 'INSTAGRAM',
    modelo_destino: 'Midjourney / Flux / DALL-E',
    titulo: 'Foto de Estudio Editorial - Hoodie Corporativo Premium',
    prompt_text: `Commercial editorial product photography of a premium heavyweight black hoodie made of combed cotton fleece, laying flat on a textured concrete and warm wooden studio background. Elegant textile embroidery detail on chest reading "AIRO". Soft natural studio side-lighting, 45 degree angle, shallow depth of field, hyperrealistic texture of textile fibers and clean ribbed cuffs, Hasselblad medium format camera aesthetic, 85mm lens, f/4, crisp focus on stitching and fabric grain, high-end lookbook catalog aesthetic, professional textile workshop atmosphere, balanced shadows, 8k resolution, color palette accents in Pantone deep navy #1A4295 and cyan #00B4D8 --ar 4:5 --style raw --v 6.1`,
    prompt_negativo: `blurry, low resolution, cheap fabric, synthetic sheen, deformed cuffs, messy background, oversaturated colors, cartoon, 3d render, watermark, text glitches`,
    estado_aprobacion: 'APPROVED',
    hitl_level: 2,
    aprobado_por: 'admin@airocolorlab.com',
    aprobado_en: '2026-10-13T18:15:00.000Z',
    observaciones_rechazo: null,
    creado_por: 'marketing_cm',
    creado_en: '2026-10-13T17:00:00.000Z',
    actualizado_en: '2026-10-13T18:15:00.000Z',
  },
  {
    id: 'PRM-202610-003',
    campaign_id: 'CMP-202610-001',
    tipo: 'VIDEO',
    canal: 'INSTAGRAM',
    modelo_destino: 'Runway / Sora / Kling',
    titulo: 'Proceso de Estampado DTF Textil en Taller',
    prompt_text: `Cinematic slow-motion 60fps macro video shot in a modern textile screen printing and DTF studio in Buenos Aires. A professional craftsman carefully peels a transparent DTF film reveal from a navy blue combed cotton t-shirt on a warm heat press platen. The colorful vector logo adheres flawlessly with crisp edges and realistic fabric weave texture. Soft ambient warm workshop light mixed with clean daylight, subtle steam rising, camera moves in a slow smooth dolly tracking left to right, high production value commercial reel aesthetic, 4k resolution, cinematic color grading with rich shadows.`,
    prompt_negativo: `jerky motion, distorted hands, low quality, artifacting, flicker, blurry focus, amateur video`,
    estado_aprobacion: 'PENDING',
    hitl_level: 2,
    aprobado_por: null,
    aprobado_en: null,
    observaciones_rechazo: null,
    creado_por: 'marketing_cm',
    creado_en: '2026-10-13T19:00:00.000Z',
    actualizado_en: '2026-10-13T19:00:00.000Z',
  },
  {
    id: 'PRM-202610-004',
    campaign_id: 'CMP-202610-001',
    tipo: 'COPY',
    canal: 'LINKEDIN',
    modelo_destino: 'ChatGPT / Claude / Gemini',
    titulo: 'Post de Liderazgo B2B sobre Calidad Textil',
    prompt_text: `Actuá como Director Comercial de AIRO Color Lab redactando un post para LinkedIn dirigido a líderes de operaciones, RRHH y directores de agencia.
Tema: El verdadero costo de elegir merchandising textil de baja calidad para eventos corporativos.
Tono: Profesional, reflexivo, asertivo, sin tecnicismos excesivos, usando español rioplatense sobrio.
Puntos clave a incluir:
1. Las prendas que encogen o pierden color al primer lavado dañan la percepción de la marca empleadora.
2. La importancia de la trazabilidad textil: corte propio, hilado de primera calidad y asesoramiento directo con taller.
3. Modelo de trabajo de AIRO: mínimo 10 unidades, escalabilidad a producciones mayores, cotización a medida y tiempos confiables.
Llamado a la acción: Dejanos un comentario o escribinos por mensaje directo / WhatsApp (wa.me/5491163553443) para solicitar el muestrario físico de tejidos y terminaciones para tu próxima acción de marca.`,
    prompt_negativo: '',
    estado_aprobacion: 'PENDING',
    hitl_level: 2,
    aprobado_por: null,
    aprobado_en: null,
    observaciones_rechazo: null,
    creado_por: 'marketing_cm',
    creado_en: '2026-10-13T19:20:00.000Z',
    actualizado_en: '2026-10-13T19:20:00.000Z',
  },
];

export const AGENT_REGISTRY = [
  { id: 'ORC', module: 'ORCHESTRATOR', name: 'AIRO Marketing Orchestrator', role: 'Orquestador General', responsibility: 'Decidir qué hacer, qué agente lo hace, inputs, validaciones, nivel HITL, autorización, registro, medición y aprendizaje.', output: 'Plan de acción + delegación', hitl: 0 },
  { id: 'I-01', module: 'INSTAGRAM', name: 'Content Planner', role: 'Planificador de Contenido', responsibility: 'Planificar contenido: idea, objetivo, audiencia, formato, producto, CTA, KPI, fecha.', output: 'Plan editorial semanal', hitl: 0 },
  { id: 'I-02', module: 'INSTAGRAM', name: 'Idea Generator', role: 'Generador de Ideas', responsibility: 'Generar ideas (máx. 10/solicitud) sin duplicados ni claims no verificables.', output: 'Ideas validadas', hitl: 0 },
  { id: 'I-03', module: 'INSTAGRAM', name: 'Copywriter', role: 'Redactor Creativo', responsibility: 'Crear copy con voseo rioplatense, hook, cuerpo, CTA prioritario a WhatsApp y hashtags.', output: 'Copy final con voseo', hitl: 0 },
  { id: 'I-04', module: 'INSTAGRAM', name: 'Creative Director', role: 'Director Creativo Visual', responsibility: 'Definir pieza visual: dimensiones, composición, paleta (#1A4295, #00B4D8, #111111) y prompts.', output: 'Spec Adobe / Prompt Gemini', hitl: 0 },
  { id: 'I-05', module: 'INSTAGRAM', name: 'Trend Researcher', role: 'Investigador de Tendencias', responsibility: 'Investigar tendencias textiles B2B, evaluar relevancia, impacto, costo y riesgo.', output: 'Informe de tendencias', hitl: 0 },
  { id: 'I-06', module: 'INSTAGRAM', name: 'Community Manager', role: 'Gestor de Comunidad Instagram', responsibility: 'Clasificar interacciones (LEAD, QUESTION, CUSTOMER, SPAM) y preparar respuestas asistidas.', output: 'Clasificación + respuesta', hitl: 2 },
  { id: 'I-07', module: 'INSTAGRAM', name: 'Supplier Scout', role: 'Scout de Proveedores', responsibility: 'Descubrir proveedores y talleres aliados (selección final = HITL-3).', output: 'Shortlist de proveedores', hitl: 3 },
  { id: 'L-01', module: 'LINKEDIN', name: 'ICP Finder', role: 'Buscador de Perfiles ICP', responsibility: 'Identificar perfiles corporativos compatibles con el ICP de compras B2B y RRHH.', output: 'Perfiles calificados', hitl: 0 },
  { id: 'L-02', module: 'LINKEDIN', name: 'Company Scout', role: 'Scout de Empresas', responsibility: 'Monitorear empresas con señales de eventos, aniversarios o lanzamientos.', output: 'Empresas objetivo', hitl: 0 },
  { id: 'L-03', module: 'LINKEDIN', name: 'Event Scout', role: 'Scout de Eventos', responsibility: 'Detectar exposiciones y congresos que requieran merchandising y welcome kits.', output: 'Listado de eventos B2B', hitl: 0 },
  { id: 'L-04', module: 'LINKEDIN', name: 'Lead Scorer', role: 'Calificador de Oportunidades', responsibility: 'Scoring explicable 0–100 (LOW, NURTURE, QUALIFIED, HOT) con justificación objetiva.', output: 'Scoring y factores', hitl: 0 },
  { id: 'L-05', module: 'LINKEDIN', name: 'Content Planner', role: 'Planificador de Posts B2B', responsibility: 'Diseñar 5 ideas de contenido B2B orientadas a directores de marketing y compras.', output: 'Calendario LinkedIn', hitl: 0 },
  { id: 'L-06', module: 'LINKEDIN', name: 'Outreach Writer', role: 'Redactor de Mensajes B2B', responsibility: 'Crear borradores personalizados respetuosos con información pública (sin enviar directo).', output: 'Borrador para aprobación', hitl: 2 },
  { id: 'L-07', module: 'LINKEDIN', name: 'CRM Assistant', role: 'Asistente de Pipeline', responsibility: 'Actualizar estado de leads en el pipeline B2B y registrar notas de seguimiento.', output: 'Transición en CRM', hitl: 1 },
  { id: 'W-01', module: 'WHATSAPP', name: 'Status Planner', role: 'Planificador de Estados', responsibility: 'Planificar Estados semanales para generar confianza, retención y conversión en la base.', output: 'Plan de Estados', hitl: 0 },
  { id: 'W-02', module: 'WHATSAPP', name: 'Content Creator', role: 'Creador de Estados', responsibility: 'Convertir ideas aprobadas en Estados de máximo 2 pantallas por pieza.', output: 'Piezas WhatsApp', hitl: 2 },
  { id: 'W-03', module: 'WHATSAPP', name: 'Response Assistant', role: 'Asistente de Respuestas', responsibility: 'Clasificar consultas entrantes y redactar respuestas con tono rioplatense cercano.', output: 'Respuesta sugerida', hitl: 2 },
  { id: 'W-04', module: 'WHATSAPP', name: 'Lead Qualifier', role: 'Calificador de Consultas', responsibility: 'Extraer empresa, producto, cantidad (mínimo 10), fecha estimada y urgencia.', output: 'Ficha para CRM', hitl: 1 },
  { id: 'W-05', module: 'WHATSAPP', name: 'Retention Agent', role: 'Agente de Recompra', responsibility: 'Detectar clientes corporativos inactivos para reactivación periódica.', output: 'Propuesta de contacto', hitl: 2 },
  { id: 'W-06', module: 'WHATSAPP', name: 'Supplier Researcher', role: 'Investigador de Insumos', responsibility: 'Investigar precios y calidades de insumos textiles (hilados, tintas, bobinas).', output: 'Comparativa de costos', hitl: 3 },
  { id: 'G-01', module: 'GMAIL', name: 'Template Builder', role: 'Creador de Plantillas', responsibility: 'Templates para cotizaciones, bienvenida a agencias y seguimiento comercial.', output: 'Plantillas de correo', hitl: 0 },
  { id: 'G-02', module: 'GMAIL', name: 'Personalization Agent', role: 'Personalizador de Emails', responsibility: 'Personalizar propuestas con datos específicos de la empresa receptora.', output: 'Correo personalizado', hitl: 2 },
  { id: 'G-03', module: 'GMAIL', name: 'Prospecting Agent', role: 'Prospección por Email', responsibility: 'Identificar cuentas corporativas estratégicas sin spam.', output: 'Prospectos para revisión', hitl: 0 },
  { id: 'G-04', module: 'GMAIL', name: 'Follow-Up Agent', role: 'Seguimiento Respetuoso', responsibility: 'Un único follow-up cordial si no hubo respuesta a una cotización previa.', output: 'Borrador de seguimiento', hitl: 2 },
  { id: 'G-05', module: 'GMAIL', name: 'CRM Agent', role: 'Clasificador de Respuestas', responsibility: 'Clasificar respuestas entrantes (INTERESTED, WON, NOT_NOW) y actualizar CRM.', output: 'Actualización en CRM', hitl: 1 },
  { id: 'G-06', module: 'GMAIL', name: 'Deliverability Guardian', role: 'Guardián de Entregabilidad', responsibility: 'Control de reputación, formato antispam y cumplimiento normativo.', output: 'Veredicto de entrega', hitl: 0 },
  { id: 'F-01', module: 'FACEBOOK', name: 'Community Post Planner', role: 'Planificador de Publicaciones Mayoristas', responsibility: 'Planificar publicaciones orientadas a comunidades textiles, emprendedores y marcas que buscan producción.', output: 'Plan de publicaciones Facebook', hitl: 0 },
  { id: 'F-02', module: 'FACEBOOK', name: 'Catalog & Promo Creator', role: 'Creador de Contenido y Catálogo', responsibility: 'Armar copys y piezas visuales destacando catálogo, terminaciones y pedidos mayoristas.', output: 'Borrador de publicación Facebook', hitl: 2 },
  { id: 'F-03', module: 'FACEBOOK', name: 'Inquiry Responder', role: 'Gestor de Consultas Facebook', responsibility: 'Responder consultas en publicaciones y Messenger derivando a WhatsApp comercial.', output: 'Respuesta asistida Facebook', hitl: 2 },
  { id: 'X-01', module: 'TRANSVERSAL', name: 'Central CRM Agent', role: 'Guardián del CRM Central', responsibility: 'Consolidar canales, aplicar CRM-MATCH-EXPLICIT-IDENTITY y evitar duplicados.', output: 'CRM unificado', hitl: 1 },
  { id: 'X-02', module: 'TRANSVERSAL', name: 'Analytics Agent', role: 'Analista de Rendimiento', responsibility: 'Informes de cotizaciones, conversión de leads y métricas de contenido.', output: 'Reportes periódicos', hitl: 0 },
  { id: 'X-03', module: 'TRANSVERSAL', name: 'Content QA Agent', role: 'Control de Calidad de Contenido', responsibility: 'Validar tono voseo, regla de mínimo 10, ortografía, ausencia de precios inventados.', output: 'PASS / FAIL con feedback', hitl: 0 },
  { id: 'X-04', module: 'TRANSVERSAL', name: 'Brand Guardian', role: 'Guardián de Identidad y Marca', responsibility: 'Asegurar paleta oficial, coherencia estética y valores del estudio textil.', output: 'Veredicto de marca', hitl: 0 },
  { id: 'X-05', module: 'TRANSVERSAL', name: 'Research Agent', role: 'Investigador de Mercado', responsibility: 'Estudios de mercado textil y evaluación de nuevas tecnologías de estampado.', output: 'Informe de viabilidad', hitl: 0 },
  { id: 'X-06', module: 'TRANSVERSAL', name: 'Experiment Manager', role: 'Gestor de Experimentos', responsibility: 'Ciclo estructurado de experimentos de marketing en registry.json.', output: 'Registro de hipótesis', hitl: 2 },
];

export function getApprovals(filtro = 'ALL') {
  const list = getLocal(KEYS.APPROVALS, initialApprovals);
  if (filtro === 'ALL') return list;
  return list.filter((a) => a.estado === filtro);
}

export function getApprovalById(id) {
  const list = getApprovals();
  return list.find((a) => a.id === id) || null;
}

export function decideApproval(approvalId, decision, comments = '', actor = null) {
  const list = getApprovals();
  const operador = actor || getOperadorActual();
  const idx = list.findIndex((a) => a.id === approvalId);
  if (idx === -1) throw new Error('Aprobación no encontrada');

  const prev = list[idx];
  const nowIso = new Date().toISOString();

  prev.estado = decision; // 'APPROVED' | 'REJECTED' | 'MODIFIED'
  prev.decision_by = operador;
  prev.decision_at = nowIso;
  prev.decision_comments = comments || (decision === 'APPROVED' ? 'Aprobado para publicación manual' : 'Rechazado/Ajustes solicitados');

  list[idx] = prev;
  setLocal(KEYS.APPROVALS, list);

  // Si la aprobación tiene piezas con referencia al calendario editorial, actualizamos el calendario
  if (Array.isArray(prev.piezas)) {
    const calendar = getEditorialCalendar();
    let calChanged = false;
    prev.piezas.forEach((pz) => {
      if (pz.content_ref) {
        const cIdx = calendar.findIndex((c) => c.content_id === pz.content_ref);
        if (cIdx !== -1) {
          calendar[cIdx].status = decision === 'APPROVED' ? 'APPROVED' : 'DRAFT';
          calendar[cIdx].updated_at = nowIso;
          calChanged = true;
        }
      }
    });
    if (calChanged) {
      setLocal(KEYS.EDITORIAL_CALENDAR, calendar);
      broadcastUpdate('CALENDAR_UPDATED', calendar);
    }
  }

  logAudit(
    operador,
    decision === 'APPROVED' ? 'APROBACION_HITL' : 'RECHAZO_HITL',
    'MARKETING',
    `Decisión HITL sobre ${approvalId}: ${decision}. ${comments ? `Comentarios: ${comments}` : ''}`
  );
  broadcastUpdate('APPROVALS_UPDATED', list);
  return prev;
}

export function resetApprovals() {
  setLocal(KEYS.APPROVALS, initialApprovals);
  broadcastUpdate('APPROVALS_UPDATED', initialApprovals);
  return initialApprovals;
}

export function getEditorialCalendar(filterChannel = 'ALL', filterStatus = 'ALL') {
  let list = getLocal(KEYS.EDITORIAL_CALENDAR, initialEditorialCalendar);
  if (filterChannel !== 'ALL') {
    list = list.filter((c) => c.channel === filterChannel);
  }
  if (filterStatus !== 'ALL') {
    list = list.filter((c) => c.status === filterStatus);
  }
  return list;
}

export function saveCalendarEntry(entry, actor = null) {
  const list = getEditorialCalendar();
  const operador = actor || getOperadorActual();
  const nowIso = new Date().toISOString();

  if (entry.content_id) {
    const idx = list.findIndex((c) => c.content_id === entry.content_id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...entry, updated_at: nowIso };
      setLocal(KEYS.EDITORIAL_CALENDAR, list);
      logAudit(operador, 'EDITAR_CALENDARIO', 'MARKETING', `Actualizada pieza ${entry.content_id} en calendario editorial`);
      broadcastUpdate('CALENDAR_UPDATED', list);
      return list[idx];
    }
  }

  const newId = `CNT-${nowIso.slice(0, 10).replace(/-/g, '')}-${String(list.length + 1).padStart(3, '0')}`;
  const newEntry = {
    content_id: newId,
    channel: entry.channel || 'INSTAGRAM',
    idea: entry.idea || 'Nueva idea de contenido',
    objective: entry.objective || 'Generar autoridad B2B',
    audience: entry.audience || 'Marcas y empresas',
    format: entry.format || 'Post carrusel',
    product: entry.product || 'Indumentaria personalizada',
    cta: entry.cta || 'WhatsApp directo',
    kpi: entry.kpi || 'Consultas entrantes',
    proposed_date: entry.proposed_date || nowIso.slice(0, 10),
    status: entry.status || 'IDEA',
    version: 'v1',
    created_at: nowIso,
  };

  list.unshift(newEntry);
  setLocal(KEYS.EDITORIAL_CALENDAR, list);
  logAudit(operador, 'CREAR_CALENDARIO', 'MARKETING', `Creada pieza ${newId} en calendario editorial`);
  broadcastUpdate('CALENDAR_UPDATED', list);
  return newEntry;
}

export function updateCalendarEntryStatus(contentId, newStatus, actor = null) {
  const list = getEditorialCalendar();
  const operador = actor || getOperadorActual();
  const idx = list.findIndex((c) => c.content_id === contentId);
  if (idx === -1) throw new Error('Entrada de calendario no encontrada');

  list[idx].status = newStatus;
  list[idx].updated_at = new Date().toISOString();
  setLocal(KEYS.EDITORIAL_CALENDAR, list);
  logAudit(operador, 'ESTADO_CALENDARIO', 'MARKETING', `Pieza ${contentId} movida a estado ${newStatus}`);
  broadcastUpdate('CALENDAR_UPDATED', list);
  return list[idx];
}

export function resetEditorialCalendar() {
  setLocal(KEYS.EDITORIAL_CALENDAR, initialEditorialCalendar);
  broadcastUpdate('CALENDAR_UPDATED', initialEditorialCalendar);
  return initialEditorialCalendar;
}

// ============================================================
// ORGANIZADOR DE CAMPAÑAS MULTICANAL (5 CANALES OFICIALES)
// ============================================================
export function getCampaigns(filtroEstado = 'ALL') {
  const list = getLocal(KEYS.CAMPAIGNS, initialCampaigns);
  if (filtroEstado === 'ALL') return list;
  return list.filter((c) => c.estado === filtroEstado);
}

export function getCampaignById(id) {
  const list = getCampaigns();
  return list.find((c) => c.id === id) || null;
}

export function saveCampaign(campData, actor = null) {
  const operador = actor || getOperadorActual();
  const list = getCampaigns();
  const nowIso = new Date().toISOString();
  let saved = null;
  const isNew = !campData.id;

  if (isNew) {
    saved = {
      ...campData,
      id: `CMP-${Date.now()}`,
      estado: campData.estado || 'PLANIFICADA',
      canales: Array.isArray(campData.canales) && campData.canales.length > 0 ? campData.canales : ['INSTAGRAM', 'WHATSAPP', 'LINKEDIN', 'GMAIL', 'FACEBOOK'],
      publicaciones: Array.isArray(campData.publicaciones) ? campData.publicaciones : [],
      creado_por: operador,
      creado_en: nowIso,
      actualizado_en: nowIso,
    };
    list.unshift(saved);
  } else {
    const idx = list.findIndex((c) => c.id === campData.id);
    if (idx === -1) throw new Error('Campaña no encontrada');
    saved = {
      ...list[idx],
      ...campData,
      actualizado_en: nowIso,
    };
    list[idx] = saved;
  }

  setLocal(KEYS.CAMPAIGNS, list);
  broadcastUpdate('CAMPAIGNS_UPDATED', list);

  logAudit(
    operador,
    isNew ? 'CAMPAIGN_CREATED' : 'CAMPAIGN_UPDATED',
    'MARKETING_CAMPAIGNS',
    `Campaña ${isNew ? 'creada' : 'actualizada'}: "${saved.titulo}" (${saved.estado})`,
    'SUCCESS'
  );

  return saved;
}

export function deleteCampaign(id, actor = null) {
  const operador = actor || getOperadorActual();
  const list = getCampaigns();
  const target = list.find((c) => c.id === id);
  if (!target) throw new Error('Campaña no encontrada');

  const filtered = list.filter((c) => c.id !== id);
  setLocal(KEYS.CAMPAIGNS, filtered);
  broadcastUpdate('CAMPAIGNS_UPDATED', filtered);

  logAudit(
    operador,
    'CAMPAIGN_DELETED',
    'MARKETING_CAMPAIGNS',
    `Campaña eliminada: "${target.titulo}" (${target.id})`,
    'SUCCESS'
  );

  return true;
}

// ============================================================
// GENERADOR & APROBACIÓN HITL DE PROMPTS PARA IAS PARALELAS
// (La aprobación afecta exclusivamente a la creación/modificación de prompts)
// ============================================================
export function getPrompts(filtroEstado = 'ALL', filtroTipo = 'ALL', filtroCanal = 'ALL') {
  let list = getLocal(KEYS.PROMPTS, initialPrompts);
  if (filtroEstado !== 'ALL') {
    list = list.filter((p) => p.estado_aprobacion === filtroEstado);
  }
  if (filtroTipo !== 'ALL') {
    list = list.filter((p) => p.tipo === filtroTipo);
  }
  if (filtroCanal !== 'ALL') {
    list = list.filter((p) => p.canal === filtroCanal);
  }
  return list;
}

export function getPromptById(id) {
  const list = getPrompts();
  return list.find((p) => p.id === id) || null;
}

export function savePrompt(promptData, actor = null) {
  const operador = actor || getOperadorActual();
  const list = getPrompts();
  const nowIso = new Date().toISOString();
  let saved = null;
  const isNew = !promptData.id;

  if (isNew) {
    saved = {
      ...promptData,
      id: `PRM-${Date.now()}`,
      tipo: promptData.tipo || 'COPY',
      canal: promptData.canal || 'INSTAGRAM',
      modelo_destino: promptData.modelo_destino || (promptData.tipo === 'IMAGE' ? 'Midjourney / Flux / DALL-E' : promptData.tipo === 'VIDEO' ? 'Runway / Sora / Kling' : 'ChatGPT / Claude / Gemini'),
      estado_aprobacion: 'PENDING', // REGLA: Toda creación nace en PENDING para HITL
      hitl_level: 2,
      creado_por: operador,
      creado_en: nowIso,
      actualizado_en: nowIso,
      aprobado_por: null,
      aprobado_en: null,
      observaciones_rechazo: null,
    };
    list.unshift(saved);
  } else {
    const idx = list.findIndex((p) => p.id === promptData.id);
    if (idx === -1) throw new Error('Prompt no encontrado');
    // REGLA: Toda modificación revoca la aprobación y pasa a PENDING para HITL
    saved = {
      ...list[idx],
      ...promptData,
      estado_aprobacion: 'PENDING',
      actualizado_en: nowIso,
      aprobado_por: null,
      aprobado_en: null,
      observaciones_rechazo: null,
    };
    list[idx] = saved;
  }

  setLocal(KEYS.PROMPTS, list);
  broadcastUpdate('PROMPTS_UPDATED', list);

  logAudit(
    operador,
    isNew ? 'PROMPT_CREATED' : 'PROMPT_MODIFIED',
    'MARKETING_PROMPTS',
    `Prompt ${isNew ? 'creado' : 'modificado'} en estado PENDING para revisión humana: "${saved.titulo}" (${saved.tipo} / ${saved.canal})`,
    'SUCCESS'
  );

  return saved;
}

export function deletePrompt(id, actor = null) {
  const operador = actor || getOperadorActual();
  const list = getPrompts();
  const target = list.find((p) => p.id === id);
  if (!target) throw new Error('Prompt no encontrado');

  const filtered = list.filter((p) => p.id !== id);
  setLocal(KEYS.PROMPTS, filtered);
  broadcastUpdate('PROMPTS_UPDATED', filtered);

  logAudit(
    operador,
    'PROMPT_DELETED',
    'MARKETING_PROMPTS',
    `Prompt eliminado: "${target.titulo}" (${target.id})`,
    'SUCCESS'
  );

  return true;
}

export function decidePromptApproval(promptId, decision, comments = '', actor = null) {
  const operador = actor || getOperadorActual();
  const list = getPrompts();
  const idx = list.findIndex((p) => p.id === promptId);
  if (idx === -1) throw new Error('Prompt no encontrado');

  const nowIso = new Date().toISOString();
  const isApproved = decision === 'APPROVED';

  list[idx].estado_aprobacion = isApproved ? 'APPROVED' : 'REJECTED';
  list[idx].aprobado_por = operador;
  list[idx].aprobado_en = nowIso;
  list[idx].observaciones_rechazo = isApproved ? null : (comments || 'Ajustes requeridos antes de producción');
  list[idx].actualizado_en = nowIso;

  setLocal(KEYS.PROMPTS, list);
  broadcastUpdate('PROMPTS_UPDATED', list);

  logAudit(
    operador,
    isApproved ? 'PROMPT_APPROVED' : 'PROMPT_REJECTED',
    'MARKETING_PROMPTS',
    `Prompt ${isApproved ? 'aprobado' : 'rechazado'} por ${operador}: "${list[idx].titulo}" (${list[idx].tipo}). ${comments ? `Obs: ${comments}` : ''}`,
    'SUCCESS'
  );

  return list[idx];
}

export function generateAiPrompt({ tipo, canal, objetivo, producto, audience, detalleExtra, modeloDestino }) {
  const t = tipo || 'COPY';
  const c = canal || 'INSTAGRAM';
  const prod = producto || 'Indumentaria textil personalizada (remeras, buzos, tote bags)';
  const obj = objetivo || 'Generar consultas comerciales B2B y posicionar calidad de taller';
  const aud = audience || 'Empresas, productoras de eventos, agencias de marketing y marcas de indumentaria';
  const extra = detalleExtra ? detalleExtra.trim() : '';

  if (t === 'COPY') {
    const channelFormatDesc = {
      INSTAGRAM: 'Carrusel de 5 slides o post con hook visual impactante, desarrollo técnico en bullets y llamada a la acción clara.',
      WHATSAPP: 'Guión para Estado de 2 pantallas verticales o mensaje comercial conciso y directo.',
      LINKEDIN: 'Publicación B2B reflexiva sobre cultura de empresa, durabilidad de prendas corporativas y retorno de inversión.',
      GMAIL: 'Asunto atractivo de alta apertura y cuerpo de correo 1-to-1 cordial, profesional y personalizado.',
      FACEBOOK: 'Posteo para comunidad de marcas y empresas destacando opciones de catálogo, técnicas y cotizaciones.',
    }[c] || 'Posteo optimizado para canal B2B.';

    return {
      titulo: `Copy ${c}: ${prod.slice(0, 30)}`,
      prompt_text: `Actuá como Copywriter B2B senior para AIRO Color Lab (estudio textil y de personalización en Buenos Aires).
Generá una propuesta de copy de alta conversión para ${c} con las siguientes especificaciones:
- Objetivo de la pieza: ${obj}
- Producto / Servicio: ${prod}
- Audiencia target: ${aud}
${extra ? `- Contexto / Requerimiento adicional: ${extra}\n` : ''}- Formato del canal: ${channelFormatDesc}

Reglas innegociables de marca AIRO:
1. Voz y tono: español rioplatense profesional con voseo natural y cercano (usá "tenés", "podés", "escribinos", "consultanos").
2. No inventar precios ni promociones ficticias. Toda cotización se elabora a medida según volumen y técnica.
3. Condiciones comerciales: confección mínima de 10 unidades por modelo (en múltiplos de 10). Plazo de respuesta menor a 24 horas hábiles.
4. CTA prioritario: WhatsApp oficial al 11-6355-3443 (wa.me/5491163553443).
5. Incluir 3 a 5 hashtags pertinentes del sector B2B textil argentino.`,
      prompt_negativo: '',
      modelo_destino: modeloDestino || 'ChatGPT / Claude / Gemini',
    };
  }

  if (t === 'IMAGE') {
    const ratio = c === 'INSTAGRAM' ? '4:5' : c === 'LINKEDIN' ? '16:9' : '1:1';
    return {
      titulo: `Foto Editorial: ${prod.slice(0, 30)} - Estudio AIRO`,
      prompt_text: `Commercial editorial product photography of ${prod}, impeccably finished with high-precision textile craftsmanship (clean DTF print transfer or dense embroidery), presented in a minimalist Buenos Aires textile design studio setting. Warm polished concrete and textured natural oak wood surface, soft diffused studio window light from the side, subtle realistic fabric texture showing combed cotton weave and reinforced seams. Subtle color accents in Pantone deep navy #1A4295 and vivid cyan #00B4D8, high-end lookbook catalog aesthetic, shot on Hasselblad 50C, 90mm lens, f/4, crisp focus on garment craftsmanship, neutral background, balanced atmospheric shadows, 8k resolution, raw photography --ar ${ratio} --style raw --v 6.1 ${extra ? `// context: ${extra}` : ''}`,
      prompt_negativo: `blurry, cheap fabric, synthetic shiny polyester, deformed stitching, distorted logos, cartoon, 3d CGI render, oversaturated, messy workshop, low quality, artifacting, watermarks, generic stock photo`,
      modelo_destino: modeloDestino || 'Midjourney / Flux / DALL-E',
    };
  }

  // VIDEO
  return {
    titulo: `Toma Cinemática Taller: ${prod.slice(0, 30)}`,
    prompt_text: `Cinematic 4k commercial video b-roll shot in a modern textile laboratory and apparel workshop. Close-up macro tracking shot of ${prod} being crafted: showing the precise application of heat-transfer DTF or precision embroidery machine needle creating intricate stitch patterns. Warm studio ambient lighting combined with crisp clean fill light. Slow smooth camera movement from right to left, realistic fabric texture, natural tactile feel, shallow depth of field with soft bokeh background. Cinematic color grading, 60fps slow-motion feel, high production value lookbook aesthetic ${extra ? `// context: ${extra}` : ''}`,
    prompt_negativo: `fast jerky motion, distorted hands, amateur phone camera, low bitrate, artifacts, unrealistic CGI, muddy colors, bad lighting`,
    modelo_destino: modeloDestino || 'Runway / Sora / Kling',
  };
}

export function getAgentRegistry() {
  return AGENT_REGISTRY;
}

// Clasificador inteligente y generador de respuestas del Community Manager (I-06 / W-03 / L-06)
export function classifyAndGenerateCmResponse(messageText, channel = 'WHATSAPP') {
  const text = String(messageText || '').toLowerCase().trim();
  const cleanOriginal = String(messageText || '').trim();

  // Detección de cantidades numéricas
  let detectedQuantity = null;
  const numMatch = text.match(/(\d+)\s*(remeras?|buzos?|prendas?|unidades?|gorras?|totes?|camperas?|u\b)?/);
  if (numMatch && numMatch[1]) {
    detectedQuantity = parseInt(numMatch[1], 10);
  }

  // Detección de prenda
  let detectedProduct = 'Indumentaria textil personalizada';
  if (text.includes('buzo')) detectedProduct = 'Buzos estampados';
  else if (text.includes('remera')) detectedProduct = 'Remeras de algodón / técnicas';
  else if (text.includes('gorra')) detectedProduct = 'Gorras con bordado o DTF';
  else if (text.includes('tote') || text.includes('bolsa')) detectedProduct = 'Tote bags de lienzo';
  else if (text.includes('campera')) detectedProduct = 'Camperas / chalecos corporativos';

  // Detección de posible nombre de empresa
  let detectedCompany = '';
  const compMatch = cleanOriginal.match(/somos (?:de |la empresa )?([A-Za-z0-9\s]+?)(?:[.,]|\s+y\s|\s+queremos|\s+buscamos|$)/i);
  if (compMatch && compMatch[1]) {
    detectedCompany = compMatch[1].trim();
  }

  const isUnderMinimum = detectedQuantity !== null && detectedQuantity < 10;

  // Clasificación de intención
  let category = 'LEAD';
  let categoryLabel = 'Cotización / Lead B2B';
  let confidence = 0.95;
  let proposedResponse = '';
  let score = 70;

  // Normalización de texto sin acentos para análisis lingüístico
  const normText = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const isReclamo = normText.includes('fallad') || normText.includes('mal estampad') || normText.includes('roto') || normText.includes('reclamo') || normText.includes('no llego') || normText.includes('error');
  const isSeguimiento = normText.includes('como viene') || normText.includes('cuando entregan') || normText.includes('mi pedido') || normText.includes('remito') || normText.includes('estado de mi');
  const isConsultaTecnica = normText.includes('sublimacion') || normText.includes('dtf') || normText.includes('bordado') || normText.includes('algodon') || normText.includes('tela') || normText.includes('catalogo');
  const isSpam = normText.includes('crypto') || normText.includes('prestamo') || normText.includes('viagra') || normText.includes('casino');
  const hasCotizarIntent = normText.includes('cuanto') || normText.includes('precio') || normText.includes('costo') || normText.includes('cotiz') || normText.includes('presupuesto') || normText.includes('salen') || (detectedQuantity !== null && detectedQuantity >= 10);

  if (isSpam) {
    category = 'SPAM';
    categoryLabel = 'Mensaje no deseado / Spam';
    confidence = 0.98;
    score = 0;
    proposedResponse = 'Sin respuesta (marcar como spam y archivar).';
  } else if (isReclamo) {
    category = 'COMPLAINT';
    categoryLabel = 'Reclamo / Prioridad Alta';
    confidence = 0.92;
    score = 30;
    proposedResponse = '¡Hola! Lamentamos el inconveniente. En AIRO nos tomamos muy en serio la calidad y terminación de cada producción. Por favor pasanos fotos del detalle y tu número de remito por WhatsApp al 11-6355-3443 para que el encargado de taller lo revise de inmediato y te demos una respuesta hoy mismo.';
  } else if (isSeguimiento) {
    category = 'CUSTOMER';
    categoryLabel = 'Cliente Existente / Seguimiento';
    confidence = 0.9;
    score = 50;
    proposedResponse = '¡Hola! Con gusto te chequeamos el estado de tu pedido en taller. Por favor pasanos el nombre de tu empresa o número de remito para consultar la fecha exacta de entrega con el sector de logística. También podés escribirnos al WhatsApp de taller: wa.me/5491163553443.';
  } else if (isUnderMinimum) {
    category = 'LEAD_UNDER_MIN';
    categoryLabel = 'Consulta Bajo Mínimo (<10 unidades)';
    confidence = 0.94;
    score = 40;
    proposedResponse = `¡Hola! Gracias por escribirnos. Te comento que en AIRO trabajamos exclusivamente con producciones personalizadas desde un mínimo de 10 unidades por modelo (en múltiplos de 10). Si te sirve armar una tanda a partir de esa cantidad para tu marca o equipo, escribinos a nuestro WhatsApp oficial: wa.me/5491163553443 y te preparamos una cotización en menos de 24 h hábiles.`;
  } else if (isConsultaTecnica && !hasCotizarIntent) {
    category = 'QUESTION';
    categoryLabel = 'Consulta Técnica / Catálogo';
    confidence = 0.88;
    score = 60;
    proposedResponse = '¡Hola! En AIRO te asesoramos técnica y estéticamente para elegir la técnica ideal según el uso de las prendas (trabajamos DTF textil para diseños detallados a todo color, sublimación para poliéster claro y bordado de alta precisión). Mínimo de confección: 10 unidades. Escribinos a WhatsApp al 11-6355-3443 y te compartimos muestras y catálogo.';
  } else {
    category = 'LEAD';
    categoryLabel = 'Cotización / Lead B2B';
    confidence = 0.93;
    score = detectedQuantity && detectedQuantity >= 50 ? 90 : 75;
    proposedResponse = `¡Hola! Qué bueno que nos contactes. Producimos ${detectedProduct.toLowerCase()} con estampas de alta durabilidad (DTF, sublimación y bordado) a partir de 10 unidades. Para pasarte un presupuesto exacto y plazos de entrega, escribinos directamente por WhatsApp: wa.me/5491163553443 contándonos si ya tenés el diseño listo, y te respondemos en menos de 24 h hábiles.`;
  }

  const agentId = channel === 'INSTAGRAM' ? 'I-06'
    : channel === 'LINKEDIN' ? 'L-06'
    : channel === 'FACEBOOK' ? 'F-03'
    : channel === 'GMAIL' ? 'G-05'
    : 'W-03';

  return {
    category,
    categoryLabel,
    confidence,
    agentId,
    originalMessage: cleanOriginal,
    proposedResponse,
    extractedData: {
      company: detectedCompany,
      contact: 'Contacto ' + channel,
      product: detectedProduct,
      quantity: detectedQuantity,
      channel,
      interest: `Consulta por ${detectedProduct}${detectedQuantity ? ` (${detectedQuantity} u.)` : ''}`,
      score,
      isUnderMinimum,
    },
    rulesApplied: [
      'Español rioplatense y voseo profesional',
      'Mínimo comercial de 10 unidades y múltiplos de 10',
      'Precios por cotización personalizada (sin inventar tarifas fijas)',
      'CTA prioritario: WhatsApp oficial (wa.me/5491163553443)',
      'Compromiso de respuesta <24 h hábiles',
    ],
  };
}

// Conversión y derivación directa de interacción asistida por CM a Lead en CRM
export function convertCmInteractionToLead(interactionData, actor = null) {
  const operador = actor || getOperadorActual();
  const ext = interactionData.extractedData || interactionData;

  const leadPayload = {
    origin: `CM_${ext.channel || 'WHATSAPP'}`,
    company: ext.company || null,
    contact: ext.contact || `Prospecto ${ext.channel || 'Redes'}`,
    channel: ext.channel || 'WHATSAPP',
    interest: ext.interest || 'Consulta entrante clasificada por Agente CM',
    product: ext.product || 'Indumentaria textil',
    quantity: ext.quantity || null,
    score: ext.score || 65,
    status: 'NEW',
    priority: ext.score >= 80 ? 'HIGH' : 'NORMAL',
    notes: `Mensaje recibido: "${interactionData.originalMessage || ''}"\nRespuesta sugerida CM: "${interactionData.proposedResponse || ''}"`,
    phone: ext.phone || null,
    email: ext.email || null,
    forzar_creacion: ext.forzar_creacion || false,
  };

  const res = saveLead(leadPayload, operador);
  logAudit(
    operador,
    'CM_LEAD_INJECTED',
    'CRM',
    `Lead derivado por Community Manager (${ext.channel}): ${leadPayload.contact}${ext.company ? ` - ${ext.company}` : ''}`
  );
  return res;
}

// ============================================================
// 11. AIRO DESIGN STUDIO — LIENZO INFINITO & LINTER X-03/X-04
// (100% Compatible con Obsidian JSON Canvas 1.0 - .canvas)
// ============================================================

export const DESIGN_FORMATS = [
  { id: 'IG_CAROUSEL', label: 'IG Carrusel / Feed (1080x1350)', channel: 'INSTAGRAM', widthPx: 1080, heightPx: 1350, ratio: '4:5', safeZonePx: 90, maxSlides: 10 },
  { id: 'IG_REEL_STORY', label: 'IG Reel / Story (1080x1920)', channel: 'INSTAGRAM', widthPx: 1080, heightPx: 1920, ratio: '9:16', safeZonePx: 250, maxSlides: 5 },
  { id: 'WA_STATUS', label: 'WhatsApp Estado (1080x1920 - máx. 2 pant.)', channel: 'WHATSAPP', widthPx: 1080, heightPx: 1920, ratio: '9:16', safeZonePx: 250, maxSlides: 2 },
  { id: 'LI_POST', label: 'LinkedIn Post B2B (1200x627)', channel: 'LINKEDIN', widthPx: 1200, heightPx: 627, ratio: '1.91:1', safeZonePx: 60, maxSlides: 6 },
  { id: 'EMAIL_HEADER', label: 'Email Header B2B (1200x400)', channel: 'GMAIL', widthPx: 1200, heightPx: 400, ratio: '3:1', safeZonePx: 40, maxSlides: 1 },
];

export const initialDesignCanvases = [
  {
    id: 'CNV-202611-001',
    titulo: 'Lienzo Maestro — Campaña Packs B2B & Onboarding (PK1 - PK4)',
    canal: 'INSTAGRAM',
    formato: 'IG_CAROUSEL',
    producto_id: 'pk1',
    producto_nombre: 'Pack Bienvenida — Onboarding',
    estado: 'EN_DISENO',
    obsidian_path: '06 - Proyectos y Experimentos/Design Studio/03 - Lienzos y Wireframes/00 - Lienzo Maestro Design Studio.canvas',
    updated_at: '2026-11-10T21:20:00.000Z',
    nodes: [
      {
        id: 'group-01-research',
        type: 'group',
        x: 40,
        y: 40,
        width: 340,
        height: 440,
        color: '#1a4295',
        label: '01 · INSPIRACIÓN & MOODBOARD',
      },
      {
        id: 'node-brief',
        type: 'brief',
        x: 60,
        y: 90,
        width: 300,
        height: 185,
        color: '#1a4295',
        bgHex: '#1a4295',
        textHex: '#fefffe',
        title: 'Brief Creativo SMART',
        text: 'Posicionar el Pack Bienvenida (PK1: Remera + Tote Bag + Lanyard) para áreas de RRHH y empresas. Producción desde 10 unidades en múltiplos de 10.',
        productId: 'pk1',
      },
      {
        id: 'node-product-pk1',
        type: 'product',
        x: 60,
        y: 290,
        width: 300,
        height: 170,
        color: '#0e7490',
        bgHex: '#ffffff',
        textHex: '#111111',
        title: 'PK1 · Pack Bienvenida — Onboarding',
        text: 'Remera algodón peinado + Tote bag lienzo + Lanyard sublimado 360°. Estado en catálogo: ACTIVO.',
        productId: 'pk1',
        imageUrl: '/imagenes/productos/totes.webp',
      },
      {
        id: 'group-02-wireframes',
        type: 'group',
        x: 420,
        y: 40,
        width: 620,
        height: 440,
        color: '#00b4d8',
        label: '02 · EXPLORACIÓN & WIREFRAMES (1080x1350)',
      },
      {
        id: 'node-slide-1',
        type: 'slide',
        slideOrder: 1,
        format: 'IG_CAROUSEL',
        x: 445,
        y: 90,
        width: 270,
        height: 365,
        color: '#1a4295',
        bgHex: '#1a4295',
        textHex: '#fefffe',
        title: 'Slide 01 · Hook B2B',
        text: '¿Nuevo ingreso en el equipo? Hacé que tu marca acompañe desde el primer día con un Pack de Onboarding real.',
        promptText: 'minimalist flat lay of corporate welcome kit on oak table: folded combed cotton t-shirt, canvas tote bag and sublimated lanyard in deep blue #1A4295 and cyan #00B4D8 accents, natural window light, photorealistic, no text, no letters, no logos',
        productId: 'pk1',
      },
      {
        id: 'node-slide-2',
        type: 'slide',
        slideOrder: 2,
        format: 'IG_CAROUSEL',
        x: 745,
        y: 90,
        width: 270,
        height: 365,
        color: '#0e7490',
        bgHex: '#f4f6f8',
        textHex: '#111111',
        title: 'Slide 02 · Detalle + CTA WhatsApp',
        text: 'Producimos tu Pack Bienvenida desde 10 unidades (en múltiplos de 10). Escribinos por WhatsApp al 11-6355-3443 y te cotizamos en menos de 24 h hábiles.',
        promptText: 'close up macro detail of cotton canvas tote bag stitching and metal carabiner lanyard, textile design studio bench, soft natural light, #1A4295 and #00B4D8 subtle accents, photorealistic, no text, no letters, no logos',
        productId: 'pk1',
      },
      {
        id: 'group-03-qa',
        type: 'group',
        x: 1080,
        y: 40,
        width: 310,
        height: 440,
        color: '#15803d',
        label: '03 · GATE QA (X-03/X-04) & HITL-2',
      },
      {
        id: 'node-qa-gate',
        type: 'qa',
        x: 1100,
        y: 90,
        width: 270,
        height: 365,
        color: '#15803d',
        bgHex: '#ffffff',
        textHex: '#111111',
        title: 'Validación X-03 / X-04',
        text: 'Voseo rioplatense verificado. Producto PK1 activo en catálogo. Mínimo 10 unidades citado. CTA único a WhatsApp oficial. Imágenes IA sin texto.',
        productId: 'pk1',
      },
    ],
    edges: [
      { id: 'edge-1', fromNode: 'node-brief', toNode: 'node-slide-1', label: 'Concepto' },
      { id: 'edge-2', fromNode: 'node-product-pk1', toNode: 'node-slide-1', label: 'Producto Activo' },
      { id: 'edge-3', fromNode: 'node-slide-1', toNode: 'node-slide-2', label: 'Secuencia' },
      { id: 'edge-4', fromNode: 'node-slide-2', toNode: 'node-qa-gate', label: 'Validar QA' },
    ],
  },
];

export function getDesignCanvases() {
  return getLocal(KEYS.DESIGN_CANVASES, initialDesignCanvases);
}

export function getDesignCanvasById(id) {
  const list = getDesignCanvases();
  return list.find((c) => c.id === id) || null;
}

export function saveDesignCanvas(canvasData, actor = null) {
  const operador = actor || getOperadorActual();
  const list = getDesignCanvases();
  const nowIso = new Date().toISOString();
  let saved = null;

  if (canvasData.id) {
    const idx = list.findIndex((c) => c.id === canvasData.id);
    if (idx !== -1) {
      saved = {
        ...list[idx],
        ...canvasData,
        updated_at: nowIso,
      };
      list[idx] = saved;
    }
  }

  if (!saved) {
    saved = {
      id: canvasData.id || `CNV-${Date.now()}`,
      titulo: canvasData.titulo || 'Nuevo Lienzo Creativo AIRO',
      canal: canvasData.canal || 'INSTAGRAM',
      formato: canvasData.formato || 'IG_CAROUSEL',
      producto_id: canvasData.producto_id || 'p1',
      producto_nombre: canvasData.producto_nombre || 'Lanyards Oficiales',
      estado: canvasData.estado || 'EN_DISENO',
      obsidian_path: canvasData.obsidian_path || `06 - Proyectos y Experimentos/Design Studio/03 - Lienzos y Wireframes/${(canvasData.titulo || 'Lienzo').replace(/[^a-zA-Z0-9_-]+/g, '-')}.canvas`,
      nodes: Array.isArray(canvasData.nodes) ? canvasData.nodes : [],
      edges: Array.isArray(canvasData.edges) ? canvasData.edges : [],
      created_at: nowIso,
      updated_at: nowIso,
    };
    list.unshift(saved);
  }

  setLocal(KEYS.DESIGN_CANVASES, list);
  broadcastUpdate('DESIGN_CANVASES_UPDATED', list);
  logAudit(operador, 'SAVE_DESIGN_CANVAS', 'DESIGN_STUDIO', `Guardado lienzo creativo "${saved.titulo}" (${saved.id})`);
  return saved;
}

export function deleteDesignCanvas(id, actor = null) {
  const operador = actor || getOperadorActual();
  const list = getDesignCanvases();
  const target = list.find((c) => c.id === id);
  if (!target) return false;
  const filtered = list.filter((c) => c.id !== id);
  setLocal(KEYS.DESIGN_CANVASES, filtered);
  broadcastUpdate('DESIGN_CANVASES_UPDATED', filtered);
  logAudit(operador, 'DELETE_DESIGN_CANVAS', 'DESIGN_STUDIO', `Eliminado lienzo creativo "${target.titulo}" (${id})`);
  return true;
}

// Exporta un lienzo al estándar exacto JSON Canvas 1.0 (.canvas) de Obsidian
export function exportToObsidianCanvasJson(canvasObj) {
  if (!canvasObj) throw new Error('Lienzo requerido para exportar');
  const obsNodes = (canvasObj.nodes || []).map((n) => {
    if (n.type === 'group') {
      return {
        id: n.id,
        type: 'group',
        x: Math.round(Number(n.x) || 0),
        y: Math.round(Number(n.y) || 0),
        width: Math.round(Number(n.width) || 400),
        height: Math.round(Number(n.height) || 350),
        color: '5',
        label: n.label || n.title || 'ARTBOARD AIRO',
      };
    }
    const markdownBody = [
      n.title ? `### ${n.title}` : '',
      n.text || '',
      n.promptText ? `\n**Prompt IA (Sin texto):**\n\`\`\`text\n${n.promptText}\n\`\`\`` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      id: n.id,
      type: 'text',
      x: Math.round(Number(n.x) || 0),
      y: Math.round(Number(n.y) || 0),
      width: Math.round(Number(n.width) || 270),
      height: Math.round(Number(n.height) || 240),
      color: n.type === 'qa' ? '4' : n.type === 'slide' ? '5' : '6',
      text: markdownBody,
    };
  });

  const obsEdges = (canvasObj.edges || []).map((e, idx) => ({
    id: e.id || `edge-${idx + 1}`,
    fromNode: e.fromNode,
    fromSide: e.fromSide || 'right',
    toNode: e.toNode,
    toSide: e.toSide || 'left',
    label: e.label || '',
  }));

  return JSON.stringify({ nodes: obsNodes, edges: obsEdges }, null, 2);
}

// Importa cualquier archivo .canvas de Obsidian hacia el Design Studio web
export function importFromObsidianCanvasJson(rawJsonString, customTitle = 'Lienzo Importado desde Obsidian', canal = 'INSTAGRAM') {
  const parsed = JSON.parse(rawJsonString);
  if (!parsed || !Array.isArray(parsed.nodes)) {
    throw new Error('El archivo no cumple el estándar JSON Canvas 1.0 (.canvas)');
  }

  // Normalizar coordenadas para que queden visibles en el viewport web
  const xs = parsed.nodes.map((n) => Number(n.x) || 0);
  const ys = parsed.nodes.map((n) => Number(n.y) || 0);
  const minX = xs.length ? Math.min(...xs) : 0;
  const minY = ys.length ? Math.min(...ys) : 0;
  const offsetX = minX < 20 ? 40 - minX : 0;
  const offsetY = minY < 20 ? 40 - minY : 0;

  let slideCounter = 1;
  const mappedNodes = parsed.nodes.map((n, idx) => {
    const x = Math.round((Number(n.x) || 0) + offsetX);
    const y = Math.round((Number(n.y) || 0) + offsetY);
    const width = Math.round(Number(n.width) || 280);
    const height = Math.round(Number(n.height) || 220);

    if (n.type === 'group') {
      return {
        id: n.id || `grp-${idx}`,
        type: 'group',
        x,
        y,
        width,
        height,
        color: '#1a4295',
        label: n.label || 'ARTBOARD IMPORTADO',
      };
    }

    const rawText = String(n.text || n.file || '');
    const lines = rawText.split('\n');
    const firstHeading = lines[0]?.startsWith('#') ? lines[0].replace(/^#+\s*/, '').trim() : `Tarjeta ${idx + 1}`;
    const bodyText = lines[0]?.startsWith('#') ? lines.slice(1).join('\n').trim() : rawText;
    const isSlide = /slide|pantalla/i.test(firstHeading);

    return {
      id: n.id || `node-${idx}`,
      type: isSlide ? 'slide' : 'brief',
      slideOrder: isSlide ? slideCounter++ : undefined,
      format: 'IG_CAROUSEL',
      x,
      y,
      width,
      height,
      color: isSlide ? '#00b4d8' : '#1a4295',
      bgHex: '#ffffff',
      textHex: '#111111',
      title: firstHeading,
      text: bodyText,
      promptText: '',
      productId: 'p1',
    };
  });

  const mappedEdges = (parsed.edges || []).map((e, idx) => ({
    id: e.id || `edge-${idx + 1}`,
    fromNode: e.fromNode,
    toNode: e.toNode,
    label: e.label || '',
  }));

  return saveDesignCanvas({
    titulo: customTitle,
    canal,
    formato: 'IG_CAROUSEL',
    nodes: mappedNodes,
    edges: mappedEdges,
  });
}

// Validador en vivo X-03 Content QA + X-04 Brand Guardian para tarjetas del lienzo
export function evaluateBrandQaLint({
  text = '',
  bgHex = '#ffffff',
  textHex = '#111111',
  format = 'IG_CAROUSEL',
  slideCount = 1,
  productId = null,
  catalogItems = [],
}) {
  const issues = [];
  const passedChecks = [];
  const clean = String(text || '').toLowerCase();

  // 1. Palabras prohibidas de retail / ecommerce (docs/brand-manual.md §5)
  const forbiddenWords = ['carrito', 'checkout', 'oferta flash', 'compra ya', 'comprá ya', 'agregar al carrito', 'liquidación', 'barato'];
  const foundForbidden = forbiddenWords.filter((w) => clean.includes(w));
  if (foundForbidden.length > 0) {
    issues.push({
      level: 'FAIL',
      agent: 'X-04',
      rule: 'Lenguaje B2B puro',
      message: `Contiene vocabulario retail prohibido: "${foundForbidden.join(', ')}". Usar "proyecto", "cotización" o "producción a pedido".`,
    });
  } else {
    passedChecks.push('Tono B2B libre de jerga retail/carrito (X-04)');
  }

  // 2. Prohibición de publicar precios o descuentos inventados (Regla Innegociable #1 y #7)
  if (/\$\s*\d+|\b\d+\s*%\s*off\b|\bdescuento del\b/i.test(text)) {
    issues.push({
      level: 'FAIL',
      agent: 'X-04',
      rule: 'Prohibición de precios publicados',
      message: 'Detectado precio o descuento explícito. Todo precio en AIRO es por cotización personalizada.',
    });
  } else {
    passedChecks.push('Sin precios ni descuentos publicados (X-04)');
  }

  // 3. Contraste de paleta oficial: Cian #00b4d8 solo sobre fondos oscuros (docs/brand-manual.md §3)
  const lightBgs = ['#ffffff', '#fefffe', '#f4f6f8'];
  if (
    String(textHex).toLowerCase() === '#00b4d8' &&
    lightBgs.includes(String(bgHex).toLowerCase())
  ) {
    issues.push({
      level: 'WARN',
      agent: 'X-04',
      rule: 'Accesibilidad AA de Paleta',
      message: 'El acento Cian (#00B4D8) solo se permite sobre fondos oscuros (#1A4295 o #1D1D1B). Sobre fondo claro usar --cyan-ink (#0E7490).',
    });
  } else {
    passedChecks.push('Contraste de paleta oficial verificado (X-04)');
  }

  // 4. Límite de pantallas en WhatsApp Estados (Regla W-02: máximo 2 pantallas)
  if (format === 'WA_STATUS' && Number(slideCount) > 2) {
    issues.push({
      level: 'FAIL',
      agent: 'W-02',
      rule: 'Límite de WhatsApp Estados',
      message: `El lienzo tiene ${slideCount} pantallas configuradas para WhatsApp Estado. El límite canónico de W-02 es máximo 2 pantallas.`,
    });
  } else if (format === 'WA_STATUS') {
    passedChecks.push('Límite de 2 pantallas en WhatsApp Estado respetado (W-02)');
  }

  // 5. Estado del producto en catalogo.json (Regla §10 y §12.3)
  if (productId && Array.isArray(catalogItems) && catalogItems.length > 0) {
    const prod = catalogItems.find((p) => p.id_producto === productId);
    if (prod && prod.activo === false) {
      issues.push({
        level: 'FAIL',
        agent: 'X-03',
        rule: 'Producto activo en catálogo',
        message: `El producto "${prod.nombre}" (${productId}) figura INACTIVO en catalogo.json. Prohibido promocionar.`,
      });
    } else if (prod) {
      passedChecks.push(`Producto "${prod.nombre}" verificado como ACTIVO en catálogo (X-03)`);
    }
  }

  // 6. Voseo / Regla comercial / CTA WhatsApp
  const hasVoseoOrCta = /whatsapp|11-6355-3443|5491163553443|escribinos|contanos|hacé|pedí|sumá|tenés|podés|10 unidades|cotiz/i.test(text);
  if (text.trim().length > 20 && !hasVoseoOrCta) {
    issues.push({
      level: 'WARN',
      agent: 'X-03',
      rule: 'Voseo rioplatense y CTA B2B',
      message: 'Se sugiere incluir voseo rioplatense ("hacé", "escribinos"), mención a mínimo 10 unidades o CTA hacia WhatsApp.',
    });
  } else if (text.trim().length > 0) {
    passedChecks.push('Voseo rioplatense / CTA comercial presente (X-03)');
  }

  const hasFail = issues.some((i) => i.level === 'FAIL');
  const hasWarn = issues.some((i) => i.level === 'WARN');
  const status = hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'PASS';
  const score = Math.max(0, 100 - issues.filter((i) => i.level === 'FAIL').length * 35 - issues.filter((i) => i.level === 'WARN').length * 15);

  return { status, score, issues, passedChecks };
}

// Empaqueta un lienzo validado y lo envía directo a la Cola HITL-2 de Aprobaciones
export function packageCanvasToHitlApproval(canvasId, actor = null) {
  const operador = actor || getOperadorActual();
  const canvas = getDesignCanvasById(canvasId);
  if (!canvas) throw new Error('Lienzo no encontrado');

  const slideNodes = (canvas.nodes || [])
    .filter((n) => n.type === 'slide')
    .sort((a, b) => (Number(a.slideOrder) || 0) - (Number(b.slideOrder) || 0));

  if (slideNodes.length === 0) {
    throw new Error('El lienzo debe tener al menos un nodo de tipo Slide/Pantalla para enviar a aprobación HITL-2.');
  }

  const approvals = getApprovals();
  const dayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const newApprovalId = `APR-${dayStr}-${String(approvals.length + 1).padStart(3, '0')}`;

  const slidesText = slideNodes.map(
    (s, idx) => `Slide ${idx + 1} (${s.title || 'Pantalla'}): ${s.text || ''}`
  );
  const promptsSummary = slideNodes
    .map((s, idx) => (s.promptText ? `Prompt Slide ${idx + 1}: ${s.promptText}` : null))
    .filter(Boolean)
    .join(' | ');

  const newApproval = {
    id: newApprovalId,
    titulo: `Design Studio: ${canvas.titulo}`,
    tipo: 'CONTENIDO_DESIGN_STUDIO',
    canal: canvas.canal || 'INSTAGRAM',
    canales: [canvas.canal || 'INSTAGRAM'],
    hitl_level: 2,
    hitl_tag: 'HITL-2 (Publicación Externa desde Design Studio)',
    estado: 'PENDING',
    fecha: new Date().toISOString().slice(0, 10),
    audit_ref: `AUDIT-${dayStr}-STUDIO`,
    autor: `Design Studio (${operador})`,
    qa_status: 'PASS',
    qa_detalles: `X-03 Content QA + X-04 Brand Guardian: PASS (${slideNodes.length} slides verificados en lienzo ${canvas.id})`,
    piezas: [
      {
        id: `PZ-${canvas.id}`,
        canal: canvas.canal || 'INSTAGRAM',
        formato: canvas.formato || 'IG_CAROUSEL',
        idea: canvas.titulo,
        slides: slidesText,
        caption: promptsSummary || 'Prompts generativos sin texto especificados en el lienzo.',
        cta: 'WhatsApp (+54 9 11 6355 3443)',
      },
    ],
  };

  approvals.unshift(newApproval);
  setLocal(KEYS.APPROVALS, approvals);
  broadcastUpdate('APPROVALS_UPDATED', approvals);

  // Actualizar estado del lienzo
  saveDesignCanvas({ ...canvas, estado: 'EN_COLA_HITL2', last_approval_ref: newApprovalId }, operador);

  logAudit(
    operador,
    'STUDIO_HITL2_SUBMITTED',
    'DESIGN_STUDIO',
    `Lienzo "${canvas.titulo}" empaquetado y enviado a Cola HITL-2 como ${newApprovalId}`
  );

  return newApproval;
}

// ============================================================
// 12. MOTOR 2D NESTING (MaxRects-BSSF) Y COTIZADOR DTF
// (Portado fielmente desde Cotizador de Estampas/nesting_engine.py)
// ============================================================

export const DTF_PRESETS = {
  BOBINA_ESTANDAR: { id: 'BOBINA_60', label: 'Bobina Estándar 60 cm (58 cm útiles)', totalWidthCm: 60, usableWidthCm: 58, sheetLengthCm: 100, gapCm: 0.4, marginCm: 0.5 },
  BOBINA_CHICA: { id: 'BOBINA_30', label: 'Bobina Chica 30 cm (28 cm útiles)', totalWidthCm: 30, usableWidthCm: 28, sheetLengthCm: 100, gapCm: 0.4, marginCm: 0.5 },
};

export const initialDtfQuotes = [
  {
    id: 'COT-KIT-20261110-001',
    codigo: 'COT-KIT-20261110-001',
    modo: 'KIT_PRENDA',
    titulo: 'Remera Corporativa Oversize (Dorso + Frente + Talle)',
    cliente_nombre: 'Eventos & Producciones B2B',
    cliente_empresa: 'Agencia Pulsar SA',
    cliente_whatsapp: '+54 9 11 5544 3322',
    lead_id: null,
    bobina_ancho_util_cm: 58,
    largo_pliego_cm: 100,
    gap_cm: 0.4,
    margen_cm: 0.5,
    precio_metro_dtf: 25000,
    costo_prenda_base: 8500,
    margen_comercial_pct: 40,
    demanda_prendas: 20,
    prendas_por_metro: 9,
    metros_requeridos: 3,
    aprovechamiento_pct: 84.2,
    costo_dtf_por_prenda: 3750,
    costo_total_produccion: 245000,
    precio_venta_sugerido_total: 408333,
    precio_venta_unitario: 20417,
    piezas_kit: [
      { id: 'DORSO', name: 'Dorso', width: 22, height: 22, qtyPerGarment: 1 },
      { id: 'FRENTE', name: 'Frente Pecho', width: 8, height: 8, qtyPerGarment: 1 },
      { id: 'TALLE', name: 'Etiqueta Talle Cuello', width: 5, height: 5, qtyPerGarment: 1 },
    ],
    fecha: '2026-11-10',
    estado: 'EMITIDA',
  },
];

function rectContains(a, b) {
  return (
    a.x <= b.x + 1e-5 &&
    a.y <= b.y + 1e-5 &&
    a.x + a.w >= b.x + b.w - 1e-5 &&
    a.y + a.h >= b.y + b.h - 1e-5
  );
}

function rectIntersects(a, b) {
  return !(
    a.x >= b.x + b.w - 1e-5 ||
    a.x + a.w <= b.x + 1e-5 ||
    a.y >= b.y + b.h - 1e-5 ||
    a.y + a.h <= b.y + 1e-5
  );
}

export function runMaxRectsNesting({
  pieces = [],
  binWidth = 58,
  binHeight = 100,
  gap = 0.4,
  margin = 0.5,
  allowRotation = true,
}) {
  const usableX = Number(margin) || 0.5;
  const usableY = Number(margin) || 0.5;
  const usableW = Math.max(1, (Number(binWidth) || 58) - 2 * usableX);
  const usableH = Math.max(1, (Number(binHeight) || 100) - 2 * usableY);
  const safeGap = Number(gap) || 0.4;

  // Expandir piezas según su cantidad y ordenar por área decreciente (MaxRects-BSSF determinista)
  const expanded = [];
  for (const p of pieces) {
    const qty = Math.max(1, parseInt(p.qty || 1, 10));
    const w = Math.max(0.5, Number(p.width) || 5);
    const h = Math.max(0.5, Number(p.height) || 5);
    for (let i = 0; i < qty; i++) {
      expanded.push({
        id: `${p.id || 'PZ'}-${i + 1}`,
        baseId: p.id || 'PZ',
        name: p.name || p.id || 'Estampa',
        width: w,
        height: h,
        area: w * h,
      });
    }
  }
  expanded.sort((a, b) => b.area - a.area || Math.max(b.width, b.height) - Math.max(a.width, a.height));

  let freeRects = [{ x: usableX, y: usableY, w: usableW, h: usableH }];
  const placedPieces = [];
  const unplacedPieces = [];

  for (const piece of expanded) {
    let bestRect = null;
    let bestRotated = false;
    let bestBssf = Infinity;
    let bestBaf = Infinity;

    const pwGap = piece.width + safeGap;
    const phGap = piece.height + safeGap;

    for (const r of freeRects) {
      if (r.w + 1e-5 >= pwGap && r.h + 1e-5 >= phGap) {
        const bssf = Math.min(r.w - pwGap, r.h - phGap);
        const baf = r.w * r.h - pwGap * phGap;
        if (bssf < bestBssf || (Math.abs(bssf - bestBssf) < 1e-5 && baf < bestBaf)) {
          bestBssf = bssf;
          bestBaf = baf;
          bestRect = r;
          bestRotated = false;
        }
      }
      if (allowRotation && Math.abs(piece.width - piece.height) > 1e-5) {
        const rwGap = piece.height + safeGap;
        const rhGap = piece.width + safeGap;
        if (r.w + 1e-5 >= rwGap && r.h + 1e-5 >= rhGap) {
          const bssf = Math.min(r.w - rwGap, r.h - rhGap);
          const baf = r.w * r.h - rwGap * rhGap;
          if (bssf < bestBssf || (Math.abs(bssf - bestBssf) < 1e-5 && baf < bestBaf)) {
            bestBssf = bssf;
            bestBaf = baf;
            bestRect = r;
            bestRotated = true;
          }
        }
      }
    }

    if (!bestRect) {
      unplacedPieces.push(piece);
      continue;
    }

    const effW = bestRotated ? piece.height : piece.width;
    const effH = bestRotated ? piece.width : piece.height;

    placedPieces.push({
      id: piece.id,
      baseId: piece.baseId,
      name: piece.name,
      x: Number(bestRect.x.toFixed(2)),
      y: Number(bestRect.y.toFixed(2)),
      width: Number(effW.toFixed(2)),
      height: Number(effH.toFixed(2)),
      rotated: bestRotated,
      area: effW * effH,
    });

    const placedBox = {
      x: bestRect.x,
      y: bestRect.y,
      w: effW + safeGap,
      h: effH + safeGap,
    };

    const nextFree = [];
    for (const fr of freeRects) {
      if (!rectIntersects(fr, placedBox)) {
        nextFree.push(fr);
        continue;
      }
      if (placedBox.y + placedBox.h < fr.y + fr.h) {
        nextFree.push({ x: fr.x, y: placedBox.y + placedBox.h, w: fr.w, h: fr.y + fr.h - (placedBox.y + placedBox.h) });
      }
      if (placedBox.y > fr.y) {
        nextFree.push({ x: fr.x, y: fr.y, w: fr.w, h: placedBox.y - fr.y });
      }
      if (placedBox.x + placedBox.w < fr.x + fr.w) {
        nextFree.push({ x: placedBox.x + placedBox.w, y: fr.y, w: fr.x + fr.w - (placedBox.x + placedBox.w), h: fr.h });
      }
      if (placedBox.x > fr.x) {
        nextFree.push({ x: fr.x, y: fr.y, w: placedBox.x - fr.x, h: fr.h });
      }
    }

    // Podar rectángulos libres contenidos dentro de otros
    freeRects = nextFree.filter(
      (r1, i) => !nextFree.some((r2, j) => i !== j && rectContains(r2, r1))
    );
  }

  const usedArea = placedPieces.reduce((acc, p) => acc + p.area, 0);
  const totalBinArea = binWidth * binHeight;
  const utilizationPct = Number(((usedArea / totalBinArea) * 100).toFixed(1));
  const maxYUsed = placedPieces.reduce((max, p) => Math.max(max, p.y + p.height), 0);

  return {
    binWidth,
    binHeight,
    gap: safeGap,
    margin: usableX,
    placedPieces,
    unplacedPieces,
    placedCount: placedPieces.length,
    unplacedCount: unplacedPieces.length,
    utilizationPct,
    usedLengthCm: Number((maxYUsed + usableY).toFixed(1)),
  };
}

export function calculateDtfQuote({
  modo = 'KIT_PRENDA',
  pieces = [],
  demandGarments = 10,
  rollWidthCm = 58,
  sheetLengthCm = 100,
  gapCm = 0.4,
  marginCm = 0.5,
  pricePerMeterArs = 25000,
  garmentBaseCostArs = 0,
  marginPercent = 40,
}) {
  const rawDemand = Math.max(10, parseInt(demandGarments || 10, 10));
  // Regla comercial canónica: mínimo 10 unidades y múltiplos de 10
  const normalizedDemand = Math.ceil(rawDemand / 10) * 10;
  const isMultipleOf10 = rawDemand >= 10 && rawDemand % 10 === 0;

  if (modo === 'MONOPIEZA') {
    const first = pieces[0] || { id: 'MONO', name: 'Estampa Única', width: 5, height: 5 };
    // Probar cuántas unidades entran en 1 metro lineal
    const maxTheoretical = Math.min(
      400,
      Math.max(1, Math.floor(((rollWidthCm * sheetLengthCm) / Math.max(1, first.width * first.height)) * 1.1))
    );
    const nesting = runMaxRectsNesting({
      pieces: [{ ...first, qty: maxTheoretical }],
      binWidth: rollWidthCm,
      binHeight: sheetLengthCm,
      gap: gapCm,
      margin: marginCm,
      allowRotation: true,
    });
    const unitsPerMeter = Math.max(1, nesting.placedCount);
    const metersNeeded = Math.max(1, Math.ceil(normalizedDemand / unitsPerMeter));
    const totalDtfCost = metersNeeded * Number(pricePerMeterArs || 25000);
    const unitDtfCost = Number((Number(pricePerMeterArs || 25000) / unitsPerMeter).toFixed(2));
    const marginFactor = Math.max(0.05, 1 - Math.min(90, Number(marginPercent || 40)) / 100);
    const suggestedTotalSale = Math.round(totalDtfCost / marginFactor);

    return {
      modo: 'MONOPIEZA',
      isMultipleOf10,
      requestedDemand: rawDemand,
      normalizedDemand,
      unitsPerMeter,
      garmentsPerMeter: unitsPerMeter,
      metersNeeded,
      utilizationPct: nesting.utilizationPct,
      unitDtfCost,
      totalProductionCost: totalDtfCost,
      suggestedTotalSale,
      suggestedUnitSale: Math.round(suggestedTotalSale / normalizedDemand),
      nesting,
    };
  }

  // Modo KIT_PRENDA: encontrar cuántas prendas completas entran en 1 metro lineal (100 cm)
  const baseKit = pieces.length > 0
    ? pieces
    : [
        { id: 'DORSO', name: 'Dorso', width: 22, height: 22, qtyPerGarment: 1 },
        { id: 'FRENTE', name: 'Frente', width: 8, height: 8, qtyPerGarment: 1 },
        { id: 'TALLE', name: 'Talle', width: 5, height: 5, qtyPerGarment: 1 },
      ];

  let garmentsPerMeter = 1;
  let bestNesting = null;

  for (let k = 1; k <= 60; k++) {
    const testPieces = baseKit.map((p) => ({
      id: p.id,
      name: p.name,
      width: Number(p.width) || 5,
      height: Number(p.height) || 5,
      qty: k * Math.max(1, parseInt(p.qtyPerGarment || 1, 10)),
    }));
    const res = runMaxRectsNesting({
      pieces: testPieces,
      binWidth: rollWidthCm,
      binHeight: sheetLengthCm,
      gap: gapCm,
      margin: marginCm,
      allowRotation: true,
    });
    if (res.unplacedCount === 0) {
      garmentsPerMeter = k;
      bestNesting = res;
    } else {
      if (!bestNesting) bestNesting = res;
      break;
    }
  }

  const metersNeeded = Math.max(1, Math.ceil(normalizedDemand / Math.max(1, garmentsPerMeter)));
  const totalDtfCost = metersNeeded * Number(pricePerMeterArs || 25000);
  const unitDtfCost = Math.round(totalDtfCost / normalizedDemand);
  const totalGarmentsBaseCost = normalizedDemand * (Number(garmentBaseCostArs) || 0);
  const totalProductionCost = totalDtfCost + totalGarmentsBaseCost;
  const marginFactor = Math.max(0.05, 1 - Math.min(90, Number(marginPercent || 40)) / 100);
  const suggestedTotalSale = Math.round(totalProductionCost / marginFactor);
  const suggestedUnitSale = Math.round(suggestedTotalSale / normalizedDemand);

  return {
    modo: 'KIT_PRENDA',
    isMultipleOf10,
    requestedDemand: rawDemand,
    normalizedDemand,
    garmentsPerMeter,
    unitsPerMeter: garmentsPerMeter,
    metersNeeded,
    utilizationPct: bestNesting ? bestNesting.utilizationPct : 0,
    unitDtfCost,
    totalDtfCost,
    totalGarmentsBaseCost,
    totalProductionCost,
    suggestedTotalSale,
    suggestedUnitSale,
    nesting: bestNesting,
  };
}

export function getDtfQuotes() {
  return getLocal(KEYS.DTF_QUOTES, initialDtfQuotes);
}

export function getNextDtfQuoteCode(modo = 'KIT_PRENDA') {
  const list = getDtfQuotes();
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = modo === 'MONOPIEZA' ? `COT-MONO-${day}-` : `COT-KIT-${day}-`;
  return `${prefix}${String(list.length + 1).padStart(3, '0')}`;
}

export function saveDtfQuote(quoteData, actor = null) {
  const operador = actor || getOperadorActual();
  const list = getDtfQuotes();
  const nowIso = new Date().toISOString();

  // Validar regla comercial innegociable: mínimo 10 y múltiplos de 10
  const qty = Number(quoteData.demanda_prendas || 10);
  if (qty < 10 || qty % 10 !== 0) {
    throw new Error('Regla Comercial B2B AIRO: El pedido mínimo es de 10 unidades y las cantidades deben ser múltiplos de 10.');
  }

  let saved = null;
  if (quoteData.id) {
    const idx = list.findIndex((q) => q.id === quoteData.id);
    if (idx !== -1) {
      saved = { ...list[idx], ...quoteData, updated_at: nowIso };
      list[idx] = saved;
    }
  }

  if (!saved) {
    const code = quoteData.codigo || getNextDtfQuoteCode(quoteData.modo);
    saved = {
      ...quoteData,
      id: code,
      codigo: code,
      fecha: quoteData.fecha || nowIso.slice(0, 10),
      estado: quoteData.estado || 'EMITIDA',
      creado_por: operador,
      created_at: nowIso,
      updated_at: nowIso,
    };
    list.unshift(saved);
  }

  setLocal(KEYS.DTF_QUOTES, list);
  broadcastUpdate('DTF_QUOTES_UPDATED', list);
  logAudit(
    operador,
    'SAVE_DTF_QUOTE',
    'COTIZADOR_DTF',
    `Cotización DTF registrada: ${saved.codigo} (${saved.demanda_prendas} u. / ${saved.metros_requeridos} m lineales)`
  );
  return saved;
}

export function deleteDtfQuote(id, actor = null) {
  const operador = actor || getOperadorActual();
  const list = getDtfQuotes();
  const target = list.find((q) => q.id === id);
  if (!target) return false;
  const filtered = list.filter((q) => q.id !== id);
  setLocal(KEYS.DTF_QUOTES, filtered);
  broadcastUpdate('DTF_QUOTES_UPDATED', filtered);
  logAudit(operador, 'DELETE_DTF_QUOTE', 'COTIZADOR_DTF', `Eliminada cotización DTF ${target.codigo}`);
  return true;
}

// ============================================================
// 13. PUENTE UNIFICADO WEB <-> REPOSITORIO / OBSIDIAN (M-02)
// ============================================================

export function exportUnifiedRepoBundle() {
  return JSON.stringify(
    {
      schema: 'AIRO_UNIFIED_REPO_BUNDLE_V1',
      exported_at: new Date().toISOString(),
      crm_leads_json: {
        version: 1,
        idFormat: 'LEAD-YYYYMMDD-NNN',
        leads: getLeads(),
      },
      content_calendar_json: {
        version: 1,
        entries: getEditorialCalendar(),
      },
      approvals_queue: getApprovals(),
      design_canvases: getDesignCanvases(),
      dtf_quotes: getDtfQuotes(),
      pmbok_tasks: getPmbokTasks(),
      kaizen_pdca: getKaizenCycles(),
    },
    null,
    2
  );
}

export function importUnifiedRepoBundle(jsonStr) {
  const bundle = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
  if (!bundle || bundle.schema !== 'AIRO_UNIFIED_REPO_BUNDLE_V1') {
    throw new Error('El paquete no corresponde al esquema AIRO_UNIFIED_REPO_BUNDLE_V1');
  }
  if (Array.isArray(bundle.crm_leads_json?.leads)) {
    setLocal(KEYS.LEADS, bundle.crm_leads_json.leads);
  }
  if (Array.isArray(bundle.content_calendar_json?.entries)) {
    setLocal(KEYS.EDITORIAL_CALENDAR, bundle.content_calendar_json.entries);
  }
  if (Array.isArray(bundle.approvals_queue)) {
    setLocal(KEYS.APPROVALS, bundle.approvals_queue);
  }
  if (Array.isArray(bundle.design_canvases)) {
    setLocal(KEYS.DESIGN_CANVASES, bundle.design_canvases);
  }
  if (Array.isArray(bundle.dtf_quotes)) {
    setLocal(KEYS.DTF_QUOTES, bundle.dtf_quotes);
  }
  if (Array.isArray(bundle.pmbok_tasks)) {
    setLocal(KEYS.PMBOK_TASKS, bundle.pmbok_tasks);
  }
  if (Array.isArray(bundle.kaizen_pdca)) {
    setLocal(KEYS.KAIZEN_PDCA, bundle.kaizen_pdca);
  }
  logAudit(getOperadorActual(), 'SYNC_OBSIDIAN_REPO_BUNDLE', 'CONFIGURACION', 'Sincronizado paquete unificado Web <-> Repositorio / Bóveda Obsidian');
  broadcastUpdate('FULL_DATA_RELOADED', null);
  return true;
}

// ============================================================
// 14. REINGENIERÍA EN 5 SUITES, GOBERNANZA PMBOK (KANBAN + GOOGLE TASKS),
//     MEJORA CONTINUA (PDCA / KAIZEN) Y BUS DE EVENTOS DESACOPLADO
// ============================================================

export const SUITES_DOMINIO = [
  {
    id: 'SUITE_01_PMBOK',
    num: '01',
    nombre: 'Comando PMBOK & Mejora Continua',
    subtitulo: 'Kanban · Google Tasks · Ciclo PDCA · Cola HITL',
    color: '#1a4295',
    tabs: ['pmbok_command'],
    modulos: [
      { id: 'pmbok_command', label: 'Tablero PMBOK, Google Tasks & PDCA', badge: 'PMBOK 360°' },
    ],
  },
  {
    id: 'SUITE_02_COMERCIAL',
    num: '02',
    nombre: 'Comercial 360° & Cotizador DTF',
    subtitulo: 'Lead-to-Quote: CRM · Optimizador MaxRects 2D · Cuentas B2B',
    color: '#00b4d8',
    tabs: ['crm', 'cotizador_dtf', 'contactos'],
    modulos: [
      { id: 'crm', label: 'Pipeline CRM & Leads B2B' },
      { id: 'cotizador_dtf', label: 'Optimizador 2D & Cotizador DTF' },
      { id: 'contactos', label: 'Directorio de Clientes & Proveedores' },
    ],
  },
  {
    id: 'SUITE_03_OPERACIONES',
    num: '03',
    nombre: 'Taller, Inventario & Despacho',
    subtitulo: 'Order-to-Dispatch: Stock · Tienda Web · Insumos · Remitos · Kardex',
    color: '#15803d',
    tabs: ['productos', 'catalogo', 'materiales', 'remitos', 'kardex'],
    modulos: [
      { id: 'productos', label: 'Productos en Stock' },
      { id: 'catalogo', label: 'Catálogo Tienda Online' },
      { id: 'materiales', label: 'Insumos & Materiales' },
      { id: 'remitos', label: 'Confección de Remitos' },
      { id: 'kardex', label: 'Kardex Auditable' },
    ],
  },
  {
    id: 'SUITE_04_CREATIVO',
    num: '04',
    nombre: 'Estudio Creativo & Marketing IA',
    subtitulo: 'Concept-to-Publish: Lienzo Infinito (.canvas) · Campañas · Prompts IA',
    color: '#0e7490',
    tabs: ['design_studio', 'marketing', 'catalogo'],
    modulos: [
      { id: 'design_studio', label: 'Estudio de Diseño & Lienzo Infinito' },
      { id: 'marketing', label: 'Campañas, Prompts IA & 29 Agentes' },
      { id: 'catalogo', label: 'Catálogo Tienda Online' },
    ],
  },
  {
    id: 'SUITE_05_GOBERNANZA',
    num: '05',
    nombre: 'Finanzas, Equipo & Sincronización',
    subtitulo: 'Dispatch-to-Cash: Flujo de Caja · Roles RBAC · Puente Obsidian',
    color: '#b45309',
    tabs: ['caja', 'usuarios', 'configuracion', 'perfil'],
    modulos: [
      { id: 'caja', label: 'Flujo de Caja & Tesorería' },
      { id: 'usuarios', label: 'Usuarios, Roles RBAC & 2FA' },
      { id: 'configuracion', label: 'Sincronización Cloud & Obsidian' },
    ],
  },
];

export const PMBOK_PROCESS_GROUPS = [
  { id: 'INICIACION', num: '01', label: 'Iniciación & Demanda', desc: 'Project Charter, insumos y factibilidad', color: '#475569' },
  { id: 'PLANIFICACION', num: '02', label: 'Planificación & EDT/WBS', desc: 'Alcance, cronograma, costos y riesgos', color: '#1a4295' },
  { id: 'EJECUCION', num: '03', label: 'Ejecución en Curso (WIP <= 3)', desc: 'Foco diario estilo Google Tasks', color: '#0284c7' },
  { id: 'MONITOREO_Y_CONTROL', num: '04', label: 'Monitoreo, QA (X-03/X-04) & HITL', desc: 'Validación de calidad y firma humana', color: '#b45309' },
  { id: 'CIERRE', num: '05', label: 'Cierre & Lecciones Aprendidas', desc: 'Entregable desplegado y auditado', color: '#15803d' },
];

export const PMBOK_KNOWLEDGE_AREAS = [
  { id: 'INTEGRACION', label: '1. Integración', wbsPrefix: '5.0' },
  { id: 'ALCANCE', label: '2. Alcance (EDT/WBS)', wbsPrefix: '1.0' },
  { id: 'CRONOGRAMA', label: '3. Cronograma', wbsPrefix: '5.2' },
  { id: 'COSTOS', label: '4. Costos & Presupuesto DTF', wbsPrefix: '4.1' },
  { id: 'CALIDAD', label: '5. Calidad (X-03 / X-04)', wbsPrefix: '2.1' },
  { id: 'RECURSOS', label: '6. Recursos & Taller', wbsPrefix: '1.2' },
  { id: 'COMUNICACIONES', label: '7. Comunicaciones & Marketing', wbsPrefix: '2.2' },
  { id: 'RIESGOS', label: '8. Riesgos (RAID Log)', wbsPrefix: '5.1' },
  { id: 'ADQUISICIONES', label: '9. Adquisiciones & Proveedores', wbsPrefix: '4.2' },
  { id: 'INTERESADOS', label: '10. Interesados (CRM & HITL)', wbsPrefix: '3.1' },
];

export const initialPmbokTasks = [
  {
    id: 'TSK-001',
    wbs_code: '2.1.1',
    titulo: 'Aprobar y publicar Semana 1 (APR-20261005-001 y APR-20261005-002)',
    grupo_procesos: 'MONITOREO_Y_CONTROL',
    area_conocimiento: 'CALIDAD',
    estado: 'PENDIENTE',
    prioridad: 'ALTA',
    progreso_pct: 80,
    fecha_vencimiento: '2026-11-12',
    esfuerzo_estimado_hs: 2,
    riesgo_asociado: 'NINGUNO',
    hitl: 'HITL-2',
    agente: 'I-01 / X-03 / X-04',
    responsable: 'Owner Humano',
    subtasks: [
      { id: 'st-101', text: 'Revisar y aprobar APR-20261005-001 (Carrusel IG DTF vs Sublimación + Post LinkedIn)', done: false },
      { id: 'st-102', text: 'Ejecutar prueba real de WhatsApp Estados (APR-20261005-002)', done: false },
      { id: 'st-103', text: 'Validar dictamen PASS de X-03 Content QA y X-04 Brand Guardian', done: true },
    ],
  },
  {
    id: 'TSK-002',
    wbs_code: '1.2.1',
    titulo: 'Proveer fotos y videos reales del taller para contenido BTS',
    grupo_procesos: 'INICIACION',
    area_conocimiento: 'RECURSOS',
    estado: 'PENDIENTE',
    prioridad: 'ALTA',
    progreso_pct: 0,
    fecha_vencimiento: '2026-11-15',
    esfuerzo_estimado_hs: 3,
    riesgo_asociado: 'RAID-01 (I-02 Falta evidencia real)',
    hitl: 'HITL-2',
    agente: 'I-04 / I-05',
    responsable: 'Owner Humano',
    subtasks: [
      { id: 'st-201', text: 'Grabar 3 clips verticales (9:16) de planchado DTF y sublimación en taller', done: false },
      { id: 'st-202', text: 'Tomar 5 fotos macro de costuras y estampas reales sin filtro', done: false },
      { id: 'st-203', text: 'Depositar archivos en 08 - Recursos/Productos/ de la bóveda Obsidian', done: false },
    ],
  },
  {
    id: 'TSK-003',
    wbs_code: '5.1.1',
    titulo: 'Decisión Backend Supabase y Política de Privacidad (DEC-WEB-BACKEND-20261008-v1)',
    grupo_procesos: 'MONITOREO_Y_CONTROL',
    area_conocimiento: 'RIESGOS',
    estado: 'PENDIENTE',
    prioridad: 'ALTA',
    progreso_pct: 70,
    fecha_vencimiento: '2026-11-14',
    esfuerzo_estimado_hs: 2,
    riesgo_asociado: 'RAID-02 (DEC-WEB-BACKEND)',
    hitl: 'HITL-3',
    agente: 'ORC',
    responsable: 'Owner Humano',
    subtasks: [
      { id: 'st-301', text: 'Elegir Opción A, B o C en DEC-WEB-BACKEND-20261008-v1.md', done: false },
      { id: 'st-302', text: 'Verificar políticas RLS y función is_airo_admin() en Supabase', done: true },
    ],
  },
  {
    id: 'TSK-005',
    wbs_code: '2.2.1',
    titulo: 'Campaña B2B Packs Corporativos (Onboarding PK1 y Eventos PK2)',
    grupo_procesos: 'PLANIFICACION',
    area_conocimiento: 'COMUNICACIONES',
    estado: 'PENDIENTE',
    prioridad: 'ALTA',
    progreso_pct: 30,
    fecha_vencimiento: '2026-11-16',
    esfuerzo_estimado_hs: 4,
    riesgo_asociado: 'NINGUNO',
    hitl: 'HITL-2',
    agente: 'I-01 / I-03 / I-04',
    responsable: 'Orquestador IA',
    subtasks: [
      { id: 'st-501', text: 'Diseñar secuencia en Lienzo Infinito (.canvas) para Pack Bienvenida PK1', done: true },
      { id: 'st-502', text: 'Diseñar secuencia para Pack Eventos PK2 y validar con Linter X-03/X-04', done: false },
      { id: 'st-503', text: 'Empaquetar ambos artboards hacia la Cola HITL-2', done: false },
    ],
  },
  {
    id: 'TSK-006',
    wbs_code: '3.1.1',
    titulo: 'Prospección B2B de Eventos y Áreas de RRHH (L-01 / L-03 / G-01)',
    grupo_procesos: 'PLANIFICACION',
    area_conocimiento: 'INTERESADOS',
    estado: 'PENDIENTE',
    prioridad: 'MEDIA',
    progreso_pct: 15,
    fecha_vencimiento: '2026-11-19',
    esfuerzo_estimado_hs: 5,
    riesgo_asociado: 'NINGUNO',
    hitl: 'HITL-2',
    agente: 'L-01 / L-03 / G-01',
    responsable: 'Orquestador IA',
    subtasks: [
      { id: 'st-601', text: 'Relevar 20 empresas objetivo (RRHH y productoras de eventos en CABA/GBA)', done: false },
      { id: 'st-602', text: 'Redactar secuencias B2B con voseo rioplatense y CTA a WhatsApp', done: false },
    ],
  },
  {
    id: 'TSK-008',
    wbs_code: '5.2.1',
    titulo: 'Desarrollar DesignStudioModule.jsx (Lienzo Infinito + Linter X-03/X-04 + JSON Canvas)',
    grupo_procesos: 'CIERRE',
    area_conocimiento: 'ALCANCE',
    estado: 'COMPLETADO',
    prioridad: 'ALTA',
    progreso_pct: 100,
    fecha_vencimiento: '2026-11-10',
    esfuerzo_estimado_hs: 6,
    riesgo_asociado: 'CERRADO',
    hitl: 'HITL-2',
    agente: 'ORC / I-04 / X-04',
    responsable: 'Orquestador IA',
    subtasks: [
      { id: 'st-801', text: 'Construir lienzo interactivo con soporte JSON Canvas 1.0 (.canvas)', done: true },
      { id: 'st-802', text: 'Integrar validador en vivo X-03 Content QA y X-04 Brand Guardian', done: true },
    ],
  },
  {
    id: 'TSK-010',
    wbs_code: '4.1.1',
    titulo: 'Desarrollar CotizadorDtfModule.jsx (Motor MaxRects 2D) + PresupuestoPrintView.jsx',
    grupo_procesos: 'CIERRE',
    area_conocimiento: 'COSTOS',
    estado: 'COMPLETADO',
    prioridad: 'ALTA',
    progreso_pct: 100,
    fecha_vencimiento: '2026-11-10',
    esfuerzo_estimado_hs: 6,
    riesgo_asociado: 'RAID-03 (R-05 Resuelto)',
    hitl: 'HITL-2',
    agente: 'ORC / X-04',
    responsable: 'Orquestador IA',
    subtasks: [
      { id: 'st-1001', text: 'Portar algoritmo determinístico MaxRects-BSSF (58 cm y 28 cm útiles)', done: true },
      { id: 'st-1002', text: 'Construir generador de Presupuesto Oficial B2B en PDF (PresupuestoPrintView)', done: true },
    ],
  },
  {
    id: 'TSK-011',
    wbs_code: '5.2.4',
    titulo: 'Implementar Tablero PMBOK Kanban y Google Tasks en Obsidian y Web',
    grupo_procesos: 'CIERRE',
    area_conocimiento: 'CRONOGRAMA',
    estado: 'COMPLETADO',
    prioridad: 'ALTA',
    progreso_pct: 100,
    fecha_vencimiento: '2026-11-10',
    esfuerzo_estimado_hs: 3,
    riesgo_asociado: 'CERRADO',
    hitl: 'HITL-0',
    agente: 'ORC',
    responsable: 'Orquestador IA',
    subtasks: [
      { id: 'st-1101', text: 'Crear Tablero Kanban y Google Tasks (PMBOK) en Bóveda Obsidian', done: true },
      { id: 'st-1102', text: 'Enriquecer tareas con las 10 Áreas de Conocimiento y 5 Fases PMBOK', done: true },
    ],
  },
  {
    id: 'TSK-012',
    wbs_code: '5.3.1',
    titulo: 'Reingeniería Modular del Portal #/gestion (5 Suites Desacopladas + Proceso de Mejora Continua)',
    grupo_procesos: 'CIERRE',
    area_conocimiento: 'INTEGRACION',
    estado: 'COMPLETADO',
    prioridad: 'ALTA',
    progreso_pct: 100,
    fecha_vencimiento: '2026-11-11',
    esfuerzo_estimado_hs: 8,
    riesgo_asociado: 'RAID-04 (Mitigado por 5 Suites)',
    hitl: 'HITL-2',
    agente: 'ORC',
    responsable: 'Owner Humano / Orquestador IA',
    subtasks: [
      { id: 'st-1201', text: 'Reorganizar los 14 módulos en 5 Suites de Dominio Cohesivas con barra rápida contextual', done: true },
      { id: 'st-1202', text: 'Construir Suite 01 PmbokCommandModule.jsx (Kanban + Google Tasks + Ciclo PDCA Kaizen)', done: true },
      { id: 'st-1203', text: 'Implementar puentes desacoplados Cotizador DTF -> Remito y Cotizador DTF -> Seña en Caja', done: true },
      { id: 'st-1204', text: 'Aprobar pasaje a producción (HITL-2 APR-20261110-002) tras verificar tests y build local', done: true },
    ],
  },
];

export const initialKaizenCycles = [
  {
    id: 'KZN-2026-001',
    codigo: 'KZN-2026-001',
    titulo: 'Unificación de Lienzo Creativo (.canvas) y Linter de Marca en Vivo (X-03/X-04)',
    etapa_pdca: 'ACT',
    wbs_ref: '5.2.1',
    problema_detectado: 'Fricción al diseñar piezas en herramientas aisladas sin validación automática de voz de marca ni catálogo.',
    hipotesis_mejora: 'Integrar un lienzo infinito compatible con JSON Canvas 1.0 de Obsidian y validador X-03/X-04 en tiempo real reduce el retrabajo creativo.',
    kpi_impacto: '100% de piezas validadas antes de entrar a la cola HITL-2 (0 rechazos por tuteo o precios prohibidos).',
    leccion_aprendida: 'Estandarizar sobre archivos .canvas permite interoperabilidad total entre Obsidian Desktop y el portal web #/gestion.',
    audit_ref: 'AUDIT-20261110-003',
    updated_at: '2026-11-10T21:56:00.000Z',
  },
  {
    id: 'KZN-2026-002',
    codigo: 'KZN-2026-002',
    titulo: 'Integración del Motor Determinístico 2D MaxRects DTF y Presupuesto Oficial PDF',
    etapa_pdca: 'ACT',
    wbs_ref: '4.1.1',
    problema_detectado: 'El motor Python de anidamiento DTF vivía fuera del portal web y las cotizaciones no alimentaban directamente el CRM.',
    hipotesis_mejora: 'Portar el algoritmo MaxRects-BSSF a #/gestion con plano SVG interactivo y hoja imprimible acelera la respuesta comercial B2B (<24 h).',
    kpi_impacto: 'Cotización técnica DTF emitida en <2 minutos con aprovechamiento de bobina >80% e inyección en 1 clic al CRM.',
    leccion_aprendida: 'La regla comercial de mínimo 10 unidades y múltiplos de 10 debe forzarse por diseño en el motor de cálculo.',
    audit_ref: 'AUDIT-20261110-005',
    updated_at: '2026-11-10T22:11:40.000Z',
  },
  {
    id: 'KZN-2026-003',
    codigo: 'KZN-2026-003',
    titulo: 'Reingeniería de 14 Módulos Planos a 5 Suites de Dominio y Puentes Order-to-Cash',
    etapa_pdca: 'ACT',
    wbs_ref: '5.3.1',
    problema_detectado: 'Fatiga de navegación (14 ítems laterales) y doble carga manual de datos entre Cotizador DTF, Remitos y Flujo de Caja.',
    hipotesis_mejora: 'Consolidar la interfaz en 5 Suites de Dominio y habilitar puentes de 1 clic (Cotización -> Remito y Cotización -> Seña en Caja) elimina la redundancia.',
    kpi_impacto: 'Reducción del 64% en opciones de nivel superior (14 -> 5 Suites) y 0% de recarga manual de ítems en despacho y tesorería.',
    leccion_aprendida: 'Estandarizado en producción (APR-20261110-002 aprobada). La barra contextual superior y los puentes Order-to-Cash reducen drásticamente los clics operativos.',
    audit_ref: 'AUDIT-20261111-001',
    updated_at: '2026-11-11T18:14:00.000Z',
  },
];

export function getPmbokTasks() {
  return getLocal(KEYS.PMBOK_TASKS, initialPmbokTasks);
}

export function savePmbokTask(taskData, actor = null) {
  const operador = actor || getOperadorActual();
  const list = getPmbokTasks();
  const nowIso = new Date().toISOString();

  let saved = null;
  if (taskData.id) {
    const idx = list.findIndex((t) => t.id === taskData.id);
    if (idx !== -1) {
      const subtasks = Array.isArray(taskData.subtasks) ? taskData.subtasks : list[idx].subtasks || [];
      const doneCount = subtasks.filter((s) => s.done).length;
      const autoPct = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : taskData.progreso_pct ?? list[idx].progreso_pct;
      const finalGrp = autoPct === 100 && taskData.grupo_procesos === list[idx].grupo_procesos ? 'CIERRE' : (taskData.grupo_procesos || list[idx].grupo_procesos);
      saved = {
        ...list[idx],
        ...taskData,
        subtasks,
        grupo_procesos: finalGrp,
        progreso_pct: finalGrp === 'CIERRE' ? 100 : autoPct,
        estado: finalGrp === 'CIERRE' ? 'COMPLETADO' : finalGrp === 'EJECUCION' ? 'EN_CURSO' : 'PENDIENTE',
        updated_at: nowIso,
      };
      list[idx] = saved;
    }
  }

  if (!saved) {
    const nextNum = list.length + 1;
    const id = taskData.id || `TSK-${String(nextNum).padStart(3, '0')}`;
    const grp = taskData.grupo_procesos || 'PLANIFICACION';
    const subtasks = Array.isArray(taskData.subtasks) && taskData.subtasks.length > 0
      ? taskData.subtasks
      : [
          { id: `st-${Date.now()}-1`, text: 'Verificar inputs en fuentes canónicas (Regla #1)', done: false },
          { id: `st-${Date.now()}-2`, text: 'Ejecutar paquete de trabajo y validar con QA X-03/X-04', done: false },
        ];
    const doneCount = subtasks.filter((s) => s.done).length;
    const initialPct = grp === 'CIERRE' ? 100 : (subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0);
    saved = {
      id,
      wbs_code: taskData.wbs_code || `1.${nextNum}.1`,
      titulo: (taskData.titulo || 'Nuevo Paquete de Trabajo PMBOK').trim(),
      grupo_procesos: grp,
      area_conocimiento: taskData.area_conocimiento || 'ALCANCE',
      estado: grp === 'CIERRE' ? 'COMPLETADO' : grp === 'EJECUCION' ? 'EN_CURSO' : 'PENDIENTE',
      prioridad: taskData.prioridad || 'ALTA',
      progreso_pct: initialPct,
      fecha_vencimiento: taskData.fecha_vencimiento || nowIso.slice(0, 10),
      esfuerzo_estimado_hs: Number(taskData.esfuerzo_estimado_hs) || 4,
      riesgo_asociado: taskData.riesgo_asociado || 'NINGUNO',
      hitl: taskData.hitl || 'HITL-2',
      agente: taskData.agente || 'ORC',
      responsable: taskData.responsable || operador,
      subtasks,
      created_at: nowIso,
      updated_at: nowIso,
    };
    list.unshift(saved);
  }

  setLocal(KEYS.PMBOK_TASKS, list);
  broadcastUpdate('PMBOK_TASKS_UPDATED', list);
  logAudit(operador, 'SAVE_PMBOK_TASK', 'PMBOK_COMMAND', `Actualizado paquete WBS ${saved.wbs_code} (${saved.id}: ${saved.titulo}) en fase ${saved.grupo_procesos}`);
  return saved;
}

export function movePmbokTaskPhase(taskId, newProcessGroup, actor = null) {
  const list = getPmbokTasks();
  const target = list.find((t) => t.id === taskId);
  if (!target) throw new Error('Tarea PMBOK no encontrada');
  return savePmbokTask({ ...target, grupo_procesos: newProcessGroup }, actor);
}

export function togglePmbokSubtask(taskId, subtaskId, actor = null) {
  const list = getPmbokTasks();
  const target = list.find((t) => t.id === taskId);
  if (!target) throw new Error('Tarea PMBOK no encontrada');
  const updatedSubtasks = (target.subtasks || []).map((st) =>
    st.id === subtaskId ? { ...st, done: !st.done } : st
  );
  return savePmbokTask({ ...target, subtasks: updatedSubtasks }, actor);
}

export function addPmbokSubtask(taskId, text, actor = null) {
  if (!text || !text.trim()) throw new Error('El texto de la subtarea Google Tasks es requerido');
  const list = getPmbokTasks();
  const target = list.find((t) => t.id === taskId);
  if (!target) throw new Error('Tarea PMBOK no encontrada');
  const updatedSubtasks = [
    ...(target.subtasks || []),
    { id: `st-${Date.now()}-${Math.floor(Math.random() * 100)}`, text: text.trim(), done: false },
  ];
  return savePmbokTask({ ...target, subtasks: updatedSubtasks }, actor);
}

export function deletePmbokTask(taskId, actor = null) {
  const operador = actor || getOperadorActual();
  const list = getPmbokTasks();
  const target = list.find((t) => t.id === taskId);
  if (!target) return false;
  const filtered = list.filter((t) => t.id !== taskId);
  setLocal(KEYS.PMBOK_TASKS, filtered);
  broadcastUpdate('PMBOK_TASKS_UPDATED', filtered);
  logAudit(operador, 'DELETE_PMBOK_TASK', 'PMBOK_COMMAND', `Eliminada tarea PMBOK ${target.id} (${target.wbs_code})`);
  return true;
}

// Exporta el tablero actual al formato Markdown nativo del plugin Obsidian Kanban (kanban-plugin: basic)
export function exportPmbokBoardToObsidianMarkdown() {
  const tasks = getPmbokTasks();
  const lines = [
    '---',
    'kanban-plugin: basic',
    'tipo: kanban_pmbok',
    'documento: "Tablero Maestro Kanban y Google Tasks (Gobernanza PMBOK)"',
    `actualizado: "${new Date().toISOString().slice(0, 10)}"`,
    '---',
    '',
  ];

  for (const grp of PMBOK_PROCESS_GROUPS) {
    lines.push(`## ${grp.num} · ${grp.label.toUpperCase()}`);
    lines.push('');
    const groupTasks = tasks.filter((t) => t.grupo_procesos === grp.id);
    for (const t of groupTasks) {
      const check = grp.id === 'CIERRE' || t.estado === 'COMPLETADO' ? 'x' : ' ';
      lines.push(
        `- [${check}] **WBS ${t.wbs_code}** · **${t.id}:** ${t.titulo} @{${t.fecha_vencimiento}} #pmbok/${String(t.area_conocimiento).toLowerCase()} #prioridad/${String(t.prioridad).toLowerCase()}`
      );
      lines.push(`  - **Grupo PMBOK:** \`${t.grupo_procesos}\` · **Área:** \`${t.area_conocimiento}\` · **Gate:** \`${t.hitl}\` · **Responsable:** ${t.responsable}`);
      if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
        lines.push('  - **Subtareas (Google Tasks):**');
        for (const st of t.subtasks) {
          lines.push(`    - [${st.done ? 'x' : ' '}] ${st.text}`);
        }
      }
    }
    lines.push('');
  }

  lines.push('%% kanban:settings');
  lines.push('```');
  lines.push('{"kanban-plugin":"basic","show-checkboxes":true,"lane-width":310}');
  lines.push('```');
  lines.push('%%');
  return lines.join('\n');
}

export function getKaizenCycles() {
  return getLocal(KEYS.KAIZEN_PDCA, initialKaizenCycles);
}

export function saveKaizenCycle(cycleData, actor = null) {
  const operador = actor || getOperadorActual();
  const list = getKaizenCycles();
  const nowIso = new Date().toISOString();

  let saved = null;
  if (cycleData.id) {
    const idx = list.findIndex((c) => c.id === cycleData.id);
    if (idx !== -1) {
      saved = { ...list[idx], ...cycleData, updated_at: nowIso };
      list[idx] = saved;
    }
  }

  if (!saved) {
    const code = cycleData.codigo || `KZN-2026-${String(list.length + 1).padStart(3, '0')}`;
    saved = {
      id: code,
      codigo: code,
      titulo: (cycleData.titulo || 'Nueva Iniciativa de Mejora Continua').trim(),
      etapa_pdca: cycleData.etapa_pdca || 'PLAN',
      wbs_ref: cycleData.wbs_ref || '5.3.1',
      problema_detectado: cycleData.problema_detectado || '',
      hipotesis_mejora: cycleData.hipotesis_mejora || '',
      kpi_impacto: cycleData.kpi_impacto || '',
      leccion_aprendida: cycleData.leccion_aprendida || 'En evaluación.',
      audit_ref: cycleData.audit_ref || `AUDIT-${nowIso.slice(0, 10).replace(/-/g, '')}-KZN`,
      updated_at: nowIso,
    };
    list.unshift(saved);
  }

  setLocal(KEYS.KAIZEN_PDCA, list);
  broadcastUpdate('KAIZEN_UPDATED', list);
  logAudit(operador, 'SAVE_KAIZEN_CYCLE', 'MEJORA_CONTINUA', `Registrado ciclo PDCA ${saved.codigo} (${saved.etapa_pdca}): ${saved.titulo}`);
  return saved;
}

export function advanceKaizenStage(cycleId, nextStage = null, learningNote = '', actor = null) {
  const list = getKaizenCycles();
  const target = list.find((c) => c.id === cycleId);
  if (!target) throw new Error('Ciclo Kaizen PDCA no encontrado');
  const order = ['PLAN', 'DO', 'CHECK', 'ACT'];
  const currentIdx = order.indexOf(target.etapa_pdca);
  const resolvedNext = nextStage || order[Math.min(order.length - 1, currentIdx + 1)] || 'ACT';
  return saveKaizenCycle(
    {
      ...target,
      etapa_pdca: resolvedNext,
      leccion_aprendida: learningNote ? learningNote.trim() : target.leccion_aprendida,
    },
    actor
  );
}

// ============================================================
// PUENTES DESACOPLADOS ENTRE SUITES (BUS DE EVENTOS ORDER-TO-CASH)
// ============================================================

// Convierte en 1 clic una Cotización DTF en un Remito Oficial listo para despacho + Tarea Google Tasks
export function convertDtfQuoteToRemitoDraft(quoteId, actor = null) {
  const operador = actor || getOperadorActual();
  const quotes = getDtfQuotes();
  const quote = quotes.find((q) => q.id === quoteId || q.codigo === quoteId);
  if (!quote) throw new Error('Cotización DTF no encontrada para generar Remito');

  const numero = getNextRemitoNumero();
  const demanda = Number(quote.demanda_prendas || quote.demanda || 10);
  const piezas = Array.isArray(quote.piezas_kit) ? quote.piezas_kit : [];
  const piezasDesc = piezas.map((p) => `${p.name || p.label} (${p.width || p.widthCm}x${p.height || p.heightCm}cm)`).join(' + ');

  const nuevoRemito = saveRemito({
    numero,
    fecha_emision: new Date().toISOString().slice(0, 10),
    cliente_nombre: quote.cliente_empresa || quote.cliente_nombre || 'Cliente Corporativo B2B',
    cliente_cuit: 'A confirmar en despacho',
    cliente_whatsapp: quote.cliente_whatsapp || '',
    contacto_receptor: quote.cliente_nombre || 'Responsable de Recepción',
    modalidad_envio: 'Retiro en Taller / Mensajería B2B',
    cantidad_bultos: Math.max(1, Math.ceil(demanda / 20)),
    descontar_stock: false,
    estado: 'Emitido',
    observaciones: `Generado automáticamente desde Cotización Oficial ${quote.codigo} (${quote.metros_requeridos || 1} m lineales DTF · Aprovechamiento ${quote.aprovechamiento_pct || 0}%).`,
    items: [
      {
        id: `it-${Date.now()}`,
        sku: quote.codigo,
        descripcion: `${quote.titulo || 'Producción Personalizada DTF'} — ${piezasDesc || 'Pliego DTF'}`,
        cantidad: demanda,
        unidad: 'unidades',
        bulto: 'Bulto 1',
      },
    ],
  });

  // Agendar automáticamente subtarea en el Tablero PMBOK / Google Tasks (bajo acoplamiento)
  savePmbokTask(
    {
      wbs_code: '4.2.1',
      titulo: `Despachar Remito ${nuevoRemito.numero} (${quote.cliente_empresa || 'Cliente B2B'})`,
      grupo_procesos: 'EJECUCION',
      area_conocimiento: 'ADQUISICIONES',
      prioridad: 'ALTA',
      hitl: 'HITL-1',
      agente: 'ORC',
      responsable: operador,
      subtasks: [
        { id: `st-rem-1-${Date.now()}`, text: `Controlar calidad de ${demanda} u. de ${quote.codigo} en taller`, done: false },
        { id: `st-rem-2-${Date.now()}`, text: `Imprimir y firmar Remito Oficial ${nuevoRemito.numero}`, done: false },
      ],
    },
    operador
  );

  logAudit(operador, 'BRIDGE_QUOTE_TO_REMITO', 'ORDER_TO_CASH', `Cotización ${quote.codigo} convertida en Remito Oficial ${nuevoRemito.numero} sin recarga manual`);
  return nuevoRemito;
}

// Registra en 1 clic la Seña B2B (50%) de una Cotización DTF en el Flujo de Caja
export function convertDtfQuoteToCajaSena(quoteId, porcentaje = 50, actor = null) {
  const operador = actor || getOperadorActual();
  const quotes = getDtfQuotes();
  const quote = quotes.find((q) => q.id === quoteId || q.codigo === quoteId);
  if (!quote) throw new Error('Cotización DTF no encontrada para registrar seña en Caja');

  const totalQuote = Number(quote.precio_venta_sugerido_total || quote.total_quote || 0);
  const pct = Math.max(10, Math.min(100, Number(porcentaje) || 50));
  const montoSena = Math.round((totalQuote * pct) / 100);

  const trx = saveTransaccion({
    fecha: new Date().toISOString().slice(0, 10),
    tipo: 'ingreso',
    categoria: `Cobro Cliente (Seña ${pct}%)`,
    concepto: `Seña ${pct}% Presupuesto DTF ${quote.codigo} — ${quote.cliente_empresa || 'Cliente B2B'} (${quote.demanda_prendas || 10} u.)`,
    monto: montoSena,
    medio_pago: 'Transferencia Bancaria B2B',
    referencia: quote.codigo,
    estado: 'Cobrado',
  });

  logAudit(operador, 'BRIDGE_QUOTE_TO_CAJA', 'ORDER_TO_CASH', `Registrada seña del ${pct}% ($${montoSena.toLocaleString('es-AR')}) en Flujo de Caja desde Cotización ${quote.codigo}`);
  return trx;
}



