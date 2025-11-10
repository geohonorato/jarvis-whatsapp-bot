# 🌊 Deploy no DigitalOcean com GitHub Student Pack

## 🎓 Pré-requisitos

- [ ] Conta GitHub (já tem ✅)
- [ ] GitHub Student Developer Pack ativado
- [ ] Projeto no GitHub (faça push do código)
- [ ] APIs configuradas (Groq, Gemini, Magisterium)

---

## 📚 PARTE 1: Ativar GitHub Student Pack

### Passo 1: Verificar Benefício Estudantil

```
1. Acesse: https://education.github.com/pack
2. Clique em "Get Student Benefits"
3. Escolha verificação:
   → Email institucional (.edu) OU
   → Upload de documento estudantil
4. Preencha o formulário
5. Aguarde aprovação (1-3 dias úteis)
```

### Passo 2: Confirmar Aprovação

```
1. Você receberá email de confirmação
2. Acesse: https://education.github.com/pack
3. Veja badge "GitHub Student Developer"
4. Role até "DigitalOcean" e clique "Get access"
```

---

## 🚀 PARTE 2: Criar Conta DigitalOcean

### Passo 1: Criar Conta

```
1. Acesse: https://www.digitalocean.com
2. Clique "Sign Up"
3. Use "Sign up with GitHub" (IMPORTANTE!)
4. Autorize DigitalOcean a acessar GitHub
```

### Passo 2: Verificar Crédito de $200

```
1. Após login, clique no seu avatar (canto superior direito)
2. Clique "Billing" ou "Faturamento"
3. Procure por uma dessas seções:
   - "Account Balance" 
   - "Créditos disponíveis"
   - "Promoções e créditos"
4. Deve aparecer:
   💰 $200.00 credit from GitHub Student Developer Pack
   OU
   💰 US$ 200 em crédito ao longo de 60 dias
5. Validade: 12 meses a partir da ativação

⚠️ IMPORTANTE: 
- "Custo estimado: $0,00" no topo é NORMAL (significa que está usando crédito)
- O crédito aparece na página de Billing/Faturamento
```

**⚠️ SE NÃO APARECER o crédito na página de Billing:**
```
1. Volte para: https://education.github.com/pack
2. Encontre "DigitalOcean"
3. Clique "Get access to DigitalOcean"
4. Siga o link de redenção
```

---

## 📦 PARTE 3: Preparar Repositório GitHub

### Passo 1: Subir Código para GitHub

```powershell
# 1. Inicializar repositório (se ainda não fez)
git init

# 2. Adicionar todos os arquivos
git add .

# 3. Commit inicial
git commit -m "feat: Bot WhatsApp com Groq + Gemini + Calendar"

# 4. Criar repositório no GitHub
# Acesse: https://github.com/new
# Nome: jarvis-whatsapp-bot
# Descrição: Bot WhatsApp inteligente com IA híbrida
# Visibilidade: Private (recomendado)

# 5. Conectar e fazer push
git remote add origin https://github.com/SEU_USUARIO/jarvis-whatsapp-bot.git
git branch -M main
git push -u origin main
```

### Passo 2: Verificar Arquivos Importantes

Certifique-se que estes arquivos estão no GitHub:

```
✅ Dockerfile
✅ package.json
✅ src/index.js
✅ src/config/index.js
✅ .gitignore (para NÃO subir credentials.json)
```

---

## 🎯 PARTE 4: Deploy no DigitalOcean App Platform

### Passo 1: Criar Novo App

```
1. No painel DigitalOcean, clique "Create" (botão verde superior)
2. Selecione "Apps"
3. Escolha "GitHub" como fonte
4. Clique "Manage Access" se necessário
5. Autorize DigitalOcean a acessar seus repositórios
```

### Passo 2: Selecionar Repositório

```
1. Na lista, encontre "jarvis-whatsapp-bot"
2. Clique no repositório
3. Branch: main
4. Autodeploy: ✅ Deixe marcado (deploy automático no push)
5. Clique "Next"
```

### Passo 3: Configurar Recursos

```
1. DigitalOcean detectará automaticamente:
   - Type: Web Service
   - Dockerfile: Sim (usará o Dockerfile do projeto)
   
2. Configure:
   - Name: jarvis-whatsapp-bot
   - Region: New York (NYC1) ou Frankfurt (FRA1)
   - Size: Basic ($6/mês) ← Coberto pelos $200!
   - Instance Count: 1
   
3. Clique "Next"
```

### Passo 4: Configurar Variáveis de Ambiente

**CRÍTICO:** Adicione TODAS as variáveis:

```
1. Na seção "Environment Variables", clique "Edit"

2. Adicione uma por uma:

Key: GROQ_API_KEY
Value: [sua chave do Groq]
Encrypt: ✅ (deixe marcado)

Key: GEMINI_API_KEY
Value: [sua chave do Gemini]
Encrypt: ✅

Key: MAGISTERIUM_API_KEY
Value: [sua chave do Magisterium AI]
Encrypt: ✅

Key: GOOGLE_CREDENTIALS
Value: [todo o conteúdo do credentials.json em UMA linha]
Encrypt: ✅

Key: CALENDAR_ID
Value: [seu calendar ID]
Encrypt: ✅

Key: WHATSAPP_NUMBER
Value: [seu número com código do país, ex: 5511999999999]
Encrypt: ❌ (pode deixar visível)

Key: NODE_ENV
Value: production
Encrypt: ❌

Key: TZ
Value: America/Sao_Paulo
Encrypt: ❌
```

**📋 Como pegar GOOGLE_CREDENTIALS:**

```powershell
# No PowerShell, execute:
Get-Content credentials.json | Out-String

# Copie TODO o conteúdo (incluindo { e })
# Cole no campo Value do GOOGLE_CREDENTIALS
# Deve ser uma linha única como:
{"type":"service_account","project_id":"...","private_key":"..."}
```

3. Clique "Save"

### Passo 5: Revisar e Criar

```
1. Revise todas as configurações:
   ✅ Repositório correto
   ✅ Dockerfile detectado
   ✅ 8 variáveis de ambiente adicionadas
   ✅ Region selecionada
   ✅ $6/mês (mostra seu crédito)

2. Clique "Create Resources"

3. Aguarde build (5-10 minutos)
```

---

## 📱 PARTE 5: Autenticar WhatsApp

### Passo 1: Acessar Logs

```
1. Após deploy concluído, clique no app
2. Vá em "Runtime Logs"
3. Procure por:
   "🔐 QR Code para WhatsApp Web:"
   [QR Code aparecerá aqui]
```

### Passo 2: Escanear QR Code

```
1. Abra WhatsApp no celular
2. Vá em:
   - Android: Menu (3 pontinhos) > Aparelhos conectados
   - iOS: Configurações > Aparelhos conectados
3. Toque em "Conectar um aparelho"
4. Escaneie o QR Code que apareceu nos logs
5. Aguarde mensagem: "✅ WhatsApp autenticado!"
```

### Passo 3: Verificar Funcionamento

```
1. Nos logs, procure:
   ✅ Cliente WhatsApp pronto!
   ✅ Conectado como: [seu número]
   ✅ Bot iniciado com sucesso

2. Envie uma mensagem teste para o bot:
   "Olá!"

3. Verifique resposta (deve usar Groq)
```

---

## 🔧 PARTE 6: Configurações Avançadas

### Configurar Alertas

```
1. No painel do app, vá em "Settings"
2. Clique "Alerts"
3. Configure:
   - CPU > 80%: Enviar email
   - Memory > 80%: Enviar email
   - Restart Count > 5: Enviar email
```

### Configurar Health Checks

```
1. Em "Settings", vá em "Health Checks"
2. Configure:
   - HTTP Path: / (se você adicionar endpoint de health)
   - Success Threshold: 3
   - Failure Threshold: 3
   - Interval: 30 seconds
```

### Adicionar Domínio Customizado (Opcional)

```
1. Em "Settings", vá em "Domains"
2. Clique "Add Domain"
3. Digite seu domínio (ex: bot.seudominio.com)
4. Configure DNS conforme instruções
5. SSL automático (Let's Encrypt)
```

---

## 📊 PARTE 7: Monitoramento

### Verificar Uso de Recursos

```
1. No painel do app, vá em "Insights"
2. Monitore:
   - CPU Usage (deve ficar < 50%)
   - Memory Usage (deve ficar < 80%)
   - Bandwidth (entrada/saída)
   - Request Count
```

### Verificar Custo

```
1. Clique no avatar > "Billing"
2. Veja "Month-to-Date Usage"
3. Estimativa: $6/mês
4. Com $200 de crédito: ~33 meses grátis! 🎉
```

### Logs em Tempo Real

```
1. No app, clique "Runtime Logs"
2. Ative "Live tail" (canto superior direito)
3. Veja logs em tempo real:
   📝 Mensagens recebidas
   🔄 Sistema híbrido ativado
   📋 Fase 1/2, Fase 2/2
   ✅ Respostas enviadas
```

---

## 🔄 PARTE 8: Atualizações

### Deploy Automático

```
# Toda vez que você fizer push no GitHub:
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# DigitalOcean automaticamente:
1. Detecta mudança
2. Faz rebuild
3. Deploy nova versão
4. Zero downtime!
```

### Deploy Manual

```
1. No painel do app, clique "Actions"
2. Clique "Deploy"
3. Selecione commit ou branch
4. Clique "Deploy"
```

### Rollback

```
Se algo der errado:
1. Clique "Actions" > "Rollback"
2. Selecione deployment anterior
3. Confirme rollback
```

---

## 🐛 PARTE 9: Troubleshooting

### Problema: App não inicia

**Sintomas:** Status "Error" ou "Crashed"

**Soluções:**
```
1. Verifique logs:
   - Procure por erros em vermelho
   - Verifique se todas as APIs estão funcionando

2. Valide variáveis de ambiente:
   Settings > Environment Variables
   - GROQ_API_KEY está correto?
   - GEMINI_API_KEY está correto?
   - GOOGLE_CREDENTIALS está em formato JSON válido?

3. Teste localmente:
   npm start
   (se funciona local, problema é configuração cloud)
```

### Problema: QR Code não aparece

**Soluções:**
```
1. Verifique logs em "Runtime Logs"
2. Procure por erros relacionados a Puppeteer
3. Confirme que Dockerfile inclui Chromium:
   ✅ puppeteer-skip-chromium-download=false
   ✅ chromium instalado
```

### Problema: Bot não responde

**Soluções:**
```
1. Verifique sessão WhatsApp:
   - QR Code foi escaneado?
   - Aparece "✅ Cliente WhatsApp pronto!"?

2. Teste APIs manualmente:
   - Groq API funcionando?
   - Gemini API funcionando?
   - Limite de requisições atingido?

3. Verifique logs:
   - Mensagens chegam? (log: "📨 Mensagem recebida")
   - Erro ao processar?
```

### Problema: Custo maior que esperado

**Soluções:**
```
1. Verifique instance size:
   Settings > Resources
   - Deve estar em "Basic $6/mês"
   - Se estiver em "Professional", downgrade

2. Monitore bandwidth:
   Insights > Bandwidth
   - Se muito alto, otimize envio de mídia

3. Desabilite autodeploy desnecessário:
   Settings > App-Level
   - Desmarque "Autodeploy" se fizer muitos commits
```

---

## 📈 PARTE 10: Otimizações

### Reduzir Latência

```
1. Escolha region mais próxima:
   - Brasil: Sem datacenter (use NYC1)
   - Europa: FRA1
   - Ásia: SGP1

2. Use CDN para assets estáticos (se aplicável)

3. Otimize cache interno do bot
```

### Reduzir Custos

```
1. Use instance menor se possível:
   - Basic ($6) é suficiente para 90% dos casos
   - Monitore CPU/Memory antes de fazer upgrade

2. Otimize uso de APIs:
   - Cache respostas quando possível
   - Use rate limiting interno

3. Comprima logs:
   - Logs ocupam storage
   - Configure retention policy
```

### Melhorar Performance

```
1. Ative HTTP/2:
   - Automático no DigitalOcean

2. Configure workers:
   - Se Node.js, use cluster mode

3. Ative compression:
   - Já habilitado por padrão
```

---

## 🎉 CHECKLIST FINAL

### Pré-Deploy
- [ ] GitHub Student Pack ativado
- [ ] $200 de crédito verificado no DigitalOcean
- [ ] Código no GitHub (repositório private)
- [ ] Dockerfile presente e configurado
- [ ] .gitignore protege credenciais

### Deploy
- [ ] App criado no DigitalOcean
- [ ] Repositório conectado
- [ ] 8 variáveis de ambiente configuradas
- [ ] Region selecionada (NYC1 ou FRA1)
- [ ] Build completo com sucesso

### Pós-Deploy
- [ ] QR Code escaneado
- [ ] WhatsApp autenticado
- [ ] Mensagem teste enviada e respondida
- [ ] Logs sem erros
- [ ] Alertas configurados
- [ ] Custo verificado ($6/mês)

### Testes
- [ ] Texto simples → Groq direto
- [ ] Imagem → Sistema híbrido (Gemini→Groq)
- [ ] Áudio → Sistema híbrido (Gemini→Groq)
- [ ] Comando `/imagem` → Geração de imagem
- [ ] Comando `/magisterium` → Consulta doutrina
- [ ] Evento → Criação no Google Calendar

---

## 📞 Suporte

### DigitalOcean
- Documentação: https://docs.digitalocean.com
- Community: https://www.digitalocean.com/community
- Suporte: https://cloud.digitalocean.com/support

### GitHub Student Pack
- FAQ: https://education.github.com/pack/faq
- Suporte: education@github.com

---

## 💡 Dicas Finais

1. **Monitore seu crédito:** Acesse Billing toda semana
2. **Configure alertas:** Evite surpresas
3. **Faça backups:** Export das conversas importantes
4. **Documente mudanças:** Git commit messages claros
5. **Teste antes de push:** Evite deploys quebrados

---

## 🎓 Recursos Adicionais

### Aprender Mais sobre DigitalOcean
- [Tutorial Apps Platform](https://docs.digitalocean.com/products/app-platform/)
- [Dockerfile Best Practices](https://docs.digitalocean.com/developer-center/dockerfile-best-practices/)
- [Scaling Apps](https://docs.digitalocean.com/products/app-platform/how-to/scale-app/)

### Melhorar o Bot
- [whatsapp-web.js Docs](https://wwebjs.dev/)
- [Groq API Docs](https://console.groq.com/docs)
- [Gemini API Docs](https://ai.google.dev/docs)

---

**🚀 Pronto! Seu bot estará rodando 24/7 na nuvem por 33 meses grátis!**

**Estimativa de uso do crédito:**
- $6/mês × 12 meses = $72/ano
- $200 ÷ $6 = 33 meses (quase 3 anos!)
- Tempo suficiente até graduar! 🎓

Precisa de ajuda? Só chamar! 😊
