/**
 * API de Finanças - Interface para o sistema de controle financeiro
 * Retorna dados estruturados para processamento por IA
 */

const FinanceTracker = require('./finance-tracker');

// Cache de trackers por usuário
const trackers = {};

function getOrCreateTracker(userId) {
    if (!trackers[userId]) {
        trackers[userId] = new FinanceTracker(userId);
    }
    return trackers[userId];
}

/**
 * Registra uma despesa
 */
function registrarDespesa(userId, valor, categoria, descricao = '') {
    try {
        const tracker = getOrCreateTracker(userId);
        const resultado = tracker.addExpense(valor, categoria, descricao, 'ia');
        
        if (resultado.error) {
            return { erro: true, mensagem: resultado.error };
        }

        const resumo = tracker.getMonthSummary();
        return {
            sucesso: true,
            valor: valor,
            valorRegistrado: valor,
            categoria,
            necessidade: resultado.necessity,
            totalGastoMes: resumo.totalExpenses,
            saldoMes: resumo.balance,
            orcamento: resumo.budgetStatus,
            gastoEvitavel: resumo.avoidableExpenses
        };
    } catch (error) {
        console.error('❌ Erro ao registrar despesa:', error.message);
        return { erro: true, mensagem: error.message };
    }
}

/**
 * Registra uma receita
 */
function registrarReceita(userId, valor, categoria = 'Receita', descricao = '') {
    try {
        const tracker = getOrCreateTracker(userId);
        const resultado = tracker.addIncome(valor, categoria, descricao, 'ia');
        
        if (resultado.error) {
            return { erro: true, mensagem: resultado.error };
        }

        const resumo = tracker.getMonthSummary();
        return {
            sucesso: true,
            valorRegistrado: valor,
            categoria,
            totalReceitaMes: resumo.totalIncome,
            saldoMes: resumo.balance
        };
    } catch (error) {
        console.error('❌ Erro ao registrar receita:', error.message);
        return { erro: true, mensagem: error.message };
    }
}

/**
 * Obtém resumo financeiro do mês
 */
function obterResumoFinanceiro(userId) {
    try {
        const tracker = getOrCreateTracker(userId);
        const resumo = tracker.getMonthSummary();
        
        return {
            mes: resumo.month,
            despesas: resumo.totalExpenses,
            receitas: resumo.totalIncome,
            saldo: resumo.balance,
            transacoes: resumo.transactionCount,
            mediaDiaria: resumo.averageDailyExpense,
            topCategorias: resumo.byCategory,
            orcamento: resumo.budgetStatus,
            status: resumo.balance >= 0 ? 'positivo' : 'negativo',
            analiseNecessidade: resumo.necessityAnalysis,
            gastoEvitavel: resumo.avoidableExpenses,
            percentualEvitavel: resumo.avoidablePercentage
        };
    } catch (error) {
        console.error('❌ Erro ao obter resumo:', error.message);
        return { erro: true, mensagem: error.message };
    }
}

/**
 * Obtém últimas transações
 */
function obterUltimasTransacoes(userId, limite = 10) {
    try {
        const tracker = getOrCreateTracker(userId);
        const transacoes = tracker.getRecentTransactions(limite);
        
        return {
            sucesso: true,
            quantidade: transacoes.length,
            transacoes: transacoes.map(t => ({
                data: t.formattedDate,
                tipo: t.type === 'expense' ? 'Despesa' : 'Receita',
                valor: t.amount,
                categoria: t.category,
                descricao: t.description || 'Sem descrição'
            }))
        };
    } catch (error) {
        console.error('❌ Erro ao obter transações:', error.message);
        return { erro: true, mensagem: error.message };
    }
}

/**
 * Define orçamento mensal
 */
function definirOrcamento(userId, valor) {
    try {
        const tracker = getOrCreateTracker(userId);
        const resultado = tracker.setMonthlyBudget(valor);
        
        if (resultado.error) {
            return { erro: true, mensagem: resultado.error };
        }

        return {
            sucesso: true,
            orcamentoDefinido: valor,
            mensagem: `Orçamento de R$${valor} definido para o mês`
        };
    } catch (error) {
        console.error('❌ Erro ao definir orçamento:', error.message);
        return { erro: true, mensagem: error.message };
    }
}

/**
 * Obtém comparação com mês anterior
 */
function obterComparacao(userId) {
    try {
        const tracker = getOrCreateTracker(userId);
        const comparacao = tracker.getComparison();
        
        if (comparacao.error) {
            return { erro: true, mensagem: comparacao.error };
        }

        return {
            sucesso: true,
            mesAtual: comparacao.currentMonth,
            mesAnterior: comparacao.lastMonth,
            diferenca: comparacao.difference,
            variacao: comparacao.percentageChange,
            tendencia: comparacao.trend === 'up' ? 'Aumento' : comparacao.trend === 'down' ? 'Redução' : 'Estável'
        };
    } catch (error) {
        console.error('❌ Erro ao obter comparação:', error.message);
        return { erro: true, mensagem: error.message };
    }
}

/**
 * Exporta dados para CSV
 */
function exportarDados(userId) {
    try {
        const tracker = getOrCreateTracker(userId);
        const csv = tracker.exportToCSV();
        
        return {
            sucesso: true,
            dados: csv,
            linhas: tracker.data.transactions.length
        };
    } catch (error) {
        console.error('❌ Erro ao exportar dados:', error.message);
        return { erro: true, mensagem: error.message };
    }
}

module.exports = {
    registrarDespesa,
    registrarReceita,
    obterResumoFinanceiro,
    obterUltimasTransacoes,
    definirOrcamento,
    obterComparacao,
    exportarDados,
    getOrCreateTracker
};
