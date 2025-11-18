/**
 * Sistema de rastreamento de consumo de água em ML
 * Aceita diferentes garrafas com diferentes tamanhos
 * User fornece quantidade em ml direto
 * Apenas referência visual da garrafa atual (não afeta cálculo)
 */

const HydrationTracker = require('./hydration-tracker');

// Cache de garrafas por usuário
const bottleTrackers = {};

/**
 * Obtém ou cria tracker de garrafa para um usuário
 */
function getOrCreateBottleTracker(userId) {
    if (!bottleTrackers[userId]) {
        bottleTrackers[userId] = new BottleTracker(userId);
    }
    return bottleTrackers[userId];
}

class BottleTracker {
    constructor(userId = 'default') {
        this.userId = userId;
        this.mainTracker = new HydrationTracker(userId);
        
        // Configuração de garrafa (apenas referência, não afeta cálculo)
        this.bottle = {
            size: 500, // ml (apenas informativa)
            name: 'Garrafa 1', // nome customizável
            lastChangeTime: new Date().toISOString(),
            history: [] // histórico de mudanças de garrafas {'time': ISO, 'size': ml, 'name': str}
        };

        this.loadBottleConfig();
    }

    /**
     * Carrega configuração da garrafa do storage do HydrationTracker
     */
    loadBottleConfig() {
        try {
            const dataFile = this.mainTracker.dataFile;
            const fs = require('fs');
            
            if (fs.existsSync(dataFile)) {
                const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
                if (data.bottle) {
                    this.bottle = { ...this.bottle, ...data.bottle };
                }
            }
            this.saveBottleConfig();
        } catch (error) {
            console.error('❌ Erro ao carregar config de garrafa:', error.message);
        }
    }

    /**
     * Salva configuração de garrafa
     */
    saveBottleConfig() {
        try {
            const fs = require('fs');
            const data = require('fs').readFileSync(this.mainTracker.dataFile, 'utf8');
            const jsonData = JSON.parse(data);
            
            jsonData.bottle = this.bottle;
            
            require('fs').writeFileSync(
                this.mainTracker.dataFile,
                JSON.stringify(jsonData, null, 2)
            );
        } catch (error) {
            console.error('❌ Erro ao salvar config de garrafa:', error.message);
        }
    }

    /**
     * Registra consumo direto em ml
     * @param {number} ml - quantidade em ml
     */
    registerWater(ml) {
        if (ml <= 0) {
            return { error: '❌ Quantidade inválida! Use um valor maior que 0.' };
        }
        
        // Registra no tracker principal
        this.mainTracker.logWater(ml, 'bottle');
        
        console.log(`💧 Consumo registrado: ${ml}ml`);
        
        return this.getBottleStatus();
    }

    /**
     * Troca para nova garrafa com novo tamanho
     */
    changeBottle(newSize, newName = null) {
        if (newSize <= 0) {
            return { error: '❌ Tamanho inválido! Use um valor maior que 0.' };
        }
        
        const oldSize = this.bottle.size;
        const oldName = this.bottle.name;
        
        this.bottle.size = newSize;
        this.bottle.name = newName || `Garrafa ${this.bottle.history.length + 1}`;
        this.bottle.lastChangeTime = new Date().toISOString();
        
        // Adiciona ao histórico
        this.bottle.history.push({
            time: this.bottle.lastChangeTime,
            size: newSize,
            name: this.bottle.name
        });
        
        this.saveBottleConfig();
        
        console.log(`✅ Garrafa trocada: ${oldSize}ml → ${newSize}ml (${oldName} → ${this.bottle.name})`);
        
        return {
            success: true,
            message: `✅ Garrafa atualizada para ${newSize}ml!`,
            oldSize,
            newSize,
            newName: this.bottle.name
        };
    }

    /**
     * Define nome customizado da garrafa atual
     */
    setBottleName(name) {
        if (!name || name.trim().length === 0) {
            return { error: '❌ Nome inválido!' };
        }
        
        const oldName = this.bottle.name;
        this.bottle.name = name.trim();
        this.saveBottleConfig();
        
        console.log(`✅ Garrafa renomeada: ${oldName} → ${this.bottle.name}`);
        
        return {
            success: true,
            message: `✅ Garrafa renomeada para "${this.bottle.name}"!`,
            newName: name
        };
    }

    /**
     * Retorna status atual de hidratação
     */
    getBottleStatus() {
        const mainStatus = this.mainTracker.getStatus();
        
        // Quantas garrafas do tamanho atual foram consumidas (aproximado)
        const bottlesEquivalent = mainStatus.totalToday / this.bottle.size;
        const fullBottles = Math.floor(bottlesEquivalent);
        const partialBottle = (bottlesEquivalent - fullBottles) * 100;
        
        // Barra visual de progresso
        let barraProgresso = '';
        for (let i = 0; i < Math.min(fullBottles, 10); i++) {
            barraProgresso += '🍾'; // garrafas cheias
        }
        if (fullBottles > 10) {
            barraProgresso += `...+${fullBottles - 10}`;
        }
        if (partialBottle > 0 && fullBottles < 10) {
            if (partialBottle >= 75) barraProgresso += '🥃'; // quase cheia
            else if (partialBottle >= 50) barraProgresso += '🥤'; // meio cheia
            else if (partialBottle >= 25) barraProgresso += '💧'; // pouca
        }
        
        return {
            // Dados de contexto da garrafa
            bottle: {
                name: this.bottle.name,
                size: this.bottle.size,
                equivalentBottles: bottlesEquivalent.toFixed(1),
                visual: barraProgresso || '(vazio)',
            },
            // Dados do rastreador principal
            hydration: mainStatus,
            
            // Mensagem combinada
            summary: `💧 *${this.bottle.name}* (${this.bottle.size}ml)
            
${barraProgresso || '(vazio)'}

Total: ${mainStatus.totalToday}ml / ${mainStatus.dailyGoal}ml (${mainStatus.percentage}%)
Faltam: ${mainStatus.remaining}ml
≈ ${(mainStatus.remaining / this.bottle.size).toFixed(1)} garrafas`,
            
            // Dados brutos
            totalMl: mainStatus.totalToday,
            goalMl: mainStatus.dailyGoal,
            remainingMl: mainStatus.remaining,
            percentage: mainStatus.percentage
        };
    }

    /**
     * Gera relatório detalhado
     */
    getBottleReport() {
        const status = this.getBottleStatus();
        
        const historyStr = this.bottle.history.length > 0
            ? this.bottle.history.map((h, i) => 
                `${i + 1}. ${h.name} - ${h.size}ml (${new Date(h.time).toLocaleTimeString('pt-BR')})`
            ).join('\n')
            : 'Nenhuma mudança registrada';
        
        const report = `
📊 *RELATÓRIO DE HIDRATAÇÃO*

💧 Garrafa Atual: ${this.bottle.name} (${this.bottle.size}ml)

${status.bottle.visual}

Total: ${status.totalMl}ml / ${status.goalMl}ml (${status.percentage}%)
Faltam: ${status.remainingMl}ml (≈ ${(status.remainingMl / this.bottle.size).toFixed(1)} garrafas)

📋 Histórico de Garrafas:
${historyStr}
`;
        
        return report;
    }

    /**
     * Próximo lembrete adaptado
     */
    getNextBottleReminder() {
        const mainReminder = this.mainTracker.calcularProximoLembrete();
        const minutesToNext = typeof mainReminder === 'object' 
            ? mainReminder.minutes 
            : mainReminder;
        
        const status = this.getBottleStatus();
        
        // Mensagens em contexto de ml
        const messages = [
            `💧 Hora de beber! Quanto você quer registrar? (ex: "250ml", "500ml")`,
            `🚰 Beba água! Faltam ${status.remainingMl}ml para a meta.`,
            `⏰ Tempo de hidratar! Quantos ml você bebeu?`,
            `🍾 Bora manter a hidratação? Registre seu consumo em ml!`,
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        return {
            message,
            minutesToNext,
            size: this.bottle.size
        };
    }
}

module.exports = {
    getOrCreateBottleTracker,
    BottleTracker
};
