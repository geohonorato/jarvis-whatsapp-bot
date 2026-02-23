/**
 * Message Handler — orquestrador principal de mensagens
 * 
 * Responsável apenas por:
 * 1. Verificar grupo/menção
 * 2. Rotear para handlers especializados
 * 3. Coordenar o fluxo híbrido (Gemini → Groq)
 * 
 * Cada domínio (calendário, finanças, imagem, etc.) tem seu próprio handler em ./handlers/
 */

const { adicionarAoHistorico, obterHistorico, limparHistorico } = require('../chat-history');
const {
    processarMensagemMultimodal: processarComGroqPrincipal,
    filtrarPensamentos,
    processarComGroq
} = require('../api/groq');
const { analisarConteudoMultimodal } = require('../api/gemini');

// Handlers especializados
const { handleMediaMessage } = require('./handlers/media-handler');
const { handleYoutubeCommand } = require('./handlers/youtube-handler');
const { isDocumentResendRequest, hasCachedImage, handleDocumentResend, handleImageCommand } = require('./handlers/image-handler');
const { handleMagisteriumCommand } = require('./handlers/magisterium-handler');
const { isFinanceCommand, handleFinanceCommand } = require('./handlers/finance-handler');
const { isCalendarCommand, hasPendingDeleteSelection, handleDeleteSelection, handleSetupPascom, handleCalendarCommand } = require('./handlers/calendar-handler');
const { isACCommand, handleACCommand } = require('./handlers/ac-handler');

async function handleMessage(msg, client) {
    try {
        const chatId = msg.from;
        const lowerCaseBody = msg.body?.toLowerCase() || '';
        const hasText = !!msg.body;

        // --- VERIFICAÇÃO DE GRUPO E MENÇÃO ---
        const isGroup = chatId.endsWith('@g.us');

        if (isGroup) {
            let isMentioned = false;
            const botId = client.info.wid._serialized;

            try {
                const mentions = await msg.getMentions();
                isMentioned = mentions.some(contact => contact.id._serialized === botId);
            } catch (err) {
                console.warn('⚠️ Falha ao obter menções (bug WWebJS), usando fallback regex:', err.message);

                const userPart = botId.split('@')[0];
                const regexMention = new RegExp(`@${userPart}`, 'i');
                const regexName = /@(jarvis|bot|assistente|calendar|passcom)/i;
                const regexPhoneVar = /@(55)?(91)?(9)?81703506|@33879406706925/i;

                const matchNumber = regexMention.test(msg.body);
                const matchName = regexName.test(msg.body);
                const matchPhone = regexPhoneVar.test(msg.body);

                isMentioned = matchNumber || matchName || matchPhone;

                console.log(`🔍 Debug Menção Fallback:`);
                console.log(`   - Body: "${msg.body}"`);
                console.log(`   - Regex ID (${regexMention}): ${matchNumber}`);
                console.log(`   - Regex Nome (${regexName}): ${matchName}`);
                console.log(`   - Regex Phone (${regexPhoneVar}): ${matchPhone}`);
                console.log(`   - Resultado Final: ${isMentioned}`);
            }

            const quotedMsg = msg.hasQuotedMsg ? await msg.getQuotedMessage() : null;
            const isQuotingBot = quotedMsg && quotedMsg.fromMe;

            if (!isMentioned && !isQuotingBot) {
                return;
            } else {
                console.log(`🔔 Mensagem de grupo (${chatId}) ACEITA (Menção: ${isMentioned}, Resposta: ${isQuotingBot})`);
            }
        }

        // --- Lógica de Estado para Remoção de Evento ---
        if (hasPendingDeleteSelection(chatId)) {
            await handleDeleteSelection(client, chatId, lowerCaseBody);
            return;
        }

        // --- Processamento de Mídia ---
        if (msg.hasMedia) {
            await handleMediaMessage(client, msg, chatId, processarMensagemTexto);
            return;
        }

        // --- Processamento de Texto ---
        if (hasText) {
            console.log('\n📩 Mensagem de texto recebida:', msg.body);

            // --- Verificação de Transações Pendentes (Human-in-the-Loop) ---
            const pendingTransactions = require('./handlers/pending-transactions');
            const hasPending = pendingTransactions.getPendingCount() > 0;

            if (hasPending) {
                const { handlePendingTransactionReply } = require('./handlers/finance-handler');
                const handled = await handlePendingTransactionReply(client, chatId, msg.body, pendingTransactions);
                if (handled) return; // Se foi tratado como resposta financeira, encerra o ciclo
            }

            const partsEntrada = [{ text: msg.body }];
            adicionarAoHistorico(chatId, 'user', partsEntrada);
            await processarMensagemTexto(client, partsEntrada, chatId);
        } else {
            console.log("❓ Mensagem recebida sem texto ou mídia suportada.");
        }

    } catch (error) {
        console.error('\n❌ Erro não tratado no evento de mensagem:', error);
        try {
            adicionarAoHistorico(msg.from || 'unknown', 'model', [{ text: `❌ Erro GERAL: ${error.message}` }]);
            await client.sendMessage(msg.from, '❌ Ops! Ocorreu um erro inesperado. Tente novamente mais tarde.');
        } catch (sendError) {
            console.error('❌ Falha ao enviar mensagem de erro GERAL:', sendError);
        }
    }
}

async function processarAudioRecebido(client, msg, chatId) {
    console.log('\n🎤 Áudio recebido mas ignorado (função desativada temporariamente)');
    await client.sendMessage(chatId, '❌ Desculpe, o processamento de áudio está temporariamente desativado.');
}

async function processarMensagemTexto(client, partsEntrada, chatId, usarGemini = false) {
    try {
        const historico = obterHistorico(chatId);
        const textoUsuario = partsEntrada.find(p => p.text)?.text || '';
        const lowerCaseBody = textoUsuario.toLowerCase();
        const temConteudoMultimodal = partsEntrada.some(p => p.inlineData);
        const isGroup = chatId.endsWith('@g.us');

        // --- SISTEMA HÍBRIDO ---
        let partsParaProcessar = partsEntrada;

        if (temConteudoMultimodal) {
            console.log('\n🔀 === SISTEMA HÍBRIDO ATIVADO ===');
            console.log('🖼️ Conteúdo multimodal detectado');
            console.log('📋 Fase 1/2: Gemini analisa/transcreve o conteúdo...');

            const analiseGemini = await analisarConteudoMultimodal(partsEntrada);

            if (analiseGemini.startsWith('❌')) {
                await client.sendMessage(chatId, analiseGemini);
                return;
            }

            console.log('✅ Análise/transcrição concluída');
            console.log('📋 Fase 2/2: Groq processa e decide ação...');

            const contextoUsuario = textoUsuario ? `\nCONTEXTO DO USUÁRIO: "${textoUsuario}"\n\n` : '\n';
            partsParaProcessar = [{
                text: `${contextoUsuario}[CONTEÚDO ANALISADO/TRANSCRITO]:\n${analiseGemini}\n\nCom base nas informações acima, decida qual ação tomar (conversar, criar evento, gerar imagem, consultar magistério, etc).`
            }];
        } else {
            console.log('📝 Apenas texto - processamento direto com Groq');
        }

        // --- Pedido de reenvio como documento ---
        if (isDocumentResendRequest(textoUsuario) && hasCachedImage(chatId)) {
            await handleDocumentResend(client, chatId, partsEntrada);
            return;
        }

        // --- Comandos diretos do usuário ---
        if (lowerCaseBody.startsWith('/resumir ')) {
            await handleYoutubeCommand(client, chatId, textoUsuario, partsEntrada);
            return;
        }

        if (lowerCaseBody === '/limpar') {
            limparHistorico(chatId);
            await client.sendMessage(chatId, '🧹 Histórico da conversa limpo!');
            return;
        }

        // --- Code Interpreter: Execução de Python ---
        if (lowerCaseBody.startsWith('/python ') || lowerCaseBody.startsWith('/py ')) {
            const { executePythonCode } = require('../interpreter/python-executor');
            const code = textoUsuario.replace(/^\/python\s+|^\/py\s+/i, '');

            await client.sendMessage(chatId, '🐍 Executando script...');

            try {
                const output = await executePythonCode(code);
                await client.sendMessage(chatId, `🖥️ *Saída:* \n\`\`\`\n${output}\n\`\`\``);
            } catch (error) {
                await client.sendMessage(chatId, `❌ Erro interno: ${error.message}`);
            }
            return;
        }

        // --- Conversor de Mídia (FFmpeg) ---
        if (lowerCaseBody === '/tomp3') {
            if (!msg.hasQuotedMsg) {
                await client.sendMessage(chatId, '❌ Responda a um vídeo ou áudio com /tomp3');
                return;
            }

            const quotedMsg = await msg.getQuotedMessage();
            if (!quotedMsg.hasMedia) {
                await client.sendMessage(chatId, '❌ A mensagem respondida não tem mídia.');
                return;
            }

            await client.sendMessage(chatId, '⏳ Baixando e convertendo mídia...');

            try {
                const media = await quotedMsg.downloadMedia();
                if (!media) throw new Error('Falha no download da mídia.');

                // Salva temporariamente
                const { convertToMp3 } = require('../media/converter');
                const fs = require('fs');
                const path = require('path');
                const tempInput = path.join(__dirname, `../../temp/media/input_${Date.now()}.${media.mimetype.split('/')[1].split(';')[0]}`);

                // Decodifica Base64 e salva
                fs.writeFileSync(tempInput, media.data, 'base64');

                // Converte
                const mp3Path = await convertToMp3(tempInput);

                // Envia áudio
                const { MessageMedia } = require('whatsapp-web.js');
                const mp3Media = MessageMedia.fromFilePath(mp3Path);
                await client.sendMessage(chatId, mp3Media, { sendAudioAsVoice: true });

                // Limpa arquivos
                fs.unlinkSync(tempInput);
                fs.unlinkSync(mp3Path);

            } catch (error) {
                console.error('Erro /tomp3:', error);
                await client.sendMessage(chatId, `❌ Erro na conversão: ${error.message}`);
            }
            return;
        }

        // --- RAG: Memória de Longo Prazo ---
        if (isACCommand(lowerCaseBody)) {
            const res = await handleACCommand(client, chatId, textoUsuario);
            await client.sendMessage(chatId, res);
            return;
        }

        // --- RAG: Memória de Longo Prazo ---
        const ragService = require('../rag/rag-service');

        // Comando /memorizar
        if (lowerCaseBody.startsWith('/memorizar ')) {
            const memoria = textoUsuario.substring(11).trim();
            if (memoria) {
                await ragService.adicionarMemoria(memoria, {
                    source: 'user_command',
                    chatId: chatId,
                    date: new Date().toISOString()
                });
                await client.sendMessage(chatId, '🧠 Memória salva com sucesso!');
            } else {
                await client.sendMessage(chatId, '❌ Use: /memorizar <texto>');
            }
            return;
        }

        // --- Adiciona ao histórico (se não foi comando ou mídia) ---
        const jaAdicionadoComoLegenda = partsEntrada.length > 1 && partsEntrada.some(p => p.inlineData);
        if (!textoUsuario.startsWith('/') && !jaAdicionadoComoLegenda) {
            adicionarAoHistorico(chatId, 'user', partsEntrada);
        }

        // Otimização: não envia histórico no fluxo de delete
        const ehFluxoDelete = historico.some(h => h.parts.some(p => p.text?.includes('/delete')));
        const historicoParaEnviar = ehFluxoDelete ? null : historico;

        // --- GROQ: Decisão final ---
        // --- GROQ: Decisão final ---
        console.time('🕒 Tempo Total Groq');
        console.time('🔍 Tempo RAG');

        // RAG: Busca inteligente com query expansion para queries curtas
        // Estratégia: busca DUPLA — query original + query expandida com contexto do histórico
        let contextoRAG = [];

        // 1. Busca direta (sempre)
        const resultsDirect = await ragService.buscarContexto(textoUsuario);

        // 2. Busca expandida (só para queries curtas, com contexto de msgs anteriores do USER)
        if (textoUsuario.length < 40 && historico.length > 0) {
            const lastUserMsgs = historico
                .filter(h => h.role === 'user')
                .slice(-2)
                .map(h => h.parts.map(p => p.text || '').join(' '))
                .filter(t => t.length > 0);

            if (lastUserMsgs.length > 0) {
                const expandedQuery = `${lastUserMsgs.join('. ')}. ${textoUsuario}`;
                console.log(`🔎 Query expandida: "${textoUsuario}" → "${expandedQuery.substring(0, 80)}..."`);
                const resultsExpanded = await ragService.buscarContexto(expandedQuery);

                // Merge: adiciona resultados expandidos que não estão nos diretos
                const directTexts = new Set(resultsDirect.map(d => d.text));
                for (const r of resultsExpanded) {
                    if (!directTexts.has(r.text)) {
                        resultsDirect.push(r);
                    }
                }
            }
        }

        contextoRAG = resultsDirect;
        console.timeEnd('🔍 Tempo RAG');

        let textoComContexto = partsParaProcessar;

        if (contextoRAG.length > 0) {
            const contextoString = contextoRAG.map(doc => `- ${doc.text}`).join('\n');
            // console.log(`🧠 Contexto recuperado...`); // Reduzindo flood de log

            const textoOriginal = partsParaProcessar[0].text;
            textoComContexto = [{
                text: `${textoOriginal}\n\n[MEMÓRIA DE LONGO PRAZO RELEVANTE]:\n${contextoString}`
            }];
        }

        console.time('🤖 Tempo API Groq');
        const respostaIA = await processarComGroqPrincipal(textoComContexto, historicoParaEnviar);
        console.timeEnd('🤖 Tempo API Groq');
        console.timeEnd('🕒 Tempo Total Groq');

        if (respostaIA && !respostaIA.startsWith('❌')) {
            let respostaFinal = respostaIA;

            // --- MEMORY EXTRACTOR (Background, fire-and-forget) ---
            // Extrai fatos automaticamente via IA separada, sem tags visíveis
            const textoOriginalUsuario = partsParaProcessar[0]?.text || '';
            ragService.extrairEMemorizar(textoOriginalUsuario, respostaIA, chatId)
                .catch(err => console.error('⚠️ Memory extractor error:', err.message));

            // --- TOOL USE: Processa ferramentas solicitadas pela IA ---

            // 1. Python Code Interpreter
            // Regex: <PYTHON>code</PYTHON>
            const pythonRegex = /<PYTHON>([\s\S]*?)<\/PYTHON>/i;
            const pythonMatch = respostaIA.match(pythonRegex);
            if (pythonMatch) {
                const code = pythonMatch[1];
                respostaFinal = respostaFinal.replace(pythonRegex, '').trim();

                await client.sendMessage(chatId, '🐍 *Executando código Python...*');
                try {
                    const { executePythonCode } = require('../interpreter/python-executor');
                    const result = await executePythonCode(code);

                    // Envia output de texto (se não for só a mensagem de "gráfico salvo")
                    const textOutput = result.text.replace(/\[CHART_SAVED\].*$/gm, '').trim();
                    if (textOutput && textOutput !== '✅ Código executado com sucesso.') {
                        await client.sendMessage(chatId, `🖥️ *Resultado:*\n\`\`\`\n${textOutput}\n\`\`\``);
                    }

                    // Envia gráfico como documento HD se gerado
                    if (result.imagePath) {
                        const { MessageMedia } = require('whatsapp-web.js');
                        const chartMedia = MessageMedia.fromFilePath(result.imagePath);

                        await client.sendMessage(chatId, chartMedia, {
                            sendMediaAsHd: true,
                            caption: '📊 Gráfico gerado pelo Python'
                        });

                        // Limpa arquivo temporário
                        const fs = require('fs');
                        try { fs.unlinkSync(result.imagePath); } catch (e) { }
                    }
                } catch (err) {
                    await client.sendMessage(chatId, `❌ Erro na execução: ${err.message}`);
                }
            }

            // 2. Crawler / Vigilante
            // Regex: <VIGIAR url="..." preco="..." />
            const vigiarRegex = /<VIGIAR\s+url="([^"]+)"\s+preco="([^"]+)"\s*\/?>/i;
            const vigiarMatch = respostaIA.match(vigiarRegex);
            if (vigiarMatch) {
                const url = vigiarMatch[1];
                const preco = parseFloat(vigiarMatch[2]);
                respostaFinal = respostaFinal.replace(vigiarRegex, '').trim();

                const { addWatch } = require('../../crawler/watch-manager');
                addWatch(url, preco, chatId);
                await client.sendMessage(chatId, `️🕵️‍♂️ *Vigilância Configurada!*\nURL: ${url}\nAlvo: R$ ${preco}`);
            }

            // 3. Conversor de Mídia
            // Regex: <CONVERTER_MEDIA />
            if (respostaIA.includes('<CONVERTER_MEDIA />') || respostaIA.includes('<CONVERTER_MEDIA/>')) {
                respostaFinal = respostaFinal.replace(/<CONVERTER_MEDIA\s*\/?>/gi, '').trim();

                // Verifica se tem mídia para converter (na própria mensagem ou citada)
                let mediaMsg = msg;
                if (msg.hasQuotedMsg) {
                    mediaMsg = await msg.getQuotedMessage();
                }

                if (mediaMsg.hasMedia) {
                    await client.sendMessage(chatId, '⏳ *Convertendo mídia para MP3...*');
                    try {
                        const media = await mediaMsg.downloadMedia();
                        if (!media) throw new Error('Falha ao baixar mídia.');

                        const fs = require('fs');
                        const path = require('path');
                        const { convertToMp3 } = require('../media/converter');

                        // Salva input temporário
                        const tempInput = path.join(__dirname, `../../temp/media/input_tool_${Date.now()}.${media.mimetype.split('/')[1].split(';')[0]}`);
                        fs.writeFileSync(tempInput, media.data, 'base64');

                        // Converte
                        const mp3Path = await convertToMp3(tempInput);

                        // Envia
                        const { MessageMedia } = require('whatsapp-web.js');
                        const mp3Media = MessageMedia.fromFilePath(mp3Path);
                        await client.sendMessage(chatId, mp3Media, { sendAudioAsVoice: true });

                        // Limpa
                        fs.unlinkSync(tempInput);
                        fs.unlinkSync(mp3Path);
                    } catch (err) {
                        await client.sendMessage(chatId, `❌ Erro na conversão: ${err.message}`);
                    }
                } else {
                    await client.sendMessage(chatId, '⚠️ Não encontrei mídia para converter. Responda a um vídeo/áudio ou envie um.');
                }
            }

            // 4. Baixador de Vídeo
            // Regex: <BAIXAR_VIDEO url="..." /> - Suporta quebras de linha com [\s\S]
            const baixarRegex = /<BAIXAR_VIDEO[\s\S]*?url="([^"]+)"[\s\S]*?\/?>/i;
            const baixarMatch = respostaIA.match(baixarRegex);
            if (baixarMatch) {
                const url = baixarMatch[1];
                respostaFinal = respostaFinal.replace(baixarRegex, '').trim();

                await client.sendMessage(chatId, '⏳ *Baixando vídeo...* (Isso pode levar alguns instantes)');
                try {
                    const { downloadYouTubeVideo } = require('../media/downloader');
                    const videoPath = await downloadYouTubeVideo(url);

                    const fs = require('fs');
                    const { MessageMedia } = require('whatsapp-web.js');
                    const videoMedia = MessageMedia.fromFilePath(videoPath);

                    // Envia como documento se for muito pesado, ou vídeo normal
                    // Por padrão, enviamos como vídeo
                    await client.sendMessage(chatId, videoMedia, { sendVideoAsGif: false, caption: '🎥 Vídeo baixado!' });

                    // Limpa
                    fs.unlinkSync(videoPath);
                } catch (err) {
                    await client.sendMessage(chatId, `❌ Erro no download: ${err.message}`);
                }
            }

            // 5. Integração Notion
            // Regex: <NOTION>...</NOTION>
            const notionRegex = /<NOTION>([\s\S]*?)<\/NOTION>/i;
            const notionMatch = respostaIA.match(notionRegex);
            if (notionMatch) {
                const notionContent = notionMatch[1].trim();
                respostaFinal = respostaFinal.replace(notionRegex, '').trim();

                try {
                    const notionData = JSON.parse(notionContent);
                    const notionApi = require('../api/notion');

                    if (!notionApi.isReady()) {
                        await client.sendMessage(chatId, '⚠️ Chave do Notion não configurada.');
                    } else {
                        await client.sendMessage(chatId, '⏳ *Acessando Notion...*');
                        let result;

                        switch (notionData.action) {
                            case 'search':
                                result = await notionApi.search(notionData.query);
                                break;
                            case 'create_page':
                                result = await notionApi.createPage(notionData.databaseId, notionData.title, notionData.properties);
                                break;
                            case 'append_blocks':
                                result = await notionApi.appendBlocks(notionData.pageId, notionData.children);
                                break;
                            case 'query_db':
                                result = await notionApi.queryDatabase(notionData.databaseId, notionData.filter, notionData.sorts);
                                break;
                            default:
                                throw new Error('Ação Notion desconhecida: ' + notionData.action);
                        }

                        if (result.success) {
                            let msgRetorno = '✅ *Ação no Notion concluída com sucesso!*';

                            // Se for operação de leitura, pedimos para a IA resumir os dados brutos
                            if (notionData.action === 'search' || notionData.action === 'query_db') {
                                // Simplifica os dados para caber no limite de tokens do LLM
                                const simplifiedData = result.data.map(item => {
                                    let title = 'Documento';
                                    if (item.properties) {
                                        for (const key in item.properties) {
                                            if (item.properties[key] && item.properties[key].type === 'title') {
                                                const t = item.properties[key].title;
                                                if (t && t.length > 0) title = t.map(x => x.plain_text).join('');
                                            }
                                        }
                                    }
                                    return {
                                        title: title,
                                        url: item.url,
                                        content: item.extracted_content || '(Apenas link, sem conteúdo extraído)'
                                    };
                                });

                                const payloadText = JSON.stringify(simplifiedData).substring(0, 4000);
                                const promptResumo = [
                                    { text: `O usuário perguntou/pediu: "${textoUsuario}".\n\nO sistema buscou no banco de dados do Notion e retornou o seguinte contexto (blocos de texto):\n${payloadText}\n\nAnalise o "content" retornado e responda detalhadamente o pedido do usuário usando EXCLUSIVAMENTE essas informações. Fale de forma natural e amigável, como um assistente no WhatsApp.\n\nREGRAS RÍGIDAS DE FORMATAÇÃO (WHATSAPP):\n- Use APENAS *texto* para negrito (NUNCA use **texto**)\n- Use APENAS _texto_ para itálico\n- NUNCA use cabeçalhos como #, ## ou ###\n- NUNCA use tabelas (| Nome | Valor |), converta-as para listas em texto puro\n- Use emojis e listas simples (com o caractere •)\n- Se a resposta completa não estiver no "content", informe com simpatia o que você conseguiu achar.` }
                                ];
                                const { processarMensagemMultimodal } = require('../api/groq');
                                const resumoIA = await processarMensagemMultimodal(promptResumo);
                                msgRetorno = `✅ *Notion:*\n\n${resumoIA}`;
                            }

                            await client.sendMessage(chatId, msgRetorno);
                        } else {
                            await client.sendMessage(chatId, `❌ Erro no Notion: ${result.error}`);
                        }
                    }
                } catch (err) {
                    await client.sendMessage(chatId, `❌ Falha ao processar comando Notion: ${err.message}`);
                }
            }

            const partsResposta = [{ text: respostaFinal }];

            // Roteamento de comandos gerados pela IA
            if (respostaIA.startsWith('/magisterium')) { // Use respostaIA here to check for the original command
                await handleMagisteriumCommand(client, chatId, respostaIA, historico);
                return;
            }

            if (respostaIA.startsWith('/imagem')) { // Use respostaIA here to check for the original command
                await handleImageCommand(client, chatId, respostaIA, partsResposta);
                return;
            }

            // A partir daqui, adiciona resposta ao histórico
            adicionarAoHistorico(chatId, 'model', partsResposta);

            if (isFinanceCommand(respostaIA)) {
                await handleFinanceCommand(client, chatId, respostaIA);
                return;
            }

            if (respostaIA.toLowerCase().trim() === '/setup pascom' || lowerCaseBody === '/setup pascom') {
                await handleSetupPascom(client, chatId, isGroup);
                return;
            }

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

            if (isACCommand(respostaIA)) {
                // Remove thinking/reasoning before command if present
                const cmdLine = respostaIA.split('\n').find(l => l.startsWith('/ac'));
                if (cmdLine) {
                    const res = await handleACCommand(client, chatId, cmdLine);
                    await client.sendMessage(chatId, res);
                    adicionarAoHistorico(chatId, 'model', [{ text: res }]);
                    return;
                }
            }

            // Texto normal — envia direto
            if (respostaFinal && respostaFinal.trim().length > 0) {
                console.log('🤖 Resposta enviada:', respostaFinal);
                await client.sendMessage(chatId, respostaFinal);
            }
        }

        // Se não houve resposta válida
        if (!respostaIA || respostaIA.startsWith('❌')) {
            const mensagemErro = respostaIA || '❌ Desculpe, não consegui processar sua solicitação.';
            await client.sendMessage(chatId, mensagemErro);
            adicionarAoHistorico(chatId, 'model', [{ text: mensagemErro }]);
        }

    } catch (error) {
        console.error('\n❌ Erro ao processar mensagem:', error);
        await client.sendMessage(chatId, '❌ Ocorreu um erro interno ao processar sua mensagem.');
        adicionarAoHistorico(chatId, 'model', [{ text: `❌ Erro interno no processamento: ${error.message}` }]);
    }
}

module.exports = { handleMessage, processarAudioRecebido, processarMensagemTexto };
