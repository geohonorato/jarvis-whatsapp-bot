/**
 * Meeting Handler — processa áudios e decide se é conversa casual ou reunião
 * 
 * Fluxo:
 * 1. Gemini transcreve o áudio
 * 2. Meeting Summary Service classifica (casual vs reunião)
 * 3. Se casual → fluxo normal (Groq processa a transcrição)
 * 4. Se reunião → gera resumo, salva no Notion, retorna link
 */

const { adicionarAoHistorico } = require('../../chat/chat-history');
const { analisarConteudoMultimodal } = require('../../api/gemini');
const { processAudioForMeeting } = require('../../chat/meeting-summary');

/**
 * Processa áudio com classificação inteligente
 * 
 * @param {object} client - Cliente WhatsApp
 * @param {object} msg - Mensagem original
 * @param {string} chatId - ID do chat
 * @param {Function} processarMensagemTexto - Função para processar texto (fluxo normal)
 * @returns {Promise<string>} 'handled' quando processado
 */
async function handleAudioWithClassification(client, msg, chatId, processarMensagemTexto) {
    console.log('\n🎤 [MeetingHandler] Áudio recebido - iniciando classificação inteligente...');

    // Detecta se o áudio é encaminhado
    const isForwarded = msg.isForwarded || msg._data?.isForwarded || false;
    if (isForwarded) {
        console.log('📨 [MeetingHandler] Áudio encaminhado detectado');
    }

    try {
        const media = await msg.downloadMedia();
        if (!media || !media.data) {
            await client.sendMessage(chatId, '❌ Erro ao baixar áudio.');
            return 'handled';
        }

        console.log(`🎵 [MeetingHandler] Áudio ${media.mimetype} recebido${isForwarded ? ' (encaminhado)' : ''}`);

        // Fase 1: Transcrição via Gemini
        await client.sendMessage(chatId, '🎤 _Transcrevendo áudio..._');

        const transcriptionParts = [
            { text: "Transcreva este áudio em português do Brasil com alta precisão. Use pontuação adequada. Retorne apenas a transcrição literal." },
            { inlineData: { data: media.data, mimeType: media.mimetype } }
        ];

        const transcription = await analisarConteudoMultimodal(transcriptionParts);

        if (!transcription || transcription.startsWith('❌')) {
            await client.sendMessage(chatId, transcription || '❌ Erro ao transcrever áudio.');
            return 'handled';
        }

        console.log(`📝 [MeetingHandler] Transcrição concluída (${transcription.length} chars, ~${transcription.split(/\s+/).length} palavras)`);

        // Áudio encaminhado → sempre transcreve (nunca trata como conversa casual)
        if (isForwarded) {
            console.log('📨 [MeetingHandler] Áudio encaminhado → forçando transcrição');

            // Ainda verifica se é reunião longa para gerar resumo
            const result = await processAudioForMeeting(transcription);

            if (result.type !== 'casual' && result.summary) {
                // Reunião encaminhada → resumo completo + Notion
                return await sendMeetingResult(client, chatId, result, transcription);
            }

            // Áudio encaminhado curto/casual → retorna transcrição direta
            let responseMsg = '📝 *Transcrição do áudio encaminhado:*\n\n';
            responseMsg += transcription;

            await client.sendMessage(chatId, responseMsg);
            adicionarAoHistorico(chatId, 'user', [{ text: `[Áudio encaminhado - transcrito]` }]);
            adicionarAoHistorico(chatId, 'model', [{ text: responseMsg }]);
            return 'handled';
        }

        // Fase 2: Classificação e roteamento (áudio próprio do usuário)
        const result = await processAudioForMeeting(transcription);

        if (result.type === 'casual') {
            // Áudio casual → fluxo normal (Groq processa a transcrição como conversa)
            console.log('💬 [MeetingHandler] Áudio classificado como casual → fluxo normal');

            const partsEntrada = [
                { text: "Transcreva este áudio em português do Brasil." },
                { inlineData: { data: media.data, mimeType: media.mimetype } }
            ];

            adicionarAoHistorico(chatId, 'user', partsEntrada);
            await processarMensagemTexto(client, partsEntrada, chatId, true);
            return 'handled';
        }

        // Áudio de reunião/aula/entrevista → resumo + Notion
        return await sendMeetingResult(client, chatId, result);

    } catch (error) {
        console.error('\n❌ [MeetingHandler] Erro ao processar áudio:', error);
        adicionarAoHistorico(chatId, 'user', [{ text: "[Erro ao processar áudio enviado]" }]);
        await client.sendMessage(chatId, '❌ Erro inesperado ao processar áudio.');
        return 'handled';
    }
}

/**
 * Monta e envia a mensagem de resultado de reunião (resumo + link Notion)
 */
async function sendMeetingResult(client, chatId, result) {
    console.log(`📋 [MeetingHandler] Áudio classificado como "${result.type}" → gerando resumo e salvando no Notion`);

    const typeLabels = {
        'meeting': '📋 Reunião',
        'lecture': '🎓 Aula/Palestra',
        'brainstorm': '💡 Brainstorm',
        'interview': '🎙️ Entrevista'
    };

    const typeLabel = typeLabels[result.type] || '📋 Resumo';

    if (result.error && !result.summary) {
        await client.sendMessage(chatId, `❌ Erro ao processar ${typeLabel.toLowerCase()}: ${result.error}`);
        adicionarAoHistorico(chatId, 'user', [{ text: `[Áudio de ${result.type} enviado]` }]);
        adicionarAoHistorico(chatId, 'model', [{ text: `❌ Erro: ${result.error}` }]);
        return 'handled';
    }

    let responseMsg = `${typeLabel} *identificada e resumida!*\n\n`;

    if (result.summary) {
        const summaryForWhatsapp = result.summary.length > 3000
            ? result.summary.substring(0, 3000) + '\n\n_(...resumo completo no Obsidian)_'
            : result.summary;
        responseMsg += summaryForWhatsapp;
    }

    if (result.obsidianPath) {
        responseMsg += `\n\n━━━━━━━━━━━━━━━━━━━━\n`;
        responseMsg += `📁 *Salvo no Obsidian Vault:*\n`;
        if (result.folder) {
            responseMsg += `📂 Pasta: [[${result.folder}]]\n`;
        }
        if (result.obsidianTitle) {
            responseMsg += `📄 Nota: [[${result.obsidianTitle}]]\n`;
        }
        responseMsg += `\n_A nota contém o resumo e a transcrição completa com Wikilinks._`;
    } else if (result.error) {
        responseMsg += `\n\n⚠️ _Não foi possível salvar no Obsidian: ${result.error}_`;
    }

    await client.sendMessage(chatId, responseMsg);
    adicionarAoHistorico(chatId, 'user', [{ text: `[Áudio de ${result.type} enviado - transcrito e resumido]` }]);
    adicionarAoHistorico(chatId, 'model', [{ text: responseMsg }]);
    return 'handled';
}

module.exports = {
    handleAudioWithClassification
};
