/**
 * Image Handler — gerencia geração e envio de imagens
 * Extraído de message-handler.js para melhor organização
 */

const { processarComandoImagem } = require('../../api/image-generator');
const { adicionarAoHistorico } = require('../../chat-history');
const { MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { otimizarImagemParaWhatsApp } = require('../../../utils/image-processor'); // Importa otimizador

// Cache temporário para última imagem gerada (por chat)
const ultimaImagemCache = {};

/**
 * Verifica se o texto é um pedido de reenvio como documento
 */
function isDocumentResendRequest(textoUsuario) {
    if (!textoUsuario) return false;
    return /(?:envie|mande|envia|manda|enviar|mandar)\s+(?:a\s+imagem\s+)?(?:como|em)\s+documento/i.test(textoUsuario.trim());
}

/**
 * Verifica se há uma imagem em cache para reenviar
 */
function hasCachedImage(chatId) {
    return !!ultimaImagemCache[chatId];
}

/**
 * Baixa imagem novamente caso necessário
 */
async function downloadImage(url, destPath) {
    console.log(`📥 Re-baixando imagem para envio como documento: ${url}`);
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000
    });
    fs.writeFileSync(destPath, Buffer.from(response.data));
    console.log(`✅ Imagem re-baixada: ${destPath}`);
    return destPath;
}

/**
 * Processa pedido de reenvio como documento
 */
async function handleDocumentResend(client, chatId, partsEntrada) {
    console.log('\n📄 Detectado pedido de reenvio como documento...');

    const ultimaImagem = ultimaImagemCache[chatId];
    if (!ultimaImagem) {
        await client.sendMessage(chatId, '❌ Nenhuma imagem recente encontrada para reenviar.');
        return true;
    }

    let imagePath = ultimaImagem.imagePath;

    // Se o arquivo não existe mais, mas temos a URL, tentamos baixar novamente
    if (!fs.existsSync(imagePath)) {
        if (ultimaImagem.imageUrl) {
            console.log('⚠️ Arquivo local não encontrado, mas URL disponível. Tentando re-download...');
            try {
                // Recria diretório se necessário
                const tempDir = path.dirname(imagePath);
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

                await downloadImage(ultimaImagem.imageUrl, imagePath);
            } catch (err) {
                console.error('❌ Falha ao re-baixar imagem:', err);
                await client.sendMessage(chatId, '❌ Desculpe, a imagem expirou e não foi possível recuperá-la. Por favor, gere novamente.');
                return true;
            }
        } else {
            await client.sendMessage(chatId, '❌ Desculpe, a última imagem já foi removida e não pode ser recuperada.');
            return true;
        }
    }

    // Envia como documento
    try {
        const mediaGerada = MessageMedia.fromFilePath(imagePath);

        console.log("📄 Reenviando última imagem como documento...");
        await client.sendMessage(chatId, mediaGerada, {
            sendMediaAsDocument: true,
            caption: '📄 Imagem enviada como documento (qualidade original preservada)'
        });

        adicionarAoHistorico(chatId, 'user', partsEntrada);
        adicionarAoHistorico(chatId, 'model', [{ text: '[Imagem Reenviada como documento]' }]);
    } catch (err) {
        console.error('❌ Erro ao reenviar como documento:', err);
        await client.sendMessage(chatId, '❌ Erro ao enviar documento.');
    }

    return true;
}

/**
 * Processa comando /imagem gerado pela IA
 */
async function handleImageCommand(client, chatId, respostaIA, partsResposta) {
    console.log('\n🎨 Detectado comando /imagem, iniciando geração (Pollinations.AI)...');

    // Envia mensagem de feedback imediato
    await client.sendMessage(chatId, '🎨 Aguarde, gerando sua imagem...');

    // Adiciona o comando /imagem original ao histórico do modelo
    adicionarAoHistorico(chatId, 'model', partsResposta);

    // Processa o comando de imagem usando o serviço de imagens
    const resultadoGeracao = await processarComandoImagem(respostaIA);

    if (resultadoGeracao && resultadoGeracao.imageUrl && !resultadoGeracao.imagePath) {
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
        }

        // Adiciona prompt ao histórico (se houver, etc.)
        if (resultadoGeracao.text) {
            adicionarAoHistorico(chatId, 'model', [{ text: resultadoGeracao.text }]);
        }

        // Tenta otimizar a imagem se for muito pesada (>16MB) para o WhatsApp
        // Guarda o caminho original SEMPRE (para reenvio como documento com qualidade máxima)
        const originalPath = resultadoGeracao.imagePath;
        let sendPath = originalPath; // Caminho usado para envio (pode ser otimizado)

        try {
            const optimizedPath = await otimizarImagemParaWhatsApp(originalPath);

            if (optimizedPath !== originalPath) {
                // Otimizou: usa o otimizado para envio no chat, mas MANTÉM o original para documento
                console.log(`♻️ Usando versão otimizada para envio: ${optimizedPath}`);
                console.log(`📦 Original preservado para documento: ${originalPath}`);
                sendPath = optimizedPath;
            }
        } catch (errOpt) {
            console.error('⚠️ Falha na otimização de imagem, prosseguindo com original:', errOpt);
        }

        // Envia a imagem gerada (usando versão otimizada se disponível)
        const mediaGerada = MessageMedia.fromFilePath(sendPath);

        // Define opções de envio
        const sendOptions = {};
        let caption = '';

        if (resultadoGeracao.sendAsDocument) {
            console.log("📄 Enviando imagem como documento...");
            sendOptions.sendMediaAsDocument = true;
            caption = '📄 Imagem enviada como documento (qualidade original preservada)';
        } else {
            console.log("📸 Enviando imagem em HD (qualidade máxima)...");
            sendOptions.sendMediaAsSticker = false;
            sendOptions.sendMediaAsHd = true;
            caption = '🖼️ Imagem gerada!\n\n💡 _Quer receber como documento para preservar 100% da qualidade? Peça: "envie como documento"_';
        }

        sendOptions.caption = caption;

        try {
            await client.sendMessage(chatId, mediaGerada, sendOptions);
        } catch (err) {
            console.error(`❌ Erro no envio da imagem (Tentativa 1 - HD): ${err.message}`);

            // Tentativa 2: Sem HD
            if (sendOptions.sendMediaAsHd) {
                console.log("⚠️ Tentando reenvio sem flag HD...");
                delete sendOptions.sendMediaAsHd;
                try {
                    await client.sendMessage(chatId, mediaGerada, sendOptions);
                    console.log("✅ Reenvio sem HD concluído com sucesso.");
                } catch (err2) {
                    console.error(`❌ Erro no envio sem HD (Tentativa 2): ${err2.message}`);

                    // Tentativa 3: Como Documento (Último recurso para garantir entrega)
                    console.log("⚠️ Tentando reenvio como DOCUMENTO...");
                    sendOptions.sendMediaAsDocument = true;
                    sendOptions.caption = '📄 Imagem enviada como documento (fallback de erro no envio de imagem)';
                    try {
                        await client.sendMessage(chatId, mediaGerada, sendOptions);
                        console.log("✅ Reenvio como Documento concluído com sucesso.");
                    } catch (err3) {
                        console.error(`❌ Falha total no envio da imagem: ${err3.message}`);
                        throw err3;
                    }
                }
            } else {
                throw err;
            }
        }
        adicionarAoHistorico(chatId, 'model', [{ text: '[Imagem Gerada com Sucesso]' }]);

        // Salva no cache para possível reenvio como documento
        if (!resultadoGeracao.sendAsDocument) {
            // Limpa imagens anteriores do cache (do mesmo chat) para não acumular lixo
            if (ultimaImagemCache[chatId]) {
                const oldCache = ultimaImagemCache[chatId];
                for (const p of [oldCache.imagePath, oldCache.optimizedPath]) {
                    try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); console.log(`🗑️ Cache antigo removido: ${p}`); } } catch (e) { }
                }
            }

            ultimaImagemCache[chatId] = {
                imagePath: originalPath,       // ORIGINAL gigante (para documento)
                optimizedPath: sendPath !== originalPath ? sendPath : null, // Otimizado (para limpeza)
                imageUrl: resultadoGeracao.imageUrl,
                timestamp: Date.now()
            };

            // Remove arquivos físicos após 10 minutos para economizar espaço
            const cachedOriginal = originalPath;
            const cachedOptimized = sendPath !== originalPath ? sendPath : null;
            setTimeout(() => {
                if (ultimaImagemCache[chatId]?.imagePath === cachedOriginal) {
                    // Deleta original E otimizado
                    for (const p of [cachedOriginal, cachedOptimized]) {
                        try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); console.log(`🗑️ Temp removido: ${p}`); } } catch (e) { }
                    }
                    // Mantém metadados no cache para re-download via URL
                }
            }, 10 * 60 * 1000);

            // Remove metadados do cache após 1 hora
            setTimeout(() => {
                if (ultimaImagemCache[chatId]?.imagePath === resultadoGeracao.imagePath) {
                    delete ultimaImagemCache[chatId];
                }
            }, 60 * 60 * 1000);
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
        console.error('\n❌ Falha inesperada na geração da imagem. Resultado:', resultadoGeracao);
        await client.sendMessage(chatId, resultadoGeracao?.text || '❌ Falha desconhecida ao gerar imagem. Verifique os logs.');
        adicionarAoHistorico(chatId, 'model', [{ text: `[Falha na Geração da Imagem: ${resultadoGeracao?.text || 'Erro desconhecido'}]` }]);
    }
}

module.exports = {
    isDocumentResendRequest,
    hasCachedImage,
    handleDocumentResend,
    handleImageCommand
};
