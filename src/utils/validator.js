/**
 * Validação e sanitização de inputs
 * Protege contra injeção e valida tipos
 */
const { logger } = require('./logger');

const log = logger.child('Validator');

/**
 * Sanitiza texto removendo caracteres perigosos
 */
function sanitizeText(text) {
    if (typeof text !== 'string') {
        return '';
    }

    return text
        .trim()
        // Remove caracteres de controle
        .replace(/[\x00-\x1F\x7F]/g, '')
        // Limita caracteres especiais consecutivos
        .replace(/([^\w\s])\1{3,}/g, '$1$1$1')
        // Remove múltiplos espaços
        .replace(/\s+/g, ' ');
}

/**
 * Valida se é um email válido
 */
function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Valida se é uma URL válida
 */
function isValidUrl(url) {
    if (typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Valida se é uma data válida no formato ISO ou brasileiro
 */
function isValidDate(date) {
    if (typeof date !== 'string') return false;
    
    // Tenta formato ISO (YYYY-MM-DD)
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (isoRegex.test(date)) {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
    }

    // Tenta formato brasileiro (DD/MM/YYYY)
    const brRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (brRegex.test(date)) {
        const [day, month, year] = date.split('/');
        const parsed = new Date(`${year}-${month}-${day}`);
        return !isNaN(parsed.getTime());
    }

    return false;
}

/**
 * Valida se é um horário válido (HH:MM)
 */
function isValidTime(time) {
    if (typeof time !== 'string') return false;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return timeRegex.test(time);
}

/**
 * Valida tamanho de string
 */
function validateStringLength(str, minLength = 0, maxLength = Infinity) {
    if (typeof str !== 'string') return false;
    return str.length >= minLength && str.length <= maxLength;
}

/**
 * Valida se é um número dentro de um range
 */
function validateNumber(num, min = -Infinity, max = Infinity) {
    if (typeof num !== 'number' || isNaN(num)) return false;
    return num >= min && num <= max;
}

/**
 * Valida ID do WhatsApp
 */
function isValidWhatsAppId(id) {
    if (typeof id !== 'string') return false;
    // Formato: número@c.us ou número@g.us (grupo)
    const regex = /^\d+@(c\.us|g\.us)$/;
    return regex.test(id);
}

/**
 * Extrai e valida número de telefone
 */
function extractPhoneNumber(text) {
    if (typeof text !== 'string') return null;
    
    // Remove caracteres não numéricos
    const numbers = text.replace(/\D/g, '');
    
    // Valida formato brasileiro (11-13 dígitos com código de país)
    if (numbers.length >= 11 && numbers.length <= 13) {
        return numbers;
    }
    
    return null;
}

/**
 * Valida comando
 */
function isValidCommand(text) {
    if (typeof text !== 'string') return false;
    return text.startsWith('/') && text.length > 1;
}

/**
 * Extrai comando e argumentos
 */
function parseCommand(text) {
    if (!isValidCommand(text)) return null;
    
    const parts = text.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    return { command, args, raw: text };
}

/**
 * Valida dados de evento
 */
function validateEventData(data) {
    const errors = [];

    if (!data.title || typeof data.title !== 'string') {
        errors.push('Título é obrigatório');
    } else if (!validateStringLength(data.title, 1, 200)) {
        errors.push('Título deve ter entre 1 e 200 caracteres');
    }

    if (!data.startDate) {
        errors.push('Data de início é obrigatória');
    } else if (!isValidDate(data.startDate) && !(data.startDate instanceof Date)) {
        errors.push('Data de início inválida');
    }

    if (data.endDate && !isValidDate(data.endDate) && !(data.endDate instanceof Date)) {
        errors.push('Data de fim inválida');
    }

    if (data.description && !validateStringLength(data.description, 0, 1000)) {
        errors.push('Descrição deve ter no máximo 1000 caracteres');
    }

    if (data.location && !validateStringLength(data.location, 0, 300)) {
        errors.push('Localização deve ter no máximo 300 caracteres');
    }

    if (data.attendees && Array.isArray(data.attendees)) {
        const invalidEmails = data.attendees.filter(email => !isValidEmail(email));
        if (invalidEmails.length > 0) {
            errors.push(`Emails inválidos: ${invalidEmails.join(', ')}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Sanitiza dados de evento
 */
function sanitizeEventData(data) {
    return {
        title: sanitizeText(data.title || ''),
        description: sanitizeText(data.description || ''),
        location: sanitizeText(data.location || ''),
        startDate: data.startDate,
        endDate: data.endDate,
        attendees: Array.isArray(data.attendees) 
            ? data.attendees.filter(isValidEmail)
            : [],
    };
}

/**
 * Valida e sanitiza mensagem de entrada
 */
function validateMessage(msg) {
    try {
        // Valida estrutura básica
        if (!msg || typeof msg !== 'object') {
            log.warn('Mensagem inválida: não é um objeto');
            return { valid: false, error: 'Invalid message structure' };
        }

        // Valida ID do chat
        if (!msg.from || !isValidWhatsAppId(msg.from)) {
            log.warn('Mensagem inválida: ID do chat inválido', { from: msg.from });
            return { valid: false, error: 'Invalid chat ID' };
        }

        // Valida corpo da mensagem se presente
        if (msg.body !== undefined && msg.body !== null) {
            if (typeof msg.body !== 'string') {
                log.warn('Mensagem inválida: corpo não é string');
                return { valid: false, error: 'Invalid message body' };
            }

            // Limita tamanho da mensagem
            const MAX_MESSAGE_LENGTH = 10000;
            if (msg.body.length > MAX_MESSAGE_LENGTH) {
                log.warn('Mensagem muito longa', { length: msg.body.length });
                return { valid: false, error: 'Message too long' };
            }
        }

        return { valid: true };
    } catch (error) {
        log.error('Erro ao validar mensagem', error);
        return { valid: false, error: 'Validation error' };
    }
}

/**
 * Previne SQL Injection (básico)
 */
function preventSQLInjection(text) {
    if (typeof text !== 'string') return '';
    
    // Remove caracteres perigosos para SQL
    return text.replace(/['"`;\\]/g, '');
}

/**
 * Valida JSON
 */
function isValidJSON(text) {
    try {
        JSON.parse(text);
        return true;
    } catch {
        return false;
    }
}

/**
 * Limita array de resultados
 */
function limitArray(arr, maxLength = 100) {
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, maxLength);
}

module.exports = {
    sanitizeText,
    isValidEmail,
    isValidUrl,
    isValidDate,
    isValidTime,
    validateStringLength,
    validateNumber,
    isValidWhatsAppId,
    extractPhoneNumber,
    isValidCommand,
    parseCommand,
    validateEventData,
    sanitizeEventData,
    validateMessage,
    preventSQLInjection,
    isValidJSON,
    limitArray,
};
