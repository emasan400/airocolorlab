// Datos sensibles ofuscados en Base64 (anti-scrapers). No exponer en claro en el repo.
const P1 = 'NTQ5MTE2';
const P2 = 'MzU1MzQ0Mw==';
const E1 = 'YWlyb2NvbG9ybGFi';
const E2 = 'QGdtYWlsLmNvbQ==';

export const phone = () => atob(P1 + P2);
export const mail = () => atob(E1 + E2);

export function openWhatsApp(message) {
  window.open(`https://wa.me/${phone()}?text=${encodeURIComponent(message)}`, '_blank');
}
