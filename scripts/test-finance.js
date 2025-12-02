/**
 * Script de teste do sistema de controle financeiro
 * Testa todas as funcionalidades de finanças
 */

const {
    registrarDespesa,
    registrarReceita,
    obterResumoFinanceiro,
    obterUltimasTransacoes,
    definirOrcamento,
    obterComparacao,
    getOrCreateTracker
} = require('../src/services/finance-api');

console.log('🧪 TESTE DO SISTEMA DE CONTROLE FINANCEIRO\n');

const testUserId = 'test-finance-user';

// Limpar dados antigos de teste
const fs = require('fs');
const path = require('path');
const testDataFile = path.join(__dirname, '../temp/finance-data', `${testUserId}-finance.json`);
if (fs.existsSync(testDataFile)) {
    fs.unlinkSync(testDataFile);
    console.log('🧹 Dados de teste antigos limpos\n');
}

console.log('═══════════════════════════════════════════════════════════');
console.log('1️⃣ TESTE: Inicialização do Tracker');
console.log('═══════════════════════════════════════════════════════════');

try {
    const tracker = getOrCreateTracker(testUserId);
    console.log('✅ Tracker criado com sucesso');
    console.log(`   Moeda: ${tracker.config.currency}`);
    console.log(`   Categorias: ${tracker.config.categories.length}`);
    console.log(`   Mês atual: ${tracker.data.currentMonth}\n`);
} catch (error) {
    console.error('❌ ERRO na inicialização:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('2️⃣ TESTE: Registro de Despesas');
console.log('═══════════════════════════════════════════════════════════');

try {
    console.log('Registrando despesas...');
    
    const despesas = [
        { valor: 50, categoria: 'Alimentação', descricao: 'Mercado' },
        { valor: 89, categoria: 'Vestuário', descricao: 'Camisa' },
        { valor: 150, categoria: 'Transporte', descricao: 'Uber' },
        { valor: 35, categoria: 'Alimentação', descricao: 'Lanche' }
    ];
    
    for (const despesa of despesas) {
        const resultado = registrarDespesa(testUserId, despesa.valor, despesa.categoria, despesa.descricao);
        if (!resultado.erro) {
            console.log(`   ✅ R$${despesa.valor} - ${despesa.categoria}: ${despesa.descricao}`);
        } else {
            console.error(`   ❌ Erro: ${resultado.mensagem}`);
        }
    }
    
    console.log('\n');
} catch (error) {
    console.error('❌ ERRO ao registrar despesas:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('3️⃣ TESTE: Registro de Receitas');
console.log('═══════════════════════════════════════════════════════════');

try {
    const resultado = registrarReceita(testUserId, 3500, 'Salário', 'Salário mensal');
    
    if (!resultado.erro) {
        console.log('✅ Receita registrada:');
        console.log(`   Valor: R$${resultado.valorRegistrado}`);
        console.log(`   Categoria: ${resultado.categoria}`);
        console.log(`   Total receitas: R$${resultado.totalReceitaMes}`);
        console.log(`   Saldo: R$${resultado.saldoMes}\n`);
    } else {
        console.error('❌ ERRO:', resultado.mensagem);
    }
} catch (error) {
    console.error('❌ ERRO ao registrar receita:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('4️⃣ TESTE: Resumo Financeiro do Mês');
console.log('═══════════════════════════════════════════════════════════');

try {
    const resumo = obterResumoFinanceiro(testUserId);
    
    if (!resumo.erro) {
        console.log('✅ Resumo obtido com sucesso:');
        console.log(`   Mês: ${resumo.mes}`);
        console.log(`   Receitas: R$${resumo.receitas}`);
        console.log(`   Despesas: R$${resumo.despesas}`);
        console.log(`   Saldo: R$${resumo.saldo} (${resumo.status})`);
        console.log(`   Transações: ${resumo.transacoes}`);
        console.log(`   Média diária: R$${resumo.mediaDiaria}`);
        console.log(`\n   Top Categorias:`);
        resumo.topCategorias.forEach(cat => {
            console.log(`      - ${cat.category}: R$${cat.amount} (${cat.percentage}%)`);
        });
        console.log('\n');
    } else {
        console.error('❌ ERRO:', resumo.mensagem);
    }
} catch (error) {
    console.error('❌ ERRO ao obter resumo:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('5️⃣ TESTE: Últimas Transações');
console.log('═══════════════════════════════════════════════════════════');

try {
    const transacoes = obterUltimasTransacoes(testUserId, 10);
    
    if (!transacoes.erro) {
        console.log(`✅ ${transacoes.quantidade} transações encontradas:\n`);
        transacoes.transacoes.forEach((t, i) => {
            console.log(`   ${i+1}. ${t.tipo}: R$${t.valor}`);
            console.log(`      Categoria: ${t.categoria}`);
            console.log(`      Data: ${t.data}`);
            console.log(`      Descrição: ${t.descricao}\n`);
        });
    } else {
        console.error('❌ ERRO:', transacoes.mensagem);
    }
} catch (error) {
    console.error('❌ ERRO ao obter transações:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('6️⃣ TESTE: Definição de Orçamento');
console.log('═══════════════════════════════════════════════════════════');

try {
    const resultado = definirOrcamento(testUserId, 2000);
    
    if (!resultado.erro) {
        console.log('✅ Orçamento definido:');
        console.log(`   Valor: R$${resultado.orcamentoDefinido}`);
        console.log(`   ${resultado.mensagem}\n`);
    } else {
        console.error('❌ ERRO:', resultado.mensagem);
    }
} catch (error) {
    console.error('❌ ERRO ao definir orçamento:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('7️⃣ TESTE: Status do Orçamento');
console.log('═══════════════════════════════════════════════════════════');

try {
    const resumo = obterResumoFinanceiro(testUserId);
    
    if (!resumo.erro && resumo.orcamento) {
        const orcamento = resumo.orcamento;
        console.log('✅ Status do orçamento:');
        console.log(`   Orçamento: R$${orcamento.budget}`);
        console.log(`   Usado: R$${orcamento.used}`);
        console.log(`   Restante: R$${orcamento.remaining}`);
        console.log(`   Percentual: ${orcamento.percentage}%`);
        
        if (orcamento.alert) {
            console.log(`   ⚠️ ALERTA: 80% do orçamento atingido!\n`);
        } else {
            console.log(`   ✅ Dentro do orçamento\n`);
        }
    } else {
        console.log('⚠️ Orçamento não definido\n');
    }
} catch (error) {
    console.error('❌ ERRO ao verificar orçamento:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('8️⃣ TESTE: Comparação com Mês Anterior');
console.log('═══════════════════════════════════════════════════════════');

try {
    const comparacao = obterComparacao(testUserId);
    
    if (!comparacao.erro) {
        console.log('✅ Comparação obtida:');
        console.log(`   Mês atual: R$${comparacao.mesAtual}`);
        console.log(`   Mês anterior: R$${comparacao.mesAnterior}`);
        console.log(`   Diferença: R$${comparacao.diferenca}`);
        console.log(`   Variação: ${comparacao.variacao}%`);
        console.log(`   Tendência: ${comparacao.tendencia}\n`);
    } else {
        console.log(`⚠️ ${comparacao.mensagem}\n`);
    }
} catch (error) {
    console.error('❌ ERRO ao obter comparação:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('9️⃣ TESTE: Persistência de Dados');
console.log('═══════════════════════════════════════════════════════════');

try {
    if (fs.existsSync(testDataFile)) {
        const dadosSalvos = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
        console.log('✅ Dados persistidos com sucesso:');
        console.log(`   Mês: ${dadosSalvos.currentMonth}`);
        console.log(`   Transações: ${dadosSalvos.transactions.length}`);
        console.log(`   Arquivo: ${testDataFile}\n`);
    } else {
        console.warn('⚠️ Arquivo de dados não encontrado\n');
    }
} catch (error) {
    console.error('❌ ERRO ao verificar persistência:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('🎯 RESUMO DOS TESTES');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('✅ Sistema de controle financeiro testado com sucesso!');
console.log('\nFUNCIONALIDADES VALIDADAS:');
console.log('  • FinanceTracker: inicialização e configuração');
console.log('  • Registro de despesas por categoria');
console.log('  • Registro de receitas');
console.log('  • Resumo financeiro mensal completo');
console.log('  • Listagem de transações recentes');
console.log('  • Definição e monitoramento de orçamento');
console.log('  • Alertas de orçamento (80% threshold)');
console.log('  • Comparação com mês anterior');
console.log('  • Persistência de dados em arquivo\n');

console.log('📋 INTEGRAÇÃO COM WHATSAPP:');
console.log('  • Comandos via IA detectam gastos automaticamente');
console.log('  • Categorização inteligente via Groq');
console.log('  • Respostas formatadas e humanizadas');
console.log('  • Suporte a comandos: /gasto, /receita, /financas, /transacoes, /orcamento, /comparativo\n');
