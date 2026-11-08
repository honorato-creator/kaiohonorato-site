/* Ponte entre o chat do site e a Iris no n8n.
   O navegador fala só com /api/iris (mesmo domínio, então a CSP do site continua valendo);
   a URL do webhook e o segredo ficam nas variáveis de ambiente da Netlify, nunca no código.

   Variáveis na Netlify (Site configuration > Environment variables):
     IRIS_WEBHOOK_URL     URL de produção do Webhook do fluxo da Iris no n8n
     IRIS_WEBHOOK_SECRET  valor do cabeçalho X-Iris-Key (Header Auth no nó Webhook)
*/

const MAX_LEN = 600;          // tamanho máximo da mensagem do visitante
const TIMEOUT_MS = 9000;      // a Netlify encerra funções síncronas em ~10 s
const WINDOW_MS = 60_000, MAX_PER_WINDOW = 12; // limite por visitante: 12 mensagens por minuto
const hits = new Map();       // memória da instância (proteção básica contra abuso)

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

/* o n8n pode responder em formatos diferentes: aceita os mais comuns */
function pickReply(data) {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return pickReply(data[0]);
  if (data && typeof data === 'object') {
    for (const k of ['reply', 'output', 'text', 'message', 'resposta']) {
      if (typeof data[k] === 'string') return data[k];
    }
    if (data.json) return pickReply(data.json);
  }
  return '';
}

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const url = process.env.IRIS_WEBHOOK_URL;
  if (!url) return json({ error: 'not_configured' }, 503);

  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'anon';
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) return json({ error: 'rate_limited' }, 429);
  list.push(now); hits.set(ip, list);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const message = String(body?.message || '').trim().slice(0, MAX_LEN);
  const sessionId = String(body?.sessionId || '').replace(/[^\w-]/g, '').slice(0, 64);
  const segmento = String(body?.segmento || '').slice(0, 60);
  if (!message || !sessionId) return json({ error: 'missing_fields' }, 400);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.IRIS_WEBHOOK_SECRET ? { 'X-Iris-Key': process.env.IRIS_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({ message, sessionId, segmento, origem: 'site' }),
    });
    if (!r.ok) return json({ error: 'upstream', status: r.status }, 502);
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('json') ? await r.json() : await r.text();
    const reply = pickReply(data).trim().slice(0, 2000);
    if (!reply) return json({ error: 'empty_reply' }, 502);
    return json({ reply });
  } catch (e) {
    return json({ error: e.name === 'AbortError' ? 'timeout' : 'upstream_unreachable' }, 504);
  } finally {
    clearTimeout(timer);
  }
};

export const config = { path: '/api/iris' };
