import { useState, useEffect, useMemo } from 'react';
import {
  SUITES_DOMINIO,
  PMBOK_PROCESS_GROUPS,
  PMBOK_KNOWLEDGE_AREAS,
  AIRO_COMPANY_WORKFLOWS,
  getPmbokTasks,
  savePmbokTask,
  movePmbokTaskPhase,
  togglePmbokSubtask,
  addPmbokSubtask,
  deletePmbokSubtask,
  deletePmbokTask,
  duplicatePmbokTask,
  quickAddPmbokTask,
  launchCompanyWorkflow,
  addPmbokTaskComment,
  togglePmbokTaskBlocker,
  logPmbokTaskTime,
  exportPmbokBoardToObsidianMarkdown,
  getKaizenCycles,
  saveKaizenCycle,
  advanceKaizenStage,
  getAutomationRecipes,
  toggleAutomationRecipe,
  getApprovals,
  getLeads,
  getDtfQuotes,
  getRemitos,
  getFlujoCaja,
  getProductos,
  getMateriales,
} from '../services/storageService.js';
import {
  IconLayers,
  IconCheck,
  IconPlus,
  IconRefresh,
  IconDownload,
  IconTrash,
  IconWarning,
  IconSparkles,
  IconFile,
  IconBriefcase,
  IconRuler,
  IconWallet,
  IconBox,
  IconFabric,
  IconCanvas,
  IconSearch,
  IconPlay,
} from './Icons.jsx';

const PDCA_STAGES = [
  { id: 'PLAN', num: '01', label: 'PLAN (Planificar)', desc: 'Identificar fricción, merma o cuello de botella y formular hipótesis', color: '#1a4295' },
  { id: 'DO', num: '02', label: 'DO (Hacer / Probar)', desc: 'Ejecutar mejora en entorno controlado sin afectar producción', color: '#0284c7' },
  { id: 'CHECK', num: '03', label: 'CHECK (Verificar KPI)', desc: 'Medir resultados antes vs. después con datos reales', color: '#b45309' },
  { id: 'ACT', num: '04', label: 'ACT (Estandarizar)', desc: 'Fijar nuevo estándar en Bóveda Obsidian y cerrar ciclo', color: '#15803d' },
];

const MODULE_LABELS = {
  pmbok_command: 'Comando PMBOK & Workflows',
  cotizador_dtf: 'Cotizador DTF 2D (MaxRects)',
  crm: 'CRM & Leads B2B',
  remitos: 'Confección de Remitos',
  productos: 'Productos en Stock',
  materiales: 'Insumos & Materiales',
  design_studio: 'Estudio de Diseño (.canvas)',
  marketing: 'Agentes & Marketing IA',
  caja: 'Flujo de Caja',
  catalogo: 'Catálogo Tienda Web',
  configuracion: 'Sincronización & Bóveda',
};

const BENCHMARK_14_APPS = [
  { num: '01', app: 'Trello', feature: 'Drag & Drop HTML5 entre columnas, portadas de color, etiquetas y clonación de tarjetas', status: 'ACTIVO' },
  { num: '02', app: 'Asana', feature: 'Plantillas de Workflows Empresariales (WF-01 a WF-06) y dependencias entre tareas', status: 'ACTIVO' },
  { num: '03', app: 'ClickUp', feature: 'Conmutador de 7 Vistas integradas sobre la misma base y prioridades granulares', status: 'ACTIVO' },
  { num: '04', app: 'Monday.com', feature: 'Dashboard Ejecutivo de Entrada (Work OS) y Motor de Recetas de Automatización', status: 'ACTIVO' },
  { num: '05', app: 'Jira', feature: 'Códigos WBS + TSK, límites WIP por columna con alerta y Flag Blocker conectado a RAID', status: 'ACTIVO' },
  { num: '06', app: 'Notion', feature: 'Notas técnicas Markdown en cada tarjeta e interoperabilidad nativa con Obsidian', status: 'ACTIVO' },
  { num: '07', app: 'Todoist', feature: 'Barra Quick Add en lenguaje natural (#etiqueta @responsable !prioridad ^fecha ~horas)', status: 'ACTIVO' },
  { num: '08', app: 'Microsoft Planner', feature: 'Previsualización interactiva de subtareas directamente en el frente de la tarjeta', status: 'ACTIVO' },
  { num: '09', app: 'Wrike', feature: 'Lanzador de Blueprints Operativos B2B y vista de Carga Horaria por Responsable', status: 'ACTIVO' },
  { num: '10', app: 'Linear', feature: 'Filtros instantáneos multicriterio (búsqueda, área, prioridad, bloqueos) y alta velocidad', status: 'ACTIVO' },
  { num: '11', app: 'Airtable', feature: 'Vínculos relacionales con módulos operativos (Salto 1-Click a Cotizador, CRM, Remitos, Caja)', status: 'ACTIVO' },
  { num: '12', app: 'Basecamp', feature: 'Gráfico de Colina (Hill Chart: Incertidumbre vs. Ejecución) y bitácora de comentarios', status: 'ACTIVO' },
  { num: '13', app: 'Smartsheet', feature: 'Grilla/Hoja de cálculo editable en línea con fila de Roll-up PMO (Horas Est. vs. Reales)', status: 'ACTIVO' },
  { num: '14', app: 'TickTick', feature: 'Temporizador Pomodoro de Taller en vivo y Matriz de Prioridades de Eisenhower (4 cuadrantes)', status: 'ACTIVO' },
];

export default function PmbokCommandModule({ onNavigateTab, onDataChanged }) {
  // 7 Vistas integradas:
  // 'dashboard_workflows' | 'kanban_pro' | 'mi_dia_eisenhower' | 'tabla_smartsheet' | 'cronograma_hill' | 'automatizaciones' | 'kaizen_pdca'
  const [subView, setSubView] = useState('dashboard_workflows');
  const [tasks, setTasks] = useState(() => getPmbokTasks());
  const [kaizenList, setKaizenList] = useState(() => getKaizenCycles());
  const [recipes, setRecipes] = useState(() => getAutomationRecipes());
  const [selectedTaskId, setSelectedTaskId] = useState(() => getPmbokTasks()[0]?.id || null);

  // Filtros Kanban Pro / Tabla (Linear / Jira)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterArea, setFilterArea] = useState('TODAS');
  const [filterPriority, setFilterPriority] = useState('TODAS');
  const [filterOnlyBlocked, setFilterOnlyBlocked] = useState(false);

  // Drag & Drop HTML5 (Trello)
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverGroupId, setDragOverGroupId] = useState(null);

  // Barra Quick Add NLP (Todoist / TickTick)
  const [quickAddInput, setQuickAddInput] = useState('');

  // Personalizador rápido para lanzar Workflows de Empresa (Asana / Wrike)
  const [workflowClientInput, setWorkflowClientInput] = useState('');
  const [workflowDueDate, setWorkflowDueDate] = useState(() => new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));

  // Temporizador Pomodoro / Cronómetro de Taller (TickTick)
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  // Inspector lateral: inputs auxiliares
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [newTagText, setNewTagText] = useState('');
  const [blockerReasonInput, setBlockerReasonInput] = useState('');

  // Modales de creación completa
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showNewKaizenModal, setShowNewKaizenModal] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState(null);

  const [taskForm, setTaskForm] = useState({
    wbs_code: '3.2.1',
    titulo: '',
    grupo_procesos: 'PLANIFICACION',
    area_conocimiento: 'ALCANCE',
    prioridad: 'ALTA',
    fecha_vencimiento: new Date().toISOString().slice(0, 10),
    esfuerzo_estimado_hs: 4,
    riesgo_asociado: 'NINGUNO',
    hitl: 'HITL-2',
    responsable: 'Equipo AIRO',
    modulo_vinculado: 'cotizador_dtf',
    color_portada: '#1a4295',
    etiquetas_str: 'B2B, Producción',
    primera_subtarea: '',
  });

  const [kaizenForm, setKaizenForm] = useState({
    titulo: '',
    etapa_pdca: 'PLAN',
    wbs_ref: '5.3.1',
    problema_detectado: '',
    hipotesis_mejora: '',
    kpi_impacto: '',
    leccion_aprendida: '',
  });

  const reloadAll = () => {
    const freshTasks = getPmbokTasks();
    setTasks(freshTasks);
    setKaizenList(getKaizenCycles());
    setRecipes(getAutomationRecipes());
    if (selectedTaskId && !freshTasks.some((t) => t.id === selectedTaskId)) {
      setSelectedTaskId(freshTasks[0]?.id || null);
    }
    if (onDataChanged) onDataChanged();
  };

  const notify = (msg, type = 'success') => {
    setFeedbackBanner({ msg, type });
    setTimeout(() => setFeedbackBanner(null), 4500);
  };

  // Efecto del Temporizador Pomodoro (TickTick)
  useEffect(() => {
    if (!timerRunning) return undefined;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          if (selectedTaskId) {
            logPmbokTaskTime(selectedTaskId, 0.42); // ~25 min = 0.42h
            reloadAll();
            notify('Bloque Pomodoro de 25 min completado y acreditado en Horas Reales de la tarea activa.');
          }
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, selectedTaskId]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Métricas transversales en vivo del ecosistema AIRO
  const approvalsPending = getApprovals().filter((a) => a.estado === 'PENDING').length;
  const leadsCount = getLeads().length;
  const dtfQuotes = getDtfQuotes();
  const remitosList = getRemitos();
  const remitosEnTransito = remitosList.filter((r) => r.estado === 'Emitido' || r.estado === 'En Tránsito').length;
  const prods = getProductos();
  const mats = getMateriales();
  const stockAlerts =
    prods.filter((p) => Number(p.stock_actual) <= Number(p.stock_minimo)).length +
    mats.filter((m) => Number(m.stock_actual) <= Number(m.stock_minimo)).length;
  const flujos = getFlujoCaja();
  const balanceCaja =
    flujos.filter((t) => t.tipo === 'ingreso' && t.estado === 'Cobrado').reduce((a, b) => a + (Number(b.monto) || 0), 0) -
    flujos.filter((t) => t.tipo === 'egreso' && t.estado === 'Pagado').reduce((a, b) => a + (Number(b.monto) || 0), 0);

  // Métricas EVM / Kanban / PMO
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.grupo_procesos === 'CIERRE' || t.estado === 'COMPLETADO').length;
  const activeExecutionTasks = tasks.filter((t) => t.grupo_procesos === 'EJECUCION');
  const blockedTasks = tasks.filter((t) => t.bloqueada);
  const allSubtasks = tasks.flatMap((t) => t.subtasks || []);
  const completedSubtasks = allSubtasks.filter((s) => s.done).length;
  const totalEstHours = tasks.reduce((acc, t) => acc + (Number(t.esfuerzo_estimado_hs) || 0), 0);
  const totalRealHours = tasks.reduce((acc, t) => acc + (Number(t.horas_reales) || 0), 0);
  const avgProgress = totalTasks > 0 ? Math.round(tasks.reduce((acc, t) => acc + (Number(t.progreso_pct) || 0), 0) / totalTasks) : 0;

  // Filtrado multicriterio para Kanban y Tabla
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterArea !== 'TODAS' && t.area_conocimiento !== filterArea) return false;
      if (filterPriority !== 'TODAS' && t.prioridad !== filterPriority) return false;
      if (filterOnlyBlocked && !t.bloqueada) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = String(t.titulo || '').toLowerCase().includes(q);
        const inId = String(t.id || '').toLowerCase().includes(q) || String(t.wbs_code || '').toLowerCase().includes(q);
        const inResp = String(t.responsable || '').toLowerCase().includes(q);
        const inTags = (t.etiquetas || []).some((tag) => String(tag).toLowerCase().includes(q));
        if (!inTitle && !inId && !inResp && !inTags) return false;
      }
      return true;
    });
  }, [tasks, filterArea, filterPriority, filterOnlyBlocked, searchQuery]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0] || null;

  // Acciones Rápidas
  const handleQuickAddSubmit = (e) => {
    e.preventDefault();
    if (!quickAddInput.trim()) return;
    try {
      const created = quickAddPmbokTask(quickAddInput);
      setQuickAddInput('');
      reloadAll();
      setSelectedTaskId(created.id);
      notify(`Tarea rápida creada: ${created.id} (${created.titulo}) en 03 · Ejecución.`);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleLaunchWorkflow = (wf) => {
    try {
      const created = launchCompanyWorkflow(wf.id, {
        cliente_lote: workflowClientInput,
        fecha_vencimiento: workflowDueDate,
      });
      setWorkflowClientInput('');
      reloadAll();
      setSelectedTaskId(created.id);
      setSubView('kanban_pro');
      notify(`Workflow ${wf.codigo} lanzado: se creó el paquete ${created.id} con ${created.subtasks.length} pasos operativos.`);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleMovePhase = (taskId, newPhase) => {
    movePmbokTaskPhase(taskId, newPhase);
    reloadAll();
    notify(`Tarea ${taskId} movida a fase ${newPhase}.`);
  };

  const handleStepPhase = (task, direction) => {
    const idx = PMBOK_PROCESS_GROUPS.findIndex((g) => g.id === task.grupo_procesos);
    if (idx === -1) return;
    const nextIdx = Math.max(0, Math.min(PMBOK_PROCESS_GROUPS.length - 1, idx + direction));
    if (nextIdx !== idx) {
      handleMovePhase(task.id, PMBOK_PROCESS_GROUPS[nextIdx].id);
    }
  };

  // Drag & Drop Handlers (Trello)
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOverColumn = (e, groupId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverGroupId !== groupId) setDragOverGroupId(groupId);
  };

  const handleDropOnColumn = (e, groupId) => {
    e.preventDefault();
    const droppedId = draggedTaskId || e.dataTransfer.getData('text/plain');
    setDraggedTaskId(null);
    setDragOverGroupId(null);
    if (droppedId) {
      handleMovePhase(droppedId, groupId);
    }
  };

  const handleToggleSubtask = (taskId, subtaskId) => {
    togglePmbokSubtask(taskId, subtaskId);
    reloadAll();
  };

  const handleDeleteSubtask = (taskId, subtaskId) => {
    deletePmbokSubtask(taskId, subtaskId);
    reloadAll();
  };

  const handleAddSubtask = (e) => {
    e.preventDefault();
    if (!selectedTask || !newSubtaskText.trim()) return;
    addPmbokSubtask(selectedTask.id, newSubtaskText);
    setNewSubtaskText('');
    reloadAll();
  };

  const handleUpdateSelectedTaskField = (field, value) => {
    if (!selectedTask) return;
    savePmbokTask({ ...selectedTask, [field]: value });
    reloadAll();
  };

  const handleAddTagToSelected = (e) => {
    e.preventDefault();
    if (!selectedTask || !newTagText.trim()) return;
    const currentTags = Array.isArray(selectedTask.etiquetas) ? selectedTask.etiquetas : [];
    const clean = newTagText.trim().replace(/^#/, '');
    if (!currentTags.includes(clean)) {
      savePmbokTask({ ...selectedTask, etiquetas: [...currentTags, clean] });
      reloadAll();
    }
    setNewTagText('');
  };

  const handleRemoveTagFromSelected = (tagToRemove) => {
    if (!selectedTask) return;
    const nextTags = (selectedTask.etiquetas || []).filter((t) => t !== tagToRemove);
    savePmbokTask({ ...selectedTask, etiquetas: nextTags });
    reloadAll();
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!selectedTask || !newCommentText.trim()) return;
    addPmbokTaskComment(selectedTask.id, newCommentText);
    setNewCommentText('');
    reloadAll();
    notify('Comentario registrado en la bitácora de la tarea.');
  };

  const handleToggleBlocker = () => {
    if (!selectedTask) return;
    const nextState = !selectedTask.bloqueada;
    const reason = nextState ? blockerReasonInput || 'Esperando definición o insumo externo' : '';
    togglePmbokTaskBlocker(selectedTask.id, nextState, reason);
    setBlockerReasonInput('');
    reloadAll();
    notify(nextState ? `Tarea ${selectedTask.id} marcada como BLOQUEADA (Prioridad URGENTE).` : `Bloqueo levantado en ${selectedTask.id}.`);
  };

  const handleDuplicateTask = (taskId) => {
    const dup = duplicatePmbokTask(taskId);
    reloadAll();
    setSelectedTaskId(dup.id);
    notify(`Tarjeta clonada: ${dup.id} (${dup.titulo}).`);
  };

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!taskForm.titulo.trim()) return;
    const tags = taskForm.etiquetas_str
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const subtasks = taskForm.primera_subtarea.trim()
      ? [{ id: `st-${Date.now()}`, text: taskForm.primera_subtarea.trim(), done: false }]
      : undefined;
    const created = savePmbokTask({
      ...taskForm,
      etiquetas: tags.length > 0 ? tags : ['PMBOK'],
      subtasks,
    });
    setShowNewTaskModal(false);
    setTaskForm({
      wbs_code: '3.2.2',
      titulo: '',
      grupo_procesos: 'PLANIFICACION',
      area_conocimiento: 'ALCANCE',
      prioridad: 'ALTA',
      fecha_vencimiento: new Date().toISOString().slice(0, 10),
      esfuerzo_estimado_hs: 4,
      riesgo_asociado: 'NINGUNO',
      hitl: 'HITL-2',
      responsable: 'Equipo AIRO',
      modulo_vinculado: 'cotizador_dtf',
      color_portada: '#1a4295',
      etiquetas_str: 'B2B, Producción',
      primera_subtarea: '',
    });
    reloadAll();
    setSelectedTaskId(created.id);
    notify(`Paquete WBS ${created.wbs_code} (${created.id}) creado.`);
  };

  const handleDeleteTask = (taskId) => {
    deletePmbokTask(taskId);
    reloadAll();
    notify(`Tarea ${taskId} eliminada.`);
  };

  const handleExportObsidianKanban = () => {
    const md = exportPmbokBoardToObsidianMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tablero Kanban y Google Tasks (PMBOK) - ${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Tablero exportado en formato nativo Obsidian Kanban (.md).');
  };

  const handleCreateKaizen = (e) => {
    e.preventDefault();
    if (!kaizenForm.titulo.trim()) return;
    const created = saveKaizenCycle(kaizenForm);
    setShowNewKaizenModal(false);
    setKaizenForm({
      titulo: '',
      etapa_pdca: 'PLAN',
      wbs_ref: '5.3.1',
      problema_detectado: '',
      hipotesis_mejora: '',
      kpi_impacto: '',
      leccion_aprendida: '',
    });
    reloadAll();
    notify(`Ciclo de Mejora Continua ${created.codigo} registrado en fase PLAN.`);
  };

  const handleAdvanceKaizen = (cycle) => {
    const order = ['PLAN', 'DO', 'CHECK', 'ACT'];
    const idx = order.indexOf(cycle.etapa_pdca);
    const nextStage = order[Math.min(order.length - 1, idx + 1)];
    advanceKaizenStage(cycle.id, nextStage);
    reloadAll();
    notify(`Ciclo ${cycle.codigo} avanzado a etapa ${nextStage}.`);
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="gestion-module-container">
      {/* Cabecera Editorial Canónica AIRO */}
      <div className="gestion-section-header">
        <div>
          <div className="section-eyebrow">
            <span className="num">01</span>
            <span>WORK OS · DASHBOARD DE WORKFLOWS · KANBAN PRO · GOOGLE TASKS · KAIZEN PDCA</span>
          </div>
          <h2 className="display section-title">
            Centro de Comando & Workflows Diarios<span className="dot">.</span>
          </h2>
          <p className="section-sub">
            Página principal operativa de AIRO Color Lab potenciada con las mejores funcionalidades de Trello, Asana, ClickUp, Monday.com, Jira, Linear, Notion, Todoist, TickTick, Airtable, Smartsheet, Wrike, Basecamp y Planner.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="g-btn g-btn-outline" onClick={() => setShowNewTaskModal(true)}>
            <IconPlus size={15} />
            <span>Nuevo Paquete WBS</span>
          </button>
          <button className="g-btn g-btn-outline" onClick={() => setShowNewKaizenModal(true)}>
            <IconSparkles size={15} />
            <span>Iniciativa Kaizen (PDCA)</span>
          </button>
          <button className="g-btn g-btn-primary" onClick={handleExportObsidianKanban}>
            <IconDownload size={15} />
            <span>Exportar Obsidian Kanban (.md)</span>
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: feedbackBanner.type === 'error' ? 'rgba(185, 28, 28, 0.1)' : 'rgba(21, 128, 61, 0.1)',
            border: `1px solid ${feedbackBanner.type === 'error' ? '#b91c1c' : '#15803d'}`,
            color: feedbackBanner.type === 'error' ? '#991b1b' : '#166534',
            fontWeight: 600,
            fontSize: '0.84rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{feedbackBanner.msg}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ZONA 1: Barra Superior Siempre Visible — Captura Rápida NLP (Todoist) + Reloj Pomodoro de Taller (TickTick) */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid var(--g-border)',
          borderRadius: '10px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '1rem',
          alignItems: 'center',
          boxShadow: 'var(--g-shadow-sm)',
        }}
      >
        <form onSubmit={handleQuickAddSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%' }}>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              background: 'rgba(26, 66, 149, 0.1)',
              color: '#1a4295',
              padding: '5px 8px',
              borderRadius: 6,
              whiteSpace: 'nowrap',
            }}
          >
            Quick Add NLP
          </span>
          <input
            type="text"
            value={quickAddInput}
            onChange={(e) => setQuickAddInput(e.target.value)}
            placeholder="Ej: Cotizar 40 buzos para Globant #dtf @Comercial !urgente ^mañana ~3h (Enter para crear al instante)"
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              borderRadius: '7px',
              border: '1px solid var(--g-border)',
              fontSize: '0.84rem',
            }}
          />
          <button type="submit" className="g-btn g-btn-primary" style={{ whiteSpace: 'nowrap' }}>
            <IconPlus size={14} />
            <span>Crear Rápido</span>
          </button>
        </form>

        {/* Reloj Pomodoro / Cronómetro de Taller vinculado a la tarea activa (TickTick) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: '#f8fafc',
            border: '1px solid var(--g-border)',
            padding: '0.35rem 0.65rem',
            borderRadius: '8px',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#475569' }}>
            <div style={{ fontWeight: 800, color: '#0f172a' }}>Pomodoro Taller</div>
            <div style={{ fontSize: '0.66rem' }}>
              {selectedTask ? `Activa: ${selectedTask.id}` : 'Sin tarea'}
            </div>
          </div>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '1.05rem',
              fontWeight: 800,
              color: timerRunning ? '#15803d' : '#1a4295',
              padding: '0 4px',
            }}
          >
            {formatTimer(timerSeconds)}
          </span>
          <button
            type="button"
            className="g-btn g-btn-outline"
            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
            onClick={() => setTimerRunning((v) => !v)}
          >
            <IconPlay size={12} />
            <span>{timerRunning ? 'Pausar' : 'Iniciar'}</span>
          </button>
          <button
            type="button"
            className="g-btn g-btn-outline"
            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
            title="Acreditar +0.5 h trabajadas en la tarea seleccionada"
            onClick={() => {
              if (!selectedTask) return;
              logPmbokTaskTime(selectedTask.id, 0.5);
              reloadAll();
              notify(`+0.5 h registradas en ${selectedTask.id} (Total: ${(Number(selectedTask.horas_reales) || 0) + 0.5} h).`);
            }}
          >
            +0.5h
          </button>
        </div>
      </div>

      {/* ZONA 2: Conmutador de las 7 Vistas Operativas (ClickUp / Monday / Asana / Trello / Basecamp / Smartsheet) */}
      <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '1.15rem', flexWrap: 'wrap' }}>
        {[
          { id: 'dashboard_workflows', label: '01 · Dashboard & Workflows AIRO (Inicio)' },
          { id: 'kanban_pro', label: `02 · Tablero Kanban Pro (${totalTasks})` },
          { id: 'mi_dia_eisenhower', label: '03 · Mi Día, Google Tasks & Eisenhower' },
          { id: 'tabla_smartsheet', label: '04 · Tabla Editable PMO (Smartsheet)' },
          { id: 'cronograma_hill', label: '05 · Carga & Hill Chart (Basecamp)' },
          { id: 'automatizaciones', label: `06 · Automatizaciones (${recipes.filter((r) => r.enabled).length}) & 14 Apps` },
          { id: 'kaizen_pdca', label: `07 · Mejora Continua PDCA (${kaizenList.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`g-btn ${subView === tab.id ? 'g-btn-primary' : 'g-btn-outline'}`}
            onClick={() => setSubView(tab.id)}
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.8rem' }}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* =====================================================================
          VISTA 01: DASHBOARD PRINCIPAL & LANZADOR DE WORKFLOWS DE AIRO COLOR LAB
         ===================================================================== */}
      {subView === 'dashboard_workflows' && (
        <div>
          {/* Pulso Operativo en Tiempo Real de toda la empresa (Monday.com / Smartsheet Executive Roll-up) */}
          <div className="gestion-kpis" style={{ marginBottom: '1.25rem' }}>
            <div className="gestion-kpi-card" style={{ cursor: 'pointer' }} onClick={() => setSubView('kanban_pro')}>
              <div className="kpi-label">Paquetes WBS & Google Tasks</div>
              <div className="kpi-value">
                {completedTasks} / {totalTasks}
              </div>
              <div className="kpi-sub">
                Avance global: <strong>{avgProgress}%</strong> · {completedSubtasks}/{allSubtasks.length} checks
              </div>
            </div>

            <div
              className="gestion-kpi-card"
              style={{ cursor: 'pointer' }}
              onClick={() => onNavigateTab && onNavigateTab('cotizador_dtf')}
            >
              <div className="kpi-label">Cotizaciones DTF 2D & CRM</div>
              <div className="kpi-value" style={{ color: '#1a4295' }}>
                {dtfQuotes.length} cot. · {leadsCount} leads
              </div>
              <div className="kpi-sub">Click para abrir Optimizador DTF MaxRects →</div>
            </div>

            <div
              className="gestion-kpi-card"
              style={{ cursor: 'pointer' }}
              onClick={() => onNavigateTab && onNavigateTab('remitos')}
            >
              <div className="kpi-label">Taller, Stock & Remitos</div>
              <div className="kpi-value" style={{ color: stockAlerts > 0 ? '#b45309' : '#15803d' }}>
                {remitosEnTransito} desp. · {stockAlerts} alertas
              </div>
              <div className="kpi-sub">Click para abrir Confección de Remitos →</div>
            </div>

            <div
              className="gestion-kpi-card"
              style={{ cursor: 'pointer' }}
              onClick={() => onNavigateTab && onNavigateTab('caja')}
            >
              <div className="kpi-label">Flujo de Caja & Cola HITL-2</div>
              <div className="kpi-value" style={{ color: balanceCaja >= 0 ? '#15803d' : '#b91c1c' }}>
                ${balanceCaja.toLocaleString('es-AR')}
              </div>
              <div className="kpi-sub">
                {approvalsPending} aprobaciones HITL pendientes · Ir a Caja →
              </div>
            </div>
          </div>

          {/* Plantilla de Workflows Normales de AIRO Color Lab (Asana / Wrike / Monday.com) */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--g-border)',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '1.25rem',
              boxShadow: 'var(--g-shadow-sm)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--g-border)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1a4295', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  PLANTILLA DE OPERACIONES DIARIAS · 1-CLICK WORKFLOW BLUEPRINTS
                </div>
                <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.1rem', color: '#0f172a' }}>
                  Workflows Estándar de AIRO Color Lab (Lanzador Rápido)
                </h3>
              </div>

              {/* Personalizador rápido opcional antes de disparar el workflow */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Cliente / Marca / Lote (ej: Quilmes 50 Buzos)"
                  value={workflowClientInput}
                  onChange={(e) => setWorkflowClientInput(e.target.value)}
                  style={{
                    padding: '0.45rem 0.7rem',
                    borderRadius: '6px',
                    border: '1px solid var(--g-border)',
                    fontSize: '0.8rem',
                    minWidth: '230px',
                  }}
                />
                <input
                  type="date"
                  value={workflowDueDate}
                  onChange={(e) => setWorkflowDueDate(e.target.value)}
                  style={{
                    padding: '0.42rem 0.6rem',
                    borderRadius: '6px',
                    border: '1px solid var(--g-border)',
                    fontSize: '0.8rem',
                  }}
                  title="Fecha compromiso de entrega"
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
                gap: '0.9rem',
              }}
            >
              {AIRO_COMPANY_WORKFLOWS.map((wf) => (
                <div
                  key={wf.id}
                  style={{
                    border: '1px solid var(--g-border)',
                    borderTop: `4px solid ${wf.color_portada}`,
                    borderRadius: '10px',
                    padding: '1rem',
                    background: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: `${wf.color_portada}18`,
                          color: wf.color_portada,
                          padding: '2px 7px',
                          borderRadius: 4,
                        }}
                      >
                        {wf.codigo} · {wf.area_conocimiento}
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>
                        {wf.hitl} · ~{wf.esfuerzo_estimado_hs}h
                      </span>
                    </div>

                    <h4 style={{ margin: '0.2rem 0', fontSize: '0.95rem', color: '#0f172a' }}>{wf.nombre}</h4>
                    <p style={{ margin: '0 0 0.6rem', fontSize: '0.76rem', color: '#475569' }}>{wf.subtitulo}</p>

                    <div style={{ fontSize: '0.73rem', color: '#334155', marginBottom: '0.75rem' }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: '#0f172a' }}>
                        Pasos preconfigurados ({wf.subtasks.length} Google Tasks):
                      </div>
                      {wf.subtasks.slice(0, 3).map((step, i) => (
                        <div key={i} style={{ marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {i + 1}. {step}
                        </div>
                      ))}
                      {wf.subtasks.length > 3 && (
                        <div style={{ color: '#64748b', fontStyle: 'italic' }}>
                          + {wf.subtasks.length - 3} pasos adicionales...
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.4rem' }}>
                    <button
                      type="button"
                      className="g-btn g-btn-primary"
                      style={{ flex: 1, fontSize: '0.76rem', justifyContent: 'center' }}
                      onClick={() => handleLaunchWorkflow(wf)}
                    >
                      <IconPlus size={13} />
                      <span>Lanzar Workflow en Kanban</span>
                    </button>
                    <button
                      type="button"
                      className="g-btn g-btn-outline"
                      style={{ fontSize: '0.74rem' }}
                      onClick={() => onNavigateTab && onNavigateTab(wf.modulo_vinculado)}
                      title={`Ir directo a ${MODULE_LABELS[wf.modulo_vinculado] || wf.modulo_vinculado}`}
                    >
                      <span>Abrir Módulo →</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fila Inferior del Dashboard: Tareas en Foco Inmediato + Acceso Rápido a las 5 Suites */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '1rem', alignItems: 'start' }}>
            {/* Columna Izquierda: Foco Inmediato (En Ejecución / Bloqueadas) */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid var(--g-border)',
                borderRadius: '10px',
                padding: '1.1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a' }}>
                  Foco Operativo Inmediato ({activeExecutionTasks.length} en Ejecución · {blockedTasks.length} Bloqueadas)
                </h4>
                <button
                  type="button"
                  className="g-btn g-btn-outline"
                  style={{ fontSize: '0.74rem', padding: '4px 10px' }}
                  onClick={() => setSubView('kanban_pro')}
                >
                  Ver Tablero Kanban Completo →
                </button>
              </div>

              {tasks
                .filter((t) => t.grupo_procesos !== 'CIERRE')
                .slice(0, 5)
                .map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--g-border)',
                      borderLeft: `4px solid ${t.bloqueada ? '#dc2626' : t.color_portada || '#1a4295'}`,
                      marginBottom: '0.5rem',
                      background: t.bloqueada ? '#fef2f2' : '#f8fafc',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 700, color: '#1a4295' }}>
                          {t.id} · WBS {t.wbs_code}
                        </span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>
                          [{t.grupo_procesos}]
                        </span>
                        {t.bloqueada && (
                          <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#dc2626' }}>
                            BLOQUEADA
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.83rem', color: '#0f172a' }}>{t.titulo}</div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>{t.progreso_pct}%</span>
                      <button
                        type="button"
                        className="g-btn g-btn-outline"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        onClick={() => {
                          setSelectedTaskId(t.id);
                          setSubView('kanban_pro');
                        }}
                      >
                        Inspeccionar
                      </button>
                      {t.modulo_vinculado && t.modulo_vinculado !== 'pmbok_command' && (
                        <button
                          type="button"
                          className="g-btn g-btn-primary"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          onClick={() => onNavigateTab && onNavigateTab(t.modulo_vinculado)}
                        >
                          Módulo →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {/* Columna Derecha: Mapa Rápido de las 5 Suites de Dominio */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid var(--g-border)',
                borderRadius: '10px',
                padding: '1.1rem',
              }}
            >
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#0f172a' }}>
                Navegación Directa por las 5 Suites de Dominio
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {SUITES_DOMINIO.map((suite) => (
                  <div
                    key={suite.id}
                    style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--g-border)',
                      borderLeft: `4px solid ${suite.color}`,
                      background: '#f8fafc',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: suite.color, textTransform: 'uppercase' }}>
                      SUITE {suite.num} · {suite.nombre}
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                      {(suite.modulos || []).map((mod) => (
                        <button
                          key={mod.id}
                          type="button"
                          className="g-btn g-btn-outline"
                          style={{ padding: '3px 8px', fontSize: '0.72rem', background: '#fff' }}
                          onClick={() => onNavigateTab && onNavigateTab(mod.id)}
                        >
                          {mod.label} →
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VISTA 02: TABLERO KANBAN PRO (TRELLO + LINEAR + JIRA + NOTION + PLANNER)
         ===================================================================== */}
      {subView === 'kanban_pro' && (
        <div>
          {/* Barra de Filtros Instantáneos Multicriterio (Linear / Jira) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.6rem',
              marginBottom: '1rem',
              background: '#f8fafc',
              padding: '0.7rem 0.9rem',
              borderRadius: '8px',
              border: '1px solid var(--g-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
              <div style={{ position: 'relative', minWidth: '220px', flex: 1 }}>
                <input
                  type="text"
                  placeholder="Filtrar por título, WBS, TSK, #etiqueta o responsable..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.42rem 0.7rem',
                    borderRadius: '6px',
                    border: '1px solid var(--g-border)',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <select
                value={filterArea}
                onChange={(e) => setFilterArea(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--g-border)', fontSize: '0.78rem' }}
              >
                <option value="TODAS">Todas las 10 Áreas PMBOK</option>
                {PMBOK_KNOWLEDGE_AREAS.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.label}
                  </option>
                ))}
              </select>

              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--g-border)', fontSize: '0.78rem' }}
              >
                <option value="TODAS">Todas las Prioridades</option>
                <option value="URGENTE">Prioridad: URGENTE</option>
                <option value="ALTA">Prioridad: ALTA</option>
                <option value="MEDIA">Prioridad: MEDIA</option>
                <option value="BAJA">Prioridad: BAJA</option>
              </select>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={filterOnlyBlocked}
                  onChange={(e) => setFilterOnlyBlocked(e.target.checked)}
                />
                <span>Solo Bloqueadas ({blockedTasks.length})</span>
              </label>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--g-text-muted)' }}>
              Arrastrá y soltá tarjetas entre columnas (Drag & Drop) o usá <strong>← / →</strong>
            </div>
          </div>

          {/* Layout: 5 Columnas Kanban PMBOK + Panel Inspector Completo */}
          <div style={{ display: 'grid', gridTemplateColumns: selectedTask ? '1fr 370px' : '1fr', gap: '1rem', alignItems: 'start' }}>
            {/* 5 Columnas Kanban con soporte Drag & Drop HTML5 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, minmax(210px, 1fr))',
                gap: '0.7rem',
                overflowX: 'auto',
                paddingBottom: '0.5rem',
              }}
            >
              {PMBOK_PROCESS_GROUPS.map((grp) => {
                const colTasks = filteredTasks.filter((t) => t.grupo_procesos === grp.id);
                const isWipExceeded = grp.id === 'EJECUCION' && colTasks.length > 4;
                const isDragTarget = dragOverGroupId === grp.id;

                return (
                  <div
                    key={grp.id}
                    onDragOver={(e) => handleDragOverColumn(e, grp.id)}
                    onDragLeave={() => setDragOverGroupId(null)}
                    onDrop={(e) => handleDropOnColumn(e, grp.id)}
                    style={{
                      background: isDragTarget ? 'rgba(0, 180, 216, 0.08)' : '#f8fafc',
                      border: isDragTarget ? '2px dashed #00b4d8' : '1px solid var(--g-border)',
                      borderTop: `4px solid ${grp.color}`,
                      borderRadius: '10px',
                      padding: '0.7rem',
                      minHeight: '500px',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: grp.color, letterSpacing: '0.05em' }}>
                        {grp.num} · {grp.id}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '99px',
                          background: isWipExceeded ? '#fef2f2' : '#e2e8f0',
                          color: isWipExceeded ? '#b91c1c' : '#334155',
                        }}
                      >
                        {colTasks.length}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.2rem' }}>
                      {grp.label}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: '0.7rem' }}>{grp.desc}</div>

                    {colTasks.map((t) => {
                      const isSelected = selectedTask?.id === t.id;
                      const doneSt = (t.subtasks || []).filter((s) => s.done).length;
                      const totalSt = (t.subtasks || []).length;
                      const isOverdue = t.grupo_procesos !== 'CIERRE' && t.fecha_vencimiento && t.fecha_vencimiento < todayIso;

                      return (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, t.id)}
                          onClick={() => setSelectedTaskId(t.id)}
                          style={{
                            background: t.bloqueada ? '#fff5f5' : '#ffffff',
                            border: isSelected
                              ? '2px solid #1a4295'
                              : t.bloqueada
                              ? '1.5px solid #dc2626'
                              : '1px solid var(--g-border)',
                            borderTop: `4px solid ${t.bloqueada ? '#dc2626' : t.color_portada || grp.color}`,
                            borderRadius: '8px',
                            padding: '0.65rem',
                            marginBottom: '0.6rem',
                            cursor: 'grab',
                            boxShadow: isSelected ? '0 4px 12px rgba(26, 66, 149, 0.14)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
                          }}
                        >
                          {/* Cabecera WBS + Flechas rápidas de cambio de columna */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '0.67rem',
                                fontWeight: 700,
                                background: 'rgba(26, 66, 149, 0.1)',
                                color: '#1a4295',
                                padding: '2px 5px',
                                borderRadius: 4,
                              }}
                            >
                              WBS {t.wbs_code} · {t.id}
                            </span>

                            <div style={{ display: 'flex', gap: 3 }} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                title="Mover a fase anterior"
                                onClick={() => handleStepPhase(t, -1)}
                                style={{
                                  border: '1px solid var(--g-border)',
                                  background: '#f8fafc',
                                  borderRadius: 4,
                                  fontSize: '0.65rem',
                                  padding: '1px 5px',
                                  cursor: 'pointer',
                                }}
                              >
                                ←
                              </button>
                              <button
                                type="button"
                                title="Avanzar a siguiente fase"
                                onClick={() => handleStepPhase(t, 1)}
                                style={{
                                  border: '1px solid var(--g-border)',
                                  background: '#f8fafc',
                                  borderRadius: 4,
                                  fontSize: '0.65rem',
                                  padding: '1px 5px',
                                  cursor: 'pointer',
                                }}
                              >
                                →
                              </button>
                            </div>
                          </div>

                          {/* Alerta de Bloqueo (Jira / Linear) */}
                          {t.bloqueada && (
                            <div
                              style={{
                                background: '#fee2e2',
                                color: '#991b1b',
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: 4,
                                marginBottom: 5,
                              }}
                            >
                              BLOQUEADA: {t.motivo_bloqueo || 'Requiere destrabe'}
                            </div>
                          )}

                          {/* Título */}
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a', lineHeight: 1.32, marginBottom: 5 }}>
                            {t.titulo}
                          </div>

                          {/* Etiquetas (Trello Labels) */}
                          {Array.isArray(t.etiquetas) && t.etiquetas.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                              {t.etiquetas.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  style={{
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                    background: '#e0f2fe',
                                    color: '#0369a1',
                                  }}
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Previsualización rápida de checklist en frente de tarjeta (Microsoft Planner) */}
                          {totalSt > 0 && (
                            <div
                              style={{
                                background: '#f8fafc',
                                borderRadius: 6,
                                padding: '4px 6px',
                                marginBottom: 6,
                                border: '1px solid #e2e8f0',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {(t.subtasks || []).slice(0, 2).map((st) => (
                                <label
                                  key={st.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    fontSize: '0.68rem',
                                    color: st.done ? '#94a3b8' : '#334155',
                                    textDecoration: st.done ? 'line-through' : 'none',
                                    cursor: 'pointer',
                                    marginBottom: 2,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(st.done)}
                                    onChange={() => handleToggleSubtask(t.id, st.id)}
                                  />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {st.text}
                                  </span>
                                </label>
                              ))}
                              {totalSt > 2 && (
                                <div style={{ fontSize: '0.63rem', color: '#64748b' }}>
                                  + {totalSt - 2} ítems más en el inspector...
                                </div>
                              )}
                            </div>
                          )}

                          {/* Barra de progreso Google Tasks */}
                          <div style={{ background: '#e2e8f0', height: 5, borderRadius: 99, overflow: 'hidden', marginBottom: 5 }}>
                            <div
                              style={{
                                width: `${t.progreso_pct || 0}%`,
                                height: '100%',
                                background: t.progreso_pct === 100 ? '#15803d' : '#00b4d8',
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: '#475569' }}>
                            <span>
                              Checks: <strong>{doneSt}/{totalSt}</strong>
                            </span>
                            <span style={{ color: isOverdue ? '#dc2626' : '#475569', fontWeight: isOverdue ? 800 : 600 }}>
                              {t.fecha_vencimiento}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Panel Derecho: Inspector Editable Completo (Notion + Trello + Jira + Basecamp) */}
            {selectedTask && (
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--g-border)',
                  borderRadius: '10px',
                  padding: '1.1rem',
                  boxShadow: 'var(--g-shadow-sm)',
                  position: 'sticky',
                  top: '1rem',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: '0.6rem' }}>
                  <div>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: '#007799',
                        background: 'rgba(0, 180, 216, 0.14)',
                        padding: '2px 7px',
                        borderRadius: 4,
                      }}
                    >
                      EDT / WBS {selectedTask.wbs_code} · {selectedTask.id}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="g-btn g-btn-outline"
                      style={{ padding: '3px 7px', fontSize: '0.7rem' }}
                      onClick={() => handleDuplicateTask(selectedTask.id)}
                      title="Clonar / Duplicar tarjeta (Trello)"
                    >
                      Clonar
                    </button>
                    <button
                      type="button"
                      className="g-btn g-btn-outline"
                      style={{ padding: '3px 7px', color: '#b91c1c' }}
                      onClick={() => handleDeleteTask(selectedTask.id)}
                      title="Eliminar tarea"
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                </div>

                {/* Edición Inline del Título */}
                <div className="g-form-group" style={{ marginBottom: '0.65rem' }}>
                  <label style={{ fontSize: '0.72rem' }}>Título del Paquete de Trabajo (Editable):</label>
                  <input
                    type="text"
                    value={selectedTask.titulo}
                    onChange={(e) => handleUpdateSelectedTaskField('titulo', e.target.value)}
                    style={{ fontWeight: 700, fontSize: '0.86rem' }}
                  />
                </div>

                {/* Salto 1-Click al Módulo Operativo Vinculado (Airtable Relational Link) */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.45rem',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                    background: '#f0f9ff',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '7px',
                    border: '1px solid #bae6fd',
                  }}
                >
                  <select
                    value={selectedTask.modulo_vinculado || 'pmbok_command'}
                    onChange={(e) => handleUpdateSelectedTaskField('modulo_vinculado', e.target.value)}
                    style={{ flex: 1, fontSize: '0.76rem', padding: '4px 6px', borderRadius: 5, border: '1px solid #93c5fd' }}
                  >
                    {Object.entries(MODULE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        Vínculo: {label}
                      </option>
                    ))}
                  </select>
                  {selectedTask.modulo_vinculado && selectedTask.modulo_vinculado !== 'pmbok_command' && (
                    <button
                      type="button"
                      className="g-btn g-btn-primary"
                      style={{ padding: '4px 9px', fontSize: '0.73rem', whiteSpace: 'nowrap' }}
                      onClick={() => onNavigateTab && onNavigateTab(selectedTask.modulo_vinculado)}
                    >
                      Abrir Módulo →
                    </button>
                  )}
                </div>

                {/* Grilla de Propiedades Editables (ClickUp / Jira) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div className="g-form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.7rem' }}>Fase Kanban PMBOK</label>
                    <select
                      value={selectedTask.grupo_procesos}
                      onChange={(e) => handleMovePhase(selectedTask.id, e.target.value)}
                      style={{ fontSize: '0.76rem', padding: '4px 6px' }}
                    >
                      {PMBOK_PROCESS_GROUPS.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.num} · {g.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="g-form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.7rem' }}>Prioridad</label>
                    <select
                      value={selectedTask.prioridad || 'ALTA'}
                      onChange={(e) => handleUpdateSelectedTaskField('prioridad', e.target.value)}
                      style={{ fontSize: '0.76rem', padding: '4px 6px' }}
                    >
                      <option value="URGENTE">URGENTE</option>
                      <option value="ALTA">ALTA</option>
                      <option value="MEDIA">MEDIA</option>
                      <option value="BAJA">BAJA</option>
                    </select>
                  </div>

                  <div className="g-form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.7rem' }}>Fecha Límite</label>
                    <input
                      type="date"
                      value={selectedTask.fecha_vencimiento || ''}
                      onChange={(e) => handleUpdateSelectedTaskField('fecha_vencimiento', e.target.value)}
                      style={{ fontSize: '0.76rem', padding: '4px 6px' }}
                    />
                  </div>

                  <div className="g-form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.7rem' }}>Responsable</label>
                    <input
                      type="text"
                      value={selectedTask.responsable || ''}
                      onChange={(e) => handleUpdateSelectedTaskField('responsable', e.target.value)}
                      style={{ fontSize: '0.76rem', padding: '4px 6px' }}
                    />
                  </div>

                  <div className="g-form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.7rem' }}>Esfuerzo Est. (hs)</label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={selectedTask.esfuerzo_estimado_hs || 1}
                      onChange={(e) => handleUpdateSelectedTaskField('esfuerzo_estimado_hs', Number(e.target.value))}
                      style={{ fontSize: '0.76rem', padding: '4px 6px' }}
                    />
                  </div>

                  <div className="g-form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.7rem' }}>Horas Reales (Taller)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={selectedTask.horas_reales || 0}
                      onChange={(e) => handleUpdateSelectedTaskField('horas_reales', Number(e.target.value))}
                      style={{ fontSize: '0.76rem', padding: '4px 6px' }}
                    />
                  </div>
                </div>

                {/* Control de Bloqueos (Jira / Linear Flag Blocker) */}
                <div
                  style={{
                    background: selectedTask.bloqueada ? '#fef2f2' : '#f8fafc',
                    border: `1px solid ${selectedTask.bloqueada ? '#fca5a5' : 'var(--g-border)'}`,
                    borderRadius: '7px',
                    padding: '0.55rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: selectedTask.bloqueada ? '#b91c1c' : '#334155' }}>
                      {selectedTask.bloqueada ? 'ESTADO: TAREA BLOQUEADA' : 'Sin bloqueos activos'}
                    </span>
                    <button
                      type="button"
                      className="g-btn g-btn-outline"
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.7rem',
                        color: selectedTask.bloqueada ? '#15803d' : '#b91c1c',
                      }}
                      onClick={handleToggleBlocker}
                    >
                      {selectedTask.bloqueada ? 'Levantar Bloqueo' : 'Marcar Bloqueada'}
                    </button>
                  </div>
                  {!selectedTask.bloqueada && (
                    <input
                      type="text"
                      placeholder="Motivo si deseás marcar bloqueo (ej: Falta confirmar talles)"
                      value={blockerReasonInput}
                      onChange={(e) => setBlockerReasonInput(e.target.value)}
                      style={{
                        width: '100%',
                        marginTop: 5,
                        padding: '4px 6px',
                        fontSize: '0.73rem',
                        borderRadius: 5,
                        border: '1px solid var(--g-border)',
                      }}
                    />
                  )}
                  {selectedTask.bloqueada && (
                    <div style={{ fontSize: '0.73rem', color: '#991b1b', marginTop: 4 }}>
                      Motivo: <strong>{selectedTask.motivo_bloqueo}</strong>
                    </div>
                  )}
                </div>

                {/* Etiquetas Personalizadas (Trello Labels) */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Etiquetas de la Tarjeta:
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
                    {(selectedTask.etiquetas || []).map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          background: '#e0f2fe',
                          color: '#0369a1',
                          padding: '2px 7px',
                          borderRadius: 99,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTagFromSelected(tag)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#0369a1', fontWeight: 800, padding: 0 }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <form onSubmit={handleAddTagToSelected} style={{ display: 'flex', gap: 4 }}>
                    <input
                      type="text"
                      placeholder="Nueva etiqueta (ej: Urgente-RRHH)"
                      value={newTagText}
                      onChange={(e) => setNewTagText(e.target.value)}
                      style={{ flex: 1, padding: '4px 7px', fontSize: '0.74rem', borderRadius: 5, border: '1px solid var(--g-border)' }}
                    />
                    <button type="submit" className="g-btn g-btn-outline" style={{ padding: '4px 8px', fontSize: '0.72rem' }}>
                      + Tag
                    </button>
                  </form>
                </div>

                {/* Checklist Google Tasks Completo (con borrado individual) */}
                <div style={{ marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--g-blue)' }}>
                      Checklist Google Tasks ({(selectedTask.subtasks || []).filter((s) => s.done).length}/{(selectedTask.subtasks || []).length})
                    </strong>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#15803d' }}>
                      {selectedTask.progreso_pct}%
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.5rem' }}>
                    {(selectedTask.subtasks || []).map((st) => (
                      <div
                        key={st.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.4rem',
                          padding: '0.4rem 0.55rem',
                          borderRadius: '6px',
                          background: st.done ? 'rgba(21, 128, 61, 0.08)' : '#f8fafc',
                          border: '1px solid var(--g-border)',
                        }}
                      >
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.45rem',
                            fontSize: '0.77rem',
                            cursor: 'pointer',
                            textDecoration: st.done ? 'line-through' : 'none',
                            color: st.done ? '#64748b' : '#0f172a',
                            flex: 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(st.done)}
                            onChange={() => handleToggleSubtask(selectedTask.id, st.id)}
                            style={{ marginTop: 2 }}
                          />
                          <span>{st.text}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubtask(selectedTask.id, st.id)}
                          style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
                          title="Eliminar subtarea"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddSubtask} style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      type="text"
                      placeholder="Añadir paso rápido Google Tasks..."
                      value={newSubtaskText}
                      onChange={(e) => setNewSubtaskText(e.target.value)}
                      style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--g-border)', fontSize: '0.76rem' }}
                    />
                    <button type="submit" className="g-btn g-btn-primary" style={{ padding: '0.4rem 0.65rem' }}>
                      <IconPlus size={13} />
                    </button>
                  </form>
                </div>

                {/* Notas Técnicas Markdown (Notion Page-in-Card) */}
                <div className="g-form-group" style={{ marginBottom: '0.85rem' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700 }}>
                    Notas Técnicas & Especificaciones (Estilo Notion / Obsidian):
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Anotá especificaciones de estampa, curva de talles, links o acuerdos con el cliente..."
                    value={selectedTask.notas_markdown || ''}
                    onChange={(e) => handleUpdateSelectedTaskField('notas_markdown', e.target.value)}
                    style={{ fontSize: '0.76rem', width: '100%' }}
                  />
                </div>

                {/* Bitácora de Comentarios de Equipo (Basecamp / Trello Activity) */}
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 5 }}>
                    Bitácora de Comentarios ({(selectedTask.comentarios || []).length}):
                  </div>
                  <div style={{ maxHeight: 130, overflowY: 'auto', marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(selectedTask.comentarios || []).map((c) => (
                      <div
                        key={c.id}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid var(--g-border)',
                          borderRadius: 6,
                          padding: '5px 8px',
                          fontSize: '0.73rem',
                        }}
                      >
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700 }}>
                          {c.autor} · {String(c.fecha || '').slice(0, 16).replace('T', ' ')}
                        </div>
                        <div style={{ color: '#0f172a' }}>{c.texto}</div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleAddComment} style={{ display: 'flex', gap: 4 }}>
                    <input
                      type="text"
                      placeholder="Escribir actualización o comentario..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      style={{ flex: 1, padding: '4px 7px', fontSize: '0.74rem', borderRadius: 5, border: '1px solid var(--g-border)' }}
                    />
                    <button type="submit" className="g-btn g-btn-outline" style={{ padding: '4px 8px', fontSize: '0.72rem' }}>
                      Comentar
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          VISTA 03: MI DÍA, GOOGLE TASKS & MATRIZ DE EISENHOWER (TODOIST / TICKTICK)
         ===================================================================== */}
      {subView === 'mi_dia_eisenhower' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            {[
              {
                quadrant: 'I · HACER AHORA (Urgente + Importante)',
                desc: 'Prioridad URGENTE o ALTA en Ejecución / Monitoreo',
                color: '#dc2626',
                items: tasks.filter(
                  (t) =>
                    t.grupo_procesos !== 'CIERRE' &&
                    (t.prioridad === 'URGENTE' || (t.prioridad === 'ALTA' && t.grupo_procesos === 'EJECUCION'))
                ),
              },
              {
                quadrant: 'II · PLANIFICAR & AGENDAR (Importante, No Urgente)',
                desc: 'Paquetes estratégicos en Planificación e Iniciación',
                color: '#1a4295',
                items: tasks.filter(
                  (t) =>
                    t.grupo_procesos !== 'CIERRE' &&
                    t.prioridad === 'ALTA' &&
                    t.grupo_procesos !== 'EJECUCION'
                ),
              },
              {
                quadrant: 'III · AUTOMATIZAR / DELEGAR (Operativo)',
                desc: 'Prioridad MEDIA con checklists estandarizados',
                color: '#0284c7',
                items: tasks.filter((t) => t.grupo_procesos !== 'CIERRE' && t.prioridad === 'MEDIA'),
              },
              {
                quadrant: 'IV · BACKLOG / BAJA PRIORIDAD',
                desc: 'Ideas o paquetes en reserva',
                color: '#64748b',
                items: tasks.filter((t) => t.grupo_procesos !== 'CIERRE' && t.prioridad === 'BAJA'),
              },
            ].map((q) => (
              <div
                key={q.quadrant}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--g-border)',
                  borderTop: `4px solid ${q.color}`,
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <strong style={{ fontSize: '0.86rem', color: q.color }}>{q.quadrant}</strong>
                  <span className="g-badge g-badge-neutral">{q.items.length}</span>
                </div>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#64748b' }}>{q.desc}</p>

                {q.items.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
                    Sin paquetes en este cuadrante.
                  </div>
                ) : (
                  q.items.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        border: '1px solid var(--g-border)',
                        borderRadius: '8px',
                        padding: '0.6rem 0.75rem',
                        marginBottom: '0.5rem',
                        background: '#f8fafc',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.81rem', color: '#0f172a' }}>
                          [{t.id}] {t.titulo}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: q.color }}>
                          Vence: {t.fecha_vencimiento}
                        </span>
                      </div>
                      {(t.subtasks || []).map((st) => (
                        <label
                          key={st.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: '0.76rem',
                            color: st.done ? '#94a3b8' : '#334155',
                            textDecoration: st.done ? 'line-through' : 'none',
                            cursor: 'pointer',
                            marginTop: 3,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(st.done)}
                            onChange={() => handleToggleSubtask(t.id, st.id)}
                          />
                          <span>{st.text}</span>
                        </label>
                      ))}
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          VISTA 04: TABLA & HOJA DE CÁLCULO EDITABLE PMO (SMARTSHEET / AIRTABLE)
         ===================================================================== */}
      {subView === 'tabla_smartsheet' && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid var(--g-border)',
            borderRadius: '10px',
            padding: '1rem',
            overflowX: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>
                Hoja de Cálculo Editable PMO & Roll-Up de Esfuerzo (Estilo Smartsheet / Airtable)
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Modificá celdas directamente en la tabla; los cambios actualizan el Kanban y las métricas EVM en tiempo real.
              </p>
            </div>
          </div>

          <table className="g-table" style={{ fontSize: '0.78rem' }}>
            <thead>
              <tr>
                <th>WBS / ID</th>
                <th>Paquete de Trabajo</th>
                <th>Fase PMBOK</th>
                <th>Prioridad</th>
                <th>Vencimiento</th>
                <th>Hs Est.</th>
                <th>Hs Reales</th>
                <th>Avance</th>
                <th>Módulo Vinculado</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => (
                <tr key={t.id} style={{ background: t.bloqueada ? '#fff5f5' : undefined }}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {t.wbs_code} · {t.id}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={t.titulo}
                      onChange={(e) => {
                        savePmbokTask({ ...t, titulo: e.target.value });
                        reloadAll();
                      }}
                      style={{
                        width: '100%',
                        minWidth: '220px',
                        border: '1px solid transparent',
                        background: 'transparent',
                        fontWeight: 600,
                        padding: '2px 4px',
                      }}
                    />
                  </td>
                  <td>
                    <select
                      value={t.grupo_procesos}
                      onChange={(e) => handleMovePhase(t.id, e.target.value)}
                      style={{ fontSize: '0.74rem', padding: '3px 6px', borderRadius: 5, border: '1px solid var(--g-border)' }}
                    >
                      {PMBOK_PROCESS_GROUPS.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.num} · {g.id}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={t.prioridad || 'ALTA'}
                      onChange={(e) => {
                        savePmbokTask({ ...t, prioridad: e.target.value });
                        reloadAll();
                      }}
                      style={{ fontSize: '0.74rem', padding: '3px 6px', borderRadius: 5, border: '1px solid var(--g-border)' }}
                    >
                      <option value="URGENTE">URGENTE</option>
                      <option value="ALTA">ALTA</option>
                      <option value="MEDIA">MEDIA</option>
                      <option value="BAJA">BAJA</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="date"
                      value={t.fecha_vencimiento || ''}
                      onChange={(e) => {
                        savePmbokTask({ ...t, fecha_vencimiento: e.target.value });
                        reloadAll();
                      }}
                      style={{ fontSize: '0.74rem', padding: '2px 5px', borderRadius: 5, border: '1px solid var(--g-border)' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={t.esfuerzo_estimado_hs || 1}
                      onChange={(e) => {
                        savePmbokTask({ ...t, esfuerzo_estimado_hs: Number(e.target.value) });
                        reloadAll();
                      }}
                      style={{ width: '60px', fontSize: '0.74rem', padding: '2px 5px', borderRadius: 5, border: '1px solid var(--g-border)' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={t.horas_reales || 0}
                      onChange={(e) => {
                        savePmbokTask({ ...t, horas_reales: Number(e.target.value) });
                        reloadAll();
                      }}
                      style={{ width: '60px', fontSize: '0.74rem', padding: '2px 5px', borderRadius: 5, border: '1px solid var(--g-border)' }}
                    />
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: t.progreso_pct === 100 ? '#15803d' : '#1a4295' }}>
                      {t.progreso_pct}%
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="g-btn g-btn-outline"
                      style={{ padding: '2px 8px', fontSize: '0.71rem' }}
                      onClick={() => onNavigateTab && onNavigateTab(t.modulo_vinculado || 'cotizador_dtf')}
                    >
                      {MODULE_LABELS[t.modulo_vinculado] || 'Abrir'} →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f1f5f9', fontWeight: 800 }}>
                <td colSpan={5}>TOTALES ROLL-UP PMO ({filteredTasks.length} paquetes)</td>
                <td>{totalEstHours} hs est.</td>
                <td>{totalRealHours} hs reales</td>
                <td>{avgProgress}% prom.</td>
                <td>Desvío: {(totalRealHours - totalEstHours).toFixed(1)} hs</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* =====================================================================
          VISTA 05: CRONOGRAMA, CARGA DE TRABAJO & HILL CHART (BASECAMP / WRIKE)
         ===================================================================== */}
      {subView === 'cronograma_hill' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1rem', alignItems: 'start' }}>
          {/* Basecamp Hill Chart en SVG */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--g-border)',
              borderRadius: '10px',
              padding: '1.2rem',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1a4295', textTransform: 'uppercase' }}>
              BASECAMP HILL CHART · INCERTIDUMBRE VS. EJECUCIÓN CIERTA
            </div>
            <h3 style={{ margin: '0.2rem 0 0.4rem', fontSize: '1.02rem', color: '#0f172a' }}>
              Curva de Madurez de Paquetes Activos
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.76rem', color: '#64748b' }}>
              Izquierda de la cima (0–49%): definiendo alcance o destrabando insumos. Derecha de la cima (50–100%): producción firme hacia el cierre.
            </p>

            <svg viewBox="0 0 600 230" style={{ width: '100%', height: 'auto', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <line x1="300" y1="20" x2="300" y2="195" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth="1.5" />
              <path d="M 40 190 Q 170 190 300 45 Q 430 190 560 190" fill="none" stroke="#1a4295" strokeWidth="3" />
              <text x="90" y="215" fontSize="11" fontWeight="700" fill="#475569">
                FASE DESCUBRIMIENTO / DEFINICIÓN (0% - 49%)
              </text>
              <text x="345" y="215" fontSize="11" fontWeight="700" fill="#15803d">
                FASE EJECUCIÓN / DESPACHO (50% - 100%)
              </text>

              {tasks
                .filter((t) => t.grupo_procesos !== 'CIERRE')
                .map((t, idx) => {
                  const pct = Math.max(0, Math.min(100, Number(t.progreso_pct) || 0));
                  const x = 40 + (pct / 100) * 520;
                  const norm = (pct - 50) / 50; // -1 a 1
                  const y = 48 + norm * norm * 138;
                  return (
                    <g key={t.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedTaskId(t.id); setSubView('kanban_pro'); }}>
                      <circle cx={x} cy={y} r="7" fill={t.bloqueada ? '#dc2626' : '#00b4d8'} stroke="#fff" strokeWidth="2" />
                      <text x={x + 10} y={y + 4 - (idx % 2) * 8} fontSize="10" fontWeight="700" fill="#0f172a">
                        {t.id} ({pct}%)
                      </text>
                    </g>
                  );
                })}
            </svg>
          </div>

          {/* Carga de Trabajo por Responsable (Wrike Workload) */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--g-border)',
              borderRadius: '10px',
              padding: '1.2rem',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
              WRIKE WORKLOAD · CAPACIDAD DEL EQUIPO
            </div>
            <h3 style={{ margin: '0.2rem 0 0.8rem', fontSize: '1.02rem', color: '#0f172a' }}>
              Carga Horaria por Responsable / Rol
            </h3>

            {Object.entries(
              tasks.reduce((acc, t) => {
                const key = t.responsable || 'Sin asignar';
                if (!acc[key]) acc[key] = { est: 0, real: 0, count: 0 };
                acc[key].est += Number(t.esfuerzo_estimado_hs) || 0;
                acc[key].real += Number(t.horas_reales) || 0;
                acc[key].count += 1;
                return acc;
              }, {})
            ).map(([resp, data]) => (
              <div
                key={resp}
                style={{
                  border: '1px solid var(--g-border)',
                  borderRadius: 8,
                  padding: '0.65rem 0.8rem',
                  marginBottom: '0.55rem',
                  background: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>
                  <span>{resp} ({data.count} paq.)</span>
                  <span>{data.real}h reales / {data.est}h est.</span>
                </div>
                <div style={{ background: '#e2e8f0', height: 6, borderRadius: 99, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((data.est / Math.max(1, totalEstHours)) * 100))}%`,
                      height: '100%',
                      background: '#1a4295',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          VISTA 06: MOTOR DE AUTOMATIZACIONES & MATRIZ DE LAS 14 APPS CONSULTADAS
         ===================================================================== */}
      {subView === 'automatizaciones' && (
        <div>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--g-border)',
              borderRadius: '10px',
              padding: '1.2rem',
              marginBottom: '1.2rem',
            }}
          >
            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', color: '#0f172a' }}>
              Recetas de Automatización Operativa Sin Código (Estilo Monday.com / ClickUp / Trello Butler)
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#64748b' }}>
              Activá o pausá las reglas automáticas que conectan el Tablero Kanban con el Cotizador DTF, Remitos, Caja y Mejora Continua.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.8rem' }}>
              {recipes.map((r) => (
                <div
                  key={r.id}
                  style={{
                    border: `1.5px solid ${r.enabled ? '#1a4295' : 'var(--g-border)'}`,
                    borderRadius: 9,
                    padding: '0.9rem',
                    background: r.enabled ? '#f8fafc' : '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 800, color: '#1a4295' }}>
                      {r.codigo} · {r.origen_app}
                    </span>
                    <button
                      type="button"
                      className={`g-btn ${r.enabled ? 'g-btn-primary' : 'g-btn-outline'}`}
                      style={{ padding: '3px 10px', fontSize: '0.7rem' }}
                      onClick={() => {
                        toggleAutomationRecipe(r.id);
                        reloadAll();
                      }}
                    >
                      {r.enabled ? 'ACTIVA' : 'PAUSADA'}
                    </button>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a', marginBottom: 4 }}>{r.nombre}</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 3 }}>
                    <strong>CUANDO (Trigger):</strong> {r.trigger}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#15803d' }}>
                    <strong>ENTONCES (Acción):</strong> {r.action}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla resumen de las 14 aplicaciones consultadas */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--g-border)',
              borderRadius: '10px',
              padding: '1.2rem',
            }}
          >
            <h3 style={{ margin: '0 0 0.6rem', fontSize: '1rem', color: '#0f172a' }}>
              Matriz de Funcionalidades Incorporadas desde las 14 Plataformas Líderes
            </h3>
            <table className="g-table" style={{ fontSize: '0.77rem' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Plataforma Consultada</th>
                  <th>Funcionalidad Incorporada en AIRO Work OS (#/gestion)</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {BENCHMARK_14_APPS.map((b) => (
                  <tr key={b.num}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{b.num}</td>
                    <td style={{ fontWeight: 700, color: '#1a4295' }}>{b.app}</td>
                    <td>{b.feature}</td>
                    <td>
                      <span className="g-badge g-badge-success">{b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          VISTA 07: PROCESO DE MEJORA CONTINUA (CICLO PDCA / KAIZEN)
         ===================================================================== */}
      {subView === 'kaizen_pdca' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(230px, 1fr))',
              gap: '0.85rem',
            }}
          >
            {PDCA_STAGES.map((stage) => {
              const stageCycles = kaizenList.filter((c) => c.etapa_pdca === stage.id);
              return (
                <div
                  key={stage.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--g-border)',
                    borderTop: `4px solid ${stage.color}`,
                    borderRadius: '10px',
                    padding: '0.85rem',
                    minHeight: '380px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: stage.color }}>
                      ETAPA {stage.num} · {stage.id}
                    </span>
                    <span className="g-badge g-badge-neutral">{stageCycles.length}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a', marginBottom: 2 }}>
                    {stage.label}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.8rem' }}>{stage.desc}</div>

                  {stageCycles.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid var(--g-border)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        marginBottom: '0.65rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 700, color: stage.color }}>
                          {c.codigo}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#64748b' }}>WBS {c.wbs_ref}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.83rem', color: '#0f172a', marginBottom: 6 }}>
                        {c.titulo}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#475569', marginBottom: 4 }}>
                        <strong>Problema:</strong> {c.problema_detectado}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#15803d', marginBottom: 6 }}>
                        <strong>KPI:</strong> {c.kpi_impacto}
                      </div>
                      {stage.id !== 'ACT' && (
                        <button
                          type="button"
                          className="g-btn g-btn-outline"
                          style={{ width: '100%', fontSize: '0.73rem', padding: '4px 8px' }}
                          onClick={() => handleAdvanceKaizen(c)}
                        >
                          Avanzar a siguiente etapa PDCA →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal para Crear Nuevo Paquete de Trabajo WBS / Google Task */}
      {showNewTaskModal && (
        <div className="g-modal-backdrop" onClick={() => setShowNewTaskModal(false)}>
          <div className="g-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3 style={{ margin: '0 0 0.85rem', color: 'var(--g-blue)' }}>
              Nuevo Paquete de Trabajo EDT/WBS & Google Task
            </h3>
            <form onSubmit={handleCreateTask}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem' }}>
                <div className="g-form-group">
                  <label>Código WBS</label>
                  <input
                    type="text"
                    value={taskForm.wbs_code}
                    onChange={(e) => setTaskForm({ ...taskForm, wbs_code: e.target.value })}
                    required
                  />
                </div>
                <div className="g-form-group">
                  <label>Título del Paquete de Trabajo / Tarea</label>
                  <input
                    type="text"
                    placeholder="Ej. Lanzar catálogo corporativo de Invierno"
                    value={taskForm.titulo}
                    onChange={(e) => setTaskForm({ ...taskForm, titulo: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="g-form-group">
                  <label>Grupo de Procesos (PMBOK)</label>
                  <select
                    value={taskForm.grupo_procesos}
                    onChange={(e) => setTaskForm({ ...taskForm, grupo_procesos: e.target.value })}
                  >
                    {PMBOK_PROCESS_GROUPS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.num} · {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="g-form-group">
                  <label>Área de Conocimiento (10 Áreas)</label>
                  <select
                    value={taskForm.area_conocimiento}
                    onChange={(e) => setTaskForm({ ...taskForm, area_conocimiento: e.target.value })}
                  >
                    {PMBOK_KNOWLEDGE_AREAS.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="g-form-group">
                  <label>Módulo Operativo Vinculado</label>
                  <select
                    value={taskForm.modulo_vinculado}
                    onChange={(e) => setTaskForm({ ...taskForm, modulo_vinculado: e.target.value })}
                  >
                    {Object.entries(MODULE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="g-form-group">
                  <label>Fecha Límite (Google Tasks)</label>
                  <input
                    type="date"
                    value={taskForm.fecha_vencimiento}
                    onChange={(e) => setTaskForm({ ...taskForm, fecha_vencimiento: e.target.value })}
                  />
                </div>
                <div className="g-form-group">
                  <label>Etiquetas (separadas por coma)</label>
                  <input
                    type="text"
                    value={taskForm.etiquetas_str}
                    onChange={(e) => setTaskForm({ ...taskForm, etiquetas_str: e.target.value })}
                  />
                </div>
                <div className="g-form-group">
                  <label>Gate HITL</label>
                  <select
                    value={taskForm.hitl}
                    onChange={(e) => setTaskForm({ ...taskForm, hitl: e.target.value })}
                  >
                    <option value="HITL-0">HITL-0 (Interno)</option>
                    <option value="HITL-1">HITL-1 (Operativo)</option>
                    <option value="HITL-2">HITL-2 (Publicación / Outbound)</option>
                    <option value="HITL-3">HITL-3 (Estrategia / Precios)</option>
                  </select>
                </div>
              </div>

              <div className="g-form-group">
                <label>Primera Subtarea Rápida (Google Tasks)</label>
                <input
                  type="text"
                  placeholder="Ej. Relevamiento de muestras en taller"
                  value={taskForm.primera_subtarea}
                  onChange={(e) => setTaskForm({ ...taskForm, primera_subtarea: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: '1rem' }}>
                <button type="button" className="g-btn g-btn-outline" onClick={() => setShowNewTaskModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="g-btn g-btn-primary">
                  Crear Paquete PMBOK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Registrar Nueva Iniciativa PDCA / Kaizen */}
      {showNewKaizenModal && (
        <div className="g-modal-backdrop" onClick={() => setShowNewKaizenModal(false)}>
          <div className="g-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <h3 style={{ margin: '0 0 0.85rem', color: 'var(--g-blue)' }}>
              Registrar Iniciativa de Mejora Continua (Ciclo PDCA / Kaizen)
            </h3>
            <form onSubmit={handleCreateKaizen}>
              <div className="g-form-group">
                <label>Título de la Mejora</label>
                <input
                  type="text"
                  placeholder="Ej. Automatización de alerta de bobina DTF a proveedores"
                  value={kaizenForm.titulo}
                  onChange={(e) => setKaizenForm({ ...kaizenForm, titulo: e.target.value })}
                  required
                />
              </div>
              <div className="g-form-group">
                <label>Problema o Fricción Detectada (Línea Base As-Is)</label>
                <textarea
                  rows={2}
                  value={kaizenForm.problema_detectado}
                  onChange={(e) => setKaizenForm({ ...kaizenForm, problema_detectado: e.target.value })}
                  required
                />
              </div>
              <div className="g-form-group">
                <label>Hipótesis de Solución Superadora (Estado Objetivo To-Be)</label>
                <textarea
                  rows={2}
                  value={kaizenForm.hipotesis_mejora}
                  onChange={(e) => setKaizenForm({ ...kaizenForm, hipotesis_mejora: e.target.value })}
                  required
                />
              </div>
              <div className="g-form-group">
                <label>KPI de Impacto Medible</label>
                <input
                  type="text"
                  placeholder="Ej. Reducción de 15 min a 1 clic en reposición de film DTF"
                  value={kaizenForm.kpi_impacto}
                  onChange={(e) => setKaizenForm({ ...kaizenForm, kpi_impacto: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: '1rem' }}>
                <button type="button" className="g-btn g-btn-outline" onClick={() => setShowNewKaizenModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="g-btn g-btn-primary">
                  Iniciar Ciclo PDCA (PLAN)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
