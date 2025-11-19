/**
 * Sistema inteligente de rastreamento de hidratação
 * Aprende padrões de consumo, adapta-se aos horários e fornece lembretes personalizados
 */

const fs = require('fs');
const path = require('path');

class HydrationTracker {
    constructor(userId = 'default') {
        this.userId = userId;
        this.dataDir = path.join(__dirname, '../../temp', 'hydration-data');
        this.dataFile = path.join(this.dataDir, `${userId}-hydration.json`);
        this.configFile = path.join(this.dataDir, `${userId}-hydration-config.json`);
        
        // Criar diretório se não existir
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        // Configuração padrão
        this.config = {
            dailyGoal: 2000, // ml por dia
            minIntake: 200, // ml mínimo por lembretes
            maxIntake: 500, // ml máximo por lembrete
            reminderInterval: 60, // minutos entre lembretes base
            adaptiveMode: true, // aprende e se adapta
            timezone: 'America/Sao_Paulo',
            active: true
        };

        // Dados de hidratação
        this.data = {
            today: new Date().toISOString().split('T')[0],
            intake: [], // { time: ISO, amount: ml, source: 'app|reminder|manual' }
            reminders: [], // histórico de lembretes
            patterns: {
                hourlyConsumption: {}, // média por hora
                peakHours: [], // horas de maior consumo
                responsiveness: {}, // quanto tempo depois do lembrete consome
                weekdayPattern: {}, // padrão por dia da semana
            }
        };

        this.loadData();
    }

    /**
     * Carrega dados persistidos
     */
    loadData() {
        try {
            if (fs.existsSync(this.configFile)) {
                const savedConfig = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                this.config = { ...this.config, ...savedConfig };
            }

            if (fs.existsSync(this.dataFile)) {
                const savedData = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                
                // Se é um novo dia, arquiva dados antigos
                if (savedData.today !== this.data.today) {
                    this.archiveYesterdayData(savedData);
                    this.data.intake = [];
                    this.data.reminders = [];
                } else {
                    this.data = savedData;
                }
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados de hidratação:', error.message);
        }
    }

    /**
     * Salva dados em arquivo
     */
    saveData() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('❌ Erro ao salvar dados de hidratação:', error.message);
        }
    }

    /**
     * Arquiva dados de ontem para análise de padrões
     */
    archiveYesterdayData(yesterdayData) {
        try {
            const archiveDir = path.join(this.dataDir, 'archive');
            if (!fs.existsSync(archiveDir)) {
                fs.mkdirSync(archiveDir, { recursive: true });
            }

            const archiveFile = path.join(archiveDir, `${this.userId}-${yesterdayData.today}.json`);
            fs.writeFileSync(archiveFile, JSON.stringify(yesterdayData, null, 2));

            // Atualizar padrões com dados do dia anterior
            this.updatePatterns(yesterdayData);
        } catch (error) {
            console.error('❌ Erro ao arquivar dados:', error.message);
        }
    }

    /**
     * Atualiza padrões de consumo baseado em histórico
     */
    updatePatterns(dayData) {
        const dayOfWeek = new Date(dayData.today).toLocaleDateString('pt-BR', { weekday: 'long' });
        
        // Análise por hora
        const hourlyMap = {};
        dayData.intake.forEach(({ time, amount }) => {
            const hour = new Date(time).getHours();
            if (!hourlyMap[hour]) hourlyMap[hour] = [];
            hourlyMap[hour].push(amount);
        });

        // Atualizar consumo médio por hora (média móvel)
        Object.entries(hourlyMap).forEach(([hour, amounts]) => {
            const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
            if (!this.data.patterns.hourlyConsumption[hour]) {
                this.data.patterns.hourlyConsumption[hour] = avg;
            } else {
                // Média móvel ponderada (70% anterior, 30% novo)
                this.data.patterns.hourlyConsumption[hour] = 
                    this.data.patterns.hourlyConsumption[hour] * 0.7 + avg * 0.3;
            }
        });

        // Identificar horas de pico (consumo > 50% da meta)
        this.data.patterns.peakHours = Object.entries(this.data.patterns.hourlyConsumption)
            .filter(([_, consumption]) => consumption > this.config.dailyGoal * 0.5 / 24)
            .map(([hour, _]) => parseInt(hour))
            .sort((a, b) => a - b);

        // Padrão por dia da semana
        if (!this.data.patterns.weekdayPattern[dayOfWeek]) {
            this.data.patterns.weekdayPattern[dayOfWeek] = {
                totalIntake: dayData.intake.reduce((sum, i) => sum + i.amount, 0),
                count: 1
            };
        } else {
            this.data.patterns.weekdayPattern[dayOfWeek].totalIntake += 
                dayData.intake.reduce((sum, i) => sum + i.amount, 0);
            this.data.patterns.weekdayPattern[dayOfWeek].count++;
        }
    }

    /**
     * Registra consumo de água
     */
    logWater(amount = 250, source = 'manual') {
        const now = new Date();
        
        this.data.intake.push({
            time: now.toISOString(),
            amount: Math.min(amount, this.config.maxIntake),
            source
        });

        this.saveData();
        
        console.log(`💧 Água registrada: ${amount}ml`);
        return this.getStatus();
    }

    /**
     * Obtém status atual do dia
     */
    getStatus() {
        const totalToday = this.data.intake.reduce((sum, i) => sum + i.amount, 0);
        const remaining = Math.max(0, this.config.dailyGoal - totalToday);
        const percentage = Math.min(100, Math.round((totalToday / this.config.dailyGoal) * 100));

        return {
            totalToday,
            dailyGoal: this.config.dailyGoal,
            remaining,
            percentage,
            intakeCount: this.data.intake.length,
            goalMet: totalToday >= this.config.dailyGoal,
            status: this.getStatusMessage(percentage)
        };
    }

    /**
     * Mensagem de status personalizada
     */
    getStatusMessage(percentage) {
        if (percentage < 20) return '🔴 Crítico! Beba água agora!';
        if (percentage < 50) return '🟠 Atrasado. Aumente a ingestão';
        if (percentage < 80) return '🟡 No caminho certo. Continue!';
        if (percentage < 100) return '🟢 Quase lá! Mais um pouco!';
        return '✅ Meta atingida! Excelente!';
    }

    /**
     * Calcula próximo lembretes adaptativo baseado em padrões
     */
    calcularProximoLembrete() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentMinuteOfDay = currentHour * 60 + currentMinute;

        // Se há dados de consumo, usar análise inteligente
        if (Object.keys(this.data.patterns.hourlyConsumption).length > 0) {
            return this.calcularLembreteInteligente(currentHour, currentMinute);
        }

        // Fallback: lembretes a cada N minutos
        return this.config.reminderInterval;
    }

    /**
     * Algoritmo inteligente para calcular intervalo de lembretes
     */
    calcularLembreteInteligente(currentHour, currentMinute) {
        const status = this.getStatus();

        // Se meta foi atingida, não lembrar mais hoje
        if (status.goalMet) {
            return { minutes: 0, reason: 'Meta atingida' };
        }

        // Calcular déficit horário esperado
        const hoursLeft = 24 - currentHour;
        const consumoEsperado = this.data.patterns.hourlyConsumption[currentHour] || 
                                (this.config.dailyGoal / 24);
        const neededPerHour = status.remaining / hoursLeft;

        // Se está atrás, aumentar frequência
        if (neededPerHour > consumoEsperado * 1.5) {
            return {
                minutes: Math.max(15, this.config.reminderInterval * 0.5),
                reason: 'Ritmo acelerado'
            };
        }

        // Se próxima hora é hora de pico, reduzir intervalo
        const nextHour = (currentHour + 1) % 24;
        if (this.data.patterns.peakHours.includes(nextHour)) {
            return {
                minutes: this.config.reminderInterval * 0.8,
                reason: 'Próxima hora é pico de consumo'
            };
        }

        // Normal
        return {
            minutes: this.config.reminderInterval,
            reason: 'Ritmo normal'
        };
    }

    /**
     * Gera lembretes contextualizados
     */
    gerarLembrete() {
        const status = this.getStatus();
        const proximoLembrete = this.calcularProximoLembrete();

        const mensagens = [
            `💧 Hidratação: ${status.percentage}% da meta (${status.totalToday}ml/${status.dailyGoal}ml). Faltam ${status.remaining}ml!`,
            `🚰 Beba água! Você consumiu ${status.totalToday}ml. Objetivo: ${status.dailyGoal}ml. Faltam ${status.remaining}ml.`,
            `⏰ Hora de beber! Status: ${status.percentage}%. Ingestão de hoje: ${status.totalToday}ml/${status.dailyGoal}ml`,
            `💪 Mantenha a hidratação! ${status.intakeCount} goles até agora. Faltam ${status.remaining}ml para a meta.`,
        ];

        const mensagem = mensagens[Math.floor(Math.random() * mensagens.length)];

        this.data.reminders.push({
            time: new Date().toISOString(),
            message: mensagem,
            nextReminderIn: proximoLembrete
        });

        this.saveData();

        return {
            message: mensagem,
            status,
            proximoLembreteEm: proximoLembrete,
            razao: proximoLembrete.reason || 'Intervalo padrão'
        };
    }

    /**
     * Relatório semanal de padrões
     */
    gerarRelatorio() {
        const relatorio = {
            consumoMedioHorario: this.data.patterns.hourlyConsumption,
            horasDePico: this.data.patterns.peakHours,
            padroesPorDia: this.data.patterns.weekdayPattern,
            statusHoje: this.getStatus(),
            recomendacoes: this.gerarRecomendacoes()
        };

        return relatorio;
    }

    /**
     * Gera recomendações baseadas em padrões
     */
    gerarRecomendacoes() {
        const recomendacoes = [];
        const horasAltasConsumo = this.data.patterns.peakHours;
        const horassPoucaIntake = Object.entries(this.data.patterns.hourlyConsumption)
            .filter(([_, consumption]) => consumption < this.config.dailyGoal / 48)
            .map(([hour, _]) => parseInt(hour));

        if (horasAltasConsumo.length > 0) {
            recomendacoes.push(
                `📊 Você tende a beber mais entre ${horasAltasConsumo[0]}h-${horasAltasConsumo[horasAltasConsumo.length - 1]}h. Aproveite esses horários!`
            );
        }

        if (horassPoucaIntake.length > 0) {
            recomendacoes.push(
                `⚠️ Pouco consumo entre ${horassPoucaIntake[0]}h-${horassPoucaIntake[horassPoucaIntake.length - 1]}h. Defina lembretes extras!`
            );
        }

        const status = this.getStatus();
        if (status.percentage < 50) {
            recomendacoes.push('🚨 Acelerem o ritmo! Você está atrasado na hidratação.');
        }

        return recomendacoes;
    }

    /**
     * Atualizar configurações
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.saveData();
        console.log('✅ Configuração de hidratação atualizada');
    }
}

module.exports = HydrationTracker;
