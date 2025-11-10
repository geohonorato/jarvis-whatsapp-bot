/**
 * Configuração centralizada do sistema
 * Valida e exporta todas as configurações necessárias
 */
require('dotenv').config();

class ConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigurationError';
    }
}

/**
 * Valida uma variável de ambiente obrigatória
 */
function requireEnv(key, defaultValue = null) {
    const value = process.env[key];
    if (!value && defaultValue === null) {
        throw new ConfigurationError(`Variável de ambiente obrigatória não definida: ${key}`);
    }
    return value || defaultValue;
}

/**
 * Valida e retorna um número inteiro da variável de ambiente
 */
function getEnvInt(key, defaultValue) {
    const value = process.env[key];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new ConfigurationError(`Variável ${key} deve ser um número inteiro válido`);
    }
    return parsed;
}

/**
 * Configurações do sistema
 */
const config = {
    // Ambiente
    env: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',

    // APIs
    api: {
        gemini: {
            key: requireEnv('GEMINI_API_KEY'),
            model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
            maxRetries: getEnvInt('GEMINI_MAX_RETRIES', 3),
            timeout: getEnvInt('GEMINI_TIMEOUT', 60000),
        },
        magisterium: {
            key: process.env.MAGISTERIUM_API_KEY || '',
            enabled: !!process.env.MAGISTERIUM_API_KEY,
        },
        calendar: {
            id: requireEnv('CALENDAR_ID'),
            credentialsPath: process.env.CALENDAR_CREDENTIALS_PATH || 'credentials.json',
        },
    },

    // WhatsApp
    whatsapp: {
        number: requireEnv('WHATSAPP_NUMBER', '559184527196@c.us'),
        maxReconnectAttempts: getEnvInt('WHATSAPP_MAX_RECONNECT', 3),
        reconnectDelay: getEnvInt('WHATSAPP_RECONNECT_DELAY', 5000),
        qrTimeout: getEnvInt('WHATSAPP_QR_TIMEOUT', 60000),
    },

    // Cache e Memória
    cache: {
        // Tempo de vida do cache em milissegundos
        eventsTTL: getEnvInt('CACHE_EVENTS_TTL', 5 * 60 * 1000), // 5 minutos
        maxHistoryMessages: getEnvInt('MAX_HISTORY_MESSAGES', 100), // 50 turnos = 100 mensagens
        maxHistoryAge: getEnvInt('MAX_HISTORY_AGE', 24 * 60 * 60 * 1000), // 24 horas
        cleanupInterval: getEnvInt('CACHE_CLEANUP_INTERVAL', 60 * 60 * 1000), // 1 hora
    },

    // Processamento
    processing: {
        maxConcurrentMessages: getEnvInt('MAX_CONCURRENT_MESSAGES', 5),
        messageTimeout: getEnvInt('MESSAGE_TIMEOUT', 30000),
        debounceDelay: getEnvInt('DEBOUNCE_DELAY', 1000),
        queueSize: getEnvInt('QUEUE_SIZE', 100),
    },

    // Lembretes
    reminders: {
        enabled: process.env.REMINDERS_ENABLED !== 'false',
        checkInterval: getEnvInt('REMINDERS_CHECK_INTERVAL', 60 * 1000), // 1 minuto
        notificationTimes: [1440, 300, 60], // 24h, 5h, 1h em minutos
    },

    // Arquivos temporários
    temp: {
        imagesDir: process.env.TEMP_IMAGES_DIR || 'temp_images',
        tempDir: process.env.TEMP_DIR || 'temp',
        cleanupInterval: getEnvInt('TEMP_CLEANUP_INTERVAL', 60 * 60 * 1000), // 1 hora
        maxAge: getEnvInt('TEMP_MAX_AGE', 24 * 60 * 60 * 1000), // 24 horas
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info', // debug, info, warn, error
        enabled: process.env.LOGGING_ENABLED !== 'false',
        includeTimestamp: process.env.LOG_TIMESTAMP !== 'false',
    },

    // Timezone
    timezone: process.env.TZ || 'America/Sao_Paulo',

    // Rate Limiting
    rateLimit: {
        enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
        maxRequestsPerMinute: getEnvInt('MAX_REQUESTS_PER_MINUTE', 30),
        maxRequestsPerHour: getEnvInt('MAX_REQUESTS_PER_HOUR', 500),
    },

    // Health Check
    healthCheck: {
        enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
        interval: getEnvInt('HEALTH_CHECK_INTERVAL', 5 * 60 * 1000), // 5 minutos
    },
};

/**
 * Valida a configuração completa
 */
function validateConfig() {
    const errors = [];

    // Validações adicionais
    if (config.cache.maxHistoryMessages < 10) {
        errors.push('MAX_HISTORY_MESSAGES deve ser pelo menos 10');
    }

    if (config.processing.maxConcurrentMessages < 1) {
        errors.push('MAX_CONCURRENT_MESSAGES deve ser pelo menos 1');
    }

    if (config.reminders.notificationTimes.length === 0) {
        errors.push('Pelo menos um tempo de notificação deve ser configurado');
    }

    if (errors.length > 0) {
        throw new ConfigurationError(`Erros de configuração:\n${errors.join('\n')}`);
    }

    return true;
}

// Valida na inicialização
try {
    validateConfig();
    console.log('✅ Configuração validada com sucesso');
} catch (error) {
    console.error('❌ Erro na configuração:', error.message);
    process.exit(1);
}

module.exports = config;
