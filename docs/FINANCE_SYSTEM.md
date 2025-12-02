# 💰 Sistema de Controle Financeiro - Jarvis

Sistema completo de gerenciamento financeiro pessoal integrado ao WhatsApp via IA.

## 🚀 Funcionalidades

### 📊 **Rastreamento Automático**
- **Detecção inteligente de gastos** via IA (Groq)
- Categorização automática de despesas
- Registro de receitas e salários
- Persistência de dados mensal com arquivamento

### 💳 **Categorias Suportadas**
- Alimentação
- Transporte
- Saúde
- Lazer
- Moradia
- Educação
- Vestuário
- Serviços
- Outros

### 📈 **Relatórios e Análises**
- Resumo mensal completo (receitas, despesas, saldo)
- Top 5 categorias de gastos
- Média de gasto diário
- Comparativo com mês anterior
- Status de orçamento em tempo real
- **🎯 Análise de necessidade dos gastos (novo!)**
- **💡 Cálculo de gastos evitáveis**
- **🌈 Classificação por gradiente de necessidade**

### 🎯 **Orçamento e Alertas**
- Definição de orçamento mensal
- Orçamento por categoria (futuro)
- Alerta automático ao atingir 80% do orçamento
- Transações recorrentes (futuro)

## 📱 Como Usar

### **Registrar Gastos**
Simplesmente fale naturalmente no WhatsApp:

```
"Gastei R$50 no mercado"
"Comprei uma camisa de 89 reais"
"Paguei 150 de uber hoje"
"Almoço 35 reais"
```

A IA detecta automaticamente:
- ✅ Valor (R$50, 89 reais, etc)
- ✅ Categoria (mercado → Alimentação, uber → Transporte)
- ✅ Descrição contextual

### **Registrar Receitas**
```
"Recebi meu salário de 3500"
"Ganhei 200 reais de freelance"
"Rendimento de 150 da poupança"
```

### **Consultar Finanças**
```
"Quanto eu gastei esse mês?"
"Mostre minhas últimas compras"
"Qual meu saldo atual?"
"Gastei mais que o mês passado?"
```

### **Definir Orçamento**
```
"Quero definir orçamento de 2000 reais"
"Meu orçamento mensal é 1500"
```

## 🤖 Comandos Internos

O sistema usa comandos internos gerados pela IA (invisíveis ao usuário):

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `/gasto VALOR CATEGORIA DESC` | Registra despesa | `/gasto 50 Alimentação mercado` |
| `/receita VALOR CATEGORIA DESC` | Registra receita | `/receita 3500 Salário mensal` |
| `/financas` | Resumo do mês | `/financas` |
| `/transacoes` | Últimas transações | `/transacoes` |
| `/orcamento VALOR` | Define orçamento | `/orcamento 2000` |
| `/comparativo` | Compara com mês anterior | `/comparativo` |

## 📁 Estrutura de Dados

### **Arquivo de Dados** (`temp/finance-data/{userId}-finance.json`)
```json
{
  "currentMonth": "2025-12",
  "transactions": [
    {
      "id": "1733142263987",
      "date": "2025-12-02T12:44:23.987Z",
      "type": "expense",
      "amount": 50.00,
      "category": "Alimentação",
      "description": "Mercado",
      "source": "ia"
    }
  ],
  "budgets": {},
  "recurringTransactions": []
}
```

### **Arquivo de Configuração** (`temp/finance-data/{userId}-finance-config.json`)
```json
{
  "currency": "BRL",
  "monthlyBudget": 2000,
  "categories": ["Alimentação", "Transporte", ...],
  "alertThreshold": 0.8,
  "timezone": "America/Sao_Paulo"
}
```

## 💡 Exemplos de Uso

### **Cenário 1: Dia Comum**
```
Usuário: "Gastei 15 reais no café da manhã"
Jarvis: ☕ Gasto de R$15 registrado em Alimentação!
        Total no mês: R$324
        Saldo: R$3.176 (positivo)

Usuário: "Paguei 50 de uber"
Jarvis: 🚗 R$50 em Transporte registrado!
        Total no mês: R$374
        Você usou 18.7% do orçamento de R$2.000
```

### **Cenário 2: Consulta de Resumo**
```
Usuário: "Quanto eu gastei esse mês?"
Jarvis: 📊 Resumo Financeiro - Dezembro 2025

        💰 Receitas: R$3.500
        💸 Despesas: R$374
        💵 Saldo: R$3.126 (positivo)

        📈 Top Categorias:
        • Transporte: R$200 (53.5%)
        • Alimentação: R$100 (26.7%)
        • Vestuário: R$74 (19.8%)

        📅 Média diária: R$187
        🎯 Orçamento: 18.7% usado
```

### **Cenário 3: Alerta de Orçamento**
```
Usuário: "Comprei um notebook de 1700"
Jarvis: 🛒 R$1.700 em Eletrônicos registrado

        ⚠️ ATENÇÃO: Você já usou 85% do orçamento mensal!
        • Orçamento: R$2.000
        • Usado: R$1.700
        • Restante: R$300

        💡 Dica: Controle os gastos nos próximos dias!
```

## 🎯 Análise de Necessidade dos Gastos

### **Sistema de Classificação Inteligente**
O Jarvis analisa automaticamente cada despesa e classifica em 5 níveis de necessidade usando um gradiente de 0 a 100:

#### **🔴 Essencial (80-100)**
Gastos absolutamente necessários para sobrevivência e obrigações básicas:
- Aluguel, condomínio, IPTU
- Água, luz, gás
- Mercado (compras essenciais)
- Remédios e tratamentos de saúde
- Transporte para trabalho

**Exemplo:** "Gastei 800 no aluguel" → 🔴 Essencial (Score: 90/100)

#### **🟠 Importante (60-79)**
Gastos importantes para manutenção da qualidade de vida e desenvolvimento:
- Combustível, manutenção veicular
- Cursos e educação
- Uniformes e equipamentos de trabalho
- Plano de saúde
- Internet

**Exemplo:** "Paguei 300 no curso profissionalizante" → 🟠 Importante (Score: 70/100)

#### **🟡 Moderado (40-59)**
Gastos regulares mas não críticos:
- Alimentação geral (restaurantes, lanches)
- Roupas básicas
- Produtos de higiene e limpeza
- Transporte eventual

**Exemplo:** "Almoço de 45 reais no restaurante" → 🟡 Moderado (Score: 50/100)

#### **🟢 Dispensável (20-39)**
Gastos que podem ser evitados com planejamento:
- Fast food, delivery
- Doces e guloseimas
- Compras online não essenciais
- Pequenos luxos

**Exemplo:** "Pedi pizza pelo iFood, 35 reais" → 🟢 Dispensável (Score: 30/100)

#### **🔵 Supérfluo (0-19)**
Gastos por impulso ou puramente recreativos:
- Streaming (Netflix, Spotify)
- Baladas e festas
- Games e entretenimento
- Compras por impulso
- Cinema, shows

**Exemplo:** "Comprei um game de 150" → 🔵 Supérfluo (Score: 10/100)

### **🧠 Como Funciona a Análise**

O sistema usa 3 fatores para calcular o score:

1. **Palavras-chave na descrição**
   - Busca por termos específicos: "aluguel", "remédio", "netflix", etc.
   - Cada palavra tem um peso associado

2. **Categoria padrão**
   - Moradia e Saúde → tendência Essencial
   - Lazer → tendência Supérfluo
   - Outras categorias → classificação por contexto

3. **Modificadores de contexto**
   - Palavras como "urgente", "essencial", "necessário" → +10 pontos
   - Palavras como "impulso", "vontade", "desejo" → -15 pontos

**Exemplo de ajuste:**
```
"Consulta médica urgente" → Score 90 + 10 (urgente) = 100 (🔴 Essencial)
"Tênis da moda compra por impulso" → Score 50 - 15 (impulso) = 35 (🟢 Dispensável)
```

### **💡 Insights Automáticos**

O resumo mensal agora inclui:

```
🎯 Análise de Necessidade dos Gastos:

🔴 Essencial: R$1.455 (54.9%) - 6 transações
🟠 Importante: R$500 (18.9%) - 3 transações
🟡 Moderado: R$410 (15.5%) - 7 transações
🟢 Dispensável: R$150 (5.7%) - 1 transação
🔵 Supérfluo: R$135 (5.1%) - 3 transações

💰 Gastos Evitáveis (Dispensável + Supérfluo): R$285 (10.8%)
ℹ️ Gastos evitáveis moderados. Há espaço para economia.
```

### **📊 Quando Você Registra um Gasto**

A resposta agora inclui o nível de necessidade:

```
Usuário: "Gastei 40 no netflix"
Jarvis: 💸 R$40 registrado em Lazer
        🔵 Supérfluo (score: 10/100)
        Total no mês: R$1.200
        Gastos evitáveis: R$285 (23%)
```

## 🔧 Arquitetura Técnica

### **Componentes**
1. **FinanceTracker** (`finance-tracker.js`)
   - Core do sistema financeiro
   - Gerencia transações, categorias e orçamentos
   - **Análise de necessidade automática**
   - Persistência e arquivamento automático

2. **Finance API** (`finance-api.js`)
   - Interface para integração com WhatsApp
   - Retorna dados estruturados incluindo necessidade
   - Cache de trackers por usuário

3. **Message Handler** (integração)
   - Detecta comandos financeiros via Groq
   - Formata respostas com análise de necessidade
   - Adiciona ao histórico da conversa

### **Fluxo de Processamento**
```
Mensagem WhatsApp
    ↓
Groq (Detecção de Intenção)
    ↓
Comando Interno (/gasto, /receita, etc)
    ↓
Finance API (Processamento)
    ↓
FinanceTracker (Lógica de Negócio)
    ↓
Groq (Formatação da Resposta)
    ↓
Resposta Humanizada ao Usuário
```

## 📊 Dados Persistidos

### **Transações**
- ID único (timestamp)
- Data e hora (ISO)
- Tipo (expense/income)
- Valor (float 2 decimais)
- Categoria
- Descrição
- Fonte (ia/manual/recurring)

### **Arquivamento Automático**
- Ao virar o mês, dados são arquivados em `temp/finance-data/archive/`
- Nome: `{userId}-{YYYY-MM}.json`
- Permite análise histórica e comparativos

## 🚀 Próximas Funcionalidades

- [ ] Transações recorrentes (contas fixas mensais)
- [ ] Orçamento por categoria
- [ ] Gráficos visuais de gastos
- [ ] Export para Excel/CSV
- [ ] Metas de economia
- [x] **Análise de necessidade dos gastos** ✅
- [ ] Previsão de gastos futuros (IA)
- [ ] Integração com bancos (Open Banking)
- [ ] Sugestões de economia baseadas em padrões

## 🧪 Testes

### **Teste Básico do Sistema**
```bash
node scripts/test-finance.js
```

**Validações:**
- ✅ Inicialização e configuração
- ✅ Registro de despesas/receitas
- ✅ Resumo financeiro
- ✅ Últimas transações
- ✅ Definição de orçamento
- ✅ Alertas de threshold
- ✅ Comparação mensal
- ✅ Persistência de dados

### **Teste de Análise de Necessidade**
```bash
node scripts/test-necessity-analysis.js
```

**Validações:**
- ✅ Classificação Essencial (80-100)
- ✅ Classificação Importante (60-79)
- ✅ Classificação Moderado (40-59)
- ✅ Classificação Dispensável (20-39)
- ✅ Classificação Supérfluo (0-19)
- ✅ Ajuste por contexto (urgente/impulso)
- ✅ Cálculo de gastos evitáveis
- ✅ Percentuais por nível de necessidade

## 📝 Notas Técnicas

### **Formatação de Valores**
- Sempre 2 casas decimais (parseFloat().toFixed(2))
- Moeda padrão: BRL (Real Brasileiro)
- Aceita entrada com ou sem "R$"

### **Categorização Inteligente**
O Groq analisa contexto para categorizar:
- "mercado", "supermercado", "almoço" → Alimentação
- "uber", "taxi", "gasolina" → Transporte
- "farmácia", "médico", "remédio" → Saúde
- "cinema", "restaurante", "balada" → Lazer
- "aluguel", "condomínio", "luz" → Moradia

### **Persistência**
- Salvamento imediato após cada transação
- Arquivamento automático mensal
- Dados isolados por usuário (chatId)

## 🔐 Segurança

- Dados armazenados localmente no servidor
- Sem conexão com serviços externos
- Isolamento por usuário via chatId
- Backup automático mensal

---

**Sistema pronto para uso em produção!** 🎯
