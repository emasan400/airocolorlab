import { useEffect, useState } from 'react';
import { mail, openWhatsApp, buildQuoteMessage } from '../lib/secure';
import { postLead } from '../lib/leads';
import { trackQuoteEvent } from '../lib/analytics';
import { Reveal } from '../hooks/useReveal';

const OBJETIVOS = ['Evento', 'Merchandising', 'Uniformes', 'Regalos'];
const DISENO = ['Sí, lo tengo', 'No', 'Necesito ayuda'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_DRAFT_KEY = 'airo_contact_draft_v1';
const EMPTY_FORM = {
  nombre: '', empresa: '', whatsapp: '', email: '', ciudad: '', fecha: '',
  objetivo: '', diseno: '', mensaje: '', website: '',
};
const loadDraft = () => {
  try { return { ...EMPTY_FORM, ...(JSON.parse(localStorage.getItem(CONTACT_DRAFT_KEY)) || {}) }; }
  catch { return EMPTY_FORM; }
};

export default function Contact() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null); // {ack, snapshot:{form}} — snapshot inmutable
  const [sendErr, setSendErr] = useState(null);
  const [form, setForm] = useState(loadDraft);
  // si el form cambia tras el ack, la referencia queda histórica — no se reusa
  const sentStale = !!sent && JSON.stringify(form) !== JSON.stringify(sent.snapshot.form);
  const activeSent = sent && !sentStale ? sent : null;

  useEffect(() => {
    setEmail(mail());
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('c_fecha')?.setAttribute('min', hoy);
  }, []);

  // Borrador local persistente — nunca se limpia solo.
  useEffect(() => {
    try { localStorage.setItem(CONTACT_DRAFT_KEY, JSON.stringify(form)); } catch { /* quota */ }
  }, [form]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const pick = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const waMessage = () =>
    buildQuoteMessage({
      intro: 'Hola AIRO, quiero hacer una consulta.',
      contacto: {
        Nombre: form.nombre,
        Empresa: form.empresa,
        WhatsApp: form.whatsapp,
        Email: form.email,
        Ciudad: form.ciudad,
      },
      proyecto: {
        Objetivo: form.objetivo,
        'Fecha estimada': form.fecha,
        'Diseño': form.diseno,
        Mensaje: form.mensaje,
        ...(activeSent ? { Referencia: activeSent.ack.request_id } : {}),
      },
    });
  const snapMessage = () =>
    buildQuoteMessage({
      intro: 'Hola AIRO, quiero hacer una consulta.',
      contacto: {
        Nombre: sent.snapshot.form.nombre,
        Empresa: sent.snapshot.form.empresa,
        WhatsApp: sent.snapshot.form.whatsapp,
        Email: sent.snapshot.form.email,
        Ciudad: sent.snapshot.form.ciudad,
      },
      proyecto: {
        Objetivo: sent.snapshot.form.objetivo,
        'Fecha estimada': sent.snapshot.form.fecha,
        'Diseño': sent.snapshot.form.diseno,
        Mensaje: sent.snapshot.form.mensaje,
        Referencia: sent.ack.request_id,
      },
    });

  const enviar = async () => {
    if (form.website || sending) return; // honeypot + doble-click
    const e = {};
    if (!form.nombre.trim()) e.nombre = 'Ingresá tu nombre.';
    const phoneOk = form.whatsapp.replace(/\D/g, '').length >= 8;
    const emailOk = EMAIL_RE.test(form.email.trim());
    if (!phoneOk && !emailOk)
      e.contact = 'Dejanos un WhatsApp (mín. 8 dígitos) o un email válido.';
    else {
      if (form.whatsapp.trim() && !phoneOk) e.whatsapp = 'Revisá el número (mínimo 8 dígitos).';
      if (form.email.trim() && !emailOk) e.email = 'Revisá el formato del email.';
    }
    if (!consent) e.consent = 'Necesitamos tu consentimiento para tratar tus datos.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSending(true);
    setSendErr(null);
    trackQuoteEvent('quote_submit_attempt', {});
    try {
      const ack = await postLead({
        origen: 'Contacto',
        nombre: form.nombre,
        empresa: form.empresa,
        whatsapp: form.whatsapp,
        email: form.email,
        ciudad: form.ciudad,
        fecha_estimada: form.fecha,
        objetivo: form.objetivo,
        diseno: form.diseno,
        comentarios: form.mensaje,
        website: form.website,
        carrito: 'No aplica',
        items: [],
        consent: true,
      });
      setSent({ ack, snapshot: { form: { ...form } } });
      trackQuoteEvent('quote_submit_accepted', { demo: ack.demo === true });
    } catch (err) {
      setSendErr(err?.error || 'No se confirmó el guardado de la consulta.');
      trackQuoteEvent('quote_submit_failed', { http_status: err?.status || 0 });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="section section--neutral" id="contacto">
      <div className="container">
        <div className="contact-grid">
          <Reveal className="contact-info">
            <span className="ed-index">05</span>
            <div className="section-eyebrow">Contacto</div>
            <h2 className="display">Hablemos<em>.</em></h2>
            <p>
              Contanos sobre tu proyecto. Nuestro estudio armará una propuesta a
              medida para tu marca.
            </p>

            <div className="contact-lines">
              <div className="contact-line">
                <span className="k">Email directo</span>
                <a href={email ? `mailto:${email}` : '#contacto'}>{email || 'Cargando...'}</a>
              </div>
              <div className="contact-line">
                <span className="k">Ubicación</span>
                <a href="https://maps.google.com/?q=Buenos+Aires,+Argentina" target="_blank" rel="noreferrer">
                  CABA, Buenos Aires<small>Lun a Vie · 09:00–18:00</small>
                </a>
              </div>
              <div className="contact-line">
                <span className="k">Instagram</span>
                <a href="https://www.instagram.com/airocolorlab/" target="_blank" rel="noreferrer">@airocolorlab</a>
              </div>
            </div>

            <div className="contact-trust">
              <h4>¿Por qué AIRO Color Lab?</h4>
              <div>✔ Producción flexible desde 10 unidades</div>
              <div>✔ Asesoramiento personalizado in-house</div>
              <div>✔ Respuesta en menos de 24 hs hábiles</div>
            </div>
          </Reveal>

          <Reveal delay={120} className="contact-form">
            <form onSubmit={(e) => { e.preventDefault(); enviar(); }} noValidate>
            <div className="form-row">
              <div className="field">
                <label htmlFor="c_nombre">Nombre *</label>
                <input id="c_nombre" type="text" value={form.nombre} onChange={set('nombre')} autoComplete="name" required aria-invalid={!!errors.nombre} />
                {errors.nombre && <p className="field-error" role="alert">{errors.nombre}</p>}
              </div>
              <div className="field">
                <label htmlFor="c_empresa">Empresa / Marca</label>
                <input id="c_empresa" type="text" value={form.empresa} onChange={set('empresa')} autoComplete="organization" />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="c_whatsapp">WhatsApp *</label>
                <input id="c_whatsapp" type="tel" value={form.whatsapp} onChange={set('whatsapp')} autoComplete="tel" inputMode="tel" aria-invalid={!!(errors.whatsapp || errors.contact)} />
                {errors.whatsapp && <p className="field-error" role="alert">{errors.whatsapp}</p>}
              </div>
              <div className="field">
                <label htmlFor="c_email">Email</label>
                <input id="c_email" type="email" value={form.email} onChange={set('email')} autoComplete="email" inputMode="email" aria-invalid={!!errors.email} />
                <small className="field-hint">Uno de los dos: WhatsApp o email.</small>
                {errors.email && <p className="field-error" role="alert">{errors.email}</p>}
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="c_ciudad">Ciudad / Provincia</label>
                <input id="c_ciudad" type="text" value={form.ciudad} onChange={set('ciudad')} autoComplete="address-level2" />
              </div>
              <div className="field">
                <label htmlFor="c_fecha">Fecha estimada</label>
                <input type="date" id="c_fecha" value={form.fecha} onChange={set('fecha')} />
              </div>
            </div>

            <div className="field">
              <label id="c_objetivo_label">Objetivo del proyecto</label>
              <div className="chips" role="group" aria-labelledby="c_objetivo_label">
                {OBJETIVOS.map((o) => (
                  <button key={o} type="button" className={`chip${form.objetivo === o ? ' selected' : ''}`} aria-pressed={form.objetivo === o} onClick={() => pick('objetivo')(o)}>{o}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label id="c_diseno_label">¿Tenés diseño armado?</label>
              <div className="chips" role="group" aria-labelledby="c_diseno_label">
                {DISENO.map((d) => (
                  <button key={d} type="button" className={`chip${form.diseno === d ? ' selected' : ''}`} aria-pressed={form.diseno === d} onClick={() => pick('diseno')(d)}>{d}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="c_mensaje">Comentarios / Qué necesitás producir</label>
              <textarea id="c_mensaje" rows="3" value={form.mensaje} onChange={set('mensaje')} />
            </div>

            <input
              type="text" className="hp-field" tabIndex={-1} autoComplete="off"
              aria-hidden="true" value={form.website} onChange={set('website')}
            />
            <label className="consent-check">
              <input
                type="checkbox" checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                aria-invalid={!!errors.consent}
              />
              <span>
                Acepto el tratamiento de mis datos personales (Ley 25.326)
                para que AIRO Color Lab responda esta consulta.{' '}
                <a href="#/privacidad" target="_blank">Ver política de privacidad</a>.
              </span>
            </label>
            {errors.consent && <p className="field-error" role="alert">{errors.consent}</p>}
            {errors.contact && <p className="field-error" role="alert">{errors.contact}</p>}

            {activeSent ? (
              <div className="q-success" role="status">
                <h3>{activeSent.ack.demo ? 'Solicitud de prueba guardada' : 'Guardamos tu consulta'}</h3>
                <p>
                  Referencia: <code>{activeSent.ack.request_id}</code>
                  {' '}— abrí WhatsApp para continuar; el mensaje lo enviás vos.
                  Un asesor de AIRO te responde en menos de 24 hs hábiles.
                </p>
                <button type="button" className="btn btn--success" onClick={() => { trackQuoteEvent('whatsapp_open_intent', {}); openWhatsApp(snapMessage()); }}>
                  Abrir WhatsApp
                </button>
              </div>
            ) : (
              <>
                {sent && sentStale && (
                  <div className="q-review" role="status">
                    Tus datos cambiaron desde la solicitud guardada (ref. <code>{sent.ack.request_id}</code>) —
                    ese número corresponde a la versión anterior.
                  </div>
                )}
                {sendErr && (
                  <div className="q-error" role="alert">
                    <b>No se confirmó el envío.</b> {sendErr} Tus datos siguen acá —
                    reintentá o escribinos por WhatsApp.
                    <div className="row" style={{ marginTop: 10 }}>
                      <button type="button" className="btn btn--ghost" onClick={() => { trackQuoteEvent('whatsapp_open_intent', {}); openWhatsApp(waMessage()); }}>
                        WhatsApp manual
                      </button>
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  className="btn btn--primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={sending}
                >
                  {sending ? 'Enviando…' : 'Solicitar Cotización'}
                </button>
              </>
            )}
            <p className="privacy">🔒 Tus datos únicamente serán utilizados para responder esta consulta.</p>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
