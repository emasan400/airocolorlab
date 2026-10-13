import { useState } from 'react';
import {
  getUsuarios,
  saveUsuario,
  deleteUsuario,
  cambiarPasswordUsuario,
  adminResetPassword,
  ROLES_DEFINICION,
  getOperadorActual,
} from '../services/storageService.js';

export default function UsuariosRolesModule({ currentUserEmail, onProfileUpdated }) {
  const [activeSubTab, setActiveSubTab] = useState('usuarios'); // 'usuarios' | 'matriz' | 'password'
  const [usuarios, setUsuarios] = useState(getUsuarios());
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('todos');

  // Modal Alta / Edición de Usuario
  const [modalUsuario, setModalUsuario] = useState({
    open: false,
    isEdit: false,
    data: {
      id: '',
      nombre: '',
      email: '',
      rol: 'taller_produccion',
      activo: true,
      password: '',
    },
  });

  // Modal Reseteo de Contraseña por Admin
  const [modalReset, setModalReset] = useState({
    open: false,
    user: null,
    newPassword: '',
    confirmPassword: '',
    error: '',
    success: '',
  });

  // Formulario Self-Service de Cambio de Contraseña
  const [selfPassword, setSelfPassword] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    busy: false,
    error: '',
    success: '',
  });

  const reloadUsuarios = () => {
    const list = getUsuarios();
    setUsuarios(list);
    if (onProfileUpdated) onProfileUpdated();
  };

  const handleOpenNuevo = () => {
    setModalUsuario({
      open: true,
      isEdit: false,
      data: {
        id: '',
        nombre: '',
        email: '',
        rol: 'taller_produccion',
        activo: true,
        password: '',
      },
    });
  };

  const handleOpenEditar = (u) => {
    setModalUsuario({
      open: true,
      isEdit: true,
      data: {
        id: u.id,
        nombre: u.nombre,
        email: u.email,
        rol: u.rol,
        activo: u.activo,
        password: '',
      },
    });
  };

  const handleGuardarUsuario = (e) => {
    e.preventDefault();
    try {
      saveUsuario(modalUsuario.data);
      setModalUsuario({ open: false, isEdit: false, data: {} });
      reloadUsuarios();
      alert(modalUsuario.isEdit ? 'Usuario actualizado con éxito.' : 'Nuevo usuario dado de alta.');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleEliminarUsuario = (u) => {
    if (confirm(`¿Estás seguro de eliminar la cuenta de ${u.nombre} (${u.email})?`)) {
      try {
        deleteUsuario(u.id);
        reloadUsuarios();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleOpenReset = (u) => {
    setModalReset({
      open: true,
      user: u,
      newPassword: '',
      confirmPassword: '',
      error: '',
      success: '',
    });
  };

  const handleEjecutarReset = async (e) => {
    e.preventDefault();
    if (modalReset.newPassword.length < 8) {
      setModalReset((prev) => ({ ...prev, error: 'La contraseña debe tener al menos 8 caracteres.' }));
      return;
    }
    if (modalReset.newPassword !== modalReset.confirmPassword) {
      setModalReset((prev) => ({ ...prev, error: 'Las contraseñas no coinciden.' }));
      return;
    }
    try {
      await adminResetPassword(modalReset.user.id, modalReset.newPassword);
      setModalReset((prev) => ({
        ...prev,
        success: '¡Contraseña actualizada con éxito!',
        error: '',
      }));
      setTimeout(() => {
        setModalReset({ open: false, user: null, newPassword: '', confirmPassword: '', error: '', success: '' });
        reloadUsuarios();
      }, 1500);
    } catch (err) {
      setModalReset((prev) => ({ ...prev, error: err.message }));
    }
  };

  const handleSelfPasswordSubmit = async (e) => {
    e.preventDefault();
    setSelfPassword((p) => ({ ...p, error: '', success: '', busy: true }));

    if (selfPassword.newPassword.length < 8) {
      setSelfPassword((p) => ({ ...p, error: 'La nueva contraseña debe tener mínimo 8 caracteres.', busy: false }));
      return;
    }
    if (selfPassword.newPassword !== selfPassword.confirmPassword) {
      setSelfPassword((p) => ({ ...p, error: 'La confirmación de contraseña no coincide.', busy: false }));
      return;
    }

    try {
      const emailToChange = currentUserEmail || getOperadorActual();
      await cambiarPasswordUsuario(emailToChange, selfPassword.currentPassword, selfPassword.newPassword);
      setSelfPassword({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        busy: false,
        error: '',
        success: '¡Tu contraseña ha sido actualizada exitosamente!',
      });
    } catch (err) {
      setSelfPassword((p) => ({ ...p, error: err.message, busy: false }));
    }
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    const text = `${u.nombre || ''} ${u.email || ''}`.toLowerCase();
    const matchBusqueda = text.includes(busqueda.toLowerCase());
    const matchRol = filtroRol === 'todos' || u.rol === filtroRol;
    return matchBusqueda && matchRol;
  });

  return (
    <div>
      {/* Encabezado Editorial AIRO */}
      <div className="gestion-module-header">
        <div className="section-eyebrow">
          <span className="num">08</span> Seguridad & Accesos
        </div>
        <h2 className="display section-title">Usuarios y control de accesos.</h2>
        <p className="section-sub">
          Administración de colaboradores, asignación de roles por tarea textil y cambio de credenciales de seguridad.
        </p>
      </div>

      {/* Sub-navegación estilo cápsula de filtros */}
      <div style={{ marginBottom: '28px' }}>
        <div className="gestion-tabs-pill-container" role="tablist">
          <button
            role="tab"
            aria-selected={activeSubTab === 'usuarios'}
            className={`gestion-tab-btn ${activeSubTab === 'usuarios' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('usuarios')}
          >
            👥 Colaboradores & Cuentas ({usuarios.length})
          </button>
          <button
            role="tab"
            aria-selected={activeSubTab === 'matriz'}
            className={`gestion-tab-btn ${activeSubTab === 'matriz' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('matriz')}
          >
            🛡️ Matriz de Roles & Permisos
          </button>
          <button
            role="tab"
            aria-selected={activeSubTab === 'password'}
            className={`gestion-tab-btn ${activeSubTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('password')}
          >
            🔑 Mi Contraseña
          </button>
        </div>
      </div>

      {/* SUB-PESTAÑA 1: TABLA DE USUARIOS */}
      {activeSubTab === 'usuarios' && (
        <div>
          {/* Barra de Controles */}
          <div className="gestion-control-bar">
            <div className="gestion-search-box">
              <input
                type="text"
                className="gestion-input-search"
                placeholder="Buscar colaborador por nombre o email…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <div className="gestion-filters">
              <select
                className="gestion-select"
                value={filtroRol}
                onChange={(e) => setFiltroRol(e.target.value)}
              >
                <option value="todos">Todos los Roles</option>
                {ROLES_DEFINICION.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
              <button className="g-btn g-btn-primary" onClick={handleOpenNuevo}>
                + Nuevo Colaborador
              </button>
            </div>
          </div>

          {/* Tabla de Usuarios */}
          <div className="gestion-table-container">
            <div className="gestion-table-scroll">
              <table className="gestion-table">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Email de Acceso</th>
                    <th>Rol Asignado</th>
                    <th>Módulos Habilitados</th>
                    <th>Estado</th>
                    <th>Alta</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="gestion-empty-state">
                          <div className="gestion-empty-icon">👥</div>
                          <h4>No se encontraron colaboradores</h4>
                          <p>Ajustá los filtros de búsqueda o creá un nuevo usuario para tu equipo de trabajo.</p>
                          <button className="g-btn g-btn-primary" onClick={handleOpenNuevo}>
                            + Nuevo Colaborador
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    usuariosFiltrados.map((u) => {
                      const rolInfo = ROLES_DEFINICION.find((r) => r.id === u.rol) || {
                        nombre: u.rol,
                        badgeClass: 'g-badge-neutral',
                        modulosPermitidos: [],
                      };
                      const esCurrentUser =
                        currentUserEmail && u.email.toLowerCase() === currentUserEmail.toLowerCase();

                      return (
                        <tr key={u.id}>
                          <td>
                            <strong>{u.nombre}</strong>
                            {esCurrentUser && (
                              <span
                                style={{
                                  marginLeft: '8px',
                                  fontSize: '0.72rem',
                                  background: 'rgba(0, 180, 216, 0.15)',
                                  color: 'var(--cyan-ink)',
                                  padding: '2px 6px',
                                  borderRadius: '999px',
                                  fontWeight: 700,
                                }}
                              >
                                Tú
                              </span>
                            )}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{u.email}</td>
                          <td>
                            <span className={`g-badge ${rolInfo.badgeClass || 'g-badge-neutral'}`}>
                              {rolInfo.nombre}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--ink-70)' }}>
                            {u.rol === 'admin'
                              ? 'Acceso Total (Todos)'
                              : rolInfo.modulosPermitidos.join(', ')}
                          </td>
                          <td>
                            <span className={`g-badge ${u.activo ? 'g-badge-success' : 'g-badge-danger'}`}>
                              {u.activo ? 'Activo' : 'Suspendido'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--ink-45)' }}>
                            {u.fecha_creacion ? new Date(u.fecha_creacion).toLocaleDateString('es-AR') : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                className="g-btn g-btn-outline g-btn-sm"
                                onClick={() => handleOpenReset(u)}
                                title="Resetear contraseña de este usuario"
                              >
                                🔑 Clave
                              </button>
                              <button
                                className="g-btn g-btn-outline g-btn-sm"
                                onClick={() => handleOpenEditar(u)}
                                title="Editar nombre, email o rol"
                              >
                                ✏️
                              </button>
                              <button
                                className="g-btn g-btn-danger g-btn-sm"
                                onClick={() => handleEliminarUsuario(u)}
                                title="Eliminar usuario"
                              >
                                🗑️
                              </button>
                            </div>
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
      )}

      {/* SUB-PESTAÑA 2: MATRIZ DE ROLES & PERMISOS */}
      {activeSubTab === 'matriz' && (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <h3 className="display" style={{ fontSize: '20px', marginBottom: '8px' }}>
              Matriz de Responsabilidades & Permisos Operativos
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--ink-70)', maxWidth: '70ch' }}>
              AIRO COLOR LAB. segmenta el acceso por rol para garantizar que los equipos de taller, logística,
              comercial y administración trabajen con las interfaces específicas que necesitan sin sobreexponer datos sensibles.
            </p>
          </div>

          {/* Grid de Tarjetas de Roles */}
          <div className="gestion-kpis" style={{ marginBottom: '36px' }}>
            {ROLES_DEFINICION.map((rol) => (
              <div key={rol.id} className="gestion-kpi-card" style={{ borderTop: `4px solid ${rol.color}` }}>
                <div>
                  <div className="gestion-kpi-label" style={{ color: rol.color }}>
                    {rol.nombre}
                  </div>
                  <div style={{ fontSize: '13.5px', color: 'var(--ink-70)', marginTop: '8px', lineHeight: '1.45' }}>
                    {rol.descripcion}
                  </div>
                </div>
                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-45)', textTransform: 'uppercase' }}>
                    Módulos accesibles:
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {rol.modulosPermitidos.map((m) => (
                      <span key={m} className="g-badge g-badge-neutral" style={{ fontSize: '9.5px' }}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tabla Comparativa de Matriz */}
          <div className="gestion-table-container">
            <div className="gestion-table-scroll">
              <table className="gestion-table">
                <thead>
                  <tr>
                    <th>Módulo Operativo</th>
                    <th>Admin General</th>
                    <th>Taller & Producción</th>
                    <th>Logística & Despacho</th>
                    <th>Tesorería & Caja</th>
                    <th>Comercial B2B</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>📦 Productos en Stock</strong></td>
                    <td><span className="g-badge g-badge-success">Lectura y Escritura</span></td>
                    <td><span className="g-badge g-badge-success">Lectura y Ajuste</span></td>
                    <td><span className="g-badge g-badge-neutral">Solo Lectura</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-neutral">Solo Lectura</span></td>
                  </tr>
                  <tr>
                    <td><strong>🧵 Insumos & Materiales</strong></td>
                    <td><span className="g-badge g-badge-success">Lectura y Escritura</span></td>
                    <td><span className="g-badge g-badge-success">Consumo y Stock</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                  </tr>
                  <tr>
                    <td><strong>📄 Confección de Remitos</strong></td>
                    <td><span className="g-badge g-badge-success">Lectura y Escritura</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-success">Emisión y Despacho</span></td>
                    <td><span className="g-badge g-badge-neutral">Solo Lectura</span></td>
                    <td><span className="g-badge g-badge-neutral">Solo Lectura</span></td>
                  </tr>
                  <tr>
                    <td><strong>💰 Flujo de Caja & Finanzas</strong></td>
                    <td><span className="g-badge g-badge-success">Lectura y Escritura</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-success">Control Total</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                  </tr>
                  <tr>
                    <td><strong>📊 Kardex de Movimientos</strong></td>
                    <td><span className="g-badge g-badge-neutral">Auditoría Total</span></td>
                    <td><span className="g-badge g-badge-neutral">Trazabilidad Taller</span></td>
                    <td><span className="g-badge g-badge-neutral">Trazabilidad Envíos</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                  </tr>
                  <tr>
                    <td><strong>👥 Contactos (Clientes/Proveed.)</strong></td>
                    <td><span className="g-badge g-badge-success">Lectura y Escritura</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-neutral">Consulta de Envíos</span></td>
                    <td><span className="g-badge g-badge-success">Lectura y Escritura</span></td>
                    <td><span className="g-badge g-badge-success">Alta de Clientes</span></td>
                  </tr>
                  <tr>
                    <td><strong>⚙️ Usuarios, Roles & Sistema</strong></td>
                    <td><span className="g-badge g-badge-success">Control Exclusivo</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-PESTAÑA 3: CAMBIO DE CONTRASEÑA (SELF-SERVICE) */}
      {activeSubTab === 'password' && (
        <div style={{ maxWidth: '580px' }}>
          <div className="gestion-kpi-card" style={{ padding: '32px' }}>
            <h3 className="display" style={{ fontSize: '22px', marginBottom: '8px' }}>
              Actualizar Mi Contraseña
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--ink-70)', marginBottom: '24px' }}>
              Cambiá tu clave de acceso personal. La contraseña debe tener al menos 8 caracteres para mantener segura la operatoria de AIRO.
            </p>

            {selfPassword.error && (
              <div className="auth-alert-error" style={{ marginBottom: '18px' }}>
                <span>⚠️</span>
                <div>{selfPassword.error}</div>
              </div>
            )}

            {selfPassword.success && (
              <div
                style={{
                  background: 'rgba(34, 177, 94, 0.12)',
                  border: '1px solid rgba(34, 177, 94, 0.3)',
                  color: '#178a48',
                  padding: '12px 16px',
                  borderRadius: 'var(--r-s)',
                  fontSize: '13.5px',
                  marginBottom: '18px',
                  fontWeight: 600,
                }}
              >
                ✓ {selfPassword.success}
              </div>
            )}

            <form onSubmit={handleSelfPasswordSubmit} className="g-form-group" style={{ gap: '16px' }}>
              <div>
                <label>Cuenta de Usuario:</label>
                <input
                  type="text"
                  disabled
                  value={currentUserEmail || getOperadorActual()}
                  style={{ background: 'var(--neutral)', cursor: 'not-allowed', width: '100%' }}
                />
              </div>

              <div>
                <label>Contraseña Actual:</label>
                <input
                  type="password"
                  required
                  placeholder="Ingresá tu clave actual…"
                  value={selfPassword.currentPassword}
                  onChange={(e) => setSelfPassword((p) => ({ ...p, currentPassword: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label>Nueva Contraseña (mínimo 8 caracteres):</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={selfPassword.newPassword}
                  onChange={(e) => setSelfPassword((p) => ({ ...p, newPassword: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label>Confirmar Nueva Contraseña:</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={selfPassword.confirmPassword}
                  onChange={(e) => setSelfPassword((p) => ({ ...p, confirmPassword: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginTop: '8px' }}>
                <button
                  type="submit"
                  className="g-btn g-btn-primary"
                  disabled={selfPassword.busy}
                  style={{ width: '100%' }}
                >
                  {selfPassword.busy ? 'Guardando nueva clave…' : 'Actualizar Mi Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ALTA / EDICIÓN DE USUARIO */}
      {modalUsuario.open && (
        <div className="gestion-modal-backdrop">
          <div className="gestion-modal">
            <div className="gestion-modal-header">
              <h3 className="display">
                {modalUsuario.isEdit ? 'Editar Colaborador' : 'Alta de Nuevo Colaborador'}
              </h3>
              <button
                className="gestion-modal-close"
                onClick={() => setModalUsuario({ open: false, isEdit: false, data: {} })}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleGuardarUsuario}>
              <div className="gestion-modal-body">
                <div className="g-form-grid">
                  <div className="g-form-group">
                    <label>Nombre y Apellido:</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Laura Martínez"
                      value={modalUsuario.data.nombre}
                      onChange={(e) =>
                        setModalUsuario((p) => ({ ...p, data: { ...p.data, nombre: e.target.value } }))
                      }
                    />
                  </div>

                  <div className="g-form-group">
                    <label>Correo Electrónico:</label>
                    <input
                      type="email"
                      required
                      placeholder="usuario@airocolorlab.com"
                      value={modalUsuario.data.email}
                      onChange={(e) =>
                        setModalUsuario((p) => ({ ...p, data: { ...p.data, email: e.target.value } }))
                      }
                    />
                  </div>

                  <div className="g-form-group g-form-col-full">
                    <label>Rol Asignado (Matriz Operativa):</label>
                    <select
                      value={modalUsuario.data.rol}
                      onChange={(e) =>
                        setModalUsuario((p) => ({ ...p, data: { ...p.data, rol: e.target.value } }))
                      }
                    >
                      {ROLES_DEFINICION.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre} — ({r.descripcion})
                        </option>
                      ))}
                    </select>
                  </div>

                  {!modalUsuario.isEdit && (
                    <div className="g-form-group g-form-col-full">
                      <label>Contraseña Inicial (mínimo 8 caracteres):</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••••••"
                        value={modalUsuario.data.password}
                        onChange={(e) =>
                          setModalUsuario((p) => ({ ...p, data: { ...p.data, password: e.target.value } }))
                        }
                      />
                    </div>
                  )}

                  <div className="g-form-group g-form-col-full" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      id="usr-activo-chk"
                      checked={modalUsuario.data.activo}
                      onChange={(e) =>
                        setModalUsuario((p) => ({ ...p, data: { ...p.data, activo: e.target.checked } }))
                      }
                      style={{ width: '18px', height: '18px' }}
                    />
                    <label htmlFor="usr-activo-chk" style={{ textTransform: 'none', cursor: 'pointer' }}>
                      Usuario habilitado para iniciar sesión en el sistema
                    </label>
                  </div>
                </div>
              </div>
              <div className="gestion-modal-footer">
                <button
                  type="button"
                  className="g-btn g-btn-outline"
                  onClick={() => setModalUsuario({ open: false, isEdit: false, data: {} })}
                >
                  Cancelar
                </button>
                <button type="submit" className="g-btn g-btn-primary">
                  {modalUsuario.isEdit ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESETEO DE CONTRASEÑA POR ADMINISTRADOR */}
      {modalReset.open && (
        <div className="gestion-modal-backdrop">
          <div className="gestion-modal" style={{ maxWidth: '480px' }}>
            <div className="gestion-modal-header">
              <h3 className="display">Resetear Contraseña</h3>
              <button
                className="gestion-modal-close"
                onClick={() => setModalReset({ open: false, user: null, newPassword: '', confirmPassword: '', error: '', success: '' })}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEjecutarReset}>
              <div className="gestion-modal-body">
                <p style={{ fontSize: '13.5px', color: 'var(--ink-70)', marginBottom: '16px' }}>
                  Asigná una nueva contraseña para <strong>{modalReset.user?.nombre}</strong> ({modalReset.user?.email}).
                </p>

                {modalReset.error && (
                  <div className="auth-alert-error" style={{ marginBottom: '14px' }}>
                    <span>⚠️</span>
                    <div>{modalReset.error}</div>
                  </div>
                )}

                {modalReset.success && (
                  <div
                    style={{
                      background: 'rgba(34, 177, 94, 0.12)',
                      color: '#178a48',
                      padding: '10px 14px',
                      borderRadius: 'var(--r-s)',
                      fontSize: '13px',
                      marginBottom: '14px',
                      fontWeight: 600,
                    }}
                  >
                    ✓ {modalReset.success}
                  </div>
                )}

                <div className="g-form-group" style={{ marginBottom: '14px' }}>
                  <label>Nueva Contraseña (mínimo 8 car.):</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={modalReset.newPassword}
                    onChange={(e) => setModalReset((p) => ({ ...p, newPassword: e.target.value }))}
                  />
                </div>

                <div className="g-form-group">
                  <label>Confirmar Contraseña:</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={modalReset.confirmPassword}
                    onChange={(e) => setModalReset((p) => ({ ...p, confirmPassword: e.target.value }))}
                  />
                </div>
              </div>
              <div className="gestion-modal-footer">
                <button
                  type="button"
                  className="g-btn g-btn-outline"
                  onClick={() => setModalReset({ open: false, user: null, newPassword: '', confirmPassword: '', error: '', success: '' })}
                >
                  Cancelar
                </button>
                <button type="submit" className="g-btn g-btn-primary">
                  Actualizar Clave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
