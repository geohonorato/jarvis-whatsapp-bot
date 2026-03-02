/**
 * Job Mensal de Análise Financeira
 * - Dia 1: se tem dados do mês anterior, gera relatório + gráficos automaticamente
 * - Dia 1: pede ao usuário extrato e fatura se ainda não foram enviados
 */

const fs = require('fs');
const { getOrCreateTracker } = require('../finance/finance-api');
const { gerarGraficosFinanceiros } = require('../finance/finance-charts');
const MessageMedia = require('whatsapp-web.js').MessageMedia;
const config = require('../../config');

/**
 * Formata valor em reais no padrão brasileiro: R$ 1.500,00
 */
function formatarMoeda(valor) {
    const num = parseFloat(valor) || 0;
    return 'R$ ' + num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const WHATSAPP_NUMBER = config.whatsapp.number;

let lastMonthChecked = -1;

/**
 * Verifica se é dia 1 do mês e executa ações financeiras
 */
async function verificarAnaliseFinanceiraMensal(client) {
    try {
        const agora = new Date();
        const dia = agora.getDate();
        const hora = agora.getHours();
        const mes = agora.getMonth();

        // Dia 1 do mês, às 9h da manhã, e ainda não executou esse mês
        if (dia === 1 && hora === 9 && mes !== lastMonthChecked) {
            lastMonthChecked = mes;

            const meses = [
                'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
            ];
            const mesAnterior = meses[mes === 0 ? 11 : mes - 1];
            const ano = mes === 0 ? agora.getFullYear() - 1 : agora.getFullYear();

            console.log(`\n📊 [Monthly Finance] Executando análise mensal — ${mesAnterior}/${ano}`);

            // Verifica se já tem dados do mês que acabou de fechar
            const tracker = getOrCreateTracker(WHATSAPP_NUMBER);
            const summary = tracker.getMonthSummary();

            if (summary.transactionCount > 0) {
                // TEM DADOS: Gera relatório automático com gráficos
                await enviarRelatorioMensal(client, tracker, summary, mesAnterior, ano);
            }

            // Sempre pede novos extratos/faturas
            await pedirExtratos(client, mesAnterior, ano);
        }
    } catch (error) {
        console.error('❌ Erro no job de análise financeira mensal:', error.message);
    }
}

/**
 * Envia relatório automático com gráficos do mês que fechou
 */
async function enviarRelatorioMensal(client, tracker, summary, mesNome, ano) {
    try {
        let report = `📊 *Relatório Financeiro — ${mesNome}/${ano}*\n\n`;
        report += `💰 Receitas: ${formatarMoeda(summary.totalIncome)}\n`;
        report += `💸 Despesas: ${formatarMoeda(summary.totalExpenses)}\n`;
        report += `📈 Saldo: ${formatarMoeda(summary.balance)}\n`;
        report += `📋 ${summary.transactionCount} transações registradas\n`;
        report += `📅 Média diária: ${formatarMoeda(summary.averageDailyExpense)}\n`;

        if (summary.byCategory && summary.byCategory.length > 0) {
            report += `\n📂 *Top Categorias:*\n`;
            for (const cat of summary.byCategory.slice(0, 5)) {
                report += `  • ${cat.category}: ${formatarMoeda(cat.amount)} (${cat.percentage}%)\n`;
            }
        }

        if (summary.avoidableExpenses > 0) {
            report += `\n⚠️ *Gastos evitáveis:* ${formatarMoeda(summary.avoidableExpenses)} (${summary.avoidablePercentage}%)\n`;
            report += `💡 Reduzindo esses gastos, você economizaria ${formatarMoeda(summary.avoidableExpenses)} por mês!\n`;
        }

        if (summary.budgetStatus) {
            const bs = summary.budgetStatus;
            const emoji = bs.percentage >= 100 ? '🔴' : bs.percentage >= 80 ? '🟡' : '🟢';
            report += `\n${emoji} Orçamento: ${bs.percentage}% usado (${formatarMoeda(bs.remaining)} restante)\n`;
        }

        await client.sendMessage(WHATSAPP_NUMBER, report);

        // Gera e envia gráficos
        const chartData = tracker.generateChartData();
        const chartPaths = await gerarGraficosFinanceiros(chartData);

        for (const chartPath of chartPaths) {
            if (fs.existsSync(chartPath)) {
                const imageMedia = MessageMedia.fromFilePath(chartPath);
                await client.sendMessage(WHATSAPP_NUMBER, imageMedia);
                await new Promise(r => setTimeout(r, 1500));
            }
        }

        console.log(`📊 [Monthly Finance] Relatório enviado com ${chartPaths.length} gráfico(s)`);
    } catch (err) {
        console.error('❌ Erro ao enviar relatório mensal:', err.message);
    }
}

/**
 * Pede ao usuário para enviar extratos e faturas
 */
async function pedirExtratos(client, mesNome, ano) {
    const mensagem = `📎 *Hora de analisar suas finanças de ${mesNome}!*\n\n` +
        `Me envie os PDFs:\n` +
        `1️⃣ Extrato bancário\n` +
        `2️⃣ Fatura do cartão\n\n` +
        `Vou extrair todas as transações automaticamente, ` +
        `importar no seu controle financeiro e gerar gráficos! 📊\n\n` +
        `_Basta enviar os PDFs aqui no chat._`;

    await client.sendMessage(WHATSAPP_NUMBER, mensagem);
    console.log(`📊 [Monthly Finance] Lembrete de extratos enviado`);
}

module.exports = { verificarAnaliseFinanceiraMensal };
