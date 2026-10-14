import { useState, useMemo, useEffect } from 'react';
import {
  getLeads,
  saveLead,
  updateLeadStatus,
  deleteLead,
  importQuotesToLeads,
  CRM_ESTADOS,
  CRM_RULE_ID,
  normEmail,
  normPhone,
  matchLeadInList,
  getOperadorActual,
} from '../services/storageService';
import { fetchLeadsDb } from '../../lib/db';
import { IconSearch, IconEdit, IconTrash, IconRefresh } from './Icons';

export default function CrmModule({ onLeadChanged }) {
  const [leads, setLeads] = useState([]);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterScore, setFilterScore] = useState('ALL');

  // Modales
  const [modalLead, setModalLead] = useState({ open: false, isEdit: false, data: {} });
  const [modalDetail, setModalDetail] = useState({ open: false, lead: null });
  const [noteText, setNoteText] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  const reload = () => {
    const list = getLeads();
    setLeads(list);
    if (onLeadChanged) onLeadChanged();
  };

  useEffect(() => {
    reload();
  }, []);

  // Métricas rápidas
  const totalLeads = leads.length;
  const hotLeads = leads.filter((l) => (l.score || 0) >= 80 || l.status === 'QUALIFIED').length;
  const inPipeline = leads.filter((l) => ['QUOTATION', 'NEGOTIATION', 'ENGAGED'].includes(l.status)).length;
  const wonLeads = leads.filter((l) => l.status === 'WON').length;

  // Filtrado
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const matchSearch =
        !searchTerm ||
        (l.company && l.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.contact && l.contact.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.email && l.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.phone && l.phone.includes(searchTerm)) ||
        (l.interest && l.interest.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.lead_id && l.lead_id.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = filterStatus === 'ALL' || l.status === filterStatus;

      let matchScore = true;
      const score = Number(l.score) || 0;
      if (filterScore === 'HOT') matchScore = score >= 80;
      else if (filterScore === 'QUALIFIED') matchScore = score >= 60 && score < 80;
      else if (filterScore === 'NURTURE') matchScore = score >= 30 && score < 60;
      else if (filterScore === 'LOW') matchScore = score < 30;

      return matchSearch && matchStatus && matchScore;
    });
  }, [leads, searchTerm, filterStatus, filterScore]);

  // Columnas Kanban
  const kanbanColumns = [
    { id: 'NEW', title: 'Nuevos', statuses: ['NEW'] },
    { id: 'QUALIFIED', title: 'Calificados', statuses: ['QUALIFIED'] },
    { id: 'IN_CONVERSATION', title: 'En Contacto', statuses: ['CONTACTED', 'ENGAGED'] },
    { id: 'QUOTATION', title: 'En Cotización', statuses: ['QUOTATION'] },
    { id: 'NEGOTIATION', title: 'Negociación', statuses: ['NEGOTIATION'] },
    { id: 'WON', title: 'Ganados', statuses: ['WON'] },
    { id: 'CLOSED_OTHER', title: 'Nutrición / Perdidos', statuses: ['NURTURE', 'LOST', 'REACTIVATION'] },
  ];

  // Detectar posible duplicado en el formulario
  const duplicateWarning = useMemo(() => {
    if (!modalLead.open || modalLead.isEdit) return null;
    const em = modalLead.data?.email;
    const ph = modalLead.data?.phone;
    if (!em && !ph) return null;
    const matches = matchLeadInList(leads, { email: em, phone: ph });
    if (matches.length > 0) {
      return `Coincidencia detectada con ${matches.map((m) => m.lead_id + ' (' + (m.company || m.contact) + ')').join(', ')}. Al guardar, se fusionará automáticamente bajo regla ${CRM_RULE_ID}.`;
    }
    return null;
  }, [modalLead, leads]);

  // Abrir nuevo
  const handleOpenNuevo = () => {
    setModalLead({
      open: true,
      isEdit: false,
      data: {
        company: '',
        contact: '',
        email: '',
        phone: '',
        channel: 'WHATSAPP',
        origin: 'DIRECTO',
        interest: '',
        quantity: '',
        timing: '',
        score: 60,
        status: 'NEW',
        next_action: 'Calificar requerimiento y enviar catálogo',
        owner: getOperadorActual(),
        notes: '',
      },
    });
  };

  // Abrir editar
  const handleOpenEditar = (l) => {
    setModalLead({
      open: true,
      isEdit: true,
      data: { ...l },
    });
  };

  // Guardar lead
  const handleGuardarLead = (e) => {
    e.preventDefault();
    try {
      const res = saveLead(modalLead.data);
      if (res.ambiguous) {
        if (!confirm(`${res.message}\n\n¿Deseas darlo de alta de todos modos?`)) {
          return;
        }
        saveLead({ ...modalLead.data, forzar_creacion: true });
      }
      setModalLead({ open: false, isEdit: false, data: {} });
      reload();
      alert(res.type === 'merged' ? 'Lead fusionado con éxito en registro existente.' : 'Lead guardado con éxito en el CRM.');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Cambiar etapa rápido
  const handleCambiarEtapa = (leadId, nuevoEstado) => {
    try {
      updateLeadStatus(leadId, nuevoEstado, `Avanzado a ${nuevoEstado} desde el tablero`);
      reload();
    } catch (err) {
      alert(err.message);
    }
  };

  // Eliminar lead
  const handleEliminarLead = (lead) => {
    if (confirm(`¿Estás seguro de eliminar el lead ${lead.lead_id} (${lead.company || lead.contact})?`)) {
      try {
        deleteLead(lead.lead_id);
        reload();
        if (modalDetail.open && modalDetail.lead?.lead_id === lead.lead_id) {
          setModalDetail({ open: false, lead: null });
        }
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // Agregar nota de historial
  const handleAgregarNota = () => {
    if (!noteText.trim() || !modalDetail.lead) return;
    try {
      const lead = modalDetail.lead;
      const history = [
        ...(lead.history || []),
        {
          at: new Date().toISOString(),
          event: 'nota_seguimiento',
          by: getOperadorActual(),
          notes: noteText.trim(),
        },
      ];
      saveLead({ ...lead, history, last_contact: new Date().toISOString().slice(0, 10) });
      setNoteText('');
      const updated = getLeads().find((l) => l.lead_id === lead.lead_id);
      setModalDetail({ open: true, lead: updated });
      reload();
    } catch (err) {
      alert(err.message);
    }
  };

  // Sincronizar cotizaciones web
  const handleSincronizarCotizaciones = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const webQuotes = await fetchLeadsDb(50);
      if (!webQuotes || webQuotes.length === 0) {
        setSyncFeedback({ tipo: 'info', msg: 'No se encontraron nuevas cotizaciones en la base de datos web.' });
        return;
      }
      const res = importQuotesToLeads(webQuotes);
      reload();
      setSyncFeedback({
        tipo: 'success',
        msg: `Sincronización completa: ${res.imported} leads nuevos creados, ${res.merged} solicitudes fusionadas por coincidencia.`,
      });
    } catch (err) {
      setSyncFeedback({ tipo: 'error', msg: `Error al sincronizar: ${err.message}` });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="crm-module">
      {/* Header del CRM Canónico AIRO */}
      <div className="gestion-module-header">
        <div className="section-eyebrow">
          <span className="num">07</span> Cartera B2B & Oportunidades
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 className="display section-title">CRM y pipeline B2B.</h2>
            <p className="section-sub">
              Gestión unificada de prospectos, clientes corporativos y oportunidades comerciales con deduplicación automática <strong style={{ color: 'var(--cyan-ink)' }}>{CRM_RULE_ID}</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', gap: 4, background: 'var(--neutral)', padding: 4, borderRadius: 'var(--r-pill)' }}>
              <button
                className={`g-btn g-btn-sm ${viewMode === 'kanban' ? 'g-btn-primary' : 'g-btn-outline'}`}
                onClick={() => setViewMode('kanban')}
                style={{ padding: '6px 14px' }}
              >
                Tablero Pipeline
              </button>
              <button
                className={`g-btn g-btn-sm ${viewMode === 'table' ? 'g-btn-primary' : 'g-btn-outline'}`}
                onClick={() => setViewMode('table')}
                style={{ padding: '6px 14px' }}
              >
                Vista Lista
              </button>
            </div>

            <button
              className="g-btn g-btn-outline"
              onClick={handleSincronizarCotizaciones}
              disabled={isSyncing}
              title="Importar cotizaciones entrantes del catálogo web"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <IconRefresh size={14} />
              {isSyncing ? 'Sincronizando…' : 'Sincronizar Cotizaciones Web'}
            </button>

            <button className="g-btn g-btn-primary" onClick={handleOpenNuevo}>
              + Nuevo Lead B2B
            </button>
          </div>
        </div>
      </div>

      {syncFeedback && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: 'var(--r-s, 8px)',
            fontSize: '0.875rem',
            background: syncFeedback.tipo === 'success' ? 'rgba(34, 177, 94, 0.12)' : 'rgba(26, 66, 149, 0.08)',
            color: syncFeedback.tipo === 'success' ? '#15803d' : 'var(--blue)',
            border: `1px solid ${syncFeedback.tipo === 'success' ? 'rgba(34, 177, 94, 0.3)' : 'rgba(26, 66, 149, 0.2)'}`,
          }}
        >
          {syncFeedback.msg}
        </div>
      )}

      {/* KPIs Editoriales AIRO */}
      <div className="gestion-kpis">
        <div className="gestion-kpi-card">
          <span className="gestion-kpi-label">Total Oportunidades</span>
          <span className="gestion-kpi-val" style={{ color: 'var(--blue)' }}>{totalLeads}</span>
          <span className="gestion-kpi-sub">Leads en base de datos</span>
        </div>
        <div className="gestion-kpi-card kpi-accent">
          <span className="gestion-kpi-label">Oportunidades Calificadas</span>
          <span className="gestion-kpi-val">{hotLeads}</span>
          <span className="gestion-kpi-sub">Score alto / Interés firme</span>
        </div>
        <div className="gestion-kpi-card kpi-warning">
          <span className="gestion-kpi-label">En Cotización & Cierre</span>
          <span className="gestion-kpi-val">{inPipeline}</span>
          <span className="gestion-kpi-sub">Propuestas comerciales en curso</span>
        </div>
        <div className="gestion-kpi-card kpi-success">
          <span className="gestion-kpi-label">Cuentas Ganadas</span>
          <span className="gestion-kpi-val">{wonLeads}</span>
          <span className="gestion-kpi-sub">Clientes concretados</span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="gestion-filters-card" style={{ marginTop: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'center' }}>
          <div>
            <label className="g-form-label" style={{ marginBottom: '4px', display: 'block' }}>Buscar Lead / Empresa / WhatsApp</label>
            <input
              type="text"
              className="gestion-input"
              placeholder="Buscar por nombre, empresa, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <label className="g-form-label" style={{ marginBottom: '4px', display: 'block' }}>Etapa del Pipeline</label>
            <select className="gestion-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="ALL">Todas las etapas</option>
              {CRM_ESTADOS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="g-form-label" style={{ marginBottom: '4px', display: 'block' }}>Calificación de Scoring</label>
            <select className="gestion-select" value={filterScore} onChange={(e) => setFilterScore(e.target.value)}>
              <option value="ALL">Todos los scores</option>
              <option value="HOT">Hot (80 - 100)</option>
              <option value="QUALIFIED">Calificado (60 - 79)</option>
              <option value="NURTURE">Nutrición (30 - 59)</option>
              <option value="LOW">Frío (0 - 29)</option>
            </select>
          </div>
        </div>
      </div>

      {/* VISTA 1: TABLERO KANBAN */}
      {viewMode === 'kanban' && (
        <div className="crm-kanban-board" style={{ marginTop: '24px' }}>
          {kanbanColumns.map((col) => {
            const colLeads = filteredLeads.filter((l) => col.statuses.includes(l.status));
            return (
              <div key={col.id} className="crm-kanban-col">
                <div className="crm-kanban-col-header">
                  <span className="crm-kanban-col-title">{col.title}</span>
                  <span className="crm-kanban-col-count">{colLeads.length}</span>
                </div>

                <div className="crm-kanban-cards-wrapper">
                  {colLeads.length === 0 ? (
                    <div className="crm-kanban-empty">Sin leads en esta etapa</div>
                  ) : (
                    colLeads.map((lead) => {
                      const scoreNum = Number(lead.score) || 0;
                      const scoreBadge =
                        scoreNum >= 80 ? 'Hot' : scoreNum >= 60 ? 'Calificado' : scoreNum >= 30 ? 'Nutrición' : 'Frío';
                      const scoreClass =
                        scoreNum >= 80 ? 'g-badge-danger' : scoreNum >= 60 ? 'g-badge-info' : 'g-badge-neutral';

                      return (
                        <div key={lead.lead_id} className="crm-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--blue)' }}>{lead.lead_id}</span>
                            <span className={`g-badge ${scoreClass}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                              {scoreBadge} ({scoreNum})
                            </span>
                          </div>

                          <div style={{ fontWeight: 700, fontSize: '0.98rem', marginBottom: '4px', color: 'var(--ink)' }}>
                            {lead.company || lead.contact || 'Contacto sin identificar'}
                          </div>

                          {lead.company && lead.contact && lead.company !== lead.contact && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--ink-45)', marginBottom: '6px' }}>
                              {lead.contact}
                            </div>
                          )}

                          {lead.interest && (
                            <div style={{ fontSize: '0.82rem', color: 'var(--ink-70)', marginBottom: '8px', lineHeight: 1.35 }}>
                              <strong>Interés:</strong> {lead.interest}
                              {lead.quantity ? ` (${lead.quantity} u.)` : ''}
                            </div>
                          )}

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                            {lead.phone && (
                              <a
                                href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="g-badge g-badge-success"
                                style={{ fontSize: '0.72rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                WA: {lead.phone}
                              </a>
                            )}
                            {lead.channel && (
                              <span className="g-badge g-badge-neutral" style={{ fontSize: '0.72rem' }}>
                                {lead.channel}
                              </span>
                            )}
                          </div>

                          {lead.next_action && (
                            <div style={{ fontSize: '0.78rem', color: '#b45309', background: 'rgba(217, 119, 6, 0.08)', padding: '4px 8px', borderRadius: '6px', marginBottom: '10px' }}>
                              Próx. paso: {lead.next_action}
                            </div>
                          )}

                          {/* Acciones de la Tarjeta */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                className="gestion-btn-table-action"
                                onClick={() => setModalDetail({ open: true, lead })}
                                title="Ver ficha e historial"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <IconSearch size={13} /> Ficha
                              </button>
                              <button
                                className="gestion-btn-table-action"
                                onClick={() => handleOpenEditar(lead)}
                                title="Editar datos"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <IconEdit size={13} /> Editar
                              </button>
                            </div>

                            {/* Selector rápido de avance de etapa */}
                            <select
                              className="gestion-select"
                              style={{ fontSize: '0.72rem', padding: '2px 6px', height: 'auto', width: 'auto' }}
                              value={lead.status}
                              onChange={(e) => handleCambiarEtapa(lead.lead_id, e.target.value)}
                            >
                              {CRM_ESTADOS.map((st) => (
                                <option key={st.id} value={st.id}>{st.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VISTA 2: TABLA DE LEADS */}
      {viewMode === 'table' && (
        <div className="gestion-table-card" style={{ marginTop: '24px' }}>
          <div className="gestion-table-responsive">
            <table className="gestion-table">
              <thead>
                <tr>
                  <th>ID Lead</th>
                  <th>Empresa / Contacto</th>
                  <th>Contacto Directo</th>
                  <th>Canal / Origen</th>
                  <th>Interés & Pedido</th>
                  <th>Score</th>
                  <th>Etapa Actual</th>
                  <th>Próxima Acción</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-45)' }}>
                      No se encontraron leads con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const stObj = CRM_ESTADOS.find((s) => s.id === lead.status) || { label: lead.status, badge: 'g-badge-neutral' };
                    return (
                      <tr key={lead.lead_id}>
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{lead.lead_id}</span>
                        </td>
                        <td>
                          <strong>{lead.company || lead.contact}</strong>
                          {lead.company && lead.contact && lead.company !== lead.contact && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--ink-45)' }}>{lead.contact}</div>
                          )}
                        </td>
                        <td>
                          {lead.phone && (
                            <div>
                              <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: '#15803d', textDecoration: 'none' }}>
                                {lead.phone}
                              </a>
                            </div>
                          )}
                          {lead.email && <div style={{ fontSize: '0.8rem', color: 'var(--ink-45)' }}>{lead.email}</div>}
                        </td>
                        <td>
                          <span className="g-badge g-badge-neutral">{lead.channel || lead.origin}</span>
                        </td>
                        <td>
                          <div style={{ maxWidth: '240px', fontSize: '0.85rem' }}>
                            {lead.interest || 'Sin especificar'}
                            {lead.quantity ? ` · ${lead.quantity} u.` : ''}
                          </div>
                        </td>
                        <td>
                          <span className="g-badge g-badge-info">{lead.score || 50} pts</span>
                        </td>
                        <td>
                          <span className={`g-badge ${stObj.badge}`}>{stObj.label}</span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', color: 'var(--ink-70)' }}>{lead.next_action || '—'}</div>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            className="gestion-btn-table-action"
                            onClick={() => setModalDetail({ open: true, lead })}
                            title="Ver ficha completa"
                          >
                            <IconSearch size={14} />
                          </button>
                          <button
                            className="gestion-btn-table-action"
                            onClick={() => handleOpenEditar(lead)}
                            title="Modificar lead"
                          >
                            <IconEdit size={14} />
                          </button>
                          <button
                            className="gestion-btn-table-action"
                            style={{ color: '#c0392b' }}
                            onClick={() => handleEliminarLead(lead)}
                            title="Eliminar lead"
                          >
                            <IconTrash size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ALTA / EDICIÓN DE LEAD */}
      {modalLead.open && (
        <div className="gestion-modal-overlay" onClick={() => setModalLead({ open: false, isEdit: false, data: {} })}>
          <div className="gestion-modal" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
            <div className="gestion-modal-header">
              <h3 className="gestion-modal-title">
                {modalLead.isEdit ? `Modificar Lead ${modalLead.data.lead_id}` : 'Nuevo Lead B2B (AIRO Color Lab)'}
              </h3>
              <button className="gestion-btn-close" onClick={() => setModalLead({ open: false, isEdit: false, data: {} })}>×</button>
            </div>

            <form onSubmit={handleGuardarLead}>
              <div className="gestion-modal-body">
                {duplicateWarning && (
                  <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: 'var(--r-m)', background: 'rgba(217, 119, 6, 0.1)', color: '#b45309', border: '1px solid rgba(217, 119, 6, 0.3)', fontSize: '0.85rem' }}>
                    <strong>Aviso:</strong> {duplicateWarning}
                  </div>
                )}

                <div className="g-form-grid">
                  <div>
                    <label className="g-form-label">Razón Social / Empresa</label>
                    <input
                      type="text"
                      className="gestion-input"
                      placeholder="Ej: Cervecera Quilmes, Estudio Bold..."
                      value={modalLead.data.company || ''}
                      onChange={(e) => setModalLead({ ...modalLead, data: { ...modalLead.data, company: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label className="g-form-label">Contacto / Persona Referente</label>
                    <input
                      type="text"
                      className="gestion-input"
                      placeholder="Ej: Lucía Martínez"
                      value={modalLead.data.contact || ''}
                      onChange={(e) => setModalLead({ ...modalLead, data: { ...modalLead.data, contact: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label className="g-form-label">WhatsApp / Teléfono Directo</label>
                    <input
                      type="text"
                      className="gestion-input"
                      placeholder="Ej: 1155889922 (con o sin guiones)"
                      value={modalLead.data.phone || ''}
                      onChange={(e) => setModalLead({ ...modalLead, data: { ...modalLead.data, phone: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label className="g-form-label">Correo Electrónico</label>
                    <input
                      type="email"
                      className="gestion-input"
                      placeholder="contacto@empresa.com"
                      value={modalLead.data.email || ''}
                      onChange={(e) => setModalLead({ ...modalLead, data: { ...modalLead.data, email: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label className="g-form-label">Canal de Entrada</label>
                    <select
                      className="gestion-select"
                      value={modalLead.data.channel || 'WHATSAPP'}
                      onChange={(e) => setModalLead({ ...modalLead, data: { ...modalLead.data, channel: e.target.value } })}
                    >
                      <option value="WHATSAPP">WhatsApp B2B</option>
                      <option value="INSTAGRAM">Instagram Direct</option>
                      <option value="LINKEDIN">LinkedIn InMail</option>
                      <option value="GMAIL">Email Corporativo</option>
                      <option value="WEB_CATALOGO">Catálogo Web / Cotizador</option>
                      <option value="REFERRAL">Referido / Recomendación</option>
                      <option value="OTHER">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="g-form-label">Etapa en el Pipeline</label>
                    <select
                      className="gestion-select"
                      value={modalLead.data.status || 'NEW'}
                      onChange={(e) => setModalLead({ ...modalLead, data: { ...modalLead.data, status: e.target.value } })}
                    >
                      {CRM_ESTADOS.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="g-form-label">Cantidad Estimada (u.)</label>
                    <input
                      type="number"
                      className="gestion-input"
                      placeholder="Mínimo 10 u."
                      value={modalLead.data.quantity || ''}
                      onChange={(e) => setModalLead({ ...modalLead, data: { ...modalLead.data, quantity: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label className="g-form-label">Scoring de Oportunidad (0 a 100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="gestion-input"
                      value={modalLead.data.score !== undefined ? modalLead.data.score : 60}
                      onChange={(e) => setModalLead({ ...modalLead, data: { ...modalLead.data, score: e.target.value } })}
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="g-form-label">Interés Comercial / Prendas o Insumos Requeridos</label>
                    <textarea
                      className="gestion-input"
                      rows={2}
                      placeholder="Ej: 50 Buzos Oversize Frizados con estampa DTF frente y espalda..."
                      value={modalLead.data.interest || ''}
                      onChange={(e) => setModalLead({ ...modalLead, data: { ...modalLead.data, interest: e.target.value } })}
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="g-form-label">Próxima Acción Requerida</label>
                    <input
                      type="text"
                      className="gestion-input"
                      placeholder="Ej: Enviar cotización formal y coordinar muestra física"
                      value={modalLead.data.next_action || ''}
                      onChange={(e) => setModalLead({ ...modalLead, data: { ...modalLead.data, next_action: e.target.value } })}
                    />
                  </div>
                </div>
              </div>

              <div className="gestion-modal-footer">
                <button type="button" className="gestion-btn gestion-btn-outline" onClick={() => setModalLead({ open: false, isEdit: false, data: {} })}>
                  Cancelar
                </button>
                <button type="submit" className="gestion-btn gestion-btn-primary">
                  {modalLead.isEdit ? 'Guardar Modificaciones' : 'Guardar Lead en CRM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: FICHA DETALLADA & HISTORIAL APPEND-ONLY */}
      {modalDetail.open && modalDetail.lead && (
        <div className="gestion-modal-overlay" onClick={() => setModalDetail({ open: false, lead: null })}>
          <div className="gestion-modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div className="gestion-modal-header">
              <div>
                <span className="g-badge g-badge-brand" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                  {modalDetail.lead.lead_id}
                </span>
                <h3 className="gestion-modal-title">
                  {modalDetail.lead.company || modalDetail.lead.contact}
                </h3>
              </div>
              <button className="gestion-btn-close" onClick={() => setModalDetail({ open: false, lead: null })}>×</button>
            </div>

            <div className="gestion-modal-body">
              {/* Grid de Datos del Lead */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', background: 'var(--neutral)', padding: '16px', borderRadius: 'var(--r-m)', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-45)', display: 'block' }}>Etapa Actual</span>
                  <span className="g-badge g-badge-warning" style={{ marginTop: '4px' }}>
                    {CRM_ESTADOS.find((s) => s.id === modalDetail.lead.status)?.label || modalDetail.lead.status}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-45)', display: 'block' }}>Contacto</span>
                  <strong style={{ fontSize: '0.9rem' }}>{modalDetail.lead.contact || 'No especificado'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-45)', display: 'block' }}>WhatsApp</span>
                  {modalDetail.lead.phone ? (
                    <a href={`https://wa.me/${modalDetail.lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: '#15803d', fontWeight: 600 }}>
                      {modalDetail.lead.phone}
                    </a>
                  ) : '—'}
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-45)', display: 'block' }}>Correo</span>
                  <span style={{ fontSize: '0.85rem' }}>{modalDetail.lead.email || '—'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-45)', display: 'block' }}>Scoring Comercial</span>
                  <strong style={{ color: 'var(--blue)' }}>{modalDetail.lead.score || 50} / 100</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-45)', display: 'block' }}>Último Contacto</span>
                  <span>{modalDetail.lead.last_contact || '—'}</span>
                </div>
              </div>

              {/* Detalle del Pedido / Carrito Web si vino de la web */}
              {modalDetail.lead.carrito && (
                <div style={{ marginBottom: '20px', padding: '14px', borderRadius: 'var(--r-m)', background: 'rgba(26, 66, 149, 0.05)', border: '1px solid rgba(26, 66, 149, 0.15)' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--blue)', display: 'block', marginBottom: '6px' }}>
                    Solicitud de Cotización recibida del Catálogo Web:
                  </strong>
                  <pre style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--ink)' }}>
                    {modalDetail.lead.carrito}
                  </pre>
                </div>
              )}

              {/* Historial Append-Only */}
              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', marginBottom: '12px', color: 'var(--ink)' }}>
                Historial de Interacciones & Auditoría de Oportunidad
              </h4>

              <div className="crm-timeline">
                {(!modalDetail.lead.history || modalDetail.lead.history.length === 0) ? (
                  <div style={{ color: 'var(--ink-45)', fontSize: '0.85rem' }}>Sin eventos registrados.</div>
                ) : (
                  modalDetail.lead.history.map((ev, idx) => (
                    <div key={idx} className="crm-timeline-item">
                      <div className="crm-timeline-dot" />
                      <div className="crm-timeline-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                            {ev.event.replace(/_/g, ' ')}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--ink-45)' }}>
                            {new Date(ev.at).toLocaleString('es-AR')}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--ink-70)' }}>
                          {ev.by ? <span>Operador: <em>{ev.by}</em> · </span> : null}
                          {ev.notes || ev.changes || (ev.incoming ? `Datos entrantes: ${JSON.stringify(ev.incoming)}` : '')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Agregar Nota Rápida */}
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
                <label className="g-form-label" style={{ marginBottom: '6px', display: 'block' }}>
                  Registrar Nota / Acción de Seguimiento
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="gestion-input"
                    placeholder="Ej: Se envió muestra de tela frizada y tabla de medidas por WhatsApp..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAgregarNota(); } }}
                  />
                  <button type="button" className="gestion-btn gestion-btn-secondary" onClick={handleAgregarNota}>
                    + Registrar
                  </button>
                </div>
              </div>
            </div>

            <div className="gestion-modal-footer">
              <button
                type="button"
                className="gestion-btn gestion-btn-outline"
                style={{ color: '#c0392b' }}
                onClick={() => handleEliminarLead(modalDetail.lead)}
              >
                Eliminar Lead
              </button>
              <button
                type="button"
                className="gestion-btn gestion-btn-primary"
                onClick={() => {
                  const leadToEdit = modalDetail.lead;
                  setModalDetail({ open: false, lead: null });
                  handleOpenEditar(leadToEdit);
                }}
              >
                Modificar Datos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
