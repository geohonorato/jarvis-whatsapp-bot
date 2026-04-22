require("dotenv").config();
const axios = require("axios");
const https = require("https");
const { gerarSystemMessage, obterDataHoraAtual } = require('../../config/system-prompt');

// === CONFIGURAÇÃO DE PROVIDER ===
// Prioridade: DeepSeek direto > Groq (fallback)
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!DEEPSEEK_API_KEY && !GROQ_API_KEY) {
    console.error("❌ Nenhuma API key encontrada (DEEPSEEK_API_KEY ou GROQ_API_KEY)");
    process.exit(1);
}

const useDeepSeek = !!DEEPSEEK_API_KEY;
const providerName = useDeepSeek ? 'DeepSeek' : 'Groq';

console.log(`🧠 Provider de IA: ${providerName}`);

// Cliente HTTP configurado para o provider ativo
const aiClient = axios.create({
    baseURL: useDeepSeek 
        ? 'https://api.deepseek.com/v1'
        : 'https://api.groq.com/openai/v1',
    timeout: 90000, // 90s (DeepSeek pode ser mais lento que Groq)
    headers: {
        'Authorization': `Bearer ${useDeepSeek ? DEEPSEEK_API_KEY : GROQ_API_KEY}`,
        'Content-Type': 'application/json'
    },
    httpsAgent: new https.Agent({ keepAlive: true })
});

// Configurações do modelo
const defaultOptions = {
    model: useDeepSeek ? "deepseek-chat" : "llama-3.3-70b-versatile",
    temperature: 0.6,
    max_tokens: 4096, // Reduzido de 8192 para economizar tokens na resposta
    top_p: 1,
    stop: null
};

console.log(`📦 Modelo: ${defaultOptions.model}`);

// Prepara o histórico no formato OpenAI-compatible
function formatarHistoricoParaGroq(historico) {
    if (!historico) return [];

    return historico.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.parts.map(part => {
            if (part.text) return { type: 'text', text: part.text };
            if (part.inlineData) {
                return { type: 'text', text: '[Imagem enviada anteriormente]' };
            }
            return { type: 'text', text: '' };
        })
    }));
}

/**
 * Remove a tag <think> e seu conteúdo do texto
 */
function filtrarPensamentos(texto) {
    if (!texto) return texto;
    return texto.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/**
 * Processa uma mensagem com possível conteúdo multimodal
 */
async function processarMensagemMultimodal(parts, historico = [], tentativa = 1) {
    const MAX_RETRIES = 3;
    const DELAY_BASE = 2000;

    try {
        console.log(`\n🧠 Processando com ${providerName}... (tentativa ${tentativa}/${MAX_RETRIES})`);

        const historicoGroq = formatarHistoricoParaGroq(historico);
        const { dataFormatada, horaFormatada, diaSemana } = obterDataHoraAtual();
        const contextoAtual = `Hoje é ${diaSemana}, ${dataFormatada} às ${horaFormatada}\n\n`;

        const temImagem = parts.some(part => part.inlineData != null);

        // Para imagens, usa modelo de visão (só no Groq)
        let modelToUse = defaultOptions.model;
        if (temImagem && !useDeepSeek) {
            modelToUse = 'meta-llama/llama-4-scout-17b-16e-instruct';
        }

        let promptParts = [];
        if (contextoAtual) {
            promptParts.push({ type: 'text', text: contextoAtual });
        }

        parts.forEach(part => {
            if (part.text) {
                promptParts.push({ type: 'text', text: part.text });
            }
            if (part.inlineData) {
                const mimeType = part.inlineData.mimeType || 'image/jpeg';
                const base64Data = part.inlineData.data;
                promptParts.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:${mimeType};base64,${base64Data}`
                    }
                });
            }
        });

        try {
            const messages = [
                { role: 'system', content: gerarSystemMessage() },
                ...historicoGroq,
                { role: 'user', content: promptParts }
            ];

            // Estimativa de tokens (1 token ~= 4 chars)
            let totalChars = 0;
            messages.forEach(msg => {
                if (typeof msg.content === 'string') {
                    totalChars += msg.content.length;
                } else if (Array.isArray(msg.content)) {
                    msg.content.forEach(part => {
                        if (part.type === 'text' && part.text) totalChars += part.text.length;
                        if (part.type === 'image_url') totalChars += 1000;
                    });
                }
            });

            // Limite de segurança
            const MAX_CHARS = useDeepSeek ? 32000 : 24000;

            // Remove histórico antigo se necessário
            while (totalChars > MAX_CHARS && messages.length > 2) {
                const removido = messages.splice(1, 1)[0];
                if (typeof removido.content === 'string') {
                    totalChars -= removido.content.length;
                } else if (Array.isArray(removido.content)) {
                    removido.content.forEach(part => {
                        if (part.type === 'text' && part.text) totalChars -= part.text.length;
                        if (part.type === 'image_url') totalChars -= 1000;
                    });
                }
            }

            // Corte de emergência
            if (totalChars > MAX_CHARS) {
                console.warn(`⚠️ Payload ainda grande: ${totalChars} chars. Cortando...`);
                const excesso = totalChars - MAX_CHARS;
                const lastMsg = messages[messages.length - 1];
                if (typeof lastMsg.content === 'string') {
                    lastMsg.content = lastMsg.content.substring(0, lastMsg.content.length - excesso - 100) + '... [CORTADO]';
                } else if (Array.isArray(lastMsg.content)) {
                    const textPart = lastMsg.content.find(p => p.type === 'text');
                    if (textPart && typeof textPart.text === 'string') {
                        textPart.text = textPart.text.substring(0, textPart.text.length - excesso - 100) + '... [CORTADO]';
                    }
                }

                totalChars = 0;
                messages.forEach(msg => {
                    if (typeof msg.content === 'string') totalChars += msg.content.length;
                    else if (Array.isArray(msg.content)) {
                        msg.content.forEach(part => {
                            if (part.type === 'text' && part.text) totalChars += part.text.length;
                            if (part.type === 'image_url') totalChars += 1000;
                        });
                    }
                });
            }

            console.log(`📊 Payload: ~${Math.ceil(totalChars / 4)} tokens (${totalChars} chars) → ${providerName}/${modelToUse}`);

            const response = await aiClient.post('/chat/completions', {
                ...defaultOptions,
                model: modelToUse,
                messages: messages
            });

            const completion = response.data;
            const resposta = completion.choices[0]?.message?.content;
            if (!resposta) {
                throw new Error('Resposta vazia do modelo');
            }

            // Log de uso (pra monitorar custos do DeepSeek)
            if (completion.usage) {
                const u = completion.usage;
                console.log(`💰 Uso: ${u.prompt_tokens} prompt + ${u.completion_tokens} resposta = ${u.total_tokens} tokens`);
            }

            return filtrarPensamentos(resposta);

        } catch (error) {
            const status = error.response?.status;
            if ((status === 429 || status === 503 || error.code === 'ECONNABORTED') && tentativa < MAX_RETRIES) {
                const delay = DELAY_BASE * Math.pow(2, tentativa - 1);
                console.log(`\n⚠️ Erro transiente (${status || error.code}), retry em ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return processarMensagemMultimodal(parts, historico, tentativa + 1);
            }
            throw error;
        }

    } catch (error) {
        console.error(`\n❌ Erro ${providerName}:`, error?.message || error);
        if (error.response) {
            console.error('Dados:', JSON.stringify(error.response.data, null, 2));
        }
        return "❌ Desculpe, estou com dificuldades no momento. Tente novamente em alguns segundos.";
    }
}

/**
 * Formata resposta usando a API configurada
 */
async function processarComGroq(parts, tentativa = 1) {
    const MAX_RETRIES = 3;
    const DELAY_BASE = 2000;

    try {
        console.log(`\n💬 Formatação com ${providerName}... (tentativa ${tentativa}/${MAX_RETRIES})`);
        const promptAtual = parts.map(part => part.text || '').join('\n');

        try {
            const response = await aiClient.post('/chat/completions', {
                ...defaultOptions,
                messages: [
                    {
                        role: 'system',
                        content: `Assistente de formatação. Português do Brasil. Claro e objetivo. Sem tags de pensamento.`
                    },
                    { role: 'user', content: promptAtual }
                ]
            });

            const resposta = response.data.choices[0]?.message?.content;
            if (!resposta) throw new Error('Resposta vazia');
            return filtrarPensamentos(resposta);

        } catch (error) {
            const status = error.response?.status;
            if ((status === 429 || status === 503 || error.code === 'ECONNABORTED') && tentativa < MAX_RETRIES) {
                console.log(`\n⚠️ Erro transiente (${status || error.code}), retry...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BASE * tentativa));
                return processarComGroq(parts, tentativa + 1);
            }
            throw error;
        }

    } catch (error) {
        console.error(`\n❌ Erro formatação ${providerName}:`, error.message);
        return '❌ Erro ao formatar resposta.';
    }
}

module.exports = {
    processarMensagemMultimodal,
    filtrarPensamentos,
    processarComGroq
};