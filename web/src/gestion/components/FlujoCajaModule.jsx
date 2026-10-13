import { useState } from 'react';
import {
  getFlujoCaja,
  saveTransaccion,
  deleteTransaccion,
  getClientes,
  getProveedores,
} from '../services/storageService';
import { IconWallet, IconDownload, IconEdit, IconTrash } from './Icons';

const CATEGORIAS_INGRESO = [
  'Cobro Cliente (Seña 50%)',
  'Cobro Cliente (Saldo 50%)',
  'Cobro Total de Producción',
  'Venta Directa de Stock',
  'Muestreo / Prototipado Textil',
  'Otros Ingresos',
];

const CATEGORIAS_EGRESO = [
  'Materia Prima (Telas e Hilados)',
  'Insumos DTF y Químicos',
  'Taller de Costura y Confección',
  'Bordado y Procesos Externos',
  'Avíos, Cintas y Herrajes',
  'Packaging y Envíos',
  'Servicios Taller y Alquiler',
  'Mantenimiento Estampadoras y Maquinaria',
  'Marketing y Publicidad',
  'Honorarios y Sueldos',
  'Otros Egresos',
];

const MEDIOS_PAGO = [
  'Transferencia Bancaria',
  'Mercado Pago',
  'Efectivo',
  'Echeq / Cheque',
  'Tarjeta Corporativa',
];

const CUENTAS = [
  'Banco Santander AIRO',
  'Mercado Pago AIRO',
  'Caja Chica Taller',
];

const EMPTY_TRX = {
  id: '',
  fecha: new Date().toISOString().slice(0, 10),
  tipo: 'ingreso',
  categoria: 'Cobro Cliente (Seña 50%)',
  concepto: '',
  monto: '',
  medio_pago: 'Transferencia Bancaria',
  cuenta: 'Banco Santander AIRO',
  estado: 'Cobrado',
  cliente_proveedor: '',
  comprobante: '',
  notas: '',
};

export default function FlujoCajaModule({ onCajaUpdated }) {
  const [transacciones, setTransacciones] = useState(getFlujoCaja());
  const [clientes] = useState(getClientes());
  const [proveedores] = useState(getProveedores());
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_TRX);

  const reloadData = () => {
    const list = getFlujoCaja();
    setTransacciones(list);
    if (onCajaUpdated) onCajaUpdated();
  };

  const handleOpenNuevo = (tipoDefault = 'ingreso') => {
    setFormData({
      ...EMPTY_TRX,
      tipo: tipoDefault,
      categoria: tipoDefault === 'ingreso' ? CATEGORIAS_INGRESO[0] : CATEGORIAS_EGRESO[0],
      estado: tipoDefault === 'ingreso' ? 'Cobrado' : 'Pagado',
    });
    setModalOpen(true);
  };

  const handleOpenEditar = (trx) => {
    setFormData({ ...trx });
    setModalOpen(true);
  };

  const handleGuardar = (e) => {
    e.preventDefault();
    if (!formData.concepto.trim()) {
      alert('Por favor especificá el concepto o detalle del movimiento.');
      return;
    }
    if (Number(formData.monto) <= 0) {
      alert('El monto debe ser mayor a 0.');
      return;
    }
    saveTransaccion(formData);
    setModalOpen(false);
    reloadData();
  };

  const handleEliminar = (id, concepto) => {
    if (confirm(`¿Eliminar la transacción "${concepto}"?`)) {
      deleteTransaccion(id);
      reloadData();
    }
  };

  const handleCambiarEstadoRapido = (trx) => {
    const nuevoEstado =
      trx.estado === 'Pendiente'
        ? trx.tipo === 'ingreso'
          ? 'Cobrado'
          : 'Pagado'
        : 'Pendiente';
    saveTransaccion({ ...trx, estado: nuevoEstado });
    reloadData();
  };

  // Filtrado
  const transaccionesFiltradas = transacciones.filter((t) => {
    const matchBusqueda =
      (t.concepto || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (t.categoria || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (t.cliente_proveedor || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (t.comprobante || '').toLowerCase().includes(busqueda.toLowerCase());

    const matchTipo = filtroTipo === 'todos' || t.tipo === filtroTipo;

    let matchEstado = true;
    if (filtroEstado === 'efectivo') matchEstado = t.estado === 'Cobrado' || t.estado === 'Pagado';
    else if (filtroEstado === 'pendiente') matchEstado = t.estado === 'Pendiente';

    return matchBusqueda && matchTipo && matchEstado;
  });

  // Métricas Financieras
  const totalIngresosEfectivos = transacciones
    .filter((t) => t.tipo === 'ingreso' && t.estado === 'Cobrado')
    .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

  const totalEgresosEfectivos = transacciones
    .filter((t) => t.tipo === 'egreso' && t.estado === 'Pagado')
    .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

  const balanceNetoCaja = totalIngresosEfectivos - totalEgresosEfectivos;

  const pendientesCobrar = transacciones
    .filter((t) => t.tipo === 'ingreso' && t.estado === 'Pendiente')
    .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

  const pendientesPagar = transacciones
    .filter((t) => t.tipo === 'egreso' && t.estado === 'Pendiente')
    .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);

  const exportarCsv = () => {
    const headers = ['Fecha', 'Tipo', 'Categoria', 'Concepto', 'Monto', 'Medio Pago', 'Cuenta', 'Estado', 'Cliente/Proveedor', 'Comprobante'];
    const rows = transacciones.map((t) => [
      t.fecha,
      t.tipo.toUpperCase(),
      `"${t.categoria}"`,
      `"${t.concepto}"`,
      t.monto,
      t.medio_pago,
      `"${t.cuenta}"`,
      t.estado,
      `"${t.cliente_proveedor || ''}"`,
      `"${t.comprobante || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `airo_flujo_caja_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="gestion-module-header">
        <div className="section-eyebrow">
          <span className="num">04</span> Tesorería & Finanzas
        </div>
        <h2 className="display section-title">Controlador de flujo de caja.</h2>
        <p className="section-sub">
          Seguimiento de cobros de clientes, pagos a proveedores y balance de caja en tiempo real.
        </p>
      </div>

      {/* KPIs Financieros */}
      <div className="gestion-kpis">
        <div className={`gestion-kpi-card ${balanceNetoCaja >= 0 ? 'kpi-success' : 'kpi-danger'}`}>
          <div className="gestion-kpi-label">Flujo de Caja Neto (Balance)</div>
          <div className="gestion-kpi-val">${balanceNetoCaja.toLocaleString('es-AR')}</div>
          <div className="gestion-kpi-sub">
            {balanceNetoCaja >= 0 ? 'Superávit operativo acumulado' : 'Déficit temporal en caja'}
          </div>
        </div>
        <div className="gestion-kpi-card kpi-accent">
          <div className="gestion-kpi-label">Ingresos Cobrados</div>
          <div className="gestion-kpi-val" style={{ color: '#0e7490' }}>
            +${totalIngresosEfectivos.toLocaleString('es-AR')}
          </div>
          <div className="gestion-kpi-sub">Cobros por señas y saldos finales</div>
        </div>
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Egresos Pagados</div>
          <div className="gestion-kpi-val" style={{ color: '#b91c1c' }}>
            -${totalEgresosEfectivos.toLocaleString('es-AR')}
          </div>
          <div className="gestion-kpi-sub">Telas, DTF, talleres y logística</div>
        </div>
        <div className="gestion-kpi-card kpi-warning">
          <div className="gestion-kpi-label">Pendientes por Cobrar / Pagar</div>
          <div className="gestion-kpi-val" style={{ fontSize: '1.25rem' }}>
            A cobrar: ${pendientesCobrar.toLocaleString('es-AR')}
          </div>
          <div className="gestion-kpi-sub" style={{ color: '#b45309' }}>
            A pagar: ${pendientesPagar.toLocaleString('es-AR')}
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="gestion-control-bar">
        <div className="gestion-search-box">
          <input
            type="text"
            className="gestion-input-search"
            placeholder="Buscar por concepto, cliente, proveedor o factura…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="gestion-filters">
          <select
            className="gestion-select"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value="todos">Todos los Movimientos</option>
            <option value="ingreso">Solo Ingresos (+)</option>
            <option value="egreso">Solo Egresos (-)</option>
          </select>
          <select
            className="gestion-select"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="todos">Todos los Estados</option>
            <option value="efectivo">Cobrado / Pagado</option>
            <option value="pendiente">Pendientes de Cobro / Pago</option>
          </select>
          <button className="g-btn g-btn-outline" onClick={exportarCsv} title="Descargar planilla CSV" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconDownload size={14} /> CSV
          </button>
          <button className="g-btn g-btn-accent" onClick={() => handleOpenNuevo('ingreso')}>
            + Cargar Cobro (Ingreso)
          </button>
          <button className="g-btn g-btn-primary" onClick={() => handleOpenNuevo('egreso')}>
            - Cargar Pago (Egreso)
          </button>
        </div>
      </div>

      {/* Tabla de Flujo de Caja */}
      <div className="gestion-table-container">
        <div className="gestion-table-scroll">
          <table className="gestion-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Concepto / Detalle</th>
                <th>Categoría</th>
                <th>Cliente / Proveedor</th>
                <th>Monto</th>
                <th>Medio de Pago & Cuenta</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {transacciones.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="gestion-empty-state">
                      <div className="gestion-empty-icon"><IconWallet size={36} /></div>
                      <h4>Controlá los ingresos y egresos de tu taller</h4>
                      <p>
                        Aún no registraste movimientos de caja. Cargá los cobros de señas de clientes o pagos de telas y confección para visualizar tu balance financiero en tiempo real.
                      </p>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="g-btn g-btn-primary" onClick={() => handleOpenNuevo('ingreso')}>
                          + Cargar Cobro (Ingreso)
                        </button>
                        <button className="g-btn g-btn-outline" onClick={() => handleOpenNuevo('egreso')}>
                          - Cargar Pago (Egreso)
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : transaccionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="gestion-empty-state">
                      <p>No se encontraron movimientos de caja con los filtros seleccionados.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transaccionesFiltradas.map((t) => {
                  const esIngreso = t.tipo === 'ingreso';
                  const esPendiente = t.estado === 'Pendiente';

                  return (
                    <tr key={t.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{t.fecha}</td>
                      <td>
                        <span className={`g-badge ${esIngreso ? 'g-badge-success' : 'g-badge-danger'}`}>
                          {esIngreso ? '↑ Ingreso' : '↓ Egreso'}
                        </span>
                      </td>
                      <td>
                        <strong>{t.concepto}</strong>
                        {t.comprobante && t.comprobante !== '-' && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Comp: {t.comprobante}</div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#475569' }}>{t.categoria}</td>
                      <td style={{ fontSize: '0.82rem' }}>{t.cliente_proveedor || '—'}</td>
                      <td>
                        <strong
                          style={{
                            fontSize: '1rem',
                            color: esIngreso ? '#15803d' : '#b91c1c',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {esIngreso ? '+' : '-'}${Number(t.monto).toLocaleString('es-AR')}
                        </strong>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        <div>{t.medio_pago}</div>
                        <div style={{ color: '#64748b', fontSize: '0.72rem' }}>{t.cuenta}</div>
                      </td>
                      <td>
                        <button
                          className={`g-badge ${esPendiente ? 'g-badge-warning' : 'g-badge-neutral'}`}
                          style={{ border: 'none', cursor: 'pointer' }}
                          title="Hacé clic para cambiar estado Cobrado/Pendiente"
                          onClick={() => handleCambiarEstadoRapido(t)}
                        >
                          {t.estado} ⇄
                        </button>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="g-btn g-btn-outline g-btn-sm"
                          style={{ marginRight: '6px' }}
                          onClick={() => handleOpenEditar(t)}
                          title="Editar transacción"
                        >
                          <IconEdit size={14} />
                        </button>
                        <button
                          className="g-btn g-btn-danger g-btn-sm"
                          onClick={() => handleEliminar(t.id, t.concepto)}
                          title="Eliminar transacción"
                        >
                          <IconTrash size={14} />
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

      {/* Modal Carga / Edición de Transacción */}
      {modalOpen && (
        <div className="gestion-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="gestion-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gestion-modal-header">
              <h3>
                {formData.id
                  ? 'Editar Movimiento de Caja'
                  : formData.tipo === 'ingreso'
                  ? 'Registrar Cobro / Ingreso (+)'
                  : 'Registrar Pago / Egreso (-)'}
              </h3>
              <button className="gestion-modal-close" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleGuardar}>
              <div className="gestion-modal-body">
                <div className="g-form-grid">
                  <div className="g-form-group">
                    <label>Tipo de Operación *</label>
                    <select
                      value={formData.tipo}
                      onChange={(e) => {
                        const nuevoTipo = e.target.value;
                        setFormData({
                          ...formData,
                          tipo: nuevoTipo,
                          categoria: nuevoTipo === 'ingreso' ? CATEGORIAS_INGRESO[0] : CATEGORIAS_EGRESO[0],
                          estado: nuevoTipo === 'ingreso' ? 'Cobrado' : 'Pagado',
                        });
                      }}
                    >
                      <option value="ingreso">Ingreso de Dinero (+)</option>
                      <option value="egreso">Egreso de Dinero (-)</option>
                    </select>
                  </div>
                  <div className="g-form-group">
                    <label>Fecha de Operación *</label>
                    <input
                      type="date"
                      required
                      value={formData.fecha}
                      onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group g-form-col-full">
                    <label>Categoría Específica *</label>
                    <select
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    >
                      {(formData.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO).map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="g-form-group g-form-col-full">
                    <label>Concepto / Detalle del Movimiento *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Seña 50% 100 Remeras DTF Proyecto X, Compra rollo film DTF..."
                      value={formData.concepto}
                      onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Monto ($ ARS) *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="Ej: 150000"
                      value={formData.monto}
                      onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Estado del Movimiento *</label>
                    <select
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    >
                      {formData.tipo === 'ingreso' ? (
                        <>
                          <option value="Cobrado">Cobrado (Acreditado)</option>
                          <option value="Pendiente">Pendiente (A cobrar)</option>
                        </>
                      ) : (
                        <>
                          <option value="Pagado">Pagado (Debitado)</option>
                          <option value="Pendiente">Pendiente (A pagar)</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="g-form-group">
                    <label>Medio de Pago</label>
                    <select
                      value={formData.medio_pago}
                      onChange={(e) => setFormData({ ...formData, medio_pago: e.target.value })}
                    >
                      {MEDIOS_PAGO.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="g-form-group">
                    <label>Cuenta / Caja de Destino u Origen</label>
                    <select
                      value={formData.cuenta}
                      onChange={(e) => setFormData({ ...formData, cuenta: e.target.value })}
                    >
                      {CUENTAS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="g-form-group">
                    <label>{formData.tipo === 'ingreso' ? 'Cliente Asociado' : 'Proveedor / Taller'}</label>
                    <input
                      type="text"
                      list="entidades-datalist"
                      placeholder="Seleccionar o escribir nombre"
                      value={formData.cliente_proveedor}
                      onChange={(e) => setFormData({ ...formData, cliente_proveedor: e.target.value })}
                    />
                    <datalist id="entidades-datalist">
                      {formData.tipo === 'ingreso'
                        ? clientes.map((c) => <option key={c.id} value={c.razon_social} />)
                        : proveedores.map((p) => <option key={p.id} value={p.nombre} />)}
                    </datalist>
                  </div>
                  <div className="g-form-group">
                    <label>Número de Comprobante / Factura / Recibo</label>
                    <input
                      type="text"
                      placeholder="Ej: TRANSF-90214 o FAC-A-1234"
                      value={formData.comprobante}
                      onChange={(e) => setFormData({ ...formData, comprobante: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group g-form-col-full">
                    <label>Notas Adicionales</label>
                    <textarea
                      rows={2}
                      placeholder="Observaciones de pago, cuotas, retenciones..."
                      value={formData.notas}
                      onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="gestion-modal-footer">
                <button type="button" className="g-btn g-btn-outline" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="g-btn g-btn-primary">
                  Guardar en Flujo de Caja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
