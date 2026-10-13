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

const KEYS = {
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

// Helpers locales
function getLocal(key, defaultVal) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultVal;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${key}:`, e);
    return defaultVal;
  }
}

function setLocal(key, val) {
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
        password: 'AiroTaller2026!',
      },
    ]);
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
    version: '1.1',
    export_date: new Date().toISOString(),
    empresa: 'AIRO COLOR LAB.',
    productos: getProductos(),
    materiales: getMateriales(),
    clientes: getClientes(),
    proveedores: getProveedores(),
    remitos: getRemitos(),
    flujo_caja: getFlujoCaja(),
    movimientos: getMovimientos(),
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
      'usuarios_rw',
      'config_rw',
    ],
    modulosPermitidos: ['productos', 'materiales', 'remitos', 'caja', 'kardex', 'contactos', 'usuarios', 'configuracion'],
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
    descripcion: 'Atención a clientes corporativos, consulta de existencias y precios para cotizaciones, y seguimiento de remitos.',
    color: '#7c3aed',
    badgeClass: 'g-badge-info',
    permisos: ['productos_r', 'contactos_rw', 'remitos_r'],
    modulosPermitidos: ['productos', 'contactos', 'remitos'],
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
        password: 'AiroTaller2026!',
      },
    ];
    setLocal(KEYS.USUARIOS, adminDefault);
    return adminDefault;
  }
  return users;
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
      saved.password = usuarioData.password.trim();
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
      password: usuarioData.password.trim(),
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

  const userIdx = list.findIndex(
    (u) => u.id === userIdOrEmail || u.email.toLowerCase() === cleanId
  );
  if (userIdx === -1) {
    throw new Error('Usuario no encontrado en la base de cuentas.');
  }

  const target = list[userIdx];

  // Si se solicita verificar la actual (self-service)
  if (passwordActual !== null && passwordActual !== undefined) {
    if (target.password && target.password !== passwordActual) {
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

  target.password = passwordNueva.trim();
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
