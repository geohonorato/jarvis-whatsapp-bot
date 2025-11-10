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

# Copia package.json e package-lock.json
COPY package*.json ./

# Instala dependências de produção
RUN npm ci --only=production

# Copia o código da aplicação
COPY . .

# Cria diretórios necessários
RUN mkdir -p temp temp_images .wwebjs_auth

# Expõe porta (opcional, útil para health checks)
EXPOSE 3000

# Comando para iniciar o bot
CMD ["npm", "start"]
