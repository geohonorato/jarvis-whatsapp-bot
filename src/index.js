require("dotenv").config();
const { client } = require('./services/bot/whatsapp');
const fs = require('fs');
const path = require('path');

// Criar diretórios necessários
const dirs = ['temp', 'temp_images'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// O arquivo index.js agora apenas importa e inicializa o cliente
// Toda a lógica está em whatsapp.js
console.log("🚀 Iniciando CalendarAI Bot...");
// A inicialização do cliente já está dentro de whatsapp.js