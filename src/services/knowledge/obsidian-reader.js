const fs = require('fs');
const path = require('path');

const VAULT_PATH = process.env.VAULT_PATH || (
    process.platform === 'win32' 
        ? 'C:\\Users\\Geovanni\\Documents\\Obsidian Vault' 
        : '/home/ubuntu/obsidian-vault'
);

// Cache do perfil — carregado uma vez, reutilizado para sempre
let _perfilCache = null;
let _perfilCacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

// Limite máximo de caracteres por nota injetada (evita explodir tokens)
const MAX_NOTE_CHARS = 2000;

/**
 * Retorna o Perfil Geovanni condensado (cache de 30 min)
 * Custo: ~500 tokens (em vez dos 5000+ anteriores)
 */
function getPerfilCondensado() {
    const agora = Date.now();
    if (_perfilCache && (agora - _perfilCacheTime) < CACHE_TTL) {
        return _perfilCache;
    }

    const perfilPath = path.join(VAULT_PATH, '20 - Áreas', 'Clone Digital', 'Perfil Geovanni.md');
    
    if (!fs.existsSync(perfilPath)) {
        console.warn('⚠️ Perfil Geovanni.md não encontrado no vault');
        _perfilCache = '';
        _perfilCacheTime = agora;
        return '';
    }

    try {
        const raw = fs.readFileSync(perfilPath, 'utf-8');
        // Pega só as primeiras seções essenciais (nome, personalidade, tom de voz)
        // Corta antes de seções muito técnicas/longas
        const condensado = raw.substring(0, MAX_NOTE_CHARS);
        _perfilCache = condensado;
        _perfilCacheTime = agora;
        console.log(`📋 Perfil Geovanni carregado em cache (${condensado.length} chars)`);
        return condensado;
    } catch (error) {
        console.error('❌ Erro ao ler Perfil Geovanni:', error.message);
        _perfilCache = '';
        _perfilCacheTime = agora;
        return '';
    }
}

/**
 * Detecta se a mensagem do usuário pede informação que pode estar no vault
 * Retorna keywords para busca, ou null se não precisar de RAG
 */
function detectarNecessidadeRAG(mensagem) {
    const lower = mensagem.toLowerCase();
    
    // Padrões que indicam necessidade de buscar no vault
    const patterns = [
        { regex: /(?:o que|qual|quais|me fala|me conta|explica|resuma?).+(?:pascom|pastoral|comunica)/i, search: 'Pascom' },
        { regex: /(?:o que|qual|quais|me fala|me conta|explica|resuma?).+(?:coroinha|acólito|formação litúrgica)/i, search: 'Coroinhas' },
        { regex: /(?:o que|qual|quais|me fala|me conta|explica|resuma?).+(?:siqma|qualidade.*água|monitoramento)/i, search: 'SIQMA' },
        { regex: /(?:o que|qual|quais|me fala|me conta|explica|resuma?).+(?:veritas|ponto eletrônico|biometria)/i, search: 'Veritas' },
        { regex: /(?:identidade visual|brandbook|design system|marca.*cristo rei)/i, search: 'Identidade Visual' },
        { regex: /(?:próximos? passos?|pendências?|tarefas?.*pascom)/i, search: 'PROXIMOS_PASSOS' },
        { regex: /(?:o que temos? pra hoje|tarefas?|to.do|pendente)/i, search: '01 - Tarefas' },
        { regex: /(?:mapa|estrutura|organização).*(?:vault|obsidian|notas)/i, search: '00 - Mapa' },
    ];

    for (const p of patterns) {
        if (p.regex.test(lower)) {
            return p.search;
        }
    }

    return null;
}

/**
 * Busca por uma nota específica no Vault a partir do nome
 * Retorna conteúdo truncado para economizar tokens
 */
function readSpecificNote(searchName) {
    try {
        const result = findFileRecursive(VAULT_PATH, searchName);
        if (result) {
            const content = fs.readFileSync(result, 'utf-8');
            if (content.length > MAX_NOTE_CHARS) {
                console.log(`✂️ Nota "${searchName}" truncada: ${content.length} → ${MAX_NOTE_CHARS} chars`);
                return content.substring(0, MAX_NOTE_CHARS) + '\n\n... [NOTA TRUNCADA PARA ECONOMIA DE TOKENS]';
            }
            return content;
        }
    } catch (error) {
        console.error(`❌ Erro ao buscar/ler a nota ${searchName}:`, error.message);
    }
    return null;
}

/**
 * Pipeline inteligente de RAG: só injeta contexto quando necessário
 * Custo médio: ~500 tokens (perfil) + 0-500 tokens (nota sob demanda)
 * vs. antigo: ~5000 tokens fixos a cada mensagem
 */
function buildSmartContext(mensagemUsuario) {
    let context = '';
    
    // 1. Perfil sempre presente (condensado, cacheado)
    const perfil = getPerfilCondensado();
    if (perfil) {
        context += '=== PERFIL DO CRIADOR ===\n' + perfil + '\n\n';
    }

    // 2. RAG sob demanda: só busca se a mensagem pedir
    const searchTerm = detectarNecessidadeRAG(mensagemUsuario);
    if (searchTerm) {
        console.log(`🔍 RAG ativado: buscando "${searchTerm}" no vault...`);
        const nota = readSpecificNote(searchTerm);
        if (nota) {
            context += `=== NOTA DO VAULT: ${searchTerm} ===\n${nota}\n\n`;
            console.log(`📄 Nota "${searchTerm}" injetada com sucesso`);
        } else {
            console.log(`⚠️ Nota "${searchTerm}" não encontrada no vault`);
        }
    }

    return context;
}

function findFileRecursive(dir, searchStr) {
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            if (file === '.git' || file === '.obsidian' || file === 'node_modules' || file === '.agent' || file === 'assets') continue;
            
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                const found = findFileRecursive(fullPath, searchStr);
                if (found) return found;
            } else if (file.toLowerCase().includes(searchStr.toLowerCase()) && file.endsWith('.md')) {
                return fullPath;
            }
        }
    } catch (error) {
        // Ignora erros de permissão em diretórios
    }
    return null;
}

module.exports = {
    getPerfilCondensado,
    readSpecificNote,
    detectarNecessidadeRAG,
    buildSmartContext
};
