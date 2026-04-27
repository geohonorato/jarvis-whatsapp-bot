/**
 * Meeting Summary Service
 * 
 * Responsável por:
 * 1. Classificar áudios (conversa casual vs reunião/aula/palestra)
 * 2. Gerar resumos estruturados de reuniões
 * 3. Salvar notas no Obsidian Vault com Wikilinks
 */

const { processarComGroq } = require('../api/groq');
const fs = require('fs');
const path = require('path');

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || process.env.VAULT_PATH || (
    process.platform === 'win32' 
        ? 'C:\\Users\\Geovanni\\Documents\\Obsidian Vault' 
        : '/home/ubuntu/obsidian-vault'
);

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
3. O caminho da pasta (path) mais adequado dentro do Vault seguindo o método PARA.

ESTRUTURA DO VAULT:
- 10 - Projetos/Jarvis
- 10 - Projetos/SIQMA
- 20 - Áreas/Pascom
- 20 - Áreas/Coroinhas
- 20 - Áreas/Clone Digital
- 30 - Recursos/Estudos/Engenharia
- 90 - Arquivos/Inbox (Use se não houver um local melhor)

REGRAS DE PASTA:
- Se for sobre a Pascom (artes, redes sociais, comunicados paroquiais), use "20 - Áreas/Pascom/Reuniões".
- Se for sobre Coroinhas (acólitos, liturgia, serviço do altar), use "20 - Áreas/Coroinhas/Reuniões".
- Se for sobre engenharia/estudos, use "30 - Recursos/Estudos/Engenharia/Reuniões".
- Se for sobre o Jarvis/bot, use "10 - Projetos/Jarvis/Reuniões".
- Se for sobre o SIQMA, use "10 - Projetos/SIQMA/Reuniões".
- Se não tiver certeza ou for genérico, use "90 - Arquivos/Inbox".

Responda APENAS com JSON (sem markdown):
{"title": "Título da Reunião", "emoji": "📋", "category": "categoria_sugerida", "path": "caminho/da/pasta"}

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
 * Gera título, emoji e caminho para a reunião
 * @param {string} transcription - Texto transcrito
 * @returns {Promise<{title: string, emoji: string, category: string, path: string}>}
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

        return { title: 'Reunião sem título', emoji: '📋', category: 'Outro', path: '90 - Arquivos/Inbox' };
    } catch (error) {
        console.error('❌ Erro ao gerar título:', error.message);
        return { title: 'Reunião sem título', emoji: '📋', category: 'Outro', path: '90 - Arquivos/Inbox' };
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
 * Cria a nota de reunião diretamente no Obsidian Vault
 * 
 * @param {string} summary - Resumo formatado da reunião
 * @param {string} transcription - Transcrição completa
 * @param {object} metadata - {title, emoji, category, type, mainTopics}
 * @returns {Promise<{success: boolean, filePath?: string, title?: string, error?: string}>}
 */
async function createMeetingInObsidian(summary, transcription, metadata) {
    try {
        const { title, category, type } = metadata;
        const dataObjeto = new Date();
        const dataAtual = dataObjeto.toISOString().split('T')[0];
        const dataFormatada = dataObjeto.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const horaAtual = dataObjeto.toTimeString().split(':')[0] + '-' + dataObjeto.toTimeString().split(':')[1];
        
        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        const fileName = `${dataAtual}-${horaAtual}-${safeTitle}.md`;

        // Determina a pasta com base na sugestão da IA ou categoria
        let folder = metadata.path || '90 - Arquivos/Inbox';
        
        // Sanitização e validação simples da pasta
        if (folder.includes('..') || folder.startsWith('/') || folder.startsWith('\\')) {
            folder = '90 - Arquivos/Inbox';
        }

        const fullFolderPath = path.join(VAULT_PATH, folder);
        if (!fs.existsSync(fullFolderPath)) {
            fs.mkdirSync(fullFolderPath, { recursive: true });
        }

        const filePath = path.join(fullFolderPath, fileName);

        // Gera conteúdo com Wikilinks
        const content = `---
type: reunião
category: [[${category}]]
date: [[${dataAtual}]]
source: jarvis
---

# ${metadata.emoji || '📋'} ${title}

> Reunião registrada em [[${dataAtual}]] às ${horaAtual.replace('-', ':')}

${summary.replace(/#+ /g, '## ')}

---
## 🎙️ Transcrição Completa
${transcription}

#reunião #jarvis #[[${category}]]
`;

        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`✅ [MeetingSummary] Nota salva no Obsidian: ${filePath}`);

        return {
            success: true,
            filePath: filePath,
            title: title,
            folder: folder
        };

    } catch (error) {
        console.error('❌ [MeetingSummary] Erro ao salvar no Obsidian:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Pipeline completo: classifica → resume → salva no Obsidian Vault
 * 
 * @param {string} transcription - Transcrição do áudio (já feita pelo Gemini)
 * @returns {Promise<{type: string, summary?: string, obsidianPath?: string, obsidianTitle?: string, folder?: string}>}
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

    // 4. Salva no Obsidian
    console.log('💾 [MeetingSummary] Salvando no Obsidian Vault...');
    const metadata = {
        title: titleData.title || classification.suggestedTitle || 'Reunião',
        emoji: titleData.emoji || '📋',
        category: titleData.category || 'Outro',
        path: titleData.path || '90 - Arquivos/Inbox',
        type: classification.type,
        mainTopics: classification.mainTopics || []
    };

    const obsidianResult = await createMeetingInObsidian(summary, transcription, metadata);

    return {
        type: classification.type,
        summary,
        obsidianPath: obsidianResult.success ? obsidianResult.filePath : null,
        obsidianTitle: obsidianResult.success ? obsidianResult.title : null,
        folder: obsidianResult.success ? obsidianResult.folder : null,
        error: obsidianResult.success ? null : obsidianResult.error
    };
}

module.exports = {
    classifyAudio,
    generateMeetingSummary,
    generateTitle,
    createMeetingInObsidian,
    processAudioForMeeting
};
