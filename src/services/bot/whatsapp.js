require("dotenv").config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const path = require('path');
const fs = require('fs');
const { iniciarVerificacaoLembretes } = require('../reminders');
const { iniciarJobPascom } = require('../jobs/pascom-notification');
const { handleMessage } = require('./message-handler');

let qrGerado = false;
let tentativasReconexao = 0;
const maxTentativasReconexao = 3;

// Função para limpar cache de autenticação
function limparCacheAuth() {
    try {
        const authPath = path.join(process.cwd(), '.wwebjs_auth');
        const cachePath = path.join(process.cwd(), '.wwebjs_cache');

        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log('🧹 Cache de autenticação limpo');
        }

        if (fs.existsSync(cachePath)) {
            fs.rmSync(cachePath, { recursive: true, force: true });
            console.log('🧹 Cache do navegador limpo');
        }
    } catch (error) {
        console.error('❌ Erro ao limpar cache:', error);
    }
}

// Descobre caminho do Chromium em runtime (Alpine/DigitalOcean)
function detectarChromiumPath() {
    const candidatos = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable'
    ].filter(Boolean);
    for (const p of candidatos) {
        try {
            if (fs.existsSync(p)) {
                console.log(`🧭 Chromium encontrado em: ${p}`);
                return p;
            }
        } catch { }
    }
    console.warn('⚠️ Caminho do Chromium não encontrado nos candidatos padrão. Puppeteer tentará autodetectar.');
    return undefined;
}

const chromiumPath = detectarChromiumPath();

// Criação da única instância do cliente
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "bot-whatsapp",
        dataPath: path.join(process.cwd(), '.wwebjs_auth'),
    }),
    puppeteer: {
        headless: true,
        executablePath: chromiumPath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-background-networking',
            '--mute-audio'
        ],
        timeout: 120000,
        protocolTimeout: 120000,
        ignoreDefaultArgs: ['--disable-extensions'],
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false
    }
});

// Eventos do cliente
client.on('qr', qr => {
    if (!qrGerado) {
        console.log('\n📱 Escaneie o QR Code:');
        qrcode.generate(qr, { small: true });
        qrGerado = true;
    }
});

client.on('authenticated', () => {
    console.log('\n✅ WhatsApp autenticado!');
    qrGerado = false;
    tentativasReconexao = 0;
});

client.on('ready', () => {
    console.log('\n✅ Bot iniciado com sucesso!');
    tentativasReconexao = 0; // Reset contador de tentativas
    iniciarVerificacaoLembretes(client);
    iniciarJobPascom(client);
});

client.on('auth_failure', msg => {
    console.error('\n❌ Falha na autenticação:', msg);
    tentativasReconexao++;

    if (tentativasReconexao <= maxTentativasReconexao) {
        console.log(`🔄 Tentativa de reconexão ${tentativasReconexao}/${maxTentativasReconexao}...`);
        setTimeout(() => {
            limparCacheAuth();
            client.initialize().catch(err => {
                console.error('❌ Erro na reconexão:', err);
            });
        }, 5000); // Aguarda 5 segundos antes de tentar novamente
    } else {
        console.error('❌ Máximo de tentativas de reconexão atingido. Mantendo processo vivo e tentando novamente em 10s...');
        tentativasReconexao = 0;
        setTimeout(() => {
            try { limparCacheAuth(); } catch { }
            client.initialize().catch(err => console.error('❌ Erro ao tentar reinicializar (loop):', err));
        }, 10000);
    }
});

client.on('disconnected', reason => {
    console.log('\n⚠️ WhatsApp desconectado:', reason);
    tentativasReconexao++;

    if (tentativasReconexao <= maxTentativasReconexao) {
        console.log(`🔄 Tentativa de reconexão ${tentativasReconexao}/${maxTentativasReconexao}...`);
        setTimeout(() => {
            limparCacheAuth(); // Limpa cache antes de reconectar
            client.initialize().catch(err => {
                console.error('❌ Erro na reconexão:', err);
            });
        }, 3000); // Aguarda 3 segundos antes de tentar novamente
    } else {
        console.error('❌ Máximo de tentativas de reconexão atingido. Mantendo processo vivo e tentando novamente em 10s...');
        tentativasReconexao = 0;
        setTimeout(() => {
            try { limparCacheAuth(); } catch { }
            client.initialize().catch(err => console.error('❌ Erro ao tentar reinicializar (loop):', err));
        }, 10000);
    }
});

// Evento para detectar erros de contexto destruído
client.on('change_state', (state) => {
    console.log('📱 Estado do WhatsApp:', state);
});

// Evento para detectar quando o cliente está pronto para reconectar
client.on('loading_screen', (percent, message) => {
    console.log(`📱 Carregando: ${percent}% - ${message}`);
});

client.on('error', (err) => {
    console.error('❌ Erro no cliente WhatsApp:', err?.message || err);
});

// Evento de mensagem principal
client.on('message', (msg) => handleMessage(msg, client));

// Função para inicializar com tratamento de erro melhorado
async function inicializarCliente() {
    try {
        console.log('🚀 Iniciando cliente WhatsApp...');
        await client.initialize();
    } catch (err) {
        console.error('❌ Falha ao inicializar o cliente WhatsApp:', err);

        // Se for erro de contexto destruído ou protocolo, limpa cache e tenta novamente
        if (err.message.includes('Execution context was destroyed') ||
            err.message.includes('Protocol error') ||
            err.message.includes('auth') ||
            err.message.includes('session') ||
            err.message.includes('Target closed')) {

            console.log('🧹 Limpando cache devido a erro de contexto/protocolo...');
            limparCacheAuth();

            // Aguarda um pouco e tenta novamente
            setTimeout(async () => {
                try {
                    console.log('🔄 Tentando reinicializar após limpeza de cache...');
                    await client.initialize();
                } catch (retryErr) {
                    console.error('❌ Falha na segunda tentativa:', retryErr);
                    console.log('🔄 Tentando uma última vez com configuração alternativa...');

                    // Última tentativa com configuração mais simples
                    setTimeout(async () => {
                        try {
                            limparCacheAuth();
                            await client.initialize();
                        } catch (finalErr) {
                            console.error('❌ Falha final:', finalErr);
                            console.log('⏳ Mantendo processo vivo. Nova tentativa em 15s...');
                            setTimeout(async () => {
                                try {
                                    limparCacheAuth();
                                    await client.initialize();
                                } catch (lastErr) {
                                    console.error('❌ Nova tentativa também falhou:', lastErr);
                                }
                            }, 15000);
                        }
                    }, 3000);
                }
            }, 3000);
        } else {
            console.error('❌ Erro não relacionado a contexto/protocolo:', err.message);
            console.log('⏳ Mantendo processo vivo. Nova tentativa em 15s...');
            setTimeout(async () => {
                try {
                    await client.initialize();
                } catch (lastErr) {
                    console.error('❌ Nova tentativa também falhou:', lastErr);
                }
            }, 15000);
        }
    }
}

// Inicialização do cliente
inicializarCliente();

module.exports = { client }; // Exporta o cliente se necessário em outros lugares