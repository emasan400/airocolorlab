import { useState, useMemo, useEffect } from 'react';
import {
  getApprovals,
  decideApproval,
  resetApprovals,
  getEditorialCalendar,
  saveCalendarEntry,
  updateCalendarEntryStatus,
  resetEditorialCalendar,
  getAgentRegistry,
  classifyAndGenerateCmResponse,
  convertCmInteractionToLead,
  getOperadorActual,
} from '../services/storageService';

export default function MarketingModule({ onContentChanged }) {
  const [activeSubTab, setActiveSubTab] = useState('approvals'); // 'approvals' | 'calendar' | 'cm' | 'agents'
  const [approvals, setApprovals] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('ALL');
  const [filterCalChannel, setFilterCalChannel] = useState('ALL');
  const [filterCalStatus, setFilterCalStatus] = useState('ALL');
  const [filterAgentModule, setFilterAgentModule] = useState('ALL');

  // Estados del Asistente Community Manager
  const [cmChannel, setCmChannel] = useState('WHATSAPP');
  const [cmInputMessage, setCmInputMessage] = useState(
    'Hola! Cuánto nos saldrían 25 buzos friza con estampa DTF en frente y espalda para nuestro equipo de diseño?'
  );
  const [cmAnalysis, setCmAnalysis] = useState(null);
  const [cmExtraPhone, setCmExtraPhone] = useState('');
  const [cmExtraEmail, setCmExtraEmail] = useState('');
  const [cmExtraCompany, setCmExtraCompany] = useState('');
  const [cmExtraContact, setCmExtraContact] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(null);
  const [injectFeedback, setInjectFeedback] = useState(null);

  // Modal para nueva idea de calendario
  const [modalNewIdea, setModalNewIdea] = useState({ open: false, data: {} });
  // Modal para decisión HITL con observaciones
  const [modalDecision, setModalDecision] = useState({ open: false, approval: null, decision: 'APPROVED', notes: '' });

  const reloadData = () => {
    setApprovals(getApprovals());
    setCalendar(getEditorialCalendar());
    if (onContentChanged) onContentChanged();
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Métricas rápidas
  const pendingApprovalsCount = approvals.filter((a) => a.estado === 'PENDING').length;
  const totalCalendarEntries = calendar.length;
  const approvedEntriesCount = calendar.filter((c) => c.status === 'APPROVED' || c.status === 'PUBLISHED').length;

  // Filtrado de Aprobaciones
  const filteredApprovals = useMemo(() => {
    if (filterApprovalStatus === 'ALL') return approvals;
    return approvals.filter((a) => a.estado === filterApprovalStatus);
  }, [approvals, filterApprovalStatus]);

  // Filtrado de Calendario
  const filteredCalendar = useMemo(() => {
    return calendar.filter((c) => {
      const matchChan = filterCalChannel === 'ALL' || c.channel === filterCalChannel;
      const matchStat = filterCalStatus === 'ALL' || c.status === filterCalStatus;
      return matchChan && matchStat;
    });
  }, [calendar, filterCalChannel, filterCalStatus]);

  // Filtrado de Agentes
  const agentsList = useMemo(() => {
    const list = getAgentRegistry();
    if (filterAgentModule === 'ALL') return list;
    return list.filter((a) => a.module === filterAgentModule);
  }, [filterAgentModule]);

  // Manejador de copia al portapapeles
  const handleCopyText = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(`¡${label} copiado al portapapeles!`);
      setTimeout(() => setCopyFeedback(null), 3000);
    });
  };

  // Ejecutar análisis de Community Manager
  const handleRunCmAnalysis = (customMsg = null, customChan = null) => {
    const msg = customMsg !== null ? customMsg : cmInputMessage;
    const chan = customChan !== null ? customChan : cmChannel;
    if (!msg.trim()) return;

    const res = classifyAndGenerateCmResponse(msg, chan);
    setCmAnalysis(res);
    setCmExtraCompany(res.extractedData.company || '');
    setCmExtraContact(res.extractedData.contact || `Contacto ${chan}`);
    setInjectFeedback(null);
  };

  // Derivar interacción a CRM
  const handleInjectToCrm = () => {
    if (!cmAnalysis) return;
    try {
      const payload = {
        ...cmAnalysis,
        extractedData: {
          ...cmAnalysis.extractedData,
          company: cmExtraCompany || cmAnalysis.extractedData.company,
          contact: cmExtraContact || cmAnalysis.extractedData.contact,
          phone: cmExtraPhone,
          email: cmExtraEmail,
        },
      };
      const res = convertCmInteractionToLead(payload);
      setInjectFeedback({
        ok: true,
        type: res.type,
        leadId: res.lead.lead_id,
        message: `Lead ${res.lead.lead_id} ${res.type === 'merged' ? 'fusionado con éxito por coincidencia' : 'creado con éxito'} en el CRM central.`,
      });
      reloadData();
    } catch (err) {
      setInjectFeedback({ ok: false, message: `Error: ${err.message}` });
    }
  };

  // Confirmar decisión HITL
  const handleConfirmDecision = () => {
    if (!modalDecision.approval) return;
    try {
      decideApproval(
        modalDecision.approval.id,
        modalDecision.decision,
        modalDecision.notes
      );
      setModalDecision({ open: false, approval: null, decision: 'APPROVED', notes: '' });
      reloadData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Crear nueva idea en calendario
  const handleSaveNewIdea = (e) => {
    e.preventDefault();
    try {
      saveCalendarEntry(modalNewIdea.data);
      setModalNewIdea({ open: false, data: {} });
      reloadData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="gestion-container">
      {/* Toast de Feedback */}
      {copyFeedback && (
        <div className="g-alert g-alert-success" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, boxShadow: 'var(--g-shadow-md)' }}>
          {copyFeedback}
        </div>
      )}

      {/* Header del Módulo */}
      <div className="gestion-module-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="section-eyebrow">04 · SISTEMA MULTIAGENTE & MARKETING B2B</div>
          <h2 className="display" style={{ fontSize: '1.75rem', margin: '4px 0 6px' }}>
            Agentes & Community Manager AIRO
          </h2>
          <p style={{ color: 'var(--ink-70)', fontSize: '0.92rem', margin: 0, maxWidth: 740 }}>
            Supervisión humana <strong>HITL</strong> de contenidos, calendario editorial y clasificación asistida de
            consultas para inyección automática en el CRM B2B. Modo de ejecución: <em>assisted-total</em>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn--secondary"
            onClick={() => {
              if (confirm('¿Restablecer las aprobaciones y calendario a las piezas oficiales de AIRO?')) {
                resetApprovals();
                resetEditorialCalendar();
                reloadData();
              }
            }}
            title="Recargar piezas iniciales de AIRO"
            style={{ fontSize: '0.82rem', padding: '8px 14px' }}
          >
            Recargar Datos Oficiales
          </button>
        </div>
      </div>

      {/* KPIs Editoriales Rápidos */}
      <div className="gestion-kpi-grid" style={{ marginBottom: 24 }}>
        <div className="gestion-kpi-card">
          <div className="kpi-label">Cola HITL Pendiente</div>
          <div className="kpi-value" style={{ color: pendingApprovalsCount > 0 ? '#b45309' : 'var(--blue)' }}>
            {pendingApprovalsCount}
          </div>
          <div className="kpi-subtext">Piezas en espera de aprobación humana</div>
        </div>

        <div className="gestion-kpi-card">
          <div className="kpi-label">Calendario Editorial</div>
          <div className="kpi-value">{totalCalendarEntries}</div>
          <div className="kpi-subtext">{approvedEntriesCount} aprobadas / publicadas</div>
        </div>

        <div className="gestion-kpi-card">
          <div className="kpi-label">Agentes Registrados</div>
          <div className="kpi-value" style={{ color: 'var(--cyan-ink)' }}>26</div>
          <div className="kpi-subtext">5 módulos + Orquestador + Transversales</div>
        </div>

        <div className="gestion-kpi-card">
          <div className="kpi-label">Voz de Marca & Reglas</div>
          <div className="kpi-value" style={{ fontSize: '1.25rem', color: '#15803d' }}>
            Voseo B2B
          </div>
          <div className="kpi-subtext">Mín. 10 u · CTA WhatsApp · QA PASS</div>
        </div>
      </div>

      {/* Sub-navegación por Pestañas (Sin Emojis) */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 12, marginBottom: 24 }}>
        <button
          className={`gestion-tab-btn ${activeSubTab === 'approvals' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('approvals')}
          style={{ fontSize: '0.88rem' }}
        >
          Cola de Aprobaciones HITL
          {pendingApprovalsCount > 0 && (
            <span className="gestion-tab-badge" style={{ background: 'rgba(180, 83, 9, 0.15)', color: '#b45309' }}>
              {pendingApprovalsCount} pend.
            </span>
          )}
        </button>

        <button
          className={`gestion-tab-btn ${activeSubTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('calendar')}
          style={{ fontSize: '0.88rem' }}
        >
          Calendario Editorial ({totalCalendarEntries})
        </button>

        <button
          className={`gestion-tab-btn ${activeSubTab === 'cm' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('cm')}
          style={{ fontSize: '0.88rem' }}
        >
          Asistente Community Manager & CRM
        </button>

        <button
          className={`gestion-tab-btn ${activeSubTab === 'agents' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('agents')}
          style={{ fontSize: '0.88rem' }}
        >
          Directorio de Agentes (26)
        </button>
      </div>

      {/* ========================================================
          SUB-PESTAÑA 1: COLA DE APROBACIONES HITL
         ======================================================== */}
      {activeSubTab === 'approvals' && (
        <div>
          {/* Barra de Filtros */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  className={`btn--pill ${filterApprovalStatus === st ? 'active' : ''}`}
                  onClick={() => setFilterApprovalStatus(st)}
                  style={{
                    fontSize: '0.8rem',
                    padding: '6px 14px',
                    borderRadius: 'var(--r-pill)',
                    border: '1px solid var(--line)',
                    background: filterApprovalStatus === st ? 'var(--blue)' : 'var(--neutral)',
                    color: filterApprovalStatus === st ? '#ffffff' : 'var(--ink)',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {st === 'ALL' && 'Todas'}
                  {st === 'PENDING' && `Pendientes (${approvals.filter((a) => a.estado === 'PENDING').length})`}
                  {st === 'APPROVED' && `Aprobadas (${approvals.filter((a) => a.estado === 'APPROVED').length})`}
                  {st === 'REJECTED' && `Rechazadas (${approvals.filter((a) => a.estado === 'REJECTED').length})`}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--ink-70)' }}>
              Mostrando {filteredApprovals.length} paquete(s) de aprobación
            </div>
          </div>

          {filteredApprovals.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--ink-70)' }}>
              <p style={{ margin: 0 }}>No hay aprobaciones en el estado seleccionado.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {filteredApprovals.map((appr) => (
                <div
                  key={appr.id}
                  className="card"
                  style={{
                    border: appr.estado === 'PENDING' ? '1px solid rgba(180, 83, 9, 0.4)' : '1px solid var(--line)',
                    borderRadius: 'var(--r-m)',
                    padding: '24px',
                    boxShadow: 'var(--g-shadow-sm)',
                    background: '#ffffff',
                  }}
                >
                  {/* Encabezado del Paquete */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <span className="g-badge" style={{ background: 'var(--neutral)', color: 'var(--blue)', fontWeight: 700 }}>
                          {appr.id}
                        </span>
                        <span
                          className="g-badge"
                          style={{
                            background: appr.hitl_level === 3 ? 'rgba(192, 57, 43, 0.12)' : 'rgba(26, 66, 149, 0.12)',
                            color: appr.hitl_level === 3 ? '#c0392b' : 'var(--blue)',
                            fontWeight: 600,
                          }}
                        >
                          {appr.hitl_tag}
                        </span>
                        <span className="g-badge g-badge-success" title="Validado por QA X-03">
                          QA: {appr.qa_status}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--ink-45)' }}>
                          Creado: {appr.fecha} · Ref: {appr.audit_ref}
                        </span>
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--ink)' }}>{appr.titulo}</h3>
                      <div style={{ fontSize: '0.85rem', color: 'var(--ink-70)', marginTop: 4 }}>
                        Producido por: <strong>{appr.autor}</strong>
                      </div>
                    </div>

                    {/* Estado y Acciones HITL */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {appr.estado === 'PENDING' ? (
                        <>
                          <button
                            className="btn--secondary"
                            onClick={() => setModalDecision({ open: true, approval: appr, decision: 'REJECTED', notes: '' })}
                            style={{ fontSize: '0.82rem', padding: '6px 14px', color: '#c0392b' }}
                          >
                            Rechazar
                          </button>
                          <button
                            className="btn--primary"
                            onClick={() => setModalDecision({ open: true, approval: appr, decision: 'APPROVED', notes: '' })}
                            style={{ fontSize: '0.82rem', padding: '6px 16px' }}
                          >
                            Aprobar para Publicación
                          </button>
                        </>
                      ) : (
                        <div
                          style={{
                            padding: '6px 14px',
                            borderRadius: 'var(--r-pill)',
                            background: appr.estado === 'APPROVED' ? 'rgba(34, 177, 94, 0.15)' : 'rgba(192, 57, 43, 0.15)',
                            color: appr.estado === 'APPROVED' ? '#178a48' : '#c0392b',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                          }}
                        >
                          {appr.estado === 'APPROVED' ? 'Aprobado' : 'Rechazado'} por {appr.decision_by || 'Admin'}
                          {appr.decision_at && ` (${appr.decision_at.slice(0, 10)})`}
                        </div>
                      )}
                    </div>
                  </div>

                  {appr.qa_detalles && (
                    <div style={{ background: 'var(--neutral)', padding: '10px 14px', borderRadius: 'var(--r-s)', fontSize: '0.82rem', color: 'var(--ink-70)', marginBottom: 16 }}>
                      {appr.qa_detalles}
                    </div>
                  )}

                  {/* Listado de Piezas en el Paquete */}
                  {Array.isArray(appr.piezas) && appr.piezas.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <h4 style={{ margin: '8px 0 4px', fontSize: '0.92rem', color: 'var(--ink-70)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Piezas listas para publicación:
                      </h4>

                      {appr.piezas.map((pz, idx) => (
                        <div
                          key={pz.id || idx}
                          style={{
                            border: '1px solid var(--line)',
                            borderRadius: 'var(--r-s)',
                            padding: '16px',
                            background: '#fafbfc',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span className="g-badge" style={{ background: 'var(--blue)', color: '#ffffff', fontWeight: 600 }}>
                                {pz.canal}
                              </span>
                              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{pz.formato}</span>
                              <span style={{ fontSize: '0.85rem', color: 'var(--ink-70)' }}>— {pz.idea}</span>
                            </div>
                            {pz.caption && (
                              <button
                                className="btn--secondary"
                                onClick={() => handleCopyText(pz.caption, `Copy ${pz.canal}`)}
                                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                              >
                                Copiar Copy
                              </button>
                            )}
                          </div>

                          {/* Slides / Pantallas */}
                          {Array.isArray(pz.slides) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                              {pz.slides.map((sl, sIdx) => (
                                <div
                                  key={sIdx}
                                  style={{
                                    fontSize: '0.85rem',
                                    background: '#ffffff',
                                    border: '1px solid var(--line)',
                                    borderRadius: '6px',
                                    padding: '8px 12px',
                                    fontFamily: 'monospace',
                                    color: 'var(--ink)',
                                  }}
                                >
                                  {sl}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Caption completo */}
                          {pz.caption && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink-70)', marginBottom: 4 }}>
                                Caption oficial (Voseo rioplatense + hashtags):
                              </div>
                              <pre
                                style={{
                                  margin: 0,
                                  whiteSpace: 'pre-wrap',
                                  fontSize: '0.82rem',
                                  background: '#ffffff',
                                  border: '1px solid var(--line)',
                                  borderRadius: '6px',
                                  padding: '10px 12px',
                                  color: 'var(--ink)',
                                  maxHeight: '160px',
                                  overflowY: 'auto',
                                }}
                              >
                                {pz.caption}
                              </pre>
                            </div>
                          )}

                          {/* CTA oficial */}
                          {pz.cta && (
                            <div style={{ fontSize: '0.82rem', color: 'var(--cyan-ink)', fontWeight: 600 }}>
                              CTA: {pz.cta}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          SUB-PESTAÑA 2: CALENDARIO EDITORIAL
         ======================================================== */}
      {activeSubTab === 'calendar' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <select
                className="g-input"
                value={filterCalChannel}
                onChange={(e) => setFilterCalChannel(e.target.value)}
                style={{ width: '180px', fontSize: '0.85rem', padding: '6px 10px' }}
              >
                <option value="ALL">Todos los canales</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="LINKEDIN">LinkedIn</option>
                <option value="WHATSAPP_STATUS">WhatsApp Estados</option>
                <option value="EMAIL">Gmail B2B</option>
              </select>

              <select
                className="g-input"
                value={filterCalStatus}
                onChange={(e) => setFilterCalStatus(e.target.value)}
                style={{ width: '180px', fontSize: '0.85rem', padding: '6px 10px' }}
              >
                <option value="ALL">Todos los estados</option>
                <option value="PENDING_APPROVAL">En Aprobación</option>
                <option value="APPROVED">Aprobadas</option>
                <option value="PUBLISHED">Publicadas</option>
                <option value="DRAFT">Borradores</option>
                <option value="IDEA">Ideas</option>
              </select>
            </div>

            <button
              className="btn--primary"
              onClick={() => setModalNewIdea({ open: true, data: { channel: 'INSTAGRAM', format: 'Post carrusel', status: 'IDEA' } })}
              style={{ fontSize: '0.85rem', padding: '8px 16px' }}
            >
              Proponer Nueva Pieza
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Canal</th>
                  <th>Fecha</th>
                  <th>Idea & Objetivo</th>
                  <th>Formato</th>
                  <th>CTA / KPI</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalendar.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '28px', color: 'var(--ink-70)' }}>
                      No se encontraron piezas para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredCalendar.map((item) => (
                    <tr key={item.content_id}>
                      <td style={{ fontWeight: 600, fontSize: '0.82rem', fontFamily: 'monospace' }}>
                        {item.content_id}
                      </td>
                      <td>
                        <span
                          className="g-badge"
                          style={{
                            background:
                              item.channel === 'INSTAGRAM'
                                ? 'rgba(26, 66, 149, 0.12)'
                                : item.channel === 'LINKEDIN'
                                ? 'rgba(14, 116, 144, 0.12)'
                                : 'rgba(34, 177, 94, 0.12)',
                            color:
                              item.channel === 'INSTAGRAM'
                                ? 'var(--blue)'
                                : item.channel === 'LINKEDIN'
                                ? 'var(--cyan-ink)'
                                : '#15803d',
                            fontWeight: 600,
                          }}
                        >
                          {item.channel}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--ink-70)' }}>
                        {item.proposed_date || 'Sin fecha'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.idea}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--ink-70)' }}>{item.objective}</div>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{item.format}</td>
                      <td style={{ fontSize: '0.82rem' }}>
                        <div><strong>CTA:</strong> {item.cta || 'WhatsApp'}</div>
                        <div style={{ color: 'var(--ink-70)', fontSize: '0.75rem' }}>{item.kpi}</div>
                      </td>
                      <td>
                        <span
                          className="g-badge"
                          style={{
                            background:
                              item.status === 'PUBLISHED'
                                ? 'rgba(34, 177, 94, 0.18)'
                                : item.status === 'APPROVED'
                                ? 'rgba(14, 116, 144, 0.18)'
                                : item.status === 'PENDING_APPROVAL'
                                ? 'rgba(180, 83, 9, 0.18)'
                                : 'var(--neutral)',
                            color:
                              item.status === 'PUBLISHED'
                                ? '#15803d'
                                : item.status === 'APPROVED'
                                ? 'var(--cyan-ink)'
                                : item.status === 'PENDING_APPROVAL'
                                ? '#b45309'
                                : 'var(--ink)',
                            fontWeight: 600,
                          }}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td>
                        {item.status === 'APPROVED' && (
                          <button
                            className="btn--secondary"
                            onClick={() => {
                              updateCalendarEntryStatus(item.content_id, 'PUBLISHED');
                              reloadData();
                            }}
                            title="Marcar como publicado en redes"
                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          >
                            Marcar Publicado
                          </button>
                        )}
                        {item.status === 'IDEA' && (
                          <button
                            className="btn--secondary"
                            onClick={() => {
                              updateCalendarEntryStatus(item.content_id, 'DRAFT');
                              reloadData();
                            }}
                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          >
                            Borrador
                          </button>
                        )}
                        {item.status === 'PUBLISHED' && (
                          <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>Publicado</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-PESTAÑA 3: ASISTENTE COMMUNITY MANAGER & CRM
         ======================================================== */}
      {activeSubTab === 'cm' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Columna Izquierda: Entrada y Clasificador */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.15rem' }}>
              Simulador de Interacción & Clasificación Asistida
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-70)', marginBottom: 16 }}>
              Ingresá una consulta real o simulada para que los agentes <strong>I-06 / W-03</strong> la clasifiquen,
              apliquen las reglas de marca (mínimo 10 u, voseo rioplatense, sin inventar precios) y preparen la ficha
              para el CRM.
            </p>

            {/* Selector de Canal */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Canal de Entrada:
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['WHATSAPP', 'INSTAGRAM', 'LINKEDIN'].map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    className={`btn--pill ${cmChannel === ch ? 'active' : ''}`}
                    onClick={() => setCmChannel(ch)}
                    style={{
                      fontSize: '0.8rem',
                      padding: '6px 14px',
                      borderRadius: 'var(--r-pill)',
                      border: '1px solid var(--line)',
                      background: cmChannel === ch ? 'var(--blue)' : 'var(--neutral)',
                      color: cmChannel === ch ? '#ffffff' : 'var(--ink)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {ch === 'WHATSAPP' && 'WhatsApp'}
                    {ch === 'INSTAGRAM' && 'Instagram DM'}
                    {ch === 'LINKEDIN' && 'LinkedIn'}
                  </button>
                ))}
              </div>
            </div>

            {/* Ejemplos Rápidos */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink-70)', marginBottom: 6 }}>
                Pruebas rápidas de situaciones reales:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn--secondary"
                  onClick={() => {
                    const m = 'Hola! Cuánto nos saldrían 25 buzos friza con estampa DTF para nuestra marca?';
                    setCmInputMessage(m);
                    handleRunCmAnalysis(m, cmChannel);
                  }}
                  style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                >
                  25 Buzos DTF
                </button>
                <button
                  type="button"
                  className="btn--secondary"
                  onClick={() => {
                    const m = 'Buenas tardes, somos de una consultora y queremos hacer 80 remeras con logo para un evento fin de mes. Tienen catálogo?';
                    setCmInputMessage(m);
                    handleRunCmAnalysis(m, cmChannel);
                  }}
                  style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                >
                  80 Remeras Evento
                </button>
                <button
                  type="button"
                  className="btn--secondary"
                  onClick={() => {
                    const m = 'Hola qué tal! Hacen 1 remera estampada con una foto para un regalo?';
                    setCmInputMessage(m);
                    handleRunCmAnalysis(m, cmChannel);
                  }}
                  style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                >
                  1 Remera (Bajo Mínimo)
                </button>
                <button
                  type="button"
                  className="btn--secondary"
                  onClick={() => {
                    const m = 'Hola, quería consultar cómo viene la producción de las gorras con remito REM-001 que pedimos.';
                    setCmInputMessage(m);
                    handleRunCmAnalysis(m, cmChannel);
                  }}
                  style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                >
                  Seguimiento de Producción
                </button>
              </div>
            </div>

            {/* Textarea */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Mensaje recibido:
              </label>
              <textarea
                className="g-input"
                rows="4"
                value={cmInputMessage}
                onChange={(e) => setCmInputMessage(e.target.value)}
                placeholder="Pegá o escribí la consulta recibida..."
                style={{ width: '100%', fontSize: '0.88rem', padding: '10px' }}
              />
            </div>

            <button
              className="btn--primary"
              onClick={() => handleRunCmAnalysis()}
              style={{ width: '100%', padding: '10px', fontSize: '0.92rem' }}
            >
              Analizar con Agentes IA (I-06 / W-03)
            </button>
          </div>

          {/* Columna Derecha: Respuesta Asistida & Inyección a CRM */}
          <div className="card" style={{ padding: '24px', background: '#fafbfc' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.15rem' }}>
              Diagnóstico del Agente & Respuesta Asistida
            </h3>

            {!cmAnalysis ? (
              <div style={{ textAlign: 'center', padding: '48px 12px', color: 'var(--ink-70)' }}>
                <p>Hacé clic en "Analizar con Agentes IA" para procesar el mensaje.</p>
              </div>
            ) : (
              <div>
                {/* Diagnóstico */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                  <span
                    className="g-badge"
                    style={{
                      background:
                        cmAnalysis.category === 'LEAD'
                          ? 'rgba(34, 177, 94, 0.18)'
                          : cmAnalysis.category === 'LEAD_UNDER_MIN'
                          ? 'rgba(180, 83, 9, 0.18)'
                          : 'rgba(26, 66, 149, 0.18)',
                      color:
                        cmAnalysis.category === 'LEAD'
                          ? '#15803d'
                          : cmAnalysis.category === 'LEAD_UNDER_MIN'
                          ? '#b45309'
                          : 'var(--blue)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                    }}
                  >
                    {cmAnalysis.categoryLabel}
                  </span>
                  <span className="g-badge g-badge-neutral" style={{ fontSize: '0.78rem' }}>
                    Agente: {cmAnalysis.agentId}
                  </span>
                  <span className="g-badge g-badge-brand" style={{ fontSize: '0.78rem' }}>
                    Confianza: {(cmAnalysis.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Respuesta Sugerida Oficial */}
                <div style={{ background: '#ffffff', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '14px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-70)' }}>
                      Respuesta asistida (Voz AIRO · Voseo Rioplatense):
                    </span>
                    <button
                      className="btn--secondary"
                      onClick={() => handleCopyText(cmAnalysis.proposedResponse, 'Respuesta')}
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                    >
                      Copiar Respuesta
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink)', lineHeight: 1.45 }}>
                    {cmAnalysis.proposedResponse}
                  </p>
                </div>

                {/* Extracción de Datos para CRM */}
                <div style={{ background: '#ffffff', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '14px', marginBottom: 16 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--cyan-ink)', textTransform: 'uppercase' }}>
                    Ficha de Prospecto Detectada (Lead Scoring: {cmAnalysis.extractedData.score}/100)
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-70)', display: 'block' }}>
                        Empresa / Marca:
                      </label>
                      <input
                        type="text"
                        className="g-input"
                        value={cmExtraCompany}
                        onChange={(e) => setCmExtraCompany(e.target.value)}
                        placeholder="Nombre de la empresa"
                        style={{ fontSize: '0.82rem', padding: '5px 8px', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-70)', display: 'block' }}>
                        Contacto:
                      </label>
                      <input
                        type="text"
                        className="g-input"
                        value={cmExtraContact}
                        onChange={(e) => setCmExtraContact(e.target.value)}
                        placeholder="Nombre de contacto"
                        style={{ fontSize: '0.82rem', padding: '5px 8px', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-70)', display: 'block' }}>
                        Teléfono / WhatsApp:
                      </label>
                      <input
                        type="text"
                        className="g-input"
                        value={cmExtraPhone}
                        onChange={(e) => setCmExtraPhone(e.target.value)}
                        placeholder="Ej: 11-6355-3443"
                        style={{ fontSize: '0.82rem', padding: '5px 8px', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-70)', display: 'block' }}>
                        Email:
                      </label>
                      <input
                        type="email"
                        className="g-input"
                        value={cmExtraEmail}
                        onChange={(e) => setCmExtraEmail(e.target.value)}
                        placeholder="contacto@empresa.com"
                        style={{ fontSize: '0.82rem', padding: '5px 8px', width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-70)' }}>
                    <strong>Interés:</strong> {cmAnalysis.extractedData.interest} · <strong>Cantidad:</strong>{' '}
                    {cmAnalysis.extractedData.quantity ? `${cmAnalysis.extractedData.quantity} prendas` : 'A definir'}
                  </div>
                </div>

                {/* Botón de Inyección a CRM */}
                <button
                  className="btn--primary"
                  onClick={handleInjectToCrm}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '0.92rem',
                    background: 'var(--blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  Inyectar Directamente a Lead en CRM
                </button>

                {injectFeedback && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '10px 14px',
                      borderRadius: 'var(--r-s)',
                      fontSize: '0.82rem',
                      background: injectFeedback.ok ? 'rgba(34, 177, 94, 0.15)' : 'rgba(192, 57, 43, 0.15)',
                      color: injectFeedback.ok ? '#15803d' : '#c0392b',
                      fontWeight: 500,
                    }}
                  >
                    {injectFeedback.message}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-PESTAÑA 4: DIRECTORIO DE AGENTES (26)
         ======================================================== */}
      {activeSubTab === 'agents' && (
        <div>
          {/* Filtros de Módulo */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {['ALL', 'ORCHESTRATOR', 'INSTAGRAM', 'LINKEDIN', 'WHATSAPP', 'GMAIL', 'TRANSVERSAL'].map((mod) => (
              <button
                key={mod}
                className={`btn--pill ${filterAgentModule === mod ? 'active' : ''}`}
                onClick={() => setFilterAgentModule(mod)}
                style={{
                  fontSize: '0.8rem',
                  padding: '6px 14px',
                  borderRadius: 'var(--r-pill)',
                  border: '1px solid var(--line)',
                  background: filterAgentModule === mod ? 'var(--blue)' : 'var(--neutral)',
                  color: filterAgentModule === mod ? '#ffffff' : 'var(--ink)',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                {mod === 'ALL' && 'Todos los Agentes (26)'}
                {mod === 'ORCHESTRATOR' && 'Orquestador (M-00)'}
                {mod === 'INSTAGRAM' && 'Instagram (7)'}
                {mod === 'LINKEDIN' && 'LinkedIn (7)'}
                {mod === 'WHATSAPP' && 'WhatsApp (6)'}
                {mod === 'GMAIL' && 'Gmail (6)'}
                {mod === 'TRANSVERSAL' && 'Transversales (6)'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {agentsList.map((ag) => (
              <div
                key={ag.id}
                className="card"
                style={{
                  padding: '18px',
                  borderRadius: 'var(--r-m)',
                  border: '1px solid var(--line)',
                  background: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span
                    className="g-badge"
                    style={{
                      background: 'var(--neutral)',
                      color: 'var(--blue)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                    }}
                  >
                    {ag.id}
                  </span>
                  <span
                    className="g-badge"
                    style={{
                      background:
                        ag.hitl === 0
                          ? 'rgba(34, 177, 94, 0.12)'
                          : ag.hitl === 1
                          ? 'rgba(14, 116, 144, 0.12)'
                          : ag.hitl === 2
                          ? 'rgba(180, 83, 9, 0.12)'
                          : 'rgba(192, 57, 43, 0.12)',
                      color:
                        ag.hitl === 0
                          ? '#15803d'
                          : ag.hitl === 1
                          ? 'var(--cyan-ink)'
                          : ag.hitl === 2
                          ? '#b45309'
                          : '#c0392b',
                      fontSize: '0.72rem',
                    }}
                  >
                    HITL-{ag.hitl} típico
                  </span>
                </div>

                <h4 style={{ margin: '0 0 2px', fontSize: '1rem', color: 'var(--ink)' }}>{ag.name}</h4>
                <div style={{ fontSize: '0.78rem', color: 'var(--cyan-ink)', fontWeight: 600, marginBottom: 8 }}>
                  {ag.role}
                </div>

                <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: 'var(--ink-70)', lineHeight: 1.4 }}>
                  {ag.responsibility}
                </p>

                <div style={{ fontSize: '0.76rem', color: 'var(--ink-45)', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                  <strong>Output:</strong> {ag.output}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Decisión HITL */}
      {modalDecision.open && modalDecision.approval && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                {modalDecision.decision === 'APPROVED' ? 'Aprobar Paquete para Publicación' : 'Rechazar / Solicitar Ajustes'}
              </h3>
              <button
                className="modal-close"
                onClick={() => setModalDecision({ open: false, approval: null, decision: 'APPROVED', notes: '' })}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '0.88rem', margin: '0 0 12px' }}>
                Estás por emitir una decisión humana sobre <strong>{modalDecision.approval.id}</strong> ({modalDecision.approval.titulo}).
              </p>

              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Observaciones o instrucciones de ejecución (opcional):
              </label>
              <textarea
                className="g-input"
                rows="3"
                value={modalDecision.notes}
                onChange={(e) => setModalDecision((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Ingresá detalles de aprobación o motivo de rechazo..."
                style={{ width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn--secondary"
                onClick={() => setModalDecision({ open: false, approval: null, decision: 'APPROVED', notes: '' })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={modalDecision.decision === 'APPROVED' ? 'btn--primary' : 'btn--secondary'}
                onClick={handleConfirmDecision}
                style={{
                  background: modalDecision.decision === 'REJECTED' ? '#c0392b' : undefined,
                  color: modalDecision.decision === 'REJECTED' ? '#ffffff' : undefined,
                }}
              >
                Confirmar {modalDecision.decision === 'APPROVED' ? 'Aprobación' : 'Rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva Idea Calendario */}
      {modalNewIdea.open && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '540px' }}>
            <form onSubmit={handleSaveNewIdea}>
              <div className="modal-header">
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Proponer Nueva Pieza de Contenido</h3>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setModalNewIdea({ open: false, data: {} })}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Canal:</label>
                  <select
                    className="g-input"
                    value={modalNewIdea.data.channel || 'INSTAGRAM'}
                    onChange={(e) => setModalNewIdea((prev) => ({ ...prev, data: { ...prev.data, channel: e.target.value } }))}
                    style={{ width: '100%' }}
                  >
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="LINKEDIN">LinkedIn</option>
                    <option value="WHATSAPP_STATUS">WhatsApp Estados</option>
                    <option value="EMAIL">Gmail B2B</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Idea / Ángulo:</label>
                  <input
                    type="text"
                    required
                    className="g-input"
                    value={modalNewIdea.data.idea || ''}
                    onChange={(e) => setModalNewIdea((prev) => ({ ...prev, data: { ...prev.data, idea: e.target.value } }))}
                    placeholder="Ej: DTF para tiradas cortas vs serigrafía"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Objetivo:</label>
                  <input
                    type="text"
                    className="g-input"
                    value={modalNewIdea.data.objective || ''}
                    onChange={(e) => setModalNewIdea((prev) => ({ ...prev, data: { ...prev.data, objective: e.target.value } }))}
                    placeholder="Ej: Educar y posicionar asesoramiento técnico"
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Formato:</label>
                    <input
                      type="text"
                      className="g-input"
                      value={modalNewIdea.data.format || ''}
                      onChange={(e) => setModalNewIdea((prev) => ({ ...prev, data: { ...prev.data, format: e.target.value } }))}
                      placeholder="Carrusel 5 slides / Reel / Post"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>Fecha propuesta:</label>
                    <input
                      type="date"
                      className="g-input"
                      value={modalNewIdea.data.proposed_date || ''}
                      onChange={(e) => setModalNewIdea((prev) => ({ ...prev, data: { ...prev.data, proposed_date: e.target.value } }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn--secondary"
                  onClick={() => setModalNewIdea({ open: false, data: {} })}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn--primary">
                  Guardar en Calendario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
