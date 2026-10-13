import { useState } from 'react';
import {
  getRemitos,
  saveRemito,
  cambiarEstadoRemito,
  deleteRemito,
  getNextRemitoNumero,
  getClientes,
  getProductos,
} from '../services/storageService';
import RemitoPrintView from './RemitoPrintView';

const MODALIDADES_ENVIO = [
  'Retiro en Taller (AIRO)',
  'Mensajería Propia AIRO',
  'Andreani Envío Express B2B',
  'Correo Argentino',
  'Transporte / Expreso al Interior',
  'Flete Directo',
];

const ESTADOS_REMITO = ['Todos', 'Borrador', 'Emitido', 'En Tránsito', 'Entregado', 'Anulado'];

export default function RemitosModule({ onRemitoEmitted }) {
  const [remitos, setRemitos] = useState(getRemitos());
  const [clientes] = useState(getClientes());
  const [productos] = useState(getProductos());
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [estadoModal, setEstadoModal] = useState({ open: false, remito: null, nuevoEstado: '', firmado_por: '', dni_receptor: '' });
  const [selectedRemitoPrint, setSelectedRemitoPrint] = useState(null);

  // Form State para Confección de Remito
  const [formData, setFormData] = useState({
    id: '',
    numero: '',
    fecha_emision: new Date().toISOString().slice(0, 10),
    fecha_entrega: new Date().toISOString().slice(0, 10),
    cliente_id: '',
    cliente_nombre: '',
    cliente_cuit: '',
    cliente_direccion: '',
    cliente_whatsapp: '',
    contacto_receptor: '',
    modalidad_envio: 'Mensajería Propia AIRO',
    transportista: '',
    dni_chofer: '',
    patente: '',
    cantidad_bultos: 1,
    descontar_stock: true,
    estado: 'Emitido',
    observaciones: '',
    items: [],
  });

  // Ítem temporal para agregar a la tabla del remito
  const [tempItem, setTempItem] = useState({
    producto_id: '',
    sku: '',
    descripcion: '',
    cantidad: 10,
    unidad: 'unidades',
    bulto: 'Caja 1',
  });

  const reloadData = () => {
    const list = getRemitos();
    setRemitos(list);
    if (onRemitoEmitted) onRemitoEmitted();
  };

  const handleOpenNuevo = () => {
    setFormData({
      id: '',
      numero: getNextRemitoNumero(),
      fecha_emision: new Date().toISOString().slice(0, 10),
      fecha_entrega: new Date().toISOString().slice(0, 10),
      cliente_id: '',
      cliente_nombre: '',
      cliente_cuit: '',
      cliente_direccion: '',
      cliente_whatsapp: '',
      contacto_receptor: '',
      modalidad_envio: 'Mensajería Propia AIRO',
      transportista: '',
      dni_chofer: '',
      patente: '',
      cantidad_bultos: 1,
      descontar_stock: true,
      estado: 'Emitido',
      observaciones: 'Mercadería confeccionada según especificaciones. Control de calidad aprobado.',
      items: [],
    });
    setTempItem({
      producto_id: '',
      sku: '',
      descripcion: '',
      cantidad: 10,
      unidad: 'unidades',
      bulto: 'Caja 1',
    });
    setModalOpen(true);
  };

  const handleOpenEditar = (r) => {
    setFormData({
      id: r.id,
      numero: r.numero,
      fecha_emision: r.fecha_emision || new Date().toISOString().slice(0, 10),
      fecha_entrega: r.fecha_entrega || r.fecha_emision || new Date().toISOString().slice(0, 10),
      cliente_id: r.cliente_id || '',
      cliente_nombre: r.cliente_nombre || '',
      cliente_cuit: r.cliente_cuit || '',
      cliente_direccion: r.cliente_direccion || '',
      cliente_whatsapp: r.cliente_whatsapp || '',
      contacto_receptor: r.contacto_receptor || '',
      modalidad_envio: r.modalidad_envio || 'Mensajería Propia AIRO',
      transportista: r.transportista || '',
      dni_chofer: r.dni_chofer || '',
      patente: r.patente || '',
      cantidad_bultos: r.cantidad_bultos || 1,
      descontar_stock: r.descontar_stock ?? true,
      estado: r.estado || 'Emitido',
      observaciones: r.observaciones || '',
      items: r.items ? JSON.parse(JSON.stringify(r.items)) : [],
    });
    setTempItem({
      producto_id: '',
      sku: '',
      descripcion: '',
      cantidad: 10,
      unidad: 'unidades',
      bulto: `Caja ${(r.items?.length || 0) + 1}`,
    });
    setModalOpen(true);
  };

  const handleSelectCliente = (clienteId) => {
    const c = clientes.find((item) => item.id === clienteId);
    if (c) {
      setFormData((prev) => ({
        ...prev,
        cliente_id: c.id,
        cliente_nombre: c.razon_social,
        cliente_cuit: c.cuit || '',
        cliente_direccion: c.direccion || '',
        cliente_whatsapp: c.whatsapp || '',
        contacto_receptor: c.contacto || '',
      }));
    }
  };

  const handleSelectProductoItem = (prodId) => {
    if (!prodId) {
      setTempItem((prev) => ({ ...prev, producto_id: '', sku: '', descripcion: '' }));
      return;
    }
    const p = productos.find((item) => item.id === prodId);
    if (p) {
      const desc = `${p.nombre} ${p.talle ? `(Talle ${p.talle})` : ''} ${p.color ? `· Color: ${p.color}` : ''}`.trim();
      setTempItem((prev) => ({
        ...prev,
        producto_id: p.id,
        sku: p.sku,
        descripcion: desc,
      }));
    }
  };

  const handleAddItem = () => {
    if (!tempItem.descripcion.trim()) {
      alert('Ingresá una descripción para el ítem a remitir.');
      return;
    }
    if (Number(tempItem.cantidad) <= 0) {
      alert('La cantidad debe ser mayor a 0.');
      return;
    }
    const newItem = {
      ...tempItem,
      id: `ri-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      cantidad: Number(tempItem.cantidad),
    };
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
    setTempItem({
      producto_id: '',
      sku: '',
      descripcion: '',
      cantidad: 10,
      unidad: 'unidades',
      bulto: `Caja ${formData.items.length + 1}`,
    });
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleGuardarRemito = (e) => {
    e.preventDefault();
    if (!formData.cliente_nombre.trim()) {
      alert('Ingresá el nombre o razón social del cliente.');
      return;
    }
    if (formData.items.length === 0) {
      alert('Debés agregar al menos un ítem al remito.');
      return;
    }
    saveRemito(formData);
    setModalOpen(false);
    reloadData();
  };

  const handleOpenCambiarEstado = (r) => {
    setEstadoModal({
      open: true,
      remito: r,
      nuevoEstado: r.estado,
      firmado_por: r.firmado_por || '',
      dni_receptor: r.dni_receptor || '',
    });
  };

  const handleGuardarCambioEstado = (e) => {
    e.preventDefault();
    if (!estadoModal.remito) return;
    cambiarEstadoRemito(estadoModal.remito.id, estadoModal.nuevoEstado, {
      firmado_por: estadoModal.firmado_por,
      dni_receptor: estadoModal.dni_receptor,
    });
    setEstadoModal({ open: false, remito: null, nuevoEstado: '', firmado_por: '', dni_receptor: '' });
    reloadData();
  };

  const handleEliminarRemito = (r) => {
    if (confirm(`¿Eliminar el remito ${r.numero} emitido a ${r.cliente_nombre}?`)) {
      deleteRemito(r.id);
      reloadData();
    }
  };

  // Filtrado
  const remitosFiltrados = remitos.filter((r) => {
    const matchBusqueda =
      (r.numero || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (r.cliente_nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (r.cliente_cuit || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (r.observaciones || '').toLowerCase().includes(busqueda.toLowerCase());

    const matchEst = filtroEstado === 'Todos' || r.estado === filtroEstado;
    return matchBusqueda && matchEst;
  });

  // Métricas
  const totalRemitos = remitos.length;
  const remitosEmitidos = remitos.filter((r) => r.estado === 'Emitido' || r.estado === 'En Tránsito').length;
  const remitosEntregados = remitos.filter((r) => r.estado === 'Entregado').length;
  const totalItemsRemitidos = remitos.reduce((acc, r) => acc + (r.items || []).reduce((sum, it) => sum + (Number(it.cantidad) || 0), 0), 0);

  // Si estamos en vista de impresión
  if (selectedRemitoPrint) {
    return <RemitoPrintView remito={selectedRemitoPrint} onVolver={() => setSelectedRemitoPrint(null)} />;
  }

  return (
    <div>
      <div className="gestion-module-header">
        <div className="section-eyebrow">
          <span className="num">03</span> Logística & Despachos
        </div>
        <h2 className="display section-title">Confección de remitos.</h2>
        <p className="section-sub">
          Emisión de remitos oficiales correlativos tipo R con trazabilidad y descuento de inventario.
        </p>
      </div>

      {/* KPIs Remitos */}
      <div className="gestion-kpis">
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Remitos Generados</div>
          <div className="gestion-kpi-val">{totalRemitos}</div>
          <div className="gestion-kpi-sub">Total histórico en sistema</div>
        </div>
        <div className="gestion-kpi-card kpi-accent">
          <div className="gestion-kpi-label">En Despacho / Tránsito</div>
          <div className="gestion-kpi-val">{remitosEmitidos}</div>
          <div className="gestion-kpi-sub">Mercadería en camino a clientes</div>
        </div>
        <div className="gestion-kpi-card kpi-success">
          <div className="gestion-kpi-label">Entregas Conformes</div>
          <div className="gestion-kpi-val">{remitosEntregados}</div>
          <div className="gestion-kpi-sub">Remitos con firma de recepción</div>
        </div>
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Unidades Despachadas</div>
          <div className="gestion-kpi-val">{totalItemsRemitidos.toLocaleString('es-AR')}</div>
          <div className="gestion-kpi-sub">Prendas y productos remitidos</div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="gestion-control-bar">
        <div className="gestion-search-box">
          <input
            type="text"
            className="gestion-input-search"
            placeholder="Buscar por número de remito, cliente o CUIT…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="gestion-filters">
          <select
            className="gestion-select"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            {ESTADOS_REMITO.map((est) => (
              <option key={est} value={est}>
                {est === 'Todos' ? 'Todos los Estados' : `Estado: ${est}`}
              </option>
            ))}
          </select>
          <button className="g-btn g-btn-primary" onClick={handleOpenNuevo}>
            📄 Confeccionar Nuevo Remito
          </button>
        </div>
      </div>

      {/* Tabla de Remitos */}
      <div className="gestion-table-container">
        <div className="gestion-table-scroll">
          <table className="gestion-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha Emisión</th>
                <th>Cliente / Razón Social</th>
                <th>Modalidad Envío</th>
                <th>Bultos</th>
                <th>Ítems</th>
                <th>Desc. Stock</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {remitos.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="gestion-empty-state">
                      <div className="gestion-empty-icon">📄</div>
                      <h4>Emití remitos oficiales de entrega B2B</h4>
                      <p>
                        Aún no emitiste ningún remito. Confeccioná tu primer documento oficial con membrete AIRO Color Lab, asignación de bultos y descuento automático de inventario.
                      </p>
                      <button className="g-btn g-btn-primary" onClick={handleOpenNuevo}>
                        📄 Confeccionar Mi Primer Remito
                      </button>
                    </div>
                  </td>
                </tr>
              ) : remitosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="gestion-empty-state">
                      <p>No se encontraron remitos con los criterios de búsqueda aplicados.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                remitosFiltrados.map((r) => {
                  let badgeClass = 'g-badge-neutral';
                  if (r.estado === 'Entregado') badgeClass = 'g-badge-success';
                  else if (r.estado === 'Emitido') badgeClass = 'g-badge-info';
                  else if (r.estado === 'En Tránsito') badgeClass = 'g-badge-warning';
                  else if (r.estado === 'Anulado') badgeClass = 'g-badge-danger';

                  const cantTotal = (r.items || []).reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0);

                  return (
                    <tr key={r.id}>
                      <td>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--g-blue)' }}>{r.numero}</strong>
                      </td>
                      <td>{r.fecha_emision}</td>
                      <td>
                        <strong>{r.cliente_nombre}</strong>
                        {r.cliente_cuit && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>CUIT: {r.cliente_cuit}</div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{r.modalidad_envio}</td>
                      <td>{r.cantidad_bultos || 1} bulto(s)</td>
                      <td>
                        <strong>{r.items?.length || 0}</strong> ({cantTotal} u.)
                      </td>
                      <td>
                        {r.descontar_stock ? (
                          <span style={{ color: '#0e7490', fontSize: '0.8rem', fontWeight: 600 }}>✓ Auto</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No</span>
                        )}
                      </td>
                      <td>
                        <span className={`g-badge ${badgeClass}`}>{r.estado}</span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="g-btn g-btn-primary g-btn-sm"
                          style={{ marginRight: '6px' }}
                          onClick={() => setSelectedRemitoPrint(r)}
                          title="Ver remito e imprimir en PDF"
                        >
                          🖨️ Imprimir
                        </button>
                        <button
                          className="g-btn g-btn-outline g-btn-sm"
                          style={{ marginRight: '6px' }}
                          onClick={() => handleOpenEditar(r)}
                          title="Modificar datos del remito, transportista o ítems"
                        >
                          ✏️ Modificar
                        </button>
                        <button
                          className="g-btn g-btn-outline g-btn-sm"
                          style={{ marginRight: '6px' }}
                          onClick={() => handleOpenCambiarEstado(r)}
                          title="Cambiar estado o asentar recepción"
                        >
                          🔄 Estado
                        </button>
                        <button
                          className="g-btn g-btn-danger g-btn-sm"
                          onClick={() => handleEliminarRemito(r)}
                          title="Eliminar remito"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CONFECCIÓN Y MODIFICACIÓN DE REMITO (CON SCROLL FLUIDO) */}
      {modalOpen && (
        <div className="gestion-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div
            className="gestion-modal gestion-modal-lg"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="gestion-modal-header" style={{ flexShrink: 0 }}>
              <h3 className="display">
                {formData.id
                  ? `Modificar Remito Oficial ${formData.numero}`
                  : 'Confeccionar Remito Oficial AIRO Color Lab'}
              </h3>
              <button className="gestion-modal-close" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form
              onSubmit={handleGuardarRemito}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              <div
                className="gestion-modal-body"
                style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '24px 28px' }}
              >
                {/* Bloque 1: Datos Generales */}
                <h4 style={{ margin: '0 0 0.85rem', color: 'var(--g-blue)', fontSize: '0.95rem' }}>
                  1. Datos del Documento & Destinatario
                </h4>
                <div className="g-form-grid" style={{ marginBottom: '1.25rem' }}>
                  <div className="g-form-group">
                    <label>Número de Remito *</label>
                    <input
                      type="text"
                      required
                      value={formData.numero}
                      onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Fecha de Emisión *</label>
                    <input
                      type="date"
                      required
                      value={formData.fecha_emision}
                      onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group g-form-col-full">
                    <label>Seleccionar Cliente Habitual (O escribir nuevo abajo)</label>
                    <select
                      value={formData.cliente_id}
                      onChange={(e) => handleSelectCliente(e.target.value)}
                    >
                      <option value="">-- Seleccionar de la libreta de clientes --</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.razon_social} ({c.cuit || 'Sin CUIT'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="g-form-group">
                    <label>Cliente / Razón Social *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Klover Estudio Creativo S.R.L."
                      value={formData.cliente_nombre}
                      onChange={(e) => setFormData({ ...formData, cliente_nombre: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>CUIT / DNI</label>
                    <input
                      type="text"
                      placeholder="Ej: 30-71649201-9"
                      value={formData.cliente_cuit}
                      onChange={(e) => setFormData({ ...formData, cliente_cuit: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group g-form-col-full">
                    <label>Dirección de Entrega / Localidad</label>
                    <input
                      type="text"
                      placeholder="Ej: Honduras 4820, Palermo Soho, CABA"
                      value={formData.cliente_direccion}
                      onChange={(e) => setFormData({ ...formData, cliente_direccion: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Contacto / Receptor en Destino</label>
                    <input
                      type="text"
                      placeholder="Ej: Lucía Méndez"
                      value={formData.contacto_receptor}
                      onChange={(e) => setFormData({ ...formData, contacto_receptor: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>WhatsApp / Teléfono</label>
                    <input
                      type="text"
                      placeholder="Ej: +54 9 11 5544 3322"
                      value={formData.cliente_whatsapp}
                      onChange={(e) => setFormData({ ...formData, cliente_whatsapp: e.target.value })}
                    />
                  </div>
                </div>

                {/* Bloque 2: Logística y Despacho */}
                <h4 style={{ margin: '0 0 0.85rem', color: 'var(--g-blue)', fontSize: '0.95rem' }}>
                  2. Logística y Despacho
                </h4>
                <div className="g-form-grid" style={{ marginBottom: '1.25rem' }}>
                  <div className="g-form-group">
                    <label>Modalidad de Envío</label>
                    <select
                      value={formData.modalidad_envio}
                      onChange={(e) => setFormData({ ...formData, modalidad_envio: e.target.value })}
                    >
                      {MODALIDADES_ENVIO.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="g-form-group">
                    <label>Cantidad de Bultos / Cajas</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.cantidad_bultos}
                      onChange={(e) => setFormData({ ...formData, cantidad_bultos: Number(e.target.value) })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Transportista / Chofer / Seguimiento</label>
                    <input
                      type="text"
                      placeholder="Ej: Ezequiel Gómez (Logística AIRO)"
                      value={formData.transportista}
                      onChange={(e) => setFormData({ ...formData, transportista: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>DNI Chofer / Patente del Vehículo</label>
                    <input
                      type="text"
                      placeholder="Ej: 38.452.110 / AF 821 CD"
                      value={formData.patente}
                      onChange={(e) => setFormData({ ...formData, patente: e.target.value })}
                    />
                  </div>
                </div>

                {/* Bloque 3: Mercadería Remitida */}
                <h4 style={{ margin: '0 0 0.85rem', color: 'var(--g-blue)', fontSize: '0.95rem' }}>
                  3. Mercadería & Ítems a Remitir
                </h4>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--g-border)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div className="g-form-grid" style={{ marginBottom: '0.75rem' }}>
                    <div className="g-form-group g-form-col-full">
                      <label>Seleccionar Producto desde Inventario en Stock (Opcional)</label>
                      <select
                        value={tempItem.producto_id}
                        onChange={(e) => handleSelectProductoItem(e.target.value)}
                      >
                        <option value="">-- Seleccionar producto de stock para autocompletar --</option>
                        {productos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} - {p.nombre} ({p.talle || 'U'} {p.color || ''}) — Disp: {Math.max(0, p.stock_actual - (p.stock_reservado || 0))} u.
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="g-form-group g-form-col-full">
                      <label>Descripción del Ítem a Remitir *</label>
                      <input
                        type="text"
                        placeholder="Ej: Remera Cuello Redondo 24/1 Peinado - Negro Talle L (Estampa DTF)"
                        value={tempItem.descripcion}
                        onChange={(e) => setTempItem({ ...tempItem, descripcion: e.target.value })}
                      />
                    </div>
                    <div className="g-form-group">
                      <label>Cantidad *</label>
                      <input
                        type="number"
                        min="1"
                        value={tempItem.cantidad}
                        onChange={(e) => setTempItem({ ...tempItem, cantidad: e.target.value })}
                      />
                    </div>
                    <div className="g-form-group">
                      <label>Bulto / Caja Asignada</label>
                      <input
                        type="text"
                        placeholder="Ej: Caja 1/2"
                        value={tempItem.bulto}
                        onChange={(e) => setTempItem({ ...tempItem, bulto: e.target.value })}
                      />
                    </div>
                  </div>
                  <button type="button" className="g-btn g-btn-outline" onClick={handleAddItem}>
                    + Agregar Ítem al Remito
                  </button>
                </div>

                {/* Tabla de ítems cargados */}
                {formData.items.length > 0 ? (
                  <table className="gestion-table" style={{ marginBottom: '1rem' }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>SKU</th>
                        <th>Descripción</th>
                        <th>Cantidad</th>
                        <th>Bulto</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td>{idx + 1}</td>
                          <td style={{ fontFamily: 'monospace' }}>{it.sku || 'A MEDIDA'}</td>
                          <td><strong>{it.descripcion}</strong></td>
                          <td><strong>{it.cantidad} {it.unidad}</strong></td>
                          <td>{it.bulto}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="g-btn g-btn-danger g-btn-sm"
                              onClick={() => handleRemoveItem(idx)}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    ⚠️ Todavía no agregaste ningún ítem al remito.
                  </p>
                )}

                {/* Checkbox Descuento de Stock */}
                <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', color: '#0e7490' }}>
                    <input
                      type="checkbox"
                      checked={formData.descontar_stock}
                      onChange={(e) => setFormData({ ...formData, descontar_stock: e.target.checked })}
                    />
                    Descontar automáticamente del stock de inventario físico y registrar en Kardex al emitir
                  </label>
                </div>

                {/* Observaciones */}
                <div className="g-form-group">
                  <label>Observaciones Generales</label>
                  <textarea
                    rows={2}
                    value={formData.observaciones}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  />
                </div>
              </div>

              <div className="gestion-modal-footer" style={{ flexShrink: 0 }}>
                <button type="button" className="g-btn g-btn-outline" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="g-btn g-btn-primary">
                  {formData.id ? 'Guardar Modificaciones del Remito' : 'Emitir y Guardar Remito'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CAMBIO DE ESTADO Y RECEPCIÓN CONFORME */}
      {estadoModal.open && (
        <div className="gestion-modal-backdrop" onClick={() => setEstadoModal({ open: false, remito: null, nuevoEstado: '', firmado_por: '', dni_receptor: '' })}>
          <div className="gestion-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="gestion-modal-header">
              <h3>Actualizar Estado del Remito</h3>
              <button className="gestion-modal-close" onClick={() => setEstadoModal({ open: false, remito: null, nuevoEstado: '', firmado_por: '', dni_receptor: '' })}>
                ×
              </button>
            </div>
            <form onSubmit={handleGuardarCambioEstado}>
              <div className="gestion-modal-body">
                <p style={{ margin: '0 0 1rem', fontSize: '0.9rem' }}>
                  Remito: <strong>{estadoModal.remito?.numero}</strong> ({estadoModal.remito?.cliente_nombre})
                </p>
                <div className="g-form-group" style={{ marginBottom: '1rem' }}>
                  <label>Nuevo Estado</label>
                  <select
                    value={estadoModal.nuevoEstado}
                    onChange={(e) => setEstadoModal({ ...estadoModal, nuevoEstado: e.target.value })}
                  >
                    <option value="Borrador">Borrador</option>
                    <option value="Emitido">Emitido</option>
                    <option value="En Tránsito">En Tránsito (Despachado)</option>
                    <option value="Entregado">Entregado (Recepción Conforme)</option>
                    <option value="Anulado">Anulado (Reponer stock si correspondía)</option>
                  </select>
                </div>
                {estadoModal.nuevoEstado === 'Entregado' && (
                  <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--g-border)' }}>
                    <div className="g-form-group" style={{ marginBottom: '0.65rem' }}>
                      <label>Nombre y Apellido de quien recibe conforme</label>
                      <input
                        type="text"
                        placeholder="Ej: Lucía Méndez"
                        value={estadoModal.firmado_por}
                        onChange={(e) => setEstadoModal({ ...estadoModal, firmado_por: e.target.value })}
                      />
                    </div>
                    <div className="g-form-group">
                      <label>DNI del Receptor</label>
                      <input
                        type="text"
                        placeholder="Ej: 36.902.411"
                        value={estadoModal.dni_receptor}
                        onChange={(e) => setEstadoModal({ ...estadoModal, dni_receptor: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="gestion-modal-footer">
                <button
                  type="button"
                  className="g-btn g-btn-outline"
                  onClick={() => setEstadoModal({ open: false, remito: null, nuevoEstado: '', firmado_por: '', dni_receptor: '' })}
                >
                  Cancelar
                </button>
                <button type="submit" className="g-btn g-btn-primary">
                  Actualizar Estado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
