const { PluggyClient } = require('pluggy-sdk');

const CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;

let client = null;

function getClient() {
    if (!client) {
        if (!CLIENT_ID || !CLIENT_SECRET) {
            console.error('⚠️ [Pluggy] Credenciais não configuradas no .env');
            return null;
        }
        client = new PluggyClient({
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
        });
    }
    return client;
}

/**
 * Puxa todas as contas de um item (conexão)
 */
async function obterContas(itemId) {
    try {
        const c = getClient();
        if (!c) return [];

        const accounts = await c.fetchAccounts(itemId);
        return accounts.results || [];
    } catch (err) {
        console.error('❌ Erro ao buscar contas Pluggy:', err.message);
        return [];
    }
}

/**
 * Puxa transações de uma conta específica
 */
async function obterTransacoesConta(accountId, fromDate) {
    try {
        const c = getClient();
        if (!c) return [];

        const params = {};
        // Sandbox mock dates can be very old, so we temporarily ignore fromDate 
        // if (fromDate) {
        //     params.from = fromDate; // Formato YYYY-MM-DD
        // }

        const transactions = await c.fetchTransactions(accountId, params);
        return transactions.results || [];
    } catch (err) {
        console.error(`❌ Erro ao buscar transações da conta ${accountId}:`, err.message);
        return [];
    }
}

/**
 * Puxa transações de TODAS as contas de um Item
 */
async function obterTodasTransacoes(itemId, fromDate) {
    const todas = [];
    console.log(`📡 [Pluggy] Buscando contas atreladas ao Item ${itemId}...`);
    const contas = await obterContas(itemId);
    console.log(`📥 [Pluggy] Encontrou ${contas.length} contas associadas.`);

    for (const conta of contas) {
        console.log(`📡 [Pluggy] Puxando transações da conta ${conta.id} (${conta.name})...`);
        const trx = await obterTransacoesConta(conta.id, fromDate);
        console.log(`📥 [Pluggy] A conta ${conta.name} retornou ${trx.length} transações.`);
        todas.push(...trx);
    }

    // Ordena da mais recente para a mais antiga
    todas.sort((a, b) => new Date(b.date) - new Date(a.date));
    return todas;
}

module.exports = {
    obterContas,
    obterTransacoesConta,
    obterTodasTransacoes
};
