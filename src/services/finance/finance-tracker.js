const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class FinanceTracker {
    constructor() {
        this.dataDir = path.join(__dirname, '../../../data');
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        
        this.dbPath = path.join(this.dataDir, 'finances.db');
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('❌ Erro ao conectar no SQLite:', err.message);
            } else {
                console.log('✅ SQLite conectado: finances.db');
                this.initDb();
            }
        });

        // Configuração padrão que antes ficava em JSON
        this.config = {
            monthlyBudget: 0,
            categories: [
                'Alimentação', 'Transporte', 'Saúde', 'Lazer',
                'Moradia', 'Educação', 'Vestuário', 'Serviços', 'Outros'
            ]
        };
    }

    initDb() {
        this.db.serialize(() => {
            this.db.run(`CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT,
                type TEXT,
                amount REAL,
                category TEXT,
                description TEXT,
                source TEXT,
                necessity_label TEXT,
                necessity_score INTEGER
            )`);

            this.db.run(`CREATE TABLE IF NOT EXISTS configs (
                key TEXT PRIMARY KEY,
                value TEXT
            )`);
        });
    }

    runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    getQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    analyzeNecessity(category, description) {
        // Lógica simplificada de necessidade baseada em categorias e palavras-chave.
        const descLower = (description || '').toLowerCase();
        let maxScore = 50; 
        let label = 'Moderado';
        
        const isEssential = category === 'Moradia' || category === 'Saúde' || descLower.includes('aluguel') || descLower.includes('médico') || descLower.includes('remédio');
        const isImportant = category === 'Educação' || category === 'Transporte' || descLower.includes('curso') || descLower.includes('ônibus');
        const isLazer = category === 'Lazer' || descLower.includes('ifood') || descLower.includes('cinema');

        if (isEssential) { maxScore = 90; label = 'Essencial'; }
        else if (isImportant) { maxScore = 70; label = 'Importante'; }
        else if (isLazer) { maxScore = 15; label = 'Supérfluo'; }

        return { score: maxScore, label };
    }

    async addExpense(amount, category, description = '', source = 'manual') {
        if (amount <= 0) return { error: 'Valor deve ser maior que zero' };
        
        const necessity = this.analyzeNecessity(category, description);
        const date = new Date().toISOString();
        
        await this.runQuery(
            `INSERT INTO transactions (date, type, amount, category, description, source, necessity_label, necessity_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [date, 'expense', amount, category, description, source, necessity.label, necessity.score]
        );

        console.log(`💸 Despesa: R$${amount} - ${category} [${necessity.label}]`);
        return { success: true, transaction: { amount, category, description, necessity } };
    }

    async addIncome(amount, category = 'Receita', description = '', source = 'manual') {
        if (amount <= 0) return { error: 'Valor deve ser maior que zero' };
        const date = new Date().toISOString();
        
        await this.runQuery(
            `INSERT INTO transactions (date, type, amount, category, description, source) VALUES (?, ?, ?, ?, ?, ?)`,
            [date, 'income', amount, category, description, source]
        );

        console.log(`💰 Receita: R$${amount} - ${category}`);
        return { success: true, transaction: { amount, category, description } };
    }

    async getMonthSummary(monthStr = new Date().toISOString().slice(0, 7)) {
        const rows = await this.getQuery(`SELECT * FROM transactions WHERE date LIKE ?`, [`${monthStr}%`]);
        
        let expenses = 0;
        let income = 0;
        const byCategory = {};

        rows.forEach(t => {
            if (t.type === 'expense') {
                expenses += t.amount;
                byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
            } else {
                income += t.amount;
            }
        });

        const topCategories = Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, amount]) => ({ category: cat, amount: parseFloat(amount.toFixed(2)) }));

        return {
            month: monthStr,
            totalExpenses: parseFloat(expenses.toFixed(2)),
            totalIncome: parseFloat(income.toFixed(2)),
            balance: parseFloat((income - expenses).toFixed(2)),
            transactionCount: rows.length,
            topCategories
        };
    }
}

module.exports = new FinanceTracker();
