const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');

// Configuração do Groq para extração de memória (lightweight)
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MEMORY_EXTRACTOR_MODEL = 'llama-3.1-8b-instant'; // Modelo rápido e barato

class RagService {
    constructor() {
        this.scriptPath = path.join(__dirname, 'rag_db.py');
        this.pythonProcess = null;
        this.readLineInterface = null;
        this.pendingRequests = [];
        this.commandQueue = [];
        this.isReady = false;

        // Configurações de busca dinâmica
        this.SEARCH_LIMIT = 20;          // Busca até 20 candidatos
        this.DISTANCE_THRESHOLD = 1.2;   // Threshold para all-mpnet-base-v2 (distâncias maiores que MiniLM)
        this.MAX_RESULTS = 15;           // Máximo de resultados retornados
    }

    startProcess() {
        if (this.pythonProcess) return;

        console.log('🧠 Inicializando processo RAG (Persistent)...');

        this.pythonProcess = spawn('python', [this.scriptPath], {
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        const readline = require('readline');
        this.readLineInterface = readline.createInterface({
            input: this.pythonProcess.stdout,
            terminal: false
        });

        this.readLineInterface.on('line', (line) => {
            this.handleOutput(line);
        });

        this.pythonProcess.stderr.on('data', (data) => {
            console.error('⚠️ RAG Python Stderr:', data.toString());
        });

        this.pythonProcess.on('close', (code) => {
            console.error(`❌ Processo RAG encerrou com código ${code}. Tentando reiniciar...`);
            this.pythonProcess = null;
            this.isReady = false;
            while (this.pendingRequests.length > 0) {
                const req = this.pendingRequests.shift();
                req.reject(new Error('Processo RAG morreu inesperadamente.'));
            }
            setTimeout(() => this.startProcess(), 5000);
        });
    }

    handleOutput(line) {
        try {
            const data = JSON.parse(line);

            if (data.status === 'info') {
                console.log('ℹ️ RAG Info:', data.message);
                return;
            }
            if (data.status === 'ready') {
                console.log('✅ RAG Service Pronto!');
                this.isReady = true;
                return;
            }
            if (data.status === 'fatal') {
                console.error('❌ RAG Fatal Error:', data.message);
                return;
            }

            if (this.pendingRequests.length > 0) {
                const req = this.pendingRequests.shift();
                req.resolve(data);
            }

        } catch (e) {
            console.error('❌ Erro parse JSON RAG:', e, 'Linha:', line);
        }
    }

    async sendCommand(command, args = {}) {
        if (!this.pythonProcess) {
            this.startProcess();
            await new Promise(r => setTimeout(r, 2000));
        }

        return new Promise((resolve, reject) => {
            const payload = JSON.stringify({ command, args }) + '\n';
            this.pendingRequests.push({ resolve, reject });

            try {
                this.pythonProcess.stdin.write(payload);
            } catch (e) {
                this.pendingRequests.pop();
                reject(e);
            }
        });
    }

    // --- Métodos Públicos ---

    async initialize() {
        this.startProcess();
    }

    async adicionarMemoria(text, metadata = {}) {
        try {
            // DEDUPLICAÇÃO: Verifica se já existe memória muito similar
            const existing = await this.sendCommand('search', { query: text, limit: 1 });
            if (existing.status === 'success' && existing.data && existing.data.length > 0) {
                const closest = existing.data[0];
                if (closest._distance < 0.3) {
                    console.log(`🔄 Memória duplicada ignorada (dist=${closest._distance.toFixed(3)}): "${text.substring(0, 50)}..."`); return false; // Já existe uma memória muito similar
                }
            }

            const metaStr = JSON.stringify(metadata);
            const res = await this.sendCommand('add', { text, metadata: metaStr });
            return res.status === 'success';
        } catch (e) {
            console.error('❌ Erro adicionarMemoria:', e);
            return false;
        }
    }

    /**
     * Busca contexto DINÂMICO — filtra por score de similaridade.
     * Retorna de 0 a MAX_RESULTS memórias, dependendo da relevância.
     */
    async buscarContexto(query) {
        try {
            const res = await this.sendCommand('search', { query, limit: this.SEARCH_LIMIT });
            if (res.status === 'success' && res.data) {
                // Filtra por threshold de distância (menor = mais similar)
                const relevant = res.data
                    .filter(doc => doc._distance < this.DISTANCE_THRESHOLD)
                    .slice(0, this.MAX_RESULTS);

                if (relevant.length > 0) {
                    console.log(`🧠 Memórias relevantes: ${relevant.length}/${res.data.length} (threshold: ${this.DISTANCE_THRESHOLD})`);
                    relevant.forEach((doc, i) => {
                        console.log(`   ${i + 1}. [dist=${doc._distance.toFixed(3)}] ${doc.text.substring(0, 60)}...`);
                    });
                }

                return relevant;
            }
            return [];
        } catch (e) {
            console.error('❌ Erro buscarContexto:', e);
            return [];
        }
    }

    /**
     * MEMORY EXTRACTOR — Analisa a conversa e extrai fatos permanentes.
     * Roda em background (fire-and-forget) para não atrasar a resposta.
     */
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

            // Parse JSON
            let facts;
            try {
                facts = JSON.parse(content);
            } catch {
                // Tenta extrair JSON de dentro do texto
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    facts = JSON.parse(jsonMatch[0]);
                } else {
                    return;
                }
            }

            if (!Array.isArray(facts) || facts.length === 0) return;

            // Salva cada fato no RAG
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

        } catch (e) {
            // Silencioso — não deve afetar a experiência do usuário
            console.error('⚠️ Memory Extractor falhou (não-crítico):', e.message);
        }
    }
}

module.exports = new RagService();
