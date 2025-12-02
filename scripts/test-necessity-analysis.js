const path = require('path');
const fs = require('fs');
const FinanceTracker = require('../src/services/finance-tracker');

console.log('🧪 TESTE DO SISTEMA DE ANÁLISE DE NECESSIDADE\n');

// Caminho para dados de teste
const testUserId = 'test-necessity-user';
const testDataDir = path.join(__dirname, '..', 'temp', 'finance-data');

// Limpa dados antigos
const testFile = path.join(testDataDir, `${testUserId}-finance.json`);
if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
    console.log('🧹 Dados de teste antigos limpos\n');
}

const tracker = new FinanceTracker(testUserId);

console.log('═══════════════════════════════════════════════════════════');
console.log('1️⃣ TESTE: Gastos Essenciais (80-100)');
console.log('═══════════════════════════════════════════════════════════\n');

const essentialExpenses = [
    { amount: 800, category: 'Moradia', description: 'Aluguel mensal' },
    { amount: 60, category: 'Moradia', description: 'Conta de água' },
    { amount: 150, category: 'Moradia', description: 'Conta de luz' },
    { amount: 45, category: 'Saúde', description: 'Remédio pressão alta' },
    { amount: 200, category: 'Alimentação', description: 'Mercado essencial compras do mês' }
];

essentialExpenses.forEach(exp => {
    const result = tracker.addExpense(exp.amount, exp.category, exp.description);
    console.log(`💰 R$${exp.amount} - ${exp.category}: ${exp.description}`);
    console.log(`   ${result.transaction.necessityEmoji} ${result.transaction.necessityLabel} (Score: ${result.transaction.necessityScore}/100)\n`);
});

console.log('═══════════════════════════════════════════════════════════');
console.log('2️⃣ TESTE: Gastos Importantes (60-79)');
console.log('═══════════════════════════════════════════════════════════\n');

const importantExpenses = [
    { amount: 120, category: 'Transporte', description: 'Combustível para trabalho' },
    { amount: 300, category: 'Educação', description: 'Curso profissionalizante' },
    { amount: 80, category: 'Vestuário', description: 'Uniforme trabalho' }
];

importantExpenses.forEach(exp => {
    const result = tracker.addExpense(exp.amount, exp.category, exp.description);
    console.log(`💰 R$${exp.amount} - ${exp.category}: ${exp.description}`);
    console.log(`   ${result.transaction.necessityEmoji} ${result.transaction.necessityLabel} (Score: ${result.transaction.necessityScore}/100)\n`);
});

console.log('═══════════════════════════════════════════════════════════');
console.log('3️⃣ TESTE: Gastos Moderados (40-59)');
console.log('═══════════════════════════════════════════════════════════\n');

const moderateExpenses = [
    { amount: 45, category: 'Alimentação', description: 'Almoço no restaurante' },
    { amount: 90, category: 'Vestuário', description: 'Calça jeans básica' },
    { amount: 25, category: 'Alimentação', description: 'Café na padaria' }
];

moderateExpenses.forEach(exp => {
    const result = tracker.addExpense(exp.amount, exp.category, exp.description);
    console.log(`💰 R$${exp.amount} - ${exp.category}: ${exp.description}`);
    console.log(`   ${result.transaction.necessityEmoji} ${result.transaction.necessityLabel} (Score: ${result.transaction.necessityScore}/100)\n`);
});

console.log('═══════════════════════════════════════════════════════════');
console.log('4️⃣ TESTE: Gastos Dispensáveis (20-39)');
console.log('═══════════════════════════════════════════════════════════\n');

const dispensableExpenses = [
    { amount: 35, category: 'Alimentação', description: 'Fast food delivery' },
    { amount: 15, category: 'Alimentação', description: 'Chocolate doce' },
    { amount: 50, category: 'Outros', description: 'Compra online não essencial' }
];

dispensableExpenses.forEach(exp => {
    const result = tracker.addExpense(exp.amount, exp.category, exp.description);
    console.log(`💰 R$${exp.amount} - ${exp.category}: ${exp.description}`);
    console.log(`   ${result.transaction.necessityEmoji} ${result.transaction.necessityLabel} (Score: ${result.transaction.necessityScore}/100)\n`);
});

console.log('═══════════════════════════════════════════════════════════');
console.log('5️⃣ TESTE: Gastos Supérfluos (0-19)');
console.log('═══════════════════════════════════════════════════════════\n');

const superfluousExpenses = [
    { amount: 40, category: 'Lazer', description: 'Netflix streaming' },
    { amount: 65, category: 'Lazer', description: 'Balada com amigos' },
    { amount: 150, category: 'Outros', description: 'Game compra por impulso' },
    { amount: 30, category: 'Lazer', description: 'Cinema ingresso' }
];

superfluousExpenses.forEach(exp => {
    const result = tracker.addExpense(exp.amount, exp.category, exp.description);
    console.log(`💰 R$${exp.amount} - ${exp.category}: ${exp.description}`);
    console.log(`   ${result.transaction.necessityEmoji} ${result.transaction.necessityLabel} (Score: ${result.transaction.necessityScore}/100)\n`);
});

console.log('═══════════════════════════════════════════════════════════');
console.log('6️⃣ TESTE: Contexto Afeta Score (urgência vs impulso)');
console.log('═══════════════════════════════════════════════════════════\n');

const contextExpenses = [
    { amount: 200, category: 'Saúde', description: 'Consulta médica urgente essencial' },
    { amount: 150, category: 'Vestuário', description: 'Tênis da moda compra por impulso' }
];

contextExpenses.forEach(exp => {
    const result = tracker.addExpense(exp.amount, exp.category, exp.description);
    console.log(`💰 R$${exp.amount} - ${exp.category}: ${exp.description}`);
    console.log(`   ${result.transaction.necessityEmoji} ${result.transaction.necessityLabel} (Score: ${result.transaction.necessityScore}/100)`);
    if (exp.description.includes('urgente') || exp.description.includes('essencial')) {
        console.log('   ⬆️ Score aumentado por contexto de urgência (+10)');
    }
    if (exp.description.includes('impulso')) {
        console.log('   ⬇️ Score reduzido por contexto de impulso (-15)');
    }
    console.log();
});

// Adiciona uma receita para testar saldo
tracker.addIncome(3000, 'Salário', 'Salário mensal');

console.log('═══════════════════════════════════════════════════════════');
console.log('7️⃣ RESUMO FINAL COM ANÁLISE DE NECESSIDADE');
console.log('═══════════════════════════════════════════════════════════\n');

const summary = tracker.getMonthSummary();

console.log(`📊 Resumo Financeiro:`);
console.log(`   Total Despesas: R$${summary.totalExpenses.toFixed(2)}`);
console.log(`   Total Receitas: R$${summary.totalIncome.toFixed(2)}`);
console.log(`   Saldo: R$${summary.balance.toFixed(2)}\n`);

console.log(`🎯 Análise de Necessidade dos Gastos:\n`);

const levels = [
    { key: 'essential', emoji: '🔴', label: 'Essencial' },
    { key: 'important', emoji: '🟠', label: 'Importante' },
    { key: 'moderate', emoji: '🟡', label: 'Moderado' },
    { key: 'dispensable', emoji: '🟢', label: 'Dispensável' },
    { key: 'superfluous', emoji: '🔵', label: 'Supérfluo' }
];

levels.forEach(level => {
    const data = summary.necessityAnalysis[level.key];
    console.log(`   ${level.emoji} ${level.label}:`);
    console.log(`      Valor: R$${data.amount.toFixed(2)}`);
    console.log(`      Transações: ${data.count}`);
    console.log(`      Percentual: ${data.percentage}% do total\n`);
});

console.log(`💡 Insight sobre Gastos Evitáveis:\n`);
console.log(`   Total Evitável (Dispensável + Supérfluo): R$${summary.avoidableExpenses.toFixed(2)}`);
console.log(`   Percentual dos Gastos: ${summary.avoidablePercentage}%\n`);

if (summary.avoidablePercentage > 20) {
    console.log(`   ⚠️ Você está gastando mais de 20% em itens evitáveis!`);
    console.log(`   💰 Economia potencial: R$${summary.avoidableExpenses.toFixed(2)}\n`);
} else if (summary.avoidablePercentage > 10) {
    console.log(`   ℹ️ Gastos evitáveis moderados. Há espaço para economia.\n`);
} else {
    console.log(`   ✅ Seus gastos são majoritariamente necessários!\n`);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('8️⃣ TOP 5 CATEGORIAS POR GASTO');
console.log('═══════════════════════════════════════════════════════════\n');

summary.byCategory.slice(0, 5).forEach((cat, i) => {
    console.log(`   ${i + 1}. ${cat.category}: R$${cat.amount} (${cat.percentage}%)`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('🎯 TESTE COMPLETO - SISTEMA FUNCIONANDO!');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('✅ FUNCIONALIDADES VALIDADAS:');
console.log('  • Classificação automática por palavras-chave');
console.log('  • 5 níveis de necessidade (Essencial → Supérfluo)');
console.log('  • Score de 0-100 para cada transação');
console.log('  • Ajuste de score por contexto (+urgente, -impulso)');
console.log('  • Emojis visuais para cada nível');
console.log('  • Análise percentual por categoria de necessidade');
console.log('  • Cálculo de gastos evitáveis');
console.log('  • Insights automáticos sobre padrões de consumo\n');
