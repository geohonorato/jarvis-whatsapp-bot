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
console.log("🚀 Iniciando Jarvis Cloud Bot na OCI (Versão Baileys)...");
require('./services/finance/finance-tracker'); // Executa a iniciação do banco finance.db

// Inicializa RAG vetorial e indexação do Vault
const ragService = require('./services/rag/rag-service');
const { indexarVault } = require('./services/rag/vault-indexer');

ragService.initialize().then(() => {
    // Indexa o vault na primeira subida (background)
    indexarVault().catch(e => console.error('⚠️ Indexação inicial falhou:', e.message));
    
    // Re-indexa a cada 1 hora
    setInterval(() => {
        indexarVault().catch(e => console.error('⚠️ Re-indexação falhou:', e.message));
    }, 60 * 60 * 1000);
});

// Inicializa Conexão WhatsApp via Baileys
const { connectToWhatsApp } = require('./services/bot/baileys');

connectToWhatsApp().catch(err => {
    console.error("❌ Falha crítica na inicialização do Baileys:", err);
});

setInterval(() => {
    console.log(`💓 Heartbeat | uptime=${process.uptime().toFixed(0)}s | memory=${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
}, 60000);

process.on('uncaughtException', (err) => {
    console.error('💥 uncaughtException:', err?.stack || err?.message || err);
});

process.on('unhandledRejection', (reason) => {
    console.error('💥 unhandledRejection:', reason?.stack || reason?.message || reason);
});