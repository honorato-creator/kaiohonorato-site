# Ligar o chat do site à Iris do n8n

```
Visitante → chat do site → /api/iris (função na Netlify) → Webhook da Iris no n8n → resposta → chat
```

A URL do n8n e a senha ficam guardadas na Netlify, nunca no código do site.
Se o n8n estiver fora do ar, o chat volta sozinho para as respostas de exemplo: a demonstração nunca quebra.

## 1. No n8n (no fluxo da Iris)

1. Adicione um nó **Webhook**:
   - **HTTP Method:** `POST`
   - **Path:** `iris-site`
   - **Authentication:** `Header Auth`. Crie a credencial com:
     - **Name:** `X-Iris-Key`
     - **Value:** uma senha longa que você inventar (ex.: 32 letras e números aleatórios)
   - **Respond:** `Using 'Respond to Webhook' Node`
2. Ligue o Webhook ao nó **AI Agent** da Iris e use estes campos:
   - **Mensagem do visitante:** `{{ $json.body.message }}`
   - **Memória** (Simple Memory / Window Buffer Memory), em *Session Key*: `{{ $json.body.sessionId }}`
     (cada visitante tem a própria conversa)
   - Opcional, no *System Message*, para a demonstração por tipo de negócio:
     `Nesta conversa do site, mostre como você atenderia {{ $json.body.segmento }}. Respostas curtas, até 3 frases.`
3. Depois do AI Agent, adicione **Respond to Webhook**:
   - **Respond With:** `JSON`
   - **Response Body:** `{ "reply": "{{ $json.output }}" }`
4. **Ative** o fluxo e copie a **Production URL** do Webhook (não a de teste).

A Iris precisa responder em menos de ~9 segundos (limite da Netlify). Respostas curtas ajudam.

## 2. Na Netlify

Em **Site configuration → Environment variables**, crie:

| Nome | Valor |
|---|---|
| `IRIS_WEBHOOK_URL` | a Production URL do Webhook |
| `IRIS_WEBHOOK_SECRET` | a mesma senha do Header Auth |

### Voz da Iris (ElevenLabs)

Crie também:

| Nome | Valor |
|---|---|
| `ELEVENLABS_API_KEY` | sua chave de API do ElevenLabs (*Settings → API Keys*) |

A voz já vem configurada (voz "IRIS", pt-BR). A voz só toca quando o visitante clica em **Ouvir a Iris**;
sem isso, ela fala só com o movimento da boca. Cada resposta gasta créditos do ElevenLabs
(no máximo 400 caracteres por resposta). Se os créditos acabarem, ela continua falando em silêncio.

Observação: no plano grátis do ElevenLabs, vozes da biblioteca podem não estar liberadas pela API.
Se a voz não tocar no site publicado, adicione a voz "IRIS" em *My Voices* ou verifique o seu plano.

## 3. Publicar

A função fica em `netlify/functions/iris.mjs` e responde em `/api/iris`.
Ela só funciona quando o site é publicado **pelo Git** (ou pela Netlify CLI): arrastar a pasta para a Netlify não ativa funções.

## Proteções que já estão no código

- Mensagens de até 600 caracteres.
- Limite de 12 mensagens por minuto por visitante.
- Tempo máximo de espera de 9 segundos.
- Se a Iris não responder, o chat usa as respostas de exemplo.
