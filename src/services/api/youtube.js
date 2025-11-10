require("dotenv").config();
const { YoutubeTranscript } = require('youtube-transcript');
const { processarMensagemMultimodal } = require('./gemini');

/**
 * Busca a transcrição de um vídeo do YouTube e a resume usando o Gemini.
 * @param {string} videoUrl URL do vídeo do YouTube.
 * @returns {Promise<string>} O resumo do vídeo ou uma mensagem de erro.
 */
async function resumirVideoYoutube(videoUrl) {
    console.log(`\n▶️ Iniciando resumo do vídeo: ${videoUrl}`);
    try {
        // 1. Buscar Transcrição
        console.log("  🔄 Buscando transcrição...");
        const transcriptResponse = await YoutubeTranscript.fetchTranscript(videoUrl);

        if (!transcriptResponse || transcriptResponse.length === 0) {
            console.warn("  ⚠️ Transcrição não encontrada ou vazia.");
            return "❌ Não foi possível encontrar a transcrição para este vídeo. Verifique se o vídeo existe e possui legendas automáticas ou manuais.";
        }

        // Concatena os textos da transcrição
        const fullTranscript = transcriptResponse.map(item => item.text).join(' ');
        console.log(`  ✅ Transcrição obtida (${fullTranscript.length} caracteres).`);

        // Limita o tamanho da transcrição para evitar exceder limites do modelo (ajuste conforme necessário)
        const maxTranscriptLength = 20000; // Exemplo: Limite de 20k caracteres
        const truncatedTranscript = fullTranscript.length > maxTranscriptLength
            ? fullTranscript.substring(0, maxTranscriptLength) + "..." // Trunca se for muito longa
            : fullTranscript;

        if (fullTranscript.length > maxTranscriptLength) {
            console.warn(`  ⚠️ Transcrição truncada para ${maxTranscriptLength} caracteres.`);
        }

        // 2. Resumir com o serviço de LLM (Perplexity - stub por enquanto)
        console.log("  🔄 Solicitando resumo ao serviço de LLM (Perplexity)...");
        const prompt = `Resuma o seguinte texto da transcrição de um vídeo do YouTube em português brasileiro, focando nos pontos principais e na ideia central. Mantenha o resumo conciso e informativo:\n\n${truncatedTranscript}\n\nResumo:`;

        const parts = [{ text: prompt }];
        const resumo = await processarMensagemMultimodal(parts, []);
        if (resumo && !resumo.startsWith('❌')) {
            console.log('  ✅ Resumo gerado.');
            return `📝 *Resumo do Vídeo:*\n\n${resumo}`;
        } else {
            console.error('  ❌ Falha ao gerar resumo via Perplexity:', resumo);
            return resumo || '❌ Falha ao gerar o resumo do vídeo.';
        }

    } catch (error) {
        console.error('\n❌ Erro ao buscar ou resumir transcrição do YouTube:', error);
        if (error.message && error.message.includes('disabled transcript')) {
             return "❌ As legendas/transcrições estão desativadas para este vídeo.";
        }
        if (error.message && error.message.includes('No transcript found')) {
             return "❌ Não foi possível encontrar a transcrição para este vídeo.";
        }
        // Tenta extrair mensagem de erro mais específica da resposta da Groq, se aplicável
        const detailedError = error.response?.data?.error?.message || error.message || "Erro desconhecido";
        return `❌ Ocorreu um erro ao processar o vídeo: ${detailedError}`;
    }
}

module.exports = {
    resumirVideoYoutube
}; 