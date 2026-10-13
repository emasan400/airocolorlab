import { useState } from 'react';
import {
  getMateriales,
  saveMaterial,
  deleteMaterial,
  adjustStockMaterial,
  getProveedores,
} from '../services/storageService';

const CATEGORIAS_MAT = [
  { id: 'todos', label: 'Todas las Categorías' },
  { id: 'telas', label: 'Telas & Tejidos (Jersey, Friza, Lienzo)' },
  { id: 'dtf_film_polvo', label: 'DTF: Films & Polvo TPU' },
  { id: 'tintas_quimicos', label: 'Tintas DTF & Químicos' },
  { id: 'cintas_avios', label: 'Cintas, Mosquetones & Herrajes' },
  { id: 'hilos_bordado', label: 'Hilos & Costura' },
  { id: 'packaging', label: 'Packaging & Envíos' },
  { id: 'otros', label: 'Otros Insumos' },
];

const UNIDADES = [
  { id: 'kg', label: 'Kilogramos (kg)' },
  { id: 'metros', label: 'Metros (m)' },
  { id: 'rollos', label: 'Rollos' },
  { id: 'litros', label: 'Litros (L)' },
  { id: 'unidades', label: 'Unidades (u)' },
  { id: 'planchas', label: 'Planchas' },
  { id: 'paquetes', label: 'Paquetes / Packs' },
];

const EMPTY_MAT = {
  id: '',
  codigo: '',
  nombre: '',
  categoria: 'telas',
  unidad: 'kg',
  stock_actual: 0,
  stock_minimo: 5,
  costo_unitario: '',
  proveedor: '',
  ubicacion: '',
  notas: '',
};

export default function InventarioMateriales({ onStockChange }) {
  const [materiales, setMateriales] = useState(getMateriales());
  const [proveedores] = useState(getProveedores());
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_MAT);
  const [adjustModal, setAdjustModal] = useState({ open: false, item: null, delta: 0, motivo: '' });

  const reloadData = () => {
    const list = getMateriales();
    setMateriales(list);
    if (onStockChange) onStockChange();
  };

  const handleOpenNuevo = () => {
    setFormData(EMPTY_MAT);
    setModalOpen(true);
  };

  const handleOpenEditar = (m) => {
    setFormData({ ...m });
    setModalOpen(true);
  };

  const handleGuardar = (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      alert('Por favor completá el nombre del material.');
      return;
    }
    saveMaterial(formData);
    setModalOpen(false);
    reloadData();
  };

  const handleEliminar = (id, nombre) => {
    if (confirm(`¿Estás seguro de eliminar el insumo "${nombre}"?`)) {
      deleteMaterial(id);
      reloadData();
    }
  };

  const handleQuickAdjust = (m, delta) => {
    adjustStockMaterial(m.id, delta, `Ajuste rápido de material (${delta > 0 ? '+' : ''}${delta} ${m.unidad})`);
    reloadData();
  };

  const handleOpenCustomAdjust = (m) => {
    setAdjustModal({
      open: true,
      item: m,
      delta: 0,
      motivo: 'Ajuste de insumos en taller',
    });
  };

  const handleApplyCustomAdjust = (e) => {
    e.preventDefault();
    if (!adjustModal.item || adjustModal.delta === 0) return;
    adjustStockMaterial(adjustModal.item.id, Number(adjustModal.delta), adjustModal.motivo);
    setAdjustModal({ open: false, item: null, delta: 0, motivo: '' });
    reloadData();
  };

  const materialesFiltrados = materiales.filter((m) => {
    const matchBusqueda =
      (m.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (m.codigo || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (m.proveedor || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (m.ubicacion || '').toLowerCase().includes(busqueda.toLowerCase());

    const matchCat = filtroCategoria === 'todos' || m.categoria === filtroCategoria;

    let matchEst = true;
    if (filtroEstado === 'sin_stock') matchEst = Number(m.stock_actual) <= 0;
    else if (filtroEstado === 'bajo_stock') matchEst = Number(m.stock_actual) > 0 && Number(m.stock_actual) <= Number(m.stock_minimo);
    else if (filtroEstado === 'disponible') matchEst = Number(m.stock_actual) > Number(m.stock_minimo);

    return matchBusqueda && matchCat && matchEst;
  });

  // Métricas
  const totalInsumos = materiales.length;
  const insumosBajoStock = materiales.filter((m) => Number(m.stock_actual) <= Number(m.stock_minimo)).length;
  const valorTotalMateriales = materiales.reduce((acc, m) => acc + (Number(m.stock_actual) || 0) * (Number(m.costo_unitario) || 0), 0);

  const exportarCsv = () => {
    const headers = ['Codigo', 'Nombre Material', 'Categoria', 'Unidad', 'Stock Actual', 'Stock Minimo', 'Costo Unitario', 'Proveedor', 'Ubicacion'];
    const rows = materiales.map((m) => [
      m.codigo,
      `"${m.nombre}"`,
      m.categoria,
      m.unidad,
      m.stock_actual,
      m.stock_minimo,
      m.costo_unitario,
      `"${m.proveedor || ''}"`,
      `"${m.ubicacion || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `airo_inventario_materiales_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* KPIs Insumos */}
      <div className="gestion-kpis">
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Materiales Registrados</div>
          <div className="gestion-kpi-val">{totalInsumos}</div>
          <div className="gestion-kpi-sub">Insumos y materias primas activas</div>
        </div>
        <div className="gestion-kpi-card kpi-warning">
          <div className="gestion-kpi-label">Reposición Requerida</div>
          <div className="gestion-kpi-val">{insumosBajoStock}</div>
          <div className="gestion-kpi-sub">Insumos en o bajo stock de seguridad</div>
        </div>
        <div className="gestion-kpi-card kpi-accent">
          <div className="gestion-kpi-label">Inversión en Insumos</div>
          <div className="gestion-kpi-val">${valorTotalMateriales.toLocaleString('es-AR')}</div>
          <div className="gestion-kpi-sub">Valor actual de stock de materia prima</div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="gestion-control-bar">
        <div className="gestion-search-box">
          <input
            type="text"
            className="gestion-input-search"
            placeholder="Buscar por código, material, proveedor o ubicación…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="gestion-filters">
          <select
            className="gestion-select"
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
          >
            {CATEGORIAS_MAT.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            className="gestion-select"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="todos">Todos los Estados</option>
            <option value="disponible">Stock Disponible</option>
            <option value="bajo_stock">⚠️ Reponer Urgente</option>
            <option value="sin_stock">⛔ Sin Existencias</option>
          </select>
          <button className="g-btn g-btn-outline" onClick={exportarCsv} title="Descargar planilla CSV">
            📥 CSV
          </button>
          <button className="g-btn g-btn-primary" onClick={handleOpenNuevo}>
            + Nuevo Material / Insumo
          </button>
        </div>
      </div>

      {/* Tabla de Materiales */}
      <div className="gestion-table-container">
        <div className="gestion-table-scroll">
          <table className="gestion-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre del Insumo / Material</th>
                <th>Categoría</th>
                <th>Unidad</th>
                <th>Stock Actual</th>
                <th>Mínimo</th>
                <th>Costo Unit.</th>
                <th>Proveedor Habitual</th>
                <th>Ubicación</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {materialesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <div className="gestion-empty-state">
                      <p>No se encontraron insumos con los filtros seleccionados.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                materialesFiltrados.map((m) => {
                  const esBajo = Number(m.stock_actual) <= Number(m.stock_minimo) && Number(m.stock_actual) > 0;
                  const esCero = Number(m.stock_actual) <= 0;
                  const rowClass = esCero ? 'row-alert-empty' : esBajo ? 'row-alert-stock' : '';

                  return (
                    <tr key={m.id} className={rowClass}>
                      <td>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--g-blue)' }}>{m.codigo}</strong>
                      </td>
                      <td>
                        <strong>{m.nombre}</strong>
                        {m.notas && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.notas}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="g-badge g-badge-neutral">{m.categoria}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#475569' }}>{m.unidad}</span>
                      </td>
                      <td>
                        <div className="g-quick-stock">
                          <button
                            className="g-stock-btn"
                            title="Restar 1"
                            onClick={() => handleQuickAdjust(m, -1)}
                          >
                            -
                          </button>
                          <strong style={{ minWidth: '40px', textAlign: 'center', fontSize: '0.95rem' }}>
                            {m.stock_actual}
                          </strong>
                          <button
                            className="g-stock-btn"
                            title="Sumar 1"
                            onClick={() => handleQuickAdjust(m, 1)}
                          >
                            +
                          </button>
                          <button
                            className="g-btn g-btn-outline g-btn-sm"
                            style={{ marginLeft: '4px', padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                            title="Ajuste específico"
                            onClick={() => handleOpenCustomAdjust(m)}
                          >
                            ±
                          </button>
                        </div>
                      </td>
                      <td>{m.stock_minimo}</td>
                      <td>${Number(m.costo_unitario || 0).toLocaleString('es-AR')}</td>
                      <td style={{ fontSize: '0.82rem' }}>{m.proveedor || '—'}</td>
                      <td style={{ fontSize: '0.8rem', color: '#475569' }}>{m.ubicacion || '—'}</td>
                      <td>
                        {esCero ? (
                          <span className="g-badge g-badge-danger">Sin Stock</span>
                        ) : esBajo ? (
                          <span className="g-badge g-badge-warning">Reponer</span>
                        ) : (
                          <span className="g-badge g-badge-success">OK</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="g-btn g-btn-outline g-btn-sm"
                          style={{ marginRight: '6px' }}
                          onClick={() => handleOpenEditar(m)}
                          title="Editar material"
                        >
                          ✏️
                        </button>
                        <button
                          className="g-btn g-btn-danger g-btn-sm"
                          onClick={() => handleEliminar(m.id, m.nombre)}
                          title="Eliminar material"
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

      {/* Modal ABM Material */}
      {modalOpen && (
        <div className="gestion-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="gestion-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gestion-modal-header">
              <h3>{formData.id ? 'Editar Insumo / Material' : 'Nuevo Insumo / Materia Prima'}</h3>
              <button className="gestion-modal-close" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleGuardar}>
              <div className="gestion-modal-body">
                <div className="g-form-grid">
                  <div className="g-form-group">
                    <label>Código de Insumo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: MAT-TEL-001"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Categoría *</label>
                    <select
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    >
                      <option value="telas">Telas & Tejidos</option>
                      <option value="dtf_film_polvo">DTF: Films & Polvo TPU</option>
                      <option value="tintas_quimicos">Tintas & Químicos</option>
                      <option value="cintas_avios">Cintas, Mosquetones & Herrajes</option>
                      <option value="hilos_bordado">Hilos & Costura</option>
                      <option value="packaging">Packaging & Envíos</option>
                      <option value="otros">Otros</option>
                    </select>
                  </div>
                  <div className="g-form-group g-form-col-full">
                    <label>Nombre del Material *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Tela Jersey 24/1 Peinado 100% Algodón"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Unidad de Medida *</label>
                    <select
                      value={formData.unidad}
                      onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                    >
                      {UNIDADES.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="g-form-group">
                    <label>Stock Actual ({formData.unidad}) *</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={formData.stock_actual}
                      onChange={(e) => setFormData({ ...formData, stock_actual: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Stock Mínimo (Alerta de reposición)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.stock_minimo}
                      onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Costo Unitario ($ ARS)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.costo_unitario}
                      onChange={(e) => setFormData({ ...formData, costo_unitario: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Proveedor Habitual</label>
                    <input
                      type="text"
                      list="proveedores-datalist"
                      placeholder="Ej: Textil Once Pro"
                      value={formData.proveedor}
                      onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                    />
                    <datalist id="proveedores-datalist">
                      {proveedores.map((p) => (
                        <option key={p.id} value={p.nombre} />
                      ))}
                    </datalist>
                  </div>
                  <div className="g-form-group">
                    <label>Ubicación en Depósito / Taller</label>
                    <input
                      type="text"
                      placeholder="Ej: Depósito Telas - Estante T1"
                      value={formData.ubicacion}
                      onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group g-form-col-full">
                    <label>Notas Técnicas / Rendimiento</label>
                    <textarea
                      rows={2}
                      placeholder="Rendimiento por prenda, proveedor alternativo, precauciones..."
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
                  Guardar Insumo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajuste Específico de Insumo */}
      {adjustModal.open && (
        <div className="gestion-modal-backdrop" onClick={() => setAdjustModal({ open: false, item: null, delta: 0, motivo: '' })}>
          <div className="gestion-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="gestion-modal-header">
              <h3>Ajustar Stock de Insumo</h3>
              <button className="gestion-modal-close" onClick={() => setAdjustModal({ open: false, item: null, delta: 0, motivo: '' })}>
                ×
              </button>
            </div>
            <form onSubmit={handleApplyCustomAdjust}>
              <div className="gestion-modal-body">
                <p style={{ margin: '0 0 1rem', fontSize: '0.9rem' }}>
                  Material: <strong>{adjustModal.item?.nombre}</strong> ({adjustModal.item?.codigo})
                  <br />
                  Stock actual: <strong>{adjustModal.item?.stock_actual} {adjustModal.item?.unidad}</strong>
                </p>
                <div className="g-form-group" style={{ marginBottom: '1rem' }}>
                  <label>Cantidad a ajustar (+ entrada / - consumo) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Ej: 10 o -2.5"
                    value={adjustModal.delta}
                    onChange={(e) => setAdjustModal({ ...adjustModal, delta: e.target.value })}
                  />
                  <span className="g-form-hint">
                    Nuevo stock resultante:{' '}
                    <strong>{Math.max(0, (adjustModal.item?.stock_actual || 0) + Number(adjustModal.delta || 0))} {adjustModal.item?.unidad}</strong>
                  </span>
                </div>
                <div className="g-form-group">
                  <label>Motivo del movimiento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Compra según Factura #8812, Consumo en tirada de 100 buzos..."
                    value={adjustModal.motivo}
                    onChange={(e) => setAdjustModal({ ...adjustModal, motivo: e.target.value })}
                  />
                </div>
              </div>
              <div className="gestion-modal-footer">
                <button type="button" className="g-btn g-btn-outline" onClick={() => setAdjustModal({ open: false, item: null, delta: 0, motivo: '' })}>
                  Cancelar
                </button>
                <button type="submit" className="g-btn g-btn-primary">
                  Aplicar y Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
