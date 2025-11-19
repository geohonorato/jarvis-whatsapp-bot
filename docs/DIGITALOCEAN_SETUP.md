# Guia Passo a Passo: Configurar Persistência no DigitalOcean

## ⚠️ IMPORTANTE: App Platform vs. Spaces

O **DigitalOcean App Platform** é stateless (sem persistência local). Para manter a sessão do WhatsApp entre deploys, usamos **DigitalOcean Spaces** (S3 compatível).

---

## 📋 Pré-requisitos
- ✅ Aplicação já deployada no DigitalOcean App Platform
- ✅ Repositório GitHub conectado
- ✅ Variáveis de ambiente já configuradas

---

## ⚡ PASSO 1: Criar DigitalOcean Space

### 1.1 Acesse Spaces:
1. Vá para **DigitalOcean Dashboard**
2. Menu esquerdo → **Spaces** (em Storage)
3. Clique **Create a Space**

### 1.2 Configure o Space:
- **Space Name**: `jarvis-bot` (ou seu prefixo)
- **Region**: Escolha a mesma região da sua app (ex: `nyc3`)
- **Restrict File Listing**: ✅ Marque para segurança
- Clique **Create Space**

### 1.3 Resultado esperado:
```
Space criado: jarvis-bot
Endpoint: https://nyc3.digitaloceanspaces.com
URL: https://jarvis-bot.nyc3.digitaloceanspaces.com
```

---

## 🔑 PASSO 2: Gerar Chaves de Acesso

### 2.1 Crie Application Token:
1. Clique no seu **Space** (jarvis-bot)
2. Aba **Settings**
3. Procure **CORS** e **API Token**

### 2.2 Gere Credentials via API:
1. Menu esquerdo → **API** (em Account)
2. Aba **Tokens/Keys**
3. **Spaces Keys** → **Generate New Key**
4. Name: `jarvis-bot-app`
5. Clique **Generate**

### 2.3 Copie as credenciais:
```
Access Key: AKIA...
Secret Key: wJalrXUtnFEM...
```

**Guarde esses valores!** (você não conseguirá vê-los novamente)

---

## 🎯 PASSO 3: Gerar Chave de Encriptação

Na sua máquina, gere uma chave segura:

### Windows (PowerShell):
```powershell
$bytes = 1..16 | ForEach-Object { [byte](Get-Random -Minimum 0 -Maximum 256) }
[BitConverter]::ToString($bytes) -replace '-',''
```

**Resultado será algo assim:**
```
F3A2B1C4D5E6F7A8B9C0D1E2F3A4B5C6
```

**Copie e guarde esse valor!**

---

## 🌍 PASSO 4: Configurar Variáveis no DigitalOcean

### Acesse o App Platform:
1. Vá para **DigitalOcean Dashboard**
2. Clique em **Apps**
3. Selecione sua aplicação **jarvis-whatsapp-bot**

### Configure as Variáveis:
1. Na página da app, clique em **Settings**
2. Procure **Environment**
3. Adicione ou edite as variáveis:

#### Variável 1: Chave de Acesso
- Name: `DO_SPACES_KEY`
- Value: `Cole a Access Key do PASSO 2`
- Clique **Save**

#### Variável 2: Chave Secreta
- Name: `DO_SPACES_SECRET`
- Value: `Cole a Secret Key do PASSO 2`
- Clique **Save**

#### Variável 3: Nome do Bucket
- Name: `DO_SPACES_BUCKET`
- Value: `jarvis-bot`
- Clique **Save**

#### Variável 4: Região
- Name: `DO_SPACES_REGION`
- Value: `nyc3` (ou a região do seu Space)
- Clique **Save**

#### Variável 5: Chave de Encriptação
- Name: `WHATSAPP_ENCRYPTION_KEY`
- Value: `Cole a chave do PASSO 3`
- Clique **Save**

### ✅ Resultado esperado:
```
DO_SPACES_KEY = AKIA...
DO_SPACES_SECRET = wJalrXUtnFEM...
DO_SPACES_BUCKET = jarvis-bot
DO_SPACES_REGION = nyc3
WHATSAPP_ENCRYPTION_KEY = F3A2B1C4D5E6F7A8B9C0D1E2F3A4B5C6
```

---

## 📦 PASSO 5: Instalar Dependência AWS SDK

O repositório precisa da dependência `@aws-sdk/client-s3`:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/util-stream-node
```

Ou se você estiver usando Docker:

**No Dockerfile, a dependência já será instalada com:**
```dockerfile
RUN npm install --omit=dev
```

---

## 🚀 PASSO 6: Fazer Deploy

### Opção A: Deploy Automático
1. Certifique-se que tem as mudanças atualizadas:
```bash
git pull origin main
```

2. Faça um commit vazio para forçar redeploy:
```bash
git commit --allow-empty -m "trigger: enable whatsapp persistence with spaces"
git push origin main
```

3. O DigitalOcean detectará e fará deploy automaticamente

### Opção B: Clique em Redeploy
1. Na página da app, clique **Actions**
2. Clique **Redeploy**

---

## ✅ PASSO 7: Verificar Se Funcionou

### 1. Acompanhe o Deploy:
1. Na página da app, vá para **Activity**
2. Aguarde até ver "Deployed" ✅

### 2. Acesse os Logs:
1. Clique na aba **Runtime Logs**
2. Procure por estas mensagens:

```
🔄 Validando DigitalOcean Spaces...
✅ Cliente S3 (DigitalOcean Spaces) inicializado: jarvis-bot
✅ Configuração do DigitalOcean Spaces validada!
✅ WhatsApp autenticado!
✅ Arquivo enviado para Spaces: s3://jarvis-bot/whatsapp/.whatsapp_session_manifest
💾 Backup de autenticação salvo
🔍 Monitoramento de mudanças ativado
```

### 3. Teste no WhatsApp:
1. Envie uma mensagem para seu bot
2. Verifique se responde normalmente

---

## 🔄 PASSO 8: Teste a Persistência

### Primeira Vez (Novo Deploy):
1. Bot inicia
2. Gera **QR Code** (escanear normalmente)
3. Logs mostram:
```
📱 Escaneie o QR Code:
✅ WhatsApp autenticado!
✅ Arquivo enviado para Spaces: s3://jarvis-bot/whatsapp/...
💾 Backup de autenticação salvo
```

### Segunda Vez (Próximo Deploy - O TESTE):
1. Faça um novo deploy:
```bash
git commit --allow-empty -m "test: verify persistence"
git push origin main
```

2. Aguarde o deploy

3. **Nos logs, você deve ver:**
```
✅ Credenciais restauradas do backup (persistente)
✅ Bot iniciado com sucesso!
```

4. **SEM QR Code!** 🎉

---

## 📊 Como Funciona

```
Deploy 1:
  └─ Bot autentica
  └─ Salva manifesto encriptado em Spaces
  └─ Pede QR Code (1x)

Deploy 2+:
  └─ Bot lê manifesto do Spaces
  └─ LocalAuth carrega sessão do .wwebjs_auth
  └─ Bot conectado imediatamente
  └─ SEM QR Code!
```

---

## 🆘 Troubleshooting

### Problema: "DigitalOcean Spaces não configurado"
**Solução:**
1. Verifique se todas as 5 variáveis estão configuradas:
   - `DO_SPACES_KEY`
   - `DO_SPACES_SECRET`
   - `DO_SPACES_BUCKET`
   - `DO_SPACES_REGION`
   - `WHATSAPP_ENCRYPTION_KEY`
2. Redeploy
3. Verifique logs

### Problema: "Erro ao fazer upload para Spaces"
**Possíveis causas:**
1. Access Key expirada - gere nova
2. Secret Key incorreta - cópia incompleta?
3. Bucket name incorreto - confira no Spaces
4. Region mismatch - use mesma região

**Solução:**
1. Vá para **Account → API → Spaces Keys**
2. Gere nova key
3. Atualize `DO_SPACES_KEY` e `DO_SPACES_SECRET`
4. Redeploy

### Problema: "Erro ao descriptografar"
**Solução:**
1. Verifique se `WHATSAPP_ENCRYPTION_KEY` é exatamente a mesma entre deploys
2. Se mudou, você precisa:
   - Gerar nova chave
   - Deletar o backup antigo no Spaces:
     ```bash
     # No Spaces, clique no arquivo whatsapp/.whatsapp_session_manifest
     # Clique Delete
     ```
   - Redeploy
   - Escanear QR Code novamente

### Problema: "Sessão expirou, pede QR novamente"
**Por quê:** WhatsApp Web ocasionalmente expira sessões (comportamento normal)

**O que fazer:**
1. Escanear QR novamente
2. O backup será atualizado automaticamente no Spaces
3. Próximos deploys usarão a nova sessão

---

## 📈 Monitorar Backups

### Verifique se os dados estão sendo salvos:
1. Acesse seu **Space** (jarvis-bot)
2. Procure a pasta **whatsapp/**
3. Você deve ver um arquivo:
   ```
   whatsapp/.whatsapp_session_manifest
   ```

4. Clique nele para ver:
   - **Created**: quando foi criado
   - **Last Modified**: quando foi atualizado pela última vez
   - **Size**: tamanho do arquivo

### Se o arquivo NÃO existe:
1. Logs mostram erro? Corrija seguindo troubleshooting
2. Escanear QR Code novamente para forçar autenticação
3. Aguarde o backup ser criado (pode levar até 1 minuto)

---

## 🎯 Resultado

Depois de completar estes passos:

| Cenário | Antes | Depois |
|---------|-------|--------|
| Novo Deploy | ❌ Pede QR Code | ✅ Pede QR Code (1x) |
| Deploys Futuros | ❌ Pede QR Code | ✅ Sem QR Code |
| Dados Persistem | ❌ Perdidos | ✅ Salvos no Spaces |
| Segurança | ⚠️ Sem encriptação | ✅ AES-256 encriptado |

---

## 💡 Dicas Extras

### Monitorar tamanho de armazenamento:
1. Vá para **Spaces**
2. Você verá o uso total: ex. "0.002 GB used"
3. Para este bot, nunca vai passar de 5MB

### Custo:
- Primeiro 250GB grátis por mês
- Depois: $0.025/GB
- Este bot: ~$0 (muito pouco dados)

### Recuperar backup manualmente (debugging):
```bash
# Via AWS CLI (se instalado localmente)
aws s3 --endpoint https://nyc3.digitaloceanspaces.com \
    cp s3://jarvis-bot/whatsapp/.whatsapp_session_manifest \
    ./backup_manifest.txt \
    --region nyc3 \
    --access_key $ACCESS_KEY \
    --secret_access_key $SECRET_KEY
```

---

## ✅ Checklist Final

- [ ] ✅ DigitalOcean Space criado (jarvis-bot)
- [ ] ✅ Spaces Keys geradas
- [ ] ✅ Chave de encriptação gerada
- [ ] ✅ 5 variáveis configuradas no App Platform
- [ ] ✅ Dependência AWS SDK instalada
- [ ] ✅ Deploy completado
- [ ] ✅ Bot respondendo normalmente
- [ ] ✅ Arquivo aparece em Spaces
- [ ] ✅ QR Code não apareceu em segundo deploy

---

**Pronto! Sua aplicação agora mantém sessão WhatsApp entre deploys! 🚀**

Qualquer dúvida, é só chamar!

---

## 🎯 PASSO 2: Criar Volumes no DigitalOcean

### Acesse o App Platform:
1. Vá para **DigitalOcean Dashboard**
2. Clique em **Apps** (menu esquerdo)
3. Selecione sua aplicação **jarvis-whatsapp-bot**

### Crie os Volumes:
1. Na página da app, clique na aba **Resources**
2. Procure a seção **Volumes**

#### Se não há volumes ainda, adicione:

**Volume 1 - WhatsApp Persistent:**
- Clique **Create Volume**
- Name: `whatsapp-persistent`
- Size: `1 GB` (suficiente para credenciais)
- Clique **Create**

**Volume 2 - Bot Temporary Files:**
- Clique **Create Volume**
- Name: `bot-temp`
- Size: `500 MB`
- Clique **Create**

**Volume 3 - Bot Images:**
- Clique **Create Volume**
- Name: `bot-images`
- Size: `500 MB`
- Clique **Create**

### ✅ Resultado esperado:
```
whatsapp-persistent (1GB)
bot-temp (500MB)
bot-images (500MB)
```

---

## 📁 PASSO 3: Anexar Volumes ao Componente

1. Ainda na página da app, clique em **Settings**
2. Na seção **Components**, clique no seu componente `jarvis-bot` (ou o nome dele)
3. Procure a seção **Mounts** ou **Volumes**

#### Crie 3 mounts:

**Mount 1:**
- Source Volume: `whatsapp-persistent`
- Mount Path: `/app/persistent`
- Clique **Add**

**Mount 2:**
- Source Volume: `bot-temp`
- Mount Path: `/app/temp`
- Clique **Add**

**Mount 3:**
- Source Volume: `bot-images`
- Mount Path: `/app/temp_images`
- Clique **Add**

### ✅ Resultado esperado:
```
/app/persistent → whatsapp-persistent
/app/temp → bot-temp
/app/temp_images → bot-images
```

---

## 🔐 PASSO 4: Configurar Variável de Encriptação

1. Na mesma página de **Settings**
2. Procure a seção **Environment**
3. Encontre ou adicione a variável `WHATSAPP_ENCRYPTION_KEY`

#### Se já existe:
- Clique no ícone de editar (lápis)
- Cole a chave que você gerou no **PASSO 1**
- Clique **Save**

#### Se não existe:
- Clique **Add** (ou +)
- Name: `WHATSAPP_ENCRYPTION_KEY`
- Value: `Cole a chave do PASSO 1`
- Clique **Add**

**Exemplo:**
```
WHATSAPP_ENCRYPTION_KEY = F3A2B1C4D5E6F7A8B9C0D1E2F3A4B5C6
```

---

## 🚀 PASSO 5: Fazer Deploy das Mudanças

### Opção A: Deploy Automático (Recomendado)
O seu repo já tem as mudanças (`commit 9d72d3b`):
1. Vá para **Settings** na app
2. Clique em **GitHub** (ou repositório conectado)
3. Clique **Trigger Deploy** ou **Redeploy**
4. Aguarde o deploy completar (~3-5 minutos)

### Opção B: Deploy Manual (Se preferir)
1. Na sua máquina, certifique-se que tem a versão atualizada:
```bash
git pull origin main
```

2. Faça um commit vazio para forçar redeploy:
```bash
git commit --allow-empty -m "trigger: redeploy with volume persistence"
git push origin main
```

3. O DigitalOcean detectará o push e fará deploy automaticamente

---

## ✅ PASSO 6: Verificar Se Funcionou

### 1. Acompanhe o Deploy:
1. Na página da app, vá para **Activity**
2. Você deve ver um novo deploy em progresso
3. Aguarde até ver "Deployed" ✅

### 2. Acesse os Logs:
1. Clique na aba **Runtime Logs** ou **Logs**
2. Procure por estas mensagens:

```
📁 Diretório de persistência criado: /app/persistent
✅ WhatsApp autenticado!
💾 Credenciais de WhatsApp salvas em backup (persistente)
🔍 Monitoramento de mudanças de autenticação ativado
```

### 3. Teste no WhatsApp:
1. Envie uma mensagem para seu bot
2. Verifique se responde normalmente

---

## 🔄 PASSO 7: Teste a Persistência

### Primeira Vez (Novo Deploy):
1. Bot inicia
2. Gera **QR Code** (escanear normalmente)
3. Logs mostram:
```
📱 Escaneie o QR Code:
✅ WhatsApp autenticado!
💾 Credenciais salvas em backup
```

### Segunda Vez (Próximo Deploy):
1. Faça um novo deploy:
   - Clique **Trigger Deploy** OU
   - Faça um `git commit --allow-empty && git push`

2. Aguarde o deploy

3. **Nos logs, você deve ver:**
```
✅ Credenciais restauradas do backup (persistente)
✅ Bot iniciado com sucesso!
```

4. **SEM QR Code!** 🎉

---

## 🆘 Troubleshooting

### Problema: "Erro ao descriptografar"
**Solução:**
1. Vá para **Settings → Environment**
2. Verifique se `WHATSAPP_ENCRYPTION_KEY` está correto
3. Se mudou, delete o backup:
   - Clique em **Resources → Volumes**
   - Clique em `whatsapp-persistent`
   - Clique **Delete Volume**
   - Crie um novo volume com o mesmo nome
   - Faça novo deploy

### Problema: "Volume não montado"
**Solução:**
1. Vá para **Settings**
2. Clique no componente
3. Verifique se os **Mounts** estão configurados:
   ```
   /app/persistent → whatsapp-persistent
   /app/temp → bot-temp
   /app/temp_images → bot-images
   ```
4. Se faltar algum, adicione
5. Clique **Save** e **Redeploy**

### Problema: "Sessão expirou, pede QR novamente"
**Por quê:** WhatsApp Web expira sessões ocasionalmente (normal)

**O que fazer:**
1. Escanear QR novamente
2. O backup será atualizado automaticamente
3. Próximos deploys usarão a nova sessão

---

## 📊 Checklist Final

- [ ] ✅ Volumes criados (whatsapp-persistent, bot-temp, bot-images)
- [ ] ✅ Volumes anexados ao componente
- [ ] ✅ `WHATSAPP_ENCRYPTION_KEY` definida
- [ ] ✅ Deploy completado
- [ ] ✅ Bot respondendo normalmente
- [ ] ✅ QR Code não apareceu em segundo deploy

---

## 🎯 Resultado

Depois de completar estes passos:

| Cenário | Antes | Depois |
|---------|-------|--------|
| Novo Deploy | ❌ Pede QR Code | ✅ Pede QR Code (1x) |
| Deploys Futuros | ❌ Pede QR Code | ✅ Sem QR Code |
| Dados Persistem | ❌ Perdidos | ✅ Salvos |
| Downtime | ⚠️ Longo | ✅ Rápido |

---

## 💡 Dicas Extras

### Para monitorar a persistência:
1. Vá para **Resources → Volumes**
2. Clique em `whatsapp-persistent`
3. Veja a data de **Last Modified** - atualiza periodicamente ✅

### Se quiser resetar tudo:
```bash
# No seu computador
cd seu-repo
git pull origin main
git commit --allow-empty -m "reset: clear all persistent data"
git push origin main

# Então no DigitalOcean:
# 1. Delete todos os volumes
# 2. Crie novamente com mesmo nome
# 3. Anexe novamente
# 4. Redeploy
```

---

**Pronto! Sua aplicação agora mantém sessão WhatsApp entre deploys! 🚀**

Qualquer dúvida sobre os passos, é só chamar.
