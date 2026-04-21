require("dotenv").config();
const path = require('path');
const fs = require('fs');

// Verifica os diretórios necessários na subida
const dirs = ['data', 'temp'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Importa e inicializa o nosso banco SQLite e Módulos
console.log("🚀 Iniciando Jarvis Cloud Bot na OCI...");
require('./services/finance/finance-tracker'); // Executa a iniciação do banco finance.db

// App do Webhook
const app = require('./services/bot/webhook-server');

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(\`🌐 Webhook Server rodando na porta \${PORT}\`);
    console.log(\`✅ Rota de verificação: GET /webhook\`);
    console.log(\`✅ Rota de eventos: POST /webhook\`);
});

// Heath Check endpoint for Cloud Providers
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

setInterval(() => {
    console.log(\`💓 Heartbeat | uptime=\${process.uptime().toFixed(0)}s | memory=\${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB\`);
}, 60000);

process.on('uncaughtException', (err) => {
    console.error('💥 uncaughtException:', err?.stack || err?.message || err);
});

process.on('unhandledRejection', (reason) => {
    console.error('💥 unhandledRejection:', reason?.stack || reason?.message || reason);
});