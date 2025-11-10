/**
 * Utilitário de retry com backoff exponencial
 * Tenta executar uma operação múltiplas vezes com delay crescente
 */
const { logger } = require('./logger');

/**
 * Executa uma operação com retry
 * @param {Function} operation - Função async a ser executada
 * @param {Object} options - Opções de configuração
 * @returns {Promise} Resultado da operação
 */
async function withRetry(operation, options = {}) {
    const {
        maxAttempts = 3,
        initialDelay = 1000,
        maxDelay = 30000,
        backoffFactor = 2,
        retryOn = () => true, // Função que determina se deve fazer retry
        onRetry = null, // Callback chamado antes de cada retry
        operationName = 'Operation',
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = await operation();
            if (attempt > 1) {
                logger.success(`${operationName} bem-sucedido na tentativa ${attempt}/${maxAttempts}`);
            }
            return result;
        } catch (error) {
            lastError = error;
            
            // Verifica se deve fazer retry
            if (!retryOn(error)) {
                logger.warn(`${operationName} falhou sem retry: ${error.message}`);
                throw error;
            }

            // Se é a última tentativa, não faz retry
            if (attempt === maxAttempts) {
                logger.error(`${operationName} falhou após ${maxAttempts} tentativas`, error);
                throw error;
            }

            // Calcula delay com backoff exponencial
            const currentDelay = Math.min(delay, maxDelay);
            logger.warn(
                `${operationName} falhou (tentativa ${attempt}/${maxAttempts}). ` +
                `Tentando novamente em ${currentDelay}ms... Erro: ${error.message}`
            );

            // Callback antes do retry
            if (onRetry) {
                await onRetry(error, attempt);
            }

            // Aguarda antes de tentar novamente
            await sleep(currentDelay);
            delay *= backoffFactor;
        }
    }

    throw lastError;
}

/**
 * Delay assíncrono
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Circuit Breaker - Previne chamadas repetidas a serviços falhando
 */
class CircuitBreaker {
    constructor(options = {}) {
        this.name = options.name || 'CircuitBreaker';
        this.failureThreshold = options.failureThreshold || 5;
        this.timeout = options.timeout || 60000; // 1 minuto
        this.resetTimeout = options.resetTimeout || 60000; // 1 minuto
        
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.nextAttempt = Date.now();
        this.successCount = 0;
        
        this.logger = logger.child(`CircuitBreaker:${this.name}`);
    }

    /**
     * Executa uma operação através do circuit breaker
     */
    async execute(operation) {
        // Se o circuito está aberto
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                this.logger.warn('Circuit breaker está OPEN - rejeitando requisição');
                throw new Error(`Circuit breaker is OPEN for ${this.name}`);
            }
            // Tempo passou, tenta half-open
            this.state = 'HALF_OPEN';
            this.logger.info('Circuit breaker mudou para HALF_OPEN');
        }

        try {
            // Executa a operação com timeout
            const result = await Promise.race([
                operation(),
                this._timeout(),
            ]);

            // Sucesso
            this._onSuccess();
            return result;
        } catch (error) {
            // Falha
            this._onFailure();
            throw error;
        }
    }

    /**
     * Timeout para a operação
     */
    _timeout() {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Operation timeout after ${this.timeout}ms`));
            }, this.timeout);
        });
    }

    /**
     * Callback de sucesso
     */
    _onSuccess() {
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= 2) {
                this._reset();
                this.logger.success('Circuit breaker FECHADO após sucesso em HALF_OPEN');
            }
        } else {
            this.failureCount = 0;
        }
    }

    /**
     * Callback de falha
     */
    _onFailure() {
        this.failureCount++;
        this.successCount = 0;

        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.resetTimeout;
            this.logger.error(
                `Circuit breaker ABERTO após ${this.failureCount} falhas. ` +
                `Próxima tentativa em ${this.resetTimeout}ms`
            );
        }
    }

    /**
     * Reseta o circuit breaker
     */
    _reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
    }

    /**
     * Obtém o estado atual
     */
    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            nextAttempt: this.nextAttempt,
        };
    }

    /**
     * Reseta manualmente o circuit breaker
     */
    reset() {
        this._reset();
        this.logger.info('Circuit breaker resetado manualmente');
    }
}

/**
 * Rate Limiter - Controla taxa de requisições
 */
class RateLimiter {
    constructor(options = {}) {
        this.maxRequests = options.maxRequests || 10;
        this.window = options.window || 60000; // 1 minuto
        this.name = options.name || 'RateLimiter';
        
        this.requests = [];
        this.logger = logger.child(`RateLimiter:${this.name}`);
    }

    /**
     * Verifica se pode fazer uma requisição
     */
    async acquire() {
        // Remove requisições antigas
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.window);

        // Verifica se atingiu o limite
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = this.window - (now - oldestRequest);
            
            this.logger.warn(
                `Rate limit atingido (${this.requests.length}/${this.maxRequests}). ` +
                `Aguardando ${waitTime}ms...`
            );
            
            await sleep(waitTime);
            return this.acquire(); // Tenta novamente
        }

        // Registra a requisição
        this.requests.push(now);
        return true;
    }

    /**
     * Executa uma operação com rate limiting
     */
    async execute(operation) {
        await this.acquire();
        return operation();
    }

    /**
     * Reseta o rate limiter
     */
    reset() {
        this.requests = [];
        this.logger.info('Rate limiter resetado');
    }

    /**
     * Obtém estatísticas
     */
    stats() {
        const now = Date.now();
        const recentRequests = this.requests.filter(time => now - time < this.window);
        
        return {
            currentRequests: recentRequests.length,
            maxRequests: this.maxRequests,
            window: this.window,
            available: this.maxRequests - recentRequests.length,
        };
    }
}

module.exports = {
    withRetry,
    sleep,
    CircuitBreaker,
    RateLimiter,
};
