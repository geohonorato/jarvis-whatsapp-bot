# 🕐 Exemplos de Timeline de Lembretes

## Dia Típico de Hidratação

```
08:00 - User diz: "Vou beber água agora"
        Bot registra: +250ml
        Análise: Início do dia, sem padrões ainda
        ⏰ PRÓXIMO LEMBRETE: 09:00 (intervalo padrão: 60min)

09:00 - 💧 Lembrete chegou
        Status: 250ml / 3000ml (8%)
        Mensagem: "Beba água! Você consumiu 250ml. Objetivo: 3000ml. Faltam 2750ml."
        ⏰ PRÓXIMO: 10:00 (ritmo normal)

10:00 - User não respondeu, nova tentativa
        Status: 250ml / 3000ml (8%)
        Mensagem: "💪 Mantenha a hidratação! 1 gole até agora. Faltam 2750ml para a meta."
        ⏰ PRÓXIMO: 10:45 (acelerado para 45min - MUITO atrasado!)

10:45 - User diz: "Tomei um copo de água"
        Bot registra: +200ml
        Total agora: 450ml (15%)
        Status: Ainda atrasado
        ⏰ PRÓXIMO: 11:15 (15min - CRÍTICO!)

11:15 - 🔴 Lembrete urgente
        Status: 450ml / 3000ml (15%)
        Mensagem: "🔴 Crítico! Beba água agora!"
        ⏰ PRÓXIMO: 11:45 (15min - mantém urgência)

11:45 - User diz: "Vou beber um suco"
        Bot registra: +400ml
        Total agora: 850ml (28%)
        Status: Melhorando, mas ainda atrasado
        ⏰ PRÓXIMO: 12:30 (45min - ritmo acelerado mas melhorando)

12:30 - 🟠 Lembrete moderado
        Status: 850ml / 3000ml (28%)
        Mensagem: "🟠 Atrasado. Aumente a ingestão"
        [Dados mostram: 12:00-14:00 é hora de pico]
        ⏰ PRÓXIMO: 13:00 (30min - próxima é hora de pico!)

13:00 - User diz: "Almoçando agora"
        Bot reconhece contexto e emite: /agua 500
        Bot registra: +500ml
        Total agora: 1350ml (45%)
        Status: Ainda precisa, mas melhorando
        ⏰ PRÓXIMO: 13:45 (45min - pico identificado)

13:45 - 🟡 Lembrete normal
        Status: 1350ml / 3000ml (45%)
        Mensagem: "⏰ Hora de beber! Status: 45%. Ingestão: 1350ml/3000ml"
        ⏰ PRÓXIMO: 14:30 (mantém intervalo, ainda em pico)

14:30 - User diz: "Bebi mais um copo"
        Bot registra: +250ml
        Total agora: 1600ml (53%)
        Status: Ultrapassou 50%! Melhorando muito
        ⏰ PRÓXIMO: 15:30 (intervalo volta para 60min - normal!)

15:30 - 🟡 Lembrete padrão
        Status: 1600ml / 3000ml (53%)
        Mensagem: "💧 Hidratação: 53% da meta (1600ml/3000ml). Faltam 1400ml!"
        ⏰ PRÓXIMO: 16:30 (intervalo normal: 60min)

16:30 - ⏰ Lembrete padrão
        Status: 1600ml / 3000ml (53%)
        User não respondeu, mantém frequência
        ⏰ PRÓXIMO: 17:30

17:30 - 🟡 Lembrete padrão
        Status: 1600ml / 3000ml (53%)
        ⏰ PRÓXIMO: 18:30

18:30 - User diz: "Vou beber água"
        Bot registra: +300ml
        Total agora: 1900ml (63%)
        Status: 63% - quase lá!
        ⏰ PRÓXIMO: 19:30 (intervalo normal)

19:30 - 🟢 Lembrete de progresso
        Status: 1900ml / 3000ml (63%)
        Mensagem: "🟢 No caminho certo. Continue!"
        ⏰ PRÓXIMO: 20:30

20:30 - User diz: "Tomei suco e água"
        Bot registra: +500ml
        Total agora: 2400ml (80%)
        Status: 80% - quase na meta!
        ⏰ PRÓXIMO: 21:30

21:30 - 🟢 Lembrete final
        Status: 2400ml / 3000ml (80%)
        Mensagem: "🟢 Quase lá! Mais um pouco!"
        ⏰ PRÓXIMO: 22:30

22:30 - User diz: "Uma última água antes de dormir"
        Bot registra: +600ml
        Total agora: 3000ml (100%)
        ✅ META ATINGIDA!
        
        Mensagem: "✅ Meta atingida! Excelente!"
        ⏰ PRÓXIMO: NENHUM (pausado até amanhã)
```

---

## Padrão Aprendido Após 1 Semana

Depois que o bot aprende seus hábitos:

```
PADRÃO DETECTADO:
├─ Consumo alto: 12:00-14:00 (almoço) → 60%
├─ Consumo alto: 19:00-20:00 (após trabalho) → 40%
├─ Consumo baixo: 06:00-09:00 (manhã cedo) → 5%
└─ Consumo baixo: 22:00-23:59 (noite) → 0%

NOVO CRONOGRAMA INTELIGENTE:
08:00 ⏰ (60min) - Manhã, sem pico
09:00 ⏰ (60min)
10:00 ⏰ (60min)
11:00 ⏰ (45min) - Se atrasado, reduz antes do pico do almoço
12:00 ⏰ (30min) - PICO IDENTIFICADO - aumenta frequência
13:00 ⏰ (30min)
14:00 ⏰ (45min)
15:00 ⏰ (60min) - Volta ao normal pós-pico
...
18:00 ⏰ (45min) - Se atrasado, prepara para próximo pico
19:00 ⏰ (30min) - PICO IDENTIFICADO
20:00 ⏰ (30min)
21:00 ⏰ (60min) - Volta ao normal
22:00+ ⏰ PAUSADO (seu padrão mostra: sem consumo)
```

---

## Se Estiver Crítico

```
14:30 - User registrou apenas 500ml até agora (17%)
        Bot detecta: DEFICIT CRÍTICO

Sequência de lembrete INTENSIFICADO:
14:30 🔴 "Crítico! Beba água agora!"
14:45 🔴 Lembrete (15min depois)
15:00 🔴 Lembrete (15min depois)
15:15 🔴 Lembrete (15min depois)
→ Continua a cada 15min até melhorar
```

---

## Se Pausar e Retomar

```
14:00 - User: "/pausar"
        Bot: "⏸️ Lembretes pausados. Diga '/retomar' para ativar."
        Lembretes PARAM IMEDIATAMENTE

16:00 - User: "/retomar"
        Bot: "▶️ Lembretes retomados!"
        Cálculo RECOMEÇA
        ⏰ Próximo: 17:00 (60min, intervalo fresh)
```

---

## Resumo: Intervalos Adaptativos

| Situação | Intervalo | Frequência |
|----------|-----------|-----------|
| Crítico (< 20%) | 15 min | Very High |
| Atrasado (20-50%) | 30-45 min | High |
| Normal (50-80%) | 60 min | Standard |
| Próximo Pico | -20% | Increased |
| Meta Atingida | PARADO | None |

💡 **O bot aprende e se adapta a cada dia!** Quanto mais você interage, mais personalizados ficam os lembretes.
