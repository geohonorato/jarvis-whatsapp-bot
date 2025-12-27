const { PASCOM_CALENDAR_ID, getGoogleAuth } = require('../api/calendar');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Caminho para salvar IDs de eventos já notificados
const NOTIFIED_CACHE_PATH = path.join(__dirname, '../../../.pascom_notified_cache.json');
// Caminho para salvar configuração do grupo
const CONFIG_PATH = path.join(__dirname, '../../../.pascom_config.json');

// Carrega cache
let notifiedEvents = [];
try {
    if (fs.existsSync(NOTIFIED_CACHE_PATH)) {
        notifiedEvents = JSON.parse(fs.readFileSync(NOTIFIED_CACHE_PATH, 'utf8'));
    }
} catch (e) {
    console.error('Erro ao carregar cache Pascom:', e);
}

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
            console.log(`⚠️ Grupo "${targetName}" não encontrado.`);
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
        // Mantém apenas os últimos 500 para não crescer infinitamente
        if (notifiedEvents.length > 500) notifiedEvents = notifiedEvents.slice(-500);
        fs.writeFileSync(NOTIFIED_CACHE_PATH, JSON.stringify(notifiedEvents), 'utf8');
    } catch (e) {
        console.error('Erro ao salvar cache Pascom:', e);
    }
}

async function checarEventosPascom(client) {
    const groupId = await getPascomGroupId(client);
    if (!groupId) {
        console.log('⚠️ Verificação Pascom ignorada: ID do grupo não configurado e grupo não encontrado por nome.');
        return;
    }

    if (!PASCOM_CALENDAR_ID) {
        console.log('⚠️ Verificação Pascom ignorada: ID do Calendário não configurado.');
        return;
    }

    try {
        const auth = await getGoogleAuth();
        const calendar = google.calendar({ version: 'v3', auth });

        // Busca eventos das próximas 24 horas (ou período desejado)
        // Vamos buscar eventos CRIADOS ou ATUALIZADOS recentemente? 
        // Ou vamos buscar PRÓXIMOS eventos para lembrar?
        // O pedido foi "toda vez que tiver eventos da pascom ele notificar". 
        // Vamos assumir: Notificar novos eventos futuros ou lembretes diários.
        // Abordagem equilibrada: Notificar eventos que começam amanhã (Daily Briefing)
        // E monitorar novos eventos criados (mais complexo sem push notifications).

        // Vamos implementar: "Lembrete Diário" + "Monitoramento de Próximos Eventos"
        // Para simplificar e atender "toda vez que tiver eventos":
        // Vamos listar eventos dos próximos 7 dias. Se houver algum evento NOVO (não notificado), avisar.

        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);

        const res = await calendar.events.list({
            calendarId: PASCOM_CALENDAR_ID,
            timeMin: now.toISOString(),
            timeMax: nextWeek.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            timeZone: 'America/Sao_Paulo'
        });

        const events = res.data.items || [];

        for (const event of events) {
            // Chave única para o evento (ID + data de início, para suportar recorrentes mudando)
            const eventKey = `${event.id}_${event.start.dateTime || event.start.date}`;

            if (!notifiedEvents.includes(eventKey)) {
                // Novo evento detectado (ou ainda não notificado)
                const start = new Date(event.start.dateTime || event.start.date);
                const dataFmt = start.toLocaleDateString('pt-BR');
                const horaFmt = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                const msg = `📢 *NOVO EVENTO PASCOM*\n\n` +
                    `🗓 *${event.summary}*\n` +
                    `📅 Data: ${dataFmt}\n` +
                    `⏰ Hora: ${horaFmt}\n` +
                    (event.location ? `📍 Local: ${event.location}\n` : '') +
                    (event.description ? `📝 ${event.description}\n` : '');

                console.log(`🔔 Notificando Pascom sobre: ${event.summary}`);
                await client.sendMessage(groupId, msg);

                notifiedEvents.push(eventKey);
                saveCache();

                // Pequeno delay para evitar spam se houver muitos
                await new Promise(r => setTimeout(r, 1000));
            }
        }

    } catch (error) {
        console.error('❌ Erro na verificação Pascom:', error.message);
    }
}

// Inicia o job (pode ser chamado no startup)
function iniciarJobPascom(client) {
    console.log('🚀 Iniciando Job de Notificação Pascom...');

    // Executa imediatamente
    checarEventosPascom(client);

    // E depois a cada 1 hora (ou intervalo menor se preferir)
    setInterval(() => checarEventosPascom(client), 60 * 60 * 1000); // 1 hora
}

module.exports = {
    iniciarJobPascom,
    setPascomGroupId
};
