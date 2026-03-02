const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const pluggyApi = require('../api/pluggy');
const FinanceTracker = require('../finance/finance-tracker');
const groqApi = require('../api/groq');
const pendingTransactions = require('../bot/handlers/pending-transactions');
const { Client } = require('whatsapp-web.js');

const LAST_SYNC_FILE = path.join(__dirname, '../../../data/finances/last_pluggy_sync.json');

// Initialize tracker
const dbPath = path.join(__dirname, '../../../data/finances/finances.json');
const tracker = new FinanceTracker(dbPath);

/**
 * Lê a data do último sync. Se não existir, pega do dia primeiro do mês atual.
 */
function getLastSyncDate() {
    try {
        if (fs.existsSync(LAST_SYNC_FILE)) {
            const data = JSON.parse(fs.readFileSync(LAST_SYNC_FILE, 'utf8'));
            if (data.lastDate) return data.lastDate;
        }
    } catch (e) {
        console.error('Erro ao ler last_sync.json', e.message);
    }

    // Default: initial sync vai buscar desde 6 meses atrás para pegar o histórico
    const now = new Date();
    now.setMonth(now.getMonth() - 6);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function updateLastSyncDate(dateStr) {
    try {
        const dir = path.dirname(LAST_SYNC_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({ lastDate: dateStr, updated_at: new Date().toISOString() }, null, 2));
    } catch (e) {
        console.error('Erro ao salvar last_sync.json', e.message);
    }
}

/**
 * Pede pra LLM classificar a transação bancária nua e crua
 */
async function classifyTransactionWithAI(description, amount) {
    const prompt = `Você é um analista financeiro rápido. 
Classifique esta despesa de R$ ${amount} com a descrição: "${description}".
Se a descrição for muito vaga e não indicar o que foi comprado (ex: "Pix Enviado", "Transferência", "Pagamento de Boleto" sem nome da loja), classifique a categoria estritamente como "Pendente" e necessidade "Indefinido".
Retorne APENAS um JSON válido neste formato exato (sem crases Markdown, sem texto fora):
{"categoria": "NomeDaCategoriaOuPendente", "necessidade": "Essencial" ou "Importante" ou "Intermediário" ou "Supérfluo" ou "Indefinido"}`;

    const classificacaoCrua = await groqApi.processarComGroq([{ text: prompt }]);

    try {
        const jsonText = classificacaoCrua.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonText);
        return {
            categoria: data.categoria || 'Outros',
            necessidade: data.necessidade || 'Intermediário'
        };
    } catch (e) {
        console.error(`Falha ao parsear JSON da Groq para a transação ${description}:`, classificacaoCrua);
        return { categoria: 'Outros', necessidade: 'Intermediário' }; // Fallback
    }
}

/**
 * Formata moeda para envio no Whatsapp
 */
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * A tarefa principal que roda repetidamente
 */
async function syncOpenFinance(whatsappClient, telefoneDestino) {
    const ITEM_ID = process.env.PLUGGY_ITEM_ID;
    if (!ITEM_ID) {
        console.log('⚠️ [Pluggy Sync] Sincronização cancelada: PLUGGY_ITEM_ID ausente no .env');
        return;
    }

    console.log('🔄 [Pluggy Sync] Iniciando sincronização do Open Finance no background...');
    const fromDate = getLastSyncDate();

    try {
        console.log(`📡 Solicitando transações para o Item ${ITEM_ID} desde ${fromDate}...`);
        const transactions = await pluggyApi.obterTodasTransacoes(ITEM_ID, fromDate);
        console.log(`📥 A API retornou ${transactions.length} transações brutas.`);

        // Se for Sandbox e não tiver transações reais, a gente mocka algumas para ver o robô funcionar
        if (transactions.length === 0 && Array.isArray(transactions)) {
            console.log('⚠️ Detectado ambiente sem transações reais. MOCKANDO transações para testar o fluxo da LLM e Tracker...');
            transactions.push(
                { status: 'POSTED', type: 'DEBIT', amount: -65.40, description: 'Netflix.com', date: new Date().toISOString(), category: 'Serviços' },
                { status: 'POSTED', type: 'DEBIT', amount: -150.00, description: 'Pix Enviado Joana', date: new Date().toISOString(), category: 'Transferências' }, // Mock VAGO proposital
                { status: 'POSTED', type: 'DEBIT', amount: -350.00, description: 'Bares e Lanches Ze Manel', date: new Date().toISOString(), category: 'Alimentação' },
                { status: 'POSTED', type: 'CREDIT', amount: 1500.00, description: 'PIX Recebido João Silva', date: new Date().toISOString(), category: 'Transferências' }
            );
        }

        if (transactions.length === 0) {
            console.log(`✅ [Pluggy Sync] Nenhuma transação nova desde ${fromDate}`);
            return;
        }

        console.log('Exemplo da primeira transação bruta:', JSON.stringify(transactions[0]));

        let addedCount = 0;
        let warningMessages = [];
        let limitExceeded = false;
        let todayMsgDate = new Date().toISOString().split('T')[0];

        // Processa da mais antiga pra mais nova para manter a ordem no BD
        const sortedTrx = transactions.reverse();

        for (const trx of sortedTrx) {
            // Pula estornos ou transações neutras que possam vir com status pendente bizarro, focando no extrato realizado
            if (trx.status !== 'POSTED') continue;

            const valorAbsoluto = Math.abs(trx.amount);

            // Opcional: Evitar salvar movimentações minúsculas de centavos de rendimento interbanco, se quiser
            // if (valorAbsoluto < 1.0) continue;

            // Transação de Saída (Gasto)
            if (trx.type === 'DEBIT' || trx.amount < 0) {
                // Classifica com IA
                const classificada = await classifyTransactionWithAI(trx.description, valorAbsoluto);

                // HUMAN IN THE LOOP: Gasto Vago
                if (classificada.categoria === 'Pendente' || classificada.categoria.toLowerCase().includes('pendente') || classificada.necessidade === 'Indefinido') {
                    console.log(`🕵️‍♂️ Transação vaga detectada: ${trx.description}. Enviando para fila de Fiscalização.`);
                    pendingTransactions.addPendingTransaction({
                        amount: valorAbsoluto,
                        description: trx.description,
                        date: trx.date.substring(0, 10),
                        originalCategory: trx.category || 'Outros'
                    });

                    warningMessages.push(`🚨 *Fiscal Jarvis ativo:*\nVi uma saída de ${formatCurrency(valorAbsoluto)} agora com a descrição genérica _"${trx.description}"_.\n\nO que foi isso? Responda essa mensagem me explicando para eu salvar no relatório de gastos.`);
                    // Continua o loop sem adicionar ao FinanceTracker ainda!
                    continue;
                }

                // Grava no FinanceTracker Gasto Normal
                const result = tracker.addExpense(
                    valorAbsoluto,
                    classificada.categoria,
                    trx.description,
                    trx.date.substring(0, 10)
                );

                addedCount++;

                // Lógica de alerta proativo com SERMÃO INTELIGENTE se for Supérfluo ou Dispensável
                if (result.gastosEvitaveisStatus === 'ruim' || classificada.necessidade === 'Supérfluo' || classificada.necessidade === 'Dispensável') {
                    console.log(`🔥 Gasto supérfluo detectado na nuvem: ${trx.description}. Solicitando sermão do Groq...`);
                    const promptSermao = `O usuário Geovanni (seu criador/chefe) acabou de fazer um gasto classificado como "Supérfluo/Evitável".
Detalhes: Gasto de R$ ${valorAbsoluto} com "${trx.description}" (Categoria: ${classificada.categoria}).
Sua missão como Jarvis (assistente irônico, sarcástico e extremamente rigoroso com as finanças dele) é dar um Puxão de Orelha. 
Humilhe a atitude dele de gastar com bobagem. Dê um sermão, bata nele moralmente por torrar dinheiro enquanto devia economizar. Use humor ácido, seja julgador.
Máximo de 4-5 frases curtas. Formate em texto de WhatsApp (asterisco para negrito e underline para itálico, NUNCA use markdown **).`;

                    try {
                        const sermao = await groqApi.processarComGroq([{ text: promptSermao }]);
                        warningMessages.push(`🚨 *FISCAL JARVIS - GASTO SUPÉRFLUO!* 🚨\n\n${sermao}`);
                    } catch (e) {
                        warningMessages.push(`🚨 *Alerta de Gasto Evitável!*\nVocê acabou de gastar ${formatCurrency(valorAbsoluto)} em _${trx.description}_ (${classificada.categoria}).\nCuidado com o limite!`);
                    }
                }

                if (result.orcamento && result.orcamento.percentage >= 90 && !limitExceeded) {
                    warningMessages.push(`⚠️ *Orçamento de ${classificada.categoria} no limite!* Você já usou ${result.orcamento.percentage}% do planejado.`);
                    limitExceeded = true; // Só avisa 1x por batch
                }

            } else if (trx.type === 'CREDIT' || trx.amount > 0) {
                // É Entrada de dinheiro (Receita)
                tracker.addIncome(
                    valorAbsoluto,
                    trx.category || 'Receita Diversa', // Pluggy já dá uma categoria macro, podemos usar direto
                    trx.description,
                    trx.date.substring(0, 10)
                );
                addedCount++;
                warningMessages.push(`💰 *Dinheiro na conta!*\nRecebimento de ${formatCurrency(valorAbsoluto)}: _${trx.description}_.`);
            }
        }

        if (addedCount > 0) {
            console.log(`✅ [Pluggy Sync] ${addedCount} transações adicionadas e classificadas.`);
            // Update a data do sync pro dia atual pra não puxar os velhos na próxima rodada
            updateLastSyncDate(todayMsgDate);

            // Avisar o usuário se houver "Red Flags" ou recebimentos
            if (warningMessages.length > 0 && whatsappClient && telefoneDestino) {
                for (const msg of warningMessages) {
                    await whatsappClient.sendMessage(telefoneDestino, msg);
                }
            }
        } else {
            console.log(`✅ [Pluggy Sync] Nenhuma transação válida postada no banco encontrada.`);
        }

    } catch (err) {
        console.error('❌ [Pluggy Sync] Erro durante o processamento do banco:', err.message);
    }
}

/**
 * Agenda o job usando node-cron
 */
function schedulePluggySync(whatsappClient) {
    const { config } = require('../../../config');
    const targetPhone = config.whatsapp.adminPhone;

    // Roda a cada 30 minutos (minuto 0 e 30) entre as 09:00 e 20:30
    // Isso completa as 24 requisições diárias concentradas no seu horário ativo
    cron.schedule('0,30 9-20 * * *', () => {
        syncOpenFinance(whatsappClient, targetPhone);
    });

    console.log('⏰ Módulo Open Finance (Pluggy Sync) agendado para rodar todo hora no minuto 30.');
}

module.exports = {
    schedulePluggySync,
    syncOpenFinance // Exportado para testes secos
};
