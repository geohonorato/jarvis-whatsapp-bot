const axios = require('axios');
const cheerio = require('cheerio');
const { loadWatches, saveWatches } = require('./watch-manager');

/**
 * Tenta extrair o preço de uma página HTML de forma agnóstica
 */
function extractPrice($) {
    // 1. Meta tags OpenGraph/Schema.org (Melhor cenário)
    const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
        $('meta[property="og:price:amount"]').attr('content') ||
        $('meta[itemprop="price"]').attr('content');

    if (metaPrice) return parseFloat(metaPrice);

    // 2. Seletores comuns de e-commerce (Tentativa)
    const selectors = [
        '.price', '#price', '.product-price', '.offer-price',
        '.andes-money-amount__fraction', // Mercado Livre
        '.sale-price', '.current-price'
    ];

    for (const sel of selectors) {
        const text = $(sel).first().text().replace(/[^\d.,]/g, '').replace(',', '.');
        if (text) return parseFloat(text);
    }

    return null;
}

/**
 * Verifica todos os itens monitorados e retorna alertas
 */
async function checkPrices() {
    console.log('🕷️ [Crawler] Verificando preços...');
    const watches = loadWatches().filter(w => w.active);
    const alerts = [];

    for (const item of watches) {
        try {
            // User-Agent para não ser bloqueado imediatamente
            const { data } = await axios.get(item.url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
                timeout: 10000
            });

            const $ = cheerio.load(data);
            const currentPrice = extractPrice($);
            const title = $('title').text().trim();

            if (currentPrice) {
                console.log(`🔎 ${title.substring(0, 20)}... | Preço: ${currentPrice}`);

                // Atualiza info
                item.lastChecked = new Date().toISOString();
                item.lastPrice = currentPrice;

                // Verifica se caiu abaixo do alvo (com margem de erro)
                if (currentPrice <= item.targetPrice) {
                    alerts.push({
                        chatId: item.chatId,
                        message: `🚨 *ALERTA DE PREÇO!*\n\n📦 *Produto:* ${title}\n💰 *Preço Atual:* R$ ${currentPrice}\n🎯 *Alvo:* R$ ${item.targetPrice}\n🔗 [Link](${item.url})`
                    });
                    // Opcional: Desativar após alerta? Não, continua monitorando.
                }
            } else {
                console.log(`⚠️ Não consegui ler o preço de: ${item.url}`);
            }

        } catch (error) {
            console.error(`❌ Erro ao checar ${item.url}:`, error.message);
        }
    }

    saveWatches(loadWatches()); // Salva timestamps atualizados
    return alerts;
}

module.exports = { checkPrices };
