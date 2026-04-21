const fs = require('fs');
const path = require('path');

const VAULT_PATH = process.env.VAULT_PATH || (
    process.platform === 'win32' 
        ? 'C:\\Users\\Geovanni\\Documents\\Obsidian Vault' 
        : '/home/ubuntu/obsidian-vault'
);

const DEFAULT_FILES = [
    'GEMINI.md',
    'CLAUDE.md',
    '00 - Mapa.md'
];

/**
 * Lê arquivos cruciais do Obsidian Vault para injetar no contexto da IA
 * @returns {string} Contexto aglomerado lido do Vault
 */
function readCoreVaultContext() {
    let context = "=== CONTEXTO DO OBSIDIAN VAULT ===\n\n";
    
    for (const filename of DEFAULT_FILES) {
        const filePath = path.join(VAULT_PATH, filename);
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                context += `--- Início de ${filename} ---\n`;
                context += content + '\n';
                context += `--- Fim de ${filename} ---\n\n`;
            } catch (error) {
                console.error(`❌ Erro ao ler ${filename}:`, error.message);
            }
        } else {
            console.warn(`⚠️ Arquivo não encontrado no Vault: ${filePath}`);
        }
    }
    
    return context;
}

/**
 * Busca por uma nota específica no Vault a partir do nome
 * @param {string} searchName - Nome (ou parte do nome) do arquivo
 * @returns {string|null} - Conteúdo do arquivo ou null
 */
function readSpecificNote(searchName) {
    try {
        const result = findFileRecursive(VAULT_PATH, searchName);
        if (result) {
            return fs.readFileSync(result, 'utf-8');
        }
    } catch (error) {
        console.error(`❌ Erro ao buscar/ler a nota ${searchName}:`, error.message);
    }
    return null;
}

function findFileRecursive(dir, searchStr) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === '.git' || file === '.obsidian' || file === 'node_modules') continue;
        
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            const found = findFileRecursive(fullPath, searchStr);
            if (found) return found;
        } else if (file.toLowerCase().includes(searchStr.toLowerCase())) {
            return fullPath;
        }
    }
    return null;
}

module.exports = {
    readCoreVaultContext,
    readSpecificNote
};
