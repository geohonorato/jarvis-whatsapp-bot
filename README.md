# 🤖 Jarvis WhatsApp Bot

Assistente pessoal inteligente para WhatsApp com múltiplas IAs, geração de imagens, controle financeiro, agenda, execução de código e automações — tudo direto pelo chat.

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production-brightgreen.svg)]()

---

## ✨ Funcionalidades

### 🧠 IA Multimodal
- **Groq** — Raciocínio principal (GPT-OSS/LLaMA)
- **Google Gemini** — Análise de imagens, áudio e visão computacional
- **Magisterium AI** — Q&A sobre doutrina católica com fontes oficiais
- **Perplexity** — Pesquisa web em tempo real
- **RAG (Retrieval-Augmented Generation)** — Memória de longo prazo offline com Transformers.js

### 🎨 Geração de Imagens
```
Você: "crie uma imagem de um pôr do sol na praia"
Bot:  🎨 Imagem gerada com Flux-2-Klein-9b (1:1)
      [imagem anexada]
```
- **Cloudflare Workers AI** — Flux-2-Klein-9b (primário) + Flux-1-Schnell (fallback)
- **Google Gemini** — Nano Banana como fallback final
- Prompt enhancement automático (PT→EN + safety-aware via Groq)
- Suporte a aspect ratios: `1:1`, `16:9`, `9:16`, `3:2`, `4:3`, etc.

### 💰 Controle Financeiro
```
Você: "gastei 50 reais no almoço"
Bot:  💸 Registrado! -R$ 50,00 (Alimentação)
      📊 Saldo: R$ 1.450,00 | Gasto: R$ 550,00/R$ 2.000,00

Você: "resumo financeiro"
Bot:  📊 [relatório com gráficos por categoria]
```
- Registro de despesas e receitas via linguagem natural
- Categorização automática inteligente
- Análise de necessidade (score 0-100)
- Orçamento mensal e por categoria
- Transações recorrentes
- Exportação CSV e comparações mensais
- 📅 **Job mensal automático** — No dia 1 de cada mês às 9h, o bot pede extrato e fatura para análise

### 📄 Análise de Documentos (PDF)
```
Você: [envia fatura-nubank-jan.pdf]
Bot:  📄 Analisando fatura-nubank-jan.pdf (1.2MB)...
      📊 RESUMO: Total R$ 2.340,00
      📂 Alimentação: R$ 890 (38%)
      📂 Assinaturas: R$ 210 (9%)
      💡 Dicas: reduzir delivery em 30% economiza R$ 267/mês
```
- Leitura nativa de PDFs e planilhas via Gemini Vision
- Detecta automaticamente extratos e faturas bancárias
- Análise financeira completa: categorias, top gastos, recorrências, alertas
- Dicas de economia personalizadas
- Limite: ~19MB por documento

### 📅 Google Calendar
```
/add evento Reunião amanhã 14h
/list          → Listar eventos
/today         → Eventos de hoje
/tomorrow      → Eventos de amanhã
/week          → Eventos da semana
/delete        → Remover evento
```
- Integração via Service Account (sem OAuth)
- Lembretes automáticos antes de eventos
- Notificações Pascom programadas

### 🐍 Interpretador Python
```
Você: "faça um gráfico de barras com vendas por mês"
Bot:  [executa Python + envia gráfico matplotlib]
```
- Execução segura com timeout de 30s
- Detecção automática de gráficos matplotlib → envio como imagem
- Suporte a qualquer biblioteca Python instalada

### 🕷️ Crawler de Preços
```
Você: "monitora esse produto: [URL] alvo R$ 200"
Bot:  ✅ Monitorando! Vou avisar quando cair para R$ 200

[30 min depois]
Bot:  🚨 ALERTA DE PREÇO! Caiu para R$ 189,90!
```
- Monitoramento automático a cada 30 minutos
- Extração agnóstica de preços (meta tags, seletores comuns)
- Suporte a Mercado Livre, Kabum, Amazon e outros

### 🎬 YouTube
```
/resumir https://www.youtube.com/watch?v=xxx
```
- Transcrição automática de vídeos
- Resumo inteligente do conteúdo

### 📸 Processamento de Mídia
- **Imagens** → Análise via Gemini Vision (describe, OCR, contexto)
- **Áudios/PTT** → Transcrição automática para texto
- **PDFs** → Análise de documentos e extratos financeiros
- **Vídeos** → Download e conversão com FFmpeg

### ❄️ Controle de Ar-Condicionado
- Controle remoto via internet (API web)
- Ajuste de temperatura, modo, ventilação e swing
- Status em tempo real de múltiplas unidades

### ⛪ Magisterium AI
```
Você: "qual é a posição da Igreja sobre eutanásia?"
Bot:  ⛪ [resposta fundamentada com referências do magistério]
```

---

## 🏗️ Arquitetura

```
src/
├── index.js                          # Entry point
├── config/
│   ├── index.js                      # Variáveis de ambiente
│   └── system-prompt.js              # Personalidade do Jarvis
├── patches/
│   └── fix-sendseen.js               # Patch do whatsapp-web.js
├── services/
│   ├── api/
│   │   ├── groq.js                   # LLM principal (Groq)
│   │   ├── gemini.js                 # Visão + multimodal (Gemini)
│   │   ├── calendar.js               # Google Calendar API
│   │   ├── image-generator.js        # Cloudflare Flux + Nano Banana
│   │   └── youtube.js                # Transcrição YouTube
│   ├── bot/
│   │   ├── whatsapp.js               # Cliente WhatsApp
│   │   ├── whatsapp-auth-manager.js  # Gerenciamento de sessão
│   │   ├── message-handler.js        # Roteamento de mensagens
│   │   └── handlers/
│   │       ├── ac-handler.js         # Ar-condicionado
│   │       ├── calendar-handler.js   # Calendário
│   │       ├── finance-handler.js    # Finanças
│   │       ├── image-handler.js      # Geração de imagens
│   │       ├── magisterium-handler.js# Doutrina católica
│   │       ├── media-handler.js      # Imagens/áudio recebidos
│   │       └── youtube-handler.js    # Resumo de vídeos
│   ├── crawler/
│   │   ├── price-watcher.js          # Monitoramento de preços
│   │   └── watch-manager.js          # Persistência de watches
│   ├── interpreter/
│   │   └── python-executor.js        # Execução de código Python
│   ├── jobs/
│   │   ├── scheduler.js              # Agendador de tarefas
│   │   ├── monthly-finance-job.js    # Análise financeira mensal
│   │   └── pascom-notification.js    # Notificações Pascom
│   ├── media/
│   │   ├── converter.js              # Conversão de mídia (FFmpeg)
│   │   └── downloader.js             # Download de mídia
│   ├── activecampaign/
│   │   └── acService.js              # Controle AC via internet
│   ├── chat/
│   │   ├── chat-history.js           # Histórico de conversas
│   │   └── meeting-summary.js        # Resumo de atas/reuniões
│   ├── finance/
│   │   ├── finance-api.js            # API bancárias/dados
│   │   ├── finance-charts.js         # Geração de gráficos visuais
│   │   └── finance-tracker.js        # Lançamentos contábeis
│   ├── magisterium/
│   │   └── magisterium.js            # Doutrina e Q&A Católico
│   ├── rag/
│   │   └── rag-service.js            # Motor RAG com Transformers.js local
│   └── reminders/
│       └── reminders.js              # Lembretes processados em background
└── utils/
    ├── cache.js                      # Cache em memória
    ├── ffmpeg-path.js                # Detecção do FFmpeg
    ├── health-check.js               # Health endpoint (:3000)
    ├── image-processor.js            # Compressão de imagens
    ├── logger.js                     # Logging estruturado
    ├── message-queue.js              # Fila de mensagens
    ├── resilience.js                 # Retry + circuit breaker
    ├── temp-manager.js               # Limpeza de temporários
    └── validator.js                  # Validação de entrada
```

---

## 🚀 Quick Start

### 1. Pré-requisitos

- **Node.js 18+**
- **Python 3.8+** (opcional, para rodar interpretador de gráficos)
- **FFmpeg** (opcional, para extrair áudios/vídeos)

### 2. Instalação

```bash
git clone https://github.com/geohonorato/jarvis-whatsapp-bot.git
cd jarvis-whatsapp-bot
npm install
pip install matplotlib pandas seaborn # Opcional: Para gerar os gráficos Python
```

### 3. Configuração

Crie o arquivo `.env` na raiz:

```env
# === APIs Obrigatórias ===
GROQ_API_KEY=sua_chave_groq
GEMINI_API_KEY=sua_chave_gemini
WHATSAPP_NUMBER=559199999999@c.us

# === Geração de Imagens (Cloudflare) ===
CF_ACCOUNT_ID=seu_account_id
CF_API_TOKEN=seu_api_token

# === Google Calendar ===
CALENDAR_ID=seu@calendario.com
# + arquivo data/credentials.json (Service Account)

# === APIs Opcionais ===
MAGISTERIUM_API_KEY=sua_chave        # Doutrina católica
PERPLEXITY_API_KEY=sua_chave         # Pesquisa web

# === Config ===
MAX_HISTORY_MESSAGES=20
```

### 4. Execute

```bash
npm start
```

Escaneie o QR code que aparecerá no terminal para conectar ao WhatsApp.

---

## 🎮 Comandos

| Comando | Descrição |
|---------|-----------|
| `/imagem [texto]` | Gera imagem com IA |
| `/add evento [descrição]` | Cria evento no calendário |
| `/list` | Lista próximos eventos |
| `/today` `/tomorrow` `/week` | Eventos filtrados |
| `/delete` | Remove evento |
| `/resumir [URL YouTube]` | Resume vídeo |
| `/limpar` | Limpa histórico do chat |
| `ajuda` | Lista todos os comandos |

### Linguagem Natural (sem comando)
- `"gastei 30 no uber"` → Registra despesa
- `"recebi 2000 de salário"` → Registra receita
- `"resumo financeiro"` → Relatório mensal
- `"monitora [URL] alvo R$ 100"` → Crawler de preço
- Enviar **imagem** → Análise com Gemini Vision
- Enviar **áudio** → Transcrição automática
- Perguntas gerais → Resposta via Groq + RAG

---

## 🔌 Integrações

| Serviço | Uso | Tipo |
|---------|-----|------|
| **Groq** | LLM principal (raciocínio) | Obrigatório |
| **Google Gemini** | Visão, áudio, multimodal | Obrigatório |
| **Cloudflare Workers AI** | Geração de imagens (Flux) | Opcional |
| **Google Calendar** | Agenda e lembretes | Opcional |
| **Perplexity** | Pesquisa web real-time | Opcional |
| **Magisterium** | Doutrina católica | Opcional |
| **Transformers.js** | Motor RAG 100% nativo offline | Automático |
| **Python** | Interpretador + gráficos | Opcional |

---

## 🚢 Deploy

### OCI ARM (Oracle Cloud — Gratuito)

```bash
# Cloud-init automático
bash deploy/cloud-init-oci-arm.sh
```

Script `deploy/auto-update.sh` para atualizações automáticas via git pull.

### Manual (VPS qualquer)

```bash
# Clone, instale e configure .env
npm install --production
npm start
```

### Variáveis de Deploy

```env
GROQ_API_KEY=xxx
GEMINI_API_KEY=xxx
CF_ACCOUNT_ID=xxx
CF_API_TOKEN=xxx
CALENDAR_ID=xxx
WHATSAPP_NUMBER=xxx
NODE_ENV=production
TZ=America/Sao_Paulo
```

---

## 📊 Monitoramento

- **Health check**: `GET http://localhost:3000`
- **Heartbeat**: A cada 30s no console
- **Uptime e memória**: Monitorados automaticamente
- **Limpeza automática**: Temporários e histórico de chat

---

## 🔐 Segurança

- ✅ Credenciais em variáveis de ambiente (`.env`)
- ✅ Filtro de mensagens de newsletters/canais
- ✅ Validação e sanitização de entrada
- ✅ Timeout em execução de código Python (30s)
- ✅ Error handling robusto com circuit breaker
- ✅ Rate limiting na fila de mensagens
- ✅ Patch automático do `sendSeen` (whatsapp-web.js)

---

## 📦 Dependências Principais

| Pacote | Função |
|--------|--------|
| `whatsapp-web.js` | Cliente WhatsApp Web |
| `axios` | HTTP client |
| `googleapis` | Google Calendar API |
| `@google/generative-ai` | Gemini SDK |
| `cheerio` | Web scraping (crawler) |
| `@distube/ytdl-core` | Download YouTube |
| `fluent-ffmpeg` | Processamento de mídia |
| `magisterium` | Doutrina católica |
| `dotenv` | Variáveis de ambiente |
| `form-data` | Multipart requests (Flux-2) |

---

## 🤝 Contribuindo

1. Fork o repositório
2. Crie branch: `git checkout -b feature/sua-feature`
3. Commit: `git commit -m 'feat: descrição'`
4. Push: `git push origin feature/sua-feature`
5. Abra Pull Request

---

## 👤 Autor

**Geovanni Honorato**
- GitHub: [@geohonorato](https://github.com/geohonorato)
- Email: geohonorato234@gmail.com

---

## 📝 Licença

MIT License — veja [LICENSE](LICENSE)

---

**Status**: ✅ Production Ready
**Última Atualização**: Fev 2026
**Versão**: 1.0.0
