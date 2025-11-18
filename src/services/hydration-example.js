/**
 * Exemplo de uso do HydrationTracker
 * Como integrar com o bot WhatsApp
 */

const HydrationTracker = require('./hydration-tracker');

// Inicializar rastreador por usuário
const trackers = {};

function getOrCreateTracker(userId) {
    if (!trackers[userId]) {
        trackers[userId] = new HydrationTracker(userId);
    }
    return trackers[userId];
}

/**
 * Handlers para o bot WhatsApp
 */
const hydrationHandlers = {
    /**
     * Comandos: /water, /beber, /hidratação
     */
    async handleWaterCommand(message, userId) {
        const tracker = getOrCreateTracker(userId);
        const parts = message.toLowerCase().split(' ');

        if (parts[0] === '/water' || parts[0] === '/beber') {
            // /water 250 ou /beber 300
            const amount = parseInt(parts[1]) || 250;
            const status = tracker.logWater(amount, 'whatsapp');

            return `
💧 *Água registrada!*

📊 *Hoje:* ${status.totalToday}ml / ${status.dailyGoal}ml (${status.percentage}%)
⏳ *Faltam:* ${status.remaining}ml
🔄 *Consumições:* ${status.intakeCount}

${status.status}
            `.trim();
        }

        if (parts[0] === '/hidratação' || parts[0] === '/hydration') {
            return hydrationHandlers.getStatusReport(userId);
        }

        if (parts[0] === '/relatorio' || parts[0] === '/report') {
            return hydrationHandlers.getDetailedReport(userId);
        }

        if (parts[0] === '/lembrete' || parts[0] === '/remind') {
            const lembrete = tracker.gerarLembrete();
            return `
${lembrete.message}

⏰ *Próximo lembrete em:* ${lembrete.proximoLembreteEm.minutes || lembrete.proximoLembreteEm}min
🎯 *Razão:* ${lembrete.razao}
            `.trim();
        }
    },

    /**
     * Retorna status atual da hidratação
     */
    getStatusReport(userId) {
        const tracker = getOrCreateTracker(userId);
        const status = tracker.getStatus();

        let barraProgresso = '';
        const chunks = Math.round(status.percentage / 10);
        for (let i = 0; i < 10; i++) {
            barraProgresso += i < chunks ? '🟦' : '🟩';
        }

        return `
💧 *HIDRATAÇÃO - STATUS DO DIA*

${barraProgresso}
${status.percentage}% da meta

📊 *Ingestão hoje:* ${status.totalToday}ml
🎯 *Meta diária:* ${status.dailyGoal}ml
⏳ *Faltam:* ${status.remaining}ml

${status.status}

💡 *Dica:* Use /agua 250 para registrar água
        `.trim();
    },

    /**
     * Relatório detalhado com padrões
     */
    getDetailedReport(userId) {
        const tracker = getOrCreateTracker(userId);
        const relatorio = tracker.gerarRelatorio();
        const status = relatorio.statusHoje;

        let horasPico = 'Sem dados ainda';
        if (relatorio.horasDePico.length > 0) {
            horasPico = relatorio.horasDePico.join('h, ') + 'h';
        }

        let recomendacoes = '🔹 Sistema aprendendo seus padrões...';
        if (relatorio.recomendacoes.length > 0) {
            recomendacoes = relatorio.recomendacoes.map(r => `• ${r}`).join('\n');
        }

        return `
📈 *RELATÓRIO INTELIGENTE DE HIDRATAÇÃO*

*Status Hoje:*
${status.totalToday}ml / ${status.dailyGoal}ml (${status.percentage}%)

*Padrões Detectados:*
🔴 *Horas de pico:* ${horasPico}

*Recomendações:*
${recomendacoes}

💡 *Ative lembretes inteligentes:* /lembrete
        `.trim();
    },

    /**
     * Configurar meta diária
     */
    setDailyGoal(userId, amount) {
        const tracker = getOrCreateTracker(userId);
        tracker.updateConfig({ dailyGoal: amount });
        return `✅ Meta diária atualizada para ${amount}ml`;
    },

    /**
     * Configurar intervalo de lembretes
     */
    setReminderInterval(userId, minutes) {
        const tracker = getOrCreateTracker(userId);
        tracker.updateConfig({ reminderInterval: minutes });
        return `✅ Lembretes agora a cada ${minutes} minutos`;
    }
};

/**
 * Lógica para enviar lembretes automáticos via cron
 */
function setupHydrationReminders(client, userId, chatId) {
    const tracker = getOrCreateTracker(userId);
    
    // Resetar a cada 24h
    const resetDaily = () => {
        const nextMidnight = new Date();
        nextMidnight.setDate(nextMidnight.getDate() + 1);
        nextMidnight.setHours(0, 0, 0, 0);
        
        const msUntilMidnight = nextMidnight - new Date();
        setTimeout(() => {
            tracker.loadData(); // Recarrega e limpa dados do dia
            resetDaily(); // Agendar próximo reset
        }, msUntilMidnight);
    };

    resetDaily();

    // Enviar lembretes em intervalo adaptativo
    const scheduleNextReminder = async () => {
        try {
            const proximoLembrete = tracker.calcularProximoLembrete();
            const minutos = typeof proximoLembrete === 'object' 
                ? proximoLembrete.minutes 
                : proximoLembrete;

            if (minutos > 0) {
                setTimeout(async () => {
                    const lembrete = tracker.gerarLembrete();
                    
                    const msg = await client.getChatById(chatId);
                    await msg.sendMessage(lembrete.message);
                    
                    console.log(`💧 Lembrete de hidratação enviado para ${userId}`);
                    
                    // Agendar próximo
                    scheduleNextReminder();
                }, minutos * 60 * 1000);
            }
        } catch (error) {
            console.error('❌ Erro ao agendar lembrete de hidratação:', error.message);
        }
    };

    scheduleNextReminder();
}

module.exports = {
    HydrationTracker,
    hydrationHandlers,
    setupHydrationReminders,
    getOrCreateTracker
};
