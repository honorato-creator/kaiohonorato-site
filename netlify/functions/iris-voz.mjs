/* Voz da Iris: transforma o texto da resposta em áudio com a voz "IRIS" do ElevenLabs.
   A chave fica só na Netlify (variável ELEVENLABS_API_KEY); o navegador recebe apenas o áudio.

   Variáveis na Netlify:
     ELEVENLABS_API_KEY   sua chave de API do ElevenLabs (obrigatória)
     IRIS_VOICE_ID        opcional; padrão = voz "IRIS" (pt-BR) da biblioteca
     IRIS_VOICE_MODEL     opcional; padrão = eleven_flash_v2_5 (rápido e econômico)
*/

const DEFAULT_VOICE = 'dE4UHrF86QhrHso7ckyc';   // voz "IRIS" (biblioteca, pt-BR)
const FALLBACK_VOICE = 'XrExE9yKIg1WjnnlVkGX';  // voz feminina padrão do ElevenLabs, liberada no plano grátis
const MAX_CHARS = 400;                         // respostas longas são cortadas para poupar créditos
const WINDOW_MS = 60_000, MAX_PER_WINDOW = 10;  // por visitante
const hits = new Map();

const err = (code, status) => new Response(JSON.stringify({ error: code }), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export default async (req, context) => {
  if (req.method !== 'POST') return err('method', 405);
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return err('not_configured', 503);

  const ip = context?.ip || 'anon', now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) return err('rate_limited', 429);
  list.push(now); hits.set(ip, list);

  let body; try { body = await req.json(); } catch { return err('bad_json', 400); }
  let text = String(body?.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return err('missing_text', 400);
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS).replace(/\s+\S*$/, '') + '…';

  const voice = process.env.IRIS_VOICE_ID || DEFAULT_VOICE;
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 9000);
  const tts = v => fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v}?output_format=mp3_44100_64`, {
    method: 'POST', signal: ctrl.signal,
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: process.env.IRIS_VOICE_MODEL || 'eleven_flash_v2_5',
      language_code: 'pt',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
    }),
  });
  try {
    let r = await tts(voice), used = 'iris';
    // plano grátis não libera vozes da biblioteca pela API: cai para uma voz padrão do ElevenLabs
    if (r.status === 402 || r.status === 403) { r = await tts(process.env.IRIS_VOICE_FALLBACK || FALLBACK_VOICE); used = 'padrao'; }
    if (!r.ok) {
      let detail = ''; try { const j = await r.json(); detail = j?.detail?.code || j?.detail?.status || ''; } catch {}
      return new Response(JSON.stringify({ error: r.status === 401 ? 'bad_key' : r.status === 402 || r.status === 429 ? 'quota' : 'upstream', status: r.status, detail }),
        { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    return new Response(await r.arrayBuffer(), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Iris-Voz': used } });
  } catch (e) {
    return err(e.name === 'AbortError' ? 'timeout' : 'upstream_unreachable', 504);
  } finally { clearTimeout(timer); }
};

export const config = { path: '/api/iris-voz' };
