import { useEffect, useState } from 'react';

const KEY = 'airo_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setVisible(true);
  }, []);

  // El banner se oculta mientras haya un modal o drawer de cotización activo —
  // no debe tapar el flujo ni el CTA de conversión. Reaparece al cerrarse.
  useEffect(() => {
    const check = () =>
      setDeferred(!!document.querySelector('.modal-overlay.open, .drawer.open'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const decide = (value) => {
    localStorage.setItem(KEY, value);
    setVisible(false);
    if (value === 'accepted') window.__loadGTM?.();
  };

  if (!visible || deferred) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-live="polite" aria-label="Consentimiento de cookies">
      <p>
        Usamos cookies de analítica (Google Tag Manager) para mejorar el sitio.
        Podés aceptarlas o rechazarlas; el sitio funciona igual.{' '}
        <a href="#/privacidad">Política de privacidad</a>
      </p>
      <div className="cookie-actions">
        <button className="cookie-btn cookie-btn--ghost" onClick={() => decide('rejected')}>
          Rechazar
        </button>
        <button className="cookie-btn cookie-btn--accept" onClick={() => decide('accepted')}>
          Aceptar
        </button>
      </div>
    </div>
  );
}
