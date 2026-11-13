import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import '../styles/workos.css';
import {
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
  getOperadorActual,
} from '../services/storageService.js';
import {
  IconPlus,
  IconDownload,
  IconTrash,
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
  IconPause,
  IconCheck,
  IconCalendar,
  IconChevronDown,
  IconMore,
  IconClose,
  IconArrowRight,
} from './Icons.jsx';

/* ------------------------------------------------------------------
   Constantes de presentación (lenguaje claro para uso diario;
   el término PMBOK se conserva como leyenda secundaria)
------------------------------------------------------------------- */
const PHASE_UI = {
  INICIACION: { label: 'Por iniciar', cap: 'Fase 01 · Iniciación' },
  PLANIFICACION: { label: 'Planificación', cap: 'Fase 02 · Planificación y EDT' },
  EJECUCION: { label: 'En curso', cap: 'Fase 03 · Ejecución (máx. 4 a la vez)' },
  MONITOREO_Y_CONTROL: { label: 'Revisión y control', cap: 'Fase 04 · QA y aprobación humana' },
  CIERRE: { label: 'Cerrado', cap: 'Fase 05 · Cierre y lecciones' },
};

const PRIO = {
  URGENTE: { chip: 'wos-chip--danger', color: '#b42318', label: 'Urgente' },
  ALTA: { chip: 'wos-chip--warn', color: '#b54708', label: 'Alta' },
  MEDIA: { chip: 'wos-chip--info', color: '#1a4295', label: 'Media' },
  BAJA: { chip: '', color: '#667085', label: 'Baja' },
};

const MODULE_LABELS = {
  pmbok_command: 'Inicio y Tablero',
  cotizador_dtf: 'Cotizador DTF 2D',
  crm: 'CRM y Leads B2B',
  remitos: 'Remitos',
  productos: 'Productos en Stock',
  materiales: 'Insumos y Materiales',
  design_studio: 'Estudio de Diseño',
  marketing: 'Agentes y Marketing',
  caja: 'Flujo de Caja',
  catalogo: 'Catálogo Tienda Web',
  configuracion: 'Sincronización y Bóveda',
};

const PDCA_STAGES = [
  { id: 'PLAN', label: 'Planificar', desc: 'Detectar fricción o merma y plantear una hipótesis', color: '#1a4295' },
  { id: 'DO', label: 'Probar', desc: 'Aplicar la mejora en un entorno controlado', color: '#0284c7' },
  { id: 'CHECK', label: 'Verificar', desc: 'Medir el resultado contra el KPI', color: '#b54708' },
  { id: 'ACT', label: 'Estandarizar', desc: 'Fijar el nuevo estándar y cerrar el ciclo', color: '#15803d' },
];

const MORE_VIEWS = [
  { id: 'mi_dia', label: 'Mi día', hint: 'Prioridades y checklist (Matriz de Eisenhower)' },
  { id: 'tabla', label: 'Tabla', hint: 'Edición en grilla con totales de horas' },
  { id: 'carga', label: 'Carga y avance', hint: 'Horas por responsable y curva de madurez' },
  { id: 'kaizen', label: 'Mejora continua', hint: 'Ciclos PDCA / Kaizen' },
  { id: 'automatizaciones', label: 'Automatizaciones', hint: 'Reglas sin código y referencias de 14 apps' },
];

const VIEW_COPY = {
  dashboard: { title: 'Inicio', sub: 'Tu día en AIRO Color Lab: qué hacer ahora, qué requiere atención y cómo arrancar un flujo de trabajo.' },
  kanban: { title: 'Tablero', sub: 'Arrastrá las tarjetas entre columnas o hacé clic en una para ver y editar su detalle.' },
  mi_dia: { title: 'Mi día', sub: 'Qué hacer primero, según urgencia e importancia.' },
  tabla: { title: 'Tabla de tareas', sub: 'Editá en la grilla; el tablero y las métricas se actualizan al instante.' },
  carga: { title: 'Carga y avance', sub: 'Dónde está cada tarea en su curva de madurez y cuánto trabajo tiene cada persona.' },
  kaizen: { title: 'Mejora continua', sub: 'Cada fricción detectada se convierte en un ciclo PDCA medible.' },
  automatizaciones: { title: 'Automatizaciones', sub: 'Reglas que conectan el tablero con Cotizador, Remitos, Caja y Mejora continua.' },
};

const BENCHMARK_14_APPS = [
  ['Trello', 'Arrastrar y soltar, etiquetas, portadas y clonado de tarjetas'],
  ['Asana', 'Plantillas de flujos de trabajo (WF-01 a WF-06)'],
  ['ClickUp', 'Varias vistas sobre los mismos datos y edición en vivo'],
  ['Monday.com', 'Panel de inicio con métricas y recetas de automatización'],
  ['Jira', 'Límite de trabajo en curso, bloqueos y códigos trazables'],
  ['Notion', 'Notas técnicas dentro de cada tarjeta'],
  ['Todoist', 'Captura rápida en lenguaje natural'],
  ['Microsoft Planner', 'Checklist visible dentro de la tarjeta'],
  ['Wrike', 'Lanzador de flujos con datos del cliente y carga por persona'],
  ['Linear', 'Filtros instantáneos y navegación por teclado'],
  ['Airtable', 'Vínculo de cada tarea con su módulo operativo'],
  ['Basecamp', 'Curva de madurez (Hill Chart) y bitácora de comentarios'],
  ['Smartsheet', 'Tabla editable con totales de horas'],
  ['TickTick', 'Temporizador Pomodoro y matriz de prioridades'],
];

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmtDate = (iso) => {
  if (!iso || typeof iso !== 'string' || iso.length < 10) return '—';
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] || ''}`;
};
const initials = (name) => {
  const parts = String(name || '?').split(/[\s.@_-]+/).filter(Boolean);
  return (parts[0]?.[0] || '?').toUpperCase() + (parts[1]?.[0] || '').toUpperCase();
};
const money = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------
   Piezas reutilizables
------------------------------------------------------------------- */
function useOutside(ref, onOutside, active) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside, active]);
}

// Campo con borrador local: guarda al salir del campo o con Enter (evita escribir en auditoría por cada tecla)
function DraftField({ value, onCommit, as = 'input', type = 'text', singleLine = false, ...rest }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  const commit = () => {
    if (String(draft) !== String(value ?? '')) onCommit(type === 'number' ? Number(draft) : draft);
  };
  const Tag = as;
  const extra = as === 'input' ? { type } : {};
  return (
    <Tag
      {...rest}
      {...extra}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (as === 'input' || singleLine)) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function Progress({ pct }) {
  return (
    <div className={`wos-progress ${pct === 100 ? 'is-done' : ''}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ==================================================================
   MÓDULO PRINCIPAL
================================================================== */
export default function PmbokCommandModule({ view: viewProp, onViewChange, onNavigateTab, onDataChanged }) {
  const [internalView, setInternalView] = useState('dashboard');
  const view = viewProp || internalView;
  const setView = useCallback(
    (v) => {
      if (onViewChange) onViewChange(v);
      else setInternalView(v);
    },
    [onViewChange]
  );

  const [tasks, setTasks] = useState(() => getPmbokTasks());
  const [kaizenList, setKaizenList] = useState(() => getKaizenCycles());
  const [recipes, setRecipes] = useState(() => getAutomationRecipes());

  // Panel lateral
  const [openTaskId, setOpenTaskId] = useState(null);
  const [drawerTab, setDrawerTab] = useState('detalle');

  // Filtros
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState('TODAS');
  const [filterPrio, setFilterPrio] = useState('TODAS');
  const [onlyBlocked, setOnlyBlocked] = useState(false);

  // Drag & drop
  const [draggedId, setDraggedId] = useState(null);
  const [overGroup, setOverGroup] = useState(null);

  // Captura rápida y ayuda
  const [quick, setQuick] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  // Alta en línea dentro de columna
  const [addingGroup, setAddingGroup] = useState(null);
  const [addingTitle, setAddingTitle] = useState('');

  // Menús, modales y avisos
  const [menu, setMenu] = useState(null); // 'views' | 'actions' | null
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewKaizen, setShowNewKaizen] = useState(false);
  const [wfModal, setWfModal] = useState(null);
  const [toast, setToast] = useState(null);

  // Temporizador
  const [timerSecs, setTimerSecs] = useState(25 * 60);
  const [timerOn, setTimerOn] = useState(false);

  // Inputs auxiliares del panel
  const [newStep, setNewStep] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newTag, setNewTag] = useState('');
  const [blockReason, setBlockReason] = useState('');

  const [wfForm, setWfForm] = useState({ cliente: '', fecha: '', responsable: '' });
  const [taskForm, setTaskForm] = useState({
    titulo: '',
    grupo_procesos: 'PLANIFICACION',
    prioridad: 'MEDIA',
    fecha_vencimiento: todayISO(),
    responsable: '',
    modulo_vinculado: 'pmbok_command',
    wbs_code: '',
    area_conocimiento: 'ALCANCE',
    hitl: 'HITL-1',
    esfuerzo_estimado_hs: 2,
    etiquetas_str: '',
    primera_subtarea: '',
  });
  const [kaizenForm, setKaizenForm] = useState({ titulo: '', problema_detectado: '', hipotesis_mejora: '', kpi_impacto: '' });

  const menuRef = useRef(null);
  const helpRef = useRef(null);
  useOutside(menuRef, () => setMenu(null), Boolean(menu));
  useOutside(helpRef, () => setShowHelp(false), showHelp);

  const operador = useMemo(() => String(getOperadorActual() || 'Equipo AIRO'), []);
  const firstName = useMemo(() => {
    const base = operador.split('@')[0].split(/[._-]/)[0];
    return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'equipo';
  }, [operador]);

  const notify = useCallback((msg, type = 'ok') => {
    setToast({ msg, type, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  const reload = useCallback(() => {
    setTasks(getPmbokTasks());
    setKaizenList(getKaizenCycles());
    setRecipes(getAutomationRecipes());
    if (onDataChanged) onDataChanged();
  }, [onDataChanged]);

  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) || null : null;
  const timerTask = openTask || tasks.find((t) => t.grupo_procesos === 'EJECUCION') || null;
  const timerTaskRef = useRef(null);
  timerTaskRef.current = timerTask;

  // Tecla Escape: cierra lo más "superior" abierto
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (wfModal) setWfModal(null);
      else if (showNewTask) setShowNewTask(false);
      else if (showNewKaizen) setShowNewKaizen(false);
      else if (menu) setMenu(null);
      else if (showHelp) setShowHelp(false);
      else if (openTaskId) setOpenTaskId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wfModal, showNewTask, showNewKaizen, menu, showHelp, openTaskId]);

  // Temporizador Pomodoro: acredita horas a la tarea activa al finalizar
  useEffect(() => {
    if (!timerOn) return undefined;
    const id = setInterval(() => {
      setTimerSecs((s) => {
        if (s > 1) return s - 1;
        setTimerOn(false);
        const t = timerTaskRef.current;
        if (t) {
          logPmbokTaskTime(t.id, 0.42);
          setTasks(getPmbokTasks());
          setToast({ msg: `Bloque de 25 min acreditado en ${t.id}.`, type: 'ok', id: Date.now() });
        }
        return 25 * 60;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerOn]);
  const timerLabel = `${String(Math.floor(timerSecs / 60)).padStart(2, '0')}:${String(timerSecs % 60).padStart(2, '0')}`;

  /* ---------------- Datos derivados ---------------- */
  const today = todayISO();
  const openTasks = tasks.filter((t) => t.grupo_procesos !== 'CIERRE');
  const overdue = openTasks.filter((t) => t.fecha_vencimiento && t.fecha_vencimiento < today);
  const dueToday = openTasks.filter((t) => t.fecha_vencimiento === today);
  const blocked = tasks.filter((t) => t.bloqueada);
  const executing = tasks.filter((t) => t.grupo_procesos === 'EJECUCION');
  const avgProgress = tasks.length ? Math.round(tasks.reduce((a, t) => a + (Number(t.progreso_pct) || 0), 0) / tasks.length) : 0;
  const attentionCount = new Set([...overdue, ...blocked].map((t) => t.id)).size;

  const approvalsPending = getApprovals().filter((a) => a.estado === 'PENDING').length;
  const leadsCount = getLeads().length;
  const dtfCount = getDtfQuotes().length;
  const remitosEnCurso = getRemitos().filter((r) => r.estado === 'Emitido' || r.estado === 'En Tránsito').length;
  const stockAlerts =
    getProductos().filter((p) => Number(p.stock_actual) <= Number(p.stock_minimo)).length +
    getMateriales().filter((m) => Number(m.stock_actual) <= Number(m.stock_minimo)).length;
  const flujos = getFlujoCaja();
  const balance =
    flujos.filter((t) => t.tipo === 'ingreso' && t.estado === 'Cobrado').reduce((a, t) => a + (Number(t.monto) || 0), 0) -
    flujos.filter((t) => t.tipo === 'egreso' && t.estado === 'Pagado').reduce((a, t) => a + (Number(t.monto) || 0), 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filterArea !== 'TODAS' && t.area_conocimiento !== filterArea) return false;
      if (filterPrio !== 'TODAS' && t.prioridad !== filterPrio) return false;
      if (onlyBlocked && !t.bloqueada) return false;
      if (q) {
        const hay = [t.titulo, t.id, t.wbs_code, t.responsable, ...(t.etiquetas || [])].some((v) => String(v || '').toLowerCase().includes(q));
        if (!hay) return false;
      }
      return true;
    });
  }, [tasks, search, filterArea, filterPrio, onlyBlocked]);
  const filtersActive = search || filterArea !== 'TODAS' || filterPrio !== 'TODAS' || onlyBlocked;

  /* ---------------- Acciones ---------------- */
  const update = (task, patch) => {
    savePmbokTask({ ...task, ...patch });
    reload();
  };
  const movePhase = (taskId, group) => {
    movePmbokTaskPhase(taskId, group);
    reload();
    notify(`${taskId} pasó a "${PHASE_UI[group]?.label || group}".`);
  };
  const stepPhase = (task, dir) => {
    const idx = PMBOK_PROCESS_GROUPS.findIndex((g) => g.id === task.grupo_procesos);
    const next = PMBOK_PROCESS_GROUPS[idx + dir];
    if (next) movePhase(task.id, next.id);
  };
  const openDrawer = (id, tab = 'detalle') => {
    setOpenTaskId(id);
    setDrawerTab(tab);
    setBlockReason('');
  };
  const goKanban = (opts = {}) => {
    if (opts.blocked !== undefined) setOnlyBlocked(opts.blocked);
    setView('kanban');
  };

  const handleQuickAdd = (e) => {
    e.preventDefault();
    if (!quick.trim()) return;
    try {
      const t = quickAddPmbokTask(quick);
      setQuick('');
      reload();
      notify(`Tarea creada: ${t.titulo} (${t.id}) en "En curso".`);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleInlineAdd = (e, group) => {
    e.preventDefault();
    const title = addingTitle.trim();
    if (!title) {
      setAddingGroup(null);
      return;
    }
    savePmbokTask({ titulo: title, grupo_procesos: group, prioridad: 'MEDIA', area_conocimiento: 'ALCANCE', hitl: 'HITL-1' });
    setAddingTitle('');
    setAddingGroup(null);
    reload();
    notify('Tarjeta creada.');
  };

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!taskForm.titulo.trim()) return;
    const tags = taskForm.etiquetas_str.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
    const created = savePmbokTask({
      ...taskForm,
      wbs_code: taskForm.wbs_code.trim() || undefined,
      responsable: taskForm.responsable.trim() || operador,
      etiquetas: tags.length ? tags : ['General'],
      subtasks: taskForm.primera_subtarea.trim() ? [{ id: `st-${Date.now()}`, text: taskForm.primera_subtarea.trim(), done: false }] : undefined,
    });
    setShowNewTask(false);
    setTaskForm((f) => ({ ...f, titulo: '', wbs_code: '', etiquetas_str: '', primera_subtarea: '' }));
    reload();
    notify(`Tarea ${created.id} creada.`);
    openDrawer(created.id);
  };

  const handleLaunchWorkflow = (e) => {
    e.preventDefault();
    if (!wfModal) return;
    try {
      const created = launchCompanyWorkflow(wfModal.id, {
        cliente_lote: wfForm.cliente,
        fecha_vencimiento: wfForm.fecha || undefined,
        responsable: wfForm.responsable || undefined,
      });
      setWfModal(null);
      setWfForm({ cliente: '', fecha: '', responsable: '' });
      reload();
      notify(`Flujo ${wfModal.codigo} iniciado: ${created.subtasks.length} pasos listos en el tablero.`);
      setView('kanban');
      openDrawer(created.id, 'checklist');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleExport = () => {
    const md = exportPmbokBoardToObsidianMarkdown();
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tablero Kanban y Google Tasks (PMBOK) - ${today}.md`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Tablero exportado como Kanban de Obsidian (.md).');
  };

  const handleCreateKaizen = (e) => {
    e.preventDefault();
    if (!kaizenForm.titulo.trim()) return;
    const c = saveKaizenCycle({ ...kaizenForm, etapa_pdca: 'PLAN' });
    setShowNewKaizen(false);
    setKaizenForm({ titulo: '', problema_detectado: '', hipotesis_mejora: '', kpi_impacto: '' });
    reload();
    notify(`Ciclo ${c.codigo} registrado en "Planificar".`);
    setView('kaizen');
  };

  const handleAdvanceKaizen = (c) => {
    const order = ['PLAN', 'DO', 'CHECK', 'ACT'];
    const next = order[Math.min(order.length - 1, order.indexOf(c.etapa_pdca) + 1)];
    advanceKaizenStage(c.id, next);
    reload();
    notify(`Ciclo ${c.codigo} avanzó a "${PDCA_STAGES.find((s) => s.id === next)?.label}".`);
  };

  const handleDelete = (task) => {
    if (!window.confirm(`¿Eliminar "${task.titulo}"? Esta acción queda registrada en auditoría.`)) return;
    deletePmbokTask(task.id);
    setOpenTaskId(null);
    reload();
    notify(`Tarea ${task.id} eliminada.`);
  };

  /* ---------------- Drag & drop ---------------- */
  const onDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };
  const onDropCol = (e, group) => {
    e.preventDefault();
    const id = draggedId || e.dataTransfer.getData('text/plain');
    setDraggedId(null);
    setOverGroup(null);
    const t = tasks.find((x) => x.id === id);
    if (id && t && t.grupo_procesos !== group) movePhase(id, group);
  };

  /* ==================================================================
     RENDER: piezas
  ================================================================== */
  const copy = VIEW_COPY[view] || VIEW_COPY.dashboard;
  const moreActive = MORE_VIEWS.find((m) => m.id === view);

  const renderTaskCard = (t) => {
    const grp = PMBOK_PROCESS_GROUPS.find((g) => g.id === t.grupo_procesos);
    const idx = PMBOK_PROCESS_GROUPS.findIndex((g) => g.id === t.grupo_procesos);
    const total = (t.subtasks || []).length;
    const done = (t.subtasks || []).filter((s) => s.done).length;
    const late = t.grupo_procesos !== 'CIERRE' && t.fecha_vencimiento && t.fecha_vencimiento < today;
    const prio = PRIO[t.prioridad] || PRIO.MEDIA;
    const tags = t.etiquetas || [];
    const color = t.bloqueada ? '#b42318' : t.color_portada || grp?.color || '#1a4295';
    return (
      <article
        key={t.id}
        className={`wos-task ${t.bloqueada ? 'is-blocked' : ''} ${draggedId === t.id ? 'is-dragging' : ''}`}
        style={{ '--task-color': color }}
        draggable
        tabIndex={0}
        aria-label={`${t.titulo}. ${PHASE_UI[t.grupo_procesos]?.label}. Prioridad ${prio.label}.`}
        onDragStart={(e) => onDragStart(e, t.id)}
        onDragEnd={() => {
          setDraggedId(null);
          setOverGroup(null);
        }}
        onClick={() => openDrawer(t.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target === e.currentTarget) openDrawer(t.id);
        }}
      >
        <div className="wos-task-top">
          <span className="wos-task-id">{t.id}</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {(t.prioridad === 'URGENTE' || t.prioridad === 'ALTA') && <span className={`wos-chip ${prio.chip}`}>{prio.label}</span>}
            <div className="wos-task-steps" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="wos-step-btn" disabled={idx <= 0} aria-label="Mover a la columna anterior" onClick={() => stepPhase(t, -1)}>
                &larr;
              </button>
              <button type="button" className="wos-step-btn" disabled={idx >= PMBOK_PROCESS_GROUPS.length - 1} aria-label="Mover a la columna siguiente" onClick={() => stepPhase(t, 1)}>
                &rarr;
              </button>
            </div>
          </div>
        </div>
        <div className="wos-task-title">{t.titulo}</div>
        {t.bloqueada && <span className="wos-chip wos-chip--danger">Bloqueada: {t.motivo_bloqueo || 'requiere destrabe'}</span>}
        {tags.length > 0 && (
          <div className="wos-task-chips">
            {tags.slice(0, 2).map((tag) => (
              <span key={tag} className="wos-chip wos-chip--tag">
                {tag}
              </span>
            ))}
            {tags.length > 2 && <span className="wos-chip">+{tags.length - 2}</span>}
          </div>
        )}
        {total > 0 && <Progress pct={Number(t.progreso_pct) || 0} />}
        <div className="wos-task-foot">
          <div className="wos-task-foot-left">
            {total > 0 && (
              <span title="Pasos completados">
                <IconCheck size={13} /> {done}/{total}
              </span>
            )}
            <span className={late ? 'is-overdue' : ''} title={late ? 'Vencida' : 'Fecha límite'}>
              <IconCalendar /> {fmtDate(t.fecha_vencimiento)}
            </span>
          </div>
          <span className="wos-avatar" title={t.responsable}>
            {initials(t.responsable)}
          </span>
        </div>
      </article>
    );
  };

  /* ---------------- Vista: INICIO ---------------- */
  const focusList = [...openTasks]
    .sort((a, b) => {
      const score = (t) => (t.bloqueada ? 0 : t.fecha_vencimiento && t.fecha_vencimiento < today ? 1 : t.fecha_vencimiento === today ? 2 : t.grupo_procesos === 'EJECUCION' ? 3 : 4);
      return score(a) - score(b) || String(a.fecha_vencimiento).localeCompare(String(b.fecha_vencimiento));
    })
    .slice(0, 6);

  const alerts = [
    blocked.length > 0 && { dot: '#b42318', text: `${blocked.length} tarea${blocked.length > 1 ? 's' : ''} bloqueada${blocked.length > 1 ? 's' : ''}`, go: () => goKanban({ blocked: true }) },
    overdue.length > 0 && { dot: '#b54708', text: `${overdue.length} tarea${overdue.length > 1 ? 's' : ''} vencida${overdue.length > 1 ? 's' : ''}`, go: () => goKanban({ blocked: false }) },
    approvalsPending > 0 && { dot: '#1a4295', text: `${approvalsPending} aprobación${approvalsPending > 1 ? 'es' : ''} humana${approvalsPending > 1 ? 's' : ''} pendiente${approvalsPending > 1 ? 's' : ''}`, go: () => onNavigateTab && onNavigateTab('marketing') },
    stockAlerts > 0 && { dot: '#b54708', text: `${stockAlerts} ítem${stockAlerts > 1 ? 's' : ''} con stock en o bajo el mínimo`, go: () => onNavigateTab && onNavigateTab('materiales') },
    remitosEnCurso > 0 && { dot: '#0284c7', text: `${remitosEnCurso} remito${remitosEnCurso > 1 ? 's' : ''} en despacho`, go: () => onNavigateTab && onNavigateTab('remitos') },
  ].filter(Boolean);

  const renderDashboard = () => {
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
    const dateLabel = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    return (
      <>
        <div className="wos-hello">
          <h3>
            {greet}, {firstName}.
          </h3>
          <p>
            {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} · {dueToday.length} vencen hoy · {blocked.length} bloqueadas
          </p>
        </div>

        <div className="wos-kpis gestion-kpis">
          <button type="button" className="wos-kpi" onClick={() => goKanban({ blocked: false })}>
            <span className="wos-kpi-label">Tareas abiertas</span>
            <span className="wos-kpi-value">{openTasks.length}</span>
            <span className="wos-kpi-foot">{avgProgress}% de avance global</span>
          </button>
          <button type="button" className={`wos-kpi ${attentionCount > 0 ? 'is-alert' : 'is-good'}`} onClick={() => goKanban({ blocked: false })}>
            <span className="wos-kpi-label">Requieren atención</span>
            <span className="wos-kpi-value">{attentionCount}</span>
            <span className="wos-kpi-foot">{attentionCount > 0 ? 'Vencidas o bloqueadas' : 'Todo bajo control'}</span>
          </button>
          <button type="button" className="wos-kpi" onClick={() => onNavigateTab && onNavigateTab('cotizador_dtf')}>
            <span className="wos-kpi-label">Cotizaciones DTF</span>
            <span className="wos-kpi-value">{dtfCount}</span>
            <span className="wos-kpi-foot">{leadsCount} leads en el CRM</span>
          </button>
          <button type="button" className={`wos-kpi ${balance >= 0 ? 'is-good' : 'is-alert'}`} onClick={() => onNavigateTab && onNavigateTab('caja')}>
            <span className="wos-kpi-label">Balance de caja</span>
            <span className="wos-kpi-value">{money(balance)}</span>
            <span className="wos-kpi-foot">{approvalsPending} aprobaciones pendientes</span>
          </button>
        </div>

        <div className="wos-dash">
          <div className="wos-stack">
            <section className="wos-card" aria-labelledby="wos-focus">
              <div className="wos-card-head">
                <div>
                  <h3 className="wos-card-title" id="wos-focus">
                    Mi foco de hoy
                  </h3>
                  <p className="wos-card-sub">Ordenado por bloqueo, vencimiento y estado. Tildá el siguiente paso sin salir de acá.</p>
                </div>
                <button type="button" className="wos-btn wos-btn--sm" onClick={() => goKanban({ blocked: false })}>
                  Ver tablero <IconArrowRight size={13} />
                </button>
              </div>
              <div style={{ marginTop: 10 }}>
                {focusList.length === 0 && <div className="wos-empty">No hay tareas abiertas. Iniciá un flujo de trabajo desde el panel derecho.</div>}
                {focusList.map((t) => {
                  const next = (t.subtasks || []).find((s) => !s.done);
                  const late = t.fecha_vencimiento && t.fecha_vencimiento < today;
                  const prio = PRIO[t.prioridad] || PRIO.MEDIA;
                  return (
                    <div className="wos-focus-row" key={t.id}>
                      <span className="wos-focus-bar" style={{ background: t.bloqueada ? '#b42318' : t.color_portada || '#1a4295' }} />
                      <div style={{ minWidth: 0 }}>
                        <button type="button" className="wos-focus-title" onClick={() => openDrawer(t.id)}>
                          {t.titulo}
                        </button>
                        <div className="wos-focus-meta">
                          <span className="wos-chip">{PHASE_UI[t.grupo_procesos]?.label}</span>
                          {t.bloqueada && <span className="wos-chip wos-chip--danger">Bloqueada</span>}
                          <span className={`wos-chip ${late ? 'wos-chip--danger' : ''}`}>
                            <IconCalendar /> {fmtDate(t.fecha_vencimiento)}
                          </span>
                          {(t.prioridad === 'URGENTE' || t.prioridad === 'ALTA') && <span className={`wos-chip ${prio.chip}`}>{prio.label}</span>}
                        </div>
                        {next && (
                          <label className="wos-next-step">
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() => {
                                togglePmbokSubtask(t.id, next.id);
                                reload();
                                notify('Paso completado.');
                              }}
                            />
                            <span>Siguiente: {next.text}</span>
                          </label>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 64 }}>
                        <strong style={{ fontSize: 13 }}>{t.progreso_pct}%</strong>
                        {t.modulo_vinculado && t.modulo_vinculado !== 'pmbok_command' && onNavigateTab && (
                          <button type="button" className="wos-btn wos-btn--sm" onClick={() => onNavigateTab(t.modulo_vinculado)}>
                            Abrir módulo
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="wos-card" aria-labelledby="wos-alerts">
              <div className="wos-card-head">
                <h3 className="wos-card-title" id="wos-alerts">
                  Requiere atención
                </h3>
              </div>
              <div style={{ marginTop: 8 }}>
                {alerts.length === 0 && <div className="wos-empty">Todo en orden: sin bloqueos, vencimientos ni alertas operativas.</div>}
                {alerts.map((a) => (
                  <button type="button" className="wos-alert-row" key={a.text} onClick={a.go}>
                    <span>
                      <span className="wos-dot" style={{ background: a.dot }} />
                      {a.text}
                    </span>
                    <IconArrowRight size={14} />
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="wos-stack">
            <section className="wos-card" aria-labelledby="wos-wf">
              <div className="wos-card-head">
                <div>
                  <h3 className="wos-card-title" id="wos-wf">
                    Iniciar un flujo de trabajo
                  </h3>
                  <p className="wos-card-sub">Cada flujo crea una tarea con sus pasos ya cargados.</p>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                {AIRO_COMPANY_WORKFLOWS.map((wf) => (
                  <div className="wos-wf-row" key={wf.id}>
                    <span className="wos-focus-bar" style={{ background: wf.color_portada, alignSelf: 'stretch' }} />
                    <div style={{ minWidth: 0 }}>
                      <div className="wos-wf-name">
                        {wf.nombre.replace(/\s*\(.*\)$/, '')}
                      </div>
                      <div className="wos-wf-sub">
                        {wf.codigo} · {wf.subtasks.length} pasos · {wf.hitl}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="wos-btn wos-btn--sm wos-btn--primary"
                      onClick={() => {
                        setWfModal(wf);
                        setWfForm({ cliente: '', fecha: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), responsable: '' });
                      }}
                    >
                      Iniciar
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="wos-card" aria-labelledby="wos-quick">
              <div className="wos-card-head">
                <h3 className="wos-card-title" id="wos-quick">
                  Accesos directos
                </h3>
              </div>
              <div className="wos-card-body">
                <div className="wos-tiles">
                  {[
                    ['crm', 'CRM y Leads', IconBriefcase],
                    ['cotizador_dtf', 'Cotizador DTF', IconRuler],
                    ['remitos', 'Remitos', IconFile],
                    ['productos', 'Stock', IconBox],
                    ['materiales', 'Insumos', IconFabric],
                    ['caja', 'Flujo de caja', IconWallet],
                    ['design_studio', 'Estudio de diseño', IconCanvas],
                  ].map(([id, label, Ico]) => (
                    <button type="button" className="wos-tile" key={id} onClick={() => onNavigateTab && onNavigateTab(id)}>
                      <Ico size={18} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </>
    );
  };

  /* ---------------- Vista: TABLERO ---------------- */
  const renderKanban = () => (
    <>
      <div className="wos-filters">
        <label className="wos-search">
          <IconSearch size={15} />
          <span className="wos-sr">Buscar tarjetas</span>
          <input type="search" placeholder="Buscar por título, código, etiqueta o responsable" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <select className="wos-select" aria-label="Filtrar por área" value={filterArea} onChange={(e) => setFilterArea(e.target.value)}>
          <option value="TODAS">Todas las áreas</option>
          {PMBOK_KNOWLEDGE_AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label.replace(/^\d+\.\s*/, '')}
            </option>
          ))}
        </select>
        <select className="wos-select" aria-label="Filtrar por prioridad" value={filterPrio} onChange={(e) => setFilterPrio(e.target.value)}>
          <option value="TODAS">Toda prioridad</option>
          {Object.entries(PRIO).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <button type="button" className="wos-toggle" aria-pressed={onlyBlocked} onClick={() => setOnlyBlocked((v) => !v)}>
          Bloqueadas ({blocked.length})
        </button>
        {filtersActive && (
          <button
            type="button"
            className="wos-btn wos-btn--ghost wos-btn--sm"
            onClick={() => {
              setSearch('');
              setFilterArea('TODAS');
              setFilterPrio('TODAS');
              setOnlyBlocked(false);
            }}
          >
            Limpiar filtros
          </button>
        )}
        <span className="wos-filters-count">
          {filtered.length} de {tasks.length} tarjetas
        </span>
      </div>

      <div className="wos-board-wrap">
        <div className="wos-board">
          {PMBOK_PROCESS_GROUPS.map((grp) => {
            const col = filtered.filter((t) => t.grupo_procesos === grp.id);
            const overLimit = grp.id === 'EJECUCION' && col.length > 4;
            return (
              <section
                key={grp.id}
                className={`wos-col ${overGroup === grp.id ? 'is-over' : ''}`}
                aria-label={PHASE_UI[grp.id].label}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (overGroup !== grp.id) setOverGroup(grp.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setOverGroup(null);
                }}
                onDrop={(e) => onDropCol(e, grp.id)}
              >
                <div className="wos-col-head">
                  <span className="wos-dot" style={{ background: grp.color }} />
                  <h3 className="wos-col-title">
                    {PHASE_UI[grp.id].label}
                    <small>{PHASE_UI[grp.id].cap}</small>
                  </h3>
                  <span className={`wos-col-count ${overLimit ? 'is-over-limit' : ''}`} title={overLimit ? 'Hay más de 4 tareas en curso: conviene terminar antes de empezar otras' : ''}>
                    {col.length}
                  </span>
                </div>
                <div className="wos-col-body">
                  {col.length === 0 && <div className="wos-col-empty">{filtersActive ? 'Sin coincidencias' : 'Arrastrá una tarjeta acá'}</div>}
                  {col.map((t) => renderTaskCard(t))}
                </div>
                <div className="wos-col-add">
                  {addingGroup === grp.id ? (
                    <form onSubmit={(e) => handleInlineAdd(e, grp.id)}>
                      <input
                        autoFocus
                        aria-label="Título de la nueva tarjeta"
                        placeholder="Título y Enter para crear"
                        value={addingTitle}
                        onChange={(e) => setAddingTitle(e.target.value)}
                        onBlur={() => {
                          setAddingGroup(null);
                          setAddingTitle('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setAddingGroup(null);
                            setAddingTitle('');
                          }
                        }}
                      />
                    </form>
                  ) : (
                    <button type="button" className="wos-btn wos-btn--ghost wos-btn--sm" onClick={() => setAddingGroup(grp.id)}>
                      <IconPlus size={13} /> Añadir tarjeta
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );

  /* ---------------- Vistas secundarias ---------------- */
  const renderMiDia = () => {
    const quads = [
      { t: 'Hacer ahora', d: 'Urgente, o importante y ya en curso', c: '#b42318', items: openTasks.filter((t) => t.prioridad === 'URGENTE' || (t.prioridad === 'ALTA' && t.grupo_procesos === 'EJECUCION')) },
      { t: 'Planificar', d: 'Importante, todavía sin urgencia', c: '#1a4295', items: openTasks.filter((t) => t.prioridad === 'ALTA' && t.grupo_procesos !== 'EJECUCION') },
      { t: 'Automatizar o delegar', d: 'Operativo, con pasos estandarizados', c: '#0284c7', items: openTasks.filter((t) => t.prioridad === 'MEDIA') },
      { t: 'Más adelante', d: 'Baja prioridad o ideas en reserva', c: '#667085', items: openTasks.filter((t) => t.prioridad === 'BAJA') },
    ];
    return (
      <div className="wos-quads">
        {quads.map((q) => (
          <section className="wos-card wos-quad" style={{ '--q-color': q.c }} key={q.t}>
            <div className="wos-card-head">
              <div>
                <h3 className="wos-card-title">{q.t}</h3>
                <p className="wos-card-sub">{q.d}</p>
              </div>
              <span className="wos-chip">{q.items.length}</span>
            </div>
            <div className="wos-card-body">
              {q.items.length === 0 && <div className="wos-empty" style={{ padding: 14 }}>Sin tareas en este cuadrante.</div>}
              {q.items.map((t) => (
                <div className="wos-mini" key={t.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <button type="button" className="wos-mini-title" onClick={() => openDrawer(t.id)}>
                      {t.titulo}
                    </button>
                    <span className="wos-chip">{fmtDate(t.fecha_vencimiento)}</span>
                  </div>
                  {(t.subtasks || []).map((s) => (
                    <label key={s.id} className={`wos-check ${s.done ? 'is-done' : ''}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(s.done)}
                        onChange={() => {
                          togglePmbokSubtask(t.id, s.id);
                          reload();
                        }}
                      />
                      <span style={{ fontSize: 13 }}>{s.text}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  };

  const renderTabla = () => {
    const estTotal = filtered.reduce((a, t) => a + (Number(t.esfuerzo_estimado_hs) || 0), 0);
    const realTotal = filtered.reduce((a, t) => a + (Number(t.horas_reales) || 0), 0);
    return (
      <section className="wos-card">
        <div className="wos-card-head">
          <div>
            <h3 className="wos-card-title">Todas las tareas ({filtered.length})</h3>
            <p className="wos-card-sub">Los cambios se guardan al salir de cada celda.</p>
          </div>
          <label className="wos-search" style={{ maxWidth: 280 }}>
            <IconSearch size={15} />
            <span className="wos-sr">Buscar</span>
            <input type="search" placeholder="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
        </div>
        <div className="wos-table-wrap" style={{ marginTop: 12 }}>
          <table className="wos-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Tarea</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Vence</th>
                <th>Hs est.</th>
                <th>Hs reales</th>
                <th>Avance</th>
                <th>Módulo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{t.id}</td>
                  <td style={{ minWidth: 260 }}>
                    <DraftField value={t.titulo} onCommit={(v) => update(t, { titulo: v })} style={{ width: '100%', fontWeight: 600 }} aria-label={`Título de ${t.id}`} />
                  </td>
                  <td>
                    <select value={t.grupo_procesos} onChange={(e) => movePhase(t.id, e.target.value)} aria-label={`Estado de ${t.id}`}>
                      {PMBOK_PROCESS_GROUPS.map((g) => (
                        <option key={g.id} value={g.id}>
                          {PHASE_UI[g.id].label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={t.prioridad || 'MEDIA'} onChange={(e) => update(t, { prioridad: e.target.value })} aria-label={`Prioridad de ${t.id}`}>
                      {Object.entries(PRIO).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input type="date" value={t.fecha_vencimiento || ''} onChange={(e) => update(t, { fecha_vencimiento: e.target.value })} aria-label={`Vencimiento de ${t.id}`} />
                  </td>
                  <td>
                    <DraftField type="number" min="0" step="0.5" value={t.esfuerzo_estimado_hs || 0} onCommit={(v) => update(t, { esfuerzo_estimado_hs: v })} style={{ width: 70 }} aria-label={`Horas estimadas de ${t.id}`} />
                  </td>
                  <td>
                    <DraftField type="number" min="0" step="0.5" value={t.horas_reales || 0} onCommit={(v) => update(t, { horas_reales: v })} style={{ width: 70 }} aria-label={`Horas reales de ${t.id}`} />
                  </td>
                  <td style={{ fontWeight: 700 }}>{t.progreso_pct}%</td>
                  <td>
                    <button type="button" className="wos-btn wos-btn--sm" onClick={() => onNavigateTab && onNavigateTab(t.modulo_vinculado || 'cotizador_dtf')}>
                      {MODULE_LABELS[t.modulo_vinculado] || 'Abrir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Totales</td>
                <td>{estTotal} h</td>
                <td>{realTotal} h</td>
                <td colSpan={2}>Desvío: {(realTotal - estTotal).toFixed(1)} h</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    );
  };

  const renderCarga = () => {
    const workload = Object.entries(
      tasks.reduce((acc, t) => {
        const k = t.responsable || 'Sin asignar';
        acc[k] = acc[k] || { est: 0, real: 0, n: 0 };
        acc[k].est += Number(t.esfuerzo_estimado_hs) || 0;
        acc[k].real += Number(t.horas_reales) || 0;
        acc[k].n += 1;
        return acc;
      }, {})
    );
    const maxEst = Math.max(1, ...workload.map(([, d]) => d.est));
    return (
      <div className="wos-split">
        <section className="wos-card">
          <div className="wos-card-head">
            <div>
              <h3 className="wos-card-title">Curva de madurez de las tareas abiertas</h3>
              <p className="wos-card-sub">A la izquierda de la cima se define el alcance; a la derecha, la ejecución ya es firme.</p>
            </div>
          </div>
          <div className="wos-card-body">
            <svg className="wos-hill" viewBox="0 0 600 230" role="img" aria-label="Curva de madurez de tareas">
              <line x1="300" y1="20" x2="300" y2="195" stroke="#98a2b3" strokeDasharray="4 4" />
              <path d="M 40 190 Q 170 190 300 45 Q 430 190 560 190" fill="none" stroke="#1a4295" strokeWidth="3" />
              <text x="80" y="217" fontSize="11" fontWeight="700" fill="#475467">
                Definiendo (0–49%)
              </text>
              <text x="380" y="217" fontSize="11" fontWeight="700" fill="#067647">
                Ejecutando (50–100%)
              </text>
              {openTasks.map((t, i) => {
                const pct = Math.max(0, Math.min(100, Number(t.progreso_pct) || 0));
                const x = 40 + (pct / 100) * 520;
                const n = (pct - 50) / 50;
                const y = 48 + n * n * 138;
                return (
                  <g key={t.id} style={{ cursor: 'pointer' }} onClick={() => openDrawer(t.id)}>
                    <circle cx={x} cy={y} r="7" fill={t.bloqueada ? '#b42318' : '#00b4d8'} stroke="#fff" strokeWidth="2" />
                    <text x={x + 10} y={y + 4 - (i % 2) * 9} fontSize="10" fontWeight="700" fill="#111">
                      {t.id}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>
        <section className="wos-card">
          <div className="wos-card-head">
            <div>
              <h3 className="wos-card-title">Carga por responsable</h3>
              <p className="wos-card-sub">Horas reales sobre estimadas.</p>
            </div>
          </div>
          <div className="wos-card-body">
            {workload.map(([name, d]) => (
              <div className="wos-load-row" key={name}>
                <div>
                  <span>
                    {name} <span className="wos-muted">({d.n})</span>
                  </span>
                  <span>
                    {d.real} / {d.est} h
                  </span>
                </div>
                <Progress pct={Math.round((d.est / maxEst) * 100)} />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  };

  const renderAutomatizaciones = () => (
    <>
      <section className="wos-card">
        <div className="wos-card-head">
          <div>
            <h3 className="wos-card-title">Reglas automáticas</h3>
            <p className="wos-card-sub">Activalas o pausalas según cómo trabaje el equipo.</p>
          </div>
        </div>
        <div className="wos-card-body">
          <div className="wos-recipes">
            {recipes.map((r) => (
              <div className={`wos-recipe ${r.enabled ? 'is-on' : ''}`} key={r.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <b>{r.nombre.replace(/\s*\(.*\)$/, '')}</b>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.enabled}
                    aria-label={`${r.enabled ? 'Pausar' : 'Activar'} ${r.codigo}`}
                    className="wos-switch"
                    onClick={() => {
                      toggleAutomationRecipe(r.id);
                      reload();
                    }}
                  />
                </div>
                <span>
                  <strong>Cuando:</strong> {r.trigger}
                </span>
                <span>
                  <strong>Entonces:</strong> {r.action}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <details className="wos-card wos-details">
        <summary>
          Qué incorporamos de 14 herramientas líderes <IconChevronDown />
        </summary>
        <div className="wos-table-wrap">
          <table className="wos-table">
            <thead>
              <tr>
                <th>Herramienta</th>
                <th>Qué se incorporó</th>
              </tr>
            </thead>
            <tbody>
              {BENCHMARK_14_APPS.map(([app, feat]) => (
                <tr key={app}>
                  <td style={{ fontWeight: 700, color: '#1a4295' }}>{app}</td>
                  <td>{feat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );

  const renderKaizen = () => (
    <div className="wos-pdca">
      {PDCA_STAGES.map((s, i) => {
        const items = kaizenList.filter((c) => c.etapa_pdca === s.id);
        return (
          <section className="wos-col" style={{ background: '#fff', border: '1px solid var(--line)' }} key={s.id}>
            <div className="wos-col-head">
              <span className="wos-dot" style={{ background: s.color }} />
              <h3 className="wos-col-title">
                {i + 1}. {s.label}
                <small>{s.desc}</small>
              </h3>
              <span className="wos-col-count">{items.length}</span>
            </div>
            <div className="wos-col-body" style={{ maxHeight: 'none' }}>
              {items.length === 0 && <div className="wos-col-empty">Sin ciclos en esta etapa</div>}
              {items.map((c) => (
                <article className="wos-task" style={{ '--task-color': s.color, cursor: 'default' }} key={c.id}>
                  <div className="wos-task-top">
                    <span className="wos-task-id">{c.codigo}</span>
                    <span className="wos-chip">WBS {c.wbs_ref}</span>
                  </div>
                  <div className="wos-task-title">{c.titulo}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-70)' }}>
                    <strong>Problema:</strong> {c.problema_detectado}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#067647' }}>
                    <strong>KPI:</strong> {c.kpi_impacto}
                  </div>
                  {s.id !== 'ACT' && (
                    <button type="button" className="wos-btn wos-btn--sm" onClick={() => handleAdvanceKaizen(c)}>
                      Pasar a {PDCA_STAGES[i + 1].label.toLowerCase()} <IconArrowRight size={12} />
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );

  /* ---------------- Panel lateral de tarea ---------------- */
  const renderDrawer = () => {
    const t = openTask;
    if (!t) return null;
    const steps = t.subtasks || [];
    const done = steps.filter((s) => s.done).length;
    const comments = t.comentarios || [];
    return (
      <>
        <div className="wos-backdrop" onClick={() => setOpenTaskId(null)} aria-hidden="true" />
        <aside className="wos-drawer wos" role="dialog" aria-modal="true" aria-label={`Detalle de ${t.id}`} key={t.id}>
          <div className="wos-drawer-head">
            <div className="wos-drawer-top">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="wos-chip wos-chip--info">{t.id}</span>
                <span className="wos-chip">EDT {t.wbs_code}</span>
                <span className="wos-chip">{PHASE_UI[t.grupo_procesos]?.label}</span>
                {t.bloqueada && <span className="wos-chip wos-chip--danger">Bloqueada</span>}
              </div>
              <button type="button" className="wos-btn wos-btn--ghost wos-btn--icon wos-btn--sm" onClick={() => setOpenTaskId(null)} aria-label="Cerrar panel">
                <IconClose size={16} />
              </button>
            </div>
            <DraftField as="textarea" singleLine rows={Math.min(4, Math.max(1, Math.ceil(String(t.titulo || '').length / 34)))} className="wos-drawer-title" value={t.titulo} onCommit={(v) => update(t, { titulo: v })} aria-label="Título de la tarea" />
            <div style={{ marginTop: 8 }}>
              <Progress pct={Number(t.progreso_pct) || 0} />
            </div>
          </div>

          <div className="wos-tabs" role="tablist" aria-label="Secciones de la tarea">
            {[
              ['detalle', 'Detalle'],
              ['checklist', `Checklist (${done}/${steps.length})`],
              ['notas', `Notas y actividad${comments.length ? ` (${comments.length})` : ''}`],
            ].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={drawerTab === id} onClick={() => setDrawerTab(id)}>
                {label}
              </button>
            ))}
          </div>

          <div className="wos-drawer-body">
            {drawerTab === 'detalle' && (
              <>
                <div className="wos-fields">
                  <div className="wos-field">
                    <label htmlFor="d-fase">Estado</label>
                    <select id="d-fase" value={t.grupo_procesos} onChange={(e) => movePhase(t.id, e.target.value)}>
                      {PMBOK_PROCESS_GROUPS.map((g) => (
                        <option key={g.id} value={g.id}>
                          {PHASE_UI[g.id].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="wos-field">
                    <label htmlFor="d-prio">Prioridad</label>
                    <select id="d-prio" value={t.prioridad || 'MEDIA'} onChange={(e) => update(t, { prioridad: e.target.value })}>
                      {Object.entries(PRIO).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="wos-field">
                    <label htmlFor="d-fecha">Fecha límite</label>
                    <input id="d-fecha" type="date" value={t.fecha_vencimiento || ''} onChange={(e) => update(t, { fecha_vencimiento: e.target.value })} />
                  </div>
                  <div className="wos-field">
                    <label htmlFor="d-resp">Responsable</label>
                    <DraftField id="d-resp" value={t.responsable || ''} onCommit={(v) => update(t, { responsable: v })} />
                  </div>
                  <div className="wos-field">
                    <label htmlFor="d-est">Horas estimadas</label>
                    <DraftField id="d-est" type="number" min="0" step="0.5" value={t.esfuerzo_estimado_hs || 0} onCommit={(v) => update(t, { esfuerzo_estimado_hs: v })} />
                  </div>
                  <div className="wos-field">
                    <label htmlFor="d-real">Horas reales</label>
                    <DraftField id="d-real" type="number" min="0" step="0.5" value={t.horas_reales || 0} onCommit={(v) => update(t, { horas_reales: v })} />
                  </div>
                  <div className="wos-field">
                    <label htmlFor="d-area">Área de conocimiento</label>
                    <select id="d-area" value={t.area_conocimiento} onChange={(e) => update(t, { area_conocimiento: e.target.value })}>
                      {PMBOK_KNOWLEDGE_AREAS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label.replace(/^\d+\.\s*/, '')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="wos-field">
                    <label htmlFor="d-hitl">Nivel de aprobación</label>
                    <select id="d-hitl" value={t.hitl || 'HITL-1'} onChange={(e) => update(t, { hitl: e.target.value })}>
                      <option value="HITL-0">HITL-0 · Interno</option>
                      <option value="HITL-1">HITL-1 · Operativo</option>
                      <option value="HITL-2">HITL-2 · Publicación o envío</option>
                      <option value="HITL-3">HITL-3 · Precios o estrategia</option>
                    </select>
                  </div>
                  <div className="wos-field is-wide">
                    <label htmlFor="d-mod">Módulo vinculado</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select id="d-mod" value={t.modulo_vinculado || 'pmbok_command'} onChange={(e) => update(t, { modulo_vinculado: e.target.value })}>
                        {Object.entries(MODULE_LABELS).map(([k, l]) => (
                          <option key={k} value={k}>
                            {l}
                          </option>
                        ))}
                      </select>
                      {t.modulo_vinculado && t.modulo_vinculado !== 'pmbok_command' && onNavigateTab && (
                        <button type="button" className="wos-btn wos-btn--primary" onClick={() => onNavigateTab(t.modulo_vinculado)}>
                          Abrir
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`wos-block ${t.bloqueada ? 'is-blocked' : ''}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 13.5, color: t.bloqueada ? '#b42318' : 'inherit' }}>{t.bloqueada ? 'Tarea bloqueada' : 'Sin bloqueos'}</strong>
                    <button
                      type="button"
                      className={`wos-btn wos-btn--sm ${t.bloqueada ? '' : 'wos-btn--danger'}`}
                      onClick={() => {
                        const next = !t.bloqueada;
                        togglePmbokTaskBlocker(t.id, next, next ? blockReason : '');
                        setBlockReason('');
                        reload();
                        notify(next ? `${t.id} marcada como bloqueada y priorizada como urgente.` : `Bloqueo levantado en ${t.id}.`);
                      }}
                    >
                      {t.bloqueada ? 'Levantar bloqueo' : 'Marcar como bloqueada'}
                    </button>
                  </div>
                  {t.bloqueada ? (
                    <span style={{ fontSize: 13 }}>Motivo: {t.motivo_bloqueo}</span>
                  ) : (
                    <input className="wos-input" placeholder="Motivo del bloqueo (opcional)" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} aria-label="Motivo del bloqueo" />
                  )}
                </div>

                <div>
                  <h4 className="wos-section-title">Etiquetas</h4>
                  <div className="wos-tags" style={{ marginBottom: 8 }}>
                    {(t.etiquetas || []).length === 0 && <span className="wos-muted" style={{ fontSize: 13 }}>Sin etiquetas</span>}
                    {(t.etiquetas || []).map((tag) => (
                      <span className="wos-chip wos-chip--tag" key={tag}>
                        {tag}
                        <button type="button" aria-label={`Quitar etiqueta ${tag}`} onClick={() => update(t, { etiquetas: (t.etiquetas || []).filter((x) => x !== tag) })}>
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                  <form
                    className="wos-inline-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const clean = newTag.trim().replace(/^#/, '');
                      if (clean && !(t.etiquetas || []).includes(clean)) update(t, { etiquetas: [...(t.etiquetas || []), clean] });
                      setNewTag('');
                    }}
                  >
                    <input placeholder="Nueva etiqueta" value={newTag} onChange={(e) => setNewTag(e.target.value)} aria-label="Nueva etiqueta" />
                    <button type="submit" className="wos-btn">
                      Añadir
                    </button>
                  </form>
                </div>
              </>
            )}

            {drawerTab === 'checklist' && (
              <>
                <div style={{ display: 'grid', gap: 8 }}>
                  {steps.length === 0 && <div className="wos-empty" style={{ padding: 14 }}>Esta tarea todavía no tiene pasos.</div>}
                  {steps.map((s) => (
                    <div className={`wos-check ${s.done ? 'is-done' : ''}`} key={s.id}>
                      <input
                        id={`st-${s.id}`}
                        type="checkbox"
                        checked={Boolean(s.done)}
                        onChange={() => {
                          togglePmbokSubtask(t.id, s.id);
                          reload();
                        }}
                      />
                      <label htmlFor={`st-${s.id}`}>{s.text}</label>
                      <button
                        type="button"
                        className="wos-btn wos-btn--ghost wos-btn--icon wos-btn--sm"
                        aria-label={`Eliminar paso: ${s.text}`}
                        onClick={() => {
                          deletePmbokSubtask(t.id, s.id);
                          reload();
                        }}
                      >
                        <IconClose size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <form
                  className="wos-inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newStep.trim()) return;
                    addPmbokSubtask(t.id, newStep);
                    setNewStep('');
                    reload();
                  }}
                >
                  <input placeholder="Agregar un paso" value={newStep} onChange={(e) => setNewStep(e.target.value)} aria-label="Nuevo paso" />
                  <button type="submit" className="wos-btn wos-btn--primary">
                    <IconPlus size={14} /> Agregar
                  </button>
                </form>
              </>
            )}

            {drawerTab === 'notas' && (
              <>
                <div className="wos-field">
                  <label htmlFor="d-notas">Notas técnicas</label>
                  <DraftField as="textarea" id="d-notas" rows={5} placeholder="Especificaciones de estampa, curva de talles, acuerdos con el cliente, enlaces..." value={t.notas_markdown || ''} onCommit={(v) => update(t, { notas_markdown: v })} />
                  <span className="wos-muted" style={{ fontSize: 12 }}>Se guarda al salir del campo. Compatible con Markdown.</span>
                </div>
                <div>
                  <h4 className="wos-section-title">Actividad ({comments.length})</h4>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                    {comments.length === 0 && <span className="wos-muted" style={{ fontSize: 13 }}>Todavía no hay comentarios.</span>}
                    {comments.map((c) => (
                      <div className="wos-comment" key={c.id}>
                        <small>
                          {c.autor} · {String(c.fecha || '').slice(0, 16).replace('T', ' ')}
                        </small>
                        {c.texto}
                      </div>
                    ))}
                  </div>
                  <form
                    className="wos-inline-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newComment.trim()) return;
                      addPmbokTaskComment(t.id, newComment);
                      setNewComment('');
                      reload();
                    }}
                  >
                    <input placeholder="Escribir un comentario" value={newComment} onChange={(e) => setNewComment(e.target.value)} aria-label="Nuevo comentario" />
                    <button type="submit" className="wos-btn">
                      Comentar
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>

          <div className="wos-drawer-foot">
            <button type="button" className="wos-btn wos-btn--danger wos-btn--sm" onClick={() => handleDelete(t)}>
              <IconTrash size={14} /> Eliminar
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="wos-btn wos-btn--sm"
                onClick={() => {
                  const d = duplicatePmbokTask(t.id);
                  reload();
                  notify(`Tarjeta clonada como ${d.id}.`);
                  openDrawer(d.id);
                }}
              >
                Clonar
              </button>
              <button type="button" className="wos-btn wos-btn--primary wos-btn--sm" onClick={() => setOpenTaskId(null)}>
                Listo
              </button>
            </div>
          </div>
        </aside>
      </>
    );
  };

  /* ==================================================================
     RENDER PRINCIPAL
  ================================================================== */
  return (
    <div className="gestion-module-container wos">
      {/* Encabezado compacto con una sola acción primaria */}
      <div className="wos-head gestion-section-header">
        <div>
          <div className="section-eyebrow">
            <span className="num">01</span>
            <span>Comando de gestión</span>
          </div>
          <h2 className="display section-title">
            {copy.title}
            <span className="dot">.</span>
          </h2>
          <p className="section-sub">{copy.sub}</p>
        </div>
        <div className="wos-head-actions">
          <button type="button" className="wos-btn wos-btn--primary" onClick={() => setShowNewTask(true)}>
            <IconPlus size={15} /> Nueva tarea
          </button>
          <div className="wos-menu" ref={menu === 'actions' ? menuRef : null}>
            <button type="button" className="wos-btn wos-btn--icon" aria-haspopup="menu" aria-expanded={menu === 'actions'} aria-label="Más acciones" onClick={() => setMenu(menu === 'actions' ? null : 'actions')}>
              <IconMore />
            </button>
            {menu === 'actions' && (
              <div className="wos-menu-panel" role="menu">
                <button type="button" role="menuitem" className="wos-menu-item" onClick={() => { setMenu(null); handleExport(); }}>
                  <b>
                    <IconDownload size={13} /> Exportar a Obsidian
                  </b>
                  <span>Descarga el tablero como Kanban (.md)</span>
                </button>
                <button type="button" role="menuitem" className="wos-menu-item" onClick={() => { setMenu(null); setShowNewKaizen(true); }}>
                  <b>
                    <IconSparkles size={13} /> Registrar mejora continua
                  </b>
                  <span>Abre un ciclo PDCA / Kaizen</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Captura rápida + temporizador */}
      <div className="wos-toolbar">
        <form className="wos-quick" onSubmit={handleQuickAdd} ref={helpRef}>
          <div className="wos-quick-field">
            <label className="wos-sr" htmlFor="wos-quick-input">
              Captura rápida de tarea
            </label>
            <input id="wos-quick-input" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Captura rápida: Cotizar 40 buzos para Globant #dtf !urgente ^mañana" />
            <div className="wos-quick-hint">
              <button type="button" className="wos-btn wos-btn--ghost wos-btn--sm" onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp} aria-label="Ayuda de captura rápida">
                Ayuda
              </button>
              <span className="wos-kbd">Enter</span>
            </div>
          </div>
          {showHelp && (
            <div className="wos-help-pop" role="note">
              <strong>Escribí en lenguaje natural y completá con atajos opcionales:</strong>
              <ul>
                <li><code>#etiqueta</code> agrega una etiqueta</li>
                <li><code>@persona</code> asigna responsable</li>
                <li><code>!urgente</code> · <code>!alta</code> · <code>!media</code> · <code>!baja</code> define prioridad</li>
                <li><code>^hoy</code> · <code>^mañana</code> · <code>^2026-12-01</code> define la fecha límite</li>
                <li><code>~3h</code> estima el esfuerzo</li>
              </ul>
              <div style={{ marginTop: 8 }}>El módulo vinculado se detecta por palabras clave (DTF, remito, seña, lead, lienzo, insumo).</div>
            </div>
          )}
        </form>

        <div className={`wos-timer ${timerOn ? 'is-running' : ''}`} role="group" aria-label="Temporizador Pomodoro">
          <span className="wos-timer-time" aria-live="off">{timerLabel}</span>
          <span className="wos-timer-task" title={timerTask ? timerTask.titulo : ''}>{timerTask ? timerTask.id : 'Sin tarea'}</span>
          <button type="button" className="wos-btn wos-btn--sm wos-btn--icon" aria-label={timerOn ? 'Pausar temporizador' : 'Iniciar temporizador'} onClick={() => setTimerOn((v) => !v)} disabled={!timerTask}>
            {timerOn ? <IconPause size={13} /> : <IconPlay size={13} />}
          </button>
          <button
            type="button"
            className="wos-btn wos-btn--sm wos-btn--ghost"
            disabled={!timerTask}
            title="Sumar 30 minutos trabajados a la tarea activa"
            onClick={() => {
              if (!timerTask) return;
              logPmbokTaskTime(timerTask.id, 0.5);
              reload();
              notify(`+30 min registrados en ${timerTask.id}.`);
            }}
          >
            +30 min
          </button>
        </div>
      </div>

      {/* Selector de vistas: 2 principales + el resto bajo "Más vistas" */}
      <div className="wos-viewbar">
        <div className="wos-seg" role="tablist" aria-label="Vistas principales">
          <button type="button" role="tab" aria-selected={view === 'dashboard'} onClick={() => setView('dashboard')}>
            Inicio
          </button>
          <button type="button" role="tab" aria-selected={view === 'kanban'} onClick={() => setView('kanban')}>
            Tablero <span className="wos-count">{tasks.length}</span>
          </button>
        </div>
        <div className="wos-menu" ref={menu === 'views' ? menuRef : null}>
          <button type="button" className={`wos-btn ${moreActive ? 'wos-btn--primary' : ''}`} aria-haspopup="menu" aria-expanded={menu === 'views'} onClick={() => setMenu(menu === 'views' ? null : 'views')}>
            {moreActive ? moreActive.label : 'Más vistas'} <IconChevronDown />
          </button>
          {menu === 'views' && (
            <div className="wos-menu-panel is-left" role="menu">
              {MORE_VIEWS.map((m) => (
                <button type="button" role="menuitem" key={m.id} className="wos-menu-item" aria-current={view === m.id} onClick={() => { setMenu(null); setView(m.id); }}>
                  <b>{m.label}</b>
                  <span>{m.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {view === 'dashboard' && renderDashboard()}
      {view === 'kanban' && renderKanban()}
      {view === 'mi_dia' && renderMiDia()}
      {view === 'tabla' && renderTabla()}
      {view === 'carga' && renderCarga()}
      {view === 'kaizen' && renderKaizen()}
      {view === 'automatizaciones' && renderAutomatizaciones()}

      {renderDrawer()}

      {/* Modal: iniciar flujo de trabajo */}
      {wfModal && (
        <div className="wos-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setWfModal(null)}>
          <form className="wos-modal wos" role="dialog" aria-modal="true" aria-label={`Iniciar ${wfModal.codigo}`} onSubmit={handleLaunchWorkflow}>
            <h3>{wfModal.nombre.replace(/\s*\(.*\)$/, '')}</h3>
            <p className="wos-modal-sub">{wfModal.subtitulo}</p>
            <div className="wos-fields">
              <div className="wos-field is-wide">
                <label htmlFor="wf-cli">Cliente, marca o lote (opcional)</label>
                <input id="wf-cli" autoFocus value={wfForm.cliente} onChange={(e) => setWfForm({ ...wfForm, cliente: e.target.value })} placeholder="Ej: Quilmes, 50 buzos" />
              </div>
              <div className="wos-field">
                <label htmlFor="wf-fecha">Fecha compromiso</label>
                <input id="wf-fecha" type="date" value={wfForm.fecha} onChange={(e) => setWfForm({ ...wfForm, fecha: e.target.value })} />
              </div>
              <div className="wos-field">
                <label htmlFor="wf-resp">Responsable (opcional)</label>
                <input id="wf-resp" value={wfForm.responsable} onChange={(e) => setWfForm({ ...wfForm, responsable: e.target.value })} placeholder={operador} />
              </div>
            </div>
            <div className="wos-label" style={{ marginTop: 14 }}>Se crearán estos {wfModal.subtasks.length} pasos:</div>
            <ol className="wos-steps-preview">
              {wfModal.subtasks.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="wos-modal-actions">
              <button type="button" className="wos-btn" onClick={() => setWfModal(null)}>
                Cancelar
              </button>
              <button type="submit" className="wos-btn wos-btn--primary">
                Iniciar flujo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: nueva tarea */}
      {showNewTask && (
        <div className="wos-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowNewTask(false)}>
          <form className="wos-modal wos" role="dialog" aria-modal="true" aria-label="Nueva tarea" onSubmit={handleCreateTask}>
            <h3>Nueva tarea</h3>
            <p className="wos-modal-sub">Lo esencial primero; el resto se puede completar después en el detalle.</p>
            <div className="wos-fields">
              <div className="wos-field is-wide">
                <label htmlFor="nt-titulo">Título</label>
                <input id="nt-titulo" autoFocus required value={taskForm.titulo} onChange={(e) => setTaskForm({ ...taskForm, titulo: e.target.value })} placeholder="Ej: Lanzar catálogo corporativo de invierno" />
              </div>
              <div className="wos-field">
                <label htmlFor="nt-fase">Estado inicial</label>
                <select id="nt-fase" value={taskForm.grupo_procesos} onChange={(e) => setTaskForm({ ...taskForm, grupo_procesos: e.target.value })}>
                  {PMBOK_PROCESS_GROUPS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {PHASE_UI[g.id].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="wos-field">
                <label htmlFor="nt-prio">Prioridad</label>
                <select id="nt-prio" value={taskForm.prioridad} onChange={(e) => setTaskForm({ ...taskForm, prioridad: e.target.value })}>
                  {Object.entries(PRIO).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="wos-field">
                <label htmlFor="nt-fecha">Fecha límite</label>
                <input id="nt-fecha" type="date" value={taskForm.fecha_vencimiento} onChange={(e) => setTaskForm({ ...taskForm, fecha_vencimiento: e.target.value })} />
              </div>
              <div className="wos-field">
                <label htmlFor="nt-resp">Responsable</label>
                <input id="nt-resp" value={taskForm.responsable} onChange={(e) => setTaskForm({ ...taskForm, responsable: e.target.value })} placeholder={operador} />
              </div>
              <div className="wos-field is-wide">
                <label htmlFor="nt-mod">Módulo vinculado</label>
                <select id="nt-mod" value={taskForm.modulo_vinculado} onChange={(e) => setTaskForm({ ...taskForm, modulo_vinculado: e.target.value })}>
                  {Object.entries(MODULE_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>Opciones avanzadas (EDT, área, aprobación, etiquetas)</summary>
              <div className="wos-fields" style={{ marginTop: 12 }}>
                <div className="wos-field">
                  <label htmlFor="nt-wbs">Código EDT / WBS</label>
                  <input id="nt-wbs" value={taskForm.wbs_code} onChange={(e) => setTaskForm({ ...taskForm, wbs_code: e.target.value })} placeholder="Automático" />
                </div>
                <div className="wos-field">
                  <label htmlFor="nt-est">Horas estimadas</label>
                  <input id="nt-est" type="number" min="0" step="0.5" value={taskForm.esfuerzo_estimado_hs} onChange={(e) => setTaskForm({ ...taskForm, esfuerzo_estimado_hs: Number(e.target.value) })} />
                </div>
                <div className="wos-field">
                  <label htmlFor="nt-area">Área de conocimiento</label>
                  <select id="nt-area" value={taskForm.area_conocimiento} onChange={(e) => setTaskForm({ ...taskForm, area_conocimiento: e.target.value })}>
                    {PMBOK_KNOWLEDGE_AREAS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label.replace(/^\d+\.\s*/, '')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="wos-field">
                  <label htmlFor="nt-hitl">Nivel de aprobación</label>
                  <select id="nt-hitl" value={taskForm.hitl} onChange={(e) => setTaskForm({ ...taskForm, hitl: e.target.value })}>
                    <option value="HITL-0">HITL-0 · Interno</option>
                    <option value="HITL-1">HITL-1 · Operativo</option>
                    <option value="HITL-2">HITL-2 · Publicación o envío</option>
                    <option value="HITL-3">HITL-3 · Precios o estrategia</option>
                  </select>
                </div>
                <div className="wos-field is-wide">
                  <label htmlFor="nt-tags">Etiquetas (separadas por coma)</label>
                  <input id="nt-tags" value={taskForm.etiquetas_str} onChange={(e) => setTaskForm({ ...taskForm, etiquetas_str: e.target.value })} placeholder="B2B, Producción" />
                </div>
                <div className="wos-field is-wide">
                  <label htmlFor="nt-step">Primer paso</label>
                  <input id="nt-step" value={taskForm.primera_subtarea} onChange={(e) => setTaskForm({ ...taskForm, primera_subtarea: e.target.value })} placeholder="Ej: Relevar muestras en taller" />
                </div>
              </div>
            </details>
            <div className="wos-modal-actions">
              <button type="button" className="wos-btn" onClick={() => setShowNewTask(false)}>
                Cancelar
              </button>
              <button type="submit" className="wos-btn wos-btn--primary">
                Crear tarea
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: mejora continua */}
      {showNewKaizen && (
        <div className="wos-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowNewKaizen(false)}>
          <form className="wos-modal wos" role="dialog" aria-modal="true" aria-label="Registrar mejora continua" onSubmit={handleCreateKaizen}>
            <h3>Registrar mejora continua</h3>
            <p className="wos-modal-sub">Describí el problema, la hipótesis y cómo se va a medir. Arranca en la etapa Planificar.</p>
            <div className="wos-fields">
              <div className="wos-field is-wide">
                <label htmlFor="kz-titulo">Título</label>
                <input id="kz-titulo" autoFocus required value={kaizenForm.titulo} onChange={(e) => setKaizenForm({ ...kaizenForm, titulo: e.target.value })} placeholder="Ej: Alerta automática de bobina DTF a proveedores" />
              </div>
              <div className="wos-field is-wide">
                <label htmlFor="kz-prob">Problema o fricción actual</label>
                <textarea id="kz-prob" rows={2} required value={kaizenForm.problema_detectado} onChange={(e) => setKaizenForm({ ...kaizenForm, problema_detectado: e.target.value })} />
              </div>
              <div className="wos-field is-wide">
                <label htmlFor="kz-hip">Hipótesis de mejora</label>
                <textarea id="kz-hip" rows={2} required value={kaizenForm.hipotesis_mejora} onChange={(e) => setKaizenForm({ ...kaizenForm, hipotesis_mejora: e.target.value })} />
              </div>
              <div className="wos-field is-wide">
                <label htmlFor="kz-kpi">KPI medible</label>
                <input id="kz-kpi" required value={kaizenForm.kpi_impacto} onChange={(e) => setKaizenForm({ ...kaizenForm, kpi_impacto: e.target.value })} placeholder="Ej: de 15 min a 1 clic en la reposición de film" />
              </div>
            </div>
            <div className="wos-modal-actions">
              <button type="button" className="wos-btn" onClick={() => setShowNewKaizen(false)}>
                Cancelar
              </button>
              <button type="submit" className="wos-btn wos-btn--primary">
                Iniciar ciclo
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="wos-toast-zone" role="status" aria-live="polite">
        {toast && (
          <div className={`wos-toast ${toast.type === 'error' ? 'is-error' : ''}`} key={toast.id}>
            <span>{toast.msg}</span>
            <button type="button" aria-label="Cerrar aviso" onClick={() => setToast(null)}>
              &times;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


