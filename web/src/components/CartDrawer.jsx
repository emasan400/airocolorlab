import { useEffect, useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { getTodosProductos } from '../lib/catalog';
import { postLead } from '../lib/leads';
import { openWhatsApp, buildQuoteMessage } from '../lib/secure';

const STEPS = ['Tu selección', 'Tus datos'];
const OBJETIVOS = ['Evento', 'Uniformes', 'Merchandising', 'Regalos'];
const DISENO = ['Sí, lo tengo', 'No', 'Necesito ayuda'];
const MIN_QTY = 10;

export default function CartDrawer() {
  const { items, isOpen, closeCart, setCantidad, removeItem, clearCart, totalUnidades } = useCart();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [sent, setSent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [leaving, setLeaving] = useState(null);
  const [form, setForm] = useState({
    nombre: '', empresa: '', whatsapp: '', objetivo: '', fecha: '', lugar: '', diseno: '', comentarios: '', website: '',
  });

  const drawerRef = useRef(null);
  const closeRef = useRef(null);
  const productos = getTodosProductos();
  const imgOf = (id) => productos.find((p) => p.id_producto === id)?.imagen_principal;

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setDir(1);
    setSent(false);
    setErrors({});
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('b_fecha')?.setAttribute('min', hoy);
  }, [isOpen]);

  // Bloquea el scroll del fondo mientras el drawer está abierto
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [isOpen]);

  // Foco dentro del drawer + Escape cierra + devolver foco
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

  const irAProductos = () => {
    closeCart();
    setTimeout(() => document.getElementById('coleccion')?.scrollIntoView({ behavior: 'smooth' }), 80);
  };

  const enviar = () => {
    if (form.website) return; // honeypot anti-spam
    const e = {};
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
    if (form.whatsapp.trim() && form.whatsapp.replace(/\D/g, '').length < 8) {
      e.whatsapp = 'Revisá el número (mínimo 8 dígitos).';
    }
    if (!consent) e.consent = 'Necesitamos tu consentimiento para tratar tus datos.';
    setErrors(e);
    if (Object.keys(e).length) return;

    postLead({
      origen: 'Catálogo',
      nombre: form.nombre,
      empresa: form.empresa || 'No especificada',
      whatsapp: form.whatsapp || 'Se contacta directo',
      email: '-',
      ciudad: form.lugar || 'No especificado',
      fecha_estimada: form.fecha || 'No especificada',
      objetivo: form.objetivo || 'No especificado',
      diseno: form.diseno || 'No especificado',
      comentarios: form.comentarios || 'Sin comentarios',
      carrito: items.map((i) => `• ${i.cantidad}× ${i.titulo}`).join('\n'),
    });

    openWhatsApp(
      buildQuoteMessage({
        items,
        contacto: { Nombre: form.nombre, Empresa: form.empresa, WhatsApp: form.whatsapp },
        proyecto: {
          Objetivo: form.objetivo,
          'Fecha estimada': form.fecha,
          Lugar: form.lugar,
          'Diseño': form.diseno,
          Comentarios: form.comentarios,
        },
      })
    );
    setSent(true);
    clearCart();
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
            {!sent && items.length > 0 && (
              <span className="drawer-head-sub">{items.length} producto{items.length !== 1 ? 's' : ''} · {totalUnidades} unidades</span>
            )}
          </div>
          <button onClick={closeCart} aria-label="Cerrar cotización" ref={closeRef}>×</button>
        </div>

        <div className="drawer-body">
          {sent ? (
            <div className="q-success">
              <div className="q-success-check" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 12.5l5.5 5.5L20 6.5" /></svg>
              </div>
              <h3>¡Solicitud enviada!</h3>
              <p>
                Recibimos tu proyecto. Un asesor de AIRO te contacta por WhatsApp
                en menos de 24 hs hábiles con la cotización.
              </p>
              <button className="btn btn--ghost" onClick={closeCart}>Cerrar</button>
            </div>
          ) : (
            <>
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

              {step === 1 && (
                <div className="drawer-step step-enter-fwd" key="s1">
                  {items.length === 0 ? (
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
                      <div className="q-items">
                        {items.map((item, i) => {
                          const img = imgOf(item.id);
                          return (
                            <div
                              key={`${item.id}-${item.titulo}`}
                              className={`cart-item-row${leaving === i ? ' leaving' : ''}`}
                            >
                              <div className="q-item-wrap">
                                <div className="q-item" style={{ animationDelay: `${i * 50}ms` }}>
                                  <div className="q-item-img" aria-hidden="true">
                                    {img && <img src={img} alt="" />}
                                  </div>
                                  <div className="q-item-info">
                                    <span className="q-item-name">{item.titulo}</span>
                                    <div className="q-qty">
                                      <button
                                        type="button"
                                        onClick={() => setCantidad(i, Math.max(MIN_QTY, item.cantidad - 10))}
                                        disabled={item.cantidad <= MIN_QTY}
                                        aria-label="Reducir cantidad"
                                      >−</button>
                                      <input
                                        type="number" min={MIN_QTY} step="10"
                                        value={item.cantidad}
                                        aria-label={`Cantidad de ${item.titulo}`}
                                        onChange={(e) => setCantidad(i, Math.max(MIN_QTY, parseInt(e.target.value) || MIN_QTY))}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setCantidad(i, item.cantidad + 10)}
                                        aria-label="Aumentar cantidad"
                                      >+</button>
                                    </div>
                                  </div>
                                  <span className="q-item-uds">uds</span>
                                  <button className="q-del" onClick={() => onRemove(i)} aria-label={`Quitar ${item.titulo}`}>×</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="q-min-note">Pedido mínimo {MIN_QTY} unidades por producto.</p>
                      <div className="trust">
                        <div>✔ Producción flexible desde 10 unidades</div>
                        <div>✔ Asesoramiento personalizado in-house</div>
                        <div>✔ Envíos garantizados a todo el país</div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className={`drawer-step ${dir > 0 ? 'step-enter-fwd' : 'step-enter-back'}`} key="s2">
                  <div className="field">
                    <label htmlFor="b_nombre">Nombre y Apellido *</label>
                    <input id="b_nombre" type="text" value={form.nombre} onChange={set('nombre')} placeholder="Ej: Camila Rodríguez" autoComplete="name" required aria-invalid={!!errors.nombre} />
                    {errors.nombre && <p className="field-error" role="alert">{errors.nombre}</p>}
                  </div>
                  <div className="field">
                    <label htmlFor="b_whatsapp">WhatsApp</label>
                    <input id="b_whatsapp" type="tel" value={form.whatsapp} onChange={set('whatsapp')} placeholder="Ej: +54 9 11 5555 5555" autoComplete="tel" inputMode="tel" aria-invalid={!!errors.whatsapp} />
                    {errors.whatsapp && <p className="field-error" role="alert">{errors.whatsapp}</p>}
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
                    <label>Objetivo del Proyecto</label>
                    <div className="chips" role="group" aria-label="Objetivo del proyecto">
                      {OBJETIVOS.map((o) => (
                        <button key={o} className={`chip${form.objetivo === o ? ' selected' : ''}`} aria-pressed={form.objetivo === o} onClick={() => pick('objetivo')(o)}>{o}</button>
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
                    <label>¿Ya contás con diseño?</label>
                    <div className="chips" role="group" aria-label="¿Ya contás con diseño?">
                      {DISENO.map((d) => (
                        <button key={d} className={`chip${form.diseno === d ? ' selected' : ''}`} aria-pressed={form.diseno === d} onClick={() => pick('diseno')(d)}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="b_comentarios">Comentarios adicionales</label>
                    <textarea id="b_comentarios" rows="2" value={form.comentarios} onChange={set('comentarios')} placeholder="Detalles de colores, talles o telas..." />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!sent && (
          <div className="drawer-foot">
            {step === 1 && (
              <>
                {items.length > 0 && (
                  <div className="q-totals">
                    <span>{items.length} producto{items.length !== 1 ? 's' : ''}</span>
                    <b>{totalUnidades} unidades</b>
                  </div>
                )}
                <button className="btn btn--primary" disabled={items.length === 0} onClick={() => goTo(2)}>
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
                    para que AIRO responda esta solicitud.{' '}
                    <a href="#/privacidad" target="_blank">Ver política de privacidad</a>.
                  </span>
                </label>
                {errors.consent && <p className="field-error" role="alert">{errors.consent}</p>}
                <div className="row">
                  <button className="btn btn--ghost" onClick={() => goTo(1)}>Atrás</button>
                  <button className="btn btn--success" onClick={enviar}>Enviar solicitud</button>
                </div>
                <p className="disclaimer">🔒 Un asesor de AIRO revisará tu proyecto.</p>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
