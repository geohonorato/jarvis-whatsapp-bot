const { adicionarAoHistorico, obterHistorico, limparHistorico } = require('../chat/chat-history');
const { processarMensagemMultimodal, filtrarPensamentos } = require('../api/groq'); // Usa Groq/DeepSeek
const { readCoreVaultContext, readSpecificNote } = require('../knowledge/obsidian-reader');

// Handlers especializados restantes
const { handleMagisteriumCommand } = require('./handlers/magisterium-handler');
const { isFinanceCommand, handleFinanceCommand } = require('./handlers/finance-handler');
const { handleCalendarCommand, isCalendarCommand } = require('./handlers/calendar-handler');

async function handleMessage(msg, client) {
    try {
        const chatId = msg.from; // No formato internacional recebido do webhook
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

        console.log('\\n📩 Mensagem de texto processando:', msg.body);

        let partsEntrada = [{ text: msg.body }];
        adicionarAoHistorico(chatId, 'user', partsEntrada);

        const historico = obterHistorico(chatId);
        
        // --- OBSIDIAN RAG NA VEIA (Leitura Direta) ---
        // Aqui não usamos embeddings super pesados, apenas injetamos CLAUDE.md e Maps vitais no inicio
        const coreVault = readCoreVaultContext();
        let promptText = `${coreVault}\n\nMENSAGEM DO USUÁRIO:\n${msg.body}`;
        
        const textoComContexto = [{ text: promptText }];

        console.time('🤖 Tempo API DeepSeek/Groq');
        const respostaIA = await processarMensagemMultimodal(textoComContexto, historico);
        console.timeEnd('🤖 Tempo API DeepSeek/Groq');

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
        } else {
            const mensagemErro = respostaIA || '❌ Desculpe, não consegui processar sua solicitação.';
            await client.sendMessage(chatId, mensagemErro);
            adicionarAoHistorico(chatId, 'model', [{ text: mensagemErro }]);
        }

    } catch (error) {
        console.error('\\n❌ Erro não tratado no evento de mensagem:', error);
        try {
            await client.sendMessage(msg.from, '❌ Ops! Ocorreu um erro inesperado. Tente novamente mais tarde.');
        } catch (sendError) {}
    }
}

module.exports = { handleMessage };
