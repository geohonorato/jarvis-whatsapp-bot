/**
 * Sistema de controle financeiro pessoal
 * Rastreia gastos, receitas e gera relatórios
 */

const fs = require('fs');
const path = require('path');

class FinanceTracker {
    constructor(userId = 'default') {
        this.userId = userId;
        this.dataDir = path.join(__dirname, '../../temp', 'finance-data');
        this.dataFile = path.join(this.dataDir, `${userId}-finance.json`);
        this.configFile = path.join(this.dataDir, `${userId}-finance-config.json`);
        
        // Criar diretório se não existir
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        // Configuração padrão
        this.config = {
            currency: 'BRL',
            monthlyBudget: 0, // 0 = sem orçamento definido
            categories: [
                'Alimentação',
                'Transporte',
                'Saúde',
                'Lazer',
                'Moradia',
                'Educação',
                'Vestuário',
                'Serviços',
                'Outros'
            ],
            alertThreshold: 0.8, // Alerta quando usar 80% do orçamento
            timezone: 'America/Sao_Paulo'
        };

        // Dados financeiros
        this.data = {
            currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
            transactions: [], // { date, type: 'expense|income', amount, category, description, source }
            budgets: {}, // { category: amount }
            recurringTransactions: [] // { type, amount, category, description, dayOfMonth }
        };

        this.loadData();
    }

    /**
     * Carrega dados persistidos
     */
    loadData() {
        try {
            if (fs.existsSync(this.configFile)) {
                const savedConfig = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                this.config = { ...this.config, ...savedConfig };
            }

            if (fs.existsSync(this.dataFile)) {
                const savedData = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                
                // Se é um novo mês, arquiva dados antigos
                const currentMonth = new Date().toISOString().slice(0, 7);
                if (savedData.currentMonth !== currentMonth) {
                    this.archiveMonthData(savedData);
                    this.data.transactions = [];
                    this.data.currentMonth = currentMonth;
                    // Mantém budgets e recurring
                    this.data.budgets = savedData.budgets || {};
                    this.data.recurringTransactions = savedData.recurringTransactions || [];
                } else {
                    this.data = savedData;
                }
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados financeiros:', error.message);
        }
    }

    /**
     * Salva dados em arquivo
     */
    saveData() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('❌ Erro ao salvar dados financeiros:', error.message);
        }
    }

    /**
     * Arquiva dados do mês anterior
     */
    archiveMonthData(oldData) {
        try {
            const archiveDir = path.join(this.dataDir, 'archive');
            if (!fs.existsSync(archiveDir)) {
                fs.mkdirSync(archiveDir, { recursive: true });
            }

            const archiveFile = path.join(archiveDir, `${this.userId}-${oldData.currentMonth}.json`);
            fs.writeFileSync(archiveFile, JSON.stringify(oldData, null, 2));
            console.log(`📁 Dados de ${oldData.currentMonth} arquivados`);
        } catch (error) {
            console.error('❌ Erro ao arquivar dados:', error.message);
        }
    }

    /**
     * Registra uma despesa
     */
    addExpense(amount, category, description = '', source = 'manual') {
        if (amount <= 0) {
            return { error: 'Valor deve ser maior que zero' };
        }

        const transaction = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            type: 'expense',
            amount: parseFloat(amount.toFixed(2)),
            category: category || 'Outros',
            description,
            source
        };

        this.data.transactions.push(transaction);
        this.saveData();

        console.log(`💸 Despesa registrada: R$${amount} - ${category}`);
        return { success: true, transaction };
    }

    /**
     * Registra uma receita
     */
    addIncome(amount, category = 'Receita', description = '', source = 'manual') {
        if (amount <= 0) {
            return { error: 'Valor deve ser maior que zero' };
        }

        const transaction = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            type: 'income',
            amount: parseFloat(amount.toFixed(2)),
            category,
            description,
            source
        };

        this.data.transactions.push(transaction);
        this.saveData();

        console.log(`💰 Receita registrada: R$${amount} - ${category}`);
        return { success: true, transaction };
    }

    /**
     * Remove uma transação
     */
    removeTransaction(transactionId) {
        const index = this.data.transactions.findIndex(t => t.id === transactionId);
        if (index === -1) {
            return { error: 'Transação não encontrada' };
        }

        const removed = this.data.transactions.splice(index, 1)[0];
        this.saveData();

        return { success: true, removed };
    }

    /**
     * Obtém resumo do mês atual
     */
    getMonthSummary() {
        const expenses = this.data.transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const income = this.data.transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const balance = income - expenses;

        // Gastos por categoria
        const byCategory = {};
        this.data.transactions
            .filter(t => t.type === 'expense')
            .forEach(t => {
                byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
            });

        // Ordenar categorias por valor
        const topCategories = Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Verificar orçamento
        let budgetStatus = null;
        if (this.config.monthlyBudget > 0) {
            const budgetUsed = (expenses / this.config.monthlyBudget) * 100;
            const remaining = this.config.monthlyBudget - expenses;
            budgetStatus = {
                budget: this.config.monthlyBudget,
                used: expenses,
                remaining,
                percentage: Math.min(100, budgetUsed.toFixed(1)),
                alert: budgetUsed >= (this.config.alertThreshold * 100)
            };
        }

        return {
            month: this.data.currentMonth,
            totalExpenses: parseFloat(expenses.toFixed(2)),
            totalIncome: parseFloat(income.toFixed(2)),
            balance: parseFloat(balance.toFixed(2)),
            transactionCount: this.data.transactions.length,
            byCategory: topCategories.map(([cat, amount]) => ({
                category: cat,
                amount: parseFloat(amount.toFixed(2)),
                percentage: ((amount / expenses) * 100).toFixed(1)
            })),
            budgetStatus,
            averageDailyExpense: parseFloat((expenses / new Date().getDate()).toFixed(2))
        };
    }

    /**
     * Obtém últimas transações
     */
    getRecentTransactions(limit = 10) {
        return this.data.transactions
            .slice(-limit)
            .reverse()
            .map(t => ({
                ...t,
                formattedDate: new Date(t.date).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })
            }));
    }

    /**
     * Define orçamento mensal
     */
    setMonthlyBudget(amount) {
        if (amount < 0) {
            return { error: 'Orçamento não pode ser negativo' };
        }

        this.config.monthlyBudget = parseFloat(amount.toFixed(2));
        this.saveData();

        return { success: true, budget: this.config.monthlyBudget };
    }

    /**
     * Define orçamento por categoria
     */
    setCategoryBudget(category, amount) {
        if (amount < 0) {
            return { error: 'Orçamento não pode ser negativo' };
        }

        this.data.budgets[category] = parseFloat(amount.toFixed(2));
        this.saveData();

        return { success: true, category, budget: amount };
    }

    /**
     * Adiciona transação recorrente
     */
    addRecurringTransaction(type, amount, category, description, dayOfMonth) {
        const recurring = {
            id: Date.now().toString(),
            type,
            amount: parseFloat(amount.toFixed(2)),
            category,
            description,
            dayOfMonth: parseInt(dayOfMonth)
        };

        this.data.recurringTransactions.push(recurring);
        this.saveData();

        return { success: true, recurring };
    }

    /**
     * Processa transações recorrentes do mês
     */
    processRecurringTransactions() {
        const today = new Date().getDate();
        const processed = [];

        for (const recurring of this.data.recurringTransactions) {
            // Verifica se já foi processada este mês
            const alreadyProcessed = this.data.transactions.some(t => 
                t.source === 'recurring' && 
                t.description.includes(recurring.description)
            );

            if (!alreadyProcessed && today >= recurring.dayOfMonth) {
                if (recurring.type === 'expense') {
                    this.addExpense(recurring.amount, recurring.category, recurring.description, 'recurring');
                } else {
                    this.addIncome(recurring.amount, recurring.category, recurring.description, 'recurring');
                }
                processed.push(recurring);
            }
        }

        return processed;
    }

    /**
     * Obtém estatísticas comparativas
     */
    getComparison() {
        // Carrega mês anterior se existir
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthStr = lastMonth.toISOString().slice(0, 7);
        
        const archiveFile = path.join(this.dataDir, 'archive', `${this.userId}-${lastMonthStr}.json`);
        
        if (!fs.existsSync(archiveFile)) {
            return { error: 'Dados do mês anterior não disponíveis' };
        }

        try {
            const lastMonthData = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
            const lastExpenses = lastMonthData.transactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);

            const currentSummary = this.getMonthSummary();
            const difference = currentSummary.totalExpenses - lastExpenses;
            const percentageChange = lastExpenses > 0 
                ? ((difference / lastExpenses) * 100).toFixed(1)
                : 0;

            return {
                currentMonth: currentSummary.totalExpenses,
                lastMonth: lastExpenses,
                difference: parseFloat(difference.toFixed(2)),
                percentageChange: parseFloat(percentageChange),
                trend: difference > 0 ? 'up' : difference < 0 ? 'down' : 'stable'
            };
        } catch (error) {
            return { error: 'Erro ao comparar dados' };
        }
    }

    /**
     * Exporta dados para CSV
     */
    exportToCSV() {
        const header = 'Data,Tipo,Categoria,Descrição,Valor\n';
        const rows = this.data.transactions.map(t => {
            const date = new Date(t.date).toLocaleDateString('pt-BR');
            const type = t.type === 'expense' ? 'Despesa' : 'Receita';
            return `${date},${type},${t.category},"${t.description}",${t.amount}`;
        }).join('\n');

        return header + rows;
    }
}

module.exports = FinanceTracker;
