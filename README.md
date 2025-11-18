# 🤖 Jarvis WhatsApp Bot

Assistente inteligente para WhatsApp com suporte a múltiplas IAs, calendário, rastreamento de hidratação e geração de imagens.

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](Dockerfile)

---

## 🚀 Quick Start

### Instalação Rápida

```bash
# Clone e instale
git clone https://github.com/geohonorato/jarvis-whatsapp-bot.git
cd jarvis-whatsapp-bot
npm install

# Configure ambiente
cp .env.example .env
# Edite .env com suas credenciais

# Inicie
npm start
```

### Variáveis de Ambiente

```env
# APIs (obrigatórias)
GROQ_API_KEY=sua_chave_groq
GEMINI_API_KEY=sua_chave_gemini
WHATSAPP_NUMBER=55999999999

# APIs (opcionais)
MAGISTERIUM_API_KEY=sua_chave
GOOGLE_CREDENTIALS=base64_encoded_json
CALENDAR_ID=seu@calendario.com

# Config
NODE_ENV=production
TZ=America/Sao_Paulo
```

Veja `docs/CREDENTIALS.md` para instruções completas.

---

## 📚 Documentação

| Documento | Descrição |
|-----------|-----------|
| `docs/BOTTLE_QUICK_START.md` | Como registrar água em ml |
| `docs/BOTTLE_TRACKING.md` | Sistema completo de hidratação |
| `docs/HYDRATION_REMINDERS.md` | Lembretes adaptativos |
| `docs/HYDRATION_TIMELINE.md` | Exemplos de um dia |
| `docs/SECURITY.md` | Boas práticas de segurança |
| `docs/CREDENTIALS.md` | Configuração de credenciais |

---

## ✨ Funcionalidades

### 💧 Rastreamento de Hidratação

Registre consumo em ml direto:

```
Você: "bebi 250ml"
Bot:  💧 Registrado! +250ml
      Total: 250ml / 3000ml (8%)
      Faltam: 2750ml

Você: "troco 750"
Bot:  ✅ Garrafa atualizada para 750ml!
```

**Recursos:**
- ✅ Registra em ml direto
- ✅ Aceita diferentes garrafas
- ✅ Lembretes adaptativos por padrão
- ✅ Histórico de consumo
- ✅ Linguagem natural

### 📅 Google Calendar

Crie e consulte eventos:

```
/add evento Reunião amanhã 14h
/list - Listar eventos
/today - Eventos de hoje
/delete - Remover evento
```

### 🎨 Geração de Imagens

```
/imagem Uma montanha ao atardecer
```

Usa Pollinations.AI (gratuito e ilimitado).

### 🧠 Múltiplas IAs

- **Groq (GPT-OSS-120b)** - Raciocínio principal
- **Google Gemini** - Análise multimodal (imagens, áudio)
- **Magisterium AI** - Q&A doutrina católica

### ⛪ Magisterium AI

```
Você: "qual é a posição da Igreja sobre..."
Bot:  ⛪ [resposta fundamentada]
```

### 🎬 YouTube

```
/resumir https://www.youtube.com/watch?v=xxx
```

Transcreve e resume vídeos.

---

## 🏗️ Estrutura

```
.
├── src/
│   ├── index.js                  # Entry point
│   ├── services/
│   │   ├── api/                  # Integrações
│   │   │   ├── groq.js
│   │   │   ├── gemini.js
│   │   │   ├── calendar.js
│   │   │   ├── image-generator.js
│   │   │   └── youtube.js
│   │   ├── bot/
│   │   │   ├── whatsapp.js
│   │   │   └── message-handler.js
│   │   ├── hydration-bottle.js
│   │   ├── hydration-bottle-handlers.js
│   │   ├── hydration-reminders.js
│   │   ├── hydration-tracker.js
│   │   ├── magisterium.js
│   │   └── chat-history.js
│   └── utils/
│       ├── logger.js
│       ├── health-check.js
│       ├── resilience.js
│       └── validator.js
├── docs/                         # Documentação
├── scripts/                      # Utilitários
├── temp/                         # Cache
├── Dockerfile
├── .env.example
├── package.json
└── README.md
```

---

## 🔧 Instalação Detalhada

### 1. Pré-requisitos

- Node.js 18+
- npm ou yarn
- Docker (opcional, para deployment)

### 2. Clone e Configure

```bash
git clone https://github.com/geohonorato/jarvis-whatsapp-bot.git
cd jarvis-whatsapp-bot
npm install
```

### 3. Variáveis de Ambiente

```bash
cp .env.example .env
# Edite com suas chaves
```

### 4. Inicie

```bash
npm start
```

Abra seu navegador em `http://localhost:3000` para ver o QR code do WhatsApp.

---

## 🎮 Comandos Principais

### Hidratação

```
250ml              Registra 250ml
bebi 500           Registra 500ml
1L                 Registra 1 litro (1000ml)
troco 750          Troca garrafa para 750ml
status             Mostra progresso
relatório          Mostra análise
/pausar            Pausa lembretes
/retomar           Retoma lembretes
```

### Calendário

```
/add evento ...    Criar evento
/list              Listar eventos
/today             Eventos hoje
/tomorrow          Eventos amanhã
/week              Eventos semana
/delete            Remover evento
```

### Geral

```
/resumir [URL]     Resumir vídeo YouTube
/imagem texto      Gerar imagem
/limpar            Limpar histórico
ajuda              Listar comandos
```

---

## 🚀 Deployment

### DigitalOcean (Recomendado)

```bash
# Push para GitHub ativa auto-deploy
git push origin main
```

### Docker

```bash
docker build -t jarvis-bot .
docker run -e GROQ_API_KEY=xxx -e GEMINI_API_KEY=xxx jarvis-bot
```

### Variáveis de Deploy

Adicione no painel do provedor:
- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_CREDENTIALS`
- `MAGISTERIUM_API_KEY`
- `CALENDAR_ID`
- `WHATSAPP_NUMBER`
- `NODE_ENV=production`
- `TZ=America/Sao_Paulo`

---

## 📊 Monitoramento

- Health check: `GET http://localhost:3000`
- Logs estruturados em stdout
- Heartbeat a cada 30s
- Métricas de uptime

---

## 🔐 Segurança

- ✅ Credenciais em variáveis de ambiente
- ✅ Sem hardcoding de senhas
- ✅ Validação de entrada
- ✅ Sanitização de dados
- ✅ Error handling robusto

Veja `docs/SECURITY.md` para mais detalhes.

---

## 🧪 Testes

```bash
# Testes (em breve)
npm test
```

---

## 🆘 Troubleshooting

### Bot não conecta ao WhatsApp
1. Limpe cache: `npm run clean-cache`
2. Escaneie QR code novamente
3. Verifique WhatsApp Web no navegador

### Erro de credenciais
1. Veja `docs/CREDENTIALS.md`
2. Valide variáveis em `.env`
3. Codifique base64 se necessário

### Lembretes não funcionam
1. Comande `/status` para diagnosticar
2. Veja `docs/HYDRATION_REMINDERS.md`

### Imagens não geram
1. Verifique internet
2. Tente outro modelo: `/imagem [model] texto`

---

## 📦 Dependências Principais

- `whatsapp-web.js` - Cliente WhatsApp
- `@google-cloud/client-libraries` - Google APIs
- `axios` - HTTP client
- `dotenv` - Variáveis de ambiente
- `express` - Health server
- `puppeteer-core` - Headless browser

---

## 🤝 Contribuindo

1. Fork o repositório
2. Crie branch: `git checkout -b feature/sua-feature`
3. Commit: `git commit -m 'feat: descrição'`
4. Push: `git push origin feature/sua-feature`
5. Abra Pull Request

---

## 📝 Licença

MIT License - veja LICENSE.md

---

## 👤 Autor

**Geovanni Honorato**
- GitHub: [@geohonorato](https://github.com/geohonorato)
- Email: geovanni@example.com

---

## 🙏 Agradecimentos

- Groq pelo GPT-OSS
- Google pela Gemini API
- WhatsApp Web pelo protocolo reverso
- Comunidade Node.js

---

## 📞 Suporte

- 📧 [Issues no GitHub](https://github.com/geohonorato/jarvis-whatsapp-bot/issues)
- 💬 [Discussões](https://github.com/geohonorato/jarvis-whatsapp-bot/discussions)
- 📖 [Documentação](docs/)

---

**Status**: ✅ Production Ready  
**Última Atualização**: Nov 2025  
**Versão**: 1.0.0
