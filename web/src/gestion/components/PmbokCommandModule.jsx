import { useState, useMemo } from 'react';
import {
  PMBOK_PROCESS_GROUPS,
  PMBOK_KNOWLEDGE_AREAS,
  SUITES_DOMINIO,
  getPmbokTasks,
  savePmbokTask,
  movePmbokTaskPhase,
  togglePmbokSubtask,
  addPmbokSubtask,
  deletePmbokTask,
  exportPmbokBoardToObsidianMarkdown,
  getKaizenCycles,
  saveKaizenCycle,
  advanceKaizenStage,
  getApprovals,
} from '../services/storageService';
import {
  IconCheck,
  IconPlus,
  IconTrash,
  IconLayers,
  IconSparkles,
  IconChart,
  IconShield,
} from './Icons';

export default function PmbokCommandModule({ onNavigateTab, onDataChanged }) {
  const [tasks, setTasks] = useState(() => getPmbokTasks());
  const [kaizenList, setKaizenList] = useState(() => getKaizenCycles());
  const [approvals] = useState(() => getApprovals());

  // Sub-vistas: 'kanban_gtasks' | 'pdca_kaizen' | 'suites_map'
  const [activeView, setActiveView] = useState('kanban_gtasks');
  const [selectedTaskId, setSelectedTaskId] = useState('TSK-012');
  const [filterKnowledge, setFilterKnowledge] = useState('ALL');
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [notice, setNotice] = useState(null);

  // Modal de Nueva Tarea WBS / PMBOK
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    wbs_code: '2.3.1',
    titulo: '',
    grupo_procesos: 'PLANIFICACION',
    area_conocimiento: 'ALCANCE',
    prioridad: 'ALTA',
    fecha_vencimiento: new Date().toISOString().slice(0, 10),
    esfuerzo_estimado_hs: 4,
    riesgo_asociado: 'NINGUNO',
    hitl: 'HITL-2',
    responsable: 'Owner Humano',
    primera_subtarea: '',
  });

  // Modal de Nuevo Ciclo de Mejora Continua PDCA (Kaizen)
  const [showNewKaizenModal, setShowNewKaizenModal] = useState(false);
  const [kaizenForm, setKaizenForm] = useState({
    titulo: '',
    etapa_pdca: 'PLAN',
    wbs_ref: '5.3.1',
    problema_detectado: '',
    hipotesis_mejora: '',
    kpi_impacto: '',
    leccion_aprendida: '',
  });

  const showNotice = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const reloadAll = () => {
    setTasks(getPmbokTasks());
    setKaizenList(getKaizenCycles());
    if (onDataChanged) onDataChanged();
  };

  const filteredTasks = useMemo(() => {
    if (filterKnowledge === 'ALL') return tasks;
    return tasks.filter((t) => t.area_conocimiento === filterKnowledge);
  }, [tasks, filterKnowledge]);

  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || tasks[0] || null;
  }, [tasks, selectedTaskId]);

  // Métricas PMBOK & Flujo Kanban
  const wipCount = useMemo(
    () => tasks.filter((t) => t.grupo_procesos === 'EJECUCION').length,
    [tasks]
  );
  const closedCount = useMemo(
    () => tasks.filter((t) => t.grupo_procesos === 'CIERRE').length,
    [tasks]
  );
  const totalSubtasks = useMemo(
    () => tasks.reduce((acc, t) => acc + (t.subtasks?.length || 0), 0),
    [tasks]
  );
  const completedSubtasks = useMemo(
    () =>
      tasks.reduce(
        (acc, t) => acc + (t.subtasks || []).filter((s) => s.done).length,
        0
      ),
    [tasks]
  );
  const pendingHitlCount = useMemo(
    () => approvals.filter((a) => a.estado === 'PENDING').length,
    [approvals]
  );

  // Handlers de Google Tasks & Kanban PMBOK
  const handleToggleSubtask = (taskId, subtaskId) => {
    togglePmbokSubtask(taskId, subtaskId);
    reloadAll();
  };

  const handleAddSubtask = (e) => {
    e.preventDefault();
    if (!selectedTask || !newSubtaskText.trim()) return;
    addPmbokSubtask(selectedTask.id, newSubtaskText.trim());
    setNewSubtaskText('');
    reloadAll();
    showNotice(`Subtarea Google Tasks agregada a ${selectedTask.id}.`);
  };

  const handleMovePhase = (taskId, newGroup) => {
    if (newGroup === 'EJECUCION' && wipCount >= 3) {
      const target = tasks.find((t) => t.id === taskId);
      if (target && target.grupo_procesos !== 'EJECUCION') {
        if (!window.confirm('El límite Kanban WIP recomendado es de 3 paquetes en Ejecución simultánea. ¿Deseás moverlo igualmente?')) {
          return;
        }
      }
    }
    movePmbokTaskPhase(taskId, newGroup);
    reloadAll();
    showNotice(`Paquete ${taskId} movido a fase PMBOK: ${newGroup}.`);
  };

  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!taskForm.titulo.trim()) return;
    const subtasks = [
      {
        id: `st-${Date.now()}-1`,
        text: taskForm.primera_subtarea.trim() || 'Verificar inputs canónicos sin inventar datos (Regla #1)',
        done: false,
      },
      {
        id: `st-${Date.now()}-2`,
        text: 'Validar entregable con X-03 Content QA y X-04 Brand Guardian',
        done: false,
      },
    ];
    const created = savePmbokTask({
      ...taskForm,
      subtasks,
    });
    setShowNewTaskModal(false);
    setTaskForm({
      ...taskForm,
      titulo: '',
      primera_subtarea: '',
    });
    setSelectedTaskId(created.id);
    reloadAll();
    showNotice(`Paquete de trabajo ${created.id} (WBS ${created.wbs_code}) creado en el tablero PMBOK.`);
  };

  const handleDeleteTask = (taskId) => {
    if (!window.confirm(`¿Eliminar el paquete de trabajo ${taskId}?`)) return;
    deletePmbokTask(taskId);
    reloadAll();
  };

  const handleExportObsidianKanban = () => {
    const md = exportPmbokBoardToObsidianMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Tablero Kanban y Google Tasks (PMBOK).md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotice('Tablero exportado en formato nativo Obsidian Kanban (.md).');
  };

  // Handlers de Mejora Continua PDCA (Kaizen)
  const handleCreateKaizen = (e) => {
    e.preventDefault();
    if (!kaizenForm.titulo.trim()) return;
    const saved = saveKaizenCycle(kaizenForm);
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
    showNotice(`Iniciativa de Mejora Continua ${saved.codigo} registrada en etapa PLAN.`);
  };

  const handleAdvanceKaizen = (cycle, nextStage) => {
    let learning = cycle.leccion_aprendida;
    if (nextStage === 'ACT') {
      const inputLearning = window.prompt(
        'Para estandarizar en fase ACT (Cierre PMBOK), ingresá la Lección Aprendida (LEARNING):',
        cycle.leccion_aprendida || 'Estándar verificado e incorporado a la operación.'
      );
      if (inputLearning === null) return;
      learning = inputLearning;
    }
    advanceKaizenStage(cycle.id, nextStage, learning);
    reloadAll();
    showNotice(`Ciclo ${cycle.codigo} avanzado a etapa PDCA: ${nextStage}.`);
  };

  return (
    <div className="gestion-module">
      {/* Encabezado Editorial Canónico AIRO */}
      <div className="gestion-module-header">
        <div>
          <div className="section-eyebrow">
            <span className="num">01</span> Gobernanza PMBOK · Kanban · Google Tasks · Mejora Continua
          </div>
          <h2 className="display section-title">Comando PMBOK y mejora continua.</h2>
          <p className="section-sub">
            Seguimiento integral de paquetes de trabajo (EDT/WBS) a través de los 5 Grupos de Procesos y 10 Áreas de Conocimiento del PMBOK, con listas de acción rápida estilo Google Tasks y ciclo PDCA (Kaizen).
          </p>
        </div>

        <div className="gestion-header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className={`g-btn ${activeView === 'kanban_gtasks' ? 'g-btn-primary' : 'g-btn-outline'}`}
            onClick={() => setActiveView('kanban_gtasks')}
          >
            <IconLayers size={15} /> Tablero Kanban & Google Tasks
          </button>
          <button
            className={`g-btn ${activeView === 'pdca_kaizen' ? 'g-btn-primary' : 'g-btn-outline'}`}
            onClick={() => setActiveView('pdca_kaizen')}
          >
            <IconChart size={15} /> Mejora Continua (PDCA / Kaizen)
          </button>
          <button
            className={`g-btn ${activeView === 'suites_map' ? 'g-btn-primary' : 'g-btn-outline'}`}
            onClick={() => setActiveView('suites_map')}
          >
            <IconSparkles size={15} /> Mapa de las 5 Suites Desacopladas
          </button>
          <button className="g-btn g-btn-outline" onClick={handleExportObsidianKanban}>
            Exportar .md a Obsidian
          </button>
        </div>
      </div>

      {/* KPIs Ejecutivos PMBOK & Mejora Continua */}
      <div className="gestion-kpis">
        <div className="gestion-kpi-card">
          <div className="gestion-kpi-label">Paquetes EDT / WBS Activos</div>
          <div className="gestion-kpi-val">{tasks.length}</div>
          <div className="gestion-kpi-sub">
            {closedCount} en fase Cierre · {wipCount} en Ejecución (Límite WIP 3)
          </div>
        </div>
        <div className="gestion-kpi-card kpi-accent">
          <div className="gestion-kpi-label">Checklists Google Tasks</div>
          <div className="gestion-kpi-val">
            {completedSubtasks} / {totalSubtasks}
          </div>
          <div className="gestion-kpi-sub">
            {totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0}% de subtareas operativas completadas
          </div>
        </div>
        <div className="gestion-kpi-card kpi-success">
          <div className="gestion-kpi-label">Ciclos de Mejora PDCA (Kaizen)</div>
          <div className="gestion-kpi-val">{kaizenList.length}</div>
          <div className="gestion-kpi-sub">
            {kaizenList.filter((k) => k.etapa_pdca === 'ACT').length} estandarizados en producción (ACT)
          </div>
        </div>
        <div className={`gestion-kpi-card ${pendingHitlCount > 0 ? 'kpi-warning' : 'kpi-success'}`}>
          <div className="gestion-kpi-label">Puertas HITL Pendientes</div>
          <div className="gestion-kpi-val">{pendingHitlCount}</div>
          <div className="gestion-kpi-sub">
            {pendingHitlCount > 0 ? 'Decisiones humanas requeridas en cola' : 'Sin bloqueos de firma humana'}
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

      {/* ============================================================
          VISTA 1: TABLERO KANBAN PMBOK (5 COLUMNAS) + PANEL GOOGLE TASKS
          ============================================================ */}
      {activeView === 'kanban_gtasks' && (
        <div>
          {/* Barra de filtro por las 10 Áreas de Conocimiento PMBOK + Botón Nuevo Paquete WBS */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: '1rem',
              background: '#fff',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--g-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Filtrar por Área de Conocimiento (PMBOK):
              </span>
              <select
                value={filterKnowledge}
                onChange={(e) => setFilterKnowledge(e.target.value)}
                style={{ fontSize: '0.82rem', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--g-border)' }}
              >
                <option value="ALL">Todas las Áreas de Conocimiento (10 Áreas PMBOK)</option>
                {PMBOK_KNOWLEDGE_AREAS.map((ka) => (
                  <option key={ka.id} value={ka.id}>
                    {ka.label} (WBS {ka.wbsPrefix})
                  </option>
                ))}
              </select>
            </div>

            <button
              className="g-btn g-btn-primary"
              onClick={() => setShowNewTaskModal(true)}
            >
              <IconPlus size={14} /> Nuevo Paquete WBS / Google Task
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2.15fr) minmax(320px, 0.95fr)',
              gap: '1.25rem',
              alignItems: 'start',
            }}
          >
            {/* Tablero Kanban de 5 Columnas (5 Grupos de Procesos PMBOK) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, minmax(215px, 1fr))',
                gap: '0.75rem',
                overflowX: 'auto',
                paddingBottom: '0.5rem',
              }}
            >
              {PMBOK_PROCESS_GROUPS.map((grp) => {
                const colTasks = filteredTasks.filter((t) => t.grupo_procesos === grp.id);
                return (
                  <div
                    key={grp.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--g-border)',
                      borderRadius: '10px',
                      padding: '0.75rem',
                      minHeight: '480px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                    }}
                  >
                    <div
                      style={{
                        borderBottom: `2px solid ${grp.color}`,
                        paddingBottom: '0.5rem',
                        marginBottom: '0.2rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: grp.color,
                          }}
                        >
                          FASE {grp.num}
                        </span>
                        <span className="g-badge g-badge-neutral">{colTasks.length}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a', marginTop: 2 }}>
                        {grp.label}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{grp.desc}</div>
                    </div>

                    {colTasks.map((t) => {
                      const isSelected = selectedTask?.id === t.id;
                      const doneSt = (t.subtasks || []).filter((s) => s.done).length;
                      const totalSt = (t.subtasks || []).length;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTaskId(t.id)}
                          style={{
                            background: '#ffffff',
                            border: isSelected ? '2px solid #1a4295' : '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '0.7rem',
                            cursor: 'pointer',
                            boxShadow: isSelected ? '0 4px 12px rgba(26, 66, 149, 0.14)' : 'var(--g-shadow-sm)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: 'rgba(26, 66, 149, 0.1)',
                                color: '#1a4295',
                                padding: '2px 6px',
                                borderRadius: 4,
                              }}
                            >
                              WBS {t.wbs_code} · {t.id}
                            </span>
                            <span
                              style={{
                                fontSize: '0.66rem',
                                fontWeight: 700,
                                color: t.prioridad === 'ALTA' ? '#b45309' : '#475569',
                              }}
                            >
                              {t.hitl}
                            </span>
                          </div>

                          <div style={{ fontWeight: 700, fontSize: '0.81rem', color: '#0f172a', lineHeight: 1.35, marginBottom: 6 }}>
                            {t.titulo}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#64748b', marginBottom: 6 }}>
                            <span>Área: <strong>{t.area_conocimiento}</strong></span>
                            <span>Vence: {t.fecha_vencimiento}</span>
                          </div>

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

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#334155' }}>
                            <span>
                              Subtareas: <strong>{doneSt}/{totalSt}</strong>
                            </span>
                            <span style={{ fontWeight: 700 }}>{t.progreso_pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Panel Derecho: Inspector Estilo Google Tasks + Control PMBOK del Paquete Seleccionado */}
            {selectedTask && (
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--g-border)',
                  borderRadius: '10px',
                  padding: '1.2rem',
                  boxShadow: 'var(--g-shadow-sm)',
                  position: 'sticky',
                  top: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: '0.6rem' }}>
                  <div>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        color: '#007799',
                        background: 'rgba(0, 180, 216, 0.14)',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      EDT / WBS {selectedTask.wbs_code} · {selectedTask.id}
                    </span>
                    <h4 style={{ margin: '0.45rem 0 0.2rem', fontSize: '0.96rem', color: '#0f172a' }}>
                      {selectedTask.titulo}
                    </h4>
                  </div>
                  <button
                    className="g-btn g-btn-outline"
                    style={{ padding: '4px 7px', color: '#b91c1c' }}
                    onClick={() => handleDeleteTask(selectedTask.id)}
                    title="Eliminar tarea"
                  >
                    <IconTrash size={13} />
                  </button>
                </div>

                {/* Selector de Fase PMBOK (Mover entre columnas Kanban) */}
                <div className="g-form-group" style={{ marginBottom: '0.85rem' }}>
                  <label style={{ fontSize: '0.75rem' }}>Mover a Grupo de Procesos (Columna Kanban PMBOK):</label>
                  <select
                    value={selectedTask.grupo_procesos}
                    onChange={(e) => handleMovePhase(selectedTask.id, e.target.value)}
                  >
                    {PMBOK_PROCESS_GROUPS.map((g) => (
                      <option key={g.id} value={g.id}>
                        Fase {g.num} — {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Metadatos PMBOK del paquete */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    background: '#f8fafc',
                    padding: '0.7rem',
                    borderRadius: '6px',
                    border: '1px solid var(--g-border)',
                    fontSize: '0.76rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div>
                    <strong>Área PMBOK:</strong> {selectedTask.area_conocimiento}
                  </div>
                  <div>
                    <strong>Gate HITL:</strong> {selectedTask.hitl}
                  </div>
                  <div>
                    <strong>Vencimiento:</strong> {selectedTask.fecha_vencimiento}
                  </div>
                  <div>
                    <strong>Esfuerzo Est.:</strong> {selectedTask.esfuerzo_estimado_hs || 4} h
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Riesgo / RAID:</strong> {selectedTask.riesgo_asociado || 'NINGUNO'}
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Responsable:</strong> {selectedTask.responsable} ({selectedTask.agente})
                  </div>
                </div>

                {/* Lista de Subtareas Estilo Google Tasks */}
                <div style={{ marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.82rem', color: 'var(--g-blue)' }}>
                      Checklist Google Tasks ({(selectedTask.subtasks || []).filter((s) => s.done).length}/{(selectedTask.subtasks || []).length})
                    </strong>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}>
                      {selectedTask.progreso_pct}% completado
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {(selectedTask.subtasks || []).map((st) => (
                      <label
                        key={st.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          padding: '0.5rem 0.65rem',
                          borderRadius: '6px',
                          background: st.done ? '#f0fdf4' : '#f8fafc',
                          border: `1px solid ${st.done ? '#bbf7d0' : '#e2e8f0'}`,
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          color: st.done ? '#166534' : '#1e293b',
                          textDecoration: st.done ? 'line-through' : 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!st.done}
                          onChange={() => handleToggleSubtask(selectedTask.id, st.id)}
                          style={{ marginTop: 3 }}
                        />
                        <span>{st.text}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Input rápido estilo Google Tasks para sumar subtarea */}
                <form onSubmit={handleAddSubtask} style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Agregar subtarea rápida (Google Tasks)..."
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    style={{ flex: 1, fontSize: '0.8rem', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--g-border)' }}
                  />
                  <button type="submit" className="g-btn g-btn-primary" style={{ padding: '6px 12px' }}>
                    <IconPlus size={14} />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          VISTA 2: PROCESO DE MEJORA CONTINUA (CICLO PDCA / KAIZEN)
          ============================================================ */}
      {activeView === 'pdca_kaizen' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: '1rem',
              background: '#fff',
              padding: '1rem 1.25rem',
              borderRadius: '10px',
              border: '1px solid var(--g-border)',
            }}
          >
            <div>
              <h4 style={{ margin: 0, color: 'var(--g-blue)' }}>
                Motor Institucional de Mejora Continua AIRO (Ciclo Deming PDCA + Kaizen + X-06)
              </h4>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Cada fricción detectada o hipótesis de optimización recorre las 4 fases: <strong>PLAN</strong> (Diagnóstico y WBS) → <strong>DO</strong> (Desarrollo en entorno local) → <strong>CHECK</strong> (Tests + QA X-03/X-04 + Gate HITL) → <strong>ACT</strong> (Estandarización en Producción + Lección Aprendida en Obsidian).
              </p>
            </div>
            <button className="g-btn g-btn-primary" onClick={() => setShowNewKaizenModal(true)}>
              <IconPlus size={14} /> Registrar Iniciativa PDCA / Kaizen
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(240px, 1fr))',
              gap: '1rem',
            }}
          >
            {[
              { id: 'PLAN', title: '1. PLAN (Identificar & Planificar)', sub: 'Detectar cuello de botella, definir WBS y KPI base', color: '#475569', next: 'DO' },
              { id: 'DO', title: '2. DO (Ejecutar en Local)', sub: 'Prototipar con bajo acoplamiento sin tocar producción', color: '#0284c7', next: 'CHECK' },
              { id: 'CHECK', title: '3. CHECK (QA + Tests + HITL)', sub: 'Validar X-03/X-04, tests unitarios y firma humana', color: '#b45309', next: 'ACT' },
              { id: 'ACT', title: '4. ACT (Estandarizar & Aprender)', sub: 'Desplegado en producción y documentado en Obsidian', color: '#15803d', next: null },
            ].map((stage) => {
              const items = kaizenList.filter((k) => k.etapa_pdca === stage.id);
              return (
                <div
                  key={stage.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--g-border)',
                    borderRadius: '10px',
                    padding: '0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ borderBottom: `2px solid ${stage.color}`, paddingBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.85rem', color: stage.color }}>{stage.title}</strong>
                      <span className="g-badge g-badge-neutral">{items.length}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>{stage.sub}</div>
                  </div>

                  {items.map((k) => (
                    <div
                      key={k.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '0.85rem',
                        boxShadow: 'var(--g-shadow-sm)',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1a4295', fontSize: '0.72rem' }}>
                          {k.codigo} · WBS {k.wbs_ref}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#64748b' }}>
                          {k.audit_ref}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{k.titulo}</div>
                      <div style={{ color: '#475569', fontSize: '0.76rem', marginBottom: 6 }}>
                        <strong>Problema:</strong> {k.problema_detectado}
                      </div>
                      <div style={{ color: '#0f172a', fontSize: '0.76rem', marginBottom: 6 }}>
                        <strong>Hipótesis / Solución:</strong> {k.hipotesis_mejora}
                      </div>
                      <div style={{ color: '#0e7490', fontSize: '0.75rem', marginBottom: 6 }}>
                        <strong>KPI Verificado:</strong> {k.kpi_impacto}
                      </div>
                      {k.leccion_aprendida && (
                        <div
                          style={{
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            padding: '0.45rem 0.6rem',
                            borderRadius: 6,
                            fontSize: '0.73rem',
                            color: '#166534',
                            marginBottom: stage.next ? 8 : 0,
                          }}
                        >
                          <strong>LEARNING:</strong> {k.leccion_aprendida}
                        </div>
                      )}
                      {stage.next && (
                        <button
                          className="g-btn g-btn-outline"
                          style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem', padding: '5px 8px' }}
                          onClick={() => handleAdvanceKaizen(k, stage.next)}
                        >
                          Avanzar a Etapa {stage.next} →
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

      {/* ============================================================
          VISTA 3: MAPA DE LAS 5 SUITES DESACOPLADAS (REINGENIERÍA BPR)
          ============================================================ */}
      {activeView === 'suites_map' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.1rem',
          }}
        >
          {SUITES_DOMINIO.map((suite) => (
            <div
              key={suite.id}
              style={{
                background: '#ffffff',
                border: '1px solid var(--g-border)',
                borderTop: `4px solid ${suite.color}`,
                borderRadius: '10px',
                padding: '1.25rem',
                boxShadow: 'var(--g-shadow-sm)',
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: suite.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                SUITE {suite.num} · DOMINIO COHESIVO
              </div>
              <h4 style={{ margin: '0.25rem 0', fontSize: '1.05rem', color: '#0f172a' }}>{suite.nombre}</h4>
              <p style={{ margin: '0 0 0.9rem', fontSize: '0.8rem', color: '#64748b' }}>{suite.subtitulo}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {suite.modulos.map((mod) => (
                  <button
                    key={mod.id}
                    className="g-btn g-btn-outline"
                    style={{ justifyContent: 'space-between', width: '100%', textAlign: 'left' }}
                    onClick={() => onNavigateTab && onNavigateTab(mod.id)}
                  >
                    <span>{mod.label}</span>
                    <span style={{ fontSize: '0.72rem', color: suite.color, fontWeight: 700 }}>Abrir →</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal para Crear Nuevo Paquete de Trabajo WBS / Google Task */}
      {showNewTaskModal && (
        <div className="g-modal-backdrop" onClick={() => setShowNewTaskModal(false)}>
          <div className="g-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
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
                  <label>Fecha Límite (Google Tasks)</label>
                  <input
                    type="date"
                    value={taskForm.fecha_vencimiento}
                    onChange={(e) => setTaskForm({ ...taskForm, fecha_vencimiento: e.target.value })}
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
