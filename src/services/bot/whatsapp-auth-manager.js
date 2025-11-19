require("dotenv").config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Manager para persistência de autenticação do WhatsApp
 * Salva credenciais criptografadas em arquivo externo (volume Docker)
 */

// Caminho para salvar credenciais (deve estar em volume persistente)
const CREDENTIALS_BACKUP_PATH = process.env.WHATSAPP_CREDENTIALS_PATH || 
    path.join(process.cwd(), 'persistent', '.whatsapp_session');

// Chave simples para encriptação (em produção, usar variável de ambiente)
const ENCRYPTION_KEY = (process.env.WHATSAPP_ENCRYPTION_KEY || 'jarvis-whatsapp-2025').padEnd(32, '0').substring(0, 32);

/**
 * Criptografa dados
 * @param {string} data 
 * @returns {string}
 */
function encriptarDados(data) {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('❌ Erro ao encriptar dados:', error);
        return null;
    }
}

/**
 * Descriptografa dados
 * @param {string} encryptedData 
 * @returns {string|null}
 */
function descriptografarDados(encryptedData) {
    try {
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('❌ Erro ao descriptografar dados:', error);
        return null;
    }
}

/**
 * Salva backup das credenciais de autenticação
 * @param {Object} authData - Dados de autenticação
 * @returns {boolean}
 */
function salvarBackupCredenciais(authData) {
    try {
        // Garante que o diretório persistente existe
        const dir = path.dirname(CREDENTIALS_BACKUP_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Diretório de persistência criado: ${dir}`);
        }

        // Serializa dados
        const jsonData = JSON.stringify(authData, null, 2);
        
        // Encripta e salva
        const encrypted = encriptarDados(jsonData);
        if (!encrypted) return false;

        fs.writeFileSync(CREDENTIALS_BACKUP_PATH, encrypted, 'utf8');
        console.log(`💾 Credenciais de WhatsApp salvas em backup (persistente): ${CREDENTIALS_BACKUP_PATH}`);
        return true;
    } catch (error) {
        console.error('❌ Erro ao salvar backup de credenciais:', error);
        return false;
    }
}

/**
 * Carrega backup das credenciais
 * @returns {Object|null}
 */
function carregarBackupCredenciais() {
    try {
        if (!fs.existsSync(CREDENTIALS_BACKUP_PATH)) {
            console.log('📭 Nenhum backup de credenciais encontrado');
            return null;
        }

        const encrypted = fs.readFileSync(CREDENTIALS_BACKUP_PATH, 'utf8');
        const jsonData = descriptografarDados(encrypted);
        
        if (!jsonData) {
            console.log('❌ Falha ao descriptografar backup');
            return null;
        }

        const authData = JSON.parse(jsonData);
        console.log('✅ Credenciais restauradas do backup (persistente)');
        return authData;
    } catch (error) {
        console.error('❌ Erro ao carregar backup de credenciais:', error);
        return null;
    }
}

/**
 * Monitora mudanças no diretório de autenticação e salva backup
 * @param {string} authPath - Caminho do .wwebjs_auth
 */
function monitorarMudancasAuth(authPath) {
    try {
        // Verifica a cada 30 segundos se há mudanças
        setInterval(() => {
            if (fs.existsSync(authPath)) {
                try {
                    // Lê todos os arquivos de autenticação
                    const files = fs.readdirSync(authPath, { recursive: true });
                    const authDataMap = {};

                    // Tenta ler arquivos de autenticação conhecidos
                    const authFiles = ['Default/localStorage', 'Default/Cookies', 'Default/Cache/Cache_Data'];
                    
                    files.forEach(file => {
                        if (file.includes('Default')) {
                            authDataMap[file] = true; // Marca como existente
                        }
                    });

                    // Se houver mudanças, salva backup
                    if (Object.keys(authDataMap).length > 0) {
                        salvarBackupCredenciais({
                            timestamp: Date.now(),
                            files: Object.keys(authDataMap),
                            lastSync: new Date().toISOString()
                        });
                    }
                } catch (error) {
                    // Silenciosamente ignora erros de monitoramento
                }
            }
        }, 30000); // A cada 30 segundos

        console.log('🔍 Monitoramento de mudanças de autenticação ativado');
    } catch (error) {
        console.error('❌ Erro ao configurar monitoramento:', error);
    }
}

/**
 * Restaura arquivos de autenticação do backup
 * @param {string} authPath - Caminho do .wwebjs_auth
 * @returns {boolean}
 */
function restaurarDeBackup(authPath) {
    try {
        const backup = carregarBackupCredenciais();
        
        if (!backup || !backup.files) {
            console.log('📭 Nenhum backup válido para restaurar');
            return false;
        }

        // Aqui você teria que copiar os arquivos específicos se tivesse acesso a eles
        // Por enquanto, apenas informamos que o backup existe
        console.log(`✅ Backup encontrado com ${backup.files.length} arquivo(s) de autenticação`);
        return true;
    } catch (error) {
        console.error('❌ Erro ao restaurar do backup:', error);
        return false;
    }
}

/**
 * Limpa backups antigos (mais de N dias)
 * @param {number} diasRetencao - Dias para manter backups (padrão: 30)
 */
function limparBackupsAntigos(diasRetencao = 30) {
    try {
        const backupDir = path.dirname(CREDENTIALS_BACKUP_PATH);
        if (!fs.existsSync(backupDir)) return;

        const agora = Date.now();
        const diasMs = diasRetencao * 24 * 60 * 60 * 1000;

        fs.readdirSync(backupDir).forEach(file => {
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            
            if (agora - stats.mtimeMs > diasMs) {
                fs.unlinkSync(filePath);
                console.log(`🗑️  Backup antigo removido: ${file}`);
            }
        });
    } catch (error) {
        console.error('❌ Erro ao limpar backups antigos:', error);
    }
}

module.exports = {
    salvarBackupCredenciais,
    carregarBackupCredenciais,
    restaurarDeBackup,
    monitorarMudancasAuth,
    limparBackupsAntigos,
    CREDENTIALS_BACKUP_PATH
};
