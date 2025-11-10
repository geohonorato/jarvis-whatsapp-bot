/**
 * Fila de processamento de mensagens
 * Gerencia concorrência e ordem de processamento
 */
const { logger } = require('./logger');
const config = require('../config');

class MessageQueue {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || config.processing.maxConcurrentMessages;
        this.maxSize = options.maxSize || config.processing.queueSize;
        this.timeout = options.timeout || config.processing.messageTimeout;
        
        this.queue = [];
        this.processing = new Map(); // message.id -> promise
        this.pendingDebounce = new Map(); // chatId -> timer
        this.logger = logger.child('MessageQueue');
        
        // Estatísticas
        this.stats = {
            processed: 0,
            failed: 0,
            timeout: 0,
            rejected: 0,
        };
    }

    /**
     * Adiciona uma mensagem à fila
     */
    async enqueue(message, handler, priority = 0) {
        // Verifica se a fila está cheia
        if (this.queue.length >= this.maxSize) {
            this.stats.rejected++;
            this.logger.warn('Fila cheia - mensagem rejeitada', {
                queueSize: this.queue.length,
                maxSize: this.maxSize,
            });
            throw new Error('Message queue is full');
        }

        const item = {
            id: this._generateId(),
            message,
            handler,
            priority,
            timestamp: Date.now(),
            retries: 0,
        };

        // Adiciona à fila ordenado por prioridade
        const insertIndex = this.queue.findIndex(i => i.priority < priority);
        if (insertIndex === -1) {
            this.queue.push(item);
        } else {
            this.queue.splice(insertIndex, 0, item);
        }

        this.logger.debug(`Mensagem enfileirada: ${item.id} (fila: ${this.queue.length})`);

        // Processa a fila
        this._processQueue();

        return item.id;
    }

    /**
     * Adiciona uma mensagem com debounce
     */
    async enqueueWithDebounce(chatId, message, handler, debounceMs = config.processing.debounceDelay) {
        // Cancela timer anterior se existir
        if (this.pendingDebounce.has(chatId)) {
            clearTimeout(this.pendingDebounce.get(chatId));
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(async () => {
                this.pendingDebounce.delete(chatId);
                try {
                    const id = await this.enqueue(message, handler);
                    resolve(id);
                } catch (error) {
                    reject(error);
                }
            }, debounceMs);

            this.pendingDebounce.set(chatId, timer);
        });
    }

    /**
     * Processa itens da fila
     */
    async _processQueue() {
        // Verifica se pode processar mais
        if (this.processing.size >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }

        // Pega o próximo item
        const item = this.queue.shift();
        if (!item) return;

        // Marca como em processamento
        const promise = this._processItem(item);
        this.processing.set(item.id, promise);

        // Aguarda conclusão
        try {
            await promise;
        } finally {
            this.processing.delete(item.id);
            // Continua processando
            this._processQueue();
        }
    }

    /**
     * Processa um item individual
     */
    async _processItem(item) {
        const startTime = Date.now();
        this.logger.debug(`Processando mensagem: ${item.id}`);

        try {
            // Executa com timeout
            const result = await Promise.race([
                item.handler(item.message),
                this._timeout(item.id),
            ]);

            const duration = Date.now() - startTime;
            this.stats.processed++;
            this.logger.info(`Mensagem processada: ${item.id} (${duration}ms)`);

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;

            if (error.message === 'Message processing timeout') {
                this.stats.timeout++;
                this.logger.error(`Timeout ao processar mensagem: ${item.id} (${duration}ms)`);
            } else {
                this.stats.failed++;
                this.logger.error(`Erro ao processar mensagem: ${item.id} (${duration}ms)`, error);
            }

            throw error;
        }
    }

    /**
     * Timeout para processamento
     */
    _timeout(itemId) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Message processing timeout'));
            }, this.timeout);
        });
    }

    /**
     * Gera ID único para mensagem
     */
    _generateId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Obtém estatísticas da fila
     */
    getStats() {
        return {
            queueSize: this.queue.length,
            processing: this.processing.size,
            maxConcurrent: this.maxConcurrent,
            maxSize: this.maxSize,
            ...this.stats,
        };
    }

    /**
     * Limpa a fila
     */
    clear() {
        const queueSize = this.queue.length;
        this.queue = [];
        
        // Cancela todos os debounces pendentes
        for (const timer of this.pendingDebounce.values()) {
            clearTimeout(timer);
        }
        this.pendingDebounce.clear();

        this.logger.warn(`Fila limpa: ${queueSize} mensagens removidas`);
    }

    /**
     * Aguarda conclusão de todas as mensagens em processamento
     */
    async waitForCompletion() {
        while (this.processing.size > 0 || this.queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    /**
     * Destroy - limpa recursos
     */
    destroy() {
        this.clear();
        this.logger.info('MessageQueue destruída');
    }
}

// Instância singleton
const messageQueue = new MessageQueue();

module.exports = { MessageQueue, messageQueue };
