require("dotenv").config();
const { google } = require('googleapis');
const moment = require('moment-timezone');
const { readFileSync, existsSync } = require('fs');
const path = require('path');

// Escopos necessários
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// ID do calendário
const CALENDAR_ID = process.env.CALENDAR_ID;
const PASCOM_CALENDAR_ID = process.env.PASCOM_CALENDAR_ID;

// Função para obter as credenciais (de variável de ambiente ou arquivo)
function sanitizeAndParseGoogleCredentials(raw) {
    const safeTrim = (s) => (s || '').trim();
    const redact = (obj) => {
        try {
            const clone = { ...obj };
            if (clone.private_key) clone.private_key = '[REDACTED]';
            return clone;
        } catch { return {}; }
    };

    let input = safeTrim(raw);

    // Remove aspas encapsuladoras acidentais (", ' ou `) no começo/fim
    if ((input.startsWith('"') && input.endsWith('"')) ||
        (input.startsWith("'") && input.endsWith("'")) ||
        (input.startsWith('`') && input.endsWith('`'))) {
        input = input.slice(1, -1);
    }

    // 1) Tentativa direta de JSON
    try {
        const parsed = JSON.parse(input);
        if (parsed && parsed.private_key && parsed.private_key.includes('\\n')) {
            parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        console.log('🔑 GOOGLE_CREDENTIALS (JSON) parseada com sucesso');
        return parsed;
    } catch { }

    // 2) Base64 -> JSON
    try {
        const decoded = Buffer.from(input, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        if (parsed && parsed.private_key && parsed.private_key.includes('\\n')) {
            parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        console.log('🔑 GOOGLE_CREDENTIALS (base64) parseada com sucesso');
        return parsed;
    } catch { }

    // 3) Formato key=value (várias linhas), comum quando colado de forma incorreta
    // Ex.: type=service_account\nproject_id=...\nprivate_key=-----BEGIN PRIVATE KEY-----\n...
    try {
        if (/^[A-Za-z_]+\s*=/.test(input)) {
            const obj = {};
            input.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return;
                const idx = trimmed.indexOf('=');
                if (idx > 0) {
                    const k = trimmed.slice(0, idx).trim();
                    let v = trimmed.slice(idx + 1).trim();
                    // Remove aspas externas, se existirem
                    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith('\'') && v.endsWith('\''))) {
                        v = v.slice(1, -1);
                    }
                    obj[k] = v;
                }
            });
            if (obj.private_key && obj.private_key.includes('\\n')) {
                obj.private_key = obj.private_key.replace(/\\n/g, '\n');
            }
            // Normaliza campos esperados pelo Google
            const normalized = {
                type: obj.type,
                project_id: obj.project_id,
                private_key_id: obj.private_key_id,
                private_key: obj.private_key,
                client_email: obj.client_email,
                client_id: obj.client_id,
                auth_uri: obj.auth_uri || 'https://accounts.google.com/o/oauth2/auth',
                token_uri: obj.token_uri || 'https://oauth2.googleapis.com/token',
                auth_provider_x509_cert_url: obj.auth_provider_x509_cert_url || 'https://www.googleapis.com/oauth2/v1/certs',
                client_x509_cert_url: obj.client_x509_cert_url,
                universe_domain: obj.universe_domain || 'googleapis.com'
            };
            console.log('🔑 GOOGLE_CREDENTIALS (key=value) parseada com sucesso');
            return normalized;
        }
    } catch { }

    // 4) Tentativa de reparar chaves não-aspadas: {type: '...', project_id: '...'} → JSON
    try {
        let repaired = input
            .replace(/([,{\s])([A-Za-z0-9_]+)\s*:/g, '$1"$2":') // aspa chaves
            .replace(/'([^']*)'/g, '"$1"'); // troca aspas simples por duplas em valores
        const parsed = JSON.parse(repaired);
        if (parsed && parsed.private_key && parsed.private_key.includes('\\n')) {
            parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        console.log('🔑 GOOGLE_CREDENTIALS (reparada) parseada com sucesso');
        return parsed;
    } catch { }

    console.error('❌ Falha ao interpretar GOOGLE_CREDENTIALS. Conteúdo inválido ou formato não reconhecido.');
    throw new Error('GOOGLE_CREDENTIALS inválida - forneça JSON válido ou base64 do JSON');
}

function getCredentials() {
    // Tenta primeiro a variável de ambiente (para deploy em nuvem)
    if (process.env.GOOGLE_CREDENTIALS) {
        console.log('🔑 Usando credenciais da variável de ambiente GOOGLE_CREDENTIALS');
        return sanitizeAndParseGoogleCredentials(process.env.GOOGLE_CREDENTIALS);
    }

    // Fallback para arquivo local
    const credentialsPath = path.join(__dirname, '../../../credentials.json');
    console.log('📂 Buscando credenciais em arquivo:', credentialsPath);

    if (!existsSync(credentialsPath)) {
        console.error('❌ credentials.json não encontrado e GOOGLE_CREDENTIALS não definida!');
        console.error('💡 Dica: Adicione GOOGLE_CREDENTIALS como variável de ambiente ou coloque credentials.json na raiz do projeto');
        throw new Error('Credenciais do Google Calendar não encontradas');
    }

    const fileRaw = readFileSync(credentialsPath, 'utf8');
    const creds = JSON.parse(fileRaw);
    if (creds && creds.private_key && creds.private_key.includes('\\n')) {
        creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }
    return creds;
}

async function getGoogleAuth() {
    try {
        console.log('🔑 Iniciando autenticação com Google Calendar...');

        const credentials = getCredentials();

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: SCOPES,
        });

        const client = await auth.getClient();
        console.log('✅ Autenticação Google Calendar bem-sucedida!');
        console.log('📧 Email do Bot (Service Account):', credentials.client_email);
        return client;
    } catch (error) {
        console.error('❌ Erro na autenticação Google Calendar:', error.message);
        if (error.response) {
            console.error('📝 Detalhes do erro:', error.response.data);
        }
        throw error;
    }
}

function verificarDataHora() {
    const agora = new Date();
    console.log('Data e hora do sistema:', {
        raw: agora,
        local: agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        iso: agora.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        systemTime: process.env.TZ
    });
}

async function listarEventos(auth) {
    const calendar = google.calendar({ version: 'v3', auth });
    const agora = new Date();
    const fimDoDia = new Date(agora);
    fimDoDia.setHours(23, 59, 59, 999);

    try {
        console.log(`📅 Listando eventos do calendário ${CALENDAR_ID}`);
        const res = await calendar.events.list({
            calendarId: CALENDAR_ID,
            timeMin: agora.toISOString(),
            timeMax: fimDoDia.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });
        return res.data.items;
    } catch (error) {
        console.error('❌ Erro ao listar eventos:', error);
        throw error;
    }
}

async function listarEventosProximos(auth) {
    const calendar = google.calendar({ version: 'v3', auth });
    const agora = new Date();
    const umDiaDepois = new Date(agora);
    umDiaDepois.setDate(agora.getDate() + 1);

    try {
        console.log('\n📅 Listando próximos eventos');
        const res = await calendar.events.list({
            calendarId: CALENDAR_ID,
            timeMin: agora.toISOString(),
            timeMax: umDiaDepois.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            timeZone: 'America/Sao_Paulo'
        });

        return res.data.items || [];
    } catch (error) {
        console.error('\n❌ Erro ao listar próximos eventos:', error);
        throw error;
    }
}

async function listarEventosAmanha(auth) {
    try {
        const calendar = google.calendar({ version: 'v3', auth });

        // Configura as datas para amanhã
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        amanha.setHours(0, 0, 0, 0);

        const fimAmanha = new Date(amanha);
        fimAmanha.setHours(23, 59, 59, 999);

        console.log('\n📅 Buscando eventos para amanhã:', {
            inicio: amanha.toLocaleString('pt-BR'),
            fim: fimAmanha.toLocaleString('pt-BR')
        });

        const res = await calendar.events.list({
            calendarId: CALENDAR_ID,
            timeMin: amanha.toISOString(),
            timeMax: fimAmanha.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            timeZone: 'America/Sao_Paulo'
        });

        return res.data.items || [];
    } catch (error) {
        console.error('\n❌ Erro ao listar eventos de amanhã:', error);
        throw error;
    }
}

async function listarEventosPeriodo(calendar, inicio, fim) {
    try {
        const response = await calendar.events.list({
            calendarId: CALENDAR_ID,
            timeMin: inicio.toISOString(),
            timeMax: fim.toISOString(),
            maxResults: 100,
            singleEvents: true,
            orderBy: 'startTime',
        });

        return response.data.items;
    } catch (error) {
        console.error('Erro ao listar eventos:', error);
        return null;
    }
}

async function listarEventosSemana(auth) {
    const calendar = google.calendar({ version: 'v3', auth });
    const inicio = new Date();
    const fim = new Date();
    fim.setDate(inicio.getDate() + 7);

    return await listarEventosPeriodo(calendar, inicio, fim);
}

async function listarEventosProximaSemana(auth) {
    const calendar = google.calendar({ version: 'v3', auth });
    const inicio = new Date();
    inicio.setDate(inicio.getDate() + 7);
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 7);

    return await listarEventosPeriodo(calendar, inicio, fim);
}

async function listarEventosMes(auth) {
    const calendar = google.calendar({ version: 'v3', auth });
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const fimMes = new Date(inicioMes);
    fimMes.setMonth(fimMes.getMonth() + 1);
    fimMes.setDate(0);
    fimMes.setHours(23, 59, 59, 999);

    try {
        console.log('\n📅 Listando eventos do mês atual');
        const res = await calendar.events.list({
            calendarId: CALENDAR_ID,
            timeMin: inicioMes.toISOString(),
            timeMax: fimMes.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });
        return res.data.items;
    } catch (error) {
        console.error('\n❌ Erro ao listar eventos do mês:', error);
        throw error;
    }
}

async function listarEventosProximoMes(auth) {
    const calendar = google.calendar({ version: 'v3', auth });

    // Obtém o primeiro dia do próximo mês
    const inicioProximoMes = new Date();
    inicioProximoMes.setMonth(inicioProximoMes.getMonth() + 1);
    inicioProximoMes.setDate(1);
    inicioProximoMes.setHours(0, 0, 0, 0);

    // Obtém o último dia do próximo mês
    const fimProximoMes = new Date(inicioProximoMes);
    fimProximoMes.setMonth(fimProximoMes.getMonth() + 1);
    fimProximoMes.setDate(0);
    fimProximoMes.setHours(23, 59, 59, 999);

    try {
        console.log('\n📅 Listando eventos do próximo mês:', {
            inicio: inicioProximoMes.toLocaleDateString('pt-BR'),
            fim: fimProximoMes.toLocaleDateString('pt-BR')
        });

        const res = await calendar.events.list({
            calendarId: CALENDAR_ID,
            timeMin: inicioProximoMes.toISOString(),
            timeMax: fimProximoMes.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            timeZone: 'America/Sao_Paulo'
        });

        console.log(`\n📊 Eventos encontrados: ${res.data.items?.length || 0}`);
        return res.data.items || [];
    } catch (error) {
        console.error('\n❌ Erro ao listar eventos do próximo mês:', error);
        throw error;
    }
}

async function listarEventosData(auth, data) {
    const calendar = google.calendar({ version: 'v3', auth });

    // Ajusta para exatamente 00:00 até 23:59 do dia
    const dataInicio = data + 'T00:00:00-03:00';
    const dataFim = data + 'T23:59:59-03:00';

    try {
        console.log(`\n📅 Listando eventos para ${data}`, {
            inicio: dataInicio,
            fim: dataFim,
            dataOriginal: data
        });

        const res = await calendar.events.list({
            calendarId: CALENDAR_ID,
            timeMin: new Date(dataInicio).toISOString(),
            timeMax: new Date(dataFim).toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            timeZone: 'America/Sao_Paulo'
        });

        console.log(`\n📊 Eventos encontrados: ${res.data.items?.length || 0}`);
        return res.data.items || [];
    } catch (error) {
        console.error('\n❌ Erro ao listar eventos da data:', error);
        throw error;
    }
}

async function adicionarEvento(auth, eventoInfo, targetCalendarId = null) {
    try {
        const calendar = google.calendar({ version: 'v3', auth });

        // Parse das informações do evento
        const [titulo, dataInicio, dataFim, descricao, local] = eventoInfo.split('|').map(item => item.trim());

        const evento = {
            summary: titulo,
            description: descricao,
            start: {
                dateTime: new Date(dataInicio).toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
            end: {
                dateTime: new Date(dataFim).toISOString(),
                timeZone: 'America/Sao_Paulo',
            }
        };

        if (local) evento.location = local;

        const calendarId = targetCalendarId || CALENDAR_ID;

        const response = await calendar.events.insert({
            calendarId: calendarId,
            resource: evento,
        });

        console.log(`\n✅ Evento adicionado (Calendar: ${calendarId}):`, response.data);
        return response.data;
    } catch (error) {
        console.error('\n❌ Erro ao adicionar evento:', error);
        throw error;
    }
}

async function listarEventosParaDeletar(auth, data) {
    try {
        const calendar = google.calendar({ version: 'v3', auth });

        // Configura as datas para o dia especificado
        const inicio = new Date(data);
        inicio.setHours(0, 0, 0, 0);

        const fim = new Date(data);
        fim.setHours(23, 59, 59, 999);

        const res = await calendar.events.list({
            calendarId: CALENDAR_ID,
            timeMin: inicio.toISOString(),
            timeMax: fim.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });

        return res.data.items;
    } catch (error) {
        console.error('Erro ao listar eventos para deletar:', error);
        throw error;
    }
}



function formatarEventosData(eventos, data) {
    const dataObj = new Date(data);
    const dataFormatada = dataObj.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    if (!eventos || eventos.length === 0) {
        return `📅 Não há eventos programados para ${dataFormatada}.`;
    }

    let mensagem = `📅 *Eventos para ${dataFormatada}:*\n\n`;
    eventos.forEach((evento, index) => {
        const inicio = new Date(evento.start.dateTime || evento.start.date);
        mensagem += `${index + 1}. *${evento.summary}*\n`;
        mensagem += `⏰ ${inicio.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`;
        if (evento.description) mensagem += `📝 ${evento.description}\n`;
        if (evento.location) mensagem += `📍 ${evento.location}\n`;
        mensagem += '\n';
    });
    return mensagem;
}

// Função para formatar eventos
function formatarEventos(eventos, titulo = '📅 *Próximos Eventos:*\n\n') {
    if (!eventos || eventos.length === 0) {
        return '📅 Não há eventos programados.';
    }

    let mensagem = titulo;
    eventos.forEach((evento, index) => {
        const inicio = new Date(evento.start.dateTime || evento.start.date);
        mensagem += `${index + 1}. *${evento.summary}*\n`;
        mensagem += `📆 ${inicio.toLocaleDateString('pt-BR')}\n`;
        mensagem += `⏰ ${inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n`;
        if (evento.location) mensagem += `📍 ${evento.location}\n`;
        if (evento.description) mensagem += `📝 ${evento.description}\n`;
        mensagem += '\n';
    });

    return mensagem;
}

async function removerEvento(auth, eventId) {
    const calendar = google.calendar({ version: 'v3', auth });
    try {
        console.log('\n🗑️ Removendo evento...');
        console.log('📝 ID do evento:', eventId);
        console.log('📅 Calendário:', CALENDAR_ID);

        await calendar.events.delete({
            calendarId: CALENDAR_ID,
            eventId: eventId
        });

        console.log('✅ Evento removido com sucesso!');
        return true;
    } catch (error) {
        console.error('\n❌ Erro ao remover evento:', error);
        if (error.response) {
            console.error('📝 Detalhes:', error.response.data);
        }
        throw error;
    }
}

async function criarEventoDeTexto(auth, texto) {
    try {
        // Expressões regulares para extrair informações
        const dataRegex = /(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2} de [a-zA-Zç]+)/gi;
        const horaRegex = /(\d{1,2}:\d{2})/g;
        const localRegex = /(local|lugar|endereço):\s*([^,\n]+)/i;

        // Extrai as informações
        const datas = texto.match(dataRegex);
        const horas = texto.match(horaRegex);
        const localMatch = texto.match(localRegex);

        if (!datas || !horas) {
            console.log('\n❌ Não foi possível encontrar data e hora no convite\n');
            return null;
        }

        // Processa a data e hora
        const data = datas[0];
        const hora = horas[0];
        const dataHora = new Date(data.replace(/de/g, ''));
        dataHora.setHours(parseInt(hora.split(':')[0]), parseInt(hora.split(':')[1]));

        // Cria o evento
        const evento = {
            summary: 'Novo Evento de Convite',
            description: texto.substring(0, 500), // Limita a descrição a 500 caracteres
            start: {
                dateTime: dataHora.toISOString(),
                timeZone: 'America/Sao_Paulo',
            },
            end: {
                dateTime: new Date(dataHora.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 horas de duração
                timeZone: 'America/Sao_Paulo',
            }
        };

        if (localMatch) {
            evento.location = localMatch[2];
        }

        const calendar = google.calendar({ version: 'v3', auth });
        const res = await calendar.events.insert({
            calendarId: CALENDAR_ID,
            resource: evento,
        });

        console.log('\n✅ Evento criado com sucesso do convite!\n');
        return res.data;
    } catch (error) {
        console.error('\n❌ Erro ao criar evento do convite:', error, '\n');
        return null;
    }
}

async function listarProximosEventos(auth) {
    const calendar = google.calendar({ version: 'v3', auth });
    const agora = new Date();

    try {
        console.log(`\n📅 Listando próximos 10 eventos`);
        const res = await calendar.events.list({
            calendarId: CALENDAR_ID,
            timeMin: agora.toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        });
        return res.data.items;
    } catch (error) {
        console.error('\n❌ Erro ao listar próximos eventos:', error);
        throw error;
    }
}

// Adicionar tratamento de erros
async function listEvents() {
    try {
        // ...existing code...
    } catch (error) {
        console.error('Erro ao listar eventos:', error);
        throw error;
    }
}

// Remover exportação não utilizada
module.exports = {
    getGoogleAuth,
    verificarDataHora,
    listarEventos,
    listarEventosAmanha,
    listarEventosSemana,
    listarEventosData,
    adicionarEvento,
    CALENDAR_ID,
    listarEventosParaDeletar,
    formatarEventos,
    formatarEventosData,
    removerEvento,
    criarEventoDeTexto,
    listarEventosProximaSemana,
    listarEventosMes,
    listarEventosProximoMes,
    listarEventosPeriodo,
    listarProximosEventos,
    PASCOM_CALENDAR_ID
};
