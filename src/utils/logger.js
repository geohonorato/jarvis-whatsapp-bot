/**
 * Sistema de logging estruturado
 * Fornece logs com níveis, timestamps e formatação adequada
 */
const config = require('../config');

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const COLORS = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m',  // Green
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
    reset: '\x1b[0m',
};

const ICONS = {
    debug: '🔍',
    info: '📘',
    warn: '⚠️',
    error: '❌',
};

class Logger {
    constructor(context = 'App') {
        this.context = context;
        this.minLevel = LOG_LEVELS[config.logging.level] || LOG_LEVELS.info;
    }

    /**
     * Formata a mensagem de log
     */
    _format(level, message, data = null) {
        const timestamp = config.logging.includeTimestamp 
            ? new Date().toISOString() 
            : '';
        
        const color = COLORS[level] || COLORS.reset;
        const icon = ICONS[level] || '';
        
        let formatted = `${color}${icon} [${level.toUpperCase()}]${COLORS.reset}`;
        
        if (timestamp) {
            formatted += ` ${timestamp}`;
        }
        
        formatted += ` [${this.context}] ${message}`;
        
        return { formatted, data };
    }

    /**
     * Verifica se o log deve ser exibido
     */
    _shouldLog(level) {
        return config.logging.enabled && LOG_LEVELS[level] >= this.minLevel;
    }

    /**
     * Log genérico
     */
    _log(level, message, data = null) {
        if (!this._shouldLog(level)) return;

        const { formatted, data: logData } = this._format(level, message, data);
        
        if (level === 'error') {
            console.error(formatted);
            if (logData) console.error(logData);
        } else if (level === 'warn') {
            console.warn(formatted);
            if (logData) console.warn(logData);
        } else {
            console.log(formatted);
            if (logData) console.log(logData);
        }
    }

    /**
     * Métodos de log por nível
     */
    debug(message, data = null) {
        this._log('debug', message, data);
    }

    info(message, data = null) {
        this._log('info', message, data);
    }

    warn(message, data = null) {
        this._log('warn', message, data);
    }

    error(message, data = null) {
        this._log('error', message, data);
    }

    /**
     * Log de operação bem-sucedida
     */
    success(message, data = null) {
        this._log('info', `✅ ${message}`, data);
    }

    /**
     * Log de início de operação
     */
    start(message, data = null) {
        this._log('info', `🚀 ${message}`, data);
    }

    /**
     * Log de performance
     */
    perf(operation, duration) {
        this._log('debug', `⏱️ ${operation} completou em ${duration}ms`);
    }

    /**
     * Cria um logger filho com contexto adicional
     */
    child(subContext) {
        return new Logger(`${this.context}:${subContext}`);
    }
}

// Instância padrão
const logger = new Logger('CalendarAI');

module.exports = { Logger, logger };
