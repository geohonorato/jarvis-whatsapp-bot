/**
 * Gerenciador de arquivos temporários
 * Limpeza automática e controle de arquivos temporários
 */
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./logger');
const config = require('../config');

class TempFileManager {
    constructor() {
        this.tempDir = config.temp.tempDir;
        this.imagesDir = config.temp.imagesDir;
        this.maxAge = config.temp.maxAge;
        this.cleanupInterval = config.temp.cleanupInterval;
        this.cleanupTimer = null;
        this.logger = logger.child('TempFileManager');
    }

    /**
     * Inicializa o gerenciador
     */
    async init() {
        try {
            // Cria diretórios se não existirem
            await this._ensureDir(this.tempDir);
            await this._ensureDir(this.imagesDir);
            
            // Inicia limpeza automática
            this.startAutoCleanup();
            
            this.logger.success('Gerenciador de arquivos temporários inicializado');
        } catch (error) {
            this.logger.error('Erro ao inicializar gerenciador de arquivos temporários', error);
            throw error;
        }
    }

    /**
     * Garante que um diretório existe
     */
    async _ensureDir(dir) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * Salva um arquivo temporário
     */
    async saveTemp(filename, content, subdir = '') {
        try {
            const dir = subdir ? path.join(this.tempDir, subdir) : this.tempDir;
            await this._ensureDir(dir);
            
            const filepath = path.join(dir, filename);
            await fs.writeFile(filepath, content);
            
            this.logger.debug(`Arquivo temporário salvo: ${filepath}`);
            return filepath;
        } catch (error) {
            this.logger.error(`Erro ao salvar arquivo temporário: ${filename}`, error);
            throw error;
        }
    }

    /**
     * Salva uma imagem temporária
     */
    async saveImage(filename, content) {
        try {
            await this._ensureDir(this.imagesDir);
            
            const filepath = path.join(this.imagesDir, filename);
            await fs.writeFile(filepath, content);
            
            this.logger.debug(`Imagem temporária salva: ${filepath}`);
            return filepath;
        } catch (error) {
            this.logger.error(`Erro ao salvar imagem temporária: ${filename}`, error);
            throw error;
        }
    }

    /**
     * Remove um arquivo temporário
     */
    async remove(filepath) {
        try {
            await fs.unlink(filepath);
            this.logger.debug(`Arquivo removido: ${filepath}`);
            return true;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.logger.warn(`Erro ao remover arquivo: ${filepath}`, error);
            }
            return false;
        }
    }

    /**
     * Limpa arquivos antigos em um diretório
     */
    async cleanDirectory(dir) {
        try {
            const files = await fs.readdir(dir);
            const now = Date.now();
            let removed = 0;

            for (const file of files) {
                const filepath = path.join(dir, file);
                
                try {
                    const stats = await fs.stat(filepath);
                    
                    // Verifica se é um arquivo e se está velho demais
                    if (stats.isFile() && (now - stats.mtimeMs > this.maxAge)) {
                        await fs.unlink(filepath);
                        removed++;
                        this.logger.debug(`Arquivo antigo removido: ${filepath}`);
                    }
                } catch (error) {
                    this.logger.warn(`Erro ao processar arquivo: ${filepath}`, error);
                }
            }

            if (removed > 0) {
                this.logger.info(`Limpeza de ${dir}: ${removed} arquivo(s) removido(s)`);
            }

            return removed;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.logger.error(`Erro ao limpar diretório: ${dir}`, error);
            }
            return 0;
        }
    }

    /**
     * Limpa todos os arquivos temporários antigos
     */
    async cleanup() {
        this.logger.info('Iniciando limpeza de arquivos temporários...');
        
        try {
            const tempRemoved = await this.cleanDirectory(this.tempDir);
            const imagesRemoved = await this.cleanDirectory(this.imagesDir);
            
            const total = tempRemoved + imagesRemoved;
            this.logger.success(`Limpeza concluída: ${total} arquivo(s) removido(s)`);
            
            return total;
        } catch (error) {
            this.logger.error('Erro durante limpeza de arquivos temporários', error);
            return 0;
        }
    }

    /**
     * Inicia limpeza automática
     */
    startAutoCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        // Faz limpeza inicial
        this.cleanup();

        // Agenda limpezas periódicas
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);

        this.logger.info(`Limpeza automática iniciada (intervalo: ${this.cleanupInterval}ms)`);
    }

    /**
     * Para a limpeza automática
     */
    stopAutoCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
            this.logger.info('Limpeza automática parada');
        }
    }

    /**
     * Obtém estatísticas dos arquivos temporários
     */
    async stats() {
        try {
            const getDirectoryStats = async (dir) => {
                try {
                    const files = await fs.readdir(dir);
                    let count = 0;
                    let size = 0;
                    let oldFiles = 0;
                    const now = Date.now();

                    for (const file of files) {
                        const filepath = path.join(dir, file);
                        try {
                            const stats = await fs.stat(filepath);
                            if (stats.isFile()) {
                                count++;
                                size += stats.size;
                                if (now - stats.mtimeMs > this.maxAge) {
                                    oldFiles++;
                                }
                            }
                        } catch (error) {
                            // Ignora erros de arquivo individual
                        }
                    }

                    return { count, size, oldFiles };
                } catch (error) {
                    return { count: 0, size: 0, oldFiles: 0 };
                }
            };

            const tempStats = await getDirectoryStats(this.tempDir);
            const imageStats = await getDirectoryStats(this.imagesDir);

            return {
                temp: tempStats,
                images: imageStats,
                total: {
                    count: tempStats.count + imageStats.count,
                    size: tempStats.size + imageStats.size,
                    oldFiles: tempStats.oldFiles + imageStats.oldFiles,
                },
            };
        } catch (error) {
            this.logger.error('Erro ao obter estatísticas de arquivos temporários', error);
            return null;
        }
    }

    /**
     * Destroy - limpa recursos
     */
    destroy() {
        this.stopAutoCleanup();
        this.logger.info('Gerenciador de arquivos temporários destruído');
    }
}

// Instância singleton
const tempFileManager = new TempFileManager();

module.exports = { TempFileManager, tempFileManager };
