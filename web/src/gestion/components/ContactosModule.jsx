import { useState } from 'react';
import {
  getClientes,
  saveCliente,
  deleteCliente,
  getProveedores,
  saveProveedor,
  deleteProveedor,
} from '../services/storageService';

export default function ContactosModule() {
  const [tab, setTab] = useState('clientes');
  const [clientes, setClientes] = useState(getClientes());
  const [proveedores, setProveedores] = useState(getProveedores());
  const [busqueda, setBusqueda] = useState('');

  // Modales
  const [modalCliOpen, setModalCliOpen] = useState(false);
  const [formCli, setFormCli] = useState({ id: '', razon_social: '', cuit: '', contacto: '', whatsapp: '', email: '', direccion: '', rubro: '', notas: '' });

  const [modalProvOpen, setModalProvOpen] = useState(false);
  const [formProv, setFormProv] = useState({ id: '', nombre: '', cuit: '', contacto: '', whatsapp: '', email: '', rubro: '', direccion: '', cbu_alias: '' });

  const reloadData = () => {
    setClientes(getClientes());
    setProveedores(getProveedores());
  };

  // Clientes handlers
  const handleOpenNuevoCli = () => {
    setFormCli({ id: '', razon_social: '', cuit: '', contacto: '', whatsapp: '', email: '', direccion: '', rubro: '', notas: '' });
    setModalCliOpen(true);
  };
  const handleOpenEditarCli = (c) => {
    setFormCli({ ...c });
    setModalCliOpen(true);
  };
  const handleGuardarCli = (e) => {
    e.preventDefault();
    if (!formCli.razon_social.trim()) return alert('Nombre requerido');
    saveCliente(formCli);
    setModalCliOpen(false);
    reloadData();
  };
  const handleEliminarCli = (id, nombre) => {
    if (confirm(`¿Eliminar cliente "${nombre}"?`)) {
      deleteCliente(id);
      reloadData();
    }
  };

  // Proveedores handlers
  const handleOpenNuevoProv = () => {
    setFormProv({ id: '', nombre: '', cuit: '', contacto: '', whatsapp: '', email: '', rubro: '', direccion: '', cbu_alias: '' });
    setModalProvOpen(true);
  };
  const handleOpenEditarProv = (p) => {
    setFormProv({ ...p });
    setModalProvOpen(true);
  };
  const handleGuardarProv = (e) => {
    e.preventDefault();
    if (!formProv.nombre.trim()) return alert('Nombre requerido');
    saveProveedor(formProv);
    setModalProvOpen(false);
    reloadData();
  };
  const handleEliminarProv = (id, nombre) => {
    if (confirm(`¿Eliminar proveedor "${nombre}"?`)) {
      deleteProveedor(id);
      reloadData();
    }
  };

  const clientesFiltrados = clientes.filter(
    (c) =>
      (c.razon_social || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.cuit || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.contacto || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const proveedoresFiltrados = proveedores.filter(
    (p) =>
      (p.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.rubro || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.contacto || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      <div className="gestion-control-bar">
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`g-btn ${tab === 'clientes' ? 'g-btn-primary' : 'g-btn-outline'}`}
            onClick={() => setTab('clientes')}
          >
            Clientes B2B ({clientes.length})
          </button>
          <button
            className={`g-btn ${tab === 'proveedores' ? 'g-btn-primary' : 'g-btn-outline'}`}
            onClick={() => setTab('proveedores')}
          >
            Proveedores & Talleres ({proveedores.length})
          </button>
        </div>
        <div className="gestion-search-box">
          <input
            type="text"
            className="gestion-input-search"
            placeholder={`Buscar en ${tab}…`}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        {tab === 'clientes' ? (
          <button className="g-btn g-btn-primary" onClick={handleOpenNuevoCli}>
            + Nuevo Cliente
          </button>
        ) : (
          <button className="g-btn g-btn-primary" onClick={handleOpenNuevoProv}>
            + Nuevo Proveedor
          </button>
        )}
      </div>

      {tab === 'clientes' ? (
        <div className="gestion-table-container">
          <div className="gestion-table-scroll">
            <table className="gestion-table">
              <thead>
                <tr>
                  <th>Razón Social / Marca</th>
                  <th>CUIT / DNI</th>
                  <th>Contacto</th>
                  <th>WhatsApp</th>
                  <th>Email</th>
                  <th>Dirección de Entrega</th>
                  <th>Rubro</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.razon_social}</strong></td>
                    <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{c.cuit || '—'}</td>
                    <td>{c.contacto || '—'}</td>
                    <td>{c.whatsapp || '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{c.email || '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{c.direccion || '—'}</td>
                    <td><span className="g-badge g-badge-neutral">{c.rubro || 'General'}</span></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="g-btn g-btn-outline g-btn-sm" style={{ marginRight: '6px' }} onClick={() => handleOpenEditarCli(c)}>✏️</button>
                      <button className="g-btn g-btn-danger g-btn-sm" onClick={() => handleEliminarCli(c.id, c.razon_social)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="gestion-table-container">
          <div className="gestion-table-scroll">
            <table className="gestion-table">
              <thead>
                <tr>
                  <th>Proveedor / Empresa</th>
                  <th>Rubro / Especialidad</th>
                  <th>Contacto</th>
                  <th>WhatsApp</th>
                  <th>Email</th>
                  <th>CBU / Alias</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {proveedoresFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.nombre}</strong></td>
                    <td><span className="g-badge g-badge-brand">{p.rubro}</span></td>
                    <td>{p.contacto || '—'}</td>
                    <td>{p.whatsapp || '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{p.email || '—'}</td>
                    <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{p.cbu_alias || '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="g-btn g-btn-outline g-btn-sm" style={{ marginRight: '6px' }} onClick={() => handleOpenEditarProv(p)}>✏️</button>
                      <button className="g-btn g-btn-danger g-btn-sm" onClick={() => handleEliminarProv(p.id, p.nombre)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Cliente */}
      {modalCliOpen && (
        <div className="gestion-modal-backdrop" onClick={() => setModalCliOpen(false)}>
          <div className="gestion-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gestion-modal-header">
              <h3>{formCli.id ? 'Editar Cliente' : 'Nuevo Cliente B2B'}</h3>
              <button className="gestion-modal-close" onClick={() => setModalCliOpen(false)}>×</button>
            </div>
            <form onSubmit={handleGuardarCli}>
              <div className="gestion-modal-body">
                <div className="g-form-grid">
                  <div className="g-form-group g-form-col-full">
                    <label>Razón Social o Marca *</label>
                    <input type="text" required value={formCli.razon_social} onChange={(e) => setFormCli({ ...formCli, razon_social: e.target.value })} />
                  </div>
                  <div className="g-form-group">
                    <label>CUIT / DNI</label>
                    <input type="text" value={formCli.cuit} onChange={(e) => setFormCli({ ...formCli, cuit: e.target.value })} />
                  </div>
                  <div className="g-form-group">
                    <label>Persona de Contacto</label>
                    <input type="text" value={formCli.contacto} onChange={(e) => setFormCli({ ...formCli, contacto: e.target.value })} />
                  </div>
                  <div className="g-form-group">
                    <label>WhatsApp / Teléfono</label>
                    <input type="text" value={formCli.whatsapp} onChange={(e) => setFormCli({ ...formCli, whatsapp: e.target.value })} />
                  </div>
                  <div className="g-form-group">
                    <label>Email</label>
                    <input type="email" value={formCli.email} onChange={(e) => setFormCli({ ...formCli, email: e.target.value })} />
                  </div>
                  <div className="g-form-group g-form-col-full">
                    <label>Dirección de Entrega</label>
                    <input type="text" value={formCli.direccion} onChange={(e) => setFormCli({ ...formCli, direccion: e.target.value })} />
                  </div>
                  <div className="g-form-group g-form-col-full">
                    <label>Rubro / Notas</label>
                    <textarea rows={2} value={formCli.notas} onChange={(e) => setFormCli({ ...formCli, notas: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="gestion-modal-footer">
                <button type="button" className="g-btn g-btn-outline" onClick={() => setModalCliOpen(false)}>Cancelar</button>
                <button type="submit" className="g-btn g-btn-primary">Guardar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Proveedor */}
      {modalProvOpen && (
        <div className="gestion-modal-backdrop" onClick={() => setModalProvOpen(false)}>
          <div className="gestion-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gestion-modal-header">
              <h3>{formProv.id ? 'Editar Proveedor' : 'Nuevo Proveedor / Taller'}</h3>
              <button className="gestion-modal-close" onClick={() => setModalProvOpen(false)}>×</button>
            </div>
            <form onSubmit={handleGuardarProv}>
              <div className="gestion-modal-body">
                <div className="g-form-grid">
                  <div className="g-form-group g-form-col-full">
                    <label>Nombre del Proveedor *</label>
                    <input type="text" required value={formProv.nombre} onChange={(e) => setFormProv({ ...formProv, nombre: e.target.value })} />
                  </div>
                  <div className="g-form-group">
                    <label>Rubro / Especialidad *</label>
                    <input type="text" required placeholder="Telas, DTF, Costura, etc." value={formProv.rubro} onChange={(e) => setFormProv({ ...formProv, rubro: e.target.value })} />
                  </div>
                  <div className="g-form-group">
                    <label>Contacto</label>
                    <input type="text" value={formProv.contacto} onChange={(e) => setFormProv({ ...formProv, contacto: e.target.value })} />
                  </div>
                  <div className="g-form-group">
                    <label>WhatsApp</label>
                    <input type="text" value={formProv.whatsapp} onChange={(e) => setFormProv({ ...formProv, whatsapp: e.target.value })} />
                  </div>
                  <div className="g-form-group">
                    <label>CBU o Alias de Pago</label>
                    <input type="text" value={formProv.cbu_alias} onChange={(e) => setFormProv({ ...formProv, cbu_alias: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="gestion-modal-footer">
                <button type="button" className="g-btn g-btn-outline" onClick={() => setModalProvOpen(false)}>Cancelar</button>
                <button type="submit" className="g-btn g-btn-primary">Guardar Proveedor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
