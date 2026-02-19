const fs = require('fs');
const path = require('path');

const WATCH_FILE = path.join(__dirname, '../../../data/watches.json');

// Garante que o diretório de dados existe
const dataDir = path.dirname(WATCH_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Carrega ou inicia lista
function loadWatches() {
    if (!fs.existsSync(WATCH_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(WATCH_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function saveWatches(watches) {
    fs.writeFileSync(WATCH_FILE, JSON.stringify(watches, null, 2));
}

/**
 * Adiciona um novo monitoramento
 */
function addWatch(url, targetPrice, chatId) {
    const watches = loadWatches();
    watches.push({
        id: Date.now().toString(),
        url,
        targetPrice: parseFloat(targetPrice),
        chatId,
        lastChecked: null,
        lastPrice: null,
        active: true
    });
    saveWatches(watches);
    return true;
}

/**
 * Lista monitoramentos por ChatID
 */
function listWatches(chatId) {
    const watches = loadWatches();
    return watches.filter(w => w.chatId === chatId && w.active);
}

module.exports = { addWatch, listWatches, loadWatches, saveWatches };
