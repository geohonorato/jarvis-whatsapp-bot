# 🕐 QUANDO O BOT VAI LEMBRAR - GUIA RÁPIDO

## TL;DR - Resposta Rápida

O bot **nunca te esquece de beber água**. Ele envia lembretes em intervalos que mudam dinamicamente:

- **Crítico** (você tá muito atrasado): A cada **15 minutos** 🔴
- **Atrasado** (mas melhorando): A cada **30-45 minutos** 🟠  
- **No caminho** (tudo ok): A cada **60 minutos** 🟡
- **Perto da meta**: A cada **60 minutos** 🟢
- **Meta atingida**: **Nenhum lembrete** ✅

---

## 🚀 COMO ATIVA?

Você interagiu uma vez sobre hidratação (ou IA reconheceu que você quer beber água):

```
15h30 - User: "Tomei um copo de água"
        ↓
        [Bot Ativa Sistema]
        ↓
        ⏰ Próximo lembrete: 16h30
```

---

## 📊 EXEMPLO PRÁTICO

Seu dia começa:

```
9h00  → User registra 250ml
        ✅ Status: 8% da meta
        ⏰ Próximo lembrete: 10h00 (60min)

10h00 → 💧 Bot: "Beba água! Faltam 2.750ml..."
        (User não respondeu)
        ⏰ Próximo lembrete: 11h00 (60min)

11h00 → User responde: "Bebi!"
        ✅ Status: 15% da meta
        ⏰ Próximo: 12h00 (se normal) OU 11h30 (se muito atrasado)

12h00 → Sua hora de pico? Bot já sabe!
        (Reduz intervalo para 30min antes)
        ⏰ Próximo: 12h30

...continua adaptando...

20h00 → User finalmente bebe bastante
        ✅ Status: 85% da meta
        ⏰ Próximo: 21h00

21h00 → User: "Uma última água"
        ✅✅✅ META ATINGIDA (100%)
        
        🎉 Bot: "Meta atingida! Excelente!"
        ⏰ Próximo: NENHUM (parado)
```

---

## 🧠 O ALGORITMO INTELIGENTE

```
┌─────────────────────┐
│ Recebe seu consumo  │
└──────────┬──────────┘
           ↓
    ┌──────────────────────────────┐
    │ Analisa padrões:             │
    │ • Hora do dia                │
    │ • Quanto falta pra meta      │
    │ • Suas horas de pico         │
    │ • Seu histórico              │
    └──────────┬───────────────────┘
               ↓
    ┌──────────────────────────────┐
    │ CALCULA PRÓXIMO LEMBRETE:    │
    ├──────────────────────────────┤
    │ Se < 20% → 15 min (🔴 CRIT) │
    │ Se 20-50% → 30 min (🟠 ATR) │
    │ Se > 50% → 60 min (🟡 OK)   │
    │ Pico próximo? → -20% tempo  │
    │ Meta? → PARA               │
    └──────────┬───────────────────┘
               ↓
    ┌──────────────────────────────┐
    │ AGENDA PRÓXIMO LEMBRETE     │
    │ com o intervalo calculado   │
    └──────────────────────────────┘
```

---

## 💬 COMANDOS PARA CONTROLAR

```
/agua 250        → Registra 250ml
/beber           → Idem acima
/status          → Ver próximo lembrete
/pausar          → Pausa lembretes
/retomar         → Retoma lembretes
```

---

## 🎯 DEPOIS DE 1 SEMANA

O bot **aprende seus hábitos**:

```
SEGUNDA - SEXTA (trabalho):
  9h   → 12h: Pouco consumo
  12h  → 14h: PICO (almoço) ⬆️
  15h  → 18h: Ritmo normal
  19h  → 21h: Pico (após trabalho) ⬆️

SÁBADO - DOMINGO (fim de semana):
  Padrão totalmente diferente?
  Bot adapta automaticamente!
```

→ O bot **reconhece seus picos** e aumenta lembretes justo antes deles! 🧠

---

## ❓ DÚVIDAS COMUNS

**P: Se eu pausar, ele continua lembrando?**
R: Não! `/pausar` para tudo. `/retomar` para reativar.

**P: Quanto tempo em um dia sem responder?**
R: O bot tenta a cada intervalo (15-60min) dependendo da urgência.

**P: Se eu alcançar a meta, para de lembrar?**
R: Sim! A partir de 3000ml, param os lembretes (até amanhã).

**P: Posso mudar a meta?**
R: Ainda não, mas é fácil de adicionar! Padrão é 3000ml/dia.

**P: Funciona de madrugada?**
R: Sim! Mas se seu padrão é não beber às 23h, o bot inteligentemente para.

---

## 📱 NA PRÁTICA NO WHATSAPP

```
15h00
💬 Você: "Tomei água agora"
🤖 Bot: "✅ Registrado! +250ml. Status: 42% da meta.
         Próximo lembrete em 1h.
         
         💧 Você tende a beber mais 12h-14h, leverage isso!"

_[Sistema nota: lembrete agendado para 16h00]_

---

16h00
🤖 Bot: "🟡 Hora de beber! Status: 42%. 
         Ingestão: 1.260ml / 3.000ml"

_[Nenhuma resposta por 60 minutos]_

---

17h00
🤖 Bot: "💪 Mantenha a hidratação! 
         Você consumiu 1.260ml. Objetivo: 3.000ml."

_[Nenhuma resposta]_

---

17h30 (ACELERADO - detectou que tá atrasado)
🤖 Bot: "🟠 Atrasado. Aumente a ingestão!
         Faltam 1.740ml"

_[User responde]_

💬 Você: "Vou beber agora"
🤖 Bot: "✅ Ótimo! +300ml. Status: 55% 
         🟡 No caminho certo. Continue!"
         
_[Próximo: em 60min (intervalo normal retomado)]_
```

---

## 🎉 META ATINGIDA!

```
20h00
🤖 Bot: "🟢 Quase lá! Mais um pouco!"

20h45
💬 Você: "Tomei suco"
🤖 Bot: "✅ Registrado! +500ml.

        🎉🎉🎉 META ATINGIDA! EXCELENTE! 🎉🎉🎉
        
        Total: 3.000ml / 3.000ml (100%)
        Você hidratação de hoje foi perfeita!"

_[Lembretes PARAM até amanhã]_
```

---

## 🔧 COMO FUNCIONA TECNICAMENTE

- **Persistência**: Dados salvos em JSON local
- **Aprendizado**: Padrões analisados por HORA e DIA DA SEMANA
- **Scheduler**: SetTimeout de alta precisão
- **Sem Banco**: Tudo local (não precisa de internet pra calcular)
- **Reset**: A cada dia novo, reinicia contador (mas aprende do anterior)

---

**Status**: ✅ Ativo e Aprendendo

💧 O bot está sempre de olho no seu consumo de água! 👀
