// Datos sensibles ofuscados en Base64 (anti-scrapers). No exponer en claro en el repo.
const P1 = 'NTQ5MTE2';
const P2 = 'MzU1MzQ0Mw==';
const E1 = 'YWlyb2NvbG9ybGFi';
const E2 = 'QGdtYWlsLmNvbQ==';

export const phone = () => atob(P1 + P2);
export const mail = () => atob(E1 + E2);

// Devuelve la URL generada (o null si el popup fue bloqueado) — la UI decide
// qué mostrar. Nunca se abre automáticamente durante un envío async; solo
// responde a un click humano explícito.
export function openWhatsApp(message) {
  const url = `https://wa.me/${phone()}?text=${encodeURIComponent(message)}`;
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  return w ? url : null;
}

// Arma el mensaje de WhatsApp: solo incluye los datos realmente cargados
// (sin ruido de "No especificado") y formato limpio con *negrita* de WA.
export function buildQuoteMessage({ intro = 'Hola AIRO, quiero cotizar un proyecto.', items = [], contacto = {}, proyecto = {} }) {
  const parts = [intro];
  if (items.length) {
    parts.push(`\n*PEDIDO*\n${items.map((i) => `• ${i.cantidad}× ${i.titulo}`).join('\n')}`);
  }
  const block = (title, entries) => {
    const rows = Object.entries(entries).filter(([, v]) => v && String(v).trim());
    if (rows.length) {
      parts.push(`\n*${title}*\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}`);
    }
  };
  block('CONTACTO', contacto);
  block('PROYECTO', proyecto);
  return parts.join('\n');
}
