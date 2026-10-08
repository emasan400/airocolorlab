import { useEffect, useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { getTodosProductos } from '../lib/catalog';
import { postLead } from '../lib/leads';
import { openWhatsApp, buildQuoteMessage } from '../lib/secure';
import { MIN_QTY, validateQuantity, parseQuantityText } from '../shared/quote-contract.mjs';
import { exportMockupPng } from '../lib/mockup';
import { trackQuoteEvent } from '../lib/analytics';
import MockupPreview from './MockupPreview';
import QuickView from './QuickView';

const STEPS = ['Tu selección', 'Tus datos'];
const OBJETIVOS = ['Evento', 'Uniformes', 'Merchandising', 'Regalos'];
const DISENO = ['Sí, lo tengo', 'No', 'Necesito ayuda'];
const FORM_DRAFT_KEY = 'airo_quote_form_draft_v1';
const EMPTY_FORM = { nombre: '', empresa: '', whatsapp: '', email: '', objetivo: '', fecha: '', lugar: '', diseno: '', comentarios: '', website: '' };

const loadDraft = () => {
  try { return { ...EMPTY_FORM, ...(JSON.parse(localStorage.getItem(FORM_DRAFT_KEY)) || {}) }; }
  catch { return EMPTY_FORM; }
};

// Huella del estado enviado: si items (incl. diseño/preview) o datos de
// contacto cambian después del ack, la referencia mostrada NO corresponde
// al nuevo contenido.
const fingerprint = (items, form) =>
  JSON.stringify({
    items: items.map((i) => [i.id, i.cantidad, i.variant, i.configuration_id,
      i.preview && [i.preview.x, i.preview.y, i.preview.scale, i.preview.rotation, i.preview.background, i.preview.logo_data_url?.length]]),
    form,
  });

export default function CartDrawer() {
  const { items, reviewItems, isOpen, closeCart, setCantidad, removeItem, removeReviewItem, clearCart, totalUnidades, persistWarn } = useCart();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [sent, setSent] = useState(null); // {ack:{request_id,demo,duplicate}, snapshot:{items,form}}
  const [sendErr, setSendErr] = useState(null);
  const [sending, setSending] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [leaving, setLeaving] = useState(null);
  const [form, setForm] = useState(loadDraft);
  const [qtyDraft, setQtyDraft] = useState({}); // configuration_id → texto tipeado (inválido incluido)

  // Reconciliación: drafts de items ya eliminados no quedan bloqueando.
  useEffect(() => {
    setQtyDraft((d) => {
      const alive = Object.keys(d).filter((k) =>
        items.some((i) => (i.configuration_id ?? `legacy:${i.id}`) === k));
      return alive.length === Object.keys(d).length
        ? d
        : Object.fromEntries(alive.map((k) => [k, d[k]]));
    });
  }, [items]);

  const drawerRef = useRef(null);
  const closeRef = useRef(null);
  const productos = getTodosProductos();
  const [editItem, setEditItem] = useState(null); // edición explícita de diseño guardado
  const imgOf = (id) => productos.find((p) => p.id_producto === id)?.imagen_principal;

  // ack stale: si el draft cambia tras el éxito, el ack queda como snapshot
  // histórico — nunca se reusa la referencia para datos nuevos.
  const sentStale = !!sent && fingerprint(items, form) !== fingerprint(sent.snapshot.items, sent.snapshot.form);
  const activeSent = sent && !sentStale ? sent : null;

  // El formulario persiste como borrador local (sobrevive reload) hasta que
  // el usuario elige "Nuevo proyecto" — nunca se limpia solo.
  useEffect(() => {
    try { localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(form)); } catch { /* quota — el borrador sigue en memoria */ }
  }, [form]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setDir(1);
    setSendErr(null);
    setErrors({});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') return closeCart();
      if (e.key !== 'Tab') return;
      const els = drawerRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!els?.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [isOpen, closeCart]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value ?? e }));
  const pick = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const goTo = (n) => {
    setDir(n > step ? 1 : -1);
    setErrors({});
    setStep(n);
  };

  const onRemove = (i) => {
    setLeaving(i);
    setTimeout(() => {
      removeItem(i);
      setLeaving(null);
    }, 280);
  };

  // Draft de cantidad por configuration_id (clave estable — no por índice).
  // El valor inválido queda tipeado + error visible; se corrige al escribir
  // un valor válido o con los botones +/- (que aplican la cantidad real).
  const onQtyInput = (key, i, v) => {
    if (v === '') { setQtyDraft((d) => ({ ...d, [key]: v })); return; }
    const n = parseQuantityText(v);
    if (n === null || !validateQuantity(n).ok) {
      setQtyDraft((d) => ({ ...d, [key]: v }));
      return;
    }
    if (setCantidad(i, n)) setQtyDraft((d) => { const { [key]: _d, ...rest } = d; return rest; });
    else setQtyDraft((d) => ({ ...d, [key]: v }));
  };
  const qtyStep = (key, i, delta) => {
    if (setCantidad(i, items[i].cantidad + delta))
      setQtyDraft((d) => { const { [key]: _d, ...rest } = d; return rest; });
  };
  // ¿hay algún draft inválido pendiente? bloquea continuar/enviar.
  const invalidQty = Object.values(qtyDraft).some(
    (v) => v !== '' && (parseQuantityText(v) === null || !validateQuantity(parseQuantityText(v)).ok)
  ) || Object.values(qtyDraft).some((v) => v === '');

  const analytics = () => ({
    product_ids: items.map((i) => i.id),
    units: totalUnidades,
    config_count: items.length,
  });

  const irAProductos = () => {
    closeCart();
    setTimeout(() => document.getElementById('coleccion')?.scrollIntoView({ behavior: 'smooth' }), 80);
  };

  const waMessage = (snap) =>
    buildQuoteMessage({
      items: snap ? snap.items : items,
      contacto: snap
        ? { Nombre: snap.form.nombre, Empresa: snap.form.empresa, WhatsApp: snap.form.whatsapp, Email: snap.form.email }
        : { Nombre: form.nombre, Empresa: form.empresa, WhatsApp: form.whatsapp, Email: form.email },
      proyecto: {
        Objetivo: (snap ? snap.form : form).objetivo, 'Fecha estimada': (snap ? snap.form : form).fecha,
        Lugar: (snap ? snap.form : form).lugar, 'Diseño': (snap ? snap.form : form).diseno,
        Comentarios: (snap ? snap.form : form).comentarios,
        ...(snap ? { Referencia: sent?.ack.request_id } : {}),
      },
    });

  const enviar = async (e) => {
    e?.preventDefault?.();
    if (form.website || sending) return; // honeypot + doble-click
    const errs = {};
    if (!form.nombre.trim()) errs.nombre = 'El nombre es obligatorio.';
    const hasPhone = form.whatsapp.replace(/\D/g, '').length >= 8;
    const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    if (!hasPhone && !hasEmail) errs.contact = 'Dejanos un WhatsApp (mín. 8 dígitos) o un email válido.';
    else {
      if (form.whatsapp.trim() && !hasPhone) errs.whatsapp = 'Revisá el número (mínimo 8 dígitos).';
      if (form.email.trim() && !hasEmail) errs.email = 'Revisá el formato del email.';
    }
    if (!consent) errs.consent = 'Necesitamos tu consentimiento para tratar tus datos.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (reviewItems.length > 0 || invalidQty) return; // resolvé los pendientes primero

    setSending(true);
    setSendErr(null);
    trackQuoteEvent('quote_submit_attempt', analytics());
    try {
      const ack = await postLead({
        origen: 'Catálogo',
        nombre: form.nombre,
        empresa: form.empresa,
        whatsapp: form.whatsapp,
        email: form.email,
        ciudad: form.lugar,
        fecha_estimada: form.fecha,
        objetivo: form.objetivo,
        diseno: form.diseno,
        comentarios: form.comentarios,
        website: form.website,
        carrito: items.map((i) => `• ${i.cantidad}× ${i.titulo}`).join('\n'),
        items: items.map((i) => ({
          id: i.id, cantidad: i.cantidad, variant: i.variant,
          configuration_id: i.configuration_id,
          preview: consent ? i.preview : null, // preview solo si el consentimiento lo cubre
        })),
        consent: true,
      }, { catalog: productos });
      // Éxito SOLO con ack verificado; snapshot inmutable del envío.
      setSent({ ack, snapshot: { items: items.map((i) => ({ ...i })), form: { ...form } } });
      trackQuoteEvent('quote_submit_accepted', { ...analytics(), demo: ack.demo === true });
    } catch (err) {
      setSendErr(err?.error || 'No se confirmó el guardado de la solicitud.');
      trackQuoteEvent('quote_submit_failed', { ...analytics(), http_status: err?.status || 0 });
    } finally {
      setSending(false);
    }
  };

  const nuevaSolicitud = () => {
    setSent(null);
    setSendErr(null);
    setStep(2);
  };

  const nuevoProyecto = () => {
    clearCart();
    setForm(EMPTY_FORM);
    setConsent(false);
    setSent(null);
    setSendErr(null);
    setQtyDraft({});
    setStep(1);
  };

  const downloadSummary = () => {
    const snap = sent.snapshot;
    const summary = {
      referencia: sent.ack.request_id,
      demo: sent.ack.demo || undefined,
      contacto: { nombre: snap.form.nombre, empresa: snap.form.empresa, whatsapp: snap.form.whatsapp, email: snap.form.email },
      items: snap.items.map((i) => ({
        producto: i.titulo, cantidad: i.cantidad, variante: i.variant,
        configuration_id: i.configuration_id,
        preview: i.preview || null, // preview completo (incl. logo_data_url) — restaurable
      })),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' }));
    a.download = `solicitud-${sent.ack.request_id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className={`drawer-overlay${isOpen ? ' open' : ''}`} onClick={closeCart} />
      <aside
        className={`drawer${isOpen ? ' open' : ''}`}
        role="dialog" aria-modal="true" aria-label="Tu cotización"
        aria-hidden={!isOpen}
        ref={drawerRef}
      >
        <div className="drawer-head">
          <div>
            <h2>Tu cotización</h2>
            {!activeSent && items.length > 0 && (
              <span className="drawer-head-sub">{items.length} producto{items.length !== 1 ? 's' : ''} · {totalUnidades} unidades</span>
            )}
          </div>
          <button onClick={closeCart} aria-label="Cerrar cotización" ref={closeRef}>×</button>
        </div>

        <div className="drawer-body">
          {persistWarn && (
            <p className="field-error" role="alert">⚠ {persistWarn}</p>
          )}
          {activeSent ? (
            <div className="q-success">
              <div className="q-success-check" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 12.5l5.5 5.5L20 6.5" /></svg>
              </div>
              <h3>{activeSent.ack.demo ? 'Solicitud de prueba guardada' : 'Guardamos tu solicitud'}</h3>
              <p>
                Referencia: <code>{activeSent.ack.request_id}</code>{activeSent.ack.duplicate ? ' (ya registrada)' : ''}
              </p>
              <p>
                Abrí WhatsApp para continuar; el mensaje lo enviás vos.
                Un asesor de AIRO te responde en menos de 24 hs hábiles.
              </p>
              {activeSent.ack.persistence_warning && (
                <p className="field-error">⚠ La referencia no pudo persistir en este navegador — si recargás, un reintento genera una nueva.</p>
              )}
              <button className="btn btn--success" onClick={() => { trackQuoteEvent('whatsapp_open_intent', analytics()); openWhatsApp(waMessage(activeSent.snapshot)); }}>
                Abrir WhatsApp
              </button>
              <button className="btn btn--ghost" onClick={downloadSummary}>
                Descargar resumen
              </button>
              <button className="btn btn--ghost" onClick={nuevoProyecto}>Nuevo proyecto</button>
              <button className="btn btn--ghost" onClick={closeCart}>Cerrar</button>
            </div>
          ) : (
            <>
              {sent && sentStale && (
                <div className="q-review" role="status">
                  Tu selección cambió desde la solicitud guardada (ref. <code>{sent.ack.request_id}</code>).
                  Ese número corresponde a la versión anterior — enviá una nueva solicitud para los datos actuales.
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn btn--primary" onClick={nuevaSolicitud}>Enviar nueva solicitud</button>
                    <button className="btn btn--ghost" onClick={downloadSummary}>Descargar resumen anterior</button>
                  </div>
                </div>
              )}
              <ol className="q-steps" aria-label="Progreso de la solicitud">
                <div className="q-steps-track" aria-hidden="true">
                  <div className="q-steps-fill" style={{ transform: `scaleX(${(step - 1) / (STEPS.length - 1)})` }} />
                </div>
                {STEPS.map((label, i) => {
                  const n = i + 1;
                  const state = n === step ? 'current' : n < step ? 'done' : 'todo';
                  return (
                    <li key={label} className={`q-step ${state}`}>
                      <button
                        type="button"
                        onClick={() => n < step && goTo(n)}
                        disabled={n >= step}
                        aria-current={n === step ? 'step' : undefined}
                        aria-label={`Paso ${n}: ${label}${state === 'done' ? ' (completado)' : ''}`}
                      >
                        <span className="q-step-num" aria-hidden="true">{state === 'done' ? '✓' : n}</span>
                        <span className="q-step-label">{label}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>

              {sendErr && (
                <div className="q-error" role="alert">
                  <b>No se confirmó el envío.</b> {sendErr} Tu selección y datos siguen acá —
                  podés reintentar o escribirnos directo por WhatsApp.
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn btn--primary" onClick={enviar} disabled={sending}>Reintentar</button>
                    <button className="btn btn--ghost" onClick={() => { trackQuoteEvent('whatsapp_open_intent', analytics()); openWhatsApp(waMessage()); }}>
                      WhatsApp manual
                    </button>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="drawer-step step-enter-fwd" key="s1">
                  {items.length === 0 && reviewItems.length === 0 ? (
                    <div className="q-empty">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                      <p>Tu cotización está vacía. Sumá productos del catálogo para arrancar.</p>
                      <button className="btn btn--primary" onClick={irAProductos}>Explorar productos</button>
                    </div>
                  ) : (
                    <>
                      {reviewItems.length > 0 && (
                        <div className="q-review" role="alert">
                          <b>Revisión necesaria:</b> estos items de tu selección guardada ya no están
                          disponibles y <b>no se envían</b> hasta que los resuelvas:
                          {reviewItems.map((r, i) => (
                            <div key={i} className="q-review-row">
                              <span>{r.titulo || r.id} ×{r.cantidad} — {r.review_reason}</span>
                              <button className="q-del" onClick={() => removeReviewItem(i)} aria-label="Quitar item en revisión">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="q-items">
                        {items.map((item, i) => {
                          const bg = item.preview?.background || imgOf(item.id);
                          const key = item.configuration_id ?? `legacy:${item.id}`;
                          const draft = qtyDraft[key];
                          const draftNum = parseQuantityText(draft ?? '');
                          const draftInvalid = draft !== undefined && (draft === '' || draftNum === null || !validateQuantity(draftNum).ok);
                          return (
                            <div
                              key={`${item.id}-${item.configuration_id || 'base'}`}
                              className={`cart-item-row${leaving === i ? ' leaving' : ''}`}
                            >
                              <div className="q-item-wrap">
                                <div className="q-item" style={{ animationDelay: `${i * 50}ms` }}>
                                  <div className="q-item-img" aria-hidden="true">
                                    <MockupPreview
                                      background={bg}
                                      logo={item.preview?.logo_data_url}
                                      x={item.preview?.x} y={item.preview?.y}
                                      scale={item.preview?.scale} rotation={item.preview?.rotation}
                                      alt=""
                                    />
                                  </div>
                                  <div className="q-item-info">
                                    <span className="q-item-name">{item.titulo}</span>
                                    <span className="row" style={{ gap: 12, display: 'flex' }}>
                                      {item.preview && (
                                        <button
                                          type="button" className="q-item-cfg q-item-dl"
                                          onClick={() => exportMockupPng(item.preview, `mockup-${item.id}-ref.png`).catch(() => {})}
                                        >⬇ mockup referencial</button>
                                      )}
                                      <button
                                        type="button" className="q-item-cfg q-item-dl"
                                        onClick={() => {
                                          closeCart();
                                          setEditItem({ ...item }); // abre QuickView con esta config
                                        }}
                                      >Editar diseño</button>
                                    </span>
                                    <div className="q-qty">
                                      <button
                                        type="button"
                                        onClick={() => qtyStep(key, i, -10)}
                                        disabled={item.cantidad <= MIN_QTY}
                                        aria-label="Reducir cantidad"
                                      >−</button>
                                      <input
                                        type="number" min={MIN_QTY} step="10"
                                        value={draft !== undefined ? draft : item.cantidad}
                                        aria-label={`Cantidad de ${item.titulo}`}
                                        aria-invalid={draftInvalid}
                                        onChange={(e) => onQtyInput(key, i, e.target.value)}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => qtyStep(key, i, 10)}
                                        aria-label="Aumentar cantidad"
                                      >+</button>
                                    </div>
                                    {draftInvalid && (
                                      <span className="field-error">
                                        {draftNum === null ? 'ingresá solo números enteros' : validateQuantity(draftNum).error || 'cantidad requerida'}
                                      </span>
                                    )}
                                  </div>
                                  <span className="q-item-uds">uds</span>
                                  <button className="q-del" onClick={() => onRemove(i)} aria-label={`Quitar ${item.titulo}`}>×</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="q-min-note">Mínimo {MIN_QTY} unidades por producto · múltiplos de 10 · precios por cotización.</p>
                      <div className="trust">
                        <div>✔ Producción flexible desde 10 unidades</div>
                        <div>✔ Asesoramiento personalizado in-house</div>
                        <div>✔ Precios por cotización · respuesta en menos de 24 hs hábiles</div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {step === 2 && (
                <form id="quote-step2-form" className={`drawer-step ${dir > 0 ? 'step-enter-fwd' : 'step-enter-back'}`} key="s2" onSubmit={enviar} noValidate>
                  <div className="field">
                    <label htmlFor="b_nombre">Nombre y Apellido *</label>
                    <input id="b_nombre" type="text" value={form.nombre} onChange={set('nombre')} placeholder="Ej: Camila Rodríguez" autoComplete="name" required aria-invalid={!!errors.nombre} />
                    {errors.nombre && <p className="field-error" role="alert">{errors.nombre}</p>}
                  </div>
                  <div className="field">
                    <label htmlFor="b_whatsapp">WhatsApp</label>
                    <input id="b_whatsapp" type="tel" value={form.whatsapp} onChange={set('whatsapp')} placeholder="Ej: +54 9 11 5555 5555" autoComplete="tel" inputMode="tel" aria-invalid={!!(errors.whatsapp || errors.contact)} />
                    {errors.whatsapp && <p className="field-error" role="alert">{errors.whatsapp}</p>}
                  </div>
                  <div className="field">
                    <label htmlFor="b_email">Email</label>
                    <input id="b_email" type="email" value={form.email} onChange={set('email')} placeholder="Uno de los dos: WhatsApp o email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} />
                    {errors.email && <p className="field-error" role="alert">{errors.email}</p>}
                    {errors.contact && <p className="field-error" role="alert">{errors.contact}</p>}
                  </div>
                  <div className="field">
                    <label htmlFor="b_empresa">Empresa / Marca</label>
                    <input id="b_empresa" type="text" value={form.empresa} onChange={set('empresa')} placeholder="Opcional" autoComplete="organization" />
                  </div>
                  <input
                    type="text" className="hp-field" tabIndex={-1} autoComplete="off"
                    aria-hidden="true" value={form.website} onChange={set('website')}
                  />

                  <p className="form-divider">Detalles del proyecto <span>(opcional)</span></p>

                  <div className="field">
                    <span className="field-label" id="lbl_objetivo">Objetivo del Proyecto</span>
                    <div className="chips" role="group" aria-labelledby="lbl_objetivo">
                      {OBJETIVOS.map((o) => (
                        <button key={o} type="button" className={`chip${form.objetivo === o ? ' selected' : ''}`} aria-pressed={form.objetivo === o} onClick={() => pick('objetivo')(o)}>{o}</button>
                      ))}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="field">
                      <label htmlFor="b_fecha">Fecha Estimada</label>
                      <input type="date" id="b_fecha" value={form.fecha} onChange={set('fecha')} />
                    </div>
                    <div className="field">
                      <label htmlFor="b_lugar">Lugar de Entrega</label>
                      <input id="b_lugar" type="text" value={form.lugar} onChange={set('lugar')} placeholder="Ej: CABA" autoComplete="address-level2" />
                    </div>
                  </div>
                  <div className="field">
                    <span className="field-label" id="lbl_diseno">¿Ya contás con diseño?</span>
                    <div className="chips" role="group" aria-labelledby="lbl_diseno">
                      {DISENO.map((d) => (
                        <button key={d} type="button" className={`chip${form.diseno === d ? ' selected' : ''}`} aria-pressed={form.diseno === d} onClick={() => pick('diseno')(d)}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="b_comentarios">Comentarios adicionales</label>
                    <textarea id="b_comentarios" rows="2" value={form.comentarios} onChange={set('comentarios')} placeholder="Detalles de colores, talles o telas..." />
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {!activeSent && (
          <div className="drawer-foot">
            {step === 1 && (
              <>
                {items.length > 0 && (
                  <div className="q-totals">
                    <span>{items.length} producto{items.length !== 1 ? 's' : ''}</span>
                    <b>{totalUnidades} unidades</b>
                  </div>
                )}
                {reviewItems.length > 0 && (
                  <p className="field-error">Resolvé los items en revisión antes de continuar.</p>
                )}
                {invalidQty && (
                  <p className="field-error">Corregí la cantidad inválida antes de continuar.</p>
                )}
                <button className="btn btn--primary" disabled={items.length === 0 || reviewItems.length > 0 || invalidQty} onClick={() => goTo(2)}>
                  Continuar con mis datos
                </button>
              </>
            )}
            {step === 2 && (
              <>
                <label className="consent-check">
                  <input
                    type="checkbox" checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    aria-invalid={!!errors.consent}
                  />
                  <span>
                    Acepto el tratamiento de mis datos personales (Ley 25.326)
                    para que AIRO responda esta solicitud, incluida — si la generé —
                    la imagen PNG de previsualización referencial (mi archivo original
                    queda solo en este equipo).{' '}
                    <a href="#/privacidad" target="_blank">Ver política de privacidad</a>.
                  </span>
                </label>
                {errors.consent && <p className="field-error" role="alert">{errors.consent}</p>}
                <div className="row">
                  <button type="button" className="btn btn--ghost" onClick={() => goTo(1)} disabled={sending}>Atrás</button>
                  <button
                    type="submit"
                    form="quote-step2-form"
                    className="btn btn--success"
                    disabled={sending}
                  >
                    {sending ? 'Enviando…' : 'Enviar solicitud'}
                  </button>
                </div>
                <p className="disclaimer">🔒 Un asesor de AIRO revisará tu proyecto. Precios por cotización — no hay fecha de entrega prometida.</p>
              </>
            )}
          </div>
        )}
      </aside>
      {/* Host de edición de diseño — funciona también desde páginas de producto */}
      {editItem && (
        <QuickView
          producto={productos.find((p) => p.id_producto === editItem.id) || null}
          initialConfiguration={editItem}
          onClose={() => setEditItem(null)}
        />
      )}
    </>
  );
}
