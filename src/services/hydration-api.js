/**
 * API de Hidratação - Retorna dados brutos para processamento
 * Similar ao Magisterium, retorna informações estruturadas
 * sem formatação, para que Gemini formate as respostas
 */

const { getOrCreateBottleTracker } = require('./hydration-bottle');

/**
 * Obtém dados brutos de hidratação para análise
 * Retorna um objeto simples com informações para Groq/Gemini processar
 */
function obterDadosHidratacao(userId) {
    try {
        const bottleTracker = getOrCreateBottleTracker(userId);
        const status = bottleTracker.mainTracker.getStatus();
        const proximoLembrete = bottleTracker.mainTracker.calcularProximoLembrete();
        
        return {
            // Dados atuais
            consumidoHoje: status.totalToday,
            metaDiaria: status.dailyGoal,
            percentual: status.percentage,
            faltam: status.remaining,
            statusCritico: status.status,
            
            // Garrafa atual
            garrafa: {
                nome: bottleTracker.bottle.name,
                tamanho: bottleTracker.bottle.size,
                garrafasEquivalentes: (status.totalToday / bottleTracker.bottle.size).toFixed(1)
            },
            
            // Próximo lembrete
            proximoLembrete: {
                minutos: typeof proximoLembrete === 'object' ? proximoLembrete.minutes : proximoLembrete,
                motivo: typeof proximoLembrete === 'object' ? proximoLembrete.reason : 'cálculo automático'
            },
            
            // Contexto para análise
            consumoTotal: status.intakeCount || 0,
            horaAtual: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
    } catch (error) {
        console.error('❌ Erro ao obter dados de hidratação:', error.message);
        return {
            erro: true,
            mensagem: `Erro ao obter dados: ${error.message}`
        };
    }
}

/**
 * Registra consumo de água
 * Retorna dados atualizados após registro
 */
function registrarConsumo(userId, quantidade, fonte = 'user') {
    try {
        const bottleTracker = getOrCreateBottleTracker(userId);
        bottleTracker.registerWater(quantidade, fonte);
        
        // Retorna dados atualizados
        const status = bottleTracker.mainTracker.getStatus();
        return {
            sucesso: true,
            quantidadeRegistrada: quantidade,
            consumidoHoje: status.totalToday,
            metaDiaria: status.dailyGoal,
            percentual: status.percentage,
            faltam: status.remaining
        };
    } catch (error) {
        console.error('❌ Erro ao registrar consumo:', error.message);
        return {
            erro: true,
            mensagem: `Erro ao registrar: ${error.message}`
        };
    }
}

/**
 * Obtém status atual formatado para exibição rápida
 * Usado para lembretes e consultas diretas (não passa por Gemini)
 */
function obterStatusRapido(userId) {
    try {
        const bottleTracker = getOrCreateBottleTracker(userId);
        const status = bottleTracker.mainTracker.getStatus();
        
        return {
            resumo: `${status.totalToday}ml / ${status.dailyGoal}ml (${status.percentage}%)`,
            faltam: `${status.remaining}ml`,
            garrafa: `${bottleTracker.bottle.name} (${bottleTracker.bottle.size}ml)`,
            alerta: status.status
        };
    } catch (error) {
        console.error('❌ Erro ao obter status rápido:', error.message);
        return null;
    }
}

module.exports = {
    obterDadosHidratacao,
    registrarConsumo,
    obterStatusRapido
};
