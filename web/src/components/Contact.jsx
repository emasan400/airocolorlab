import { useEffect, useState } from 'react';
import { mail, openWhatsApp } from '../lib/secure';
import { postLead } from '../lib/leads';
import { Reveal } from '../hooks/useReveal';

const OBJETIVOS = ['Evento', 'Merchandising', 'Uniformes', 'Regalos'];
const DISENO = ['Sí, lo tengo', 'No', 'Necesito ayuda'];

export default function Contact() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState({
    nombre: '', empresa: '', whatsapp: '', email: '', ciudad: '', fecha: '',
    objetivo: '', diseno: '', mensaje: '', website: '',
  });

  useEffect(() => {
    setEmail(mail());
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('c_fecha')?.setAttribute('min', hoy);
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const pick = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const enviar = () => {
    if (form.website) return; // honeypot: bots lo completan, humanos no lo ven
    if (!form.nombre.trim() || !form.whatsapp.trim()) {
      return alert('Por favor, ingresá tu Nombre y WhatsApp para ponernos en contacto.');
    }
    if (!consent) {
      return alert('Necesitamos tu consentimiento para tratar tus datos de contacto.');
    }

    postLead({
      origen: 'Contacto',
      nombre: form.nombre,
      empresa: form.empresa || '-',
      whatsapp: form.whatsapp,
      email: form.email || '-',
      ciudad: form.ciudad || '-',
      fecha_estimada: form.fecha || 'No especificada',
      objetivo: form.objetivo || '-',
      diseno: form.diseno || '-',
      comentarios: form.mensaje || '-',
      carrito: 'No aplica',
    });

    openWhatsApp(
      '¡Hola AIRO! Quiero iniciar una consulta.\n\n' +
        `👤 Nombre: *${form.nombre}*\n` +
        `🏢 Empresa: ${form.empresa || '-'}\n` +
        `📱 WhatsApp: ${form.whatsapp}\n` +
        `📧 Email: ${form.email || '-'}\n` +
        `📍 Ciudad: ${form.ciudad || '-'}\n` +
        `📅 Fecha Estimada: ${form.fecha || 'No especificada'}\n` +
        `🎯 Objetivo: ${form.objetivo || '-'}\n` +
        `🎨 Diseño: ${form.diseno || '-'}\n` +
        `💬 Mensaje: ${form.mensaje || '-'}`
    );
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
            <div className="form-row">
              <div className="field">
                <label htmlFor="c_nombre">Nombre *</label>
                <input id="c_nombre" type="text" value={form.nombre} onChange={set('nombre')} autoComplete="name" required />
              </div>
              <div className="field">
                <label htmlFor="c_empresa">Empresa / Marca</label>
                <input id="c_empresa" type="text" value={form.empresa} onChange={set('empresa')} autoComplete="organization" />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="c_whatsapp">WhatsApp *</label>
                <input id="c_whatsapp" type="tel" value={form.whatsapp} onChange={set('whatsapp')} autoComplete="tel" inputMode="tel" required />
              </div>
              <div className="field">
                <label htmlFor="c_email">Email *</label>
                <input id="c_email" type="email" value={form.email} onChange={set('email')} autoComplete="email" inputMode="email" required />
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
              />
              <span>
                Acepto el tratamiento de mis datos personales (Ley 25.326)
                para que AIRO Color Lab responda esta consulta.{' '}
                <a href="#/privacidad" target="_blank">Ver política de privacidad</a>.
              </span>
            </label>

            <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }} onClick={enviar}>
              Solicitar Cotización
            </button>
            <p className="privacy">🔒 Tus datos únicamente serán utilizados para responder esta consulta.</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
