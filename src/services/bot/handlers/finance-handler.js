/**
 * Finance Handler — gerencia todos os comandos financeiros
 * Extraído de message-handler.js para melhor organização
 */

const {
    registrarDespesa,
    registrarReceita,
    obterResumoFinanceiro,
    obterUltimasTransacoes,
    definirOrcamento,
    obterComparacao
} = require('../../finance-api');
const { processarComGroq } = require('../../api/groq');
const { adicionarAoHistorico } = require('../../chat-history');

// Lista de comandos financeiros
const COMANDOS_FINANCEIROS = ['/gasto', '/receita', '/financas', '/transacoes', '/orcamento', '/comparativo'];

/**
 * Verifica se a resposta da IA é um comando financeiro
 */
function isFinanceCommand(respostaIA) {
    const lower = respostaIA.toLowerCase();
    return COMANDOS_FINANCEIROS.some(cmd => lower.startsWith(cmd));
}

/**
 * Processa um comando financeiro e envia a resposta
 */
async function handleFinanceCommand(client, chatId, respostaIA) {
    console.log('\n💰 Processando comando financeiro gerado pela IA:', respostaIA);

    try {
        const primeiraLinha = respostaIA.split('\n')[0].trim();
        const partes = primeiraLinha.split(' ');
        const comando = partes[0].toLowerCase();
        let respostaFinal = null;

        if (comando === '/gasto') {
            const valor = parseFloat(partes[1]);
            const categoria = partes[2] || 'Outros';
            const descricao = partes.slice(3).join(' ') || '';

            const resultado = registrarDespesa(chatId, valor, categoria, descricao);

            if (!resultado.erro) {
                const necessidadeInfo = resultado.necessidade
                    ? `${resultado.necessidade.emoji} ${resultado.necessidade.label} (score: ${resultado.necessidade.score}/100)`
                    : '';
                const evitavelInfo = resultado.gastoEvitavel > 0
                    ? `Gastos evitáveis no mês: R$${resultado.gastoEvitavel.toFixed(2)}`
                    : '';

                const partsGroq = [{
                    text: `Formatar resposta para usuário que registrou gasto de R$${valor} em ${categoria}. ${necessidadeInfo}. Total gasto no mês: R$${resultado.totalGastoMes}. Saldo: R$${resultado.saldoMes}. ${evitavelInfo}. ${resultado.orcamento ? `Orçamento: R$${resultado.orcamento.budget}, usado: ${resultado.orcamento.percentage}%` : ''}. Responda de forma objetiva em português. Máximo 3 linhas.`
                }];
                respostaFinal = await processarComGroq(partsGroq);
            } else {
                respostaFinal = resultado.mensagem;
            }
        }
        else if (comando === '/receita') {
            const valor = parseFloat(partes[1]);
            const categoria = partes[2] || 'Receita';
            const descricao = partes.slice(3).join(' ') || '';

            const resultado = registrarReceita(chatId, valor, categoria, descricao);

            if (!resultado.erro) {
                const partsGroq = [{
                    text: `Formatar resposta para usuário que registrou receita de R$${valor}. Total de receitas no mês: R$${resultado.totalReceitaMes}. Saldo: R$${resultado.saldoMes}. Responda de forma positiva em português. Máximo 2 linhas.`
                }];
                respostaFinal = await processarComGroq(partsGroq);
            } else {
                respostaFinal = resultado.mensagem;
            }
        }
        else if (comando === '/financas') {
            const resumo = obterResumoFinanceiro(chatId);

            if (!resumo.erro) {
                const analiseNecessidade = resumo.analiseNecessidade ?
                    `Análise de necessidade dos gastos: 🔴 Essencial ${resumo.analiseNecessidade.essential.percentage}%, 🟠 Importante ${resumo.analiseNecessidade.important.percentage}%, 🟡 Moderado ${resumo.analiseNecessidade.moderate.percentage}%, 🟢 Dispensável ${resumo.analiseNecessidade.dispensable.percentage}%, 🔵 Supérfluo ${resumo.analiseNecessidade.superfluous.percentage}%. Gastos evitáveis (dispensável + supérfluo): R$${resumo.gastoEvitavel} (${resumo.percentualEvitavel}% do total).`
                    : '';

                const partsGroq = [{
                    text: `Formatar resumo financeiro mensal de forma clara. Receitas: R$${resumo.receitas}, Despesas: R$${resumo.despesas}, Saldo: R$${resumo.saldo} (${resumo.status}). Top categorias: ${resumo.topCategorias.map(c => `${c.category} R$${c.amount}`).join(', ')}. Média diária: R$${resumo.mediaDiaria}. ${resumo.orcamento ? `Orçamento: ${resumo.orcamento.percentage}% usado` : ''}. ${analiseNecessidade} Responda em português com formatação clara e emojis. Máximo 8 linhas, destaque os gastos evitáveis.`
                }];
                respostaFinal = await processarComGroq(partsGroq);
            } else {
                respostaFinal = resumo.mensagem;
            }
        }
        else if (comando === '/transacoes') {
            const transacoes = obterUltimasTransacoes(chatId, 5);

            if (!transacoes.erro && transacoes.quantidade > 0) {
                const lista = transacoes.transacoes.map((t, i) =>
                    `${i + 1}. ${t.tipo}: R$${t.valor} - ${t.categoria} (${t.data})`
                ).join('\n');

                respostaFinal = `📝 *Últimas ${transacoes.quantidade} transações:*\n\n${lista}`;
            } else {
                respostaFinal = '📝 Nenhuma transação registrada ainda.';
            }
        }
        else if (comando === '/orcamento') {
            const valor = parseFloat(partes[1]);
            const resultado = definirOrcamento(chatId, valor);

            if (!resultado.erro) {
                respostaFinal = `💰 Orçamento mensal definido em R$${valor}! Vou te avisar quando atingir 80% do limite.`;
            } else {
                respostaFinal = resultado.mensagem;
            }
        }
        else if (comando === '/comparativo') {
            const comparacao = obterComparacao(chatId);

            if (!comparacao.erro) {
                const emoji = comparacao.tendencia === 'Aumento' ? '📈' : comparacao.tendencia === 'Redução' ? '📉' : '➡️';
                respostaFinal = `${emoji} *Comparativo Mensal*\n\n` +
                    `Mês atual: R$${comparacao.mesAtual}\n` +
                    `Mês anterior: R$${comparacao.mesAnterior}\n` +
                    `Diferença: R$${comparacao.diferenca} (${comparacao.variacao > 0 ? '+' : ''}${comparacao.variacao}%)\n` +
                    `Tendência: ${comparacao.tendencia}`;
            } else {
                respostaFinal = comparacao.mensagem;
            }
        }

        if (respostaFinal) {
            await client.sendMessage(chatId, respostaFinal);
            adicionarAoHistorico(chatId, 'model', [{ text: respostaFinal }]);
        }
    } catch (error) {
        console.error('❌ Erro ao processar comando financeiro:', error.message);
        await client.sendMessage(chatId, '❌ Erro ao processar comando financeiro.');
    }
}

module.exports = {
    isFinanceCommand,
    handleFinanceCommand
};
