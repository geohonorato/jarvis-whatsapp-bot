const fs = require('fs');
const path = require('path');

class PendingTransactionsManager {
    constructor() {
        this.dbPath = path.join(__dirname, '../../../../data/finances/pending_transactions.json');
        this._ensureDbExists();
    }

    _ensureDbExists() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.dbPath)) {
            fs.writeFileSync(this.dbPath, JSON.stringify({ pending: [] }, null, 2));
        }
    }

    _readDb() {
        try {
            const data = fs.readFileSync(this.dbPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Erro ao ler DB de transações pendentes:', error);
            return { pending: [] };
        }
    }

    _writeDb(data) {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Erro ao escrever DB de transações pendentes:', error);
        }
    }

    /**
     * Adiciona uma transação à fila de pendências.
     */
    addPendingTransaction(transaction) {
        const db = this._readDb();
        const pendingItem = {
            id: Date.now().toString() + Math.random().toString(36).substring(7),
            ...transaction,
            addedAt: new Date().toISOString()
        };
        db.pending.push(pendingItem);
        this._writeDb(db);
        return pendingItem;
    }

    /**
     * Retorna a transação pendente mais antiga da fila, ou null se a fila estiver vazia.
     */
    getNextPending() {
        const db = this._readDb();
        if (db.pending.length > 0) {
            return db.pending[0];
        }
        return null;
    }

    /**
     * Remove uma transação da fila pelo ID.
     */
    removePendingTransaction(id) {
        const db = this._readDb();
        db.pending = db.pending.filter(item => item.id !== id);
        this._writeDb(db);
    }

    /**
     * Conta quantas transações pendentes existem.
     */
    getPendingCount() {
        return this._readDb().pending.length;
    }
}

// Exporta uma instância única (Singleton prático)
module.exports = new PendingTransactionsManager();
