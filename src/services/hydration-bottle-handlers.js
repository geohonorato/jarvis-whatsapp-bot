/**
 * Handlers para comandos de garrafa no WhatsApp
 * Integra com hidration-reminders para lembretes adaptados
 */

const { getOrCreateBottleTracker } = require('./hydration-bottle');
const { iniciarLembretesHidratacao } = require('./hydration-reminders');

/**
 * Processa comandos de garrafa
 * Exemplos:
 * - "garrafa cheia" → terminou a garrafa
 * - "bebida 50%" → bebeu 50% da garrafa
 * - "tamanho 750" → muda tamanho pra 750ml
 * - "nome garrafa térmica" → renomeia garrafa
 * - "status garrafa" → mostra status
 */
async function handleBottleCommand(message, userId) {
    const msg = message.toLowerCase().trim();
    const bottle = getOrCreateBottleTracker(userId);
    
    try {
        // --- GARRAFA CHEIA ---
        if (msg === 'garrafa cheia' || msg === 'terminei a garrafa' || 
            msg === 'garrafinha cheia' || msg === 'bebida cheia') {
            
            const status = bottle.finishBottle();
            
            const resposta = `🍾 *Excelente!* Garrafa ${bottle.bottle.refillsToday} completa!

${status.bottle.visual}

Total: ${status.totalMl}ml / ${status.goalMl}ml (${status.percentage}%)
Faltam: ${status.remainingMl}ml para a meta!

_Continue bebendo! 💧_`;
            
            // Retoma lembretes com novo intervalo
            iniciarLembretesHidratacao(null, userId);
            
            return resposta;
        }
        
        // --- CONSUMO PARCIAL (50%, 75%, etc) ---
        const parcialMatch = msg.match(/^(?:bebida?|consumo?|bebi?)\s+(\d+)%?$/);
        if (parcialMatch) {
            const percentage = parseInt(parcialMatch[1]);
            
            if (percentage < 0 || percentage > 100) {
                return '❌ Percentual inválido! Use um valor entre 0-100.';
            }
            
            if (percentage === 100) {
                return handleBottleCommand('garrafa cheia', userId);
            }
            
            const status = bottle.sip(percentage);
            
            const resposta = `💧 Registrado! Você bebeu ${percentage}% da ${bottle.bottle.name}

${status.bottle.visual}

Total: ${status.totalMl}ml / ${status.goalMl}ml (${status.percentage}%)
Faltam: ${status.remainingMl}ml`;
            
            return resposta;
        }
        
        // --- ALTERAR TAMANHO ---
        const tamanoMatch = msg.match(/^(?:tamanho|garrafa)\s+(\d+)\s*ml?$/);
        if (tamanoMatch) {
            const newSize = parseInt(tamanoMatch[1]);
            const result = bottle.setBottleSize(newSize);
            
            if (result.error) return result.error;
            
            return `✅ *Tamanho da garrafa atualizado!*

${result.oldSize}ml → ${result.newSize}ml

Próximas garrafas serão contabilizadas com o novo tamanho! 🍾`;
        }
        
        // --- RENOMEAR GARRAFA ---
        const nomeMatch = msg.match(/^(?:nome|chamar|rebatizar)\s+(.+)$/);
        if (nomeMatch) {
            const newName = nomeMatch[1];
            const result = bottle.setBottleName(newName);
            
            if (result.error) return result.error;
            
            return `✅ Garrafa renomeada para "${result.newName}"! 🍾`;
        }
        
        // --- STATUS DA GARRAFA ---
        if (msg === 'status garrafa' || msg === 'status' || msg === 'como vai') {
            const status = bottle.getBottleStatus();
            return status.summary;
        }
        
        // --- RELATÓRIO ---
        if (msg === 'relatório garrafa' || msg === 'relatório' || msg === 'relatorio') {
            return bottle.getBottleReport();
        }
        
        // --- AJUDA ---
        if (msg === 'ajuda garrafa' || msg === 'comandos garrafa' || msg === 'help') {
            return `🍾 *COMANDOS DE GARRAFA*

📝 Registrar Consumo:
• "garrafa cheia" → terminou a garrafa
• "bebida 50%" → bebeu 50% da garrafa
• "bebida 75%" → bebeu 75%
• "consumo 100%" → terminou (mesmo que "garrafa cheia")

⚙️ Configurar:
• "tamanho 750" → muda tamanho para 750ml
• "nome Garrafa Térmica" → renomeia a garrafa

📊 Informações:
• "status" → mostra status atual
• "relatório" → mostra relatório detalhado
• "ajuda" → mostra estes comandos

💡 Exemplo: Se sua garrafa é 500ml e você termina ela 6 vezes ao dia, isso = 3 litros (sua meta)!`;
        }
        
        return null; // Não reconheceu comando
        
    } catch (error) {
        console.error('❌ Erro ao processar comando de garrafa:', error);
        return `❌ Erro ao processar: ${error.message}`;
    }
}

/**
 * Detecta menções naturais a garrafa e processa
 * Exemplos de padrões que reconhece:
 * - "tomei água da minha garrafa"
 * - "terminei a garrafa"
 * - "tenho uma garrafa de 750ml"
 * - "mudei de garrafa"
 */
async function detectAndProcessBottleIntent(message, userId) {
    const msg = message.toLowerCase();
    const bottle = getOrCreateBottleTracker(userId);
    
    // Detecta "terminei a garrafa" ou "garrafa cheia"
    if (/(?:termin|finish|empt).*garrafa|garrafa.*(?:cheia|vazia|completa)/.test(msg)) {
        return handleBottleCommand('garrafa cheia', userId);
    }
    
    // Detecta mudança de tamanho ("tenho uma garrafa de 750ml" ou "comprei uma garrafa maior")
    const tamanoMatch = msg.match(/(?:garrafa|comprei|tenho|mudei).*?(\d{3,4})\s*ml/);
    if (tamanoMatch) {
        const newSize = parseInt(tamanoMatch[1]);
        return handleBottleCommand(`tamanho ${newSize}`, userId);
    }
    
    // Detecta consumo percentual ("bebi metade", "bebi 3/4", etc)
    if (/bebi\s+(?:metade|meia|1\/2)/.test(msg)) {
        return handleBottleCommand('bebida 50%', userId);
    }
    if (/bebi.*3\/4|quase.*cheia/.test(msg)) {
        return handleBottleCommand('bebida 75%', userId);
    }
    if (/bebi.*um\s+pouco|apenas.*bebida|pequeno\s+(?:gole|trago)/.test(msg)) {
        return handleBottleCommand('bebida 25%', userId);
    }
    
    return null;
}

module.exports = {
    handleBottleCommand,
    detectAndProcessBottleIntent
};
