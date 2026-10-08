const EVENTS = new Set([
  'quote_selection_started', 'quote_preview_saved', 'quote_submit_attempt',
  'quote_submit_accepted', 'quote_submit_failed', 'whatsapp_open_intent',
]);

// Quote consent does not authorize analytics. Never include contacts or artwork.
export function trackQuoteEvent(event, facts = {}, win = globalThis.window) {
  if (!win || !EVENTS.has(event) || facts.demo === true) return false;
  if (['localhost', '127.0.0.1', '::1'].includes(win.location?.hostname)) return false;
  try { if (win.localStorage.getItem('airo_cookie_consent') !== 'accepted') return false; }
  catch { return false; }
  const record = { event, feature_version: 'professional-v1' };
  if (Array.isArray(facts.product_ids)) record.product_ids = facts.product_ids
    .filter(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(id));
  for (const key of ['units', 'config_count', 'http_status']) {
    if (Number.isSafeInteger(facts[key]) && facts[key] >= 0) record[key] = facts[key];
  }
  win.dataLayer = win.dataLayer || [];
  win.dataLayer.push(record);
  return true;
}
