/**
 * Magisterium Handler — gerencia redirecionamento para Magisterium AI
 * Extraído de message-handler.js para melhor organização
 */

const { responderMagisteriumComFormatacao } = require('../../magisterium/magisterium');
const { adicionarAoHistorico } = require('../../chat/chat-history');

/**
 * Processa comando /magisterium gerado pela IA
 */
async function handleMagisteriumCommand(client, chatId, respostaIA, historico) {
    console.log('\n⛪ Detectado comando /magisterium, redirecionando para especialista...');

    // Extrai a pergunta reformulada após /magisterium
    const perguntaReformulada = respostaIA.substring(12).trim();

    // Envia mensagem de feedback imediato
    await client.sendMessage(chatId, '⛪ Aguarde, consultando o Magistério da Igreja...');

    // Adiciona ao histórico que foi identificada uma questão católica
    adicionarAoHistorico(chatId, 'model', [{ text: '[Questão sobre doutrina católica identificada]' }]);

    // Cria parts com a pergunta reformulada
    const partsMagisterium = [{ text: perguntaReformulada }];

    // Processa com Magisterium AI e formata com Gemini
    const respostaMagisterium = await responderMagisteriumComFormatacao(partsMagisterium, historico);

    await client.sendMessage(chatId, respostaMagisterium);
    adicionarAoHistorico(chatId, 'model', [{ text: respostaMagisterium }]);
}

module.exports = {
    handleMagisteriumCommand
};
