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
const log = logger.child('ChatHistory');

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
    return filtered.map(msg => ({
        role: msg.role,
        parts: msg.parts,
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
    limparHistorico,
    limparHistoricosInativos,
    obterEstatisticas,
}; 