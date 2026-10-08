import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { handleQuotePost } from './server/quote-service.mjs'

// Adapter demo LOCAL — solo para desarrollo/preview (configureServer /
// configurePreviewServer). NUNCA se despliega: el handler api/quote.mjs
// usa el adapter Supabase. Escribe JSON sintético en AIRO_DEMO_QUOTE_DIR
// (fixture de verificación, no datos reales) con archivos exclusivos:
// mismo id+hash → ack duplicate; mismo id distinto hash → 409.
function demoAdapter(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return {
    demo: true,
    async save(request_id, payload, hash) {
      const file = path.join(dir, `quote-${request_id}.json`)
      try {
        fs.writeFileSync(file, JSON.stringify({ request_id, hash, demo: true, payload, saved_at: new Date().toISOString() }, null, 2) + '\n', { flag: 'wx' })
        return { accepted: true, request_id, duplicate: false, demo: true };
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        const prev = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (prev.hash === hash) return { accepted: true, request_id, duplicate: true, demo: true };
        return { conflict: true };
      }
    },
  };
}

function demoQuotePlugin() {
  const dir = process.env.AIRO_DEMO_QUOTE_DIR;
  if (!dir) return { name: 'airo-demo-quote-disabled' };
  const adapter = demoAdapter(dir);
  const register = (middlewares) => {
    middlewares.use('/api/quote', async (req, res) => {
      const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
      if (req.method !== 'POST') return send(405, { error: 'method not allowed' });
      const ct = req.headers['content-type'] || '';
      if (!ct.includes('application/json')) return send(400, { error: 'content-type debe ser application/json' });
      const origin = req.headers.origin;
      if (origin) {
        try { if (new URL(origin).host !== req.headers.host) return send(403, { error: 'origin inválido' }); }
        catch { return send(403, { error: 'origin inválido' }); }
      }
      let raw = '';
      req.on('data', (c) => { raw += c; if (raw.length > 2 * 1024 * 1024) req.destroy(); });
      req.on('end', async () => {
        const r = await handleQuotePost(raw, { adapter });
        send(r.status, r.body);
      });
    });
  };
  return {
    name: 'airo-demo-quote',
    configureServer: (s) => register(s.middlewares),
    configurePreviewServer: (s) => register(s.middlewares),
  };
}

export default defineConfig({
  plugins: [react(), demoQuotePlugin()],
})
