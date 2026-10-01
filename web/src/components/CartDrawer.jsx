import { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import { postLead } from '../lib/leads';
import { openWhatsApp } from '../lib/secure';

const STEP_TITLES = ['Tu Selección', 'Datos Básicos', 'Detalles del Proyecto'];
const OBJETIVOS = ['Evento', 'Uniformes', 'Merchandising', 'Regalos'];
const DISENO = ['Sí, lo tengo', 'No', 'Necesito ayuda'];

export default function CartDrawer() {
  const { items, isOpen, closeCart, setCantidad, removeItem, totalUnidades } = useCart();
  const [step, setStep] = useState(1);
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState({
    nombre: '', empresa: '', objetivo: '', fecha: '', lugar: '', diseno: '', comentarios: '', website: '',
  });

  useEffect(() => {
    if (isOpen) setStep(1);
    if (isOpen) {
      const hoy = new Date().toISOString().split('T')[0];
      document.getElementById('b_fecha')?.setAttribute('min', hoy);
    }
  }, [isOpen]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value ?? e }));
  const pick = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const goTo = (n) => {
    if (n === 2 && items.length === 0) return alert('Agregá al menos un producto para continuar.');
    if (n === 3 && !form.nombre.trim()) return alert('El Nombre es obligatorio.');
    setStep(n);
  };

  const enviar = () => {
    if (form.website) return; // honeypot anti-spam
    if (!consent) {
      return alert('Necesitamos tu consentimiento para tratar tus datos de contacto.');
    }
    const txt = items.map((i) => `• ${i.cantidad}x ${i.titulo}`).join('\n');
    postLead({
      origen: 'Catálogo',
      nombre: form.nombre,
      empresa: form.empresa || 'No especificada',
      whatsapp: 'Se contacta directo',
      email: '-',
      ciudad: form.lugar || 'No especificado',
      fecha_estimada: form.fecha || 'No especificada',
      objetivo: form.objetivo || 'No especificado',
      diseno: form.diseno || 'No especificado',
      comentarios: form.comentarios || 'Sin comentarios',
      carrito: txt,
    });

    openWhatsApp(
      '¡Hola AIRO! Quiero cotizar un nuevo proyecto.\n\n' +
        `📦 *SELECCIÓN:*\n${txt}\n\n` +
        '📝 *DATOS:*\n' +
        `👤 Nombre: ${form.nombre}\n` +
        `🏢 Empresa: ${form.empresa || 'No especificada'}\n` +
        `🎯 Objetivo: ${form.objetivo || 'No especificado'}\n` +
        `📅 Fecha Estimada: ${form.fecha || 'No especificada'}\n` +
        `📍 Lugar: ${form.lugar || 'No especificado'}\n` +
        `🎨 Diseño: ${form.diseno || 'No especificado'}\n` +
        `💬 Comentarios: ${form.comentarios || 'Sin comentarios'}`
    );
  };

  return (
    <>
      <div className={`drawer-overlay${isOpen ? ' open' : ''}`} onClick={closeCart} />
      <aside className={`drawer${isOpen ? ' open' : ''}`} aria-label="Tu carrito">
        <div className="drawer-head">
          <h2>Tu Carrito</h2>
          <button onClick={closeCart} aria-label="Cerrar">×</button>
        </div>

        <div className="drawer-body">
          <div className="stepper-label">Paso {step} de 3: {STEP_TITLES[step - 1]}</div>
          <div className="stepper-bar">
            <div className="stepper-fill" style={{ width: `${(step / 3) * 100}%` }} />
          </div>

          {step === 1 && (
            <>
              <div className="summary">
                <div className="summary-stats">
                  <span>✔ {items.length} productos</span>
                  <span>✔ {totalUnidades} unidades</span>
                </div>
                {items.length === 0 ? (
                  <div className="cart-empty">Aún no agregaste productos.</div>
                ) : (
                  items.map((item, i) => (
                    <div className="cart-item" key={`${item.id}-${item.titulo}`}>
                      <span className="name">• {item.titulo}</span>
                      <div className="qty-row">
                        <input
                          type="number" min="1" className="qty-input" value={item.cantidad}
                          onChange={(e) => setCantidad(i, parseInt(e.target.value) || 1)}
                        />
                        <span style={{ fontSize: 11, color: 'var(--ink-45)' }}>uds</span>
                        <button className="qty-del" onClick={() => removeItem(i)} aria-label="Quitar">✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="trust">
                <div>✔ Producción flexible desde 10 unidades</div>
                <div>✔ Asesoramiento personalizado in-house</div>
                <div>✔ Envíos garantizados a todo el país</div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="field">
                <label>Nombre y Apellido *</label>
                <input type="text" value={form.nombre} onChange={set('nombre')} placeholder="Ej: Camila Rodríguez" />
              </div>
              <div className="field">
                <label>Empresa / Marca</label>
                <input type="text" value={form.empresa} onChange={set('empresa')} placeholder="Opcional" />
              </div>
              <input
                type="text" className="hp-field" tabIndex={-1} autoComplete="off"
                aria-hidden="true" value={form.website} onChange={set('website')}
              />
              <div className="field">
                <label>Objetivo del Proyecto</label>
                <div className="chips">
                  {OBJETIVOS.map((o) => (
                    <button key={o} className={`chip${form.objetivo === o ? ' selected' : ''}`} onClick={() => pick('objetivo')(o)}>{o}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="field">
                <label>Fecha Estimada de Entrega</label>
                <input type="date" id="b_fecha" value={form.fecha} onChange={set('fecha')} />
              </div>
              <div className="field">
                <label>Lugar de Entrega</label>
                <input type="text" value={form.lugar} onChange={set('lugar')} placeholder="Ej: CABA" />
              </div>
              <div className="field">
                <label>¿Ya contás con diseño?</label>
                <div className="chips">
                  {DISENO.map((d) => (
                    <button key={d} className={`chip${form.diseno === d ? ' selected' : ''}`} onClick={() => pick('diseno')(d)}>{d}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Comentarios adicionales</label>
                <textarea rows="3" value={form.comentarios} onChange={set('comentarios')} placeholder="Detalles de colores, talles o telas..." />
              </div>
            </>
          )}
        </div>

        <div className="drawer-foot">
          {step === 1 && <button className="btn btn--primary" onClick={() => goTo(2)}>Continuar</button>}
          {step === 2 && (
            <div className="row">
              <button className="btn btn--ghost" onClick={() => goTo(1)}>Atrás</button>
              <button className="btn btn--primary" onClick={() => goTo(3)}>Siguiente</button>
            </div>
          )}
          {step === 3 && (
            <>
              <label className="consent-check">
                <input
                  type="checkbox" checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  Acepto el tratamiento de mis datos personales (Ley 25.326)
                  para que AIRO responda esta solicitud.
                </span>
              </label>
              <div className="row">
                <button className="btn btn--ghost" onClick={() => goTo(2)}>Atrás</button>
                <button className="btn btn--success" onClick={enviar}>Solicitar Cotización</button>
              </div>
              <p className="disclaimer">🔒 Un asesor de AIRO revisará tu proyecto.</p>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
