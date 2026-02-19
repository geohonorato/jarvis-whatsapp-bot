const { PASCOM_CALENDAR_ID, getGoogleAuth } = require('../api/calendar');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Caminho para salvar IDs de eventos já notificados
const NOTIFIED_CACHE_PATH = path.join(__dirname, '../../../data/pascom_notified_cache.json');
// Caminho para salvar configuração do grupo
const CONFIG_PATH = path.join(__dirname, '../../../data/pascom_config.json');

// Carrega cache (Objeto: { "eventKey": ["2weeks", "1week", "1day", "morning"] })
let notifiedCache = {};
try {
    if (fs.existsSync(NOTIFIED_CACHE_PATH)) {
        const raw = fs.readFileSync(NOTIFIED_CACHE_PATH, 'utf8');
        // Migração de formato antigo (array) para novo (objeto) se necessário
        if (raw.trim().startsWith('[')) {
            const oldArray = JSON.parse(raw);
            oldArray.forEach(key => notifiedCache[key] = ['created']); // Marca como 'criado' para compatibilidade
        } else {
            notifiedCache = JSON.parse(raw);
        }
    }
} catch (e) {
    console.error('Erro ao carregar cache Pascom:', e);
}

// Configuração do intervalo de verificação (em ms)
const POLL_INTERVAL = 30 * 60 * 1000; // 30 minutos

// Carrega config (Group ID) ou busca pelo nome
async function getPascomGroupId(client) {
    try {
        // 1. Variável de Ambiente
        if (process.env.COORDENACAO_GROUP_ID) return process.env.COORDENACAO_GROUP_ID;

        // 2. Arquivo Local (Cache)
        if (fs.existsSync(CONFIG_PATH)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            if (config.groupId) return config.groupId;
        }

        // 3. Busca por NOME (Fallback persistente via código)
        // Prioridade: Grupo de Teste "My" > Grupo Oficial "•|°COORDENAÇÃO PASCOM°|•"
        const targetNames = ['My', process.env.COORDENACAO_GROUP_NAME || '•|°COORDENAÇÃO PASCOM°|•'];

        console.log(`🔍 Buscando grupos por nome (Prioridade: ${targetNames.join(', ')})...`);
        const chats = await client.getChats();

        // Encontra o primeiro grupo da lista que existe no WhatsApp
        let targetGroup = null;
        for (const name of targetNames) {
            targetGroup = chats.find(chat => chat.isGroup && chat.name === name);
            if (targetGroup) break;
        }

        if (targetGroup) {
            console.log(`✅ Grupo encontrado pelo nome! ID: ${targetGroup.id._serialized}`);
            // Salva no cache para evitar busca na próxima vez
            setPascomGroupId(targetGroup.id._serialized);
            return targetGroup.id._serialized;
        } else {
            // console.log(`⚠️ Grupo não encontrado.`);
        }

    } catch (e) {
        console.error('Erro ao buscar ID do grupo Pascom:', e);
    }
    return null;
}

// Salva ID do grupo
function setPascomGroupId(groupId) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify({ groupId }), 'utf8');
        console.log('✅ Grupo Pascom configurado:', groupId);
        return true;
    } catch (e) {
        console.error('Erro ao salvar grupo Pascom:', e);
        return false;
    }
}

// Salva cache
function saveCache() {
    try {
        // Limpeza simples: remove eventos muito antigos do cache (opcional, para não crescer infinitamente)
        // Por enquanto, salva tudo.
        fs.writeFileSync(NOTIFIED_CACHE_PATH, JSON.stringify(notifiedCache), 'utf8');
    } catch (e) {
        console.error('Erro ao salvar cache Pascom:', e);
    }
}

async function checarEventosPascom(client) {
    const groupId = await getPascomGroupId(client);
    if (!groupId) {
        // console.log('⚠️ Verificação Pascom ignorada: ID do grupo não configurado.');
        return;
    }

    if (!PASCOM_CALENDAR_ID) {
        console.log('⚠️ Verificação Pascom ignorada: ID do Calendário não configurado.');
        return;
    }

    try {
        const auth = await getGoogleAuth();
        const calendar = google.calendar({ version: 'v3', auth });

        // Busca eventos dos próximos 16 dias (para cobrir o aviso de 2 semanas)
        const now = new Date();
        const maxDate = new Date();
        maxDate.setDate(now.getDate() + 16);

        const res = await calendar.events.list({
            calendarId: PASCOM_CALENDAR_ID,
            timeMin: now.toISOString(),
            timeMax: maxDate.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            timeZone: 'America/Sao_Paulo'
        });

        const events = res.data.items || [];
        console.log(`🔍 Verificando Pascom: ${events.length} eventos encontrados.`);

        for (const event of events) {
            const eventStart = new Date(event.start.dateTime || event.start.date);
            const eventKey = `${event.id}_${eventStart.getTime()}`;

            // Inicializa cache para o evento se não existir
            if (!notifiedCache[eventKey]) {
                notifiedCache[eventKey] = [];
            }

            const diffMs = eventStart - now;
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            const isMorning = now.getHours() >= 6 && now.getHours() < 12; // Considera manhã entre 6h e 12h
            const isEventToday = diffDays >= 0 && diffDays < 1 && eventStart.getDate() === now.getDate();

            let notificationType = null;
            let msgPrefix = "";

            // Lógica de Prioridade (da mais distante para a mais próxima)

            // 1. Duas Semanas (entre 13 e 15 dias)
            // Usa 14 como centro
            if (diffDays >= 13 && diffDays <= 15 && !notifiedCache[eventKey].includes('2weeks')) {
                notificationType = '2weeks';
                msgPrefix = "🗓 *Lembrete: Faltam 2 Semanas*";
            }
            // 2. Uma Semana (entre 6 e 8 dias)
            // Usa 7 como centro
            else if (diffDays >= 6 && diffDays <= 8 && !notifiedCache[eventKey].includes('1week')) {
                notificationType = '1week';
                msgPrefix = "🗓 *Lembrete: Falta 1 Semana*";
            }
            // 3. Dia Anterior (entre 0 e 2 dias, mas focado no dia ant)
            // Vamos ser mais flexiveis: se for "Amanhã" (getData + 1 == eventData)
            else if (diffDays >= 0.5 && diffDays <= 1.5 && !notifiedCache[eventKey].includes('1day')) {
                // Verificação extra de dia
                const tomorrow = new Date(now);
                tomorrow.setDate(now.getDate() + 1);
                if (eventStart.getDate() === tomorrow.getDate()) {
                    notificationType = '1day';
                    msgPrefix = "⏰ *Lembrete: É Amanhã!*";
                }
            }
            // 4. Na Manhã do Dia (Evento Hoje)
            else if (isEventToday && isMorning && !notifiedCache[eventKey].includes('morning')) {
                notificationType = 'morning';
                msgPrefix = "🚨 *Lembrete: É HOJE!*";
            }

            if (notificationType) {
                const dataFmt = eventStart.toLocaleDateString('pt-BR');
                const horaFmt = eventStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                const msg = `${msgPrefix}\n\n` +
                    `📝 *${event.summary}*\n` +
                    `📅 Data: ${dataFmt}\n` +
                    `⏰ Hora: ${horaFmt}\n` +
                    (event.location ? `📍 Local: ${event.location}\n` : '') +
                    (event.description ? `📋 ${event.description}\n` : '');

                console.log(`🔔 Enviando notificação Pascom (${notificationType}): ${event.summary}`);
                await client.sendMessage(groupId, msg);

                notifiedCache[eventKey].push(notificationType);
                saveCache();

                // Delay para evitar bloqueio por spam
                await new Promise(r => setTimeout(r, 2000));
            }
        }

    } catch (error) {
        console.error('❌ Erro na verificação Pascom:', error.message);
    }
}

// Inicia o job
function iniciarJobPascom(client) {
    console.log('🚀 Iniciando Job de Notificação Pascom (Multi-stage)...');

    // Executa imediatamente
    checarEventosPascom(client);

    // Intervalo de polling
    setInterval(() => checarEventosPascom(client), POLL_INTERVAL);
}

module.exports = {
    iniciarJobPascom,
    setPascomGroupId,
    getPascomGroupId // Exportando auxiliar se necessário
};
