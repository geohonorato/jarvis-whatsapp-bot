/**
 * Handlers para comandos de hidratação em ml
 * Aceita entrada em ml direto: "250ml", "500ml", "1L", etc
 * Permite trocar de garrafa com "troco 750" ou "nova garrafa 1000ml"
 */

const { getOrCreateBottleTracker } = require('./hydration-bottle');
const { iniciarLembretesHidratacao } = require('./hydration-reminders');

/**
 * Processa comandos de consumo de água em ml
 * Exemplos:
 * - "250ml" → registra 250ml
 * - "1L" → registra 1000ml
 * - "0.5L" → registra 500ml
 * - "bebi 750" → registra 750ml
 * - "tomei 500ml" → registra 500ml
 */
async function handleBottleCommand(message, userId) {
    const msg = message.toLowerCase().trim();
    const bottle = getOrCreateBottleTracker(userId);
    
    try {
        // --- TROCAR DE GARRAFA ---
        const trocaMatch = msg.match(/(?:troco|trocando|nova garrafa|mudi|mudei|comprei)\s+(?:de\s+)?(\d+)\s*(?:ml)?/i);
        if (trocaMatch) {
            const newSize = parseInt(trocaMatch[1]);
            const result = bottle.changeBottle(newSize);
            
            if (result.error) return result.error;
            
            return `✅ *Garrafa Trocada!*

Anterior: ${result.oldSize}ml
Nova: ${result.newSize}ml (${result.newName})

Próximas garrafas serão de ${result.newSize}ml! 🍾`;
        }
        
        // --- RENOMEAR GARRAFA ---
        const nomeMatch = msg.match(/^(?:nome|chamar|rebatizar|garrafa)\s+(.+)$/);
        if (nomeMatch) {
            const newName = nomeMatch[1];
            const result = bottle.setBottleName(newName);
            
            if (result.error) return result.error;
            
            return `✅ Garrafa renomeada para "${result.newName}"! 🍾`;
        }
        
        // --- REGISTRAR CONSUMO EM ML ---
        // Aceita: "250ml", "250", "bebi 500", "tomei 1L", "500ml", etc
        const mlMatch = msg.match(/(?:bebi?|tomei?|consumo?)?\s*(\d+(?:\.\d+)?)\s*(?:ml|l)?/i);
        if (mlMatch) {
            let ml = parseFloat(mlMatch[1]);
            
            // Se não tem "ml" ou "l" explícito, assume ml
            // Se tem "L", converte para ml
            if (msg.includes('l') && !msg.includes('ml')) {
                ml = ml * 1000; // 1L = 1000ml, 0.5L = 500ml
            }
            
            ml = Math.round(ml);
            
            if (ml <= 0) {
                return '❌ Quantidade inválida! Use um valor maior que 0.';
            }
            
            // Limita ao máximo 3000ml de uma vez (evita erros)
            if (ml > 3000) {
                return `⚠️ Quantidade muito alta (${ml}ml)! Máximo sugerido: 3000ml. Use "bebi 1500" + "bebi 1500" se necessário.`;
            }
            
            const status = bottle.registerWater(ml);
            
            const resposta = `💧 *Registrado!* +${ml}ml

${status.bottle.visual}

Total: ${status.totalMl}ml / ${status.goalMl}ml (${status.percentage}%)
Faltam: ${status.remainingMl}ml (≈ ${(status.remainingMl / status.bottle.size).toFixed(1)} da sua garrafa)`;
            
            // Retoma lembretes com novo intervalo
            iniciarLembretesHidratacao(null, userId);
            
            return resposta;
        }
        
        // --- STATUS ---
        if (msg === 'status' || msg === 'como vai' || msg === 'status agua' || msg === 'progresso') {
            const status = bottle.getBottleStatus();
            return status.summary;
        }
        
        // --- RELATÓRIO ---
        if (msg === 'relatório' || msg === 'relatorio' || msg === 'report' || msg === 'relatório agua' || msg === 'relatorio agua') {
            return bottle.getBottleReport();
        }
        
        // --- AJUDA ---
        if (msg === 'ajuda' || msg === 'ajuda agua' || msg === 'comandos' || msg === 'help') {
            return `💧 *COMANDOS DE HIDRATAÇÃO*

📝 Registrar Consumo:
• "250ml" → registra 250ml
• "bebi 500" → registra 500ml
• "tomei 1L" → registra 1000ml
• "250" → registra 250ml (sem especificar ml)

🔄 Trocar de Garrafa:
• "troco 750" → trocou para garrafa de 750ml
• "nova garrafa 1000" → trocou para 1L
• "comprei 500ml" → trocou para 500ml

✏️ Renomear Garrafa:
• "nome Garrafa Térmica" → renomeia garrafa

📊 Informações:
• "status" → mostra progresso atual
• "relatório" → mostra análise detalhada
• "ajuda" → mostra estes comandos

💡 Exemplos:
  - "Bebi 250ml agora"
  - "Tomei um copo de suco (500ml)"
  - "Mudei para uma garrafa de 750ml"
  - "250" (simples, sem ml)`;
        }
        
        return null; // Não reconheceu comando
        
    } catch (error) {
        console.error('❌ Erro ao processar comando de hidratação:', error);
        return `❌ Erro ao processar: ${error.message}`;
    }
}

/**
 * Detecta menções naturais a consumo de água
 * Exemplos:
 * - "tomei água"
 * - "bebi um copo"
 * - "mudei de garrafa"
 * - "terminei a garrafa"
 */
async function detectAndProcessBottleIntent(message, userId) {
    const msg = message.toLowerCase();
    const bottle = getOrCreateBottleTracker(userId);
    
    // Detecta "terminei a garrafa" → registra tamanho da garrafa atual
    if (/termin|finish|empt|acabei|esgot/.test(msg) && /garrafa|garraf/.test(msg)) {
        const status = bottle.registerWater(bottle.bottle.size);
        return `🍾 Garrafa completa! +${bottle.bottle.size}ml registrado!

${status.bottle.visual}

Total: ${status.totalMl}ml / ${status.goalMl}ml (${status.percentage}%)
Faltam: ${status.remainingMl}ml`;
    }
    
    // Detecta mudança de garrafa ("tenho uma garrafa de 750ml" ou "comprei garrafa maior")
    const tamanoMatch = msg.match(/(?:garrafa|comprei|tenho|mudei|troquei|nova).*?(\d{2,4})\s*ml/);
    if (tamanoMatch) {
        const newSize = parseInt(tamanoMatch[1]);
        return handleBottleCommand(`troco ${newSize}`, userId);
    }
    
    // Detecta consumo natural sem número exato
    if (/bebi.*água|tomei.*água|hidrat/.test(msg)) {
        // Se mencionou "metade", "meia garrafa", "quase tudo" - estimativa
        if (/metade|meia|1\/2/.test(msg)) {
            const half = Math.round(bottle.bottle.size / 2);
            return handleBottleCommand(`${half}ml`, userId);
        }
        if (/quase|tudo|completa|cheia/.test(msg)) {
            return handleBottleCommand(`${bottle.bottle.size}ml`, userId);
        }
        if (/um pouco|pouco|gole|trago|pequenininho/.test(msg)) {
            const little = Math.round(bottle.bottle.size / 4);
            return handleBottleCommand(`${little}ml`, userId);
        }
        if (/bastante|muito|bem|boa quantidade/.test(msg)) {
            const lot = Math.round(bottle.bottle.size * 0.75);
            return handleBottleCommand(`${lot}ml`, userId);
        }
    }
    
    return null;
}

module.exports = {
    handleBottleCommand,
    detectAndProcessBottleIntent
};

module.exports = {
    handleBottleCommand,
    detectAndProcessBottleIntent
};
