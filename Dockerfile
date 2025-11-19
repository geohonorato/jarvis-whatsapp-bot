# Use Node.js 18 Alpine (leve e seguro)
FROM node:18-alpine

# Instala dependências do Chromium/Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    yarn

# Define variável de ambiente para Puppeteer usar Chromium instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Define diretório de trabalho
WORKDIR /app

# Copia manifesto de dependências
COPY package*.json ./

# Instala dependências de produção
# Obs.: usamos `npm install --omit=dev` em vez de `npm ci` porque o repo não inclui package-lock.json
RUN npm install --omit=dev --no-audit --no-fund

# Copia o código da aplicação
COPY . .

# Cria diretórios necessários
RUN mkdir -p temp temp_images .wwebjs_auth persistent

# Define variáveis de ambiente para persistência
ENV WHATSAPP_CREDENTIALS_PATH=/app/persistent/.whatsapp_session \
    WHATSAPP_ENCRYPTION_KEY=${WHATSAPP_ENCRYPTION_KEY}

# Expõe porta (opcional, útil para health checks)
EXPOSE 3000

# VOLUME para persistência de sessão WhatsApp e dados
VOLUME ["/app/persistent"]

# Comando para iniciar o bot
CMD ["npm", "start"]
