import { useState, useMemo } from 'react';
import {
  DTF_PRESETS,
  calculateDtfQuote,
  getDtfQuotes,
  getNextDtfQuoteCode,
  saveDtfQuote,
  deleteDtfQuote,
  getProductos,
  getLeads,
  saveLead,
} from '../services/storageService';
import {
  IconRuler,
  IconPlus,
  IconTrash,
  IconCheck,
  IconPrinter,
  IconBriefcase,
  IconLayers,
} from './Icons';
import PresupuestoPrintView from './PresupuestoPrintView';

const PIECE_COLORS = [
  '#1a4295',
  '#00b4d8',
  '#2d5bc4',
  '#0f766e',
  '#4338ca',
  '#0369a1',
  '#1d4ed8',
  '#0e7490',
];

const PRESET_LIST = Object.values(DTF_PRESETS);

const DEFAULT_KIT_PIECES = [
  { id: 'DORSO', name: 'Dorso Principal', width: 22, height: 22, qtyPerGarment: 1, color: '#1a4295' },
  { id: 'FRENTE', name: 'Frente Escudo', width: 8, height: 8, qtyPerGarment: 1, color: '#00b4d8' },
  { id: 'TALLE', name: 'Etiqueta Talle Cuello', width: 5, height: 5, qtyPerGarment: 1, color: '#2d5bc4' },
];

export default function CotizadorDtfModule({ onNavigateTab, onStockChange }) {
  const [quotes, setQuotes] = useState(() => getDtfQuotes());
  const [productos] = useState(() => getProductos());
  const [leads] = useState(() => getLeads());

  // Vista activa: 'calculator' | 'history' | 'print'
  const [subTab, setSubTab] = useState('calculator');
  const [printQuote, setPrintQuote] = useState(null);
  const [notice, setNotice] = useState(null);

  // Parámetros del cotizador 2D MaxRects
  const [modo, setModo] = useState('KIT_PRENDA');
  const [presetId, setPresetId] = useState('BOBINA_60');
  const [rollWidthCm, setRollWidthCm] = useState(58);
  const [pricePerMeterArs, setPricePerMeterArs] = useState(25000);
  const [demanda, setDemanda] = useState(20);
  const [selectedProdId, setSelectedProdId] = useState('');
  const [prendaNombre, setPrendaNombre] = useState('Remera Corporativa Oversize 24/1 Peinado');
  const [garmentBaseCost, setGarmentBaseCost] = useState(8500);
  const [marginPct, setMarginPct] = useState(40);

  // Datos del cliente B2B
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [clienteEmpresa, setClienteEmpresa] = useState('');
  const [clienteContacto, setClienteContacto] = useState('');
  const [clienteWhatsapp, setClienteWhatsapp] = useState('');
  const [notas, setNotas] = useState(
    'Pedido mínimo 10 unidades (múltiplos de 10). Precios por cotización según pliego DTF optimizado. Respuesta comercial < 24 h hábiles.'
  );

  // Piezas de estampa
  const [piezas, setPiezas] = useState(DEFAULT_KIT_PIECES);

  const showNotice = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  // Cambio de preset de bobina
  const handleSelectPreset = (newPresetId) => {
    setPresetId(newPresetId);
    const found = PRESET_LIST.find((p) => p.id === newPresetId);
    if (found) {
      setRollWidthCm(found.usableWidthCm);
    }
  };

  // Selección de prenda del inventario
  const handleSelectProducto = (prodId) => {
    setSelectedProdId(prodId);
    const found = productos.find((p) => p.id === prodId);
    if (found) {
      setPrendaNombre(found.nombre);
      setGarmentBaseCost(Number(found.costo_unitario) || 0);
    }
  };

  // Selección de lead existente del CRM
  const handleSelectLead = (leadId) => {
    setSelectedLeadId(leadId);
    const found = leads.find((l) => l.lead_id === leadId);
    if (found) {
      setClienteEmpresa(found.company || '');
      setClienteContacto(found.contact || found.contact_name || '');
      setClienteWhatsapp(found.phone || '');
    }
  };

  // Normalizar demanda a múltiplos de 10 (mínimo 10)
  const handleChangeDemanda = (rawVal) => {
    const num = Math.max(10, Number(rawVal) || 10);
    setDemanda(num);
  };

  const handleSnapDemandaMultiplo10 = () => {
    const snapped = Math.max(10, Math.ceil(demanda / 10) * 10);
    setDemanda(snapped);
  };

  // Gestión de piezas del kit
  const handleAddPiece = () => {
    const nextIdx = piezas.length + 1;
    setPiezas((prev) => [
      ...prev,
      {
        id: `PZ-${nextIdx}`,
        name: `Estampa #${nextIdx}`,
        width: 10,
        height: 10,
        qtyPerGarment: 1,
        color: PIECE_COLORS[(nextIdx - 1) % PIECE_COLORS.length],
      },
    ]);
  };

  const handleUpdatePiece = (id, field, val) => {
    setPiezas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  const handleRemovePiece = (id) => {
    if (piezas.length <= 1) return;
    setPiezas((prev) => prev.filter((p) => p.id !== id));
  };

  // Cálculo reactivo con el motor MaxRects-BSSF
  const quoteCalculation = useMemo(() => {
    return calculateDtfQuote({
      modo,
      pieces: piezas,
      demandGarments: demanda,
      rollWidthCm,
      sheetLengthCm: 100,
      gapCm: 0.4,
      marginCm: 0.5,
      pricePerMeterArs,
      garmentBaseCostArs: modo === 'KIT_PRENDA' ? garmentBaseCost : 0,
      marginPercent: marginPct,
    });
  }, [modo, piezas, demanda, rollWidthCm, pricePerMeterArs, garmentBaseCost, marginPct]);

  // Guardar cotización y opcionalmente abrir PDF
  const handleSaveCurrentQuote = (openPrint = false) => {
    const codigo = getNextDtfQuoteCode(modo);
    const saved = saveDtfQuote({
      codigo,
      fecha: new Date().toISOString().slice(0, 10),
      modo: quoteCalculation.modo,
      titulo: modo === 'KIT_PRENDA' ? prendaNombre : 'Pliego de Impresión DTF por Metro',
      cliente_nombre: clienteContacto.trim() || 'Compras / Marketing',
      cliente_empresa: clienteEmpresa.trim() || 'Cliente Corporativo B2B',
      cliente_whatsapp: clienteWhatsapp.trim() || '',
      lead_id: selectedLeadId || null,
      bobina_ancho_util_cm: rollWidthCm,
      largo_pliego_cm: 100,
      gap_cm: 0.4,
      margen_cm: 0.5,
      precio_metro_dtf: pricePerMeterArs,
      costo_prenda_base: modo === 'KIT_PRENDA' ? garmentBaseCost : 0,
      margen_comercial_pct: marginPct,
      demanda_prendas: quoteCalculation.normalizedDemand,
      prendas_por_metro: quoteCalculation.garmentsPerMeter,
      metros_requeridos: quoteCalculation.metersNeeded,
      aprovechamiento_pct: quoteCalculation.utilizationPct,
      costo_dtf_por_prenda: quoteCalculation.unitDtfCost,
      costo_total_produccion: quoteCalculation.totalProductionCost,
      precio_venta_sugerido_total: quoteCalculation.suggestedTotalSale,
      precio_venta_unitario: quoteCalculation.suggestedUnitSale,
      piezas_kit: piezas,
      estado: 'EMITIDA',
      notas,
    });

    setQuotes(getDtfQuotes());
    if (onStockChange) onStockChange();
    showNotice(`Cotización ${saved.codigo} registrada y auditada con éxito.`);

    if (openPrint) {
      setPrintQuote(saved);
      setSubTab('print');
    }
  };

  // Vincular / Crear Lead en el CRM único con deduplicación
  const handleSyncWithCrm = () => {
    if (!clienteEmpresa.trim() && !clienteContacto.trim()) {
      alert('Ingresá al menos el nombre de la empresa o contacto B2B para sincronizar con el CRM.');
      return;
    }
    const res = saveLead({
      lead_id: selectedLeadId || undefined,
      company: clienteEmpresa.trim() || 'Empresa B2B (Cotizador DTF)',
      contact: clienteContacto.trim() || 'Contacto Comercial',
      phone: clienteWhatsapp.trim(),
      origin: 'COTIZADOR_DTF',
      channel: 'WHATSAPP',
      product: modo === 'KIT_PRENDA' ? prendaNombre : 'Impresión DTF por Metro',
      interest: `${quoteCalculation.normalizedDemand} u. · ${modo === 'KIT_PRENDA' ? prendaNombre : 'Pliego DTF'} (${quoteCalculation.metersNeeded} m DTF)`,
      quantity: quoteCalculation.normalizedDemand,
      status: 'QUOTED',
      score: Math.min(95, 65 + Math.round(quoteCalculation.normalizedDemand / 10) * 3),
      notes: `Cotización DTF (${quoteCalculation.modo}): ${quoteCalculation.normalizedDemand} u. · Total estimado $${quoteCalculation.suggestedTotalSale.toLocaleString('es-AR')} · Aprovechamiento ${quoteCalculation.utilizationPct}%.`,
      forzar_creacion: true,
    });
    if (res.lead) {
      setSelectedLeadId(res.lead.lead_id);
      if (onStockChange) onStockChange();
      showNotice(
        res.type === 'created'
          ? `Nuevo Lead creado en CRM (${res.lead.lead_id}) en estado QUOTED.`
          : `Lead existente actualizado y fusionado en CRM (${res.lead.lead_id}).`
      );
    }
  };

  const handleDeleteSavedQuote = (id) => {
    if (!window.confirm('¿Eliminar esta cotización del historial?')) return;
    deleteDtfQuote(id);
    setQuotes(getDtfQuotes());
  };

  if (subTab === 'print' && printQuote) {
    return (
      <PresupuestoPrintView
        presupuesto={printQuote}
        onVolver={() => setSubTab('calculator')}
      />
    );
  }

  const nesting = quoteCalculation.nesting || {
    binWidth: rollWidthCm,
    binHeight: 100,
    placedPieces: [],
    placedCount: 0,
    utilizationPct: 0,
    usedLengthCm: 50,
  };
  const svgRollWidth = nesting.binWidth;
  const svgRollHeight = 100;

  return (
    <div className="gestion-module">
      {/* Encabezado Canónico AIRO */}
      <div className="gestion-module-header">
        <div>
          <div className="section-eyebrow">
            <span className="num">11</span> Taller Textil & Optimización MaxRects
          </div>
          <h2 className="display section-title">Optimizador 2D y cotizador DTF.</h2>
          <p className="section-sub">
            Motor determinístico de anidamiento 2D (MaxRects-BSSF) para cálculo de metros lineales, costo por prenda completa y emisión de presupuestos oficiales B2B.
          </p>
        </div>

        <div className="gestion-header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className={`g-btn ${subTab === 'calculator' ? 'g-btn-primary' : 'g-btn-outline'}`}
            onClick={() => setSubTab('calculator')}
          >
            <IconRuler size={15} /> Simulador & Pliego 2D
          </button>
          <button
            className={`g-btn ${subTab === 'history' ? 'g-btn-primary' : 'g-btn-outline'}`}
            onClick={() => setSubTab('history')}
          >
            <IconLayers size={15} /> Historial de Cotizaciones ({quotes.length})
          </button>
        </div>
      </div>

      {/* KPIs Operativos */}
      <div className="gestion-kpis">
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Aprovechamiento por Metro</div>
          <div className="gestion-kpi-val">{quoteCalculation.utilizationPct}%</div>
          <div className="gestion-kpi-sub">
            Ancho útil {rollWidthCm} cm · Separación 4 mm
          </div>
        </div>
        <div className="gestion-kpi-card kpi-accent">
          <div className="gestion-kpi-label">Metros Lineales Requeridos</div>
          <div className="gestion-kpi-val">{quoteCalculation.metersNeeded} m</div>
          <div className="gestion-kpi-sub">
            Rinde {quoteCalculation.garmentsPerMeter} {modo === 'KIT_PRENDA' ? 'kits/m' : 'estampas/m'} ({nesting.placedCount} piezas/m)
          </div>
        </div>
        <div className="gestion-kpi-card kpi-success">
          <div className="gestion-kpi-label">Valor Unitario B2B ({quoteCalculation.normalizedDemand} u.)</div>
          <div className="gestion-kpi-val">
            ${quoteCalculation.suggestedUnitSale.toLocaleString('es-AR')}
          </div>
          <div className="gestion-kpi-sub">
            Costo DTF: ${quoteCalculation.unitDtfCost.toLocaleString('es-AR')}/u. · Margen {marginPct}%
          </div>
        </div>
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Presupuesto Total B2B</div>
          <div className="gestion-kpi-val">
            ${quoteCalculation.suggestedTotalSale.toLocaleString('es-AR')}
          </div>
          <div className="gestion-kpi-sub">
            Regla comercial: mín. 10 u., múltiplos de 10
          </div>
        </div>
      </div>

      {notice && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: 'rgba(23, 138, 72, 0.12)',
            border: '1px solid rgba(23, 138, 72, 0.3)',
            color: '#15803d',
            fontSize: '0.84rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <IconCheck size={16} /> {notice}
        </div>
      )}

      {subTab === 'calculator' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(340px, 1.05fr) minmax(360px, 1.15fr)',
            gap: '1.25rem',
            alignItems: 'start',
          }}
        >
          {/* Columna Izquierda: Configuración Técnica, Piezas y Cliente */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Card 1: Modalidad y Rollo */}
            <div
              style={{
                background: '#fff',
                border: '1px solid var(--g-border)',
                borderRadius: '10px',
                padding: '1.25rem',
                boxShadow: 'var(--g-shadow-sm)',
              }}
            >
              <h4 style={{ margin: '0 0 0.85rem', color: 'var(--g-blue)', fontSize: '0.95rem' }}>
                1. Modalidad de Producción & Parámetros de Bobina DTF
              </h4>

              <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
                <button
                  type="button"
                  className={`g-btn ${modo === 'KIT_PRENDA' ? 'g-btn-primary' : 'g-btn-outline'}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setModo('KIT_PRENDA')}
                >
                  Kit de Prenda Completa
                </button>
                <button
                  type="button"
                  className={`g-btn ${modo === 'MONOPIEZA' ? 'g-btn-primary' : 'g-btn-outline'}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setModo('MONOPIEZA')}
                >
                  Monopieza / Pliego Puro
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="g-form-group" style={{ marginBottom: 0 }}>
                  <label>Formato de Bobina DTF</label>
                  <select value={presetId} onChange={(e) => handleSelectPreset(e.target.value)}>
                    {PRESET_LIST.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="g-form-group" style={{ marginBottom: 0 }}>
                  <label>Valor Metro Lineal DTF ($ ARS)</label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={pricePerMeterArs}
                    onChange={(e) => setPricePerMeterArs(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Volumen en múltiplos de 10 */}
              <div style={{ marginTop: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                    Demanda Solicitada (Mín. 10 u. · Múltiplos de 10)
                  </label>
                  <span style={{ fontSize: '0.75rem', color: '#1a4295', fontWeight: 700 }}>
                    Normalizado B2B: {quoteCalculation.normalizedDemand} u.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    value={demanda}
                    onChange={(e) => handleChangeDemanda(e.target.value)}
                    onBlur={handleSnapDemandaMultiplo10}
                    style={{ width: '100px', fontWeight: 700 }}
                  />
                  {[10, 20, 30, 50, 100, 200].map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`g-btn ${quoteCalculation.normalizedDemand === q ? 'g-btn-primary' : 'g-btn-outline'}`}
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      onClick={() => setDemanda(q)}
                    >
                      {q} u.
                    </button>
                  ))}
                </div>
              </div>

              {/* Costo de prenda base si es Kit de Prenda */}
              {modo === 'KIT_PRENDA' && (
                <div
                  style={{
                    marginTop: '1rem',
                    paddingTop: '0.9rem',
                    borderTop: '1px solid var(--g-border)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                  }}
                >
                  {productos.length > 0 && (
                    <div className="g-form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                      <label>Vincular con Prenda en Stock (Opcional)</label>
                      <select
                        value={selectedProdId}
                        onChange={(e) => handleSelectProducto(e.target.value)}
                      >
                        <option value="">— Especificar prenda manualmente —</option>
                        {productos.map((prod) => (
                          <option key={prod.id} value={prod.id}>
                            {prod.sku} — {prod.nombre} (Costo: ${Number(prod.costo_unitario).toLocaleString('es-AR')})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="g-form-group" style={{ marginBottom: 0 }}>
                    <label>Descripción Prenda Base</label>
                    <input
                      type="text"
                      value={prendaNombre}
                      onChange={(e) => setPrendaNombre(e.target.value)}
                    />
                  </div>

                  <div className="g-form-group" style={{ marginBottom: 0 }}>
                    <label>Costo Base Prenda ($ ARS)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={garmentBaseCost}
                      onChange={(e) => setGarmentBaseCost(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
              )}

              <div style={{ marginTop: '0.85rem' }}>
                <div className="g-form-group" style={{ marginBottom: 0 }}>
                  <label>Margen Comercial B2B Objetivo (%): {marginPct}%</label>
                  <input
                    type="range"
                    min="10"
                    max="70"
                    step="5"
                    value={marginPct}
                    onChange={(e) => setMarginPct(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Piezas de Estampa del Kit */}
            <div
              style={{
                background: '#fff',
                border: '1px solid var(--g-border)',
                borderRadius: '10px',
                padding: '1.25rem',
                boxShadow: 'var(--g-shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h4 style={{ margin: 0, color: 'var(--g-blue)', fontSize: '0.95rem' }}>
                  2. Geometría de Piezas a Anidar ({piezas.length})
                </h4>
                <button
                  type="button"
                  className="g-btn g-btn-outline"
                  style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                  onClick={handleAddPiece}
                >
                  <IconPlus size={13} /> Agregar Ubicación
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {piezas.map((pz, idx) => (
                  <div
                    key={pz.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '14px 1.4fr 78px 78px 66px 32px',
                      gap: '0.45rem',
                      alignItems: 'center',
                      background: '#f8fafc',
                      padding: '0.55rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid var(--g-border)',
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: pz.color || PIECE_COLORS[idx % PIECE_COLORS.length],
                        display: 'inline-block',
                      }}
                    />
                    <input
                      type="text"
                      value={pz.name}
                      onChange={(e) => handleUpdatePiece(pz.id, 'name', e.target.value)}
                      placeholder="Ubicación (ej. Dorso)"
                      style={{ fontSize: '0.8rem', padding: '4px 6px' }}
                    />
                    <div>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Ancho (cm)</span>
                      <input
                        type="number"
                        min="1"
                        max="56"
                        step="0.5"
                        value={pz.width}
                        onChange={(e) => handleUpdatePiece(pz.id, 'width', Number(e.target.value) || 1)}
                        style={{ fontSize: '0.8rem', padding: '3px 6px', width: '100%' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Alto (cm)</span>
                      <input
                        type="number"
                        min="1"
                        max="95"
                        step="0.5"
                        value={pz.height}
                        onChange={(e) => handleUpdatePiece(pz.id, 'height', Number(e.target.value) || 1)}
                        style={{ fontSize: '0.8rem', padding: '3px 6px', width: '100%' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>Cant/u.</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={pz.qtyPerGarment}
                        onChange={(e) => handleUpdatePiece(pz.id, 'qtyPerGarment', Number(e.target.value) || 1)}
                        style={{ fontSize: '0.8rem', padding: '3px 6px', width: '100%' }}
                      />
                    </div>
                    <button
                      type="button"
                      className="g-btn g-btn-outline"
                      style={{ padding: '4px', color: '#b91c1c' }}
                      onClick={() => handleRemovePiece(pz.id)}
                      title="Quitar pieza"
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: Vinculación CRM y Emisión Oficial */}
            <div
              style={{
                background: '#fff',
                border: '1px solid var(--g-border)',
                borderRadius: '10px',
                padding: '1.25rem',
                boxShadow: 'var(--g-shadow-sm)',
              }}
            >
              <h4 style={{ margin: '0 0 0.85rem', color: 'var(--g-blue)', fontSize: '0.95rem' }}>
                3. Destinatario B2B & Sincronización con CRM Central
              </h4>

              <div className="g-form-group">
                <label>Vincular con Lead Existente en CRM (Opcional)</label>
                <select
                  value={selectedLeadId}
                  onChange={(e) => handleSelectLead(e.target.value)}
                >
                  <option value="">— Nuevo Cliente / Seleccionar de CRM —</option>
                  {leads.map((l) => (
                    <option key={l.lead_id} value={l.lead_id}>
                      {l.lead_id} · {l.company} ({l.contact || l.contact_name || 'Contacto'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="g-form-group" style={{ marginBottom: 0 }}>
                  <label>Empresa / Marca B2B</label>
                  <input
                    type="text"
                    placeholder="Ej. Estudio Nómada"
                    value={clienteEmpresa}
                    onChange={(e) => setClienteEmpresa(e.target.value)}
                  />
                </div>
                <div className="g-form-group" style={{ marginBottom: 0 }}>
                  <label>Contacto Responsable</label>
                  <input
                    type="text"
                    placeholder="Nombre y Apellido"
                    value={clienteContacto}
                    onChange={(e) => setClienteContacto(e.target.value)}
                  />
                </div>
                <div className="g-form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                  <label>WhatsApp Corporativo</label>
                  <input
                    type="text"
                    placeholder="+54 9 11 ..."
                    value={clienteWhatsapp}
                    onChange={(e) => setClienteWhatsapp(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="g-btn g-btn-primary"
                  onClick={() => handleSaveCurrentQuote(true)}
                >
                  <IconPrinter size={15} /> Emitir Presupuesto PDF Oficial
                </button>
                <button
                  type="button"
                  className="g-btn g-btn-outline"
                  onClick={() => handleSaveCurrentQuote(false)}
                >
                  <IconCheck size={15} /> Guardar en Historial
                </button>
                <button
                  type="button"
                  className="g-btn g-btn-outline"
                  onClick={handleSyncWithCrm}
                >
                  <IconBriefcase size={15} /> Inyectar / Actualizar en CRM
                </button>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Visualizador SVG Interactivo del Pliego Gang Sheet MaxRects */}
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--g-border)',
              borderRadius: '10px',
              padding: '1.25rem',
              boxShadow: 'var(--g-shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h4 style={{ margin: 0, color: 'var(--g-blue)', fontSize: '0.95rem' }}>
                  Mapa de Anidamiento 2D por Metro (Gang Sheet SVG — MaxRects-BSSF)
                </h4>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  Pliego de 100 cm × {rollWidthCm} cm útiles · Rotación 90° automática habilitada
                </div>
              </div>
              <span className="g-badge g-badge-info">
                {quoteCalculation.garmentsPerMeter} {modo === 'KIT_PRENDA' ? 'kits/metro' : 'piezas/metro'}
              </span>
            </div>

            {/* Leyenda de piezas */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '0.85rem', fontSize: '0.75rem' }}>
              {piezas.map((pz, idx) => (
                <span
                  key={pz.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: '#f8fafc',
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--g-border)',
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: pz.color || PIECE_COLORS[idx % PIECE_COLORS.length],
                    }}
                  />
                  <strong>{pz.name}:</strong> {pz.width}×{pz.height} cm
                </span>
              ))}
            </div>

            {/* Contenedor del pliego DTF de 1 metro (100 cm) */}
            <div
              style={{
                background: '#0f172a',
                borderRadius: '8px',
                padding: '1rem',
                maxHeight: '580px',
                overflowY: 'auto',
                border: '1px solid #1e293b',
              }}
            >
              <svg
                viewBox={`0 0 ${svgRollWidth} ${svgRollHeight}`}
                style={{
                  width: '100%',
                  height: 'auto',
                  background: '#1e293b',
                  borderRadius: '4px',
                  display: 'block',
                }}
              >
                {/* Fondo del área útil */}
                <rect x="0.5" y="0.5" width={svgRollWidth - 1} height={svgRollHeight - 1} fill="#0f172a" />

                {/* Líneas guía de márgenes laterales 0.5 cm */}
                <line
                  x1="0.5"
                  y1="0"
                  x2="0.5"
                  y2={svgRollHeight}
                  stroke="#00b4d8"
                  strokeWidth="0.15"
                  strokeDasharray="1 0.6"
                />
                <line
                  x1={svgRollWidth - 0.5}
                  y1="0"
                  x2={svgRollWidth - 0.5}
                  y2={svgRollHeight}
                  stroke="#00b4d8"
                  strokeWidth="0.15"
                  strokeDasharray="1 0.6"
                />

                {/* Piezas posicionadas por MaxRects-BSSF */}
                {(nesting.placedPieces || []).map((rect, i) => {
                  const baseIndex = piezas.findIndex((p) => p.id === rect.baseId);
                  const fillColor =
                    (baseIndex >= 0 && piezas[baseIndex]?.color) ||
                    PIECE_COLORS[(baseIndex >= 0 ? baseIndex : i) % PIECE_COLORS.length];
                  return (
                    <g key={rect.id || i}>
                      <rect
                        x={rect.x}
                        y={rect.y}
                        width={rect.width}
                        height={rect.height}
                        fill={fillColor}
                        fillOpacity="0.88"
                        stroke="#38bdf8"
                        strokeWidth="0.14"
                        rx="0.3"
                      />
                      {rect.width >= 4 && rect.height >= 3 && (
                        <text
                          x={rect.x + rect.width / 2}
                          y={rect.y + rect.height / 2}
                          fill="#ffffff"
                          fontSize={Math.min(1.6, Math.max(0.85, rect.width / 7))}
                          fontWeight="600"
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {String(rect.name || '').slice(0, 10)} {rect.rotated ? '(90°)' : ''}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Línea de fin de uso real dentro del metro */}
                <line
                  x1="0"
                  y1={nesting.usedLengthCm || 99}
                  x2={svgRollWidth}
                  y2={nesting.usedLengthCm || 99}
                  stroke="#22c55e"
                  strokeWidth="0.25"
                />
              </svg>
            </div>
          </div>
        </div>
      ) : (
        /* Pestaña de Historial de Cotizaciones DTF */
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--g-border)',
            borderRadius: '10px',
            padding: '1.25rem',
            boxShadow: 'var(--g-shadow-sm)',
          }}
        >
          <h4 style={{ margin: '0 0 1rem', color: 'var(--g-blue)' }}>
            Historial de Cotizaciones DTF & Kits de Prenda ({quotes.length})
          </h4>
          <div className="gestion-table-scroll">
            <table className="gestion-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Fecha</th>
                  <th>Cliente B2B</th>
                  <th>Modalidad / Proyecto</th>
                  <th>Demanda</th>
                  <th>Metros DTF</th>
                  <th>Unitario B2B</th>
                  <th>Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{q.codigo}</td>
                    <td>{q.fecha}</td>
                    <td>
                      <strong>{q.cliente_empresa}</strong>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {q.cliente_nombre || q.cliente_contacto}
                      </div>
                    </td>
                    <td>
                      <span className="g-badge g-badge-neutral">
                        {q.modo === 'KIT_PRENDA' ? 'Kit Prenda' : 'Monopieza'}
                      </span>{' '}
                      <span style={{ fontSize: '0.8rem' }}>{q.titulo || q.prenda_nombre}</span>
                    </td>
                    <td style={{ fontWeight: 700 }}>{q.demanda_prendas || q.demanda} u.</td>
                    <td>
                      {q.metros_requeridos || 1} m ({q.aprovechamiento_pct || 0}%)
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      ${Number(q.precio_venta_unitario || q.unit_price || 0).toLocaleString('es-AR')}
                    </td>
                    <td style={{ fontWeight: 800, color: '#1a4295' }}>
                      ${Number(q.precio_venta_sugerido_total || q.total_quote || 0).toLocaleString('es-AR')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="g-btn g-btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => {
                            setPrintQuote(q);
                            setSubTab('print');
                          }}
                        >
                          <IconPrinter size={13} /> PDF
                        </button>
                        <button
                          className="g-btn g-btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#b91c1c' }}
                          onClick={() => handleDeleteSavedQuote(q.id)}
                        >
                          <IconTrash size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
