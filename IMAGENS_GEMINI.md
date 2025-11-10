# Geração de Imagens com Gemini

## Visão Geral

O bot agora utiliza **exclusivamente o Gemini 2.5 Flash Image** para geração de imagens, removendo a dependência do Hugging Face e simplificando a arquitetura.

## Características

### 1. Detecção Automática
- O Gemini (texto) detecta automaticamente quando o usuário quer uma imagem
- Emite o comando `/imagem` internamente
- Não é necessário que o usuário digite comandos explícitos

### 2. Otimização de Prompts
- Todo prompt em português é traduzido e otimizado para inglês
- Adiciona detalhes de qualidade, estilo, iluminação e composição
- Melhora significativamente a qualidade das imagens geradas

### 3. Aspect Ratio Personalizável
O usuário pode especificar o aspect ratio diretamente no texto:

```
"Quero um wallpaper 16:9 de um mosteiro ao amanhecer"
"Crie um banner 21:9 para meu canal"
"Gere um retrato 3:4 de uma santa"
```

#### Aspect Ratios Suportados:
- `1:1` (quadrado - padrão)
- `16:9` (widescreen)
- `9:16` (vertical/stories)
- `3:2` (paisagem)
- `2:3` (retrato)
- `4:3`, `3:4`, `4:5`, `5:4`, `21:9`

### 4. Fluxo de Geração

1. **Usuário** envia mensagem natural (ex: "quero uma imagem de...")
2. **Gemini (texto)** detecta intenção e emite `/imagem [prompt]`
3. **Otimizador** aprimora o prompt em inglês
4. **Gemini (imagem)** gera a imagem com o aspect ratio especificado
5. **Bot** salva em `temp_images/` e envia via WhatsApp
6. **Cleanup** remove o arquivo temporário após envio

## Exemplos de Uso

### Exemplo 1: Simples
```
Usuário: "Me envie uma imagem de um bispo com coroinhas"
Bot: 🪄 Imagem gerada com Gemini (1:1)
     [imagem enviada]
```

### Exemplo 2: Com Aspect Ratio
```
Usuário: "Quero um wallpaper 16:9 de Nossa Senhora Aparecida"
Bot: 🪄 Imagem gerada com Gemini (16:9)
     [imagem widescreen enviada]
```

### Exemplo 3: Banner
```
Usuário: "Crie um banner 21:9 para evento católico, tema eucaristia"
Bot: 🪄 Imagem gerada com Gemini (21:9)
     [banner ultra-wide enviado]
```

## Configuração

### Requisitos
- `GEMINI_API_KEY` no arquivo `.env`
- Modelo: `gemini-2.5-flash-image`
- Sem necessidade de outras dependências de geração de imagem

### Estrutura de Arquivos
```
src/services/api/
  └── image-generator.js    # Geração exclusiva com Gemini
  └── gemini.js             # Otimização de prompts e roteamento
temp_images/                # Armazenamento temporário das imagens
```

## Vantagens vs. Hugging Face

| Aspecto | Gemini | Hugging Face (antigo) |
|---------|--------|----------------------|
| **Quotas** | Generosas, estável | Limitadas, frequentemente excedidas |
| **Latência** | Baixa (~5-10s) | Alta (>20s quando disponível) |
| **Qualidade** | Alta, consistente | Variável |
| **Configuração** | Apenas API key | Client + endpoint + parâmetros complexos |
| **Manutenção** | Simples | Fallbacks, retry, quota management |
| **Aspect Ratio** | Nativo | Requer cálculo manual de width/height |

## Limitações

- Máximo de ~3 imagens de entrada para edição (funcionalidade futura)
- Aspect ratios fixos (não aceita dimensões arbitrárias como 1337x420)
- Marca d'água SynthID em todas as imagens geradas
- Melhor desempenho em EN, ES-MX, JA-JP, ZH-CN, HI-IN

## Próximos Passos (Opcional)

1. **Edição de Imagens**: Usar imagens do WhatsApp como input + texto de edição
2. **Composição Multi-Imagem**: Combinar várias imagens em uma cena
3. **Transferência de Estilo**: Aplicar estilo de uma imagem em outra
4. **Chat Iterativo**: Refinar progressivamente uma imagem em múltiplas rodadas

## Debugging

Para verificar o fluxo de geração:
```bash
# Logs relevantes
🎨 Detectado comando /imagem
🚀 Iniciando geração com Gemini (gemini-2.5-flash-image)...
✨ Prompt aprimorado: [prompt em inglês otimizado]
📐 Aspect ratio: 16:9
✅ Imagem gerada com sucesso! [caminho]
```

## Arquivos Modificados

- ✅ `src/services/api/image-generator.js` - Refatorado para Gemini apenas
- ✅ `src/services/bot/message-handler.js` - Atualizado logs
- ✅ `package.json` - Removido `@gradio/client`
- ✅ `src/services/api/gemini.js` - Sistema de roteamento `/imagem` mantido
