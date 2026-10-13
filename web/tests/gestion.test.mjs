import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage and BroadcastChannel in Node environment
const store = new Map();
global.localStorage = {
  getItem: (k) => store.get(k) || null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

global.BroadcastChannel = class {
  postMessage() {}
  addEventListener() {}
  removeEventListener() {}
};

// Import storageService
const storage = await import('../src/gestion/services/storageService.js');
const seed = await import('../src/gestion/services/seedData.js');

test('Inicialización de base de datos con inicio limpio sin datos de muestra', () => {
  storage.initializeStorageIfEmpty();

  const prods = storage.getProductos();
  assert.equal(prods.length, 0, 'Los productos deben iniciar vacíos');

  const mats = storage.getMateriales();
  assert.equal(mats.length, 0, 'Los insumos deben iniciar vacíos');

  const rems = storage.getRemitos();
  assert.equal(rems.length, 0, 'Los remitos deben iniciar vacíos');

  const flujos = storage.getFlujoCaja();
  assert.equal(flujos.length, 0, 'El flujo de caja debe iniciar vacío');
});

test('ABM de Productos en Stock', () => {
  const nuevoProd = {
    sku: 'PROD-TEST-999',
    nombre: 'Prenda Test Calidad',
    categoria: 'indumentaria',
    talle: 'XL',
    color: 'Azul Marino',
    stock_actual: 50,
    stock_minimo: 15,
    costo_unitario: 5000,
    precio_venta: 10000,
  };

  const creado = storage.saveProducto(nuevoProd);
  assert.ok(creado.id, 'Debe asignar ID');
  assert.equal(creado.stock_actual, 50);

  // Ajuste rápido de stock (+5)
  const ajustado = storage.adjustStockProducto(creado.id, 5, 'Ingreso adicional test');
  assert.equal(ajustado.stock_actual, 55, 'Stock debe ser 55');

  // Eliminar
  const eliminado = storage.deleteProducto(creado.id);
  assert.equal(eliminado, true);
  const buscar = storage.getProductos().find((p) => p.id === creado.id);
  assert.equal(buscar, undefined, 'No debe existir tras eliminación');
});

test('ABM de Materiales e Insumos', () => {
  const nuevoMat = {
    codigo: 'MAT-TEST-888',
    nombre: 'Hilo Especial Test',
    categoria: 'hilos_bordado',
    unidad: 'unidades',
    stock_actual: 20,
    stock_minimo: 5,
    costo_unitario: 1200,
  };

  const creado = storage.saveMaterial(nuevoMat);
  assert.ok(creado.id);
  assert.equal(creado.stock_actual, 20);

  // Ajuste de insumo (-3)
  const ajustado = storage.adjustStockMaterial(creado.id, -3, 'Consumo en costura test');
  assert.equal(ajustado.stock_actual, 17);

  storage.deleteMaterial(creado.id);
  assert.equal(storage.getMateriales().find((m) => m.id === creado.id), undefined);
});

test('Confección de Remitos y Descuento Automático de Stock', () => {
  const prod = storage.saveProducto({
    sku: 'PROD-REM-TEST',
    nombre: 'Remera Algodón Peinado Test',
    categoria: 'indumentaria',
    talle: 'L',
    color: 'Negro',
    stock_actual: 50,
    stock_minimo: 10,
    costo_unitario: 4500,
    precio_venta: 8900,
  });
  const stockInicial = prod.stock_actual;

  const num = storage.getNextRemitoNumero();
  assert.match(num, /^R-0001-\d{8}$/, 'El correlativo debe seguir el formato oficial');

  const nuevoRemito = {
    numero: num,
    fecha_emision: '2026-10-13',
    cliente_nombre: 'Cliente Test S.A.',
    cliente_cuit: '30-11223344-5',
    modalidad_envio: 'Mensajería Propia AIRO',
    cantidad_bultos: 1,
    descontar_stock: true,
    estado: 'Emitido',
    items: [
      {
        producto_id: prod.id,
        sku: prod.sku,
        descripcion: prod.nombre,
        cantidad: 10,
        unidad: 'unidades',
      },
    ],
  };

  const emitido = storage.saveRemito(nuevoRemito);
  assert.ok(emitido.id);

  // Verificar que el stock se descontó
  const prodActualizado = storage.getProductos().find((p) => p.id === prod.id);
  assert.equal(prodActualizado.stock_actual, stockInicial - 10, 'El stock debió descontarse en 10');

  // Anular remito -> debe reponer stock
  storage.cambiarEstadoRemito(emitido.id, 'Anulado');
  const prodRepuesto = storage.getProductos().find((p) => p.id === prod.id);
  assert.equal(prodRepuesto.stock_actual, stockInicial, 'El stock debió reponerse tras anulación');
});

test('Controlador de Flujo de Caja y Cálculos Financieros', () => {
  const trxIngreso = storage.saveTransaccion({
    tipo: 'ingreso',
    categoria: 'Cobro Cliente (Seña 50%)',
    concepto: 'Cobro test ingreso',
    monto: 100000,
    estado: 'Cobrado',
  });
  assert.ok(trxIngreso.id);

  const trxEgreso = storage.saveTransaccion({
    tipo: 'egreso',
    categoria: 'Materia Prima (Telas e Hilados)',
    concepto: 'Gasto test tela',
    monto: 40000,
    estado: 'Pagado',
  });
  assert.ok(trxEgreso.id);

  const todos = storage.getFlujoCaja();
  const totalIng = todos.filter((t) => t.tipo === 'ingreso' && t.estado === 'Cobrado').reduce((a, b) => a + Number(b.monto), 0);
  const totalEgr = todos.filter((t) => t.tipo === 'egreso' && t.estado === 'Pagado').reduce((a, b) => a + Number(b.monto), 0);
  const balance = totalIng - totalEgr;

  assert.ok(totalIng > 0, 'Debe haber ingresos cobrados');
  assert.ok(totalEgr > 0, 'Debe haber egresos pagados');
  assert.equal(typeof balance, 'number');
});

test('Auditoría Append-Only & Respaldo JSON', () => {
  const logs = storage.getAuditLogs();
  assert.ok(logs.length > 0, 'Debe haber registros de auditoría');
  const ultimo = logs[0];
  assert.ok(ultimo.RESULT, 'Debe cumplir campo RESULT según regla AIRO');

  // Exportar backup
  const backupStr = storage.exportarBackupCompleto();
  const parsed = JSON.parse(backupStr);
  assert.equal(parsed.empresa, 'AIRO COLOR LAB.');
  assert.ok(Array.isArray(parsed.productos));
  assert.ok(Array.isArray(parsed.materiales));
  assert.ok(Array.isArray(parsed.remitos));
  assert.ok(Array.isArray(parsed.flujo_caja));
});

test('Auditoría de Seguridad: No exposición pública y blindaje RLS', async () => {
  const fs = await import('node:fs/promises');
  
  // 1. Verificar que el footer público no contenga enlaces a gestión
  const footerContent = await fs.readFile('./src/components/Footer.jsx', 'utf-8');
  assert.ok(!footerContent.includes('#/gestion'), 'El footer público no debe exponer enlace a #/gestion');
  assert.ok(!footerContent.includes('Gestión Operativa'), 'El footer no debe tener texto de gestión');

  // 2. Verificar que el login público no tenga bypass de gestión
  const adminContent = await fs.readFile('./src/admin/Admin.jsx', 'utf-8');
  const loginSection = adminContent.slice(adminContent.indexOf('function Login'), adminContent.indexOf('function ProductosPanel'));
  assert.ok(!loginSection.includes('#/gestion'), 'El formulario de login no debe tener enlace directo sin autenticar');

  // 3. Verificar que el schema SQL revoque permisos a anon y contenga is_airo_admin()
  const sqlContent = await fs.readFile('../db/schema-gestion.sql', 'utf-8');
  assert.ok(sqlContent.includes('revoke all on clientes'), 'El schema SQL debe revocar permisos a anon y public');
  assert.ok(sqlContent.includes('is_airo_admin()'), 'El schema SQL debe validar la función is_airo_admin()');
  assert.ok(sqlContent.includes('api_keys_integraciones'), 'Debe existir tabla para interfaces de sistemas externos');
});

