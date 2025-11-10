# 🚀 Quick Start - Deploy em 5 Minutos

## Railway.app (Mais Fácil) ⭐

### 1. Preparar o Repositório

```bash
# Certifique-se de que está no diretório do projeto
cd "C:\Users\Geovanni\Documents\Projetos Python\Calendar\Calendar"

# Inicializar Git (se ainda não iniciou)
git init

# Adicionar arquivos
git add .
git commit -m "Preparar para deploy em Railway"

# Criar repositório no GitHub e fazer push
# (ou usar repositório existente)
git remote add origin https://github.com/seu-usuario/seu-repo.git
git branch -M main
git push -u origin main
```

### 2. Deploy no Railway

1. Acesse: https://railway.app
2. Faça login com GitHub
3. Clique em **"New Project"**
4. Selecione **"Deploy from GitHub repo"**
5. Escolha seu repositório
6. Railway detectará automaticamente que é Node.js

### 3. Configurar Variáveis de Ambiente

No painel do Railway:

1. Clique na aba **"Variables"**
2. Adicione cada variável:

```
GEMINI_API_KEY=AIzaSyB_IbdMY7DPgq7l0L92x4dV2B4NmplXFIM
MAGISTERIUM_API_KEY=sk_geovan_8b290637361943970baface41b2e6090cbed131be578b22b9211c8c013429311
GROQ_API_KEY=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
CALENDAR_ID=calendar-bot@jarvis-bot-476401.iam.gserviceaccount.com
WHATSAPP_NUMBER=559184527196@c.us
```

### 4. Fazer Deploy

1. Railway fará deploy automático
2. Aguarde ~2 minutos
3. Clique em **"View Logs"**

### 5. Conectar WhatsApp

1. Nos logs, procure por: **"📱 Escaneie o QR Code:"**
2. Abra o WhatsApp no celular
3. Vá em: **Aparelhos Conectados > Conectar Aparelho**
4. Escaneie o QR Code que aparece nos logs
5. ✅ Pronto! Bot conectado e rodando 24/7

---

## Fly.io (100% Gratuito)

### 1. Instalar CLI

```bash
npm install -g flyctl
```

### 2. Login

```bash
flyctl auth login
```

### 3. Criar App

```bash
# No diretório do projeto
flyctl launch

# Responda:
# - App name: jarvis-whatsapp-bot (ou outro)
# - Region: gru (São Paulo)
# - PostgreSQL: NO
# - Redis: NO
```

### 4. Adicionar Secrets

```bash
flyctl secrets set GEMINI_API_KEY="AIzaSyB_IbdMY7DPgq7l0L92x4dV2B4NmplXFIM"
flyctl secrets set MAGISTERIUM_API_KEY="sk_geovan_8b290637361943970baface41b2e6090cbed131be578b22b9211c8c013429311"
flyctl secrets set GROQ_API_KEY="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"
flyctl secrets set CALENDAR_ID="calendar-bot@jarvis-bot-476401.iam.gserviceaccount.com"
flyctl secrets set WHATSAPP_NUMBER="559184527196@c.us"
```

### 5. Criar Volume para Sessão WhatsApp

```bash
flyctl volumes create whatsapp_data --size 1
```

### 6. Deploy

```bash
flyctl deploy
```

### 7. Ver Logs e QR Code

```bash
flyctl logs

# Procure pelo QR Code e escaneie
```

---

## Render.com (Gratuito com Sleep)

### 1. Criar Conta

https://render.com

### 2. New Web Service

1. Clique em **"New +"** → **"Web Service"**
2. Conecte seu repositório GitHub
3. Configure:
   - **Name:** jarvis-whatsapp-bot
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

### 3. Variáveis de Ambiente

Adicione cada variável na aba **"Environment"**

### 4. Deploy

Clique em **"Create Web Service"**

### 5. Ver Logs

Clique em **"Logs"** e procure o QR Code

---

## 📋 Checklist Após Deploy

- [ ] Logs mostram "✅ Bot iniciado com sucesso!"
- [ ] QR Code escaneado
- [ ] WhatsApp conectado
- [ ] Teste enviando mensagem para o bot
- [ ] Teste geração de imagem: "crie uma imagem de..."
- [ ] Teste calendário: "adicionar evento reunião hoje às 15h"
- [ ] Teste Magisterium: "o que é a eucaristia?"

---

## 🆘 Problemas Comuns

### "QR Code não aparece"
- Aguarde 1-2 minutos para o bot inicializar completamente
- Verifique se todas as variáveis de ambiente estão corretas

### "Bot desconecta constantemente"
- Certifique-se de que há volume/persistência para `.wwebjs_auth`
- Use Railway ou Fly.io (não Render free que dorme)

### "Erro ao gerar imagem"
- Verifique se GROQ_API_KEY está configurada
- Teste a chave localmente primeiro

### "Calendário não funciona"
- Verifique se `credentials.json` está no projeto
- Confirme que CALENDAR_ID está correto

---

## 💡 Dicas

1. **Mantenha os logs abertos** durante os primeiros minutos
2. **Não compartilhe suas API keys** publicamente
3. **Faça backup** do arquivo `.wwebjs_auth` após conectar
4. **Monitore uso** das APIs (especialmente Groq/Gemini)
5. **Configure alertas** na plataforma escolhida

---

## 🎉 Pronto!

Seu bot agora está rodando 24/7 na nuvem!

**Próximos passos:**
- Adicione mais funcionalidades
- Configure webhooks para notificações
- Monitore performance
- Escale conforme necessário

**Custos estimados:**
- Railway: ~$2-5/mês
- Fly.io: $0 (3 VMs grátis)
- Render: $0 (com sleep) ou $7/mês

Boa sorte! 🚀
