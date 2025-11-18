/**
 * Sistema de lembretes automáticos de hidratação
 * Envia lembretes no intervalo adaptativo e nos horários de pico detectados
 */

const { getOrCreateTracker } = require('./hydration-example');

// Map para rastrear timeouts ativos por usuário
const activeReminders = {};

/**
 * Inicia sistema de lembretes para um usuário
 * @param {Object} client - cliente WhatsApp
 * @param {string} userId - ID do usuário (chatId)
 */
function iniciarLembretesHidratacao(client, userId) {
    // Se já há lembrete ativo, não duplica
    if (activeReminders[userId]) {
        console.log(`⏰ Lembretes já ativos para ${userId}`);
        return;
    }

    console.log(`💧 Iniciando sistema de lembretes de hidratação para ${userId}`);
    
    const tracker = getOrCreateTracker(userId);
    const status = tracker.getStatus();

    // Se já atingiu meta hoje, não envia lembretes
    if (status.goalMet) {
        console.log(`✅ Meta de hidratação já atingida para ${userId}`);
        activeReminders[userId] = { active: false, reason: 'goal_met' };
        return;
    }

    // Agenda o próximo lembrete
    agendarProximoLembrete(client, userId);
}

/**
 * Agenda o próximo lembrete baseado no intervalo adaptativo
 */
function agendarProximoLembrete(client, userId) {
    try {
        const tracker = getOrCreateTracker(userId);
        const proximoLembrete = tracker.calcularProximoLembrete();
        
        // Extrai minutos
        const minutosAteProximoLembrete = typeof proximoLembrete === 'object' 
            ? proximoLembrete.minutes 
            : proximoLembrete;

        if (minutosAteProximoLembrete <= 0) {
            console.log(`⏰ Lembretes desativados para ${userId} (meta atingida)`);
            activeReminders[userId] = { active: false, reason: 'goal_met' };
            return;
        }

        const msAteProximo = minutosAteProximoLembrete * 60 * 1000;
        const horasMinutos = `${Math.floor(minutosAteProximoLembrete / 60)}h ${minutosAteProximoLembrete % 60}min`;

        console.log(`⏰ Próximo lembrete para ${userId} em ${horasMinutos}`);

        // Limpa timeout anterior se existir
        if (activeReminders[userId]?.timeoutId) {
            clearTimeout(activeReminders[userId].timeoutId);
        }

        // Agenda novo timeout
        const timeoutId = setTimeout(async () => {
            await enviarLembrete(client, userId);
            // Agenda próximo após enviar este
            agendarProximoLembrete(client, userId);
        }, msAteProximo);

        // Armazena informações do lembrete ativo
        activeReminders[userId] = {
            active: true,
            timeoutId,
            proximoEmMs: msAteProximo,
            proximoEm: new Date(Date.now() + msAteProximo).toLocaleString('pt-BR')
        };

    } catch (error) {
        console.error(`❌ Erro ao agendar lembrete para ${userId}:`, error.message);
    }
}

/**
 * Envia um lembrete de hidratação para o usuário
 */
async function enviarLembrete(client, userId) {
    try {
        const tracker = getOrCreateTracker(userId);
        const lembrete = tracker.gerarLembrete();
        const status = tracker.getStatus();

        // Se já atingiu meta, não envia mais
        if (status.goalMet) {
            console.log(`✅ Meta atingida! Pausando lembretes para ${userId}`);
            activeReminders[userId] = { active: false, reason: 'goal_met' };
            return;
        }

        // Monta mensagem com emoji de urgência baseado no progresso
        let emoji = '💧';
        if (status.percentage < 20) emoji = '🔴';
        else if (status.percentage < 50) emoji = '🟠';
        else if (status.percentage < 80) emoji = '🟡';
        else emoji = '🟢';

        const mensagemLembrete = `
${emoji} *Lembrete de Hidratação*

${lembrete.message}

_Responda naturalmente, ex: "Bebi água agora", "Tomei um copo de suco", etc_
        `.trim();

        const chat = await client.getChatById(userId);
        await chat.sendMessage(mensagemLembrete);

        console.log(`💬 Lembrete enviado para ${userId}`);

    } catch (error) {
        console.error(`❌ Erro ao enviar lembrete para ${userId}:`, error.message);
    }
}

/**
 * Pausa lembretes para um usuário
 */
function pausarLembretesHidratacao(userId) {
    if (activeReminders[userId]?.timeoutId) {
        clearTimeout(activeReminders[userId].timeoutId);
        console.log(`⏸️ Lembretes pausados para ${userId}`);
        activeReminders[userId] = { active: false, reason: 'paused' };
    }
}

/**
 * Retoma lembretes para um usuário
 */
function retomarLembretesHidratacao(client, userId) {
    pausarLembretesHidratacao(userId);
    console.log(`▶️ Retomando lembretes para ${userId}`);
    agendarProximoLembrete(client, userId);
}

/**
 * Para todos os lembretes (quando usuário desativa globalmente)
 */
function pararTodosLembretes() {
    Object.keys(activeReminders).forEach(userId => {
        pausarLembretesHidratacao(userId);
    });
    console.log('🛑 Todos os lembretes pausados');
}

/**
 * Retorna status de lembretes do usuário
 */
function getStatusLembretes(userId) {
    const reminder = activeReminders[userId];
    
    if (!reminder) {
        return {
            ativo: false,
            mensagem: 'Sem lembretes agendados'
        };
    }

    if (!reminder.active) {
        return {
            ativo: false,
            mensagem: `Lembretes pausados (${reminder.reason})`
        };
    }

    return {
        ativo: true,
        proximoEm: reminder.proximoEm,
        emMs: reminder.proximoEmMs,
        mensagem: `Próximo lembrete em ${reminder.proximoEm}`
    };
}

module.exports = {
    iniciarLembretesHidratacao,
    pausarLembretesHidratacao,
    retomarLembretesHidratacao,
    pararTodosLembretes,
    agendarProximoLembrete,
    enviarLembrete,
    getStatusLembretes
};
