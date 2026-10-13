import { useState } from 'react';
import {
  getProductos,
  saveProducto,
  deleteProducto,
  adjustStockProducto,
} from '../services/storageService';

const CATEGORIAS = [
  { id: 'todos', label: 'Todas las Categorías' },
  { id: 'indumentaria', label: 'Indumentaria (Remeras, Buzos)' },
  { id: 'merchandising', label: 'Merchandising (Lanyards, Totes)' },
  { id: 'packs', label: 'Packs & Kits' },
  { id: 'accesorios', label: 'Accesorios & Otros' },
];

const EMPTY_PRODUCTO = {
  id: '',
  sku: '',
  nombre: '',
  categoria: 'indumentaria',
  talle: '',
  color: '',
  stock_actual: 0,
  stock_minimo: 10,
  stock_reservado: 0,
  costo_unitario: '',
  precio_venta: '',
  ubicacion: '',
  notas: '',
};

export default function InventarioProductos({ onStockChange }) {
  const [productos, setProductos] = useState(getProductos());
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_PRODUCTO);
  const [adjustModal, setAdjustModal] = useState({ open: false, item: null, delta: 0, motivo: '' });

  const reloadData = () => {
    const list = getProductos();
    setProductos(list);
    if (onStockChange) onStockChange();
  };

  const handleOpenNuevo = () => {
    setFormData(EMPTY_PRODUCTO);
    setModalOpen(true);
  };

  const handleOpenEditar = (p) => {
    setFormData({ ...p });
    setModalOpen(true);
  };

  const handleGuardar = (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      alert('Por favor completá el nombre del producto.');
      return;
    }
    saveProducto(formData);
    setModalOpen(false);
    reloadData();
  };

  const handleEliminar = (id, nombre) => {
    if (confirm(`¿Estás seguro de eliminar el producto "${nombre}" del inventario?`)) {
      deleteProducto(id);
      reloadData();
    }
  };

  const handleQuickAdjust = (p, delta) => {
    adjustStockProducto(p.id, delta, `Ajuste rápido desde tabla (${delta > 0 ? '+' : ''}${delta})`);
    reloadData();
  };

  const handleOpenCustomAdjust = (p) => {
    setAdjustModal({
      open: true,
      item: p,
      delta: 0,
      motivo: 'Ajuste de inventario físico',
    });
  };

  const handleApplyCustomAdjust = (e) => {
    e.preventDefault();
    if (!adjustModal.item || adjustModal.delta === 0) return;
    adjustStockProducto(adjustModal.item.id, Number(adjustModal.delta), adjustModal.motivo);
    setAdjustModal({ open: false, item: null, delta: 0, motivo: '' });
    reloadData();
  };

  // Filtrado
  const productosFiltrados = productos.filter((p) => {
    const matchBusqueda =
      (p.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.color || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.ubicacion || '').toLowerCase().includes(busqueda.toLowerCase());

    const matchCat = filtroCategoria === 'todos' || p.categoria === filtroCategoria;

    let matchEst = true;
    if (filtroEstado === 'sin_stock') matchEst = p.stock_actual <= 0;
    else if (filtroEstado === 'bajo_stock') matchEst = p.stock_actual > 0 && p.stock_actual <= p.stock_minimo;
    else if (filtroEstado === 'disponible') matchEst = p.stock_actual > p.stock_minimo;

    return matchBusqueda && matchCat && matchEst;
  });

  // Métricas
  const totalItems = productos.length;
  const totalUnidades = productos.reduce((acc, p) => acc + (Number(p.stock_actual) || 0), 0);
  const totalReservadas = productos.reduce((acc, p) => acc + (Number(p.stock_reservado) || 0), 0);
  const valorTotalCosto = productos.reduce((acc, p) => acc + (Number(p.stock_actual) || 0) * (Number(p.costo_unitario) || 0), 0);
  const valorTotalVenta = productos.reduce((acc, p) => acc + (Number(p.stock_actual) || 0) * (Number(p.precio_venta) || 0), 0);
  const itemsBajoStock = productos.filter((p) => p.stock_actual <= p.stock_minimo).length;

  const exportarCsv = () => {
    const headers = ['SKU', 'Nombre', 'Categoria', 'Talle', 'Color', 'Stock Actual', 'Stock Minimo', 'Stock Reservado', 'Costo Unitario', 'Precio Venta', 'Ubicacion'];
    const rows = productos.map((p) => [
      p.sku,
      `"${p.nombre}"`,
      p.categoria,
      p.talle || '',
      p.color || '',
      p.stock_actual,
      p.stock_minimo,
      p.stock_reservado,
      p.costo_unitario,
      p.precio_venta,
      `"${p.ubicacion || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `airo_inventario_productos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* KPIs */}
      <div className="gestion-kpis">
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Productos Registrados</div>
          <div className="gestion-kpi-val">{totalItems}</div>
          <div className="gestion-kpi-sub">Variantes y modelos en catálogo</div>
        </div>
        <div className="gestion-kpi-card kpi-accent">
          <div className="gestion-kpi-label">Stock Físico Total</div>
          <div className="gestion-kpi-val">{totalUnidades.toLocaleString('es-AR')}</div>
          <div className="gestion-kpi-sub">{totalReservadas} reservadas en pedidos</div>
        </div>
        <div className="gestion-kpi-card kpi-warning">
          <div className="gestion-kpi-label">Alertas de Stock Bajo</div>
          <div className="gestion-kpi-val">{itemsBajoStock}</div>
          <div className="gestion-kpi-sub">Productos en o bajo mínimo</div>
        </div>
        <div className="gestion-kpi-card kpi-success">
          <div className="gestion-kpi-label">Valorización a Costo</div>
          <div className="gestion-kpi-val">${valorTotalCosto.toLocaleString('es-AR')}</div>
          <div className="gestion-kpi-sub">Valor de venta: ${valorTotalVenta.toLocaleString('es-AR')}</div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="gestion-control-bar">
        <div className="gestion-search-box">
          <input
            type="text"
            className="gestion-input-search"
            placeholder="Buscar por SKU, nombre, color o estante…"
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
            {CATEGORIAS.map((c) => (
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
            <option value="bajo_stock">⚠️ Stock Bajo</option>
            <option value="sin_stock">⛔ Sin Stock</option>
          </select>
          <button className="g-btn g-btn-outline" onClick={exportarCsv} title="Descargar planilla CSV">
            📥 CSV
          </button>
          <button className="g-btn g-btn-primary" onClick={handleOpenNuevo}>
            + Nuevo Producto
          </button>
        </div>
      </div>

      {/* Tabla de Productos */}
      <div className="gestion-table-container">
        <div className="gestion-table-scroll">
          <table className="gestion-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto & Variante</th>
                <th>Categoría</th>
                <th>Stock Físico</th>
                <th>Reservado</th>
                <th>Disponible</th>
                <th>Mínimo</th>
                <th>Costo Unit.</th>
                <th>Precio Venta</th>
                <th>Ubicación</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={12}>
                    <div className="gestion-empty-state">
                      <p>No se encontraron productos con los filtros seleccionados.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((p) => {
                  const disponible = Math.max(0, (p.stock_actual || 0) - (p.stock_reservado || 0));
                  const esBajo = p.stock_actual <= p.stock_minimo && p.stock_actual > 0;
                  const esCero = p.stock_actual <= 0;
                  const rowClass = esCero ? 'row-alert-empty' : esBajo ? 'row-alert-stock' : '';

                  return (
                    <tr key={p.id} className={rowClass}>
                      <td>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--g-blue)' }}>{p.sku}</strong>
                      </td>
                      <td>
                        <div>
                          <strong>{p.nombre}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {p.talle ? `Talle: ${p.talle}` : ''} {p.color ? `· Color: ${p.color}` : ''}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="g-badge g-badge-neutral">{p.categoria}</span>
                      </td>
                      <td>
                        <div className="g-quick-stock">
                          <button
                            className="g-stock-btn"
                            title="Restar 1 unidad"
                            onClick={() => handleQuickAdjust(p, -1)}
                          >
                            -
                          </button>
                          <strong style={{ minWidth: '32px', textAlign: 'center', fontSize: '0.95rem' }}>
                            {p.stock_actual}
                          </strong>
                          <button
                            className="g-stock-btn"
                            title="Sumar 1 unidad"
                            onClick={() => handleQuickAdjust(p, 1)}
                          >
                            +
                          </button>
                          <button
                            className="g-btn g-btn-outline g-btn-sm"
                            style={{ marginLeft: '4px', padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                            title="Ajuste específico"
                            onClick={() => handleOpenCustomAdjust(p)}
                          >
                            ±
                          </button>
                        </div>
                      </td>
                      <td>{p.stock_reservado || 0}</td>
                      <td>
                        <strong style={{ color: disponible > 0 ? '#15803d' : '#b91c1c' }}>
                          {disponible}
                        </strong>
                      </td>
                      <td>{p.stock_minimo}</td>
                      <td>${Number(p.costo_unitario || 0).toLocaleString('es-AR')}</td>
                      <td>${Number(p.precio_venta || 0).toLocaleString('es-AR')}</td>
                      <td style={{ fontSize: '0.8rem', color: '#475569' }}>{p.ubicacion || '—'}</td>
                      <td>
                        {esCero ? (
                          <span className="g-badge g-badge-danger">Sin Stock</span>
                        ) : esBajo ? (
                          <span className="g-badge g-badge-warning">Stock Bajo</span>
                        ) : (
                          <span className="g-badge g-badge-success">Disponible</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="g-btn g-btn-outline g-btn-sm"
                          style={{ marginRight: '6px' }}
                          onClick={() => handleOpenEditar(p)}
                          title="Editar producto"
                        >
                          ✏️
                        </button>
                        <button
                          className="g-btn g-btn-danger g-btn-sm"
                          onClick={() => handleEliminar(p.id, p.nombre)}
                          title="Eliminar producto"
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

      {/* Modal ABM Producto */}
      {modalOpen && (
        <div className="gestion-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="gestion-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gestion-modal-header">
              <h3>{formData.id ? 'Editar Producto en Stock' : 'Nuevo Producto en Stock'}</h3>
              <button className="gestion-modal-close" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleGuardar}>
              <div className="gestion-modal-body">
                <div className="g-form-grid">
                  <div className="g-form-group">
                    <label>SKU / Código Único *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: PROD-REM-001"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Categoría *</label>
                    <select
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    >
                      <option value="indumentaria">Indumentaria</option>
                      <option value="merchandising">Merchandising</option>
                      <option value="packs">Packs & Kits</option>
                      <option value="accesorios">Accesorios</option>
                    </select>
                  </div>
                  <div className="g-form-group g-form-col-full">
                    <label>Nombre del Producto *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Remera Cuello Redondo 24/1 Peinado"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Talle / Medida</label>
                    <input
                      type="text"
                      placeholder="Ej: L, M, XL, Único, 40x45cm"
                      value={formData.talle}
                      onChange={(e) => setFormData({ ...formData, talle: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Color / Variante</label>
                    <input
                      type="text"
                      placeholder="Ej: Negro, Blanco, Crudo, Sublimado"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Stock Físico Actual *</label>
                    <input
                      type="number"
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
                      min="0"
                      value={formData.stock_minimo}
                      onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Stock Reservado en Pedidos</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.stock_reservado}
                      onChange={(e) => setFormData({ ...formData, stock_reservado: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group">
                    <label>Ubicación en Depósito / Taller</label>
                    <input
                      type="text"
                      placeholder="Ej: Estante A1, Caja 14"
                      value={formData.ubicacion}
                      onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
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
                    <label>Precio Venta Referencial ($ ARS)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.precio_venta}
                      onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                    />
                  </div>
                  <div className="g-form-group g-form-col-full">
                    <label>Notas / Especificaciones Técnicas</label>
                    <textarea
                      rows={2}
                      placeholder="Detalles de tela, estampa DTF, cuidados especiales..."
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
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajuste Específico de Stock */}
      {adjustModal.open && (
        <div className="gestion-modal-backdrop" onClick={() => setAdjustModal({ open: false, item: null, delta: 0, motivo: '' })}>
          <div className="gestion-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="gestion-modal-header">
              <h3>Ajustar Stock Físico</h3>
              <button className="gestion-modal-close" onClick={() => setAdjustModal({ open: false, item: null, delta: 0, motivo: '' })}>
                ×
              </button>
            </div>
            <form onSubmit={handleApplyCustomAdjust}>
              <div className="gestion-modal-body">
                <p style={{ margin: '0 0 1rem', fontSize: '0.9rem' }}>
                  Producto: <strong>{adjustModal.item?.nombre}</strong> ({adjustModal.item?.sku})
                  <br />
                  Stock actual: <strong>{adjustModal.item?.stock_actual} unidades</strong>
                </p>
                <div className="g-form-group" style={{ marginBottom: '1rem' }}>
                  <label>Cantidad a ajustar (usar positivo para sumar, negativo para restar) *</label>
                  <input
                    type="number"
                    required
                    placeholder="Ej: 10 o -5"
                    value={adjustModal.delta}
                    onChange={(e) => setAdjustModal({ ...adjustModal, delta: e.target.value })}
                  />
                  <span className="g-form-hint">
                    Nuevo stock resultante:{' '}
                    <strong>{Math.max(0, (adjustModal.item?.stock_actual || 0) + Number(adjustModal.delta || 0))}</strong>
                  </span>
                </div>
                <div className="g-form-group">
                  <label>Motivo del movimiento para auditoría *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Ingreso de confección de taller, Merma por estampa defectuosa..."
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
