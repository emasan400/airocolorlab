import { useState, useMemo, useRef, useEffect } from 'react';
import catalogoData from '../../data/catalogo.json';
import {
  DESIGN_FORMATS,
  getDesignCanvases,
  saveDesignCanvas,
  deleteDesignCanvas,
  exportToObsidianCanvasJson,
  importFromObsidianCanvasJson,
  evaluateBrandQaLint,
  packageCanvasToHitlApproval,
} from '../services/storageService.js';
import {
  IconCanvas,
  IconSparkles,
  IconCheck,
  IconWarning,
  IconPlus,
  IconTrash,
  IconDownload,
  IconPlay,
  IconLayers,
  IconClose,
  IconStore,
} from './Icons.jsx';

const BRAND_SWATCHES = [
  { label: 'Azul Profundo', hex: '#1a4295', textDefault: '#fefffe' },
  { label: 'Cian AIRO (Oscuro)', hex: '#00b4d8', textDefault: '#111111' },
  { label: 'Cyan Ink AA', hex: '#0e7490', textDefault: '#fefffe' },
  { label: 'Negro Ink', hex: '#111111', textDefault: '#fefffe' },
  { label: 'Blanco Paper', hex: '#ffffff', textDefault: '#111111' },
  { label: 'Gris Neutro UI', hex: '#f4f6f8', textDefault: '#111111' },
];

export default function DesignStudioModule({ onNavigateTab, onContentChanged }) {
  const [canvases, setCanvases] = useState(() => getDesignCanvases());
  const [activeCanvasId, setActiveCanvasId] = useState(() => getDesignCanvases()[0]?.id || null);
  const [selectedNodeId, setSelectedNodeId] = useState('node-slide-1');
  const [zoom, setZoom] = useState(0.92);
  const [pan, setPan] = useState({ x: 10, y: 10 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState(null);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [showCatalogDrawer, setShowCatalogDrawer] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationIdx, setPresentationIdx] = useState(0);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState(null);

  const viewportRef = useRef(null);

  const catalogProducts = useMemo(() => catalogoData?.productos || [], []);
  const activeProducts = useMemo(() => catalogProducts.filter((p) => p.activo), [catalogProducts]);
  const inactiveProducts = useMemo(() => catalogProducts.filter((p) => !p.activo), [catalogProducts]);

  const activeCanvas = useMemo(
    () => canvases.find((c) => c.id === activeCanvasId) || canvases[0] || null,
    [canvases, activeCanvasId]
  );

  const selectedNode = useMemo(() => {
    if (!activeCanvas) return null;
    return (activeCanvas.nodes || []).find((n) => n.id === selectedNodeId) || null;
  }, [activeCanvas, selectedNodeId]);

  const slideNodes = useMemo(() => {
    if (!activeCanvas) return [];
    return (activeCanvas.nodes || [])
      .filter((n) => n.type === 'slide')
      .sort((a, b) => (Number(a.slideOrder) || 0) - (Number(b.slideOrder) || 0));
  }, [activeCanvas]);

  const currentFormatDef = useMemo(() => {
    const fmtId = activeCanvas?.formato || 'IG_CAROUSEL';
    return DESIGN_FORMATS.find((f) => f.id === fmtId) || DESIGN_FORMATS[0];
  }, [activeCanvas]);

  // Evaluación en vivo X-03 Content QA + X-04 Brand Guardian sobre el lienzo y nodo activo
  const liveQaReport = useMemo(() => {
    if (!activeCanvas) {
      return { status: 'PASS', score: 100, issues: [], passedChecks: [] };
    }
    const targetNode = selectedNode && selectedNode.type !== 'group' ? selectedNode : slideNodes[0];
    const combinedSlidesText = slideNodes.map((s) => s.text || '').join(' ');
    return evaluateBrandQaLint({
      text: targetNode ? `${targetNode.text || ''} ${combinedSlidesText}` : combinedSlidesText,
      bgHex: targetNode?.bgHex || '#ffffff',
      textHex: targetNode?.textHex || '#111111',
      format: activeCanvas.formato || 'IG_CAROUSEL',
      slideCount: slideNodes.length,
      productId: targetNode?.productId || activeCanvas.producto_id,
      catalogItems: catalogProducts,
    });
  }, [activeCanvas, selectedNode, slideNodes, catalogProducts]);

  useEffect(() => {
    if (!presentationMode) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setPresentationMode(false);
      if (e.key === 'ArrowRight') {
        setPresentationIdx((i) => Math.min(Math.max(0, slideNodes.length - 1), i + 1));
      }
      if (e.key === 'ArrowLeft') {
        setPresentationIdx((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [presentationMode, slideNodes.length]);

  const showNotice = (msg, type = 'info') => {
    setFeedbackBanner({ msg, type });
    setTimeout(() => setFeedbackBanner(null), 4200);
  };

  const reloadCanvases = () => {
    const list = getDesignCanvases();
    setCanvases(list);
    if (onContentChanged) onContentChanged();
  };

  const updateActiveCanvas = (patch) => {
    if (!activeCanvas) return;
    const updated = saveDesignCanvas({
      ...activeCanvas,
      ...patch,
    });
    setCanvases(getDesignCanvases());
    setActiveCanvasId(updated.id);
    if (onContentChanged) onContentChanged();
  };

  const handleUpdateNode = (nodeId, patch) => {
    if (!activeCanvas) return;
    const nextNodes = (activeCanvas.nodes || []).map((n) =>
      n.id === nodeId ? { ...n, ...patch } : n
    );
    updateActiveCanvas({ nodes: nextNodes });
  };

  const handleAddSlideNode = () => {
    if (!activeCanvas) return;
    const nextOrder = slideNodes.length + 1;
    const lastSlide = slideNodes[slideNodes.length - 1];
    const newId = `node-slide-${Date.now().toString().slice(-4)}`;
    const newNode = {
      id: newId,
      type: 'slide',
      slideOrder: nextOrder,
      format: activeCanvas.formato || 'IG_CAROUSEL',
      x: lastSlide ? lastSlide.x + 295 : 450,
      y: lastSlide ? lastSlide.y : 90,
      width: 270,
      height: 365,
      color: '#1a4295',
      bgHex: '#ffffff',
      textHex: '#111111',
      title: `Slide 0${nextOrder} · Desarrollo B2B`,
      text: 'Personalizamos tu proyecto desde 10 unidades (en múltiplos de 10). Escribinos por WhatsApp al 11-6355-3443 y te cotizamos en menos de 24 h hábiles.',
      promptText: 'editorial textile studio photography, combed cotton fabric and precision DTF print details, deep blue #1A4295 and cyan #00B4D8 accents, natural window light, photorealistic, no text, no letters, no logos',
      productId: activeCanvas.producto_id || 'p1',
    };

    const nextEdges = [...(activeCanvas.edges || [])];
    if (lastSlide) {
      nextEdges.push({
        id: `edge-${Date.now().toString().slice(-4)}`,
        fromNode: lastSlide.id,
        toNode: newId,
        label: 'Secuencia',
      });
    }

    updateActiveCanvas({
      nodes: [...(activeCanvas.nodes || []), newNode],
      edges: nextEdges,
    });
    setSelectedNodeId(newId);
    showNotice(`Slide 0${nextOrder} agregado al lienzo.`);
  };

  const handleAddArtboardGroup = () => {
    if (!activeCanvas) return;
    const newId = `group-${Date.now().toString().slice(-4)}`;
    const newGroup = {
      id: newId,
      type: 'group',
      x: 80,
      y: 510,
      width: 580,
      height: 360,
      color: '#1a4295',
      label: 'NUEVO ARTBOARD · EXPLORACIÓN VISUAL',
    };
    updateActiveCanvas({
      nodes: [newGroup, ...(activeCanvas.nodes || [])],
    });
    setSelectedNodeId(newId);
    showNotice('Nuevo Artboard (Frame) creado en el lienzo.');
  };

  const handleInsertCatalogProduct = (prod) => {
    if (!activeCanvas) return;
    if (!prod.activo) {
      showNotice(`Bloqueo X-03: "${prod.nombre}" figura INACTIVO en catalogo.json y no puede promocionarse.`, 'error');
      return;
    }
    const newId = `node-prod-${prod.id_producto}-${Date.now().toString().slice(-3)}`;
    const prodNode = {
      id: newId,
      type: 'product',
      x: 60,
      y: 310,
      width: 295,
      height: 175,
      color: '#0e7490',
      bgHex: '#ffffff',
      textHex: '#111111',
      title: `${prod.id_producto.toUpperCase()} · ${prod.nombre}`,
      text: `${prod.descripcion} Especificaciones: ${(prod.especificaciones || []).join(', ')}. Mínimo 10 unidades.`,
      productId: prod.id_producto,
      imageUrl: prod.imagen_principal || '/imagenes/productos/lanyard.webp',
    };
    updateActiveCanvas({
      producto_id: prod.id_producto,
      producto_nombre: prod.nombre,
      nodes: [...(activeCanvas.nodes || []), prodNode],
    });
    setSelectedNodeId(newId);
    setShowCatalogDrawer(false);
    showNotice(`Producto activo "${prod.nombre}" insertado en el lienzo.`);
  };

  const handleDeleteSelectedNode = () => {
    if (!activeCanvas || !selectedNodeId) return;
    const nextNodes = (activeCanvas.nodes || []).filter((n) => n.id !== selectedNodeId);
    const nextEdges = (activeCanvas.edges || []).filter(
      (e) => e.fromNode !== selectedNodeId && e.toNode !== selectedNodeId
    );
    updateActiveCanvas({ nodes: nextNodes, edges: nextEdges });
    setSelectedNodeId(nextNodes[0]?.id || null);
    showNotice('Tarjeta eliminada del lienzo.');
  };

  const handleGenerateBlindPrompt = () => {
    if (!selectedNode) return;
    const prod = catalogProducts.find((p) => p.id_producto === (selectedNode.productId || activeCanvas?.producto_id)) || activeProducts[0];
    const generated = `commercial textile studio photography of ${prod ? prod.nombre : 'custom corporate apparel'} (${prod ? (prod.especificaciones || []).join(', ') : 'combed cotton and DTF print'}), clean worktable in Buenos Aires design studio, natural side lighting, brand color accents in deep navy #1A4295 and cyan #00B4D8 on neutral #F4F6F8 surface, shallow depth of field, high detail fabric texture, photorealistic, no text, no letters, no logos, no AI faces`;
    handleUpdateNode(selectedNode.id, { promptText: generated });
    showNotice('Prompt generativo blindado (Regla de Oro I-04: sin texto ni logos) generado.');
  };

  const handleCreateNewCanvas = () => {
    const created = saveDesignCanvas({
      titulo: `Estudio Creativo #${canvases.length + 1} — Campaña B2B`,
      canal: 'INSTAGRAM',
      formato: 'IG_CAROUSEL',
      producto_id: 'p1',
      producto_nombre: 'Lanyards Oficiales',
      nodes: [
        {
          id: 'group-init-1',
          type: 'group',
          x: 40,
          y: 40,
          width: 640,
          height: 430,
          color: '#1a4295',
          label: '01 · ARTBOARD PRINCIPAL (1080x1350)',
        },
        {
          id: 'slide-init-1',
          type: 'slide',
          slideOrder: 1,
          format: 'IG_CAROUSEL',
          x: 65,
          y: 85,
          width: 270,
          height: 360,
          color: '#1a4295',
          bgHex: '#1a4295',
          textHex: '#fefffe',
          title: 'Slide 01 · Hook Principal',
          text: 'Hacé que tu marca no pase desapercibida en tu próximo evento corporativo. Lanyards sublimados full color desde 10 unidades.',
          promptText: 'macro studio photography of custom sublimated lanyards with metal carabiner hooks on dark blue #1A4295 background with subtle cyan #00B4D8 lighting, photorealistic, no text, no letters, no logos',
          productId: 'p1',
        },
        {
          id: 'slide-init-2',
          type: 'slide',
          slideOrder: 2,
          format: 'IG_CAROUSEL',
          x: 365,
          y: 85,
          width: 270,
          height: 360,
          color: '#0e7490',
          bgHex: '#ffffff',
          textHex: '#111111',
          title: 'Slide 02 · CTA WhatsApp',
          text: 'Producimos en múltiplos de 10 con calidad de fábrica. Escribinos por WhatsApp al 11-6355-3443 y te respondemos en menos de 24 h hábiles.',
          promptText: 'hands inspecting polyester lanyard strap quality and metal clip in a real textile workshop, natural light, photorealistic, no text, no letters, no logos',
          productId: 'p1',
        },
      ],
      edges: [
        { id: 'e-init-1', fromNode: 'slide-init-1', toNode: 'slide-init-2', label: 'Continuidad' },
      ],
    });
    reloadCanvases();
    setActiveCanvasId(created.id);
    setSelectedNodeId('slide-init-1');
    showNotice('Nuevo lienzo llave en mano creado sin hoja en blanco.');
  };

  const handleExportObsidianCanvas = () => {
    if (!activeCanvas) return;
    const jsonStr = exportToObsidianCanvasJson(activeCanvas);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (activeCanvas.titulo || 'Lienzo-AIRO').replace(/[^a-zA-Z0-9_-]+/g, '-');
    a.download = `${safeName}.canvas`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotice('Archivo .canvas exportado (100% compatible con Boveda Airo Obsidian).');
  };

  const handleImportObsidianCanvas = () => {
    if (!importJsonText.trim()) return;
    try {
      const imported = importFromObsidianCanvasJson(
        importJsonText,
        importTitle.trim() || 'Lienzo Importado de Obsidian (.canvas)',
        activeCanvas?.canal || 'INSTAGRAM'
      );
      reloadCanvases();
      setActiveCanvasId(imported.id);
      setImportModalOpen(false);
      setImportJsonText('');
      setImportTitle('');
      showNotice(`Lienzo "${imported.titulo}" importado con éxito desde formato Obsidian .canvas.`);
    } catch (err) {
      showNotice(err.message, 'error');
    }
  };

  const handleSendToHitlQueue = () => {
    if (!activeCanvas) return;
    if (liveQaReport.status === 'FAIL') {
      showNotice('Corregí los errores críticos de QA (X-03/X-04) antes de enviar a la Cola HITL-2.', 'error');
      return;
    }
    try {
      const approval = packageCanvasToHitlApproval(activeCanvas.id);
      reloadCanvases();
      showNotice(`Artboard empaquetado como solicitud ${approval.id} en Cola HITL-2 (estado PENDING).`);
    } catch (err) {
      showNotice(err.message, 'error');
    }
  };

  // Eventos de arrastre en el lienzo
  const handleCanvasMouseDown = (e) => {
    if (e.target === viewportRef.current || e.target.classList.contains('airo-canvas-surface')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleNodeMouseDown = (e, node) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setDraggingNode({
      id: node.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: Number(node.x) || 0,
      origY: Number(node.y) || 0,
    });
  };

  const handleCanvasMouseMove = (e) => {
    if (draggingNode && activeCanvas) {
      const dx = (e.clientX - draggingNode.startX) / zoom;
      const dy = (e.clientY - draggingNode.startY) / zoom;
      const newX = Math.round(draggingNode.origX + dx);
      const newY = Math.round(draggingNode.origY + dy);
      setCanvases((prev) =>
        prev.map((c) => {
          if (c.id !== activeCanvas.id) return c;
          return {
            ...c,
            nodes: (c.nodes || []).map((n) =>
              n.id === draggingNode.id ? { ...n, x: newX, y: newY } : n
            ),
          };
        })
      );
      return;
    }
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleCanvasMouseUp = () => {
    if (draggingNode && activeCanvas) {
      saveDesignCanvas(activeCanvas);
      setDraggingNode(null);
    }
    setIsPanning(false);
  };

  // Cálculo de curvas Bezier entre nodos
  const renderedEdges = useMemo(() => {
    if (!activeCanvas) return [];
    const nodeMap = new Map((activeCanvas.nodes || []).map((n) => [n.id, n]));
    return (activeCanvas.edges || [])
      .map((edge) => {
        const from = nodeMap.get(edge.fromNode);
        const to = nodeMap.get(edge.toNode);
        if (!from || !to) return null;
        const x1 = (Number(from.x) || 0) + (Number(from.width) || 260);
        const y1 = (Number(from.y) || 0) + (Number(from.height) || 200) / 2;
        const x2 = Number(to.x) || 0;
        const y2 = (Number(to.y) || 0) + (Number(to.height) || 200) / 2;
        const ctrlOffset = Math.max(60, Math.abs(x2 - x1) * 0.45);
        const d = `M ${x1} ${y1} C ${x1 + ctrlOffset} ${y1}, ${x2 - ctrlOffset} ${y2}, ${x2} ${y2}`;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        return { ...edge, d, midX, midY, x2, y2 };
      })
      .filter(Boolean);
  }, [activeCanvas]);

  return (
    <div className="gestion-module-container">
      {/* Encabezado Editorial Canónico */}
      <div className="gestion-module-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="section-eyebrow">
            <span className="num">10</span> Estudio Creativo & Lienzo Infinito
          </div>
          <h2 className="display section-title">AIRO Design Studio y lienzo infinito.</h2>
          <p className="section-sub">
            Entorno visual tipo Figma/Miro sincronizado con Obsidian (.canvas), catálogo activo B2B, validador en vivo X-03/X-04 y envío directo a Cola HITL-2.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="g-btn g-btn-secondary" onClick={() => setShowCatalogDrawer((v) => !v)}>
            <IconStore size={15} /> Catálogo Activo ({activeProducts.length})
          </button>
          <button className="g-btn g-btn-secondary" onClick={() => setImportModalOpen(true)}>
            <IconLayers size={15} /> Importar .canvas
          </button>
          <button className="g-btn g-btn-secondary" onClick={handleExportObsidianCanvas}>
            <IconDownload size={15} /> Exportar a Obsidian (.canvas)
          </button>
          <button
            className="g-btn g-btn-secondary"
            onClick={() => {
              setPresentationIdx(0);
              setPresentationMode(true);
            }}
          >
            <IconPlay size={15} /> Modo Presentación ({slideNodes.length})
          </button>
          <button className="g-btn g-btn-primary" onClick={handleSendToHitlQueue}>
            <IconSparkles size={15} /> Enviar Artboard a Cola HITL-2
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div
          style={{
            marginBottom: 18,
            padding: '12px 18px',
            borderRadius: '12px',
            background: feedbackBanner.type === 'error' ? 'rgba(185, 28, 28, 0.1)' : 'rgba(26, 66, 149, 0.08)',
            border: `1px solid ${feedbackBanner.type === 'error' ? '#b91c1c' : '#1a4295'}`,
            color: feedbackBanner.type === 'error' ? '#991b1b' : '#1a4295',
            fontWeight: 600,
            fontSize: '0.88rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{feedbackBanner.msg}</span>
          {onNavigateTab && feedbackBanner.msg.includes('HITL-2') && (
            <button
              className="g-btn g-btn-primary"
              style={{ padding: '4px 12px', fontSize: '0.78rem' }}
              onClick={() => onNavigateTab('marketing')}
            >
              Ver en Agentes & Marketing
            </button>
          )}
        </div>
      )}

      {/* Tarjetas de KPIs Editoriales */}
      <div className="gestion-kpis">
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Lienzos Creativos (.canvas)</div>
          <div className="gestion-kpi-val">{canvases.length}</div>
          <div className="gestion-kpi-sub">{slideNodes.length} slides/wireframes en el lienzo activo</div>
        </div>
        <div className="gestion-kpi-card kpi-accent">
          <div className="gestion-kpi-label">Quality Gate X-03 + X-04</div>
          <div className="gestion-kpi-val" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{liveQaReport.status}</span>
            <span style={{ fontSize: '1rem', opacity: 0.85 }}>({liveQaReport.score}/100)</span>
          </div>
          <div className="gestion-kpi-sub">
            {liveQaReport.issues.length === 0
              ? 'Voseo, paleta AA y reglas B2B verificadas'
              : `${liveQaReport.issues.length} observación(es) detectada(s) en vivo`}
          </div>
        </div>
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Formato y Safe Zones</div>
          <div className="gestion-kpi-val" style={{ fontSize: '1.35rem' }}>
            {currentFormatDef.widthPx}×{currentFormatDef.heightPx} px
          </div>
          <div className="gestion-kpi-sub">
            Ratio {currentFormatDef.ratio} · Safe Zone {currentFormatDef.safeZonePx} px
          </div>
        </div>
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Catálogo B2B Conectado</div>
          <div className="gestion-kpi-val">{activeProducts.length} Activos</div>
          <div className="gestion-kpi-sub">{inactiveProducts.length} ítems inactivos bloqueados por QA</div>
        </div>
      </div>

      {/* Barra de Control del Estudio y Selector de Lienzo */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'var(--neutral)',
          borderRadius: '16px',
          border: '1px solid var(--line)',
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-70)' }}>
            Lienzo:
          </label>
          <select
            className="gestion-input"
            style={{ minWidth: 280, fontWeight: 600 }}
            value={activeCanvas?.id || ''}
            onChange={(e) => {
              setActiveCanvasId(e.target.value);
              setSelectedNodeId(null);
            }}
          >
            {canvases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo} ({c.canal})
              </option>
            ))}
          </select>

          <select
            className="gestion-input"
            style={{ width: 230 }}
            value={activeCanvas?.formato || 'IG_CAROUSEL'}
            onChange={(e) => {
              const fmt = DESIGN_FORMATS.find((f) => f.id === e.target.value) || DESIGN_FORMATS[0];
              updateActiveCanvas({ formato: fmt.id, canal: fmt.channel });
            }}
          >
            {DESIGN_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>

          <button className="g-btn g-btn-secondary" onClick={handleCreateNewCanvas}>
            <IconPlus size={14} /> Nuevo Lienzo
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="g-btn g-btn-secondary" onClick={handleAddSlideNode}>
            <IconPlus size={14} /> Agregar Slide
          </button>
          <button className="g-btn g-btn-secondary" onClick={handleAddArtboardGroup}>
            <IconCanvas size={14} /> Nuevo Artboard
          </button>
          <button
            className="g-btn g-btn-secondary"
            onClick={() => setShowSafeZones((v) => !v)}
            style={{
              background: showSafeZones ? 'rgba(0, 180, 216, 0.14)' : undefined,
              color: showSafeZones ? '#0e7490' : undefined,
            }}
          >
            Safe Zones: {showSafeZones ? 'ON' : 'OFF'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', padding: '4px 10px', borderRadius: 999, border: '1px solid var(--line)' }}>
            <button
              type="button"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700, padding: '0 6px' }}
              onClick={() => setZoom((z) => Math.max(0.55, Number((z - 0.1).toFixed(2))))}
            >
              -
            </button>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, minWidth: 44, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700, padding: '0 6px' }}
              onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
            >
              +
            </button>
            <button
              type="button"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--blue)', fontWeight: 600, marginLeft: 4 }}
              onClick={() => {
                setZoom(0.92);
                setPan({ x: 10, y: 10 });
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Drawer Desplegable del Catálogo B2B Real */}
      {showCatalogDrawer && (
        <div
          style={{
            marginBottom: 18,
            padding: 18,
            borderRadius: 16,
            background: '#ffffff',
            border: '1px solid var(--line-strong)',
            boxShadow: 'var(--shadow-2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--blue)' }}>
                Inyector de Productos Reales del Catálogo (catalogo.json).
              </strong>
              <div style={{ fontSize: '0.82rem', color: 'var(--ink-70)' }}>
                Hacé clic en un producto o pack activo para insertarlo como nodo en el lienzo. Los productos inactivos están bloqueados por regla X-03.
              </div>
            </div>
            <button className="g-btn g-btn-secondary" onClick={() => setShowCatalogDrawer(false)}>
              <IconClose size={14} /> Cerrar
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {catalogProducts.map((p) => (
              <div
                key={p.id_producto}
                onClick={() => handleInsertCatalogProduct(p)}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  border: `1px solid ${p.activo ? 'rgba(26, 66, 149, 0.2)' : 'rgba(185, 28, 28, 0.25)'}`,
                  background: p.activo ? '#ffffff' : 'rgba(244, 246, 248, 0.7)',
                  opacity: p.activo ? 1 : 0.6,
                  cursor: p.activo ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                {p.imagen_principal ? (
                  <img
                    src={p.imagen_principal}
                    alt={p.nombre}
                    style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--neutral)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                    {p.id_producto.toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.nombre}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: p.activo ? '#0e7490' : '#b91c1c', fontWeight: 600 }}>
                    {p.id_producto.toUpperCase()} · {p.activo ? 'ACTIVO (Min. 10 u.)' : 'INACTIVO — NO PROMOCIONAR'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grilla Principal: Lienzo Infinito + Inspector Lateral X-03/X-04 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 18, alignItems: 'start' }}>
        {/* LIENZO INFINITO TIPO FIGMA / OBSIDIAN CANVAS */}
        <div
          ref={viewportRef}
          className="airo-canvas-surface"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          style={{
            position: 'relative',
            height: 620,
            borderRadius: 20,
            overflow: 'hidden',
            border: '1px solid rgba(26, 66, 149, 0.18)',
            backgroundImage:
              'radial-gradient(rgba(26, 66, 149, 0.18) 1.35px, transparent 1.35px), radial-gradient(circle at 50% 35%, #ffffff 0%, #f4f6f8 100%)',
            backgroundSize: '22px 22px, 100% 100%',
            boxShadow: 'inset 0 2px 12px rgba(17, 17, 17, 0.04)',
            cursor: isPanning ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 1800,
              height: 1100,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* Capa SVG de Conectores Curvos Bezier */}
            <svg
              width={1800}
              height={1100}
              style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 2 }}
            >
              <defs>
                <marker id="airo-arrow" markerWidth="10" markerHeight="10" refX="7" refY="3.5" orient="auto">
                  <polygon points="0 0, 8 3.5, 0 7" fill="#00b4d8" />
                </marker>
              </defs>
              {renderedEdges.map((edge) => (
                <g key={edge.id}>
                  <path
                    d={edge.d}
                    fill="none"
                    stroke="#00b4d8"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    markerEnd="url(#airo-arrow)"
                    style={{ filter: 'drop-shadow(0 2px 5px rgba(0, 180, 216, 0.35))' }}
                  />
                  {edge.label && (
                    <g transform={`translate(${edge.midX - 38}, ${edge.midY - 12})`}>
                      <rect width="76" height="22" rx="11" fill="#111111" stroke="#00b4d8" strokeWidth="1" />
                      <text x="38" y="14.5" textAnchor="middle" fill="#fefffe" fontSize="10" fontWeight="600" fontFamily="Inter, sans-serif">
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              ))}
            </svg>

            {/* Nodos del Lienzo (Artboards y Tarjetas) */}
            {(activeCanvas?.nodes || []).map((node) => {
              const isSelected = node.id === selectedNodeId;
              if (node.type === 'group') {
                return (
                  <div
                    key={node.id}
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    style={{
                      position: 'absolute',
                      left: node.x,
                      top: node.y,
                      width: node.width,
                      height: node.height,
                      borderRadius: 24,
                      background: 'rgba(244, 246, 248, 0.55)',
                      border: isSelected ? '2px solid #00b4d8' : '1.5px dashed rgba(26, 66, 149, 0.28)',
                      zIndex: 1,
                      pointerEvents: 'auto',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: -13,
                        left: 18,
                        background: '#1a4295',
                        color: '#fefffe',
                        padding: '4px 12px',
                        borderRadius: 8,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        boxShadow: '0 4px 10px rgba(26, 66, 149, 0.22)',
                      }}
                    >
                      {node.label || 'ARTBOARD AIRO'}
                    </div>
                  </div>
                );
              }

              const nodeLint = evaluateBrandQaLint({
                text: node.text || '',
                bgHex: node.bgHex || '#ffffff',
                textHex: node.textHex || '#111111',
                format: activeCanvas?.formato || 'IG_CAROUSEL',
                slideCount: slideNodes.length,
                productId: node.productId || activeCanvas?.producto_id,
                catalogItems: catalogProducts,
              });

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  style={{
                    position: 'absolute',
                    left: node.x,
                    top: node.y,
                    width: node.width || 270,
                    height: node.height || 240,
                    borderRadius: 16,
                    background: node.bgHex || '#ffffff',
                    color: node.textHex || '#111111',
                    border: isSelected
                      ? '2.5px solid #00b4d8'
                      : '1px solid rgba(26, 66, 149, 0.16)',
                    boxShadow: isSelected
                      ? '0 0 0 4px rgba(0, 180, 216, 0.2), 0 18px 38px -10px rgba(26, 66, 149, 0.22)'
                      : '0 10px 28px -8px rgba(17, 17, 17, 0.1)',
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    zIndex: isSelected ? 5 : 3,
                    cursor: 'move',
                    overflow: 'hidden',
                  }}
                >
                  {/* Safe Zone superior simulada en nodos Slide */}
                  {showSafeZones && node.type === 'slide' && (
                    <div
                      style={{
                        borderBottom: '1px dashed rgba(0, 180, 216, 0.5)',
                        paddingBottom: 3,
                        marginBottom: 6,
                        fontSize: '9px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        opacity: 0.75,
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>SAFE ZONE ({currentFormatDef.safeZonePx}px)</span>
                      <span>{currentFormatDef.ratio}</span>
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'rgba(0, 180, 216, 0.18)',
                          color: node.bgHex === '#1a4295' || node.bgHex === '#111111' ? '#fefffe' : '#0e7490',
                        }}
                      >
                        {node.type.toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 999,
                          background:
                            nodeLint.status === 'PASS'
                              ? 'rgba(21, 128, 61, 0.18)'
                              : nodeLint.status === 'WARN'
                              ? 'rgba(180, 83, 9, 0.2)'
                              : 'rgba(185, 28, 28, 0.22)',
                          color:
                            node.bgHex === '#1a4295' || node.bgHex === '#111111'
                              ? '#fefffe'
                              : nodeLint.status === 'PASS'
                              ? '#15803d'
                              : nodeLint.status === 'WARN'
                              ? '#b45309'
                              : '#b91c1c',
                        }}
                      >
                        QA {nodeLint.status}
                      </span>
                    </div>

                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: '0.98rem',
                        marginBottom: 6,
                        lineHeight: 1.2,
                      }}
                    >
                      {node.title}.
                    </div>

                    {node.imageUrl && (
                      <img
                        src={node.imageUrl}
                        alt={node.title || 'Producto AIRO'}
                        style={{
                          width: '100%',
                          height: 68,
                          objectFit: 'cover',
                          borderRadius: 10,
                          marginBottom: 6,
                        }}
                      />
                    )}

                    <div style={{ fontSize: '0.8rem', lineHeight: 1.42, opacity: 0.94 }}>
                      {node.text}
                    </div>
                  </div>

                  {node.promptText && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '6px 8px',
                        borderRadius: 8,
                        background: 'rgba(17, 17, 17, 0.12)',
                        fontSize: '0.68rem',
                        lineHeight: 1.3,
                        maxHeight: 52,
                        overflow: 'hidden',
                      }}
                    >
                      <strong>Prompt IA (Sin texto):</strong> {node.promptText}
                    </div>
                  )}

                  {showSafeZones && node.type === 'slide' && (
                    <div
                      style={{
                        borderTop: '1px dashed rgba(0, 180, 216, 0.5)',
                        paddingTop: 3,
                        marginTop: 6,
                        fontSize: '9px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        opacity: 0.75,
                        textAlign: 'center',
                      }}
                    >
                      CTA WHATSAPP · MIN. 10 UNIDADES
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL LATERAL: INSPECTOR DE TARJETA + LINTER X-03/X-04 EN VIVO */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '1px solid var(--line)',
            padding: 18,
            boxShadow: 'var(--shadow-1)',
          }}
        >
          <div className="section-eyebrow" style={{ marginBottom: 4 }}>
            <span className="num">QA</span> Inspector & Brand Guardian
          </div>
          <h3 className="display" style={{ fontSize: '1.25rem', margin: '0 0 12px' }}>
            {selectedNode ? `Editar: ${selectedNode.title || selectedNode.label}.` : 'Seleccioná un nodo.'}
          </h3>

          {selectedNode && selectedNode.type !== 'group' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Título del Nodo / Slide
                </label>
                <input
                  type="text"
                  className="gestion-input"
                  value={selectedNode.title || ''}
                  onChange={(e) => handleUpdateNode(selectedNode.id, { title: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Copy B2B (Voseo Rioplatense + Regla 10 u. + CTA WhatsApp)
                </label>
                <textarea
                  className="gestion-input"
                  rows={4}
                  value={selectedNode.text || ''}
                  onChange={(e) => handleUpdateNode(selectedNode.id, { text: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  Paleta Oficial AIRO (Fondo de Tarjeta)
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {BRAND_SWATCHES.map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      title={sw.label}
                      onClick={() =>
                        handleUpdateNode(selectedNode.id, {
                          bgHex: sw.hex,
                          textHex: sw.textDefault,
                        })
                      }
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: sw.hex,
                        border: selectedNode.bgHex === sw.hex ? '2.5px solid #00b4d8' : '1px solid rgba(17,17,17,0.2)',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                    Prompt Generativo IA (Sin Texto / Regla I-04)
                  </label>
                  <button
                    type="button"
                    className="g-btn g-btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                    onClick={handleGenerateBlindPrompt}
                  >
                    Auto-Generar I-04
                  </button>
                </div>
                <textarea
                  className="gestion-input"
                  rows={3}
                  value={selectedNode.promptText || ''}
                  onChange={(e) => handleUpdateNode(selectedNode.id, { promptText: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  className="g-btn g-btn-secondary"
                  style={{ color: '#b91c1c' }}
                  onClick={handleDeleteSelectedNode}
                >
                  <IconTrash size={14} /> Eliminar Nodo
                </button>
              </div>
            </div>
          )}

          {/* Reporte de Validación en Vivo X-03 + X-04 */}
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: 'var(--neutral)',
              border: '1px solid var(--line)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: '0.82rem' }}>Auditoría en Vivo (X-03 + X-04)</strong>
              <span
                className={
                  liveQaReport.status === 'PASS'
                    ? 'g-badge g-badge-success'
                    : liveQaReport.status === 'WARN'
                    ? 'g-badge g-badge-warning'
                    : 'g-badge g-badge-danger'
                }
              >
                {liveQaReport.status} ({liveQaReport.score}%)
              </span>
            </div>

            {liveQaReport.issues.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {liveQaReport.issues.map((iss, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 8,
                      background: iss.level === 'FAIL' ? 'rgba(185, 28, 28, 0.1)' : 'rgba(180, 83, 9, 0.1)',
                      color: iss.level === 'FAIL' ? '#991b1b' : '#92400e',
                      fontSize: '0.75rem',
                      display: 'flex',
                      gap: 6,
                      alignItems: 'flex-start',
                    }}
                  >
                    <IconWarning size={14} />
                    <div>
                      <strong>[{iss.agent}] {iss.rule}:</strong> {iss.message}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {liveQaReport.passedChecks.map((chk, idx) => (
                <div
                  key={idx}
                  style={{ fontSize: '0.74rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <IconCheck size={13} /> <span>{chk}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Presentación Secuencial (Canvas Presentation) */}
      {presentationMode && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17, 17, 17, 0.88)',
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{ width: '100%', maxWidth: 680, background: '#ffffff', borderRadius: 24, padding: 28, boxShadow: 'var(--shadow-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span className="section-eyebrow" style={{ margin: 0 }}>
                MODO PRESENTACIÓN · SLIDE {presentationIdx + 1} DE {Math.max(1, slideNodes.length)}
              </span>
              <button className="g-btn g-btn-secondary" onClick={() => setPresentationMode(false)}>
                <IconClose size={15} /> Cerrar (Esc)
              </button>
            </div>

            {slideNodes[presentationIdx] ? (
              <div
                style={{
                  padding: 32,
                  borderRadius: 20,
                  background: slideNodes[presentationIdx].bgHex || '#1a4295',
                  color: slideNodes[presentationIdx].textHex || '#fefffe',
                  minHeight: 320,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <h3 className="display" style={{ fontSize: '1.8rem', marginBottom: 14, color: 'inherit' }}>
                    {slideNodes[presentationIdx].title}.
                  </h3>
                  <p style={{ fontSize: '1.12rem', lineHeight: 1.55 }}>
                    {slideNodes[presentationIdx].text}
                  </p>
                </div>
                {slideNodes[presentationIdx].promptText && (
                  <div style={{ marginTop: 20, padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.2)', fontSize: '0.8rem' }}>
                    <strong>Prompt Gemini Pro / Firefly:</strong> {slideNodes[presentationIdx].promptText}
                  </div>
                )}
              </div>
            ) : (
              <p>No hay nodos de tipo Slide en este lienzo.</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
              <button
                className="g-btn g-btn-secondary"
                disabled={presentationIdx === 0}
                onClick={() => setPresentationIdx((i) => Math.max(0, i - 1))}
              >
                Anterior
              </button>
              <button
                className="g-btn g-btn-primary"
                disabled={presentationIdx >= slideNodes.length - 1}
                onClick={() => setPresentationIdx((i) => Math.min(slideNodes.length - 1, i + 1))}
              >
                Siguiente Slide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Importar archivo .canvas desde Obsidian */}
      {importModalOpen && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17, 17, 17, 0.72)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{ width: '100%', maxWidth: 580, background: '#ffffff', borderRadius: 24, padding: 24 }}>
            <h3 className="display" style={{ fontSize: '1.4rem', marginTop: 0 }}>
              Importar Lienzo .canvas desde Obsidian.
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--ink-70)' }}>
              Pegá el contenido JSON de cualquier archivo <code>.canvas</code> de <code>Boveda Airo Obsidian</code> (estándar JSON Canvas 1.0).
            </p>
            <input
              type="text"
              className="gestion-input"
              placeholder="Título para el lienzo importado"
              value={importTitle}
              onChange={(e) => setImportTitle(e.target.value)}
              style={{ marginBottom: 10 }}
            />
            <textarea
              className="gestion-input"
              rows={7}
              placeholder='{"nodes": [...], "edges": [...]}'
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button className="g-btn g-btn-secondary" onClick={() => setImportModalOpen(false)}>
                Cancelar
              </button>
              <button className="g-btn g-btn-primary" onClick={handleImportObsidianCanvas}>
                Importar Lienzo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
