/**
 * Calendar Handler — gerencia todos os comandos de calendário
 * Extraído de message-handler.js para melhor organização
 */

const {
    getGoogleAuth,
    listarEventos,
    listarEventosAmanha,
    listarEventosSemana,
    listarEventosProximaSemana,
    listarEventosMes,
    listarEventosProximoMes,
    listarEventosData,
    listarProximosEventos,
    adicionarEvento,
    removerEvento,
    formatarEventos,
    CALENDAR_ID,
    PASCOM_CALENDAR_ID
} = require('../../api/calendar');
const { adicionarAoHistorico } = require('../../chat-history');
const { filtrarPensamentos } = require('../../api/groq');
const { setPascomGroupId } = require('../../jobs/pascom-notification');

// Estado de conversa para fluxo de remoção de eventos
const conversationState = {};

// Lista de comandos reconhecidos como calendário
const COMANDOS_CALENDARIO = ['/add', '/list', '/remove', '/evento', '/today', '/tomorrow', '/week', '/nextweek', '/month', '/nextmonth', '/date', '/delete', '/next'];

/**
 * Verifica se a resposta da IA é um comando de calendário
 */
function isCalendarCommand(respostaIA) {
    return COMANDOS_CALENDARIO.some(cmd => respostaIA.startsWith(cmd));
}

/**
 * Verifica se há um estado pendente de remoção de evento para este chat
 */
function hasPendingDeleteSelection(chatId) {
    return conversationState[chatId]?.action === 'awaiting_delete_selection';
}

/**
 * Processa a seleção do usuário para remoção de evento
 */
async function handleDeleteSelection(client, chatId, textoUsuario) {
    const selection = parseInt(textoUsuario, 10);
    const events = conversationState[chatId].events;

    if (!isNaN(selection) && selection > 0 && selection <= events.length) {
        const eventToDelete = events[selection - 1];
        try {
            const auth = await getGoogleAuth();
            await removerEvento(auth, eventToDelete.id);
            await client.sendMessage(chatId, `✅ Evento "${eventToDelete.summary}" removido com sucesso!`);
        } catch (error) {
            console.error('❌ Erro ao tentar remover evento por seleção:', error);
            await client.sendMessage(chatId, '❌ Ocorreu um erro ao tentar remover o evento.');
        }
    } else {
        await client.sendMessage(chatId, '❌ Seleção inválida. Por favor, responda com o número do evento que deseja remover.');
    }
    // Limpa o estado da conversa após a ação
    delete conversationState[chatId];
}

/**
 * Processa o comando /setup pascom
 */
async function handleSetupPascom(client, chatId, isGroup) {
    if (isGroup) {
        setPascomGroupId(chatId);
        await client.sendMessage(chatId, '✅ Este grupo foi configurado como o grupo oficial da **PASCOM**! Notificações do calendário serão enviadas aqui.');
    } else {
        await client.sendMessage(chatId, '❌ Este comando deve ser usado dentro de um grupo.');
    }
}

/**
 * Processa um comando de calendário e retorna a mensagem de resposta
 */
async function handleCalendarCommand(client, chatId, respostaIA) {
    try {
        console.log('\n🔍 Processando comando Groq para calendário:', respostaIA);
        console.log('📱 ChatId recebido:', chatId);
        const auth = await getGoogleAuth();
        let mensagemResposta = '';
        let comandoExecutado = false;

        const comando = respostaIA.split(' ')[0];
        const args = respostaIA.split(' ').slice(1);

        switch (comando) {
            case '/evento':
                const partesEvento = respostaIA.split('\n');
                const comandoAddEmEvento = partesEvento.find(p => p.startsWith('/add'));
                if (comandoAddEmEvento) {
                    console.log('\n📅 Processando evento extraído de imagem/texto...');
                    try {
                        const eventoInfo = comandoAddEmEvento.substring(5).trim();
                        const isGroup = chatId.endsWith('@g.us');
                        const targetCalendar = isGroup ? PASCOM_CALENDAR_ID : null;
                        const evento = await adicionarEvento(auth, eventoInfo, targetCalendar);
                        comandoExecutado = true;

                        const inicio = new Date(evento.start.dateTime || evento.start.date);
                        const fim = new Date(evento.end.dateTime || evento.end.date);
                        const calLabel = isGroup ? 'PASCOM ⛪' : 'Pessoal';
                        mensagemResposta = `> *Evento ${calLabel} Adicionado* ✨\n\n` +
                            `📝 *${evento.summary}*\n` +
                            `📅 Início: ${inicio.toLocaleString('pt-BR')}\n` +
                            `🔚 Fim: ${fim.toLocaleString('pt-BR')}\n` +
                            (evento.description ? `📋 ${evento.description}\n` : '') +
                            (evento.location ? `📍 ${evento.location}\n` : '');
                    } catch (error) {
                        console.error('\n❌ Erro ao adicionar evento (de /evento):', error);
                        mensagemResposta = `❌ Erro ao adicionar evento: ${error.message}`;
                    }
                } else {
                    return null;
                }
                break;

            case '/add':
                try {
                    const eventoInfo = respostaIA.substring(5).trim();
                    const isGroupAdd = chatId.endsWith('@g.us');
                    const targetCalendarAdd = isGroupAdd ? PASCOM_CALENDAR_ID : null;
                    const evento = await adicionarEvento(auth, eventoInfo, targetCalendarAdd);
                    comandoExecutado = true;

                    const inicio = new Date(evento.start.dateTime || evento.start.date);
                    const fim = new Date(evento.end.dateTime || evento.end.date);
                    const calLabel = isGroupAdd ? 'PASCOM ⛪' : 'Pessoal';
                    mensagemResposta = `> *Evento ${calLabel} Adicionado* ✨\n\n` +
                        `📝 *${evento.summary}*\n` +
                        `📅 Início: ${inicio.toLocaleString('pt-BR')}\n` +
                        `🔚 Fim: ${fim.toLocaleString('pt-BR')}\n` +
                        (evento.description ? `📋 ${evento.description}\n` : '') +
                        (evento.location ? `📍 ${evento.location}\n` : '');
                } catch (error) {
                    console.error('\n❌ Erro ao adicionar evento:', error);
                    mensagemResposta = `❌ Erro ao adicionar evento: ${error.message}`;
                }
                break;

            case '/add_pascom':
                try {
                    const eventoInfo = respostaIA.substring(12).trim();
                    const evento = await adicionarEvento(auth, eventoInfo, PASCOM_CALENDAR_ID);
                    comandoExecutado = true;

                    const inicio = new Date(evento.start.dateTime || evento.start.date);
                    const fim = new Date(evento.end.dateTime || evento.end.date);
                    mensagemResposta = `> *Evento PASCOM Adicionado* ⛪✨\n\n` +
                        `📝 *${evento.summary}*\n` +
                        `📅 Início: ${inicio.toLocaleString('pt-BR')}\n` +
                        `🔚 Fim: ${fim.toLocaleString('pt-BR')}\n` +
                        (evento.description ? `📋 ${evento.description}\n` : '') +
                        (evento.location ? `📍 ${evento.location}\n` : '');
                } catch (error) {
                    console.error('\n❌ Erro ao adicionar evento Pascom:', error);
                    mensagemResposta = `❌ Erro ao adicionar evento na Pascom: ${error.message}`;
                }
                break;

            case '/list':
            case '/today':
            case '/tomorrow':
            case '/week':
            case '/nextweek':
            case '/month':
            case '/nextmonth':
            case '/date':
            case '/next':
                comandoExecutado = true;
                let eventos = [];
                let titulo = "Eventos";
                let periodo;
                if (comando === '/list') {
                    periodo = args.join(' ').toLowerCase() || 'today';
                } else {
                    periodo = comando.substring(1);
                }

                if (periodo === 'hoje' || periodo === 'today') {
                    eventos = await listarEventos(auth);
                    titulo = "Eventos para Hoje";
                } else if (periodo === 'amanha' || periodo === 'tomorrow') {
                    eventos = await listarEventosAmanha(auth);
                    titulo = "Eventos para Amanhã";
                } else if (periodo === 'semana' || periodo === 'week') {
                    eventos = await listarEventosSemana(auth);
                    titulo = "Eventos da Semana";
                } else if (periodo === 'proxima semana' || periodo === 'nextweek') {
                    eventos = await listarEventosProximaSemana(auth);
                    titulo = "Eventos da Próxima Semana";
                } else if (periodo === 'mes' || periodo === 'month') {
                    eventos = await listarEventosMes(auth);
                    titulo = "Eventos do Mês";
                } else if (periodo === 'proximo mes' || periodo === 'nextmonth') {
                    eventos = await listarEventosProximoMes(auth);
                    titulo = "Eventos do Próximo Mês";
                } else if (comando === '/date') {
                    const dataArg = args[0];
                    if (dataArg && /^\d{4}-\d{2}-\d{2}$/.test(dataArg)) {
                        eventos = await listarEventosData(auth, dataArg);
                        try {
                            const dataObj = new Date(dataArg + 'T00:00:00-03:00');
                            titulo = `Eventos para ${dataObj.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
                        } catch (e) {
                            titulo = `Eventos para ${dataArg}`;
                        }
                    } else {
                        mensagemResposta = '❌ Formato de data inválido para /date. Use AAAA-MM-DD.';
                    }
                } else if (periodo === 'proximos' || periodo === 'next') {
                    eventos = await listarProximosEventos(auth);
                    titulo = `Próximos ${eventos.length} Eventos`;
                } else if (comando === '/list' && args.length > 0) {
                    console.warn("Comando /list com argumento não padrão:", args);
                    eventos = await listarEventos(auth);
                    titulo = "Eventos para Hoje (Argumento /list não reconhecido)";
                } else {
                    eventos = await listarEventos(auth);
                    titulo = "Eventos para Hoje";
                }

                if (mensagemResposta === '') {
                    mensagemResposta = formatarEventos(eventos, titulo);
                }
                break;

            case '/remove':
                comandoExecutado = true;
                const eventId = args[0];
                if (eventId) {
                    try {
                        await removerEvento(auth, eventId);
                        mensagemResposta = '✅ Evento removido com sucesso!';
                    } catch (error) {
                        console.error('\n❌ Erro ao remover evento:', error);
                        mensagemResposta = '❌ Erro ao remover evento.';
                    }
                } else {
                    mensagemResposta = '❌ ID do evento não fornecido para remoção via /remove.';
                }
                break;

            case '/delete':
                comandoExecutado = true;
                console.log('\n🗑️ Recebido comando /delete, iniciando fluxo de remoção...');
                const eventosHoje = await listarEventos(auth);
                if (eventosHoje && eventosHoje.length > 0) {
                    let listaParaRemover = "Qual evento você gostaria de remover? Responda com o número:\n\n";
                    eventosHoje.forEach((evento, index) => {
                        const inicio = new Date(evento.start.dateTime || evento.start.date);
                        listaParaRemover += `${index + 1}. *${evento.summary}* (${inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})\n`;
                    });
                    mensagemResposta = listaParaRemover;

                    if (!chatId) {
                        console.error('❌ ChatId não definido no comando /delete');
                        mensagemResposta = "❌ Erro interno: ChatId não encontrado.";
                    } else {
                        conversationState[chatId] = {
                            action: 'awaiting_delete_selection',
                            events: eventosHoje
                        };
                        console.log(`📝 Estado definido para ${chatId}: aguardando seleção para remoção.`);
                    }
                } else {
                    mensagemResposta = "📅 Não há eventos hoje para remover.";
                }
                break;

            default:
                console.warn(`Comando de calendário não reconhecido dentro de processarComandoCalendario: ${comando}`);
                return null;
        }

        return comandoExecutado ? mensagemResposta : null;

    } catch (error) {
        console.error('\n❌ Erro geral ao processar comando do calendário:', error);
        return '❌ Ocorreu um erro ao processar o comando do calendário.';
    }
}

module.exports = {
    isCalendarCommand,
    hasPendingDeleteSelection,
    handleDeleteSelection,
    handleSetupPascom,
    handleCalendarCommand
};
