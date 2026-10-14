import { useState, useEffect } from 'react';
import {
  getUsuarios,
  getUsuariosSanitizados,
  saveUsuario,
  deleteUsuario,
  cambiarPasswordUsuario,
  adminResetPassword,
  generateTotpSecret,
  verifyTotpCode,
  enableMfaForUser,
  disableMfaForUser,
  ROLES_DEFINICION,
  getOperadorActual,
} from '../services/storageService.js';
import { IconUsers, IconShield, IconKey, IconEdit, IconTrash, IconWarning, IconCheck, IconClose } from './Icons';

export default function UsuariosRolesModule({ currentUserEmail, onProfileUpdated, initialSubTab = 'usuarios' }) {
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab); // 'usuarios' | 'matriz' | 'password'
  const [usuarios, setUsuarios] = useState(getUsuariosSanitizados());
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('todos');

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Modal Alta / Edición de Usuario
  const [modalUsuario, setModalUsuario] = useState({
    open: false,
    isEdit: false,
    error: '',
    success: '',
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

  // Modal Configuración de MFA TOTP (Doble Factor)
  const [modalMfa, setModalMfa] = useState({
    open: false,
    secret: '',
    testCode: '',
    error: '',
    success: '',
    busy: false,
  });

  const reloadUsuarios = () => {
    const list = getUsuariosSanitizados();
    setUsuarios(list);
    if (onProfileUpdated) onProfileUpdated();
  };

  const handleOpenSetupMfa = () => {
    const sec = generateTotpSecret();
    setModalMfa({
      open: true,
      secret: sec,
      testCode: '',
      error: '',
      success: '',
      busy: false,
    });
  };

  const handleConfirmMfa = async (e) => {
    e.preventDefault();
    if (modalMfa.testCode.length !== 6) {
      setModalMfa((m) => ({ ...m, error: 'El código debe tener 6 dígitos numéricos.' }));
      return;
    }
    setModalMfa((m) => ({ ...m, busy: true, error: '' }));
    try {
      const isValid = await verifyTotpCode(modalMfa.secret, modalMfa.testCode);
      if (!isValid) {
        setModalMfa((m) => ({ ...m, error: 'Código 2FA incorrecto. Asegurate de que la hora de tu teléfono esté sincronizada.', busy: false }));
        return;
      }
      enableMfaForUser(currentUserEmail || getOperadorActual(), modalMfa.secret);
      setModalMfa((m) => ({ ...m, success: '¡Doble factor (MFA) activado con éxito!', busy: false }));
      reloadUsuarios();
      setTimeout(() => {
        setModalMfa({ open: false, secret: '', testCode: '', error: '', success: '', busy: false });
      }, 1500);
    } catch (err) {
      setModalMfa((m) => ({ ...m, error: err.message, busy: false }));
    }
  };

  const handleDisableMfa = () => {
    if (confirm('¿Estás seguro de que deseás desactivar la verificación en dos pasos (MFA)? Tu cuenta quedará protegida solo con contraseña.')) {
      try {
        disableMfaForUser(currentUserEmail || getOperadorActual());
        reloadUsuarios();
        alert('Doble factor (MFA) desactivado.');
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleOpenNuevo = () => {
    setModalUsuario({
      open: true,
      isEdit: false,
      error: '',
      success: '',
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
      error: '',
      success: '',
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
    setModalUsuario((m) => ({ ...m, error: '', success: '' }));
    try {
      saveUsuario(modalUsuario.data);
      reloadUsuarios();
      setModalUsuario((m) => ({
        ...m,
        success: m.isEdit ? '¡Usuario actualizado con éxito!' : '¡Nuevo colaborador registrado exitosamente!',
      }));
      setTimeout(() => {
        setModalUsuario({ open: false, isEdit: false, error: '', success: '', data: {} });
      }, 1000);
    } catch (err) {
      setModalUsuario((m) => ({ ...m, error: err.message }));
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
          <span className="num">10</span> Seguridad & Control de Roles
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconUsers size={16} /> Colaboradores & Cuentas ({usuarios.length})
          </button>
          <button
            role="tab"
            aria-selected={activeSubTab === 'matriz'}
            className={`gestion-tab-btn ${activeSubTab === 'matriz' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('matriz')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconShield size={16} /> Matriz de Roles & Permisos
          </button>
          <button
            role="tab"
            aria-selected={activeSubTab === 'password'}
            className={`gestion-tab-btn ${activeSubTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('password')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <IconKey size={16} /> Mi Contraseña
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
                          <div className="gestion-empty-icon"><IconUsers size={36} /></div>
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
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <IconKey size={13} /> Clave
                              </button>
                              <button
                                className="g-btn g-btn-outline g-btn-sm"
                                onClick={() => handleOpenEditar(u)}
                                title="Editar nombre, email o rol"
                              >
                                <IconEdit size={14} />
                              </button>
                              <button
                                className="g-btn g-btn-danger g-btn-sm"
                                onClick={() => handleEliminarUsuario(u)}
                                title="Eliminar usuario"
                              >
                                <IconTrash size={14} />
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
                    <td><strong>Productos en Stock</strong></td>
                    <td><span className="g-badge g-badge-success">Lectura y Escritura</span></td>
                    <td><span className="g-badge g-badge-success">Lectura y Ajuste</span></td>
                    <td><span className="g-badge g-badge-neutral">Solo Lectura</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-neutral">Solo Lectura</span></td>
                  </tr>
                  <tr>
                    <td><strong>Insumos & Materiales</strong></td>
                    <td><span className="g-badge g-badge-success">Lectura y Escritura</span></td>
                    <td><span className="g-badge g-badge-success">Consumo y Stock</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                  </tr>
                  <tr>
                    <td><strong>Confección de Remitos</strong></td>
                    <td><span className="g-badge g-badge-success">Lectura y Escritura</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-success">Emisión y Despacho</span></td>
                    <td><span className="g-badge g-badge-neutral">Solo Lectura</span></td>
                    <td><span className="g-badge g-badge-neutral">Solo Lectura</span></td>
                  </tr>
                  <tr>
                    <td><strong>Flujo de Caja & Finanzas</strong></td>
                    <td><span className="g-badge g-badge-success">Lectura y Escritura</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-success">Control Total</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                  </tr>
                  <tr>
                    <td><strong>Kardex de Movimientos</strong></td>
                    <td><span className="g-badge g-badge-neutral">Auditoría Total</span></td>
                    <td><span className="g-badge g-badge-neutral">Trazabilidad Taller</span></td>
                    <td><span className="g-badge g-badge-neutral">Trazabilidad Envíos</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                  </tr>
                  <tr>
                    <td><strong>Contactos (Clientes/Proveed.)</strong></td>
                    <td><span className="g-badge g-badge-success">Lectura y Escritura</span></td>
                    <td><span className="g-badge g-badge-danger">Sin Acceso</span></td>
                    <td><span className="g-badge g-badge-neutral">Consulta de Envíos</span></td>
                    <td><span className="g-badge g-badge-success">Lectura y Escritura</span></td>
                    <td><span className="g-badge g-badge-success">Alta de Clientes</span></td>
                  </tr>
                  <tr>
                    <td><strong>Usuarios, Roles & Sistema</strong></td>
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
              <div className="auth-alert-error" style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconWarning size={16} />
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconCheck size={16} /> {selfPassword.success}
                </span>
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

          {/* Card MFA / 2FA TOTP */}
          <div className="gestion-kpi-card" style={{ padding: '32px', marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h3 className="display" style={{ fontSize: '22px', margin: 0 }}>
                Verificación en Dos Pasos (MFA / 2FA)
              </h3>
              <span className={`g-badge ${usuarios.find((u) => u.email.toLowerCase() === (currentUserEmail || getOperadorActual()).toLowerCase())?.mfa_enabled ? 'g-badge-success' : 'g-badge-neutral'}`}>
                {usuarios.find((u) => u.email.toLowerCase() === (currentUserEmail || getOperadorActual()).toLowerCase())?.mfa_enabled ? 'Activado (Protegido)' : 'Desactivado'}
              </span>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--ink-70)', marginBottom: '20px' }}>
              Protegé tu acceso con una capa extra de seguridad sin costo ($0). Compatible con <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong> o <strong>Authy</strong>.
            </p>

            {usuarios.find((u) => u.email.toLowerCase() === (currentUserEmail || getOperadorActual()).toLowerCase())?.mfa_enabled ? (
              <div style={{ background: 'rgba(34, 177, 94, 0.08)', padding: '16px', borderRadius: 'var(--r-m)', border: '1px solid rgba(34, 177, 94, 0.2)' }}>
                <p style={{ fontSize: '0.85rem', color: '#15803d', margin: '0 0 12px 0' }}>
                  El doble factor está habilitado. Al iniciar sesión, el sistema te solicitará el código de 6 dígitos generado en tu aplicación autenticadora.
                </p>
                <button
                  type="button"
                  className="g-btn g-btn-outline"
                  style={{ color: '#c0392b', borderColor: 'rgba(192, 57, 43, 0.4)' }}
                  onClick={handleDisableMfa}
                >
                  Desactivar 2FA en esta cuenta
                </button>
              </div>
            ) : (
              <div style={{ background: 'var(--neutral)', padding: '16px', borderRadius: 'var(--r-m)', border: '1px solid var(--line)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--ink-70)', margin: '0 0 12px 0' }}>
                  Al activarlo, vincularás tu aplicación autenticadora escaneando un código QR único o ingresando una clave secreta. No requiere SMS ni servidores externos.
                </p>
                <button
                  type="button"
                  className="g-btn g-btn-primary"
                  onClick={handleOpenSetupMfa}
                >
                  Configurar 2FA con App Autenticadora
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURACIÓN DE MFA TOTP */}
      {modalMfa.open && (
        <div className="gestion-modal-backdrop">
          <div className="gestion-modal" style={{ maxWidth: '520px' }}>
            <div className="gestion-modal-header">
              <h3 className="display">Configurar 2FA con App Autenticadora</h3>
              <button
                className="gestion-modal-close"
                onClick={() => setModalMfa({ open: false, secret: '', testCode: '', error: '', success: '', busy: false })}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleConfirmMfa}>
              <div className="gestion-modal-body" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--ink-70)', margin: '0 0 16px 0' }}>
                  1. Abrí <strong>Google Authenticator</strong> o <strong>Microsoft Authenticator</strong> en tu celular y escaneá el código QR:
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      `otpauth://totp/AIRO%20Color%20Lab:${currentUserEmail || getOperadorActual()}?secret=${modalMfa.secret}&issuer=AIRO%20Color%20Lab`
                    )}`}
                    alt="Código QR MFA TOTP"
                    style={{ border: '2px solid var(--line)', borderRadius: '12px', padding: '6px', background: '#fff' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-45)', display: 'block', marginBottom: '4px' }}>
                    O ingresá manualmente esta clave secreta en la aplicación:
                  </span>
                  <code style={{ fontSize: '1rem', letterSpacing: '2px', background: 'var(--neutral)', padding: '6px 12px', borderRadius: '6px', fontWeight: 700, color: 'var(--blue)' }}>
                    {modalMfa.secret}
                  </code>
                </div>

                <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    2. Ingresá el código de 6 dígitos generado en tu teléfono para confirmar:
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    placeholder="123456"
                    value={modalMfa.testCode}
                    onChange={(e) => setModalMfa({ ...modalMfa, testCode: e.target.value.replace(/\D/g, '') })}
                    style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '6px', fontWeight: 700, width: '100%' }}
                  />
                </div>

                {modalMfa.error && (
                  <div className="auth-alert-error" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconWarning size={16} />
                    <div>{modalMfa.error}</div>
                  </div>
                )}

                {modalMfa.success && (
                  <div style={{ marginTop: '12px', color: '#15803d', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconCheck size={16} /> {modalMfa.success}
                  </div>
                )}
              </div>

              <div className="gestion-modal-footer">
                <button
                  type="button"
                  className="g-btn g-btn-outline"
                  onClick={() => setModalMfa({ open: false, secret: '', testCode: '', error: '', success: '', busy: false })}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="g-btn g-btn-primary"
                  disabled={modalMfa.busy || modalMfa.testCode.length !== 6}
                >
                  {modalMfa.busy ? 'Validando…' : 'Confirmar y Activar 2FA'}
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
                title="Cerrar modal"
              >
                <IconClose size={18} />
              </button>
            </div>
            <form onSubmit={handleGuardarUsuario}>
              <div className="gestion-modal-body">
                {modalUsuario.error && (
                  <div className="auth-alert-error" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconWarning size={16} />
                    <div>{modalUsuario.error}</div>
                  </div>
                )}
                {modalUsuario.success && (
                  <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: 'var(--r-s, 8px)', background: 'rgba(34, 177, 94, 0.1)', color: '#15803d', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconCheck size={16} /> {modalUsuario.success}
                  </div>
                )}

                <div className="g-form-grid">
                  <div className="g-form-group">
                    <label>Nombre y Apellido:</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Laura Martínez"
                      value={modalUsuario.data.nombre || ''}
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
                      value={modalUsuario.data.email || ''}
                      onChange={(e) =>
                        setModalUsuario((p) => ({ ...p, data: { ...p.data, email: e.target.value } }))
                      }
                    />
                  </div>

                  <div className="g-form-group g-form-col-full">
                    <label>Rol Asignado (Matriz Operativa):</label>
                    <select
                      value={modalUsuario.data.rol || 'taller_produccion'}
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

                  {modalUsuario.isEdit ? (
                    <div className="g-form-group g-form-col-full">
                      <label>Cambiar Contraseña (opcional, mín. 8 caracteres para actualizarla):</label>
                      <input
                        type="password"
                        placeholder="Dejar en blanco para mantener la clave actual"
                        value={modalUsuario.data.password || ''}
                        onChange={(e) =>
                          setModalUsuario((p) => ({ ...p, data: { ...p.data, password: e.target.value } }))
                        }
                      />
                    </div>
                  ) : (
                    <div className="g-form-group g-form-col-full">
                      <label>Contraseña Inicial (mínimo 8 caracteres):</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••••••"
                        value={modalUsuario.data.password || ''}
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
                      checked={modalUsuario.data.activo ?? true}
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
                title="Cerrar modal"
              >
                <IconClose size={18} />
              </button>
            </div>
            <form onSubmit={handleEjecutarReset}>
              <div className="gestion-modal-body">
                <p style={{ fontSize: '13.5px', color: 'var(--ink-70)', marginBottom: '16px' }}>
                  Asigná una nueva contraseña para <strong>{modalReset.user?.nombre}</strong> ({modalReset.user?.email}).
                </p>

                {modalReset.error && (
                  <div className="auth-alert-error" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconWarning size={16} />
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
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <IconCheck size={16} /> {modalReset.success}
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
