const fs = require('fs');
const path = require('path');

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || process.env.VAULT_PATH || (
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
        { regex: /(?:o que|qual|quais|me fala|me conta|explica|resuma?).+(?:fatos|memórias|sobre mim|anotado|lembra)/i, search: 'Fatos do Jarvis' },
        { regex: /(?:mapa|estrutura|organização|caminho|onde fica|onde est[aá]).*(?:vault|obsidian|notas|arquivo|pasta)/i, search: '00 - Mapa' },
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
 * Lista os últimos dias que têm sessão registrada (cache de 1h)
 */
let _recentSessionsCache = null;
let _recentSessionsCacheTime = 0;
const SESSIONS_LIST_CACHE_TTL = 60 * 60 * 1000;

function getRecentSessionDates() {
    const agora = Date.now();
    if (_recentSessionsCache && (agora - _recentSessionsCacheTime) < SESSIONS_LIST_CACHE_TTL) {
        return _recentSessionsCache;
    }

    try {
        const sessionsDir = path.join(VAULT_PATH, '20 - Áreas', 'Clone Digital', 'Diário de Sessões');
        if (!fs.existsSync(sessionsDir)) {
            _recentSessionsCache = [];
            _recentSessionsCacheTime = agora;
            return [];
        }

        const files = fs.readdirSync(sessionsDir)
            .filter(f => f.startsWith('Sessão — ') && f.endsWith('.md'))
            .map(f => f.replace('Sessão — ', '').replace('.md', ''))
            .sort()
            .reverse()
            .slice(0, 7); // Últimos 7 dias

        _recentSessionsCache = files;
        _recentSessionsCacheTime = agora;
        return files;
    } catch (e) {
        _recentSessionsCache = [];
        _recentSessionsCacheTime = agora;
        return [];
    }
}

/**
 * Busca o diário de sessão de hoje (cache de 5 min)
 */
let _sessionDiaryCache = null;
let _sessionDiaryCacheTime = 0;
const SESSION_CACHE_TTL = 5 * 60 * 1000;

function getTodaySessionDiary() {
    const agora = Date.now();
    if (_sessionDiaryCache && (agora - _sessionDiaryCacheTime) < SESSION_CACHE_TTL) {
        return _sessionDiaryCache;
    }

    try {
        // Usa fuso horário brasileiro — servidor OCI roda em UTC
        const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date());
        const todayStr = `${parts.find(p => p.type === 'day').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'year').value}`;
        const filename = `Sessão — ${todayStr}.md`;
        const folder = '20 - Áreas/Clone Digital/Diário de Sessões';
        const result = findFileRecursive(path.join(VAULT_PATH, folder), filename);

        if (result) {
            const content = fs.readFileSync(result, 'utf-8');
            // Pega só "O que foi feito" e "Decisões tomadas" pra economizar tokens
            const feitos = content.match(/## O que foi feito\n([\s\S]*?)(?=\n##|$)/);
            const decisoes = content.match(/## Decisões tomadas\n([\s\S]*?)(?=\n##|$)/);
            let resumo = '';
            if (feitos) resumo += `O que foi feito hoje:\n${feitos[1].trim()}\n`;
            if (decisoes && decisoes[1].trim() !== '-') resumo += `Decisões de hoje: ${decisoes[1].trim()}`;
            _sessionDiaryCache = resumo;
            _sessionDiaryCacheTime = agora;
            return resumo;
        }
    } catch (e) {
        // Silencioso — diário pode não existir ainda
    }
    _sessionDiaryCache = '';
    _sessionDiaryCacheTime = agora;
    return '';
}

/**
 * Pipeline inteligente de RAG: só injeta contexto quando necessário
 * 3 camadas: Perfil (sempre) + Sessão do dia (sempre) + Nota sob demanda
 */
function buildSmartContext(mensagemUsuario) {
    let context = '';

    // 1. Perfil sempre presente (condensado, cacheado)
    const perfil = getPerfilCondensado();
    if (perfil) {
        context += '=== PERFIL DO CRIADOR ===\n' + perfil + '\n\n';
    }

    // 2. Diário de sessão de hoje (sempre, pra manter continuidade entre Claude Code e Jarvis)
    const sessao = getTodaySessionDiary();
    if (sessao) {
        context += `=== SESSÃO DE HOJE ===\n${sessao}\n\n`;
        console.log(`📔 Sessão do dia injetada no contexto`);
    }

    // 2.1 Lista de dias com sessão (evita alucinação de datas)
    const sessoesRecentes = getRecentSessionDates();
    if (sessoesRecentes.length > 0) {
        context += `=== DIAS COM SESSÃO REGISTRADA (últimos 7) ===\n${sessoesRecentes.join(', ')}\n(Se o usuário perguntar sobre um dia que não está nesta lista, diga que não há registro.)\n\n`;
    }

    // 3. RAG sob demanda: só busca se a mensagem pedir
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
