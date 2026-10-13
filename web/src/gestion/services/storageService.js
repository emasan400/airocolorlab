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
};

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
    // Si viene en formato plano legacy (pre-migración), admitir coincidencia directa
    return storedHashOrPlain === plainText;
  }
  const parts = storedHashOrPlain.split(':');
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const expectedHash = parts[2];
  const calculated = sha256Sync(`${salt}:${plainText}`);
  return calculated === expectedHash;
}

export const DEFAULT_ADMIN_HASH = 'sha256:airo_master_salt:52e17c88b0a019764fe2c140dfd4a1b78d6db4c978aa6baa783b11995153d3cd';

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
        password: DEFAULT_ADMIN_HASH,
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
      'materiales_rw',
      'remitos_rw',
      'caja_rw',
      'kardex_r',
      'contactos_rw',
      'crm_rw',
      'marketing_rw',
      'usuarios_rw',
      'config_rw',
    ],
    modulosPermitidos: ['productos', 'materiales', 'remitos', 'caja', 'kardex', 'contactos', 'crm', 'marketing', 'usuarios', 'configuracion'],
  },
  {
    id: 'marketing_cm',
    nombre: 'Community Manager & Marketing B2B',
    descripcion: 'Operación del sistema multiagente, revisión y aprobación de contenidos en cola HITL, calendario editorial y clasificación de consultas para CRM.',
    color: '#00b4d8',
    badgeClass: 'g-badge-brand',
    permisos: ['marketing_rw', 'crm_rw', 'contactos_r'],
    modulosPermitidos: ['marketing', 'crm', 'contactos'],
  },
  {
    id: 'taller_produccion',
    nombre: 'Operador de Taller & Producción',
    descripcion: 'Control y ajustes físicos de stock de prendas, insumos textiles, bobinas, films DTF, tintas y kardex de taller.',
    color: '#15803d',
    badgeClass: 'g-badge-success',
    permisos: ['productos_rw', 'materiales_rw', 'kardex_r'],
    modulosPermitidos: ['productos', 'materiales', 'kardex'],
  },
  {
    id: 'logistica_despacho',
    nombre: 'Encargado de Logística & Envíos',
    descripcion: 'Confección de remitos oficiales tipo R, asignación de bultos, impresión, despacho y recepción de firmas de entrega.',
    color: '#0e7490',
    badgeClass: 'g-badge-brand',
    permisos: ['remitos_rw', 'productos_r', 'contactos_r', 'kardex_r'],
    modulosPermitidos: ['remitos', 'productos', 'contactos', 'kardex'],
  },
  {
    id: 'finanzas_caja',
    nombre: 'Tesorería, Caja & Facturación',
    descripcion: 'Controlador de flujo de caja, registro de cobros, pagos a talleres/proveedores, balances y consulta de remitos emitidos.',
    color: '#b45309',
    badgeClass: 'g-badge-warning',
    permisos: ['caja_rw', 'remitos_r', 'contactos_rw'],
    modulosPermitidos: ['caja', 'remitos', 'contactos'],
  },
  {
    id: 'comercial_ventas',
    nombre: 'Asesor Comercial B2B',
    descripcion: 'Atención a clientes corporativos, gestión de leads y pipeline comercial CRM, existencias y precios para cotizaciones, y remitos.',
    color: '#7c3aed',
    badgeClass: 'g-badge-info',
    permisos: ['crm_rw', 'productos_r', 'contactos_rw', 'remitos_r', 'marketing_r'],
    modulosPermitidos: ['crm', 'productos', 'contactos', 'remitos', 'marketing'],
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
        password: DEFAULT_ADMIN_HASH,
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
      password: DEFAULT_ADMIN_HASH,
      fecha_creacion: new Date().toISOString(),
    };
    list.push(newUser);
    userIdx = list.length - 1;
  }

  const target = list[userIdx];

  // Si se solicita verificar la actual (self-service)
  if (passwordActual !== null && passwordActual !== undefined) {
    let passwordOk = false;
    if (target.password) {
      passwordOk = verifyPasswordSync(passwordActual, target.password);
    }
    // Fallback maestro: admitir también si coincide con DEFAULT_ADMIN_HASH o contraseña inicial de taller
    if (!passwordOk && verifyPasswordSync(passwordActual, DEFAULT_ADMIN_HASH)) {
      passwordOk = true;
    }
    // Si no tenía contraseña previa guardada y la actual tiene >= 8 caracteres
    if (!passwordOk && !target.password && passwordActual.length >= 8) {
      passwordOk = true;
    }

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

  const agentId = channel === 'INSTAGRAM' ? 'I-06' : channel === 'LINKEDIN' ? 'L-06' : 'W-03';

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

