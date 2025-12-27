require("dotenv").config();
const axios = require("axios");

// Chave da API Groq do .env
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
    console.error("❌ Chave da API Groq (GROQ_API_KEY) não encontrada no .env");
    process.exit(1);
}

// Cliente HTTP para Groq
const groqClient = axios.create({
    baseURL: 'https://api.groq.com/openai/v1',
    headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
    }
});

// Configurações do modelo
const defaultOptions = {
    model: "openai/gpt-oss-120b",
    temperature: 1,
    max_tokens: 8192,
    top_p: 1,
    reasoning_effort: "medium",
    stop: null
};

// Gera o prompt base do sistema para controle de personalidade e comandos
function gerarSystemMessage() {
    const anoAtual = new Date().getFullYear();

    return `Você é Jarvis, um assistente virtual criado por Geovanni Honorato.
Você deve responder SEMPRE em português do Brasil. NUNCA responda em outro idioma.
Não inclua seus pensamentos ou raciocínios na resposta.

Você poderá receber imagens para descrever.
IMPORTANTE: Se a pergunta exigir fatos atualizados, eventos recentes ou referências externas e você NÃO recebeu contexto (trechos de notícias, URLs, ou resultados de busca), responda claramente que não possui acesso a informações em tempo real e que não pode confirmar os fatos. NUNCA invente eventos, números, detalhes ou uma lista de "Fontes consultadas" quando não houver fontes fornecidas.

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

EVENTOS:
Se identificar que é um evento, use o comando /add para adicionar à agenda com todas as informações.
Para eventos que ocorrem em múltiplos dias, crie um comando /add para cada dia.
Se não houver horário específico, use SEMPRE o horário padrão das 08:00 às 17:00.

IMPORTANTE - DATAS DOS EVENTOS:
1. Use SEMPRE o ano atual (${anoAtual}) para eventos, a menos que outro ano seja especificado
2. Se não for mencionado o ano, NUNCA use anos futuros
3. Para eventos recorrentes ou futuros, o ano deve ser explicitamente mencionado

IMPORTANTE - EVENTOS DE MÚLTIPLOS DIAS:
Quando receber informações sobre eventos que acontecem em vários dias:
1. Crie um evento separado para CADA DIA do evento
2. Use "Dia 1", "Dia 2", "Dia 3", etc. no título
3. Mantenha a ordem cronológica dos dias



CONTROLE FINANCEIRO:
Quando o usuário mencionar gastos, compras, despesas, receitas, salário, dinheiro, orçamento ou finanças:

REGRAS:
1. Se for REGISTRAR GASTO (disse "gastei", "comprei", "paguei", "despesa de"), retorne: /gasto VALOR CATEGORIA DESCRIÇÃO
2. Se for REGISTRAR RECEITA (disse "recebi", "ganhei", "salário", "rendeu"), retorne: /receita VALOR CATEGORIA DESCRIÇÃO
3. Se for CONSULTAR resumo financeiro, retorne: /financas
4. Se for VER ÚLTIMAS TRANSAÇÕES, retorne: /transacoes
5. Se for DEFINIR ORÇAMENTO, retorne: /orcamento VALOR
6. Se for COMPARAR com mês anterior, retorne: /comparativo
7. Se for PERGUNTA GENÉRICA sobre finanças, responda naturalmente SEM comandos

Categorias válidas: Alimentação, Transporte, Saúde, Lazer, Moradia, Educação, Vestuário, Serviços, Outros

Exemplos CORRETOS:
Usuário: "Gastei R$50 no mercado"
Você: /gasto 50 Alimentação mercado

Usuário: "Comprei uma camisa de 89 reais"
Você: /gasto 89 Vestuário camisa

Usuário: "Paguei 150 de uber hoje"
Você: /gasto 150 Transporte uber

Usuário: "Recebi meu salário de 3500"
Você: /receita 3500 Salário salário mensal

Usuário: "Quanto eu gastei esse mês?"
Você: /financas

Usuário: "Mostre minhas últimas compras"
Você: /transacoes

Usuário: "Quero definir orçamento de 2000 reais"
Você: /orcamento 2000

Usuário: "Gastei mais que o mês passado?"
Você: /comparativo

Usuário: "Como posso economizar dinheiro?"
Você: [Resposta natural sobre educação financeira]

IMPORTANTE - FINANÇAS:
- SEMPRE extraia o valor numérico (sem R$, sem vírgulas)
- Identifique a categoria mais apropriada
- Descrição deve ser curta e objetiva
- Se valor não for claro, pergunte ao usuário
- Retorne APENAS o comando SEM texto adicional (sistema processará)


PARA EVENTOS DA PASCOM / IGREJA:
- Se o usuário mencionar explicitamente adicionar na "Pascom", "Igreja", "Pastoral", "Coordenação" ou "Calendário da Igreja":
- Use o comando: /add_pascom TÍTULO | DATA_HORA_INÍCIO | DATA_HORA_FIM | DESCRIÇÃO | LOCAL | CONVIDADOS | MEET

Para gerenciar eventos do Google Calendar, use os seguintes comandos quando apropriado:
- Para adicionar um evento PESSOAL: /add TÍTULO | DATA_HORA_INÍCIO | DATA_HORA_FIM | DESCRIÇÃO | LOCAL | CONVIDADOS | MEET
- Para adicionar um evento PASCOM: /add_pascom TÍTULO ... (mesmo formato)
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
        const { dataFormatada, horaFormatada } = obterDataHoraAtual();
        const contextoAtual = `Data e hora atual: ${dataFormatada} às ${horaFormatada}\n\n`;

        // Monta o prompt atual combinando as partes
        const promptAtual = parts.map(part => {
            if (part.text) return part.text;
            if (part.inlineData) return '[Imagem anexada]';
            return '';
        }).join('\n');

        try {
            // Pesquisa web removida por solicitação do usuário.
            // Não adicionamos contexto adicional de busca ao prompt.
            const contextoAdicional = '';

            // Configura a chamada para a API da Groq
            const response = await groqClient.post('/chat/completions', {
                ...defaultOptions,
                messages: [
                    { role: 'system', content: gerarSystemMessage() },
                    ...historicoGroq,
                    { role: 'user', content: contextoAtual + promptAtual + contextoAdicional }
                ]
            });

            const completion = response.data;

            // Extrai e retorna o texto da resposta
            const resposta = completion.choices[0]?.message?.content;
            if (!resposta) {
                throw new Error('Resposta vazia do modelo');
            }

            return filtrarPensamentos(resposta);

        } catch (error) {
            // Se for erro de Rate Limit ou API Overloaded e ainda não excedemos o máximo de tentativas
            if ((error.status === 429 || error.status === 503) && tentativa < MAX_RETRIES) {
                console.log(`\n⚠️ API sobrecarregada, tentando novamente em ${DELAY_BASE * tentativa}ms...`);

                // Espera um tempo exponencial antes de tentar novamente
                await new Promise(resolve => setTimeout(resolve, DELAY_BASE * tentativa));

                // Tenta novamente com incremento na contagem de tentativas
                return processarMensagemMultimodal(parts, historico, tentativa + 1);
            }
            throw error;
        }

    } catch (error) {
        console.error('\n❌ Erro ao processar mensagem:', error);
        if (error.response) {
            console.error('Erro - Dados:', error.response.data);
            console.error('Erro - Status:', error.response.status);
        }
        return "❌ Desculpe, ocorreu um erro ao processar sua mensagem.";
    }
}

/**
 * Retorna a data e hora atual formatada
 * @returns {{dataFormatada: string, horaFormatada: string}}
 */
function obterDataHoraAtual() {
    const agora = new Date();
    const dataFormatada = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    return { dataFormatada, horaFormatada };
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
            if ((error.status === 429 || error.status === 503) && tentativa < MAX_RETRIES) {
                console.log(`\n⚠️ API sobrecarregada, tentando novamente em ${DELAY_BASE * tentativa}ms...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BASE * tentativa));
                return processarComGroq(parts, tentativa + 1);
            }
            throw error;
        }

    } catch (error) {
        console.error('\n❌ Erro ao processar formatação com Groq:', error.message);
        return '❌ Erro ao processar sua solicitação.';
    }
}

module.exports = {
    processarMensagemMultimodal,
    filtrarPensamentos,
    processarComGroq
};