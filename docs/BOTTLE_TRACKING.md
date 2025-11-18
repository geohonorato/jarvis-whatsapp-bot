# 💧 Sistema de Rastreamento de Hidratação em ML

## O Conceito

Você **registra consumo diretamente em ml**. Simples!

```
Você: "Bebi 250ml"
Bot:  💧 Registrado! +250ml
```

Se muda de garrafa, você apenas avisa o tamanho (para referência visual):

```
Você: "Troquei para 750ml"
Bot:  ✅ Garrafa atualizada para 750ml!
```

---

## Comece Assim

### 1️⃣ **Registre seu consumo**

Sempre que beber, avise quanto:

```
"250ml"         ✅
"bebi 500"      ✅
"tomei 500ml"   ✅
"1L"            ✅
"0.5L"          ✅
```

### 2️⃣ **Quando mudar de garrafa, avise**

Se trocou para uma garrafa maior ou menor:

```
"troco 750"        ✅ (trocou para 750ml)
"nova garrafa 1000" ✅ (trocou para 1L)
"comprei 500ml"    ✅ (trocou para 500ml)
```

### 3️⃣ **Pronto! Bot rastreia tudo em ml**

---

## Registrando Consumo

### ✅ Formas de Registrar

```
"250ml"              → registra 250ml
"bebi 500"           → registra 500ml
"tomei 750ml"        → registra 750ml
"1L"                 → registra 1000ml
"0.5L"               → registra 500ml
"consumo 300"        → registra 300ml
"bebida 250ml"       → registra 250ml
```

### 🎯 Linguagem Natural

O bot também entende você falando naturalmente:

```
"Terminei a garrafa"       → registra o tamanho atual da garrafa
"Bebi bastante"            → estima 75% da garrafa
"Tomei um pouco"           → estima 25% da garrafa
"Bebi metade"              → estima 50% da garrafa
```

---

## Mudar de Garrafa

Comprou uma garrafa de tamanho diferente? Sem problema!

```
"troco 750"
"nova garrafa 1000"
"mudei para 500ml"
"comprei 750"
```

**Resultado**:
```
✅ Garrafa Trocada!

Anterior: 500ml
Nova: 750ml

Próximas garrafas serão de 750ml! 🍾
```

---

## Ver Status

```
"status"         → Mostra progresso de hoje
"como vai"       → Idem
"progresso"      → Idem
```

**Resultado**:
```
💧 *Garrafa 1* (500ml)

🍾🍾🍾💧

Total: 1500ml / 3000ml (50%)
Faltam: 1500ml (≈ 3 da sua garrafa)
```

---

## Relatório Detalhado

```
"relatório"          → Mostra análise completa
"relatorio"          → Idem (sem acento)
"report"             → Idem (em inglês)
```

**Resultado**:
```
📊 RELATÓRIO DE HIDRATAÇÃO

💧 Garrafa Atual: Garrafa 1 (500ml)

🍾🍾🍾💧

Total: 1500ml / 3000ml (50%)
Faltam: 1500ml (≈ 3 da sua garrafa)

📋 Histórico de Garrafas:
1. Garrafa 1 - 500ml (08:00:00)
2. Garrafa 2 - 750ml (13:30:00)
```

---

## Ver Ajuda

```
"ajuda"         → Lista todos os comandos
"help"          → Idem
```

---

## Exemplo de Um Dia

```
08h00 - Você: "Bebi 250ml"
Bot: 💧 Registrado! +250ml
     Total: 250ml / 3000ml (8%)
     Faltam: 2750ml

10h00 - ⏰ Bot lembra: "Hora de hidratar! Quanto você quer registrar?"

10h30 - Você: "500ml"
Bot: 💧 Registrado! +500ml
     Total: 750ml / 3000ml (25%)
     Faltam: 2250ml

12h00 - Você: "Bebi 400ml"
Bot: 💧 Registrado! +400ml
     Total: 1150ml / 3000ml (38%)
     Faltam: 1850ml

13h00 - Você: "Troco 750"
Bot: ✅ Garrafa Trocada!
     Anterior: 500ml
     Nova: 750ml

13h30 - Você: "750ml"
Bot: 💧 Registrado! +750ml
     Total: 1900ml / 3000ml (63%)
     Faltam: 1100ml (≈ 1.5 da sua garrafa)

15h30 - Você: "Bebi 600ml"
Bot: 💧 Registrado! +600ml
     Total: 2500ml / 3000ml (83%)
     Faltam: 500ml

18h00 - Você: "Mais 500ml"
Bot: 💧 Registrado! +500ml
     ✅✅✅ META ATINGIDA! EXCELENTE!
     Total: 3000ml / 3000ml (100%)
```

---

## Todos os Comandos

| Situação | Comando | Resultado |
|----------|---------|-----------|
| **Consumo** | "250ml" | registra 250ml |
| | "bebi 500" | registra 500ml |
| | "tomei 1L" | registra 1000ml |
| | "0.5L" | registra 500ml |
| **Garrafa** | "troco 750" | muda para 750ml |
| | "nova garrafa 1000" | muda para 1L |
| | "mudei para 500" | muda para 500ml |
| **Info** | "status" | mostra progresso |
| | "relatório" | mostra análise |
| | "ajuda" | mostra comandos |

---

## Como o Bot Entende

O sistema:
- **Aceita ml direto** ("250ml", "500", "1L", etc)
- **Salva tamanho referência** da garrafa (para cálculos visuais)
- **Permite trocar garrafa** quando avisar novo tamanho
- **Adapta lembretes** baseado em progresso ml
- **Aprende seus padrões** de consumo por dia

---

## Lembretes Adaptados

Os lembretes agora usam linguagem de ml:

```
💧 Hora de hidratar! Quanto você quer registrar?

🚰 Beba água! Faltam 1500ml para a meta.

⏰ Tempo de beber! Quantos ml você bebeu?

🍾 Bora manter a hidratação? Registre seu consumo em ml!
```

---

## Dúvidas Comuns

**P: Preciso falar "ml" sempre?**
R: Não! "250", "500ml", "1L" - tudo funciona.

**P: E se eu não souber quantos ml exatos bebi?**
R: Use linguagem natural: "bebi bastante", "tomei um pouco", "quase tudo" - o bot estima baseado na garrafa.

**P: O histórico de garrafas persiste?**
R: Sim! O bot registra cada mudança de garrafa com timestamp.

**P: Posso usar "litros" em vez de "ml"?**
R: Sim! "1L" = "1000ml", "0.5L" = "500ml". O bot converte automaticamente.

**P: Se eu registra errado, posso corrigir?**
R: Não há "undo" ainda. Mas o total diário se reseta a cada dia.

**P: Máximo de ml por registro?**
R: 3000ml (para evitar erros). Se bebeu mais, registre em 2 vezes.

---

💧 **Simples, direto, em ml!**
