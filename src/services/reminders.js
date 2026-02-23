const config = require('../config');
const { getGoogleAuth, CALENDAR_ID } = require('./api/calendar');
const { google } = require('googleapis');

// Tempos de notificação (em minutos)
const NOTIFICATION_TIMES = [
    1440,  // 24 horas
    300,   // 5 horas
    60     // 1 hora
];

// Controle de eventos já notificados
const eventosNotificados = new Set();

// Cache do cliente
let calendarClient = null;

async function getCalendarClient() {
    if (calendarClient) return calendarClient;
    const auth = await getGoogleAuth();
    calendarClient = google.calendar({ version: 'v3', auth });
    return calendarClient;
}

async function verificarLembretes(client) {
    try {
        // console.log('\n🔍 Verificando lembretes...'); // Silenciando log repetitivo

        const calendar = await getCalendarClient();

        // Busca eventos das próximas 48 horas (para pegar notificações de 24h)
        const agora = new Date();
        const limite = new Date(agora.getTime() + 48 * 60 * 60 * 1000);

        const response = await calendar.events.list({
            calendarId: 'primary', // Usa 'primary' se CALENDAR_ID for indefinido
            timeMin: agora.toISOString(),
            timeMax: limite.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });

        const eventos = response.data.items;
        if (!eventos || eventos.length === 0) {
            console.log('Nenhum evento próximo encontrado');
            return;
        }

        console.log(`\n📅 Encontrados ${eventos.length} eventos próximos`);

        for (const evento of eventos) {
            const inicio = new Date(evento.start.dateTime || evento.start.date);
            const minutosAteEvento = Math.floor((inicio - agora) / 1000 / 60);

            // Verifica cada tempo de notificação
            for (const tempoNotificacao of NOTIFICATION_TIMES) {
                const chaveNotificacao = `${evento.id}_${tempoNotificacao}`;

                // Se está no momento de notificar e ainda não foi notificado
                if (minutosAteEvento <= tempoNotificacao &&
                    minutosAteEvento > tempoNotificacao - 1 &&
                    !eventosNotificados.has(chaveNotificacao)) {

                    console.log(`\n⏰ Enviando notificação para: ${evento.summary}`);

                    let tempoFormatado;
                    if (tempoNotificacao === 1440) {
                        tempoFormatado = '24 horas';
                    } else if (tempoNotificacao === 300) {
                        tempoFormatado = '5 horas';
                    } else {
                        tempoFormatado = '1 hora';
                    }

                    const mensagem = `⏰ *Lembrete de Evento*\n\n` +
                        `📅 *${evento.summary}*\n` +
                        `⏰ Começa em ${tempoFormatado}\n` +
                        `🕐 Horário: ${inicio.toLocaleTimeString('pt-BR')}\n` +
                        `📆 Data: ${inicio.toLocaleDateString('pt-BR')}\n` +
                        (evento.location ? `📍 Local: ${evento.location}\n` : '') +
                        (evento.description ? `📝 Descrição: ${evento.description}` : '');

                    await client.sendMessage(config.whatsapp.number, mensagem);
                    eventosNotificados.add(chaveNotificacao);
                }
            }
        }

    } catch (error) {
        console.error('\n❌ Erro ao verificar lembretes:', error);
    }
}

let lembretesIniciados = false;
function iniciarVerificacaoLembretes(client) {
    if (lembretesIniciados) {
        console.log('\n⏰ Sistema de lembretes já iniciado (ignorando nova inicialização).');
        return;
    }
    lembretesIniciados = true;
    console.log('\n⏰ Iniciando sistema de lembretes...');
    // Verifica a cada minuto
    setInterval(() => verificarLembretes(client), 60 * 1000);
    // Faz uma verificação inicial
    verificarLembretes(client);
}

module.exports = {
    iniciarVerificacaoLembretes
}; 