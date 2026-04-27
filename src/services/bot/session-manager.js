const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class SessionManager {
    constructor() {
        this.dataDir = path.join(__dirname, '../../../data');
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        
        this.dbPath = path.join(this.dataDir, 'sessions.db');
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('❌ Erro ao conectar no SQLite (sessions):', err.message);
            } else {
                this.initDb();
            }
        });
    }

    initDb() {
        this.db.serialize(() => {
            this.db.run(`CREATE TABLE IF NOT EXISTS sessions (
                chatId TEXT PRIMARY KEY,
                isMeetingActive INTEGER DEFAULT 0,
                meetingStartTime INTEGER,
                metadata TEXT
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
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async startMeeting(chatId) {
        const startTime = Date.now();
        await this.runQuery(
            `INSERT INTO sessions (chatId, isMeetingActive, meetingStartTime) 
             VALUES (?, 1, ?) 
             ON CONFLICT(chatId) DO UPDATE SET isMeetingActive = 1, meetingStartTime = ?`,
            [chatId, startTime, startTime]
        );
        return startTime;
    }

    async endMeeting(chatId) {
        const session = await this.getSession(chatId);
        await this.runQuery(
            `UPDATE sessions SET isMeetingActive = 0, meetingStartTime = NULL WHERE chatId = ?`,
            [chatId]
        );
        return session;
    }

    async getSession(chatId) {
        const row = await this.getQuery(`SELECT * FROM sessions WHERE chatId = ?`, [chatId]);
        if (!row) return { isMeetingActive: 0 };
        return {
            ...row,
            isMeetingActive: !!row.isMeetingActive
        };
    }
}

module.exports = new SessionManager();
