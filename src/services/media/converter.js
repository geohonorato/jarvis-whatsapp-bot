const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { getFFmpegPath } = require('../../utils/ffmpeg-path');

const ffmpegPath = getFFmpegPath();
const TEMP_DIR = path.join(process.cwd(), 'data', 'temp');

// Garante que a pasta temporária existe
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Converte um arquivo de mídia para MP3 usando FFmpeg
 * @param {string} inputPath - Caminho do arquivo de entrada
 * @returns {Promise<string>} - Caminho do arquivo de saída (MP3)
 */
async function convertToMp3(inputPath) {
    return new Promise((resolve, reject) => {
        const outputName = `audio_${Date.now()}.mp3`;
        const outputPath = path.join(TEMP_DIR, outputName);

        const command = `"${ffmpegPath}" -i "${inputPath}" -vn -acodec libmp3lame -q:a 2 -y "${outputPath}"`;

        console.log('🎬 Iniciando conversão FFmpeg:', command);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Erro no FFmpeg:', stderr);
                return reject(new Error('Falha na conversão de mídia. Verifique se o FFmpeg está instalado.'));
            }
            console.log('✅ Conversão concluída!');
            resolve(outputPath);
        });
    });
}

module.exports = { convertToMp3 };
