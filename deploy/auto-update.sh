#!/bin/bash
# ============================================
# Auto-Update: Detecta mudanças no GitHub e
# atualiza + reinicia o bot automaticamente
# ============================================
# Uso: Rodado via cron a cada minuto
# crontab: * * * * * /home/ubuntu/jarvis-bot/deploy/auto-update.sh >> /var/log/jarvis-update.log 2>&1

APP_DIR="/home/ubuntu/jarvis-bot"
SERVICE_NAME="jarvis-bot"
BRANCH="main"
LOCK_FILE="/tmp/jarvis-update.lock"

# Evita execuções simultâneas
if [ -f "$LOCK_FILE" ]; then
    exit 0
fi
touch "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

cd "$APP_DIR" || exit 1

# Busca atualizações sem aplicar
git fetch origin "$BRANCH" 2>/dev/null

# Compara commit local vs remoto
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/$BRANCH)

if [ "$LOCAL" = "$REMOTE" ]; then
    # Nenhuma atualização
    exit 0
fi

# === Atualização detectada! ===
echo ""
echo "$(date '+%Y-%m-%d %H:%M:%S') 🔄 Atualização detectada!"
echo "  Local:  $LOCAL"
echo "  Remoto: $REMOTE"

# 1. Pull das mudanças
echo "📥 Puxando mudanças..."
git pull origin "$BRANCH" --ff-only

# 2. Verifica se package.json mudou (precisa npm install?)
CHANGED_FILES=$(git diff --name-only "$LOCAL" "$REMOTE")
echo "📝 Arquivos alterados:"
echo "$CHANGED_FILES"

if echo "$CHANGED_FILES" | grep -q "package.json\|package-lock.json"; then
    echo "📦 package.json mudou. Rodando npm install..."
    npm install --omit=dev
fi

if echo "$CHANGED_FILES" | grep -q "requirements.txt"; then
    echo "🐍 requirements.txt mudou. Atualizando pip..."
    pip3 install --user -r requirements.txt
fi

# 3. Reinicia o serviço
echo "🔄 Reiniciando serviço..."
sudo systemctl restart "$SERVICE_NAME"

echo "✅ $(date '+%Y-%m-%d %H:%M:%S') Atualização concluída!"
echo "============================================"
