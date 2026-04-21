/**
 * Geração de imagens com IA
 * Cascata: Flux-2-Klein-9b → Flux-1-Schnell → Nano Banana
 */

const path = require('path');
const fs = require('fs');
const axios = require('axios');

// ===== Cloudflare Workers AI =====
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_MODEL_PRIMARY = '@cf/black-forest-labs/flux-2-klein-9b';
const CF_MODEL_FALLBACK = '@cf/black-forest-labs/flux-1-schnell';

// ===== Nano Banana (Google Gemini) =====
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const NANO_BANANA_PRO = 'gemini-3-pro-image-preview';
const NANO_BANANA = 'gemini-2.5-flash-image';

// Aspect ratios suportados
const SUPPORTED_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

// Mapeamento de ratio para dimensões (Cloudflare usa width/height)
const RATIO_TO_DIMS = {
    '1:1': { width: 1024, height: 1024 },
    '2:3': { width: 832, height: 1248 },
    '3:2': { width: 1248, height: 832 },
    '3:4': { width: 896, height: 1152 },
    '4:3': { width: 1152, height: 896 },
    '4:5': { width: 896, height: 1120 },
    '5:4': { width: 1120, height: 896 },
    '9:16': { width: 768, height: 1344 },
    '16:9': { width: 1344, height: 768 },
    '21:9': { width: 1536, height: 640 },
};

/**
 * Aprimora prompt usando Groq (traduz PT→EN e enriquece)
 */
async function aprimorarPromptComGroq(promptOriginal) {
    try {
        const { processarMensagemMultimodal } = require('./gemini');

        const instrucao = [{
            text: `You are an expert AI image prompt engineer.

TASK: Translate and enhance the user's request into a DETAILED, SAFE English prompt for image generation.

USER'S REQUEST:
"${promptOriginal}"

RULES:
- Translate to English
- Add quality details: lighting, composition, atmosphere, textures
- Keep the ORIGINAL style intent (don't force realism if they asked for anime, etc.)
- Be descriptive but concise (max 200 words)
- Return ONLY the prompt, no explanations

SAFETY RULES (CRITICAL — the image will be rejected if violated):
- NEVER include words like "sexy", "naked", "nude", "erotic", "blood", "gore", "violent", "kill", "weapon", "gun", "drug"
- Avoid ambiguous terms that could be interpreted as NSFW (e.g. use "elegant" instead of "seductive")
- For people: describe them fully clothed, in natural/professional settings
- For animals: focus on majestic/natural descriptions, avoid aggressive poses
- For vehicles/objects: describe them in scenic, well-lit environments
- When in doubt, use more neutral, descriptive, artistic language
- Focus on artistic quality: photography style, lighting, composition, color palette

FORMAT (single line):
PROMPT: [your optimized, safe English prompt]`
        }];

        const respostaGroq = await processarMensagemMultimodal(instrucao, []);

        const linhas = respostaGroq.split('\n').filter(l => l.trim());
        for (const linha of linhas) {
            if (linha.startsWith('PROMPT:')) {
                const prompt = linha.replace('PROMPT:', '').trim();
                console.log('✨ Prompt aprimorado:', prompt);
                return prompt;
            }
        }

        return promptOriginal;
    } catch (err) {
        console.error('Erro ao aprimorar prompt com Groq:', err.message);
        return promptOriginal;
    }
}

/**
 * Extrai parâmetros (aspect ratio) do prompt em PT
 */
function extrairParametros(promptPT) {
    let cleaned = promptPT;
    let aspectRatio = '1:1';

    const arMatch = cleaned.match(/\b(1:1|2:3|3:2|3:4|4:3|4:5|5:4|9:16|16:9|21:9)\b/);
    if (arMatch) {
        aspectRatio = arMatch[1];
        cleaned = cleaned.replace(arMatch[0], '').trim();
    }

    cleaned = cleaned.replace(/\b(4k|4 k|uhd|alta resolu[cç][aã]o|hd|full hd)\b/gi, '').trim();
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

    return { cleaned, aspectRatio };
}

// ==========================================
//  PROVIDER 1: Cloudflare Workers AI (Flux)
// ==========================================

/**
 * Gera imagem via Cloudflare Workers AI
 * flux-2-dev: multipart/form-data
 * flux-1-schnell: application/json
 */
async function gerarImagemCloudflare(model, promptEN, aspectRatio) {
    if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
        throw new Error('CF_ACCOUNT_ID ou CF_API_TOKEN não configurados no .env');
    }

    const dims = RATIO_TO_DIMS[aspectRatio] || RATIO_TO_DIMS['1:1'];
    const modelName = model.split('/').pop();
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${model}`;
    const isFlux2 = model.includes('flux-2');

    console.log(`☁️ Chamando Cloudflare ${modelName} (${dims.width}x${dims.height}, format=${isFlux2 ? 'multipart' : 'json'})...`);

    let response;

    if (isFlux2) {
        // Flux-2 exige multipart/form-data
        const FormData = require('form-data');
        const form = new FormData();
        form.append('prompt', promptEN);
        form.append('width', String(dims.width));
        form.append('height', String(dims.height));

        response = await axios.post(url, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${CF_API_TOKEN}`,
            },
            timeout: 120000
        });
    } else {
        // Flux-1 usa JSON
        response = await axios.post(url, {
            prompt: promptEN,
            width: dims.width,
            height: dims.height,
        }, {
            headers: {
                'Authorization': `Bearer ${CF_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            timeout: 120000
        });
    }

    const data = response.data;

    if (!data.success || !data.result?.image) {
        const errMsg = data.errors?.[0]?.message || 'Resposta sem imagem';
        throw new Error(`Cloudflare erro: ${errMsg}`);
    }

    const buffer = Buffer.from(data.result.image, 'base64');
    console.log(`✅ Cloudflare ${modelName}: imagem recebida (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    return buffer;
}

// ==========================================
//  PROVIDER 2: Nano Banana (Google Gemini)
// ==========================================

/**
 * Chama a API REST do Gemini para gerar imagem
 */
async function chamarGeminiImageAPI(model, prompt, aspectRatio, imageSize) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY não configurada no .env');
    }

    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseModalities: ['Image'],
            imageConfig: { aspectRatio }
        }
    };

    if (imageSize && model === NANO_BANANA_PRO) {
        requestBody.generationConfig.imageConfig.imageSize = imageSize;
    }

    console.log(`🍌 Chamando ${model} (ratio=${aspectRatio}, size=${imageSize || '1K'})...`);

    const response = await axios.post(url, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000
    });

    const data = response.data;

    if (data.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error('Imagem bloqueada por filtro de segurança do Google');
    }

    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts) throw new Error('Resposta sem conteúdo do modelo');

    for (const part of parts) {
        if (part.inlineData) {
            const buffer = Buffer.from(part.inlineData.data, 'base64');
            console.log(`✅ Gemini: imagem recebida (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
            return buffer;
        }
    }

    throw new Error('Resposta sem dados de imagem');
}

// ==========================================
//  ORQUESTRADOR: Cloudflare → Nano Banana
// ==========================================

/**
 * Gera imagem com fallback em cascata:
 * 1. Cloudflare Flux-2-Dev (melhor qualidade)
 * 2. Cloudflare Flux-1-Schnell (rápido, gratuito)
 * 3. Nano Banana (Google Gemini, se billing ativo)
 */
async function gerarImagem(promptOriginal) {
    const params = extrairParametros(promptOriginal);
    const promptEN = await aprimorarPromptComGroq(params.cleaned);

    console.log(`📐 Aspect Ratio: ${params.aspectRatio}`);

    let buffer;
    let modelUsado;

    // 1. Tenta Cloudflare Flux-2-Dev (melhor qualidade)
    if (CF_ACCOUNT_ID && CF_API_TOKEN) {
        try {
            buffer = await gerarImagemCloudflare(CF_MODEL_PRIMARY, promptEN, params.aspectRatio);
            modelUsado = 'Flux-2-Dev';
        } catch (cfErr) {
            const cfMsg = cfErr.response?.data?.errors?.[0]?.message || cfErr.message;
            console.warn(`⚠️ Flux-2-Dev falhou: ${cfMsg}`);

            // 2. Fallback: Flux-1-Schnell (rápido)
            try {
                console.log('🔄 Fallback para Flux-1-Schnell...');
                buffer = await gerarImagemCloudflare(CF_MODEL_FALLBACK, promptEN, params.aspectRatio);
                modelUsado = 'Flux-1-Schnell';
            } catch (cf2Err) {
                const cf2Msg = cf2Err.response?.data?.errors?.[0]?.message || cf2Err.message;
                console.warn(`⚠️ Flux-1-Schnell também falhou: ${cf2Msg}`);
            }
        }
    }

    // 3. Fallback final: Nano Banana (Google Gemini)
    if (!buffer && GEMINI_API_KEY) {
        try {
            console.log('🔄 Fallback para Nano Banana (1K)...');
            buffer = await chamarGeminiImageAPI(NANO_BANANA, promptEN, params.aspectRatio, null);
            modelUsado = 'Nano Banana 1K';
        } catch (nbErr) {
            const nbMsg = nbErr.response?.data?.error?.message || nbErr.message;
            console.error(`❌ Nano Banana também falhou: ${nbMsg}`);
        }
    }

    if (!buffer) {
        throw new Error('Todos os provedores de imagem falharam. Verifique CF_ACCOUNT_ID/CF_API_TOKEN.');
    }

    // Salva localmente
    const tempDir = path.join(process.cwd(), 'data', 'temp_images');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const filename = `img_${Date.now()}.png`;
    const imagePath = path.join(tempDir, filename);
    fs.writeFileSync(imagePath, buffer);

    console.log('✅ Imagem salva:', imagePath);
    console.log(`📦 Tamanho: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

    return {
        text: `🎨 Imagem gerada com ${modelUsado} (${params.aspectRatio})`,
        imagePath,
        imageUrl: null,
        sendAsDocument: false
    };
}

/**
 * Processa comando /imagem
 */
async function processarComandoImagem(comandoCompleto) {
    console.log('\n🎨 processarComandoImagem chamado com:', comandoCompleto);
    const prompt = (comandoCompleto || '').replace(/^\/imagem\s*/i, '').trim();

    if (!prompt) {
        return { text: '❓ Recebi o comando para gerar imagem, mas sem a descrição. Poderia tentar novamente?', imagePath: null };
    }

    return await gerarImagem(prompt);
}

module.exports = { processarComandoImagem };
