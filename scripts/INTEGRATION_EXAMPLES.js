/**
 * EXEMPLO DE INTEGRAÇÃO DAS MELHORIAS
 * 
 * Este arquivo demonstra como integrar as novas funcionalidades
 * nos serviços existentes do projeto.
 */

// ===================================
// 1. EXEMPLO: Atualizar calendar.js com cache e resilience
// ===================================

/*
const { LRUCache } = require('../utils/cache');
const { withRetry, CircuitBreaker } = require('../utils/resilience');
const { logger } = require('../utils/logger');
const config = require('../config');

// Criar cache para eventos
const eventsCache = new LRUCache(50, config.cache.eventsTTL);

// Criar circuit breaker para Google Calendar API
const calendarBreaker = new CircuitBreaker({
    name: 'GoogleCalendar',
    failureThreshold: 5,
    timeout: 10000,
});

const log = logger.child('Calendar');

async function listarEventos(auth) {
    const cacheKey = 'eventos_hoje';
    
    // Tenta obter do cache
    return await eventsCache.getOrSet(cacheKey, async () => {
        log.debug('Cache miss - buscando eventos do Google Calendar');
        
        // Usa circuit breaker e retry
        return await calendarBreaker.execute(async () => {
            return await withRetry(
                async () => {
                    const calendar = google.calendar({ version: 'v3', auth });
                    const agora = new Date();
                    const fimDoDia = new Date(agora);
                    fimDoDia.setHours(23, 59, 59, 999);

                    const res = await calendar.events.list({
                        calendarId: CALENDAR_ID,
                        timeMin: agora.toISOString(),
                        timeMax: fimDoDia.toISOString(),
                        singleEvents: true,
                        orderBy: 'startTime',
                    });
                    
                    log.success(`${res.data.items.length} eventos encontrados`);
                    return res.data.items;
                },
                {
                    maxAttempts: 3,
                    operationName: 'ListarEventos',
                }
            );
        });
    });
}
*/

// ===================================
// 2. EXEMPLO: Atualizar message-handler.js com fila
// ===================================

/*
const { messageQueue } = require('../utils/message-queue');
const { validateMessage } = require('../utils/validator');
const { logger } = require('../utils/logger');

const log = logger.child('MessageHandler');

async function handleMessage(msg, client) {
    try {
        // Valida mensagem
        const validation = validateMessage(msg);
        if (!validation.valid) {
            log.warn('Mensagem inválida rejeitada', { error: validation.error });
            return;
        }

        const chatId = msg.from;

        // Adiciona à fila com debounce para evitar spam
        await messageQueue.enqueueWithDebounce(
            chatId,
            msg,
            async (message) => {
                return await processarMensagem(message, client);
            },
            1000 // 1 segundo de debounce
        );

    } catch (error) {
        log.error('Erro ao enfileirar mensagem', error);
    }
}

async function processarMensagem(msg, client) {
    const startTime = Date.now();
    const chatId = msg.from;
    
    try {
        log.info(`Processando mensagem de ${chatId}`);
        
        // ... lógica existente ...
        
        const duration = Date.now() - startTime;
        log.perf('ProcessarMensagem', duration);
        
    } catch (error) {
        log.error('Erro ao processar mensagem', error);
        throw error;
    }
}
*/

// ===================================
// 3. EXEMPLO: Atualizar index.js com inicialização
// ===================================

/*
require("dotenv").config();
const config = require('./config');
const { logger } = require('./utils/logger');
const { tempFileManager } = require('./utils/temp-manager');
const { healthCheck, registerDefaultHealthChecks } = require('./utils/health-check');
const { client } = require('./services/bot/whatsapp');

const log = logger.child('Main');

async function inicializar() {
    try {
        log.start('Iniciando CalendarAI Bot...');

        // 1. Inicializa gerenciador de arquivos temporários
        log.info('Inicializando gerenciador de arquivos temporários...');
        await tempFileManager.init();

        // 2. Registra e inicia health checks
        log.info('Configurando health checks...');
        registerDefaultHealthChecks();
        healthCheck.startMonitoring();

        // 3. Exibe configurações (apenas em dev)
        if (config.isDevelopment) {
            log.debug('Configurações carregadas:', {
                maxHistoryMessages: config.cache.maxHistoryMessages,
                maxConcurrentMessages: config.processing.maxConcurrentMessages,
                cacheEnabled: config.cache.eventsTTL > 0,
            });
        }

        log.success('CalendarAI Bot iniciado com sucesso!');

    } catch (error) {
        log.error('Erro fatal na inicialização', error);
        process.exit(1);
    }
}

// Tratamento de sinais para shutdown gracioso
process.on('SIGINT', async () => {
    log.warn('Recebido SIGINT, encerrando graciosamente...');
    
    // Limpa recursos
    tempFileManager.destroy();
    healthCheck.destroy();
    
    process.exit(0);
});

process.on('SIGTERM', async () => {
    log.warn('Recebido SIGTERM, encerrando graciosamente...');
    
    // Limpa recursos
    tempFileManager.destroy();
    healthCheck.destroy();
    
    process.exit(0);
});

// Inicia aplicação
inicializar();
*/

// ===================================
// 4. EXEMPLO: Atualizar gemini.js com rate limiting
// ===================================

/*
const { RateLimiter } = require('../utils/resilience');
const { logger } = require('../utils/logger');

const log = logger.child('Gemini');

// Rate limiter para Gemini API (30 req/min)
const geminiRateLimiter = new RateLimiter({
    name: 'GeminiAPI',
    maxRequests: 30,
    window: 60000, // 1 minuto
});

async function processarMensagemMultimodal(parts, historico = [], tentativa = 1) {
    try {
        log.debug('Processando entrada multimodal com Gemini...');

        // Aguarda rate limiter
        await geminiRateLimiter.acquire();

        // ... resto da lógica existente ...

    } catch (error) {
        log.error('Erro ao processar com Gemini', error);
        throw error;
    }
}
*/

// ===================================
// 5. EXEMPLO: Monitoramento de métricas
// ===================================

/*
const { messageQueue } = require('../utils/message-queue');
const { healthCheck } = require('../utils/health-check');
const { logger } = require('../utils/logger');

const log = logger.child('Metrics');

// Exibe métricas a cada 5 minutos
setInterval(() => {
    const queueStats = messageQueue.getStats();
    const healthStatus = healthCheck.getStatus();
    
    log.info('Métricas do sistema:', {
        queue: {
            size: queueStats.queueSize,
            processing: queueStats.processing,
            processed: queueStats.processed,
            failed: queueStats.failed,
        },
        health: {
            status: healthStatus.status,
            healthy: healthStatus.summary?.healthy,
            unhealthy: healthStatus.summary?.unhealthy,
        },
        memory: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        },
    });
}, 5 * 60 * 1000);
*/

// ===================================
// 6. EXEMPLO: Sanitização de inputs em eventos
// ===================================

/*
const { sanitizeEventData, validateEventData } = require('../utils/validator');
const { logger } = require('../utils/logger');

const log = logger.child('EventValidation');

async function adicionarEvento(auth, eventoInfo) {
    try {
        const calendar = google.calendar({version: 'v3', auth});
        
        // Parse das informações
        const [titulo, dataInicio, dataFim, descricao, local] = 
            eventoInfo.split('|').map(item => item.trim());
        
        // Cria objeto do evento
        const eventData = {
            title: titulo,
            startDate: dataInicio,
            endDate: dataFim,
            description: descricao,
            location: local,
        };

        // Valida dados
        const validation = validateEventData(eventData);
        if (!validation.valid) {
            log.warn('Dados de evento inválidos', { errors: validation.errors });
            throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
        }

        // Sanitiza dados
        const cleanData = sanitizeEventData(eventData);

        const evento = {
            summary: cleanData.title,
            description: cleanData.description,
            location: cleanData.location,
            start: {
                dateTime: new Date(cleanData.startDate).toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
            end: {
                dateTime: new Date(cleanData.endDate).toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
        };

        const response = await calendar.events.insert({
            calendarId: CALENDAR_ID,
            resource: evento,
        });

        log.success('Evento adicionado com sucesso', { id: response.data.id });
        return response.data;
        
    } catch (error) {
        log.error('Erro ao adicionar evento', error);
        throw error;
    }
}
*/

// ===================================
// 7. EXEMPLO: Health Check customizado
// ===================================

/*
const { healthCheck } = require('../utils/health-check');

// Registra verificação de conexão com WhatsApp
healthCheck.register('whatsapp', async () => {
    const { client } = require('./services/bot/whatsapp');
    
    // Verifica se o cliente está pronto
    if (!client || !client.info) {
        throw new Error('WhatsApp client not ready');
    }
    
    return {
        status: 'connected',
        number: client.info.wid._serialized,
    };
}, {
    critical: true,
    timeout: 5000,
});

// Registra verificação de espaço em disco
healthCheck.register('disk-space', async () => {
    const { tempFileManager } = require('../utils/temp-manager');
    const stats = await tempFileManager.stats();
    
    const totalSize = stats.total.size;
    const maxSize = 100 * 1024 * 1024; // 100MB
    
    if (totalSize > maxSize) {
        throw new Error(`Disk space exceeded: ${Math.round(totalSize / 1024 / 1024)}MB`);
    }
    
    return {
        used: Math.round(totalSize / 1024 / 1024) + 'MB',
        files: stats.total.count,
    };
}, {
    critical: false,
    timeout: 3000,
});
*/

module.exports = {
    // Este arquivo é apenas para referência/documentação
    // Os exemplos acima mostram como integrar as melhorias
};
