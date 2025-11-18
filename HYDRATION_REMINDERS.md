# 💧 Sistema de Lembretes Automáticos de Hidratação

## Como Funciona

O bot enviará lembretes automáticos de hidratação em intervalos **adaptativos** baseados no seu padrão de consumo. Quanto mais você interage com o sistema, mais inteligentes ficam os lembretes.

### Quando começa?
Os lembretes começam automaticamente quando você:
- Envia um comando de hidratação (`/agua 250`, `/beber`, etc)
- Relata consumo de água de forma natural ("Bebi água agora", "Tomei um suco", etc)
- O bot reconhece a intenção via IA e emite um comando automático

### Algoritmo Adaptativo

O intervalo dos lembretes é calculado dinamicamente considerando:

1. **Déficit de consumo**: Se está atrasado vs. meta, aumenta frequência (até 15min)
2. **Horas de pico**: Próximas horas onde você costuma beber mais → reduz intervalo 20%
3. **Ritmo normal**: Se está no caminho, mantém intervalo padrão (60min)
4. **Meta atingida**: Para de lembrar assim que atinge 3000ml (padrão)

### Exemplos

```
9h da manhã - Você diz: "Vou beber água agora"
Bot: "Ótimo! ✅ Mantendo padrão..."
⏰ Próximo lembrete: 10h (intervalo normal)

Seu padrão mostra: pico de consumo 12h-14h (almoço)
10h30 - Você registrou 500ml
Bot: "💧 60% da meta! Próximo lembrete em 48min"
⏰ Próximo lembrete: 11h18 (reduzido antes do pico)

16h - Você não bebeu desde o almoço, está com 60% apenas
Bot percebe: "🔴 Você está MUITO atrasado!"
⏰ Próximo lembrete: 16h15 (acelerado para 15min!)
```

## Comandos de Gerenciamento

### Pausar Lembretes
```
/pausar
/pausar lembretes
/parar lembretes
/desativar lembretes
```

### Retomar Lembretes
```
/retomar
/retomar lembretes
/reativar lembretes
/ativar lembretes
```

### Ver Próximo Lembrete
```
/status
/status lembretes
/quando
/próximo
```

## Detalhes Técnicos

- **Intervalo Base**: 60 minutos (configurável)
- **Intervalo Mínimo**: 15 minutos (em deficit crítico)
- **Intervalo Máximo**: 120 minutos (em padrão e on-track)
- **Meta Diária**: 3000ml (ajustável)
- **Persistência**: Dados salvos em JSON local
- **Aprendizado**: Padrões analisados por hora e dia da semana

## Fluxo de Lembretes

```
[Início] User interage com hidratação
   ↓
[Análise] Bot verifica status e padrões
   ↓
[Cálculo] Determina intervalo adaptativo
   ↓
[Agendamento] SetTimeout para próximo lembrete
   ↓
[Envio] Bot envia lembrete contextualizado
   ↓
[Loop] Retorna ao Cálculo
   ↓
[Parada] User atinge meta OU pausa manualmente
```

## O que o Bot Envia em Cada Lembrete

Cada lembrete inclui:
- ✅ **Status visual**: 🔴🟠🟡🟢 baseado no progresso
- 📊 **Progresso**: Percentual + ml consumido/meta
- 💬 **Mensagem motivacional**: Variada e contextualizada
- ⏰ **Próximo lembrete**: Quando vai chegar o próximo

**Exemplo**:
```
🟡 Lembrete de Hidratação

⏰ Você tende a beber mais 9h-15h, leverage que!
💪 Mantenha a hidratação! 3 goles até agora. Faltam 2.250ml para a meta.

_Responda naturalmente, ex: "Bebi água agora", "Tomei um copo de suco", etc_
```

## Modificar Configurações

Para ajustar meta, intervalo ou limites, use:
```
/config hidratação goal:4000 interval:45
```

(Função a implementar conforme necessário)

---

**Status**: Ativo e Adaptando
💧 O sistema aprende com você a cada interação!
