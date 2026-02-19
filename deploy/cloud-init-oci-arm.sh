#!/bin/bash
# ============================================
# Cloud-Init: Jarvis WhatsApp Bot - OCI AMD
# Ubuntu 22.04 x86_64 - VM.Standard.E2.1.Micro (1GB RAM)
# ============================================

set -e

APP_USER="ubuntu"
APP_DIR="/home/${APP_USER}/jarvis-bot"
NODE_VERSION="20"

echo "🚀 Configurando servidor OCI AMD Ubuntu (1GB RAM)..."

# --- 1. Atualização ---
apt-get update -y
apt-get upgrade -y

# --- 2. SWAP de 4GB (ESSENCIAL com 1GB RAM) ---
if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    sysctl vm.swappiness=80
    echo 'vm.swappiness=80' >> /etc/sysctl.conf
    echo "✅ Swap de 4GB configurado"
fi

# --- 3. Dependências ---
apt-get install -y \
    curl git wget unzip \
    build-essential \
    python3 python3-pip python3-venv \
    ffmpeg \
    chromium-browser \
    fonts-liberation \
    libatk-bridge2.0-0 libatk1.0-0 \
    libcups2 libdrm2 libgbm1 libnss3 \
    libxcomposite1 libxdamage1 libxrandr2 libxss1 \
    libasound2

# --- 4. Node.js 20 LTS ---
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs
echo "📦 Node.js $(node -v) | npm $(npm -v)"

# --- 5. Detectar Chromium ---
CHROMIUM_PATH=""
for p in /usr/bin/chromium-browser /usr/bin/chromium /usr/bin/google-chrome; do
    if [ -f "$p" ]; then CHROMIUM_PATH="$p"; break; fi
done
echo "🧭 Chromium: ${CHROMIUM_PATH:-NÃO ENCONTRADO}"

# --- 6. Variáveis de ambiente ---
cat >> /home/${APP_USER}/.bashrc << EOF
export PUPPETEER_SKIP_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=${CHROMIUM_PATH:-/usr/bin/chromium-browser}
export NODE_OPTIONS="--max-old-space-size=512"
EOF

# --- 7. Diretório do projeto ---
mkdir -p ${APP_DIR}
chown ${APP_USER}:${APP_USER} ${APP_DIR}

# --- 8. Systemd service ---
cat > /etc/systemd/system/jarvis-bot.service << EOF
[Unit]
Description=Jarvis WhatsApp Bot
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/node --no-deprecation --max-old-space-size=512 src/index.js
Restart=always
RestartSec=15
Environment=NODE_ENV=production
Environment=PUPPETEER_SKIP_DOWNLOAD=true
Environment=PUPPETEER_EXECUTABLE_PATH=${CHROMIUM_PATH:-/usr/bin/chromium-browser}

StandardOutput=journal
StandardError=journal
SyslogIdentifier=jarvis-bot

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable jarvis-bot

# --- 9. Limpeza ---
apt-get clean
rm -rf /var/lib/apt/lists/*

# --- 10. Permitir restart do serviço sem senha (para o cron) ---
echo "${APP_USER} ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart jarvis-bot" > /etc/sudoers.d/jarvis-bot
chmod 440 /etc/sudoers.d/jarvis-bot

# --- 11. Clonar repositório e configurar auto-update ---
sudo -u ${APP_USER} bash << 'USERSCRIPT'
cd /home/ubuntu

# Clone do repositório (TROQUE pela sua URL)
git clone https://github.com/geohonorato/jarvis-whatsapp-bot.git jarvis-bot 2>/dev/null || true

# Configura cron para auto-update a cada minuto
chmod +x /home/ubuntu/jarvis-bot/deploy/auto-update.sh 2>/dev/null || true
(crontab -l 2>/dev/null; echo "* * * * * /home/ubuntu/jarvis-bot/deploy/auto-update.sh >> /var/log/jarvis-update.log 2>&1") | sort -u | crontab -
USERSCRIPT

echo ""
echo "============================================"
echo "✅ Servidor OCI AMD Ubuntu configurado!"
echo "============================================"
echo ""
echo "  1. ssh ${APP_USER}@<IP>"
echo "  2. cd ${APP_DIR}"
echo "  3. npm install --omit=dev"
echo "  4. pip3 install -r requirements.txt"
echo "  5. nano .env  (cole suas chaves)"
echo "  6. sudo systemctl start jarvis-bot"
echo "  7. sudo journalctl -u jarvis-bot -f"
echo ""
echo "  🔄 Auto-update: push no GitHub = deploy automático!"
echo "============================================"
