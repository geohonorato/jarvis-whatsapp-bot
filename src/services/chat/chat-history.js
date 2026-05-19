/**
 * Gerenciador de histórico de chat otimizado
 * Usa Map para armazenar histórico com limpeza automática
 */
const config = require('../../config');
const { logger } = require('../../utils/logger');

// Mapa para armazenar o histórico de conversas por chat
const chatHistory = new Map();
const chatMetadata = new Map(); // Armazena metadata (timestamp, etc)

const MAX_MESSAGES = config.cache.maxHistoryMessages;
const MAX_AGE = config.cache.maxHistoryAge;
const COMPACTION_THRESHOLD = 12; // Compacta quando atinge 12 mensagens
const KEEP_RECENT = 6; // Mantém as últimas 6 mensagens intactas
const log = logger.child('ChatHistory');

// Sumário compactado por chat (acumulativo)
const compactedSummaries = new Map();

/**
 * Verifica se o chat precisa de compactação
 */
function needsCompaction(chatId) {
    const historico = chatHistory.get(chatId);
    return historico && historico.length >= COMPACTION_THRESHOLD;
}

/**
 * Retorna as mensagens antigas prontas pra sumarização via IA.
 * Retorna null se não precisar compactar.
 */
function getCompactionPayload(chatId) {
    const historico = chatHistory.get(chatId);
    if (!historico || historico.length < COMPACTION_THRESHOLD) return null;

    const oldMessages = historico.slice(0, historico.length - KEEP_RECENT);
    const existingSummary = compactedSummaries.get(chatId) || '';

    const lines = oldMessages.map(m => {
        const role = m.role === 'user' ? 'Geovanni' : 'Jarvis';
        const text = m.parts.map(p => p.text || '').join(' ');
        return `${role}: ${text}`;
    }).join('\n');

    return { lines, existingSummary };
}

/**
 * Aplica a compactação: remove mensagens antigas e guarda o sumário
 */
function applyCompaction(chatId, newSummary) {
    const historico = chatHistory.get(chatId);
    if (!historico) return;

    // Remove as mensagens antigas (mantém só as KEEP_RECENT mais recentes)
    const recentMessages = historico.slice(-KEEP_RECENT);
    chatHistory.set(chatId, recentMessages);

    // Atualiza o sumário acumulativo
    const existing = compactedSummaries.get(chatId) || '';
    compactedSummaries.set(chatId, existing ? `${existing}\n${newSummary}` : newSummary);

    console.log(`📦 [Compactação] ${chatId}: ${historico.length} → ${recentMessages.length} mensagens. Sumário acumulado: ${compactedSummaries.get(chatId).length} chars`);
}

/**
 * Adiciona mensagem ao histórico com limpeza automática
 */
function adicionarAoHistorico(chatId, role, parts) {
    if (!chatHistory.has(chatId)) {
        chatHistory.set(chatId, []);
        chatMetadata.set(chatId, {
            createdAt: Date.now(),
            lastActivity: Date.now(),
            messageCount: 0,
        });
    }

    const historico = chatHistory.get(chatId);
    const metadata = chatMetadata.get(chatId);

    // Garante que parts seja sempre um array
    const partsArray = Array.isArray(parts) ? parts : [{ text: String(parts) }];

    historico.push({
        role,
        parts: partsArray,
        timestamp: Date.now(),
    });

    // Atualiza metadata
    metadata.lastActivity = Date.now();
    metadata.messageCount++;

    // Mantém apenas as últimas N mensagens
    if (historico.length > MAX_MESSAGES) {
        const removed = historico.splice(0, historico.length - MAX_MESSAGES);
        log.debug(`Histórico de ${chatId} truncado: ${removed.length} mensagens antigas removidas`);
    }

    chatHistory.set(chatId, historico);
    chatMetadata.set(chatId, metadata);
}

/**
 * Obtém histórico do chat (sem timestamps internos para compatibilidade)
 */
function obterHistorico(chatId) {
    const historico = chatHistory.get(chatId);
    if (!historico) return [];

    // Remove mensagens muito antigas
    const now = Date.now();
    const filtered = historico.filter(msg => {
        return !msg.timestamp || (now - msg.timestamp) < MAX_AGE;
    });

    // Se removeu mensagens, atualiza o histórico
    if (filtered.length < historico.length) {
        chatHistory.set(chatId, filtered);
        log.debug(`Histórico de ${chatId}: ${historico.length - filtered.length} mensagens antigas removidas`);
    }

    // Retorna sem os timestamps para compatibilidade com código existente
    const messages = filtered.map(msg => ({
        role: msg.role,
        parts: msg.parts,
    }));

    // Prepend sumário compactado se existir (economiza tokens)
    const summary = compactedSummaries.get(chatId);
    if (summary) {
        messages.unshift({
            role: 'system',
            parts: [{ text: `[RESUMO DA CONVERSA ANTERIOR]\n${summary}\n[/RESUMO]` }]
        });
    }

    return messages;
}

/**
 * Obtém histórico do chat desde um timestamp específico
 */
function obterHistoricoDesde(chatId, startTime) {
    const historico = chatHistory.get(chatId);
    if (!historico) return [];

    const filtered = historico.filter(msg => {
        return msg.timestamp && msg.timestamp >= startTime;
    });

    return filtered.map(msg => ({
        role: msg.role,
        parts: msg.parts,
        timestamp: msg.timestamp
    }));
}

/**
 * Limpa histórico de um chat específico ou de todos
 */
function limparHistorico(chatId) {
    if (chatId) {
        if (chatHistory.has(chatId)) {
            chatHistory.delete(chatId);
            chatMetadata.delete(chatId);
            log.info(`Histórico da conversa ${chatId} limpo`);
        }
    } else {
        const count = chatHistory.size;
        chatHistory.clear();
        chatMetadata.clear();
        log.info(`Histórico de todas as conversas limpo (${count} chats)`);
    }
}

/**
 * Limpa históricos inativos (último uso > MAX_AGE)
 */
function limparHistoricosInativos() {
    const now = Date.now();
    let removed = 0;

    for (const [chatId, metadata] of chatMetadata.entries()) {
        if (now - metadata.lastActivity > MAX_AGE) {
            chatHistory.delete(chatId);
            chatMetadata.delete(chatId);
            removed++;
        }
    }

    if (removed > 0) {
        log.info(`Limpeza automática: ${removed} históricos inativos removidos`);
    }

    return removed;
}

/**
 * Obtém estatísticas dos históricos
 */
function obterEstatisticas() {
    let totalMessages = 0;
    for (const historico of chatHistory.values()) {
        totalMessages += historico.length;
    }

    return {
        totalChats: chatHistory.size,
        totalMessages,
        avgMessagesPerChat: chatHistory.size > 0 ? Math.round(totalMessages / chatHistory.size) : 0,
        maxMessages: MAX_MESSAGES,
        maxAge: MAX_AGE,
    };
}

/**
 * Inicia limpeza automática periódica
 */
function iniciarLimpezaAutomatica() {
    const interval = config.cache.cleanupInterval;
    setInterval(() => {
        limparHistoricosInativos();
    }, interval);

    log.info(`Limpeza automática de históricos iniciada (intervalo: ${interval}ms)`);
}

// Inicia limpeza automática
iniciarLimpezaAutomatica();

module.exports = {
    adicionarAoHistorico,
    obterHistorico,
    obterHistoricoDesde,
    limparHistorico,
    limparHistoricosInativos,
    obterEstatisticas,
    needsCompaction,
    getCompactionPayload,
    applyCompaction,
}; 