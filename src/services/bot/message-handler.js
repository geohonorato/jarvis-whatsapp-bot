const { adicionarAoHistorico, obterHistorico, limparHistorico } = require('../chat-history');
const {
    processarMensagemMultimodal: processarComGroqPrincipal,
    filtrarPensamentos,
    processarComGroq
} = require('../api/groq');
const {
    processarMensagemMultimodal: processarComGemini,
    analisarConteudoMultimodal
} = require('../api/gemini');
const { responderMagisteriumComFormatacao } = require('../magisterium');
const { processarComandoImagem } = require('../api/image-generator');
const { resumirVideoYoutube } = require('../api/youtube');
const { setPascomGroupId } = require('../jobs/pascom-notification');

const {
    registrarDespesa,
    registrarReceita,
    obterResumoFinanceiro,
    obterUltimasTransacoes,
    definirOrcamento,
    obterComparacao,
    exportarDados
} = require('../finance-api');

// Cache temporário para última imagem gerada (por chat)
const ultimaImagemCache = {};
const {
    getGoogleAuth,
    listarEventos,
    listarEventosAmanha,
    listarEventosSemana,
    listarEventosProximaSemana,
    listarEventosMes,
    listarEventosProximoMes,
    listarEventosData,
    listarProximosEventos,
    adicionarEvento,
    removerEvento,
    formatarEventos,
    CALENDAR_ID,
    PASCOM_CALENDAR_ID
} = require('../api/calendar');
const { MessageMedia } = require("whatsapp-web.js");
const fs = require('fs');

// Objeto para gerenciar o estado da conversa
const conversationState = {};

async function handleMessage(msg, client) {
    try {
        const chatId = msg.from;
        const lowerCaseBody = msg.body?.toLowerCase() || '';
        const hasText = !!msg.body; // Verifica se há texto na mensagem

        // --- INICIA LEMBRETES AUTOMATICAMENTE ---








        // --- VERIFICAÇÃO DE GRUPO E MENÇÃO ---
        const isGroup = chatId.endsWith('@g.us');
        let shouldProcess = true;

        if (isGroup) {
            let isMentioned = false;
            const botId = client.info.wid._serialized;

            try {
                // Tenta método nativo
                const mentions = await msg.getMentions();
                isMentioned = mentions.some(contact => contact.id._serialized === botId);
            } catch (err) {
                // Fallback: verificação manual no corpo da mensagem se a função falhar (erro comum WWebJS)
                console.warn('⚠️ Falha ao obter menções (bug WWebJS), usando fallback regex:', err.message);

                const userPart = botId.split('@')[0];
                const regexMention = new RegExp(`@${userPart}`, 'i');
                const regexName = /@(jarvis|bot|assistente|calendar|passcom)/i;
                // Explicito para 559181703506 e LID observada nos logs
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

            // Opcional: Verifica se está respondendo a uma mensagem do bot
            const quotedMsg = msg.hasQuotedMsg ? await msg.getQuotedMessage() : null;
            const isQuotingBot = quotedMsg && quotedMsg.fromMe;

            if (!isMentioned && !isQuotingBot) {
                // Se for grupo e não foi mencionado nem citado, ignora silenciosamente
                shouldProcess = false;
                // console.log(`🔇 Mensagem de grupo (${chatId}) ignorada (sem menção).`);
                return;
            } else {
                console.log(`🔔 Mensagem de grupo (${chatId}) ACEITA (Menção: ${isMentioned}, Resposta: ${isQuotingBot})`);
            }
        }

        // --- Lógica de Estado para Remoção de Evento ---
        if (conversationState[chatId] && conversationState[chatId].action === 'awaiting_delete_selection') {
            const selection = parseInt(lowerCaseBody, 10);
            const events = conversationState[chatId].events;

            if (!isNaN(selection) && selection > 0 && selection <= events.length) {
                const eventToDelete = events[selection - 1];
                try {
                    const auth = await getGoogleAuth();
                    await removerEvento(auth, eventToDelete.id);
                    await client.sendMessage(chatId, `✅ Evento "${eventToDelete.summary}" removido com sucesso!`);
                } catch (error) {
                    console.error('❌ Erro ao tentar remover evento por seleção:', error);
                    await client.sendMessage(chatId, '❌ Ocorreu um erro ao tentar remover o evento.');
                }
            } else {
                await client.sendMessage(chatId, '❌ Seleção inválida. Por favor, responda com o número do evento que deseja remover.');
            }
            // Limpa o estado da conversa após a ação
            delete conversationState[chatId];
            return; // Finaliza o processamento aqui
        }

        // --- Processamento de Mídia ---
        if (msg.hasMedia) {
            if (msg.type === 'image') {
                console.log('\n📸 Imagem recebida...');
                try {
                    const media = await msg.downloadMedia();
                    if (!media || !media.data) {
                        await client.sendMessage(chatId, '❌ Erro ao baixar imagem.');
                        return;
                    }

                    const legenda = msg.body || ''; // Pega a legenda/caption
                    console.log(`🖼️ Imagem ${media.mimetype} recebida.` + (legenda ? ` Com legenda: "${legenda}"` : ' Sem legenda.'))

                    // Prepara as partes para envio multimodal
                    const partsEntrada = [];
                    if (legenda) {
                        partsEntrada.push({ text: legenda }); // Adiciona o texto da legenda primeiro
                    } else {
                        // Se não houver legenda, envia um prompt padrão pedindo análise? Ou não envia nada?
                        // Vamos enviar um prompt padrão se não houver legenda.
                        partsEntrada.push({ text: "Analise esta imagem em detalhes." });
                    }
                    partsEntrada.push({ inlineData: { data: media.data, mimeType: media.mimetype } }); // Adiciona a imagem

                    // Adiciona ao histórico ANTES de enviar para a IA
                    adicionarAoHistorico(chatId, 'user', partsEntrada);

                    // Chama a função de processamento multimodal com GEMINI (suporta imagens)
                    await processarMensagemTexto(client, partsEntrada, chatId, true);

                } catch (error) {
                    console.error('\n❌ Erro ao processar imagem:', error);
                    adicionarAoHistorico(chatId, 'user', [{ text: "[Erro ao processar imagem enviada]" }]);
                    await client.sendMessage(chatId, '❌ Erro inesperado ao processar imagem.');
                }
                return; // Importante para não processar como texto depois
            }
            else if (msg.type === 'audio' || msg.type === 'ptt') {
                console.log('\n🎤 Áudio recebido - processando com sistema híbrido...');
                try {
                    const media = await msg.downloadMedia();
                    if (!media || !media.data) {
                        await client.sendMessage(chatId, '❌ Erro ao baixar áudio.');
                        return;
                    }

                    console.log(`🎵 Áudio ${media.mimetype} recebido`);

                    // Prepara as partes para envio multimodal
                    const partsEntrada = [
                        { text: "Transcreva este áudio em português do Brasil." },
                        { inlineData: { data: media.data, mimeType: media.mimetype } }
                    ];

                    // Adiciona ao histórico ANTES de enviar para a IA
                    adicionarAoHistorico(chatId, 'user', partsEntrada);

                    // Chama a função de processamento multimodal (sistema híbrido)
                    await processarMensagemTexto(client, partsEntrada, chatId, true);

                } catch (error) {
                    console.error('\n❌ Erro ao processar áudio:', error);
                    adicionarAoHistorico(chatId, 'user', [{ text: "[Erro ao processar áudio enviado]" }]);
                    await client.sendMessage(chatId, '❌ Erro inesperado ao processar áudio.');
                }
                return;
            }
            else {
                console.log(`\n⚠️ Mídia do tipo ${msg.type} recebida, mas não processada.`);
                // Pode adicionar um marcador ao histórico se quiser
                adicionarAoHistorico(chatId, 'user', [{ text: `[Mídia não suportada recebida: ${msg.type}]` }]);
                // Enviar uma mensagem para o usuário?
                // await client.sendMessage(chatId, `Desculpe, ainda não consigo processar arquivos do tipo ${msg.type}.`);
                return; // Importante
            }
        }
        // --- Processamento apenas de Texto ---
        else if (hasText) {
            console.log('\n📩 Mensagem de texto recebida:', msg.body);
            // Prepara 'parts' apenas com texto
            const partsEntrada = [{ text: msg.body }];

            // Adiciona ao histórico ANTES de enviar
            adicionarAoHistorico(chatId, 'user', partsEntrada);

            // Chama a função de processamento (que agora é multimodal)
            await processarMensagemTexto(client, partsEntrada, chatId);

        } else {
            console.log("❓ Mensagem recebida sem texto ou mídia suportada.");
            // Não faz nada ou envia uma mensagem de ajuda?
        }

    } catch (error) {
        console.error('\n❌ Erro não tratado no evento de mensagem:', error);
        try {
            // Tenta adicionar erro ao histórico
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

        // Extrai o texto principal da entrada para verificações de comando (se houver)
        const textoUsuario = partsEntrada.find(p => p.text)?.text || '';
        const lowerCaseBody = textoUsuario.toLowerCase();

        // Verifica se há conteúdo multimodal (imagem, áudio, etc)
        const temConteudoMultimodal = partsEntrada.some(p => p.inlineData);

        // SISTEMA HÍBRIDO INTELIGENTE:
        // 1. Se tiver mídia (imagem/áudio/doc) → Gemini analisa/transcreve primeiro
        // 2. Depois envia resultado para Groq tomar decisão
        // 3. Se for apenas texto → Groq direto

        let partsParaProcessar = partsEntrada;

        if (temConteudoMultimodal) {
            console.log('\n� === SISTEMA HÍBRIDO ATIVADO ===');
            console.log('�🖼️ Conteúdo multimodal detectado');
            console.log('📋 Fase 1/2: Gemini analisa/transcreve o conteúdo...');

            // Gemini APENAS analisa/transcreve (não toma decisões)
            const analiseGemini = await analisarConteudoMultimodal(partsEntrada);

            if (analiseGemini.startsWith('❌')) {
                await client.sendMessage(chatId, analiseGemini);
                return;
            }

            console.log('✅ Análise/transcrição concluída');
            console.log('📋 Fase 2/2: Groq processa e decide ação...');

            // Prepara o contexto para o Groq com a análise do Gemini
            const contextoUsuario = textoUsuario ? `\nCONTEXTO DO USUÁRIO: "${textoUsuario}"\n\n` : '\n';
            partsParaProcessar = [{
                text: `${contextoUsuario}[CONTEÚDO ANALISADO/TRANSCRITO]:\n${analiseGemini}\n\nCom base nas informações acima, decida qual ação tomar (conversar, criar evento, gerar imagem, consultar magistério, etc).`
            }];

        } else {
            console.log('📝 Apenas texto - processamento direto com Groq (GPT OSS 120b)');
        }

        // Verifica se é um pedido de reenvio da última imagem como documento
        const pedidoDocumento = /^(envie?|mande?|envia|manda|enviar|mandar)\s+(como|em)\s+documento$/i.test(textoUsuario.trim());
        if (pedidoDocumento && ultimaImagemCache[chatId]) {
            console.log('\n📄 Detectado pedido de reenvio como documento...');

            const ultimaImagem = ultimaImagemCache[chatId];

            // Verifica se a imagem ainda existe
            if (fs.existsSync(ultimaImagem.imagePath)) {
                const mediaGerada = MessageMedia.fromFilePath(ultimaImagem.imagePath);

                console.log("📄 Reenviando última imagem como documento...");
                await client.sendMessage(chatId, mediaGerada, {
                    sendMediaAsDocument: true,
                    caption: '📄 Imagem enviada como documento (qualidade original preservada)'
                });

                adicionarAoHistorico(chatId, 'user', partsEntrada);
                adicionarAoHistorico(chatId, 'model', [{ text: '[Imagem Reenviada como Documento]' }]);

                return; // Finaliza aqui
            } else {
                await client.sendMessage(chatId, '❌ Desculpe, a última imagem já foi removida. Por favor, gere uma nova imagem.');
                return;
            }
        }

        // Removida verificação manual shouldUseMagisterium - agora o Gemini identifica

        // --- Verificação de Comandos Específicos (Ex: /resumir, /limpar) ---
        if (textoUsuario.toLowerCase().startsWith('/resumir ')) {
            const urlVideo = textoUsuario.substring(9).trim();
            // Validação básica da URL (pode ser melhorada)
            if (urlVideo.includes('youtube.com/') || urlVideo.includes('youtu.be/')) {
                console.log(`\n▶️ Comando /resumir detectado para URL: ${urlVideo}`);
                await client.sendMessage(chatId, `⏳ Entendido! Buscando a transcrição e resumindo o vídeo:\n${urlVideo}\n\nIsso pode levar um momento...`);
                // Adiciona o comando de resumo ao histórico
                adicionarAoHistorico(chatId, 'user', partsEntrada);

                const resumo = await resumirVideoYoutube(urlVideo);

                await client.sendMessage(chatId, resumo);
                // Adiciona resposta do resumo ao histórico
                adicionarAoHistorico(chatId, 'model', [{ text: resumo }]);
                return;
            } else {
                await client.sendMessage(chatId, '❌ URL do YouTube inválida. Use o formato: /resumir https://www.youtube.com/watch?v=...');
                // Adiciona ao histórico
                adicionarAoHistorico(chatId, 'user', partsEntrada);
                adicionarAoHistorico(chatId, 'model', [{ text: '❌ URL inválida fornecida.' }]); // Correção: Adiciona a resposta do modelo
                return;
            }
        }

        if (textoUsuario.toLowerCase() === '/limpar') {
            limparHistorico(chatId); // Limpa histórico específico do chat (ou global se preferir)
            await client.sendMessage(chatId, '🧹 Histórico da conversa limpo!');
            // Não adiciona '/limpar' ao histórico
            return;
        }
        // --- Fim Verificação Comandos ---

        // Adiciona mensagem do usuário ao histórico (se não for comando interno ou resumo)
        // Verifica também se não é uma legenda de imagem já adicionada na seção de imagem
        const jaAdicionadoComoLegenda = partsEntrada.length > 1 && partsEntrada.some(p => p.inlineData);
        if (!textoUsuario.startsWith('/') && !jaAdicionadoComoLegenda) {
            adicionarAoHistorico(chatId, 'user', partsEntrada);
        }


        // Otimização para o fluxo de remoção: não envia o histórico completo
        const ehFluxoDelete = historico.some(h => h.parts.some(p => p.text?.includes('/delete')));
        const historicoParaEnviar = ehFluxoDelete ? null : historico;

        // SEMPRE usa Groq para decisão final (mais rápido e melhor para raciocínio)
        console.log('🧠 Groq (GPT OSS 120b) processando e decidindo ação...');
        const respostaIA = await processarComGroqPrincipal(partsParaProcessar, historicoParaEnviar);

        if (respostaIA && !respostaIA.startsWith('❌')) {
            const partsResposta = [{ text: respostaIA }]; // Prepara resposta para histórico

            // Verifica se a resposta é um comando do Magisterium AI
            if (respostaIA.startsWith('/magisterium')) {
                console.log('\n⛪ Detectado comando /magisterium, redirecionando para especialista...');

                // Extrai a pergunta reformulada após /magisterium
                const perguntaReformulada = respostaIA.substring(12).trim(); // Remove '/magisterium '

                // Envia mensagem de feedback imediato
                await client.sendMessage(chatId, '⛪ Aguarde, consultando o Magistério da Igreja...');

                // Adiciona ao histórico que foi identificada uma questão católica
                adicionarAoHistorico(chatId, 'model', [{ text: '[Questão sobre doutrina católica identificada]' }]);

                // Cria parts com a pergunta reformulada
                const partsMagisterium = [{ text: perguntaReformulada }];

                // Processa com Magisterium AI e formata com Gemini
                const respostaMagisterium = await responderMagisteriumComFormatacao(partsMagisterium, historico);

                await client.sendMessage(chatId, respostaMagisterium);
                adicionarAoHistorico(chatId, 'model', [{ text: respostaMagisterium }]);
                return;
            }

            // Verifica se a resposta é um comando de imagem (gerado pela IA)
            if (respostaIA.startsWith('/imagem')) {
                console.log('\n🎨 Detectado comando /imagem, iniciando geração (Pollinations.AI)...');

                // Envia mensagem de feedback imediato
                await client.sendMessage(chatId, '🎨 Aguarde, gerando sua imagem...');

                // Adiciona o comando /imagem original ao histórico do modelo
                adicionarAoHistorico(chatId, 'model', partsResposta);

                // Processa o comando de imagem usando o serviço de imagens
                const resultadoGeracao = await processarComandoImagem(respostaIA);

                if (resultadoGeracao && resultadoGeracao.imageUrl) {
                    // Se vier uma URL de imagem do Freepik, envia como link e preview
                    const mensagemTexto = `${resultadoGeracao.text}\n${resultadoGeracao.imageUrl}`;
                    try {
                        await client.sendMessage(chatId, mensagemTexto);
                        adicionarAoHistorico(chatId, 'model', [{ text: `[Geração de Imagem Freepik: ${mensagemTexto}]` }]);
                    } catch (err) {
                        console.error('Erro ao enviar imagem do Freepik:', err);
                        await client.sendMessage(chatId, resultadoGeracao.text);
                    }
                } else if (resultadoGeracao && resultadoGeracao.text && !resultadoGeracao.imagePath) {
                    const mensagemTexto = resultadoGeracao.text;
                    console.log(`📝 Geração de imagem retornou texto: ${mensagemTexto}`);
                    await client.sendMessage(chatId, mensagemTexto);
                    adicionarAoHistorico(chatId, 'model', [{ text: `[Geração de Imagem: ${mensagemTexto}]` }]);
                } else if (resultadoGeracao && resultadoGeracao.imagePath) {
                    // Se houver texto antes da imagem, envia-o
                    if (resultadoGeracao.text && !resultadoGeracao.text.startsWith('❌')) {
                        console.log(`📝 Enviando texto pré-imagem: ${resultadoGeracao.text}`);
                        await client.sendMessage(chatId, resultadoGeracao.text);
                        adicionarAoHistorico(chatId, 'model', [{ text: resultadoGeracao.text }]);
                    }

                    // Envia a imagem gerada
                    const mediaGerada = MessageMedia.fromFilePath(resultadoGeracao.imagePath);

                    // Define opções de envio
                    const sendOptions = {};
                    let caption = '';

                    if (resultadoGeracao.sendAsDocument) {
                        // Usuário pediu EXPLICITAMENTE como documento
                        console.log("� Enviando imagem como documento...");
                        sendOptions.sendMediaAsDocument = true;
                        caption = '📄 Imagem enviada como documento (qualidade original preservada)';
                    } else {
                        // Envia em HD (qualidade máxima do WhatsApp, não comprimido)
                        console.log("📸 Enviando imagem em HD (qualidade máxima)...");
                        sendOptions.sendMediaAsSticker = false; // Garante que não é sticker
                        caption = '🖼️ Imagem gerada!\n\n💡 _Quer receber como documento para preservar 100% da qualidade? Peça: "envie como documento"_';
                    }

                    sendOptions.caption = caption;

                    await client.sendMessage(chatId, mediaGerada, sendOptions);
                    adicionarAoHistorico(chatId, 'model', [{ text: '[Imagem Gerada com Sucesso]' }]);

                    // Salva no cache para possível reenvio como documento
                    if (!resultadoGeracao.sendAsDocument) {
                        ultimaImagemCache[chatId] = {
                            imagePath: resultadoGeracao.imagePath,
                            timestamp: Date.now()
                        };

                        // Remove do cache após 5 minutos
                        setTimeout(() => {
                            if (ultimaImagemCache[chatId]?.imagePath === resultadoGeracao.imagePath) {
                                try {
                                    if (fs.existsSync(resultadoGeracao.imagePath)) {
                                        fs.unlinkSync(resultadoGeracao.imagePath);
                                        console.log(`🗑️ Arquivo de imagem em cache removido: ${resultadoGeracao.imagePath}`);
                                    }
                                } catch (err) {
                                    console.error(`⚠️ Erro ao remover cache: ${err.message}`);
                                }
                                delete ultimaImagemCache[chatId];
                            }
                        }, 5 * 60 * 1000); // 5 minutos
                    } else {
                        // Se enviou como documento, remove imediatamente
                        try {
                            fs.unlinkSync(resultadoGeracao.imagePath);
                            console.log(`🗑️ Arquivo de imagem temporário removido: ${resultadoGeracao.imagePath}`);
                        } catch (unlinkErr) {
                            console.error(`⚠️ Falha ao remover arquivo de imagem temporário: ${resultadoGeracao.imagePath}`, unlinkErr);
                        }
                    }
                } else {
                    // Caso inesperado ou erro não tratado
                    console.error('\n❌ Falha inesperada na geração da imagem. Resultado:', resultadoGeracao);
                    await client.sendMessage(chatId, resultadoGeracao?.text || '❌ Falha desconhecida ao gerar imagem. Verifique os logs.');
                    adicionarAoHistorico(chatId, 'model', [{ text: `[Falha na Geração da Imagem: ${resultadoGeracao?.text || 'Erro desconhecido'}]` }]);
                }
            } else {
                // Se não for /imagem, continua processando normalmente
                console.log('\n🤖 Processando resposta IA (Texto/Calendário):', respostaIA);

                // Adiciona resposta da IA ao histórico (se não for /imagem)
                adicionarAoHistorico(chatId, 'model', partsResposta);

                // Verifica se a resposta é um comando para o calendário (usando a nova lista)
                const comandosCalendario = ['/add', '/list', '/remove', '/evento', '/today', '/tomorrow', '/week', '/nextweek', '/month', '/nextmonth', '/date', '/delete', '/next'];
                const ehComandoCalendario = comandosCalendario.some(cmd => respostaIA.startsWith(cmd));


                if (respostaIA.toLowerCase().startsWith('/gasto') ||
                    respostaIA.toLowerCase().startsWith('/receita') ||
                    respostaIA.toLowerCase().startsWith('/financas') ||
                    respostaIA.toLowerCase().startsWith('/transacoes') ||
                    respostaIA.toLowerCase().startsWith('/orcamento') ||
                    respostaIA.toLowerCase().startsWith('/comparativo')) {
                    console.log('\n💰 Processando comando financeiro gerado pela IA:', respostaIA);

                    try {
                        const primeiraLinha = respostaIA.split('\n')[0].trim();
                        const partes = primeiraLinha.split(' ');
                        const comando = partes[0].toLowerCase();
                        let respostaFinal = null;

                        if (comando === '/gasto') {
                            // /gasto VALOR CATEGORIA DESCRIÇÃO
                            const valor = parseFloat(partes[1]);
                            const categoria = partes[2] || 'Outros';
                            const descricao = partes.slice(3).join(' ') || '';

                            const resultado = registrarDespesa(chatId, valor, categoria, descricao);

                            if (!resultado.erro) {
                                const necessidadeInfo = resultado.necessidade
                                    ? `${resultado.necessidade.emoji} ${resultado.necessidade.label} (score: ${resultado.necessidade.score}/100)`
                                    : '';
                                const evitavelInfo = resultado.gastoEvitavel > 0
                                    ? `Gastos evitáveis no mês: R$${resultado.gastoEvitavel.toFixed(2)}`
                                    : '';

                                const partsGroq = [{
                                    text: `Formatar resposta para usuário que registrou gasto de R$${valor} em ${categoria}. ${necessidadeInfo}. Total gasto no mês: R$${resultado.totalGastoMes}. Saldo: R$${resultado.saldoMes}. ${evitavelInfo}. ${resultado.orcamento ? `Orçamento: R$${resultado.orcamento.budget}, usado: ${resultado.orcamento.percentage}%` : ''}. Responda de forma objetiva em português. Máximo 3 linhas.`
                                }];
                                respostaFinal = await processarComGroq(partsGroq);
                            } else {
                                respostaFinal = resultado.mensagem;
                            }
                        }
                        else if (comando === '/receita') {
                            // /receita VALOR CATEGORIA DESCRIÇÃO
                            const valor = parseFloat(partes[1]);
                            const categoria = partes[2] || 'Receita';
                            const descricao = partes.slice(3).join(' ') || '';

                            const resultado = registrarReceita(chatId, valor, categoria, descricao);

                            if (!resultado.erro) {
                                const partsGroq = [{
                                    text: `Formatar resposta para usuário que registrou receita de R$${valor}. Total de receitas no mês: R$${resultado.totalReceitaMes}. Saldo: R$${resultado.saldoMes}. Responda de forma positiva em português. Máximo 2 linhas.`
                                }];
                                respostaFinal = await processarComGroq(partsGroq);
                            } else {
                                respostaFinal = resultado.mensagem;
                            }
                        }
                        else if (comando === '/financas') {
                            // Resumo financeiro
                            const resumo = obterResumoFinanceiro(chatId);

                            if (!resumo.erro) {
                                const analiseNecessidade = resumo.analiseNecessidade ?
                                    `Análise de necessidade dos gastos: 🔴 Essencial ${resumo.analiseNecessidade.essential.percentage}%, 🟠 Importante ${resumo.analiseNecessidade.important.percentage}%, 🟡 Moderado ${resumo.analiseNecessidade.moderate.percentage}%, 🟢 Dispensável ${resumo.analiseNecessidade.dispensable.percentage}%, 🔵 Supérfluo ${resumo.analiseNecessidade.superfluous.percentage}%. Gastos evitáveis (dispensável + supérfluo): R$${resumo.gastoEvitavel} (${resumo.percentualEvitavel}% do total).`
                                    : '';

                                const partsGroq = [{
                                    text: `Formatar resumo financeiro mensal de forma clara. Receitas: R$${resumo.receitas}, Despesas: R$${resumo.despesas}, Saldo: R$${resumo.saldo} (${resumo.status}). Top categorias: ${resumo.topCategorias.map(c => `${c.category} R$${c.amount}`).join(', ')}. Média diária: R$${resumo.mediaDiaria}. ${resumo.orcamento ? `Orçamento: ${resumo.orcamento.percentage}% usado` : ''}. ${analiseNecessidade} Responda em português com formatação clara e emojis. Máximo 8 linhas, destaque os gastos evitáveis.`
                                }];
                                respostaFinal = await processarComGroq(partsGroq);
                            } else {
                                respostaFinal = resumo.mensagem;
                            }
                        }
                        else if (comando === '/transacoes') {
                            // Últimas transações
                            const transacoes = obterUltimasTransacoes(chatId, 5);

                            if (!transacoes.erro && transacoes.quantidade > 0) {
                                const lista = transacoes.transacoes.map((t, i) =>
                                    `${i + 1}. ${t.tipo}: R$${t.valor} - ${t.categoria} (${t.data})`
                                ).join('\n');

                                respostaFinal = `📝 *Últimas ${transacoes.quantidade} transações:*\n\n${lista}`;
                            } else {
                                respostaFinal = '📝 Nenhuma transação registrada ainda.';
                            }
                        }
                        else if (comando === '/orcamento') {
                            // Definir orçamento
                            const valor = parseFloat(partes[1]);
                            const resultado = definirOrcamento(chatId, valor);

                            if (!resultado.erro) {
                                respostaFinal = `💰 Orçamento mensal definido em R$${valor}! Vou te avisar quando atingir 80% do limite.`;
                            } else {
                                respostaFinal = resultado.mensagem;
                            }
                        }
                        else if (comando === '/comparativo') {
                            // Comparação com mês anterior
                            const comparacao = obterComparacao(chatId);

                            if (!comparacao.erro) {
                                const emoji = comparacao.tendencia === 'Aumento' ? '📈' : comparacao.tendencia === 'Redução' ? '📉' : '➡️';
                                respostaFinal = `${emoji} *Comparativo Mensal*\n\n` +
                                    `Mês atual: R$${comparacao.mesAtual}\n` +
                                    `Mês anterior: R$${comparacao.mesAnterior}\n` +
                                    `Diferença: R$${comparacao.diferenca} (${comparacao.variacao > 0 ? '+' : ''}${comparacao.variacao}%)\n` +
                                    `Tendência: ${comparacao.tendencia}`;
                            } else {
                                respostaFinal = comparacao.mensagem;
                            }
                        }

                        if (respostaFinal) {
                            await client.sendMessage(chatId, respostaFinal);
                            adicionarAoHistorico(chatId, 'model', [{ text: respostaFinal }]);
                        }
                    } catch (error) {
                        console.error('❌ Erro ao processar comando financeiro:', error.message);
                        await client.sendMessage(chatId, '❌ Erro ao processar comando financeiro.');
                    }
                }
                // --- SETUP COMMAND ---
                else if (respostaIA.toLowerCase().trim() === '/setup pascom' || lowerCaseBody === '/setup pascom') {
                    if (isGroup) {
                        setPascomGroupId(chatId);
                        await client.sendMessage(chatId, '✅ Este grupo foi configurado como o grupo oficial da **PASCOM**! Notificações do calendário serão enviadas aqui.');
                    } else {
                        await client.sendMessage(chatId, '❌ Este comando deve ser usado dentro de um grupo.');
                    }
                    return;
                }
                else if (ehComandoCalendario) {
                    const respostaCalendario = await processarComandoCalendario(client, respostaIA, chatId); // Passa a string diretamente
                    if (respostaCalendario) {
                        await client.sendMessage(chatId, respostaCalendario);
                        // Adiciona a resposta formatada do calendário ao histórico também
                        adicionarAoHistorico(chatId, 'model', [{ text: respostaCalendario }]);
                    } else if (respostaIA.startsWith('/evento')) {
                        const analiseOriginal = respostaIA.split('/evento')[0].trim();
                        if (analiseOriginal) {
                            await client.sendMessage(chatId, filtrarPensamentos(analiseOriginal));
                        } else {
                            console.log("Comando /evento recebido, mas não gerou ação de calendário nem tinha texto prévio.");
                        }
                    }
                } else {
                    await client.sendMessage(chatId, respostaIA);
                }
            }
            // Se não houve resposta válida, envia uma mensagem de erro única
            if (!respostaIA || respostaIA.startsWith('❌')) {
                const mensagemErro = respostaIA || '❌ Desculpe, não consegui processar sua solicitação.';
                await client.sendMessage(chatId, mensagemErro);
                adicionarAoHistorico(chatId, 'model', [{ text: mensagemErro }]);
            }
        }
    } catch (error) {
        console.error('\n❌ Erro ao processar mensagem:', error);
        await client.sendMessage(chatId, '❌ Ocorreu um erro interno ao processar sua mensagem.');
        // Adiciona erro ao histórico
        adicionarAoHistorico(chatId, 'model', [{ text: `❌ Erro interno no processamento: ${error.message}` }]); // Adiciona mais detalhes do erro
    }
}

async function processarComandoCalendario(client, comandoCompleto, chatId) {
    try {
        console.log('\n🔍 Processando comando Groq para calendário:', comandoCompleto);
        console.log('📱 ChatId recebido:', chatId);
        const auth = await getGoogleAuth();
        let mensagemResposta = '';
        let comandoExecutado = false; // Flag para saber se algum comando foi realmente executado

        // Extrai o comando principal (ex: /list, /today)
        const comando = comandoCompleto.split(' ')[0];
        // Extrai os argumentos (se houver)
        const args = comandoCompleto.split(' ').slice(1);

        // --- Tratamento dos Comandos ---
        switch (comando) {
            case '/evento':
                // ... (lógica existente para /evento e /add subsequente) ...
                const partesEvento = comandoCompleto.split('\n');
                // Procura por um /add dentro da resposta /evento
                const comandoAddEmEvento = partesEvento.find(p => p.startsWith('/add'));
                if (comandoAddEmEvento) {
                    console.log('\n📅 Processando evento extraído de imagem/texto...');
                    try {
                        const eventoInfo = comandoAddEmEvento.substring(5).trim(); // Remove '/add '

                        // Lógica de Roteamento de Calendário por Contexto
                        // Se for grupo (@g.us), usa Pascom. Se for privado, usa Pessoal.
                        const isGroup = chatId.endsWith('@g.us');
                        const targetCalendar = isGroup ? PASCOM_CALENDAR_ID : null;

                        const evento = await adicionarEvento(auth, eventoInfo, targetCalendar);
                        comandoExecutado = true;

                        const inicio = new Date(evento.start.dateTime || evento.start.date);
                        const fim = new Date(evento.end.dateTime || evento.end.date);

                        const emojiTipo = isGroup ? '⛪' : '✨';
                        const nomeCalendario = isGroup ? 'PASCOM' : 'Pessoal';

                        mensagemResposta = `> *Evento Adicionado com Sucesso (${nomeCalendario})* ${emojiTipo}\n\n` +
                            `📝 *${evento.summary}*\n` +
                            `📅 Início: ${inicio.toLocaleString('pt-BR')}\n` +
                            `🔚 Fim: ${fim.toLocaleString('pt-BR')}\n` +
                            (evento.description ? `📋 ${evento.description}\n` : '') +
                            (evento.location ? `📍 ${evento.location}\n` : '');
                    } catch (error) {
                        console.error('\n❌ Erro ao adicionar evento extraído:', error);
                        mensagemResposta = `❌ Erro ao adicionar o evento extraído: ${error.message || 'Verifique o formato.'}`;
                    }
                } else {
                    console.log('\n⚠️ Comando /evento sem /add subsequente.');
                    // Retorna null para que a análise da imagem/texto original seja enviada
                    return null;
                }
                break; // Sai do switch para /evento

            case '/add':
                // Lógica de Roteamento de Calendário por Contexto
                const isGroup = chatId.endsWith('@g.us');
                const targetCalendar = isGroup ? PASCOM_CALENDAR_ID : null;
                const emojiTipo = isGroup ? '⛪' : '✨';
                const nomeCalendario = isGroup ? 'PASCOM' : ''; // Sem nome para pessoal para manter limpo

                // Trata múltiplos /add se estiverem na mesma linha (improvável, mas seguro) ou múltiplas linhas
                const comandosAdd = comandoCompleto.split('\n').filter(cmd => cmd.trim().startsWith('/add'));
                if (comandosAdd.length > 1) {
                    console.log('\n📅 Processando múltiplos eventos...');
                    let eventosAdicionados = [];
                    let erros = [];
                    for (const cmdAdd of comandosAdd) {
                        try {
                            const eventoInfo = cmdAdd.trim().substring(5); // Remove '/add '
                            const evento = await adicionarEvento(auth, eventoInfo, targetCalendar);
                            eventosAdicionados.push(evento);
                            comandoExecutado = true;
                        } catch (error) {
                            console.error('\n❌ Erro ao adicionar evento múltiplo:', error);
                            erros.push(cmdAdd); // Guarda o comando que falhou
                        }
                    }
                    // ... (lógica de formatação da resposta para múltiplos eventos) ...
                    if (eventosAdicionados.length > 0) {
                        mensagemResposta = `> *${eventosAdicionados.length} Evento(s) Adicionado(s) com Sucesso ${nomeCalendario}* ${emojiTipo}\n\n`;
                        eventosAdicionados.forEach((evento) => {
                            const inicio = new Date(evento.start.dateTime || evento.start.date);
                            const fim = new Date(evento.end.dateTime || evento.end.date);
                            mensagemResposta += `📝 *${evento.summary}*\n`;
                            mensagemResposta += `📅 Início: ${inicio.toLocaleString('pt-BR')}\n`;
                            mensagemResposta += `🔚 Fim: ${fim.toLocaleString('pt-BR')}\n`;
                            if (evento.description) mensagemResposta += `📋 ${evento.description}\n`;
                            if (evento.location) mensagemResposta += `📍 ${evento.location}\n`;
                            mensagemResposta += '\n';
                        });
                    }
                    if (erros.length > 0) {
                        mensagemResposta += `\n❌ Falha ao adicionar ${erros.length} evento(s). Verifique os dados e tente novamente.`;
                    }
                    if (eventosAdicionados.length === 0 && erros.length > 0) {
                        mensagemResposta = `❌ Falha ao adicionar evento(s). Verifique os dados e tente novamente.`;
                    }

                } else { // Apenas um /add
                    console.log('\n📅 Processando evento único...');
                    try {
                        const eventoInfo = comandoCompleto.substring(5).trim(); // Remove '/add '
                        const evento = await adicionarEvento(auth, eventoInfo, targetCalendar);
                        comandoExecutado = true;
                        // ... (lógica de formatação da resposta para evento único) ...
                        const inicio = new Date(evento.start.dateTime || evento.start.date);
                        const fim = new Date(evento.end.dateTime || evento.end.date);
                        mensagemResposta = `> *Evento Adicionado com Sucesso ${nomeCalendario}* ${emojiTipo}\n\n` +
                            `📝 *${evento.summary}*\n` +
                            `📅 Início: ${inicio.toLocaleString('pt-BR')}\n` +
                            `🔚 Fim: ${fim.toLocaleString('pt-BR')}\n` +
                            (evento.description ? `📋 ${evento.description}\n` : '') +
                            (evento.location ? `📍 ${evento.location}\n` : '');

                    } catch (error) {
                        console.error('\n❌ Erro ao adicionar evento único:', error);
                        mensagemResposta = `❌ Erro ao adicionar evento: ${error.message || 'Verifique o formato.'}`;
                    }
                }
                break; // Sai do switch para /add

            case '/add_pascom':
                console.log('\n📅 Processando evento PASCOM...');
                try {
                    const eventoInfo = comandoCompleto.substring(12).trim(); // Remove '/add_pascom '
                    // Passa o ID do calendário da Pascom
                    const evento = await adicionarEvento(auth, eventoInfo, PASCOM_CALENDAR_ID);
                    comandoExecutado = true;

                    const inicio = new Date(evento.start.dateTime || evento.start.date);
                    const fim = new Date(evento.end.dateTime || evento.end.date);
                    mensagemResposta = `> *Evento PASCOM Adicionado* ⛪✨\n\n` +
                        `📝 *${evento.summary}*\n` +
                        `📅 Início: ${inicio.toLocaleString('pt-BR')}\n` +
                        `🔚 Fim: ${fim.toLocaleString('pt-BR')}\n` +
                        (evento.description ? `📋 ${evento.description}\n` : '') +
                        (evento.location ? `📍 ${evento.location}\n` : '');

                } catch (error) {
                    console.error('\n❌ Erro ao adicionar evento Pascom:', error);
                    mensagemResposta = `❌ Erro ao adicionar evento na Pascom: ${error.message}`;
                }
                break;

            case '/list': // Mantém lógica anterior para /list com args
            case '/today':
            case '/tomorrow':
            case '/week':
            case '/nextweek':
            case '/month':
            case '/nextmonth':
            case '/date':
            case '/next': // Adiciona /next aqui também
                comandoExecutado = true;
                let eventos = [];
                let titulo = "Eventos";
                // Determina o período baseado no comando ou argumento do /list
                let periodo;
                if (comando === '/list') {
                    periodo = args.join(' ').toLowerCase() || 'today'; // Junta args para casos como "proxima semana" e default para 'today'
                } else {
                    periodo = comando.substring(1); // Remove a barra para /today, /tomorrow etc.
                }


                // Lógica para determinar o período baseado no comando ou argumento
                if (periodo === 'hoje' || periodo === 'today') {
                    eventos = await listarEventos(auth); // Função para hoje
                    titulo = "Eventos para Hoje";
                } else if (periodo === 'amanha' || periodo === 'tomorrow') {
                    eventos = await listarEventosAmanha(auth);
                    titulo = "Eventos para Amanhã";
                } else if (periodo === 'semana' || periodo === 'week') {
                    eventos = await listarEventosSemana(auth);
                    titulo = "Eventos da Semana";
                } else if (periodo === 'proxima semana' || periodo === 'nextweek') {
                    eventos = await listarEventosProximaSemana(auth);
                    titulo = "Eventos da Próxima Semana";
                } else if (periodo === 'mes' || periodo === 'month') {
                    eventos = await listarEventosMes(auth);
                    titulo = "Eventos do Mês";
                } else if (periodo === 'proximo mes' || periodo === 'nextmonth') {
                    eventos = await listarEventosProximoMes(auth);
                    titulo = "Eventos do Próximo Mês";
                } else if (comando === '/date') { // Comando específico /date
                    const dataArg = args[0]; // Espera AAAA-MM-DD
                    if (dataArg && /^\d{4}-\d{2}-\d{2}$/.test(dataArg)) {
                        eventos = await listarEventosData(auth, dataArg);
                        // Formata data para o título
                        try {
                            const dataObj = new Date(dataArg + 'T00:00:00-03:00'); // Adiciona fuso para conversão
                            titulo = `Eventos para ${dataObj.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
                        } catch (e) {
                            titulo = `Eventos para ${dataArg}`; // Fallback
                        }
                    } else {
                        mensagemResposta = '❌ Formato de data inválido para /date. Use AAAA-MM-DD.';
                    }
                } else if (periodo === 'proximos' || periodo === 'next') {
                    // const count = args[0] ? parseInt(args[0]) : 10; // Pega a contagem se houver (opcional)
                    eventos = await listarProximosEventos(auth); // Usa a função padrão que lista 10
                    titulo = `Próximos ${eventos.length} Eventos`;
                } else if (comando === '/list' && args.length > 0) { // Tratamento de /list com args não mapeados
                    console.warn("Comando /list com argumento não padrão:", args);
                    eventos = await listarEventos(auth);
                    titulo = "Eventos para Hoje (Argumento /list não reconhecido)";
                } else { // Fallback para /list sem args ou comando não reconhecido aqui
                    eventos = await listarEventos(auth); // Lista eventos de hoje por padrão
                    titulo = "Eventos para Hoje";
                }

                // Formata a resposta se não houve erro de data
                if (mensagemResposta === '') {
                    mensagemResposta = formatarEventos(eventos, titulo);
                }
                break; // Sai do switch para comandos de listagem

            case '/remove':
                comandoExecutado = true;
                const eventId = args[0];
                if (eventId) {
                    try {
                        await removerEvento(auth, eventId);
                        mensagemResposta = '✅ Evento removido com sucesso!';
                    } catch (error) {
                        console.error('\n❌ Erro ao remover evento:', error);
                        mensagemResposta = '❌ Erro ao remover evento.';
                    }
                } else {
                    mensagemResposta = '❌ ID do evento não fornecido para remoção via /remove.';
                }
                break; // Sai do switch para /remove

            case '/delete':
                // TODO: Implementar a lógica de conversação para exclusão de eventos.
                comandoExecutado = true;
                console.log('\n🗑️ Recebido comando /delete, iniciando fluxo de remoção...');
                // A lógica original de /delete iniciava uma conversa.
                // Como o LLM retorna apenas /delete, precisamos decidir como lidar com isso.
                // Opção 1: Listar eventos de hoje para o usuário escolher.
                const eventosHoje = await listarEventos(auth); // Lista eventos de hoje
                if (eventosHoje && eventosHoje.length > 0) {
                    let listaParaRemover = "Qual evento você gostaria de remover? Responda com o número:\n\n";
                    eventosHoje.forEach((evento, index) => {
                        const inicio = new Date(evento.start.dateTime || evento.start.date);
                        listaParaRemover += `${index + 1}. *${evento.summary}* (${inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})\n`;
                    });
                    mensagemResposta = listaParaRemover;

                    // Define o estado da conversa para aguardar a seleção do usuário
                    if (!chatId) {
                        console.error('❌ ChatId não definido no comando /delete');
                        mensagemResposta = "❌ Erro interno: ChatId não encontrado.";
                    } else {
                        conversationState[chatId] = {
                            action: 'awaiting_delete_selection',
                            events: eventosHoje
                        };
                        console.log(`📝 Estado definido para ${chatId}: aguardando seleção para remoção.`);
                    }

                } else {
                    mensagemResposta = "📅 Não há eventos hoje para remover.";
                }
                break; // Sai do switch para /delete


            default:
                console.warn(`Comando de calendário não reconhecido dentro de processarComandoCalendario: ${comando}`);
                // Retorna null para que a mensagem original (o comando não tratado) seja potencialmente enviada.
                return null;
        }
        // --- Fim Tratamento ---

        // Retorna a mensagem formatada OU null se nenhum comando válido foi executado
        return comandoExecutado ? mensagemResposta : null;

    } catch (error) {
        console.error('\n❌ Erro geral ao processar comando do calendário:', error);
        return '❌ Ocorreu um erro ao processar o comando do calendário.';
    }
}

module.exports = { handleMessage, processarAudioRecebido, processarMensagemTexto };
