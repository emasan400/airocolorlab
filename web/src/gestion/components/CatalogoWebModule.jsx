import { useEffect, useState, useMemo } from 'react';
import {
  getTodosProductos,
  saveDraft,
  clearDraft,
  hasDraft,
  exportDraft,
} from '../../lib/catalog.js';
import { supabase, supabaseEnabled } from '../../lib/supabase.js';
import {
  fetchProductosDb,
  saveProductoDb,
  deleteProductoDb,
  setActivoDb,
} from '../../lib/db.js';
import { logAudit, getOperadorActual } from '../services/storageService.js';
import { IconStore, IconEye, IconTrash, IconEdit, IconPlus, IconCheck } from './Icons.jsx';

const EMPTY_PRODUCTO = {
  id_producto: '',
  categoria: 'merchandising',
  badge: '',
  nombre: '',
  descripcion: '',
  precio: '',
  cantidad: '',
  imagen_principal: '',
  galeria: '',
  colores: '',
  especificaciones: '',
  activo: true,
};

const toForm = (p) => ({
  ...p,
  precio: p.precio ?? '',
  cantidad: p.cantidad ?? '',
  imagen_principal: p.imagen_principal ?? '',
  galeria: Array.isArray(p.galeria) ? p.galeria.join(', ') : (p.galeria || ''),
  colores: Array.isArray(p.colores) ? p.colores.join(', ') : (p.colores || ''),
  especificaciones: Array.isArray(p.especificaciones) ? p.especificaciones.join(', ') : (p.especificaciones || ''),
});

const fromForm = (f) => ({
  ...f,
  precio: f.precio === '' || f.precio === null ? null : Number(f.precio),
  cantidad: f.cantidad === '' || f.cantidad === null ? null : Number(f.cantidad),
  imagen_principal: f.imagen_principal ? f.imagen_principal.trim() : null,
  galeria: typeof f.galeria === 'string' ? f.galeria.split(',').map((s) => s.trim()).filter(Boolean) : (f.galeria || []),
  colores: typeof f.colores === 'string' ? f.colores.split(',').map((s) => s.trim()).filter(Boolean) : (f.colores || []),
  especificaciones: typeof f.especificaciones === 'string' ? f.especificaciones.split(',').map((s) => s.trim()).filter(Boolean) : (f.especificaciones || []),
  activo: !!f.activo,
});

export default function CatalogoWebModule({ onContentChanged }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDbMode, setIsDbMode] = useState(supabaseEnabled);
  const [filterCat, setFilterCat] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActivo, setFilterActivo] = useState('ALL');

  // Modal / Edición
  const [editingId, setEditingId] = useState(null); // null | '__new__' | string (id_producto)
  const [form, setForm] = useState(EMPTY_PRODUCTO);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      if (supabaseEnabled) {
        const list = await fetchProductosDb();
        if (list && list.length > 0) {
          setProductos(list);
          setIsDbMode(true);
          setLoading(false);
          return;
        }
      }
      // Fallback a catálogo local / draft
      const localList = getTodosProductos();
      setProductos(localList);
      setIsDbMode(false);
    } catch (e) {
      console.warn('Error cargando catálogo desde BD, usando local:', e);
      const localList = getTodosProductos();
      setProductos(localList);
      setIsDbMode(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProductos = useMemo(() => {
    return productos.filter((p) => {
      const matchCat = filterCat === 'ALL' || p.categoria === filterCat;
      const matchActivo =
        filterActivo === 'ALL' ||
        (filterActivo === 'ACTIVO' && p.activo) ||
        (filterActivo === 'OCULTO' && !p.activo);
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        (p.nombre && p.nombre.toLowerCase().includes(q)) ||
        (p.id_producto && p.id_producto.toLowerCase().includes(q)) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(q));
      return matchCat && matchActivo && matchSearch;
    });
  }, [productos, filterCat, filterActivo, searchTerm]);

  const startNew = () => {
    setEditingId('__new__');
    setForm(EMPTY_PRODUCTO);
    setStatusMsg(null);
  };

  const startEdit = (p) => {
    setEditingId(p.id_producto);
    setForm(toForm(p));
    setStatusMsg(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_PRODUCTO);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.id_producto.trim() || !form.nombre.trim()) {
      setStatusMsg({ type: 'error', text: 'El ID y el nombre son obligatorios.' });
      return;
    }

    if (
      editingId === '__new__' &&
      productos.some((p) => p.id_producto.toLowerCase() === form.id_producto.trim().toLowerCase())
    ) {
      setStatusMsg({ type: 'error', text: `Ya existe un producto con el ID "${form.id_producto.trim()}".` });
      return;
    }

    setSaving(true);
    setStatusMsg(null);
    const parsed = fromForm(form);
    const op = getOperadorActual();

    try {
      if (isDbMode) {
        await saveProductoDb(parsed);
      } else {
        // En modo draft guardamos en el almacenamiento del catálogo
        const nextList = [...productos];
        const existingIdx = nextList.findIndex((x) => x.id_producto === parsed.id_producto);
        if (existingIdx >= 0) {
          nextList[existingIdx] = parsed;
        } else {
          nextList.push(parsed);
        }
        saveDraft(nextList);
      }

      logAudit(
        op,
        editingId === '__new__' ? 'CATALOG_PRODUCT_CREATED' : 'CATALOG_PRODUCT_UPDATED',
        'CATALOG_WEB',
        `Producto de tienda web ${editingId === '__new__' ? 'creado' : 'modificado'}: "${parsed.nombre}" (${parsed.id_producto})`,
        'SUCCESS'
      );

      await loadData();
      cancelEdit();
      setStatusMsg({
        type: 'success',
        text: `Producto "${parsed.nombre}" guardado correctamente en el catálogo público.`,
      });
      if (onContentChanged) onContentChanged();
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Error al guardar: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (p) => {
    const nextState = !p.activo;
    const op = getOperadorActual();
    try {
      if (isDbMode) {
        await setActivoDb(p.id_producto, nextState);
      } else {
        const nextList = productos.map((x) =>
          x.id_producto === p.id_producto ? { ...x, activo: nextState } : x
        );
        saveDraft(nextList);
      }

      setProductos((prev) =>
        prev.map((x) => (x.id_producto === p.id_producto ? { ...x, activo: nextState } : x))
      );

      logAudit(
        op,
        'CATALOG_VISIBILITY_TOGGLED',
        'CATALOG_WEB',
        `Visibilidad del producto "${p.id_producto}" cambiada a ${nextState ? 'VISIBLE' : 'OCULTO'}`,
        'SUCCESS'
      );

      setStatusMsg({
        type: 'success',
        text: `Visibilidad de "${p.nombre}" actualizada (${nextState ? 'Visible' : 'Oculto'}).`,
      });
      if (onContentChanged) onContentChanged();
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Error al cambiar visibilidad: ${err.message}` });
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`¿Confirmás eliminar definitivamente el producto "${p.nombre}" (${p.id_producto}) del catálogo de la tienda?`)) {
      return;
    }
    const op = getOperadorActual();
    try {
      if (isDbMode) {
        await deleteProductoDb(p.id_producto);
      } else {
        const nextList = productos.filter((x) => x.id_producto !== p.id_producto);
        saveDraft(nextList);
      }

      setProductos((prev) => prev.filter((x) => x.id_producto !== p.id_producto));
      if (editingId === p.id_producto) cancelEdit();

      logAudit(
        op,
        'CATALOG_PRODUCT_DELETED',
        'CATALOG_WEB',
        `Producto de tienda web eliminado: "${p.nombre}" (${p.id_producto})`,
        'SUCCESS'
      );

      setStatusMsg({ type: 'success', text: `Producto "${p.nombre}" eliminado del catálogo.` });
      if (onContentChanged) onContentChanged();
    } catch (err) {
      setStatusMsg({ type: 'error', text: `Error al eliminar producto: ${err.message}` });
    }
  };

  const handleImportJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        const list = Array.isArray(data) ? data : data.productos;
        if (!Array.isArray(list)) throw new Error('El archivo no contiene una lista válida de productos.');
        if (!window.confirm(`¿Importar ${list.length} productos al catálogo de la tienda online?`)) return;

        const op = getOperadorActual();
        if (isDbMode) {
          for (const item of list) {
            await saveProductoDb(fromForm(item));
          }
        } else {
          saveDraft(list);
        }

        logAudit(
          op,
          'CATALOG_JSON_IMPORTED',
          'CATALOG_WEB',
          `Importación masiva de ${list.length} productos al catálogo público.`,
          'SUCCESS'
        );

        await loadData();
        setStatusMsg({ type: 'success', text: `Importación completada con éxito (${list.length} productos).` });
        if (onContentChanged) onContentChanged();
      } catch (err) {
        setStatusMsg({ type: 'error', text: `Falló la importación: ${err.message}` });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const setField = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: val }));
  };

  return (
    <div className="gestion-module-container">
      {/* Encabezado del Módulo */}
      <div className="gestion-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex', color: 'var(--c-brand-blue, #1A4295)' }}>
              <IconStore />
            </span>
            <h1 className="gestion-title" style={{ margin: 0 }}>Catálogo Tienda Online</h1>
            <span
              style={{
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 4,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                background: isDbMode ? 'rgba(0, 180, 216, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: isDbMode ? '#007799' : '#854d0e',
                border: `1px solid ${isDbMode ? 'rgba(0, 180, 216, 0.4)' : 'rgba(234, 179, 8, 0.4)'}`,
              }}
            >
              {isDbMode ? 'Conexión Postgres / Supabase' : 'Modo Catálogo Local / Borrador'}
            </span>
          </div>
          <p className="gestion-subtitle" style={{ margin: '4px 0 0 0' }}>
            Administración unificada de productos, fotos, categorías y visibilidad en la tienda web pública (<code>#/productos</code>).
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="gestion-btn gestion-btn--primary" onClick={startNew}>
            <IconPlus /> Nuevo Producto
          </button>
          <label className="gestion-btn" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
            Importar JSON
            <input type="file" accept=".json" onChange={handleImportJson} hidden />
          </label>
          <button className="gestion-btn" onClick={() => exportDraft(productos)}>
            Exportar Backup JSON
          </button>
          <button className="gestion-btn" onClick={loadData}>
            Actualizar
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          style={{
            marginTop: 16,
            padding: '12px 16px',
            borderRadius: 6,
            fontSize: 13,
            background: statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            color: statusMsg.type === 'error' ? '#991b1b' : '#065f46',
            border: `1px solid ${statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Barra de Filtros */}
      <div
        style={{
          marginTop: 20,
          padding: 16,
          background: '#FFFFFF',
          borderRadius: 8,
          border: '1px solid #E5E7EB',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 240px' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 4 }}>
            Buscar por producto, ID o descripción
          </label>
          <input
            type="text"
            className="gestion-input"
            placeholder="Ej: Remera Peinada, Buzo Friza, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ minWidth: 160 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 4 }}>
            Categoría
          </label>
          <select
            className="gestion-input"
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
          >
            <option value="ALL">Todas las categorías</option>
            <option value="indumentaria">Indumentaria</option>
            <option value="merchandising">Merchandising</option>
            <option value="packs">Packs</option>
          </select>
        </div>

        <div style={{ minWidth: 140 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 4 }}>
            Estado en Tienda
          </label>
          <select
            className="gestion-input"
            value={filterActivo}
            onChange={(e) => setFilterActivo(e.target.value)}
          >
            <option value="ALL">Todos los estados</option>
            <option value="ACTIVO">Visibles (Activos)</option>
            <option value="OCULTO">Ocultos</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontSize: 13, color: '#6B7280' }}>
          Mostrando <b>{filteredProductos.length}</b> de <b>{productos.length}</b> productos
        </div>
      </div>

      {/* Contenedor Principal: Tabla y Panel de Edición Lateral / Modal */}
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: editingId ? '1fr 420px' : '1fr', gap: 20 }}>
        {/* Tabla de Productos */}
        <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
              Cargando catálogo de la tienda online…
            </div>
          ) : filteredProductos.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
              No se encontraron productos con los filtros seleccionados.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="gestion-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left', fontSize: 12, color: '#4B5563' }}>
                    <th style={{ padding: '12px 14px', width: 60 }}>Foto</th>
                    <th style={{ padding: '12px 14px' }}>ID</th>
                    <th style={{ padding: '12px 14px' }}>Producto</th>
                    <th style={{ padding: '12px 14px' }}>Categoría</th>
                    <th style={{ padding: '12px 14px' }}>Badge</th>
                    <th style={{ padding: '12px 14px' }}>Precio Base</th>
                    <th style={{ padding: '12px 14px' }}>Min. Cantidad</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Visibilidad</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProductos.map((p) => (
                    <tr
                      key={p.id_producto}
                      style={{
                        borderBottom: '1px solid #F3F4F6',
                        background: editingId === p.id_producto ? 'rgba(0, 180, 216, 0.05)' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => startEdit(p)}
                    >
                      <td style={{ padding: '10px 14px' }}>
                        {p.imagen_principal ? (
                          <img
                            src={p.imagen_principal}
                            alt=""
                            style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, border: '1px solid #E5E7EB' }}
                          />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: 4, background: '#F3F4F6', border: '1px solid #E5E7EB' }} />
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#6B7280' }}>
                        {p.id_producto}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{p.nombre}</div>
                        {p.descripcion && (
                          <div style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                            {p.descripcion}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background: '#F3F4F6',
                            color: '#374151',
                            textTransform: 'capitalize',
                            fontWeight: 500,
                          }}
                        >
                          {p.categoria}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#4B5563' }}>
                        {p.badge ? (
                          <span style={{ fontSize: 11, padding: '2px 6px', background: '#FEF3C7', color: '#92400E', borderRadius: 4, fontWeight: 600 }}>
                            {p.badge}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: '#111827', fontWeight: 500 }}>
                        {p.precio !== null && p.precio !== undefined && p.precio !== '' ? `$${Number(p.precio).toLocaleString('es-AR')}` : 'Cotización'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#4B5563' }}>
                        {p.cantidad ? `${p.cantidad} u.` : '10 u. (mín)'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActivo(p);
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: 'none',
                            background: p.activo ? '#DCFCE7' : '#FEE2E2',
                            color: p.activo ? '#166534' : '#991B1B',
                          }}
                        >
                          {p.activo ? 'Visible' : 'Oculto'}
                        </button>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="gestion-btn"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={() => startEdit(p)}
                            title="Editar producto"
                          >
                            <IconEdit />
                          </button>
                          <a
                            href={`#/productos/${p.id_producto}`}
                            target="_blank"
                            rel="noreferrer"
                            className="gestion-btn"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            title="Ver en la tienda pública"
                          >
                            <IconEye />
                          </a>
                          <button
                            type="button"
                            className="gestion-btn"
                            style={{ padding: '4px 8px', fontSize: 11, color: '#EF4444' }}
                            onClick={() => handleDelete(p)}
                            title="Eliminar producto"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Panel Lateral de Edición / Alta */}
        {editingId && (
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 8,
              border: '1px solid #00B4D8',
              padding: 20,
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              alignSelf: 'start',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' }}>
                {editingId === '__new__' ? 'Nuevo Producto de Tienda' : `Editar ${form.id_producto}`}
              </h2>
              <button
                type="button"
                onClick={cancelEdit}
                style={{ background: 'none', border: 'none', fontSize: 18, color: '#9CA3AF', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    ID Producto (slug) *
                  </label>
                  <input
                    type="text"
                    className="gestion-input"
                    value={form.id_producto}
                    onChange={setField('id_producto')}
                    disabled={editingId !== '__new__'}
                    placeholder="ej: remera-algodon-peinado-24-1"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    className="gestion-input"
                    value={form.nombre}
                    onChange={setField('nombre')}
                    placeholder="ej: Remera Peinada 24/1 DTF Textil"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Categoría
                  </label>
                  <select
                    className="gestion-input"
                    value={form.categoria}
                    onChange={setField('categoria')}
                  >
                    <option value="indumentaria">Indumentaria</option>
                    <option value="merchandising">Merchandising</option>
                    <option value="packs">Packs</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Badge Destacado
                  </label>
                  <input
                    type="text"
                    className="gestion-input"
                    value={form.badge}
                    onChange={setField('badge')}
                    placeholder="Top, Nuevo, Eco, Corporativo..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                      Precio Base ($)
                    </label>
                    <input
                      type="number"
                      className="gestion-input"
                      value={form.precio}
                      onChange={setField('precio')}
                      placeholder="Dejar vacío para cotización"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                      Cantidad Mínima
                    </label>
                    <input
                      type="number"
                      className="gestion-input"
                      value={form.cantidad}
                      onChange={setField('cantidad')}
                      placeholder="Mínimo 10 u."
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Imagen Principal (Ruta o URL)
                  </label>
                  <input
                    type="text"
                    className="gestion-input"
                    value={form.imagen_principal}
                    onChange={setField('imagen_principal')}
                    placeholder="/imagenes/productos/remera-negra.webp"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Galería de Fotos (separadas por coma)
                  </label>
                  <input
                    type="text"
                    className="gestion-input"
                    value={form.galeria}
                    onChange={setField('galeria')}
                    placeholder="foto1.webp, foto2.webp, foto3.webp"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Colores Disponibles (separados por coma)
                  </label>
                  <input
                    type="text"
                    className="gestion-input"
                    value={form.colores}
                    onChange={setField('colores')}
                    placeholder="Negro, Blanco, Marino, Gris Melange"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Descripción
                  </label>
                  <textarea
                    className="gestion-input"
                    rows={3}
                    value={form.descripcion}
                    onChange={setField('descripcion')}
                    placeholder="Descripción comercial y detalles de confección..."
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                    Especificaciones Técnicas (separadas por coma)
                  </label>
                  <textarea
                    className="gestion-input"
                    rows={2}
                    value={form.especificaciones}
                    onChange={setField('especificaciones')}
                    placeholder="100% Algodón peinado 24/1, Tapa costura en cuello, Estampa DTF alta duración"
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                  <input
                    type="checkbox"
                    id="chk-activo"
                    checked={form.activo}
                    onChange={setField('activo')}
                    style={{ width: 16, height: 16, accentColor: 'var(--c-brand-blue, #1A4295)' }}
                  />
                  <label htmlFor="chk-activo" style={{ fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                    Producto activo y visible en la tienda pública
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button
                    type="submit"
                    className="gestion-btn gestion-btn--primary"
                    style={{ flex: 1 }}
                    disabled={saving}
                  >
                    {saving ? 'Guardando…' : 'Guardar Producto'}
                  </button>
                  <button
                    type="button"
                    className="gestion-btn"
                    onClick={cancelEdit}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
