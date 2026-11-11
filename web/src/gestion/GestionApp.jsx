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
  getDesignCanvases,
  getDtfQuotes,
  getPmbokTasks,
  getKaizenCycles,
  SUITES_DOMINIO,
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
  IconCanvas,
  IconRuler,
  IconLayers,
  IconShield,
  IconSettings,
  IconKey,
  IconLogout,
  IconStore,
} from './components/Icons';

import GestionAuthGuard from './components/GestionAuthGuard';
import PmbokCommandModule from './components/PmbokCommandModule';
import InventarioProductos from './components/InventarioProductos';
import CatalogoWebModule from './components/CatalogoWebModule';
import InventarioMateriales from './components/InventarioMateriales';
import CotizadorDtfModule from './components/CotizadorDtfModule';
import RemitosModule from './components/RemitosModule';
import FlujoCajaModule from './components/FlujoCajaModule';
import MovimientosKardex from './components/MovimientosKardex';
import ContactosModule from './components/ContactosModule';
import CrmModule from './components/CrmModule';
import MarketingModule from './components/MarketingModule';
import DesignStudioModule from './components/DesignStudioModule';
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
  const [activeTab, setActiveTab] = useState('pmbok_command');
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
      const modulos = ['pmbok_command', 'productos', 'catalogo', 'materiales', 'cotizador_dtf', 'remitos', 'caja', 'kardex', 'contactos', 'crm', 'marketing', 'design_studio'];
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
  const canvasesList = getDesignCanvases();
  const dtfQuotesList = getDtfQuotes();
  const pmbokTasksList = getPmbokTasks();
  const kaizenList = getKaizenCycles();
  const pendingApprovalsCount = approvalsList.filter((a) => a.estado === 'PENDING').length;

  const prodsAlert = prods.filter((p) => p.stock_actual <= p.stock_minimo).length;
  const matsAlert = mats.filter((m) => Number(m.stock_actual) <= Number(m.stock_minimo)).length;
  const remsPendientes = rems.filter((r) => r.estado === 'Emitido' || r.estado === 'En Tránsito').length;
  const pmbokOpenCount = pmbokTasksList.filter((t) => t.estado !== 'COMPLETADO').length;

  const totalIngresos = flujos
    .filter((t) => t.tipo === 'ingreso' && t.estado === 'Cobrado')
    .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);
  const totalEgresos = flujos
    .filter((t) => t.tipo === 'egreso' && t.estado === 'Pagado')
    .reduce((acc, t) => acc + (Number(t.monto) || 0), 0);
  const balanceCaja = totalIngresos - totalEgresos;

  const TAB_META = {
    pmbok_command: { label: 'Comando PMBOK & Google Tasks', badge: `${pmbokOpenCount} act.` },
    crm: { label: 'CRM & Leads B2B', badge: `${leadsList.length}` },
    cotizador_dtf: { label: 'Cotizador DTF 2D', badge: `${dtfQuotesList.length} cot.` },
    contactos: { label: 'Contactos B2B', badge: '' },
    productos: { label: 'Productos en Stock', badge: `${prods.length}` },
    materiales: { label: 'Insumos & Materiales', badge: `${mats.length}` },
    remitos: { label: 'Confección de Remitos', badge: `${rems.length}` },
    kardex: { label: 'Kardex de Movimientos', badge: '' },
    design_studio: { label: 'Estudio de Diseño', badge: `${canvasesList.length}` },
    marketing: { label: 'Agentes & Marketing', badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount} pend.` : 'IA' },
    catalogo: { label: 'Catálogo Tienda Online', badge: 'Web' },
    caja: { label: 'Flujo de Caja', badge: `$${balanceCaja.toLocaleString('es-AR')}` },
    usuarios: { label: 'Usuarios & Roles', badge: 'RBAC' },
    configuracion: { label: 'Sincronización & Bóveda', badge: 'Sync' },
    perfil: { label: 'Mi Contraseña & 2FA', badge: 'Seguridad' },
  };

  const getSuiteTabs = (suite) =>
    Array.isArray(suite?.tabs)
      ? suite.tabs
      : Array.isArray(suite?.modulos)
      ? suite.modulos.map((m) => m.id)
      : [];

  const activeSuite =
    SUITES_DOMINIO.find((s) => getSuiteTabs(s).includes(activeTab)) || SUITES_DOMINIO[0];

  const suiteLabelStyle = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.09em',
    color: 'var(--ink-45)',
    padding: '12px 14px 4px',
  };

  return (
    <div className="gestion-wrapper">
      {/* Backdrop del Drawer Sidebar */}
      <div
        className={`gestion-sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer Sidebar Desplegable Izquierdo — Reingeniería 5 Suites */}
      <aside
        className={`gestion-sidebar-drawer ${sidebarOpen ? 'open' : ''}`}
        aria-label="Menú principal de Suites de Dominio"
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
                Arquitectura 5 Suites · PMBOK
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
          {/* SUITE 01: GOBERNANZA PMBOK & MEJORA CONTINUA */}
          <div style={suiteLabelStyle}>01 · Comando PMBOK & Mejora Continua</div>
          {(isAdmin || isModuloPermitido(currentRol, 'pmbok_command')) && (
            <button
              className={`gestion-sidebar-item ${activeTab === 'pmbok_command' ? 'active' : ''}`}
              onClick={() => { setActiveTab('pmbok_command'); setSidebarOpen(false); }}
            >
              <div className="gestion-sidebar-item-left">
                <div className="gestion-sidebar-item-icon"><IconLayers /></div>
                <span>Comando PMBOK & Google Tasks</span>
              </div>
              <span className="gestion-tab-badge" style={{ background: 'rgba(26, 66, 149, 0.14)', color: '#1a4295' }}>
                {pmbokOpenCount} act. · {kaizenList.length} PDCA
              </span>
            </button>
          )}

          {/* SUITE 02: COMERCIAL 360° & COTIZADOR DTF */}
          <div style={suiteLabelStyle}>02 · Suite Comercial 360° & Cotizador</div>
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

          {(isAdmin || isModuloPermitido(currentRol, 'cotizador_dtf')) && (
            <button
              className={`gestion-sidebar-item ${activeTab === 'cotizador_dtf' ? 'active' : ''}`}
              onClick={() => { setActiveTab('cotizador_dtf'); setSidebarOpen(false); }}
            >
              <div className="gestion-sidebar-item-left">
                <div className="gestion-sidebar-item-icon"><IconRuler /></div>
                <span>Cotizador DTF 2D</span>
              </div>
              <span className="gestion-tab-badge" style={{ background: 'rgba(26, 66, 149, 0.14)', color: '#1a4295' }}>
                {dtfQuotesList.length} cot.
              </span>
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

          {/* SUITE 03: TALLER, INVENTARIO & DESPACHO */}
          <div style={suiteLabelStyle}>03 · Suite Taller, Stock & Despacho</div>
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

          {/* SUITE 04: ESTUDIO CREATIVO & MARKETING IA */}
          <div style={suiteLabelStyle}>04 · Suite Estudio Creativo & Marketing</div>
          {(isAdmin || isModuloPermitido(currentRol, 'design_studio')) && (
            <button
              className={`gestion-sidebar-item ${activeTab === 'design_studio' ? 'active' : ''}`}
              onClick={() => { setActiveTab('design_studio'); setSidebarOpen(false); }}
            >
              <div className="gestion-sidebar-item-left">
                <div className="gestion-sidebar-item-icon"><IconCanvas /></div>
                <span>Estudio de Diseño</span>
              </div>
              <span className="gestion-tab-badge" style={{ background: 'rgba(0, 180, 216, 0.16)', color: '#007799' }}>
                {canvasesList.length} lienzos
              </span>
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

          {(isAdmin || isModuloPermitido(currentRol, 'catalogo')) && (
            <button
              className={`gestion-sidebar-item ${activeTab === 'catalogo' ? 'active' : ''}`}
              onClick={() => { setActiveTab('catalogo'); setSidebarOpen(false); }}
            >
              <div className="gestion-sidebar-item-left">
                <div className="gestion-sidebar-item-icon"><IconStore /></div>
                <span>Catálogo Tienda Online</span>
              </div>
              <span className="gestion-tab-badge" style={{ background: 'rgba(0, 180, 216, 0.16)', color: '#007799' }}>
                Web
              </span>
            </button>
          )}

          {/* SUITE 05: FINANZAS, EQUIPO & GOBERNANZA */}
          <div style={suiteLabelStyle}>05 · Suite Finanzas, Equipo & Bóveda</div>
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
        </nav>

        <div className="gestion-sidebar-footer">
          <div><strong>AIRO Gestor B2B v2.2</strong> · Build 2026.11 (PMBOK + Kaizen)</div>
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
                    <button
                      className="gestion-user-dropdown-link"
                      onClick={() => {
                        setActiveTab('catalogo');
                        setUserDropdownOpen(false);
                      }}
                    >
                      <IconStore size={16} />
                      <span>Catálogo Tienda Online</span>
                    </button>
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

      {/* Área de Trabajo Principal */}
      <main className="gestion-main">
        {/* Barra Contextual de las 5 Suites de Dominio (Reingeniería BPR & Desacoplamiento) */}
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 18,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 2px 10px rgba(26, 66, 149, 0.04)',
          }}
        >
          {/* Conmutador de las 5 Suites */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-45)', marginRight: 4 }}>
              Suites B2B:
            </span>
            {SUITES_DOMINIO.map((suite) => {
              const suiteTabs = getSuiteTabs(suite);
              const allowedTabs = suiteTabs.filter((t) => isAdmin || isModuloPermitido(currentRol, t));
              if (allowedTabs.length === 0) return null;
              const isSuiteActive = suiteTabs.includes(activeTab);
              return (
                <button
                  key={suite.id}
                  type="button"
                  onClick={() => setActiveTab(allowedTabs[0])}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '5px 10px',
                    borderRadius: 7,
                    border: isSuiteActive ? `1.5px solid ${suite.color}` : '1px solid var(--line)',
                    background: isSuiteActive ? `${suite.color}14` : '#f8fafc',
                    color: isSuiteActive ? suite.color : 'var(--ink-70)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span style={{ opacity: 0.7 }}>{suite.num}</span>
                  <span>{suite.nombre.replace(/^Suite \w+ · /, '')}</span>
                </button>
              );
            })}
          </div>

          {/* Sub-pestañas hermanas dentro de la Suite Activa */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-45)' }}>
              En {activeSuite.num}:
            </span>
            {getSuiteTabs(activeSuite)
              .filter((t) => isAdmin || isModuloPermitido(currentRol, t))
              .map((tabId) => {
                const meta = TAB_META[tabId] || { label: tabId, badge: '' };
                const isCurrent = activeTab === tabId;
                return (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => setActiveTab(tabId)}
                    style={{
                      fontSize: 11,
                      fontWeight: isCurrent ? 700 : 600,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: isCurrent ? '1px solid #1a4295' : '1px solid var(--line)',
                      background: isCurrent ? '#1a4295' : '#fff',
                      color: isCurrent ? '#fff' : 'var(--ink)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <span>{meta.label}</span>
                    {meta.badge && (
                      <span
                        style={{
                          fontSize: 9,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: isCurrent ? 'rgba(255,255,255,0.22)' : 'rgba(13,27,62,0.07)',
                          color: isCurrent ? '#fff' : 'var(--ink-70)',
                        }}
                      >
                        {meta.badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>

        {activeTab === 'pmbok_command' && (
          <PmbokCommandModule onNavigateTab={setActiveTab} onDataChanged={triggerRefresh} />
        )}

        {activeTab === 'productos' && (
          <InventarioProductos onStockChange={triggerRefresh} />
        )}

        {activeTab === 'catalogo' && (
          <CatalogoWebModule onContentChanged={triggerRefresh} />
        )}

        {activeTab === 'materiales' && (
          <InventarioMateriales onStockChange={triggerRefresh} />
        )}

        {activeTab === 'cotizador_dtf' && (
          <CotizadorDtfModule onNavigateTab={setActiveTab} onStockChange={triggerRefresh} />
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
          <MarketingModule
            onContentChanged={triggerRefresh}
            onOpenDesignStudio={() => setActiveTab('design_studio')}
          />
        )}

        {activeTab === 'design_studio' && (
          <DesignStudioModule
            onNavigateTab={setActiveTab}
            onContentChanged={triggerRefresh}
          />
        )}

        {activeTab === 'usuarios' && (
          <UsuariosRolesModule
            currentUserEmail={currentUserEmail}
            onProfileUpdated={triggerRefresh}
            initialSubTab="usuarios"
          />
        )}

        {activeTab === 'perfil' && (
          <UsuariosRolesModule
            currentUserEmail={currentUserEmail}
            onProfileUpdated={triggerRefresh}
            initialSubTab="password"
          />
        )}

        {activeTab === 'configuracion' && (
          <ConfiguracionModule onDataReload={triggerRefresh} />
        )}
      </main>
    </div>
  );
}
