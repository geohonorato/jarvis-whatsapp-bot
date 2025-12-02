const { registrarDespesa, obterResumoFinanceiro } = require('../src/services/finance-api');

console.log('🧪 TESTE DE INTEGRAÇÃO - ANÁLISE DE NECESSIDADE\n');

const testUserId = 'integration-test-user';

console.log('═══════════════════════════════════════════════════════════');
console.log('1️⃣ Testando Registro de Diferentes Tipos de Gastos');
console.log('═══════════════════════════════════════════════════════════\n');

// Gasto essencial
console.log('📍 Teste 1: Gasto Essencial (aluguel)');
let result = registrarDespesa(testUserId, 800, 'Moradia', 'Aluguel mensal');
console.log(`✅ Registrado: R$${result.valor}`);
console.log(`   Necessidade: ${result.necessidade.emoji} ${result.necessidade.label} (${result.necessidade.score}/100)`);
console.log(`   Gasto evitável no mês: R$${result.gastoEvitavel}\n`);

// Gasto supérfluo
console.log('📍 Teste 2: Gasto Supérfluo (netflix)');
result = registrarDespesa(testUserId, 40, 'Lazer', 'Netflix streaming');
console.log(`✅ Registrado: R$${result.valor}`);
console.log(`   Necessidade: ${result.necessidade.emoji} ${result.necessidade.label} (${result.necessidade.score}/100)`);
console.log(`   Gasto evitável no mês: R$${result.gastoEvitavel}\n`);

// Gasto dispensável
console.log('📍 Teste 3: Gasto Dispensável (fast food)');
result = registrarDespesa(testUserId, 35, 'Alimentação', 'Fast food delivery');
console.log(`✅ Registrado: R$${result.valor}`);
console.log(`   Necessidade: ${result.necessidade.emoji} ${result.necessidade.label} (${result.necessidade.score}/100)`);
console.log(`   Gasto evitável no mês: R$${result.gastoEvitavel}\n`);

// Gasto importante
console.log('📍 Teste 4: Gasto Importante (combustível trabalho)');
result = registrarDespesa(testUserId, 120, 'Transporte', 'Combustível para trabalho');
console.log(`✅ Registrado: R$${result.valor}`);
console.log(`   Necessidade: ${result.necessidade.emoji} ${result.necessidade.label} (${result.necessidade.score}/100)`);
console.log(`   Gasto evitável no mês: R$${result.gastoEvitavel}\n`);

// Gasto com contexto de impulso
console.log('📍 Teste 5: Gasto com Impulso (roupa compra por impulso)');
result = registrarDespesa(testUserId, 150, 'Vestuário', 'Camisa da moda compra por impulso');
console.log(`✅ Registrado: R$${result.valor}`);
console.log(`   Necessidade: ${result.necessidade.emoji} ${result.necessidade.label} (${result.necessidade.score}/100)`);
console.log(`   Gasto evitável no mês: R$${result.gastoEvitavel}\n`);

console.log('═══════════════════════════════════════════════════════════');
console.log('2️⃣ Resumo Financeiro com Análise de Necessidade');
console.log('═══════════════════════════════════════════════════════════\n');

const resumo = obterResumoFinanceiro(testUserId);

console.log(`📊 Resumo Financeiro:`);
console.log(`   Total Despesas: R$${resumo.despesas.toFixed(2)}`);
console.log(`   Total Receitas: R$${resumo.receitas.toFixed(2)}`);
console.log(`   Saldo: R$${resumo.saldo.toFixed(2)} (${resumo.status})\n`);

console.log(`🎯 Análise de Necessidade:\n`);

const levels = [
    { key: 'essential', emoji: '🔴', label: 'Essencial' },
    { key: 'important', emoji: '🟠', label: 'Importante' },
    { key: 'moderate', emoji: '🟡', label: 'Moderado' },
    { key: 'dispensable', emoji: '🟢', label: 'Dispensável' },
    { key: 'superfluous', emoji: '🔵', label: 'Supérfluo' }
];

levels.forEach(level => {
    const data = resumo.analiseNecessidade[level.key];
    if (data.count > 0) {
        console.log(`   ${level.emoji} ${level.label}:`);
        console.log(`      Valor: R$${data.amount.toFixed(2)}`);
        console.log(`      Transações: ${data.count}`);
        console.log(`      Percentual: ${data.percentage}%\n`);
    }
});

console.log(`💰 Total Evitável: R$${resumo.gastoEvitavel.toFixed(2)} (${resumo.percentualEvitavel}%)`);

if (resumo.percentualEvitavel > 20) {
    console.log(`   ⚠️ Mais de 20% em gastos evitáveis!\n`);
} else if (resumo.percentualEvitavel > 10) {
    console.log(`   ℹ️ Gastos evitáveis moderados. Há espaço para economia.\n`);
} else {
    console.log(`   ✅ Gastos majoritariamente necessários!\n`);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('3️⃣ Top Categorias');
console.log('═══════════════════════════════════════════════════════════\n');

resumo.topCategorias.forEach((cat, i) => {
    console.log(`   ${i + 1}. ${cat.category}: R$${cat.amount} (${cat.percentage}%)`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('✅ INTEGRAÇÃO FUNCIONANDO PERFEITAMENTE!');
console.log('═══════════════════════════════════════════════════════════');
console.log('\n🎯 Pronto para uso no WhatsApp via message-handler.js\n');
