import { useState, useEffect, useRef } from 'react';
import './styles/gestion.css';
import {
  initializeStorageIfEmpty,
  getProductos,
  getMateriales,
  getRemitos,
  getFlujoCaja,
  getLeads,
  getApprovals,
  getOperadorActual,
  subscribeToSync,
  getUsuarioPorEmail,
  isModuloPermitido,
  ROLES_DEFINICION,
} from './services/storageService';

import {
  IconMenu,
  IconClose,
  IconUser,
  IconBox,
  IconFabric,
  IconFile,
  IconWallet,
  IconChart,
  IconUsers,
  IconBriefcase,
  IconSparkles,
  IconShield,
  IconSettings,
  IconKey,
  IconLogout,
} from './components/Icons';

import GestionAuthGuard from './components/GestionAuthGuard';
import InventarioProductos from './components/InventarioProductos';
import InventarioMateriales from './components/InventarioMateriales';
import RemitosModule from './components/RemitosModule';
import FlujoCajaModule from './components/FlujoCajaModule';
import MovimientosKardex from './components/MovimientosKardex';
import ContactosModule from './components/ContactosModule';
import CrmModule from './components/CrmModule';
import MarketingModule from './components/MarketingModule';
import ConfiguracionModule from './components/ConfiguracionModule';
import UsuariosRolesModule from './components/UsuariosRolesModule';

export default function GestionApp() {
  return (
    <GestionAuthGuard>
      {({ session, handleSignOut }) => (
        <GestionAppInner session={session} onSignOut={handleSignOut} />
      )}
    </GestionAuthGuard>
  );
}

function GestionAppInner({ session, onSignOut }) {
  const [activeTab, setActiveTab] = useState('productos');
  const [operador, setOperador] = useState(() => session?.user?.email || getOperadorActual());
  const [, setRefreshKey] = useState(0);

  // Estados de navegación: Sidebar Drawer Hamburger y Dropdown de Usuario Persona
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Detección de usuario y rol según sesión activa
  const currentUserEmail = session?.user?.email || operador;
  const currentUserObj = getUsuarioPorEmail(currentUserEmail);
  const currentRol = currentUserObj?.rol || 'admin';
  const isAdmin = currentRol === 'admin';
  const rolDef = ROLES_DEFINICION.find((r) => r.id === currentRol) || {
    nombre: currentRol,
    badgeClass: 'g-badge-neutral',
    color: '#1a4295',
  };

  // Inicializar storage y suscripciones reactivas
  useEffect(() => {
    initializeStorageIfEmpty();
    const unsubscribe = subscribeToSync(() => {
      setOperador(session?.user?.email || getOperadorActual());
      setRefreshKey((k) => k + 1);
    });
    return () => unsubscribe();
  }, [session]);

  // Cierre de menú y dropdown con tecla Escape y clic afuera
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setUserDropdownOpen(false);
      }
    };
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Protección de navegación RBAC: redirigir si no tiene permiso
  useEffect(() => {
    if (activeTab !== 'perfil' && !isModuloPermitido(currentRol, activeTab)) {
      const modulos = ['productos', 'materiales', 'remitos', 'caja', 'kardex', 'contactos', 'crm', 'marketing'];
      const primerPermitido = modulos.find((k) => isModuloPermitido(currentRol, k)) || 'perfil';
      setActiveTab(primerPermitido);
    }
  }, [currentRol, activeTab]);

  const triggerRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const prods = getProductos();
  const mats = getMateriales();
  const rems = getRemitos();
  const flujos = getFlujoCaja();
  const leadsList = getLeads();
  const approvalsList = getApprovals();
  const pendingApprovalsCount = approvalsList.filter((a) => a.estado === 'PENDING').length;

  const prodsAlert = prods.filter((p) => p.stock_actual <= p.stock_minimo).length;
  const matsAlert = mats.filter((m) => Number(m.stock_actual) <= Number(m.stock_minimo)).length;
  const remsPendientes = rems.filter((r) => r.estado === 'Emitido' || r.estado === 'En Tránsito').length;

  const totalIngresos = flujos
    .filter((t) => t.tipo === 'ingreso' && t.estado === 'Cobrado')
    .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);
  const totalEgresos = flujos
    .filter((t) => t.tipo === 'egreso' && t.estado === 'Pagado')
    .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);
  const balanceCaja = totalIngresos - totalEgresos;

  return (
    <div className="gestion-wrapper">
      {/* Backdrop del Drawer Sidebar */}
      <div
        className={`gestion-sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer Sidebar Desplegable Izquierdo */}
      <aside
        className={`gestion-sidebar-drawer ${sidebarOpen ? 'open' : ''}`}
        aria-label="Menú principal de módulos"
      >
        <div className="gestion-sidebar-header">
          <div className="gestion-sidebar-brand">
            <div className="gestion-brand-logo" style={{ width: 34, height: 34 }}>
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="48" fill="#1a4295" />
                <path d="M50 18 C58 35 68 45 82 50 C68 55 58 65 50 82 C42 65 32 55 18 50 C32 45 42 35 50 18 Z" fill="#ffffff" />
                <circle cx="50" cy="50" r="10" fill="#00b4d8" />
              </svg>
            </div>
            <div>
              <h3>AIRO COLOR LAB.</h3>
              <div style={{ fontSize: '10px', color: 'var(--ink-45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Sistema de Gestión B2B
              </div>
            </div>
          </div>
          <button
            className="gestion-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <IconClose size={18} />
          </button>
        </div>

        <nav className="gestion-sidebar-nav">
          {(isAdmin || isModuloPermitido(currentRol, 'productos')) && (
            <button
              className={`gestion-sidebar-item ${activeTab === 'productos' ? 'active' : ''}`}
              onClick={() => { setActiveTab('productos'); setSidebarOpen(false); }}
            >
              <div className="gestion-sidebar-item-left">
                <div className="gestion-sidebar-item-icon"><IconBox /></div>
                <span>Productos en Stock</span>
              </div>
              <span className="gestion-tab-badge">
                {prods.length} {prodsAlert > 0 ? `(${prodsAlert} alertas)` : ''}
              </span>
            </button>
          )}

          {(isAdmin || isModuloPermitido(currentRol, 'materiales')) && (
            <button
              className={`gestion-sidebar-item ${activeTab === 'materiales' ? 'active' : ''}`}
              onClick={() => { setActiveTab('materiales'); setSidebarOpen(false); }}
            >
              <div className="gestion-sidebar-item-left">
                <div className="gestion-sidebar-item-icon"><IconFabric /></div>
                <span>Insumos & Materiales</span>
              </div>
              <span className="gestion-tab-badge">
                {mats.length} {matsAlert > 0 ? `(${matsAlert} alertas)` : ''}
              </span>
            </button>
          )}

          {(isAdmin || isModuloPermitido(currentRol, 'remitos')) && (
            <button
              className={`gestion-sidebar-item ${activeTab === 'remitos' ? 'active' : ''}`}
              onClick={() => { setActiveTab('remitos'); setSidebarOpen(false); }}
            >
              <div className="gestion-sidebar-item-left">
                <div className="gestion-sidebar-item-icon"><IconFile /></div>
                <span>Confección de Remitos</span>
              </div>
              <span className="gestion-tab-badge">
                {rems.length} {remsPendientes > 0 ? `(${remsPendientes} desp.)` : ''}
              </span>
            </button>
          )}

          {(isAdmin || isModuloPermitido(currentRol, 'caja')) && (
            <button
              className={`gestion-sidebar-item ${activeTab === 'caja' ? 'active' : ''}`}
              onClick={() => { setActiveTab('caja'); setSidebarOpen(false); }}
            >
              <div className="gestion-sidebar-item-left">
                <div className="gestion-sidebar-item-icon"><IconWallet /></div>
                <span>Flujo de Caja</span>
              </div>
              <span
                className="gestion-tab-badge"
                style={{
                  background: balanceCaja >= 0 ? 'rgba(34, 177, 94, 0.16)' : 'rgba(192, 57, 43, 0.16)',
                  color: balanceCaja >= 0 ? '#178a48' : '#c0392b',
                }}
              >
                ${balanceCaja.toLocaleString('es-AR')}
              </span>
            </button>
          )}

          {(isAdmin || isModuloPermitido(currentRol, 'kardex')) && (
            <button
              className={`gestion-sidebar-item ${activeTab === 'kardex' ? 'active' : ''}`}
              onClick={() => { setActiveTab('kardex'); setSidebarOpen(false); }}
            >
              <div className="gestion-sidebar-item-left">
                <div className="gestion-sidebar-item-icon"><IconChart /></div>
                <span>Kardex</span>
              </div>
            </button>
          )}

          {(isAdmin || isModuloPermitido(currentRol, 'contactos')) && (
            <button
              className={`gestion-sidebar-item ${activeTab === 'contactos' ? 'active' : ''}`}
              onClick={() => { setActiveTab('contactos'); setSidebarOpen(false); }}
            >
              <div className="gestion-sidebar-item-left">
                <div className="gestion-sidebar-item-icon"><IconUsers /></div>
                <span>Contactos B2B</span>
              </div>
            </button>
          )}

          {(isAdmin || isModuloPermitido(currentRol, 'crm')) && (
            <button
              className={`gestion-sidebar-item ${activeTab === 'crm' ? 'active' : ''}`}
              onClick={() => { setActiveTab('crm'); setSidebarOpen(false); }}
            >
              <div className="gestion-sidebar-item-left">
                <div className="gestion-sidebar-item-icon"><IconBriefcase /></div>
                <span>CRM & Leads B2B</span>
              </div>
              <span className="gestion-tab-badge">{leadsList.length}</span>
            </button>
          )}

          {(isAdmin || isModuloPermitido(currentRol, 'marketing')) && (
            <button
              className={`gestion-sidebar-item ${activeTab === 'marketing' ? 'active' : ''}`}
              onClick={() => { setActiveTab('marketing'); setSidebarOpen(false); }}
            >
              <div className="gestion-sidebar-item-left">
                <div className="gestion-sidebar-item-icon"><IconSparkles /></div>
                <span>Agentes & Marketing</span>
              </div>
              <span
                className="gestion-tab-badge"
                style={{
                  background: pendingApprovalsCount > 0 ? 'rgba(180, 83, 9, 0.16)' : undefined,
                  color: pendingApprovalsCount > 0 ? '#b45309' : undefined,
                }}
              >
                {pendingApprovalsCount > 0 ? `${pendingApprovalsCount} pend.` : 'IA'}
              </span>
            </button>
          )}

          {isAdmin && (
            <button
              className={`gestion-sidebar-item ${activeTab === 'usuarios' ? 'active' : ''}`}
              onClick={() => { setActiveTab('usuarios'); setSidebarOpen(false); }}
            >
              <div className="gestion-sidebar-item-left">
                <div className="gestion-sidebar-item-icon"><IconShield /></div>
                <span>Usuarios & Roles</span>
              </div>
            </button>
          )}

          {isAdmin && (
            <button
              className={`gestion-sidebar-item ${activeTab === 'configuracion' ? 'active' : ''}`}
              onClick={() => { setActiveTab('configuracion'); setSidebarOpen(false); }}
            >
              <div className="gestion-sidebar-item-left">
                <div className="gestion-sidebar-item-icon"><IconSettings /></div>
                <span>Sincronización</span>
              </div>
            </button>
          )}

          <button
            className={`gestion-sidebar-item ${activeTab === 'perfil' ? 'active' : ''}`}
            onClick={() => { setActiveTab('perfil'); setSidebarOpen(false); }}
          >
            <div className="gestion-sidebar-item-left">
              <div className="gestion-sidebar-item-icon"><IconKey /></div>
              <span>Mi Contraseña</span>
            </div>
          </button>
        </nav>

        <div className="gestion-sidebar-footer">
          <div><strong>AIRO Gestor B2B v2.1</strong> · Build 2026.10</div>
          <div>Usuario: {currentUserEmail}</div>
        </div>
      </aside>

      {/* Top Header */}
      <header className="gestion-header">
        <div className="gestion-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Botón Hamburger Desplegable Izquierdo */}
            <button
              className="gestion-btn-hamburger"
              onClick={() => setSidebarOpen(true)}
              title="Abrir menú de navegación de módulos"
              aria-label="Abrir menú de navegación"
            >
              <IconMenu size={20} />
            </button>

            <a href="#/gestion" className="gestion-brand">
              <div className="gestion-brand-logo">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="48" fill="#1a4295" />
                  <path
                    d="M50 18 C58 35 68 45 82 50 C68 55 58 65 50 82 C42 65 32 55 18 50 C32 45 42 35 50 18 Z"
                    fill="#ffffff"
                  />
                  <circle cx="50" cy="50" r="10" fill="#00b4d8" />
                </svg>
              </div>
              <div className="gestion-brand-text">
                <h1>
                  AIRO COLOR LAB.<span className="dot" />
                </h1>
                <div className="gestion-brand-tagline">
                  Estudio Textil · Sistema de Gestión B2B
                </div>
              </div>
            </a>
          </div>

          <div className="gestion-header-actions">
            <a href="#/" className="gestion-btn-header-back" title="Ver sitio público de AIRO">
              Ver Sitio Web
            </a>

            {/* Botón de Persona (Usuario) con Dropdown y Versión del Programa */}
            <div className="gestion-user-wrapper" ref={userMenuRef}>
              <button
                className={`gestion-user-btn ${userDropdownOpen ? 'active' : ''}`}
                onClick={() => setUserDropdownOpen((v) => !v)}
                title="Configuración de usuario y sesión"
                aria-haspopup="true"
                aria-expanded={userDropdownOpen}
              >
                <div className="gestion-user-avatar">
                  <IconUser size={18} />
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Usuario</span>
              </button>

              {userDropdownOpen && (
                <div className="gestion-user-dropdown" role="menu">
                  <div className="gestion-user-dropdown-header">
                    <div className="gestion-user-dropdown-email">{currentUserEmail}</div>
                    <div className="gestion-user-dropdown-role">
                      <span
                        className="dot"
                        style={{ width: 6, height: 6, borderRadius: '50%', background: '#178a48', display: 'inline-block' }}
                      />
                      Rol: {rolDef.nombre}
                    </div>
                  </div>

                  <div className="gestion-user-dropdown-version">
                    <span style={{ fontWeight: 700, color: 'var(--ink)' }}>AIRO Gestor B2B · v2.1</span>
                    <span>Build 2026.10 · Entorno Protegido</span>
                    <span style={{ color: currentUserObj?.mfa_enabled ? '#15803d' : '#b45309', fontWeight: 600 }}>
                      {currentUserObj?.mfa_enabled ? 'MFA TOTP: Activado' : 'MFA TOTP: No configurado'}
                    </span>
                  </div>

                  <div className="gestion-user-dropdown-actions">
                    <button
                      className="gestion-user-dropdown-link"
                      onClick={() => {
                        setActiveTab('perfil');
                        setUserDropdownOpen(false);
                      }}
                    >
                      <IconKey size={16} />
                      <span>Configurar Contraseña & 2FA</span>
                    </button>
                    <a
                      href="#/admin"
                      className="gestion-user-dropdown-link"
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <IconFile size={16} />
                      <span>Administrador de Catálogo</span>
                    </a>
                  </div>

                  <button
                    className="gestion-user-dropdown-logout"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onSignOut();
                    }}
                  >
                    <IconLogout size={16} />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs de Navegación Principal con formato de filtros del Catálogo (Sin emojis, iconos SVG) */}
      <nav className="gestion-nav-tabs" aria-label="Secciones de gestión">
        <div className="gestion-nav-tabs-inner">
          <div className="gestion-tabs-pill-container" role="tablist">
            {(isAdmin || isModuloPermitido(currentRol, 'productos')) && (
              <button
                role="tab"
                aria-selected={activeTab === 'productos'}
                className={`gestion-tab-btn ${activeTab === 'productos' ? 'active' : ''}`}
                onClick={() => setActiveTab('productos')}
              >
                <IconBox size={16} />
                <span>Productos en Stock</span>
                <span className="gestion-tab-badge">
                  {prods.length} {prodsAlert > 0 ? `(${prodsAlert} alertas)` : ''}
                </span>
              </button>
            )}

            {(isAdmin || isModuloPermitido(currentRol, 'materiales')) && (
              <button
                role="tab"
                aria-selected={activeTab === 'materiales'}
                className={`gestion-tab-btn ${activeTab === 'materiales' ? 'active' : ''}`}
                onClick={() => setActiveTab('materiales')}
              >
                <IconFabric size={16} />
                <span>Insumos & Materiales</span>
                <span className="gestion-tab-badge">
                  {mats.length} {matsAlert > 0 ? `(${matsAlert} alertas)` : ''}
                </span>
              </button>
            )}

            {(isAdmin || isModuloPermitido(currentRol, 'remitos')) && (
              <button
                role="tab"
                aria-selected={activeTab === 'remitos'}
                className={`gestion-tab-btn ${activeTab === 'remitos' ? 'active' : ''}`}
                onClick={() => setActiveTab('remitos')}
              >
                <IconFile size={16} />
                <span>Confección de Remitos</span>
                <span className="gestion-tab-badge">
                  {rems.length} {remsPendientes > 0 ? `(${remsPendientes} desp.)` : ''}
                </span>
              </button>
            )}

            {(isAdmin || isModuloPermitido(currentRol, 'caja')) && (
              <button
                role="tab"
                aria-selected={activeTab === 'caja'}
                className={`gestion-tab-btn ${activeTab === 'caja' ? 'active' : ''}`}
                onClick={() => setActiveTab('caja')}
              >
                <IconWallet size={16} />
                <span>Flujo de Caja</span>
                <span
                  className="gestion-tab-badge"
                  style={{
                    background: balanceCaja >= 0 ? 'rgba(34, 177, 94, 0.16)' : 'rgba(192, 57, 43, 0.16)',
                    color: balanceCaja >= 0 ? '#178a48' : '#c0392b',
                  }}
                >
                  ${balanceCaja.toLocaleString('es-AR')}
                </span>
              </button>
            )}

            {(isAdmin || isModuloPermitido(currentRol, 'kardex')) && (
              <button
                role="tab"
                aria-selected={activeTab === 'kardex'}
                className={`gestion-tab-btn ${activeTab === 'kardex' ? 'active' : ''}`}
                onClick={() => setActiveTab('kardex')}
              >
                <IconChart size={16} />
                <span>Kardex</span>
              </button>
            )}

            {(isAdmin || isModuloPermitido(currentRol, 'contactos')) && (
              <button
                role="tab"
                aria-selected={activeTab === 'contactos'}
                className={`gestion-tab-btn ${activeTab === 'contactos' ? 'active' : ''}`}
                onClick={() => setActiveTab('contactos')}
              >
                <IconUsers size={16} />
                <span>Contactos B2B</span>
              </button>
            )}

            {(isAdmin || isModuloPermitido(currentRol, 'crm')) && (
              <button
                role="tab"
                aria-selected={activeTab === 'crm'}
                className={`gestion-tab-btn ${activeTab === 'crm' ? 'active' : ''}`}
                onClick={() => setActiveTab('crm')}
              >
                <IconBriefcase size={16} />
                <span>CRM & Leads B2B</span>
                <span className="gestion-tab-badge">
                  {leadsList.length}
                </span>
              </button>
            )}

            {(isAdmin || isModuloPermitido(currentRol, 'marketing')) && (
              <button
                role="tab"
                aria-selected={activeTab === 'marketing'}
                className={`gestion-tab-btn ${activeTab === 'marketing' ? 'active' : ''}`}
                onClick={() => setActiveTab('marketing')}
              >
                <IconSparkles size={16} />
                <span>Agentes & Marketing</span>
                <span
                  className="gestion-tab-badge"
                  style={{
                    background: pendingApprovalsCount > 0 ? 'rgba(180, 83, 9, 0.16)' : undefined,
                    color: pendingApprovalsCount > 0 ? '#b45309' : undefined,
                  }}
                >
                  {pendingApprovalsCount > 0 ? `${pendingApprovalsCount} pend.` : 'IA'}
                </span>
              </button>
            )}

            {isAdmin && (
              <button
                role="tab"
                aria-selected={activeTab === 'usuarios'}
                className={`gestion-tab-btn ${activeTab === 'usuarios' ? 'active' : ''}`}
                onClick={() => setActiveTab('usuarios')}
              >
                <IconShield size={16} />
                <span>Usuarios & Roles</span>
              </button>
            )}

            {isAdmin && (
              <button
                role="tab"
                aria-selected={activeTab === 'configuracion'}
                className={`gestion-tab-btn ${activeTab === 'configuracion' ? 'active' : ''}`}
                onClick={() => setActiveTab('configuracion')}
              >
                <IconSettings size={16} />
                <span>Sincronización</span>
              </button>
            )}

            <button
              role="tab"
              aria-selected={activeTab === 'perfil'}
              className={`gestion-tab-btn ${activeTab === 'perfil' ? 'active' : ''}`}
              onClick={() => setActiveTab('perfil')}
            >
              <IconKey size={16} />
              <span>Mi Contraseña</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Área de Trabajo Principal */}
      <main className="gestion-main">
        {activeTab === 'productos' && (
          <InventarioProductos onStockChange={triggerRefresh} />
        )}

        {activeTab === 'materiales' && (
          <InventarioMateriales onStockChange={triggerRefresh} />
        )}

        {activeTab === 'remitos' && (
          <RemitosModule onRemitoEmitted={triggerRefresh} />
        )}

        {activeTab === 'caja' && (
          <FlujoCajaModule onCajaUpdated={triggerRefresh} />
        )}

        {activeTab === 'kardex' && (
          <MovimientosKardex />
        )}

        {activeTab === 'contactos' && (
          <ContactosModule />
        )}

        {activeTab === 'crm' && (
          <CrmModule onLeadChanged={triggerRefresh} />
        )}

        {activeTab === 'marketing' && (
          <MarketingModule onContentChanged={triggerRefresh} />
        )}

        {activeTab === 'usuarios' && (
          <UsuariosRolesModule
            currentUserEmail={currentUserEmail}
            onProfileUpdated={triggerRefresh}
          />
        )}

        {activeTab === 'perfil' && (
          <UsuariosRolesModule
            currentUserEmail={currentUserEmail}
            onProfileUpdated={triggerRefresh}
          />
        )}

        {activeTab === 'configuracion' && (
          <ConfiguracionModule onDataReload={triggerRefresh} />
        )}
      </main>
    </div>
  );
}
