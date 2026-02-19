/**
 * Media Handler — processa imagens e áudios recebidos
 * Extraído de message-handler.js para melhor organização
 */

const { adicionarAoHistorico } = require('../../chat-history');
const { analisarConteudoMultimodal } = require('../../api/gemini');

/**
 * Processa uma mensagem com mídia (imagem, áudio ou outro)
 * Retorna as partsEntrada preparadas, ou null se houve erro (e já respondeu)
 */
async function handleMediaMessage(client, msg, chatId, processarMensagemTexto) {
    if (msg.type === 'image') {
        console.log('\n📸 Imagem recebida...');
        try {
            const media = await msg.downloadMedia();
            if (!media || !media.data) {
                await client.sendMessage(chatId, '❌ Erro ao baixar imagem.');
                return null;
            }

            const legenda = msg.body || '';
            console.log(`🖼️ Imagem ${media.mimetype} recebida.` + (legenda ? ` Com legenda: "${legenda}"` : ' Sem legenda.'));

            const partsEntrada = [];
            if (legenda) {
                partsEntrada.push({ text: legenda });
            } else {
                partsEntrada.push({ text: "Analise esta imagem em detalhes." });
            }
            partsEntrada.push({ inlineData: { data: media.data, mimeType: media.mimetype } });

            adicionarAoHistorico(chatId, 'user', partsEntrada);
            await processarMensagemTexto(client, partsEntrada, chatId, true);

        } catch (error) {
            console.error('\n❌ Erro ao processar imagem:', error);
            adicionarAoHistorico(chatId, 'user', [{ text: "[Erro ao processar imagem enviada]" }]);
            await client.sendMessage(chatId, '❌ Erro inesperado ao processar imagem.');
        }
        return 'handled';
    }
    else if (msg.type === 'audio' || msg.type === 'ptt') {
        console.log('\n🎤 Áudio recebido - processando com sistema híbrido...');
        try {
            const media = await msg.downloadMedia();
            if (!media || !media.data) {
                await client.sendMessage(chatId, '❌ Erro ao baixar áudio.');
                return null;
            }

            console.log(`🎵 Áudio ${media.mimetype} recebido`);

            const partsEntrada = [
                { text: "Transcreva este áudio em português do Brasil." },
                { inlineData: { data: media.data, mimeType: media.mimetype } }
            ];

            adicionarAoHistorico(chatId, 'user', partsEntrada);
            await processarMensagemTexto(client, partsEntrada, chatId, true);

        } catch (error) {
            console.error('\n❌ Erro ao processar áudio:', error);
            adicionarAoHistorico(chatId, 'user', [{ text: "[Erro ao processar áudio enviado]" }]);
            await client.sendMessage(chatId, '❌ Erro inesperado ao processar áudio.');
        }
        return 'handled';
    }
    else {
        console.log(`\n⚠️ Mídia do tipo ${msg.type} recebida, mas não processada.`);
        adicionarAoHistorico(chatId, 'user', [{ text: `[Mídia não suportada recebida: ${msg.type}]` }]);
        return 'handled';
    }
}

module.exports = {
    handleMediaMessage
};
