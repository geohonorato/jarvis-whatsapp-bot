require('dotenv').config();
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { gerarSystemMessage, obterDataHoraAtual } = require('../../config/system-prompt');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || ''; // Fallback until user removes GROQ entirely
let genAI_Gemini = null;
let fileManager = null;

try {
    if (GEMINI_API_KEY) {
        genAI_Gemini = new GoogleGenerativeAI(GEMINI_API_KEY);
        fileManager = new GoogleAIFileManager(GEMINI_API_KEY);
    }
} catch (e) {
    console.warn('⚠️ Falha ao instanciar SDK do Gemini:', e?.message || e);
}

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

let modelFlash = null;
let modelPro = null;

if (genAI_Gemini) {
    try {
        // 2.5 Flash: Extremely fast for daily text, normal images, documents
        modelFlash = genAI_Gemini.getGenerativeModel({ model: 'gemini-2.5-flash', safetySettings, systemInstruction: gerarSystemMessage() });

        // 2.5 Pro: Massive reasoning for heavy meeting transcriptions and deep logic
        modelPro = genAI_Gemini.getGenerativeModel({ model: 'gemini-2.5-pro', safetySettings, systemInstruction: gerarSystemMessage() });
    }
    catch (e) { console.warn('⚠️ Falha ao configurar modelos do Gemini:', e?.message || e); }
}

function filtrarPensamentos(texto) {
    if (!texto) return texto;
    return texto.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function formatarHistoricoParaGemini(historico) {
    if (!historico) return [];
    // Gemini V1 requires user/model roles exactly
    return historico.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: msg.parts.map(p => {
            if (p.text) return p;
            if (p.inlineData) return p; // We assume inlineData is small enough to be kept in history
            if (p.fileData) return p; // File API object
            return { text: '[Mídia anexada]' };
        })
    }));
}

/**
 * Faz upload do arquivo para os servidores da Google
 * Crucial para evitar o limite de Payload HTTP do inlineData (que quebra com > 20MB)
 */
async function uploadToGeminiFileAPI(base64Data, mimeType) {
    if (!fileManager) throw new Error("Google AI File Manager não configurado.");

    // Extrai extensão do mimetype
    let ext = 'bin';
    if (mimeType.includes('audio/oga') || mimeType.includes('audio/ogg')) ext = 'ogg';
    else if (mimeType.includes('audio/mp4') || mimeType.includes('video/mp4')) ext = 'mp4';
    else if (mimeType.includes('audio/mpeg')) ext = 'mp3';
    else if (mimeType.includes('application/pdf')) ext = 'pdf';
    else if (mimeType.includes('image/jpeg')) ext = 'jpg';
    else if (mimeType.includes('image/png')) ext = 'png';
    else if (mimeType.split('/')[1]) ext = mimeType.split('/')[1].split(';')[0];

    const tmpFilePath = path.join(os.tmpdir(), `gemini_upload_${Date.now()}.${ext}`);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(tmpFilePath, buffer);

    console.log(`📤 [Gemini File API] Iniciando upload de ${(buffer.length / 1024 / 1024).toFixed(2)} MB...`);

    try {
        const uploadResponse = await fileManager.uploadFile(tmpFilePath, {
            mimeType: mimeType,
            displayName: `Media_${Date.now()}`
        });

        console.log(`✅ [Gemini File API] Upload concluído! URI: ${uploadResponse.file.uri}`);

        // Remove o temp local após o upload pra nuvem
        fs.unlinkSync(tmpFilePath);

        // Retorna o objeto no formato esperado pela API generativa
        return {
            fileData: {
                mimeType: uploadResponse.file.mimeType,
                fileUri: uploadResponse.file.uri
            }
        };
    } catch (error) {
        if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
        throw error;
    }
}

/**
 * Função otimizada para lidar tanto com arquivos pequenos via InlineBase64 quanto arquivos massivos via File API
 */
async function prepareMultimodalParts(parts) {
    const processedParts = [];
    let isHeavyProcessing = false;

    for (const part of parts) {
        if (part.text) {
            processedParts.push(part);
            continue;
        }

        if (part.inlineData) {
            const sizeBytes = Buffer.from(part.inlineData.data, 'base64').length;
            const sizeMB = sizeBytes / (1024 * 1024);

            // Arquivos de Reunião, Documentos e Vídeos tendem a exigir Pro model
            if (part.inlineData.mimeType.startsWith('audio/') || sizeMB > 5) {
                isHeavyProcessing = true;
            }

            // Se for > 15MB, não tem como empurrar no JSON Payload, DEVE subir File API
            if (sizeMB > 15) {
                const fileDataPart = await uploadToGeminiFileAPI(part.inlineData.data, part.inlineData.mimeType);
                processedParts.push(fileDataPart);
            } else {
                // Pequeno, vai direto pelo payload por ser mais rápido
                processedParts.push(part);
            }
        } else if (part.fileData) {
            isHeavyProcessing = true;
            processedParts.push(part);
        }
    }

    return { processedParts, isHeavyProcessing };
}

/**
 * Função especializada para análise multimodal pura (como processamento silencioso de PDF ou transcrição de Áudio)
 */
async function analisarConteudoMultimodal(parts) {
    try {
        console.log('\n🔍 Iniciando análise multimodal com Gemini 2.5...');
        if (!modelFlash) return '❌ Serviço Gemini não configurado.';

        const temAudio = parts.some(p => p.inlineData?.mimeType?.startsWith('audio/') || p.fileData?.mimeType?.startsWith('audio/'));

        let promptAnalise = parts.find(p => p.text)?.text || '';

        // Se for uma requisição crua só com mídia, impomos um prompt de base
        if (!promptAnalise && temAudio) {
            promptAnalise = `Transcreva o áudio inteiramente e literalmente em português do Brasil, sem cortes. Use pontuação adequada. Não faça comentários extras nem gere comandos do sistema.`;
        } else if (!promptAnalise) {
            promptAnalise = `Analise a mídia anexada em detalhes sem adicionar comandos do sistema.`;
        }

        // Filtra o prompt manual e aplica a conversão de FileAPI se o áudio for gigante
        const cleanParts = parts.filter(p => !p.text);
        cleanParts.unshift({ text: promptAnalise });

        const { processedParts, isHeavyProcessing } = await prepareMultimodalParts(cleanParts);

        // Seleciona o modelo ideal (Pro para pesadelo, Flash para trivial)
        const modelToUse = isHeavyProcessing ? modelPro : modelFlash;
        console.log(`🧠 [Analise] Modelo alocado: ${modelToUse.model}`);

        const result = await modelToUse.generateContent(processedParts);
        const response = result.response;

        if (response.promptFeedback?.blockReason) {
            return `❌ Conteúdo bloqueado: ${response.promptFeedback.blockReason}`;
        }

        const analise = response.text();
        return filtrarPensamentos(analise || '');

    } catch (err) {
        console.error('❌ Erro na análise multimodal (Gemini):', err?.message || err);
        return '❌ Erro ao analisar conteúdo.';
    }
}

/**
 * Processamento Principal do Chat do Bot (Substitui Groq)
 */
async function processarMensagemMultimodal(parts, historico = [], tentativa = 1) {
    const MAX_RETRIES = 3, DELAY_BASE = 2000;
    try {
        console.log(`\n🧠 Processando Entrada Chat com Gemini 2.5... (tentativa ${tentativa}/${MAX_RETRIES})`);

        if (!modelFlash) return '❌ Serviço Gemini não configurado. Verifique a GEMINI_API_KEY no .env';

        let historicoGemini = formatarHistoricoParaGemini(historico);

        const { dataFormatada, horaFormatada, diaSemana } = obterDataHoraAtual();
        const prefixoData = `Hoje é ${diaSemana}, ${dataFormatada} às ${horaFormatada}\n\n`;

        // Prepara partes do usuário combinando data e tratando uploads pesados
        const partesSujas = [...parts];
        // Encontra ou cria texto
        const textoOriginal = partesSujas.find(p => p.text);
        if (textoOriginal) {
            textoOriginal.text = prefixoData + textoOriginal.text;
        } else {
            partesSujas.unshift({ text: prefixoData + "Analisar imagem/arquivo anexo:" });
        }

        const { processedParts, isHeavyProcessing } = await prepareMultimodalParts(partesSujas);

        // Modelo inteligente ou veloz?
        const modelToUse = isHeavyProcessing ? modelPro : modelFlash;
        console.log(`🚀 Roteando requisição para: ${modelToUse.model}`);

        const chat = modelToUse.startChat({
            history: historicoGemini,
            generationConfig: { maxOutputTokens: 8192, temperature: 0.6 } // Gemini 2.5 tem output máximo maior!
        });

        try {
            const result = await chat.sendMessage(processedParts);
            const response = result.response;

            if (response.promptFeedback?.blockReason) {
                return `❌ Resposta bloqueada: ${response.promptFeedback.blockReason}`;
            }

            return filtrarPensamentos(response.text() || '');

        } catch (error) {
            const statusCode = error.status || error.response?.status;
            if ((statusCode === 429 || statusCode === 503) && tentativa < MAX_RETRIES) {
                console.log(`⚠️ Erro 429/503. Aguardando ${DELAY_BASE * tentativa}ms...`);
                await new Promise(r => setTimeout(r, DELAY_BASE * tentativa));
                return processarMensagemMultimodal(parts, historico, tentativa + 1);
            }
            throw error;
        }
    } catch (err) {
        console.error('❌ Erro fatal no Gemini Chat:', err?.message || err);
        return '❌ Erro interno ao processar com a IA (Google AI Studio). Tente novamente.';
    }
}

/**
 * Função de formatação rápida do Core
 * Como formatação é texto simples puro, forçamos o modelo Flash para ser sub-segundo
 */
async function processarComGenerativeAI(parts, tentativa = 1) {
    const MAX_RETRIES = 3, DELAY_BASE = 2000;
    try {
        if (!modelFlash) return '❌ Serviço Gemini não configurado.';

        const promptAtual = parts.map(part => part.text || '').join('\n');

        const quickPrompt = `INSTRUÇÃO DE FORMATAÇÃO: Você é um assistente especialista em formatação de mensagens do WhatsApp. Responda SEMPRE em português com emojis. Seja direto. A formate a seguinte raw info:\n\n${promptAtual}`;

        const result = await modelFlash.generateContent([{ text: quickPrompt }]);
        return filtrarPensamentos(result.response.text());

    } catch (error) {
        if (tentativa < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, DELAY_BASE * tentativa));
            return processarComGenerativeAI(parts, tentativa + 1);
        }
        console.error('\n❌ Erro de formatação:', error.message);
        return '❌ Erro ao tentar formatar a resposta.';
    }
}

/**
 * Gera um vetor de embedding de dimensionalidade 768 usando o gemini-embedding-001
 * Usamos a API REST diretamente ou o SDK dependendo da comodidade, aqui via SDK
 */
async function gerarVetorDeEmbedding(texto) {
    try {
        if (!genAI_Gemini) throw new Error('Serviço Gemini não configurado.');

        const embeddingModel = genAI_Gemini.getGenerativeModel({ model: "gemini-embedding-001" });

        const result = await embeddingModel.embedContent({
            content: { parts: [{ text: texto }] },
            taskType: 'RETRIEVAL_DOCUMENT',
            outputDimensionality: 768
        });

        if (result && result.embedding && result.embedding.values) {
            return result.embedding.values;
        }
        throw new Error("Resposta de embedding malformada.");
    } catch (error) {
        console.error('❌ Erro ao gerar vetor de embedding (Gemini):', error.message);
        return null;
    }
}

module.exports = {
    processarMensagemMultimodal,
    filtrarPensamentos,
    analisarConteudoMultimodal,
    processarComGenerativeAI,
    gerarVetorDeEmbedding
};