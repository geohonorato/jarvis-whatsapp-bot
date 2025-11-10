/**
 * Sistema de Health Check
 * Monitora a saúde dos serviços do sistema
 */
const { logger } = require('./logger');
const config = require('../config');

class HealthCheck {
    constructor() {
        this.services = new Map();
        this.lastCheck = null;
        this.checkTimer = null;
        this.logger = logger.child('HealthCheck');
        this.enabled = config.healthCheck.enabled;
        this.interval = config.healthCheck.interval;
    }

    /**
     * Registra um serviço para monitoramento
     */
    register(name, checkFunction, options = {}) {
        const service = {
            name,
            check: checkFunction,
            healthy: true,
            lastCheck: null,
            lastError: null,
            failureCount: 0,
            successCount: 0,
            timeout: options.timeout || 5000,
            critical: options.critical !== false, // Por padrão é crítico
        };

        this.services.set(name, service);
        this.logger.info(`Serviço registrado: ${name}`);
    }

    /**
     * Verifica a saúde de um serviço específico
     */
    async checkService(name) {
        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Serviço não registrado: ${name}`);
        }

        try {
            // Executa verificação com timeout
            const result = await Promise.race([
                service.check(),
                this._timeout(service.timeout),
            ]);

            // Atualiza estado
            service.healthy = true;
            service.lastCheck = new Date();
            service.lastError = null;
            service.successCount++;
            service.failureCount = 0; // Reset ao ter sucesso

            this.logger.debug(`✅ Serviço saudável: ${name}`);
            return { healthy: true, service: name, result };
        } catch (error) {
            // Atualiza estado
            service.healthy = false;
            service.lastCheck = new Date();
            service.lastError = error.message;
            service.failureCount++;

            this.logger.error(`❌ Serviço com problema: ${name}`, error);
            return {
                healthy: false,
                service: name,
                error: error.message,
                failureCount: service.failureCount,
            };
        }
    }

    /**
     * Verifica a saúde de todos os serviços
     */
    async checkAll() {
        if (!this.enabled) {
            return { enabled: false };
        }

        this.logger.info('Iniciando verificação de saúde de todos os serviços...');
        const results = {};
        const checks = [];

        for (const [name, service] of this.services.entries()) {
            checks.push(
                this.checkService(name)
                    .then(result => {
                        results[name] = result;
                    })
                    .catch(error => {
                        results[name] = {
                            healthy: false,
                            service: name,
                            error: error.message,
                        };
                    })
            );
        }

        await Promise.all(checks);

        // Determina saúde geral
        const unhealthyServices = Object.values(results)
            .filter(r => !r.healthy);

        const criticalUnhealthy = unhealthyServices.filter(r => {
            const service = this.services.get(r.service);
            return service && service.critical;
        });

        const overallHealthy = criticalUnhealthy.length === 0;

        this.lastCheck = {
            timestamp: new Date(),
            healthy: overallHealthy,
            services: results,
            summary: {
                total: this.services.size,
                healthy: Object.values(results).filter(r => r.healthy).length,
                unhealthy: unhealthyServices.length,
                criticalUnhealthy: criticalUnhealthy.length,
            },
        };

        if (!overallHealthy) {
            this.logger.warn('⚠️ Sistema com problemas de saúde', {
                criticalUnhealthy: criticalUnhealthy.map(s => s.service),
            });
        } else {
            this.logger.success('✅ Todos os serviços críticos estão saudáveis');
        }

        return this.lastCheck;
    }

    /**
     * Inicia monitoramento periódico
     */
    startMonitoring() {
        if (!this.enabled) {
            this.logger.info('Health check desabilitado');
            return;
        }

        if (this.checkTimer) {
            clearInterval(this.checkTimer);
        }

        // Faz verificação inicial
        this.checkAll();

        // Agenda verificações periódicas
        this.checkTimer = setInterval(() => {
            this.checkAll();
        }, this.interval);

        this.logger.info(`Monitoramento iniciado (intervalo: ${this.interval}ms)`);
    }

    /**
     * Para o monitoramento
     */
    stopMonitoring() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
            this.logger.info('Monitoramento parado');
        }
    }

    /**
     * Timeout para verificação
     */
    _timeout(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Health check timeout after ${ms}ms`));
            }, ms);
        });
    }

    /**
     * Obtém status atual
     */
    getStatus() {
        if (!this.lastCheck) {
            return { status: 'not_checked', message: 'Health check ainda não foi executado' };
        }

        return {
            status: this.lastCheck.healthy ? 'healthy' : 'unhealthy',
            lastCheck: this.lastCheck.timestamp,
            summary: this.lastCheck.summary,
            services: this.lastCheck.services,
        };
    }

    /**
     * Obtém estatísticas detalhadas
     */
    getStats() {
        const stats = {};

        for (const [name, service] of this.services.entries()) {
            stats[name] = {
                healthy: service.healthy,
                lastCheck: service.lastCheck,
                lastError: service.lastError,
                successCount: service.successCount,
                failureCount: service.failureCount,
                critical: service.critical,
            };
        }

        return stats;
    }

    /**
     * Destroy - limpa recursos
     */
    destroy() {
        this.stopMonitoring();
        this.services.clear();
        this.logger.info('HealthCheck destruído');
    }
}

// Instância singleton
const healthCheck = new HealthCheck();

// Registra health checks para serviços padrão
function registerDefaultHealthChecks() {
    const config = require('../config');

    // Check Gemini API
    if (config.api.gemini.key) {
        healthCheck.register('gemini', async () => {
            // Verifica se o módulo está carregado
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(config.api.gemini.key);
            // Apenas verifica se consegue instanciar
            return { status: 'ok' };
        }, { critical: true });
    }

    // Check Google Calendar
    healthCheck.register('calendar', async () => {
        const { getGoogleAuth } = require('../services/api/calendar');
        const auth = await getGoogleAuth();
        return { status: 'ok' };
    }, { critical: true });

    // Check Magisterium (não crítico)
    if (config.api.magisterium.enabled) {
        healthCheck.register('magisterium', async () => {
            // Apenas verifica configuração
            return { status: 'ok' };
        }, { critical: false });
    }

    // Check Memory Usage
    healthCheck.register('memory', async () => {
        const usage = process.memoryUsage();
        const maxHeap = 1024 * 1024 * 1024; // 1GB
        
        if (usage.heapUsed > maxHeap) {
            throw new Error(`High memory usage: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
        }
        
        return {
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        };
    }, { critical: true, timeout: 1000 });
}

module.exports = { HealthCheck, healthCheck, registerDefaultHealthChecks };
