require('dotenv').config();
const express = require('express');
const { handleMessage } = require('./message-handler');
const cloudClient = require('./whatsapp-cloud'); // Instância Cloud em vez de wwebjs

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

// Validação exigida pela Meta (hub.challenge)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ Webhook verificado pela Meta!');
            return res.status(200).send(challenge);
        } else {
            console.warn('⚠️ Tentativa de verificação com token inválido.');
            return res.sendStatus(403);
        }
    }
    return res.status(400).send('Faltando parâmetros do hub');
});

// Recebimento de mensagens (Cloud API Webhooks)
app.post('/webhook', async (req, res) => {
    const body = req.body;

    // Confirma que é um evento da API do WhatsApp
    if (body.object === 'whatsapp_business_account') {

        // Extrai a mensagem em si navegando na árvore de JSON
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const messages = value?.messages;

        if (messages && messages.length > 0) {
            const messageRaw = messages[0];
            const senderId = messageRaw.from; // Número de quem enviou (formato INT)
            const messageId = messageRaw.id; // ID interno da Meta

            // Marca como lida assim que recebe (opcional, melhora a UX)
            await cloudClient.markAsRead(messageId);

            // Mapeia para um objeto 'msg' polimórfico (parecido com whatsapp-web.js p/ compatibilidade)
            const polyMsg = {
                id: messageId,
                from: senderId,
                body: messageRaw.type === 'text' ? messageRaw.text.body : '',
                type: messageRaw.type,
                hasMedia: ['image', 'video', 'audio', 'document'].includes(messageRaw.type),
                hasQuotedMsg: !!messageRaw.context?.id,
                // Funções utilitárias mantidas no adapter:
                getQuotedMessage: async () => {
                    // Sem RAG profundo e histórico fixo na Meta, omitimos implementação real ou recriamos com state memory
                    return { fromMe: false, hasMedia: false }; 
                }
            };

            // Processa usando o Orchestrador
            try {
                await handleMessage(polyMsg, cloudClient);
            } catch(e) {
                console.error("❌ Falha no handleMessage:", e);
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// A inicialização real do "listening" fica no index.js
module.exports = app;
