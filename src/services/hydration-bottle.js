/**
 * Sistema de rastreamento por garrafa
 * Foca em "quantas garrafas bebi" em vez de ml específicos
 * Aprende tamanho da garrafa e facilita registro
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
        
        // Configuração de garrafa
        this.bottle = {
            size: 500, // ml (padrão)
            name: 'Minha Garrafa', // nome customizável
            refillsToday: 0, // quantas vezes terminou a garrafa
            currentRefill: 0, // consumo na garrafa atual (0-100%)
            lastRefillTime: new Date().toISOString(),
            history: [] // histórico de garrafas {'time': ISO, 'size': ml}
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
            const path = require('path');
            
            if (fs.existsSync(dataFile)) {
                const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
                if (data.bottle) {
                    this.bottle = { ...this.bottle, ...data.bottle };
                    
                    // Se mudou de dia, reseta contador
                    const lastRefillDate = new Date(this.bottle.lastRefillTime).toDateString();
                    if (lastRefillDate !== new Date().toDateString()) {
                        this.bottle.refillsToday = 0;
                        this.bottle.currentRefill = 0;
                    }
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
     * Registra que terminou a garrafa (bebeu tudo)
     * @param {number} sizeOverride - se quiser registrar tamanho diferente
     */
    finishBottle(sizeOverride = null) {
        const sizeRegistered = sizeOverride || this.bottle.size;
        
        // Registra no tracker principal
        this.mainTracker.logWater(sizeRegistered, 'bottle');
        
        // Atualiza contagem de garrafas
        this.bottle.refillsToday++;
        this.bottle.currentRefill = 0; // Reset da garrafa atual
        this.bottle.lastRefillTime = new Date().toISOString();
        
        // Adiciona ao histórico
        this.bottle.history.push({
            time: new Date().toISOString(),
            size: sizeRegistered
        });
        
        this.saveBottleConfig();
        
        console.log(`🍾 Garrafa completa! (+${sizeRegistered}ml) Total hoje: ${this.bottle.refillsToday} garrafas`);
        
        return this.getBottleStatus();
    }

    /**
     * Registra consumo parcial (quando não terminou a garrafa)
     * @param {number} percentage - quanto bebeu da garrafa (0-100)
     */
    sip(percentage = 50) {
        // Percentual válido?
        if (percentage < 0) percentage = 0;
        if (percentage > 100) percentage = 100;
        
        // Se foi além de 100%, conta como garrafa completa
        if (percentage >= 100) {
            return this.finishBottle();
        }
        
        // Apenas registra que está bebendo
        this.bottle.currentRefill = percentage;
        
        // Registra no tracker como fração
        const mlConsumido = Math.round((this.bottle.size * percentage) / 100);
        this.mainTracker.logWater(mlConsumido, 'bottle');
        
        this.saveBottleConfig();
        
        console.log(`💧 Bebida registrada: ${percentage}% da garrafa (${mlConsumido}ml)`);
        
        return this.getBottleStatus();
    }

    /**
     * Define novo tamanho de garrafa
     */
    setBottleSize(newSize) {
        if (newSize <= 0) {
            return { error: '❌ Tamanho inválido! Use um valor maior que 0.' };
        }
        
        const oldSize = this.bottle.size;
        this.bottle.size = newSize;
        this.bottle.currentRefill = 0; // Reset da garrafa atual
        this.saveBottleConfig();
        
        console.log(`✅ Tamanho da garrafa atualizado: ${oldSize}ml → ${newSize}ml`);
        
        return {
            success: true,
            message: `✅ Tamanho da garrafa atualizado para ${newSize}ml!`,
            oldSize,
            newSize
        };
    }

    /**
     * Define nome customizado da garrafa
     */
    setBottleName(name) {
        if (!name || name.trim().length === 0) {
            return { error: '❌ Nome inválido!' };
        }
        
        const oldName = this.bottle.name;
        this.bottle.name = name.trim();
        this.saveBottleConfig();
        
        console.log(`✅ Nome da garrafa: ${oldName} → ${this.bottle.name}`);
        
        return {
            success: true,
            message: `✅ Garrafa renomeada para "${this.bottle.name}"!`,
            oldName,
            newName: name
        };
    }

    /**
     * Retorna status atual da garrafa
     */
    getBottleStatus() {
        const mainStatus = this.mainTracker.getStatus();
        
        // Quantas garrafas completas = quantas vezes atingiu bottle.size
        const bottlesComplete = this.bottle.refillsToday;
        const garrafasEquivalentes = mainStatus.totalToday / this.bottle.size;
        
        // Progresso visual com garrafas
        const fullBottles = Math.floor(garrafasEquivalentes);
        const partialBottle = (garrafasEquivalentes - fullBottles) * 100;
        
        // Barra visual
        let barraGarrafas = '';
        for (let i = 0; i < fullBottles; i++) {
            barraGarrafas += '🍾'; // garrafa cheia
        }
        if (partialBottle > 0) {
            if (partialBottle >= 75) barraGarrafas += '🥃'; // quase cheia
            else if (partialBottle >= 50) barraGarrafas += '🥤'; // meio cheia
            else if (partialBottle >= 25) barraGarrafas += '💧'; // pouca
        }
        
        return {
            // Dados da garrafa
            bottle: {
                name: this.bottle.name,
                size: this.bottle.size,
                refillsToday: bottlesComplete,
                currentPercentage: this.bottle.currentRefill,
                visual: barraGarrafas || '(vazia)',
            },
            // Dados do rastreador principal
            hydration: mainStatus,
            
            // Mensagem combinada
            summary: `🍾 *${this.bottle.name}* | ${bottlesComplete} garrafa${bottlesComplete !== 1 ? 's' : ''} completa${bottlesComplete !== 1 ? 's' : ''} (${mainStatus.totalToday}ml)
            
${barraGarrafas || '(vazia)'}

Meta: ${mainStatus.totalToday}/${mainStatus.dailyGoal}ml (${mainStatus.percentage}%)
Faltam: ${mainStatus.remaining}ml`,
            
            // Dados brutos
            totalMl: mainStatus.totalToday,
            goalMl: mainStatus.dailyGoal,
            remainingMl: mainStatus.remaining,
            percentage: mainStatus.percentage
        };
    }

    /**
     * Gera relatório de garrafas
     */
    getBottleReport() {
        const status = this.getBottleStatus();
        
        // Análise de garrafas por dia (do histórico)
        const avgBottlesPerDay = this.bottle.history.length > 0 
            ? (this.bottle.history.length / 1).toFixed(1) // aproximado
            : 'N/A';
        
        // Tamanho mais comum registrado
        const sizeMostCommon = this.bottle.history.length > 0
            ? this.bottle.size
            : 'N/A';
        
        const report = `
📊 *RELATÓRIO DE GARRAFAS*

🍾 ${this.bottle.name}
📏 Tamanho: ${this.bottle.size}ml
🔄 Refills Hoje: ${this.bottle.refillsToday}

${status.bottle.visual}

Total: ${status.totalMl}ml / ${status.goalMl}ml (${status.percentage}%)
Faltam: ${status.remainingMl}ml

💡 Tamanho médio: ${sizeMostCommon}ml
💡 Garrafas/dia: ${avgBottlesPerDay}
`;
        
        return report;
    }

    /**
     * Próximo lembrete adaptado para garrafas
     */
    getNextBottleReminder() {
        const mainReminder = this.mainTracker.calcularProximoLembrete();
        const minutesToNext = typeof mainReminder === 'object' 
            ? mainReminder.minutes 
            : mainReminder;
        
        // Mensagens em contexto de garrafa
        const messages = [
            `🍾 Tempo de beber da sua ${this.bottle.name}!`,
            `💧 Terminada sua ${this.bottle.name}? Diga "garrafa cheia"!`,
            `🚰 Beba mais da ${this.bottle.name}! Faltam ${Math.round(this.getBottleStatus().remainingMl / this.bottle.size)} garrafas.`,
            `⏰ Hora de hidratar! Quantos % da garrafa você bebeu?`,
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        return {
            message,
            minutesToNext,
            bottles: this.bottle.refillsToday,
            size: this.bottle.size
        };
    }

    /**
     * Reset para novo dia
     */
    resetDay() {
        this.bottle.refillsToday = 0;
        this.bottle.currentRefill = 0;
        this.bottle.lastRefillTime = new Date().toISOString();
        this.saveBottleConfig();
    }
}

module.exports = {
    getOrCreateBottleTracker,
    BottleTracker
};
