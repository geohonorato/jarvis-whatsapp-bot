/**
 * Media Handler — processa imagens, áudios e documentos recebidos
 * Extraído de message-handler.js para melhor organização
 */

const { adicionarAoHistorico } = require('../../chat-history');
const { analisarConteudoMultimodal } = require('../../api/gemini');

// Prompt especializado para análise de extratos/faturas
const FINANCIAL_ANALYSIS_PROMPT = `Você é um analista financeiro pessoal especializado.

Analise este documento financeiro (extrato bancário ou fatura de cartão) e forneça um relatório COMPLETO em português do Brasil:

📊 *RESUMO GERAL*
- Total de entradas (receitas/depósitos)
- Total de saídas (gastos/débitos)
- Saldo (entradas - saídas)

📂 *GASTOS POR CATEGORIA* (organize em categorias como Alimentação, Transporte, Assinaturas, Moradia, Lazer, Saúde, Educação, Compras, etc.)
- Para cada categoria: total gasto e % do total

🔝 *TOP 5 MAIORES GASTOS*
- Liste os 5 maiores gastos individuais com data e descrição

🔄 *GASTOS RECORRENTES*
- Identifique assinaturas e débitos automáticos (Netflix, Spotify, seguros, etc.)
- Total mensal em recorrências

⚠️ *ALERTAS*
- Gastos que parecem excessivos ou fora do padrão
- Taxas bancárias ou juros cobrados
- Compras parceladas ativas

💡 *DICAS DE ECONOMIA*
- 3-5 sugestões personalizadas baseadas nos gastos identificados
- Potencial de economia estimado

Use emojis e formatação clara. Seja direto e prático nas recomendações.`;

/**
 * Processa uma mensagem com mídia (imagem, áudio, documento ou outro)
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
    else if (msg.type === 'document') {
        const media = await msg.downloadMedia().catch(() => null);
        if (!media || !media.data) {
            await client.sendMessage(chatId, '❌ Erro ao baixar o documento.');
            return 'handled';
        }

        const mimetype = media.mimetype || '';
        const filename = msg._data?.filename || media.filename || 'documento';
        const isPDF = mimetype.includes('pdf');
        const isSpreadsheet = mimetype.includes('spreadsheet') || mimetype.includes('excel') ||
            filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.csv');

        console.log(`\n📄 Documento recebido: ${filename} (${mimetype})`);

        // Se não for PDF nem planilha, informa que não é suportado
        if (!isPDF && !isSpreadsheet) {
            await client.sendMessage(chatId, `📄 Recebi o documento *${filename}*, mas no momento só consigo analisar PDFs e planilhas. Envie em formato PDF!`);
            return 'handled';
        }

        // Verifica tamanho (~20MB limite do Gemini para inlineData)
        const sizeBytes = Buffer.from(media.data, 'base64').length;
        const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
        console.log(`📏 Tamanho: ${sizeMB}MB`);

        if (sizeBytes > 19 * 1024 * 1024) {
            await client.sendMessage(chatId, `❌ Documento muito grande (${sizeMB}MB). O limite é ~19MB.`);
            return 'handled';
        }

        try {
            await client.sendMessage(chatId, `📄 Analisando *${filename}* (${sizeMB}MB)... Aguarde um momento.`);

            const legenda = msg.body || '';
            const isFinancial = /extrato|fatura|banco|cart[aã]o|cr[eé]dito|d[eé]bito|nubank|inter|itau|bradesco|santander|caixa|bb|sicredi|sicoob|c6|picpay|mercadopago|stone|pagbank/i.test(filename + ' ' + legenda);

            let promptText;
            if (legenda) {
                promptText = legenda;
            } else if (isFinancial) {
                promptText = FINANCIAL_ANALYSIS_PROMPT;
            } else {
                promptText = 'Analise este documento em detalhes. Extraia as informações principais, faça um resumo e destaque pontos importantes.';
            }

            const partsEntrada = [
                { text: promptText },
                { inlineData: { data: media.data, mimeType: isPDF ? 'application/pdf' : mimetype } }
            ];

            adicionarAoHistorico(chatId, 'user', [{ text: `[Documento enviado: ${filename}]` }]);
            await processarMensagemTexto(client, partsEntrada, chatId, true);

        } catch (error) {
            console.error('\n❌ Erro ao processar documento:', error);
            adicionarAoHistorico(chatId, 'user', [{ text: `[Erro ao processar documento: ${filename}]` }]);
            await client.sendMessage(chatId, '❌ Erro inesperado ao processar o documento.');
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
