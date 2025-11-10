# 🚀 Guia de Deploy em Nuvem

## Opções de Hospedagem

### 1. Railway.app (RECOMENDADO) ⭐

**Vantagens:**
- $5/mês gratuito (suficiente para bot)
- Deploy automático do GitHub
- Fácil configuração
- Logs em tempo real

**Passos:**

1. **Criar conta:** https://railway.app
2. **Novo Projeto:** "Deploy from GitHub repo"
3. **Conectar repositório:** Autorize o GitHub
4. **Adicionar variáveis de ambiente:**
   ```
   GEMINI_API_KEY=sua_chave
   MAGISTERIUM_API_KEY=sua_chave
   GROQ_API_KEY=sua_chave
   CALENDAR_ID=seu_calendar_id
   WHATSAPP_NUMBER=seu_numero
   ```
5. **Deploy:** Automático após push no GitHub!

**Importante:**
- Na primeira execução, escaneie o QR Code nos logs
- Após autenticar, o WhatsApp ficará conectado
- Volume persistente mantém a sessão

---

### 2. Render.com

**Vantagens:**
- Plano gratuito disponível
- Deploy do GitHub
- SSL automático

**Limitação:**
- Dorme após 15min inativo (plano free)
- Leva ~30s para "acordar"

**Passos:**

1. **Criar conta:** https://render.com
2. **New > Web Service**
3. **Conectar GitHub**
4. **Configurar:**
   - Build Command: `npm install`
   - Start Command: `npm start`
5. **Environment Variables:** Adicionar todas as chaves
6. **Deploy!**

---

### 3. Fly.io

**Vantagens:**
- 3 VMs gratuitas
- Não dorme
- Deploy global

**Passos:**

```bash
# 1. Instalar CLI
npm install -g flyctl

# 2. Login
flyctl auth login

# 3. Criar app
flyctl launch

# 4. Adicionar secrets
flyctl secrets set GEMINI_API_KEY=sua_chave
flyctl secrets set MAGISTERIUM_API_KEY=sua_chave
flyctl secrets set GROQ_API_KEY=sua_chave
flyctl secrets set CALENDAR_ID=seu_id
flyctl secrets set WHATSAPP_NUMBER=seu_numero

# 5. Deploy
flyctl deploy
```

---

### 4. DigitalOcean App Platform

**Vantagens:**
- $200 crédito inicial (60 dias)
- Muito estável
- Depois: $5/mês

**Passos:**

1. **Criar conta:** https://www.digitalocean.com
2. **Create > Apps**
3. **Conectar GitHub**
4. **Configurar:**
   - Build Command: `npm install`
   - Run Command: `npm start`
5. **Environment Variables:** Adicionar todas
6. **Deploy!**

---

### 5. Google Cloud Run (Avançado)

**Vantagens:**
- Paga apenas pelo uso
- 2M requests grátis/mês
- Escala automaticamente

**Requer:**
- Docker instalado
- Google Cloud CLI

**Passos:**

```bash
# 1. Build da imagem
docker build -t jarvis-bot .

# 2. Tag para GCR
docker tag jarvis-bot gcr.io/SEU_PROJETO/jarvis-bot

# 3. Push
docker push gcr.io/SEU_PROJETO/jarvis-bot

# 4. Deploy
gcloud run deploy jarvis-bot \
  --image gcr.io/SEU_PROJETO/jarvis-bot \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 📋 Checklist Pré-Deploy

- [ ] Todas as variáveis de ambiente configuradas
- [ ] `credentials.json` do Google Calendar disponível
- [ ] Node.js versão 18.x especificada
- [ ] `.gitignore` configurado (não commitar `.env`)
- [ ] Repositório GitHub atualizado
- [ ] Testar localmente antes: `npm start`

---

## 🔧 Troubleshooting

### QR Code não aparece nos logs
**Solução:** O QR Code aparece apenas na primeira vez. Depois, a sessão fica salva.

### Bot desconecta frequentemente
**Solução:** Use Railway ou Fly.io (não dormem como Render free)

### Erro de memória
**Solução:** Aumentar memória no plano ou otimizar código

### Sessão WhatsApp perdida
**Solução:** Certifique-se de que há volume persistente para `.wwebjs_auth`

---

## 💰 Comparação de Custos

| Plataforma | Plano Gratuito | Plano Pago | Recomendação |
|------------|----------------|------------|--------------|
| Railway | $5/mês crédito | $5+/mês | ⭐ Melhor custo-benefício |
| Render | ✅ (com sleep) | $7/mês | Bom para começar |
| Fly.io | 3 VMs grátis | $1.94+/mês | Muito barato |
| DigitalOcean | $200 crédito 60d | $5/mês | Muito estável |
| Google Cloud Run | 2M req/mês | Pay-as-you-go | Avançado |

---

## 🎯 Recomendação Final

**Para iniciantes:** Railway.app
- Mais fácil de configurar
- $5/mês é suficiente
- Logs excelentes

**Para economizar:** Fly.io
- Completamente gratuito (3 VMs)
- Não dorme
- CLI simples

**Para escala:** Google Cloud Run
- Paga apenas pelo uso real
- Escala automaticamente
- Profissional

---

## 📞 Suporte

Problemas no deploy? Abra uma issue no GitHub ou consulte a documentação da plataforma escolhida.
