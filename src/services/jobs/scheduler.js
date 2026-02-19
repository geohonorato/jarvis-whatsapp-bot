const { checkPrices } = require('../crawler/price-watcher');

let jobsInterval = null;

/**
 * Inicia os Jobs agendados (Crawler, Lembretes, etc)
 * @param {Client} client - Cliente WhatsApp autenticado
 */
function iniciarScheduler(client) {
    if (jobsInterval) {
        console.log('⚠️ Scheduler já estava rodando.');
        return;
    }

    console.log('⏰ Scheduler iniciado: Crawler de Preços (30min)');

    // Executa imediatamente uma vez
    runJobs(client);

    // Configura intervalo de 30 minutos
    jobsInterval = setInterval(() => {
        runJobs(client);
    }, 30 * 60 * 1000);
}

async function runJobs(client) {
    try {
        // --- 1. Crawler de Preços ---
        const alerts = await checkPrices();

        if (alerts && alerts.length > 0) {
            console.log(`📢 Enviando ${alerts.length} alertas de preço...`);
            for (const alert of alerts) {
                await client.sendMessage(alert.chatId, alert.message);
                // Pequeno delay para evitar flood
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    } catch (error) {
        console.error('❌ Erro no ciclo do Scheduler:', error);
    }
}

module.exports = { iniciarScheduler };
