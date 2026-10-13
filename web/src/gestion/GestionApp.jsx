import { useState, useEffect } from 'react';
import './styles/gestion.css';
import {
  initializeStorageIfEmpty,
  getProductos,
  getMateriales,
  getRemitos,
  getFlujoCaja,
  getOperadorActual,
  subscribeToSync,
  getUsuarioPorEmail,
  isModuloPermitido,
  ROLES_DEFINICION,
} from './services/storageService';

import GestionAuthGuard from './components/GestionAuthGuard';
import InventarioProductos from './components/InventarioProductos';
import InventarioMateriales from './components/InventarioMateriales';
import RemitosModule from './components/RemitosModule';
import FlujoCajaModule from './components/FlujoCajaModule';
import MovimientosKardex from './components/MovimientosKardex';
import ContactosModule from './components/ContactosModule';
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

  // Protección de navegación RBAC: redirigir si no tiene permiso
  useEffect(() => {
    if (activeTab !== 'perfil' && !isModuloPermitido(currentRol, activeTab)) {
      const modulos = ['productos', 'materiales', 'remitos', 'caja', 'kardex', 'contactos'];
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
      {/* Top Header */}
      <header className="gestion-header">
        <div className="gestion-header-inner">
          <a href="#/gestion" className="gestion-brand">
            <div className="gestion-brand-logo">
              {/* Isotipo oficial AIRO (La Flor geométrica / estilo flor de loto) */}
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

          <div className="gestion-header-actions">
            <div className="gestion-operator-pill" title={`Autenticado como: ${currentUserEmail}`}>
              <span className="dot" />
              <span>{currentUserEmail}</span>
              <span
                className="g-badge"
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 7px',
                  background: 'rgba(26, 66, 149, 0.12)',
                  color: 'var(--blue)',
                }}
              >
                {rolDef.nombre}
              </span>
            </div>
            <button
              className="gestion-btn-header-back"
              onClick={() => setActiveTab('perfil')}
              title="Cambiar mi contraseña personal"
              style={{ cursor: 'pointer' }}
            >
              🔑 Mi Contraseña
            </button>
            <a href="#/admin" className="gestion-btn-header-back" title="Ir al Administrador de Catálogo y Leads">
              Catálogo / Leads
            </a>
            <a href="#/" className="gestion-btn-header-back" title="Ver sitio público">
              ← Ver sitio
            </a>
            <button
              className="gestion-btn-header-logout"
              onClick={() => onSignOut()}
              title="Cerrar sesión segura de administrador"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Tabs de Navegación Principal con formato de filtros del Catálogo */}
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
                📦 Productos en Stock
                <span className="gestion-tab-badge">
                  {prods.length} {prodsAlert > 0 ? `(${prodsAlert} ⚠️)` : ''}
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
                🧵 Insumos & Materiales
                <span className="gestion-tab-badge">
                  {mats.length} {matsAlert > 0 ? `(${matsAlert} ⚠️)` : ''}
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
                📄 Confección de Remitos
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
                💰 Flujo de Caja
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
                📊 Kardex
              </button>
            )}

            {(isAdmin || isModuloPermitido(currentRol, 'contactos')) && (
              <button
                role="tab"
                aria-selected={activeTab === 'contactos'}
                className={`gestion-tab-btn ${activeTab === 'contactos' ? 'active' : ''}`}
                onClick={() => setActiveTab('contactos')}
              >
                👥 Contactos B2B
              </button>
            )}

            {isAdmin && (
              <button
                role="tab"
                aria-selected={activeTab === 'usuarios'}
                className={`gestion-tab-btn ${activeTab === 'usuarios' ? 'active' : ''}`}
                onClick={() => setActiveTab('usuarios')}
              >
                🛡️ Usuarios & Roles
              </button>
            )}

            {isAdmin && (
              <button
                role="tab"
                aria-selected={activeTab === 'configuracion'}
                className={`gestion-tab-btn ${activeTab === 'configuracion' ? 'active' : ''}`}
                onClick={() => setActiveTab('configuracion')}
              >
                ⚙️ Sincronización
              </button>
            )}

            <button
              role="tab"
              aria-selected={activeTab === 'perfil'}
              className={`gestion-tab-btn ${activeTab === 'perfil' ? 'active' : ''}`}
              onClick={() => setActiveTab('perfil')}
            >
              🔑 Mi Contraseña
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
