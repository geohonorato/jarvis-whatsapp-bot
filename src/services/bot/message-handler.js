const { adicionarAoHistorico, obterHistorico, limparHistorico } = require('../chat/chat-history');
const { processarMensagemMultimodal, filtrarPensamentos } = require('../api/groq');
const { buildSmartContext } = require('../knowledge/obsidian-reader');
const ragService = require('../rag/rag-service');
const { createMeetingInObsidian, generateTitle, isMeetingSaveRequest, consolidateMeetingNotes } = require('../chat/meeting-summary');

// Handlers especializados
const { handleMagisteriumCommand } = require('./handlers/magisterium-handler');
const { isFinanceCommand, handleFinanceCommand } = require('./handlers/finance-handler');
const { handleCalendarCommand, isCalendarCommand } = require('./handlers/calendar-handler');

/**
 * Processa uma reunião enviada via texto (ou consolidada do histórico)
 * @param {object} client - Cliente WhatsApp
 * @param {string} chatId - ID do chat
 * @param {string} text - Texto da mensagem atual
 * @param {Array} history - Histórico recente de mensagens
 */
async function handleTextMeeting(client, chatId, text, history = []) {
    try {
        console.log('📋 [MeetingHandler] Reunião via texto detectada — processando...');
        
        let contentToSave = text;
        
        // Se houver histórico, tenta consolidar
        if (history.length > 0) {
            await client.sendMessage(chatId, '📝 _Consolidando suas anotações recentes..._');
            contentToSave = await consolidateMeetingNotes(text, history);
        } else {
            await client.sendMessage(chatId, '📝 _Processando reunião e salvando no vault..._');
        }

        // Gera título/categoria/path via IA
        const titleData = await generateTitle(contentToSave);

        const metadata = {
            title: titleData.title || 'Reunião',
            emoji: titleData.emoji || '📋',
            category: titleData.category || 'Outro',
            path: titleData.path || '90 - Arquivos/Inbox',
            type: 'meeting',
            mainTopics: []
        };

        // Salva no Obsidian
        const result = await createMeetingInObsidian(contentToSave, '', metadata);

        if (result.success) {
            let response = `✅ Reunião consolidada e salva!\n\n`;
            response += `📁 Pasta: ${result.folder}\n`;
            response += `📄 Nota: ${result.title}\n`;
            response += `\n_A nota será sincronizada automaticamente._`;
            await client.sendMessage(chatId, response);
            adicionarAoHistorico(chatId, 'model', [{ text: response }]);
        } else {
            await client.sendMessage(chatId, `❌ Erro ao salvar reunião: ${result.error}`);
        }
        
        return true;
    } catch (error) {
        console.error('❌ Erro no handleTextMeeting:', error);
        await client.sendMessage(chatId, '❌ Erro ao processar o salvamento da reunião.');
        return false;
    }
}

async function handleMessage(msg, client) {
    try {
        const chatId = msg.from;
        const lowerCaseBody = msg.body?.toLowerCase() || '';
        const hasText = !!msg.body;

        // Comandos de limpeza
        if (lowerCaseBody === '/limpar') {
            limparHistorico(chatId);
            await client.sendMessage(chatId, '🧹 Histórico da conversa limpo!');
            return;
        }

        if (!hasText) {
            console.log("❓ Mensagem recebida sem texto suportado.");
            return;
        }

        console.log('\n📩 Mensagem de texto processando:', msg.body);

        // --- INTERCEPTOR: Reunião via texto ---
        if (isMeetingSaveRequest(msg.body)) {
            const historico = obterHistorico(chatId);
            await handleTextMeeting(client, chatId, msg.body, historico);
            return;
        }

        let partsEntrada = [{ text: msg.body }];
        adicionarAoHistorico(chatId, 'user', partsEntrada);

        const historico = obterHistorico(chatId);
        
        // --- CONTEXTO INTELIGENTE (3 camadas) ---
        let contextParts = [];

        // Camada 1: Perfil condensado + keywords do Obsidian
        const smartContext = buildSmartContext(msg.body);
        if (smartContext) contextParts.push(smartContext);

        // Camada 2: Busca vetorial nas memórias (RAG real)
        try {
            const memorias = await ragService.buscarContexto(msg.body);
            if (memorias.length > 0) {
                const memText = memorias.map(m => `• ${m.text}`).join('\n');
                contextParts.push(`=== MEMÓRIAS RELEVANTES ===\n${memText}`);
            }
        } catch (e) {
            console.error('⚠️ RAG search falhou:', e.message);
        }

        // Monta prompt final
        let promptText = contextParts.length > 0
            ? `${contextParts.join('\n\n')}\n\nMENSAGEM DO USUÁRIO:\n${msg.body}`
            : msg.body;
        
        const textoComContexto = [{ text: promptText }];

        console.time('🤖 Tempo API');
        const respostaIA = await processarMensagemMultimodal(textoComContexto, historico);
        console.timeEnd('🤖 Tempo API');

        if (respostaIA && !respostaIA.startsWith('❌')) {
            let respostaFinal = respostaIA;

            // Roteamento
            if (respostaIA.startsWith('/magisterium')) {
                await handleMagisteriumCommand(client, chatId, respostaIA, historico);
                return;
            }

            adicionarAoHistorico(chatId, 'model', [{ text: respostaFinal }]);

            // Finance Handler 
            if (isFinanceCommand(respostaIA)) {
                await handleFinanceCommand(client, chatId, respostaIA);
                return;
            }

            // Calendar Handler
            if (isCalendarCommand(respostaIA)) {
                const respostaCalendario = await handleCalendarCommand(client, chatId, respostaIA);
                if (respostaCalendario) {
                    await client.sendMessage(chatId, respostaCalendario);
                    adicionarAoHistorico(chatId, 'model', [{ text: respostaCalendario }]);
                } else if (respostaIA.startsWith('/evento')) {
                    const analiseOriginal = respostaIA.split('/evento')[0].trim();
                    if (analiseOriginal) {
                        await client.sendMessage(chatId, filtrarPensamentos(analiseOriginal));
                    }
                }
                return;
            }

            if (respostaFinal && respostaFinal.trim().length > 0) {
                console.log('🤖 Resposta enviada:', respostaFinal);
                await client.sendMessage(chatId, respostaFinal);
            }

            // Camada 3 (background): Extrai fatos e memoriza
            ragService.extrairEMemorizar(msg.body, respostaFinal, chatId).catch(() => {});

        } else {
            const mensagemErro = respostaIA || '❌ Desculpe, não consegui processar sua solicitação.';
            await client.sendMessage(chatId, mensagemErro);
            adicionarAoHistorico(chatId, 'model', [{ text: mensagemErro }]);
        }

    } catch (error) {
        console.error('\n❌ Erro não tratado no evento de mensagem:', error);
        try {
            await client.sendMessage(msg.from, '❌ Ops! Ocorreu um erro inesperado. Tente novamente mais tarde.');
        } catch (sendError) {}
    }
}

module.exports = { handleMessage };
