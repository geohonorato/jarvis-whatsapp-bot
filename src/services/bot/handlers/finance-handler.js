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
} = require('../../finance/finance-api');
const { processarComGroq } = require('../../api/groq');
const { adicionarAoHistorico } = require('../../chat/chat-history');
const path = require('path');
const FinanceTracker = require('../../finance/finance-tracker');

// Instância do tracker (mesma path do pluggy-sync-job)
const tracker = new FinanceTracker(path.join(__dirname, '../../../../data/finances/finances.json'));

/**
 * Formata valor em reais no padrão brasileiro: R$ 1.500,00
 */
function formatarMoeda(valor) {
    const num = parseFloat(valor) || 0;
    return 'R$ ' + num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

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
                    ? `Gastos evitáveis no mês: ${formatarMoeda(resultado.gastoEvitavel)}`
                    : '';

                const partsGroq = [{
                    text: `Formatar resposta para usuário que registrou gasto de ${formatarMoeda(valor)} em ${categoria}. ${necessidadeInfo}. Total gasto no mês: ${formatarMoeda(resultado.totalGastoMes)}. Saldo: ${formatarMoeda(resultado.saldoMes)}. ${evitavelInfo}. ${resultado.orcamento ? `Orçamento: ${formatarMoeda(resultado.orcamento.budget)}, usado: ${resultado.orcamento.percentage}%` : ''}.

IMPORTANTE: A resposta será enviada via WhatsApp. 
1. Use APENAS *texto* para negrito (NUNCA use **texto**)
2. Use _texto_ para itálico
3. NUNCA use cabeçalhos Markdown como #, ## ou ###
4. Use emojis. Máximo de 3 linhas. Responda em português.`
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
                    text: `Formatar resposta para usuário que registrou receita de ${formatarMoeda(valor)}. Total de receitas no mês: ${formatarMoeda(resultado.totalReceitaMes)}. Saldo: ${formatarMoeda(resultado.saldoMes)}.

IMPORTANTE: A resposta será enviada via WhatsApp.
1. Use APENAS *texto* para negrito (NUNCA use **texto**)
2. Use _texto_ para itálico
3. NUNCA use cabeçalhos Markdown como #, ## ou ###
4. Use emojis. Máximo de 2 linhas. Responda em português.`
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
                    `Análise de necessidade dos gastos: 🔴 Essencial ${resumo.analiseNecessidade.essential.percentage}%, 🟠 Importante ${resumo.analiseNecessidade.important.percentage}%, 🟡 Moderado ${resumo.analiseNecessidade.moderate.percentage}%, 🟢 Dispensável ${resumo.analiseNecessidade.dispensable.percentage}%, 🔵 Supérfluo ${resumo.analiseNecessidade.superfluous.percentage}%. Gastos evitáveis (dispensável + supérfluo): ${formatarMoeda(resumo.gastoEvitavel)} (${resumo.percentualEvitavel}% do total).`
                    : '';

                const partsGroq = [{
                    text: `Formatar resumo financeiro mensal. Dados:
• Receitas: ${formatarMoeda(resumo.receitas)}
• Despesas: ${formatarMoeda(resumo.despesas)}
• Saldo: ${formatarMoeda(resumo.saldo)} (${resumo.status})
• Top categorias: ${resumo.topCategorias.map(c => `${c.category} ${formatarMoeda(c.amount)}`).join(', ')}
• Média diária: ${formatarMoeda(resumo.mediaDiaria)}
${resumo.orcamento ? `• Orçamento: ${resumo.orcamento.percentage}% usado` : ''}
${analiseNecessidade}

IMPORTANTE: A resposta será enviada via WhatsApp. Regras STRICT de formatação:
1. Use APENAS *texto* para negrito (asterisco simples)
2. Use _texto_ para itálico
3. NUNCA use ** (duplo asterisco) e NUNCA use # (headers)
4. Use emojis para visual
5. Use apenas o caractere • para listas e marcadores
6. Valores em reais: sempre no formato R$ 1.000,00
7. Máximo de 10 linhas. Seja amigável e direto.`
                }];
                respostaFinal = await processarComGroq(partsGroq);
            } else {
                respostaFinal = resumo.mensagem;
            }
        }
        else if (comando === '/transacoes') {
            const transacoes = obterUltimasTransacoes(chatId, 5);

            if (!transacoes.erro && transacoes.quantidade > 0) {
                const lista = transacoes.transacoes.map((t, i) => {
                    const emoji = t.tipo === 'Despesa' ? '💸' : '💰';
                    return `${emoji} ${formatarMoeda(t.valor)} — ${t.categoria}\n     _${t.descricao || t.data}_`;
                }).join('\n\n');

                respostaFinal = `📝 *Últimas ${transacoes.quantidade} transações:*\n\n${lista}`;
            } else {
                respostaFinal = '📝 Nenhuma transação registrada ainda.';
            }
        }
        else if (comando === '/orcamento') {
            const valor = parseFloat(partes[1]);
            const resultado = definirOrcamento(chatId, valor);

            if (!resultado.erro) {
                respostaFinal = `💰 Orçamento mensal definido em *${formatarMoeda(valor)}*!\n\nVou te avisar quando atingir 80% do limite.`;
            } else {
                respostaFinal = resultado.mensagem;
            }
        }
        else if (comando === '/comparativo') {
            const comparacao = obterComparacao(chatId);

            if (!comparacao.erro) {
                const emoji = comparacao.tendencia === 'Aumento' ? '📈' : comparacao.tendencia === 'Redução' ? '📉' : '➡️';
                respostaFinal = `${emoji} *Comparativo Mensal*\n\n` +
                    `Mês atual: *${formatarMoeda(comparacao.mesAtual)}*\n` +
                    `Mês anterior: ${formatarMoeda(comparacao.mesAnterior)}\n` +
                    `Diferença: ${formatarMoeda(comparacao.diferenca)} (${comparacao.variacao > 0 ? '+' : ''}${comparacao.variacao}%)\n` +
                    `Tendência: *${comparacao.tendencia}*`;
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

/**
 * Trata respostas de texto cru quando há uma transação pendente aguardando justificação (Human-in-the-Loop)
 */
async function handlePendingTransactionReply(client, chatId, textoUsuario, pendingTransactions) {
    const pendingItem = pendingTransactions.getNextPending();
    if (!pendingItem) return false;

    console.log(`🕵️‍♂️ Resolvendo transação pendente (${pendingItem.description}) usando a resposta: "${textoUsuario}"`);

    // Mostra pro usuário que estamos processando a resposta
    await client.sendMessage(chatId, '⏳ Analisando a sua explicação...');

    const prompt = `O usuário fez uma despesa de R$ ${pendingItem.amount} que apareceu no extrato como "${pendingItem.description}".
O sistema não soube classificar e perguntou o que era.
O usuário respondeu agora: "${textoUsuario}".

Com base nessa resposta, classifique a despesa.
Retorne APENAS um JSON válido neste formato exato (sem crases Markdown, sem texto fora):
{"categoria": "NomeDaCategoria", "necessidade": "Essencial" ou "Importante" ou "Intermediário" ou "Supérfluo", "descricao_corrigida": "Descrição mais clara baseada na resposta"}`;

    const classificacaoCrua = await processarComGroq([{ text: prompt }]);

    try {
        const jsonText = classificacaoCrua.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonText);

        const categoriaFinal = data.categoria || 'Outros';
        const necessidadeFinal = data.necessidade || 'Intermediário';
        const descricaoFinal = data.descricao_corrigida && data.descricao_corrigida.length > 3 ? data.descricao_corrigida : pendingItem.description;

        // Salvar definitivamente no Tracker
        const result = tracker.addExpense(
            pendingItem.amount,
            categoriaFinal,
            descricaoFinal,
            pendingItem.date
        );

        // Remove da fila
        pendingTransactions.removePendingTransaction(pendingItem.id);

        let msgRetorno = `✅ *Despesa classificada e salva!*\n\n• Valor: ${formatarMoeda(pendingItem.amount)}\n• Categoria: *${categoriaFinal}*\n• Descrição: _${descricaoFinal}_\n\n(Score de Necessidade: ${necessidadeFinal})`;

        if (necessidadeFinal === 'Supérfluo' || necessidadeFinal === 'Dispensável') {
            const promptSermao = `O usuário Geovanni (seu criador/chefe) justificou um gasto genérico que você acabou de classificar como "Supérfluo/Evitável".
A desculpa/justificativa dele foi: "${textoUsuario}".
E os detalhes reais da compra foram: R$ ${pendingItem.amount} em "${descricaoFinal}" (Categoria: ${categoriaFinal}).
Sua missão como Jarvis (assistente irônico, sarcástico e rigoroso com as finanças dele) é dar um Puxão de Orelha sobre essa resposta. 
Humilhe a desculpa esfarrapada dele e a atitude de gastar com bobagem. Dê um sermão digno de um pai decepcionado, mas com humor ácido. Use emojis.
Máximo de 4-5 frases. Formate em texto de WhatsApp (asterisco para negrito e underline para itálico, NUNCA use markdown **).`;
            try {
                const sermao = await processarComGroq([{ text: promptSermao }]);
                msgRetorno += `\n\n🚨 *FISCAL JARVIS ATIVADO:* 🚨\n\n${sermao}`;
            } catch (e) {
                console.error("Erro ao gerar sermão no pending handler:", e);
            }
        }

        if (result.orcamento && result.orcamento.percentage >= 90) {
            msgRetorno += `\n\n⚠️ *Atenção:* O orçamento de ${categoriaFinal} já está em ${result.orcamento.percentage}%!`;
        }

        await client.sendMessage(chatId, msgRetorno);
        adicionarAoHistorico(chatId, 'model', [{ text: msgRetorno }]);
        return true;

    } catch (e) {
        console.error('Falha ao processar resposta da pending transaction:', e);
        await client.sendMessage(chatId, '❌ Ops, não entendi muito bem. Pode explicar de novo o que foi aquela compra de ' + formatarMoeda(pendingItem.amount) + '?');
        return true; // Retorna true pra interceptar a mensagem de qualquer forma
    }
}

module.exports = {
    isFinanceCommand,
    handleFinanceCommand,
    handlePendingTransactionReply
};
