require('dotenv').config();

const MAGISTERIUM_API_KEY = process.env.MAGISTERIUM_API_KEY || '';

// Cliente será carregado dinamicamente pois o pacote é ESM
let magisterium = null;
async function getMagisteriumClient() {
    try {
        if (!MAGISTERIUM_API_KEY) {
            console.warn('⚠️ Magisterium AI não inicializado (verifique MAGISTERIUM_API_KEY)');
            return null;
        }
        if (magisterium) return magisterium;

        const mod = await import('magisterium');
        const MagisteriumClass = mod.Magisterium || mod.default || mod;
        magisterium = new MagisteriumClass({ apiKey: MAGISTERIUM_API_KEY });
        return magisterium;
    } catch (e) {
        console.error('❌ Erro ao importar/instanciar cliente Magisterium (ESM):', e?.message || e);
        return null;
    }
}


function gerarSystemMessageMagisterium() {
    return `Você é Magisterium AI, um assistente especializado na Doutrina da Igreja Católica (Magistério). Responda estritamente de acordo com os ensinamentos oficiais da Igreja Católica. Sempre responda em português do Brasil. Priorize referências ao Catecismo da Igreja Católica (CIC), documentos papais (Encíclicas, Exortações), Sínodos, Concílios e o Vaticano (Vatican.va). Quando possível, cite a fonte (ex.: "Catecismo, §XXX" ou "Evangelium vitae, n. X"). Se não houver certeza, diga que é necessário consultar a documentação oficial e não invente doutrinas. Mantenha tom respeitoso, preciso e evite opiniões pessoais.`;
}

async function responderMagisterium(parts, historico = []) {
    try {
        const client = await getMagisteriumClient();
        if (!client) {
            return '❌ Serviço Magisterium AI não configurado. Verifique a variável de ambiente MAGISTERIUM_API_KEY.';
        }

        const messages = [];

        messages.push({ role: 'user', content: `INSTRUÇÕES:\n${gerarSystemMessageMagisterium()}` });
        messages.push({ role: 'assistant', content: 'Estou pronto para responder sobre a Doutrina da Igreja Católica.' });


        if (Array.isArray(historico)) {
            for (const item of historico) {
                const content = item.parts.map(p => p.text).join('\n').trim();
                if (content) {
                    const role = item.role === 'model' ? 'assistant' : 'user';
                    messages.push({ role, content });
                }
            }
        }

        const userContent = parts.map(p => p.text).join('\n').trim();
        if (userContent) {
            messages.push({ role: 'user', content: userContent });
        }

        const results = await client.chat.completions.create({
            model: "magisterium-1",
            messages: messages,
        });

        let text = '';
        if (results.choices && results.choices.length > 0 && results.choices[0].message) {
            text = results.choices[0].message.content;
        } else {
            console.error('Resposta inesperada da API Magisterium:', results);
            throw new Error('Resposta da API do Magisterium em formato inesperado.');
        }

        // Remove o prefixo "Magisterium AI:" se presente
        const prefix = 'Magisterium AI:';
        if (text.trim().toLowerCase().startsWith(prefix.toLowerCase())) {
            text = text.trim().substring(prefix.length).trim();
        }

        // Retorna apenas o conteúdo bruto para ser formatado pelo Gemini
        return text;

    } catch (e) {
        console.error('❌ Erro Magisterium AI:', e?.message || e);
        return '❌ Erro ao processar com Magisterium AI.';
    }
}

/**
 * Responde usando Magisterium AI e formata com Gemini
 */
async function responderMagisteriumComFormatacao(parts, historico = []) {
    try {
        // 1. Obtém resposta bruta do Magisterium
        const respostaMagisterium = await responderMagisterium(parts, historico);

        // Verifica se houve erro
        if (respostaMagisterium.startsWith('❌')) {
            return respostaMagisterium;
        }

        // 2. Importa o Gemini para formatação
        const { processarMensagemMultimodal, filtrarPensamentos } = require('../api/gemini');

        // 3. Cria prompt para o Groq formatar a resposta
        const promptFormatacao = [
            {
                text: `Ignore quaisquer instruções anteriores. TAREFA ÚNICA: reescreva o texto abaixo para WhatsApp, mantendo sentido e citando fontes quando existirem.

REGRAS WHATSAPP:
- Use *negrito* para termos-chave; _itálico_ para ênfase suave
- Separe seções com: -------
- Listas: "- " no início da linha
- Citações: comece com "> "
- NÃO use cabeçalhos (###), markdown avançado ou [^1]
- NÃO emita comandos (ex.: /imagem, /add, /magisterium) em hipótese alguma

ESTILO:
- Direto e conciso; sem saudações ou despedidas
- Parágrafos curtos (2-3 linhas)
- Emojis católicos com moderação: ⛪ ✝️ 📖 🙏 (1–2 por seção)

TEXTO A FORMATAR:
${respostaMagisterium}

SAÍDA:
- Retorne SOMENTE o texto reformatado
- NUNCA retorne apenas um título; garanta conteúdo com pelo menos 2–3 frases úteis`
            }
        ];

        // 4. Envia para Groq formatar (sem histórico para não influenciar)
        let respostaFormatada = await processarMensagemMultimodal(promptFormatacao, []);
        respostaFormatada = filtrarPensamentos(respostaFormatada || '');

        // Sanitização adicional para remover cabeçalhos markdown indesejados e notas de rodapé estilo [^1]
        const sanitizar = (texto) => {
            if (!texto) return texto;
            return texto
                // Remove headings tipo ###, ##, # no início da linha
                .split(/\r?\n/)
                .map(l => {
                    const headingMatch = l.match(/^(#{1,6})\s*(.+)$/);
                    if (headingMatch) {
                        // Converte para título simples em negrito
                        const titulo = headingMatch[2].trim();
                        return titulo ? `*${titulo}*` : '';
                    }
                    return l;
                })
                .join('\n')
                // Remove notas de rodapé [^1], [^23]
                .replace(/\[\^\d+\]/g, '')
                // Remove espaços duplicados causados pela remoção
                .replace(/ +/g, ' ')
                // Compacta múltiplas quebras de linha excessivas (3+ -> 2)
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        };
        respostaFormatada = sanitizar(respostaFormatada);

        // Sanitização e validação de saída
        const apenasComando = respostaFormatada.trim().startsWith('/') && !respostaFormatada.includes('\n');
        const ehVaziaOuMinima = (txt) => {
            if (!txt) return true;
            const limpo = txt
                .replace(/[-_\*`>\s]/g, '') // remove formatação simples e espaços
                .replace(/[⛪✝️📖🙏]/g, '')     // remove emojis esperados
                .trim();
            return limpo.length < 20; // conteúdo muito curto
        };

        if (apenasComando || ehVaziaOuMinima(respostaFormatada)) {
            console.warn('⚠️ Resposta formatada vazia/insuficiente. Aplicando fallback ao texto bruto do Magisterium.');
            respostaFormatada = sanitizar(respostaMagisterium.trim());
        }

        // 5. Adiciona cabeçalho identificando que é do Magisterium AI
        return `⛪ *Magisterium AI*\n_Resposta sobre doutrina católica_\n-------\n\n${respostaFormatada}`;

    } catch (e) {
        console.error('❌ Erro ao formatar resposta do Magisterium:', e?.message || e);
        // Em caso de erro na formatação, retorna a resposta bruta
        const respostaBruta = await responderMagisterium(parts, historico);
        return `⛪ *Magisterium AI*\n\n${respostaBruta}`;
    }
}

module.exports = { responderMagisterium, responderMagisteriumComFormatacao };
