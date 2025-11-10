/**
 * Sistema de cache LRU (Least Recently Used)
 * Implementa cache com TTL e limite de tamanho
 */
const { logger } = require('./logger');

class LRUCache {
    constructor(maxSize = 100, ttl = 5 * 60 * 1000) {
        this.maxSize = maxSize;
        this.ttl = ttl; // Time to live em milissegundos
        this.cache = new Map();
        this.accessOrder = [];
        this.logger = logger.child('Cache');
    }

    /**
     * Verifica se um item está expirado
     */
    _isExpired(item) {
        if (!item.expiresAt) return false;
        return Date.now() > item.expiresAt;
    }

    /**
     * Remove o item menos recentemente usado
     */
    _evictLRU() {
        if (this.accessOrder.length === 0) return;
        
        const lruKey = this.accessOrder.shift();
        this.cache.delete(lruKey);
        this.logger.debug(`Item removido do cache (LRU): ${lruKey}`);
    }

    /**
     * Atualiza a ordem de acesso
     */
    _updateAccessOrder(key) {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(key);
    }

    /**
     * Define um item no cache
     */
    set(key, value, customTTL = null) {
        // Remove se já existe
        if (this.cache.has(key)) {
            const index = this.accessOrder.indexOf(key);
            if (index > -1) {
                this.accessOrder.splice(index, 1);
            }
        }

        // Evita item se cache está cheio
        if (this.cache.size >= this.maxSize) {
            this._evictLRU();
        }

        const ttl = customTTL !== null ? customTTL : this.ttl;
        const item = {
            value,
            expiresAt: ttl > 0 ? Date.now() + ttl : null,
            createdAt: Date.now(),
        };

        this.cache.set(key, item);
        this._updateAccessOrder(key);
        
        this.logger.debug(`Item adicionado ao cache: ${key} (TTL: ${ttl}ms)`);
    }

    /**
     * Obtém um item do cache
     */
    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            this.logger.debug(`Cache miss: ${key}`);
            return null;
        }

        // Verifica expiração
        if (this._isExpired(item)) {
            this.delete(key);
            this.logger.debug(`Item expirado removido: ${key}`);
            return null;
        }

        // Atualiza ordem de acesso
        this._updateAccessOrder(key);
        this.logger.debug(`Cache hit: ${key}`);
        
        return item.value;
    }

    /**
     * Verifica se uma chave existe no cache
     */
    has(key) {
        const item = this.cache.get(key);
        if (!item) return false;
        
        if (this._isExpired(item)) {
            this.delete(key);
            return false;
        }
        
        return true;
    }

    /**
     * Remove um item do cache
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            const index = this.accessOrder.indexOf(key);
            if (index > -1) {
                this.accessOrder.splice(index, 1);
            }
            this.logger.debug(`Item removido do cache: ${key}`);
        }
        return deleted;
    }

    /**
     * Limpa itens expirados
     */
    cleanup() {
        let removed = 0;
        for (const [key, item] of this.cache.entries()) {
            if (this._isExpired(item)) {
                this.delete(key);
                removed++;
            }
        }
        
        if (removed > 0) {
            this.logger.info(`Limpeza de cache: ${removed} itens removidos`);
        }
        
        return removed;
    }

    /**
     * Limpa todo o cache
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.accessOrder = [];
        this.logger.info(`Cache limpo: ${size} itens removidos`);
    }

    /**
     * Retorna estatísticas do cache
     */
    stats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            ttl: this.ttl,
            oldestKey: this.accessOrder[0] || null,
            newestKey: this.accessOrder[this.accessOrder.length - 1] || null,
        };
    }

    /**
     * Obtém ou define um valor usando uma função factory
     */
    async getOrSet(key, factory, customTTL = null) {
        // Tenta obter do cache
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        // Se não está no cache, executa a factory
        try {
            const value = await factory();
            this.set(key, value, customTTL);
            return value;
        } catch (error) {
            this.logger.error(`Erro ao executar factory para chave ${key}:`, error);
            throw error;
        }
    }
}

module.exports = { LRUCache };
