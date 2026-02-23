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
    model: "openai/gpt-oss-120b", // GPT OSS 120B - melhor raciocínio para datas e cálculos
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
        content: msg.parts
            .map(part => {
                if (part.text) return part.text;
                if (part.inlineData) return '[Imagem anexada]';
                return '';
            })
            .join('\n')
            .trim()
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

        // Monta o prompt atual combinando as partes
        const promptAtual = parts.map(part => {
            if (part.text) return part.text;
            if (part.inlineData) return '[Imagem anexada]';
            return '';
        }).join('\n');

        try {
            // Configura a chamada para a API da Groq
            // Usamos o system prompt unificado
            const messages = [
                { role: 'system', content: gerarSystemMessage() },
                ...historicoGroq,
                { role: 'user', content: contextoAtual + promptAtual }
            ];

            // Estimativa de tokens (1 token ~= 4 chars)
            const totalChars = messages.reduce((acc, msg) => acc + (msg.content?.length || 0), 0);
            console.log(`📊 Estimativa de Payload: ~${Math.ceil(totalChars / 4)} tokens`);

            const response = await groqClient.post('/chat/completions', {
                ...defaultOptions,
                messages
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