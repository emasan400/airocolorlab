import { useEffect, useState } from 'react';
import {
  getTodosProductos,
  saveDraft,
  clearDraft,
  hasDraft,
  exportDraft,
} from '../lib/catalog';
import { supabase, supabaseEnabled } from '../lib/supabase';
import {
  fetchProductosDb,
  saveProductoDb,
  deleteProductoDb,
  setActivoDb,
  fetchLeadsDb,
} from '../lib/db';

const EMPTY = {
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

// Form <-> modelo interno
const toForm = (p) => ({
  ...p,
  precio: p.precio ?? '',
  cantidad: p.cantidad ?? '',
  imagen_principal: p.imagen_principal ?? '',
  galeria: (p.galeria || []).join(', '),
  colores: (p.colores || []).join(', '),
  especificaciones: (p.especificaciones || []).join(', '),
});
const fromForm = (f) => ({
  ...f,
  precio: f.precio === '' ? null : Number(f.precio),
  cantidad: f.cantidad === '' ? null : Number(f.cantidad),
  imagen_principal: f.imagen_principal.trim() || null,
  galeria: f.galeria.split(',').map((s) => s.trim()).filter(Boolean),
  colores: f.colores.split(',').map((s) => s.trim()).filter(Boolean),
  especificaciones: f.especificaciones.split(',').map((s) => s.trim()).filter(Boolean),
  activo: !!f.activo,
});

export default function Admin() {
  return supabaseEnabled ? <LiveAdmin /> : <DraftAdmin />;
}

/* ============================================================
   MODO VIVO — Supabase Auth + CRUD directo a Postgres
   ============================================================ */
function LiveAdmin() {
  const [session, setSession] = useState(undefined); // undefined = chequeando
  const [tab, setTab] = useState('productos');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="admin-login"><p className="hint">Verificando sesión…</p></div>;
  if (!session) return <Login />;

  return (
    <div className="admin">
      <div className="admin-bar">
        <div className="container">
          <h1>AIRO · Admin <span className="draft-flag draft-flag--live">· En vivo</span></h1>
          <div className="admin-actions">
            <div className="admin-tabs">
              <button
                className={`admin-btn${tab === 'productos' ? ' admin-btn--primary' : ''}`}
                onClick={() => setTab('productos')}
              >Productos</button>
              <button
                className={`admin-btn${tab === 'leads' ? ' admin-btn--primary' : ''}`}
                onClick={() => setTab('leads')}
              >Leads</button>
            </div>
            <a href="#/" className="admin-btn">← Ver sitio</a>
            <button className="admin-btn" onClick={() => supabase.auth.signOut()}>
              Salir ({session.user.email})
            </button>
          </div>
        </div>
      </div>
      {tab === 'productos' ? <ProductosPanel /> : <LeadsPanel />}
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message || 'Error desconocido';
      setErr(
        msg.toLowerCase().includes('email not confirmed')
          ? 'Email no confirmado: en Supabase → Authentication → Users, abrí tu usuario y marcá "Confirm".'
          : `Supabase dice: ${msg}`
      );
    }
    setBusy(false);
  };

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={submit}>
        <h1 className="display">AIRO · Admin</h1>
        <p className="hint">Ingresá con tu usuario de Supabase Auth.</p>
        <div className="field"><label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="field"><label>Contraseña</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <p className="admin-error">{err}</p>}
        <button className="admin-btn admin-btn--primary" type="submit" disabled={busy}>
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>
        <a href="#/" className="hint" style={{ textAlign: 'center' }}>← volver al sitio</a>
      </form>
    </div>
  );
}

function ProductosPanel() {
  const [productos, setProductos] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const reload = async () => {
    const list = await fetchProductosDb();
    if (list) setProductos(list);
    else setMsg('No se pudo leer la base. ¿Corriste schema.sql y seed.sql?');
  };
  useEffect(() => { reload(); }, []);

  const startEdit = (p) => { setEditing(p.id_producto); setForm(toForm(p)); };
  const startNew = () => { setEditing('__new__'); setForm(EMPTY); };
  const cancelEdit = () => { setEditing(null); setForm(EMPTY); };

  const saveProduct = async () => {
    if (!form.id_producto.trim() || !form.nombre.trim()) {
      return alert('ID y nombre son obligatorios.');
    }
    if (editing === '__new__' &&
        productos.some((p) => p.id_producto === form.id_producto.trim())) {
      return alert('Ya existe un producto con ese ID.');
    }
    setSaving(true);
    try {
      await saveProductoDb(fromForm(form));
      await reload();
      cancelEdit();
      setMsg('Guardado en la base.');
    } catch (err) {
      setMsg(`Error al guardar: ${err.message}`);
    }
    setSaving(false);
  };

  const toggleActivo = async (p) => {
    try {
      await setActivoDb(p.id_producto, !p.activo);
      setProductos(productos.map((x) =>
        x.id_producto === p.id_producto ? { ...x, activo: !x.activo } : x));
    } catch (err) {
      setMsg(`Error al cambiar estado: ${err.message}`);
    }
  };

  const removeProduct = async (id) => {
    if (!confirm(`¿Eliminar "${id}" de la base? Se borran también sus imágenes, colores y specs.`)) return;
    try {
      await deleteProductoDb(id);
      setProductos(productos.filter((p) => p.id_producto !== id));
      if (editing === id) cancelEdit();
      setMsg('Producto eliminado.');
    } catch (err) {
      setMsg(`Error al eliminar: ${err.message}`);
    }
  };

  const importJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        const list = Array.isArray(data) ? data : data.productos;
        if (!Array.isArray(list)) throw new Error('formato');
        if (!confirm(`Importar ${list.length} productos a la base (upsert por ID)?`)) return;
        for (const p of list) await saveProductoDb(p);
        await reload();
        setMsg(`Importados ${list.length} productos.`);
      } catch (err) {
        alert(`Import falló: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div className="admin-wrap">
      <div className="admin-table">
        {msg && <p className="admin-msg">{msg}</p>}
        <table>
          <thead>
            <tr>
              <th></th><th>ID</th><th>Producto</th><th>Categoría</th><th>Badge</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr
                key={p.id_producto}
                className={editing === p.id_producto ? 'editing' : ''}
                onClick={() => startEdit(p)}
              >
                <td>
                  {p.imagen_principal
                    ? <img className="admin-thumb" src={p.imagen_principal} alt="" />
                    : <div className="admin-thumb" />}
                </td>
                <td><code>{p.id_producto}</code></td>
                <td><b>{p.nombre}</b></td>
                <td><span className="pill pill--cat">{p.categoria}</span></td>
                <td>{p.badge || '—'}</td>
                <td>
                  <button
                    className={`pill ${p.activo ? 'pill--on' : 'pill--off'}`}
                    onClick={(e) => { e.stopPropagation(); toggleActivo(p); }}
                  >
                    {p.activo ? 'Activo' : 'Oculto'}
                  </button>
                </td>
                <td>
                  <button
                    className="admin-btn admin-btn--danger"
                    onClick={(e) => { e.stopPropagation(); removeProduct(p.id_producto); }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: 16, display: 'flex', gap: 10 }}>
          <button className="admin-btn admin-btn--primary" onClick={startNew}>+ Nuevo producto</button>
          <label className="admin-btn" style={{ cursor: 'pointer' }}>
            Importar JSON<input type="file" accept=".json" onChange={importJson} hidden />
          </label>
          <button className="admin-btn" onClick={() => exportDraft(productos)}>
            Backup JSON
          </button>
        </div>
      </div>

      <div className="admin-panel">
        {editing ? (
          <>
            <h2>{editing === '__new__' ? 'Nuevo producto' : `Editar ${editing}`}</h2>
            <p className="hint">Listas separadas por coma. Rutas de imagen: <code>/imagenes/productos/archivo.jpg</code></p>

            <div className="field"><label>ID *</label><input type="text" value={form.id_producto} onChange={set('id_producto')} disabled={editing !== '__new__'} /></div>
            <div className="field"><label>Nombre *</label><input type="text" value={form.nombre} onChange={set('nombre')} /></div>
            <div className="field"><label>Descripción</label><textarea value={form.descripcion} onChange={set('descripcion')} /></div>
            <div className="field"><label>Categoría</label>
              <select value={form.categoria} onChange={set('categoria')}>
                <option value="merchandising">Merchandising</option>
                <option value="indumentaria">Indumentaria</option>
                <option value="packs">Packs</option>
              </select>
            </div>
            <div className="field"><label>Badge</label><input type="text" value={form.badge} onChange={set('badge')} placeholder="Top, Nuevo, Eco..." /></div>
            <div className="form-row">
              <div className="field"><label>Precio</label><input type="number" value={form.precio} onChange={set('precio')} placeholder="—" /></div>
              <div className="field"><label>Cantidad</label><input type="number" value={form.cantidad} onChange={set('cantidad')} placeholder="—" /></div>
            </div>
            <div className="field"><label>Imagen principal</label><input type="text" value={form.imagen_principal} onChange={set('imagen_principal')} placeholder="/imagenes/productos/xxx.jpg" /></div>
            <div className="field"><label>Galería</label><input type="text" value={form.galeria} onChange={set('galeria')} placeholder="ruta1, ruta2" /></div>
            <div className="field"><label>Colores</label><input type="text" value={form.colores} onChange={set('colores')} placeholder="Blanco, Negro" /></div>
            <div className="field"><label>Especificaciones</label><textarea value={form.especificaciones} onChange={set('especificaciones')} placeholder="Algodón peinado, DTF..." /></div>
            <div className="field">
              <label className="chip-check" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={form.activo} onChange={set('activo')} style={{ display: 'inline', width: 'auto' }} />
                Visible en el catálogo
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="admin-btn admin-btn--primary" style={{ flex: 1 }} onClick={saveProduct} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar en la base'}
              </button>
              <button className="admin-btn" onClick={cancelEdit}>Cancelar</button>
            </div>
          </>
        ) : (
          <>
            <h2>Modo en vivo</h2>
            <p className="hint">Estás editando Postgres directo.</p>
            <div className="admin-note">
              Los cambios se ven en el sitio <b>inmediatamente</b>, para todos
              los visitantes — sin exportar ni redeployar.<br /><br />
              · Click en una fila para editar.<br />
              · El toggle Activo/Oculto cambia visibilidad al instante.<br />
              · "Backup JSON" descarga una copia de seguridad del catálogo.<br />
              · La tab <b>Leads</b> muestra los formularios recibidos.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LeadsPanel() {
  const [leads, setLeads] = useState(null);

  const reload = () => fetchLeadsDb().then(setLeads);
  useEffect(() => { reload(); }, []);

  return (
    <div className="admin-wrap admin-wrap--full">
      <div className="admin-table">
        <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b>{leads ? `${leads.length} leads` : 'Cargando…'}</b>
          <button className="admin-btn" onClick={reload}>↻ Actualizar</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Origen</th><th>Nombre</th><th>Empresa</th>
              <th>WhatsApp</th><th>Objetivo</th><th>Pedido</th>
            </tr>
          </thead>
          <tbody>
            {(leads || []).map((l) => (
              <tr key={l.id}>
                <td><code>{new Date(l.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</code></td>
                <td><span className="pill pill--cat">{l.origen}</span></td>
                <td><b>{l.nombre}</b></td>
                <td>{l.empresa}</td>
                <td>{l.whatsapp}</td>
                <td>{l.objetivo}</td>
                <td className="lead-cart">{l.carrito !== 'No aplica' ? l.carrito : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   MODO BORRADOR — sin Supabase configurado (fallback offline)
   ============================================================ */
function DraftAdmin() {
  const [productos, setProductos] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [draft, setDraft] = useState(false);

  useEffect(() => {
    setProductos(getTodosProductos());
    setDraft(hasDraft());
  }, []);

  const persist = (list) => {
    setProductos(list);
    saveDraft(list);
    setDraft(true);
  };

  const startEdit = (p) => { setEditing(p.id_producto); setForm(toForm(p)); };
  const startNew = () => { setEditing('__new__'); setForm(EMPTY); };
  const cancelEdit = () => { setEditing(null); setForm(EMPTY); };

  const saveProduct = () => {
    if (!form.id_producto.trim() || !form.nombre.trim()) {
      return alert('ID y nombre son obligatorios.');
    }
    const prod = fromForm(form);
    const exists = productos.some((p) => p.id_producto === prod.id_producto);
    if (!exists || editing === '__new__') {
      if (productos.some((p) => p.id_producto === prod.id_producto) && editing === '__new__') {
        return alert('Ya existe un producto con ese ID.');
      }
      persist([...productos, prod]);
    } else {
      persist(productos.map((p) => (p.id_producto === prod.id_producto ? prod : p)));
    }
    cancelEdit();
  };

  const toggleActivo = (id) =>
    persist(productos.map((p) => (p.id_producto === id ? { ...p, activo: !p.activo } : p)));

  const removeProduct = (id) => {
    if (confirm(`¿Eliminar "${id}" del catálogo?`)) {
      persist(productos.filter((p) => p.id_producto !== id));
      if (editing === id) cancelEdit();
    }
  };

  const restore = () => {
    clearDraft();
    setDraft(false);
    setProductos(getTodosProductos());
    cancelEdit();
  };

  const importJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const list = Array.isArray(data) ? data : data.productos;
        if (!Array.isArray(list)) throw new Error('formato');
        persist(list);
      } catch {
        alert('El archivo no es un catalogo.json válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div className="admin">
      <div className="admin-bar">
        <div className="container">
          <h1>AIRO · Admin del catálogo {draft && <span className="draft-flag">· Borrador activo</span>}</h1>
          <div className="admin-actions">
            <a href="#/" className="admin-btn">← Ver sitio</a>
            <label className="admin-btn" style={{ cursor: 'pointer' }}>
              Importar JSON<input type="file" accept=".json" onChange={importJson} hidden />
            </label>
            <button className="admin-btn admin-btn--primary" onClick={() => exportDraft(productos)}>
              Exportar catalogo.json
            </button>
            {draft && (
              <button className="admin-btn admin-btn--danger" onClick={restore}>
                Descartar borrador
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="admin-wrap">
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th></th><th>ID</th><th>Producto</th><th>Categoría</th><th>Badge</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr
                  key={p.id_producto}
                  className={editing === p.id_producto ? 'editing' : ''}
                  onClick={() => startEdit(p)}
                >
                  <td>
                    {p.imagen_principal
                      ? <img className="admin-thumb" src={p.imagen_principal} alt="" />
                      : <div className="admin-thumb" />}
                  </td>
                  <td><code>{p.id_producto}</code></td>
                  <td><b>{p.nombre}</b></td>
                  <td><span className="pill pill--cat">{p.categoria}</span></td>
                  <td>{p.badge || '—'}</td>
                  <td>
                    <button
                      className={`pill ${p.activo ? 'pill--on' : 'pill--off'}`}
                      onClick={(e) => { e.stopPropagation(); toggleActivo(p.id_producto); }}
                    >
                      {p.activo ? 'Activo' : 'Oculto'}
                    </button>
                  </td>
                  <td>
                    <button
                      className="admin-btn admin-btn--danger"
                      onClick={(e) => { e.stopPropagation(); removeProduct(p.id_producto); }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: 16 }}>
            <button className="admin-btn admin-btn--primary" onClick={startNew}>+ Nuevo producto</button>
          </div>
        </div>

        <div className="admin-panel">
          {editing ? (
            <>
              <h2>{editing === '__new__' ? 'Nuevo producto' : `Editar ${editing}`}</h2>
              <p className="hint">Listas separadas por coma. Rutas de imagen: <code>/imagenes/productos/archivo.jpg</code></p>

              <div className="field"><label>ID *</label><input type="text" value={form.id_producto} onChange={set('id_producto')} disabled={editing !== '__new__'} /></div>
              <div className="field"><label>Nombre *</label><input type="text" value={form.nombre} onChange={set('nombre')} /></div>
              <div className="field"><label>Descripción</label><textarea value={form.descripcion} onChange={set('descripcion')} /></div>
              <div className="field"><label>Categoría</label>
                <select value={form.categoria} onChange={set('categoria')}>
                  <option value="merchandising">Merchandising</option>
                  <option value="indumentaria">Indumentaria</option>
                  <option value="packs">Packs</option>
                </select>
              </div>
              <div className="field"><label>Badge</label><input type="text" value={form.badge} onChange={set('badge')} placeholder="Top, Nuevo, Eco..." /></div>
              <div className="form-row">
                <div className="field"><label>Precio</label><input type="number" value={form.precio} onChange={set('precio')} placeholder="—" /></div>
                <div className="field"><label>Cantidad</label><input type="number" value={form.cantidad} onChange={set('cantidad')} placeholder="—" /></div>
              </div>
              <div className="field"><label>Imagen principal</label><input type="text" value={form.imagen_principal} onChange={set('imagen_principal')} placeholder="/imagenes/productos/xxx.jpg" /></div>
              <div className="field"><label>Galería</label><input type="text" value={form.galeria} onChange={set('galeria')} placeholder="ruta1, ruta2" /></div>
              <div className="field"><label>Colores</label><input type="text" value={form.colores} onChange={set('colores')} placeholder="Blanco, Negro" /></div>
              <div className="field"><label>Especificaciones</label><textarea value={form.especificaciones} onChange={set('especificaciones')} placeholder="Algodón peinado, DTF..." /></div>
              <div className="field">
                <label className="chip-check" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={form.activo} onChange={set('activo')} style={{ display: 'inline', width: 'auto' }} />
                  Visible en el catálogo
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="admin-btn admin-btn--primary" style={{ flex: 1 }} onClick={saveProduct}>Guardar</button>
                <button className="admin-btn" onClick={cancelEdit}>Cancelar</button>
              </div>
            </>
          ) : (
            <>
              <h2>Cómo funciona</h2>
              <p className="hint">El panel edita un borrador local del catálogo.</p>
              <div className="admin-note">
                1. Editá productos en la tabla (click en la fila) o creá nuevos.<br />
                2. El sitio muestra el borrador <b>solo en este navegador</b> — podés previsualizarlo en <a href="#/">#/</a>.<br />
                3. Para publicar: <b>Exportar catalogo.json</b> → reemplazá <code>web/src/data/catalogo.json</code> → subí las imágenes nuevas a <code>web/public/imagenes/productos/</code> → deploy.<br /><br />
                Configurando <code>VITE_SUPABASE_URL</code> + <code>VITE_SUPABASE_ANON_KEY</code> este panel pasa a modo en vivo (login + escritura directa a Postgres).
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
