import { useState, useMemo, useEffect } from 'react';
import {
  MARKETING_CHANNELS,
  getCampaigns,
  saveCampaign,
  deleteCampaign,
  getPrompts,
  savePrompt,
  deletePrompt,
  decidePromptApproval,
  generateAiPrompt,
  getAgentRegistry,
  classifyAndGenerateCmResponse,
  convertCmInteractionToLead,
  getOperadorActual,
} from '../services/storageService.js';
import {
  IconPrompt,
  IconImage,
  IconVideo,
  IconInstagram,
  IconWhatsApp,
  IconLinkedIn,
  IconGmail,
  IconFacebook,
  IconCheck,
  IconPlus,
  IconEdit,
  IconTrash,
  IconClose,
  IconSparkles,
} from './Icons.jsx';

export default function MarketingModule({ onContentChanged }) {
  // Pestañas: 'campaigns' | 'prompts' | 'approvals' | 'cm' | 'agents'
  const [activeSubTab, setActiveSubTab] = useState('campaigns');

  // Estados de Campañas
  const [campaigns, setCampaigns] = useState([]);
  const [filterCampStatus, setFilterCampStatus] = useState('ALL');
  const [modalCamp, setModalCamp] = useState({ open: false, data: null });
  const [modalPub, setModalPub] = useState({ open: false, campId: null, data: null });

  // Estados de Prompts
  const [prompts, setPrompts] = useState([]);
  const [filterPromptStatus, setFilterPromptStatus] = useState('ALL');
  const [filterPromptTipo, setFilterPromptTipo] = useState('ALL');
  const [filterPromptCanal, setFilterPromptCanal] = useState('ALL');

  // Creador / Generador de Prompts
  const [promptForm, setPromptForm] = useState({
    id: null,
    campaign_id: '',
    tipo: 'COPY',
    canal: 'INSTAGRAM',
    modelo_destino: 'ChatGPT / Claude / Gemini',
    titulo: '',
    objetivo: 'Lanzamiento de temporada y captación B2B',
    producto: 'Hoodie Frisado Premium 100% Algodón Peinado',
    audiencia: 'Responsables de marketing, RRHH y directores de agencia',
    detalleExtra: '',
    prompt_text: '',
    prompt_negativo: '',
  });
  const [editingPromptId, setEditingPromptId] = useState(null);

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

  // Feedback y Notificaciones
  const [copyNotice, setCopyNotice] = useState(null);
  const [statusNotice, setStatusNotice] = useState(null);

  // Modal para decisión HITL de prompt
  const [modalDecision, setModalDecision] = useState({
    open: false,
    prompt: null,
    decision: 'APPROVED',
    notes: '',
  });

  const reloadData = () => {
    setCampaigns(getCampaigns());
    setPrompts(getPrompts());
    if (onContentChanged) onContentChanged();
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Prompts pendientes de aprobación HITL
  const pendingPrompts = useMemo(() => {
    return prompts.filter((p) => p.estado_aprobacion === 'PENDING');
  }, [prompts]);

  const pendingCount = pendingPrompts.length;

  // Filtrado de Campañas
  const filteredCampaigns = useMemo(() => {
    if (filterCampStatus === 'ALL') return campaigns;
    return campaigns.filter((c) => c.estado === filterCampStatus);
  }, [campaigns, filterCampStatus]);

  // Filtrado de Prompts
  const filteredPrompts = useMemo(() => {
    return prompts.filter((p) => {
      const mStatus = filterPromptStatus === 'ALL' || p.estado_aprobacion === filterPromptStatus;
      const mTipo = filterPromptTipo === 'ALL' || p.tipo === filterPromptTipo;
      const mCanal = filterPromptCanal === 'ALL' || p.canal === filterPromptCanal;
      return mStatus && mTipo && mCanal;
    });
  }, [prompts, filterPromptStatus, filterPromptTipo, filterPromptCanal]);

  // Lista de Agentes
  const agentsList = useMemo(() => {
    return getAgentRegistry();
  }, []);

  // Helper para copiar texto
  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopyNotice(`¡${label} copiado al portapapeles!`);
      setTimeout(() => setCopyNotice(null), 3000);
    });
  };

  // Helper icono de canal
  const renderChannelIcon = (chId) => {
    switch (chId) {
      case 'INSTAGRAM':
        return <IconInstagram />;
      case 'WHATSAPP':
        return <IconWhatsApp />;
      case 'LINKEDIN':
        return <IconLinkedIn />;
      case 'GMAIL':
        return <IconGmail />;
      case 'FACEBOOK':
        return <IconFacebook />;
      default:
        return null;
    }
  };

  // Generador con IA de AIRO
  const handleAutoGeneratePrompt = () => {
    const generated = generateAiPrompt({
      tipo: promptForm.tipo,
      canal: promptForm.canal,
      objetivo: promptForm.objetivo,
      producto: promptForm.producto,
      audience: promptForm.audiencia,
      detalleExtra: promptForm.detalleExtra,
      modeloDestino: promptForm.modelo_destino,
    });

    setPromptForm((prev) => ({
      ...prev,
      titulo: generated.titulo,
      prompt_text: generated.prompt_text,
      prompt_negativo: generated.prompt_negativo || '',
      modelo_destino: generated.modelo_destino,
    }));

    setStatusNotice({
      type: 'success',
      text: 'Prompt generado según directrices y manual de marca de AIRO Color Lab.',
    });
    setTimeout(() => setStatusNotice(null), 4000);
  };

  // Guardar prompt (entra siempre a PENDING para HITL)
  const handleSavePrompt = (e) => {
    e.preventDefault();
    if (!promptForm.titulo.trim() || !promptForm.prompt_text.trim()) {
      alert('El título y el contenido del prompt son obligatorios.');
      return;
    }

    try {
      const payload = {
        id: editingPromptId || undefined,
        campaign_id: promptForm.campaign_id || null,
        tipo: promptForm.tipo,
        canal: promptForm.canal,
        modelo_destino: promptForm.modelo_destino,
        titulo: promptForm.titulo.trim(),
        prompt_text: promptForm.prompt_text.trim(),
        prompt_negativo: promptForm.prompt_negativo ? promptForm.prompt_negativo.trim() : '',
        variables: {
          producto: promptForm.producto,
          objetivo: promptForm.objetivo,
          audiencia: promptForm.audiencia,
        },
      };

      const saved = savePrompt(payload);
      reloadData();
      setEditingPromptId(null);
      setPromptForm((prev) => ({
        ...prev,
        id: null,
        titulo: '',
        prompt_text: '',
        prompt_negativo: '',
      }));

      setStatusNotice({
        type: 'info',
        text: `Prompt guardado en estado PENDING para revisión y aprobación humana (HITL): "${saved.titulo}".`,
      });
      setTimeout(() => setStatusNotice(null), 6000);
    } catch (err) {
      alert(`Error al guardar prompt: ${err.message}`);
    }
  };

  // Editar prompt existente
  const handleEditPrompt = (p) => {
    setEditingPromptId(p.id);
    setPromptForm({
      id: p.id,
      campaign_id: p.campaign_id || '',
      tipo: p.tipo || 'COPY',
      canal: p.canal || 'INSTAGRAM',
      modelo_destino: p.modelo_destino || 'ChatGPT / Claude / Gemini',
      titulo: p.titulo || '',
      objetivo: p.variables?.objetivo || 'Lanzamiento y conversión B2B',
      producto: p.variables?.producto || 'Indumentaria textil',
      audiencia: p.variables?.audiencia || 'Empresas y marcas',
      detalleExtra: '',
      prompt_text: p.prompt_text || '',
      prompt_negativo: p.prompt_negativo || '',
    });
    setActiveSubTab('prompts');
  };

  // Eliminar prompt
  const handleDeletePrompt = (p) => {
    if (!window.confirm(`¿Confirmás eliminar el prompt "${p.titulo}"?`)) return;
    try {
      deletePrompt(p.id);
      reloadData();
      setStatusNotice({ type: 'success', text: `Prompt "${p.titulo}" eliminado.` });
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  // Abrir modal de decisión HITL
  const handleOpenDecision = (prompt, decision) => {
    setModalDecision({
      open: true,
      prompt,
      decision,
      notes: decision === 'APPROVED' ? 'Aprobado conforme al manual de marca y directrices B2B.' : '',
    });
  };

  // Confirmar decisión HITL
  const handleConfirmDecision = () => {
    if (!modalDecision.prompt) return;
    try {
      decidePromptApproval(
        modalDecision.prompt.id,
        modalDecision.decision,
        modalDecision.notes
      );
      reloadData();
      setModalDecision({ open: false, prompt: null, decision: 'APPROVED', notes: '' });
      setStatusNotice({
        type: 'success',
        text: `Prompt ${modalDecision.decision === 'APPROVED' ? 'aprobado' : 'rechazado'} con éxito.`,
      });
      setTimeout(() => setStatusNotice(null), 4000);
    } catch (err) {
      alert(`Error en decisión: ${err.message}`);
    }
  };

  // Guardar campaña
  const handleSaveCampaign = (e) => {
    e.preventDefault();
    const data = modalCamp.data;
    if (!data.titulo?.trim()) {
      alert('El título de la campaña es obligatorio.');
      return;
    }
    try {
      saveCampaign(data);
      reloadData();
      setModalCamp({ open: false, data: null });
      setStatusNotice({ type: 'success', text: 'Campaña guardada con éxito.' });
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Eliminar campaña
  const handleDeleteCampaign = (c) => {
    if (!window.confirm(`¿Confirmás eliminar la campaña "${c.titulo}"?`)) return;
    try {
      deleteCampaign(c.id);
      reloadData();
      setStatusNotice({ type: 'success', text: 'Campaña eliminada.' });
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Guardar publicación dentro de campaña
  const handleSavePublicacion = (e) => {
    e.preventDefault();
    const camp = campaigns.find((c) => c.id === modalPub.campId);
    if (!camp) return;

    const pubData = modalPub.data;
    const pubs = Array.isArray(camp.publicaciones) ? [...camp.publicaciones] : [];

    if (pubData.id) {
      const idx = pubs.findIndex((p) => p.id === pubData.id);
      if (idx >= 0) pubs[idx] = pubData;
    } else {
      pubs.push({ ...pubData, id: `PUB-${Date.now()}` });
    }

    saveCampaign({ ...camp, publicaciones: pubs });
    reloadData();
    setModalPub({ open: false, campId: null, data: null });
  };

  // Eliminar publicación de campaña
  const handleDeletePublicacion = (campId, pubId) => {
    const camp = campaigns.find((c) => c.id === campId);
    if (!camp) return;
    const pubs = (camp.publicaciones || []).filter((p) => p.id !== pubId);
    saveCampaign({ ...camp, publicaciones: pubs });
    reloadData();
  };

  // Ejecutar análisis CM
  const handleRunCmAnalysis = () => {
    if (!cmInputMessage.trim()) return;
    const res = classifyAndGenerateCmResponse(cmInputMessage, cmChannel);
    setCmAnalysis(res);
    setCmExtraCompany(res.extractedData.company || '');
    setCmExtraContact(res.extractedData.contact || `Contacto ${cmChannel}`);
  };

  // Inyectar a CRM
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
      alert(
        res.type === 'MATCH_EXPLICIT_MERGED'
          ? `Lead existente actualizado en CRM (ID: ${res.lead.lead_id})`
          : `Nuevo lead creado en CRM (ID: ${res.lead.lead_id})`
      );
      reloadData();
    } catch (err) {
      alert(`Error al registrar en CRM: ${err.message}`);
    }
  };

  const activeCampaignsCount = useMemo(() => campaigns.filter((c) => c.estado === 'ACTIVA').length, [campaigns]);

  return (
    <div className="gestion-module-container">
      {/* Encabezado del Módulo Canónico AIRO */}
      <div className="gestion-module-header">
        <div className="section-eyebrow">
          <span className="num">08</span> Marketing Multicanal & IAs Paralelas
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 className="display section-title">Marketing multicanal y agentes IA.</h2>
            <p className="section-sub">
              Planificación multicanal para <b>Instagram, WhatsApp, LinkedIn, Gmail y Facebook</b>, generador de prompts para IAs paralelas y flujo de validación humana (HITL).
            </p>
          </div>

          {/* Canales Oficiales Badge */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--neutral)', padding: '8px 16px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-strong)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-45)', marginRight: 4 }}>Canales Oficiales:</span>
            {MARKETING_CHANNELS.map((ch) => (
              <span
                key={ch.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11.5,
                  padding: '3px 10px',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  color: ch.color,
                  fontWeight: 600,
                }}
                title={ch.desc}
              >
                {renderChannelIcon(ch.id)}
                {ch.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs Editoriales AIRO */}
      <div className="gestion-kpis">
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Campañas Activas</div>
          <div className="gestion-kpi-val">{activeCampaignsCount}</div>
          <div className="gestion-kpi-sub">De {campaigns.length} campañas creadas</div>
        </div>
        <div className="gestion-kpi-card kpi-accent">
          <div className="gestion-kpi-label">Prompts en Biblioteca</div>
          <div className="gestion-kpi-val">{prompts.length}</div>
          <div className="gestion-kpi-sub">Fórmulas creadas para IAs paralelas</div>
        </div>
        <div className={`gestion-kpi-card ${pendingCount > 0 ? 'kpi-warning' : 'kpi-success'}`}>
          <div className="gestion-kpi-label">Aprobación HITL</div>
          <div className="gestion-kpi-val">{pendingCount}</div>
          <div className="gestion-kpi-sub">{pendingCount > 0 ? 'Prompts pendientes de revisión' : 'Todo revisado y aprobado'}</div>
        </div>
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Canales Conectados</div>
          <div className="gestion-kpi-val" style={{ fontSize: '1.25rem' }}>5 Canales</div>
          <div className="gestion-kpi-sub">Instagram, WhatsApp, LinkedIn, Gmail, Facebook</div>
        </div>
      </div>

      {/* Avisos */}
      {statusNotice && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 'var(--r-s, 8px)',
            fontSize: 13,
            background: statusNotice.type === 'info' ? 'rgba(0, 180, 216, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            color: statusNotice.type === 'info' ? '#0369a1' : '#065f46',
            border: `1px solid ${statusNotice.type === 'info' ? 'rgba(0, 180, 216, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          }}
        >
          {statusNotice.text}
        </div>
      )}

      {copyNotice && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'var(--ink)',
            color: 'var(--paper)',
            padding: '10px 18px',
            borderRadius: 'var(--r-pill)',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: 'var(--shadow-3)',
            zIndex: 9999,
          }}
        >
          {copyNotice}
        </div>
      )}

      {/* Subpestañas del Módulo */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--line)', marginTop: 10, paddingBottom: 12, flexWrap: 'wrap' }}>
        <button
          className={`g-btn ${activeSubTab === 'campaigns' ? 'g-btn-primary' : 'g-btn-outline'}`}
          style={{ fontSize: 13, padding: '8px 18px' }}
          onClick={() => setActiveSubTab('campaigns')}
        >
          Organizador de Campañas
        </button>
        <button
          className={`g-btn ${activeSubTab === 'prompts' ? 'g-btn-primary' : 'g-btn-outline'}`}
          style={{ fontSize: 13, padding: '8px 18px' }}
          onClick={() => setActiveSubTab('prompts')}
        >
          Generador de Prompts (IAs Paralelas)
        </button>
        <button
          className={`g-btn ${activeSubTab === 'approvals' ? 'g-btn-primary' : 'g-btn-outline'}`}
          style={{ fontSize: 13, padding: '8px 18px', position: 'relative' }}
          onClick={() => setActiveSubTab('approvals')}
        >
          Aprobación HITL de Prompts
          {pendingCount > 0 && (
            <span
              style={{
                marginLeft: 8,
                background: '#EF4444',
                color: '#FFFFFF',
                borderRadius: 10,
                padding: '1px 6px',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {pendingCount}
            </span>
          )}
        </button>
        <button
          className={`g-btn ${activeSubTab === 'cm' ? 'g-btn-primary' : 'g-btn-outline'}`}
          style={{ fontSize: 13, padding: '8px 18px' }}
          onClick={() => setActiveSubTab('cm')}
        >
          Asistente de Redes (CM) & CRM
        </button>
        <button
          className={`g-btn ${activeSubTab === 'agents' ? 'g-btn-primary' : 'g-btn-outline'}`}
          style={{ fontSize: 13, padding: '8px 18px' }}
          onClick={() => setActiveSubTab('agents')}
        >
          Directorio de Agentes IA
        </button>
      </div>

      {/* ========================================================
          SUBPESTAÑA 1: ORGANIZADOR DE CAMPAÑAS
          ======================================================== */}
      {activeSubTab === 'campaigns' && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#4B5563' }}>Filtrar estado:</span>
              <select
                className="gestion-input"
                style={{ width: 'auto', padding: '4px 10px' }}
                value={filterCampStatus}
                onChange={(e) => setFilterCampStatus(e.target.value)}
              >
                <option value="ALL">Todas las campañas</option>
                <option value="ACTIVA">Activas</option>
                <option value="PLANIFICADA">Planificadas</option>
                <option value="COMPLETADA">Completadas</option>
              </select>
            </div>
            <button
              className="gestion-btn gestion-btn--primary"
              onClick={() =>
                setModalCamp({
                  open: true,
                  data: {
                    id: '',
                    titulo: '',
                    objetivo: '',
                    canales: ['INSTAGRAM', 'LINKEDIN', 'WHATSAPP', 'GMAIL', 'FACEBOOK'],
                    fecha_inicio: new Date().toISOString().split('T')[0],
                    fecha_fin: '',
                    estado: 'PLANIFICADA',
                    kpi: '',
                    notas: '',
                    publicaciones: [],
                  },
                })
              }
            >
              <IconPlus /> Nueva Campaña
            </button>
          </div>

          {filteredCampaigns.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', background: '#FFFFFF', borderRadius: 8, border: '1px solid #E5E7EB', color: '#6B7280' }}>
              No hay campañas en este estado. Creá una nueva para coordinar los 5 canales de AIRO.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {filteredCampaigns.map((camp) => (
                <div
                  key={camp.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    padding: 20,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  {/* Encabezado de la campaña */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#111827' }}>{camp.titulo}</h2>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontWeight: 600,
                            background:
                              camp.estado === 'ACTIVA'
                                ? '#DCFCE7'
                                : camp.estado === 'PLANIFICADA'
                                ? '#FEF3C7'
                                : '#F3F4F6',
                            color:
                              camp.estado === 'ACTIVA'
                                ? '#166534'
                                : camp.estado === 'PLANIFICADA'
                                ? '#92400E'
                                : '#374151',
                          }}
                        >
                          {camp.estado}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#4B5563' }}>{camp.objetivo}</p>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="gestion-btn"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() =>
                          setModalPub({
                            open: true,
                            campId: camp.id,
                            data: {
                              id: '',
                              canal: 'INSTAGRAM',
                              formato: 'Carrusel 5 slides',
                              fecha: new Date().toISOString().split('T')[0],
                              titulo: '',
                              estado: 'BORRADOR',
                              prompt_ref: null,
                            },
                          })
                        }
                      >
                        <IconPlus /> Agregar Publicación
                      </button>
                      <button
                        className="gestion-btn"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={() => setModalCamp({ open: true, data: { ...camp } })}
                        title="Editar Campaña"
                      >
                        <IconEdit />
                      </button>
                      <button
                        className="gestion-btn"
                        style={{ padding: '4px 8px', fontSize: 12, color: '#EF4444' }}
                        onClick={() => handleDeleteCampaign(camp)}
                        title="Eliminar Campaña"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>

                  {/* Metadatos y Canales */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 20,
                      alignItems: 'center',
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: '1px solid #F3F4F6',
                      flexWrap: 'wrap',
                      fontSize: 12,
                      color: '#6B7280',
                    }}
                  >
                    <div>
                      <b>Período:</b> {camp.fecha_inicio} al {camp.fecha_fin || 'Continuo'}
                    </div>
                    {camp.kpi && (
                      <div>
                        <b>KPI:</b> {camp.kpi}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <b>Canales:</b>
                      {(camp.canales || []).map((ch) => (
                        <span
                          key={ch}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '2px 6px',
                            background: '#F9FAFB',
                            border: '1px solid #E5E7EB',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {renderChannelIcon(ch)} {ch}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Lista de Publicaciones de la Campaña */}
                  <div style={{ marginTop: 16 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Publicaciones Coordinadas ({camp.publicaciones?.length || 0})
                    </h3>

                    {!camp.publicaciones || camp.publicaciones.length === 0 ? (
                      <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                        Sin publicaciones planificadas todavía. Podés sumar piezas para cada canal.
                      </p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280', textAlign: 'left' }}>
                              <th style={{ padding: '8px 10px' }}>Canal</th>
                              <th style={{ padding: '8px 10px' }}>Fecha</th>
                              <th style={{ padding: '8px 10px' }}>Formato</th>
                              <th style={{ padding: '8px 10px' }}>Título / Pieza</th>
                              <th style={{ padding: '8px 10px' }}>Estado</th>
                              <th style={{ padding: '8px 10px' }}>Prompt IA</th>
                              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {camp.publicaciones.map((pub) => (
                              <tr key={pub.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                    {renderChannelIcon(pub.canal)} {pub.canal}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 10px', color: '#4B5563' }}>{pub.fecha}</td>
                                <td style={{ padding: '8px 10px', color: '#4B5563' }}>{pub.formato}</td>
                                <td style={{ padding: '8px 10px', fontWeight: 600, color: '#111827' }}>{pub.titulo}</td>
                                <td style={{ padding: '8px 10px' }}>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      fontWeight: 600,
                                      background:
                                        pub.estado === 'PUBLICADA'
                                          ? '#DCFCE7'
                                          : pub.estado === 'PROGRAMADA'
                                          ? '#DBEAFE'
                                          : '#F3F4F6',
                                      color:
                                        pub.estado === 'PUBLICADA'
                                          ? '#166534'
                                          : pub.estado === 'PROGRAMADA'
                                          ? '#1E40AF'
                                          : '#374151',
                                    }}
                                  >
                                    {pub.estado}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  {pub.prompt_ref ? (
                                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#00B4D8' }}>
                                      {pub.prompt_ref}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="gestion-btn"
                                      style={{ padding: '2px 6px', fontSize: 10 }}
                                      onClick={() => {
                                        setPromptForm((prev) => ({
                                          ...prev,
                                          campaign_id: camp.id,
                                          canal: pub.canal,
                                          titulo: pub.titulo,
                                        }));
                                        setActiveSubTab('prompts');
                                      }}
                                    >
                                      Crear Prompt
                                    </button>
                                  )}
                                </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      className="g-btn g-btn-danger g-btn-sm"
                                      style={{ padding: '2px 8px', fontSize: 11 }}
                                      onClick={() => handleDeletePublicacion(camp.id, pub.id)}
                                      title="Eliminar publicación"
                                    >
                                      <IconClose size={12} />
                                    </button>
                                  </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          SUBPESTAÑA 2: GENERADOR DE PROMPTS PARA IAS PARALELAS
          ======================================================== */}
      {activeSubTab === 'prompts' && (
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          {/* Panel Izquierdo: Formulario de Creación / Generación */}
          <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E5E7EB', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' }}>
                {editingPromptId ? 'Editar Prompt (Requerirá Re-aprobación)' : 'Generador de Prompts para IAs Paralelas'}
              </h2>
              {editingPromptId && (
                <button
                  type="button"
                  className="gestion-btn"
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  onClick={() => {
                    setEditingPromptId(null);
                    setPromptForm((prev) => ({ ...prev, id: null, titulo: '', prompt_text: '' }));
                  }}
                >
                  Cancelar Edición
                </button>
              )}
            </div>

            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 16px 0' }}>
              Los prompts generados o modificados quedan en estado <b>PENDING</b> para aprobación humana (HITL) conforme a las normas operativas.
            </p>

            <form onSubmit={handleSavePrompt}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Tipo de Prompt */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Tipo de Contenido / IA Destino
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { id: 'COPY', label: 'Copywriting', sub: 'ChatGPT / Claude', icon: <IconPrompt /> },
                      { id: 'IMAGE', label: 'Foto Editorial', sub: 'Midjourney / Flux', icon: <IconImage /> },
                      { id: 'VIDEO', label: 'Video Cinemático', sub: 'Runway / Sora', icon: <IconVideo /> },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setPromptForm((prev) => ({
                            ...prev,
                            tipo: t.id,
                            modelo_destino:
                              t.id === 'IMAGE'
                                ? 'Midjourney / Flux / DALL-E'
                                : t.id === 'VIDEO'
                                ? 'Runway / Sora / Kling'
                                : 'ChatGPT / Claude / Gemini',
                          }))
                        }
                        style={{
                          padding: '10px 8px',
                          borderRadius: 6,
                          border: `1px solid ${promptForm.tipo === t.id ? 'var(--c-brand-blue, #1A4295)' : '#E5E7EB'}`,
                          background: promptForm.tipo === t.id ? 'rgba(26, 66, 149, 0.05)' : '#FFFFFF',
                          color: promptForm.tipo === t.id ? 'var(--c-brand-blue, #1A4295)' : '#4B5563',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{t.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{t.label}</div>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>{t.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Canal Oficial y Campaña */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                      Canal Oficial
                    </label>
                    <select
                      className="gestion-input"
                      value={promptForm.canal}
                      onChange={(e) => setPromptForm({ ...promptForm, canal: e.target.value })}
                    >
                      {MARKETING_CHANNELS.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                      Asociar a Campaña
                    </label>
                    <select
                      className="gestion-input"
                      value={promptForm.campaign_id}
                      onChange={(e) => setPromptForm({ ...promptForm, campaign_id: e.target.value })}
                    >
                      <option value="">Sin campaña específica</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.titulo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Parámetros para la generación de AIRO */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Prenda o Producto a Destacar
                  </label>
                  <input
                    type="text"
                    className="gestion-input"
                    value={promptForm.producto}
                    onChange={(e) => setPromptForm({ ...promptForm, producto: e.target.value })}
                    placeholder="ej: Hoodie frizado, remera peinada 24/1, tote bag..."
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Objetivo de Comunicación
                  </label>
                  <input
                    type="text"
                    className="gestion-input"
                    value={promptForm.objetivo}
                    onChange={(e) => setPromptForm({ ...promptForm, objetivo: e.target.value })}
                    placeholder="ej: Captar pedidos de merchandising corporativo para eventos"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Audiencia Target
                  </label>
                  <input
                    type="text"
                    className="gestion-input"
                    value={promptForm.audiencia}
                    onChange={(e) => setPromptForm({ ...promptForm, audiencia: e.target.value })}
                    placeholder="ej: Directores de marketing, productoras de eventos, agencias"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Contexto o Detalle Técnico Adicional (Opcional)
                  </label>
                  <input
                    type="text"
                    className="gestion-input"
                    value={promptForm.detalleExtra}
                    onChange={(e) => setPromptForm({ ...promptForm, detalleExtra: e.target.value })}
                    placeholder="ej: Destacar estampa DTF textil resistente a lavados industriales..."
                  />
                </div>

                {/* Botón de auto-generación asistida */}
                <div>
                  <button
                    type="button"
                    className="g-btn g-btn-outline"
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(0, 180, 216, 0.08)', borderColor: 'var(--cyan)', color: 'var(--cyan-ink)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    onClick={handleAutoGeneratePrompt}
                  >
                    <IconSparkles size={16} /> Formular Prompt con Criterios AIRO (Voseo, Mínimo 10, Hasselblad)
                  </button>
                </div>

                {/* Título y Contenido del Prompt */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Título / Referencia del Prompt *
                  </label>
                  <input
                    type="text"
                    className="gestion-input"
                    value={promptForm.titulo}
                    onChange={(e) => setPromptForm({ ...promptForm, titulo: e.target.value })}
                    placeholder="ej: Copy Carrusel Bienvenida Corporativa"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Prompt Final para la IA Paralela *
                  </label>
                  <textarea
                    className="gestion-input"
                    rows={6}
                    value={promptForm.prompt_text}
                    onChange={(e) => setPromptForm({ ...promptForm, prompt_text: e.target.value })}
                    placeholder="Contenido exacto del prompt a copiar en ChatGPT, Midjourney, Sora..."
                    required
                  />
                </div>

                {promptForm.tipo !== 'COPY' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                      Prompt Negativo (Evitar en la generación visual)
                    </label>
                    <textarea
                      className="gestion-input"
                      rows={2}
                      value={promptForm.prompt_negativo}
                      onChange={(e) => setPromptForm({ ...promptForm, prompt_negativo: e.target.value })}
                      placeholder="blurry, low resolution, cheap fabric, synthetic sheen..."
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button type="submit" className="gestion-btn gestion-btn--primary" style={{ flex: 1 }}>
                    Guardar Prompt (Enviar a Aprobación HITL)
                  </button>
                  {promptForm.prompt_text && (
                    <button
                      type="button"
                      className="gestion-btn"
                      onClick={() => copyToClipboard(promptForm.prompt_text, 'Prompt')}
                    >
                      Copiar
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Panel Derecho: Lista de Prompts Existentes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E5E7EB', padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#111827' }}>
                  Banco de Prompts ({filteredPrompts.length})
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    className="gestion-input"
                    style={{ fontSize: 11, padding: '2px 8px', width: 'auto' }}
                    value={filterPromptStatus}
                    onChange={(e) => setFilterPromptStatus(e.target.value)}
                  >
                    <option value="ALL">Todos los estados</option>
                    <option value="APPROVED">Aprobados</option>
                    <option value="PENDING">Pendientes HITL</option>
                    <option value="REJECTED">Rechazados</option>
                  </select>
                  <select
                    className="gestion-input"
                    style={{ fontSize: 11, padding: '2px 8px', width: 'auto' }}
                    value={filterPromptTipo}
                    onChange={(e) => setFilterPromptTipo(e.target.value)}
                  >
                    <option value="ALL">Todos los tipos</option>
                    <option value="COPY">Copy</option>
                    <option value="IMAGE">Imagen</option>
                    <option value="VIDEO">Video</option>
                  </select>
                </div>
              </div>

              {filteredPrompts.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: '20px 0', textAlign: 'center' }}>
                  No se encontraron prompts con los filtros aplicados.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 680, overflowY: 'auto' }}>
                  {filteredPrompts.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: 14,
                        borderRadius: 6,
                        border: '1px solid #E5E7EB',
                        background: '#F9FAFB',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: p.tipo === 'COPY' ? '#E0F2FE' : p.tipo === 'IMAGE' ? '#FCE7F3' : '#FEF3C7',
                                color: p.tipo === 'COPY' ? '#0369A1' : p.tipo === 'IMAGE' ? '#BE185D' : '#92400E',
                              }}
                            >
                              {p.tipo}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#4B5563', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              {renderChannelIcon(p.canal)} {p.canal}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                padding: '1px 6px',
                                borderRadius: 10,
                                fontWeight: 700,
                                background:
                                  p.estado_aprobacion === 'APPROVED'
                                    ? '#DCFCE7'
                                    : p.estado_aprobacion === 'PENDING'
                                    ? '#FEF3C7'
                                    : '#FEE2E2',
                                color:
                                  p.estado_aprobacion === 'APPROVED'
                                    ? '#166534'
                                    : p.estado_aprobacion === 'PENDING'
                                    ? '#92400E'
                                    : '#991B1B',
                              }}
                            >
                              {p.estado_aprobacion === 'APPROVED' ? 'Aprobado' : p.estado_aprobacion === 'PENDING' ? 'Pendiente HITL' : 'Rechazado'}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginTop: 4 }}>{p.titulo}</div>
                          <div style={{ fontSize: 11, color: '#6B7280' }}>Destino: {p.modelo_destino}</div>
                        </div>

                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            className="gestion-btn"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => copyToClipboard(p.prompt_text, 'Prompt')}
                            title="Copiar prompt listo para IA"
                          >
                            Copiar
                          </button>
                          <button
                            type="button"
                            className="gestion-btn"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => handleEditPrompt(p)}
                            title="Editar prompt"
                          >
                            <IconEdit />
                          </button>
                          <button
                            type="button"
                            className="gestion-btn"
                            style={{ padding: '3px 8px', fontSize: 11, color: '#EF4444' }}
                            onClick={() => handleDeletePrompt(p)}
                            title="Eliminar prompt"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 10,
                          padding: 10,
                          background: '#FFFFFF',
                          borderRadius: 4,
                          border: '1px solid #E5E7EB',
                          fontSize: 12,
                          color: '#374151',
                          maxHeight: 120,
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          fontFamily: p.tipo === 'COPY' ? 'inherit' : 'monospace',
                        }}
                      >
                        {p.prompt_text}
                      </div>

                      {p.observaciones_rechazo && (
                        <div style={{ marginTop: 6, fontSize: 11, color: '#991B1B', background: '#FEE2E2', padding: '4px 8px', borderRadius: 4 }}>
                          <b>Observación rechazo:</b> {p.observaciones_rechazo}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SUBPESTAÑA 3: APROBACIÓN HITL DE PROMPTS
          ======================================================== */}
      {activeSubTab === 'approvals' && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              padding: 16,
              background: '#FFFBEB',
              borderRadius: 8,
              border: '1px solid #FCD34D',
              marginBottom: 20,
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px 0', color: '#92400E' }}>
              Control Humano en el Bucle (HITL-2) — Aprobación de Prompts
            </h3>
            <p style={{ fontSize: 12, margin: 0, color: '#78350F' }}>
              Regla de negocio: Toda creación o modificación de prompts para IAs paralelas debe ser validada por un administrador antes de su utilización en producción.
            </p>
          </div>

          {pendingPrompts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', background: '#FFFFFF', borderRadius: 8, border: '1px solid #E5E7EB', color: '#166534' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                <IconCheck />
              </div>
              <b>No hay prompts pendientes de aprobación.</b>
              <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0 0' }}>
                Todos los prompts activos han sido revisados y autorizados conforme a los estándares de marca de AIRO.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pendingPrompts.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    padding: 20,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: p.tipo === 'COPY' ? '#E0F2FE' : p.tipo === 'IMAGE' ? '#FCE7F3' : '#FEF3C7',
                            color: p.tipo === 'COPY' ? '#0369A1' : p.tipo === 'IMAGE' ? '#BE185D' : '#92400E',
                          }}
                        >
                          {p.tipo}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#4B5563', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {renderChannelIcon(p.canal)} {p.canal}
                        </span>
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>• Creado: {new Date(p.actualizado_en).toLocaleDateString()}</span>
                      </div>
                      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '6px 0 2px 0' }}>{p.titulo}</h2>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>Modelo destino: <b>{p.modelo_destino}</b></div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="g-btn g-btn-sm"
                        style={{ background: '#DCFCE7', borderColor: '#86EFAC', color: '#166534', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        onClick={() => handleOpenDecision(p, 'APPROVED')}
                      >
                        <IconCheck size={14} /> Aprobar Prompt
                      </button>
                      <button
                        className="g-btn g-btn-outline g-btn-sm"
                        style={{ background: '#FEE2E2', borderColor: '#FCA5A5', color: '#991B1B', fontWeight: 600 }}
                        onClick={() => handleOpenDecision(p, 'REJECTED')}
                      >
                        Rechazar / Solicitar Ajustes
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      background: '#F9FAFB',
                      borderRadius: 6,
                      border: '1px solid #E5E7EB',
                      fontSize: 13,
                      color: '#1F2937',
                      whiteSpace: 'pre-wrap',
                      fontFamily: p.tipo === 'COPY' ? 'inherit' : 'monospace',
                    }}
                  >
                    {p.prompt_text}
                  </div>

                  {p.prompt_negativo && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#6B7280' }}>
                      <b>Negativo:</b> {p.prompt_negativo}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          SUBPESTAÑA 4: ASISTENTE DE REDES (CM) & CRM
          ======================================================== */}
      {activeSubTab === 'cm' && (
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E5E7EB', padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0', color: '#111827' }}>
              Simulador & Clasificador de Consultas Entrantes
            </h2>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 16px 0' }}>
              Analiza mensajes recibidos en cualquiera de los 5 canales, clasifica la intención, genera la respuesta con tono rioplatense y deriva directamente al CRM.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Canal de Entrada
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {MARKETING_CHANNELS.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setCmChannel(ch.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: `1px solid ${cmChannel === ch.id ? ch.color : '#E5E7EB'}`,
                        background: cmChannel === ch.id ? `${ch.color}15` : '#FFFFFF',
                        color: cmChannel === ch.id ? ch.color : '#4B5563',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {renderChannelIcon(ch.id)} {ch.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Mensaje Recibido
                </label>
                <textarea
                  className="gestion-input"
                  rows={4}
                  value={cmInputMessage}
                  onChange={(e) => setCmInputMessage(e.target.value)}
                  placeholder="Pegá aquí el mensaje enviado por el prospecto..."
                />
              </div>

              <button
                type="button"
                className="gestion-btn gestion-btn--primary"
                onClick={handleRunCmAnalysis}
              >
                Analizar con Agente CM
              </button>
            </div>
          </div>

          {/* Resultado del Análisis CM */}
          <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E5E7EB', padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0', color: '#111827' }}>
              Respuesta Sugerida & Ficha para CRM
            </h2>

            {!cmAnalysis ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', margin: '40px 0', textAlign: 'center' }}>
                Hacé click en "Analizar con Agente CM" para clasificar la consulta.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: '#DBEAFE',
                      color: '#1E40AF',
                    }}
                  >
                    {cmAnalysis.categoryLabel}
                  </span>
                  <span style={{ fontSize: 12, color: '#6B7280' }}>
                    Agente asignado: <b>{cmAnalysis.agentId}</b>
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Respuesta Oficial Sugerida (Voseo Profesional)
                  </label>
                  <div
                    style={{
                      padding: 12,
                      background: '#F9FAFB',
                      borderRadius: 6,
                      border: '1px solid #E5E7EB',
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: '#111827',
                    }}
                  >
                    {cmAnalysis.proposedResponse}
                  </div>
                  <button
                    type="button"
                    className="gestion-btn"
                    style={{ marginTop: 6, fontSize: 11 }}
                    onClick={() => copyToClipboard(cmAnalysis.proposedResponse, 'Respuesta')}
                  >
                    Copiar Respuesta
                  </button>
                </div>

                {/* Campos para Inyección en CRM */}
                <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                    Datos para el CRM
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: '#6B7280' }}>Empresa</label>
                      <input
                        type="text"
                        className="gestion-input"
                        value={cmExtraCompany}
                        onChange={(e) => setCmExtraCompany(e.target.value)}
                        placeholder="Nombre empresa"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#6B7280' }}>Contacto</label>
                      <input
                        type="text"
                        className="gestion-input"
                        value={cmExtraContact}
                        onChange={(e) => setCmExtraContact(e.target.value)}
                        placeholder="Nombre persona"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#6B7280' }}>Teléfono / WhatsApp</label>
                      <input
                        type="text"
                        className="gestion-input"
                        value={cmExtraPhone}
                        onChange={(e) => setCmExtraPhone(e.target.value)}
                        placeholder="11-xxxx-xxxx"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#6B7280' }}>Email Corporativo</label>
                      <input
                        type="email"
                        className="gestion-input"
                        value={cmExtraEmail}
                        onChange={(e) => setCmExtraEmail(e.target.value)}
                        placeholder="contacto@empresa.com"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="gestion-btn gestion-btn--primary"
                    style={{ width: '100%', marginTop: 12 }}
                    onClick={handleInjectToCrm}
                  >
                    Guardar / Derivar a CRM Unificado
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          SUBPESTAÑA 5: DIRECTORIO DE AGENTES DE IA
          ======================================================== */}
      {activeSubTab === 'agents' && (
        <div style={{ marginTop: 20 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E5E7EB', padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px 0', color: '#111827' }}>
              Registry de Agentes de IA Especializados ({agentsList.length})
            </h2>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 16px 0' }}>
              Catálogo formal de agentes que componen el sistema autónomo y asistido de marketing de AIRO Color Lab.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>ID</th>
                    <th style={{ padding: '10px 12px' }}>Canal / Módulo</th>
                    <th style={{ padding: '10px 12px' }}>Nombre del Agente</th>
                    <th style={{ padding: '10px 12px' }}>Rol Operativo</th>
                    <th style={{ padding: '10px 12px' }}>Responsabilidad</th>
                    <th style={{ padding: '10px 12px' }}>Nivel HITL</th>
                  </tr>
                </thead>
                <tbody>
                  {agentsList.map((ag) => (
                    <tr key={ag.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#1A4295' }}>
                        {ag.id}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{ag.module}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>{ag.name}</td>
                      <td style={{ padding: '10px 12px', color: '#4B5563' }}>{ag.role}</td>
                      <td style={{ padding: '10px 12px', color: '#374151', maxWidth: 360 }}>{ag.responsibility}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontWeight: 700,
                            background: ag.hitl >= 2 ? '#FEF3C7' : '#F3F4F6',
                            color: ag.hitl >= 2 ? '#92400E' : '#374151',
                          }}
                        >
                          HITL-{ag.hitl}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODALES
          ======================================================== */}
      {/* Modal Decisión HITL */}
      {modalDecision.open && modalDecision.prompt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 8,
              padding: 24,
              maxWidth: 520,
              width: '90%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 10px 0', color: '#111827' }}>
              {modalDecision.decision === 'APPROVED' ? 'Aprobar Prompt para Producción' : 'Rechazar Prompt / Solicitar Ajustes'}
            </h3>
            <p style={{ fontSize: 13, color: '#4B5563', margin: '0 0 14px 0' }}>
              Prompt: <b>{modalDecision.prompt.titulo}</b> ({modalDecision.prompt.tipo} / {modalDecision.prompt.canal})
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Observaciones o Justificación de la Decisión
              </label>
              <textarea
                className="gestion-input"
                rows={3}
                value={modalDecision.notes}
                onChange={(e) => setModalDecision({ ...modalDecision, notes: e.target.value })}
                placeholder="Ingresá los comentarios que se registrarán en la auditoría..."
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="gestion-btn"
                onClick={() => setModalDecision({ open: false, prompt: null, decision: 'APPROVED', notes: '' })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`gestion-btn ${modalDecision.decision === 'APPROVED' ? 'gestion-btn--primary' : ''}`}
                style={modalDecision.decision === 'REJECTED' ? { background: '#EF4444', color: '#fff', borderColor: '#EF4444' } : {}}
                onClick={handleConfirmDecision}
              >
                {modalDecision.decision === 'APPROVED' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Campaña */}
      {modalCamp.open && modalCamp.data && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 8,
              padding: 24,
              maxWidth: 580,
              width: '90%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px 0', color: '#111827' }}>
              {modalCamp.data.id ? 'Editar Campaña' : 'Nueva Campaña Multicanal'}
            </h3>

            <form onSubmit={handleSaveCampaign}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Título de la Campaña *
                  </label>
                  <input
                    type="text"
                    className="gestion-input"
                    value={modalCamp.data.titulo}
                    onChange={(e) => setModalCamp({ ...modalCamp, data: { ...modalCamp.data, titulo: e.target.value } })}
                    placeholder="ej: Colección Cápsula Eventos Corporativos Q4"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Objetivo Principal
                  </label>
                  <input
                    type="text"
                    className="gestion-input"
                    value={modalCamp.data.objetivo}
                    onChange={(e) => setModalCamp({ ...modalCamp, data: { ...modalCamp.data, objetivo: e.target.value } })}
                    placeholder="ej: Captar 35 cotizaciones de merchandising para fin de año"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                      Fecha Inicio
                    </label>
                    <input
                      type="date"
                      className="gestion-input"
                      value={modalCamp.data.fecha_inicio}
                      onChange={(e) => setModalCamp({ ...modalCamp, data: { ...modalCamp.data, fecha_inicio: e.target.value } })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                      Fecha Fin
                    </label>
                    <input
                      type="date"
                      className="gestion-input"
                      value={modalCamp.data.fecha_fin || ''}
                      onChange={(e) => setModalCamp({ ...modalCamp, data: { ...modalCamp.data, fecha_fin: e.target.value } })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                      Estado
                    </label>
                    <select
                      className="gestion-input"
                      value={modalCamp.data.estado}
                      onChange={(e) => setModalCamp({ ...modalCamp, data: { ...modalCamp.data, estado: e.target.value } })}
                    >
                      <option value="PLANIFICADA">Planificada</option>
                      <option value="ACTIVA">Activa</option>
                      <option value="COMPLETADA">Completada</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                      KPI Medible
                    </label>
                    <input
                      type="text"
                      className="gestion-input"
                      value={modalCamp.data.kpi || ''}
                      onChange={(e) => setModalCamp({ ...modalCamp, data: { ...modalCamp.data, kpi: e.target.value } })}
                      placeholder="ej: 30 leads B2B"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Notas de Taller / Confección
                  </label>
                  <textarea
                    className="gestion-input"
                    rows={2}
                    value={modalCamp.data.notas || ''}
                    onChange={(e) => setModalCamp({ ...modalCamp, data: { ...modalCamp.data, notas: e.target.value } })}
                    placeholder="Detalles sobre prendas foco, gramajes, técnicas..."
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button type="button" className="gestion-btn" onClick={() => setModalCamp({ open: false, data: null })}>
                    Cancelar
                  </button>
                  <button type="submit" className="gestion-btn gestion-btn--primary">
                    Guardar Campaña
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Publicación de Campaña */}
      {modalPub.open && modalPub.data && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 8,
              padding: 24,
              maxWidth: 500,
              width: '90%',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px 0', color: '#111827' }}>
              {modalPub.data.id ? 'Editar Publicación' : 'Nueva Publicación para la Campaña'}
            </h3>

            <form onSubmit={handleSavePublicacion}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Canal Oficial
                  </label>
                  <select
                    className="gestion-input"
                    value={modalPub.data.canal}
                    onChange={(e) => setModalPub({ ...modalPub, data: { ...modalPub.data, canal: e.target.value } })}
                  >
                    {MARKETING_CHANNELS.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Título / Concepto de la Pieza *
                  </label>
                  <input
                    type="text"
                    className="gestion-input"
                    value={modalPub.data.titulo}
                    onChange={(e) => setModalPub({ ...modalPub, data: { ...modalPub.data, titulo: e.target.value } })}
                    placeholder="ej: Guía de Welcome Kits Textiles"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                      Formato
                    </label>
                    <input
                      type="text"
                      className="gestion-input"
                      value={modalPub.data.formato}
                      onChange={(e) => setModalPub({ ...modalPub, data: { ...modalPub.data, formato: e.target.value } })}
                      placeholder="Carrusel, Reel, Post..."
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                      Fecha Prevista
                    </label>
                    <input
                      type="date"
                      className="gestion-input"
                      value={modalPub.data.fecha}
                      onChange={(e) => setModalPub({ ...modalPub, data: { ...modalPub.data, fecha: e.target.value } })}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Estado
                  </label>
                  <select
                    className="gestion-input"
                    value={modalPub.data.estado}
                    onChange={(e) => setModalPub({ ...modalPub, data: { ...modalPub.data, estado: e.target.value } })}
                  >
                    <option value="BORRADOR">Borrador</option>
                    <option value="PROGRAMADA">Programada</option>
                    <option value="PUBLICADA">Publicada</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button type="button" className="gestion-btn" onClick={() => setModalPub({ open: false, campId: null, data: null })}>
                    Cancelar
                  </button>
                  <button type="submit" className="gestion-btn gestion-btn--primary">
                    Guardar Publicación
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
