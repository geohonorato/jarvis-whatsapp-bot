# 💧 GUIA RÁPIDO - RASTREAMENTO EM ML

## Setup (não precisa!)

Você **não precisa configurar nada**. Apenas comece a registrar em ml!

---

## Usando Todo Dia

### Registrou consumo?

```
Você: "250ml"
Bot:  💧 Registrado! +250ml
      Total: 250ml / 3000ml (8%)
      Faltam: 2750ml

Você: "Bebi 500"
Bot:  💧 Registrado! +500ml
      Total: 750ml / 3000ml (25%)
```

### Mudou de garrafa?

```
Você: "Troco 750"
Bot:  ✅ Garrafa Trocada!
      Anterior: 500ml
      Nova: 750ml
```

### Ver progresso

```
Você: "Status"
Bot:  💧 *Garrafa 1* (500ml)
      🍾🍾🍾
      
      Total: 1500ml / 3000ml (50%)
      Faltam: 1500ml
```

---

## Todos os Comandos

| Situação | Comando | Resultado |
|----------|---------|-----------|
| **Registrar** | "250ml" | +250ml |
| | "bebi 500" | +500ml |
| | "tomei 1L" | +1000ml |
| | "0.5L" | +500ml |
| **Trocar** | "troco 750" | muda para 750ml |
| | "nova garrafa 1000" | muda para 1L |
| **Info** | "status" | mostra progresso |
| | "relatório" | mostra análise |
| | "ajuda" | mostra comandos |

---

## Na Prática: Um Dia

```
08h30  → "250ml"          (250ml)
10h30  → "500ml"          (750ml)
12h00  → "400ml"          (1150ml)
13h00  → "Troco 750"      (muda referência)
13h30  → "750ml"          (1900ml)
15h30  → "600ml"          (2500ml)
18h00  → "500ml"          (3000ml) ✅

🎉 META ATINGIDA!
```

---

## Linguagem Natural Também Funciona

```
"Bebi 250ml"               → 250ml ✅
"Terminei a garrafa"       → registra tamanho atual ✅
"Bebi bastante"            → estima 75% ✅
"Tomei um pouco"           → estima 25% ✅
"Mudei para 750ml"         → troca garrafa ✅
"1 litro"                  → 1000ml ✅
```

---

## O Bot Aprende

Depois de alguns dias:

```
Bot detecta: Você sempre bebe mais 12-14h (almoço)
↓
Lembretes reduzem antes
↓
Aumentam depois
↓
Personalizados 100% pro seu padrão!
```

---

## Resumo

✅ **Registre ml direto**: "250ml", "bebi 500", "1L"
✅ **Avise quando muda garrafa**: "troco 750"
✅ **Bot rastreia tudo automaticamente**
✅ **Linguagem natural também funciona**
✅ **Lembretes se adaptam ao seu padrão**

**Simples, prático, em ml!** 💧

---

📱 **Comece agora**: Beba algo e diga ao bot quantos ml!

