/**
 * Media Handler — processa imagens, áudios e documentos recebidos
 * Documentos financeiros (extratos/faturas) são importados automaticamente no FinanceTracker
 */

const fs = require('fs');
const path = require('path');
const { adicionarAoHistorico } = require('../../chat-history');
const { analisarConteudoMultimodal } = require('../../api/gemini');
const { getOrCreateTracker } = require('../../finance-api');
const { gerarGraficosFinanceiros } = require('../../finance-charts');
const MessageMedia = require('whatsapp-web.js').MessageMedia;

/**
 * Formata valor em reais no padrão brasileiro: R$ 1.500,00
 */
function formatarMoeda(valor) {
    const num = parseFloat(valor) || 0;
    return 'R$ ' + num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Prompt para extração estruturada de transações de PDFs financeiros
const EXTRACTION_PROMPT = `Você é um extrator de dados financeiros altamente preciso.

Analise este documento financeiro (extrato bancário ou fatura de cartão de crédito) e extraia TODAS as transações.

RETORNE EXATAMENTE neste formato JSON (sem markdown, sem explicações, APENAS o JSON):

{
  "tipo_documento": "extrato" ou "fatura",
  "banco": "nome do banco/instituição",
  "periodo": "mês/ano de referência",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "descrição da transação",
      "amount": 99.99,
      "type": "expense" ou "income",
      "category": "uma das categorias: Alimentação, Transporte, Saúde, Lazer, Moradia, Educação, Vestuário, Serviços, Assinaturas, Investimentos, Outros"
    }
  ],
  "summary": {
    "total_entradas": 0.00,
    "total_saidas": 0.00,
    "saldo": 0.00
  }
}

REGRAS IMPORTANTES:
- Extraia TODAS as transações, não omita nenhuma
- Para faturas de cartão: TODAS as compras são "expense"
- Categorize cada transação adequadamente:
  - iFood, restaurantes, padaria → "Alimentação"
  - Uber, combustível, estacionamento → "Transporte"  
  - Netflix, Spotify, Disney+ → "Assinaturas"
  - Aluguel, condomínio, luz, água → "Moradia"
  - Plano de saúde, farmácia → "Saúde"
  - Academia, cinema, shows → "Lazer"
  - Cursos, livros → "Educação"
  - PIX/TED recebido → "income" com category "Receita"
  - Salário → "income" com category "Salário"
- Use valores numéricos (sem R$, sem pontos de milhar)
- Datas em formato YYYY-MM-DD
- Se não conseguir identificar a data exata, use o primeiro dia do mês de referência
- RETORNE APENAS O JSON, nada mais`;

// Prompt para relatório humano após importação (fallback)
const REPORT_PROMPT = `Você é um consultor financeiro pessoal amigável.

Com base nos dados importados deste extrato/fatura, gere um relatório financeiro CONCISO e ÚTIL.

Estrutura do relatório:
*RESUMO DO MÊS*
• Total de receitas e despesas
• Saldo final (indique se positivo ou negativo)

*TOP 3 CATEGORIAS GASTAS*
• Nome da Categoria - Valor (ex: • Alimentação - R$ 500,00)

*DICAS RÁPIDAS (Máx 2)*
• Dica prática baseada nos gastos pra ele economizar.

REGRAS RÍGIDAS DE FORMATAÇÃO (WHATSAPP - OBRIGATÓRIO):
1. USE APENAS UM ASTERISCO PARA NEGRITO: *texto* (Nunca use dois: **texto**)
2. NUNCA use cabeçalhos Markdown como #, ## ou ###
3. Use apenas o caractere • para listas e marcadores
4. Formate dinheiro sempre como R$ 1.500,00 (sempre com vírgula e duas casas)
5. Seja EXTREMAMENTE direto. Máximo absoluto de 15 linhas no total.`;

/**
 * Processa uma mensagem com mídia (imagem, áudio, documento ou outro)
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

        if (!isPDF && !isSpreadsheet) {
            await client.sendMessage(chatId, `📄 Recebi o documento *${filename}*, mas no momento só consigo analisar PDFs e planilhas. Envie em formato PDF!`);
            return 'handled';
        }

        // Verifica se o tamanho do arquivo não passa do limite (~20MB limite do Gemini para inlineData)
        const sizeBytes = Buffer.from(media.data, 'base64').length;
        const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);

        if (sizeBytes > 19 * 1024 * 1024) {
            await client.sendMessage(chatId, `❌ Documento muito grande (${sizeMB}MB). O limite é ~19MB.`);
            return 'handled';
        }

        // Detecta se é documento financeiro pelo nome ou legenda
        const legenda = msg.body || '';
        const isFinancial = /report|statement|extrato|fatura|banco|cart[aã]o|cr[eé]dito|d[eé]bito|nubank|inter|itau|bradesco|santander|caixa|bb|sicredi|sicoob|c6|picpay|mercadopago|stone|pagbank|neon|next|original/i.test(filename + ' ' + legenda);

        try {
            if (isFinancial) {
                // ====== FLUXO FINANCEIRO: Extrai JSON → Importa → Gráficos ======
                await handleFinancialDocument(client, msg, chatId, media, filename, sizeMB, isPDF, mimetype, legenda);
            } else {
                // ====== FLUXO GENÉRICO: Análise normal do documento ======
                await client.sendMessage(chatId, `📄 Analisando *${filename}* (${sizeMB}MB)... Aguarde.`);

                let promptText = legenda || 'Analise este documento em detalhes. Extraia as informações principais, faça um resumo e destaque pontos importantes.';

                const partsEntrada = [
                    { text: promptText },
                    { inlineData: { data: media.data, mimeType: isPDF ? 'application/pdf' : mimetype } }
                ];

                adicionarAoHistorico(chatId, 'user', [{ text: `[Documento enviado: ${filename}]` }]);
                await processarMensagemTexto(client, partsEntrada, chatId, true);
            }
        } catch (error) {
            console.error('\n❌ Erro ao processar documento:', error);
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

/**
 * Processa documento financeiro: extrai transações, importa no tracker, gera gráficos
 */
async function handleFinancialDocument(client, msg, chatId, media, filename, sizeMB, isPDF, mimetype, legenda) {
    await client.sendMessage(chatId, `📊 Documento financeiro detectado: *${filename}* (${sizeMB}MB)\n\n_Extraindo transações e preparando análise..._`);
    adicionarAoHistorico(chatId, 'user', [{ text: `[Extrato/fatura enviado: ${filename}]` }]);

    // 1. EXTRAÇÃO: Pede JSON estruturado ao Gemini
    console.log('📊 [Finance] Extraindo transações do PDF...');
    const extractionParts = [
        { text: EXTRACTION_PROMPT },
        { inlineData: { data: media.data, mimeType: isPDF ? 'application/pdf' : mimetype } }
    ];

    const jsonResponse = await analisarConteudoMultimodal(extractionParts);

    // 2. PARSE: Extrai o JSON da resposta
    let parsedData = null;
    try {
        // Tenta extrair JSON da resposta (pode vir com markdown ou texto extra)
        let jsonStr = jsonResponse;

        // Remove blocos markdown
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }

        // Tenta encontrar o JSON na resposta
        const braceStart = jsonStr.indexOf('{');
        const braceEnd = jsonStr.lastIndexOf('}');
        if (braceStart !== -1 && braceEnd !== -1) {
            jsonStr = jsonStr.substring(braceStart, braceEnd + 1);
        }

        parsedData = JSON.parse(jsonStr);
        console.log(`📊 [Finance] ${parsedData.transactions?.length || 0} transações extraídas`);
    } catch (parseErr) {
        console.error('❌ Erro ao parsear JSON do Gemini:', parseErr.message);
        console.log('📊 [Finance] Resposta bruta:', jsonResponse.substring(0, 500));

        // Fallback: envia análise em texto normal
        await client.sendMessage(chatId, `⚠️ Não consegui extrair transações estruturadas. Gerando análise em texto...`);

        const fallbackParts = [
            { text: REPORT_PROMPT + '\n\nDocumento analisado:\n' + jsonResponse },
        ];
        const fallbackReport = await analisarConteudoMultimodal(fallbackParts);
        await client.sendMessage(chatId, fallbackReport);
        adicionarAoHistorico(chatId, 'model', [{ text: fallbackReport }]);
        return;
    }

    // 3. IMPORT: Importa transações no FinanceTracker
    const tracker = getOrCreateTracker(chatId);
    const source = parsedData.tipo_documento === 'fatura' ? 'fatura' : 'extrato';
    const importResult = tracker.importTransactions(parsedData.transactions, source);

    if (importResult.error) {
        await client.sendMessage(chatId, `❌ Erro na importação: ${importResult.error}`);
        return;
    }

    // 4. RELATÓRIO: Gera texto de resumo
    const summary = importResult.summary;
    const banco = parsedData.banco || 'Não identificado';
    const periodo = parsedData.periodo || 'atual';

    let reportText = `✅ *Importação concluída!*\n\n`;
    reportText += `🏦 *${banco}* — ${source === 'fatura' ? 'Fatura' : 'Extrato'} (${periodo})\n`;
    reportText += `📥 ${importResult.imported} transações importadas`;
    if (importResult.duplicates > 0) {
        reportText += ` (${importResult.duplicates} duplicatas ignoradas)`;
    }
    reportText += `\n\n`;
    reportText += `📊 *Resumo do Mês*\n`;
    reportText += `💰 Receitas: ${formatarMoeda(summary.totalIncome)}\n`;
    reportText += `💸 Despesas: ${formatarMoeda(summary.totalExpenses)}\n`;
    reportText += `📈 Saldo: ${formatarMoeda(summary.balance)}\n`;
    reportText += `📅 Total de transações: ${summary.transactionCount}\n`;

    if (summary.byCategory && summary.byCategory.length > 0) {
        reportText += `\n📂 *Top Categorias:*\n`;
        for (const cat of summary.byCategory.slice(0, 5)) {
            reportText += `  • ${cat.category}: ${formatarMoeda(cat.amount)} (${cat.percentage}%)\n`;
        }
    }

    if (summary.avoidableExpenses > 0) {
        reportText += `\n⚠️ *Gastos evitáveis:* ${formatarMoeda(summary.avoidableExpenses)} (${summary.avoidablePercentage}%)\n`;
    }

    reportText += `\n_Gerando gráficos..._`;
    await client.sendMessage(chatId, reportText);
    adicionarAoHistorico(chatId, 'model', [{ text: reportText }]);

    // 5. GRÁFICOS: Gera e envia charts
    try {
        const chartData = tracker.generateChartData();
        const chartPaths = await gerarGraficosFinanceiros(chartData);

        for (const chartPath of chartPaths) {
            if (fs.existsSync(chartPath)) {
                const imageMedia = MessageMedia.fromFilePath(chartPath);
                await client.sendMessage(chatId, imageMedia);
                // Pequeno delay entre imagens
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (chartPaths.length > 0) {
            await client.sendMessage(chatId, `📊 ${chartPaths.length} gráfico(s) gerado(s) com sucesso!`);
        }
    } catch (chartErr) {
        console.error('❌ Erro ao gerar gráficos:', chartErr.message);
        await client.sendMessage(chatId, '⚠️ Transações importadas, mas houve erro ao gerar gráficos.');
    }
}

module.exports = {
    handleMediaMessage
};
