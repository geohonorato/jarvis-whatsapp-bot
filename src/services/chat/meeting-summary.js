/**
 * Meeting Summary Service
 * 
 * Responsável por:
 * 1. Classificar áudios (conversa casual vs reunião/aula/palestra)
 * 2. Gerar resumos estruturados de reuniões
 * 3. Criar páginas no Notion com resumo + transcrição
 */

const { analisarConteudoMultimodal } = require('../api/gemini');
const { processarComGroq } = require('../api/groq');
const notionApi = require('../api/notion');

// ============================================================
// Prompts especializados
// ============================================================

const CLASSIFY_PROMPT = `Analise esta transcrição de áudio e classifique em UMA das categorias abaixo.

CATEGORIAS:
1. "meeting" — Reunião de trabalho, planejamento, alinhamento de equipe, standup, retrospectiva
2. "lecture" — Aula, palestra, workshop, seminário, conferência, treinamento
3. "brainstorm" — Sessão de ideias, discussão criativa, planning
4. "interview" — Entrevista de emprego, podcast, entrevista jornalística
5. "casual" — Conversa casual, mensagem de voz pessoal, recado rápido, pedido simples

CRITÉRIOS para NÃO ser "casual":
- Áudio longo com múltiplas pessoas ou tópicos estruturados
- Menções a pautas, agenda, próximos passos, decisões, tarefas
- Contexto formal ou profissional
- Conteúdo educacional ou informativo extenso

CRITÉRIOS para ser "casual":
- Mensagem curta e direta (poucas frases)
- Tom pessoal/informal sem estrutura de reunião
- Perguntas simples ou recados
- Pedidos/comandos ao assistente

Responda APENAS com um JSON (sem markdown, sem explicação):
{"type": "meeting|lecture|brainstorm|interview|casual", "confidence": 0.0-1.0, "suggestedTitle": "título curto e descritivo", "mainTopics": ["tópico1", "tópico2"], "language": "pt-BR"}`;

const SUMMARY_PROMPT = `Você é um especialista em resumir reuniões e criar atas profissionais.

Com base na transcrição abaixo, gere um resumo estruturado e completo.

FORMATO DO RESUMO (use exatamente esta estrutura):

📋 RESUMO DA REUNIÃO

🎯 Objetivo Principal:
[1-2 frases descrevendo o propósito da reunião]

👥 Participantes Identificados:
[Liste os participantes mencionados, se identificáveis. Se não, indique "Não identificados claramente"]

📌 Pontos-chave Discutidos:
• [Ponto 1]
• [Ponto 2]
• [Ponto 3]
[Adicione quantos forem necessários]

✅ Decisões Tomadas:
• [Decisão 1]
• [Decisão 2]
[Se nenhuma decisão clara, indique "Nenhuma decisão explícita registrada"]

📝 Ações e Próximos Passos:
• [Ação 1 — Responsável (se mencionado) — Prazo (se mencionado)]
• [Ação 2 — Responsável — Prazo]
[Se nenhuma ação clara, indique "Nenhuma ação definida"]

⚠️ Pendências e Riscos:
• [Pendência/risco identificado]
[Se nenhum, indique "Nenhuma pendência identificada"]

💡 Observações:
[Insights adicionais, tom da reunião, pontos de atenção]

REGRAS:
- Seja objetivo e conciso, mas não omita informações importantes
- Use português do Brasil
- Mantenha a formatação exata acima
- Se for uma aula/palestra, adapte os campos (troque "Decisões" por "Conceitos-chave", etc.)
- Se for entrevista, adapte apropriadamente

TRANSCRIÇÃO:
`;

const TITLE_PROMPT = `Com base nesta transcrição de reunião/aula, gere:
1. Um título curto e descritivo (máximo 60 caracteres)
2. Um emoji adequado para representar o conteúdo

Responda APENAS com JSON (sem markdown):
{"title": "Título da Reunião", "emoji": "📋", "category": "categoria_sugerida"}

Categorias possíveis: Trabalho, Estudo, Projeto, Pessoal, Igreja, Planejamento, Tecnologia, Saúde, Finanças, Outro

TRANSCRIÇÃO (primeiros 2000 caracteres):
`;

// ============================================================
// Funções principais
// ============================================================

/**
 * Classifica o tipo de áudio com base na transcrição
 * @param {string} transcription - Texto transcrito do áudio
 * @returns {Promise<{type: string, confidence: number, suggestedTitle: string, mainTopics: string[]}>}
 */
async function classifyAudio(transcription) {
    try {
        // Heurística rápida: se a transcrição é muito curta, é casual
        const wordCount = transcription.split(/\s+/).length;
        if (wordCount < 30) {
            return {
                type: 'casual',
                confidence: 0.95,
                suggestedTitle: null,
                mainTopics: []
            };
        }

        const result = await processarComGroq([{
            text: `${CLASSIFY_PROMPT}\n\nTRANSCRIÇÃO:\n${transcription.substring(0, 3000)}`
        }]);

        // Tenta parsear o JSON
        try {
            const jsonStr = result.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
            const braceStart = jsonStr.indexOf('{');
            const braceEnd = jsonStr.lastIndexOf('}');
            if (braceStart !== -1 && braceEnd !== -1) {
                return JSON.parse(jsonStr.substring(braceStart, braceEnd + 1));
            }
        } catch (e) {
            console.warn('⚠️ Falha ao parsear classificação, usando heurística:', e.message);
        }

        // Fallback: heurística por tamanho e palavras-chave
        const meetingKeywords = /reuni[ãa]o|pauta|agenda|próximos passos|deadline|sprint|standup|alinhamento|ata|decidimos|ação|tarefa|responsável/i;
        if (wordCount > 100 && meetingKeywords.test(transcription)) {
            return { type: 'meeting', confidence: 0.7, suggestedTitle: 'Reunião', mainTopics: [] };
        }

        const lectureKeywords = /aula|professor|matéria|prova|exercício|conceito|teoria|slides|apresentação|workshop/i;
        if (wordCount > 100 && lectureKeywords.test(transcription)) {
            return { type: 'lecture', confidence: 0.7, suggestedTitle: 'Aula', mainTopics: [] };
        }

        // Se passou de 100 palavras mas sem keywords claros, trata como meeting genérico
        if (wordCount > 150) {
            return { type: 'meeting', confidence: 0.5, suggestedTitle: 'Discussão', mainTopics: [] };
        }

        return { type: 'casual', confidence: 0.8, suggestedTitle: null, mainTopics: [] };
    } catch (error) {
        console.error('❌ Erro ao classificar áudio:', error.message);
        // Fallback seguro: casual
        return { type: 'casual', confidence: 0.5, suggestedTitle: null, mainTopics: [] };
    }
}

/**
 * Gera um resumo estruturado da reunião
 * @param {string} transcription - Texto transcrito do áudio
 * @returns {Promise<string>} Resumo formatado
 */
async function generateMeetingSummary(transcription) {
    try {
        const result = await processarComGroq([{
            text: `${SUMMARY_PROMPT}\n${transcription}`
        }]);

        return result;
    } catch (error) {
        console.error('❌ Erro ao gerar resumo da reunião:', error.message);
        return '❌ Erro ao gerar resumo da reunião.';
    }
}

/**
 * Gera título e emoji para a reunião
 * @param {string} transcription - Texto transcrito
 * @returns {Promise<{title: string, emoji: string, category: string}>}
 */
async function generateTitle(transcription) {
    try {
        const result = await processarComGroq([{
            text: `${TITLE_PROMPT}\n${transcription.substring(0, 2000)}`
        }]);

        try {
            const jsonStr = result.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
            const braceStart = jsonStr.indexOf('{');
            const braceEnd = jsonStr.lastIndexOf('}');
            if (braceStart !== -1 && braceEnd !== -1) {
                return JSON.parse(jsonStr.substring(braceStart, braceEnd + 1));
            }
        } catch (e) {
            console.warn('⚠️ Falha ao parsear título:', e.message);
        }

        return { title: 'Reunião sem título', emoji: '📋', category: 'Outro' };
    } catch (error) {
        console.error('❌ Erro ao gerar título:', error.message);
        return { title: 'Reunião sem título', emoji: '📋', category: 'Outro' };
    }
}

/**
 * Divide texto longo em blocos de no máximo 2000 caracteres (limite do Notion API)
 * @param {string} text - Texto longo
 * @param {number} maxLen - Tamanho máximo por bloco
 * @returns {string[]} Array de blocos de texto
 */
function splitTextIntoBlocks(text, maxLen = 1900) {
    const blocks = [];
    const paragraphs = text.split('\n');
    let currentBlock = '';

    for (const paragraph of paragraphs) {
        if (currentBlock.length + paragraph.length + 1 > maxLen) {
            if (currentBlock.trim()) {
                blocks.push(currentBlock.trim());
            }
            // Se o parágrafo sozinho é maior que o limite, divide por frases
            if (paragraph.length > maxLen) {
                const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
                let sentenceBlock = '';
                for (const sentence of sentences) {
                    if (sentenceBlock.length + sentence.length > maxLen) {
                        if (sentenceBlock.trim()) blocks.push(sentenceBlock.trim());
                        sentenceBlock = sentence;
                    } else {
                        sentenceBlock += sentence;
                    }
                }
                currentBlock = sentenceBlock;
            } else {
                currentBlock = paragraph;
            }
        } else {
            currentBlock += (currentBlock ? '\n' : '') + paragraph;
        }
    }

    if (currentBlock.trim()) {
        blocks.push(currentBlock.trim());
    }

    return blocks;
}

/**
 * Converte texto de resumo em blocos Notion
 * @param {string} summary - Texto do resumo formatado
 * @returns {Array} Array de blocos Notion
 */
function summaryToNotionBlocks(summary) {
    const lines = summary.split('\n');
    const blocks = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Headers com emoji (ex: "📋 RESUMO DA REUNIÃO")
        if (/^[📋🎯👥📌✅📝⚠️💡🎓📊🔍]\s*.+/.test(trimmed) && trimmed === trimmed.toUpperCase().replace(/[a-záàãâéêíóôõúü]/gi, (m) => m)) {
            // É um título principal (todo caps)
            blocks.push({
                object: 'block',
                type: 'heading_2',
                heading_2: {
                    rich_text: [{ type: 'text', text: { content: trimmed.substring(0, 100) } }]
                }
            });
        } else if (/^[📋🎯👥📌✅📝⚠️💡🎓📊🔍]\s*.+:/.test(trimmed)) {
            // Sub-header com emoji (ex: "🎯 Objetivo Principal:")
            blocks.push({
                object: 'block',
                type: 'heading_3',
                heading_3: {
                    rich_text: [{ type: 'text', text: { content: trimmed.substring(0, 100) } }]
                }
            });
        } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
            // Item de lista
            const content = trimmed.replace(/^[•\-*]\s*/, '').substring(0, 2000);
            blocks.push({
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: {
                    rich_text: [{ type: 'text', text: { content } }]
                }
            });
        } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            // Placeholder (ex: "[Nenhuma decisão explícita registrada]")
            blocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{ type: 'text', text: { content: trimmed }, annotations: { italic: true, color: 'gray' } }]
                }
            });
        } else {
            // Parágrafo normal
            const textBlocks = splitTextIntoBlocks(trimmed, 1900);
            for (const block of textBlocks) {
                blocks.push({
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{ type: 'text', text: { content: block } }]
                    }
                });
            }
        }
    }

    return blocks;
}

/**
 * Converte transcrição em blocos Notion (paragraphs)
 * @param {string} transcription - Texto da transcrição
 * @returns {Array} Array de blocos Notion
 */
function transcriptionToNotionBlocks(transcription) {
    const textBlocks = splitTextIntoBlocks(transcription, 1900);
    return textBlocks.map(block => ({
        object: 'block',
        type: 'paragraph',
        paragraph: {
            rich_text: [{ type: 'text', text: { content: block } }]
        }
    }));
}

/**
 * Cria a estrutura completa no Notion:
 * 1. Encontra a melhor página pai
 * 2. Cria página principal com resumo
 * 3. Cria sub-página com transcrição completa
 * 
 * @param {string} summary - Resumo formatado da reunião
 * @param {string} transcription - Transcrição completa
 * @param {object} metadata - {title, emoji, category, type, mainTopics}
 * @returns {Promise<{success: boolean, pageUrl?: string, title?: string, parentTitle?: string, error?: string}>}
 */
async function createMeetingInNotion(summary, transcription, metadata) {
    try {
        if (!notionApi.isReady()) {
            return { success: false, error: 'Chave do Notion não configurada' };
        }

        const { title, emoji, category, type } = metadata;
        const dataAtual = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
        const pageTitle = `${title} — ${dataAtual}`;

        console.log(`📝 [MeetingSummary] Criando resumo no Notion: "${pageTitle}"`);

        // 1. Busca a melhor página pai
        const parentResult = await notionApi.findBestParentPage(category);
        let parentPageId = null;
        let parentTitle = null;

        if (parentResult.success) {
            parentPageId = parentResult.data.id;
            parentTitle = parentResult.title;
            console.log(`📂 [MeetingSummary] Página pai encontrada: "${parentTitle}" (${parentPageId})`);
        } else {
            console.warn('⚠️ [MeetingSummary] Nenhuma página pai encontrada, criando na raiz do workspace');
        }

        // 2. Cria a página principal do resumo
        let mainPage;
        if (parentPageId) {
            mainPage = await notionApi.createChildPage(parentPageId, pageTitle, emoji || '📋');
        } else {
            // Fallback: cria como página standalone (precisa de um database ou parent)
            // Tentamos criar como child de qualquer página encontrada
            const fallbackSearch = await notionApi.search('');
            if (fallbackSearch.success && fallbackSearch.data.length > 0) {
                const firstPage = fallbackSearch.data.find(r => r.object === 'page');
                if (firstPage) {
                    mainPage = await notionApi.createChildPage(firstPage.id, pageTitle, emoji || '📋');
                }
            }
            if (!mainPage) {
                return { success: false, error: 'Não foi possível encontrar um local no Notion para criar a página' };
            }
        }

        if (!mainPage.success) {
            return { success: false, error: `Erro ao criar página: ${mainPage.error}` };
        }

        const mainPageId = mainPage.data.id;
        const mainPageUrl = mainPage.data.url || notionApi.getPageUrl(mainPageId);

        console.log(`✅ [MeetingSummary] Página principal criada: ${mainPageUrl}`);

        // 3. Adiciona o conteúdo do resumo à página principal
        const summaryBlocks = [];

        // Header com metadados
        summaryBlocks.push({
            object: 'block',
            type: 'callout',
            callout: {
                icon: { type: 'emoji', emoji: '📅' },
                rich_text: [{
                    type: 'text',
                    text: { content: `Data: ${dataAtual} às ${horaAtual} • Tipo: ${type || 'Reunião'} • Categoria: ${category || 'Geral'}` }
                }]
            }
        });

        // Divisor
        summaryBlocks.push({ object: 'block', type: 'divider', divider: {} });

        // Blocos do resumo
        const resumoBlocks = summaryToNotionBlocks(summary);
        summaryBlocks.push(...resumoBlocks);

        // Divisor antes do link da transcrição
        summaryBlocks.push({ object: 'block', type: 'divider', divider: {} });

        // Nota sobre a transcrição
        summaryBlocks.push({
            object: 'block',
            type: 'callout',
            callout: {
                icon: { type: 'emoji', emoji: '🎙️' },
                rich_text: [{
                    type: 'text',
                    text: { content: '📄 A transcrição completa do áudio está na sub-página abaixo.' },
                    annotations: { italic: true }
                }]
            }
        });

        // Adiciona os blocos em lotes de 100 (limite da API do Notion)
        const BATCH_SIZE = 100;
        for (let i = 0; i < summaryBlocks.length; i += BATCH_SIZE) {
            const batch = summaryBlocks.slice(i, i + BATCH_SIZE);
            const appendResult = await notionApi.appendBlocks(mainPageId, batch);
            if (!appendResult.success) {
                console.error(`⚠️ [MeetingSummary] Erro ao adicionar blocos (lote ${i / BATCH_SIZE + 1}):`, appendResult.error);
            }
        }

        // 4. Cria sub-página com a transcrição completa
        const transcriptionPage = await notionApi.createChildPage(mainPageId, `🎙️ Transcrição Completa — ${title}`, '📝');

        if (transcriptionPage.success) {
            const transcriptionPageId = transcriptionPage.data.id;

            // Header na transcrição
            const transcriptionBlocks = [
                {
                    object: 'block',
                    type: 'callout',
                    callout: {
                        icon: { type: 'emoji', emoji: 'ℹ️' },
                        rich_text: [{
                            type: 'text',
                            text: { content: `Transcrição automática gerada em ${dataAtual} às ${horaAtual}.\nEsta transcrição pode conter imprecisões.` },
                            annotations: { italic: true, color: 'gray' }
                        }]
                    }
                },
                { object: 'block', type: 'divider', divider: {} }
            ];

            // Blocos da transcrição
            const contentBlocks = transcriptionToNotionBlocks(transcription);
            transcriptionBlocks.push(...contentBlocks);

            // Adiciona em lotes
            for (let i = 0; i < transcriptionBlocks.length; i += BATCH_SIZE) {
                const batch = transcriptionBlocks.slice(i, i + BATCH_SIZE);
                const appendResult = await notionApi.appendBlocks(transcriptionPageId, batch);
                if (!appendResult.success) {
                    console.error(`⚠️ [MeetingSummary] Erro ao adicionar transcrição (lote ${i / BATCH_SIZE + 1}):`, appendResult.error);
                }
            }

            console.log(`✅ [MeetingSummary] Transcrição adicionada como sub-página`);
        } else {
            console.error('⚠️ [MeetingSummary] Erro ao criar sub-página de transcrição:', transcriptionPage.error);
        }

        return {
            success: true,
            pageUrl: mainPageUrl,
            title: pageTitle,
            parentTitle: parentTitle || 'Raiz do workspace'
        };

    } catch (error) {
        console.error('❌ [MeetingSummary] Erro ao criar reunião no Notion:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Pipeline completo: transcreve → classifica → resume → salva no Notion
 * 
 * @param {string} transcription - Transcrição do áudio (já feita pelo Gemini)
 * @returns {Promise<{type: string, summary?: string, notionUrl?: string, notionTitle?: string, parentFolder?: string}>}
 */
async function processAudioForMeeting(transcription) {
    // 1. Classifica
    console.log('🔍 [MeetingSummary] Classificando áudio...');
    const classification = await classifyAudio(transcription);
    console.log(`📊 [MeetingSummary] Classificação: ${classification.type} (confiança: ${classification.confidence})`);

    if (classification.type === 'casual') {
        return { type: 'casual' };
    }

    // 2. Gera título
    console.log('📝 [MeetingSummary] Gerando título...');
    const titleData = await generateTitle(transcription);

    // 3. Gera resumo
    console.log('📋 [MeetingSummary] Gerando resumo...');
    const summary = await generateMeetingSummary(transcription);

    if (summary.startsWith('❌')) {
        return { type: classification.type, summary: null, error: summary };
    }

    // 4. Salva no Notion
    console.log('💾 [MeetingSummary] Salvando no Notion...');
    const metadata = {
        title: titleData.title || classification.suggestedTitle || 'Reunião',
        emoji: titleData.emoji || '📋',
        category: titleData.category || 'Outro',
        type: classification.type,
        mainTopics: classification.mainTopics || []
    };

    const notionResult = await createMeetingInNotion(summary, transcription, metadata);

    return {
        type: classification.type,
        summary,
        notionUrl: notionResult.success ? notionResult.pageUrl : null,
        notionTitle: notionResult.success ? notionResult.title : null,
        parentFolder: notionResult.success ? notionResult.parentTitle : null,
        error: notionResult.success ? null : notionResult.error
    };
}

module.exports = {
    classifyAudio,
    generateMeetingSummary,
    generateTitle,
    createMeetingInNotion,
    processAudioForMeeting
};
