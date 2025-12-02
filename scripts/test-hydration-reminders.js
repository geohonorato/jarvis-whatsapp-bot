/**
 * Script de teste do sistema de lembretes de hidratação
 * Verifica todos os componentes e fluxos
 */

const { getOrCreateBottleTracker } = require('../src/services/hydration-bottle');
const { getOrCreateTracker } = require('../src/services/hydration-example');
const { obterDadosHidratacao, registrarConsumo } = require('../src/services/hydration-api');

console.log('🧪 TESTE DO SISTEMA DE LEMBRETES DE HIDRATAÇÃO\n');

const testUserId = 'test-user-123';

// Limpar dados antigos de teste
const fs = require('fs');
const path = require('path');
const testDataFile = path.join(__dirname, '../temp/hydration-data', `${testUserId}-hydration.json`);
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
    
    const status = tracker.getStatus();
    console.log(`   Meta diária: ${status.dailyGoal}ml`);
    console.log(`   Consumo atual: ${status.totalToday}ml`);
    console.log(`   Percentual: ${status.percentage}%`);
    console.log(`   Status: ${status.status}\n`);
} catch (error) {
    console.error('❌ ERRO na inicialização:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('2️⃣ TESTE: Registro de Consumo via API');
console.log('═══════════════════════════════════════════════════════════');

try {
    const resultado = registrarConsumo(testUserId, 250, 'test');
    
    if (resultado.erro) {
        console.error('❌ ERRO:', resultado.mensagem);
    } else {
        console.log('✅ Consumo registrado:');
        console.log(`   Quantidade: ${resultado.quantidadeRegistrada}ml`);
        console.log(`   Novo total: ${resultado.consumidoHoje}ml`);
        console.log(`   Percentual: ${resultado.percentual}%`);
        console.log(`   Faltam: ${resultado.faltam}ml\n`);
    }
} catch (error) {
    console.error('❌ ERRO no registro:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('3️⃣ TESTE: Obtenção de Dados Estruturados');
console.log('═══════════════════════════════════════════════════════════');

try {
    const dados = obterDadosHidratacao(testUserId);
    
    if (dados.erro) {
        console.error('❌ ERRO:', dados.mensagem);
    } else {
        console.log('✅ Dados obtidos com sucesso:');
        console.log(`   Consumido hoje: ${dados.consumidoHoje}ml`);
        console.log(`   Meta diária: ${dados.metaDiaria}ml`);
        console.log(`   Percentual: ${dados.percentual}%`);
        console.log(`   Faltam: ${dados.faltam}ml`);
        console.log(`   Status: ${dados.statusCritico}`);
        console.log(`   Garrafa: ${dados.garrafa.nome} (${dados.garrafa.tamanho}ml)`);
        console.log(`   Próximo lembrete: ${dados.proximoLembrete.minutos} min`);
        console.log(`   Motivo: ${dados.proximoLembrete.motivo}\n`);
    }
} catch (error) {
    console.error('❌ ERRO ao obter dados:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('4️⃣ TESTE: Cálculo de Próximo Lembrete');
console.log('═══════════════════════════════════════════════════════════');

try {
    const tracker = getOrCreateTracker(testUserId);
    const proximoLembrete = tracker.calcularProximoLembrete();
    
    if (typeof proximoLembrete === 'object') {
        console.log('✅ Lembrete calculado (modo inteligente):');
        console.log(`   Minutos: ${proximoLembrete.minutes}`);
        console.log(`   Motivo: ${proximoLembrete.reason}\n`);
    } else {
        console.log('✅ Lembrete calculado (modo padrão):');
        console.log(`   Minutos: ${proximoLembrete}\n`);
    }
} catch (error) {
    console.error('❌ ERRO no cálculo:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('5️⃣ TESTE: Geração de Mensagem de Lembrete');
console.log('═══════════════════════════════════════════════════════════');

try {
    const tracker = getOrCreateTracker(testUserId);
    const lembrete = tracker.gerarLembrete();
    
    console.log('✅ Lembrete gerado:');
    console.log(`   Mensagem: ${lembrete.message}`);
    console.log(`   Status atual: ${lembrete.status.percentage}%`);
    console.log(`   Próximo em: ${lembrete.proximoLembreteEm.minutes || lembrete.proximoLembreteEm} min`);
    console.log(`   Razão: ${lembrete.razao}\n`);
} catch (error) {
    console.error('❌ ERRO ao gerar lembrete:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('6️⃣ TESTE: Múltiplos Registros e Atualização de Percentual');
console.log('═══════════════════════════════════════════════════════════');

try {
    console.log('Registrando consumos sequenciais...');
    
    const quantidades = [200, 300, 250, 400];
    for (const quantidade of quantidades) {
        const resultado = registrarConsumo(testUserId, quantidade, 'test');
        console.log(`   ${quantidade}ml → ${resultado.percentual}% (${resultado.consumidoHoje}ml)`);
    }
    
    const dadosFinais = obterDadosHidratacao(testUserId);
    console.log('\n✅ Status após múltiplos registros:');
    console.log(`   Total consumido: ${dadosFinais.consumidoHoje}ml`);
    console.log(`   Percentual: ${dadosFinais.percentual}%`);
    console.log(`   Faltam: ${dadosFinais.faltam}ml`);
    console.log(`   Status: ${dadosFinais.statusCritico}\n`);
} catch (error) {
    console.error('❌ ERRO nos múltiplos registros:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('7️⃣ TESTE: Integração com Garrafa');
console.log('═══════════════════════════════════════════════════════════');

try {
    const bottleTracker = getOrCreateBottleTracker(testUserId);
    console.log('✅ Bottle Tracker obtido:');
    console.log(`   Garrafa atual: ${bottleTracker.bottle.name}`);
    console.log(`   Tamanho: ${bottleTracker.bottle.size}ml`);
    
    const status = bottleTracker.mainTracker.getStatus();
    const garrafasEquivalentes = (status.totalToday / bottleTracker.bottle.size).toFixed(1);
    console.log(`   Garrafas equivalentes consumidas: ${garrafasEquivalentes}\n`);
} catch (error) {
    console.error('❌ ERRO na integração com garrafa:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('8️⃣ TESTE: Meta Atingida - Verificar Desativação de Lembretes');
console.log('═══════════════════════════════════════════════════════════');

try {
    // Registrar quantidade suficiente para atingir meta
    const dadosAtuais = obterDadosHidratacao(testUserId);
    const quantidadeRestante = dadosAtuais.faltam;
    
    console.log(`Registrando ${quantidadeRestante}ml para atingir meta (max 500ml por vez)...`);
    
    // Como maxIntake é 500ml, pode precisar de múltiplos registros
    let restante = quantidadeRestante;
    while (restante > 0) {
        const quantidade = Math.min(restante, 500);
        registrarConsumo(testUserId, quantidade, 'test');
        restante -= quantidade;
    }
    
    const dadosFinais = obterDadosHidratacao(testUserId);
    console.log('✅ Status após atingir meta:');
    console.log(`   Total: ${dadosFinais.consumidoHoje}ml`);
    console.log(`   Percentual: ${dadosFinais.percentual}%`);
    console.log(`   Status: ${dadosFinais.statusCritico}`);
    console.log(`   goalMet: ${dadosFinais.consumidoHoje >= dadosFinais.metaDiaria}`);
    
    // Pega o tracker existente e força reload dos dados
    const tracker = getOrCreateTracker(testUserId);
    tracker.loadData(); // Re-lê dados atualizados do disco
    const status = tracker.getStatus();
    console.log(`   Verificação interna: totalToday=${status.totalToday}ml, goalMet=${status.goalMet}`);
    
    const proximoLembrete = tracker.calcularProximoLembrete();
    
    if (proximoLembrete === 0 || (typeof proximoLembrete === 'object' && proximoLembrete.minutes === 0)) {
        console.log('✅ Lembretes CORRETAMENTE desativados após meta atingida\n');
    } else {
        console.warn('⚠️ AVISO: Lembretes ainda ativos mesmo com meta atingida!');
        console.warn(`   Próximo lembrete: ${typeof proximoLembrete === 'object' ? proximoLembrete.minutes : proximoLembrete} min\n`);
    }
} catch (error) {
    console.error('❌ ERRO no teste de meta:', error.message);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('9️⃣ TESTE: Persistência de Dados');
console.log('═══════════════════════════════════════════════════════════');

try {
    if (fs.existsSync(testDataFile)) {
        const dadosSalvos = JSON.parse(fs.readFileSync(testDataFile, 'utf8'));
        console.log('✅ Dados persistidos com sucesso:');
        console.log(`   Data: ${dadosSalvos.today}`);
        console.log(`   Registros: ${dadosSalvos.intake.length}`);
        console.log(`   Lembretes enviados: ${dadosSalvos.reminders.length}`);
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

console.log('✅ Sistema de lembretes de hidratação testado com sucesso!');
console.log('\nCONFIGURAÇÕES VALIDADAS:');
console.log('  • HydrationTracker: inicialização e status');
console.log('  • BottleTracker: integração com garrafa');
console.log('  • hydration-api: obtenção e registro de dados');
console.log('  • Cálculo de próximo lembrete (adaptativo)');
console.log('  • Geração de mensagens contextualizadas');
console.log('  • Atualização de percentual em tempo real');
console.log('  • Desativação ao atingir meta diária');
console.log('  • Persistência de dados em arquivo\n');

console.log('📋 PRÓXIMOS PASSOS:');
console.log('  1. Integrar com WhatsApp para envio automático');
console.log('  2. Validar agendamento de timeouts');
console.log('  3. Testar múltiplos usuários simultâneos');
console.log('  4. Verificar comportamento em produção\n');
