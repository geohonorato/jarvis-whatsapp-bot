const fs = require('fs');
const path = require('path');
const axios = require('axios');

require('dotenv').config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MEMORIES_FILE = path.join(__dirname, '../../../data/memories.json');

// Usa DeepSeek se disponível, senão Groq com modelo barato
const extractorConfig = DEEPSEEK_API_KEY 
    ? { url: 'https://api.deepseek.com/v1', key: DEEPSEEK_API_KEY, model: 'deepseek-chat' }
    : { url: 'https://api.groq.com/openai/v1', key: GROQ_API_KEY, model: 'llama-3.1-8b-instant' };

// --- Cosine Similarity ---
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

class RagService {
    constructor() {
        this.memories = [];
        this.semanticCache = new Map();
        this.SIMILARITY_THRESHOLD = 0.4;
        this.MAX_RESULTS = 3;
        this.extractor = null;
        this._loadMemories();
    }

    _loadMemories() {
        try {
            if (fs.existsSync(MEMORIES_FILE)) {
                const data = fs.readFileSync(MEMORIES_FILE, 'utf-8');
                this.memories = JSON.parse(data);
                console.log(`🧠 [RAG] ${this.memories.length} memórias carregadas.`);
            }
        } catch (e) {
            console.error('❌ Erro ao ler memories.json:', e.message);
            this.memories = [];
        }
    }

    _saveMemories() {
        try {
            const dir = path.dirname(MEMORIES_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(MEMORIES_FILE, JSON.stringify(this.memories, null, 2));
        } catch (e) {
            console.error('❌ Erro ao salvar memories.json:', e.message);
        }
    }

    async _getEmbedding(text) {
        try {
            if (!this.extractor) {
                console.log('⏳ Carregando modelo de embeddings (MiniLM)...');
                const { pipeline } = await import('@huggingface/transformers');
                this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
                console.log('✅ Modelo MiniLM carregado!');
            }
            const output = await this.extractor(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data);
        } catch (e) {
            console.error('❌ Erro embedding:', e.message);
            throw e;
        }
    }

    async initialize() {
        if (!fs.existsSync(MEMORIES_FILE)) {
            this._saveMemories();
        }
        console.log('✅ RAG Service pronto!');
    }

    async adicionarMemoria(text, metadata = {}) {
        try {
            // Deduplicação
            const existing = await this._searchLocal(text, 1);
            if (existing.length > 0 && existing[0]._similarity > 0.85) {
                return false;
            }

            const vector = await this._getEmbedding(text);
            this.memories.push({
                text,
                vector,
                metadata: JSON.stringify(metadata),
                timestamp: Date.now()
            });

            this._saveMemories();
            console.log(`🧠 Nova memória: "${text.substring(0, 60)}..."`);
            return true;
        } catch (e) {
            console.error('❌ Erro adicionarMemoria:', e.message);
            return false;
        }
    }

    async _searchLocal(query, limit = 10) {
        if (this.memories.length === 0) return [];

        try {
            const queryVector = await this._getEmbedding(query);
            let scored = this.memories.map(m => ({
                text: m.text,
                metadata: m.metadata,
                timestamp: m.timestamp,
                _similarity: cosineSimilarity(queryVector, m.vector)
            }));

            scored.sort((a, b) => b._similarity - a._similarity);
            return scored.slice(0, limit);
        } catch (e) {
            console.error('❌ Erro busca local:', e.message);
            return [];
        }
    }

    async buscarContexto(query) {
        const cacheKey = query.toLowerCase().trim();
        if (this.semanticCache.has(cacheKey)) {
            console.log('⚡ [RAG CACHE HIT]');
            return this.semanticCache.get(cacheKey);
        }

        try {
            const results = await this._searchLocal(query, this.MAX_RESULTS * 2);
            const relevant = results
                .filter(doc => doc._similarity > this.SIMILARITY_THRESHOLD)
                .slice(0, this.MAX_RESULTS);

            if (relevant.length > 0) {
                console.log(`🧠 Memórias relevantes: ${relevant.length}`);
                relevant.forEach((doc, i) => {
                    console.log(`   ${i + 1}. [sim=${doc._similarity.toFixed(3)}] ${doc.text.substring(0, 70)}...`);
                });
            }

            // Limita cache a 50 entries
            if (this.semanticCache.size > 50) this.semanticCache.clear();
            this.semanticCache.set(cacheKey, relevant);
            return relevant;
        } catch (e) {
            console.error('❌ Erro buscarContexto:', e.message);
            return [];
        }
    }

    _syncToObsidian(fact, dateObj = new Date()) {
        try {
            const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
            if (!vaultPath) return;

            const cloneDir = path.join(vaultPath, '20 - Áreas', 'Clone Digital');
            const fatosFile = path.join(cloneDir, 'Fatos do Jarvis.md');

            const pad = (n) => n.toString().padStart(2, '0');
            const dataStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
            
            const bullet = `- **[${dataStr}]**: ${fact}\n`;

            if (!fs.existsSync(cloneDir)) {
                fs.mkdirSync(cloneDir, { recursive: true });
            }

            if (!fs.existsSync(fatosFile)) {
                const header = `---\nname: Fatos do Jarvis\ndescription: Base de conhecimento permanente extraída automaticamente de conversas\ntype: memórias\n---\n\n# 🧠 Fatos do Jarvis\n\n> Base de conhecimento permanente extraída passivamente das conversas.\n\n`;
                fs.writeFileSync(fatosFile, header, 'utf-8');
            }

            fs.appendFileSync(fatosFile, bullet, 'utf-8');
            console.log(`📝 [RAG] Fato sincronizado com Obsidian: ${fact.substring(0, 30)}...`);
        } catch (e) {
            console.error('❌ Erro ao sincronizar com Obsidian:', e.message);
        }
    }

    /**
     * Extrai fatos permanentes da conversa e memoriza (background)
     */
    async extrairEMemorizar(mensagemUsuario, respostaIA, chatId) {
        try {
            if (!extractorConfig.key) return;

            const response = await axios.post(`${extractorConfig.url}/chat/completions`, {
                model: extractorConfig.model,
                temperature: 0,
                max_tokens: 256,
                messages: [
                    {
                        role: 'system',
                        content: `Extrator de fatos. Analise a conversa e extraia APENAS fatos PERMANENTES sobre o usuário.
Regras:
- Só informações duradouras (nome, profissão, hobbies, preferências, família)
- NÃO extraia perguntas, humor, ou o que está fazendo agora
- NÃO re-extraia o que o assistente já sabe
- Separe cada fato individualmente
- Se não houver fatos novos, retorne []
Responda APENAS JSON: [{"fact": "texto"}] ou []`
                    },
                    {
                        role: 'user',
                        content: `USUÁRIO: "${mensagemUsuario}"\nRESPOSTA: "${respostaIA.substring(0, 200)}"`
                    }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${extractorConfig.key}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            const content = response.data.choices[0]?.message?.content?.trim();
            if (!content) return;

            let facts;
            try {
                facts = JSON.parse(content.replace(/<think>[\s\S]*?<\/think>/g, '').trim());
            } catch {
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) facts = JSON.parse(jsonMatch[0]);
                else return;
            }

            if (!Array.isArray(facts) || facts.length === 0) return;

            for (const item of facts) {
                if (item.fact && item.fact.length > 5) {
                    const dateObj = new Date();
                    const added = await this.adicionarMemoria(item.fact, {
                        source: 'auto_extractor',
                        chatId,
                        date: dateObj.toISOString()
                    });
                    if (added) {
                        this._syncToObsidian(item.fact, dateObj);
                    }
                }
            }
        } catch (e) {
            // Silencioso — não deve afetar a experiência do usuário
        }
    }
}

module.exports = new RagService();
