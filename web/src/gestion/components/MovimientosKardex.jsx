import { useState } from 'react';
import { getMovimientos } from '../services/storageService';
import { IconChart } from './Icons';

export default function MovimientosKardex() {
  const [movimientos] = useState(getMovimientos());
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  const movimientosFiltrados = movimientos.filter((m) => {
    const matchBusqueda =
      (m.item_nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (m.motivo || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (m.operador || '').toLowerCase().includes(busqueda.toLowerCase());

    const matchTipo = filtroTipo === 'todos' || m.tipo === filtroTipo;
    return matchBusqueda && matchTipo;
  });

  return (
    <div>
      <div className="gestion-module-header">
        <div className="section-eyebrow">
          <span className="num">05</span> Trazabilidad & Auditoría
        </div>
        <h2 className="display section-title">Kardex de movimientos.</h2>
        <p className="section-sub">
          Registro inmutable y cronológico de todas las entradas, salidas y ajustes de stock.
        </p>
      </div>

      <div className="gestion-control-bar">
        <div className="gestion-search-box">
          <input
            type="text"
            className="gestion-input-search"
            placeholder="Buscar en el historial de movimientos por ítem, motivo u operador…"
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
            <option value="todos">Todos los Tipos</option>
            <option value="entrada">Solo Entradas (+)</option>
            <option value="salida">Solo Salidas / Despachos (-)</option>
            <option value="ajuste">Ajustes</option>
          </select>
        </div>
      </div>

      <div className="gestion-table-container">
        <div className="gestion-table-scroll">
          <table className="gestion-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Tipo</th>
                <th>Entidad</th>
                <th>Ítem / Producto / Material</th>
                <th>Cantidad</th>
                <th>Stock Anterior → Nuevo</th>
                <th>Motivo del Movimiento</th>
                <th>Operador Responsable</th>
              </tr>
            </thead>
            <tbody>
              {movimientosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="gestion-empty-state">
                      <div className="gestion-empty-icon"><IconChart size={36} /></div>
                      <h3 className="gestion-empty-title">Sin movimientos registrados aún</h3>
                      <p className="gestion-empty-text">
                        Cada ajuste manual de stock, alta de productos o materiales, y despacho de remitos generará automáticamente una traza inmutable en este Kardex.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                movimientosFiltrados.map((m) => {
                  const esEntrada = m.tipo === 'entrada';
                  return (
                    <tr key={m.id}>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {m.fecha ? new Date(m.fecha).toLocaleString('es-AR') : '—'}
                      </td>
                      <td>
                        <span className={`g-badge ${esEntrada ? 'g-badge-success' : 'g-badge-danger'}`}>
                          {esEntrada ? '↑ Entrada' : '↓ Salida'}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize', fontSize: '0.8rem', color: '#64748b' }}>
                        {m.entidad_tipo || 'producto'}
                      </td>
                      <td>
                        <strong>{m.item_nombre}</strong>
                      </td>
                      <td>
                        <strong style={{ color: esEntrada ? '#15803d' : '#b91c1c' }}>
                          {esEntrada ? '+' : '-'}{m.cantidad}
                        </strong>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#475569' }}>
                        {m.stock_anterior ?? '—'} → <strong>{m.stock_nuevo ?? '—'}</strong>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{m.motivo}</td>
                      <td style={{ fontSize: '0.8rem', color: '#1a4295', fontWeight: 600 }}>
                        {m.operador || 'Admin'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
