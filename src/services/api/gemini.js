// Gemini service - clean single-definition implementation
// Single, cleaned Gemini service implementation
require('dotenv').config();
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
let genAI_Gemini = null;
try { if (GEMINI_API_KEY) genAI_Gemini = new GoogleGenerativeAI(GEMINI_API_KEY); } catch (e) { console.warn('⚠️ Falha ao instanciar GoogleGenerativeAI:', e?.message || e); }

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

let modelTextAndVision = null;
if (genAI_Gemini) {
    try { modelTextAndVision = genAI_Gemini.getGenerativeModel({ model: 'gemini-2.5-flash', safetySettings, systemInstruction: gerarSystemMessage() }); }
    catch (e) { console.warn('⚠️ Falha ao configurar modelTextAndVision:', e?.message || e); }
}

function obterDataHoraAtual() {
    const agora = new Date();
    return {
        dataFormatada: agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        horaFormatada: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    };
}

function gerarSystemMessage() {
    const anoAtual = new Date().getFullYear();
    return `Você é Jarvis, um assistente virtual criado por Geovanni Honorato.
Você deve responder em português do Brasil.
Não inclua seus pensamentos ou raciocínios na resposta.

IMAGENS:
Quando o usuário pedir, sugerir, solicitar, mencionar, desejar, perguntar ou insinuar que deseja ver, receber, ilustrar, visualizar, criar, gerar, baixar, buscar, encontrar, mostrar ou obter uma imagem, foto, ilustração, gráfico, desenho, arte, wallpaper, meme, sticker, cartaz, banner, capa, retrato, avatar, logotipo, símbolo, gráfico, print, screenshot, ou qualquer conteúdo visual, você DEVE emitir APENAS UMA LINHA que comece com "/imagem " seguida de um prompt otimizado em português, descrevendo claramente o que o usuário deseja ver.
- NÃO use inglês no prompt do comando /imagem.
- NÃO explique, não adicione comentários, não adicione nada além do comando /imagem na primeira linha.
- NÃO use aspas no prompt.
- NÃO gere imagens para conteúdo adulto, violento, ofensivo, ilegal ou protegido por direitos autorais.
- TODAS as imagens são enviadas em HD (alta qualidade) por padrão.
- Se o usuário pedir EXPLICITAMENTE "como documento", INCLUA "como documento" no prompt.

Exemplos:
Usuário: "Me envie uma imagem de missa com bispo"
Você: /imagem missa com bispo

Usuário: "Quero ver um desenho de Nossa Senhora Aparecida"
Você: /imagem desenho de Nossa Senhora Aparecida

Usuário: "Gere uma foto realista de um padre como documento"
Você: /imagem foto realista de um padre como documento

Se não for para gerar imagem, NÃO emita /imagem.

EVENTOS:
Se identificar que é um evento, use o comando /add para adicionar à agenda com todas as informações.
Para eventos que ocorrem em múltiplos dias, crie um comando /add para cada dia.
Se não houver horário específico, use SEMPRE o horário padrão das 08:00 às 17:00.

IMPORTANTE - DATAS DOS EVENTOS:
1. Use SEMPRE o ano atual (${anoAtual}) para eventos, a menos que outro ano seja especificado
2. Se não for mencionado o ano, NUNCA use anos futuros
3. Para eventos recorrentes ou futuros, o ano deve ser explicitamente mencionado

Por exemplo:
"Reunião hoje às 19h30" → use ${anoAtual}
"Encontro dia 15/02 às 8h" → use ${anoAtual}
"Formação em 2025" → use 2025 (ano explicitamente mencionado)

IMPORTANTE - EVENTOS DE MÚLTIPLOS DIAS:
Quando receber informações sobre eventos que acontecem em vários dias:
1. Crie um evento separado para CADA DIA do evento
2. Use "Dia 1", "Dia 2", "Dia 3", etc. no título
3. Mantenha a ordem cronológica dos dias

IMPORTANTE - DOUTRINA CATÓLICA E MAGISTÉRIO:
Quando a pergunta for sobre doutrina católica, teologia, Bíblia, sacramentos, ensinamentos da Igreja, papas, santos, catecismo ou questões de fé católica, você deve redirecionar para o especialista Magisterium AI.

Para isso, retorne APENAS o comando: /magisterium PERGUNTA_REFORMULADA

Exemplo:
Usuário: "Maria é co-redentora?"
Você: /magisterium A Igreja Católica considera Maria como co-redentora? Qual é a posição do Magistério sobre esse título?

Usuário: "o que é a eucaristia?"
Você: /magisterium O que é a Eucaristia segundo a doutrina católica? Explique sua importância e fundamento teológico.

Quando usar /magisterium:
- Perguntas sobre doutrina, dogmas, teologia
- Questões sobre sacramentos, liturgia, missa
- Dúvidas sobre santos, Maria, anjos
- Interpretação bíblica católica
- Ensinamentos papais, encíclicas, catecismo
- Moral católica, pecados, virtudes
- História da Igreja quando relacionado à doutrina

NÃO use /magisterium para:
- Perguntas gerais não relacionadas à fé
- Agenda, eventos, compromissos
- Conversas casuais
- Tópicos seculares

Para gerenciar eventos do Google Calendar, use os seguintes comandos quando apropriado:
- Para adicionar um evento: /add TÍTULO | DATA_HORA_INÍCIO | DATA_HORA_FIM | DESCRIÇÃO | LOCAL | CONVIDADOS | MEET
- Para eventos do dia ou de hoje: /today
- Para próximos eventos ou agenda: /schedule
- Para eventos de amanhã: /tomorrow
- Para eventos da semana: /week
- Para eventos da semana que vem: /nextweek
- Para eventos do mês: /month
- Para eventos do mês que vem: /nextmonth
- Para eventos de uma data específica: /date YYYY-MM-DD
- Para listar eventos para deletar: /delete
- Para remover um evento específico: /remove ID
- Para listar os próximos 10 compromissos: /next

IMPORTANTE:
- Quando alguém mencionar um evento com horário, interprete como um pedido para adicionar evento
- O formato do comando /add é: TÍTULO | DATA_INÍCIO | DATA_FIM | DESCRIÇÃO | LOCAL | CONVIDADOS | MEET
- A data final deve ser SEMPRE 1 hora após a data inicial
- Para eventos que ocorrem em múltiplos dias, crie um comando /add para cada dia
- Inclua videoconferência (MEET) quando mencionado reunião ou encontro online
- Adicione convidados quando emails forem mencionados
- Use o formato /add com a data atual quando não especificada
- Para perguntas sobre eventos de hoje, use sempre /today
- Para perguntas sobre eventos de amanhã, use sempre /tomorrow
- Para perguntas sobre eventos da semana atual, use sempre /week
- Para perguntas sobre eventos da semana que vem, use sempre /nextweek
- Para perguntas sobre eventos do mês atual, use sempre /month
- Para perguntas sobre eventos do mês que vem, use sempre /nextmonth
- Para perguntas sobre eventos de uma data específica, use sempre /date YYYY-MM-DD
- Para perguntas sobre eventos para deletar, retorne sempre APENAS o comando /delete.
- Para outras perguntas não relacionadas ao calendário, responda normalmente em português do Brasil.
- Nunca explique como usar os comandos, apenas use-os`;
}

function filtrarPensamentos(texto) { if (!texto) return texto; return texto.replace(/<think>[\s\S]*?<\/think>/g, '').trim(); }

function formatarHistoricoParaGemini(historico) { if (!historico) return []; return historico.map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: msg.parts })); }

/**
 * Função especializada para análise multimodal pura (imagens, áudio, documentos)
 * Retorna apenas a descrição/transcrição, sem tomar decisões ou gerar comandos
 */
async function analisarConteudoMultimodal(parts) {
    try {
        console.log('🔍 Iniciando análise multimodal com Gemini...');
        
        if (!modelTextAndVision) return '❌ Serviço Gemini não configurado. Verifique GEMINI_API_KEY.';
        
        // Identifica o tipo de conteúdo
        const temImagem = parts.some(p => p.inlineData?.mimeType?.startsWith('image/'));
        const temAudio = parts.some(p => p.inlineData?.mimeType?.startsWith('audio/'));
        const textoUsuario = parts.find(p => p.text)?.text || '';
        
        // Cria prompt específico para análise pura
        let promptAnalise = '';
        
        if (temAudio) {
            promptAnalise = `Você é um transcritor especializado. Transcreva o áudio em português do Brasil com alta precisão.

REGRAS:
- Retorne APENAS a transcrição literal do áudio
- Use pontuação adequada
- Não adicione comentários, análises ou interpretações
- Não emita comandos (como /add, /imagem, /magisterium)
- Seja fiel ao conteúdo do áudio

FORMATO DA RESPOSTA:
[Transcrição literal do áudio]`;
        } else if (temImagem) {
            promptAnalise = `Você é um analisador especializado de imagens. Descreva esta imagem em detalhes.

CONTEXTO DO USUÁRIO: "${textoUsuario || 'Analisar imagem'}"

INSTRUÇÕES:
- Descreva todos os elementos visíveis na imagem
- Se houver texto, transcreva-o integralmente
- Se for cartaz/convite de evento, identifique: título, data, hora, local, descrição
- Se for documento, extraia as informações principais
- Seja detalhado e objetivo
- NÃO emita comandos (como /add, /imagem, /magisterium)
- NÃO tome decisões, apenas descreva

FORMATO DA RESPOSTA:
[Descrição detalhada da imagem, incluindo qualquer texto visível]`;
        } else {
            promptAnalise = `Você é um analisador de documentos. Descreva o conteúdo em detalhes.

INSTRUÇÕES:
- Extraia todas as informações importantes
- Seja completo e estruturado
- NÃO emita comandos
- NÃO tome decisões

FORMATO DA RESPOSTA:
[Descrição completa do conteúdo]`;
        }
        
        const contextoParts = [{ text: promptAnalise }, ...parts];
        
        const result = await modelTextAndVision.generateContent(contextoParts);
        const response = result.response;
        
        if (response.promptFeedback?.blockReason) {
            console.error('❌ Conteúdo bloqueado:', response.promptFeedback.blockReason);
            return `❌ Conteúdo bloqueado: ${response.promptFeedback.blockReason}`;
        }
        
        const analise = response.text();
        console.log('✅ Análise multimodal concluída');
        
        return filtrarPensamentos(analise || '');
        
    } catch (err) {
        console.error('❌ Erro na análise multimodal:', err?.message || err);
        return '❌ Erro ao analisar conteúdo multimodal.';
    }
}

async function processarMensagemMultimodal(parts, historico = [], tentativa = 1) {
    const MAX_RETRIES = 3, DELAY_BASE = 2000;
    try {
        console.log(`\n🧠 Processando entrada multimodal com Gemini... (tentativa ${tentativa}/${MAX_RETRIES})`);
            let historicoGemini = formatarHistoricoParaGemini(historico);
            // Garantir que o System Message esteja presente no histórico enviado ao modelo.
            // O endpoint Gemini aqui espera apenas roles 'user' ou 'model'. Alguns SDKs
            // aceitam `systemInstruction`, mas se não for aplicado, injetamos uma mensagem
            // de instrução como uma entrada 'user' no início do histórico, prefixada para
            // ser claramente identificável como instrução de sistema.
            if (!Array.isArray(historicoGemini)) historicoGemini = [];
            const possuiInstrucao = historicoGemini.some(h => h.parts?.some(p => typeof p.text === 'string' && p.text.includes('INSTRUÇÕES DO SISTEMA:')));
            if (!possuiInstrucao) {
                historicoGemini.unshift({ role: 'user', parts: [{ text: `INSTRUÇÕES DO SISTEMA:\n${gerarSystemMessage()}` }] });
            }
        const { dataFormatada, horaFormatada } = obterDataHoraAtual();
        const contextoParts = [{ text: `Data e hora atual: ${dataFormatada} às ${horaFormatada}\n\n` }, ...parts];
        if (!modelTextAndVision) return '❌ Serviço Gemini não configurado. Verifique GEMINI_API_KEY.';
        const chat = modelTextAndVision.startChat({ history: historicoGemini, generationConfig: { maxOutputTokens: 2048, temperature: 0.3, topP: 1 } });
        try {
            const result = await chat.sendMessage(contextoParts);
            const response = result.response;
            if (response.promptFeedback?.blockReason) return `❌ Bloqueado: ${response.promptFeedback.blockReason}`;
            const text = response.text();
            return filtrarPensamentos(text || '');
        } catch (error) {
            if ((error.status === 503) && tentativa < MAX_RETRIES) { await new Promise(r => setTimeout(r, DELAY_BASE * tentativa)); return processarMensagemMultimodal(parts, historico, tentativa + 1); }
            throw error;
        }
    } catch (err) {
        console.error('❌ Erro Gemini:', err?.message || err);
        return '❌ Erro interno ao processar com Gemini.';
    }
}

async function processarAudio(audioBuffer, mimeType) {
    if (!modelTextAndVision) return '❌ Serviço Gemini não configurado. Verifique GEMINI_API_KEY.';
    try {
        const audioBase64 = audioBuffer.toString('base64');
        const audioPart = { inlineData: { data: audioBase64, mimeType } };
        const textPart = { text: 'Transcreva este áudio em português do Brasil. Retorne apenas o texto transcrito.' };
        const result = await modelTextAndVision.generateContent([textPart, audioPart]);
        const response = result.response;
        return response.text().trim();
    } catch (e) { console.error('❌ Erro ao transcrever:', e?.message || e); return '❌ Falha ao transcrever áudio.'; }
}

module.exports = { 
    processarMensagemMultimodal, 
    processarAudio, 
    filtrarPensamentos,
    analisarConteudoMultimodal 
};