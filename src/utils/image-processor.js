const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { getFFmpegPath } = require('./ffmpeg-path');
const ffmpegPath = getFFmpegPath();

// Limite: 15.99 MB em bytes (para margem de segurança do WhatsApp)
const MAX_SIZE_BYTES = 15.99 * 1024 * 1024;

/**
 * Verifica se a imagem excede o tamanho limite e a comprime se necessário.
 * Converte para JPG (qualidade alta) para reduzir tamanho mantendo resolução.
 * @param {string} inputPath - Caminho do arquivo de imagem.
 * @returns {Promise<string>} - Caminho do arquivo final (pode ser o mesmo ou um novo .jpg).
 */
async function otimizarImagemParaWhatsApp(inputPath) {
    return new Promise((resolve, reject) => {
        try {
            // 1. Verifica tamanho atual
            const stats = fs.statSync(inputPath);
            const fileSizeInBytes = stats.size;

            if (fileSizeInBytes <= MAX_SIZE_BYTES) {
                console.log(`✅ Imagem dentro do limite (${(fileSizeInBytes / 1024 / 1024).toFixed(2)} MB). Nenhuma compressão necessária.`);
                return resolve(inputPath);
            }

            console.log(`⚠️ Imagem excede 16MB (${(fileSizeInBytes / 1024 / 1024).toFixed(2)} MB). Iniciando compressão inteligente...`);

            // 2. Define caminho de saída (mesmo nome, mas .jpg)
            const dir = path.dirname(inputPath);
            const ext = path.extname(inputPath);
            const name = path.basename(inputPath, ext);
            const outputPath = path.join(dir, `${name}_optimized.jpg`);

            // 3. Comando FFmpeg: Converte para JPG com qualidade alta (q:v 2-5). 
            // -q:v 2 ou 3 é excelente qualidade.
            const command = `"${ffmpegPath}" -i "${inputPath}" -q:v 3 -y "${outputPath}"`;

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Erro na compressão FFmpeg:', stderr);
                    // Em caso de erro, retorna original e deixa o fallback do handler lidar (envia como documento)
                    return resolve(inputPath);
                }

                // 4. Verifica tamanho do arquivo gerado
                try {
                    if (fs.existsSync(outputPath)) {
                        const newStats = fs.statSync(outputPath);
                        if (newStats.size > 0) {
                            console.log(`✅ Compressão concluída: ${(newStats.size / 1024 / 1024).toFixed(2)} MB`);
                            return resolve(outputPath);
                        }
                    }
                    console.error('❌ Compressão gerou arquivo vazio ou inexistente. Usando original.');
                    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (e) { }
                    resolve(inputPath);
                } catch (err) {
                    console.error('❌ Erro ao verificar arquivo comprimido:', err);
                    resolve(inputPath);
                }
            });

        } catch (err) {
            console.error('❌ Erro ao processar imagem para compressão:', err);
            resolve(inputPath); // Retorna original em caso de erro
        }
    });

}

module.exports = { otimizarImagemParaWhatsApp };
