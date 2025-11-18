# 🔒 Segurança e Boas Práticas

## ⚠️ IMPORTANTE: Nunca Exponha Suas Chaves!

### Chaves que DEVEM ser protegidas:

- `GEMINI_API_KEY`
- `MAGISTERIUM_API_KEY`
- `GROQ_API_KEY`
- `PERPLEXITY_API_KEY`
- `GOOGLE_CREDENTIALS` (conteúdo do credentials.json)
- `.env` (nunca commite no Git)

---

## ✅ O que já está protegido

O `.gitignore` está configurado para ignorar:

```
.env
.env.local
.env.production
credentials.json
.wwebjs_auth/
.wwebjs_cache/
```

---

## 🛡️ Boas Práticas de Segurança

### 1. Rotação de Chaves

**Recomendação:** Troque suas API keys a cada 3-6 meses

**Como fazer:**
- Gere novas chaves nos respectivos serviços
- Atualize as variáveis de ambiente na plataforma
- Invalide as chaves antigas

### 2. Limite de Uso (Rate Limiting)

**Problema:** Alguém pode abusar do bot

**Solução:**
```javascript
// Implementar em message-handler.js
const userLimits = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  const userLimit = userLimits.get(userId) || { count: 0, resetAt: now + 60000 };
  
  if (now > userLimit.resetAt) {
    userLimit.count = 0;
    userLimit.resetAt = now + 60000;
  }
  
  if (userLimit.count >= 10) { // 10 mensagens por minuto
    return false;
  }
  
  userLimit.count++;
  userLimits.set(userId, userLimit);
  return true;
}
```

### 3. Whitelist de Números

**Recomendação:** Limite o bot a números autorizados

```javascript
// No início do handleMessage
const ALLOWED_NUMBERS = [
  '559184527196@c.us',
  // adicione outros números autorizados
];

if (!ALLOWED_NUMBERS.includes(msg.from)) {
  console.log('🚫 Número não autorizado:', msg.from);
  return;
}
```

### 4. Monitoramento de Uso

**Plataformas que oferecem:**
- Railway: Dashboard de uso
- Fly.io: `flyctl status`
- Render: Usage dashboard

**Configure alertas para:**
- Alto uso de CPU/memória
- Muitas requests em curto período
- Erros frequentes

### 5. Backup da Sessão WhatsApp

**Importante:** Faça backup do diretório `.wwebjs_auth/`

**Como:**
```bash
# Localmente
cp -r .wwebjs_auth/ backup_wwebjs_auth_$(date +%Y%m%d)/

# Na nuvem (Railway/Render)
# Use volumes persistentes configurados
```

---

## 🔍 Auditoria de Segurança

### Checklist:

- [ ] `.env` não está no repositório Git
- [ ] `credentials.json` não está no repositório Git
- [ ] Todas as chaves são variáveis de ambiente
- [ ] `.gitignore` está configurado corretamente
- [ ] Repositório GitHub é privado (recomendado)
- [ ] Logs não expõem informações sensíveis
- [ ] Rate limiting implementado (opcional)
- [ ] Whitelist de números ativada (opcional)
- [ ] Backup da sessão WhatsApp configurado

---

## 🚨 O que fazer se uma chave for exposta

### 1. IMEDIATAMENTE:

1. **Revogue a chave** no serviço correspondente
2. **Gere uma nova chave**
3. **Atualize** a variável de ambiente na plataforma
4. **Force redeploy** do bot

### 2. Para GitHub:

Se você commitou acidentalmente:

```bash
# Remover do histórico (CUIDADO!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (se o repo for só seu)
git push origin --force --all
```

**Melhor:** Delete o repositório e crie um novo limpo.

### 3. Notifique:

- Equipe (se houver)
- Serviços afetados
- Revogue credenciais antigas

---

## 📊 Monitoramento de Custos

### APIs Gratuitas (limites):

| Serviço | Limite Gratuito | Custo após limite |
|---------|-----------------|-------------------|
| Groq | 30 req/min | N/A (sem tier pago ainda) |
| Gemini | 15 req/min | $0.075/1M tokens |
| Magisterium | 100 req/dia | $0.02/req |
| Pollinations.ai | Ilimitado | Gratuito |

### Dicas para economizar:

1. **Cache respostas** quando possível
2. **Limite requests** por usuário
3. **Use Groq** (mais generoso) como primário
4. **Monitore uso** regularmente

---

## 🔐 Credenciais do Google Calendar

### Melhores práticas:

1. **Nunca** compartilhe `credentials.json`
2. **Use** Service Account (não OAuth2 de usuário)
3. **Limite** permissões da Service Account
4. **Rotacione** chaves regularmente
5. **Monitore** acessos no Google Cloud Console

### Compartilhar calendário:

```
1. Abra Google Calendar
2. Configurações do calendário
3. Compartilhar com pessoas específicas
4. Adicione o email da Service Account
5. Permissão: "Fazer alterações nos eventos"
```

---

## 🛡️ Proteção contra DDoS/Spam

### Implementar timeout:

```javascript
const recentRequests = new Map();

function antiSpam(userId) {
  const lastRequest = recentRequests.get(userId);
  const now = Date.now();
  
  if (lastRequest && (now - lastRequest) < 2000) { // 2 segundos
    return false; // Bloqueado
  }
  
  recentRequests.set(userId, now);
  return true; // Permitido
}
```

---

## 📝 Logs e Privacy

### NÃO logue:

- ❌ API Keys
- ❌ Conteúdo de mensagens privadas
- ❌ Números de telefone completos
- ❌ Emails de usuários

### Pode logar:

- ✅ Timestamps
- ✅ Tipos de comando (/imagem, /add, etc)
- ✅ Erros técnicos
- ✅ Status de operações

### Exemplo seguro:

```javascript
// ❌ ERRADO
console.log('Chave:', process.env.GROQ_API_KEY);

// ✅ CORRETO
console.log('Chave configurada:', !!process.env.GROQ_API_KEY);
```

---

## 🔄 Atualizações de Segurança

### Mantenha dependências atualizadas:

```bash
# Verificar vulnerabilidades
npm audit

# Corrigir automático
npm audit fix

# Atualizar dependências
npm update
```

**Frequência recomendada:** Mensal

---

## 📞 Contato em Caso de Incidente

Se descobrir uma vulnerabilidade:

1. **NÃO** publique publicamente
2. **Revogue** credenciais afetadas imediatamente
3. **Corrija** o problema
4. **Documente** o incidente
5. **Aprenda** com o erro

---

## 🎯 Resumo de Prioridades

### Alto (Fazer AGORA):
- [ ] Verificar que `.env` não está no Git
- [ ] Confirmar que `credentials.json` não está no Git
- [ ] Todas as chaves são variáveis de ambiente

### Médio (Fazer LOGO):
- [ ] Implementar rate limiting básico
- [ ] Configurar alertas de erro
- [ ] Setup de backup da sessão WhatsApp

### Baixo (Fazer EVENTUALMENTE):
- [ ] Whitelist de números
- [ ] Auditoria de logs
- [ ] Rotação de chaves

---

**Segurança é um processo contínuo, não um estado final!** 🔒
