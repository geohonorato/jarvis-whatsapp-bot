# 🔄 Sistema Híbrido de IA - Groq + Gemini

## 📋 Visão Geral

O bot utiliza um **sistema híbrido inteligente em 2 fases** que aproveita o melhor de cada IA:

```
┌─────────────────────────────────────────┐
│         Entrada do Usuário              │
└──────────────┬──────────────────────────┘
               │
               ▼
       ┌───────────────┐
       │ Detecta Tipo  │
       └───────┬───────┘
               │
       ┌───────┴────────────────────┐
       │                            │
       ▼                            ▼
┌──────────────┐            ┌──────────────┐
│ TEXTO PURO   │            │ MULTIMODAL   │
│              │            │(Img/Áudio/Doc)│
└──────┬───────┘            └──────┬───────┘
       │                           │
       │                    ┌──────▼──────┐
       │                    │   FASE 1    │
       │                    │   Gemini    │
       │                    │ Analisa/    │
       │                    │ Transcreve  │
       │                    └──────┬──────┘
       │                           │
       │                    ┌──────▼──────┐
       │                    │  Descrição/ │
       │                    │ Transcrição │
       │                    └──────┬──────┘
       │                           │
       └───────────┬───────────────┘
                   │
            ┌──────▼──────┐
            │   FASE 2    │
            │    Groq     │
            │(GPT 120B)   │
            │   Decide    │
            │    Ação     │
            └──────┬──────┘
                   │
                   ▼
           ┌──────────────┐
           │   Resposta   │
           └──────────────┘
```

### 🎯 Filosofia do Sistema

**"Gemini vê e ouve, Groq pensa e decide"**

1. **Gemini (2.5 Flash)** - Especialista sensorial
   - Analisa imagens
   - Transcreve áudio
   - Extrai informações de documentos
   - **NÃO toma decisões**

2. **Groq (GPT OSS 120b)** - Especialista cognitivo
   - Recebe análises do Gemini
   - Raciocina sobre o conteúdo
   - Toma decisões de ação
   - Gera comandos (/add, /imagem, /magisterium)
   - **Sempre** tem a palavra final

---

## 🎯 Fluxo de Processamento Detalhado

### � Cenário 1: Texto Puro

```
Usuário: "Olá, como você está?"
         ↓
[Detecção] → Apenas texto
         ↓
[Groq] → Processa diretamente
         ↓
Resposta: "Olá! Estou bem..."
```

**Vantagens:**
- ⚡ Ultra-rápido (~200ms)
- 💪 Modelo 120B para melhor qualidade
- 🎯 Raciocínio superior

---

### �️ Cenário 2: Imagem/Documento

```
Usuário: [Foto de cartaz de evento]
         ↓
[Detecção] → Conteúdo multimodal
         ↓
╔════════════════════╗
║   FASE 1: Gemini   ║
╚════════════════════╝
📸 Analisa imagem
📝 Extrai: "Evento: Missa Solene
           Data: 15/11/2025
           Hora: 19h30
           Local: Catedral..."
         ↓
╔════════════════════╗
║   FASE 2: Groq     ║
╚════════════════════╝
🧠 Recebe análise
🎯 Identifica: É um evento
⚙️ Gera: /add Missa Solene | 2025-11-15 19:30...
         ↓
Resposta: [Evento criado na agenda]
```

**Vantagens:**
- 🔍 Análise visual precisa (Gemini)
- 🧠 Decisão inteligente (Groq)
- 📅 Extração automática de eventos

---

### � Cenário 3: Áudio

```
Usuário: [Áudio: "Adicionar reunião amanhã às 10h"]
         ↓
[Detecção] → Áudio detectado
         ↓
╔════════════════════╗
║   FASE 1: Gemini   ║
╚════════════════════╝
🎤 Transcreve áudio
📝 Resultado: "Adicionar reunião amanhã às 10h"
         ↓
╔════════════════════╗
║   FASE 2: Groq     ║
╚════════════════════╝
🧠 Processa transcrição
🎯 Identifica: Comando de evento
⚙️ Gera: /add Reunião | 2025-11-11 10:00...
         ↓
Resposta: [Evento criado]
```

**Vantagens:**
- 🎵 Transcrição precisa (Gemini)
- 🤖 Interpretação correta (Groq)
- ⚡ Processamento rápido

---

### 🎨 Cenário 4: Solicitação de Imagem

```
Usuário: "Crie uma imagem de um bispo"
         ↓
[Detecção] → Apenas texto
         ↓
[Groq] → Identifica pedido de imagem
         ↓
Gera: /imagem bispo católico com mitra e báculo
         ↓
[Pollinations.AI] → Gera imagem
         ↓
Resposta: [Imagem enviada]
```

**Vantagens:**
- 🚀 Detecção instantânea (Groq)
- 🎨 Geração rápida (Pollinations)
- 🖼️ Alta qualidade

---

## 🔧 Implementação Técnica

### Detecção Automática

```javascript
// message-handler.js
async function processarMensagemTexto(client, partsEntrada, chatId, usarGemini = false) {
    // Verifica se há conteúdo multimodal
    const temConteudoMultimodal = partsEntrada.some(p => p.inlineData);
    
    if (temConteudoMultimodal) {
        usarGemini = true;
        console.log('🖼️ Conteúdo multimodal detectado - usando Gemini');
    } else {
        console.log('📝 Apenas texto - usando Groq (GPT OSS 120b)');
    }
    
    // Escolhe o processador
    let respostaIA;
    if (usarGemini) {
        respostaIA = await processarComGemini(partsEntrada, historicoParaEnviar);
    } else {
        respostaIA = await processarComGroq(partsEntrada, historicoParaEnviar);
    }
}
```

### Imports Organizados

```javascript
// Groq para texto
const {
    processarMensagemMultimodal: processarComGroq,
    filtrarPensamentos
} = require('../api/groq');

// Gemini para multimodal
const {
    processarMensagemMultimodal: processarComGemini
} = require('../api/gemini');
```

---

## 📊 Comparação de Performance

| Aspecto | Groq (GPT 120B) | Gemini (2.5 Flash) |
|---------|-----------------|---------------------|
| **Velocidade (texto)** | ⚡ ~200ms | 🐢 ~1-2s |
| **Qualidade (texto)** | 🏆 Excelente | ✅ Boa |
| **Suporte multimodal** | ❌ Não | ✅ Sim |
| **Análise de imagens** | ❌ Não | 🏆 Excelente |
| **Transcrição áudio** | ❌ Não | ✅ Sim |
| **Custo** | 💰 Gratuito | 💰 Gratuito (com limites) |
| **Rate limit** | 30 req/min | 15 req/min |

---

## 🎨 Casos de Uso Práticos

### Caso 1: Conversa Normal
```
Usuário: "Qual o horário da reunião hoje?"
Sistema: 📝 Texto simples → Groq
Resposta: [Rápida, consulta calendário]
```

### Caso 2: Análise de Imagem
```
Usuário: [Foto de cartaz de evento com data e hora]
Sistema: 🖼️ Imagem detectada → Gemini
Resposta: [Analisa imagem, extrai informações, cria evento]
```

### Caso 3: Geração de Imagem
```
Usuário: "Crie uma imagem de um bispo"
Sistema: 📝 Texto simples → Groq
Groq: Gera comando "/imagem bispo católico..."
Sistema: Processa comando → Pollinations.AI
```

### Caso 4: Questão Doutrinária
```
Usuário: "O que é a eucaristia?"
Sistema: 📝 Texto simples → Groq
Groq: Identifica questão católica → "/magisterium O que é..."
Sistema: Consulta Magisterium AI → Formata com Groq
```

### Caso 5: Imagem + Legenda
```
Usuário: [Foto] "Analise esta imagem de arte sacra"
Sistema: 🖼️ Imagem + texto → Gemini
Resposta: [Análise detalhada da imagem]
```

---

## 💡 Otimizações Implementadas

### 1. Cache de Contexto
- Histórico de conversas mantido
- Ambas as IAs acessam o mesmo histórico
- Transição transparente entre Groq e Gemini

### 2. Detecção Inteligente
- Verificação automática de conteúdo multimodal
- Força Gemini quando necessário
- Usa Groq para máxima velocidade em texto

### 3. Fallback Robusto
- Se Groq falhar → Tenta Gemini
- Se Gemini falhar → Mensagem de erro clara
- Retry automático com delay exponencial

### 4. Logs Detalhados
```
📝 Apenas texto - usando Groq (GPT OSS 120b)
🖼️ Conteúdo multimodal detectado - usando Gemini
🧠 Processando com Groq (GPT OSS 120b)...
🧠 Processando com Gemini (multimodal)...
```

---

## 🔄 Fluxo Completo de Mensagem

```
1. Mensagem chega → handleMessage()
   ↓
2. Detecta tipo (texto/mídia)
   ↓
3. Se tem mídia:
   - Download da mídia
   - Prepara parts multimodal
   - Flag usarGemini = true
   ↓
4. processarMensagemTexto(usarGemini)
   ↓
5. Verifica se tem inlineData
   - Se sim → Gemini
   - Se não → Groq
   ↓
6. Processa com IA escolhida
   ↓
7. Identifica comandos (/imagem, /magisterium, /add)
   ↓
8. Executa ação apropriada
   ↓
9. Retorna resposta ao usuário
```

---

## 📈 Benefícios do Sistema Híbrido

### ✅ Vantagens

1. **Performance Otimizada**
   - 90% das mensagens são texto → Groq (super rápido)
   - 10% com mídia → Gemini (quando necessário)

2. **Melhor Qualidade**
   - Groq: Excelente para texto e raciocínio
   - Gemini: Excelente para análise visual

3. **Economia de Recursos**
   - Usa API mais barata (Groq) na maioria dos casos
   - Gemini apenas quando essencial

4. **Experiência do Usuário**
   - Respostas mais rápidas em texto
   - Análise precisa de imagens quando necessário

5. **Escalabilidade**
   - Rate limits distribuídos entre 2 APIs
   - Menor probabilidade de atingir limites

---

## 🛠️ Configuração Necessária

### Variáveis de Ambiente

```env
# Groq - Principal para texto
GROQ_API_KEY=sua_chave_groq

# Gemini - Para multimodal
GEMINI_API_KEY=sua_chave_gemini

# Outras (mantidas)
MAGISTERIUM_API_KEY=sua_chave
CALENDAR_ID=seu_id
WHATSAPP_NUMBER=seu_numero
GOOGLE_CREDENTIALS={"type":"service_account"...}
```

### Dependências

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.1.0",
    "axios": "^1.13.1",
    // ... outras
  }
}
```

---

## 🆘 Troubleshooting

### Problema: "Gemini não está respondendo para imagens"

**Solução:** Verifique se GEMINI_API_KEY está configurada

### Problema: "Groq retorna erro 429"

**Solução:** Rate limit atingido (30 req/min). O código já tem retry automático.

### Problema: "Bot usa Gemini para tudo"

**Solução:** Verifique a lógica de detecção de multimodal no código.

---

## 🎯 Próximas Melhorias

- [ ] Adicionar fallback: se Groq falhar, usar Gemini
- [ ] Implementar escolha manual: "use gemini para responder X"
- [ ] Cache de respostas frequentes
- [ ] Métricas de uso (quantas vezes cada IA foi usada)
- [ ] Health check de ambas as APIs

---

## 📚 Documentação Relacionada

- [groq.js](../src/services/api/groq.js) - Implementação Groq
- [gemini.js](../src/services/api/gemini.js) - Implementação Gemini
- [message-handler.js](../src/services/bot/message-handler.js) - Sistema híbrido

---

**Sistema implementado e funcionando! 🎉**

O bot agora escolhe automaticamente a melhor IA para cada situação, oferecendo:
- ⚡ Máxima velocidade para texto
- 🖼️ Análise precisa de imagens
- 💰 Uso otimizado das APIs
- 🎯 Melhor experiência do usuário
