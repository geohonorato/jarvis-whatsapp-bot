# 🍾 Sistema de Rastreamento por Garrafa

## O Conceito

Em vez de contar ml avulsos, você diz **quantas garrafas terminou**. Muito mais intuitivo!

```
Tradicional: "Bebi 250ml"
Novo:       "Garrafa cheia!" ✅
```

---

## Comece Assim

### 1️⃣ **Configure o tamanho da sua garrafa** (primeira vez)

Você tem uma garrafa de 500ml? Apenas diga:

```
"tamanho 500"
```

Ou se é 750ml, 1L, ou outro tamanho:

```
"tamanho 750"
"tamanho 1000"
```

**Padrão**: 500ml (se não disser nada)

### 2️⃣ **Renomeie se quiser** (opcional)

```
"nome Garrafa Térmica"
"nome Meu Garrafão"
"nome Garrafinha"
```

### 3️⃣ **Pronto! Agora é só beber**

---

## Registrando Consumo

### ✅ Garrafa Completa

Quando você **termina a garrafa**, apenas diga:

```
"garrafa cheia"       ✅
"terminei a garrafa"  ✅
"bebida cheia"        ✅
"garrafinha cheia"    ✅
```

**Resultado**: Bot registra os 500ml (ou tamanho que você configurou)

### 🥤 Consumo Parcial

Se você bebeu apenas **parte da garrafa**:

```
"bebida 50%"   → Bebeu metade (250ml se 500ml)
"bebida 75%"   → Bebeu 3/4 (375ml se 500ml)
"bebida 25%"   → Apenas um golinho (125ml se 500ml)
"consumo 100%" → Terminou (mesmo que "garrafa cheia")
```

### 🎯 Linguagem Natural

O bot também entende você falando naturalmente:

```
"Terminei a garrafa"           → garrafa cheia
"Bebi metade da garrafa"       → bebida 50%
"Bebi 3/4 da minha garrafa"    → bebida 75%
"Terminei de beber"            → garrafa cheia
"Tomei um pouco só"            → bebida 25%
```

---

## Ver Status

```
"status"         → Mostra progresso de hoje
"status garrafa" → Idem
"como vai"       → Idem
```

**Resultado**:
```
🍾 *Minha Garrafa* | 3 garrafas completas (1500ml)

🍾🍾🍾

Meta: 1500ml / 3000ml (50%)
Faltam: 1500ml para a meta!
```

---

## Mudar Tamanho de Garrafa

Comprou uma garrafa maior? Sem problema!

```
"tamanho 750"
"tamanho 1000"
"tamanho 600"
```

**Resultado**:
```
✅ Tamanho da garrafa atualizado!

500ml → 750ml

Próximas garrafas serão contabilizadas com o novo tamanho! 🍾
```

---

## Relatório Detalhado

```
"relatório"          → Mostra análise completa
"relatório garrafa"  → Idem
"relatorio"          → Idem (sem acento)
```

**Resultado**:
```
📊 RELATÓRIO DE GARRAFAS

🍾 Garrafa Térmica
📏 Tamanho: 500ml
🔄 Refills Hoje: 5

🍾🍾🍾🍾🍾

Total: 2500ml / 3000ml (83%)
Faltam: 500ml

💡 Tamanho médio: 500ml
💡 Garrafas/dia: 5
```

---

## Ver Ajuda

```
"ajuda"         → Lista todos os comandos
"ajuda garrafa" → Idem
"help"          → Idem
```

---

## Exemplo de Um Dia

```
08h00 - Você: "Tamanho 500"
Bot: ✅ Garrafa configurada para 500ml!

08h30 - Você: "Garrafa cheia"
Bot: 🍾 Excelente! Garrafa 1 completa!
     Total: 500ml / 3000ml (17%)
     Faltam: 2500ml para a meta!

10h00 - ⏰ Bot lembra: "Tempo de beber da sua Garrafa!"

10h30 - Você: "Garrafa cheia"
Bot: 🍾 Excelente! Garrafa 2 completa!
     Total: 1000ml / 3000ml (33%)
     Faltam: 2000ml para a meta!

12h00 - Você: "Bebida 50%"
Bot: 💧 Registrado! Você bebeu 50% da garrafa
     Total: 1250ml / 3000ml (42%)
     Faltam: 1750ml

13h00 - Você: "Garrafa cheia"
Bot: 🍾 Excelente! Garrafa 3 completa!
     Total: 1750ml / 3000ml (58%)
     Faltam: 1250ml

15h30 - Você: "Tamanho 750"
Bot: ✅ Tamanho da garrafa atualizado! 500ml → 750ml
     Próximas garrafas serão contabilizadas com o novo tamanho!

16h00 - Você: "Garrafa cheia"
Bot: 🍾 Excelente! Garrafa 4 completa!
     Total: 2500ml / 3000ml (83%)
     Faltam: 500ml

18h00 - Você: "Garrafa cheia"
Bot: 🍾 Excelente! Garrafa 5 completa!
     ✅✅✅ META ATINGIDA! EXCELENTE!
     Total: 3250ml / 3000ml (108%)
     
     Você hidratação de hoje foi perfeita! 🎉
```

---

## Como o Bot Entende

O sistema de garrafa:
- **Salva tamanho e nome** da sua garrafa
- **Conta quantas garrafas você terminou**
- **Converte para ml** automaticamente (5 garrafas de 500ml = 2500ml)
- **Adapta lembretes** baseado em garrafas, não ml
- **Aprende seus padrões** de consumo por garrafa/dia

---

## Lembretes Adaptados para Garrafas

Os lembretes agora usam linguagem de garrafa:

```
🍾 Tempo de beber da sua Garrafa Térmica!

💧 Terminada sua Garrafa Térmica? Diga "garrafa cheia"!

🚰 Beba mais! Faltam 2 garrafas para a meta.

⏰ Hora de hidratar! Quantos % da garrafa você bebeu?
```

---

## Dúvidas Comuns

**P: Se eu mudo o tamanho da garrafa, o histórico muda?**
R: Não! O histórico anterior mantém o tamanho anterior. Só as novas garrafas usam o novo tamanho.

**P: Posso ter múltiplas garrafas?**
R: Ainda não. Por enquanto é uma garrafa por pessoa. Em breve: múltiplas garrafas!

**P: E se eu esquecer de registrar?**
R: O bot te lembra! Os lembretes continuam funcionando normalmente.

**P: Preciso falar "bebida" ou "garrafa"?**
R: Qualquer um funciona! "garrafa cheia", "bebida cheia", "terminei a garrafa" - tudo é reconhecido.

**P: Se a garrafa não é exatamente o tamanho?**
R: Arredonde para o mais próximo. 530ml? Diga "tamanho 500". 1050ml? Diga "tamanho 1000".

---

💧 **Beba com sabedoria! O bot está cuidando de você!**
