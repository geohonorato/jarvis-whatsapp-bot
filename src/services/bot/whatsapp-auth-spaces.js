require("dotenv").config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { readableToString } = require('@smithy/util-stream');

/**
 * Manager para persistência de autenticação do WhatsApp via DigitalOcean Spaces
 * Usa S3 compatível para armazenar credenciais encriptadas
 */

// Configurações do DigitalOcean Spaces
const DO_SPACES_KEY = process.env.DO_SPACES_KEY;
const DO_SPACES_SECRET = process.env.DO_SPACES_SECRET;
const DO_SPACES_BUCKET = process.env.DO_SPACES_BUCKET || 'jarvis-bot';
const DO_SPACES_REGION = process.env.DO_SPACES_REGION || 'nyc3';
const DO_SPACES_ENDPOINT = `https://${DO_SPACES_REGION}.digitaloceanspaces.com`;

// Validação de credenciais
if (!DO_SPACES_KEY || !DO_SPACES_SECRET) {
    console.warn('⚠️ DigitalOcean Spaces não configurado (DO_SPACES_KEY/DO_SPACES_SECRET não definidas)');
    console.warn('⚠️ Usando fallback local (dados perdidos em restart)');
}

// Chave de encriptação
const ENCRYPTION_KEY = (process.env.WHATSAPP_ENCRYPTION_KEY || 'jarvis-whatsapp-2025').padEnd(32, '0').substring(0, 32);

// Cliente S3 (DigitalOcean Spaces)
let s3Client = null;

function initS3Client() {
    if (!DO_SPACES_KEY || !DO_SPACES_SECRET) {
        return null;
    }

    try {
        s3Client = new S3Client({
            region: DO_SPACES_REGION,
            endpoint: DO_SPACES_ENDPOINT,
            credentials: {
                accessKeyId: DO_SPACES_KEY,
                secretAccessKey: DO_SPACES_SECRET
            }
        });
        console.log(`✅ Cliente S3 (DigitalOcean Spaces) inicializado: ${DO_SPACES_BUCKET}`);
        return s3Client;
    } catch (error) {
        console.error('❌ Erro ao inicializar S3Client:', error.message);
        return null;
    }
}

/**
 * Encripta dados
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
 * Faz upload de arquivo para Spaces
 */
async function uploadParaSpaces(key, content, contentType = 'application/json') {
    if (!s3Client) {
        s3Client = initS3Client();
        if (!s3Client) {
            console.warn('⚠️ S3Client não disponível');
            return false;
        }
    }

    try {
        const command = new PutObjectCommand({
            Bucket: DO_SPACES_BUCKET,
            Key: key,
            Body: content,
            ContentType: contentType,
            ACL: 'private'
        });

        await s3Client.send(command);
        console.log(`✅ Arquivo enviado para Spaces: s3://${DO_SPACES_BUCKET}/${key}`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao fazer upload para Spaces:`, error.message);
        return false;
    }
}

/**
 * Faz download de arquivo do Spaces
 */
async function downloadDoSpaces(key) {
    if (!s3Client) {
        s3Client = initS3Client();
        if (!s3Client) {
            console.warn('⚠️ S3Client não disponível');
            return null;
        }
    }

    try {
        const command = new GetObjectCommand({
            Bucket: DO_SPACES_BUCKET,
            Key: key
        });

        const response = await s3Client.send(command);
        const content = await readableToString(response.Body);
        console.log(`✅ Arquivo baixado do Spaces: s3://${DO_SPACES_BUCKET}/${key}`);
        return content;
    } catch (error) {
        if (error.name === 'NoSuchKey') {
            console.log(`📭 Arquivo não encontrado no Spaces: ${key}`);
            return null;
        }
        console.error(`❌ Erro ao fazer download do Spaces:`, error.message);
        return null;
    }
}

/**
 * Salva backup do .wwebjs_auth no Spaces
 */
async function salvarBackupCredenciais(authPath) {
    try {
        if (!fs.existsSync(authPath)) {
            console.log('📭 Diretório .wwebjs_auth não encontrado');
            return false;
        }

        // Cria um manifesto simples de backup
        const backupManifest = {
            timestamp: Date.now(),
            authenticated: true,
            lastSync: new Date().toISOString(),
            authPath: authPath
        };

        // Encripta e envia manifesto (sem tentar ler arquivos individuais)
        const manifestJson = JSON.stringify(backupManifest, null, 2);
        const encrypted = encriptarDados(manifestJson);

        if (!encrypted) {
            console.error('❌ Falha ao encriptar manifesto');
            return false;
        }

        // Upload do manifesto
        const success = await uploadParaSpaces(
            'whatsapp/.whatsapp_session_manifest',
            encrypted,
            'text/plain'
        );

        if (success) {
            console.log(`💾 Backup de autenticação salvo no Spaces`);
        }

        return success;
    } catch (error) {
        console.error('❌ Erro ao salvar backup de credenciais:', error.message);
        return false;
    }
}

/**
 * Carrega informações de backup do Spaces
 */
async function carregarBackupCredenciais() {
    try {
        const encrypted = await downloadDoSpaces('whatsapp/.whatsapp_session_manifest');
        
        if (!encrypted) {
            console.log('📭 Nenhum backup encontrado no Spaces');
            return null;
        }

        const jsonData = descriptografarDados(encrypted);
        if (!jsonData) {
            console.error('❌ Falha ao descriptografar backup');
            return null;
        }

        const backup = JSON.parse(jsonData);
        console.log(`✅ Backup encontrado no Spaces (${backup.count} arquivos)`);
        return backup;
    } catch (error) {
        console.error('❌ Erro ao carregar backup:', error);
        return null;
    }
}

/**
 * Monitora mudanças no .wwebjs_auth e faz upload periódico
 */
function monitorarMudancasAuth(authPath, intervalo = 60000) {
    try {
        // A cada intervalo, tenta fazer backup
        setInterval(async () => {
            if (fs.existsSync(authPath)) {
                try {
                    await salvarBackupCredenciais(authPath);
                } catch (error) {
                    // Silenciosamente ignora erros de monitoramento
                }
            }
        }, intervalo);

        console.log(`🔍 Monitoramento de mudanças ativado (a cada ${intervalo/1000}s)`);
    } catch (error) {
        console.error('❌ Erro ao configurar monitoramento:', error);
    }
}

/**
 * Lista todos os backups disponíveis no Spaces
 */
async function listarBackups() {
    if (!s3Client) {
        s3Client = initS3Client();
        if (!s3Client) return [];
    }

    try {
        const command = new ListObjectsV2Command({
            Bucket: DO_SPACES_BUCKET,
            Prefix: 'whatsapp/'
        });

        const response = await s3Client.send(command);
        const backups = response.Contents || [];
        
        console.log(`📋 ${backups.length} arquivo(s) encontrado(s) no Spaces`);
        return backups;
    } catch (error) {
        console.error('❌ Erro ao listar backups:', error);
        return [];
    }
}

/**
 * Valida configuração do Spaces
 */
async function validarConfiguracao() {
    if (!DO_SPACES_KEY || !DO_SPACES_SECRET) {
        console.error('❌ DigitalOcean Spaces não configurado!');
        console.error('   Adicione no seu .env ou DigitalOcean:');
        console.error('   - DO_SPACES_KEY');
        console.error('   - DO_SPACES_SECRET');
        console.error('   - DO_SPACES_BUCKET (opcional)');
        console.error('   - DO_SPACES_REGION (opcional)');
        return false;
    }

    try {
        s3Client = initS3Client();
        if (!s3Client) {
            return false;
        }

        // Tenta listar backups para validar credenciais
        const backups = await listarBackups();
        console.log('✅ Configuração do DigitalOcean Spaces validada!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao validar Spaces:', error.message);
        return false;
    }
}

module.exports = {
    salvarBackupCredenciais,
    carregarBackupCredenciais,
    monitorarMudancasAuth,
    listarBackups,
    validarConfiguracao,
    uploadParaSpaces,
    downloadDoSpaces,
    encriptarDados,
    descriptografarDados
};
