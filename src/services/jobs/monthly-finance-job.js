/**
 * Job Mensal de Análise Financeira
 * Todo dia 1 do mês, pede ao usuário o extrato e a fatura para análise
 */

const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '559184527196@c.us';

let lastMonthChecked = -1;

/**
 * Verifica se é dia 1 do mês e envia lembrete para enviar extratos
 * Deve ser chamado periodicamente (a cada minuto ou junto com os outros jobs)
 */
async function verificarAnaliseFinanceiraMensal(client) {
    try {
        const agora = new Date();
        const dia = agora.getDate();
        const hora = agora.getHours();
        const mes = agora.getMonth();

        // Dia 1 do mês, às 9h da manhã, e ainda não enviou esse mês
        if (dia === 1 && hora === 9 && mes !== lastMonthChecked) {
            lastMonthChecked = mes;

            const meses = [
                'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
            ];
            const mesAnterior = meses[mes === 0 ? 11 : mes - 1];
            const ano = mes === 0 ? agora.getFullYear() - 1 : agora.getFullYear();

            const mensagem = `📊 *Análise Financeira Mensal — ${mesAnterior}/${ano}*\n\n` +
                `Hora de analisar suas finanças do mês passado! 💰\n\n` +
                `📎 Me envie os documentos do mês de ${mesAnterior}:\n\n` +
                `1️⃣ *Extrato bancário* (PDF)\n` +
                `2️⃣ *Fatura do cartão de crédito* (PDF)\n\n` +
                `Vou analisar tudo e te dar um relatório completo com:\n` +
                `• 📂 Gastos por categoria\n` +
                `• 🔝 Maiores gastos\n` +
                `• 🔄 Assinaturas recorrentes\n` +
                `• ⚠️ Alertas de gastos\n` +
                `• 💡 Dicas de economia personalizadas\n\n` +
                `_Basta enviar os PDFs aqui no chat!_`;

            console.log(`\n📊 [Monthly Finance] Enviando lembrete de análise financeira para ${WHATSAPP_NUMBER}`);
            await client.sendMessage(WHATSAPP_NUMBER, mensagem);
        }
    } catch (error) {
        console.error('❌ Erro no job de análise financeira mensal:', error.message);
    }
}

module.exports = { verificarAnaliseFinanceiraMensal };
