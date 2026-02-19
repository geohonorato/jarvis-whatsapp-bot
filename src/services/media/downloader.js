const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../../temp/media');

// Garante que a pasta temporária existe
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Baixa um vídeo do YouTube
 * @param {string} url - URL do vídeo
 * @returns {Promise<string>} - Caminho do arquivo baixado (MP4)
 */
async function downloadYouTubeVideo(url) {
    return new Promise((resolve, reject) => {
        (async () => {
            try {
                if (!ytdl.validateURL(url)) {
                    return reject(new Error('URL inválida ou não suportada pelo YouTube.'));
                }

                const info = await ytdl.getInfo(url);
                const title = info.videoDetails.title.replace(/[^\w\s]/gi, '').substring(0, 50); // Sanitize filename
                const outputName = `video_${Date.now()}_${title}.mp4`;
                const outputPath = path.join(TEMP_DIR, outputName);

                console.log(`🎬 Iniciando download: ${title}`);

                // Filtra formatos com áudio e vídeo
                const combinedFormat = ytdl.filterFormats(info.formats, 'audioandvideo').find(f => f.container === 'mp4');

                if (!combinedFormat) {
                    return reject(new Error('Não encontrei formato MP4 direto com áudio e vídeo.'));
                }

                ytdl(url, { format: combinedFormat })
                    .pipe(fs.createWriteStream(outputPath))
                    .on('finish', () => {
                        console.log('✅ Download concluído!');
                        resolve(outputPath);
                    })
                    .on('error', (err) => {
                        console.error('❌ Erro no download:', err);
                        reject(err);
                    });

            } catch (error) {
                reject(error);
            }
        })();
    });
}

module.exports = { downloadYouTubeVideo };
