# Kaio Honorato · Desenvolvedor

Portfólio profissional do Kaio Honorato: sites, apps, landing pages, automações com n8n e agentes de IA, atendendo Santos e região.

Site: https://kaiohonorato.com.br

## O que é

Um site estático de apresentação com três páginas:

- **Início** (`index.html`): projetos que já construí, serviços, uma demonstração de conversa com um agente, montagem de proposta, sobre mim e contato.
- **Orçamento** (`orcamento/`): formulário para o cliente contar o que precisa.
- **Privacidade** (`privacidade/`): política de privacidade.

## Para que serve

- Mostrar o trabalho para quem procura sites, automações ou agentes de IA.
- Deixar o cliente ver na prática como um agente conversa, antes de contratar.
- Transformar visita em contato: formulários, proposta montada na página e botão direto para o WhatsApp.

## Engenharia

| Parte | Tecnologia |
|---|---|
| Páginas | HTML, CSS e JavaScript puros, sem framework e sem build |
| Formulários | Netlify Forms (`contato` e `orcamento`), com campo anti-spam escondido |
| Iris (agente) | Esfera de cristal em 3D com uma íris acesa dentro, feita em Three.js (`js/iris/iris-crystal.js`): o olho acompanha o visitante, a pupila abre quando ela ouve, a íris gira quando ela pensa e pulsa com a voz. Em aparelhos sem 3D, cai para um orbe em Canvas 2D (`iris-orb.js`). Inteligência no n8n e voz no ElevenLabs, via Netlify Functions (`netlify/functions/`) |
| Hospedagem | Netlify |
| Segurança | Arquivo `_headers` com Content-Security-Policy, X-Frame-Options, nosniff, Referrer-Policy e Permissions-Policy |
| Desempenho | Cache de 30 dias para imagens e ícones; páginas sempre revalidadas |
| SEO | Dados estruturados (JSON-LD), `sitemap.xml`, `robots.txt` e verificação do Google Search Console |

Não há chaves nem segredos no código: o navegador só fala com `/api/iris` e `/api/iris-voz`, e as chaves do n8n e do ElevenLabs ficam nas variáveis de ambiente da Netlify. Como configurar: [docs/iris.md](docs/iris.md).
