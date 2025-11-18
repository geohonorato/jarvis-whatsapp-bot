const fs = require('fs');
const path = require('path');

console.log('🧹 Limpando cache do WhatsApp Web...');

try {
    const authPath = path.join(process.cwd(), '.wwebjs_auth');
    const cachePath = path.join(process.cwd(), '.wwebjs_cache');
    
    if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log('✅ Cache de autenticação removido');
    } else {
        console.log('ℹ️ Cache de autenticação não encontrado');
    }
    
    if (fs.existsSync(cachePath)) {
        fs.rmSync(cachePath, { recursive: true, force: true });
        console.log('✅ Cache do navegador removido');
    } else {
        console.log('ℹ️ Cache do navegador não encontrado');
    }
    
    console.log('🎉 Limpeza concluída! Agora você pode executar "npm start" novamente.');
    
} catch (error) {
    console.error('❌ Erro ao limpar cache:', error);
}