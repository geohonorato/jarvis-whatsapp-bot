/**
 * YouTube Handler — gerencia resumo de vídeos do YouTube
 * Extraído de message-handler.js para melhor organização
 */

const { resumirVideoYoutube } = require('../../api/youtube');
const { adicionarAoHistorico } = require('../../chat/chat-history');

/**
 * Processa comando /resumir
 * Retorna true se o comando foi processado, false se URL é inválida
 */
async function handleYoutubeCommand(client, chatId, textoUsuario, partsEntrada) {
    const urlVideo = textoUsuario.substring(9).trim();

    if (urlVideo.includes('youtube.com/') || urlVideo.includes('youtu.be/')) {
        console.log(`\n▶️ Comando /resumir detectado para URL: ${urlVideo}`);
        await client.sendMessage(chatId, `⏳ Entendido! Buscando a transcrição e resumindo o vídeo:\n${urlVideo}\n\nIsso pode levar um momento...`);

        adicionarAoHistorico(chatId, 'user', partsEntrada);

        const resumo = await resumirVideoYoutube(urlVideo);

        await client.sendMessage(chatId, resumo);
        adicionarAoHistorico(chatId, 'model', [{ text: resumo }]);
        return true;
    } else {
        await client.sendMessage(chatId, '❌ URL do YouTube inválida. Use o formato: /resumir https://www.youtube.com/watch?v=...');
        adicionarAoHistorico(chatId, 'user', partsEntrada);
        adicionarAoHistorico(chatId, 'model', [{ text: '❌ URL inválida fornecida.' }]);
        return true; // Still handled (sent error)
    }
}

module.exports = {
    handleYoutubeCommand
};
