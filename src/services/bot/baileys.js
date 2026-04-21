const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const { handleMessage } = require('./message-handler');

const logger = pino({ level: 'silent' });

async function connectToWhatsApp() {
    const authPath = path.join(__dirname, '..', '..', '..', 'data', 'auth_baileys');
    
    // Garante que a pasta data existe
    if (!fs.existsSync(path.dirname(authPath))) {
        fs.mkdirSync(path.dirname(authPath), { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`📡 Iniciando conexão com WhatsApp v${version.join('.')} (Última: ${isLatest})`);

    const sock = makeWASocket({
        version,
        logger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false, // Vamos imprimir manualmente para controle
        browser: ['Jarvis OCI', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: true,
    });

    // Gerencia o QR Code e Conexão
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📷 ESCANEIE O QR CODE ABAIXO PARA CONECTAR O JARVIS:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Conexão fechada devido a:', lastDisconnect?.error, '. Tentando reconectar:', shouldReconnect);
            if (shouldReconnect) {
                // Pequeno delay para evitar loops infinitos em caso de erro crítico
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ JARVIS CONECTADO COM SUCESSO VIA BAILEYS!');
        }
    });

    // Salva as credenciais sempre que atualizadas
    sock.ev.on('creds.update', saveCreds);

    // Escuta novas mensagens
    sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                if (!msg.key.fromMe && msg.message) {
                    // Traduz o formato do Baileys para o formato simplificado que o resto do Jarvis entende
                    const convertedMsg = {
                        from: msg.key.remoteJid,
                        body: msg.message.conversation || 
                              msg.message.extendedTextMessage?.text || 
                              msg.message.imageMessage?.caption || 
                              '',
                        pushName: msg.pushName,
                        original: msg // Mantém o original guardado se precisar
                    };

                    // Adapter para o client.sendMessage
                    const clientAdapter = {
                        sendMessage: async (jid, text) => {
                            await sock.sendMessage(jid, { text });
                        }
                    };

                    await handleMessage(convertedMsg, clientAdapter);
                }
            }
        }
    });

    return sock;
}

module.exports = { connectToWhatsApp };
