(function (w, d, s, l, i) {
  // GTM se carga SOLO con consentimiento de cookies (Ley 25.326 / buenas prácticas).
  // CookieConsent llama a w.__loadGTM() cuando el usuario acepta.
  w.__loadGTM = function () {
    if (w.__gtmLoaded) return;
    w.__gtmLoaded = true;
    w[l] = w[l] || [];
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var f = d.getElementsByTagName(s)[0],
      j = d.createElement(s),
      dl = l !== 'dataLayer' ? '&l=' + l : '';
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
    f.parentNode.insertBefore(j, f);
  };
  try {
    if (localStorage.getItem('airo_cookie_consent') === 'accepted') w.__loadGTM();
  } catch (e) { /* storage bloqueado: no cargar GTM sin consentimiento */ }
})(window, document, 'script', 'dataLayer', 'GTM-PSPJ7DSX');
