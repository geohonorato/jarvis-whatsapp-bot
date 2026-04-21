require("dotenv").config();
const axios = require("axios");
const https = require("https");
const { gerarSystemMessage, obterDataHoraAtual } = require('../../config/system-prompt');

// Chave da API Groq do .env
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
    console.error("❌ Chave da API Groq (GROQ_API_KEY) não encontrada no .env");
    process.exit(1);
}

// Cliente HTTP para Groq com Keep-Alive e Timeout
const groqClient = axios.create({
    baseURL: 'https://api.groq.com/openai/v1',
    timeout: 60000, // 60 segundos
    headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
    },
    httpsAgent: new https.Agent({ keepAlive: true })
});

// Configurações do modelo
const defaultOptions = {
    model: "deepseek-r1-distill-llama-70b", // Agora estamos oficialmente injetando o raciocínio r1 do DeepSeek pela Groq
    temperature: 0.6,
    max_tokens: 8192,
    top_p: 1,
    stop: null
};

// Prepara o histórico no formato aceito pela Groq
function formatarHistoricoParaGroq(historico) {
    if (!historico) return [];

    // Mapeia o histórico para o formato de mensagens
    return historico.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.parts.map(part => {
            if (part.text) return { type: 'text', text: part.text };
            if (part.inlineData) {
                const mimeType = part.inlineData.mimeType || 'image/jpeg';
                // Para não estourar o limite de histórico com base64 antigos, deixamos um placeholder
                // no histórico e só processamos a imagem da mensagem *atual*.
                return { type: 'text', text: '[Imagem enviada anteriormente]' };
            }
            return { type: 'text', text: '' };
        })
    }));
}

/**
 * Remove a tag <think> e seu conteúdo do texto
 * @param {string} texto - Texto a ser filtrado
 * @returns {string} Texto sem as tags de pensamento
 */
function filtrarPensamentos(texto) {
    if (!texto) return texto;
    return texto.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/**
 * Processa uma mensagem com possível conteúdo multimodal (texto + imagens)
 * @param {Array} parts - Array de partes da mensagem (texto/imagens)
 * @param {Array} historico - Histórico de mensagens anteriores
 * @returns {Promise<string>} Resposta processada
 */
async function processarMensagemMultimodal(parts, historico = [], tentativa = 1) {
    const MAX_RETRIES = 3;
    const DELAY_BASE = 2000; // 2 segundos

    try {
        console.log(`\n🧠 Processando entrada com Groq... (tentativa ${tentativa}/${MAX_RETRIES})`);

        // Prepara o histórico
        const historicoGroq = formatarHistoricoParaGroq(historico);

        // Prepara o contexto atual
        const { dataFormatada, horaFormatada, diaSemana } = obterDataHoraAtual();
        const contextoAtual = `Hoje é ${diaSemana}, ${dataFormatada} às ${horaFormatada}\n\n`;

        const temImagem = parts.some(part => part.inlineData != null);

        // Se tiver imagem, OBRIGATORIAMENTE usamos o modelo LLaMA Vision (Free Tier - 11B)
        const modelToUse = temImagem ? 'llama-3.2-11b-vision-preview' : defaultOptions.model;

        // Monta o prompt atual combinando as partes no formato array da V1 OpenAI
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
            // Configura a chamada para a API da Groq
            // Usamos o system prompt unificado
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
                        if (part.type === 'image_url') totalChars += 1000; // Custo fixo base aproximado para img
                    });
                }
            });

            // Limitador Dinâmico Inteligente para evitar erro 413 (Rate Limit - Message Size Too Large)
            // O modelo Groq gpt-oss-120b grátis tem limite de 8000 Tokens (aproximadamente 32.000 caracteres)
            // Vamos fixar um limite de segurança em ~24.000 caracteres (6000 tokens)
            const MAX_CHARS = 24000;

            // Loop 1: Remover o histórico de conversa aos poucos (mantendo System Prompt e a Pergunta Atual)
            while (totalChars > MAX_CHARS && messages.length > 2) {
                const removido = messages.splice(1, 1)[0]; // Remove o índice 1 (a mensagem mais velha do usuário/bot)
                if (typeof removido.content === 'string') {
                    totalChars -= removido.content.length;
                } else if (Array.isArray(removido.content)) {
                    removido.content.forEach(part => {
                        if (part.type === 'text' && part.text) totalChars -= part.text.length;
                        if (part.type === 'image_url') totalChars -= 1000;
                    });
                }
            }

            // Loop 2: Se ainda for maior que o limite após deletar todo o histórico, corta o contexto RAG final na brutalidade
            if (totalChars > MAX_CHARS) {
                console.warn(`⚠️ Aviso: Mesmo sem histórico, conteúdo gigantesco detectado: ${totalChars} caracteres. Aparando prompt principal.`);
                const excesso = totalChars - MAX_CHARS;

                // Só apara se a última mensagem for puro texto e não tiver array
                const lastMsg = messages[messages.length - 1];
                if (typeof lastMsg.content === 'string') {
                    lastMsg.content = lastMsg.content.substring(0, lastMsg.content.length - excesso - 100) + '... [CORTADO PELO LIMITE DE MEMÓRIA DA IA]';
                } else if (Array.isArray(lastMsg.content)) {
                    const textPart = lastMsg.content.find(p => p.type === 'text');
                    if (textPart && typeof textPart.text === 'string') {
                        textPart.text = textPart.text.substring(0, textPart.text.length - excesso - 100) + '... [CORTADO]';
                    }
                }

                // Recalcula final
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

            console.log(`📊 Estimativa de Payload Final: ~${Math.ceil(totalChars / 4)} tokens (${totalChars} chars)`);

            const response = await groqClient.post('/chat/completions', {
                ...defaultOptions,
                model: modelToUse,
                messages: messages
            });

            const completion = response.data;

            // Extrai e retorna o texto da resposta
            const resposta = completion.choices[0]?.message?.content;
            if (!resposta) {
                throw new Error('Resposta vazia do modelo');
            }

            return filtrarPensamentos(resposta);

        } catch (error) {
            // Tratamento específico para erros da API
            const status = error.response?.status;

            // Se for erro de Rate Limit (429), API Overloaded (503) ou Timeout
            if ((status === 429 || status === 503 || error.code === 'ECONNABORTED') && tentativa < MAX_RETRIES) {
                // Backoff Exponencial: 2s, 4s, 8s...
                const delay = DELAY_BASE * Math.pow(2, tentativa - 1);
                console.log(`\n⚠️ Erro transiente (${status || error.code}), tentando novamente em ${delay / 1000}s...`);

                await new Promise(resolve => setTimeout(resolve, delay));
                return processarMensagemMultimodal(parts, historico, tentativa + 1);
            }
            throw error;
        }

    } catch (error) {
        console.error('\n❌ Erro ao processar mensagem Groq:', error?.message || error);
        if (error.response) {
            console.error('Dados do Erro:', JSON.stringify(error.response.data, null, 2));
        }
        return "❌ Desculpe, estou com dificuldades de conexão no momento. Tente novamente em alguns segundos.";
    }
}

/**
 * Formata resposta de hidratação usando Groq
 * @param {Array} parts - Array com instruções de formatação
 * @returns {Promise<string>} Resposta formatada
 */
async function processarComGroq(parts, tentativa = 1) {
    const MAX_RETRIES = 3;
    const DELAY_BASE = 2000;

    try {
        console.log(`\n💬 Processando formatação com Groq... (tentativa ${tentativa}/${MAX_RETRIES})`);

        const promptAtual = parts.map(part => part.text || '').join('\n');

        try {
            const response = await groqClient.post('/chat/completions', {
                ...defaultOptions,
                messages: [
                    {
                        role: 'system',
                        content: `Você é um assistente especialista em formatação de mensagens. Responda SEMPRE em português do Brasil com emojis quando apropriado. Seja claro, objetivo e útil. Nunca inclua explicações técnicas ou tags de pensamento.`
                    },
                    { role: 'user', content: promptAtual }
                ]
            });

            const resposta = response.data.choices[0]?.message?.content;
            if (!resposta) {
                throw new Error('Resposta vazia do modelo');
            }

            return filtrarPensamentos(resposta);

        } catch (error) {
            const status = error.response?.status;
            if ((status === 429 || status === 503 || error.code === 'ECONNABORTED') && tentativa < MAX_RETRIES) {
                console.log(`\n⚠️ Erro transiente (${status || error.code}), tentando novamente em ${DELAY_BASE * tentativa}ms...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BASE * tentativa));
                return processarComGroq(parts, tentativa + 1);
            }
            throw error;
        }

    } catch (error) {
        console.error('\n❌ Erro ao processar formatação com Groq:', error.message);
        return '❌ Erro ao tentar formatar a resposta.';
    }
}

module.exports = {
    processarMensagemMultimodal,
    filtrarPensamentos,
    processarComGroq
};