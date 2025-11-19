# WhatsApp Session Persistence Guide

## Problem
Toda vez que você faz deploy em um container Docker, a sessão do WhatsApp é perdida e você precisa escanear o QR Code novamente.

## Solution
A solução implementada usa **persistência via volume Docker** com credenciais criptografadas:

### 1. **Como Funciona**

```
Deploy → Bot Autentica → Salva Credenciais Encriptadas em Volume
   ↓
Próximo Deploy → Bot Lê Credenciais do Volume → Restaura Sessão
   ↓
Sem necessidade de novo QR Code! 🎉
```

### 2. **Configuração no DigitalOcean App Platform**

#### Opção A: Usando Docker Compose (Local ou Stack)
```yaml
version: '3.8'
services:
  jarvis-bot:
    build: .
    environment:
      - WHATSAPP_ENCRYPTION_KEY=sua-chave-segura-32-chars
      - GROQ_API_KEY=${GROQ_API_KEY}
      - GOOGLE_CALENDAR_ID=${GOOGLE_CALENDAR_ID}
      # ... outras variáveis
    volumes:
      # Volume persistente para credenciais e dados
      - whatsapp_data:/app/persistent
      - bot_temp:/app/temp
      - bot_images:/app/temp_images
    restart: unless-stopped
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  whatsapp_data:
    driver: local
  bot_temp:
    driver: local
  bot_images:
    driver: local
```

#### Opção B: DigitalOcean App Platform (Recomendado)

1. **No App Spec (app.yaml), adicione volumes:**
```yaml
services:
- name: jarvis-bot
  source_dir: .
  build_command: npm install --omit=dev
  run_command: npm start
  envs:
    - key: WHATSAPP_ENCRYPTION_KEY
      value: ${WHATSAPP_ENCRYPTION_KEY}
    - key: WHATSAPP_CREDENTIALS_PATH
      value: /app/persistent/.whatsapp_session
    # ... outras variáveis
  http_port: 3000
  health_check:
    http_path: /health
  volumes:
    - name: whatsapp_persistent
      mount_path: /app/persistent
    - name: bot_temp
      mount_path: /app/temp
    - name: bot_images
      mount_path: /app/temp_images

volumes:
  whatsapp_persistent:
    filesystem_slug: ext4
  bot_temp:
    filesystem_slug: ext4
  bot_images:
    filesystem_slug: ext4
```

2. **No App Platform, configure Volumes no Dashboard:**
   - Acesse **Resources** → **Volumes**
   - Crie volume `whatsapp-persistent` (pelo menos 1GB)
   - Crie volume `bot-temp` (500MB)
   - Crie volume `bot-images` (500MB)
   - Anexe ao componente da aplicação

### 3. **Variáveis de Ambiente**

Configure no seu `.env` ou no DigitalOcean:

```env
# Chave para encriptação das credenciais (32 caracteres recomendado)
WHATSAPP_ENCRYPTION_KEY=seu-hash-aleatorio-de-32-caracteres

# Caminho da persistência (default: persistent/.whatsapp_session)
WHATSAPP_CREDENTIALS_PATH=/app/persistent/.whatsapp_session
```

**Gerar chave segura:**
```bash
# Linux/Mac
openssl rand -hex 16

# Windows PowerShell
[Convert]::ToHexString((1..16 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 4. **Como o Sistema Funciona**

#### Primeiro Deploy (Novo):
```
1. Bot inicia
2. Não encontra sessão anterior
3. Gera QR Code (escanear 1x)
4. WhatsApp autentica
5. `whatsapp-auth-manager.js` salva credenciais encriptadas em `/app/persistent/`
6. Sistema inicia normalmente
```

#### Deploy Subsequente (Reutiliza Sessão):
```
1. Bot inicia
2. Encontra arquivo criptografado em `/app/persistent/`
3. LocalAuth carrega credenciais do diretório `.wwebjs_auth`
4. Bot já autenticado - **sem QR Code necessário!**
5. Pronto para usar
```

#### Monitoramento Contínuo:
- A cada 30 segundos, `monitorarMudancasAuth()` verifica se há mudanças
- Se houver, `salvarBackupCredenciais()` cria novo backup
- Backups antigos são removidos automaticamente (após 30 dias)

### 5. **Arquivos Afetados**

| Arquivo | Mudança |
|---------|---------|
| `src/services/bot/whatsapp.js` | Integração do auth-manager |
| `src/services/bot/whatsapp-auth-manager.js` | **NOVO** - Manager de persistência |
| `Dockerfile` | Volume `/app/persistent` + variáveis de env |

### 6. **Testando Localmente**

```bash
# 1. Build da imagem
docker build -t jarvis-bot:latest .

# 2. Execute com volume persistente
docker run -it \
  -e WHATSAPP_ENCRYPTION_KEY=test-key-32-chars-here \
  -e GROQ_API_KEY=sua-chave \
  -v whatsapp_data:/app/persistent \
  jarvis-bot:latest

# 3. Primeira execução: escaneia QR Code
# 4. Para o container: Ctrl+C
# 5. Execute novamente:
docker run -it \
  -e WHATSAPP_ENCRYPTION_KEY=test-key-32-chars-here \
  -e GROQ_API_KEY=sua-chave \
  -v whatsapp_data:/app/persistent \
  jarvis-bot:latest

# ✅ Agora o bot deve iniciar sem pedir QR Code!
```

### 7. **Troubleshooting**

#### "Credenciais não restauradas"
```bash
# Verifique se o volume está montado corretamente
docker volume ls | grep whatsapp

# Inspecione o volume
docker volume inspect whatsapp_data
```

#### "Erro ao descriptografar"
- Verifique se `WHATSAPP_ENCRYPTION_KEY` é a mesma entre deploys
- Se mudou, exclua o backup: `docker volume rm whatsapp_data`

#### "Sessão expirada após alguns dias"
- WhatsApp Web às vezes expira sessões (comportamento normal)
- Bot tentará reconectar automaticamente
- Se falhar após max tentativas, você precisará escanear QR Code novamente
- Isso é limitação do WhatsApp Web, não há como contornar 100%

### 8. **Segurança**

- ✅ Credenciais **encriptadas com AES-256-CBC**
- ✅ Chave de encriptação em **variável de ambiente** (não no código)
- ✅ Backups salvos em **volume Docker** (não em repositório)
- ⚠️ Não deixe `WHATSAPP_ENCRYPTION_KEY` no GitHub

### 9. **Checklist de Deployment**

- [ ] `WHATSAPP_ENCRYPTION_KEY` definida no DigitalOcean
- [ ] Volumes criados: `whatsapp-persistent`, `bot-temp`, `bot-images`
- [ ] Volumes anexados ao componente da app
- [ ] `Dockerfile` atualizado com `VOLUME` e variáveis
- [ ] `whatsapp.js` importando `whatsapp-auth-manager`
- [ ] `whatsapp-auth-manager.js` no repositório

### 10. **Monitoramento**

Você verá logs assim no primeiro deploy:

```
📁 Diretório de persistência criado: /app/persistent
✅ WhatsApp autenticado!
💾 Credenciais de WhatsApp salvas em backup (persistente)
🔍 Monitoramento de mudanças de autenticação ativado
```

E em deploys subsequentes:

```
✅ Credenciais restauradas do backup (persistente)
✅ Bot iniciado com sucesso!
```

---

**Resultado Final:** 🎉 **Sessão WhatsApp mantida entre deploys - sem necessidade de novo QR Code!**
