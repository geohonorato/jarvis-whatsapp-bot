const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../../temp/media');

// Garante que a pasta temporária existe
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Baixa um vídeo do YouTube usando yt-dlp (Python) para maior robustez
 * @param {string} url - URL do vídeo
 * @returns {Promise<string>} - Caminho do arquivo baixado (MP4)
 */
async function downloadYouTubeVideo(url) {
    return new Promise((resolve, reject) => {
        const pythonScriptPath = path.join(TEMP_DIR, 'yt_downloader.py');
        const scriptContent = `
import yt_dlp
import sys
import os

url = sys.argv[1]
output_dir = sys.argv[2]

# Configuração do yt-dlp
ydl_opts = {
    'format': 'best[ext=mp4]/best',
    'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
    'quiet': True,
    'no_warnings': True,
    # Limita tamanho para evitar travar o bot (opcional, 100MB)
    'max_filesize': 100 * 1024 * 1024
}

try:
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)
        print(filename)
except Exception as e:
    print(f"ERROR: {str(e)}")
    sys.exit(1)
`;

        // 1. Escreve o script Python temporário (se não existir ou sempre para garantir atualização)
        fs.writeFileSync(pythonScriptPath, scriptContent);

        // 2. Executa o script
        // python "script.py" "URL" "OUTPUT_DIR"
        const command = `python "${pythonScriptPath}" "${url}" "${TEMP_DIR}"`;

        console.log(`🎬 Iniciando download via yt-dlp: ${url}`);

        exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Erro no download (yt-dlp):', stderr || error.message);
                return reject(new Error('Falha ao baixar vídeo. Verifique se o vídeo é válido e público.'));
            }

            const output = stdout.trim();
            if (output.startsWith('ERROR:')) {
                console.error('❌ Erro interno yt-dlp:', output);
                return reject(new Error('Erro ao processar vídeo no servidor.'));
            }

            // O script python imprime o caminho do arquivo na última linha
            const lines = output.split('\n');
            const filePath = lines[lines.length - 1].trim();

            if (fs.existsSync(filePath)) {
                console.log('✅ Download concluído:', filePath);
                resolve(filePath);
            } else {
                reject(new Error('Arquivo baixado não encontrado.'));
            }
        });
    });
}

module.exports = { downloadYouTubeVideo };
