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
            transactions: [], // { date, type: 'expense|income', amount, category, description, source, necessity, necessityScore }
            budgets: {}, // { category: amount }
            recurringTransactions: [] // { type, amount, category, description, dayOfMonth }
        };

        // Mapa de necessidade por categoria e keywords
        this.necessityMap = {
            // Essencial (80-100)
            essential: {
                keywords: ['aluguel', 'água', 'luz', 'gás', 'internet', 'condomínio', 'iptu', 'remédio', 'médico', 'hospital', 'farmácia', 'saúde', 'supermercado', 'mercado', 'feira', 'pão', 'leite', 'arroz', 'feijão'],
                categories: ['Moradia', 'Saúde'],
                baseScore: 90
            },
            // Importante (60-79)
            important: {
                keywords: ['trabalho', 'transporte', 'combustível', 'gasolina', 'ônibus', 'metrô', 'educação', 'curso', 'livro', 'faculdade', 'escola', 'roupa trabalho', 'uniforme'],
                categories: ['Transporte', 'Educação'],
                baseScore: 70
            },
            // Moderado (40-59)
            moderate: {
                keywords: ['almoço', 'jantar', 'café', 'lanche', 'comida', 'alimentação', 'roupa', 'calça', 'camisa', 'sapato', 'corte cabelo', 'barbeiro'],
                categories: ['Alimentação', 'Vestuário'],
                baseScore: 50
            },
            // Dispensável (20-39)
            dispensable: {
                keywords: ['fast food', 'delivery', 'ifood', 'uber eats', 'lanche noite', 'salgado', 'doce', 'chocolate', 'refrigerante', 'cerveja'],
                categories: [],
                baseScore: 30
            },
            // Supérfluo (0-19)
            superfluous: {
                keywords: ['cinema', 'streaming', 'netflix', 'spotify', 'game', 'jogo', 'balada', 'bar', 'festa', 'show', 'viagem lazer', 'shopping', 'compra impulso'],
                categories: ['Lazer'],
                baseScore: 10
            }
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
     * Analisa necessidade de um gasto
     * Retorna score de 0-100 (0 = supérfluo, 100 = essencial)
     */
    analyzeNecessity(category, description) {
        const descLower = description.toLowerCase();
        let maxScore = 0;
        let necessityLevel = 'moderate';

        // Analisa keywords na descrição
        for (const [level, data] of Object.entries(this.necessityMap)) {
            const hasKeyword = data.keywords.some(keyword => descLower.includes(keyword));
            const isCategory = data.categories.includes(category);

            if (hasKeyword || isCategory) {
                if (data.baseScore > maxScore) {
                    maxScore = data.baseScore;
                    necessityLevel = level;
                }
            }
        }

        // Se não encontrou match específico, usa categoria padrão
        if (maxScore === 0) {
            if (category === 'Moradia' || category === 'Saúde') {
                maxScore = 90;
                necessityLevel = 'essential';
            } else if (category === 'Transporte' || category === 'Educação') {
                maxScore = 70;
                necessityLevel = 'important';
            } else if (category === 'Alimentação' || category === 'Vestuário') {
                maxScore = 50;
                necessityLevel = 'moderate';
            } else if (category === 'Lazer') {
                maxScore = 10;
                necessityLevel = 'superfluous';
            } else {
                maxScore = 40;
                necessityLevel = 'moderate';
            }
        }

        // Ajusta score baseado em contexto adicional
        if (descLower.includes('essencial') || descLower.includes('urgente') || descLower.includes('necessário')) {
            maxScore = Math.min(100, maxScore + 10);
        }
        if (descLower.includes('impulso') || descLower.includes('queria') || descLower.includes('vontade')) {
            maxScore = Math.max(0, maxScore - 15);
            necessityLevel = maxScore < 20 ? 'superfluous' : necessityLevel;
        }

        return {
            score: maxScore,
            level: necessityLevel,
            label: this.getNecessityLabel(maxScore),
            emoji: this.getNecessityEmoji(maxScore),
            color: this.getNecessityColor(maxScore)
        };
    }

    /**
     * Retorna label descritiva baseada no score
     */
    getNecessityLabel(score) {
        if (score >= 80) return 'Essencial';
        if (score >= 60) return 'Importante';
        if (score >= 40) return 'Moderado';
        if (score >= 20) return 'Dispensável';
        return 'Supérfluo';
    }

    /**
     * Retorna emoji baseado no score
     */
    getNecessityEmoji(score) {
        if (score >= 80) return '🔴'; // Essencial
        if (score >= 60) return '🟠'; // Importante
        if (score >= 40) return '🟡'; // Moderado
        if (score >= 20) return '🟢'; // Dispensável
        return '🔵'; // Supérfluo
    }

    /**
     * Retorna cor baseada no score
     */
    getNecessityColor(score) {
        if (score >= 80) return 'red';
        if (score >= 60) return 'orange';
        if (score >= 40) return 'yellow';
        if (score >= 20) return 'green';
        return 'blue';
    }

    /**
     * Registra uma despesa
     */
    addExpense(amount, category, description = '', source = 'manual') {
        if (amount <= 0) {
            return { error: 'Valor deve ser maior que zero' };
        }

        // Analisa necessidade do gasto
        const necessity = this.analyzeNecessity(category, description);

        const transaction = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            type: 'expense',
            amount: parseFloat(amount.toFixed(2)),
            category: category || 'Outros',
            description,
            source,
            necessity: necessity.level,
            necessityScore: necessity.score,
            necessityLabel: necessity.label,
            necessityEmoji: necessity.emoji
        };

        this.data.transactions.push(transaction);
        this.saveData();

        console.log(`💸 Despesa registrada: R$${amount} - ${category} [${necessity.emoji} ${necessity.label}]`);
        return { success: true, transaction, necessity };
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

        // Análise de necessidade dos gastos
        const expenseTransactions = this.data.transactions.filter(t => t.type === 'expense');
        const necessityAnalysis = {
            essential: { amount: 0, count: 0, percentage: 0 },      // 80-100
            important: { amount: 0, count: 0, percentage: 0 },      // 60-79
            moderate: { amount: 0, count: 0, percentage: 0 },       // 40-59
            dispensable: { amount: 0, count: 0, percentage: 0 },    // 20-39
            superfluous: { amount: 0, count: 0, percentage: 0 }     // 0-19
        };

        expenseTransactions.forEach(t => {
            const score = t.necessityScore || 50; // Fallback para transações antigas
            if (score >= 80) {
                necessityAnalysis.essential.amount += t.amount;
                necessityAnalysis.essential.count++;
            } else if (score >= 60) {
                necessityAnalysis.important.amount += t.amount;
                necessityAnalysis.important.count++;
            } else if (score >= 40) {
                necessityAnalysis.moderate.amount += t.amount;
                necessityAnalysis.moderate.count++;
            } else if (score >= 20) {
                necessityAnalysis.dispensable.amount += t.amount;
                necessityAnalysis.dispensable.count++;
            } else {
                necessityAnalysis.superfluous.amount += t.amount;
                necessityAnalysis.superfluous.count++;
            }
        });

        // Calcula percentuais
        for (const level in necessityAnalysis) {
            necessityAnalysis[level].amount = parseFloat(necessityAnalysis[level].amount.toFixed(2));
            necessityAnalysis[level].percentage = expenses > 0
                ? parseFloat(((necessityAnalysis[level].amount / expenses) * 100).toFixed(1))
                : 0;
        }

        // Gastos evitáveis (dispensável + supérfluo)
        const avoidableExpenses = necessityAnalysis.dispensable.amount + necessityAnalysis.superfluous.amount;
        const avoidablePercentage = expenses > 0
            ? parseFloat(((avoidableExpenses / expenses) * 100).toFixed(1))
            : 0;

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
            averageDailyExpense: parseFloat((expenses / new Date().getDate()).toFixed(2)),
            necessityAnalysis,
            avoidableExpenses: parseFloat(avoidableExpenses.toFixed(2)),
            avoidablePercentage
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

    /**
     * Importa transações em lote (de extrato/fatura PDF)
     * Detecta duplicatas por data + valor + descrição
     * @param {Array} transactions - [{date, type, amount, category, description}]
     * @param {string} source - 'extrato', 'fatura', etc.
     * @param {string} refMonth - Mês de referência YYYY-MM (opcional)
     * @returns {{ imported, duplicates, total, summary }}
     */
    importTransactions(transactions, source = 'extrato', refMonth = null) {
        if (!Array.isArray(transactions) || transactions.length === 0) {
            return { error: 'Nenhuma transação para importar' };
        }

        let imported = 0;
        let duplicates = 0;
        let totalExpenses = 0;
        let totalIncome = 0;

        for (const t of transactions) {
            const amount = parseFloat(t.amount);
            if (isNaN(amount) || amount <= 0) continue;

            // Normaliza a data
            let dateStr;
            try {
                const parsed = t.date ? new Date(t.date) : new Date();
                dateStr = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
            } catch {
                dateStr = new Date().toISOString();
            }

            // Verifica duplicata (mesma data + valor + descrição similar)
            const descNorm = (t.description || '').toLowerCase().trim();
            const isDuplicate = this.data.transactions.some(existing => {
                if (existing.source !== source) return false;
                const existingDesc = (existing.description || '').toLowerCase().trim();
                const existingDate = existing.date.slice(0, 10);
                const newDate = dateStr.slice(0, 10);
                return existingDate === newDate &&
                    Math.abs(existing.amount - amount) < 0.01 &&
                    existingDesc === descNorm;
            });

            if (isDuplicate) {
                duplicates++;
                continue;
            }

            const type = (t.type || 'expense').toLowerCase();
            const category = t.category || 'Outros';
            const necessity = type === 'expense' ? this.analyzeNecessity(category, t.description || '') : null;

            const transaction = {
                id: `${Date.now()}-${imported}`,
                date: dateStr,
                type,
                amount: parseFloat(amount.toFixed(2)),
                category,
                description: t.description || '',
                source,
                ...(necessity && {
                    necessity: necessity.level,
                    necessityScore: necessity.score,
                    necessityLabel: necessity.label,
                    necessityEmoji: necessity.emoji
                })
            };

            this.data.transactions.push(transaction);
            imported++;

            if (type === 'expense') totalExpenses += amount;
            else totalIncome += amount;
        }

        this.saveData();

        console.log(`📥 Importação: ${imported} transações importadas, ${duplicates} duplicatas ignoradas`);

        return {
            imported,
            duplicates,
            total: transactions.length,
            totalExpenses: parseFloat(totalExpenses.toFixed(2)),
            totalIncome: parseFloat(totalIncome.toFixed(2)),
            source,
            summary: this.getMonthSummary()
        };
    }

    /**
     * Gera dados formatados para criação de gráficos matplotlib
     * @returns {{ byCategory, dailyAccumulated, byNecessity, topExpenses }}
     */
    generateChartData() {
        const expenses = this.data.transactions.filter(t => t.type === 'expense');
        const income = this.data.transactions.filter(t => t.type === 'income');

        // 1. Gastos por categoria (para gráfico de pizza)
        const byCategory = {};
        expenses.forEach(t => {
            byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
        });

        // 2. Gastos diários acumulados (para gráfico de linha)
        const dailyMap = {};
        expenses.forEach(t => {
            const day = new Date(t.date).getDate();
            dailyMap[day] = (dailyMap[day] || 0) + t.amount;
        });

        // Acumula
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const dailyAccumulated = [];
        let accumulated = 0;
        for (let d = 1; d <= Math.min(new Date().getDate(), daysInMonth); d++) {
            accumulated += (dailyMap[d] || 0);
            dailyAccumulated.push({ day: d, accumulated: parseFloat(accumulated.toFixed(2)), daily: parseFloat((dailyMap[d] || 0).toFixed(2)) });
        }

        // 3. Gastos por nível de necessidade (para gráfico de barras/rosca)
        const byNecessity = {
            'Essencial': 0, 'Importante': 0, 'Moderado': 0, 'Dispensável': 0, 'Supérfluo': 0
        };
        expenses.forEach(t => {
            const label = t.necessityLabel || 'Moderado';
            byNecessity[label] = (byNecessity[label] || 0) + t.amount;
        });

        // 4. Top 10 maiores gastos individuais
        const topExpenses = [...expenses]
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10)
            .map(t => ({
                description: t.description || t.category,
                amount: t.amount,
                category: t.category,
                date: new Date(t.date).toLocaleDateString('pt-BR')
            }));

        // 5. Totais
        const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
        const totalIncome = income.reduce((s, t) => s + t.amount, 0);

        return {
            byCategory,
            dailyAccumulated,
            byNecessity,
            topExpenses,
            totalExpenses: parseFloat(totalExpenses.toFixed(2)),
            totalIncome: parseFloat(totalIncome.toFixed(2)),
            balance: parseFloat((totalIncome - totalExpenses).toFixed(2)),
            budget: this.config.monthlyBudget,
            month: this.data.currentMonth,
            transactionCount: this.data.transactions.length
        };
    }

    /**
     * Obtém dados de um mês específico (atual ou arquivo)
     * @param {string} monthStr - YYYY-MM
     * @returns {object|null}
     */
    getMonthData(monthStr) {
        if (monthStr === this.data.currentMonth) {
            return this.data;
        }

        const archiveFile = path.join(this.dataDir, 'archive', `${this.userId}-${monthStr}.json`);
        if (fs.existsSync(archiveFile)) {
            try {
                return JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
            } catch {
                return null;
            }
        }
        return null;
    }
}

module.exports = FinanceTracker;

