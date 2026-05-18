/**
 * Vault Writer — Operações genéricas de leitura/escrita no Obsidian Vault
 *
 * Inspirado no padrão Edit do Claude Code (substituição exata de strings).
 * Cross-platform: funciona em Windows (dev) e Linux (OCI).
 */
const fs = require('fs');
const path = require('path');

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || process.env.VAULT_PATH || (
    process.platform === 'win32'
        ? 'C:\\Users\\Geovanni\\Documents\\Obsidian Vault'
        : '/home/ubuntu/obsidian-vault'
);

function vaultPath(...segments) {
    return path.join(VAULT_PATH, ...segments);
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Lê uma nota do vault. Retorna null se não existir.
 */
function readNote(...segments) {
    const filePath = vaultPath(...segments);
    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8');
        }
    } catch (e) {
        console.error(`❌ [VaultWriter] Erro ao ler "${segments.join('/')}":`, e.message);
    }
    return null;
}

/**
 * Cria uma nova nota no vault. Não sobrescreve se já existir (a menos que force=true).
 */
function createNote(folder, filename, content, frontmatter = null) {
    const dirPath = vaultPath(...folder.split('/'));
    ensureDir(dirPath);

    const filePath = path.join(dirPath, filename.endsWith('.md') ? filename : `${filename}.md`);

    if (fs.existsSync(filePath)) {
        console.log(`⚠️ [VaultWriter] Nota já existe: ${folder}/${filename}`);
        return { success: false, error: 'already_exists', path: filePath };
    }

    let fullContent = '';
    if (frontmatter && Object.keys(frontmatter).length > 0) {
        fullContent += '---\n';
        for (const [key, value] of Object.entries(frontmatter)) {
            fullContent += `${key}: ${value}\n`;
        }
        fullContent += '---\n\n';
    }
    fullContent += content;

    try {
        fs.writeFileSync(filePath, fullContent, 'utf-8');
        console.log(`📄 [VaultWriter] Nota criada: ${folder}/${filename}`);
        return { success: true, path: filePath };
    } catch (e) {
        console.error(`❌ [VaultWriter] Erro ao criar "${folder}/${filename}":`, e.message);
        return { success: false, error: e.message, path: filePath };
    }
}

/**
 * Edita uma nota existente substituindo uma string exata por outra.
 * Padrão inspirado no Claude Code Edit.
 * Retorna false se a string antiga não for encontrada (ou for ambígua sem replace_all).
 */
function editNote(filePathOrSegments, oldString, newString) {
    const filePath = Array.isArray(filePathOrSegments)
        ? vaultPath(...filePathOrSegments)
        : filePathOrSegments;

    const content = readNote(filePath);
    if (content === null) {
        console.error(`❌ [VaultWriter] Arquivo não encontrado para edição: ${filePath}`);
        return { success: false, error: 'not_found' };
    }

    const count = (content.match(new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

    if (count === 0) {
        console.error(`❌ [VaultWriter] String não encontrada no arquivo: "${oldString.substring(0, 80)}..."`);
        return { success: false, error: 'string_not_found' };
    }

    if (count > 1) {
        console.error(`❌ [VaultWriter] String ambígua (${count} ocorrências): "${oldString.substring(0, 80)}..."`);
        return { success: false, error: 'ambiguous', count };
    }

    const newContent = content.replace(oldString, newString);

    try {
        fs.writeFileSync(filePath, newContent, 'utf-8');
        console.log(`✏️ [VaultWriter] Editado: ${path.basename(filePath)}`);
        return { success: true };
    } catch (e) {
        console.error(`❌ [VaultWriter] Erro ao editar:`, e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Adiciona conteúdo a uma seção específica de uma nota.
 * Se a seção não existir, cria ao final do arquivo.
 * Se o arquivo não existir, cria com a seção.
 */
function appendToSection(filePathOrSegments, sectionName, content) {
    const filePath = Array.isArray(filePathOrSegments)
        ? vaultPath(...filePathOrSegments)
        : filePathOrSegments;

    let fileContent = readNote(filePath) || '';

    // Procura o heading da seção (ex: "## O que foi feito")
    const sectionRegex = new RegExp(`^${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
    const sectionMatch = fileContent.match(sectionRegex);

    if (sectionMatch) {
        // Encontra a posição após o heading para inserir
        const insertPos = fileContent.indexOf(sectionMatch[0]) + sectionMatch[0].length;
        // Procura o próximo heading de mesmo nível ou superior (## ou #)
        const nextHeading = fileContent.slice(insertPos).match(/\n(?:^#[^#]|^##\s)/m);
        const endPos = nextHeading
            ? insertPos + nextHeading.index
            : fileContent.length;

        const before = fileContent.slice(0, endPos);
        const after = fileContent.slice(endPos);
        const separator = before.endsWith('\n') ? '' : '\n';

        fileContent = before + separator + content + (content.endsWith('\n') ? '' : '\n') + after;
    } else {
        // Seção não existe — adiciona ao final
        fileContent += `\n${sectionName}\n${content}\n`;
    }

    try {
        fs.writeFileSync(filePath, fileContent, 'utf-8');
        console.log(`➕ [VaultWriter] Adicionado à seção "${sectionName}" em: ${path.basename(filePath)}`);
        return { success: true };
    } catch (e) {
        console.error(`❌ [VaultWriter] Erro ao adicionar à seção:`, e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Verifica se uma nota existe
 */
function noteExists(...segments) {
    return fs.existsSync(vaultPath(...segments));
}

module.exports = {
    vaultPath,
    ensureDir,
    readNote,
    createNote,
    editNote,
    appendToSection,
    noteExists
};
