/**
 * Geração de imagens com IA usando Pollinations.AI
 * - Gratuito e ilimitado
 * - Suporte a múltiplos modelos (flux, flux-realism, flux-anime, turbo)
 * - Dimensões personalizáveis
 */

const path = require('path');
const fs = require('fs');
const axios = require('axios');

/**
 * Aprimora prompt e escolhe o melhor modelo usando Gemini
 * @param {string} promptOriginal - Prompt em português do usuário
 * @returns {Promise<{prompt: string, model: string}>}
 */
async function aprimorarPromptComGemini(promptOriginal) {
    try {
        // Importa dinamicamente para evitar dependência circular
        const { processarMensagemMultimodal } = require('./groq');
        
        const instrucao = [{
            text: `Você é um especialista em prompts e modelos de geração de imagem AI.

TAREFA: Analise o pedido do usuário e retorne:
1. O prompt OTIMIZADO em INGLÊS
2. O MELHOR MODELO para gerar essa imagem

PROMPT DO USUÁRIO:
"${promptOriginal}"

MODELOS DISPONÍVEIS:
- flux: Melhor qualidade geral, versátil (padrão)
- flux-realism: Fotos ultra-realistas, pessoas, cenas reais
- flux-anime: Estilo anime, mangá, desenhos japoneses
- flux-3d: Renderizações 3D, CGI, objetos tridimensionais
- turbo: Rápido, ilustrações simples, ícones

FORMATO DE RESPOSTA (retorne EXATAMENTE nestas 2 linhas):
PROMPT: [seu prompt otimizado em inglês com detalhes de estilo, qualidade, iluminação e composição]
MODEL: [flux | flux-realism | flux-anime | flux-3d | turbo]

EXEMPLOS:

Entrada: "bispo com coroinhas"
Saída:
PROMPT: A Catholic bishop in ornate liturgical vestments standing with altar servers in white robes, inside a grand cathedral with stained glass windows, soft natural lighting, photorealistic, high detail, 8k, reverent atmosphere, cinematic composition
MODEL: flux-realism

Entrada: "desenho anime de um anjo"
Saída:
PROMPT: Beautiful anime style angel with flowing white robes and golden wings, ethereal glow, soft pastel colors, detailed anime eyes, clean lines, vibrant colors, studio quality
MODEL: flux-anime

Entrada: "logo minimalista para igreja"
Saída:
PROMPT: Minimalist church logo design with simple cross icon, clean geometric shapes, modern, professional, black and white, vector style, flat design
MODEL: turbo

Agora analise e retorne:`
        }];
        
        const respostaGroq = await processarMensagemMultimodal(instrucao, []);
        
        // Parse da resposta
        const linhas = respostaGroq.split('\n').filter(l => l.trim());
        let prompt = promptOriginal;
        let model = 'flux';
        
        for (const linha of linhas) {
            if (linha.startsWith('PROMPT:')) {
                prompt = linha.replace('PROMPT:', '').trim();
            } else if (linha.startsWith('MODEL:')) {
                const modelStr = linha.replace('MODEL:', '').trim().toLowerCase();
                if (['flux', 'flux-realism', 'flux-anime', 'flux-3d', 'turbo'].includes(modelStr)) {
                    model = modelStr;
                }
            }
        }
        
        console.log('✨ Prompt aprimorado:', prompt);
        console.log('🤖 Modelo escolhido:', model);
        
        return { prompt, model };
    } catch (err) {
        console.error('Erro ao aprimorar prompt com Groq:', err);
        // Fallback
        return { prompt: promptOriginal, model: 'flux' };
    }
}

/**
 * Extrai dimensões do prompt do usuário no formato 512x768, largura x altura.
 * Remove as dimensões do texto retornado para não poluir o prompt do gerador.
 */
function clamp(value, min, max, def) {
    if (value === undefined || value === null || isNaN(value)) return def;
    return Math.min(max, Math.max(min, value));
}

// Mapeamento aspect ratio -> dimensões default (se width/height não informados), seguindo tabela Gemini
const ASPECT_RATIO_MAP = {
    '1:1': { width: 1024, height: 1024 },
    '2:3': { width: 832, height: 1248 },
    '3:2': { width: 1248, height: 832 },
    '3:4': { width: 864, height: 1184 },
    '4:3': { width: 1184, height: 864 },
    '4:5': { width: 896, height: 1152 },
    '5:4': { width: 1152, height: 896 },
    '9:16': { width: 768, height: 1344 },
    '16:9': { width: 1344, height: 768 },
    '21:9': { width: 1536, height: 672 }
};

// Mapeamento de aspect ratios para dimensões
const ASPECT_RATIO_TO_DIMENSIONS = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1344, height: 768 },
    '9:16': { width: 768, height: 1344 },
    '4:3': { width: 1184, height: 864 },
    '3:4': { width: 864, height: 1184 },
    '21:9': { width: 1536, height: 672 },
    '3:2': { width: 1248, height: 832 },
    '2:3': { width: 832, height: 1248 }
};

/**
 * Extrai parâmetros avançados do prompt
 * Suportado: aspect ratio, dimensões (WxH), enviar como documento
 */
function extrairParametros(promptPT) {
    let cleaned = promptPT;
    let width = 1024, height = 1024;
    let sendAsDocument = false;

    // Verifica se quer enviar EXPLICITAMENTE como documento
    const docMatch = cleaned.match(/\b(como documento|documento|doc|enviar como documento)\b/i);
    if (docMatch) {
        sendAsDocument = true;
        cleaned = cleaned.replace(docMatch[0], '').trim();
    }

    // Aspect ratio
    const arMatch = cleaned.match(/\b(1:1|2:3|3:2|3:4|4:3|9:16|16:9|21:9)\b/);
    if (arMatch) {
        const ratio = arMatch[1];
        const dims = ASPECT_RATIO_TO_DIMENSIONS[ratio];
        if (dims) {
            width = dims.width;
            height = dims.height;
        }
        cleaned = cleaned.replace(arMatch[0], '').trim();
    }

    // Dimensões explícitas (ex: 512x768)
    const dimMatch = cleaned.match(/(\d{3,4})\s*[xX]\s*(\d{3,4})/);
    if (dimMatch) {
        width = Math.min(2048, Math.max(256, parseInt(dimMatch[1], 10)));
        height = Math.min(2048, Math.max(256, parseInt(dimMatch[2], 10)));
        cleaned = cleaned.replace(dimMatch[0], '').trim();
    }

    // Limpa múltiplos espaços
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

    return { cleaned, width, height, sendAsDocument };
}

/**
 * Gera imagem usando Pollinations.AI
 * API: https://image.pollinations.ai/prompt/{prompt}?width={w}&height={h}&model={model}&seed={seed}
 */
async function gerarImagemPollinations(promptOriginal) {
    try {
        console.log('🚀 Iniciando geração com Pollinations.AI...');
        const params = extrairParametros(promptOriginal);
        
        // Aprimora prompt e escolhe modelo com Groq
        const { prompt, model } = await aprimorarPromptComGemini(params.cleaned);
        
        console.log(`📐 Dimensões: ${params.width}x${params.height}`);
        console.log(`🎨 Modelo: ${model}`);
        if (params.sendAsDocument) {
            console.log('📄 Envio como documento solicitado explicitamente');
        } else {
            console.log('📸 Envio em HD (qualidade máxima do WhatsApp)');
        }
        
        // Encode do prompt para URL
        const encodedPrompt = encodeURIComponent(prompt);
        
        // Monta a URL da API
        const seed = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${params.width}&height=${params.height}&model=${model}&seed=${seed}&nologo=true&enhance=true`;
        
        console.log('📥 Baixando imagem...');
        
        // Baixa a imagem
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 60000 // 60s timeout
        });
        
        // Salva a imagem
        const buffer = Buffer.from(response.data);
        const tempDir = path.join(process.cwd(), 'temp_images');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const filename = `pollinations_${Date.now()}.png`;
        const imagePath = path.join(tempDir, filename);
        fs.writeFileSync(imagePath, buffer);
        
        console.log('✅ Imagem gerada com sucesso!', imagePath);
        
        return {
            text: `🎨 Imagem gerada (${params.width}x${params.height}, ${model})`,
            imagePath,
            sendAsDocument: params.sendAsDocument
        };
        
    } catch (err) {
        console.error('Erro ao gerar imagem com Pollinations:', err?.message || err);
        return { 
            text: `❌ Erro ao gerar imagem: ${err.message || 'Erro desconhecido'}`, 
            imagePath: null,
            sendAsDocument: false
        };
    }
}

async function processarComandoImagem(comandoCompleto) {
    console.log('\n🎨 processarComandoImagem (Pollinations.AI) chamado com:', comandoCompleto);
    const prompt = (comandoCompleto || '').replace(/^\/imagem\s*/i, '').trim();
    if (!prompt) {
        return { text: '❓ Recebi o comando para gerar imagem, mas sem a descrição. Poderia tentar novamente?', imagePath: null };
    }
    // Gera imagem com Pollinations.AI
    const resultado = await gerarImagemPollinations(prompt);
    return resultado;
}

module.exports = { processarComandoImagem };
