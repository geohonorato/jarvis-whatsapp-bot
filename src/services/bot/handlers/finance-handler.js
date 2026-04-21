const { adicionarAoHistorico } = require('../../chat/chat-history');
const tracker = require('../../finance/finance-tracker');

// Lista de comandos financeiros
const COMANDOS_FINANCEIROS = ['/gasto', '/receita', '/financas'];

function isFinanceCommand(respostaIA) {
    const lower = respostaIA.toLowerCase();
    return COMANDOS_FINANCEIROS.some(cmd => lower.startsWith(cmd));
}

function formatarMoeda(valor) {
    const num = parseFloat(valor) || 0;
    return 'R$ ' + num.toFixed(2).replace('.', ',').replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
}

async function handleFinanceCommand(client, chatId, respostaIA) {
    console.log('\\n💰 Processando comando financeiro gerado pela IA:', respostaIA);

    try {
        const primeiraLinha = respostaIA.split('\\n')[0].trim();
        const partes = primeiraLinha.split(' ');
        const comando = partes[0].toLowerCase();
        let respostaFinal = null;

        if (comando === '/gasto') {
            const valor = parseFloat(partes[1]);
            const categoria = partes[2] || 'Outros';
            const descricao = partes.slice(3).join(' ') || '';

            const result = await tracker.addExpense(valor, categoria, descricao);
            if (!result.error) {
                respostaFinal = `✅ Gasto anotado!\n💸 Valor: ${formatarMoeda(valor)}\n📍 Categoria: ${categoria}\n📑 Detalhes: ${descricao}\n\n*Classificação:* ${result.transaction.necessity.label} `;
            } else {
                respostaFinal = '❌ Erro ao registrar seu gasto.';
            }
        }
        else if (comando === '/receita') {
            const valor = parseFloat(partes[1]);
            const categoria = partes[2] || 'Receita';
            const descricao = partes.slice(3).join(' ') || '';

            const result = await tracker.addIncome(valor, categoria, descricao);
            if (!result.error) {
                respostaFinal = `✅ Receita anotada!\n💰 Valor: ${formatarMoeda(valor)}\n📍 Categoria: ${categoria}\n📑 Detalhes: ${descricao}`;
            } else {
                respostaFinal = '❌ Erro ao registrar receita.';
            }
        }
        else if (comando === '/financas') {
            const resumo = await tracker.getMonthSummary();
            
            if (resumo) {
                let text = `📊 *Resumo Financeiro (${resumo.month})*\n\n` +
                           `💰 *Receitas:* ${formatarMoeda(resumo.totalIncome)}\n` +
                           `💸 *Despesas:* ${formatarMoeda(resumo.totalExpenses)}\n` +
                           `🏦 *Saldo:* ${formatarMoeda(resumo.balance)}\n\n` +
                           `*Maiores Gastos:*\n`;
                
                resumo.topCategories.forEach(cat => {
                    text += `• ${cat.category}: ${formatarMoeda(cat.amount)}\n`;
                });
                
                respostaFinal = text;
            } else {
                respostaFinal = "❌ Não foi possível carregar o resumo.";
            }
        }

        if (respostaFinal) {
            await client.sendMessage(chatId, respostaFinal);
            adicionarAoHistorico(chatId, 'model', [{ text: respostaFinal }]);
        }
    } catch (error) {
        console.error('❌ Erro no finance-handler:', error.message);
        await client.sendMessage(chatId, '❌ Ocorreu um erro interno ao processar as finanças.');
    }
}

module.exports = { isFinanceCommand, handleFinanceCommand };
