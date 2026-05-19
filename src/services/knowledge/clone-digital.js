/**
 * Clone Digital — Orquestrador dos comportamentos automáticos do vault
 *
 * Implementa o que o CLAUDE.md descreve:
 * 1. Diário de Sessão (criar/atualizar a cada sessão)
 * 2. Extração de fatos → Fatos do Jarvis.md
 * 3. Detecção de decisões → Decisões/
 * 4. Detecção de aprendizados → Aprendizados/
 * 5. Atualização de perfil → Perfil Geovanni.md
 * 6. Gerenciamento de tarefas → Tarefas.md
 *
 * Tudo roda em background, sem bloquear a resposta ao usuário.
 */
const axios = require('axios');
const { vaultPath, ensureDir, readNote, createNote, editNote, appendToSection, noteExists } = require('./vault-writer');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const aiConfig = DEEPSEEK_API_KEY
    ? { url: 'https://api.deepseek.com/v1', key: DEEPSEEK_API_KEY, model: 'deepseek-v4-flash' }
    : { url: 'https://api.groq.com/openai/v1', key: GROQ_API_KEY, model: 'llama-3.1-8b-instant' };

// Controle de sessão — evita múltiplas análises por mensagem
let sessionActive = false;
let sessionDate = null;
let messageCount = 0;
const ANALYZE_EVERY_N_MESSAGES = 3; // Só chama IA de análise a cada 3 mensagens
const pendingFacts = []; // Acumula fatos entre análises

function getTodayStr() {
    // Usa fuso horário brasileiro — servidor OCI roda em UTC
    const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date());
    return `${parts.find(p => p.type === 'day').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'year').value}`;
}

function getSessionDiaryPath() {
    return `20 - Áreas/Clone Digital/Diário de Sessões/Sessão — ${getTodayStr()}`;
}

function getSessionDiaryFilename() {
    return `Sessão — ${getTodayStr()}.md`;
}

// ============================================================
// 1. DIÁRIO DE SESSÃO
// ============================================================

function ensureSessionDiary() {
    const today = getTodayStr();
    if (sessionDate === today && sessionActive) return;

    sessionDate = today;
    sessionActive = true;
    messageCount = 0;

    const folder = '20 - Áreas/Clone Digital/Diário de Sessões';
    const filename = getSessionDiaryFilename();

    if (noteExists(folder, filename)) {
        console.log(`📔 [CloneDigital] Diário de sessão já existe: ${filename}`);
        return;
    }

    const content = `# Sessão — ${today}

## O que foi feito
- Sessão iniciada.

## O que aprendi sobre o Geovanni
-

## Decisões tomadas
-

## Para a próxima vez
-
`;

    createNote(folder, filename, content);
}

/**
 * Adiciona uma entrada ao diário de sessão na seção correta
 */
function recordToSessionDiary(section, entry) {
    ensureSessionDiary();
    const bullet = `- ${entry}\n`;
    return appendToSection(
        [getSessionDiaryPath(), getSessionDiaryFilename()],
        section,
        bullet
    );
}

// ============================================================
// 2. DECISÕES
// ============================================================

function recordDecision(title, context, impact, dateStr = null) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const dateISO = d.toISOString().split('T')[0];
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 60);

    const filename = `${dateISO}-${slug}.md`;
    const folder = '20 - Áreas/Clone Digital/Decisões';

    if (noteExists(folder, filename)) return;

    const content = `# Decisão: ${title}
**Data:** ${dateISO}

## Contexto
${context}

## Impacto
${impact}
`;

    createNote(folder, filename, content);
}

// ============================================================
// 3. APRENDIZADOS
// ============================================================

function recordLearning(title, content, dateStr = null) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const dateISO = d.toISOString().split('T')[0];
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 60);

    const filename = `${dateISO}-${slug}.md`;
    const folder = '20 - Áreas/Clone Digital/Aprendizados';

    if (noteExists(folder, filename)) return;

    const frontmatter = {
        name: slug,
        description: title,
        type: 'aprendizado'
    };

    createNote(folder, filename, content, frontmatter);
}

// ============================================================
// 4. ATUALIZAÇÃO DE PERFIL
// ============================================================

function updateProfile(section, newContent) {
    const notePath = vaultPath('20 - Áreas', 'Clone Digital', 'Perfil Geovanni.md');
    const content = readNote(notePath);
    if (!content) return { success: false, error: 'profile_not_found' };

    // Encontra a seção existente
    const sectionRegex = new RegExp(`^## ${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
    if (!sectionRegex.test(content)) {
        // Seção não existe — adiciona antes da próxima seção ## ou no final
        return appendToSection(['20 - Áreas', 'Clone Digital', 'Perfil Geovanni.md'], `## ${section}`, newContent);
    }

    // Append dentro da seção existente
    return appendToSection(['20 - Áreas', 'Clone Digital', 'Perfil Geovanni.md'], `## ${section}`, newContent);
}

// ============================================================
// 5. TAREFAS
// ============================================================

function addTask(task, section = '📌 Pendente (sem data)') {
    const notePath = vaultPath('01 - Tarefas.md');
    let content = readNote(notePath);
    if (!content) return { success: false, error: 'tarefas_not_found' };

    // Verifica se a tarefa já existe (evita duplicatas)
    if (content.includes(task)) {
        return { success: false, error: 'task_already_exists' };
    }

    return appendToSection(['01 - Tarefas.md'], `### ${section}`, `- [ ] ${task}`);
}

function markTaskComplete(taskFragment) {
    const notePath = vaultPath('01 - Tarefas.md');
    const content = readNote(notePath);
    if (!content) return { success: false, error: 'tarefas_not_found' };

    // Encontra a linha que contém o fragmento e tem [ ]
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(taskFragment) && lines[i].includes('- [ ]')) {
            lines[i] = lines[i].replace('- [ ]', '- [x]');
            require('fs').writeFileSync(notePath, lines.join('\n'), 'utf-8');
            console.log(`✅ [CloneDigital] Tarefa concluída: ${taskFragment}`);
            return { success: true };
        }
    }
    return { success: false, error: 'task_not_found' };
}

// ============================================================
// 6. ANÁLISE DE CONVERSA (IA)
// ============================================================

const EXTRACTOR_SYSTEM_PROMPT = `Você é o Clone Digital do Geovanni. Analise a conversa abaixo e extraia informações para manter o Obsidian Vault vivo.

REGRAS:
1. Só registre informações NOVAS — não repita o que já está estabelecido
2. Seja específico, não genérico
3. Use [[wikilinks]] para referenciar notas, projetos e áreas
4. Prefira silêncio a ruído — se não há nada relevante, retorne campos vazios

Responda APENAS com JSON válido (sem markdown, sem explicações):

{
  "sessionEntries": [
    {"section": "O que foi feito", "entry": "descrição concisa do que foi realizado"},
    {"section": "O que aprendi sobre o Geovanni", "entry": "padrão, preferência ou traço observado"},
    {"section": "Decisões tomadas", "entry": "decisão com contexto breve"},
    {"section": "Para a próxima vez", "entry": "próximo passo identificado"}
  ],
  "decisions": [
    {"title": "título curto", "context": "contexto da decisão", "impact": "impacto esperado"}
  ],
  "learnings": [
    {"title": "título curto", "content": "o que foi aprendido, em 1-2 parágrafos"}
  ],
  "profileUpdates": [
    {"section": "🗣️ Linguagem e Tom", "content": "- Nova observação sobre preferências"}
  ],
  "tasks": [
    {"section": "📌 Pendente (sem data)", "task": "descrição da tarefa"}
  ]
}`;

async function analyzeConversation(historySummary, userMessage, aiResponse) {
    if (!aiConfig.key) return null;

    try {
        const response = await axios.post(`${aiConfig.url}/chat/completions`, {
            model: aiConfig.model,
            temperature: 0,
            max_tokens: 1024,
            messages: [
                { role: 'system', content: EXTRACTOR_SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `CONTEXTO DA CONVERSA:\n${historySummary}\n\nÚLTIMA MENSAGEM DO USUÁRIO: "${userMessage}"\n\nRESPOSTA DO ASSISTENTE: "${aiResponse.substring(0, 500)}"`
                }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${aiConfig.key}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        const content = response.data.choices[0]?.message?.content?.trim();
        if (!content) return null;

        // Parse robusto (DeepSeek pode incluir <think> tags)
        let cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        // Remove marcadores de bloco markdown se existirem
        cleanContent = cleanContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');

        try {
            return JSON.parse(cleanContent);
        } catch {
            const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            return null;
        }
    } catch (e) {
        // Silencioso — análise falha não deve afetar o usuário
        return null;
    }
}

// ============================================================
// 7. PROCESSAMENTO EM BACKGROUND
// ============================================================

let analyzeTimeout = null;
let pendingAnalysis = { userMessages: [], aiResponses: [] };

/**
 * Chamado após cada mensagem. Acumula e dispara análise a cada N mensagens.
 */
async function processConversationTurn(userMessage, aiResponse) {
    ensureSessionDiary();
    messageCount++;

    // Acumula para análise
    pendingAnalysis.userMessages.push(userMessage);
    pendingAnalysis.aiResponses.push(aiResponse);

    // Só chama a IA de análise a cada N mensagens (economiza tokens)
    if (messageCount % ANALYZE_EVERY_N_MESSAGES !== 0) return;

    // Limpa timeout pendente e processa
    if (analyzeTimeout) clearTimeout(analyzeTimeout);

    const historySummary = pendingAnalysis.userMessages
        .map((m, i) => `Usuário: ${m}\nJarvis: ${pendingAnalysis.aiResponses[i]?.substring(0, 200) || ''}`)
        .join('\n\n');

    const lastUser = pendingAnalysis.userMessages[pendingAnalysis.userMessages.length - 1];
    const lastAI = pendingAnalysis.aiResponses[pendingAnalysis.aiResponses.length - 1];

    // Reseta acumulador
    pendingAnalysis = { userMessages: [], aiResponses: [] };

    const analysis = await analyzeConversation(historySummary, lastUser, lastAI);
    if (!analysis) return;

    // Aplica os resultados da análise
    applyAnalysis(analysis);
}

/**
 * Força análise ao final da sessão (quando usuário encerra ou após timeout)
 */
async function finalizeSession() {
    if (!sessionActive) return;

    if (analyzeTimeout) clearTimeout(analyzeTimeout);

    // Processa o que restou no acumulador
    if (pendingAnalysis.userMessages.length > 0) {
        const historySummary = pendingAnalysis.userMessages
            .map((m, i) => `Usuário: ${m}\nJarvis: ${pendingAnalysis.aiResponses[i]?.substring(0, 200) || ''}`)
            .join('\n\n');
        const lastUser = pendingAnalysis.userMessages[pendingAnalysis.userMessages.length - 1];
        const lastAI = pendingAnalysis.aiResponses[pendingAnalysis.aiResponses.length - 1];

        pendingAnalysis = { userMessages: [], aiResponses: [] };

        const analysis = await analyzeConversation(historySummary, lastUser, lastAI);
        if (analysis) applyAnalysis(analysis);
    }

    // Marca fim da sessão no diário
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    recordToSessionDiary('O que foi feito', `Sessão encerrada às ${timeStr}.`);

    sessionActive = false;
    console.log('📔 [CloneDigital] Sessão finalizada.');
}

function applyAnalysis(analysis) {
    // 1. Entradas do diário de sessão
    if (analysis.sessionEntries && Array.isArray(analysis.sessionEntries)) {
        for (const entry of analysis.sessionEntries) {
            if (entry.entry && entry.section) {
                recordToSessionDiary(entry.section, entry.entry);
            }
        }
    }

    // 2. Decisões
    if (analysis.decisions && Array.isArray(analysis.decisions)) {
        for (const d of analysis.decisions) {
            if (d.title && d.context) {
                recordDecision(d.title, d.context, d.impact || '');
            }
        }
    }

    // 3. Aprendizados
    if (analysis.learnings && Array.isArray(analysis.learnings)) {
        for (const l of analysis.learnings) {
            if (l.title && l.content) {
                recordLearning(l.title, l.content);
            }
        }
    }

    // 4. Atualizações de perfil
    if (analysis.profileUpdates && Array.isArray(analysis.profileUpdates)) {
        for (const p of analysis.profileUpdates) {
            if (p.section && p.content) {
                updateProfile(p.section, p.content);
            }
        }
    }

    // 5. Tarefas
    if (analysis.tasks && Array.isArray(analysis.tasks)) {
        for (const t of analysis.tasks) {
            if (t.task) {
                addTask(t.task, t.section || '📌 Pendente (sem data)');
            }
        }
    }

    console.log('🧠 [CloneDigital] Análise aplicada ao vault.');
}

// Auto-finaliza após 30 min de inatividade
let inactivityTimer = null;
function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        if (sessionActive) {
            console.log('⏰ [CloneDigital] Timeout de inatividade — finalizando sessão...');
            finalizeSession();
        }
    }, 30 * 60 * 1000);
}

module.exports = {
    ensureSessionDiary,
    recordToSessionDiary,
    recordDecision,
    recordLearning,
    updateProfile,
    addTask,
    markTaskComplete,
    processConversationTurn,
    finalizeSession,
    resetInactivityTimer
};
