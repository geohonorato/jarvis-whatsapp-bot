/**
 * Patch para whatsapp-web.js: corrige bug 'getLastMsgKeyForAction is not a function'
 * Esse bug ocorre quando o sendSeen é chamado para chats de newsletter/canal.
 * 
 * Esse script modifica Client.js no node_modules para adicionar try/catch no sendSeen.
 * Rode após npm install, ou adicione como postinstall no package.json.
 */

const fs = require('fs');
const path = require('path');

const CLIENT_JS = path.join(process.cwd(), 'node_modules', 'whatsapp-web.js', 'src', 'Client.js');

if (!fs.existsSync(CLIENT_JS)) {
    console.log('⚠️ whatsapp-web.js não encontrado, pulando patch.');
    process.exit(0);
}

let content = fs.readFileSync(CLIENT_JS, 'utf8');

// Verifica se já foi patcheado
if (content.includes('// PATCHED: sendSeen fix')) {
    console.log('✅ Patch já aplicado.');
    process.exit(0);
}

// Substitui o bloco sendSeen dentro do sendMessage
const original = `            if (sendSeen) {
                await window.WWebJS.sendSeen(chatId);
            }`;

const patched = `            // PATCHED: sendSeen fix para newsletters/canais
            if (sendSeen) {
                try {
                    await window.WWebJS.sendSeen(chatId);
                } catch (e) {
                    // Newsletter/canal não suporta sendSeen - ignorar
                }
            }`;

if (content.includes(original)) {
    content = content.replace(original, patched);
    fs.writeFileSync(CLIENT_JS, content, 'utf8');
    console.log('✅ Patch aplicado com sucesso em Client.js (sendSeen fix)');
} else {
    console.warn('⚠️ Bloco sendSeen não encontrado no formato esperado. Patch não aplicado.');
}
