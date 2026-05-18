const fs = require('fs');
const path = require('path');
const ragService = require('./rag-service');

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || process.env.VAULT_PATH || (
    process.platform === 'win32'
        ? 'C:\\Users\\Geovanni\\Documents\\Obsidian Vault'
        : '/home/ubuntu/obsidian-vault'
);

// Pastas ignoradas na indexação
const IGNORE_DIRS = ['.git', '.obsidian', 'node_modules', '.agent', 'assets', '90 - Arquivos'];

// Rastreia mtimes pra não re-indexar notas inalteradas
const INDEX_STATE_FILE = path.join(__dirname, '../../../data/vault-index-state.json');
let indexState = {};

function loadIndexState() {
    try {
        if (fs.existsSync(INDEX_STATE_FILE)) {
            indexState = JSON.parse(fs.readFileSync(INDEX_STATE_FILE, 'utf-8'));
        }
    } catch (e) {
        indexState = {};
    }
}

function saveIndexState() {
    try {
        const dir = path.dirname(INDEX_STATE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(INDEX_STATE_FILE, JSON.stringify(indexState, null, 2));
    } catch (e) {
        console.error('❌ Erro salvando index state:', e.message);
    }
}

function getFileMtime(filePath) {
    try {
        return fs.statSync(filePath).mtimeMs.toString();
    } catch {
        return '0';
    }
}

/**
 * Varre o vault e indexa notas .md como memórias vetoriais
 */
async function indexarVault() {
    if (!fs.existsSync(VAULT_PATH)) {
        console.warn(`⚠️ [Indexer] Vault não encontrado: ${VAULT_PATH}`);
        return;
    }

    loadIndexState();
    
    const mdFiles = [];
    encontrarMdFiles(VAULT_PATH, mdFiles);
    
    let novas = 0;
    let puladas = 0;

    for (const filePath of mdFiles) {
        const relativePath = path.relative(VAULT_PATH, filePath);
        const mtime = getFileMtime(filePath);
        
        // Já indexado e não mudou
        if (indexState[relativePath] === mtime) {
            puladas++;
            continue;
        }

        try {
            // Indexer apenas rastreia alterações do vault (mtime).
            // Notas não vão mais para o banco vetorial — a busca semântica
            // é feita pelo obsidian-reader.js sob demanda (keyword matching).
            novas++;
            indexState[relativePath] = mtime;
        } catch (e) {
            console.error(`❌ [Indexer] Erro ao rastrear ${relativePath}:`, e.message);
        }
    }

    saveIndexState();
    console.log(`📚 [Indexer] Vault indexado: ${novas} novas, ${puladas} sem alteração (total: ${mdFiles.length} arquivos .md)`);
}

function encontrarMdFiles(dir, result) {
    try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
            if (IGNORE_DIRS.includes(entry)) continue;

            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                encontrarMdFiles(fullPath, result);
            } else if (entry.endsWith('.md') && stat.size < 50000) {
                result.push(fullPath);
            }
        }
    } catch (e) {
        // Ignora erros de permissão
    }
}

module.exports = { indexarVault };
