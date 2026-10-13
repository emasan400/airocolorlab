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

  // Modificar remito existente
  const modificado = storage.saveRemito({
    ...emitido,
    cliente_nombre: 'Cliente Test S.A. (Modificado)',
    cantidad_bultos: 3,
    observaciones: 'Observación modificada correctamente',
  });
  assert.equal(modificado.cliente_nombre, 'Cliente Test S.A. (Modificado)');
  assert.equal(modificado.cantidad_bultos, 3);
  const buscarMod = storage.getRemitos().find((r) => r.id === emitido.id);
  assert.equal(buscarMod.cliente_nombre, 'Cliente Test S.A. (Modificado)');

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

test('Matriz de Roles y Gestión de Usuarios (RBAC)', () => {
  const users = storage.getUsuarios();
  assert.ok(users.length >= 1, 'Debe existir al menos el usuario admin inicial');
  assert.equal(users[0].rol, 'admin', 'El usuario inicial debe ser admin');

  // Crear colaborador de taller
  const operarioTaller = storage.saveUsuario({
    nombre: 'Martín Taller Textil',
    email: 'taller.dtf@airocolorlab.com',
    rol: 'taller_produccion',
    password: 'PasswordTaller123!',
  });
  assert.ok(operarioTaller.id);
  assert.equal(operarioTaller.rol, 'taller_produccion');
  assert.ok(operarioTaller.password.startsWith('sha256:'), 'Contraseña guardada debe tener hash sha256 con salt');
  assert.ok(storage.verifyPasswordSync('PasswordTaller123!', operarioTaller.password), 'Debe verificar correctamente la clave del colaborador');

  // Validar permisos según matriz
  assert.equal(storage.isModuloPermitido(operarioTaller.rol, 'materiales'), true, 'Taller debe acceder a insumos');
  assert.equal(storage.isModuloPermitido(operarioTaller.rol, 'caja'), false, 'Taller NO debe acceder a caja');

  // Crear colaboradora de finanzas
  const tesorera = storage.saveUsuario({
    nombre: 'Carolina Tesorería',
    email: 'caja@airocolorlab.com',
    rol: 'finanzas_caja',
    password: 'PasswordCaja456!',
  });
  assert.equal(storage.isModuloPermitido(tesorera.rol, 'caja'), true, 'Finanzas debe acceder a caja');
  assert.equal(storage.isModuloPermitido(tesorera.rol, 'materiales'), false, 'Finanzas NO debe acceder a materiales');

  // Intentar eliminar el único admin -> debe arrojar error
  const adminUser = users.find((u) => u.rol === 'admin');
  assert.throws(
    () => storage.deleteUsuario(adminUser.id),
    /No se puede eliminar el único Administrador General/,
    'Debe proteger la existencia de al menos un administrador'
  );

  // Eliminar usuario no-admin
  const eliminado = storage.deleteUsuario(operarioTaller.id);
  assert.equal(eliminado, true);
});

test('Cambio y Reseteo Seguro de Contraseña', async () => {
  // Crear usuario de prueba
  const testUser = storage.saveUsuario({
    nombre: 'Usuario Prueba Password',
    email: 'test.pwd@airocolorlab.com',
    rol: 'logistica_despacho',
    password: 'PasswordInicial123!',
  });

  // 1. Cambio con contraseña actual errónea -> debe fallar
  await assert.rejects(
    async () => storage.cambiarPasswordUsuario(testUser.id, 'ClaveIncorrecta', 'NuevaClaveSegura2026!'),
    /incorrecta/,
    'Debe validar la contraseña actual'
  );

  // 2. Cambio con contraseña menor a 8 caracteres -> debe fallar
  await assert.rejects(
    async () => storage.cambiarPasswordUsuario(testUser.id, 'PasswordInicial123!', 'corta'),
    /al menos 8 caracteres/,
    'Debe exigir mínimo 8 caracteres'
  );

  // 3. Cambio correcto self-service (debe encriptarse con SHA-256 + salt y no quedar en plano)
  const res = await storage.cambiarPasswordUsuario(testUser.id, 'PasswordInicial123!', 'NuevaClaveSegura2026!');
  assert.ok(res.ok);

  const actualizado = storage.getUsuarioPorEmail('test.pwd@airocolorlab.com');
  assert.ok(storage.verifyPasswordSync('NuevaClaveSegura2026!', actualizado.password), 'Debe verificar correctamente la clave');
  assert.ok(actualizado.password.startsWith('sha256:'), 'Debe estar hasheada con prefijo sha256:salt:hash');
  assert.notEqual(actualizado.password, 'NuevaClaveSegura2026!', 'Jamás debe guardarse en texto plano');

  // 4. Reseteo administrativo (sin requerir la anterior)
  await storage.adminResetPassword(testUser.id, 'ResetPorAdmin888!');
  const reseteado = storage.getUsuarioPorEmail('test.pwd@airocolorlab.com');
  assert.ok(storage.verifyPasswordSync('ResetPorAdmin888!', reseteado.password), 'Debe verificar correctamente la nueva clave reseteada');
  assert.ok(reseteado.password.startsWith('sha256:'), 'La clave reseteada debe quedar hasheada');
  assert.notEqual(reseteado.password, 'ResetPorAdmin888!', 'Jamás debe quedar en texto plano en la base');
});

test('CRM B2B — Pipeline, Deduplicación CRM-MATCH-EXPLICIT-IDENTITY y RBAC', () => {
  // 1. Inicialización y alta de lead
  const initial = storage.getLeads();
  assert.ok(Array.isArray(initial));

  const lead1 = storage.saveLead({
    company: 'Cervecera Quilmes B2B',
    contact: 'Federico Gómez',
    email: 'compras@quilmes-merch.com',
    phone: '1155443322',
    channel: 'WHATSAPP',
    origin: 'INSTAGRAM',
    interest: '100 Remeras Oversize DTF 24/1 Peinado',
    quantity: 100,
    score: 85,
    status: 'NEW',
    next_action: 'Enviar cotización formal con tabla de talles',
  });

  assert.equal(lead1.type, 'created');
  assert.ok(lead1.lead.lead_id.startsWith('LEAD-'));
  assert.equal(lead1.lead.status, 'NEW');
  assert.equal(lead1.lead.email, 'compras@quilmes-merch.com');
  assert.equal(lead1.lead.phone, '1155443322');
  assert.equal(lead1.lead.history.length, 1);
  assert.equal(lead1.lead.history[0].event, 'created');

  // 2. Deduplicación por email idéntico -> debe fusionar sin duplicar
  const leadMerge = storage.saveLead({
    company: 'Cervecería Quilmes SA',
    email: 'compras@quilmes-merch.com',
    channel: 'WHATSAPP',
    origin: 'WHATSAPP',
    interest: '50 Buzos Frizados adicionales',
    quantity: 50,
  });

  assert.equal(leadMerge.type, 'merged', 'Debe detectar identidad explícita y fusionar');
  assert.equal(leadMerge.lead.lead_id, lead1.lead.lead_id, 'Debe preservar el ID original');
  assert.ok(leadMerge.lead.origins.includes('INSTAGRAM'));
  assert.ok(leadMerge.lead.origins.includes('WHATSAPP'));
  assert.ok(leadMerge.lead.history.some((h) => h.event === 'merged'), 'Debe registrar evento merged en historial');

  // 3. Identidad conflictiva (mismo teléfono pero distinto email no vacío) -> debe rechazar
  assert.throws(
    () =>
      storage.saveLead({
        company: 'Otra Empresa SRL',
        phone: '1155443322', // Mismo teléfono
        email: 'otro-distinto@otraempresa.com', // Pero email contradictorio
      }),
    /Conflicto de identidad/,
    'Debe evitar merge silencioso si los identificadores difieren'
  );

  // 4. Avance de etapas del pipeline con historial append-only
  const leadCalificado = storage.updateLeadStatus(lead1.lead.lead_id, 'QUALIFIED', 'Cliente confirmó presupuesto');
  assert.equal(leadCalificado.status, 'QUALIFIED');
  assert.ok(leadCalificado.history.some((h) => h.event === 'status_changed' && h.to === 'QUALIFIED'));

  const leadGanado = storage.updateLeadStatus(lead1.lead.lead_id, 'WON', 'Seña del 50% transferida');
  assert.equal(leadGanado.status, 'WON');

  // 5. Permisos RBAC de acceso al CRM
  assert.equal(storage.isModuloPermitido('admin', 'crm'), true, 'Admin debe acceder a CRM');
  assert.equal(storage.isModuloPermitido('comercial_ventas', 'crm'), true, 'Comercial B2B debe acceder a CRM');
  assert.equal(storage.isModuloPermitido('taller_produccion', 'crm'), false, 'Taller no debe acceder a cartera comercial');
  assert.equal(storage.isModuloPermitido('finanzas_caja', 'crm'), false, 'Finanzas no debe acceder a CRM');

  // 6. Eliminación de lead
  const eliminado = storage.deleteLead(lead1.lead.lead_id);
  assert.equal(eliminado, true);
  assert.equal(storage.getLeadById(lead1.lead.lead_id), null);
});

