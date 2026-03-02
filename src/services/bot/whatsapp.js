require("dotenv").config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const path = require('path');
const fs = require('fs');
const { iniciarVerificacaoLembretes } = require('../reminders/reminders');
const { iniciarJobPascom } = require('../jobs/pascom-notification');
const { iniciarScheduler } = require('../jobs/scheduler');
const { handleMessage } = require('./message-handler');
const { schedulePluggySync } = require('../jobs/pluggy-sync-job');

let qrGerado = false;
let tentativasReconexao = 0;
const maxTentativasReconexao = 3;
let inicializando = false;
let botPronto = false;

// Função para limpar cache de autenticação
function limparCacheAuth() {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        const authPath = path.join(dataDir, '.wwebjs_auth');
        const cachePath = path.join(dataDir, '.wwebjs_cache');

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
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const authPath = path.join(dataDir, '.wwebjs_auth');
const cachePath = path.join(dataDir, '.wwebjs_cache');
console.log(`📂 Caminho de autenticação: ${authPath}`);
console.log(`📂 Caminho de cache: ${cachePath}`);

// Importa LocalWebCache (Desativado temporariamente devido a bugs de ENOTEMPTY no OCI)
// const LocalWebCache = require('whatsapp-web.js/src/webCache/LocalWebCache');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "bot-whatsapp",
        dataPath: authPath,
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
        timeout: 300000,
        protocolTimeout: 300000,
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
    if (!botPronto) {
        console.log('\n✅ WhatsApp autenticado!');
    }
    qrGerado = false;
    tentativasReconexao = 0;
});

client.on('ready', () => {
    if (botPronto) {
        console.log('✅ Bot reconectado com sucesso!');
        return; // Evita re-inicializar jobs
    }
    botPronto = true;
    console.log('\n✅ Bot iniciado com sucesso!');
    tentativasReconexao = 0;
    tentativasReconexao = 0;
    iniciarVerificacaoLembretes(client);
    iniciarJobPascom(client);
    iniciarScheduler(client);
    // schedulePluggySync(client); // Desativado temporariamente devido a lentidão do Open Finance

    // Inicializa RAG (Eager Loading) para evitar delay na primeira mensagem
    const ragService = require('../rag/rag-service');
    ragService.initialize().catch(e => console.error('❌ Falha ao iniciar RAG:', e));
});

client.on('auth_failure', msg => {
    console.error('\n❌ Falha na autenticação:', msg);
    inicializando = false; // libera guard para permitir retry
    tentativasReconexao++;

    if (tentativasReconexao <= maxTentativasReconexao) {
        console.log(`🔄 Tentativa de reconexão ${tentativasReconexao}/${maxTentativasReconexao} (preservando sessão)...`);
        setTimeout(() => inicializarCliente(), 5000);
    } else {
        console.error('❌ Máximo de tentativas atingido. Limpando sessão e reiniciando...');
        tentativasReconexao = 0;
        setTimeout(() => {
            try { limparCacheAuth(); } catch { }
            inicializarCliente();
        }, 10000);
    }
});

client.on('disconnected', reason => {
    console.log('\n⚠️ WhatsApp desconectado:', reason);
    inicializando = false; // libera guard para permitir reconexão
    tentativasReconexao++;

    if (tentativasReconexao <= maxTentativasReconexao) {
        console.log(`🔄 Reconectando ${tentativasReconexao}/${maxTentativasReconexao} (sessão preservada)...`);
        setTimeout(() => inicializarCliente(), 3000);
    } else {
        console.error('❌ Máximo de tentativas de reconexão atingido. Nova tentativa em 10s...');
        tentativasReconexao = 0;
        setTimeout(() => inicializarCliente(), 10000);
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
// Evento de mensagem (apenas recebidas)
client.on('message', async (msg) => {
    // Ignora status updates
    if (msg.from === 'status@broadcast') return;

    // Ignora mensagens de canais/newsletters do WhatsApp
    if (msg.from?.endsWith('@newsletter')) return;

    console.log(`\n📩 Mensagem recebida! De: ${msg.from} | Tipo: ${msg.type} | Corpo: ${msg.body.substring(0, 50)}...`);
    await handleMessage(msg, client);
});

// Função para inicializar com retry sequencial (sem chamadas concorrentes)
async function inicializarCliente(tentativa = 1, maxTentativas = 3) {
    if (inicializando) {
        console.log('⚠️ Inicialização já em andamento, ignorando chamada duplicada.');
        return;
    }

    inicializando = true;

    try {
        console.log(`🚀 Iniciando cliente WhatsApp... (tentativa ${tentativa}/${maxTentativas})`);
        await client.initialize();
        console.log('✅ client.initialize() concluído.');
    } catch (err) {
        console.error(`❌ Falha ao inicializar (tentativa ${tentativa}):`, err?.message || err);

        inicializando = false; // libera o guard para retry

        if (tentativa < maxTentativas) {
            const delay = tentativa * 5000; // 5s, 10s, 15s
            console.log(`🔄 Nova tentativa em ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return inicializarCliente(tentativa + 1, maxTentativas);
        } else {
            console.error('❌ Todas as tentativas falharam. Limpando sessão e tentando última vez...');
            limparCacheAuth();
            await new Promise(resolve => setTimeout(resolve, 5000));

            inicializando = true;
            try {
                await client.initialize();
            } catch (finalErr) {
                console.error('❌ Falha final após limpar sessão:', finalErr?.message || finalErr);
                inicializando = false;
            }
        }
    }
}

// Inicialização do cliente
inicializarCliente();

module.exports = { client };
