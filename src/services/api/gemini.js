// Gemini service - clean single-definition implementation
// Single, cleaned Gemini service implementation
require('dotenv').config();
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { gerarSystemMessage, obterDataHoraAtual } = require('../../config/system-prompt');

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
        const { dataFormatada, horaFormatada, diaSemana } = obterDataHoraAtual();
        const contextoParts = [{ text: `Hoje é ${diaSemana}, ${dataFormatada} às ${horaFormatada}\n\n` }, ...parts];
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