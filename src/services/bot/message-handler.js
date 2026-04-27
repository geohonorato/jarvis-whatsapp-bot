const { adicionarAoHistorico, obterHistorico, limparHistorico } = require('../chat/chat-history');
const { processarMensagemMultimodal, filtrarPensamentos } = require('../api/groq');
const { buildSmartContext } = require('../knowledge/obsidian-reader');
const ragService = require('../rag/rag-service');
const { createMeetingInObsidian, generateTitle } = require('../chat/meeting-summary');

// Handlers especializados
const { handleMagisteriumCommand } = require('./handlers/magisterium-handler');
const { isFinanceCommand, handleFinanceCommand } = require('./handlers/finance-handler');
const { handleCalendarCommand, isCalendarCommand } = require('./handlers/calendar-handler');

/**
 * Detecta se o usuário está pedindo para salvar uma reunião/nota no vault via texto
 */
function isMeetingSaveRequest(text) {
    const lower = text.toLowerCase();
    const patterns = [
        /salva?\s+(?:essa|esta|a)?\s*reuni[ãa]o/,
        /registra?\s+(?:essa|esta|a)?\s*reuni[ãa]o/,
        /anota?\s+(?:essa|esta|a)?\s*reuni[ãa]o/,
        /salva?\s+(?:isso|tudo)?\s*no\s*vault/,
        /cria?\s+(?:uma?\s*)?nota\s+(?:de\s+)?reuni[ãa]o/,
        /salva?\s+(?:essa|esta)?\s*(?:ata|nota)\s+no\s*vault/,
    ];
    return patterns.some(p => p.test(lower));
}

/**
 * Processa uma reunião enviada como texto e salva no vault
 */
async function handleTextMeeting(client, chatId, text) {
    try {
        console.log('📋 [MeetingHandler] Reunião via texto detectada — processando...');
        await client.sendMessage(chatId, '📝 _Processando reunião e salvando no vault..._');

        // Gera título/categoria via IA
        const titleData = await generateTitle(text);

        const metadata = {
            title: titleData.title || 'Reunião',
            emoji: titleData.emoji || '📋',
            category: titleData.category || 'Outro',
            type: 'meeting',
            mainTopics: []
        };

        // O texto do usuário já é o "resumo" — salva diretamente
        const result = await createMeetingInObsidian(text, '', metadata);

        if (result.success) {
            let response = `✅ Reunião salva no Obsidian Vault!\n\n`;
            response += `📁 Pasta: ${result.folder}\n`;
            response += `📄 Nota: ${result.title}\n`;
            response += `\n_A nota será sincronizada automaticamente._`;
            await client.sendMessage(chatId, response);
            adicionarAoHistorico(chatId, 'user', [{ text: `[Reunião salva via texto no vault]` }]);
            adicionarAoHistorico(chatId, 'model', [{ text: response }]);
        } else {
            await client.sendMessage(chatId, `❌ Erro ao salvar reunião: ${result.error}`);
        }

        return true;
    } catch (error) {
        console.error('❌ [MeetingHandler] Erro ao salvar reunião via texto:', error.message);
        await client.sendMessage(chatId, `❌ Erro inesperado: ${error.message}`);
        return true;
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
            await handleTextMeeting(client, chatId, msg.body);
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
