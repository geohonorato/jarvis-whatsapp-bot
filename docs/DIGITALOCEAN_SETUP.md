# Guia Passo a Passo: Configurar Persistência no DigitalOcean

## 📋 Pré-requisitos
- ✅ Aplicação já deployada no DigitalOcean App Platform
- ✅ Repositório GitHub conectado
- ✅ Variáveis de ambiente já configuradas

---

## ⚡ PASSO 1: Gerar Chave de Encriptação

Na sua máquina, gere uma chave segura:

### Windows (PowerShell):
```powershell
# Cole isso no PowerShell e pressione Enter
$bytes = 1..16 | ForEach-Object { [byte](Get-Random -Minimum 0 -Maximum 256) }
[BitConverter]::ToString($bytes) -replace '-',''
```

**Resultado será algo assim:**
```
F3A2B1C4D5E6F7A8B9C0D1E2F3A4B5C6
```

**Copie e guarde esse valor!** (você vai precisar dele no DigitalOcean)

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
