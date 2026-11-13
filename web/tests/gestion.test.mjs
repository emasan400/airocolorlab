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

test('Seguridad — Doble Factor de Autenticación (MFA TOTP RFC 6238)', async () => {
  // 1. Generación de clave secreta Base32
  const secret = storage.generateTotpSecret(16);
  assert.equal(secret.length, 16);
  assert.ok(/^[A-Z2-7]+$/.test(secret), 'El secreto debe ser Base32 canónico');

  // 2. Generación y verificación de código de 6 dígitos
  const code = await storage.computeTotpCode(secret);
  assert.equal(code.length, 6);
  assert.ok(/^\d{6}$/.test(code), 'El código TOTP debe ser numérico de 6 dígitos');

  const isValid = await storage.verifyTotpCode(secret, code);
  assert.equal(isValid, true, 'El código actual debe ser validado con éxito');

  const isInvalid = await storage.verifyTotpCode(secret, '000000');
  assert.equal(isInvalid, false, 'Un código incorrecto debe ser rechazado');

  // 3. Activación y desactivación de MFA en cuenta de usuario
  const users = storage.getUsuarios();
  const targetUser = users[0];

  const userWithMfa = storage.enableMfaForUser(targetUser.id, secret);
  assert.equal(userWithMfa.mfa_enabled, true);
  assert.equal(userWithMfa.mfa_secret, secret);

  const userWithoutMfa = storage.disableMfaForUser(targetUser.id);
  assert.equal(userWithoutMfa.mfa_enabled, false);
  assert.equal(userWithoutMfa.mfa_secret, null);
});

test('Marketing B2B — Sistema Multiagente, HITL Approvals, Calendario y Asistente CM', () => {
  // 1. Directorio de Agentes
  const agents = storage.getAgentRegistry();
  assert.ok(agents.length >= 26, 'Debe haber al menos 26 agentes registrados');
  const orc = agents.find((a) => a.id === 'ORC');
  assert.ok(orc, 'Debe existir el agente ORC');
  const cm = agents.find((a) => a.id === 'I-06');
  assert.ok(cm, 'Debe existir el agente Community Manager I-06');

  // 2. Cola de Aprobaciones HITL
  storage.resetApprovals();
  const approvals = storage.getApprovals();
  assert.ok(approvals.length >= 3, 'Debe contener aprobaciones pendientes iniciales');
  const pending = approvals.find((a) => a.id === 'APR-20261005-001');
  assert.equal(pending.estado, 'PENDING');
  assert.equal(pending.hitl_level, 2);

  // Decisión HITL
  const approved = storage.decideApproval('APR-20261005-001', 'APPROVED', 'Aprobado para publicar');
  assert.equal(approved.estado, 'APPROVED');
  assert.equal(approved.decision_comments, 'Aprobado para publicar');

  // Verificar impacto en Calendario Editorial
  const calendar = storage.getEditorialCalendar();
  const entry = calendar.find((c) => c.content_id === 'CNT-20261005-001');
  assert.equal(entry.status, 'APPROVED', 'La pieza en calendario debe pasar a APPROVED tras decisión');

  // 3. Calendario Editorial: creación y cambio de estado
  const newEntry = storage.saveCalendarEntry({
    channel: 'LINKEDIN',
    idea: 'Caso de éxito: 150 buzos para Fintech',
    format: 'Post con imágenes reales',
    product: 'Buzos friza premium',
  });
  assert.ok(newEntry.content_id.startsWith('CNT-'));
  const updatedEntry = storage.updateCalendarEntryStatus(newEntry.content_id, 'PUBLISHED');
  assert.equal(updatedEntry.status, 'PUBLISHED');

  // 4. Asistente Community Manager: clasificación de mensajes y voseo rioplatense
  // Caso A: Consulta con >= 10 unidades
  const analysis1 = storage.classifyAndGenerateCmResponse('Hola, cuánto salen 25 buzos estampados en DTF para nuestra marca?', 'INSTAGRAM');
  assert.equal(analysis1.category, 'LEAD');
  assert.equal(analysis1.extractedData.quantity, 25);
  assert.equal(analysis1.extractedData.isUnderMinimum, false);
  assert.ok(analysis1.proposedResponse.includes('WhatsApp'), 'Debe incluir CTA a WhatsApp');
  assert.ok(analysis1.proposedResponse.includes('escribinos') || analysis1.proposedResponse.includes('contanos') || analysis1.proposedResponse.includes('contactes'), 'Debe usar voseo rioplatense');

  // Caso B: Consulta bajo mínimo (<10 unidades)
  const analysis2 = storage.classifyAndGenerateCmResponse('Hola! Hacen 1 remera estampada?', 'WHATSAPP');
  assert.equal(analysis2.category, 'LEAD_UNDER_MIN');
  assert.equal(analysis2.extractedData.isUnderMinimum, true);
  assert.ok(analysis2.proposedResponse.includes('10 unidades'), 'Debe explicar regla de mínimo 10 unidades');

  // Caso C: Reclamo
  const analysis3 = storage.classifyAndGenerateCmResponse('Hola, nos llegaron 2 buzos mal estampados y fallados', 'WHATSAPP');
  assert.equal(analysis3.category, 'COMPLAINT');

  // 5. Derivación directa de interacción asistida por CM a Lead en CRM (con deduplicación)
  const leadRes = storage.convertCmInteractionToLead({
    ...analysis1,
    extractedData: {
      ...analysis1.extractedData,
      phone: '1165432198',
      email: 'consultas@marcapyme.com',
      company: 'Marca PyME',
      contact: 'Martina',
    },
  });
  assert.equal(leadRes.ok, true);
  assert.ok(leadRes.lead.lead_id.startsWith('LEAD-'));
  assert.equal(leadRes.lead.quantity, 25);
  assert.equal(leadRes.lead.origin, 'CM_INSTAGRAM');

  // Fusión por deduplicación si el mismo contacto vuelve a escribir
  const leadResMerge = storage.convertCmInteractionToLead({
    ...analysis1,
    extractedData: {
      ...analysis1.extractedData,
      phone: '1165432198',
      email: 'consultas@marcapyme.com',
      company: 'Marca PyME',
      contact: 'Martina',
      interest: 'Ahora queremos agregar 30 remeras',
    },
  });
  assert.equal(leadResMerge.type, 'merged', 'Debe fusionar automáticamente con lead existente');
  assert.equal(leadResMerge.lead.lead_id, leadRes.lead.lead_id);
});

test('Marketing B2B — 5 Canales Oficiales, Campañas Multicanal y Generador de Prompts con HITL Exclusivo', () => {
  // 1. Canales Oficiales
  const channels = storage.MARKETING_CHANNELS;
  assert.equal(channels.length, 5, 'Deben ser exactamente 5 canales oficiales');
  const channelIds = channels.map((c) => c.id);
  assert.ok(channelIds.includes('INSTAGRAM'));
  assert.ok(channelIds.includes('WHATSAPP'));
  assert.ok(channelIds.includes('LINKEDIN'));
  assert.ok(channelIds.includes('GMAIL'));
  assert.ok(channelIds.includes('FACEBOOK'));

  // 2. Agentes de Facebook en el Registry
  const agents = storage.getAgentRegistry();
  const f01 = agents.find((a) => a.id === 'F-01');
  const f02 = agents.find((a) => a.id === 'F-02');
  const f03 = agents.find((a) => a.id === 'F-03');
  assert.ok(f01, 'Debe existir el agente F-01');
  assert.ok(f02, 'Debe existir el agente F-02');
  assert.ok(f03, 'Debe existir el agente F-03');
  assert.equal(f01.module, 'FACEBOOK');

  // 3. Organizador de Campañas: Creación, lectura y edición
  const initialCamps = storage.getCampaigns();
  assert.ok(initialCamps.length >= 2, 'Debe haber campañas iniciales');

  const newCamp = storage.saveCampaign({
    titulo: 'Campaña Corporativa Fin de Año 2026',
    objetivo: 'Captar pedidos de welcome kits para empresas',
    canales: ['INSTAGRAM', 'LINKEDIN', 'WHATSAPP', 'GMAIL', 'FACEBOOK'],
    fecha_inicio: '2026-11-01',
    fecha_fin: '2026-12-15',
    estado: 'PLANIFICADA',
    kpi: '40 cotizaciones B2B',
  });
  assert.ok(newCamp.id.startsWith('CMP-'));
  assert.equal(newCamp.titulo, 'Campaña Corporativa Fin de Año 2026');

  // 4. Generador de Prompts para IAs Paralelas
  const promptCopy = storage.generateAiPrompt({
    tipo: 'COPY',
    canal: 'INSTAGRAM',
    producto: 'Buzos friza con estampa DTF',
    objetivo: 'Lanzamiento de temporada',
    audience: 'Marcas y productoras',
  });
  assert.ok(promptCopy.prompt_text.includes('voseo'));
  assert.ok(promptCopy.prompt_text.includes('10 unidades'));
  assert.ok(promptCopy.prompt_text.includes('WhatsApp'));
  assert.ok(promptCopy.prompt_text.includes('11-6355-3443'));

  const promptImg = storage.generateAiPrompt({
    tipo: 'IMAGE',
    canal: 'INSTAGRAM',
    producto: 'Hoodie negro peinado con bordado',
  });
  assert.ok(promptImg.prompt_text.includes('Hasselblad'));
  assert.ok(promptImg.prompt_text.includes('#1A4295'));
  assert.ok(promptImg.prompt_negativo.includes('blurry'));

  const promptVid = storage.generateAiPrompt({
    tipo: 'VIDEO',
    canal: 'INSTAGRAM',
    producto: 'Remeras técnicas',
  });
  assert.ok(promptVid.prompt_text.includes('Cinematic 4k'));

  // 5. Flujo de Aprobación HITL Exclusivo para Prompts
  // A: Crear nuevo prompt -> debe entrar SIEMPRE en PENDING
  const createdPrompt = storage.savePrompt({
    campaign_id: newCamp.id,
    tipo: 'COPY',
    canal: 'LINKEDIN',
    titulo: 'Post Liderazgo Calidad Textil',
    prompt_text: promptCopy.prompt_text,
  });
  assert.ok(createdPrompt.id.startsWith('PRM-'));
  assert.equal(createdPrompt.estado_aprobacion, 'PENDING', 'Todo prompt nuevo debe nacer en PENDING para HITL');
  assert.equal(createdPrompt.hitl_level, 2);

  // B: Decisión HITL -> Aprobar prompt
  const approvedPrompt = storage.decidePromptApproval(createdPrompt.id, 'APPROVED', 'Revisado y validado');
  assert.equal(approvedPrompt.estado_aprobacion, 'APPROVED');
  assert.equal(approvedPrompt.aprobado_por, storage.getOperadorActual());

  // C: Modificación de prompt aprobado -> vuelve automáticamente a PENDING
  const modifiedPrompt = storage.savePrompt({
    ...approvedPrompt,
    titulo: 'Post Liderazgo Calidad Textil (Revisión v2)',
    prompt_text: promptCopy.prompt_text + '\nExtra: agregar mención a hilado 24/1.',
  });
  assert.equal(modifiedPrompt.estado_aprobacion, 'PENDING', 'La modificación de un prompt revoca su aprobación y exige re-validación HITL');

  // D: Rechazo HITL
  const rejectedPrompt = storage.decidePromptApproval(modifiedPrompt.id, 'REJECTED', 'Ajustar llamada a la acción');
  assert.equal(rejectedPrompt.estado_aprobacion, 'REJECTED');
  assert.equal(rejectedPrompt.observaciones_rechazo, 'Ajustar llamada a la acción');

  // 6. Eliminar campaña y verificar integridad
  const delRes = storage.deleteCampaign(newCamp.id);
  assert.equal(delRes, true);
});

test('Punto 1 & 2 — Estudio de Diseño, Lienzo Infinito (.canvas JSON 1.0), Linter X-03/X-04 y Empaquetado HITL-2', () => {
  // 1. Verificar lienzos iniciales y RBAC
  const initialCanvases = storage.getDesignCanvases();
  assert.ok(initialCanvases.length >= 1, 'Debe iniciar con al menos el lienzo maestro B2B');
  assert.equal(storage.isModuloPermitido('comercial_ventas', 'design_studio'), true);

  // 2. Crear un nuevo lienzo de diseño
  const nuevoCanvas = storage.saveDesignCanvas({
    titulo: 'Tablero Lanzamiento Camperas Rompeviento B2B',
    canal: 'INSTAGRAM',
    formato: 'IG_CAROUSEL',
    producto_id: 'p1',
    nodes: [
      {
        id: 'node-prod-1',
        type: 'product',
        title: 'Producto — Campera Rompeviento',
        x: 60,
        y: 80,
        width: 280,
        height: 220,
        color: '#1a4295',
        bgHex: '#ffffff',
        textHex: '#111111',
        text: 'Campera Rompeviento Impermeable · Mínimo 10 unidades.',
      },
      {
        id: 'node-slide-1',
        type: 'slide',
        slideOrder: 1,
        format: 'IG_CAROUSEL',
        title: 'Slide 1 — Copy Principal',
        x: 400,
        y: 80,
        width: 320,
        height: 220,
        color: '#00b4d8',
        bgHex: '#1a4295',
        textHex: '#fefffe',
        text: 'Equipá a tu equipo con camperas técnicas personalizadas. Pedido mínimo 10 unidades (múltiplos de 10). Escribinos por WhatsApp al 11-6355-3443 para cotización a medida.',
        promptText: 'Editorial studio photography of a navy blue windbreaker jacket on minimalist concrete background, #1A4295 and #00B4D8 lighting accents. Photorealistic, no text, no letters, no logos.',
      },
    ],
    edges: [
      { id: 'edge-1', fromNode: 'node-prod-1', toNode: 'node-slide-1', label: 'Flujo B2B' },
    ],
  });

  assert.ok(nuevoCanvas.id.startsWith('CNV-'));
  assert.equal(nuevoCanvas.nodes.length, 2);

  // 3. Evaluar Linter de Marca en vivo (X-03 Content QA + X-04 Brand Guardian)
  const qaPass = storage.evaluateBrandQaLint({
    text: nuevoCanvas.nodes[1].text,
    bgHex: '#1a4295',
    textHex: '#fefffe',
    format: 'IG_CAROUSEL',
    slideCount: 1,
  });
  assert.equal(qaPass.status, 'PASS', 'El slide que cumple voseo, mín. 10 u. y CTA WhatsApp debe aprobar QA');
  assert.equal(qaPass.score, 100);

  // Evaluar caso con infracción (vocabulario retail prohibido + precio explícito)
  const qaFail = storage.evaluateBrandQaLint({
    text: 'Agregá al carrito muy barato en oferta flash por $5000.',
    bgHex: '#ffffff',
    textHex: '#00b4d8',
    format: 'WA_STATUS',
    slideCount: 4,
  });
  assert.equal(qaFail.status, 'FAIL', 'Debe detectar infracción por vocabulario retail, precio explícito y exceso de pantallas WA');

  // 4. Interoperabilidad nativa con Obsidian JSON Canvas 1.0 (.canvas)
  const jsonCanvasStr = storage.exportToObsidianCanvasJson(nuevoCanvas);
  const parsedSpec = JSON.parse(jsonCanvasStr);
  assert.ok(Array.isArray(parsedSpec.nodes));
  assert.ok(Array.isArray(parsedSpec.edges));
  assert.equal(parsedSpec.nodes.length, 2);
  assert.equal(parsedSpec.nodes[0].type, 'text');

  const reimported = storage.importFromObsidianCanvasJson(jsonCanvasStr, 'Lienzo Importado desde Obsidian');
  assert.ok(reimported.id.startsWith('CNV-'));
  assert.equal(reimported.nodes.length, 2);

  // 5. Empaquetado 1-Click hacia la Cola HITL-2
  const approval = storage.packageCanvasToHitlApproval(nuevoCanvas.id);
  assert.ok(approval.id.startsWith('APR-'));
  assert.equal(approval.hitl_level, 2);
  assert.equal(approval.estado, 'PENDING');
  const updatedCanvas = storage.getDesignCanvasById(nuevoCanvas.id);
  assert.equal(updatedCanvas.estado, 'EN_COLA_HITL2');

  // Limpieza
  storage.deleteDesignCanvas(reimported.id);
});

test('Punto 3 & M-01/M-02 — Motor 2D Nesting MaxRects-BSSF, Cotizador DTF y Puente Unificado Obsidian', () => {
  // 1. Verificar motor determinístico MaxRects-BSSF
  const nesting = storage.runMaxRectsNesting({
    binWidth: 58,
    binHeight: 100,
    gap: 0.4,
    margin: 0.5,
    pieces: [
      { id: 'DORSO', name: 'Dorso', width: 22, height: 22, qty: 4 },
      { id: 'FRENTE', name: 'Frente', width: 8, height: 8, qty: 4 },
      { id: 'TALLE', name: 'Talle', width: 5, height: 5, qty: 4 },
    ],
  });

  assert.equal(nesting.binWidth, 58);
  assert.equal(nesting.placedCount, 12, '4 kits * 3 piezas = 12 piezas anidadas en 1 metro');
  assert.ok(nesting.usedLengthCm > 0, 'Debe calcular largo lineal usado en cm');
  assert.ok(nesting.utilizationPct > 25, 'El algoritmo MaxRects debe reportar el porcentaje de aprovechamiento');

  // 2. Verificar cálculo de cotización con regla comercial (mínimo 10, múltiplos de 10)
  const quoteCalc = storage.calculateDtfQuote({
    modo: 'KIT_PRENDA',
    rollWidthCm: 58,
    pricePerMeterArs: 25000,
    demandGarments: 14, // Debe normalizarse automáticamente a 20 (múltiplo de 10 superior)
    pieces: [
      { id: 'P1', name: 'Dorso', width: 22, height: 22, qtyPerGarment: 1 },
      { id: 'P2', name: 'Frente', width: 8, height: 8, qtyPerGarment: 1 },
    ],
    garmentBaseCostArs: 8500,
    marginPercent: 40,
  });

  assert.equal(quoteCalc.normalizedDemand, 20, 'La demanda 14 debe ajustarse a múltiplo de 10 (20 unidades)');
  assert.ok(quoteCalc.suggestedTotalSale > quoteCalc.totalProductionCost, 'El precio total debe contemplar el margen B2B');
  assert.ok(quoteCalc.metersNeeded >= 1);

  // 3. Guardar cotización DTF y validar regla de múltiplos de 10
  const savedQuote = storage.saveDtfQuote({
    codigo: storage.getNextDtfQuoteCode('KIT_PRENDA'),
    cliente_empresa: 'Agencia Creativa Sur',
    modo: 'KIT_PRENDA',
    demanda_prendas: quoteCalc.normalizedDemand,
    metros_requeridos: quoteCalc.metersNeeded,
    precio_venta_unitario: quoteCalc.suggestedUnitSale,
    precio_venta_sugerido_total: quoteCalc.suggestedTotalSale,
    piezas_kit: [
      { id: 'P1', name: 'Dorso', width: 22, height: 22, qtyPerGarment: 1 },
    ],
  });
  assert.ok(savedQuote.codigo.startsWith('COT-KIT-'));

  assert.throws(
    () => storage.saveDtfQuote({ demanda_prendas: 7, modo: 'KIT_PRENDA' }),
    /múltiplos de 10/,
    'Debe rechazar guardar cotización que viole el mínimo de 10 o múltiplos de 10'
  );

  // 4. Puente Unificado Repositorio / Bóveda Obsidian (M-02)
  const bundleStr = storage.exportUnifiedRepoBundle();
  const bundleObj = JSON.parse(bundleStr);
  assert.equal(bundleObj.schema, 'AIRO_UNIFIED_REPO_BUNDLE_V1');
  assert.ok(Array.isArray(bundleObj.crm_leads_json.leads));
  assert.ok(Array.isArray(bundleObj.design_canvases));
  assert.ok(Array.isArray(bundleObj.dtf_quotes));

  const importRes = storage.importUnifiedRepoBundle(bundleStr);
  assert.equal(importRes, true);
});

test('TSK-012 — Gobernanza PMBOK (Kanban + Google Tasks), Mejora Continua PDCA (Kaizen), 5 Suites y Puentes Order-to-Cash', () => {
  // 1. Verificar Arquitectura de las 5 Suites de Dominio y constantes PMBOK
  assert.equal(storage.SUITES_DOMINIO.length, 5, 'El portal debe consolidarse en 5 Suites de Dominio');
  for (const s of storage.SUITES_DOMINIO) {
    assert.ok(Array.isArray(s.tabs) && s.tabs.length > 0, `Suite ${s.id} debe definir s.tabs como array no vacío`);
    assert.ok(Array.isArray(s.modulos) && s.modulos.length > 0, `Suite ${s.id} debe definir s.modulos como array no vacío`);
  }
  assert.equal(storage.PMBOK_PROCESS_GROUPS.length, 5, 'Debe contar con los 5 Grupos de Procesos PMBOK');
  assert.equal(storage.PMBOK_KNOWLEDGE_AREAS.length, 10, 'Debe contar con las 10 Áreas de Conocimiento PMBOK');
  assert.equal(storage.isModuloPermitido('admin', 'pmbok_command'), true);
  assert.equal(storage.isModuloPermitido('taller_produccion', 'pmbok_command'), true);

  // 2. Verificar Tablero Kanban PMBOK + Checklist Google Tasks
  const initialTasks = storage.getPmbokTasks();
  assert.ok(initialTasks.length >= 6, 'Debe iniciar con los paquetes de trabajo WBS de la bóveda');

  const nuevaTarea = storage.savePmbokTask({
    id: 'TSK-TEST-PMBOK',
    wbs_code: '4.1.9',
    titulo: 'Calibrar perfil ICC de impresora DTF lote especial',
    grupo_procesos: 'EJECUCION',
    area_conocimiento: 'CALIDAD',
    prioridad: 'ALTA',
    agente: 'W-06',
    hitl: 'HITL-1',
    fecha_vencimiento: '2026-11-20',
    esfuerzo_estimado_hs: 2,
    riesgo_asociado: 'RSK-03: Variación de densidad de tinta blanca',
    subtasks: [
      { id: 'gt-test-1', text: 'Imprimir tira de control CMYK+W', done: true },
      { id: 'gt-test-2', text: 'Hornear a 160°C durante 120 seg', done: false },
    ],
  });

  assert.equal(nuevaTarea.id, 'TSK-TEST-PMBOK');
  assert.equal(nuevaTarea.progreso_pct, 50, '1 de 2 Google Tasks completadas = 50% de progreso');

  // Toggle de Google Task -> debe pasar a 100% y moverse automáticamente a CIERRE
  const toggled = storage.togglePmbokSubtask('TSK-TEST-PMBOK', 'gt-test-2');
  assert.equal(toggled.progreso_pct, 100);
  assert.equal(toggled.estado, 'COMPLETADO');
  assert.equal(toggled.grupo_procesos, 'CIERRE');

  // Mover de fase PMBOK y agregar nueva sub-tarea Google Tasks
  const moved = storage.movePmbokTaskPhase('TSK-TEST-PMBOK', 'MONITOREO_Y_CONTROL');
  assert.equal(moved.grupo_procesos, 'MONITOREO_Y_CONTROL');

  const withAddedSub = storage.addPmbokSubtask('TSK-TEST-PMBOK', 'Archivar muestra testigo en taller');
  assert.equal(withAddedSub.subtasks.length, 3);
  assert.equal(withAddedSub.progreso_pct, 67);

  // Exportar a formato nativo Obsidian Kanban Markdown
  const mdKanban = storage.exportPmbokBoardToObsidianMarkdown();
  assert.ok(mdKanban.includes('kanban-plugin: basic'), 'El export debe ser compatible con el plugin Kanban de Obsidian');
  assert.ok(mdKanban.includes('## 01 · INICIACIÓN'));
  assert.ok(mdKanban.includes('TSK-TEST-PMBOK'));

  // 3. Verificar Motor de Mejora Continua (Kaizen + PDCA)
  const initialKaizen = storage.getKaizenCycles();
  assert.ok(initialKaizen.length >= 3, 'Debe iniciar con los ciclos Kaizen fundacionales');

  const nuevoKaizen = storage.saveKaizenCycle({
    codigo: 'KZN-2026-099',
    titulo: 'Reducción de merma en corte de film DTF 58cm',
    etapa_pdca: 'PLAN',
    wbs_ref: '3.2.1',
    problema_detectado: 'Desperdicio en bordes laterales de pliegos cortos',
    hipotesis_mejora: 'Agrupar pedidos de gorras con pedidos de remeras en el mismo pliego',
    kpi_impacto: 'Aprovechamiento > 82%',
  });
  assert.equal(nuevoKaizen.etapa_pdca, 'PLAN');

  const advancedDo = storage.advanceKaizenStage(nuevoKaizen.id);
  assert.equal(advancedDo.etapa_pdca, 'DO');
  const advancedCheck = storage.advanceKaizenStage(nuevoKaizen.id);
  assert.equal(advancedCheck.etapa_pdca, 'CHECK');

  // 4. Verificar Puentes 1-Click Order-to-Cash (Cotizador DTF -> Remito + PMBOK Task y Cotizador DTF -> Seña Caja)
  const dtfQuotes = storage.getDtfQuotes();
  const sampleQuote = dtfQuotes[0];
  assert.ok(sampleQuote, 'Debe existir la cotización creada en el test anterior');

  const bridgeRemito = storage.convertDtfQuoteToRemitoDraft(sampleQuote.id);
  assert.ok(bridgeRemito.id, 'Debe crear el Remito Oficial automáticamente');
  assert.equal(bridgeRemito.cliente_nombre, sampleQuote.cliente_empresa);

  const scheduledTask = storage.getPmbokTasks().find((t) => t.wbs_code === '4.2.1' && t.titulo.includes(bridgeRemito.numero));
  assert.ok(scheduledTask, 'Debe agendar automáticamente la tarea WBS 4.2.1 en el Comando PMBOK');
  assert.equal(scheduledTask.subtasks.length, 2);

  const bridgeCaja = storage.convertDtfQuoteToCajaSena(sampleQuote.id);
  assert.ok(bridgeCaja.id, 'Debe registrar el ingreso del 50% de seña en Flujo de Caja');
  assert.equal(bridgeCaja.tipo, 'ingreso');
  assert.equal(bridgeCaja.monto, Math.round(Number(sampleQuote.precio_venta_sugerido_total) * 0.5));

  // Limpieza tarea test
  storage.deletePmbokTask('TSK-TEST-PMBOK');
});

test('TSK-013 — Work OS Dashboard, 6 Workflows Estándar AIRO, Quick Add NLP y Funcionalidades de las 14 Apps', () => {
  // 1. Verificar los 6 Workflows Estándar de AIRO Color Lab (Asana / Wrike / Monday.com)
  assert.equal(storage.AIRO_COMPANY_WORKFLOWS.length, 6, 'Deben existir los 6 Workflows normales de la empresa');
  const wf1 = storage.launchCompanyWorkflow('WF-01', {
    cliente_lote: 'Cervecería Quilmes 50 Buzos',
    fecha_vencimiento: '2026-11-18',
  });
  assert.ok(wf1.id.startsWith('TSK-'));
  assert.ok(wf1.titulo.includes('WF-01'));
  assert.ok(wf1.titulo.includes('Cervecería Quilmes 50 Buzos'));
  assert.equal(wf1.modulo_vinculado, 'cotizador_dtf');
  assert.equal(wf1.subtasks.length, 6, 'WF-01 debe incluir los 6 pasos Order-to-Cash preconfigurados');

  // 2. Verificar Captura Rápida NLP (Todoist / TickTick)
  const qaTask = storage.quickAddPmbokTask(
    'Cotizar 30 remeras algodón peinado #dtf #corporativo @Comercial !urgente ^mañana ~3.5h'
  );
  assert.equal(qaTask.titulo, 'Cotizar 30 remeras algodón peinado');
  assert.equal(qaTask.prioridad, 'URGENTE');
  assert.equal(qaTask.responsable, 'Comercial');
  assert.equal(qaTask.esfuerzo_estimado_hs, 3.5);
  assert.equal(qaTask.modulo_vinculado, 'cotizador_dtf');
  assert.ok(qaTask.etiquetas.includes('dtf'));
  assert.ok(qaTask.etiquetas.includes('corporativo'));

  // 3. Verificar Bloqueos (Jira / Linear), Tiempo Real Pomodoro (TickTick), Comentarios (Basecamp) y Clonación (Trello)
  const blocked = storage.togglePmbokTaskBlocker(wf1.id, true, 'Falta confirmar curva de talles XL/XXL');
  assert.equal(blocked.bloqueada, true);
  assert.equal(blocked.prioridad, 'URGENTE', 'El bloqueo debe escalar prioridad a URGENTE según AUTO-03');
  assert.equal(blocked.motivo_bloqueo, 'Falta confirmar curva de talles XL/XXL');

  const unblocked = storage.togglePmbokTaskBlocker(wf1.id, false);
  assert.equal(unblocked.bloqueada, false);

  const withTime = storage.logPmbokTaskTime(wf1.id, 1.5);
  assert.equal(withTime.horas_reales, 1.5);

  const withComment = storage.addPmbokTaskComment(wf1.id, 'Cliente aprobó muestra digital por WhatsApp');
  assert.equal(withComment.comentarios.length, 1);
  assert.equal(withComment.comentarios[0].texto, 'Cliente aprobó muestra digital por WhatsApp');

  const cloned = storage.duplicatePmbokTask(wf1.id);
  assert.notEqual(cloned.id, wf1.id);
  assert.ok(cloned.titulo.includes('(Copia)'));

  // 4. Verificar Recetas de Automatización (Monday.com / ClickUp / Trello Butler)
  const recipes = storage.getAutomationRecipes();
  assert.equal(recipes.length, 5);
  const toggledRecipes = storage.toggleAutomationRecipe('AUTO-01');
  assert.equal(toggledRecipes.find((r) => r.id === 'AUTO-01').enabled, false);
  storage.toggleAutomationRecipe('AUTO-01'); // Restaurar

  // Limpieza
  storage.deletePmbokTask(wf1.id);
  storage.deletePmbokTask(qaTask.id);
  storage.deletePmbokTask(cloned.id);
});







test('TSK-014 — IDs de tareas PMBOK únicos aunque la numeración tenga huecos', () => {
  const before = storage.getPmbokTasks();
  const a = storage.savePmbokTask({ titulo: 'Tarea A sin id', grupo_procesos: 'PLANIFICACION' });
  const b = storage.savePmbokTask({ titulo: 'Tarea B sin id', grupo_procesos: 'EJECUCION' });
  assert.notEqual(a.id, b.id);
  const ids = storage.getPmbokTasks().map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'No deben existir IDs duplicados');
  assert.equal(ids.length, before.length + 2);

  // Editar un campo de una tarea completa no debe moverla de columna
  const done = storage.savePmbokTask({ titulo: 'Tarea completa', grupo_procesos: 'MONITOREO_Y_CONTROL', subtasks: [{ id: 'x1', text: 'Paso', done: true }] });
  const edited = storage.savePmbokTask({ ...done, prioridad: 'BAJA' });
  assert.equal(edited.grupo_procesos, 'MONITOREO_Y_CONTROL', 'Editar prioridad no debe auto-cerrar la tarea');

  storage.deletePmbokTask(a.id);
  storage.deletePmbokTask(b.id);
  storage.deletePmbokTask(done.id);
});
