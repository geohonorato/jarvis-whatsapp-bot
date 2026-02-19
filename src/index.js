require("dotenv").config();
const { client } = require('./services/bot/whatsapp');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Criar/Limpar diretórios temporários (dentro de data/)
const dirs = ['temp', 'temp_images'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', 'data', dir);

  // Se existir, limpa conteúdo antigo (segurança contra crash/restart)
  if (fs.existsSync(dirPath)) {
    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        fs.unlinkSync(path.join(dirPath, file));
      }
      console.log(`🧹 Diretório limpo na inicialização: ${dir}`);
    } catch (e) {
      console.error(`⚠️ Erro ao limpar ${dir}:`, e.message);
    }
  } else {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// O arquivo index.js agora apenas importa e inicializa o cliente
// Toda a lógica está em whatsapp.js
console.log("🚀 Iniciando CalendarAI Bot...");
// A inicialização do cliente já está dentro de whatsapp.js

// Servidor HTTP mínimo para health/readiness (exigido pela App Platform)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🩺 Health endpoint ouvindo em http://0.0.0.0:${PORT}`);
});

// Heartbeat simples para observabilidade no App Platform
setInterval(() => {
  console.log(`💓 Heartbeat | uptime=${process.uptime().toFixed(0)}s | memory=${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
}, 30000);

// Hardening: nunca derrubar o processo por exceções não tratadas
process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException:', err && (err.stack || err.message || err));
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 unhandledRejection:', reason && (reason.stack || reason.message || reason));
});

// Graceful shutdown (a App Platform pode enviar SIGTERM)
process.on('SIGTERM', () => {
  console.log('📴 Recebido SIGTERM, mantendo servidor vivo para desligamento gracioso...');
  // Não chamamos process.exit aqui; deixamos a plataforma encerrar.
});

// Diagnósticos de saída
process.on('beforeExit', (code) => {
  console.warn(`⚠️ beforeExit disparado com código ${code}`);
});

process.on('exit', (code) => {
  console.warn(`⚠️ exit disparado com código ${code}`);
});