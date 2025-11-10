# 🤖 Jarvis - WhatsApp AI Bot

Bot inteligente para WhatsApp com integração ao Google Calendar, geração de imagens, Magistério Católico e IA avançada (Groq GPT OSS 120b).

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Deploy](https://img.shields.io/badge/Deploy-Railway%20%7C%20Fly.io-purple.svg)](DEPLOY.md)

## 🚀 Configuração

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto:

```env
# Configurações da API Gemini
GEMINI_API_KEY=sua_chave_api_gemini_aqui

# Número do WhatsApp (formato: código_país + número + @c.us)
WHATSAPP_NUMBER=559184527196@c.us

# Configurações de fuso horário
TZ=America/Sao_Paulo
```

### 3. Configurar Google Calendar
1. Crie um projeto no Google Cloud Console
2. Ative a API do Google Calendar
3. Crie uma conta de serviço
4. Baixe o arquivo `credentials.json` e coloque na raiz do projeto
5. Compartilhe seu calendário com o email da conta de serviço

### 4. Executar o bot
```bash
npm start
```

## ✨ Funcionalidades

### 🧠 Inteligência Artificial
- **Groq GPT OSS 120b**: Modelo de linguagem avançado (120B parâmetros)
- **Conversação natural**: Responde em português do Brasil
- **Contexto inteligente**: Mantém histórico de conversas

### 🎨 Geração de Imagens
- **Pollinations.AI**: Geração ilimitada e gratuita
- **5 modelos**: flux, flux-realism, flux-anime, flux-3d, turbo
- **Seleção automática**: IA escolhe o melhor modelo para cada pedido
- **Alta qualidade**: Envio em HD ou como documento

### ⛪ Magistério Católico
- **Magisterium AI**: Especialista em doutrina católica
- **Respostas precisas**: Baseadas no Catecismo e documentos oficiais
- **Formatação inteligente**: Respostas otimizadas para WhatsApp

### 📅 Google Calendar
- **Agendamento inteligente**: Linguagem natural para criar eventos
- **Consulta de agenda**: Hoje, amanhã, semana, mês
- **Eventos múltiplos dias**: Suporte automático
- **Lembretes**: Notificações antes dos eventos

### 🎥 Outras Funcionalidades
- **Resumo de vídeos**: YouTube Transcript + IA
- **Processamento de imagens**: Análise e descrição
- **Comandos úteis**: /today, /tomorrow, /week, /resumir

## 💬 Como Usar

### Conversação Natural
```
Você: Olá, como você está?
Jarvis: Olá! Estou bem...

Você: Me envie uma imagem de um bispo
Jarvis: [Gera imagem automaticamente]

Você: O que é a eucaristia?
Jarvis: [Consulta Magisterium AI]

Você: Adicionar reunião hoje às 15h
Jarvis: [Cria evento no calendário]
```

### Comandos Específicos
- `/today` - Eventos de hoje
- `/tomorrow` - Eventos de amanhã  
- `/week` - Eventos da semana
- `/month` - Eventos do mês
- `/resumir URL` - Resumir vídeo do YouTube
- `/limpar` - Limpar histórico da conversa
- `envie como documento` - Reenvia última imagem em documento

## 📁 Estrutura do Projeto

```
src/
├── index.js                    # Arquivo principal
├── config/
│   └── index.js               # Configurações gerais
├── services/
│   ├── bot/
│   │   ├── whatsapp.js        # Cliente WhatsApp
│   │   └── message-handler.js # Roteamento de mensagens
│   ├── api/
│   │   ├── groq.js            # IA principal (GPT OSS 120b)
│   │   ├── gemini.js          # IA auxiliar
│   │   ├── calendar.js        # Google Calendar
│   │   ├── image-generator.js # Geração de imagens
│   │   └── youtube.js         # Resumo de vídeos
│   ├── magisterium.js         # Magistério Católico
│   ├── reminders.js           # Sistema de lembretes
│   └── chat-history.js        # Histórico de conversas
└── utils/
    ├── logger.js              # Sistema de logs
    ├── cache.js               # Cache de dados
    └── validator.js           # Validações
```

## 🚀 Deploy em Nuvem

Este projeto está **pronto para deploy** em várias plataformas:

### Recomendado: Railway.app ⭐
- $5/mês crédito gratuito
- Deploy automático do GitHub
- **[Guia Rápido](QUICKSTART.md)**

### Alternativas:
- **Fly.io**: 100% gratuito (3 VMs)
- **Render**: Gratuito com sleep
- **DigitalOcean**: $200 crédito inicial
- **Google Cloud Run**: Pay-as-you-go

**📖 Documentação completa:** [DEPLOY.md](DEPLOY.md)

---

## 🔐 Segurança

- ✅ `.env` e `credentials.json` protegidos no `.gitignore`
- ✅ Suporte a variáveis de ambiente para deploy
- ✅ Logs não expõem informações sensíveis

**📖 Boas práticas:** [SECURITY.md](SECURITY.md)

---

## 🛠️ Tecnologias

- **Node.js** 18.x
- **whatsapp-web.js** - Cliente WhatsApp
- **Groq API** - GPT OSS 120b (IA principal)
- **Pollinations.AI** - Geração de imagens
- **Magisterium AI** - Doutrina católica
- **Google Calendar API** - Agenda
- **YouTube Transcript** - Resumo de vídeos

---

## 📚 Documentação

- [DEPLOY.md](DEPLOY.md) - Guia completo de deploy
- [QUICKSTART.md](QUICKSTART.md) - Deploy em 5 minutos
- [CREDENTIALS.md](CREDENTIALS.md) - Google Calendar setup
- [SECURITY.md](SECURITY.md) - Segurança e boas práticas
- [DEPLOY_SUMMARY.md](DEPLOY_SUMMARY.md) - Resumo executivo

---

## ⚠️ Troubleshooting

### QR Code não aparece
- Aguarde 1-2 minutos para inicialização completa
- Verifique se todas as variáveis de ambiente estão corretas

### Erro de autenticação Google
- Certifique-se de que `credentials.json` existe ou `GOOGLE_CREDENTIALS` está configurada
- Compartilhe o calendário com o email da Service Account

### Imagens não são geradas
- Verifique se `GROQ_API_KEY` está configurada corretamente
- Pollinations.AI não requer chave

### Bot desconecta frequentemente
- Use plataforma com volume persistente (Railway, Fly.io)
- Certifique-se de que `.wwebjs_auth/` persiste entre restarts

---

## 📝 Changelog

### v2.0.0 (Atual)
- ✅ Migração de Gemini para Groq (GPT OSS 120b)
- ✅ Sistema de cache para imagens (5 minutos)
- ✅ Suporte a "enviar como documento"
- ✅ Mensagens de feedback imediatas
- ✅ Suporte a deploy em nuvem
- ✅ GOOGLE_CREDENTIALS via variável de ambiente

### v1.0.0
- Versão inicial com Gemini
- Google Calendar integration
- Geração de imagens com Hugging Face

---

## 👤 Autor

**Geovanni Honorato**

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

---

## ⭐ Suporte

Se este projeto foi útil, considere dar uma estrela! ⭐ 