/**
 * Servidor HTTP do Jarvis — API REST para interfaces externas
 * (Watch Prototype, Dashboard, etc.)
 * 
 * Roda em paralelo ao Baileys (WhatsApp), porta 4000.
 * Reutiliza o pipeline completo: RAG, Obsidian, DeepSeek, Clone Digital.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { processarMensagemMultimodal, filtrarPensamentos } = require('../api/groq');
const { buildSmartContext } = require('../knowledge/obsidian-reader');
const ragService = require('../rag/rag-service');
const cloneDigital = require('../knowledge/clone-digital');
const { adicionarAoHistorico, obterHistorico, limparHistorico } = require('../chat/chat-history');

const PORT = process.env.API_PORT || 4000;
const API_CHAT_ID = 'jarvis-watch-api'; // ChatId virtual para a API

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'Jarvis API',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Chat endpoint — pipeline completo
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ error: 'Campo "message" é obrigatório.' });
        }

        const texto = message.trim();
        console.log(`\n🌐 [API] Mensagem recebida: "${texto.substring(0, 80)}..."`);

        // Comando de limpeza
        if (texto.toLowerCase() === '/limpar') {
            limparHistorico(API_CHAT_ID);
            return res.json({ response: '🧹 Histórico da conversa limpo!' });
        }

        // Registra no histórico
        adicionarAoHistorico(API_CHAT_ID, 'user', [{ text: texto }]);
        const historico = obterHistorico(API_CHAT_ID);

        // --- CONTEXTO INTELIGENTE (3 camadas) ---
        let contextParts = [];

        // Camada 1: Perfil + Obsidian Reader
        const smartContext = buildSmartContext(texto);
        if (smartContext) contextParts.push(smartContext);

        // Camada 2: Busca vetorial nas memórias (RAG)
        try {
            const memorias = await ragService.buscarContexto(texto);
            if (memorias.length > 0) {
                const memText = memorias.map(m => `• ${m.text}`).join('\n');
                contextParts.push(`=== MEMÓRIAS RELEVANTES ===\n${memText}`);
            }
        } catch (e) {
            console.error('⚠️ [API] RAG search falhou:', e.message);
        }

        // Monta prompt final
        let promptText = contextParts.length > 0
            ? `${contextParts.join('\n\n')}\n\nMENSAGEM DO USUÁRIO:\n${texto}`
            : texto;

        const textoComContexto = [{ text: promptText }];

        // Processa com DeepSeek
        console.time('⏱️ [API] Tempo IA');
        const respostaIA = await processarMensagemMultimodal(textoComContexto, historico);
        console.timeEnd('⏱️ [API] Tempo IA');

        if (respostaIA && !respostaIA.startsWith('❌')) {
            const respostaFinal = filtrarPensamentos(respostaIA);

            adicionarAoHistorico(API_CHAT_ID, 'model', [{ text: respostaFinal }]);

            // Background: extrai fatos + Clone Digital
            ragService.extrairEMemorizar(texto, respostaFinal, API_CHAT_ID).catch(() => {});
            cloneDigital.processConversationTurn(texto, respostaFinal).catch(() => {});
            cloneDigital.resetInactivityTimer();

            console.log(`✅ [API] Resposta enviada (${respostaFinal.length} chars)`);
            return res.json({ response: respostaFinal });
        } else {
            const erro = respostaIA || '❌ Não consegui processar sua solicitação.';
            return res.json({ response: erro });
        }

    } catch (error) {
        console.error('❌ [API] Erro no endpoint /api/chat:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// Inicia o servidor
function startApiServer() {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 Jarvis API rodando em http://0.0.0.0:${PORT}`);
    });
}

module.exports = { startApiServer };
