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
} from './services/storageService';

import GestionAuthGuard from './components/GestionAuthGuard';
import InventarioProductos from './components/InventarioProductos';
import InventarioMateriales from './components/InventarioMateriales';
import RemitosModule from './components/RemitosModule';
import FlujoCajaModule from './components/FlujoCajaModule';
import MovimientosKardex from './components/MovimientosKardex';
import ContactosModule from './components/ContactosModule';
import ConfiguracionModule from './components/ConfiguracionModule';

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

  // Inicializar storage y suscripciones reactivas
  useEffect(() => {
    initializeStorageIfEmpty();
    const unsubscribe = subscribeToSync(() => {
      setOperador(session?.user?.email || getOperadorActual());
      setRefreshKey((k) => k + 1);
    });
    return () => unsubscribe();
  }, [session]);

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
              <h1>AIRO COLOR LAB.</h1>
              <div className="gestion-brand-tagline">
                Sistema Operativo de Gestión B2B · Inventario, Remitos & Caja
              </div>
            </div>
          </a>

          <div className="gestion-header-actions">
            <div className="gestion-operator-pill" title={`Autenticado como: ${session?.user?.email || operador}`}>
              <span className="dot" />
              <span>{session?.user?.email || operador}</span>
            </div>
            <a href="#/admin" className="gestion-btn-header-back" title="Ir al Administrador de Catálogo y Leads">
              Catálogo / Leads
            </a>
            <a href="#/" className="gestion-btn-header-back" title="Ver sitio público">
              Sitio Web
            </a>
            <button
              className="gestion-btn-header-logout"
              onClick={() => onSignOut()}
              title="Cerrar sesión segura de administrador"
            >
              🔒 Salir
            </button>
          </div>
        </div>
      </header>

      {/* Tabs de Navegación Principal */}
      <nav className="gestion-nav-tabs" aria-label="Secciones de gestión">
        <div className="gestion-nav-tabs-inner">
          <button
            className={`gestion-tab-btn ${activeTab === 'productos' ? 'active' : ''}`}
            onClick={() => setActiveTab('productos')}
          >
            📦 Productos en Stock
            <span className="gestion-tab-badge">
              {prods.length} {prodsAlert > 0 ? `(${prodsAlert} ⚠️)` : ''}
            </span>
          </button>

          <button
            className={`gestion-tab-btn ${activeTab === 'materiales' ? 'active' : ''}`}
            onClick={() => setActiveTab('materiales')}
          >
            🧵 Insumos & Materiales
            <span className="gestion-tab-badge">
              {mats.length} {matsAlert > 0 ? `(${matsAlert} ⚠️)` : ''}
            </span>
          </button>

          <button
            className={`gestion-tab-btn ${activeTab === 'remitos' ? 'active' : ''}`}
            onClick={() => setActiveTab('remitos')}
          >
            📄 Confección de Remitos
            <span className="gestion-tab-badge">
              {rems.length} {remsPendientes > 0 ? `(${remsPendientes} despachados)` : ''}
            </span>
          </button>

          <button
            className={`gestion-tab-btn ${activeTab === 'caja' ? 'active' : ''}`}
            onClick={() => setActiveTab('caja')}
          >
            💰 Flujo de Caja
            <span className="gestion-tab-badge" style={{ background: balanceCaja >= 0 ? '#10b981' : '#ef4444', color: '#fff' }}>
              ${balanceCaja.toLocaleString('es-AR')}
            </span>
          </button>

          <button
            className={`gestion-tab-btn ${activeTab === 'kardex' ? 'active' : ''}`}
            onClick={() => setActiveTab('kardex')}
          >
            📊 Movimientos (Kardex)
          </button>

          <button
            className={`gestion-tab-btn ${activeTab === 'contactos' ? 'active' : ''}`}
            onClick={() => setActiveTab('contactos')}
          >
            👥 Clientes & Proveedores
          </button>

          <button
            className={`gestion-tab-btn ${activeTab === 'configuracion' ? 'active' : ''}`}
            onClick={() => setActiveTab('configuracion')}
          >
            ⚙️ Equipo & Sincronización
          </button>
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

        {activeTab === 'configuracion' && (
          <ConfiguracionModule onDataReload={triggerRefresh} />
        )}
      </main>
    </div>
  );
}
