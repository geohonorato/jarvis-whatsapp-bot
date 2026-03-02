const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { pipeline } = require('@xenova/transformers');

require('dotenv').config();
// --- Configurações Iniciais ---
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MEMORY_EXTRACTOR_MODEL = process.env.MEMORY_MODEL || 'llama-3.1-8b-instant';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MEMORIES_FILE = path.join(__dirname, '../../../data/memories.json');

// --- Cosine Similarity (JavaScript Puro) ---
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
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

        this.SEARCH_LIMIT = 20;
        this.SIMILARITY_THRESHOLD = 0.2; // Diminuído para permitir matches corretos no MiniLM que usa distâncias diferentes.
        this.MAX_RESULTS = 15;
        this.extractor = null;

        this._loadMemories();
    }

    _loadMemories() {
        try {
            if (fs.existsSync(MEMORIES_FILE)) {
                const data = fs.readFileSync(MEMORIES_FILE, 'utf-8');
                this.memories = JSON.parse(data);
                console.log(`🧠 [RAG-JS] ${this.memories.length} memórias carregadas.`);
            } else {
                this.memories = [];
            }
        } catch (e) {
            console.error('❌ Erro ao ler memories.json:', e);
            this.memories = [];
        }
    }

    _saveMemories() {
        try {
            const dir = path.dirname(MEMORIES_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            fs.writeFileSync(MEMORIES_FILE, JSON.stringify(this.memories, null, 2));
        } catch (e) {
            console.error('❌ Erro ao salvar memories.json:', e);
        }
    }

    async _getEmbedding(text) {
        try {
            if (!this.extractor) {
                console.log('⏳ Inicializando modelo de embeddings local...');
                // Usa onnxruntime-node por debaixo dos panos. É ultra-rápido.
                this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            }

            // output vector length 384
            const output = await this.extractor(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data);

        } catch (e) {
            console.error('❌ Erro ao gerar embedding (Transformers.js):', e);
            throw e;
        }
    }

    // --- Métodos Principais ---
    async initialize() {
        // Mock rápido caso arquivos/pastas não existam
        if (!fs.existsSync(MEMORIES_FILE)) {
            this._saveMemories();
        }
        console.log('✅ RAG Service Javascript Pronto!');
    }

    async adicionarMemoria(text, metadata = {}) {
        try {
            // Verifica deduplicação
            const existing = await this._searchLocal(text, 1);
            if (existing.length > 0) {
                const closest = existing[0];
                if (closest._similarity > 0.85) { // Quase idêntico
                    console.log(`🔄 Memória duplicada ignorada (sim=${closest._similarity.toFixed(3)}): "${text.substring(0, 50)}..."`);
                    return false;
                }
            }

            // Gera Vetor Rapidamente pela API Google
            const vector = await this._getEmbedding(text);

            this.memories.push({
                text: text,
                vector: vector,
                metadata: JSON.stringify(metadata),
                timestamp: Date.now()
            });

            this._saveMemories();
            console.log(`🧠 Nova Memória: "${text.substring(0, 50)}..."`);
            return true;

        } catch (e) {
            console.error('❌ Erro adicionarMemoria:', e);
            return false;
        }
    }

    async _searchLocal(query, limit = this.SEARCH_LIMIT) {
        if (this.memories.length === 0) return [];

        try {
            const queryVector = await this._getEmbedding(query);

            // Calcula similaridade para todas memórias em memória (JavaScript aguenta milhares rapidamente)
            let scored = this.memories.map(m => ({
                text: m.text,
                metadata: m.metadata,
                timestamp: m.timestamp,
                _similarity: cosineSimilarity(queryVector, m.vector)
            }));

            // Ordena decrecente e aplica o limite
            scored.sort((a, b) => b._similarity - a._similarity);

            return scored.slice(0, limit);
        } catch (e) {
            console.error('❌ Erro RAG Local Search:', e);
            return [];
        }
    }

    async buscarContexto(query) {
        // 1. Verifica RAM
        const cacheKey = query.toLowerCase().trim();
        if (this.semanticCache.has(cacheKey)) {
            console.log(`⚡ [RAG CACHE HIT] "${cacheKey.substring(0, 30)}..."`);
            return this.semanticCache.get(cacheKey);
        }

        try {
            const notionApi = require('../api/notion');

            // Híbrido: Local JS search + Notion
            const pLocal = this._searchLocal(query, this.SEARCH_LIMIT);

            const pNotion = notionApi.isReady() ? notionApi.search(query) : Promise.resolve({ success: false, data: [] });
            const pNotionWithTimeout = Promise.race([
                pNotion,
                new Promise(resolve => setTimeout(() => resolve({ success: false, timeout: true }), 1500))
            ]);

            const [localResults, notionRes] = await Promise.all([pLocal, pNotionWithTimeout]);

            if (notionRes.timeout) {
                console.log('⏳ Busca Notion excedeu 1.5s.');
            }

            let relevant = [];

            // Adiciona locais relevantes
            relevant = localResults.filter(doc => doc._similarity > this.SIMILARITY_THRESHOLD).slice(0, this.MAX_RESULTS);
            if (relevant.length > 0) {
                console.log(`🧠 Memórias locais relevantes: ${relevant.length}/${localResults.length} (limit=${this.SIMILARITY_THRESHOLD})`);
            }

            // Notion Fake Docs
            if (notionRes.success && notionRes.data && notionRes.data.length > 0) {
                const notionItems = notionRes.data.filter(item => item.extracted_content).slice(0, 2);
                if (notionItems.length > 0) {
                    console.log(`📓 Memórias do Notion: ${notionItems.length}`);
                    notionItems.forEach(item => {
                        let title = 'Notion';
                        if (item.properties) { /* ... extração complexa Notion ... */ }
                        const content = item.extracted_content.substring(0, 1500);
                        relevant.push({ text: `[FONTE Notion]\n${content}...`, metadata: '{}', _similarity: 0.99 });
                    });
                }
            }

            // Exibe para debug
            if (relevant.length > 0) {
                relevant.forEach((doc, i) => {
                    const sim = doc._similarity !== undefined ? doc._similarity.toFixed(3) : 'notn';
                    console.log(`   ${i + 1}. [sim=${sim}] ${doc.text.substring(0, 70).replace(/\\n/g, ' ')}...`);
                });
            }

            if (this.semanticCache.size > 100) this.semanticCache.clear();
            this.semanticCache.set(cacheKey, relevant);

            return relevant;
        } catch (e) {
            console.error('❌ Erro buscarContexto:', e);
            return [];
        }
    }

    async extrairEMemorizar(mensagemUsuario, respostaIA, chatId) {
        try {
            if (!GROQ_API_KEY) return;
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: MEMORY_EXTRACTOR_MODEL,
                temperature: 0,
                max_tokens: 512,
                messages: [
                    {
                        role: 'system',
                        content: `Você é um extrator de fatos. Analise a conversa e extraia APENAS fatos PERMANENTES e IMPORTANTES sobre o usuário.
Regras:
- Extraia APENAS informações duradouras (nome, profissão, hobbies, preferências, software que usa, família, etc.)
- Use a resposta do assistente para CONTEXTO (resolver pronomes como "ele", "isso", etc.)
- NÃO re-extraia fatos que o assistente já mencionou saber (vindos da memória)
- NÃO extraia informações temporárias (humor, o que está fazendo agora, perguntas)
- NÃO extraia informações sobre o assistente
- SEPARE cada fato em um item individual
- Se não houver fatos NOVOS e IMPORTANTES, retorne um array vazio
Responda APENAS com JSON válido: [{"fact": "texto do fato"}] ou []
Exemplos:
Usuário: "Sou médico e moro em Belém" → [{"fact": "O usuário é médico"}, {"fact": "O usuário mora em Belém"}]
Usuário: "Que horas são?" → []
Usuário: "ok, eu uso ele" (contexto: falando sobre DaVinci Resolve) → [{"fact": "O usuário usa DaVinci Resolve"}]`
                    },
                    {
                        role: 'user',
                        content: `MENSAGEM DO USUÁRIO: "${mensagemUsuario}"\nCONTEXTO (resposta do assistente): "${respostaIA.substring(0, 300)}"`
                    }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            const content = response.data.choices[0]?.message?.content?.trim();
            if (!content) return;

            let facts;
            try {
                facts = JSON.parse(content);
            } catch {
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    facts = JSON.parse(jsonMatch[0]);
                } else {
                    return;
                }
            }

            if (!Array.isArray(facts) || facts.length === 0) return;

            for (const item of facts) {
                if (item.fact && item.fact.length > 5) {
                    console.log(`🧠 Memória auto-extraída: "${item.fact}"`);
                    await this.adicionarMemoria(item.fact, {
                        source: 'auto_extractor',
                        chatId: chatId,
                        date: new Date().toISOString()
                    });
                }
            }
        } catch (e) { }
    }
}

module.exports = new RagService();
