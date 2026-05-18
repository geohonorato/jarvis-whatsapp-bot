// Crawler de preços foi removido na refatoração (abril/2026)
let checkPrices = null;
try {
    checkPrices = require('../crawler/price-watcher').checkPrices;
} catch (e) {
    console.log('ℹ️ Crawler de preços indisponível (módulo removido)');
}

// Job financeiro mensal depende de whatsapp-web.js (não compatível com Baileys)
let verificarAnaliseFinanceiraMensal = null;
try {
    verificarAnaliseFinanceiraMensal = require('./monthly-finance-job').verificarAnaliseFinanceiraMensal;
} catch (e) {
    console.log('ℹ️ Job financeiro mensal indisponível:', e.message);
}

let jobsInterval = null;
let monthlyInterval = null;

/**
 * Inicia os Jobs agendados (Crawler, Análise Financeira Mensal)
 * @param {Client} client - Cliente WhatsApp autenticado
 */
function iniciarScheduler(client) {
    if (jobsInterval) {
        console.log('⚠️ Scheduler já estava rodando.');
        return;
    }

    const modulos = [];
    if (checkPrices) modulos.push('Crawler de Preços (30min)');
    if (verificarAnaliseFinanceiraMensal) modulos.push('Análise Financeira Mensal');
    console.log(`⏰ Scheduler iniciado: ${modulos.length > 0 ? modulos.join(' + ') : 'nenhum job adicional disponível'}`);

    // Crawler de preços (se disponível)
    if (checkPrices) {
        runJobs(client);
        jobsInterval = setInterval(() => runJobs(client), 30 * 60 * 1000);
    }

    // Job financeiro mensal (se disponível)
    if (verificarAnaliseFinanceiraMensal) {
        verificarAnaliseFinanceiraMensal(client);
        monthlyInterval = setInterval(() => {
            verificarAnaliseFinanceiraMensal(client);
        }, 60 * 1000);
    }
}

async function runJobs(client) {
    try {
        const alerts = await checkPrices();
        if (alerts && alerts.length > 0) {
            console.log(`📢 Enviando ${alerts.length} alertas de preço...`);
            for (const alert of alerts) {
                await client.sendMessage(alert.chatId, alert.message);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    } catch (error) {
        console.error('❌ Erro no ciclo do Scheduler:', error);
    }
}

module.exports = { iniciarScheduler };

